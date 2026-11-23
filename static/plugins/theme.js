/* ============================================================
   主题 DOM 行为
   视觉样式在 /css/theme.css；这里只负责页面类型 class、顶部导航、
   页脚字数/运行时间、列表页页码。
   ============================================================ */

// 在 CSS 加载前就先给 <html> 打上页面类型 class，避免样式闪烁
(function setPageClass() {
    const path = window.location.pathname;
    let type = 'article';
    if (path === '/' || /\/index\.html$/.test(path)) {
        type = 'home';
    } else if (/\/page\d+\.html$/.test(path)) {
        type = 'page';
    } else if (/\/tag\.html$/.test(path)) {
        type = 'tag';
    } else if (/(\/post\/|link\.html|about\.html)/.test(path)) {
        type = 'article';
    }
    document.documentElement.classList.add('page-' + type);
})();

function runTheme() {
    const origin = window.location.origin;
    const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;

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
        if (runtimeTimer) clearInterval(runtimeTimer);
        runtimeTimer = setInterval(update, 1000);
    };

    // 站点统计由 Gmeek.yml 生成到 docs/wordcount.json
    let siteMetaPromise = null;
    const fetchSiteMeta = () => {
        if (!siteMetaPromise) {
            siteMetaPromise = fetch(`${origin}/wordcount.json`, { cache: 'no-store' })
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

        try {
            localStorage.removeItem('kc-footer-total-words-v1');
        } catch (e) { /* 隐私模式忽略 */ }

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

    // --- 列表分页：在上一页/下一页之间补出页码 ---
    const getCurrentPageNum = () => {
        const m = window.location.pathname.match(/\/page(\d+)\.html$/);
        return m ? Math.max(1, parseInt(m[1], 10)) : 1;
    };

    const pageHref = (n) => `${origin}/${n <= 1 ? 'index.html' : `page${n}.html`}`;

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

        if (next) {
            box.insertBefore(frag, next);
        } else {
            box.appendChild(frag);
        }
        if (prev && box.firstChild !== prev) box.insertBefore(prev, box.firstChild);
    };

    const initFooterEnhancements = () => {
        initSafeRuntimeCounter();
        initTotalWordCount();
    };

    // --- 顶部文字导航（桌面端） ---
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
                <a href="${origin}/" class="kc-brand">
                    <img src="${origin}/image/20250320200557660.ico" alt="logo">
                    <span>TriumphK’s Blog</span>
                </a>
                <nav class="kc-links" aria-label="顶部导航">
                    <a href="${origin}/" class="kc-link">首页</a>
                    <a href="${origin}/link.html" class="kc-link">友链</a>
                    <a href="${origin}/about.html" class="kc-link">关于</a>
                    <a href="${origin}/tag.html" class="kc-link kc-link-search" aria-label="搜索">
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

    initFooterEnhancements();
    initPagination();
    if (isDesktop()) injectTopNav();
    else removeTopNav();

    window.addEventListener('resize', () => {
        if (isDesktop()) injectTopNav();
        else removeTopNav();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runTheme);
} else {
    runTheme();
}
