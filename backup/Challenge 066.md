![image-20250722102055575](https://7r1UMPHK.github.io/image/20250722102055801.webp)

# **解题步骤**

## **第一步：Base64 解码**

题目给出的初始线索是一串 Base64 编码的字符串。

**原始编码:**
```
5Zub5YWrIOWFreS4iSDlha3kupQg5LqUZsO6IOWFreWbmyDlha3kuZ0g5LiD5LqMCuWbm2TEqyDlha3kuZ0g5YWt5LqUIOS4g+WbmyDlha3kupQg5YWtxJMgIOWFreS5nQrkupTlha0g5YWt5LiAIOS4g+WbmyDlha1mw7og5YWt5LiAIOWFreS6lCDlha3kupQK5LiDYsSrIOWFrWPEqyDlha3kuZ0g5LqUZsO6IOS4g+S6jCDkuIPkuIkg5YWtxJMgCuS6lOS4iSDkupRmw7og5YWtxJMgIOWFrWTEqyDkupRmw7og5YWt5LqUIOWFreWbmwrkuIPpm7Yg5YWt5LiDIOWFreS4gyDkuIPkuZ0g5Zub5LiJIOS6lGbDuiDkuIPkuIkK5YWt5LqUIOS4g+S6jCDkuIPkuIkg5LqUZsO6IOWFreWFqyDlha3lha0g5LiDZMSrCg==
```

使用任何标准的 Base64 解码工具，我们可以得到以下文本：
```
四八 六三 六五 五fú 六四 六九 七二
四dī 六九 六五 七四 六五 六ē 六九
五六 六一 七四 六fú 六一 六五 六五
七bī 六cī 六九 五fú 七二 七三 六ē
五三 五fú 六ē 六dī 五fú 六五 六四
七零 六七 六七 七九 四三 五fú 七三
六五 七二 七三 五fú 六八 六六 七dī
```

## **第二步：谐音及拼音转十六进制**

解码后的文本由中文数字和带音调的拼音组成。这是一个明显的提示，表明存在一种自定义的编码规则，很可能与十六进制有关。

*   **中文数字** 代表十六进制中的数字部分 (0-9)。
*   **拼音** 通过谐音或形状与十六进制中的字母部分 (A-F) 对应。

根据这个逻辑，我们建立如下映射关系：
*   `零` -> `0`
*   `一` -> `1`
*   `二` -> `2`
*   `三` -> `3`
*   `四` -> `4`
*   `五` -> `5`
*   `六` -> `6`
*   `七` -> `7`
*   `八` -> `8`
*   `九` -> `9`
*   `bī` -> `B`
*   `cī` -> `C`
*   `dī` -> `D`
*   `ē` -> `E`
*   `fú` -> `F`

将上一步得到的文本进行转换，得到一个 7x7 的十六进制矩阵：
```
48 63 65 5F 64 69 72
4D 69 65 74 65 6E 69
56 61 74 6F 61 65 65
7B 6C 69 5F 72 73 6E
53 5F 6E 6D 5F 65 64
70 67 67 79 43 5F 73
65 72 73 5F 68 66 7D
```

## **第三步：十六进制转 ASCII**

将这个十六进制矩阵按顺序转换为 ASCII 字符，得到一串看起来杂乱无章的字符串：

```
Hce_dirMieteniVatoaee{li_rsnS_nm_edpggyC_sers_hf}
```

## **第四步：栅栏密码（列置换）解密**

这个 49 个字符的字符串看起来仍然不是最终的 Flag。注意到在第二步中，数据被自然地分成了 7 行，这强烈暗示了密钥为 7 的栅栏密码或列置换密码。

> https://ctf.bugku.com/tool/railfence

我们将上一步得到的字符串输入到 BugKu CTF 平台提供的在线栅栏密码工具中，并将“栏数”（即列数）设置为 7。

*   **密文 (Ciphertext):** `Hce_dirMieteniVatoaee{li_rsnS_nm_edpggyC_sers_hf}`
*   **栏数/列数 (Columns):** `7`

![image-20250722101601574](https://7r1UMPHK.github.io/image/20250722101601832.webp)

工具给出了最终的解密结果。值得注意的是，此工具的“栅栏解密”并非标准算法，因为它将 49 个字符的输入神奇地还原成了 53 个字符的 Flag，这可能是平台为本题目特有的一个设定。

---

# **最终 Flag**

通过以上步骤，我们成功解出 Flag：

```
HMV{Special_greetings_to_my_dear_Chinese_friends}
```