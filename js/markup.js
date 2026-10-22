'use strict';
/* ===== Značkovací jazyk textu písně =====
  ## Název sekce [@KÓD]   nadpis sekce (volitelně výchozí zpěvák celé sekce)
  ##                      konec sekce (další řádky už do ní nepatří)
  @KÓD text               řádek konkrétního zpěváka (více: @J+T)
  >> Název sekce          zopakovat dříve definovanou sekci
  // poznámka             poznámka (malým písmem)
  ---                     nová stránka
  {KÓD:slova}             zpěvák uvnitř řádku
  **tučně**  *kurzíva*  __podtržení__
  {#ff0000:slova}         vlastní barva písma (třeba červené pokyny pro kapelu)
  {130%:slova}            velikost písma v procentech
  {↕1.4:řádek}            řádkování jednoho řádku (výška řádku × písmo)
  {⇤:řádek} {↔:…} {⇥:…}   zarovnání řádku vlevo / na střed / vpravo
  {⤓0.5:řádek}            mezera pod řádkem (× písmo) (starší zápis {+:…} 125 %, {++:…} 155 %, {-:…} 80 %, {--:…} 65 %)
  (prázdný řádek)         mezera mezi slokami

  Starší zápisy pro muzikanty se už nezobrazují nikde (zůstanou v textu skryté, „Vyčistit text“ je smaže):
  [Am] akordy, %G řádek pro nástroj, %%G … %% blok pro nástroj
*/
const RE_SECTION = /^##\s*(.*?)\s*(?:@([A-Za-z0-9+]+))?\s*$/;
/* nadpis sekce: „## Refrén 2× #ffff00 @V“ – název, počet opakování, vlastní barva písma, zpěváci celé sekce */
function parseSectionLine(t) {
  const m = RE_SECTION.exec(String(t).trim());
  if (!m || !String(t).trim().startsWith('##')) return null;
  let name = m[1], count = 0, color = '';
  let x;
  if ((x = /\s*(#[0-9a-fA-F]{6})$/.exec(name))) { color = x[1].toLowerCase(); name = name.slice(0, x.index); }
  if ((x = /(^|\s+)(\d{1,2})\s*[x×]$/i.exec(name))) { count = +x[2]; name = name.slice(0, x.index); }
  return { name: name.trim(), count, color, singers: parseCodes(m[2]) };
}
function formatSectionLine(o) {
  return '## ' + (o.name || 'Sekce') + (o.count > 1 ? ' ' + o.count + '×' : '') + (o.color ? ' ' + o.color : '') + (o.singers && o.singers.length ? ' @' + o.singers.join('+') : '');
}
const RE_SINGER = /^@([A-Za-z0-9+]+)\s?(.*)$/;
const RE_REPEAT = /^>>\s*(.+?)\s*$/;
const RE_NOTE = /^\/\/\s?(.*)$/;
const RE_MUS = /^%(?!%)([A-Za-z0-9+]+)\s?(.*)$/;
const RE_MUSBLOCK = /^%%([A-Za-z0-9+]*)\s*(.*)$/;
const RE_INLINE_CHORD = /\[([^\]\s]{1,12})\]/g;
// konec stránky: „---“ platí pro hlavní čtečku, „--- tablet“ jen pro obrazovku s tímto id
const RE_BREAK = /^---\s*([A-Za-z0-9][A-Za-z0-9_-]*)?\s*$/;
/* druh části podle názvu sekce: nástrojová (předehra, mezihra, sólo) / refrén / mezičást / sloka */
function sectionKind(name) {
  const n = String(name || '').toLowerCase();
  if (!n) return '';
  if (/předehr|predehr|intro|mezihr|^sól|^sol|solo|dohr|outro|pauza|break/.test(n)) return 'instr';   // nástrojová část – bez textu
  if (/refr|chorus|ref\b|^r\s*\d*$/.test(n)) return 'chorus';
  if (/mezi|bridge|předrefr|predrefr|pre-?chorus|most/.test(n)) return 'bridge';
  return 'verse';
}
function breakScreen(t) { const m = RE_BREAK.exec(String(t).trim()); return m ? (m[1] || 'main') : null; }

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
    } else if ((m = RE_BREAK.exec(t))) {
      const screen = m[1] || 'main';
      lines.push({ kind: 'break', singers: [], screen });
      blocks.push({ type: 'break', src: i, screen });
      curSection = null;
    } else if (/^##\s*$/.test(t)) {
      // samotné „##“ = konec sekce: další řádky už k ní nepatří (Shift+Enter v editoru)
      lines.push({ kind: 'secend', singers: [] });
      curSection = null;
    } else if ((m = RE_SECTION.exec(t))) {
      const sec = parseSectionLine(t);
      const name = sec.name || 'Sekce', singers = sec.singers;
      lines.push({ kind: 'section', singers });
      const instr = sectionKind(name) === 'instr';
      const b = { type: 'section', text: name, singers, src: i, count: sec.count, color: sec.color, instr };
      // nástrojová část (předehra, mezihra, sólo) nemá text – další řádky do ní nepatří
      curSection = { name, singers, blocks: [b], count: sec.count, color: sec.color, instr, first: true };
      sections[name.toLowerCase()] = curSection.blocks;
      blocks.push(b);
      if (instr) curSection = null;
    } else if ((m = RE_REPEAT.exec(t))) {
      const name = m[1];
      const ref = sections[name.toLowerCase()];
      lines.push({ kind: 'repeat', singers: [], ok: !!ref });
      if (ref) {
        // Zopakuje bloky sekce (bez koncových mezer)
        let copy = ref.map(b => Object.assign({}, b, { repeat: true, rsrc: i }));
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
      const b = chordsOnly ? { type: 'chords', text, src: i } : { type: 'line', text, singers, src: i, chords: hasChords(text), sec: curSection ? curSection.name : '',
        secColor: curSection ? curSection.color : '', secCount: curSection && curSection.first ? curSection.count : 0 };
      if (curSection && !chordsOnly) curSection.first = false;   // počet opakování se ukáže u prvního řádku sekce
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

/* Co se zobrazí: bez starších zápisů pro muzikanty (řádky s akordy, %G, %%G … %%) */
function filterForView(blocks) {
  const out = blocks.filter(b => b.type !== 'mus' && b.type !== 'musblock' && b.type !== 'chords');
  // bez skrytých řádků nesmí zůstat zdvojené mezery
  const res = [];
  for (const b of out) {
    if (b.type === 'gap' && (!res.length || res[res.length - 1].type === 'gap')) continue;
    res.push(b);
  }
  while (res.length && res[res.length - 1].type === 'gap') res.pop();
  return res;
}

/* Velikost písma části textu: {130%:slova}; starší stupně +, ++, -, -- se čtou dál a pro tyto
   velikosti se i zapisují (starší verze programu je umí zobrazit) */
const SZ_STEPS = { '+': 125, '++': 155, '-': 80, '--': 65 };
const RE_SZ_IN = /\{([+-]{1,2}|\d{2,3}%):([^{}]*)\}/g;   // jen nejvnitřnější (bez dalších závorek uvnitř)
const SZ_MIN = 50, SZ_MAX = 250;
const szPct = mark => SZ_STEPS[mark] || parseInt(mark, 10) || 100;
const szMark = pct => Object.keys(SZ_STEPS).find(k => SZ_STEPS[k] === pct) || pct + '%';
const szClamp = pct => Math.max(SZ_MIN, Math.min(SZ_MAX, Math.round(pct)));

/* Inline formátování → HTML */
function inlineHtml(text, singerMap) {
  let s = esc(text);
  // velikost {130%:…}, vlastní barva {#ff0000:…} a zpěvák slov {T:…} jdou do sebe vnořit – zpracují se od nejvnitřnější
  const singer = (all, codes, inner) => {
    const list = parseCodes(codes);
    const sg = singerMap[list[0]];
    if (!sg) return inner;
    const st = `color:${sg.color};${sg.bold ? 'font-weight:900;' : ''}${sg.italic ? 'font-style:italic;' : ''}`;
    return `<span class="sg-in" data-c="${list.join('+')}" style="${st}">${inner}</span>`;
  };
  for (let prev = null; prev !== s;) {
    prev = s;
    s = s.replace(RE_SZ_IN, (all, mark, inner) => { const p = szPct(mark); return `<span class="sz" data-p="${p}" style="font-size:${p / 100}em">${inner}</span>`; });
    s = s.replace(/\{(#[0-9a-fA-F]{6}):([^{}]*)\}/g, (all, c, inner) => `<span class="tc" data-tc="${c.toLowerCase()}" style="color:${c}">${inner}</span>`);
    s = s.replace(/\{([⇤↔⇥]):([^{}]*)\}/g, (all, a, inner) => `<span class="al" data-al="${a}">${inner}</span>`);   // zarovnání řádku
    s = s.replace(/\{⤓(\d(?:\.\d{1,2})?):([^{}]*)\}/g, (all, v, inner) => `<span class="spb" data-sp="${v}">${inner}</span>`);   // mezera pod řádkem
    s = s.replace(/\{aa:([^{}]*)\}/g, (all, inner) => `<span class="kc">${inner}</span>`);   // {aa:…} písmena tak, jak jsou napsaná (i když šablona píše VELKÝMI)
    s = s.replace(/\{([A-Za-z0-9+]+):([^{}]*)\}/g, singer);
    // {↕1.4:…} řádkování řádku (výšku řádku nastaví vykreslení stránky)
    s = s.replace(/\{↕(\d(?:\.\d{1,2})?):([^{}]*)\}/g, (all, v, inner) => `<span class="lh" data-lh="${v}">${inner}</span>`);
  }
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  s = s.replace(/__(.+?)__/g, '<u>$1</u>');
  s = s.replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<i>$2</i>');
  return s;
}

/* Nastaví/odebere zpěváka na zdrojovém řádku. mode: 'set' | 'toggle' | 'clear' */
function applySingerToLine(line, code, mode = 'set') {
  const t = line.trim();
  if (t === '' || RE_REPEAT.test(t) || RE_NOTE.test(t) || RE_BREAK.test(t) || t.startsWith('%')) return line;
  let m;
  if (t.startsWith('##')) {
    const sec = parseSectionLine(t);
    sec.singers = nextCodes(sec.singers, code, mode);
    return formatSectionLine(sec);
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
  if (mode === 'add') return codes.includes(code) ? codes : [...codes, code];
  if (mode === 'remove') return codes.filter(c => c !== code);
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
  // chords: 'remove' = smazat akordy, tabulatury a starší poznámky pro nástroje (%G, %%G … %%), 'none' = nechat
  const o = Object.assign({ chords: 'remove', detectSections: true, trimSpaces: true, collapseBlank: true }, opts);
  if (opts.removeChords === false && !opts.chords) o.chords = 'none';
  let lines = String(text || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/ /g, ' ').split('\n');
  if (o.chords === 'remove') {
    let blk = false;
    lines = lines.filter(l => {
      const t = l.trim();
      if (t.startsWith('%%')) { blk = !blk; return false; }
      return !blk && !t.startsWith('%') && !(t && (isChordLine(l) || TAB_RE.test(l)));
    }).map(l => l.replace(/\[([^\]\s]{1,10})\]/g, (all, inner) => CHORD_RE.test(inner) ? '' : all));
  }
  if (o.trimSpaces) {
    lines = lines.map(l => l.replace(/\s+/g, ' ').trim());
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
