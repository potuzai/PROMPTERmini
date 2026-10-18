'use strict';
/* ===== Kód kapely: jedním kódem se člen připojí ke sdíleným písním ===== */
const BandCode = {
  PREFIX: 'PROMPTER-',

  make({ name, ro }) {
    const mode = Sync.mode();
    let d;
    if (mode === 'github') { const g = Settings.get('gh'); d = { k: 'gh', o: g.owner, r: g.repo, b: g.branch || 'main', t: g.token }; }
    else if (mode === 'mega') { const c = MegaProvider.cfg(); d = { k: 'mega', e: c.email, p: c.password, f: c.folder }; }
    else throw new Error('Kód kapely jde vytvořit jen při sdílení přes Mega nebo GitHub.');
    Object.assign(d, { v: 1, n: name || Settings.get('bandName') || 'Kapela', ro: !!ro });
    return this.PREFIX + textToB64(JSON.stringify(d)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },

  parse(code) {
    const c = String(code || '').replace(/\s+/g, '');
    const i = c.indexOf(this.PREFIX);
    if (i < 0) throw new Error('Tohle nevypadá jako kód kapely (má začínat „PROMPTER-“).');
    let b = c.slice(i + this.PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    let d;
    try { d = JSON.parse(b64ToText(b)); } catch (e) { throw new Error('Kód kapely je poškozený – zkopíruj ho celý ještě jednou.'); }
    if (!d || d.v !== 1 || !['gh', 'mega'].includes(d.k)) throw new Error('Neznámý formát kódu kapely.');
    return d;
  },

  async join(code, opts = {}) {
    const d = this.parse(code);
    const remember = opts.remember !== false;
    const prev = { syncMode: Settings.get('syncMode'), gh: clone(Settings.get('gh')), mega: clone(Settings.get('mega')), readOnly: Settings.get('readOnly') };
    try {
      if (d.k === 'gh') {
        Settings.set('gh', Object.assign({}, Settings.get('gh'), { owner: d.o, repo: d.r, branch: d.b || 'main', token: d.t, login: '', canPush: null }));
        const r = await GH.test();
        Settings.set('gh', Object.assign({}, Settings.get('gh'), { login: r.login, canPush: r.canPush }));
        Settings.set('syncMode', 'github');
        if (!remember) { sessionStorage.setItem('prompter-secret-gh', JSON.stringify({ token: d.t })); Settings.set('gh', Object.assign({}, Settings.data.gh, { token: '' })); }
      } else {
        const cfg = { email: d.e, password: d.p, folder: d.f || 'Prompter kapela' };
        await MegaProvider.api().test(cfg);
        Settings.set('mega', { email: d.e, pass: remember ? Secret.protect(d.p) : '', folder: cfg.folder });
        if (!remember) sessionStorage.setItem('prompter-secret-mega', JSON.stringify({ pass: Secret.protect(d.p) }));
        Settings.set('syncMode', 'mega');
      }
    } catch (e) {
      for (const [k, v] of Object.entries(prev)) Settings.set(k, v);
      throw new Error(ipcError(e));
    }
    Settings.set('rememberBand', remember);
    Settings.set('readOnly', !!d.ro);
    Settings.set('bandName', d.n || '');
    Settings.set('welcomed', true);
    // ukázková píseň do kapely nepatří
    for (const s of [...Store.songs.values()]) if (s.sample) await Store.remove('songs', s.id, { silent: true });
    await Sync.resetMeta();
    Sync.lastError = ''; Sync.state = 'off';
    const res = await Sync.run();
    Store.emit('sync', null);
    return { name: d.n, ro: !!d.ro, res };
  },
};

/* ===== Odkaz kapely + krátké heslo kapely =====
   Odkaz nese kód kapely zašifrovaný heslem kapely (PBKDF2 + AES-GCM). Bez hesla je k ničemu,
   heslo zase bez odkazu. Člen si odkaz uloží do záložek a zadá jen krátké heslo. */
const BandLink = {
  ITER: 250000,
  b64u: u8 => { let s = ''; for (const c of u8) s += String.fromCharCode(c); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  unb64u: t => { let b = String(t).replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '='; return Uint8Array.from(atob(b), c => c.charCodeAt(0)); },
  async key(password, salt) {
    const base = await crypto.subtle.importKey('raw', utf8.enc(password.trim()), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: this.ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },
  async seal(code, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await this.key(password, salt), utf8.enc(code)));
    const all = new Uint8Array(28 + ct.length); all.set(salt); all.set(iv, 16); all.set(ct, 28);
    return this.b64u(all);
  },
  async open(blob, password) {
    let all; try { all = this.unb64u(blob); } catch (e) { throw new Error('Odkaz kapely je poškozený – zkopíruj ho celý.'); }
    if (all.length < 40) throw new Error('Odkaz kapely je poškozený – zkopíruj ho celý.');
    try {
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(16, 28) }, await this.key(password, all.slice(0, 16)), all.slice(28));
      return utf8.dec(new Uint8Array(pt));
    } catch (e) { throw new Error('Špatné heslo kapely.'); }
  },
  url(blob, name) {
    const base = window.native ? 'https://potuzai.github.io/RUSTEDprompter/' : location.origin + location.pathname;
    return base + '?kapela=' + blob + (name ? '&n=' + encodeURIComponent(name) : '');
  },
  /* z vloženého textu (celý odkaz nebo jen jeho část) */
  fromText(t) { const m = /[?&]kapela=([A-Za-z0-9_-]{40,})/.exec(String(t || '')); return m ? m[1] : null; },
};

/* Připojení přes odkaz kapely: zadá se jen heslo kapely (+ zapamatovat na tomto zařízení) */
async function joinByLinkDialog(blob, name) {
  const pass = h('input', { class: 'inp', type: 'password', placeholder: 'heslo kapely', autocomplete: 'current-password' });
  const remember = h('input', { type: 'checkbox', checked: Settings.data.rememberBand !== false });
  const err = h('div', { style: { color: 'var(--err)', minHeight: '1.4em', marginTop: '6px' } });
  const body = h('div', {},
    h('p', {}, name ? ['Připojení ke kapele ', h('b', {}, name), '.'] : 'Připojení ke kapele.', ' Zadej heslo kapely, které ti dal správce.'),
    pass,
    h('label', { class: 'chk', style: { marginTop: '10px' } }, remember, 'Zapamatovat na tomto zařízení',
      h('span', { class: 'help' }, ' – vypni na cizím nebo sdíleném počítači: heslo pak bude potřeba po každém otevření prohlížeče')),
    err);
  while (true) {
    const v = await modal({ title: '🔑 Kapela', body, buttons: [{ label: 'Zrušit', value: null }, { label: 'Připojit', primary: true, value: () => pass.value }] });
    if (v === null || v === undefined) return false;
    try {
      const code = await BandLink.open(blob, v);
      toast('Připojuji ke kapele…', 'info', 2000);
      const r = await BandCode.join(code, { remember: window.native ? true : remember.checked });
      Settings.set('bandLink', blob);
      toast(`Vítej v kapele „${r.name}“! Staženo ${r.res.downloaded || 0} položek.${r.ro ? ' (jen pro čtení)' : ''}`, 'ok', 6000);
      App.go(true);
      return true;
    } catch (e) { err.textContent = e.message; pass.select(); }
  }
}

/* Po otevření prohlížeče, když si zařízení heslo nepamatuje: odemknout uloženým / otevřeným odkazem */
async function unlockBandSession(blob) {
  const pass = h('input', { class: 'inp', type: 'password', placeholder: 'heslo kapely' });
  const err = h('div', { style: { color: 'var(--err)', minHeight: '1.4em', marginTop: '6px' } });
  while (true) {
    const v = await modal({ title: '🔑 Heslo kapely', body: h('div', {}, h('p', {}, 'Toto zařízení si heslo kapely nepamatuje. Zadej ho pro synchronizaci s kapelou.'), pass, err),
      buttons: [{ label: 'Teď ne', value: null }, { label: 'Odemknout', primary: true, value: () => pass.value }] });
    if (!v) return false;
    try {
      const d = BandCode.parse(await BandLink.open(blob, v));
      if (d.k === 'mega') sessionStorage.setItem('prompter-secret-mega', JSON.stringify({ pass: Secret.protect(d.p) }));
      else sessionStorage.setItem('prompter-secret-gh', JSON.stringify({ token: d.t }));
      Sync.lastError = ''; Sync.run().then(r => { if (r && r.downloaded) toast(`Staženo ${r.downloaded} změn`, 'ok'); }).catch(() => {});
      return true;
    } catch (e) { err.textContent = e.message; }
  }
}

async function joinBandDialog() {
  const ta = h('textarea', { class: 'inp', rows: 4, placeholder: 'https://…?kapela=…  nebo  PROMPTER-…', style: { fontFamily: 'Consolas, monospace', fontSize: '12px' } });
  const err = h('div', { style: { color: 'var(--err)', minHeight: '1.4em', marginTop: '6px' } });
  const body = h('div', {},
    h('p', {}, 'Vlož odkaz kapely nebo kód kapely, který ti poslal správce (WhatsApp, e-mail…). Aplikace se sama připojí a stáhne všechny písně a playlisty.'),
    ta, err);
  // Vyzkoušet rovnou kód ze schránky
  try { const c = await navigator.clipboard.readText(); if (c && (c.includes(BandCode.PREFIX) || BandLink.fromText(c))) ta.value = c.trim(); } catch (e) { /* bez přístupu ke schránce */ }
  while (true) {
    const v = await modal({ title: '🔑 Připojit ke kapele', body, buttons: [{ label: 'Zrušit', value: null }, { label: 'Připojit', primary: true, value: () => ta.value }] });
    if (v === null || v === undefined) return false;
    const blob = BandLink.fromText(v);
    if (blob) { const m = /[?&]n=([^&\s]+)/.exec(v); return joinByLinkDialog(blob, m ? decodeURIComponent(m[1]) : ''); }
    try {
      toast('Připojuji ke kapele…', 'info', 2000);
      const r = await BandCode.join(v);
      toast(`Vítej v kapele „${r.name}“! Staženo ${r.res.downloaded || 0} položek.${r.ro ? ' (jen pro čtení)' : ''}`, 'ok', 6000);
      App.go(true);
      return true;
    } catch (e) {
      err.textContent = e.message;
    }
  }
}

async function inviteDialog() {
  const nameIn = h('input', { class: 'inp', value: Settings.get('bandName') || '', placeholder: 'např. Rusted' });
  const ro = h('input', { type: 'checkbox' });
  const passIn = h('input', { class: 'inp', type: 'text', placeholder: 'krátké heslo kapely (aspoň 6 znaků)', autocomplete: 'off' });
  const linkOut = h('textarea', { class: 'inp', rows: 3, readonly: true, placeholder: 'Zadej heslo kapely – odkaz se vytvoří sám', style: { fontFamily: 'Consolas, monospace', fontSize: '12px' } });
  const codeOut = h('textarea', { class: 'inp', rows: 4, readonly: true, style: { fontFamily: 'Consolas, monospace', fontSize: '12px' } });
  const code = () => BandCode.make({ name: nameIn.value.trim(), ro: ro.checked });
  let seq = 0;
  const paint = async () => {
    try { codeOut.value = code(); } catch (e) { codeOut.value = e.message; return; }
    const pw = passIn.value.trim();
    if (pw.length < 6) { linkOut.value = ''; return; }
    const my = ++seq;
    const blob = await BandLink.seal(code(), pw);
    if (my === seq) linkOut.value = BandLink.url(blob, nameIn.value.trim());
  };
  const deb = debounce(paint, 300);
  nameIn.oninput = () => { Settings.set('bandName', nameIn.value.trim()); deb(); };
  passIn.oninput = deb;
  ro.onchange = paint;
  paint();
  const copy = (ta, msg) => h('button', { class: 'btn primary', onclick: async () => {
    if (!ta.value) return toast('Nejdřív zadej heslo kapely.', 'warn');
    try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); document.execCommand('copy'); }
    toast(msg, 'ok');
  } }, '📋 Kopírovat');
  const body = h('div', {},
    h('label', { class: 'f' }, h('span', {}, 'Název kapely'), nameIn),
    h('label', { class: 'chk', style: { margin: '8px 0' } }, ro, 'Jen pro čtení', h('span', { class: 'help' }, ' – pro čtečky (aplikace nic neodešle)')),
    h('h3', {}, '1. Odkaz kapely + heslo (doporučeno)'),
    h('label', { class: 'f' }, h('span', {}, 'Heslo kapely – vymysli krátké, členům ho řekni zvlášť (ústně, SMS)'), passIn),
    h('div', { style: { marginTop: '8px' } }, linkOut),
    h('div', { class: 'row', style: { marginTop: '6px' } }, h('div', { class: 'nogrow' }, copy(linkOut, 'Odkaz zkopírován – pošli ho členům, heslo jim řekni zvlášť.'))),
    h('p', { class: 'help' }, 'Člen otevře odkaz, zadá heslo kapely a je připojený. Odkaz si uloží do záložek – i když prohlížeč po zavření smaže data, stačí odkaz otevřít a zadat krátké heslo. Samotný odkaz bez hesla je k ničemu (přístup v něm je zašifrovaný). Funguje i v programu Prompter.exe: Připojit ke kapele → vložit odkaz.'),
    h('details', { style: { marginTop: '10px' } }, h('summary', {}, '2. Starý způsob: dlouhý kód kapely (bez hesla)'),
      codeOut, h('div', { class: 'row', style: { marginTop: '6px' } }, h('div', { class: 'nogrow' }, copy(codeOut, 'Kód zkopírován.'))),
      h('p', { class: 'help', style: { color: 'var(--warn)' } }, '⚠ Kód není chráněný heslem – kdo ho má, má přístup ke sdíleným datům.')),
    h('p', { class: 'help', style: { color: 'var(--warn)' } }, '⚠ Když odkaz i heslo uniknou, změň heslo k Mega (nebo token na GitHubu), znovu se připoj a vytvoř nový odkaz.'));
  await modal({ title: '👥 Pozvat členy kapely', body, wide: true, buttons: [{ label: 'Hotovo', value: true, primary: true }] });
}


async function welcomeDialog() {
  Settings.set('welcomed', true);
  const v = await modal({
    title: '🎤 Vítej v Prompteru',
    body: h('div', {},
      h('p', {}, 'Písně a playlisty můžeš sdílet s ostatními členy kapely – synchronizují se samy přes internet.'),
      h('ul', { class: 'help', style: { lineHeight: 1.8 } },
        h('li', {}, h('b', {}, 'Dostal(a) jsi kód kapely?'), ' Klikni na „Mám kód kapely“ a vlož ho.'),
        h('li', {}, h('b', {}, 'Zakládáš kapelu?'), ' V Nastavení → Sdílení s kapelou propojíš Mega nebo GitHub a pak pozveš ostatní kódem.'),
        h('li', {}, 'Nebo si aplikaci nejdřív jen vyzkoušej – sdílení jde zapnout kdykoli později.')),
      ),
    buttons: [{ label: 'Jen vyzkoušet', value: 'try' }, { label: 'Založit kapelu', value: 'new' }, { label: '🔑 Mám kód kapely', value: 'join', primary: true }],
  });
  if (v === 'join') joinBandDialog();
  if (v === 'new') location.hash = '#/settings/share';
}
