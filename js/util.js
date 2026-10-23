'use strict';
/* ===== Pomocné funkce ===== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
    }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    if (c instanceof Node) { el.appendChild(c); continue; }
    for (const part of (typeof glyphToIcon === 'function' ? glyphToIcon(c) : [String(c)])) el.appendChild(part instanceof Node ? part : document.createTextNode(part));
  }
  return el;
}

/* Barva z dat (šablona, zpěvák) do HTML/CSS: jen #rgb(a), rgb()/hsl() s čísly, nebo název barvy – nic jiného se do stylu nedostane */
function cssColor(c, fallback = '') {
  c = String(c ?? '').trim();
  return /^#[0-9a-f]{3,8}$/i.test(c) || /^(rgb|hsl)a?\([\d.,%\s/-]+\)$/i.test(c) || /^[a-z]{3,20}$/i.test(c) ? c : fallback;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function uid() {
  const t = Date.now().toString(36);
  const r = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => (b % 36).toString(36)).join('');
  return t + r;
}

/* český tvar podle počtu: plural(3, 'píseň', 'písně', 'písní') → „3 písně“ */
/* Ladění písně jako štítek: každý tón (C D E F G A H B) má svou barvu, křížky/béčka a moll ji nemění */
function keyBadge(key) {
  const k = String(key || '').trim();
  const tone = (/^[a-hA-H]/.exec(k) || [''])[0].toUpperCase();
  return h('span', { class: 'key-badge' + (tone ? ' k-' + tone : ''), title: 'Ladění ' + k }, k);
}
function plural(n, one, few, many) { return n + ' ' + (n === 1 ? one : n >= 2 && n <= 4 ? few : many); }

/* fyzické rozlišení obrazovky, na které je aplikace otevřená */
function screenPx() { return [Math.round(screen.width * devicePixelRatio), Math.round(screen.height * devicePixelRatio)]; }

function isMobile() { return window.matchMedia('(max-width: 820px)').matches; }

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('cs-CZ') + ' ' + d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

function normalizeForSearch(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function hexToRgba(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return `rgba(255,255,255,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function downloadFile(name, content, type = 'application/json') {
  const blob = new Blob([content], { type: type + ';charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* Uložení souboru do zařízení: v programu pro Windows systémové okno Uložit, v prohlížeči výběr místa
   (kde to jde), jinak obyčejné stažení. content = text nebo Uint8Array. */
async function saveFile(name, content, type = 'application/json') {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  if (window.native && window.native.saveFile) {
    const r = await window.native.saveFile(name, bytes);
    if (r) toast('Uloženo: ' + r, 'ok');
    return;
  }
  const blob = new Blob([bytes], { type });
  if (window.showSaveFilePicker) {
    try {
      const ext = name.slice(name.lastIndexOf('.'));
      const fh = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: ext.slice(1).toUpperCase(), accept: { [type]: [ext] } }] });
      const w = await fh.createWritable(); await w.write(blob); await w.close();
      toast('Uloženo: ' + fh.name, 'ok');
      return;
    } catch (e) { if (e && e.name === 'AbortError') return; /* výběr místa nejde – stáhnout */ }
  }
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ZIP bez komprese (pro .xlsx): files = [[název, text]] */
function zipStore(files) {
  const crcT = zipStore.t || (zipStore.t = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }));
  const crc = d => { let c = 0xffffffff; for (const b of d) c = crcT[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const enc = new TextEncoder(), parts = [], cen = [];
  let off = 0;
  const hdr = (sig, fields) => { const b = new DataView(new ArrayBuffer(fields.reduce((a, f) => a + f[1], 4))); b.setUint32(0, sig, true); let p = 4; for (const [v, n] of fields) { n === 2 ? b.setUint16(p, v, true) : b.setUint32(p, v, true); p += n; } return new Uint8Array(b.buffer); };
  for (const [name, text] of files) {
    const nm = enc.encode(name), data = enc.encode(text), c = crc(data);
    const common = [[0, 2], [0, 2], [0, 2], [0x21, 2], [c, 4], [data.length, 4], [data.length, 4], [nm.length, 2], [0, 2]];
    parts.push(hdr(0x04034b50, [[20, 2], ...common]), nm, data);
    cen.push(hdr(0x02014b50, [[20, 2], [20, 2], ...common, [0, 2], [0, 2], [0, 2], [0, 4], [off, 4]]), nm);
    off += 30 + nm.length + data.length;
  }
  const cenLen = cen.reduce((a, b) => a + b.length, 0);
  const end = hdr(0x06054b50, [[0, 2], [0, 2], [files.length, 2], [files.length, 2], [cenLen, 4], [off, 4], [0, 2]]);
  const out = new Uint8Array(off + cenLen + end.length);
  let p = 0;
  for (const b of [...parts, ...cen, end]) { out.set(b, p); p += b.length; }
  return out;
}

/* Jednoduchý sešit Excel (.xlsx): první řádek tučně, widths = šířky sloupců ve znacích */
function makeXlsx(sheetName, rows, widths = []) {
  const x = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const col = i => (i >= 26 ? String.fromCharCode(64 + Math.floor(i / 26)) : '') + String.fromCharCode(65 + i % 26);
  const cell = (v, r, c) => v === '' || v == null ? '' : typeof v === 'number'
    ? `<c r="${col(c)}${r}"${r === 1 ? ' s="1"' : ''}><v>${v}</v></c>`
    : `<c r="${col(c)}${r}" t="inlineStr"${r === 1 ? ' s="1"' : ''}><is><t xml:space="preserve">${x(v)}</t></is></c>`;
  const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + (widths.length ? '<cols>' + widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>' : '')
    + '<sheetData>' + rows.map((r, i) => `<row r="${i + 1}">${r.map((v, c) => cell(v, i + 1, c)).join('')}</row>`).join('') + '</sheetData></worksheet>';
  const ns = 'http://schemas.openxmlformats.org';
  return zipStore([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets><sheet name="${x(String(sheetName).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'List1')}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${ns}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${ns}/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
    ['xl/worksheets/sheet1.xml', sheet],
  ]);
}

/* Rozbalení .zip (sešit .xlsx): { cesta: Uint8Array }; komprimované části rozbalí prohlížeč (DecompressionStream) */
async function unzip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), dec = new TextDecoder();
  let e = u8.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('Soubor není platný sešit .xlsx');
  const out = {};
  for (let i = 0, p = dv.getUint32(e + 16, true); i < dv.getUint16(e + 10, true); i++) {
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
    const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), raw = u8.subarray(start, start + size);
    if (method === 0) out[name] = raw;
    else if (method === 8) out[name] = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  }
  return out;
}

/* První list sešitu Excel: { name, rows } – hodnoty buněk jako text nebo čísla, prázdné buňky jako '' */
async function readXlsx(buf) {
  const z = await unzip(buf), dec = new TextDecoder();
  const xml = n => z[n] ? new DOMParser().parseFromString(dec.decode(z[n]), 'application/xml') : null;
  const ss = xml('xl/sharedStrings.xml');
  const shared = ss ? [...ss.getElementsByTagName('si')].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join('')) : [];
  const wb = xml('xl/workbook.xml'), first = wb && wb.getElementsByTagName('sheet')[0];
  const rels = xml('xl/_rels/workbook.xml.rels'), rid = first && first.getAttribute('r:id');
  const rel = rels && [...rels.getElementsByTagName('Relationship')].find(r => r.getAttribute('Id') === rid);
  const sheet = xml(rel ? 'xl/' + rel.getAttribute('Target').replace(/^\/?(xl\/)?/, '') : 'xl/worksheets/sheet1.xml');
  if (!sheet) throw new Error('V sešitu není žádný list');
  const rows = [];
  for (const r of sheet.getElementsByTagName('row')) {
    const row = [];
    for (const c of r.getElementsByTagName('c')) {
      const ref = (c.getAttribute('r') || '').replace(/\d+/g, '');
      const col = ref ? [...ref].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1 : row.length;
      const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0];
      let val = t === 's' ? shared[+v.textContent] : t === 'inlineStr' ? [...c.getElementsByTagName('t')].map(x => x.textContent).join('') : v ? v.textContent : '';
      if ((!t || t === 'n') && val !== '' && !isNaN(val)) val = +val;
      row[col] = val;
    }
    rows[(+r.getAttribute('r') || rows.length + 1) - 1] = row;
  }
  return { name: first ? first.getAttribute('name') : '', rows: Array.from(rows, r => Array.from(r || [], x => x == null ? '' : x)) };
}

/* Text CSV (oddělovač ; , nebo tabulátor, uvozovky) → řádky */
function parseCsv(text) {
  const line1 = text.split('\n')[0];
  const sep = [';', '\t', ','].sort((a, b) => line1.split(b).length - line1.split(a).length)[0];
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(c => c.trim()));
}

function safeFileName(s) {
  return String(s || 'soubor').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '_') || 'soubor';
}

function readFileText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      // Pokus o UTF-8, jinak Windows-1250 (staré české .txt soubory)
      const buf = new Uint8Array(r.result);
      let txt = new TextDecoder('utf-8').decode(buf);
      if (txt.includes('\uFFFD')) {
        try { txt = new TextDecoder('windows-1250').decode(buf); } catch (e) { /* nic */ }
      }
      res(txt.replace(/^﻿/, ''));
    };
    r.onerror = rej;
    r.readAsArrayBuffer(file);
  });
}

/* ===== UTF-8 / Base64 / SHA-1 (pro Git) ===== */
const utf8 = {
  enc: s => new TextEncoder().encode(s),
  dec: b => new TextDecoder('utf-8').decode(b),
};
function b64ToText(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return utf8.dec(bytes);
}
function textToB64(text) {
  const bytes = utf8.enc(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/* Čisté JS SHA-1 – funguje i ze souboru (file://) bez crypto.subtle */
/* PIN pro úpravy se ukládá jen jako otisk */
function pinHash(pin) { return sha1Bytes(utf8.enc('prompter:' + pin)); }

function sha1Bytes(bytes) {
  const ml = bytes.length;
  const withPad = ((ml + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(withPad);
  buf.set(bytes); buf[ml] = 0x80;
  const dv = new DataView(buf.buffer);
  const bitLen = ml * 8;
  dv.setUint32(withPad - 8, Math.floor(bitLen / 0x100000000));
  dv.setUint32(withPad - 4, bitLen >>> 0);
  let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
  const w = new Uint32Array(80);
  for (let off = 0; off < withPad; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) { const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]; w[i] = (x << 1) | (x >>> 31); }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f, k;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
      else { f = b ^ c ^ d; k = 0xCA62C1D6; }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map(x => x.toString(16).padStart(8, '0')).join('');
}
function gitBlobSha(text) {
  const body = utf8.enc(text);
  const head = utf8.enc('blob ' + body.length + '\0');
  const all = new Uint8Array(head.length + body.length);
  all.set(head); all.set(body, head.length);
  return sha1Bytes(all);
}

/* ===== Toasty a dialogy ===== */
function toast(msg, kind = 'info', ms = 3200) {
  let box = $('#toasts');
  if (!box) { box = h('div', { id: 'toasts' }); document.body.appendChild(box); }
  const t = h('div', { class: 'toast ' + kind }, msg);
  box.appendChild(t);
  setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 400); }, ms);
}

function modal({ title, body, buttons = [{ label: 'OK', value: true, primary: true }], wide = false, onOpen }) {
  return new Promise(resolve => {
    const back = h('div', { class: 'modal-back' });
    const close = v => { back.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const box = h('div', { class: 'modal' + (wide ? ' wide' : '') },
      h('div', { class: 'modal-title' }, title || ''),
      h('div', { class: 'modal-body' }, body instanceof Node ? body : h('div', { html: body || '' })),
      h('div', { class: 'modal-buttons' }, buttons.map(b =>
        h('button', { class: 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''), onclick: () => close(typeof b.value === 'function' ? b.value(box) : b.value) }, b.label)))
    );
    const onKey = e => {
      const top = [...document.querySelectorAll('.modal-back')].pop();
      if (top && top !== back) return;   // klávesy patří jen hornímu oknu
      if (e.key === 'Escape') { e.stopPropagation(); close(null); }
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        const p = buttons.find(b => b.primary);
        if (p) { e.preventDefault(); e.stopPropagation(); close(typeof p.value === 'function' ? p.value(box) : p.value); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    back.appendChild(box);
    back.addEventListener('mousedown', e => { if (e.target === back) close(null); });
    document.body.appendChild(back);
    const first = box.querySelector('input,select,textarea');
    if (first) setTimeout(() => { if (!box.contains(document.activeElement)) first.focus(); }, 30);   // kdo už do okna píše, tomu kurzor nebrat
    if (onOpen) onOpen(box, close);
  });
}

/* Výběr jedné z možností (velká tlačítka s popisem); vrátí id zvolené, nebo null */
function chooseDlg(title, opts) {
  let close;
  const body = h('div', { class: 'choose-list' }, opts.map(o => h('button', { class: 'choose-it', onclick: () => close(o.id) },
    h('span', { class: 'choose-tag' }, o.tag), h('span', { class: 'choose-t' }, h('b', {}, o.label), h('small', {}, o.help)))));
  return modal({ title, body, buttons: [{ label: 'Zrušit', value: null }], onOpen: (box, c) => { close = c; } });
}

function confirmDlg(text, okLabel = 'Ano', danger = false) {
  return modal({ title: 'Potvrzení', body: h('p', {}, text), buttons: [{ label: 'Zrušit', value: false }, { label: okLabel, value: true, primary: true, danger }] });
}

function promptDlg(title, value = '', placeholder = '') {
  const inp = h('input', { type: 'text', class: 'inp', value, placeholder });
  return modal({ title, body: inp, buttons: [{ label: 'Zrušit', value: null }, { label: 'OK', primary: true, value: () => inp.value.trim() }] });
}
