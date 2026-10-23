'use strict';
/* ===== Čtečka (prompter) ===== */
/* Ovládání čtečky – nápověda ve čtečce (H) i v Nastavení › Čtečka a ovládání.
   Pódium: pedál (tlačítka myši) jen listuje a je chráněný proti dvojitému šlápnutí; co čtečku opouští, chce stisk dvakrát. */
const READER_HELP = [
  ['Pedál (tlačítka myši)', [
    ['Pravé', 'další stránka, na konci písně další píseň'], ['Levé', 'předchozí stránka'], ['Prostřední', 'seznam písní'],
    ['V nabídce: levé / pravé', 'předchozí / další položka'], ['V nabídce: podržet pravé', 'potvrdit'], ['V nabídce: podržet levé', 'zpět, zavřít nabídku']]],
  ['Airmouse a klávesnice', [
    ['→ ↓ PgDn mezera Enter', 'další stránka'], ['← ↑ PgUp', 'předchozí stránka'], ['Shift + → / ←', 'další / předchozí píseň'],
    ['Tab / L', 'seznam písní (číslem skok na píseň)'], ['P', 'jiný playlist'], ['Q / klávesa Menu', 'nabídka'], ['S', 'stáhnout změny'],
    ['E, E', 'upravit píseň'], ['F', 'celá obrazovka (ukončit: F, F)'], ['Esc, Esc', 'zavřít čtečku'], ['H', 'tato nápověda']]],
];

const Reader = {
  el: null, wrap: null, stage: null, stageTplKey: '',
  plId: null, items: [], songIdx: 0, pageIdx: 0,
  cache: new Map(), menu: null, cursorTimer: null, fsPending: false,
  aimT: 0, lastPt: null, mvAcc: 0, navT: 0, pend: null, pendT: 0, shownSong: null,

  init() {
    this.el = h('div', { id: 'reader', class: 'hidden' });
    this.wrap = h('div', { class: 'r-wrap' });
    this.el.appendChild(this.wrap);
    document.body.appendChild(this.el);
    this.el.addEventListener('contextmenu', e => e.preventDefault());
    this.el.addEventListener('mousedown', e => this.onMouse(e));
    // tlačítka myši zpět / vpřed (pedál, airmouse) nesmí čtečku opustit
    for (const ev of ['mouseup', 'auxclick']) this.el.addEventListener(ev, e => { if (e.button === 3 || e.button === 4) e.preventDefault(); });
    this.el.addEventListener('touchstart', e => this.onTouch(e), { passive: false });
    this.el.addEventListener('wheel', e => this.onWheel(e), { passive: false });
    this.el.addEventListener('mousemove', e => this.onMove(e));
    document.addEventListener('keydown', e => this.onKey(e));
    window.addEventListener('resize', () => {
      if (!this.isOpen()) return;
      // „podle okna“: při změně velikosti / otočení telefonu přestránkovat, jinak jen přizpůsobit
      if (Screens.myId() === 'auto') { clearTimeout(this.rsT); this.fit(); this.rsT = setTimeout(() => { this.stage = null; this.render(); }, 150); }
      else this.fit();
    });
    document.addEventListener('fullscreenchange', () => { if (this.isOpen()) setTimeout(() => this.fit(), 50); });
    // změny ze synchronizace během hraní: zůstat na stejné písni (i když se v playlistu posunula) a stránce
    Store.on(() => {
      this.cache.clear();
      if (!this.isOpen() || this.menu) return;
      const id = this.items[this.songIdx];
      this.loadItems();
      const i = this.items.indexOf(id);
      if (i >= 0) this.songIdx = i;
      this.render();
    });
  },

  isOpen() { return !this.el.classList.contains('hidden'); },

  open(plId, songIdx = 0) {
    this.el.classList.remove('hidden');
    this.cache.clear();
    this.wakeCursor();
    this.ensureFullscreen();
    if (!this._synced && Settings.get('readerSyncOnStart') && Sync.enabled()) {
      this._synced = true;
      Sync.run().then(r => { if (r && r.downloaded && this.isOpen()) this.flash(`Staženo ${r.downloaded} změn`); }).catch(() => {});
    }
    if (!plId) { this.showStartMenu(); return; }
    this.plId = plId;
    if (!plId.startsWith('song:')) Settings.set('lastPlaylist', plId);
    this.loadItems();
    this.songIdx = Math.max(0, Math.min(songIdx | 0, this.items.length - 1));
    this.pageIdx = 0;
    this.closeMenu();
    this.shownSong = null;
    this.render();
  },

  close() {
    this.el.classList.add('hidden');
    this.closeMenu();
    if (document.fullscreenElement && !window.native) document.exitFullscreen().catch(() => {});
  },

  loadItems() {
    if (this.plId === 'all') this.items = Store.sortedSongs().map(s => s.id);
    else if (this.plId.startsWith('song:')) this.items = [this.plId.slice(5)].filter(id => Store.songs.has(id));
    else {
      const pl = Store.playlists.get(this.plId);
      const enc = pl && typeof pl.encore === 'number' ? pl.encore : -1;
      this.items = pl ? pl.items.filter(id => Store.songs.has(id)) : [];
      this.encoreAt = enc >= 0 ? pl.items.slice(0, enc).filter(id => Store.songs.has(id)).length : -1;   // první přídavek
    }
    if (this.plId === 'all' || this.plId.startsWith('song:')) this.encoreAt = -1;
    if (this.songIdx >= this.items.length) this.songIdx = Math.max(0, this.items.length - 1);
  },

  playlistName() {
    if (this.plId === 'all') return 'Všechny písně';
    if (this.plId.startsWith('song:')) return 'Náhled písně';
    const pl = Store.playlists.get(this.plId);
    return pl ? pl.name : '';
  },

  tplFor(song) {
    // formátování drží písně samy (šablona písně), playlist ho nemění
    const id = (song && song.templateId) || Settings.get('defaultTemplate');
    const tpl = applySongStyle(Store.template(id), song);
    // písmo: profil obrazovky × osobní zvětšení tohoto zařízení
    const z = Screens.fontScale(Screens.mine());
    if (z !== 1) tpl.fontSize = Math.round(tpl.fontSize * z);
    return tpl;
  },

  /* Stránkování pro obrazovku tohoto zařízení: její rozměr a konce stránek */
  layoutFor(song, tpl) {
    const scr = Screens.mine();
    const W = scr.w, H = scr.h;
    const opts = screenOpts(scr, song.id, true);
    const key = [song.id, JSON.stringify(tpl), W + 'x' + H, song.updatedAt || '', JSON.stringify(opts)].join('|');
    if (!this.cache.has(key)) this.cache.set(key, Render.layout(song, tpl, W, H, opts));
    return this.cache.get(key);
  },

  current() {
    const song = Store.songs.get(this.items[this.songIdx]);
    if (!song) return null;
    const tpl = this.tplFor(song);
    return { song, tpl, lay: this.layoutFor(song, tpl) };
  },

  render() {
    const cur = this.current();
    const W = Screens.mine().w, H = Screens.mine().h;
    if (!cur) {
      this.wrap.innerHTML = '';
      this.wrap.appendChild(h('div', { class: 'empty', style: { color: '#888', fontSize: '24px' } },
        h('div', { class: 'empty-ic' }, '🎤'), 'Playlist je prázdný.', h('div', { style: { fontSize: '16px' } }, 'Stiskni L nebo prostřední tlačítko pro výběr playlistu, Esc pro návrat.')));
      this.stage = null;
      return;
    }
    const { song, tpl, lay } = cur;
    const tkey = JSON.stringify(tpl) + W + 'x' + H;
    if (!this.stage || this.stageTplKey !== tkey) {
      this.wrap.innerHTML = '';
      this.stage = Render.makeStage(tpl, W, H);
      this.stageTplKey = tkey;
      this.wrap.appendChild(this.stage);
      this.el.style.background = tpl.bgColor;
    }
    if (this.pageIdx >= lay.pages.length) this.pageIdx = lay.pages.length - 1;
    const nextSong = Store.songs.get(this.items[this.songIdx + 1]);
    Render.renderPage(this.stage, lay, tpl, this.pageIdx, {
      title: song.title, artist: song.artist, key: song.key, tempo: song.tempo,
      pos: `${this.songIdx + 1}/${this.items.length}`,
      next: nextSong ? nextSong.title : '', isLast: !nextSong,
    });
    this.fit();
    this.paintBar();
    this.paintInd(cur, nextSong);
    // předpočítat další píseň, ať je listování okamžité
    if (nextSong) setTimeout(() => { try { this.layoutFor(nextSong, this.tplFor(nextSong)); } catch (e) { /* nic */ } }, 50);
  },

  fit() {
    if (!this.stage) return;
    Render.fit(this.stage, this.wrap, Screens.mine().w, Screens.mine().h, Settings.get('readerRotate') || 0);
  },

  next() {
    const cur = this.current(); if (!cur) return;
    if (this.pageIdx < cur.lay.pages.length - 1) this.pageIdx++;
    else if (this.songIdx < this.items.length - 1) { this.songIdx++; this.pageIdx = 0; }
    else { this.flash('Konec playlistu'); return; }
    this.render();
  },
  prev() {
    const cur = this.current(); if (!cur) return;
    if (this.pageIdx > 0) this.pageIdx--;
    else if (this.songIdx > 0) {
      this.songIdx--;
      const c2 = this.current();
      this.pageIdx = c2 ? c2.lay.pages.length - 1 : 0;
    } else { this.flash('Začátek playlistu'); return; }
    this.render();
  },
  nextSong() { if (this.songIdx < this.items.length - 1) { this.songIdx++; this.pageIdx = 0; this.render(); } },
  prevSong() { if (this.songIdx > 0) { this.songIdx--; this.pageIdx = 0; this.render(); } },

  flash(msg, ms = 1100, cls = '') {
    $$('.r-toast', this.el).forEach(t => t.remove());
    const t = h('div', { class: 'r-toast' + (cls ? ' ' + cls : '') }, msg);
    this.el.appendChild(t);
    setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.remove(), 300); }, ms);
  },
  /* Ukazatele na pódiu: tečky stránek (víc stran), „Další: …“ na poslední straně (když šablona nemá zápatí),
     při přechodu na jinou píseň krátce její pořadí a název */
  paintInd(cur, nextSong) {
    if (!this.ind) { this.ind = h('div', { class: 'r-ind' }); this.nextChip = h('div', { class: 'r-next' }); this.el.append(this.ind, this.nextChip); }
    const n = cur.lay.pages.length, last = this.pageIdx >= n - 1;
    this.ind.replaceChildren(...(n > 1 ? Array.from({ length: n }, (_, i) => h('i', { class: i === this.pageIdx ? 'on' : '' })) : []));
    const showNext = last && !cur.tpl.showFooter;
    this.nextChip.textContent = showNext ? (nextSong ? 'Další: ' + nextSong.title : 'Konec playlistu') : '';
    this.nextChip.classList.toggle('end', showNext && !nextSong);
    if (this.shownSong && this.shownSong !== cur.song.id) this.flash(`${this.songIdx + 1}/${this.items.length} · ${cur.song.title}`, 1400, 'low');   // dole, ať nepřekryje začátek textu
    this.shownSong = cur.song.id;
  },
  /* akce, která opouští čtečku nebo celou obrazovku: napoprvé jen upozorní, provede se až druhým stiskem */
  confirm2(key, msg, fn) {
    const now = Date.now();
    if (this.pend === key && now - this.pendT < 2500) { this.pend = null; $$('.r-toast', this.el).forEach(t => t.remove()); fn(); return; }
    this.pend = key; this.pendT = now;
    this.flash(msg, 2500);
  },

  /* ----- Celá obrazovka ----- */
  isFullscreenLike() {
    if (window.native) return window.native.isFullscreen();
    return !!document.fullscreenElement || (window.innerHeight >= screen.height - 2 && window.innerWidth >= screen.width - 2);
  },
  ensureFullscreen() {
    if (!Settings.get('readerFullscreen') || this.isFullscreenLike()) return;
    if (window.native) { window.native.setFullscreen(true); return; }
    document.documentElement.requestFullscreen().catch(() => {
      // Prohlížeč vyžaduje akci uživatele – počkáme na první klik/klávesu
      this.fsPending = true;
      if (!$('.r-fs-hint', this.el)) this.el.appendChild(h('div', { class: 'r-fs-hint' }, 'Klikni nebo stiskni klávesu pro zobrazení přes celou obrazovku'));
    });
  },
  consumeFsPending() {
    if (!this.fsPending) return false;
    this.fsPending = false;
    const hint = $('.r-fs-hint', this.el); if (hint) hint.remove();
    if (!this.isFullscreenLike()) { document.documentElement.requestFullscreen().catch(() => {}); return true; }
    return false;
  },
  toggleFullscreen() {
    if (window.native) { window.native.setFullscreen(!window.native.isFullscreen()); return; }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  },

  /* Pohyb myši: chvění airmouse (pár px) se nepočítá. Teprve záměrný pohyb ukáže kurzor (a lištu dole)
     a na 3 s „míří“ – jen tehdy kliknutí ovládá tlačítka a nabídky. Jinak tlačítka myši = pedál. */
  onMove(e) {
    if (!this.isOpen()) return;
    const now = Date.now(), p = this.lastPt;
    this.lastPt = { x: e.clientX, y: e.clientY, t: now };
    if (!p) return;
    const d = Math.hypot(e.clientX - p.x, e.clientY - p.y);
    this.mvAcc = now - p.t > 300 ? d : this.mvAcc + d;
    if (this.mvAcc < 30) return;
    this.mvAcc = 0; this.aimT = now;
    this.wakeCursor();
    if (this.menu) {
      const opt = e.target.closest && e.target.closest('.r-opt'), i = opt ? this.menu.els().indexOf(opt) : -1;
      if (i >= 0 && i !== this.menu.sel) { this.menu.sel = i; this.menu.paint(false); }
      this.menuTouch();
    } else if (e.clientY > innerHeight * 0.75) this.showBar();
  },
  aimed() { return Date.now() - this.aimT < 3000; },
  btn(e) { const b = e.button; return Settings.get('swapMouse') ? (b === 0 ? 2 : b === 2 ? 0 : b) : b; },
  wakeCursor() {
    this.el.classList.remove('nocursor');
    clearTimeout(this.cursorTimer);
    if (Settings.get('hideCursor')) this.cursorTimer = setTimeout(() => { if (!this.menu) this.el.classList.add('nocursor'); }, 2000);
  },

  /* ----- Ovládání ----- */
  /* Pedál / tlačítka myši: pravé = další, levé = zpět, prostřední = seznam písní.
     Druhý stisk do 250 ms se nepočítá (zákmit tlačítka, dvojité šlápnutí). */
  onMouse(e) {
    if (!this.isOpen() || this.menu) return;   // nabídka má vlastní ovládání
    e.preventDefault();
    if (this.consumeFsPending()) return;
    const b = this.btn(e);
    if (b === 1) return this.showJumpMenu();
    if (b !== 0 && b !== 2 && b !== 3 && b !== 4) return;
    const now = Date.now();
    if (now - this.navT < 250) return;
    this.navT = now;
    if (b === 2 || b === 4) this.next(); else this.prev();
  },
  /* Dotyk (mobil, tablet): pravá část = další, levá = zpět, horní pruh = seznam písní */
  onTouch(e) {
    if (!this.isOpen() || this.menu || !e.touches.length) return;
    e.preventDefault(); // bez dodatečného „kliknutí myší“
    this.wakeCursor();
    if (this.consumeFsPending()) return;
    const t = e.touches[0];
    if (t.clientY < innerHeight * 0.12) return this.showJumpMenu();
    if (t.clientX > innerWidth * 0.4) this.next(); else this.prev();
  },

  wheelAcc: 0, wheelT: 0,
  onWheel(e) {
    if (!this.isOpen() || this.menu) return;
    e.preventDefault();
    if (!Settings.get('wheelNav')) return;
    const now = Date.now();
    if (now - this.wheelT < 350) return;
    this.wheelAcc += e.deltaY;
    if (Math.abs(this.wheelAcc) > 60) { this.wheelT = now; this.wheelAcc > 0 ? this.next() : this.prev(); this.wheelAcc = 0; }
  },

  onKey(e) {
    if (!this.isOpen()) return;
    if (this.menu) return this.menuKey(e);
    const k = e.key;
    if (k === 'F11') return; // necháme prohlížeči
    if (this.consumeFsPending() && !['Escape'].includes(k)) { e.preventDefault(); return; }
    if (e.repeat) { e.preventDefault(); return; }   // držená klávesa nelistuje dál – jedna stránka na stisk
    const leave = () => this.confirm2('esc', 'Zavřít čtečku? Stiskni znovu Esc', () => this.exit());
    const map = {
      ArrowRight: () => e.shiftKey ? this.nextSong() : this.next(),
      ArrowDown: () => this.next(), PageDown: () => this.next(), ' ': () => this.next(), Enter: () => this.next(),
      ArrowLeft: () => e.shiftKey ? this.prevSong() : this.prev(),
      ArrowUp: () => this.prev(), PageUp: () => this.prev(), Backspace: () => this.prev(),
      Home: () => { this.pageIdx = 0; this.render(); },
      MediaTrackNext: () => this.nextSong(), MediaTrackPrevious: () => this.prevSong(),
      Escape: leave, BrowserBack: leave, GoBack: leave,
    };
    const lk = k.length === 1 ? k.toLowerCase() : k;
    const letters = {
      l: () => this.showJumpMenu(), Tab: () => this.showJumpMenu(),
      p: () => this.showStartMenu(),
      f: () => this.isFullscreenLike() ? this.confirm2('f', 'Ukončit celou obrazovku? Stiskni znovu F', () => this.toggleFullscreen()) : this.toggleFullscreen(),
      q: () => this.showQuickMenu(), ContextMenu: () => this.showQuickMenu(),
      e: () => App.canEdit() && this.current() ? this.confirm2('e', 'Upravit píseň (opustí čtečku)? Stiskni znovu E', () => this.editCurrent()) : null,
      s: () => this.syncNow(),
      h: () => this.showHelp(), '?': () => this.showHelp(),
    };
    const fn = map[k] || letters[lk];
    if (fn) { e.preventDefault(); fn(); }
  },

  async syncNow() {
    if (!Sync.enabled()) return this.flash('Sdílení není nastaveno');
    this.flash('Synchronizuji…');
    try { const r = await Sync.run(); this.flash(r && r.downloaded ? `Staženo ${r.downloaded} změn` : 'Vše aktuální'); }
    catch (e) { this.flash('Chyba: ' + e.message); }
  },

  exit() {
    if (App.canEdit()) { this.close(); if (App.lastEditHash) location.hash = App.lastEditHash; else App.home(); }
    else this.showStartMenu();
  },

  /* ----- Menu (výběr playlistu / skok na píseň) ----- */
  showMenu(title, options, selIdx, onPick, hint, opt = {}) {
    this.closeMenu();
    this.hideBar();
    const list = h('div', { class: 'r-list' + (opt.grid ? ' r-grid' : '') });
    const tools = h('div', { class: 'r-tools' });   // volby s foot: true = ikony v patičce (šipkami se na ně dojede za seznamem)
    const ov = h('div', { class: 'r-overlay' }, h('div', { class: 'r-menu' + (opt.cls ? ' ' + opt.cls : '') },
      h('h2', {}, h('span', {}, title), opt.sub ? h('small', {}, opt.sub) : null), list,
      h('div', { class: 'r-foot' }, h('div', { class: 'r-hint' }, hint || ''), tools)));
    options.forEach((o, i) => {
      const el = o.foot
        ? h('div', { class: 'r-opt r-tool' + (o.cls ? ' ' + o.cls : ''), title: o.label + (o.key ? ' (' + o.key + ')' : '') }, ic(o.icon))
        : h('div', { class: 'r-opt' + (o.cls ? ' ' + o.cls : '') },
          o.icon ? ic(o.icon) : h('span', { class: 'n' }, o.n ?? ''),
          h('span', { class: 'r-t' }, h('span', { class: 'r-l' }, o.label), o.sub ? h('span', { class: 'r-sub' }, o.sub) : null),
          o.badge ? h('span', { class: 'r-badge' }, o.badge) : null,
          o.key ? h('kbd', {}, o.key) : null);
      (o.foot ? tools : list).appendChild(el);
    });
    ov.addEventListener('mousedown', ev => { ev.preventDefault(); ev.stopPropagation(); this.menuDown(ev); });
    ov.addEventListener('mouseup', ev => { ev.preventDefault(); ev.stopPropagation(); this.menuUp(ev); });
    // dotyk (mobil, tablet) je vždy záměrný: klepnutí vybere položku, klepnutí vedle okna nabídku zavře
    ov.addEventListener('touchstart', ev => {
      ev.preventDefault(); ev.stopPropagation();
      const t = ev.touches[0], el = t && document.elementFromPoint(t.clientX, t.clientY), opt = el && el.closest('.r-opt');
      if (opt) { this.menu.sel = this.menu.els().indexOf(opt); this.menu.paint(); this.menu.pick(); }
      else if (el && !el.closest('.r-menu')) this.closeMenu(true);
    }, { passive: false });
    const m = this.menu = {
      el: ov, sel: Math.max(0, selIdx), options, list, grid: !!opt.grid, hold: null,
      autoClose: !opt.stay && !!this.plId && this.items.length > 0,   // nabídka nad textem se po chvíli sama zavře
      els: () => [...list.children, ...tools.children],
      pick: () => { const o = options[m.sel]; if (o) onPick(o); },
      paint: (scroll = true) => {
        const all = m.els();
        all.forEach((x, i) => x.classList.toggle('sel', i === m.sel));
        if (scroll && all[m.sel]) all[m.sel].scrollIntoView({ block: 'nearest' });
      },
    };
    this.el.appendChild(ov);
    m.paint();
    this.menuTouch();
  },
  closeMenu(userCancel) {
    if (!this.menu) return;
    clearTimeout(this.menuIdleT);
    if (this.menu.hold) clearTimeout(this.menu.hold.t);
    this.menu.el.remove();
    this.menu = null;
    if (userCancel && !this.items.length && !this.plId) this.exit();
  },
  menuTouch() {
    clearTimeout(this.menuIdleT);
    const m = this.menu;
    if (m && m.autoClose) this.menuIdleT = setTimeout(() => { if (this.menu === m) this.closeMenu(); }, 20000);
  },
  /* Nabídka a myš: když kurzor míří (airmouse), klik vybere, na co ukazuje (pravé / vedle okna = zavřít).
     Pedál: pravé = další položka, levé = předchozí, podržet pravé = potvrdit, podržet levé = zpět; prostřední potvrdí. */
  menuDown(ev) {
    const m = this.menu;
    if (!m) return;
    this.menuTouch();
    const b = this.btn(ev), opt = ev.target.closest('.r-opt');
    if (this.aimed()) {
      if (b === 0 && opt) { m.sel = m.els().indexOf(opt); m.paint(); return m.pick(); }
      if (b === 0 || b === 2) return this.closeMenu(true);
    }
    if (b === 1) return m.pick();
    if (b !== 0 && b !== 2) return;
    if (m.hold) clearTimeout(m.hold.t);
    m.hold = { b, done: false, t: setTimeout(() => {
      m.hold.done = true; m.el.classList.remove('holding');
      if (b === 2) m.pick(); else this.closeMenu(true);
    }, 600) };
    m.el.classList.add('holding');
  },
  menuUp() {
    const m = this.menu;
    if (!m || !m.hold) return;
    clearTimeout(m.hold.t);
    m.el.classList.remove('holding');
    const { b, done } = m.hold;
    m.hold = null;
    if (done) return;
    const now = Date.now();
    if (now - this.navT < 250) return;   // zákmit
    this.navT = now;
    m.sel = b === 2 ? Math.min(m.options.length - 1, m.sel + 1) : Math.max(0, m.sel - 1);
    m.paint();
  },
  menuKey(e) {
    const m = this.menu;
    const k = e.key;
    this.menuTouch();
    const step = m.grid && (k === 'ArrowDown' || k === 'ArrowUp') ? 2 : 1;
    if (k === 'ArrowDown' || k === 'ArrowRight' || (k === 'Tab' && !e.shiftKey)) { m.sel = Math.min(m.options.length - 1, m.sel + step); m.paint(); }
    else if (k === 'ArrowUp' || k === 'ArrowLeft' || (k === 'Tab' && e.shiftKey)) { m.sel = Math.max(0, m.sel - step); m.paint(); }
    else if (k === 'PageDown') { m.sel = Math.min(m.options.length - 1, m.sel + 8); m.paint(); }
    else if (k === 'PageUp') { m.sel = Math.max(0, m.sel - 8); m.paint(); }
    else if (k === 'Home') { m.sel = 0; m.paint(); }
    else if (k === 'End') { m.sel = m.options.length - 1; m.paint(); }
    else if (k === 'Enter' || k === ' ') m.pick();
    else if (k === 'Escape' || k === 'BrowserBack' || k === 'GoBack' || k.toLowerCase() === 'l') { if (this.plId) this.closeMenu(true); else this.exit(); }
    else if (/^[0-9]$/.test(k)) {
      // rychlý skok číslem (např. 1 2 = 12. položka)
      const now = Date.now();
      this._num = (now - (this._numT || 0) < 900 ? (this._num || '') : '') + k;
      this._numT = now;
      const n = parseInt(this._num, 10);
      const idx = m.options.findIndex(o => o.n === n);
      if (idx >= 0) { m.sel = idx; m.paint(); }
    } else return;
    e.preventDefault();
  },

  showStartMenu() {
    const opts = Store.sortedPlaylists().map(p => ({
      id: p.id, label: p.name || '(bez názvu)', sub: `${p.date ? new Date(p.date).toLocaleDateString('cs-CZ') + ' · ' : ''}${p.items.length} písní`,
    }));
    opts.push({ id: 'all', label: 'Všechny písně (A–Z)', sub: `${Store.songs.size} písní` });
    opts.forEach((o, i) => { o.n = i + 1; });
    if (App.canEdit()) opts.push({ id: '__edit', n: '', label: '✎ Upravit písně a playlisty' });
    if (window.native) opts.push({ id: '__quit', n: '', label: '⏻ Ukončit program' });
    const last = opts.findIndex(o => o.id === Settings.get('lastPlaylist'));
    opts.forEach(o => { if (o.id === '__edit') o.icon = 'edit'; if (o.id === '__quit') o.icon = 'power'; if (o.id === '__edit' || o.id === '__quit') o.label = o.label.replace(/^\S+ /, ''); });
    this.showMenu('Vyber playlist', opts, last, o => {
      if (o.id === '__quit') return window.native.quit();
      if (o.id === '__edit') { this.closeMenu(); return this.exit(); }
      this.open(o.id, 0);
    },
      '↑ ↓ nebo pedál výběr · OK nebo podržet pravý pedál spustit' + (Sync.enabled() ? ' · S stáhnout změny' : ''), { cls: 'r-start', sub: 'Spustí čtečku od první písně', stay: true });
  },

  showJumpMenu() {
    const opts = this.items.map((id, i) => {
      const s = Store.songs.get(id);
      return { idx: i, n: i + 1, label: s ? s.title : '?', sub: s ? [s.artist, s.key].filter(Boolean).join(' · ') : '',
        cls: [i < this.songIdx ? 'done' : i === this.songIdx ? 'cur' : '', i === this.encoreAt ? 'encore-first' : '', this.encoreAt >= 0 && i >= this.encoreAt ? 'encore' : ''].filter(Boolean).join(' '),
        badge: i === this.songIdx ? 'hraje' : '' };
    });
    opts.push({ idx: -3, icon: 'sliders', label: 'Nabídka', key: 'Q', foot: true });
    opts.push({ idx: -1, icon: 'back', label: 'Jiný playlist', foot: true });
    opts.push({ idx: -2, icon: 'x', label: 'Zavřít čtečku', foot: true, cls: 'danger' });
    this.showMenu(this.playlistName() || 'Písně', opts, this.songIdx, o => {
      if (o.idx === -3) return this.showQuickMenu();
      if (o.idx === -1) return this.showStartMenu();
      if (o.idx === -2) { this.closeMenu(); return this.exit(); }
      this.closeMenu(); this.songIdx = o.idx; this.pageIdx = 0; this.render();
    }, '↑ ↓ nebo pedál výběr · číslo = skok · OK / podržet pravý = přejít · Esc / podržet levý = zpět', { sub: `${this.songIdx + 1} / ${this.items.length}` });
  },

  /* Rychlá nabídka: velké dlaždice ovladatelné šipkami (airmouse) */
  showQuickMenu() {
    const cur = this.current();
    const tiles = [
      { icon: 'list', label: 'Seznam písní', key: 'Tab', run: () => this.showJumpMenu() },
      { icon: 'edit', label: 'Upravit píseň', key: 'E', run: () => this.editCurrent() },
      { icon: 'sync', label: 'Synchronizovat', key: 'S', run: () => this.syncNow() },
      { icon: 'help', label: 'Nápověda', key: 'H', run: () => this.showHelp() },
      { icon: 'x', label: 'Zavřít čtečku', foot: true, cls: 'danger', run: () => this.exit() },   // v patičce okna
    ];
    this.showMenu('Nabídka', tiles, 0, o => { this.closeMenu(); o.run(); }, 'Šipky nebo pedál vybrat · OK / podržet pravý potvrdit · Esc / podržet levý zpět',
      { grid: true, cls: 'r-quick', sub: cur ? `${cur.song.title} · ${this.songIdx + 1} / ${this.items.length}` : '' });
  },

  editCurrent() { const cur = this.current(); if (cur && App.canEdit()) { this.close(); location.hash = '#/songs/' + cur.song.id; } },

  /* Ovládací lišta dole – ukáže se, když myš sjede do spodní části obrazovky */
  showBar() {
    if (this.menu || !this.items || !this.items.length) return;
    if (!this.bar) {
      // tlačítka reagují, jen když kurzor míří; jinak stisk propadne jako pedál (listování)
      const b = (icon, title, fn, cls = '') => h('button', { class: 'r-bbtn ' + cls, title, onmousedown: e => { if (!this.aimed()) return; e.preventDefault(); e.stopPropagation(); if (e.button === 0) fn(); } }, ic(icon));
      this.barInfo = h('div', { class: 'r-binfo' });
      this.bar = h('div', { class: 'r-bar' },
        b('left', 'Předchozí stránka', () => this.prev()), this.barInfo, b('right', 'Další stránka', () => this.next()),
        h('span', { class: 'r-bsep' }),
        b('list', 'Seznam písní (Tab)', () => this.showJumpMenu()), b('sliders', 'Nabídka (Q)', () => this.showQuickMenu()));
      this.progress = h('div', { class: 'r-progress' }, h('i'));
      this.el.append(this.bar, this.progress);
    }
    this.paintBar();
    this.el.classList.add('bar-on');
    clearTimeout(this.barT);
    this.barT = setTimeout(() => this.hideBar(), 2600);
  },
  hideBar() { this.el.classList.remove('bar-on'); },
  paintBar() {
    if (!this.bar) return;
    const cur = this.current();
    const n = cur ? cur.lay.pages.length : 1;
    this.barInfo.innerHTML = '';
    this.barInfo.append(h('b', {}, `Píseň ${this.songIdx + 1} / ${this.items.length}`), h('span', {}, `strana ${this.pageIdx + 1} / ${n}`));
    $('i', this.progress).style.width = (this.items.length ? (this.songIdx + (this.pageIdx + 1) / n) / this.items.length * 100 : 0) + '%';
  },

  showHelp() {
    const opts = READER_HELP.flatMap(([g, rows]) => [{ n: '', label: g, cls: 'r-grp' }, ...rows.map(r => ({ n: '', label: r[0], sub: r[1] }))]);
    this.showMenu('Ovládání čtečky', opts, 1, () => this.closeMenu(), 'Esc, Enter nebo podržet pedál zavře nápovědu');
  },
};
