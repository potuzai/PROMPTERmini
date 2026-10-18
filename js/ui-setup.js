'use strict';
/* ===== První spuštění: k čemu zařízení slouží, orientace a velikost monitoru čtečky, motiv =====
   Vše jde později změnit v Nastavení › Toto zařízení. */

const DEVICE_ROLES = [
  { id: 'reader', icon: 'stagemon', name: 'Čtečka na pódiu', desc: 'Po zapnutí rovnou otevře čtečku s posledním playlistem. Úpravy můžeš zamknout PINem.' },
  { id: 'editor', icon: 'monitor', name: 'Počítač pro úpravy', desc: 'Psaní textů, playlisty, šablony. Čtečku jen jako náhled nebo na druhém monitoru.' },
  { id: 'both', icon: 'both', name: 'Obojí na jednom', desc: 'Doma upravuješ, na koncertě přepneš do čtečky. Hodí se pro jeden notebook.' },
  { id: 'musician', icon: 'phone', name: 'Muzikant (mobil, tablet)', desc: 'Písně s akordy a poznámkami pro tvůj nástroj. Ze sdílených písní jen stahuje.' },
];
const SCREEN_PRESETS = [
  { label: '21,5″ Full HD', w: 1080, h: 1920, d: 21.5 }, { label: '24″ Full HD', w: 1080, h: 1920, d: 24 },
  { label: '24″ 16:10', w: 1200, h: 1920, d: 24 }, { label: '27″ QHD', w: 1440, h: 2560, d: 27 },
  { label: '32″ 4K', w: 2160, h: 3840, d: 32 }, { label: '43″ TV 4K', w: 2160, h: 3840, d: 43 },
];
const THEMES = [['dark', 'Tmavý'], ['light', 'Světlý'], ['auto', 'Podle systému']];

/* Doporučená velikost písma pro čitelnost z dané vzdálenosti */
function fontAdvice(W, H, diag, dist) {
  const pxPerCm = Math.hypot(W, H) / (diag * 2.54);
  // výška velkého písmene ≈ 1 cm na každé 2 m vzdálenosti (pohodlně ~1,5 cm)
  const capCm = Math.max(0.6, dist * 0.5);
  return { pxPerCm, px: Math.round(capCm * 1.4 * pxPerCm / 0.72) };
}

/* Výchozí chování podle role zařízení */
function applyDeviceRole(role) {
  Settings.set('deviceRole', role);
  Settings.set('startInReader', role === 'reader');
  if (role === 'musician') {
    Settings.set('musView', Object.assign({}, Settings.get('musView'), { on: true }));
    if (Sync.enabled()) Settings.set('readOnly', true);
  }
}
function roleName(id) { return (DEVICE_ROLES.find(r => r.id === id) || {}).name || 'nevybráno'; }

function segControl(items, value, onPick) {
  const box = h('div', { class: 'segc', role: 'radiogroup' });
  const paint = v => $$('button', box).forEach(b => { const on = b.dataset.v === String(v); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  items.forEach(([v, l]) => box.appendChild(h('button', { type: 'button', role: 'radio', 'data-v': v, onclick: () => { paint(v); onPick(v); } }, l)));
  paint(value);
  return box;
}

function setupWizard() {
  if ($('.wizard')) return;
  const isPortrait = () => +st.h >= +st.w;
  const detected = () => [Math.round(screen.width * devicePixelRatio), Math.round(screen.height * devicePixelRatio)];
  const st = {
    step: 0,
    role: Settings.get('deviceRole') || (Settings.get('startInReader') ? 'reader' : 'editor'),
    w: Settings.get('screenW'), h: Settings.get('screenH'),
    diag: Settings.get('diagonal') || 24, dist: Settings.get('distance') || 2.5,
    rot: Settings.get('readerRotate') || 0, theme: Settings.get('theme') || 'dark', pin: '',
  };
  const steps = ['Zařízení', 'Orientace', 'Velikost', 'Hotovo'];
  const stepsEl = h('div', { class: 'wz-steps' });
  const title = h('h1', {});
  const sub = h('p', { class: 'wz-sub' });
  const body = h('div', { class: 'wz-body' });
  const backBtn = h('button', { class: 'btn', onclick: () => go(st.step === 3 && skipSize() ? 0 : st.step - 1) }, 'Zpět');
  const hint = h('span', { class: 'wz-hint' });
  const nextBtn = h('button', { class: 'btn primary', onclick: () => next() }, 'Pokračovat');
  const el = h('div', { class: 'wizard', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Nastavení zařízení' },
    h('div', { class: 'wz-brand' }, h('span', { class: 'wz-logo' }), 'Prompter · nastavení zařízení'),
    stepsEl,
    h('div', { class: 'wz-card' }, title, sub, body, h('div', { class: 'wz-foot' }, backBtn, hint, nextBtn)));
  document.body.appendChild(el);

  const skipSize = () => st.role === 'musician';
  const next = () => {
    if (st.step === 3) return finish();
    go(st.step === 0 && skipSize() ? 3 : st.step + 1);
  };
  // karty vybrané šipkami ←→ (airmouse), OK = pokračovat
  const cards = (items, value, onPick, cls = '') => {
    const box = h('div', { class: 'wz-cards ' + cls, role: 'radiogroup' });
    const paint = () => $$('.wz-opt', box).forEach(b => { const on = b.dataset.v === String(value); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    items.forEach(it => box.appendChild(h('button', { type: 'button', class: 'wz-opt', role: 'radio', 'data-v': it.id,
      onclick: () => { value = it.id; onPick(it.id); paint(); },
      ondblclick: () => next() }, h('span', { class: 'wz-radio' }), it.art || ic(it.icon), h('b', {}, it.name), h('span', {}, it.desc))));
    box.addEventListener('keydown', e => {
      const opts = $$('.wz-opt', box); const i = opts.indexOf(document.activeElement);
      if (i < 0 || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const n = opts[Math.max(0, Math.min(opts.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))];
      n.focus(); n.click();
    });
    paint();
    setTimeout(() => { const on = $('.wz-opt.on', box) || $('.wz-opt', box); if (on) on.focus(); }, 0);
    return box;
  };
  const monArt = portrait => h('span', { class: 'wz-mon' + (portrait ? ' p' : '') }, h('i'), h('i'), h('i'));
  const field = (label, inp, unit) => h('label', { class: 'f' }, h('span', {}, label), h('span', { class: 'wz-unit' }, inp, unit ? h('em', {}, unit) : null));
  const num = (key, min, max, step = 1) => {
    const i = h('input', { class: 'inp', type: 'number', min, max, step, value: st[key] });
    i.addEventListener('input', () => { st[key] = +i.value || st[key]; paintAdvice(); });
    return i;
  };
  let paintAdvice = () => {};

  function go(n) {
    st.step = Math.max(0, Math.min(3, n));
    stepsEl.innerHTML = '';
    steps.forEach((s, i) => {
      if (i) stepsEl.appendChild(h('span', { class: 'wz-line' }));
      const skipped = skipSize() && (i === 1 || i === 2);
      stepsEl.appendChild(h('span', { class: 'wz-step' + (i === st.step ? ' on' : i < st.step ? ' done' : '') + (skipped ? ' skip' : '') },
        h('span', { class: 'wz-num' }, i < st.step ? ic('check') : String(i + 1)), s));
    });
    backBtn.style.visibility = st.step ? 'visible' : 'hidden';
    nextBtn.textContent = st.step === 3 ? (st.role === 'reader' ? 'Spustit čtečku' : 'Hotovo') : 'Pokračovat';
    body.innerHTML = '';
    paintAdvice = () => {};
    if (st.step === 0) {
      title.textContent = 'K čemu bude toto zařízení sloužit?';
      sub.textContent = 'Podle toho se aplikace po zapnutí otevře a nabídne jen to, co potřebuješ.';
      body.append(cards(DEVICE_ROLES, st.role, v => { st.role = v; go(0); }, 'four'),
        h('p', { class: 'wz-note' }, 'Nevadí, když si nejsi jistý – všechno změníš později v Nastavení › Toto zařízení.'));
      hint.textContent = '←→ vybrat · OK pokračovat';
    } else if (st.step === 1) {
      const [dw, dh] = detected();
      title.textContent = 'Jak stojí monitor čtečky?';
      sub.textContent = `Tato obrazovka hlásí ${dw} × ${dh}` + (dh >= dw ? ' (na výšku).' : ' (na šířku).') + ' Stránky všech písní se navrhují přesně pro monitor čtečky.';
      body.append(
        cards([{ id: 'p', art: monArt(true), name: 'Na výšku', desc: 'Víc řádků na stránku – doporučeno pro čtečku' },
          { id: 'l', art: monArt(false), name: 'Na šířku', desc: 'Klasický monitor, televize, notebook' }], isPortrait() ? 'p' : 'l',
        v => { if ((v === 'p') !== isPortrait()) [st.w, st.h] = [st.h, st.w]; }, 'two'),
        h('div', { class: 'wz-row' },
          ic('rotate'),
          h('div', { class: 'wz-row-t' }, h('b', {}, 'Systém obraz neotáčí'), h('span', {}, 'Monitor stojí na výšku, ale Windows ukazuje na šířku? Aplikace obraz otočí sama.')),
          segControl([[0, 'Neotáčet'], [90, '90° ↻'], [270, '90° ↺']], st.rot, v => { st.rot = +v; })));
      hint.textContent = '←→ vybrat · Tab další volba · OK pokračovat';
    } else if (st.step === 2) {
      title.textContent = 'Jak velký je displej čtečky?';
      sub.textContent = 'Rozlišení určuje velikost stránky. Úhlopříčka a vzdálenost slouží jen k doporučení velikosti písma.';
      const wI = num('w', 320, 7680), hI = num('h', 240, 7680), dI = num('diag', 10, 100, 0.5), sI = num('dist', 0.5, 15, 0.1);
      const chips = h('div', { class: 'chips' }, SCREEN_PRESETS.map(p => h('button', { type: 'button', class: 'chip', onclick: () => {
        const [a, b] = isPortrait() ? [p.w, p.h] : [p.h, p.w];
        st.w = a; st.h = b; st.diag = p.d; wI.value = a; hI.value = b; dI.value = p.d; paintAdvice();
      } }, p.label)));
      const adv = h('div', { class: 'wz-advice' });
      const prev = h('span', { class: 'wz-mon' }, h('i'), h('i'), h('i'), h('i'), h('i'));
      paintAdvice = () => {
        const a = fontAdvice(st.w, st.h, st.diag, st.dist);
        adv.innerHTML = '';
        adv.append(h('b', {}, `Doporučené písmo: min. ${a.px} px`), h('span', {}, `${st.w} × ${st.h} · ≈ ${a.pxPerCm.toFixed(1)} px/cm · čitelné z ${st.dist} m`));
        prev.style.aspectRatio = st.w + ' / ' + st.h;
        prev.classList.toggle('p', isPortrait());
      };
      body.append(h('div', { class: 'wz-size' },
        h('div', { class: 'wz-size-f' },
          h('div', { class: 'ep-lbl' }, 'Rychlá volba'), chips,
          h('div', { class: 'row' }, field('Šířka', wI, 'px'), field('Výška', hI, 'px'),
            h('button', { type: 'button', class: 'btn nogrow', onclick: () => { [st.w, st.h] = detected(); wI.value = st.w; hI.value = st.h; paintAdvice(); } }, '⌖ Z této obrazovky')),
          h('div', { class: 'row' }, field('Úhlopříčka', dI, 'palců'), field('Vzdálenost zpěváka', sI, 'm'))),
        h('div', { class: 'wz-size-p' }, prev, adv)));
      paintAdvice();
      hint.textContent = 'Tab přepínat pole · ↑↓ měnit hodnotu · OK pokračovat';
      setTimeout(() => wI.focus(), 0);
    } else {
      title.textContent = 'Hotovo, zkontroluj to';
      sub.textContent = 'Vše se dá kdykoli změnit v Nastavení › Toto zařízení.';
      const rows = [['Zařízení', roleName(st.role), 0]];
      if (!skipSize()) rows.push(['Monitor čtečky', (isPortrait() ? 'Na výšku' : 'Na šířku') + (st.rot ? ` · otočit o ${st.rot === 90 ? '90° ↻' : '90° ↺'}` : ''), 1],
        ['Displej', `${st.w} × ${st.h} px · ${st.diag}″ · ${st.dist} m`, 2]);
      rows.push(['Po zapnutí', st.role === 'reader' ? 'Otevřít čtečku s posledním playlistem' : 'Otevřít seznam písní', 0]);
      const pin = h('input', { class: 'inp wz-pin', type: 'password', inputmode: 'numeric', placeholder: 'bez PINu', 'aria-label': 'PIN pro úpravy', value: st.pin });
      pin.oninput = () => { st.pin = pin.value; };
      body.append(
        h('div', { class: 'wz-sum' }, rows.map(([k, v, s]) => h('div', {}, h('span', {}, k), h('b', {}, v), h('button', { type: 'button', class: 'linkbtn', onclick: () => go(s) }, 'Změnit')))),
        h('div', { class: 'wz-row' }, ic('sun'), h('div', { class: 'wz-row-t' }, h('b', {}, 'Vzhled aplikace'), h('span', {}, 'Světlý se hodí do jasné místnosti, „podle systému“ se přepíná sám.')),
          segControl(THEMES, st.theme, v => { st.theme = v; Settings.set('theme', v); App.applyTheme(); })),
        st.role === 'musician' ? null : h('div', { class: 'wz-row' }, ic('lock'), h('div', { class: 'wz-row-t' }, h('b', {}, 'Zamknout úpravy PINem'), h('span', {}, st.role === 'reader' ? 'Doporučeno: na pódiu nikdo omylem nesmaže píseň.' : 'Nepovinné – bez PINu půjde jen číst.')), pin),
        h('div', { class: 'wz-row' }, ic('users'), h('div', { class: 'wz-row-t' }, h('b', {}, 'Kapela'), h('span', {}, 'Písně a playlisty se můžou samy sdílet s ostatními. Jde to i později.')),
          h('div', { class: 'wz-btns' },
            h('button', { type: 'button', class: 'btn', onclick: () => finish('new') }, 'Založit kapelu'),
            h('button', { type: 'button', class: 'btn', onclick: () => finish('join') }, '🔑 Mám kód kapely'))));
      hint.textContent = 'OK dokončí nastavení';
      setTimeout(() => nextBtn.focus(), 0);
    }
  }

  function finish(band) {
    applyDeviceRole(st.role);
    if (!skipSize()) {
      Settings.set('screenW', Math.max(320, st.w | 0)); Settings.set('screenH', Math.max(240, st.h | 0));
      Settings.set('diagonal', +st.diag); Settings.set('distance', +st.dist); Settings.set('readerRotate', st.rot);
    }
    Settings.set('theme', st.theme); App.applyTheme();
    if (st.pin) { Settings.set('pinHash', sha1Bytes(utf8.enc('prompter:' + st.pin))); sessionStorage.setItem('unlocked', '1'); }
    Settings.set('welcomed', true);
    el.remove();
    document.removeEventListener('keydown', onKey, true);
    if (band === 'join') return joinBandDialog();
    if (band === 'new') { location.hash = '#/settings/share'; return; }
    if (st.role === 'reader') location.hash = '#/reader/' + (Settings.get('lastPlaylist') || '');
    else App.go(true);
  }
  // OK (Enter) mimo pole = pokračovat, Esc = zpět
  const onKey = e => {
    if (!el.isConnected || $('.modal')) return;
    const inField = e.target.matches('input, select, textarea');
    if (e.key === 'Enter' && !(e.target.matches('button') && !e.target.classList.contains('wz-opt'))) { e.preventDefault(); e.stopPropagation(); next(); }
    else if (e.key === 'Escape' && st.step) { e.preventDefault(); go(st.step === 3 && skipSize() ? 0 : st.step - 1); }
    else if (inField) e.stopPropagation();
  };
  document.addEventListener('keydown', onKey, true);
  go(0);
}
