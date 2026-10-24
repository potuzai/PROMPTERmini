'use strict';
/* ===== Virtuální česká klávesnice =====
   U aktivního textového pole (i řádku psaného na stránce editoru) se ukáže malé tlačítko ⌨; klávesnice se otevře
   jen jím – nikdy sama. Klávesy berou fokus pole (klik airmouse ho nevezme), píšou přes vkládání textu, takže
   funguje zpět (Ctrl+Z) i všechny reakce aplikace na psaní. Pro airmouse a klávesnice, které píšou jiné znaky. */
const VKB_ROWS = {
  abc: [
    ['ě', 'š', 'č', 'ř', 'ž', 'ý', 'á', 'í', 'é', 'ú', 'ů'],
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '⌫'],
    ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', '⏎'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ó', 'ň'],
    ['⇧', 'y', 'x', 'c', 'v', 'b', 'n', 'm', 'ď', 'ť', '⇧'],
  ],
  sym: [
    ['!', '?', '"', "'", '(', ')', '/', '\\', '|', '#', '&'],
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '⌫'],
    ['+', '-', '=', '*', '%', '_', '<', '>', '[', ']', '⏎'],
    [':', ';', '{', '}', '€', '$', '§', '°', '~', '^', '…'],
    ['„', '“', '–', '×', '÷', '¨', '´', 'ˇ', '♪', '♯', '♭'],
  ],
};
const VKB_FIELD = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]):not([type=button]):not([type=submit]):not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled]), [contenteditable="true"], [contenteditable=""]';

const Vkb = {
  field: null, open: false, shift: false, caps: false, mode: 'abc',
  btn: null, panel: null,

  init() {
    this.btn = h('button', { type: 'button', class: 'vkb-btn', title: 'Virtuální klávesnice', tabindex: '-1', onmousedown: e => e.preventDefault(), onclick: () => this.toggle() }, '⌨');
    this.panel = h('div', { class: 'vkb', role: 'group', 'aria-label': 'Virtuální klávesnice' });
    this.panel.addEventListener('mousedown', e => e.preventDefault());   // klik na klávesu nevezme poli fokus ani výběr
    document.body.append(this.btn, this.panel);
    document.addEventListener('focusin', e => this.onFocus(e.target));
    document.addEventListener('focusout', () => setTimeout(() => this.onFocus(document.activeElement), 0));
    addEventListener('resize', () => this.place());
    // pole zmizelo (zavřené okno, překreslená stránka) – blur při odebrání nepřijde, proto hlídat změny
    new MutationObserver(() => { if (this.field && !this.field.isConnected) this.onFocus(document.activeElement); }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('scroll', () => this.place(), true);
    document.addEventListener('keydown', e => { if (this.open && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); } }, true);   // Esc zavře nejdřív klávesnici
    this.refresh();
  },
  // v telefonu a na tabletu má systém vlastní klávesnici; jinak podle nastavení zařízení
  enabled() { return Settings.get('vkb') !== false && !matchMedia('(pointer: coarse)').matches; },
  refresh() { if (!this.enabled()) this.close(); this.onFocus(document.activeElement); },

  onFocus(el) {
    const f = el && el.matches && el.matches(VKB_FIELD) && el.isConnected ? el : null;
    if (f) this.field = f;
    else if (this.open && this.field && this.field.isConnected) return;   // klávesnice otevřená: pole zůstává cílem
    else { this.field = null; this.close(); }
    this.place();
  },
  // tlačítko ⌨ uvnitř pravého okraje pole
  place() {
    const f = this.field, show = !!f && this.enabled() && f.isConnected;
    this.btn.classList.toggle('on', show);
    this.btn.classList.toggle('active', this.open);
    if (!show) return;
    const r = f.getBoundingClientRect(), s = Math.max(24, Math.min(34, r.height - 6));
    Object.assign(this.btn.style, { width: s + 'px', height: s + 'px', left: Math.round(r.right - s - 3) + 'px', top: Math.round(r.top + (Math.min(r.height, 60) - s) / 2) + 'px' });
  },

  toggle() { if (this.open) this.close(); else this.show(); },
  show() {
    if (!this.field) return;
    this.open = true; this.mode = 'abc'; this.shift = this.caps = false;
    this.paint();
    this.panel.classList.add('on');
    document.body.classList.add('vkb-open');
    this.field.focus({ preventScroll: true });
    // pole nesmí zůstat pod klávesnicí
    requestAnimationFrame(() => {
      const r = this.field.getBoundingClientRect(), top = this.panel.getBoundingClientRect().top;
      if (r.bottom > top - 8) this.field.scrollIntoView({ block: 'center' });
      this.place();
    });
  },
  close() {
    if (!this.open) return;
    this.open = false;
    this.panel.classList.remove('on');
    document.body.classList.remove('vkb-open');
    this.place();
  },

  paint() {
    const up = this.shift || this.caps;
    const key = k => {
      const special = { '⌫': 'Smazat', '⏎': 'Enter', '⇧': 'Velká písmena (2× = trvale)' }[k];
      const label = special || k.length > 1 ? k : up ? k.toUpperCase() : k;
      return h('button', { type: 'button', tabindex: '-1', class: 'vkb-k' + (special ? ' fn' : '') + (k === '⇧' && up ? ' on' : '') + (k === '⇧' && this.caps ? ' caps' : ''), title: special || '',
        onpointerdown: e => this.press(k, e), onclick: e => this.tap(k, e) }, label);
    };
    const bottom = [
      h('button', { type: 'button', tabindex: '-1', class: 'vkb-k fn', title: this.mode === 'abc' ? 'Symboly' : 'Písmena', onclick: () => { this.mode = this.mode === 'abc' ? 'sym' : 'abc'; this.paint(); } }, this.mode === 'abc' ? '?#' : 'abc'),
      h('button', { type: 'button', tabindex: '-1', class: 'vkb-k', onclick: () => this.type('@') }, '@'),
      h('button', { type: 'button', tabindex: '-1', class: 'vkb-k', onclick: () => this.type(',') }, ','),
      h('button', { type: 'button', tabindex: '-1', class: 'vkb-k space', title: 'Mezera', onclick: () => this.type(' ') }, 'mezera'),
      h('button', { type: 'button', tabindex: '-1', class: 'vkb-k', onclick: () => this.type('.') }, '.'),
      h('button', { type: 'button', tabindex: '-1', class: 'vkb-k fn', title: 'Kurzor vlevo', onclick: () => this.move(-1) }, '←'),
      h('button', { type: 'button', tabindex: '-1', class: 'vkb-k fn', title: 'Kurzor vpravo', onclick: () => this.move(1) }, '→'),
      h('button', { type: 'button', tabindex: '-1', class: 'vkb-k fn close', title: 'Zavřít klávesnici (Esc)', onclick: () => this.close() }, '✕'),
    ];
    this.panel.replaceChildren(...VKB_ROWS[this.mode].map(r => h('div', { class: 'vkb-row' }, r.map(key))), h('div', { class: 'vkb-row' }, bottom));
  },

  // ⌫ při podržení maže dál
  press(k, e) {
    if (k !== '⌫') return;
    clearTimeout(this.rep); clearInterval(this.repI);
    const stop = () => { clearTimeout(this.rep); clearInterval(this.repI); removeEventListener('pointerup', stop); removeEventListener('pointercancel', stop); };
    addEventListener('pointerup', stop); addEventListener('pointercancel', stop);
    this.rep = setTimeout(() => { this.repeated = true; this.repI = setInterval(() => this.back(), 70); }, 450);
  },
  tap(k) {
    if (k === '⌫') { if (this.repeated) { this.repeated = false; return; } return this.back(); }
    if (k === '⏎') return this.enter();
    if (k === '⇧') {
      if (this.shift && !this.caps) { this.caps = true; this.shift = false; }   // druhé klepnutí = trvale velká
      else if (this.caps) this.caps = false;
      else this.shift = true;
      return this.paint();
    }
    this.type(this.shift || this.caps ? k.toUpperCase() : k);
    if (this.shift) { this.shift = false; this.paint(); }
  },

  target() {
    const f = this.field;
    if (!f || !f.isConnected) return null;
    if (document.activeElement !== f) f.focus({ preventScroll: true });
    return f;
  },
  type(text) {
    if (!this.target()) return;
    document.execCommand('insertText', false, text);   // jako skutečné psaní: událost input, zpět funguje
  },
  back() {
    if (!this.target()) return;
    document.execCommand('delete');
  },
  key(key) {   // klávesa pro reakce aplikace (Enter v řádku editoru, v okně…)
    const ev = new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true });
    this.field.dispatchEvent(ev);
    return ev.defaultPrevented;
  },
  enter() {
    const f = this.target();
    if (!f) return;
    if (this.key('Enter')) return;   // aplikace Enter zpracovala sama (editor, okno)
    if (f.tagName === 'TEXTAREA' || f.isContentEditable) return this.type('\n');
    if (f.form) { f.form.requestSubmit(); this.close(); }
  },
  move(d) {
    const f = this.target();
    if (!f) return;
    if (f.isContentEditable) { const sel = getSelection(); if (sel.modify) sel.modify('move', d < 0 ? 'backward' : 'forward', 'character'); return; }
    try {
      const p = Math.max(0, Math.min(f.value.length, (d < 0 ? f.selectionStart : f.selectionEnd) + d));
      f.setSelectionRange(p, p);
    } catch (e) { /* pole bez kurzoru (e-mail, číslo) */ }
  },
};
