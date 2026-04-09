/**
 * stopwatch.js
 */

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
    try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch(e) {}
});

pauseBtn.addEventListener('click', () => {
    if (!running) return;
    elapsedTime += Date.now() - startTime;
    running = false;
    cancelAnimationFrame(rafId);
    toggleButtons('pause');
    diagRafRunning = false;
    if (wakeLock) wakeLock.release().then(() => { wakeLock = null; });
});

resetBtn.addEventListener('click', () => {
    running = false; elapsedTime = 0; frameCount = 0;
    cancelAnimationFrame(rafId);
    displayTime(0, true);
    lastH = lastM = lastS = lastMs = '';
    toggleButtons('reset');
    diagRafRunning = false; diagSlowFrames = 0; diagJankFrames = 0; diagFrameCount = 0;
    if (wakeLock) wakeLock.release().then(() => { wakeLock = null; });
});

displayTime(0, true);

// ── Stopwatch panel toggle (⏱ button in controls row) ────────────────────────
// Wired here rather than in an inline script to guarantee correct timing
// when firebase-sync.js module is present (modules affect DOMContentLoaded order).
(function() {
    const toggleBtn = document.getElementById('stopwatchToggle');
    const panel     = document.getElementById('inlineStopwatch');
    if (!toggleBtn || !panel) return;
    toggleBtn.addEventListener('click', function() {
        const visible = panel.style.display !== 'none';
        panel.style.display = visible ? 'none' : 'block';
        toggleBtn.classList.toggle('active-icon', !visible);
    });
})();
