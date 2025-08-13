![image-20250803103549525](http://7r1UMPHK.github.io/image/20250803103549762.webp)

```bash
Problem: SC5cLlspLlwpLlspLlwuWy5c7I6XLkgpLi4uLg== Hint: key is kerszi and what can you see ? Flag format: flag{xxx}
```

base64解一下

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ echo 'SC5cLlspLlwpLlspLlwuWy5c7I6XLkgpLi4uLg=='|base64 -d
H.\.[).\).[).\.[.\쎗.H)....
```

key:kerszi

xor

![image-20250803104615642](http://7r1UMPHK.github.io/image/20250803104615923.webp)

```
F R U' R' U' R U R' F'    
```

魔法方程

https://rubikscu.be/

![image-20250803110156219](http://7r1UMPHK.github.io/image/20250803110156383.webp)

```bash
flag{T}
```

