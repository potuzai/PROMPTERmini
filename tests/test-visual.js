// Vizuální editor: úpravy bez značek, zdrojový text se značkami musí odpovídat
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
  const src = () => p.evaluate(() => document.querySelector('.ta').value);
  const selectText = (rowText, from, to) => p.evaluate(([rt, a, z]) => {
    const row = [...document.querySelectorAll('.ve-row')].find(r => r.textContent.includes(rt));
    const w = document.createTreeWalker(row, NodeFilter.SHOW_TEXT); let n; const nodes = [];
    while ((n = w.nextNode())) nodes.push(n);
    const pos = off => { for (const t of nodes) { if (off <= t.length) return [t, off]; off -= t.length; } return [nodes[nodes.length - 1], nodes[nodes.length - 1].length]; };
    const full = row.textContent; const s = a == null ? 0 : full.indexOf(a); const e = z == null ? full.length : full.indexOf(z) + z.length;
    const r = document.createRange(); r.setStart(...pos(s)); r.setEnd(...pos(e));
    document.querySelector('.ve').focus();
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  }, [rowText, from, to]);

  await p.click('button:has-text("Nová píseň")');
  await p.fill('.modal input', 'Vizuální');
  await p.keyboard.press('Enter');
  await p.waitForSelector('.ve');
  assert(await p.isVisible('.ve') && !(await p.isVisible('.ta')), 'výchozí je vizuální editor (bez značek)');
  assert(await p.isVisible('.ed-panel .tb-label:has-text("Kdo zpívá")') && await p.isVisible('.ed-panel .tb-label:has-text("Údaje o písni")'), 'nástroje jsou v pravém panelu');

  // psaní a Enter
  await p.click('.ve');
  await p.keyboard.type('První řádek');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Druhý řádek');
  await sleep(200);
  assert(await src() === 'První řádek\nDruhý řádek', 'psaní a Enter vytvoří řádky');

  // zpěvák pro řádek (kurzor v řádku)
  await selectText('Druhý', null, null); // celý řádek
  await p.click('.sg-btn >> nth=0');
  await sleep(200);
  assert(/^@J Druhý řádek$/m.test(await src()), 'tlačítko zpěváka obarví řádek s kurzorem');
  assert(await p.evaluate(() => [...document.querySelectorAll('.ve-row')].find(r => r.textContent.includes('Druhý')).style.getPropertyValue('--c') !== ''), 'řádek má barvu zpěváka');
  assert(!(await p.evaluate(() => document.querySelector('.ve').textContent.includes('@J'))), 'v editoru nejsou vidět značky');

  // zpěvák jen pro slovo
  await selectText('První', 'První', 'První');
  await p.click('.sg-btn >> nth=1');
  await sleep(200);
  assert((await src()).includes('{T:První} řádek'), 'zpěvák jen pro označené slovo');

  // tučně
  await selectText('Druhý', 'řádek', 'řádek');
  await p.click('.ed-panel button[title^="Tučně"]');
  await sleep(200);
  assert((await src()).includes('@J Druhý **řádek**'), 'tučné písmo z panelu');
  // větší
  await selectText('Druhý', 'Druhý', 'Druhý');
  await p.click('.ed-panel button:has-text("Větší")');
  await sleep(200);
  assert((await src()).includes('{+:Druhý}'), 'větší písmo pro označený text');

  // Ctrl+Z
  await p.keyboard.press('Control+z'); await sleep(200);
  assert(!(await src()).includes('{+:'), 'Ctrl+Z vrátí poslední úpravu');
  await p.keyboard.press('Control+y'); await sleep(200);
  assert((await src()).includes('{+:Druhý}'), 'Ctrl+Y ji znovu provede');

  // sekce před první řádek
  await selectText('První', 'P', 'P');
  await p.click('.ed-panel button:has-text("Sekce")');
  await p.click('.modal button:has-text("Refrén")');
  await p.click('.modal button:has-text("Vložit")');
  await sleep(300);
  assert((await src()).startsWith('## Refrén\n{T:První}'), 'vložení nadpisu sekce');
  assert(await p.isVisible('.ve-sec:has-text("Refrén")'), 'sekce je v editoru vidět jako nadpis');

  // vložení více řádků s akordy (čištění)
  await selectText('Druhý', null, null);
  await p.keyboard.press('End');
  await p.evaluate(t => navigator.clipboard.writeText(t), 'Am        C\nTřetí řádek písně\nG\nČtvrtý');
  await p.keyboard.press('Control+V');
  await sleep(400);
  const s1 = await src();
  assert(s1.includes('[Am]Třetí řádek [C]písně') || /\[Am\].*Třetí/.test(s1), 'vložený text s akordy: akordy převedeny k textu');
  assert(await p.locator('.ve .vchord').count() >= 2, 'akordy jsou v editoru vidět nad textem');
  assert(!(await p.evaluate(() => document.querySelector('.ve').textContent.includes('[Am]'))), 'akordy nejsou psané jako značky');
  await sleep(500);
  assert(!(await p.evaluate(() => document.querySelector('.preview-wrap .stage').textContent.includes('Am'))), 'náhled čtečky akordy neukazuje');

  // opakování, poznámka, nová stránka
  await selectText('Čtvrtý', null, null); await p.keyboard.press('End');
  await p.click('.ed-panel button:has-text("Opakovat")');
  await p.click('.menu >> text=Refrén');
  await sleep(300);
  assert(/Čtvrtý\n>> Refrén/.test(await src()), 'vložení opakování refrénu');
  assert(await p.isVisible('.ve-rep:has-text("Refrén")'), 'opakování je vidět jako štítek');
  await p.click('.ed-panel button:has-text("Poznámka")');
  await p.keyboard.type('2× opakovat');
  await sleep(300);
  assert((await src()).includes('>> Refrén\n// 2× opakovat'), 'poznámka se vloží za opakování');
  await p.click('.ed-panel button:has-text("Nová stránka")');
  await sleep(300);
  assert((await src()).includes('---'), 'nová stránka');
  await p.screenshot({ path: SHOTS + '/v1-visual-wide.png' });
  // odebrání štítku
  await p.click('.ve-break .ve-x'); await sleep(300);
  assert(!(await src()).includes('---'), 'štítek nové stránky jde odebrat křížkem');

  // přepnutí na zdrojový text a zpět
  const before = await src();
  await p.click('button:has-text("Zobrazit zdrojový text")');
  await sleep(200);
  assert(await p.isVisible('.ta') && (await p.inputValue('.ta')) === before, 'zdrojový text odpovídá vizuálním úpravám');
  await p.fill('.ta', before + '\n@V Nový ze zdroje');
  await p.click('button:has-text("Zpět na vizuální úpravy")');
  await sleep(200);
  assert(await p.isVisible('.ve-row:has-text("Nový ze zdroje")'), 'změny ve zdroji se ukážou ve vizuálním editoru');

  // uložení
  await sleep(1900);
  const saved = await p.evaluate(() => [...Store.songs.values()].find(s => s.title === 'Vizuální').text);
  assert(saved.includes('@V Nový ze zdroje') && saved.includes('{T:První}'), 'automatické uložení');

  // šířky okna
  for (const [w, hgt, n] of [[1280, 800, 'v2-visual-mid'], [1000, 800, 'v3-visual-narrow']]) {
    await p.setViewportSize({ width: w, height: hgt }); await sleep(400);
    const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert(!over, `bez vodorovného přetékání při šířce ${w}`);
    await p.screenshot({ path: SHOTS + '/' + n + '.png' });
  }
  assert(errors.length === 0, 'žádné chyby JavaScriptu' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})().catch(e => { console.log('FAIL: výjimka', e); process.exit(1); });
