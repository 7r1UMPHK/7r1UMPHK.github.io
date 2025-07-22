![image-20250722220049943](https://7r1umphk.github.io/image/20250722220050174.webp)

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ 7z x 073.zip 

7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-29
 64-bit locale=zh_CN.UTF-8 Threads:128 OPEN_MAX:1024, ASM

Scanning the drive for archives:
1 file, 1764017 bytes (1723 KiB)

Extracting archive: 073.zip
--
Path = 073.zip
Type = zip
Physical Size = 1764017

Everything is Ok

Size:       1764017
Compressed: 1764017
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -al
总计 3466
drwxr-xr-x 1 kali kali    4096  7月22日 10:02 .
drwxr-xr-x 1 kali kali   16384  7月22日 00:08 ..
-rwxr-xr-x 1 kali kali 1764017 2024年 5月26日 073.png
-rwxr-xr-x 1 kali kali 1764017  7月22日 10:01 073.zip
```

![073](https://7r1umphk.github.io/image/20250722220234455.webp)

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ stegseek 073.png               
StegSeek 0.6 - https://github.com/RickdeJager/StegSeek

[!] error: the file format of the file "073.png" is not supported.
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ binwalk 073.png 

DECIMAL       HEXADECIMAL     DESCRIPTION
--------------------------------------------------------------------------------
0             0x0             PNG image, 1600 x 1600, 8-bit/color RGB, non-interlaced
60            0x3C            Zlib compressed data, default compression

                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ steghide extract -sf 073.png   
Enter passphrase: 
steghide: the file format of the file "073.png" is not supported.
                                                                
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ zsteg 073.png  
imagedata           .. text: "UYZ.31)+)"
b1,rgb,lsb,xy       .. text: "nI?nKdK`$"
b4,r,lsb,xy         .. text: "\"D3ffUDUDDUUfUw"
b4,g,lsb,xy         .. text: "D3UUUDD33DDUUww"
b4,b,lsb,xy         .. text: "fffffUUUffUUDD333333333DDDDDDDD33333333DD33D3UD3DD3\"\""
b4,b,msb,xy         .. text: ["\"" repeated 8 times]
b4,rgb,lsb,xy       .. text: "0e&Re&RU"
b4,bgr,lsb,xy       .. text: "03%bV%bV"

┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ zsteg -E "b4,rgb,lsb,xy" 073.png > a
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ file a
a: data
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -la a
-rwxr-xr-x 1 kali kali 3840000  7月22日 10:06 a

┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ binwalk a

DECIMAL       HEXADECIMAL     DESCRIPTION
--------------------------------------------------------------------------------
```

https://georgeom.net/StegOnline/extract

Extract Files/Data

![image-20250722221534561](https://7r1umphk.github.io/image/20250722221534835.webp)

```
hmv{youreallyknowLSBbro}
```

