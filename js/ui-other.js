'use strict';
/* ===== Šablony ===== */
const FONTS = ['Roboto', 'Roboto Condensed', 'Arial', 'Arial Black', 'Segoe UI', 'Segoe UI Semibold', 'Calibri', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Georgia', 'Times New Roman', 'Cambria', 'Consolas', 'Impact', 'Franklin Gothic Medium', 'Lucida Sans Unicode'];
const TPL_FIELDS = [
  { g: 'Písmo' },
  { k: 'fontFamily', l: 'Font', t: 'select', o: FONTS.map(f => [f, f]) },
  { k: 'fontSize', l: 'Velikost písma (px)', t: 'range', min: 20, max: 160, step: 1 },
  { k: 'fontWeight', l: 'Tloušťka', t: 'select', o: [[400, 'normální'], [600, 'polotučné'], [700, 'tučné'], [900, 'extra tučné']] },
  { k: 'lineHeight', l: 'Řádkování', t: 'range', min: 0.9, max: 2.2, step: 0.02 },
  { k: 'letterSpacing', l: 'Rozestup písmen', t: 'range', min: -0.05, max: 0.2, step: 0.005,
    fmt: x => +x === 0 ? 'normální' : (x > 0 ? 'širší o ' : 'užší o ') + Math.round(Math.abs(x) * 100) + ' % výšky písma',
    help: 'Vzdálenost mezi jednotlivými písmeny. Trochu širší rozestup pomáhá čitelnosti z dálky, užší dostane víc textu na řádek.' },
  { k: 'align', l: 'Zarovnání', t: 'select', o: [['left', 'vlevo'], ['center', 'na střed'], ['right', 'vpravo']] },
  { k: 'uppercase', l: 'VŠE VELKÝMI PÍSMENY', t: 'check' },
  { g: 'Barvy' },
  { k: 'bgColor', l: 'Pozadí', t: 'color' }, { k: 'textColor', l: 'Text mimo sekce', t: 'color' },
  { k: 'sectionColor', l: 'Nadpisy sekcí', t: 'color' }, { k: 'noteColor', l: 'Poznámky', t: 'color' }, { k: 'headerColor', l: 'Záhlaví/zápatí', t: 'color' },
  { g: 'Barva textu', help: 'Text má barvu své části písně. Zpěvák ji přebije, jen když má v označení zapnuté „Písmo“; vlastní barva sekce nebo slov přebije obojí.' },
  { k: 'verseColor', l: 'Sloka', t: 'color' }, { k: 'chorusColor', l: 'Refrén', t: 'color' }, { k: 'bridgeColor', l: 'Mezičást', t: 'color' },
  { k: 'instrColor', l: 'Předehra, mezihra, sólo a počet opakování', t: 'color' },
  { g: 'Zpěváci', help: 'Kdo zpívá, jakou barvou (klik na tečku) a jak se na stránce označí – jde kombinovat. Platí pro všechny písně s touto šablonou; v editoru písně (ikona vedle zpěváků) jde nastavit jinak jen pro jednu píseň.' },
  { k: 'singerShow', t: 'singers' },
  { k: 'barWidth', l: 'Šířka proužku (px)', t: 'range', min: 4, max: 40, step: 1 },
  { g: 'Rozvržení stránky' },
  { k: 'onePage', l: 'Zakázat více stránek (písmo se zmenší, aby se píseň vešla na 1 stránku)', t: 'check' },
  { k: 'fit', l: 'Když se nevejde (s povolenými stránkami)', t: 'select', o: [['shrink', 'zmenšit písmo, pak další stránka'], ['paginate', 'hned další stránka']] },
  { k: 'minScale', l: 'Nejmenší písmo', t: 'range', min: 0.4, max: 1, step: 0.05, rel: true, help: 'Jen když jsou povolené další stránky: do této velikosti se písmo zmenší, pak se píseň rozdělí.' },
  { k: 'padX', l: 'Okraj vlevo/vpravo (px)', t: 'range', min: 0, max: 400, step: 2 },
  { k: 'padY', l: 'Okraj nahoře/dole (px)', t: 'range', min: 0, max: 300, step: 2 },
  { k: 'columns', l: 'Počet sloupců', t: 'select', o: [[1, '1'], [2, '2'], [3, '3']] },
  { k: 'colGap', l: 'Mezera mezi sloupci (px)', t: 'range', min: 10, max: 200, step: 2 },
  { k: 'stanzaGap', l: 'Mezera mezi slokami (× výška písma)', t: 'range', min: 0, max: 2, step: 0.05 },
  { g: 'Záhlaví a zápatí' },
  { k: 'showHeader', l: 'Záhlaví (název, ladění, pořadí)', t: 'check' },
  { k: 'headerSize', l: 'Velikost záhlaví (px)', t: 'range', min: 14, max: 70, step: 1 },
  { k: 'headPadX', l: 'Okraj záhlaví vlevo/vpravo (px)', t: 'range', min: 0, max: 400, step: 2 },
  { k: 'showFooter', l: 'Zápatí (strana, další píseň)', t: 'check' },
  { k: 'footerSize', l: 'Velikost zápatí (px)', t: 'range', min: 14, max: 70, step: 1 },
  { k: 'footPadX', l: 'Okraj zápatí vlevo/vpravo (px)', t: 'range', min: 0, max: 400, step: 2 },
  { g: 'Nadpisy sekcí' },
  { k: 'showSections', l: 'Zobrazit nadpisy sekcí', t: 'check' },
  { k: 'sectionScale', l: 'Velikost nadpisů sekcí', t: 'range', min: 0.3, max: 1.2, step: 0.05, rel: true },
];

const TemplatesView = {
  previewSong: null, page: 0, selected: null, paintSide: null,

  /* Rovnou úprava šablony (naposledy upravovaná, jinak výchozí); jiná šablona se vybírá nahoře v levém panelu.
     Rozložení jako editor písně – vlevo volby, uprostřed stránka, vpravo uložení a náhled. */
  render(main, tplId) {
    const tpl = Store.templates.get(tplId) || Store.templates.get(this.selected) || Store.templates.get(Settings.get('defaultTemplate')) || [...Store.templates.values()][0];
    if (!tpl) return;
    if (tpl.id !== tplId) history.replaceState(null, '', '#/templates/' + tpl.id);
    const content = h('div', { class: 'content', style: { padding: 0 } });
    main.append(h('div', { class: 'view has-detail song-open' }, content));
    this.editor(content, tpl);
  },

  async create() {   // nová šablona s původním nastavením (kopii současné udělá Uložit jako)
    const name = await promptDlg('Název nové šablony', 'Moje šablona');
    if (!name) return;
    const t = Object.assign(clone(DEFAULT_TEMPLATE), { id: uid(), name });
    await Store.put('templates', t);
    location.hash = '#/templates/' + t.id;
  },

  /* Úprava šablony: na kopii, uloží se tlačítkem Uložit (Ctrl+S); při odchodu se App zeptá */
  editor(root, tpl) {
    const t = tplFill(Object.assign(clone(DEFAULT_TEMPLATE), tpl));
    this.selected = t.id;
    let dirty = false;
    const savedInd = h('span', { class: 'saved-ind' });
    const saveBtn = h('button', { class: 'btn', title: 'Uložit změny (Ctrl+S)', onclick: () => save(true) }, '💾 Uložit');
    const paintSaved = () => { savedInd.textContent = dirty ? 'Neuloženo' : ''; savedInd.classList.toggle('dirty', dirty); saveBtn.classList.toggle('primary', dirty); };
    // „neuloženo“ = jiný stav než při posledním uložení (změna tam a zpět nic nemění)
    let base = JSON.stringify(t);
    const markDirty = () => { dirty = JSON.stringify(t) !== base; paintSaved(); };
    const save = async manual => {
      if (!dirty && !manual) return;
      const snap = JSON.stringify(t);
      try { await Store.put('templates', clone(t)); }
      catch (e) { toast('Šablonu se nepodařilo uložit: ' + e.message, 'err', 8000); return false; }
      base = snap; markDirty();
      if (manual) toast('Uloženo', 'ok', 1500);
    };
    const saveAs = async stay => {   // nová šablona ze současného nastavení; původní zůstane, jak byla uložená
      const name = await promptDlg('Uložit jako novou šablonu – název', t.name + ' (2)');
      if (!name) return false;
      const c = Object.assign(clone(t), { id: uid(), name });
      await Store.put('templates', c);
      dirty = false;
      toast('Uloženo jako „' + name + '“', 'ok');
      if (!stay) location.hash = '#/templates/' + c.id;
      return true;
    };
    App.edit = { get what() { return `Šablona „${t.name || 'bez názvu'}“`; }, dirty: () => dirty, save, saveAs };

    // Levý panel: název a všechny volby šablony po skupinách
    const nameInp = h('input', { class: 'inp ep-title', value: t.name, placeholder: 'Název šablony' });
    nameInp.oninput = () => { t.name = nameInp.value; markDirty(); };
    // výběr šablony k úpravě (při neuložených změnách se App zeptá) a nová šablona
    const tplSel = h('select', { class: 'inp', title: 'Kterou šablonu upravit' });
    const paintSel = () => tplSel.replaceChildren(...[...Store.templates.values()].sort((a, b) => a.name.localeCompare(b.name, 'cs'))
      .map(x => h('option', { value: x.id, selected: x.id === t.id }, x.name + (x.id === Settings.get('defaultTemplate') ? ' ★' : ''))));
    paintSel();
    tplSel.onchange = () => { const id = tplSel.value; tplSel.value = t.id; location.hash = '#/templates/' + id; };
    let newBtn;
    const form = h('div', { class: 'ed-panel ed-left-panel tpl-form' },
      h('div', { class: 'ep-group ep-meta' },
        h('div', { class: 'f' }, h('span', {}, 'Šablona'), h('div', { class: 'tpl-row' }, tplSel,
          newBtn = h('button', { class: 'btn small nogrow', title: 'Nová šablona s původním nastavením', onclick: () => this.create() }, '＋ Nová'))),
        h('label', { class: 'f' }, h('span', {}, 'Název'), nameInp)));
    let grp = null;
    for (const f of TPL_FIELDS) {
      if (f.g) { grp = h('div', { class: 'ep-group tpl-grp' }, h('div', { class: 'ep-lbl' }, f.g), f.help ? h('p', { class: 'help' }, f.help) : null); form.appendChild(grp); continue; }
      let ctl;
      const v = t[f.k];
      if (f.t === 'singers') {
        // zpěváci šablony: kdo, jakou barvou a jak se označí (přidání / odebrání / barva jen v této šabloně)
        ctl = h('div');
        const paintSg = () => {
          const ops = singerListOps(() => Store.singers(t), list => { t.singers = list; upd(); }, 'z této šablony');
          ctl.replaceChildren(singerShowTable((code, k) => singerShowOf(t, code)[k], (code, k, val) => {
            t.singerShow = Object.assign({}, t.singerShow);
            t.singerShow[code] = Object.assign(singerShowOf(t, code), { [k]: val });
            upd();
          }, { color: ops.color, add: async () => { if (await ops.add()) paintSg(); }, remove: async sg => { if (await ops.remove(sg)) paintSg(); } }, Store.singers(t)));
        };
        paintSg();
      } else if (f.t === 'check') {
        ctl = h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!v, onchange: e => { t[f.k] = e.target.checked; upd(); } }), f.l);
      } else if (f.t === 'select') {
        const sel = h('select', { class: 'inp' }, f.o.map(([val, lab]) => h('option', { value: val, selected: String(val) === String(v) }, lab)));
        sel.onchange = () => { t[f.k] = typeof f.o[0][0] === 'number' ? +sel.value : sel.value; upd(); };
        ctl = h('label', { class: 'f' }, h('span', {}, f.l), sel);
      } else if (f.t === 'color') {
        const c = h('input', { type: 'color', value: v });
        c.oninput = () => { t[f.k] = c.value; upd(); };
        ctl = h('label', { class: 'chk tpl-color' }, c, f.l);
      } else if (f.t === 'range') {
        // hodnota jde i napsat (klik do čísla)
        const pct = f.pct || f.k === 'letterSpacing', dec = pct ? 0 : (String(f.step).split('.')[1] || '').length;
        const r = h('input', { type: 'range', min: f.min, max: f.max, step: f.step, value: v });
        // rel: násobek velikosti písma, ukazuje se v px
        const num = numField(v, f.rel ? { scale: () => t.fontSize, dec: 0, min: f.min, max: f.max } : { pct, dec, min: f.min, max: f.max }, x => { t[f.k] = x; r.value = x; upd(); });
        r.oninput = () => { t[f.k] = +r.value; num.setValue(+r.value); upd(); };
        ctl = h('label', { class: 'f' }, h('span', {}, f.l, ': ', num, pct ? ' %' : f.rel ? ' px' : ''), r, f.help ? h('span', { class: 'help field-help' }, f.help) : null);
      }
      grp.appendChild(ctl);
    }

    // Uprostřed stránka (pro obrazovku tohoto zařízení), stránkování vpravo dole
    const prevWrap = h('div', { class: 'preview-wrap tpl-stage' });
    const songSel = h('select', { class: 'inp', title: 'Na které písni ukázat šablonu' }, Store.sortedSongs().map(s => h('option', { value: s.id, selected: s.id === this.previewSong }, s.title)));
    const pageLbl = h('span', { class: 'page-lbl' });
    const pvInfo = h('div', { class: 'ep-info' });
    const pageNav = h('div', { class: 'ed-pages' },
      h('button', { class: 'tl', title: 'Předchozí stránka', onclick: () => { this.page = Math.max(0, this.page - 1); paint(); } }, ic('up')),
      pageLbl,
      h('button', { class: 'tl', title: 'Další stránka', onclick: () => { this.page++; paint(); } }, ic('down')));
    let lay, stage;
    const W = Screens.main().w, H = Screens.main().h;
    const paint = () => {
      const song = Store.songs.get(songSel.value) || sampleSong();
      lay = Render.layout(song, t, W, H);
      this.page = Math.min(this.page, lay.pages.length - 1);
      prevWrap.innerHTML = '';
      stage = Render.makeStage(t, W, H);
      prevWrap.appendChild(stage);
      Render.renderPage(stage, lay, t, this.page, { title: song.title, artist: song.artist, key: song.key, tempo: song.tempo, pos: '3/12', next: 'Další píseň v playlistu' });
      Render.fit(stage, prevWrap, W, H);
      pageLbl.textContent = `${this.page + 1}/${lay.pages.length}`;
      pageNav.style.display = lay.pages.length > 1 ? '' : 'none';
      pvInfo.replaceChildren(h('div', {}, `${Screens.label(Screens.main())}`),
        h('div', {}, plural(lay.pages.length, 'stránka', 'stránky', 'stránek') + (lay.k < 0.999 ? ` · písmo ${Math.round(t.fontSize * lay.k)} px` : '')));
    };
    const upd = () => { markDirty(); clearTimeout(this._pt); this._pt = setTimeout(paint, 60); };
    songSel.onchange = () => { this.previewSong = songSel.value; this.page = 0; paint(); };

    // Vpravo: uložení, použití šablony, náhled
    const moreBtn = h('button', { class: 'btn nogrow', title: 'Další volby šablony', onclick: e => popupMenu(e.currentTarget, [
      { label: 'Uložit jako novou šablonu', action: () => saveAs() },
      ...(t.id !== 'default' ? [{ sep: true }, { label: 'Smazat šablonu', danger: true, action: () => this.del(t) }] : [])]) }, '⋯');
    const useBox = h('div', { class: 'ep-group' });
    const paintUse = () => {
      const isDef = Settings.get('defaultTemplate') === t.id;
      const n = Store.sortedSongs().filter(s => Store.template(s.templateId || Settings.get('defaultTemplate')).id === t.id).length;
      useBox.replaceChildren(h('div', { class: 'ep-lbl' }, 'Použití'),
        isDef ? h('div', { class: 'tp-isdef-row' }, '★ Výchozí šablona') :
          h('button', { class: 'btn', title: 'Platí pro písně, které nemají vlastní šablonu', onclick: () => { Settings.set('defaultTemplate', t.id); this.paintSide(); toast('Nastaveno jako výchozí šablona', 'ok'); } }, '☆ Nastavit jako výchozí'),
        h('div', { class: 'ep-info' }, n ? 'Používá ' + plural(n, 'píseň', 'písně', 'písní') : 'Zatím ji nepoužívá žádná píseň.'));
    };
    paintUse();
    this.paintSide = () => { paintSel(); paintUse(); };
    const pvGroup = h('div', { class: 'ep-group' }, h('div', { class: 'ep-lbl' }, 'Náhled'), h('label', { class: 'f' }, h('span', {}, 'Píseň'), songSel), pvInfo);
    const side = h('div', { class: 'ed-side' },
      h('div', { class: 'ed-save' }, savedInd, h('div', { class: 'ed-save-row' }, moreBtn, saveBtn)),
      useBox, h('div', { class: 'grow' }), pvGroup);
    // telefon: nahoře výběr šablony a uložení, pod tím stránka (pořád na očích), pod ní volby
    const mobile = isMobile();
    if (mobile) {
      $('.ep-meta > .f', form).remove();
      $('.ep-meta', form).after(useBox, pvGroup);
    }
    root.appendChild(h('div', { class: 'song-editor tpl-editor' + (mobile ? ' m-tpl' : '') },
      mobile ? h('div', { class: 'm-head' }, tplSel, newBtn, moreBtn, saveBtn) : null,
      h('div', { class: 'ed-body' }, form,
        h('div', { class: 'ed-center tpl-preview' }, h('div', { class: 'ed-main' }, h('div', { class: 'ed-stagebox' }, prevWrap, pageNav), side)))));
    new ResizeObserver(() => stage && Render.fit(stage, prevWrap, W, H)).observe(prevWrap);
    paint();
  },

  async del(t) {
    if (!await confirmDlg(`Smazat šablonu „${t.name}“? Písně s ní přejdou na výchozí šablonu.`, 'Smazat', true)) return;
    if (Settings.get('defaultTemplate') === t.id) Settings.set('defaultTemplate', 'default');
    await Store.remove('templates', t.id);
    App.edit = null;   // smazanou šablonu už není co ukládat
    location.hash = '#/templates';
  },
};

/* ===== Nastavení: vlevo kategorie, vpravo vždy jen jedna (v telefonu nejdřív seznam) ===== */
const SET_SECTIONS = [
  ['band', '☁ Kapela a synchronizace'],
  ['device', '📱 Toto zařízení'],
  ['screens', '🖥 Obrazovky kapely'],
  ['reader', '▶ Čtečka a ovládání'],
  ['backup', '💾 Záloha a import'],
  ['about', 'ⓘ O aplikaci'],
];
const SET_ALIASES = { share: 'band', user: 'device' };

/* řádek nastavení: vlevo název a vysvětlení, vpravo ovládací prvek */
const setRow = (title, help, ctl, cls = '') => h('div', { class: 'set-row ' + cls }, h('div', {}, h('b', {}, title), help ? h('span', { class: 'help' }, help) : null), ctl);
const setSwitch = (checked, onchange) => h('input', { type: 'checkbox', class: 'switch', checked: !!checked, onchange: e => onchange(e.target.checked) });
const setFlag = (k, title, help) => setRow(title, help, setSwitch(Settings.data[k], v => Settings.set(k, v)));

const SettingsView = {
  onSync: null,

  render(main, section) {
    section = SET_ALIASES[section] || section || '';
    const sub = section.startsWith('screen-') ? section.slice(7) : '';
    if (sub) section = 'screens';
    const known = SET_SECTIONS.some(([id]) => id === section);
    const cur = known ? section : 'band';
    const nav = h('div', { class: 'side set-nav' }, h('h2', {}, 'Nastavení'),
      SET_SECTIONS.map(([id, label]) => h('button', { class: 'item set-item' + (known && id === cur ? ' active' : ''), onclick: () => { location.hash = '#/settings/' + id; } }, label)),
      h('div', { class: 'set-ver help' }, 'PROMPTER mini ' + APP_VERSION));
    const title = SET_SECTIONS.find(([id]) => id === cur)[1];
    const body = this[cur](sub);
    const c = h('div', { class: 'content set-content' },
      h('div', { class: 'set-head' },
        h('button', { class: 'btn nogrow set-back', onclick: () => { location.hash = '#/settings'; } }, '◀ Nastavení'),
        h('h1', {}, title)),
      body);
    // v úzkém okně bez zvolené kategorie se ukáže jen seznam kategorií
    main.appendChild(h('div', { class: 'view set-view' + (known ? ' has-sec' : '') }, nav, c));
  },

  /* ---------- Kapela a synchronizace ---------- */
  band() {
    const box = h('div', { class: 'set-sec' });
    const paint = () => { box.innerHTML = ''; box.append(...this.bandBody()); };
    paint();
    // stav se překresluje sám (synchronizace běží na pozadí)
    this.onSync = () => { if (box.isConnected) { const st = $('.set-status', box); if (st) st.replaceWith(this.bandStatus()); } };
    return box;
  },

  bandStatus() {
    const mode = Sync.mode(), st = Sync.state, mg = mode === 'mega' ? (Settings.data.mega || {}) : null;
    const g = Settings.get('gh') || {};
    let tone = 'ok', head, who = '', line;
    if (mode === 'off') { tone = ''; head = 'Nepřihlášeno'; line = 'Písně a playlisty jsou zatím jen v tomto zařízení.'; }
    else {
      head = Sync.locked() ? 'Odhlášeno – přihlas se znovu' : mg ? 'Přihlášeno ke kapele' : 'Sdílení zapnuté';
      who = mg ? `${mg.email} · složka v Mega „${mg.folder || 'PROMPTERmini'}“`
        : mode === 'github' ? `GitHub · ${g.owner}/${g.repo}${g.login ? ' · ' + g.login : ''}` : `Složka · ${Settings.get('sharedFolder')}`;
      const ls = Sync.lastSync, when = !ls ? '' : (ls.toDateString() === new Date().toDateString() ? ' v ' : ' ' + ls.toLocaleDateString('cs-CZ') + ' v ') + ls.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
      line = { idle: 'Synchronizováno' + when, syncing: 'Synchronizuji…', pending: `Neodeslané změny: ${Store.pendingCount()}`, offline: 'Offline – změny se odešlou po připojení',
        locked: 'Synchronizace čeká na přihlášení', error: Sync.lastError || 'Chyba synchronizace', off: 'Zatím nesynchronizováno' }[st] || st;
      if (st === 'error' || Sync.locked()) tone = 'err'; else if (st === 'pending' || st === 'offline') tone = 'warn';
    }
    return h('div', { class: 'set-status ' + tone }, h('span', { class: 'dot' }),
      h('div', {}, h('b', {}, head), who ? h('span', {}, who) : null, h('span', { class: 'st' }, line),
        mg && st === 'error' ? h('button', { class: 'btn small', style: { alignSelf: 'flex-start', marginTop: '6px' }, onclick: () => megaDiagDialog() }, 'Diagnostika Mega') : null,
        Settings.get('readOnly') && mode !== 'off' ? h('span', { class: 'tag' }, 'jen pro čtení – nic se neodesílá') : null));
  },

  bandBody() {
    const mode = Sync.mode(), mega = mode === 'mega';
    const out = [this.bandStatus()];
    if (mode === 'off') {
      out.push(
        h('div', { class: 'set-actions' }, h('button', { class: 'btn primary', onclick: () => loginDialog() }, '🔑 Přihlásit ke kapele')),
        h('p', { class: 'help' }, 'Přihlášení e-mailem a heslem kapely (společný účet Mega). Písně a playlisty se pak samy stáhnou a synchronizují mezi všemi zařízeními.'),
        h('h3', {}, 'Zakládáš kapelu?'),
        h('ol', { class: 'help set-steps' },
          h('li', {}, 'Na ', h('a', { href: 'https://mega.io/register', target: '_blank' }, 'mega.io/register'), ' založ nový účet jen pro kapelu – ne svůj osobní, heslo budou znát všichni členové. Dvoufázové ověření nezapínej.'),
          h('li', {}, 'Přihlas se jím tady. Aplikace si v Mega sama vytvoří složku a nahraje do ní písně.'),
          h('li', {}, 'Pak tu klikni na Pozvat členy a pošli jim zprávu s adresou aplikace. Heslo jim řekni zvlášť.')),
        this.otherStorage());
      return out;
    }
    out.push(h('div', { class: 'set-actions' },
      Sync.locked() ? h('button', { class: 'btn primary', onclick: () => loginDialog({ expired: true }) }, '🔑 Přihlásit')
        : h('button', { class: 'btn primary', onclick: () => App.syncClick() }, '⟳ Synchronizovat teď'),
      mega && !Settings.get('readOnly') ? h('button', { class: 'btn', onclick: () => inviteDialog() }, '👥 Pozvat členy') : null,
      h('button', { class: 'btn danger', onclick: () => bandLogout() }, mega ? 'Odhlásit' : 'Odpojit')));
    out.push(h('div', { class: 'set-rows' },
      mega && !window.native ? setRow('Zůstat přihlášen', 'Vypni na cizím nebo sdíleném počítači – po zavření prohlížeče bude potřeba přihlásit se znovu.',
        setSwitch(Settings.data.rememberBand !== false, setRememberBand)) : null,
      setFlag('autoSync', 'Synchronizovat automaticky', 'Změny se odešlou samy a změny ostatních se stahují pravidelně.'),
      setRow('Jen pro čtení', 'Pro čtečky: písně se jen stahují, z tohoto zařízení se nic neodešle.',
        setSwitch(Settings.get('readOnly'), v => { Settings.set('readOnly', v); Sync.refreshState(); App.paintSync(); }))));
    const adv = h('details', { class: 'set-adv' }, h('summary', {}, 'Pokročilé'),
      h('div', { class: 'set-rows' },
        mega ? setRow('Složka kapely v Mega', `„${(Settings.data.mega || {}).folder || 'PROMPTERmini'}“ – měň jen tehdy, když má kapela písně v jinak pojmenované složce.`,
          h('button', { class: 'btn nogrow', onclick: () => changeBandFolder() }, 'Změnit')) : null,
        mega ? setRow('Diagnostika Mega', 'Co aplikace v účtu Mega vidí. Při potížích se synchronizací pošli výpis.', h('button', { class: 'btn nogrow', onclick: () => megaDiagDialog() }, 'Zobrazit')) : null,
        mega ? setRow('Neoficiální knihovna', 'Připojení k Mega používá neoficiální knihovnu. Kdyby ho Mega rozbila, přepni na GitHub – písně v aplikaci zůstanou.', null) : null),
      mode === 'github' ? this.ghBlock() : mode === 'folder' ? this.folderBlock() : null);
    out.push(adv);
    return out;
  },

  /* jiné úložiště než Mega – jen když zatím není nic připojené */
  otherStorage() {
    const m = Settings.data.mega || {};
    const folderIn = h('input', { class: 'inp set-sel', id: 'band-folder', value: m.folder || 'PROMPTERmini', autocomplete: 'off', 'data-protonpass-ignore': 'true', 'data-1p-ignore': 'true', 'data-lpignore': 'true', 'data-bwignore': 'true' });
    folderIn.onchange = () => Settings.set('mega', Object.assign({}, Settings.data.mega, { folder: folderIn.value.trim() || 'PROMPTERmini', folderId: '' }));
    return h('details', { class: 'set-adv' }, h('summary', {}, 'Pokročilé'),
      h('div', { class: 'set-rows' },
        setRow('Složka kapely v Mega', 'Měň jen tehdy, když má kapela písně v jinak pojmenované složce (správce ti řekne).', folderIn)),
      h('h3', {}, 'Jiné úložiště místo Mega: GitHub'), h('p', { class: 'help' }, 'Zdarma, nejspolehlivější při souběžných úpravách. Každý člen potřebuje přístupový token.'), this.ghBlock(),
      h('h3', {}, 'Jiné úložiště místo Mega: synchronizovaná složka'),
      window.native ? this.folderBlock() : h('p', { class: 'help' }, 'Jen v programu PROMPTER mini.exe – složka, kterou synchronizuje jiná aplikace (MEGA Desktop, OneDrive, Dropbox, síťový disk).'));
  },

  folderBlock() {
    const inp = h('input', { class: 'inp', value: Settings.get('sharedFolder') || '', placeholder: 'např. C:\\Users\\Petr\\MEGA\\Kapela-pisne', readonly: true });
    const choose = async dir => {
      if (!dir) return;
      Settings.set('sharedFolder', dir); Settings.set('syncMode', 'folder');
      inp.value = dir;
      await freshSync();
      window.native.watchFolder(dir);
      try {
        const r = await Sync.run();
        toast(`Složka připojena · načteno ${r.downloaded}, zapsáno ${r.pushed}${r.conflicts ? ', konflikty ' + r.conflicts : ''}`, 'ok', 5000);
      } catch (e) { toast(e.message, 'err', 7000); }
      App.go(true);
    };
    const sugg = window.native.suggestFolders();
    return h('div', {},
      h('div', { class: 'row' }, inp, h('button', { class: 'btn primary nogrow', onclick: async () => choose(await window.native.pickFolder()) }, '📁 Vybrat složku')),
      sugg.length ? h('p', { class: 'help' }, 'Nalezené cloudové složky v tomto PC: ', sugg.map(p => h('code', { style: { marginRight: '6px' } }, p))) : null,
      h('details', {}, h('summary', {}, 'Návod – MEGA Desktop'),
        h('ol', { class: 'help set-steps', html: `
          <li>Nainstaluj <b>MEGA Desktop App</b> a ve složce MEGA na disku vytvoř složku např. <code>Kapela-pisne</code>.</li>
          <li>Na mega.io ji sdílej členům (pravé tlačítko → <b>Sdílet</b>, právo <b>Číst a zapisovat</b>). Nepoužívej „Sdílet odkaz“ – ten může otevřít kdokoli.</li>
          <li>Každý člen přijme pozvánku a v MEGA Desktop App si sdílenou složku synchronizuje do svého PC.</li>
          <li>Tady klikni na <b>Vybrat složku</b> a zvol ji.</li>` })),
      h('p', { class: 'help' }, 'Data čtečky zůstávají i v její vlastní složce „data“ – když cloud vypadne, čtečka hraje dál.'));
  },

  ghBlock() {
    const g = GH.cfg();
    const repoIn = h('input', { class: 'inp', value: g.owner && g.repo ? `${g.owner}/${g.repo}` : '', placeholder: 'uživatel/kapela-pisne nebo odkaz na repozitář' });
    const tokenIn = h('input', { class: 'inp', type: 'password', value: g.token || '', placeholder: 'github_pat_…' });
    const status = h('div', { class: 'help', style: { marginTop: '8px' } });
    const connect = async () => {
      const m = /(?:github\.com[/:])?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(repoIn.value.trim());
      if (!m || !tokenIn.value.trim()) return toast('Vyplň repozitář (uživatel/název) i token.', 'warn');
      const prev = clone(Settings.get('gh')), prevMode = Settings.get('syncMode');
      Settings.set('gh', Object.assign({}, prev, { owner: m[1], repo: m[2], token: Secret.protect(tokenIn.value.trim()), branch: prev.branch || 'main' }));
      Settings.set('syncMode', 'github');
      status.textContent = 'Ověřuji přístup…';
      try {
        const r = await GH.test();
        Settings.set('gh', Object.assign({}, Settings.get('gh'), { login: r.login, canPush: r.canPush, branch: r.defaultBranch || 'main' }));
        Settings.set('readOnly', false);
        if (!r.private) toast('Pozor: repozitář je VEŘEJNÝ – texty uvidí kdokoli. Přepni ho na Private (Settings → General → Danger Zone).', 'warn', 9000);
        await freshSync();
        const res = await Sync.run();
        toast(`GitHub připojen · staženo ${res.downloaded}, odesláno ${res.pushed}`, 'ok', 5000);
        App.go(true);
      } catch (e) {
        Settings.set('gh', prev); Settings.set('syncMode', prevMode);
        status.innerHTML = `<span style="color:var(--err)">Nepodařilo se připojit: ${esc(e.message)}</span>`;
      }
    };
    const tokenUrl = 'https://github.com/settings/personal-access-tokens/new?name=PROMPTER%20mini&description=Synchronizace%20pisni&expires_in=none&contents=write';
    return h('div', {},
      h('ol', { class: 'help set-steps' },
        h('li', { html: 'Přihlas se na GitHub (nebo si <a href="https://github.com/signup" target="_blank">zdarma založ účet</a>).' }),
        h('li', { html: '<a href="https://github.com/new?name=kapela-pisne&visibility=private" target="_blank">Vytvoř soukromý repozitář</a> – musí být <b>Private</b>.' }),
        h('li', { html: `<a href="${tokenUrl}" target="_blank">Vytvoř přístupový token</a> – <b>Only select repositories</b> → kapela-pisne, <b>Contents: Read and write</b>.` }),
        h('li', {}, 'Vlož sem repozitář a token a klikni Připojit. Ostatní členové zadají stejný repozitář a token.')),
      h('div', { class: 'grid2' }, h('label', { class: 'f' }, h('span', {}, 'Repozitář'), repoIn), h('label', { class: 'f' }, h('span', {}, 'Token'), pwField(tokenIn))),
      h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn primary nogrow', onclick: connect }, '🔗 Připojit ke GitHubu')),
      status);
  },

  /* ---------- Toto zařízení ---------- */
  device() {
    const box = h('div', { class: 'set-sec' });
    const paint = () => {
      const S = Settings.data;
      box.innerHTML = '';
      const roleSel = h('select', { class: 'inp set-sel' }, h('option', { value: '', disabled: true, selected: !S.deviceRole }, '— nevybráno —'),
        DEVICE_ROLES.map(r => h('option', { value: r.id, selected: r.id === S.deviceRole }, r.name)));
      roleSel.onchange = () => {
        applyDeviceRole(roleSel.value);
        if (App.isStage()) sessionStorage.setItem('unlocked', '1');   // teď jsem v úpravách: zamkne se až při otevření čtečky
        toast('Uloženo: ' + roleName(roleSel.value) + (App.isStage() ? ' – do úprav pak jen s PINem' + (S.pinHash ? '' : ' (zvolíš ho při příštím vstupu)') : ''), 'ok', 5000);
      };
      const scrSel = h('select', { class: 'inp set-sel' }, [Screens.auto(), ...Screens.list()].map(sc => h('option', { value: sc.id, selected: sc.id === Screens.myId() }, Screens.label(sc))));
      scrSel.onchange = () => { Settings.set('screenId', scrSel.value); toast('Toto zařízení: ' + Screens.mine().name, 'ok'); paint(); };
      const singerSel = h('select', { class: 'inp set-sel' }, h('option', { value: '' }, '— nikdo / nezvýrazňovat —'),
        Store.allSingers().map(sg => h('option', { value: sg.code, selected: sg.code === S.mySinger }, sg.name)));
      singerSel.onchange = () => { Settings.set('mySinger', singerSel.value); Settings.set('highlightMine', !!singerSel.value); };
      const rotSel = h('select', { class: 'inp set-sel' }, [[0, 'neotáčet'], [90, 'o 90° doprava'], [270, 'o 90° doleva'], [180, 'o 180°']]
        .map(([v, l]) => h('option', { value: v, selected: (S.readerRotate || 0) === v }, l)));
      rotSel.onchange = () => Settings.set('readerRotate', +rotSel.value);
      const nameIn = h('input', { class: 'inp set-sel', value: S.userName, placeholder: 'např. Petr' });
      nameIn.onchange = () => Settings.set('userName', nameIn.value.trim());
      const pinBtn = h('button', { class: 'btn nogrow', onclick: async () => {
        const p = await promptDlg(S.pinHash ? 'Nový PIN (prázdné = zrušit PIN)' : 'Zvol PIN pro úpravy (čísla nebo text)');
        if (p === null) return;
        Settings.set('pinHash', p ? pinHash(p) : '');
        sessionStorage.setItem('unlocked', '1');
        toast(p ? 'PIN nastaven. Bez něj půjde jen číst ve čtečce.' : 'PIN zrušen', 'ok');
        paint();
      } }, S.pinHash ? '🔒 Změnit / zrušit' : '🔓 Nastavit PIN');
      box.append(
        h('p', { class: 'help' }, 'Platí jen pro tento počítač, tablet či telefon – ostatním členům se nemění.'),
        h('h3', {}, 'Použití'),
        h('div', { class: 'set-rows' },
          App.canInstall() ? setRow('Nainstalovat aplikaci', 'Ikona na ploše, celá obrazovka; data zůstanou v zařízení i bez internetu.', h('button', { class: 'btn primary nogrow', onclick: () => App.install() }, 'Nainstalovat')) : null,
          setRow('K čemu zařízení slouží', 'Určuje, co se otevře po zapnutí.', roleSel),
          setRow('Moje jméno', 'Ukazuje se u změn, které odsud uděláš.', nameIn),
          setRow('PIN pro úpravy', S.pinHash ? 'Úpravy jsou zamčené PINem – bez něj jde jen číst ve čtečce.' : 'Nepovinné – např. na čtečce, aby nikdo omylem nic nezměnil.', pinBtn),
          setRow('Vzhled aplikace', 'Barvy stránky ve čtečce určuje šablona písně.', segControl(THEMES, S.theme || 'dark', v => { Settings.set('theme', v); App.applyTheme(); })),
          setRow('Průvodce nastavením', 'Znovu projít otázky z prvního spuštění.', h('button', { class: 'btn nogrow', onclick: () => setupWizard() }, 'Spustit')),
          setRow('Virtuální klávesnice', 'U aktivního textového pole tlačítko ⌨ – česká klávesnice na obrazovce (pro airmouse a klávesnice, které píšou jiné znaky).',
            setSwitch(S.vkb !== false, v => { Settings.set('vkb', v); Vkb.refresh(); })),
          window.native ? setRow('Program', 'Zástupce na ploše a v nabídce Start; minimalizovat do Windows nebo ukončit (i v levé liště pod Program).', h('div', { class: 'row' },
            h('button', { class: 'btn nogrow', onclick: async () => { const r = await window.native.makeShortcuts(); toast(r && r.ok ? 'Zástupce vytvořen na ploše a v nabídce Start' : 'Zástupce jde vytvořit jen v programu pro Windows', r && r.ok ? 'ok' : 'warn'); } }, 'Vytvořit zástupce'),
            h('button', { class: 'btn nogrow', onclick: () => window.native.minimize() }, 'Minimalizovat'),
            h('button', { class: 'btn danger nogrow', onclick: () => App.quit() }, 'Ukončit'))) : null),
        h('h3', {}, 'Zobrazení ve čtečce'),
        h('div', { class: 'set-rows' },
          setRow('Toto zařízení je obrazovka', 'Na webu a v telefonu se stránka přizpůsobí oknu. Obrazovku kapely zvol jen pro pevně umístěný displej.', scrSel),
          setRow('Zvýraznit moje řádky', 'Řádky ostatních zpěváků budou ztlumené (řádky „všichni“ zůstanou).', singerSel),
          setRow('Otočit obraz čtečky', 'Jen když systém monitor sám neotáčí.', rotSel)));
    };
    paint();
    return box;
  },

  /* ---------- Obrazovky kapely (sdílené profily: rozměr, písmo) ---------- */
  screens(sub) {
    let edId = sub || Screens.editId();
    const scrTabs = h('div', { class: 'scr-tabs' });
    const scrBox = h('div', { class: 'scr-box' });
    const presets = [[1920, 1080, 'Full HD (většina 24" monitorů)'], [1920, 1200, '24" 16:10'], [1680, 1050, '22" 16:10'], [1600, 900, ''], [1366, 768, 'notebook'], [1280, 1024, 'starší 4:3/5:4'], [2560, 1440, '27" QHD'], [2048, 1536, 'iPad'], [2340, 1080, 'mobil']];
    const paintScreens = () => {
      if (!Screens.list().some(x => x.id === edId)) edId = 'main';
      scrTabs.innerHTML = '';
      for (const sc of Screens.list()) scrTabs.appendChild(h('button', { class: 'chip' + (sc.id === edId ? ' on' : ''), onclick: () => { edId = sc.id; paintScreens(); } },
        sc.name + (sc.id === Screens.myId() ? ' · toto zařízení' : '')));
      scrTabs.appendChild(h('button', { class: 'chip add', onclick: async () => {
        const name = await promptDlg('Název nové obrazovky', 'Tablet – kytara', 'např. Mobil – basa');
        if (!name) return;
        const sc = await Screens.add({ name }); edId = sc.id; paintScreens();
      } }, '＋ Nová obrazovka'));
      paintScreen(Screens.get(edId));
    };
    const paintScreen = orig => {
      const scr = clone(orig); // úpravy jen v kopii, uloží je Screens.save
      scrBox.innerHTML = '';
      const nameIn = h('input', { class: 'inp', value: scr.name });
      const wIn = h('input', { class: 'inp', type: 'number', value: scr.w, min: 320, max: 7680 });
      const hIn = h('input', { class: 'inp', type: 'number', value: scr.h, min: 240, max: 7680 });
      const diag = h('input', { class: 'inp', type: 'number', value: scr.diag || 24, min: 4, max: 100, step: 0.5 });
      const dist = h('input', { class: 'inp', type: 'number', value: scr.dist || 2.5, min: 0.2, max: 15, step: 0.1 });
      const fontIn = h('input', { class: 'inp', type: 'number', value: scr.fontPct || 100, min: 40, max: 300, step: 5 });
      const rec = h('div', { class: 'help' });
      const presetBox = h('div', { class: 'row', style: { marginTop: '8px' } });
      const orientBtns = {};
      const isPortrait = () => +hIn.value >= +wIn.value;
      const save = () => {
        Object.assign(scr, { name: nameIn.value.trim() || scr.name, w: Math.max(320, +wIn.value | 0), h: Math.max(240, +hIn.value | 0), diag: +diag.value, dist: +dist.value, fontPct: Math.max(40, +fontIn.value || 100) });
        Screens.save(scr);
        paintRec();
      };
      const paintRec = () => {
        const { pxPerCm, px } = fontAdvice(scr.w, scr.h, scr.diag, scr.dist);
        rec.innerHTML = `Monitor ${scr.diag}" při ${scr.w}×${scr.h} ≈ ${pxPerCm.toFixed(1)} px/cm. Pro pohodlné čtení ze vzdálenosti ${scr.dist} m doporučuji písmo alespoň <b>${px} px</b> (nastavíš v šabloně).`;
      };
      const applyRes = (w, hh) => { wIn.value = w; hIn.value = hh; save(); paintOrient(); };
      const paintOrient = () => {
        const p = isPortrait();
        orientBtns.p.classList.toggle('primary', p); orientBtns.l.classList.toggle('primary', !p);
        presetBox.innerHTML = '';
        for (const [a, b, label] of presets) {
          const [w, hh] = p ? [b, a] : [a, b];
          presetBox.appendChild(h('button', { class: 'btn small nogrow', title: label, onclick: () => applyRes(w, hh) }, `${w}×${hh}`));
        }
      };
      const setOrient = portrait => { if (portrait !== isPortrait()) applyRes(+hIn.value, +wIn.value); };
      orientBtns.p = h('button', { class: 'btn nogrow', onclick: () => setOrient(true) }, 'Na výšku');
      orientBtns.l = h('button', { class: 'btn nogrow', onclick: () => setOrient(false) }, 'Na šířku');
      [nameIn, wIn, hIn, diag, dist, fontIn].forEach(i => i.addEventListener('change', () => { save(); paintOrient(); if (i === nameIn) paintScreens(); }));
      scrBox.append(
        h('div', { class: 'row' },
          h('label', { class: 'f', style: { flex: '2 1 220px' } }, h('span', {}, 'Název obrazovky'), nameIn),
          scr.id === 'main' ? h('span', { class: 'help nogrow', style: { alignSelf: 'center' } }, 'Hlavní čtečka kapely – nejde smazat') :
            h('button', { class: 'btn danger nogrow', onclick: async () => {
              if (!await confirmDlg(`Smazat obrazovku „${scr.name}“? Její konce stránek v písních zůstanou, jen se nepoužijí.`, 'Smazat')) return;
              await Screens.remove(scr.id); edId = 'main'; paintScreens();
            } }, '🗑 Smazat')),
        h('h3', {}, 'Rozměr'),
        h('div', { class: 'row' },
          h('label', { class: 'f' }, h('span', {}, 'Šířka (px)'), wIn), h('label', { class: 'f' }, h('span', {}, 'Výška (px)'), hIn),
          h('label', { class: 'f' }, h('span', {}, 'Úhlopříčka (palce)'), diag), h('label', { class: 'f' }, h('span', {}, 'Vzdálenost čtení (m)'), dist),
          h('button', { class: 'btn nogrow', title: 'Převezme rozlišení obrazovky, na které je aplikace právě otevřená', onclick: () => applyRes(...screenPx()) }, '⌖ Z této obrazovky')),
        h('div', { class: 'row', style: { marginTop: '10px', alignItems: 'center' } }, h('span', { class: 'nogrow help' }, 'Orientace:'), orientBtns.p, orientBtns.l),
        presetBox,
        h('p', {}, rec),
        h('h3', {}, 'Písmo'),
        h('div', { class: 'row', style: { maxWidth: '360px' } }, h('label', { class: 'f' }, h('span', {}, 'Velikost písma oproti šabloně (%)'), fontIn)));
      paintRec(); paintOrient();
    };
    paintScreens();
    return h('div', { class: 'set-sec' },
      h('p', { class: 'help' }, 'Každá obrazovka (hlavní prompter, tablet, mobil…) má svůj rozměr, konce stránek a obsah. Nastavení se sdílí s celou kapelou; každé zařízení si v „Toto zařízení“ vybere, kterou obrazovkou je.'),
      scrTabs, scrBox);
  },

  /* ---------- Čtečka a ovládání ---------- */
  reader() {
    const S = Settings.data;
    const tplSel = h('select', { class: 'inp set-sel' }, [...Store.templates.values()].map(t => h('option', { value: t.id, selected: t.id === S.defaultTemplate }, t.name)));
    tplSel.onchange = () => Settings.set('defaultTemplate', tplSel.value);
    return h('div', { class: 'set-sec' },
      h('div', { class: 'set-rows' },
        setFlag('readerFullscreen', 'Přes celou obrazovku', 'Čtečka se otevře bez lišt prohlížeče či okna.'),
        setFlag('startInReader', 'Po spuštění rovnou čtečka', 'Otevře se poslední playlist – pro PC u monitoru.'),
        window.native ? setRow('Spustit po zapnutí počítače', 'Program se spustí sám s Windows.', setSwitch(window.native.getAutoStart(), v => window.native.setAutoStart(v))) : null,
        setFlag('readerSyncOnStart', 'Při otevření čtečky stáhnout změny', 'Když je internet.'),
        setFlag('readerHud', 'Stavový řádek dole', 'Pořadí písně, stránky a co bude dál. Když šablona ukazuje zápatí, schová se.'),
        setFlag('hideCursor', 'Skrývat kurzor myši', ''),
        setFlag('swapMouse', 'Prohodit tlačítka myši', 'Normálně: pravé = další, levé = zpět.'),
        setFlag('wheelNav', 'Listovat kolečkem myši', ''),
        setRow('Výchozí šablona', 'Vzhled písní, které nemají vlastní šablonu.', tplSel)),
      ...READER_HELP.flatMap(([g, rows]) => [h('h3', {}, g),
        h('div', { class: 'set-rows set-keys' }, rows.map(([k, v]) => h('div', { class: 'set-row' }, h('div', {}, h('b', {}, v)), h('kbd', {}, k))))]));
  },

  /* ---------- Záloha a import ---------- */
  backup() {
    return h('div', { class: 'set-sec' },
      h('div', { class: 'set-rows' },
        setRow('Stáhnout zálohu', 'Jeden soubor .json se všemi písněmi, playlisty, šablonami a zpěváky.', h('button', { class: 'btn nogrow', onclick: () => exportBackup() }, '⇩ Stáhnout')),
        setRow('Obnovit ze zálohy', 'Slučovací – nic nesmaže, jen doplní a přepíše stejné položky. Při přihlášení ke kapele se pak odešlou do kapely.', h('button', { class: 'btn nogrow', onclick: () => pickFile('.json').then(f => f && importBackup(f)) }, '⇪ Vybrat soubor')),
        setRow('Import', IMPORT_HELP + '. Každý .txt = jedna píseň, setlist = nový playlist. Jde i přetáhnout soubory do okna.', h('button', { class: 'btn nogrow', onclick: () => importFiles() }, '⇪ Vybrat soubory')),
        (Store.meta.trash || []).length ? setRow('Smazáno synchronizací', `${Store.meta.trash.length} položek smazal jiný člen nebo zmizely z úložiště kapely (naposledy ${new Date(Store.meta.trash[0].at).toLocaleString('cs-CZ')}).`,
          h('button', { class: 'btn nogrow', onclick: () => restoreSyncTrash() }, '↶ Vrátit')) : null,
        window.native ? setRow('Složka s daty', window.native.dataDir, h('button', { class: 'btn nogrow', onclick: () => window.native.openDataDir() }, 'Otevřít')) : null));
  },

  /* ---------- O aplikaci ---------- */
  about() {
    return h('div', { class: 'set-sec' },
      h('div', { class: 'set-rows' },
        setRow('Verze', null, h('b', {}, APP_VERSION)),
        setRow('Druh', null, h('span', {}, window.native ? 'program pro Windows' : (matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'nainstalovaná aplikace' : 'webová verze'))),
        window.native ? setRow('Grafika', gpuSoft() ? 'Bez grafické karty je vykreslování pomalejší – čtečka proto vypne animace. Pomůže aktualizace ovladače grafiky.' : null,
          h('span', {}, gpuSoft() ? 'softwarové vykreslování' : 'grafická karta (plynulé)')) : null,
        setRow('Adresa aplikace', 'Stejná aplikace pro telefon, tablet i počítač.', h('a', { href: appUrl(), target: '_blank' }, appUrl().replace(/^https:\/\//, '')))));
  },
};

/* Co aplikace v účtu Mega vidí (bez hesla a textů písní) */
async function megaDiagDialog(cfg) {
  toast('Načítám obsah Mega…', 'info', 2000);
  const m = cfg || MegaProvider.cfg();
  let text;
  try { text = `PROMPTER mini ${APP_VERSION}\nsložka: ${m.folder}\nchyba: ${Sync.lastError || '–'}\n` + await MegaProvider.api().diag(m); }
  catch (e) { text = 'Diagnostika selhala: ' + ipcError(e); }
  const ta = h('textarea', { class: 'inp', rows: 16, readonly: true, style: { fontFamily: 'Consolas, monospace', fontSize: '12px' } }, text);
  const v = await modal({ title: 'Diagnostika Mega', wide: true, body: h('div', {}, h('p', { class: 'help' }, 'Výpis neobsahuje heslo ani texty písní. Zkopíruj ho a pošli.'), ta),
    buttons: [{ label: 'Zavřít', value: null }, { label: '📋 Kopírovat', primary: true, value: true }] });
  if (v) { try { await navigator.clipboard.writeText(text); toast('Výpis zkopírován', 'ok'); } catch (e) { ta.select(); } }
}

function pickFile(accept) {
  return new Promise(res => { const i = h('input', { type: 'file', accept }); i.onchange = () => res(i.files[0]); i.click(); });
}

/* „Zůstat přihlášen“: heslo kapely trvale v tomto prohlížeči, nebo jen do jeho zavření */
function setRememberBand(on) {
  const m = Settings.get('mega');
  Settings.set('rememberBand', on);
  if (on) { Settings.set('mega', m); sessionStorage.removeItem('prompter-secret-mega'); }
  else { sessionStorage.setItem('prompter-secret-mega', JSON.stringify({ pass: m.pass })); Settings.set('mega', Object.assign({}, m, { pass: '' })); }
  toast(on ? 'Toto zařízení zůstane přihlášené.' : 'Po zavření prohlížeče bude potřeba přihlásit se znovu.', 'ok');
}

/* Soubor PROMPTER s písněmi / playlistem: stejný tvar jako záloha (jde otevřít Importem nebo přetažením do okna),
   s formátováním, nastavením písní a jejich šablonami */
function packItems(kind, songs, playlists = []) {
  const tids = new Set(songs.map(s => s.templateId).filter(Boolean));
  return { app: 'prompter', version: 1, kind, exportedAt: new Date().toISOString(), songs, playlists, templates: [...tids].map(id => Store.templates.get(id)).filter(Boolean) };
}

function exportBackup() {
  const data = {
    app: 'prompter', version: 1, exportedAt: new Date().toISOString(),
    ...Object.fromEntries(Object.keys(TYPES).map(t => [t, [...Store[t].values()]])),
  };
  downloadFile(`zaloha-pisne-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 1));
}

async function importBackup(file) {
  let data;
  try { data = JSON.parse(await readFileText(file)); } catch (e) { return toast('Soubor není platná záloha.', 'err'); }
  if (!data || data.app !== 'prompter') return toast('Soubor není záloha této aplikace.', 'err');
  // novější verze v zařízení (a tím i v kapele) má přednost – záloha doplní jen chybějící a starší
  let n = 0, kept = 0;
  for (const type of Object.keys(TYPES)) {
    for (const o of data[type] || []) {
      if (!o || !o.id) continue;
      const cur = Store[type].get(o.id);
      if (cur && (cur.updatedAt || '') >= (o.updatedAt || '')) { kept++; continue; }
      await Store.put(type, o, { silent: true, noStamp: true }); n++;
    }
  }
  Store.emit('sync', null);
  const first = data.kind === 'song' ? data.songs && data.songs[0] : data.kind === 'playlist' ? data.playlists && data.playlists[0] : null;
  if (first) {
    toast((data.kind === 'song' ? `Píseň „${first.title}“ otevřena` : `Playlist „${first.name}“ otevřen`) + (kept ? ' (v zařízení už byla stejná nebo novější verze)' : ''), 'ok', 5000);
    location.hash = (data.kind === 'song' ? '#/songs/' : '#/playlists/') + first.id;
    return;
  }
  toast(`Obnoveno ${n} položek` + (kept ? ` · ${kept} ponecháno (v zařízení je stejná nebo novější verze)` : ''), 'ok', 6000);
}

/* Vrátit, co smazala synchronizace (smazal to jiný člen nebo zmizelo z úložiště) */
async function restoreSyncTrash() {
  const items = Store.meta.trash || [];
  if (!items.length) return;
  if (!await confirmDlg(`Vrátit ${items.length} položek, které smazala synchronizace? Znovu se nahrají i do kapely.`, 'Vrátit')) return;
  for (const { type, obj } of items) if (TYPES[type] && !Store[type].has(obj.id)) await Store.put(type, obj, { silent: true });
  Store.meta.trash = [];
  await Store.saveMeta();
  Store.emit('sync', null);
  toast('Vráceno – odešle se při další synchronizaci.', 'ok');
  App.go(true);
}
