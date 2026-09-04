/**
 * Gmeek 文章加密插件
 * - 解密逻辑（异或 + deflate）与旧版完全一致，历史密码继续可用
 * - UI 为手绘涂鸦风（笔记本纸张 + 虚线描边 + 标记笔硬阴影），错误提示内联显示，不使用 alert / 刷新页面
 */
!function () {
    var MAX_ERRORS = 10;                 // 允许的最大错误次数
    var BAN_DURATION = 10 * 60 * 1000;   // 超出后的封禁时长

    // --- 解密（保持原实现，勿改动，否则旧密码将失效） ---
    function decrypt(payload, password) {
        try {
            var bin = atob(payload), bytes = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

            var keyBytes = new TextEncoder().encode(password), xored = new Uint8Array(bytes.length);
            for (var j = 0; j < bytes.length; j++) xored[j] = bytes[j] ^ keyBytes[j % keyBytes.length];

            if ("DecompressionStream" in window) {
                return new Response(
                    new Blob([xored]).stream().pipeThrough(new DecompressionStream("deflate"))
                ).arrayBuffer().then(function (buf) {
                    return new TextDecoder("utf-8").decode(new Uint8Array(buf));
                }).catch(function () {
                    var text = new TextDecoder("utf-8").decode(xored), out = "";
                    for (var k = 0; k < text.length; k++) {
                        out += String.fromCharCode(text.charCodeAt(k) ^ password.charCodeAt(k % password.length));
                    }
                    return out;
                });
            }

            var decoded = new TextDecoder("utf-8").decode(xored), result = "";
            for (var m = 0; m < decoded.length; m++) {
                result += String.fromCharCode(decoded.charCodeAt(m) ^ password.charCodeAt(m % password.length));
            }
            return result;
        } catch (err) {
            throw new Error("解密失败");
        }
    }

    // 校验解密结果是否像一段可用正文
    function looksLikeContent(html) {
        if (!html || html.length < 10) return false;
        var s = html.trim().toLowerCase();
        return ["<!doctype html>", "<html", "<div", "<p", "<h1", "<h2", "<ul", "<ol",
                "<blockquote", "<pre", "<article", "<section"].some(function (tag) {
            return s.indexOf(tag) === 0;
        });
    }

    // --- 错误次数 / 封禁状态 ---
    function readStore(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function writeStore(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* 隐私模式 */ } }
    function dropStore(key) { try { localStorage.removeItem(key); } catch (e) { /* 隐私模式 */ } }

    function checkBan(id) {
        var raw = readStore("ban_" + id);
        if (!raw) return { banned: false };
        try {
            var data = JSON.parse(raw), now = Date.now();
            if (now < data.until) {
                return { banned: true, seconds: Math.ceil((data.until - now) / 1000), until: data.until };
            }
        } catch (e) { /* 数据损坏，按未封禁处理 */ }
        dropStore("ban_" + id);
        dropStore("err_" + id);
        return { banned: false };
    }

    function errorCount(id) { return parseInt(readStore("err_" + id) || "0", 10) || 0; }

    function recordError(id) {
        var count = errorCount(id) + 1;
        writeStore("err_" + id, String(count));
        if (count >= MAX_ERRORS) {
            var until = Date.now() + BAN_DURATION;
            writeStore("ban_" + id, JSON.stringify({ until: until, count: count }));
            return { banned: true, count: count, until: until };
        }
        return { banned: false, count: count };
    }

    function formatTime(seconds) {
        var m = Math.floor(seconds / 60), s = seconds % 60;
        return m + "分" + (s < 10 ? "0" : "") + s + "秒";
    }

    // --- 样式（跟随 Primer 主题变量，站点换肤时自动一致） ---
    function injectStyles() {
        if (document.getElementById("kc-lock-style")) return;
        var style = document.createElement("style");
        style.id = "kc-lock-style";
        style.textContent = [
            /* 手绘涂鸦风：奶白纸张 #fffef5 / 墨黑 #2c2c2c / 标记笔 红#ff6b6b 蓝绿#4ecdc4 黄#ffd93d */
            ".kc-lock{position:relative;max-width:420px;margin:40px auto;padding:32px 28px;text-align:center;",
            "background:#fffef5;color:#2c2c2c;line-height:1.6;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;",
            "border:2px dashed #2c2c2c;border-radius:2px;box-shadow:4px 4px 0 #4ecdc4;",
            "transform:rotate(-0.6deg);transition:box-shadow .2s ease-in-out,transform .2s ease-in-out}",
            ".kc-lock:hover{box-shadow:6px 6px 0 #4ecdc4;transform:rotate(-0.6deg) translate(1px,1px)}",
            ".kc-lock::before{content:'';position:absolute;top:-13px;left:50%;width:96px;height:28px;",
            "transform:translateX(-50%) rotate(-2deg);background:rgba(255,217,61,0.7);",
            "box-shadow:1px 1px 0 rgba(44,44,44,0.15)}",
            ".kc-lock-icon{font-size:32px;line-height:1;margin-bottom:12px;display:inline-block;transform:rotate(-3deg)}",
            ".kc-lock-title{margin:0 0 8px;font-size:22px;font-weight:700;color:#2c2c2c;transform:rotate(-0.5deg)}",
            ".kc-lock-desc{margin:0 0 20px;font-size:14px;color:rgba(44,44,44,0.45)}",
            ".kc-lock-row{display:flex;justify-content:center;gap:8px;margin-bottom:14px}",
            ".kc-lock-input{flex:1;min-width:0;max-width:240px;padding:10px 12px;font-size:14px;font-family:inherit;",
            "color:#2c2c2c;background:#fffef5;border:2px dashed #2c2c2c;border-radius:2px;outline:none;",
            "transition:border-color .2s ease-in-out,box-shadow .2s ease-in-out}",
            ".kc-lock-input::placeholder{color:rgba(44,44,44,0.35)}",
            ".kc-lock-input:focus{border-color:#ff6b6b;box-shadow:2px 2px 0 #ffd93d}",
            ".kc-lock-eye{flex:none;width:44px;padding:0;font-size:15px;cursor:pointer;font-family:inherit;",
            "background:#fffef5;color:#2c2c2c;border:2px dashed #2c2c2c;border-radius:2px;box-shadow:2px 2px 0 #4ecdc4;",
            "transition:box-shadow .2s ease-in-out,transform .2s ease-in-out}",
            ".kc-lock-eye:hover{box-shadow:4px 4px 0 #ff6b6b;transform:translate(1px,1px)}",
            ".kc-lock-eye:active{transform:translate(2px,2px);box-shadow:none}",
            ".kc-lock-btn{display:block;width:100%;max-width:286px;margin:0 auto;padding:11px 16px;",
            "font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;",
            "color:#fffef5;background:#2c2c2c;border:2px dashed #2c2c2c;border-radius:2px;box-shadow:3px 3px 0 #ff6b6b;",
            "transition:box-shadow .2s ease-in-out,transform .2s ease-in-out}",
            ".kc-lock-btn:hover{box-shadow:5px 5px 0 #ff6b6b;transform:translate(1px,1px)}",
            ".kc-lock-btn:active{transform:translate(3px,3px) scale(0.98);box-shadow:none}",
            ".kc-lock-btn:disabled{opacity:0.55;cursor:not-allowed;transform:none;box-shadow:3px 3px 0 #ff6b6b}",
            ".kc-lock-msg{margin-top:14px;padding:8px 12px;font-size:13px;text-align:left;",
            "border:2px dashed;border-radius:2px}",
            ".kc-lock-msg-err{color:#c9403f;background:rgba(255,107,107,0.15);border-color:#ff6b6b}",
            ".kc-lock-msg-warn{color:#8a6d1a;background:rgba(255,217,61,0.2);border-color:#ffd93d}",
            ".kc-lock-countdown{font-weight:700}",
            ".kc-lock-banned{box-shadow:4px 4px 0 #ff6b6b}",
            "@media (prefers-reduced-motion: reduce){.kc-lock,.kc-lock-eye,.kc-lock-btn,.kc-lock-input{transition:none}}"
        ].join("");
        document.head.appendChild(style);
    }

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    // --- 封禁卡片 ---
    function buildBanCard(id, until) {
        var card = el("div", "kc-lock kc-lock-banned");
        card.appendChild(el("div", "kc-lock-icon", "🚫"));
        card.appendChild(el("h3", "kc-lock-title", "密码错误次数过多"));

        var msg = el("div", "kc-lock-msg kc-lock-msg-err");
        msg.appendChild(document.createTextNode("剩余封禁时间："));
        var countdown = el("strong", "kc-lock-countdown", formatTime(Math.ceil((until - Date.now()) / 1000)));
        msg.appendChild(countdown);
        card.appendChild(msg);
        card.appendChild(el("p", "kc-lock-desc", "封禁期间无法输入密码，请稍后再试。"));

        var timer = setInterval(function () {
            var left = Math.ceil((until - Date.now()) / 1000);
            if (left <= 0 || !card.isConnected) {
                clearInterval(timer);
                if (card.isConnected) render();   // 封禁结束，就地恢复输入框
                return;
            }
            countdown.textContent = formatTime(left);
        }, 1000);

        return card;
    }

    // --- 密码输入卡片 ---
    function buildLockCard(block) {
        var card = el("div", "kc-lock");
        card.appendChild(el("div", "kc-lock-icon", "🔒"));
        card.appendChild(el("h3", "kc-lock-title", "此内容已加密"));
        card.appendChild(el("p", "kc-lock-desc", "如需查看内部内容，请联系我获取访问密码"));

        var row = el("div", "kc-lock-row");
        var input = el("input", "kc-lock-input");
        input.type = "password";
        input.id = "pwd-" + block.id;
        input.placeholder = "请输入密码";
        input.autocomplete = "off";

        var eye = el("button", "kc-lock-eye", "👁️");
        eye.type = "button";
        eye.title = "显示密码";

        row.appendChild(input);
        row.appendChild(eye);
        card.appendChild(row);

        var submit = el("button", "kc-lock-btn", "解锁内容");
        submit.type = "button";
        card.appendChild(submit);

        var msg = el("div", "kc-lock-msg");
        msg.setAttribute("role", "alert");
        msg.hidden = true;
        card.appendChild(msg);

        function showMsg(text, kind) {
            msg.textContent = text;
            msg.className = "kc-lock-msg kc-lock-msg-" + (kind || "err");
            msg.hidden = false;
        }

        // 进入页面时若已有错误记录，先提示剩余机会
        var already = errorCount(block.id);
        if (already > 0) {
            showMsg("已错误 " + already + " 次，剩余 " + (MAX_ERRORS - already) + " 次机会", "warn");
        }

        eye.addEventListener("click", function () {
            var toText = input.type === "password";
            input.type = toText ? "text" : "password";
            eye.textContent = toText ? "🙈" : "👁️";
            eye.title = toText ? "隐藏密码" : "显示密码";
            input.focus();
        });

        function attempt() {
            if (checkBan(block.id).banned) { render(); return; }

            var password = input.value;
            if (!password) {
                showMsg("请输入密码", "warn");
                input.focus();
                return;
            }

            submit.disabled = true;
            submit.textContent = "解锁中…";

            Promise.resolve()
                .then(function () { return decrypt(block.encrypted, password); })
                .then(function (html) {
                    if (!looksLikeContent(html)) throw new Error("密码错误");
                    writeStore("gmk_" + block.id, password);
                    dropStore("err_" + block.id);
                    reveal(html);                       // 就地展开，无需刷新页面
                })
                .catch(function () {
                    var result = recordError(block.id);
                    submit.disabled = false;
                    submit.textContent = "解锁内容";
                    if (result.banned) {
                        render();                        // 切换为封禁卡片
                        return;
                    }
                    showMsg("密码错误，还有 " + (MAX_ERRORS - result.count) + " 次机会", "err");
                    input.value = "";
                    input.focus();
                });
        }

        submit.addEventListener("click", attempt);
        input.addEventListener("keydown", function (ev) {
            if (ev.key === "Enter") { ev.preventDefault(); attempt(); }
        });

        return card;
    }

    // 把解密后的正文写入页面，并让懒加载插件接管其中的图片
    function reveal(html) {
        var body = document.getElementById("postBody");
        if (!body) return;
        body.innerHTML = html;
        if (window.TriumphLazyLoad && typeof window.TriumphLazyLoad.processContainer === "function") {
            try { window.TriumphLazyLoad.processContainer(body); } catch (e) { /* 忽略 */ }
        }
    }

    function showCard(card) {
        var body = document.getElementById("postBody");
        if (!body) return;
        body.innerHTML = "";
        body.appendChild(card);
    }

    function extractEncryptedBlocks(source) {
        var reg = /<!--encrypt:\s*([a-zA-Z0-9_-]+)-->\s*<!--([\s\S]*?)-->\s*<!--\/encrypt-->/g;
        var list = [], m;
        while ((m = reg.exec(source)) !== null) {
            list.push({ raw: m[0], id: m[1].trim(), encrypted: m[2].trim() });
        }
        return list;
    }

    function findBlocks() {
        var sources = [];
        var meta = document.querySelector('meta[name="description"]');
        if (meta) sources.push(meta.getAttribute("content") || "");
        sources.push(document.documentElement ? document.documentElement.innerHTML : "");

        for (var i = 0; i < sources.length; i++) {
            var found = extractEncryptedBlocks(sources[i]);
            if (found.length) return found;
        }
        return [];
    }

    function render() {
        if (!document.getElementById("postBody")) return;

        var blocks = findBlocks();
        if (!blocks.length) return;

        injectStyles();
        var block = blocks[0];

        var ban = checkBan(block.id);
        if (ban.banned) { showCard(buildBanCard(block.id, ban.until)); return; }

        var saved = readStore("gmk_" + block.id);
        if (!saved) { showCard(buildLockCard(block)); return; }

        Promise.resolve()
            .then(function () { return decrypt(block.encrypted, saved); })
            .then(function (html) {
                if (!looksLikeContent(html)) throw new Error("密码已失效");
                reveal(html);
            })
            .catch(function () {
                dropStore("gmk_" + block.id);
                showCard(buildLockCard(block));
            });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () { setTimeout(render, 50); });
    } else {
        setTimeout(render, 50);
    }
}();
