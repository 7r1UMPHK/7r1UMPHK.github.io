# `提前声明：我不是密码学玩家，所以肯定是有错的，别拷打我。看不下去的，出门左转自便。当然，你想更正的话，可以发评论。`

![image-20260107133049934](http://7r1UMPHK.github.io/image/20260107133101076.webp)

## 题目信息

```
Dr. Helena Morrison Vance, a renowned cryptographer, has left behind an encrypted message before her mysterious disappearance. She was last seen working late in her laboratory, muttering something about "rotating shields" and "the key to everything lies in who I am."

#challenge.asm
global _start
section .data
    ; Cipher
    msg db '0 0 0 153 82 76 202 3 123 126 241 17 0 12 206 189 108 86', 10
    msg_len equ $ - msg
section .text
_start:
    mov rax, 1      ; sys_write
    mov rdi, 1      ; stdout
    mov rsi, msg
    mov rdx, msg_len
    syscall

    mov rax, 60     ; sys_exit
    xor rdi, rdi
    syscall
```

------

## 先把密文抠出来

这段汇编本身没什么逻辑，跑起来就是把 `msg` 打印到 stdout，所以重点只有那串数字。

```
0 0 0 153 82 76 202 3 123 126 241 17 0 12 206 189 108 86
```

------

## “key to everything lies in who I am” → 密钥是谁

题目里的“who I am”指的就是人名本身：

> **Helena Morrison Vance**

最自然的处理方式就是取首字母：

```
H M V
```

所以先假设 key 是 `HMV`，并且按常规做法循环使用。

------

## 从密文结构推测 XOR 的存在

密文一上来就是：

```
0 0 0 ...
```

这个非常显眼，一般加密数据不会随便以三个 0 开头。

而 XOR 有一个很关键的性质：

- `0 ^ k = k`

如果 **XOR 是最后一步**，并且 key 循环是 `H M V`，那么前三个字节会直接解成：

```
0 ^ 'H' = 'H'
0 ^ 'M' = 'M'
0 ^ 'V' = 'V'
```

刚好得到：

```
HMV
```

这非常像 flag 的前缀（`XXX{...}`），所以这里可以基本确定：

- 使用了 XOR
- XOR 在最后一步
- key 为 `HMV`

------

## 验证一下：第 4 个字符是不是 `{`

既然已经能推出 `HMV`，那第 4 个字符大概率是 `{`。

密文第 4 个字节是：

```
153
```

这一位对应的 key 又回到 `'H'`。

如果最后一步是 XOR，那么在 XOR 之前（也就是 rotate 完之后）的中间值应满足：

```
mid ^ 'H' = '{'
mid = '{' ^ 'H'
```

计算一下：

- `{` = 123
- `H` = 72
- `123 ^ 72 = 51`

也就是说，rotate 之后的结果应该是 `51`。

这正好和题面里的另一句提示对上：

> **rotating shields**

说明在 XOR 之前还有一步 **8bit 循环移位（rotate）**，并且某种 rotate 可以把 `153` 变成 `51`。

------

## 剩下的只能爆破：rotate 规则无法唯一推理

到这里为止，能**推理确定的只有**：

1. 有 XOR，且在最后
2. key = `HMV`
3. 有 8bit rotate（ROL / ROR）

但以下内容**题面没有给唯一答案**：

- 左移还是右移
- 先 rotate 再 XOR，还是反过来
- 每个字节 rotate 几位
- rotate 位数是否和 index 有关

所以这一步只能老老实实 **爆破**。

------

## 爆破思路

rotate 的常见写法一般是：

```
rot = (i * k) % 8
```

于是直接枚举：

- rotate 方向：ROL / ROR
- rotate 顺序：rotate → xor / xor → rotate
- k ∈ [1..7]

筛选标准很简单：

- 输出是否基本可打印
- 是否明显像 flag

------

## 爆破脚本

```python
def rol8(x, r):
    r &= 7
    return ((x << r) & 0xFF) | (x >> (8 - r))

def ror8(x, r):
    r &= 7
    return (x >> r) | ((x << (8 - r)) & 0xFF)

cipher = [0, 0, 0, 153, 82, 76, 202, 3, 123, 126, 241, 17, 0, 12, 206, 189, 108, 86]
key = "HMV"

for k in range(1, 8):
    out = []
    for i, b in enumerate(cipher):
        rot = (i * k) % 8
        x = rol8(b, rot)          # 先 rotate
        p = x ^ ord(key[i % 3])   # 再 XOR
        out.append(chr(p))
    res = "".join(out)
    if all(32 <= ord(c) <= 126 for c in res):
        print(k, res)
```

运行后可以很快发现，只有一个结果既可读又像正常 flag：

```
k = 7
HMV{h4cK-w1tH-m3!}
```