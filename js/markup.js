'use strict';
/* ===== Značkovací jazyk textu písně =====
  ## Název sekce [@KÓD]   nadpis sekce (volitelně výchozí zpěvák celé sekce)
  @KÓD text               řádek konkrétního zpěváka (více: @J+T)
  >> Název sekce          zopakovat dříve definovanou sekci
  // poznámka             poznámka (malým písmem)
  ---                     nová stránka
  {KÓD:slova}             zpěvák uvnitř řádku
  **tučně**  *kurzíva*  __podtržení__
  (prázdný řádek)         mezera mezi slokami
*/
const RE_SECTION = /^##\s*(.*?)\s*(?:@([A-Za-z0-9+]+))?\s*$/;
const RE_SINGER = /^@([A-Za-z0-9+]+)\s?(.*)$/;
const RE_REPEAT = /^>>\s*(.+?)\s*$/;
const RE_NOTE = /^\/\/\s?(.*)$/;

function parseCodes(s) {
  return String(s || '').split('+').map(x => x.trim().toUpperCase()).filter(Boolean);
}

/* Vrací { blocks, lines } – blocks pro vykreslení, lines = info o každém zdrojovém řádku (pro editor) */
function parseSong(text) {
  const src = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const lines = [];
  const sections = {};   // jméno (lowercase) -> [blocks]
  const blocks = [];
  let curSection = null; // { name, singers, blocks }

  for (let i = 0; i < src.length; i++) {
    const raw = src[i];
    const t = raw.trim();
    let m;
    if (t === '') {
      lines.push({ kind: 'gap', singers: [] });
      const b = { type: 'gap', src: i };
      blocks.push(b); if (curSection) curSection.blocks.push(b);
    } else if (t === '---') {
      lines.push({ kind: 'break', singers: [] });
      blocks.push({ type: 'break', src: i });
      curSection = null;
    } else if ((m = RE_SECTION.exec(t))) {
      const singers = parseCodes(m[2]);
      const name = m[1] || 'Sekce';
      lines.push({ kind: 'section', singers });
      const b = { type: 'section', text: name, singers, src: i };
      curSection = { name, singers, blocks: [b] };
      sections[name.toLowerCase()] = curSection.blocks;
      blocks.push(b);
    } else if ((m = RE_REPEAT.exec(t))) {
      const name = m[1];
      const ref = sections[name.toLowerCase()];
      lines.push({ kind: 'repeat', singers: [], ok: !!ref });
      if (ref) {
        // Zopakuje bloky sekce (bez koncových mezer)
        let copy = ref.map(b => Object.assign({}, b, { repeat: true }));
        while (copy.length && copy[copy.length - 1].type === 'gap') copy.pop();
        blocks.push(...copy);
      } else {
        blocks.push({ type: 'note', text: `⚠ sekce „${name}“ nenalezena`, src: i, warn: true });
      }
      curSection = null;
    } else if ((m = RE_NOTE.exec(t))) {
      lines.push({ kind: 'note', singers: [] });
      const b = { type: 'note', text: m[1], src: i };
      blocks.push(b); if (curSection) curSection.blocks.push(b);
    } else {
      let singers = [], body = raw.replace(/\s+$/, ''), inherited = false;
      if ((m = RE_SINGER.exec(t))) { singers = parseCodes(m[1]); body = m[2]; }
      else if (curSection && curSection.singers.length) { singers = curSection.singers; inherited = true; }
      lines.push({ kind: 'line', singers, inherited });
      const b = { type: 'line', text: body.trim(), singers, src: i };
      blocks.push(b); if (curSection) curSection.blocks.push(b);
    }
  }
  // Odstraní mezery na začátku a konci a zdvojené mezery
  const out = [];
  for (const b of blocks) {
    if (b.type === 'gap' && (out.length === 0 || out[out.length - 1].type === 'gap' || out[out.length - 1].type === 'break')) continue;
    out.push(b);
  }
  while (out.length && out[out.length - 1].type === 'gap') out.pop();
  return { blocks: out, lines };
}

/* Inline formátování → HTML */
function inlineHtml(text, singerMap) {
  let s = esc(text);
  s = s.replace(/\{([A-Za-z0-9+]+):([^}]*)\}/g, (all, codes, inner) => {
    const list = parseCodes(codes);
    const sg = singerMap[list[0]];
    if (!sg) return inner;
    const st = `color:${sg.color};${sg.bold ? 'font-weight:900;' : ''}${sg.italic ? 'font-style:italic;' : ''}`;
    return `<span class="sg-in" style="${st}">${inner}</span>`;
  });
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  s = s.replace(/__(.+?)__/g, '<u>$1</u>');
  s = s.replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<i>$2</i>');
  return s;
}

/* Nastaví/odebere zpěváka na zdrojovém řádku. mode: 'set' | 'toggle' | 'clear' */
function applySingerToLine(line, code, mode = 'set') {
  const t = line.trim();
  if (t === '' || RE_REPEAT.test(t) || RE_NOTE.test(t) || t === '---') return line;
  let m;
  if ((m = RE_SECTION.exec(t))) {
    let codes = parseCodes(m[2]);
    codes = nextCodes(codes, code, mode);
    return '## ' + m[1] + (codes.length ? ' @' + codes.join('+') : '');
  }
  let codes = [], body = t;
  if ((m = RE_SINGER.exec(t))) { codes = parseCodes(m[1]); body = m[2]; }
  codes = nextCodes(codes, code, mode);
  return (codes.length ? '@' + codes.join('+') + ' ' : '') + body;
}
function nextCodes(codes, code, mode) {
  code = (code || '').toUpperCase();
  if (mode === 'clear' || !code) return [];
  if (mode === 'toggle') return codes.includes(code) ? codes.filter(c => c !== code) : [...codes, code];
  if (mode === 'force') return [code];
  return codes.length === 1 && codes[0] === code ? [] : [code]; // 'set' – opakované kliknutí zruší
}

/* ===== Úklid vloženého textu ===== */
const CHORD_RE = /^[A-H](?:#|b|is|es)?(?:m|mi|maj|min|dim|aug|sus|add)?\d*(?:\/[A-H](?:#|b)?)?[+\-]?$/;
function isChordLine(line) {
  const toks = line.trim().split(/\s+/).filter(Boolean);
  if (!toks.length) return false;
  return toks.every(t => CHORD_RE.test(t.replace(/[()|]/g, '')) || /^[|:x\d\-/.]+$/i.test(t));
}

const SECTION_ALIASES = [
  [/^(ref(r[eé]n)?|r|chorus|refrain)$/i, 'Refrén'],
  [/^(pre[\s-]?chorus|p[rř]edrefr[eé]n|pr)$/i, 'Předrefrén'],
  [/^(bridge|most|br|b)$/i, 'Bridge'],
  [/^(intro|úvod)$/i, 'Intro'],
  [/^(outro|z[aá]v[eě]r|coda|kóda)$/i, 'Závěr'],
  [/^(mezihra|solo|sólo|instrumental)$/i, 'Mezihra'],
  [/^(verse|sloka|s|v)\s*(\d+)$/i, 'Sloka $2'],
];

function cleanText(text, opts = {}) {
  const o = Object.assign({ removeChords: true, detectSections: true, trimSpaces: true, collapseBlank: true }, opts);
  let lines = String(text || '').replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(/ /g, ' ').split('\n');
  if (o.trimSpaces) lines = lines.map(l => l.replace(/\s+/g, ' ').trim());
  if (o.removeChords) {
    lines = lines.filter(l => !(l && isChordLine(l)))
      .map(l => l.replace(/\[[A-H][^\]\s]{0,8}\]/g, '').replace(/\s{2,}/g, ' ').trim());
  }
  if (o.detectSections) {
    const out = [];
    const defined = new Set();
    let verse = 0;
    for (const l of lines) {
      let m;
      // „1.“ / „1)“ na začátku řádku = sloka
      if ((m = /^(\d{1,2})[.)]\s*(.*)$/.exec(l))) {
        verse = +m[1];
        pushSection(out, `Sloka ${verse}`, defined);
        if (m[2]) out.push(m[2]);
        continue;
      }
      // „Ref:“, „R:“, „[Chorus]“, „Refrén:“…
      m = /^\[?\(?([A-Za-zÁ-ž][A-Za-zÁ-ž\s\-]*?\s*\d*)\)?\]?\s*[:.]\s*(.*)$/.exec(l) || /^\[([^\]]+)\]\s*(.*)$/.exec(l);
      if (m) {
        const name = aliasSection(m[1].trim());
        if (name) {
          if (!m[2] && defined.has(name.toLowerCase())) { out.push('>> ' + name); continue; }
          if (m[2] && defined.has(name.toLowerCase()) && /^\d*x?$/i.test(m[2].replace(/[×\s]/g, ''))) { out.push('>> ' + name); continue; }
          pushSection(out, name, defined);
          if (m[2]) out.push(m[2]);
          continue;
        }
      }
      out.push(l);
    }
    lines = out;
  }
  if (o.collapseBlank) {
    const out = [];
    for (const l of lines) {
      if (l === '' && (out.length === 0 || out[out.length - 1] === '')) continue;
      // před nadpisem sekce vlož prázdný řádek
      if ((l.startsWith('## ') || l.startsWith('>> ')) && out.length && out[out.length - 1] !== '') out.push('');
      out.push(l);
    }
    while (out.length && out[out.length - 1] === '') out.pop();
    lines = out;
  }
  return lines.join('\n');
}
function aliasSection(s) {
  for (const [re, name] of SECTION_ALIASES) {
    const m = re.exec(s);
    if (m) return name.replace('$2', m[2] || '');
  }
  return null;
}
function pushSection(out, name, defined) {
  defined.add(name.toLowerCase());
  out.push('## ' + name);
}
