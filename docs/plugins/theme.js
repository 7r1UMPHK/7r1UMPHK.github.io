function runTheme() {
    // --- 配置 ---

    // 样式配置对象
    const styleConfig = {
        // 通用样式（适用于所有页面）
        common: {
            'html': `
                background: url('https://7r1UMPHK.github.io/image/20250320210716585.webp') no-repeat center center fixed;
                background-size: cover;
            `,
            // 页面主体样式
            'body': `
                min-width: 200px;  // 最小宽度限制
                max-width: 885px;  // 最大内容宽度
                margin: 65px auto 65px; // 为顶部固定文字导航留出空间
                font-size: 20px;
                line-height: 1.6;
                background: rgba(250, 250, 250, 0.92);
                border-radius: 16px;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
                overflow: auto;
                transition: all 0.3s ease;
                position: relative;
                z-index: 1;
            `,
            '.container-lg': `
                background-color: rgba(255, 255, 255, 0.95);
                border-radius: 8px;
                padding: 20px;
                margin-top: 20px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            `,
             '.Header': `
                background-color: rgba(255, 255, 255, 0.95) !important;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            `,
            '.title-right': `
                display: none !important;
            `,
            '#kc-top-nav-root': `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 9999;
                padding: 15px 10px;
                background: rgba(36, 52, 72, 0.78);
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                box-shadow: none !important;
                transition: none !important;
            `,
            '#kc-top-nav-root .kc-top-nav-inner': `
                width: 100%;
                max-width: none;
                margin: 0 auto;
                display: flex;
                align-items: center;
                justify-content: flex-start;
                gap: 0;
            `,
            '#kc-top-nav-root .kc-brand': `
                color: #ffffff;
                font-size: 22px;
                font-weight: 600;
                text-decoration: none !important;
                line-height: 1.2;
                white-space: nowrap;
                margin-right: auto;
                margin-left: 340px;
                user-select: none;
                outline: none !important;
                box-shadow: none !important;
                -webkit-tap-highlight-color: transparent;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            `,
            '#kc-top-nav-root .kc-brand img': `
                height: 1em;
                width: auto;
                display: block;
            `,
            '#kc-top-nav-root .kc-brand:focus, #kc-top-nav-root .kc-brand:focus-visible, #kc-top-nav-root .kc-brand:active': `
                outline: none !important;
                box-shadow: none !important;
                text-decoration: none !important;
            `,
            '#kc-top-nav-root .kc-links': `
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                justify-content: flex-end;
                gap: 25px;
                margin-left: auto;
                margin-right: 180px;
                text-align: center;
            `,
            '#kc-top-nav-root .kc-link': `
                color: rgba(255, 255, 255, 0.94) !important;
                font-size: 17px;
                font-weight: 500;
                text-decoration: none !important;
                line-height: 1.2;
                outline: none !important;
                box-shadow: none !important;
                -webkit-tap-highlight-color: transparent;
            `,
            '#kc-top-nav-root .kc-link:hover, #kc-top-nav-root .kc-link:active': `
                color: #8ec5ff !important;
                text-decoration: none !important;
            `,
            '#kc-top-nav-root .kc-link:focus, #kc-top-nav-root .kc-link:focus-visible, #kc-top-nav-root .kc-link:active': `
                outline: none !important;
                box-shadow: none !important;
                text-decoration: none !important;
            `,
            '#kc-top-nav-root .kc-link-search': `
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: #ffffff !important;
            `,
            '#kc-top-nav-root .kc-link-search:hover, #kc-top-nav-root .kc-link-search:active': `
                color: #ffffff !important;
            `,
            '#kc-top-nav-root .kc-link-search svg': `
                width: 18px;
                height: 18px;
                display: block;
                stroke: #ffffff;
            `,
            // 侧边导航栏样式
            '.SideNav': `
                background: rgba(255, 255, 255, 0.75); // 半透明白色背景
                border-radius: 12px; // 圆角效果
                min-width: unset;    // 重置最小宽度
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.18);
                overflow: hidden;
                margin-bottom: 24px;
            `,
            '.SideNav-item': `
                transition: all 0.2s ease-in-out;
                margin: 5px 8px;
                border-radius: 8px;
                overflow: hidden;
            `,
            '.SideNav-item:hover': `
                background-color: rgba(195, 228, 227, 0.5);
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
            `,
            // 标签样式
            '.Label, .btn': `
                backdrop-filter: blur(2px);
                -webkit-backdrop-filter: blur(2px);
            `,
            '.Label:hover': `
                transform: scale(1.05);
                box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
            `,
            // 特殊文本块样式
            'div[style*="margin-bottom: 16px"]': `
                font-family:
                    '华文行楷',          /* Windows楷体 */
                    'STKaiti',           /* macOS楷体 */
                    'Noto Serif CJK SC', /* Linux楷体替代 */
                    'WenQuanYi Micro Hei',
                    serif;               /* 备用字体 */
                font-size: 1.4em;
                color: rgb(0, 0, 0);
                text-shadow:
                    2px 2px 4px rgba(107, 70, 70, 0.2),
                    -1px -1px 1px rgba(255, 255, 255, 0.5);
                letter-spacing: 0.1em;
                line-height: 1.8;
                margin-bottom: 16px !important;
                background: rgba(255, 255, 255, 0.5);
                padding: 16px;
                border-radius: 12px;
                border-left: 4px solid #0366d6;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
            `,
            // 链接样式美化
            'a': `
                transition: all 0.2s ease;
                text-decoration: none;
            `,
            'a:hover': `
                text-decoration: underline;
                text-decoration-thickness: 2px;
                text-underline-offset: 2px;
                color: #0969da;
            `,
            // 美化页脚
            '#footer': `
                padding: 20px 0;
                opacity: 0.8;
                transition: opacity 0.3s ease;
                font-size: 14px;
                border-top: 1px solid rgba(0, 0, 0, 0.05);
                margin-top: 40px;
            `,
            '#footer:hover': `
                opacity: 1;
            `,
            '#footer a': `
                color: #0366d6;
                font-weight: 500;
            `
        },
        // 首页专属样式
        home: {
            '#header': `
                position: relative;
                height: 300px; // 头部区域高度
                margin-bottom: 30px;
            `,
            '.title-left': `
                position: absolute;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                flex-direction: column;
                align-items: center;
            `,
            '.avatar': `
                width: 160px;
                height: 160px;
                border-radius: 50%;
                object-fit: cover;
                border: 5px solid rgba(255, 255, 255, 0.7);
                box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
                transition: all 0.3s ease;
            `,
            '.avatar:hover': `
                transform: scale(1.05) rotate(5deg);
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
            `,
            '#header .blogTitle': `
                margin-top: 30px !important;
                font-family: fantasy !important;
                margin-left: unset !important;
                font-size: 42px !important;
                font-weight: normal !important;
                background: linear-gradient(45deg, #0366d6, #8250df) !important;
                -webkit-background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
                text-shadow: 0 2px 5px rgba(0, 0, 0, 0.1) !important;
            `
        },
        // 标签/搜索页专属样式（覆盖 common 里对 .title-right 的隐藏）
        tag: {
            'body': `
                margin: 65px auto 65px !important;
            `,
            '.title-right': `
                display: flex !important;
            `
        },
        // 文章页专属样式
        article: {
            'body': `
                max-width: 1000px;
                margin: 65px auto 65px;
                font-size: 16px;
                line-height: 1.25;
                background: rgba(250, 250, 250, 0.92);
                border-radius: 16px;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
                overflow: auto;
                padding: 30px;
            `,
            'body .markdown-body': `
                 font-size: 18px !important;
                line-height: 1.6 !important;
                color: #24292f;
            `,
            // 文章标题样式（h1-h6）
            // 'body .markdown-body h1, body .markdown-body h2, body .markdown-body h3, body .markdown-body h4, body .markdown-body h5, body .markdown-body h6, h1.postTitle': `
            //     font-family: '华文新魏', 'STKaiti', 'Noto Serif CJK SC', 'WenQuanYi Micro Hei', cursive, sans-serif !important;
            //     margin-top: 1.5em !important;
            //     margin-bottom: 0.8em !important;
            //     font-weight: 600 !important;
            //     color: #24292f;
            //     border-bottom: 1px solid rgba(0, 0, 0, 0.1);
            //     padding-bottom: 0.3em;
            // `,
            // 代码块美化
            'body .markdown-body pre': `
                border-radius: 8px;
                margin: 16px 0;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
                position: relative !important; /* 为绝对定位的复制按钮提供定位上下文 */
                padding-right: 40px !important; /* 为复制按钮预留空间 */
            `,
            // 复制按钮修复
            '.snippet-clipboard-content': `
                position: relative !important;
                overflow: visible !important;
            `,
            '.clipboard-container': `
                position: absolute !important;
                top: 5px !important;
                right: 5px !important;
                z-index: 10 !important;
            `,
            '.ClipboardButton': `
                background-color: rgba(255, 255, 255, 0.8) !important;
                border: 1px solid rgba(0, 0, 0, 0.1) !important;
                border-radius: 4px !important;
                padding: 4px !important;
                margin: 4px !important;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            `,
            // 文章内容段落
            'body .markdown-body p': `
                margin-bottom: 1em;
                text-align: justify;
            `,
            // 文章中的图片
            'body .markdown-body img': `
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                transition: all 0.3s ease;
                display: block;
                margin: 20px auto;
                max-width: 100%;
            `,
            'body .markdown-body img:hover': `
                transform: scale(1.02);
            `,
            // 表格样式
            'body .markdown-body table': `
                border-collapse: separate;
                border-spacing: 0;
                width: 100%;
                margin: 16px 0;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
            `,
            'body .markdown-body table th, body .markdown-body table td': `
                padding: 12px 16px;
                border: 1px solid #e1e4e8;
            `,
            'body .markdown-body table tr:nth-child(2n)': `
                background-color: rgba(246, 248, 250, 0.7);
            `,
            // 文章页面标题
            '.postTitle': `
                margin-bottom: 24px !important;
                font-size: 2.2em !important;
                letter-spacing: -0.5px;
                line-height: 1.3;
                border-bottom: none !important;
                padding-bottom: 0 !important;
            `,
            // 评论按钮美化
            '#cmButton': `
                border-radius: 8px;
                font-size: 16px;
                transition: all 0.3s ease;
                background-color: #0366d6;
                border-color: #0366d6;
                box-shadow: 0 2px 6px rgba(3, 102, 214, 0.3);
            `,
            '#cmButton:hover': `
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(3, 102, 214, 0.4);
                background-color: #0969da;
                border-color: #0969da;
            `
        },
        // 分页页样式
        page: {}
    };

    // --- 辅助函数 ---

    // 检测是否为桌面设备（宽度≥768px）
    const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;

    // 生成CSS字符串的函数
    const generateCSS = (styles) => {
        return Object.entries(styles)
            .map(([selector, rules]) => {
                // 格式化CSS规则：去除空格并确保以分号结尾
                const formattedRules = rules.trim().endsWith(';')
                    ? rules.trim()
                    : `${rules.trim()};`;
                return `${selector} { ${formattedRules} }`;
            })
            .join('\n');
    };

    // 检测当前页面类型（首页/文章/分页）
    const getPageType = () => {
        const currentPath = window.location.pathname;
        const routePatterns = [
            { type: 'home', pattern: /^(\/|\/index\.html)$/ },    // 首页路由
            { type: 'tag', pattern: /\/tag\.html$/ },              // 搜索页路由
            { type: 'article', pattern: /(\/post\/|link\.html|about\.html)/ }, // 文章路由
            { type: 'page', pattern: /\/page\d+\.html$/ }          // 分页路由
        ];
        return routePatterns.find(p => p.pattern.test(currentPath))?.type;
    };

    // --- 页脚增强：总字数统计 + 安全运行时长 ---
    let runtimeTimer = null;

    const getOrCreateFooterLine = (id, anchorId, position = 'before') => {
        const footer = document.getElementById('footer');
        const anchor = document.getElementById(anchorId);
        if (!footer || !anchor) return null;

        let line = document.getElementById(id);
        if (!line) {
            line = document.createElement('div');
            line.id = id;
            line.style.fontSize = 'small';
            line.style.opacity = '0.9';
            line.style.margin = '4px 0';

            if (position === 'before') {
                footer.insertBefore(line, anchor);
            } else {
                anchor.insertAdjacentElement('afterend', line);
            }
        }
        return line;
    };

    const formatDuration = (ms) => {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${days}天 ${String(hours).padStart(2, '0')}小时 ${String(minutes).padStart(2, '0')}分 ${String(seconds).padStart(2, '0')}秒`;
    };

    const initSafeRuntimeCounter = () => {
        const runtimeLine = getOrCreateFooterLine('kc-footer-runtime', 'footer2', 'after');
        if (!runtimeLine) return;

        const siteSafeStart = new Date('2025-01-29T00:00:00+08:00').getTime();

        const update = () => {
            runtimeLine.textContent = `本站已安全运行：${formatDuration(Date.now() - siteSafeStart)}`;
        };

        update();
        if (runtimeTimer) {
            clearInterval(runtimeTimer);
        }
        runtimeTimer = setInterval(update, 1000);
    };

    // 站点统计数据（构建时由 Gmeek.yml 生成，仅几十字节）
    // 说明：旧实现从 /rss.xml 的 <description> 累加字数，但 blogBase.json 中
    // rssSplit 为 "sentence"，description 只含每篇文章的首句，因此统计值严重偏低，
    // 且新增文章几乎不会让数字变化。现改用 Gmeek 自身计算的 wordCount 汇总值。
    let siteMetaPromise = null;
    const fetchSiteMeta = () => {
        if (!siteMetaPromise) {
            siteMetaPromise = fetch(`${window.location.origin}/wordcount.json`, { cache: 'no-store' })
                .then((resp) => {
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    return resp.json();
                });
        }
        return siteMetaPromise;
    };

    const initTotalWordCount = async () => {
        const wordLine = getOrCreateFooterLine('kc-footer-wordcount', 'footer1', 'before');
        if (!wordLine) return;

        const cacheKey = 'kc-footer-total-words-v2';
        const render = (count) => {
            const k = (count / 1000).toFixed(1);
            wordLine.textContent = `全站累计约 ${k}k 字（≈${count.toLocaleString()} 字）`;
        };

        // 清理旧版基于 RSS 的缓存（数值不准，且带 24h TTL 会长期冻结显示）
        try {
            localStorage.removeItem('kc-footer-total-words-v1');
        } catch (e) { /* 忽略：隐私模式下 localStorage 可能不可用 */ }

        // 先用上次结果占位避免闪烁，随后始终联网校正（文件极小，无需 TTL 缓存）
        let shown = false;
        try {
            const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
            if (cached && Number.isFinite(cached.count)) {
                render(cached.count);
                shown = true;
            }
        } catch (e) {
            console.warn('读取总字数缓存失败：', e);
        }
        if (!shown) wordLine.textContent = '全站总字数统计中...';

        try {
            const meta = await fetchSiteMeta();
            const total = Number(meta && meta.total);
            if (!Number.isFinite(total) || total <= 0) throw new Error('invalid total');

            render(total);
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ count: total }));
            } catch (e) {
                console.warn('写入总字数缓存失败：', e);
            }
        } catch (err) {
            console.error('统计全站总字数失败：', err);
            if (!shown) wordLine.textContent = '全站累计字数：统计失败';
        }
    };

    // --- 列表分页：在原有「上一页/下一页」之间补出页码，支持快速跳转 ---
    const getCurrentPageNum = () => {
        const m = window.location.pathname.match(/\/page(\d+)\.html$/);
        return m ? Math.max(1, parseInt(m[1], 10)) : 1;
    };

    const pageHref = (n) => `${window.location.origin}/${n <= 1 ? 'index.html' : `page${n}.html`}`;

    // 生成要展示的页码序列，0 表示省略号：始终含首尾页与当前页 ±2
    const buildPageSequence = (current, total) => {
        const wanted = new Set([1, total, current]);
        for (let d = 1; d <= 2; d++) {
            if (current - d >= 1) wanted.add(current - d);
            if (current + d <= total) wanted.add(current + d);
        }
        const nums = Array.from(wanted).sort((a, b) => a - b);
        const out = [];
        nums.forEach((n, i) => {
            if (i > 0 && n - nums[i - 1] > 1) out.push(0);
            out.push(n);
        });
        return out;
    };

    const initPagination = async () => {
        const box = document.querySelector('.paginate-container .pagination');
        if (!box) return;
        // 同步占位再 await，否则两次并发调用会双双通过检查并重复注入页码
        if (box.dataset.kcPaged) return;
        box.dataset.kcPaged = '1';

        let total;
        try {
            const meta = await fetchSiteMeta();
            total = Number(meta && meta.totalPages);
        } catch (err) {
            console.error('读取分页信息失败：', err);
            return;
        }
        if (!Number.isFinite(total) || total < 2) return;

        const current = Math.min(getCurrentPageNum(), total);
        const prev = box.querySelector('.previous_page');
        const next = box.querySelector('.next_page');
        const frag = document.createDocumentFragment();

        buildPageSequence(current, total).forEach((n) => {
            if (n === 0) {
                const gap = document.createElement('span');
                gap.className = 'gap';
                gap.setAttribute('data-kc-page', 'gap');
                gap.textContent = '…';
                frag.appendChild(gap);
                return;
            }
            if (n === current) {
                const em = document.createElement('em');
                em.className = 'current';
                em.setAttribute('data-kc-page', String(n));
                em.setAttribute('aria-current', 'page');
                em.textContent = String(n);
                frag.appendChild(em);
                return;
            }
            const a = document.createElement('a');
            a.href = pageHref(n);
            a.setAttribute('data-kc-page', String(n));
            a.setAttribute('aria-label', `第 ${n} 页`);
            a.textContent = String(n);
            frag.appendChild(a);
        });

        // 插到「下一页」之前；若无「下一页」（末页）则追加到末尾
        if (next) {
            box.insertBefore(frag, next);
        } else {
            box.appendChild(frag);
        }
        // 保证「上一页」始终在最前
        if (prev && box.firstChild !== prev) box.insertBefore(prev, box.firstChild);
    };

    const initFooterEnhancements = () => {
        initSafeRuntimeCounter();
        initTotalWordCount();
    };

    // 顶部文字导航（插入到 <body> 外，位于页面最顶部）
    const removeTopNav = () => {
        const old = document.getElementById('kc-top-nav-root');
        if (old) old.remove();
    };

    const injectTopNav = () => {
        if (!isDesktop()) return;
        if (document.getElementById('kc-top-nav-root')) return;

        const root = document.createElement('div');
        root.id = 'kc-top-nav-root';
        root.innerHTML = `
            <div class="kc-top-nav-inner">
                <a href="https://7r1UMPHK.github.io/" class="kc-brand">
                    <img src="https://7r1UMPHK.github.io/image/20250320200557660.ico" alt="logo">
                    <span>TriumphK’s Blog</span>
                </a>
                <nav class="kc-links" aria-label="顶部导航">
                    <a href="https://7r1UMPHK.github.io/" class="kc-link">首页</a>
                    <a href="https://7r1UMPHK.github.io/link.html" class="kc-link">友链</a>
                    <a href="https://7r1UMPHK.github.io/about.html" class="kc-link">关于</a>
                    <a href="https://7r1UMPHK.github.io/tag.html" class="kc-link kc-link-search" aria-label="搜索">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle cx="11" cy="11" r="7" stroke-width="2"></circle>
                            <line x1="16.65" y1="16.65" x2="21" y2="21" stroke-width="2" stroke-linecap="round"></line>
                        </svg>
                    </a>
                </nav>
            </div>
        `;
        document.documentElement.insertBefore(root, document.body);
    };

    // 应用样式的核心函数
    const applyStyles = () => {
        // 如果不是桌面设备，恢复默认显示
        if (!isDesktop()) {
            removeTopNav();
            console.log('当前为不是桌面设备，使用默认样式');
            return;
        }

        const pageType = getPageType();
        console.log(`当前页面类型: ${pageType || '通用'}`);
        
        // 合并通用样式和页面专属样式
        let mergedStyles = { ...styleConfig.common };
        if (pageType && styleConfig[pageType]) {
            mergedStyles = { ...mergedStyles, ...styleConfig[pageType] };
        }

        // 创建并插入样式标签
        const cssString = generateCSS(mergedStyles);
        if (cssString) {
            // 给动态样式标签添加一个特定属性，以便在resize时区分
            const styleTag = document.createElement('style');
            styleTag.setAttribute('data-dynamic-theme-style', 'true');
            styleTag.textContent = cssString;
            document.head.appendChild(styleTag);
            console.log('桌面端样式已成功应用');

            // 强制覆盖页面内联样式中的 body margin（如 index/tag 里的 margin:20px auto）
            if (document.body) {
                const bodyMargin = pageType === 'article' ? '65px auto 65px' : '65px auto 65px';
                document.body.style.setProperty('margin', bodyMargin, 'important');
            }
        }

        injectTopNav();
    };

    // --- 执行逻辑 ---

    // 初始隐藏 GitHub Issue 按钮 (保留在最前面，因为它需要立即生效)
    const hideIssueButtonRule = `
        a[href*="github.com/7r1UMPHK/7r1UMPHK.github.io/issues"] {
            display: none !important;
        }
    `;
    const issueButtonStyleTag = document.createElement('style');
    issueButtonStyleTag.id = 'hide-issue-button-style'; // 添加ID以便识别
    issueButtonStyleTag.textContent = hideIssueButtonRule;
    document.head.appendChild(issueButtonStyleTag);

    // 初始应用样式
    applyStyles();

    // 初始化页脚增强信息
    initFooterEnhancements();

    // 为列表页补出页码导航
    initPagination();
    
    // 窗口大小变化时重新应用样式
    window.addEventListener('resize', () => {
        // 移除之前的动态样式
        const oldStyleTags = document.querySelectorAll('style[data-dynamic-theme-style="true"]');
        oldStyleTags.forEach(tag => tag.remove());
        
        // 重新应用样式
        applyStyles();
    });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runTheme);
} else {
    runTheme();
}
