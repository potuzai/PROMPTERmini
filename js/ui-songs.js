'use strict';
/* ===== Písně: seznam + editor ===== */
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
        h('div', { class: 'sl-row sl-cols' }, h('span', {}, 'Interpret'), h('span', {}, 'Název'), h('span', {}, 'Tónina · tempo'), h('span', {}, 'Zpívá'), h('span', {}, 'Štítky')),
        list, count),
      prev));
    const narrow = () => matchMedia('(max-width: 820px)').matches;
    const sm = Store.singerMap();
    const singersIn = s => {
      const codes = new Set();
      for (const m of String(s.text || '').matchAll(/(?:^|\n)\s*(?:##[^\n@]*)?@([A-Za-z0-9+]+)|\{([A-Za-z0-9+]+):/g)) parseCodes(m[1] || m[2]).forEach(c => codes.add(c));
      return [...codes].filter(c => sm[c]).map(c => sm[c]);
    };
    const paintPrev = s => {
      prev.innerHTML = '';
      if (!s) { prev.appendChild(h('div', { class: 'help pl-prev-empty' }, 'Klikni na píseň a tady uvidíš její náhled.')); return; }
      const pls = [...Store.playlists.values()].filter(p => p.items.includes(s.id));
      const box = h('div', { class: 'mini-page' });
      prev.append(
        h('div', { class: 'pl-prev-head' },
          h('h3', {}, s.title || '(bez názvu)'),
          h('div', { class: 'pl-prev-meta' }, [s.artist, s.key, s.tempo ? s.tempo + ' BPM' : ''].filter(Boolean).join(' · ') || ' ')),
        h('div', { class: 'pl-prev-btns two' },
          h('button', { class: 'btn primary', onclick: () => { location.hash = '#/songs/' + s.id; } }, '✎ Upravit'),
          h('button', { class: 'btn', onclick: () => { location.hash = '#/reader/song:' + s.id; } }, '▶ Čtečka')),
        box,
        h('div', { class: 'ep-lbl' }, 'V playlistech'),
        pls.length ? h('div', { class: 'chips' }, pls.map(p => h('button', { class: 'chip', onclick: () => { location.hash = '#/playlists/' + p.id; } }, `${p.name} · ${p.items.indexOf(s.id) + 1}.`)))
          : h('div', { class: 'help' }, 'Zatím v žádném playlistu.'));
      miniPage(box, s);
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
          onclick: () => narrow() ? (location.hash = '#/songs/' + s.id) : select(s.id),
          ondblclick: () => { location.hash = '#/songs/' + s.id; } },
          h('span', { class: 'sl-artist' }, s.artist || '—'),
          h('b', { class: 'sl-title' }, s.title || '(bez názvu)'),
          h('span', { class: 'sl-key' }, [s.key, s.tempo ? s.tempo + ' BPM' : ''].filter(Boolean).join(' · ')),
          h('span', { class: 'sl-dots' }, singersIn(s).map(g => h('i', { title: g.name, style: { background: g.color } }))),
          h('span', { class: 'sl-tags' }, (s.tags || []).map(t => h('span', { class: 'tag' }, t)))));
      }
      if (!songs.length) list.appendChild(h('div', { class: 'help', style: { padding: '16px 22px' } }, q ? 'Nic nenalezeno.' : 'Zatím žádné písně. Vytvoř novou nebo importuj .txt soubory.'));
      count.textContent = q ? `${songs.length} z ${Store.songs.size} písní` : 'Klik = náhled · dvojklik = upravit · Enter = upravit';
      total.textContent = `${Store.songs.size} ${Store.songs.size === 1 ? 'píseň' : Store.songs.size >= 2 && Store.songs.size <= 4 ? 'písně' : 'písní'}`;
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
    const song = await Store.put('songs', { id: uid(), title: title || 'Nová píseň', artist: '', key: '', tempo: '', tags: [], note: '', templateId: '', text: '' });
    location.hash = '#/songs/' + song.id;
    setTimeout(() => { const w = $('.se-wrap'); if (w) w.focus(); toast('Vlož text písně (Ctrl+V) – automaticky se vyčistí.'); }, 100);
  },
};

class SongEditor {
  constructor(root, song) {
    this.root = root;
    this.id = song.id;
    this.base = song.updatedAt;
    this.dirty = false;
    this.src = song.text || '';
    this.style = song.style || null;
    // náhled pro obrazovku: naposledy zvolená v tomto zařízení, jinak vlastní obrazovka zařízení
    this.screenId = Screens.get(Settings.get('editScreen') || (Screens.myId() === 'auto' ? 'main' : Screens.myId())).id;
    this.build(song);
  }

  /* Rozložení: uprostřed stránka čtečky (upravuje se přímo v ní), vpravo úzký klidný panel
     jen pro vybraný řádek. Vše ostatní je pod tlačítkem „Píseň ⋯“. */
  build(song) {
    const tool = (label, title, onclick, cls = '') => h('button', { class: 'tl ' + cls, title, onclick }, label);

    this.inTitle = h('input', { class: 'ep-title', value: song.title || '', placeholder: 'Název písně', title: 'Název písně' });
    this.inArtist = h('input', { class: 'inp', value: song.artist || '', placeholder: 'Interpret / autor' });
    this.inKey = h('input', { class: 'inp', value: song.key || '', placeholder: 'C, Am…' });
    this.inTempo = h('input', { class: 'inp', value: song.tempo || '', placeholder: 'BPM' });
    this.inTags = h('input', { class: 'inp', value: (song.tags || []).join(', '), placeholder: 'rock, pomalá…' });
    this.inTpl = h('select', { class: 'inp' }, h('option', { value: '' }, '— výchozí —'),
      [...Store.templates.values()].map(t => h('option', { value: t.id, selected: t.id === song.templateId }, t.name)));
    // jak by píseň vypadala v playlistu (pořadí x/y, další píseň)
    const pls = [...Store.playlists.values()].filter(p => p.items.includes(this.id)).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    this.inPl = h('select', { class: 'inp' }, h('option', { value: '' }, '— samostatně —'),
      pls.map(p => h('option', { value: p.id }, p.name + (p.date ? ' · ' + p.date : ''))));
    if (pls.length) this.inPl.value = (pls.find(p => p.id === Settings.get('lastPlaylist')) || pls[0]).id;

    this.savedInd = h('span', { class: 'saved-ind' }, 'Uloženo');
    this.pageLbl = h('span', { class: 'page-lbl' }, '1/1');
    this.selLbl = h('div', { class: 'ep-sel' });

    this.sgButtons = Store.singers().map((s, i) => {
      const b = h('button', { class: 'sw', style: { '--c': s.color }, title: `${s.name} (Alt+${i + 1}, na stránce ← →)` },
        h('span', { class: 'sw-c' }), h('span', { class: 'sw-n' }, s.name));
      b.addEventListener('click', e => this.se.assignSinger(s.code, e.shiftKey ? 'toggle' : 'force'));
      return b;
    });
    const noneBtn = h('button', { class: 'sw none', title: 'Nikdo (Alt+0)', onclick: () => this.se.assignSinger(null, 'clear') },
      h('span', { class: 'sw-c' }, '✕'), h('span', { class: 'sw-n' }, 'nikdo'));

    const grp = (label, ...kids) => h('div', { class: 'ep-group' }, h('div', { class: 'ep-lbl' }, label), ...kids);
    this.stageWrap = h('div', { class: 'se-wrap' });
    this.musBtn = tool('Ukázat akordy', 'Ukázat na stránce akordy a poznámky pro muzikanty (ve čtečce se nikdy nezobrazí)', () => this.setView(!(Settings.get('musView') || {}).on), 'wide');
    this.layersBtn = tool('Vrstvy ▾', 'Které informace pro muzikanty ukázat', e => layersPopover(e.currentTarget, () => this.se.render()), 'wide');

    const act = (label, key, title, onclick, cls = '') => h('button', { class: 'tl wide act ' + cls, title, onclick }, h('span', { class: 'act-l' }, label), key ? h('kbd', {}, key) : null);
    this.structBox = h('div', { class: 'ep-struct' });
    this.metaBtn = h('button', { class: 'ed-meta', title: 'Interpret, tónina, tempo, štítky, šablona (klikni pro úpravu)', onclick: () => this.metaDialog() });

    // Horní řádek: zpět, název, údaje, uložení, čtečka
    this.head = h('div', { class: 'ed-top' },
      h('button', { class: 'ep-back', title: 'Zpět na seznam písní', onclick: () => { location.hash = '#/songs'; } }, '◀ Písně'),
      h('span', { class: 'ed-slash' }, '/'),
      this.inTitle, this.metaBtn,
      h('span', { class: 'grow' }),
      this.savedInd,
      h('button', { class: 'btn', title: 'Uložit jako novou píseň pod jiným názvem', onclick: () => this.saveAs() }, 'Uložit jako…'),
      h('button', { class: 'btn primary', title: 'Otevřít ve čtečce přes celou obrazovku', onclick: () => this.openReader() }, '▶ Čtečka'));

    // Levý sloupec: struktura písně, zpěváci, celá píseň
    this.legend = h('div', { class: 'ep-legend' }, Store.singers().map((s, i) => h('div', { class: 'ep-leg', title: `Přiřadit vybraným řádkům (Alt+${i + 1})`, onclick: () => this.se.assignSinger(s.code, 'force') },
      h('i', { style: { background: s.color } }), h('span', {}, s.name), h('kbd', {}, 'Alt ' + (i + 1)))));
    this.leftPanel = h('div', { class: 'ed-panel ed-left-panel' },
      grp('Struktura', this.structBox),
      grp('Zpěváci', this.legend),
      grp('Moje poznámky', this.privNote = h('textarea', { class: 'inp ep-priv', rows: 3, placeholder: 'Vidíš jen ty na tomto zařízení. Ukážou se nahoře na stránce.' }, PrivateNotes.get(song.id))),
      grp('Celá píseň',
        h('div', { class: 'tl-col' },
          tool('Písmo písně…', 'Písmo, velikost a zarovnání jen pro tuto píseň (jinak platí šablona)', e => this.fontPopover(e.currentTarget), 'wide'),
          tool('Vyčistit text…', 'Akordy, mezery, rozpoznání slok a refrénů', () => this.cleanDialog(), 'wide'),
          tool('Zdrojový text…', 'Pro pokročilé: text se značkami, jak se ukládá', () => this.sourceDialog(), 'wide'))),
      grp('Pro muzikanty',
        h('div', { class: 'tl-col' }, this.musBtn,
          tool('+ Přidat ▾', 'Akord, poznámka pro nástroj, tabulatura – ve čtečce se nezobrazí', e => this.musMenu(e.currentTarget), 'wide'),
          this.layersBtn)),
      h('div', { class: 'grow' }),
      h('div', { class: 'tl-grid2' },
        tool('Údaje…', 'Interpret, tónina, tempo, štítky, šablona, playlist', () => this.metaDialog()),
        tool('Do playlistu', 'Přidat do playlistu', e => addToPlaylistMenu(e.currentTarget, [this.id])),
        tool('Uložit', 'Uložit hned (Ctrl+S) – jinak se ukládá samo', () => this.save(true)),
        tool('Další ▾', 'Export, smazání písně', e => popupMenu(e.currentTarget, [
          { label: 'Export .txt', action: () => this.exportTxt() },
          { label: 'Smazat píseň', action: () => this.del() }]))));

    // Pravý sloupec: vybraný řádek
    this.panel = h('div', { class: 'ed-panel ed-right-panel' },
      this.selLbl,
      grp('Zpívá', h('div', { class: 'sw-row' }, ...this.sgButtons, noneBtn)),
      grp('Písmo',
        h('div', { class: 'tl-row seg-row' },
          tool(h('b', {}, 'B'), 'Tučně (Ctrl+B) – označená slova, nebo celý řádek', () => this.se.format('bold')),
          tool(h('i', {}, 'I'), 'Kurzíva (Ctrl+I)', () => this.se.format('italic')),
          tool('A−', 'Menší písmo', () => this.se.format('smaller')),
          tool('A+', 'Větší písmo', () => this.se.format('bigger'))),
        h('div', { class: 'tl-grid2' },
          tool('VELKÁ', 'Velká písmena', () => this.se.format('upper')),
          tool('malá', 'Malá písmena', () => this.se.format('lower')))),
      grp('Vložit',
        h('div', { class: 'act-list' },
          act('+ Řádek', 'Enter', 'Nový řádek pod vybraný', () => this.se.startEdit(null, 'end')),
          act('+ Sekce', '', 'Nadpis sloky, refrénu… nad vybraný řádek', () => this.insertSection()),
          act('Opakovat ▾', '', 'Zopakovat refrén nebo jinou sekci', e => this.insertRepeat(e.currentTarget)),
          act('Nová stránka', '', 'Na zvolené obrazovce začít od vybraného řádku novou stránku (ostatní obrazovky stránkují samy)', () => this.se.insertLines([this.breakLine()], { before: true })),
          act('Poznámka', '', 'Poznámka malým písmem pod vybraný řádek', () => this.se.insertLines(['// '], { edit: true })),
          act('+ Mezera', '', 'Mezera mezi slokami pod vybraný řádek', () => this.se.insertLines(['', ''])),
          act('Vložit text…', 'Ctrl V', 'Vložit text ze schránky – vloží se pod vybraný řádek', () => this.pasteDialog()))),
      grp('Řádek',
        h('div', { class: 'act-list' },
          act('✎ Upravit text', 'F2', 'Psát ve vybraném řádku (nebo prostě začni psát)', () => this.se.startEdit(this.se.cur(), 'end')),
          act('↑ Nahoru', 'Alt ↑', 'Posunout vybrané řádky nahoru', () => this.se.moveLines(-1)),
          act('↓ Dolů', 'Alt ↓', 'Posunout vybrané řádky dolů', () => this.se.moveLines(1)),
          act('Smazat', 'Del', 'Smazat vybrané řádky', () => this.se.deleteLines(), 'danger'))),
      h('div', { class: 'tl-grid2' },
        tool('↶ Zpět', 'Vrátit poslední změnu (Ctrl+Z)', () => this.se.undo(-1)),
        tool('↷ Znovu', 'Znovu provést (Ctrl+Y)', () => this.se.undo(1))),
      h('div', { class: 'grow' }),
      h('div', { class: 'ep-hint' }, '↑↓ řádek · ←→ zpěvák · OK nabídka'),
      tool('? Nápověda', 'Jak psát a ovládat editor', () => showMarkupHelp(), 'wide quiet'));

    this.scrSel = h('select', { class: 'inp ed-screen', title: 'Pro kterou obrazovku kapely ukázat stránku – každá má svůj rozměr, konce stránek a obsah' },
      Screens.list().map(sc => h('option', { value: sc.id, selected: sc.id === this.screenId }, Screens.label(sc) + (sc.id === Screens.myId() ? ' (toto zařízení)' : ''))));
    this.scrSel.onchange = () => {
      this.screenId = this.scrSel.value; Settings.set('editScreen', this.screenId);
      this.structKey = null; this.se.followCur = true; this.se.render(); this.stageWrap.focus({ preventScroll: true });
    };
    this.pager = h('div', { class: 'ed-pager' },
      h('label', { class: 'ed-scr' }, h('span', {}, 'Náhled pro'), this.scrSel),
      h('button', { class: 'ep-pg', title: 'Předchozí stránka (PgUp)', onclick: () => this.se.turnPage(-1) }, '‹'),
      h('span', {}, 'strana ', this.pageLbl),
      h('button', { class: 'ep-pg', title: 'Další stránka (PgDn)', onclick: () => this.se.turnPage(1) }, '›'));
    const ed = h('div', { class: 'song-editor' }, this.head,
      h('div', { class: 'ed-body' }, this.leftPanel, h('div', { class: 'ed-center' }, this.stageWrap, this.pager), this.panel));
    this.root.innerHTML = '';
    this.root.appendChild(ed);

    const onMeta = () => { this.markDirty(); this.schedulePreview(); this.paintMeta(); };
    this.paintMeta();
    this.privNote.addEventListener('input', () => { PrivateNotes.set(this.id, this.privNote.value); this.schedulePreview(); });
    [this.inTitle, this.inArtist, this.inKey, this.inTempo, this.inTags].forEach(i => i.addEventListener('input', onMeta));
    this.inTpl.addEventListener('change', onMeta);
    this.inPl.addEventListener('change', () => this.se.render());
    this.inTitle.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); this.stageWrap.focus(); } });
    // tlačítka panelů nesmí vzít stránce výběr ani kurzor
    const keep = e => { if (e.target.closest('button') && this.stageWrap.contains(document.activeElement)) e.preventDefault(); };
    this.panel.addEventListener('mousedown', keep);
    this.leftPanel.addEventListener('mousedown', keep);
    this.head.addEventListener('mousedown', keep);

    this.se = new StageEditor(this.stageWrap, this);
    this.ro = new ResizeObserver(() => this.se.fit());
    this.ro.observe(this.stageWrap);
    this.paintViewSeg();
    this.se.render();
    if (this.se.targets.length) this.se.select(0);
    setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) this.stageWrap.focus({ preventScroll: true }); }, 0);
  }

  /* Uložit jako novou píseň (jiný název) */
  async saveAs() {
    this.se.finishEdit(true);
    const title = await promptDlg('Uložit jako novou píseň – název', this.inTitle.value.trim() + ' (2)');
    if (!title) return;
    await this.save();
    const s = clone(this.collect());
    s.id = uid(); s.title = title;
    delete s.sample;
    await Store.put('songs', s);
    toast('Uloženo jako „' + title + '“', 'ok');
    location.hash = '#/songs/' + s.id;
  }
  /* Vložit text ze schránky (pro airmouse bez Ctrl+V: okno s polem) */
  async pasteDialog() {
    let t = '';
    try { t = await navigator.clipboard.readText(); } catch (e) { /* bez přístupu ke schránce */ }
    const ta = h('textarea', { class: 'inp src-ta', style: { height: '40vh' }, placeholder: 'Sem vlož text písně (Ctrl+V)…' }, t || '');
    const ok = await modal({ title: 'Vložit text', body: h('div', {}, h('p', { class: 'help' }, 'Text se vloží pod vybraný řádek (do prázdné písně celý). ' + (Settings.get('pasteClean') !== false ? 'Akordy, mezery a sloky se automaticky uklidí.' : '')), ta),
      buttons: [{ label: 'Zrušit', value: false }, { label: 'Vložit', primary: true, value: true }] });
    if (!ok || !ta.value.trim()) return;
    const clean = Settings.get('pasteClean') !== false ? cleanText(ta.value) : ta.value.replace(/\r\n?/g, '\n');
    this.se.insertText(clean);
  }

  async metaDialog() {
    const f = (label, el) => h('label', { class: 'f' }, h('span', {}, label), el);
    const box = h('div', { class: 'meta-dlg' },
      f('Interpret', this.inArtist),
      h('div', { class: 'grid2' }, f('Tónina', this.inKey), f('Tempo (BPM)', this.inTempo)),
      f('Štítky (oddělené čárkou)', this.inTags),
      f('Šablona písně', this.inTpl),
      f('Ukázat jako v playlistu', this.inPl),
      h('p', { class: 'help' }, 'Podle playlistu se na stránce ukáže pořadí (např. 2/12) a další píseň – přesně jako ve čtečce.'));
    await modal({ title: 'Údaje o písni', body: box, buttons: [{ label: 'Hotovo', primary: true, value: true }] });
    this.se.render();
    this.stageWrap.focus({ preventScroll: true });
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
    const t = this.se.cur();
    if (this.se.lay) this.onStageRender(this.se.lay);
    const n = this.se.selTargets().length;
    this.selLbl.textContent = !t ? 'Klikni na řádek na stránce' : n > 1 ? `Vybráno řádků: ${n}` : this.se.describe(t);
    const own = t ? this.se.singersOf(t).own : [];
    this.sgButtons.forEach((b, i) => b.classList.toggle('on', own.includes((Store.singers()[i] || {}).code)));
    this.paintStruct();
  }
  screen() { return Screens.get(this.screenId); }
  breakLine() { return this.screenId === 'main' ? '---' : '--- ' + this.screenId; }
  /* Údaje pod názvem (interpret · tónina · tempo) */
  paintMeta() {
    const t = [this.inArtist.value.trim(), this.inKey.value.trim(), this.inTempo.value.trim() ? this.inTempo.value.trim() + ' BPM' : ''].filter(Boolean).join(' · ');
    this.metaBtn.textContent = t || 'Doplnit interpreta, tóninu, tempo…';
    this.metaBtn.classList.toggle('empty', !t);
  }
  /* Struktura písně vlevo: sekce, opakování, konce stránek – klik skočí na sekci */
  paintStruct() {
    if (!this.structBox || !this.se) return;
    const sm = Store.singerMap();
    const items = [];
    this.src.split('\n').forEach((l, i) => {
      const t = l.trim();
      let m;
      if (breakScreen(t) !== null) { if (breakScreen(t) === this.screenId) items.push({ line: i, brk: true }); }
      else if (t.startsWith('##') && (m = RE_SECTION.exec(t))) {
        const c = parseCodes(m[2])[0];
        items.push({ line: i, name: m[1] || 'Sekce', color: c && sm[c] ? sm[c].color : '' });
      } else if ((m = RE_REPEAT.exec(t))) items.push({ line: i, name: '↻ ' + m[1], rep: true });
    });
    const cur = this.se.cur();
    let curLine = -1;
    if (cur) for (const it of items) if (!it.brk && it.line <= cur.line) curLine = it.line;
    const key = JSON.stringify([items, curLine]);
    if (key === this.structKey) return;
    this.structKey = key;
    this.structBox.innerHTML = '';
    if (!items.some(it => !it.brk)) { this.structBox.appendChild(h('div', { class: 'help' }, 'Bez sekcí. Sloky a refrény přidáš tlačítkem „+ Sekce“ vpravo.')); return; }
    let pg = 1;
    for (const it of items) {
      if (it.brk) { this.structBox.appendChild(h('div', { class: 'st-brk' }, h('span', {}, 'Stránka ' + (++pg)))); continue; }
      this.structBox.appendChild(h('div', { class: 'st-item' + (it.line === curLine ? ' on' : '') + (it.rep ? ' rep' : ''), title: 'Přejít na sekci',
        onclick: () => {
          this.se.finishEdit(true);
          let idx = this.se.targets.findIndex(t => t.line >= it.line);
          if (idx < 0) idx = this.se.targets.length - 1;
          this.se.select(idx);
          this.stageWrap.focus({ preventScroll: true });
        } },
      h('i', { style: it.color ? { background: it.color } : {} }), h('span', {}, it.name)));
    }
  }
  focusMeta() { this.metaDialog(); }
  schedulePreview() { clearTimeout(this.pvT); this.pvT = setTimeout(() => { if (!this.se.editing) this.se.render(); }, 250); }
  renderPreview() { this.se.render(); }
  changed() { this.markDirty(); }

  setView(on) {
    const mv = Object.assign({}, Settings.get('musView'), { on });
    Settings.set('musView', mv);
    this.paintViewSeg();
    if (this.se.editing) this.se.editing.caret = this.se.caretOffset();
    this.se.render();
  }
  paintViewSeg() {
    const on = !!(Settings.get('musView') || {}).on;
    this.musBtn.textContent = on ? '✓ Akordy jsou vidět' : 'Ukázat akordy';
    this.musBtn.classList.toggle('on', on);
    this.layersBtn.hidden = !on;
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
      tags: this.inTags.value.split(',').map(t => t.trim()).filter(Boolean),
      templateId: this.inTpl.value,
      text: this.src,
      style: this.style === undefined ? (old.style || null) : this.style,
    });
  }
  markDirty() {
    this.dirty = true;
    this.savedInd.textContent = 'Neuloženo…';
    clearTimeout(this.saveT);
    this.saveT = setTimeout(() => this.save(), 1500);
  }
  async save(manual) {
    clearTimeout(this.saveT);
    if (!this.dirty && !manual) return;
    if (!Store.songs.has(this.id)) return;
    const s = this.collect();
    this.dirty = false;
    SongsView.selfSave = true;
    await Store.put('songs', s);
    SongsView.selfSave = false;
    this.base = s.updatedAt;
    this.savedInd.textContent = 'Uloženo';
    this.savedInd.title = fmtDate(s.updatedAt);
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
      { label: 'Nadpis sekce nad…', action: () => this.insertSection() },
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

  async insertSection() {
    const n = parseSong(this.src).blocks.filter(b => b.type === 'section' && /^sloka/i.test(b.text)).length;
    const name = await pickSectionName(n + 1);
    if (!name) return;
    this.se.insertLines(['## ' + name], { before: true });
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
  musMenu(anchor) { popupMenu(anchor, this.musItems()); }
  /* informace pro muzikanty jsou vidět jen v pohledu „Pro muzikanty“ – přepnout a zapnout vrstvu */
  showMusLayer(code) {
    const mv = musDefaults();
    mv.on = true;
    if (code) mv.inst[code] = true; else mv.chords = true;
    Settings.set('musView', mv);
    this.paintViewSeg();
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
      this.markDirty(); this.schedulePreview(); this.paintFontBtn();
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
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + 'px';
    m.style.top = Math.max(8, Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8)) + 'px';
    setTimeout(() => document.addEventListener('mousedown', function off(e) { if (!m.contains(e.target) && e.target !== anchor) { m.remove(); document.removeEventListener('mousedown', off); } }), 0);
  }
  paintFontBtn() {}

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
  async duplicate() {
    await this.save();
    const s = clone(this.collect());
    s.id = uid(); s.title += ' (kopie)';
    await Store.put('songs', s);
    location.hash = '#/songs/' + s.id;
  }
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
    clearTimeout(this.saveT);
    for (const p of inPl) { p.items = p.items.filter(x => x !== this.id); await Store.put('playlists', p); }
    await Store.remove('songs', this.id);
    location.hash = '#/songs';
  }
  async openReader() {
    this.se.finishEdit(true);
    await this.save();
    App.readerSingle = this.id;
    location.hash = '#/reader/song:' + this.id;
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
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8)) + 'px';
  setTimeout(() => document.addEventListener('mousedown', function off(e) { if (!m.contains(e.target) && e.target !== anchor) { m.remove(); document.removeEventListener('mousedown', off); } }), 0);
}

/* ===== Sdílené pomocníky pro UI ===== */
function popupMenu(anchor, items) {
  $$('.menu').forEach(m => m.remove());
  const r = anchor.getBoundingClientRect();
  const m = h('div', { class: 'menu' }, items.map(it => h('div', { onclick: () => { m.remove(); it.action(); } }, it.label)));
  document.body.appendChild(m);
  const mh = m.offsetHeight;
  m.style.left = Math.min(r.left, innerWidth - m.offsetWidth - 8) + 'px';
  m.style.top = (r.bottom + mh + 8 > innerHeight ? Math.max(8, r.top - mh - 4) : r.bottom + 4) + 'px';
  setTimeout(() => document.addEventListener('mousedown', function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off); } }), 0);
}

function addToPlaylistMenu(anchor, songIds) {
  const items = Store.sortedPlaylists().map(p => ({ label: `${p.name} (${p.items.length})`, action: async () => {
    p.items.push(...songIds.filter(id => !p.items.includes(id)));
    await Store.put('playlists', p);
    toast(`Přidáno do „${p.name}“`, 'ok');
  } }));
  items.unshift({ label: '＋ Nový playlist…', action: async () => {
    const name = await promptDlg('Název nového playlistu', 'Koncert ' + new Date().toLocaleDateString('cs-CZ'));
    if (!name) return;
    const p = await Store.put('playlists', { id: uid(), name, date: new Date().toISOString().slice(0, 10), templateId: '', note: '', items: [...songIds] });
    toast(`Vytvořen playlist „${p.name}“`, 'ok');
  } });
  popupMenu(anchor, items);
}

async function pickSectionName(nextVerse) {
  const names = [`Sloka ${nextVerse}`, 'Refrén', 'Předrefrén', 'Bridge', 'Intro', 'Mezihra', 'Závěr'];
  const inp = h('input', { class: 'inp', value: names[0] });
  const body = h('div', {}, h('div', { class: 'row', style: { marginBottom: '10px', flexWrap: 'wrap' } },
    names.map(n => h('button', { class: 'btn small nogrow', onclick: () => { inp.value = n; inp.focus(); } }, n))), inp,
    h('p', { class: 'help' }, 'Tip: přidej na konec např. „@V“ a celá sekce bude označena pro všechny.'));
  return modal({ title: 'Nová sekce', body, buttons: [{ label: 'Zrušit', value: null }, { label: 'Vložit', primary: true, value: () => inp.value.trim() }] });
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
      [['Uprostřed je přesně stránka čtečky a píše se přímo do ní.'],
       [k('↑'), ' ', k('↓'), ' vybere řádek (na konci stránky přejde na další), ', k('←'), ' ', k('→'), ' mění, kdo řádek zpívá.'],
       [k('OK'), ' (Enter) otevře nabídku: úprava textu, písmo, vložení sekce, opakování, nové stránky… Šipkami vybereš, OK potvrdíš, ', k('←'), ' vrátí zpět.'],
       ['Stačí začít psát a upravuje se vybraný řádek. ', k('Enter'), ' = nový řádek, ', k('Esc'), ' = hotovo.']]),
    step('1. Vlož text písně',
      [['Zkopíruj text (třeba z webu), klikni na stránku a vlož ho (', k('Ctrl'), '+', k('V'), '). Aplikace ho sama uklidí: odstraní zbytečné mezery, rozpozná sloky a refrény a akordy schová pro muzikanty.']]),
    step('2. Označ, kdo zpívá',
      [['Vyber řádek a stiskni ', k('→'), ', nebo klikni na zpěváka v panelu vpravo (', b('Kdo zpívá'), ').'],
       ['Víc řádků najednou: ', k('Shift'), '+', k('↓'), ' nebo ', k('Shift'), '+klik.'],
       ['Jen pár slov: klikni na vybraný řádek znovu (začne psaní), označ slova a klikni na zpěváka.']],
      sample(`@${s0.code} Tenhle řádek zpívá ${s0.name.toLowerCase()}\n@${s1.code} tenhle ${s1.name.toLowerCase()}\n@${s0.code}+${s1.code} a tenhle oba spolu`)),
    step('3. Sloky a refrén',
      [['Tlačítko ', b('Sekce'), ' vloží nadpis (Sloka 1, Refrén…).'],
       ['Refrén napiš jen jednou. Na další místa ho vložíš tlačítkem ', b('Opakovat'), ' – ve čtečce se vypíše celý.']],
      sample(`## Refrén @${s2.code}\nRefrén zpívají všichni\n\n## Sloka 2\n@${s1.code} Druhá sloka`)),
    step('4. Zvýraznění',
      [['V panelu ', b('Písmo'), ': tučně, kurzíva, větší a menší – pro označená slova, nebo celý vybraný řádek.'],
       ['Tlačítko ', b('Poznámka'), ' přidá malou poznámku (např. „2× a konec“).']],
      sample(`Normální, **tučně**, *kurzívou* a {+:větší}\n// 2× a konec`)),
    step('5. Pro muzikanty',
      [['Akordy, ladění nebo tabulatury přidáš tlačítkem ', b('Pro muzikanty'), '. ', b('Ve čtečce se nikdy nezobrazí'), ' – uvidíš je jen po přepnutí na „Pro muzikanty“ a v tisku.']],
      sample(`%${i0.code} Capo 2\n[G]Zpívám [D]ptákům`, { chords: true, inst: { [i0.code]: true } })),
    h('div', { class: 'help-tips' },
      h('h3', {}, 'Dobré vědět'),
      h('ul', {},
        h('li', {}, 'Ukládá se samo. Tlačítko ', b('Uložit'), ' (nebo ', k('Ctrl'), '+', k('S'), ') jen uloží hned.'),
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
        ['{+:text}  {-:text}', 'větší / menší písmo'],
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
    last = await Store.put('songs', { id: uid(), title, artist, key: '', tempo: '', tags: [], note: '', templateId: '', text });
    n++;
  }
  if (n) toast(`Importováno ${n} písní`, 'ok');
  if (last) location.hash = '#/songs/' + last.id;
}
