![image-20250803102805187](http://7r1UMPHK.github.io/image/20250803102805423.webp)

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ 7z x 086.zip -o086

7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-29
 64-bit locale=zh_CN.UTF-8 Threads:128 OPEN_MAX:1024, ASM

Scanning the drive for archives:
1 file, 98681 bytes (97 KiB)

Extracting archive: 086.zip
--
Path = 086.zip
Type = zip
Physical Size = 98681

Everything is Ok

Size:       100517
Compressed: 98681
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cd 086   
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/086]
└─$ ls -al
总计 103
drwxr-xr-x 1 kali kali      0 2025年 8月 2日 .
drwxr-xr-x 1 kali kali   4096 2025年 8月 2日 ..
-rwxr-xr-x 1 kali kali 100517 2024年 9月29日 EZPZ.png
```

![image-20250803102855174](http://7r1UMPHK.github.io/image/20250803102855280.webp)

```bash
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/086]
└─$ exiftool EZPZ.png 
ExifTool Version Number         : 13.25
File Name                       : EZPZ.png
Directory                       : .
File Size                       : 101 kB
File Modification Date/Time     : 2024:09:29 08:13:27-04:00
File Access Date/Time           : 2025:08:02 22:28:55-04:00
File Inode Change Date/Time     : 2024:09:29 08:13:27-04:00
File Permissions                : -rwxr-xr-x
File Type                       : PNG
File Type Extension             : png
MIME Type                       : image/png
Image Width                     : 500
Image Height                    : 461
Bit Depth                       : 8
Color Type                      : RGB
Compression                     : Deflate/Inflate
Filter                          : Adaptive
Interlace                       : Noninterlaced
Profile Name                    : ICC Profile
Profile CMM Type                : Little CMS
Profile Version                 : 4.4.0
Profile Class                   : Display Device Profile
Color Space Data                : RGB
Profile Connection Space        : XYZ
Profile Date Time               : 2024:09:14 17:27:52
Profile File Signature          : acsp
Primary Platform                : Apple Computer Inc.
CMM Flags                       : Not Embedded, Independent
Device Manufacturer             : 
Device Model                    : 
Device Attributes               : Reflective, Glossy, Positive, Color
Rendering Intent                : Perceptual
Connection Space Illuminant     : 0.9642 1 0.82491
Profile Creator                 : Little CMS
Profile ID                      : 0
Profile Description             : GIMP built-in sRGB
Profile Copyright               : Public Domain
Media White Point               : 0.9642 1 0.82491
Chromatic Adaptation            : 1.04788 0.02292 -0.05022 0.02959 0.99048 -0.01707 -0.00925 0.01508 0.75168
Red Matrix Column               : 0.43604 0.22249 0.01392
Blue Matrix Column              : 0.14305 0.06061 0.71393
Green Matrix Column             : 0.38512 0.7169 0.09706
Red Tone Reproduction Curve     : (Binary data 32 bytes, use -b option to extract)
Green Tone Reproduction Curve   : (Binary data 32 bytes, use -b option to extract)
Blue Tone Reproduction Curve    : (Binary data 32 bytes, use -b option to extract)
Chromaticity Channels           : 3
Chromaticity Colorant           : Unknown
Chromaticity Channel 1          : 0.64 0.33002
Chromaticity Channel 2          : 0.3 0.60001
Chromaticity Channel 3          : 0.15001 0.06
Device Mfg Desc                 : GIMP
Device Model Desc               : sRGB
Comment                         : MDEwMDAwMDEgMDEwMDAwMTAgMDEwMDAxMTEgMDEwMTExMTEgMDEwMDExMTAgMDEwMTExMTEgMDEwMTAwMTEgMDEwMTEwMDEgMDEwMDExMTAgMDEwMTAxMDAgMDExMTEwMTEgMDEwMTEwMDEgMDEwMDAxMTAgMDEwMDExMTEgMDExMTExMDE=
Image Size                      : 500x461
Megapixels                      : 0.231
```

![image-20250803103024253](http://7r1UMPHK.github.io/image/20250803103024563.webp)

base64 binary

```
ABG_N_SYNT{YFO}
```

是rot13，但是被耍了

![image-20250803103450684](http://7r1UMPHK.github.io/image/20250803103450943.webp)

那看lsb

```bash
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/086]
└─$ zsteg EZPZ.png
meta Comment        .. text: "MDEwMDAwMDEgMDEwMDAwMTAgMDEwMDAxMTEgMDEwMTExMTEgMDEwMDExMTAgMDEwMTExMTEgMDEwMTAwMTEgMDEwMTEwMDEgMDEwMDExMTAgMDEwMTAxMDAgMDExMTEwMTEgMDEwMTEwMDEgMDEwMDAxMTAgMDEwMDExMTEgMDExMTExMDE="
imagedata           .. file: amd 29k coff noprebar executable
b1,r,lsb,xy         .. text: "HMV{I7_w45_3a5y_R1GH7}"
b1,rgb,msb,xy       .. file: OpenPGP Public Key
b2,g,lsb,xy         .. file: VISX image file
b3,bgr,lsb,xy       .. file: OpenPGP Secret Key
b4,g,lsb,xy         .. text: "UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUDDUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU"
b4,b,lsb,xy         .. text: "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD33DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD"
b4,b,msb,xy         .. text: ["\"" repeated 186 times]
```

flag

```
HMV{I7_w45_3a5y_R1GH7}
```

