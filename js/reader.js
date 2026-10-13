'use strict';
/* ===== Čtečka (prompter) ===== */
const Reader = {
  el: null, wrap: null, stage: null, stageTplKey: '',
  plId: null, items: [], songIdx: 0, pageIdx: 0,
  cache: new Map(), menu: null, black: false, cursorTimer: null, fsPending: false,
  mirrorOverride: null,

  init() {
    this.el = h('div', { id: 'reader', class: 'hidden' });
    this.wrap = h('div', { class: 'r-wrap' });
    this.el.appendChild(this.wrap);
    document.body.appendChild(this.el);
    this.el.addEventListener('contextmenu', e => e.preventDefault());
    this.el.addEventListener('mousedown', e => this.onMouse(e));
    this.el.addEventListener('wheel', e => this.onWheel(e), { passive: false });
    this.el.addEventListener('mousemove', () => this.wakeCursor());
    document.addEventListener('keydown', e => this.onKey(e));
    window.addEventListener('resize', () => { if (this.isOpen()) this.fit(); });
    document.addEventListener('fullscreenchange', () => { if (this.isOpen()) setTimeout(() => this.fit(), 50); });
    Store.on(() => { this.cache.clear(); if (this.isOpen() && !this.menu) { this.loadItems(); this.render(); } });
  },

  isOpen() { return !this.el.classList.contains('hidden'); },

  open(plId, songIdx = 0) {
    this.el.classList.remove('hidden');
    this.cache.clear();
    this.mirrorOverride = null;
    this.wakeCursor();
    this.ensureFullscreen();
    if (!this._synced && Settings.get('readerSyncOnStart') && GH.configured()) {
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
      this.items = pl ? pl.items.filter(id => Store.songs.has(id)) : [];
    }
    if (this.songIdx >= this.items.length) this.songIdx = Math.max(0, this.items.length - 1);
  },

  playlistName() {
    if (this.plId === 'all') return 'Všechny písně';
    if (this.plId.startsWith('song:')) return 'Náhled písně';
    const pl = Store.playlists.get(this.plId);
    return pl ? pl.name : '';
  },

  tplFor(song) {
    const pl = this.plId ? Store.playlists.get(this.plId) : null;
    const id = (pl && pl.templateId) || (song && song.templateId) || Settings.get('defaultTemplate');
    const tpl = Store.template(id);
    const z = Settings.get('readerZoom') || 1;
    if (z !== 1) tpl.fontSize = Math.round(tpl.fontSize * z);
    return tpl;
  },

  layoutFor(song, tpl) {
    const W = Settings.get('screenW'), H = Settings.get('screenH');
    const key = song.id + '|' + JSON.stringify(tpl) + '|' + W + 'x' + H + '|' + (song.updatedAt || '');
    if (!this.cache.has(key)) this.cache.set(key, Render.layout(song, tpl, W, H));
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
    const W = Settings.get('screenW'), H = Settings.get('screenH');
    if (!cur) {
      this.wrap.innerHTML = '';
      this.wrap.appendChild(h('div', { class: 'empty', style: { color: '#888', fontSize: '24px' } },
        h('div', { class: 'big' }, '🎤'), 'Playlist je prázdný.', h('div', { style: { fontSize: '16px' } }, 'Stiskni L nebo prostřední tlačítko pro výběr playlistu, Esc pro návrat.')));
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
    // předpočítat další píseň, ať je listování okamžité
    if (nextSong) setTimeout(() => { try { this.layoutFor(nextSong, this.tplFor(nextSong)); } catch (e) { /* nic */ } }, 50);
  },

  fit() {
    if (!this.stage) return;
    const cur = this.current();
    const mirror = this.mirrorOverride ?? (cur ? cur.tpl.mirror : 'none');
    Render.fit(this.stage, this.wrap, Settings.get('screenW'), Settings.get('screenH'), mirror);
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

  flash(msg) {
    const t = h('div', { class: 'r-toast' }, msg);
    this.el.appendChild(t);
    setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.remove(), 300); }, 1100);
  },

  toggleBlack() {
    this.black = !this.black;
    const b = $('.r-black', this.el);
    if (this.black && !b) this.el.appendChild(h('div', { class: 'r-black' }));
    if (!this.black && b) b.remove();
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

  wakeCursor() {
    this.el.classList.remove('nocursor');
    clearTimeout(this.cursorTimer);
    if (Settings.get('hideCursor')) this.cursorTimer = setTimeout(() => { if (!this.menu) this.el.classList.add('nocursor'); }, 2000);
  },

  /* ----- Ovládání ----- */
  onMouse(e) {
    if (!this.isOpen()) return;
    this.wakeCursor();
    if (this.menu) return; // menu si klik řeší samo
    e.preventDefault();
    if (this.consumeFsPending()) return;
    let b = e.button;
    if (Settings.get('swapMouse')) b = b === 0 ? 2 : b === 2 ? 0 : b;
    if (b === 2) this.next();
    else if (b === 0) this.prev();
    else if (b === 1) this.showJumpMenu();
    else if (b === 3) this.prev();
    else if (b === 4) this.next();
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
    this.wakeCursor();
    if (this.menu) return this.menuKey(e);
    const k = e.key;
    if (k === 'F11') return; // necháme prohlížeči
    if (this.consumeFsPending() && !['Escape'].includes(k)) { e.preventDefault(); return; }
    const map = {
      ArrowRight: () => e.shiftKey ? this.nextSong() : this.next(),
      ArrowDown: () => this.next(), PageDown: () => this.next(), ' ': () => this.next(), Enter: () => this.next(),
      ArrowLeft: () => e.shiftKey ? this.prevSong() : this.prev(),
      ArrowUp: () => this.prev(), PageUp: () => this.prev(), Backspace: () => this.prev(),
      Home: () => { this.pageIdx = 0; this.render(); },
      MediaTrackNext: () => this.nextSong(), MediaTrackPrevious: () => this.prevSong(),
      Escape: () => this.exit(),
    };
    const lk = k.length === 1 ? k.toLowerCase() : k;
    const letters = {
      l: () => this.showJumpMenu(), Tab: () => this.showJumpMenu(),
      p: () => this.showStartMenu(),
      f: () => this.toggleFullscreen(),
      b: () => this.toggleBlack(), '.': () => this.toggleBlack(),
      m: () => { const cur = this.current(); const base = this.mirrorOverride ?? (cur ? cur.tpl.mirror : 'none'); this.mirrorOverride = base === 'none' ? 'h' : 'none'; this.fit(); this.flash(this.mirrorOverride === 'h' ? 'Zrcadlení zapnuto' : 'Zrcadlení vypnuto'); },
      '+': () => this.zoom(0.05), '=': () => this.zoom(0.05), '-': () => this.zoom(-0.05),
      '0': () => { Settings.set('readerZoom', 1); this.cache.clear(); this.stage = null; this.render(); this.flash('Velikost písma 100 %'); },
      e: () => { const cur = this.current(); if (cur && App.canEdit()) { this.close(); location.hash = '#/songs/' + cur.song.id; } },
      s: () => this.syncNow(),
      h: () => this.showHelp(), '?': () => this.showHelp(),
    };
    const fn = map[k] || letters[lk];
    if (fn) { e.preventDefault(); fn(); }
  },

  zoom(d) {
    const z = Math.max(0.5, Math.min(2, Math.round(((Settings.get('readerZoom') || 1) + d) * 100) / 100));
    Settings.set('readerZoom', z);
    this.cache.clear(); this.stage = null; this.render();
    this.flash('Velikost písma ' + Math.round(z * 100) + ' %');
  },

  async syncNow() {
    if (!GH.configured()) return this.flash('Sdílení není nastaveno');
    this.flash('Synchronizuji…');
    try { const r = await Sync.run(); this.flash(r && r.downloaded ? `Staženo ${r.downloaded} změn` : 'Vše aktuální'); }
    catch (e) { this.flash('Chyba: ' + e.message); }
  },

  exit() {
    if (App.canEdit()) { this.close(); location.hash = App.lastEditHash || '#/playlists'; }
    else this.showStartMenu();
  },

  /* ----- Menu (výběr playlistu / skok na píseň) ----- */
  showMenu(title, options, selIdx, onPick, hint) {
    this.closeMenu();
    const list = h('div', { class: 'r-list' });
    const ov = h('div', { class: 'r-overlay' }, h('div', { class: 'r-menu' }, h('h2', {}, title), list, h('div', { class: 'r-hint' }, hint || '')));
    options.forEach((o, i) => {
      const el = h('div', { class: 'r-opt' }, h('span', { class: 'n' }, o.n ?? ''), h('span', {}, o.label), o.sub ? h('span', { style: { color: '#888', fontSize: '15px' } }, o.sub) : null);
      el.addEventListener('mousedown', ev => {
        ev.preventDefault(); ev.stopPropagation();
        if (ev.button === 0) { this.menu.sel = i; this.menu.pick(); }
        else if (ev.button === 2 || ev.button === 1) this.closeMenu(true);
      });
      list.appendChild(el);
    });
    ov.addEventListener('mousedown', ev => { if (ev.target === ov) { ev.preventDefault(); this.closeMenu(true); } });
    this.menu = {
      el: ov, sel: Math.max(0, selIdx), options, list,
      pick: () => { const o = options[this.menu.sel]; if (o) onPick(o); },
      paint: () => {
        $$('.r-opt', list).forEach((x, i) => x.classList.toggle('sel', i === this.menu.sel));
        const s = list.children[this.menu.sel]; if (s) s.scrollIntoView({ block: 'nearest' });
      },
    };
    this.el.appendChild(ov);
    this.menu.paint();
    this.el.classList.remove('nocursor');
  },
  closeMenu(userCancel) {
    if (!this.menu) return;
    this.menu.el.remove();
    this.menu = null;
    if (userCancel && !this.items.length && !this.plId) this.exit();
  },
  menuKey(e) {
    const m = this.menu;
    const k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowRight' || (k === 'Tab' && !e.shiftKey)) { m.sel = Math.min(m.options.length - 1, m.sel + 1); m.paint(); }
    else if (k === 'ArrowUp' || k === 'ArrowLeft' || (k === 'Tab' && e.shiftKey)) { m.sel = Math.max(0, m.sel - 1); m.paint(); }
    else if (k === 'PageDown') { m.sel = Math.min(m.options.length - 1, m.sel + 8); m.paint(); }
    else if (k === 'PageUp') { m.sel = Math.max(0, m.sel - 8); m.paint(); }
    else if (k === 'Home') { m.sel = 0; m.paint(); }
    else if (k === 'End') { m.sel = m.options.length - 1; m.paint(); }
    else if (k === 'Enter' || k === ' ') m.pick();
    else if (k === 'Escape' || k.toLowerCase() === 'l') { if (this.plId) this.closeMenu(true); else this.exit(); }
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
    this.showMenu('Vyber playlist', opts, last, o => {
      if (o.id === '__quit') return window.native.quit();
      if (o.id === '__edit') { this.closeMenu(); return this.exit(); }
      this.open(o.id, 0);
    },
      '↑ ↓ výběr · Enter / levé tlačítko otevřít · Esc zpět' + (GH.configured() ? ' · S synchronizovat' : ''));
  },

  showJumpMenu() {
    const opts = this.items.map((id, i) => {
      const s = Store.songs.get(id);
      return { idx: i, n: i + 1, label: s ? s.title : '?', sub: s ? [s.artist, s.key].filter(Boolean).join(' · ') : '' };
    });
    opts.push({ idx: -1, n: '', label: '↩ Jiný playlist…' });
    this.showMenu(this.playlistName() || 'Písně', opts, this.songIdx, o => {
      if (o.idx === -1) return this.showStartMenu();
      this.closeMenu(); this.songIdx = o.idx; this.pageIdx = 0; this.render();
    }, '↑ ↓ výběr · číslo = skok · Enter otevřít · Esc zavřít');
  },

  showHelp() {
    const rows = [
      ['Pravé tlačítko / → / PgDn / mezera', 'další stránka'], ['Levé tlačítko / ← / PgUp', 'předchozí stránka'],
      ['Shift + → / ←', 'další / předchozí píseň'], ['Prostřední tlačítko / L / Tab', 'seznam písní (skok)'],
      ['P', 'výběr playlistu'], ['F / F11', 'celá obrazovka'], ['B', 'zatemnit obrazovku'], ['M', 'zrcadlení (pro sklo prompteru)'],
      ['+ / − / 0', 'větší / menší / výchozí písmo'], ['S', 'synchronizovat (stáhnout změny)'], ['E', 'upravit aktuální píseň'], ['Esc', 'zavřít / zpět'],
    ];
    this.showMenu('Ovládání čtečky', rows.map(r => ({ n: '', label: r[0], sub: r[1] })), 0, () => this.closeMenu(), 'Esc nebo Enter zavře nápovědu');
  },
};
