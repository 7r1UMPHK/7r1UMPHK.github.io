!function(){
    function decrypt(encData, pwd) {
        try {
            var decoded = atob(encData);
            var bytes = [];
            for (var i = 0; i < decoded.length; i++) {
                bytes.push(decoded.charCodeAt(i));
            }
            var utf8Text = new TextDecoder("utf-8").decode(new Uint8Array(bytes));
            var result = "";
            for (var i = 0; i < utf8Text.length; i++) {
                var decChar = utf8Text.charCodeAt(i) ^ pwd.charCodeAt(i % pwd.length);
                result += String.fromCharCode(decChar);
            }
            return result;
        } catch(e) {
            throw new Error("解密失败");
        }
    }
    
    function validateContent(content) {
        try {
            var testJson = JSON.parse(content);
            return typeof testJson === "object" && testJson !== null;
        } catch(e) {
            return false;
        }
    }
    
    function isValidDecrypted(content) {
        if (!content || content.length < 3) return false;
        
        // 检查是否包含有效内容特征
        return (content.includes("#") || 
                content.includes("*") || 
                content.includes("`") || 
                content.includes("\n") || 
                content.length > 10) && 
               !/[\x00-\x08\x0E-\x1F\x7F-\x9F]/.test(content);
    }
    
    function createPasswordBox(id, encData) {
        var box = document.createElement("div");
        box.style.cssText = "border:1px solid #ddd;padding:20px;margin:10px 0;border-radius:5px;background:#f9f9f9;text-align:center";
        box.innerHTML = '🔒 <strong style="color:#666">此内容已加密，请输入密码查看</strong><br>' +
                       '<div style="margin:10px 0;padding:8px;background:#fff3cd;border:1px solid #ffeaa7;border-radius:3px;color:#856404;font-size:14px;">' +
                       '💡 <strong>提示：</strong>如需查看内部内容，请联系我获取访问密码</div><br>' +
                       '<input type="password" id="pwd-' + id + '" placeholder="请输入密码" ' +
                       'style="padding:8px;margin:5px;border:1px solid #ccc;border-radius:3px;width:200px" ' +
                       'onkeypress="if(event.key===\'Enter\') unlockContent(\'' + id + '\',\'' + encData + '\')">' +
                       '<br><button onclick="unlockContent(\'' + id + '\',\'' + encData + '\')" ' +
                       'style="padding:8px 15px;margin:10px 5px;background:#007cba;color:white;border:none;border-radius:3px;cursor:pointer">解锁内容</button>';
        return box;
    }
    
    function processEncryptedContent() {
        // 从多个可能的位置查找加密内容
        var contentSources = [
            document.querySelector('meta[name="description"]')?.getAttribute("content"),
            document.querySelector('meta[property="og:description"]')?.getAttribute("content"),
            document.documentElement.innerHTML
        ];
        
        var originalContent = null;
        var contentSource = null;
        
        // 找到包含加密内容的源
        for (var i = 0; i < contentSources.length; i++) {
            if (contentSources[i] && contentSources[i].includes("<!--encrypt:")) {
                originalContent = contentSources[i];
                contentSource = i;
                break;
            }
        }
        
        if (!originalContent) return;
        
        var encryptPattern = /<!--encrypt:\s*([^>]+)-->\s*<!--([^>]+)-->\s*<!--\/encrypt-->/g;
        var postBody = document.getElementById("postBody");
        var newContent = originalContent;
        var hasChanges = false;
        var match;
        
        // 重置正则表达式的 lastIndex
        encryptPattern.lastIndex = 0;
        
        while ((match = encryptPattern.exec(originalContent)) !== null) {
            var id = match[1].trim();
            var encData = match[2].trim();
            var savedPassword = localStorage.getItem("decrypt_pwd_" + id);
            
            console.log("找到加密内容 ID:", id, "数据:", encData.substring(0, 20) + "...");
            
            if (savedPassword) {
                try {
                    var decryptedContent = decrypt(encData, savedPassword);
                    console.log("尝试解密，结果长度:", decryptedContent.length);
                    
                    if (isValidDecrypted(decryptedContent)) {
                        console.log("解密成功，替换内容");
                        newContent = newContent.replace(match[0], decryptedContent);
                        hasChanges = true;
                        continue;
                    } else {
                        console.log("解密结果无效，清除保存的密码");
                        localStorage.removeItem("decrypt_pwd_" + id);
                    }
                } catch(e) {
                    console.log("解密失败:", e.message);
                    localStorage.removeItem("decrypt_pwd_" + id);
                }
            }
            
            // 创建密码输入框
            var passwordBox = createPasswordBox(id, encData);
            newContent = newContent.replace(match[0], passwordBox.outerHTML);
            hasChanges = true;
        }
        
        // 更新页面内容
        if (hasChanges && postBody) {
            // 提取实际的内容部分（移除脚本标签等）
            var cleanContent = newContent
                .replace(/<!-- ##\{[^}]+\}## -->/g, '')  // 移除脚本标记
                .replace(/遇到问题先自己尝试解决.*$/g, ''); // 移除尾部文字
            
            // 如果页面支持 Markdown 渲染
            if (window.marked) {
                postBody.innerHTML = marked(cleanContent);
            } else {
                // 简单的文本处理
                postBody.innerHTML = cleanContent
                    .replace(/\n\n/g, '</p><p>')
                    .replace(/\n/g, '<br>')
                    .replace(/^/, '<p>')
                    .replace(/$/, '</p>');
            }
            
            console.log("页面内容已更新");
        }
    }
    
    // 全局解锁函数
    window.unlockContent = function(id, encData) {
        var passwordInput = document.getElementById("pwd-" + id);
        var password = passwordInput.value.trim();
        
        if (!password) {
            alert("请输入密码");
            passwordInput.focus();
            return;
        }
        
        try {
            var decryptedContent = decrypt(encData, password);
            console.log("解密尝试，结果长度:", decryptedContent.length);
            console.log("解密结果预览:", decryptedContent.substring(0, 50));
            
            if (isValidDecrypted(decryptedContent)) {
                localStorage.setItem("decrypt_pwd_" + id, password);
                passwordInput.style.backgroundColor = "#d4edda";
                setTimeout(function() {
                    location.reload();
                }, 500);
            } else {
                throw new Error("密码错误");
            }
        } catch(e) {
            console.log("解锁失败:", e.message);
            passwordInput.style.backgroundColor = "#f8d7da";
            passwordInput.value = "";
            setTimeout(function() {
                passwordInput.style.backgroundColor = "white";
            }, 1000);
            alert("密码错误，请重试");
            passwordInput.focus();
        }
    };
    
    // 页面加载完成后执行
    document.addEventListener("DOMContentLoaded", function() {
        console.log("开始处理加密内容");
        setTimeout(processEncryptedContent, 100);
    });
    
    // 如果 DOMContentLoaded 已经触发，立即执行
    if (document.readyState === "complete" || document.readyState === "interactive") {
        console.log("DOM已准备就绪，立即处理");
        setTimeout(processEncryptedContent, 50);
    }
}();
