'use strict';
/* ===== Písně: seznam + editor ===== */
// Zpěváci, kteří v písni zpívají (podle značek @kód a {kód:…} v textu)
function songSingers(s) {
  const sm = Store.singerMap(), codes = new Set();
  for (const m of String(s.text || '').matchAll(/(?:^|\n)\s*(?:##[^\n@]*)?@([A-Za-z0-9+]+)|\{([A-Za-z0-9+]+):/g)) parseCodes(m[1] || m[2]).forEach(c => codes.add(c));
  return [...codes].filter(c => sm[c]).map(c => sm[c]);
}
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
        h('div', { class: 'sl-row sl-cols' }, h('span', {}, 'Interpret'), h('span', {}, 'Název'), h('span', {}, 'Ladění · BPM'), h('span', {}, 'Zpívá'), h('span', {}, 'Štítky')),
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
      const songs = Store.sortedSongs(sortSel.value).filter(s => !q || normalizeForSearch([s.title, s.artist, (s.tags || []).join(' '), s.text].join(' ')).includes(q));
      for (const s of songs) {
        list.appendChild(h('div', { class: 'item sl-row', 'data-id': s.id, title: 'Klik = náhled, dvojklik = upravit',
          onclick: () => isMobile() ? (location.hash = '#/songs/' + s.id) : select(s.id),
          ondblclick: () => { location.hash = '#/songs/' + s.id; } },
          h('span', { class: 'sl-artist' }, s.artist || '—'),
          h('b', { class: 'sl-title' }, s.title || '(bez názvu)'),
          h('span', { class: 'sl-key' }, s.key ? keyBadge(s.key) : null, s.key && s.tempo ? ' · ' : '', s.tempo ? s.tempo + ' BPM' : ''),
          h('span', { class: 'sl-dots' }, songSingers(s).map(g => h('i', { title: g.name, style: { background: g.color } }))),
          h('span', { class: 'sl-tags' }, (s.tags || []).map(t => h('span', { class: 'tag' }, t)))));
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
    const tool = (label, title, onclick, cls = '') => h('button', { class: 'tl ' + cls, title, onclick }, label);
    const menuTool = (label, title, items, cls = '') => tool(label, title, e => popupMenu(e.currentTarget, items(e.currentTarget)), cls);
    const f = (label, el, cls = '') => h('label', { class: 'f ' + cls }, h('span', {}, label), el);

    this.inTitle = h('input', { class: 'inp ep-title', value: song.title || '', placeholder: 'Název písně' });
    this.inArtist = h('input', { class: 'inp', value: song.artist || '', placeholder: 'Interpret / autor' });
    this.inKey = h('input', { class: 'inp', value: song.key || '', placeholder: 'C, Am…' });
    this.inTempo = h('input', { class: 'inp', value: song.tempo || '', placeholder: '120' });
    this.inDur = h('input', { class: 'inp', value: song.duration || '', placeholder: '3:45' });
    this.inTags = h('input', { class: 'inp', value: (song.tags || []).join(', '), placeholder: 'rock, pomalá…' });
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
    this.sgButtons = Store.singers().map((s, i) => h('button', { class: 'sw', style: { '--c': s.color }, title: `${s.name} – zapnout / vypnout (Alt+${i + 1}, na stránce ← →)`,
      onclick: () => this.se.toggleSinger(s.code) }, h('span', { class: 'sw-c' }), h('span', { class: 'sw-n' }, s.name)));

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
      h('div', { class: 'ep-group ep-meta' }, h('div', { class: 'ep-lbl' }, 'Údaje'),
        f('Interpret', this.inArtist),
        f('Název písně', this.inTitle),
        h('div', { class: 'ep-row3' }, f('Ladění', this.inKey), f('BPM', this.inTempo), f('Délka', this.inDur)),
        f('Štítky', this.inTags),
        f('Šablona', this.inTpl)),
      h('div', { class: 'ep-group' }, h('div', { class: 'ep-lbl ep-lbl-row' }, h('span', {}, 'Struktura'),
        h('button', { class: 'btn small nogrow', title: 'Nová sekce u vybraného řádku – označené řádky (tažením myší) budou celá sekce', onclick: () => this.addSection() }, '＋ Sekce'),
        h('button', { class: 'btn small nogrow', title: 'Zopakovat sekci (např. refrén) u vybraného řádku – ve čtečce se vypíše celá', onclick: e => this.insertRepeat(e.currentTarget) }, '↻')),
        this.structBox),
      h('div', { class: 'ep-group' }, h('div', { class: 'ep-lbl' }, 'Moje poznámky'),
        this.privNote = h('textarea', { class: 'inp ep-priv', rows: 2, placeholder: 'Vidíš jen ty na tomto zařízení. Ukážou se nahoře na stránce.' }, PrivateNotes.get(song.id))));

    // Lišta nad stránkou: vše pro vybraný řádek
    const sep = () => h('span', { class: 'tl-sep' });
    this.musBtn = menuTool('Muzikanti ▾', 'Akordy a poznámky pro nástroje – ve čtečce se nikdy nezobrazí', btn => {
      const on = !!(Settings.get('musView') || {}).on;
      return [
        { label: on ? 'Skrýt akordy a poznámky' : 'Ukázat akordy a poznámky', action: () => this.setView(!on) },
        on ? { label: 'Které vrstvy ukázat…', action: () => layersPopover(btn, () => this.se.render()) } : null,
        { sep: true },
        ...this.musItems()].filter(Boolean);
    }, 'ed-mus');
    // lišta: nástroje uprostřed nad stránkou, Muzikanti vždy vpravo
    this.tools = h('div', { class: 'ed-tools' }, h('span'), h('div', { class: 'ed-tools-mid' },
      h('div', { class: 'tl-grp sw-row', title: 'Kdo zpívá vybraný řádek (všichni vypnutí = nikdo)' }, ...this.sgButtons,
        tool([ic('sliders'), ic('down', 'caret')], 'Označení zpěváků: proužek vlevo / vpravo, podklad, barva písma – jen pro tuto píseň', e => this.singerPopover(e.currentTarget), 'tl-sgshow')),
      sep(),
      this.fontSel = h('select', { class: 'tl tl-font', title: 'Písmo této písně (bez výběru platí písmo šablony; další volby v ⋯ › Písmo této písně…)', onchange: () => this.setFont(this.fontSel.value) }),
      h('div', { class: 'tl-grp seg-row' },
        tool(h('b', {}, 'B'), 'Tučně (Ctrl+B) – označená slova, nebo celý řádek', () => this.se.format('bold')),
        tool(h('i', {}, 'I'), 'Kurzíva (Ctrl+I)', () => this.se.format('italic')),
        tool('A−', 'Menší písmo (o 2 px)', () => this.stepSize(-2)),
        this.sizeBox = h('label', { class: 'tl tl-size', title: 'Velikost písma označených slov nebo řádku v px na zvolené obrazovce – napiš a potvrď Enterem' },
          this.sizeInp = h('input', { type: 'text', inputmode: 'numeric', maxlength: 3, value: '' }), 'px'),
        tool('A+', 'Větší písmo (o 2 px)', () => this.stepSize(2)),
        menuTool('Aa ▾', 'Velká / malá písmena', () => [
          { label: 'VELKÁ PÍSMENA', action: () => this.se.format('upper') },
          { label: 'malá písmena', action: () => this.se.format('lower') }])),
      h('div', { class: 'tl-grp seg-row' },
        tool('↕−', 'Menší řádkování (o 0,05)', () => this.stepLh(-0.05)),
        this.lhBox = h('label', { class: 'tl tl-size tl-lh', title: 'Řádkování řádku s kurzorem (nebo označených řádků) – výška řádku × písmo; napiš a potvrď Enterem, prázdné = podle písně' },
          h('span', { class: 'tl-lh-ic' }, '↕'), this.lhInp = h('input', { type: 'text', inputmode: 'decimal', maxlength: 4, value: '' })),
        tool('↕+', 'Větší řádkování (o 0,05)', () => this.stepLh(0.05))),
      sep(),
      sep(),
      h('div', { class: 'tl-grp' },
        tool('↶', 'Zpět (Ctrl+Z)', () => this.se.undo(-1)),
        tool('↷', 'Znovu (Ctrl+Y)', () => this.se.undo(1))),
      ),
      this.musBtn);

    this.stageWrap = h('div', { class: 'se-wrap' });
    this.scrSel = h('select', { class: 'inp ed-screen', title: 'Pro kterou obrazovku kapely ukázat stránku – každá má svůj rozměr, konce stránek a obsah' },
      Screens.list().map(sc => h('option', { value: sc.id, selected: sc.id === this.screenId }, Screens.label(sc) + (sc.id === Screens.myId() ? ' (toto zařízení)' : ''))));
    this.scrSel.onchange = () => {
      this.screenId = this.scrSel.value; Settings.set('editScreen', this.screenId);
      this.structKey = null; this.se.followCur = true; this.se.render(); this.stageWrap.focus({ preventScroll: true });
    };
    // Pravý panel pod lištou: stránkování, náhled (obrazovka, playlist), dole uložení a čtečka
    const sgrp = (label, ...kids) => h('div', { class: 'ep-group' }, h('div', { class: 'ep-lbl' }, label), ...kids);
    this.pager = h('div', { class: 'ed-side' },
      sgrp('Stránka',
        h('div', { class: 'ed-pages' },
          h('button', { class: 'tl', title: 'Předchozí stránka (PgUp)', onclick: () => this.se.turnPage(-1) }, '‹'),
          this.pageLbl,
          h('button', { class: 'tl', title: 'Další stránka (PgDn)', onclick: () => this.se.turnPage(1) }, '›')),
        h('button', { class: 'btn small ed-break', title: 'Na zvolené obrazovce začít od vybraného řádku novou stránku (ostatní obrazovky stránkují samy)', onclick: () => this.se.insertLines([this.breakLine()], { before: true }) }, '＋ Nová stránka od řádku')),
      sgrp('Náhled',
        h('label', { class: 'f' }, h('span', {}, 'Obrazovka'), this.scrSel),
        h('label', { class: 'f' }, h('span', {}, 'Jako v playlistu'), this.inPl)),
      h('div', { class: 'grow' }),
      h('div', { class: 'ed-save' }, this.savedInd, h('div', { class: 'ed-save-row' }, this.saveBtn, moreBtn), readerBtn));
    const ed = h('div', { class: 'song-editor' },
      h('div', { class: 'ed-body' }, this.leftPanel,
        h('div', { class: 'ed-center' }, this.tools, h('div', { class: 'ed-main' }, this.stageWrap, this.pager))));
    this.root.innerHTML = '';
    this.root.appendChild(ed);

    const onMeta = () => { this.markDirty(); this.schedulePreview(); };
    this.privNote.addEventListener('input', () => { PrivateNotes.set(this.id, this.privNote.value); this.schedulePreview(); });
    [this.inTitle, this.inArtist, this.inKey, this.inTempo, this.inDur, this.inTags].forEach(i => i.addEventListener('input', onMeta));
    this.inTpl.addEventListener('change', onMeta);
    this.inTpl.addEventListener('change', () => this.paintFont());
    this.paintFont();
    this.inPl.addEventListener('change', () => this.se.render());
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
    this.pageLbl.textContent = `${this.se.page + 1}/${n}` + (lay.k < 0.999 ? ` · ${Math.round(lay.k * 100)} %` : '');
    this.pageLbl.title = lay.k < 0.999 ? 'Dlouhá píseň je zmenšená, aby se vešla na stránku' : '';
  }
  onSelChange() {
    if (!this.se) return;
    if (this.se.lay) this.onStageRender(this.se.lay);
    this.paintStruct();
    this.paintSingers();
    this.paintSize();
    this.paintLh();
  }
  /* písmo písně v liště: „podle šablony“ nebo vlastní (ukládá se do písně jako u Písmo této písně…) */
  paintFont() {
    if (!this.fontSel) return;
    const base = Store.template(this.inTpl.value || Settings.get('defaultTemplate'));
    const cur = (this.style && this.style.fontFamily) || '';
    this.fontSel.replaceChildren(h('option', { value: '' }, base.fontFamily + ' (šablona)'),
      ...FONTS.map(f => h('option', { value: f, style: { fontFamily: `"${f}"` } }, f)));
    this.fontSel.value = cur;
    this.fontSel.style.fontFamily = `"${cur || base.fontFamily}", sans-serif`;
  }
  setFont(f) {
    const st = Object.assign({}, this.style || {});
    if (f) st.fontFamily = f; else delete st.fontFamily;
    this.style = Object.keys(st).length ? st : null;
    this.markDirty(); this.se.render(); this.paintFont();
    this.stageWrap.focus({ preventScroll: true });
  }
  /* Velikost písma v px na zvolené obrazovce. Ukládá se poměrem k písmu řádku ze šablony
     ({130%:…}), takže na jiné obrazovce i po změně šablony zůstane ve stejném poměru. */
  paintSize() {
    if (!this.sizeInp || !this.se || document.activeElement === this.sizeInp) return;
    if (!this.sizeInp.isConnected) { document.removeEventListener('selectionchange', this.onDocSel); return; }
    const p = this.se.sizeAt(), base = this.se.linePx();
    this.sizeInp.value = base ? String(Math.round(base * p / 100)) : '';
    this.sizeBox.classList.toggle('on', p !== 100);
    this.sizeBox.title = 'Velikost písma v px na obrazovce „' + this.screen().name + '“' + (p !== 100 ? ` (${p} % písma řádku)` : ' (podle šablony)') + ' – napiš a potvrď Enterem';
  }
  /* zapnutí zpěváci: u slov v barvě zpěváka ten zpěvák, jinak zpěváci řádku */
  paintSingers() {
    const se = this.se, t = se.cur();
    let own = t ? se.singersOf(t).own : [];
    const host = se.editEl && selSingerHost(window.getSelection(), se.editEl);
    if (host) own = parseCodes(host.dataset.c);
    this.sgButtons.forEach((b, i) => b.classList.toggle('on', own.includes((Store.singers()[i] || {}).code)));
  }
  /* řádkování řádku s kurzorem: vlastní, jinak písně / šablony (šedě) */
  paintLh() {
    if (!this.lhInp || !this.se || document.activeElement === this.lhInp) return;
    const own = this.se.lineLh(), def = this.lookTpl().lineHeight;
    this.lhInp.value = String(own != null ? own : Math.round(def * 100) / 100);
    this.lhBox.classList.toggle('on', own != null);
  }
  setLh(v) {
    const def = this.lookTpl().lineHeight;
    this.se.format('lh', !v || Math.abs(v - def) < 0.005 ? '' : String(Math.round(Math.max(0.8, Math.min(3, v)) * 100) / 100));
    this.paintLh();
  }
  stepLh(d) {
    const own = this.se.lineLh();
    this.setLh((own != null ? own : this.lookTpl().lineHeight) + d);
  }
  setSizePx(px) {
    const base = this.se.linePx();
    if (base) this.se.format('size', szClamp(px / base * 100));
  }
  stepSize(d) {
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
    const sm = Store.singerMap(), tpl = this.lookTpl();
    const items = [];
    this.src.split('\n').forEach((l, i) => {
      const t = l.trim();
      let m;
      if (breakScreen(t) !== null) { if (breakScreen(t) === this.screenId) items.push({ line: i, brk: true }); }
      else if (t.startsWith('##')) {
        const sec = parseSectionLine(t), kind = sectionKind(sec.name), c = sec.singers[0];
        const color = sec.color || (kind === 'instr' ? tpl.instrColor : tpl.textBy === 'section' && kind ? tpl[kind + 'Color'] : '') || (c && sm[c] ? sm[c].color : '');
        items.push({ line: i, name: sec.name || 'Sekce', count: sec.count, color, instr: kind === 'instr' });
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
        if (idxs.length) { se.select(idxs[0]); if (idxs.length > 1) se.select(idxs[idxs.length - 1], true); }
        else { let idx = se.targets.findIndex(t => t.line >= it.line); se.select(idx < 0 ? se.targets.length - 1 : idx); }
        this.stageWrap.focus({ preventScroll: true });
      };
      const menu = e => { e.stopPropagation(); e.preventDefault(); this.sectionMenu(e.currentTarget, it); };
      this.structBox.appendChild(h('div', { class: 'st-item' + (it.line === curLine ? ' on' : '') + (it.rep ? ' rep' : '') + (it.instr ? ' instr' : ''), title: 'Přejít na sekci (pravé tlačítko = úpravy)',
        onclick: go, oncontextmenu: menu },
      h('i', { style: it.color ? { background: it.color } : {} }), h('span', { class: 'st-n' }, it.name),
      it.count > 1 ? h('b', { class: 'st-cnt' }, it.count + '×') : null,
      h('button', { class: 'st-more', title: 'Upravit sekci: název, typ, opakování, barva, smazat', onclick: menu }, '⋯')));
    }
  }
  /* úpravy sekce z panelu Struktura */
  sectionMenu(anchor, it) {
    const ls = () => this.se.lines();
    const setHeader = fn => { const l = ls(); l[it.line] = formatSectionLine(fn(parseSectionLine(l[it.line]))); this.se.commit(l.join('\n')); };
    if (it.rep) return popupMenu(anchor, [{ label: 'Smazat opakování', danger: true, action: () => { const l = ls(); l.splice(it.line, 1); this.se.commit(l.join('\n')); } }]);
    const verses = parseSong(this.src).blocks.filter(b => b.type === 'section' && /^sloka/i.test(b.text)).length;
    popupMenu(anchor, [
      { label: 'Přejmenovat…', action: async () => { const n = await promptDlg('Název sekce', it.name); if (n) setHeader(o => Object.assign(o, { name: n })); } },
      { sep: true },
      ...SECTION_TYPES.map(t => ({ label: 'Typ: ' + t, action: () => setHeader(o => Object.assign(o, { name: t === 'Sloka' ? 'Sloka ' + (verses + 1) : t })) })),
      { sep: true },
      { label: 'Opakování…', hint: it.count > 1 ? it.count + '×' : '1×', action: async () => {
        const v = await promptDlg('Kolikrát se sekce opakuje (1 = bez označení)', String(it.count || 1));
        if (v != null && v !== '') setHeader(o => Object.assign(o, { count: Math.max(0, Math.min(99, parseInt(v, 10) || 0)) }));
      } },
      { label: 'Barva písma…', action: () => this.sectionColor(anchor, it, setHeader) },
      { label: 'Zopakovat tuto sekci u vybraného řádku', action: () => this.se.insertLines(['>> ' + it.name]) },
      { sep: true },
      { label: 'Smazat sekci (text zůstane)', danger: true, action: () => { const l = ls(); l.splice(it.line, 1); this.se.commit(l.join('\n')); } }]);
  }
  sectionColor(anchor, it, setHeader) {
    $$('.menu').forEach(m => m.remove());
    const sec = parseSectionLine(this.se.lines()[it.line]);
    const tpl = this.lookTpl(), kind = sectionKind(sec.name);
    const def = (kind === 'instr' ? tpl.instrColor : tpl[kind + 'Color']) || tpl.textColor || '#ffffff';
    const c = h('input', { type: 'color', value: sec.color || def });
    c.onchange = () => setHeader(o => Object.assign(o, { color: c.value.toLowerCase() }));
    const m = h('div', { class: 'menu menu-form' }, h('div', { class: 'menu-head' }, 'Barva písma sekce „' + sec.name + '“'),
      h('label', { class: 'chk' }, c, 'Vlastní barva'),
      h('div', { class: 'help' }, 'Zpěvák, který má v označení zpěváků zapnuté „Písmo“, má přednost.'),
      h('button', { class: 'btn small nogrow', onclick: () => { setHeader(o => Object.assign(o, { color: '' })); m.remove(); } }, 'Podle šablony'));
    placePopover(m, anchor);
  }
  focusMeta() { this.inArtist.focus(); this.inArtist.select(); }
  schedulePreview() { clearTimeout(this.pvT); this.pvT = setTimeout(() => { if (!this.se.editing) this.se.render(); }, 250); }
  changed() { this.markDirty(); }

  setView(on) {
    const mv = Object.assign({}, Settings.get('musView'), { on });
    Settings.set('musView', mv);
    if (this.se.editing) this.se.editing.caret = this.se.caretOffset();
    this.se.render();
  }
  /* ----- Ukládání ----- */
  collect() {
    const old = Store.songs.get(this.id) || {};
    return Object.assign({}, old, {
      id: this.id,
      title: this.inTitle.value.trim() || 'Bez názvu',
      artist: this.inArtist.value.trim(),
      key: this.inKey.value.trim(),
      tempo: this.inTempo.value.trim(),
      duration: this.inDur.value.trim(),
      tags: this.inTags.value.split(',').map(t => t.trim()).filter(Boolean),
      templateId: this.inTpl.value,
      text: this.src,
      style: this.style === undefined ? (old.style || null) : this.style,
    });
  }
  // „neuloženo“ = jiný stav než při posledním uložení (úprava tam a zpět nic nemění)
  snap() {
    const o = this.collect();
    return JSON.stringify([o.title, o.artist, o.key, o.tempo, o.duration, o.tags, o.templateId, o.text, o.style || null]);
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
      ...Store.singers().map(s => ({ label: s.name, color: s.color, active: se.singersOf(t).own.includes(s.code), action: () => se.assignSinger(s.code, 'force') })),
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
    const musItems = () => this.musItems();
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
        { label: (Settings.get('musView') || {}).on ? 'Ukázat jako čtečka' : 'Ukázat pro muzikanty', action: () => this.setView(!(Settings.get('musView') || {}).on) },
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
      case 'musblock': return [{ label: 'Upravit blok…', action: () => this.editBlock(t) }, del, ...common];
      case 'section': return [
        { label: 'Upravit název', hint: 'psaní', action: () => se.startEdit(t, 'end') },
        { label: 'Kdo zpívá celou sekci', items: singerItems },
        { label: 'Smazat nadpis', danger: true, action: () => se.deleteLines() }, ...common];
      case 'note': case 'mus': return [{ label: 'Upravit text', hint: 'psaní', action: () => se.startEdit(t, 'end') }, del, ...common];
      default: return [
        { label: 'Upravit text', hint: 'psaní', action: () => se.startEdit(t, 'end') },
        { label: 'Kdo zpívá', hint: '← →', items: singerItems },
        { label: 'Písmo řádku', items: formatItems },
        { label: 'Pro muzikanty', items: musItems },
        del, ...common];
    }
  }

  /* Nová sekce: u vybraného řádku, nebo přesně z označených řádků (za nimi pokračuje původní sekce) */
  async addSection() {
    const se = this.se;
    se.finishEdit(true);
    const sel = se.selTargets().filter(t => t.kind !== 'repeat');
    if (!sel.length) return toast('Nejdřív klikni na řádek nebo označ řádky tažením myší.', 'warn');
    const verses = parseSong(this.src).blocks.filter(b => b.type === 'section' && /^sloka/i.test(b.text)).length;
    const r = await pickSection(verses + 1);
    if (!r) return;
    const ls = se.lines();
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
  musItems() {
    const items = [{ label: 'Akord na místo kurzoru…', action: () => this.askChord() }];
    for (const ins of Store.instruments()) {
      items.push({ label: `${ins.name} – poznámka (ladění, rytmus…)`, action: () => this.addMus(ins.code, [`%${ins.code} `], true) });
      items.push({ label: `${ins.name} – tabulatura / blok`, action: () => this.addMus(ins.code, [`%%${ins.code} Tabulatura`, 'e|-----------------|', 'B|-----------------|', 'G|-----------------|', 'D|-----------------|', 'A|-----------------|', 'E|-----------------|', '%%'], false) });
    }
    return items;
  }
  /* informace pro muzikanty jsou vidět jen v pohledu „Pro muzikanty“ – přepnout a zapnout vrstvu */
  showMusLayer(code) {
    const mv = musDefaults();
    mv.on = true;
    if (code) mv.inst[code] = true; else mv.chords = true;
    Settings.set('musView', mv);
    this.se.render();
  }
  addMus(code, lines, edit) {
    this.showMusLayer(code);
    this.se.insertLines(lines, { before: true, edit });
  }
  async askChord() {
    const se = this.se;
    const caret = se.editing ? se.caretOffset() : null;
    const name = await promptDlg('Akord (např. Am, C, G7)', '');
    if (!name) return;
    if (se.editing) { se.editing.caret = caret; se.render(); }
    se.insertChord(name.trim());
    this.showMusLayer(null);
    if (se.editing) se.editing.caret = se.caretOffset();
    se.render();
  }
  async editBlock(t) {
    const ls = this.se.lines();
    let j = t.line + 1;
    while (j < ls.length && ls[j].trim() !== '%%') j++;
    const m = RE_MUSBLOCK.exec(ls[t.line].trim());
    const title = h('input', { class: 'inp', value: (m && m[2]) || '' });
    const ta = h('textarea', { class: 'inp mono', rows: 10, style: { fontFamily: 'var(--mono)', whiteSpace: 'pre' } }, ls.slice(t.line + 1, j).join('\n'));
    const ok = await modal({ title: 'Blok pro muzikanty', body: h('div', {}, h('label', { class: 'f' }, h('span', {}, 'Nadpis'), title), h('label', { class: 'f' }, h('span', {}, 'Obsah (tabulatura, akordy…)'), ta)),
      buttons: [{ label: 'Zrušit', value: false }, { label: 'Uložit', primary: true, value: true }] });
    if (!ok) return;
    const body = ta.value.replace(/\n+$/, '').split('\n');
    ls.splice(t.line, j - t.line + 1, '%%' + ((m && m[1]) || '') + (title.value.trim() ? ' ' + title.value.trim() : ''), ...body, '%%');
    this.se.commit(ls.join('\n'));
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
      this.markDirty(); this.schedulePreview();
    };
    const f = (label, el) => h('label', { class: 'f' }, h('span', {}, label), el);
    const fontSel = h('select', { class: 'inp' }, h('option', { value: '' }, `dle šablony (${base.fontFamily})`), FONTS.map(x => h('option', { value: x, selected: st.fontFamily === x }, x)));
    fontSel.onchange = () => { st.fontFamily = fontSel.value; apply(); };
    const sizeLbl = h('b', {}, (st.sizePct || 100) + ' %');
    const size = h('input', { type: 'range', min: 50, max: 200, step: 5, value: st.sizePct || 100 });
    size.oninput = () => { st.sizePct = +size.value; sizeLbl.textContent = size.value + ' %'; apply(); };
    const wSel = h('select', { class: 'inp' }, [['', 'dle šablony'], [400, 'normální'], [600, 'polotučné'], [700, 'tučné'], [900, 'extra tučné']].map(([v, l]) => h('option', { value: v, selected: String(st.fontWeight || '') === String(v) }, l)));
    wSel.onchange = () => { st.fontWeight = wSel.value ? +wSel.value : ''; apply(); };
    const lhSel = h('select', { class: 'inp' }, [['', 'dle šablony'], [1.05, 'těsné'], [1.2, 'normální'], [1.4, 'volnější'], [1.6, 'volné']].map(([v, l]) => h('option', { value: v, selected: String(st.lineHeight || '') === String(v) }, l)));
    lhSel.onchange = () => { st.lineHeight = lhSel.value ? +lhSel.value : ''; apply(); };
    const alSel = h('select', { class: 'inp' }, [['', 'dle šablony'], ['left', 'vlevo'], ['center', 'na střed'], ['right', 'vpravo']].map(([v, l]) => h('option', { value: v, selected: (st.align || '') === v }, l)));
    alSel.onchange = () => { st.align = alSel.value; apply(); };
    const m = h('div', { class: 'menu menu-form' },
      h('div', { class: 'menu-head' }, 'Písmo jen pro tuto píseň'),
      f('Font', fontSel),
      h('label', { class: 'f' }, h('span', {}, 'Velikost: ', sizeLbl, ` (šablona ${base.fontSize} px)`), size),
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
      this.markDirty(); this.se.render(); paint();
    };
    const tbl = singerShowTable(eff, (code, k, v) => {
      const sg = own();
      const o = sg[code] && typeof sg[code] === 'object' ? sg[code] : {};
      if (v === singerShowOf(base, code)[k]) delete o[k]; else o[k] = v;   // stejné jako šablona = bez výjimky
      sg[code] = o;
      apply(sg);
    });
    const note = h('div', { class: 'help' });
    const reset = h('button', { class: 'btn small nogrow', onclick: () => apply({}) }, 'Podle šablony');
    const paint = () => {
      tbl.repaint();
      const n = Object.keys(own()).length;
      note.textContent = n ? 'Jen pro tuto píseň – šablona „' + base.name + '“ má jiné nastavení.' : 'Podle šablony „' + base.name + '“.';
      reset.style.display = n ? '' : 'none';
    };
    paint();
    const m = h('div', { class: 'menu menu-form menu-singer' }, h('div', { class: 'menu-head' }, 'Označení zpěváků v této písni'), tbl, note, reset);
    placePopover(m, anchor);
  }

  async cleanDialog() {
    const o = { chords: 'keep', detectSections: true, trimSpaces: true, collapseBlank: true };
    const chordOpt = (v, l) => h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'cl-chords', checked: o.chords === v, onchange: () => { o.chords = v; } }), l);
    const box = h('div', {},
      h('p', { class: 'help' }, 'Upraví celý text písně. Vrátit jde přes Ctrl+Z nebo ↶.'),
      h('h3', {}, 'Akordy nad textem'),
      chordOpt('keep', 'Převést pro muzikanty – akordy nad slovy, ve čtečce se nezobrazí'),
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

/* ===== Vrstvy pro muzikanty (náhled a tisk) ===== */
function musDefaults() {
  const mv = Object.assign({ on: false, chords: true, inst: {} }, Settings.get('musView') || {});
  // poprvé: všechny nástroje zapnuté
  for (const i of Store.instruments()) if (!(i.code in mv.inst)) mv.inst[i.code] = true;
  return mv;
}
function musViewOpts() { const mv = musDefaults(); return mv.on ? { chords: mv.chords, inst: mv.inst } : null; }

function layersPopover(anchor, onChange) {
  $$('.menu').forEach(m => m.remove());
  const mv = musDefaults();
  const save = () => { Settings.set('musView', mv); onChange && onChange(); };
  const row = (label, color, checked, set) => h('label', { class: 'chk menu-chk' },
    h('input', { type: 'checkbox', checked, onchange: e => { set(e.target.checked); save(); } }),
    h('span', { class: 'led', style: { background: color } }), label);
  const m = h('div', { class: 'menu menu-layers' },
    h('div', { class: 'menu-head' }, 'Ukázat pro muzikanty'),
    row('Akordy', CHORD_COLOR, mv.chords, v => { mv.chords = v; }),
    ...Store.instruments().map(i => row(i.name, i.color, !!mv.inst[i.code], v => { mv.inst[i.code] = v; })));
  placePopover(m, anchor);
}

/* ===== Sdílené pomocníky pro UI ===== */
/* Plovoucí nabídka u tlačítka: vejde se do okna (když se pod tlačítko nevejde, otevře se nad ním)
   a zavře se kliknutím mimo */
function placePopover(m, anchor) {
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect(), mh = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = (r.bottom + mh + 8 > innerHeight && r.top - mh - 4 >= 8 ? r.top - mh - 4 : Math.max(8, Math.min(r.bottom + 4, innerHeight - mh - 8))) + 'px';
  setTimeout(() => document.addEventListener('mousedown', function off(e) { if (!m.contains(e.target) && e.target !== anchor) { m.remove(); document.removeEventListener('mousedown', off); } }), 0);
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

const SECTION_TYPES = ['Sloka', 'Refrén', 'Předrefrén', 'Mezičást', 'Předehra', 'Mezihra', 'Sólo', 'Dohra'];
/* výběr nové sekce: typ / název a počet opakování */
async function pickSection(nextVerse) {
  const inp = h('input', { class: 'inp', value: `Sloka ${nextVerse}` });
  const cnt = h('input', { class: 'inp', type: 'number', min: 1, max: 99, value: 1, style: { width: '90px' } });
  const body = h('div', {}, h('div', { class: 'row', style: { marginBottom: '10px', flexWrap: 'wrap', gap: '6px' } },
    SECTION_TYPES.map(n => h('button', { class: 'btn small nogrow', onclick: () => { inp.value = n === 'Sloka' ? `Sloka ${nextVerse}` : n; inp.focus(); } }, n))),
    h('label', { class: 'f' }, h('span', {}, 'Název'), inp),
    h('label', { class: 'f' }, h('span', {}, 'Kolikrát se opakuje'), cnt),
    h('p', { class: 'help' }, 'Předehra, mezihra a sólo jsou pokyny bez textu – na stránce se ukážou vždy (např. „8× PŘEDEHRA“). U ostatních sekcí se počet opakování ukáže před prvním řádkem.'));
  const ok = await modal({ title: 'Nová sekce', body, buttons: [{ label: 'Zrušit', value: false }, { label: 'Vložit', primary: true, value: true }] });
  return ok && inp.value.trim() ? { name: inp.value.trim(), count: Math.max(0, parseInt(cnt.value, 10) || 0) } : null;
}

function showMarkupHelp() {
  // Ukázka vykreslená stejně jako ve čtečce (malá, na černém pozadí)
  const sample = (text, mus) => {
    const tpl = Object.assign(Store.template('default'), { fontSize: 22, padX: 14, padY: 10, singerBar: true, barWidth: 5 });
    const box = h('div', { class: 'stage help-stage' });
    Render.applyTemplate(box, tpl, 0, 0);
    box.style.width = ''; box.style.height = '';
    const map = Store.singerMap();
    for (const b of filterForView(parseSong(text).blocks, mus || null)) box.appendChild(Render.blockEl(b, tpl, map));
    return box;
  };
  const sg = Store.singers(), ins = Store.instruments();
  const s0 = sg[0] || { code: 'J', name: 'Já' }, s1 = sg[1] || { code: 'T', name: 'Ty' }, s2 = sg[2] || { code: 'V', name: 'Všichni' };
  const i0 = ins[0] || { code: 'G', name: 'Kytara' };
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
      [['Zkopíruj text (třeba z webu), klikni na stránku a vlož ho (', k('Ctrl'), '+', k('V'), '). Aplikace ho sama uklidí: odstraní zbytečné mezery, rozpozná sloky a refrény a akordy schová pro muzikanty.']]),
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
      [['V liště nad stránkou: ', b('B'), ' tučně, ', b('I'), ' kurzíva, ', b('A−'), ' ', b('A+'), ' menší a větší o 2 px, mezi nimi jde velikost v px napsat – pro označená slova, nebo celý vybraný řádek.'],
       ['Pravé tlačítko na řádku › ', b('Vložit'), ' › ', b('Poznámku pod'), ' přidá malou poznámku (např. „2× a konec“).']],
      sample(`Normální, **tučně**, *kurzívou* a {130%:větší}\n// 2× a konec`)),
    step('5. Pro muzikanty',
      [['Akordy, ladění nebo tabulatury přidáš tlačítkem ', b('Pro muzikanty'), '. ', b('Ve čtečce se nikdy nezobrazí'), ' – uvidíš je jen po přepnutí na „Pro muzikanty“ a v tisku.']],
      sample(`%${i0.code} Capo 2\n[G]Zpívám [D]ptákům`, { chords: true, inst: { [i0.code]: true } })),
    h('div', { class: 'help-tips' },
      h('h3', {}, 'Dobré vědět'),
      h('ul', {},
        h('li', {}, 'Změny se ukládají tlačítkem ', b('Uložit'), ' (nebo ', k('Ctrl'), '+', k('S'), '). Při odchodu s neuloženými změnami se aplikace zeptá: uložit, uložit jako, zahodit, nebo zůstat.'),
        h('li', {}, 'Krok zpět: ', k('Ctrl'), '+', k('Z'), '.'),
        h('li', {}, 'Zpěváky a jejich barvy upravíš v záložce ', b('Obsazení'), ', vzhled stránky v ', b('Šablonách'), '.'))),
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
        ['[Am]slovo', 'akord nad slovem (jen pro muzikanty)'],
        [`%${i0.code} text`, `poznámka pro nástroj ${i0.name} (jen pro muzikanty)`],
        [`%%${i0.code} … %%`, 'blok, např. tabulatura (jen pro muzikanty)'],
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
