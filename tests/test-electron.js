const { _electron } = require('playwright');
const fs = require('fs');
const assert = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } else console.log('ok: ' + m); };
const launch = () => _electron.launch({ args: ['--no-sandbox', require('path').join(__dirname, '..') + ''], executablePath: require('path').join(__dirname, '..', 'node_modules') + '/electron/dist/electron' });
(async () => {
  fs.rmSync(require('path').join(__dirname, '..') + '/local-data', { recursive: true, force: true });
  const app = await launch();
  const w = await app.firstWindow();
  w.on('pageerror', e => console.log('PAGEERR', e.message));
  w.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await w.waitForFunction(() => typeof Store !== 'undefined' && Store.ready, null, { timeout: 15000 });
  await w.waitForTimeout(1000);
  assert(await w.evaluate(() => Reader.isOpen()), 'program startuje rovnou do čtečky');
  assert(await w.evaluate(() => window.native.isFullscreen()), 'přes celou obrazovku');
  await w.screenshot({ path: '/tmp/claude-0/shots/8-electron-start.png' });
  await w.keyboard.press('ArrowDown'); await w.keyboard.press('Enter'); await w.waitForTimeout(500);
  await w.screenshot({ path: '/tmp/claude-0/shots/9-electron-reader.png' });
  const dir = await w.evaluate(() => window.native.dataDir);
  console.log('data dir', dir);
  await w.evaluate(async () => { await Store.put('songs', { id: 'eltest', title: 'Electron test', text: '@J ahoj' }); Settings.set('userName', 'Čtečka'); });
  await app.close();
  assert(fs.existsSync(dir + '/songs/eltest.json'), 'píseň uložena jako soubor');
  assert(JSON.parse(fs.readFileSync(dir + '/settings.json')).userName === 'Čtečka', 'nastavení v souboru');
  assert(fs.readdirSync(dir + '/zalohy').length === 1, 'denní záloha vytvořena');
  const app2 = await launch();
  const w2 = await app2.firstWindow();
  await w2.waitForFunction(() => typeof Store !== 'undefined' && Store.ready, null, { timeout: 15000 });
  assert(await w2.evaluate(() => Store.songs.get('eltest')?.title) === 'Electron test', 'data přežila restart');
  // cesta ven z programu i bez klávesy Windows (airmouse): Program v liště, ve čtečce Minimalizovat / Ukončit
  await w2.evaluate(() => { if (Reader.isOpen()) Reader.exit(); location.hash = '#/songs'; }); await w2.waitForTimeout(400);
  await w2.waitForSelector('.wizard', { timeout: 3000 }).catch(() => {});
  // okno programu po restartu nemusí mít v testu fokus – klávesu Esc dostane stránka přímo
  await w2.evaluate(() => (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  await w2.waitForTimeout(600);   // a znovu se sám neotevře
  assert(!(await w2.isVisible('.wizard')), 'průvodce jde zavřít (Esc na první stránce = Později)');
  assert(await w2.isVisible('#topbar .rail-prog'), 'v liště je Program');
  await w2.click('#topbar .rail-prog');
  assert(await w2.locator('.menu > div', { hasText: 'Minimalizovat' }).count() === 1 && await w2.locator('.menu > div', { hasText: 'Ukončit program' }).count() === 1, 'Program: minimalizovat a ukončit');
  await w2.keyboard.press('Escape');
  assert(await w2.evaluate(() => typeof window.native.minimize === 'function' && typeof window.native.makeShortcuts === 'function'), 'program umí minimalizovat a vytvořit zástupce');
  assert(await w2.evaluate(() => typeof window.native.gpuStatus().compositing === 'string'), 'program zná stav grafiky');
  // čtečka: jedno tlačítko Minimalizovat ↔ Celá obrazovka podle stavu okna
  await w2.evaluate(() => { location.hash = '#/reader/'; }); await w2.waitForTimeout(500);
  const tool = await w2.evaluate(() => [window.native.isFullscreen(), [...document.querySelectorAll('.r-start .r-tool span')].map(e => e.textContent)]);
  assert(tool[1].includes(tool[0] ? 'Minimalizovat' : 'Celá obrazovka') && !tool[1].includes(tool[0] ? 'Celá obrazovka' : 'Minimalizovat'), 'čtečka: Minimalizovat / Celá obrazovka podle stavu: ' + JSON.stringify(tool));
  // příkazy smí posílat jen stránka aplikace
  assert(await app2.evaluate(async ({ BrowserWindow }, preload) => {
    const x = new BrowserWindow({ show: false, webPreferences: { preload, sandbox: true, contextIsolation: true } });
    await x.loadURL('data:text/html,<p>cizi</p>');
    const r = await x.webContents.executeJavaScript('window.native ? window.native.all("songs").then(() => "povoleno", e => "odmítnuto") : "bez native"');
    x.destroy(); return r !== 'povoleno';
  }, require('path').join(__dirname, '..', 'electron', 'preload.js')), 'cizí stránka nedostane data programu');
  await app2.close();
})();
