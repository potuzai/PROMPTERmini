'use strict';
/* ===== Aplikace: směrování, horní lišta ===== */
const App = {
  lastEditHash: '#/songs',
  current: '',

  async init() {
    Settings.load();
    try { await Store.init(); }
    catch (e) {
      document.body.innerHTML = `<div class="empty"><div class="big">⚠</div>Nepodařilo se otevřít úložiště dat.<br><small>${esc(e.message)}</small></div>`;
      return;
    }
    // Webová verze: požádat prohlížeč, aby data nikdy nemazal
    if (!window.native && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    this.buildTopbar();
    Reader.init();
    Sync.on(() => this.paintSync());
    Store.on((type, id) => this.onStore(type, id));
    window.addEventListener('hashchange', () => this.go());
    document.addEventListener('keydown', e => {
      if (Reader.isOpen()) return;
      if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); if (SongsView.editor) SongsView.editor.save(true); }
      if (e.key === 'F5' && window.native) { e.preventDefault(); }
    });
    window.addEventListener('beforeunload', () => { if (SongsView.editor && SongsView.editor.dirty) SongsView.editor.save(); });
    // Drag & drop .txt/.json souborů kamkoli do okna
    document.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    document.addEventListener('drop', e => {
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      importTxtFiles([...e.dataTransfer.files]);
    });

    if (!location.hash || location.hash === '#' || location.hash === '#/') {
      if (Settings.get('startInReader') || (window.native && window.native.readerMode)) {
        history.replaceState(null, '', '#/reader/' + (Settings.get('lastPlaylist') || ''));
      } else history.replaceState(null, '', '#/songs');
    }
    this.go();
    Sync.refreshState();
    if (Sync.enabled()) {
      Sync.run().then(r => { if (r && r.downloaded) toast(`Staženo ${r.downloaded} změn od ostatních`, 'ok'); }).catch(() => {});
    }
    // Pravidelná kontrola změn od ostatních (složka každou minutu, GitHub každých 5 min)
    let tick = 0;
    setInterval(() => {
      tick++;
      if (!Sync.enabled() || !Settings.get('autoSync')) return;
      if (Sync.mode() === 'folder' || tick % 5 === 0) Sync.run().catch(() => {});
    }, 60 * 1000);
    if (window.native && Sync.mode() === 'folder') window.native.watchFolder(Settings.get('sharedFolder'));
    if (window.native) window.native.onFolderChange(() => { if (Sync.mode() === 'folder') Sync.schedule(); });
  },

  canEdit() { return !Settings.get('pinHash') || sessionStorage.getItem('unlocked') === '1'; },

  async unlock() {
    const inp = h('input', { class: 'inp', type: 'password', placeholder: 'PIN' });
    const v = await modal({ title: '🔒 Úpravy jsou chráněné PINem', body: inp, buttons: [{ label: 'Jen číst (čtečka)', value: null }, { label: 'Odemknout', primary: true, value: () => inp.value }] });
    if (v && sha1Bytes(utf8.enc('prompter:' + v)) === Settings.get('pinHash')) { sessionStorage.setItem('unlocked', '1'); return true; }
    if (v) toast('Špatný PIN', 'err');
    return false;
  },

  buildTopbar() {
    const tabs = [['songs', '🎵 Písně'], ['playlists', '📋 Playlisty'], ['templates', '🎨 Šablony'], ['singers', '🎤 Zpěváci'], ['settings', '⚙ Nastavení']];
    this.tabEls = {};
    const bar = h('div', { id: 'topbar' },
      h('div', { class: 'logo' }, 'Prompter ', h('span', {}, 'písní')),
      h('div', { class: 'tabs' }, tabs.map(([k, l]) => (this.tabEls[k] = h('button', { class: 'tab', onclick: () => { location.hash = '#/' + k; } }, l)))),
      this.syncPill = h('button', { class: 'sync-pill', title: 'Stav synchronizace – kliknutím synchronizuješ', onclick: () => this.syncClick() }, h('span', { class: 'dot' }), h('span', { class: 'lbl' }, '')),
      h('button', { class: 'btn primary', title: 'Otevřít čtečku (výběr playlistu)', onclick: () => { location.hash = '#/reader/' + (Settings.get('lastPlaylist') || ''); } }, '▶ Čtečka'));
    document.body.prepend(bar);
    this.paintSync();
  },

  paintSync() {
    const st = Sync.state;
    const labels = { off: 'připojit ke kapele', idle: 'synchronizováno', pending: 'neodeslané změny', syncing: 'synchronizuji…', error: 'chyba synchronizace', offline: 'offline' };
    this.syncPill.className = 'sync-pill ' + st;
    $('.lbl', this.syncPill).textContent = (labels[st] || st) + (Settings.get('readOnly') && st !== 'off' ? ' · jen čtení' : '');
    this.syncPill.title = st === 'error' ? Sync.lastError : (Sync.lastSync ? 'Poslední synchronizace ' + Sync.lastSync.toLocaleTimeString('cs-CZ') : 'Kliknutím synchronizuješ');
  },

  async syncClick() {
    if (!Sync.enabled()) return joinBandDialog();
    try { const r = await Sync.run(); toast(`Synchronizováno · staženo ${r.downloaded || 0}, odesláno ${r.pushed || 0}`, 'ok'); }
    catch (e) { toast(e.message, 'err', 6000); }
  },

  onStore(type, id) {
    if (Reader.isOpen()) return;
    const [view, param] = this.parseHash();
    if (type === 'sync') {
      // změny od ostatních – překreslit, ale neztratit rozepsanou píseň
      if (view === 'songs' && SongsView.editor && SongsView.editor.dirty) { SongsView.paintList && SongsView.paintList(); return; }
      return this.go(true);
    }
    if (view === 'songs' && SongsView.paintList) SongsView.paintList();
    if (view === 'playlists' && PlaylistsView.paintSide) PlaylistsView.paintSide();
    if (view === 'templates' && TemplatesView.paintSide && type === 'templates') TemplatesView.paintSide();
    Sync.refreshState();
  },

  parseHash() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    return [parts[0] || 'songs', parts[1] ? decodeURIComponent(parts[1]) : '', parts[2]];
  },

  async go(force) {
    const [view, param, extra] = this.parseHash();
    if (view === 'reader') {
      if (param) Reader.open(param, parseInt(extra || '0', 10));
      else Reader.open(null);
      return;
    }
    if (Reader.isOpen()) Reader.close();
    if (!this.canEdit() && !(await this.unlock())) { location.hash = '#/reader/' + (Settings.get('lastPlaylist') || ''); return; }
    if (SongsView.editor && SongsView.editor.dirty) await SongsView.editor.save();
    const key = location.hash;
    if (!force && key === this.current && $('#main').childElementCount) return;
    this.current = key;
    this.lastEditHash = key;
    for (const [k, el] of Object.entries(this.tabEls)) el.classList.toggle('active', k === view);
    const main = $('#main');
    main.innerHTML = '';
    SongsView.paintList = null; PlaylistsView.paintSide = null; TemplatesView.paintSide = null;
    if (SongsView.editor && SongsView.editor.ro) SongsView.editor.ro.disconnect();
    SongsView.editor = null;
    const views = { songs: SongsView, playlists: PlaylistsView, templates: TemplatesView, singers: SingersView, settings: SettingsView };
    (views[view] || SongsView).render(main, param);
    if (!Settings.get('welcomed') && Sync.mode() === 'off' && !$('.modal')) setTimeout(() => welcomeDialog(), 200);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
