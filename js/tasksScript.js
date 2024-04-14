
let timeSlots = []; // Initialize an empty array called timeSlots
for (let i = 6; i <= 29; i++) { // Iterate from 6AM to 3AM the next day
for (let j = 0; j < 2; j++) { // Iterate twice for every hour (for 30 minute increments)
    let startTime = ('0' + i).slice(-2) + ':' + (j === 0 ? '00' : '30'); // Create a start time for the time slot
    let endTime = ('0' + (j === 1 ? i + 1 : i)).slice(-2) + ':' + (j === 0 ? '30' : '00'); // Create an end time for the time slot
    timeSlots.push({ time: `${startTime} - ${endTime}`, status: 0 }); // Add the time slot to the timeSlots array with a status of 0
}
}

let selectedIndex = parseInt(localStorage.getItem('selectedIndex')) || 0; // Get the selected index from localStorage or use 0 if it's not set
let startedIndex = parseInt(localStorage.getItem('startedIndex')); // Get the started index from localStorage
startedIndex = isNaN(startedIndex) ? -1 : startedIndex; // If startedIndex is NaN, set it to -1
let combineCounter = parseInt(localStorage.getItem('combineCounter')) || 0; // Get the combine counter from localStorage or use 0 if it's not set
let itemCount = 0;

const formatTime12Hour = (hour24, minute, second) => {
const ampm = hour24 >= 12 ? 'pm' : 'am';
const hour12 = hour24 % 12 || 12;
if (hour12 === 0) {
    hour12 = 12;
}
return `${hour12.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')} ${ampm}`;
};

const formatTimeSlot12Hour = (startHour, startMinute) => { // Define a function that formats a time slot in 12-hour format
let startHour24 = parseInt(startHour);
if (startHour24 >= 24) {
    startHour24 -= 24;
}
const start12Hour = formatTime12Hour(startHour24, parseInt(startMinute), 0); // Convert the start time to 12-hour format
return start12Hour; // Return the formatted time
};


const createRow = (timeSlot, index) => { // Define a function that creates a row for the time table
    const row = document.createElement('tr'); // Create a new table row
    if (index === startedIndex) row.classList.add('started'); // If this is the started row, add the 'started' class
    if (index === selectedIndex) row.classList.add('current'); // If this is the selected row, add the 'current' class

    const timeCell = document.createElement('td'); // Create a new table cell for the time
    const [startHour, startMinute] = timeSlot.time.split('-')[0].trim().split(':'); // Get the start time from the time slot
    const [endHour, endMinute] = timeSlot.time.split('-')[1].trim().split(':'); // Get the end time from the time slot
    // Set the content of the time cell to the formatted start and end times
    timeCell.textContent = `${formatTimeSlot12Hour(startHour, startMinute)} - ${formatTimeSlot12Hour(endHour, endMinute)}`;
    // Add the time cell to the row
    row.appendChild(timeCell);

    // Create a new table cell for the status
    const statusCell = document.createElement('td');

    // If this is the started row and there is a started index
    if (index === startedIndex && startedIndex !== -1) {
    // Create a new span element for the status
    const statusText = document.createElement('span');
    // Set the text of the span to 'Start Time'
    statusText.textContent = 'Start Time';
    // Add the span to the status cell
    statusCell.appendChild(statusText);
    } else {
    // Create a new input element for the status
    const statusInput = document.createElement('input');
    // Set the input type to 'number'
    statusInput.type = 'number';
    // Set the initial value of the input to the status of the time slot
    statusInput.value = timeSlot.status;
    // Set the minimum value of the input to 0
    statusInput.min = 0;
    // Set the class name of the input to 'status-input'
    statusInput.className = 'status-input';
    // Add an event listener to the input that updates the status of the time slot when the input changes
    statusInput.addEventListener('input', (e) => {
        timeSlot.status = parseInt(e.target.value) || 0;
    });
    // Add an event listener to the input that clears the input value when clicked
    statusInput.addEventListener('click', (e) => {
        e.target.value = '';
    });
    // Add the input to the status cell
    statusCell.appendChild(statusInput);
    }

    // Add the status cell to the row
    row.appendChild(statusCell);

    // Return the row
    return row;
};

// Define a function that renders the time table
const renderTable = () => {
    // Get the time table element
    const timeTable = document.getElementById('timeTable');
    // Clear the contents of the time table
    timeTable.innerHTML = '';

    // If there is a started row
    if (startedIndex !== -1) {
    // Add the started row to the time table
    timeTable.appendChild(createRow(timeSlots[startedIndex], startedIndex));
    // If the started row is not the selected row, add the selected row to the time table
    if (startedIndex !== selectedIndex) {
        timeTable.appendChild(createRow(timeSlots[selectedIndex], selectedIndex));
    }
    } else {
    // Add the selected row to the time table
    timeTable.appendChild(createRow(timeSlots[selectedIndex], selectedIndex));
    }
};
// Define a function that updates the current time and status
const updateCurrentTime = () => {
    // Get the current date and time
    const now = new Date();
    // Get the current hours, minutes, and seconds
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    // Format the current time into 12-hour format with AM/PM
    const currentTime12Hour = formatTime12Hour(hours, minutes, seconds);

    // Get the current time element from the HTML
    const currentTimeElement = document.getElementById('currentTime');
    // Set the text of the current time element to the formatted time with AM/PM
    currentTimeElement.textContent = `Current Time: ${currentTime12Hour}`;

    // If there is a selected row
    if (selectedIndex >= 0 && selectedIndex < timeSlots.length) {
    // Get the start time of the selected time slot
    const currentSlotTimeString = timeSlots[selectedIndex].time.split('-')[0].trim();
    // Get the hours and minutes of the start time
    const [slotHour, slotMinute] = currentSlotTimeString.split(':');
    // Convert the hours to 24-hour format
    const slotHour24 = parseInt(slotHour);

    // Create a new date object with the current date and time
    const slotDate = new Date(now);
    // Set the hours, minutes, and seconds of the new date object to the start time of the selected time slot
    slotDate.setHours(slotHour24, parseInt(slotMinute), 0);

    // Create a new span element for the status message
    const statusMessage = document.createElement('span');
    // Set the text of the status message to 'Behind' or 'On Schedule' depending on whether the current time is behind or on schedule
    statusMessage.textContent = (now >= slotDate) ? ' (Behind)' : ' (On Schedule)';
    // Set the background color of the status message to red if behind, green if on schedule
    statusMessage.style.backgroundColor = (now >= slotDate) ? 'red' : 'green';
    // Set the text color of the status message to black
    statusMessage.style.color = 'black';

    // Remove the old statusMessage element before appending the new one
    const oldStatusMessage = currentTimeElement.querySelector('span');
    if (oldStatusMessage) currentTimeElement.removeChild(oldStatusMessage);

    // Add the status message to the current time element
    currentTimeElement.appendChild(statusMessage);
    }
};


// Call updateCurrentTime every second
setInterval(updateCurrentTime, 1000);

// Define a function that updates the combine counter display
const updateCombineCounter = () => {
    // Get the combine counter element from the HTML
    document.getElementById('combineCounter').textContent = `Combine Counter: ${combineCounter}`;
};

// Define a function that saves the current state of the app to local storage
const saveState = () => {
    // Save the selected index, started index, and combine counter to local storage
    localStorage.setItem('selectedIndex', selectedIndex);
    localStorage.setItem('startedIndex', startedIndex);
    localStorage.setItem('combineCounter', combineCounter); 
};

// Define a function that moves the selected index up one row
const moveUp = () => {
    // If the selected index is greater than 0 or if it is 1 and there is a started row
    if (selectedIndex > 0 || (selectedIndex === 1 && startedIndex !== -1)) {
    // Decrement the selected index by 1
    selectedIndex--;

    // Decrement the combineCounter by 1 when moving up
    combineCounter--;

    // Save the state to local storage, render the table, update the current time, and update the combine counter
    saveState();
    renderTable();
    updateCurrentTime();
    updateCombineCounter();
    }
};

// Define a function that moves the selected index down one row
const moveDown = () => {
    // If the selected index is less than the length of the timeSlots array - 1
    if (selectedIndex < timeSlots.length - 1) {
    // Increment the selected index by 1
    selectedIndex++;
    // Increment the combineCounter by 1 when moving down
    combineCounter++;
    // Save the state to local storage, render the table, update the current time, and update the combine counter
    saveState();
    renderTable();
    updateCurrentTime();
    updateCombineCounter();
    }
};

// Define a function that clears the current state of the app and resets it to the initial state
const clearState = () => {
    // Set the selected index to 0, started index to -1, and combine counter to 0
    selectedIndex = 0;
    startedIndex = -1;
    combineCounter = 0;
    // Save the state to local storage, render the table, update the current time, and update the combine counter
    saveState();
    renderTable();
    updateCurrentTime();
    updateCombineCounter();
};

// Add a new variable to store if the button was clicked
let isButtonClicked = false;

const setStarted = () => {
    const buttonClicked = performance.navigation.type !== 1; // Check if the page was refreshed

    if (!buttonClicked && startedIndex !== selectedIndex) { // Only set started if button wasn't clicked and index changed
        startedIndex = selectedIndex;
        timeSlots[startedIndex].status = 'Start Time'; // Update status of the current timeslot to "Start Time"
        saveState();
        renderTable();
        updateCurrentTime();
    }
};

// Add an event listener for the button click
document.getElementById('started').addEventListener('click', () => {
    isButtonClicked = true;
    setStarted();
});

const combine = () => {
    // Get the status value of the selected time slot
    const currentStatus = timeSlots[selectedIndex].status;
    // Add the currentStatus value to the combineCounter
    combineCounter += currentStatus;
    // Reset the status value of the selected time slot
    timeSlots[selectedIndex].status = 0;

    // Increment selectedIndex based on the value of combineCounter
    if (combineCounter >= 15) {
    selectedIndex += 3;
    } else if (combineCounter >= 7 && combineCounter < 15) {
    selectedIndex += 2;
    } else {
    selectedIndex += 1;
    }

    // Check if the selectedIndex value is greater than or equal to the length of the timeSlots array
    if (selectedIndex >= timeSlots.length) selectedIndex = timeSlots.length - 1;

    // Save the current state to localStorage
    saveState();
    // Render the table with the updated time slots
    renderTable();
    // Update the current time display
    updateCurrentTime();
    // Update the combine counter display
    updateCombineCounter();
};



//Start To-Do Section  ===================================================================================================

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
        // Check if the span contains a textarea (which indicates an edit in progress)
        const textarea = span.querySelector('textarea');
        if (textarea) {
            // If a textarea is found, use its value
            return textarea.value.trim();
        } else {
            // Otherwise, use the original span text content
            return span.textContent.trim();
        }
    });

    // Create a Blob with the to-do list items
    const textToExport = todoItems.join('\n');
    const fileBlob = new Blob([textToExport], { type: 'text/plain;charset=utf-8' });

    // Create a download link and trigger the download
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(fileBlob);
    downloadLink.download = 'todo-list.txt';
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
};

// Add the event listener for the export button
document.getElementById('exportTodoList').addEventListener('click', exportTodoList);

// Add this function to copy the text to clipboard
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
    li.setAttribute('draggable', 'true'); // Make the list item draggable

    // Add drag and drop event listeners
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

        // Find the closest <li> element as the drop target
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
};

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
    //Start delete button ========================================
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => {
        todoListElement.removeChild(li);
        saveTodoList(todoListElement);
    });
    buttonWrapper.appendChild(deleteButton);
    //Start button ========================================
    const editButton = document.createElement('button');
    editButton.textContent = ' Edit';
    editButton.addEventListener('click', () => {
        // Check if already editing
        if (editButton.disabled) return;

        // Disable the edit button while editing
        editButton.disabled = true;

        const message = span.textContent;
        const messageParts = message.split('\n');
        let newMessage = messageParts[0] + '\n';
        for (let i = 1; i < messageParts.length; i++) {
        newMessage += '- ' + messageParts[i].replace(/^- /, '') + '\n';
        }
        newMessage += '- ';
        span.innerHTML = `<textarea>${newMessage}</textarea><button>Save</button>`;
        const saveButton = span.querySelector('button');
        saveButton.addEventListener('click', () => {
        const textarea = span.querySelector('textarea');
        const newMessageParts = textarea.value.split('\n');
        let savedMessage = newMessageParts[0];
        for (let i = 1; i < newMessageParts.length; i++) {
            if (newMessageParts[i].startsWith('- ')) {
            savedMessage += '\n' + newMessageParts[i];
            } else {
            savedMessage += '\n' + newMessageParts[i].substr(2);
            }
        }
        span.textContent = savedMessage;
        updateLastModifiedDate(li);
        saveTodoList(todoListElement);

        // Re-enable the edit button after saving
        editButton.disabled = false;
        });
    });
    buttonWrapper.appendChild(editButton);

    const counterSpan = document.createElement('span');
    counterSpan.className = 'count';  // Add a class to the counter span
    // itemCount is used here as initial value of counterSpan
    counterSpan.textContent = itemCount || 0;
    buttonWrapper.appendChild(counterSpan);

    // Move down Button ========================================
    const moveDownButton = document.createElement('button');
    moveDownButton.textContent = 'Add Time';
    moveDownButton.addEventListener('click', () => {
        moveDown();
        counterSpan.textContent = parseInt(counterSpan.textContent) + 1;
        updateLastModifiedDate(li);
        saveTodoList(todoListElement);
    });

    buttonWrapper.appendChild(moveDownButton);

    // Append button wrapper to list item
    li.appendChild(buttonWrapper);
    todoListElement.appendChild(li);

    // Increment Todo 
    const incrementCounterButton = document.createElement('button');
    incrementCounterButton.textContent = 'Add Todo';
    incrementCounterButton.addEventListener('click', () => {
        counterSpan.textContent = parseInt(counterSpan.textContent) + 1;
        updateLastModifiedDate(li);
        saveTodoList(todoListElement);
    });

    buttonWrapper.appendChild(incrementCounterButton);

    // Start copy button ========================================
    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy';
    copyButton.addEventListener('click', () => {
        copyToClipboard(itemText);
        showTemporaryMessage('Copied to clipboard!', buttonWrapper);
    });
    buttonWrapper.appendChild(copyButton);

    // Reset Button ========================================
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

    // Show the message and then fade it out after 2 seconds
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
// End To-Do Section  ===================================================================================================
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
    
    // Sort the savedLinksList array in alphabetical order based on the 'text' property
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
    const menuIcon = createElem('span', { innerHTML: '■', className: 'menu-icon' });

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

    const startBtn = document.getElementById("startBtn");
    const pauseBtn = document.getElementById("pauseBtn");
    const resetBtn = document.getElementById("resetBtn");
    const timeDisplay = document.querySelector(".time-display");
    const hoursSpan = timeDisplay.querySelector(".hours");
    const minutesSpan = timeDisplay.querySelector(".minutes");
    const secondsSpan = timeDisplay.querySelector(".seconds");
    const millisecondsSpan = timeDisplay.querySelector(".milliseconds");

    // Hide the notes section by default
    document.querySelector('.new-container .notes-section').style.display = 'none';

    // Show the "Show Notes" button and hide the "Show All" button by default
    document.getElementById('showNotes').style.display = 'inline-block';
    document.getElementById('hideNotes').style.display = 'none';

    // Add the event listener for the 'hideNotes' button
    document.getElementById('hideNotes').addEventListener('click', () => {
        hideNotesContent();
    });

    startBtn.addEventListener("click", () => {
        if (!running) {
            startTime = Date.now() - elapsedTime;
            timer = setInterval(updateTime, 10);
            running = true;
            toggleButtons('start');
        }
    });

    pauseBtn.addEventListener("click", () => {
        if (running) {
            clearInterval(timer);
            running = false;
            toggleButtons('pause');
        }
    });

    resetBtn.addEventListener("click", () => {
        if (running) {
            clearInterval(timer);
            running = false;
            toggleButtons('pause');
        }
        elapsedTime = 0;
        displayTime(0);
        toggleButtons('reset');
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

    // Display the initial time
    displayTime(elapsedTime);
});

// Begin Notes Section  ===================================================================================================
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

// CREATE SUBJECT ELEMENT -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
function createSubjectElement(subjectName) {
    const subjectContainer = document.createElement('div');
    subjectContainer.classList.add('subject-container');

    const optionsButton = document.createElement('div');
    optionsButton.classList.add('options-button');
    optionsButton.innerHTML = '&#x2261;'; // Hamburger menu icon (≡)
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

        // Hide the options menu
        optionsMenu.style.display = 'none';

        // Create a textarea and a confirm button
        const textarea = document.createElement('textarea');
        textarea.style.position = 'absolute';
        textarea.style.bottom = '50%';  // position at the bottom of the page
        textarea.style.left = '50%';  // center it horizontally
        textarea.style.transform = 'translateX(-50%)';  // adjust for the width of the textarea
        textarea.style.width = '400px';  // set the width
        textarea.style.height = '100px';  // set the height
        const confirmBtn = document.createElement('button');
        confirmBtn.innerText = 'OK';
        confirmBtn.style.backgroundColor = 'green';
        confirmBtn.style.position = 'absolute';
        confirmBtn.style.bottom = '45%'; // adjust the bottom position
        confirmBtn.style.left = '50%';
        confirmBtn.style.transform = 'translateX(-50%)';

        // When the textarea is clicked
        textarea.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        // When the confirm button is clicked
        confirmBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const note = textarea.value;
            if (note) {
                const noteElement = createNoteElement(note);
                notesList.appendChild(noteElement);
            }
            // Remove the textarea and the confirm button from the document
            subjectContainer.removeChild(textarea);
            subjectContainer.removeChild(confirmBtn);
            saveSubjects();
        });

        // Add the textarea and the confirm button to the document
        subjectContainer.appendChild(textarea);
        subjectContainer.appendChild(confirmBtn);
    });

    optionsMenu.appendChild(addNoteBtn);


    const notesList = document.createElement('ul');
    notesList.classList.add('notes-list');
    notesList.style.display = 'none';
    subjectContainer.appendChild(notesList);
    // Add the event listener so that double-clicking anywhere on the subject container toggles the notes list
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
// END SUBJECT ELEMENT -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
// what is the code below doing?

// CREATE NOTE ELEMENT -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
function createNoteElement(note) {
    const noteElement = document.createElement('li');
    noteElement.classList.add('note');

    const noteTitleWrapper = document.createElement('div');
    noteTitleWrapper.classList.add('note-title-wrapper');
    noteElement.appendChild(noteTitleWrapper);

    const noteTitle = document.createElement('span');
    noteTitle.classList.add('note-title');
    // Convert newline characters into <br> tags
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

        // Create a textarea and a confirm button
        const textarea = document.createElement('textarea');
        // Convert <br> tags back into newline characters
        textarea.value = noteElement.originalNote;
        const confirmBtn = document.createElement('button');
        confirmBtn.innerText = 'OK';

        // When the textarea is clicked
        textarea.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        // When the confirm button is clicked
        confirmBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const newNote = textarea.value;
            if (newNote) {
                // Save the new note to noteElement.originalNote
                noteElement.originalNote = newNote;
                // Format the new note for display
                noteTitle.innerHTML = newNote.replace(/^ +/gm, match => '&nbsp;'.repeat(match.length)).replace(/\n/g, '<br>');
            }
            // Remove the textarea and the confirm button from the document
            noteElement.removeChild(textarea);
            noteElement.removeChild(confirmBtn);
            saveSubjects();
        });

        // Add the textarea and the confirm button to the document
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
// END CREATE NOTE ELEMENT -----------------------------------------------------------------------------------------------------------------------------------------------------------------------

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
            // Save noteElement.originalNote instead of the formatted HTML
            const encodedNote = encodeURIComponent(noteElement.originalNote);
            subject.notes.push(encodedNote);
        });

        subjects.push(subject);
    });

    saveData(subjects);

    // Show or hide the export button based on the number of subjects
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



    // This is for exorting notes to a text file

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

    // Add this code snippet to your existing code
    // This creates an "Export" button that will call the exportDataToTxt function when clicked

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
        saveSubjects(); // Add this line
    });


    // Add event listeners for the showNotes and hideNotes buttons
    document.getElementById('showNotes').addEventListener('click', () => {
        showNotesOnly();
    });

    document.getElementById('hideNotes').addEventListener('click', () => {
        hideNotesContent();
    });


    // Function to show only the notes section
    function showNotesOnly() {
        document.querySelectorAll('.container').forEach(el => {
            el.style.display = 'none';
        });

        document.querySelector('.new-container h2:nth-child(1)').style.display = 'none';
        document.querySelector('.new-container .stopwatch').style.display = 'none';

        document.getElementById('showNotes').style.display = 'none';
        document.getElementById('hideNotes').style.display = 'inline-block';

        // Show notes search, notes section, and export button
        document.querySelector('.new-container .notes-section').style.display = 'flex';
    }

    // Function to show all content
    function hideNotesContent() {
        // Show all tasks
        document.querySelectorAll('.container').forEach(el => {
            el.style.display = 'block';
        });

        // Show task title and stopwatch
        document.querySelector('.new-container h2:nth-child(1)').style.display = 'block';
        document.querySelector('.new-container .stopwatch').style.display = 'block';

        // Hide notes search and notes section
        const notesSearch = document.querySelector('.new-container .notes-search');
        if (notesSearch) {
            notesSearch.style.display = 'none';
        }
        document.querySelector('.new-container .notes-section').style.display = 'none';
    }

    document.getElementById('showNotes').addEventListener('click', () => {
        showNotesOnly();
    });

    document.getElementById('hideNotes').addEventListener('click', () => {
        hideNotesContent();
    });


    // Function to show all content
    function hideNotesContent() {
        // Show all tasks
        document.querySelectorAll('.container').forEach(el => {
            el.style.display = 'block';
        });

        // Show task title and stopwatch
        document.querySelector('.new-container h2:nth-child(1)').style.display = 'block';
        document.querySelector('.new-container .stopwatch').style.display = 'block';

        // Hide notes search and notes section
        const notesSearch = document.querySelector('.new-container .notes-search');
        if (notesSearch) {
            notesSearch.style.display = 'none';
        }
        document.querySelector('.new-container .notes-section').style.display = 'none';

        // Show "Show Notes" button and hide "Hide Notes" button
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

    //End Notes Section  ===================================================================================================



    // Initialization
    loadLinksList();
    renderTable();
    updateCurrentTime();
    updateCombineCounter();
    loadTodoList();
