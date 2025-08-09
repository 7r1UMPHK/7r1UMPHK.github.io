# **Mission 0x31: kira -> veronica**

- **任务**: 用户 `veronica` 经常访问 `http://localhost/waiting.php`。

1. 使用 `curl` 访问该页面，会收到一条信息，提示服务器正在等待一个特定的 User-Agent。

   ```bash
   kira@venus:~$ curl http://localhost/waiting.php
   Im waiting for the user-agent PARADISE. 
   ```

2. 根据提示，在 `curl` 请求中通过 `-H` 参数设置 `User-Agent` 为 `PARADISE`，成功获取密码。

   ```bash
   kira@venus:~$ curl -H "User-Agent: PARADISE" http://localhost/waiting.php
   QTOel6BodTx2cwX 
   ```

3. **veronica 的密码**: `QTOel6BodTx2cwX`

# **Mission 0x32: veronica -> lana**

- **任务**: 用户 `veronica` 为 `lana` 的密码创建了一个别名 (alias)。

1. 在 `veronica` 的会话中，使用 `alias` 命令可以列出所有已定义的别名。

   ```bash
   veronica@venus:~$ alias
   alias lanapass='UWbc0zNEVVops1v'
   alias ls='ls --color=auto'
   ```

2. 名为 `lanapass` 的别名直接暴露了 `lana` 的密码。

3. **lana 的密码**: `UWbc0zNEVVops1v`

# **Mission 0x33: lana -> noa**

- **任务**: 用户 `noa` 喜欢压缩她的东西。

1. 在家目录中发现一个名为 `zip.gz` 的文件。尽管后缀是 `.gz`，但使用 `file` 命令检查发现它实际上是一个 `tar` 归档文件。（Labs不许解压在该机器，所以需要你自己想办法拉去本地，可以使用bsae64复制拉取）

2. 将其解压后，会得到一个名为 `zip` 的文件，其中包含了密码。

   ```bash
   # 在本地机器上操作
   $ file zip.gz
   zip.gz: POSIX tar archive (GNU)
   $ tar -xvf zip.gz
   pwned/lana/zip
   $ cat pwned/lana/zip 
   9WWOPoeJrq6ncvJ
   ```

3. **noa 的密码**: `9WWOPoeJrq6ncvJ`

# **Mission 0x34: noa -> maia**

- **任务**: `maia` 的密码被“垃圾”包围着。

1. 在家目录中有一个名为 `trash` 的文件，里面充满了随机的“垃圾”数据。

2. 使用 `strings` 命令可以从二进制文件中提取可打印的字符串，从而在垃圾数据中找到真正的密码。

   ```bash
   noa@venus:~$ strings trash
   ...
   \nh1hnDPHpydEjoEN
   ...
   ```

3. **maia 的密码**: `h1hnDPHpydEjoEN`

# **Mission 0x35: maia -> gloria**

- **任务**: `gloria` 忘记了她密码的最后两个字符，只记得是两个小写字母。

1. 名为 `forget` 的文件给出了密码的已知部分：`v7xUVE2e5bjUc??`。

2. 这是一个典型的暴力破解场景。可以编写一个脚本生成所有可能的小写字母组合（从 `aa` 到 `zz`），然后使用 `hydra` 等工具对 `gloria` 的 SSH 服务进行密码爆破。

   ```bash
   for a in {a..z}; do for b in {a..z}; do echo "v7xUVE2e5bjUc${a}${b}"; done; done |tac > pass
   ```

3. 最终找到的正确密码是 `v7xUVE2e5bjUcxw`。

# **Mission 0x36: gloria -> alora**

- **任务**: `alora` 喜欢画画，所以她把密码存成了一幅“画”。

1.  家目录下的 `image` 文件内容是一大片由 `#` 字符组成的 ASCII 艺术。
2.  这幅“画”实际上是一个二维码 (QR Code)。使用手机或在线二维码扫描工具扫描即可得到密码。
3.  **alora 的密码**: `mhrTFCoxGoqUxtw`

# **Mission 0x37: alora -> julie**

- **任务**: 用户 `julie` 创建了一个包含她密码的 ISO 文件。

1. 在家目录中找到 `music.iso` 文件。可以直接使用 `strings` 命令在文件中查找可疑的密码字符串。

   ```bash
   alora@venus:~$ strings music.iso
   ...
   sjDf4i2MSNgSvOv
   ...
   ```

2. **julie 的密码**: `sjDf4i2MSNgSvOv`

# **Mission 0x38: julie -> irene**

- **任务**: `irene` 相信“美在于不同”。

1. 家目录下有两个文件：`1.txt` 和 `2.txt`。这个提示暗示需要找出它们之间的差异。

2. 使用 `diff` 命令比较这两个文件。

   ```bash
   julie@venus:~$ diff 1.txt 2.txt
   174c174
   < 8VeRLEFkBpe2DSD
   ---
   > aNHRdohjOiNizlU
   ```

3. 差异之处显示了两行不同的字符串，其中一个是密码。经过尝试，`8VeRLEFkBpe2DSD` 是正确的密码。

4. **irene 的密码**: `8VeRLEFkBpe2DSD`

# **Mission 0x39: irene -> adela**

- **任务**: `adela` 把她的密码借给了 `irene`。

1. `irene` 的家目录下有一个加密文件 `pass.enc` 和一个私钥文件 `id_rsa.pem`。

2. 这表明密码是使用 RSA 加密的。使用 `openssl` 和给定的私钥可以解密文件内容。

   ```bash
   irene@venus:~$ openssl rsautl -decrypt -inkey id_rsa.pem -in pass.enc
   nbhlQyKuaXGojHx
   ```

3. **adela 的密码**: `nbhlQyKuaXGojHx`

# **Mission 0x40: adela -> sky**

- **任务**: `sky` 把她的密码保存在可以“听到”的东西里。

1. `adela` 目录下有一个名为 `wtf` 的文件，内容是一串点和划。

   ```bash
   adela@venus:~$ cat wtf
   .--. .- .--. .- .--. .- .-. .- -.. .. ... .
   ```

2. 这明显是摩斯密码。使用在线工具进行翻译，得到 `PAPAPARADISE`。

3. 尝试使用该密码登录失败，但将其转换为小写 `papaparadise` 后成功登录。

4. **sky 的密码**: `papaparadise`

***

# **Flag**

```
31. veronica:      8===iSSeKzoDXsKy8WPuqNPg===D~~
32. lana:          8===um3Hno2AsjFjuLWsfmDj===D~~
33. noa:           8===HUNGevKdeKwcCvJru1CC===D~~
34. maia:          8===nu8IDScKFAXVcnFutKtG===D~~
35. gloria:        8===RZIkEtaEp18tLslTopJj===D~~
36. alora:         8===NSe78N2lM7IbvHzvrC0G===D~~
37. julie:         8===Iwe1QpxTcx0A8Uusqjfe===D~~
38. irene:         8===c9hgLkLGzsNw7mB3VEr4===D~~
39. adela:         8===86XGXQefUeV2eEdrUzxx===D~~
40. sky:           8===8T2IE4fNIvbs8sh1lnew===D~~

Hidden Flags:
40.sky:            8===nyqRAOwkVRTiMYeePdes===D~~
```

# **Pass**

```
31: veronica/QTOel6BodTx2cwX
32: lana/UWbc0zNEVVops1v
33: noa/9WWOPoeJrq6ncvJ
34: maia/h1hnDPHpydEjoEN
35: gloria/v7xUVE2e5bjUcxw
36: alora/mhrTFCoxGoqUxtw
37: julie/sjDf4i2MSNgSvOv
38: irene/8VeRLEFkBpe2DSD
39: adela/nbhlQyKuaXGojHx
40: sky/papaparadise
```

