// Napodobenina knihovny megajs pro testy. Stav „cloudu“ je v JSON souboru (MEGA_MOCK_STATE),
// takže ho sdílí víc programů najednou – jako skutečná Mega.
const fs = require('fs');
const crypto = require('crypto');
const STATE = process.env.MEGA_MOCK_STATE;
const load = () => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) { return { account: { email: 'kapela@test.cz', password: 'heslo123' }, nodes: { root: { name: 'Cloud Drive', parent: null, dir: true, ts: 0 } }, calls: { login: 0, reload: 0 } }; } };
const save = st => fs.writeFileSync(STATE, JSON.stringify(st));
const delay = () => new Promise(r => setTimeout(r, 5));

class MutableFile {
  constructor(storage, id, n) { this.storage = storage; this.nodeId = id; this.name = n.name; this.directory = !!n.dir; this.timestamp = n.ts; this.size = n.data ? Buffer.from(n.data, 'base64').length : 0; this.children = n.dir ? [] : undefined; }
  async mkdir(opt) {
    await delay();
    const name = typeof opt === 'string' ? opt : opt.name;
    const st = load(); const id = 'd' + crypto.randomBytes(5).toString('hex');
    st.nodes[id] = { name, parent: this.nodeId, dir: true, ts: Math.floor(Date.now() / 1000) }; save(st);
    const f = new MutableFile(this.storage, id, st.nodes[id]); f.parent = this; this.children.push(f); this.storage.files[id] = f; return f;
  }
  upload(opt, buf) {
    const complete = (async () => {
      await delay();
      if (process.env.MEGA_MOCK_FAIL_UPLOAD) throw new Error('EAGAIN (-3): A temporary congestion or server malfunction prevented your request from being processed');
      const st = load(); const id = 'f' + crypto.randomBytes(5).toString('hex');
      st.nodes[id] = { name: opt.name, parent: this.nodeId, dir: false, ts: Math.floor(Date.now() / 1000), data: Buffer.from(buf).toString('base64') }; save(st);
      const f = new MutableFile(this.storage, id, st.nodes[id]); f.parent = this; this.children.push(f); this.storage.files[id] = f; return f;
    })();
    return { complete };
  }
  async downloadBuffer() {
    await delay();
    const n = load().nodes[this.nodeId];
    if (!n) throw new Error('ENOENT (-9): Object (typically, node or user) not found');
    return Buffer.from(n.data, 'base64');
  }
  async delete(permanent) {
    await delay();
    if (!permanent) throw new Error('mock: jen trvalé mazání');
    const st = load(); delete st.nodes[this.nodeId]; save(st);
    if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this);
  }
}

class Storage {
  constructor(opts) {
    this.options = opts; this.files = {};
    this.ready = (async () => {
      await delay();
      const st = load();
      st.calls.login++; save(st);
      if (opts.email !== st.account.email || opts.password !== st.account.password) throw new Error('ENOENT (-9): Object (typically, node or user) not found');
      this.email = opts.email; this.name = 'Kapela'; this.sid = 'sid-' + Date.now();
      this._build(st);
      return this;
    })();
  }
  _build(st) {
    this.files = {};
    for (const [id, n] of Object.entries(st.nodes)) this.files[id] = new MutableFile(this, id, n);
    for (const [id, n] of Object.entries(st.nodes)) if (n.parent && this.files[n.parent]) { this.files[id].parent = this.files[n.parent]; this.files[n.parent].children.push(this.files[id]); }
    this.root = this.files.root;
  }
  toJSON() { return { key: 'k', sid: this.sid, name: this.name, user: 'u', options: Object.assign({}, this.options, { password: undefined }), email: this.email }; }
  static fromJSON(json) {
    const s = Object.create(Storage.prototype);
    s.options = json.options; s.sid = json.sid; s.email = json.email; s.name = json.name; s.files = {};
    return s;
  }
  async reload() { await delay(); const st = load(); st.calls.reload++; save(st); if (process.env.MEGA_MOCK_EXPIRED) throw new Error('ESID (-15): Invalid or expired user session'); this._build(st); return []; }
  async getAccountInfo() { return { spaceUsed: 1e6, spaceTotal: 20e9 }; }
}
module.exports = { Storage };
