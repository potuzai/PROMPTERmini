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
  { k: 'instrColor', l: 'Předehra, mezihra, sólo a počet opakování', t: 'color' },
  { g: 'Označení zpěváků', help: 'Jak se který zpěvák na stránce označí – jde kombinovat. Platí pro všechny písně s touto šablonou; v editoru písně (Zobrazení ▾) jde nastavit jinak jen pro jednu píseň.' },
  { k: 'singerShow', t: 'singers' },
  { k: 'barWidth', l: 'Šířka proužku (px)', t: 'range', min: 4, max: 40, step: 1 },
  { g: 'Rozvržení stránky' },
  { k: 'padX', l: 'Okraj vlevo/vpravo (px)', t: 'range', min: 0, max: 400, step: 2 },
  { k: 'padY', l: 'Okraj nahoře/dole (px)', t: 'range', min: 0, max: 300, step: 2 },
  { k: 'columns', l: 'Počet sloupců', t: 'select', o: [[1, '1'], [2, '2'], [3, '3']] },
  { k: 'colGap', l: 'Mezera mezi sloupci (px)', t: 'range', min: 10, max: 200, step: 2 },
  { k: 'stanzaGap', l: 'Mezera mezi slokami (× výška písma)', t: 'range', min: 0, max: 2, step: 0.05 },
  { k: 'fit', l: 'Dlouhá píseň', t: 'select', o: [['shrink', 'zmenšit písmo, aby se vešla na 1 stránku'], ['paginate', 'rozdělit na více stránek']] },
  { k: 'minScale', l: 'Nejmenší zmenšení písma', t: 'range', min: 0.4, max: 1, step: 0.05, pct: true },
  { g: 'Zobrazení' },
  { k: 'showHeader', l: 'Záhlaví (název, ladění, pořadí)', t: 'check' },
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

  /* Úprava šablony: na kopii, uloží se tlačítkem Uložit (Ctrl+S); při odchodu se App zeptá */
  editor(root, tpl) {
    const t = Object.assign(clone(DEFAULT_TEMPLATE), tpl);
    let dirty = false;
    const savedInd = h('span', { class: 'saved-ind' });
    const saveBtn = h('button', { class: 'btn nogrow', title: 'Uložit změny (Ctrl+S)', onclick: () => save(true) }, '💾 Uložit');
    const paintSaved = () => { savedInd.textContent = dirty ? 'Neuloženo' : ''; savedInd.classList.toggle('dirty', dirty); saveBtn.classList.toggle('primary', dirty); };
    // „neuloženo“ = jiný stav než při posledním uložení (změna tam a zpět nic nemění)
    let base = JSON.stringify(t);
    const markDirty = () => { dirty = JSON.stringify(t) !== base; paintSaved(); };
    const save = async manual => {
      if (!dirty && !manual) return;
      dirty = false; base = JSON.stringify(t);
      await Store.put('templates', clone(t));
      paintSaved();
      if (manual) toast('Uloženo', 'ok', 1500);
    };
    const saveAs = async stay => {   // nová šablona ze současného nastavení; původní zůstane, jak byla uložená
      const name = await promptDlg('Uložit jako novou šablonu – název', t.name + ' (2)');
      if (!name) return false;
      const c = Object.assign(clone(t), { id: uid(), name });
      await Store.put('templates', c);
      dirty = false;
      toast('Uloženo jako „' + name + '“', 'ok');
      if (!stay) location.hash = '#/templates/' + c.id;
      return true;
    };
    App.edit = { get what() { return `Šablona „${t.name || 'bez názvu'}“`; }, dirty: () => dirty, save, saveAs };
    const form = h('div', { class: 'tpl-form' });
    const nameInp = h('input', { class: 'inp', value: t.name });
    nameInp.oninput = () => { t.name = nameInp.value; markDirty(); };
    form.append(h('label', { class: 'f', style: { marginBottom: '10px' } }, h('span', {}, 'Název šablony'), nameInp),
      h('div', { class: 'row', style: { marginBottom: '12px', alignItems: 'center' } }, saveBtn,
        h('button', { class: 'btn nogrow', title: 'Uložit jako novou šablonu (původní zůstane beze změny)', onclick: () => saveAs() }, 'Uložit jako…'), savedInd),
      h('div', { class: 'row', style: { marginBottom: '12px' } },
        h('button', { class: 'btn', onclick: async () => { Settings.set('defaultTemplate', t.id); this.paintSide(); toast('Nastaveno jako výchozí šablona', 'ok'); } }, '★ Nastavit jako výchozí'),
        t.id !== 'default' ? h('button', { class: 'btn danger nogrow', onclick: () => this.del(t) }, '🗑') : null));
    let fs = null;
    for (const f of TPL_FIELDS) {
      if (f.g) { fs = h('fieldset', {}, h('legend', {}, f.g), f.help ? h('p', { class: 'help' }, f.help) : null); form.appendChild(fs); continue; }
      let ctl;
      const v = t[f.k];
      if (f.t === 'singers') {
        ctl = singerShowTable((code, k) => singerShowOf(t, code)[k], (code, k, val) => {
          t.singerShow = Object.assign({}, t.singerShow);
          t.singerShow[code] = Object.assign(singerShowOf(t, code), { [k]: val });
          upd();
        });
      } else if (f.t === 'check') {
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
    const upd = () => { markDirty(); clearTimeout(this._pt); this._pt = setTimeout(paint, 60); };
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
    App.edit = null;   // smazanou šablonu už není co ukládat
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

/* ===== Nastavení: vlevo kategorie, vpravo vždy jen jedna (v telefonu nejdřív seznam) ===== */
const SET_SECTIONS = [
  ['band', '☁ Kapela a synchronizace'],
  ['device', '📱 Toto zařízení'],
  ['screens', '🖥 Obrazovky kapely'],
  ['reader', '▶ Čtečka a ovládání'],
  ['backup', '💾 Záloha a import'],
  ['about', 'ⓘ O aplikaci'],
];
const SET_ALIASES = { share: 'band', user: 'device' };

/* řádek nastavení: vlevo název a vysvětlení, vpravo ovládací prvek */
const setRow = (title, help, ctl, cls = '') => h('div', { class: 'set-row ' + cls }, h('div', {}, h('b', {}, title), help ? h('span', { class: 'help' }, help) : null), ctl);
const setSwitch = (checked, onchange) => h('input', { type: 'checkbox', class: 'switch', checked: !!checked, onchange: e => onchange(e.target.checked) });
const setFlag = (k, title, help) => setRow(title, help, setSwitch(Settings.data[k], v => Settings.set(k, v)));

const SettingsView = {
  onSync: null,

  render(main, section) {
    section = SET_ALIASES[section] || section || '';
    const sub = section.startsWith('screen-') ? section.slice(7) : '';
    if (sub) section = 'screens';
    const known = SET_SECTIONS.some(([id]) => id === section);
    const cur = known ? section : 'band';
    const nav = h('div', { class: 'side set-nav' }, h('h2', {}, 'Nastavení'),
      SET_SECTIONS.map(([id, label]) => h('button', { class: 'item set-item' + (known && id === cur ? ' active' : ''), onclick: () => { location.hash = '#/settings/' + id; } }, label)),
      h('div', { class: 'set-ver help' }, 'PROMPTER mini ' + APP_VERSION));
    const title = SET_SECTIONS.find(([id]) => id === cur)[1];
    const body = this[cur](sub);
    const c = h('div', { class: 'content set-content' },
      h('div', { class: 'set-head' },
        h('button', { class: 'btn nogrow set-back', onclick: () => { location.hash = '#/settings'; } }, '◀ Nastavení'),
        h('h1', {}, title)),
      body);
    // v úzkém okně bez zvolené kategorie se ukáže jen seznam kategorií
    main.appendChild(h('div', { class: 'view set-view' + (known ? ' has-sec' : '') }, nav, c));
  },

  /* ---------- Kapela a synchronizace ---------- */
  band() {
    const box = h('div', { class: 'set-sec' });
    const paint = () => { box.innerHTML = ''; box.append(...this.bandBody()); };
    paint();
    // stav se překresluje sám (synchronizace běží na pozadí)
    this.onSync = () => { if (box.isConnected) { const st = $('.set-status', box); if (st) st.replaceWith(this.bandStatus()); } };
    return box;
  },

  bandStatus() {
    const mode = Sync.mode(), st = Sync.state, mg = mode === 'mega' ? (Settings.data.mega || {}) : null;
    const g = Settings.get('gh') || {};
    let tone = 'ok', head, who = '', line;
    if (mode === 'off') { tone = ''; head = 'Nepřihlášeno'; line = 'Písně a playlisty jsou zatím jen v tomto zařízení.'; }
    else {
      head = Sync.locked() ? 'Odhlášeno – přihlas se znovu' : mg ? 'Přihlášeno ke kapele' : 'Sdílení zapnuté';
      who = mg ? `${mg.email} · složka v Mega „${mg.folder || 'PROMPTERmini'}“`
        : mode === 'github' ? `GitHub · ${g.owner}/${g.repo}${g.login ? ' · ' + g.login : ''}` : `Složka · ${Settings.get('sharedFolder')}`;
      const ls = Sync.lastSync, when = !ls ? '' : (ls.toDateString() === new Date().toDateString() ? ' v ' : ' ' + ls.toLocaleDateString('cs-CZ') + ' v ') + ls.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
      line = { idle: 'Synchronizováno' + when, syncing: 'Synchronizuji…', pending: `Neodeslané změny: ${Store.pendingCount()}`, offline: 'Offline – změny se odešlou po připojení',
        locked: 'Synchronizace čeká na přihlášení', error: Sync.lastError || 'Chyba synchronizace', off: 'Zatím nesynchronizováno' }[st] || st;
      if (st === 'error' || Sync.locked()) tone = 'err'; else if (st === 'pending' || st === 'offline') tone = 'warn';
    }
    return h('div', { class: 'set-status ' + tone }, h('span', { class: 'dot' }),
      h('div', {}, h('b', {}, head), who ? h('span', {}, who) : null, h('span', { class: 'st' }, line),
        mg && st === 'error' ? h('button', { class: 'btn small', style: { alignSelf: 'flex-start', marginTop: '6px' }, onclick: () => megaDiagDialog() }, 'Diagnostika Mega') : null,
        Settings.get('readOnly') && mode !== 'off' ? h('span', { class: 'tag' }, 'jen pro čtení – nic se neodesílá') : null));
  },

  bandBody() {
    const mode = Sync.mode(), mega = mode === 'mega';
    const out = [this.bandStatus()];
    if (mode === 'off') {
      out.push(
        h('div', { class: 'set-actions' }, h('button', { class: 'btn primary', onclick: () => loginDialog() }, '🔑 Přihlásit ke kapele')),
        h('p', { class: 'help' }, 'Přihlášení e-mailem a heslem kapely (společný účet Mega). Písně a playlisty se pak samy stáhnou a synchronizují mezi všemi zařízeními.'),
        h('h3', {}, 'Zakládáš kapelu?'),
        h('ol', { class: 'help set-steps' },
          h('li', {}, 'Na ', h('a', { href: 'https://mega.io/register', target: '_blank' }, 'mega.io/register'), ' založ nový účet jen pro kapelu – ne svůj osobní, heslo budou znát všichni členové. Dvoufázové ověření nezapínej.'),
          h('li', {}, 'Přihlas se jím tady. Aplikace si v Mega sama vytvoří složku a nahraje do ní písně.'),
          h('li', {}, 'Pak tu klikni na Pozvat členy a pošli jim zprávu s adresou aplikace. Heslo jim řekni zvlášť.')),
        this.otherStorage());
      return out;
    }
    out.push(h('div', { class: 'set-actions' },
      Sync.locked() ? h('button', { class: 'btn primary', onclick: () => loginDialog({ expired: true }) }, '🔑 Přihlásit')
        : h('button', { class: 'btn primary', onclick: () => App.syncClick() }, '⟳ Synchronizovat teď'),
      mega && !Settings.get('readOnly') ? h('button', { class: 'btn', onclick: () => inviteDialog() }, '👥 Pozvat členy') : null,
      h('button', { class: 'btn danger', onclick: () => bandLogout() }, mega ? 'Odhlásit' : 'Odpojit')));
    out.push(h('div', { class: 'set-rows' },
      mega && !window.native ? setRow('Zůstat přihlášen', 'Vypni na cizím nebo sdíleném počítači – po zavření prohlížeče bude potřeba přihlásit se znovu.',
        setSwitch(Settings.data.rememberBand !== false, setRememberBand)) : null,
      setFlag('autoSync', 'Synchronizovat automaticky', 'Změny se odešlou samy a změny ostatních se stahují pravidelně.'),
      setRow('Jen pro čtení', 'Pro čtečky: písně se jen stahují, z tohoto zařízení se nic neodešle.',
        setSwitch(Settings.get('readOnly'), v => { Settings.set('readOnly', v); Sync.refreshState(); App.paintSync(); }))));
    const adv = h('details', { class: 'set-adv' }, h('summary', {}, 'Pokročilé'),
      h('div', { class: 'set-rows' },
        mega ? setRow('Složka kapely v Mega', `„${(Settings.data.mega || {}).folder || 'PROMPTERmini'}“ – měň jen tehdy, když má kapela písně v jinak pojmenované složce.`,
          h('button', { class: 'btn nogrow', onclick: () => changeBandFolder() }, 'Změnit…')) : null,
        mega ? setRow('Diagnostika Mega', 'Co aplikace v účtu Mega vidí. Při potížích se synchronizací pošli výpis.', h('button', { class: 'btn nogrow', onclick: () => megaDiagDialog() }, 'Zobrazit')) : null,
        mega ? setRow('Neoficiální knihovna', 'Připojení k Mega používá neoficiální knihovnu. Kdyby ho Mega rozbila, přepni na GitHub – písně v aplikaci zůstanou.', null) : null),
      mode === 'github' ? this.ghBlock() : mode === 'folder' ? this.folderBlock() : null);
    out.push(adv);
    return out;
  },

  /* jiné úložiště než Mega – jen když zatím není nic připojené */
  otherStorage() {
    const m = Settings.data.mega || {};
    const folderIn = h('input', { class: 'inp set-sel', id: 'band-folder', value: m.folder || 'PROMPTERmini', autocomplete: 'off', 'data-protonpass-ignore': 'true', 'data-1p-ignore': 'true', 'data-lpignore': 'true', 'data-bwignore': 'true' });
    folderIn.onchange = () => Settings.set('mega', Object.assign({}, Settings.data.mega, { folder: folderIn.value.trim() || 'PROMPTERmini', folderId: '' }));
    return h('details', { class: 'set-adv' }, h('summary', {}, 'Pokročilé'),
      h('div', { class: 'set-rows' },
        setRow('Složka kapely v Mega', 'Měň jen tehdy, když má kapela písně v jinak pojmenované složce (správce ti řekne).', folderIn)),
      h('h3', {}, 'Jiné úložiště místo Mega: GitHub'), h('p', { class: 'help' }, 'Zdarma, nejspolehlivější při souběžných úpravách. Každý člen potřebuje přístupový token.'), this.ghBlock(),
      h('h3', {}, 'Jiné úložiště místo Mega: synchronizovaná složka'),
      window.native ? this.folderBlock() : h('p', { class: 'help' }, 'Jen v programu PROMPTER mini.exe – složka, kterou synchronizuje jiná aplikace (MEGA Desktop, OneDrive, Dropbox, síťový disk).'));
  },

  folderBlock() {
    const inp = h('input', { class: 'inp', value: Settings.get('sharedFolder') || '', placeholder: 'např. C:\\Users\\Petr\\MEGA\\Kapela-pisne', readonly: true });
    const choose = async dir => {
      if (!dir) return;
      Settings.set('sharedFolder', dir); Settings.set('syncMode', 'folder');
      inp.value = dir;
      await freshSync();
      window.native.watchFolder(dir);
      try {
        const r = await Sync.run();
        toast(`Složka připojena · načteno ${r.downloaded}, zapsáno ${r.pushed}${r.conflicts ? ', konflikty ' + r.conflicts : ''}`, 'ok', 5000);
      } catch (e) { toast(e.message, 'err', 7000); }
      App.go(true);
    };
    const sugg = window.native.suggestFolders();
    return h('div', {},
      h('div', { class: 'row' }, inp, h('button', { class: 'btn primary nogrow', onclick: async () => choose(await window.native.pickFolder()) }, '📁 Vybrat složku…')),
      sugg.length ? h('p', { class: 'help' }, 'Nalezené cloudové složky v tomto PC: ', sugg.map(p => h('code', { style: { marginRight: '6px' } }, p))) : null,
      h('details', {}, h('summary', {}, 'Návod – MEGA Desktop'),
        h('ol', { class: 'help set-steps', html: `
          <li>Nainstaluj <b>MEGA Desktop App</b> a ve složce MEGA na disku vytvoř složku např. <code>Kapela-pisne</code>.</li>
          <li>Na mega.io ji sdílej členům (pravé tlačítko → <b>Sdílet</b>, právo <b>Číst a zapisovat</b>). Nepoužívej „Sdílet odkaz“ – ten může otevřít kdokoli.</li>
          <li>Každý člen přijme pozvánku a v MEGA Desktop App si sdílenou složku synchronizuje do svého PC.</li>
          <li>Tady klikni na <b>Vybrat složku…</b> a zvol ji.</li>` })),
      h('p', { class: 'help' }, 'Data čtečky zůstávají i v její vlastní složce „data“ – když cloud vypadne, čtečka hraje dál.'));
  },

  ghBlock() {
    const g = clone(Settings.get('gh'));
    const repoIn = h('input', { class: 'inp', value: g.owner && g.repo ? `${g.owner}/${g.repo}` : '', placeholder: 'uživatel/kapela-pisne nebo odkaz na repozitář' });
    const tokenIn = h('input', { class: 'inp', type: 'password', value: g.token || '', placeholder: 'github_pat_…' });
    const status = h('div', { class: 'help', style: { marginTop: '8px' } });
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
        await freshSync();
        const res = await Sync.run();
        toast(`GitHub připojen · staženo ${res.downloaded}, odesláno ${res.pushed}`, 'ok', 5000);
        App.go(true);
      } catch (e) {
        Settings.set('gh', prev); Settings.set('syncMode', prevMode);
        status.innerHTML = `<span style="color:var(--err)">Nepodařilo se připojit: ${esc(e.message)}</span>`;
      }
    };
    const tokenUrl = 'https://github.com/settings/personal-access-tokens/new?name=PROMPTER%20mini&description=Synchronizace%20pisni&expires_in=none&contents=write';
    return h('div', {},
      h('ol', { class: 'help set-steps' },
        h('li', { html: 'Přihlas se na GitHub (nebo si <a href="https://github.com/signup" target="_blank">zdarma založ účet</a>).' }),
        h('li', { html: '<a href="https://github.com/new?name=kapela-pisne&visibility=private" target="_blank">Vytvoř soukromý repozitář</a> – musí být <b>Private</b>.' }),
        h('li', { html: `<a href="${tokenUrl}" target="_blank">Vytvoř přístupový token</a> – <b>Only select repositories</b> → kapela-pisne, <b>Contents: Read and write</b>.` }),
        h('li', {}, 'Vlož sem repozitář a token a klikni Připojit. Ostatní členové zadají stejný repozitář a token.')),
      h('div', { class: 'grid2' }, h('label', { class: 'f' }, h('span', {}, 'Repozitář'), repoIn), h('label', { class: 'f' }, h('span', {}, 'Token'), tokenIn)),
      h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn primary nogrow', onclick: connect }, '🔗 Připojit ke GitHubu')),
      status);
  },

  /* ---------- Toto zařízení ---------- */
  device() {
    const box = h('div', { class: 'set-sec' });
    const paint = () => {
      const S = Settings.data;
      box.innerHTML = '';
      const roleSel = h('select', { class: 'inp set-sel' }, h('option', { value: '', disabled: true, selected: !S.deviceRole }, '— nevybráno —'),
        DEVICE_ROLES.map(r => h('option', { value: r.id, selected: r.id === S.deviceRole }, r.name)));
      roleSel.onchange = () => { applyDeviceRole(roleSel.value); toast('Uloženo: ' + roleName(roleSel.value), 'ok'); };
      const scrSel = h('select', { class: 'inp set-sel' }, [Screens.auto(), ...Screens.list()].map(sc => h('option', { value: sc.id, selected: sc.id === Screens.myId() }, Screens.label(sc))));
      scrSel.onchange = () => { Settings.set('screenId', scrSel.value); toast('Toto zařízení: ' + Screens.mine().name, 'ok'); paint(); };
      const my = Settings.get('myView');
      const view = Object.assign({ chords: false, inst: [] }, my || Screens.mine().view || {});
      const saveView = () => Settings.set('myView', Object.assign({}, view));
      const custom = h('div', { class: 'scr-view' },
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!view.chords, onchange: e => { view.chords = e.target.checked; saveView(); } }), 'Akordy'),
        ...Store.instruments().map(ins => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: view.inst.includes(ins.code), onchange: e => {
          view.inst = e.target.checked ? [...new Set([...view.inst, ins.code])] : view.inst.filter(c => c !== ins.code); saveView();
        } }), h('span', { class: 'led', style: { background: ins.color } }), ins.name)));
      const singerSel = h('select', { class: 'inp set-sel' }, h('option', { value: '' }, '— nikdo / nezvýrazňovat —'),
        Store.singers().map(sg => h('option', { value: sg.code, selected: sg.code === S.mySinger }, sg.name)));
      singerSel.onchange = () => { Settings.set('mySinger', singerSel.value); Settings.set('highlightMine', !!singerSel.value); };
      const zoom = h('input', { class: 'inp set-num', type: 'number', min: 50, max: 200, step: 5, value: Math.round((S.readerZoom || 1) * 100) });
      zoom.onchange = () => Settings.set('readerZoom', Math.max(0.5, Math.min(2, (+zoom.value || 100) / 100)));
      const rotSel = h('select', { class: 'inp set-sel' }, [[0, 'neotáčet'], [90, 'o 90° doprava'], [270, 'o 90° doleva'], [180, 'o 180°']]
        .map(([v, l]) => h('option', { value: v, selected: (S.readerRotate || 0) === v }, l)));
      rotSel.onchange = () => Settings.set('readerRotate', +rotSel.value);
      const nameIn = h('input', { class: 'inp set-sel', value: S.userName, placeholder: 'např. Petr' });
      nameIn.onchange = () => Settings.set('userName', nameIn.value.trim());
      const pinBtn = h('button', { class: 'btn nogrow', onclick: async () => {
        const p = await promptDlg(S.pinHash ? 'Nový PIN (prázdné = zrušit PIN)' : 'Zvol PIN pro úpravy (čísla nebo text)');
        if (p === null) return;
        Settings.set('pinHash', p ? pinHash(p) : '');
        sessionStorage.setItem('unlocked', '1');
        toast(p ? 'PIN nastaven. Bez něj půjde jen číst ve čtečce.' : 'PIN zrušen', 'ok');
        paint();
      } }, S.pinHash ? '🔒 Změnit / zrušit' : '🔓 Nastavit PIN');
      box.append(
        h('p', { class: 'help' }, 'Platí jen pro tento počítač, tablet či telefon – ostatním členům se nemění.'),
        h('h3', {}, 'Použití'),
        h('div', { class: 'set-rows' },
          App.canInstall() ? setRow('Nainstalovat aplikaci', 'Ikona na ploše, celá obrazovka; data zůstanou v zařízení i bez internetu.', h('button', { class: 'btn primary nogrow', onclick: () => App.install() }, 'Nainstalovat')) : null,
          setRow('K čemu zařízení slouží', 'Určuje, co se otevře po zapnutí.', roleSel),
          setRow('Moje jméno', 'Ukazuje se u změn, které odsud uděláš.', nameIn),
          setRow('PIN pro úpravy', S.pinHash ? 'Úpravy jsou zamčené PINem – bez něj jde jen číst ve čtečce.' : 'Nepovinné – např. na čtečce, aby nikdo omylem nic nezměnil.', pinBtn),
          setRow('Vzhled aplikace', 'Barvy stránky ve čtečce určuje šablona písně.', segControl(THEMES, S.theme || 'dark', v => { Settings.set('theme', v); App.applyTheme(); })),
          setRow('Průvodce nastavením', 'Znovu projít otázky z prvního spuštění.', h('button', { class: 'btn nogrow', onclick: () => setupWizard() }, 'Spustit'))),
        h('h3', {}, 'Zobrazení ve čtečce'),
        h('div', { class: 'set-rows' },
          setRow('Toto zařízení je obrazovka', 'Na webu a v telefonu se stránka přizpůsobí oknu. Obrazovku kapely zvol jen pro pevně umístěný displej.', scrSel),
          setRow('Co vidím já', my ? 'Vlastní výběr jen pro toto zařízení.' : 'Jako obrazovka „' + Screens.mine().name + '“.',
            segControl([['profile', 'Jako obrazovka'], ['custom', 'Vlastní']], my ? 'custom' : 'profile', v => { Settings.set('myView', v === 'custom' ? Object.assign({}, view) : null); paint(); })),
          my ? h('div', { class: 'set-row sub' }, custom) : null,
          setRow('Zvýraznit moje řádky', 'Řádky ostatních zpěváků budou ztlumené (řádky „všichni“ zůstanou).', singerSel),
          setRow('Velikost písma (%)', 'Osobní zvětšení k velikosti obrazovky. Ve čtečce i klávesami + / −.', zoom),
          setRow('Otočit obraz čtečky', 'Jen když systém monitor sám neotáčí.', rotSel)));
    };
    paint();
    return box;
  },

  /* ---------- Obrazovky kapely (sdílené profily: rozměr, obsah, písmo) ---------- */
  screens(sub) {
    let edId = sub || Screens.editId();
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
        const sc = await Screens.add({ name }); edId = sc.id; paintScreens();
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
              await Screens.remove(scr.id); edId = 'main'; paintScreens();
            } }, '🗑 Smazat')),
        h('h3', {}, 'Rozměr'),
        h('div', { class: 'row' },
          h('label', { class: 'f' }, h('span', {}, 'Šířka (px)'), wIn), h('label', { class: 'f' }, h('span', {}, 'Výška (px)'), hIn),
          h('label', { class: 'f' }, h('span', {}, 'Úhlopříčka (palce)'), diag), h('label', { class: 'f' }, h('span', {}, 'Vzdálenost čtení (m)'), dist),
          h('button', { class: 'btn nogrow', title: 'Převezme rozlišení obrazovky, na které je aplikace právě otevřená', onclick: () => applyRes(...screenPx()) }, '⌖ Z této obrazovky')),
        h('div', { class: 'row', style: { marginTop: '10px', alignItems: 'center' } }, h('span', { class: 'nogrow help' }, 'Orientace:'), orientBtns.p, orientBtns.l),
        presetBox,
        h('p', {}, rec),
        h('h3', {}, 'Co se na této obrazovce ukáže'),
        h('div', { class: 'scr-view' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: true, disabled: true }), 'Text písně'), chordChk, ...instChks),
        h('div', { class: 'row', style: { marginTop: '10px', maxWidth: '360px' } }, h('label', { class: 'f' }, h('span', {}, 'Velikost písma oproti šabloně (%)'), fontIn)));
      paintRec(); paintOrient();
    };
    paintScreens();
    return h('div', { class: 'set-sec' },
      h('p', { class: 'help' }, 'Každá obrazovka (hlavní prompter, tablet, mobil…) má svůj rozměr, konce stránek a obsah. Nastavení se sdílí s celou kapelou; každé zařízení si v „Toto zařízení“ vybere, kterou obrazovkou je.'),
      scrTabs, scrBox);
  },

  /* ---------- Čtečka a ovládání ---------- */
  reader() {
    const S = Settings.data;
    const tplSel = h('select', { class: 'inp set-sel' }, [...Store.templates.values()].map(t => h('option', { value: t.id, selected: t.id === S.defaultTemplate }, t.name)));
    tplSel.onchange = () => Settings.set('defaultTemplate', tplSel.value);
    return h('div', { class: 'set-sec' },
      h('div', { class: 'set-rows' },
        setFlag('readerFullscreen', 'Přes celou obrazovku', 'Čtečka se otevře bez lišt prohlížeče či okna.'),
        setFlag('startInReader', 'Po spuštění rovnou čtečka', 'Otevře se poslední playlist – pro PC u monitoru.'),
        window.native ? setRow('Spustit po zapnutí počítače', 'Program se spustí sám s Windows.', setSwitch(window.native.getAutoStart(), v => window.native.setAutoStart(v))) : null,
        setFlag('readerSyncOnStart', 'Při otevření čtečky stáhnout změny', 'Když je internet.'),
        setFlag('hideCursor', 'Skrývat kurzor myši', ''),
        setFlag('swapMouse', 'Prohodit tlačítka myši', 'Normálně: pravé = další, levé = zpět.'),
        setFlag('wheelNav', 'Listovat kolečkem myši', ''),
        setRow('Výchozí šablona', 'Vzhled písní, které nemají vlastní šablonu.', tplSel)),
      h('h3', {}, 'Ovládání'),
      h('div', { class: 'set-rows set-keys' }, READER_KEYS.map(([k, v]) => h('div', { class: 'set-row' }, h('div', {}, h('b', {}, v)), h('kbd', {}, k)))));
  },

  /* ---------- Záloha a import ---------- */
  backup() {
    return h('div', { class: 'set-sec' },
      h('div', { class: 'set-rows' },
        setRow('Stáhnout zálohu', 'Jeden soubor .json se všemi písněmi, playlisty, šablonami a zpěváky.', h('button', { class: 'btn nogrow', onclick: () => exportBackup() }, '⇩ Stáhnout')),
        setRow('Obnovit ze zálohy', 'Slučovací – nic nesmaže, jen doplní a přepíše stejné položky. Při přihlášení ke kapele se pak odešlou do kapely.', h('button', { class: 'btn nogrow', onclick: () => pickFile('.json').then(f => f && importBackup(f)) }, '⇪ Vybrat soubor')),
        setRow('Import písní z textu', 'Soubory .txt – každý soubor jedna píseň. Jde i přetáhnout soubory do okna.', h('button', { class: 'btn nogrow', onclick: () => importTxtFiles() }, '⇪ Vybrat soubory')),
        (Store.meta.trash || []).length ? setRow('Smazáno synchronizací', `${Store.meta.trash.length} položek smazal jiný člen nebo zmizely z úložiště kapely (naposledy ${new Date(Store.meta.trash[0].at).toLocaleString('cs-CZ')}).`,
          h('button', { class: 'btn nogrow', onclick: () => restoreSyncTrash() }, '↶ Vrátit')) : null,
        window.native ? setRow('Složka s daty', window.native.dataDir, h('button', { class: 'btn nogrow', onclick: () => window.native.openDataDir() }, 'Otevřít')) : null));
  },

  /* ---------- O aplikaci ---------- */
  about() {
    return h('div', { class: 'set-sec' },
      h('div', { class: 'set-rows' },
        setRow('Verze', null, h('b', {}, APP_VERSION)),
        setRow('Druh', null, h('span', {}, window.native ? 'program pro Windows' : (matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'nainstalovaná aplikace' : 'webová verze'))),
        setRow('Adresa aplikace', 'Stejná aplikace pro telefon, tablet i počítač.', h('a', { href: appUrl(), target: '_blank' }, appUrl().replace(/^https:\/\//, '')))));
  },
};

/* Co aplikace v účtu Mega vidí (bez hesla a textů písní) */
async function megaDiagDialog(cfg) {
  toast('Načítám obsah Mega…', 'info', 2000);
  const m = cfg || MegaProvider.cfg();
  let text;
  try { text = `PROMPTER mini ${APP_VERSION}\nsložka: ${m.folder}\nchyba: ${Sync.lastError || '–'}\n` + await MegaProvider.api().diag(m); }
  catch (e) { text = 'Diagnostika selhala: ' + ipcError(e); }
  const ta = h('textarea', { class: 'inp', rows: 16, readonly: true, style: { fontFamily: 'Consolas, monospace', fontSize: '12px' } }, text);
  const v = await modal({ title: 'Diagnostika Mega', wide: true, body: h('div', {}, h('p', { class: 'help' }, 'Výpis neobsahuje heslo ani texty písní. Zkopíruj ho a pošli.'), ta),
    buttons: [{ label: 'Zavřít', value: null }, { label: '📋 Kopírovat', primary: true, value: true }] });
  if (v) { try { await navigator.clipboard.writeText(text); toast('Výpis zkopírován', 'ok'); } catch (e) { ta.select(); } }
}

function pickFile(accept) {
  return new Promise(res => { const i = h('input', { type: 'file', accept }); i.onchange = () => res(i.files[0]); i.click(); });
}

/* „Zůstat přihlášen“: heslo kapely trvale v tomto prohlížeči, nebo jen do jeho zavření */
function setRememberBand(on) {
  const m = Settings.get('mega');
  Settings.set('rememberBand', on);
  if (on) { Settings.set('mega', m); sessionStorage.removeItem('prompter-secret-mega'); }
  else { sessionStorage.setItem('prompter-secret-mega', JSON.stringify({ pass: m.pass })); Settings.set('mega', Object.assign({}, m, { pass: '' })); }
  toast(on ? 'Toto zařízení zůstane přihlášené.' : 'Po zavření prohlížeče bude potřeba přihlásit se znovu.', 'ok');
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
  // novější verze v zařízení (a tím i v kapele) má přednost – záloha doplní jen chybějící a starší
  let n = 0, kept = 0;
  for (const type of Object.keys(TYPES)) {
    for (const o of data[type] || []) {
      if (!o || !o.id) continue;
      const cur = Store[type].get(o.id);
      if (cur && (cur.updatedAt || '') >= (o.updatedAt || '')) { kept++; continue; }
      await Store.put(type, o, { silent: true, noStamp: true }); n++;
    }
  }
  Store.emit('sync', null);
  toast(`Obnoveno ${n} položek` + (kept ? ` · ${kept} ponecháno (v zařízení je stejná nebo novější verze)` : ''), 'ok', 6000);
}

/* Vrátit, co smazala synchronizace (smazal to jiný člen nebo zmizelo z úložiště) */
async function restoreSyncTrash() {
  const items = Store.meta.trash || [];
  if (!items.length) return;
  if (!await confirmDlg(`Vrátit ${items.length} položek, které smazala synchronizace? Znovu se nahrají i do kapely.`, 'Vrátit')) return;
  for (const { type, obj } of items) if (TYPES[type] && !Store[type].has(obj.id)) await Store.put(type, obj, { silent: true });
  Store.meta.trash = [];
  await Store.saveMeta();
  Store.emit('sync', null);
  toast('Vráceno – odešle se při další synchronizaci.', 'ok');
  App.go(true);
}
