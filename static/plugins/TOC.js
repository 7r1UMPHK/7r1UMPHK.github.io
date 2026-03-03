function createTOC() {
    var tocElement = document.createElement('div');
    tocElement.className = 'toc';
    
    var contentContainer = document.getElementById('content');
    
    const headings = contentContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    if (headings.length === 0) {
        return;
    }
    
    tocElement.insertAdjacentHTML('afterbegin', '<div class="toc-title">文章目录</div>');
    
    headings.forEach(heading => {
        if (!heading.id) {
            heading.id = heading.textContent.trim().replace(/\s+/g, '-').toLowerCase();
        }
        
        const link = document.createElement('a');
        link.href = '#' + heading.id;
        link.textContent = heading.textContent;
        link.className = 'toc-link';
        
        link.style.paddingLeft = `${(parseInt(heading.tagName.charAt(1)) - 1) * 10}px`;
        
        tocElement.appendChild(link);
    });
    
    tocElement.insertAdjacentHTML('beforeend', '<a class="toc-end" onclick="window.scrollTo({top:0,behavior: \'smooth\'});">Top</a>');
    
    contentContainer.prepend(tocElement);
    initTOCInteractions(tocElement, headings);
}

function initTOCInteractions(tocElement, headings) {
    const tocLinks = Array.from(tocElement.querySelectorAll('.toc-link'));
    const headingList = Array.from(headings);

    if (!tocLinks.length || !headingList.length) return;

    let activeId = '';

    const setActiveLink = (id) => {
        if (!id || id === activeId) return;

        let activeLink = null;
        tocLinks.forEach(link => {
            const linkId = link.getAttribute('href')?.slice(1);
            if (linkId === id) {
                link.classList.add('toc-active');
                activeLink = link;
            } else {
                link.classList.remove('toc-active');
            }
        });

        activeId = id;

        // 让 TOC 滚动跟随当前激活项，避免蓝色下划线项滚出可视区域
        if (activeLink) {
            const containerTop = tocElement.scrollTop;
            const containerBottom = containerTop + tocElement.clientHeight;
            const itemTop = activeLink.offsetTop;
            const itemBottom = itemTop + activeLink.offsetHeight;
            const padding = 28;

            if (itemTop < containerTop + padding || itemBottom > containerBottom - padding) {
                const targetScrollTop = itemTop - (tocElement.clientHeight / 2) + (activeLink.offsetHeight / 2);
                tocElement.scrollTo({
                    top: Math.max(0, targetScrollTop),
                    behavior: 'smooth'
                });
            }
        }
    };

    tocLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const rawId = link.getAttribute('href')?.slice(1);
            if (!rawId) return;

            let targetId = rawId;
            try {
                targetId = decodeURIComponent(rawId);
            } catch (_) {}

            const target = document.getElementById(targetId);
            if (!target) return;

            const offset = 130; // 顶部固定导航补偿
            const targetTop = target.getBoundingClientRect().top + window.scrollY - offset;

            window.scrollTo({
                top: Math.max(targetTop, 0),
                behavior: 'smooth'
            });

            setActiveLink(target.id);
            history.replaceState(null, '', `#${encodeURIComponent(target.id)}`);
        });
    });

    const updateActiveByScroll = () => {
        const threshold = 150;
        let currentId = headingList[0]?.id || '';

        for (const heading of headingList) {
            if (heading.getBoundingClientRect().top - threshold <= 0) {
                currentId = heading.id;
            } else {
                break;
            }
        }

        if (currentId) {
            setActiveLink(currentId);
        }
    };

    window.addEventListener('scroll', updateActiveByScroll, { passive: true });
    window.addEventListener('resize', updateActiveByScroll);
    updateActiveByScroll();
}

function createMobileTOC() {
    // 创建浮动菜单按钮
    const floatButton = document.createElement('div');
    floatButton.className = 'mobile-float-button';
    floatButton.innerHTML = '<div class="hamburger"><span></span><span></span><span></span></div>';
    document.body.appendChild(floatButton);

    // 创建回到顶部按钮
    const topButton = document.createElement('div');
    topButton.className = 'mobile-top-button';
    topButton.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>';
    topButton.onclick = () => window.scrollTo({top: 0, behavior: 'smooth'});
    document.body.appendChild(topButton);

    // 创建移动端目录容器
    const mobileToc = document.createElement('div');
    mobileToc.className = 'mobile-toc-container';
    mobileToc.innerHTML = '<div class="mobile-toc-header">文章目录<span class="mobile-toc-close">×</span></div><div class="mobile-toc-content"></div>';
    document.body.appendChild(mobileToc);

    // 获取文章标题
    const contentContainer = document.getElementById('content');
    const headings = contentContainer ? contentContainer.querySelectorAll('h1, h2, h3, h4, h5, h6') : [];
    const tocContent = mobileToc.querySelector('.mobile-toc-content');

    if (headings.length > 0) {
        headings.forEach(heading => {
            if (!heading.id) {
                heading.id = heading.textContent.trim().replace(/\s+/g, '-').toLowerCase();
            }
            
            const link = document.createElement('a');
            link.href = '#' + heading.id;
            link.textContent = heading.textContent;
            link.className = 'mobile-toc-link';
            
            // 根据标题级别设置缩进
            const level = parseInt(heading.tagName.charAt(1));
            link.style.paddingLeft = `${(level - 1) * 10}px`;
            
            tocContent.appendChild(link);
        });
    } else {
        tocContent.innerHTML = '<div class="mobile-toc-empty">无目录内容</div>';
    }

    // 添加事件监听
    floatButton.addEventListener('click', () => {
        mobileToc.classList.toggle('active');
    });

    mobileToc.querySelector('.mobile-toc-close').addEventListener('click', () => {
        mobileToc.classList.remove('active');
    });

    // 点击链接后关闭目录
    mobileToc.querySelectorAll('.mobile-toc-link').forEach(link => {
        link.addEventListener('click', () => {
            mobileToc.classList.remove('active');
        });
    });

    // 监听滚动显示/隐藏回到顶部按钮
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            topButton.classList.add('active');
        } else {
            topButton.classList.remove('active');
        }
    });
}

document.addEventListener("DOMContentLoaded", function() {
    if (window.innerWidth >= 768) {
        // 桌面端
        createTOC();
    } else {
        // 移动端
        createMobileTOC();
    }
    
    var css = `
    /* 桌面端样式 */
    .toc {
        position: fixed;
        top: 60px;
        left: calc(50% + 510px);
        width: 270px;
        background: rgba(255, 255, 255, 0.68);
        border: 1px solid rgba(255, 255, 255, 0.45);
        border-radius: 14px;
        padding: 12px 10px;
        overflow-y: auto;
        box-shadow: 0 10px 28px rgba(30, 41, 59, 0.16);
        backdrop-filter: blur(9px);
        -webkit-backdrop-filter: blur(9px);
        max-height: calc(100vh - 80px);
        scrollbar-width: none;
        -ms-overflow-style: none;
    }

    .toc::-webkit-scrollbar {
        width: 0;
        height: 0;
        display: none;
    }

    #content {
        position: relative;
    }
    
    .toc-title{
        font-weight: 700;
        font-size: 14px;
        text-align: center;
        color: #334155;
        border-bottom: 1px solid rgba(148, 163, 184, 0.28);
        padding-bottom: 9px;
        margin-bottom: 8px;
        letter-spacing: 0.03em;
    }
    
    .toc-end{
        font-weight: 600;
        text-align: center;
        cursor: pointer;
        visibility: hidden;
        margin-top: 10px;
        color: #3b82f6 !important;
        border-top: 1px dashed rgba(148, 163, 184, 0.35);
        padding-top: 9px !important;
        border-bottom: none !important;
    }
    
    .toc a {
        display: block;
        color: #334155;
        text-decoration: none;
        padding: 8px 10px;
        font-size: 13px;
        line-height: 1.45;
        border-bottom: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 8px;
        transition: background-color .18s ease, color .18s ease, transform .18s ease;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .toc a:last-child {
        border-bottom: none;
    }
    
    .toc a:hover {
        background-color: rgba(96, 165, 250, 0.16);
        color: #1e40af;
        transform: translateX(2px);
    }

    .toc a.toc-active {
        color: #1d4ed8;
        background-color: rgba(59, 130, 246, 0.12);
        text-decoration: underline;
        text-decoration-color: #3b82f6;
        text-decoration-thickness: 2px;
        text-underline-offset: 4px;
        font-weight: 600;
    }

    .toc a:focus,
    .toc a:focus-visible,
    .toc a:active {
        outline: none;
        box-shadow: none;
    }

    /* 移动端样式 */
    .mobile-float-button {
        position: fixed;
        bottom: 80px;
        right: 15px;
        width: 45px;
        height: 45px;
        background-color: var(--color-accent-emphasis, #0366d6);
        border-radius: 50%;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 999;
        cursor: pointer;
        transition: background-color 0.3s;
    }

    .mobile-float-button:hover {
        background-color: var(--color-accent-fg, #0969da);
    }

    .hamburger {
        width: 20px;
        height: 16px;
        position: relative;
    }

    .hamburger span {
        display: block;
        position: absolute;
        height: 2px;
        width: 100%;
        background: white;
        border-radius: 2px;
        left: 0;
    }

    .hamburger span:nth-child(1) {
        top: 0;
    }

    .hamburger span:nth-child(2) {
        top: 7px;
    }

    .hamburger span:nth-child(3) {
        top: 14px;
    }

    .mobile-top-button {
        position: fixed;
        bottom: 20px;
        right: 15px;
        width: 45px;
        height: 45px;
        background-color: rgba(200, 200, 200, 0.8);
        border-radius: 50%;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 999;
        cursor: pointer;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s, visibility 0.3s, background-color 0.3s;
    }

    .mobile-top-button.active {
        opacity: 1;
        visibility: visible;
    }

    .mobile-top-button:hover {
        background-color: rgba(180, 180, 180, 0.9);
    }

    .mobile-toc-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 80%;
        height: 100%;
        background-color: white;
        box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        transform: translateX(-100%);
        transition: transform 0.3s ease-in-out;
        overflow-y: auto;
        max-width: 300px;
    }

    .mobile-toc-container.active {
        transform: translateX(0);
    }

    .mobile-toc-header {
        padding: 15px;
        font-weight: bold;
        font-size: 18px;
        border-bottom: 1px solid #ddd;
        position: sticky;
        top: 0;
        background-color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .mobile-toc-close {
        font-size: 24px;
        cursor: pointer;
        padding: 0 5px;
    }

    .mobile-toc-content {
        padding: 10px 0;
    }

    .mobile-toc-link {
        display: block;
        padding: 8px 15px;
        text-decoration: none;
        color: var(--color-fg-default, #24292f);
        border-bottom: 1px solid #f1f1f1;
        font-size: 15px;
        line-height: 1.4;
    }

    .mobile-toc-link:hover {
        background-color: #f6f8fa;
    }

    .mobile-toc-empty {
        padding: 15px;
        color: #666;
        text-align: center;
    }

    @media (max-width: 1249px) and (min-width: 768px) {
        .toc{
            position:static;
            top:auto;
            left:auto;
            transform:none;
            padding:10px;
            margin-bottom:20px;
        }
    }

    @media (max-width: 767px) {
        .toc {
            display: none;
        }
    }`;

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    window.onscroll = function() {
        const backToTopButton = document.querySelector('.toc-end');
        if (backToTopButton) {
            if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
                backToTopButton.style="visibility: visible;"
            } else {
                backToTopButton.style="visibility: hidden;"
            }
        }
    };
});

