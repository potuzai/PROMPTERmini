const { chromium } = require('playwright');
const assert = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } else console.log('ok: ' + m); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 850 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await ctx.addInitScript(() => { if (!localStorage.getItem('prompter-settings')) localStorage.setItem('prompter-settings', JSON.stringify({ welcomed: true })); });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  // úvodní stránka: playlisty, adresa bez #
  await p.goto('http://localhost:8123/');
  await p.waitForFunction(() => typeof Store !== 'undefined' && Store.ready); await p.waitForTimeout(300);
  assert(!(new URL(p.url())).hash && await p.isVisible('#topbar .tab.active:has-text("Playlisty")') && (await p.textContent('#topbar .tabs .tab')).includes('Playlisty'), 'úvodní stránka: playlisty jako první, čistá adresa');
  await p.click('#topbar .tab:has-text("Písně")'); await p.waitForTimeout(200);
  await p.click('#topbar .tab:has-text("Playlisty")'); await p.waitForTimeout(200);
  assert(!(new URL(p.url())).hash, 'návrat na playlisty: adresa zase bez #');
  await p.goBack(); await p.waitForTimeout(300);
  assert((new URL(p.url())).hash === '#/songs' && await p.isVisible('#topbar .tab.active:has-text("Písně")'), 'tlačítko Zpět funguje');
  // přihlašovací formulář pro správce hesel (Proton Pass, Bitwarden, prohlížeč)
  await p.evaluate(() => { loginDialog(); }); await p.waitForSelector('.modal form.login');
  const lf = await p.evaluate(() => { const f = document.querySelector('.modal form.login'); return {
    user: !!f.querySelector('input[type=email][autocomplete=username][name=username]'), pw: !!f.querySelector('input[type=password][autocomplete=current-password]'),
    submit: !!f.querySelector('button[type=submit]'), fields: f.querySelectorAll('input:not([type=checkbox])').length, details: f.querySelectorAll('details').length }; });
  assert(lf.user && lf.pw && lf.submit && lf.fields === 2 && !lf.details, 'přihlášení je jednoduchý formulář: jen e-mail, heslo a odeslání (bez skrytých „dalších možností“)');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  assert(!(await p.isVisible('.modal')), 'přihlášení jde zavřít Esc');
  await p.goto('http://localhost:8123/index.html#/songs');
  await p.waitForFunction(() => typeof Store !== 'undefined' && Store.ready);
  // nová píseň
  await p.click('button:has-text("Nová píseň")');
  await p.fill('.modal input', 'Testovací');
  await p.keyboard.press('Enter');
  await p.waitForSelector('.se-wrap .edit-stage');
  await p.waitForTimeout(300);
  const src = () => p.evaluate(() => SongsView.editor.src);
  const raw = 'Am        C\n1. První řádek sloky\nDruhý   řádek\n\n\n\nRef: Refrén první\nrefrén druhý\n\n2. Sloka dvě\nG D\nřádek\n\nR:\n';
  await p.evaluate(t => navigator.clipboard.writeText(t), raw);
  await p.focus('.se-wrap');
  await p.keyboard.press('Control+V');
  await p.waitForTimeout(300);
  const v = await src();
  console.log(v);
  assert(v.includes('## Sloka 1') && v.includes('## Refrén') && v.includes('>> Refrén') && v.includes('[Am] [C]') && !/^Am\s/m.test(v), 'čištění vloženého textu (akordy převedeny pro muzikanty)');
  // označit 2 řádky jako J (klik + Shift+klik, Alt+1)
  await p.click('.se-wrap .b-line:has-text("První řádek")');
  await p.click('.se-wrap .b-line:has-text("Druhý řádek")', { modifiers: ['Shift'] });
  await p.keyboard.press('Alt+1');
  await p.waitForTimeout(200);
  assert((await src()).includes('@J První řádek sloky\n@J Druhý řádek'), 'Alt+1 označí vybrané řádky');
  await p.keyboard.press('Control+Z');
  await p.waitForTimeout(100);
  assert(!(await src()).includes('@J'), 'Ctrl+Z vrátí označení');
  await p.keyboard.press('Control+Y');
  assert((await src()).includes('@J'), 'Ctrl+Y znovu');
  // tlačítko zpěváka v panelu
  await p.click('.se-wrap .b-line:has-text("refrén druhý")');
  await p.click('.ed-panel .sw >> nth=1');
  await p.waitForTimeout(300);
  assert((await src()).includes('@T refrén druhý'), 'tlačítko zpěváka obarví vybraný řádek');
  await p.waitForTimeout(1800); // autosave
  const saved = await p.evaluate(() => [...Store.songs.values()].find(s => s.title === 'Testovací').text);
  assert(saved.includes('@T refrén druhý'), 'automatické uložení');
  await p.screenshot({ path: '/tmp/claude-0/shots/5-edit.png' });

  // playlist
  await p.evaluate(() => location.hash = '#/playlists');
  await p.click('button:has-text("Nový playlist")');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(400);
  // přidání psaním (Enter přidá shodu) a výběrem z knihovny (zaškrtnout, Přidat vybrané)
  await p.fill('.pl-add .qa input', 'Testovací');
  await p.keyboard.press('Enter');
  await p.click('button:has-text("Vybrat z knihovny")');
  await p.fill('.pick-dlg input[type=search]', 'Ukázková');
  await p.click('.pick-row:has-text("Ukázková")');
  assert(await p.isVisible('.modal-buttons .primary:has-text("Přidat vybrané (1)")'), 'výběr z knihovny: počet vybraných');
  await p.click('.modal-buttons .primary');
  await p.waitForTimeout(300);
  const items = await p.$$eval('.pl-item b', els => els.map(e => e.textContent));
  assert(items.length === 2 && items[0] === 'Testovací', 'přidání do playlistu');
  await p.click('.pl-item >> nth=1 >> button[title=Nahoru]');
  await p.waitForTimeout(200);
  assert((await p.$$eval('.pl-item b', els => els.map(e => e.textContent)))[0].startsWith('Ukázková'), 'změna pořadí');
  // číslo pozice: 1. píseň na pozici 2, obsazeno → Prohodit
  await p.click('.pl-item >> nth=0 >> .num');
  await p.keyboard.press('Control+a'); await p.keyboard.type('2'); await p.keyboard.press('Enter');
  await p.click('.modal-buttons button:has-text("Prohodit")');
  await p.waitForTimeout(200);
  assert((await p.$$eval('.pl-item b', els => els.map(e => e.textContent)))[0] === 'Testovací', 'přesun na zadanou pozici (prohodit)');
  // a zpět: 2. píseň na pozici 1 → Vložit a posunout (pořadí jako předtím, čtečka níže s ním počítá)
  await p.click('.pl-item >> nth=1 >> .num');
  await p.keyboard.press('Control+a'); await p.keyboard.type('1'); await p.keyboard.press('Enter');
  await p.click('.modal-buttons button:has-text("Vložit a posunout")');
  await p.waitForTimeout(200);
  assert((await p.$$eval('.pl-item b', els => els.map(e => e.textContent)))[0].startsWith('Ukázková'), 'přesun na zadanou pozici (vložit a posunout)');
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
