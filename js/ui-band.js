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

  async join(code) {
    const d = this.parse(code);
    const prev = { syncMode: Settings.get('syncMode'), gh: clone(Settings.get('gh')), mega: clone(Settings.get('mega')), readOnly: Settings.get('readOnly') };
    try {
      if (d.k === 'gh') {
        Settings.set('gh', Object.assign({}, Settings.get('gh'), { owner: d.o, repo: d.r, branch: d.b || 'main', token: d.t, login: '', canPush: null }));
        const r = await GH.test();
        Settings.set('gh', Object.assign({}, Settings.get('gh'), { login: r.login, canPush: r.canPush }));
        Settings.set('syncMode', 'github');
      } else {
        const cfg = { email: d.e, password: d.p, folder: d.f || 'Prompter kapela' };
        await MegaProvider.api().test(cfg);
        Settings.set('mega', { email: d.e, pass: Secret.protect(d.p), folder: cfg.folder });
        Settings.set('syncMode', 'mega');
      }
    } catch (e) {
      for (const [k, v] of Object.entries(prev)) Settings.set(k, v);
      throw new Error(ipcError(e));
    }
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

async function joinBandDialog() {
  const ta = h('textarea', { class: 'inp', rows: 4, placeholder: 'PROMPTER-…', style: { fontFamily: 'Consolas, monospace', fontSize: '12px' } });
  const err = h('div', { style: { color: 'var(--err)', minHeight: '1.4em', marginTop: '6px' } });
  const body = h('div', {},
    h('p', {}, 'Vlož kód, který ti poslal správce kapely (WhatsApp, e-mail…). Aplikace se sama připojí a stáhne všechny písně a playlisty.'),
    ta, err);
  // Vyzkoušet rovnou kód ze schránky
  try { const c = await navigator.clipboard.readText(); if (c && c.includes(BandCode.PREFIX)) ta.value = c.trim(); } catch (e) { /* bez přístupu ke schránce */ }
  while (true) {
    const v = await modal({ title: '🔑 Připojit ke kapele', body, buttons: [{ label: 'Zrušit', value: null }, { label: 'Připojit', primary: true, value: () => ta.value }] });
    if (v === null || v === undefined) return false;
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
  const out = h('textarea', { class: 'inp', rows: 5, readonly: true, style: { fontFamily: 'Consolas, monospace', fontSize: '12px' } });
  const paint = () => { try { out.value = BandCode.make({ name: nameIn.value.trim(), ro: ro.checked }); } catch (e) { out.value = e.message; } };
  nameIn.oninput = () => { Settings.set('bandName', nameIn.value.trim()); paint(); };
  ro.onchange = paint;
  paint();
  const copyBtn = h('button', { class: 'btn primary', onclick: async () => {
    try { await navigator.clipboard.writeText(out.value); toast('Kód zkopírován – pošli ho členům kapely.', 'ok'); }
    catch (e) { out.select(); document.execCommand('copy'); toast('Kód zkopírován.', 'ok'); }
  } }, '📋 Kopírovat kód');
  const body = h('div', {},
    h('label', { class: 'f' }, h('span', {}, 'Název kapely'), nameIn),
    h('label', { class: 'chk', style: { margin: '8px 0' } }, ro, 'Jen pro čtení', h('span', { class: 'help' }, ' – pro PC čtečky (aplikace nic neodešle)')),
    out,
    h('div', { class: 'row', style: { marginTop: '8px' } }, h('div', { class: 'nogrow' }, copyBtn)),
    h('p', { class: 'help' }, 'Člen si stáhne Prompter, spustí ho, klikne na „Připojit ke kapele“ a vloží tento kód. Nic dalšího nastavovat ani instalovat nemusí.'),
    h('p', { class: 'help', style: { color: 'var(--warn)' } }, '⚠ Kód obsahuje přístup ke sdíleným písním – posílej ho jen členům kapely. Když unikne, změň heslo (Mega) nebo token (GitHub) a pošli nový kód.'));
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
      h('p', { class: 'help' }, 'Bude toto zařízení čtečkou nebo obrazovkou muzikanta (monitor, tablet)? Zvol „Nastavit obrazovku“ – to jde i později v Nastavení › Toto zařízení.')),
    buttons: [{ label: 'Nastavit obrazovku…', value: 'device' }, { label: 'Jen vyzkoušet', value: 'try' }, { label: 'Založit kapelu', value: 'new' }, { label: '🔑 Mám kód kapely', value: 'join', primary: true }],
  });
  if (v === 'join') joinBandDialog();
  if (v === 'device') setupWizard();
  if (v === 'new') location.hash = '#/settings/share';
}
