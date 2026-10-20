/* Režim úkolů pro náhled PROMPTER mini na claude.ai: klik na prvek stránky → krátký úkol → odeslání Claudovi
   jako komentář u toho prvku (schopnost artefaktu „comments“). Do aplikace nepatří, přidává ho jen tools/nahled/sestavit.js.
   Načítá se před skripty aplikace, aby jeho zachytávání kliků a kláves běželo dřív než to její. */
(() => {
  const INFO = window.NAHLED || {};
  const POS_KEY = 'nahled-ukol-pozice';
  const DRAFT_KEY = 'nahled-ukol-koncept';   // rozepsaný úkol přežije obnovení stránky (každé zveřejnění náhledu ji načte znovu)
  const MAX_TASK = 1500;      // znaků úkolu; celý komentář smí mít nejvýš 4 KiB
  const INTERACTIVE = 'button, a, input, select, textarea, label, summary, [role=button], [role=switch], [role=tab], [role=menuitem], [role=option]';
  const BLOCK = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu', 'touchstart', 'touchend'];
  const KEYS = ['keydown', 'keyup', 'keypress', 'beforeinput', 'input'];

  let host, ui = {};
  let active = false;         // vybírá se prvek
  let trail = [];             // vybraný prvek a jeho nadřazené („Větší“ přidává, „Menší“ ubírá)
  let sendMode = null;        // 'available' | 'no_session' | 'writers_only' | 'off' | 'copy'
  let busy = false;
  let comments = null;
  const commentsReady = (window.claude && typeof claude.use === 'function')
    ? claude.use('comments').then(c => (comments = c), () => null)
    : Promise.resolve(null);

  const clean = (s, max = 60) => {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  };
  const inUi = e => !!host && e.composedPath().includes(host);
  const picked = () => trail[trail.length - 1] || null;

  /* ===== Popis prvku ===== */
  function refine(el) {
    if (el instanceof SVGElement) el = el.closest('svg') || el;
    const i = el.closest && el.closest(INTERACTIVE);
    if (i) return i;
    while (/^(SPAN|B|I|EM|STRONG|SMALL|U)$/.test(el.tagName) && !el.className && el.parentElement && el.parentElement !== document.body) el = el.parentElement;
    return el;
  }

  function kind(el) {
    const t = el.tagName.toLowerCase(), role = el.getAttribute('role') || '', type = (el.getAttribute('type') || '').toLowerCase();
    const cls = typeof el.className === 'string' ? el.className : '';
    if (role === 'switch' || type === 'checkbox') return 'přepínač';
    if (type === 'radio') return 'volba';
    if (t === 'button' || role === 'button' || (t === 'input' && /^(button|submit)$/.test(type))) return 'tlačítko';
    if (t === 'a') return 'odkaz';
    if (t === 'input') return 'pole';
    if (t === 'textarea') return 'textové pole';
    if (t === 'select') return 'rozbalovací výběr';
    if (/^h[1-6]$/.test(t) || /(^|[\s-])title\b/.test(cls)) return 'nadpis';
    if (/\b(toolbar|bar|head)\b|-(head|bar)\b/.test(cls)) return 'lišta';
    if (t === 'label') return 'popisek';
    if (t === 'svg' || t === 'img') return 'ikona';
    if (/\bmodal\b/.test(cls)) return 'okno';
    if (t === 'li' || t === 'tr' || /\b(row|item)\b/.test(cls)) return 'řádek';
    if (/^(ul|ol|table|tbody)$/.test(t) || /\blist\b/.test(cls)) return 'seznam';
    return 'prvek';
  }

  // Hodnoty polí se nečtou nikdy (e-mail, heslo) – jen popisky, nápovědy a texty rozhraní
  function label(el) {
    const aria = el.getAttribute('aria-label'), hint = el.getAttribute('title') || el.getAttribute('placeholder');
    if (aria) return clean(aria);
    if (el.tagName === 'SELECT') return clean(el.options[el.selectedIndex] && el.options[el.selectedIndex].text);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return clean(hint || (el.labels && el.labels[0] ? el.labels[0].textContent : el.name));
    return clean(textOf(el)) || clean(hint);   // u řádků je název důležitější než obecná nápověda
  }

  // Viditelný text prvku bez obsahu rozbalovacích výběrů a textových polí
  function textOf(el) {
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement.closest('select, textarea, script, style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    let t = '';
    for (let n = walk.nextNode(); n && t.length < 300; n = walk.nextNode()) t += ' ' + n.nodeValue;
    return t;
  }

  const describe = el => { const l = label(el); return kind(el) + (l ? ' „' + l + '“' : ''); };

  function cssPath(el) {
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && n !== document.body && parts.length < 8; n = n.parentElement) {
      let s = n.tagName.toLowerCase();
      if (n.id) { parts.unshift(s + '#' + CSS.escape(n.id)); break; }
      const cls = [...n.classList].slice(0, 3).map(c => CSS.escape(c));
      if (cls.length) s += '.' + cls.join('.');
      const same = n.parentElement ? [...n.parentElement.children].filter(c => c.tagName === n.tagName) : [];
      if (same.length > 1) s += ':nth-of-type(' + (same.indexOf(n) + 1) + ')';
      parts.unshift(s);
    }
    return parts.join(' > ');
  }

  function openTag(el) {
    const attrs = [...el.attributes].filter(a => a.name !== 'value' && a.name !== 'style')
      .map(a => a.value === '' ? a.name : a.name + '="' + clean(a.value, 60) + '"');
    return clean('<' + el.tagName.toLowerCase() + (attrs.length ? ' ' + attrs.join(' ') : '') + '>', 200);
  }

  // Kde v aplikaci prvek je: obrazovka, otevřené okno a nejbližší nadpis nad prvkem
  function where() {
    const bits = [];
    const h1 = document.querySelector('#main h1');
    const reading = typeof Reader !== 'undefined' && Reader.isOpen && Reader.isOpen();
    bits.push(reading ? 'Čtečka' : clean(h1 && h1.textContent) || '—');
    const back = [...document.querySelectorAll('.modal-back')].pop();
    const mt = back && back.querySelector('.modal-title');
    if (mt && clean(mt.textContent)) bits.push('okno „' + clean(mt.textContent) + '“');
    return bits.join(' › ') + ' (' + (location.hash || 'úvodní stránka') + ')';
  }

  function section(el) {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const hd = [...n.children].find(c => /^H[1-4]$/.test(c.tagName) || c.classList.contains('modal-title'));
      if (hd && !hd.contains(el)) return clean(hd.textContent);
    }
    return '';
  }

  function compose(el, task) {
    const sec = section(el);
    const lines = [
      'Úkol z náhledu PROMPTER mini',
      'Obrazovka: ' + where(),
      sec ? 'Sekce: ' + sec : '',
      'Prvek: ' + describe(el),
      'Cesta: ' + clean(cssPath(el), 400),
      'Značka: ' + openTag(el),
      'Okno: ' + innerWidth + '×' + innerHeight + (INFO.commit ? ' · náhled ' + INFO.vetev + ' ' + INFO.commit : ''),
      '',
      'Úkol:',
      task
    ];
    return lines.filter((l, i) => l || i >= 7).join('\n');
  }

  /* ===== Rozhraní režimu (vlastní shadow DOM, styly aplikace na něj nesahají) ===== */
  const CSS_TEXT = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: "Segoe UI", system-ui, -apple-system, Roboto, sans-serif; }
    .fab { position: fixed; z-index: 3; display: flex; align-items: center; gap: 7px; height: 36px; padding: 0 14px 0 11px;
      border-radius: 18px; border: 1px solid #46464b; background: #2a2a2d; color: #f3f3f5; font-size: 13px; font-weight: 600;
      box-shadow: 0 6px 18px rgba(0,0,0,.45); cursor: pointer; touch-action: none; user-select: none; opacity: .85; }
    .fab:hover { opacity: 1; border-color: #e8493f; }
    .fab.on { background: #e8493f; border-color: #e8493f; color: #fff; opacity: 1; }
    .fab svg { width: 16px; height: 16px; flex: none; }
    .box { position: fixed; z-index: 1; pointer-events: none; border: 2px dashed #e8493f; background: rgba(232,73,63,.10);
      border-radius: 3px; display: none; }
    .box.sel { border-style: solid; background: rgba(232,73,63,.16); }
    .tag { position: absolute; left: -2px; bottom: 100%; margin-bottom: 4px; max-width: min(420px, 90vw); padding: 3px 7px;
      background: #e8493f; color: #fff; font-size: 12px; line-height: 1.35; border-radius: 3px; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; }
    .box.below .tag { bottom: auto; top: 100%; margin: 4px 0 0; }
    .banner { position: fixed; z-index: 2; top: 10px; left: 50%; transform: translateX(-50%); max-width: calc(100vw - 32px);
      padding: 7px 14px; border-radius: 16px; background: #e8493f; color: #fff; font-size: 13px; font-weight: 600;
      box-shadow: 0 6px 18px rgba(0,0,0,.45); pointer-events: none; display: none; text-align: center; }
    .panel { position: fixed; z-index: 4; left: 50%; transform: translateX(-50%); bottom: 16px; width: min(460px, calc(100vw - 32px));
      background: #2a2a2d; border: 1px solid #46464b; border-radius: 10px; box-shadow: 0 14px 40px rgba(0,0,0,.6);
      color: #f3f3f5; padding: 14px; display: none; cursor: default; font-size: 14px; }
    .panel.top { bottom: auto; top: 16px; }
    .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .head b { font-size: 15px; }
    .x { border: 0; background: none; color: #a5a5aa; font-size: 20px; line-height: 1; cursor: pointer; padding: 2px 6px; }
    .x:hover { color: #fff; }
    .el { display: flex; align-items: center; gap: 6px; }
    .chip { flex: 1; min-width: 0; padding: 6px 9px; border-radius: 6px; background: rgba(232,73,63,.18); color: #ffb1ab;
      font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .where { color: #a5a5aa; font-size: 12px; margin: 6px 2px 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    textarea { width: 100%; min-height: 92px; resize: vertical; padding: 9px 10px; border-radius: 6px; border: 1px solid #46464b;
      background: #202022; color: #f3f3f5; font-size: 16px; line-height: 1.4; outline: none; }
    textarea { cursor: text; }
    textarea:focus { border-color: #e8493f; }
    .btn { height: 32px; padding: 0 12px; border-radius: 6px; border: 1px solid #46464b; background: #323236; color: #f3f3f5;
      font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .btn:hover:not(:disabled) { border-color: #7c7c82; }
    .btn:disabled { opacity: .5; cursor: default; }
    .btn.primary { background: #e8493f; border-color: #e8493f; color: #fff; }
    .btn.small { height: 28px; padding: 0 9px; font-weight: 500; }
    .foot { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
    .status { flex: 1; min-width: 0; color: #a5a5aa; font-size: 12px; line-height: 1.35; }
    .status.err { color: #ff8a73; }
    .status.ok { color: #6fe39a; }
    .info { margin-top: 10px; padding-top: 8px; border-top: 1px solid #36363a; color: #7c7c82; font-size: 11px; }
    .note { position: fixed; z-index: 4; left: 50%; transform: translateX(-50%); bottom: 16px; max-width: calc(100vw - 32px);
      padding: 10px 14px; border-radius: 8px; background: #2a2a2d; border: 1px solid #3ccf6e; color: #f3f3f5; font-size: 13px;
      box-shadow: 0 10px 30px rgba(0,0,0,.5); display: none; }
  `;
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>';

  function mk(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v);
    }
    el.append(...kids);
    return el;
  }

  function build() {
    host = mk('div', { 'data-uncommentable': '', style: 'position:fixed;inset:auto;z-index:2147483000' });
    const root = host.attachShadow({ mode: 'open' });
    const cursor = mk('style', {}, 'html.nahled-vyber, html.nahled-vyber * { cursor: crosshair !important; }');
    document.head.appendChild(cursor);

    ui.hover = mk('div', { class: 'box' }, mk('div', { class: 'tag' }));
    ui.sel = mk('div', { class: 'box sel' }, mk('div', { class: 'tag' }));
    ui.banner = mk('div', { class: 'banner' }, 'Klikni na prvek, ke kterému chceš zadat úkol · Esc ruší');
    ui.fab = mk('button', { class: 'fab', type: 'button', title: 'Zadat úkol Claudovi k prvku stránky (lze přetáhnout)', html: ICON }, mk('span', {}, 'Úkol'));
    ui.chip = mk('div', { class: 'chip' });
    ui.where = mk('div', { class: 'where' });
    ui.text = mk('textarea', { maxlength: String(MAX_TASK), placeholder: 'Co mám s tímto prvkem udělat?' });
    ui.status = mk('div', { class: 'status' });
    ui.send = mk('button', { class: 'btn primary', type: 'button', onclick: send }, 'Odeslat');
    ui.panel = mk('div', { class: 'panel', role: 'dialog', 'aria-label': 'Úkol pro Claude' },
      mk('div', { class: 'head' }, mk('b', {}, 'Úkol pro Claude'), mk('button', { class: 'x', type: 'button', title: 'Zavřít (Esc)', onclick: stop }, '×')),
      mk('div', { class: 'el' }, ui.chip,
        mk('button', { class: 'btn small', type: 'button', title: 'Vybrat nadřazený prvek', onclick: () => step(1) }, 'Větší'),
        mk('button', { class: 'btn small', type: 'button', title: 'Vrátit se k menšímu prvku', onclick: () => step(-1) }, 'Menší')),
      ui.where, ui.text,
      mk('div', { class: 'foot' }, ui.status, mk('button', { class: 'btn', type: 'button', onclick: () => { ui.text.value = ''; stop(); } }, 'Zrušit'), ui.send),
      mk('div', { class: 'info' }, previewInfo()));
    ui.note = mk('div', { class: 'note' });
    root.append(mk('style', {}, CSS_TEXT), ui.hover, ui.sel, ui.banner, ui.panel, ui.note, ui.fab);
    document.body.appendChild(host);
    placeFab(loadPos());
    dragFab();
    restoreDraft();
  }

  function previewInfo() {
    if (!INFO.commit) return 'Klikni jinam na stránce pro jiný prvek · Ctrl+Enter odešle';
    const t = INFO.cas ? new Date(INFO.cas) : null;
    const when = t && !isNaN(t) ? t.toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    return 'Náhled: větev ' + INFO.vetev + ' · ' + INFO.commit + (INFO.verze ? ' · verze ' + INFO.verze : '') + (when ? ' · ' + when : '')
      + ' · klikni jinam pro jiný prvek · Ctrl+Enter odešle';
  }

  /* ===== Tlačítko (přetažitelné, pozice se pamatuje v tomto prohlížeči) ===== */
  function loadPos() {
    try { const p = JSON.parse(localStorage.getItem(POS_KEY)); if (p && isFinite(p.x) && isFinite(p.y)) return p; } catch (e) { /* bez úložiště */ }
    return null;
  }
  function placeFab(p) {
    const f = ui.fab, w = f.offsetWidth || 90, hh = f.offsetHeight || 36;
    if (!p) { f.style.left = ''; f.style.top = ''; f.style.right = '16px'; f.style.bottom = '16px'; return; }
    f.style.right = ''; f.style.bottom = '';
    f.style.left = Math.max(4, Math.min(innerWidth - w - 4, p.x)) + 'px';
    f.style.top = Math.max(4, Math.min(innerHeight - hh - 4, p.y)) + 'px';
  }
  function dragFab() {
    let start = null, moved = false;
    ui.fab.addEventListener('pointerdown', e => {
      const r = ui.fab.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, l: r.left, t: r.top }; moved = false;
      ui.fab.setPointerCapture(e.pointerId);
    });
    ui.fab.addEventListener('pointermove', e => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      moved = true;
      placeFab({ x: start.l + dx, y: start.t + dy });
    });
    ui.fab.addEventListener('pointerup', () => {
      if (moved) {
        const r = ui.fab.getBoundingClientRect();
        try { localStorage.setItem(POS_KEY, JSON.stringify({ x: r.left, y: r.top })); } catch (e) { /* bez úložiště */ }
      }
      start = null;
    });
    ui.fab.addEventListener('click', () => { if (moved) { moved = false; return; } active || trail.length ? stop() : begin(); });
    addEventListener('resize', () => placeFab(loadPos()));
  }

  /* ===== Výběr prvku ===== */
  function begin() {
    active = true;
    document.documentElement.classList.add('nahled-vyber');
    ui.fab.classList.add('on');
    ui.fab.lastChild.textContent = trail.length ? 'Ukončit' : 'Vyber prvek…';
    if (!trail.length) ui.banner.style.display = 'block';
  }

  function stop() {
    active = false; trail = []; busy = false;
    dropDraft();
    document.documentElement.classList.remove('nahled-vyber');
    ui.fab.classList.remove('on');
    ui.fab.lastChild.textContent = 'Úkol';
    for (const k of ['hover', 'sel', 'banner', 'panel']) ui[k].style.display = 'none';
  }

  function drawBox(box, el, text) {
    if (!el || !el.isConnected) { box.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    Object.assign(box.style, { display: 'block', left: r.left - 2 + 'px', top: r.top - 2 + 'px', width: r.width + 4 + 'px', height: r.height + 4 + 'px' });
    box.classList.toggle('below', r.top < 30);
    box.firstChild.textContent = text;
  }

  function redraw() {
    const el = picked();
    if (el) drawBox(ui.sel, el, describe(el));
  }

  function pick(target) {
    const el = refine(target);
    if (!el || el === document.body || el === document.documentElement) return;
    trail = [el];
    ui.hover.style.display = 'none';
    ui.banner.style.display = 'none';
    ui.fab.lastChild.textContent = 'Ukončit';
    showPanel();
  }

  function step(dir) {
    if (dir > 0) {
      const p = picked() && picked().parentElement;
      if (p && p !== document.body && p !== document.documentElement) trail.push(p);
    } else if (trail.length > 1) trail.pop();
    showPanel();
  }

  async function showPanel() {
    const el = picked();
    ui.chip.textContent = describe(el);
    ui.chip.title = cssPath(el);
    const sec = section(el);
    ui.where.textContent = where() + (sec ? ' · ' + sec : '');
    const r = el.getBoundingClientRect();
    ui.panel.classList.toggle('top', r.top + r.height / 2 > innerHeight / 2);
    ui.panel.style.display = 'block';
    redraw();
    if (!busy) { ui.send.disabled = false; setTimeout(() => { ui.text.focus(); ui.text.setSelectionRange(ui.text.value.length, ui.text.value.length); }, 0); }
    saveDraft();
    await refreshMode();
  }

  /* ===== Rozepsaný úkol ===== */
  function saveDraft() {
    if (!trail.length) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ text: ui.text.value, path: cssPath(picked()), hash: location.hash, at: Date.now() })); } catch (e) { /* bez úložiště */ }
  }
  function dropDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* bez úložiště */ }
  }

  async function restoreDraft() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch (e) { /* bez úložiště */ }
    if (!d || !d.path || Date.now() - d.at > 6 * 3600e3) return;
    if ((d.hash || '') !== location.hash) location.hash = d.hash || '';
    let el = null;
    for (let i = 0; i < 40 && !el; i++) {   // aplikace se po načtení ještě vykresluje
      await new Promise(r => setTimeout(r, 100));
      try { el = document.querySelector(d.path); } catch (e) { break; }
    }
    begin();
    trail = [el || document.getElementById('main') || document.body];
    ui.banner.style.display = 'none';
    ui.fab.lastChild.textContent = 'Ukončit';
    ui.text.value = d.text || '';
    await showPanel();
    status('Náhled se mezitím aktualizoval – rozepsaný úkol jsem vrátil.' + (el ? '' : ' Prvek jsem nenašel, klikni na něj znovu.'), el ? 'ok' : 'err');
  }

  // Jestli jde úkol poslat rovnou Claudovi; zjišťuje se při každém otevření (Claude se může připojit i odpojit)
  async function refreshMode() {
    await commentsReady;
    let m = 'copy';
    if (comments) { try { m = await comments.canSendToClaude(); } catch (e) { m = 'off'; } }
    sendMode = m;
    if (busy) return;
    if (m === 'available') { ui.send.textContent = 'Odeslat'; status('Úkol dorazí rovnou Claudovi.'); }
    else if (m === 'copy') { ui.send.textContent = 'Kopírovat'; status('Mimo claude.ai úkol odeslat nejde – zkopíruji ho a vložíš ho do chatu.'); }
    else { ui.send.textContent = 'Uložit'; status('Claude teď není připojený – úkol se uloží jako komentář a převezmu ho později.'); }
  }

  function status(text, kind = '') {
    ui.status.textContent = text;
    ui.status.className = 'status' + (kind ? ' ' + kind : '');
  }

  function note(text) {
    ui.note.textContent = text;
    ui.note.style.display = 'block';
    clearTimeout(note.t);
    note.t = setTimeout(() => { ui.note.style.display = 'none'; }, 6000);
  }

  /* ===== Odeslání ===== */
  async function send() {
    if (busy) return;
    const task = ui.text.value.trim();
    if (!task) { status('Napiš, co mám s prvkem udělat.', 'err'); ui.text.focus(); return; }
    let el = picked();
    const text = compose(el, task);
    if (new TextEncoder().encode(text).length > 4000) { status('Úkol je moc dlouhý – zkrať ho, prosím.', 'err'); return; }
    if (sendMode === 'copy' || !comments) return copyOut(text, 'Úkol je zkopírovaný – vlož ho do chatu s Claudem.');
    if (!el.isConnected) el = document.querySelector(cssPath(el)) || document.getElementById('main') || document.body;
    busy = true; ui.send.disabled = true;
    const toClaude = sendMode === 'available';
    status(toClaude ? 'Odesílám… (poprvé se claude.ai zeptá na povolení komentářů)' : 'Ukládám…');
    try {
      const anchor = await comments.anchorFor(el);
      if (toClaude) await comments.sendToClaude({ anchor, text });
      else await comments.create({ anchor, text });
      ui.text.value = '';
      stop();
      note(toClaude ? 'Odesláno ✓ Odpovím ve vlákně komentáře u prvku a náhled po úpravě obnovím.'
        : 'Uloženo jako komentář ✓ Převezmu ho, až se Claude připojí.');
    } catch (err) {
      busy = false; ui.send.disabled = false;
      const code = err && err.code;
      if (code === 'consent_required') status('Neodesláno: nejdřív povol stránce komentáře (dotaz od claude.ai) a zkus to znovu.', 'err');
      else if (code === 'claude_unavailable') { sendMode = 'no_session'; ui.send.textContent = 'Uložit'; status('Claude teď úkol nepřevezme – můžeš ho uložit jako komentář.', 'err'); }
      else if (code === 'rate_limited') status('Moc úkolů rychle za sebou – chvilku počkej a zkus to znovu.', 'err');
      else if (code === 'forbidden' || code === 'not_granted' || code === 'unavailable' || code === 'capability_removed') {
        sendMode = 'copy';
        copyOut(text, 'Komentáře ze stránky jsou tu vypnuté – úkol je zkopírovaný, vlož ho do chatu.');
      } else status('Nepovedlo se (' + (code || (err && err.message) || err) + '). Zkus to znovu.', 'err');
    }
  }

  async function copyOut(text, msg) {
    try { await navigator.clipboard.writeText(text); status(msg, 'ok'); ui.send.textContent = 'Kopírovat'; return; } catch (e) { /* schránka nepovolena */ }
    ui.text.value = text;
    ui.text.select();
    status('Text úkolu je označený – zkopíruj ho Ctrl+C a vlož do chatu.', 'err');
  }

  /* ===== Zachytávání: v režimu výběru klik vybírá prvek a aplikace ho nedostane ===== */
  for (const type of BLOCK) {
    addEventListener(type, e => {
      if (!(active || trail.length) || inUi(e)) return;
      e.stopImmediatePropagation();
      if (!type.startsWith('touch')) e.preventDefault();
      if (type === 'click' && !busy) pick(e.target);
    }, { capture: true, passive: false });
  }

  addEventListener('pointermove', e => {
    if (!active || trail.length || e.pointerType === 'touch') return;
    if (inUi(e)) { ui.hover.style.display = 'none'; return; }
    const el = refine(e.target);
    if (el && el !== document.body && el !== document.documentElement) drawBox(ui.hover, el, describe(el));
  }, true);

  for (const type of KEYS) {
    addEventListener(type, e => {
      const inside = inUi(e);
      if (!inside && !(active || trail.length)) return;
      if (type === 'keydown' && e.key === 'Escape') { e.preventDefault(); stop(); }
      else if (inside && type === 'input') saveDraft();
      else if (inside && type === 'keydown' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
      e.stopImmediatePropagation();   // psaní v panelu ani klávesy během výběru aplikace nevidí
    }, true);
  }

  addEventListener('scroll', () => { if (trail.length) redraw(); }, true);
  addEventListener('resize', () => { if (trail.length) redraw(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
