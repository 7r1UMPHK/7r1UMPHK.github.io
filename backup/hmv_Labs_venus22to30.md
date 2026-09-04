# 继续
## **Mission 0x22: eloise -> lucia**

-   **任务**: 用户 `lucia` 用一种有创意的方式保存了她的密码。

1.  在家目录中发现一个 `hi` 文件，其内容为十六进制格式。

    ```bash
    eloise@venus:~$ cat hi
    00000000: 7576 4d77 4644 5172 5157 504d 6547 500a
    ```

2.  这是一个十六进制转储 (hexdump)，需要将其转换回原始文本。使用 `xxd` 工具进行逆向转换。

    ```bash
    eloise@venus:~$ cat hi | xxd -r -p
    uvMwFDQrQWPMeGP
    ```

3.  使用得到的密码切换到 `lucia` 用户。

    ```bash
    eloise@venus:~$ su lucia
    Password: uvMwFDQrQWPMeGP
    ```

---

## **Mission 0x23: lucia -> isabel**

-   **任务**: 用户 `isabel` 的密码在 `/etc/xdg` 目录下的一个文件中，文件名不详，但 `dict.txt` 文件可以提供线索。

1.  检查家目录下的 `dict.txt`，它包含一个文件名列表。同时，在该文件中发现了一个隐藏的 Flag。

2.  编写一个循环脚本，读取 `dict.txt` 中的每一行，并尝试访问 `/etc/xdg/` 目录下对应的文件，直到找到密码为止。

    ```bash
    lucia@venus:~$ while read f; do file="/etc/xdg/$f"; cat "$file" 2>/dev/null && echo "Found in: $file" && break; done < ~/dict.txt
    H5ol8Z2mrRsorC0
    Found in: /etc/xdg/readme
    ```

3.  脚本成功在 `/etc/xdg/readme` 文件中找到了密码。使用该密码切换到 `isabel` 用户。

    ```bash
    lucia@venus:~$ su isabel
    Password: H5ol8Z2mrRsorC0
    ```

---

## **Mission 0x24: isabel -> freya**

-   **任务**: 用户 `freya` 的密码是 `different.txt` 文件中唯一没有重复的字符串。

1.  解决这个问题的标准方法是先对文件内容进行排序，然后使用 `uniq -u` 命令找出只出现一次的行。

    ```bash
    isabel@venus:~$ sort different.txt | uniq -u
    EEDyYFDwYsmYawj
    ```

2.  切换到 `freya` 用户。

    ```bash
    isabel@venus:~$ su freya
    Password: EEDyYFDwYsmYawj
    ```

---

## **Mission 0x25: freya -> alexa**

-   **任务**: 用户 `alexa` 每分钟会在 `/free` 目录下创建一个包含密码的 `.txt` 文件，然后立即删除它。

1.  这是一个典型的竞态条件问题。我们需要持续监控目标目录，并在文件出现时迅速读取其内容。

2.  使用一个 `while` 循环来不断尝试读取 `/free` 目录下的 `.txt` 文件（根据 `ls` 发现文件名为 `beer.txt`）。

    ```bash
    freya@venus:/free$ while true; do cat *.txt 2>/dev/null; sleep 0.1; done
    mxq9O3MSxxX9Q3S
    ```

3.  成功捕获到密码后，切换到 `alexa` 用户。

    ```bash
    freya@venus:/free$ su alexa
    Password: mxq9O3MSxxX9Q3S
    ```

---

## **Mission 0x26: alexa -> ariel**

-   **任务**: 用户 `ariel` 的密码在线 (HTTP)。

1.  这个提示意味着密码可以通过访问本地的 Web 服务获取。使用 `curl` 命令请求 `127.0.0.1`。

    ```bash
    alexa@venus:~$ curl 127.0.0.1
    33EtHoz9a0w2Yqo
    ```

2.  直接得到了密码，切换到 `ariel` 用户。

    ```bash
    alexa@venus:~$ su ariel
    Password: 33EtHoz9a0w2Yqo
    ```

---

## **Mission 0x27: ariel -> lola**

-   **任务**: `ariel` 没来得及保存 `lola` 的密码，但留下了一个临时文件 `.goas.swp`。

1.  `.swp` 文件是 Vim 编辑器的交换文件。使用 `strings` 命令可以从中提取可打印的字符，通常能找到有用的信息。

    ```bash
    ariel@venus:~$ strings .goas.swp
    # ... (部分输出)
    -->VVjqJGRrnfKmcgD
    -->bnQgcXYamhSDSff
    -->QsymOOVbzSaKmRm
    # ... (更多密码)
    -->ppkJjqYvSCIyAhK
    Thats my little DIc with my old and current passw0rds:
    ```

2.  文件内容是一个密码列表。由于无法确定哪一个是正确的，需要将列表复制到本地，使用 `hydra` 等工具对 `lola` 用户的 SSH 服务进行爆破。

    ```bash
    # 在本地Kali系统上执行，"pass"文件包含从.swp文件中提取的密码列表
    hydra -l lola -P pass ssh://venus.hackmyvm.eu:5000 -t 64
    ```

3.  Hydra 很快找到了正确的密码 `d3LieOzRGX5wud6`。使用该密码登录 `lola` 账户。

---

## **Mission 0x28: lola -> celeste**

-   **任务**: 用户 `celeste` 留下了一个文件名列表 `pages.txt`，她的密码可能在其中一个 `.html` 页面里。

1.  与 Mission 23 类似，需要编写脚本来测试 `pages.txt` 中的所有可能性。这次是检查哪个页面在本地 Web 服务器上存在。

2.  使用 `while` 循环读取列表，并通过 `curl` 检查每个页面的 HTTP 状态码。

    ```bash
    lola@venus:~$ while read p; do code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1/$p.html"); if [ "$code" == "200" ]; then echo "Found: $p.html"; fi; done < pages.txt
    Found: cebolla.html
    ```

3.  找到了返回 `200 OK` 的页面 `cebolla.html`。访问该页面获取密码。

    ```bash
    lola@venus:~$ curl 127.0.0.1/cebolla.html
    VLSNMTKwSV2o8Tn
    ```

4.  切换到 `celeste` 用户。

    ```bash
    lola@venus:~$ su celeste
    Password: VLSNMTKwSV2o8Tn
    ```

---

## **Mission 0x29: celeste -> nina**

-   **任务**: 用户 `celeste` 可以访问 MySQL，但有什么用呢？

1.  使用 `celeste` 当前的密码尝试登录 MySQL 数据库。

    ```bash
    celeste@venus:~$ mysql -u celeste -pVLSNMTKwSV2o8Tn
    ```

2.  登录成功后，查询数据库中的信息。
    ```sql
    MariaDB [(none)]> SHOW DATABASES;
    MariaDB [(none)]> USE venus;
    MariaDB [venus]> SHOW TABLES;
    MariaDB [venus]> SELECT * FROM people;
    ```

3.  `people` 表中包含大量用户名和密码。其中，`id_people=35` 的 `pazz` 字段是一个隐藏 Flag。同时，`id_people=74` 的 `nina` 用户凭证看起来很有希望。

4.  将所有凭证复制到本地，再次使用 `hydra` 爆破 SSH，最终确认 `nina` 的密码。
    ```bash
    # 在本地Kali系统上执行，"db_pass.txt"为从数据库导出的user:pass文件
    hydra -C db_pass.txt ssh://venus.hackmyvm.eu:5000
    # ...
    # [5000][ssh] host: venus.hackmyvm.eu   login: nina   password: ixpeqdWuvC5N9kG
    ```

5.  使用找到的密码 `ixpeqdWuvC5N9kG` 登录 `nina` 账户。

---

## **Mission 0x30: nina -> kira**

-   **任务**: 用户 `kira` 在 `http://localhost/method.php` 藏了东西。

1.  文件名 `method.php` 暗示需要测试不同的 HTTP 请求方法。

2.  使用 `for` 循环测试常用的 HTTP 方法，并观察响应。

    ```bash
    nina@venus:~$ for method in GET POST PUT DELETE PATCH OPTIONS; do echo -n "[$method] -> "; curl -s -X "$method" http://localhost/method.php; done
    [GET] -> I dont like this method!
    [POST] -> I dont like this method!
    [PUT] -> tPlqxSKuT4eP3yr
    [DELETE] -> I dont like this method!
    [PATCH] -> I dont like this method!
    [OPTIONS] -> I dont like this method!
    ```

3.  发现使用 `PUT` 方法时，服务器返回了密码。

4.  切换到 `kira` 用户。

    ```bash
    nina@venus:~$ su kira
    Password: tPlqxSKuT4eP3yr
    ```

---

# **Flag  **

```
22. lucia:         8===5Sr2pqeVTmn8RaaPmTPE===D~~
23. isabel:        8===Md2CU83GtVfouhm9U0AS===D~~
24. freya:         8===m1rRSv2pdm3sBGmgidul===D~~
25. alexa:         8===12ALP3eLlJ1GrTBxwJQM===D~~
26. ariel:         8===lqTeJ1msxhNjNJCptxmZ===D~~
27. lola:          8===TMYRw853hx8yKRocFMgM===D~~
28. celeste:       8===TrdsvMy99slFZtd4Cy4Q===D~~
29. nina:          8===VwICIymoA1DczWJau1sG===D~~
30. kira:          8===rJun2WyeuGIvabWQvJko===D~~

Hidden Flags:
- (Mission 23)   8===CISqRtRjnvQbzcRWfCqe===D~~
- (Mission 29)   8===xKmPDsJSKpHLzkqKXyjx===D~~
```

# Pass

```
22: lucia/uvMwFDQrQWPMeGP
23: isabel/H5ol8Z2mrRsorC0
24: freya/EEDyYFDwYsmYawj
25: alexa/mxq9O3MSxxX9Q3S
26: ariel/33EtHoz9a0w2Yqo
27: lola/d3LieOzRGX5wud6
28: celeste/VLSNMTKwSV2o8Tn
29: nina/ixpeqdWuvC5N9kG
30: kira/tPlqxSKuT4eP3yr
```

