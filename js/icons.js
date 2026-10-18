'use strict';
/* ===== Čárové ikony (24×24, tah 1,6) – nahrazují emoji v celém rozhraní ===== */
const ICONS = {
  song: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke-width="2.6" stroke-linecap="round"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M3 9h18M9 9v12"/>',
  mic: '<rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1.5 14h5M9.5 8h5M17.5 16h5"/>',
  play: '<path d="M7 4.5v15l12.5-7.5z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 15v4.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V15"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 15v4.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V15"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="1.5"/><path d="M16 8V4.5A1.5 1.5 0 0 0 14.5 3h-10A1.5 1.5 0 0 0 3 4.5v10A1.5 1.5 0 0 0 4.5 16H8"/>',
  trash: '<path d="M3.5 6h17M9 6V3.5h6V6M5.5 6l1 14.5h11l1-14.5M10 10.5v6M14 10.5v6"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M11 12.5 20.5 3M16.5 7l3 3M14 9.5l2 2"/>',
  warn: '<path d="M12 3 2 20.5h20z"/><path d="M12 10v4.5M12 17.5h.01"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.4a6.5 6.5 0 0 1 3 5.6"/>',
  star: '<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.4l-5.6 2.9 1.1-6.2L3 9.7l6.2-.9z"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="1.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  unlock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="1.5"/><path d="M8 10.5V7a4 4 0 0 1 7.7-1.5"/>',
  save: '<path d="M5 3h11l4 4v12.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3z"/><path d="M8 3v5h7V3M7.5 21v-7h9v7"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.3-4.7L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.7L20 16"/><path d="M20 20.5V16h-4.5"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L11.5 6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.7-1.6"/>',
  clean: '<path d="m14.5 4 5.5 5.5L9.5 20H4v-5.5z"/><path d="m11 7.5 5.5 5.5"/>',
  print: '<path d="M6.5 9V3h11v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M6.5 14h11v7h-11z"/>',
  power: '<path d="M12 3v8"/><path d="M6.4 6.6a8 8 0 1 0 11.2 0"/>',
  back: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  monitor: '<rect x="2.5" y="3.5" width="19" height="13" rx="1.5"/><path d="M8 21h8M12 16.5V21"/>',
  target: '<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  cloud: '<path d="M7 19h10.5a4.5 4.5 0 0 0 .6-9 6 6 0 0 0-11.6 1.6A3.8 3.8 0 0 0 7 19z"/>',
  folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
  pagebreak: '<path d="M5 3v5h14V3M5 21v-5h14v5"/><path d="M2 12h3M8 12h3M13 12h3M19 12h3"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  guitar: '<path d="M14.5 9.5 20 4M18 2.5 21.5 6"/><path d="M10.6 8.2a3.4 3.4 0 0 0-4.6.3c-.9.9-1 2-.6 3-1.6.3-2.9 1.6-3 3.4-.2 2.5 2.2 5.1 4.9 5 1.8-.1 3.1-1.4 3.4-3 1 .4 2.1.3 3-.6a3.4 3.4 0 0 0 .3-4.6"/><circle cx="9.5" cy="14.5" r="1.4"/>',
  zoomin: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8M10.5 7.5v6M7.5 10.5h6"/>',
  zoomout: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8M7.5 10.5h6"/>',
  mirror: '<path d="M12 3v18" stroke-dasharray="2 2.5"/><path d="M9 7 3.5 12 9 17zM15 7l5.5 5-5.5 5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/>',
  stagemon: '<rect x="7" y="2" width="10" height="17" rx="1.5"/><path d="M12 19v3M8.5 22h7"/>',
  both: '<rect x="2" y="5" width="13" height="10" rx="1.2"/><rect x="17" y="3" width="5" height="9" rx="1"/><path d="M6 19h5M8.5 15v4"/>',
  rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01"/>',
};

function ic(name, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONS[name] || '';
  return s;
}

/* Převod znaků na začátku textu na ikony (aby se nemuselo přepisovat každé tlačítko zvlášť) */
const GLYPH_ICONS = {
  '🎵': 'song', '📋': 'list', '🎨': 'layout', '🎤': 'mic', '⚙': 'sliders', '▶': 'play', '＋': 'plus', '⇪': 'upload',
  '⇩': 'download', '⧉': 'copy', '🗑': 'trash', '🔑': 'key', '⚠': 'warn', '🔍': 'search', '✎': 'edit', '👥': 'users',
  '★': 'star', '◀': 'left', '🔒': 'lock', '🔓': 'unlock', '💾': 'save', '⟳': 'sync', '🔗': 'link', '🧹': 'clean',
  '🖨': 'print', '⏻': 'power', '↩': 'back', '🖥': 'monitor', '⌖': 'target', '👤': 'user', '✅': 'check', '☁': 'cloud',
  '📁': 'folder', '⤓': 'pagebreak', '✕': 'x', '✓': 'check', '🎸': 'guitar',
};
const GLYPH_RE = new RegExp('^(' + Object.keys(GLYPH_ICONS).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\uFE0F?\\s*');
function glyphToIcon(text) {
  const t = String(text);
  if (t === '▶') return [ic('play')];
  const m = GLYPH_RE.exec(t);
  let out = m ? [ic(GLYPH_ICONS[m[1]]), t.slice(m[0].length)] : [t];
  const last = out[out.length - 1];
  if (typeof last === 'string' && / ?▾$/.test(last)) { out[out.length - 1] = last.replace(/ ?▾$/, ''); out.push(ic('down', 'caret')); }
  return out.filter(x => x !== '');
}
