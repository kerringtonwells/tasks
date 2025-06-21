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

loadLinksList();
