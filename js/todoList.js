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
