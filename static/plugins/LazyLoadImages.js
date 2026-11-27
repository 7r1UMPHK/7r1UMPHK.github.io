(function() {

    const config = {
        rootMargin: '100px 0px',
        threshold: 0.1,
        placeholderColor: '#f5f5f5',
        fadeInDuration: 500
    };

    const DATA_SRC = 'data-triumph-src';

    const IGNORE_SELECTORS = [
        '.avatar',
        '.stats-avatar img',
        '.SideNav-icon img',
        '.title-right img',
        '.mobile-float-button img',
        '.mobile-top-button img',
        'img[width="16"]',
        'img[width="32"]'
    ];

    function onImageLoad(img) {

        img.style.opacity = '1';
        img.classList.add('triumph-lazy-loaded');
    }

    function onImageError(img, originalSrc) {
        console.error(`Failed to load image: ${originalSrc}`);

        img.style.opacity = '1';
        img.classList.add('triumph-lazy-error');
    }

    function shouldIgnore(img) {

        for (const selector of IGNORE_SELECTORS) {
            if (img.matches(selector) || img.closest(selector)) {
                return true;
            }
        }

        const width = img.getAttribute('width');
        const height = img.getAttribute('height');
        if ((width && parseInt(width) < 40) || (height && parseInt(height) < 40)) {
            return true;
        }

        return false;
    }

    function processImage(img) {

        if (shouldIgnore(img)) {
            return;
        }

        const originalSrc = img.dataset.canonicalSrc || img.src;

        if (img.hasAttribute(DATA_SRC) || !originalSrc ||
            originalSrc.startsWith('data:') || originalSrc === '') {
            return;
        }

        img.setAttribute(DATA_SRC, originalSrc);

        img.style.backgroundColor = config.placeholderColor;
        img.style.transition = `opacity ${config.fadeInDuration}ms ease`;
        img.style.opacity = '0';

        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }

    function loadImage(entry) {
        const img = entry.target;

        if (entry.isIntersecting && img.hasAttribute(DATA_SRC)) {
            const originalSrc = img.getAttribute(DATA_SRC);

            img.removeAttribute(DATA_SRC);

            img.src = originalSrc;

            if (img.dataset.canonicalSrc) {
                img.dataset.canonicalSrc = originalSrc;
            }

            img.onload = function() {
                onImageLoad(img);
            };

            img.onerror = function() {
                onImageError(img, originalSrc);
            };

            observer.unobserve(img);
        }
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(loadImage);
        },
        {
            rootMargin: config.rootMargin,
            threshold: config.threshold
        }
    );

    function initialize() {

        const images = document.querySelectorAll('img');

        images.forEach(img => {
            processImage(img);

            if (img.hasAttribute(DATA_SRC)) {
                observer.observe(img);
            }
        });

        console.log('Triumph懒加载初始化完成：已处理', document.querySelectorAll(`img[${DATA_SRC}]`).length, '张图片');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {

        initialize();
    }

    window.TriumphLazyLoad = {

        refresh: function() {
            initialize();
        },

        processContainer: function(container) {
            const images = container.querySelectorAll('img');
            images.forEach(img => {
                processImage(img);
                if (img.hasAttribute(DATA_SRC)) {
                    observer.observe(img);
                }
            });
        }
    };
})();
