'use strict';
/* ===== Playlisty ===== */
const PlaylistsView = {
  libSearch: '',

  render(main, plId) {
    const side = h('div', { class: 'side' });
    const content = h('div', { class: 'content' });
    main.append(h('div', { class: 'view' + (plId ? ' has-detail' : '') }, side, content));
    // na mobilu: zpět na seznam
    content.appendChild(h('button', { class: 'btn m-back', onclick: () => { location.hash = '#/playlists'; } }, '◀ Playlisty'));
    const list = h('div', { class: 'list' });
    side.append(h('div', { class: 'side-head' }, h('button', { class: 'btn primary', onclick: () => this.create() }, '＋ Nový playlist')), list);
    this.paintSide = () => {
      list.innerHTML = '';
      for (const p of Store.sortedPlaylists()) {
        list.appendChild(h('div', { class: 'item' + (p.id === plId ? ' active' : ''), onclick: () => { location.hash = '#/playlists/' + p.id; } },
          h('div', { class: 't' }, h('b', {}, p.name || '(bez názvu)'),
            h('small', {}, [p.date ? new Date(p.date).toLocaleDateString('cs-CZ') : '', p.items.length + ' písní'].filter(Boolean).join(' · '))),
          h('button', { class: 'btn small icon', title: 'Spustit ve čtečce', onclick: e => { e.stopPropagation(); location.hash = '#/reader/' + p.id; } }, '▶')));
      }
      if (!Store.playlists.size) list.appendChild(h('div', { class: 'help', style: { padding: '12px' } }, 'Zatím žádné playlisty.'));
    };
    this.paintSide();

    const pl = plId && Store.playlists.get(plId);
    if (!pl) {
      content.appendChild(h('div', { class: 'empty' }, h('div', { class: 'big' }, '📋'),
        'Playlist = seznam písní v pořadí, jak je budete hrát.',
        h('button', { class: 'btn primary big', onclick: () => this.create() }, '＋ Nový playlist')));
      return;
    }
    this.editor(content, pl);
  },

  async create() {
    const name = await promptDlg('Název playlistu', 'Koncert ' + new Date().toLocaleDateString('cs-CZ'));
    if (!name) return;
    const p = await Store.put('playlists', { id: uid(), name, date: new Date().toISOString().slice(0, 10), templateId: '', note: '', items: [] });
    location.hash = '#/playlists/' + p.id;
  },

  editor(root, pl) {
    const save = debounce(() => Store.put('playlists', pl), 600);
    const f = (label, el) => h('label', { class: 'f' }, h('span', {}, label), el);
    const inName = h('input', { class: 'inp', value: pl.name || '' });
    const inDate = h('input', { class: 'inp', type: 'date', value: pl.date || '' });
    const inTpl = h('select', { class: 'inp' }, h('option', { value: '' }, '— dle písně / výchozí —'),
      [...Store.templates.values()].map(t => h('option', { value: t.id, selected: t.id === pl.templateId }, t.name)));
    const inNote = h('input', { class: 'inp', value: pl.note || '', placeholder: 'místo, čas, poznámka…' });
    inName.oninput = () => { pl.name = inName.value; save(); };
    inDate.onchange = () => { pl.date = inDate.value; save(); };
    inTpl.onchange = () => { pl.templateId = inTpl.value; save(); };
    inNote.oninput = () => { pl.note = inNote.value; save(); };

    const itemsBox = h('div', { class: 'list' });
    const libBox = h('div', { class: 'list' });
    const countLbl = h('span', { class: 'dim' });
    const libSearch = h('input', { class: 'inp', type: 'search', placeholder: 'Hledat píseň…', value: this.libSearch });

    const commit = () => { Store.put('playlists', pl); paintItems(); paintLib(); };
    let dragFrom = null;

    const paintItems = () => {
      itemsBox.innerHTML = '';
      countLbl.textContent = `${pl.items.length} písní`;
      pl.items.forEach((id, i) => {
        const s = Store.songs.get(id);
        const el = h('div', { class: 'pl-item', draggable: 'true' },
          h('span', { class: 'num' }, i + 1 + '.'),
          h('div', { class: 't' }, h('b', {}, s ? s.title : '(smazaná píseň)'), ' ', h('span', { class: 'dim' }, s ? [s.artist, s.key].filter(Boolean).join(' · ') : '')),
          h('button', { class: 'btn small icon', title: 'Nahoru', onclick: () => { if (i > 0) { pl.items.splice(i - 1, 0, pl.items.splice(i, 1)[0]); commit(); } } }, '↑'),
          h('button', { class: 'btn small icon', title: 'Dolů', onclick: () => { if (i < pl.items.length - 1) { pl.items.splice(i + 1, 0, pl.items.splice(i, 1)[0]); commit(); } } }, '↓'),
          h('button', { class: 'btn small icon', title: 'Upravit píseň', onclick: () => { location.hash = '#/songs/' + id; } }, '✎'),
          h('button', { class: 'btn small icon', title: 'Spustit od této písně', onclick: () => { location.hash = `#/reader/${pl.id}/${i}`; } }, '▶'),
          h('button', { class: 'btn small icon danger', title: 'Odebrat z playlistu', onclick: () => { pl.items.splice(i, 1); commit(); } }, '✕'));
        el.addEventListener('dragstart', e => { dragFrom = { from: i }; el.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); });
        el.addEventListener('dragend', () => el.classList.remove('drag'));
        el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('over'); });
        el.addEventListener('dragleave', () => el.classList.remove('over'));
        el.addEventListener('drop', e => {
          e.preventDefault(); e.stopPropagation(); el.classList.remove('over');
          if (dragFrom && dragFrom.from !== undefined) {
            const [m] = pl.items.splice(dragFrom.from, 1);
            pl.items.splice(dragFrom.from < i ? i - 1 : i, 0, m);
          } else if (dragFrom && dragFrom.songId) pl.items.splice(i, 0, dragFrom.songId);
          dragFrom = null; commit();
        });
        el.addEventListener('dblclick', () => { location.hash = `#/reader/${pl.id}/${i}`; });
        itemsBox.appendChild(el);
      });
      if (!pl.items.length) itemsBox.appendChild(h('div', { class: 'empty', style: { height: 'auto', padding: '40px 10px' } }, 'Přidej písně z knihovny vpravo (＋, dvojklik nebo přetažením).'));
    };
    itemsBox.addEventListener('dragover', e => e.preventDefault());
    itemsBox.addEventListener('drop', e => {
      e.preventDefault();
      if (dragFrom && dragFrom.songId) pl.items.push(dragFrom.songId);
      else if (dragFrom && dragFrom.from !== undefined) pl.items.push(pl.items.splice(dragFrom.from, 1)[0]);
      dragFrom = null; commit();
    });

    const paintLib = () => {
      const q = normalizeForSearch(libSearch.value);
      libBox.innerHTML = '';
      for (const s of Store.sortedSongs()) {
        if (q && !normalizeForSearch([s.title, s.artist, (s.tags || []).join(' ')].join(' ')).includes(q)) continue;
        const inList = pl.items.includes(s.id);
        const el = h('div', { class: 'lib-item', draggable: 'true' },
          h('div', { class: 't' }, h('b', { style: { opacity: inList ? 0.5 : 1 } }, s.title), ' ', h('span', { class: 'dim' }, [s.artist, s.key].filter(Boolean).join(' · ')),
            ' ', (s.tags || []).map(t => h('span', { class: 'tag' }, t))),
          inList ? h('span', { class: 'dim', title: 'Už je v playlistu' }, '✓') : null,
          h('button', { class: 'btn small icon', title: 'Přidat na konec', onclick: () => { pl.items.push(s.id); commit(); } }, '＋'));
        el.addEventListener('dblclick', () => { pl.items.push(s.id); commit(); });
        el.addEventListener('dragstart', e => { dragFrom = { songId: s.id }; e.dataTransfer.setData('text/plain', s.id); });
        libBox.appendChild(el);
      }
    };
    libSearch.addEventListener('input', () => { this.libSearch = libSearch.value; paintLib(); });

    root.append(
      h('div', { class: 'row', style: { marginBottom: '10px' } },
        f('Název playlistu', inName), h('div', { style: { flex: '0 0 160px' } }, f('Datum', inDate)), f('Šablona pro všechny písně', inTpl), f('Poznámka', inNote)),
      h('div', { class: 'bottom-actions', style: { marginBottom: '12px' } },
        h('button', { class: 'btn primary', onclick: () => { location.hash = '#/reader/' + pl.id; } }, '▶ Spustit ve čtečce'),
        h('button', { class: 'btn', onclick: () => this.print(pl) }, '🖨 Tisk'),
        h('button', { class: 'btn', onclick: () => this.duplicate(pl) }, '⧉ Duplikovat'),
        h('button', { class: 'btn', onclick: () => this.exportTxt(pl) }, '⇩ Export textů'),
        h('span', { class: 'grow' }),
        h('span', { class: 'saved-ind' }, pl.updatedBy ? `Upravil(a) ${pl.updatedBy}, ${fmtDate(pl.updatedAt)}` : ''),
        h('button', { class: 'btn danger', onclick: () => this.del(pl) }, '🗑 Smazat')),
      h('div', { class: 'pl-grid' },
        h('div', { class: 'pl-col' }, h('div', { class: 'head' }, h('b', {}, 'Pořadí písní'), countLbl, h('span', { class: 'grow', style: { flex: 1 } }), h('span', { class: 'help' }, 'přetáhni pro změnu pořadí')), itemsBox),
        h('div', { class: 'pl-col' }, h('div', { class: 'head' }, h('b', { style: { whiteSpace: 'nowrap' } }, 'Knihovna'), libSearch), libBox)));
    paintItems(); paintLib();
  },

  async duplicate(pl) {
    const c = clone(pl); c.id = uid(); c.name += ' (kopie)';
    await Store.put('playlists', c);
    location.hash = '#/playlists/' + c.id;
  },
  async del(pl) {
    if (!await confirmDlg(`Smazat playlist „${pl.name}“? Písně zůstanou v knihovně.`, 'Smazat', true)) return;
    await Store.remove('playlists', pl.id);
    location.hash = '#/playlists';
  },
  async print(pl) {
    const o = Object.assign({ what: 'both', bigList: false, color: true, pageBreak: true, size: 'm', cols: 1, notes: true, sections: true }, Settings.get('printOpts') || {});
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
  const map = Store.singerMap();
  const dateTxt = pl.date ? new Date(pl.date).toLocaleDateString('cs-CZ') : '';
  const doc = h('div', { class: 'pr ' + 'pr-size-' + o.size + (o.color ? ' pr-color' : ' pr-bw') + (+o.cols === 2 ? ' pr-cols2' : '') });

  if (o.what !== 'texts') {
    const list = h('section', { class: 'pr-setlist' + (o.bigList ? ' big' : '') },
      h('header', {}, h('h1', {}, pl.name || 'Playlist'), h('div', { class: 'pr-meta' }, [dateTxt, pl.note].filter(Boolean).join(' · '))),
      h('table', {}, h('tbody', {}, songs.map((s, i) => h('tr', {},
        h('td', { class: 'n' }, i + 1 + '.'),
        h('td', { class: 't' }, h('b', {}, s.title), !o.bigList && s.artist ? h('span', { class: 'a' }, ' – ' + s.artist) : null),
        h('td', { class: 'k' }, s.key || ''),
        h('td', { class: 'bpm' }, s.tempo ? s.tempo + ' BPM' : ''))))));
    doc.appendChild(list);
  }

  if (o.what !== 'list') {
    const used = new Set();
    const songEls = songs.map((s, i) => {
      const { blocks } = parseSong(s.text);
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
        const sgs = b.singers.map(c => map[c]).filter(Boolean);
        sgs.forEach(x => used.add(x.code));
        const line = h('div', { class: 'pr-line' + (sgs.length ? ' has-sg' : '') });
        if (sgs.length) {
          line.style.setProperty('--bar', stripes(sgs.map(x => x.color)));
          line.appendChild(h('span', { class: 'pr-who' }, sgs.map(x => x.name).join('+')));
        }
        const txt = h('span', { class: 'pr-txt', html: inlineHtml(b.text, map) || '&nbsp;' });
        for (const sp of txt.querySelectorAll('.sg-in')) sp.style.textDecorationColor = sp.style.color;
        if (sgs.some(x => x.bold)) txt.style.fontWeight = 700;
        line.appendChild(txt);
        body.appendChild(line);
      }
      return h('article', { class: 'pr-song' + (o.pageBreak ? ' pb' : '') },
        h('header', {},
          h('div', { class: 'pr-num' }, String(i + 1)),
          h('div', { class: 'pr-title' }, h('h2', {}, s.title), s.artist ? h('div', { class: 'pr-artist' }, s.artist) : null),
          h('div', { class: 'pr-keys' }, [s.key ? 'tónina ' + s.key : '', s.tempo ? s.tempo + ' BPM' : ''].filter(Boolean).join(' · '))),
        body);
    });
    const legend = h('div', { class: 'pr-legend' }, 'Zpěváci: ', [...used].map(c => map[c]).filter(Boolean).map(x =>
      h('span', { class: 'pr-leg', style: { '--bar': x.color } }, h('span', { class: 'pr-who' }, x.name))));
    const head = h('header', { class: 'pr-texts-head' + (o.what === 'both' ? ' pb-before' : '') }, h('h1', {}, (pl.name || 'Playlist') + ' – texty'), h('div', { class: 'pr-meta' }, dateTxt), used.size ? legend : null);
    doc.append(head, ...songEls);
  }
  doc.appendChild(h('footer', { class: 'pr-foot' }, `Prompter · ${pl.name || ''} · vytištěno ${new Date().toLocaleDateString('cs-CZ')}`));
  return doc;
}
