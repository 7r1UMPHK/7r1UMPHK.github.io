![image-20250722212408911](https://7r1umphk.github.io/image/20250722212409115.webp)

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ 7z x 070.zip 

7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-29
 64-bit locale=zh_CN.UTF-8 Threads:128 OPEN_MAX:1024, ASM

Scanning the drive for archives:
1 file, 308448 bytes (302 KiB)

Extracting archive: 070.zip
--
Path = 070.zip
Type = zip
Physical Size = 308448

Everything is Ok

Files: 2
Size:       316108
Compressed: 308448
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -al
总计 631
drwxr-xr-x 1 kali kali   4096  7月22日 09:39 .
drwxr-xr-x 1 kali kali  16384  7月22日 00:08 ..
-rwxr-xr-x 1 kali kali 308448  7月22日 09:39 070.zip
-rwxr-xr-x 1 kali kali   6600 2024年 3月14日 hmv005
-rwxr-xr-x 1 kali kali 309508 2024年 3月14日 hmv005-static
                                     
```

尝试反编译一下

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ strings hmv005                            
UPX!
tdoP7
[oQ7
/lib64
nux-x86-
so.2
puts
free
strlen
mall
art_
cxa_f    iz.
6sLIBC_2.34
5/ITM_deZgiE
CWneTabeK`
]_*(
PTE1
u+UH
_GLOBAL_OFFSET_TABLE_
frame_
dummy
 Lost in OSINT 
$/PP
;*3$"?}
USQRH
W^YH
PROT_EXEC|PROT_WRITE failed.
_j<X
$Info: This file is packed with the UPX executable packer http://upx.sf.net $
$Id: UPX 4.22 Copyright (C) 1996-2024 the UPX Team. All Rights Reserved. $
_RPWQM)
j"AZR^j
PZS^
/proc/self/exe
IuDSWH
s2V^
XAVAWPH
YT_j
AY^_
D$ [I
UPX!u
slIT$}
}aw993u
([]A\A]
I[8k
(L      "
tL      n
+xHf
p(E1[$1
fFj9
~*"|]
I5(Ag
@bQs
 k1(
=(I[u
A^A_)
m@S r6
ck5?
JAPC
JG=,1
SRVW
RY?WVj,4
GCC: (Debian 13.2.0-
/|G`
 x!va
0G]/
aw7L
Scrt1.o
_tag
stuff.c
deregi
_clones)do_g
bal     tor
s9ux5omple)d.0!
_fin`array_entry
vme ummy2
)t*hmv005
'Fwyk
RAME_END
DYNIC
vGNU
GLOBA
L_OFFSET_TABL
see@
BC_2
59libc_
nrmay
ITM_
T)Xroo
se1chH
dF_uod
cj(3bssNc
~KeySav
imP_
oize5
6.symnb
h        Np
o.gnu.prop
build-id
K       dynb
la(so#
.ehthd
Qd5G3
=,?8
"epa
.P/^
 0o9l
UPX!
UPX!
```

输出中多次出现了 UPX! 以及 $Info: This file is packed with the UPX executable packer http://upx.sf.net $ 的字样。这明确表示 hmv005 文件使用了 UPX 加壳工具进行了压缩和混淆。

脱壳

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ upx -d hmv005
                       Ultimate Packer for eXecutables
                          Copyright (C) 1996 - 2024
UPX 4.2.4       Markus Oberhumer, Laszlo Molnar & John Reiser    May 9th 2024

        File size         Ratio      Format      Name
   --------------------   ------   -----------   -----------
     24851 <-      6600   26.56%   linux/amd64   hmv005

Unpacked 1 file.
                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -al
总计 640
drwxr-xr-x 1 kali kali   4096  7月22日 09:41 .
drwxr-xr-x 1 kali kali  16384  7月22日 00:08 ..
-rwxr-xr-x 1 kali kali 308448  7月22日 09:39 070.zip
-rwxr-xr-x 1 kali kali  16192 2024年 3月14日 hmv005
-rwxr-xr-x 1 kali kali 309508 2024年 3月14日 hmv005-static
```

反编译一下

拖入IDA PRO

F5

```
int __fastcall main(int argc, const char **argv, const char **envp)
{
  unsigned __int64 v3; // rbx
  size_t v4; // rax
  unsigned __int64 v5; // rbx
  size_t v6; // rax
  int v8[34]; // [rsp+0h] [rbp-C0h]
  int v9; // [rsp+88h] [rbp-38h]
  int v10; // [rsp+8Ch] [rbp-34h]
  void *ptr; // [rsp+90h] [rbp-30h]
  char *v12; // [rsp+98h] [rbp-28h]
  char *s; // [rsp+A0h] [rbp-20h]
  int v14; // [rsp+A8h] [rbp-18h]
  int i; // [rsp+ACh] [rbp-14h]

  v8[0] = 113;
  v8[1] = 120;
  v8[2] = 123;
  v8[3] = 89;
  v8[4] = 116;
  v8[5] = 118;
  v8[6] = 73;
  v8[7] = 78;
  v8[8] = 22;
  v8[9] = 92;
  v8[10] = 122;
  v8[11] = 77;
  v8[12] = 82;
  v8[13] = 106;
  v8[14] = 101;
  v8[15] = 84;
  v8[16] = 65;
  v8[17] = 74;
  v8[18] = 86;
  v8[19] = 94;
  v8[20] = 87;
  v8[21] = 121;
  v8[22] = 110;
  v8[23] = 109;
  v8[24] = 103;
  v8[25] = 97;
  v8[26] = 112;
  v8[27] = 76;
  v8[28] = 89;
  v8[29] = 79;
  v8[30] = 95;
  v8[31] = 86;
  v14 = 32;
  s = "_GLOBAL_OFFSET_TABLE_";
  v12 = "frame_dummy";
  dontSearchForKeySaveTime(argc, argv, envp);
  ptr = malloc(0x21uLL);
  for ( i = 0; i < v14; ++i )
  {
    v3 = i;
    v4 = strlen(s);
    v10 = s[v3 % v4];
    v5 = i;
    v6 = strlen(v12);
    v9 = v12[v5 % v6];
    *((_BYTE *)ptr + i) = v9 ^ v10 ^ LOBYTE(v8[i]);
  }
  *((_BYTE *)ptr + v14) = 0;
  searchHere();
  free(ptr);
  puts(::s);
  return 0;
}
```

编个py

```
# C 代码中提供的数据
v8 = [
    113, 120, 123, 89, 116, 118, 73, 78, 22, 92, 122, 77, 82, 106, 101, 84,
    65, 74, 86, 94, 87, 121, 110, 109, 103, 97, 112, 76, 89, 79, 95, 86
]
s = "_GLOBAL_OFFSET_TABLE_"
v12 = "frame_dummy"
v14 = 32 # flag 长度

flag = []

# 复现 for 循环的逻辑
for i in range(v14):
    # 计算两个密钥的当前字符
    key_char1 = ord(s[i % len(s)])
    key_char2 = ord(v12[i % len(v12)])
    
    # 获取 v8 数组中的值
    v8_char = v8[i]
    
    # 执行三次异或操作
    decrypted_char = key_char1 ^ key_char2 ^ v8_char
    
    # 将解密后的字符添加到列表中
    flag.append(chr(decrypted_char))

# 将字符列表合并成最终的字符串
final_flag = "".join(flag)

print(f"解密得到的 Flag 是: {final_flag}")
```

运行

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ python3 a.py             
解密得到的 Flag 是: HMV{Shad4wExe_We_love_OSINT_but}
```

