> 辅助AI：deepseek-v4-flash、hy3

# **Mission 0x41: sky -> sarah**

- **任务**: 用户 `sarah` 在 `http://localhost/key.php` 用上了 header。

1. 先直接访问看看返回什么，得到一句提示，说明服务端在检查某个请求头。

   ```bash
   sky@venus:~$ curl http://localhost/key.php
   Key header is true?
   ```

2. 根据提示，需要给请求加一个 `key` 头，值为 `true`。注意这里头名必须是小写，写成 `Key` 是不行的。

   ```bash
   sky@venus:~$ curl -H "key: true" http://localhost/key.php
   LWOHeRgmIxg7fuS
   ```

3. **sarah 的密码**: `LWOHeRgmIxg7fuS`

---

# **Mission 0x42: sarah -> mercy**

- **任务**: `mercy` 的密码藏在当前目录里。

1. `ls -la` 发现一个文件名是三个点的隐藏文件，比 `.` 和 `..` 多一个点，很可疑。

   ```bash
   sarah@venus:~$ ls -la
   total 36
   drwxr-x--- 2 root  sarah 4096 May  4 07:40 .
   drwxr-xr-x 1 root  root  4096 May  4 07:39 ..
   -rw-r----- 1 root  sarah   16 May  4 07:40 ...
   ...
   ```

2. 读取该文件。

   ```bash
   sarah@venus:~$ cat ./...
   ym5yyXZ163uIS8L
   ```

3. **mercy 的密码**: `ym5yyXZ163uIS8L`

---

# **Mission 0x43: mercy -> paula**

- **任务**: `mercy` 总是输错 `paula` 的密码。

1. 查看 `.bash_history`，发现她曾经执行过 `su paula`，紧接着历史里多了一条不明所以的字符串，八成是把密码当成命令敲进去了。

   ```bash
   mercy@venus:~$ cat .bash_history
   vi /etc/logs
   su paula
   dlHZ6cvX6cLuL8p
   history
   history -c
   logout
   ...
   ```

2. 拿这条字符串去试 `su paula`，成功。

3. **paula 的密码**: `dlHZ6cvX6cLuL8p`

---

# **Mission 0x44: paula -> karla**

- **任务**: `karla` 信任 `paula`，她是 `paula` “朋友圈”的一员。

1. “朋友圈”暗示用户组。查看 `paula` 所在的组，发现多了一个 `hidden` 组。

   ```bash
   paula@venus:~$ id
   uid=1044(paula) gid=1044(paula) groups=1044(paula),1053(hidden)
   ```

2. 全盘查找属于 `hidden` 组的文件。

   ```bash
   paula@venus:~$ find / -group hidden 2>/dev/null
   /usr/src/.karl-a
   ```

3. 该文件组可读，直接读取。

   ```bash
   paula@venus:~$ cat /usr/src/.karl-a
   gYAmvWY3I7yDKRf
   ```

4. **karla 的密码**: `gYAmvWY3I7yDKRf`

---

# **Mission 0x45: karla -> denise**

- **任务**: `denise` 把密码保存在图片里。

1. 家目录里有张 `yuju.jpg`，先用 `exiftool` 看看元数据。

   ```bash
   karla@venus:~$ exiftool yuju.jpg
   ...
   About                           : pFg92DpGucMWccA
   ...
   ```

2. XMP 的 `About` 字段里躺着一个疑似密码的字符串，拿去测试成功。

3. **denise 的密码**: `pFg92DpGucMWccA`

---

# **Mission 0x46: denise -> zora**

- **任务**: `zora` 一直在喊 "doas"。

1. `doas` 是一个类似 `sudo` 的提权工具。直接看它的配置文件。

   ```bash
   denise@venus:~$ cat /etc/doas.conf
   permit denise as zora
   ```

2. 配置允许 `denise` 以 `zora` 的身份执行命令。注意它要的是 `denise` 自己的密码（配置没有 `nopass`），而且得有交互终端才能输密码。

3. 以 `zora` 身份翻一下她家目录，发现 `zora_pass.txt`，读取即可。

   ```bash
   denise@venus:~$ doas -u zora ls /pwned/zora
   denise@venus:~$ doas -u zora cat /pwned/zora/zora_pass.txt
   BWm1R3jCcb53riO
   ```

4. **zora 的密码**: `BWm1R3jCcb53riO`

---

# **Mission 0x47: zora -> belen**

- **任务**: `belen` 把密码丢在了 `venus.hmv`。

1. 这名字像个域名/虚拟主机。在 `/etc` 下搜一下它的踪迹。

   ```bash
   zora@venus:~$ grep -r "venus.hmv" /etc/ 2>/dev/null
   /etc/nginx/sites-available/default:server_name venus.hmv;
   ...
   172.25.20.20    venus.hmv
   ```

2. 果然是 nginx 的虚拟主机。本机访问 80 端口时带上对应的 `Host` 头。

   ```bash
   zora@venus:~$ curl -H "Host: venus.hmv" http://127.0.0.1/
   2jA0E8bQ4WrGwWZ
   ```

3. **belen 的密码**: `2jA0E8bQ4WrGwWZ`

---

# **Mission 0x48: belen -> leona**

- **任务**: 貌似 `belen` 偷了 `leona` 的密码……

1. 家目录有个 `stolen.txt`，内容是一串 md5crypt 哈希（`$1$` 开头）。

   ```bash
   belen@venus:~$ cat stolen.txt
   $1$leona$lhWp56YnWAMz6z32Bw53L0
   ```

2. 拉到本地用 `john` + rockyou 爆破，秒出。

   ```bash
   # 在本地Kali系统上执行
   $ john --wordlist=/usr/share/wordlists/rockyou.txt leona.hash
   $ john --show leona.hash
   leona:freedom
   ```

3. **leona 的密码**: `freedom`

---

# **Mission 0x49: leona -> ava**

- **任务**: `ava` 最近一直在折腾 `venus.hmv` 的 DNS。

1. 上关已经看到系统里跑着 bind，直接找它的区域文件。

   ```bash
   leona@venus:~$ ls /etc/bind/
   leona@venus:~$ cat /etc/bind/db.venus.hmv
   ...
   ns1     IN      A       127.0.0.1
   ava IN      TXT     oCXBeeEeYFX34NU
   ```

2. 区域文件里有一条 `ava` 的 TXT 记录，内容就是密码。（本机 DNS 实际没起监听，`dig` 会超时，读文件最快）

3. **ava 的密码**: `oCXBeeEeYFX34NU`

---

# **Mission 0x50: ava -> maria**

- **任务**: `maria` 的密码“在某个地方”……

1. 这关提示非常模糊，翻遍全盘也没发现新的藏点。不知道是语义问题还是啥，我感觉它更想表达的是“你在某个地方见过”。后面查看[hgbe02](https://raw.githubusercontent.com/hgbe02/Hackmyvm-HMVLabs-Venus/refs/heads/main/Venus(41-50).md)大佬的WP解决问题。

   ```bash
   ava@venus:~$ su maria
   Password: .--. .- .--. .- .--. .- .-. .- -.. .. ... .
   maria@venus:~$
   ```

2. 登进去发现 `mission.txt` 只有一句 `Congrats!`，这就是最后一关了。

3. **maria 的密码**: `.--. .- .--. .- .--. .- .-. .- -.. .. ... .`

---

# **Flag**

```
41. sarah:         8===nLCR949OMr4pLhMepKCM===D~~
42. mercy:         8===pBpnZCBSELaY0xQJ8YAY===D~~
43. paula:         8===2pwlvMk65rw81lymKLJE===D~~
44. karla:         8===SARQC95X3AWK9K4BBTMJ===D~~
45. denise:        8===uMXbjLdQde2iQFoWc8zf===D~~
46. zora:          8===hhp0gFTIaedSX3faXDqP===D~~
47. belen:         8===FzDIkqJtVgyQYfRVGH1r===D~~
48. leona:         8===jObs3nfIJG4dDtxhWuKg===D~~
49. ava:           8===7XsGiUHUZNouh6K6CyY2===D~~
50. maria:         8===ZLNu1CHYSYf0PvkK2iqS===D~~
```

# **Pass**

```
41: sarah/LWOHeRgmIxg7fuS
42: mercy/ym5yyXZ163uIS8L
43: paula/dlHZ6cvX6cLuL8p
44: karla/gYAmvWY3I7yDKRf
45: denise/pFg92DpGucMWccA
46: zora/BWm1R3jCcb53riO
47: belen/2jA0E8bQ4WrGwWZ
48: leona/freedom
49: ava/oCXBeeEeYFX34NU
50: maria/.--. .- .--. .- .--. .- .-. .- -.. .. ... .
```