![image-20250722210655654](https://7r1umphk.github.io/image/20250722210710989.webp)

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ 7z x 069.zip 

7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-29
 64-bit locale=zh_CN.UTF-8 Threads:128 OPEN_MAX:1024, ASM

Scanning the drive for archives:
1 file, 198 bytes (1 KiB)

Extracting archive: 069.zip
--
Path = 069.zip
Type = zip
Physical Size = 198

Everything is Ok

Size:       4
Compressed: 198
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -al
总计 21
drwxr-xr-x 1 kali kali  4096  7月22日 09:07 .
drwxr-xr-x 1 kali kali 16384  7月22日 00:08 ..
-rwxr-xr-x 1 kali kali     4 2024年 4月19日 069.bin
-rwxr-xr-x 1 kali kali   198  7月22日 09:07 069.zip
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ find 069.bin                                             
069.bin
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ strings 069.bin                           
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat 069.bin
�                                                                                               
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ xxd 069.bin
00000000: 8d08 13b0                                ....
```

我去，这么少东西

```
8d0813b0
HM@....@
HM@HACK@
```

