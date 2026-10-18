'use strict';
/* ===== Šablony ===== */
const FONTS = ['Roboto', 'Roboto Condensed', 'Arial', 'Arial Black', 'Segoe UI', 'Segoe UI Semibold', 'Calibri', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Georgia', 'Times New Roman', 'Cambria', 'Consolas', 'Impact', 'Franklin Gothic Medium', 'Lucida Sans Unicode'];
const TPL_FIELDS = [
  { g: 'Písmo' },
  { k: 'fontFamily', l: 'Font', t: 'select', o: FONTS.map(f => [f, f]) },
  { k: 'fontSize', l: 'Velikost písma (px)', t: 'range', min: 20, max: 160, step: 1 },
  { k: 'fontWeight', l: 'Tloušťka', t: 'select', o: [[400, 'normální'], [600, 'polotučné'], [700, 'tučné'], [900, 'extra tučné']] },
  { k: 'lineHeight', l: 'Řádkování', t: 'range', min: 0.9, max: 2.2, step: 0.02 },
  { k: 'letterSpacing', l: 'Rozestup písmen', t: 'range', min: -0.05, max: 0.2, step: 0.005,
    fmt: x => +x === 0 ? 'normální' : (x > 0 ? 'širší o ' : 'užší o ') + Math.round(Math.abs(x) * 100) + ' % výšky písma',
    help: 'Vzdálenost mezi jednotlivými písmeny. Trochu širší rozestup pomáhá čitelnosti z dálky, užší dostane víc textu na řádek.' },
  { k: 'align', l: 'Zarovnání', t: 'select', o: [['left', 'vlevo'], ['center', 'na střed'], ['right', 'vpravo']] },
  { k: 'uppercase', l: 'VŠE VELKÝMI PÍSMENY', t: 'check' },
  { g: 'Barvy' },
  { k: 'bgColor', l: 'Pozadí', t: 'color' }, { k: 'textColor', l: 'Text (bez zpěváka)', t: 'color' },
  { k: 'sectionColor', l: 'Nadpisy sekcí', t: 'color' }, { k: 'noteColor', l: 'Poznámky', t: 'color' }, { k: 'headerColor', l: 'Záhlaví/zápatí', t: 'color' },
  { g: 'Barva textu' },
  { k: 'textBy', l: 'Barva textu podle', t: 'select', o: [['singer', 'zpěváka'], ['section', 'části písně (sloka / refrén / mezičást)']],
    help: 'Podle části písně: sekce s „refrén“ v názvu mají barvu refrénu, „mezičást / bridge / předrefrén“ barvu mezičásti, ostatní barvu sloky. Zpěváka pak ukazuje jen pruh.' },
  { k: 'verseColor', l: 'Sloka', t: 'color' }, { k: 'chorusColor', l: 'Refrén', t: 'color' }, { k: 'bridgeColor', l: 'Mezičást', t: 'color' },
  { g: 'Označení zpěváků' },
  { k: 'singerText', l: 'Obarvit text barvou zpěváka', t: 'check' },
  { k: 'singerBar', l: 'Barevný pruh vlevo od řádku', t: 'check' },
  { k: 'barWidth', l: 'Šířka pruhu (px)', t: 'range', min: 4, max: 40, step: 1 },
  { k: 'singerBg', l: 'Podbarvit pozadí řádku', t: 'check' },
  { k: 'singerBadge', l: 'Jmenovka zpěváka před řádkem', t: 'check' },
  { g: 'Rozvržení stránky' },
  { k: 'padX', l: 'Okraj vlevo/vpravo (px)', t: 'range', min: 0, max: 400, step: 2 },
  { k: 'padY', l: 'Okraj nahoře/dole (px)', t: 'range', min: 0, max: 300, step: 2 },
  { k: 'columns', l: 'Počet sloupců', t: 'select', o: [[1, '1'], [2, '2'], [3, '3']] },
  { k: 'colGap', l: 'Mezera mezi sloupci (px)', t: 'range', min: 10, max: 200, step: 2 },
  { k: 'stanzaGap', l: 'Mezera mezi slokami (× výška písma)', t: 'range', min: 0, max: 2, step: 0.05 },
  { k: 'fit', l: 'Dlouhá píseň', t: 'select', o: [['shrink', 'zmenšit písmo, aby se vešla na 1 stránku'], ['paginate', 'rozdělit na více stránek']] },
  { k: 'minScale', l: 'Nejmenší zmenšení písma', t: 'range', min: 0.4, max: 1, step: 0.05, pct: true },
  { g: 'Zobrazení' },
  { k: 'showHeader', l: 'Záhlaví (název, tónina, pořadí)', t: 'check' },
  { k: 'showFooter', l: 'Zápatí (strana, další píseň)', t: 'check' },
  { k: 'headerSize', l: 'Velikost záhlaví/zápatí (px)', t: 'range', min: 14, max: 70, step: 1 },
  { k: 'showSections', l: 'Zobrazit nadpisy sekcí', t: 'check' },
  { k: 'sectionScale', l: 'Velikost nadpisů sekcí', t: 'range', min: 0.3, max: 1.2, step: 0.05, pct: true },
  { k: 'showNotes', l: 'Zobrazit poznámky (//)', t: 'check' },
  { k: 'mirror', l: 'Zrcadlení (pro sklo prompteru)', t: 'select', o: [['none', 'žádné'], ['h', 'vodorovně'], ['v', 'svisle'], ['hv', 'obojí']] },
];

const TemplatesView = {
  previewSong: null, page: 0,
  render(main, tplId) {
    const side = h('div', { class: 'side' });
    const content = h('div', { class: 'content' });
    main.append(h('div', { class: 'view' + (tplId ? ' has-detail' : '') }, side, content));
    content.appendChild(h('button', { class: 'btn m-back', onclick: () => { location.hash = '#/templates/'; } }, '◀ Šablony'));
    const list = h('div', { class: 'list' });
    side.append(h('div', { class: 'side-head' },
      h('button', { class: 'btn primary', onclick: () => this.create(tplId) }, '＋ Nová šablona'),
      h('div', { class: 'help' }, 'Šablona určuje vzhled stránky ve čtečce – písmo, barvy, okraje. Přiřadíš ji playlistu nebo písni.')), list);
    const def = Settings.get('defaultTemplate');
    this.paintSide = () => {
      list.innerHTML = '';
      for (const t of [...Store.templates.values()].sort((a, b) => a.name.localeCompare(b.name, 'cs'))) {
        list.appendChild(h('div', { class: 'item' + (t.id === tplId ? ' active' : ''), onclick: () => { location.hash = '#/templates/' + t.id; } },
          h('div', { style: { width: '26px', height: '18px', background: t.bgColor, border: '1px solid #555', flex: '0 0 auto' } }),
          h('div', { class: 't' }, h('b', {}, t.name), t.id === Settings.get('defaultTemplate') ? h('small', {}, '★ výchozí') : null)));
      }
    };
    this.paintSide();
    const tpl = Store.templates.get(tplId || def) || [...Store.templates.values()][0];
    if (!tplId && tpl && !isMobile()) { history.replaceState(null, '', '#/templates/' + tpl.id); tplId = tpl.id; this.paintSide(); }
    if (!tplId && isMobile()) return;
    if (tpl) this.editor(content, tpl);
  },

  async create(fromId) {
    const name = await promptDlg('Název nové šablony', 'Moje šablona');
    if (!name) return;
    const base = Store.template(fromId);
    const t = Object.assign(clone(base), { id: uid(), name });
    await Store.put('templates', t);
    location.hash = '#/templates/' + t.id;
  },

  editor(root, tpl) {
    const t = Object.assign(clone(DEFAULT_TEMPLATE), tpl);
    const save = debounce(() => { Store.put('templates', t); }, 700);
    const form = h('div', { class: 'tpl-form' });
    const nameInp = h('input', { class: 'inp', value: t.name });
    nameInp.oninput = () => { t.name = nameInp.value; save(); };
    form.append(h('label', { class: 'f', style: { marginBottom: '10px' } }, h('span', {}, 'Název šablony'), nameInp),
      h('div', { class: 'row', style: { marginBottom: '12px' } },
        h('button', { class: 'btn', onclick: async () => { Settings.set('defaultTemplate', t.id); this.paintSide(); toast('Nastaveno jako výchozí šablona', 'ok'); } }, '★ Nastavit jako výchozí'),
        h('button', { class: 'btn', onclick: () => this.create(t.id) }, '⧉ Kopie'),
        t.id !== 'default' ? h('button', { class: 'btn danger nogrow', onclick: () => this.del(t) }, '🗑') : null));
    let fs = null;
    for (const f of TPL_FIELDS) {
      if (f.g) { fs = h('fieldset', {}, h('legend', {}, f.g)); form.appendChild(fs); continue; }
      let ctl;
      const v = t[f.k];
      if (f.t === 'check') {
        ctl = h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!v, onchange: e => { t[f.k] = e.target.checked; upd(); } }), f.l);
      } else if (f.t === 'select') {
        const sel = h('select', { class: 'inp' }, f.o.map(([val, lab]) => h('option', { value: val, selected: String(val) === String(v) }, lab)));
        sel.onchange = () => { t[f.k] = typeof f.o[0][0] === 'number' ? +sel.value : sel.value; upd(); };
        ctl = h('label', { class: 'f' }, h('span', {}, f.l), sel);
      } else if (f.t === 'color') {
        const c = h('input', { type: 'color', value: v });
        c.oninput = () => { t[f.k] = c.value; upd(); };
        ctl = h('label', { class: 'chk' }, c, f.l);
      } else if (f.t === 'range') {
        const fmt = f.fmt || (x => f.pct ? Math.round(x * 100) + ' %' : String(+(+x).toFixed(3)));
        const lab = h('b', {}, fmt(v));
        const r = h('input', { type: 'range', min: f.min, max: f.max, step: f.step, value: v });
        r.oninput = () => { t[f.k] = +r.value; lab.textContent = fmt(r.value); upd(); };
        ctl = h('label', { class: 'f' }, h('span', {}, f.l, ': ', lab), r, f.help ? h('span', { class: 'help field-help' }, f.help) : null);
      }
      fs.appendChild(h('div', { style: { marginBottom: '8px' } }, ctl));
    }

    const prevWrap = h('div', { class: 'preview-wrap' });
    const songSel = h('select', { class: 'inp', style: { width: 'auto' } }, Store.sortedSongs().map(s => h('option', { value: s.id, selected: s.id === this.previewSong }, s.title)));
    const pageLbl = h('span', { class: 'dim' });
    let lay, stage;
    const W = Screens.main().w, H = Screens.main().h;
    const paint = () => {
      const song = Store.songs.get(songSel.value) || sampleSong();
      lay = Render.layout(song, t, W, H);
      this.page = Math.min(this.page, lay.pages.length - 1);
      prevWrap.innerHTML = '';
      stage = Render.makeStage(t, W, H);
      prevWrap.appendChild(stage);
      prevWrap.appendChild(dimLabel(W, H));
      Render.renderPage(stage, lay, t, this.page, { title: song.title, artist: song.artist, key: song.key, tempo: song.tempo, pos: '3/12', next: 'Další píseň v playlistu' });
      Render.fit(stage, prevWrap, W, H, t.mirror);
      pageLbl.textContent = `strana ${this.page + 1}/${lay.pages.length}` + (lay.k < 0.999 ? ` · písmo zmenšeno na ${Math.round(lay.k * 100)} %` : '');
    };
    const upd = () => { save(); clearTimeout(this._pt); this._pt = setTimeout(paint, 60); };
    songSel.onchange = () => { this.previewSong = songSel.value; this.page = 0; paint(); };
    root.appendChild(h('div', { class: 'tpl-layout' }, form,
      h('div', { class: 'tpl-preview' },
        h('div', { class: 'pane-title' }, 'Náhled:', songSel,
          h('button', { class: 'btn small icon', onclick: () => { this.page = Math.max(0, this.page - 1); paint(); }, title: 'Předchozí stránka' }, ic('left')), pageLbl,
          h('button', { class: 'btn small icon', onclick: () => { this.page++; paint(); }, title: 'Další stránka' }, ic('right')),
          h('span', { class: 'grow', style: { flex: 1 } }), h('span', {}, `monitor ${W}×${H}`)),
        prevWrap)));
    new ResizeObserver(() => stage && Render.fit(stage, prevWrap, W, H, t.mirror)).observe(prevWrap);
    paint();
  },

  async del(t) {
    if (!await confirmDlg(`Smazat šablonu „${t.name}“? Písně a playlisty s ní přejdou na výchozí šablonu.`, 'Smazat', true)) return;
    if (Settings.get('defaultTemplate') === t.id) Settings.set('defaultTemplate', 'default');
    await Store.remove('templates', t.id);
    location.hash = '#/templates';
  },
};

/* ===== Zpěváci ===== */
const SingersView = {
  render(main) {
    const content = h('div', { class: 'content' });
    main.appendChild(h('div', { class: 'view' }, content));
    const cfg = clone(Store.config.get('singers') || { id: 'singers', list: DEFAULT_SINGERS });
    const save = debounce(() => Store.put('config', cfg), 500);
    const tbody = h('tbody');
    const paint = () => {
      tbody.innerHTML = '';
      cfg.list.forEach((s, i) => {
        const code = h('input', { class: 'inp', value: s.code, maxlength: 3, style: { width: '70px', textTransform: 'uppercase', fontWeight: 700 } });
        const name = h('input', { class: 'inp', value: s.name });
        const color = h('input', { type: 'color', value: s.color });
        const sample = h('div', { class: 'sg-sample' });
        const paintSample = () => { sample.textContent = s.name + ' zpívá tento řádek'; sample.style.color = s.color; sample.style.borderColor = s.color; sample.style.fontWeight = s.bold ? 900 : 700; sample.style.fontStyle = s.italic ? 'italic' : 'normal'; };
        paintSample();
        code.onchange = async () => {
          const nc = code.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (!nc || cfg.list.some((x, j) => j !== i && x.code === nc)) { toast('Zkratka musí být jedinečná (písmena/číslice).', 'err'); code.value = s.code; return; }
          const old = s.code;
          s.code = nc; save();
          const n = await renameSingerCode(old, nc);
          if (n) toast(`Zkratka změněna i v ${n} písních`, 'ok');
        };
        name.oninput = () => { s.name = name.value; paintSample(); save(); };
        color.oninput = () => { s.color = color.value; paintSample(); save(); };
        tbody.appendChild(h('tr', {},
          h('td', {}, h('kbd', {}, 'Alt+' + (i + 1))),
          h('td', {}, code), h('td', {}, name), h('td', {}, color),
          h('td', {}, h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: s.bold, onchange: e => { s.bold = e.target.checked; paintSample(); save(); } }), 'tučně'),
            h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: s.italic, onchange: e => { s.italic = e.target.checked; paintSample(); save(); } }), 'kurzíva')),
          h('td', {}, sample),
          h('td', {},
            h('button', { class: 'btn small icon', title: 'Nahoru', onclick: () => { if (i > 0) { cfg.list.splice(i - 1, 0, cfg.list.splice(i, 1)[0]); save(); paint(); } } }, '↑'),
            h('button', { class: 'btn small icon danger', title: 'Odebrat', onclick: async () => {
              if (!await confirmDlg(`Odebrat „${s.name}“? Řádky s @${s.code} zůstanou bez barvy.`, 'Odebrat', true)) return;
              cfg.list.splice(i, 1); save(); paint();
            } }, '✕'))));
      });
    };
    paint();
    const presets = ['#ffd23f', '#4fc3f7', '#7CFC9A', '#ff7eb6', '#ff9f43', '#b388ff', '#ff5252', '#ffffff'];
    content.append(
      h('h2', {}, 'Zpěváci'),
      h('p', { class: 'help', style: { maxWidth: '800px' } }, 'Každý zpěvák má zkratku (používá se v textu jako ', h('code', {}, '@J'), '), jméno a barvu. Jména si klidně přepiš na skutečná. Pořadí určuje klávesovou zkratku v editoru. Vzhled označení (barva textu, pruh, podbarvení) se nastavuje v šabloně.'),
      h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Zkratka v ed.', 'Kód', 'Jméno', 'Barva', 'Styl', 'Ukázka', ''].map(x => h('th', {}, x)))), tbody),
      h('div', { class: 'row', style: { marginTop: '14px', maxWidth: '900px' } },
        h('button', { class: 'btn primary nogrow', onclick: () => {
          const used = new Set(cfg.list.map(s => s.code));
          let code = 'A'; for (const c of 'ABCDEFGHKLMNOPRSUZ') if (!used.has(c)) { code = c; break; }
          cfg.list.push({ code, name: 'Nový zpěvák', color: presets[cfg.list.length % presets.length], bold: false, italic: false });
          save(); paint();
        } }, '＋ Přidat zpěváka')),
      instrumentsSection());
  },
};

/* Nástroje – stejný princip jako zpěváci, informace jen pro muzikanty */
function instrumentsSection() {
  const cfg = clone(Store.config.get('instruments') || { id: 'instruments', list: DEFAULT_INSTRUMENTS });
  const save = debounce(() => Store.put('config', cfg), 500);
  const tbody = h('tbody');
  const presets = ['#ff9f43', '#b388ff', '#ff7eb6', '#4dd0e1', '#c6ff00', '#ffab91', '#90caf9', '#e0e0e0'];
  const paint = () => {
    tbody.innerHTML = '';
    cfg.list.forEach((s, i) => {
      const code = h('input', { class: 'inp', value: s.code, maxlength: 3, style: { width: '70px', textTransform: 'uppercase', fontWeight: 700 } });
      const name = h('input', { class: 'inp', value: s.name });
      const color = h('input', { type: 'color', value: s.color });
      const sample = h('code', {}, '%' + s.code + ' …');
      code.onchange = async () => {
        const nc = code.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!nc || cfg.list.some((x, j) => j !== i && x.code === nc)) { toast('Zkratka musí být jedinečná (písmena/číslice).', 'err'); code.value = s.code; return; }
        const old = s.code; s.code = nc; save(); sample.textContent = '%' + nc + ' …';
        const n = await renameInstrumentCode(old, nc);
        if (n) toast(`Zkratka změněna i v ${n} písních`, 'ok');
      };
      name.oninput = () => { s.name = name.value; save(); };
      color.oninput = () => { s.color = color.value; save(); };
      tbody.appendChild(h('tr', {},
        h('td', {}, code), h('td', {}, name), h('td', {}, color), h('td', {}, sample),
        h('td', {}, h('button', { class: 'btn small icon danger', title: 'Odebrat', onclick: async () => {
          if (!await confirmDlg(`Odebrat nástroj „${s.name}“? Jeho řádky v písních zůstanou, jen nebudou mít název ani barvu.`, 'Odebrat', true)) return;
          cfg.list.splice(i, 1); save(); paint();
        } }, '✕'))));
    });
  };
  paint();
  return h('div', { style: { marginTop: '28px' } },
    h('h2', {}, 'Nástroje'),
    h('p', { class: 'help', style: { maxWidth: '900px' } }, 'Informace pro muzikanty – ladění, akordy, tabulatury, rytmus. Zapisují se do textu písně řádkem ', h('code', {}, '%G …'), ' nebo blokem ', h('code', {}, '%%G … %%'), '. Ve čtečce se nikdy nezobrazí; v náhledu je ukáže přepínač „Pro muzikanty“ a lze je vytisknout. Akordy ', h('code', {}, '[Am]'), ' jsou samostatná vrstva.'),
    h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Kód', 'Název', 'Barva', 'Zápis v textu', ''].map(x => h('th', {}, x)))), tbody),
    h('div', { class: 'row', style: { marginTop: '14px' } },
      h('button', { class: 'btn primary nogrow', onclick: () => {
        const used = new Set(cfg.list.map(s => s.code));
        let code = 'X'; for (const c of 'SVTHPAELMNOR') if (!used.has(c)) { code = c; break; }
        cfg.list.push({ code, name: 'Nový nástroj', color: presets[cfg.list.length % presets.length] });
        save(); paint();
      } }, '＋ Přidat nástroj')));
}

async function renameInstrumentCode(oldC, newC) {
  const re = new RegExp(`^(\\s*%%?(?:[A-Za-z0-9]+\\+)*)${oldC}(?=[+\\s]|$)`, 'gm');
  let n = 0;
  for (const s of Store.songs.values()) {
    const t = (s.text || '').replace(re, `$1${newC}`);
    if (t !== s.text) { s.text = t; await Store.put('songs', s); n++; }
  }
  return n;
}

async function renameSingerCode(oldC, newC) {
  const re = new RegExp(`([@+{])${oldC}(?=[+\\s:}]|$)`, 'gm');
  let n = 0;
  for (const s of Store.songs.values()) {
    const t = (s.text || '').split('\n').map(l => /^\s*(@|##|.*\{)/.test(l) ? l.replace(re, `$1${newC}`) : l).join('\n');
    if (t !== s.text) { s.text = t; await Store.put('songs', s); n++; }
  }
  return n;
}

/* ===== Nastavení ===== */
const SettingsView = {
  render(main, section) {
    const c = h('div', { class: 'content set-content' });
    const nav = h('div', { class: 'side set-nav' }, h('h2', {}, 'Nastavení'));
    main.appendChild(h('div', { class: 'view set-view' }, nav, c));
    const S = Settings.data;
    const chk = (k, label, help) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!S[k], onchange: e => { Settings.set(k, e.target.checked); } }), label, help ? h('span', { class: 'help' }, ' – ' + help) : null);

    // --- Obrazovky kapely (sdílené profily): rozměr, co se ukáže, písmo
    let edId = (section && section.startsWith('screen-') ? section.slice(7) : '') || (Screens.myId() === 'auto' ? 'main' : Screens.myId());
    const scrTabs = h('div', { class: 'scr-tabs' });
    const scrBox = h('div', { class: 'scr-box' });
    const presets = [[1920, 1080, 'Full HD (většina 24" monitorů)'], [1920, 1200, '24" 16:10'], [1680, 1050, '22" 16:10'], [1600, 900, ''], [1366, 768, 'notebook'], [1280, 1024, 'starší 4:3/5:4'], [2560, 1440, '27" QHD'], [2048, 1536, 'iPad'], [2340, 1080, 'mobil']];
    const paintScreens = () => {
      if (!Screens.list().some(x => x.id === edId)) edId = 'main';
      scrTabs.innerHTML = '';
      for (const sc of Screens.list()) scrTabs.appendChild(h('button', { class: 'chip' + (sc.id === edId ? ' on' : ''), onclick: () => { edId = sc.id; paintScreens(); } },
        sc.name + (sc.id === Screens.myId() ? ' · toto zařízení' : '')));
      scrTabs.appendChild(h('button', { class: 'chip add', onclick: async () => {
        const name = await promptDlg('Název nové obrazovky', 'Tablet – kytara', 'např. Mobil – basa');
        if (!name) return;
        const sc = await Screens.add({ name }); edId = sc.id; paintScreens(); paintDevice();
      } }, '＋ Nová obrazovka'));
      paintScreen(Screens.get(edId));
    };
    const paintScreen = orig => {
      const scr = clone(orig); // úpravy jen v kopii, uloží je Screens.save
      scrBox.innerHTML = '';
      const nameIn = h('input', { class: 'inp', value: scr.name });
      const wIn = h('input', { class: 'inp', type: 'number', value: scr.w, min: 320, max: 7680 });
      const hIn = h('input', { class: 'inp', type: 'number', value: scr.h, min: 240, max: 7680 });
      const diag = h('input', { class: 'inp', type: 'number', value: scr.diag || 24, min: 4, max: 100, step: 0.5 });
      const dist = h('input', { class: 'inp', type: 'number', value: scr.dist || 2.5, min: 0.2, max: 15, step: 0.1 });
      const fontIn = h('input', { class: 'inp', type: 'number', value: scr.fontPct || 100, min: 40, max: 300, step: 5 });
      const rec = h('div', { class: 'help' });
      const presetBox = h('div', { class: 'row', style: { marginTop: '8px' } });
      const orientBtns = {};
      const isPortrait = () => +hIn.value >= +wIn.value;
      const view = Object.assign({ chords: false, inst: [] }, scr.view || {});
      const save = () => {
        Object.assign(scr, { name: nameIn.value.trim() || scr.name, w: Math.max(320, +wIn.value | 0), h: Math.max(240, +hIn.value | 0), diag: +diag.value, dist: +dist.value, fontPct: Math.max(40, +fontIn.value || 100), view });
        Screens.save(scr);
        paintRec();
      };
      const paintRec = () => {
        const { pxPerCm, px } = fontAdvice(scr.w, scr.h, scr.diag, scr.dist);
        rec.innerHTML = `Monitor ${scr.diag}" při ${scr.w}×${scr.h} ≈ ${pxPerCm.toFixed(1)} px/cm. Pro pohodlné čtení ze vzdálenosti ${scr.dist} m doporučuji písmo alespoň <b>${px} px</b> (nastavíš v šabloně).`;
      };
      const applyRes = (w, hh) => { wIn.value = w; hIn.value = hh; save(); paintOrient(); };
      const paintOrient = () => {
        const p = isPortrait();
        orientBtns.p.classList.toggle('primary', p); orientBtns.l.classList.toggle('primary', !p);
        presetBox.innerHTML = '';
        for (const [a, b, label] of presets) {
          const [w, hh] = p ? [b, a] : [a, b];
          presetBox.appendChild(h('button', { class: 'btn small nogrow', title: label, onclick: () => applyRes(w, hh) }, `${w}×${hh}`));
        }
      };
      const setOrient = portrait => { if (portrait !== isPortrait()) applyRes(+hIn.value, +wIn.value); };
      orientBtns.p = h('button', { class: 'btn nogrow', onclick: () => setOrient(true) }, 'Na výšku');
      orientBtns.l = h('button', { class: 'btn nogrow', onclick: () => setOrient(false) }, 'Na šířku');
      [nameIn, wIn, hIn, diag, dist, fontIn].forEach(i => i.addEventListener('change', () => { save(); paintOrient(); if (i === nameIn) paintScreens(); }));
      const chordChk = h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!view.chords, onchange: e => { view.chords = e.target.checked; save(); } }), 'Akordy');
      const instChks = Store.instruments().map(ins => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: view.inst.includes(ins.code), onchange: e => {
        view.inst = e.target.checked ? [...new Set([...view.inst, ins.code])] : view.inst.filter(c => c !== ins.code); save();
      } }), h('span', { class: 'led', style: { background: ins.color } }), 'Poznámky: ' + ins.name));
      scrBox.append(
        h('div', { class: 'row' },
          h('label', { class: 'f', style: { flex: '2 1 220px' } }, h('span', {}, 'Název obrazovky'), nameIn),
          scr.id === 'main' ? h('span', { class: 'help nogrow', style: { alignSelf: 'center' } }, 'Hlavní čtečka kapely – nejde smazat') :
            h('button', { class: 'btn danger nogrow', onclick: async () => {
              if (!await confirmDlg(`Smazat obrazovku „${scr.name}“? Její konce stránek v písních zůstanou, jen se nepoužijí.`, 'Smazat')) return;
              await Screens.remove(scr.id); edId = 'main'; paintScreens(); paintDevice();
            } }, '🗑 Smazat')),
        h('div', { class: 'row', style: { marginTop: '10px' } },
          h('label', { class: 'f' }, h('span', {}, 'Šířka (px)'), wIn), h('label', { class: 'f' }, h('span', {}, 'Výška (px)'), hIn),
          h('label', { class: 'f' }, h('span', {}, 'Úhlopříčka (palce)'), diag), h('label', { class: 'f' }, h('span', {}, 'Vzdálenost čtení (m)'), dist),
          h('button', { class: 'btn nogrow', title: 'Převezme rozlišení obrazovky, na které je aplikace právě otevřená', onclick: () => applyRes(Math.round(screen.width * devicePixelRatio), Math.round(screen.height * devicePixelRatio)) }, '⌖ Z této obrazovky')),
        h('div', { class: 'row', style: { marginTop: '10px', alignItems: 'center' } }, h('span', { class: 'nogrow help' }, 'Orientace:'), orientBtns.p, orientBtns.l),
        presetBox,
        h('h3', {}, 'Co se na této obrazovce ukáže'),
        h('div', { class: 'scr-view' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: true, disabled: true }), 'Text písně'), chordChk, ...instChks),
        h('div', { class: 'row', style: { marginTop: '10px', maxWidth: '360px' } }, h('label', { class: 'f' }, h('span', {}, 'Velikost písma oproti šabloně (%)'), fontIn)),
        h('p', {}, rec));
      paintRec(); paintOrient();
    };

    // --- Toto zařízení: kterou obrazovkou je, co vidím já, moje řádky
    const devBox = h('div', { class: 'set-rows' });
    const paintDevice = () => {
      devBox.innerHTML = '';
      const scrSel = h('select', { class: 'inp set-sel' }, [Screens.auto(), ...Screens.list()].map(sc => h('option', { value: sc.id, selected: sc.id === Screens.myId() }, Screens.label(sc))));
      scrSel.onchange = () => { Settings.set('screenId', scrSel.value); toast('Toto zařízení: ' + Screens.mine().name, 'ok'); paintScreens(); paintDevice(); };
      const my = Settings.get('myView');
      const view = Object.assign({ chords: false, inst: [] }, my || Screens.mine().view || {});
      const custom = h('div', { class: 'scr-view' + (my ? '' : ' hidden') },
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!view.chords, onchange: e => { view.chords = e.target.checked; Settings.set('myView', Object.assign({}, view)); } }), 'Akordy'),
        ...Store.instruments().map(ins => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: view.inst.includes(ins.code), onchange: e => {
          view.inst = e.target.checked ? [...new Set([...view.inst, ins.code])] : view.inst.filter(c => c !== ins.code); Settings.set('myView', Object.assign({}, view));
        } }), h('span', { class: 'led', style: { background: ins.color } }), ins.name)));
      const singerSel = h('select', { class: 'inp set-sel' }, h('option', { value: '' }, '— nikdo / nezvýrazňovat —'),
        Store.singers().map(sg => h('option', { value: sg.code, selected: sg.code === Settings.get('mySinger') }, sg.name)));
      singerSel.onchange = () => { Settings.set('mySinger', singerSel.value); Settings.set('highlightMine', !!singerSel.value); };
      const zoom = h('input', { class: 'inp set-num', type: 'number', min: 50, max: 200, step: 5, value: Math.round((Settings.get('readerZoom') || 1) * 100) });
      zoom.onchange = () => Settings.set('readerZoom', Math.max(0.5, Math.min(2, (+zoom.value || 100) / 100)));
      const rotSel = h('select', { class: 'inp set-sel' }, [[0, 'neotáčet (Windows už obrazovku otáčí)'], [90, 'o 90° doprava'], [270, 'o 90° doleva'], [180, 'o 180°']]
        .map(([v, l]) => h('option', { value: v, selected: (Settings.get('readerRotate') || 0) === v }, l)));
      rotSel.onchange = () => Settings.set('readerRotate', +rotSel.value);
      const row = (t, help, ctl) => h('div', { class: 'set-row' }, h('div', {}, h('b', {}, t), help ? h('span', { class: 'help' }, help) : null), ctl);
      devBox.append(
        row('K čemu zařízení slouží', 'Určuje, co se otevře po zapnutí.', roleSel),
        row('Toto zařízení je obrazovka', 'Na webu a v telefonu se stránka přizpůsobí oknu. Obrazovku kapely zvol jen pro pevně umístěný displej (čtečka, tablet na stojanu).', scrSel),
        row('Co vidím já', my ? 'Vlastní výběr jen pro toto zařízení.' : 'Jako obrazovka „' + Screens.mine().name + '“.',
          segControl([['profile', 'Jako obrazovka'], ['custom', 'Vlastní']], my ? 'custom' : 'profile', v => { Settings.set('myView', v === 'custom' ? Object.assign({}, view) : null); paintDevice(); })),
        h('div', { class: 'set-row sub' + (my ? '' : ' hidden') }, custom),
        row('Zvýraznit moje řádky', 'Řádky ostatních zpěváků budou ztlumené (řádky „všichni“ zůstanou).', singerSel),
        row('Velikost písma (%)', 'Osobní zvětšení k velikosti obrazovky. Ve čtečce i klávesami + / −.', zoom),
        row('Otočit obraz čtečky', 'Když systém monitor neotáčí.', rotSel),
        row('Vzhled aplikace', 'Barvy stránky na čtečce určuje šablona písně.', segControl(THEMES, Settings.get('theme') || 'dark', v => { Settings.set('theme', v); App.applyTheme(); })));
      custom.classList.remove('hidden');
    };

    // --- PIN
    const pinBtn = h('button', { class: 'btn', onclick: async () => {
      const p = await promptDlg(S.pinHash ? 'Nový PIN (prázdné = zrušit PIN)' : 'Zvol PIN pro úpravy (čísla nebo text)');
      if (p === null) return;
      Settings.set('pinHash', p ? sha1Bytes(utf8.enc('prompter:' + p)) : '');
      sessionStorage.setItem('unlocked', '1');
      toast(p ? 'PIN nastaven. Bez něj půjde jen číst ve čtečce.' : 'PIN zrušen', 'ok');
      App.go();
    } }, S.pinHash ? '🔒 Změnit / zrušit PIN' : '🔓 Nastavit PIN');
    const nameIn = h('input', { class: 'inp', value: S.userName, placeholder: S.gh.login || 'např. Petr' });
    nameIn.onchange = () => Settings.set('userName', nameIn.value.trim());

    const roleSel = h('select', { class: 'inp set-sel' }, h('option', { value: '', disabled: true, selected: !S.deviceRole }, '— nevybráno —'),
      DEVICE_ROLES.map(r => h('option', { value: r.id, selected: r.id === S.deviceRole }, r.name)));
    roleSel.onchange = () => { applyDeviceRole(roleSel.value); toast('Uloženo: ' + roleName(roleSel.value), 'ok'); App.go(true); };

    const tplSel = h('select', { class: 'inp' }, [...Store.templates.values()].map(t => h('option', { value: t.id, selected: t.id === S.defaultTemplate }, t.name)));
    tplSel.onchange = () => Settings.set('defaultTemplate', tplSel.value);

    c.append(
      h('div', { class: 'settings-grid' },
      h('fieldset', { id: 'set-device', class: 'span2' }, h('legend', {}, '🖥 Toto zařízení', h('span', { class: 'grow' }), h('button', { class: 'btn small', onclick: () => setupWizard() }, 'Spustit průvodce znovu')),
        h('p', { class: 'help' }, 'Platí jen pro tento počítač, tablet či telefon.'),
        devBox),
      h('fieldset', { id: 'set-screens', class: 'span2' }, h('legend', {}, '🖥 Obrazovky kapely'),
        h('p', { class: 'help' }, 'Každá obrazovka (hlavní prompter, tablet, mobil…) má svůj rozměr, konce stránek a obsah. Nastavení se sdílí s celou kapelou; každé zařízení si pak vybere, kterou obrazovkou je. Píseň se píše jen jednou.'),
        scrTabs, scrBox),
      h('fieldset', { id: 'set-reader' }, h('legend', {}, '▶ Čtečka a ovládání'),
        chk('readerFullscreen', 'Čtečka přes celou obrazovku'),
        chk('startInReader', 'Po spuštění aplikace rovnou otevřít čtečku s posledním playlistem', 'pro PC čtečky'),
        chk('hideCursor', 'Skrývat kurzor myši'),
        chk('swapMouse', 'Prohodit tlačítka myši', 'normálně: pravé = další, levé = zpět'),
        chk('wheelNav', 'Listovat i kolečkem myši'),
        chk('readerSyncOnStart', 'Při otevření čtečky stáhnout změny (když je internet)'),
        window.native ? h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: window.native.getAutoStart(), onchange: e => window.native.setAutoStart(e.target.checked) }), 'Spustit program automaticky po zapnutí počítače') : null,
        h('div', { class: 'row', style: { marginTop: '8px', maxWidth: '520px' } }, h('label', { class: 'f' }, h('span', {}, 'Výchozí šablona'), tplSel)),
        h('p', { class: 'help' }, 'Ovládání: pravé tlačítko / → / PgDn = další stránka · levé / ← / PgUp = zpět · prostřední / L = seznam písní · Shift+→/← = další/předchozí píseň · B = zatemnit · M = zrcadlit · +/− = písmo · F = celá obrazovka · H = nápověda · Esc = zpět.')),
      h('fieldset', { id: 'set-user' }, h('legend', {}, '👤 Uživatel a PIN'),
        h('div', { class: 'row', style: { maxWidth: '640px' } }, h('label', { class: 'f' }, h('span', {}, 'Moje jméno (u změn)'), nameIn), h('div', { class: 'nogrow' }, pinBtn)),
        h('p', { class: 'help' }, 'PIN chrání úpravy na tomto počítači (např. na čtečce, aby nikdo omylem nic nezměnil). Čtečka funguje i bez PINu. Kdo smí vidět a upravovat sdílené písně, určuješ přes GitHub níže.')),
      this.shareBlock('span2'),
      h('fieldset', { id: 'set-backup' }, h('legend', {}, '💾 Záloha a import'),
        h('div', { class: 'row' },
          h('button', { class: 'btn nogrow', onclick: () => exportBackup() }, '⇩ Stáhnout zálohu (vše)'),
          h('button', { class: 'btn nogrow', onclick: () => pickFile('.json').then(f => f && importBackup(f)) }, '⇪ Obnovit ze zálohy'),
          h('button', { class: 'btn nogrow', onclick: () => importTxtFiles() }, '⇪ Import písní z .txt')),
        h('p', { class: 'help' }, 'Záloha je jeden soubor .json se všemi písněmi, playlisty, šablonami a zpěváky. Obnova je slučovací – nic nesmaže, jen doplní/přepíše stejné položky.'),
        window.native ? h('p', { class: 'help' }, 'Data čtečky jsou uložena jako soubory ve složce: ', h('code', {}, window.native.dataDir), ' ', h('button', { class: 'btn small', onclick: () => window.native.openDataDir() }, 'Otevřít složku')) : null),),
      h('p', { class: 'help' }, 'Verze ' + APP_VERSION + (window.native ? ' · program pro Windows' : ' · webová verze')));
    // navigace vlevo: skok na sekci (šipky + OK fungují přes Tab)
    const secs = $$('fieldset[id]', c);
    const items = secs.map(f => h('button', { class: 'item set-item', onclick: () => { f.scrollIntoView({ behavior: 'smooth', block: 'start' }); mark(f.id); } },
      $('legend', f).firstChild.cloneNode(true), ' ', $('legend', f).childNodes[1] ? $('legend', f).childNodes[1].cloneNode(true) : ''));
    const mark = id => items.forEach((b, i) => b.classList.toggle('active', secs[i].id === id));
    nav.append(...items);
    c.addEventListener('scroll', () => {
      const top = c.getBoundingClientRect().top + 40;
      let cur = secs[0];
      for (const f of secs) if (f.getBoundingClientRect().top <= top) cur = f;
      if (cur) mark(cur.id);
    });
    paintScreens(); paintDevice();
    mark('set-device');
    if (section) setTimeout(() => { const f = $('#set-' + section, c); if (f) { f.scrollIntoView({ block: 'start' }); mark(f.id); } }, 0);
  },

  shareBlock(cls) {
    const mode = Sync.mode();
    const names = { github: 'GitHub', mega: 'Mega', folder: 'sdílenou složku' };
    const top = h('div', { style: { marginBottom: '12px' } });
    if (mode !== 'off') {
      const canInvite = (mode === 'github' || mode === 'mega') && !Settings.get('readOnly');
      top.append(
        h('p', {}, '✅ Připojeno ke kapele ', h('b', {}, Settings.get('bandName') || ''), ' přes ', h('b', {}, names[mode]),
          Settings.get('readOnly') ? h('span', { class: 'tag', style: { marginLeft: '6px' } }, 'jen pro čtení') : null,
          Sync.lastError ? h('span', { style: { color: 'var(--err)', marginLeft: '8px' } }, Sync.lastError) : null),
        h('div', { class: 'row' },
          canInvite ? h('button', { class: 'btn primary nogrow', onclick: () => inviteDialog() }, '👥 Pozvat členy (odkaz kapely)') : null,
          h('button', { class: 'btn nogrow', onclick: () => App.syncClick() }, '⟳ Synchronizovat teď'),
          h('button', { class: 'btn danger nogrow', onclick: async () => {
            if (!await confirmDlg('Odpojit tento počítač od kapely? Písně v něm zůstanou, jen se přestanou synchronizovat.', 'Odpojit')) return;
            Settings.set('syncMode', 'none'); Settings.set('readOnly', false); Settings.set('bandLink', ''); Settings.set('rememberBand', true);
            sessionStorage.removeItem('prompter-secret-mega'); sessionStorage.removeItem('prompter-secret-gh');
            // přístupové údaje se z tohoto počítače smažou (důležité na cizím PC)
            Settings.set('mega', Object.assign({}, Settings.get('mega'), { pass: '' }));
            Settings.set('gh', Object.assign({}, Settings.get('gh'), { token: '', login: '', canPush: null }));
            MegaProvider.api().logout();
            if (window.native) window.native.watchFolder('');
            await Sync.resetMeta(); Sync.lastError = ''; Sync.state = 'off'; Sync.refreshState(); App.go(true);
          } }, 'Odpojit')),
        window.native ? null : h('label', { class: 'chk', style: { marginTop: '10px' } },
          h('input', { type: 'checkbox', checked: Settings.data.rememberBand !== false, onchange: e => setRememberBand(e.target.checked) }),
          'Pamatovat si heslo kapely na tomto zařízení',
          h('span', { class: 'help' }, ' – vypni na cizím počítači: heslo kapely pak bude potřeba po každém otevření prohlížeče')));
    } else {
      top.append(
        h('p', {}, 'Písně jsou zatím jen v tomto počítači.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary nogrow', onclick: () => joinBandDialog() }, '🔑 Mám kód kapely'),
          h('span', { class: 'help', style: { alignSelf: 'center' } }, '← člen kapely: stačí vložit kód od správce. Správce: zvol níže, kde budou písně uložené.')));
    }

    const body = h('div');
    const cur = Settings.get('syncMode') || (mode === 'github' ? 'github' : 'none');
    const setMode = async m => {
      if (m === Settings.get('syncMode')) return paint(m);
      if (m === 'none' && Sync.mode() !== 'off') {
        if (!await confirmDlg('Vypnout sdílení na tomto počítači?', 'Vypnout')) { App.go(true); return; }
      }
      Settings.set('syncMode', m);
      await Sync.resetMeta();
      Sync.lastError = ''; Sync.state = 'off';
      if (window.native) window.native.watchFolder(m === 'folder' ? Settings.get('sharedFolder') : '');
      Sync.refreshState();
      paint(m);
    };
    const opt = (m, label, sub, disabled) => h('label', { class: 'chk', style: { alignItems: 'flex-start', opacity: disabled ? 0.5 : 1 } },
      h('input', { type: 'radio', name: 'syncmode', checked: cur === m, disabled, onchange: () => setMode(m) }),
      h('span', {}, h('b', {}, label), h('br'), h('span', { class: 'help' }, sub)));
    const detail = h('div', { style: { marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--line)' } });
    const paint = m => {
      detail.innerHTML = '';
      if (m === 'mega') detail.appendChild(this.megaBlock());
      else if (m === 'folder') detail.appendChild(this.folderBlock());
      else if (m === 'github') detail.appendChild(this.ghBlock());
      else detail.appendChild(h('p', { class: 'help' }, 'Bez sdílení. Přenést písně jde i ručně: Záloha → Stáhnout zálohu → na druhém PC Obnovit ze zálohy.'));
    };
    body.append(
      h('div', { class: 'help', style: { marginBottom: '6px' } }, 'Kde budou písně kapely uložené (nastavuje správce, členové pak jen vloží kód kapely):'),
      opt('none', 'Nesdílet', 'vše jen v tomto počítači'),
      opt('mega', 'Mega – program se připojí sám', 'zdarma 20 GB · stačí jeden společný účet Mega pro kapelu · nic dalšího se neinstaluje'),
      opt('github', 'GitHub – program se připojí sám', 'zdarma · nejspolehlivější při souběžných úpravách · správce potřebuje účet na GitHubu'),
      opt('folder', 'Synchronizovaná složka (pokročilé)', window.native
        ? 'složka, kterou synchronizuje jiná aplikace (MEGA Desktop, OneDrive, Dropbox, síťový disk…)'
        : 'jen v programu Prompter.exe', !window.native),
      detail);
    paint(cur);
    return h('fieldset', { class: cls, id: 'set-share' }, h('legend', {}, '☁ Sdílení s kapelou'), top, body,
      h('label', { class: 'chk', style: { marginTop: '10px' } }, h('input', { type: 'checkbox', checked: Settings.get('autoSync'), onchange: e => Settings.set('autoSync', e.target.checked) }), 'Synchronizovat automaticky'));
  },

  megaBlock() {
    const m = Settings.get('mega') || {};
    const email = h('input', { class: 'inp', type: 'email', value: m.email || '', placeholder: 'kapela@email.cz' });
    const pass = h('input', { class: 'inp', type: 'password', value: m.pass ? Secret.unprotect(m.pass) : '', placeholder: 'heslo k účtu Mega' });
    const folder = h('input', { class: 'inp', value: m.folder || 'Prompter kapela' });
    const status = h('div', { class: 'help', style: { marginTop: '8px' } });
    const connect = async () => {
      const cfg = { email: email.value.trim(), password: pass.value, folder: folder.value.trim() || 'Prompter kapela' };
      if (!cfg.email || !cfg.password) return toast('Vyplň e-mail a heslo.', 'warn');
      status.textContent = 'Přihlašuji k Mega…';
      try {
        const r = await MegaProvider.api().test(cfg);
        Settings.set('mega', { email: cfg.email, pass: Secret.protect(cfg.password), folder: cfg.folder });
        Settings.set('syncMode', 'mega'); Settings.set('readOnly', false);
        await Sync.resetMeta(); Sync.lastError = '';
        const free = r.space ? ` · volné místo ${((r.space.total - r.space.used) / 1e9).toFixed(1)} GB` : '';
        status.textContent = `Přihlášeno (${r.email})${free}. Synchronizuji…`;
        const res = await Sync.run();
        toast(`Mega připojena · staženo ${res.downloaded}, nahráno ${res.pushed}`, 'ok', 5000);
        App.go(true);
        setTimeout(() => inviteDialog(), 300);
      } catch (e) { status.innerHTML = `<span style="color:var(--err)">${esc(ipcError(e))}</span>`; }
    };
    return h('div', {},
      h('ol', { class: 'help', style: { lineHeight: 1.7, marginTop: 0 } },
        h('li', {}, 'Na ', h('a', { href: 'https://mega.io/register', target: '_blank' }, 'mega.io/register'), ' založ ', h('b', {}, 'nový společný účet pro kapelu'), ' (ne svůj osobní – heslo budou znát všichni členové přes kód kapely). Dvoufázové ověření u něj nezapínej.'),
        h('li', {}, 'Vyplň e-mail a heslo tohoto účtu a klikni na Připojit. Program si v Mega sám vytvoří složku a nahraje do ní písně.'),
        h('li', {}, 'Pak ti ukáže ', h('b', {}, 'kód kapely'), ' – ten pošli členům. Oni nic nezakládají ani neinstalují.')),
      h('div', { class: 'grid3' },
        h('label', { class: 'f' }, h('span', {}, 'E-mail účtu Mega'), email),
        h('label', { class: 'f' }, h('span', {}, 'Heslo'), pass),
        h('label', { class: 'f' }, h('span', {}, 'Složka v Mega'), folder)),
      h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn primary nogrow', onclick: connect }, '🔗 Připojit k Mega')),
      status,
      h('p', { class: 'help' }, window.native
        ? 'Heslo je v tomto počítači uložené šifrovaně (chrání ho Windows). '
        : 'V prohlížeči je heslo uložené jen v tomto prohlížeči (nešifrovaně) – na cizím počítači se po práci odpoj (Nastavení → Odpojit). ',
        'Připojení k Mega používá neoficiální knihovnu – kdyby Mega něco změnila a přestalo to fungovat, přepni na GitHub; písně v aplikaci zůstanou.'));
  },

  folderBlock() {
    const status = h('div', { class: 'help', style: { marginTop: '8px' } });
    const paintStatus = () => {
      const d = Settings.get('sharedFolder');
      status.innerHTML = d
        ? `Sdílená složka: <b>${esc(d)}</b>` + (Sync.lastSync ? ` · poslední synchronizace ${Sync.lastSync.toLocaleTimeString('cs-CZ')}` : '') + (Sync.lastError ? ` · <span style="color:var(--err)">${esc(Sync.lastError)}</span>` : '')
        : 'Složka zatím není vybraná.';
    };
    paintStatus();
    const inp = h('input', { class: 'inp', value: Settings.get('sharedFolder') || '', placeholder: 'např. C:\\Users\\Petr\\MEGA\\Kapela-pisne', readonly: true });
    const choose = async dir => {
      if (!dir) return;
      Settings.set('sharedFolder', dir);
      inp.value = dir;
      await Sync.resetMeta();
      window.native.watchFolder(dir);
      try {
        const r = await Sync.run();
        toast(`Složka připojena · načteno ${r.downloaded}, zapsáno ${r.pushed}${r.conflicts ? ', konflikty ' + r.conflicts : ''}`, 'ok', 5000);
      } catch (e) { toast(e.message, 'err', 7000); }
      paintStatus();
    };
    const sugg = window.native.suggestFolders();
    return h('div', {},
      h('div', { class: 'row' }, inp,
        h('button', { class: 'btn primary nogrow', onclick: async () => choose(await window.native.pickFolder()) }, '📁 Vybrat složku…'),
        h('button', { class: 'btn nogrow', onclick: () => Sync.run().then(r => toast(`Načteno ${r.downloaded || 0}, zapsáno ${r.pushed || 0}`, 'ok')).catch(e => toast(e.message, 'err')).finally(paintStatus) }, '⟳ Synchronizovat teď')),
      sugg.length ? h('p', { class: 'help' }, 'Nalezené cloudové složky v tomto PC: ', sugg.map(p => h('code', { style: { marginRight: '6px' } }, p))) : null,
      status,
      h('details', { style: { marginTop: '10px' } }, h('summary', { style: { cursor: 'pointer' } }, h('b', {}, 'Návod – Mega (zdarma)')),
        h('ol', { class: 'help', style: { lineHeight: 1.7 }, html: `
          <li><b>Ty (jednou):</b> nainstaluj <b>MEGA Desktop App</b> (mega.io/desktop) a přihlas se. Ve složce MEGA na disku vytvoř složku např. <code>Kapela-pisne</code>.</li>
          <li>Na webu mega.io klikni na tu složku pravým tlačítkem → <b>Sdílet</b> → zadej e-maily členů a dej jim právo <b>Číst a zapisovat</b> (Read and write).
            <i>Pozor: nepoužívej „Sdílet odkaz“ – ten je jen pro čtení a může ho otevřít kdokoli.</i></li>
          <li><b>Každý člen:</b> založí si účet Mega (zdarma), přijme pozvánku a v MEGA Desktop App si nastaví <b>synchronizaci</b> sdílené složky (Incoming shares) do svého PC.</li>
          <li>V Prompteru: <b>Vybrat složku…</b> → zvol tu synchronizovanou složku. Hotovo.</li>
          <li><b>Čtečka:</b> stejně tak – MEGA Desktop App + synchronizace složky. Když není internet, čtečka jede z vlastních dat a změny dožene, až se připojí.</li>` })),
      h('details', { style: { marginTop: '6px' } }, h('summary', { style: { cursor: 'pointer' } }, h('b', {}, 'Návod – Proton Drive')),
        h('ol', { class: 'help', style: { lineHeight: 1.7 }, html: `
          <li>Nainstaluj <b>Proton Drive pro Windows</b>, ve složce Proton Drive vytvoř složku <code>Kapela-pisne</code> a vyber ji tady v Prompteru.</li>
          <li>Na webu drive.proton.me složku sdílej členům (pozvánka e-mailem, oprávnění <b>Editor</b>). Členové potřebují účet Proton (stačí zdarma).</li>
          <li>Každý člen musí mít sdílenou složku <b>synchronizovanou na disk</b> v aplikaci Proton Drive. Ověř si, že to jeho verze aplikace umí – pokud sdílené složky v jeho Windows aplikaci nevidí, použijte Mega nebo GitHub.</li>` })),
      h('p', { class: 'help' }, 'Bezpečnost: písně uvidí jen ti, se kterými složku nasdílíš. Data ve čtečce zůstávají i v její vlastní složce „data“ – když cloud vypadne, čtečka hraje dál.'));
  },

  ghBlock() {
    const g = clone(Settings.get('gh'));
    const repoIn = h('input', { class: 'inp', value: g.owner && g.repo ? `${g.owner}/${g.repo}` : '', placeholder: 'uživatel/kapela-pisne nebo odkaz na repozitář' });
    const tokenIn = h('input', { class: 'inp', type: 'password', value: g.token || '', placeholder: 'github_pat_…' });
    const status = h('div', { class: 'help', style: { marginTop: '8px' } });
    const c0 = Settings.get('gh');
    if (GH.configured() && Sync.mode() === 'github') status.innerHTML = `Připojeno jako <b>${esc(c0.login || '?')}</b> k <b>${esc(c0.owner)}/${esc(c0.repo)}</b> · ${c0.canPush && !Settings.get('readOnly') ? 'čtení i zápis' : '<b>jen čtení</b>'}`;
    const connect = async () => {
      const m = /(?:github\.com[/:])?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(repoIn.value.trim());
      if (!m || !tokenIn.value.trim()) return toast('Vyplň repozitář (uživatel/název) i token.', 'warn');
      const prev = clone(Settings.get('gh')), prevMode = Settings.get('syncMode');
      Settings.set('gh', Object.assign({}, prev, { owner: m[1], repo: m[2], token: tokenIn.value.trim(), branch: prev.branch || 'main' }));
      Settings.set('syncMode', 'github');
      status.textContent = 'Ověřuji přístup…';
      try {
        const r = await GH.test();
        Settings.set('gh', Object.assign({}, Settings.get('gh'), { login: r.login, canPush: r.canPush, branch: r.defaultBranch || 'main' }));
        Settings.set('readOnly', false);
        if (!r.private) toast('Pozor: repozitář je VEŘEJNÝ – texty uvidí kdokoli. Přepni ho na Private (Settings → General → Danger Zone).', 'warn', 9000);
        await Sync.resetMeta(); Sync.lastError = '';
        const res = await Sync.run();
        toast(`GitHub připojen · staženo ${res.downloaded}, odesláno ${res.pushed}`, 'ok', 5000);
        App.go(true);
        if (r.canPush) setTimeout(() => inviteDialog(), 300);
      } catch (e) {
        Settings.set('gh', prev); Settings.set('syncMode', prevMode);
        status.innerHTML = `<span style="color:var(--err)">Nepodařilo se připojit: ${esc(e.message)}</span>`;
      }
    };
    const tokenUrl = 'https://github.com/settings/personal-access-tokens/new?name=Prompter%20kapela&description=Synchronizace%20pisni&expires_in=none&contents=write';
    return h('div', {},
      h('ol', { class: 'help', style: { lineHeight: 1.75, marginTop: 0 } },
        h('li', { html: 'Přihlas se na GitHub (nebo si <a href="https://github.com/signup" target="_blank">zdarma založ účet</a>).' }),
        h('li', { html: '<a href="https://github.com/new?name=kapela-pisne&visibility=private" target="_blank">Vytvoř soukromý repozitář</a> – název nech „kapela-pisne“, musí být <b>Private</b>, klikni <b>Create repository</b>.' }),
        h('li', { html: `<a href="${tokenUrl}" target="_blank">Vytvoř přístupový token</a> – u <b>Repository access</b> zvol <b>Only select repositories</b> → kapela-pisne. U <b>Permissions → Contents</b> musí být <b>Read and write</b>. Dole klikni <b>Generate token</b> a token zkopíruj.` }),
        h('li', {}, 'Vlož sem repozitář a token a klikni Připojit. Program pak ukáže kód kapely pro ostatní členy.')),
      h('div', { class: 'grid2' },
        h('label', { class: 'f' }, h('span', {}, 'Repozitář'), repoIn),
        h('label', { class: 'f' }, h('span', {}, 'Token'), tokenIn)),
      h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn primary nogrow', onclick: connect }, '🔗 Připojit ke GitHubu')),
      status);
  },
};

function pickFile(accept) {
  return new Promise(res => { const i = h('input', { type: 'file', accept }); i.onchange = () => res(i.files[0]); i.click(); });
}

/* Pamatovat / nepamatovat přístup ke kapele v tomto prohlížeči */
function setRememberBand(on) {
  const mode = Sync.mode();
  if (!on && !Settings.get('bandLink')) { toast('Nejdřív se připoj odkazem kapely – jinak by nebylo čím heslo znovu zadat.', 'warn', 6000); App.go(true); return; }
  if (on) {
    const m = Settings.get('mega'), g = Settings.get('gh');
    Settings.set('rememberBand', true);
    if (mode === 'mega' && m && m.pass) Settings.set('mega', m);
    if (mode === 'github' && g && g.token) Settings.set('gh', g);
  } else {
    if (mode === 'mega') { sessionStorage.setItem('prompter-secret-mega', JSON.stringify({ pass: Settings.data.mega.pass })); Settings.set('mega', Object.assign({}, Settings.data.mega, { pass: '' })); }
    if (mode === 'github') { sessionStorage.setItem('prompter-secret-gh', JSON.stringify({ token: Settings.data.gh.token })); Settings.set('gh', Object.assign({}, Settings.data.gh, { token: '' })); }
    Settings.set('rememberBand', false);
  }
  toast(on ? 'Heslo kapely si toto zařízení zapamatuje.' : 'Heslo kapely se po zavření prohlížeče zapomene.', 'ok');
}

function exportBackup() {
  const data = {
    app: 'prompter', version: 1, exportedAt: new Date().toISOString(),
    ...Object.fromEntries(Object.keys(TYPES).map(t => [t, [...Store[t].values()]])),
  };
  downloadFile(`zaloha-pisne-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 1));
}

async function importBackup(file) {
  let data;
  try { data = JSON.parse(await readFileText(file)); } catch (e) { return toast('Soubor není platná záloha.', 'err'); }
  if (!data || data.app !== 'prompter') return toast('Soubor není záloha této aplikace.', 'err');
  let n = 0;
  for (const type of Object.keys(TYPES)) {
    for (const o of data[type] || []) { if (o && o.id) { await Store.put(type, o, { silent: true, noStamp: true }); n++; } }
  }
  Store.emit('sync', null);
  toast(`Obnoveno ${n} položek`, 'ok');
}
