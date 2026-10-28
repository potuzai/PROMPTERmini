'use strict';
/* ===== Čtečka (prompter) ===== */
/* Ovládání čtečky – nápověda ve čtečce (H) i v Nastavení › Čtečka a ovládání.
   Pódium: pedál (tlačítka myši) jen listuje a je chráněný proti dvojitému šlápnutí; co čtečku opouští, chce stisk dvakrát. */
const READER_HELP = [
  ['Pedál (tlačítka myši)', [
    ['Pravé', 'další stránka, na konci písně další píseň'], ['Levé', 'předchozí stránka'],
    ['Podržet levé, nebo oba najednou', 'playlist a nabídka'], ['Rychlé šlápnutí za sebou', 'každé se počítá – rychlý přesun'], ['Prostřední', 'playlist a nabídka'], ['Prázdný playlist: kterékoli', 'výběr playlistu'],
    ['V nabídce: levé / pravé', 'předchozí / další položka'], ['V nabídce: podržet pravé', 'potvrdit'], ['V nabídce: podržet levé', 'zpět, zavřít nabídku'],
    ['V nabídce: oba najednou', 'na tlačítka dole (znovu = zpět do seznamu)'], ['Při listování', 'dole se na chvíli ukáže lišta: předchozí a další píseň, ladění, BPM, délka']]],
  ['Airmouse a klávesnice', [
    ['→ ↓ PgDn mezera Enter', 'další stránka'], ['← ↑ PgUp', 'předchozí stránka'], ['Shift + → / ←', 'další / předchozí píseň'],
    ['Tab / L', 'seznam písní (číslem skok na píseň)'], ['P', 'jiný playlist'], ['Q / klávesa Menu', 'nabídka'], ['S', 'stáhnout změny'],
    ['E, E', 'upravit píseň'], ['F', 'celá obrazovka (ukončit: F, F)'], ['Esc, Esc', 'zavřít čtečku'], ['H', 'tato nápověda']]],
];

/* Údaje písně do řádku playlistu a do lišty: barevné ladění, tempo, délka, kdo zpívá (prázdné místo drží zarovnání) */
function songMeta(s) {
  return [
    h('span', { class: 'rm-key' }, s.key ? keyBadge(s.key) : null),
    h('span', { class: 'rm-bpm' }, s.tempo ? s.tempo + ' BPM' : ''),
    h('span', { class: 'rm-dur' }, durSec(s) ? s.duration : ''),
    h('span', { class: 'rm-sing sl-dots' }, songSingers(s).map(g => h('i', { title: g.name, style: { background: g.color } }))),
  ];
}

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
    if (gpuSoft()) this.el.classList.add('lowfx');   // bez grafické karty: žádné animace ani stíny
    addEventListener('pagehide', () => this.flushPos());
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
      if (!this.isOpen()) return;
      if (kd.menu) { if (this.menu) { this.menu.el.classList.remove('holding'); if (!kd.fired) this.menuStep(kd.fwd ? 1 : -1, kd.step); } return; }
      if (kd.back && !kd.fired && !this.menu) { this.prev(); this.showBar(); }
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

  /* songId: otevřít na této písni (když v playlistu je), jinak na pořadí songIdx */
  open(plId, songIdx = 0, pageIdx = 0, songId = '') {
    this.el.classList.remove('hidden');
    this.cache.clear();
    this.wakeCursor();
    this.ensureFullscreen();
    if (!this._synced && Settings.get('readerSyncOnStart') && Sync.enabled()) {
      this._synced = true;
      Sync.run().then(r => { if (r && r.downloaded && this.isOpen()) this.flash(`Staženo ${r.downloaded} změn`); }).catch(() => {});
    }
    if (!plId) { this.plId = null; this.items = []; this.stage = null; this.wrap.innerHTML = ''; if (this.hud) this.hud.classList.add('off'); this.showStartMenu(); return; }   // vždy čistý výběr playlistu
    this.plId = plId;
    if (!plId.startsWith('song:')) Settings.set('lastPlaylist', plId);
    this.loadItems();
    const at = songId ? this.items.indexOf(songId) : -1;
    this.songIdx = at >= 0 ? at : Math.max(0, Math.min(songIdx | 0, this.items.length - 1));
    this.pageIdx = Math.max(0, pageIdx | 0);
    this.closeMenu();
    this.shownSong = null;
    this.render();
  },

  close() {
    this.flushPos();
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
    this.savePos();
    // předpočítat další píseň, ať je listování okamžité – až v klidu, ne hned po otočení stránky (to by trhalo)
    if (nextSong) idle(() => { try { if (this.isOpen()) this.layoutFor(nextSong, this.tplFor(nextSong)); } catch (e) { /* nic */ } });
  },

  /* Kde se naposledy skončilo (tlačítko Pokračovat): uloží se chvíli po listování, ne při každém šlápnutí */
  savePos() {
    if (!this.plId || this.plId.startsWith('song:') || !this.items.length) return;
    this.pos = { pl: this.plId, song: this.items[this.songIdx], idx: this.songIdx, page: this.pageIdx };
    clearTimeout(this.posT);
    this.posT = setTimeout(() => this.flushPos(), 3000);
  },
  flushPos() { clearTimeout(this.posT); if (this.pos) { Settings.set('readerPos', this.pos); this.pos = null; } },
  lastPos() {
    const p = this.pos || Settings.get('readerPos');
    return p && p.pl && (p.pl === 'all' || Store.playlists.has(p.pl)) ? p : null;
  },
  resume() {
    const p = this.lastPos();
    if (!p) return this.flash('Zatím není kde pokračovat – vyber playlist');
    this.open(p.pl, p.idx, p.page, p.song);
  },
  resumeLabel() {
    const p = this.lastPos(), s = p && Store.songs.get(p.song);
    return p ? (p.pl === 'all' ? 'Všechny písně' : (Store.playlists.get(p.pl) || {}).name || '') + (s ? ' · ' + s.title : '') : '';
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
    if (Settings.get('hideCursor')) this.cursorTimer = setTimeout(() => { if (!this.menu && !this.barHover) this.el.classList.add('nocursor'); }, 2000);
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
    if (b === 2 || b === 4) { this.next(); return this.showBar(); }
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
    if (p.back && !p.fired) { p.fired = true; clearTimeout(this.holdT); this.prev(); this.showBar(); }
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
    const fwd = () => { this.next(); this.showBar(); };
    const map = {
      ArrowRight: () => e.shiftKey ? this.nextSong() : fwd(),
      ArrowDown: fwd, PageDown: fwd, ' ': fwd, Enter: fwd,
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
      e: () => this.current() ? this.confirm2('e', 'Upravit píseň (opustí čtečku)? Stiskni znovu E', () => this.editCurrent()) : null,
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
        ? h('div', { class: 'r-opt r-tool' + (o.cls ? ' ' + o.cls : ''), title: o.title || o.label + (o.key ? ' (' + o.key + ')' : '') }, ic(o.icon), h('span', {}, o.label), o.key ? h('kbd', {}, o.key) : null)
        : h('div', { class: 'r-opt' + (o.cls ? ' ' + o.cls : '') },
          o.icon ? ic(o.icon) : o.n !== '' && o.n != null ? h('span', { class: 'n' }, o.n) : null,
          h('span', { class: 'r-t' }, h('span', { class: 'r-l' }, o.label), o.sub ? h('span', { class: 'r-sub' }, o.sub) : null),
          o.meta ? h('span', { class: 'r-meta' }, o.meta) : null,
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
      // oba pedály najednou: skok na tlačítka dole, znovu = zpět na položku v seznamu
      foot: () => {
        const nl = list.children.length;
        if (!tools.children.length) return;
        if (m.sel < nl) { m.listSel = m.sel; m.sel = nl; } else m.sel = Math.min(m.listSel || 0, nl - 1);
        m.paint();
      },
      paint: (scroll = true) => {
        const all = m.els();
        all.forEach((x, i) => x.classList.toggle('sel', i === m.sel));
        // posunout jen seznam (scrollIntoView by posouval i celou čtečku – text by uskočil do strany)
        const el = all[m.sel];
        if (scroll && el && el.parentNode === list) {
          const top = el.offsetTop, bot = top + el.offsetHeight;
          if (top < list.scrollTop) list.scrollTop = top - 10;
          else if (bot > list.scrollTop + list.clientHeight) list.scrollTop = bot - list.clientHeight + 10;
        }
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
    if (p && p.menu && p.down && p.b !== b && !p.fired) {   // oba najednou = tlačítka dole (a zpět)
      p.fired = true; clearTimeout(this.holdT); m.el.classList.remove('holding');
      this.press = { b, start: now, down: true, fired: true, menu: true };
      return m.foot();
    }
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
    this.menuStep(b === 2 ? 1 : -1);
  },
  menuStep(d, step = 1) {
    const m = this.menu;
    if (!m) return;
    m.sel = Math.max(0, Math.min(m.options.length - 1, m.sel + d * step));
    m.paint();
  },
  menuKey(e) {
    const m = this.menu;
    const k = e.key;
    this.menuTouch();
    /* Šipky a PgUp/PgDn (i pedál, který posílá klávesy) posunou výběr až při puštění – podržená klávesa tak nic
       neposune a po 0,6 s potvrdí (vpřed) nebo vrátí (zpět) tu položku, na které výběr stojí.
       Vpřed i zpět najednou = tlačítka dole. */
    const fwd = ['ArrowDown', 'ArrowRight', 'PageDown'].includes(k), bwd = ['ArrowUp', 'ArrowLeft', 'PageUp'].includes(k);
    if (fwd || bwd) {
      e.preventDefault();
      const kd = this.keyDown;
      if (e.repeat) {
        if (kd && kd.k === k && kd.menu && !kd.fired && Date.now() - kd.t >= 600) { kd.fired = true; m.el.classList.remove('holding'); if (fwd) m.pick(); else m.back(); }
        return;
      }
      if (kd && kd.menu && !kd.fired && kd.k !== k && kd.fwd !== fwd) {
        kd.fired = true; m.el.classList.remove('holding');
        this.keyDown = { k, t: Date.now(), fired: true, menu: true, fwd };
        return m.foot();
      }
      this.keyDown = { k, t: Date.now(), fired: false, menu: true, fwd, step: m.grid && (k === 'ArrowDown' || k === 'ArrowUp') ? 2 : 1 };
      m.el.classList.add('holding');
      return;
    }
    if (k === 'Tab') { this.menuStep(e.shiftKey ? -1 : 1); }
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

  /* Úvodní obrazovka: Všechny písně, oblíbené playlisty, ostatní až po rozbalení; dole Pokračovat (vybrané) a nabídka.
     sel = index položky, která má být vybraná (po překreslení) */
  showStartMenu(sel) {
    const last = Settings.get('lastPlaylist'), pls = Store.sortedPlaylists();
    const fav = pls.filter(isReadyPl).sort((a, b) => a.ready - b.ready), rest = pls.filter(p => !isReadyPl(p));
    const card = p => ({ id: p.id, label: p.name || '(bez názvu)',
      sub: [p.date ? new Date(p.date).toLocaleDateString('cs-CZ') : '', plural(p.items.length, 'píseň', 'písně', 'písní')].filter(Boolean).join(' · '),
      badge: p.id === last ? 'naposledy' : '', cls: isReadyPl(p) ? 'fav' : '' });
    const opts = [{ id: 'all', label: 'Všechny písně', sub: 'podle interpreta · ' + plural(Store.songs.size, 'píseň', 'písně', 'písní'), badge: last === 'all' ? 'naposledy' : '', cls: 'all' },
      ...fav.map(card)];
    if (rest.length) opts.push({ id: '__pls', icon: this.startAll ? 'up' : 'down', label: this.startAll ? 'Skrýt ostatní playlisty' : 'Všechny playlisty',
      sub: plural(rest.length, 'další playlist', 'další playlisty', 'dalších playlistů'), cls: 'r-expand' });
    if (this.startAll) opts.push(...rest.map(card));
    opts.forEach((o, i) => { o.n = i + 1; });
    const resume = this.lastPos();
    if (resume) opts.push({ id: '__cont', icon: 'cont', label: 'Pokračovat', foot: true, cls: 'go', title: 'Pokračovat, kde se skončilo: ' + this.resumeLabel() });
    if (Sync.enabled()) opts.push({ id: '__sync', icon: 'sync', label: 'Stáhnout změny', key: 'S', foot: true });
    opts.push(this.screenTool(), { id: '__menu', icon: 'more', label: 'Další', foot: true, title: 'Upravit písně a playlisty, nápověda, ukončit' });
    const def = resume ? opts.findIndex(o => o.id === '__cont') : Math.max(0, opts.findIndex(o => o.id === last));
    this.showMenu('Vyber playlist', opts, sel >= 0 && sel < opts.length ? sel : def, o => {
      const at = this.menu ? this.menu.sel : 0;
      if (o.id === '__cont') return this.resume();
      if (o.id === '__pls') { this.startAll = !this.startAll; return this.showStartMenu(at); }
      if (o.id === '__sync') return this.syncNow();
      if (o.id === '__min') return window.native.minimize();
      if (o.id === '__fs') { this.toggleFullscreen(); return setTimeout(() => { if (this.menu && !this.plId) this.showStartMenu(at); }, 500); }
      if (o.id === '__menu') return this.showMore('start', () => this.showStartMenu(at));
      this.open(o.id, 0);
    }, 'Pedál ◀ ▶ vybrat · podržet ▶ spustit · oba najednou = tlačítka dole', { layout: 'full', grid: true, cls: 'r-start', kicker: 'PROMPTER mini', stay: true, sub: resume ? 'Pokračovat: ' + this.resumeLabel() : '' });
  },
  /* jedno tlačítko podle stavu: přes celou obrazovku → Minimalizovat (do Windows), v okně → Celá obrazovka */
  screenTool() {
    const full = this.isFullscreenLike();
    if (window.native && full) return { id: '__min', icon: 'min', label: 'Minimalizovat', foot: true, title: 'Minimalizovat do Windows (po obnovení zase přes celou obrazovku)' };
    return { id: '__fs', icon: 'full', label: full ? 'Do okna' : 'Celá obrazovka', key: 'F', foot: true };
  },

  /* Playlist (panel vpravo, text písně zůstane vidět): odehrané, hraje, další, přídavky; dole Pokračovat a nabídka.
     actions = otevřít rovnou na tlačítkách dole (Q, klávesa Menu) */
  showJumpMenu(actions) {
    const opts = this.items.map((id, i) => {
      const s = Store.songs.get(id), st = i < this.songIdx ? 'done' : i === this.songIdx ? 'cur' : i === this.songIdx + 1 ? 'next' : '';
      return { idx: i, n: i + 1, label: s ? s.title : '?', sub: s ? s.artist || '' : '', meta: s ? songMeta(s) : null,
        cls: [st, i === this.encoreAt ? 'encore-first' : '', this.encoreAt >= 0 && i >= this.encoreAt ? 'encore' : ''].filter(Boolean).join(' '),
        badge: st === 'cur' ? 'hraje' : st === 'next' ? 'další' : '' };
    });
    const first = opts.length;
    opts.push({ idx: -3, icon: 'cont', label: 'Pokračovat', foot: true, cls: 'go', title: 'Zpět do textu, kde jsi skončil' });
    opts.push({ idx: -1, icon: 'list', label: 'Jiný playlist', key: 'P', foot: true });
    if (Sync.enabled()) opts.push({ idx: -4, icon: 'sync', label: 'Stáhnout', key: 'S', foot: true });
    opts.push({ idx: -7, icon: 'more', label: 'Další', foot: true, title: 'Upravit píseň nebo playlist, nápověda, nastavení' });
    const n = this.items.length, pct = n ? (this.songIdx + 1) / n * 100 : 0;
    this.showMenu(this.playlistName() || 'Písně', opts, actions ? first : this.songIdx, o => {
      if (o.idx === -3) return this.closeMenu();
      if (o.idx === -1) return this.showStartMenu();
      if (o.idx === -4) { this.closeMenu(); return this.syncNow(); }
      if (o.idx === -7) return this.showMore('set', () => this.showJumpMenu(true));
      this.closeMenu(); this.songIdx = o.idx; this.pageIdx = 0; this.render();
    }, 'Pedál ◀ ▶ vybrat · podržet ▶ přejít · podržet ◀ zpět · oba najednou = tlačítka dole',
      { layout: 'drawer', cls: 'r-set', kicker: 'Playlist', sub: `Píseň ${this.songIdx + 1} z ${n}`, headExtra: h('div', { class: 'r-prog' }, h('i', { style: { width: pct + '%' } })) });
  },
  showQuickMenu() { this.showJumpMenu(true); },

  /* Nabídka „Další“: méně častá tlačítka (úpravy, nápověda, nastavení / ukončit). where: 'start' | 'set' */
  showMore(where, back) {
    const cur = where === 'set' && this.current(), real = this.plId && Store.playlists.has(this.plId);
    const opts = (where === 'set' ? [
      cur ? { id: 'song', icon: 'edit', label: 'Upravit píseň', sub: cur.song.title } : null,
      real ? { id: 'pl', icon: 'list', label: 'Upravit playlist', sub: this.playlistName() } : null,
      !real ? { id: 'songs', icon: 'song', label: 'Upravit písně', sub: 'seznam písní' } : null,
      { id: 'help', icon: 'help', label: 'Nápověda', sub: 'ovládání pedálem a klávesami', key: 'H' },
      { id: 'set', icon: 'sliders', label: 'Nastavení', sub: 'zavře čtečku' },
    ] : [
      { id: 'songs', icon: 'song', label: 'Upravit písně', sub: 'seznam písní' },
      { id: 'pls', icon: 'list', label: 'Upravit playlisty', sub: 'seznam playlistů' },
      { id: 'help', icon: 'help', label: 'Nápověda', sub: 'ovládání pedálem a klávesami', key: 'H' },
      window.native ? { id: 'quit', icon: 'power', label: 'Ukončit program', cls: 'danger' } : { id: 'close', icon: 'x', label: 'Zavřít čtečku' },
    ]).filter(Boolean);
    this.showMenu('Další možnosti', opts, 0, o => {
      if (o.id === 'song') return this.editCurrent();
      if (o.id === 'pl') return this.leaveTo('#/playlists/' + encodeURIComponent(this.plId));
      if (o.id === 'songs') return this.leaveTo('#/songs');
      if (o.id === 'pls') return this.leaveTo('#/playlists');
      if (o.id === 'set') return this.leaveTo('#/settings');
      if (o.id === 'help') return this.showHelp(() => this.showMore(where, back));
      if (o.id === 'quit') return App.quit();
      if (o.id === 'close') return this.leaveTo(App.lastEditHash || '#/playlists');   // do úprav (čtečka na pódiu: s PINem)
    }, 'Podržet ▶ vybrat · podržet ◀ zpět', { cls: 'r-more', back });
  },

  editCurrent() { const cur = this.current(); if (cur) this.leaveTo('#/songs/' + cur.song.id); },
  // do úprav (s PINem se App zeptá; špatný PIN = zpět do čtečky)
  leaveTo(hash) { this.closeMenu(); this.close(); location.hash = hash; },

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
        b('list', 'Playlist a nabídka (Tab, podržet levé tlačítko)', () => this.items.length ? this.showJumpMenu() : this.showStartMenu(), 'wide'));
      $('.r-bbtn.wide', this.bar).append(h('small', {}, 'podrž levé'));
      this.progress = h('div', { class: 'r-progress' }, h('i'));
      // kurzor na liště: lišta (i kurzor) nezmizí, dokud z ní neodjede
      this.bar.addEventListener('mouseenter', () => { this.barHover = true; clearTimeout(this.barT); });
      this.bar.addEventListener('mouseleave', () => { this.barHover = false; clearTimeout(this.barT); this.barT = setTimeout(() => this.hideBar(), 2600); this.wakeCursor(); });
      this.el.append(this.bar, this.progress);
    }
    this.paintBar();
    this.el.classList.add('bar-on');
    clearTimeout(this.barT);
    if (!this.barHover) this.barT = setTimeout(() => this.hideBar(), 2600);
  },
  hideBar() { this.el.classList.remove('bar-on'); this.barHover = false; },
  paintBar() {
    if (!this.bar) return;
    const cur = this.current();
    const n = cur ? cur.lay.pages.length : 1;
    // stránky jen u písně s víc stránkami; píseň zpět / vpřed jen když nějaká je
    this.bPrevPage.classList.toggle('off', n < 2); this.bNextPage.classList.toggle('off', n < 2);
    this.bPrevSong.classList.toggle('off', !cur); this.bNextSong.classList.toggle('off', !cur);
    this.bPrevSong.disabled = this.songIdx <= 0; this.bNextSong.disabled = this.songIdx >= this.items.length - 1;
    const n1 = this.items.length, prevS = Store.songs.get(this.items[this.songIdx - 1]), nextS = Store.songs.get(this.items[this.songIdx + 1]);
    const side = (cls, lbl, song, none) => h('div', { class: 'r-bside ' + cls }, h('small', {}, lbl), h('span', {}, song ? song.title : none));
    if (!cur) this.barInfo.replaceChildren(h('div', { class: 'r-bcur' }, h('b', {}, 'Prázdný playlist'), h('span', {}, 'tlačítko vpravo = jiný playlist')));
    else this.barInfo.replaceChildren(
      side('prev', 'Předchozí', prevS, '—'),
      h('div', { class: 'r-bcur' }, h('b', {}, cur.song.title),
        h('span', { class: 'r-bmeta' }, ...songMeta(cur.song), h('em', {}, `${this.songIdx + 1}/${n1}` + (n > 1 ? ` · str. ${this.pageIdx + 1}/${n}` : '')))),
      side('next', 'Další', nextS, 'konec playlistu'));
    $('i', this.progress).style.width = (this.items.length ? (this.songIdx + (this.pageIdx + 1) / n) / this.items.length * 100 : 0) + '%';
  },

  showHelp(back) {
    const opts = READER_HELP.flatMap(([g, rows]) => [{ n: '', label: g, cls: 'r-grp' }, ...rows.map(r => ({ n: '', label: r[0], sub: r[1] }))]);
    const done = () => back ? back() : this.closeMenu();
    this.showMenu('Ovládání čtečky', opts, 1, done, 'Esc, Enter nebo podržet pedál = zpět', { cls: 'r-help', back: done });
  },

};
