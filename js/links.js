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

    // ── Link itself ──
    const a = document.createElement('a');
    a.href = linkData.url;
    a.target = '_blank';
    a.textContent = linkData.text;
    a.className = 'link-text';

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
        const newText = prompt('Edit link name:', linkData.text);
        if (newText && newText.trim()) {
            linkData.text = newText.trim();
            a.textContent = newText.trim();
            saveLinksList(linksListElement);
        }
    });

    // Edit URL
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

    // Delete
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

// Set add link button to icon on load
const addLinkBtn = document.getElementById('addLink');
if (addLinkBtn) {
    addLinkBtn.textContent = '＋';
    addLinkBtn.title = 'Add link';
}

document.getElementById('addLink').addEventListener('click', () => {
    const newLinkText = prompt('Enter the link text:', '');
    const newLinkUrl = prompt('Enter the link URL:', 'https://');
    if (newLinkText && newLinkUrl) {
        const linksListElement = document.getElementById('linksList');
        addLink({ text: newLinkText, url: newLinkUrl }, linksListElement);
        saveLinksList(linksListElement);
    }
});

loadLinksList();

// ── Export / Import icons ──────────────────────────────────
const exportLinksBtn = document.getElementById('exportLinks');
if (exportLinksBtn) {
    exportLinksBtn.textContent = '↑';
    exportLinksBtn.title = 'Export links';
}

const importLinksBtn = document.getElementById('importLinks');
if (importLinksBtn) {
    importLinksBtn.textContent = '↓';
    importLinksBtn.title = 'Import links';
}

// Export — download as JSON
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

// Import — merge with existing, re-sort, no duplicates
document.getElementById('importLinks').addEventListener('click', () => {
    document.getElementById('importLinksFile').click();
});

document.getElementById('importLinksFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const incoming = JSON.parse(ev.target.result);
            if (!Array.isArray(incoming)) throw new Error('Invalid format');
            const linksListElement = document.getElementById('linksList');
            // Get existing URLs to avoid duplicates
            const existingUrls = new Set(
                Array.from(linksListElement.querySelectorAll('a')).map(a => a.href)
            );
            let added = 0;
            incoming.forEach(link => {
                if (link.text && link.url && !existingUrls.has(link.url)) {
                    addLink(link, linksListElement);
                    existingUrls.add(link.url);
                    added++;
                }
            });
            saveLinksList(linksListElement);
            alert(`Imported ${added} link(s).`);
        } catch (err) {
            alert('Invalid file. Please use a links JSON export.');
        }
        // Reset so same file can be imported again if needed
        e.target.value = '';
    };
    reader.readAsText(file);
});
