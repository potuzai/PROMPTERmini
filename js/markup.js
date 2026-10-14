'use strict';
/* ===== Značkovací jazyk textu písně =====
  ## Název sekce [@KÓD]   nadpis sekce (volitelně výchozí zpěvák celé sekce)
  @KÓD text               řádek konkrétního zpěváka (více: @J+T)
  >> Název sekce          zopakovat dříve definovanou sekci
  // poznámka             poznámka (malým písmem)
  ---                     nová stránka
  {KÓD:slova}             zpěvák uvnitř řádku
  **tučně**  *kurzíva*  __podtržení__
  {+:slova}  {-:slova}    větší / menší písmo (++ ještě větší)
  (prázdný řádek)         mezera mezi slokami

  Pro muzikanty (ve čtečce se NIKDY nezobrazí, jen v náhledu „Pro muzikanty“ a v tisku):
  [Am]Zpívám [C]ptákům    akord nad slovem
  %G text                 řádek pro nástroj (G = zkratka nástroje, více: %G+B)
  %%G Nadpis … %%         blok pro nástroj (tabulatura) – zachová přesné mezery
*/
const RE_SECTION = /^##\s*(.*?)\s*(?:@([A-Za-z0-9+]+))?\s*$/;
const RE_SINGER = /^@([A-Za-z0-9+]+)\s?(.*)$/;
const RE_REPEAT = /^>>\s*(.+?)\s*$/;
const RE_NOTE = /^\/\/\s?(.*)$/;
const RE_MUS = /^%(?!%)([A-Za-z0-9+]+)\s?(.*)$/;
const RE_MUSBLOCK = /^%%([A-Za-z0-9+]*)\s*(.*)$/;
const RE_INLINE_CHORD = /\[([^\]\s]{1,12})\]/g;

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

  let mblock = null; // otevřený blok pro muzikanty (%%…%%)
  for (let i = 0; i < src.length; i++) {
    const raw = src[i];
    const t = raw.trim();
    let m;
    if (mblock) {
      if (t === '%%') { mblock = null; lines.push({ kind: 'musblock', inst: [], edge: true }); continue; }
      mblock.lines.push(raw.replace(/\s+$/, ''));
      lines.push({ kind: 'musblock', inst: mblock.inst });
      continue;
    }
    if ((m = RE_MUSBLOCK.exec(t))) {
      const inst = parseCodes(m[1]);
      mblock = { type: 'musblock', inst, title: m[2], lines: [], src: i };
      lines.push({ kind: 'musblock', inst, edge: true });
      blocks.push(mblock); if (curSection) curSection.blocks.push(mblock);
      continue;
    }
    if ((m = RE_MUS.exec(t))) {
      const inst = parseCodes(m[1]);
      lines.push({ kind: 'mus', inst });
      const b = { type: 'mus', inst, text: m[2], src: i };
      blocks.push(b); if (curSection) curSection.blocks.push(b);
      continue;
    }
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
      const text = body.trim();
      const chordsOnly = hasChords(text) && stripChords(text) === '';
      lines.push({ kind: chordsOnly ? 'chords' : 'line', singers, inherited, chords: hasChords(text) });
      const b = chordsOnly ? { type: 'chords', text, src: i } : { type: 'line', text, singers, src: i, chords: hasChords(text) };
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

/* ===== Akordy v textu ([Am]) ===== */
function isChordToken(t) { return CHORD_RE.test(String(t).replace(/[()]/g, '')); }
function hasChords(text) {
  RE_INLINE_CHORD.lastIndex = 0;
  let m; while ((m = RE_INLINE_CHORD.exec(text))) if (isChordToken(m[1])) return true;
  return false;
}
function stripChords(text) {
  return String(text).replace(RE_INLINE_CHORD, (all, c) => isChordToken(c) ? '' : all).replace(/ {2,}/g, ' ').trim();
}
/* Řádek s akordy nad slovy: každý úsek = akord nahoře + text pod ním */
function chordedHtml(text, singerMap) {
  const parts = [];
  let last = 0, chord = null, m;
  RE_INLINE_CHORD.lastIndex = 0;
  while ((m = RE_INLINE_CHORD.exec(text))) {
    if (!isChordToken(m[1])) continue;
    parts.push({ chord, text: text.slice(last, m.index) });
    chord = m[1]; last = m.index + m[0].length;
  }
  parts.push({ chord, text: text.slice(last) });
  return parts.filter((p, i) => i > 0 || p.text !== '').map(p =>
    `<span class="cw"><span class="ch">${p.chord ? esc(p.chord) : '&nbsp;'}</span><span class="cl">${inlineHtml(p.text, singerMap) || '&nbsp;'}</span></span>`).join('');
}

/* Výběr vrstev pro muzikanty: null = čtečka (nic), jinak { chords: bool, inst: { G: true, … } } */
function filterForView(blocks, mus) {
  const instOn = codes => mus && codes.some(c => mus.inst && mus.inst[c]);
  const out = [];
  for (const b of blocks) {
    if (b.type === 'mus' || b.type === 'musblock') { if (instOn(b.inst)) out.push(b); continue; }
    if (b.type === 'chords') { if (mus && mus.chords) out.push(b); continue; }
    if (b.type === 'line' && b.chords) { out.push(Object.assign({}, b, { showChords: !!(mus && mus.chords) })); continue; }
    out.push(b);
  }
  // bez skrytých řádků nesmí zůstat zdvojené mezery
  const res = [];
  for (const b of out) {
    if (b.type === 'gap' && (!res.length || res[res.length - 1].type === 'gap')) continue;
    res.push(b);
  }
  while (res.length && res[res.length - 1].type === 'gap') res.pop();
  return res;
}

/* Inline formátování → HTML */
function inlineHtml(text, singerMap) {
  let s = esc(text);
  // {+:větší} {++:ještě větší} {-:menší}
  s = s.replace(/\{([+-]{1,2}):([^}]*)\}/g, (all, lvl, inner) => `<span class="sz sz${lvl[0] === '+' ? 'p' : 'm'}${lvl.length}">${inner}</span>`);
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
  if (t === '' || RE_REPEAT.test(t) || RE_NOTE.test(t) || t === '---' || t.startsWith('%')) return line;
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
  // chords: 'keep' = akordy převést do textu pro muzikanty ([Am]), 'remove' = smazat, 'none' = nechat beze změny
  const o = Object.assign({ chords: 'keep', detectSections: true, trimSpaces: true, collapseBlank: true }, opts);
  if (opts.removeChords === false && !opts.chords) o.chords = 'none';
  let lines = String(text || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/ /g, ' ').split('\n');
  // tabulatury (e|---0---|) → blok pro kytaru, ať se jim nerozhází mezery
  if (o.chords !== 'none') lines = wrapTabs(lines);
  if (o.chords === 'keep') lines = mergeChordLines(lines);
  if (o.chords === 'remove') {
    lines = lines.filter(l => !(l.trim() && isChordLine(l)))
      .map(l => l.startsWith('%') ? l : l.replace(/\[([^\]\s]{1,10})\]/g, (all, inner) => CHORD_RE.test(inner) ? '' : all));
  }
  if (o.trimSpaces) {
    let inBlock = false;
    lines = lines.map(l => {
      if (/^%%/.test(l.trim())) { inBlock = l.trim() !== '%%' || !inBlock ? !inBlock : false; return l.trim(); }
      return inBlock ? l.replace(/\s+$/, '') : l.replace(/\s+/g, ' ').trim();
    });
  }
  if (o.detectSections) {
    const out = [];
    const defined = new Set();
    let verse = 0;
    let inBlk = false;
    for (const l of lines) {
      let m;
      if (/^%%/.test(l)) { inBlk = l === '%%' ? false : true; out.push(l); continue; }
      if (inBlk || l.startsWith('%') || (hasChords(l) && stripChords(l) === '')) { out.push(l); continue; }
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
const TAB_RE = /^\s*[a-gA-G][#b]?\s?\|[-0-9a-z|\/\\~^().*\s]{3,}$/;
function wrapTabs(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (TAB_RE.test(lines[i]) && i + 1 < lines.length && TAB_RE.test(lines[i + 1])) {
      out.push('%%G Tabulatura');
      while (i < lines.length && TAB_RE.test(lines[i])) out.push(lines[i++].replace(/\s+$/, ''));
      out.push('%%');
      i--;
    } else out.push(lines[i]);
  }
  return out;
}

/* Řádek akordů nad textem → akordy vložené do textu na stejné pozice: „[Am]Zpívám [C]ptákům“ */
function mergeChordLines(lines) {
  const out = [];
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], t = l.trim();
    if (/^%%/.test(t)) { inBlock = !inBlock || t !== '%%' ? !inBlock : false; out.push(l); continue; }
    if (inBlock || !t || !isChordLine(l)) { out.push(l); continue; }
    const toks = [...l.matchAll(/\S+/g)].filter(m => isChordToken(m[0])).map(m => ({ c: m[0].replace(/[()]/g, ''), i: m.index }));
    const next = lines[i + 1];
    const nt = next !== undefined ? next.trim() : '';
    const nextIsLyric = nt && !isChordLine(next) && !/^(##|>>|\/\/|%|@|---|\[[^\]]+\]\s*$|\d{1,2}[.)])/.test(nt) && !/^[A-Za-zÁ-ž\s]+\d*\s*:\s*$/.test(nt);
    if (!toks.length) continue;
    if (nextIsLyric) {
      let lyr = next;
      for (const tk of toks.slice().sort((a, b) => b.i - a.i)) {
        if (lyr.length < tk.i) lyr = lyr.padEnd(tk.i, ' ');
        lyr = lyr.slice(0, tk.i) + '[' + tk.c + ']' + lyr.slice(tk.i);
      }
      out.push(lyr.replace(/\s+$/, ''));
      i++;
    } else {
      out.push(toks.map(tk => '[' + tk.c + ']').join(' '));   // samostatný řádek akordů (intro, mezihra)
    }
  }
  return out;
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
