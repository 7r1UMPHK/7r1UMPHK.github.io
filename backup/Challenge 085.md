![image-20250803102242549](http://7r1UMPHK.github.io/image/20250803102242764.webp)

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ 7z x 085.zip -o085

7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-29
 64-bit locale=zh_CN.UTF-8 Threads:128 OPEN_MAX:1024, ASM

Scanning the drive for archives:
1 file, 3032 bytes (3 KiB)

Extracting archive: 085.zip
--
Path = 085.zip
Type = zip
Physical Size = 3032

Everything is Ok

Size:       2923
Compressed: 3032
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cd 085 
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/085]
└─$ ls -al
总计 7
drwxr-xr-x 1 kali kali    0  8月 2日 22:23 .
drwxr-xr-x 1 kali kali 4096  8月 2日 22:23 ..
-rwxr-xr-x 1 kali kali 2923 2024年 9月29日 flag.png
```

flag.png没有可显示的内容

```bash
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/085]
└─$ exiftool flag.png 
ExifTool Version Number         : 13.25
File Name                       : flag.png
Directory                       : .
File Size                       : 2.9 kB
File Modification Date/Time     : 2024:09:29 08:11:46-04:00
File Access Date/Time           : 2025:08:02 22:23:20-04:00
File Inode Change Date/Time     : 2024:09:29 08:11:46-04:00
File Permissions                : -rwxr-xr-x
File Type                       : ZIP
File Type Extension             : zip
MIME Type                       : application/zip
Zip Required Version            : 20
Zip Bit Flag                    : 0
Zip Compression                 : None
Zip Modify Date                 : 2024:09:14 23:42:20
Zip CRC                         : 0x00000000
Zip Compressed Size             : 0
Zip Uncompressed Size           : 0
Zip File Name                   : hidden/
Warning                         : [minor] Use the Duplicates option to extract tags for all 2 files
```

那直接解压

```bash
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/085]
└─$ 7z x flag.png     

7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-29
 64-bit locale=zh_CN.UTF-8 Threads:128 OPEN_MAX:1024, ASM

Scanning the drive for archives:
1 file, 2923 bytes (3 KiB)

Extracting archive: flag.png
--
Path = flag.png
Type = zip
Physical Size = 2923

Everything is Ok

Folders: 1
Files: 1
Size:       2784
Compressed: 2923
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/085]
└─$ ls -al
总计 7
drwxr-xr-x 1 kali kali    0 2025年 8月 2日 .
drwxr-xr-x 1 kali kali 4096  8月 2日 22:23 ..
-rwxr-xr-x 1 kali kali 2923 2024年 9月29日 flag.png
drwxr-xr-x 1 kali kali    0 2024年 9月14日 hidden
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/085]
└─$ cd hidden 
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/…/x/tmp/085/hidden]
└─$ ls -al
总计 3
drwxr-xr-x 1 kali kali    0 2024年 9月14日 .
drwxr-xr-x 1 kali kali    0  8月 2日 22:26 ..
-rwxr-xr-x 1 kali kali 2784 2024年 9月14日 flag.png
```

![image-20250803102641124](http://7r1UMPHK.github.io/image/20250803102641231.webp)

```
HMV{F0r3N51C_3xP3rT_1N_7H3_R00M}
```

