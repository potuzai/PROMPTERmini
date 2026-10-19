'use strict';
/* ===== Přihlášení ke kapele =====
   Kapela má jeden společný účet Mega. Člen se přihlásí jeho e-mailem a heslem (jako na jakémkoli webu),
   aplikace si data drží u sebe (prohlížeč / soubory programu) a jen je synchronizuje s Mega. */

/* adresa aplikace pro pozvánku (z programu vede na webovou verzi) */
function appUrl() {
  return window.native || !/^https?:$/.test(location.protocol) ? 'https://potuzai.github.io/PROMPTERmini/' : location.origin + location.pathname.replace(/index\.html$/, '');
}

/* ukázková píseň do kapely nepatří */
async function dropSampleSongs() {
  for (const s of [...Store.songs.values()]) if (s.sample) await Store.remove('songs', s.id, { silent: true });
}

/* Přihlásí k Mega, uloží přístup (trvale / jen do zavření prohlížeče) a stáhne data kapely */
async function bandLogin({ email, password, folder, remember = true, ro = false }) {
  const cfg = { email: String(email || '').trim(), password: password || '', folder: String(folder || '').trim() || 'PROMPTERmini' };
  if (!cfg.email || !cfg.password) throw new Error('Vyplň e-mail a heslo kapely.');
  if (window.native) remember = true; // program heslo šifruje přes Windows
  const prev = clone(Settings.data.mega || {});
  const same = Sync.mode() === 'mega' && (prev.email || '').toLowerCase() === cfg.email.toLowerCase() && (prev.folder || 'PROMPTERmini') === cfg.folder;
  if ((prev.email || '').toLowerCase() === cfg.email.toLowerCase() && (prev.folder || 'PROMPTERmini') === cfg.folder && prev.folderId) cfg.folderId = prev.folderId;
  const r = await MegaProvider.api().test(cfg).catch(e => { throw new Error(ipcError(e)); });
  Settings.set('rememberBand', remember);
  Settings.set('mega', { email: cfg.email, pass: remember ? Secret.protect(cfg.password) : '', folder: cfg.folder, folderId: r.folderId || '' });
  if (remember) sessionStorage.removeItem('prompter-secret-mega');
  else sessionStorage.setItem('prompter-secret-mega', JSON.stringify({ pass: Secret.protect(cfg.password) }));
  Settings.set('syncMode', 'mega');
  Settings.set('readOnly', !!ro);
  Settings.set('welcomed', true);
  if (!same) {
    await dropSampleSongs();
    await Sync.resetMeta();
  }
  Sync.lastError = ''; Sync.state = 'off';
  // přihlášení se povedlo – případná chyba synchronizace už není chyba přihlášení
  let res = null, syncError = '';
  try { res = await Sync.run(); } catch (e) { syncError = ipcError(e); }
  Store.emit('sync', null);
  return { email: r.email || cfg.email, res, syncError };
}

/* Odhlásit / odpojit toto zařízení od kapely – písně v něm zůstanou */
async function bandLogout() {
  const mega = Sync.mode() === 'mega', verb = mega ? 'Odhlásit' : 'Odpojit';
  if (!await confirmDlg(verb + ' toto zařízení od kapely? Písně v něm zůstanou, jen se přestanou synchronizovat.', verb)) return;
  Settings.set('syncMode', 'none'); Settings.set('readOnly', false); Settings.set('rememberBand', true);
  sessionStorage.removeItem('prompter-secret-mega');
  // přístupové údaje se z tohoto zařízení smažou (důležité na cizím PC), e-mail zůstane předvyplněný
  Settings.set('mega', Object.assign({}, Settings.data.mega, { pass: '' }));
  Settings.set('gh', Object.assign({}, Settings.data.gh, { token: '', login: '', canPush: null }));
  MegaProvider.api().logout();
  if (window.native) window.native.watchFolder('');
  await Sync.resetMeta(); Sync.lastError = ''; Sync.state = 'off'; Sync.refreshState(); App.go(true);
}

/* Přihlašovací okno: e-mail + heslo kapely + „Zůstat přihlášen“
   (expired = přihlášení vypršelo po zavření prohlížeče, error = Mega odmítla uložené přihlášení) */
async function loginDialog(opts = {}) {
  const m = Settings.data.mega || {};
  const email = h('input', { class: 'inp', type: 'email', name: 'email', autocomplete: 'username', value: m.email || '', placeholder: 'e-mail kapely' });
  const pass = h('input', { class: 'inp', type: 'password', name: 'password', autocomplete: 'current-password', placeholder: 'heslo kapely' });
  const remember = h('input', { type: 'checkbox', checked: Settings.data.rememberBand !== false });
  const folder = h('input', { class: 'inp', value: m.folder || 'PROMPTERmini' });
  const ro = h('input', { type: 'checkbox', checked: !!Settings.get('readOnly') });
  const err = h('div', { class: 'login-err' }, opts.error || '');
  const body = h('form', { class: 'login', onsubmit: e => e.preventDefault() },
    h('p', {}, opts.error
      ? 'Synchronizace s Mega se nepovedla. Zkontroluj e-mail, heslo a složku kapely (Další možnosti) a přihlas se znovu – písně v zařízení zůstaly.'
      : opts.expired
      ? 'Toto zařízení si přihlášení nepamatuje. Přihlas se znovu – písně v něm zůstaly, jen se teď nesynchronizují.'
      : 'Přihlas se e-mailem a heslem kapely (společný účet Mega). Písně a playlisty se pak samy stáhnou a synchronizují.'),
    h('label', { class: 'f' }, h('span', {}, 'E-mail'), email),
    h('label', { class: 'f' }, h('span', {}, 'Heslo'), pass),
    window.native ? null : h('label', { class: 'chk' }, remember, 'Zůstat přihlášen',
      h('span', { class: 'help' }, ' – na cizím nebo sdíleném počítači vypni')),
    h('details', { class: 'login-more' }, h('summary', {}, 'Další možnosti'),
      h('label', { class: 'f' }, h('span', {}, 'Složka v Mega'), folder),
      h('label', { class: 'chk' }, ro, 'Jen pro čtení', h('span', { class: 'help' }, ' – čtečka nic neodešle')),
      h('p', { class: 'help' }, 'Zakládáš kapelu? Na ', h('a', { href: 'https://mega.io/register', target: '_blank' }, 'mega.io/register'),
        ' založ nový účet jen pro kapelu (ne svůj osobní, bez dvoufázového ověření) a přihlas se jím. Aplikace si v něm vše připraví sama.')),
    err);
  while (true) {
    const v = await modal({ title: '🔑 Přihlásit ke kapele', body, buttons: [{ label: opts.expired || opts.error ? 'Teď ne' : 'Zrušit', value: null }, { label: 'Přihlásit', primary: true, value: true }],
      onOpen: () => { if (email.value) setTimeout(() => pass.focus(), 40); } });
    if (!v) return false;
    err.textContent = '';
    try {
      toast('Přihlašuji…', 'info', 2000);
      const r = await bandLogin({ email: email.value, password: pass.value, folder: folder.value, remember: remember.checked, ro: ro.checked });
      if (r.syncError) toast(`Přihlášeno jako ${r.email}, ale synchronizace se nepovedla: ${r.syncError}`, 'warn', 15000);
      else toast(`Přihlášeno jako ${r.email} · staženo ${r.res.downloaded || 0}, odesláno ${r.res.pushed || 0}${ro.checked ? ' (jen pro čtení)' : ''}`, 'ok', 5000);
      App.go(true);
      return true;
    } catch (e) { err.textContent = e.message; pass.select(); }
  }
}

/* Pozvánka pro členy: adresa aplikace + e-mail kapely (heslo se říká zvlášť) */
async function inviteDialog() {
  const m = MegaProvider.cfg();
  const folder = m.folder !== 'PROMPTERmini' ? `\nV „Další možnosti“ nastav složku: ${m.folder}` : '';
  const text = `Texty a playlisty kapely jsou v aplikaci PROMPTER mini:\n${appUrl()}\n\nPřihlas se e-mailem ${m.email} a heslem kapely (řeknu ti ho zvlášť).${folder}\n` +
    `V telefonu si aplikaci přidej na plochu (Sdílet → Přidat na plochu / Nainstalovat aplikaci).`;
  const ta = h('textarea', { class: 'inp', rows: 7, readonly: true }, text);
  const body = h('div', {},
    h('p', {}, 'Pošli členům tuto zprávu (WhatsApp, e-mail…). ', h('b', {}, 'Heslo kapely jim řekni zvlášť'), ' – ústně nebo SMS, ne ve stejné zprávě.'),
    ta,
    h('p', { class: 'help' }, 'Na Windows může člen místo webu použít program PROMPTER mini.exe – přihlásí se stejně.'),
    h('p', { class: 'help', style: { color: 'var(--warn)' } }, '⚠ Když někdo z kapely odejde nebo heslo unikne, změň heslo účtu Mega a řekni nové ostatním.'));
  const v = await modal({ title: '👥 Pozvat členy kapely', body, wide: true, buttons: [{ label: 'Zavřít', value: null }, { label: '📋 Kopírovat zprávu', primary: true, value: true }] });
  if (!v) return;
  try { await navigator.clipboard.writeText(text); } catch (e) { /* bez schránky */ }
  toast('Zpráva zkopírována – heslo kapely pošli zvlášť.', 'ok');
}

async function welcomeDialog() {
  Settings.set('welcomed', true);
  const v = await modal({
    title: '🎤 Vítej v PROMPTER mini',
    body: h('div', {},
      h('p', {}, 'Písně a playlisty kapely se sdílí přes společný účet Mega – stačí se přihlásit e-mailem a heslem kapely.'),
      h('ul', { class: 'help', style: { lineHeight: 1.8 } },
        h('li', {}, h('b', {}, 'Jsi v kapele?'), ' Klikni na „Přihlásit ke kapele“.'),
        h('li', {}, h('b', {}, 'Zakládáš kapelu?'), ' Založ na mega.io nový účet pro kapelu a přihlas se jím.'),
        h('li', {}, 'Nebo si aplikaci nejdřív jen vyzkoušej – přihlásit se jde kdykoli později.')),
      App.canInstall() ? h('p', { class: 'help' }, 'Tip: aplikaci si můžeš nainstalovat na plochu – Nastavení → Toto zařízení → Nainstalovat aplikaci.') : null),
    buttons: [{ label: 'Jen vyzkoušet', value: 'try' }, { label: '🔑 Přihlásit ke kapele', value: 'login', primary: true }],
  });
  if (v === 'login') loginDialog();
}
