![image-20250728104622420](http://7r1UMPHK.github.io/image/20250728104641252.webp)

![image-20250728104649253](http://7r1UMPHK.github.io/image/20250728104649363.webp)

反编译

```c
int __fastcall main(int argc, const char **argv, const char **envp)
{
  funkcja1(argc, argv, envp);
  return 0;
}

int funkcja1()
{
  char s[32]; // [rsp+0h] [rbp-40h] BYREF
  __int64 v2[2]; // [rsp+20h] [rbp-20h] BYREF
  int v3; // [rsp+30h] [rbp-10h]

  v2[0] = 0xC5E4E0C3F9E0D0D4LL;
  v2[1] = 0xE09AD8F7E4C0E1D3LL;
  v3 = -1802251312;
  policz_to(s, v2, string72);
  return puts(s);
}

__int64 __fastcall policz_to(__int64 a1, __int64 a2, __int64 a3)
{
  __int64 result; // rax
  int i; // [rsp+24h] [rbp-4h]

  for ( i = 0; i <= 19; ++i )
    *(_BYTE *)(i + a1) = ~(*(_BYTE *)(i + a3) ^ *(_BYTE *)(i + a2));
  result = a1 + 20;
  *(_BYTE *)(a1 + 20) = 0;
  return result;
}

.data:0000000000407910 string72        db 'dIZQmPVTUttkFJ0SlZ81',0
.data:0000000000407910                                         ; DATA XREF: funkcja1+37↑o
```

他这个程序直接执行是会输出东西的

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ./hmv-011       
OfEWQOMnyjKpNmULCvTZ
```

但问题是这个不是flag，而且我根据他的tip，尝试rev也不行

然后我去仔细观察了一下ida，我发现他还有很多funkcja的函数，1-100

```c
int funkcja2()
{
  char s[32]; // [rsp+0h] [rbp-40h] BYREF
  __int64 v2[2]; // [rsp+20h] [rbp-20h] BYREF
  int v3; // [rsp+30h] [rbp-10h]

  v2[0] = 0xD9CD87CFF6E48DECLL;
  v2[1] = 0xEFC3BFD3FFEE83FELL;
  v3 = -1044847680;
  policz_to(s, v2, string9);
  return puts(s);
}
```

那直接写个脚本爆破

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ objdump -d ./hmv-011 | grep -A 10 '<main>:'
0000000000403336 <main>:
  403336:       f3 0f 1e fa             endbr64
  40333a:       55                      push   %rbp
  40333b:       48 89 e5                mov    %rsp,%rbp
  40333e:       b8 00 00 00 00          mov    $0x0,%eax
  403343:       e8 56 de ff ff          call   40119e <funkcja1>
  403348:       b8 00 00 00 00          mov    $0x0,%eax
  40334d:       5d                      pop    %rbp
  40334e:       c3                      ret

Disassembly of section .fini:
```

编写脚本

```bash
#!/bin/bash

BIN="./hmv-011"
ADDR="*0x403343"

for i in $(seq 1 100); do
    FN="funkcja${i}"
    echo -n "[*] test: ${FN}"

    OUT=$(gdb -q -batch \
        -ex "b ${ADDR}" \
        -ex "r" \
        -ex "jump ${FN}" \
        -ex "c" \
        --args ${BIN} 2>/dev/null)

    if echo "$OUT" | grep -q "HMV{"; then
        echo -e "\n\n[+] Found: ${FN}"
        echo "[!] FLAG: $(echo "$OUT" | grep -o 'HMV{[^}]*}')"
        exit 0
    else
        echo -ne "\r"
    fi
done

echo "[-] Failed."
```

执行

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ bash a.sh
[*] test: funkcja82

[+] Found: funkcja82
[!] FLAG: HMV{Is11task_hard??}
```

