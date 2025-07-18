# 1. 初步分析

**挑战链接:** https://hackmyvm.eu/challenges/challenge.php?c=011

![挑战图片](https://7r1umphk.github.io/image/20250518110146012.webp)

## 1. 初步分析

挑战页面显示了一段被 `<pre>` 标签包裹的文本，这通常意味着其中的空格和换行符会被保留，以维持其原始格式。文本内容如下：

```html
<pre> $$$$$$$$$$ $_________$$ $_$$$$$$$_$$ $_$_____$_$$ $_$_____$_$$ $_$_____$_$$ $_$_____$_$$ $_$$$$$$$_$$ $_________$$ $$$$$$$$$$ $_________$$ $_1__2__3_$$$ $_4__5__6_$$$ $_7__8__9_$$$ $_*__0__#_$$$ $_________$$$ $$$$$$$$$$$ $$$$$$$$$ FLAG: HMV{?} ? = 3-1 2-1 8-1 2-1 7-4 3-2 2-3 </pre>
```

观察这段文本，我们可以发现几个关键点：
1.  前半部分用 `$` 和 `_` 字符绘制了一个类似键盘的图形。
2.  紧接着，这个图形下方有了一个更明确的数字键盘布局：
    ```
    $_1__2__3_$$$
    $_4__5__6_$$$
    $_7__8__9_$$$
    $_*__0__#_$$$
    ```
    这非常像一个标准的电话拨号键盘。
3.  最关键的信息是 `FLAG: HMV{?} ? = 3-1 2-1 8-1 2-1 7-4 3-2 2-3`。
    这表明我们需要根据给出的坐标 `X-Y` 来从电话键盘上找出对应的字符，以替换 `?`。

## 2. 解密过程

这个挑战的核心是理解坐标 `X-Y` 如何映射到电话键盘上的字符。

### 2.1 理解键盘布局与编码

标准的电话键盘按键通常与字母相关联（用于 T9 输入等）：
*   `1`: (通常没有字母，或有特殊符号)
*   `2`: `ABC`
*   `3`: `DEF`
*   `4`: `GHI`
*   `5`: `JKL`
*   `6`: `MNO`
*   `7`: `PQRS`
*   `8`: `TUV`
*   `9`: `WXYZ`
*   `0`: (通常是空格或 `+`)
*   `*`, `#`: 特殊功能键

给出的坐标格式是 `X-Y`。我们可以合理地推断：
*   `X` 代表电话键盘上的数字键。
*   `Y` 代表该数字键上对应字母序列中的第 `Y` 个字母（1-based index）。

### 2.2 坐标解析

现在我们来逐个解析给出的坐标 `3-1 2-1 8-1 2-1 7-4 3-2 2-3`：

1.  **`3-1`**:
    *   键 `3` 对应字母 `DEF`。
    *   第 `1` 个字母是 `D`。

2.  **`2-1`**:
    *   键 `2` 对应字母 `ABC`。
    *   第 `1` 个字母是 `A`。

3.  **`8-1`**:
    *   键 `8` 对应字母 `TUV`。
    *   第 `1` 个字母是 `T`。

4.  **`2-1`**:
    *   键 `2` 对应字母 `ABC`。
    *   第 `1` 个字母是 `A`。

5.  **`7-4`**:
    *   键 `7` 对应字母 `PQRS`。
    *   第 `4` 个字母是 `S`。

6.  **`3-2`**:
    *   键 `3` 对应字母 `DEF`。
    *   第 `2` 个字母是 `E`。

7.  **`2-3`**:
    *   键 `2` 对应字母 `ABC`。
    *   第 `3` 个字母是 `C`。

### 2.3 组合解密字符

将解析出来的字母组合起来，得到：`D A T A S E C`。

## 3. 获取 Flag

将上面解密得到的字符串 `DATASEC` 替换掉 `FLAG: HMV{?}` 中的 `?`。

## 4. Flag

最终的 Flag 是：
```
HMV{DATASEC}
```
