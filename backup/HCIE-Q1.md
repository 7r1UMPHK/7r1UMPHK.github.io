![image-20250811083621208](http://7r1UMPHK.github.io/image/20250813214159666.webp)

# 1 部署网络可靠性

## 1.1 配置交换机堆叠

*ps:堆叠ensp做不了，暂时不管*

### X_T2_AGG1-2

重启1-2，保证1为主

```
reboot fast
```

### X_T2_AGG1-1

```
stack slot 0 priority 200
int stack-port 0/1
port int X0/0/1 en
shut int X0/0/1
q
int stack-port 0/2
port int X0/0/2 en
shut int X0/0/2
q
```

### X_T2_AGG1-2

```
int stack-port 0/1
port int X0/0/2 en
q
int stack-port 0/2
port int X0/0/1 en
q
q
```

### X_T2_AGG1-1

```
--打开X_T2_AGG1-1堆叠互联接口(建议直接复制)--
int stack-port 0/1
undo shut int X0/0/1
q
int stack-port 0/2
undo shut int X0/0/2
q
----------------------------
sys X_T2_AGG1
dis stack
```

![image-20250811083042852](http://7r1UMPHK.github.io/image/20250813214156783.webp)

> [!TIP]
> 主备倒换:
>
> slave switchover enable
>
> slave switchover
>
> 重置堆叠:
>
> reset stack configuration

*ps:当配置堆叠有误，建议直接重置堆叠*

## 1.2 配置链路聚合

![image-20250811083741031](http://7r1UMPHK.github.io/image/20250813214149499.webp)

*ps:配置链路聚合时注意使用dis ll n b查看互联接口，根据实际情况而定，切勿死记接口编号*

先将相关设备改名，开启lldp

### 批量

```
sys
sys *
ll en
```

### Core

```
[X_T1_Core1]dis lldp neighbor  brief 
Local Intf   Neighbor Dev             Neighbor Intf             Exptime
GE0/0/11     X_T2_AGG1                GE0/0/13                  93     
GE0/0/12     X_T2_AGG1                GE0/0/14                  93     
GE0/0/13     X_T1_AGG1                GE0/0/13                  95     
GE0/0/14     X_T1_AGG1                GE0/0/14                  95     
GE0/0/21     X_T2_AGG1                GE0/0/23                  93     
GE0/0/22     X_T2_AGG1                GE0/0/24                  93     
GE0/0/23     X_T1_AGG1                GE0/0/23                  95     
GE0/0/24     X_T1_AGG1                GE0/0/24                  92    
```

13，14，23，24是eth1的，通常来说是预配的，检查

```
[X_T1_Core1]dis eth
Local:
LAG ID: 1                   WorkingMode: STATIC                               
Preempt Delay: Disabled     Hash arithmetic: According to SIP-XOR-DIP         
System Priority: 32768      System ID: 4c1f-cc7a-6702                         
Least Active-linknumber: 1  Max Active-linknumber: 8                          
Operate status: up          Number Of Up Port In Trunk: 4                     
--------------------------------------------------------------------------------
ActorPortName          Status   PortType PortPri PortNo PortKey PortState Weight
GigabitEthernet0/0/13  Selected 1GE      32768   14     305     10111100  1     
GigabitEthernet0/0/14  Selected 1GE      32768   15     305     10111100  1     
GigabitEthernet0/0/23  Selected 1GE      32768   24     305     10111100  1     
GigabitEthernet0/0/24  Selected 1GE      32768   25     305     10111100  1   
```

那直接配置eth2

```
int eth 2
mode lacp
tr g 0/0/11 0/0/12 0/0/21 0/0/22
q
```

### T2

也是批量打开X_T2_AGG1、X_T2_ACC1、X_T2_ACC2的lldp协议

```
sys
sys *
ll en
```

然后依旧是使用lldp显示出了连接信息配置链路聚合

#### X_T2_AGG1

```
int eth 1
mode lacp
tr g 0/0/13 0/0/14 0/0/23 0/0/24
q
int eth 2
mode lacp
tr g 0/0/11 0/0/21
int eth 3
mode lacp
tr g 0/0/12 0/0/22
q
```

#### X_T2_ACC1

```
int eth 1
mode lacp
tr g 0/0/23 0/0/24
q
```

#### X_T2_ACC2

```
int eth 1
mode lacp
tr g 0/0/23 0/0/24
q
```

![image-20250811085948464](http://7r1UMPHK.github.io/image/20250813214145946.webp)

# 2-3 基本业务需求与VPN实例配置

![image-20250811090108661](http://7r1UMPHK.github.io/image/20250813214144023.webp)

![image-20250811090218906](http://7r1UMPHK.github.io/image/20250813214121814.webp)

## 创建VPN实例

### Core

```
ip v Employee
rou 65001:1
q
q
ip v Guest
rou 65001:2
q
q
```

## 配置VPN与IP

### X_T1_Export2

```
vlan 202
int g6/0/1
p l a
p d v 202
int vlan202
ip add 10.1.200.5 30
int g0/0/0
ip add 10.255.3.1 24
int g0/0/1
ip add 10.255.4.1 24
int l0
ip add 10.1.0.2 32
q
```

### X_T1_Core1

*ps:配置vlan的那里，建议直接开个txt文本修改，那样快一点*

```
v b 60 201 to 209 51 to 55 100 to 105
# 我预配有问题，他X_T1_Core1是a口，X_T1_Export1是t口，我统一一下，不然等会OSPF邻居会卡Init
int g0/0/1
undo port default vlan
undo port link-type
p l t
p t a v 201
int g0/0/2
p l a
p d v 202
int g0/0/3
p t a v 51 to 55 100 to 105 203
int g0/0/4
p l t 
p t a v 204 205
un p t a v 1
int g0/0/5
p l t
p t a v 206 207
un p t a v 1
int g0/0/6
p l a
p d v 60
int vlan60
ip bin vpn-ins Employee
ip add 10.1.60.254 24
int eth2
p l t
p t a v 100 209
q
dhcp en

int vlan202
ip add 10.1.200.6 30
int vlan204
ip add 10.1.200.13 30
int vlan205
ip add 10.1.200.17 30
int vlan206
ip bin vpn-ins Employee
ip add 10.1.200.21 30
int vlan207
ip bin vpn-ins Guest
ip add 10.1.200.25 30
int vlan208
ip bin vpn-ins Employee
ip add 10.1.200.29 30
dhcp select global
int vlan209
ip bin vpn-ins Employee
ip add 10.1.200.33 30
dhcp select global

int l1
ip bin vpn-ins Employee
ip add 10.1.0.4 32
int l2
ip bin vpn-ins Guest
ip add 10.1.0.5 32

int vlan51
ip bin vpn-ins Employee
ip add 10.1.51.254 24
dhcp select global
int vlan 52
ip bin vpn-ins Employee
ip add 10.1.52.254 24
dhcp select global
int vlan53
ip bin vpn-ins Employee
ip add 10.1.53.254 24
dhcp select global
int vlan 54
ip bin vpn-ins Employee
ip add 10.1.54.254 24
dhcp select global
int vlan 55
ip bin vpn-ins Employee
ip add 10.1.55.254 24
dhcp select global

int vlan 101
ip bin vpn-ins Guest
ip add 10.1.101.254 24
dhcp select global
int vlan 102
ip bin vpn-ins Guest
ip add 10.1.102.254 24
dhcp select global
int vlan 103
ip bin vpn-ins Guest
ip add 10.1.103.254 24
dhcp select global
int vlan 104
ip bin vpn-ins Guest
ip add 10.1.104.254 24
dhcp select global
int vlan 105
ip bin vpn-ins Guest
ip add 10.1.105.254 24
dhcp select global
q
```

> [!TIP]
>
> 检查命令：
>
> dis ip vpn-in ver 查看VPN实例绑定的接口

### X_T1_AGG1

```
v b 11 to 15 21 to 25 100 208
int eth2
p h t v 11 to 15 21 to 25 100
int eth3
p h t v 11 to 15 21 to 25
q
```

### X_T2_AGG1

```
v b 100 209 31 to 35 41 to 45
int eth 1
p l t
p t a v 100 209
int eth 2
p h t v 31 to 35 41 to 45
int eth 3
p h t v 100 31 to 35 41 to 45
int vlan 209
ip add 10.1.200.34 30
int l0
ip add 10.1.0.7 32
q
```

### X_T1_ACC1

```
vlan 100
q
int g0/0/22
p l a
p d v 100
int eth 1
p l t
p t a v 100
q
```

### X_T2_ACC2

```
vlan 100
int eth 1
p l t
p t a v 100
int g0/0/22
p l a
p d v 100
q
```

*ps:如果g1-20空非hybrid，则需要改回hybrid*

### X_T1_AC1

```
v b 51 to 55 100 to 105
dhcp en
int vlan 100
ip add 10.1.100.254 255.255.255.0
dhcp select inter
int g0/0/1
p t a v 51 to 55 101 to 105 100 203
q
```

> [!TIP]
>
> 检查命令：
>
> dis vlan sum 检查vlan
>
> dis port vlan 检查vlan划分
>
> dis ip in b      检查ip

# 4 核心交换机DHCP地址池配置

![image-20250811090218906](http://7r1UMPHK.github.io/image/20250813214121814.webp)

## Core

```
ip pool market11
vpn-in Employee
gate 10.1.11.254
net 10.1.11.0 mask 255.255.255.0
ip pool market12
vpn-in Employee
gate 10.1.12.254
net 10.1.12.0 mask 255.255.255.0
ip pool market13
vpn-in Employee
gate 10.1.13.254
net 10.1.13.0 mask 255.255.255.0
ip pool market14
vpn-in Employee
gate 10.1.14.254
net 10.1.14.0 mask 255.255.255.0
ip pool market15
vpn-in Employee
gate 10.1.15.254
net 10.1.15.0 mask 255.255.255.0

ip pool procure21
vpn-in Employee
gate 10.1.21.254
net 10.1.21.0 mask 255.255.255.0
ip pool procure22
vpn-in Employee
gate 10.1.22.254
net 10.1.22.0 mask 255.255.255.0
ip pool procure23
vpn-in Employee
gate 10.1.23.254
net 10.1.23.0 mask 255.255.255.0
ip pool procure24
vpn-in Employee
gate 10.1.24.254
net 10.1.24.0 mask 255.255.255.0
ip pool procure25
vpn-in Employee
gate 10.1.25.254
net 10.1.25.0 mask 255.255.255.0

ip pool finance31
vpn-in Employee
gate 10.1.31.254
net 10.1.31.0 mask 255.255.255.0
ip pool finance32
vpn-in Employee
gate 10.1.32.254
net 10.1.32.0 mask 255.255.255.0
ip pool finance33
vpn-in Employee
gate 10.1.33.254
net 10.1.33.0 mask 255.255.255.0
ip pool finance34
vpn-in Employee
gate 10.1.34.254
net 10.1.34.0 mask 255.255.255.0
ip pool finance35
vpn-in Employee
gate 10.1.35.254
net 10.1.35.0 mask 255.255.255.0

ip pool hr41
vpn-in Employee
gate 10.1.41.254
net 10.1.41.0 mask 255.255.255.0
ip pool hr42
vpn-in Employee
gate 10.1.42.254
net 10.1.42.0 mask 255.255.255.0
ip pool hr43
vpn-in Employee
gate 10.1.43.254
net 10.1.43.0 mask 255.255.255.0
ip pool hr44
vpn-in Employee
gate 10.1.44.254
net 10.1.44.0 mask 255.255.255.0
ip pool hr45
vpn-in Employee
gate 10.1.45.254
net 10.1.45.0 mask 255.255.255.0

ip pool employee51
vpn-in Employee
gate 10.1.51.254
net 10.1.51.0 mask 255.255.255.0
ip pool employee52
vpn-in Employee
gate 10.1.52.254
net 10.1.52.0 mask 255.255.255.0
ip pool employee53
vpn-in Employee
gate 10.1.53.254
net 10.1.53.0 mask 255.255.255.0
ip pool employee54
vpn-in Employee
gate 10.1.54.254
net 10.1.54.0 mask 255.255.255.0
ip pool employee55
vpn-in Employee
gate 10.1.55.254
net 10.1.55.0 mask 255.255.255.0

ip pool Guest101
vpn-in Guest
gate 10.1.101.254
net 10.1.101.0 mask 255.255.255.0
ip pool Guest102
vpn-in Guest
gate 10.1.102.254
net 10.1.102.0 mask 255.255.255.0
ip pool Guest103
vpn-in Guest
gate 10.1.103.254
net 10.1.103.0 mask 255.255.255.0
ip pool Guest104
vpn-in Guest
gate 10.1.104.254
net 10.1.104.0 mask 255.255.255.0
ip pool Guest105
vpn-in Guest
gate 10.1.105.254
net 10.1.105.0 mask 255.255.255.0
q
```

> [!TIP]
>
> 检查命令:
>
> dis ip pool vpn-ins Employee
>
> dis ip pool vpn-ins Guest

# 5 核心交换机VLAN地址池配置

![image-20250811090218906](http://7r1UMPHK.github.io/image/20250813214121814.webp)

*ps:这和堆叠ensp都做不了，暂时不管，或者你去AC做测试，那个可以*

## X_T1_AGG1

```
vlan pool market
vlan 11 to 15
vlan pool procure
vlan 21 to 25
q
```

## X_T2_AGG1

```
vlan pool finance
vlan 31 to 35
vlan pool hr
vlan 41 to 45
q
```

## X_T1_AC1

```
vlan pool employee
vlan 51 to 55
vlan pool Guest
vlan 101 to 105
q
```

> [!TIP]
>
> 检查命令:
>
> dis vlan pool all

# 6 三层设备OSPF配置

## 6.1 核心与出口路由器的OSPF配置

### X_T1_Export1

```
ospf 1 rou 10.1.0.1
default-route-advertise always
a 0
net 10.1.0.1 0.0.0.0
net 10.1.200.1 0.0.0.0
q
q
```

### X_T1_Export2

```
ospf 1 rou 10.1.0.2
default-
a 0
net 10.1.0.2 0.0.0.0
net 10.1.200.5 0.0.0.0
q
q
```

### X_T1_Core1

```
ospf 1 rou 10.1.0.3
a 0
net 10.1.0.3 0.0.0.0
net 10.1.200.2 0.0.0.0
net 10.1.200.6 0.0.0.0
net 10.1.200.9 0.0.0.0
q
a 1
net 10.1.200.13 0.0.0.0
q
a 2
net 10.1.200.17 0.0.0.0
q
q
ospf 2 rou 10.1.0.4 vpn-ins Employee
vpn-inst simple
silent-int vlan51
silent-int vlan52
silent-int vlan53
silent-int vlan54
silent-int vlan55
silent-int vlan60
a 1
net 10.1.0.0 0.0.255.255
q
q
ospf 3 rou 10.1.0.5 vpn-ins Guest
vpn-inst simple
silent-int vlan101
silent-int vlan102
silent-int vlan103
silent-int vlan104
silent-int vlan105
a 2
net 10.1.0.0 0.0.255.255
q
q
```

## 6.2 T1汇聚的OSPF配置

### 6.2.1 DHCP配置

![image-20250811090218906](http://7r1UMPHK.github.io/image/20250813214121814.webp)

#### X_T1_AGG1

基础配置前面**2 基础业务需求**已经配置过了

*ps:打开你的记事本，ctrl+c，ctrl+v，哈哈哈*

```
dhcp en
int vlan 11
ip add 10.1.11.254 255.255.255.0
dhcp select relay
dhcp relay server-ip 10.1.200.29
int vlan 12
ip add 10.1.12.254 255.255.255.0
dhcp select relay
dhcp relay server-ip 10.1.200.29
int vlan 13
ip add 10.1.13.254 255.255.255.0
dhcp select relay
dhcp relay server-ip 10.1.200.29
int vlan 14
ip add 10.1.14.254 255.255.255.0
dhcp select relay
dhcp relay server-ip 10.1.200.29
int vlan 15
ip add 10.1.15.254 255.255.255.0
dhcp select relay
dhcp relay server-ip 10.1.200.29

int vlan 21
ip add 10.1.21.254 255.255.255.0
dhcp select relay
dhcp relay server-ip 10.1.200.29
int vlan 22
ip add 10.1.22.254 255.255.255.0
dhcp select relay
dhcp relay server-ip 10.1.200.29
int vlan 23
ip add 10.1.23.254 255.255.255.0
dhcp select relay
dhcp relay server-ip 10.1.200.29
int vlan 24
ip add 10.1.24.254 255.255.255.0
dhcp select relay
dhcp relay server-ip 10.1.200.29
int vlan 25
ip add 10.1.25.254 255.255.255.0
dhcp select relay
dhcp relay server-ip 10.1.200.29
q
```

##### 检查

![image-20250811170247422](http://7r1UMPHK.github.io/image/20250813214119189.webp)

![image-20250811170400091](http://7r1UMPHK.github.io/image/20250813214117533.webp)

### 6.2.2 OSPF 配置

#### X_T1_AGG1

```
ospf 1 rou 10.1.0.6
silent-int vlan 11
silent-int vlan 12
silent-int vlan 13
silent-int vlan 14
silent-int vlan 15
silent-int vlan 21
silent-int vlan 22
silent-int vlan 23
silent-int vlan 24
silent-int vlan 25
a 1
net 10.1.0.0 0.0.255.255
q
q
```

## 6.3 汇聚的OSPF 配置

### 6.3.1 DHCP配置

#### X_T2_AGG1

基础配置前面**2 基础业务需求**已经配置过了

```
dhcp en
int vlan 31
ip add 10.1.31.254 255.255.255.0
dhcp sel rel
dhcp rel server-ip 10.1.200.33
int vlan 32
ip add 10.1.32.254 255.255.255.0
dhcp sel rel
dhcp rel server-ip 10.1.200.33
int vlan 33
ip add 10.1.33.254 255.255.255.0
dhcp sel rel
dhcp rel server-ip 10.1.200.33
int vlan 34
ip add 10.1.34.254 255.255.255.0
dhcp sel rel
dhcp rel server-ip 10.1.200.33
int vlan 35
ip add 10.1.35.254 255.255.255.0
dhcp sel rel
dhcp rel server-ip 10.1.200.33

int vlan 41
ip add 10.1.41.254 255.255.255.0
dhcp sel rel
dhcp rel server-ip 10.1.200.33
int vlan 42
ip add 10.1.42.254 255.255.255.0
dhcp sel rel
dhcp rel server-ip 10.1.200.33
int vlan 43
ip add 10.1.43.254 255.255.255.0
dhcp sel rel
dhcp rel server-ip 10.1.200.33
int vlan 44
ip add 10.1.44.254 255.255.255.0
dhcp sel rel
dhcp rel server-ip 10.1.200.33
int vlan 45
ip add 10.1.45.254 255.255.255.0
dhcp sel rel
dhcp rel server-ip 10.1.200.33
q
```

##### 检查

![image-20250812104327092](http://7r1UMPHK.github.io/image/20250813214115137.webp)

![image-20250812104359037](http://7r1UMPHK.github.io/image/20250813214113229.webp)

### 6.3.2 OSPF 配置

#### X_T2_AGG1

```
ospf 1 rou 10.1.0.7
silent-int vlan 31
silent-int vlan 32
silent-int vlan 33
silent-int vlan 34
silent-int vlan 35
silent-int vlan 41
silent-int vlan 42
silent-int vlan 43
silent-int vlan 44
silent-int vlan 45
a 1
net 10.1.0.0 0.0.255.255
q
q
```

#### X_T1_AC1

*ps:可能会有人问，为什么我都没有配置ip就直接配ospf，是因为他是预配的，你可以看看AC1的ip表*

```
ospf 1 rou 10.1.0.11
a 0
net 10.1.0.11 0.0.0.0
net 10.1.200.10 0.0.0.0
q
q
```

# 7 防火墙配置

## 7.1虚拟系统配置

### X_T1_FW1

> [!TIP]
>
> 默认密码：
>
> admin:Admin@123

```
v b 204 to 207
int g1/0/1
Portsw
p l t
p t a v 204 to 205
un p t a v 1
int g1/0/2
Portsw
p l t
p t a v 206 to 207
un p t a v 1
q
```

### 检查

![image-20250812111534076](http://7r1UMPHK.github.io/image/20250813214111296.webp)

```
int l1
int l2
q
vsys en
vsys name Employee
assign int l1
assign vlan 204
assign vlan 206
int vlan 204
ip add 10.1.200.14 255.255.255.252
int vlan 206
ip add 10.1.200.22 255.255.255.252
int l1
ip add 10.1.0.8 255.255.255.255
q
```

### 检查

![image-20250812154330726](http://7r1UMPHK.github.io/image/20250813214109918.webp)

```
switch vsys Employee
sy
firewall zone trust
add int vlan 206
firewall zone untrust
add int vlan 204
security-po
rule name ospf
source-z trust untrust local
destination-zone trust untrust local
service ospf
action permit
q
q
quit
quit
vsys en
vsys na Guest
assign int l2
assign vlan 205
assign vlan 207
int vlan 205
ip add 10.1.200.18 255.255.255.252
int vlan 207
ip add 10.1.200.26 255.255.255.252
int l2
ip add 10.1.0.9 255.255.255.255
q

switch vsys Guest
sy
firewall zone trust
add int vlan 207
firewall zone untrust
add int vlan 205
security-po
rule name ospf
source-z trust untrust local
destination-zone trust untrust local
service ospf
action permit
q
q
quit
quit
```

## 7.2 OSPF 的配置

### X_T1_FW1

```
ospf 1 rou 10.1.0.8 vpn-ins Employee
vpn-instance-cap simple
a 1
net 10.1.0.8 0.0.0.0
net 10.1.200.14 0.0.0.0
net 10.1.200.22 0.0.0.0
q
q

ospf 2 rou 10.1.0.9 vpn-ins Guest
vpn-instance-cap simple
a 2
net 10.1.0.9 0.0.0.0
net 10.1.200.18 0.0.0.0
net 10.1.200.26 0.0.0.0
q
q
```

### 验证

去core查看ospf peer

![image-20250812165616221](http://7r1UMPHK.github.io/image/20250813214106871.webp)

一共9个，全部full

# 8 核心交换机过滤指定3类LSA AND 配置 NSSA 区域

*ps:还是建议记事本复制大法*

## X_T1_Core1

```
ip ip-prefix Employee deny 10.1.11.0 24
ip ip-prefix Employee deny 10.1.12.0 24
ip ip-prefix Employee deny 10.1.13.0 24
ip ip-prefix Employee deny 10.1.14.0 24
ip ip-prefix Employee deny 10.1.15.0 24

ip ip-prefix Employee deny 10.1.21.0 24
ip ip-prefix Employee deny 10.1.22.0 24
ip ip-prefix Employee deny 10.1.23.0 24
ip ip-prefix Employee deny 10.1.24.0 24
ip ip-prefix Employee deny 10.1.25.0 24

ip ip-prefix Employee deny 10.1.31.0 24
ip ip-prefix Employee deny 10.1.32.0 24
ip ip-prefix Employee deny 10.1.33.0 24
ip ip-prefix Employee deny 10.1.34.0 24
ip ip-prefix Employee deny 10.1.35.0 24

ip ip-prefix Employee deny 10.1.41.0 24
ip ip-prefix Employee deny 10.1.42.0 24
ip ip-prefix Employee deny 10.1.43.0 24
ip ip-prefix Employee deny 10.1.44.0 24
ip ip-prefix Employee deny 10.1.45.0 24

ip ip-prefix Employee deny 10.1.51.0 24
ip ip-prefix Employee deny 10.1.52.0 24
ip ip-prefix Employee deny 10.1.53.0 24
ip ip-prefix Employee deny 10.1.54.0 24
ip ip-prefix Employee deny 10.1.55.0 24

ip ip-prefix Employee permit 0.0.0.0 0 less-equal 32

ip ip-prefix Guest deny 10.1.101.0 24
ip ip-prefix Guest deny 10.1.102.0 24
ip ip-prefix Guest deny 10.1.103.0 24
ip ip-prefix Guest deny 10.1.104.0 24
ip ip-prefix Guest deny 10.1.105.0 24

ip ip-prefix Guest permit 0.0.0.0 0 less-equal 32

ospf 1
a 1
filter ip-prefix Guest imp
q
a 2
filter ip-prefix Employee imp
nssa
q
q
ospf 3
a 2
nssa
q
q
```

## X_T1_FW1

```
ospf 2
a 2
nssa
q
q
```

## 检查

![image-20250812161934561](http://7r1UMPHK.github.io/image/20250813214104057.webp)

![image-20250812170719317](http://7r1UMPHK.github.io/image/20250813214102133.webp)

# 9 出口网络配置

## X_T1_Export1

```
----这里的是预配的，只是我这拓扑没有----
ip rou 0.0.0.0 0.0.0.0 10.255.1.254
ip rou 0.0.0.0 0.0.0.0 10.255.2.254
acl 2000
rule 5 permit
quit
int g0/0/0
nat out 2000
int g0/0/1
nat out 2000
q
-----------------------------------
acl 2000
undo rule 5
rule permit sou 10.1.11.0 0.0.0.255
rule permit sou 10.1.12.0 0.0.0.255
rule permit sou 10.1.13.0 0.0.0.255
rule permit sou 10.1.14.0 0.0.0.255
rule permit sou 10.1.15.0 0.0.0.255

rule permit sou 10.1.21.0 0.0.0.255
rule permit sou 10.1.22.0 0.0.0.255
rule permit sou 10.1.23.0 0.0.0.255
rule permit sou 10.1.24.0 0.0.0.255
rule permit sou 10.1.25.0 0.0.0.255

rule permit sou 10.1.51.0 0.0.0.255
rule permit sou 10.1.52.0 0.0.0.255
rule permit sou 10.1.53.0 0.0.0.255
rule permit sou 10.1.54.0 0.0.0.255
rule permit sou 10.1.55.0 0.0.0.255

rule permit sou 10.1.101.0 0.0.0.255
rule permit sou 10.1.102.0 0.0.0.255
rule permit sou 10.1.103.0 0.0.0.255
rule permit sou 10.1.104.0 0.0.0.255
rule permit sou 10.1.105.0 0.0.0.255
q
```

## 检查

![image-20250813093949534](http://7r1UMPHK.github.io/image/20250813214100032.webp)

## X_T1_Export2

```
ip rou 0.0.0.0 0.0.0.0 10.255.3.254
ip rou 0.0.0.0 0.0.0.0 10.255.4.254
nat address-group 1 10.255.4.2 10.255.4.100
acl 2000
rule permit sou 10.1.11.0 0.0.0.255
rule permit sou 10.1.12.0 0.0.0.255
rule permit sou 10.1.13.0 0.0.0.255
rule permit sou 10.1.14.0 0.0.0.255
rule permit sou 10.1.15.0 0.0.0.255

rule permit sou 10.1.21.0 0.0.0.255
rule permit sou 10.1.22.0 0.0.0.255
rule permit sou 10.1.23.0 0.0.0.255
rule permit sou 10.1.24.0 0.0.0.255
rule permit sou 10.1.25.0 0.0.0.255

rule permit sou 10.1.51.0 0.0.0.255
rule permit sou 10.1.52.0 0.0.0.255
rule permit sou 10.1.53.0 0.0.0.255
rule permit sou 10.1.54.0 0.0.0.255
rule permit sou 10.1.55.0 0.0.0.255

rule permit sou 10.1.101.0 0.0.0.255
rule permit sou 10.1.102.0 0.0.0.255
rule permit sou 10.1.103.0 0.0.0.255
rule permit sou 10.1.104.0 0.0.0.255
rule permit sou 10.1.105.0 0.0.0.255
q

int g0/0/0
nat out 2000
int g0/0/1
nat server protocol tcp global current-int 8081 ins 10.1.60.101 80
nat out 2000 address-group 1
q
```

## 实现回程流量转发

### Core

```
acl 3001
rule permit ip sou 10.1.60.101 0
int vlan 204
----------这条模拟器做不了，你可以写个描述记忆一下----------
traffic-rediect inbound acl 3001 ip-nexthop 10.1.200.5
-----------------------------------------------------
q
```

### X_T1_Export2

```
acl 3001
rule permit ip sou 10.1.60.101 0
traffic classifier web
if-match acl 3001
traffic behavior web
redirect ip-nexthop 10.255.4.254
traffic policy web
classifier web behavior web
int vlan 202
traffic-policy web inbound
q
```

# 10 WLAN扩展需求

*ps:考试的时候，每个人的AC预配模板名字是不一样的。*

这是我的预配模板，只是提供参照。

```
wlan
 traffic-profile name default
 security-profile name default
 security-profile name X_Guest
  security wpa-wpa2 psk pass-phrase %^%#81*JKo7<}DcIVzR3Lz/4(:!R=HMpVT3P^*XG[dCB
%^%# aes
 security-profile name X_Employee
  security wpa-wpa2 psk pass-phrase %^%#i#Ou6&},h,-1.CNu{`N:K''qIaQs>%G$+(WxjCy"
%^%# aes
 security-profile name default-wds
 security-profile name X_GEmployee
 security-profile name default-mesh
 ssid-profile name default
 ssid-profile name X_Guest
  ssid X_Guest
 ssid-profile name X_Employee
  ssid X_Employee
 vap-profile name default
 vap-profile name X_Guest
  service-vlan vlan-id 32
  ssid-profile X_Guest
  security-profile X_Guest
 vap-profile name X_Employee
  service-vlan vlan-id 31
  ssid-profile X_Employee
  security-profile X_Employee
 wds-profile name default
 mesh-handover-profile name default
 mesh-profile name default
 regulatory-domain-profile name default
 air-scan-profile name default
 rrm-profile name default
 radio-2g-profile name default
 radio-5g-profile name default
 wids-spoof-profile name default
 wids-profile name default
 wireless-access-specification
 ap-system-profile name default
 port-link-profile name default
 wired-port-profile name default
 serial-profile name preset-enjoyor-toeap 
 ap-group name default
 ap-group name ap-group1
  radio 0
   vap-profile X_Employee wlan 1
  radio 1
   vap-profile X_Guest wlan 2
 ap-id 0 type-id 69 ap-mac 00e0-fc14-40d0 ap-sn 2102354483104B292D16
  ap-name X_T1_AP1
  ap-group ap-group1
 provision-ap
#
return
```

## 10.1 新增 X_T2_AP1

> [!TIP]
>
> ap mac可以通过 dis arp查看，lldp也可以看

```
un capwap source ip-address
capwap source interface Vlanif 100
wlan
-----这里的考试有，但是我预配没有，所以我自己配-----
ap-group name X
vap-profile X_Employee wlan 1 radio all
vap-profile X_Guest wlan 2 radio all
q
vap-profile name X_Employee
service-vlan vlan-pool Employee
y
forward-mode tunnel
y
q
vap-profile name X_Guest
service-vlan vlan-pool Guest
y
forward-mode tunnel
y
q
-------------------------------------------
ap-id 0
ap-group X
y
q
ap-id 1 ap-mac 00e0-fc66-08b0
ap-name X_T2_AP1
ap-group X
y
q
```

如果不脸黑的话，一会就可以看到上线成功了

![image-20250813105950024](http://7r1UMPHK.github.io/image/20250813214056465.webp)

然后根据你桌子上的小纸纸，改密码，我这只是演示

```
security-profile name X_Employee
security wpa-wpa2 psk pass-phrase Huawei@001 aes
y
security-profile name X_Guest
security wpa-wpa2 psk pass-phrase Huawei@001 aes
y
```

测试能连上就好了

![image-20250813110553953](http://7r1UMPHK.github.io/image/20250813214054634.webp)

# 11 准入认证

*ps:这里只有一部分可以配置，所以不用过多纠结，可以先练习一下，然后上真机配置*

## X_T1_AGG1/X_T2_AGG1

### radius 模板

没有多执行，那我们就练习一个就好了

```
radius-server template Employee
radius-server authentication 10.1.60.2 1812
radius-server shared-key cipher Huawei@123
q
radius-server authorization 10.1.60.2 shared-key cipher Huawei@123
```

### AAA

```
aaa
authentication-scheme Employee
authentication-mode radius 
q
accounting-scheme Employee
accounting-mode radius
q
authentication-scheme ap_noauthen
authentication-mode none
q
```

### 认证域

```
domain employee
authentication-scheme Employee
radius-server Employee
q
domain ap_noauthen
authentication-scheme ap_noauthen
q
```

### AP认证域绑定MAC（ensp做不了）

```
domain ap_noauthen mac-authen force mac-address "AP的MAC地址" mask ffff-fffr-fff
```

### 接入模板（ensp做不了）

```
dotlx-access-profile name Employee
mac-access-profile name Employee
```

### 认证模板（ensp做不了）

```
authentication-profile name Employee
dotlx-access-profile Employee
mac-access-profile Employee
authentication dotlx-mac-bypass
access-domain employee force
```

### 接口开认证（ensp做不了）

也是两个都要，我这只演示一个

*ps:聚合口是使用下联的聚合空，灵活应用*

```
int eth-trunk 2
authentication-profile Employee
int eth-truink 3
authentication-profile Employee
```

## 全ACC透传（全部acc都需要配置）

```
l2protocol-tunnel user-defined-protocol 802.1x protocol-mac 0180-c200-0003 group-mac 0100-0000-0002
```

### 接口绑定802.1X认证（全部acc都需要配置）

```
int rang g 0/0/1 to g0/0/20           
//这条ensp不支持，ensp可以使用 p g g0/0/1 to g0/0/20
l2protocol-tunnel user-defined-protocol 802.1x enable
q
interface Eth-Trunk 1             //上联聚合口
l2protocol-tunnel user-defined-protocol 802.1x enable
```

# 12 网络安全需求

## 12.1 vsys Employee配置

### 12.1.1 地址集

#### X_T1_FW1

```
switch vsys Employee
sy
ip address-set market type group
address 10.1.11.0 mask 24
address 10.1.12.0 mask 24
address 10.1.13.0 mask 24
address 10.1.14.0 mask 24
address 10.1.15.0 mask 24

ip address-set procure type group
address 10.1.21.0 mask 24
address 10.1.22.0 mask 24
address 10.1.23.0 mask 24
address 10.1.24.0 mask 24
address 10.1.25.0 mask 24

ip address-set wlan type group
address 10.1.51.0 mask 24
address 10.1.52.0 mask 24
address 10.1.53.0 mask 24
address 10.1.54.0 mask 24
address 10.1.55.0 mask 24

ip address-set hr-finance type group
address 10.1.31.0 mask 24
address 10.1.32.0 mask 24
address 10.1.33.0 mask 24
address 10.1.34.0 mask 24
address 10.1.35.0 mask 24
address 10.1.41.0 mask 24
address 10.1.42.0 mask 24
address 10.1.43.0 mask 24
address 10.1.44.0 mask 24
address 10.1.45.0 mask 24

ip address-set X-Y-Z type group
address 10.3.101.0 mask 24
address 10.100.2.0 mask 24
address 10.2.31.0 mask 24
address 10.2.32.0 mask 24
address 10.2.33.0 mask 24
address 10.2.34.0 mask 24
address 10.2.35.0 mask 24
address 10.2.41.0 mask 24
address 10.2.42.0 mask 24
address 10.2.43.0 mask 24
address 10.2.44.0 mask 24
address 10.2.45.0 mask 24
address 10.2.51.0 mask 24
address 10.2.52.0 mask 24
address 10.2.53.0 mask 24
address 10.2.54.0 mask 24
address 10.2.55.0 mask 24
q
quit
quit
```

### 12.1.2 重定向内部无线访问服务器流量

#### X_T1_Core1

```
acl number 3000
rule permit ip source 10.1.51.0 0.0.0.255 destination 10.1.60.0 0.0.0.255
rule permit ip source 10.1.52.0 0.0.0.255 destination 10.1.60.0 0.0.0.255
rule permit ip source 10.1.53.0 0.0.0.255 destination 10.1.60.0 0.0.0.255
rule permit ip source 10.1.54.0 0.0.0.255 destination 10.1.60.0 0.0.0.255
rule permit ip source 10.1.55.0 0.0.0.255 destination 10.1.60.0 0.0.0.255
q
interface g0/0/3
# ensp加不了实例，所以想配就配，不配就算了
trafiic-redirect inbound acl 3000 vpn-ins Employee ip-nexthop 10.1.200.22
q
```

### 12.1.3 安全策略

#### X_T1_FW1

```
switch vsys Employee
sy
security-policy
rule name permit60.101
source-zone untrust
destination-zone trust
destination-address 10.1.60.101 mask 255.255.255.255
service http
action permit
q

rule name perimit60.100
source-zone trust
destination-zone trust
source-address address-set wlan
destination-address 10.1.60.100 mask 255.255.255.255
action permit
q

rule name deny60.0
source-zone trust
destination-zone trust
source-address address-set wlan
destination-address 10.1.60.100 mask 255.255.255.255
action deny
q

rule name Z-Y-X
source-zone untrust
source-zone trust
destination-zone untrust
destination-zone trust
source-address address-set X-Y-Z
source-address address-set market procure hr-finance wlan
destination-address address-set market procure hr-finance wlan
destination-address address-set X-Y-Z
action permit
q

rule name permitany
source-zone trust
destination-zone untruist
source-address address-set wlan
source-address address-set market
source-address address-set procure
action permit
q
q
quit
quit
```

![image-20250813160936283](http://7r1UMPHK.github.io/image/20250813214050584.webp)

![image-20250813161001465](http://7r1UMPHK.github.io/image/20250813214049075.webp)

## 12.2 vsys Guest

### 12.2.1 地址集

```
switch vsys Guest
sy
ip address-set Guest type group
address 10.1.101.0 mask 24
address 10.1.102.0 mask 24
address 10.1.103.0 mask 24
address 10.1.104.0 mask 24
address 10.1.105.0 mask 24
q
```

### 12.2.2 安全策略

#### 服务集

```
ip service-set Guest_Service type object 16
service 0 protocol tcp destination-port 3389
q
```

#### 安全策略

```
security-policy
rule name permit60.99
source-zone trust
destination-zone untrust
source-address address-set Guest
destination-address 10.1.60.99 mask 255.255.255.255
service Guest_Service
action permit
q

rule name deny60.0_Y_Z
source-zone trust
destination-zone untrust
source-address address-set Guest
destination-address 10.1.60.0 mask 255.255.255.0
destination-address 10.10.0.0 mask 255.255.0.0
destination-address 10.100.0.0 mask 255.255.0.0
destination-address 10.2.0.0 mask 255.255.0.0
destination-address 10.3.0.0 mask 255.255.0.0
action deny
rule name permitany
source-zone trust
destination-zone untrust
source-address address-set Guest
action permit
q
```

![image-20250813160805716](http://7r1UMPHK.github.io/image/20250813214046853.webp)

## 12.3 vsys 之间的转发

### Employee

```
switch vsys Employee
sy
interface Virtual-if1
ip address 10.1.200.253 255.255.255.255
q
firewall zone untrust
add interface Virtual-if1
q
quit
quit
```

### Guest

```
switch vsys Guest
sy
interface Virtual-if2
ip address 10.1.200.254 255.255.255.255
q
firewall zone untrust
add interface Virtual-if2
q
quit
quit
```

### 公共

```
ip route-static vpn-instance Guest 10.1.60.99 255.255.255.255 vpn-instance Employee
ip route-static vpn-instance Employee 10.1.101.0 255.255.255.0 vpn-instance Guest
ip route-static vpn-instance Employee 10.1.102.0 255.255.255.0 vpn-instance Guest
ip route-static vpn-instance Employee 10.1.103.0 255.255.255.0 vpn-instance Guest
ip route-static vpn-instance Employee 10.1.104.0 255.255.255.0 vpn-instance Guest
ip route-static vpn-instance Employee 10.1.105.0 255.255.255.0 vpn-instance Guest
```

### Employee

```
ip address-set Guest type group
address 10.1.101.0 mask 24
address 10.1.102.0 mask 24
address 10.1.103.0 mask 24
address 10.1.104.0 mask 24
address 10.1.105.0 mask 24
q

ip service-set Guest_Service type object 17
service 0 protocol tcp destination-port 3389
q

security-policy
rule name permit60.99
source-zone untrust
destination-zone trust
source-address address-set Guest
destination-address 10.1.60.99 mask 255.255.255.255
service Guest_Service
action permit
```

# 验证

先把FW1的icmp打开

```
icmp ttl-exceeded send
```

![image-20250813162920742](http://7r1UMPHK.github.io/image/20250813214044313.webp)

![image-20250813163121733](http://7r1UMPHK.github.io/image/20250813214042640.webp)

![image-20250813163304351](http://7r1UMPHK.github.io/image/20250813214038287.webp)