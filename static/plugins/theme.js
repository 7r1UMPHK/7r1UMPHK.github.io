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
                margin: 106px auto 30px; // 为顶部固定文字导航留出空间
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
                max-width: 1400px;
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
                margin-left: 100px;
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
                gap: 14px;
                margin-left: auto;
                margin-right: 100px;
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
                height: 320px; // 头部区域高度
                margin-bottom: 34px;
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
                width: 168px;
                height: 168px;
                border-radius: 50%;
                object-fit: cover;
                border: 5px solid rgba(255, 255, 255, 0.78);
                box-shadow: 0 10px 28px rgba(15, 23, 42, 0.2);
                transition: all 0.28s ease;
            `,
            '.avatar:hover': `
                transform: translateY(-3px) scale(1.04);
                box-shadow: 0 14px 30px rgba(15, 23, 42, 0.25);
            `,
            '#header .blogTitle': `
                margin-top: 30px !important;
                font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif !important;
                margin-left: unset !important;
                font-size: 44px !important;
                font-weight: 700 !important;
                letter-spacing: 0.02em;
                background: linear-gradient(90deg, #0f172a, #2563eb) !important;
                -webkit-background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
                text-shadow: 0 2px 10px rgba(37, 99, 235, 0.15) !important;
            `,
            '#content > div[style*="margin-bottom: 16px"]': `
                margin-bottom: 20px !important;
                border-left: none !important;
                background: linear-gradient(90deg, rgba(37, 99, 235, 0.1), rgba(14, 165, 233, 0.08));
                border-radius: 12px;
                padding: 14px 16px;
                color: #1e293b;
                font-size: 1.02em;
                letter-spacing: 0.02em;
                box-shadow: 0 8px 20px rgba(37, 99, 235, 0.08);
            `,
            '.SideNav.border': `
                border: 1px solid rgba(148, 163, 184, 0.25) !important;
                border-radius: 14px !important;
                overflow: hidden;
                background: rgba(255, 255, 255, 0.78);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
            `,
            '.SideNav-item': `
                padding-top: 2px;
                padding-bottom: 2px;
            `,
            '.SideNav-item .listTitle': `
                font-size: 15px;
                font-weight: 520;
                color: #0f172a;
            `,
            '.paginate-container': `
                margin-top: 18px;
            `,
            '.pagination .next_page, .pagination .previous_page': `
                border-radius: 10px !important;
                border: 1px solid rgba(148, 163, 184, 0.35) !important;
                background: rgba(255, 255, 255, 0.8);
                padding: 8px 12px !important;
                transition: all 0.2s ease;
            `,
            '.pagination .next_page:hover, .pagination .previous_page:hover': `
                transform: translateY(-1px);
                border-color: #60a5fa !important;
                color: #1d4ed8 !important;
                text-decoration: none !important;
            `
        },
        // 标签/搜索页专属样式（覆盖 common 里对 .title-right 的隐藏）
        tag: {
            '.title-right': `
                display: flex !important;
            `
        },
        // 文章页专属样式
        article: {
            'body': `
                max-width: 1020px;
                margin: 106px auto 30px;
                font-size: 16px;
                line-height: 1.55;
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(248, 250, 252, 0.92));
                border-radius: 18px;
                border: 1px solid rgba(255, 255, 255, 0.55);
                box-shadow: 0 14px 36px rgba(15, 23, 42, 0.16);
                overflow: auto;
                padding: 34px 36px;
            `,
            'body .markdown-body': `
                font-size: 17px !important;
                line-height: 1.9 !important;
                color: #1f2937;
                letter-spacing: 0.01em;
            `,
            'body .markdown-body h1, body .markdown-body h2, body .markdown-body h3, body .markdown-body h4': `
                color: #0f172a;
                line-height: 1.35;
                margin-top: 1.45em !important;
                margin-bottom: 0.7em !important;
                font-weight: 700;
                letter-spacing: 0.01em;
            `,
            'body .markdown-body h2, body .markdown-body h3': `
                border-bottom: 1px solid rgba(148, 163, 184, 0.25);
                padding-bottom: 0.28em;
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
                border-radius: 10px;
                margin: 18px 0;
                box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
                background: #0f172a;
                position: relative !important; /* 为绝对定位的复制按钮提供定位上下文 */
                padding-right: 40px !important; /* 为复制按钮预留空间 */
            `,
            'body .markdown-body code': `
                border-radius: 6px;
                background: rgba(148, 163, 184, 0.2);
                padding: 0.15em 0.4em;
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
                margin-bottom: 1.1em;
                text-align: justify;
            `,
            'body .markdown-body blockquote': `
                border-left: 4px solid #60a5fa;
                background: rgba(96, 165, 250, 0.08);
                border-radius: 0 10px 10px 0;
                padding: 10px 14px;
                color: #334155;
            `,
            'body .markdown-body hr': `
                border: none;
                border-top: 1px dashed rgba(148, 163, 184, 0.45);
                margin: 1.6em 0;
            `,
            // 文章中的图片
            'body .markdown-body img': `
                border-radius: 12px;
                box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
                transition: all 0.25s ease;
                display: block;
                margin: 24px auto;
                max-width: 100%;
            `,
            'body .markdown-body img:hover': `
                transform: translateY(-2px) scale(1.01);
            `,
            // 表格样式
            'body .markdown-body table': `
                border-collapse: separate;
                border-spacing: 0;
                width: 100%;
                margin: 18px 0;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
            `,
            'body .markdown-body table th, body .markdown-body table td': `
                padding: 12px 16px;
                border: 1px solid rgba(148, 163, 184, 0.28);
            `,
            'body .markdown-body table th': `
                background: rgba(59, 130, 246, 0.1);
                color: #1e3a8a;
            `,
            'body .markdown-body table tr:nth-child(2n)': `
                background-color: rgba(246, 248, 250, 0.7);
            `,
            // 文章页面标题
            '.postTitle': `
                margin-bottom: 26px !important;
                font-size: 2.35em !important;
                letter-spacing: -0.4px;
                line-height: 1.25;
                color: #0f172a;
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
                    <a href="https://7r1UMPHK.github.io/tag.html" class="kc-link">搜索</a>
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
