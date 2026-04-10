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
    const li = document.createElement('li');
    li.className = 'no-bullet link-item';

    const a = document.createElement('a');
    a.href = linkData.url;
    a.target = '_blank';
    a.textContent = linkData.text;
    a.className = 'link-text';

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

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(addBtn);
    modal.appendChild(title);
    modal.appendChild(nameLabel); modal.appendChild(nameInp);
    modal.appendChild(urlLabel);  modal.appendChild(urlInp);
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
