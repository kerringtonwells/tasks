const formatTimeSlot12Hour = (startHour, startMinute) => {
    let startHour24 = parseInt(startHour);
    if (startHour24 >= 24) {
        startHour24 -= 24;
    }
    const start12Hour = formatTime12Hour(startHour24, parseInt(startMinute), 0);
    return start12Hour;
};

const createRow = (timeSlot, index) => {
    const row = document.createElement('tr');
    if (index === startedIndex) row.classList.add('started');
    if (index === selectedIndex) row.classList.add('current');

    const timeCell = document.createElement('td');
    const [startHour, startMinute] = timeSlot.time.split('-')[0].trim().split(':');
    const [endHour, endMinute] = timeSlot.time.split('-')[1].trim().split(':');
    timeCell.textContent = `${formatTimeSlot12Hour(startHour, startMinute)} - ${formatTimeSlot12Hour(endHour, endMinute)}`;
    row.appendChild(timeCell);

    return row;
};

const renderTable = () => {
    const timeTable = document.getElementById('timeTable');
    timeTable.innerHTML = '';

    if (startedIndex !== -1) {
        timeTable.appendChild(createRow(timeSlots[startedIndex], startedIndex));
        if (startedIndex !== selectedIndex) {
            timeTable.appendChild(createRow(timeSlots[selectedIndex], selectedIndex));
        }
    } else {
        timeTable.appendChild(createRow(timeSlots[selectedIndex], selectedIndex));
    }
};

const updateCurrentTime = () => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const currentTime12Hour = formatTime12Hour(hours, minutes, seconds);

    const currentTimeElement = document.getElementById('currentTime');
    currentTimeElement.textContent = `Current Time: ${currentTime12Hour}`;

    if (selectedIndex >= 0 && selectedIndex < timeSlots.length) {
        const currentSlotTimeString = timeSlots[selectedIndex].time.split('-')[0].trim();
        const [slotHour, slotMinute] = currentSlotTimeString.split(':');
        const slotHour24 = parseInt(slotHour);

        const slotDate = new Date(now);
        slotDate.setHours(slotHour24, parseInt(slotMinute), 0);

        const statusMessage = document.createElement('span');
        statusMessage.textContent = (now >= slotDate) ? ' (Behind)' : ' (On Schedule)';
        statusMessage.style.backgroundColor = (now >= slotDate) ? 'red' : 'green';
        statusMessage.style.color = 'black';

        const oldStatusMessage = currentTimeElement.querySelector('span');
        if (oldStatusMessage) currentTimeElement.removeChild(oldStatusMessage);

        currentTimeElement.appendChild(statusMessage);
    }
};

setInterval(updateCurrentTime, 1000);

const updateCombineCounter = () => {
    document.getElementById('combineCounter').textContent = `Combine Counter: ${combineCounter}`;
};

const saveState = () => {
    localStorage.setItem('selectedIndex', selectedIndex);
    localStorage.setItem('startedIndex', startedIndex);
    localStorage.setItem('combineCounter', combineCounter);
};

const moveUp = () => {
    if (selectedIndex > 0 || (selectedIndex === 1 && startedIndex !== -1)) {
        selectedIndex--;
        combineCounter--;
        saveState();
        renderTable();
        updateCurrentTime();
        updateCombineCounter();
    }
};

const moveDown = () => {
    if (selectedIndex < timeSlots.length - 1) {
        selectedIndex++;
        combineCounter++;
        saveState();
        renderTable();
        updateCurrentTime();
        updateCombineCounter();
    }
};

const clearState = () => {
    selectedIndex = 0;
    startedIndex = -1;
    combineCounter = 0;
    saveState();
    renderTable();
    updateCurrentTime();
    updateCombineCounter();
};

let isButtonClicked = false;

const setStarted = () => {
    const buttonClicked = performance.navigation.type !== 1;
    if (!buttonClicked && startedIndex !== selectedIndex) {
        startedIndex = selectedIndex;
        timeSlots[startedIndex].status = 'Start Time';
        saveState();
        renderTable();
        updateCurrentTime();
    }
};

const combine = () => {
    const currentStatus = timeSlots[selectedIndex].status;
    combineCounter += currentStatus;
    timeSlots[selectedIndex].status = 0;

    if (combineCounter >= 15) {
        selectedIndex += 3;
    } else if (combineCounter >= 7 && combineCounter < 15) {
        selectedIndex += 2;
    } else {
        selectedIndex += 1;
    }

    if (selectedIndex >= timeSlots.length) selectedIndex = timeSlots.length - 1;

    saveState();
    renderTable();
    updateCurrentTime();
    updateCombineCounter();
};

document.getElementById('moveUp').addEventListener('click', moveUp);
document.getElementById('moveDown').addEventListener('click', moveDown);
document.getElementById('combine').addEventListener('click', combine);
document.getElementById('clearState').addEventListener('click', clearState);
document.getElementById('started').addEventListener('click', () => {
    isButtonClicked = true;
    setStarted();
});

renderTable();
updateCurrentTime();
updateCombineCounter();
