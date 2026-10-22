'use strict';
/* ===== Úpravy přímo ve stránce čtečky =====
   Uprostřed je skutečná stránka čtečky (rozměr monitoru, záhlaví, zápatí) a text se upravuje přímo v ní.
   Ovládání stačí šipkami a OK (airmouse):
     ↑ ↓  vybrat řádek (na konci stránky se přejde na další)
     ← →  kdo zpívá vybraný řádek (dokola: nikdo → Já → Ty → Všichni…)
     OK   nabídka akcí pro řádek (Enter)
     psaní / klik na vybraný řádek = úprava textu, Esc = hotovo
   Zdrojem pravdy je text se značkami (ed.src); stránka se z něj vždy znovu vykreslí. */
class StageEditor {
  constructor(wrap, ed) {
    this.wrap = wrap;
    this.ed = ed;
    this.page = 0;
    this.curKey = null;      // vybraný řádek (klíč cíle)
    this.anchorKey = null;   // začátek výběru více řádků (Shift)
    this.editing = null;     // { line, caret } – upravovaný řádek zdroje
    this.hist = [ed.src];
    this.hpos = 0;
    wrap.tabIndex = 0;
    wrap.addEventListener('keydown', e => this.onKey(e));
    wrap.addEventListener('mousedown', e => this.onMouseDown(e));
    wrap.addEventListener('click', e => this.onClick(e));
    wrap.addEventListener('contextmenu', e => this.onContext(e));
    wrap.addEventListener('paste', e => this.onPaste(e));
    wrap.addEventListener('input', () => this.onEditInput());
    this.placeholder = h('div', { class: 'se-empty' },
      h('b', {}, 'Píseň je zatím prázdná'),
      h('span', {}, 'Vlož text (Ctrl+V) nebo začni psát. Text se automaticky vyčistí a rozdělí na sloky a refrény.'));
    wrap.appendChild(this.placeholder);
    // vlastní kurzor: stránka je zmenšená, takže kurzor prohlížeče by byl tenčí než pixel
    this.caretEl = h('div', { class: 'se-caret' });
    wrap.appendChild(this.caretEl);
    this.onSel = () => { if (!wrap.isConnected) { document.removeEventListener('selectionchange', this.onSel); return; } this.paintCaret(); };
    document.addEventListener('selectionchange', this.onSel);
  }
  paintCaret() {
    const c = this.caretEl, el = this.editEl, sel = window.getSelection();
    const show = el && el.isConnected && document.activeElement === el && sel.rangeCount && sel.isCollapsed && el.contains(sel.anchorNode);
    if (!show) { c.style.display = 'none'; return; }
    const r = sel.getRangeAt(0);
    let rect = [...r.getClientRects()].pop();
    if (!rect || !rect.height) {
      // prázdný řádek / začátek řádku: výška řádku, vlevo na začátku textu
      const er = el.getBoundingClientRect(), cs = getComputedStyle(el);
      const k = er.width / (el.offsetWidth || er.width || 1);
      const lh = (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2) * k;
      rect = { left: er.left + (parseFloat(cs.paddingLeft) || 0) * k, top: er.top + (parseFloat(cs.paddingTop) || 0) * k, height: lh };
    }
    const w = this.wrap.getBoundingClientRect();
    c.style.display = 'block';
    c.style.left = (rect.left - w.left - 1) + 'px';
    c.style.top = (rect.top - w.top) + 'px';
    c.style.height = rect.height + 'px';
    c.classList.remove('blink'); void c.offsetWidth; c.classList.add('blink');   // po pohybu chvíli svítí, pak bliká
  }

  /* ---------- Zdroj ---------- */
  lines() { return this.ed.src.split('\n'); }
  info() { return parseSong(this.ed.src).lines; }

  /* Změna zdrojového textu: historie, uložení, překreslení */
  commit(text, opts = {}) {
    if (text === this.ed.src && !opts.force) { this.render(); return; }
    this.ed.src = text;
    this.pushHist();
    this.ed.changed();
    this.render();
  }
  pushHist() {
    if (this.hist[this.hpos] === this.ed.src) return;
    this.hist = this.hist.slice(0, this.hpos + 1);
    this.hist.push(this.ed.src);
    if (this.hist.length > 300) this.hist.shift();
    this.hpos = this.hist.length - 1;
  }
  undo(dir) {
    this.finishEdit(true);
    const np = this.hpos + dir;
    if (np < 0 || np >= this.hist.length) { toast(dir < 0 ? 'Není co vrátit.' : 'Není co opakovat.', 'warn', 1500); return; }
    this.hpos = np;
    this.ed.src = this.hist[np];
    this.ed.changed();
    this.render();
  }

  /* ---------- Vykreslení ---------- */
  render() {
    const ed = this.ed;
    const scr = ed.screen(), own = scr.id === Screens.mine().id;
    const W = scr.w, H = scr.h;
    const song = ed.collect();
    let text = song.text;
    if (this.editing) {
      // upravovaný prázdný řádek musí být na stránce vidět
      const ls = text.split('\n');
      const i = this.editing.line;
      if (ls[i] !== undefined && !stripMarkupBody(ls[i])) ls[i] = ls[i].replace(/\s+$/, '') + (ls[i].trim() ? ' ' : '') + '​';
      if (ls[i] === undefined) { ls.push('​'); this.editing.line = ls.length - 1; }
      text = ls.join('\n');
    }
    const tpl = ed.lookTpl(song);
    const fz = Screens.fontScale(scr, own);
    if (fz !== 1) tpl.fontSize = Math.round(tpl.fontSize * fz);
    // náhled přesně pro zvolenou obrazovku (její konce stránek a vrstvy); „Ukázat akordy“ přidá vše pro muzikanty
    const mus = musViewOpts() || Screens.view(scr, own);
    this.wrap.classList.toggle('mus-on', !!(mus && mus.chords));
    const lay = Render.layout(Object.assign({}, song, { text }), tpl, W, H, mus, screenOpts(scr, ed.id, own));
    this.lay = lay;
    this.tpl = tpl;
    this.targets = this.buildTargets(lay, tpl);
    const tkey = JSON.stringify(tpl) + W + 'x' + H;
    if (!this.stage || this.tkey !== tkey) {
      if (this.stage) this.stage.remove();
      this.stage = Render.makeStage(tpl, W, H);
      this.stage.classList.add('edit-stage');
      this.wrap.insertBefore(this.stage, this.wrap.firstChild);
      this.tkey = tkey;
    }
    // vybraný řádek musí existovat; stránka podle něj
    let cur = this.curIdx();
    if (this.editing) {
      const ti = this.targets.findIndex(t => t.line === this.editing.line && t.kind !== 'repeat');
      if (ti >= 0) { cur = ti; this.curKey = this.targets[ti].key; this.page = this.targets[ti].page; }
    }
    if (cur < 0 && this.targets.length && this.curLine != null) {
      // po smazání / změně: nejbližší řádek
      let best = -1;
      this.targets.forEach((t, i) => { if (t.line <= this.curLine) best = i; });
      cur = best >= 0 ? best : 0;
      this.curKey = this.targets[cur].key;
      this.anchorKey = null;
    }
    if (cur >= 0 && !this.editing && this.followCur) this.page = this.targets[cur].page;
    this.followCur = false;
    this.page = Math.max(0, Math.min(this.page, lay.pages.length - 1));
    this.paintPage();
    this.placeholder.hidden = !!(this.ed.src.trim() || this.editing);
    ed.onStageRender(lay);
  }

  paintPage() {
    const song = this.ed.collect();
    Render.renderPage(this.stage, this.lay, this.tpl, this.page, this.ed.pageInfo(song));
    this.fit();
    this.paintSel();
    if (this.editing) this.makeEditable();
  }
  fit() {
    if (!this.stage) return;
    const scr = this.ed.screen();
    Render.fit(this.stage, this.wrap, scr.w, scr.h, 'none');
    this.paintCaret();
  }

  /* Cíle pro výběr šipkami: řádky, nadpisy, poznámky, opakování (celé jako jeden cíl), bloky */
  buildTargets(lay, tpl) {
    const pageOf = {};
    lay.pages.forEach((pg, p) => pg.flat().forEach(i => { pageOf[i] = p; }));
    const info = this.info();
    const out = [];
    let last = null;
    lay.blocks.forEach((b, i) => {
      if (b.type === 'gap' || b.type === 'break' || b.private || pageOf[i] === undefined) return;
      if (b.type === 'section' && !tpl.showSections && !b.repeat) return;
      if (b.type === 'note' && !tpl.showNotes && !b.warn) return;
      const rep = b.repeat || (info[b.src] && info[b.src].kind === 'repeat');
      const line = b.repeat ? b.rsrc : b.src;
      let key = (rep ? 'r' : 's') + line;
      if (last && last.key === key && last.page === pageOf[i]) { last.bis.push(i); return; }
      if (last && last.key === key) key += 'p' + pageOf[i]; // opakování přes dvě stránky
      let kind = rep ? 'repeat' : (info[line] ? info[line].kind : b.type);
      if (kind === 'gap') kind = 'line'; // právě psaný prázdný řádek
      last = { key, line, kind, bis: [i], page: pageOf[i] };
      out.push(last);
    });
    return out;
  }
  curIdx() { return this.curKey == null ? -1 : this.targets.findIndex(t => t.key === this.curKey); }
  cur() { return this.targets[this.curIdx()] || null; }
  selTargets() {
    const c = this.curIdx();
    if (c < 0) return [];
    let a = this.anchorKey == null ? c : this.targets.findIndex(t => t.key === this.anchorKey);
    if (a < 0) a = c;
    return this.targets.slice(Math.min(a, c), Math.max(a, c) + 1);
  }
  elsOf(t) { return t ? t.bis.map(i => this.stage.querySelector(`[data-bi="${i}"]`)).filter(Boolean) : []; }

  paintSel() {
    for (const e of this.stage.querySelectorAll('.is-sel, .is-cur')) e.classList.remove('is-sel', 'is-cur');
    const sel = this.selTargets();
    this.wrap.classList.toggle('multi', sel.length > 1);
    for (const t of sel) for (const e of this.elsOf(t)) e.classList.add('is-sel');
    for (const e of this.elsOf(this.cur())) e.classList.add('is-cur');
    this.curLine = this.cur() ? this.cur().line : this.curLine;
    this.ed.onSelChange();
  }

  select(idx, extend) {
    if (!this.targets.length) return;
    idx = Math.max(0, Math.min(idx, this.targets.length - 1));
    const t = this.targets[idx];
    if (!extend) this.anchorKey = null;
    else if (this.anchorKey == null) this.anchorKey = this.curKey;
    this.curKey = t.key;
    if (t.page !== this.page) { this.page = t.page; this.paintPage(); } else this.paintSel();
  }
  turnPage(d) {
    this.finishEdit(true);
    const n = this.lay ? this.lay.pages.length : 1;
    const p = Math.max(0, Math.min(n - 1, this.page + d));
    if (p === this.page) return;
    this.page = p;
    const first = this.targets.findIndex(t => t.page === p);
    if (first >= 0) { this.curKey = this.targets[first].key; this.anchorKey = null; }
    this.paintPage();
  }

  describe(t) {
    const names = { line: 'Řádek', chords: 'Akordy', section: 'Nadpis sekce', note: 'Poznámka', repeat: 'Opakování', mus: 'Pro muzikanty', musblock: 'Blok pro muzikanty' };
    const who = this.singersOf(t);
    const sm = Store.singerMap();
    const w = who.own.length ? who.own.map(c => (sm[c] || { name: c }).name).join(' + ') : who.inh.length ? who.inh.map(c => (sm[c] || { name: c }).name).join(' + ') + ' (sekce)' : '';
    return (names[t.kind] || 'Řádek') + (w ? ' · ' + w : '');
  }

  /* ---------- Klávesy ---------- */
  onKey(e) {
    if (this.menu) return this.menuKey(e);
    if (this.editing) return this.editKey(e);
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    const idx = this.curIdx();
    if (ctrl && (k === 'z' || k === 'Z')) { e.preventDefault(); return this.undo(e.shiftKey ? 1 : -1); }
    if (ctrl && (k === 'y' || k === 'Y')) { e.preventDefault(); return this.undo(1); }
    if (ctrl && (k === 'b' || k === 'B')) { e.preventDefault(); return this.formatLines('bold'); }
    if (ctrl && (k === 'i' || k === 'I')) { e.preventDefault(); return this.formatLines('italic'); }
    if (e.altKey && /^Digit[0-9]$/.test(e.code)) { e.preventDefault(); return this.singerByNumber(+e.code.slice(5), e.shiftKey); }
    if (e.altKey && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); return this.moveLines(k === 'ArrowUp' ? -1 : 1); }
    if (ctrl || e.altKey) return;
    if (/^(Arrow|Page|Home|End)/.test(k)) this.wrap.classList.add('kbd-nav');   // značka řádku jen při ovládání šipkami (airmouse)
    switch (k) {
      case 'ArrowDown': e.preventDefault(); return this.select(idx < 0 ? 0 : idx + 1, e.shiftKey);
      case 'ArrowUp': e.preventDefault(); return this.select(idx < 0 ? 0 : idx - 1, e.shiftKey);
      case 'ArrowRight': e.preventDefault(); return this.cycleSinger(1);
      case 'ArrowLeft': e.preventDefault(); return this.cycleSinger(-1);
      case 'PageDown': e.preventDefault(); return this.turnPage(1);
      case 'PageUp': e.preventDefault(); return this.turnPage(-1);
      case 'Home': e.preventDefault(); return this.select(0);
      case 'End': e.preventDefault(); return this.select(this.targets.length - 1);
      case 'Enter': e.preventDefault(); return this.targets.length ? this.openMenu() : this.startEdit(null, 'end');
      case 'F2': e.preventDefault(); return this.startEdit(this.cur(), 'end');
      case 'Delete': e.preventDefault(); return this.deleteLines();
      case 'Backspace': e.preventDefault(); return this.startEdit(this.cur(), 'end');
      case 'Escape': if (this.anchorKey != null) { e.preventDefault(); this.anchorKey = null; this.paintSel(); } return;
    }
    if (k.length === 1) {
      // začni psát = úprava vybraného řádku (znak se připíše na konec)
      e.preventDefault();
      const t = this.cur();
      this.startEdit(t && this.editable(t) ? t : null, 'end', k);
    }
  }

  editKey(e) {
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    if (e.altKey && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); return this.moveLines(k === 'ArrowUp' ? -1 : 1); }   // posun řádku i při psaní
    if (ctrl && (k === 'z' || k === 'Z')) { e.preventDefault(); return this.undo(e.shiftKey ? 1 : -1); }
    if (ctrl && (k === 'y' || k === 'Y')) { e.preventDefault(); return this.undo(1); }
    if (ctrl && (k === 'b' || k === 'B')) { e.preventDefault(); return this.format('bold'); }
    if (ctrl && (k === 'i' || k === 'I')) { e.preventDefault(); return this.format('italic'); }
    if (e.altKey && /^Digit[0-9]$/.test(e.code)) { e.preventDefault(); return this.singerByNumber(+e.code.slice(5), e.shiftKey); }
    if (k === 'Escape') { e.preventDefault(); this.finishEdit(); return; }
    if (k === 'Tab') { e.preventDefault(); return; }
    if (k === 'Enter') { e.preventDefault(); return this.splitLine(); }
    if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); return this.moveEdit(k === 'ArrowUp' ? -1 : 1); }
    const sel = window.getSelection();
    if (k === 'Backspace' && sel.isCollapsed && this.caretOffset() === 0) { e.preventDefault(); return this.joinPrev(); }
    if (k === 'Delete' && sel.isCollapsed && this.caretOffset() === this.editEl.textContent.replace(/​/g, '').length) { e.preventDefault(); return this.joinNext(); }
  }

  /* ---------- Myš ---------- */
  /* Myš jako v textovém editoru: klik = kurzor v řádku, tažení v řádku = označení slov,
     tažení přes více řádků = označení řádků (zpěvák, písmo, smazání se použije na všechny) */
  onMouseDown(e) {
    if (this.menu && !this.menu.contains(e.target)) this.closeMenu();
    if (e.button !== 0) return;
    this.wrap.classList.remove('kbd-nav');
    if (e.target.closest('.line-menu')) return;
    const lineAt = () => { const el = document.elementFromPoint(e.clientX, e.clientY); return el && this.stage && this.stage.contains(el) ? el.closest('[data-bi]') : null; };
    if (this.editing && this.editEl && this.editEl.contains(e.target)) {   // označování v psaném řádku nechá prohlížeč
      const b = e.target.closest('[data-bi]');
      this.startDrag(e, b && this.targets.find(x => x.bis.includes(+b.dataset.bi)), null);
      return;
    }
    e.preventDefault();
    this.wrap.focus({ preventScroll: true });
    if (this.editing) this.finishEdit(true);   // stránka se překreslí – řádek pod myší se hledá až potom
    const bEl = lineAt();
    const t = bEl && this.targets.find(x => x.bis.includes(+bEl.dataset.bi));
    if (!t) return;
    const off = this.offsetAtPoint(bEl, e.clientX, e.clientY);
    this.pendingClickEdit = !e.shiftKey && this.editable(t) ? { t, offset: off } : null;
    this.select(this.targets.indexOf(this.targets.find(x => x.key === t.key)), e.shiftKey);
    if (!e.shiftKey) this.startDrag(e, t, { bEl, off });
  }
  startDrag(e, t, from) {
    if (!t) return;
    const d = { key: t.key, multi: false };
    const lineAt = ev => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const b = el && this.stage && this.stage.contains(el) && el.closest('[data-bi]');
      return b && this.targets.find(x => x.bis.includes(+b.dataset.bi));
    };
    const move = ev => {
      const t2 = lineAt(ev);
      if (!t2) return;
      if (t2.key !== d.key) {
        ev.preventDefault();
        if (!d.multi) { d.multi = true; this.pendingClickEdit = null; if (this.editing) this.finishEdit(true); window.getSelection().removeAllRanges(); }
        this.anchorKey = d.key; this.curKey = t2.key; this.paintSel();
      } else if (d.multi) { this.anchorKey = null; this.curKey = d.key; this.paintSel(); }
    };
    const up = ev => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      if (d.multi) { this.wrap.focus({ preventScroll: true }); return; }
      // puštění myši = psaní na místě kliknutí (tažením v řádku s označenými slovy);
      // nečeká se na „click“ – po překreslení stránky by ho prohlížeč nemusel poslat
      const p = this.pendingClickEdit;
      this.pendingClickEdit = null;
      if (!from || !p || this.editing) return;
      if (lineAt(ev) === t) {
        const end = this.offsetAtPoint(from.bEl, ev.clientX, ev.clientY);
        if (typeof end === 'number' && typeof p.offset === 'number' && end !== p.offset) p.end = end;
      }
      this.startEdit(this.targets.find(x => x.key === p.t.key), p.offset);
      if (this.editing && p.end != null) { this.editing.selEnd = p.end; this.setCaret(p.offset, p.end); }
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }
  onClick(e) {
    if (e.target.closest('.st-head')) { this.ed.focusMeta(); return; }
    if (e.target.closest('.st-foot .more')) { this.turnPage(1); return; }
    if (!this.targets.length && !this.editing && e.target.closest('.stage, .se-empty')) this.startEdit(null, 'end');
  }
  onContext(e) {
    if (e.target.closest('.line-menu')) return;
    const bEl = e.target.closest('[data-bi]');
    if (!bEl) return;
    e.preventDefault();
    if (this.editing) this.finishEdit(true);
    const t = this.targets.find(x => x.bis.includes(+bEl.dataset.bi));
    if (t) { this.select(this.targets.indexOf(t)); this.openMenu(e.clientX, e.clientY); }
  }
  offsetAtPoint(el, x, y) {
    const r = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
    if (!r || !el.contains(r.startContainer)) return 'end';
    let off = 0;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (n.parentElement.closest('.ch, .badge, .mtag')) continue;
      if (n === r.startContainer) return off + r.startOffset;
      off += n.length;
    }
    return 'end';
  }

  /* ---------- Psaní ---------- */
  editable(t) { return t && ['line', 'chords', 'section', 'note', 'mus'].includes(t.kind); }
  /* t = cíl (null = nový řádek za vybraným / na konec); caret = 'start' | 'end' | číslo; ch = první napsaný znak */
  startEdit(t, caret = 'end', ch) {
    this.closeMenu();
    if (t && !this.editable(t)) { this.openMenu(); return; }
    let line;
    if (t) line = t.line;
    else {
      // nový řádek: prázdná píseň, nebo za vybraný řádek
      const ls = this.lines();
      if (!this.ed.src.trim()) { this.ed.src = ''; line = 0; }
      else {
        const c = this.cur();
        line = c ? this.afterTarget(c) : ls.length;
        ls.splice(line, 0, '');
        this.ed.src = ls.join('\n');
      }
    }
    this.editing = { line, caret, ch };
    this.render();
  }
  /* index řádku zdroje za cílem (za blokem %%…%% až za jeho konec) */
  afterTarget(t) {
    const ls = this.lines();
    let i = t.line + 1;
    if (t.kind === 'musblock') { while (i < ls.length && ls[i].trim() !== '%%') i++; i++; }
    return Math.min(i, ls.length);
  }
  makeEditable() {
    const t = this.targets.find(x => x.line === this.editing.line && x.kind !== 'repeat');
    const el = t && this.elsOf(t)[0];
    if (!el) { this.editing = null; return; }
    const src = this.lines()[t.line] || '';
    const { body } = splitLine(src, t.kind);
    el.innerHTML = veInline(body, Store.singerMap()) || '';
    if (!el.firstChild) el.appendChild(document.createTextNode(''));
    el.classList.add('is-edit');
    el.contentEditable = 'true';
    el.spellcheck = false;
    this.editEl = el;
    this.editKind = t.kind;
    el.focus({ preventScroll: true });
    this.setCaret(this.editing.caret, this.editing.selEnd);
    this.editing.selEnd = null;
    const ch = this.editing.ch;
    this.editing.ch = null;
    if (ch) { document.execCommand('insertText', false, ch); }
  }
  /* caret = 'start' | 'end' | číslo znaku; end = konec označení (tažením myší přes slova) */
  setCaret(caret, end) {
    const el = this.editEl;
    const sel = window.getSelection();
    const at = off => {
      let left = off;
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const len = n.data.replace(/​/g, '').length;
        if (left <= len) return [n, Math.min(n.length, left)];
        left -= len;
      }
      return null;
    };
    const r = document.createRange();
    const a = typeof caret === 'number' && at(caret);
    if (a) r.setStart(...a); else { r.selectNodeContents(el); r.collapse(caret === 'start'); }
    r.collapse(true);
    const b = typeof end === 'number' && end !== caret && at(end);
    if (b) { if (end < caret) r.setStart(...b); else r.setEnd(...b); }
    sel.removeAllRanges(); sel.addRange(r);
  }
  caretOffset() {
    const sel = window.getSelection();
    if (!sel.rangeCount || !this.editEl) return 0;
    const r = document.createRange();
    r.selectNodeContents(this.editEl);
    try { r.setEnd(sel.focusNode, sel.focusOffset); } catch (e) { return 0; }
    return r.toString().replace(/​/g, '').length;
  }
  /* text upravovaného řádku zpět do zdroje (bez překreslení) */
  syncEdit() {
    if (!this.editing || !this.editEl) return;
    const ls = this.lines();
    const i = this.editing.line;
    const body = serializeInline(this.editEl).replace(/​/g, '').replace(/\s+$/, '');
    let nl = joinLine(ls[i] || '', this.editKind, body);
    // nový řádek po Enteru: zpěvák z předchozího řádku, jakmile se začne psát
    if (this.editKind === 'line' && this.editing.prefix && body && !RE_SINGER.test(nl.trim())) nl = this.editing.prefix + nl.trim();
    if (nl === ls[i]) return;
    ls[i] = nl;
    this.ed.src = ls.join('\n');
    this.ed.changed();
  }
  onEditInput() {
    if (!this.editing) return;
    this.syncEdit();
    clearTimeout(this.histT);
    this.histT = setTimeout(() => this.pushHist(), 600);
    // po chvilce bez psaní znovu rozvrhnout stránku (text mohl přetéct na další)
    clearTimeout(this.relayT);
    this.relayT = setTimeout(() => {
      if (!this.editing || document.activeElement !== this.editEl) return;
      this.editing.caret = this.caretOffset();
      this.render();
    }, 900);
  }
  finishEdit(silent) {
    if (!this.editing) return;
    clearTimeout(this.relayT);
    this.syncEdit();
    const line = this.editing.line;
    const had = this.wrap.contains(document.activeElement);   // psaný řádek měl fokus (akce z lišty nebo nabídky)
    this.editing = null;
    this.editEl = null;
    this.pushHist();
    this.curLine = line;
    this.render();
    if (!silent || (had && !this.wrap.contains(document.activeElement))) this.wrap.focus({ preventScroll: true });
  }
  splitLine() {
    const el = this.editEl, i = this.editing.line, kind = this.editKind;
    const sel = window.getSelection();
    const r = sel.getRangeAt(0);
    r.deleteContents();
    const tail = document.createRange();
    tail.setStart(r.startContainer, r.startOffset);
    tail.setEnd(el, el.childNodes.length);
    const box = document.createElement('div');
    box.appendChild(tail.extractContents());
    const after = serializeInline(box).replace(/​/g, '').trim();
    this.syncEdit();
    const ls = this.lines();
    // nový řádek pokračuje stejným zpěvákem; za nadpisem / poznámkou začíná obyčejný řádek
    let prefix = '';
    if (kind === 'line') { const m = RE_SINGER.exec((ls[i] || '').trim()); if (m) prefix = '@' + m[1] + ' '; }
    ls.splice(i + 1, 0, after ? prefix + after : '');
    this.ed.src = ls.join('\n');
    this.ed.changed();
    this.pushHist();
    this.editing = { line: i + 1, caret: 'start', prefix };
    this.render();
  }
  moveEdit(d) {
    this.syncEdit();
    const idx = this.targets.findIndex(t => t.line === this.editing.line && t.kind !== 'repeat');
    let j = idx + d;
    while (j >= 0 && j < this.targets.length && !this.editable(this.targets[j])) j += d;
    const line = this.editing.line;
    this.editing = null;
    this.render(); // prázdný řádek už není potřeba zobrazovat
    const t = this.targets[j];
    if (t && this.editable(t)) { this.editing = { line: t.line, caret: 'end' }; this.curKey = t.key; this.render(); }
    else { this.curLine = line; this.wrap.focus({ preventScroll: true }); }
  }
  joinPrev() {
    const i = this.editing.line, ls = this.lines();
    if (i === 0) return;
    const info = this.info();
    const prev = ls[i - 1], cur = ls[i];
    const curBody = splitLine(cur, this.editKind).body;
    if (!prev.trim()) {
      // smazat mezeru mezi slokami
      ls.splice(i - 1, 1);
      this.ed.src = ls.join('\n'); this.ed.changed(); this.pushHist();
      this.editing = { line: i - 1, caret: 'start' };
      return this.render();
    }
    if (info[i - 1] && info[i - 1].kind === 'line' && this.editKind === 'line') {
      const pb = splitLine(prev, 'line').body;
      const caret = visibleLength(pb);
      ls[i - 1] = joinLine(prev, 'line', (pb + (pb && curBody ? ' ' : '') + curBody).replace(/\s+$/, ''));
      ls.splice(i, 1);
      this.ed.src = ls.join('\n'); this.ed.changed(); this.pushHist();
      this.editing = { line: i - 1, caret: caret + (pb && curBody ? 1 : 0) };
      return this.render();
    }
    if (!curBody) {
      ls.splice(i, 1);
      this.ed.src = ls.join('\n'); this.ed.changed(); this.pushHist();
      const kind = info[i - 1] && info[i - 1].kind;
      this.editing = ['line', 'chords', 'section', 'note', 'mus'].includes(kind) ? { line: i - 1, caret: 'end' } : null;
      this.curLine = i - 1;
      return this.render();
    }
  }
  joinNext() {
    const i = this.editing.line, ls = this.lines();
    if (i >= ls.length - 1) return;
    const info = this.info();
    this.syncEdit();
    const cur = this.lines()[i];
    if (!ls[i + 1].trim()) { ls.splice(i + 1, 1); }
    else if (info[i + 1] && info[i + 1].kind === 'line' && this.editKind === 'line') {
      const cb = splitLine(cur, 'line').body, nb = splitLine(ls[i + 1], 'line').body;
      ls[i] = joinLine(cur, 'line', cb + (cb && nb ? ' ' : '') + nb);
      ls.splice(i + 1, 1);
      this.editing.caret = visibleLength(cb);
    } else return;
    this.ed.src = ls.join('\n'); this.ed.changed(); this.pushHist();
    if (typeof this.editing.caret !== 'number') this.editing.caret = this.caretOffset();
    this.render();
  }

  /* ---------- Vložení textu ---------- */
  onPaste(e) {
    const t = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
    e.preventDefault();
    if (!t) return;
    if (this.editing && !t.includes('\n')) { document.execCommand('insertText', false, t); return; }
    const clean = cleanText(t);
    this.insertText(clean);
    toast('Vložený text vyčištěn – Ctrl+Z vrátí.', 'ok');
  }
  /* víc řádků za vybraný řádek (do prázdné písně celý text) */
  insertText(text) {
    let ls;
    if (this.editing) {
      this.syncEdit();
      const i = this.editing.line;
      this.editing = null;
      ls = this.lines();
      const add = text.split('\n');
      if (!stripMarkupBody(ls[i])) ls.splice(i, 1, ...add); else ls.splice(i + 1, 0, ...add);
      this.curLine = i + add.length - 1;
    } else if (!this.ed.src.trim()) {
      ls = text.split('\n');
      this.curLine = 0;
    } else {
      ls = this.lines();
      const c = this.cur();
      const at = c ? this.afterTarget(c) : ls.length;
      const add = text.split('\n');
      ls.splice(at, 0, ...add);
      this.curLine = at + add.length - 1;
    }
    this.curKey = null;
    this.followCur = true;
    this.commit(ls.join('\n'));
    this.wrap.focus({ preventScroll: true });
  }
  /* vložit řádky za / před vybraný cíl a vybrat první z nich */
  insertLines(add, { before = false, edit = false } = {}) {
    this.finishEdit(true);
    const ls = this.lines();
    const c = this.cur();
    let at = !c ? ls.length : before ? c.line : this.afterTarget(c);
    if (!this.ed.src.trim()) { ls.length = 0; at = 0; }
    ls.splice(at, 0, ...add);
    this.curKey = null;
    this.curLine = at;
    this.followCur = true;
    this.ed.src = ls.join('\n');
    this.pushHist();
    this.ed.changed();
    if (edit) { this.editing = { line: at, caret: 'end' }; }
    this.render();
    if (!edit) {
      // vybrat první vložený řádek (nová stránka sama vidět není → řádek za ní)
      const ti = this.targets.findIndex(t => t.line >= at);
      if (ti >= 0) this.select(ti);
      this.wrap.focus({ preventScroll: true });
    }
  }

  /* ---------- Akce s vybranými řádky ---------- */
  srcLinesOf(targets) {
    const set = new Set();
    for (const t of targets) if (t.kind !== 'repeat' && t.kind !== 'musblock') set.add(t.line);
    return [...set];
  }
  singersOf(t) {
    const ls = this.lines(), info = this.info();
    const s = (ls[t.line] || '').trim();
    let m, own = [];
    if (t.kind === 'section' && s.startsWith('##')) own = parseSectionLine(s).singers;
    else if ((m = RE_SINGER.exec(s))) own = parseCodes(m[1]);
    const inh = info[t.line] && info[t.line].inherited ? info[t.line].singers || [] : [];
    return { own, inh };
  }
  /* code = kód zpěváka nebo null (nikdo); mode set/toggle/force/clear */
  assignSinger(code, mode = 'force') {
    if (this.editing && this.editEl) {
      const sel = window.getSelection();
      if (sel.rangeCount && !sel.isCollapsed && this.editEl.contains(sel.anchorNode) && sel.toString().trim()
        && sel.toString().trim() !== this.editEl.textContent.replace(/\u200b/g, '').trim()) {
        // zpěvák jen pro označená slova (jde měnit opakovaně, „Nikdo“ ho zruší)
        this.wordSinger(sel.getRangeAt(0), code);
        this.syncEdit(); this.pushHist();
        return;
      }
      this.syncEdit();
      const ls = this.lines();
      ls[this.editing.line] = applySingerToLine(ls[this.editing.line], code, code ? mode : 'clear');
      this.ed.src = ls.join('\n'); this.ed.changed(); this.pushHist();
      this.editing.caret = this.caretOffset();
      return this.render();
    }
    const targets = this.selTargets();
    if (!targets.length) return toast('Nejdřív vyber řádek (šipkami nebo kliknutím).', 'warn');
    const ls = this.lines();
    for (const i of this.srcLinesOf(targets)) ls[i] = applySingerToLine(ls[i], code, code ? mode : 'clear');
    this.commit(ls.join('\n'));
  }
  /* Tlačítko zpěváka v liště: přepínač. Označená slova s tímto zpěvákem → barvu zrušit, jinak nastavit;
     řádky: když ho mají všechny vybrané, odebere se, jinak se přidá (nikdo = všichni vypnutí) */
  toggleSinger(code) {
    if (this.editing && this.editEl) {
      const sel = window.getSelection();
      if (sel.rangeCount && !sel.isCollapsed && this.editEl.contains(sel.anchorNode) && sel.toString().trim()
        && sel.toString().trim() !== this.editEl.textContent.replace(/\u200b/g, '').trim()) {
        const host = selSingerHost(sel, this.editEl);
        const same = host && host.dataset.c === code && host.textContent.trim() === sel.toString().trim();
        return this.assignSinger(same ? null : code, 'force');
      }
    }
    const ts = this.editing ? [this.cur()].filter(Boolean) : this.selTargets();
    const all = ts.length && ts.every(t => this.singersOf(t).own.includes(code));
    this.assignSinger(code, all ? 'remove' : 'add');
  }
  /* Zpěvák pro označená slova: stávající barvu nahradí (nevnořuje), code = null barvu zruší */
  wordSinger(r, code) {
    const el = this.editEl;
    const color = code ? (Store.singerMap()[code] || {}).color || '' : '';
    const anc = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode;
    const host = anc.closest('.sg-in');
    const hostIn = host && el.contains(host) ? host : null;
    // označený je přesně celý úsek s barvou → jen změnit barvu
    if (hostIn && hostIn.textContent.trim() === r.toString().trim()) {
      if (code) { hostIn.dataset.c = code; hostIn.style.color = color; selectContents(hostIn); }
      else hostIn.replaceWith(...hostIn.childNodes);
      return;
    }
    const frag = r.extractContents();
    for (const s of [...frag.querySelectorAll('.sg-in')]) s.replaceWith(...s.childNodes);
    const node = code ? h('span', { class: 'sg-in', 'data-c': code, style: { color } }, frag) : frag;
    const first = code ? node : node.firstChild, last = code ? node : node.lastChild;
    if (hostIn) {
      // rozdělit původní barevný úsek: [před][nové][za]
      const tail = document.createRange();
      tail.setStart(r.startContainer, r.startOffset);
      tail.setEnd(hostIn, hostIn.childNodes.length);
      const after = hostIn.cloneNode(false);
      after.appendChild(tail.extractContents());
      hostIn.after(after);
      hostIn.after(node);
      if (!hostIn.textContent) hostIn.remove();
      if (!after.textContent) after.remove();
    } else r.insertNode(node);
    if (first && last) {
      const nr = document.createRange(); nr.setStartBefore(first); nr.setEndAfter(last);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(nr);
    }
  }
  singerByNumber(n, shift) {
    if (n === 0) return this.assignSinger(null, 'clear');
    const s = Store.singers()[n - 1];
    if (s) this.assignSinger(s.code, shift ? 'toggle' : 'force');
  }
  /* ← → : nikdo → první zpěvák → … → poslední → nikdo */
  cycleSinger(d) {
    const t = this.cur();
    if (!t) return;
    if (!['line', 'chords', 'section'].includes(t.kind)) { toast('Zpěváka jde nastavit u řádku nebo u nadpisu sekce.', 'warn', 1800); return; }
    const codes = Store.singers().map(s => s.code);
    const own = this.singersOf(t).own;
    const i = own.length === 1 ? codes.indexOf(own[0]) : -1;
    let j = i + d;
    if (j >= codes.length) j = -1;
    if (j < -1) j = codes.length - 1;
    this.assignSinger(j < 0 ? null : codes[j], j < 0 ? 'clear' : 'force');
  }
  deleteLines() {
    this.finishEdit(true);   // smazání z lišty uprostřed psaní: nejdřív dopsat
    const targets = this.selTargets();
    if (!targets.length) return;
    const ls = this.lines();
    const del = new Set();
    for (const t of targets) {
      del.add(t.line);
      if (t.kind === 'musblock') { let j = t.line + 1; while (j < ls.length && ls[j].trim() !== '%%') del.add(j++); del.add(j); }
    }
    this.curLine = Math.min(...del);
    this.curKey = null;
    this.anchorKey = null;
    this.commit(ls.filter((l, i) => !del.has(i)).join('\n'));
    toast('Smazáno – Ctrl+Z vrátí.', 'ok', 1500);
  }

  /* Posunout vybrané řádky o jeden řádek nahoru (-1) / dolů (+1) */
  moveLines(d) {
    this.finishEdit(true);
    const targets = this.selTargets();
    if (!targets.length) return;
    const ls = this.lines();
    let start = Math.min(...targets.map(t => t.line));
    let end = Math.max(...targets.map(t => t.kind === 'musblock' ? this.afterTarget(t) - 1 : t.line));
    if (d < 0 ? start === 0 : end >= ls.length - 1) return;
    const curLine = this.cur().line, anchor = this.anchorKey != null && this.targets.find(t => t.key === this.anchorKey);
    const anchorLine = anchor ? anchor.line : null;
    if (d < 0) { const [x] = ls.splice(start - 1, 1); ls.splice(end, 0, x); }
    else { const [x] = ls.splice(end + 1, 1); ls.splice(start, 0, x); }
    this.ed.src = ls.join('\n');
    this.pushHist();
    this.ed.changed();
    this.curKey = null; this.anchorKey = null; this.curLine = curLine + d; this.followCur = true;
    this.render();
    const find = line => this.targets.find(t => t.line === line && t.kind !== 'repeat') || this.targets.find(t => t.line === line);
    const c = find(curLine + d), a = anchorLine != null ? find(anchorLine + d) : null;
    if (c) { this.curKey = c.key; this.anchorKey = a ? a.key : null; this.page = c.page; this.paintPage(); }
  }

  /* Formát: v psaní na označený text, jinak na celé vybrané řádky */
  /* kind: bold, italic, upper, lower, bigger / smaller (o 10 %), size (val = procenta) */
  format(kind, val) {
    if (this.editing && this.editEl) {
      const sel = window.getSelection();
      const has = sel.rangeCount && !sel.isCollapsed && this.editEl.contains(sel.anchorNode);
      if (has) {
        if (kind === 'bold' || kind === 'italic') this.toggleTag(kind === 'bold' ? 'B' : 'I');
        else if (kind === 'bigger' || kind === 'smaller' || kind === 'size') this.sizeSel(p => sizeStep(p, kind, val));
        else if (kind === 'upper' || kind === 'lower') { document.execCommand('insertText', false, kind === 'upper' ? sel.toString().toLocaleUpperCase('cs') : sel.toString().toLocaleLowerCase('cs')); }
        this.syncEdit(); this.pushHist(); this.ed.onSelChange();
        return;
      }
      this.syncEdit();
      const line = this.editing.line;
      const caret = this.caretOffset();
      const ls = this.lines();
      ls[line] = formatLine(ls[line], kind, val);
      this.ed.src = ls.join('\n'); this.ed.changed(); this.pushHist();
      this.editing.caret = caret;
      return this.render();
    }
    this.formatLines(kind, val);
  }
  formatLines(kind, val) {
    const targets = this.selTargets();
    if (!targets.length) return toast('Nejdřív vyber řádek.', 'warn');
    const ls = this.lines();
    for (const i of this.srcLinesOf(targets)) ls[i] = formatLine(ls[i], kind, val);
    this.commit(ls.join('\n'));
  }
  /* základní velikost písma řádku (px na obrazovce čtečky, bez vlastní velikosti slov) */
  linePx() {
    const el = this.editEl || this.elsOf(this.cur())[0];
    return el ? parseFloat(getComputedStyle(el).fontSize) || 0 : 0;
  }
  /* velikost písma v místě kurzoru / vybraného řádku (v procentech) */
  sizeAt() {
    // označená slova: jejich skutečná velikost (všechny vnořené velikosti dohromady), jinak velikost celého řádku
    const sel = window.getSelection();
    if (this.editing && this.editEl && sel.rangeCount && !sel.isCollapsed && this.editEl.contains(sel.anchorNode)) return Math.round(this.szChain(sel.anchorNode));
    const t = this.cur();
    if (!t) return 100;
    const src = this.lines()[t.line] || '';
    const info = parseSong(src).lines[0] || {};
    const m = /^\{([+-]{1,2}|\d{2,3}%):[\s\S]*\}$/.exec(splitLine(src, info.kind || 'line').body);
    return m ? szPct(m[1]) : 100;
  }
  /* součin velikostí všech značek {N%:…} od uzlu až k psanému řádku (v %) */
  szChain(node) {
    let p = 100;
    for (let n = node && node.nodeType === 1 ? node : node && node.parentNode; n && n !== this.editEl; n = n.parentNode) if (n.classList && n.classList.contains('sz')) p *= (+n.dataset.p || 100) / 100;
    return p;
  }
  toggleTag(tag) {
    const sel = window.getSelection();
    const node = n => (n.nodeType === 1 ? n : n.parentNode);
    const a = node(sel.anchorNode).closest(tag), f = node(sel.focusNode).closest(tag);
    if (a && a === f && this.editEl.contains(a)) { a.replaceWith(...a.childNodes); return; }
    const r = sel.getRangeAt(0);
    const el = document.createElement(tag.toLowerCase());
    try { el.appendChild(r.extractContents()); r.insertNode(el); } catch (e) { return; }
    selectContents(el);
  }
  /* velikost označených slov: fn(stará procenta) → nová procenta (100 % = značku zrušit) */
  /* velikost označených slov: fn(skutečná velikost v %) → nová skutečná velikost (vzhledem k písmu řádku) */
  sizeSel(fn) {
    const sel = window.getSelection();
    const anc = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentNode;
    const host = anc.closest('.sz');
    const set = (el, p) => { el.dataset.p = p; el.style.fontSize = p / 100 + 'em'; };
    // změnit existující úsek jen tehdy, když je označený celý (jinak by se změnil celý obalený řádek)
    if (host && this.editEl.contains(host) && host.textContent.replace(/\u200b/g, '').trim() === sel.toString().trim()) {
      const outer = this.szChain(host.parentNode);   // velikost kolem (např. celý řádek 90 %)
      const p = szClamp(fn(outer * (+host.dataset.p || 100) / 100) / outer * 100);
      if (Math.abs(p - 100) < 1) host.replaceWith(...host.childNodes); else set(host, p);
      return;
    }
    const outer = this.szChain(anc);
    const p = szClamp(fn(outer) / outer * 100);
    if (Math.abs(p - 100) < 1) return;
    const r = sel.getRangeAt(0);
    const el = h('span', { class: 'sz' });
    set(el, p);
    try { el.appendChild(r.extractContents()); r.insertNode(el); } catch (e) { return; }
    selectContents(el);
  }
  insertChord(name) {
    if (this.editing && this.editEl) {
      const sel = window.getSelection();
      if (sel.rangeCount && this.editEl.contains(sel.anchorNode)) {
        const r = sel.getRangeAt(0);
        r.collapse(true);
        const ch = h('span', { class: 'vchord', contenteditable: 'false', 'data-ch': name });
        r.insertNode(ch);
        r.setStartAfter(ch); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
        this.syncEdit(); this.pushHist();
        return;
      }
    }
    const t = this.cur();
    if (!t || !['line', 'chords'].includes(t.kind)) return toast('Vyber řádek s textem.', 'warn');
    const ls = this.lines();
    const { prefix, body } = splitLine(ls[t.line], 'line');
    ls[t.line] = prefix + '[' + name + ']' + body;
    this.commit(ls.join('\n'));
  }

  /* ---------- Nabídka (OK / pravé tlačítko) ---------- */
  openMenu(x, y) {
    this.closeMenu();
    const t = this.cur();
    if (!t) return;
    const items = this.ed.lineMenuItems(t);
    this.menuStack = [{ items, sel: 0 }];
    this.menu = h('div', { class: 'line-menu', role: 'menu' });
    this.wrap.appendChild(this.menu);
    this.menuAt = { x, y };
    this.paintMenu();
  }
  paintMenu() {
    const top = this.menuStack[this.menuStack.length - 1];
    const m = this.menu;
    m.innerHTML = '';
    if (this.menuStack.length > 1) m.appendChild(h('div', { class: 'lm-head', onclick: () => this.menuBack() }, '◀ ' + top.title));
    else m.appendChild(h('div', { class: 'lm-head' }, this.describe(this.cur())));
    top.items.forEach((it, i) => {
      if (it.sep) { m.appendChild(h('div', { class: 'lm-sep' })); return; }
      m.appendChild(h('div', {
        class: 'lm-item' + (i === top.sel ? ' on' : '') + (it.danger ? ' danger' : '') + (it.active ? ' active' : ''),
        style: it.color ? { '--c': it.color } : null,
        onmouseenter: () => { top.sel = i; this.paintMenuSel(); },
        onclick: () => { top.sel = i; this.menuRun(); },
      }, it.color ? h('span', { class: 'led' }) : null, h('span', { class: 'lm-l' }, it.label), it.items ? h('span', { class: 'lm-sub' }, '▸') : it.hint ? h('kbd', {}, it.hint) : null));
    });
    m.appendChild(h('div', { class: 'lm-foot' }, '↑↓ vybrat · OK potvrdit · ← zpět'));
    // umístění vedle vybraného řádku (nebo u myši)
    const wr = this.wrap.getBoundingClientRect();
    let x, y;
    if (this.menuAt && this.menuAt.x != null) { x = this.menuAt.x - wr.left; y = this.menuAt.y - wr.top; }
    else {
      const el = this.elsOf(this.cur())[0];
      const r = el ? el.getBoundingClientRect() : wr;
      x = Math.min(r.left + 40, wr.left + wr.width / 2) - wr.left;
      y = r.bottom - wr.top + 6;
    }
    m.style.left = Math.max(6, Math.min(x, wr.width - m.offsetWidth - 6)) + 'px';
    m.style.top = Math.max(6, Math.min(y, wr.height - m.offsetHeight - 6)) + 'px';
  }
  paintMenuSel() {
    const top = this.menuStack[this.menuStack.length - 1];
    $$('.lm-item', this.menu).forEach((e, i) => e.classList.toggle('on', top.items.filter(x => !x.sep)[i] === top.items[top.sel]));
  }
  menuKey(e) {
    const top = this.menuStack[this.menuStack.length - 1];
    const move = d => {
      let j = top.sel;
      do { j = (j + d + top.items.length) % top.items.length; } while (top.items[j].sep);
      top.sel = j; this.paintMenuSel();
    };
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); return move(1);
      case 'ArrowUp': e.preventDefault(); return move(-1);
      case 'Enter': case 'ArrowRight': case ' ': e.preventDefault(); return this.menuRun(e.key === 'ArrowRight');
      case 'ArrowLeft': case 'Escape': case 'Backspace': e.preventDefault(); return this.menuBack();
    }
  }
  menuRun(onlySub) {
    const top = this.menuStack[this.menuStack.length - 1];
    const it = top.items[top.sel];
    if (!it || it.sep) return;
    if (it.items) {
      const items = typeof it.items === 'function' ? it.items() : it.items;
      if (!items.length) return toast(it.empty || 'Nic k výběru.', 'warn');
      this.menuStack.push({ items, sel: Math.max(0, items.findIndex(x => x.active)), title: it.label });
      return this.paintMenu();
    }
    if (onlySub) return;
    this.closeMenu();
    it.action();
  }
  menuBack() {
    if (this.menuStack.length > 1) { this.menuStack.pop(); this.paintMenu(); } else this.closeMenu();
  }
  closeMenu() {
    if (!this.menu) return;
    this.menu.remove();
    this.menu = null;
    this.wrap.focus({ preventScroll: true });
  }
}

/* ===== Pomocníci pro řádky zdroje ===== */
function selectContents(el) {
  const r = document.createRange(); r.selectNodeContents(el);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
}
/* Rozdělí řádek zdroje na značky (zachovat) a viditelný text (upravovat) */
function splitLine(src, kind) {
  const t = String(src || '').trim();
  let m;
  if (kind === 'section' && t.startsWith('##')) { const sec = parseSectionLine(t); return { prefix: '## ', body: sec.name, suffix: formatSectionLine(sec).slice(('## ' + sec.name).length) }; }
  if (kind === 'note' && (m = RE_NOTE.exec(t))) return { prefix: '// ', body: m[1], suffix: '' };
  if (kind === 'mus' && (m = RE_MUS.exec(t))) return { prefix: '%' + m[1] + ' ', body: m[2], suffix: '' };
  if ((m = RE_SINGER.exec(t))) return { prefix: '@' + m[1] + ' ', body: m[2], suffix: '' };
  return { prefix: '', body: t, suffix: '' };
}
function joinLine(src, kind, body) {
  const p = splitLine(src, kind);
  if (kind === 'section' && !body.trim()) body = 'Sekce';
  if (!body.trim() && kind === 'line') return '';
  return p.prefix + body + p.suffix;
}
/* text řádku bez značek (prázdný = mezera mezi slokami) */
function stripMarkupBody(src) {
  const t = String(src || '').trim();
  const m = RE_SINGER.exec(t);
  return (m ? m[2] : t).replace(/​/g, '').trim();
}
function visibleLength(body) {
  const d = document.createElement('div');
  d.innerHTML = veInline(body, Store.singerMap());
  return d.textContent.replace(/​/g, '').length;
}
/* úsek s barvou zpěváka, ve kterém je kurzor / označení (i když je označený celý úsek) */
function selSingerHost(sel, root) {
  if (!sel.rangeCount || !root.contains(sel.anchorNode)) return null;
  const r = sel.getRangeAt(0);
  const one = r.startContainer === r.endContainer && r.endOffset - r.startOffset === 1 && r.startContainer.childNodes[r.startOffset];
  const n = one && one.nodeType === 1 ? one : r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode;
  const host = n.closest('.sg-in');
  return host && root.contains(host) ? host : null;
}
/* A+ / A− mění velikost po 10 % (ze starších stupňů na nejbližší desítku), size = zadaná procenta */
function sizeStep(p, kind, val) {
  if (kind === 'size') return +val || 100;
  return kind === 'bigger' ? Math.floor(p / 10) * 10 + 10 : Math.ceil(p / 10) * 10 - 10;
}
/* Formát celého řádku: tučně, kurzíva, velikost, VELKÁ, malá */
function formatLine(src, kind, val) {
  const info = parseSong(src).lines[0] || {};
  if (!['line', 'chords', 'note', 'section', 'mus'].includes(info.kind)) return src;
  const sp = splitLine(src, info.kind);
  let b = sp.body;
  if (kind === 'bold') b = /^\*\*[\s\S]*\*\*$/.test(b) ? b.slice(2, -2) : '**' + b + '**';
  else if (kind === 'italic') b = /^\*(?!\*)[\s\S]*\*$/.test(b) && !/^\*\*/.test(b) ? b.slice(1, -1) : '*' + b + '*';
  else if (kind === 'bigger' || kind === 'smaller' || kind === 'size') {
    const m = /^\{([+-]{1,2}|\d{2,3}%):([\s\S]*)\}$/.exec(b);
    const p = szClamp(sizeStep(m ? szPct(m[1]) : 100, kind, val));
    if (m) b = m[2];
    b = p === 100 ? b : `{${szMark(p)}:${b}}`;
  } else if (kind === 'upper' || kind === 'lower') {
    // jen text, ne značky ([Am], {T:…})
    b = b.split(/(\[[^\]]*\]|\{[^:}]*:|\})/).map((part, i) => i % 2 ? part : (kind === 'upper' ? part.toLocaleUpperCase('cs') : part.toLocaleLowerCase('cs'))).join('');
  }
  return sp.prefix + b + sp.suffix;
}

/* Řádek se značkami → HTML pro psaní (akordy jako nepsatelné značky nad textem) */
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
    if (tag === 'BR' || n.classList.contains('ve-tag') || n.classList.contains('badge') || n.classList.contains('mtag')) continue;
    if (n.classList.contains('vchord')) { out += '[' + n.dataset.ch + ']'; continue; }
    const inner = serializeInline(n);
    if (!inner) continue;
    if (n.classList.contains('sg-in') && n.dataset.c) out += '{' + n.dataset.c + ':' + inner + '}';
    else if (n.classList.contains('sz') && n.dataset.p) out += '{' + szMark(+n.dataset.p) + ':' + inner + '}';
    else if (n.classList.contains('tc') && n.dataset.tc) out += '{' + n.dataset.tc + ':' + inner + '}';
    else if (tag === 'B' || tag === 'STRONG' || (n.style && (n.style.fontWeight === 'bold' || +n.style.fontWeight >= 600))) out += '**' + inner + '**';
    else if (tag === 'I' || tag === 'EM' || (n.style && n.style.fontStyle === 'italic')) out += '*' + inner + '*';
    else if (tag === 'U') out += '__' + inner + '__';
    else out += inner;
  }
  return out;
}
