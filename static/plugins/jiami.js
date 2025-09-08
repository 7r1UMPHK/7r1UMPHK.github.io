!function(){
    // 解密函数
    function e(e,n){
        try{
            var t=atob(e),r=[];
            for(var o=0;o<t.length;o++)r.push(t.charCodeAt(o));
            var c=new TextDecoder("utf-8").decode(new Uint8Array(r)),a="";
            for(var o=0;o<c.length;o++){
                var i=c.charCodeAt(o),d=n.charCodeAt(o%n.length),u=i^d;
                a+=String.fromCharCode(u)
            }
            return a
        }catch(e){
            throw new Error("解密失败")
        }
    }
    
    // 检查是否被封禁
    function checkBan(id){
        var banKey = "ban_" + id;
        var banData = localStorage.getItem(banKey);
        if(banData){
            var data = JSON.parse(banData);
            var now = Date.now();
            if(now < data.until){
                var remaining = Math.ceil((data.until - now) / 1000);
                return {banned: true, seconds: remaining, until: data.until};
            } else {
                localStorage.removeItem(banKey);
                localStorage.removeItem("err_" + id);
            }
        }
        return {banned: false};
    }
    
    // 记录密码错误
    function recordError(id){
        var errKey = "err_" + id;
        var count = parseInt(localStorage.getItem(errKey) || "0") + 1;
        localStorage.setItem(errKey, count.toString());
        
        if(count >= 10){
            var banUntil = Date.now() + 10 * 60 * 1000; // 10分钟
            localStorage.setItem("ban_" + id, JSON.stringify({until: banUntil, count: count}));
            return {banned: true, count: count};
        }
        return {banned: false, count: count};
    }
    
    // 格式化剩余时间显示
    function formatTime(seconds){
        var minutes = Math.floor(seconds / 60);
        var secs = seconds % 60;
        return minutes + "分" + (secs < 10 ? "0" : "") + secs + "秒";
    }
    
    // 启动倒计时更新
    function startCountdown(id, banUntil){
        var countdownInterval = setInterval(function(){
            var now = Date.now();
            var remaining = Math.ceil((banUntil - now) / 1000);
            var countdownEl = document.getElementById("countdown-" + id);
            
            if(remaining <= 0 || !countdownEl){
                clearInterval(countdownInterval);
                if(countdownEl){
                    location.reload(); // 封禁结束，刷新页面
                }
                return;
            }
            
            countdownEl.textContent = formatTime(remaining);
        }, 1000);
        
        // 将定时器ID存储，用于清理
        window["timer_" + id] = countdownInterval;
    }
    
    // 切换密码显示
    function togglePwd(id){
        var input = document.getElementById("pwd-" + id);
        var btn = document.getElementById("toggle-" + id);
        if(input.type === "password"){
            input.type = "text";
            btn.innerHTML = "🙈";
            btn.title = "隐藏密码";
        } else {
            input.type = "password";
            btn.innerHTML = "👁️";
            btn.title = "显示密码";
        }
    }
    
    // 创建密码输入界面
    function n(e,n){
        var banStatus = checkBan(e);
        var t=document.createElement("div");
        t.style.cssText="border:1px solid #ddd;padding:20px;margin:10px 0;border-radius:5px;background:#f9f9f9;text-align:center";
        
        if(banStatus.banned){
            var initialTime = formatTime(banStatus.seconds);
            t.innerHTML='🚫 <strong style="color:#d63384">密码输入次数过多，已被封禁</strong><br><div style="margin:10px 0;padding:8px;background:#f8d7da;border:1px solid #f5c2c7;border-radius:3px;color:#842029;font-size:14px;">⏰ 剩余封禁时间：<span id="countdown-' + e + '" style="font-weight:bold;color:#dc3545;">' + initialTime + '</span></div><div style="margin:10px 0;padding:8px;background:#e2e3e5;border:1px solid #d3d3d4;border-radius:3px;color:#495057;font-size:12px;">💡 封禁期间所有密码输入功能将被禁用</div>';
            
            // 启动倒计时
            setTimeout(function(){
                startCountdown(e, banStatus.until);
            }, 100);
        } else {
            var errCount = parseInt(localStorage.getItem("err_" + e) || "0");
            var remaining = 10 - errCount;
            var warningMsg = errCount > 0 ? '<div style="margin:10px 0;padding:8px;background:#fff3cd;border:1px solid #ffeaa7;border-radius:3px;color:#856404;font-size:14px;">⚠️ 已错误 <span style="color:#d63384;font-weight:bold;">' + errCount + '</span> 次，剩余 <span style="color:#198754;font-weight:bold;">' + remaining + '</span> 次机会</div>' : '';
            
            t.innerHTML='🔒 <strong style="color:#666">此内容已加密，请输入密码查看</strong><br><div style="margin:10px 0;padding:8px;background:#fff3cd;border:1px solid #ffeaa7;border-radius:3px;color:#856404;font-size:14px;">💡 <strong>提示：</strong>如需查看内部内容，请联系我获取访问密码</div>' + warningMsg + '<br><div style="display:inline-flex;align-items:center;margin:5px;"><input type="password" id="pwd-'+e+'" placeholder="请输入密码" style="padding:8px;border:1px solid #ccc;border-radius:3px 0 0 3px;width:200px;border-right:none;"><button id="toggle-'+e+'" onclick="togglePwd(\''+e+'\')" style="padding:8px;border:1px solid #ccc;border-radius:0 3px 3px 0;background:#f8f9fa;cursor:pointer;border-left:none;" title="显示密码">👁️</button></div><br><button onclick="unlkCnt(\''+e+"','"+n+'\')" style="padding:8px 15px;margin:10px 5px;background:#007cba;color:white;border:none;border-radius:3px;cursor:pointer">解锁内容</button>';
        }
        return t
    }
    
    // 简化的内容验证函数 - 检查HTML文档开头
    function t(e){
        if(!e || e.length < 10) return false;
        var trimmed = e.trim().toLowerCase();
        return trimmed.startsWith('<!doctype html>') || 
               trimmed.startsWith('<html>') ||
               trimmed.startsWith('<html ');
    }
    
    // 主处理函数
    function r(){
        var r=document.querySelector('meta[name="description"]');
        if(!r)return;
        var o=r.getAttribute("content"),c=/<!--encrypt:\s*([^>]+)-->\s*<!--([^>]+)-->\s*<!--\/encrypt-->/g,a=document.getElementById("postBody"),i=o,d,u=0,l=false;
        while((d=c.exec(o))!==null){
            u++;
            var s=d[1].trim(),f=d[2].trim(),g=localStorage.getItem("gmk_"+s);
            if(g){
                try{
                    var v=e(f,g),m=t(v);
                    if(m){
                        i=i.replace(d[0],v);
                        l=true
                    }else{
                        localStorage.removeItem("gmk_"+s);
                        var p=n(s,f);
                        i=i.replace(d[0],p.outerHTML)
                    }
                }catch(e){
                    localStorage.removeItem("gmk_"+s);
                    var p=n(s,f);
                    i=i.replace(d[0],p.outerHTML)
                }
            }else{
                var p=n(s,f);
                i=i.replace(d[0],p.outerHTML)
            }
        }
        if(l){
            i=i.replace(/遇到问题先自己解决。/g,'')
        }
        if(i!==o){
            if(window.marked)a.innerHTML=marked(i);
            else{
                var h=i.split(/<!--encrypt:[^>]+-->|<!--[^>]+-->|<!--\/encrypt-->/g).filter(function(e){return e.trim()}).join("");
                a.innerHTML=h
            }
        }
    }
    
    // 优化后的解锁函数（添加错误限制）
    window.unlkCnt=function(n,r){
        // 检查封禁状态
        var banStatus = checkBan(n);
        if(banStatus.banned){
            var timeLeft = formatTime(banStatus.seconds);
            alert("您已被封禁，请等待 " + timeLeft + " 后再试");
            return;
        }
        
        var o=document.getElementById("pwd-"+n).value;
        if(!o){
            alert("请输入密码");
            return
        }
        try{
            var c=e(r,o),a=t(c);
            if(a){
                // 密码正确，清除错误记录和定时器
                localStorage.removeItem("err_" + n);
                if(window["timer_" + n]){
                    clearInterval(window["timer_" + n]);
                    delete window["timer_" + n];
                }
                localStorage.setItem("gmk_"+n,o);
                location.reload()
            }else{
                // 密码错误，记录错误次数
                var errorResult = recordError(n);
                if(errorResult.banned){
                    alert("密码错误次数过多，您已被封禁10分钟！");
                    location.reload(); // 刷新显示封禁状态
                } else {
                    var remaining = 10 - errorResult.count;
                    alert("密码错误，还有 " + remaining + " 次机会");
                    location.reload(); // 刷新显示剩余次数
                }
            }
        }catch(e){
            // 解密异常也算密码错误
            var errorResult = recordError(n);
            if(errorResult.banned){
                alert("密码错误次数过多，您已被封禁10分钟！");
                location.reload();
            } else {
                var remaining = 10 - errorResult.count;
                alert("密码错误，还有 " + remaining + " 次机会");
                location.reload();
            }
        }
    };
    
    // 暴露给全局的密码显示切换函数
    window.togglePwd = togglePwd;
    
    // 页面卸载时清理定时器
    window.addEventListener('beforeunload', function(){
        for(var key in window){
            if(key.startsWith('timer_')){
                clearInterval(window[key]);
                delete window[key];
            }
        }
    });
    
    // 页面加载完成后执行
    document.addEventListener("DOMContentLoaded",function(){
        setTimeout(r,50)
    })
}();
