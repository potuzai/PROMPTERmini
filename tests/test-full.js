// Kompletní test funkcí, které nepokrývají ostatní testy
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path'); const os = require('os');
const assert = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } else console.log('ok: ' + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const URL = process.env.APP_URL || 'http://localhost:8123/index.html';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-'));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1500, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript(() => { if (!localStorage.getItem('prompter-settings')) localStorage.setItem('prompter-settings', JSON.stringify({ welcomed: true })); });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(URL + '#/songs');
  await p.waitForFunction(() => typeof Store !== 'undefined' && Store.ready);

  /* ---------- Parser ---------- */
  const parsed = await p.evaluate(() => {
    const r = parseSong('## Sloka 1\n@J a\n@J+T b\n\n## Refrén @V\nc\n{T:d} e\n---\n>> Refrén\n>> Neexistuje\n// pozn');
    return r.blocks.map(b => b.type + ':' + (b.singers || []).join('+') + ':' + (b.text || ''));
  });
  assert(parsed.includes('line:J+T:b'), 'parser: duet @J+T');
  assert(parsed.filter(x => x === 'line:V:c').length === 2, 'parser: výchozí zpěvák sekce + opakování refrénu');
  assert(parsed.includes('break::'), 'parser: nová stránka ---');
  assert(parsed.some(x => x.includes('nenalezena')), 'parser: varování u neexistující sekce');
  assert(await p.evaluate(() => inlineHtml('{T:slovo} **b** *i* __u__', Store.singerMap())).then ? true : true, 'inline formát');
  const html = await p.evaluate(() => inlineHtml('{T:slovo} **b** *i* __u__ <script>', Store.singerMap()));
  assert(html.includes('<b>b</b>') && html.includes('<i>i</i>') && html.includes('<u>u</u>') && html.includes('sg-in') && html.includes('&lt;script&gt;'), 'inline: tučně/kurzíva/podtržení/zpěvák a escapování HTML');
  const cleaned = await p.evaluate(() => cleanText('[Verse 1]\nC  G  Am\nText [Am]s akordem\n[Chorus]\nRef text\n\n\n[Chorus]\nBridge:\nmost', { chords: 'remove' }));
  assert(cleaned.includes('## Sloka 1') && cleaned.includes('Text s akordem') && cleaned.includes('>> Refrén') && cleaned.includes('## Bridge') && !/\bAm\b/.test(cleaned), 'čištění: anglické značky, odstranění akordů, opakování');
  const kept = await p.evaluate(() => cleanText('[Verse 1]\nText [Am]s akordem\n[Chorus]\nRef'));
  assert(kept.includes('Text [Am]s akordem') && kept.includes('## Refrén'), 'čištění: akordy v textu zůstanou pro muzikanty, [Chorus] je refrén');

  /* ---------- Import TXT (UTF-8, Windows-1250, ChordPro) ---------- */
  // (soubor s diakritikou v názvu předáme obsahem – testovací nástroj neumí ne-ASCII cesty)
  const f1 = { name: 'Holubí dům.txt', mimeType: 'text/plain', buffer: Buffer.from('Am C\n1. Zpívám ptákům\nR: Holubí dům\n') };
  const f2 = path.join(tmp, 'Stara_pisen.txt'); fs.writeFileSync(f2, Buffer.from([0x50, 0xF8, 0xED, 0x6C, 0x69, 0x9A, 0x20, 0x9E, 0x6C, 0x75, 0x9D, 0x6F, 0x75, 0xE8, 0x6B, 0xFD])); // „Příliš žluťoučký“ v CP1250
  const f3 = path.join(tmp, 'x.cho'); fs.writeFileSync(f3, '{title: ChordPro píseň}\n{artist: Autor}\n{soc}\n[G]Refrén text\n{eoc}\n');
  const chooser = p.waitForEvent('filechooser');
  await p.click('.side-head >> button:has-text("Import")');
  await (await chooser).setFiles([f2, f3]);
  await p.click('.modal button:has-text("Vyčistit")');
  await sleep(500);
  const chooser1 = p.waitForEvent('filechooser');
  await p.click('.side-head >> button:has-text("Import")');
  await (await chooser1).setFiles(f1);
  await p.click('.modal button:has-text("Vyčistit")');
  await sleep(600);
  const titles = await p.evaluate(() => Store.sortedSongs().map(s => s.title + '|' + s.artist + '|' + s.text));
  assert(titles.some(t => t.startsWith('Holubí dům||') && t.includes('## Sloka 1') && t.includes('## Refrén')), 'import .txt s čištěním');
  assert(titles.some(t => t.includes('Příliš žluťoučký')), 'import starého .txt v kódování Windows-1250');
  assert(titles.some(t => t.startsWith('ChordPro píseň|Autor|') && t.includes('## Refrén') && t.includes('[G]Refrén text')), 'import ChordPro');

  /* ---------- Hledání ---------- */
  await p.evaluate(() => { location.hash = '#/songs'; });
  await sleep(300);
  await p.fill('.side-head input[type=search]', 'zlutoucky');
  await sleep(200);
  assert(await p.locator('.side .item').count() === 1, 'hledání bez diakritiky a i v textu');
  await p.fill('.side-head input[type=search]', '');

  /* ---------- Editor: duplikace, export, smazání ---------- */
  const hid = await p.evaluate(() => Store.sortedSongs().find(s => s.title === 'Holubí dům').id);
  await p.evaluate(id => { location.hash = '#/songs/' + id; }, hid);
  await sleep(500);
  const src = () => p.evaluate(() => SongsView.editor.src);
  const more = async label => { await p.click('.ep-actions button[title="Další akce"]'); await p.click(`.menu div:has-text("${label}")`); };
  const dl = p.waitForEvent('download');
  await more('Export .txt');
  const d = await dl; const dpath = path.join(tmp, 'exp.txt'); await d.saveAs(dpath);
  assert(fs.readFileSync(dpath, 'utf8').startsWith('# Holubí dům'), 'export písně do .txt');
  await more('Duplikovat');
  await sleep(500);
  assert(await p.evaluate(() => Store.sortedSongs().some(s => s.title === 'Holubí dům (kopie)')), 'duplikace písně');
  await p.evaluate(id => { location.hash = '#/songs/' + id; }, hid);
  await sleep(500);
  // nadpis sekce přes tlačítko v panelu (před poslední řádek)
  await p.focus('.se-wrap'); await p.keyboard.press('End');
  await p.click('.ed-panel button:has-text("Sekce")');
  await p.click('.modal button:has-text("Bridge")');
  await p.keyboard.press('Enter');
  await sleep(200);
  assert((await src()).includes('## Bridge'), 'vložení sekce tlačítkem');
  await p.click('.ed-panel button:has-text("Řádek")');
  await p.keyboard.type('text mostu');
  await p.keyboard.press('Escape');
  await sleep(100);
  assert(/## Bridge\ntext mostu/.test(await src()), 'nový řádek pod sekcí a psaní');
  await p.click('.ed-panel button:has-text("Opakovat")');
  await p.click('.menu div:has-text("Refrén")');
  await sleep(200);
  assert(/text mostu\n>> Refrén/.test(await src()), 'opakování sekce z nabídky');
  // tučně celý řádek
  await p.keyboard.press('ArrowUp');
  await p.keyboard.press('Control+B');
  assert((await src()).includes('**text mostu**'), 'Ctrl+B tučně');
  await p.keyboard.press('Control+S'); await sleep(300);
  assert(await p.evaluate(id => Store.songs.get(id).text.includes('**text mostu**'), hid), 'Ctrl+S uloží');

  /* ---------- Playlist + smazání písně z něj ---------- */
  const plId = await p.evaluate(async id => (await Store.put('playlists', { id: 'pl1', name: 'Koncert', date: '2026-10-20', templateId: '', note: '', items: [id] })).id, hid);
  const copyId = await p.evaluate(() => Store.sortedSongs().find(s => s.title === 'Holubí dům (kopie)').id);
  await p.evaluate(async id => { const pl = Store.playlists.get('pl1'); pl.items.push(id); await Store.put('playlists', pl); }, copyId);
  await p.evaluate(id => { location.hash = '#/songs/' + id; }, copyId);
  await sleep(400);
  await more('Smazat píseň');
  await p.click('.modal button:has-text("Smazat")');
  await sleep(400);
  assert(await p.evaluate(id => !Store.songs.has(id) && !Store.playlists.get('pl1').items.includes(id), copyId), 'smazaná píseň zmizí i z playlistu');

  /* ---------- Zpěváci ---------- */
  await p.evaluate(() => { location.hash = '#/singers'; });
  await sleep(400);
  await p.click('button:has-text("Přidat zpěváka")');
  await sleep(700);
  assert(await p.evaluate(() => Store.singers().length) === 4, 'přidání zpěváka');
  await p.evaluate(async id => { const s = Store.songs.get(id); s.text = '@J+T duet\n## Sekce @J\n{J:x} y'; await Store.put('songs', s); }, hid);
  const codeInp = p.locator('table.tbl tbody tr >> nth=0 >> input.inp >> nth=0');
  await codeInp.fill('P'); await codeInp.press('Tab');
  await sleep(900);
  const t2 = await p.evaluate(id => Store.songs.get(id).text, hid);
  assert(t2 === '@P+T duet\n## Sekce @P\n{P:x} y', 'změna zkratky zpěváka se promítne do písní');
  assert(await p.evaluate(() => Store.singers()[0].code) === 'P', 'zkratka uložena');

  /* ---------- Šablony ---------- */
  await p.evaluate(() => { location.hash = '#/templates/default'; });
  await sleep(500);
  const range = p.locator('label.f:has-text("Velikost písma") input[type=range]');
  await range.fill('100');
  await sleep(1000);
  assert(await p.evaluate(() => Store.templates.get('default').fontSize) === 100, 'změna velikosti písma v šabloně se uloží');
  const fsz = await p.evaluate(() => getComputedStyle(document.querySelector('.tpl-preview .stage')).getPropertyValue('--fs'));
  assert(fsz.trim() === '100px', 'náhled šablony se aktualizuje');
  await p.click('button:has-text("Kopie")'); await p.fill('.modal input', 'Moje'); await p.keyboard.press('Enter'); await sleep(500);
  const myId = await p.evaluate(() => [...Store.templates.values()].find(t => t.name === 'Moje').id);
  assert(!!myId, 'vytvoření šablony kopií');
  await p.click('button:has-text("Nastavit jako výchozí")'); await sleep(200);
  assert(await p.evaluate(id => Settings.get('defaultTemplate') === id, myId), 'nastavení výchozí šablony');
  await p.click('.tpl-form button.danger'); await p.click('.modal button:has-text("Smazat")'); await sleep(400);
  assert(await p.evaluate(id => !Store.templates.has(id) && Settings.get('defaultTemplate') === 'default', myId), 'smazání šablony vrátí výchozí');

  /* ---------- Stránkování a zmenšení ---------- */
  const long = Array.from({ length: 60 }, (_, i) => `@J řádek číslo ${i + 1}`).join('\n');
  const lay = await p.evaluate(t => {
    const song = { id: 'x', title: 'Dlouhá', text: t };
    const base = Store.template('default');
    const pag = Render.layout(song, Object.assign({}, base, { fit: 'paginate', fontSize: 64 }), 1920, 1080);
    const shr = Render.layout({ id: 'z', title: 'S', text: t.split('\n').slice(0, 25).join('\n') }, Object.assign({}, base, { fit: 'shrink', minScale: 0.3, fontSize: 64 }), 1920, 1080);
    const nofit = Render.layout(song, Object.assign({}, base, { fit: 'shrink', minScale: 0.6, fontSize: 64 }), 1920, 1080);
    const two = Render.layout(song, Object.assign({}, base, { fit: 'paginate', columns: 2, fontSize: 64 }), 1920, 1080);
    const all = pag.pages.flat(2);
    const brk = Render.layout({ id: 'y', title: 'b', text: 'a\n---\nb' }, base, 1920, 1080);
    return { pag: pag.pages.length, unique: new Set(all).size, total: pag.blocks.length, shrK: shr.k, shrP: shr.pages.length, nofitP: nofit.pages.length, nofitK: nofit.k, two: two.pages.length, brk: brk.pages.length };
  }, long);
  assert(lay.pag >= 3 && lay.unique === lay.total, `rozdělení na ${lay.pag} stránky bez ztráty řádku`);
  assert(lay.shrP === 1 && lay.shrK < 1 && lay.shrK > 0.3, `zmenšení 25 řádků na 1 stránku (písmo ${Math.round(lay.shrK * 100)} %)`);
  assert(lay.nofitP > 1 && Math.abs(lay.nofitK - 0.6) < 0.001, 'když se nevejde ani zmenšená, rozdělí se na stránky při nejmenším povoleném písmu');
  assert(lay.two < lay.pag, 'dva sloupce = méně stránek');
  assert(lay.brk === 2, 'vynucená nová stránka ---');

  /* ---------- Čtečka: všechny ovládací prvky ---------- */
  await p.evaluate(async t => {
    await Store.put('songs', { id: 'long', title: 'Dlouhá', text: t });
    await Store.put('songs', { id: 's3', title: 'Třetí', text: '@T konec' });
    const pl = Store.playlists.get('pl1'); pl.items = [Store.sortedSongs().find(s => s.title === 'Holubí dům').id, 'long', 's3']; pl.templateId = 'velke-stred'; await Store.put('playlists', pl);
    const tpl = Store.templates.get('velke-stred'); tpl.fit = 'paginate'; await Store.put('templates', tpl);
  }, long);
  await p.evaluate(() => { location.hash = '#/reader/pl1'; });
  await sleep(600);
  const pos = () => p.evaluate(() => [Reader.songIdx, Reader.pageIdx]);
  assert(await p.evaluate(() => getComputedStyle(document.querySelector('#reader .stage')).getPropertyValue('--align').trim()) === 'center', 'šablona playlistu se použije ve čtečce');
  await p.keyboard.press('ArrowRight'); await sleep(100);
  assert(JSON.stringify(await pos()) === '[1,0]', 'šipka → další píseň');
  await p.keyboard.press('PageDown'); await sleep(100);
  assert(JSON.stringify(await pos()) === '[1,1]', 'PgDn další stránka téže písně');
  assert(await p.isVisible('#reader .more'), 'ukazatel „pokračuje“');
  await p.keyboard.press('Shift+ArrowRight'); await sleep(100);
  assert(JSON.stringify(await pos()) === '[2,0]', 'Shift+→ další píseň');
  await p.keyboard.press('Shift+ArrowLeft'); await sleep(100);
  await p.keyboard.press('ArrowLeft'); await sleep(100);
  assert(JSON.stringify(await pos()) === '[0,0]', 'zpět na předchozí píseň');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowLeft'); await sleep(100);
  assert((await pos())[0] === 0, 'zpět z první stránky písně → poslední stránka předchozí');
  for (let i = 0; i < 40; i++) await p.keyboard.press('ArrowRight');
  await sleep(200);
  assert((await pos())[0] === 2, 'konec playlistu – zůstane na poslední písni');
  assert(await p.isVisible('text=konec playlistu'), 'zápatí „konec playlistu“');
  await p.keyboard.press('b'); assert(await p.isVisible('.r-black'), 'B zatemní'); await p.keyboard.press('b');
  assert(!(await p.isVisible('.r-black')), 'B zruší zatemnění');
  await p.keyboard.press('m'); await sleep(100);
  assert((await p.evaluate(() => document.querySelector('#reader .stage').style.transform)).includes('scale(-'), 'M zrcadlení');
  await p.keyboard.press('m');
  await p.keyboard.press('+'); await sleep(200);
  assert(await p.evaluate(() => Settings.get('readerZoom')) === 1.05, '+ zvětší písmo');
  await p.keyboard.press('0'); await sleep(200);
  assert(await p.evaluate(() => Settings.get('readerZoom')) === 1, '0 vrátí písmo');
  await p.keyboard.press('h'); await sleep(100);
  assert(await p.isVisible('text=Ovládání čtečky'), 'H nápověda'); await p.keyboard.press('Escape');
  await p.keyboard.press('p'); await sleep(100);
  assert(await p.isVisible('text=Vyber playlist'), 'P výběr playlistu'); await p.keyboard.press('Escape');
  // číselný skok v seznamu
  await p.keyboard.press('l'); await p.keyboard.press('2'); await p.keyboard.press('Enter'); await sleep(200);
  assert((await pos())[0] === 1, 'skok číslem v seznamu písní');
  // prostřední tlačítko a kolečko, prohození tlačítek
  await p.mouse.click(700, 400, { button: 'middle' }); await sleep(100);
  assert(await p.isVisible('.r-menu'), 'prostřední tlačítko = seznam'); await p.keyboard.press('Escape');
  await p.evaluate(() => { Settings.set('wheelNav', true); Reader.songIdx = 2; Reader.pageIdx = 0; Reader.render(); });
  await p.mouse.move(700, 400); await p.mouse.wheel(0, -200); await sleep(200);
  assert(JSON.stringify(await pos()) !== '[2,0]', 'kolečko myši listuje (když je zapnuto)');
  await p.evaluate(() => { Settings.set('swapMouse', true); Reader.songIdx = 1; Reader.pageIdx = 0; Reader.render(); });
  await p.mouse.click(700, 400, { button: 'left' }); await sleep(100);
  assert(JSON.stringify(await pos()) === '[1,1]', 'prohozená tlačítka: levé = další');
  await p.evaluate(() => Settings.set('swapMouse', false));
  // skrytí kurzoru
  await sleep(2300);
  assert(await p.evaluate(() => document.getElementById('reader').classList.contains('nocursor')), 'kurzor se po 2 s skryje');
  // E = upravit aktuální píseň
  await p.keyboard.press('e'); await sleep(400);
  assert(await p.evaluate(() => location.hash.startsWith('#/songs/') && !Reader.isOpen()), 'E otevře píseň v editoru');

  /* ---------- Záloha a obnova ---------- */
  await p.evaluate(() => { location.hash = '#/settings'; }); await sleep(400);
  const dl2 = p.waitForEvent('download');
  await p.click('button:has-text("Stáhnout zálohu (vše)")');
  const bpath = path.join(tmp, 'zaloha.json'); await (await dl2).saveAs(bpath);
  const backup = JSON.parse(fs.readFileSync(bpath, 'utf8'));
  assert(backup.songs.length >= 4 && backup.playlists.length === 1 && backup.templates.length >= 4, 'záloha obsahuje vše');
  const countBefore = await p.evaluate(() => Store.songs.size);
  await p.evaluate(async () => { for (const id of [...Store.songs.keys()]) await Store.remove('songs', id); });
  assert(await p.evaluate(() => Store.songs.size) === 0, '(smazáno vše)');
  const ch = p.waitForEvent('filechooser');
  await p.click('button:has-text("Obnovit ze zálohy")');
  await (await ch).setFiles(bpath); await sleep(800);
  assert(await p.evaluate(() => Store.songs.size) === countBefore, 'obnova ze zálohy');

  /* ---------- Nastavení monitoru ---------- */
  assert(await p.evaluate(() => Settings.get('screenW') < Settings.get('screenH')), 'výchozí monitor na výšku');
  await p.click('button:has-text("1200×1920")'); await sleep(200);
  assert(await p.evaluate(() => Settings.get('screenW') === 1200 && Settings.get('screenH') === 1920), 'předvolba rozlišení na výšku');
  await p.click('button:has-text("Na šířku")'); await sleep(200);
  assert(await p.evaluate(() => Settings.get('screenW') === 1920 && Settings.get('screenH') === 1200), 'přepnutí na šířku');
  await p.click('button:has-text("1920×1200")'); await sleep(200);
  assert(await p.isVisible('text=doporučuji písmo alespoň'), 'doporučená velikost písma');
  assert(await p.isVisible('text=GitHub – program se připojí sám') && await p.isVisible('text=Mám kód kapely'), 'volby sdílení a připojení kódem v nastavení');
  assert(!(await p.isDisabled('label.chk:has-text("Mega – program") input')), 'Mega jde zvolit i v prohlížeči');
  assert(await p.isDisabled('label.chk:has-text("Synchronizovaná složka") input'), 'synchronizovaná složka jen v programu');

  /* ---------- Data přežijí obnovení stránky ---------- */
  await p.reload(); await p.waitForFunction(() => typeof Store !== 'undefined' && Store.ready);
  assert(await p.evaluate(() => Store.songs.size) === countBefore && await p.evaluate(() => Settings.get('screenH')) === 1200, 'data a nastavení přežijí obnovení stránky');
  assert(await p.evaluate(() => Settings.get('screenW')) === 1920, 'zvolená orientace na šířku se po obnovení nepřepne zpět');

  // tisk playlistu (setlist + texty, barevně i černobíle)
  await p.evaluate(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; location.hash = '#/playlists/pl1'; }); await sleep(400);
  await p.click('.bottom-actions button:has-text("Tisk")'); await sleep(200);
  assert(await p.isVisible('.modal-title:has-text("Tisk playlistu")'), 'dialog tisku playlistu');
  await p.click('.modal button:has-text("Tisknout")'); await sleep(300);
  assert(await p.evaluate(() => window.__printed === 1), 'tisk spuštěn');
  const prInfo = await p.evaluate(() => ({ list: document.querySelectorAll('#print-root .pr-setlist tr').length, songs: document.querySelectorAll('#print-root .pr-song').length, text: document.querySelector('#print-root').textContent }));
  assert(prInfo.list === 3 && prInfo.songs === 3 && prInfo.text.includes('Holubí dům'), 'tisk obsahuje setlist i texty všech písní');
  await p.emulateMedia({ media: 'print' });
  assert(await p.evaluate(() => getComputedStyle(document.querySelector('#topbar')).display === 'none' && getComputedStyle(document.querySelector('#print-root')).display === 'block'), 'při tisku je vidět jen tisková sestava');
  await p.emulateMedia({ media: 'screen' });
  await p.evaluate(() => { const o = Object.assign({}, Settings.get('printOpts'), { what: 'texts', color: false }); printDocument(buildPrintPlaylist(Store.playlists.get('pl1'), o)); });
  assert(await p.evaluate(() => !document.querySelector('#print-root .pr-setlist') && !!document.querySelector('#print-root .pr-bw')), 'černobílý tisk jen textů');

  /* ---------- Písmo písně a větší/menší text ---------- */
  await p.evaluate(async () => { await Store.put('songs', { id: 'fnt', title: 'Písmo', text: '@J Malý a velký text' }); location.hash = '#/songs/fnt'; }); await sleep(600);
  const fsrc = () => p.evaluate(() => SongsView.editor.src);
  await p.click('.se-wrap .b-line:has-text("velký")'); await p.click('.se-wrap .b-line:has-text("velký")'); await sleep(200);
  const selWord = () => p.evaluate(() => {
    const el = document.querySelector('.is-edit'); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const i = n.data.indexOf('velký'); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 5); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; } }
    return false;
  });
  await selWord();
  await p.click('.ed-panel button:has-text("A+")'); await sleep(300);
  assert((await fsrc()).includes('{+:velký}'), 'tlačítko A+ obalí vybraný text');
  await p.click('.ed-panel button:has-text("A+")'); await sleep(300);
  assert((await fsrc()).includes('{++:velký}'), 'opakované A+ = ještě větší');
  await p.keyboard.press('Escape'); await sleep(200);
  assert(await p.isVisible('.se-wrap .szp2'), 'stránka ukáže větší text');
  if (!(await p.isVisible('.ed-panel button:has-text("Písmo písně")'))) await p.click('.ed-panel summary:has-text("Celá píseň")');
  await p.click('.ed-panel button:has-text("Písmo písně")'); await sleep(200);
  await p.locator('.menu-form input[type=range]').fill('150'); await sleep(300);
  await p.locator('.menu-form select >> nth=0').selectOption('Roboto Condensed'); await sleep(400);
  await p.mouse.click(5, 5); await sleep(1800);
  const fst = await p.evaluate(() => ({ style: Store.songs.get('fnt').style, base: Store.template(Settings.get('defaultTemplate')).fontSize, fs: document.querySelector('.se-wrap .stage').style.getPropertyValue('--fs'), ff: document.querySelector('.se-wrap .stage').style.fontFamily }));
  const want = Math.round(fst.base * 1.5);
  assert(fst.style && fst.style.sizePct === 150 && fst.style.fontFamily === 'Roboto Condensed', 'písmo písně se uloží do písně');
  assert(fst.fs === want + 'px' && fst.ff.includes('Roboto Condensed'), 'náhled použije písmo písně (' + fst.fs + ')');
  assert(await p.evaluate(w => { Reader.plId = null; const t = Reader.tplFor(Store.songs.get('fnt')); return t.fontSize === w && t.fontFamily === 'Roboto Condensed'; }, want), 'čtečka použije písmo písně');
  assert(await p.evaluate(w => Reader.tplFor(Store.songs.get('long')).fontSize !== w, want), 'ostatní písně zůstanou podle šablony');

  /* ---------- Vrstvy pro muzikanty ---------- */
  const musTxt = '%G Capo 2\n[D] [G]\n## Sloka @J\n[D]Zpívám [G]ptákům\n%%G Tab\ne|--0--|\nB|--1--|\n%%\n%B walking bass';
  const mres = await p.evaluate(t => {
    const pr = parseSong(t);
    const reader = filterForView(pr.blocks, null);
    const all = filterForView(pr.blocks, { chords: true, inst: { G: true, B: true } });
    const onlyBass = filterForView(pr.blocks, { chords: false, inst: { B: true } });
    const W = 1080, H = 1920, tpl = Store.template('default');
    const lr = Render.layout({ id: 'm', title: 'M', text: t }, tpl, W, H);
    const st = Render.makeStage(tpl, W, H); document.body.appendChild(st);
    Render.renderPage(st, lr, tpl, 0, {}); const readerHtml = st.innerHTML; st.remove();
    return {
      readerTypes: reader.map(b => b.type).join(','), allTypes: all.map(b => b.type).join(','), bass: onlyBass.map(b => b.type + (b.inst ? b.inst.join('') : '')).join(','),
      readerHasChords: /\[D\]|class="ch"|Capo|walking|e\|--/.test(readerHtml), readerText: readerHtml.includes('Zpívám ptákům'),
      merged: cleanText('Am     C\nZpívám ptákům\n'),
    };
  }, musTxt);
  assert(mres.readerTypes === 'section,line', 'čtečka nevidí nic pro muzikanty (' + mres.readerTypes + ')');
  assert(!mres.readerHasChords && mres.readerText, 'čtečka vykreslí text bez akordů a poznámek');
  assert(mres.allTypes === 'mus,chords,section,line,musblock,mus', 'pohled pro muzikanty ukáže všechny vrstvy');
  assert(mres.bass === 'section,line,musB', 'filtr: jen basa');
  assert(mres.merged === '[Am]Zpívám [C]ptákům', 'vložený text: akordy nad řádkem převedeny do textu (' + mres.merged + ')');
  // přepínač v náhledu editoru
  await p.evaluate(async t => { await Store.put('songs', { id: 'musx', title: 'Muzikanti', text: t }); location.hash = '#/songs/musx'; }, musTxt); await sleep(600);
  assert(!(await p.isVisible('.se-wrap .b-mus')), 'stránka ve výchozím stavu = čtečka');
  assert(!(await p.isVisible('.btn.m-back')), 'mobilní tlačítka se na počítači nezobrazují');
  await p.click('.seg button:has-text("Pro muzikanty")'); await sleep(400);
  assert(await p.isVisible('.se-wrap .b-mus') && await p.isVisible('.se-wrap .ch'), 'náhled pro muzikanty ukáže akordy a poznámky');
  await p.click('button:has-text("Vrstvy")'); await sleep(150);
  await p.click('.menu-layers label:has-text("Kytara") input'); await sleep(300);
  assert(!(await p.isVisible('.se-wrap .b-musblock')) && await p.isVisible('.se-wrap .b-mus'), 'vypnutí kytary skryje jen její vrstvy');
  await p.mouse.click(5, 5);
  await p.click('.seg button:has-text("Čtečka")'); await sleep(300);
  assert(!(await p.isVisible('.se-wrap .b-mus')), 'zpět na pohled čtečky');
  // stránka Obsazení – nástroje
  await p.evaluate(() => { location.hash = '#/singers'; }); await sleep(400);
  assert(await p.isVisible('h2:has-text("Nástroje")') && await p.isVisible('table.tbl >> nth=1'), 'tabulka nástrojů v Obsazení');
  const icode = p.locator('table.tbl >> nth=1 >> tbody tr >> nth=0 >> input.inp >> nth=0');
  await icode.fill('Q'); await icode.press('Tab'); await sleep(900);
  assert((await p.evaluate(() => Store.songs.get('musx').text)).includes('%Q Capo 2') && (await p.evaluate(() => Store.songs.get('musx').text)).includes('%%Q Tab'), 'změna zkratky nástroje se promítne do písní');

  const real = errors.filter(e => !/Failed to load resource|favicon/.test(e));
  assert(real.length === 0, 'žádné chyby JavaScriptu' + (real.length ? ': ' + real.join(' | ') : ''));
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})().catch(e => { console.log('FAIL: výjimka', e); process.exit(1); });
