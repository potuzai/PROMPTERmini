'use strict';
/* ===== Písně: seznam + editor ===== */
// Zpěváci, kteří v písni zpívají (podle značek @kód a {kód:…} v textu)
function songSingers(s) {
  const sm = Store.singerMap(s), codes = new Set();
  for (const m of String(s.text || '').matchAll(/(?:^|\n)\s*(?:##[^\n@]*)?@([A-Za-z0-9+]+)|\{(?!aa:)([A-Za-z0-9+]+):/g)) parseCodes(m[1] || m[2]).forEach(c => codes.add(c));
  return [...codes].filter(c => sm[c]).map(c => sm[c]);
}
// volby stránky, které jde u písně nastavit jinak než v šabloně (Stránka písně v pravém panelu)
const PAGE_KEYS = ['padX', 'padY', 'columns', 'colGap', 'onePage', 'fit', 'minScale', 'showHeader', 'showFooter', 'headerSize', 'showNotes', 'mirror'];
// volby sekcí písně (Struktura v levém panelu)
const SECTION_KEYS = ['showSections', 'sectionScale', 'sectionColor', 'stanzaGap', 'verseColor', 'chorusColor', 'bridgeColor', 'instrColor'];
const SongsView = {
  search: '',
  editor: null,

  /* Bez otevřené písně: 2/3 seznam (hledání, řazení), 1/3 náhled vybrané písně.
     Klik = náhled, dvojklik / Upravit = editor. S otevřenou písní: jen editor (zpět přes ◀ Písně). */
  render(main, songId) {
    const song = songId && Store.songs.get(songId);
    const side = h('div', { class: 'side big-list song-list' });
    const content = h('div', { class: 'content', style: { padding: 0 } });
    main.append(h('div', { class: 'view' + (song ? ' has-detail song-open' : ' list-only') }, side, content));

    const searchInp = h('input', { class: 'inp', type: 'search', placeholder: 'Hledat interpreta, název, text, štítek…', value: this.search });
    const sortSel = h('select', { class: 'inp sl-sort', title: 'Řazení' },
      [['artist', 'Řadit: interpret, název'], ['title', 'Řadit: název'], ['recent', 'Řadit: naposledy upravené']]
        .map(([v, l]) => h('option', { value: v, selected: (Settings.get('songSort') || 'artist') === v }, l)));
    const list = h('div', { class: 'list' });
    const count = h('div', { class: 'sl-count' });
    const total = h('span', {});
    const prev = h('div', { class: 'pl-prev song-prev' });
    side.append(h('div', { class: 'pl-split' },
      h('div', { class: 'pl-main' },
        h('div', { class: 'sl-titlebar' }, h('h1', {}, 'Písně'), total),
        h('div', { class: 'side-head sl-head' },
          h('button', { class: 'btn primary', onclick: () => this.create() }, '＋ Nová píseň'),
          searchInp,
          h('button', { class: 'btn sl-push', title: 'Importovat písně z .txt souborů', onclick: () => importTxtFiles() }, '⇪ Import'),
          sortSel),
        h('div', { class: 'sl-row sl-cols' }, h('span', {}, 'Interpret'), h('span', {}, 'Název'), h('span', {}, 'Ladění · BPM'), h('span', {}, 'Zpívá')),
        list, count),
      prev));
    const paintPrev = s => {
      prev.innerHTML = '';
      if (!s) { prev.appendChild(h('div', { class: 'help pl-prev-empty' }, 'Klikni na píseň a tady uvidíš její náhled.')); return; }
      const pls = [...Store.playlists.values()].filter(p => p.items.includes(s.id));
      const box = h('div', { class: 'mini-page' });
      const wrap = h('div', { class: 'mini-wrap' }, box);   // stránka co největší ve volném místě, v poměru stran displeje
      prev.append(
        h('div', { class: 'pl-prev-head' },
          h('h3', {}, s.title || '(bez názvu)'),
          h('div', { class: 'pl-prev-meta' }, [s.artist, s.key, s.tempo ? s.tempo + ' BPM' : ''].filter(Boolean).join(' · ') || ' ')),
        h('div', { class: 'pl-prev-btns two' },
          h('button', { class: 'btn primary', onclick: () => { location.hash = '#/songs/' + s.id; } }, '✎ Upravit'),
          h('button', { class: 'btn play', onclick: () => { location.hash = '#/reader/song:' + s.id; } }, '▶ Čtečka')),
        wrap,
        h('div', { class: 'ep-lbl' }, 'V playlistech'),
        pls.length ? h('div', { class: 'chips' }, pls.map(p => h('button', { class: 'chip', onclick: () => { location.hash = '#/playlists/' + p.id; } }, `${p.name} · ${p.items.indexOf(s.id) + 1}.`)))
          : h('div', { class: 'help' }, 'Zatím v žádném playlistu.'));
      miniPage(box, s);
      const scr = Screens.edit(), ratio = scr.w / scr.h;
      const size = () => { const r = wrap.getBoundingClientRect(); if (r.width && r.height) box.style.width = Math.floor(Math.min(r.width, r.height * ratio)) + 'px'; };
      new ResizeObserver(size).observe(wrap);
    };
    const select = id => {
      this.selected = id;
      $$('.item', list).forEach(el => el.classList.toggle('active', el.dataset.id === id));
      paintPrev(Store.songs.get(id));
    };
    const paintList = () => {
      const q = normalizeForSearch(this.search);
      list.innerHTML = '';
      const songs = Store.sortedSongs(sortSel.value).filter(s => !q || normalizeForSearch([s.title, s.artist, s.text].join(' ')).includes(q));
      for (const s of songs) {
        list.appendChild(h('div', { class: 'item sl-row', 'data-id': s.id, title: 'Klik = náhled, dvojklik = upravit',
          onclick: () => isMobile() ? (location.hash = '#/songs/' + s.id) : select(s.id),
          ondblclick: () => { location.hash = '#/songs/' + s.id; } },
          h('span', { class: 'sl-artist' }, s.artist || '—'),
          h('b', { class: 'sl-title' }, s.title || '(bez názvu)'),
          h('span', { class: 'sl-key' }, s.key ? keyBadge(s.key) : null, s.key && s.tempo ? ' · ' : '', s.tempo ? s.tempo + ' BPM' : ''),
          h('span', { class: 'sl-dots' }, songSingers(s).map(g => h('i', { title: g.name, style: { background: g.color } })))));
      }
      if (!songs.length) list.appendChild(h('div', { class: 'help', style: { padding: '16px 22px' } }, q ? 'Nic nenalezeno.' : 'Zatím žádné písně. Vytvoř novou nebo importuj .txt soubory.'));
      count.textContent = q ? `${songs.length} z ${Store.songs.size} písní` : 'Klik = náhled · dvojklik = upravit · Enter = upravit';
      total.textContent = plural(Store.songs.size, 'píseň', 'písně', 'písní');
      if (!song) { const keep = songs.find(x => x.id === this.selected) || songs[0]; select(keep ? keep.id : null); }
    };
    // šipky v seznamu (airmouse): ↑↓ vybírá, Enter otevře editor
    list.tabIndex = 0;
    list.addEventListener('keydown', e => {
      const rows = $$('.item', list); const i = rows.findIndex(r => r.classList.contains('active'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
        if (n) { select(n.dataset.id); n.scrollIntoView({ block: 'nearest' }); }
      } else if (e.key === 'Enter' && this.selected) location.hash = '#/songs/' + this.selected;
    });
    searchInp.addEventListener('input', () => { this.search = searchInp.value; paintList(); });
    searchInp.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); list.focus(); } });
    sortSel.addEventListener('change', () => { Settings.set('songSort', sortSel.value); paintList(); });
    this.paintList = paintList;
    paintList();

    if (song) this.editor = new SongEditor(content, song);
    else {
      this.editor = null;
      setTimeout(() => { if (!this.search) return; searchInp.focus(); }, 0);
    }
  },

  async create() {
    const title = await promptDlg('Název nové písně', '', 'např. Holubí dům');
    if (title === null) return;
    const song = await Store.put('songs', newSong({ title: title || 'Nová píseň' }));
    location.hash = '#/songs/' + song.id;
    setTimeout(() => { const w = $('.se-wrap'); if (w) w.focus(); toast('Vlož text písně (Ctrl+V) – automaticky se vyčistí.'); }, 100);
  },
};

class SongEditor {
  constructor(root, song) {
    this.root = root;
    this.id = song.id;
    this.dirty = false;
    this.src = song.text || '';
    this.style = song.style || null;
    // náhled pro obrazovku: naposledy zvolená v tomto zařízení, jinak vlastní obrazovka zařízení
    this.screenId = Screens.edit().id;
    this.build(song);
    this.base = this.snap();
    const ed = this;
    App.edit = { get what() { return `Píseň „${ed.inTitle.value.trim() || 'bez názvu'}“`; },
      dirty: () => ed.dirty, save: m => ed.save(m), saveAs: stay => ed.saveAs(stay) };
  }

  /* Rozložení: vlevo jeden panel (údaje o písni, struktura, moje poznámky), uprostřed stránka čtečky
     (upravuje se přímo v ní) a nad ní jedna lišta pro vybraný řádek. Každá funkce je jen na jednom místě. */
  build(song) {
    // tlačítka nástrojů si neberou fokus: označený text v psaném řádku zůstane označený i po úpravě
    const tool = (label, title, onclick, cls = '') => h('button', { class: 'tl ' + cls, title, onclick, onmousedown: e => e.preventDefault() }, label);
    const f = (label, el, cls = '') => h('label', { class: 'f ' + cls }, h('span', {}, label), el);

    this.inTitle = h('input', { class: 'inp ep-title', value: song.title || '', placeholder: 'Název písně', title: 'Název písně' });
    this.inArtist = h('input', { class: 'inp', value: song.artist || '', placeholder: 'Interpret', title: 'Interpret' });
    this.inKey = h('input', { class: 'inp', value: song.key || '', placeholder: 'C, Am…' });
    this.inTempo = h('input', { class: 'inp', value: song.tempo || '', placeholder: '120' });
    this.inDur = h('input', { class: 'inp', value: song.duration || '', placeholder: '3:45' });
    this.inTpl = h('select', { class: 'inp' }, h('option', { value: '' }, '— výchozí —'),
      [...Store.templates.values()].map(t => h('option', { value: t.id, selected: t.id === song.templateId }, t.name)));
    // jak by píseň vypadala v playlistu (pořadí x/y, další píseň)
    const pls = [...Store.playlists.values()].filter(p => p.items.includes(this.id)).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    this.inPl = h('select', { class: 'inp', title: 'Podle playlistu se na stránce ukáže pořadí (např. 2/12) a další píseň – přesně jako ve čtečce' },
      h('option', { value: '' }, '— samostatně —'), pls.map(p => h('option', { value: p.id }, p.name + (p.date ? ' · ' + p.date : ''))));
    if (pls.length) this.inPl.value = (pls.find(p => p.id === Settings.get('lastPlaylist')) || pls[0]).id;

    this.savedInd = h('span', { class: 'saved-ind' }, 'Uloženo');
    this.pageLbl = h('span', { class: 'page-lbl' }, '1/1');

    // zpěváci jako přepínače: klik přidá / odebere; všichni vypnutí = nikdo

    // Uložení, další volby písně a čtečka: vpravo dole pod stránkou
    this.saveBtn = h('button', { class: 'btn', title: 'Uložit změny (Ctrl+S)', onclick: () => this.save(true) }, '💾 Uložit');
    const moreBtn = h('button', { class: 'btn', title: 'Další volby písně: uložit jako, playlist, písmo, vyčištění textu, export, smazání', onclick: e => popupMenu(e.currentTarget, [
      { label: 'Uložit jako…', action: () => this.saveAs() },
      { label: 'Přidat do playlistu…', action: () => addToPlaylistMenu(moreBtn, [this.id]) },
      { sep: true },
      { label: 'Písmo této písně…', action: () => this.fontPopover(moreBtn) },
      { label: 'Vyčistit text…', action: () => this.cleanDialog() },
      { label: 'Zdrojový text…', action: () => this.sourceDialog() },
      { label: 'Export .txt', action: () => this.exportTxt() },
      { label: 'Nápověda k editoru', action: () => showMarkupHelp() },
      { sep: true },
      { label: 'Smazat píseň', danger: true, action: () => this.del() }]) }, '⋯');
    const readerBtn = h('button', { class: 'btn play', title: 'Otevřít ve čtečce přes celou obrazovku', onclick: () => this.openReader() }, '▶ Čtečka');

    // Levý panel: údaje o písni, struktura, moje poznámky
    this.structBox = h('div', { class: 'ep-struct' });
    this.leftPanel = h('div', { class: 'ed-panel ed-left-panel' },
      this.backBtn(),
      h('div', { class: 'ep-group ep-meta' },
        this.inArtist, this.inTitle,   // popis jen uvnitř prázdného pole – šetří místo
        h('div', { class: 'ep-row3' }, f('Ladění', this.inKey), f('BPM', this.inTempo), f('Délka', this.inDur)),
        h('div', { class: 'f' }, h('span', {}, 'Šablona'), h('div', { class: 'tpl-row' }, this.inTpl,
          h('button', { class: 'btn small icon nogrow', title: 'Uložit nastavení písně do šablony (písmo, velikost, barvy, zpěváci, stránka…)', onclick: e => {
            const cur = this.baseTpl();
            popupMenu(e.currentTarget, [
              { label: `Uložit do šablony „${cur.name}“`, hint: 'všem písním s ní', action: () => this.saveToTemplate() },
              { label: 'Uložit jako novou šablonu…', action: () => this.saveAsTemplate() }]);
          } }, ic('save'))))),
      h('div', { class: 'ep-group' }, h('div', { class: 'ep-lbl ep-lbl-row' }, h('span', {}, 'Struktura'),
        h('button', { class: 'btn small nogrow', title: 'Nová sekce u vybraného řádku – označené řádky (tažením myší) budou celá sekce', onclick: () => this.addSection() }, '＋ Sekce'),
        h('button', { class: 'btn small nogrow', title: 'Zopakovat sekci (např. refrén) u vybraného řádku – ve čtečce se vypíše celá', onclick: e => this.insertRepeat(e.currentTarget) }, '↻'),
        h('button', { class: 'btn small icon nogrow', title: 'Sekce této písně: nadpisy, mezera mezi slokami, barvy sloky / refrénu / mezičásti', onclick: e => this.sectionPopover(e.currentTarget) }, ic('sliders'))),
        this.structBox),
      h('div', { class: 'ep-group' }, h('div', { class: 'ep-lbl' }, 'Moje poznámky'),
        this.privNote = h('textarea', { class: 'inp ep-priv', rows: 2, placeholder: 'Vidíš jen ty na tomto zařízení. Ukážou se nahoře na stránce.' }, PrivateNotes.get(song.id))));

    // Lišta nad stránkou: vše pro vybraný řádek
    const sep = () => h('span', { class: 'tl-sep' });
    // lišta nad stránkou: úpravy textu
    this.tools = h('div', { class: 'ed-tools' }, h('div', { class: 'ed-tools-text' },
      this.fontSel = h('select', { class: 'tl tl-font', title: 'Písmo označených slov, řádku, nebo bez výběru celé písně', onmousedown: () => this.keepSel(), onchange: () => this.setFont(this.fontSel.value) }),
      h('div', { class: 'tl-grp seg-row' },
        tool(h('b', {}, 'B'), 'Tučně (Ctrl+B) – označená slova, řádek, nebo bez výběru celá píseň', () => this.fmt('bold')),
        tool(h('i', {}, 'I'), 'Kurzíva (Ctrl+I) – označená slova, řádek, nebo bez výběru celá píseň', () => this.fmt('italic')),
        tool('Aa', 'VELKÁ / malá písmena – klik přepne označená slova, řádek, nebo bez výběru celou píseň', () => this.toggleCase()),
        this.colorBtn = tool(h('span', { class: 'tl-col' }, 'A'), 'Barva písma označených slov, řádku, nebo bez výběru celé písně', e => this.colorPopover(e.currentTarget), 'tl-color'),
      ),
      h('div', { class: 'tl-grp seg-row tl-lh-grp' },
        tool('−', 'Menší písmo (o 2 px)', () => this.stepSize(-2), 'tl-step'),
        this.sizeBox = h('label', { class: 'tl tl-size', title: 'Velikost písma označených slov nebo řádku v px na zvolené obrazovce – napiš a potvrď Enterem' },
          this.sizeInp = h('input', { type: 'text', inputmode: 'numeric', maxlength: 3, value: '' }), 'px'),
        tool('+', 'Větší písmo (o 2 px)', () => this.stepSize(2), 'tl-step')),
      h('div', { class: 'tl-grp seg-row tl-lh-grp' },
        tool('−', 'Menší rozestup písmen', () => this.stepLs(-1), 'tl-step'),
        this.lsBox = h('label', { class: 'tl tl-size tl-lh', title: 'Rozestup písmen označených slov, řádku, nebo bez výběru celé písně – v % výšky písma (může být i záporný); napiš a potvrď Enterem' },
          ic('lsp', 'tl-lh-ic'), this.lsInp = h('input', { type: 'text', inputmode: 'numeric', maxlength: 3, value: '' })),
        tool('+', 'Větší rozestup písmen', () => this.stepLs(1), 'tl-step')),
      h('div', { class: 'tl-grp seg-row tl-lh-grp' },
        tool('−', 'Menší řádkování (o 0,1)', () => this.stepLh(-0.1), 'tl-step'),
        this.lhBox = h('label', { class: 'tl tl-size tl-lh', title: 'Řádkování řádku s kurzorem (nebo označených řádků) – výška řádku × písmo; napiš a potvrď Enterem, prázdné = podle písně' },
          ic('lineh', 'tl-lh-ic'), this.lhInp = h('input', { type: 'text', inputmode: 'decimal', maxlength: 4, value: '' })),
        tool('+', 'Větší řádkování (o 0,1)', () => this.stepLh(0.1), 'tl-step')),
      h('div', { class: 'tl-grp seg-row tl-lh-grp' },
        tool('−', 'Menší mezera pod řádkem (o 0,1)', () => this.stepSp(-0.1), 'tl-step'),
        this.spBox = h('label', { class: 'tl tl-size tl-lh', title: 'Mezera pod řádkem s kurzorem (nebo pod označenými řádky) – × výška písma; napiš a potvrď Enterem, 0 = bez mezery' },
          ic('spb', 'tl-lh-ic'), this.spInp = h('input', { type: 'text', inputmode: 'decimal', maxlength: 4, value: '' })),
        tool('+', 'Větší mezera pod řádkem (o 0,1)', () => this.stepSp(0.1), 'tl-step')),
      this.alBtns = h('div', { class: 'tl-grp seg-row tl-al-grp' },
        tool(ic('alignl'), 'Zarovnat řádek vlevo', () => this.setAl('⇤')),
        tool(ic('alignc'), 'Zarovnat řádek na střed', () => this.setAl('↔')),
        tool(ic('alignr'), 'Zarovnat řádek vpravo', () => this.setAl('⇥'))),
      ),
      h('div', { class: 'tl-grp ed-undo' },   // zpět / znovu úplně vpravo
        tool('↶', 'Zpět (Ctrl+Z)', () => this.se.undo(-1)),
        tool('↷', 'Znovu (Ctrl+Y)', () => this.se.undo(1))));
    // zpěváci: nahoře v pravém panelu
    this.sgRow = h('div', { class: 'sw-row', title: 'Kdo zpívá vybraný řádek (všichni vypnutí = nikdo)' });
    const sgShowBtn = tool(ic('sliders'), 'Zpěváci a jejich označení jen pro tuto píseň: barva, přidání, odebrání, proužek vlevo / vpravo, podklad, barva písma', e => this.singerPopover(e.currentTarget), 'tl-sgshow');
    this.makeSingerBtns();

    this.stageWrap = h('div', { class: 'se-wrap' });
    this.scrSel = h('select', { class: 'inp ed-screen', title: 'Pro kterou obrazovku kapely ukázat stránku – každá má svůj rozměr, konce stránek a obsah' },
      Screens.list().map(sc => h('option', { value: sc.id, selected: sc.id === this.screenId }, Screens.label(sc) + (sc.id === Screens.myId() ? ' (toto zařízení)' : ''))));
    this.scrSel.onchange = () => {
      this.screenId = this.scrSel.value; Settings.set('editScreen', this.screenId);
      this.structKey = null; this.se.followCur = true; this.se.render(); this.stageWrap.focus({ preventScroll: true });
    };
    // stránkování vpravo dole nad stránkou (jen když má píseň víc stránek)
    this.pageNav = h('div', { class: 'ed-pages' },
      h('button', { class: 'tl', title: 'Předchozí stránka (PgUp)', onclick: () => this.se.turnPage(-1) }, ic('up')),
      this.pageLbl,
      h('button', { class: 'tl', title: 'Další stránka (PgDn)', onclick: () => this.se.turnPage(1) }, ic('down')));
    // Pravý panel pod lištou: zpěváci, náhled (obrazovka, playlist), dole uložení a čtečka
    const sgrp = (label, ...kids) => h('div', { class: 'ep-group' }, h('div', { class: 'ep-lbl' }, label), ...kids);
    this.pager = h('div', { class: 'ed-side' },
      h('div', { class: 'ep-group' }, h('div', { class: 'ep-lbl ep-lbl-row' }, h('span', {}, 'Zpěváci'), sgShowBtn), this.sgRow),
      h('div', { class: 'ep-group' }, h('div', { class: 'ep-lbl ep-lbl-row' }, h('span', {}, 'Stránka písně'),
        this.pageSetBtn = tool(ic('sliders'), 'Rozvržení a zobrazení stránky jen pro tuto píseň: okraje, sloupce, mezery, dlouhá píseň, záhlaví a zápatí, nadpisy sekcí, poznámky, zrcadlení, proužek zpěváka', e => this.pagePopover(e.currentTarget), 'tl-sgshow'))),
      h('div', { class: 'grow' }),
      h('div', { class: 'ep-group' }, h('div', { class: 'ep-lbl ep-lbl-row' }, h('span', {}, 'Náhled'),
        tool(ic('sliders'), 'Náhled stránky: pro kterou obrazovku a jako v kterém playlistu', e => this.previewPopover(e.currentTarget), 'tl-sgshow')),
        this.pvInfo = h('div', { class: 'ep-info' })),
      h('div', { class: 'ed-save' }, this.savedInd, h('div', { class: 'ed-save-row' }, this.saveBtn, moreBtn), readerBtn));
    const ed = h('div', { class: 'song-editor' },
      h('div', { class: 'ed-body' }, this.leftPanel,
        h('div', { class: 'ed-center' }, this.tools, h('div', { class: 'ed-main' }, h('div', { class: 'ed-stagebox' }, this.stageWrap, this.pageNav), this.pager))));
    this.root.innerHTML = '';
    this.root.appendChild(ed);

    const onMeta = () => { this.markDirty(); this.schedulePreview(); };
    this.privNote.addEventListener('input', () => { PrivateNotes.set(this.id, this.privNote.value); this.schedulePreview(); });
    [this.inTitle, this.inArtist, this.inKey, this.inTempo, this.inDur].forEach(i => { i.addEventListener('input', onMeta); i.addEventListener('change', () => this.se.pushHist()); });
    this.inTpl.addEventListener('change', () => { this.se.pushHist(); this.makeSingerBtns(); });
    this.inTpl.addEventListener('change', onMeta);
    this.inTpl.addEventListener('change', () => this.paintFont());
    this.paintFont();
    this.inPl.addEventListener('change', () => { this.se.render(); this.paintPvInfo(); });
    this.scrSel.addEventListener('change', () => this.paintPvInfo());
    this.paintPvInfo();
    this.inTitle.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); this.stageWrap.focus(); } });
    // tlačítka panelu a lišty nesmí vzít stránce výběr ani kurzor
    const keep = e => { if (e.target.closest('button') && this.stageWrap.contains(document.activeElement)) e.preventDefault(); };
    for (const el of [this.tools, this.leftPanel, this.pager]) el.addEventListener('mousedown', keep);

    // velikost písma: pole si pamatuje označení v psaném řádku (klik do pole ho jinak zruší)
    let keepRange = null;
    this.sizeInp.addEventListener('focus', () => {
      const sel = window.getSelection();
      keepRange = this.se.editEl && sel.rangeCount && this.se.editEl.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
      this.sizeInp.select();
    });
    const applySize = () => {
      const v = parseInt(this.sizeInp.value, 10);
      if (!v) { this.paintSize(); return; }
      if (keepRange && this.se.editEl) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(keepRange); }
      this.setSizePx(v);
      keepRange = null;
      this.paintSize();
    };
    this.sizeInp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); applySize(); (this.se.editEl || this.stageWrap).focus({ preventScroll: true }); }
      else if (e.key === 'Escape') { e.preventDefault(); keepRange = null; this.paintSize(); this.stageWrap.focus({ preventScroll: true }); }
      e.stopPropagation();
    });
    let lsRange = null;
    this.lsInp.addEventListener('focus', () => {
      const sel = window.getSelection();
      lsRange = this.se.editEl && sel.rangeCount && this.se.editEl.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
      this.lsInp.select();
    });
    this.lsInp.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); this.paintLs(); this.stageWrap.focus({ preventScroll: true }); return; }
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (lsRange && this.se.editEl) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(lsRange); }
      this.setLs(parseInt(this.lsInp.value, 10) || 0);
      (this.se.editEl || this.stageWrap).focus({ preventScroll: true });
    });
    this.spInp.addEventListener('focus', () => this.spInp.select());
    this.spInp.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); this.paintSp(); this.stageWrap.focus({ preventScroll: true }); return; }
      if (e.key !== 'Enter') return;
      e.preventDefault();
      this.setSp(parseFloat(this.spInp.value.replace(',', '.')));
      (this.se.editEl || this.stageWrap).focus({ preventScroll: true });
    });
    this.lhInp.addEventListener('focus', () => this.lhInp.select());
    this.lhInp.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); this.paintLh(); this.stageWrap.focus({ preventScroll: true }); return; }
      if (e.key !== 'Enter') return;
      e.preventDefault();
      this.setLh(parseFloat(this.lhInp.value.replace(',', '.')));
      (this.se.editEl || this.stageWrap).focus({ preventScroll: true });
    });
    this.onDocSel = () => { if (this.se && this.se.editEl && document.activeElement !== this.sizeInp) { this.paintSize(); this.paintSingers(); } };
    document.addEventListener('selectionchange', this.onDocSel);

    this.se = new StageEditor(this.stageWrap, this);
    this.ro = new ResizeObserver(() => this.se.fit());
    this.ro.observe(this.stageWrap);
    this.se.render();
    if (this.se.targets.length) this.se.select(0);
    setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) this.stageWrap.focus({ preventScroll: true }); }, 0);
  }

  /* Zpět tam, odkud se do editoru přišlo: z playlistů zpět na playlisty (s původním výběrem), jinak na seznam písní */
  backBtn() {
    const from = App.prev;
    const view = from == null ? 'songs' : from.replace(/^#\/?/, '').split('/')[0] || 'playlists';
    if (view === 'playlists') return h('button', { class: 'ep-back', title: 'Zpět na playlisty', onclick: () => { if (from) location.hash = from; else App.home(); } }, '◀ Playlisty');
    return h('button', { class: 'ep-back', title: 'Zpět na seznam písní', onclick: () => { location.hash = '#/songs'; } }, '◀ Písně');
  }

  /* Uložit jako novou píseň (jiný název); původní píseň zůstane, jak byla naposledy uložená.
     stay = volá se při odchodu ze stránky – pak se na novou píseň nepřechází. */
  async saveAs(stay) {
    this.se.finishEdit(true);
    const title = await promptDlg('Uložit jako novou píseň – název', this.inTitle.value.trim() + ' (2)');
    if (!title) return false;
    const s = clone(this.collect());
    s.id = uid(); s.title = title;
    delete s.sample;
    await Store.put('songs', s);
    this.dirty = false;
    toast('Uloženo jako „' + title + '“', 'ok');
    if (!stay) location.hash = '#/songs/' + s.id;
    return true;
  }


  /* ----- Šablona a údaje pro stránku ----- */
  /* náhled: výběr obrazovky a playlistu schovaný pod tlačítkem, pod nadpisem jen stručně aktuální výběr */
  previewPopover(anchor) {
    $$('.menu').forEach(m => m.remove());
    placePopover(h('div', { class: 'menu menu-form' }, h('div', { class: 'menu-head' }, 'Náhled stránky'),
      h('label', { class: 'f' }, h('span', {}, 'Obrazovka'), this.scrSel),
      h('label', { class: 'f' }, h('span', {}, 'Jako v playlistu'), this.inPl)), anchor);
  }
  paintPvInfo() {
    const sc = Screens.list().find(s => s.id === this.scrSel.value), pl = this.playlist();
    this.pvInfo.replaceChildren(h('div', {}, sc ? Screens.label(sc) : ''), h('div', {}, pl ? 'Playlist: ' + pl.name : 'Samostatně, bez playlistu'));
  }
  playlist() { return this.inPl && this.inPl.value ? Store.playlists.get(this.inPl.value) : null; }
  lookTpl(song) {
    const id = this.inTpl.value || Settings.get('defaultTemplate');
    return applySongStyle(Store.template(id), song || this.collect());
  }
  pageInfo(song) {
    const pl = this.playlist();
    const info = { title: song.title, artist: song.artist, key: song.key, tempo: song.tempo, pos: '', next: '' };
    if (pl) {
      const i = pl.items.indexOf(this.id);
      const next = Store.songs.get(pl.items[i + 1]);
      info.pos = `${i + 1}/${pl.items.length}`;
      info.next = next ? next.title : '';
      info.isLast = !next;
    }
    return info;
  }
  onStageRender(lay) {
    const n = lay.pages.length;
    this.paintStruct();
    this.onPageScroll(this.se.page, n);
    this.pageNav.style.display = n > 1 ? '' : 'none';
  }
  onPageScroll(p, n) {
    this.pageLbl.textContent = `${p + 1}/${n}`;
  }
  onSelChange() {
    if (!this.se) return;
    if (this.se.lay) this.onStageRender(this.se.lay);
    this.paintStruct();
    this.paintSingers();
    this.paintSize();
    this.paintLh();
    this.paintSp();
    this.paintAl();
    this.paintLs();
    this.paintFont();
  }
  /* písmo písně v liště: „podle šablony“ nebo vlastní (ukládá se do písně jako u Písmo této písně…) */
  /* označení v psaném řádku si zapamatuje, než fokus vezme výběr písma */
  keepSel() {
    const sel = window.getSelection();
    this.keptRange = this.se.editEl && sel.rangeCount && this.se.editEl.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
  }
  paintFont() {
    if (!this.fontSel || document.activeElement === this.fontSel) return;
    const base = Store.template(this.inTpl.value || Settings.get('defaultTemplate'));
    const song = !this.se || this.songScope(), songFont = (this.style && this.style.fontFamily) || '';
    const cur = song ? songFont : this.se.fontAt();
    const def = song ? base.fontFamily + ' (šablona)' : (songFont || base.fontFamily) + ' (písně)';
    this.fontSel.replaceChildren(h('option', { value: '' }, def),
      ...FONTS.map(f => h('option', { value: f, style: { fontFamily: `"${f}"` } }, f)));
    this.fontSel.value = cur;
    this.fontSel.style.fontFamily = `"${cur || songFont || base.fontFamily}", sans-serif`;
  }
  setFont(f) {
    if (!this.songScope()) {   // označená slova nebo řádek
      const se = this.se;
      if (this.keptRange && se.editEl) { se.editEl.focus({ preventScroll: true }); const s = window.getSelection(); s.removeAllRanges(); s.addRange(this.keptRange); }
      this.keptRange = null;
      se.format('font', f);
      this.fontSel.blur(); this.paintFont();
      return;
    }
    const st = Object.assign({}, this.style || {});
    if (f) st.fontFamily = f; else delete st.fontFamily;
    this.style = Object.keys(st).length ? st : null;
    this.markDirty(); this.se.pushHist(); this.se.render(); this.paintFont();
    this.stageWrap.focus({ preventScroll: true });
  }
  /* Velikost písma v px na zvolené obrazovce. Ukládá se poměrem k písmu řádku ze šablony
     ({130%:…}), takže na jiné obrazovce i po změně šablony zůstane ve stejném poměru. */
  paintSize() {
    if (!this.sizeInp || !this.se || document.activeElement === this.sizeInp) return;
    if (!this.sizeInp.isConnected) { document.removeEventListener('selectionchange', this.onDocSel); return; }
    if (this.songScope()) {   // celá píseň: základní velikost písma písně
      const own = (this.style || {}).sizePct;
      this.sizeInp.value = String(Math.round(this.lookTpl().fontSize * this.fz()));
      this.sizeBox.classList.toggle('on', !!own);
      this.sizeBox.title = 'Velikost písma celé písně v px' + (own ? ` (${own} % šablony)` : ' (podle šablony)') + ' – napiš a potvrď Enterem';
      return;
    }
    const p = this.se.sizeAt(), base = this.se.linePx();
    this.sizeInp.value = base ? String(Math.round(base * p / 100)) : '';
    this.sizeBox.classList.toggle('on', p !== 100);
    this.sizeBox.title = 'Velikost písma v px na obrazovce „' + this.screen().name + '“' + (p !== 100 ? ` (${p} % písma řádku)` : ' (podle šablony)') + ' – napiš a potvrď Enterem';
  }
  /* zapnutí zpěváci: u slov v barvě zpěváka ten zpěvák, jinak zpěváci řádku */
  /* Aa: je-li v textu nějaké malé písmeno, vše na VELKÁ, jinak na malá */
  toggleCase() {
    if (this.songScope()) {
      // celá píseň: zobrazeno VELKÝMI → psát normálně (řádky psané celé velkými na „Velké první písmeno“), jinak VŠE VELKÝMI
      const src = this.se.lines(), info = parseSong(this.src).lines;
      const anyLower = src.some((l, i) => info[i] && info[i].kind === 'line' && /\p{Ll}/u.test(stripMarkupBody(l)));
      if (!this.lookTpl().uppercase && anyLower) return this.setSong('uppercase', true);
      const ls = src.map((l, i) => {
        if (!info[i] || !['line', 'note'].includes(info[i].kind) || /\p{Ll}/u.test(stripMarkupBody(l))) return l;
        const sp = splitLine(l, info[i].kind);
        const b = caseText(sp.body, false).replace(/^((?:\{[^:}]*:|[\s*_[(„"'-])*)(\p{L})/u, (x, pre, c) => pre + c.toLocaleUpperCase('cs'));
        return sp.prefix + b + sp.suffix;
      });
      const st = Object.assign({}, this.style || {});
      if (this.baseTpl().uppercase) st.uppercase = false; else delete st.uppercase;
      this.style = Object.keys(st).length ? st : null;
      return this.se.commit(ls.join('\n'), { force: true });
    }
    const se = this.se, sel = window.getSelection();
    let t;
    if (se.editing && se.editEl && sel.rangeCount && !sel.isCollapsed && se.editEl.contains(sel.anchorNode)) t = sel.toString();
    else { const ls = se.lines(); t = (se.editing ? [se.editing.line] : se.selTargets().map(x => x.line)).map(i => ls[i] || '').join(' '); }
    // šablona píše VELKÝMI: malá písmena jen se značkou {aa:…}, klik ji přidá / odebere
    if (this.lookTpl().uppercase) {
      const host = se.editing && se.editEl && sel.rangeCount && se.editEl.contains(sel.anchorNode) && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentNode).closest('.kc');
      return se.format(host || /\{aa:/.test(t) ? 'kc-off' : 'kc-on');
    }
    t = t.replace(/\{[^:}]*:|\[[^\]]*\]/g, '');   // bez značek a akordů
    se.format(t !== t.toLocaleUpperCase('cs') ? 'upper' : 'lower');
  }
  /* přepínače zpěváků v liště (před tlačítkem označení) */
  makeSingerBtns() {
    (this.sgButtons || []).forEach(b => b.remove());
    this.sgButtons = this.singers().map((s, i) => h('button', { class: 'sw', style: { '--c': s.color }, title: `${s.name} – zapnout / vypnout (Alt+${i + 1}, na stránce ← →)`, onmousedown: e => e.preventDefault(),
      onclick: () => this.se.toggleSinger(s.code) }, h('span', { class: 'sw-c' }), h('span', { class: 'sw-n' }, s.name)));
    this.sgRow.prepend(...this.sgButtons);
    if (this.se) this.paintSingers();
  }
  /* zpěváci jsou společní pro kapelu: barva a přidání se uloží do obsazení */
  // zpěváci této písně (vlastní seznam v style.singers, jinak podle šablony)
  singers() { return Store.singers(this.lookTpl()); }
  singerMap() { const m = {}; for (const s of this.singers()) m[s.code.toUpperCase()] = s; return m; }
  /* barva, přidání a odebrání zpěváka platí jen pro tuto píseň */
  setSongSingers(list) {
    this.style = Object.assign({}, this.style || {}, { singers: list });
    this.markDirty(); this.se.pushHist(); this.makeSingerBtns(); this.se.render();
  }
  paintSingers() {
    const se = this.se, t = se.cur();
    let own = t ? se.singersOf(t).own : [];
    const host = se.editEl && selSingerHost(window.getSelection(), se.editEl);
    if (host) own = parseCodes(host.dataset.c);
    this.sgButtons.forEach((b, i) => b.classList.toggle('on', own.includes((this.singers()[i] || {}).code)));
  }
  /* řádkování řádku s kurzorem: vlastní, jinak písně / šablony (šedě) */
  paintLh() {
    if (!this.lhInp || !this.se || document.activeElement === this.lhInp) return;
    const song = this.songScope(), own = song ? (this.style || {}).lineHeight : this.se.lineLh(), def = this.lookTpl().lineHeight;
    this.lhInp.value = String(own != null ? own : Math.round(def * 100) / 100).replace('.', ',');
    this.lhBox.classList.toggle('on', own != null);
  }
  setLh(v) {
    if (this.songScope()) { this.setSong('lineHeight', v ? Math.round(Math.max(0.8, Math.min(3, v)) * 100) / 100 : undefined); return this.paintLh(); }
    const def = this.lookTpl().lineHeight;
    this.se.format('lh', !v || Math.abs(v - def) < 0.005 ? '' : String(Math.round(Math.max(0.8, Math.min(3, v)) * 100) / 100));
    this.paintLh();
  }
  stepLh(d) {
    const own = this.songScope() ? null : this.se.lineLh();
    this.setLh(Math.round(((own != null ? own : this.lookTpl().lineHeight) + d) * 10) / 10);
  }
  /* Barva písma z lišty: označená slova, řádky, nebo celá píseň. Platí poslední úprava
     (barva z lišty přebije zpěváka i sekci, přidaný zpěvák s barvou písma a barva sekce zase ji). */
  colorPopover(anchor) {
    $$('.menu').forEach(m => m.remove());
    const sel = window.getSelection();
    const keep = this.se.editEl && sel.rangeCount && this.se.editEl.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    const song = this.songScope();
    const apply = c => {
      m.remove();
      this.lastColor = c || this.lastColor;
      this.colorBtn.style.setProperty('--tc', this.lastColor || '');
      if (song) return this.setSongColor(c);
      if (keep && this.se.editEl) { this.se.editEl.focus({ preventScroll: true }); const s = window.getSelection(); s.removeAllRanges(); s.addRange(keep); }
      this.se.format('color', c);
    };
    const sw = ['#ffffff', '#ffff00', '#ffd23f', '#ff9f43', '#ff5252', '#ff7eb6', '#b388ff', '#4fc3f7', '#7cfc9a', '#9e9e9e'];
    const custom = h('input', { type: 'color', value: this.lastColor || '#ffffff', onchange: () => apply(custom.value.toLowerCase()) });
    const m = h('div', { class: 'menu menu-form menu-color' },
      h('div', { class: 'menu-head' }, song ? 'Barva písma celé písně' : 'Barva písma'),
      h('div', { class: 'col-sw' }, sw.map(c => h('button', { class: 'col-dot', title: c, style: { background: c }, onmousedown: e => e.preventDefault(), onclick: () => apply(c) }))),
      h('label', { class: 'chk' }, custom, 'Vlastní barva…'),
      h('button', { class: 'btn small nogrow', onmousedown: e => e.preventDefault(), onclick: () => apply('') }, song ? 'Podle šablony' : 'Bez vlastní barvy'));
    placePopover(m, anchor);
  }
  /* Nastavení stránky jen pro tuto píseň – stejné volby jako v šabloně (výchozí hodnoty = šablona) */
  pagePopover(anchor) {
    this.settingsPopover(anchor, 'Stránka této písně', PAGE_KEYS, [
      ['Rozvržení', [['padX', 'Okraj vlevo a vpravo', 'px'], ['padY', 'Okraj nahoře a dole', 'px'], ['columns', 'Sloupce'], ['colGap', 'Mezera mezi sloupci', 'px'],
        ['onePage', 'Zakázat více stránek'], ['fit', 'Jinak dlouhá píseň', null, [['shrink', 'zmenšit písmo'], ['paginate', 'na více stránek']]], ['minScale', 'Nejmenší písmo', 'px']]],
      ['Zobrazení', [['showHeader', 'Záhlaví'], ['showFooter', 'Zápatí'], ['headerSize', 'Velikost záhlaví a zápatí', 'px'], ['showNotes', 'Poznámky (//)'], ['mirror', 'Zrcadlení']]],
    ]);
  }
  /* sekce písně (Struktura): nadpisy, mezera mezi slokami, barvy částí písně – jen pro tuto píseň */
  sectionPopover(anchor) {
    this.settingsPopover(anchor, 'Sekce této písně', SECTION_KEYS, [
      ['Nadpisy', [['showSections', 'Nadpisy sekcí'], ['sectionScale', 'Velikost nadpisů', 'px'], ['sectionColor', 'Barva nadpisů']]],
      ['Mezery', [['stanzaGap', 'Mezera mezi slokami', '×']]],
      ['Barva textu', [['verseColor', 'Sloka'], ['chorusColor', 'Refrén'], ['bridgeColor', 'Mezičást'], ['instrColor', 'Předehra, mezihra, sólo']]],
    ]);
  }
  /* okno s volbami šablony jen pro tuto píseň: skupiny, vlevo název, vpravo přepínač / výběr / barva / − hodnota + */
  settingsPopover(anchor, title, keys, groups) {
    $$('.menu').forEach(m => m.remove());
    const F = k => TPL_FIELDS.find(f => f.k === k);
    const box = h('div', { class: 'pg-set' });
    const paint = () => {
      box.innerHTML = '';
      const tpl = this.lookTpl(), base = this.baseTpl(), st = this.style || {};
      for (const [gTitle, rows] of groups) {
        box.appendChild(h('div', { class: 'pg-g' }, gTitle));
        for (const [k, label, unit, opts] of rows) {
          const f = F(k), v = tpl[k], own = st[k] !== undefined && st[k] !== base[k];
          const set = val => { this.setSong(k, val); paint(); };
          let ctl;
          if (f.t === 'check') ctl = h('input', { type: 'checkbox', class: 'switch', checked: !!v, onchange: e => set(e.target.checked) });
          else if (f.t === 'color') { const c = h('input', { type: 'color', class: 'pg-color', value: v || '#ffffff' }); c.onchange = () => set(c.value.toLowerCase()); ctl = c; }
          else if (f.t === 'select') {
            const sel = h('select', { class: 'inp pg-sel' }, (opts || f.o).map(([val, lab]) => h('option', { value: val, selected: String(val) === String(v) }, lab)));
            sel.onchange = () => set(typeof f.o[0][0] === 'number' ? +sel.value : sel.value);
            ctl = sel;
          } else if (f.rel) {
            // násobek velikosti písma, ukázaný v px (krok 2 px)
            const fs = tpl.fontSize || 60, clamp = x => Math.max(f.min, Math.min(f.max, x));
            const go = d => set(clamp((Math.round(v * fs) + d * 2) / fs));
            ctl = h('div', { class: 'pg-step' },
              h('button', { class: 'tl tl-step', onmousedown: e => e.preventDefault(), onclick: () => go(-1) }, '−'),
              h('label', { class: 'pg-num' }, numField(v, { scale: fs, dec: 0, min: f.min, max: f.max }, set), h('span', {}, 'px')),
              h('button', { class: 'tl tl-step', onmousedown: e => e.preventDefault(), onclick: () => go(1) }, '+'));
          } else {
            const step = +f.step * (unit === '%' ? 5 : 1) || 1, dec = (String(step).split('.')[1] || '').length;
            const go = d => set(Math.round(Math.max(f.min, Math.min(f.max, +v + d * step)) / step) * step);
            ctl = h('div', { class: 'pg-step' },
              h('button', { class: 'tl tl-step', onmousedown: e => e.preventDefault(), onclick: () => go(-1) }, '−'),
              h('label', { class: 'pg-num' }, numField(v, { pct: unit === '%', dec: unit === '%' ? 0 : dec, min: f.min, max: f.max }, set), unit ? h('span', {}, unit) : null),
              h('button', { class: 'tl tl-step', onmousedown: e => e.preventDefault(), onclick: () => go(1) }, '+'));
          }
          box.appendChild(h('div', { class: 'pg-row' + (own ? ' own' : ''), title: own ? 'Jen pro tuto píseň (šablona: ' + base[k] + ')' : 'Podle šablony' }, h('span', { class: 'pg-l' }, label), ctl));
        }
      }
      reset.style.display = keys.some(k => st[k] !== undefined) ? '' : 'none';
    };
    const reset = h('button', { class: 'btn small nogrow', style: { alignSelf: 'flex-start' }, onclick: () => {
      const st = Object.assign({}, this.style || {}); keys.forEach(k => delete st[k]);
      this.style = Object.keys(st).length ? st : null; this.markDirty(); this.se.pushHist(); this.se.render(); this.onSelChange(); paint();
    } }, 'Vše podle šablony');
    const m = h('div', { class: 'menu menu-form menu-page' }, h('div', { class: 'menu-head' }, title),
      h('div', { class: 'help' }, 'Výchozí je šablona, změny platí jen pro tuto píseň (označené tečkou).'), box, reset);
    paint();
    placePopover(m, anchor);
  }
  /* barva celé písně: smaže ostatní barvy (slov, řádků, sekcí, části písně) a vypne barvu písma zpěváků */
  setSongColor(c) {
    const se = this.se;
    const ls = se.lines().map(l => {
      const t = l.trim();
      if (t.startsWith('##') && !/^##\s*$/.test(t)) { const sec = parseSectionLine(t); return sec.color ? formatSectionLine(Object.assign(sec, { color: '' })) : l; }
      return stripColor(l);
    });
    const st = Object.assign({}, this.style || {});
    if (c) {
      st.textColor = st.verseColor = st.chorusColor = st.bridgeColor = c; delete st.textBy;   // celá píseň: i všechny části písně
      const tpl = this.lookTpl();
      for (const sg of this.singers()) if (singerShowOf(tpl, sg.code).text) st.singer = Object.assign({}, st.singer, { [sg.code]: Object.assign({}, (st.singer || {})[sg.code], { text: false }) });
    } else for (const k of ['textColor', 'textBy', 'verseColor', 'chorusColor', 'bridgeColor']) delete st[k];
    this.style = Object.keys(st).length ? st : null;
    se.commit(ls.join('\n'), { force: true });
  }
  /* rozestup písmen: označená slova, řádek, nebo celá píseň (v liště v % výšky písma) */
  lsNow() {
    if (this.songScope()) return { v: this.lookTpl().letterSpacing || 0, own: (this.style || {}).letterSpacing != null };
    const own = this.se.lsAt();
    return { v: own != null ? own : this.lookTpl().letterSpacing || 0, own: own != null };
  }
  paintLs() {
    if (!this.lsInp || !this.se || document.activeElement === this.lsInp) return;
    const { v, own } = this.lsNow();
    this.lsInp.value = String(Math.round(v * 100));
    this.lsBox.classList.toggle('on', own);
  }
  setLs(pct) {
    const v = Math.round(Math.max(-10, Math.min(50, pct))) / 100;
    if (this.songScope()) this.setSong('letterSpacing', v);
    else this.se.format('ls', String(v === (this.lookTpl().letterSpacing || 0) ? 0 : v));
    this.paintLs();
  }
  stepLs(d) { this.setLs(Math.round(this.lsNow().v * 100) + d); }
  /* mezera pod řádkem s kurzorem ({⤓0.5:…}, × výška písma) */
  paintSp() {
    if (!this.spInp || !this.se || document.activeElement === this.spInp) return;
    const own = this.songScope() ? (this.style || {}).lineGap : this.se.lineOuter().sp;
    this.spInp.value = String(own || 0).replace('.', ',');
    this.spBox.classList.toggle('on', !!own);
  }
  setSp(v) {
    if (this.songScope()) { this.setSong('lineGap', v > 0 ? Math.round(Math.min(5, v) * 100) / 100 : undefined); return this.paintSp(); }
    this.se.format('sp', !(v > 0) ? '' : String(Math.round(Math.min(5, v) * 100) / 100));
    this.paintSp();
  }
  stepSp(d) { this.setSp(Math.round((+((this.songScope() ? (this.style || {}).lineGap : this.se.lineOuter().sp) || 0) + d) * 10) / 10); }
  /* zarovnání řádku: vlastní, jinak podle šablony; klik na zarovnání šablony vlastní zruší */
  paintAl() {
    if (!this.alBtns || !this.se) return;
    const song = this.songScope(), own = song ? AL_MARK[(this.style || {}).align] : this.se.lineOuter().al;
    const eff = own || AL_MARK[(song ? this.baseTpl() : this.lookTpl()).align] || '↔';
    [...this.alBtns.children].forEach((b, i) => { b.classList.toggle('on', '⇤↔⇥'[i] === eff); b.classList.toggle('own', !!own && '⇤↔⇥'[i] === own); });
  }
  setAl(a) {
    if (this.songScope()) { const v = AL_CSS[a]; this.setSong('align', v === this.baseTpl().align ? undefined : v); return this.paintAl(); }
    this.se.format('al', a === AL_MARK[this.lookTpl().align] ? '' : a);
    this.paintAl();
  }
  /* nic vybraného (klik vedle textu) = úpravy z lišty platí pro celou píseň */
  songScope() { return !!this.se && !this.se.editing && !this.se.cur(); }
  baseTpl() { return Store.template(this.inTpl.value || Settings.get('defaultTemplate')); }
  fz() { const scr = this.screen(); return Screens.fontScale(scr, scr.id === Screens.mine().id); }
  /* volba písně (style): undefined / stejné jako šablona = podle šablony */
  setSong(k, v) {
    const st = Object.assign({}, this.style || {});
    if (v === undefined || v === null || v === '' || v === this.baseTpl()[k]) delete st[k]; else st[k] = v;
    this.style = Object.keys(st).length ? st : null;
    this.markDirty(); this.se.pushHist(); this.paintFont(); this.se.render(); this.onSelChange();
  }
  /* uložit: vlastní nastavení písně se zapíše do její šablony (změní se všem písním s touto šablonou) */
  async saveToTemplate() {
    const base = this.baseTpl();
    if (!this.style) return toast('Píseň nemá žádné vlastní nastavení – šablona zůstává stejná.', 'ok');
    const n = [...Store.songs.values()].filter(s => (s.templateId || Settings.get('defaultTemplate')) === base.id && s.id !== this.id).length;
    if (!await confirmDlg(`Uložit nastavení této písně do šablony „${base.name}“?` + (n ? ` Změní se tím i ${n} dalším písním s touto šablonou.` : ''), 'Uložit do šablony')) return;
    const t = clone(applySongStyle(base, { style: this.style }));
    Object.assign(t, { id: base.id, name: base.name });
    await Store.put('templates', t);
    this.style = null;
    this.markDirty(); this.se.pushHist(); this.makeSingerBtns(); this.paintFont(); this.se.render(); this.onSelChange();
    toast('Šablona „' + t.name + '“ uložena', 'ok');
  }
  /* nastavení písně (šablona + vlastní úpravy písně) uložit jako novou šablonu; píseň ji pak použije */
  async saveAsTemplate() {
    const name = await promptDlg('Název nové šablony', (this.inTitle.value.trim() || 'Píseň') + ' – šablona');
    if (!name || !name.trim()) return;
    const t = clone(applySongStyle(this.baseTpl(), { style: this.style }));
    Object.assign(t, { id: uid(), name: name.trim() });
    await Store.put('templates', t);
    this.inTpl.appendChild(h('option', { value: t.id }, t.name));
    this.inTpl.value = t.id;
    this.style = null;   // vše je teď v šabloně
    this.markDirty(); this.se.pushHist(); this.makeSingerBtns(); this.paintFont(); this.se.render(); this.onSelChange();
    toast('Uloženo jako šablona „' + t.name + '“ – píseň ji teď používá', 'ok');
  }
  /* historie zpět / znovu: text, vlastní nastavení i údaje písně (interpret, název, ladění, BPM, délka, šablona) */
  histState() {
    return { src: this.src, style: this.style || null,
      meta: [this.inArtist.value, this.inTitle.value, this.inKey.value, this.inTempo.value, this.inDur.value, this.inTpl.value] };
  }
  restoreHist(st) {
    const styleChanged = JSON.stringify(this.style || null) !== JSON.stringify(st.style);
    this.style = st.style;
    if (st.meta) [this.inArtist, this.inTitle, this.inKey, this.inTempo, this.inDur, this.inTpl].forEach((el, i) => { el.value = st.meta[i]; });
    if (styleChanged) this.makeSingerBtns();
    this.paintFont();
  }
  fmt(kind) {
    if (!this.songScope()) return this.se.format(kind);
    const st = this.style || {};
    if (kind === 'bold') this.setSong('fontWeight', st.fontWeight ? undefined : (this.baseTpl().fontWeight >= 700 ? 400 : 700));
    if (kind === 'italic') this.setSong('italic', st.italic ? undefined : true);
  }
  setSizePx(px) {
    if (this.songScope()) { const p = Math.round(px / (this.baseTpl().fontSize * this.fz()) * 100); return this.setSong('sizePct', p === 100 ? undefined : Math.max(30, Math.min(300, p))); }
    const base = this.se.linePx();
    if (base) this.se.format('size', szClamp(px / base * 100));
  }
  stepSize(d) {
    if (this.songScope()) { this.setSizePx(Math.round(this.lookTpl().fontSize * this.fz()) + d); return this.paintSize(); }
    const base = this.se.linePx();
    if (!base) return this.se.format(d > 0 ? 'bigger' : 'smaller');
    this.setSizePx(Math.round(base * this.se.sizeAt() / 100) + d);
    this.paintSize();
  }
  screen() { return Screens.get(this.screenId); }
  breakLine() { return this.screenId === 'main' ? '---' : '--- ' + this.screenId; }
  /* Struktura písně vlevo: sekce, opakování, konce stránek – klik skočí na sekci */
  paintStruct() {
    if (!this.structBox || !this.se) return;
    const sm = this.singerMap(), tpl = this.lookTpl();
    const items = [];
    this.src.split('\n').forEach((l, i) => {
      const t = l.trim();
      let m;
      if (breakScreen(t) !== null) { if (breakScreen(t) === this.screenId) items.push({ line: i, brk: true }); }
      else if (/^##\s*$/.test(t)) return;   // konec sekce
      else if (t.startsWith('##')) {
        const sec = parseSectionLine(t), kind = sectionKind(sec.name), c = sec.singers[0];
        const color = sec.color || (kind === 'instr' ? tpl.instrColor : kind ? tpl[kind + 'Color'] : '') || (c && sm[c] ? sm[c].color : '');
        items.push({ line: i, name: sec.name || 'Sekce', count: sec.count, color, instr: kind === 'instr', hidden: sec.hidden });
      } else if ((m = RE_REPEAT.exec(t))) items.push({ line: i, name: '↻ ' + m[1], rep: true });
    });
    const cur = this.se.cur();
    let curLine = -1;
    if (cur) for (const it of items) if (!it.brk && it.line <= cur.line) curLine = it.line;
    const key = JSON.stringify([items, curLine]);
    if (key === this.structKey) return;
    this.structKey = key;
    this.structBox.innerHTML = '';
    if (!items.some(it => !it.brk)) { this.structBox.appendChild(h('div', { class: 'help' }, 'Bez sekcí. Vyber řádky (klik, nebo tažením víc řádků) a dej ＋ Sekce.')); return; }
    let pg = 1;
    for (const it of items) {
      if (it.brk) { this.structBox.appendChild(h('div', { class: 'st-brk' }, h('span', {}, 'Stránka ' + (++pg)))); continue; }
      // klik = označit celou sekci jako blok (zpěvák, písmo, velikost pak platí pro celou sekci)
      const go = () => {
        const se = this.se;
        se.finishEdit(true);
        const next = items.find(x => !x.brk && x.line > it.line);
        const end = next ? next.line : Infinity;
        const idxs = se.targets.map((t, i) => [t, i]).filter(([t]) => t.line > it.line && t.line < end && t.kind !== 'repeat').map(x => x[1]);
        if (idxs.length) { se.select(idxs[0]); se.select(idxs[idxs.length - 1], true); } // i jediný řádek jako blok
        else { let idx = se.targets.findIndex(t => t.line >= it.line); se.select(idx < 0 ? se.targets.length - 1 : idx); }
        this.stageWrap.focus({ preventScroll: true });
      };
      const menu = e => { e.stopPropagation(); e.preventDefault(); this.sectionMenu(e.currentTarget, it); };
      this.structBox.appendChild(h('div', { class: 'st-item' + (it.line === curLine ? ' on' : '') + (it.rep ? ' rep' : '') + (it.instr ? ' instr' : '') + (it.hidden ? ' off' : ''), title: 'Přejít na sekci (pravé tlačítko = úpravy)',
        onclick: go, oncontextmenu: menu },
      h('i', { style: it.color ? { background: it.color } : {} }), h('span', { class: 'st-n' }, it.name),
      it.count > 1 ? h('b', { class: 'st-cnt' }, it.count + '×') : null,
      h('button', { class: 'st-more', title: 'Upravit sekci: název, typ, opakování, barva', onclick: menu }, '⋯'),
      h('button', { class: 'st-more st-del', title: it.rep ? 'Smazat opakování' : 'Odebrat sekci – text zůstane, jen už nebude patřit do žádné sekce', onclick: e => { e.stopPropagation(); this.removeSection(it); } }, '✕')));
    }
  }
  /* úpravy sekce z panelu Struktura */
  sectionMenu(anchor, it) {
    const ls = () => this.se.lines();
    const setHeader = fn => { const l = ls(); l[it.line] = formatSectionLine(fn(parseSectionLine(l[it.line]))); this.se.commit(l.join('\n')); };
    if (it.rep) return popupMenu(anchor, [{ label: 'Smazat opakování', danger: true, action: () => { const l = ls(); l.splice(it.line, 1); this.se.commit(l.join('\n')); } }]);
    $$('.menu').forEach(m => m.remove());
    const sec = parseSectionLine(ls()[it.line]);
    const verses = parseSong(this.src).blocks.filter(b => b.type === 'section' && /^sloka/i.test(b.text)).length;
    // počet opakování: − n× +, číslo jde i přepsat
    let count = sec.count || 1;
    const setCount = v => { count = Math.max(1, Math.min(99, v)); num.setValue(count); setHeader(o => Object.assign(o, { count: count > 1 ? count : 0 })); };
    const num = numField(count, { dec: 0, min: 1, max: 99 }, setCount);
    // barva písma sekce (podle šablony, dokud se nezmění)
    const defColor = () => { const tpl = this.lookTpl(), kind = sectionKind(parseSectionLine(ls()[it.line]).name); return (kind === 'instr' ? tpl.instrColor : tpl[kind + 'Color']) || tpl.textColor || '#ffffff'; };
    const col = h('input', { type: 'color', value: sec.color || defColor() });
    const reset = h('button', { class: 'btn small nogrow', disabled: !sec.color, title: 'Barva podle šablony', onclick: () => { setHeader(o => Object.assign(o, { color: '' })); col.value = defColor(); reset.disabled = true; } }, 'Podle šablony');
    col.onchange = () => { this.setSectionColor(it.line, col.value.toLowerCase()); reset.disabled = false; };
    const hid = h('input', { type: 'checkbox', checked: !!sec.hidden, onchange: () => setHeader(o => Object.assign(o, { hidden: hid.checked })) });
    // typ a název sekce
    const name = h('input', { class: 'inp', value: sec.name });
    const types = sectionTypeChips(name, 'Sloka ' + (verses + 1), n => setHeader(o => Object.assign(o, { name: n })));
    name.addEventListener('change', () => { const n = name.value.trim(); if (n) setHeader(o => Object.assign(o, { name: n })); });
    name.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') name.blur(); });
    const act = (label, title, fn, cls) => h('button', { type: 'button', class: 'sp-act' + (cls ? ' ' + cls : ''), title, onclick: () => { m.remove(); fn(); } }, label);
    const m = h('div', { class: 'menu sec-pop' },
      h('div', { class: 'menu-head' }, 'Sekce „' + sec.name + '“'),
      act('↻ Zopakovat tuto sekci', 'Vloží opakování sekce u vybraného řádku – ve čtečce se vypíše celá', () => this.se.insertLines(['>> ' + it.name])),
      h('div', { class: 'sp-row' }, h('span', {}, 'Počet opakování'), h('div', { class: 'pg-step' },
        h('button', { type: 'button', class: 'tl tl-step', onclick: () => setCount(count - 1) }, '−'),
        h('label', { class: 'pg-num' }, num, h('span', {}, '×')),
        h('button', { type: 'button', class: 'tl tl-step', onclick: () => setCount(count + 1) }, '+'))),
      h('div', { class: 'sp-row' }, h('span', {}, 'Barva písma'), h('div', { class: 'sp-col' }, col, reset)),
      h('label', { class: 'sp-row sp-chk' }, h('span', {}, 'Skrýt nadpis v textu'), hid),
      h('hr', { class: 'menu-sep' }),
      h('div', { class: 'sp-types' }, types, h('label', { class: 'f' }, h('span', {}, 'Název'), name)),
      h('hr', { class: 'menu-sep' }),
      act('Odebrat sekci (text zůstane)', 'Text zůstane, jen už nebude patřit do žádné sekce', () => this.removeSection(it), 'danger'));
    placePopover(m, anchor);
  }
  /* odebrat nadpis sekce: text zůstane bez sekce (nespadne do sekce nad ním – místo nadpisu zůstane konec sekce „##“) */
  removeSection(it) {
    const l = this.se.lines();
    if (it.rep || !inSection(l, it.line - 1)) l.splice(it.line, 1);
    else l[it.line] = '##';
    this.se.commit(l.join('\n'));
  }
  /* barva sekce: nadpis + smaže barvy textu v sekci; řádky zpěváka s barvou písma dostanou barvu sekce (poslední úprava vyhrává) */
  setSectionColor(line, color) {
    const ls = this.se.lines(), tpl = this.lookTpl();
    const sec = parseSectionLine(ls[line]);
    ls[line] = formatSectionLine(Object.assign({}, sec, { color }));
    for (let j = line + 1; j < ls.length; j++) {
      const t = ls[j].trim();
      if (t.startsWith('##') || RE_BREAK.test(t) || RE_REPEAT.test(t)) break;
      if (!t || t.startsWith('//')) continue;
      const m = RE_SINGER.exec(t), codes = m ? parseCodes(m[1]) : sec.singers;
      ls[j] = color && codes.some(c => singerShowOf(tpl, c).text) ? formatLine(ls[j], 'color', color) : stripColor(ls[j]);
    }
    this.se.commit(ls.join('\n'));
  }
  focusMeta() { this.inArtist.focus(); this.inArtist.select(); }
  schedulePreview() { clearTimeout(this.pvT); this.pvT = setTimeout(() => { if (!this.se.editing) this.se.render(); }, 250); }
  changed() { this.markDirty(); }

  /* ----- Ukládání ----- */
  collect() {
    const old = Store.songs.get(this.id) || {};
    const o = Object.assign({}, old, {
      id: this.id,
      title: this.inTitle.value.trim() || 'Bez názvu',
      artist: this.inArtist.value.trim(),
      key: this.inKey.value.trim(),
      tempo: this.inTempo.value.trim(),
      duration: this.inDur.value.trim(),
      templateId: this.inTpl.value,
      text: this.src,
      style: this.style === undefined ? (old.style || null) : this.style,
    });
    delete o.tags;   // štítky se už nepoužívají
    return o;
  }
  // „neuloženo“ = jiný stav než při posledním uložení (úprava tam a zpět nic nemění)
  snap() {
    const o = this.collect();
    return JSON.stringify([o.title, o.artist, o.key, o.tempo, o.duration, o.templateId, o.text, o.style || null]);
  }
  markDirty() {
    this.dirty = this.snap() !== this.base;
    this.savedInd.textContent = this.dirty ? 'Neuloženo' : 'Uloženo';
    this.savedInd.classList.toggle('dirty', this.dirty);
    this.saveBtn.classList.toggle('primary', this.dirty);
  }
  async save(manual) {
    if (!this.dirty && !manual) return;
    if (!Store.songs.has(this.id)) return;
    this.se.finishEdit(true);
    const s = this.collect();
    this.dirty = false;
    this.base = this.snap();
    await Store.put('songs', s);
    this.savedInd.textContent = 'Uloženo';
    this.savedInd.title = fmtDate(s.updatedAt);
    this.savedInd.classList.remove('dirty');
    this.saveBtn.classList.remove('primary');
    if (manual) toast('Uloženo', 'ok', 1500);
  }

  /* ----- Nabídka OK pro vybraný řádek (vše ovladatelné šipkami) ----- */
  lineMenuItems(t) {
    const se = this.se;
    const ls = se.lines();
    const singerItems = () => [
      ...this.singers().map(s => ({ label: s.name, color: s.color, active: se.singersOf(t).own.includes(s.code), action: () => se.assignSinger(s.code, 'force') })),
      { label: 'Nikdo', action: () => se.assignSinger(null, 'clear') }];
    const formatItems = [
      { label: 'Tučně', hint: 'Ctrl+B', action: () => se.formatLines('bold') },
      { label: 'Kurzíva', hint: 'Ctrl+I', action: () => se.formatLines('italic') },
      { label: 'Větší písmo', action: () => se.formatLines('bigger') },
      { label: 'Menší písmo', action: () => se.formatLines('smaller') },
      { label: 'VELKÁ PÍSMENA', action: () => se.formatLines('upper') },
      { label: 'malá písmena', action: () => se.formatLines('lower') }];
    const sections = () => [...new Set(parseSong(this.src).blocks.filter(b => b.type === 'section' && !b.repeat).map(b => b.text))];
    const insertItems = () => [
      { label: 'Řádek pod', action: () => se.startEdit(null, 'end') },
      { label: 'Mezeru (nová sloka) pod', action: () => se.insertLines(['', ''], {}) },
      { label: 'Sekce…', action: () => this.addSection() },
      { label: 'Opakování sekce', items: () => sections().map(n => ({ label: '↻ ' + n, action: () => se.insertLines(['>> ' + n]) })), empty: 'Nejdřív musí být v písni nadpis sekce (např. Refrén).' },
      { label: 'Poznámku pod', action: () => se.insertLines(['// '], { edit: true }) },
      { label: 'Novou stránku před tento řádek', action: () => se.insertLines([this.breakLine()], { before: true }) },
    ];
    // konec stránky této obrazovky těsně nad řádkem (přes případné konce jiných obrazovek)
    let pbLine = -1;
    for (let j = t.line - 1; j >= 0 && breakScreen(ls[j]) !== null; j--) if (breakScreen(ls[j]) === this.screenId) { pbLine = j; break; }
    const pageBreakBefore = pbLine >= 0;
    const common = [
      { sep: true },
      { label: 'Vložit', items: insertItems },
      pageBreakBefore ? { label: 'Zrušit novou stránku před', action: () => { const l = se.lines(); l.splice(pbLine, 1); se.curLine = t.line - 1; se.curKey = null; se.commit(l.join('\n')); } } : null,
      { label: 'Stránka a zobrazení', items: () => [
        { label: 'Další stránka', hint: 'PgDn', action: () => se.turnPage(1) },
        { label: 'Předchozí stránka', hint: 'PgUp', action: () => se.turnPage(-1) },
        { label: 'Otevřít ve čtečce', action: () => this.openReader() }] },
      { label: 'Celá píseň', items: () => [
        { label: 'Uložit', hint: 'Ctrl+S', action: () => this.save(true) },
        { label: 'Vrátit poslední změnu', hint: 'Ctrl+Z', action: () => se.undo(-1) },
        { label: 'Vyčistit text…', action: () => this.cleanDialog() },
        { label: 'Zdrojový text…', action: () => this.sourceDialog() }] },
    ].filter(Boolean);
    const del = { label: 'Smazat', hint: 'Delete', danger: true, action: () => se.deleteLines() };
    switch (t.kind) {
      case 'repeat': return [
        { label: 'Opakovat jinou sekci', items: () => sections().map(n => ({ label: '↻ ' + n, action: () => { const l = se.lines(); l[t.line] = '>> ' + n; se.commit(l.join('\n')); } })) },
        { label: 'Odebrat opakování', danger: true, action: () => se.deleteLines() }, ...common];
      case 'section': return [
        { label: 'Upravit název', hint: 'psaní', action: () => se.startEdit(t, 'end') },
        { label: 'Kdo zpívá celou sekci', items: singerItems },
        { label: 'Smazat nadpis', danger: true, action: () => se.deleteLines() }, ...common];
      case 'note': return [{ label: 'Upravit text', hint: 'psaní', action: () => se.startEdit(t, 'end') }, del, ...common];
      default: return [
        { label: 'Upravit text', hint: 'psaní', action: () => se.startEdit(t, 'end') },
        { label: 'Kdo zpívá', hint: '← →', items: singerItems },
        { label: 'Písmo řádku', items: formatItems },
        del, ...common];
    }
  }

  /* Nová sekce: u vybraného řádku, nebo přesně z označených řádků (za nimi pokračuje původní sekce) */
  async addSection() {
    const se = this.se;
    // kurzor na novém prázdném řádku (po Enteru): sekce začne právě tady
    const blank = se.editing && se.editEl && !se.editEl.textContent.replace(/\u200b/g, '').trim() ? se.editing.line : null;
    se.finishEdit(true);
    const sel = se.selTargets().filter(t => t.kind !== 'repeat');
    if (blank == null && !sel.length) return toast('Nejdřív klikni na řádek nebo označ řádky tažením myší.', 'warn');
    const verses = parseSong(this.src).blocks.filter(b => b.type === 'section' && /^sloka/i.test(b.text)).length;
    const r = await pickSection(verses + 1);
    if (!r) return;
    const ls = se.lines();
    if (blank != null && blank < ls.length && !ls[blank].trim()) {
      const head = formatSectionLine({ name: r.name, count: r.count, color: '', singers: [] });
      se.curKey = null; se.curLine = blank;
      if (sectionKind(r.name) === 'instr') { ls[blank] = head; se.commit(ls.join('\n')); return; }
      ls.splice(blank, 1, head, '');   // pod nadpisem se rovnou píše text sekce
      se.commit(ls.join('\n'));
      se.editing = { line: blank + 1, caret: 'start' };
      se.render();
      return;
    }
    let first = Math.min(...sel.map(t => t.line));
    const last = Math.max(...sel.map(t => se.afterTarget(t) - 1));
    const instr = sectionKind(r.name) === 'instr';
    const head = formatSectionLine({ name: r.name, count: r.count, color: '', singers: [] });
    if (!instr && sel.length > 1) {
      // za označenými řádky pokračuje sekce, do které patřily (když za nimi ještě něco je)
      let prev = -1;
      for (let i = first - 1; i >= 0; i--) if (ls[i].trim().startsWith('##')) { prev = i; break; }
      let next = last + 1;
      while (next < ls.length && ls[next].trim() === '') next++;
      const more = next < ls.length && !ls[next].trim().startsWith('##');
      if (more && prev >= 0 && sectionKind(parseSectionLine(ls[prev]).name) !== 'instr') ls.splice(last + 1, 0, formatSectionLine(Object.assign(parseSectionLine(ls[prev]), { count: 0 })));
    }
    ls.splice(first, 0, head);
    // původní nadpis těsně nad novou sekcí by zůstal prázdný – pryč (pokračování za označením ho nese dál)
    let above = first - 1;
    while (above >= 0 && ls[above].trim() === '') above--;
    if (!instr && sel.length > 1 && above >= 0 && ls[above].trim().startsWith('##') && sectionKind(parseSectionLine(ls[above]).name) !== 'instr') { ls.splice(above, 1); first--; }
    se.curKey = null; se.curLine = first;
    se.commit(ls.join('\n'));
  }
  insertRepeat(anchor) {
    const secs = [...new Set(parseSong(this.src).blocks.filter(b => b.type === 'section' && !b.repeat).map(b => b.text))];
    if (!secs.length) return toast('Nejdřív napiš sekci (např. Refrén), kterou chceš opakovat.', 'warn');
    popupMenu(anchor, secs.map(name => ({ label: '↻ ' + name, action: () => this.se.insertLines(['>> ' + name]) })));
  }
  async sourceDialog() {
    this.se.finishEdit(true);
    const ta = h('textarea', { class: 'inp src-ta', spellcheck: 'false' }, this.src);
    const ok = await modal({ title: 'Zdrojový text se značkami', wide: true,
      body: h('div', {}, h('p', { class: 'help' }, 'Pro pokročilé. Značky jsou popsané v nápovědě (?). Běžně stačí upravovat přímo na stránce.'), ta),
      buttons: [{ label: 'Zrušit', value: false }, { label: 'Použít', primary: true, value: true }] });
    if (!ok) return;
    this.se.curKey = null;
    this.se.commit(ta.value.replace(/\r\n?/g, '\n'));
  }

  fontPopover(anchor) {
    $$('.menu').forEach(m => m.remove());
    const song = this.collect();
    const st = Object.assign({}, song.style || {});
    const base = Store.template(this.inTpl.value || Settings.get('defaultTemplate'));
    const apply = () => {
      const clean = {};
      for (const [k, v] of Object.entries(st)) if (v !== '' && v != null && !(k === 'sizePct' && +v === 100)) clean[k] = v;
      this.style = Object.keys(clean).length ? clean : null;
      this.paintFont();
      this.markDirty(); this.se.pushHist(); this.schedulePreview();
    };
    const f = (label, el) => h('label', { class: 'f' }, h('span', {}, label), el);
    const fontSel = h('select', { class: 'inp' }, h('option', { value: '' }, `dle šablony (${base.fontFamily})`), FONTS.map(x => h('option', { value: x, selected: st.fontFamily === x }, x)));
    fontSel.onchange = () => { st.fontFamily = fontSel.value; apply(); };
    const sizeLbl = numField(st.sizePct || 100, { dec: 0, min: 30, max: 300 }, v => { st.sizePct = v; size.value = v; apply(); });
    const size = h('input', { type: 'range', min: 50, max: 200, step: 5, value: st.sizePct || 100 });
    size.oninput = () => { st.sizePct = +size.value; sizeLbl.setValue(+size.value); apply(); };
    const wSel = h('select', { class: 'inp' }, [['', 'dle šablony'], [400, 'normální'], [600, 'polotučné'], [700, 'tučné'], [900, 'extra tučné']].map(([v, l]) => h('option', { value: v, selected: String(st.fontWeight || '') === String(v) }, l)));
    wSel.onchange = () => { st.fontWeight = wSel.value ? +wSel.value : ''; apply(); };
    const lhSel = h('select', { class: 'inp' }, [['', 'dle šablony'], [1.05, 'těsné'], [1.2, 'normální'], [1.4, 'volnější'], [1.6, 'volné']].map(([v, l]) => h('option', { value: v, selected: String(st.lineHeight || '') === String(v) }, l)));
    lhSel.onchange = () => { st.lineHeight = lhSel.value ? +lhSel.value : ''; apply(); };
    const alSel = h('select', { class: 'inp' }, [['', 'dle šablony'], ['left', 'vlevo'], ['center', 'na střed'], ['right', 'vpravo']].map(([v, l]) => h('option', { value: v, selected: (st.align || '') === v }, l)));
    alSel.onchange = () => { st.align = alSel.value; apply(); };
    const m = h('div', { class: 'menu menu-form' },
      h('div', { class: 'menu-head' }, 'Písmo jen pro tuto píseň'),
      f('Font', fontSel),
      h('label', { class: 'f' }, h('span', {}, 'Velikost: ', sizeLbl, ` % (šablona ${base.fontSize} px)`), size),
      h('div', { class: 'grid2' }, f('Tloušťka', wSel), f('Řádkování', lhSel)),
      f('Zarovnání', alSel),
      h('div', { class: 'row', style: { marginTop: '6px' } },
        h('button', { class: 'btn small nogrow', onclick: () => { for (const k of Object.keys(st)) delete st[k]; apply(); m.remove(); } }, 'Zpět na šablonu'),
        h('span', { class: 'help' }, 'Pro všechny písně najednou se písmo nastavuje v Šablonách.')));
    placePopover(m, anchor);
  }

  /* Označení zpěváků jen pro tuto píseň (jinak platí šablona): tabulka zpěváci × proužek vlevo / vpravo, podklad, písmo */
  singerPopover(anchor) {
    $$('.menu').forEach(m => m.remove());
    const base = Store.template(this.inTpl.value || Settings.get('defaultTemplate'));
    const own = () => JSON.parse(JSON.stringify((this.style && this.style.singer) || {}));
    const eff = (code, k) => { const o = own()[code]; return o && typeof o[k] === 'boolean' ? o[k] : singerShowOf(base, code)[k]; };
    const apply = sg => {
      for (const c of Object.keys(sg)) if (!sg[c] || typeof sg[c] !== 'object' || !Object.keys(sg[c]).length) delete sg[c];
      const st = Object.assign({}, this.style || {});
      if (Object.keys(sg).length) st.singer = sg; else delete st.singer;
      this.style = Object.keys(st).length ? st : null;
      this.markDirty(); this.se.pushHist(); this.se.render(); paint();
    };
    const tbl = singerShowTable(eff, (code, k, v) => {
      const sg = own();
      const o = sg[code] && typeof sg[code] === 'object' ? sg[code] : {};
      if (v === singerShowOf(base, code)[k]) delete o[k]; else o[k] = v;   // stejné jako šablona = bez výjimky
      sg[code] = o;
      apply(sg);
    }, (() => {
      const ops = singerListOps(() => this.singers(), list => this.setSongSingers(list), 'z této písně', (code, color) => {
        const btn = this.sgButtons[this.singers().findIndex(s => s.code === code)];
        if (btn) btn.style.setProperty('--c', color);
      });
      return { color: (...a) => { ops.color(...a); paint(); }, add: async () => { if (await ops.add()) this.singerPopover(anchor); }, remove: async sg => { if (await ops.remove(sg)) this.singerPopover(anchor); } };
    })(), this.singers());
    const reset = h('button', { class: 'btn small nogrow', style: { alignSelf: 'flex-start' }, title: 'Zrušit nastavení zpěváků jen pro tuto píseň – zpěváci i jejich označení podle šablony', onclick: () => {
      if (this.style) { const st = Object.assign({}, this.style); delete st.singers; delete st.barWidth; this.style = st; }
      apply({}); this.makeSingerBtns(); this.singerPopover(anchor);
    } }, 'Vrátit výchozí');
    // šířka proužku zpěváka (jen pro tuto píseň)
    const bwF = TPL_FIELDS.find(x => x.k === 'barWidth');
    const bwVal = numField(this.lookTpl().barWidth, { dec: 0, min: bwF.min, max: bwF.max }, v => { this.setSong('barWidth', v); paint(); });
    const bwStep = d => { const f = TPL_FIELDS.find(x => x.k === 'barWidth'); this.setSong('barWidth', Math.max(f.min, Math.min(f.max, this.lookTpl().barWidth + d))); paint(); };
    const bw = h('div', { class: 'pg-row' }, h('span', { class: 'pg-l' }, 'Šířka proužku'),
      h('div', { class: 'pg-step' },
        h('button', { class: 'tl tl-step', onmousedown: e => e.preventDefault(), onclick: () => bwStep(-1) }, '−'), h('label', { class: 'pg-num' }, bwVal, h('span', {}, 'px')),
        h('button', { class: 'tl tl-step', onmousedown: e => e.preventDefault(), onclick: () => bwStep(1) }, '+')));
    const paint = () => {
      tbl.repaint();
      bwVal.setValue(this.lookTpl().barWidth);
      bw.classList.toggle('own', !!(this.style && this.style.barWidth !== undefined));
      reset.style.display = Object.keys(own()).length || (this.style && (this.style.singers || this.style.barWidth !== undefined)) ? '' : 'none';
    };
    paint();
    const m = h('div', { class: 'menu menu-form menu-singer menu-page' }, h('div', { class: 'menu-head' }, 'Označení zpěváků v této písni'), tbl, bw, reset);
    placePopover(m, anchor);
  }

  async cleanDialog() {
    const o = { chords: 'remove', detectSections: true, trimSpaces: true, collapseBlank: true };
    const chordOpt = (v, l) => h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'cl-chords', checked: o.chords === v, onchange: () => { o.chords = v; } }), l);
    const box = h('div', {},
      h('p', { class: 'help' }, 'Upraví celý text písně. Vrátit jde přes Ctrl+Z nebo ↶.'),
      h('h3', {}, 'Akordy, tabulatury a poznámky pro nástroje'),
      chordOpt('remove', 'Odstranit'),
      chordOpt('none', 'Nechat beze změny'),
      h('h3', {}, 'Další úpravy'),
      ...[['detectSections', 'Rozpoznat sloky a refrény (1., R:, Ref., [Chorus]…)'],
        ['trimSpaces', 'Sjednotit mezery a odstranit tabulátory'], ['collapseBlank', 'Sloučit více prázdných řádků']]
        .map(([k, l]) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: true, onchange: e => { o[k] = e.target.checked; } }), l)));
    const ok = await modal({ title: '🧹 Vyčistit text', body: box, buttons: [{ label: 'Zrušit', value: false }, { label: 'Vyčistit', value: true, primary: true }] });
    if (!ok) return;
    this.se.finishEdit(true);
    this.se.commit(cleanText(this.src, o));
    toast('Text vyčištěn (Ctrl+Z vrátí zpět)', 'ok');
  }

  /* ----- Akce ----- */
  exportTxt() {
    const s = this.collect();
    const head = [`# ${s.title}`, s.artist ? `# ${s.artist}` : ''].filter(Boolean).join('\n');
    downloadFile(safeFileName(s.title) + '.txt', head + '\n\n' + s.text, 'text/plain');
  }
  async del() {
    const s = Store.songs.get(this.id);
    const inPl = [...Store.playlists.values()].filter(p => p.items.includes(this.id));
    const ok = await confirmDlg(`Opravdu smazat píseň „${s.title}“?` + (inPl.length ? ` Odebere se i z ${inPl.length} playlistu/ů.` : ''), 'Smazat', true);
    if (!ok) return;
    this.dirty = false;
    for (const p of inPl) { p.items = p.items.filter(x => x !== this.id); await Store.put('playlists', p); }
    await Store.remove('songs', this.id);
    location.hash = '#/songs';
  }
  openReader() {
    this.se.finishEdit(true);
    location.hash = '#/reader/song:' + this.id;   // s neuloženými změnami se App zeptá
  }
}

/* Číselné pole, do kterého jde kliknout a napsat hodnotu (Enter / odchod potvrdí, Esc vrátí).
   o.pct = zobrazit v % (×100), o.dec = desetinná místa, o.min / o.max = rozsah */
function numField(v, o, onSet) {
  // scale: zobrazená hodnota = uložená × scale (o.pct = ×100; o.scale může být i funkce, např. velikost písma pro px)
  const sc = () => typeof o.scale === 'function' ? o.scale() : o.scale || (o.pct ? 100 : 1);
  const show = x => String(+(+x * sc()).toFixed(o.dec != null ? o.dec : 2)).replace('.', ',');
  const inp = h('input', { class: 'num-in', type: 'text', inputmode: 'decimal', value: show(v) });
  const commit = () => {
    const n = parseFloat(inp.value.replace(',', '.'));
    if (isNaN(n)) { inp.value = show(v); return; }
    let x = n / sc();
    if (o.min != null) x = Math.max(o.min, x);
    if (o.max != null) x = Math.min(o.max, x);
    inp.value = show(x);
    if (x !== +v) { v = x; onSet(x); }
  };
  inp.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); commit(); inp.blur(); }
    else if (e.key === 'Escape') { e.preventDefault(); inp.value = show(v); inp.blur(); }
  });
  inp.addEventListener('change', commit);
  inp.addEventListener('focus', () => inp.select());
  inp.setValue = x => { v = x; inp.value = show(x); };
  return inp;
}

/* ===== Sdílené pomocníky pro UI ===== */
/* Plovoucí nabídka u tlačítka: vejde se do okna (když se pod tlačítko nevejde, otevře se nad ním)
   a zavře se kliknutím mimo */
function placePopover(m, anchor) {
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect(), mh = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = (r.bottom + mh + 8 > innerHeight && r.top - mh - 4 >= 8 ? r.top - mh - 4 : Math.max(8, Math.min(r.bottom + 4, innerHeight - mh - 8))) + 'px';
  // klik mimo zavře; druhý klik na tlačítko, které nabídku otevřelo, ji jen zavře (neotevře znovu)
  setTimeout(() => document.addEventListener('mousedown', function off(e) {
    if (m.isConnected && m.contains(e.target)) return;
    document.removeEventListener('mousedown', off);
    if (!m.isConnected) return;
    m.remove();
    if (anchor.contains(e.target)) swallowClick(anchor);
  }), 0);
}
/* následující klik na prvek se nepošle dál (tlačítko po zavření své nabídky ji neotevře znovu) */
function swallowClick(el) {
  const stop = e => { document.removeEventListener('click', stop, true); if (el.contains(e.target)) { e.stopPropagation(); e.preventDefault(); } };
  document.addEventListener('click', stop, true);
  setTimeout(() => document.removeEventListener('click', stop, true), 1000);
}

/* items: { label, action, hint (klávesa vpravo), danger } nebo { sep: true } = oddělovač */
function popupMenu(anchor, items) {
  $$('.menu').forEach(m => m.remove());
  const m = h('div', { class: 'menu' }, items.map(it => it.sep ? h('hr', { class: 'menu-sep' })
    : h('div', { class: it.danger ? 'danger' : '', onclick: () => { m.remove(); it.action(); } }, it.label, it.hint ? h('kbd', {}, it.hint) : null)));
  m.addEventListener('mousedown', e => e.preventDefault());   // klik do nabídky nebere fokus (stránka editoru dál reaguje na klávesy)
  placePopover(m, anchor);
}

function addToPlaylistMenu(anchor, songIds) {
  const items = Store.sortedPlaylists().map(p => ({ label: `${p.name} (${p.items.length})`, action: async () => {
    p.items.push(...songIds.filter(id => !p.items.includes(id)));
    await Store.put('playlists', p);
    toast(`Přidáno do „${p.name}“`, 'ok');
  } }));
  items.unshift({ label: '＋ Nový playlist…', action: async () => {
    const name = await promptDlg('Název nového playlistu', playlistNameHint());
    if (!name) return;
    const p = await Store.put('playlists', newPlaylist(name, [...songIds]));
    toast(`Vytvořen playlist „${p.name}“`, 'ok');
  } });
  popupMenu(anchor, items);
}

const SECTION_TYPES = ['Sloka', 'Refrén', 'Mezičást', 'Předehra', 'Mezihra', 'Sólo'];
/* čipy typů sekcí (s textem / pokyn pro kapelu) navázané na pole s názvem; onPick = hned použít */
function sectionTypeChips(inp, verseName, onPick) {
  const chips = [];
  const paint = () => chips.forEach(b => b.classList.toggle('on', inp.value.trim().toLowerCase().startsWith(b.dataset.n.toLowerCase())));
  const chip = n => {
    const b = h('button', { type: 'button', class: 'ps-chip', onclick: () => { inp.value = n === 'Sloka' ? verseName : n; paint(); if (onPick) onPick(inp.value); } }, n);
    b.dataset.n = n; chips.push(b); return b;
  };
  const g = (label, names) => h('div', { class: 'ps-g' }, h('span', {}, label), h('div', { class: 'ps-chips' }, names.map(chip)));
  const box = h('div', { class: 'ps-types' }, g('S textem', SECTION_TYPES.slice(0, 3)), g('Pokyn pro kapelu', SECTION_TYPES.slice(3)));
  inp.addEventListener('input', paint);
  paint();
  return box;
}
/* výběr nové sekce: typ / název a počet opakování */
async function pickSection(nextVerse) {
  // přehledně: druh sekce (s textem / pokyn pro kapelu), název, kolikrát se opakuje
  let count = 1;
  const inp = h('input', { class: 'inp', value: `Sloka ${nextVerse}` });
  const types = sectionTypeChips(inp, `Sloka ${nextVerse}`);
  const num = numField(1, { dec: 0, min: 1, max: 99 }, v => { count = v; });
  const step = d => { count = Math.max(1, Math.min(99, count + d)); num.setValue(count); };
  const body = h('div', { class: 'ps-dlg' },
    types,
    h('div', { class: 'ps-row' },
      h('label', { class: 'f' }, h('span', {}, 'Název'), inp),
      h('div', { class: 'f' }, h('span', {}, 'Opakování'), h('div', { class: 'pg-step' },
        h('button', { type: 'button', class: 'tl tl-step', onclick: () => step(-1) }, '−'),
        h('label', { class: 'pg-num' }, num, h('span', {}, '×')),
        h('button', { type: 'button', class: 'tl tl-step', onclick: () => step(1) }, '+')))),
    h('p', { class: 'help' }, 'Pokyn pro kapelu nemá text, ukáže se jako „8× Předehra“. U sekce s textem je počet opakování u jejího prvního řádku.'));
  const ok = await modal({ title: 'Nová sekce', body, buttons: [{ label: 'Zrušit', value: false }, { label: 'Vložit', primary: true, value: true }] });
  return ok && inp.value.trim() ? { name: inp.value.trim(), count: count > 1 ? count : 0 } : null;
}

function showMarkupHelp() {
  // Ukázka vykreslená stejně jako ve čtečce (malá, na černém pozadí)
  const sample = text => {
    const tpl = Object.assign(Store.template('default'), { fontSize: 22, padX: 14, padY: 10, singerBar: true, barWidth: 5 });
    const box = h('div', { class: 'stage help-stage' });
    Render.applyTemplate(box, tpl, 0, 0);
    box.style.width = ''; box.style.height = '';
    const map = Store.singerMap();
    for (const b of filterForView(parseSong(text).blocks)) box.appendChild(Render.blockEl(b, tpl, map));
    return box;
  };
  const sg = Store.singers();
  const s0 = sg[0] || { code: 'J', name: 'Já' }, s1 = sg[1] || { code: 'T', name: 'Ty' }, s2 = sg[2] || { code: 'V', name: 'Všichni' };
  const step = (title, how, ex) => h('div', { class: 'help-step' },
    h('div', { class: 'help-txt' }, h('h3', {}, title), ...how.map(t => h('p', {}, t))),
    ex ? h('div', { class: 'help-ex' }, ex) : null);
  const k = t => h('kbd', {}, t), b = t => h('b', {}, t);

  const body = h('div', { class: 'help-guide' },
    step('Ovládání jen šipkami (airmouse)',
      [['Uprostřed je přesně stránka čtečky a píše se přímo do ní: klikni do řádku a piš.'],
       [k('↑'), ' ', k('↓'), ' vybere řádek (na konci stránky přejde na další), ', k('←'), ' ', k('→'), ' mění, kdo řádek zpívá.'],
       [k('OK'), ' (Enter) otevře nabídku: úprava textu, písmo, vložení sekce, opakování, nové stránky… Šipkami vybereš, OK potvrdíš, ', k('←'), ' vrátí zpět.'],
       ['Stačí začít psát a upravuje se vybraný řádek. ', k('Enter'), ' = nový řádek, ', k('Esc'), ' = hotovo.']]),
    step('1. Vlož text písně',
      [['Zkopíruj text (třeba z webu), klikni na stránku a vlož ho (', k('Ctrl'), '+', k('V'), '). Aplikace ho sama uklidí: odstraní zbytečné mezery, rozpozná sloky a refrény a odstraní akordy.']]),
    step('2. Označ, kdo zpívá',
      [['Klikni do řádku a pak na zpěváka v liště nad stránkou (', b('Zpívá'), '), nebo vyber řádek šipkami a stiskni ', k('→'), '.'],
       ['Víc řádků najednou: označ je tažením myší (nebo ', k('Shift'), '+', k('↓'), ', ', k('Shift'), '+klik).'],
       ['Jen pár slov: označ je v řádku tažením myší a klikni na zpěváka.']],
      sample(`@${s0.code} Tenhle řádek zpívá ${s0.name.toLowerCase()}\n@${s1.code} tenhle ${s1.name.toLowerCase()}\n@${s0.code}+${s1.code} a tenhle oba spolu`)),
    step('3. Sloky a refrén',
      [['V levém panelu ', b('Struktura'), ' › ', b('＋ Sekce'), ' vloží nadpis (Sloka 1, Refrén, Předehra…) – u vybraného řádku, nebo přesně pro řádky označené tažením.'],
       ['Refrén napiš jen jednou. Na další místa ho vložíš tlačítkem ', b('↻'), ' ve Struktuře – ve čtečce se vypíše celý.']],
      sample(`## Refrén @${s2.code}\nRefrén zpívají všichni\n\n## Sloka 2\n@${s1.code} Druhá sloka`)),
    step('4. Zvýraznění',
      [['V liště nad stránkou: ', b('B'), ' tučně, ', b('I'), ' kurzíva, ', b('−'), ' ', b('+'), ' u velikosti písma menší a větší o 2 px, mezi nimi jde velikost v px napsat – pro označená slova, nebo celý vybraný řádek.'],
       ['Pravé tlačítko na řádku › ', b('Vložit'), ' › ', b('Poznámku pod'), ' přidá malou poznámku (např. „2× a konec“).']],
      sample(`Normální, **tučně**, *kurzívou* a {130%:větší}\n// 2× a konec`)),
    h('div', { class: 'help-tips' },
      h('h3', {}, 'Dobré vědět'),
      h('ul', {},
        h('li', {}, 'Změny se ukládají tlačítkem ', b('Uložit'), ' (nebo ', k('Ctrl'), '+', k('S'), '). Při odchodu s neuloženými změnami se aplikace zeptá: uložit, uložit jako, zahodit, nebo zůstat.'),
        h('li', {}, 'Krok zpět: ', k('Ctrl'), '+', k('Z'), '.'),
        h('li', {}, 'Zpěváky, jejich barvy a označení i vzhled stránky upravíš v ', b('Šablonách'), ' (pro jednu píseň v editoru přes ikonu u zpěváků).'))),
    h('details', { class: 'help-adv' }, h('summary', {}, 'Pro pokročilé: co znamenají značky v textu'),
      h('p', { class: 'help' }, 'Tlačítka vkládají do textu tyto značky. Můžeš je psát i ručně.'),
      h('div', { class: 'cheat' }, [
        [`@${s0.code} text`, `řádek zpívá ${s0.name}`],
        [`@${s0.code}+${s1.code} text`, 'řádek zpívají dva'],
        [`{${s1.code}:slovo}`, `jen část řádku zpívá ${s1.name}`],
        ['## Refrén', 'nadpis sekce'],
        [`## Refrén @${s2.code}`, `celou sekci zpívá ${s2.name}`],
        ['>> Refrén', 'zopakovat sekci'],
        ['// text', 'poznámka'],
        ['**tučně**  *kurzíva*', 'zvýraznění'],
        ['{130%:text}', 'velikost písma v procentech'],
        ['{#ff0000:text}', 'vlastní barva písma'],
        ['---', 'nová stránka ve čtečce'],
      ].map(r => [h('code', {}, r[0]), h('span', {}, r[1])]).flat())));
  modal({ title: 'Jak psát text písně', body, wide: true, buttons: [{ label: 'Rozumím', value: true, primary: true }] });
}

async function importTxtFiles(fileList) {
  let files = fileList;
  if (!files) {
    files = await new Promise(res => {
      const inp = h('input', { type: 'file', accept: '.txt,.text,.cho,.chordpro,.json', multiple: true });
      inp.onchange = () => res([...inp.files]);
      inp.click();
    });
  }
  if (!files || !files.length) return;
  const clean = await modal({
    title: `Import ${files.length} souborů`,
    body: h('p', {}, 'Mám text při importu vyčistit (odstranit akordy, rozpoznat sloky a refrény)?'),
    buttons: [{ label: 'Zrušit', value: null }, { label: 'Ponechat beze změny', value: false }, { label: 'Vyčistit', value: true, primary: true }],
  });
  if (clean === null) return;
  let n = 0, last = null;
  for (const f of files) {
    if (/\.json$/i.test(f.name)) { await importBackup(f); continue; }
    let text = await readFileText(f);
    let title = f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
    let artist = '';
    // ChordPro {title: …} / {artist: …}
    text = text.replace(/^\{(?:title|t):\s*(.*?)\}\s*$/gim, (a, t) => { title = t; return ''; })
      .replace(/^\{(?:artist|subtitle|st):\s*(.*?)\}\s*$/gim, (a, t) => { artist = t; return ''; })
      .replace(/^\{(?:soc|start_of_chorus)\}\s*$/gim, '## Refrén').replace(/^\{(?:eoc|end_of_chorus)\}\s*$/gim, '')
      .replace(/^\{[^}]*\}\s*$/gm, '');
    // Hlavička z našeho exportu („# Název“)
    const m = /^# (.+)\n(?:# (.+)\n)?\n/.exec(text);
    if (m) { title = m[1]; artist = m[2] || artist; text = text.slice(m[0].length); }
    if (clean) text = cleanText(text);
    last = await Store.put('songs', newSong({ title, artist, text }));
    n++;
  }
  if (n) toast(`Importováno ${n} písní`, 'ok');
  if (last) location.hash = '#/songs/' + last.id;
}
