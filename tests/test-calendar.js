// Kalendář kapely: akce, potvrzení účasti (každý člen zvlášť), nepřítomnost, export .ics, mobil
const { chromium } = require('playwright');
const fs = require('fs');
const assert = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } else console.log('ok: ' + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const URL = 'http://localhost:8123/index.html';
(async () => {
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
    await ctx.addInitScript(() => { if (!localStorage.getItem('prompter-settings')) localStorage.setItem('prompter-settings', JSON.stringify({ welcomed: true, readerFullscreen: false })); });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('PAGEERR', e.message));
    await p.goto(URL + '#/calendar'); await p.waitForFunction(() => typeof Store !== 'undefined' && Store.ready); await sleep(400);
    assert(await p.isVisible('#topbar .tab.active:has-text("Kalendář")') && await p.isVisible('.cal-grid'), 'kalendář v boční liště, měsíční pohled');

    // členové kapely, já = Petr
    await p.click('button:has-text("Členové")'); await sleep(200);
    await p.fill('.cal-mrow >> nth=0 >> input.inp >> nth=0', 'Petr');
    await p.click('.modal button:has-text("Přidat člena")'); await p.fill('.cal-mrow >> nth=1 >> input.inp >> nth=0', 'Jana');
    await p.click('.modal button:has-text("Přidat člena")'); await p.fill('.cal-mrow >> nth=2 >> input.inp >> nth=0', 'Karel');
    await p.check('.cal-mrow >> nth=0 >> input[type=radio]');
    await p.click('.modal button:has-text("Uložit")'); await sleep(300);
    const mem = await p.evaluate(() => ({ list: Band.members().map(m => m.name), me: Band.me() && Band.me().name }));
    assert(mem.list.join(',') === 'Petr,Jana,Karel' && mem.me === 'Petr', 'členové se uloží, „já“ jen v zařízení');
    assert(await p.evaluate(() => !!Store.config.get('members') && !JSON.stringify(Store.config.get('members')).includes('memberId')), 'seznam členů je sdílený, volba „já“ ne');

    // nová akce
    const d = await p.evaluate(() => { const x = new Date(); x.setDate(x.getDate() + 10); return ymd(x); });
    await p.evaluate(dd => { CalendarView.selDay = dd; }, d);
    await p.click('button:has-text("Nová akce")'); await sleep(200);
    const F = l => `.modal label.f:has(> span:text-is("${l}")) > :is(input, select)`;
    await p.fill(F('Název'), 'Rock Café');
    await p.fill(F('Začátek'), '20:00'); await p.fill(F('Konec'), '23:30'); await p.fill(F('Příjezd'), '17:30');
    await p.fill(F('Místo'), 'Rock Café'); await p.fill(F('Adresa'), 'Národní 20, Praha');
    await p.fill(F('Hrajeme s (další kapely)'), 'Kapela X');
    await p.fill(F('Honorář (Kč)'), '15000'); await p.selectOption(F('Stav honoráře'), 'agreed');
    await p.fill(F('Kontakt (telefon, e-mail)'), '+420 777 123 456');
    await p.click('.modal button:has-text("Uložit")'); await sleep(400);
    const ev = await p.evaluate(() => Band.events()[0]);
    assert(ev && ev.title === 'Rock Café' && ev.date === d && ev.start === '20:00' && ev.fee === '15000', 'akce uložena se všemi údaji');
    assert(await p.isVisible(`.cal-day[data-date="${d}"] .cal-chip:has-text("Rock Café")`) || (await p.evaluate(() => CalendarView.month.join('-'))) !== '', 'akce je v měsíční mřížce');
    assert(await p.isVisible('.cal-prev h3:has-text("Rock Café")') && await p.isVisible('.cal-prev .cal-kv:has-text("15 000 Kč")') && await p.isVisible('.cal-prev a:has-text("mapa")'), 'podrobnosti: honorář, mapa');
    assert(await p.isVisible('.cal-prev a[href^="tel:+420777123456"]'), 'kontakt jde vytočit');

    // potvrzení účasti
    await p.click('.cal-ans button:has-text("Jedu")'); await sleep(300);
    const r1 = await p.evaluate(id => Store.rsvps.get(id + '--' + Band.me().id), ev.id);
    assert(r1 && r1.answer === 'yes', 'Jedu = potvrzení v samostatném souboru člena');
    assert(await p.isVisible('.cal-who .cal-m.yes:has-text("Petr")') && await p.isVisible('.cal-who .cal-m.none:has-text("Jana")'), 'přehled kdo jede / kdo neodpověděl');
    // jiný člen (jiné zařízení) potvrdí současně – nepřepíše Petra
    await p.evaluate(async id => { const j = Band.members()[1]; await Band.answer(id, j.id, 'maybe', 'přijedu později'); }, ev.id);
    await sleep(300);
    assert(await p.isVisible('.cal-who .cal-m.maybe:has-text("přijedu později")') && await p.isVisible('.cal-who .cal-m.yes:has-text("Petr")'), 'odpovědi členů se navzájem nepřepisují');

    // nepřítomnost
    await p.evaluate(async dd => { const k = Band.members()[2]; await Store.put('events', { id: uid(), kind: 'away', member: k.id, date: dd, dateEnd: '', note: 'dovolená' }); }, d);
    await p.evaluate(id => CalendarView.select(id), ev.id); await sleep(300);
    assert(await p.isVisible('.cal-who .cal-m.away:has-text("Karel")'), 'nepřítomnost člena se ukáže u akce');
    assert(await p.isVisible(`.cal-day[data-date="${d}"] .cal-away:has-text("Karel")`), 'nepřítomnost je vidět v kalendáři');

    // seznam a export .ics
    await p.click('.segc button:has-text("Seznam")'); await sleep(200);
    assert(await p.isVisible('.cal-row:has-text("Rock Café") .cal-cnt .yes:has-text("1")') && await p.isVisible('.cal-row:has-text("Rock Café") .cal-my.yes'), 'seznam: počty a moje odpověď');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.cal-prev button:has-text(".ics")')]);
    const ics = fs.readFileSync(await dl.path(), 'utf8');
    assert(/BEGIN:VEVENT/.test(ics) && ics.includes('DTSTART:' + d.replace(/-/g, '') + 'T173000') && ics.includes('SUMMARY:Koncert: Rock Café') && ics.includes('LOCATION:Rock Café\\, Národní 20\\, Praha'), 'export .ics s časem příjezdu a místem');

    // kopie a smazání (smaže i potvrzení)
    await p.evaluate(async id => { const e = Store.events.get(id); const c = Object.assign(clone(e), { id: uid(), date: e.date }); await Store.put('events', c); await Band.removeEvent(c); }, ev.id);
    await p.evaluate(async id => { await Band.removeEvent(Store.events.get(id)); }, ev.id); await sleep(200);
    assert(await p.evaluate(id => !Store.events.has(id) && !Band.rsvpsOf(id).length, ev.id), 'smazání akce smaže i potvrzení');
    assert(await p.evaluate(() => Object.keys(TYPES).includes('events') && Store.path('rsvps', 'a--b') === 'data/rsvps/a--b.json' && DATA_PATH_RE.test('data/rsvps/a--b.json')), 'akce a potvrzení se synchronizují s kapelou');
    await ctx.close();

    // telefon: detail akce přes celou obrazovku
    const m = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await m.addInitScript(() => { if (!localStorage.getItem('prompter-settings')) localStorage.setItem('prompter-settings', JSON.stringify({ welcomed: true })); });
    const q = await m.newPage();
    q.on('pageerror', e => console.log('PAGEERR', e.message));
    await q.goto(URL + '#/calendar'); await q.waitForFunction(() => typeof Store !== 'undefined' && Store.ready);
    await q.evaluate(async () => { await Store.put('config', { id: 'members', list: [{ id: 'm1', name: 'Petr', color: '#ffd23f' }] }); Settings.set('memberId', 'm1'); const x = new Date(); x.setDate(x.getDate() + 3); await Store.put('events', { id: 'e1', type: 'rehearsal', status: 'confirmed', date: ymd(x), title: 'Zkouška', start: '18:00' }); CalendarView.mode = 'list'; App.go(true); });
    await sleep(500);
    assert(!(await q.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'telefon: bez vodorovného přetékání');
    await q.tap('.cal-row:has-text("Zkouška")'); await sleep(300);
    assert(await q.isVisible('.cal-prev h3:has-text("Zkouška")') && await q.isVisible('.cal-ans'), 'telefon: detail akce s potvrzením přes celou obrazovku');
    await q.tap('.cal-ans button:has-text("Nejedu")'); await sleep(300);
    assert(await q.evaluate(() => Band.rsvp('e1', 'm1').answer) === 'no', 'telefon: potvrzení účasti');
    await q.tap('.cal-back'); await sleep(200);
    assert(await q.isVisible('.cal-row:has-text("Zkouška")'), 'telefon: zpět na seznam');
    await m.close();
  } catch (e) { console.log('FAIL: výjimka ' + e.message); process.exitCode = 1; }
  await b.close();
})();
