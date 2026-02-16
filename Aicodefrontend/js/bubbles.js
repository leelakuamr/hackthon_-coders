/**
 * Bubble / particle background - AI-themed (cyan, blue, purple).
 * No external libraries. Runs only if #bubbleBg exists.
 * Performance: limited count, CSS-only animation, responsive.
 *
 * Customize: edit CONFIG below (counts, sizes, colors, duration).
 * CSS classes for colors live in styles.css: .bubble--cyan, .bubble--blue, .bubble--purple.
 */
(function () {
    'use strict';

    var CONFIG = {
        desktopCount: 14,
        mobileCount: 6,
        mobileBreakpoint: 640,
        minSizePx: 32,
        maxSizePx: 100,
        colors: ['bubble--cyan', 'bubble--blue', 'bubble--purple'],
        durationMin: 14,
        durationMax: 22
    };

    function getBubbleCount() {
        return window.innerWidth <= CONFIG.mobileBreakpoint ? CONFIG.mobileCount : CONFIG.desktopCount;
    }

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function createBubble() {
        var size = Math.round(randomBetween(CONFIG.minSizePx, CONFIG.maxSizePx));
        var left = Math.random() * 100;
        var top = Math.random() * 100;
        var colorClass = CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)];
        var duration = randomBetween(CONFIG.durationMin, CONFIG.durationMax);
        var delay = randomBetween(0, 5);

        var el = document.createElement('div');
        el.className = 'bubble ' + colorClass;
        el.setAttribute('aria-hidden', 'true');
        el.style.width = size + 'px';
        el.style.height = size + 'px';
        el.style.left = left + '%';
        el.style.top = top + '%';
        el.style.animationDuration = duration + 's';
        el.style.animationDelay = delay + 's';

        return el;
    }

    function init() {
        var container = document.getElementById('bubbleBg');
        if (!container) return;

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            container.innerHTML = '';
            return;
        }

        var count = getBubbleCount();
        var fragment = document.createDocumentFragment();
        for (var i = 0; i < count; i++) {
            fragment.appendChild(createBubble());
        }
        container.appendChild(fragment);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
