// utils.js — shared utilities only
// timeSlots, selectedIndex, combineCounter are declared in timeslots.js

const formatTime12Hour = (hour24, minute, second) => {
    const ampm = hour24 >= 12 ? 'pm' : 'am';
    const hour12 = hour24 % 12 || 12;
    return `${hour12.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')} ${ampm}`;
};

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

const showTemporaryMessage = (message, element) => {
    const tempMessage = document.createElement('span');
    tempMessage.textContent = message;
    tempMessage.style.display = 'inline-block';
    tempMessage.style.marginLeft = '10px';
    tempMessage.style.opacity = '0';
    tempMessage.style.transition = 'opacity 0.2s ease-in-out';
    element.appendChild(tempMessage);
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

// Theme Toggle
const toggleThemeButton = document.getElementById('toggleTheme');
const applyTheme = (theme) => {
    document.body.setAttribute('data-theme', theme);
    toggleThemeButton.textContent = theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme';
    localStorage.setItem('theme', theme);
};

const savedTheme = localStorage.getItem('theme') || 'dark';
applyTheme(savedTheme);

toggleThemeButton.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
});
