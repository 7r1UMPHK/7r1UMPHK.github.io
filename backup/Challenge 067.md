![image-20250722102128231](https://7r1UMPHK.github.io/image/20250722102128477.webp)

# **解题步骤**

## **第一步：文件提取与初步分析**

挑战从一个名为 `067.zip` 的压缩包开始。

1.  **解压文件**: 使用 `7z` 或其他解压工具提取压缩包内容。
    
    ```bash
    7z x 067.zip
    ```
    解压后得到两个文件：`hmv067` 和 `hmv067-static`。
    
2.  **文件类型分析**: 使用 `file` 命令确定文件类型。
    ```bash
    ┌──(kali㉿kali)-[/mnt/…/gx/x/tmp/067]
    └─$ file hmv067 hmv067-static
    hmv067:        ELF 64-bit LSB pie executable... dynamically linked...
    hmv067-static: ELF 64-bit LSB executable... statically linked...
    ```
    分析结果表明，这两个都是 64 位的 Linux 可执行文件。一个为动态链接，另一个为静态链接。通常分析动态链接的版本会更简洁。

## **第二步：定位目标哈希值**

根据题目提示，文件内包含一个 SHA-512 哈希。

1.  **字符串搜索 (失败尝试)**: 一个快速的常规方法是使用 `strings` 命令搜索文件中可能存在的哈希字符串。SHA-512 哈希是一个 128 个字符的十六进制字符串。
    ```bash
    strings hmv067 | grep -E '^[a-f0-9]{128}$'
    ```
    此命令没有返回任何结果，这表明哈希值可能不是以明文形式直接存储在文件中的，或者被分割存放。因此，我们需要进行更深入的分析。

2.  **逆向分析**: 使用 IDA Pro 等反编译工具打开 `hmv067` 文件，并分析其 `main` 函数。反编译后的 C 伪代码清晰地揭示了程序的逻辑：

    ```c
    int __fastcall main(int argc, const char **argv, const char **envp)
    {
      // ... (部分变量定义省略)
      char v6[144]; // [rsp+40h] [rbp-230h] BYREF (用于存储计算出的哈希的十六进制字符串)
      char v7[140]; // [rsp+D0h] [rbp-1A0h] BYREF (用于存储目标哈希)
      
      // ... (获取用户输入并检查 "HMV{...}" 格式)
      
      // 计算用户输入的哈希值
      calculateHash(v11, v3, v5, &v8); 
      toHex(v5, v6, v8); // 将哈希值转为十六进制字符串存入 v6
      
      // 将目标哈希复制到 v7
      strcpy(
        v7,
        "3fe8b365cb64286384d9743612d857d938fadb42c359acb69fb9f2f88b96cdbfdb1cacf8a5292aa004a5efcc01fbdb27d4a72a8dd9a8b34dfff41f9e72bfb734");
      
      // 比较两个哈希值
      if ( (unsigned int)j_strcmp_ifunc(v6, v7) )
        puts("Wrong flag");
      else
        puts("Correct flag");
      
      return 0;
    }
    ```
    从代码中可以清楚地看到，程序将一个硬编码的字符串复制到变量 `v7` 中，这个字符串就是我们要找的目标 SHA-512 哈希。

**目标哈希:**
```
3fe8b365cb64286384d9743612d857d938fadb42c359acb69fb9f2f88b96cdbfdb1cacf8a5292aa004a5efcc01fbdb27d4a72a8dd9a8b34dfff41f9e72bfb734
```

## **第三步：哈希破解**

有了哈希值和提示中指定的字典 (`rockyou.txt`)，我们可以使用 John the Ripper进行破解。

1.  **准备破解**: 将哈希保存到一个文件中。

2.  **执行破解命令**: 使用 John the Ripper 进行破解，并指定哈希格式为 `Raw-SHA512`。
    ```bash
    john --wordlist=/usr/share/wordlists/rockyou.txt hash --format=Raw-SHA512
    ```

3.  **破解结果**: John 成功找到了对应的明文。
    ```
    i like your smile (?)
    ```
    破解出的密码是 `i like your smile`。

## **第四步：构造 Flag**

根据题目要求，Flag 的格式为 `HMV{...}`，并且内容不包含空格。

1.  移除破解出的密码中的空格: `i like your smile` -> `ilikeyoursmile`
2.  将结果填入花括号中。

---

# **最终 Flag**

```
HMV{ilikeyoursmile}
```