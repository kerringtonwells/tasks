// ── Image helpers (mirrors notes.js approach) ─────────────────────────────────
const IDB_NAME_TODO = 'kwells_notes', IDB_STORE_TODO = 'images'; // shared IDB with notes
let idbTodo = null;

function openIDBTodo() {
    if (idbTodo) return Promise.resolve(idbTodo);
    return new Promise((res, rej) => {
        const req = indexedDB.open(IDB_NAME_TODO, 1);
        req.onupgradeneeded = e => {
            if (!e.target.result.objectStoreNames.contains(IDB_STORE_TODO))
                e.target.result.createObjectStore(IDB_STORE_TODO);
        };
        req.onsuccess = e => { idbTodo = e.target.result; res(idbTodo); };
        req.onerror   = e => rej(e.target.error);
    });
}

function idbPutTodo(id, url) {
    return openIDBTodo().then(db => new Promise((res, rej) => {
        const tx = db.transaction(IDB_STORE_TODO, 'readwrite');
        const req = tx.objectStore(IDB_STORE_TODO).put(url, id);
        req.onsuccess = () => res(req.result);
        req.onerror   = e => rej(e.target.error);
    }));
}

function idbGetTodo(id) {
    return openIDBTodo().then(db => new Promise((res, rej) => {
        const tx = db.transaction(IDB_STORE_TODO, 'readonly');
        const req = tx.objectStore(IDB_STORE_TODO).get(id);
        req.onsuccess = () => res(req.result);
        req.onerror   = e => rej(e.target.error);
    }));
}

function todoUid() { return Math.random().toString(36).slice(2,9) + Date.now().toString(36); }

function compressImageTodo(file) {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onerror = rej;
        r.onload = e => {
            const img = new Image();
            img.onerror = rej;
            img.onload = () => {
                const MAX = 1200;
                let w = img.width, h = img.height;
                if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
                const c = document.createElement('canvas');
                c.width = w; c.height = h;
                c.getContext('2d').drawImage(img, 0, 0, w, h);
                res(c.toDataURL('image/jpeg', 0.75));
            };
            img.src = e.target.result;
        };
        r.readAsDataURL(file);
    });
}

async function processImagesTodo(files) {
    const out = [];
    for (const f of files) {
        if (!f || !f.type || !f.type.startsWith('image/')) continue;
        try {
            const d = await compressImageTodo(f);
            const id = 'img_' + todoUid();
            await idbPutTodo(id, d);
            out.push({ ref: 'idb:' + id, dataUrl: d });
        } catch(e) { console.error('Image load failed', e); }
    }
    return out;
}

// ── Custom modal ──────────────────────────────────────────────────────────────
function openTodoModal({ title = 'New Task', initialText = '', initialImages = [], onSave }) {
    let imgs = initialImages.slice();       // idb: refs
    let displayImgs = [];                   // data URLs for preview

    // Resolve existing image refs for display
    if (imgs.length) {
        Promise.all(imgs.map(src =>
            src.startsWith('idb:') ? idbGetTodo(src.slice(4)) : Promise.resolve(src)
        )).then(resolved => { displayImgs = resolved; refreshStrip(); });
    }

    // ── Build overlay ──
    const ov    = document.createElement('div');
    ov.className = 'note-editor-overlay';

    const modal = document.createElement('div');
    modal.className = 'note-editor-modal';

    const titleEl = document.createElement('h3');
    titleEl.className = 'editor-title';
    titleEl.textContent = title;

    const ta = document.createElement('textarea');
    ta.className = 'editor-textarea';
    ta.value = initialText;
    ta.placeholder = 'What needs to be done? Paste images with Ctrl+V…';
    ta.spellcheck = true;

    const strip = document.createElement('div');
    strip.className = 'editor-img-strip';

    function refreshStrip() {
        strip.innerHTML = '';
        displayImgs.forEach((src, i) => {
            if (!src) return;
            const wrap = document.createElement('div');
            wrap.className = 'editor-img-thumb-wrap';
            const img = document.createElement('img');
            img.className = 'editor-img-thumb';
            img.src = src;
            const rm = document.createElement('button');
            rm.className = 'img-rm-btn';
            rm.textContent = '×';
            rm.onclick = () => { imgs.splice(i, 1); displayImgs.splice(i, 1); refreshStrip(); };
            wrap.appendChild(img); wrap.appendChild(rm); strip.appendChild(wrap);
        });
    }

    async function addImages(files) {
        const found = await processImagesTodo(files);
        found.forEach(r => { imgs.push(r.ref); displayImgs.push(r.dataUrl); });
        refreshStrip();
    }

    // Paste handler
    ta.addEventListener('paste', async e => {
        const files = Array.from((e.clipboardData || {}).items || [])
            .filter(i => i.type.startsWith('image/'))
            .map(i => { e.preventDefault(); return i.getAsFile(); });
        if (files.length) await addImages(files);
    });

    // Drag & drop
    ta.addEventListener('dragover',  e => { e.preventDefault(); ta.classList.add('img-drag-over'); });
    ta.addEventListener('dragleave', () => ta.classList.remove('img-drag-over'));
    ta.addEventListener('drop', async e => {
        e.preventDefault(); ta.classList.remove('img-drag-over');
        await addImages(Array.from(e.dataTransfer.files));
    });

    // ── Buttons ──
    const btnRow = document.createElement('div');
    btnRow.className = 'editor-btn-row';
    btnRow.style.justifyContent = 'space-between';

    // Left: Add Image
    const leftBtns = document.createElement('div');
    leftBtns.style.display = 'flex'; leftBtns.style.gap = '8px';

    const addImgBtn = document.createElement('button');
    addImgBtn.className = 'notes-btn';
    addImgBtn.textContent = '📎 Add Image';
    addImgBtn.onclick = () => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
        inp.onchange = e => addImages(Array.from(e.target.files));
        inp.click();
    };
    leftBtns.appendChild(addImgBtn);

    // Right: Save / Cancel
    const rightBtns = document.createElement('div');
    rightBtns.style.display = 'flex'; rightBtns.style.gap = '8px';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'notes-btn notes-btn-primary';
    saveBtn.textContent = 'Save';
    saveBtn.onclick = () => {
        const text = ta.value.trim();
        if (!text && !imgs.length) return;
        onSave({ text, images: imgs });
        ov.remove();
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'notes-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => ov.remove();

    rightBtns.appendChild(saveBtn); rightBtns.appendChild(cancelBtn);
    btnRow.appendChild(leftBtns); btnRow.appendChild(rightBtns);

    modal.appendChild(titleEl); modal.appendChild(ta);
    modal.appendChild(strip);   modal.appendChild(btnRow);
    ov.appendChild(modal);

    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);

    // Keyboard shortcut — Cmd/Ctrl+Enter saves
    ta.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveBtn.click();
        if (e.key === 'Escape') ov.remove();
    });

    requestAnimationFrame(() => ta.focus());
}

// ── Storage ───────────────────────────────────────────────────────────────────
const loadTodoList = () => {
    const saved = JSON.parse(localStorage.getItem('todoList')) || [];
    const el = document.getElementById('todoList');
    saved.forEach(item => addTodoItem(item.text, item.count, el, item.lastModified, item.images || []));
};

const saveTodoList = (todoListElement) => {
    const items = Array.from(todoListElement.querySelectorAll('li')).map(li => {
        const span = li.querySelector('span');
        const countSpan = li.querySelector('.count');
        const lastModSpan = li.querySelector('.last-modified');
        const textarea = span ? span.querySelector('textarea') : null;
        return {
            text: textarea ? textarea.value.trim() : (span ? span.textContent.trim() : ''),
            count: parseInt(countSpan ? countSpan.textContent : '0'),
            lastModified: lastModSpan ? lastModSpan.textContent.replace('Last Modified: ', '') : new Date().toLocaleString(),
            images: li._todoImages || []
        };
    });
    localStorage.setItem('todoList', JSON.stringify(items));
};

const exportTodoList = () => {
    const el = document.getElementById('todoList');
    const text = Array.from(el.querySelectorAll('li span')).map(s => {
        const ta = s.querySelector('textarea');
        return ta ? ta.value.trim() : s.textContent.trim();
    }).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.download = 'todo-list.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

// ── Time slot options ─────────────────────────────────────────────────────────
const TIME_OPTIONS = [3, 6, 12, 18, 24, 30, 60];

// ── Add Todo Item ─────────────────────────────────────────────────────────────
const addTodoItem = (itemText, itemCount, todoListElement, lastModifiedParam, images = []) => {
    let lastModifiedDate = lastModifiedParam || new Date().toLocaleString();
    const li = document.createElement('li');
    li._todoImages = images.slice(); // store image refs on the element
    li.setAttribute('draggable', 'true');

    // Drag events
    li.addEventListener('dragstart', e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', itemText); li.classList.add('dragging'); });
    li.addEventListener('dragend',   () => li.classList.remove('dragging'));
    li.addEventListener('dragover',  e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    li.addEventListener('dragenter', e => e.target.classList.add('drag-over'));
    li.addEventListener('dragleave', e => e.target.classList.remove('drag-over'));
    li.addEventListener('drop', e => {
        e.preventDefault();
        let dropTarget = e.target;
        while (dropTarget.tagName !== 'LI' && dropTarget.parentElement) dropTarget = dropTarget.parentElement;
        if (dropTarget.tagName !== 'LI') return;
        dropTarget.classList.remove('drag-over');
        const droppedText = e.dataTransfer.getData('text/plain');
        if (droppedText !== itemText) {
            const kids = Array.from(todoListElement.children);
            const di = kids.findIndex(c => c.querySelector('span') && c.querySelector('span').textContent.includes(droppedText));
            const ci = kids.findIndex(c => c.querySelector('span') && c.querySelector('span').textContent.includes(itemText));
            if (di > -1 && ci > -1) {
                if (ci < di) { todoListElement.insertBefore(kids[di], kids[ci]); todoListElement.insertBefore(kids[ci], kids[di].nextSibling); }
                else         { todoListElement.insertBefore(kids[ci], kids[di]); todoListElement.insertBefore(kids[di], kids[ci].nextSibling); }
                saveTodoList(todoListElement);
            }
        }
    });

    // Content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';
    const span = document.createElement('span');
    span.textContent = itemText;
    contentWrapper.appendChild(span);

    // Image preview strip (if any images)
    const imgStrip = document.createElement('div');
    imgStrip.className = 'todo-img-strip';
    imgStrip.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;';
    li.appendChild(contentWrapper);
    li.appendChild(imgStrip);

    function renderImgStrip() {
        imgStrip.innerHTML = '';
        (li._todoImages || []).forEach(src => {
            const img = document.createElement('img');
            img.style.cssText = 'max-height:100px;border-radius:6px;cursor:pointer;object-fit:cover;';
            if (src.startsWith('idb:')) {
                idbGetTodo(src.slice(4)).then(d => {
                    if (d) { img.src = d; }
                });
            } else { img.src = src; }
            imgStrip.appendChild(img);
        });
        imgStrip.style.display = li._todoImages.length ? 'flex' : 'none';
    }
    renderImgStrip();

    // Subtasks
    const subtasks = document.createElement('ul');
    subtasks.className = 'subtasks';
    contentWrapper.appendChild(subtasks);

    // Button wrapper
    const buttonWrapper = document.createElement('div');
    buttonWrapper.className = 'button-wrapper';
    li.appendChild(buttonWrapper);

    // Delete
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => { todoListElement.removeChild(li); saveTodoList(todoListElement); });
    buttonWrapper.appendChild(deleteButton);

    // Edit — opens custom modal
    const editButton = document.createElement('button');
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => {
        openTodoModal({
            title: 'Edit Task',
            initialText: span.textContent.trim(),
            initialImages: li._todoImages || [],
            onSave: ({ text, images }) => {
                span.textContent = text;
                li._todoImages = images;
                renderImgStrip();
                updateLastModifiedDate(li);
                saveTodoList(todoListElement);
            }
        });
    });
    buttonWrapper.appendChild(editButton);

    // Counter
    const counterSpan = document.createElement('span');
    counterSpan.className = 'count';
    counterSpan.textContent = itemCount || 0;
    buttonWrapper.appendChild(counterSpan);

    // Add Time dropdown
    const timeWrapper = document.createElement('div');
    timeWrapper.className = 'time-picker-wrapper';
    timeWrapper.style.position = 'relative';
    timeWrapper.style.display  = 'inline-block';

    const addTimeButton = document.createElement('button');
    addTimeButton.textContent = 'Add Time';
    addTimeButton.className   = 'add-time-btn';

    const timeDropdown = document.createElement('div');
    timeDropdown.className    = 'time-dropdown';
    timeDropdown.style.display = 'none';

    TIME_OPTIONS.forEach(slots => {
        const opt = document.createElement('button');
        opt.textContent = String(slots);
        opt.className   = 'time-option-btn';
        opt.addEventListener('click', e => {
            e.stopPropagation();
            for (let i = 0; i < slots; i++) moveDown();
            counterSpan.textContent = parseInt(counterSpan.textContent) + slots;
            updateLastModifiedDate(li);
            saveTodoList(todoListElement);
        });
        timeDropdown.appendChild(opt);
    });

    addTimeButton.addEventListener('click', e => {
        e.stopPropagation();
        document.querySelectorAll('.time-dropdown').forEach(d => { if (d !== timeDropdown) d.style.display = 'none'; });
        timeDropdown.style.display = timeDropdown.style.display === 'none' ? 'flex' : 'none';
    });
    timeDropdown.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', () => { timeDropdown.style.display = 'none'; });

    timeWrapper.appendChild(addTimeButton);
    timeWrapper.appendChild(timeDropdown);
    buttonWrapper.appendChild(timeWrapper);

    // +1
    const incButton = document.createElement('button');
    incButton.textContent = '+1';
    incButton.className   = 'plus-one-btn';
    incButton.title       = 'Add to count';
    incButton.addEventListener('click', () => {
        counterSpan.textContent = parseInt(counterSpan.textContent) + 1;
        updateLastModifiedDate(li);
        saveTodoList(todoListElement);
    });
    buttonWrapper.appendChild(incButton);

    // Copy
    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy';
    copyButton.addEventListener('click', () => {
        copyToClipboard(span.textContent.trim());
        showTemporaryMessage('Copied!', buttonWrapper);
    });
    buttonWrapper.appendChild(copyButton);

    // Reset
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset';
    resetButton.addEventListener('click', () => {
        counterSpan.textContent = 0;
        updateLastModifiedDate(li);
        saveTodoList(todoListElement);
    });
    buttonWrapper.appendChild(resetButton);

    // Last modified
    const lastModifiedSpan = document.createElement('span');
    lastModifiedSpan.className   = 'last-modified';
    lastModifiedSpan.textContent = `Last Modified: ${lastModifiedDate}`;
    li.appendChild(lastModifiedSpan);

    todoListElement.appendChild(li);
};

function updateLastModifiedDate(li) {
    let span = li.querySelector('.last-modified');
    if (!span) { span = document.createElement('span'); span.className = 'last-modified'; li.appendChild(span); }
    span.textContent = `Last Modified: ${new Date().toLocaleString()}`;
}

// ── Event listeners ───────────────────────────────────────────────────────────
document.getElementById('exportTodoList').addEventListener('click', exportTodoList);

document.getElementById('addTodoItem').addEventListener('click', () => {
    const todoListElement = document.getElementById('todoList');
    openTodoModal({
        title: 'Add Task',
        onSave: ({ text, images }) => {
            addTodoItem(text, 0, todoListElement, null, images);
            saveTodoList(todoListElement);
        }
    });
});

loadTodoList();
