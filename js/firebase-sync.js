/**
 * firebase-sync.js — Real-time sharing for Kwells Productivity Booster
 *
 * Add to index.html:
 *   <script type="module" src="js/firebase-sync.js"></script>
 *
 * Exposes window.FirebaseSync used by notes.js
 */

const LS_CONFIG = 'kwells_firebase_config';
const LS_NAME   = 'kwells_user_name';
const LS_DEVICE = 'kwells_device_id';

// ── Public config — used automatically for share link recipients ──────────────
// This is NOT a secret. Firebase security comes from Rules, not hiding this config.
const SHARE_CONFIG = {
  apiKey:            "AIzaSyDakHZdg0_Am_02MA0dvowIiE_5ZN2GfnY",
  authDomain:        "checklist-57adc.firebaseapp.com",
  databaseURL:       "https://checklist-57adc-default-rtdb.firebaseio.com",
  projectId:         "checklist-57adc",
  storageBucket:     "checklist-57adc.firebasestorage.app",
  messagingSenderId: "954648453505",
  appId:             "1:954648453505:web:bba04829084576c99dc880"
};

let _db      = null;
let _r       = {};          // Firebase function refs {ref, set, get, onValue, update, remove}
let _active  = {};          // shareId → unsubscribe fn
let _writing = new Set();   // shareIds being written right now (suppress self-echo)

// ── Device identity (anonymous but persistent) ────────────────────────────────
function getDeviceId() {
  let id = localStorage.getItem(LS_DEVICE);
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2, 11);
    localStorage.setItem(LS_DEVICE, id);
  }
  return id;
}

// ── Config parser ─────────────────────────────────────────────────────────────
// Accepts: full <script> paste, plain object literal, or JSON string
function parseConfig(raw) {
  raw = (raw || '').trim();

  // Full script tag paste: const firebaseConfig = { ... };
  const m = raw.match(/firebaseConfig\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (m) {
    try { return new Function('return ' + m[1])(); } catch {}
  }

  // Plain object literal { apiKey: ... }
  if (raw.startsWith('{')) {
    try { return new Function('return ' + raw)(); } catch {}
    try { return JSON.parse(raw); } catch {}
  }

  return null;
}

// ── Firebase SDK loader (dynamic import, no bundler needed) ───────────────────
async function loadSDK(config) {
  const V   = '11.1.0';
  const CDN = `https://www.gstatic.com/firebasejs/${V}`;

  const { initializeApp, getApps, getApp } = await import(`${CDN}/firebase-app.js`);
  const { getDatabase, ref, set, get, onValue, update, remove } =
        await import(`${CDN}/firebase-database.js`);

  // Avoid re-initializing on hot reloads
  const existing = getApps().find(a => a.name === 'kwells');
  const app = existing || initializeApp(config, 'kwells');

  _db = getDatabase(app);
  _r  = { ref, set, get, onValue, update, remove };
}

// ── Public API ────────────────────────────────────────────────────────────────
const FS = window.FirebaseSync = {

  isReady: false,

  // ─ Config & identity ────────────────────────────────────────────────────────

  isConfigured() {
    return !!localStorage.getItem(LS_CONFIG);
  },

  async init() {
    const raw = localStorage.getItem(LS_CONFIG);
    if (!raw) return false;
    try {
      await loadSDK(JSON.parse(raw));
      this.isReady = true;
      return true;
    } catch(e) {
      console.warn('[FirebaseSync] init error:', e);
      return false;
    }
  },

  async setup(paste) {
    const config = parseConfig(paste);
    if (!config || !config.apiKey) {
      return { ok: false, error: 'Could not read config — paste the full firebaseConfig block from Firebase.' };
    }
    if (!config.databaseURL) {
      return { ok: false, error: 'No databaseURL found. Make sure Realtime Database is enabled in your Firebase project, then paste the config again.' };
    }
    try {
      await loadSDK(config);
      localStorage.setItem(LS_CONFIG, JSON.stringify(config));
      this.isReady = true;
      return { ok: true };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  },

  clearConfig() {
    Object.keys(_active).forEach(id => this.unlisten(id));
    localStorage.removeItem(LS_CONFIG);
    this.isReady = false;
    _db = null;
    _r  = {};
  },

  getDisplayName()      { return localStorage.getItem(LS_NAME) || null; },
  setDisplayName(name)  { localStorage.setItem(LS_NAME, (name || '').trim()); },
  getDeviceId()         { return getDeviceId(); },

  getShareUrl(shareId) {
    const u = new URL(window.location.href);
    u.search = '';
    u.searchParams.set('share', shareId);
    return u.toString();
  },

  // ─ Write operations ──────────────────────────────────────────────────────────

  // Push entire subject to Firebase. Returns shareId.
  async pushSubject(subject) {
    if (!_db) return null;
    const shareId = subject.shareId || ('s' + Math.random().toString(36).slice(2, 11));

    const items = {};
    (subject.notes || []).forEach(n => {
      items[n.id] = {
        content:   n.content   || '',
        checked:   n.checked   || false,
        checkedBy: n.checkedBy || null,
        checkedAt: n.checkedAt || null,
        createdAt: n.createdAt || Date.now(),
        updatedAt: n.updatedAt || Date.now()
      };
    });

    _writing.add(shareId);
    await _r.set(_r.ref(_db, `shared/${shareId}`), {
      meta: {
        name:      subject.name,
        type:      subject.type || 'notes',
        ownerId:   getDeviceId(),
        updatedAt: Date.now()
      },
      items
    });
    setTimeout(() => _writing.delete(shareId), 100);
    return shareId;
  },

  async updateItem(shareId, itemId, changes) {
    if (!_db) { console.warn('[FS] updateItem() called but _db is null'); return; }
    console.log('[FS] updateItem()', shareId, itemId, changes);
    _writing.add(shareId);
    try {
      await _r.update(_r.ref(_db, `shared/${shareId}/items/${itemId}`), {
        ...changes,
        updatedAt: Date.now()
      });
      console.log('[FS] updateItem() success');
    } catch(e) {
      console.error('[FS] updateItem() FAILED:', e.message);
    }
    setTimeout(() => _writing.delete(shareId), 100);
  },

  async addItem(shareId, item) {
    if (!_db) return;
    _writing.add(shareId);
    await _r.set(_r.ref(_db, `shared/${shareId}/items/${item.id}`), {
      content:   item.content   || '',
      checked:   item.checked   || false,
      checkedBy: item.checkedBy || null,
      checkedAt: item.checkedAt || null,
      createdAt: item.createdAt || Date.now(),
      updatedAt: item.updatedAt || Date.now()
    });
    setTimeout(() => _writing.delete(shareId), 100);
  },

  async removeItem(shareId, itemId) {
    if (!_db) return;
    _writing.add(shareId);
    await _r.remove(_r.ref(_db, `shared/${shareId}/items/${itemId}`));
    setTimeout(() => _writing.delete(shareId), 100);
  },

  async updateMeta(shareId, changes) {
    if (!_db) return;
    await _r.update(_r.ref(_db, `shared/${shareId}/meta`), {
      ...changes,
      updatedAt: Date.now()
    });
  },

  async getShared(shareId) {
    if (!_db) return null;
    const snap = await _r.get(_r.ref(_db, `shared/${shareId}`));
    return snap.val();
  },

  async deleteShared(shareId) {
    if (!_db) return;
    this.unlisten(shareId);
    await _r.remove(_r.ref(_db, `shared/${shareId}`));
  },

  // ─ Real-time listener ────────────────────────────────────────────────────────

  listen(shareId, callback) {
    if (!_db) { console.warn('[FS] listen() called but _db is null — not initialized'); return; }
    // Always unlisten first to avoid duplicates
    if (_active[shareId]) {
      console.log('[FS] listen() — replacing existing listener for', shareId);
      _active[shareId]();
      delete _active[shareId];
    }
    console.log('[FS] Attaching onValue listener for shareId:', shareId);
    const unsub = _r.onValue(_r.ref(_db, `shared/${shareId}`), snap => {
      const val = snap.val();
      console.log('[FS] onValue fired for', shareId, '| _writing suppressed?', _writing.has(shareId), '| data:', val ? 'present' : 'null');
      // Only suppress if WE are actively writing right now (prevents echo)
      if (_writing.has(shareId)) {
        console.log('[FS] Suppressing echo for', shareId);
        return;
      }
      console.log('[FS] Passing data to callback for', shareId);
      callback(val);
    });
    _active[shareId] = unsub;
    console.log('[FS] Listener attached. Active listeners:', Object.keys(_active));
  },

  unlisten(shareId) {
    if (_active[shareId]) {
      console.log('[FS] Detaching listener for', shareId);
      _active[shareId]();
      delete _active[shareId];
    }
  },

  // Clear all active listeners — call this before re-attaching
  clearListeners() {
    console.log('[FS] clearListeners() — clearing:', Object.keys(_active));
    Object.keys(_active).forEach(id => {
      if (_active[id]) _active[id]();
    });
    _active = {};
  }
};

// ── Auto-init on load ─────────────────────────────────────────────────────────
const shareId = new URLSearchParams(window.location.search).get('share');

FS.init().then(async ok => {
  console.log('[FS] init() result:', ok, '| shareId in URL:', shareId);
  // If not configured locally but a share link is present, use the public config
  if (!ok && shareId) {
    console.log('[FS] No personal config — loading public SHARE_CONFIG for recipient');
    try {
      await loadSDK(SHARE_CONFIG);
      FS.isReady = true;
      ok = true;
      console.log('[FS] SHARE_CONFIG loaded successfully');
    } catch(e) {
      console.error('[FS] Could not load public config:', e);
    }
  }

  if (ok) {
    console.log('[FS] Dispatching firebase-ready');
    document.dispatchEvent(new CustomEvent('firebase-ready'));
  }

  if (shareId) {
    const dispatch = () =>
      document.dispatchEvent(new CustomEvent('firebase-share-open', { detail: { shareId } }));

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(dispatch, 300));
    } else {
      setTimeout(dispatch, 300);
    }
  }
});
