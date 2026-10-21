// Mobilní zobrazení (iPhone 13): žádné vodorovné přetékání, seznam ↔ detail, dotykové ovládání čtečky
const { chromium, devices } = require('playwright');
const assert = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } else console.log('ok: ' + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const URL = process.env.APP_URL || 'http://localhost:8123/index.html';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  await ctx.addInitScript(() => { if (!localStorage.getItem('prompter-settings')) localStorage.setItem('prompter-settings', JSON.stringify({ welcomed: true, readerFullscreen: false })); });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL + '#/songs'); await p.waitForFunction(() => typeof Store !== 'undefined' && Store.ready);
  await p.evaluate(async () => {
    const t = Array.from({ length: 40 }, (_, i) => '@J řádek ' + (i + 1)).join('\n');
    await Store.put('songs', { id: 'm1', title: 'Dlouhá', text: t });
    await Store.put('playlists', { id: 'mp', name: 'Mobil', date: '2026-10-16', templateId: '', note: '', items: [...Store.songs.keys()] });
  });
  const overflow = () => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('.content, .song-editor, .side')].some(c => c.offsetParent && c.scrollWidth > c.clientWidth + 2));
  for (const v of ['songs', 'songs/m1', 'playlists', 'playlists/mp', 'templates/default', 'singers', 'settings']) {
    await p.evaluate(h => { location.hash = '#/' + h; }, v); await sleep(400);
    assert(!(await overflow()), `bez vodorovného přetékání: ${v}`);
  }
  await p.evaluate(() => { location.hash = '#/songs'; }); await sleep(300);
  assert(await p.isVisible('.side') && !(await p.isVisible('.side + .content .song-editor')), 'seznam písní přes celou šířku');
  await p.tap('.side .item:has-text("Dlouhá")'); await sleep(500);
  assert(!(await p.isVisible('.side')) && await p.isVisible('.se-wrap .edit-stage'), 'po výběru se ukáže stránka čtečky');
  assert(await p.evaluate(() => { const r = document.querySelector('.se-wrap .stage').getBoundingClientRect(); return r.top < innerHeight / 2 && r.width > 150; }), 'stránka je hned nahoře');
  await p.tap('.se-wrap .b-line:has-text("řádek 3")'); await sleep(200);
  await p.keyboard.press('End'); await p.keyboard.type(' x'); await sleep(200);
  assert(await p.evaluate(() => SongsView.editor.src.includes('@J řádek 3 x')), 'psaní v telefonu (klepnout do řádku a psát)');
  await p.keyboard.press('Escape');
  await p.keyboard.press('Control+S'); await sleep(200);
  await p.tap('.ep-back'); await sleep(300);
  assert(await p.isVisible('.side'), 'tlačítko zpět vede na seznam');
  await p.evaluate(() => { location.hash = '#/reader/mp'; }); await sleep(500);
  const pos = () => p.evaluate(() => Reader.songIdx + ':' + Reader.pageIdx);
  const start = await pos();
  await p.touchscreen.tap(330, 500); await sleep(200);
  const afterNext = await pos();
  assert(afterNext !== start, 'klepnutí vpravo = další');
  await p.touchscreen.tap(40, 500); await sleep(200);
  assert(await pos() === start, 'klepnutí vlevo = zpět');
  await p.touchscreen.tap(200, 40); await sleep(200);
  assert(await p.isVisible('.r-menu'), 'klepnutí nahoru = seznam písní');
  await p.tap('.r-tool[title^="Zavřít čtečku"]'); await sleep(300);
  assert(!(await p.evaluate(() => Reader.isOpen())), 'čtečku jde na mobilu zavřít');
  assert(errors.length === 0, 'žádné chyby JavaScriptu' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
})().catch(e => { console.log('FAIL: výjimka', e); process.exit(1); });
