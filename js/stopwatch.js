let timer;
let running = false;
let startTime;
let elapsedTime = 0;
let wakeLock = null;

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const timeDisplay = document.querySelector(".time-display");
const hoursSpan = timeDisplay.querySelector(".hours");
const minutesSpan = timeDisplay.querySelector(".minutes");
const secondsSpan = timeDisplay.querySelector(".seconds");
const millisecondsSpan = timeDisplay.querySelector(".milliseconds");

const updateTime = () => {
    elapsedTime = Date.now() - startTime;
    displayTime(elapsedTime);
};

const displayTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;

    hoursSpan.textContent = hours.toString().padStart(2, "0");
    minutesSpan.textContent = minutes.toString().padStart(2, "0");
    secondsSpan.textContent = seconds.toString().padStart(2, "0");
    millisecondsSpan.textContent = milliseconds.toString().padStart(3, "0");
};

const toggleButtons = (action) => {
    if (action === 'start') {
        startBtn.classList.add("hidden");
        pauseBtn.classList.remove("hidden");
        resetBtn.classList.remove("hidden");
    } else if (action === 'pause') {
        startBtn.classList.remove("hidden");
        pauseBtn.classList.add("hidden");
    } else if (action === 'reset') {
        startBtn.classList.remove("hidden");
        pauseBtn.classList.add("hidden");
        resetBtn.classList.add("hidden");
    }
};

startBtn.addEventListener("click", async () => {
    if (!running) {
        startTime = Date.now() - elapsedTime;
        timer = setInterval(updateTime, 10);
        running = true;
        toggleButtons('start');
        try {
            if ('wakeLock' in navigator && !wakeLock) {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake Lock is active');
            }
        } catch (e) {
            console.error(`Failed to enable wake lock: ${e}`);
        }
    }
});

pauseBtn.addEventListener("click", () => {
    if (running) {
        clearInterval(timer);
        running = false;
        toggleButtons('pause');
        if (wakeLock) {
            wakeLock.release().then(() => {
                wakeLock = null;
                console.log('Wake Lock was released');
            });
        }
    }
});

resetBtn.addEventListener("click", () => {
    clearInterval(timer);
    elapsedTime = 0;
    displayTime(0);
    running = false;
    toggleButtons('reset');
    if (wakeLock) {
        wakeLock.release().then(() => {
            wakeLock = null;
            console.log('Wake Lock was released');
        });
    }
});

displayTime(elapsedTime);
