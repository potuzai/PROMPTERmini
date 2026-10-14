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
    st.classList.toggle('with-bar', !!tpl.singerBar);
    st.classList.toggle('with-bg', !!tpl.singerBg);
    st.classList.toggle('hide-sections', !tpl.showSections);
    st.classList.toggle('hide-notes', !tpl.showNotes);
  },

  blockEl(b, tpl, singerMap) {
    if (b.type === 'gap') return h('div', { class: 'b-gap' });
    if (b.type === 'break') return h('div', { class: 'b-gap' });
    if (b.type === 'section') {
      const sg = b.singers.map(c => singerMap[c]).filter(Boolean);
      return h('div', { class: 'b-sec' + (b.repeat ? ' rep' : ''), 'data-src': b.src },
        b.text, sg.length ? h('span', { class: 'sec-sg' }, ' · ' + sg.map(s => s.name).join(' + ')) : null);
    }
    if (b.type === 'note') return h('div', { class: 'b-note' + (b.warn ? ' warn' : ''), 'data-src': b.src, html: inlineHtml(b.text, singerMap) });
    // řádek textu
    const sgs = b.singers.map(c => singerMap[c]).filter(Boolean);
    const el = h('div', { class: 'b-line', 'data-src': b.src });
    if (sgs.length) {
      const first = sgs[0];
      if (tpl.singerText) el.style.color = first.color;
      if (sgs.some(s => s.bold)) el.style.fontWeight = 900;
      if (sgs.some(s => s.italic)) el.style.fontStyle = 'italic';
      el.style.setProperty('--barbg', stripes(sgs.map(s => s.color)));
      if (tpl.singerBg) el.style.setProperty('--tint', stripes(sgs.map(s => hexToRgba(s.color, 0.22)), true));
      el.classList.add('has-sg');
    }
    let inner = inlineHtml(b.text, singerMap) || '&nbsp;';
    if (tpl.singerBadge && sgs.length) {
      inner = sgs.map(s => `<span class="badge" style="background:${s.color}">${esc(s.name)}</span>`).join('') + inner;
    }
    el.innerHTML = inner;
    return el;
  },

  /* Spočítá rozdělení písně na stránky */
  layout(song, tpl, W, H) {
    const parsed = parseSong(song.text);
    const singerMap = Store.singerMap();
    const blocks = parsed.blocks;
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
    return { blocks, pages: res.pages, k, cols, singerMap };
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
      for (const i of (page[ci] || [])) col.appendChild(this.blockEl(lay.blocks[i], tpl, lay.singerMap));
    });
    const hl = $('.st-h-left', stage), hr = $('.st-h-right', stage), fl = $('.st-f-left', stage), fr = $('.st-f-right', stage);
    hl.innerHTML = `<b>${esc(info.title || '')}</b>${info.artist ? ' <span class="dim">– ' + esc(info.artist) + '</span>' : ''}`;
    hr.innerHTML = [info.key ? 'tónina ' + esc(info.key) : '', info.tempo ? esc(info.tempo) + ' BPM' : '', info.pos ? esc(info.pos) : '']
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

function dimLabel(W, H) {
  return h('div', { class: 'preview-dim' }, `monitor ${W}×${H} · ${H >= W ? 'na výšku' : 'na šířku'}`);
}

function stripes(colors, soft) {
  if (colors.length === 1) return soft ? colors[0] : colors[0];
  const step = 100 / colors.length;
  return `linear-gradient(${soft ? '90deg' : '180deg'}, ${colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
}
