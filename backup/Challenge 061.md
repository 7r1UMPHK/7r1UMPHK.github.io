![image-20250718215535991](https://7r1umphk.github.io/image/20250718215536221.webp)

https://hackmyvm.eu/challenges/challenge.php?c=061

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -la 061.zip 
-rwxr-xr-x 1 kali kali 435  7月18日 09:55 061.zip
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ 7z x 06*.zip

7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-29
 64-bit locale=zh_CN.UTF-8 Threads:128 OPEN_MAX:1024, ASM

Scanning the drive for archives:
1 file, 435 bytes (1 KiB)

Extracting archive: 061.zip
--
Path = 061.zip
Type = zip
Physical Size = 435

Everything is Ok

Size:       430
Compressed: 435
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -al        
总计 13
drwxr-xr-x 1 kali kali 4096  7月18日 09:56 .
drwxr-xr-x 1 kali kali 8192  7月17日 23:37 ..
-rwxr-xr-x 1 kali kali  430 2024年 1月24日 061.txt
-rwxr-xr-x 1 kali kali  435  7月18日 09:55 061.zip
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat 061.txt
UEsDBC0AAgAIALySN1jMnd4u//////////8BABQALQEAEAA4BQAAAAAAAHgAAAAAAAAArVPJDcAg
DFvJ3n+58mih5G6KhGQBVi7HAAmMsyEWciAh/ieP877xnnfIeBmfimfW4cZf/2HdL4z7S3hZXlUn
a3Og5v+KW9XXzY/ePGW8sp7s7Ve1Dq+vbG9P6WDse+yH4vwMf7byez5HU192dT3kl89+pdvfzb8A
UEsBAh4DLQACAAgAvJI3WMyd3i54AAAAOAUAAAEAAAAAAAAAAQAAAIARAAAAAC1QSwYGLAAAAAAA
AAAeAy0AAAAAAAAAAAABAAAAAAAAAAEAAAAAAAAALwAAAAAAAACrAAAAAAAAAFBLBgcAAAAA2gAA
AAAAAAABAAAAUEsFBgAAAAABAAEALwAAAKsAAAAAAA==
                                    
```

https://gchq.github.io/CyberChef/

![image-20250718215743580](https://7r1umphk.github.io/image/20250718215743873.webp)

PKZIP压缩文件

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ 7z x 061b.zip -oa           

┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -la a      
总计 6
-rwxr-xr-x 1 kali kali 1336 2024年 1月23日 -
drwxr-xr-x 1 kali kali    0  7月18日 10:01 .
drwxr-xr-x 1 kali kali 4096  7月18日 10:01 ..
```

神人

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat a/-                   
0011001000110010001100000011000001110100001100100011001000110001001100100111010000110001001100000011000000110001001100100111010000110001001100010011000100110010001100000111010000110001001100000011000000110000001100010111010000110010001100100011001000110010011101000011001000110010001100000011001001110100001100100011000000110000001100010111010000110001001100000011000100110001001100100111010000110001001100100011000100110001011101000011000100110000001100010011000100110010011101000011001000110010001100000011000001110100001100010011001000110001001100000111010000110010001100100011001000110010011101000011000100110010001100100011000001110100001100010011000000110001001100010011001001110100001100010011000000110000001100100011001001110100001100010011001000110001001100000111010000110001001100000011000000110001001100010111010000110001001100000011000100110001001100100111010000110010001100010011000100110001011101000011000100110001001100000011001000110000011101000011000100110010001100100011000101110100001100100011000100110001001100010111010000110010001100100011000100110000011101000011000100110010001100100011000001110100001100100011000100110001001100100111010000110001001100000011000100110001001100100111010000110001001100100011000100110001011101000011001000110000001100000011000101110100001100010011000100110001001100100011001001110100                                                         
```

![image-20250718220535012](https://7r1umphk.github.io/image/20250718220535314.webp)

解出一个三进制，t为分隔符

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat a.py 
s = "2200t2212t10012t11120t10001t2222t2202t2001t10112t1211t10112t2200t1210t2222t1220t10112t10022t1210t10011t10112t2111t11020t1221t2111t2210t1220t2112t10112t1211t2001t11122t"
nums = s.strip('t').split('t')
flag = ''.join(chr(int(n, 3)) for n in nums)
print(flag)
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ python3 $_               
HMV{RPJ7_1_H0P3_Y0U_Cr4CK3D_17}
                          
```

