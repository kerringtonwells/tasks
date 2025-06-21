let openOptionsMenu = null;

const exportButtonNotes = document.getElementById('exportbutton');
const searchBar = document.getElementById('searchBar');

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
                noteTitle.innerHTML = newNote.replace(/^ +/gm, match => ' '.repeat(match.length)).replace(/\n/g, '<br>');
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

document.querySelector('.new-container .notes-section').style.display = 'none';
document.getElementById('showNotes').style.display = 'inline-block';
document.getElementById('hideNotes').style.display = 'none';

document.getElementById('hideNotes').addEventListener('click', () => {
    document.querySelector('.new-container .notes-section').style.display = 'none';
    document.getElementById('showNotes').style.display = 'inline-block';
    document.getElementById('hideNotes').style.display = 'none';
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
