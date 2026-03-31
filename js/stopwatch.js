/**
 * stopwatch.js
 * Uses requestAnimationFrame instead of setInterval(fn, 10) to prevent
 * hammering the GPU on high-DPI/Retina screens. rAF syncs to the display
 * refresh rate (~60fps) and only paints when the screen is ready.
 */

let rafId       = null;
let running     = false;
let startTime   = 0;      // Date.now() when last started
let elapsedTime = 0;      // accumulated ms before last pause
let wakeLock    = null;

const startBtn         = document.getElementById('startBtn');
const pauseBtn         = document.getElementById('pauseBtn');
const resetBtn         = document.getElementById('resetBtn');
const hoursSpan        = document.querySelector('.time-display .hours');
const minutesSpan      = document.querySelector('.time-display .minutes');
const secondsSpan      = document.querySelector('.time-display .seconds');
const millisecondsSpan = document.querySelector('.time-display .milliseconds');

// ── Only update DOM when value actually changes ───────────────────────────────
let lastH = '', lastM = '', lastS = '', lastMs = '';

const displayTime = (ms) => {
    ms = Math.floor(ms);  // prevent float bleed-through
    const totalSeconds  = Math.floor(ms / 1000);
    const totalMinutes  = Math.floor(totalSeconds / 60);
    const hours         = Math.floor(totalMinutes / 60);
    const minutes       = totalMinutes % 60;
    const seconds       = totalSeconds % 60;
    const milliseconds  = ms % 1000;

    const hStr  = hours.toString().padStart(2, '0');
    const mStr  = minutes.toString().padStart(2, '0');
    const sStr  = seconds.toString().padStart(2, '0');
    const msStr = milliseconds.toString().padStart(3, '0');

    if (hStr  !== lastH)  { hoursSpan.textContent       = hStr;  lastH  = hStr;  }
    if (mStr  !== lastM)  { minutesSpan.textContent      = mStr;  lastM  = mStr;  }
    if (sStr  !== lastS)  { secondsSpan.textContent      = sStr;  lastS  = sStr;  }
    if (msStr !== lastMs) { millisecondsSpan.textContent = msStr; lastMs = msStr; }
};

const tick = () => {
    if (!running) return;
    displayTime(elapsedTime + (Date.now() - startTime));
    rafId = requestAnimationFrame(tick);
};

// ── Button state ──────────────────────────────────────────────────────────────
const toggleButtons = (action) => {
    if (action === 'start') {
        startBtn.classList.add('hidden');
        pauseBtn.classList.remove('hidden');
        resetBtn.classList.remove('hidden');
    } else if (action === 'pause') {
        startBtn.classList.remove('hidden');
        pauseBtn.classList.add('hidden');
    } else if (action === 'reset') {
        startBtn.classList.remove('hidden');
        pauseBtn.classList.add('hidden');
        resetBtn.classList.add('hidden');
    }
};

// ── Controls ──────────────────────────────────────────────────────────────────
startBtn.addEventListener('click', async () => {
    if (running) return;
    startTime = Date.now();
    running   = true;
    rafId     = requestAnimationFrame(tick);
    toggleButtons('start');

    try {
        if ('wakeLock' in navigator && !wakeLock) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (e) { /* wake lock not critical */ }
});

pauseBtn.addEventListener('click', () => {
    if (!running) return;
    elapsedTime += Date.now() - startTime;
    running = false;
    cancelAnimationFrame(rafId);
    toggleButtons('pause');

    if (wakeLock) {
        wakeLock.release().then(() => { wakeLock = null; });
    }
});

resetBtn.addEventListener('click', () => {
    running     = false;
    elapsedTime = 0;
    cancelAnimationFrame(rafId);
    displayTime(0);
    lastH = lastM = lastS = lastMs = ''; // reset cache
    toggleButtons('reset');

    if (wakeLock) {
        wakeLock.release().then(() => { wakeLock = null; });
    }
});

// Init display
displayTime(0);
