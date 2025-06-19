let timeSlots = [];
for (let i = 6; i <= 29; i++) {
    for (let j = 0; j < 2; j++) {
        let startTime = ('0' + i).slice(-2) + ':' + (j === 0 ? '00' : '30');
        let endTime = ('0' + (j === 1 ? i + 1 : i)).slice(-2) + ':' + (j === 0 ? '30' : '00');
        timeSlots.push({ time: `${startTime} - ${endTime}`, status: 0 });
    }
}

let selectedIndex = parseInt(localStorage.getItem('selectedIndex')) || 0;
let startedIndex = parseInt(localStorage.getItem('startedIndex'));
startedIndex = isNaN(startedIndex) ? -1 : startedIndex;
let combineCounter = parseInt(localStorage.getItem('combineCounter')) || 0;
let itemCount = 0;

const formatTime12Hour = (hour24, minute, second) => {
    const ampm = hour24 >= 12 ? 'pm' : 'am';
    const hour12 = hour24 % 12 || 12;
    return `${hour12.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')} ${ampm}`;
};

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

document.getElementById('started').addEventListener('click', () => {
    isButtonClicked = true;
    setStarted();
});

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

// To-Do Section
const loadTodoList = () => {
    const savedTodoList = JSON.parse(localStorage.getItem('todoList')) || [];
    const todoListElement = document.getElementById('todoList');
    savedTodoList.forEach(item => {
        addTodoItem(item.text, item.count, todoListElement, item.lastModified);
    });
};

const saveTodoList = (todoListElement) => {
    const todoItems = Array.from(todoListElement.querySelectorAll('li')).map(li => {
        const span = li.querySelector('span');
        const countSpan = li.querySelector('.count');
        const lastModifiedSpan = li.querySelector('.last-modified');
        const lastModifiedDate = lastModifiedSpan ? lastModifiedSpan.textContent.replace('Last Modified: ', '') : new Date().toLocaleString();
        const textarea = span.querySelector('textarea');
        return {
            text: textarea ? textarea.value.trim() : span.textContent.trim(),
            count: parseInt(countSpan.textContent),
            lastModified: lastModifiedDate
        };
    });
    localStorage.setItem('todoList', JSON.stringify(todoItems));
};

const exportTodoList = () => {
    const todoListElement = document.getElementById('todoList');
    const todoItems = Array.from(todoListElement.querySelectorAll('li span')).map(span => {
        const textarea = span.querySelector('textarea');
        return textarea ? textarea.value.trim() : span.textContent.trim();
    });

    const textToExport = todoItems.join('\n');
    const fileBlob = new Blob([textToExport], { type: 'text/plain;charset=utf-8' });

    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(fileBlob);
    downloadLink.download = 'todo-list.txt';
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
};

document.getElementById('exportTodoList').addEventListener('click', exportTodoList);

const copyToClipboard = (text) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
};

const addTodoItem = (itemText, itemCount, todoListElement, lastModifiedParam) => {
    let lastModifiedDate = lastModifiedParam || new Date().toLocaleString();
    const li = document.createElement('li');
    li.setAttribute('draggable', 'true');

    li.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', itemText);
        e.target.classList.add('dragging');
    });

    li.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging');
    });

    li.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    li.addEventListener('dragenter', (e) => {
        e.target.classList.add('drag-over');
    });

    li.addEventListener('dragleave', (e) => {
        e.target.classList.remove('drag-over');
    });

    li.addEventListener('drop', (e) => {
        e.preventDefault();
        let dropTarget = e.target;
        while (dropTarget.tagName !== 'LI' && dropTarget.parentElement) {
            dropTarget = dropTarget.parentElement;
        }
        if (dropTarget.tagName !== 'LI') return;

        dropTarget.classList.remove('drag-over');
        const droppedText = e.dataTransfer.getData('text/plain');

        if (droppedText !== itemText) {
            const droppedItemIndex = Array.from(todoListElement.children).findIndex(child => child.querySelector('span').textContent.includes(droppedText));
            const currentItemIndex = Array.from(todoListElement.children).findIndex(child => child.querySelector('span').textContent.includes(itemText));
            if (droppedItemIndex > -1 && currentItemIndex > -1) {
                const temp = todoListElement.children[droppedItemIndex];
                if (currentItemIndex < droppedItemIndex) {
                    todoListElement.insertBefore(temp, todoListElement.children[currentItemIndex]);
                    todoListElement.insertBefore(todoListElement.children[currentItemIndex], temp.nextSibling);
                } else {
                    todoListElement.insertBefore(todoListElement.children[currentItemIndex], temp);
                    todoListElement.insertBefore(temp, todoListElement.children[currentItemIndex]);
                }
                saveTodoList(todoListElement);
            }
        }
    });

    const contentWrapper = document.createElement('div');
    const span = document.createElement('span');
    span.textContent = itemText;
    contentWrapper.appendChild(span);
    li.appendChild(contentWrapper);

    const subtasks = document.createElement('ul');
    subtasks.className = 'subtasks';
    contentWrapper.appendChild(subtasks);

    const buttonWrapper = document.createElement('div');
    li.appendChild(buttonWrapper);

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => {
        todoListElement.removeChild(li);
        saveTodoList(todoListElement);
    });
    buttonWrapper.appendChild(deleteButton);

    const editButton = document.createElement('button');
    editButton.textContent = ' Edit';
    editButton.addEventListener('click', () => {
        if (editButton.disabled) return;
        editButton.disabled = true;
        const message = span.textContent;
        const messageParts = message.split('\n');
        let newMessage = messageParts[0] + '\n';
        for (let i = 1; i < messageParts.length; i++) {
            newMessage += messageParts[i].replace(/^- /, '') + '\n';
        }
        newMessage += '\n';
        span.innerHTML = `<textarea>${newMessage}</textarea><button>Save</button>`;
        const saveButton = span.querySelector('button');
        saveButton.addEventListener('click', () => {
            const textarea = span.querySelector('textarea');
            const newMessageParts = textarea.value.split('\n');
            let savedMessage = newMessageParts[0];
            for (let i = 1; i < newMessageParts.length; i++) {
                savedMessage += '\n' + newMessageParts[i];
            }
            span.textContent = savedMessage.trim();
            updateLastModifiedDate(li);
            saveTodoList(todoListElement);
            editButton.disabled = false;
        });
    });
    buttonWrapper.appendChild(editButton);

    const counterSpan = document.createElement('span');
    counterSpan.className = 'count';
    counterSpan.textContent = itemCount || 0;
    buttonWrapper.appendChild(counterSpan);

    const moveDownButton = document.createElement('button');
    moveDownButton.textContent = 'Add Time';
    moveDownButton.addEventListener('click', () => {
        moveDown();
        counterSpan.textContent = parseInt(counterSpan.textContent) + 1;
        updateLastModifiedDate(li);
        saveTodoList(todoListElement);
    });
    buttonWrapper.appendChild(moveDownButton);

    const incrementCounterButton = document.createElement('button');
    incrementCounterButton.textContent = 'Add Todo';
    incrementCounterButton.addEventListener('click', () => {
        counterSpan.textContent = parseInt(counterSpan.textContent) + 1;
        updateLastModifiedDate(li);
        saveTodoList(todoListElement);
    });
    buttonWrapper.appendChild(incrementCounterButton);

    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy';
    copyButton.addEventListener('click', () => {
        copyToClipboard(itemText);
        showTemporaryMessage('Copied to clipboard!', buttonWrapper);
    });
    buttonWrapper.appendChild(copyButton);

    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset';
    resetButton.addEventListener('click', () => {
        counterSpan.textContent = 0;
        updateLastModifiedDate(li);
        saveTodoList(todoListElement);
    });
    buttonWrapper.appendChild(resetButton);

    const lastModifiedSpan = document.createElement('span');
    lastModifiedSpan.className = 'last-modified';
    lastModifiedSpan.textContent = `Last Modified: ${lastModifiedDate}`;
    li.appendChild(lastModifiedSpan);

    todoListElement.appendChild(li);
};

function updateLastModifiedDate(li) {
    let lastModifiedDate = new Date().toLocaleString();
    let lastModifiedSpan = li.querySelector('.last-modified');
    if (!lastModifiedSpan) {
        let br = document.createElement('br');
        lastModifiedSpan = document.createElement('span');
        lastModifiedSpan.className = 'last-modified';
        li.appendChild(br);
        li.appendChild(lastModifiedSpan);
    }
    lastModifiedSpan.textContent = `Last Modified: ${lastModifiedDate}`;
}

const showTemporaryMessage = (message, element) => {
    const tempMessage = document.createElement('span');
    tempMessage.textContent = message;
    tempMessage.style.display = 'inline-block';
    tempMessage.style.marginLeft = '10px';
    tempMessage.style.opacity = '0';
    tempMessage.style.transition = 'opacity 0.2s ease-in-out';
    element.appendChild(tempMessage);
    setTimeout(() => {
        tempMessage.style.opacity = '1';
        setTimeout(() => {
            tempMessage.style.opacity = '0';
            setTimeout(() => {
                element.removeChild(tempMessage);
            }, 1000);
        }, 2000);
    }, 50);
};

document.getElementById('moveUp').addEventListener('click', moveUp);
document.getElementById('moveDown').addEventListener('click', moveDown);
document.getElementById('combine').addEventListener('click', combine);
document.getElementById('clearState').addEventListener('click', clearState);
document.getElementById('started').addEventListener('click', setStarted);
document.getElementById('addTodoItem').addEventListener('click', () => {
    const newItemText = prompt('Enter a task:', '');
    if (newItemText) {
        const todoListElement = document.getElementById('todoList');
        addTodoItem(newItemText, 0, todoListElement);
        saveTodoList(todoListElement);
    }
});

const loadLinksList = () => {
    const savedLinksList = JSON.parse(localStorage.getItem('linksList')) || [];
    const linksListElement = document.getElementById('linksList');
    savedLinksList.sort((a, b) => a.text.toLowerCase().localeCompare(b.text.toLowerCase()));
    savedLinksList.forEach(link => addLink(link, linksListElement));
};

const saveLinksList = (linksListElement) => {
    const linkItems = Array.from(linksListElement.querySelectorAll('li')).map(li => ({
        text: li.querySelector('a').textContent,
        url: li.querySelector('a').href
    }));
    localStorage.setItem('linksList', JSON.stringify(linkItems));
};

const addLink = (linkData, linksListElement) => {
    const createElem = (type, props = {}, ...children) => {
        const el = document.createElement(type);
        Object.entries(props).forEach(([key, value]) => el[key] = value);
        children.forEach(child => el.appendChild(child));
        return el;
    };

    const toggleMenu = (menu) => {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    };

    const li = createElem('li', { className: 'no-bullet' });
    const linkWrapper = createElem('div', { className: 'link-wrapper' });
    const buttonsWrapper = createElem('div', { className: 'buttons-wrapper' });
    const menuIcon = createElem('span', { innerHTML: '⁝', className: 'menu-icon' });

    buttonsWrapper.append(menuIcon);

    const menu = createElem('div', { className: 'menu', style: 'display: none;' });
    const editButton = createElem('button', { textContent: 'Edit' });
    const deleteButton = createElem('button', { textContent: 'Delete' });

    menu.append(editButton, deleteButton);
    buttonsWrapper.append(menu);

    editButton.addEventListener('click', () => {
        const newText = prompt('Enter the new link text:', linkData.text);
        const newUrl = prompt('Enter the new link URL:', linkData.url);
        if (newText && newUrl) {
            linkData.text = newText;
            linkData.url = newUrl;
            a.textContent = newText;
            a.href = newUrl;
            saveLinksList(linksListElement);
        }
    });

    deleteButton.addEventListener('click', () => {
        linksListElement.removeChild(li);
        saveLinksList(linksListElement);
    });

    menuIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu(menu);
    });

    document.addEventListener('click', () => {
        if (menu.style.display === 'block') {
            toggleMenu(menu);
        }
    });

    const a = createElem('a', { href: linkData.url, target: '_blank', textContent: linkData.text, className: 'link-text' });
    linkWrapper.append(buttonsWrapper, a);
    li.append(linkWrapper);
    linksListElement.append(li);
};

document.getElementById('addLink').addEventListener('click', () => {
    const newLinkText = prompt('Enter the link text:', '');
    const newLinkUrl = prompt('Enter the link URL:', 'http://');
    if (newLinkText && newLinkUrl) {
        const linksListElement = document.getElementById('linksList');
        addLink({ text: newLinkText, url: newLinkUrl }, linksListElement);
        saveLinksList(linksListElement);
    }
});

document.addEventListener("DOMContentLoaded", () => {
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

    document.querySelector('.new-container .notes-section').style.display = 'none';
    document.getElementById('showNotes').style.display = 'inline-block';
    document.getElementById('hideNotes').style.display = 'none';

    document.getElementById('hideNotes').addEventListener('click', () => {
        document.querySelector('.new-container .notes-section').style.display = 'none';
        document.getElementById('showNotes').style.display = 'inline-block';
        document.getElementById('hideNotes').style.display = 'none';
    });

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

    displayTime(elapsedTime);

    // Theme Toggle Functionality
    const toggleThemeButton = document.getElementById('toggleTheme');
    const applyTheme = (theme) => {
        document.body.setAttribute('data-theme', theme);
        toggleThemeButton.textContent = theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme';
        localStorage.setItem('theme', theme);
    };

    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);

    toggleThemeButton.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
    });
});

// Notes Section
let openOptionsMenu = null;
const exportButtonNotes = document.getElementById('exportbutton');
document.getElementById('addSubjectBtn').addEventListener('click', () => {
    const subject = prompt('Enter the subject name:');
    if (subject) {
        const subjectElement = createSubjectElement(subject);
        document.getElementById('subjectList').appendChild(subjectElement);
        saveSubjects();
    }
});

const searchBar = document.getElementById('searchBar');
searchBar.addEventListener('input', () => {
    const searchTerm = searchBar.value.toLowerCase();
    const subjectContainers = document.querySelectorAll('.subject-container');

    subjectContainers.forEach(subjectContainer => {
        const subjectTitle = subjectContainer.querySelector('.subject-title');
        const notesList = subjectContainer.querySelector('.notes-list');
        const notes = subjectContainer.querySelectorAll('.note');

        let subjectMatch = subjectTitle.textContent.toLowerCase().includes(searchTerm);
        let notesMatch = false;

        notes.forEach(note => {
            if (note.textContent.toLowerCase().includes(searchTerm)) {
                notesMatch = true;
                note.style.display = 'block';
            } else {
                note.style.display = 'none';
            }
        });

        if (subjectMatch || notesMatch) {
            subjectContainer.style.display = 'flex';
            if (searchTerm !== '') {
                notesList.style.display = 'block';
            } else {
                notesList.style.display = 'none';
            }
        } else {
            subjectContainer.style.display = 'none';
        }
    });
});

function createSubjectElement(subjectName) {
    const subjectContainer = document.createElement('div');
    subjectContainer.classList.add('subject-container');

    const optionsButton = document.createElement('div');
    optionsButton.classList.add('options-button');
    optionsButton.innerHTML = '≡';
    subjectContainer.appendChild(optionsButton);

    const subjectTitle = document.createElement('span');
    subjectTitle.classList.add('subject-title');
    subjectTitle.innerText = subjectName;
    subjectContainer.appendChild(subjectTitle);

    const optionsMenu = document.createElement('div');
    optionsMenu.classList.add('options-menu');
    optionsMenu.style.display = 'none';
    subjectContainer.appendChild(optionsMenu);

    optionsButton.addEventListener('click', (event) => {
        event.stopPropagation();
        if (openOptionsMenu && openOptionsMenu !== optionsMenu) {
            openOptionsMenu.style.display = 'none';
        }
        optionsMenu.style.display = optionsMenu.style.display === 'none' ? 'block' : 'none';
        openOptionsMenu = optionsMenu.style.display === 'block' ? optionsMenu : null;
    });

    const editSubjectBtn = document.createElement('button');
    editSubjectBtn.innerText = 'Edit';
    editSubjectBtn.addEventListener('click', () => {
        const newSubject = prompt('Enter the new subject name:', subjectName);
        if (newSubject) {
            subjectTitle.innerText = newSubject;
        }
        optionsMenu.style.display = 'none';
        saveSubjects();
    });
    optionsMenu.appendChild(editSubjectBtn);

    const deleteSubjectBtn = document.createElement('button');
    deleteSubjectBtn.innerText = 'Delete';
    deleteSubjectBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this subject?')) {
            subjectContainer.remove();
        }
        saveSubjects();
    });
    optionsMenu.appendChild(deleteSubjectBtn);

    const addNoteBtn = document.createElement('button');
    addNoteBtn.innerText = 'Add Note';
    addNoteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        optionsMenu.style.display = 'none';
        const textarea = document.createElement('textarea');
        textarea.style.position = 'absolute';
        textarea.style.bottom = '50%';
        textarea.style.left = '50%';
        textarea.style.transform = 'translateX(-50%)';
        textarea.style.width = '400px';
        textarea.style.height = '100px';
        const confirmBtn = document.createElement('button');
        confirmBtn.innerText = 'OK';
        confirmBtn.style.backgroundColor = 'green';
        confirmBtn.style.position = 'absolute';
        confirmBtn.style.bottom = '45%';
        confirmBtn.style.left = '50%';
        confirmBtn.style.transform = 'translateX(-50%)';

        textarea.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        confirmBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const note = textarea.value;
            if (note) {
                const noteElement = createNoteElement(note);
                notesList.appendChild(noteElement);
            }
            subjectContainer.removeChild(textarea);
            subjectContainer.removeChild(confirmBtn);
            saveSubjects();
        });

        subjectContainer.appendChild(textarea);
        subjectContainer.appendChild(confirmBtn);
    });
    optionsMenu.appendChild(addNoteBtn);

    const notesList = document.createElement('ul');
    notesList.classList.add('notes-list');
    notesList.style.display = 'none';
    subjectContainer.appendChild(notesList);

    subjectContainer.addEventListener('dblclick', (event) => {
        if (event.target !== optionsButton && !optionsButton.contains(event.target)) {
            notesList.style.display = notesList.style.display === 'none' ? 'block' : 'none';
        }
    });

    document.addEventListener('click', () => {
        if (openOptionsMenu) {
            openOptionsMenu.style.display = 'none';
            openOptionsMenu = null;
        }
    });

    return subjectContainer;
}

function createNoteElement(note) {
    const noteElement = document.createElement('li');
    noteElement.classList.add('note');

    const noteTitleWrapper = document.createElement('div');
    noteTitleWrapper.classList.add('note-title-wrapper');
    noteElement.appendChild(noteTitleWrapper);

    const noteTitle = document.createElement('span');
    noteTitle.classList.add('note-title');
    noteTitle.innerText = note;
    noteElement.originalNote = note;
    noteTitleWrapper.appendChild(noteTitle);

    const buttonWrapper = document.createElement('div');
    buttonWrapper.classList.add('note-button-wrapper');
    noteElement.appendChild(buttonWrapper);

    const addNoteAboveBtn = document.createElement('button');
    addNoteAboveBtn.innerText = 'Add Above';
    addNoteAboveBtn.addEventListener('click', () => {
        const newNote = prompt('Enter the note content:');
        if (newNote) {
            const newNoteElement = createNoteElement(newNote);
            noteElement.parentNode.insertBefore(newNoteElement, noteElement);
        }
        saveSubjects();
    });
    buttonWrapper.appendChild(addNoteAboveBtn);

    const addNoteBelowBtn = document.createElement('button');
    addNoteBelowBtn.innerText = 'Add Below';
    addNoteBelowBtn.addEventListener('click', () => {
        const newNote = prompt('Enter the note content:');
        if (newNote) {
            const newNoteElement = createNoteElement(newNote);
            noteElement.parentNode.insertBefore(newNoteElement, noteElement.nextSibling);
        }
        saveSubjects();
    });
    buttonWrapper.appendChild(addNoteBelowBtn);

    const editBtn = document.createElement('button');
    editBtn.innerText = 'Edit';
    editBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const textarea = document.createElement('textarea');
        textarea.value = noteElement.originalNote;
        const confirmBtn = document.createElement('button');
        confirmBtn.innerText = 'OK';

        textarea.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        confirmBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const newNote = textarea.value;
            if (newNote) {
                noteElement.originalNote = newNote;
                noteTitle.innerHTML = newNote.replace(/^ +/gm, match => '&nbsp;'.repeat(match.length)).replace(/\n/g, '<br>');
            }
            noteElement.removeChild(textarea);
            noteElement.removeChild(confirmBtn);
            saveSubjects();
        });

        noteElement.appendChild(textarea);
        noteElement.appendChild(confirmBtn);
    });
    buttonWrapper.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.innerText = 'Delete';
    deleteBtn.addEventListener('click', () => {
        event.stopPropagation();
        if (confirm('Are you sure you want to delete this note?')) {
            noteElement.remove();
        }
        saveSubjects();
    });
    buttonWrapper.appendChild(deleteBtn);

    const copyBtn = document.createElement('button');
    copyBtn.innerText = 'Copy';
    copyBtn.addEventListener('click', () => {
        event.stopPropagation();
        const textArea = document.createElement('textarea');
        textArea.value = noteElement.originalNote;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showTemporaryMessage('Copied to clipboard!', buttonWrapper);
    });
    buttonWrapper.appendChild(copyBtn);

    return noteElement;
}

function saveData(subjects) {
    localStorage.setItem('subjects', JSON.stringify(subjects));
}

function saveSubjects() {
    const subjects = [];
    document.querySelectorAll('.subject-container').forEach(subjectContainer => {
        const subject = {
            name: subjectContainer.querySelector('.subject-title').textContent,
            notes: []
        };
        subjectContainer.querySelectorAll('.note').forEach(noteElement => {
            const encodedNote = encodeURIComponent(noteElement.originalNote);
            subject.notes.push(encodedNote);
        });
        subjects.push(subject);
    });
    saveData(subjects);
    exportButtonNotes.style.display = subjects.length > 0 ? 'block' : 'none';
}

function loadData() {
    const storedData = localStorage.getItem('subjects');
    const subjects = storedData ? JSON.parse(storedData) : [];
    subjects.forEach(subject => {
        subject.notes = subject.notes.map(note => decodeURIComponent(note));
    });
    return subjects;
}

function exportDataToTxt() {
    const subjects = loadData();
    let textData = '';
    subjects.forEach((subject, subjectIndex) => {
        textData += `Subject ${subjectIndex + 1}: ${subject.name}\n`;
        subject.notes.forEach((note, noteIndex) => {
            textData += `  Note ${noteIndex + 1}: ${note}\n`;
        });
        textData += '\n';
    });
    download('subjects_and_notes.txt', textData);
}

function download(filename, text) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

exportButtonNotes.addEventListener('click', () => {
    exportDataToTxt();
});

document.addEventListener('DOMContentLoaded', () => {
    const storedSubjects = loadData();
    const subjectList = document.getElementById('subjectList');
    storedSubjects.forEach(subject => {
        const subjectElement = createSubjectElement(subject.name);
        subjectList.appendChild(subjectElement);
        const notesList = subjectElement.querySelector('.notes-list');
        subject.notes.forEach(note => {
            const noteElement = createNoteElement(note);
            notesList.appendChild(noteElement);
        });
    });
    saveSubjects();
});

document.getElementById('showNotes').addEventListener('click', () => {
    showNotesOnly();
});

document.getElementById('hideNotes').addEventListener('click', () => {
    hideNotesContent();
});

function showNotesOnly() {
    document.querySelectorAll('.container').forEach(el => {
        el.style.display = 'none';
    });
    document.querySelector('.new-container h2:nth-child(1)').style.display = 'none';
    document.querySelector('.new-container .stopwatch').style.display = 'none';
    document.getElementById('showNotes').style.display = 'none';
    document.getElementById('hideNotes').style.display = 'inline-block';
    document.querySelector('.new-container .notes-section').style.display = 'flex';
}

function hideNotesContent() {
    document.querySelectorAll('.container').forEach(el => {
        el.style.display = 'block';
    });
    document.querySelector('.new-container h2:nth-child(1)').style.display = 'block';
    document.querySelector('.new-container .stopwatch').style.display = 'block';
    const notesSearch = document.querySelector('.new-container .notes-search');
    if (notesSearch) {
        notesSearch.style.display = 'none';
    }
    document.querySelector('.new-container .notes-section').style.display = 'none';
    document.getElementById('showNotes').style.display = 'inline-block';
    document.getElementById('hideNotes').style.display = 'none';
}

document.getElementById('showNotes').addEventListener('click', () => {
    document.querySelector('.new-container .notes-section').style.display = 'block';
    document.getElementById('showNotes').style.display = 'none';
    document.getElementById('hideNotes').style.display = 'inline-block';
});

document.getElementById('hideNotes').addEventListener('click', () => {
    document.querySelector('.new-container .notes-section').style.display = 'none';
    document.getElementById('showNotes').style.display = 'inline-block';
    document.getElementById('hideNotes').style.display = 'none';
});

// Initialization
loadLinksList();
renderTable();
updateCurrentTime();
updateCombineCounter();
loadTodoList();
