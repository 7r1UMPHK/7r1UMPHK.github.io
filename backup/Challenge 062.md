![image-20250718220920924](https://7r1umphk.github.io/image/20250718220921171.webp)

https://hackmyvm.eu/challenges/challenge.php?c=062

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -la 062.zip 
-rwxr-xr-x 1 kali kali 2375882  7月18日 10:10 062.zip
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ 7z x 062.zip     

7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-29
 64-bit locale=zh_CN.UTF-8 Threads:128 OPEN_MAX:1024, ASM

Scanning the drive for archives:
1 file, 2375882 bytes (2321 KiB)

Extracting archive: 062.zip
--
Path = 062.zip
Type = zip
Physical Size = 2375882

Everything is Ok

Size:       2377257
Compressed: 2375882
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -la        
总计 4655
drwxr-xr-x 1 kali kali    4096  7月18日 10:10 .
drwxr-xr-x 1 kali kali    8192  7月17日 23:37 ..
-rwxr-xr-x 1 kali kali 2377257 2023年 1月10日 062.png
-rwxr-xr-x 1 kali kali 2375882  7月18日 10:10 062.zip
                                     
```

![image-20250718221100328](https://7r1umphk.github.io/image/20250718221101047.webp)

现在看到飞机就烦，之前解那个机场那个到现在都没搞明白

看到有一个条码还是完整的，找个条码扫描，扫扫

https://www.1txm.com/barcodeDecode

![image-20250718221717097](https://7r1umphk.github.io/image/20250718221717466.webp)

```
HMV{1_l0v3_c0d3_128}
```

