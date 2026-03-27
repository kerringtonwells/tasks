let timeSlots = [];
for (let i = 6; i <= 29; i++) {
    for (let j = 0; j < 2; j++) {
        let startTime = ('0' + i).slice(-2) + ':' + (j === 0 ? '00' : '30');
        let endTime = ('0' + (j === 1 ? i + 1 : i)).slice(-2) + ':' + (j === 0 ? '30' : '00');
        timeSlots.push({ time: `${startTime} - ${endTime}`, status: 0 });
    }
}

// Clamp selectedIndex on load — prevents crash if count exceeded array length
let selectedIndex = Math.min(
    parseInt(localStorage.getItem('selectedIndex')) || 0,
    timeSlots.length - 1
);

const formatTimeSlot12Hour = (startHour, startMinute) => {
    let h = parseInt(startHour);
    if (h >= 24) h -= 24;
    return formatTime12Hour(h, parseInt(startMinute), 0);
};

const createRow = (timeSlot, index) => {
    const row = document.createElement('tr');
    if (index === selectedIndex) row.classList.add('current');
    const timeCell = document.createElement('td');
    const [startHour, startMinute] = timeSlot.time.split('-')[0].trim().split(':');
    const [endHour, endMinute]     = timeSlot.time.split('-')[1].trim().split(':');
    timeCell.textContent = `${formatTimeSlot12Hour(startHour, startMinute)} - ${formatTimeSlot12Hour(endHour, endMinute)}`;
    row.appendChild(timeCell);
    return row;
};

const renderTable = () => {
    const timeTable = document.getElementById('timeTable');
    if (!timeTable) return;
    timeTable.innerHTML = '';
    timeTable.appendChild(createRow(timeSlots[selectedIndex], selectedIndex));
};

const updateCurrentTime = () => {
    const now     = new Date();
    const hours   = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const timeStr = formatTime12Hour(hours, minutes, seconds);

    const el = document.getElementById('currentTime');
    if (!el) return;

    const slot    = timeSlots[selectedIndex];
    const [sh, sm] = slot.time.split('-')[0].trim().split(':');
    const slotDate = new Date(now);
    slotDate.setHours(parseInt(sh), parseInt(sm), 0, 0);

    const isBehind = now >= slotDate;
    const cls      = isBehind ? 'status-behind' : 'status-on-schedule';
    const label    = isBehind ? 'Behind' : 'On Schedule';

    el.innerHTML = `Current Time: ${timeStr} <span class="status-badge ${cls}">${label}</span>`;
};


setInterval(updateCurrentTime, 1000);

const saveState = () => {
    localStorage.setItem('selectedIndex',  selectedIndex);
};

const moveUp = () => {
    if (selectedIndex > 0) {
        selectedIndex--;
            saveState(); renderTable(); updateCurrentTime();
    }
};

const moveDown = () => {
    if (selectedIndex < timeSlots.length - 1) {
        selectedIndex++;
            saveState(); renderTable(); updateCurrentTime();
    }
};

const clearState = () => {
    selectedIndex  = 0;
    saveState(); renderTable(); updateCurrentTime();
};

document.getElementById('moveUp').addEventListener('click', moveDown);
document.getElementById('moveDown').addEventListener('click', moveUp);
document.getElementById('clearState').addEventListener('click', clearState);

renderTable();
updateCurrentTime();
