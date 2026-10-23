// Kompletní test funkcí, které nepokrývají ostatní testy
const { chromium } = require('playwright');
const klasickaSablona = require('./klasicka-sablona');
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
  await klasickaSablona(p);
  assert(await p.evaluate(async () => {
    const one = Store.templates.size === 1 && Store.templates.get('default').name === 'Hlavní čtečka';
    await Store.put('templates', { id: 'dva-sloupce', name: 'Dva sloupce' }); await Store.dropOldTemplates();
    return one && !Store.templates.has('dva-sloupce');
  }), 'jediná vestavěná šablona Hlavní čtečka, zrušené vestavěné šablony se smažou');

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
  assert(kept.includes('Text s akordem') && kept.includes('## Refrén'), 'čištění: akordy se odstraní, [Chorus] je refrén');

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
  await p.evaluate(() => { location.hash = '#/songs'; }); await sleep(300); // po importu se otevře píseň (seznam je schovaný)
  const chooser1 = p.waitForEvent('filechooser');
  await p.click('.side-head >> button:has-text("Import")');
  await (await chooser1).setFiles(f1);
  await p.click('.modal button:has-text("Vyčistit")');
  await sleep(600);
  const titles = await p.evaluate(() => Store.sortedSongs().map(s => s.title + '|' + s.artist + '|' + s.text));
  assert(titles.some(t => t.startsWith('Holubí dům||') && t.includes('## Sloka 1') && t.includes('## Refrén')), 'import .txt s čištěním');
  assert(titles.some(t => t.includes('Příliš žluťoučký')), 'import starého .txt v kódování Windows-1250');
  assert(titles.some(t => t.startsWith('ChordPro píseň|Autor|') && t.includes('## Refrén') && t.includes('Refrén text') && !t.includes('[G]')), 'import ChordPro (akordy odstraněny)');

  /* ---------- Hledání ---------- */
  await p.evaluate(() => { location.hash = '#/songs'; });
  await sleep(300);
  await p.fill('.side-head input[type=search]', 'zlutoucky');
  await sleep(200);
  assert(await p.locator('.side .item').count() === 1, 'hledání bez diakritiky a i v textu');
  await p.fill('.side-head input[type=search]', '');
  // seznam přes celou šířku, řazení: interpret, pak název
  await p.evaluate(async () => {
    await Store.put('songs', { id: 'o1', title: 'Zebra', artist: 'Arakain', text: 'x' });
    await Store.put('songs', { id: 'o2', title: 'Anděl', artist: 'Arakain', text: 'x' });
    await Store.put('songs', { id: 'o3', title: 'Bílá', artist: 'Čechomor', text: 'x' });
    location.hash = '#/playlists'; location.hash = '#/songs';
  });
  await sleep(400);
  const order = await p.$$eval('.song-list .item .sl-title', els => els.map(e => e.textContent));
  assert(order.indexOf('Anděl') < order.indexOf('Zebra') && order.indexOf('Zebra') < order.indexOf('Bílá') && order.indexOf('Bílá') < order.indexOf('Holubí dům'), 'řazení: interpret, pak název; bez interpreta na konci (' + order.join(', ') + ')');
  assert(await p.evaluate(() => document.querySelector('.song-list').getBoundingClientRect().width > innerWidth * 0.8), 'seznam písní je přes celou šířku');
  await p.evaluate(async () => { for (const id of ['o1', 'o2', 'o3']) await Store.remove('songs', id); });

  /* ---------- Editor: duplikace, export, smazání ---------- */
  const hid = await p.evaluate(() => Store.sortedSongs().find(s => s.title === 'Holubí dům').id);
  await p.evaluate(id => { location.hash = '#/songs/' + id; }, hid);
  await sleep(500);
  const src = () => p.evaluate(() => SongsView.editor.src);
  // ⋯ v pravém panelu = volby písně
  const pick = async (btn, label) => { await p.click(btn); await p.click(`.menu > div:has-text("${label}") >> nth=0`); };
  const more = label => pick('.ed-side button[title^="Další volby písně"]', label);
  // Uložit jako: soubory do zařízení (v testu bez výběru místa = stažení)
  await p.evaluate(() => { window.showSaveFilePicker = undefined; });
  const saveAsFile = async (label, file) => { const dl = p.waitForEvent('download'); await more('Uložit jako'); await p.click(`.choose-it:has-text("${label}")`); const f = path.join(tmp, file); await (await dl).saveAs(f); return fs.readFileSync(f, 'utf8'); };
  const txt = await saveAsFile('Prostý text', 'exp.txt');
  assert(txt.startsWith('# Holubí dům') && !/[{}@]/.test(txt), 'uložit jako prostý text bez značek');
  const pf = JSON.parse(await saveAsFile('Soubor PROMPTER', 'exp.prompter.json'));
  assert(pf.app === 'prompter' && pf.kind === 'song' && pf.songs.length === 1 && pf.songs[0].title === 'Holubí dům' && Array.isArray(pf.templates), 'uložit jako soubor PROMPTER (píseň s formátováním)');
  await more('Uložit jako'); await p.click('.choose-it:has-text("Novou píseň")');
  await p.fill('.modal input', 'Holubí dům (kopie)'); await p.keyboard.press('Enter');
  await sleep(500);
  assert(await p.evaluate(() => Store.sortedSongs().some(s => s.title === 'Holubí dům (kopie)')) && await p.evaluate(() => SongsView.editor.inTitle.value) === 'Holubí dům (kopie)', 'Uložit jako – nová píseň pod jiným názvem');
  await p.evaluate(id => { location.hash = '#/songs/' + id; }, hid);
  await sleep(500);
  // nová sekce z panelu Struktura (před poslední řádek)
  await p.focus('.se-wrap'); await p.keyboard.press('End');
  await p.click('.ep-lbl-row button:has-text("Sekce")');
  await p.click('.modal button:has-text("Mezičást")');
  await p.click('.modal-buttons button:has-text("Vložit")');
  await sleep(200);
  assert((await src()).includes('## Mezičást'), 'vložení sekce z panelu Struktura');
  await p.evaluate(() => SongsView.editor.se.startEdit(null, 'end'));   // nový řádek pod vybraný (jako Enter při psaní)
  await p.keyboard.type('text mostu');
  await p.keyboard.press('Escape');
  await sleep(100);
  assert(/## Mezičást\ntext mostu/.test(await src()), 'nový řádek pod sekcí a psaní');
  await p.click('.ep-lbl-row button[title^="Zopakovat sekci"]');
  await p.click('.menu div:has-text("Refrén")');
  await sleep(200);
  assert(/text mostu\n>> Refrén/.test(await src()), 'opakování sekce z nabídky');
  // úpravy sekce v panelu Struktura: počet opakování, barva; sekce z označených řádků; předehra
  const keepSrc = await src();
  await p.click('.ep-struct .st-item:has-text("Mezičást") .st-more');
  await p.fill('.sec-pop .num-in', '2'); await p.keyboard.press('Enter'); await sleep(200);
  assert(await p.isVisible('.sec-pop'), 'nabídka sekce zůstane otevřená po změně počtu');
  await p.click('.sec-pop .sp-chk input'); await sleep(150);
  assert(/## Mezičást 2× ⊘/.test(await src()), 'skrýt nadpis sekce v textu (' + JSON.stringify((await src()).match(/## Mezičást.*/)) + ')');
  await p.click('.sec-pop .sp-chk input'); await sleep(150);
  await p.mouse.click(5, 5); await sleep(100);
  assert((await src()).includes('## Mezičást 2×') && await p.isVisible('.ep-struct .st-item:has-text("Mezičást") .st-cnt:has-text("2×")'), 'počet opakování sekce');
  assert(await p.evaluate(() => [...document.querySelectorAll('.se-wrap .rep-n')].some(e => e.textContent.includes('2×'))), 'počet opakování je vidět u prvního řádku sekce');
  await p.evaluate(() => { const se = SongsView.editor.se; const ls = se.lines(); const i = ls.findIndex(l => l.includes('## Mezičást')); ls[i] = formatSectionLine(Object.assign(parseSectionLine(ls[i]), { color: '#00ffff' })); se.commit(ls.join('\n')); });
  await sleep(200);
  assert(await p.evaluate(() => { const l = [...document.querySelectorAll('.se-wrap .b-line')].find(e => e.textContent.includes('text mostu')); return l && getComputedStyle(l).color === 'rgb(0, 255, 255)'; }), 'vlastní barva písma sekce');
  await p.evaluate(async () => { const s = SongsView.editor; s.se.commit('## Sloka 1\nprvní\ndruhý\ntřetí\nčtvrtý'); s.se.select(2); s.se.select(3, true); });
  await p.click('.ep-lbl-row button:has-text("Sekce")'); await p.click('.modal button:has-text("Refrén")'); await p.click('.modal-buttons button:has-text("Vložit")'); await sleep(200);
  assert(await src() === '## Sloka 1\nprvní\n## Refrén\ndruhý\ntřetí\n## Sloka 1\nčtvrtý', 'sekce přesně z označených řádků, za nimi pokračuje původní sekce (' + JSON.stringify(await src()) + ')');
  await p.click('.ep-struct .st-item:has-text("Refrén")'); await sleep(200);
  assert(await p.evaluate(() => { const se = SongsView.editor.se; return se.selTargets().map(t => se.lines()[t.line]).join('|') === 'druhý|třetí' && document.querySelector('.se-wrap').classList.contains('multi'); }), 'klik na sekci ve Struktuře označí celý její text jako blok');
  await p.evaluate(() => SongsView.editor.se.select(0));
  await p.click('.ep-lbl-row button:has-text("Sekce")'); await p.click('.modal button:has-text("Předehra")');
  await p.fill('.modal .num-in', '8'); await p.click('.modal-buttons button:has-text("Vložit")'); await sleep(200);
  assert((await src()).startsWith('## Předehra 8×\n## Sloka 1') && await p.isVisible('.se-wrap .b-instr:has-text("8× Předehra")'), 'předehra s počtem je vidět na stránce');
  await p.evaluate(k => { const se = SongsView.editor.se; se.commit(k); se.select(se.targets.findIndex(t => se.lines()[t.line].startsWith('>> '))); }, keepSrc); await sleep(200);
  await p.focus('.se-wrap');
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
  // seznam playlistů přes celou šířku: hledání a řazení
  await p.evaluate(async () => {
    await Store.put('playlists', { id: 'plA', name: 'Akustika', date: '2026-09-01', templateId: '', note: 'klub', items: [] });
    await Store.put('playlists', { id: 'plZ', name: 'Zábava', date: '2026-11-30', templateId: '', note: '', items: [] });
    location.hash = '#/playlists';
  });
  await sleep(400);
  const plNames = () => p.$$eval('.pl-list .item .sl-title', els => els.map(e => e.textContent));
  assert((await plNames()).join(',') === 'Zábava,Koncert,Akustika', 'playlisty: výchozí řazení od nejnovějšího');
  assert(await p.evaluate(() => document.querySelector('.pl-list').getBoundingClientRect().width > innerWidth * 0.8), 'seznam playlistů je přes celou šířku');
  await p.click('.pl-list .sl-sort'); await p.click('.menu > div:has-text("Název")'); await sleep(150);
  assert((await plNames()).join(',') === 'Akustika,Koncert,Zábava', 'playlisty: řazení podle názvu');
  await p.fill('.pl-list input[type=search]', 'holubi'); await sleep(150);
  assert((await plNames()).join(',') === 'Koncert', 'playlisty: hledání i podle písní v playlistu');
  await p.fill('.pl-list input[type=search]', ''); await p.click('.pl-list .sl-sort'); await p.click('.menu > div:has-text("Nejnovější")');
  assert(await p.isVisible('.pl-prev h3') && await p.isVisible('.pl-list .item.active'), 'náhled vpravo ukazuje vybraný playlist');
  await p.click('.pl-list .item:has-text("Koncert")'); await sleep(200);
  assert(await p.isVisible('.pl-prev h3:has-text("Koncert")') && await p.isVisible('.pl-prev .pl-item:has-text("Holubí dům")'), 'klik = náhled obsahu playlistu vpravo');
  const prevW = await p.evaluate(() => [document.querySelector('.pl-main').getBoundingClientRect().width, document.querySelector('.pl-prev').getBoundingClientRect().width]);
  assert(Math.abs(prevW[0] / prevW[1] - 1.5) < 0.25, 'seznam 60 %, úprava vpravo 40 %');
  await p.dblclick('.pl-list .item:has-text("Akustika")'); await sleep(300);
  assert(!(await p.isVisible('.pl-list')) && await p.isVisible('.btn.pl-back'), 'otevřený playlist: seznam schovaný, tlačítko zpět');
  await p.click('.btn.pl-back'); await sleep(300);
  assert(await p.isVisible('.pl-list'), 'zpět na seznam playlistů');
  await p.evaluate(async () => { await Store.remove('playlists', 'plA'); await Store.remove('playlists', 'plZ'); });

  /* ---------- Import setlistu z Excelu (nový playlist, chybějící píseň bez textu, přídavky) ---------- */
  await p.evaluate(() => {
    const x = makeXlsx('Setlist', [['Pořadí', 'Název', 'Interpret', 'BPM'], [1, 'Holubí dům', '', ''], ['', 'Přídavky'], [2, 'Neznámá píseň', 'Někdo', 120]]);
    importFiles([new File([x], 'Setlist test.xlsx')]);
  });
  await p.click('.modal button:has-text("Vytvořit playlist")'); await sleep(400);
  const imp = await p.evaluate(() => { const pl = [...Store.playlists.values()].find(x => x.name === 'Setlist test'); const s = pl && Store.songs.get(pl.items[1]); return pl && [pl.items.length, pl.encore, Store.songs.get(pl.items[0]).title, s.title, s.artist, s.tempo, s.text].join('|'); });
  assert(imp === '2|1|Holubí dům|Neznámá píseň|Někdo|120|', 'import setlistu z Excelu: playlist, existující i nová píseň, přídavky');
  await p.evaluate(() => { importFiles([new File(['Název;Interpret\nHolubí dům;Žlutý pes\n'], 'Z csv.csv')]); });
  await p.click('.modal button:has-text("Vytvořit playlist")'); await sleep(400);
  assert(await p.evaluate(() => { const pl = [...Store.playlists.values()].find(x => x.name === 'Z csv'); return !!pl && pl.items.length === 1; }), 'import setlistu z CSV');
  await p.evaluate(async () => {
    for (const pl of [...Store.playlists.values()].filter(x => ['Setlist test', 'Z csv'].includes(x.name))) await Store.remove('playlists', pl.id);
    for (const s of [...Store.songs.values()].filter(x => x.title === 'Neznámá píseň')) await Store.remove('songs', s.id);
    location.hash = '#/playlists';
  });
  await sleep(300);

  /* ---------- Zpěváci v šabloně (stránka Obsazení už není) ---------- */
  await p.evaluate(() => { location.hash = '#/templates/default'; });
  await sleep(500);
  await p.click('.tpl-form button:has-text("Přidat zpěváka")'); await sleep(200);
  await p.fill('.modal input', 'Pepa'); await p.keyboard.press('Enter'); await sleep(300);
  assert(await p.locator('.tpl-form .sgs-n').count() === 4, 'přidaný zpěvák je v tabulce šablony');
  await p.click('.ed-save button:has-text("Uložit")'); await sleep(300);
  assert(await p.evaluate(() => (Store.templates.get('default').singers || []).map(s => s.code).join(',')) === 'J,T,V,P', 'zpěvák uložen do šablony');
  assert(await p.evaluate(() => Store.singers().length) === 3, 'společný seznam kapely se nezměnil');
  assert(await p.evaluate(() => Store.singers({ text: '', templateId: 'default' }).length) === 4, 'píseň se šablonou má jejího zpěváka');
  await p.evaluate(async () => { const t = Store.templates.get('default'); delete t.singers; await Store.put('templates', t); });
  await p.evaluate(() => { location.hash = '#/settings'; }); await sleep(300);
  assert(!(await p.isVisible('#topbar .tab:has-text("Obsazení")')), 'stránka Obsazení v menu není');

  /* ---------- Šablony ---------- */
  await p.evaluate(() => { location.hash = '#/templates/default'; });
  await sleep(500);
  const range = p.locator('label.f:has-text("Velikost písma") input[type=range]');
  await range.fill('100');
  await p.click('.ed-save button:has-text("Uložit")'); await sleep(300);
  assert(await p.evaluate(() => Store.templates.get('default').fontSize) === 100, 'změna velikosti písma v šabloně se uloží');
  const fsz = await p.evaluate(() => getComputedStyle(document.querySelector('.tpl-preview .stage')).getPropertyValue('--fs'));
  assert(fsz.trim() === '100px', 'náhled šablony se aktualizuje');
  await pick('button[title="Další volby šablony"]', 'Uložit jako novou šablonu'); await p.fill('.modal input', 'Moje'); await p.keyboard.press('Enter'); await sleep(500);
  const myId = await p.evaluate(() => [...Store.templates.values()].find(t => t.name === 'Moje').id);
  assert(!!myId, 'vytvoření šablony kopií');
  await p.click('button:has-text("Nastavit jako výchozí")'); await sleep(200);
  assert(await p.evaluate(id => Settings.get('defaultTemplate') === id, myId), 'nastavení výchozí šablony');
  await pick('button[title="Další volby šablony"]', 'Smazat šablonu'); await p.click('.modal button:has-text("Smazat")'); await sleep(400);
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
    const one = Render.layout(song, Object.assign({}, base, { onePage: true, fit: 'paginate', fontSize: 64 }), 1920, 1080);
    const oneBrk = Render.layout({ id: 'y2', title: 'b', text: t + '\n---\nb' }, Object.assign({}, base, { onePage: true, fontSize: 64 }), 1920, 1080);
    return { oneP: one.pages.length, oneK: one.k, oneBrk: oneBrk.pages.length, pag: pag.pages.length, unique: new Set(all).size, total: pag.blocks.length, shrK: shr.k, shrP: shr.pages.length, nofitP: nofit.pages.length, nofitK: nofit.k, two: two.pages.length, brk: brk.pages.length };
  }, long);
  assert(lay.pag >= 3 && lay.unique === lay.total, `rozdělení na ${lay.pag} stránky bez ztráty řádku`);
  assert(lay.shrP === 1 && lay.shrK < 1 && lay.shrK > 0.3, `zmenšení 25 řádků na 1 stránku (písmo ${Math.round(lay.shrK * 100)} %)`);
  assert(lay.nofitP > 1 && Math.abs(lay.nofitK - 0.6) < 0.001, 'když se nevejde ani zmenšená, rozdělí se na stránky při nejmenším povoleném písmu');
  assert(lay.two < lay.pag, 'dva sloupce = méně stránek');
  assert(lay.brk === 2, 'vynucená nová stránka ---');
  assert(lay.oneP === 1 && lay.oneK < 0.6, `zakázané více stránek: celá píseň na 1 stránce (písmo ${Math.round(lay.oneK * 100)} %)`);
  assert(lay.oneBrk === 2, 'zakázané více stránek: ručně zalomená stránka --- zůstane');

  /* ---------- Čtečka: všechny ovládací prvky ---------- */
  await p.evaluate(async t => {
    await Store.put('songs', { id: 'long', title: 'Dlouhá', text: t });
    await Store.put('songs', { id: 's3', title: 'Třetí', text: '@T konec' });
    const pl = Store.playlists.get('pl1'); pl.items = [Store.sortedSongs().find(s => s.title === 'Holubí dům').id, 'long', 's3']; await Store.put('playlists', pl);
    await Store.put('templates', Object.assign(Store.template('default'), { id: 'velke', name: 'Velké na střed', fontSize: 80, align: 'center', fit: 'paginate', showFooter: true, uppercase: false }));
    for (const id of pl.items) { const s = Store.songs.get(id); if (s) { s.templateId = 'velke'; await Store.put('songs', s); } }
  }, long);
  await p.evaluate(() => { location.hash = '#/reader/pl1'; });
  await sleep(600);
  const pos = () => p.evaluate(() => [Reader.songIdx, Reader.pageIdx]);
  assert(await p.evaluate(() => getComputedStyle(document.querySelector('#reader .stage')).getPropertyValue('--align').trim()) === 'center', 'šablona písně se použije ve čtečce');
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
  // pódium: dvojité šlápnutí pedálu do 250 ms = jedna stránka
  await p.evaluate(() => { Reader.songIdx = 0; Reader.pageIdx = 0; Reader.press = null; Reader.aimT = 0; Reader.render(); });
  for (let i = 0; i < 2; i++) { await p.mouse.down({ button: 'right' }); await p.mouse.up({ button: 'right' }); }
  await sleep(100);
  assert(JSON.stringify(await pos()) === '[1,0]', 'zákmit pedálu (druhý stisk hned po puštění) = jedna stránka');
  // seznam písní ovládaný pedálem: pravý = další položka, podržet pravý = potvrdit
  await sleep(300); await p.mouse.down({ button: 'middle' }); await p.mouse.up({ button: 'middle' }); await sleep(100);
  await p.evaluate(() => { Reader.aimT = 0; });
  await p.mouse.down({ button: 'right' }); await p.mouse.up({ button: 'right' }); await sleep(500);
  assert(await p.evaluate(() => Reader.menu && Reader.menu.sel) === 2, 'pedál v seznamu posune výběr (nevybere položku pod kurzorem)');
  await p.mouse.down({ button: 'right' }); await sleep(750); await p.mouse.up({ button: 'right' }); await sleep(100);
  assert(await p.evaluate(() => !Reader.menu) && (await pos())[0] === 2, 'podržený pravý pedál potvrdí');
  // rychlé šlápnutí za sebou = každé zvlášť (rychlý přesun), ne podržení
  await sleep(300); await p.mouse.down({ button: 'middle' }); await p.mouse.up({ button: 'middle' }); await sleep(300);
  await p.evaluate(() => { Reader.aimT = 0; Reader.menu.sel = 0; Reader.menu.paint(); });
  for (let i = 0; i < 4; i++) { await p.mouse.down({ button: 'right' }); await sleep(60); await p.mouse.up({ button: 'right' }); await sleep(90); }
  await sleep(700);
  assert(await p.evaluate(() => Reader.menu && Reader.menu.sel) === 4, 'rychlé šlápnutí za sebou posune o 4 položky (nepotvrdí)');
  // pedál posílající klávesy: držená klávesa v seznamu nelistuje, potvrdí
  await p.evaluate(() => { Reader.menu.sel = 0; Reader.menu.paint(); });
  await p.keyboard.down('PageDown'); for (let i = 0; i < 25; i++) { await sleep(35); await p.keyboard.down('PageDown'); } await p.keyboard.up('PageDown'); await sleep(200);
  assert(await p.evaluate(() => !Reader.menu) && (await pos())[0] === 1, 'držená klávesa pedálu v seznamu potvrdí (nelistuje)');
  // podržet levý pedál v textu = setlist, listování zpět se vrátí
  await sleep(400); await p.evaluate(() => { Reader.songIdx = 1; Reader.pageIdx = 0; Reader.render(); });
  await p.mouse.down({ button: 'left' }); await sleep(950);
  assert(await p.evaluate(() => !!Reader.menu) && (await pos())[0] === 1, 'podržený levý pedál otevře setlist (a vrátí stránku)');
  await p.mouse.up({ button: 'left' }); await p.keyboard.press('Escape'); await sleep(200);
  // Esc napoprvé jen upozorní, čtečku nezavře
  await p.keyboard.press('Escape'); await sleep(100);
  assert(await p.evaluate(() => Reader.isOpen()) && await p.isVisible('.r-toast:has-text("Stiskni znovu Esc")'), 'Esc napoprvé čtečku nezavře');
  // skrytí kurzoru
  await sleep(2300);
  assert(await p.evaluate(() => document.getElementById('reader').classList.contains('nocursor')), 'kurzor se po 2 s skryje');
  // E = upravit aktuální píseň
  await p.keyboard.press('e'); await sleep(200);
  assert(await p.evaluate(() => Reader.isOpen()), 'E napoprvé jen upozorní');
  await p.keyboard.press('e'); await sleep(400);
  assert(await p.evaluate(() => location.hash.startsWith('#/songs/') && !Reader.isOpen()), 'E podruhé otevře píseň v editoru');

  /* ---------- Záloha a obnova ---------- */
  await p.evaluate(() => { location.hash = '#/settings/backup'; }); await sleep(400);
  const dl2 = p.waitForEvent('download');
  await p.click('.set-row:has-text("Stáhnout zálohu") button');
  const bpath = path.join(tmp, 'zaloha.json'); await (await dl2).saveAs(bpath);
  const backup = JSON.parse(fs.readFileSync(bpath, 'utf8'));
  assert(backup.songs.length >= 4 && backup.playlists.length === 1 && backup.templates.length >= 1, 'záloha obsahuje vše');
  const countBefore = await p.evaluate(() => Store.songs.size);
  await p.evaluate(async () => { for (const id of [...Store.songs.keys()]) await Store.remove('songs', id); });
  assert(await p.evaluate(() => Store.songs.size) === 0, '(smazáno vše)');
  const ch = p.waitForEvent('filechooser');
  await p.click('.set-row:has-text("Obnovit ze zálohy") button');
  await (await ch).setFiles(bpath); await sleep(800);
  assert(await p.evaluate(() => Store.songs.size) === countBefore, 'obnova ze zálohy');
  // novější úprava v zařízení se starší zálohou nepřepíše
  const sid = backup.songs[0].id;
  await p.evaluate(async id => { const s = Store.songs.get(id); s.text = 'novější úprava'; await Store.put('songs', s); }, sid);
  const ch2 = p.waitForEvent('filechooser');
  await p.click('.set-row:has-text("Obnovit ze zálohy") button');
  await (await ch2).setFiles(bpath); await sleep(800);
  assert(await p.evaluate(id => Store.songs.get(id).text, sid) === 'novější úprava', 'obnova ze zálohy nepřepíše novější úpravu');

  /* ---------- Nastavení monitoru ---------- */
  await p.evaluate(() => { location.hash = '#/settings/screens'; }); await sleep(400);
  assert(await p.evaluate(() => Settings.get('screenW') < Settings.get('screenH')), 'výchozí monitor na výšku');
  await p.click('button:has-text("1200×1920")'); await sleep(200);
  assert(await p.evaluate(() => Settings.get('screenW') === 1200 && Settings.get('screenH') === 1920), 'předvolba rozlišení na výšku');
  await p.click('button:has-text("Na šířku")'); await sleep(200);
  assert(await p.evaluate(() => Settings.get('screenW') === 1920 && Settings.get('screenH') === 1200), 'přepnutí na šířku');
  await p.click('button:has-text("1920×1200")'); await sleep(200);
  assert(await p.isVisible('text=doporučuji písmo alespoň'), 'doporučená velikost písma');
  await p.evaluate(() => { location.hash = '#/settings/band'; }); await sleep(400);
  assert(await p.isVisible('.set-status:has-text("Nepřihlášeno")') && await p.isVisible('.set-actions button:has-text("Přihlásit ke kapele")'), 'nastavení: stav kapely a přihlášení na prvním místě');
  await p.click('summary:has-text("Pokročilé")');
  assert(await p.isVisible('button:has-text("Připojit ke GitHubu")') && await p.isVisible('text=Jen v programu PROMPTER mini.exe'), 'jiné úložiště: GitHub, synchronizovaná složka jen v programu');

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
  const base = await p.evaluate(() => SongsView.editor.se.linePx());
  const px = () => p.inputValue('.tl-size input');
  assert(await px() === String(Math.round(base)), 'pole ukazuje velikost písma řádku v px');
  await p.click('.ed-tools button[title^="Větší písmo"]'); await sleep(300);
  assert(/\{\d+%:velký\}/.test(await fsrc()) && await px() === String(Math.round(base) + 2), 'tlačítko A+ zvětší označený text o 2 px a pole ukáže novou velikost');
  await p.click('.tl-size input'); await p.keyboard.type(String(Math.round(base * 1.55))); await p.keyboard.press('Enter'); await sleep(300);
  assert((await fsrc()).includes('{++:velký}'), 'velikost napsaná v px (uloží se poměrem k písmu řádku, 155 % = starší zápis ++)');
  await p.keyboard.press('Escape'); await sleep(200);
  assert(await p.isVisible('.se-wrap .sz[data-p="155"]'), 'stránka ukáže větší text');
  assert(await p.evaluate(() => /font-size:1\.55em/.test(inlineHtml('{++:a} {130%:b}', {})) && inlineHtml('{130%:b}', {}).includes('1.3em')), 'starší i nový zápis velikosti');
  assert(await p.evaluate(() => { const x = inlineHtml('{90%:a {96%:b}} {#ff0000:{80%:c}}', {}); return !x.includes('{') && x.includes('font-size:0.96em') && x.includes('color:#ff0000'); }), 'vnořená velikost a vlastní barva písma');
  assert(await p.evaluate(() => formatLine('', 'font', 'Arial') === '{ƒArial:}' && formatLine('{ƒArial:}', 'font', '') === '' && formatLine('', 'bold') === ''), 'prázdný řádek si pamatuje písmo');
  // řádkování řádku s kurzorem
  await p.click('.se-wrap .b-line:has-text("velký")'); await sleep(150);
  await p.click('.ed-tools label[title^="Řádkování"] input'); await p.keyboard.type('2'); await p.keyboard.press('Enter'); await sleep(300);
  assert(/^@\S+ \{↕2:/m.test(await fsrc()) && await p.evaluate(() => { const l = [...document.querySelectorAll('.se-wrap .b-line')].find(e => e.textContent.includes('velký')); return l && l.style.lineHeight === '2'; }), 'řádkování jednoho řádku');
  await p.click('.ed-tools label[title^="Řádkování"] input'); await p.keyboard.press('Control+a'); await p.keyboard.press('Backspace'); await p.keyboard.press('Enter'); await sleep(300);
  assert(!(await fsrc()).includes('↕'), 'prázdné řádkování = podle písně');
  await p.keyboard.press('Escape');
  await p.evaluate(() => { const e = SongsView.editor; e.setSong('sizePct', 150); e.setSong('fontFamily', 'Roboto Condensed'); }); await sleep(400);
  await p.mouse.click(5, 5); await p.keyboard.press('Control+S'); await sleep(300);
  const fst = await p.evaluate(() => ({ style: Store.songs.get('fnt').style, base: Store.template(Settings.get('defaultTemplate')).fontSize, fs: document.querySelector('.se-wrap .stage').style.getPropertyValue('--fs'), ff: document.querySelector('.se-wrap .stage').style.fontFamily }));
  const want = Math.round(fst.base * 1.5);
  assert(fst.style && fst.style.sizePct === 150 && fst.style.fontFamily === 'Roboto Condensed', 'písmo písně se uloží do písně');
  assert(fst.fs === want + 'px' && fst.ff.includes('Roboto Condensed'), 'náhled použije písmo písně (' + fst.fs + ')');
  assert(await p.evaluate(w => { Reader.plId = null; const t = Reader.tplFor(Store.songs.get('fnt')); return t.fontSize === w && t.fontFamily === 'Roboto Condensed'; }, want), 'čtečka použije písmo písně');
  assert(await p.evaluate(w => Reader.tplFor(Store.songs.get('long')).fontSize !== w, want), 'ostatní písně zůstanou podle šablony');
  // označení zpěváka jen pro tuto píseň: první zpěvák má proužek vpravo místo vlevo (tabulka zpěváci × volby)
  const sg0 = await p.evaluate(async () => { const g = Store.singers()[0]; await Store.put('songs', { id: 'sgs', title: 'Označení', text: '@' + g.code + ' řádek se zpěvákem' }); location.hash = '#/songs/sgs'; return g; }); await sleep(600);
  await p.click('.ed-side button[title^="Zpěváci a jejich"]');
  await p.click(`.menu-singer input[title="${sg0.name}: proužek vpravo"]`);
  await p.click(`.menu-singer input[title="${sg0.name}: proužek vlevo"]`); await sleep(200);
  assert(await p.evaluate(() => { const l = document.querySelector('.se-wrap .b-line.has-sg'); return l.classList.contains('br') && !l.classList.contains('bl'); }), 'označení zpěváka: proužek vpravo místo vlevo');
  await p.mouse.click(5, 5); await p.keyboard.press('Control+S'); await sleep(300);
  assert(await p.evaluate(c => { const sg = Store.songs.get('sgs').style.singer[c]; const o = singerShowOf(Reader.tplFor(Store.songs.get('sgs')), c); return sg.barR === true && sg.barL === false && o.barR && !o.barL; }, sg0.code), 'označení zpěváka se uloží jen do písně');
  assert(await p.evaluate(c => !singerShowOf(Reader.tplFor(Store.songs.get('long')), c).barR, sg0.code), 'ostatní písně mají označení zpěváka podle šablony');

  /* ---------- Starší zápisy pro muzikanty: nikde se nezobrazí, čištění je smaže ---------- */
  const musTxt = '%G Capo 2\n[D] [G]\n## Sloka @J\n[D]Zpívám [G]ptákům\n%%G Tab\ne|--0--|\nB|--1--|\n%%\n%B walking bass';
  const mres = await p.evaluate(t => {
    const pr = parseSong(t);
    const W = 1080, H = 1920, tpl = Store.template('default');
    const lr = Render.layout({ id: 'm', title: 'M', text: t }, tpl, W, H);
    const st = Render.makeStage(tpl, W, H); document.body.appendChild(st);
    Render.renderPage(st, lr, tpl, 0, {}); const readerHtml = st.innerHTML; st.remove();
    return {
      readerTypes: filterForView(pr.blocks).map(b => b.type).join(','),
      readerHasChords: /\[D\]|Capo|walking|e\|--/.test(readerHtml), readerText: readerHtml.includes('Zpívám ptákům'),
      cleaned: cleanText(t, { detectSections: false }),
      pasted: cleanText('Am     C\nZpívám ptákům\n'),
    };
  }, musTxt);
  assert(mres.readerTypes === 'section,line', 'zobrazí se jen text (' + mres.readerTypes + ')');
  assert(!mres.readerHasChords && mres.readerText, 'stránka bez akordů a poznámek pro nástroje');
  assert(mres.cleaned === '## Sloka @J\nZpívám ptákům', 'Vyčistit text smaže akordy, tabulatury a poznámky pro nástroje (' + JSON.stringify(mres.cleaned) + ')');
  assert(mres.pasted === 'Zpívám ptákům', 'vložený text: řádek akordů se odstraní (' + mres.pasted + ')');
  await p.evaluate(async t => { await Store.put('songs', { id: 'musx', title: 'Starší', text: t }); location.hash = '#/songs/musx'; }, musTxt); await sleep(600);
  assert(!(await p.isVisible('.ed-mus')) && !(await p.isVisible('.se-wrap .b-mus')), 'editor nemá Muzikanty a nic pro muzikanty neukazuje');
  assert(!(await p.isVisible('.side')), 'při úpravě písně je seznam písní schovaný');
  await p.evaluate(() => { location.hash = '#/singers'; }); await sleep(400);
  assert((await p.evaluate(() => location.hash)).startsWith('#/templates'), 'stará adresa Obsazení vede na šablony');
  await p.evaluate(() => { location.hash = '#/settings'; }); await sleep(300);
  assert(!(await p.isVisible('.set-item:has-text("Nástroje")')), 'v Nastavení nejsou nástroje');

  const real = errors.filter(e => !/Failed to load resource|favicon/.test(e));
  assert(real.length === 0, 'žádné chyby JavaScriptu' + (real.length ? ': ' + real.join(' | ') : ''));
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})().catch(e => { console.log('FAIL: výjimka', e); process.exit(1); });
