'use strict';
/* ===== Playlisty ===== */
const isReadyPl = p => typeof p.ready === 'number';
// Čára pro přídavky: pl.encore = počet písní nad čarou (bez pole = playlist bez čáry)
const plEncore = pl => typeof pl.encore === 'number' ? Math.max(0, Math.min(pl.encore, pl.items.length)) : -1;
// Délka písně „m:ss“ (nebo jen minuty) → sekundy; 0 = nevyplněno
const durSec = s => { const m = /^\s*(\d+)(?:[:.,](\d{1,2}))?\s*$/.exec((s && s.duration) || ''); return m ? +m[1] * 60 + +(m[2] || 0) : 0; };
const fmtDur = sec => sec >= 3600 ? `${Math.floor(sec / 3600)} h ${Math.round(sec % 3600 / 60)} min` : `${Math.round(sec / 60)} min`;
const LINE = '__line__';
// Řazení textů: prázdné na konec; ladění podle tónů od C (české H = B, B = B♭), moll za dur
const cmpText = (a, b) => !a !== !b ? (a ? -1 : 1) : String(a || '').localeCompare(String(b || ''), 'cs', { sensitivity: 'base' });
function keyNum(key) {
  const m = /^\s*([a-hA-H])(is|es|s|#|♯|b|♭)?\s*(m(?!aj)|mi|moll)?/i.exec(key || '');
  if (!m) return 1e9;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, H: 11, B: 10 }[m[1].toUpperCase()];
  const acc = !m[2] || (m[1].toUpperCase() === 'B' && !/^(is|#|♯)$/i.test(m[2])) ? 0 : /^(is|#|♯)$/i.test(m[2]) ? 1 : -1;   // „Bb“ = české B
  return ((base + acc + 12) % 12) * 2 + (m[3] ? 1 : 0);
}

const PlaylistsView = {

  search: '',

  /* Bez otevřeného playlistu: seznam přes celou šířku (hledání, řazení). S otevřeným: jen jeho úprava. */
  render(main, plId) {
    const pl = plId && Store.playlists.get(plId);
    const side = h('div', { class: 'side big-list pl-list' });
    const content = h('div', { class: 'content' });
    main.append(h('div', { class: 'view' + (pl ? ' has-detail pl-open' : ' list-only') }, side, content));

    const searchInp = h('input', { class: 'inp', type: 'search', placeholder: 'Hledat playlist, poznámku nebo píseň v něm…', value: this.search });
    const sortSel = h('select', { class: 'inp sl-sort', title: 'Řazení' },
      [['new', 'Řadit: nejnovější'], ['old', 'Řadit: nejstarší'], ['name', 'Řadit: název'], ['count', 'Řadit: počet písní']]
        .map(([v, l]) => h('option', { value: v, selected: (Settings.get('plSort') || 'new') === v }, l)));
    const list = h('div', { class: 'list' });
    const count = h('div', { class: 'sl-count' });
    const total = h('span', {});
    // 2/3 seznam playlistů, 1/3 náhled obsahu vybraného playlistu
    const prev = h('div', { class: 'pl-prev' });
    side.append(h('div', { class: 'pl-split' },
      h('div', { class: 'pl-main' },
        h('div', { class: 'sl-titlebar' }, h('h1', {}, 'Playlisty'), total),
        h('div', { class: 'side-head sl-head' },
          h('button', { class: 'btn primary', onclick: () => this.create() }, '＋ Nový playlist'),
          searchInp, sortSel),
        h('div', { class: 'sl-row pl-row sl-cols' }, h('span', {}, 'Datum'), h('span', {}, 'Název'), h('span', {}, 'Písní'), h('span', {}, 'Poznámka')),
        list, count),
      prev));
    const paintPrev = p => {
      prev.innerHTML = '';
      if (!p) { prev.appendChild(h('div', { class: 'help pl-prev-empty' }, 'Klikni na playlist a tady uvidíš, co obsahuje.')); return; }
      prev.append(
        h('div', { class: 'pl-prev-head' },
          h('h3', {}, p.name || '(bez názvu)'),
          h('div', { class: 'pl-prev-meta' }, [p.date ? new Date(p.date).toLocaleDateString('cs-CZ') : '', p.note].filter(Boolean).join(' · ') || ' ')),
        h('div', { class: 'pl-prev-btns' },
          h('button', { class: 'btn primary', onclick: () => { location.hash = '#/playlists/' + p.id; } }, '✎ Upravit'),
          h('button', { class: 'btn play', onclick: () => { location.hash = '#/reader/' + p.id; } }, '▶ Čtečka'),
          h('button', { class: 'btn', onclick: () => this.print(p) }, '🖨 Tisk'),
          readyBtn(p)),
        p.items.length
          ? h('ol', { class: 'pl-prev-list' }, p.items.map((id, i) => {
            const s = Store.songs.get(id);
            return h('li', { class: (s ? '' : 'missing') + (i === plEncore(p) ? ' encore-first' : '') + (plEncore(p) >= 0 && i >= plEncore(p) ? ' encore' : ''), onclick: () => { if (s) location.hash = '#/songs/' + id; }, title: s ? 'Otevřít píseň' : '' },
              h('b', {}, s ? s.title : '(smazaná píseň)'),
              s ? h('span', {}, s.artist || ' ') : null,
              s ? h('em', { class: 'pl-prev-keys', title: 'Ladění a tempo (doplníš v údajích písně)' },
                s.key ? h('i', {}, 'ladění ', keyBadge(s.key)) : h('i', { class: 'none' }, 'ladění —'),
                h('i', { class: s.tempo ? '' : 'none' }, (s.tempo || '—') + ' BPM')) : null);
          }))
          : h('div', { class: 'help pl-prev-empty' }, 'Playlist je zatím prázdný.'));
    };
    const readyBtn = p => h('button', { class: 'btn pl-pin' + (isReadyPl(p) ? ' on' : ''),
      title: isReadyPl(p) ? 'Vrátit mezi ostatní playlisty' : 'Přesunout do „Připraveno k přehrání“',
      onclick: () => this.setReady(p.id, isReadyPl(p) ? false : null) }, isReadyPl(p) ? '★ Připraveno' : '★ Připravit');
    const select = id => {
      this.selected = id;
      $$('.item', list).forEach(el => el.classList.toggle('active', el.dataset.id === id));
      paintPrev(Store.playlists.get(id));
    };
    const sorted = by => {
      const cmp = (a, b) => String(a || '').localeCompare(String(b || ''), 'cs', { sensitivity: 'base' });
      const all = [...Store.playlists.values()];
      if (by === 'name') return all.sort((a, b) => cmp(a.name, b.name) || String(b.date || '').localeCompare(String(a.date || '')));
      if (by === 'count') return all.sort((a, b) => b.items.length - a.items.length || cmp(a.name, b.name));
      if (by === 'old') return all.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || cmp(a.name, b.name));
      return Store.sortedPlaylists();
    };
    // „Připraveno k přehrání“: playlisty s polem ready (pořadí určuje uživatel, řazení se na ně nevztahuje)
    let dragId = null;
    const isReady = isReadyPl;
    const setReady = (id, before) => this.setReady(id, before);
    const dropZone = (el, target) => {   // target(e) → argument pro setReady
      el.addEventListener('dragover', e => { if (!dragId) return; e.preventDefault(); e.stopPropagation(); el.classList.add('over'); });
      el.addEventListener('dragleave', () => el.classList.remove('over'));
      el.addEventListener('drop', e => { if (!dragId) return; e.preventDefault(); e.stopPropagation(); el.classList.remove('over'); const id = dragId; dragId = null; setReady(id, target(e)); });
    };
    const row = (p, ready) => {
      const el = h('div', { class: 'item sl-row pl-row' + (ready ? ' ready' : ''), 'data-id': p.id, draggable: isMobile() ? 'false' : 'true',
        title: ready ? 'Klik = náhled, dvojklik = upravit, přetažením změníš pořadí' : 'Klik = náhled, dvojklik = upravit',
        onclick: () => isMobile() ? (location.hash = '#/playlists/' + p.id) : select(p.id),
        ondblclick: () => { location.hash = '#/playlists/' + p.id; } },
        h('span', { class: 'sl-artist' }, p.date ? new Date(p.date).toLocaleDateString('cs-CZ') : '—'),
        h('b', { class: 'sl-title' }, p.name || '(bez názvu)'),
        h('span', { class: 'sl-key' }, plural(p.items.length, 'píseň', 'písně', 'písní')),
        h('span', { class: 'sl-artist' }, p.note || ''));
      el.addEventListener('dragstart', e => { dragId = p.id; el.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.id); });
      el.addEventListener('dragend', () => { dragId = null; el.classList.remove('drag'); $$('.over', list).forEach(x => x.classList.remove('over')); });
      if (ready) dropZone(el, () => p.id);
      return el;
    };
    let readyIds = [];
    this.paintSide = () => {
      const q = normalizeForSearch(this.search);
      const hit = p => !q || normalizeForSearch([p.name, p.note, p.date, ...p.items.map(id => (Store.songs.get(id) || {}).title || '')].join(' ')).includes(q);
      list.innerHTML = '';
      const ready = [...Store.playlists.values()].filter(isReady).sort((a, b) => a.ready - b.ready).filter(hit);
      const pls = sorted(sortSel.value).filter(p => !isReady(p)).filter(hit);
      readyIds = ready.map(p => p.id);
      if (!q || ready.length) {
        const sec = h('div', { class: 'pl-sec pl-sec-ready' }, h('b', {}, 'PŘIPRAVENO k přehrání'), ready.length ? h('span', {}, String(ready.length)) : null);
        dropZone(sec, () => readyIds[0] || null);
        list.appendChild(sec);
        ready.forEach(p => list.appendChild(row(p, true)));
        const end = h('div', { class: 'pl-drop' + (ready.length ? ' slim' : '') },
          ready.length ? '' : 'Sem přetáhni playlist, který chystáte hrát (nebo v náhledu vpravo „★ Připravit“). Zůstane tu, dokud ho nevrátíš.');
        dropZone(end, () => null);
        list.appendChild(end);
        const other = h('div', { class: 'pl-sec' }, h('b', {}, 'Ostatní playlisty'));
        dropZone(other, () => false);
        list.appendChild(other);
      }
      for (const p of pls) list.appendChild(row(p, false));
      dropZone(list, () => false);   // puštěno kamkoli mezi ostatní = vrátit
      if (!pls.length && !ready.length) list.appendChild(h('div', { class: 'help', style: { padding: '16px' } }, q ? 'Nic nenalezeno.' : 'Zatím žádné playlisty. Playlist = seznam písní v pořadí, jak je budete hrát.'));
      const shown = ready.length + pls.length;
      count.textContent = q ? `${shown} z ${Store.playlists.size} playlistů` : 'Klik = náhled · dvojklik = upravit · přetažením do „Připraveno“';
      total.textContent = plural(Store.playlists.size, 'playlist', 'playlisty', 'playlistů');
      const keep = [...ready, ...pls].find(p => p.id === this.selected) || ready[0] || pls[0];
      select(keep ? keep.id : null);
    };
    searchInp.addEventListener('input', () => { this.search = searchInp.value; this.paintSide(); });
    sortSel.addEventListener('change', () => { Settings.set('plSort', sortSel.value); this.paintSide(); });
    this.paintSide();

    if (!pl) return;
    content.appendChild(h('button', { class: 'btn pl-back', onclick: () => App.home() }, '◀ Playlisty'));
    this.editor(content, pl);
  },

  /* „Připraveno k přehrání“: before = id playlistu, před který vložit; null = na konec; false = vrátit mezi ostatní */
  async setReady(id, before) {
    const order = [...Store.playlists.values()].filter(isReadyPl).sort((x, y) => x.ready - y.ready).map(p => p.id).filter(x => x !== id);
    if (before !== false) order.splice(before && order.includes(before) ? order.indexOf(before) : order.length, 0, id);
    const moved = Store.playlists.get(id);
    if (before === false && moved && isReadyPl(moved)) { delete moved.ready; await Store.put('playlists', moved, { silent: true }); }
    for (const [i, pid] of order.entries()) {
      const p = Store.playlists.get(pid);
      if (p && p.ready !== i) { p.ready = i; await Store.put('playlists', p, { silent: true }); }
    }
    if (this.paintSide) this.paintSide();
  },

  async create() {
    const name = await promptDlg('Název playlistu', playlistNameHint());
    if (!name) return;
    const p = await Store.put('playlists', newPlaylist(name));
    location.hash = '#/playlists/' + p.id;
  },

  /* Úprava playlistu: pracuje se na kopii, uloží se až tlačítkem Uložit (Ctrl+S); při odchodu se App zeptá */
  editor(root, stored) {
    const pl = clone(stored);
    let dirty = false;
    const savedInd = h('span', { class: 'saved-ind' });
    const saveBtn = h('button', { class: 'btn', title: 'Uložit změny (Ctrl+S)', onclick: () => save(true) }, '💾 Uložit');
    const paintSaved = () => {
      savedInd.textContent = dirty ? 'Neuloženo' : pl.updatedBy ? `Upravil(a) ${pl.updatedBy}, ${fmtDate(pl.updatedAt)}` : '';
      savedInd.classList.toggle('dirty', dirty);
      saveBtn.classList.toggle('primary', dirty);
    };
    const markDirty = () => { dirty = true; paintSaved(); };
    const save = async manual => {
      if (!dirty && !manual) return;
      dirty = false;
      const saved = await Store.put('playlists', clone(pl));
      pl.updatedAt = saved.updatedAt; pl.updatedBy = saved.updatedBy;
      paintSaved();
      if (manual) toast('Uloženo', 'ok', 1500);
    };
    const saveAs = async stay => {   // nový playlist ze současného stavu; původní zůstane, jak byl uložený
      const name = await promptDlg('Uložit jako nový playlist – název', (pl.name || 'Playlist') + ' (2)');
      if (!name) return false;
      const c = clone(pl); c.id = uid(); c.name = name; delete c.ready;
      await Store.put('playlists', c);
      dirty = false;
      toast('Uloženo jako „' + name + '“', 'ok');
      if (!stay) location.hash = '#/playlists/' + c.id;
      return true;
    };
    App.edit = { get what() { return `Playlist „${pl.name || 'bez názvu'}“`; }, dirty: () => dirty, save, saveAs };
    const f = (label, el) => h('label', { class: 'f' }, h('span', {}, label), el);
    const inName = h('input', { class: 'inp', value: pl.name || '' });
    const inDate = h('input', { class: 'inp', type: 'date', value: pl.date || '' });
    const inNote = h('input', { class: 'inp', value: pl.note || '', placeholder: 'místo, čas, poznámka…' });
    inName.oninput = () => { pl.name = inName.value; markDirty(); };
    inDate.onchange = () => { pl.date = inDate.value; markDirty(); };
    inNote.oninput = () => { pl.note = inNote.value; markDirty(); };

    const itemsBox = h('div', { class: 'list' });
    const countLbl = h('span', { class: 'dim' });

    // Úpravy pracují s řádky = písně + případná čára (LINE); při uložení se čára převede na pl.encore
    let rows = plEncore(pl) >= 0 ? [...pl.items.slice(0, plEncore(pl)), LINE, ...pl.items.slice(plEncore(pl))] : [...pl.items];
    const commit = () => {
      const at = rows.indexOf(LINE);
      pl.items = rows.filter(r => r !== LINE);
      if (at >= 0) pl.encore = at; else delete pl.encore;
      markDirty(); paintItems();
    };
    const addSong = id => { const at = rows.indexOf(LINE); rows.splice(at >= 0 ? at : rows.length, 0, id); commit(); };   // nová píseň nad čáru
    // Číslo pořadí (1 = první píseň; čára se nepočítá). Obsazené číslo: nová píseň se vloží (po potvrzení), přesouvaná jde i prohodit.
    const songRows = () => rows.map((r, i) => r === LINE ? -1 : i).filter(i => i >= 0);
    const placeSong = async (id, pos, from = -1) => {   // from = řádek, když píseň v seznamu už je
      pos = Math.max(1, Math.floor(pos));
      const idxs = songRows();
      if (from >= 0 && idxs.indexOf(from) + 1 === pos) return;
      const target = idxs[pos - 1];
      if (target === undefined) {   // za posledním číslem = na konec
        if (from >= 0) rows.splice(from, 1);
        rows.push(id); return commit();
      }
      const s = Store.songs.get(rows[target]);
      const how = await modal({ title: `Pořadí ${pos}. je obsazené`,
        body: h('p', {}, `Jako ${pos}. je „${s ? s.title : '?'}“. ` + (from >= 0
          ? 'Písně můžeš prohodit, nebo tuto vložit jako ' + pos + '. a ostatní posunout.'
          : 'Vložením se ona i všechny další písně posunou o jedno dál.')),
        buttons: [{ label: 'Zrušit', value: null }, from >= 0 ? { label: 'Prohodit', value: 'swap' } : null,
          { label: 'Vložit a posunout', value: 'shift', primary: true }].filter(Boolean) });
      if (!how) return paintItems();
      if (how === 'swap') { [rows[from], rows[target]] = [rows[target], rows[from]]; return commit(); }
      if (from >= 0) rows.splice(from, 1);
      const i = songRows()[pos - 1];
      rows.splice(i === undefined ? rows.length : i, 0, id);
      commit();
    };
    const posInput = (value, onDone) => {   // malé číselné pole: Enter potvrdí, Esc zruší
      const inp = h('input', { class: 'inp pos-inp', type: 'number', min: '1', value: value || '' });
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); onDone(parseInt(inp.value, 10)); }
        if (e.key === 'Escape') { e.preventDefault(); onDone(NaN); }
      });
      return inp;
    };
    const SORTS = {
      artist: ['kapely', (a, b) => cmpText(a.artist, b.artist) || cmpText(a.title, b.title)],
      title: ['názvu', (a, b) => cmpText(a.title, b.title)],
      tempo: ['BPM', (a, b) => (parseFloat(a.tempo) || 1e9) - (parseFloat(b.tempo) || 1e9)],
      key: ['ladění', (a, b) => keyNum(a.key) - keyNum(b.key) || cmpText(a.key, b.key)],
      duration: ['délky', (a, b) => (durSec(a) || 1e9) - (durSec(b) || 1e9)],
    };
    const sortSongs = by => {   // řadí zvlášť písně nad čarou a pod ní; prázdné hodnoty na konec
      const [, cmp] = SORTS[by];
      const seg = list => list.map(id => [id, Store.songs.get(id) || {}]).sort((x, y) => cmp(x[1], y[1])).map(x => x[0]);
      const at = rows.indexOf(LINE);
      rows = at >= 0 ? [...seg(rows.slice(0, at)), LINE, ...seg(rows.slice(at + 1))] : seg(rows);
      commit();
    };
    const sortSel = h('select', { class: 'inp pl-sort', title: 'Jednorázově přeřadí písně (nad čarou i pod ní zvlášť)' },
      h('option', { value: '' }, 'Seřadit…'), Object.entries(SORTS).map(([v, [l]]) => h('option', { value: v }, 'Seřadit podle ' + l)));
    sortSel.onchange = () => { if (sortSel.value) sortSongs(sortSel.value); sortSel.value = ''; };
    const lineBtn = h('button', { class: 'btn small', title: 'Písně pod čarou jsou možné přídavky', onclick: () => { if (!rows.includes(LINE)) { rows.push(LINE); commit(); } } }, '＋ Čára pro přídavky');
    // Zobrazení ve sloupcích: počet sloupců podle šířky okna (každý dost široký pro všechny údaje), u krátkých playlistů jeden
    const COL_MIN = 520;   // nejmenší šířka sloupce = column-width v css (.pl-multi)
    const colsBtn = h('button', { class: 'btn small', onclick: () => { Settings.set('plCols', !Settings.get('plCols')); paintCols(); } });
    const paintCols = () => {   // tlačítko jen tehdy, když se vejdou aspoň 2 sloupce a písní je víc než 8
      const many = rows.length > 8, fits = itemsBox.clientWidth >= 2 * COL_MIN + 14;
      const multi = !!Settings.get('plCols') && many && fits;
      itemsBox.classList.toggle('pl-multi', multi);
      colsBtn.disabled = !many || !fits;
      colsBtn.replaceChildren(...glyphToIcon(multi ? '▤ Jeden sloupec' : '▥ Ve sloupcích'));
      colsBtn.title = !many ? 'Ve sloupcích až od 9 písní' : !fits ? 'Okno je na více sloupců úzké – rozšiř ho'
        : multi ? 'Zobrazit písně pod sebou v jednom sloupci' : 'Zobrazit písně ve více sloupcích (podle šířky okna)';
    };
    new ResizeObserver(() => paintCols()).observe(itemsBox);
    let dragFrom = null;

    const paintItems = () => {
      itemsBox.innerHTML = '';
      const at = rows.indexOf(LINE);
      const total = pl.items.reduce((t, id) => t + durSec(Store.songs.get(id)), 0);
      countLbl.textContent = (at >= 0 ? plural(at, 'píseň', 'písně', 'písní') + ' + ' + plural(rows.length - at - 1, 'přídavek', 'přídavky', 'přídavků') : plural(pl.items.length, 'píseň', 'písně', 'písní')) + (total ? ' · ' + fmtDur(total) : '');
      lineBtn.style.display = at >= 0 ? 'none' : '';
      paintCols();
      let n = 0;
      rows.forEach((id, i) => {
        const move = d => { const j = i + d; if (j >= 0 && j < rows.length) { rows.splice(j, 0, rows.splice(i, 1)[0]); commit(); } };
        let el;
        if (id === LINE) {
          el = h('div', { class: 'pl-item pl-line', draggable: 'true', title: 'Přetažením posuneš čáru; písně pod ní jsou možné přídavky' },
            h('span', { class: 't' }, h('b', {}, 'Přídavky'), h('span', { class: 'dim' }, ' – písně pod čarou')),
            h('button', { class: 'btn small icon', title: 'Čáru výš', onclick: () => move(-1) }, '↑'),
            h('button', { class: 'btn small icon', title: 'Čáru níž', onclick: () => move(1) }, '↓'),
            h('button', { class: 'btn small icon danger', title: 'Zrušit čáru (přídavky se stanou běžnými písněmi)', onclick: () => { rows.splice(i, 1); commit(); } }, '✕'));
        } else {
          const s = Store.songs.get(id);
          const idx = n++;
          el = h('div', { class: 'pl-item' + (at >= 0 && i > at ? ' encore' : ''), draggable: 'true' },
            h('span', { class: 'num', title: 'Klikni a napiš nové pořadí', onclick: e => {
              const span = e.currentTarget;
              let done = false;
              const inp = posInput(idx + 1, v => { if (done) return; done = true; if (v > 0 && v !== idx + 1) placeSong(id, v, i); else paintItems(); });
              inp.addEventListener('blur', () => { if (!done) { done = true; const v = parseInt(inp.value, 10); if (v > 0 && v !== idx + 1) placeSong(id, v, i); else paintItems(); } });
              span.replaceWith(inp); inp.focus(); inp.select();
            } }, String(idx + 1)),
            h('div', { class: 't' }, h('b', {}, s ? s.title : '(smazaná píseň)'), ' ', h('span', { class: 'dim' }, s ? s.artist || '' : '')),
            // základní údaje vždy na stejném místě; nevyplněné jako pomlčka
            h('span', { class: 'pi-key', title: 'Ladění' }, s && s.key ? keyBadge(s.key) : h('i', { class: 'none' }, '—')),
            h('span', { class: 'pi-bpm', title: 'Tempo' }, s && s.tempo ? s.tempo + ' BPM' : h('i', { class: 'none' }, '— BPM')),
            h('span', { class: 'pi-dur', title: 'Délka' }, s && durSec(s) ? s.duration : h('i', { class: 'none' }, '—:——')),
            h('span', { class: 'pi-sing sl-dots', title: 'Zpívá' }, s ? songSingers(s).map(g => h('i', { title: g.name, style: { background: g.color } })) : null),
            h('button', { class: 'btn small icon', title: 'Upravit píseň', onclick: () => { location.hash = '#/songs/' + id; } }, '✎'),
            h('button', { class: 'btn small icon play', title: 'Spustit od této písně', onclick: () => { location.hash = `#/reader/${pl.id}/${idx}`; } }, '▶'),
            h('button', { class: 'btn small icon danger', title: 'Odebrat z playlistu', onclick: async () => {
              if (!await confirmDlg(`Odebrat „${s ? s.title : 'smazanou píseň'}“ z playlistu? Píseň zůstane v seznamu písní.`, 'Odebrat', true)) return;
              rows.splice(i, 1); commit();
            } }, '✕'));
          el.addEventListener('dblclick', () => { location.hash = `#/reader/${pl.id}/${idx}`; });
        }
        el.addEventListener('dragstart', e => { dragFrom = i; el.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); });
        el.addEventListener('dragend', () => el.classList.remove('drag'));
        el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('over'); });
        el.addEventListener('dragleave', () => el.classList.remove('over'));
        el.addEventListener('drop', e => {
          e.preventDefault(); e.stopPropagation(); el.classList.remove('over');
          if (dragFrom !== null) {
            const [m] = rows.splice(dragFrom, 1);
            rows.splice(dragFrom < i ? i - 1 : i, 0, m);
          }
          dragFrom = null; commit();
        });
        itemsBox.appendChild(el);
      });
      if (!pl.items.length) itemsBox.appendChild(h('div', { class: 'empty', style: { height: 'auto', padding: '40px 10px' } }, 'Přidej písně polem „Přidat píseň…“ nebo tlačítkem „Vybrat z knihovny…“ nahoře.'));
    };
    itemsBox.addEventListener('dragover', e => e.preventDefault());
    itemsBox.addEventListener('drop', e => {
      e.preventDefault();
      if (dragFrom !== null) { rows.push(rows.splice(dragFrom, 1)[0]); commit(); }
      dragFrom = null;
    });

    /* Přidávání písní: psaním s nabídkou shod, nebo výběrem více písní z knihovny */
    const quickAdd = () => {   // Enter přidá vybranou shodu
      const inp = h('input', { class: 'inp', type: 'search', placeholder: 'Přidat píseň…', title: 'Napiš název nebo kapelu, šipkami vyber, Enter přidá' });
      const drop = h('div', { class: 'qa-drop' });
      let hits = [], sel = 0;
      const paint = () => {
        drop.innerHTML = '';
        const q = normalizeForSearch(inp.value);
        hits = q ? Store.sortedSongs().filter(s => normalizeForSearch([s.title, s.artist].join(' ')).includes(q)).slice(0, 8) : [];
        sel = Math.min(sel, Math.max(0, hits.length - 1));
        hits.forEach((s, i) => drop.appendChild(h('div', { class: 'qa-hit' + (i === sel ? ' sel' : ''), onmousedown: e => { e.preventDefault(); add(s); } },
          h('b', {}, s.title), ' ', h('span', { class: 'dim' }, s.artist || ''), s.key ? [' ', keyBadge(s.key)] : null,
          rows.includes(s.id) ? h('span', { class: 'dim qa-in' }, 'už v playlistu') : null)));
        if (q && !hits.length) drop.appendChild(h('div', { class: 'qa-hit dim' }, 'Nic nenalezeno'));
        drop.style.display = q ? '' : 'none';
      };
      const pos = h('input', { class: 'inp pos-inp', type: 'number', min: '1', placeholder: 'pořadí', title: 'Kolikátá má píseň v playlistu být (prázdné = na konec)' });
      const add = async s => {
        const p = parseInt(pos.value, 10);
        if (p > 0) await placeSong(s.id, p); else addSong(s.id);
        inp.value = ''; pos.value = ''; sel = 0; paint(); inp.focus();
      };
      inp.addEventListener('input', () => { sel = 0; paint(); });
      inp.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') { sel = Math.min(hits.length - 1, sel + 1); paint(); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); paint(); e.preventDefault(); }
        else if (e.key === 'Enter' && hits[sel]) { add(hits[sel]); e.preventDefault(); }
        else if (e.key === 'Escape') { inp.value = ''; paint(); }
      });
      inp.addEventListener('blur', () => setTimeout(() => { drop.style.display = 'none'; }, 150));
      inp.addEventListener('focus', paint);
      drop.style.display = 'none';
      pos.addEventListener('keydown', e => { if (e.key === 'Enter' && hits[sel]) { e.preventDefault(); add(hits[sel]); } });
      return [h('div', { class: 'qa' }, inp, drop), pos];
    };
    const pickDialog = async () => {   // okno s hledáním, filtrem štítku a zaškrtáváním
      const chosen = new Set();   // v pořadí, jak se písně označovaly – tak se i přidají
      const ord = new Map();      // id → štítek s pořadím označení
      const q = h('input', { class: 'inp', type: 'search', placeholder: 'Hledat název nebo kapelu…' });
      const tags = [...new Set([...Store.songs.values()].flatMap(s => s.tags || []))].sort((a, b) => a.localeCompare(b, 'cs'));
      const tagSel = h('select', { class: 'inp' }, h('option', { value: '' }, 'Všechny štítky'), tags.map(t => h('option', { value: t }, t)));
      const hideIn = h('input', { type: 'checkbox' });
      const fromPos = h('input', { class: 'inp pos-inp', type: 'number', min: '1', placeholder: 'konec', title: 'Vybrané písně se vloží za sebou od tohoto pořadí, ostatní se posunou' });
      const box = h('div', { class: 'pick-list' });
      let okBtn = null;
      const paint = () => {
        box.innerHTML = '';
        ord.clear();
        const nq = normalizeForSearch(q.value);
        for (const s of Store.sortedSongs()) {
          const inPl = rows.includes(s.id);
          if (hideIn.checked && inPl) continue;
          if (tagSel.value && !(s.tags || []).includes(tagSel.value)) continue;
          if (nq && !normalizeForSearch([s.title, s.artist].join(' ')).includes(nq)) continue;
          const cb = h('input', { type: 'checkbox', checked: chosen.has(s.id), onchange: () => { cb.checked ? chosen.add(s.id) : chosen.delete(s.id); count(); } });
          const badge = h('span', { class: 'pick-ord' });
          ord.set(s.id, badge);
          box.appendChild(h('label', { class: 'pick-row' + (inPl ? ' in' : '') }, cb, badge,
            h('span', { class: 'pick-t' }, h('b', {}, s.title), h('span', { class: 'dim' }, s.artist || '')),
            s.key ? keyBadge(s.key) : h('span'), h('span', { class: 'dim' }, s.tempo ? s.tempo + ' BPM' : ''),
            h('span', { class: 'dim' }, inPl ? 'v playlistu' : '')));
        }
        if (!box.children.length) box.appendChild(h('div', { class: 'help', style: { padding: '20px' } }, 'Nic nenalezeno.'));
        count();
      };
      const count = () => {
        const order = [...chosen];
        for (const [id, el] of ord) { const n = order.indexOf(id) + 1; el.textContent = n ? String(n) : ''; el.classList.toggle('on', n > 0); }
        if (okBtn) okBtn.textContent = chosen.size ? `Přidat vybrané (${chosen.size})` : 'Přidat vybrané';
      };
      q.oninput = paint; tagSel.onchange = paint; hideIn.onchange = paint;
      paint();
      const ok = await modal({ title: 'Vybrat písně do playlistu', wide: true,
        body: h('div', { class: 'pick-dlg' }, h('div', { class: 'row' }, q, tagSel, h('label', { class: 'chk' }, hideIn, 'Skrýt písně, které už v playlistu jsou')), box,
          h('label', { class: 'pick-pos' }, 'Vložit od pořadí', fromPos, h('span', { class: 'help' }, 'prázdné = na konec (nad čáru přídavků); ostatní písně se posunou'))),
        buttons: [{ label: 'Zrušit', value: false }, { label: 'Přidat vybrané', value: true, primary: true }],
        onOpen: b => { okBtn = b.querySelector('.modal-buttons .primary'); setTimeout(() => q.focus(), 40); } });
      if (!ok || !chosen.size) return;
      const ids = [...chosen];
      const p = parseInt(fromPos.value, 10), at = rows.indexOf(LINE);
      const i = p > 0 ? songRows()[p - 1] : undefined;
      rows.splice(p > 0 ? (i === undefined ? rows.length : i) : (at >= 0 ? at : rows.length), 0, ...ids);
      commit();
    };
    root.append(
      h('div', { class: 'row', style: { marginBottom: '10px' } },
        f('Název playlistu', inName), h('div', { style: { flex: '0 0 160px' } }, f('Datum', inDate)), f('Poznámka', inNote)),
      h('div', { class: 'bottom-actions', style: { marginBottom: '12px' } },
        h('button', { class: 'btn play', onclick: () => { location.hash = '#/reader/' + pl.id; } }, '▶ Spustit ve čtečce'),
        h('button', { class: 'btn', onclick: () => this.print(pl) }, '🖨 Tisk'),
        h('button', { class: 'btn', onclick: () => this.duplicate(pl) }, '⧉ Duplikovat'),
        h('button', { class: 'btn', onclick: () => this.exportTxt(pl) }, '⇩ Export textů'),
        h('button', { class: 'btn pl-pin' + (isReadyPl(pl) ? ' on' : ''), title: 'Připraveno k přehrání: playlist je v seznamu nahoře, dokud ho nevrátíš',
          onclick: async e => {
            const b = e.currentTarget;
            await this.setReady(pl.id, isReadyPl(pl) ? false : null);
            const st = Store.playlists.get(pl.id);   // „připraveno“ se ukládá hned (pořadí sekce), kopie ho jen převezme
            if (st && isReadyPl(st)) pl.ready = st.ready; else delete pl.ready;
            b.classList.toggle('on', isReadyPl(pl));
            b.replaceChildren(...glyphToIcon(isReadyPl(pl) ? '★ Připraveno' : '★ Připravit k přehrání'));
          } },
          isReadyPl(pl) ? '★ Připraveno' : '★ Připravit k přehrání'),
        h('span', { class: 'grow' }),
        savedInd, saveBtn,
        h('button', { class: 'btn', title: 'Uložit jako nový playlist (původní zůstane beze změny)', onclick: () => saveAs() }, 'Uložit jako…'),
        h('button', { class: 'btn danger', onclick: () => this.del(pl) }, '🗑 Smazat')),
      h('div', { class: 'pl-col pl-songs' },
        h('div', { class: 'pl-add' }, quickAdd(), h('button', { class: 'btn', onclick: pickDialog }, '⧉ Vybrat z knihovny…')),
        h('div', { class: 'head' }, h('b', {}, 'Pořadí písní'), countLbl, h('span', { class: 'grow', style: { flex: 1 } }), colsBtn, lineBtn, sortSel),
        itemsBox));
    paintItems(); paintSaved();
  },

  async duplicate(pl) {
    const c = clone(pl); c.id = uid(); c.name += ' (kopie)';
    await Store.put('playlists', c);
    location.hash = '#/playlists/' + c.id;
  },
  async del(pl) {
    if (!await confirmDlg(`Smazat playlist „${pl.name}“? Písně zůstanou v knihovně.`, 'Smazat', true)) return;
    await Store.remove('playlists', pl.id);
    App.edit = null;   // smazaný playlist už není co ukládat
    App.home();
  },
  async print(pl) {
    const o = Object.assign({ what: 'both', bigList: false, color: true, pageBreak: true, size: 'm', cols: 1, notes: true, sections: true }, Settings.get('printOpts') || {});
    const md = musDefaults();
    o.mus = Object.assign({ on: md.on, chords: md.chords }, o.mus || {});
    o.mus.inst = Object.assign({}, md.inst, (o.mus && o.mus.inst) || {});
    const musChk = (label, color, get, set) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: get(), onchange: e => set(e.target.checked) }), h('span', { class: 'led', style: { background: color } }), label);
    const radio = (name, val, label, help) => h('label', { class: 'chk' }, h('input', { type: 'radio', name, checked: o[name] === val, onchange: () => { o[name] = val; } }), h('span', {}, label, help ? h('span', { class: 'help' }, ' – ' + help) : null));
    const chk = (k, label) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!o[k], onchange: e => { o[k] = e.target.checked; } }), label);
    const body = h('div', { class: 'print-dlg' },
      h('div', { class: 'grid2' },
        h('div', {},
          h('h3', {}, 'Co vytisknout'),
          radio('what', 'list', 'Setlist', 'jen pořadí písní'),
          radio('what', 'texts', 'Texty písní', 'celé texty jako zpěvník'),
          radio('what', 'both', 'Setlist + texty'),
          h('h3', {}, 'Setlist'),
          chk('bigList', 'Velké písmo (na zem k pódiu)')),
        h('div', {},
          h('h3', {}, 'Texty'),
          chk('color', 'Barevně (zpěváci barvou, jinak jmenovkou)'),
          chk('pageBreak', 'Každá píseň na novou stránku'),
          chk('sections', 'Nadpisy slok a refrénů'),
          chk('notes', 'Poznámky (//)'),
          h('h3', {}, 'Pro muzikanty'),
          musChk('Tisknout informace pro muzikanty', '#888', () => o.mus.on, v => { o.mus.on = v; }),
          h('div', { class: 'print-mus' },
            musChk('Akordy', CHORD_COLOR, () => o.mus.chords, v => { o.mus.chords = v; }),
            ...Store.instruments().map(i => musChk(i.name, i.color, () => !!o.mus.inst[i.code], v => { o.mus.inst[i.code] = v; }))),
          h('div', { class: 'row', style: { marginTop: '8px' } },
            h('label', { class: 'f' }, h('span', {}, 'Velikost písma'), (() => { const s = h('select', { class: 'inp' }, [['s', 'malé'], ['m', 'střední'], ['l', 'velké']].map(([v, l]) => h('option', { value: v, selected: o.size === v }, l))); s.onchange = () => { o.size = s.value; }; return s; })()),
            h('label', { class: 'f' }, h('span', {}, 'Sloupce'), (() => { const s = h('select', { class: 'inp' }, [[1, '1'], [2, '2']].map(([v, l]) => h('option', { value: v, selected: +o.cols === v }, l))); s.onchange = () => { o.cols = +s.value; }; return s; })())))));
    const go = await modal({ title: '🖨 Tisk playlistu „' + (pl.name || '') + '“', body, wide: true, buttons: [{ label: 'Zrušit', value: false }, { label: '🖨 Tisknout', value: true, primary: true }] });
    if (!go) return;
    Settings.set('printOpts', o);
    printDocument(buildPrintPlaylist(pl, o));
  },
  exportTxt(pl) {
    const txt = pl.items.map((id, i) => { const s = Store.songs.get(id); return s ? `=== ${i + 1}. ${s.title}${s.artist ? ' – ' + s.artist : ''} ===\n\n${s.text}\n` : ''; }).join('\n\n');
    downloadFile(safeFileName(pl.name) + '.txt', txt, 'text/plain');
  },
};

/* ===== Tisk ===== */
function printDocument(node) {
  let root = $('#print-root');
  if (!root) { root = h('div', { id: 'print-root' }); document.body.appendChild(root); }
  root.innerHTML = '';
  root.appendChild(node);
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); root.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => {
    try { window.print(); } catch (e) { toast('Tisk se nepodařilo spustit.', 'err'); }
    // některé prohlížeče „afterprint“ nevyvolají
    setTimeout(() => { if (document.body.classList.contains('printing')) done(); }, 60000);
  }, 50);
}

function buildPrintPlaylist(pl, o) {
  const songs = pl.items.map(id => Store.songs.get(id)).filter(Boolean);
  const enc = plEncore(pl) >= 0 ? pl.items.slice(0, plEncore(pl)).filter(id => Store.songs.has(id)).length : -1;
  const map = Store.singerMap();
  const dateTxt = pl.date ? new Date(pl.date).toLocaleDateString('cs-CZ') : '';
  const doc = h('div', { class: 'pr ' + 'pr-size-' + o.size + (o.color ? ' pr-color' : ' pr-bw') + (+o.cols === 2 ? ' pr-cols2' : '') });

  if (o.what !== 'texts') {
    const list = h('section', { class: 'pr-setlist' + (o.bigList ? ' big' : '') },
      h('header', {}, h('h1', {}, pl.name || 'Playlist'), h('div', { class: 'pr-meta' }, [dateTxt, pl.note].filter(Boolean).join(' · '))),
      h('table', {}, h('tbody', {}, songs.flatMap((s, i) => [i === enc ? h('tr', { class: 'pr-encore' }, h('td', { colspan: 4 }, 'Přídavky')) : null, h('tr', { class: i >= enc && enc >= 0 ? 'pr-extra' : '' },
        h('td', { class: 'n' }, i + 1 + '.'),
        h('td', { class: 't' }, h('b', {}, s.title), !o.bigList && s.artist ? h('span', { class: 'a' }, ' – ' + s.artist) : null),
        h('td', { class: 'k' }, s.key || ''),
        h('td', { class: 'bpm' }, s.tempo ? s.tempo + ' BPM' : ''))]).filter(Boolean))));
    doc.appendChild(list);
  }

  if (o.what !== 'list') {
    const used = new Set();
    const songEls = songs.map((s, i) => {
      const blocks = filterForView(parseSong(s.text).blocks, o.mus && o.mus.on ? o.mus : null);
      const im = Store.instrumentMap();
      const body = h('div', { class: 'pr-body' });
      for (const b of blocks) {
        if (b.type === 'gap') { body.appendChild(h('div', { class: 'pr-gap' })); continue; }
        if (b.type === 'break') continue;
        if (b.type === 'section') {
          if (!o.sections) continue;
          const sg = b.singers.map(c => map[c]).filter(Boolean);
          body.appendChild(h('div', { class: 'pr-sec' }, b.text, sg.length ? h('span', { class: 'pr-sec-sg' }, ' · ' + sg.map(x => x.name).join(' + ')) : null));
          continue;
        }
        if (b.type === 'note') { if (o.notes) body.appendChild(h('div', { class: 'pr-note', html: inlineHtml(b.text, map) })); continue; }
        if (b.type === 'chords') { body.appendChild(h('div', { class: 'pr-line pr-chords', html: chordedHtml(b.text, map) })); continue; }
        if (b.type === 'mus' || b.type === 'musblock') {
          const ins = b.inst.map(c => im[c]).filter(Boolean);
          const tag = h('span', { class: 'pr-mtag', style: { '--ic': ins[0] ? ins[0].color : '#888' } }, ins.map(x => x.name).join(' + ') || b.inst.join('+'));
          if (b.type === 'mus') body.appendChild(h('div', { class: 'pr-mus' }, tag, h('span', { html: ' ' + (hasChords(b.text) ? chordedHtml(b.text, map) : inlineHtml(b.text, map)) })));
          else body.appendChild(h('div', { class: 'pr-musblock' }, h('div', {}, tag, b.title ? ' ' + b.title : ''), h('pre', {}, b.lines.join('\n'))));
          continue;
        }
        const sgs = b.singers.map(c => map[c]).filter(Boolean);
        sgs.forEach(x => used.add(x.code));
        const line = h('div', { class: 'pr-line' + (sgs.length ? ' has-sg' : '') });
        if (sgs.length) {
          line.style.setProperty('--bar', stripes(sgs.map(x => x.color)));
          line.appendChild(h('span', { class: 'pr-who' }, sgs.map(x => x.name).join('+')));
        }
        const txt = h('span', { class: 'pr-txt' + (b.showChords ? ' with-chords' : ''), html: b.showChords ? chordedHtml(b.text, map) : (inlineHtml(b.chords ? stripChords(b.text) : b.text, map) || '&nbsp;') });
        for (const sp of txt.querySelectorAll('.sg-in')) sp.style.textDecorationColor = sp.style.color;
        if (sgs.some(x => x.bold)) txt.style.fontWeight = 700;
        line.appendChild(txt);
        body.appendChild(line);
      }
      return h('article', { class: 'pr-song' + (o.pageBreak ? ' pb' : '') },
        h('header', {},
          h('div', { class: 'pr-num' }, String(i + 1)),
          h('div', { class: 'pr-title' }, h('h2', {}, s.title), s.artist ? h('div', { class: 'pr-artist' }, s.artist) : null),
          h('div', { class: 'pr-keys' }, [s.key ? 'ladění ' + s.key : '', s.tempo ? s.tempo + ' BPM' : ''].filter(Boolean).join(' · '))),
        body);
    });
    const legend = h('div', { class: 'pr-legend' }, 'Zpěváci: ', [...used].map(c => map[c]).filter(Boolean).map(x =>
      h('span', { class: 'pr-leg', style: { '--bar': x.color } }, h('span', { class: 'pr-who' }, x.name))));
    const head = h('header', { class: 'pr-texts-head' + (o.what === 'both' ? ' pb-before' : '') }, h('h1', {}, (pl.name || 'Playlist') + ' – texty'), h('div', { class: 'pr-meta' }, dateTxt), used.size ? legend : null);
    doc.append(head, ...songEls);
  }
  doc.appendChild(h('footer', { class: 'pr-foot' }, `PROMPTER mini · ${pl.name || ''} · vytištěno ${new Date().toLocaleDateString('cs-CZ')}`));
  return doc;
}
