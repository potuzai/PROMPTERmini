// Mega může v seznamu poslat složku dřív než její rodiče – aplikace ji přesto musí najít (jinak zakládá duplicity)
const assert = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } else console.log('ok: ' + m); };
const createMegaCore = require('../js/mega-core.js');
let mkdirs = 0;
const NODES = [ // dítě před kořenem, jako by to Mega poslala v jiném pořadí
  { h: 'kapela', p: 'root', t: 1, name: 'PROMPTERmini' },
  { h: 'songs', p: 'kapela', t: 1, name: 'songs' },
  { h: 'root', t: 2, name: 'Cloud Drive' },
];
class Node {
  constructor(f, storage) { this.nodeId = f.h; this.name = f.name; this.type = f.t; this.directory = !!f.t; this.children = f.t ? [] : undefined; this.storage = storage; }
  async mkdir(name) { mkdirs++; const f = this.storage._importFile({ h: 'n' + mkdirs, p: this.nodeId, t: 1, name }); return f; }
}
class Storage { // napodobuje chování megajs: _importFile zařadí uzel jen pod už známého rodiče
  constructor() { this.files = {}; this.ready = Promise.resolve(this); }
  _importFile(f) {
    if (!this.files[f.h]) {
      const file = this.files[f.h] = new Node(f, this);
      if (f.t === 2) this.root = file;
      if (f.p && this.files[f.p]) { this.files[f.p].children.push(file); file.parent = this.files[f.p]; }
    }
    return this.files[f.h];
  }
  async reload() { this.files = {}; for (const f of NODES) this._importFile(f); return []; }
  toJSON() { return {}; }
  static fromJSON() { return new Storage(); }
}
(async () => {
  const core = createMegaCore(Storage);
  const r = await core.snapshot({ email: 'a@b.cz', password: 'x', folder: 'PROMPTERmini' });
  assert(r && mkdirs === 3, 'složka kapely poslaná před kořenem se najde – nová se nezaloží (založeny jen chybějící podsložky: ' + mkdirs + ')');
  // složka, kterou Mega vrací bez rodiče i bez jména: podle zapamatovaného ID se najde a nová se nezaloží
  NODES.length = 0;
  NODES.push({ h: 'root', t: 2, name: 'Cloud Drive' }, { h: 'skryta', p: 'jinde', t: 1, name: null });
  core.logout(); mkdirs = 0;
  const r2 = await core.snapshot({ email: 'a@b.cz', password: 'x', folder: 'PROMPTERmini', folderId: 'skryta' });
  assert(r2.folderId === 'skryta' && mkdirs === 4, 'zapamatovaná složka kapely se najde podle ID, i když ji Mega neukáže podle jména (' + mkdirs + ')');
  NODES.length = 0;
  NODES.push({ h: 'kapela', p: 'root', t: 1, name: 'PROMPTERmini' }, { h: 'songs', p: 'kapela', t: 1, name: 'songs' }, { h: 'root', t: 2, name: 'Cloud Drive' });
  const d = await core.diag({ email: 'a@b.cz', password: 'x', folder: 'PROMPTERmini' });
  assert(/složek „PROMPTERmini“ kdekoli: 1/.test(d) && /bez rodiče: 0/.test(d), 'diagnostika ukáže, co aplikace vidí');
})().catch(e => { console.log('FAIL: výjimka', e); process.exit(1); });
