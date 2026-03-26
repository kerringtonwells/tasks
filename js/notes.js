/**
 * notes.js
 * - Subjects displayed side-by-side, click to expand vertically
 * - Notes stack vertically inside expanded subject
 * - Subjects draggable to reorder
 * - Notes draggable between subjects
 * - Show Notes = fullscreen takeover
 * - Cross-tab sync, export/import JSON, paste images
 */

(function () {
  'use strict';

  var STORAGE_KEY   = 'notes_v2';
  var TS_KEY        = 'notes_v2_ts';
  var LEGACY_KEY    = 'subjects';
  var SYNC_INTERVAL = 15000;
  var IDB_NAME      = 'kwells_notes';
  var IDB_STORE     = 'images';
  var idb           = null; // IndexedDB connection

  var data              = { subjects: [] };
  var lastSavedTs       = 0;
  var expandedSubject   = null;
  var dragNotePayload   = null;   // { noteId, fromSubjectId }
  var dragSubjectId     = null;   // id of subject being dragged
  var internalClipboard = { images: [] }; // for copying images between notes

  // ─── Utility ────────────────────────────────────────────────────────────────
  function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36); }
  function now() { return Date.now(); }
  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }
  function btn(label, onClick, cls) {
    var b = el('button', cls || 'notes-btn');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  // ─── IndexedDB Image Store ───────────────────────────────────────────────────

  function openIDB() {
    return new Promise(function(res, rej) {
      if (idb) { res(idb); return; }
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE); // key = imageId
        }
      };
      req.onsuccess  = function(e) { idb = e.target.result; res(idb); };
      req.onerror    = function(e) { rej(e.target.error); };
    });
  }

  function idbPut(id, dataUrl) {
    return openIDB().then(function(db) {
      return new Promise(function(res, rej) {
        var tx  = db.transaction(IDB_STORE, 'readwrite');
        var st  = tx.objectStore(IDB_STORE);
        var req = st.put(dataUrl, id);
        req.onsuccess = function() { res(); };
        req.onerror   = function(e) { rej(e.target.error); };
      });
    });
  }

  function idbGet(id) {
    return openIDB().then(function(db) {
      return new Promise(function(res, rej) {
        var tx  = db.transaction(IDB_STORE, 'readonly');
        var st  = tx.objectStore(IDB_STORE);
        var req = st.get(id);
        req.onsuccess = function() { res(req.result || null); };
        req.onerror   = function(e) { rej(e.target.error); };
      });
    });
  }

  function idbDelete(id) {
    return openIDB().then(function(db) {
      return new Promise(function(res, rej) {
        var tx  = db.transaction(IDB_STORE, 'readwrite');
        var st  = tx.objectStore(IDB_STORE);
        var req = st.delete(id);
        req.onsuccess = function() { res(); };
        req.onerror   = function(e) { rej(e.target.error); };
      });
    });
  }

  // Save image to IDB, return a reference ID instead of the raw base64
  // Images in notes are stored as "idb:<id>" — resolved at render time
  function saveImageToIDB(dataUrl) {
    var id = 'img_' + uid();
    return idbPut(id, dataUrl).then(function() { return 'idb:' + id; });
  }

  // Resolve all "idb:<id>" references in a note's images array to real data URLs
  function resolveImages(images) {
    var promises = images.map(function(src) {
      if (src.indexOf('idb:') === 0) {
        return idbGet(src.slice(4)).then(function(data) { return data || src; });
      }
      return Promise.resolve(src);
    });
    return Promise.all(promises);
  }

  // ─── Storage ────────────────────────────────────────────────────────────────
  function save() {
    var ts = now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(TS_KEY, String(ts));
      lastSavedTs = ts;
      checkStorageWarning();
      updateStorageMeter();
    } catch(e) {
      if (e.name === 'QuotaExceededError') {
        toast('⚠ Storage full! Images are compressed but this note may have too many. Try removing some images.');
      } else {
        toast('⚠ Could not save: ' + e.message);
      }
    }
  }

  function parseSubjects(raw) {
    var parsed   = JSON.parse(raw);
    var subjects = Array.isArray(parsed) ? parsed : (parsed.subjects || []);
    return {
      subjects: subjects.map(function(s) {
        return {
          id    : s.id || uid(),
          name  : s.name || 'Untitled',
          notes : (s.notes || []).map(function(n) {
            if (typeof n === 'string') {
              return { id: uid(), content: decodeURIComponent(n), images: [], createdAt: now(), updatedAt: now() };
            }
            return {
              id        : n.id || uid(),
              content   : n.content || '',
              images    : Array.isArray(n.images) ? n.images : [],
              createdAt : n.createdAt || now(),
              updatedAt : n.updatedAt || now()
            };
          })
        };
      })
    };
  }

  // ─── Storage usage ──────────────────────────────────────────────────────────

  function getLocalStorageBytes() {
    var total = 0;
    for (var key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += (localStorage[key].length + key.length) * 2;
      }
    }
    return total;
  }

  function getIDBBytes() {
    return openIDB().then(function(db) {
      return new Promise(function(res) {
        var tx    = db.transaction(IDB_STORE, 'readonly');
        var store = tx.objectStore(IDB_STORE);
        var req   = store.getAll();
        req.onsuccess = function() {
          var total = 0;
          (req.result || []).forEach(function(val) {
            total += (val ? val.length * 2 : 0);
          });
          res(total);
        };
        req.onerror = function() { res(0); };
      });
    }).catch(function() { return 0; });
  }

  function formatBytes(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
    if (bytes >= 1048576)    return (bytes / 1048576).toFixed(2) + ' MB';
    if (bytes >= 1024)       return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
  }

  function checkStorageWarning(totalBytes) {
    var lsBytes = getLocalStorageBytes();
    if (lsBytes > 3670016) { // localStorage > 3.5MB
      toast('⚠ Text storage at ' + formatBytes(lsBytes) + ' — approaching 5MB limit.');
    }
  }

  function updateStorageMeter() {
    var el = document.getElementById('notes-storage-meter');
    if (!el) return;
    var lsBytes = getLocalStorageBytes();
    getIDBBytes().then(function(idbBytes) {
      var total = lsBytes + idbBytes;
      el.textContent = '💾 ' + formatBytes(total);
      el.title = 'localStorage: ' + formatBytes(lsBytes) + '  |  Images (IndexedDB): ' + formatBytes(idbBytes);
      // Color based on localStorage % (that's the real limit)
      var lsPct = lsBytes / 5242880;
      if (lsPct > 0.7) {
        el.style.color = '#f87171';
        el.style.background = 'rgba(239,68,68,0.15)';
        el.style.borderColor = 'rgba(239,68,68,0.3)';
      } else if (lsPct > 0.5) {
        el.style.color = '#fbbf24';
        el.style.background = 'rgba(251,191,36,0.15)';
        el.style.borderColor = 'rgba(251,191,36,0.3)';
      } else {
        el.style.color = '#4ade80';
        el.style.background = 'rgba(74,222,128,0.12)';
        el.style.borderColor = 'rgba(74,222,128,0.3)';
      }
    });
  }

  function load() {
    var raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
    if (raw) { try { data = parseSubjects(raw); } catch(e) { console.error('Notes load error', e); } }
    lastSavedTs = parseInt(localStorage.getItem(TS_KEY) || '0', 10);
    // Migrate any raw base64 images still in localStorage to IDB
    migrateImagesToIDB();
  }

  function migrateImagesToIDB() {
    var needsSave = false;
    var promises  = [];
    data.subjects.forEach(function(s) {
      s.notes.forEach(function(n) {
        if (!n.images || !n.images.length) return;
        n.images.forEach(function(src, i) {
          if (src.indexOf('data:') === 0) { // raw base64 — migrate it
            var p = saveImageToIDB(src).then(function(ref) {
              n.images[i] = ref;
              needsSave = true;
            });
            promises.push(p);
          }
        });
      });
    });
    if (promises.length > 0) {
      Promise.all(promises).then(function() {
        if (needsSave) {
          save();
          toast('Migrated ' + promises.length + ' image(s) to expanded storage');
        }
      });
    }
  }

  // ─── Cross-tab sync ──────────────────────────────────────────────────────────
  function mergeNotes(local, incoming) {
    var map = {};
    local.forEach(function(n) { map[n.id] = n; });
    incoming.forEach(function(n) {
      if (!map[n.id]) { map[n.id] = n; }
      else if (n.updatedAt > map[n.id].updatedAt) { map[n.id] = n; }
    });
    return Object.values(map);
  }

  function mergeSubjects(local, incoming) {
    var map = {};
    local.forEach(function(s) { map[s.id] = s; });
    incoming.forEach(function(s) {
      if (!map[s.id]) { map[s.id] = s; }
      else { map[s.id].name = s.name; map[s.id].notes = mergeNotes(map[s.id].notes, s.notes); }
    });
    return Object.values(map);
  }

  function applyIncoming(raw) {
    try {
      var inc = parseSubjects(raw);
      data.subjects = mergeSubjects(data.subjects, inc.subjects);
      render();
      toast('Synced from another tab');
    } catch(e) { console.error('Sync error', e); }
  }

  function startSync() {
    window.addEventListener('storage', function(e) {
      if (e.key === STORAGE_KEY && e.newValue) applyIncoming(e.newValue);
    });
    setInterval(function() {
      var remote = parseInt(localStorage.getItem(TS_KEY) || '0', 10);
      if (remote > lastSavedTs) {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) { applyIncoming(raw); lastSavedTs = remote; }
      }
    }, SYNC_INTERVAL);
  }

  // ─── Export / Import ────────────────────────────────────────────────────────
  function exportJSON() {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = 'notes_' + new Date().toISOString().slice(0,10) + '.json';
    a.click(); URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var inc = parseSubjects(e.target.result);
        data.subjects = mergeSubjects(data.subjects, inc.subjects);
        save(); render(); toast('Import complete');
      } catch(err) { alert('Invalid notes file.'); }
    };
    reader.readAsText(file);
  }

  function triggerImport() {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json';
    inp.onchange = function(e) { if (e.target.files[0]) importJSON(e.target.files[0]); };
    inp.click();
  }

  // ─── Images ──────────────────────────────────────────────────────────────────

  // Compress image to JPEG at max 1200px wide and 0.75 quality
  // This keeps base64 size well under 200KB for most images
  function compressImage(file) {
    return new Promise(function(res, rej) {
      var reader = new FileReader();
      reader.onerror = rej;
      reader.onload = function(e) {
        var img = new Image();
        img.onerror = rej;
        img.onload = function() {
          var MAX = 1200;
          var w = img.width;
          var h = img.height;
          if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          res(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function processImageFiles(files) {
    var out = [];
    for (var i = 0; i < files.length; i++) {
      if (files[i].type.startsWith('image/')) {
        try {
          var compressed = await compressImage(files[i]);
          var ref = await saveImageToIDB(compressed); // store in IDB, get ref
          out.push(ref);
        } catch(e) { toast('Could not load image: ' + files[i].name); }
      }
    }
    return out;
  }

  async function pastedImages(e) {
    var items = Array.from((e.clipboardData || {}).items || []);
    var files = [];
    for (var item of items) {
      if (item.type.startsWith('image/')) { e.preventDefault(); files.push(item.getAsFile()); }
    }
    return await processImageFiles(files);
  }

  // ─── Toast ───────────────────────────────────────────────────────────────────
  function toast(msg) {
    var old = document.getElementById('notes-toast');
    if (old) old.remove();
    var d = document.createElement('div');
    d.id = 'notes-toast'; d.className = 'notes-toast'; d.textContent = msg;
    document.body.appendChild(d);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ d.classList.add('visible'); }); });
    setTimeout(function(){ d.classList.remove('visible'); setTimeout(function(){ d.remove(); }, 400); }, 3000);
  }

  // ─── Lightbox ─────────────────────────────────────────────────────────────────
  function openLightbox(src) {
    var overlay = el('div', 'lightbox-overlay');
    var img     = el('img', 'lightbox-img');
    img.src     = src;

    var close       = el('button', 'lightbox-close');
    close.textContent = '✕';
    close.addEventListener('click', function(){ overlay.remove(); });
    overlay.addEventListener('click', function(e){ if (e.target === overlay) overlay.remove(); });

    // Close on Escape
    function onKey(e){ if (e.key === 'Escape'){ overlay.remove(); document.removeEventListener('keydown', onKey); } }
    document.addEventListener('keydown', onKey);

    overlay.appendChild(close);
    overlay.appendChild(img);
    document.body.appendChild(overlay);
  }

  // ─── Editor Modal ────────────────────────────────────────────────────────────
  function openEditor(subjectId, noteId, insertAtIndex) {
    var subject  = data.subjects.find(function(s){ return s.id === subjectId; });
    if (!subject) return;
    var existing = noteId ? subject.notes.find(function(n){ return n.id === noteId; }) : null;
    var imgs = [];

    var overlay = el('div','note-editor-overlay');
    var modal   = el('div','note-editor-modal');
    var title   = el('h3','editor-title');
    var modeLabel = (insertAtIndex !== undefined) ? 'Insert note in' : 'New note in';
    title.textContent = existing ? ('Edit — ' + subject.name) : (modeLabel + ' "' + subject.name + '"');

    var ta = el('textarea','editor-textarea');
    ta.value = existing ? existing.content : '';
    ta.placeholder = 'Write your note… paste images with Ctrl+V';
    ta.spellcheck = true;

    var strip = el('div','editor-img-strip');

    // refreshStrip defined before any async call that uses it
    function refreshStrip() {
      strip.innerHTML = '';
      imgs.forEach(function(src, i) {
        var wrap = el('div','editor-img-thumb-wrap');
        var img  = el('img','editor-img-thumb'); img.src = src;
        var rm   = el('button','img-rm-btn'); rm.textContent = '×';
        rm.onclick = function(){ imgs.splice(i,1); refreshStrip(); };
        wrap.appendChild(img); wrap.appendChild(rm); strip.appendChild(wrap);
      });
    }

    // Resolve existing images from IDB after strip is ready
    if (existing && existing.images && existing.images.length) {
      resolveImages(existing.images).then(function(resolved) {
        imgs = resolved;
        refreshStrip();
      });
    }

    refreshStrip();

    var blockNextPaste = false; // set true after paste button click to ignore Ctrl+V text
    ta.addEventListener('paste', function(e) {
      if (blockNextPaste) {
        e.preventDefault();
        blockNextPaste = false;
        return;
      }
      // Handle real system clipboard images (screenshots, drags from Finder etc.)
      pastedImages(e).then(function(found){
        if (found.length) { imgs = imgs.concat(found); refreshStrip(); }
      });
    });

    // Drag-and-drop images onto the textarea or strip
    function handleDrop(e) {
      e.preventDefault();
      e.stopPropagation();
      ta.classList.remove('img-drag-over');
      var files = Array.from(e.dataTransfer.files);
      processImageFiles(files).then(function(found) {
        if (found.length) { imgs = imgs.concat(found); refreshStrip(); }
      });
    }
    ta.addEventListener('dragover',  function(e){ e.preventDefault(); ta.classList.add('img-drag-over'); });
    ta.addEventListener('dragleave', function()  { ta.classList.remove('img-drag-over'); });
    ta.addEventListener('drop', handleDrop);
    strip.addEventListener('dragover',  function(e){ e.preventDefault(); });
    strip.addEventListener('drop', handleDrop);

    // File picker button
    var pickImgB = btn('📎 Add Image', function() {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
      inp.onchange = function(e) {
        processImageFiles(Array.from(e.target.files)).then(function(found) {
          if (found.length) { imgs = imgs.concat(found); refreshStrip(); }
        });
      };
      inp.click();
    }, 'notes-btn');

    // Paste copied images button — shows only when internal clipboard has images
    var pasteImgB = btn('📋 Paste Image', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (!internalClipboard.images.length) { toast('No copied images — click Copy on a note first'); return; }
      var clipImgs = internalClipboard.images.slice();
      internalClipboard.images = [];
      pasteImgB.style.display = 'none';
      var savePromises = clipImgs.map(function(dataUrl) {
        return dataUrl ? saveImageToIDB(dataUrl) : Promise.resolve(null);
      });
      Promise.all(savePromises).then(function(newRefs) {
        imgs = imgs.concat(newRefs.filter(Boolean));
        refreshStrip();
        toast('✓ Image(s) added — write your note and click Save');
      });
      // Block the next paste event so returning focus doesn't paste system clipboard text
      blockNextPaste = true;
      setTimeout(function(){ ta.focus(); setTimeout(function(){ blockNextPaste = false; }, 300); }, 0);
    }, 'notes-btn notes-btn-primary');
    // Only show if there are copied images waiting
    pasteImgB.style.display = internalClipboard.images.length ? 'inline-block' : 'none';

    var row   = el('div','editor-btn-row');
    row.appendChild(pickImgB);
    row.appendChild(pasteImgB);
    var saveB = btn('Save', function() {
      var content = ta.value.trim();
      if (!content && !imgs.length) { toast('Note is empty'); return; }
      if (existing) { existing.content = content; existing.images = imgs; existing.updatedAt = now(); }
      else if (insertAtIndex !== undefined) {
        subject.notes.splice(insertAtIndex, 0, { id: uid(), content: content, images: imgs, createdAt: now(), updatedAt: now() });
      }
      else { subject.notes.push({ id: uid(), content: content, images: imgs, createdAt: now(), updatedAt: now() }); }
      save(); render(); overlay.remove();
    }, 'notes-btn notes-btn-primary');
    var cancelB = btn('Cancel', function(){ overlay.remove(); });
    row.appendChild(saveB); row.appendChild(cancelB);

    modal.appendChild(title); modal.appendChild(ta);
    modal.appendChild(strip); modal.appendChild(row);
    overlay.appendChild(modal);
    overlay.addEventListener('click', function(e){ if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    ta.focus();
  }

  // ─── Note Row ────────────────────────────────────────────────────────────────
  function buildNoteRow(note, subjectId) {
    var subject = data.subjects.find(function(s){ return s.id === subjectId; });
    var row     = el('div','note-row');
    row.dataset.id = note.id;
    row.draggable  = true;

    var content = el('div','note-row-content');
    if (note.images && note.images.length) {
      var imgWrap = el('div','note-row-images');
      // Resolve IDB references async, render placeholders first
      note.images.forEach(function(src) {
        var imgEl = el('img','note-row-img');
        imgEl.style.minWidth = '60px'; imgEl.style.minHeight = '40px';
        if (src.indexOf('idb:') === 0) {
          idbGet(src.slice(4)).then(function(data) {
            if (data) {
              imgEl.src = data;
              imgEl.addEventListener('click', function(e){ e.stopPropagation(); openLightbox(data); });
            }
          });
        } else {
          imgEl.src = src;
          imgEl.addEventListener('click', function(e){ e.stopPropagation(); openLightbox(src); });
        }
        imgWrap.appendChild(imgEl);
      });
      content.appendChild(imgWrap);
    }
    var txt = el('div','note-row-text');
    txt.innerHTML = esc(note.content).replace(/\n/g,'<br>');
    content.appendChild(txt);

    var actions = el('div','note-row-actions');

    actions.appendChild(btn('Add Above', function(e){
      e.stopPropagation();
      var idx = subject.notes.findIndex(function(n){ return n.id === note.id; });
      openEditor(subjectId, null, idx);
    }));

    actions.appendChild(btn('Add Below', function(e){
      e.stopPropagation();
      var idx = subject.notes.findIndex(function(n){ return n.id === note.id; });
      openEditor(subjectId, null, idx + 1);
    }));

    actions.appendChild(btn('Edit', function(e){
      e.stopPropagation(); openEditor(subjectId, note.id);
    }));

    var delB = btn('Delete', function(e){
      e.stopPropagation();
      if (!confirm('Delete this note?')) return;
      subject.notes = subject.notes.filter(function(n){ return n.id !== note.id; });
      save(); render();
    });
    delB.classList.add('notes-btn-danger');
    actions.appendChild(delB);

    var copyB = btn('Copy', function(e){
      e.stopPropagation();
      // Visual feedback on the button itself
      var orig = copyB.textContent;
      copyB.textContent = '✓ Copied!';
      copyB.style.color = '#4ade80';
      setTimeout(function(){ copyB.textContent = orig; copyB.style.color = ''; }, 2000);

      // Copy text to system clipboard
      var clipTa = document.createElement('textarea');
      clipTa.value = note.content; document.body.appendChild(clipTa);
      clipTa.select(); document.execCommand('copy'); document.body.removeChild(clipTa);

      var imgRefs = note.images ? note.images.slice() : [];
      if (imgRefs.length) {
        resolveImages(imgRefs).then(function(resolved) {
          internalClipboard.images = resolved;

          // Try to write first image to system clipboard (works on HTTPS, not file://)
          if (resolved.length && navigator.clipboard && window.ClipboardItem) {
            try {
              // Convert base64 data URL to a Blob
              var dataUrl = resolved[0];
              var parts   = dataUrl.split(',');
              var mime    = parts[0].match(/:(.*?);/)[1]; // e.g. "image/jpeg"
              var bytes   = atob(parts[1]);
              var arr     = new Uint8Array(bytes.length);
              for (var i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
              var blob    = new Blob([arr], { type: 'image/png' }); // browsers only accept png
              navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                .then(function() {
                  toast('✓ Copied! Image is in your system clipboard — paste anywhere');
                })
                .catch(function() {
                  // Clipboard write blocked (file:// or permissions)
                  toast('Copied! (' + imgRefs.length + ' image(s) — use 📋 Paste Image in editor)');
                });
            } catch(err) {
              toast('Copied! (' + imgRefs.length + ' image(s) — use 📋 Paste Image in editor)');
            }
          } else {
            toast('Copied! (' + imgRefs.length + ' image(s) — use 📋 Paste Image in editor)');
          }
        });
      } else {
        internalClipboard.images = [];
      }
    });
    actions.appendChild(copyB);

    row.appendChild(content);
    row.appendChild(actions);

    // Note drag (to move between subjects)
    row.addEventListener('dragstart', function(e){
      dragNotePayload = { noteId: note.id, fromSubjectId: subjectId };
      dragSubjectId   = null; // note drag takes priority
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'note:' + note.id);
      e.stopPropagation(); // don't let card's dragstart fire
      setTimeout(function(){ row.classList.add('dragging'); }, 0);
    });
    row.addEventListener('dragend', function(){
      row.classList.remove('dragging'); dragNotePayload = null;
    });

    return row;
  }

  // ─── Subject Card ────────────────────────────────────────────────────────────
  function buildSubjectCard(subject) {
    var isOpen = (expandedSubject === subject.id);
    var card   = el('div', isOpen ? 'subject-card subject-card-expanded' : 'subject-card');
    card.dataset.id = subject.id;

    // ── Header ──────────────────────────────────────────────────
    var header  = el('div','subject-card-header');
    // Grab handle indicator
    var grip    = el('span','subject-grip'); grip.textContent = '⠿';
    var chevron = el('span','subject-chevron');
    chevron.textContent = isOpen ? '▼' : '▶';
    var nameEl  = el('span','subject-name');
    nameEl.textContent = subject.name;
    nameEl.style.color = document.body.getAttribute("data-theme") === "dark" ? "#f0f0f0" : "#111827";
    nameEl.style.fontWeight = "700";
    nameEl.style.flex = "1";
    var count   = el('span','subject-count');
    count.textContent = subject.notes.length + ' note' + (subject.notes.length !== 1 ? 's' : '');

    var left = el('div','subject-header-left');
    left.appendChild(grip);
    left.appendChild(chevron);
    left.appendChild(nameEl);
    left.appendChild(count);

    var right  = el('div','subject-header-right');
    right.appendChild(btn('＋', function(e){ e.stopPropagation(); openEditor(subject.id); }));
    right.appendChild(btn('✎', function(e){
      e.stopPropagation();
      var n = prompt('New name:', subject.name);
      if (n && n.trim()) { subject.name = n.trim(); save(); render(); }
    }));
    var delB = btn('✕', function(e){
      e.stopPropagation();
      if (confirm('Delete "' + subject.name + '" and all its notes?')) {
        data.subjects = data.subjects.filter(function(s){ return s.id !== subject.id; });
        if (expandedSubject === subject.id) expandedSubject = null;
        save(); render();
      }
    });
    delB.classList.add('notes-btn-danger');
    right.appendChild(delB);

    header.appendChild(left);
    header.appendChild(right);

    // Toggle expand/collapse on header click
    header.addEventListener('click', function(e){
      if (e.target.closest('button') || e.target.closest('.subject-grip')) return;
      // Use live check, not stale closure value
      expandedSubject = (expandedSubject === subject.id) ? null : subject.id;
      render();
    });

    // ── Notes list ────────────────────────────────────────────────
    var notesList = el('div','subject-notes-list');
    notesList.style.display = isOpen ? 'flex' : 'none';

    subject.notes.forEach(function(note){
      notesList.appendChild(buildNoteRow(note, subject.id));
    });

    if (!subject.notes.length) {
      var empty = el('div','notes-empty');
      empty.textContent = 'No notes yet — click "+ Note" to add one.';
      notesList.appendChild(empty);
    }

    // Drop target for note-to-subject drag
    notesList.addEventListener('dragover', function(e){
      if (!dragNotePayload) return;
      e.preventDefault(); notesList.classList.add('note-drop-over');
    });
    notesList.addEventListener('dragleave', function(){
      notesList.classList.remove('note-drop-over');
    });
    notesList.addEventListener('drop', function(e){
      notesList.classList.remove('note-drop-over');
      if (dragNotePayload && dragNotePayload.fromSubjectId !== subject.id) {
        e.preventDefault();
        moveNote(dragNotePayload.noteId, dragNotePayload.fromSubjectId, subject.id);
      }
    });

    // ── Subject drag-to-reorder ───────────────────────────────────
    // Only the grip handle triggers subject drag
    grip.addEventListener('mousedown', function(){
      card.draggable = true;
    });
    card.addEventListener('dragstart', function(e){
      if (!card.draggable) return;
      dragSubjectId   = subject.id;
      dragNotePayload = null;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'subject:' + subject.id);
      setTimeout(function(){ card.classList.add('subject-dragging'); }, 0);
    });
    card.addEventListener('dragend', function(){
      card.classList.remove('subject-dragging');
      card.draggable  = false;
      dragSubjectId   = null;
    });
    card.addEventListener('dragover', function(e){
      if (!dragSubjectId || dragSubjectId === subject.id) return;
      e.preventDefault();
      card.classList.add('subject-drag-over');
    });
    card.addEventListener('dragleave', function(){
      card.classList.remove('subject-drag-over');
    });
    card.addEventListener('drop', function(e){
      card.classList.remove('subject-drag-over');
      if (!dragSubjectId || dragSubjectId === subject.id) return;
      e.preventDefault();
      var fromIdx = data.subjects.findIndex(function(s){ return s.id === dragSubjectId; });
      var toIdx   = data.subjects.findIndex(function(s){ return s.id === subject.id; });
      if (fromIdx === -1 || toIdx === -1) return;
      var moved = data.subjects.splice(fromIdx, 1)[0];
      data.subjects.splice(toIdx, 0, moved);
      save(); render();
    });

    card.appendChild(header);
    card.appendChild(notesList);
    return card;
  }

  // ─── Move note ────────────────────────────────────────────────────────────────
  function moveNote(noteId, fromId, toId) {
    var from = data.subjects.find(function(s){ return s.id === fromId; });
    var to   = data.subjects.find(function(s){ return s.id === toId; });
    if (!from || !to) return;
    var idx = from.notes.findIndex(function(n){ return n.id === noteId; });
    if (idx === -1) return;
    var note = from.notes.splice(idx, 1)[0];
    to.notes.push(note);
    save(); render(); toast('Moved to "' + to.name + '"');
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  function render() {
    var list = document.getElementById('subjectList');
    if (!list) return;

    var term = ((document.getElementById('searchBar') || {}).value || '').toLowerCase().trim();
    list.innerHTML = '';

    var visible = term
      ? data.subjects.filter(function(s){
          return s.name.toLowerCase().includes(term) ||
            s.notes.some(function(n){ return n.content.toLowerCase().includes(term); });
        })
      : data.subjects;

    visible.forEach(function(s){ list.appendChild(buildSubjectCard(s)); });

    var expBtn = document.getElementById('exportbutton');
    if (expBtn) expBtn.style.display = data.subjects.length ? '' : 'none';
  }

  // ─── Show/Hide fullscreen ─────────────────────────────────────────────────────
  function showNotes() {
    document.querySelectorAll('.container').forEach(function(e){ e.style.display = 'none'; });
    var nc = document.querySelector('.new-container');
    if (nc) {
      nc.querySelectorAll('h2').forEach(function(h){ h.style.display = 'none'; });
      var sw = nc.querySelector('.stopwatch'); if (sw) sw.style.display = 'none';
    }
    var ns = document.querySelector('.new-container .notes-section');
    if (ns) ns.style.display = 'flex';
    var show = document.getElementById('showNotes'), hide = document.getElementById('hideNotes');
    if (show) show.style.display = 'none';
    if (hide) hide.style.display = 'inline-block';
    updateStorageMeter(); // refresh meter every time notes are opened
  }

  function hideNotes() {
    document.querySelectorAll('.container').forEach(function(e){ e.style.display = 'block'; });
    var nc = document.querySelector('.new-container');
    if (nc) {
      nc.querySelectorAll('h2').forEach(function(h){ h.style.display = ''; });
      var sw = nc.querySelector('.stopwatch'); if (sw) sw.style.display = '';
    }
    var ns = document.querySelector('.new-container .notes-section');
    if (ns) ns.style.display = 'none';
    var show = document.getElementById('showNotes'), hide = document.getElementById('hideNotes');
    if (show) show.style.display = 'inline-block';
    if (hide) hide.style.display = 'none';
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    load();

    var addBtn = document.getElementById('addSubjectBtn');
    if (addBtn) addBtn.addEventListener('click', function(){
      var name = prompt('Subject name:');
      if (name && name.trim()) {
        data.subjects.push({ id: uid(), name: name.trim(), notes: [] });
        save(); render();
      }
    });

    var sb = document.getElementById('searchBar');
    if (sb) sb.addEventListener('input', render);

    var expBtn = document.getElementById('exportbutton');
    if (expBtn) expBtn.addEventListener('click', exportJSON);

    // Inject Import button
    var expCont = document.getElementById('exportButtonContainer');
    if (expCont && !document.getElementById('importNotesBtn')) {
      var impBtn = document.createElement('button');
      impBtn.id = 'importNotesBtn'; impBtn.textContent = 'Import'; impBtn.className = 'notes-btn notes-btn-primary';
      impBtn.addEventListener('click', triggerImport);
      expCont.appendChild(impBtn);
    }

    // Build top toolbar: [search] [Add Subject] [Export] [Import] [Hide Notes]
    var ns = document.querySelector('.new-container .notes-section');
    if (ns && !document.querySelector('.notes-top-bar')) {
      var bar = document.createElement('div');
      bar.className = 'notes-top-bar';

      var els = [
        document.getElementById('searchBar'),
        document.getElementById('addSubjectBtn'),
        document.getElementById('exportButtonContainer'),
        document.getElementById('hideNotes')
      ];
      els.forEach(function(e) { if (e) bar.appendChild(e); });

      // Storage meter — sits at far right of toolbar
      var meter = document.createElement('div');
      meter.id = 'notes-storage-meter';
      meter.style.cssText = [
        'font-size:11px',
        'font-weight:600',
        'white-space:nowrap',
        'padding:3px 10px',
        'border-radius:10px',
        'border:1px solid rgba(255,255,255,0.12)',
        'margin-left:auto',
        'flex-shrink:0',
        'display:inline-block'
      ].join(';');
      bar.appendChild(meter);
      updateStorageMeter();

      ns.insertBefore(bar, ns.firstChild);
    }

    // Hidden by default
    if (ns) ns.style.display = 'none';
    var show = document.getElementById('showNotes'), hide = document.getElementById('hideNotes');
    if (show) { show.style.display = 'inline-block'; show.addEventListener('click', showNotes); }
    if (hide) { hide.style.display = 'none';         hide.addEventListener('click', hideNotes); }

    startSync();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
