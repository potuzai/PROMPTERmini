'use strict';
/* Program čtečky pro Windows (Electron).
   Data = obyčejné JSON soubory ve složce „data“ vedle programu (nebo v profilu uživatele). */
const { app, BrowserWindow, ipcMain, shell, powerSaveBlocker, Menu, screen } = require('electron');
const fs = require('fs');
const path = require('path');

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

const STORES = ['songs', 'playlists', 'templates', 'config'];
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

function pickDataDir() {
  // Přenosný režim: složka „data“ vedle Prompter.exe (lze zkopírovat na flashku)
  const candidates = [];
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
function writeAtomic(file, text) {
  const tmp = file + '.tmp';
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

ipcMain.handle('all', (e, store) => {
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
ipcMain.handle('put', (e, store, obj) => {
  if (store === 'meta') return writeAtomic(META_FILE, JSON.stringify(obj));
  writeAtomic(storeFile(store, obj.id), JSON.stringify(obj, null, 2) + '\n');
});
ipcMain.handle('del', (e, store, id) => { try { fs.unlinkSync(storeFile(store, id)); } catch (err) { if (err.code !== 'ENOENT') throw err; } });
ipcMain.on('loadSettings', e => { try { e.returnValue = fs.readFileSync(SETTINGS_FILE, 'utf8'); } catch (err) { e.returnValue = null; } });
ipcMain.on('saveSettings', (e, txt) => { try { writeAtomic(SETTINGS_FILE, txt); e.returnValue = true; } catch (err) { e.returnValue = false; } });
ipcMain.handle('openDataDir', () => shell.openPath(DATA));
ipcMain.handle('setAutoStart', (e, on) => app.setLoginItemSettings({ openAtLogin: !!on }));
ipcMain.on('getAutoStart', e => { e.returnValue = app.getLoginItemSettings().openAtLogin; });
ipcMain.handle('setFullscreen', (e, on) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.setFullScreen(!!on); });
ipcMain.on('isFullscreen', e => { const w = BrowserWindow.fromWebContents(e.sender); e.returnValue = !!(w && w.isFullScreen()); });
ipcMain.handle('quit', () => app.quit());
ipcMain.on('dataDir', e => { e.returnValue = DATA; });

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
    title: 'Prompter písní',
    icon: path.join(__dirname, '..', 'img', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: false, backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());
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
    if (/^https?:/.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, fullscreen: false } };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
  // Když by se stránka zhroutila, automaticky ji obnovit
  win.webContents.on('render-process-gone', () => setTimeout(() => { if (!win.isDestroyed()) win.reload(); }, 500));
  win.webContents.on('unresponsive', () => setTimeout(() => { if (!win.isDestroyed()) win.reload(); }, 3000));
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  dailyBackup();
  powerSaveBlocker.start('prevent-display-sleep'); // monitor čtečky nikdy neusne
  createWindow();
});
app.on('window-all-closed', () => app.quit());
