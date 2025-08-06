![image-20250803095854556](http://7r1UMPHK.github.io/image/20250803095903114.webp)

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ 7z x 083.zip -o083

7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-29
 64-bit locale=zh_CN.UTF-8 Threads:128 OPEN_MAX:1024, ASM

Scanning the drive for archives:
1 file, 804934 bytes (787 KiB)

Extracting archive: 083.zip
--
Path = 083.zip
Type = zip
Physical Size = 804934

Everything is Ok

Size:       1516128
Compressed: 804934
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cd 083
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/083]
└─$ ls -al                
总计 1485
drwxr-xr-x 1 kali kali       0  8月 2日 21:59 .
drwxr-xr-x 1 kali kali    4096  8月 2日 21:59 ..
-rwxr-xr-x 1 kali kali 1516128 2024年 8月26日 secret

┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/083]
└─$ head -n 10 secret 
00000000: 8950 4e47 0d0a 1a0a 0000 000d 4948 4452  .PNG........IHDR
00000010: 0000 0271 0000 0190 0806 0000 00c1 7d36  ...q..........}6
00000020: 8200 0020 0049 4441 5478 5eec 9d07 9c5d  ... .IDATx^....]
00000030: 45d5 c067 b37d d37b af84 2484 2420 bd08  E..g.}.{..$.$ ..
00000040: 0888 0554 1450 143f ac88 8a15 6cd8 150b  ...T.P.?....l...
00000050: 62c3 aea8 8852 6c54 7b41 102c 8080 0212  b....RlT{A.,....
00000060: 0221 a186 12d2 7bd9 92fd ceff dc77 36b3  .!....{......w6.
00000070: 93b9 77ee ee4b 4854 1ebf b0bb efde 3b77  ..w..KHT......;w
00000080: ea99 ff9c 73e6 4ccd 9f7f 7c6e e7c6 8d1b  ....s.L...|n....
00000090: ddf0 e1c3 dd9d 77de e996 2e5f e6c6 8c19  ......w...._....
```

secret经过查看是xxd png的结果

```bash
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/083]
└─$ xxd -r secret > secret.png
```

![secret](http://7r1UMPHK.github.io/image/20250803100524026.webp)

图片上有个base64

```bash
SE1We2FuY2llbnR0aW1lczE40DB9Cg==
```

去CyberChef解码

```bash
HMV{ancienttimes1880}
```

