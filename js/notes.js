/**
 * notes.js — Subjects/Notes manager with IndexedDB image storage
 */
(function () {
  'use strict';

  var LS_KEY = 'notes_v2', TS_KEY = 'notes_v2_ts', LEGACY_KEY = 'subjects';
  var IDB_NAME = 'kwells_notes', IDB_STORE = 'images';
  var data = { subjects: [], folders: [] }, lastSavedTs = 0, expandedSubject = null;
  var expandedFolder = null;
  var dragNotePayload = null, dragSubjectId = null, dragSubjectToFolder = null, internalClipboard = { images: [] };
  var idb = null, FB_LISTEN_ACTIVE = {};

  // ── Identity ─────────────────────────────────────────────────────────────────
  function getIdentityForShare(sid) {
    var s = sid && localStorage.getItem('kwells_who_' + sid);
    if (s) return s;
    var fs = getFS(); return fs ? (fs.getDisplayName() || 'Unknown') : 'Unknown';
  }
  function setIdentityForShare(sid, name) {
    console.log('[Identity] setIdentityForShare — shareId:', sid, '| name:', name);
    if (sid && name) localStorage.setItem('kwells_who_' + sid, name);
  }

  // ── DOM helpers ───────────────────────────────────────────────────────────────
  function uid()        { return Math.random().toString(36).slice(2,9) + Date.now().toString(36); }
  function now()        { return Date.now(); }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function esc(s)       { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function btn(lbl, fn, cls) { var b = el('button', cls||'notes-btn'); b.textContent = lbl; b.addEventListener('click', fn); return b; }
  function insertText(ta, text) {
    var s = ta.selectionStart, e = ta.selectionEnd;
    ta.value = ta.value.slice(0,s) + text + ta.value.slice(e);
    ta.selectionStart = ta.selectionEnd = s + text.length; ta.focus();
  }
  function getScroller() { return document.querySelector('.subject-card-expanded .subject-notes-list') || null; }
  function makeModal(maxW) {
    var ov = el('div','note-editor-overlay'), modal = el('div','note-editor-modal');
    if (maxW) modal.style.maxWidth = maxW;
    ov.addEventListener('click', function(e){ if (e.target===ov) ov.remove(); });
    return { ov:ov, modal:modal, show:function(){ document.body.appendChild(ov); } };
  }
  function inp(placeholder, val, css) {
    var i = el('input'); i.type='text'; i.placeholder=placeholder||'';
    i.style.cssText = css || 'width:100%;padding:10px 12px;font-size:14px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.08);color:inherit;font-family:inherit;box-sizing:border-box;outline:none;';
    if (val) i.value = val; return i;
  }
  function errBox() {
    var e = el('div'); e.style.cssText = 'color:#f87171;font-size:12px;margin-top:8px;display:none;padding:8px 10px;background:rgba(239,68,68,0.1);border-radius:6px;'; return e;
  }

  // ── IndexedDB ─────────────────────────────────────────────────────────────────
  function openIDB() {
    if (idb) return Promise.resolve(idb);
    return new Promise(function(res,rej) {
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function(e) { if (!e.target.result.objectStoreNames.contains(IDB_STORE)) e.target.result.createObjectStore(IDB_STORE); };
      req.onsuccess = function(e) { idb = e.target.result; res(idb); };
      req.onerror   = function(e) { rej(e.target.error); };
    });
  }
  function idbTx(mode, fn) {
    return openIDB().then(function(db) {
      return new Promise(function(res,rej) {
        var req = fn(db.transaction(IDB_STORE, mode).objectStore(IDB_STORE));
        req.onsuccess = function() { res(req.result); };
        req.onerror   = function(e) { rej(e.target.error); };
      });
    });
  }
  function idbPut(id, url) { return idbTx('readwrite', function(s){ return s.put(url,id); }); }
  function idbGet(id)      { return idbTx('readonly',  function(s){ return s.get(id); }); }
  function saveToIDB(dataUrl) { var id='img_'+uid(); return idbPut(id,dataUrl).then(function(){ return 'idb:'+id; }); }
  function resolveImages(refs) {
    return Promise.all(refs.map(function(src) {
      return src.indexOf('idb:')===0 ? idbGet(src.slice(4)).then(function(d){ return d||src; }) : Promise.resolve(src);
    }));
  }
  function cleanupOrphanedImages() {
    return openIDB().then(function(db) {
      return new Promise(function(res) {
        var req = db.transaction(IDB_STORE,'readonly').objectStore(IDB_STORE).getAllKeys();
        req.onsuccess = function() {
          var used = {};
          data.subjects.forEach(function(s){ s.notes.forEach(function(n){ (n.images||[]).forEach(function(r){ if(r.indexOf('idb:')===0) used[r.slice(4)]=1; }); }); });
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

  // ── Storage ───────────────────────────────────────────────────────────────────
  function lsBytes() { var t=0; for (var k in localStorage) if (localStorage.hasOwnProperty(k)) t+=(localStorage[k].length+k.length)*2; return t; }
  function formatBytes(b) {
    if (b>=1073741824) return (b/1073741824).toFixed(2)+' GB';
    if (b>=1048576)    return (b/1048576).toFixed(2)+' MB';
    if (b>=1024)       return (b/1024).toFixed(1)+' KB';
    return b+' B';
  }
  function updateStorageMeter() {
    var m = document.getElementById('notes-storage-meter'); if (!m) return;
    var ls = lsBytes();
    openIDB().then(function(db) {
      return new Promise(function(res) {
        var req = db.transaction(IDB_STORE,'readonly').objectStore(IDB_STORE).getAll();
        req.onsuccess = function(){
          var idbB = (req.result||[]).reduce(function(t,v){ return t+(v?v.length*2:0); },0);
          var pct = ls/5242880, color = pct>.7?'#f87171':pct>.5?'#fbbf24':'#4ade80';
          var bg = pct>.7?'rgba(239,68,68,0.15)':pct>.5?'rgba(251,191,36,0.15)':'rgba(74,222,128,0.12)';
          m.textContent='💾 '+formatBytes(ls+idbB); m.title='Text: '+formatBytes(ls)+'  |  Images: '+formatBytes(idbB);
          m.style.color=color; m.style.background=bg; m.style.borderColor=color.replace(')',',0.3)').replace('rgb','rgba');
        };
        req.onerror = function(){ res(0); };
      });
    }).catch(function(){});
  }
  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data)); localStorage.setItem(TS_KEY, String(now())); lastSavedTs=now();
      if (lsBytes()>3670016) toast('⚠ Text storage near limit — consider removing old images.');
      updateStorageMeter();
    } catch(e) { toast(e.name==='QuotaExceededError' ? '⚠ Storage full! Try removing some images.' : '⚠ Save failed: '+e.message); }
  }
  function parseSubjects(raw) {
    var p = JSON.parse(raw), subjects = Array.isArray(p) ? p : (p.subjects||[]);
    var folders = Array.isArray(p.folders) ? p.folders.map(function(f){ return { id:f.id||uid(), name:f.name||'Folder', subjectIds:Array.isArray(f.subjectIds)?f.subjectIds:[] }; }) : [];
    return { folders: folders, subjects: subjects.map(function(s){
      return { id:s.id||uid(), name:s.name||'Untitled', type:s.type||'notes', shareId:s.shareId||null,
        notes:(s.notes||[]).map(function(n){
          if (typeof n==='string') return {id:uid(),content:decodeURIComponent(n),images:[],checked:false,checkedBy:null,checkedAt:null,createdAt:now(),updatedAt:now()};
          return {id:n.id||uid(),content:n.content||'',images:Array.isArray(n.images)?n.images:[],checked:!!n.checked,checkedBy:n.checkedBy||null,checkedAt:n.checkedAt||null,createdAt:n.createdAt||now(),updatedAt:n.updatedAt||now()};
        })};
    })};
  }
  function load() {
    var raw = localStorage.getItem(LS_KEY)||localStorage.getItem(LEGACY_KEY);
    if (raw) { try { data=parseSubjects(raw); } catch(e) { console.error('Load error',e); } }
    lastSavedTs = parseInt(localStorage.getItem(TS_KEY)||'0',10);
    var ps=[], needsSave=false;
    data.subjects.forEach(function(s){ s.notes.forEach(function(n){
      (n.images||[]).forEach(function(src,i){ if(src.indexOf('data:')===0) ps.push(saveToIDB(src).then(function(ref){ n.images[i]=ref; needsSave=true; })); });
    }); });
    if (ps.length) Promise.all(ps).then(function(){ if(needsSave){ save(); toast('Migrated images to expanded storage'); } });
    cleanupOrphanedImages().then(function(n){ if(n>0){ toast('🧹 Freed '+n+' unused image(s)'); updateStorageMeter(); } });
  }

  // ── Cross-tab sync ────────────────────────────────────────────────────────────
  function mergeIn(local, incoming) {
    var map={};
    local.forEach(function(x){ map[x.id]=x; });
    incoming.forEach(function(x){
      if (!map[x.id]) { map[x.id]=x; }
      else if (x.notes) {
        map[x.id].name=x.name;
        var nm={}; (map[x.id].notes||[]).forEach(function(n){ nm[n.id]=n; });
        (x.notes||[]).forEach(function(n){ if(!nm[n.id]||n.updatedAt>nm[n.id].updatedAt) nm[n.id]=n; });
        map[x.id].notes=Object.values(nm);
      } else if (x.updatedAt>map[x.id].updatedAt) { map[x.id]=x; }
    });
    return Object.values(map);
  }
  function mergeFolders(local, incoming) {
    var map = {};
    (local||[]).forEach(function(f){ map[f.id]=f; });
    (incoming||[]).forEach(function(f){ if(!map[f.id]) map[f.id]=f; else map[f.id].subjectIds=f.subjectIds; });
    return Object.values(map);
  }

  function cleanupListeners() {
    var fs=getFS();
    Object.keys(FB_LISTEN_ACTIVE).forEach(function(sid){
      if (!data.subjects.some(function(s){ return s.shareId===sid; })) {
        if (fs) fs.unlisten(sid); delete FB_LISTEN_ACTIVE[sid];
      }
    });
  }
  function startSync() {
    window.addEventListener('storage', function(e){
      if (e.key===LS_KEY&&e.newValue) { try{ var inc=parseSubjects(e.newValue); data.subjects=mergeIn(data.subjects,inc.subjects); data.folders=mergeFolders(data.folders,inc.folders); cleanupListeners(); render(); toast('Synced'); }catch(e){} }
    });
    setInterval(function(){
      var ts=parseInt(localStorage.getItem(TS_KEY)||'0',10);
      if(ts>lastSavedTs){ var r=localStorage.getItem(LS_KEY); if(r){ try{ var inc=parseSubjects(r); data.subjects=mergeIn(data.subjects,inc.subjects); data.folders=mergeFolders(data.folders,inc.folders); cleanupListeners(); render(); lastSavedTs=ts; }catch(e){} } }
    }, 15000);
  }

  // ── Export / Import ───────────────────────────────────────────────────────────
  function exportJSON() {
    toast('Preparing export…');
    var clone=JSON.parse(JSON.stringify(data)), ps=[];
    clone.subjects.forEach(function(s){ s.notes.forEach(function(n){ if(n.images&&n.images.length) ps.push(resolveImages(n.images).then(function(r){ n.images=r; })); }); });
    Promise.all(ps).then(function(){
      var a=document.createElement('a');
      a.href=URL.createObjectURL(new Blob([JSON.stringify(clone,null,2)],{type:'application/json'}));
      a.download='notes_'+new Date().toISOString().slice(0,10)+'.json'; a.click(); toast('Export done!');
    });
  }
  function importJSON(file) {
    var r=new FileReader();
    r.onload=function(e){ try{ var inc=parseSubjects(e.target.result); data.subjects=mergeIn(data.subjects,inc.subjects); save(); render(); toast('Import complete'); }catch(e){ alert('Invalid file.'); } };
    r.readAsText(file);
  }

  // ── Images ────────────────────────────────────────────────────────────────────
  function compressImage(file) {
    return new Promise(function(res,rej){
      var r=new FileReader(); r.onerror=rej;
      r.onload=function(e){
        var img=new Image(); img.onerror=rej;
        img.onload=function(){
          var MAX=1200, w=img.width, h=img.height;
          if(w>MAX){ h=Math.round(h*MAX/w); w=MAX; }
          var c=document.createElement('canvas'); c.width=w; c.height=h;
          c.getContext('2d').drawImage(img,0,0,w,h); res(c.toDataURL('image/jpeg',0.75));
        };
        img.src=e.target.result;
      };
      r.readAsDataURL(file);
    });
  }
  async function processFiles(files) {
    var out=[];
    for (var f of files) {
      if(!f||!f.type||!f.type.startsWith('image/')) continue;
      try { var d=await compressImage(f), ref=await saveToIDB(d); out.push({ref,dataUrl:d}); } catch(e) { toast('Could not load: '+(f.name||'image')); }
    }
    return out;
  }
  async function fromPasteEvent(e) {
    var files=Array.from((e.clipboardData||{}).items||[]).filter(function(i){ return i.type.startsWith('image/'); }).map(function(i){ e.preventDefault(); return i.getAsFile(); });
    return processFiles(files);
  }

  // ── Toast / Lightbox ─────────────────────────────────────────────────────────
  function toast(msg) {
    var old=document.getElementById('notes-toast'); if(old) old.remove();
    var d=el('div','notes-toast'); d.id='notes-toast'; d.textContent=msg; document.body.appendChild(d);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ d.classList.add('visible'); }); });
    setTimeout(function(){ d.classList.remove('visible'); setTimeout(function(){ d.remove(); },400); },3000);
  }
  function openLightbox(src) {
    var m=makeModal(), x=el('button','lightbox-close'), img=el('img','lightbox-img');
    img.src=src; x.textContent='✕'; x.addEventListener('click',function(){ m.ov.remove(); });
    function onKey(e){ if(e.key==='Escape'){ m.ov.remove(); document.removeEventListener('keydown',onKey); } }
    document.addEventListener('keydown',onKey);
    m.ov.className='lightbox-overlay'; m.ov.appendChild(x); m.ov.appendChild(img); m.show();
  }

  // ── Firebase ──────────────────────────────────────────────────────────────────
  function getFS() { return window.FirebaseSync || null; }
  function ensureDisplayName(cb) {
    var fs=getFS(); if(!fs) return;
    var name=fs.getDisplayName(); if(name){ cb(name); return; }
    openDisplayNameModal(cb);
  }
  function openDisplayNameModal(cb) {
    var m=makeModal('420px'), title=el('h3','editor-title'), sub=el('p'), i=inp('Your name or nickname…');
    title.textContent='👋 What should we call you?'; sub.textContent='Your name appears when you check items on shared lists.';
    sub.style.cssText='font-size:13px;opacity:0.6;margin:-4px 0 14px;';
    var saveB=btn('Continue',function(){
      var name=i.value.trim(); if(!name){ toast('Enter your name'); i.focus(); return; }
      var fs=getFS(); if(fs) fs.setDisplayName(name); m.ov.remove(); cb(name);
    },'notes-btn notes-btn-primary');
    var row=el('div','editor-btn-row'); row.appendChild(saveB); row.appendChild(btn('Cancel',function(){ m.ov.remove(); }));
    m.modal.appendChild(title); m.modal.appendChild(sub); m.modal.appendChild(i); m.modal.appendChild(row);
    m.ov.appendChild(m.modal); m.show(); i.focus();
    i.addEventListener('keydown',function(e){ if(e.key==='Enter') saveB.click(); });
  }
  function openJoinModal() {
    var fs=getFS();
    if(!fs||!fs.isReady){ openFirebaseSetupModal(function(){ openJoinModal(); }); return; }
    var m=makeModal('460px'), title=el('h3','editor-title'), sub=el('p');
    title.textContent='🔗 Join a Shared List'; sub.textContent='Paste a share link or share ID to connect.';
    sub.style.cssText='font-size:13px;opacity:0.6;margin:-4px 0 14px;';
    var i=inp('Paste share URL or ID…'), err=errBox(), row=el('div','editor-btn-row');
    var joinB=btn('Join',function(){
      var raw=i.value.trim(); if(!raw){ i.focus(); return; }
      var shareId=raw;
      try{ var u=new URL(raw), param=u.searchParams.get('share'); if(param) shareId=param; }catch(e){}
      shareId=shareId.replace(/[^a-z0-9]/gi,'');
      if(!shareId){ err.textContent='Could not find a share ID in that input.'; err.style.display=''; return; }
      joinB.textContent='Connecting…'; joinB.disabled=true;
      fs.getShared(shareId).then(function(fbData){
        joinB.textContent='Join'; joinB.disabled=false;
        if(!fbData||!fbData.meta){ err.textContent='No shared content found for that ID.'; err.style.display=''; return; }
        m.ov.remove();
        console.log('[Identity] openJoinModal fbData:', JSON.stringify(fbData).slice(0,300));
        console.log('[Identity] fbData.users:', fbData.users);
        var subject={ id:'shared_'+shareId, name:fbData.meta.name, type:fbData.meta.type||'notes', shareId:shareId,
          notes:Object.entries(fbData.items||{}).map(function(pair){
            var id=pair[0],it=pair[1];
            return {id:id,content:it.content||'',images:[],checked:it.checked||false,checkedBy:it.checkedBy||null,checkedAt:it.checkedAt||null,createdAt:it.createdAt||now(),updatedAt:it.updatedAt||now()};
          })};
        showImportSharedModal(subject, shareId, fbData.users);
      }).catch(function(e){ joinB.textContent='Join'; joinB.disabled=false; err.textContent='Error: '+e.message; err.style.display=''; });
    },'notes-btn notes-btn-primary');
    row.appendChild(joinB); row.appendChild(btn('Cancel',function(){ m.ov.remove(); }));
    m.modal.appendChild(title); m.modal.appendChild(sub); m.modal.appendChild(i); m.modal.appendChild(err); m.modal.appendChild(row);
    m.ov.appendChild(m.modal); m.show(); i.focus();
    i.addEventListener('keydown',function(e){ if(e.key==='Enter') joinB.click(); });
  }
  function openFirebaseSetupModal(onSuccess) {
    var m=makeModal('540px'), title=el('h3','editor-title'); title.textContent='🔥 Connect Firebase';
    var RULES='{\n  "rules": {\n    "shared": {\n      "$shareId": {\n        ".read": true,\n        ".write": true\n      }\n    }\n  }\n}';
    var guide=el('div');
    guide.innerHTML='<p style="font-size:13px;font-weight:600;margin:0 0 10px;">First time? Complete these 3 steps:</p>'
      +'<div style="font-size:12px;line-height:1.9;margin-bottom:14px;">'
      +'<div style="margin-bottom:6px;"><b>① Create a Firebase project</b> at <code style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:3px;">console.firebase.google.com</code></div>'
      +'<div style="margin-bottom:6px;"><b>② Enable Realtime Database</b> → Rules tab → paste and publish:</div>'
      +'<div style="display:flex;gap:6px;align-items:flex-start;margin:0 0 8px 16px;">'
      +'<pre id="rulesBox" style="flex:1;font-size:11px;background:rgba(0,0,0,0.3);padding:8px;border-radius:6px;margin:0;color:#94a3b8;">'+RULES+'</pre>'
      +'<button id="copyRulesBtn" style="flex-shrink:0;padding:5px 10px;font-size:11px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:inherit;cursor:pointer;font-family:inherit;">Copy</button></div>'
      +'<div><b>③ Project Settings → Add App → Web</b> → copy the config below:</div></div>';
    var ta=el('textarea','editor-textarea'); ta.placeholder='Paste your firebaseConfig here…'; ta.style.minHeight='130px'; ta.style.fontFamily='monospace'; ta.style.fontSize='12px';
    var err=errBox(), row=el('div','editor-btn-row');
    var saveB=btn('Connect',function(){
      var fs=getFS(); if(!fs){ err.textContent='Firebase module not loaded.'; err.style.display=''; return; }
      saveB.textContent='Connecting…'; saveB.disabled=true;
      fs.setup(ta.value).then(function(result){
        saveB.textContent='Connect'; saveB.disabled=false;
        if(result.ok){ m.ov.remove(); toast('✓ Firebase connected!'); var b=document.getElementById('firebaseConnectBtn'); if(b){ b.textContent='🔥 Connected'; b.classList.add('firebase-connected'); } if(onSuccess) onSuccess(); }
        else{ err.textContent=result.error; err.style.display=''; }
      });
    },'notes-btn notes-btn-primary');
    row.appendChild(saveB); row.appendChild(btn('Cancel',function(){ m.ov.remove(); }));
    m.modal.appendChild(title); m.modal.appendChild(guide); m.modal.appendChild(ta); m.modal.appendChild(err); m.modal.appendChild(row);
    m.ov.appendChild(m.modal); m.show(); ta.focus();
    var cb=document.getElementById('copyRulesBtn');
    if(cb) cb.addEventListener('click',function(){ navigator.clipboard.writeText(RULES).then(function(){ cb.textContent='✓ Copied!'; setTimeout(function(){ cb.textContent='Copy'; },2000); }); });
  }
  function showFirebaseOptionsModal() {
    var fs=getFS(), m=makeModal('380px'), title=el('h3','editor-title'); title.textContent='🔥 Firebase Settings';
    var info=el('p'); info.style.cssText='font-size:13px;opacity:0.7;margin:0 0 14px;';
    info.textContent='Your display name: '+(fs.getDisplayName()||'Not set');
    var row=el('div','editor-btn-row'); row.style.flexDirection='column'; row.style.gap='8px';
    function optBtn(label, fn, cls) { var b=btn(label,fn,cls||'notes-btn'); b.style.width='100%'; b.style.textAlign='left'; b.style.padding='10px 14px'; return b; }
    row.appendChild(optBtn('✏️  Change Name',function(){ m.ov.remove(); openDisplayNameModal(function(n){ toast('Name updated to: '+n); }); }));
    row.appendChild(optBtn('🔗  Join a Shared List',function(){ m.ov.remove(); openJoinModal(); }));
    row.appendChild(optBtn('🔌  Disconnect Firebase',function(){
      if(!confirm('Disconnect Firebase? Shared subjects will stop syncing.')) return;
      fs.clearConfig(); m.ov.remove(); var b=document.getElementById('firebaseConnectBtn');
      if(b){ b.textContent='🔥 Share'; b.classList.remove('firebase-connected'); } toast('Firebase disconnected');
    },'notes-btn notes-btn-danger'));
    row.appendChild(optBtn('✕  Close',function(){ m.ov.remove(); }));
    m.modal.appendChild(title); m.modal.appendChild(info); m.modal.appendChild(row);
    m.ov.appendChild(m.modal); m.show();
  }
  function shareSubject(subject) {
    var fs=getFS(); if(!fs||!fs.isReady){ openFirebaseSetupModal(function(){ shareSubject(subject); }); return; }
    ensureDisplayName(function(){ doShareSubject(subject); });
  }
  function doShareSubject(subject) {
    var fs=getFS(); toast('Sharing…'); subject.shareId=subject.id;
    fs.pushSubject(subject).then(function(shareId){
      if(!shareId){ toast('Share failed — check your Firebase connection'); return; }
      subject.shareId=shareId; save(); render(); showShareModal(subject,shareId); attachShareListener(subject);
    }).catch(function(e){ subject.shareId=null; toast('Share failed: '+e.message); });
  }
  function showShareModal(subject, shareId) {
    var fs=getFS();
    var isOwner = subject.id === shareId;
    var url=fs.getShareUrl(shareId), m=makeModal('500px');
    var title=el('h3','editor-title'); title.textContent='🔗 '+(isOwner?'Sharing: "'+subject.name+'"':'Connected: "'+subject.name+'"');
    var urlBox=el('div','share-url-box'); urlBox.textContent=url; urlBox.title='Click to copy';
    var hint=el('p','share-hint'); hint.textContent=isOwner?'Anyone with this link can view and edit this '+(subject.type==='checklist'?'checklist':'note')+' in real time.':'You are connected to this '+(subject.type==='checklist'?'checklist':'note')+' in real time.';
    var row=el('div','editor-btn-row');
    var copyB=btn('📋 Copy Link',function(){ navigator.clipboard.writeText(url).then(function(){ copyB.textContent='✓ Copied!'; copyB.style.color='#4ade80'; setTimeout(function(){ copyB.textContent='📋 Copy Link'; copyB.style.color=''; },2000); }); },'notes-btn notes-btn-primary');
    urlBox.addEventListener('click',function(){ copyB.click(); });
    row.appendChild(copyB);
    m.modal.appendChild(title); m.modal.appendChild(urlBox); m.modal.appendChild(hint);
    if (isOwner) {
      var teamTitle=el('p'); teamTitle.style.cssText='font-size:12px;font-weight:700;opacity:0.5;letter-spacing:0.5px;margin:14px 0 8px;text-transform:uppercase;'; teamTitle.textContent='Team Members';
      var membersList=el('div'); membersList.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;min-height:24px;';
      var currentUsers={};
      function refreshMembers(usersObj) {
        membersList.innerHTML=''; var names=Object.keys(usersObj||{}).sort();
        if(!names.length){ var none=el('span'); none.textContent='No members yet — add names below'; none.style.cssText='font-size:12px;opacity:0.4;font-style:italic;'; membersList.appendChild(none); return; }
        names.forEach(function(name){
          var chip=el('div','member-chip'), lbl=el('span'), rm=el('button');
          lbl.textContent=name; rm.textContent='×'; rm.style.cssText='border:none;background:none;cursor:pointer;font-size:14px;line-height:1;padding:0 0 0 4px;color:inherit;opacity:0.5;';
          rm.addEventListener('click',function(){ fs.removeUser(shareId,name).then(function(){ delete usersObj[name]; refreshMembers(usersObj); }).catch(function(e){ toast('Error: '+e.message); }); });
          chip.appendChild(lbl); chip.appendChild(rm); membersList.appendChild(chip);
        });
      }
      fs.getShared(shareId).then(function(fbData){ currentUsers=(fbData&&fbData.users)?fbData.users:{}; refreshMembers(currentUsers); });
      var addInp=inp('Name (e.g. Jeff, Kevin)…','','flex:1;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.08);color:inherit;font-family:inherit;font-size:13px;outline:none;');
      var addRow=el('div'); addRow.style.cssText='display:flex;gap:6px;margin-bottom:14px;';
      var addB=btn('Add',function(){
        var name=addInp.value.trim(); if(!name){ addInp.focus(); return; }
        addB.textContent='…'; addB.disabled=true;
        fs.addUser(shareId,name).then(function(){ currentUsers[name]={addedAt:now()}; refreshMembers(currentUsers); addInp.value=''; addB.textContent='Add'; addB.disabled=false; addInp.focus(); }).catch(function(e){ addB.textContent='Add'; addB.disabled=false; toast('Error: '+e.message); });
      },'notes-btn notes-btn-primary');
      addInp.addEventListener('keydown',function(e){ if(e.key==='Enter') addB.click(); });
      addRow.appendChild(addInp); addRow.appendChild(addB);
      row.appendChild(btn('Stop Sharing',function(){
        if(!confirm('Stop sharing "'+subject.name+'"? Your team members will be preserved for next time.')) return;
        fs.unlisten(shareId); delete FB_LISTEN_ACTIVE[shareId]; subject.shareId=null; save(); render(); m.ov.remove(); toast('Sharing stopped — team members preserved');
      },'notes-btn notes-btn-danger'));
      m.modal.appendChild(teamTitle); m.modal.appendChild(membersList); m.modal.appendChild(addRow);
    } else {
      var nameInfo=el('p'); nameInfo.style.cssText='font-size:13px;opacity:0.6;margin:8px 0 16px;'; nameInfo.textContent='Connected as: '+getIdentityForShare(shareId);
      row.appendChild(btn('Disconnect',function(){
        if(!confirm('Disconnect from "'+subject.name+'"? The subject stays in your list but will stop syncing.')) return;
        var fsInst=getFS(); if(fsInst) fsInst.unlisten(shareId); delete FB_LISTEN_ACTIVE[shareId];
        subject.shareId=null; save(); render(); m.ov.remove(); toast('Disconnected — subject kept locally');
      },'notes-btn notes-btn-danger'));
      m.modal.appendChild(nameInfo);
    }
    row.appendChild(btn('Close',function(){ m.ov.remove(); }));
    m.modal.appendChild(row); m.ov.appendChild(m.modal); m.show();
  }
  function openSharedView(shareId) {
    var fs=getFS(); if(!fs||!fs.isReady){ openFirebaseSetupModal(function(){ openSharedView(shareId); }); return; }
    var already=data.subjects.find(function(s){ return s.shareId===shareId; });
    if(already){ expandedSubject=already.id; render(); history.replaceState(null,'',window.location.pathname); toast('✓ Showing: '+already.name); return; }
    toast('Loading shared content…');
    fs.getShared(shareId).then(function(fbData){
      if(!fbData||!fbData.meta){ toast('Shared content not found or has been removed.'); return; }
      console.log('[Identity] openSharedView fbData:', JSON.stringify(fbData).slice(0,300));
      console.log('[Identity] fbData.users:', fbData.users);
      var subject={id:'shared_'+shareId,name:fbData.meta.name,type:fbData.meta.type||'notes',shareId:shareId,
        notes:Object.entries(fbData.items||{}).map(function(pair){
          var id=pair[0],it=pair[1];
          return {id:id,content:it.content||'',images:[],checked:it.checked||false,checkedBy:it.checkedBy||null,checkedAt:it.checkedAt||null,createdAt:it.createdAt||now(),updatedAt:it.updatedAt||now()};
        })};
      showImportSharedModal(subject, shareId, fbData.users);
    });
  }
  function showImportSharedModal(subject, shareId, users) {
    var approvedNames=Object.keys(users||{}).map(function(n){ return n.toLowerCase(); });
    var hasApproved=approvedNames.length>0;
    var stored=localStorage.getItem('kwells_who_'+shareId)||null;
    console.log('[Identity] showImportSharedModal — shareId:', shareId, '| approvedNames:', approvedNames, '| storedIdentity:', stored);
    var m=makeModal('420px'), title=el('h3','editor-title'); title.textContent='📥 Shared: '+subject.name;
    var info=el('p'); info.style.cssText='font-size:13px;opacity:0.6;margin:0 0 16px;line-height:1.5;'; info.textContent='Enter your name to collaborate in real time.';
    var sec=el('div'); sec.style.cssText='margin-bottom:16px;padding:12px 14px;border-radius:10px;border:1px solid rgba(59,130,246,0.3);background:rgba(59,130,246,0.07);';
    var lbl=el('p'); lbl.style.cssText='font-size:11px;font-weight:700;opacity:0.5;letter-spacing:0.5px;text-transform:uppercase;margin:0 0 10px;'; lbl.textContent='👋 Your name';
    var nameInp=inp('Enter your name…',stored||''); var err=errBox();
    sec.appendChild(lbl); sec.appendChild(nameInp); sec.appendChild(err);
    var row=el('div','editor-btn-row');
    var joinB=btn('Join',function(){
      var name=nameInp.value.trim();
      console.log('[Identity] Join clicked — name:', name, '| hasApproved:', hasApproved);
      if(!name){ err.textContent='Please enter your name.'; err.style.display=''; nameInp.focus(); return; }
      if(hasApproved&&approvedNames.indexOf(name.toLowerCase())===-1){ err.textContent='That name isn\'t on the access list. Contact the owner to be added.'; err.style.display=''; console.warn('[Identity] Rejected — name not in approved list:', name); return; }
      var approvedName=hasApproved ? (Object.keys(users)[approvedNames.indexOf(name.toLowerCase())]||name) : name;
      setIdentityForShare(shareId, approvedName);
      data.subjects.unshift(subject); expandedSubject=subject.id; save(); render(); m.ov.remove();
      history.replaceState(null,'',window.location.pathname); toast('✓ Joined as '+approvedName+': '+subject.name);
      attachShareListener(subject);
    },'notes-btn notes-btn-primary');
    nameInp.addEventListener('input',function(){ err.style.display='none'; });
    nameInp.addEventListener('keydown',function(e){ if(e.key==='Enter') joinB.click(); });
    row.appendChild(joinB); row.appendChild(btn('Dismiss',function(){ m.ov.remove(); history.replaceState(null,'',window.location.pathname); }));
    m.modal.appendChild(title); m.modal.appendChild(info); m.modal.appendChild(sec); m.modal.appendChild(row);
    m.ov.appendChild(m.modal); m.show(); nameInp.focus();
  }
  function attachShareListener(subject) {
    var fs=getFS(); if(!fs||!fs.isReady||!subject.shareId) return;
    if(FB_LISTEN_ACTIVE[subject.shareId]) return;
    var sid=subject.shareId; FB_LISTEN_ACTIVE[sid]=true;
    fs.listen(sid,function(fbData){
      if(!fbData||!fbData.items) return;
      var local=data.subjects.find(function(s){ return s.shareId===sid; }); if(!local) return;
      var localMap={}; local.notes.forEach(function(n){ localMap[n.id]=n; });
      local.notes=Object.entries(fbData.items).map(function(pair){
        var id=pair[0],it=pair[1],loc=localMap[id];
        return {id:id,content:it.content||(loc?loc.content:''),images:loc?(loc.images||[]):[],checked:it.checked||false,checkedBy:it.checkedBy||null,checkedAt:it.checkedAt||null,createdAt:it.createdAt||now(),updatedAt:it.updatedAt||now()};
      });
      if(fbData.meta&&fbData.meta.name) local.name=fbData.meta.name;
      save(); render();
    });
  }

  // ── Editor Modal ──────────────────────────────────────────────────────────────
  function openEditor(subjectId, noteId, insertAtIndex, scrollToBottom) {
    var subject=data.subjects.find(function(s){ return s.id===subjectId; }); if(!subject) return;
    var existing=noteId?subject.notes.find(function(n){ return n.id===noteId; }):null;
    var imgs=[], displayImgs=[];
    function addImages(found){ found.forEach(function(r){ imgs.push(r.ref); displayImgs.push(r.dataUrl); }); refreshStrip(); }
    var m=makeModal(), title=el('h3','editor-title');
    title.textContent=existing?'Edit — '+subject.name:(insertAtIndex!==undefined?'Insert':'New')+' note in "'+subject.name+'"';
    var ta=el('textarea','editor-textarea'); ta.value=existing?existing.content:''; ta.placeholder='Write your note… paste images with Ctrl+V'; ta.spellcheck=true;
    var strip=el('div','editor-img-strip');
    function refreshStrip(){
      strip.innerHTML='';
      displayImgs.forEach(function(src,i){
        var wrap=el('div','editor-img-thumb-wrap'), img=el('img','editor-img-thumb'), rm=el('button','img-rm-btn');
        img.src=src; rm.textContent='×'; rm.onclick=function(){ imgs.splice(i,1); displayImgs.splice(i,1); refreshStrip(); };
        wrap.appendChild(img); wrap.appendChild(rm); strip.appendChild(wrap);
      });
    }
    if(existing&&existing.images&&existing.images.length){ imgs=existing.images.slice(); resolveImages(imgs).then(function(r){ displayImgs=r; refreshStrip(); }); }
    refreshStrip();
    var blockPaste=false;
    ta.addEventListener('paste',function(e){ if(blockPaste){ e.preventDefault(); blockPaste=false; return; } fromPasteEvent(e).then(function(found){ if(found.length) addImages(found); }); });
    function handleDrop(e){ e.preventDefault(); e.stopPropagation(); ta.classList.remove('img-drag-over'); processFiles(Array.from(e.dataTransfer.files)).then(function(found){ if(found.length) addImages(found); }); }
    ta.addEventListener('dragover',function(e){ e.preventDefault(); ta.classList.add('img-drag-over'); });
    ta.addEventListener('dragleave',function(){ ta.classList.remove('img-drag-over'); });
    ta.addEventListener('drop',handleDrop); strip.addEventListener('dragover',function(e){ e.preventDefault(); }); strip.addEventListener('drop',handleDrop);
    var addImgB=btn('📎 Add Image',function(){ var i=document.createElement('input'); i.type='file'; i.accept='image/*'; i.multiple=true; i.onchange=function(e){ processFiles(Array.from(e.target.files)).then(function(found){ if(found.length) addImages(found); }); }; i.click(); },'notes-btn');
    var pasteB=btn('📋 Paste',function(e){
      e.preventDefault(); e.stopPropagation();
      if(internalClipboard.images.length){
        var clip=internalClipboard.images.slice(); internalClipboard.images=[];
        resolveImages(clip).then(function(resolved){ Promise.all(resolved.map(function(d){ return d?saveToIDB(d):Promise.resolve(null); })).then(function(refs){ addImages(refs.filter(Boolean).map(function(ref,i){ return {ref:ref,dataUrl:resolved[i]}; })); toast('✓ Image(s) pasted'); }); });
        blockPaste=true; setTimeout(function(){ ta.focus(); setTimeout(function(){ blockPaste=false; },300); },0); return;
      }
      if(navigator.clipboard&&navigator.clipboard.read){
        navigator.clipboard.read().then(function(items){
          var imgItem=null;
          items.forEach(function(item){ item.types.forEach(function(t){ if(t.startsWith('image/')&&!imgItem) imgItem={item,t}; }); });
          if(imgItem){ imgItem.item.getType(imgItem.t).then(function(blob){ processFiles([blob]).then(function(found){ if(found.length) addImages(found); }); }); }
          else{ navigator.clipboard.readText().then(function(text){ if(text) insertText(ta,text); }).catch(function(){}); }
        }).catch(function(){ navigator.clipboard.readText&&navigator.clipboard.readText().then(function(text){ if(text) insertText(ta,text); }).catch(function(){}); });
      } else if(navigator.clipboard&&navigator.clipboard.readText){ navigator.clipboard.readText().then(function(text){ if(text) insertText(ta,text); }).catch(function(){ ta.focus(); toast('Use Ctrl+V / Cmd+V'); }); }
      else{ ta.focus(); toast('Use Ctrl+V / Cmd+V'); }
    },'notes-btn');
    function updatePasteLabel(){
      if(internalClipboard.images.length){ pasteB.textContent='🖼 Paste Image'; pasteB.classList.add('notes-btn-primary'); return; }
      if(navigator.clipboard&&navigator.clipboard.read){ navigator.clipboard.read().then(function(items){ var hasImg=items.some(function(i){ return i.types.some(function(t){ return t.startsWith('image/'); }); }); pasteB.textContent=hasImg?'🖼 Paste Image':'📋 Paste Text'; hasImg?pasteB.classList.add('notes-btn-primary'):pasteB.classList.remove('notes-btn-primary'); }).catch(function(){ pasteB.textContent='📋 Paste'; }); }
    }
    updatePasteLabel();
    var row=el('div','editor-btn-row');
    var saveB=btn('Save',function(){
      var content=ta.value.trim(); if(!content&&!imgs.length){ toast('Note is empty'); return; }
      var newId=uid();
      if(existing){ existing.content=content; existing.images=imgs; existing.updatedAt=now(); newId=existing.id; }
      else if(insertAtIndex!==undefined){ subject.notes.splice(insertAtIndex,0,{id:newId,content,images:imgs,createdAt:now(),updatedAt:now()}); }
      else{ subject.notes.push({id:newId,content,images:imgs,createdAt:now(),updatedAt:now()}); }
      save(); render(); m.ov.remove();
      if(scrollToBottom){ requestAnimationFrame(function(){ requestAnimationFrame(function(){ var inner=document.querySelector('.subject-card-expanded .subject-notes-list'); if(inner) inner.scrollTop=inner.scrollHeight; document.documentElement.scrollTop=document.documentElement.scrollHeight; }); }); }
    },'notes-btn notes-btn-primary');
    row.appendChild(addImgB); row.appendChild(pasteB); row.appendChild(saveB); row.appendChild(btn('Cancel',function(){ m.ov.remove(); }));
    m.modal.appendChild(title); m.modal.appendChild(ta); m.modal.appendChild(strip); m.modal.appendChild(row);
    m.ov.appendChild(m.modal); m.show(); ta.focus();
  }

  // ── Note Row ──────────────────────────────────────────────────────────────────
  function buildNoteRow(note, subjectId) {
    var subject=data.subjects.find(function(s){ return s.id===subjectId; });
    var row=el('div','note-row'); row.dataset.id=note.id; row.draggable=true;
    var content=el('div','note-row-content');
    if(note.images&&note.images.length){
      var wrap=el('div','note-row-images');
      note.images.forEach(function(src){
        var img=el('img','note-row-img'); img.style.minWidth='60px'; img.style.minHeight='40px'; img.loading='lazy'; img.decoding='async';
        if(src.indexOf('idb:')===0){ idbGet(src.slice(4)).then(function(d){ if(d){ img.src=d; img.addEventListener('click',function(e){ e.stopPropagation(); openLightbox(d); }); } }); }
        else{ img.src=src; img.addEventListener('click',function(e){ e.stopPropagation(); openLightbox(src); }); }
        wrap.appendChild(img);
      });
      content.appendChild(wrap);
    }
    var txt=el('div','note-row-text'); txt.innerHTML=esc(note.content).replace(/\n/g,'<br>'); content.appendChild(txt);
    var modEl=el('div','note-last-modified'); modEl.textContent=note.updatedAt?'Modified: '+new Date(note.updatedAt).toLocaleString():''; content.appendChild(modEl);
    var actions=el('div','note-row-actions');
    function addEditBtn(lbl,fn){ actions.appendChild(btn(lbl,function(e){ e.stopPropagation(); fn(); })); }
    addEditBtn('Add Above',function(){ openEditor(subjectId,null,subject.notes.findIndex(function(n){ return n.id===note.id; })); });
    addEditBtn('Add Below',function(){ var idx=subject.notes.findIndex(function(n){ return n.id===note.id; }); openEditor(subjectId,null,idx+1,idx===subject.notes.length-1); });
    addEditBtn('Edit',function(){ openEditor(subjectId,note.id); });
    var delB=btn('Delete',function(e){
      e.stopPropagation(); delB.textContent='Sure?'; delB.style.pointerEvents='none';
      var yesB=btn('Yes',function(e2){
        e2.stopPropagation(); var idx=subject.notes.findIndex(function(n){ return n.id===note.id; }); var wasLast=idx===subject.notes.length-1;
        subject.notes=subject.notes.filter(function(n){ return n.id!==note.id; }); save(); cleanupOrphanedImages().then(function(n){ if(n>0) updateStorageMeter(); }); render();
        if(wasLast&&subject.notes.length>0){ requestAnimationFrame(function(){ requestAnimationFrame(function(){ var inner=document.querySelector('.subject-card-expanded .subject-notes-list'); if(inner) inner.scrollTop=inner.scrollHeight; document.documentElement.scrollTop=document.documentElement.scrollHeight; }); }); }
      },'notes-btn notes-btn-danger');
      var noB=btn('No',function(e2){ e2.stopPropagation(); delB.textContent='Delete'; delB.style.pointerEvents=''; actions.removeChild(yesB); actions.removeChild(noB); },'notes-btn');
      actions.insertBefore(noB,delB.nextSibling); actions.insertBefore(yesB,noB);
    }); delB.classList.add('notes-btn-danger'); actions.appendChild(delB);
    var copyB=btn('Copy',function(e){
      e.stopPropagation(); var orig=copyB.textContent; copyB.textContent='✓ Copied!'; copyB.style.color='#4ade80'; setTimeout(function(){ copyB.textContent=orig; copyB.style.color=''; },2000);
      var t=document.createElement('textarea'); t.value=note.content; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t);
      var refs=note.images?note.images.slice():[];
      if(!refs.length) return;
      resolveImages(refs).then(function(resolved){
        internalClipboard.images=resolved;
        if(navigator.clipboard&&window.ClipboardItem){
          var d=resolved[0],parts=d.split(','),bytes=atob(parts[1]),arr=new Uint8Array(bytes.length);
          for(var i=0;i<bytes.length;i++) arr[i]=bytes.charCodeAt(i);
          navigator.clipboard.write([new ClipboardItem({'image/png':new Blob([arr],{type:'image/png'})})]).then(function(){ toast('✓ Image in system clipboard'); }).catch(function(){ toast('Copied! ('+refs.length+' image(s) — use 📋 Paste in editor)'); });
        } else{ toast('Copied! ('+refs.length+' image(s) — use 📋 Paste in editor)'); }
      });
    }); actions.appendChild(copyB);
    row.appendChild(content); row.appendChild(actions);
    row.addEventListener('dragstart',function(e){ dragNotePayload={noteId:note.id,fromSubjectId:subjectId}; dragSubjectId=null; e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain','note:'+note.id); e.stopPropagation(); setTimeout(function(){ row.classList.add('dragging'); },0); });
    row.addEventListener('dragend',function(){ row.classList.remove('dragging'); dragNotePayload=null; });
    return row;
  }

  // ── Checklist Item ────────────────────────────────────────────────────────────
  function buildChecklistItem(item, subject) {
    var row=el('div','checklist-item'+(item.checked?' checklist-item-checked':'')); row.dataset.id=item.id;
    var checkbox=el('input'); checkbox.type='checkbox'; checkbox.className='checklist-checkbox'; checkbox.checked=!!item.checked;
    var labelEl=el('span','checklist-label'+(item.checked?' checklist-label-checked':'')); labelEl.textContent=item.content;
    function fmtStamp(it){ if(it.checkedAt){ var who=it.checkedBy?' by '+it.checkedBy:''; return (it.checked?'Checked':'Unchecked')+who+' · '+new Date(it.checkedAt).toLocaleString(); } return 'Added · '+new Date(it.createdAt).toLocaleString(); }
    var stampEl=el('span','checklist-stamp'); stampEl.textContent=fmtStamp(item);
    checkbox.addEventListener('change',function(){
      var fs=getFS(); item.checked=checkbox.checked; item.checkedAt=now();
      item.checkedBy=subject.shareId?getIdentityForShare(subject.shareId):(fs?(fs.getDisplayName()||'Unknown'):'Unknown'); item.updatedAt=now();
      row.classList.toggle('checklist-item-checked',item.checked); labelEl.classList.toggle('checklist-label-checked',item.checked); stampEl.textContent=fmtStamp(item); save();
      if(fs&&fs.isReady&&subject.shareId) fs.updateItem(subject.shareId,item.id,{checked:item.checked,checkedBy:item.checkedBy,checkedAt:item.checkedAt}).catch(function(){});
    });
    var actions=el('div','checklist-actions');
    actions.appendChild(btn('Edit',function(e){ e.stopPropagation(); openChecklistItemEditor(subject.id,item.id); }));
    var delB=btn('Delete',function(e){
      e.stopPropagation(); delB.textContent='Sure?'; delB.style.pointerEvents='none';
      var yesB=btn('Yes',function(e2){ e2.stopPropagation(); var fs=getFS(); if(fs&&fs.isReady&&subject.shareId) fs.removeItem(subject.shareId,item.id).catch(function(){}); subject.notes=subject.notes.filter(function(n){ return n.id!==item.id; }); save(); render(); },'notes-btn notes-btn-danger');
      var noB=btn('No',function(e2){ e2.stopPropagation(); delB.textContent='Delete'; delB.style.pointerEvents=''; actions.removeChild(yesB); actions.removeChild(noB); },'notes-btn');
      actions.insertBefore(noB,delB.nextSibling); actions.insertBefore(yesB,noB);
    }); delB.classList.add('notes-btn-danger'); actions.appendChild(delB);
    var left=el('div','checklist-left'); left.appendChild(checkbox); left.appendChild(labelEl); left.appendChild(stampEl);
    row.appendChild(left); row.appendChild(actions); return row;
  }
  function openChecklistItemEditor(subjectId, itemId) {
    var subject=data.subjects.find(function(s){ return s.id===subjectId; }); if(!subject) return;
    var existing=itemId?subject.notes.find(function(n){ return n.id===itemId; }):null;
    var m=makeModal(), title=el('h3','editor-title'); title.textContent=existing?'Edit item — '+subject.name:'Add to "'+subject.name+'"';
    var ta=el('textarea','editor-textarea'); ta.value=existing?existing.content:''; ta.placeholder='Item text…'; ta.style.minHeight='80px';
    var row=el('div','editor-btn-row');
    var saveB=btn('Save',function(){
      var content=ta.value.trim(); if(!content){ toast('Item is empty'); return; }
      var fs=getFS();
      if(existing){ existing.content=content; existing.updatedAt=now(); if(fs&&fs.isReady&&subject.shareId) fs.updateItem(subject.shareId,existing.id,{content:existing.content,updatedAt:existing.updatedAt}).catch(function(){}); }
      else{ var newItem={id:uid(),content:content,images:[],checked:false,checkedBy:null,checkedAt:null,createdAt:now(),updatedAt:now()}; subject.notes.push(newItem); if(fs&&fs.isReady&&subject.shareId) fs.addItem(subject.shareId,newItem).catch(function(){}); }
      save(); render(); m.ov.remove();
    },'notes-btn notes-btn-primary');
    row.appendChild(saveB); row.appendChild(btn('Cancel',function(){ m.ov.remove(); }));
    m.modal.appendChild(title); m.modal.appendChild(ta); m.modal.appendChild(row); m.ov.appendChild(m.modal); m.show(); ta.focus();
    ta.addEventListener('keydown',function(e){ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); saveB.click(); } });
  }

  // ── New Subject Modal ─────────────────────────────────────────────────────────
  function openNewSubjectModal() {
    var m=makeModal(), title=el('h3','editor-title'); title.textContent='New subject';
    var nameInput=inp('Subject name…');
    var typeRow=el('div','editor-type-row'); typeRow.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:16px;';
    var typeLbl=el('span'); typeLbl.textContent='Type:'; typeLbl.style.cssText='font-size:13px;opacity:0.7;margin-right:10px;'; typeRow.appendChild(typeLbl);
    function mkTypeBtn(lbl,val,icon){ var b=el('button','type-select-btn'); b.dataset.val=val; b.innerHTML=icon+' '+lbl; b.addEventListener('click',function(){ typeRow.querySelectorAll('.type-select-btn').forEach(function(x){ x.classList.remove('type-select-active'); }); b.classList.add('type-select-active'); }); return b; }
    var btnNotes=mkTypeBtn('Notes','notes','📝'), btnChecklist=mkTypeBtn('Checklist','checklist','✅');
    btnNotes.classList.add('type-select-active'); typeRow.appendChild(btnNotes); typeRow.appendChild(btnChecklist);
    var row=el('div','editor-btn-row');
    var createB=btn('Create',function(){
      var name=nameInput.value.trim(); if(!name){ toast('Enter a name'); nameInput.focus(); return; }
      var active=typeRow.querySelector('.type-select-active'), type=active?active.dataset.val:'notes';
      data.subjects.push({id:uid(),name:name,type:type,notes:[]}); save(); render(); m.ov.remove();
    },'notes-btn notes-btn-primary');
    row.appendChild(createB); row.appendChild(btn('Cancel',function(){ m.ov.remove(); }));
    m.modal.appendChild(title); m.modal.appendChild(nameInput); m.modal.appendChild(typeRow); m.modal.appendChild(row);
    m.ov.appendChild(m.modal); m.show(); nameInput.focus();
    nameInput.addEventListener('keydown',function(e){ if(e.key==='Enter') createB.click(); });
  }

  // ── Subject Card ──────────────────────────────────────────────────────────────
  function buildSubjectCard(subject) {
    var isOpen=expandedSubject===subject.id, isChecklist=subject.type==='checklist';
    var card=el('div',isOpen?'subject-card subject-card-expanded':'subject-card'); card.dataset.id=subject.id;
    var header=el('div','subject-card-header');
    var grip=el('span','subject-grip'); grip.textContent='⠿';
    var chev=el('span','subject-chevron'); chev.textContent='▶';
    var nameEl=el('span','subject-name'); nameEl.textContent=subject.name; nameEl.style.fontWeight='700'; nameEl.style.flex='1';
    var typeBadge=el('span','subject-type-badge subject-type-'+(isChecklist?'checklist':'notes')); typeBadge.textContent=isChecklist?'✅':'📝'; typeBadge.title=isChecklist?'Checklist':'Notes';
    var totalItems=subject.notes.length, checkedItems=isChecklist?subject.notes.filter(function(n){ return n.checked; }).length:0;
    var count=el('span','subject-count'); count.textContent=isChecklist?(checkedItems+'/'+totalItems+' done'):(totalItems+' note'+(totalItems!==1?'s':''));
    if(!totalItems) count.classList.add('subject-count-empty');
    var liveBadge=subject.shareId?el('span','subject-live-badge'):null;
    if(liveBadge){ liveBadge.textContent='● LIVE'; liveBadge.title='Shared — syncing in real time'; }
    var left=el('div','subject-header-left'); [grip,chev,typeBadge,nameEl,count].forEach(function(x){ left.appendChild(x); }); if(liveBadge) left.appendChild(liveBadge);
    var right=el('div','subject-header-right');
    right.appendChild(btn('＋',function(e){ e.stopPropagation(); isChecklist?openChecklistItemEditor(subject.id,null):openEditor(subject.id); }));
    var shareB=btn('🔗',function(e){ e.stopPropagation(); subject.shareId?showShareModal(subject,subject.shareId):shareSubject(subject); },'notes-btn'+(subject.shareId?' notes-btn-live':''));
    shareB.title=subject.shareId?'Sharing — click to manage':'Share this '+(isChecklist?'checklist':'note'); right.appendChild(shareB);
    right.appendChild(btn('✎',function(e){ e.stopPropagation(); var n=prompt('New name:',subject.name); if(n&&n.trim()){ subject.name=n.trim(); save(); render(); } }));
    var del=btn('✕',function(e){ e.stopPropagation(); if(!confirm('Delete "'+subject.name+'" and all its notes?')) return; data.subjects=data.subjects.filter(function(s){ return s.id!==subject.id; }); if(expandedSubject===subject.id) expandedSubject=null; save(); cleanupOrphanedImages().then(function(n){ if(n>0) updateStorageMeter(); }); render(); }); del.classList.add('notes-btn-danger'); right.appendChild(del);
    header.appendChild(left); header.appendChild(right);
    var notesList=el('div','subject-notes-list'); notesList.style.display=isOpen?'flex':'none'; if(isOpen) notesList.classList.add('is-open');
    header.addEventListener('click',function(e){
      if(e.target.closest('button')||e.target.closest('.subject-grip')) return;
      if(expandedSubject===subject.id){
        if(subject.shareId){ var fs=getFS(); if(fs) fs.unlisten(subject.shareId); delete FB_LISTEN_ACTIVE[subject.shareId]; }
        notesList.classList.remove('is-open'); notesList.classList.add('is-closing');
        setTimeout(function(){ expandedSubject=null; render(); },280);
      } else { expandedSubject=subject.id; render(); if(subject.shareId) attachShareListener(subject); }
    });
    if(isChecklist){
      var sorted=subject.notes.slice().sort(function(a,b){ return a.checked===b.checked?0:(a.checked?1:-1); });
      sorted.forEach(function(n){ notesList.appendChild(buildChecklistItem(n,subject)); });
      if(!subject.notes.length){ var empty=el('div','notes-empty'); empty.textContent='Empty list — click ＋ to add items.'; notesList.appendChild(empty); }
    } else {
      subject.notes.forEach(function(n){ notesList.appendChild(buildNoteRow(n,subject.id)); });
      if(!subject.notes.length){ var empty=el('div','notes-empty'); empty.textContent='No notes yet — click ＋ to add one.'; notesList.appendChild(empty); }
    }
    notesList.addEventListener('dragover',function(e){ if(!dragNotePayload)return; e.preventDefault(); notesList.classList.add('note-drop-over'); });
    notesList.addEventListener('dragleave',function(){ notesList.classList.remove('note-drop-over'); });
    notesList.addEventListener('drop',function(e){
      notesList.classList.remove('note-drop-over'); if(!dragNotePayload||dragNotePayload.fromSubjectId===subject.id) return;
      e.preventDefault(); var from=data.subjects.find(function(s){ return s.id===dragNotePayload.fromSubjectId; }); var to=subject; var idx=from.notes.findIndex(function(n){ return n.id===dragNotePayload.noteId; });
      if(from&&to&&idx!==-1){ var note=from.notes.splice(idx,1)[0]; to.notes.push(note); save(); render(); toast('Moved to "'+to.name+'"'); }
    });
    grip.addEventListener('mousedown',function(){ card.draggable=true; });
    card.addEventListener('dragstart',function(e){ if(!card.draggable)return; dragSubjectId=subject.id; dragNotePayload=null; e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain','subject:'+subject.id); setTimeout(function(){ card.classList.add('subject-dragging'); },0); });
    card.addEventListener('dragend',function(){ card.classList.remove('subject-dragging'); card.draggable=false; dragSubjectId=null; });
    card.addEventListener('dragover',function(e){ if(!dragSubjectId||dragSubjectId===subject.id)return; e.preventDefault(); card.classList.add('subject-drag-over'); });
    card.addEventListener('dragleave',function(){ card.classList.remove('subject-drag-over'); });
    card.addEventListener('drop',function(e){
      card.classList.remove('subject-drag-over'); if(!dragSubjectId||dragSubjectId===subject.id) return; e.preventDefault();
      var fi=data.subjects.findIndex(function(s){ return s.id===dragSubjectId; }), ti=data.subjects.findIndex(function(s){ return s.id===subject.id; });
      if(fi!==-1&&ti!==-1){
        // If dragged out of a folder to a top-level position, remove from folder
        var draggedS = data.subjects[fi];
        if (draggedS && draggedS.folderId) {
          var srcFolder = data.folders.find(function(f){ return f.id===draggedS.folderId; });
          if (srcFolder) srcFolder.subjectIds = srcFolder.subjectIds.filter(function(id){ return id!==draggedS.id; });
          draggedS.folderId = null;
        }
        data.subjects.splice(ti,0,data.subjects.splice(fi,1)[0]); save(); render();
      }
    });
    card.appendChild(header); card.appendChild(notesList); return card;
  }

  // ── Folder Card ──────────────────────────────────────────────────────────────
  function buildFolderCard(folder) {
    var isOpen = expandedFolder === folder.id;
    var card = el('div', 'folder-card' + (isOpen ? ' folder-card-expanded' : ''));
    card.dataset.id = folder.id;

    // Header
    var header = el('div', 'folder-card-header');
    var chev = el('span', 'subject-chevron'); chev.textContent = '▶';
    var icon = el('span', 'folder-icon'); icon.textContent = '📁';
    var nameEl = el('span', 'subject-name'); nameEl.textContent = folder.name;
    nameEl.style.cssText = 'font-weight:700;flex:1;';
    var count = el('span', 'subject-count');
    count.textContent = folder.subjectIds.length + ' subject' + (folder.subjectIds.length !== 1 ? 's' : '');
    if (!folder.subjectIds.length) count.classList.add('subject-count-empty');

    var left = el('div', 'subject-header-left');
    [chev, icon, nameEl, count].forEach(function(x){ left.appendChild(x); });

    var right = el('div', 'subject-header-right');
    right.appendChild(btn('✎', function(e){
      e.stopPropagation();
      var n = prompt('Folder name:', folder.name); if (n && n.trim()) { folder.name = n.trim(); save(); render(); }
    }));
    var del = btn('✕', function(e){
      e.stopPropagation();
      if (!confirm('Delete folder "' + folder.name + '"? Subjects inside will be moved back to the top level.')) return;
      folder.subjectIds.forEach(function(sid){
        var s = data.subjects.find(function(s){ return s.id === sid; });
        if (s) s.folderId = null;
      });
      data.folders = data.folders.filter(function(f){ return f.id !== folder.id; });
      if (expandedFolder === folder.id) expandedFolder = null;
      save(); render();
    }); del.classList.add('notes-btn-danger'); right.appendChild(del);

    header.appendChild(left); header.appendChild(right);

    // Contents
    var contents = el('div', 'folder-contents');
    contents.style.display = isOpen ? 'grid' : 'none';
    if (isOpen) contents.classList.add('is-open');

    if (isOpen) {
      var folderSubjects = folder.subjectIds.map(function(sid){
        return data.subjects.find(function(s){ return s.id === sid; });
      }).filter(Boolean);
      if (folderSubjects.length) {
        folderSubjects.forEach(function(s){ contents.appendChild(buildSubjectCard(s)); });
      } else {
        var empty = el('div', 'folder-empty'); empty.textContent = 'Drag subjects here to add them';
        contents.appendChild(empty);
      }
    }

    // Drop zone — drag subject onto folder
    card.addEventListener('dragover', function(e){
      if (!dragSubjectId || dragSubjectId === folder.id) return;
      // Don't allow if it's a folder being dragged
      if (data.folders.find(function(f){ return f.id === dragSubjectId; })) return;
      e.preventDefault(); card.classList.add('folder-drag-over');
    });
    card.addEventListener('dragleave', function(){ card.classList.remove('folder-drag-over'); });
    card.addEventListener('drop', function(e){
      card.classList.remove('folder-drag-over');
      if (!dragSubjectId) return;
      if (data.folders.find(function(f){ return f.id === dragSubjectId; })) return;
      e.preventDefault();
      var sid = dragSubjectId;
      // Remove from any existing folder
      data.folders.forEach(function(f){ f.subjectIds = f.subjectIds.filter(function(id){ return id !== sid; }); });
      // Add to this folder
      var subject = data.subjects.find(function(s){ return s.id === sid; });
      if (subject) subject.folderId = folder.id;
      if (folder.subjectIds.indexOf(sid) === -1) folder.subjectIds.push(sid);
      expandedFolder = folder.id;
      save(); render(); toast('Added to "' + folder.name + '"');
    });

    header.addEventListener('click', function(e){
      if (e.target.closest('button')) return;
      if (expandedFolder === folder.id) {
        contents.classList.remove('is-open'); contents.classList.add('is-closing');
        setTimeout(function(){ expandedFolder = null; render(); }, 280);
      } else {
        expandedFolder = folder.id; render();
      }
    });

    card.appendChild(header); card.appendChild(contents); return card;
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  function render() {
    var list=document.getElementById('subjectList'); if(!list) return;
    var pageScroll=document.documentElement.scrollTop||window.scrollY||0, scroller=getScroller(), innerScroll=scroller?scroller.scrollTop:0;
    var term=((document.getElementById('searchBar')||{}).value||'').toLowerCase().trim();
    list.innerHTML='';
    var visible=term?data.subjects.filter(function(s){ return s.name.toLowerCase().includes(term)||s.notes.some(function(n){ return n.content.toLowerCase().includes(term); }); }):data.subjects;
    // Render folders first
    var folderedIds = {};
    data.folders.forEach(function(f){ f.subjectIds.forEach(function(id){ folderedIds[id]=true; }); });
    var filteredFolders = term ? data.folders.filter(function(f){
      return f.name.toLowerCase().includes(term) || f.subjectIds.some(function(sid){
        var s = data.subjects.find(function(s){ return s.id===sid; });
        return s && (s.name.toLowerCase().includes(term) || s.notes.some(function(n){ return n.content.toLowerCase().includes(term); }));
      });
    }) : data.folders;
    filteredFolders.forEach(function(f){ list.appendChild(buildFolderCard(f)); });
    // Then ungrouped subjects
    // Allow dropping subjects onto the subjectList background to remove from folder
    list.addEventListener('dragover', function(e){
      if (!dragSubjectId) return;
      if (data.folders.find(function(f){ return f.id === dragSubjectId; })) return;
      var subject = data.subjects.find(function(s){ return s.id === dragSubjectId; });
      if (!subject || !subject.folderId) return;
      e.preventDefault();
    });
    list.addEventListener('drop', function(e){
      if (!dragSubjectId) return;
      var subject = data.subjects.find(function(s){ return s.id === dragSubjectId; });
      if (!subject || !subject.folderId) return;
      e.preventDefault();
      data.folders.forEach(function(f){ f.subjectIds = f.subjectIds.filter(function(id){ return id !== subject.id; }); });
      subject.folderId = null;
      save(); render(); toast('Moved out of folder');
    });
    var ungrouped = visible.filter(function(s){ return !folderedIds[s.id]; });
    ungrouped.forEach(function(s){ list.appendChild(buildSubjectCard(s)); });
    var eb=document.getElementById('exportbutton'); if(eb) eb.style.display=data.subjects.length?'':'none';
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ if(pageScroll>0) document.documentElement.scrollTop=pageScroll; var ns=getScroller(); if(ns&&innerScroll>0) ns.scrollTop=innerScroll; }); });
  }

  // ── Show / Hide ───────────────────────────────────────────────────────────────
  function showNotes() {
    var mc=document.getElementById('mainContent'); if(mc) mc.style.display='none';
    var mc2=document.getElementById('mainContainer'); if(mc2) mc2.classList.add('notes-active');
    var ns=document.querySelector('.notes-section');
    if(ns){ ns.style.opacity='0'; ns.style.display='flex'; requestAnimationFrame(function(){ ns.style.transition='opacity 0.4s ease'; ns.style.opacity='1'; }); }
    var show=document.getElementById('showNotes'), hide=document.getElementById('hideNotes');
    if(show) show.style.display='none'; if(hide) hide.style.display='inline-block';
    updateStorageMeter();
  }
  function hideNotes() {
    var ns=document.querySelector('.notes-section');
    function restore(){ var mc2=document.getElementById('mainContainer'); if(mc2) mc2.classList.remove('notes-active'); var mc=document.getElementById('mainContent'); if(mc) mc.style.display='block'; var show=document.getElementById('showNotes'), hide=document.getElementById('hideNotes'); if(show) show.style.display='inline-block'; if(hide) hide.style.display='none'; }
    if(ns){ ns.style.transition='opacity 0.4s ease'; ns.style.opacity='0'; setTimeout(function(){ ns.style.display='none'; ns.style.opacity=''; ns.style.transition=''; restore(); },400); } else restore();
  }

  // ── Init ──────────────────────────────────────────────────────────────────────
  function init() {
    load();
    var addBtn=document.getElementById('addSubjectBtn'); if(addBtn) addBtn.addEventListener('click',openNewSubjectModal);
    var sb=document.getElementById('searchBar'); if(sb) sb.addEventListener('input',render);
    var expBtn=document.getElementById('exportbutton'); if(expBtn) expBtn.addEventListener('click',exportJSON);
    var expCont=document.getElementById('exportButtonContainer');
    if(expCont&&!document.getElementById('importNotesBtn')){
      var impBtn=document.createElement('button'); impBtn.id='importNotesBtn'; impBtn.textContent='Import'; impBtn.className='notes-btn notes-btn-primary';
      impBtn.addEventListener('click',function(){ var i=document.createElement('input'); i.type='file'; i.accept='.json'; i.onchange=function(e){ if(e.target.files[0]) importJSON(e.target.files[0]); }; i.click(); });
      expCont.appendChild(impBtn);
    }
    var ns=document.querySelector('.notes-section');
    if(ns&&!document.querySelector('.notes-top-bar')){
      var bar=document.createElement('div'); bar.className='notes-top-bar';
      [document.getElementById('searchBar'),document.getElementById('addSubjectBtn'),document.getElementById('exportButtonContainer'),document.getElementById('hideNotes')].forEach(function(e){ if(e) bar.appendChild(e); });
      var fbBtn=document.createElement('button'); fbBtn.id='firebaseConnectBtn'; fbBtn.className='notes-btn firebase-connect-btn';
      var fs=getFS(); if(fs&&fs.isConfigured()){ fbBtn.textContent='🔥 Connected'; fbBtn.classList.add('firebase-connected'); } else{ fbBtn.textContent='🔥 Share'; }
      fbBtn.addEventListener('click',function(){ var fs=getFS(); if(fs&&fs.isReady) showFirebaseOptionsModal(); else openFirebaseSetupModal(null); });
      bar.appendChild(fbBtn);
      var folderBtn = document.createElement('button');
      folderBtn.className = 'notes-btn firebase-connect-btn'; folderBtn.textContent = '📁';
      folderBtn.title = 'New folder'; folderBtn.style.fontSize = '15px';
      folderBtn.addEventListener('click', function(){
        var name = prompt('Folder name:'); if (!name || !name.trim()) return;
        if (!data.folders) data.folders = [];
        data.folders.push({ id: uid(), name: name.trim(), subjectIds: [] });
        save(); render();
      });
      bar.appendChild(folderBtn);
      var meter=document.createElement('div'); meter.id='notes-storage-meter'; meter.style.cssText='font-size:11px;font-weight:600;white-space:nowrap;padding:3px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);margin-left:auto;flex-shrink:0;display:inline-block';
      bar.appendChild(meter); ns.insertBefore(bar,ns.firstChild); updateStorageMeter();
    }
    if(ns) ns.style.display='none';
    var mc=document.getElementById('mainContent'); if(mc) mc.style.display='block';
    var show=document.getElementById('showNotes'), hide=document.getElementById('hideNotes');
    if(show){ show.style.display='inline-block'; show.addEventListener('click',showNotes); }
    if(hide){ hide.style.display='none'; hide.addEventListener('click',hideNotes); }
    document.addEventListener('firebase-ready',function(){
      var b=document.getElementById('firebaseConnectBtn'); if(b){ b.textContent='🔥 Connected'; b.classList.add('firebase-connected'); }
      var fs=getFS(); if(fs) fs.clearListeners(); FB_LISTEN_ACTIVE={};
      data.subjects.forEach(function(s){ if(s.shareId) attachShareListener(s); });
    });
    document.addEventListener('firebase-share-open',function(e){
      var shareId=e.detail.shareId, fs=getFS();
      if(!fs||!fs.isReady){ setTimeout(function(){ openSharedView(shareId); },1000); } else{ openSharedView(shareId); }
    });
    startSync(); render();
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
