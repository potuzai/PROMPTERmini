// Test přímého napojení na Mega: správce založí kapelu, členové se přihlásí e-mailem a heslem kapely.
const { _electron, chromium } = require('playwright');
const http = require('http');
const fs = require('fs'); const path = require('path'); const os = require('os');
const assert = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } else console.log('ok: ' + m); };
const ROOT = path.join(__dirname, '..');
const EL = path.join(ROOT, 'node_modules/electron/dist/electron');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prompter-mega-'));
const STATE = path.join(tmp, 'mega-cloud.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));
// stav „cloudu“ – jiný proces ho může právě zapisovat, pak čtení zopakovat
const cloud = () => { for (let i = 0; ; i++) { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) { if (i > 50) throw e; const t = Date.now() + 20; while (Date.now() < t); } } };
const cloudFiles = () => { const st = cloud(); const p = id => st.nodes[id] ? (p(st.nodes[id].parent) + '/' + st.nodes[id].name) : ''; return Object.entries(st.nodes).filter(([, n]) => !n.dir).map(([id, n]) => ({ path: p(id).replace('/Cloud Drive/', ''), text: Buffer.from(n.data, 'base64').toString() })); };

async function launch(name, settings, env = {}) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir, { recursive: true });
  const sf = path.join(dir, 'settings.json');
  const prev = fs.existsSync(sf) ? JSON.parse(fs.readFileSync(sf, 'utf8')) : {};
  fs.writeFileSync(sf, JSON.stringify(Object.assign({ readerFullscreen: false, userName: name }, prev, settings)));
  const app = await _electron.launch({ executablePath: EL, args: ['--no-sandbox', ROOT], env: { ...process.env, PROMPTER_DATA_DIR: dir, PROMPTER_MEGA_MOCK: path.join(__dirname, 'mega-mock.js'), MEGA_MOCK_STATE: STATE, ...env } });
  const w = await app.firstWindow();
  w.on('pageerror', e => console.log(name, 'PAGEERR', e.message));
  await w.waitForFunction(() => typeof Store !== 'undefined' && Store.ready, null, { timeout: 20000 });
  return { app, w, dir };
}

// Testovací server: prohlížečová napodobenina Mega čte a ukládá stejný „cloud“ jako program
const megaSrv = http.createServer((req, res) => {
  const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, h); return res.end(); }
  let body = ''; req.on('data', d => body += d);
  req.on('end', () => {
    if (req.method === 'POST') fs.writeFileSync(STATE, body);
    res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, h));
    res.end(req.method === 'GET' && fs.existsSync(STATE) ? fs.readFileSync(STATE) : '');
  });
}).listen(8125);
const APP_URL = process.env.APP_URL || 'http://localhost:8123/index.html';

async function browserMember(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 850 }, serviceWorkers: 'block' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await ctx.addInitScript(() => { window.MEGA_MOCK_URL = 'http://localhost:8125/__mega'; });
  // místo skutečné knihovny megajs podstrčíme napodobeninu
  await ctx.route('**/vendor/megajs-1.3.10.js', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(__dirname, 'mega-mock.js'), 'utf8') }));
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('WEB PAGEERR', e.message));
  await p.goto(APP_URL + '#/songs');
  return { ctx, p };
}

(async () => {
  /* ----- Správce: průvodce → Přihlásit ke kapele (nový účet Mega) ----- */
  const A = await launch('Petr', {});
  await A.w.evaluate(() => { location.hash = '#/songs'; });
  await A.w.waitForSelector('.wizard', { timeout: 5000 });
  assert(true, 'při prvním spuštění se zobrazí průvodce');
  for (let i = 0; i < 3; i++) await A.w.click('.wz-foot .btn.primary');
  await A.w.click('.wizard button:has-text("Přihlásit ke kapele")');
  await A.w.waitForSelector('.modal form.login');
  assert(!(await A.w.isVisible('.modal :text("Zůstat přihlášen")')), 'program: bez volby „Zůstat přihlášen“ (pamatuje si vždy)');
  await A.w.fill('.modal input[type=email]', 'kapela@test.cz');
  await A.w.fill('.modal input[type=password]', 'spatne');
  await A.w.click('.modal button:has-text("Přihlásit")');
  await A.w.waitForSelector('.modal .login-err:has-text("špatný e-mail nebo heslo")', { timeout: 8000 });
  assert(true, 'špatné heslo → srozumitelná chyba, okno zůstane otevřené');
  await sleep(500);
  await A.w.fill('.modal input[type=password]', 'heslo123');
  await A.w.click('.modal button:has-text("Přihlásit")');
  await A.w.waitForSelector('.modal button:has-text("Založit složku")', { timeout: 10000 });
  assert(await A.w.isVisible('.modal :text("zatím není složka „PROMPTERmini“")'), 'chybějící složka kapely se založí jen se souhlasem');
  await A.w.click('.modal button:has-text("Založit složku")');
  await A.w.waitForFunction(() => !document.querySelector('.modal') && Sync.mode() === 'mega' && Sync.state === 'idle', null, { timeout: 15000 }).catch(async e => { console.log('DBG', await A.w.evaluate(() => JSON.stringify({ modal: !!document.querySelector('.modal'), err: (document.querySelector('.login-err') || {}).textContent, mode: Sync.mode(), st: Sync.state, le: Sync.lastError }))); throw e; });
  const files0 = cloudFiles();
  assert(files0.some(f => f.path === 'PROMPTERmini/config/singers.json'), 'zpěváci nahráni do Mega do složky kapely');
  assert(!files0.some(f => f.text.includes('"sample": true')), 'ukázková píseň se do kapely nenahrála');
  const savedPass = JSON.parse(fs.readFileSync(path.join(A.dir, 'settings.json'), 'utf8')).mega.pass;
  assert(savedPass && !savedPass.includes('heslo123'), 'heslo není v nastavení čitelně');
  await A.w.evaluate(() => { location.hash = '#/settings/band'; }); await sleep(400);
  assert(await A.w.isVisible('.set-status:has-text("Přihlášeno ke kapele"):has-text("kapela@test.cz")'), 'nastavení ukazuje, kdo je přihlášený');
  await A.w.click('.set-actions button:has-text("Pozvat členy")');
  const invite = await A.w.inputValue('.modal textarea');
  assert(invite.includes('kapela@test.cz') && invite.includes('https://') && !invite.includes('heslo123'), 'pozvánka: adresa aplikace a e-mail kapely, bez hesla');
  await A.w.click('.modal button:has-text("Zavřít")');
  await A.w.evaluate(async () => { await Store.put('songs', { id: 'zluty', title: 'Žlutý pes', artist: '', key: 'C', tempo: '', tags: [], text: '@J Žlutý pes' }); await Sync.run(); });

  /* ----- Člen: průvodce → Přihlásit ke kapele ----- */
  const B = await launch('Jana', {});
  await B.w.evaluate(() => { location.hash = '#/songs'; });
  await B.w.waitForSelector('.wizard');
  for (let i = 0; i < 3; i++) await B.w.click('.wz-foot .btn.primary');
  await B.w.click('.wizard button:has-text("Přihlásit ke kapele")');
  await B.w.waitForSelector('.modal form.login');
  await B.w.fill('.modal input[type=email]', 'kapela@test.cz');
  await B.w.fill('.modal input[type=password]', 'heslo123');
  await B.w.click('.modal button:has-text("Přihlásit")');
  await B.w.waitForFunction(() => Store.songs.has('zluty'), null, { timeout: 15000 });
  assert(true, 'člen se přihlásil e-mailem a heslem kapely a stáhl písně');
  assert(await B.w.evaluate(() => ![...Store.songs.values()].some(s => s.sample)), 'ukázková píseň člena se do kapely nenahrála');
  const tplCopies = await B.w.evaluate(() => [...Store.templates.values()].filter(t => t.name.includes('konflikt')).length);
  assert(tplCopies === 0, 'výchozí šablony nezpůsobily konflikty');

  /* ----- Úpravy oběma směry ----- */
  await B.w.evaluate(async () => { const s = Store.songs.get('zluty'); s.text += '\n@T doplnila Jana'; await Store.put('songs', s); await Sync.run(); });
  await A.w.evaluate(() => Sync.run());
  assert((await A.w.evaluate(() => Store.songs.get('zluty').text)).includes('doplnila Jana'), 'úprava člena se dostala ke správci');
  assert(cloudFiles().filter(f => f.path.endsWith('songs/zluty.json')).length === 1, 'v Mega zůstává jen jedna verze souboru');
  const r = await A.w.evaluate(() => Sync.run());
  assert(r.pushed === 0 && r.downloaded === 0, 'opakovaná synchronizace nic nepřenáší');

  /* ----- Prohlížečová verze: člen se přihlásí stejně ----- */
  const browser = await chromium.launch();
  const D = await browserMember(browser);
  await D.p.waitForSelector('.modal-title:has-text("Vítej")');
  await D.p.click('.modal button:has-text("Přihlásit ke kapele")');
  await D.p.waitForSelector('.modal form.login');
  assert(await D.p.isChecked('.modal label.chk:has-text("Zůstat přihlášen") input'), 'prohlížeč: „Zůstat přihlášen“ je nabídnuté a zapnuté');
  await D.p.fill('.modal input[type=email]', 'kapela@test.cz');
  await D.p.fill('.modal input[type=password]', 'heslo123');
  await D.p.click('.modal button:has-text("Přihlásit")');
  await D.p.waitForFunction(() => Store.songs.has('zluty'), null, { timeout: 15000 });
  assert(true, 'prohlížeč: přihlášení e-mailem a heslem kapely (Mega) a stažení písní');
  assert((await D.p.evaluate(() => Store.songs.get('zluty').text)).includes('doplnila Jana'), 'prohlížeč má aktuální verzi písně');
  assert(await D.p.evaluate(() => Sync.mode()) === 'mega' && await D.p.waitForFunction(() => (document.querySelector('.sync-pill').dataset.state || '').includes('synchronizováno'), null, { timeout: 8000 }).then(() => true, () => false), 'prohlížeč: stav „synchronizováno“');
  const lsRaw = await D.p.evaluate(() => localStorage.getItem('prompter-settings'));
  assert(!lsRaw.includes('heslo123'), 'prohlížeč: heslo není v úložišti čitelně');
  // úprava v prohlížeči přes editor → program ji uvidí
  await D.p.evaluate(() => { location.hash = '#/songs/zluty'; });
  await D.p.waitForSelector('.se-wrap .edit-stage');
  await D.p.focus('.se-wrap'); await D.p.keyboard.press('End');
  await D.p.evaluate(() => SongsView.editor.se.startEdit(null, 'end')); await D.p.keyboard.type('z prohlížeče'); await D.p.keyboard.press('Escape');
  await D.p.keyboard.press('Control+S');
  await D.p.waitForFunction(() => Store.pendingCount() === 0 && Sync.state === 'idle', null, { timeout: 20000 });
  await A.w.evaluate(() => Sync.run());
  assert((await A.w.evaluate(() => Store.songs.get('zluty').text)).includes('z prohlížeče'), 'úprava z prohlížeče se dostala do programu');
  // program → prohlížeč
  await A.w.evaluate(async () => { await Store.put('playlists', { id: 'plweb', name: 'Koncert pátek', date: '2026-10-16', templateId: '', note: '', items: ['zluty'] }); await Sync.run(); });
  await D.p.evaluate(() => Sync.run());
  assert(await D.p.evaluate(() => Store.playlists.get('plweb')?.name) === 'Koncert pátek', 'playlist z programu se objevil v prohlížeči');
  // po obnovení stránky zůstane připojeno
  await D.p.reload(); await D.p.waitForFunction(() => typeof Store !== 'undefined' && Store.ready);
  assert(await D.p.evaluate(() => Sync.mode() === 'mega' && Store.playlists.has('plweb')), 'prohlížeč: po obnovení stránky zůstane připojeno i s daty');
  assert(!(await D.p.isVisible('.modal-title:has-text("Vítej")')), 'uvítání se už znovu neukáže');
  // souběžná připojení nesmí založit víc složek kapely
  await D.p.evaluate(async () => { const api = MegaProvider.api(); const c = Object.assign({}, MegaProvider.cfg(), { folder: 'Soubezna' }); await Promise.all([api.test(c), api.snapshot(c), api.test(c), api.snapshot(c)]); });
  const dirsNamed = n => Object.values(cloud().nodes).filter(x => x.dir && x.name === n).length;
  assert(dirsNamed('Soubezna') === 1, 'souběžné připojení k Mega vytvoří jen jednu složku kapely');
  // Mega ukazuje novou složku až po chvíli: další připojení ji nesmí založit znovu
  const staleRes = await D.p.evaluate(async () => {
    window.MEGA_MOCK_ENV = { MEGA_MOCK_STALE_MS: '1500' };
    const api = MegaProvider.api(); const c = Object.assign({}, MegaProvider.cfg(), { folder: 'Pomala', folderId: '' });
    await api.test(c);
    const r = await api.snapshot(c).then(() => 'ok', e => e.message);
    window.MEGA_MOCK_ENV = {};
    return r;
  });
  assert(dirsNamed('Pomala') === 1 && staleRes === 'ok', 'opožděný seznam složek v Mega nezaloží druhou složku kapely (' + staleRes.slice(0, 60) + ')');
  // už existující duplicitní složka kapely (vznikla dřív, např. z jiného okna) se sloučí do jedné
  {
    const st = cloud();
    st.nodes.dupbase = { name: 'PROMPTERmini', parent: 'root', dir: true, ts: 1 };
    st.nodes.dupsongs = { name: 'songs', parent: 'dupbase', dir: true, ts: 1 };
    st.nodes.dupfile = { name: 'zdvojena.json', parent: 'dupsongs', dir: false, ts: 2, data: Buffer.from(JSON.stringify({ id: 'zdvojena', title: 'Ze zdvojené složky', text: '@J ahoj' })).toString('base64') };
    st.nodes.dupempty = { name: 'PROMPTERmini', parent: 'root', dir: true, ts: 1 };
    fs.writeFileSync(STATE, JSON.stringify(st));
  }
  await D.p.evaluate(() => Sync.run());
  assert(dirsNamed('PROMPTERmini') === 1, 'duplicitní složky kapely se sloučí do jedné');
  assert(await D.p.evaluate(() => Store.songs.has('zdvojena')), 'písně z duplicitní složky se nepřišly nazmar');
  // čtečka v prohlížeči z playlistu
  await D.p.evaluate(() => { location.hash = '#/reader/plweb'; }); await sleep(500);
  assert(await D.p.evaluate(() => !!document.querySelector('#reader .stage') && document.querySelector('#reader').textContent.includes('Žlutý pes')), 'prohlížeč: čtečka zobrazí playlist');
  // odhlášení na cizím počítači smaže heslo z prohlížeče
  await D.p.evaluate(() => { location.hash = '#/settings'; }); await sleep(400);
  assert(await D.p.isVisible('.set-status:has-text("Přihlášeno ke kapele")') && await D.p.isVisible('.set-actions button:has-text("Odhlásit")'), 'nastavení otevře kategorii Kapela: stav přihlášení a Odhlásit');
  await D.p.click('.set-actions button:has-text("Odhlásit")');
  await D.p.click('.modal button:has-text("Odhlásit")'); await sleep(400);
  assert(await D.p.evaluate(() => Sync.mode()) === 'off', 'prohlížeč: odhlášení od kapely');
  assert(await D.p.evaluate(() => !Settings.get('mega').pass && !localStorage.getItem('prompter-settings').includes('b64:')), 'odhlášení smaže uložené heslo z prohlížeče');
  assert(await D.p.evaluate(() => Store.songs.has('zluty')), 'písně po odhlášení zůstanou');
  // přihlášení bez „Zůstat přihlášen“: heslo jen do zavření prohlížeče
  await D.p.click('.set-actions button:has-text("Přihlásit ke kapele")');
  await D.p.waitForSelector('.modal form.login');
  assert(await D.p.inputValue('.modal input[type=email]') === 'kapela@test.cz', 'e-mail kapely zůstal předvyplněný');
  await D.p.fill('.modal input[type=password]', 'heslo123');
  await D.p.uncheck('.modal label.chk:has-text("Zůstat přihlášen") input');
  await D.p.click('.modal button:has-text("Přihlásit")');
  await D.p.waitForFunction(() => Sync.mode() === 'mega' && Sync.state === 'idle', null, { timeout: 15000 });
  assert(await D.p.evaluate(() => !localStorage.getItem('prompter-settings').includes('b64:') && Settings.get('rememberBand') === false), 'nezůstat přihlášen: heslo se do prohlížeče natrvalo neuloží');
  // další okno, zatímco první je otevřené: přihlášení si půjčí, na heslo se neptá
  const D2 = await D.ctx.newPage();
  D2.on('pageerror', e => console.log('WEB PAGEERR', e.message));
  await D2.goto(APP_URL + '#/songs'); await sleep(1500);
  assert(!(await D2.isVisible('.modal form.login')) && await D2.evaluate(() => !Sync.locked() && Sync.mode() === 'mega'), 'nezůstat přihlášen: další okno se nepřihlašuje, dokud je jiné otevřené');
  // po zavření všech oken se heslo zapomene
  await D.p.close(); await D2.close();
  const D3 = await D.ctx.newPage();
  D3.on('pageerror', e => console.log('WEB PAGEERR', e.message));
  await D3.goto(APP_URL + '#/songs');
  await D3.waitForSelector('.modal form.login');
  assert(await D3.evaluate(() => Sync.locked() && document.querySelector('.sync-pill').dataset.state.includes('odhlášeno') && Store.songs.has('zluty')), 'po zavření všech oken: odhlášeno, písně jsou ale k dispozici');
  // přihlášení v jednom okně odemkne i jiné, které na přihlášení čeká
  const D4 = await D.ctx.newPage();
  D4.on('pageerror', e => console.log('WEB PAGEERR', e.message));
  await D4.goto(APP_URL + '#/songs'); await D4.waitForSelector('.modal form.login');
  await D3.fill('.modal input[type=password]', 'heslo123');
  await D3.click('.modal button:has-text("Přihlásit")');
  await D3.waitForFunction(() => !Sync.locked() && Sync.state === 'idle', null, { timeout: 15000 });
  assert(await D4.waitForFunction(() => !Sync.locked() && !document.querySelector('.modal form.login'), null, { timeout: 5000 }).then(() => true, () => false), 'přihlášení v jednom okně odemkne i druhé');
  // odhlášení v jednom okně odhlásí i ostatní
  await D4.evaluate(() => { location.hash = '#/settings/band'; }); await sleep(400);
  await D4.click('.set-actions button:has-text("Odhlásit")'); await D4.click('.modal button:has-text("Odhlásit")');
  assert(await D3.waitForFunction(() => Sync.mode() === 'off' && !sessionStorage.getItem('prompter-secret-mega'), null, { timeout: 5000 }).then(() => true, () => false), 'odhlášení v jednom okně odhlásí i druhé');
  // zůstat přihlášen: další otevření bez ptaní
  await D3.evaluate(() => { location.hash = '#/settings/band'; }); await sleep(400);
  await D3.click('.set-actions button:has-text("Přihlásit ke kapele")'); await D3.waitForSelector('.modal form.login');
  await D3.fill('.modal input[type=password]', 'heslo123');
  await D3.check('.modal label.chk:has-text("Zůstat přihlášen") input');
  await D3.click('.modal button:has-text("Přihlásit")');
  await D3.waitForFunction(() => !Sync.locked() && Sync.state === 'idle', null, { timeout: 15000 });
  await D3.close(); await D4.close();
  const D5 = await D.ctx.newPage();
  await D5.goto(APP_URL + '#/songs'); await sleep(1500);
  assert(!(await D5.isVisible('.modal')) && await D5.evaluate(() => !Sync.locked() && Sync.mode() === 'mega'), 'zůstat přihlášen: další otevření bez ptaní');
  await D.ctx.close(); await browser.close();

  /* ----- Konflikt ----- */
  await A.w.evaluate(async () => { const s = Store.songs.get('zluty'); s.text = 'verze Petr'; await Store.put('songs', s); });
  await sleep(30);
  await B.w.evaluate(async () => { const s = Store.songs.get('zluty'); s.text = 'verze Jana'; await Store.put('songs', s); });
  await A.w.evaluate(() => Sync.run()); await B.w.evaluate(() => Sync.run()); await A.w.evaluate(() => Sync.run());
  const aT = await A.w.evaluate(() => [...Store.songs.values()].map(s => s.text).sort());
  const bT = await B.w.evaluate(() => [...Store.songs.values()].map(s => s.text).sort());
  assert(aT.includes('verze Petr') && aT.includes('verze Jana') && JSON.stringify(aT) === JSON.stringify(bT), 'konflikt: obě verze zachovány u obou');

  /* ----- Dvojité nahrání téhož souboru (souběh) ----- */
  const st = cloud();
  const songsDir = Object.entries(st.nodes).find(([, n]) => n.name === 'songs')[0];
  st.nodes.fdup = { name: 'zluty.json', parent: songsDir, dir: false, ts: 1, data: Buffer.from(JSON.stringify({ id: 'zluty', title: 'Žlutý pes', text: 'souběžná verze', updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'X' })).toString('base64') };
  fs.writeFileSync(STATE, JSON.stringify(st));
  await A.w.evaluate(() => Sync.run());
  assert(cloudFiles().filter(f => f.path.endsWith('songs/zluty.json')).length === 1, 'duplicitní soubor v Mega uklizen');
  assert((await A.w.evaluate(() => [...Store.songs.values()].map(s => s.text))).includes('souběžná verze'), 'obsah duplicity zachován jako kopie');

  /* ----- Mazání ----- */
  await B.w.evaluate(() => Sync.run());
  await B.w.evaluate(async () => { await Store.remove('songs', 'zluty'); await Sync.run(); });
  assert(!cloudFiles().some(f => f.path.endsWith('songs/zluty.json')), 'smazání odstraní soubor z Mega');
  await A.w.evaluate(() => Sync.run());
  assert(!(await A.w.evaluate(() => Store.songs.has('zluty'))), 'smazání se přeneslo');
  assert(await A.w.evaluate(() => (Store.meta.trash || []).some(t => t.obj.id === 'zluty')), 'co smazala synchronizace, jde vrátit (místní koš)');

  /* ----- Složka kapely zmizela (někdo ji smazal v Mega): písně se nesmažou, naopak znovu nahrají ----- */
  const countA = await A.w.evaluate(() => Store.songs.size);
  {
    const s0 = cloud(); const base = Object.entries(s0.nodes).find(([, n]) => n.dir && n.name === 'PROMPTERmini' && n.parent === 'root')[0];
    const drop = id => { for (const [k, n] of Object.entries(s0.nodes)) if (n.parent === id) drop(k); delete s0.nodes[id]; };
    drop(base); fs.writeFileSync(STATE, JSON.stringify(s0));
  }
  const lostRes = await A.w.evaluate(() => Sync.run());
  assert(await A.w.evaluate(() => Store.songs.size) === countA && lostRes.removed === 0, 'zmizelá složka kapely: v zařízení se nic nesmaže');
  assert(cloudFiles().filter(f => /PROMPTERmini\/songs\//.test(f.path)).length === countA, 'písně se do nové složky kapely znovu nahrály');
  await B.w.evaluate(() => Sync.run());
  assert(await B.w.evaluate(() => Store.songs.size) === countA, 'druhý člen po obnově o nic nepřišel');

  /* ----- Relace: znovupoužití a obnova po vypršení ----- */
  const logins0 = cloud().calls.login;
  await A.w.evaluate(() => Sync.run()); await A.w.evaluate(() => Sync.run());
  assert(cloud().calls.login === logins0, 'další synchronizace bez nového přihlášení (relace se znovu používá)');
  await A.app.close(); await B.app.close();

  /* ----- Čtečka jen pro čtení + vypršelá relace + výpadek ----- */
  const C = await launch('Ctecka', { startInReader: true });
  await sleep(500);
  assert(await C.w.evaluate(() => Reader.isOpen()), 'čtečka startuje do čtečky');
  await C.w.evaluate(async () => { await bandLogin({ email: 'kapela@test.cz', password: 'heslo123', ro: true }); });
  assert(await C.w.evaluate(() => Settings.get('readOnly')) === true, 'přihlášení jen pro čtení → čtečka nic neodesílá');
  const before = JSON.stringify(cloudFiles());
  await C.w.evaluate(async () => { await Store.put('songs', { id: 'loc', title: 'Jen lokálně', text: '' }); await Sync.run(); });
  assert(JSON.stringify(cloudFiles()) === before, 'změna na čtečce nešla do cloudu');
  await C.app.close();
  const C2 = await launch('Ctecka', {}, { MEGA_MOCK_EXPIRED: '1' });
  const logins1 = cloud().calls.login;
  const res = await C2.w.evaluate(async () => { while (Sync.running) await Sync.running.catch(() => {}); return Sync.run().then(r => Sync.mode() + (r.skipped ? ' skipped' : '')).catch(e => e.message); });
  assert(res === 'mega' && cloud().calls.login > logins1, 'po vypršení relace se program přihlásí znovu sám (' + res + ')');
  await C2.app.close();
  const C3 = await launch('Ctecka', {}, { MEGA_MOCK_FAIL_UPLOAD: '1' });
  await C3.w.evaluate(async () => { while (Sync.running) await Sync.running.catch(() => {}); Settings.set('readOnly', false); });
  await C3.w.evaluate(async () => { await Store.put('songs', { id: 'x1', title: 'Neodeslaná', text: '' }); });
  const err = await C3.w.evaluate(() => Sync.run().then(r => 'BEZ CHYBY ' + JSON.stringify(r)).catch(e => e.message));
  assert(/přetížená/.test(err), 'výpadek Mega → srozumitelná chyba (' + err + ')');
  assert(await C3.w.evaluate(() => Store.songs.has('x1') && Store.pendingCount() > 0), 'neodeslaná změna zůstane a odešle se příště');
  await C3.app.close();
  megaSrv.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})().catch(e => { console.log('FAIL: výjimka', e); process.exit(1); });
