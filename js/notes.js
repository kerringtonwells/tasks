/**
 * notes.js — Subjects/Notes manager with IndexedDB image storage
 * Features: expand/collapse, drag-reorder, cross-tab sync, image paste/copy
 */
(function () {
  'use strict';

  // ─── Constants & State ───────────────────────────────────────────────────────
  var LS_KEY  = 'notes_v2', TS_KEY = 'notes_v2_ts', LEGACY_KEY = 'subjects';
  var IDB_NAME = 'kwells_notes', IDB_STORE = 'images';

  var data              = { subjects: [] };
  var lastSavedTs       = 0;
  var expandedSubject   = null;
  var dragNotePayload   = null;
  var dragSubjectId     = null;
  var internalClipboard = { images: [] };
  var idb               = null;
  var FB_LISTEN_ACTIVE  = {}; // shareId → true while onValue listener is attached

  // ─── Tiny DOM helpers ────────────────────────────────────────────────────────
  function uid()       { return Math.random().toString(36).slice(2,9) + Date.now().toString(36); }
  function now()       { return Date.now(); }
  function el(tag,cls) { var e=document.createElement(tag); if(cls) e.className=cls; return e; }
  function esc(s)      { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function btn(lbl, fn, cls) {
    var b = el('button', cls || 'notes-btn');
    b.textContent = lbl; b.addEventListener('click', fn); return b;
  }
  function insertText(ta, text) {
    var s = ta.selectionStart, e = ta.selectionEnd;
    ta.value = ta.value.slice(0,s) + text + ta.value.slice(e);
    ta.selectionStart = ta.selectionEnd = s + text.length;
    ta.focus();
  }
  function getScroller() {
    return document.querySelector('.subject-card-expanded .subject-notes-list') || null;
  }

  // ─── IndexedDB ───────────────────────────────────────────────────────────────
  function openIDB() {
    if (idb) return Promise.resolve(idb);
    return new Promise(function(res,rej) {
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function(e) {
        if (!e.target.result.objectStoreNames.contains(IDB_STORE))
          e.target.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = function(e) { idb = e.target.result; res(idb); };
      req.onerror   = function(e) { rej(e.target.error); };
    });
  }

  function idbTx(mode, fn) {
    return openIDB().then(function(db) {
      return new Promise(function(res,rej) {
        var tx = db.transaction(IDB_STORE, mode);
        var req = fn(tx.objectStore(IDB_STORE));
        req.onsuccess = function() { res(req.result); };
        req.onerror   = function(e) { rej(e.target.error); };
      });
    });
  }

  function idbPut(id, url)  { return idbTx('readwrite', function(s){ return s.put(url,id); }); }
  function idbGet(id)       { return idbTx('readonly',  function(s){ return s.get(id); }); }

  function saveToIDB(dataUrl) {
    var id = 'img_' + uid();
    return idbPut(id, dataUrl).then(function(){ return 'idb:' + id; });
  }

  function resolveImages(refs) {
    return Promise.all(refs.map(function(src) {
      return src.indexOf('idb:') === 0
        ? idbGet(src.slice(4)).then(function(d){ return d || src; })
        : Promise.resolve(src);
    }));
  }

  function cleanupOrphanedImages() {
    return openIDB().then(function(db) {
      return new Promise(function(res) {
        var req = db.transaction(IDB_STORE,'readonly').objectStore(IDB_STORE).getAllKeys();
        req.onsuccess = function() {
          var used = {};
          data.subjects.forEach(function(s){
            s.notes.forEach(function(n){
              (n.images||[]).forEach(function(r){ if(r.indexOf('idb:')===0) used[r.slice(4)]=1; });
            });
          });
          var orphans = (req.result||[]).filter(function(k){ return !used[k]; });
          if (!orphans.length) { res(0); return; }
          var tx = db.transaction(IDB_STORE,'readwrite'), st = tx.objectStore(IDB_STORE);
          orphans.forEach(function(k){ st.delete(k); });
          tx.oncomplete = function(){ res(orphans.length); };
        };
        req.onerror = function(){ res(0); };
      });
    }).catch(function(){ return 0; });
  }

  // ─── Storage ─────────────────────────────────────────────────────────────────
  function lsBytes() {
    var t=0;
    for (var k in localStorage) if (localStorage.hasOwnProperty(k)) t+=(localStorage[k].length+k.length)*2;
    return t;
  }

  function formatBytes(b) {
    if (b>=1073741824) return (b/1073741824).toFixed(2)+' GB';
    if (b>=1048576)    return (b/1048576).toFixed(2)+' MB';
    if (b>=1024)       return (b/1024).toFixed(1)+' KB';
    return b+' B';
  }

  function updateStorageMeter() {
    var el = document.getElementById('notes-storage-meter');
    if (!el) return;
    var ls = lsBytes();
    openIDB().then(function(db) {
      return new Promise(function(res) {
        var req = db.transaction(IDB_STORE,'readonly').objectStore(IDB_STORE).getAll();
        req.onsuccess = function(){
          var idbB = (req.result||[]).reduce(function(t,v){ return t+(v?v.length*2:0); },0);
          var total = ls + idbB;
          var pct   = ls / 5242880;
          var color = pct>0.7 ? '#f87171' : pct>0.5 ? '#fbbf24' : '#4ade80';
          var bg    = pct>0.7 ? 'rgba(239,68,68,0.15)' : pct>0.5 ? 'rgba(251,191,36,0.15)' : 'rgba(74,222,128,0.12)';
          el.textContent  = '💾 ' + formatBytes(total);
          el.title        = 'Text: '+formatBytes(ls)+'  |  Images: '+formatBytes(idbB);
          el.style.color  = color;
          el.style.background   = bg;
          el.style.borderColor  = color.replace(')',',0.3)').replace('rgb','rgba');
        };
        req.onerror = function(){ res(0); };
      });
    }).catch(function(){});
  }

  function save() {
    var ts = now();
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
      localStorage.setItem(TS_KEY, String(ts));
      lastSavedTs = ts;
      if (lsBytes() > 3670016) toast('⚠ Text storage near limit — consider removing old images.');
      updateStorageMeter();
    } catch(e) {
      toast(e.name==='QuotaExceededError'
        ? '⚠ Storage full! Try removing some images.'
        : '⚠ Save failed: '+e.message);
    }
  }

  function parseSubjects(raw) {
    var p = JSON.parse(raw), subjects = Array.isArray(p) ? p : (p.subjects||[]);
    return { subjects: subjects.map(function(s){
      return { id: s.id||uid(), name: s.name||'Untitled', type: s.type||'notes', notes: (s.notes||[]).map(function(n){
        if (typeof n==='string') return {id:uid(),content:decodeURIComponent(n),images:[],checked:false,checkedAt:null,createdAt:now(),updatedAt:now()};
        return {id:n.id||uid(),content:n.content||'',images:Array.isArray(n.images)?n.images:[],checked:!!n.checked,checkedAt:n.checkedAt||null,createdAt:n.createdAt||now(),updatedAt:n.updatedAt||now()};
      })};
    })};
  }

  function load() {
    var raw = localStorage.getItem(LS_KEY) || localStorage.getItem(LEGACY_KEY);
    if (raw) { try { data = parseSubjects(raw); } catch(e) { console.error('Load error',e); } }
    lastSavedTs = parseInt(localStorage.getItem(TS_KEY)||'0',10);
    var promises=[], needsSave=false;
    data.subjects.forEach(function(s){ s.notes.forEach(function(n){
      (n.images||[]).forEach(function(src,i){
        if (src.indexOf('data:')===0) {
          promises.push(saveToIDB(src).then(function(ref){ n.images[i]=ref; needsSave=true; }));
        }
      });
    }); });
    if (promises.length) Promise.all(promises).then(function(){ if(needsSave){ save(); toast('Migrated images to expanded storage'); } });
    cleanupOrphanedImages().then(function(n){
      if (n>0) { toast('🧹 Freed '+n+' unused image(s)'); updateStorageMeter(); }
    });
  }

  // ─── Cross-tab sync ───────────────────────────────────────────────────────────
  function mergeIn(local, incoming) {
    var map={};
    local.forEach(function(x){ map[x.id]=x; });
    incoming.forEach(function(x){
      if (!map[x.id]) { map[x.id]=x; }
      else if (x.notes) {
        map[x.id].name = x.name;
        var nm={};
        (map[x.id].notes||[]).forEach(function(n){ nm[n.id]=n; });
        (x.notes||[]).forEach(function(n){ if(!nm[n.id]||n.updatedAt>nm[n.id].updatedAt) nm[n.id]=n; });
        map[x.id].notes = Object.values(nm);
      } else if (x.updatedAt > map[x.id].updatedAt) { map[x.id]=x; }
    });
    return Object.values(map);
  }

  function startSync() {
    window.addEventListener('storage', function(e){
      if (e.key===LS_KEY && e.newValue) {
        try { var inc=parseSubjects(e.newValue); data.subjects=mergeIn(data.subjects,inc.subjects); render(); toast('Synced'); } catch(e){}
      }
    });
    setInterval(function(){
      var ts=parseInt(localStorage.getItem(TS_KEY)||'0',10);
      if (ts>lastSavedTs) { var r=localStorage.getItem(LS_KEY); if(r){ try{var inc=parseSubjects(r); data.subjects=mergeIn(data.subjects,inc.subjects); render(); lastSavedTs=ts; }catch(e){} } }
    }, 15000);
  }

  // ─── Export / Import ─────────────────────────────────────────────────────────
  function exportJSON() {
    toast('Preparing export…');
    var clone = JSON.parse(JSON.stringify(data));
    var ps=[];
    clone.subjects.forEach(function(s){ s.notes.forEach(function(n){
      if (n.images&&n.images.length) ps.push(resolveImages(n.images).then(function(r){ n.images=r; }));
    }); });
    Promise.all(ps).then(function(){
      var a=document.createElement('a');
      a.href=URL.createObjectURL(new Blob([JSON.stringify(clone,null,2)],{type:'application/json'}));
      a.download='notes_'+new Date().toISOString().slice(0,10)+'.json';
      a.click(); toast('Export done!');
    });
  }

  function importJSON(file) {
    var r=new FileReader();
    r.onload=function(e){ try{ var inc=parseSubjects(e.target.result); data.subjects=mergeIn(data.subjects,inc.subjects); save(); render(); toast('Import complete'); }catch(e){ alert('Invalid file.'); } };
    r.readAsText(file);
  }

  // ─── Images ───────────────────────────────────────────────────────────────────
  function compressImage(file) {
    return new Promise(function(res,rej){
      var r=new FileReader();
      r.onerror=rej;
      r.onload=function(e){
        var img=new Image();
        img.onerror=rej;
        img.onload=function(){
          var MAX=1200, w=img.width, h=img.height;
          if (w>MAX){ h=Math.round(h*MAX/w); w=MAX; }
          var c=document.createElement('canvas'); c.width=w; c.height=h;
          c.getContext('2d').drawImage(img,0,0,w,h);
          res(c.toDataURL('image/jpeg',0.75));
        };
        img.src=e.target.result;
      };
      r.readAsDataURL(file);
    });
  }

  async function processFiles(files) {
    var out=[];
    for (var f of files) {
      if (!f||!f.type||!f.type.startsWith('image/')) continue;
      try { var d=await compressImage(f), ref=await saveToIDB(d); out.push({ref,dataUrl:d}); }
      catch(e) { toast('Could not load: '+(f.name||'image')); }
    }
    return out;
  }

  async function fromPasteEvent(e) {
    var files=Array.from((e.clipboardData||{}).items||[])
      .filter(function(i){ return i.type.startsWith('image/'); })
      .map(function(i){ e.preventDefault(); return i.getAsFile(); });
    return processFiles(files);
  }

  // ─── Toast ────────────────────────────────────────────────────────────────────
  function toast(msg) {
    var old=document.getElementById('notes-toast'); if(old) old.remove();
    var d=el('div','notes-toast'); d.id='notes-toast'; d.textContent=msg;
    document.body.appendChild(d);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ d.classList.add('visible'); }); });
    setTimeout(function(){ d.classList.remove('visible'); setTimeout(function(){ d.remove(); },400); },3000);
  }

  // ─── Lightbox ─────────────────────────────────────────────────────────────────
  function openLightbox(src) {
    var ov=el('div','lightbox-overlay'), img=el('img','lightbox-img'), x=el('button','lightbox-close');
    img.src=src; x.textContent='✕';
    x.addEventListener('click',function(){ ov.remove(); });
    ov.addEventListener('click',function(e){ if(e.target===ov) ov.remove(); });
    function onKey(e){ if(e.key==='Escape'){ ov.remove(); document.removeEventListener('keydown',onKey); } }
    document.addEventListener('keydown',onKey);
    ov.appendChild(x); ov.appendChild(img); document.body.appendChild(ov);
  }

  // ─── Firebase UI helpers ──────────────────────────────────────────────────────

  function getFS() { return window.FirebaseSync || null; }

  function ensureDisplayName(callback) {
    var fs = getFS(); if (!fs) return;
    var name = fs.getDisplayName();
    if (name) { callback(name); return; }
    openDisplayNameModal(callback);
  }

  function openDisplayNameModal(callback) {
    var ov = el('div','note-editor-overlay'), modal = el('div','note-editor-modal');
    var title = el('h3','editor-title'); title.textContent = '👋 What should we call you?';
    var sub = el('p'); sub.style.cssText = 'font-size:13px;opacity:0.6;margin:-4px 0 14px;';
    sub.textContent = 'Your name appears when you check items on shared lists.';
    var inp = el('input'); inp.type='text'; inp.className='editor-name-input';
    inp.placeholder = 'Your name or nickname…';
    inp.style.cssText = 'width:100%;padding:10px 12px;font-size:15px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.08);color:inherit;font-family:inherit;margin-bottom:14px;box-sizing:border-box;outline:none;';
    var row = el('div','editor-btn-row');
    var saveB = btn('Continue', function() {
      var name = inp.value.trim(); if (!name) { toast('Enter your name'); inp.focus(); return; }
      var fs = getFS(); if (fs) fs.setDisplayName(name); ov.remove(); callback(name);
    }, 'notes-btn notes-btn-primary');
    row.appendChild(saveB); row.appendChild(btn('Cancel', function(){ ov.remove(); }));
    modal.appendChild(title); modal.appendChild(sub); modal.appendChild(inp); modal.appendChild(row);
    ov.appendChild(modal);
    ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
    document.body.appendChild(ov); inp.focus();
    inp.addEventListener('keydown', function(e){ if(e.key==='Enter') saveB.click(); });
  }

  function openFirebaseSetupModal(onSuccess) {
    var ov = el('div','note-editor-overlay'), modal = el('div','note-editor-modal');
    modal.style.maxWidth = '540px';
    var title = el('h3','editor-title'); title.textContent = '🔥 Connect Firebase';

    var RULES = '{\n  "rules": {\n    "shared": {\n      "$shareId": {\n        ".read": true,\n        ".write": true\n      }\n    }\n  }\n}';

    var guide = el('div');
    guide.innerHTML = [
      '<p style="font-size:13px;font-weight:600;margin:0 0 10px;">First time? Complete these 3 steps:</p>',
      '<div style="font-size:12px;line-height:1.9;margin-bottom:14px;">',
        '<div style="margin-bottom:6px;"><span style="background:rgba(59,130,246,0.3);border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;margin-right:7px;">1</span>',
          '<strong>Create a Firebase project</strong> at <code style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:3px;">console.firebase.google.com</code></div>',
        '<div style="margin-bottom:6px;"><span style="background:rgba(59,130,246,0.3);border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;margin-right:7px;">2</span>',
          'Enable <strong>Realtime Database</strong> → open the <strong>Rules</strong> tab → paste and publish:</div>',
        '<div style="display:flex;gap:6px;align-items:flex-start;margin:0 0 8px 25px;">',
          '<pre id="rulesBox" style="flex:1;font-size:11px;background:rgba(0,0,0,0.3);padding:8px 10px;border-radius:6px;margin:0;overflow-x:auto;color:#94a3b8;">' + RULES + '</pre>',
          '<button id="copyRulesBtn" style="flex-shrink:0;padding:5px 10px;font-size:11px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:inherit;cursor:pointer;font-family:inherit;">Copy</button>',
        '</div>',
        '<div><span style="background:rgba(59,130,246,0.3);border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;margin-right:7px;">3</span>',
          'In <strong>Project Settings → Add App → Web</strong>, copy the config block and paste it below:</div>',
      '</div>'
    ].join('');

    var ta = el('textarea','editor-textarea');
    ta.placeholder = 'Paste your firebaseConfig here…\n\nconst firebaseConfig = {\n  apiKey: "...",\n  databaseURL: "...",\n  ...\n};';
    ta.style.minHeight = '130px'; ta.style.fontFamily = 'monospace'; ta.style.fontSize = '12px';

    var errEl = el('div'); errEl.style.cssText = 'color:#f87171;font-size:12px;margin-bottom:8px;display:none;padding:8px 10px;background:rgba(239,68,68,0.1);border-radius:6px;';
    var btnRow = el('div','editor-btn-row');
    var saveB = btn('Connect', function() {
      var fs = getFS();
      if (!fs) { errEl.textContent='Firebase module not loaded. Check that firebase-sync.js is in your js/ folder.'; errEl.style.display=''; return; }
      saveB.textContent = 'Connecting…'; saveB.disabled = true;
      fs.setup(ta.value).then(function(result) {
        saveB.textContent = 'Connect'; saveB.disabled = false;
        if (result.ok) {
          ov.remove(); toast('✓ Firebase connected!');
          var fbBtn = document.getElementById('firebaseConnectBtn');
          if (fbBtn) { fbBtn.textContent = '🔥 Connected'; fbBtn.classList.add('firebase-connected'); }
          if (onSuccess) onSuccess();
        } else {
          errEl.textContent = result.error; errEl.style.display = '';
        }
      });
    }, 'notes-btn notes-btn-primary');
    btnRow.appendChild(saveB); btnRow.appendChild(btn('Cancel', function(){ ov.remove(); }));

    modal.appendChild(title); modal.appendChild(guide); modal.appendChild(ta); modal.appendChild(errEl); modal.appendChild(btnRow);
    ov.appendChild(modal);
    ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
    document.body.appendChild(ov); ta.focus();

    // Wire up copy rules button
    var copyRulesBtn = document.getElementById('copyRulesBtn');
    if (copyRulesBtn) {
      copyRulesBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(RULES).then(function() {
          copyRulesBtn.textContent = '✓ Copied!'; copyRulesBtn.style.color = '#4ade80';
          setTimeout(function(){ copyRulesBtn.textContent = 'Copy'; copyRulesBtn.style.color = ''; }, 2000);
        });
      });
    }
  }

  function showFirebaseOptionsModal() {
    var fs = getFS();
    var ov = el('div','note-editor-overlay'), modal = el('div','note-editor-modal');
    var title = el('h3','editor-title'); title.textContent = '🔥 Firebase Settings';
    var curName = fs.getDisplayName() || 'Not set';
    var nameInfo = el('p'); nameInfo.style.cssText = 'font-size:13px;opacity:0.7;margin:0 0 10px;';
    nameInfo.textContent = 'Your display name: ' + curName;
    var btnRow = el('div','editor-btn-row');
    btnRow.appendChild(btn('Change Name', function(){
      ov.remove(); openDisplayNameModal(function(n){ toast('Name updated to: ' + n); });
    }, 'notes-btn'));
    btnRow.appendChild(btn('Disconnect', function(){
      if (!confirm('Disconnect Firebase? Shared subjects will stop syncing.')) return;
      fs.clearConfig(); ov.remove();
      var fbBtn = document.getElementById('firebaseConnectBtn');
      if (fbBtn) { fbBtn.textContent = '🔥 Connect'; fbBtn.classList.remove('firebase-connected'); }
      toast('Firebase disconnected');
    }, 'notes-btn notes-btn-danger'));
    btnRow.appendChild(btn('Close', function(){ ov.remove(); }));
    modal.appendChild(title); modal.appendChild(nameInfo); modal.appendChild(btnRow);
    ov.appendChild(modal);
    ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
    document.body.appendChild(ov);
  }

  function shareSubject(subject) {
    var fs = getFS();
    if (!fs || !fs.isReady) { openFirebaseSetupModal(function(){ shareSubject(subject); }); return; }
    ensureDisplayName(function(){ doShareSubject(subject); });
  }

  function doShareSubject(subject) {
    var fs = getFS(); toast('Sharing…');
    fs.pushSubject(subject).then(function(shareId) {
      if (!shareId) { toast('Share failed — check your Firebase connection'); return; }
      subject.shareId = shareId; save(); render();
      showShareModal(subject, shareId);
      attachShareListener(subject);
    }).catch(function(e){ toast('Share failed: ' + e.message); });
  }

  function showShareModal(subject, shareId) {
    var fs = getFS();
    var url = fs.getShareUrl(shareId);
    var ov = el('div','note-editor-overlay'), modal = el('div','note-editor-modal');
    modal.style.maxWidth = '480px';
    var title = el('h3','editor-title');
    title.textContent = '🔗 Sharing: "' + subject.name + '"';
    var urlBox = el('div','share-url-box');
    urlBox.textContent = url;
    var hint = el('p','share-hint');
    hint.textContent = 'Anyone with this link can view and edit this ' + (subject.type==='checklist'?'checklist':'note') + ' in real time. Changes sync instantly.';
    var btnRow = el('div','editor-btn-row');
    var copyB = btn('📋 Copy Link', function(){
      navigator.clipboard.writeText(url).then(function(){
        copyB.textContent = '✓ Copied!'; copyB.style.color = '#4ade80';
        setTimeout(function(){ copyB.textContent = '📋 Copy Link'; copyB.style.color = ''; }, 2000);
      });
    }, 'notes-btn notes-btn-primary');
    urlBox.addEventListener('click', function(){ copyB.click(); });
    urlBox.title = 'Click to copy';
    btnRow.appendChild(copyB);
    btnRow.appendChild(btn('Stop Sharing', function(){
      if (!confirm('Remove from cloud and stop sharing "' + subject.name + '"?')) return;
      fs.deleteShared(shareId).then(function(){
        subject.shareId = null; save(); render(); ov.remove();
        delete FB_LISTEN_ACTIVE[shareId]; toast('Sharing stopped');
      });
    }, 'notes-btn notes-btn-danger'));
    btnRow.appendChild(btn('Close', function(){ ov.remove(); }));
    modal.appendChild(title); modal.appendChild(urlBox); modal.appendChild(hint); modal.appendChild(btnRow);
    ov.appendChild(modal);
    ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
    document.body.appendChild(ov);
  }

  function openSharedView(shareId) {
    var fs = getFS();
    if (!fs || !fs.isReady) { openFirebaseSetupModal(function(){ openSharedView(shareId); }); return; }
    // Check if already imported
    var already = data.subjects.find(function(s){ return s.shareId === shareId; });
    if (already) {
      expandedSubject = already.id; render();
      history.replaceState(null,'',window.location.pathname); // clean URL
      toast('✓ Showing: ' + already.name); return;
    }
    toast('Loading shared content…');
    fs.getShared(shareId).then(function(fbData) {
      if (!fbData || !fbData.meta) { toast('Shared content not found or has been removed.'); return; }
      var subject = {
        id:       'shared_' + shareId,
        name:     fbData.meta.name,
        type:     fbData.meta.type || 'notes',
        shareId:  shareId,
        notes:    Object.entries(fbData.items || {}).map(function(pair){
          var id = pair[0], it = pair[1];
          return { id:id, content:it.content||'', images:[], checked:it.checked||false,
            checkedBy:it.checkedBy||null, checkedAt:it.checkedAt||null,
            createdAt:it.createdAt||Date.now(), updatedAt:it.updatedAt||Date.now() };
        })
      };
      showImportSharedModal(subject, shareId);
    });
  }

  function showImportSharedModal(subject, shareId) {
    var ov = el('div','note-editor-overlay'), modal = el('div','note-editor-modal');
    var title = el('h3','editor-title'); title.textContent = '📥 Shared: ' + subject.name;
    var info = el('p'); info.style.cssText = 'font-size:13px;opacity:0.7;margin:0 0 16px;';
    info.textContent = 'Someone shared this ' + subject.type + ' with you. Add it to collaborate in real time — your changes will sync to everyone.';
    var btnRow = el('div','editor-btn-row');
    var addB = btn('Add to my app', function(){
      data.subjects.unshift(subject);
      expandedSubject = subject.id;
      save(); render(); ov.remove();
      history.replaceState(null,'',window.location.pathname);
      toast('✓ Added: ' + subject.name);
      attachShareListener(subject);
    }, 'notes-btn notes-btn-primary');
    btnRow.appendChild(addB);
    btnRow.appendChild(btn('Dismiss', function(){ ov.remove(); history.replaceState(null,'',window.location.pathname); }));
    modal.appendChild(title); modal.appendChild(info); modal.appendChild(btnRow);
    ov.appendChild(modal);
    ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
    document.body.appendChild(ov);
  }

  function attachShareListener(subject) {
    var fs = getFS();
    console.log('[Notes] attachShareListener()', subject.shareId, '| fs.isReady:', fs && fs.isReady, '| already active:', !!FB_LISTEN_ACTIVE[subject.shareId]);
    if (!fs || !fs.isReady || !subject.shareId) {
      console.warn('[Notes] attachShareListener() bailed — fs:', !!fs, 'isReady:', fs && fs.isReady, 'shareId:', subject.shareId);
      return;
    }
    if (FB_LISTEN_ACTIVE[subject.shareId]) {
      console.log('[Notes] attachShareListener() — already active, skipping');
      return;
    }
    FB_LISTEN_ACTIVE[subject.shareId] = true;
    fs.listen(subject.shareId, function(fbData) {
      console.log('[Notes] Firebase callback fired for', subject.shareId, '| items:', fbData && fbData.items ? Object.keys(fbData.items).length : 0);
      if (!fbData || !fbData.items) return;
      var local = data.subjects.find(function(s){ return s.shareId === subject.shareId; });
      if (!local) { console.warn('[Notes] No local subject found for shareId', subject.shareId); return; }
      var localMap = {};
      local.notes.forEach(function(n){ localMap[n.id] = n; });
      local.notes = Object.entries(fbData.items).map(function(pair){
        var id = pair[0], it = pair[1];
        var loc = localMap[id];
        return {
          id:        id,
          content:   it.content   || (loc ? loc.content   : ''),
          images:    loc          ? (loc.images       || []) : [],
          checked:   it.checked   || false,
          checkedBy: it.checkedBy || null,
          checkedAt: it.checkedAt || null,
          createdAt: it.createdAt || Date.now(),
          updatedAt: it.updatedAt || Date.now()
        };
      });
      if (fbData.meta && fbData.meta.name) local.name = fbData.meta.name;
      save();
      console.log('[Notes] render() triggered by Firebase update for', subject.shareId);
      render();
    });
  }

  // ─── Editor Modal ─────────────────────────────────────────────────────────────
  function openEditor(subjectId, noteId, insertAtIndex, scrollToBottom) {
    var subject = data.subjects.find(function(s){ return s.id===subjectId; });
    if (!subject) return;
    var existing = noteId ? subject.notes.find(function(n){ return n.id===noteId; }) : null;

    var imgs=[], displayImgs=[];

    function addImages(found) {
      found.forEach(function(r){ imgs.push(r.ref); displayImgs.push(r.dataUrl); });
      refreshStrip();
    }

    var ov=el('div','note-editor-overlay'), modal=el('div','note-editor-modal');
    var title=el('h3','editor-title');
    var lbl = existing ? 'Edit — '+subject.name : ((insertAtIndex!==undefined?'Insert':'New')+' note in "'+subject.name+'"');
    title.textContent=lbl;

    var ta=el('textarea','editor-textarea');
    ta.value=existing?existing.content:'';
    ta.placeholder='Write your note… paste images with Ctrl+V';
    ta.spellcheck=true;

    var strip=el('div','editor-img-strip');
    function refreshStrip() {
      strip.innerHTML='';
      displayImgs.forEach(function(src,i){
        var wrap=el('div','editor-img-thumb-wrap'), img=el('img','editor-img-thumb'), rm=el('button','img-rm-btn');
        img.src=src; rm.textContent='×';
        rm.onclick=function(){ imgs.splice(i,1); displayImgs.splice(i,1); refreshStrip(); };
        wrap.appendChild(img); wrap.appendChild(rm); strip.appendChild(wrap);
      });
    }

    if (existing&&existing.images&&existing.images.length) {
      imgs=existing.images.slice();
      resolveImages(imgs).then(function(r){ displayImgs=r; refreshStrip(); });
    }
    refreshStrip();

    var blockPaste=false;
    ta.addEventListener('paste',function(e){
      if (blockPaste){ e.preventDefault(); blockPaste=false; return; }
      fromPasteEvent(e).then(function(found){ if(found.length) addImages(found); });
    });

    function handleDrop(e){
      e.preventDefault(); e.stopPropagation();
      ta.classList.remove('img-drag-over');
      processFiles(Array.from(e.dataTransfer.files)).then(function(found){ if(found.length) addImages(found); });
    }
    ta.addEventListener('dragover', function(e){ e.preventDefault(); ta.classList.add('img-drag-over'); });
    ta.addEventListener('dragleave',function(){ ta.classList.remove('img-drag-over'); });
    ta.addEventListener('drop', handleDrop);
    strip.addEventListener('dragover', function(e){ e.preventDefault(); });
    strip.addEventListener('drop', handleDrop);

    var addImgB = btn('📎 Add Image', function(){
      var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.multiple=true;
      inp.onchange=function(e){ processFiles(Array.from(e.target.files)).then(function(found){ if(found.length) addImages(found); }); };
      inp.click();
    }, 'notes-btn');

    var pasteB = btn('📋 Paste', function(e){
      e.preventDefault(); e.stopPropagation();
      if (internalClipboard.images.length) {
        var clip=internalClipboard.images.slice(); internalClipboard.images=[];
        resolveImages(clip).then(function(resolved){
          Promise.all(resolved.map(function(d){ return d?saveToIDB(d):Promise.resolve(null); })).then(function(refs){
            addImages(refs.filter(Boolean).map(function(ref,i){ return {ref:ref,dataUrl:resolved[i]}; }));
            toast('✓ Image(s) pasted');
          });
        });
        blockPaste=true;
        setTimeout(function(){ ta.focus(); setTimeout(function(){ blockPaste=false; },300); },0);
        return;
      }
      if (navigator.clipboard&&navigator.clipboard.read) {
        navigator.clipboard.read().then(function(items){
          var imgItem=null;
          items.forEach(function(item){
            item.types.forEach(function(t){ if(t.startsWith('image/')&&!imgItem) imgItem={item,t}; });
          });
          if (imgItem) {
            imgItem.item.getType(imgItem.t).then(function(blob){
              processFiles([blob]).then(function(found){ if(found.length) addImages(found); });
            });
          } else {
            navigator.clipboard.readText().then(function(text){ if(text) insertText(ta,text); }).catch(function(){});
          }
        }).catch(function(){
          navigator.clipboard.readText&&navigator.clipboard.readText().then(function(text){ if(text) insertText(ta,text); }).catch(function(){});
        });
      } else if (navigator.clipboard&&navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function(text){ if(text) insertText(ta,text); }).catch(function(){ ta.focus(); toast('Use Ctrl+V / Cmd+V'); });
      } else { ta.focus(); toast('Use Ctrl+V / Cmd+V'); }
    }, 'notes-btn');

    function updatePasteLabel() {
      var hasInternal = internalClipboard.images.length > 0;
      if (hasInternal) { pasteB.textContent='🖼 Paste Image'; pasteB.classList.add('notes-btn-primary'); return; }
      if (navigator.clipboard&&navigator.clipboard.read) {
        navigator.clipboard.read().then(function(items){
          var hasImg=items.some(function(i){ return i.types.some(function(t){ return t.startsWith('image/'); }); });
          pasteB.textContent = hasImg ? '🖼 Paste Image' : '📋 Paste Text';
          hasImg ? pasteB.classList.add('notes-btn-primary') : pasteB.classList.remove('notes-btn-primary');
        }).catch(function(){ pasteB.textContent='📋 Paste'; });
      }
    }
    updatePasteLabel();

    var row=el('div','editor-btn-row');
    var saveB=btn('Save', function(){
      var content=ta.value.trim();
      if (!content&&!imgs.length){ toast('Note is empty'); return; }
      var newId=uid();
      if (existing){ existing.content=content; existing.images=imgs; existing.updatedAt=now(); newId=existing.id; }
      else if (insertAtIndex!==undefined){ subject.notes.splice(insertAtIndex,0,{id:newId,content,images:imgs,createdAt:now(),updatedAt:now()}); }
      else { subject.notes.push({id:newId,content,images:imgs,createdAt:now(),updatedAt:now()}); }
      save(); render(); ov.remove();
      if (scrollToBottom) {
        requestAnimationFrame(function(){ requestAnimationFrame(function(){
          var inner = document.querySelector('.subject-card-expanded .subject-notes-list');
          if (inner) inner.scrollTop = inner.scrollHeight;
          document.documentElement.scrollTop = document.documentElement.scrollHeight;
        }); });
      }
    }, 'notes-btn notes-btn-primary');

    row.appendChild(addImgB); row.appendChild(pasteB);
    row.appendChild(saveB); row.appendChild(btn('Cancel',function(){ ov.remove(); }));

    modal.appendChild(title); modal.appendChild(ta); modal.appendChild(strip); modal.appendChild(row);
    ov.appendChild(modal);
    ov.addEventListener('click',function(e){ if(e.target===ov) ov.remove(); });
    document.body.appendChild(ov);
    ta.focus();
  }

  // ─── Note Row ─────────────────────────────────────────────────────────────────
  function buildNoteRow(note, subjectId) {
    var subject = data.subjects.find(function(s){ return s.id===subjectId; });
    var row=el('div','note-row'); row.dataset.id=note.id; row.draggable=true;

    var content=el('div','note-row-content');
    if (note.images&&note.images.length) {
      var wrap=el('div','note-row-images');
      note.images.forEach(function(src){
        var img=el('img','note-row-img');
        img.style.minWidth='60px'; img.style.minHeight='40px';
        img.loading  = 'lazy';    // don't load until scrolled into view
        img.decoding = 'async';   // decode off main thread — prevents long tasks
        if (src.indexOf('idb:')===0) {
          idbGet(src.slice(4)).then(function(d){ if(d){ img.src=d; img.addEventListener('click',function(e){ e.stopPropagation(); openLightbox(d); }); } });
        } else { img.src=src; img.addEventListener('click',function(e){ e.stopPropagation(); openLightbox(src); }); }
        wrap.appendChild(img);
      });
      content.appendChild(wrap);
    }
    var txt=el('div','note-row-text'); txt.innerHTML=esc(note.content).replace(/\n/g,'<br>');
    content.appendChild(txt);

    // Last modified timestamp
    var modEl = el('div', 'note-last-modified');
    var modDate = note.updatedAt ? new Date(note.updatedAt).toLocaleString() : '';
    modEl.textContent = modDate ? 'Modified: ' + modDate : '';
    content.appendChild(modEl);

    var actions=el('div','note-row-actions');

    function addEditBtn(lbl, fn){ actions.appendChild(btn(lbl,function(e){ e.stopPropagation(); fn(); })); }

    addEditBtn('Add Above', function(){
      openEditor(subjectId, null, subject.notes.findIndex(function(n){ return n.id===note.id; }));
    });
    addEditBtn('Add Below', function(){
      var idx = subject.notes.findIndex(function(n){ return n.id===note.id; });
      var isLast = idx === subject.notes.length - 1;
      openEditor(subjectId, null, idx+1, isLast);
    });
    addEditBtn('Edit', function(){ openEditor(subjectId, note.id); });

    var delB=btn('Delete',function(e){
      e.stopPropagation();
      delB.textContent = 'Sure?';
      delB.style.pointerEvents = 'none';
      var yesB = btn('Yes', function(e2){
        e2.stopPropagation();
        var idx = subject.notes.findIndex(function(n){ return n.id===note.id; });
        var wasLast = idx === subject.notes.length - 1;
        subject.notes = subject.notes.filter(function(n){ return n.id!==note.id; });
        save(); cleanupOrphanedImages().then(function(n){ if(n>0) updateStorageMeter(); });
        render();
        if (wasLast && subject.notes.length > 0) {
          requestAnimationFrame(function(){ requestAnimationFrame(function(){
            var inner = document.querySelector('.subject-card-expanded .subject-notes-list');
            if (inner) inner.scrollTop = inner.scrollHeight;
            document.documentElement.scrollTop = document.documentElement.scrollHeight;
          }); });
        }
      }, 'notes-btn notes-btn-danger');
      var noB = btn('No', function(e2){
        e2.stopPropagation();
        delB.textContent = 'Delete';
        delB.style.pointerEvents = '';
        actions.removeChild(yesB);
        actions.removeChild(noB);
      }, 'notes-btn');
      actions.insertBefore(noB, delB.nextSibling);
      actions.insertBefore(yesB, noB);
    }); delB.classList.add('notes-btn-danger'); actions.appendChild(delB);

    var copyB=btn('Copy',function(e){
      e.stopPropagation();
      var orig=copyB.textContent; copyB.textContent='✓ Copied!'; copyB.style.color='#4ade80';
      setTimeout(function(){ copyB.textContent=orig; copyB.style.color=''; },2000);
      var t=document.createElement('textarea'); t.value=note.content;
      document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t);
      var refs=note.images?note.images.slice():[];
      if (!refs.length) return;
      resolveImages(refs).then(function(resolved){
        internalClipboard.images=resolved;
        if (navigator.clipboard&&window.ClipboardItem) {
          var d=resolved[0], parts=d.split(','), bytes=atob(parts[1]), arr=new Uint8Array(bytes.length);
          for (var i=0;i<bytes.length;i++) arr[i]=bytes.charCodeAt(i);
          navigator.clipboard.write([new ClipboardItem({'image/png':new Blob([arr],{type:'image/png'})})])
            .then(function(){ toast('✓ Image in system clipboard — paste anywhere'); })
            .catch(function(){ toast('Copied! ('+refs.length+' image(s) — use 📋 Paste in editor)'); });
        } else { toast('Copied! ('+refs.length+' image(s) — use 📋 Paste in editor)'); }
      });
    }); actions.appendChild(copyB);

    row.appendChild(content); row.appendChild(actions);

    row.addEventListener('dragstart',function(e){
      dragNotePayload={noteId:note.id,fromSubjectId:subjectId}; dragSubjectId=null;
      e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain','note:'+note.id);
      e.stopPropagation(); setTimeout(function(){ row.classList.add('dragging'); },0);
    });
    row.addEventListener('dragend',function(){ row.classList.remove('dragging'); dragNotePayload=null; });
    return row;
  }

  // ─── Checklist Item ───────────────────────────────────────────────────────────
  function buildChecklistItem(item, subject) {
    var row = el('div', 'checklist-item' + (item.checked ? ' checklist-item-checked' : ''));
    row.dataset.id = item.id;

    var checkbox = el('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'checklist-checkbox';
    checkbox.checked = !!item.checked;
    checkbox.addEventListener('change', function() {
      var fs = getFS();
      item.checked   = checkbox.checked;
      item.checkedAt = Date.now();
      item.checkedBy = fs ? (fs.getDisplayName() || 'Unknown') : null;
      item.updatedAt = Date.now();
      row.classList.toggle('checklist-item-checked', item.checked);
      labelEl.classList.toggle('checklist-label-checked', item.checked);
      stampEl.textContent = fmtStamp(item);
      save();
      // Sync to Firebase if this subject is shared
      console.log('[Notes] checkbox changed — shareId:', subject.shareId, '| fs.isReady:', fs && fs.isReady, '| checked:', item.checked);
      if (fs && fs.isReady && subject.shareId) {
        fs.updateItem(subject.shareId, item.id, {
          checked:   item.checked,
          checkedBy: item.checkedBy,
          checkedAt: item.checkedAt
        }).catch(function(e){ console.error('[Notes] Firebase sync error:', e); });
      } else {
        console.warn('[Notes] NOT syncing to Firebase — fs:', !!fs, 'isReady:', fs && fs.isReady, 'shareId:', subject.shareId);
      }
    });

    var labelEl = el('span', 'checklist-label' + (item.checked ? ' checklist-label-checked' : ''));
    labelEl.textContent = item.content;

    function fmtStamp(it) {
      if (it.checkedAt) {
        var who = it.checkedBy ? ' by ' + it.checkedBy : '';
        return (it.checked ? 'Checked' : 'Unchecked') + who + ' · ' + new Date(it.checkedAt).toLocaleString();
      }
      return 'Added · ' + new Date(it.createdAt).toLocaleString();
    }
    var stampEl = el('span', 'checklist-stamp');
    stampEl.textContent = fmtStamp(item);

    var actions = el('div', 'checklist-actions');
    actions.appendChild(btn('Edit', function(e) {
      e.stopPropagation();
      openChecklistItemEditor(subject.id, item.id);
    }));
    var delB = btn('Delete', function(e) {
      e.stopPropagation();
      delB.textContent = 'Sure?';
      delB.style.pointerEvents = 'none';
      var yesB = btn('Yes', function(e2) {
        e2.stopPropagation();
        var fs = getFS();
        if (fs && fs.isReady && subject.shareId) {
          fs.removeItem(subject.shareId, item.id).catch(function(){});
        }
        subject.notes = subject.notes.filter(function(n) { return n.id !== item.id; });
        save(); render();
      }, 'notes-btn notes-btn-danger');
      var noB = btn('No', function(e2) {
        e2.stopPropagation();
        delB.textContent = 'Delete'; delB.style.pointerEvents = '';
        actions.removeChild(yesB); actions.removeChild(noB);
      }, 'notes-btn');
      actions.insertBefore(noB, delB.nextSibling);
      actions.insertBefore(yesB, noB);
    }); delB.classList.add('notes-btn-danger'); actions.appendChild(delB);

    var left = el('div', 'checklist-left');
    left.appendChild(checkbox); left.appendChild(labelEl); left.appendChild(stampEl);
    row.appendChild(left); row.appendChild(actions);
    return row;
  }

  function openChecklistItemEditor(subjectId, itemId) {
    var subject = data.subjects.find(function(s) { return s.id === subjectId; });
    if (!subject) return;
    var existing = itemId ? subject.notes.find(function(n) { return n.id === itemId; }) : null;

    var ov = el('div', 'note-editor-overlay'), modal = el('div', 'note-editor-modal');
    var title = el('h3', 'editor-title');
    title.textContent = existing ? 'Edit item — ' + subject.name : 'Add to "' + subject.name + '"';

    var ta = el('textarea', 'editor-textarea');
    ta.value = existing ? existing.content : '';
    ta.placeholder = 'Item text…';
    ta.style.minHeight = '80px';

    var btnRow = el('div', 'editor-btn-row');
    var saveB = btn('Save', function() {
      var content = ta.value.trim();
      if (!content) { toast('Item is empty'); return; }
      var fs = getFS();
      if (existing) {
        existing.content = content; existing.updatedAt = now();
        if (fs && fs.isReady && subject.shareId) {
          fs.updateItem(subject.shareId, existing.id, { content: existing.content, updatedAt: existing.updatedAt }).catch(function(){});
        }
      } else {
        var newItem = { id: uid(), content: content, images: [], checked: false, checkedBy: null, checkedAt: null, createdAt: now(), updatedAt: now() };
        subject.notes.push(newItem);
        if (fs && fs.isReady && subject.shareId) {
          fs.addItem(subject.shareId, newItem).catch(function(){});
        }
      }
      save(); render(); ov.remove();
    }, 'notes-btn notes-btn-primary');
    btnRow.appendChild(saveB);
    btnRow.appendChild(btn('Cancel', function() { ov.remove(); }));

    modal.appendChild(title); modal.appendChild(ta); modal.appendChild(btnRow);
    ov.appendChild(modal);
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
    ta.focus();
    ta.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveB.click(); } });
  }

  // ─── New Subject Modal (notes or checklist) ───────────────────────────────────
  function openNewSubjectModal() {
    var ov = el('div', 'note-editor-overlay'), modal = el('div', 'note-editor-modal');
    var title = el('h3', 'editor-title'); title.textContent = 'New subject';

    var nameInput = el('input'); nameInput.className = 'editor-name-input';
    nameInput.placeholder = 'Subject name…'; nameInput.type = 'text';
    nameInput.style.cssText = 'width:100%;padding:10px 12px;font-size:15px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.08);color:inherit;font-family:inherit;margin-bottom:12px;box-sizing:border-box;outline:none;';

    var typeRow = el('div', 'editor-type-row');
    var typeLabel = el('span'); typeLabel.textContent = 'Type:';
    typeLabel.style.cssText = 'font-size:13px;opacity:0.7;margin-right:10px;';

    function mkTypeBtn(lbl, val, icon) {
      var b = el('button', 'type-select-btn');
      b.dataset.val = val;
      b.innerHTML = icon + ' ' + lbl;
      b.addEventListener('click', function() {
        typeRow.querySelectorAll('.type-select-btn').forEach(function(x) { x.classList.remove('type-select-active'); });
        b.classList.add('type-select-active');
      });
      return b;
    }
    var btnNotes     = mkTypeBtn('Notes', 'notes', '📝');
    var btnChecklist = mkTypeBtn('Checklist', 'checklist', '✅');
    btnNotes.classList.add('type-select-active');
    typeRow.appendChild(typeLabel); typeRow.appendChild(btnNotes); typeRow.appendChild(btnChecklist);
    typeRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:16px;';

    var btnRow = el('div', 'editor-btn-row');
    var createB = btn('Create', function() {
      var name = nameInput.value.trim();
      if (!name) { toast('Enter a name'); nameInput.focus(); return; }
      var active = typeRow.querySelector('.type-select-active');
      var type = active ? active.dataset.val : 'notes';
      data.subjects.push({ id: uid(), name: name, type: type, notes: [] });
      save(); render(); ov.remove();
    }, 'notes-btn notes-btn-primary');
    btnRow.appendChild(createB);
    btnRow.appendChild(btn('Cancel', function() { ov.remove(); }));

    modal.appendChild(title); modal.appendChild(nameInput); modal.appendChild(typeRow); modal.appendChild(btnRow);
    ov.appendChild(modal);
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
    nameInput.focus();
    nameInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') createB.click(); });
  }

  // ─── Subject Card ─────────────────────────────────────────────────────────────
  function buildSubjectCard(subject) {
    var isOpen = expandedSubject===subject.id;
    var card=el('div',isOpen?'subject-card subject-card-expanded':'subject-card'); card.dataset.id=subject.id;

    var header=el('div','subject-card-header');
    var grip=el('span','subject-grip'); grip.textContent='⠿';
    var chev=el('span','subject-chevron'); chev.textContent='▶';
    var nameEl=el('span','subject-name'); nameEl.textContent=subject.name;
    nameEl.style.fontWeight='700'; nameEl.style.flex='1';
    var isChecklist = subject.type === 'checklist';
    var count=el('span','subject-count');
    var totalItems = subject.notes.length;
    var checkedItems = isChecklist ? subject.notes.filter(function(n){ return n.checked; }).length : 0;
    if (isChecklist) {
      count.textContent = checkedItems + '/' + totalItems + ' done';
    } else {
      count.textContent = totalItems + ' note' + (totalItems !== 1 ? 's' : '');
    }
    if (totalItems === 0) count.classList.add('subject-count-empty');

    // Type badge
    var typeBadge = el('span', 'subject-type-badge subject-type-' + (isChecklist ? 'checklist' : 'notes'));
    typeBadge.textContent = isChecklist ? '✅' : '📝';
    typeBadge.title = isChecklist ? 'Checklist' : 'Notes';

    // Live badge (shown when subject is shared)
    var liveBadge = subject.shareId ? el('span', 'subject-live-badge') : null;
    if (liveBadge) { liveBadge.textContent = '● LIVE'; liveBadge.title = 'Shared — syncing in real time'; }

    var left=el('div','subject-header-left');
    [grip,chev,typeBadge,nameEl,count].forEach(function(x){ left.appendChild(x); });
    if (liveBadge) left.appendChild(liveBadge);

    var right=el('div','subject-header-right');
    right.appendChild(btn('＋',function(e){
      e.stopPropagation();
      if (isChecklist) openChecklistItemEditor(subject.id, null);
      else openEditor(subject.id);
    }));
    // Share button — icon only to save space
    var shareB = btn('🔗', function(e){
      e.stopPropagation();
      if (subject.shareId) showShareModal(subject, subject.shareId);
      else shareSubject(subject);
    }, 'notes-btn' + (subject.shareId ? ' notes-btn-live' : ''));
    shareB.title = subject.shareId ? 'Sharing — click to manage' : 'Share this ' + (isChecklist ? 'checklist' : 'note');
    right.appendChild(shareB);
    right.appendChild(btn('✎',function(e){
      e.stopPropagation();
      var n=prompt('New name:',subject.name);
      if (n&&n.trim()){ subject.name=n.trim(); save(); render(); }
    }));
    var del=btn('✕',function(e){
      e.stopPropagation();
      if (!confirm('Delete "'+subject.name+'" and all its notes?')) return;
      data.subjects=data.subjects.filter(function(s){ return s.id!==subject.id; });
      if (expandedSubject===subject.id) expandedSubject=null;
      save(); cleanupOrphanedImages().then(function(n){ if(n>0) updateStorageMeter(); });
      render();
    }); del.classList.add('notes-btn-danger'); right.appendChild(del);

    header.appendChild(left); header.appendChild(right);
    header.addEventListener('click',function(e){
      if (e.target.closest('button')||e.target.closest('.subject-grip')) return;
      if (expandedSubject === subject.id) {
        // Detach listener FIRST to stop Firebase triggering renders during animation
        if (subject.shareId) {
          var fs = getFS(); if (fs) fs.unlisten(subject.shareId);
          delete FB_LISTEN_ACTIVE[subject.shareId];
        }
        notesList.classList.remove('is-open');
        notesList.classList.add('is-closing');
        setTimeout(function(){
          expandedSubject = null;
          render();
        }, 280);
      } else {
        expandedSubject = subject.id;
        render();
        // Attach Firebase listener when card expands
        if (subject.shareId) attachShareListener(subject);
      }
    });

    var notesList=el('div','subject-notes-list');
    notesList.style.display = isOpen ? 'flex' : 'none';
    if (isOpen) notesList.classList.add('is-open');
    if (isChecklist) {
      // Sort: unchecked first, checked last
      var sorted = subject.notes.slice().sort(function(a,b){
        if (a.checked === b.checked) return 0;
        return a.checked ? 1 : -1;
      });
      sorted.forEach(function(n){ notesList.appendChild(buildChecklistItem(n, subject)); });
      if (!subject.notes.length) {
        var empty=el('div','notes-empty'); empty.textContent='Empty list — click ＋ to add items.'; notesList.appendChild(empty);
      }
    } else {
      subject.notes.forEach(function(n){ notesList.appendChild(buildNoteRow(n,subject.id)); });
      if (!subject.notes.length){ var empty=el('div','notes-empty'); empty.textContent='No notes yet — click ＋ to add one.'; notesList.appendChild(empty); }
    }

    notesList.addEventListener('dragover',function(e){ if(!dragNotePayload)return; e.preventDefault(); notesList.classList.add('note-drop-over'); });
    notesList.addEventListener('dragleave',function(){ notesList.classList.remove('note-drop-over'); });
    notesList.addEventListener('drop',function(e){
      notesList.classList.remove('note-drop-over');
      if (dragNotePayload&&dragNotePayload.fromSubjectId!==subject.id) {
        e.preventDefault();
        var from=data.subjects.find(function(s){ return s.id===dragNotePayload.fromSubjectId; });
        var to=subject, idx=from.notes.findIndex(function(n){ return n.id===dragNotePayload.noteId; });
        if (from&&to&&idx!==-1){ var note=from.notes.splice(idx,1)[0]; to.notes.push(note); save(); render(); toast('Moved to "'+to.name+'"'); }
      }
    });

    grip.addEventListener('mousedown',function(){ card.draggable=true; });
    card.addEventListener('dragstart',function(e){
      if(!card.draggable)return; dragSubjectId=subject.id; dragNotePayload=null;
      e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain','subject:'+subject.id);
      setTimeout(function(){ card.classList.add('subject-dragging'); },0);
    });
    card.addEventListener('dragend',function(){ card.classList.remove('subject-dragging'); card.draggable=false; dragSubjectId=null; });
    card.addEventListener('dragover',function(e){ if(!dragSubjectId||dragSubjectId===subject.id)return; e.preventDefault(); card.classList.add('subject-drag-over'); });
    card.addEventListener('dragleave',function(){ card.classList.remove('subject-drag-over'); });
    card.addEventListener('drop',function(e){
      card.classList.remove('subject-drag-over');
      if (!dragSubjectId||dragSubjectId===subject.id) return;
      e.preventDefault();
      var fi=data.subjects.findIndex(function(s){ return s.id===dragSubjectId; });
      var ti=data.subjects.findIndex(function(s){ return s.id===subject.id; });
      if (fi!==-1&&ti!==-1){ data.subjects.splice(ti,0,data.subjects.splice(fi,1)[0]); save(); render(); }
    });

    card.appendChild(header); card.appendChild(notesList); return card;
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  function render() {
    var list=document.getElementById('subjectList'); if(!list) return;
    var pageScroll   = document.documentElement.scrollTop || window.scrollY || 0;
    var scroller     = getScroller();
    var innerScroll  = scroller ? scroller.scrollTop : 0;
    var term=((document.getElementById('searchBar')||{}).value||'').toLowerCase().trim();
    list.innerHTML='';
    var visible=term ? data.subjects.filter(function(s){
      return s.name.toLowerCase().includes(term)||s.notes.some(function(n){ return n.content.toLowerCase().includes(term); });
    }) : data.subjects;
    visible.forEach(function(s){ list.appendChild(buildSubjectCard(s)); });
    var eb=document.getElementById('exportbutton'); if(eb) eb.style.display=data.subjects.length?'':'none';
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        if (pageScroll > 0) document.documentElement.scrollTop = pageScroll;
        var newScroller = getScroller();
        if (newScroller && innerScroll > 0) newScroller.scrollTop = innerScroll;
      });
    });
  }

  // ─── Show / Hide ──────────────────────────────────────────────────────────────
  function showNotes() {
    var mc = document.getElementById('mainContent');
    if (mc) mc.style.display = 'none';

    // Hide title + memory game link while notes are open
    var mainContainer = document.getElementById('mainContainer');
    if (mainContainer) mainContainer.classList.add('notes-active');

    var ns = document.querySelector('.notes-section');
    if (ns) {
      ns.style.opacity = '0';
      ns.style.display = 'flex';
      requestAnimationFrame(function(){
        ns.style.transition = 'opacity 0.4s ease';
        ns.style.opacity = '1';
      });
    }
    var show=document.getElementById('showNotes'), hide=document.getElementById('hideNotes');
    if(show) show.style.display='none'; if(hide) hide.style.display='inline-block';
    updateStorageMeter();
  }

  function hideNotes() {
    var ns = document.querySelector('.notes-section');
    if (ns) {
      ns.style.transition = 'opacity 0.4s ease';
      ns.style.opacity = '0';
      setTimeout(function(){
        ns.style.display = 'none';
        ns.style.opacity = '';
        ns.style.transition = '';

        // Restore title + memory game link
        var mainContainer = document.getElementById('mainContainer');
        if (mainContainer) mainContainer.classList.remove('notes-active');

        var mc = document.getElementById('mainContent');
        if (mc) mc.style.display = 'block';
        var show=document.getElementById('showNotes'), hide=document.getElementById('hideNotes');
        if(show) show.style.display='inline-block'; if(hide) hide.style.display='none';
      }, 400);
    } else {
      var mainContainer = document.getElementById('mainContainer');
      if (mainContainer) mainContainer.classList.remove('notes-active');

      var mc = document.getElementById('mainContent');
      if (mc) mc.style.display = 'block';
      var show=document.getElementById('showNotes'), hide=document.getElementById('hideNotes');
      if(show) show.style.display='inline-block'; if(hide) hide.style.display='none';
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    load();

    var addBtn=document.getElementById('addSubjectBtn');
    if (addBtn) addBtn.addEventListener('click', openNewSubjectModal);

    var sb=document.getElementById('searchBar'); if(sb) sb.addEventListener('input',render);

    var expBtn=document.getElementById('exportbutton'); if(expBtn) expBtn.addEventListener('click',exportJSON);

    var expCont=document.getElementById('exportButtonContainer');
    if (expCont&&!document.getElementById('importNotesBtn')) {
      var impBtn=document.createElement('button');
      impBtn.id='importNotesBtn'; impBtn.textContent='Import'; impBtn.className='notes-btn notes-btn-primary';
      impBtn.addEventListener('click',function(){ var inp=document.createElement('input'); inp.type='file'; inp.accept='.json'; inp.onchange=function(e){ if(e.target.files[0]) importJSON(e.target.files[0]); }; inp.click(); });
      expCont.appendChild(impBtn);
    }

    var ns=document.querySelector('.notes-section');
    if (ns&&!document.querySelector('.notes-top-bar')) {
      var bar=document.createElement('div'); bar.className='notes-top-bar';
      [document.getElementById('searchBar'),document.getElementById('addSubjectBtn'),document.getElementById('exportButtonContainer'),document.getElementById('hideNotes')]
        .forEach(function(e){ if(e) bar.appendChild(e); });
      // Firebase connect button
      var fbBtn = document.createElement('button');
      fbBtn.id = 'firebaseConnectBtn'; fbBtn.className = 'notes-btn firebase-connect-btn';
      var fs = getFS();
      if (fs && fs.isConfigured()) { fbBtn.textContent = '🔥 Connected'; fbBtn.classList.add('firebase-connected'); }
      else { fbBtn.textContent = '🔥 Share'; }
      fbBtn.addEventListener('click', function(){
        var fs = getFS();
        if (fs && fs.isReady) showFirebaseOptionsModal();
        else openFirebaseSetupModal(null);
      });
      bar.appendChild(fbBtn);
      var meter=document.createElement('div'); meter.id='notes-storage-meter';
      meter.style.cssText='font-size:11px;font-weight:600;white-space:nowrap;padding:3px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);margin-left:auto;flex-shrink:0;display:inline-block';
      bar.appendChild(meter); ns.insertBefore(bar,ns.firstChild);
      updateStorageMeter();
    }

    if (ns) ns.style.display='none';
    var mc = document.getElementById('mainContent');
    if (mc) mc.style.display='block';
    var show=document.getElementById('showNotes'), hide=document.getElementById('hideNotes');
    if(show){ show.style.display='inline-block'; show.addEventListener('click',showNotes); }
    if(hide){ hide.style.display='none';         hide.addEventListener('click',hideNotes); }

    // Firebase event listeners
    document.addEventListener('firebase-ready', function(){
      var b = document.getElementById('firebaseConnectBtn');
      if (b) { b.textContent = '🔥 Connected'; b.classList.add('firebase-connected'); }
      // Clear BOTH tracking objects then re-attach fresh listeners for all shared subjects
      var fs = getFS();
      if (fs) fs.clearListeners();
      FB_LISTEN_ACTIVE = {};
      data.subjects.forEach(function(s){
        if (s.shareId) attachShareListener(s);
      });
    });
    document.addEventListener('firebase-share-open', function(e){
      var shareId = e.detail.shareId;
      var fs = getFS();
      if (!fs || !fs.isReady) {
        // Shouldn't normally happen — firebase-sync.js auto-connects for share links
        // But fall back gracefully just in case
        setTimeout(function(){ openSharedView(shareId); }, 1000);
      } else {
        openSharedView(shareId);
      }
    });

    startSync(); render();
  }

  document.readyState==='loading' ? document.addEventListener('DOMContentLoaded',init) : init();

})();
