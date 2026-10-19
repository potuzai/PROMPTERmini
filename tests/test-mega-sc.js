// Skutečná knihovna megajs (webová verze ze složky vendor) proti napodobenině serveru Mega, která se chová
// jako Mega podle diagnostiky uživatele: seznam „f“ vrací starý snímek (kořen, doručené, koš) se stavem sn
// a nové / smazané uzly dodává jen jako změny přes „sc“. Bez jejich dotažení aplikace své složky neviděla.
const assert = (c, m) => { if (!c) { console.log('FAIL: ' + m); process.exitCode = 1; } else console.log('ok: ' + m); };
const http = require('http');
const snapshot = [{ h: 'ROOTHHHH', t: 2, ts: 1 }, { h: 'INBOXHHH', t: 3, ts: 1 }, { h: 'TRASHHHH', t: 4, ts: 1 }];
const actions = [];   // [{ sn, a }]
let snN = 0;
const srv = http.createServer((req, res) => {
  let body = ''; req.on('data', d => body += d); req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/sc') {
      const from = +u.searchParams.get('sn').slice(1);
      const pending = actions.filter(x => x.sn > from);
      if (!pending.length) return res.end(JSON.stringify({ w: 'http://localhost:8127/wait', sn: 'S' + from }));
      return res.end(JSON.stringify({ a: pending.map(x => x.a), sn: 'S' + pending[pending.length - 1].sn }));
    }
    const q = JSON.parse(body || '[]')[0] || {};
    if (q.a === 'f') return res.end(JSON.stringify([{ f: snapshot, ok: [], s: [], u: [], sn: 'S0' }]));
    if (q.a === 'p') {
      const n = q.n[0]; const node = { h: 'N' + Math.random().toString(36).slice(2, 9), p: q.t, t: n.t, a: n.a, k: 'USERHAND:' + n.k, ts: 2, u: 'USERHAND' };
      actions.push({ sn: ++snN, a: { a: 't', t: { f: [node] } } });
      return res.end(JSON.stringify([{ f: [node] }]));
    }
    res.end('[0]');
  });
}).listen(8127, async () => { try {
  const path = require('path');
  const code = require('fs').readFileSync(path.join(__dirname, '../vendor/megajs-1.3.10.js'), 'utf8');
  const mega = new Function(code + '; return mega;')();
  const core = require('../js/mega-core.js')(mega.Storage);
  const key = Buffer.alloc(16, 7).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const json = { key, sid: 'SID', name: 'x', user: 'USERHAND', options: { gateway: 'http://localhost:8127/', keepalive: false } };
  const load = async (withCatchUp) => {
    const s = mega.Storage.fromJSON(JSON.parse(JSON.stringify(json)));
    if (withCatchUp) await core._test.loadTree(s); else await s.reload(true);
    return s;
  };
  const s1 = await load(true);
  const d = await s1.root.mkdir('PROMPTERmini');
  await d.mkdir('songs');
  const plain = await load(false);
  assert(Object.keys(plain.files).length === 3 && !(plain.root.children || []).length, 'napodobenina: samotný seznam vrací jen starý snímek (jako skutečná Mega u uživatele)');
  const s2 = await load(true);
  const names = (s2.root.children || []).map(c => c.name);
  assert(names.join() === 'PROMPTERmini' && (s2.root.children[0].children || []).map(c => c.name).join() === 'songs' && s2.caughtUp === 2, 'po dotažení změn je vidět složka kapely i s podsložkou');
  // smazání se také projeví
  actions.push({ sn: ++snN, a: { a: 'd', n: d.nodeId } });
  const s3 = await load(true);
  assert(Object.keys(s3.files).length === 3 && !(s3.root.children || []).length, 'smazání v Mega se po dotažení změn projeví');
  srv.closeAllConnections(); srv.close(); process.exit();
} catch (e) { console.log('FAIL: výjimka', e); process.exit(1); } });
