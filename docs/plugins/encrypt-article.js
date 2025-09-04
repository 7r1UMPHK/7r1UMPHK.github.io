// encrypt-article.js - Gmeek博客文章加密插件
(function() {
    'use strict';
    
    // 配置参数
    const config = {
        placeholder: '此文章已加密，请输入密码查看',
        btnTxt: '解锁文章',
        errMsg: '密码错误',
        storageKey: 'gmeek_unlock_'
    };
    
    // 简单加密/解密函数 (实用性优先)
    function encryptTxt(txt, pwd) {
        let result = '';
        for(let i = 0; i < txt.length; i++) {
            result += String.fromCharCode(txt.charCodeAt(i) ^ pwd.charCodeAt(i % pwd.length));
        }
        return btoa(result); // Base64编码
    }
    
    function decryptTxt(encTxt, pwd) {
        try {
            const txt = atob(encTxt);
            let result = '';
            for(let i = 0; i < txt.length; i++) {
                result += String.fromCharCode(txt.charCodeAt(i) ^ pwd.charCodeAt(i % pwd.length));
            }
            return result;
        } catch(e) {
            return null;
        }
    }
    
    // 检查是否已解锁
    function isUnlocked(postId) {
        return localStorage.getItem(config.storageKey + postId) === 'true';
    }
    
    // 设置解锁状态
    function setUnlocked(postId) {
        localStorage.setItem(config.storageKey + postId, 'true');
    }
    
    // 创建密码输入界面
    function createPwdForm(postId, encContent) {
        return `
            <div class="encrypt-container" style="
                text-align: center; 
                padding: 40px 20px; 
                border: 2px dashed #ddd; 
                border-radius: 8px; 
                background: #f9f9f9;
                margin: 20px 0;
            ">
                <div style="font-size: 16px; color: #666; margin-bottom: 20px;">
                    🔒 ${config.placeholder}
                </div>
                <div>
                    <input type="password" id="pwd-${postId}" placeholder="请输入密码" style="
                        padding: 8px 12px; 
                        border: 1px solid #ccc; 
                        border-radius: 4px; 
                        margin-right: 10px;
                        width: 200px;
                    " />
                    <button onclick="unlockArticle('${postId}', '${encContent}')" style="
                        padding: 8px 16px; 
                        background: #007cba; 
                        color: white; 
                        border: none; 
                        border-radius: 4px; 
                        cursor: pointer;
                    ">${config.btnTxt}</button>
                </div>
                <div id="err-${postId}" style="color: #e74c3c; margin-top: 10px; font-size: 14px;"></div>
            </div>
        `;
    }
    
    // 解锁文章函数
    window.unlockArticle = function(postId, encContent) {
        const pwd = document.getElementById(`pwd-${postId}`).value;
        const errDiv = document.getElementById(`err-${postId}`);
        
        if (!pwd) {
            errDiv.textContent = '请输入密码';
            return;
        }
        
        const decContent = decryptTxt(encContent, pwd);
        if (decContent) {
            const container = document.querySelector('.encrypt-container');
            container.outerHTML = decContent;
            setUnlocked(postId);
            errDiv.textContent = '';
        } else {
            errDiv.textContent = config.errMsg;
            document.getElementById(`pwd-${postId}`).value = '';
        }
    };
    
    // 主处理函数
    function processEncryptedPost() {
        const contentDiv = document.querySelector('.markdown-body, .post-content, article');
        if (!contentDiv) return;
        
        const encComment = contentDiv.querySelector('<!--encrypt:');
        if (!encComment) return;
        
        // 提取加密信息
        const commentTxt = encComment.textContent || encComment.nodeValue;
        const match = commentTxt.match(/<!--encrypt:\s*(\w+)\s*-->/);
        if (!match) return;
        
        const postId = match[1];
        
        // 检查是否已解锁
        if (isUnlocked(postId)) {
            return; // 已解锁，不处理
        }
        
        // 查找加密内容
        let encContent = '';
        let nextNode = encComment.nextSibling;
        while (nextNode && !nextNode.textContent?.includes('<!--/encrypt-->')) {
            if (nextNode.nodeType === 8) { // 注释节点
                encContent += nextNode.textContent;
            }
            nextNode = nextNode.nextSibling;
        }
        
        // 替换内容为密码输入框
        if (encContent) {
            const range = document.createRange();
            range.setStartAfter(encComment);
            if (nextNode) range.setStartBefore(nextNode);
            range.deleteContents();
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = createPwdForm(postId, encContent.trim());
            range.insertNode(tempDiv.firstElementChild);
        }
    }
    
    // 页面加载完成后处理
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', processEncryptedPost);
    } else {
        processEncryptedPost();
    }
})();
