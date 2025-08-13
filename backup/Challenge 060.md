![image-20250718215028063](https://7r1umphk.github.io/image/20250718215056695.webp)

https://hackmyvm.eu/challenges/challenge.php?c=060

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -la 060.zip 
-rwxr-xr-x 1 kali kali 5795  7月18日 09:51 060.zip
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ 7z x 060.zip 

7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-29
 64-bit locale=zh_CN.UTF-8 Threads:128 OPEN_MAX:1024, ASM

Scanning the drive for archives:
1 file, 5795 bytes (6 KiB)

Extracting archive: 060.zip
--
Path = 060.zip
Type = zip
Physical Size = 5795

Everything is Ok

Size:       23103
Compressed: 5795
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -la        
总计 1424
drwxr-xr-x 1 kali kali    4096  7月18日 09:51 .
drwxr-xr-x 1 kali kali    8192  7月17日 23:37 ..
...
-rwxr-xr-x 1 kali kali   23103 2024年 1月22日 060.txt
-rwxr-xr-x 1 kali kali    5795  7月18日 09:51 060.zip
...
    
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ head -n 10 060.txt
G90
G20
G17 G64 P0.001 M3 S3000
F5.00
G0 Z0.2500
G0 X0.1329 Y0.0000
G1 Z-0.0010 F0.10
G1 X0.1329 Y0.0000F5.00
G1 Y0.0946
G1 X0.0536
```

G-code 学机床的应该很熟，哈哈哈

https://ncviewer.com/

![image-20250718215438894](https://7r1umphk.github.io/image/20250718215439411.webp)

```
HMV{engraving_a_trophy_for_Kerszi}
```

