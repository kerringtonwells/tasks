# Kwells: Productivity Booster — Developer README

> **Purpose of this document:** Complete reference for making changes, improvements, or debugging this site. Written so that an AI assistant or developer can understand the full architecture, data flow, and design decisions without needing to read through all the source files first.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [File Structure](#2-file-structure)
3. [Architecture & Load Order](#3-architecture--load-order)
4. [Theming System](#4-theming-system)
5. [CSS Architecture](#5-css-architecture)
6. [Module: utils.js](#6-module-utilsjs)
7. [Module: timeSlots.js](#7-module-timeslotsjs)
8. [Module: todoList.js](#8-module-todolistjs)
9. [Module: links.js](#9-module-linksjs)
10. [Module: stopwatch.js](#10-module-stopwatchjs)
11. [Module: notes.js](#11-module-notesjs)
12. [Data Storage Reference](#12-data-storage-reference)
13. [HTML Structure](#13-html-structure)
14. [Known Quirks & Important Rules](#14-known-quirks--important-rules)
15. [Performance Notes](#15-performance-notes)
16. [How to Add New Features](#16-how-to-add-new-features)

---

## 1. Project Overview

A single-page productivity tool that runs entirely in the browser with no backend, no build step, and no frameworks. Everything persists in `localStorage`. The page is split into three vertical columns:

- **Left column** — Useful Links sidebar (fixed position)
- **Center column** — Time tracker + To-Do List
- **Right column** — Stopwatch + Notes

The site has a **dark/light theme toggle** and an **aurora background animation** (CSS-only, GPU-optimized).

---

## 2. File Structure

```
tasks/
├── index.html                  — Single HTML file, all structure
├── css/
│   └── tasksStyle.css          — ALL styles (one file, no imports except Google Fonts)
├── js/
│   ├── utils.js                — Shared utilities, loaded FIRST
│   ├── timeSlots.js            — Time tracker logic
│   ├── todoList.js             — To-do list
│   ├── links.js                — Useful links sidebar
│   ├── stopwatch.js            — Stopwatch timer
│   └── notes.js                — Notes module (most complex)
└── shortTermMemoryGame.html    — Separate linked page
```

**Critical:** All `<script>` tags use `defer` and are in a specific order. Do not reorder them. See [Architecture & Load Order](#3-architecture--load-order).

---

## 3. Architecture & Load Order

Scripts load in this exact order (all `defer`):

```
utils.js → timeSlots.js → todoList.js → links.js → stopwatch.js → notes.js
```

### Why order matters

- `utils.js` declares global functions (`formatTime12Hour`, `copyToClipboard`, `showTemporaryMessage`) and the theme system. Every other module depends on these.
- `timeSlots.js` declares `timeSlots[]` array, `selectedIndex`, and `moveDown()`. **`todoList.js` calls `moveDown()` from the Add Time button** — so `timeSlots.js` must load before `todoList.js`.
- All other modules are independent of each other.

### Global variables (declared in utils.js / timeSlots.js, used across modules)

| Variable | Declared in | Used in |
|---|---|---|
| `formatTime12Hour()` | utils.js | timeSlots.js |
| `copyToClipboard()` | utils.js | todoList.js, notes.js |
| `showTemporaryMessage()` | utils.js | todoList.js |
| `moveDown()` | timeSlots.js | todoList.js (Add Time button) |
| `timeSlots[]` | timeSlots.js | todoList.js (Add Time button) |
| `selectedIndex` | timeSlots.js | timeSlots.js only |

---

## 4. Theming System

Theme is controlled by a `data-theme` attribute on `<body>`:

```html
<body data-theme="dark">   <!-- or "light" -->
```

### How it works

1. `utils.js` reads `localStorage.getItem('theme')` on load (defaults to `'dark'`)
2. Calls `applyTheme(theme)` which sets `document.body.setAttribute('data-theme', theme)`
3. All CSS uses `body[data-theme="dark"]` and `body[data-theme="light"]` selectors
4. The toggle button (`#toggleTheme`) switches between themes and saves to localStorage

### Important CSS rule about theming

Every styled element has **two rules** — one for dark, one for light. When adding new styled components, always add both. Example:

```css
body[data-theme="dark"] .my-component  { background: rgba(255,255,255,0.07); color: #e2e8f0; }
body[data-theme="light"] .my-component { background: rgba(255,255,255,0.55); color: #1a1a2e; }
```

### Subject name color edge case

The `.subject-name` element in notes gets its color set **both in CSS and inline via JavaScript** (`nameEl.style.color = ...` in `notes.js` line ~348). This was done because the CSS specificity battle with other global rules kept losing. If the subject name text becomes invisible again, check both places.

---

## 5. CSS Architecture

**One file:** `css/tasksStyle.css` — approximately 1100 lines. No preprocessor, no CSS modules.

### Structure of tasksStyle.css (top to bottom)

```
1.  @import Google Fonts (Inter)
2.  * { box-sizing: border-box }
3.  Aurora background (body::before animation)
4.  body base styles + dark/light backgrounds
5.  Layout containers (.container, .new-container)
6.  Typography (h1, h2)
7.  Global buttons
8.  Table (time slots)
9.  Stopwatch
10. To-do list (#todoList, .button-wrapper, .count, etc.)
11. Global textarea
12. Status badge (.status-badge, .status-behind, .status-on-schedule)
13. Links sidebar (.links-box, .link-item, .link-actions, etc.)
14. Dropdown menus (.menu)
15. Add Time dropdown (.time-dropdown, .time-option-btn)
16. Notes section (.notes-section, .notes-top-bar, #searchBar)
17. Subject grid (#subjectList, .subject-card, .subject-card-header)
18. Subject header buttons (.subject-header-right) — POSITION ABSOLUTE
19. Notes list (.subject-notes-list, .note-row, .note-row-text)
20. Notes buttons (.notes-btn, .notes-btn-primary, .notes-btn-danger)
21. Note editor modal (.note-editor-overlay, .note-editor-modal)
22. Lightbox (.lightbox-overlay, .lightbox-img, .lightbox-close)
23. Toast (.notes-toast)
24. Responsive (@media max-width: 600px)
```

### Aurora background (performance-critical)

```css
body::before { /* single layer, static gradient, opacity-only animation */ }
body::after  { display: none; } /* deliberately disabled to save GPU */
```

The aurora uses **only opacity animation** — no transforms, no repaints. `will-change: opacity` is set. Animating `transform` or `background` would cause GPU thrashing. Do not change to transform-based animation.

The `body::before` layer is `position: fixed; inset: 0` and `z-index: 0`. All content containers have `position: relative; z-index: 1` to sit above it.

### Button specificity system

Global buttons:
```css
body[data-theme="dark"] button { ... }
body[data-theme="light"] button { ... }
```

Notes-specific buttons use class `.notes-btn` to override globals:
```css
body[data-theme="dark"] button.notes-btn { ... }   /* beats global button rule */
```

**Do NOT use `!important`** on button rules — the file has had serious cascade conflicts in the past from stacking `!important` overrides. Use specificity instead (`body[data-theme] button.classname`).

### Subject header buttons (`.subject-header-right`)

These are `position: absolute; right: 10px; top: 50%; transform: translateY(-50%)` — deliberately taken out of the flex flow so they don't squish the subject name text. The parent `.subject-card-header` has `position: relative`. Do not change this without understanding the layout — the buttons were causing names to truncate to 1-2 characters when in the flex flow.

---

## 6. Module: utils.js

**Loads first. Provides globals for all other modules.**

### Functions

#### `formatTime12Hour(hour24, minute, second) → string`
Converts 24h time to formatted 12h string. Returns `"02:30:00 pm"` format.
- Used by `timeSlots.js` to display time slots and current time.

#### `copyToClipboard(text)`
Creates a temporary off-screen textarea, selects it, runs `document.execCommand('copy')`. Used by todo list and notes copy buttons.

#### `showTemporaryMessage(message, element)`
Appends a fade-in/fade-out `<span>` to `element`. Used for "Copied!" confirmations in the todo list.

### Theme system (runs immediately on load)
- Reads `localStorage.getItem('theme')` → defaults to `'dark'`
- Sets `document.body.setAttribute('data-theme', ...)`
- Binds click handler to `#toggleTheme` button
- **This runs before DOMContentLoaded** because of `defer` — the body element exists by the time defer scripts run.

---

## 7. Module: timeSlots.js

**Manages the time tracking table.**

### Data model

```javascript
timeSlots = [
  { time: "06:00 - 06:30", status: 0 },
  { time: "06:30 - 07:00", status: 0 },
  // ... 48 total slots (6:00am to 6:00am next day, 30-min intervals)
]
selectedIndex = 0   // which slot is currently "current"
```

### localStorage keys
- `selectedIndex` — current position in the time slots array
- `startedIndex` — **no longer used, kept for backward compat only**

### Important: index clamping
`selectedIndex` is clamped to `Math.min(parsed, timeSlots.length - 1)` on load. This is critical — the todo list "Add Time" button calls `moveDown()` which increments `selectedIndex`. If a user clicks it many times, the index can exceed 47 (array length). Without clamping, `timeSlots[selectedIndex]` returns `undefined` and crashes the entire module silently.

### Key functions

#### `moveDown()`
Increments `selectedIndex` by 1 (capped at array length). Saves to localStorage. Re-renders table. Updates current time display. **Called externally by `todoList.js`.**

#### `moveUp()`
Decrements `selectedIndex` by 1 (floor 0). Saves to localStorage.

#### `updateCurrentTime()`
Runs every 1000ms via `setInterval`. Compares current time to the selected time slot. Injects a `.status-badge` span with either `.status-behind` or `.status-on-schedule` class into `#currentTime`. Uses `innerHTML` (not `textContent`) to include the badge HTML.

#### `renderTable()`
Clears `#timeTable` and renders one `<tr>` for the current `selectedIndex`.

### Removed features
- **Combine** — was removed from HTML and JS. The `#combine` button no longer exists.
- **Set or Change Start Time** — removed. The `#started` button no longer exists.
- **Combine Counter** — removed entirely. The `#combineCounter` div was removed from HTML.

---

## 8. Module: todoList.js

**Manages the to-do list.**

### Data model (localStorage: `'todoList'`)
```json
[
  {
    "text": "Task name",
    "count": 42,
    "lastModified": "3/25/2026, 10:07:17 AM"
  }
]
```

### Key behaviors

#### Add Time button
Opens a dropdown (`.time-dropdown`) with options: `3, 6, 12, 18, 24, 30, 60`. Each number represents **slots** to advance (not minutes). Clicking a button calls `moveDown()` that many times AND increments the item's counter by that number. The dropdown stays open after clicking — closes only on outside click. Uses `e.stopPropagation()` on the dropdown div itself to prevent it closing on internal clicks.

#### +1 button  
Was previously "Add Todo". Now a simple `+1` that increments the counter by 1.

#### Drag and drop
Todo items are draggable. Drop logic swaps items in the DOM using `insertBefore`. Saves after every drop. Uses `e.dataTransfer.setData('text/plain', itemText)` to identify which item is being dragged.

#### Edit mode
Clicking Edit replaces the `<span>` content with `<textarea>Save</textarea>`. The Save button restores the span. `editButton.disabled = true` prevents double-clicks opening multiple textareas.

### TIME_OPTIONS constant
```javascript
const TIME_OPTIONS = [3, 6, 12, 18, 24, 30, 60];
const formatSlots = (slots) => String(slots); // just the number as label
```
To change the time options, edit `TIME_OPTIONS` array.

### Last Modified display
Set as inline styles on the `<span>`:
```javascript
lastModifiedSpan.style.display = 'block';
lastModifiedSpan.style.marginTop = '8px';
lastModifiedSpan.style.fontSize = '11px';
lastModifiedSpan.style.opacity = '0.6';
```
CSS class `.last-modified` also exists in the stylesheet as a fallback.

---

## 9. Module: links.js

**Manages the useful links sidebar.**

### Data model (localStorage: `'linksList'`)
```json
[
  { "text": "Google", "url": "https://google.com" },
  { "text": "GitHub", "url": "https://github.com" }
]
```

Links are **sorted alphabetically** by text on every load:
```javascript
savedLinksList.sort((a, b) => a.text.toLowerCase().localeCompare(b.text.toLowerCase()));
```

### Link item DOM structure
```
<li class="no-bullet link-item">
  <a class="link-text" href="..." target="_blank">Link Name</a>
  <div class="link-actions">          ← opacity:0, shows on :hover
    <button class="link-action-btn">✎ Name</button>
    <button class="link-action-btn">✎ URL</button>
    <button class="link-action-btn link-delete-btn">✕</button>
  </div>
</li>
```

The `.link-actions` div is `opacity: 0` by default and `opacity: 1` on `.link-item:hover` via CSS. No JS needed for show/hide.

### Edit buttons
- **✎ Name** — `prompt()` for new name only, updates `<a>` text
- **✎ URL** — `prompt()` for new URL only, updates `<a>` href
- **✕** — `confirm()` then removes `<li>` and saves

Previously used a `⁝` menu icon with a hidden dropdown. This was replaced with always-available (hover-revealed) inline buttons.

---

## 10. Module: stopwatch.js

**Standard stopwatch with Start/Pause/Reset.**

### State
```javascript
let timer;           // setInterval reference
let running = false;
let startTime;       // Date.now() at start (adjusted for elapsed time)
let elapsedTime = 0; // ms
let wakeLock = null; // Screen Wake Lock API reference
```

### Wake Lock
Uses the Screen Wake Lock API to prevent the screen from sleeping while the stopwatch runs:
```javascript
wakeLock = await navigator.wakeLock.request('screen');
```
Released on Pause and Reset. Wrapped in try/catch — fails silently on unsupported browsers.

### Button visibility
Three states managed by `toggleButtons(action)`:
- `'start'` — hides Start, shows Pause + Reset
- `'pause'` — shows Start, hides Pause (Reset stays visible)
- `'reset'` — shows Start, hides Pause + Reset

The `class="hidden"` on `#pauseBtn` and `#resetBtn` in HTML is the initial state. CSS: `.buttons button.hidden { display: none; }`.

### Display format
`HH:MM:SS:mmm` — hours, minutes, seconds, milliseconds (3 digits). Updates every 10ms.

---

## 11. Module: notes.js

**The most complex module. Self-contained IIFE.**

### Architecture
The entire module is wrapped in an IIFE:
```javascript
(function () { 'use strict'; /* everything */ })();
```
This prevents all variables from leaking to global scope.

### Data model (localStorage: `'notes_v2'`)
```json
{
  "subjects": [
    {
      "id": "abc123def",
      "name": "Rancher",
      "notes": [
        {
          "id": "xyz789ghi",
          "content": "Note text here",
          "images": ["data:image/png;base64,..."],
          "createdAt": 1711234567890,
          "updatedAt": 1711234567890
        }
      ]
    }
  ]
}
```

### Legacy data migration
The old format used localStorage key `'subjects'` and stored notes as URL-encoded strings. On load, if `'notes_v2'` doesn't exist, it falls back to `'subjects'` and migrates:
```javascript
const raw = localStorage.getItem('notes_v2') || localStorage.getItem('subjects');
```
Notes that are plain strings get decoded with `decodeURIComponent()`.

### Cross-tab sync
Two mechanisms:
1. **`storage` event** — fires instantly in other tabs when localStorage changes. Triggers `applyIncoming()`.
2. **`setInterval` polling** — every 15 seconds, checks if `notes_v2_ts` timestamp in localStorage is newer than `lastSavedTs`. If so, pulls and merges.

#### Merge strategy
When incoming data arrives from another tab:
- Subjects matched by `id`. New subjects are added.
- Notes matched by `id`. If both tabs have the same note, the one with the newer `updatedAt` timestamp wins.
- **Nothing is ever deleted by a merge** — deletions are local-only.

### UI layout

#### Normal view (notes hidden)
- `#showNotes` button is visible
- `.notes-section` is `display: none`

#### Notes fullscreen view (after clicking Show Notes)
- All `.container` divs set to `display: none`
- `.new-container h2` elements hidden
- `.stopwatch` hidden
- `.notes-section` shown as `display: flex`
- `#hideNotes` shown

#### Toolbar (`.notes-top-bar`)
Built dynamically in `init()` by moving existing DOM elements:
```javascript
toolbar.appendChild(document.getElementById('searchBar'));
toolbar.appendChild(document.getElementById('addSubjectBtn'));
toolbar.appendChild(document.getElementById('exportButtonContainer'));
toolbar.appendChild(document.getElementById('hideNotes'));
ns.insertBefore(toolbar, ns.firstChild);
```
The toolbar div `.notes-top-bar` is inserted as the first child of `.notes-section`.

#### Subject cards layout
- CSS Grid: `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`
- Collapsed card: shows grip handle + chevron + name + note count
- Expanded card: `grid-column: 1 / -1` (spans full row width)
- Only ONE subject can be expanded at a time (tracked by `expandedSubject` variable)

#### Subject header buttons
Three small buttons (＋, ✎, ✕) are `position: absolute; right: 10px` inside the header. They are `opacity: 0; pointer-events: none` by default, revealed on header hover. **Do not put them back in the flex flow** — this caused subject names to truncate to 1-2 characters.

### Key functions

#### `init()`
Entry point. Loads data, sets up all event listeners, builds toolbar, sets initial show/hide state, starts cross-tab sync, calls `render()`.

#### `render()`
Clears `#subjectList` and rebuilds all subject cards. Called after any data change.

#### `buildSubjectCard(subject)`
Creates the full card DOM including header, hover buttons, notes list, and drag handlers.

#### `buildNoteRow(note, subjectId)`
Creates a single note row with: content area (text + images), action buttons (Add Above, Add Below, Edit, Delete, Copy).

#### `openEditor(subjectId, noteId, insertAtIndex)`
Opens the modal editor. Three modes:
- `noteId` provided → edit existing note
- `insertAtIndex` provided → insert new note at that position in the array
- Neither → append new note to end

#### `openLightbox(src)`
Opens full-screen image viewer. Closes on: ✕ button click, overlay click, Escape key.

#### `exportJSON()` / `importJSON(file)`
Export: `JSON.stringify(data)` → downloads as `.json` file.
Import: reads file → calls `mergeSubjects()` → saves → re-renders. Duplicates by ID are merged (newer wins), new content is added.

### Drag and drop (two separate systems)

#### Note drag (between subjects)
- `dragNotePayload = { noteId, fromSubjectId }` set on `dragstart`
- Drop target is `.subject-notes-list`
- On drop: splice note from source array, push to target array, save, render

#### Subject drag (reorder subjects)
- Triggered only from the grip handle (`⠿`)
- `dragSubjectId` set on `dragstart`
- Drop target is the `.subject-card` itself
- On drop: find both indices in `data.subjects`, splice and reinsert

The two systems don't conflict because note rows call `e.stopPropagation()` on `dragstart` to prevent bubbling up to the card's drag handler.

### Image paste
In the editor modal, `textarea.addEventListener('paste', ...)` extracts images from `e.clipboardData.items`. Each image is converted to base64 via `FileReader.readAsDataURL()`. Images are stored in the note's `images[]` array as base64 data URLs. **Note:** Large images stored as base64 can bloat localStorage significantly.

---

## 12. Data Storage Reference

All data is in `localStorage`. No cookies, no server, no IndexedDB.

| Key | Module | Format | Description |
|---|---|---|---|
| `theme` | utils.js | `"dark"` or `"light"` | Current UI theme |
| `selectedIndex` | timeSlots.js | integer (0–47) | Current time slot position |
| `todoList` | todoList.js | JSON array | All todo items with text, count, lastModified |
| `linksList` | links.js | JSON array | All saved links with text and url |
| `notes_v2` | notes.js | JSON object | All subjects and notes with IDs and timestamps |
| `notes_v2_ts` | notes.js | integer | Timestamp of last save (for cross-tab sync) |
| `subjects` | notes.js | legacy | Old notes format — auto-migrated on load |

### localStorage size limits
Browsers typically allow 5–10MB. Base64 images in notes are the main risk. A 1MB image becomes ~1.33MB as base64. With many images, localStorage can fill up and writes will silently fail. If notes stop saving, check `localStorage.length` or catch storage errors.

---

## 13. HTML Structure

```html
<body data-theme="dark">

  <!-- LEFT: Links sidebar -->
  <div class="container">
    <h2>Useful Links</h2>
    <ul id="linksList"></ul>           ← populated by links.js
    <button id="addLink">Add Link</button>
    <button id="toggleTheme">Toggle Theme</button>
  </div>

  <!-- CENTER: Time tracker + Todo -->
  <div class="container">
    <h1>Productivity Booster</h1>
    <table>
      <thead><tr><th>Time</th></tr></thead>
      <tbody id="timeTable"></tbody>   ← populated by timeSlots.js
    </table>
    <button id="moveUp">Move Up</button>
    <button id="moveDown">Move Down</button>
    <button id="clearState">Clear State</button>
    <div id="currentTime"></div>       ← updated by timeSlots.js every second
    <h2>To-Do List</h2>
    <ul id="todoList"></ul>            ← populated by todoList.js
    <button id="addTodoItem">Add Task</button>
    <button id="exportTodoList">Export To-Do List</button>
  </div>

  <!-- RIGHT: Stopwatch + Notes -->
  <div class="new-container">
    <h2>Stopwatch</h2>
    <div class="stopwatch">
      <div class="time-display">
        <span class="hours">00</span>:<span class="minutes">00</span>:
        <span class="seconds">00</span>:<span class="milliseconds">000</span>
      </div>
      <div class="buttons">
        <button id="startBtn">Start</button>
        <button class="hidden" id="pauseBtn">Pause</button>
        <button class="hidden" id="resetBtn">Reset</button>
      </div>
    </div>

    <h2>Notes</h2>
    <div class="notes-section">         ← notes.js builds toolbar inside here
      <input id="searchBar" .../>
      <button id="addSubjectBtn">Add Subject</button>
      <ul id="subjectList"></ul>        ← populated by notes.js
      <div id="exportButtonContainer">
        <button id="exportbutton">Export</button>
        <!-- Import button injected here by notes.js init() -->
      </div>
    </div>

    <div id="notesToggleButtons">
      <button id="showNotes">Show Notes</button>
      <button id="hideNotes" style="display:none">Hide Notes</button>
    </div>
  </div>

</body>
```

### Important IDs (required by JS — do not rename)

| ID | Used by |
|---|---|
| `linksList` | links.js |
| `addLink` | links.js |
| `toggleTheme` | utils.js |
| `timeTable` | timeSlots.js |
| `moveUp`, `moveDown`, `clearState` | timeSlots.js |
| `currentTime` | timeSlots.js |
| `todoList` | todoList.js |
| `addTodoItem`, `exportTodoList` | todoList.js |
| `startBtn`, `pauseBtn`, `resetBtn` | stopwatch.js |
| `searchBar` | notes.js |
| `addSubjectBtn` | notes.js |
| `subjectList` | notes.js |
| `exportbutton` | notes.js |
| `exportButtonContainer` | notes.js (Import button injected here) |
| `showNotes`, `hideNotes` | notes.js |
| `notesToggleButtons` | notes.js (hides this div after toolbar is built) |

---

## 14. Known Quirks & Important Rules

### 1. Never use `!important` in CSS
The file has a history of cascading `!important` conflicts that broke the entire site. Use specificity instead: `body[data-theme="dark"] button.my-class` beats `body[data-theme="dark"] button`.

### 2. `formatTime12Hour` must only be declared once
It lives in `utils.js`. It was previously duplicated in `timeSlots.js` causing "Identifier already declared" errors that silently killed all JS. If adding a new module that needs it, it's already global — just call it.

### 3. Subject names use dual color setting
Both CSS (`body[data-theme] .subject-name { color: ... }`) and JS (`nameEl.style.color = ...`) set the subject name color. The JS inline style was added as a fix after CSS specificity kept losing. If names become invisible, check both.

### 4. `overflow: hidden` on `.subject-card` breaks hover buttons
The `.subject-card` must have `overflow: visible` so that `.subject-header-right` (which is `position: absolute`) isn't clipped. Do not add `overflow: hidden` to the card.

### 5. The `body::after` is intentionally `display: none`
The aurora uses only `body::before` to halve GPU load. The `::after` is defined but disabled. Do not re-enable it without a strong reason.

### 6. Notes toolbar is built dynamically
The `.notes-top-bar` div doesn't exist in HTML — it's created by `notes.js` `init()` and elements are moved into it from their original positions. If you need to add something to the toolbar, either add it to the HTML in `.notes-section` (notes.js will move it) or append it directly in the `init()` toolbar-building block.

### 7. `selectedIndex` clamping is critical
If `localStorage.getItem('selectedIndex')` returns a number larger than 47 (which happens when the Add Time button is clicked many times), `timeSlots[selectedIndex]` returns `undefined`. Always clamp on load:
```javascript
let selectedIndex = Math.min(parseInt(localStorage.getItem('selectedIndex')) || 0, timeSlots.length - 1);
```

### 8. Script load order is non-negotiable
`todoList.js` calls `moveDown()` which is defined in `timeSlots.js`. If `todoList.js` loads first, `moveDown` is undefined and the Add Time button breaks silently.

---

## 15. Performance Notes

### Aurora background
- Uses `body::before` only (one composited layer)
- Animation is **opacity only** — no transforms, no repaints
- `will-change: opacity` is set to pre-promote the layer
- 40-second animation cycle keeps CPU wakeups minimal
- Respects `prefers-reduced-motion` media query (disables animation if OS setting is on)
- **Do not add `transform` or `background` to the keyframes** — this causes continuous repainting and spins up the fan

### Backdrop blur (glass effect)
Buttons and cards use semi-transparent backgrounds without `backdrop-filter: blur()`. Backdrop filter was previously applied to all elements but caused noticeable hover lag even on modern Macs. If you want to re-add it, add it only to the note editor modal (which is rarely visible) — not to permanently-visible elements like buttons.

### localStorage
All data reads/writes are synchronous. With large notes (especially base64 images), saves can take 10–50ms. If the notes module feels slow, check the size of `notes_v2` in localStorage.

---

## 16. How to Add New Features

### Add a new button to the main page
1. Add `<button id="myBtn">Label</button>` in `index.html` inside the appropriate `.container`
2. Add event listener in the relevant JS file
3. Style in `tasksStyle.css` — it will inherit global button styles automatically

### Add a new field to todo items
1. In `todoList.js` → `addTodoItem()`: add DOM creation and event listener
2. In `saveTodoList()`: include the new field in the mapped object
3. In `loadTodoList()` / `addTodoItem()`: read the saved field from `item.newField`

### Add a new field to notes
1. In `notes.js` → `loadRaw()`: add the field to the note mapping with a default value
2. In `openEditor()` save handler: include the field when saving
3. In `buildNoteRow()`: display the field

### Add a new subject to notes
Users add subjects via the Add Subject button — no code change needed. To add programmatically:
```javascript
data.subjects.push({ id: uid(), name: 'New Subject', notes: [] });
save();
render();
```

### Change the time slot interval
Currently 30-minute slots from 6:00am to 6:00am (next day). To change to 15-minute slots, modify the `timeSlots.js` generator loop. Note: `timeSlots.length` would change from 48 to 96 — update the `Math.min` clamp accordingly.

### Add a new localStorage key
1. Use a unique key string (check the table in [Data Storage Reference](#12-data-storage-reference))
2. Always provide a default for `JSON.parse(localStorage.getItem('key')) || defaultValue`
3. Document it in this README

### Add a new CSS component
Follow this pattern:
```css
/* Component name */
.my-component {
    /* shared/layout styles */
    border-radius: 8px;
    padding: 10px;
}

body[data-theme="dark"]  .my-component { background: rgba(255,255,255,0.07); color: #e2e8f0; }
body[data-theme="light"] .my-component { background: rgba(255,255,255,0.55); color: #1a1a2e; }
```
Place it in the relevant section of `tasksStyle.css` (see structure map above).

---

*Last updated: March 2026. This README reflects the current state of the codebase after the following major refactors: JS split into individual modules, glassmorphism theme with aurora background, notes module complete rewrite with subjects/cards/cross-tab sync, todo list Add Time dropdown, links inline edit buttons.*
