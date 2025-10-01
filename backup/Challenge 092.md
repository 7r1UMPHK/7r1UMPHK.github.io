狂刷 WP 计划启动

# 一、信息收集

靶机来源：https://hackmyvm.eu/challenges/challenge.php?c=092

获得加密字符串：

```
NjM2MzMyNjI2NTYzNjUzNDMyNjQ2NDY0MzAzOTM5NjMzOTYyNjE2NjM0NjIzNjYzNjE2MTM1NjQ2MzY0MzA2Mw==
```

目标格式：`HMV{solution}`

---

# 二、密码学分析

## 2.1 Base64 解码

观察字符串特征：

- 字符串以 `==` 结尾
- 仅包含大小写字母、数字和 `+/=` 字符
- 判断为 **Base64 编码**

使用 CyberChef 进行解码：https://gchq.github.io/CyberChef/

![image-20251001193728323](http://7r1UMPHK.github.io/image/20251001214949057.webp)

解码结果：

```
cc2bece42ddd099c9baf4b6caa5dcd0c
```

---

## 2.2 Hash 识别

观察解码后的字符串特征：

- 长度为 32 位
- 仅包含十六进制字符（0-9, a-f）
- 判断为 **MD5 哈希值**

> **知识点补充：**
> MD5（Message-Digest Algorithm 5）是一种广泛使用的哈希算法，输出固定 128 位（32 个十六进制字符）。由于其抗碰撞性较弱，现已被 SHA-256 等更安全的算法替代，但在 CTF 中仍常作为基础密码学考点出现。

---

# 三、Hash 破解

## 在线查询

使用 MD5 在线数据库进行查询：https://md5.gromweb.com/

![image-20251001193832231](http://7r1UMPHK.github.io/image/20251001214953069.webp)

成功查询到原文：

```
bravo1!
```

> **Tips：常用 MD5 查询平台**
>
> - https://www.cmd5.com/
> - https://crackstation.net/
> - https://hashes.com/en/decrypt/hash

---

# 四、获取 Flag

将破解结果按照题目要求格式封装：

```
HMV{bravo1!}
```

**Flag:** `HMV{bravo1!}`