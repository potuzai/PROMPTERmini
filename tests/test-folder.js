// Test sdílené složky: dva programy (dva členové kapely) nad jednou složkou (simulace Mega/Proton Drive)
const { _electron } = require('playwright');
const fs = require('fs'); const path = require('path'); const os = require('os');
const assert = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } else console.log('ok: ' + m); };
const ROOT = path.join(__dirname, '..');
const EL = path.join(ROOT, 'node_modules/electron/dist/electron');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prompter-'));
const SHARED = path.join(tmp, 'MEGA', 'Kapela pisne');
fs.mkdirSync(SHARED, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function launch(name) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ welcomed: true, syncMode: 'folder', sharedFolder: SHARED, userName: name, readerFullscreen: false }));
  const app = await _electron.launch({ executablePath: EL, args: ['--no-sandbox', ROOT], env: { ...process.env, PROMPTER_DATA_DIR: dir } });
  const w = await app.firstWindow();
  w.on('pageerror', e => console.log(name, 'PAGEERR', e.message));
  w.on('console', m => { if (m.type() === 'error') console.log(name, 'CONSOLE', m.text()); });
  await w.waitForFunction(() => typeof Store !== 'undefined' && Store.ready, null, { timeout: 20000 });
  await w.evaluate(() => Sync.running).catch(() => {});
  return { app, w, dir };
}

(async () => {
  const A = await launch('Petr');
  const B = await launch('Jana');
  assert(await A.w.evaluate(() => Sync.mode()) === 'folder', 'režim sdílené složky aktivní');
  await A.w.evaluate(async () => { await Store.put('songs', { id: 'p1', title: 'Žluťoučký kůň', artist: '', key: '', tempo: '', tags: [], text: '@J úpěl ďábelské ódy' }); await Sync.run(); });
  assert(fs.existsSync(path.join(SHARED, 'songs', 'p1.json')), 'píseň zapsána do sdílené složky');
  assert(fs.readFileSync(path.join(SHARED, 'songs', 'p1.json'), 'utf8').includes('ďábelské'), 'čeština v souboru v pořádku');
  assert(fs.existsSync(path.join(SHARED, 'CTI-ME.txt')), 'vysvětlující soubor ve složce');
  assert(!fs.readdirSync(path.join(SHARED, 'songs')).some(f => f.startsWith('.')), 'žádné zbylé dočasné soubory');

  await B.w.evaluate(() => Sync.run());
  assert(await B.w.evaluate(() => Store.songs.get('p1')?.title) === 'Žluťoučký kůň', 'druhý člen píseň načetl');

  // Automatické načtení po změně souboru (sledování složky)
  await A.w.evaluate(async () => { const s = Store.songs.get('p1'); s.text += '\n@V všichni'; await Store.put('songs', s); });
  let ok = false;
  for (let i = 0; i < 30 && !ok; i++) { await sleep(500); ok = (await B.w.evaluate(() => Store.songs.get('p1').text)).includes('všichni'); }
  assert(ok, 'změna se k druhému členovi dostala automaticky (bez kliknutí)');

  // Konflikt: oba upraví zároveň
  await A.w.evaluate(() => { Settings.set('autoSync', false); });
  await B.w.evaluate(() => { Settings.set('autoSync', false); });
  await A.w.evaluate(async () => { const s = Store.songs.get('p1'); s.text = 'verze Petr'; await Store.put('songs', s); });
  await sleep(20);
  await B.w.evaluate(async () => { const s = Store.songs.get('p1'); s.text = 'verze Jana'; await Store.put('songs', s); });
  await A.w.evaluate(() => Sync.run());
  await B.w.evaluate(() => Sync.run());
  await A.w.evaluate(() => Sync.run());
  const aT = await A.w.evaluate(() => [...Store.songs.values()].map(s => s.text).sort());
  const bT = await B.w.evaluate(() => [...Store.songs.values()].map(s => s.text).sort());
  assert(aT.includes('verze Petr') && aT.includes('verze Jana'), 'konflikt: obě verze zachovány');
  assert(JSON.stringify(aT) === JSON.stringify(bT), 'oba členové mají po konfliktu stejná data');

  // Konfliktní kopie, kterou vytvoří cloud (např. Mega „p1 (1).json“)
  const orig = JSON.parse(fs.readFileSync(path.join(SHARED, 'songs', 'p1.json'), 'utf8'));
  orig.text = 'verze z cloudové kopie';
  fs.writeFileSync(path.join(SHARED, 'songs', 'p1 (1).json'), JSON.stringify(orig));
  const r = await A.w.evaluate(() => Sync.run());
  assert(!fs.existsSync(path.join(SHARED, 'songs', 'p1 (1).json')), 'konfliktní kopie od cloudu zpracována a odstraněna');
  assert((await A.w.evaluate(() => [...Store.songs.values()].map(s => s.text))).includes('verze z cloudové kopie'), 'obsah konfliktní kopie zachován jako samostatná píseň');

  // Nedokončený (právě stahovaný) soubor nesmí nic rozbít
  fs.writeFileSync(path.join(SHARED, 'songs', 'half.json'), '{"id":"half","tit');
  await A.w.evaluate(() => Sync.run());
  assert(!(await A.w.evaluate(() => Store.songs.has('half'))), 'poškozený soubor ignorován');
  fs.writeFileSync(path.join(SHARED, 'songs', 'half.json'), JSON.stringify({ id: 'half', title: 'Dostaženo', text: '' }));
  await A.w.evaluate(() => Sync.run());
  assert(await A.w.evaluate(() => Store.songs.get('half')?.title) === 'Dostaženo', 'po dostažení soubor načten');

  // Mazání
  await B.w.evaluate(() => Sync.run());
  await B.w.evaluate(async () => { await Store.remove('songs', 'half'); await Sync.run(); });
  assert(!fs.existsSync(path.join(SHARED, 'songs', 'half.json')), 'smazání odstraní soubor ze sdílené složky');
  await A.w.evaluate(() => Sync.run());
  assert(!(await A.w.evaluate(() => Store.songs.has('half'))), 'smazání se přeneslo k druhému členovi');

  // Odpojená složka (např. cloud ještě nenaběhl) – čtečka jede dál z vlastních dat
  await A.w.evaluate(() => Settings.set('sharedFolder', 'Z:\\neexistuje'));
  let err = null;
  try { await A.w.evaluate(() => Sync.run()); } catch (e) { err = e.message; }
  assert(err && /neexistuje|není/.test(err), 'nedostupná složka hlásí srozumitelnou chybu');
  assert(await A.w.evaluate(() => Store.songs.size) > 0, 'data zůstala v programu');
  await A.w.evaluate(() => { location.hash = '#/reader/all'; });
  await sleep(500);
  assert(await A.w.evaluate(() => Reader.isOpen() && !!document.querySelector('#reader .stage')), 'čtečka funguje i bez sdílené složky');

  // Nastavení – obrazovka sdílení
  await B.w.evaluate(() => { location.hash = '#/settings/band'; });
  await sleep(500);
  assert(await B.w.isVisible('.set-status:has-text("Složka")') && await B.w.isVisible('.set-actions button:has-text("Odpojit")'), 'nastavení: stav sdílené složky a Odpojit');
  await B.w.click('summary:has-text("Pokročilé")');
  assert(await B.w.isVisible('button:has-text("Vybrat složku")'), 'tlačítko pro výběr složky');

  await A.app.close(); await B.app.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})().catch(e => { console.log('FAIL: výjimka', e); process.exitCode = 1; });
