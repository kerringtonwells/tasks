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

// Time slot options (number of 30-min slots to move down)
const TIME_OPTIONS = [3, 6, 12, 18, 24, 30, 60];

const formatSlots = (slots) => String(slots);

const addTodoItem = (itemText, itemCount, todoListElement, lastModifiedParam) => {
    let lastModifiedDate = lastModifiedParam || new Date().toLocaleString();
    const li = document.createElement('li');
    li.setAttribute('draggable', 'true');

    li.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', itemText);
        e.target.classList.add('dragging');
    });
    li.addEventListener('dragend', (e) => { e.target.classList.remove('dragging'); });
    li.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    li.addEventListener('dragenter', (e) => { e.target.classList.add('drag-over'); });
    li.addEventListener('dragleave', (e) => { e.target.classList.remove('drag-over'); });
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
    buttonWrapper.className = 'button-wrapper';
    li.appendChild(buttonWrapper);

    // ── Delete ──
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => {
        todoListElement.removeChild(li);
        saveTodoList(todoListElement);
    });
    buttonWrapper.appendChild(deleteButton);

    // ── Edit ──
    const editButton = document.createElement('button');
    editButton.textContent = 'Edit';
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

    // ── Counter display ──
    const counterSpan = document.createElement('span');
    counterSpan.className = 'count';
    counterSpan.textContent = itemCount || 0;
    buttonWrapper.appendChild(counterSpan);

    // ── Add Time dropdown ──
    const timeWrapper = document.createElement('div');
    timeWrapper.className = 'time-picker-wrapper';
    timeWrapper.style.position = 'relative';
    timeWrapper.style.display = 'inline-block';

    const addTimeButton = document.createElement('button');
    addTimeButton.textContent = 'Add Time';
    addTimeButton.className = 'add-time-btn';

    const timeDropdown = document.createElement('div');
    timeDropdown.className = 'time-dropdown';
    timeDropdown.style.display = 'none';

    TIME_OPTIONS.forEach(slots => {
        const opt = document.createElement('button');
        opt.textContent = formatSlots(slots);
        opt.className = 'time-option-btn';
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            for (let i = 0; i < slots; i++) moveDown();
            counterSpan.textContent = parseInt(counterSpan.textContent) + slots;
            updateLastModifiedDate(li);
            saveTodoList(todoListElement);
            // dropdown stays open so user can keep clicking
        });
        timeDropdown.appendChild(opt);
    });

    addTimeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close any other open dropdowns
        document.querySelectorAll('.time-dropdown').forEach(d => {
            if (d !== timeDropdown) d.style.display = 'none';
        });
        timeDropdown.style.display = timeDropdown.style.display === 'none' ? 'flex' : 'none';
    });

    // Stop clicks inside the dropdown from closing it
    timeDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    document.addEventListener('click', () => {
        timeDropdown.style.display = 'none';
    });

    timeWrapper.appendChild(addTimeButton);
    timeWrapper.appendChild(timeDropdown);
    buttonWrapper.appendChild(timeWrapper);

    // ── +1 Add Todo button ──
    const incrementCounterButton = document.createElement('button');
    incrementCounterButton.textContent = '+1';
    incrementCounterButton.className = 'plus-one-btn';
    incrementCounterButton.title = 'Add to count';
    incrementCounterButton.addEventListener('click', () => {
        counterSpan.textContent = parseInt(counterSpan.textContent) + 1;
        updateLastModifiedDate(li);
        saveTodoList(todoListElement);
    });
    buttonWrapper.appendChild(incrementCounterButton);

    // ── Copy ──
    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy';
    copyButton.addEventListener('click', () => {
        copyToClipboard(itemText);
        showTemporaryMessage('Copied!', buttonWrapper);
    });
    buttonWrapper.appendChild(copyButton);

    // ── Reset ──
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset';
    resetButton.addEventListener('click', () => {
        counterSpan.textContent = 0;
        updateLastModifiedDate(li);
        saveTodoList(todoListElement);
    });
    buttonWrapper.appendChild(resetButton);

    // ── Last modified ──
    const lastModifiedSpan = document.createElement('span');
    lastModifiedSpan.className = 'last-modified';
    lastModifiedSpan.textContent = `Last Modified: ${lastModifiedDate}`;
    lastModifiedSpan.style.display = 'block';
    lastModifiedSpan.style.marginTop = '8px';
    lastModifiedSpan.style.fontSize = '11px';
    lastModifiedSpan.style.opacity = '0.6';
    li.appendChild(lastModifiedSpan);

    todoListElement.appendChild(li);
};

function updateLastModifiedDate(li) {
    let lastModifiedDate = new Date().toLocaleString();
    let lastModifiedSpan = li.querySelector('.last-modified');
    if (!lastModifiedSpan) {
        lastModifiedSpan = document.createElement('span');
        lastModifiedSpan.className = 'last-modified';
        li.appendChild(lastModifiedSpan);
    }
    lastModifiedSpan.textContent = `Last Modified: ${lastModifiedDate}`;
}

document.getElementById('exportTodoList').addEventListener('click', exportTodoList);
document.getElementById('addTodoItem').addEventListener('click', () => {
    const newItemText = prompt('Enter a task:', '');
    if (newItemText) {
        const todoListElement = document.getElementById('todoList');
        addTodoItem(newItemText, 0, todoListElement);
        saveTodoList(todoListElement);
    }
});

loadTodoList();
