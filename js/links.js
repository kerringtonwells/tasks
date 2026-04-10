const loadLinksList = () => {
    const savedLinksList = JSON.parse(localStorage.getItem('linksList')) || [];
    const linksListElement = document.getElementById('linksList');
    savedLinksList.sort((a, b) => a.text.toLowerCase().localeCompare(b.text.toLowerCase()));
    savedLinksList.forEach(link => {
        // Strip any leading icon emoji that got saved in a previous version
        link.text = link.text.replace(/^[\u{1F300}-\u{1FFFF}🔗📁📄✅]\s*/u, '').trim();
        addLink(link, linksListElement);
    });
    saveLinksList(linksListElement); // re-save with clean text
};

const saveLinksList = (linksListElement) => {
    const linkItems = Array.from(linksListElement.querySelectorAll('li')).map(li => {
        const a = li.querySelector('a');
        const item = { text: a.textContent.replace('📂 ', '').trim(), url: a.href };
        if (li.dataset.handleId) item.handleId = li.dataset.handleId;
        return item;
    });
    localStorage.setItem('linksList', JSON.stringify(linkItems));
};

// ── FileSystem Handle Storage (IndexedDB) ────────────────────────────────────
const FSA_DB = 'kwells_fsa', FSA_STORE = 'handles';
let fsaDb = null;

const openFsaDB = () => {
    if (fsaDb) return Promise.resolve(fsaDb);
    return new Promise((res, rej) => {
        const req = indexedDB.open(FSA_DB, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore(FSA_STORE);
        req.onsuccess = e => { fsaDb = e.target.result; res(fsaDb); };
        req.onerror   = e => rej(e.target.error);
    });
};
const saveHandle = (id, handle) => openFsaDB().then(db => new Promise((res, rej) => {
    const req = db.transaction(FSA_STORE, 'readwrite').objectStore(FSA_STORE).put(handle, id);
    req.onsuccess = () => res(); req.onerror = e => rej(e.target.error);
}));
const getHandle = (id) => openFsaDB().then(db => new Promise((res, rej) => {
    const req = db.transaction(FSA_STORE, 'readonly').objectStore(FSA_STORE).get(id);
    req.onsuccess = () => res(req.result); req.onerror = e => rej(e.target.error);
}));
const deleteHandle = (id) => openFsaDB().then(db => new Promise((res, rej) => {
    const req = db.transaction(FSA_STORE, 'readwrite').objectStore(FSA_STORE).delete(id);
    req.onsuccess = () => res(); req.onerror = e => rej(e.target.error);
}));

const openLocalFile = async (handleId, nameForDisplay) => {
    const handle = await getHandle(handleId);
    if (!handle) { alert('Handle not found. Please re-add this file or folder.'); return; }
    const perm = await handle.requestPermission({ mode: 'read' });
    if (perm !== 'granted') { alert('Permission denied.'); return; }

    if (handle.kind === 'directory') {
        // Show a simple file browser modal for the folder
        openFolderModal(handle);
    } else {
        const file = await handle.getFile();
        const url = URL.createObjectURL(file);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
};

const openFolderModal = async (dirHandle) => {
    const old = document.getElementById('folderBrowserModal');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'folderBrowserModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:#1e2130;border-radius:14px;padding:0;width:90%;max-width:540px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.6);font-family:inherit;color:#e2e8f0;overflow:hidden;';

    // Header with breadcrumb
    const header = document.createElement('div');
    header.style.cssText = 'padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;';
    const breadcrumb = document.createElement('div');
    breadcrumb.style.cssText = 'font-size:14px;font-weight:700;display:flex;align-items:center;gap:6px;';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'border:none;background:none;color:inherit;font-size:16px;cursor:pointer;opacity:0.5;padding:4px;';
    closeBtn.addEventListener('click', () => overlay.remove());
    header.appendChild(breadcrumb); header.appendChild(closeBtn);

    // File list
    const fileList = document.createElement('div');
    fileList.style.cssText = 'overflow-y:auto;flex:1;padding:10px;';

    modal.appendChild(header); modal.appendChild(fileList);
    overlay.appendChild(modal);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    // Navigate into a directory handle
    const navigate = async (handle, path) => {
        fileList.innerHTML = '<div style="padding:20px;text-align:center;opacity:0.4;font-size:13px;">Loading…</div>';
        breadcrumb.innerHTML = '';

        // Breadcrumb
        const folderIcon = document.createElement('span'); folderIcon.textContent = '📁';
        const folderName = document.createElement('span'); folderName.textContent = handle.name;
        breadcrumb.appendChild(folderIcon); breadcrumb.appendChild(folderName);

        // Back button if not root
        if (path.length > 0) {
            const backBtn = document.createElement('button');
            backBtn.textContent = '← Back';
            backBtn.style.cssText = 'border:none;background:rgba(255,255,255,0.06);color:inherit;font-family:inherit;font-size:12px;padding:4px 10px;border-radius:6px;cursor:pointer;margin-left:8px;';
            backBtn.addEventListener('click', () => {
                const parent = path[path.length - 1];
                navigate(parent.handle, path.slice(0, -1));
            });
            header.insertBefore(backBtn, header.firstChild);
            // remove old back btn if any
            header.querySelectorAll('button:not([data-close])').forEach((b,i) => { if(i>0) b.remove(); });
        } else {
            header.querySelectorAll('button:not([data-close])').forEach(b => b.remove());
        }

        // Read entries
        fileList.innerHTML = '';
        const entries = [];
        for await (const entry of handle.values()) entries.push(entry);
        entries.sort((a, b) => {
            if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });

        if (!entries.length) {
            fileList.innerHTML = '<div style="padding:20px;text-align:center;opacity:0.35;font-size:13px;font-style:italic;">Empty folder</div>';
            return;
        }

        entries.forEach(entry => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;cursor:pointer;font-size:13px;transition:background 0.1s;';
            row.addEventListener('mouseenter', () => row.style.background = 'rgba(255,255,255,0.06)');
            row.addEventListener('mouseleave', () => row.style.background = '');

            const icon = document.createElement('span');
            icon.textContent = entry.kind === 'directory' ? '📁' : getFileIcon(entry.name);
            const name = document.createElement('span'); name.textContent = entry.name;
            row.appendChild(icon); row.appendChild(name);

            row.addEventListener('click', async () => {
                if (entry.kind === 'directory') {
                    navigate(entry, [...path, { handle, name: handle.name }]);
                } else {
                    const file = await entry.getFile();
                    const url = URL.createObjectURL(file);
                    window.open(url, '_blank');
                    setTimeout(() => URL.revokeObjectURL(url), 10000);
                }
            });
            fileList.appendChild(row);
        });
    };

    navigate(dirHandle, []);
};

const getFileIcon = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '🖼';
    if (['mp4','mov','avi','mkv','webm'].includes(ext)) return '🎬';
    if (['mp3','wav','aac','flac','m4a'].includes(ext)) return '🎵';
    if (ext === 'pdf') return '📄';
    if (['doc','docx'].includes(ext)) return '📝';
    if (['xls','xlsx'].includes(ext)) return '📊';
    if (['zip','rar','7z','tar','gz'].includes(ext)) return '🗜';
    if (['js','ts','py','html','css','json','sh'].includes(ext)) return '💻';
    return '📄';
};



const addLink = (linkData, linksListElement) => {
    const li = document.createElement('li');
    li.className = 'no-bullet link-item';
    if (linkData.handleId) li.dataset.handleId = linkData.handleId;

    const a = document.createElement('a');
    a.className = 'link-text';

    if (linkData.handleId) {
        // Local file via File System Access API
        a.href = '#';
        a.title = 'Click to open ' + linkData.text;
        const icon = document.createElement('span');
        icon.textContent = '📂 ';  // updated on load if we know kind
        icon.style.fontSize = '13px';
        // Check handle kind async and update icon
        getHandle(linkData.handleId).then(h => { if (h) icon.textContent = h.kind === 'directory' ? '📁 ' : '📂 '; });
        a.appendChild(icon);
        a.appendChild(document.createTextNode(linkData.text));
        a.addEventListener('click', (e) => {
            e.preventDefault();
            openLocalFile(linkData.handleId, linkData.text);
        });
    } else {
        a.href = linkData.url;
        a.target = '_blank';
        a.textContent = linkData.text;
    }

    const actions = document.createElement('div');
    actions.className = 'link-actions';

    const editNameBtn = document.createElement('button');
    editNameBtn.textContent = '✎ Name';
    editNameBtn.className = 'link-action-btn';
    editNameBtn.title = 'Edit link name';
    editNameBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const newText = prompt('Edit link name:', linkData.text);
        if (newText && newText.trim()) {
            linkData.text = newText.trim();
            a.textContent = newText.trim();
            saveLinksList(linksListElement);
        }
    });

    const editUrlBtn = document.createElement('button');
    editUrlBtn.textContent = '✎ URL';
    editUrlBtn.className = 'link-action-btn';
    editUrlBtn.title = 'Edit link URL';
    editUrlBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const newUrl = prompt('Edit link URL:', linkData.url);
        if (newUrl && newUrl.trim()) {
            linkData.url = newUrl.trim();
            a.href = newUrl.trim();
            saveLinksList(linksListElement);
        }
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '✕';
    deleteBtn.className = 'link-action-btn link-delete-btn';
    deleteBtn.title = 'Delete link';
    deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm(`Delete "${linkData.text}"?`)) {
            if (linkData.handleId) deleteHandle(linkData.handleId);
            linksListElement.removeChild(li);
            saveLinksList(linksListElement);
        }
    });

    actions.appendChild(editNameBtn);
    actions.appendChild(editUrlBtn);
    actions.appendChild(deleteBtn);
    li.appendChild(a);
    li.appendChild(actions);
    linksListElement.appendChild(li);
};

// ── Add link modal ────────────────────────────────────────────────────────────
const openAddLinkModal = () => {
    const old = document.getElementById('addLinkModal');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'addLinkModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:#1e2130;border-radius:14px;padding:24px;min-width:300px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5);font-family:inherit;color:#e2e8f0;';

    const title = document.createElement('h3');
    title.textContent = 'Add Link';
    title.style.cssText = 'margin:0 0 18px;font-size:16px;font-weight:700;';

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Name';
    nameLabel.style.cssText = 'display:block;font-size:11px;font-weight:700;opacity:0.5;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;';

    const nameInp = document.createElement('input');
    nameInp.type = 'text';
    nameInp.placeholder = 'e.g. GitHub, Jira, ChatGPT';
    nameInp.style.cssText = 'width:100%;padding:9px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:inherit;font-family:inherit;font-size:14px;outline:none;box-sizing:border-box;margin-bottom:12px;';

    const urlLabel = document.createElement('label');
    urlLabel.textContent = 'URL';
    urlLabel.style.cssText = nameLabel.style.cssText;

    const urlInp = document.createElement('input');
    urlInp.type = 'text';
    urlInp.placeholder = 'https://example.com';
    urlInp.style.cssText = 'width:100%;padding:9px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:inherit;font-family:inherit;font-size:14px;outline:none;box-sizing:border-box;margin-bottom:20px;';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:9px 18px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:inherit;font-family:inherit;font-size:14px;cursor:pointer;';
    cancelBtn.addEventListener('click', () => overlay.remove());

    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add';
    addBtn.style.cssText = 'padding:9px 18px;border-radius:8px;border:none;background:#3b82f6;color:#fff;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;';
    addBtn.addEventListener('click', () => {
        const name = nameInp.value.trim();
        const url  = urlInp.value.trim();
        if (!name) { nameInp.style.borderColor = '#f87171'; nameInp.focus(); return; }
        if (!url)  { urlInp.style.borderColor  = '#f87171'; urlInp.focus();  return; }
        const linksListElement = document.getElementById('linksList');
        addLink({ text: name, url }, linksListElement);
        saveLinksList(linksListElement);
        overlay.remove();
    });

    // Local file picker button
    const divider = document.createElement('div');
    divider.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:16px;';
    const line1 = document.createElement('div'); line1.style.cssText = 'flex:1;height:1px;background:rgba(255,255,255,0.1);';
    const orTxt = document.createElement('span'); orTxt.textContent = 'or'; orTxt.style.cssText = 'font-size:11px;opacity:0.4;';
    const line2 = document.createElement('div'); line2.style.cssText = 'flex:1;height:1px;background:rgba(255,255,255,0.1);';
    divider.appendChild(line1); divider.appendChild(orTxt); divider.appendChild(line2);

    const pickRow = document.createElement('div');
    pickRow.style.cssText = 'display:flex;gap:8px;margin-bottom:20px;';

    const pickFileBtn = document.createElement('button');
    pickFileBtn.textContent = '📄  Pick File';
    pickFileBtn.style.cssText = 'flex:1;padding:10px;border-radius:8px;border:1px dashed rgba(255,255,255,0.2);background:rgba(255,255,255,0.04);color:inherit;font-family:inherit;font-size:13px;cursor:pointer;';
    pickFileBtn.addEventListener('click', async () => {
        if (!window.showOpenFilePicker) { alert('Use Chrome or Edge for local file access.'); return; }
        try {
            const [fileHandle] = await window.showOpenFilePicker();
            const name = nameInp.value.trim() || fileHandle.name;
            const handleId = 'fsa_' + Date.now();
            await saveHandle(handleId, fileHandle);
            const linksListElement = document.getElementById('linksList');
            addLink({ text: name, url: '#', handleId }, linksListElement);
            saveLinksList(linksListElement);
            overlay.remove();
        } catch(e) { if (e.name !== 'AbortError') alert('Could not open file: ' + e.message); }
    });

    const pickFolderBtn = document.createElement('button');
    pickFolderBtn.textContent = '📁  Pick Folder';
    pickFolderBtn.style.cssText = pickFileBtn.style.cssText;
    pickFolderBtn.addEventListener('click', async () => {
        if (!window.showDirectoryPicker) { alert('Use Chrome or Edge for local folder access.'); return; }
        try {
            const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
            const name = nameInp.value.trim() || dirHandle.name;
            const handleId = 'fsa_' + Date.now();
            await saveHandle(handleId, dirHandle);
            const linksListElement = document.getElementById('linksList');
            addLink({ text: name, url: '#', handleId }, linksListElement);
            saveLinksList(linksListElement);
            overlay.remove();
        } catch(e) { if (e.name !== 'AbortError') alert('Could not open folder: ' + e.message); }
    });

    pickRow.appendChild(pickFileBtn); pickRow.appendChild(pickFolderBtn);

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(addBtn);
    modal.appendChild(title);
    modal.appendChild(nameLabel); modal.appendChild(nameInp);
    modal.appendChild(urlLabel);  modal.appendChild(urlInp);
    modal.appendChild(divider);   modal.appendChild(pickRow);
    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    nameInp.focus();
    urlInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBtn.click(); });
};

// ── Init ──────────────────────────────────────────────────────────────────────
const addLinkBtn = document.getElementById('addLink');
if (addLinkBtn) { addLinkBtn.textContent = '＋'; addLinkBtn.title = 'Add link'; }
document.getElementById('addLink').addEventListener('click', openAddLinkModal);

loadLinksList();

// ── Export / Import ───────────────────────────────────────────────────────────
const exportLinksBtn = document.getElementById('exportLinks');
if (exportLinksBtn) { exportLinksBtn.textContent = '↑'; exportLinksBtn.title = 'Export links'; }

const importLinksBtn = document.getElementById('importLinks');
if (importLinksBtn) { importLinksBtn.textContent = '↓'; importLinksBtn.title = 'Import links'; }

document.getElementById('exportLinks').addEventListener('click', () => {
    const linksListElement = document.getElementById('linksList');
    const links = Array.from(linksListElement.querySelectorAll('li')).map(li => ({
        text: li.querySelector('a').textContent,
        url: li.querySelector('a').href
    }));
    const blob = new Blob([JSON.stringify(links, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'links_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
});

document.getElementById('importLinks').addEventListener('click', () => {
    document.getElementById('importLinksFile').click();
});

document.getElementById('importLinksFile').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const incoming = JSON.parse(ev.target.result);
            if (!Array.isArray(incoming)) throw new Error('Invalid format');
            const linksListElement = document.getElementById('linksList');
            const existingUrls = new Set(Array.from(linksListElement.querySelectorAll('a')).map(a => a.href));
            let added = 0;
            incoming.forEach(link => {
                if (link.text && link.url && !existingUrls.has(link.url)) {
                    addLink(link, linksListElement);
                    existingUrls.add(link.url); added++;
                }
            });
            saveLinksList(linksListElement);
            alert(`Imported ${added} link(s).`);
        } catch (err) { alert('Invalid file. Please use a links JSON export.'); }
        e.target.value = '';
    };
    reader.readAsText(file);
});
