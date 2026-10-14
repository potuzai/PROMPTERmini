'use strict';
/* ===== Písně: seznam + editor ===== */
const SongsView = {
  search: '',
  editor: null,

  render(main, songId) {
    const side = h('div', { class: 'side' });
    const content = h('div', { class: 'content', style: { padding: 0 } });
    main.append(h('div', { class: 'view' + (songId ? ' has-detail' : '') }, side, content));

    const searchInp = h('input', { class: 'inp', type: 'search', placeholder: 'Hledat název, interpreta, text, štítek…', value: this.search });
    const list = h('div', { class: 'list' });
    side.append(
      h('div', { class: 'side-head' },
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', onclick: () => this.create() }, '＋ Nová píseň'),
          h('button', { class: 'btn nogrow', title: 'Importovat písně z .txt souborů', onclick: () => importTxtFiles() }, '⇪ Import')),
        searchInp),
      list,
      h('div', { class: 'help', style: { padding: '6px 12px', borderTop: '1px solid var(--line)' } }, `${Store.songs.size} písní`));
    const paintList = () => {
      const q = normalizeForSearch(this.search);
      list.innerHTML = '';
      const songs = Store.sortedSongs().filter(s => !q || normalizeForSearch([s.title, s.artist, (s.tags || []).join(' '), s.text].join(' ')).includes(q));
      for (const s of songs) {
        list.appendChild(h('div', { class: 'item' + (s.id === songId ? ' active' : ''), onclick: () => { location.hash = '#/songs/' + s.id; } },
          h('div', { class: 't' }, h('b', {}, s.title || '(bez názvu)'),
            h('small', {}, [s.artist, s.key ? 'tónina ' + s.key : ''].filter(Boolean).join(' · ') || ' '),
            (s.tags || []).length ? h('small', {}, (s.tags || []).map(t => h('span', { class: 'tag' }, t))) : null)));
      }
      if (!songs.length) list.appendChild(h('div', { class: 'help', style: { padding: '12px' } }, q ? 'Nic nenalezeno.' : 'Zatím žádné písně.'));
      const act = $('.item.active', list); if (act) act.scrollIntoView({ block: 'nearest' });
    };
    searchInp.addEventListener('input', () => { this.search = searchInp.value; paintList(); });
    this.paintList = paintList;
    paintList();

    const song = songId && Store.songs.get(songId);
    if (song) this.editor = new SongEditor(content, song);
    else {
      this.editor = null;
      content.appendChild(h('div', { class: 'empty' }, h('div', { class: 'empty-ic' }, '🎵'),
        h('div', {}, 'Vyber píseň vlevo, nebo vytvoř novou.'),
        h('div', { class: 'row', style: { flex: '0 0 auto' } },
          h('button', { class: 'btn primary big', onclick: () => this.create() }, '＋ Nová píseň'),
          h('button', { class: 'btn big', onclick: () => importTxtFiles() }, '⇪ Import z .txt'))));
    }
  },

  async create() {
    const title = await promptDlg('Název nové písně', '', 'např. Holubí dům');
    if (title === null) return;
    const song = await Store.put('songs', { id: uid(), title: title || 'Nová píseň', artist: '', key: '', tempo: '', tags: [], note: '', templateId: '', text: '' });
    location.hash = '#/songs/' + song.id;
    setTimeout(() => { const ta = $('.ta'); if (ta) ta.focus(); toast('Vlož text písně (Ctrl+V) – automaticky se vyčistí.'); }, 100);
  },
};

class SongEditor {
  constructor(root, song) {
    this.root = root;
    this.id = song.id;
    this.base = song.updatedAt;
    this.page = 0;
    this.brush = null;
    this.dirty = false;
    this.build(song);
  }

  build(song) {
    const singers = Store.singers();
    const f = (label, el) => h('label', { class: 'f' }, h('span', {}, label), el);
    this.inTitle = h('input', { class: 'inp', value: song.title || '', placeholder: 'Název písně' });
    this.inArtist = h('input', { class: 'inp', value: song.artist || '', placeholder: 'Interpret / autor' });
    this.inKey = h('input', { class: 'inp', value: song.key || '', placeholder: 'C, Am…' });
    this.inTempo = h('input', { class: 'inp', value: song.tempo || '', placeholder: 'BPM' });
    this.inTags = h('input', { class: 'inp', value: (song.tags || []).join(', '), placeholder: 'rock, pomalá…' });
    this.inTpl = h('select', { class: 'inp' }, h('option', { value: '' }, '— výchozí / dle playlistu —'),
      [...Store.templates.values()].map(t => h('option', { value: t.id, selected: t.id === song.templateId }, t.name)));

    // Lišta nástrojů – pojmenované skupiny, zalamují se vcelku (přehledné i na úzkém displeji)
    this.sgButtons = singers.map((s, i) => {
      const b = h('button', { class: 'btn small sg-btn', style: { '--c': s.color }, title: `Označit vybrané řádky: ${s.name} (Alt+${i + 1}). Shift+klik = přidat k ostatním. Pak lze klikat i na řádky v náhledu.` },
        h('b', { style: { color: s.color } }, s.code), ' ', s.name);
      b.addEventListener('click', e => this.assign(s.code, e.shiftKey ? 'toggle' : 'set'));
      return b;
    });
    const group = (label, ...btns) => h('div', { class: 'tb-group' }, h('div', { class: 'tb-label' }, label), h('div', { class: 'tb-btns' }, ...btns));
    const btn = (label, title, onclick) => h('button', { class: 'btn small', title, onclick }, label);
    const tb = h('div', { class: 'toolbar' },
      group('Kdo zpívá', ...this.sgButtons,
        btn('✕ Nikdo', 'Zrušit označení zpěváka (Alt+0)', () => this.assign(null, 'clear'))),
      group('Struktura',
        btn('Sekce', 'Vložit nadpis sloky, refrénu… (zápis ## Název)', () => this.insertSection()),
        btn('Opakovat ▾', 'Zopakovat dříve napsanou sekci, např. refrén (zápis >> Název)', e => this.insertRepeat(e.currentTarget)),
        btn('Poznámka', 'Poznámka malým písmem, v šabloně jde skrýt (zápis // text)', () => this.insertLinePrefix('// ')),
        btn('⤓ Nová stránka', 'Ve čtečce začít novou stránku (zápis ---)', () => this.insertText('\n---\n'))),
      group('Formát textu',
        btn(h('b', {}, 'B'), 'Tučně (Ctrl+B)', () => this.wrapSel('**')),
        btn(h('i', {}, 'I'), 'Kurzíva (Ctrl+I)', () => this.wrapSel('*')),
        btn('Větší', 'Vybraný text větším písmem (opakovaně ještě větší)', () => this.sizeSel('+')),
        btn('Menší', 'Vybraný text menším písmem', () => this.sizeSel('-')),
        btn('Aa ▾', 'Velká / malá písmena vybraného textu', () => this.caseMenu())),
      group('Celá píseň',
        this.fontBtn = btn('Písmo ▾', 'Písmo, velikost a zarovnání jen pro tuto píseň (jinak platí šablona)', e => this.fontPopover(e.currentTarget)),
        btn('🎸 Pro muzikanty ▾', 'Akordy, ladění, tabulatury… – ve čtečce se nezobrazí', e => this.musMenu(e.currentTarget)),
        btn('🧹 Vyčistit', 'Vyčistit vložený text: akordy, mezery, sloky a refrény', () => this.cleanDialog()),
        btn('?', 'Nápověda – jak psát text písně', () => showMarkupHelp())));

    this.ta = h('textarea', { class: 'ta', spellcheck: 'false', placeholder: 'Sem vlož nebo napiš text písně…\n\nTip: označ řádky a klikni na zpěváka nahoře (nebo Alt+1, Alt+2…).' });
    this.ta.value = song.text || '';
    this.bk = h('div', { class: 'ta-back', 'aria-hidden': 'true' });
    const taWrap = h('div', { class: 'ta-wrap', style: { '--efs': Settings.get('editorFontSize') + 'px' } }, this.bk, this.ta);

    this.prevWrap = h('div', { class: 'preview-wrap', title: 'Klikni na řádek = přiřadit zvoleného zpěváka (štětec)' });
    this.pageLbl = h('span', {}, '');
    this.prevTpl = h('select', { class: 'inp', style: { width: 'auto', padding: '3px 6px' }, title: 'Šablona náhledu' });

    this.savedInd = h('span', { class: 'saved-ind' }, 'Uloženo ' + fmtDate(song.updatedAt) + (song.updatedBy ? ' · ' + song.updatedBy : ''));

    // Rozložení: vlevo údaje, nástroje a text; vpravo náhled čtečky přes celou výšku
    const ed = h('div', { class: 'song-editor' },
      h('div', { class: 'ed-left' },
        h('div', { class: 'm-bar' },
          h('button', { class: 'btn m-back', onclick: () => { location.hash = '#/songs'; } }, '◀ Písně'),
          h('button', { class: 'btn m-meta', onclick: e => { e.currentTarget.closest('.ed-left').classList.toggle('show-meta'); } }, 'Údaje o písni ▾')),
        h('div', { class: 'meta-row' }, f('Název', this.inTitle), f('Interpret', this.inArtist), f('Tónina', this.inKey), f('Tempo', this.inTempo), f('Štítky (čárkou)', this.inTags), f('Šablona písně', this.inTpl)),
        tb,
        h('div', { class: 'pane' },
          h('div', { class: 'pane-title' }, 'Text písně', this.savedInd, h('span', { class: 'grow' }),
            h('label', { class: 'chk', title: 'Při vložení (Ctrl+V) automaticky vyčistit text' }, this.chkClean = h('input', { type: 'checkbox', checked: Settings.get('pasteClean') !== false }), 'čistit při vložení'),
            h('button', { class: 'btn small icon', title: 'Menší písmo editoru', onclick: () => this.efs(-1) }, 'A−'),
            h('button', { class: 'btn small icon', title: 'Větší písmo editoru', onclick: () => this.efs(1) }, 'A+')),
          taWrap),
        h('div', { class: 'bottom-actions' },
        h('button', { class: 'btn primary', onclick: () => this.save(true) }, '💾 Uložit (Ctrl+S)'),
        h('button', { class: 'btn', onclick: e => addToPlaylistMenu(e.currentTarget, [this.id]) }, '＋ Do playlistu ▾'),
        h('button', { class: 'btn', onclick: () => this.duplicate() }, '⧉ Duplikovat'),
        h('button', { class: 'btn', onclick: () => this.exportTxt() }, '⇩ Export .txt'),
        h('span', { class: 'grow' }),
        h('button', { class: 'btn danger icon', title: 'Smazat píseň', 'aria-label': 'Smazat píseň', onclick: () => this.del() }, ic('trash')))),
      h('div', { class: 'ed-right pane' },
        h('div', { class: 'pane-title' }, 'Náhled čtečky', this.brushLbl = h('span', {})),
        h('div', { class: 'preview-bar' },
          this.viewSeg = h('div', { class: 'seg', title: 'Co ukázat v náhledu' },
            h('button', { class: 'btn small', 'data-v': 'reader', onclick: () => this.setView(false) }, 'Čtečka'),
            h('button', { class: 'btn small', 'data-v': 'mus', onclick: () => this.setView(true) }, 'Pro muzikanty')),
          this.layersBtn = h('button', { class: 'btn small', title: 'Které informace pro muzikanty ukázat', onclick: e => layersPopover(e.currentTarget, () => this.renderPreview()) }, 'Vrstvy ▾'),
          this.prevTpl),
        h('div', { class: 'preview-bar' },
          h('span', { class: 'help' }, 'Stránka'),
          h('button', { class: 'btn small icon', onclick: () => this.turn(-1), title: 'Předchozí stránka' }, ic('left')), this.pageLbl,
          h('button', { class: 'btn small icon', onclick: () => this.turn(1), title: 'Další stránka' }, ic('right')),
          h('button', { class: 'btn small', title: 'Otevřít ve čtečce', onclick: () => this.openReader() }, '▶ Čtečka')),
        this.prevWrap)
    );
    this.root.innerHTML = '';
    this.root.appendChild(ed);

    // Události
    const onMeta = () => { this.markDirty(); this.schedulePreview(); };
    [this.inTitle, this.inArtist, this.inKey, this.inTempo, this.inTags].forEach(i => i.addEventListener('input', onMeta));
    this.inTpl.addEventListener('change', () => { this.prevTpl.value = this.inTpl.value || Settings.get('defaultTemplate'); onMeta(); });
    this.ta.addEventListener('input', () => { this.markDirty(); this.paintBack(); this.schedulePreview(); });
    this.ta.addEventListener('scroll', () => { this.bk.scrollTop = this.ta.scrollTop; });
    this.ta.addEventListener('keydown', e => this.onKey(e));
    this.ta.addEventListener('paste', e => this.onPaste(e));
    this.ta.addEventListener('keyup', () => this.followCursor());
    this.ta.addEventListener('click', () => this.followCursor());
    this.chkClean.addEventListener('change', () => Settings.set('pasteClean', this.chkClean.checked));
    this.prevTpl.addEventListener('change', () => { this.page = 0; this.renderPreview(); });
    this.prevWrap.addEventListener('click', e => this.onPreviewClick(e));
    this.ro = new ResizeObserver(() => { this.syncBackWidth(); this.fitPreview(); });
    this.ro.observe(this.ta); this.ro.observe(this.prevWrap);
    this.fillTplSelect();
    this.paintViewSeg();
    this.style = song.style || null;
    this.paintFontBtn();
    this.paintBack();
    this.renderPreview();
    this.updateBrushLbl();
  }

  fillTplSelect() {
    const cur = this.inTpl.value || Settings.get('defaultTemplate');
    this.prevTpl.innerHTML = '';
    for (const t of Store.templates.values()) this.prevTpl.appendChild(h('option', { value: t.id, selected: t.id === cur }, t.name));
  }

  efs(d) {
    const v = Math.max(11, Math.min(26, (Settings.get('editorFontSize') || 16) + d));
    Settings.set('editorFontSize', v);
    $('.ta-wrap', this.root).style.setProperty('--efs', v + 'px');
    this.syncBackWidth();
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
      text: this.ta.value,
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
    this.savedInd.textContent = 'Uloženo ' + fmtDate(s.updatedAt);
    if (manual) toast('Uloženo', 'ok', 1500);
  }

  /* ----- Úpravy textu (se zachováním Ctrl+Z) ----- */
  replaceRange(start, end, text, selectAfter = true) {
    const ta = this.ta;
    ta.focus();
    ta.setSelectionRange(start, end);
    if (!document.execCommand('insertText', false, text)) {
      ta.setRangeText(text, start, end, 'end');
      ta.dispatchEvent(new Event('input'));
    }
    if (selectAfter) ta.setSelectionRange(start, start + text.length);
  }
  selLines() {
    const v = this.ta.value;
    let s = this.ta.selectionStart, e = this.ta.selectionEnd;
    if (e > s && v[e - 1] === '\n') e--;
    const start = v.lastIndexOf('\n', s - 1) + 1;
    let end = v.indexOf('\n', e); if (end < 0) end = v.length;
    return { start, end, text: v.slice(start, end) };
  }
  editLines(fn) {
    const { start, end, text } = this.selLines();
    const out = text.split('\n').map(fn).join('\n');
    if (out !== text) this.replaceRange(start, end, out);
  }
  assign(code, mode) {
    this.brush = mode === 'clear' ? null : code;
    this.brushMode = mode;
    this.updateBrushLbl();
    this.editLines(l => applySingerToLine(l, code, mode === 'set' ? 'force' : mode));
  }
  updateBrushLbl() {
    this.sgButtons.forEach((b, i) => b.classList.toggle('brush', Store.singers()[i] && Store.singers()[i].code === this.brush));
    const s = this.brush && Store.singerMap()[this.brush];
    this.brushLbl.innerHTML = s ? `· štětec: <b style="color:${s.color}">${esc(s.name)}</b> (klikej na řádky)` : '· klikni na řádek = vybrat v textu';
  }
  insertText(t) {
    const s = this.ta.selectionStart, e = this.ta.selectionEnd;
    this.replaceRange(s, e, t, false);
  }
  insertLinePrefix(prefix) {
    const { start, end, text } = this.selLines();
    if (text.trim() === '') this.replaceRange(start, end, prefix, false);
    else this.editLines(l => l.trim() ? (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l) : l);
  }
  async insertSection() {
    const parsed = parseSong(this.ta.value);
    const n = parsed.blocks.filter(b => b.type === 'section' && /^sloka/i.test(b.text)).length;
    const name = await pickSectionName(n + 1);
    if (!name) return;
    const { start } = this.selLines();
    const v = this.ta.value;
    const pre = start > 0 && v[start - 2] !== '\n' && start > 1 ? '\n' : '';
    this.replaceRange(start, start, pre + '## ' + name + '\n', false);
  }
  insertRepeat(anchor) {
    const secs = [...new Set(parseSong(this.ta.value).blocks.filter(b => b.type === 'section' && !b.repeat).map(b => b.text))];
    if (!secs.length) return toast('Nejdřív napiš sekci (např. „## Refrén“), kterou chceš opakovat.', 'warn');
    popupMenu(anchor, secs.map(name => ({ label: '>> ' + name, action: () => {
      const { start, end, text } = this.selLines();
      const ins = (text.trim() ? text + '\n' : '') + '>> ' + name;
      this.replaceRange(start, end, ins, false);
    } })));
  }
  wrapSel(mark) {
    const s = this.ta.selectionStart, e = this.ta.selectionEnd;
    if (s === e) return;
    const t = this.ta.value.slice(s, e);
    const un = t.startsWith(mark) && t.endsWith(mark) && t.length >= mark.length * 2;
    this.replaceRange(s, e, un ? t.slice(mark.length, t.length - mark.length) : mark + t + mark);
  }
  /* Vybraný text větší / menší: {+:text}, {++:text}, {-:text} */
  sizeSel(dir) {
    const s = this.ta.selectionStart, e = this.ta.selectionEnd;
    if (s === e) return toast('Nejdřív označ text, který má být větší nebo menší.', 'warn');
    let t = this.ta.value.slice(s, e);
    const m = /^\{([+-]{1,2}):([\s\S]*)\}$/.exec(t);
    let level = m ? (m[1][0] === '+' ? m[1].length : -m[1].length) : 0;
    if (m) t = m[2];
    level = Math.max(-2, Math.min(2, level + (dir === '+' ? 1 : -1)));
    const out = level === 0 ? t : `{${(level > 0 ? '+' : '-').repeat(Math.abs(level))}:${t}}`;
    this.replaceRange(s, e, out);
  }
  fontPopover(anchor) {
    $$('.menu').forEach(m => m.remove());
    const song = this.collect();
    const st = Object.assign({}, song.style || {});
    const base = Store.template(this.prevTpl.value);
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
    m.style.top = Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8) + 'px';
    setTimeout(() => document.addEventListener('mousedown', function off(e) { if (!m.contains(e.target) && e.target !== anchor) { m.remove(); document.removeEventListener('mousedown', off); } }), 0);
  }
  paintFontBtn() {
    const on = !!(this.style && Object.keys(this.style).length);
    this.fontBtn.classList.toggle('on', on);
    this.fontBtn.title = on ? 'Tato píseň má vlastní písmo (klikni pro úpravu)' : 'Písmo, velikost a zarovnání jen pro tuto píseň (jinak platí šablona)';
  }
  caseMenu() {
    const s = this.ta.selectionStart, e = this.ta.selectionEnd;
    if (s === e) return toast('Nejdřív označ text.', 'warn');
    const t = this.ta.value.slice(s, e);
    popupMenu($('.toolbar', this.root), [
      { label: 'VELKÁ PÍSMENA', action: () => this.replaceRange(s, e, t.toLocaleUpperCase('cs')) },
      { label: 'malá písmena', action: () => this.replaceRange(s, e, t.toLocaleLowerCase('cs')) },
      { label: 'První písmeno řádku velké', action: () => this.replaceRange(s, e, t.split('\n').map(l => l.replace(/^(\s*(?:@[A-Za-z0-9+]+\s)?)(\p{L})/u, (a, p, c) => p + c.toLocaleUpperCase('cs'))).join('\n')) },
    ]);
  }
  setView(on) {
    const mv = Object.assign({}, Settings.get('musView'), { on });
    Settings.set('musView', mv);
    this.paintViewSeg();
    this.page = 0;
    this.renderPreview();
  }
  paintViewSeg() {
    const on = !!(Settings.get('musView') || {}).on;
    $$('button', this.viewSeg).forEach(b => b.classList.toggle('on', (b.dataset.v === 'mus') === on));
    this.layersBtn.disabled = !on;
  }
  musMenu(anchor) {
    const items = [{ label: '[Am] Akord na místo kurzoru', action: () => {
      const s = this.ta.selectionStart, e = this.ta.selectionEnd;
      const sel = this.ta.value.slice(s, e);
      if (sel && isChordToken(sel)) this.replaceRange(s, e, '[' + sel + ']', false);
      else { this.replaceRange(s, e, '[]' + sel, false); this.ta.setSelectionRange(s + 1, s + 1); }
    } }];
    for (const ins of Store.instruments()) {
      items.push({ label: `%${ins.code} ${ins.name} – poznámka (ladění, rytmus…)`, action: () => this.insertLineAbove(`%${ins.code} `) });
      items.push({ label: `%%${ins.code} ${ins.name} – blok (tabulatura)`, action: () => this.insertLineAbove(`%%${ins.code} Tabulatura\ne|-----------------|\nB|-----------------|\nG|-----------------|\nD|-----------------|\nA|-----------------|\nE|-----------------|\n%%`) });
    }
    popupMenu(anchor, items);
  }
  insertLineAbove(text) {
    const { start } = this.selLines();
    this.replaceRange(start, start, text + '\n', false);
    this.ta.setSelectionRange(start + text.split('\n')[0].length, start + text.split('\n')[0].length);
  }
  async cleanDialog() {
    const o = { chords: 'keep', detectSections: true, trimSpaces: true, collapseBlank: true };
    const chordOpt = (v, l) => h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'cl-chords', checked: o.chords === v, onchange: () => { o.chords = v; } }), l);
    const box = h('div', {},
      h('p', { class: 'help' }, 'Použije se na označený text, nebo na celý text, pokud nic označeno není. Vrátit jde přes Ctrl+Z.'),
      h('h3', {}, 'Akordy nad textem'),
      chordOpt('keep', 'Převést pro muzikanty – [Am] nad slovy, ve čtečce se nezobrazí'),
      chordOpt('remove', 'Odstranit'),
      chordOpt('none', 'Nechat beze změny'),
      h('h3', {}, 'Další úpravy'),
      ...[['detectSections', 'Rozpoznat sloky a refrény (1., R:, Ref., [Chorus]…)'],
        ['trimSpaces', 'Sjednotit mezery a odstranit tabulátory'], ['collapseBlank', 'Sloučit více prázdných řádků']]
        .map(([k, l]) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: true, onchange: e => { o[k] = e.target.checked; } }), l)));
    const ok = await modal({ title: '🧹 Vyčistit text', body: box, buttons: [{ label: 'Zrušit', value: false }, { label: 'Vyčistit', value: true, primary: true }] });
    if (!ok) return;
    let s = this.ta.selectionStart, e = this.ta.selectionEnd;
    if (s === e) { s = 0; e = this.ta.value.length; }
    this.replaceRange(s, e, cleanText(this.ta.value.slice(s, e), o), false);
    toast('Text vyčištěn (Ctrl+Z vrátí zpět)', 'ok');
  }
  onPaste(e) {
    if (!this.chkClean.checked) return;
    const t = e.clipboardData && e.clipboardData.getData('text/plain');
    if (!t || t.split('\n').length < 3) return;
    e.preventDefault();
    this.insertText(cleanText(t));
    toast('Vložený text vyčištěn – Ctrl+Z vrátí, „čistit při vložení“ vypne.', 'ok');
  }
  onKey(e) {
    if (e.altKey && /^Digit[0-9]$/.test(e.code)) {
      e.preventDefault();
      const n = +e.code.slice(5);
      if (n === 0) return this.assign(null, 'clear');
      const s = Store.singers()[n - 1];
      if (s) this.assign(s.code, e.shiftKey ? 'toggle' : 'set');
    } else if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); this.wrapSel('**'); }
    else if (e.ctrlKey && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); this.wrapSel('*'); }
    else if (e.key === 'Tab') { e.preventDefault(); this.insertText('    '); }
  }

  /* ----- Barevné podbarvení řádků v editoru ----- */
  paintBack() {
    const { lines } = parseSong(this.ta.value);
    const src = this.ta.value.split('\n');
    const map = Store.singerMap();
    const frag = document.createDocumentFragment();
    src.forEach((l, i) => {
      const info = lines[i] || { kind: 'line', singers: [] };
      const d = document.createElement('div');
      d.textContent = l || '​';
      if (info.kind === 'mus' || info.kind === 'musblock' || info.kind === 'chords') {
        // řádky jen pro muzikanty – čárkovaný okraj v barvě nástroje
        const im = Store.instrumentMap();
        const c = info.kind === 'chords' ? CHORD_COLOR : ((im[(info.inst || [])[0]] || {}).color || '#9aa0a6');
        d.className = 'mus';
        d.style.borderLeftColor = c;
        d.style.background = hexToRgba(c, info.edge ? 0.16 : 0.07);
        frag.appendChild(d);
        return;
      }
      const cols = (info.singers || []).map(c => map[c]).filter(Boolean).map(s => s.color);
      if (cols.length) {
        d.style.borderLeftColor = cols[0];
        d.style.background = stripes(cols.map(c => hexToRgba(c, info.kind === 'section' ? 0.3 : info.inherited ? 0.1 : 0.2)), true);
      }
      if (info.kind === 'section') d.className = 'sec';
      if (info.kind === 'repeat' && !info.ok) d.style.background = 'rgba(255,90,90,.25)';
      frag.appendChild(d);
    });
    this.bk.innerHTML = '';
    this.bk.appendChild(frag);
    this.bk.scrollTop = this.ta.scrollTop;
  }
  syncBackWidth() {
    this.bk.style.right = (this.ta.offsetWidth - this.ta.clientWidth) + 'px';
    this.paintBack();
  }

  /* ----- Náhled ----- */
  schedulePreview() { clearTimeout(this.pvT); this.pvT = setTimeout(() => this.renderPreview(), 180); }
  renderPreview() {
    const W = Settings.get('screenW'), H = Settings.get('screenH');
    const song = this.collect();
    const tpl = applySongStyle(Store.template(this.prevTpl.value), song);
    this.lay = Render.layout(song, tpl, W, H, musViewOpts());
    if (this.page >= this.lay.pages.length) this.page = this.lay.pages.length - 1;
    if (this.page < 0) this.page = 0;
    this.prevWrap.innerHTML = '';
    this.stage = Render.makeStage(tpl, W, H);
    this.prevWrap.appendChild(this.stage);
    this.prevWrap.appendChild(dimLabel(W, H));
    Render.renderPage(this.stage, this.lay, tpl, this.page, { title: song.title, artist: song.artist, key: song.key, tempo: song.tempo, pos: '1/1', next: '' });
    this.pageLbl.textContent = `${this.page + 1}/${this.lay.pages.length}` + (this.lay.k < 0.999 ? ` · ${Math.round(this.lay.k * 100)} %` : '');
    this.tplMirror = tpl.mirror;
    this.fitPreview();
  }
  fitPreview() { if (this.stage) Render.fit(this.stage, this.prevWrap, Settings.get('screenW'), Settings.get('screenH'), 'none'); }
  turn(d) { this.page += d; this.renderPreview(); }
  followCursor() {
    // přepne náhled na stránku, kde je kurzor
    if (!this.lay || this.lay.pages.length < 2) return;
    const line = this.ta.value.slice(0, this.ta.selectionStart).split('\n').length - 1;
    const pg = this.lay.pages.findIndex(p => p.flat().some(i => this.lay.blocks[i].src === line && !this.lay.blocks[i].repeat));
    if (pg >= 0 && pg !== this.page) { this.page = pg; this.renderPreview(); }
  }
  onPreviewClick(e) {
    const el = e.target.closest('[data-src]');
    if (!el) return;
    const line = +el.dataset.src;
    const v = this.ta.value;
    let start = 0;
    for (let i = 0; i < line; i++) { start = v.indexOf('\n', start) + 1; if (start === 0) return; }
    let end = v.indexOf('\n', start); if (end < 0) end = v.length;
    if (this.brush) {
      const nl = applySingerToLine(v.slice(start, end), this.brush, e.shiftKey ? 'toggle' : 'force');
      this.replaceRange(start, end, nl);
    } else {
      this.ta.focus(); this.ta.setSelectionRange(start, end);
      // posunout textarea na řádek
      const lh = parseFloat(getComputedStyle(this.ta).lineHeight) || 24;
      const div = this.bk.children[line];
      this.ta.scrollTop = div ? div.offsetTop - this.ta.clientHeight / 3 : line * lh;
    }
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
  m.style.top = (r.bottom + 4) + 'px';
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
  const sg = Store.singers();
  const rows = [
    ['## Refrén', 'nadpis sekce (sloka, refrén…)'],
    ['## Refrén @' + (sg[2] ? sg[2].code : 'V'), 'sekce, kterou celou zpívá daný zpěvák'],
    ['@' + (sg[0] ? sg[0].code : 'J') + ' text', 'řádek zpívá ' + (sg[0] ? sg[0].name : 'zpěvák')],
    ['@' + (sg[0] ? sg[0].code : 'J') + '+' + (sg[1] ? sg[1].code : 'T') + ' text', 'řádek zpívají dva (pruh má obě barvy)'],
    ['{' + (sg[1] ? sg[1].code : 'T') + ':slovo}', 'jiný zpěvák jen pro část řádku'],
    ['>> Refrén', 'zopakuje celou sekci „Refrén“ (nemusíš ji psát znovu)'],
    ['// 2× opakovat', 'poznámka malým písmem (v šabloně jde skrýt)'],
    ['**tučně**  *kurzíva*  __podtržení__', 'zvýraznění'],
    ['{+:slova}  {++:slova}  {-:slova}', 'větší / ještě větší / menší písmo (tlačítka Větší, Menší)'],
    ['---', 'vynutí novou stránku ve čtečce'],
    ['(prázdný řádek)', 'mezera mezi slokami'],
  ];
  const ins = Store.instruments();
  const i0 = ins[0] ? ins[0].code : 'G', i1 = ins[1] ? ins[1].code : 'B';
  const musRows = [
    ['[Am]Zpívám [C]ptákům', 'akordy nad slovy'],
    ['[G] [D] [Em]', 'samostatný řádek akordů (intro, mezihra)'],
    ['%' + i0 + ' Ladění Drop D, capo 2', 'informace pro ' + (ins[0] ? ins[0].name.toLowerCase() : 'nástroj')],
    ['%' + i0 + '+' + i1 + ' stop na 4', 'informace pro více nástrojů'],
    ['%%' + i0 + ' Tabulatura intro', 'začátek bloku (tabulatura) – mezery zůstanou přesně'],
    ['%%', 'konec bloku'],
  ];
  const body = h('div', {},
    h('div', { class: 'cheat' }, rows.map(r => [h('code', {}, r[0]), h('span', {}, r[1])])),
    h('h3', {}, 'Pro muzikanty – ve čtečce se nikdy nezobrazí'),
    h('div', { class: 'cheat' }, musRows.map(r => [h('code', {}, r[0]), h('span', {}, r[1])])),
    h('p', { class: 'help' }, 'Zobrazíš je v náhledu přepínačem „Pro muzikanty“ (Vrstvy = co ukázat) a v tisku playlistu. Nástroje a jejich zkratky nastavíš v záložce Obsazení.'),
    h('h3', {}, 'Zkratky v editoru'),
    h('div', { class: 'cheat' },
      sg.slice(0, 9).map((s, i) => [h('span', {}, h('kbd', {}, 'Alt'), ' + ', h('kbd', {}, String(i + 1))), h('span', {}, 'označit vybrané řádky: ', h('b', { style: { color: s.color } }, s.name))]),
      [h('span', {}, h('kbd', {}, 'Alt'), ' + ', h('kbd', {}, '0')), h('span', {}, 'zrušit označení')],
      [h('span', {}, h('kbd', {}, 'Shift'), ' + klik'), h('span', {}, 'přidat zpěváka k již označeným (duet)')],
      [h('span', {}, h('kbd', {}, 'Ctrl'), ' + ', h('kbd', {}, 'S')), h('span', {}, 'uložit (ukládá se i automaticky)')],
      [h('span', {}, 'Klik v náhledu'), h('span', {}, 'po výběru zpěváka (štětec) přiřadí řádek kliknutím')]));
  modal({ title: 'Jak psát text písně', body, wide: true });
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
