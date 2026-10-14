'use strict';
/* ===== Vizuální editor textu písně =====
   Text vypadá jako ve čtečce (barvy zpěváků, nadpisy, akordy), značky zůstávají skryté.
   Zdrojem pravdy zůstává text se značkami (textarea editoru) – vizuální editor ho čte i zapisuje.
   Každý řádek zdroje = jeden řádek editoru (.ve-row); blok pro muzikanty (%% … %%) = jeden widget. */
class VisualEditor {
  constructor(host, ed) {
    this.ed = ed;           // SongEditor (ta = zdrojový text)
    this.hist = [];         // historie pro Ctrl+Z
    this.hpos = -1;
    this.host = host;
    this.el = h('div', { class: 've', contenteditable: 'true', spellcheck: 'false', 'data-placeholder': 'Sem vlož nebo napiš text písně…' });
    this.marks = h('div', { class: 've-marks', 'aria-hidden': 'true' });
    this.paper = h('div', { class: 've-paper' }, this.el, this.marks);
    host.appendChild(this.paper);
    this.el.addEventListener('input', () => this.onInput());
    this.el.addEventListener('keydown', e => this.onKey(e));
    this.el.addEventListener('paste', e => this.onPaste(e));
    this.el.addEventListener('click', e => this.onClick(e));
    this.el.addEventListener('keyup', () => this.ed.followCursorVisual());
    this.el.addEventListener('mouseup', () => this.ed.followCursorVisual());
    this.render(ed.ta.value);
    this.pushHist(true);
  }

  /* ----- Vykreslení ze zdrojového textu ----- */
  render(text) {
    const src = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const { lines } = parseSong(text);
    const smap = Store.singerMap(), imap = Store.instrumentMap();
    const frag = document.createDocumentFragment();
    for (let i = 0; i < src.length; i++) {
      const raw = src[i], t = raw.trim(), info = lines[i] || { kind: 'line', singers: [] };
      let m;
      if (info.kind === 'musblock' && info.edge && (m = RE_MUSBLOCK.exec(t)) && t !== '%%') {
        let j = i + 1; const body = [];
        while (j < src.length && src[j].trim() !== '%%') body.push(src[j++]);
        frag.appendChild(this.musBlockEl(parseCodes(m[1]), m[2], body, i, imap));
        i = j; // přeskočit i koncové %%
        continue;
      }
      frag.appendChild(this.rowEl(raw, info, i, smap, imap));
    }
    this.el.innerHTML = '';
    this.el.appendChild(frag);
    if (!this.el.children.length) this.el.appendChild(this.lineRow('', [], [], 0, smap));
    this.el.classList.toggle('is-empty', !String(text || '').trim());
  }

  rowEl(raw, info, i, smap, imap) {
    const t = raw.trim();
    let m;
    switch (info.kind) {
      case 'section': {
        m = RE_SECTION.exec(t);
        const codes = parseCodes(m && m[2]);
        const row = h('div', { class: 've-row ve-sec', 'data-k': 'section', 'data-s': codes.join('+'), 'data-i': i });
        row.textContent = (m && m[1]) || 'Sekce';
        if (codes.length) row.dataset.who = codes.map(c => (smap[c] || { name: c }).name).join(' + ');
        this.paintSinger(row, codes, smap, false);
        return row;
      }
      case 'note': {
        m = RE_NOTE.exec(t);
        const row = h('div', { class: 've-row ve-note', 'data-k': 'note', 'data-i': i });
        row.textContent = m ? m[1] : t;
        return row;
      }
      case 'repeat': {
        m = RE_REPEAT.exec(t);
        const name = m ? m[1] : t;
        return h('div', { class: 've-row ve-widget ve-rep' + (info.ok ? '' : ' bad'), 'data-k': 'repeat', 'data-name': name, 'data-i': i, contenteditable: 'false' },
          h('span', { class: 've-wlabel' }, '↻ ' + name), h('span', { class: 've-whelp' }, info.ok ? 'zopakuje se celá sekce' : 'sekce s tímto názvem neexistuje'),
          h('button', { class: 've-x', title: 'Odebrat opakování', 'data-act': 'remove' }, '✕'));
      }
      case 'break':
        return h('div', { class: 've-row ve-widget ve-break', 'data-k': 'break', 'data-i': i, contenteditable: 'false' },
          h('span', { class: 've-wlabel' }, 'nová stránka ve čtečce'), h('button', { class: 've-x', title: 'Odebrat', 'data-act': 'remove' }, '✕'));
      case 'mus': {
        m = RE_MUS.exec(t);
        const codes = parseCodes(m && m[1]);
        const ins = codes.map(c => imap[c]).filter(Boolean);
        const row = h('div', { class: 've-row ve-mus', 'data-k': 'mus', 'data-inst': codes.join('+'), 'data-i': i, style: { '--ic': ins[0] ? ins[0].color : '#9aa0a6' } });
        row.appendChild(h('span', { class: 've-tag', contenteditable: 'false' }, ins.map(x => x.name).join(' + ') || codes.join('+')));
        row.insertAdjacentHTML('beforeend', veInline(m ? m[2] : '', smap) || '');
        return row;
      }
      default: {
        // řádek textu (i prázdný = mezera mezi slokami)
        let own = [], body = raw.replace(/\s+$/, '');
        if ((m = RE_SINGER.exec(t))) { own = parseCodes(m[1]); body = m[2]; } else body = t;
        return this.lineRow(body, own, info.inherited ? info.singers : [], i, smap);
      }
    }
  }

  lineRow(body, own, inherited, i, smap) {
    const row = h('div', { class: 've-row ve-line', 'data-k': 'line', 'data-s': own.join('+'), 'data-i': i });
    if (body) row.innerHTML = veInline(body, smap); else row.appendChild(document.createElement('br'));
    this.paintSinger(row, own.length ? own : inherited, smap, !own.length && inherited.length > 0);
    return row;
  }

  paintSinger(row, codes, smap, inherited) {
    const cols = codes.map(c => smap[c]).filter(Boolean).map(s => s.color);
    row.style.removeProperty('--c'); row.style.removeProperty('--bar');
    if (!cols.length) return;
    row.style.setProperty('--c', cols[0]);
    row.style.setProperty('--bar', stripes(cols));
    row.classList.toggle('inh', inherited);
  }

  musBlockEl(codes, title, body, i, imap) {
    const ins = codes.map(c => imap[c]).filter(Boolean);
    const titleIn = h('input', { class: 've-btitle', value: title || '', placeholder: 'Nadpis (např. Tabulatura intro)' });
    const pre = h('pre', { class: 've-pre', contenteditable: 'plaintext-only', spellcheck: 'false' });
    pre.textContent = body.join('\n');
    titleIn.addEventListener('input', () => this.onInput());
    pre.addEventListener('input', e => { e.stopPropagation(); this.onInput(); });
    return h('div', { class: 've-row ve-widget ve-block', 'data-k': 'musblock', 'data-inst': codes.join('+'), 'data-i': i, contenteditable: 'false', style: { '--ic': ins[0] ? ins[0].color : '#9aa0a6' } },
      h('div', { class: 've-bhead' }, h('span', { class: 've-tag' }, ins.map(x => x.name).join(' + ') || codes.join('+') || 'Blok'), titleIn,
        h('button', { class: 've-x', title: 'Odebrat blok', 'data-act': 'remove' }, '✕')),
      pre);
  }

  /* ----- Vzhled jako ve čtečce (šablona, šířka monitoru) ----- */
  applyLook(tpl, k) {
    if (tpl) this.tpl = tpl;
    if (k) this.k = k;
    tpl = this.tpl;
    if (!tpl) return;
    const W = Settings.get('screenW') || 1080;
    const avail = Math.max(200, this.host.clientWidth - 28);
    const sc = Math.min(1, avail / W);
    const p = this.paper, st = p.style;
    st.width = Math.round(W * sc) + 'px';
    // písmo podle šablony v měřítku monitoru; v telefonu ne menší než 15 px (zalomení pak neodpovídá přesně)
    // k = zmenšení dlouhé písně, aby se vešla na stránku (šablona „zmenšit“)
    const fs = Math.max(15, tpl.fontSize * sc * (this.k || 1));
    st.setProperty('--vfs', fs + 'px');
    st.setProperty('--vpadx', Math.max(10, tpl.padX * sc) + 'px');
    st.setProperty('--vpady', Math.max(10, tpl.padY * sc) + 'px');
    st.setProperty('--vbg', tpl.bgColor);
    st.setProperty('--vfg', tpl.textColor);
    st.setProperty('--vfont', `"${tpl.fontFamily}", Arial, sans-serif`);
    st.setProperty('--vfw', tpl.fontWeight);
    st.setProperty('--vlh', tpl.lineHeight);
    st.setProperty('--vls', (tpl.letterSpacing || 0) + 'em');
    st.setProperty('--valign', tpl.align);
    st.setProperty('--vsec', tpl.sectionColor);
    st.setProperty('--vsecs', tpl.sectionScale);
    st.setProperty('--vnote', tpl.noteColor);
    st.setProperty('--vgap', tpl.stanzaGap + 'em');
    st.setProperty('--vbar', tpl.singerBar ? Math.max(3, tpl.barWidth * sc) + 'px' : '0px');
    p.classList.toggle('upper', !!tpl.uppercase);
    p.classList.toggle('sg-text', !!tpl.singerText);
    p.classList.toggle('sg-bg', !!tpl.singerBg);
    p.classList.toggle('no-sec', !tpl.showSections);
    p.classList.toggle('no-notes', !tpl.showNotes);
    // informace pro muzikanty: podle přepínače Čtečka / Pro muzikanty a vrstev
    const mv = musDefaults();
    p.classList.toggle('hide-mus', !mv.on);
    p.classList.toggle('hide-chords', !mv.on || mv.chords === false);
    for (const r of this.el.querySelectorAll('.ve-mus, .ve-block')) {
      const codes = (r.dataset.inst || '').split('+').filter(Boolean);
      r.classList.toggle('layer-off', mv.on && codes.length > 0 && codes.every(c => mv.inst && mv.inst[c] === false));
    }
    this.positionMarks();
  }
  /* Hranice stránek čtečky: řádek, kterým začíná další stránka, dostane značku */
  markPages(lay) {
    this.pageStarts = [];
    lay.pages.forEach((pg, n) => {
      if (!n) return;
      const first = pg.flat()[0];
      const b = first != null && lay.blocks[first];
      if (!b) return;
      this.pageStarts.push({ n: n + 1, line: b.repeat ? b.rsrc : b.src, inRepeat: !!b.repeat });
    });
    this.pageCount = lay.pages.length;
    this.positionMarks();
  }
  positionMarks() {
    for (const r of this.el.querySelectorAll('.pg-start')) r.classList.remove('pg-start');
    this.marks.innerHTML = '';
    if (!this.pageStarts) return;
    const rows = [];
    for (const ps of this.pageStarts) {
      const row = this.rowByLine(ps.line);
      if (row) { row.classList.add('pg-start'); rows.push([row, ps]); }
    }
    for (const [row, ps] of rows) {
      this.marks.appendChild(h('div', { class: 've-pg', style: { top: (row.offsetTop - 2) + 'px' } },
        h('span', {}, `strana ${ps.n} / ${this.pageCount}` + (ps.inRepeat ? ' (uprostřed opakování)' : ''))));
    }
  }

  /* ----- Převod zpět na zdrojový text ----- */
  toText() {
    const out = [];
    for (const n of this.el.childNodes) {
      if (n.nodeType === 3) { const t = n.textContent.replace(/ /g, ' '); if (t.trim()) out.push(t); continue; }
      if (n.nodeType !== 1) continue;
      n.dataset.i = out.length; // po Enteru / smazání řádku přečíslovat
      const k = n.dataset.k;
      if (k === 'section') {
        const s = n.dataset.s;
        out.push('## ' + (n.textContent.replace(/ /g, ' ').trim() || 'Sekce') + (s ? ' @' + s : ''));
      } else if (k === 'note') out.push('// ' + n.textContent.replace(/ /g, ' ').trim());
      else if (k === 'repeat') out.push('>> ' + n.dataset.name);
      else if (k === 'break') out.push('---');
      else if (k === 'mus') out.push('%' + n.dataset.inst + ' ' + serializeInline(n).trim());
      else if (k === 'musblock') {
        const title = (n.querySelector('.ve-btitle') || {}).value || '';
        out.push('%%' + n.dataset.inst + (title.trim() ? ' ' + title.trim() : ''));
        const body = (n.querySelector('.ve-pre') || {}).innerText || '';
        if (body.replace(/\n$/, '')) out.push(...body.replace(/\n$/, '').split('\n'));
        out.push('%%');
      } else {
        const body = serializeInline(n).replace(/\s+$/, '');
        const s = n.dataset ? n.dataset.s : '';
        out.push(body.trim() || s ? (s ? '@' + s + ' ' : '') + body.trim() : '');
      }
    }
    while (out.length > 1 && out[out.length - 1] === '' && out[out.length - 2] === '') out.pop();
    return out.join('\n');
  }

  /* Text napsaný mimo řádek (např. po Ctrl+A a smazání) zabalit do řádku */
  normalize() {
    const sel = window.getSelection();
    for (const n of [...this.el.childNodes]) {
      if (n.nodeType === 3 ? !n.textContent : n.nodeType !== 1 || n.dataset.k || n.tagName === 'BR') {
        if (n.nodeType === 1 && n.tagName === 'BR' && this.el.children.length > 1) n.remove();
        continue;
      }
      const caret = sel.rangeCount && sel.anchorNode === n ? sel.anchorOffset : -1;
      const row = h('div', { class: 've-row ve-line', 'data-k': 'line', 'data-s': '' });
      this.el.insertBefore(row, n); row.appendChild(n);
      if (caret >= 0) { const r = document.createRange(); r.setStart(n, caret); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); }
    }
  }

  onInput() {
    this.normalize();
    const t = this.toText();
    this.el.classList.toggle('is-empty', !t.trim());
    if (t === this.ed.ta.value) return;
    this.ed.ta.value = t;
    this.ed.markDirty();
    this.ed.schedulePreview();
    clearTimeout(this.histT);
    this.histT = setTimeout(() => this.pushHist(), 500);
  }

  /* ----- Historie (Ctrl+Z / Ctrl+Y) ----- */
  pushHist(initial) {
    const t = this.ed.ta.value;
    if (!initial && this.hist[this.hpos] === t) return;
    this.hist = this.hist.slice(0, this.hpos + 1);
    this.hist.push(t);
    if (this.hist.length > 200) this.hist.shift();
    this.hpos = this.hist.length - 1;
  }
  undo(dir) {
    clearTimeout(this.histT);
    this.pushHist();
    const np = this.hpos + dir;
    if (np < 0 || np >= this.hist.length) return;
    this.hpos = np;
    this.setText(this.hist[np], null, true);
  }

  /* Programová změna textu: uloží historii, překreslí, obnoví kurzor */
  setText(text, focusLine, noHist) {
    if (!noHist) { clearTimeout(this.histT); this.pushHist(); }
    const sel = focusLine == null ? this.saveSel() : null;
    this.ed.ta.value = text;
    this.render(text);
    this.ed.markDirty();
    this.ed.schedulePreview();
    if (!noHist) this.pushHist();
    if (focusLine != null) this.focusLine(focusLine);
    else this.restoreSel(sel);
  }

  /* ----- Výběr a kurzor ----- */
  rowOf(node) {
    while (node && node !== this.el) { if (node.parentNode === this.el) return node; node = node.parentNode; }
    return null;
  }
  rows() { return [...this.el.children]; }
  selRows() {
    const sel = window.getSelection();
    if (!sel.rangeCount || !this.el.contains(sel.anchorNode)) return [];
    const r = sel.getRangeAt(0);
    const a = this.rowOf(r.startContainer), b = this.rowOf(r.endContainer);
    if (!a) return [];
    const all = this.rows();
    let i1 = all.indexOf(a), i2 = b ? all.indexOf(b) : i1;
    // výběr končící na začátku dalšího řádku ten řádek nezahrnuje
    if (i2 > i1 && r.endOffset === 0 && r.endContainer === (b.firstChild || b)) i2--;
    return all.slice(i1, i2 + 1);
  }
  currentLine() {
    const rows = this.selRows();
    if (rows.length) return +rows[rows.length - 1].dataset.i;
    const last = this.el.lastElementChild;
    return last ? +last.dataset.i : 0;
  }
  textOffset(row, node, off) {
    const r = document.createRange();
    r.selectNodeContents(row);
    try { r.setEnd(node, off); } catch (e) { return 0; }
    return r.toString().length;
  }
  saveSel() {
    const sel = window.getSelection();
    if (!sel.rangeCount || !this.el.contains(sel.anchorNode)) return null;
    const r = sel.getRangeAt(0);
    const a = this.rowOf(r.startContainer), b = this.rowOf(r.endContainer);
    if (!a || !b) return null;
    return { a: +a.dataset.i, ao: this.textOffset(a, r.startContainer, r.startOffset), b: +b.dataset.i, bo: this.textOffset(b, r.endContainer, r.endOffset) };
  }
  pointAt(row, off) {
    const w = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    let n, left = off;
    while ((n = w.nextNode())) {
      if (n.parentNode.closest('[contenteditable=false]') && n.parentNode.closest('[contenteditable=false]') !== row) continue;
      if (left <= n.length) return [n, left];
      left -= n.length;
    }
    return [row, row.childNodes.length];
  }
  rowByLine(i) {
    const rows = this.rows();
    let best = rows[0];
    for (const r of rows) { if (+r.dataset.i <= i) best = r; else break; }
    return best;
  }
  restoreSel(s) {
    if (!s) return;
    const a = this.rowByLine(s.a), b = this.rowByLine(s.b);
    if (!a || !b) return;
    try {
      const r = document.createRange();
      const [an, ao] = this.pointAt(a, s.ao), [bn, bo] = this.pointAt(b, s.bo);
      r.setStart(an, ao); r.setEnd(bn, bo);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    } catch (e) { /* nic */ }
  }
  focusLine(i, atEnd = true) {
    const row = this.rowByLine(i);
    if (!row) return;
    this.el.focus();
    // za štítkem (opakování, nová stránka, blok) pokračovat na dalším řádku, případně nový přidat
    let target = row;
    if (row.matches('.ve-widget')) {
      target = row.nextElementSibling;
      while (target && target.matches('.ve-widget')) target = target.nextElementSibling;
      if (!target) { target = this.lineRow('', [], [], +row.dataset.i + 1, Store.singerMap()); this.el.appendChild(target); }
      atEnd = false;
    }
    const r = document.createRange();
    r.selectNodeContents(target); r.collapse(!atEnd);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    target.scrollIntoView({ block: 'nearest' });
  }

  /* ----- Úpravy po řádcích (zpěvák, vložení řádků) ----- */
  srcLines() { return this.ed.ta.value.split('\n'); }
  assignSinger(code, mode) {
    const rows = this.selRows();
    const sel = window.getSelection();
    // část jednoho řádku → zpěvák jen pro vybraná slova
    if (code && rows.length === 1 && sel.rangeCount && !sel.isCollapsed && rows[0].dataset.k === 'line') {
      const r = sel.getRangeAt(0);
      const full = rows[0].textContent.trim();
      if (r.toString().trim() && r.toString().trim() !== full) {
        const span = h('span', { class: 'sg-in', 'data-c': code, style: { color: (Store.singerMap()[code] || {}).color || '' } });
        try { span.appendChild(r.extractContents()); r.insertNode(span); } catch (e) { return; }
        this.onInput(); this.pushHist();
        return;
      }
    }
    const lines = this.srcLines();
    const idx = rows.length ? rows.map(r => +r.dataset.i) : [this.currentLine()];
    for (const i of idx) if (lines[i] !== undefined) lines[i] = applySingerToLine(lines[i], code, mode);
    this.setText(lines.join('\n'));
  }
  insertLines(newLines, opts = {}) {
    const lines = this.srcLines();
    let at = this.currentLine();
    const cur = lines[at];
    let replace = cur !== undefined && cur.trim() === '' && !opts.keep;
    if (opts.before && !replace) at = at; else if (!replace) at = at + 1;
    // za blok %%…%% vkládat až za jeho konec
    if (!replace && !opts.before && lines[at - 1] !== undefined && RE_MUSBLOCK.test(lines[at - 1].trim()) && lines[at - 1].trim() !== '%%') {
      while (at < lines.length && lines[at].trim() !== '%%') at++;
      at++;
    }
    lines.splice(at, replace ? 1 : 0, ...newLines);
    this.setText(lines.join('\n'), at + (opts.focusOffset || 0));
  }

  /* ----- Formát uvnitř řádku ----- */
  inlineWrap(make) {
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed || !this.el.contains(sel.anchorNode)) { toast('Nejdřív označ text.', 'warn'); return false; }
    const r = sel.getRangeAt(0);
    if (this.rowOf(r.startContainer) !== this.rowOf(r.endContainer)) { toast('Označ text v rámci jednoho řádku.', 'warn'); return false; }
    const el = make();
    try { el.appendChild(r.extractContents()); r.insertNode(el); } catch (e) { return false; }
    sel.removeAllRanges(); const nr = document.createRange(); nr.selectNodeContents(el); sel.addRange(nr);
    this.onInput(); this.pushHist();
    return true;
  }
  // vlastní tučné / kurzíva (execCommand by u šablony s tučným písmem „odtučňoval“)
  bold() { this.toggleTag('B'); }
  italic() { this.toggleTag('I'); }
  toggleTag(tag) {
    const sel = window.getSelection();
    if (!sel.rangeCount || !this.el.contains(sel.anchorNode)) return;
    const node = n => (n.nodeType === 1 ? n : n.parentNode);
    const a = node(sel.anchorNode).closest(tag), f = node(sel.focusNode).closest(tag);
    if (a && a === f && this.el.contains(a)) {
      const first = a.firstChild, last = a.lastChild;
      a.replaceWith(...a.childNodes);
      if (first) { const r = document.createRange(); r.setStartBefore(first); r.setEndAfter(last); sel.removeAllRanges(); sel.addRange(r); }
      this.onInput(); this.pushHist();
      return;
    }
    this.inlineWrap(() => document.createElement(tag.toLowerCase()));
  }
  size(dir) {
    const sel = window.getSelection();
    if (sel.rangeCount && this.el.contains(sel.anchorNode)) {
      const host = (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentNode).closest('.sz');
      if (host && this.el.contains(host)) {
        let lvl = host.dataset.l[0] === '+' ? host.dataset.l.length : -host.dataset.l.length;
        lvl = Math.max(-2, Math.min(2, lvl + (dir === '+' ? 1 : -1)));
        if (lvl === 0) host.replaceWith(...host.childNodes);
        else { host.dataset.l = (lvl > 0 ? '+' : '-').repeat(Math.abs(lvl)); host.className = `sz sz${lvl > 0 ? 'p' : 'm'}${Math.abs(lvl)}`; }
        this.onInput(); this.pushHist();
        return;
      }
    }
    this.inlineWrap(() => h('span', { class: 'sz sz' + (dir === '+' ? 'p1' : 'm1'), 'data-l': dir }));
  }
  replaceSelText(fn) {
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed || !this.el.contains(sel.anchorNode)) return toast('Nejdřív označ text.', 'warn');
    document.execCommand('insertText', false, fn(sel.toString()));
    this.onInput();
  }
  insertChord(name) {
    const sel = window.getSelection();
    if (!sel.rangeCount || !this.el.contains(sel.anchorNode)) return toast('Klikni do textu na místo, kam akord patří.', 'warn');
    const r = sel.getRangeAt(0);
    r.collapse(true);
    const ch = h('span', { class: 'vchord', contenteditable: 'false', 'data-ch': name });
    r.insertNode(ch);
    r.setStartAfter(ch); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
    this.onInput(); this.pushHist();
  }

  /* ----- Události ----- */
  async onClick(e) {
    const x = e.target.closest('[data-act=remove]');
    if (x) {
      const row = this.rowOf(x);
      const lines = this.srcLines(); const i = +row.dataset.i;
      let n = 1;
      if (row.dataset.k === 'musblock') { n = 1; while (i + n < lines.length && lines[i + n].trim() !== '%%') n++; n++; }
      lines.splice(i, n);
      this.setText(lines.join('\n'), Math.max(0, i - 1));
      return;
    }
    const ch = e.target.closest('.vchord');
    if (ch) {
      e.preventDefault();
      const v = await modal({ title: 'Akord', body: h('div', {}, h('input', { class: 'inp', value: ch.dataset.ch, id: 've-chord-in' }), h('p', { class: 'help' }, 'Akord se ukáže jen muzikantům, ve čtečce ne.')),
        buttons: [{ label: 'Smazat akord', value: '__del', danger: true }, { label: 'Zrušit', value: null }, { label: 'Uložit', primary: true, value: box => box.querySelector('input').value.trim() }] });
      if (v === null || v === undefined) return;
      if (v === '__del' || !v) ch.remove(); else ch.dataset.ch = v;
      this.onInput(); this.pushHist();
      return;
    }
    const rep = e.target.closest('.ve-rep');
    if (rep) {
      const secs = [...new Set(parseSong(this.ed.ta.value).blocks.filter(b => b.type === 'section' && !b.repeat).map(b => b.text))];
      popupMenu(rep, secs.map(name => ({ label: '↻ ' + name, action: () => {
        const lines = this.srcLines(); lines[+rep.dataset.i] = '>> ' + name; this.setText(lines.join('\n'));
      } })));
    }
  }

  onKey(e) {
    if (e.target.closest && e.target.closest('.ve-pre, .ve-btitle')) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') e.stopPropagation();
      return;
    }
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'y')) { e.preventDefault(); this.undo(k === 'y' || e.shiftKey ? 1 : -1); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'b') { e.preventDefault(); this.bold(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'i') { e.preventDefault(); this.italic(); return; }
    if (e.altKey && /^Digit[0-9]$/.test(e.code)) {
      e.preventDefault();
      const n = +e.code.slice(5);
      if (n === 0) return this.assignSinger(null, 'clear');
      const s = Store.singers()[n - 1];
      if (s) this.assignSinger(s.code, e.shiftKey ? 'toggle' : 'force');
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      const row = this.selRows().pop();
      if (row && row.dataset.k !== 'line') {
        // za nadpisem/poznámkou pokračuje obyčejný řádek
        e.preventDefault();
        this.onInput();
        this.insertLines([''], { keep: true });
      }
    }
  }

  onPaste(e) {
    if (e.target.closest && e.target.closest('.ve-pre, .ve-btitle')) return;
    e.preventDefault();
    const t = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
    if (!t) return;
    if (!t.includes('\n')) { document.execCommand('insertText', false, t); this.onInput(); return; }
    const clean = this.ed.chkClean.checked ? cleanText(t) : t.replace(/\r\n?/g, '\n');
    this.onInput();
    const wasEmpty = !this.ed.ta.value.trim();
    if (wasEmpty) this.setText(clean, 0);
    else this.insertLines(clean.split('\n'));
    if (this.ed.chkClean.checked) toast('Vložený text vyčištěn – Ctrl+Z vrátí.', 'ok');
  }
}

/* Řádek se značkami → HTML pro vizuální editor (akordy jako nepsatelné značky nad textem) */
function veInline(body, smap) {
  const chords = [];
  const solo = hasChords(body) && stripChords(body) === '';
  const t = String(body).replace(RE_INLINE_CHORD, (all, c) => isChordToken(c) ? '\u0001' + (chords.push(c) - 1) + '\u0002' : all);
  let html = inlineHtml(t, smap);
  html = html.replace(/\u0001(\d+)\u0002/g, (a, n) => `<span class="vchord${solo ? ' solo' : ''}" contenteditable="false" data-ch="${esc(chords[+n])}"></span>`);
  return html;
}

/* HTML řádku → text se značkami */
function serializeInline(node) {
  let out = '';
  for (const n of node.childNodes) {
    if (n.nodeType === 3) { out += n.textContent.replace(/ /g, ' ').replace(/​/g, ''); continue; }
    if (n.nodeType !== 1) continue;
    const tag = n.tagName;
    if (tag === 'BR' || n.classList.contains('ve-tag')) continue;
    if (n.classList.contains('vchord')) { out += '[' + n.dataset.ch + ']'; continue; }
    const inner = serializeInline(n);
    if (!inner) continue;
    if (n.classList.contains('sg-in') && n.dataset.c) out += '{' + n.dataset.c + ':' + inner + '}';
    else if (n.classList.contains('sz') && n.dataset.l) out += '{' + n.dataset.l + ':' + inner + '}';
    else if (tag === 'B' || tag === 'STRONG' || (n.style && (n.style.fontWeight === 'bold' || +n.style.fontWeight >= 600))) out += '**' + inner + '**';
    else if (tag === 'I' || tag === 'EM' || (n.style && n.style.fontStyle === 'italic')) out += '*' + inner + '*';
    else if (tag === 'U') out += '__' + inner + '__';
    else out += inner;
  }
  return out;
}
