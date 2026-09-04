![image-20250803100714272](http://7r1UMPHK.github.io/image/20250803100714514.webp)

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ 7z x 084.zip -o084

7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-29
 64-bit locale=zh_CN.UTF-8 Threads:128 OPEN_MAX:1024, ASM

Scanning the drive for archives:
1 file, 414206 bytes (405 KiB)

Extracting archive: 084.zip
--
Path = 084.zip
Type = zip
Physical Size = 414206

Everything is Ok

Files: 2
Size:       1051168
Compressed: 414206
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cd 084 
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/084]
└─$ ls -al
总计 1031
drwxr-xr-x 1 kali kali       0  8月 2日 22:07 .
drwxr-xr-x 1 kali kali    4096  8月 2日 22:07 ..
-rwxr-xr-x 1 kali kali   16224 2024年 9月26日 hmv-012
-rwxr-xr-x 1 kali kali 1034944 2024年 9月26日 hmv-012-static

┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/084]
└─$ ./hmv-012-static      
Enter the flag: xxoo
Incorrect flag.
```

反编译

```c
int __fastcall main(int argc, const char **argv, const char **envp)
{
  int v4; // eax
  int i; // [rsp+Ch] [rbp-74h]
  int v6; // [rsp+10h] [rbp-70h]
  int v7; // [rsp+14h] [rbp-6Ch]
  int v8; // [rsp+18h] [rbp-68h]
  int v9; // [rsp+1Ch] [rbp-64h]
  int v10; // [rsp+20h] [rbp-60h]
  int v11; // [rsp+24h] [rbp-5Ch]
  int v12; // [rsp+28h] [rbp-58h]
  int v13; // [rsp+2Ch] [rbp-54h]
  int v14; // [rsp+30h] [rbp-50h]
  int v15; // [rsp+34h] [rbp-4Ch]
  int v16; // [rsp+38h] [rbp-48h]
  int v17; // [rsp+3Ch] [rbp-44h]
  int v18; // [rsp+40h] [rbp-40h]
  int v19; // [rsp+44h] [rbp-3Ch]
  int v20; // [rsp+48h] [rbp-38h]
  char s1[24]; // [rsp+60h] [rbp-20h] BYREF
  unsigned __int64 v22; // [rsp+78h] [rbp-8h]

  v22 = __readfsqword(0x28u);
  printf("Enter the flag: ");
  __isoc99_scanf("%20s", s1);
  for ( i = 0; i <= 19; ++i )
    *(&v6 + i) = s1[i];
  if ( !strcmp(s1, "HMV{StringsAgain?}") )
  {
    print_hint();
    return 0;
  }
  else
  {
    if ( v6 == 72
      && (v4 = 8 * v7, LOBYTE(v4) = (8 * v7) ^ 0x90, (v4 | ((3 * (v7 ^ 0x13)) >> 3)) == 763)
      && ((16 * v8) ^ 0x120 | ((2 * (v8 ^ 0x13)) >> 4)) == 1096
      && ((32 * v9) ^ 0x240 | ((6 * (v9 ^ 0x13)) >> 5)) == 3379
      && v10 == 90
      && ((8 * (v11 ^ 0x12)) | ((3 * (v11 ^ 0x13)) >> 5)) == 267
      && ((20 * (v12 ^ 0x34)) | ((2 * (v12 ^ 0x23)) >> 4)) == 2143
      && v13 == 79
      && ((56 * (v14 ^ 0x21)) | ((2 * (v14 ^ 0x33)) >> 2)) == 4648
      && v15 == 95
      && ((24 * (v16 ^ 0x11)) | ((3 * (v16 ^ 0x22)) >> 3)) == 1957
      && ((24 * (v17 ^ 0x11)) | ((3 * (v17 ^ 0x23)) >> 3)) == 3068
      && v18 == 103
      && ((24 * (v19 ^ 0x11)) | ((3 * (v19 ^ 0x22)) >> 3)) == 2398
      && ((24 * (v20 ^ 0x11)) | ((3 * (v20 ^ 0x22)) >> 3)) == 2595 )
    {
      puts("Congratulations! This is the correct flag.");
    }
    else
    {
      puts("Incorrect flag.");
    }
    return 0;
  }
}
```

进去print_hint函数看了眼，HMV{StringsAgain?}是假flag

写个py算一下

```python
def slv_v7():
    for i in range(32, 127):
        v7 = i
        v4_temp = 8 * v7
        v4 = (v4_temp & 0xFFFFFF00) | ((v4_temp & 0xFF) ^ 0x90)
        if (v4 | ((3 * (v7 ^ 0x13)) >> 3)) == 763:
            return chr(i)

def slv_v8():
    for i in range(32, 127):
        v8 = i
        if ((16 * v8) ^ 0x120 | ((2 * (v8 ^ 0x13)) >> 4)) == 1096:
            return chr(i)

def slv_v9():
    for i in range(32, 127):
        v9 = i
        if ((32 * v9) ^ 0x240 | ((6 * (v9 ^ 0x13)) >> 5)) == 3379:
            return chr(i)

def slv_v11():
    for i in range(32, 127):
        v11 = i
        if ((8 * (v11 ^ 0x12)) | ((3 * (v11 ^ 0x13)) >> 5)) == 267:
            return chr(i)

def slv_v12():
    for i in range(32, 127):
        v12 = i
        if ((20 * (v12 ^ 0x34)) | ((2 * (v12 ^ 0x23)) >> 4)) == 2143:
            return chr(i)

def slv_v14():
    for i in range(32, 127):
        v14 = i
        if ((56 * (v14 ^ 0x21)) | ((2 * (v14 ^ 0x33)) >> 2)) == 4648:
            return chr(i)

def slv_v16():
    for i in range(32, 127):
        v16 = i
        if ((24 * (v16 ^ 0x11)) | ((3 * (v16 ^ 0x22)) >> 3)) == 1957:
            return chr(i)

def slv_v17():
    for i in range(32, 127):
        v17 = i
        if ((24 * (v17 ^ 0x11)) | ((3 * (v17 ^ 0x23)) >> 3)) == 3068:
            return chr(i)

def slv_v19():
    for i in range(32, 127):
        v19 = i
        if ((24 * (v19 ^ 0x11)) | ((3 * (v19 ^ 0x22)) >> 3)) == 2398:
            return chr(i)

def slv_v20():
    for i in range(32, 127):
        v20 = i
        if ((24 * (v20 ^ 0x11)) | ((3 * (v20 ^ 0x22)) >> 3)) == 2595:
            return chr(i)

if __name__ == '__main__':
    flag = ["" for _ in range(15)]
    
    flag[0] = 'H'
    flag[1] = slv_v7()
    flag[2] = slv_v8()
    flag[3] = slv_v9()
    flag[4] = 'Z'
    flag[5] = slv_v11()
    flag[6] = slv_v12()
    flag[7] = 'O'
    flag[8] = slv_v14()
    flag[9] = '_'
    flag[10] = slv_v16()
    flag[11] = slv_v17()
    flag[12] = 'g'
    flag[13] = slv_v19()
    flag[14] = slv_v20()
    
    print("".join(flag))
```

flag

```bash
HMV{Z0nl_bigt}
```



