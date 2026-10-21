'use strict';
/* ===== Vykreslení stránky čtečky (stejné v náhledu i ve čtečce) ===== */
const Render = {
  measureBox: null,

  getMeasureBox() {
    if (!this.measureBox) {
      this.measureBox = h('div', { id: 'measure', 'aria-hidden': 'true' });
      document.body.appendChild(this.measureBox);
    }
    return this.measureBox;
  },

  /* Vytvoří „plátno“ o rozměru monitoru čtečky */
  makeStage(tpl, W, H) {
    const st = h('div', { class: 'stage' });
    this.applyTemplate(st, tpl, W, H);
    const head = h('div', { class: 'st-head' }, h('div', { class: 'st-h-left' }), h('div', { class: 'st-h-right' }));
    const body = h('div', { class: 'st-body' });
    const foot = h('div', { class: 'st-foot' }, h('div', { class: 'st-f-left' }), h('div', { class: 'st-f-right' }));
    for (let c = 0; c < Math.max(1, tpl.columns | 0); c++) body.appendChild(h('div', { class: 'st-col' }));
    st.append(head, body, foot);
    if (!tpl.showHeader) head.style.display = 'none';
    if (!tpl.showFooter) foot.style.display = 'none';
    return st;
  },

  applyTemplate(st, tpl, W, H) {
    const s = st.style;
    s.width = W + 'px'; s.height = H + 'px';
    s.setProperty('--fs', tpl.fontSize + 'px');
    s.setProperty('--k', 1);
    s.background = tpl.bgColor;
    s.color = tpl.textColor;
    s.fontFamily = `"${tpl.fontFamily}", Arial, sans-serif`;
    s.setProperty('--fw', tpl.fontWeight);
    s.setProperty('--lh', tpl.lineHeight);
    s.setProperty('--ls', (tpl.letterSpacing || 0) + 'em');
    s.setProperty('--align', tpl.align);
    s.setProperty('--padx', tpl.padX + 'px');
    s.setProperty('--pady', tpl.padY + 'px');
    s.setProperty('--colgap', tpl.colGap + 'px');
    s.setProperty('--sec-color', tpl.sectionColor);
    s.setProperty('--sec-scale', tpl.sectionScale);
    s.setProperty('--note-color', tpl.noteColor);
    s.setProperty('--gap', tpl.stanzaGap + 'em');
    s.setProperty('--bar', tpl.barWidth + 'px');
    s.setProperty('--hs', tpl.headerSize + 'px');
    s.setProperty('--hcolor', tpl.headerColor || tpl.sectionColor);
    st.classList.toggle('upper', !!tpl.uppercase);
    // místo pro proužky (aby řádky lícovaly), když je má aspoň jeden zpěvák
    const shows = Store.singers().map(sg => singerShowOf(tpl, sg.code));
    st.classList.toggle('with-bar', shows.some(x => x.barL));
    st.classList.toggle('with-bar-r', shows.some(x => x.barR));
    st.classList.toggle('with-bg', shows.some(x => x.bg));
    st.classList.toggle('hide-sections', !tpl.showSections);
    st.classList.toggle('hide-notes', !tpl.showNotes);
  },

  blockEl(b, tpl, singerMap) {
    if (b.type === 'gap') return h('div', { class: 'b-gap' });
    if (b.type === 'mus' || b.type === 'musblock') {
      const im = Store.instrumentMap();
      const ins = b.inst.map(c => im[c]).filter(Boolean);
      const color = ins[0] ? ins[0].color : '#9aa0a6';
      const tag = h('span', { class: 'mtag' }, ins.map(x => x.name).join(' + ') || b.inst.join('+'));
      if (b.type === 'mus') return h('div', { class: 'b-mus', 'data-src': b.src, style: { '--ic': color } }, tag, h('span', { html: ' ' + (hasChords(b.text) ? chordedHtml(b.text, singerMap) : inlineHtml(b.text, singerMap)) }));
      return h('div', { class: 'b-musblock', 'data-src': b.src, style: { '--ic': color } },
        h('div', {}, tag, b.title ? ' ' + b.title : ''), h('pre', {}, b.lines.join('\n')));
    }
    if (b.type === 'chords') return h('div', { class: 'b-line b-chordline', 'data-src': b.src, style: { '--chc': CHORD_COLOR }, html: chordedHtml(b.text, singerMap) });
    if (b.type === 'break') return h('div', { class: 'b-gap' });
    if (b.type === 'section') {
      const sg = b.singers.map(c => singerMap[c]).filter(Boolean);
      return h('div', { class: 'b-sec' + (b.repeat ? ' rep' : ''), 'data-src': b.src },
        b.text, sg.length ? h('span', { class: 'sec-sg' }, ' · ' + sg.map(s => s.name).join(' + ')) : null);
    }
    if (b.type === 'note') return h('div', { class: 'b-note' + (b.warn ? ' warn' : '') + (b.private ? ' private' : ''), 'data-src': b.src, html: inlineHtml(b.text, singerMap) });
    // řádek textu
    const sgs = b.singers.map(c => singerMap[c]).filter(Boolean);
    const el = h('div', { class: 'b-line', 'data-src': b.src });
    const bySec = tpl.textBy === 'section';
    if (bySec) { const k = sectionKind(b.sec); if (k) el.style.color = tpl[k + 'Color'] || ''; }
    if (sgs.length) {
      // každý zpěvák má své označení (proužek vlevo / vpravo, podklad, barva písma)
      const sh = sgs.map(sg => [sg, singerShowOf(tpl, sg.code)]);
      const pick = k => sh.filter(x => x[1][k]).map(x => x[0].color);
      const txt = sh.find(x => x[1].text);
      if (txt && !bySec) el.style.color = txt[0].color;
      if (sgs.some(s => s.bold)) el.style.fontWeight = 900;
      if (sgs.some(s => s.italic)) el.style.fontStyle = 'italic';
      const L = pick('barL'), R = pick('barR');
      if (L.length) { el.style.setProperty('--barbg', stripes(L)); el.classList.add('bl'); }
      if (R.length) { el.style.setProperty('--barbg-r', stripes(R)); el.classList.add('br'); }
      // podklad: zpěvák s proužkem vlevo začíná vlevo, s proužkem vpravo končí vpravo, barvy se uprostřed slijí přechodem
      const side = x => (x[1].barL ? 0 : 1) + (x[1].barR ? 1 : 0);
      const B = sh.filter(x => x[1].bg).sort((a, b) => side(a) - side(b)).map(x => hexToRgba(x[0].color, 0.22));
      if (B.length) { el.style.setProperty('--tint', blend(B)); el.classList.add('bgt'); }
      el.classList.add('has-sg');
    }
    let inner = b.showChords ? chordedHtml(b.text, singerMap) : (inlineHtml(b.chords ? stripChords(b.text) : b.text, singerMap) || '&nbsp;');
    if (b.showChords) el.classList.add('has-chords');
    el.innerHTML = inner;
    // označená slova jiného zpěváka: stejné označení jako celé řádky (barva písma / podklad), proužky jen u řádků
    for (const w of el.querySelectorAll('.sg-in')) {
      const sg = singerMap[parseCodes(w.dataset.c)[0]];
      if (!sg) continue;
      const o = singerShowOf(tpl, sg.code);
      w.style.color = o.text || !o.bg ? sg.color : '';
      if (o.bg) { w.style.background = hexToRgba(sg.color, 0.35); w.classList.add('sg-bg'); }
    }
    return el;
  },

  /* Spočítá rozdělení písně na stránky. mus = vrstvy pro muzikanty (null = čtečka: nic z nich)
     opts.screen = pro kterou obrazovku (platí jen její konce stránek), opts.note = soukromá poznámka,
     opts.mine = kód zpěváka, jehož řádky se zvýrazní (ostatní ztlumené) */
  layout(song, tpl, W, H, mus = null, opts = {}) {
    const parsed = parseSong(song.text);
    const singerMap = Store.singerMap();
    const scr = opts.screen || 'main';
    let blocks = filterForView(parsed.blocks.filter(b => b.type !== 'break' || b.screen === scr), mus);
    while (blocks.length && blocks[0].type === 'break') blocks.shift();
    if (opts.note) blocks = [{ type: 'note', text: opts.note, private: true, src: -1 }, ...blocks];
    const cols = Math.max(1, tpl.columns | 0);
    const tryK = k => this._chunk(blocks, tpl, W, H, k, singerMap, cols);
    let k = 1, res = tryK(1);
    if (tpl.fit === 'shrink' && res.pages.length > 1) {
      const min = Math.min(1, Math.max(0.3, +tpl.minScale || 0.6));
      // binární hledání největšího zmenšení, při kterém se vejde na 1 stránku
      let lo = min, hi = 1, best = null;
      const atMin = tryK(min);
      if (atMin.pages.length > 1) { k = min; res = atMin; }
      else {
        best = { k: min, res: atMin };
        for (let it = 0; it < 7; it++) {
          const mid = (lo + hi) / 2;
          const r = tryK(mid);
          if (r.pages.length <= 1) { best = { k: mid, res: r }; lo = mid; } else hi = mid;
        }
        k = best.k; res = best.res;
      }
    }
    return { blocks, pages: res.pages, k, cols, singerMap, mine: opts.mine || '' };
  },

  _chunk(blocks, tpl, W, H, k, singerMap, cols) {
    const box = this.getMeasureBox();
    box.innerHTML = '';
    const st = this.makeStage(Object.assign({}, tpl, { columns: 1 }), W, H);
    st.style.setProperty('--k', k);
    const body = st.querySelector('.st-body');
    const col = st.querySelector('.st-col');
    const bodyW = W - 2 * tpl.padX;
    col.style.flex = '0 0 auto';
    col.style.width = ((bodyW - (cols - 1) * tpl.colGap) / cols) + 'px';
    st.querySelector('.st-h-left').textContent = 'Měření';
    st.querySelector('.st-f-left').textContent = 'Měření';
    const els = blocks.map(b => this.blockEl(b, tpl, singerMap));
    for (const e of els) col.appendChild(e);
    box.appendChild(st);
    const availH = body.clientHeight;
    const top = els.map(e => e.offsetTop);
    const bot = els.map((e, i) => top[i] + e.offsetHeight);
    const hidden = i => els[i].offsetHeight === 0 && blocks[i].type !== 'gap';

    const chunks = [];
    let cur = null, top0 = 0;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.type === 'break') { if (cur && cur.idx.length) { cur.pageEnd = true; chunks.push(cur); } cur = null; continue; }
      if (hidden(i)) { if (cur) cur.idx.push(i); continue; }
      if (!cur) { if (b.type === 'gap') continue; cur = { idx: [] }; top0 = top[i]; }
      if (bot[i] - top0 > availH && cur.idx.some(j => !hidden(j))) {
        let carry = [];
        while (cur.idx.length) {
          const last = cur.idx[cur.idx.length - 1];
          const lb = blocks[last];
          if (lb.type === 'section' || lb.type === 'gap' || hidden(last)) carry.unshift(cur.idx.pop()); else break;
        }
        if (!cur.idx.length) { cur.idx = carry; carry = []; }
        carry = carry.filter(j => blocks[j].type !== 'gap');
        chunks.push(cur);
        if (b.type === 'gap' && !carry.length) { cur = null; continue; }
        cur = { idx: carry };
        top0 = carry.length ? top[carry[0]] : top[i];
      }
      cur.idx.push(i);
    }
    if (cur && cur.idx.length) chunks.push(cur);
    if (!chunks.length) chunks.push({ idx: [] });
    const pages = [];
    let page = [];
    for (const c of chunks) {
      page.push(c.idx);
      if (page.length >= cols || c.pageEnd) { pages.push(page); page = []; }
    }
    if (page.length) pages.push(page);
    box.innerHTML = '';
    return { pages };
  },

  /* Vykreslí stránku do plátna */
  renderPage(stage, lay, tpl, pageIdx, info = {}) {
    stage.style.setProperty('--k', lay.k);
    const cols = $$('.st-col', stage);
    const page = lay.pages[pageIdx] || [];
    cols.forEach((col, ci) => {
      col.innerHTML = '';
      for (const i of (page[ci] || [])) {
        const b = lay.blocks[i];
        const el = this.blockEl(b, tpl, lay.singerMap); el.dataset.bi = i;
        // zvýraznit mé řádky: cizí ztlumit (řádky „všichni“ a bez zpěváka zůstanou)
        if (lay.mine && b.type === 'line' && b.singers.length && !b.singers.some(c => c === lay.mine || /všichni/i.test((lay.singerMap[c] || {}).name || ''))) el.classList.add('not-mine');
        col.appendChild(el);
      }
    });
    const hl = $('.st-h-left', stage), hr = $('.st-h-right', stage), fl = $('.st-f-left', stage), fr = $('.st-f-right', stage);
    hl.innerHTML = `<b>${esc(info.title || '')}</b>${info.artist ? ' <span class="dim">– ' + esc(info.artist) + '</span>' : ''}`;
    hr.innerHTML = [info.key ? 'ladění ' + esc(info.key) : '', info.tempo ? esc(info.tempo) + ' BPM' : '', info.pos ? esc(info.pos) : '']
      .filter(Boolean).join(' &nbsp;·&nbsp; ');
    const n = lay.pages.length;
    fl.innerHTML = n > 1 ? `strana ${pageIdx + 1}/${n}${pageIdx < n - 1 ? ' &nbsp;<span class="more">▼ pokračuje</span>' : ''}` : '';
    fr.innerHTML = pageIdx === n - 1 ? (info.next ? `Další: <b>${esc(info.next)}</b>` : (info.isLast ? '<span class="dim">konec playlistu</span>' : '')) : '';
  },

  /* Přizpůsobí plátno velikosti okna (zachová poměr stran) */
  /* rotate: otočení obrazu ve stupních (0/90/180/270) – když je monitor otočený, ale Windows ne */
  fit(stage, wrap, W, H, mirror = 'none', rotate = 0) {
    const r = wrap.getBoundingClientRect();
    const rot = (((+rotate || 0) % 360) + 360) % 360;
    const bw = rot % 180 ? H : W, bh = rot % 180 ? W : H;
    const s = Math.min(r.width / bw, r.height / bh) || 1;
    const mx = mirror === 'h' || mirror === 'hv' ? -1 : 1;
    const my = mirror === 'v' || mirror === 'hv' ? -1 : 1;
    stage.style.left = (r.width - W) / 2 + 'px';
    stage.style.top = (r.height - H) / 2 + 'px';
    stage.style.transformOrigin = '50% 50%';
    stage.style.transform = `rotate(${rot}deg) scale(${s * mx}, ${s * my})`;
    return s;
  },
};

/* Vlastní písmo konkrétní písně (přepíše šablonu jen pro tuto píseň) */
function applySongStyle(tpl, song) {
  const st = song && song.style;
  if (!st) return tpl;
  const t = Object.assign({}, tpl);
  if (st.fontFamily) t.fontFamily = st.fontFamily;
  if (st.sizePct && st.sizePct !== 100) t.fontSize = Math.round(t.fontSize * st.sizePct / 100);
  if (st.fontWeight) t.fontWeight = st.fontWeight;
  if (st.lineHeight) t.lineHeight = st.lineHeight;
  if (typeof st.stanzaGap === 'number') t.stanzaGap = st.stanzaGap;   // mezera mezi slokami (× výška písma)
  if (st.align) t.align = st.align;
  // označení zpěváků jen pro tuto píseň (přepíše šablonu): { kód: { barL, barR, bg, text } }
  if (st.singer) {
    t.singerShow = Object.assign({}, tpl.singerShow);
    for (const [code, o] of Object.entries(st.singer)) if (o && typeof o === 'object') t.singerShow[code] = Object.assign({}, singerShowOf(tpl, code), o);
  }
  return t;
}

/* Jak se zpěvák na stránce označí: proužek vlevo / vpravo, podklad řádku, barva písma.
   Šablona: singerShow[kód]; bez něj platí společné volby šablony (starší šablony). */
const SINGER_SHOW = [['barL', 'Vlevo', 'Proužek vlevo'], ['barR', 'Vpravo', 'Proužek vpravo'], ['bg', 'Podklad', 'Podbarvení řádku'], ['text', 'Písmo', 'Barva písma']];
function singerShowOf(tpl, code) {
  return Object.assign({ barL: !!tpl.singerBar, barR: !!tpl.singerBarRight, bg: !!tpl.singerBg, text: !!tpl.singerText }, (tpl.singerShow || {})[code]);
}
/* Tabulka přepínačů: řádky = zpěváci, sloupce = druhy označení. get(kód, klíč) → bool, set(kód, klíč, bool) */
function singerShowTable(get, set) {
  const sgs = Store.singers();
  const tbl = h('div', { class: 'sgs-tbl', style: { gridTemplateColumns: `minmax(90px, 1fr) repeat(${SINGER_SHOW.length}, auto)` } },
    h('span'), SINGER_SHOW.map(([, short, long]) => h('span', { class: 'sgs-h', title: long }, short)));
  for (const sg of sgs) {
    tbl.append(h('span', { class: 'sgs-n' }, h('i', { style: { background: sg.color } }), sg.name));
    for (const [k, , long] of SINGER_SHOW) {
      const inp = h('input', { type: 'checkbox', class: 'switch', title: `${sg.name}: ${long.toLowerCase()}`, checked: !!get(sg.code, k), onchange: () => set(sg.code, k, inp.checked) });
      tbl.append(h('label', { class: 'sgs-c' }, inp));
    }
  }
  tbl.repaint = () => { let i = 0; const inps = tbl.querySelectorAll('input'); for (const sg of sgs) for (const [k] of SINGER_SHOW) inps[i++].checked = !!get(sg.code, k); };
  return tbl;
}

function dimLabel(W, H) {
  return h('div', { class: 'preview-dim' }, `monitor ${W}×${H} · ${H >= W ? 'na výšku' : 'na šířku'}`);
}

/* plynulý vodorovný přechod barev (podklad řádku pro více zpěváků) */
function blend(colors) {
  if (colors.length === 1) return colors[0];
  const n = colors.length - 1;
  return `linear-gradient(90deg, ${colors.map((c, i) => `${c} ${Math.round((i / n) * 50 + 25)}%`).join(', ')})`;
}
function stripes(colors, soft) {
  if (colors.length === 1) return colors[0];
  const step = 100 / colors.length;
  return `linear-gradient(${soft ? '90deg' : '180deg'}, ${colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
}

/* Malý náhled první stránky písně (seznam písní, průvodce) – přesně jako ve čtečce, jen zmenšený */
function miniPage(box, song, info) {
  const scr = Screens.edit();
  const W = scr.w, H = scr.h;
  const tpl = applySongStyle(Store.template((song && song.templateId) || Settings.get('defaultTemplate')), song);
  tpl.fontSize = Math.round(tpl.fontSize * Screens.fontScale(scr, false));
  const lay = Render.layout(song, tpl, W, H, Screens.view(scr, true), screenOpts(scr, song.id, true));
  const st = Render.makeStage(tpl, W, H);
  box.innerHTML = '';
  box.style.aspectRatio = W + ' / ' + H;
  box.appendChild(st);
  Render.renderPage(st, lay, tpl, 0, Object.assign({ title: song.title, artist: song.artist, key: song.key, tempo: song.tempo, pos: '', next: '' }, info || {}));
  const fit = () => { if (box.isConnected) Render.fit(st, box, W, H); };
  requestAnimationFrame(fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(box);
  return st;
}
