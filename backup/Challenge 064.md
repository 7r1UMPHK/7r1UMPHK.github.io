害，星期日还要看备考视频，放松一下

![image-20250720151939191](https://7r1UMPHK.github.io/image/20250720151939414.webp)

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ 7z x 064.zip 

7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-29
 64-bit locale=zh_CN.UTF-8 Threads:128 OPEN_MAX:1024, ASM

Scanning the drive for archives:
1 file, 337165 bytes (330 KiB)

Extracting archive: 064.zip
--
Path = 064.zip
Type = zip
Physical Size = 337165

Everything is Ok

Files: 2
Size:       337065
Compressed: 337165
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -al        
总计 675
drwxr-xr-x 1 kali kali   4096  7月20日 03:20 .
drwxr-xr-x 1 kali kali  12288  7月20日 03:14 ..
-rwxr-xr-x 1 kali kali 337165  7月20日 03:19 064.zip
-rwxr-xr-x 1 kali kali 336604 2024年 1月17日 challenge.png
-rwxr-xr-x 1 kali kali    461 2024年 1月18日 decodesteg.py
                                  
```

![challenge](https://7r1UMPHK.github.io/image/20250720152043954.webp)

isEven(R+G+B)提示flag 藏在“RGB 三通道之和为偶数”的像素里

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat decodesteg.py 
from PIL import Image

im = Image.open('challenge.png')
pixelMap = im.load()
img = Image.new( im.mode, im.size)
pixelsNew = img.load()

for i in range(img.size[0]):
    for j in range(img.size[1]):
        RGB = im.getpixel((i,j))
        R,G,B = RGB
        #

        #
        pixelsNew[i,j] = (R,G,B)
im.close()

img.show()
img.save("flag.png") 
img.close()

# Can you find the flag hidden in the image?
# may need to 'pip3 install pillow' if not installed
                                                  
```

填代码

```
from PIL import Image

im = Image.open('challenge.png')
pixelMap = im.load()
img = Image.new(im.mode, im.size)
pixelsNew = img.load()

for i in range(img.size[0]):
    for j in range(img.size[1]):
        R, G, B = im.getpixel((i, j))
        if (R + G + B) % 2 == 0:
            pixelsNew[i, j] = (255, 255, 255)  
        else:
            pixelsNew[i, j] = (0, 0, 0)        

im.close()
img.show()
img.save("flag.png")
img.close()
```

![flag](https://7r1UMPHK.github.io/image/20250720152504984.webp)

```
HMV{Play_with_Pixels}
```

