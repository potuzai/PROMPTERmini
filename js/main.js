'use strict';
/* ===== Aplikace: směrování, horní lišta ===== */
const App = {
  lastEditHash: '#/songs',
  current: '',

  async init() {
    Settings.load();
    this.applyTheme();
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => this.applyTheme());
    try { await Store.init(); }
    catch (e) {
      document.body.innerHTML = `<div class="empty"><div class="big">⚠</div>Nepodařilo se otevřít úložiště dat.<br><small>${esc(e.message)}</small></div>`;
      return;
    }
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); this.installEvt = e; });
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
    // „Zůstat přihlášen“ vypnuté a prohlížeč byl zavřený → přihlásit znovu
    if (Sync.locked()) setTimeout(() => loginDialog({ expired: true }), 50);
    this.go();
    Sync.refreshState();
    if (Sync.enabled() && !Sync.locked()) {
      Sync.run().then(r => { if (r && r.downloaded) toast(`Staženo ${r.downloaded} změn od ostatních`, 'ok'); }).catch(() => {});
    }
    // Pravidelná kontrola změn od ostatních (složka každou minutu, GitHub každých 5 min)
    let tick = 0;
    setInterval(() => {
      tick++;
      if (!Sync.enabled() || !Settings.get('autoSync') || Sync.locked()) return;
      if (Sync.mode() === 'folder' || tick % 5 === 0) Sync.run().catch(() => {});
    }, 60 * 1000);
    if (window.native && Sync.mode() === 'folder') window.native.watchFolder(Settings.get('sharedFolder'));
    if (window.native) window.native.onFolderChange(() => { if (Sync.mode() === 'folder') Sync.schedule(); });
  },

  /* Světlý / tmavý motiv (jen ovládání aplikace – barvy stránky čtečky určuje šablona) */
  applyTheme() {
    const t = Settings.get('theme') || 'dark';
    const light = t === 'light' || (t === 'auto' && matchMedia('(prefers-color-scheme: light)').matches);
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = light ? '#f0f0f2' : '#202022';
  },

  /* Instalace webové verze jako aplikace (PWA) – Android, iPhone/iPad, Chrome/Edge na PC */
  installEvt: null,
  canInstall() { return !window.native && /^https?:$/.test(location.protocol) && !matchMedia('(display-mode: standalone)').matches && !navigator.standalone; },
  async install() {
    if (this.installEvt) {
      const e = this.installEvt; this.installEvt = null;
      e.prompt();
      if ((await e.userChoice).outcome === 'accepted') toast('Aplikace se instaluje – najdeš ji na ploše.', 'ok');
      return;
    }
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const steps = ios
      ? ['Otevři tuto stránku v Safari.', 'Klepni na Sdílet (čtvereček se šipkou nahoru).', 'Zvol „Přidat na plochu“ a potvrď.']
      : /Android/.test(navigator.userAgent)
        ? ['Otevři tuto stránku v Chrome.', 'Klepni na ⋮ vpravo nahoře.', 'Zvol „Nainstalovat aplikaci“ (nebo „Přidat na plochu“).']
        : ['V Chrome nebo Edge klikni na ikonu instalace vpravo v adresním řádku,', 'nebo menu ⋮ → „Nainstalovat PROMPTER mini“ (Edge: Aplikace → Nainstalovat tento web jako aplikaci).', 'Pro čtečku na Windows je lepší program PROMPTER mini.exe.'];
    await modal({ title: '📲 Nainstalovat aplikaci', body: h('ol', { style: { lineHeight: 1.8 } }, steps.map(t => h('li', {}, t))) });
  },

  canEdit() { return !Settings.get('pinHash') || sessionStorage.getItem('unlocked') === '1'; },

  async unlock() {
    const inp = h('input', { class: 'inp', type: 'password', placeholder: 'PIN' });
    const v = await modal({ title: '🔒 Úpravy jsou chráněné PINem', body: inp, buttons: [{ label: 'Jen číst (čtečka)', value: null }, { label: 'Odemknout', primary: true, value: () => inp.value }] });
    if (v && sha1Bytes(utf8.enc('prompter:' + v)) === Settings.get('pinHash')) { sessionStorage.setItem('unlocked', '1'); return true; }
    if (v) toast('Špatný PIN', 'err');
    return false;
  },

  /* Boční lišta vlevo (návrh 20): sekce aplikace, čtečka, nastavení, stav synchronizace */
  buildTopbar() {
    const tabs = [['songs', '🎵 Písně'], ['playlists', '📋 Playlisty'], ['templates', '🎨 Šablony'], ['singers', '🎤 Obsazení']];
    this.tabEls = {};
    const tab = (k, l) => (this.tabEls[k] = h('button', { class: 'tab', title: l.replace(/^\S+ /, ''), onclick: () => { location.hash = '#/' + k; } }, l));
    const bar = h('nav', { id: 'topbar' },
      h('div', { class: 'logo', title: 'PROMPTER mini ' + APP_VERSION }, 'PROMPTER mini', h('span', {}, APP_VERSION)),
      h('div', { class: 'tabs' }, tabs.map(([k, l]) => tab(k, l))),
      h('button', { class: 'rail-btn play', title: 'Otevřít čtečku (výběr playlistu)', onclick: () => { location.hash = '#/reader/' + (Settings.get('lastPlaylist') || ''); } }, '▶', h('span', {}, 'Čtečka')),
      tab('settings', '⚙ Nastavení'),
      this.syncPill = h('button', { class: 'sync-pill', title: 'Stav synchronizace – kliknutím synchronizuješ', onclick: () => this.syncClick() }, h('span', { class: 'dot' }), h('span', { class: 'lbl' }, '')));
    document.body.prepend(bar);
    this.paintSync();
  },

  paintSync() {
    const st = Sync.state;
    const labels = { locked: 'odhlášeno – přihlas se ke kapele', off: 'přihlásit ke kapele', idle: 'synchronizováno', pending: 'neodeslané změny', syncing: 'synchronizuji…', error: 'chyba synchronizace', offline: 'offline' };
    const short = { locked: 'Přihlásit', off: 'Přihlásit', idle: 'Sdíleno', pending: 'Odeslat', syncing: 'Sdílím…', error: 'Chyba', offline: 'Offline' };
    const ro = Settings.get('readOnly') && st !== 'off' ? ' · jen čtení' : '';
    this.syncPill.className = 'sync-pill ' + st;
    $('.lbl', this.syncPill).textContent = short[st] || st;
    const full = (labels[st] || st) + ro;
    this.syncPill.dataset.state = full;
    this.syncPill.title = full + ' – ' + (st === 'error' ? Sync.lastError : (Sync.lastSync ? 'poslední synchronizace ' + Sync.lastSync.toLocaleTimeString('cs-CZ') : 'kliknutím synchronizuješ'));
  },

  async syncClick() {
    if (!Sync.enabled()) return loginDialog();
    if (Sync.locked()) return loginDialog({ expired: true });
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
    // první spuštění: program (čtečka) → průvodce zařízením; web → jen uvítání a připojení ke kapele
    if (!Settings.get('welcomed')) setTimeout(() => {
      if (Settings.get('welcomed') || $('.modal') || $('.wizard')) return; // jen jednou
      if (window.native) setupWizard(); else welcomeDialog();
    }, 200);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
