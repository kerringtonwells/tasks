/**
 * stopwatch.js — DIAGNOSTIC BUILD
 * Logs everything performance-related to the console.
 * Run this, start the stopwatch, hover over links, click things.
 * Share the console output to diagnose remaining jank.
 */

// ── Config ────────────────────────────────────────────────────────────────────
const DIAG = {
    SLOW_FRAME_MS:      20,    // warn if frame takes longer than this
    JANK_FRAME_MS:      50,    // error if frame takes longer than this
    LOG_EVERY_N_FRAMES: 60,    // print FPS summary every N frames
    MEMORY_INTERVAL_MS: 2000,  // log memory every 2s
};

console.log('%c[DIAG] Stopwatch diagnostic build loaded', 'color:#4ade80;font-weight:bold;font-size:14px');
console.log('%c[DIAG] Start the stopwatch, hover over links, click things.', 'color:#94a3b8');
console.log('%c[DIAG] Watch for RED lines — those are your bottlenecks.', 'color:#f87171');

// ── Device info ───────────────────────────────────────────────────────────────
console.group('%c[DIAG] Device & Display', 'color:#60a5fa;font-weight:bold');
console.log('devicePixelRatio (Retina=2):', window.devicePixelRatio);
console.log('viewport CSS px:', window.innerWidth, 'x', window.innerHeight);
console.log('physical pixels:', window.innerWidth * window.devicePixelRatio, 'x', window.innerHeight * window.devicePixelRatio);
console.log('hardwareConcurrency (CPU cores):', navigator.hardwareConcurrency);
console.log('platform:', navigator.platform);
if (window.screen) {
    console.log('screen:', window.screen.width, 'x', window.screen.height, 'colorDepth:', window.screen.colorDepth);
}
console.groupEnd();

// ── GPU layer audit ───────────────────────────────────────────────────────────
(function auditGPULayers() {
    const composited = [];
    const expensive  = [];
    document.querySelectorAll('*').forEach(el => {
        const s = window.getComputedStyle(el);
        const hasLayer = s.transform !== 'none' || s.willChange !== 'auto' || s.filter !== 'none';
        const hasExpensive = s.boxShadow !== 'none' && s.boxShadow !== '';
        if (hasLayer) {
            const tag = el.tagName + (el.id ? '#'+el.id : '') + (el.className && typeof el.className === 'string' ? '.'+[...el.classList].slice(0,2).join('.') : '');
            composited.push({ tag, transform: s.transform.slice(0,40), willChange: s.willChange });
        }
        if (hasExpensive && !hasLayer) {
            const tag = el.tagName + (el.id ? '#'+el.id : '') + (el.className && typeof el.className === 'string' ? '.'+[...el.classList].slice(0,2).join('.') : '');
            expensive.push({ tag, boxShadow: s.boxShadow.slice(0,60) });
        }
    });
    console.group('%c[DIAG] GPU Compositor Layers (' + composited.length + ' promoted elements)', 'color:#a78bfa;font-weight:bold');
    composited.forEach(x => console.log(x.tag, '| transform:', x.transform, '| will-change:', x.willChange));
    console.groupEnd();
    if (expensive.length) {
        console.group('%c[DIAG] WARNING: Elements with box-shadow NOT on own layer (repaint risk on hover)', 'color:#fbbf24;font-weight:bold');
        expensive.slice(0, 20).forEach(x => console.warn(x.tag, '|', x.boxShadow));
        if (expensive.length > 20) console.warn('...and', expensive.length - 20, 'more');
        console.groupEnd();
    } else {
        console.log('%c[DIAG] OK: No unprotected box-shadow elements found', 'color:#4ade80');
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
        console.log('%c[DIAG] OK: No repaint-triggering CSS transitions found', 'color:#4ade80');
    }
})();

// ── Fixed/sticky elements audit ───────────────────────────────────────────────
(function auditFixed() {
    const fixed = [];
    document.querySelectorAll('*').forEach(el => {
        const s = window.getComputedStyle(el);
        if (s.position === 'fixed' || s.position === 'sticky') {
            const rect = el.getBoundingClientRect();
            const tag = el.tagName + (el.id ? '#'+el.id : '') + (el.className && typeof el.className === 'string' ? '.'+[...el.classList].slice(0,2).join('.') : '');
            fixed.push({ tag, position: s.position, size: rect.width.toFixed(0)+'x'+rect.height.toFixed(0), hasLayer: s.transform !== 'none' || s.willChange !== 'auto' });
        }
    });
    console.group('%c[DIAG] Fixed/Sticky elements (' + fixed.length + ') — each forces its own repaint', 'color:#818cf8;font-weight:bold');
    fixed.forEach(x => {
        const style = x.hasLayer ? 'color:#4ade80' : 'color:#fbbf24';
        console.log('%c' + x.tag + ' | ' + x.position + ' | ' + x.size + ' | GPU layer: ' + x.hasLayer, style);
    });
    console.groupEnd();
})();

// ── PerformanceObserver: Long Tasks ──────────────────────────────────────────
if ('PerformanceObserver' in window) {
    try {
        new PerformanceObserver(list => {
            list.getEntries().forEach(entry => {
                console.error(
                    '%c[DIAG] LONG TASK ' + entry.duration.toFixed(1) + 'ms | start: ' + entry.startTime.toFixed(0) + 'ms',
                    'color:#f87171;font-weight:bold;font-size:13px',
                    '| attribution:', entry.attribution?.map(a => a.containerName || a.containerSrc || a.containerType || 'unknown').join(',') || 'n/a'
                );
            });
        }).observe({ type: 'longtask', buffered: true });
        console.log('%c[DIAG] OK: Long Task observer active (tasks >50ms appear in RED)', 'color:#4ade80');
    } catch(e) { console.warn('[DIAG] Long Task observer not supported:', e.message); }

    try {
        new PerformanceObserver(list => {
            list.getEntries().forEach(entry => {
                console.log('%c[DIAG] Paint: ' + entry.name + ' at ' + entry.startTime.toFixed(1) + 'ms', 'color:#818cf8');
            });
        }).observe({ type: 'paint', buffered: true });
    } catch(e) {}

    try {
        let totalCLS = 0;
        new PerformanceObserver(list => {
            list.getEntries().forEach(entry => {
                if (!entry.hadRecentInput) {
                    totalCLS += entry.value;
                    console.warn('%c[DIAG] Layout Shift: ' + entry.value.toFixed(4) + ' | cumulative CLS: ' + totalCLS.toFixed(4), 'color:#fbbf24',
                        '| nodes:', entry.sources?.map(s => s.node?.tagName || '?').join(',') || 'unknown');
                }
            });
        }).observe({ type: 'layout-shift', buffered: true });
        console.log('%c[DIAG] OK: Layout Shift observer active', 'color:#4ade80');
    } catch(e) {}

    try {
        new PerformanceObserver(list => {
            list.getEntries().forEach(e => {
                console.log('%c[DIAG] Animation: ' + e.name + ' | duration:' + e.duration.toFixed(0) + 'ms | start:' + e.startTime.toFixed(0) + 'ms', 'color:#a78bfa');
            });
        }).observe({ type: 'event', buffered: false, durationThreshold: 16 });
    } catch(e) {}
}

// ── rAF frame timing monitor ─────────────────────────────────────────────────
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
        console.error('%c[DIAG] JANK FRAME ' + delta.toFixed(1) + 'ms (' + (1000/delta).toFixed(0) + 'fps) — main thread was blocked', 'color:#f87171;font-weight:bold');
    } else if (delta > DIAG.SLOW_FRAME_MS) {
        diagSlowFrames++;
        console.warn('%c[DIAG] Slow frame ' + delta.toFixed(1) + 'ms (' + (1000/delta).toFixed(0) + 'fps)', 'color:#fbbf24');
    }

    if (diagFrameCount % DIAG.LOG_EVERY_N_FRAMES === 0 && diagFrameTimes.length > 10) {
        const avg   = diagFrameTimes.reduce((a,b) => a+b, 0) / diagFrameTimes.length;
        const fps   = (1000 / avg).toFixed(1);
        const worst = Math.max(...diagFrameTimes).toFixed(1);
        const best  = Math.min(...diagFrameTimes).toFixed(1);
        const color = parseFloat(fps) < 50 ? 'color:#f87171;font-weight:bold' : parseFloat(fps) < 57 ? 'color:#fbbf24' : 'color:#4ade80';
        console.log('%c[DIAG] FPS: ' + fps + ' avg | worst frame: ' + worst + 'ms | best: ' + best + 'ms | slow: ' + diagSlowFrames + ' | jank: ' + diagJankFrames, color);
    }

    if (diagRafRunning) requestAnimationFrame(diagFrameLoop);
}

// ── Hover timing ──────────────────────────────────────────────────────────────
let hoverStart  = 0;
let hoverTarget = '';
document.addEventListener('mouseover', e => {
    hoverStart = performance.now();
    const el = e.target;
    hoverTarget = el.tagName + (el.id ? '#'+el.id : '') + (el.className && typeof el.className === 'string' ? '.'+[...el.classList].slice(0,2).join('.') : '');
}, { passive: true });

document.addEventListener('mousemove', e => {
    if (!hoverStart) return;
    const delay = performance.now() - hoverStart;
    if (delay > 32) {
        console.warn('%c[DIAG] Hover response delay: ' + delay.toFixed(1) + 'ms on ' + hoverTarget + ' — suggests main thread blocked', 'color:#fbbf24');
        hoverStart = performance.now(); // reset to avoid spam
    }
}, { passive: true });

// ── ResizeObserver — unexpected reflows ───────────────────────────────────────
const roCache = new WeakMap();
const diagRO  = new ResizeObserver(entries => {
    entries.forEach(entry => {
        const el   = entry.target;
        const prev = roCache.get(el);
        const curr = { w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) };
        if (prev && (prev.w !== curr.w || prev.h !== curr.h)) {
            const tag = el.tagName + (el.id ? '#'+el.id : '');
            console.warn('%c[DIAG] Unexpected resize/reflow: ' + tag + ' ' + prev.w + 'x' + prev.h + ' → ' + curr.w + 'x' + curr.h, 'color:#fbbf24');
        }
        roCache.set(el, curr);
    });
});
['#mainContainer','#mainContent','.links-container','.controls-row','#currentTimeRow'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) diagRO.observe(el);
});

// ── Memory monitor ────────────────────────────────────────────────────────────
if (performance.memory) {
    const mb = n => (n / 1048576).toFixed(1) + 'MB';
    setInterval(() => {
        const used  = performance.memory.usedJSHeapSize;
        const total = performance.memory.totalJSHeapSize;
        const limit = performance.memory.jsHeapSizeLimit;
        const pct   = (used / limit * 100).toFixed(1);
        const color = parseFloat(pct) > 70 ? 'color:#f87171' : parseFloat(pct) > 40 ? 'color:#fbbf24' : 'color:#4ade80';
        console.log('%c[DIAG] Memory: used=' + mb(used) + ' | total=' + mb(total) + ' | limit=' + mb(limit) + ' | ' + pct + '%', color);
    }, DIAG.MEMORY_INTERVAL_MS);
    console.log('%c[DIAG] OK: Memory monitor active (every 2s)', 'color:#4ade80');
} else {
    console.warn('[DIAG] performance.memory not available — use Chrome with about:flags > "Enable precise memory info"');
}

// ── Stopwatch (same clean rAF implementation) ─────────────────────────────────
let rafId       = null;
let running     = false;
let startTime   = 0;
let elapsedTime = 0;
let wakeLock    = null;

const startBtn         = document.getElementById('startBtn');
const pauseBtn         = document.getElementById('pauseBtn');
const resetBtn         = document.getElementById('resetBtn');
const hoursSpan        = document.querySelector('.time-display .hours');
const minutesSpan      = document.querySelector('.time-display .minutes');
const secondsSpan      = document.querySelector('.time-display .seconds');
const millisecondsSpan = document.querySelector('.time-display .milliseconds');

let lastH = '', lastM = '', lastS = '', lastMs = '';

const displayTime = ms => {
    ms = Math.floor(ms);
    const totalSec = Math.floor(ms / 1000);
    const totalMin = Math.floor(totalSec / 60);
    const hStr  = Math.floor(totalMin / 60).toString().padStart(2,'0');
    const mStr  = (totalMin % 60).toString().padStart(2,'0');
    const sStr  = (totalSec % 60).toString().padStart(2,'0');
    const msStr = (ms % 1000).toString().padStart(3,'0');
    if (hStr  !== lastH)  { hoursSpan.textContent        = hStr;  lastH  = hStr;  }
    if (mStr  !== lastM)  { minutesSpan.textContent       = mStr;  lastM  = mStr;  }
    if (sStr  !== lastS)  { secondsSpan.textContent       = sStr;  lastS  = sStr;  }
    if (msStr !== lastMs) { millisecondsSpan.textContent  = msStr; lastMs = msStr; }
};

const tick = () => { if (!running) return; displayTime(elapsedTime + (Date.now() - startTime)); rafId = requestAnimationFrame(tick); };

const toggleButtons = action => {
    if (action === 'start') { startBtn.classList.add('hidden'); pauseBtn.classList.remove('hidden'); resetBtn.classList.remove('hidden'); }
    else if (action === 'pause') { startBtn.classList.remove('hidden'); pauseBtn.classList.add('hidden'); }
    else { startBtn.classList.remove('hidden'); pauseBtn.classList.add('hidden'); resetBtn.classList.add('hidden'); }
};

startBtn.addEventListener('click', async () => {
    if (running) return;
    startTime = Date.now(); running = true;
    rafId = requestAnimationFrame(tick);
    toggleButtons('start');
    diagRafRunning = true;
    diagLastFrameTime = performance.now();
    requestAnimationFrame(diagFrameLoop);
    console.log('%c[DIAG] Stopwatch started — frame monitor running. Hover over links now.', 'color:#4ade80;font-weight:bold');
    try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch(e) {}
});

pauseBtn.addEventListener('click', () => {
    if (!running) return;
    elapsedTime += Date.now() - startTime; running = false;
    cancelAnimationFrame(rafId); toggleButtons('pause');
    diagRafRunning = false;
    console.log('%c[DIAG] Paused. Slow: ' + diagSlowFrames + ' | Jank: ' + diagJankFrames + ' frames total', 'color:#fbbf24;font-weight:bold');
    if (wakeLock) wakeLock.release().then(() => { wakeLock = null; });
});

resetBtn.addEventListener('click', () => {
    running = false; elapsedTime = 0;
    cancelAnimationFrame(rafId); displayTime(0);
    lastH = lastM = lastS = lastMs = '';
    toggleButtons('reset');
    diagRafRunning = false; diagSlowFrames = 0; diagJankFrames = 0; diagFrameCount = 0;
    console.log('%c[DIAG] Reset. Diagnostics cleared.', 'color:#94a3b8');
    if (wakeLock) wakeLock.release().then(() => { wakeLock = null; });
});

displayTime(0);
console.log('%c[DIAG] Ready. Open Console → Start stopwatch → hover links → paste output.', 'color:#60a5fa;font-weight:bold;font-size:13px');
