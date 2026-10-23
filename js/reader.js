'use strict';
/* ===== Čtečka (prompter) ===== */
/* Ovládání čtečky – nápověda ve čtečce (H) i v Nastavení › Čtečka a ovládání.
   Pódium: pedál (tlačítka myši) jen listuje a je chráněný proti dvojitému šlápnutí; co čtečku opouští, chce stisk dvakrát. */
const READER_HELP = [
  ['Pedál (tlačítka myši)', [
    ['Pravé', 'další stránka, na konci písně další píseň'], ['Levé', 'předchozí stránka'],
    ['Podržet levé, nebo oba najednou', 'playlist a nabídka'], ['Rychlé šlápnutí za sebou', 'každé se počítá – rychlý přesun'], ['Prostřední', 'playlist a nabídka'], ['Prázdný playlist: kterékoli', 'výběr playlistu'],
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
  aimT: 0, lastPt: null, mvAcc: 0, press: null, pend: null, pendT: 0, shownSong: null,

  init() {
    this.el = h('div', { id: 'reader', class: 'hidden' });
    this.wrap = h('div', { class: 'r-wrap' });
    this.el.appendChild(this.wrap);
    document.body.appendChild(this.el);
    this.el.addEventListener('contextmenu', e => e.preventDefault());
    this.el.addEventListener('mousedown', e => this.onMouse(e));
    // tlačítka myši zpět / vpřed (pedál, airmouse) nesmí čtečku opustit
    for (const ev of ['mouseup', 'auxclick']) this.el.addEventListener(ev, e => { if (e.button === 3 || e.button === 4) e.preventDefault(); });
    this.el.addEventListener('mouseup', e => { if (!this.menu) this.pressUp(this.btn(e)); });
    this.el.addEventListener('touchstart', e => this.onTouch(e), { passive: false });
    this.el.addEventListener('wheel', e => this.onWheel(e), { passive: false });
    this.el.addEventListener('mousemove', e => this.onMove(e));
    document.addEventListener('keydown', e => this.onKey(e));
    // klávesa zpět se provede až při puštění (držená = playlist, nic se předtím neposune)
    document.addEventListener('keyup', e => {
      const kd = this.keyDown;
      if (!kd || kd.k !== e.key) return;
      this.keyDown = null;
      if (kd.back && !kd.fired && this.isOpen() && !this.menu) this.prev();
    });
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
        h('div', { class: 'empty-ic' }, '🎤'), 'Playlist je prázdný.', h('div', { style: { fontSize: '18px' } }, 'Šlápni na pedál (nebo stiskni P) a vyber jiný playlist.')));
      if (this.hud) this.hud.classList.add('off');
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
    this.paintHud(cur, nextSong);
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
  /* Stavový řádek dole (pódium): vlevo pořadí a píseň, uprostřed stránky písně, vpravo co bude dál.
     Když šablona ukazuje zápatí (strana, další píseň), stavový řádek se schová – nic se nezdvojuje. */
  paintHud(cur, nextSong) {
    if (!this.hud) {
      this.hud = h('div', { class: 'r-hud' }, this.hudL = h('div', { class: 'r-hud-l' }), this.hudC = h('div', { class: 'r-hud-c' }), this.hudR = h('div', { class: 'r-hud-r' }));
      this.el.appendChild(this.hud);
    }
    const n = cur.lay.pages.length, last = this.pageIdx >= n - 1, off = Settings.get('readerHud') === false || cur.tpl.showFooter;
    this.hud.classList.toggle('off', off);
    this.hudL.replaceChildren(h('b', {}, `${this.songIdx + 1}/${this.items.length}`), h('span', {}, cur.song.title));
    this.hudC.replaceChildren(...(n > 1 ? Array.from({ length: n }, (_, i) => h('i', { class: i === this.pageIdx ? 'on' : '' })) : []));
    this.hudR.className = 'r-hud-r' + (!last ? ' more' : nextSong ? ' next' : ' end');
    this.hudR.replaceChildren(...(!last ? [h('span', {}, `pokračuje · strana ${this.pageIdx + 2}/${n}`), ic('down')]
      : nextSong ? [h('span', {}, 'Další'), h('b', {}, nextSong.title)] : [h('b', {}, 'Konec playlistu')]));
    // jiná píseň: krátce zvýraznit (bez stavového řádku oznámení dole)
    if (this.shownSong && this.shownSong !== cur.song.id) {
      if (off) this.flash(`${this.songIdx + 1}/${this.items.length} · ${cur.song.title}`, 1400, 'low');
      else { this.hud.classList.remove('new'); void this.hud.offsetWidth; this.hud.classList.add('new'); }
    }
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
  /* Pedál / tlačítka myši. Každé šlápnutí se počítá zvlášť (i rychlé klikání za sebou); jen zákmit kontaktu
     do 40 ms po puštění se ignoruje. Podržení = tlačítko opravdu držené dole.
     V textu: pravé = další (hned při šlápnutí), levé = zpět (při puštění – podržení tak nic neposune), prostřední = playlist;
     podržet levé (0,8 s) nebo šlápnout oba najednou = playlist (případné listování pravým se vrátí);
     prázdný playlist: kterékoli tlačítko = výběr playlistu. */
  onMouse(e) {
    if (!this.isOpen() || this.menu) return;   // nabídka má vlastní ovládání
    e.preventDefault();
    if (this.consumeFsPending()) return;
    const b = this.btn(e), now = Date.now(), p = this.press;
    if (b !== 0 && b !== 1 && b !== 2 && b !== 3 && b !== 4) return;
    if (this.bounce(p, b, now)) return;
    if (p && p.b !== b && p.down && !p.fired && !p.menu) { p.fired = true; this.setPos(p.pos); return this.showJumpMenu(); }   // oba najednou
    const np = this.press = { b, start: now, down: true, pos: [this.songIdx, this.pageIdx] };
    if (!this.items.length) { np.fired = true; return this.showStartMenu(); }
    if (b === 1) { np.fired = true; return this.showJumpMenu(); }
    if (b === 2 || b === 4) return this.next();
    np.back = true;   // zpět až při puštění
    clearTimeout(this.holdT);
    this.holdT = setTimeout(() => {   // podržený levý = playlist (nic se předtím neposune)
      if (this.press === np && np.down && !np.fired) { np.fired = true; this.showJumpMenu(); }
    }, 800);
  },
  pressUp(b) {
    const p = this.press;
    if (!p || p.b !== b) return;
    p.down = false; p.up = Date.now();
    if (p.back && !p.fired) { p.fired = true; clearTimeout(this.holdT); this.prev(); }
  },
  /* zákmit kontaktu: stejné tlačítko znovu dole hned po puštění */
  bounce(p, b, now) { return !!(p && p.b === b && !p.down && now - (p.up || 0) < 40); },
  keyBack() { if (this.keyDown) this.keyDown.back = true; },
  setPos([si, pi]) { if (si !== this.songIdx || pi !== this.pageIdx) { this.songIdx = si; this.pageIdx = pi; this.render(); } },
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
    if (e.repeat) {   // držená klávesa nelistuje dál – jedna stránka na stisk; držená zpět (0,8 s) = playlist
      e.preventDefault();
      const kd = this.keyDown;
      if (kd && kd.k === k && !kd.fired && ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(k) && Date.now() - kd.t >= 800) { kd.fired = true; this.setPos(kd.pos); this.showJumpMenu(); }
      return;
    }
    this.keyDown = { k, t: Date.now(), fired: false, pos: [this.songIdx, this.pageIdx] };
    const leave = () => this.confirm2('esc', 'Zavřít čtečku? Stiskni znovu Esc', () => this.exit());
    const map = {
      ArrowRight: () => e.shiftKey ? this.nextSong() : this.next(),
      ArrowDown: () => this.next(), PageDown: () => this.next(), ' ': () => this.next(), Enter: () => this.next(),
      ArrowLeft: () => e.shiftKey ? this.prevSong() : this.keyBack(),
      ArrowUp: () => this.keyBack(), PageUp: () => this.keyBack(), Backspace: () => this.keyBack(),
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

  /* ----- Nabídky: úvodní výběr playlistu (celá obrazovka), playlist s nabídkou (panel vpravo), nápověda (okno) -----
     opt.layout: 'full' | 'drawer' | 'center'; položky s foot: true = tlačítka v patičce (šipkami / pedálem se na ně dojede za seznamem) */
  showMenu(title, options, selIdx, onPick, hint, opt = {}) {
    this.closeMenu();
    this.hideBar();
    const list = h('div', { class: 'r-list' + (opt.grid ? ' r-grid' : '') });
    const tools = h('div', { class: 'r-tools' });
    const ov = h('div', { class: 'r-overlay r-lay-' + (opt.layout || 'center') }, h('div', { class: 'r-menu' + (opt.cls ? ' ' + opt.cls : '') },
      h('div', { class: 'r-head' }, opt.kicker ? h('div', { class: 'r-kicker' }, opt.kicker) : null, h('h2', {}, title), opt.sub ? h('small', {}, opt.sub) : null, opt.headExtra || null),
      list,
      h('div', { class: 'r-foot' }, tools, h('div', { class: 'r-hint' }, hint || ''))));
    options.forEach(o => {
      const el = o.foot
        ? h('div', { class: 'r-opt r-tool' + (o.cls ? ' ' + o.cls : ''), title: o.label + (o.key ? ' (' + o.key + ')' : '') }, ic(o.icon), h('span', {}, o.label), o.key ? h('kbd', {}, o.key) : null)
        : h('div', { class: 'r-opt' + (o.cls ? ' ' + o.cls : '') },
          o.icon ? ic(o.icon) : o.n !== '' && o.n != null ? h('span', { class: 'n' }, o.n) : null,
          h('span', { class: 'r-t' }, h('span', { class: 'r-l' }, o.label), o.sub ? h('span', { class: 'r-sub' }, o.sub) : null),
          o.chips && o.chips.length ? h('span', { class: 'r-chips' }, o.chips.map(c => h('i', {}, c))) : null,
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
      else if (el && !el.closest('.r-menu')) this.menu.back();
    }, { passive: false });
    const m = this.menu = {
      el: ov, sel: Math.max(0, selIdx), options, list, grid: !!opt.grid, hold: null,
      autoClose: !opt.stay && !!this.plId && this.items.length > 0,   // nabídka nad textem se po chvíli sama zavře
      back: () => opt.back ? opt.back() : this.plId ? this.closeMenu(true) : this.exit(),   // Esc, podržet levý pedál, klik vedle
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
    // kurzor se po zavření nabídky zase sám schová
    clearTimeout(this.cursorTimer);
    if (Settings.get('hideCursor')) this.cursorTimer = setTimeout(() => { if (!this.menu) this.el.classList.add('nocursor'); }, 2000);
    if (userCancel && !this.items.length && !this.plId) this.exit();
  },
  menuTouch() {
    clearTimeout(this.menuIdleT);
    const m = this.menu;
    if (m && m.autoClose) this.menuIdleT = setTimeout(() => { if (this.menu === m) this.closeMenu(); }, 20000);
  },
  /* Nabídka a myš: když kurzor míří (airmouse), klik vybere, na co ukazuje (pravé / vedle okna = zpět).
     Pedál: šlápnutí pravé = další položka, levé = předchozí (každé zvlášť, i rychle za sebou);
     podržet pravé (0,6 s) = potvrdit, podržet levé = zpět; prostřední potvrdí. */
  menuDown(ev) {
    const m = this.menu;
    if (!m) return;
    this.menuTouch();
    const b = this.btn(ev), opt = ev.target.closest('.r-opt'), now = Date.now(), p = this.press;
    if (this.bounce(p, b, now)) return;
    if (this.aimed()) {
      if (b === 0 && opt) { m.sel = m.els().indexOf(opt); m.paint(); return m.pick(); }
      if (b === 0 || b === 2) return m.back();
    }
    if (b === 1) { this.press = { b, start: now, down: true, fired: true, menu: true }; return m.pick(); }
    if (b !== 0 && b !== 2) return;
    const np = this.press = { b, start: now, down: true, menu: true };
    clearTimeout(this.holdT);
    m.el.classList.add('holding');
    this.holdT = setTimeout(() => {
      if (this.press !== np || np.fired || !np.down) return;
      np.fired = true; m.el.classList.remove('holding');
      if (b === 2) m.pick(); else m.back();
    }, 600);
  },
  menuUp(ev) {
    const m = this.menu, p = this.press, b = this.btn(ev);
    if (!p || p.b !== b) return;
    p.down = false; p.up = Date.now();
    if (!m || p.fired || !p.menu) return;   // podržení už se provedlo (nebo dozvuk podržení z textu)
    p.fired = true; clearTimeout(this.holdT); m.el.classList.remove('holding');
    m.sel = b === 2 ? Math.min(m.options.length - 1, m.sel + 1) : Math.max(0, m.sel - 1);
    m.paint();
  },
  menuKey(e) {
    const m = this.menu;
    const k = e.key;
    this.menuTouch();
    // pedál, který posílá klávesy: držená klávesa se neopakuje (nelistuje), po 0,6 s vpřed = potvrdit, zpět = zpět
    const fwd = ['ArrowDown', 'ArrowRight', 'PageDown'].includes(k), bwd = ['ArrowUp', 'ArrowLeft', 'PageUp'].includes(k);
    if ((fwd || bwd) && e.repeat) {
      e.preventDefault();
      const kd = this.keyDown;
      if (kd && kd.k === k && !kd.fired && Date.now() - kd.t >= 600) { kd.fired = true; if (fwd) m.pick(); else m.back(); }
      return;
    }
    if (fwd || bwd) this.keyDown = { k, t: Date.now(), fired: false };
    const step = m.grid && (k === 'ArrowDown' || k === 'ArrowUp') ? 2 : 1;
    if (k === 'ArrowDown' || k === 'ArrowRight' || (k === 'Tab' && !e.shiftKey)) { m.sel = Math.min(m.options.length - 1, m.sel + step); m.paint(); }
    else if (k === 'ArrowUp' || k === 'ArrowLeft' || (k === 'Tab' && e.shiftKey)) { m.sel = Math.max(0, m.sel - step); m.paint(); }
    else if (k === 'PageDown') { m.sel = Math.min(m.options.length - 1, m.sel + 1); m.paint(); }
    else if (k === 'PageUp') { m.sel = Math.max(0, m.sel - 1); m.paint(); }
    else if (k === 'Home') { m.sel = 0; m.paint(); }
    else if (k === 'End') { m.sel = m.options.length - 1; m.paint(); }
    else if (k === 'Enter' || k === ' ') m.pick();
    else if (k === 'Escape' || k === 'BrowserBack' || k === 'GoBack' || k.toLowerCase() === 'l') m.back();
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

  /* Úvodní obrazovka: playlisty jako velké karty (oblíbené první, naposledy hraný vybraný) */
  showStartMenu() {
    const last = Settings.get('lastPlaylist'), pls = Store.sortedPlaylists();
    const fav = pls.filter(isReadyPl).sort((a, b) => a.ready - b.ready);
    const opts = [...fav, ...pls.filter(p => !isReadyPl(p))].map(p => ({ id: p.id, label: p.name || '(bez názvu)',
      sub: [p.date ? new Date(p.date).toLocaleDateString('cs-CZ') : '', plural(p.items.length, 'píseň', 'písně', 'písní')].filter(Boolean).join(' · '),
      badge: p.id === last ? 'naposledy' : '', cls: isReadyPl(p) ? 'fav' : '' }));
    opts.push({ id: 'all', label: 'Všechny písně', sub: 'A–Z · ' + plural(Store.songs.size, 'píseň', 'písně', 'písní'), cls: 'all' });
    opts.forEach((o, i) => { o.n = i + 1; });
    if (Sync.enabled()) opts.push({ id: '__sync', icon: 'sync', label: 'Stáhnout změny', key: 'S', foot: true });
    if (App.canEdit()) opts.push({ id: '__edit', icon: 'edit', label: 'Upravit písně', foot: true });
    opts.push({ id: '__help', icon: 'help', label: 'Nápověda', foot: true });
    if (window.native) opts.push({ id: '__quit', icon: 'power', label: 'Ukončit', foot: true, cls: 'danger' });
    this.showMenu('Vyber playlist', opts, Math.max(0, opts.findIndex(o => o.id === last)), o => {
      if (o.id === '__quit') return window.native.quit();
      if (o.id === '__edit') { this.closeMenu(); return this.exit(); }
      if (o.id === '__sync') return this.syncNow();
      if (o.id === '__help') return this.showHelp(() => this.showStartMenu());
      this.open(o.id, 0);
    }, 'Šipky nebo pedál vybrat · OK nebo podržet pravý pedál = spustit od první písně', { layout: 'full', grid: true, cls: 'r-start', kicker: 'PROMPTER mini', stay: true });
  },

  /* Playlist (panel vpravo, text písně zůstane vidět): odehrané, hraje, další, přídavky; v patičce celá nabídka.
     actions = otevřít rovnou na nabídce (Q, klávesa Menu) */
  showJumpMenu(actions) {
    const opts = this.items.map((id, i) => {
      const s = Store.songs.get(id), st = i < this.songIdx ? 'done' : i === this.songIdx ? 'cur' : i === this.songIdx + 1 ? 'next' : '';
      return { idx: i, n: i + 1, label: s ? s.title : '?', sub: s ? s.artist || '' : '',
        chips: s ? [s.key, s.tempo ? s.tempo + ' BPM' : '', s.duration].filter(Boolean) : [],
        cls: [st, i === this.encoreAt ? 'encore-first' : '', this.encoreAt >= 0 && i >= this.encoreAt ? 'encore' : ''].filter(Boolean).join(' '),
        badge: st === 'cur' ? 'hraje' : st === 'next' ? 'další' : '' };
    });
    const first = opts.length;
    opts.push({ idx: -1, icon: 'list', label: 'Jiný playlist', key: 'P', foot: true });
    if (Sync.enabled()) opts.push({ idx: -4, icon: 'sync', label: 'Stáhnout', key: 'S', foot: true });
    if (App.canEdit() && this.current()) opts.push({ idx: -5, icon: 'edit', label: 'Upravit', foot: true });
    opts.push({ idx: -6, icon: 'help', label: 'Nápověda', key: 'H', foot: true });
    opts.push({ idx: -2, icon: 'x', label: 'Zavřít čtečku', foot: true, cls: 'danger' });
    const n = this.items.length, pct = n ? (this.songIdx + 1) / n * 100 : 0;
    this.showMenu(this.playlistName() || 'Písně', opts, actions ? first : this.songIdx, o => {
      if (o.idx === -1) return this.showStartMenu();
      if (o.idx === -4) { this.closeMenu(); return this.syncNow(); }
      if (o.idx === -5) { this.closeMenu(); return this.editCurrent(); }
      if (o.idx === -6) return this.showHelp(() => this.showJumpMenu());
      if (o.idx === -2) { this.closeMenu(); return this.exit(); }
      this.closeMenu(); this.songIdx = o.idx; this.pageIdx = 0; this.render();
    }, 'Pedál ◀ ▶ vybrat · podržet ▶ přejít · podržet ◀ zpět · číslo = skok',
      { layout: 'drawer', cls: 'r-set', kicker: 'Playlist', sub: `Píseň ${this.songIdx + 1} z ${n}`, headExtra: h('div', { class: 'r-prog' }, h('i', { style: { width: pct + '%' } })) });
  },
  showQuickMenu() { this.showJumpMenu(true); },

  editCurrent() { const cur = this.current(); if (cur && App.canEdit()) { this.close(); location.hash = '#/songs/' + cur.song.id; } },

  /* Ovládací lišta dole – ukáže se, když myš sjede do spodní části obrazovky */
  showBar() {
    if (this.menu) return;
    if (!this.bar) {
      // tlačítka reagují, jen když kurzor míří; jinak stisk propadne jako pedál (listování)
      const b = (icon, title, fn, cls = '') => h('button', { class: 'r-bbtn ' + cls, title, onmousedown: e => { if (!this.aimed()) return; e.preventDefault(); e.stopPropagation(); if (e.button === 0) fn(); } }, ic(icon));
      this.barInfo = h('div', { class: 'r-binfo' });
      this.bar = h('div', { class: 'r-bar' },
        this.bPrevSong = b('skipb', 'Předchozí píseň (Shift + ←)', () => this.prevSong()), this.bPrevPage = b('left', 'Předchozí stránka', () => this.prev()),
        this.barInfo,
        this.bNextPage = b('right', 'Další stránka', () => this.next()), this.bNextSong = b('skipf', 'Další píseň (Shift + →)', () => this.nextSong()),
        h('span', { class: 'r-bsep' }),
        b('list', 'Playlist a nabídka (Tab)', () => this.items.length ? this.showJumpMenu() : this.showStartMenu(), 'wide'));
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
    // stránky jen u písně s víc stránkami; píseň zpět / vpřed jen když nějaká je
    this.bPrevPage.classList.toggle('off', n < 2); this.bNextPage.classList.toggle('off', n < 2);
    this.bPrevSong.classList.toggle('off', !cur); this.bNextSong.classList.toggle('off', !cur);
    this.bPrevSong.disabled = this.songIdx <= 0; this.bNextSong.disabled = this.songIdx >= this.items.length - 1;
    this.barInfo.innerHTML = '';
    if (!cur) this.barInfo.append(h('b', {}, 'Prázdný playlist'), h('span', {}, 'tlačítko vpravo = jiný playlist'));
    else this.barInfo.append(h('b', {}, cur.song.title), h('span', {}, `Píseň ${this.songIdx + 1} / ${this.items.length}` + (n > 1 ? ` · strana ${this.pageIdx + 1} / ${n}` : '')));
    $('i', this.progress).style.width = (this.items.length ? (this.songIdx + (this.pageIdx + 1) / n) / this.items.length * 100 : 0) + '%';
  },

  showHelp(back) {
    const opts = READER_HELP.flatMap(([g, rows]) => [{ n: '', label: g, cls: 'r-grp' }, ...rows.map(r => ({ n: '', label: r[0], sub: r[1] }))]);
    const done = () => back ? back() : this.closeMenu();
    this.showMenu('Ovládání čtečky', opts, 1, done, 'Esc, Enter nebo podržet pedál = zpět', { cls: 'r-help', back: done });
  },

};
