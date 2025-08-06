# **简介**

Venus 是 HackMyVM.eu 推出的一个适合初学者的 CTF（夺旗赛）靶机。本攻略将记录从初始用户 `hacker` 开始，通过解决一系列谜题，逐步提权，最终获取到Vhidden奖杯的全过程。

---

# 开打

## **Mission 0x01: hacker -> sophia**

- **任务**: 用户 `sophia` 的密码保存在当前目录的一个隐藏文件中。

1.  首先，使用 `ls -al` 命令查找所有文件，包括隐藏文件。

    ```bash
    hacker@venus:~$ ls -al
    total 40
    drwxr-x--- 1 root   hacker 4096 Apr  5  2024 .
    drwxr-xr-x 1 root   root   4096 Apr  5  2024 ..
    -rw-r----- 1 root   hacker   31 Apr  5  2024 ...
    -rw-r--r-- 1 hacker hacker  220 Apr 23  2023 .bash_logout
    -rwxr-xr-x 1 hacker hacker 3653 Jul 24 00:48 .bashrc
    -rw-r----- 1 root   hacker   16 Apr  5  2024 .myhiddenpazz
    -rw-r--r-- 1 hacker hacker    0 Jun 20 00:35 .profile
    -rw-r----- 1 root   hacker  287 Apr  5  2024 mission.txt
    -rw-r----- 1 root   hacker 2542 Apr  5  2024 readme.txt
    ```

2.  发现可疑隐藏文件 `.myhiddenpazz`，读取内容得到密码。

    ```bash
    hacker@venus:~$ cat .myhiddenpazz
    Y1o645M3mR84ejc
    ```

3.  切换到 `sophia` 用户。

    ```bash
    hacker@venus:~$ su sophia
    Password: Y1o645M3mR84ejc
    ```

---

## **Mission 0x02: sophia -> angela**
- **任务**: 用户 `angela` 的密码在一个名为 `whereismypazz.txt` 的文件中，但她忘记了文件位置。

1.  使用 `find` 命令在整个文件系统中搜索该文件。

    ```bash
    sophia@venus:~$ find / -name "whereismypazz.txt" 2>/dev/null
    /usr/share/whereismypazz.txt
    ```

2.  读取文件内容得到密码。

    ```bash
    sophia@venus:~$ cat /usr/share/whereismypazz.txt
    oh5p9gAABugHBje
    ```

3.  切换到 `angela` 用户。

    ```bash
    sophia@venus:~$ su angela
    Password: oh5p9gAABugHBje
    ```

---

## **Mission 0x03: angela -> emma**
- **任务**: 用户 `emma` 的密码在 `findme.txt` 文件的第 4069 行。

1.  使用 `sed` 命令直接打印指定行。

    ```bash
    angela@venus:~$ sed -n '4069p' findme.txt
    fIvltaGaq0OUH8O
    ```

2.  切换到 `emma` 用户。

    ```bash
    angela@venus:~$ su emma
    Password: fIvltaGaq0OUH8O
    ```

---

## **Mission 0x04: emma -> mia**
- **任务**: 用户 `mia` 的密码在名为 `-` 的文件中。

1.  由于文件名是特殊字符，使用 `./-` 来指定当前目录下的该文件。

    ```bash
    emma@venus:~$ cat ./-
    iKXIYg0pyEH2Hos
    ```

2.  切换到 `mia` 用户。

    ```bash
    emma@venus:~$ su mia
    Password: iKXIYg0pyEH2Hos
    ```

---

## **Mission 0x05: mia -> camila**
- **任务**: 用户 `camila` 的密码在名为 `hereiam` 的文件夹内。

1.  首先找到 `hereiam` 文件夹的位置。

    ```bash
    mia@venus:~$ find / -name "hereiam" 2>/dev/null
    /opt/hereiam
    ```

2.  进入该目录并查找里面的隐藏文件。

    ```bash
    mia@venus:/opt/hereiam$ ls -la
    total 12
    drwxr-xr-x 2 root root 4096 Apr  5  2024 .
    drwxr-xr-x 1 root root 4096 Apr  5  2024 ..
    -rw-r--r-- 1 root root   16 Apr  5  2024 .here
    
    mia@venus:/opt/hereiam$ cat .here
    F67aDmCAAgOOaOc
    ```

3.  切换到 `camila` 用户。

    ```bash
    mia@venus:/opt/hereiam$ su camila
    Password: F67aDmCAAgOOaOc
    ```

---

## **Mission 0x06: camila -> luna**
- **任务**: 用户 `luna` 的密码在 `muack` 文件夹内的某个文件中。

1.  `muack` 文件夹内文件众多，使用 `find` 和 `file` 命令组合，找到类型为 `ASCII text` 的常规文件。

    ```bash
    camila@venus:~/muack$ find . -type f -exec file {} \; | grep "text"
    ./111/111/muack: ASCII text
    ```

2.  读取找到的文件。

    ```bash
    camila@venus:~/muack$ cat ./111/111/muack
    j3vkuoKQwvbhkMc
    ```

3.  切换到 `luna` 用户。

    ```bash
    camila@venus:~/muack$ su luna
    Password: j3vkuoKQwvbhkMc
    ```

---

## **Mission 0x07: luna -> eleanor**
- **任务**: 用户 `eleanor` 的密码在一个占用 6969 字节的文件中。

1.  使用 `find` 命令的 `-size` 参数查找特定大小的文件。

    ```bash
    luna@venus:~$ find / -type f -size 6969c 2>/dev/null
    /usr/share/moon.txt
    ```

2.  读取文件内容。

    ```bash
    luna@venus:~$ cat /usr/share/moon.txt
    UNDchvln6Bmtu7b
    ```

3.  切换到 `eleanor` 用户。

    ```bash
    luna@venus:~$ su eleanor
    Password: UNDchvln6Bmtu7b
    ```

---

## **Mission 0x08: eleanor -> victoria**
- **任务**: 用户 `victoria` 的密码所在文件的所有者是 `violin`。

1.  使用 `find` 命令的 `-user` 参数查找属于特定用户的文件。

    ```bash
    eleanor@venus:~$ find / -user violin 2>/dev/null
    /usr/local/games/yo
    ```

2.  读取文件内容。

    ```bash
    eleanor@venus:~$ cat /usr/local/games/yo
    pz8OqvJBFxH0cSj
    ```

3.  切换到 `victoria` 用户。

    ```bash
    eleanor@venus:~$ su victoria
    Password: pz8OqvJBFxH0cSj
    ```

---

## **Mission 0x09: victoria -> isla**
- **任务**: 用户 `isla` 的密码在一个 zip 文件中。

1.  目标系统无法写入文件，先将 `passw0rd.zip` 文件内容用 `base64` 编码后复制出来。

    ```bash
    victoria@venus:~$ base64 passw0rd.zip
    UEsDBAoAAAAAAIMzhViqg0LgEAAAABAAAAAbABwAcHduZWQvdmljdG9yaWEvcGFzc3cwcmQudHh0
    VVQJAAP2mQ9m9pkPZnV4CwABBAAAAAAEAAAAAEQzWFRvYjBGVUltc29CYgpQSwECHgMKAAAAAACD
    M4VYqoNC4BAAAAAQAAAAGwAYAAAAAAABAAAApIEAAAAAcHduZWQvdmljdG9yaWEvcGFzc3cwcmQu
    dHh0VVQFAAP2mQ9mdXgLAAEEAAAAAAQAAAAAUEsFBgAAAAABAAEAYQAAAGUAAAAAAA==
    ```

2.  在本地机器上解码并解压。

    ```bash
    # 在本地Kali系统上执行
    echo '...' | base64 -d > passw0rd.zip
    unzip passw0rd.zip
    cat pwned/victoria/passw0rd.txt
    D3XTob0FUImsoBb
    ```

3.  切换到 `isla` 用户。

    ```bash
    victoria@venus:~$ su isla
    Password: D3XTob0FUImsoBb
    ```

---

## **Mission 0x10: isla -> violet**
- **任务**: 用户 `violet` 的密码在 `passy` 文件中以 `a9HFX` 开头的行，但这 5 个字符不是密码的一部分。

1.  使用 `grep` 查找包含 `a9HFX` 的行，并手动去除前缀。

    ```bash
    isla@venus:~$ grep 'a9HFX' passy
    # ... (多行输出)
    a9HFXWKINVzNQLKLDVAc 
    ```
    密码是 `WKINVzNQLKLDVAc`。

2.  切换到 `violet` 用户。

    ```bash
    isla@venus:~$ su violet
    Password: WKINVzNQLKLDVAc
    ```

---

## **Mission 0x11: violet -> lucy**
- **任务**: 用户 `lucy` 的密码在 `end` 文件中以 `0JuAZ` 结尾的行，但这 5 个字符不是密码的一部分。

1. 使用 `grep` 查找该行，并手动去除后缀。

   ```bash
   violet@venus:~$ grep "0JuAZ" end
   OCmMUjebG53giud0JuAZ
   ```

   密码是 `OCmMUjebG53giud`。

1. 切换到 `lucy` 用户。

   ```bash
   violet@venus:~$ su lucy
   Password: OCmMUjebG53giud
   ```

---

## **Mission 0x12: lucy -> elena**
- **任务**: 用户 `elena` 的密码在 `file.yo` 文件中位于 `fu` 和 `ck` 之间。

1.  使用 `grep -o` 来仅提取匹配的部分。

    ```bash
    lucy@venus:~$ grep -o "fu.*ck" file.yo
    fu4xZ5lIKYmfPLg9tck
    ```
    密码是 `4xZ5lIKYmfPLg9t`。

2.  切换到 `elena` 用户。

    ```bash
    lucy@venus:~$ su elena
    Password: 4xZ5lIKYmfPLg9t
    ```

---

## **Mission 0x13: elena -> alice**
- **任务**: 用户 `alice` 的密码在一个环境变量中。

1.  使用 `env` 命令查看所有环境变量。

    ```bash
    elena@venus:~$ env
    # ... (省略部分输出)
    PASS=Cgecy2MY2MWbaqt
    # ...
    ```

2.  切换到 `alice` 用户。

    ```bash
    elena@venus:~$ su alice
    Password: Cgecy2MY2MWbaqt
    ```

---

## **Mission 0x14: alice -> anna**
- **任务**: `anna` 的密码作为注释留在了 `/etc/passwd` 文件中。

1.  查看 `/etc/passwd` 文件，注意 `alice` 用户行的注释字段。

    ```bash
    alice@venus:~$ cat /etc/passwd
    # ...
    alice:x:1014:1014:w8NvY27qkpdePox:/pwned/alice:/bin/bash
    anna:x:1015:1015::/pwned/anna:/bin/bash
    # ...
    ```
    在 `alice` 用户行的第五个字段（注释字段）找到了 `anna` 的密码 `w8NvY27qkpdePox`。

2.  切换到 `anna` 用户。

    ```bash
    alice@venus:~$ su anna
    Password: w8NvY27qkpdePox
    ```

---

## **Mission 0x15: anna -> natalia**
- **任务**: 使用 `sudo` 成为 `natalia` 用户。

1.  首先检查 `sudo` 权限。

    ```bash
    anna@venus:~$ sudo -l
    User anna may run the following commands on venus:
        (natalia) NOPASSWD: /bin/bash
    ```

2.  发现可以免密以 `natalia` 的身份执行 `/bin/bash`，直接提权。

    ```bash
    anna@venus:~$ sudo -u natalia /bin/bash
    natalia@venus:/pwned/anna$
    ```

---

## **Mission 0x16: natalia -> eva**
- **任务**: `eva` 的密码被编码在 `base64.txt` 文件中。

1.  读取文件内容并通过 `base64 -d` 解码。

    ```bash
    natalia@venus:~$ cat base64.txt | base64 -d
    upsCA3UFu10fDAO
    ```

2.  切换到 `eva` 用户。

    ```bash
    natalia@venus:~$ su eva
    Password: upsCA3UFu10fDAO
    ```

---

## **Mission 0x17: eva -> clara**
- **任务**: `clara` 的密码在一个 1968 年 5 月 1 日之后修改过的文件中。（这里自己想想办法，我不想复现了）

1.  根据提示，可以推断文件的修改时间比较特殊。经过查找，发现一个时间戳非常早的文件。

    ```bash
    eva@venus:~$ ls -al /usr/lib/cmdo
    -rw-r--r-- 1 root root 16 Jan  1  1970 /usr/lib/cmdo
    ```

2.  读取该文件内容。

    ```bash
    eva@venus:~$ cat /usr/lib/cmdo
    39YziWp5gSvgQN9
    ```

3.  切换到 `clara` 用户。

    ```bash
    eva@venus:~$ su clara
    Password: 39YziWp5gSvgQN9
    ```

---

## **Mission 0x18: clara -> frida**
- **任务**: `frida` 的密码在一个受密码保护的 zip 文件中，提示 `rockyou.txt` 字典可能会有帮助。

1.  首先将 `protected.zip` 文件 `base64` 编码并复制到本地。

    ```bash
    clara@venus:~$ base64 protected.zip
    UEsDBAoACQAAAIMzhVhzdJ8jHAAAABAAAAAZABwAcHduZWQvY2xhcmEvcHJvdGVjdGVkLnR4dFVU
    CQAD9pkPZvaZD2Z1eAsAAQQAAAAABAAAAACc/uQ52ED8vSTlcON+hM2vBK6cXas6YlcIf/9rUEsH
    CHN0nyMcAAAAEAAAAFBLAQIeAwoACQAAAIMzhVhzdJ8jHAAAABAAAAAZABgAAAAAAAEAAACkgQAA
AABwd25lZC9jbGFyYS9wcm90ZWN0ZWQudHh0VVQFAAP2mQ9mdXgLAAEEAAAAAAQAAAAAUEsFBgAA
AAABAAEAXwAAAH8AAAAAAA==
    ```

2.  在本地，使用 `john` 和 `rockyou.txt` 字典爆破 zip 密码。

    ```bash
    # 在本地Kali等系统上执行
    echo '...' | base64 -d > protected.zip
    zip2john protected.zip > hash
    john --wordlist=/usr/share/wordlists/rockyou.txt hash
    # ...
    # 爆破出密码为 pass123
    ```

3.  使用爆破出的密码解压文件，并读取 `frida` 的密码。

    ```bash
    # 在本地Kali等系统上执行
    7z x protected.zip # 输入密码 pass123
    cat pwned/clara/protected.txt
    Ed4ErEUJEaMcXli
    ```

4.  切换到 `frida` 用户。

    ```bash
    clara@venus:~$ su frida
    Password: Ed4ErEUJEaMcXli
    ```

---

## **Mission 0x19: frida -> eliza**
- **任务**: `eliza` 的密码是 `repeated.txt` 文件中唯一重复的字符串。

1.  对文件排序后，使用 `uniq -d` 可以找到重复的行。

    ```bash
    frida@venus:~$ awk 'NR==1{prev=$0; next} $0==prev{print prev} {prev=$0}' repeated.txt
    Fg6b6aoksceQqB9
    ```

2.  切换到 `eliza` 用户。

    ```bash
    frida@venus:~$ su eliza
    Password: Fg6b6aoksceQqB9
    ```

---

## **Mission 0x20: eliza -> iris**
- **任务**: `iris` 给我留下了她的密钥。

1.  在 `eliza` 的家目录中，找到了 `.iris_key`，这是 SSH 私钥。

    ```bash
    eliza@venus:~$ ls -al
    # ...
    -rw-r----- 1 root  eliza 2602 Apr  5  2024 .iris_key
    ```

2.  使用这个私钥通过 SSH 登录到 `iris` 账户。

    ```bash
    eliza@venus:~$ ssh iris@127.0.0.1 -i .iris_key
    Welcome to Debian GNU/Linux 11 (bullseye)!
    # ...
    iris@venus:~$
    ```

---

## **Mission 0x21: iris -> eloise**
- **任务**: `eloise` 用一种特殊的方式保存了她的密码。

1.  在 `iris` 家目录中发现一个名为 `eloise` 的文件，内容看起来是 Base64 编码的。

    ```bash
    iris@venus:~$ cat eloise
    /9j/4AAQSkZJRgABAQEAYABgAAD/4RDSRXhpZgAATU0AKgAAAAgABAE7AAIAAAAEc01MAIdpAAQA
    # ... (省略)
    ```

2.  将内容复制到本地，解码后发现是一个 JPEG 图片文件。

    ```bash
    # 在本地Kali等系统上执行
    cat eloise_base64.txt | base64 -d > eloise.jpg
    file eloise.jpg
    # eloise.jpg: JPEG image data ...
    ```

3.  打开图片，图片中显示了密码：`yOUJlV0SHOnbSPm`。

4.  切换到 `eloise` 用户。

    ```bash
    iris@venus:~$ su eloise
    Password: yOUJlV0SHOnbSPm
    eloise@venus:~$
    ```

---

# **Flag 汇总**

```bash
1.  sophia:   8===LUzzNuv8NB59iztWUIQS===D~~
2.  angela:   8===SjMYBmMh4bk49TKq7PM8===D~~
3.  emma:     8===0daqdDlmd9XogkiHu4yq===D~~
4.  mia:      8===FBMdY8hel2VMA3BaYJin===D~~
5.  camila:   8===iDIi5sm1mDuqGmU5Psx6===D~~
6.  luna:     8===KCO34FpIq3nBmHbyZvFh===D~~
7.  eleanor:  8===Iq5vbyiQl4ipNrLDArjD===D~~
8.  victoria: 8===NWyTFi9LLqVsZ4OnuZYN===D~~
9.  isla:     8===ZyZqc1suvGe4QlkZHFlq===D~~
10. violet:   8===LzErk0qFPYJj16mNnnYZ===D~~
11. lucy:     8===AdCJ4wl8pmbhi770Xbd3===D~~
12. elena:    8===st1pTdqEQ0bvrJfWGwLA===D~~
13. alice:    8===Qj4NNWp8LOC96S9Rtgrk===D~~
14. anna:     8===5Y3DhT66fa6Da8RpLKG0===D~~
15. natalia:  8===JWHa1GQq1AYrBWNXEJrH===D~~
16. eva:      8===22cqk3iGkGYVqnYrHiof===D~~
17. clara:    8===EJWmHDEQeEN1vIR7NYiH===D~~
18. frida:    8===Ikg2qj8KT2bGJtWvR6hC===D~~
19. eliza:    8===zwWIPyDf2ozwVhCTxm1I===D~~
20. iris:     8===ClrdWOqlZ1vL61zSk9Va===D~~
21. eloise:   8===57CzBLKaEq2N8YBFRu31===D~~
```

# Pass

```bash
01: sophia/Y1o645M3mR84ejc
02: angela/oh5p9gAABugHBje
03: emma/fIvltaGaq0OUH8O
04: mia/iKXIYg0pyEH2Hos
05: camila/F67aDmCAAgOOaOc
06: luna/j3vkuoKQwvbhkMc
07: eleanor/UNDchvln6Bmtu7b
08: victoria/pz8OqvJBFxH0cSj
09: isla/D3XTob0FUImsoBb
10: violet/WKINVzNQLKLDVAc
11: lucy/OCmMUjebG53giud
12: elena/4xZ5lIKYmfPLg9t
13: alice/Cgecy2MY2MWbaqt
14: anna/w8NvY27qkpdePox
15: natalia/NMuc4DkYKDsmZ5z
16: eva/upsCA3UFu10fDAO
17: clara/39YziWp5gSvgQN9
18: frida/Ed4ErEUJEaMcXli
19: eliza/Fg6b6aoksceQqB9
20: iris/kYjyoLcnBZ9EJdz
21: eloise/yOUJlV0SHOnbSPm
```

