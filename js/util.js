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

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function uid() {
  const t = Date.now().toString(36);
  const r = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => (b % 36).toString(36)).join('');
  return t + r;
}

function isMobile() { return window.matchMedia('(max-width: 820px)').matches; }

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

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
    if (first) setTimeout(() => first.focus(), 30);
    if (onOpen) onOpen(box);
  });
}

function confirmDlg(text, okLabel = 'Ano', danger = false) {
  return modal({ title: 'Potvrzení', body: h('p', {}, text), buttons: [{ label: 'Zrušit', value: false }, { label: okLabel, value: true, primary: true, danger }] });
}

function promptDlg(title, value = '', placeholder = '') {
  const inp = h('input', { type: 'text', class: 'inp', value, placeholder });
  return modal({ title, body: inp, buttons: [{ label: 'Zrušit', value: null }, { label: 'OK', primary: true, value: () => inp.value.trim() }] });
}
