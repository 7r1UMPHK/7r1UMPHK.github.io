![image-20250727171057275](http://7r1UMPHK.github.io/image/20250727171101631.webp)

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ cd tmp      
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ 7z x 076.zip 

7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-29
 64-bit locale=zh_CN.UTF-8 Threads:128 OPEN_MAX:1024, ASM

Scanning the drive for archives:
1 file, 415777 bytes (407 KiB)

Extracting archive: 076.zip
--
Path = 076.zip
Type = zip
Physical Size = 415777

Everything is Ok

Files: 2
Size:       1056496
Compressed: 415777
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -al               
总计 1459
drwxr-xr-x 1 kali kali    4096  7月27日 05:11 .
drwxr-xr-x 1 kali kali   16384  7月26日 10:07 ..
-rwxr-xr-x 1 kali kali  415777  7月27日 05:11 076.zip
-rwxr-xr-x 1 kali kali   16392 2024年 7月 1日 hmv010
-rwxr-xr-x 1 kali kali 1040104 2024年 7月 1日 hmv010-static
```

运行

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ./hmv010-static
Enter the flag : hello
Sorry, 𝓣𝓻𝔂 𝓱𝓪𝓻𝓭𝓮𝓻 !
```

反编译

```bash
int __fastcall main(int argc, const char **argv, const char **envp)
{
  char v4[40]; // [rsp+0h] [rbp-30h] BYREF
  unsigned __int64 v5; // [rsp+28h] [rbp-8h]

  v5 = __readfsqword(0x28u);
  generate_random_numbers(argc, argv, envp);
  printf("Enter the flag : ");
  __isoc99_scanf("%32s", v4);
  if ( (unsigned int)xor_and_check(v4) )
    puts("馃憦 Bravo馃憦");
  else
    puts("Sorry, 饾摚饾摶饾攤 饾摫饾摢饾摶饾摥饾摦饾摶 !");
  return 0;
}

void generate_random_numbers()
{
  int i; // [rsp+Ch] [rbp-4h]

  srand(0);
  for ( i = 0; i <= 31; ++i )
    numbers[i] = rand() % 256;
}

__int64 __fastcall xor_and_check(__int64 a1)
{
  int i; // [rsp+14h] [rbp-4h]

  for ( i = 0; i <= 31; ++i )
  {
    if ( (FLAG[i] ^ numbers[i]) != *(unsigned __int8 *)(i + a1) )
      return 0LL;
  }
  return 1LL;
}
```

gdb

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ gdb ./hmv010-static 
GNU gdb (Debian 16.3-1) 16.3
Copyright (C) 2024 Free Software Foundation, Inc.
License GPLv3+: GNU GPL version 3 or later <http://gnu.org/licenses/gpl.html>
This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.
Type "show copying" and "show warranty" for details.
This GDB was configured as "x86_64-linux-gnu".
Type "show configuration" for configuration details.
For bug reporting instructions, please see:
<https://www.gnu.org/software/gdb/bugs/>.
Find the GDB manual and other documentation resources online at:
    <http://www.gnu.org/software/gdb/documentation/>.

For help, type "help".
Type "apropos word" to search for commands related to "word"...
Reading symbols from ./hmv010-static...
(No debugging symbols found in ./hmv010-static)
(gdb) break xor_and_check
Breakpoint 1 at 0x401bdb
(gdb) run
Starting program: /mnt/hgfs/gx/x/tmp/hmv010-static 
Enter the flag : aaaaaa

Breakpoint 1, 0x0000000000401bdb in xor_and_check ()
(gdb) info variables FLAG
All variables matching regular expression "FLAG":

Non-debugging symbols:
0x00000000004b7020  FLAG
(gdb) info variables numbers
All variables matching regular expression "numbers":

Non-debugging symbols:
0x00000000004e83c0  numbers
(gdb) x/32bx 0x4b7020
0x4b7020 <FLAG>:        0x2f    0x00    0x00    0x00    0x8b    0x00    0x00    0x00
0x4b7028 <FLAG+8>:      0x3f    0x00    0x00    0x00    0x08    0x00    0x00    0x00
0x4b7030 <FLAG+16>:     0x01    0x00    0x00    0x00    0x8c    0x00    0x00    0x00
0x4b7038 <FLAG+24>:     0x2f    0x00    0x00    0x00    0x99    0x00    0x00    0x00
(gdb) x/32dw 0x4e83c0
0x4e83c0 <numbers>:     103     198     105     115
0x4e83d0 <numbers+16>:  81      255     74      236
0x4e83e0 <numbers+32>:  41      205     186     171
0x4e83f0 <numbers+48>:  242     251     227     70
0x4e8400 <numbers+64>:  124     194     84      248
0x4e8410 <numbers+80>:  27      232     231     141
0x4e8420 <numbers+96>:  118     90      46      99
0x4e8430 <numbers+112>: 51      159     201     154
(gdb) x/32dw 0x4b7020
0x4b7020 <FLAG>:        47      139     63      8
0x4b7030 <FLAG+16>:     1       140     47      153
0x4b7040 <FLAG+32>:     77      162     229     249
0x4b7050 <FLAG+48>:     147     149     167     118
0x4b7060 <FLAG+64>:     17      157     26      141
0x4b7070 <FLAG+80>:     118     138     130     255
0x4b7080 <FLAG+96>:     5       5       103     13
0x4b7090 <FLAG+112>:    108     192     138     231
```

写flag计算

```bash
#a.py
import random

def calc_flag():
    random.seed(0)
    
    flag_ints = [47, 139, 63, 8, 1, 140, 47, 153, 77, 162, 229, 249, 147, 149, 167, 118, 17, 157, 26, 141, 118, 138, 130, 255, 5, 5, 103, 13, 108, 192, 138, 231]
    numbers = [103, 198, 105, 115, 81, 255, 74, 236, 41, 205, 186, 171, 242, 251, 227, 70, 124, 194, 84, 248, 27, 232, 231, 141, 118, 90, 46, 99, 51, 159, 201, 154]
    
    flag = ''.join(chr(flag_ints[i] ^ numbers[i]) for i in range(32))
    print(flag)

calc_flag()
```

运行

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ python3 a.py             
HMV{Pseudo_RanD0m_Numbers_In__C}
```

