'use strict';
/* Program čtečky pro Windows (Electron).
   Data = obyčejné JSON soubory ve složce „data“ vedle programu (nebo v profilu uživatele). */
const { app, BrowserWindow, ipcMain, shell, powerSaveBlocker, Menu, screen, dialog, safeStorage } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// PROMPTER_DATA_DIR = vlastní složka dat (testy, více instancí)
if (process.env.PROMPTER_DATA_DIR) app.setPath('userData', path.join(process.env.PROMPTER_DATA_DIR, '_profil'));
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

const STORES = ['songs', 'playlists', 'templates', 'config'];
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

function pickDataDir() {
  // Přenosný režim: složka „data“ vedle PROMPTER mini.exe (lze zkopírovat na flashku)
  const candidates = [];
  if (process.env.PROMPTER_DATA_DIR) candidates.push(process.env.PROMPTER_DATA_DIR);
  if (app.isPackaged) candidates.push(path.join(path.dirname(process.execPath), 'data'));
  else candidates.push(path.join(__dirname, '..', 'local-data'));
  candidates.push(path.join(app.getPath('userData'), 'data'));
  for (const d of candidates) {
    try {
      fs.mkdirSync(d, { recursive: true });
      const t = path.join(d, '.write-test');
      fs.writeFileSync(t, 'ok'); fs.unlinkSync(t);
      return d;
    } catch (e) { /* zkusit další */ }
  }
  throw new Error('Nelze najít zapisovatelnou složku pro data');
}
const DATA = pickDataDir();
const SETTINGS_FILE = path.join(DATA, 'settings.json');
const META_FILE = path.join(DATA, '.sync', 'meta.json');
for (const s of STORES) fs.mkdirSync(path.join(DATA, s), { recursive: true });
fs.mkdirSync(path.dirname(META_FILE), { recursive: true });

/* Bezpečný zápis: dočasný soubor → fsync → přejmenování (odolné proti výpadku proudu) */
function writeAtomic(file, text, tmp = file + '.tmp') {
  const fd = fs.openSync(tmp, 'w');
  try { fs.writeSync(fd, text, null, 'utf8'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) {
    // poškozený soubor – zkusit nedokončený dočasný zápis
    try { return JSON.parse(fs.readFileSync(file + '.tmp', 'utf8')); } catch (e2) { return null; }
  }
}
function storeFile(store, id) {
  if (!STORES.includes(store) || !ID_RE.test(id)) throw new Error('Neplatná cesta: ' + store + '/' + id);
  return path.join(DATA, store, id + '.json');
}

/* Denní záloha (posledních 14 dní) do data/zalohy */
function dailyBackup() {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const dir = path.join(DATA, 'zalohy', day);
    if (fs.existsSync(dir)) return;
    for (const s of STORES) {
      fs.mkdirSync(path.join(dir, s), { recursive: true });
      for (const f of fs.readdirSync(path.join(DATA, s))) if (f.endsWith('.json')) fs.copyFileSync(path.join(DATA, s, f), path.join(dir, s, f));
    }
    const all = fs.readdirSync(path.join(DATA, 'zalohy')).sort();
    for (const old of all.slice(0, Math.max(0, all.length - 14))) fs.rmSync(path.join(DATA, 'zalohy', old), { recursive: true, force: true });
  } catch (e) { console.error('Záloha selhala', e); }
}

/* IPC přijímá jen vlastní stránka aplikace (index.html), ne jiná okna ani cizí obsah */
const APP_URL = decodeURI(require('url').pathToFileURL(path.join(__dirname, '..', 'index.html')).href).toLowerCase();
const isApp = url => { try { return decodeURI(String(url || '').split(/[?#]/)[0]).toLowerCase() === APP_URL; } catch (err) { return false; } };
const trusted = e => { if (!isApp(e.senderFrame && e.senderFrame.url)) throw new Error('Nepovolený odesílatel'); };
const handle = (ch, fn) => ipcMain.handle(ch, (e, ...a) => { trusted(e); return fn(e, ...a); });
const onSync = (ch, fn) => ipcMain.on(ch, (e, ...a) => { try { trusted(e); } catch (err) { e.returnValue = null; return; } fn(e, ...a); });

handle('all', (e, store) => {
  if (store === 'meta') { const m = readJson(META_FILE); return m ? [m] : []; }
  if (!STORES.includes(store)) return [];
  const out = [];
  for (const f of fs.readdirSync(path.join(DATA, store))) {
    if (!f.endsWith('.json')) continue;
    const o = readJson(path.join(DATA, store, f));
    if (o && o.id) out.push(o);
  }
  return out;
});
handle('put', (e, store, obj) => {
  if (store === 'meta') return writeAtomic(META_FILE, JSON.stringify(obj));
  writeAtomic(storeFile(store, obj.id), JSON.stringify(obj, null, 2) + '\n');
});
handle('del', (e, store, id) => { try { fs.unlinkSync(storeFile(store, id)); } catch (err) { if (err.code !== 'ENOENT') throw err; } });
onSync('loadSettings', e => { try { e.returnValue = fs.readFileSync(SETTINGS_FILE, 'utf8'); } catch (err) { e.returnValue = null; } });
onSync('saveSettings', (e, txt) => { try { writeAtomic(SETTINGS_FILE, txt); e.returnValue = true; } catch (err) { e.returnValue = false; } });
handle('openDataDir', () => shell.openPath(DATA));
/* Uložit soubor do zařízení (systémové okno Uložit); PDF = stránka připravená k tisku */
async function askSavePath(e, name) {
  const ext = path.extname(name).slice(1) || '*';
  const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { defaultPath: path.join(app.getPath('documents'), path.basename(String(name))), filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
  return r.canceled ? null : r.filePath;
}
handle('saveFile', async (e, name, bytes) => {
  const file = await askSavePath(e, name);
  if (!file) return null;
  fs.writeFileSync(file, Buffer.from(bytes));
  return path.basename(file);
});
handle('savePdf', async (e, name) => {
  const file = await askSavePath(e, name);
  if (!file) return null;
  fs.writeFileSync(file, await e.sender.printToPDF({ printBackground: true, pageSize: 'A4' }));
  return path.basename(file);
});
handle('setAutoStart', (e, on) => app.setLoginItemSettings({ openAtLogin: !!on }));
onSync('getAutoStart', e => { e.returnValue = app.getLoginItemSettings().openAtLogin; });
handle('setFullscreen', (e, on) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.setFullScreen(!!on); });
onSync('isFullscreen', e => { const w = BrowserWindow.fromWebContents(e.sender); e.returnValue = !!(w && w.isFullScreen()); });
handle('quit', () => app.quit());
// do Windows: z celé obrazovky nejdřív do okna, pak minimalizovat; po obnovení z hlavního panelu zase přes celou obrazovku
let restoreFull = false;
handle('minimize', e => { const w = BrowserWindow.fromWebContents(e.sender); if (!w) return; restoreFull = w.isFullScreen(); if (restoreFull) w.setFullScreen(false); w.minimize(); });
// grafika: hardwarové vykreslování (plynulé), nebo softwarové (ovladač grafiky chybí / je na černé listině)
onSync('gpuStatus', e => { const s = app.getGPUFeatureStatus() || {}; e.returnValue = { compositing: String(s.gpu_compositing || ''), raster: String(s.rasterization || '') }; });
handle('makeShortcuts', () => makeShortcuts(true));
onSync('dataDir', e => { e.returnValue = DATA; });

/* ===== Sdílená složka (Mega, Proton Drive, OneDrive…) =====
   Struktura: <složka>/songs/*.json, playlists/, templates/, config/ – stejné soubory jako v „data“ */
const REL_RE = /^data\/(songs|playlists|templates|config)\/([A-Za-z0-9_-]+)\.json$/;
const gitSha = buf => crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + buf.length + '\0'), buf])).digest('hex');
function sharedPath(dir, rel) {
  const m = REL_RE.exec(rel);
  if (!m) throw new Error('Neplatná cesta ' + rel);
  return path.join(dir, m[1], m[2] + '.json');
}
function checkDir(dir) {
  if (!dir || !path.isAbsolute(dir)) throw new Error('Složka není nastavena');
  if (!fs.existsSync(dir)) throw new Error('Složka neexistuje nebo není dostupná: ' + dir);
}
handle('folderList', (e, dir) => {
  checkDir(dir);
  // skip = soubory, které teď nejde přečíst; keep = chybějící podsložky – nic z toho se nesmí brát jako smazané
  const files = {}, extras = [], skip = [], keep = [];
  for (const s of STORES) {
    const sub = path.join(dir, s);
    if (!fs.existsSync(sub)) { keep.push(`data/${s}/`); continue; }
    for (const f of fs.readdirSync(sub)) {
      if (f.startsWith('.') || f.startsWith('~') || !f.toLowerCase().endsWith('.json')) continue;
      const full = path.join(sub, f);
      const id = f.slice(0, -5), rel = `data/${s}/${id}.json`;
      let st; try { st = fs.statSync(full); } catch (err) { skip.push(rel); continue; }
      if (!st.isFile()) continue;
      if (/^[A-Za-z0-9_-]+$/.test(id)) {
        try { files[rel] = gitSha(fs.readFileSync(full)); } catch (err) { skip.push(rel); } // soubor se zrovna stahuje
      } else extras.push(`data/${s}/${f}`); // např. „abc (1).json“ = konfliktní kopie od úložiště
    }
  }
  return { files, extras, skip, keep };
});
function extraPath(dir, rel) {
  const m = /^data\/(songs|playlists|templates|config)\/([^/\\]+\.json)$/i.exec(rel);
  if (!m || m[2].includes('..')) throw new Error('Neplatná cesta ' + rel);
  return path.join(dir, m[1], m[2]);
}
handle('folderRead', (e, dir, rel) => {
  checkDir(dir);
  return fs.readFileSync(REL_RE.test(rel) ? sharedPath(dir, rel) : extraPath(dir, rel), 'utf8');
});
handle('folderWrite', (e, dir, rel, text) => {
  checkDir(dir);
  const file = sharedPath(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // dočasný soubor začíná tečkou → aplikace (i ostatní členové) ho při čtení ignoruje
  writeAtomic(file, text, path.join(path.dirname(file), '.' + path.basename(file) + '.tmp'));
  const readme = path.join(dir, 'CTI-ME.txt');
  if (!fs.existsSync(readme)) fs.writeFileSync(readme, 'Tuto složku spravuje aplikace PROMPTER mini.\r\nSoubory needituj ručně. Složku sdílej jen s členy kapely.\r\n');
});
handle('folderDelete', (e, dir, rel) => {
  checkDir(dir);
  const file = REL_RE.test(rel) ? sharedPath(dir, rel) : extraPath(dir, rel);
  try { fs.unlinkSync(file); } catch (err) { if (err.code !== 'ENOENT') throw err; }
});
handle('pickFolder', async e => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
    title: 'Vyber sdílenou složku pro písně (např. ve složce MEGA nebo Proton Drive)',
    properties: ['openDirectory', 'createDirectory'],
  });
  return r.canceled ? null : r.filePaths[0];
});
onSync('suggestFolders', e => {
  // Typická umístění synchronizovaných složek na Windows
  const home = app.getPath('home');
  const cands = ['MEGA', 'MEGAsync', 'Proton Drive', 'OneDrive', 'Dropbox', 'Google Drive', 'pCloud Drive'];
  const out = [];
  for (const c of cands) {
    const p = path.join(home, c);
    if (fs.existsSync(p)) out.push(p);
  }
  try { for (const f of fs.readdirSync(home)) if (/^(OneDrive|Proton Drive)/i.test(f) && !out.includes(path.join(home, f))) out.push(path.join(home, f)); } catch (err) { /* nic */ }
  e.returnValue = out;
});
let watcher = null, watchedDir = '';
onSync('watchFolder', (e, dir) => {
  if (dir === watchedDir) return;
  if (watcher) { try { watcher.close(); } catch (err) { /* nic */ } watcher = null; }
  watchedDir = dir;
  if (!dir || !fs.existsSync(dir)) return;
  try {
    let t;
    watcher = fs.watch(dir, { recursive: true }, (ev, f) => {
      if (f && (path.basename(f).startsWith('.') || !/\.json$/i.test(f))) return;
      clearTimeout(t);
      t = setTimeout(() => { if (win && !win.isDestroyed()) win.webContents.send('folderChanged'); }, 1500);
    });
    watcher.on('error', () => { /* složka odpojena – kontroluje se i pravidelně */ });
  } catch (err) { /* fs.watch nepodporováno – stačí pravidelná kontrola */ }
});

/* ===== Zástupci (plocha a nabídka Start) =====
   Program je přenosný (složka se zipem), proto si zástupce vytvoří sám: poprvé při prvním spuštění,
   potom jen opraví ty, které vedou na starou cestu (složka přesunutá). Smazaného zástupce znovu nevnucuje. */
function makeShortcuts(force) {
  if (!app.isPackaged || process.platform !== 'win32') return { ok: false, reason: 'Jen v programu pro Windows' };
  const mark = path.join(app.getPath('userData'), 'zastupci.json');
  let done = false; try { done = JSON.parse(fs.readFileSync(mark, 'utf8')).created; } catch (err) { /* poprvé */ }
  const target = process.execPath;
  const opts = { target, cwd: path.dirname(target), description: 'PROMPTER mini – čtečka a editor textů písní', icon: target, iconIndex: 0 };
  const links = [path.join(app.getPath('desktop'), 'PROMPTER mini.lnk'), path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'PROMPTER mini.lnk')];
  let made = 0;
  for (const l of links) {
    try {
      if (force || !done) { if (shell.writeShortcutLink(l, fs.existsSync(l) ? 'replace' : 'create', opts)) made++; }
      else if (fs.existsSync(l) && shell.readShortcutLink(l).target !== target) shell.writeShortcutLink(l, 'replace', opts);
    } catch (err) { console.error('Zástupce', l, err); }
  }
  try { fs.writeFileSync(mark, JSON.stringify({ created: true })); } catch (err) { /* nevadí */ }
  return { ok: made > 0 };
}

/* ===== Mega přímo z programu ===== */
const Mega = require('./mega');
handle('megaTest', (e, cfg) => Mega.test(cfg));
handle('megaSnapshot', (e, cfg) => Mega.snapshot(cfg));
handle('megaRead', (e, cfg, p, v) => Mega.read(cfg, p, v));
handle('megaCommit', (e, cfg, up, del) => Mega.commit(cfg, up, del));
handle('megaLogout', () => Mega.logout());
handle('megaDiag', (e, cfg) => Mega.diag(cfg));

/* Šifrování hesel a tokenů v nastavení (Windows: DPAPI – rozšifruje jen tento uživatel na tomto PC) */
onSync('protect', (e, text) => {
  try {
    if (text && safeStorage.isEncryptionAvailable()) { e.returnValue = 'enc:' + safeStorage.encryptString(text).toString('base64'); return; }
  } catch (err) { /* nedostupné */ }
  e.returnValue = text ? 'b64:' + Buffer.from(text, 'utf8').toString('base64') : '';
});
onSync('unprotect', (e, val) => {
  try {
    if (!val) e.returnValue = '';
    else if (val.startsWith('enc:')) e.returnValue = safeStorage.decryptString(Buffer.from(val.slice(4), 'base64'));
    else if (val.startsWith('b64:')) e.returnValue = Buffer.from(val.slice(4), 'base64').toString('utf8');
    else e.returnValue = val;
  } catch (err) { e.returnValue = ''; }
});

let win;
function createWindow() {
  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch (e) { /* výchozí */ }
  const fullscreen = settings.readerFullscreen !== false;
  // Čtečka se otevře na monitoru, kde je kurzor (u notebooku s externím monitorem lze přetáhnout)
  const disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  win = new BrowserWindow({
    x: disp.bounds.x, y: disp.bounds.y, width: Math.min(1400, disp.workArea.width), height: Math.min(900, disp.workArea.height),
    fullscreen, backgroundColor: '#000000', autoHideMenuBar: true, show: false,
    title: 'PROMPTER mini',
    icon: path.join(__dirname, '..', 'img', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false, backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());
  win.on('restore', () => { if (restoreFull) { restoreFull = false; win.setFullScreen(true); } });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.webContents.setVisualZoomLevelLimits(1, 1);
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.control && input.shift && input.key.toLowerCase() === 'i') win.webContents.openDevTools({ mode: 'detach' });
    if (input.control && (input.key === '+' || input.key === '-' || input.key === '=' || input.key === '0')) e.preventDefault(); // bez zoomu stránky
  });
  // Odkazy (návod GitHub) do běžného prohlížeče; prázdné okno (tisk playlistu) povolit
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };   // žádná další okna (tisk i PDF běží v hlavním okně)
  });
  // zavření okna s neuloženými změnami (stránka zrušila „beforeunload“): zeptat se, jestli opravdu zavřít
  win.webContents.on('will-prevent-unload', e => {
    const r = dialog.showMessageBoxSync(win, { type: 'question', buttons: ['Zůstat', 'Zavřít bez uložení'], defaultId: 0, cancelId: 0,
      title: 'Neuložené změny', message: 'Máš neuložené změny.', detail: 'Vrať se a ulož je (Ctrl+S), nebo okno zavři a změny zahoď.' });
    if (r === 1) e.preventDefault();   // preventDefault = nechat stránku zavřít
  });
  // stránka nesmí odejít jinam: odkazy https do prohlížeče, nic jiného (ani jiné místní soubory)
  win.webContents.on('will-navigate', (e, url) => {
    if (isApp(url)) return;
    e.preventDefault();
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  });
  win.webContents.session.setPermissionRequestHandler((wc, perm, cb) => cb(perm === 'fullscreen' || perm === 'clipboard-sanitized-write'));
  // Když by se stránka zhroutila, automaticky ji obnovit
  win.webContents.on('render-process-gone', () => setTimeout(() => { if (!win.isDestroyed()) win.reload(); }, 500));
  win.webContents.on('unresponsive', () => setTimeout(() => { if (!win.isDestroyed()) win.reload(); }, 3000));
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  dailyBackup();
  makeShortcuts(false);
  powerSaveBlocker.start('prevent-display-sleep'); // monitor čtečky nikdy neusne
  createWindow();
});
app.on('window-all-closed', () => app.quit());
