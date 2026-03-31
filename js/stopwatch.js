/**
 * stopwatch.js — with performance diagnostics
 * Logs frame timing, hover delays, long tasks, memory, layout shifts.
 * MS display throttled to every 3rd frame to free main thread for input.
 */

// ── Diagnostic config ─────────────────────────────────────────────────────────
const DIAG = {
    SLOW_FRAME_MS:      20,
    JANK_FRAME_MS:      50,
    LOG_EVERY_N_FRAMES: 60,
    MEMORY_INTERVAL_MS: 2000,
};

console.log('%c[DIAG] Stopwatch loaded', 'color:#4ade80;font-weight:bold;font-size:14px');

// ── Device info ───────────────────────────────────────────────────────────────
console.group('%c[DIAG] Device & Display', 'color:#60a5fa;font-weight:bold');
console.log('devicePixelRatio (Retina=2):', window.devicePixelRatio);
console.log('viewport CSS px:', window.innerWidth, 'x', window.innerHeight);
console.log('physical pixels:', window.innerWidth * window.devicePixelRatio, 'x', window.innerHeight * window.devicePixelRatio);
console.log('CPU cores:', navigator.hardwareConcurrency);
console.log('platform:', navigator.platform);
if (window.screen) console.log('screen:', window.screen.width, 'x', window.screen.height, 'colorDepth:', window.screen.colorDepth);
console.groupEnd();

// ── GPU layer audit ───────────────────────────────────────────────────────────
(function auditGPULayers() {
    const composited = [], expensive = [];
    document.querySelectorAll('*').forEach(el => {
        const s = window.getComputedStyle(el);
        const hasLayer    = s.transform !== 'none' || s.willChange !== 'auto' || s.filter !== 'none';
        const hasExpensive = s.boxShadow !== 'none' && s.boxShadow !== '';
        const tag = el.tagName + (el.id ? '#'+el.id : '') + (el.className && typeof el.className === 'string' ? '.'+[...el.classList].slice(0,2).join('.') : '');
        if (hasLayer) composited.push({ tag, transform: s.transform.slice(0,40), willChange: s.willChange });
        if (hasExpensive && !hasLayer) expensive.push({ tag, boxShadow: s.boxShadow.slice(0,60) });
    });
    console.group('%c[DIAG] GPU Compositor Layers (' + composited.length + ')', 'color:#a78bfa;font-weight:bold');
    composited.forEach(x => console.log(x.tag, '| transform:', x.transform, '| will-change:', x.willChange));
    console.groupEnd();
    if (expensive.length) {
        console.group('%c[DIAG] WARNING: box-shadow elements NOT on own GPU layer (' + expensive.length + ')', 'color:#fbbf24;font-weight:bold');
        expensive.slice(0,20).forEach(x => console.warn(x.tag, '|', x.boxShadow));
        if (expensive.length > 20) console.warn('...and', expensive.length - 20, 'more');
        console.groupEnd();
    } else {
        console.log('%c[DIAG] OK: No unprotected box-shadow elements', 'color:#4ade80');
    }
})();

// ── CSS transition audit ──────────────────────────────────────────────────────
(function auditTransitions() {
    const repaintProps = ['background','background-color','border-color','color','box-shadow','border','outline','text-shadow','filter','width','height','padding','margin'];
    const found = [];
    document.querySelectorAll('*').forEach(el => {
        const s = window.getComputedStyle(el);
        const trans = s.transition || '';
        if (!trans || trans === 'none 0s ease 0s' || trans === 'all 0s ease 0s') return;
        const offenders = repaintProps.filter(p => trans.includes(p) || trans.startsWith('all '));
        if (offenders.length) {
            const tag = el.tagName + (el.id ? '#'+el.id : '') + (el.className && typeof el.className === 'string' ? '.'+[...el.classList].slice(0,3).join('.') : '');
            found.push({ tag, offenders: offenders.join(', '), trans: trans.slice(0,100) });
        }
    });
    if (found.length) {
        console.group('%c[DIAG] WARNING: Transitions on repaint-triggering properties (' + found.length + ')', 'color:#f87171;font-weight:bold');
        found.forEach(x => console.warn(x.tag, '| offenders:', x.offenders, '| full:', x.trans));
        console.groupEnd();
    } else {
        console.log('%c[DIAG] OK: No repaint-triggering CSS transitions', 'color:#4ade80');
    }
})();

// ── Fixed/sticky element audit ────────────────────────────────────────────────
(function auditFixed() {
    const fixed = [];
    document.querySelectorAll('*').forEach(el => {
        const s = window.getComputedStyle(el);
        if (s.position === 'fixed' || s.position === 'sticky') {
            const rect = el.getBoundingClientRect();
            const tag  = el.tagName + (el.id ? '#'+el.id : '') + (el.className && typeof el.className === 'string' ? '.'+[...el.classList].slice(0,2).join('.') : '');
            fixed.push({ tag, position: s.position, size: rect.width.toFixed(0)+'x'+rect.height.toFixed(0), hasLayer: s.transform !== 'none' || s.willChange !== 'auto' });
        }
    });
    console.group('%c[DIAG] Fixed/Sticky elements (' + fixed.length + ')', 'color:#818cf8;font-weight:bold');
    fixed.forEach(x => console.log('%c' + x.tag + ' | ' + x.position + ' | ' + x.size + ' | GPU layer: ' + x.hasLayer, x.hasLayer ? 'color:#4ade80' : 'color:#fbbf24'));
    console.groupEnd();
})();

// ── PerformanceObservers ──────────────────────────────────────────────────────
if ('PerformanceObserver' in window) {
    try {
        new PerformanceObserver(list => {
            list.getEntries().forEach(e => {
                console.error('%c[DIAG] LONG TASK ' + e.duration.toFixed(1) + 'ms | start:' + e.startTime.toFixed(0) + 'ms', 'color:#f87171;font-weight:bold;font-size:13px',
                    '| attribution:', e.attribution?.map(a => a.containerName || a.containerSrc || a.containerType || 'window').join(',') || 'n/a');
            });
        }).observe({ type: 'longtask', buffered: true });
        console.log('%c[DIAG] OK: Long Task observer active', 'color:#4ade80');
    } catch(e) { console.warn('[DIAG] Long Task not supported'); }

    try {
        let totalCLS = 0;
        new PerformanceObserver(list => {
            list.getEntries().forEach(e => {
                if (!e.hadRecentInput) {
                    totalCLS += e.value;
                    console.warn('%c[DIAG] Layout Shift: ' + e.value.toFixed(4) + ' | CLS total: ' + totalCLS.toFixed(4), 'color:#fbbf24',
                        '| nodes:', e.sources?.map(s => s.node?.tagName || '?').join(',') || 'unknown');
                }
            });
        }).observe({ type: 'layout-shift', buffered: true });
    } catch(e) {}

    try {
        new PerformanceObserver(list => {
            list.getEntries().forEach(e => {
                if (e.duration > 16)
                    console.log('%c[DIAG] Event: ' + e.name + ' | ' + e.duration.toFixed(0) + 'ms | start:' + e.startTime.toFixed(0) + 'ms', 'color:#a78bfa');
            });
        }).observe({ type: 'event', buffered: false, durationThreshold: 16 });
    } catch(e) {}
}

// ── rAF frame timing ──────────────────────────────────────────────────────────
let diagLastFrameTime = performance.now();
let diagFrameCount    = 0;
let diagSlowFrames    = 0;
let diagJankFrames    = 0;
let diagFrameTimes    = [];
let diagRafRunning    = false;

function diagFrameLoop(now) {
    const delta = now - diagLastFrameTime;
    diagLastFrameTime = now;
    diagFrameCount++;
    diagFrameTimes.push(delta);
    if (diagFrameTimes.length > DIAG.LOG_EVERY_N_FRAMES) diagFrameTimes.shift();

    if (delta > DIAG.JANK_FRAME_MS) {
        diagJankFrames++;
        console.error('%c[DIAG] JANK FRAME ' + delta.toFixed(1) + 'ms (' + (1000/delta).toFixed(0) + 'fps)', 'color:#f87171;font-weight:bold');
    } else if (delta > DIAG.SLOW_FRAME_MS) {
        diagSlowFrames++;
        console.warn('%c[DIAG] Slow frame ' + delta.toFixed(1) + 'ms (' + (1000/delta).toFixed(0) + 'fps)', 'color:#fbbf24');
    }

    if (diagFrameCount % DIAG.LOG_EVERY_N_FRAMES === 0 && diagFrameTimes.length > 10) {
        const avg   = diagFrameTimes.reduce((a,b)=>a+b,0) / diagFrameTimes.length;
        const fps   = (1000/avg).toFixed(1);
        const worst = Math.max(...diagFrameTimes).toFixed(1);
        const best  = Math.min(...diagFrameTimes).toFixed(1);
        const color = parseFloat(fps) < 50 ? 'color:#f87171;font-weight:bold' : parseFloat(fps) < 57 ? 'color:#fbbf24' : 'color:#4ade80';
        console.log('%c[DIAG] FPS: ' + fps + ' | avg: ' + avg.toFixed(1) + 'ms | worst: ' + worst + 'ms | best: ' + best + 'ms | slow: ' + diagSlowFrames + ' | jank: ' + diagJankFrames, color);
    }

    if (diagRafRunning) requestAnimationFrame(diagFrameLoop);
}

// ── Hover timing ──────────────────────────────────────────────────────────────
let hoverStart = 0, hoverTarget = '';
document.addEventListener('mouseover', e => {
    hoverStart  = performance.now();
    const el    = e.target;
    hoverTarget = el.tagName + (el.id ? '#'+el.id : '') + (el.className && typeof el.className === 'string' ? '.'+[...el.classList].slice(0,2).join('.') : '');
}, { passive: true });

document.addEventListener('mousemove', () => {
    if (!hoverStart) return;
    const delay = performance.now() - hoverStart;
    if (delay > 32) {
        console.warn('%c[DIAG] Hover delay: ' + delay.toFixed(1) + 'ms on ' + hoverTarget, 'color:#fbbf24');
        hoverStart = performance.now();
    }
}, { passive: true });

// ── ResizeObserver ────────────────────────────────────────────────────────────
const roCache = new WeakMap();
const diagRO  = new ResizeObserver(entries => {
    entries.forEach(entry => {
        const el   = entry.target;
        const prev = roCache.get(el);
        const curr = { w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) };
        if (prev && (prev.w !== curr.w || prev.h !== curr.h)) {
            const tag = el.tagName + (el.id ? '#'+el.id : '');
            console.warn('%c[DIAG] Reflow: ' + tag + ' ' + prev.w + 'x' + prev.h + ' → ' + curr.w + 'x' + curr.h, 'color:#fbbf24');
        }
        roCache.set(el, curr);
    });
});
['#mainContainer','#mainContent','.links-container','.controls-row','#currentTimeRow','#todoList','#subjectList'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) diagRO.observe(el);
});

// ── Memory monitor ────────────────────────────────────────────────────────────
if (performance.memory) {
    const mb = n => (n/1048576).toFixed(1)+'MB';
    setInterval(() => {
        const used = performance.memory.usedJSHeapSize;
        const pct  = (used/performance.memory.jsHeapSizeLimit*100).toFixed(1);
        const color = parseFloat(pct) > 70 ? 'color:#f87171' : parseFloat(pct) > 40 ? 'color:#fbbf24' : 'color:#4ade80';
        console.log('%c[DIAG] Memory: ' + mb(used) + ' / ' + mb(performance.memory.jsHeapSizeLimit) + ' (' + pct + '%)', color);
    }, DIAG.MEMORY_INTERVAL_MS);
    console.log('%c[DIAG] OK: Memory monitor active', 'color:#4ade80');
}

console.log('%c[DIAG] Ready — Start stopwatch then hover around', 'color:#60a5fa;font-weight:bold;font-size:13px');

// ── Stopwatch ─────────────────────────────────────────────────────────────────
let rafId       = null;
let running     = false;
let startTime   = 0;
let elapsedTime = 0;
let wakeLock    = null;
let frameCount  = 0;

const startBtn         = document.getElementById('startBtn');
const pauseBtn         = document.getElementById('pauseBtn');
const resetBtn         = document.getElementById('resetBtn');
const hoursSpan        = document.querySelector('.time-display .hours');
const minutesSpan      = document.querySelector('.time-display .minutes');
const secondsSpan      = document.querySelector('.time-display .seconds');
const millisecondsSpan = document.querySelector('.time-display .milliseconds');

let lastH = '', lastM = '', lastS = '', lastMs = '';

const displayTime = (ms, updateMs) => {
    ms = Math.floor(ms);
    const totalSec = Math.floor(ms / 1000);
    const totalMin = Math.floor(totalSec / 60);
    const hStr  = Math.floor(totalMin / 60).toString().padStart(2,'0');
    const mStr  = (totalMin % 60).toString().padStart(2,'0');
    const sStr  = (totalSec % 60).toString().padStart(2,'0');
    // h/m/s change rarely so DOM writes are rare
    if (hStr !== lastH) { hoursSpan.textContent   = hStr; lastH = hStr; }
    if (mStr !== lastM) { minutesSpan.textContent  = mStr; lastM = mStr; }
    if (sStr !== lastS) { secondsSpan.textContent  = sStr; lastS = sStr; }
    // ms throttled to every 3rd frame — frees 2/3 of frames for input events
    if (updateMs) {
        const msStr = (ms % 1000).toString().padStart(3,'0');
        if (msStr !== lastMs) { millisecondsSpan.textContent = msStr; lastMs = msStr; }
    }
};

const tick = () => {
    if (!running) return;
    frameCount++;
    displayTime(elapsedTime + (Date.now() - startTime), frameCount % 3 === 0);
    rafId = requestAnimationFrame(tick);
};

const toggleButtons = action => {
    if (action === 'start') {
        startBtn.classList.add('hidden');
        pauseBtn.classList.remove('hidden');
        resetBtn.classList.remove('hidden');
    } else if (action === 'pause') {
        startBtn.classList.remove('hidden');
        pauseBtn.classList.add('hidden');
    } else {
        startBtn.classList.remove('hidden');
        pauseBtn.classList.add('hidden');
        resetBtn.classList.add('hidden');
    }
};

startBtn.addEventListener('click', async () => {
    if (running) return;
    startTime  = Date.now();
    running    = true;
    frameCount = 0;
    rafId      = requestAnimationFrame(tick);
    toggleButtons('start');
    // Start diagnostic frame monitor
    diagRafRunning    = true;
    diagLastFrameTime = performance.now();
    requestAnimationFrame(diagFrameLoop);
    console.log('%c[DIAG] Stopwatch started — frame monitor running', 'color:#4ade80;font-weight:bold');
    try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch(e) {}
});

pauseBtn.addEventListener('click', () => {
    if (!running) return;
    elapsedTime += Date.now() - startTime;
    running = false;
    cancelAnimationFrame(rafId);
    toggleButtons('pause');
    diagRafRunning = false;
    console.log('%c[DIAG] Paused — slow: ' + diagSlowFrames + ' | jank: ' + diagJankFrames, 'color:#fbbf24;font-weight:bold');
    if (wakeLock) wakeLock.release().then(() => { wakeLock = null; });
});

resetBtn.addEventListener('click', () => {
    running = false; elapsedTime = 0; frameCount = 0;
    cancelAnimationFrame(rafId);
    displayTime(0, true);
    lastH = lastM = lastS = lastMs = '';
    toggleButtons('reset');
    diagRafRunning = false; diagSlowFrames = 0; diagJankFrames = 0; diagFrameCount = 0;
    console.log('%c[DIAG] Reset', 'color:#94a3b8');
    if (wakeLock) wakeLock.release().then(() => { wakeLock = null; });
});

displayTime(0, true);
