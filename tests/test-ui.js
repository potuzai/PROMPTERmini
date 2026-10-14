const { chromium } = require('playwright');
const assert = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } else console.log('ok: ' + m); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 850 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await ctx.addInitScript(() => { if (!localStorage.getItem('prompter-settings')) localStorage.setItem('prompter-settings', JSON.stringify({ welcomed: true })); });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://localhost:8123/index.html#/songs');
  await p.waitForFunction(() => typeof Store !== 'undefined' && Store.ready);
  // nová píseň
  await p.click('button:has-text("Nová píseň")');
  await p.fill('.modal input', 'Testovací');
  await p.keyboard.press('Enter');
  await p.waitForSelector('.ta');
  await p.waitForTimeout(300);
  const raw = 'Am        C\n1. První řádek sloky\nDruhý   řádek\n\n\n\nRef: Refrén první\nrefrén druhý\n\n2. Sloka dvě\nG D\nřádek\n\nR:\n';
  await p.evaluate(t => navigator.clipboard.writeText(t), raw);
  await p.focus('.ta');
  await p.keyboard.press('Control+V');
  await p.waitForTimeout(300);
  const v = await p.inputValue('.ta');
  console.log(v);
  assert(v.includes('## Sloka 1') && v.includes('## Refrén') && v.includes('>> Refrén') && v.includes('[Am] [C]') && !/^Am\s/m.test(v), 'čištění vloženého textu (akordy převedeny pro muzikanty)');
  // označit řádky 2-3 jako J
  await p.evaluate(() => { const ta = document.querySelector('.ta'); const i = ta.value.indexOf('První'); ta.setSelectionRange(i, ta.value.indexOf('řádek', i + 10)); });
  await p.keyboard.press('Alt+1');
  await p.waitForTimeout(200);
  const v2 = await p.inputValue('.ta');
  assert(v2.includes('@J První řádek sloky\n@J Druhý řádek'), 'Alt+1 označí vybrané řádky');
  await p.keyboard.press('Control+Z');
  await p.waitForTimeout(100);
  assert(!(await p.inputValue('.ta')).includes('@J'), 'Ctrl+Z vrátí označení');
  await p.keyboard.press('Control+Y');
  // štětec: klik v náhledu
  await p.click('.sg-btn >> nth=1'); // T – zároveň štětec
  await p.waitForTimeout(400);
  await p.click('.preview-wrap .b-line:has-text("refrén druhý")');
  await p.waitForTimeout(300);
  assert((await p.inputValue('.ta')).includes('@T refrén druhý'), 'klik v náhledu přiřadí zpěváka');
  await p.waitForTimeout(1800); // autosave
  const saved = await p.evaluate(() => [...Store.songs.values()].find(s => s.title === 'Testovací').text);
  assert(saved.includes('@T refrén druhý'), 'automatické uložení');
  await p.screenshot({ path: '/tmp/claude-0/shots/5-edit.png' });

  // playlist
  await p.evaluate(() => location.hash = '#/playlists');
  await p.click('button:has-text("Nový playlist")');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(400);
  await p.click('.lib-item:has-text("Testovací") button');
  await p.click('.lib-item:has-text("Ukázková") button');
  await p.waitForTimeout(300);
  const items = await p.$$eval('.pl-item b', els => els.map(e => e.textContent));
  assert(items.length === 2 && items[0] === 'Testovací', 'přidání do playlistu');
  await p.click('.pl-item >> nth=1 >> button[title=Nahoru]');
  await p.waitForTimeout(200);
  assert((await p.$$eval('.pl-item b', els => els.map(e => e.textContent)))[0].startsWith('Ukázková'), 'změna pořadí');
  await p.screenshot({ path: '/tmp/claude-0/shots/6-playlist.png' });
  // čtečka
  await p.click('button:has-text("Spustit ve čtečce")');
  await p.waitForTimeout(600);
  const pos = () => p.evaluate(() => [Reader.songIdx, Reader.pageIdx]);
  console.log('start', await pos());
  await p.mouse.click(700, 400, { button: 'right' }); await p.waitForTimeout(150);
  await p.mouse.click(700, 400, { button: 'right' }); await p.waitForTimeout(150);
  console.log('po 2x pravé', await pos());
  const p2 = await pos();
  await p.mouse.click(700, 400, { button: 'left' }); await p.waitForTimeout(150);
  const p3 = await pos();
  assert(JSON.stringify(p2) !== JSON.stringify(p3), 'levé tlačítko jde zpět');
  await p.keyboard.press('l'); await p.waitForTimeout(200);
  assert(await p.isVisible('.r-menu'), 'seznam písní (L)');
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  assert((await pos())[0] === 1, 'skok na píseň');
  await p.screenshot({ path: '/tmp/claude-0/shots/7-reader2.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  assert(!(await p.evaluate(() => Reader.isOpen())), 'Esc zavře čtečku');
  // PIN
  await p.evaluate(() => { Settings.set('pinHash', sha1Bytes(utf8.enc('prompter:1234'))); sessionStorage.removeItem('unlocked'); location.hash = '#/singers'; });
  await p.waitForTimeout(300);
  assert(await p.isVisible('.modal'), 'PIN je vyžadován');
  await p.fill('.modal input', '1234'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  assert(await p.isVisible('table.tbl'), 'odemčeno PINem');
  await b.close();
})();
