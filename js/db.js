'use strict';
/* ===== Lokální úložiště (IndexedDB) + výchozí data ===== */
const APP_VERSION = '1.23.1';
const DB_NAME = 'prompter-pisne';
const DB_VER = 2;
const STORES = ['songs', 'playlists', 'templates', 'config', 'meta'];

const DEFAULT_SINGERS = [
  { code: 'J', name: 'Já', color: '#ffd23f', bold: false, italic: false },
  { code: 'T', name: 'Ty', color: '#4fc3f7', bold: false, italic: false },
  { code: 'V', name: 'Všichni', color: '#7CFC9A', bold: true, italic: false },
];

// Nástroje – informace jen pro muzikanty (ve čtečce se nezobrazí)
const DEFAULT_INSTRUMENTS = [
  { code: 'G', name: 'Kytara', color: '#ff9f43' },
  { code: 'B', name: 'Basa', color: '#b388ff' },
  { code: 'D', name: 'Bicí', color: '#ff7eb6' },
  { code: 'K', name: 'Klávesy', color: '#4dd0e1' },
];
const CHORD_COLOR = '#ff5a4f';

const DEFAULT_TEMPLATE = {
  id: 'default', name: 'Výchozí – černé pozadí',
  fontFamily: 'Arial', fontSize: 64, fontWeight: 700, lineHeight: 1.22, letterSpacing: 0,
  align: 'left', uppercase: false,
  textColor: '#ffffff', bgColor: '#000000',
  sectionColor: '#8a8a8a', sectionScale: 0.55, showSections: true,
  noteColor: '#b0b0b0', showNotes: true,
  padX: 70, padY: 36, columns: 1, colGap: 70, stanzaGap: 0.55,
  singerText: true, singerBar: true, singerBg: false, singerBadge: false, barWidth: 14,
  // barva textu: 'singer' = podle zpěváka, 'section' = podle části písně (zpěvák jen pruhem)
  textBy: 'singer', verseColor: '#ffffff', chorusColor: '#ffff00', bridgeColor: '#33ff33',
  fit: 'shrink', minScale: 0.7,
  showHeader: true, showFooter: true, headerSize: 30, headerColor: '#9e9e9e',
  mirror: 'none',
};

const EXTRA_TEMPLATES = [
  Object.assign({}, DEFAULT_TEMPLATE, {
    id: 'casti-pisne', name: 'Barvy podle částí písně (sloka / refrén / mezičást)',
    textBy: 'section', singerText: false, singerBar: true, barWidth: 16,
  }),
  Object.assign({}, DEFAULT_TEMPLATE, {
    id: 'velke-stred', name: 'Velké písmo – na střed', fontSize: 80, align: 'center',
    singerBar: false, singerText: true, fit: 'paginate',
  }),
  Object.assign({}, DEFAULT_TEMPLATE, {
    id: 'svetla', name: 'Světlá (bílé pozadí)', bgColor: '#ffffff', textColor: '#111111',
    sectionColor: '#777777', noteColor: '#555555', headerColor: '#666666', fontWeight: 600,
    singerText: false, singerBg: true, singerBar: true,
  }),
  Object.assign({}, DEFAULT_TEMPLATE, {
    id: 'dva-sloupce', name: 'Dva sloupce – dlouhé texty', fontSize: 50, columns: 2, fit: 'shrink', minScale: 0.75,
  }),
];

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
  deviceRole: '',                // k čemu zařízení slouží: reader | editor | both | musician (nastaví průvodce)
  theme: 'dark',                 // vzhled aplikace: dark | light | auto (podle systému)
  screenId: '',                  // kterou obrazovkou kapely je toto zařízení; '' = program: hlavní čtečka, web: podle okna
  myView: null,                  // vlastní „co vidím“ ({ chords, inst: [] }); null = jako profil obrazovky
  mySinger: '', highlightMine: false, // zvýraznit řádky, které zpívám já
  privateNotes: {},              // soukromé poznámky k písním (jen toto zařízení)
  musView: { on: false, chords: true, inst: {} },   // náhled „Pro muzikanty“ – co zobrazit (jen tento počítač)
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
const newSong = o => Object.assign({ id: uid(), title: 'Nová píseň', artist: '', key: '', tempo: '', duration: '', tags: [], templateId: '', text: '' }, o);
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
    if (!this.config.has('instruments')) await this.put('config', { id: 'instruments', list: clone(DEFAULT_INSTRUMENTS) }, { silent: true, noStamp: true });
    if (this.templates.size === 0) {
      for (const t of [DEFAULT_TEMPLATE, ...EXTRA_TEMPLATES]) await this.put('templates', clone(t), { silent: true, noStamp: true });
    }
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

  singers() { return (this.config.get('singers') || { list: DEFAULT_SINGERS }).list; },
  singerMap() { const m = {}; for (const s of this.singers()) m[s.code.toUpperCase()] = s; return m; },
  instruments() { return (this.config.get('instruments') || { list: DEFAULT_INSTRUMENTS }).list; },
  instrumentMap() { const m = {}; for (const s of this.instruments()) m[s.code.toUpperCase()] = s; return m; },

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
    id: uid(), sample: true, title: 'Ukázková píseň', artist: 'Kapela', key: 'G', tempo: 120, tags: ['ukázka'],
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
