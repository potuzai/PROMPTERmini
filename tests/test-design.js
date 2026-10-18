// Nový vzhled 1.16: průvodce prvním spuštěním, světlý/tmavý motiv, seznam písní s náhledem, čtečka (lišta, nabídka)
const { chromium } = require('playwright');
const assert = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } else console.log('ok: ' + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const URL = 'http://localhost:8123/index.html';
(async () => {
  const b = await chromium.launch();
  try {
    /* ----- Průvodce: čtečka na šířku, otočit, 27″, světlý motiv, PIN ----- */
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('PAGEERR', e.message));
    await p.goto(URL + '#/songs');
    await p.waitForSelector('.modal-title:has-text("Vítej")', { timeout: 5000 });
    assert(!(await p.isVisible('.wizard')), 'web: napoprvé jen uvítání, průvodce čtečkou ne');
    await p.click('.modal button:has-text("Nastavit obrazovku")');
    await p.waitForSelector('.wizard', { timeout: 5000 });
    assert(await p.isVisible('.wz-opt:has-text("Čtečka na pódiu")') && await p.isVisible('.wz-opt:has-text("Muzikant")'), 'průvodce nabízí role zařízení');
    await p.click('.wz-opt:has-text("Čtečka na pódiu")');
    await p.keyboard.press('ArrowRight'); await sleep(100);
    assert(await p.isVisible('.wz-opt.on:has-text("Počítač pro úpravy")'), 'šipka → přepne volbu (airmouse)');
    await p.keyboard.press('ArrowLeft'); await sleep(100);
    await p.keyboard.press('Enter'); await sleep(200);
    assert(await p.isVisible('h1:has-text("Jak stojí monitor")'), 'OK = další krok (orientace)');
    await p.click('.wz-opt:has-text("Na šířku")');
    await p.click('.segc button:has-text("90° ↻")');
    await p.click('.wz-foot .btn.primary'); await sleep(200);
    await p.click('.chip:has-text("27″ QHD")'); await sleep(100);
    assert(await p.inputValue('.wz-size input[type=number] >> nth=0') === '2560', 'předvolba v orientaci na šířku');
    assert(await p.isVisible('.wz-advice:has-text("Doporučené písmo")'), 'doporučení velikosti písma');
    await p.click('.wz-foot .btn.primary'); await sleep(200);
    assert(await p.isVisible('.wz-sum:has-text("Na šířku")') && await p.isVisible('.wz-sum:has-text("2560 × 1440")'), 'shrnutí ukazuje volby');
    await p.click('.wz-row .segc button:has-text("Světlý")'); await sleep(100);
    assert(await p.evaluate(() => document.documentElement.dataset.theme) === 'light', 'motiv se přepne hned');
    await p.fill('.wz-pin', '1234');
    await p.click('.wz-foot .btn.primary:has-text("Spustit čtečku")'); await sleep(500);
    const S = await p.evaluate(() => ({ role: Settings.get('deviceRole'), sir: Settings.get('startInReader'), w: Settings.get('screenW'), h: Settings.get('screenH'), rot: Settings.get('readerRotate'), theme: Settings.get('theme'), pin: !!Settings.get('pinHash'), welcomed: Settings.get('welcomed'), reader: Reader.isOpen() }));
    assert(S.role === 'reader' && S.sir === true, 'role čtečka → po zapnutí čtečka');
    assert(S.w === 2560 && S.h === 1440 && S.rot === 90, 'rozměr, orientace a otočení uloženy');
    assert(S.theme === 'light' && S.pin && S.welcomed, 'motiv, PIN a dokončení uloženy');
    assert(S.reader, 'po dokončení se otevře čtečka');
    await p.reload(); await sleep(800);
    assert(await p.evaluate(() => Reader.isOpen() && !document.querySelector('.wizard')), 'po restartu rovnou čtečka, průvodce už ne');

    /* ----- Nastavení › Toto zařízení ----- */
    await p.evaluate(() => { sessionStorage.setItem('unlocked', '1'); Settings.set('screenW', 1080); Settings.set('screenH', 1920); location.hash = '#/settings'; }); await sleep(600);
    assert(await p.isVisible('#set-device legend:has-text("Toto zařízení")') && await p.isVisible('.set-nav .set-item:has-text("Sdílení s kapelou")'), 'nastavení: sekce zařízení a navigace vlevo');
    await p.selectOption('#set-device select.set-sel', 'editor'); await sleep(300);
    assert(await p.evaluate(() => Settings.get('deviceRole') === 'editor' && !Settings.get('startInReader')), 'změna role v nastavení');
    await p.click('#set-device .segc button:has-text("Tmavý")'); await sleep(100);
    assert(await p.evaluate(() => document.documentElement.dataset.theme === 'dark' && Settings.get('theme') === 'dark'), 'motiv přepnut v nastavení');
    await p.click('#set-device .segc button:has-text("Podle systému")');
    await p.emulateMedia({ colorScheme: 'light' }); await sleep(150);
    assert(await p.evaluate(() => document.documentElement.dataset.theme) === 'light', '„podle systému“ sleduje světlý režim systému');
    await p.emulateMedia({ colorScheme: 'dark' }); await sleep(150);
    assert(await p.evaluate(() => document.documentElement.dataset.theme) === 'dark', '„podle systému“ sleduje tmavý režim systému');
    await p.click('#set-device button:has-text("Spustit průvodce znovu")'); await sleep(200);
    assert(await p.isVisible('.wizard .wz-opt.on:has-text("Počítač pro úpravy")'), 'průvodce jde spustit znovu s aktuální volbou');
    await p.click('.wz-opt:has-text("Muzikant")'); await sleep(100);
    assert(await p.isVisible('.wz-step.skip:has-text("Velikost")'), 'muzikant: kroky s monitorem se přeskočí');
    await p.click('.wz-foot .btn.primary'); await sleep(200);
    assert(await p.isVisible('h1:has-text("Hotovo")'), 'muzikant jde rovnou na shrnutí');
    await p.click('.wz-foot .btn.primary'); await sleep(300);
    assert(await p.evaluate(() => Settings.get('deviceRole') === 'musician' && Settings.get('myView').chords), 'muzikant: zapnuté akordy a poznámky');
    await ctx.close();

    /* ----- Obrazovky kapely: profil tabletu, vlastní konce stránek, osobní zobrazení ----- */
    {
      const c3 = await b.newContext({ viewport: { width: 1400, height: 850 } });
      await c3.addInitScript(() => { if (!localStorage.getItem('prompter-settings')) localStorage.setItem('prompter-settings', JSON.stringify({ welcomed: true, readerFullscreen: false })); });
      const r = await c3.newPage();
      r.on('pageerror', e => console.log('PAGEERR', e.message));
      await r.goto(URL + '#/settings'); await r.waitForFunction(() => typeof Store !== 'undefined' && Store.ready); await sleep(400);
      await r.evaluate(async () => { await Store.put('songs', { id: 'tb', title: 'Tablet', text: '@J jedna\n[Am]dvě\n---\n@T tři\n%G capo 2\n@V čtyři' }); });
      r.once('dialog', () => {});
      await r.click('.scr-tabs .chip.add'); await r.fill('.modal input', 'Tablet kytara'); await r.keyboard.press('Enter'); await sleep(400);
      const tab = await r.evaluate(() => Screens.others()[0]);
      assert(tab && tab.name === 'Tablet kytara', 'nová obrazovka kapely se uloží do sdílené konfigurace');
      await r.click('.scr-box button:has-text("Na šířku")'); await sleep(150);
      await r.click('.scr-box label.chk:has-text("Kytara") input'); await sleep(150);
      const tab2 = await r.evaluate(() => Screens.others()[0]);
      assert(tab2.w > tab2.h && tab2.view.chords && tab2.view.inst.includes('G'), 'obrazovka: orientace a co se ukáže (akordy, kytara)');
      assert(await r.evaluate(() => Screens.main().w < Screens.main().h), 'hlavní čtečka zůstala na výšku');
      await r.selectOption('#set-device select.set-sel >> nth=1', tab.id); await sleep(200);
      assert(await r.evaluate(() => Screens.mine().name) === 'Tablet kytara', 'zařízení si vybere svou obrazovku');
      const lay = await r.evaluate(id => { const s = Store.songs.get('tb'); const sc = Screens.mine(); const l = Render.layout(s, Store.template('default'), sc.w, sc.h, Screens.view(sc, true), screenOpts(sc, s.id, true)); return { pages: l.pages.length, types: l.blocks.map(b => b.type) }; });
      assert(lay.pages === 1 && lay.types.includes('mus') && lay.types.includes('line'), 'tablet: konec stránky hlavní čtečky neplatí, poznámka pro kytaru vidět');
      const mainLay = await r.evaluate(() => { const s = Store.songs.get('tb'); const sc = Screens.main(); return Render.layout(s, Store.template('default'), sc.w, sc.h, Screens.view(sc, false), screenOpts(sc, s.id, false)).pages.length; });
      assert(mainLay === 2, 'hlavní čtečka: ruční konec stránky platí');
      // editor: náhled pro tablet, nová stránka jen pro tablet
      await r.evaluate(() => { location.hash = '#/songs/tb'; }); await sleep(800);
      assert(await r.evaluate(id => SongsView.editor.screenId === id, tab.id), 'editor ukazuje náhled pro obrazovku zařízení');
      await r.evaluate(() => SongsView.editor.se.select(1)); await sleep(100);
      await r.click('.ed-panel button:has-text("Nová stránka")'); await sleep(300);
      const src = await r.evaluate(() => SongsView.editor.src);
      assert(src.includes('--- ' + tab.id) && src.split('\n').filter(l => l.trim() === '---').length === 1, 'nová stránka se vloží jen pro tuto obrazovku');
      assert(await r.evaluate(() => SongsView.editor.se.lay.pages.length) === 2, 'náhled tabletu má teď 2 stránky');
      await r.selectOption('.ed-screen', 'main'); await sleep(300);
      assert(await r.evaluate(() => SongsView.editor.se.lay.pages.length === 2 && !SongsView.editor.se.lay.blocks.some(b => b.type === 'mus')), 'přepnutí náhledu na hlavní čtečku: její stránky, bez poznámek pro kytaru');
      // soukromá poznámka a zvýraznění mých řádků
      await r.fill('.ep-priv', 'nádech před refrénem'); await sleep(500);
      assert(await r.evaluate(() => PrivateNotes.get('tb') === 'nádech před refrénem' && !Store.songs.get('tb').text.includes('nádech')), 'soukromá poznámka se uloží jen do zařízení, ne do písně');
      await r.evaluate(() => { Settings.set('mySinger', 'J'); Settings.set('highlightMine', true); location.hash = '#/reader/song:tb'; }); await sleep(700);
      assert(await r.isVisible('#reader .b-note.private:has-text("nádech")'), 'čtečka: soukromá poznámka nahoře');
      await r.evaluate(() => Reader.next()); await sleep(200);
      assert(await r.evaluate(() => [...document.querySelectorAll('#reader .b-line.not-mine')].map(e => e.textContent).join('|')) === 'tři', 'čtečka: cizí řádky ztlumené, moje a „všichni“ ne');
      await r.evaluate(() => { Settings.set('myView', { chords: false, inst: [] }); Reader.cache.clear(); Reader.render(); }); await sleep(200);
      assert(!(await r.evaluate(() => !!document.querySelector('#reader .b-mus'))), 'vlastní „co vidím“ přepíše obrazovku (bez poznámek pro kytaru)');
      await c3.close();
    }

    /* ----- Seznam písní s náhledem, boční lišta ----- */
    const c2 = await b.newContext({ viewport: { width: 1400, height: 850 } });
    await c2.addInitScript(() => { if (!localStorage.getItem('prompter-settings')) localStorage.setItem('prompter-settings', JSON.stringify({ welcomed: true, readerFullscreen: false })); });
    const q = await c2.newPage();
    q.on('pageerror', e => console.log('PAGEERR', e.message));
    await q.goto(URL + '#/songs'); await q.waitForFunction(() => typeof Store !== 'undefined' && Store.ready);
    await q.evaluate(async () => {
      await Store.put('songs', { id: 'a1', title: 'Holubí dům', artist: 'Jarek Nohavica', key: 'G', tempo: '96', text: '## Sloka 1 @J\nZpívám ptákům\n## Refrén @V\nHolubí dům\n---\n>> Refrén' });
      await Store.put('songs', { id: 'a2', title: 'Kometa', artist: 'Jarek Nohavica', text: '@T Kometa' });
      await Store.put('playlists', { id: 'p1', name: 'Koncert', date: '2026-10-18', items: ['a2', 'a1'] });
      location.hash = '#/songs';
    }); await sleep(500);
    assert(await q.isVisible('#topbar .tab.active:has-text("Písně")') && await q.isVisible('#topbar .rail-btn:has-text("Čtečka")'), 'boční lišta: sekce a čtečka');
    await q.click('.song-list .item:has-text("Holubí dům")'); await sleep(300);
    assert(await q.evaluate(() => location.hash) === '#/songs' && await q.isVisible('.song-prev h3:has-text("Holubí dům")'), 'klik na píseň = náhled vpravo');
    assert(await q.isVisible('.song-prev .mini-page .stage') && await q.isVisible('.song-prev .chip:has-text("Koncert · 2.")'), 'náhled: stránka a playlisty s pořadím');
    assert(await q.locator('.song-list .item:has-text("Holubí dům") .sl-dots i').count() === 2, 'sloupec Zpívá ukazuje zpěváky');
    await q.focus('.song-list .list'); await q.keyboard.press('ArrowDown'); await sleep(150);
    assert(await q.isVisible('.song-prev h3:has-text("Kometa")'), '↓ v seznamu vybere další píseň');
    await q.keyboard.press('Enter'); await sleep(600);
    assert(await q.evaluate(() => location.hash) === '#/songs/a2', 'Enter otevře editor');
    await q.evaluate(() => { location.hash = '#/songs'; }); await sleep(400);
    await q.dblclick('.song-list .item:has-text("Holubí dům")'); await sleep(700);
    assert(await q.evaluate(() => location.hash) === '#/songs/a1', 'dvojklik otevře editor');

    /* ----- Editor: struktura písně ----- */
    assert(await q.isVisible('.ed-top .ep-title') && await q.isVisible('.ed-meta:has-text("Jarek Nohavica · G · 96 BPM")'), 'editor: název a údaje nahoře');
    assert(await q.locator('.ep-struct .st-item').count() === 3 && await q.isVisible('.ep-struct .st-brk:has-text("Stránka 2")'), 'struktura: sekce, opakování a konec stránky');
    await q.click('.ep-struct .st-item:has-text("Refrén") >> nth=0'); await sleep(200);
    assert(await q.evaluate(() => SongsView.editor.se.cur().line) === 2 && await q.isVisible('.ep-struct .st-item.on:has-text("Refrén")'), 'klik na sekci ji vybere na stránce');
    await q.click('.ep-legend .ep-leg:has-text("Ty")'); await sleep(300);
    assert((await q.evaluate(() => SongsView.editor.src)).includes('## Refrén @T'), 'klik na zpěváka v legendě přiřadí sekci');

    /* ----- Čtečka: lišta, seznam, nabídka ----- */
    await q.evaluate(() => { location.hash = '#/reader/p1/0'; }); await sleep(600);
    await q.mouse.move(700, 400); await q.mouse.move(700, 800); await sleep(300);
    assert(await q.isVisible('#reader.bar-on .r-bar') && await q.isVisible('.r-binfo:has-text("Píseň 1 / 2")'), 'pohyb myši dolů ukáže ovládací lištu');
    await q.click('.r-bar .r-bbtn[title^="Další"]'); await sleep(200);
    assert(await q.evaluate(() => Reader.songIdx) === 1, 'tlačítko na liště listuje');
    await q.keyboard.press('Tab'); await sleep(200);
    assert(await q.isVisible('.r-opt.cur:has-text("Holubí dům") .r-badge') && await q.isVisible('.r-opt.done:has-text("Kometa")'), 'seznam písní: hraje / odehráno');
    await q.keyboard.press('Escape'); await q.keyboard.press('q'); await sleep(200);
    assert(await q.locator('.r-quick .r-grid .r-opt').count() === 9, 'rychlá nabídka: dlaždice');
    await q.keyboard.press('ArrowRight'); await q.keyboard.press('Enter'); await sleep(200);
    assert(await q.evaluate(() => Reader.black), 'šipkou a OK zvolená dlaždice (černá obrazovka)');
    await c2.close();
  } catch (e) { console.log('FAIL: výjimka ' + e.message); process.exitCode = 1; }
  await b.close();
})();
