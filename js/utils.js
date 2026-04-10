const loadLinksList = () => {
    const savedLinksList = JSON.parse(localStorage.getItem('linksList')) || [];
    const linksListElement = document.getElementById('linksList');
    savedLinksList.sort((a, b) => a.text.toLowerCase().localeCompare(b.text.toLowerCase()));
    savedLinksList.forEach(link => addLink(link, linksListElement));
};

const saveLinksList = (linksListElement) => {
    const linkItems = Array.from(linksListElement.querySelectorAll('li')).map(li => ({
        text: li.querySelector('a').textContent,
        url: li.querySelector('a').href,
        type: li.dataset.type || 'url'
    }));
    localStorage.setItem('linksList', JSON.stringify(linkItems));
};

const getLinkIcon = (type) => {
    if (type === 'folder') return '📁';
    if (type === 'file')   return '📄';
    return '🔗';
};

const formatLocalPath = (path) => {
    // Normalise: strip leading/trailing whitespace
    path = path.trim();
    // If it already starts with file:// leave it alone
    if (path.startsWith('file://')) return path;
    // Windows paths: C:\... → file:///C:/...
    if (/^[A-Za-z]:\\/.test(path)) return 'file:///' + path.replace(/\\/g, '/');
    // Unix/Mac absolute paths: /Users/... → file:///Users/...
    if (path.startsWith('/')) return 'file://' + path;
    // Anything else — wrap anyway
    return 'file:///' + path;
};

const addLink = (linkData, linksListElement) => {
    const type = linkData.type || 'url';
    const li = document.createElement('li');
    li.className = 'no-bullet link-item';
    li.dataset.type = type;

    // ── Link itself ──
    const a = document.createElement('a');
    a.href = linkData.url;
    a.target = '_blank';
    a.className = 'link-text';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'link-type-icon';
    iconSpan.textContent = getLinkIcon(type);

    const textSpan = document.createElement('span');
    textSpan.textContent = linkData.text;

    a.appendChild(iconSpan);
    a.appendChild(textSpan);

    // ── Action buttons (shown on hover via CSS) ──
    const actions = document.createElement('div');
    actions.className = 'link-actions';

    // Edit Name
    const editNameBtn = document.createElement('button');
    editNameBtn.textContent = '✎ Name';
    editNameBtn.className = 'link-action-btn';
    editNameBtn.title = 'Edit link name';
    editNameBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const newText = prompt('Edit name:', linkData.text);
        if (newText && newText.trim()) {
            linkData.text = newText.trim();
            textSpan.textContent = newText.trim();
            saveLinksList(linksListElement);
        }
    });

    // Edit path/URL
    const editUrlBtn = document.createElement('button');
    editUrlBtn.textContent = type === 'url' ? '✎ URL' : '✎ Path';
    editUrlBtn.className = 'link-action-btn';
    editUrlBtn.title = type === 'url' ? 'Edit URL' : 'Edit file/folder path';
    editUrlBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const label  = type === 'url' ? 'Edit URL:' : 'Edit path (e.g. C:\\Users\\You\\folder or /Users/you/folder):';
        const current = type === 'url' ? linkData.url : linkData.url;
        const newVal = prompt(label, current);
        if (newVal && newVal.trim()) {
            const finalUrl = type === 'url' ? newVal.trim() : formatLocalPath(newVal.trim());
            linkData.url = finalUrl;
            a.href = finalUrl;
            saveLinksList(linksListElement);
        }
    });

    // Delete
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '✕';
    deleteBtn.className = 'link-action-btn link-delete-btn';
    deleteBtn.title = 'Delete';
    deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm(`Delete "${linkData.text}"?`)) {
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

// ── Type picker modal ─────────────────────────────────────────────────────────
const openAddLinkModal = () => {
    // Remove existing modal if any
    const old = document.getElementById('addLinkModal');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'addLinkModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:#1e2130;border-radius:14px;padding:24px;min-width:300px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5);font-family:inherit;color:#e2e8f0;';

    const title = document.createElement('h3');
    title.textContent = 'Add to Useful Links';
    title.style.cssText = 'margin:0 0 16px;font-size:16px;font-weight:700;';

    // Type buttons
    const typeRow = document.createElement('div');
    typeRow.style.cssText = 'display:flex;gap:8px;margin-bottom:18px;';

    let selectedType = 'url';
    const types = [
        { val: 'url',    label: '🔗 Web Link',   hint: 'A website URL' },
        { val: 'folder', label: '📁 Folder',      hint: 'A local folder shortcut' },
        { val: 'file',   label: '📄 File',        hint: 'A local file shortcut' }
    ];

    const typeBtns = types.map(t => {
        const b = document.createElement('button');
        b.textContent = t.label;
        b.title = t.hint;
        b.style.cssText = 'flex:1;padding:8px 4px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:inherit;font-family:inherit;font-size:12px;cursor:pointer;transition:all 0.15s;';
        b.addEventListener('click', () => {
            selectedType = t.val;
            typeBtns.forEach(x => { x.style.background='rgba(255,255,255,0.06)'; x.style.borderColor='rgba(255,255,255,0.15)'; x.style.color='inherit'; });
            b.style.background='rgba(59,130,246,0.25)'; b.style.borderColor='#3b82f6'; b.style.color='#93c5fd';
            pathLabel.textContent = t.val === 'url' ? 'URL' : 'Path (e.g. C:\\Users\\You\\folder)';
        });
        if (t.val === 'url') { b.style.background='rgba(59,130,246,0.25)'; b.style.borderColor='#3b82f6'; b.style.color='#93c5fd'; }
        typeRow.appendChild(b);
        return b;
    });

    // Name field
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Name'; nameLabel.style.cssText = 'display:block;font-size:11px;font-weight:700;opacity:0.5;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;';
    const nameInp = document.createElement('input');
    nameInp.type = 'text'; nameInp.placeholder = 'e.g. My Project Folder';
    nameInp.style.cssText = 'width:100%;padding:9px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:inherit;font-family:inherit;font-size:14px;outline:none;box-sizing:border-box;margin-bottom:12px;';

    // Path/URL field
    const pathLabel = document.createElement('label');
    pathLabel.textContent = 'URL'; pathLabel.style.cssText = 'display:block;font-size:11px;font-weight:700;opacity:0.5;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;';
    const pathInp = document.createElement('input');
    pathInp.type = 'text'; pathInp.placeholder = 'https://example.com';
    pathInp.style.cssText = nameInp.style.cssText + 'margin-bottom:18px;';

    // Update placeholder when type changes
    typeBtns.forEach((b, i) => b.addEventListener('click', () => {
        const t = types[i];
        pathInp.placeholder = t.val === 'url' ? 'https://example.com' : (t.val === 'folder' ? 'C:\\Users\\You\\Documents or /Users/you/docs' : 'C:\\Users\\You\\file.pdf or /Users/you/file.pdf');
    }));

    // Buttons
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
        const path = pathInp.value.trim();
        if (!name || !path) { nameInp.style.borderColor = !name ? '#f87171' : ''; pathInp.style.borderColor = !path ? '#f87171' : ''; return; }
        const finalUrl = selectedType === 'url' ? path : formatLocalPath(path);
        const linksListElement = document.getElementById('linksList');
        addLink({ text: name, url: finalUrl, type: selectedType }, linksListElement);
        saveLinksList(linksListElement);
        overlay.remove();
    });
    btnRow.appendChild(cancelBtn); btnRow.appendChild(addBtn);

    modal.appendChild(title); modal.appendChild(typeRow);
    modal.appendChild(nameLabel); modal.appendChild(nameInp);
    modal.appendChild(pathLabel); modal.appendChild(pathInp);
    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    nameInp.focus();
    pathInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBtn.click(); });
};

// ── Init ──────────────────────────────────────────────────────────────────────
const addLinkBtn = document.getElementById('addLink');
if (addLinkBtn) { addLinkBtn.textContent = '＋'; addLinkBtn.title = 'Add link, folder, or file shortcut'; }
document.getElementById('addLink').addEventListener('click', openAddLinkModal);

loadLinksList();

// ── Export / Import icons ─────────────────────────────────────────────────────
const exportLinksBtn = document.getElementById('exportLinks');
if (exportLinksBtn) { exportLinksBtn.textContent = '↑'; exportLinksBtn.title = 'Export links'; }

const importLinksBtn = document.getElementById('importLinks');
if (importLinksBtn) { importLinksBtn.textContent = '↓'; importLinksBtn.title = 'Import links'; }

document.getElementById('exportLinks').addEventListener('click', () => {
    const linksListElement = document.getElementById('linksList');
    const links = Array.from(linksListElement.querySelectorAll('li')).map(li => ({
        text: li.querySelector('a').textContent,
        url: li.querySelector('a').href,
        type: li.dataset.type || 'url'
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
