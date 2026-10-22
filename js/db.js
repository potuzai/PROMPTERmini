'use strict';
/* ===== Lokální úložiště (IndexedDB) + výchozí data ===== */
const APP_VERSION = '1.25.0';
const DB_NAME = 'prompter-pisne';
const DB_VER = 2;
const STORES = ['songs', 'playlists', 'templates', 'config', 'meta'];

const DEFAULT_SINGERS = [
  { code: 'J', name: 'Já', color: '#ffd23f', bold: false, italic: false },
  { code: 'T', name: 'Ty', color: '#4fc3f7', bold: false, italic: false },
  { code: 'V', name: 'Všichni', color: '#7CFC9A', bold: true, italic: false },
];

/* Výchozí šablona = „Hlavní čtečka“ kapely (platí i bez přihlášení ke kapele) */
const DEFAULT_TEMPLATE = {
  id: 'default', name: 'Hlavní čtečka',
  fontFamily: 'Roboto', fontSize: 43, fontWeight: 600, lineHeight: 1, letterSpacing: 0,
  align: 'center', uppercase: true,
  textColor: '#ffffff', bgColor: '#000000',
  sectionColor: '#8a8a8a', sectionScale: 0.5, showSections: false,
  noteColor: '#b0b0b0', showNotes: true,
  padX: 0, padY: 0, columns: 1, colGap: 30, stanzaGap: 0.1,
  // označení zpěváka: proužek vlevo / vpravo, podbarvení řádku, barva písma (libovolná kombinace; píseň může přepsat)
  singerText: false, singerBar: true, singerBarRight: false, singerBg: false, barWidth: 15,
  // barva textu podle části písně (zpěvák ji přebije jen se zapnutým „Písmo“)
  verseColor: '#ffffff', chorusColor: '#ffff00', bridgeColor: '#33ff33',
  instrColor: '#ff0000',   // předehra, mezihra, sólo a počet opakování sekce
  onePage: true,   // zakázat více stránek: písmo se zmenší, aby se píseň vešla na 1 stránku
  fit: 'shrink', minScale: 0.6,
  showHeader: true, showFooter: false, headerSize: 25, headerColor: '#9e9e9e',
  mirror: 'none',
};
// zrušené vestavěné šablony starších verzí – smažou se všude (i ze sdílených dat kapely)
const DROPPED_TEMPLATES = ['casti-pisne', 'velke-stred', 'svetla', 'dva-sloupce'];

const DEFAULT_SETTINGS = {
  screenW: 1080, screenH: 1920, diagonal: 24, distance: 2.5,   // výchozí: 24" monitor na výšku
  readerRotate: 0,               // otočení obrazu čtečky (když Windows obrazovku neotáčí)
  readerFullscreen: true,        // čtečka automaticky přes celou obrazovku
  startInReader: false,          // po otevření aplikace rovnou čtečka (pro PC čtečky)
  swapMouse: false,              // prohodit levé/pravé tlačítko myši
  wheelNav: false,               // listovat kolečkem myši
  hideCursor: true,
  readerSyncOnStart: true,
  readerZoom: 1,                 // osobní zvětšení písma ve čtečce (1 = 100 %)
  defaultTemplate: 'default',
  lastPlaylist: null,
  pinHash: '',                   // PIN pro úpravy (prázdné = bez PINu)
  userName: '',
  autoSync: true,
  sharedFolder: '',              // sdílená složka (Mega, Proton Drive…)
  mega: { email: '', pass: '', folder: 'PROMPTERmini', folderId: '' },   // folderId = zapamatovaná složka kapely v Mega
  readOnly: false,               // jen stahovat (např. čtečka)
  welcomed: false,
  rememberBand: true,            // „Zůstat přihlášen“ – false = heslo kapely jen do zavření prohlížeče
  deviceRole: '',                // k čemu zařízení slouží: reader | editor | both (nastaví průvodce)
  theme: 'dark',                 // vzhled aplikace: dark | light | auto (podle systému)
  screenId: '',                  // kterou obrazovkou kapely je toto zařízení; '' = program: hlavní čtečka, web: podle okna
  mySinger: '', highlightMine: false, // zvýraznit řádky, které zpívám já
  privateNotes: {},              // soukromé poznámky k písním (jen toto zařízení)
  gh: { owner: '', repo: '', branch: 'main', token: '', login: '', canPush: null },
  lastSyncAt: '',                // poslední úspěšná synchronizace (ISO)
  songSort: 'artist', plSort: 'new', plCols: false, editScreen: '', printOpts: null,   // poslední volby v seznamech, editoru a tisku
};
const OBSOLETE_SETTINGS = ['bandName', 'bandLink', 'editorFontSize', 'pasteClean'];   // klíče zrušených funkcí

const SHARED_DISPLAY_KEYS = ['screenW', 'screenH', 'diagonal', 'distance'];

const Settings = {
  _key: 'prompter-settings',
  data: null,
  load() {
    let s = {};
    try { s = JSON.parse((window.native ? window.native.loadSettings() : localStorage.getItem(this._key)) || '{}'); } catch (e) { s = {}; }
    this.data = Object.assign(clone(DEFAULT_SETTINGS), s);
    this.data.gh = Object.assign(clone(DEFAULT_SETTINGS.gh), s.gh || {});
    for (const k of OBSOLETE_SETTINGS) delete this.data[k];
    return this.data;
  },
  save() {
    const txt = JSON.stringify(this.data);
    if (window.native) window.native.saveSettings(txt); else localStorage.setItem(this._key, txt);
  },
  get(k) {
    // Rozměr monitoru čtečky je sdílený pro celou kapelu (ukládá se se sdílenými daty)
    if (SHARED_DISPLAY_KEYS.includes(k) && typeof Store !== 'undefined') {
      const d = Store.config.get('display');
      if (d && d[k] !== undefined) return d[k];
    }
    // „nepamatovat si na tomto zařízení“: heslo / token kapely jen do zavření prohlížeče
    if (k === 'mega' && this.data.rememberBand === false) {
      try { const sec = JSON.parse(sessionStorage.getItem('prompter-secret-' + k) || 'null'); if (sec) return Object.assign({}, this.data[k], sec); } catch (e) { /* nic */ }
    }
    return this.data[k];
  },
  set(k, v) {
    this.data[k] = v; this.save();
    if (SHARED_DISPLAY_KEYS.includes(k) && typeof Store !== 'undefined' && Store.ready) {
      const d = Object.assign({ id: 'display', portraitMigrated: true }, Store.config.get('display') || {});
      if (d[k] !== v) { d[k] = v; Store.put('config', d, { silent: true }); }
    }
  },
};

const IDB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = () => {
        const db = r.result;
        for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      };
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  all(store) {
    return new Promise((res, rej) => {
      const r = this.db.transaction(store).objectStore(store).getAll();
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  },
  put(store, obj) {
    return new Promise((res, rej) => {
      const tx = this.db.transaction(store, 'readwrite');
      tx.objectStore(store).put(obj);
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
  },
  del(store, id) {
    return new Promise((res, rej) => {
      const tx = this.db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
  },
};

/* Program pro Windows (Electron): data jako soubory ve složce */
const NativeBackend = {
  async open() { return true; },
  async all(store) { return window.native.all(store); },
  async put(store, obj) { return window.native.put(store, obj); },
  async del(store, id) { return window.native.del(store, id); },
};
const Backend = window.native ? NativeBackend : IDB;

/* ===== Datový model aplikace ===== */
const TYPES = {
  songs: { dir: 'songs' },
  playlists: { dir: 'playlists' },
  templates: { dir: 'templates' },
  config: { dir: 'config' },
};

/* Nové položky – výchozí pole na jednom místě */
const newSong = o => Object.assign({ id: uid(), title: 'Nová píseň', artist: '', key: '', tempo: '', duration: '', templateId: '', text: '' }, o);
const newPlaylist = (name, items = []) => ({ id: uid(), name, date: new Date().toISOString().slice(0, 10), note: '', items });
const playlistNameHint = () => 'Koncert ' + new Date().toLocaleDateString('cs-CZ');

const Store = {
  songs: new Map(), playlists: new Map(), templates: new Map(), config: new Map(),
  // remote: cesta → verze v úložišti, local: cesta → otisk obsahu při poslední synchronizaci, trash: co smazala synchronizace (lze obnovit)
  meta: { id: 'sync', remote: {}, local: {}, tombstones: {}, trash: [] },
  listeners: new Set(),

  async init() {
    await Backend.open();
    for (const t of Object.keys(TYPES)) {
      for (const o of await Backend.all(t)) this[t].set(o.id, o);
    }
    const metas = await Backend.all('meta');
    const m = metas.find(x => x.id === 'sync');
    if (m) this.meta = Object.assign(this.meta, m);
    // Výchozí data při prvním spuštění
    if (!this.config.has('singers')) await this.put('config', { id: 'singers', list: clone(DEFAULT_SINGERS) }, { silent: true, noStamp: true });
    if (this.templates.size === 0) {
      await this.put('templates', clone(DEFAULT_TEMPLATE), { silent: true, noStamp: true });
    }
    await this.dropOldTemplates();
    // ukázková píseň jen bez kapely – do sdíleného úložiště nepatří
    if (this.songs.size === 0 && !['mega', 'github', 'folder'].includes(Settings.get('syncMode')) && !Settings.get('gh').repo) await this.put('songs', sampleSong(), { silent: true });
    // Starší verze měly výchozí monitor na šířku – čtečka kapely je na výšku
    const disp = this.config.get('display');
    if (disp && !disp.portraitMigrated) {
      if ((disp.screenW || 0) > (disp.screenH || 0)) { const w = disp.screenW; disp.screenW = disp.screenH; disp.screenH = w; }
      disp.portraitMigrated = true;
      await this.put('config', disp, { silent: true });
    }
    const ls = Settings.data;
    if (!ls.portraitMigrated) { if (ls.screenW > ls.screenH) { const w = ls.screenW; ls.screenW = ls.screenH; ls.screenH = w; } ls.portraitMigrated = true; Settings.save(); }
    this.ready = true;
  },

  /* zrušené vestavěné šablony smazat (i po stažení ze sdílených dat); písně a playlisty s nimi přejdou na výchozí */
  async dropOldTemplates() {
    for (const id of DROPPED_TEMPLATES) if (this.templates.has(id)) await this.remove('templates', id, { silent: true });
    if (DROPPED_TEMPLATES.includes(Settings.get('defaultTemplate'))) Settings.set('defaultTemplate', 'default');
  },

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit(type, id) { for (const fn of this.listeners) try { fn(type, id); } catch (e) { console.error(e); } },

  path(type, id) { return `data/${TYPES[type].dir}/${id}.json`; },

  async put(type, obj, opts = {}) {
    if (!obj.id) obj.id = uid();
    if (!opts.noStamp) {
      obj.updatedAt = new Date().toISOString();
      obj.updatedBy = currentUserName();
    }
    this[type].set(obj.id, obj);
    await Backend.put(type, obj);
    const p = this.path(type, obj.id);
    if (this.meta.tombstones[p]) { delete this.meta.tombstones[p]; await this.saveMeta(); }
    if (!opts.silent) this.emit(type, obj.id);
    if (!opts.fromSync) Sync.schedule();
    return obj;
  },

  async remove(type, id, opts = {}) {
    this[type].delete(id);
    await Backend.del(type, id);
    const p = this.path(type, id);
    if (!opts.fromSync && this.meta.remote[p]) { this.meta.tombstones[p] = true; }
    if (opts.fromSync) { delete this.meta.remote[p]; delete this.meta.local[p]; }
    await this.saveMeta();
    if (!opts.silent) this.emit(type, id);
    if (!opts.fromSync) Sync.schedule();
  },

  async saveMeta() { await Backend.put('meta', this.meta); },

  /* Zpěváci: píseň (style.singers) > šablona (singers) > původní společný seznam kapely.
     src = píseň (podle její šablony), šablona, nebo nic */
  singers(src) {
    if (src && src.style && Array.isArray(src.style.singers)) return src.style.singers;
    if (src && Array.isArray(src.singers)) return src.singers;
    if (src && typeof src.text === 'string') {
      const t = this.template(src.templateId || Settings.get('defaultTemplate'));
      if (t && Array.isArray(t.singers)) return t.singers;
    }
    return (this.config.get('singers') || { list: DEFAULT_SINGERS }).list;
  },
  // všichni zpěváci ze všech šablon (např. volba „můj zpěvák“ pro zvýraznění ve čtečce)
  allSingers() {
    const m = new Map();
    for (const s of this.singers()) m.set(s.code, s);
    for (const t of this.templates.values()) for (const s of (Array.isArray(t.singers) ? t.singers : [])) if (!m.has(s.code)) m.set(s.code, s);
    return [...m.values()];
  },
  singerMap(src) { const m = {}; for (const s of this.singers(src)) m[s.code.toUpperCase()] = s; return m; },

  template(id) {
    return Object.assign(clone(DEFAULT_TEMPLATE), this.templates.get(id) || this.templates.get(Settings.get('defaultTemplate')) || this.templates.get('default') || {});
  },

  /* Výchozí řazení: interpret (kapela), pak název – vzestupně; písně bez interpreta na konci */
  sortedSongs(by = 'artist') {
    const cmp = (a, b) => String(a || '').localeCompare(String(b || ''), 'cs', { sensitivity: 'base' });
    const list = [...this.songs.values()];
    if (by === 'title') return list.sort((a, b) => cmp(a.title, b.title) || cmp(a.artist, b.artist));
    if (by === 'recent') return list.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return list.sort((a, b) => (!a.artist - !b.artist) || cmp(a.artist, b.artist) || cmp(a.title, b.title));
  },
  sortedPlaylists() {
    return [...this.playlists.values()].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (a.name || '').localeCompare(b.name || '', 'cs'));
  },

  serialize(obj) {
    const o = {};
    for (const k of Object.keys(obj)) if (!k.startsWith('_')) o[k] = obj[k];
    return JSON.stringify(o, null, 2) + '\n';
  },

  pendingCount() {
    let n = Object.keys(this.meta.tombstones).length;
    for (const t of Object.keys(TYPES)) {
      for (const o of this[t].values()) {
        const p = this.path(t, o.id);
        if (this.meta.local[p] !== gitBlobSha(this.serialize(o))) n++;
      }
    }
    return n;
  },
};

function currentUserName() {
  const gh = Settings.get('gh');
  return Settings.get('userName') || gh.login || 'místní';
}

function sampleSong() {
  return {
    id: uid(), sample: true, title: 'Ukázková píseň', artist: 'Kapela', key: 'G', tempo: 120,
    text: [
      '## Sloka 1',
      '@J Tenhle řádek zpívám já',
      '@J a barva ukazuje, kdo zrovna zpívá',
      '@T Tenhle řádek zpíváš ty',
      '@T a tenhle taky',
      '',
      '## Refrén @V',
      'Refrén zpíváme všichni',
      'celá sekce má výchozího zpěváka',
      '@J+T tady zpíváme spolu ve dvou',
      '',
      '## Sloka 2',
      '@T Slovo {J:já} uvnitř řádku má jinou barvu',
      '@J **tučně** a *kurzívou* jde zvýraznit',
      '// sem si napiš poznámku pro sebe',
      '',
      '>> Refrén',
      '// 2× a konec',
    ].join('\n'),
  };
}
