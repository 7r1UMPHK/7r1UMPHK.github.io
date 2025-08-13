![image-20250718211403641](https://7r1umphk.github.io/image/20250718211403851.webp)

https://hackmyvm.eu/challenges/challenge.php?c=059

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ 7z x 059.zip 

7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-29
 64-bit locale=zh_CN.UTF-8 Threads:128 OPEN_MAX:1024, ASM

Scanning the drive for archives:
1 file, 1340043 bytes (1309 KiB)

Extracting archive: 059.zip
--
Path = 059.zip
Type = zip
Physical Size = 1340043
Comment = 67f1eeaca308318257ec4f222b4315741738d456

Everything is Ok

Folders: 22
Files: 120
Size:       3143617
Compressed: 1340043
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ls -al
总计 1395
drwxr-xr-x 1 kali kali    4096  7月18日 09:14 .
drwxr-xr-x 1 kali kali    8192  7月17日 23:37 ..
-rwxr-xr-x 1 kali kali   35450  7月18日 09:05 058.zip
-rwxr-xr-x 1 kali kali 1340043  7月18日 09:14 059.zip
-rwxr-xr-x 1 kali kali   35280 2023年12月28日 challenge.png
drwxr-xr-x 1 kali kali    4096 2024年 1月 4日 h1ker-main
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cd h1ker-main 
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/h1ker-main]
└─$ ls -al
总计 75
drwxr-xr-x 1 kali kali  4096 2024年 1月 4日 .
drwxr-xr-x 1 kali kali  4096  7月18日 09:14 ..
drwxr-xr-x 1 kali kali  4096 2024年 1月 4日 admin
-rwxr-xr-x 1 kali kali  8554 2024年 1月 4日 aerocms.sql
-rwxr-xr-x 1 kali kali  2411 2024年 1月 4日 author_posts.php
-rwxr-xr-x 1 kali kali   100 2024年 1月 4日 build_docker.sh
-rwxr-xr-x 1 kali kali  3203 2024年 1月 4日 category.php
drwxr-xr-x 1 kali kali     0 2024年 1月 4日 config
drwxr-xr-x 1 kali kali     0 2024年 1月 4日 css
-rwxr-xr-x 1 kali kali   324 2024年 1月 4日 Dockerfile
drwxr-xr-x 1 kali kali  4096 2024年 1月 4日 fonts
drwxr-xr-x 1 kali kali     0 2024年 1月 4日 images
drwxr-xr-x 1 kali kali  4096 2024年 1月 4日 includes
-rwxr-xr-x 1 kali kali  4421 2024年 1月 4日 index.php
drwxr-xr-x 1 kali kali     0 2024年 1月 4日 js
-rwxr-xr-x 1 kali kali 18092 2024年 1月 4日 LICENSE
-rwxr-xr-x 1 kali kali  7812 2024年 1月 4日 post.php
-rwxr-xr-x 1 kali kali  1306 2024年 1月 4日 README.md
-rwxr-xr-x 1 kali kali  3176 2024年 1月 4日 registration.php
-rwxr-xr-x 1 kali kali   369 2024年 1月 4日 run.sh
-rwxr-xr-x 1 kali kali  3039 2024年 1月 4日 search.php
                                                    
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/h1ker-main]
└─$ cat README.md                                        

# H1ker
<p align=center>
<a target="_blank" href="LICENSE" title="License: MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
<a target="_blank" href="AeroCMS" title="AeroCMS"><img src="https://img.shields.io/badge/cms-latest-purple"></a>
</p>

# AeroCMS
Aero / AeroCMS is a simple and easy to use CMS (Content Management System) designed to create fast and powerful web applications. Aero is built with OOP (Object Oriented Programming) PHP which is known for fast website loading speeds, [AeroCMS](https://github.com/MegaTKC/AeroCMS).


This is a web vulnerability challenge, try to find the flag.
This challenge requires docker.

### Manual Docker image build and run
1. Install [Docker](https://www.docker.com)
2. Build the image `docker build -t h1ker .`
3. Start the container with a port of your choice by replacing 1337 `docker run --name=h1ker -d -p 1337:80 h1ker`
4. The challenge can be found in http://localhost:1337/

### Automated run
Run the following bash script to build and run the challenge `./build_docker.sh`. The challenge can be found in http://localhost:1337/

## Delete challenge
Don't forget to delete both the container and the image of the challenge after you finish:
1. Delete container `docker rm h1ker -f`
2. Delete image `docker rmi h1ker`


Have fun !
       
```

> # H1ker
> <p align=center>
> <a target="_blank" href="LICENSE" title="许可证：MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
> <a target="_blank" href="AeroCMS" title="AeroCMS"><img src="https://img.shields.io/badge/cms-latest-purple"></a>
> </p>
>
> # AeroCMS
> Aero / AeroCMS 是一款简单易用的 CMS（内容管理系统），旨在创建快速强大的 Web 应用程序。Aero 采用面向对象编程 (OOP) PHP 构建，该语言以快速的网站加载速度而闻名，[AeroCMS](https://github.com/MegaTKC/AeroCMS)。
>
> 这是一个 Web 漏洞挑战，请尝试找到 flag。
> 此挑战需要 Docker 的支持。
>
> ### 手动构建并运行 Docker 镜像
> 1. 安装 [Docker](https://www.docker.com)
> 2. 构建镜像 `docker build -t h1ker`
> 3. 使用您选择的端口启动容器，方法是将 1337 替换为 `docker run --name=h1ker -d -p 1337:80 h1ker`
> 4. 您可以在 http://localhost:1337/ 找到挑战
>
> ### 自动运行
> 运行以下 bash 脚本来构建并运行挑战 `./build_docker.sh`。您可以在 http://localhost:1337/ 找到挑战
>
> ## 删除挑战
> 完成后，请记得删除容器和挑战镜像：
> 1. 删除容器 `docker rm h1ker -f`
> 2. 删除镜像 `docker rmi h1ker`
>
> 祝您玩得开心！

不爱开docker

```
┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/h1ker-main]
└─$ grep -r 'HMV{' . 
./admin/categories.php:                            <small>HMV{h1kinG_1s_s0_fUn}</small>
                          
```

哈哈