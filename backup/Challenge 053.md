![image-20250705184956768](https://7r1umphk.github.io/image/20250705185005753.webp)

https://hackmyvm.eu/challenges/challenge.php?c=053

```
<pre> 9950b5c66f8518f8b012359dc7390589 c03ec75734f58d87cddff35c57786429 e757e84e31ef68a74d86d6b52478654c HMV{c761d942cf5fe4ba9ece382739afef4e} </pre>
```

看着像hash

![image-20250705185544591](https://7r1umphk.github.io/image/20250705185544745.webp)

像找规律，生成字典

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ crunch 7 7 -t 1@@@@@4 -o pass                  
Crunch will now generate the following amount of data: 95051008 bytes
90 MB
0 GB
0 TB
0 PB
Crunch will now generate the following number of lines: 11881376 

crunch: 100% completed generating output
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ tail -n 1 pass
1zzzzz4
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ head -n 1 pass               
1aaaaa4
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ john --wordlist=pass --format=raw-md5 hash
Using default input encoding: UTF-8
Loaded 1 password hash (Raw-MD5 [MD5 512/512 AVX512BW 16x3])
Warning: no OpenMP support for this hash type, consider --fork=8
Press 'q' or Ctrl-C to abort, almost any other key for status
1lordp4          (?)     
1g 0:00:00:00 DONE (2025-07-05 07:02) 9.090g/s 48041Kp/s 48041Kc/s 48041KC/s 1loqiq4..1lormd4
Use the "--show --format=Raw-MD5" options to display all of the cracked passwords reliably
Session completed. 
                      
```

HMV{1lordp4}