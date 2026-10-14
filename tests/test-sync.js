const { chromium } = require('playwright');
const assert = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } else console.log('ok: ' + m); };
(async () => {
  const b = await chromium.launch();
  const mk = async () => {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 850 } });
    await ctx.addInitScript(() => {
      window.GH_API_OVERRIDE = 'http://localhost:8124';
      if (!localStorage.getItem('prompter-settings')) localStorage.setItem('prompter-settings', JSON.stringify({ welcomed: true, gh: { owner: 'o', repo: 'r', branch: 'main', token: 'TESTTOKEN', canPush: true, login: 'x' } }));
    });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('PAGEERR', e.message));
    await p.goto('http://localhost:8123/index.html#/songs');
    await p.waitForFunction(() => typeof Store !== 'undefined' && Store.ready);
    return p;
  };
  const A = await mk();
  // A: sample song neexistuje, protože je nastaven repo -> vytvoř píseň
  await A.evaluate(async () => { await Store.put('songs', { id: 'song1', title: 'Píseň Jedna', artist: '', key: '', tempo: '', tags: [], text: '@J ahoj\n@T čau' }); });
  const r1 = await A.evaluate(() => Sync.run());
  console.log('A sync1', JSON.stringify(r1));
  let st = await (await fetch('http://localhost:8124/__state')).json();
  assert(st.files['data/songs/song1.json'] && st.files['data/songs/song1.json'].includes('Píseň Jedna'), 'píseň nahrána na GitHub (UTF-8)');
  assert(Object.keys(st.files).filter(f => f.startsWith('data/templates/')).length === 4, 'šablony nahrány');

  const B = await mk();
  await B.evaluate(() => Sync.run());
  assert(await B.evaluate(() => Store.songs.get('song1')?.title) === 'Píseň Jedna', 'B stáhl píseň');

  // A upraví, B stáhne
  await A.evaluate(async () => { const s = Store.songs.get('song1'); s.text += '\n@V všichni'; await Store.put('songs', s); await Sync.run(); });
  await B.evaluate(() => Sync.run());
  assert((await B.evaluate(() => Store.songs.get('song1').text)).includes('všichni'), 'B vidí úpravu od A');
  const r2 = await B.evaluate(() => Sync.run());
  assert(r2.pushed === 0 && r2.downloaded === 0, 'opakovaná synchronizace nic nedělá');

  // Konflikt
  await A.evaluate(async () => { const s = Store.songs.get('song1'); s.text = 'verze A'; await Store.put('songs', s); });
  await new Promise(r => setTimeout(r, 30));
  await B.evaluate(async () => { const s = Store.songs.get('song1'); s.text = 'verze B'; await Store.put('songs', s); });
  await A.evaluate(() => Sync.run());
  const rc = await B.evaluate(() => Sync.run());
  console.log('B conflict', JSON.stringify(rc));
  const bSongs = await B.evaluate(() => [...Store.songs.values()].map(s => s.title + ':' + s.text));
  console.log(bSongs);
  assert(bSongs.some(t => t.includes('verze B')) && bSongs.some(t => t.includes('verze A')), 'konflikt: obě verze zachovány');
  await A.evaluate(() => Sync.run());
  const aSongs = await A.evaluate(() => [...Store.songs.values()].map(s => s.title + ':' + s.text));
  assert(aSongs.length === bSongs.length, 'A i B mají stejný počet písní po konfliktu');

  // Mazání
  await B.evaluate(async () => { await Store.remove('songs', 'song1'); await Sync.run(); });
  await A.evaluate(() => Sync.run());
  assert(!(await A.evaluate(() => Store.songs.has('song1'))), 'smazání se přeneslo k A');

  // Změna přímo na GitHubu
  await fetch('http://localhost:8124/__edit', { method: 'POST', body: JSON.stringify({ 'data/songs/ext.json': JSON.stringify({ id: 'ext', title: 'Z GitHubu', text: 'x' }, null, 2) + '\n' }) });
  await A.evaluate(() => Sync.run());
  assert(await A.evaluate(() => Store.songs.get('ext')?.title) === 'Z GitHubu', 'změna z webu GitHubu stažena');

  // Souběh: B pushne, zatímco A má zastaralý head -> retry
  await B.evaluate(async () => { await Sync.run(); await Store.put('songs', { id: 'b2', title: 'B2', text: '' }); await Sync.run(); });
  await A.evaluate(async () => { await Store.put('songs', { id: 'a2', title: 'A2', text: '' }); await Sync.run(); });
  st = await (await fetch('http://localhost:8124/__state')).json();
  assert(st.files['data/songs/a2.json'] && st.files['data/songs/b2.json'], 'obě nové písně na GitHubu');

  // Sdílený rozměr monitoru
  await A.evaluate(async () => { Settings.set('screenW', 1920); Settings.set('screenH', 1200); await new Promise(r => setTimeout(r, 100)); await Sync.run(); });
  await B.evaluate(() => Sync.run());
  assert(await B.evaluate(() => Settings.get('screenH')) === 1200, 'rozměr monitoru sdílen');

  // Kód kapely: nový člen se připojí jen vložením kódu (bez GitHub účtu)
  const code = await A.evaluate(() => BandCode.make({ name: 'Rusted', ro: false }));
  const ctxC = await b.newContext({ viewport: { width: 1400, height: 850 } });
  await ctxC.addInitScript(() => { window.GH_API_OVERRIDE = 'http://localhost:8124'; });
  await ctxC.grantPermissions(['clipboard-read', 'clipboard-write']);
  const C = await ctxC.newPage();
  C.on('pageerror', e => console.log('PAGEERR', e.message));
  await C.goto('http://localhost:8123/index.html#/songs');
  await C.waitForSelector('.modal-title:has-text("Vítej")');
  await C.evaluate(t => navigator.clipboard.writeText(t), code);
  await C.click('.modal button:has-text("Mám kód kapely")');
  await C.waitForSelector('.modal textarea');
  assert((await C.inputValue('.modal textarea')) === code, 'kód kapely se sám vložil ze schránky');
  await C.click('.modal button:has-text("Připojit")');
  await C.waitForFunction(() => Store.songs.has('a2'), null, { timeout: 15000 });
  assert(true, 'člen připojen kódem kapely (GitHub) a stáhl písně');
  assert(await C.evaluate(() => !Store.songs.size || ![...Store.songs.values()].some(s => s.sample)), 'ukázková píseň se nenahrála');
  st = await (await fetch('http://localhost:8124/__state')).json();
  assert(!Object.values(st.files).some(t => t.includes('"sample": true')), 'v úložišti kapely není ukázková píseň');
  assert(await C.isVisible('text=synchronizováno'), 'stav synchronizace v liště');
  await C.evaluate(async () => { await Store.put('songs', { id: 'c1', title: 'Od člena C', text: '' }); await Sync.run(); });
  await A.evaluate(() => Sync.run());
  assert(await A.evaluate(() => Store.songs.has('c1')), 'změna od člena připojeného kódem dorazila');
  const roCode = await A.evaluate(() => BandCode.make({ name: 'Rusted', ro: true }));
  await C.evaluate(async c => { await BandCode.join(c); }, roCode);
  const before = JSON.stringify((await (await fetch('http://localhost:8124/__state')).json()).files);
  await C.evaluate(async () => { await Store.put('songs', { id: 'c2', title: 'Nesmí ven', text: '' }); await Sync.run(); });
  const after = JSON.stringify((await (await fetch('http://localhost:8124/__state')).json()).files);
  assert(before === after, 'kód jen pro čtení: nic se neodešle');
  assert(await C.isVisible('text=jen čtení'), 'lišta ukazuje „jen čtení“');
  const badErr = await C.evaluate(c => BandCode.join(c).then(() => '').catch(e => e.message), 'PROMPTER-' + btoa('{"v":1,"k":"xyz"}'));
  assert(/Neznámý formát/.test(badErr), 'neznámý typ kódu → srozumitelná chyba');
  assert(await C.evaluate(() => Sync.mode()) === 'github', 'po chybném kódu zůstane původní připojení');
  await b.close();
})();
