这两天github被标记了，所以现在写的wp，博客后面才慢慢发

这两天复习快疯了，打打challenges

![image-20250726092459966](http://7r1UMPHK.github.io/image/20250726092508923.webp)

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ 7z x 074.zip 

7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-29
 64-bit locale=zh_CN.UTF-8 Threads:128 OPEN_MAX:1024, ASM

Scanning the drive for archives:
1 file, 10720923 bytes (11 MiB)

Extracting archive: 074.zip
--
Path = 074.zip
Type = zip
Physical Size = 10720923

Everything is Ok

Files: 2
Size:       10729161
Compressed: 10720923
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -al
总计 20969
drwxr-xr-x 1 kali kali     4096  7月25日 21:26 .
drwxr-xr-x 1 kali kali    16384  7月25日 08:07 ..
-rwxr-xr-x 1 kali kali 10729024 2024年 5月26日 074.png
-rwxr-xr-x 1 kali kali      137 2024年 5月28日 074.txt
-rwxr-xr-x 1 kali kali 10720923  7月25日 21:25 074.zip
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat 074.txt 
0000000001100100011011110101111101111001011011110111010101011111011011000110100101101011011001010101111101111000011011110111001000111111
```

是hex，解一下

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat 074.txt | perl -lpe '$_=pack"B*",$_'
do_you_like_xor?
```

XOR异或，意思就是还有东西

![074](http://7r1UMPHK.github.io/image/20250726093019615.webp)

喵喵，哈哈哈

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ binwalk -e 074.png 

DECIMAL       HEXADECIMAL     DESCRIPTION
--------------------------------------------------------------------------------
60            0x3C            Zlib compressed data, default compression

WARNING: One or more files failed to extract: either no utility was found or it's unimplemented

                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ binwalk 074.png    

DECIMAL       HEXADECIMAL     DESCRIPTION
--------------------------------------------------------------------------------
0             0x0             PNG image, 2882 x 3840, 8-bit/color RGB, non-interlaced
60            0x3C            Zlib compressed data, default compression
3858618       0x3AE0BA        JBOOT SCH2 kernel header, compression type: gzip, Entry Point: 0xFE3E8414, image size: 936827483 bytes, data CRC: 0xAC684B75, Data Address: 0xD1EDDC73, rootfs offset: 0xC8D8C018, rootfs size: 294417102 bytes, rootfs CRC: 0xA1288981, header CRC: 0x44230814, header size: 36867 bytes, cmd line length: 22886 bytes
4911357       0x4AF0FD        JBOOT STAG header, image id: 0, timestamp 0x883BEF22, image size: 271372934 bytes, image JBOOT checksum: 0xB20, header JBOOT checksum: 0x20EB

                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ zsteg 074.png      
imagedata           .. text: "\n\n\n\t\t\t\n\n"
b1,rgb,msb,xy       .. text: "DJ$%I\"II$II"
b2,b,msb,xy         .. text: "VZj]-vOF"
b2,rgb,lsb,xy       .. file: OpenPGP Secret Key
b3,b,msb,xy         .. text: "Mqpn|Tq\rz"
b3,bgr,lsb,xy       .. text: "Ho$[@2A 4"
b4,r,lsb,xy         .. text: "St{aUFdb"
b4,b,lsb,xy         .. text: "DDUDUTDDEUTDUUTDTDUDDDDDDDUUfUUDDEUUDUV"
b4,rgb,lsb,xy       .. text: "UCCxtTwk"
b4,rgb,msb,xy       .. text: "E4sEFVaS6"
b4,bgr,lsb,xy       .. text: "ESCxtTgz"
b4,bgr,msb,xy       .. text: "0DuCFQVc3"
```

没啥感兴趣的，应该是lsb

https://georgeom.net/StegOnline/extract

Extract Data  RGB全0

hex那扒拉一段

```
68091924000000000108000000111b5342e6eeab5bb7855cd926dc2491c75648d2564
```

处理

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat 074.txt | perl -lpe '$_=pack"B*",$_' | xxd -p
00646f5f796f755f6c696b655f786f723f0a
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ echo -n "00646f5f796f755f6c696b655f786f723f0a" | wc -c        
36
                    
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ echo "68091924000000000108000000111b5342e6eeab5bb7855cd926dc2491c75648d2564" | head -c 36
68091924000000000108000000111b5342e6                                                    
```

XOR一下
```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ python3 -c "a='00646f5f796f755f6c696b655f786f723f0a';b='68091924000000000108000000111b5342e6';print(''.join(format(int(a[i:i+2],16)^int(b[i:i+2],16),'02x')for i in range(0,36,2)))"
686d767b796f755f6d616b655f6974217dec
                     
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ echo "686d767b796f755f6d616b655f6974217dec" | xxd -r -p
hmv{you_make_it!}�                                                                      
```

