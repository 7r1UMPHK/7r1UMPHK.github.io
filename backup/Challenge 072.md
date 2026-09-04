![image-20250722215411456](https://7r1umphk.github.io/image/20250722215411704.webp)

解压，查看

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -al 
总计 91364
drwxr-xr-x 1 kali kali     4096  7月22日 09:57 .
drwxr-xr-x 1 kali kali    16384  7月22日 00:08 ..
-rwxr-xr-x 1 kali kali 93536118 2024年 4月 7日 072.zip
drwxr-xr-x 1 kali kali        0  7月22日 09:57 fr1end
                         
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cd fr1end         
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/fr1end]
└─$ grep -r 'HMV{' .                                                                                           
./fr1end-main/server/keys/flag.txt:HMV{jWt_m4keS_th3_w0rLd_g0_r0und}
          
```

秒