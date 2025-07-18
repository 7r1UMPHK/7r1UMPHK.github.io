![image-20250718221751985](https://7r1umphk.github.io/image/20250718221752208.webp)

https://hackmyvm.eu/challenges/challenge.php?c=063

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -la        
总计 4655
drwxr-xr-x 1 kali kali    4096  7月18日 10:10 .
drwxr-xr-x 1 kali kali    8192  7月17日 23:37 ..
-rwxr-xr-x 1 kali kali 2377257 2023年 1月10日 062.png
-rwxr-xr-x 1 kali kali 2375882  7月18日 10:10 062.zip
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -al 063.zip 
-rwxr-xr-x 1 kali kali 431  7月18日 10:18 063.zip
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ 7z x 063.zip 

7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-29
 64-bit locale=zh_CN.UTF-8 Threads:128 OPEN_MAX:1024, ASM

Scanning the drive for archives:
1 file, 431 bytes (1 KiB)

Extracting archive: 063.zip
--
Path = 063.zip
Type = zip
Physical Size = 431

Everything is Ok

Size:       671
Compressed: 431
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -al        
总计 14
drwxr-xr-x 1 kali kali 4096  7月18日 10:18 .
drwxr-xr-x 1 kali kali 8192  7月17日 23:37 ..
-rwxr-xr-x 1 kali kali  671 2024年 1月24日 063.txt
-rwxr-xr-x 1 kali kali  431  7月18日 10:18 063.zip
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat 063.txt
In the script's silent dance, spaces weave,                              
A hidden language, easy to deceive.                                          
Between the lines, where eyes might stray,                            
The secret dwells in whitespace's play.                                
                                                                           
Embrace the gaps, where silence gleams,                                    
Decode the whispers in code's dreams.                                    
In every blank, a story told,                                              
For beginners bold, a mystery unfolds.                                      
                                                                            
                                                                           
                                                                            
           
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat -A 063.txt 
In the script's silent dance, spaces weave,^I   ^I  ^I       ^I $
A hidden language, easy to deceive.       ^I     ^I   ^I  ^I     $
Between the lines, where eyes might stray, ^I      ^I ^I      $
The secret dwells in whitespace's play.^I       ^I     ^I     ^I       $
^I    ^I   ^I^I      ^I  ^I  ^I       ^I ^I   $
Embrace the gaps, where silence gleams, ^I   ^I ^I      ^I   $
Decode the whispers in code's dreams. ^I  ^I      ^I  ^I       ^I $
In every blank, a story told, ^I  ^I     ^I   ^I ^I       ^I   $
For beginners bold, a mystery unfolds.   ^I     ^I  ^I  ^I    $
       ^I       ^I    ^I    ^I     ^I     ^I  ^I   ^I     ^I    $
  ^I      ^I^I      ^I ^I^I   ^I ^I   ^I   $
^I       ^I  ^I  ^I    ^I    ^I     ^I    ^I     ^I    $
  ^I   $
                            
```

对空白比较敏感

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ stegsnow 063.txt 
��r��=�^i��5�WO�H�M�R�pi��M+                                                                                                                                                                               
```

看样子有加密，去扒拉一个爆破
https://github.com/cyberpoul/StegsnowBruteForcer

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$git clone https://github.com/cyberpoul/StegsnowBruteForcer.git
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cd StegsnowBruteForcer
                                                                                       
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/StegsnowBruteForcer]
└─$ source ~/pythonvenv/bin/activate
                             
┌──(pythonvenv)─(kali㉿kali)-[/mnt/…/gx/x/tmp/StegsnowBruteForcer]
└─$ pip install -r requirements.txt

┌──(pythonvenv)─(kali㉿kali)-[/mnt/…/gx/x/tmp/StegsnowBruteForcer]
└─$ python stegsnowbruteforcer.py --file ../063.txt --wordlist /usr/share/wordlists/rockyou.txt --keyword HMV{ --output results.txt 

***********************************************************
*                                                         *
*         Stegsnow Password Brute-Force Attack            *
*                    made by Assa                         *
*     https://github.com/Assa228/StegsnowBruteForcer      *
*                                                         *
***********************************************************

  0%|                                | 480/14344392 [00:12<23:06:27, 172.43it/s]
Keyword 'HMV{' found with the password: letmein
Here is the decoded message:
HMV{wh1t3_sp4c3_st3g_15_fu/\/}
  0%|                               | 6394/14344392 [00:19<12:25:36, 320.50it/s]^C

```

