'use strict';
/* ===== Kalendář kapely: koncerty, zkoušky a další akce, potvrzení účasti, nepřítomnost =====
   Akce i nepřítomnost jsou ve sdílené kolekci „events“. Potvrzení účasti má každý člen
   ve vlastním souboru (kolekce „rsvps“, id = akce--člen), takže se odpovědi nepřepisují. */

const EVENT_TYPES = [
  { id: 'concert', name: 'Koncert', color: '#e8493f' },
  { id: 'rehearsal', name: 'Zkouška', color: '#4fc3f7' },
  { id: 'recording', name: 'Nahrávání', color: '#b39ddb' },
  { id: 'other', name: 'Jiné', color: '#a5a5aa' },
];
const EVENT_STATUS = [['confirmed', 'Potvrzeno'], ['tentative', 'Předběžně'], ['cancelled', 'Zrušeno']];
const FEE_STATUS = [['', '—'], ['agreed', 'Dohodnuto'], ['invoiced', 'Vyfakturováno'], ['paid', 'Zaplaceno']];
const ANSWERS = [['yes', 'Jedu', '✓'], ['maybe', 'Možná', '?'], ['no', 'Nejedu', '✕']];
const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
const WDAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const MEMBER_COLORS = ['#ffd23f', '#4fc3f7', '#7cfc9a', '#ff8a65', '#b39ddb', '#f48fb1', '#80cbc4', '#e6ee9c'];

const Band = {
  members() { return ((Store.config.get('members') || {}).list) || []; },
  member(id) { return this.members().find(m => m.id === id); },
  me() { return this.member(Settings.get('memberId')); },
  async saveMembers(list) { await Store.put('config', { id: 'members', list }); },
  events() { return [...Store.events.values()].filter(e => e.kind !== 'away'); },
  aways() { return [...Store.events.values()].filter(e => e.kind === 'away'); },
  rsvp(evId, memberId) { return Store.rsvps.get(evId + '--' + memberId); },
  rsvpsOf(evId) { return [...Store.rsvps.values()].filter(r => r.event === evId); },
  async answer(evId, memberId, answer, note) {
    const id = evId + '--' + memberId;
    const old = Store.rsvps.get(id) || {};
    await Store.put('rsvps', Object.assign({}, old, { id, event: evId, member: memberId, answer, note: note ?? old.note ?? '' }));
  },
  /* kdo je ten den nepřítomen */
  awayOn(date) { return this.aways().filter(a => a.date <= date && (a.dateEnd || a.date) >= date); },
  async removeEvent(ev) {
    for (const r of this.rsvpsOf(ev.id)) await Store.remove('rsvps', r.id, { silent: true });
    await Store.remove('events', ev.id);
  },
};

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => ymd(new Date());
const evType = id => EVENT_TYPES.find(t => t.id === id) || EVENT_TYPES[3];
function czDate(s, opts) {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('cs-CZ', opts || { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' });
}
const money = v => (v === '' || v == null || isNaN(+v)) ? '' : (+v).toLocaleString('cs-CZ') + ' Kč';

/* ----- Export do kalendáře v telefonu (.ics) ----- */
function icsEscape(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
function icsFor(list) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const dt = (date, time) => date.replace(/-/g, '') + (time ? 'T' + time.replace(':', '') + '00' : '');
  const addDay = date => { const [y, m, d] = date.split('-').map(Number); return ymd(new Date(y, m - 1, d + 1)); };
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Prompter kapely//CS', 'CALSCALE:GREGORIAN'];
  for (const e of list) {
    const start = e.arrive || e.start, end = e.end;
    out.push('BEGIN:VEVENT', 'UID:' + e.id + '@prompter', 'DTSTAMP:' + stamp,
      start ? 'DTSTART:' + dt(e.date, start) : 'DTSTART;VALUE=DATE:' + dt(e.date),
      start ? (end ? 'DTEND:' + dt(end < start ? addDay(e.dateEnd || e.date) : (e.dateEnd || e.date), end) : '') : 'DTEND;VALUE=DATE:' + dt(addDay(e.dateEnd || e.date)),
      'SUMMARY:' + icsEscape(evType(e.type).name + ': ' + (e.title || '')),
      e.place || e.address ? 'LOCATION:' + icsEscape([e.place, e.address].filter(Boolean).join(', ')) : '',
      'DESCRIPTION:' + icsEscape([
        e.arrive ? 'Příjezd ' + e.arrive : '', e.soundcheck ? 'Zvuková zkouška ' + e.soundcheck : '', e.start ? 'Začátek ' + e.start : '', e.end ? 'Konec ' + e.end : '',
        e.withBands ? 'Hrajeme s: ' + e.withBands : '', e.organizer ? 'Pořadatel: ' + e.organizer + (e.contact ? ' (' + e.contact + ')' : '') : '',
        e.fee ? 'Honorář: ' + money(e.fee) : '', e.note || ''].filter(Boolean).join('\n')),
      e.status === 'cancelled' ? 'STATUS:CANCELLED' : e.status === 'tentative' ? 'STATUS:TENTATIVE' : 'STATUS:CONFIRMED',
      'END:VEVENT');
  }
  out.push('END:VCALENDAR');
  return out.filter(Boolean).join('\r\n');
}

const CalendarView = {
  mode: null, month: null, selected: null, selDay: null,

  render(main, param) {
    if (!this.mode) this.mode = Settings.get('calMode') || 'month';
    if (!this.month) { const d = new Date(); this.month = [d.getFullYear(), d.getMonth()]; }
    if (param && Store.events.has(param)) { this.selected = param; const e = Store.events.get(param); const [y, m] = e.date.split('-').map(Number); this.month = [y, m - 1]; }
    const side = h('div', { class: 'side big-list cal-list' });
    main.append(h('div', { class: 'view list-only' }, side, h('div', { class: 'content' })));
    const body = h('div', { class: 'cal-body' });
    const monthLbl = h('b', { class: 'cal-month' });
    const prev = h('div', { class: 'pl-prev cal-prev' });
    const total = h('span', {});
    const navBox = h('div', { class: 'cal-nav' },
      h('button', { class: 'btn icon', title: 'Předchozí měsíc', onclick: () => this.shift(-1) }, '◀'),
      monthLbl,
      h('button', { class: 'btn icon', title: 'Další měsíc', onclick: () => this.shift(1) }, ic('right')),
      h('button', { class: 'btn small', onclick: () => { const d = new Date(); this.month = [d.getFullYear(), d.getMonth()]; this.selDay = today(); this.paint(); } }, 'Dnes'));
    side.append(h('div', { class: 'pl-split' },
      h('div', { class: 'pl-main' },
        h('div', { class: 'sl-titlebar' }, h('h1', {}, 'Kalendář'), total),
        h('div', { class: 'side-head sl-head' },
          h('button', { class: 'btn primary', onclick: () => this.edit(null) }, '＋ Nová akce'),
          h('button', { class: 'btn', title: 'Kdy nemůžu (dovolená, nemoc…)', onclick: () => this.editAway(null) }, 'Nemůžu…'),
          h('button', { class: 'btn', title: 'Členové kapely a kdo jsem já', onclick: () => this.membersDlg() }, '👥 Členové'),
          h('span', { class: 'sl-push' }),
          segControl([['month', 'Měsíc'], ['list', 'Seznam']], this.mode, v => { this.mode = v; Settings.set('calMode', v); this.paint(); }),
          h('button', { class: 'btn', title: 'Stáhnout nadcházející akce do kalendáře v telefonu / Outlooku', onclick: () => this.exportIcs(Band.events().filter(e => (e.dateEnd || e.date) >= today())) }, '⇩ Do kalendáře')),
        navBox, body),
      prev));
    this.els = { body, monthLbl, prev, total, navBox, side };
    this.mOpen = false;
    this.paintSide = () => this.paint();
    this.paint();
    if (!Band.me() && Band.members().length) setTimeout(() => toast('Vyber v „Členové“, kdo jsi – pak můžeš potvrzovat účast.', 'info', 5000), 300);
  },

  shift(d) { let [y, m] = this.month; m += d; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } this.month = [y, m]; this.paint(); },

  paint() {
    const { body, monthLbl, total, navBox } = this.els;
    const evs = Band.events();
    const up = evs.filter(e => (e.dateEnd || e.date) >= today() && e.status !== 'cancelled');
    total.textContent = up.length ? `${up.length} nadcházejících` : 'žádné nadcházející akce';
    body.innerHTML = '';
    navBox.hidden = this.mode !== 'month';
    if (this.mode === 'month') this.paintMonth(body, monthLbl);
    else this.paintList(body);
    if (this.selected && !Store.events.has(this.selected)) this.selected = null;
    if (!this.selected && this.mode === 'list') { const n = up.sort((a, b) => a.date.localeCompare(b.date))[0]; if (n) this.selected = n.id; }
    this.paintPrev();
  },

  chip(e) {
    const t = evType(e.type);
    const my = Band.me() && Band.rsvp(e.id, Band.me().id);
    return h('button', { class: 'cal-chip' + (e.id === this.selected ? ' on' : '') + (e.status === 'cancelled' ? ' cancelled' : '') + (e.status === 'tentative' ? ' tentative' : ''), style: { '--c': t.color }, 'data-id': e.id,
      title: `${t.name}: ${e.title || ''}`, onclick: ev => { ev.stopPropagation(); this.select(e.id); } },
    e.start ? h('span', { class: 'cal-t' }, e.start) : null, h('span', { class: 'cal-n' }, e.title || t.name),
    my ? h('span', { class: 'cal-my ' + my.answer }, (ANSWERS.find(a => a[0] === my.answer) || [])[2] || '') : null);
  },

  paintMonth(body, monthLbl) {
    const [y, m] = this.month;
    monthLbl.textContent = MONTHS[m] + ' ' + y;
    const first = new Date(y, m, 1);
    const start = new Date(y, m, 1 - ((first.getDay() + 6) % 7));
    const grid = h('div', { class: 'cal-grid' }, WDAYS.map(d => h('div', { class: 'cal-wd' }, d)));
    const byDay = {};
    for (const e of Band.events()) {
      const [a, b] = [e.date, e.dateEnd || e.date];
      for (let d = new Date(...a.split('-').map((v, i) => i === 1 ? v - 1 : +v)); ymd(d) <= b; d.setDate(d.getDate() + 1)) (byDay[ymd(d)] = byDay[ymd(d)] || []).push(e);
    }
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = ymd(d);
      const away = Band.awayOn(key);
      const cell = h('div', { class: 'cal-day' + (d.getMonth() !== m ? ' out' : '') + (key === today() ? ' today' : '') + (key === this.selDay ? ' sel' : '') + (d.getDay() % 6 === 0 ? ' we' : ''), 'data-date': key,
        onclick: () => { this.selDay = key; this.selected = null; this.paint(); }, ondblclick: () => this.edit(null, key) },
      h('span', { class: 'cal-dn' }, d.getDate()),
      ...(byDay[key] || []).sort((a, b) => (a.start || '').localeCompare(b.start || '')).map(e => this.chip(e)),
      away.length ? h('div', { class: 'cal-away', title: 'Nemůže: ' + away.map(a => (Band.member(a.member) || {}).name || '?').join(', '), onclick: ev => { ev.stopPropagation(); this.select(away[0].id); } },
        '✕ ' + away.map(a => (Band.member(a.member) || {}).name || '?').join(', ')) : null);
      grid.appendChild(cell);
    }
    body.appendChild(grid);
  },

  paintList(body) {
    const list = Band.events().filter(e => (e.dateEnd || e.date) >= today()).sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || ''));
    const past = Band.events().filter(e => (e.dateEnd || e.date) < today()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
    const row = e => {
      const t = evType(e.type);
      const rs = Band.rsvpsOf(e.id);
      const cnt = a => rs.filter(r => r.answer === a).length;
      const my = Band.me() && Band.rsvp(e.id, Band.me().id);
      const [yy, mm, dd] = e.date.split('-').map(Number);
      return h('div', { class: 'item cal-row' + (e.id === this.selected ? ' active' : '') + (e.status === 'cancelled' ? ' cancelled' : ''), 'data-id': e.id, onclick: () => this.select(e.id), ondblclick: () => this.edit(e) },
        h('div', { class: 'cal-date', style: { '--c': t.color } }, h('b', {}, dd), h('span', {}, MONTHS[mm - 1].slice(0, 3)), h('small', {}, WDAYS[(new Date(yy, mm - 1, dd).getDay() + 6) % 7])),
        h('div', { class: 'cal-rt' }, h('b', {}, e.title || t.name), h('span', {}, [t.name, e.start ? e.start + (e.end ? '–' + e.end : '') : '', e.place].filter(Boolean).join(' · ')),
          e.status !== 'confirmed' ? h('span', { class: 'cal-st ' + e.status }, (EVENT_STATUS.find(s => s[0] === e.status) || [])[1]) : null),
        h('div', { class: 'cal-cnt' }, h('span', { class: 'yes' }, '✓ ' + cnt('yes')), h('span', { class: 'maybe' }, '? ' + cnt('maybe')), h('span', { class: 'no' }, '✕ ' + cnt('no'))),
        h('div', { class: 'cal-my ' + (my ? my.answer : 'none') }, my ? (ANSWERS.find(a => a[0] === my.answer) || [])[1] : Band.me() ? 'nepotvrzeno' : ''));
    };
    if (!list.length) body.appendChild(h('div', { class: 'help', style: { padding: '16px 22px' } }, 'Žádné nadcházející akce. Přidej koncert nebo zkoušku tlačítkem „＋ Nová akce“.'));
    body.append(...list.map(row));
    if (past.length) body.append(h('div', { class: 'cal-sep' }, 'Proběhlé'), ...past.map(row));
  },

  /* v telefonu se podrobnosti akce otevřou přes celou obrazovku */
  select(id) { this.selected = id; if (matchMedia('(max-width: 820px)').matches) this.mOpen = true; this.paint(); },

  paintPrev() {
    const prev = this.els.prev;
    prev.innerHTML = '';
    this.els.side.classList.toggle('m-open', this.mOpen);
    if (this.mOpen) prev.appendChild(h('button', { class: 'btn pl-back cal-back', onclick: () => { this.mOpen = false; this.paint(); } }, '◀ Kalendář'));
    const e = this.selected && Store.events.get(this.selected);
    if (!e) {
      const day = this.selDay;
      prev.append(h('div', { class: 'help pl-prev-empty' }, day ? czDate(day, { weekday: 'long', day: 'numeric', month: 'long' }) + ': nic naplánováno.' : 'Klikni na akci a tady uvidíš podrobnosti a kdo jede.'),
        day ? h('div', { class: 'pl-prev-btns two' }, h('button', { class: 'btn primary', onclick: () => this.edit(null, day) }, '＋ Akce tento den'), h('button', { class: 'btn', onclick: () => this.editAway(null, day) }, 'Nemůžu tento den')) : null);
      return;
    }
    if (e.kind === 'away') return this.paintAway(prev, e);
    const t = evType(e.type);
    const row = (k, v) => v ? h('div', { class: 'cal-kv' }, h('span', {}, k), h('b', {}, v)) : null;
    const pl = e.playlistId && Store.playlists.get(e.playlistId);
    const away = Band.awayOn(e.date).map(a => a.member);
    const me = Band.me();
    const my = me && Band.rsvp(e.id, me.id);
    const note = h('input', { class: 'inp', placeholder: 'Poznámka (přijedu později, beru auto…)', value: (my && my.note) || '' });
    note.onchange = () => { if (my) Band.answer(e.id, me.id, my.answer, note.value); };
    const mapUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([e.place, e.address].filter(Boolean).join(', '));
    prev.append(
      h('div', { class: 'pl-prev-head' },
        h('div', { class: 'cal-badges' }, h('span', { class: 'cal-badge', style: { '--c': t.color } }, t.name), e.status !== 'confirmed' ? h('span', { class: 'cal-st ' + e.status }, (EVENT_STATUS.find(s => s[0] === e.status) || [])[1]) : null),
        h('h3', {}, e.title || t.name),
        h('div', { class: 'pl-prev-meta' }, czDate(e.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + (e.dateEnd && e.dateEnd !== e.date ? ' – ' + czDate(e.dateEnd) : ''))),
      h('div', { class: 'cal-kvs' },
        row('Příjezd', e.arrive), row('Zvuková zkouška', e.soundcheck), row('Začátek', e.start), row('Konec', e.end),
        e.place || e.address ? h('div', { class: 'cal-kv' }, h('span', {}, 'Místo'), h('b', {}, [e.place, e.address].filter(Boolean).join(', '), ' ', h('a', { href: mapUrl, target: '_blank', rel: 'noopener' }, 'mapa'))) : null,
        row('Hrajeme s', e.withBands),
        e.organizer || e.contact ? h('div', { class: 'cal-kv' }, h('span', {}, 'Pořadatel'), h('b', {}, [e.organizer, e.contact].filter(Boolean).join(' · '),
          /\+?\d[\d ]{7,}/.test(e.contact || '') ? h('a', { href: 'tel:' + (e.contact.match(/\+?\d[\d ]{7,}/)[0]).replace(/\s/g, '') }, ' volat') : null)) : null,
        e.fee ? row('Honorář', money(e.fee) + (e.feeStatus ? ' · ' + (FEE_STATUS.find(f => f[0] === e.feeStatus) || [])[1] : '') + (e.feeNote ? ' · ' + e.feeNote : '')) : null,
        pl ? h('div', { class: 'cal-kv' }, h('span', {}, 'Setlist'), h('b', {}, h('a', { href: '#/playlists/' + pl.id }, pl.name), ` (${pl.items.length} písní) `, h('a', { href: '#/reader/' + pl.id }, '▶ čtečka'))) : null,
        e.note ? h('p', { class: 'cal-note' }, e.note) : null),
      h('div', { class: 'ep-lbl' }, 'Moje účast'),
      me ? h('div', { class: 'segc cal-ans' }, ANSWERS.map(([v, l, s]) => h('button', { class: v + (my && my.answer === v ? ' on' : ''), onclick: () => Band.answer(e.id, me.id, v, note.value) }, s + ' ' + l))) :
        h('div', { class: 'help' }, h('button', { class: 'linkbtn', onclick: () => this.membersDlg() }, 'Vyber, kdo jsi'), ' – pak můžeš potvrdit účast.'),
      me ? note : null,
      h('div', { class: 'ep-lbl' }, 'Kdo jede'),
      Band.members().length ? h('div', { class: 'cal-who' }, Band.members().map(m => {
        const r = Band.rsvp(e.id, m.id);
        const a = r ? r.answer : away.includes(m.id) ? 'away' : 'none';
        const lbl = { yes: 'jede', maybe: 'možná', no: 'nejede', away: 'nemůže (nepřítomnost)', none: 'zatím neodpověděl(a)' }[a];
        return h('div', { class: 'cal-m ' + a }, h('i', { style: { background: m.color } }), h('b', {}, m.name), h('span', {}, lbl + (r && r.note ? ' – ' + r.note : '')));
      })) : h('div', { class: 'help' }, 'Zatím nejsou zadaní členové kapely. ', h('button', { class: 'linkbtn', onclick: () => this.membersDlg() }, 'Přidat členy')),
      h('div', { class: 'pl-prev-btns' },
        h('button', { class: 'btn primary', onclick: () => this.edit(e) }, '✎ Upravit'),
        h('button', { class: 'btn', title: 'Uložit do kalendáře v telefonu', onclick: () => this.exportIcs([e]) }, '⇩ .ics'),
        h('button', { class: 'btn', title: 'Vytvořit kopii (např. další zkouška)', onclick: () => this.duplicate(e) }, '⧉ Kopie'),
        h('button', { class: 'btn danger', onclick: async () => { if (await confirmDlg(`Smazat akci „${e.title || t.name}“?`, 'Smazat', true)) { await Band.removeEvent(e); this.selected = null; this.paint(); } } }, '🗑')));
  },

  paintAway(prev, a) {
    const m = Band.member(a.member);
    prev.append(h('div', { class: 'pl-prev-head' }, h('h3', {}, (m ? m.name : '?') + ' nemůže'),
      h('div', { class: 'pl-prev-meta' }, czDate(a.date) + (a.dateEnd && a.dateEnd !== a.date ? ' – ' + czDate(a.dateEnd) : ''))),
    a.note ? h('p', { class: 'cal-note' }, a.note) : null,
    h('div', { class: 'pl-prev-btns' }, h('button', { class: 'btn', onclick: () => this.editAway(a) }, '✎ Upravit'),
      h('button', { class: 'btn danger', onclick: async () => { await Store.remove('events', a.id); this.selected = null; this.paint(); } }, '🗑 Smazat')));
  },

  async duplicate(e) {
    const c = Object.assign(clone(e), { id: uid() });
    delete c.updatedAt;
    const d = await promptDlg('Datum kopie (RRRR-MM-DD)', e.date);
    if (!d) return;
    c.date = d; c.dateEnd = '';
    await Store.put('events', c);
    this.select(c.id);
  },

  exportIcs(list) {
    if (!list.length) return toast('Žádné akce k exportu', 'warn');
    downloadFile(list.length === 1 ? `akce-${list[0].date}.ics` : 'kapela-akce.ics', icsFor(list), 'text/calendar');
    toast('Soubor .ics stažen – otevři ho a přidej do kalendáře.', 'ok');
  },

  /* ----- Úprava akce ----- */
  async edit(e, date) {
    const ev = e ? clone(e) : { id: uid(), type: 'concert', status: 'confirmed', date: date || this.selDay || today(), title: '' };
    const f = (label, el, cls) => h('label', { class: 'f' + (cls ? ' ' + cls : '') }, h('span', {}, label), el);
    const inp = (k, type = 'text', ph = '') => { const i = h('input', { class: 'inp', type, value: ev[k] || '', placeholder: ph }); i.oninput = () => { ev[k] = i.value; }; return i; };
    const sel = (k, opts) => { const s = h('select', { class: 'inp' }, opts.map(([v, l]) => h('option', { value: v, selected: (ev[k] || '') === v }, l))); s.onchange = () => { ev[k] = s.value; }; return s; };
    const plOpts = [['', '— bez setlistu —'], ...Store.sortedPlaylists().map(p => [p.id, p.name + (p.date ? ' · ' + p.date : '')])];
    const noteTa = h('textarea', { class: 'inp', rows: 3, placeholder: 'Dress code, parkování, jídlo, kdo veze aparát…' }, ev.note || '');
    noteTa.oninput = () => { ev.note = noteTa.value; };
    const body = h('div', { class: 'cal-form' },
      h('div', { class: 'grid3' }, f('Druh', sel('type', EVENT_TYPES.map(t => [t.id, t.name]))), f('Stav', sel('status', EVENT_STATUS)), f('Název', inp('title', 'text', 'např. Rock Café, Praha'))),
      h('div', { class: 'grid3' }, f('Datum', inp('date', 'date')), f('Do (vícedenní)', inp('dateEnd', 'date')), f('Setlist (playlist)', sel('playlistId', plOpts))),
      h('div', { class: 'cal-times' }, f('Příjezd', inp('arrive', 'time')), f('Zvuková zkouška', inp('soundcheck', 'time')), f('Začátek', inp('start', 'time')), f('Konec', inp('end', 'time'))),
      h('div', { class: 'grid2' }, f('Místo', inp('place', 'text', 'klub, sál, zkušebna')), f('Adresa', inp('address', 'text', 'ulice, město'))),
      h('div', { class: 'grid2' }, f('Pořadatel', inp('organizer')), f('Kontakt (telefon, e-mail)', inp('contact'))),
      f('Hrajeme s (další kapely)', inp('withBands', 'text', 'Kapela A, Kapela B')),
      h('div', { class: 'grid3' }, f('Honorář (Kč)', inp('fee', 'number')), f('Stav honoráře', sel('feeStatus', FEE_STATUS)), f('Poznámka k honoráři', inp('feeNote', 'text', 'faktura / hotově / +občerstvení'))),
      f('Poznámka', noteTa));
    const ok = await modal({ title: e ? 'Upravit akci' : 'Nová akce', body, wide: true, buttons: [{ label: 'Zrušit', value: false }, { label: 'Uložit', primary: true, value: true }] });
    if (!ok) return;
    if (!ev.date) return toast('Akce musí mít datum', 'err');
    if (ev.dateEnd && ev.dateEnd < ev.date) ev.dateEnd = '';
    await Store.put('events', ev);
    const [y, m] = ev.date.split('-').map(Number); this.month = [y, m - 1];
    this.select(ev.id);
  },

  async editAway(a, date) {
    const members = Band.members();
    if (!members.length) { toast('Nejdřív přidej členy kapely.', 'warn'); return this.membersDlg(); }
    const ev = a ? clone(a) : { id: uid(), kind: 'away', member: (Band.me() || members[0]).id, date: date || this.selDay || today(), dateEnd: '', note: '' };
    const mSel = h('select', { class: 'inp' }, members.map(m => h('option', { value: m.id, selected: m.id === ev.member }, m.name)));
    const from = h('input', { class: 'inp', type: 'date', value: ev.date }), to = h('input', { class: 'inp', type: 'date', value: ev.dateEnd || '' });
    const note = h('input', { class: 'inp', value: ev.note || '', placeholder: 'dovolená, nemoc, služba…' });
    const ok = await modal({ title: 'Kdy nemůžu', body: h('div', { class: 'cal-form' },
      h('label', { class: 'f' }, h('span', {}, 'Kdo'), mSel), h('div', { class: 'grid2' }, h('label', { class: 'f' }, h('span', {}, 'Od'), from), h('label', { class: 'f' }, h('span', {}, 'Do (včetně)'), to)),
      h('label', { class: 'f' }, h('span', {}, 'Důvod (nepovinné)'), note)), buttons: [{ label: 'Zrušit', value: false }, { label: 'Uložit', primary: true, value: true }] });
    if (!ok || !from.value) return;
    Object.assign(ev, { member: mSel.value, date: from.value, dateEnd: to.value >= from.value ? to.value : '', note: note.value });
    await Store.put('events', ev);
    this.select(ev.id);
  },

  /* ----- Členové kapely a „kdo jsem já“ (volba se ukládá jen v tomto zařízení) ----- */
  async membersDlg() {
    const list = clone(Band.members());
    let meId = Settings.get('memberId') || '';
    const box = h('div', { class: 'cal-members' });
    const paint = () => {
      box.innerHTML = '';
      list.forEach((m, i) => {
        const name = h('input', { class: 'inp', value: m.name, placeholder: 'Jméno' });
        name.oninput = () => { m.name = name.value; };
        const role = h('input', { class: 'inp', value: m.role || '', placeholder: 'nástroj / role' });
        role.oninput = () => { m.role = role.value; };
        const color = h('input', { type: 'color', value: m.color });
        color.oninput = () => { m.color = color.value; };
        box.appendChild(h('div', { class: 'cal-mrow' },
          h('label', { class: 'chk', title: 'Toto jsem já (jen na tomto zařízení)' }, h('input', { type: 'radio', name: 'me', checked: m.id === meId, onchange: () => { meId = m.id; } }), 'já'),
          color, name, role,
          h('button', { class: 'btn small icon danger', title: 'Odebrat', onclick: () => { list.splice(i, 1); if (meId === m.id) meId = ''; paint(); } }, '✕')));
      });
      box.appendChild(h('button', { class: 'btn small', onclick: () => { list.push({ id: 'm' + uid(), name: '', role: '', color: MEMBER_COLORS[list.length % MEMBER_COLORS.length] }); paint(); setTimeout(() => { const ins = $$('.cal-mrow input.inp', box); if (ins.length) ins[ins.length - 2].focus(); }, 0); } }, '＋ Přidat člena'));
    };
    if (!list.length) list.push({ id: 'm' + uid(), name: currentUserName() === 'místní' ? '' : currentUserName(), role: '', color: MEMBER_COLORS[0] });
    paint();
    const ok = await modal({ title: '👥 Členové kapely', body: h('div', {}, h('p', { class: 'help' }, 'Seznam se sdílí s celou kapelou. Označ „já“ u sebe – tato volba platí jen na tomto zařízení.'), box),
      buttons: [{ label: 'Zrušit', value: false }, { label: 'Uložit', primary: true, value: true }] });
    if (!ok) return;
    const clean = list.filter(m => m.name.trim()).map(m => Object.assign(m, { name: m.name.trim() }));
    await Band.saveMembers(clean);
    if (meId && clean.some(m => m.id === meId)) Settings.set('memberId', meId);
    this.paint();
  },
};
