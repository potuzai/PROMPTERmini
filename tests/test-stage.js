// Editor přímo ve stránce čtečky: ovládání šipkami (airmouse), psaní, nabídka OK, stránky, playlist
const { chromium } = require('playwright');
const assert = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } else console.log('ok: ' + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const URL = process.env.APP_URL || 'http://localhost:8123/index.html';
const SHOTS = process.env.SHOTS || '/tmp/claude-0/shots';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await ctx.addInitScript(() => { if (!localStorage.getItem('prompter-settings')) localStorage.setItem('prompter-settings', JSON.stringify({ welcomed: true })); });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL + '#/songs'); await p.waitForFunction(() => typeof Store !== 'undefined' && Store.ready);
  const src = () => p.evaluate(() => SongsView.editor.src);
  const key = async (k, n = 1) => { for (let i = 0; i < n; i++) { await p.keyboard.press(k); await sleep(60); } };
  const songMenu = async label => { await p.click('.ed-panel button:has-text("Píseň ⋯")'); await p.click(`.menu div:has-text("${label}")`); };
  const curText = () => p.evaluate(() => { const e = document.querySelector('.edit-stage .is-cur'); return e ? e.textContent : ''; });

  // nová píseň: prázdná stránka, vložení textu
  await p.click('button:has-text("Nová píseň")');
  await p.fill('.modal input', 'Stránková');
  await p.keyboard.press('Enter');
  await p.waitForSelector('.se-wrap .edit-stage');
  await sleep(300);
  assert(await p.isVisible('.se-empty'), 'prázdná píseň ukazuje návod');
  assert(await p.evaluate(() => document.activeElement === document.querySelector('.se-wrap')), 'stránka má hned fokus (šipky fungují bez kliknutí)');
  const raw = 'Am        C\n1. První řádek sloky\nDruhý řádek\n\nRef: Refrén první\nrefrén druhý\n\n2. Sloka dvě\nřádek\n\nR:\n';
  await p.evaluate(t => navigator.clipboard.writeText(t), raw);
  await p.keyboard.press('Control+V');
  await sleep(400);
  const s1 = await src();
  assert(s1.includes('## Sloka 1') && s1.includes('>> Refrén') && s1.includes('[Am]'), 'vložení textu s vyčištěním');
  assert(await p.isVisible('.edit-stage .st-head:has-text("Stránková")'), 'na stránce je záhlaví s názvem písně');
  assert(!(await p.evaluate(() => document.querySelector('.edit-stage').textContent.includes('Am'))), 'akordy nejsou ve čtečce vidět');

  // šipky: výběr a zpěvák
  await key('Home');
  await key('ArrowDown');
  assert((await curText()).includes('První řádek'), '↓ vybere další řádek');
  await key('ArrowRight');
  assert(/^@J .*První řádek/m.test(await src()), '→ nastaví prvního zpěváka');
  await key('ArrowRight');
  assert(/^@T .*První řádek/m.test(await src()), '→ znovu = další zpěvák');
  await key('ArrowLeft', 2);
  assert(!/^@\w+ .*První řádek/m.test(await src()), '← zpět až na „nikdo“');
  await key('ArrowRight');
  await p.keyboard.down('Shift'); await key('ArrowDown'); await p.keyboard.up('Shift');
  await key('ArrowRight');
  await key('ArrowRight');
  const s2 = await src();
  assert(/^@T .*První řádek/m.test(s2) && /^@T Druhý řádek/m.test(s2), 'Shift+↓ vybere víc řádků a ← → je obarví najednou');
  await p.screenshot({ path: SHOTS + '/s-1-select.png' });

  // nabídka OK – vše přes šipky
  await key('Escape');
  await key('Enter');
  assert(await p.isVisible('.line-menu'), 'OK (Enter) otevře nabídku řádku');
  await p.screenshot({ path: SHOTS + '/s-2-menu.png' });
  // Písmo řádku → Tučně
  const items = await p.$$eval('.line-menu .lm-item .lm-l', els => els.map(e => e.textContent));
  const go = async label => { const all = await p.$$eval('.line-menu .lm-item .lm-l', els => els.map(e => e.textContent)); const cur = await p.$$eval('.line-menu .lm-item', els => els.findIndex(e => e.classList.contains('on'))); const i = all.findIndex(x => x.startsWith(label)); await key(i > cur ? 'ArrowDown' : 'ArrowUp', Math.abs(i - cur)); await key('Enter'); };
  assert(items.includes('Kdo zpívá') && items.includes('Vložit'), 'nabídka má akce pro řádek');
  await go('Písmo řádku');
  await go('Tučně');
  assert(/^@T \*\*Druhý řádek\*\*/m.test(await src()), 'tučné písmo přes nabídku jen šipkami a OK');
  await key('Enter'); await go('Vložit'); await key('ArrowLeft'); await key('ArrowLeft');
  assert(!(await p.isVisible('.line-menu')), '← / Esc nabídku zavře');

  // psaní: začni psát = úprava, Enter = nový řádek, ↑ ↓ mezi řádky, Esc = hotovo
  await key('ArrowUp');
  const before = await curText();
  await p.keyboard.type(' konec');
  await sleep(100);
  assert(await p.isVisible('.edit-stage .is-edit'), 'psaní začne úpravu vybraného řádku');
  assert((await src()).includes(before.trim() + ' konec'), 'napsaný text se připíše na konec řádku');
  await key('Enter');
  await p.keyboard.type('Nový řádek pod');
  await sleep(100);
  assert(/^@T První řádek sloky konec\n@T Nový řádek pod/m.test(await src()), 'Enter = nový řádek se stejným zpěvákem');
  await key('Escape');
  await sleep(150);
  assert(!(await p.isVisible('.edit-stage .is-edit')), 'Esc ukončí psaní');
  assert((await curText()).includes('Nový řádek pod'), 'po psaní zůstane vybraný řádek');
  await key('ArrowDown');
  await key('Backspace');
  await key('Home'); // v psaní: kurzor na začátek
  await key('Backspace'); // spojit s předchozím
  await sleep(150);
  assert(/Nový řádek pod \*\*Druhý řádek\*\*/.test(await src()), 'Backspace na začátku spojí řádky');
  await key('Control+z'); await sleep(150);
  assert(/^@T \*\*Druhý řádek\*\*/m.test(await src()), 'Ctrl+Z vrátí spojení');
  await key('Escape');

  // klik: vybrat, druhý klik = psaní
  await p.click('.edit-stage .b-line:has-text("refrén druhý")');
  assert((await curText()).includes('refrén druhý'), 'klik vybere řádek');
  await p.click('.edit-stage .b-line:has-text("refrén druhý")');
  await sleep(150);
  assert(await p.isVisible('.edit-stage .is-edit'), 'klik na vybraný řádek = psaní');
  await key('Escape');

  // zpěvák jen pro slova: jde měnit opakovaně a zrušit
  await p.click('.edit-stage .b-line:has-text("refrén druhý")'); await p.click('.edit-stage .b-line:has-text("refrén druhý")'); await sleep(150);
  await p.evaluate(() => { const el = document.querySelector('.is-edit'); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const i = n.data.indexOf('druhý'); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 5); getSelection().removeAllRanges(); getSelection().addRange(r); return; } } });
  await p.click('.ed-panel .sw >> nth=0'); await sleep(150);
  assert(/refrén \{J:druhý\}/.test(await src()), 'zpěvák pro označené slovo');
  await p.click('.ed-panel .sw >> nth=1'); await sleep(150);
  assert(/refrén \{T:druhý\}/.test(await src()) && !/\{J:/.test(await src()), 'barvu slova jde změnit znovu (bez vnoření)');
  await p.click('.ed-panel .sw.none'); await sleep(150);
  assert(/^refrén druhý$/m.test(await src()), '„Nikdo“ barvu slova zruší');
  await key('Escape');

  // pravý panel: zpěvák, sekce, poznámka, nová stránka
  await p.click('.ed-panel .sw >> nth=2');
  assert(/^@V refrén druhý/m.test(await src()), 'tlačítko zpěváka v panelu');
  assert(await p.isVisible('.ed-panel .sw.on'), 'panel ukazuje zpěváka vybraného řádku');
  await p.click('.ed-panel button:has-text("Další…")');
  await p.click('.menu div:has-text("Nová stránka")');
  await sleep(200);
  assert(/---\n@V refrén druhý/.test(await src()), 'nová stránka před vybraný řádek');
  assert(/2/.test(await p.textContent('.page-lbl')) && (await p.textContent('.page-lbl')).includes('/2'), 'stránky: počet v panelu');
  assert(await p.isVisible('.edit-stage .b-line:has-text("refrén druhý")'), 'stránka přeskočí na vybraný řádek');
  await key('PageUp'); await sleep(100);
  assert((await p.textContent('.page-lbl')).startsWith('1'), 'PgUp = předchozí stránka');
  await key('Control+z'); await sleep(150);

  // pro muzikanty: akordy jen v pohledu Pro muzikanty
  await songMenu('Ukázat akordy'); await sleep(250);
  assert(await p.evaluate(() => document.querySelector('.edit-stage').textContent.includes('Am')), 'pohled Pro muzikanty ukazuje akordy');
  await songMenu('Ukázat akordy'); await sleep(200);
  assert(!(await p.evaluate(() => document.querySelector('.edit-stage').textContent.includes('Am'))), 'zpět na pohled čtečky');

  // playlist: pozice x/y v záhlaví
  await p.evaluate(async () => {
    const id = SongsView.editor.id;
    const other = [...Store.songs.keys()].find(k => k !== id);
    await Store.put('playlists', { id: 'pls', name: 'Koncert', date: '2026-10-20', templateId: '', note: '', items: [other, id] });
    location.hash = '#/playlists';
    return id;
  }).then(async id => { await sleep(300); await p.evaluate(i => { location.hash = '#/songs/' + i; }, id); });
  await sleep(600);
  assert(await p.isVisible('.edit-stage .st-head:has-text("2/2")'), 'v záhlaví je pořadí v playlistu');
  await songMenu('Údaje o písni');
  await p.selectOption('.modal select >> nth=1', '');
  await p.click('.modal button:has-text("Hotovo")');
  await sleep(200);
  assert(!(await p.isVisible('.edit-stage .st-head:has-text("2/2")')), 'samostatně = bez pořadí');

  // zdrojový text
  await songMenu('Zdrojový text');
  const ta = await p.inputValue('.modal textarea');
  assert(ta === await src(), 'zdrojový text odpovídá');
  await p.fill('.modal textarea', ta + '\n@J Ze zdroje');
  await p.click('.modal button:has-text("Použít")');
  await sleep(200);
  assert(await p.isVisible('.edit-stage .b-line:has-text("Ze zdroje")') || (await src()).includes('@J Ze zdroje'), 'změna zdroje se projeví');

  // uložení
  await sleep(1900);
  const saved = await p.evaluate(() => [...Store.songs.values()].find(s => s.title === 'Stránková').text);
  assert(saved.includes('@J Ze zdroje') && saved.includes('**Druhý řádek**'), 'automatické uložení');
  await p.screenshot({ path: SHOTS + '/s-3-wide.png' });
  for (const [w, hh, n] of [[1280, 800, 's-4-mid'], [1000, 800, 's-5-narrow']]) {
    await p.setViewportSize({ width: w, height: hh }); await sleep(400);
    assert(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `bez vodorovného přetékání při šířce ${w}`);
    await p.screenshot({ path: SHOTS + '/' + n + '.png' });
  }
  assert(errors.length === 0, 'žádné chyby JavaScriptu' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})().catch(e => { console.log('FAIL: výjimka', e); process.exit(1); });
