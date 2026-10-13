// Jednoduchá napodobenina GitHub API (git data) pro testy synchronizace
const http = require('http'); const crypto = require('crypto');
const blobs = {}; // sha -> Buffer
const trees = {}; // sha -> {path: blobSha} (flat)
const commits = {}; // sha -> {tree, parents}
let head = null; let reqLog = [];
const sha = b => crypto.createHash('sha1').update(b).digest('hex');
const blobSha = buf => sha(Buffer.concat([Buffer.from('blob ' + buf.length + '\0'), buf]));
function putBlob(buf) { const s = blobSha(buf); blobs[s] = buf; return s; }
function putTree(map) { const s = sha(Buffer.from(JSON.stringify(Object.entries(map).sort()))); trees[s] = map; return s; }
function putCommit(tree, parents) { const s = sha(Buffer.from(tree + parents.join() + Math.random())); commits[s] = { tree, parents }; return s; }
const srv = http.createServer((req, res) => {
  let body = ''; req.on('data', d => body += d); req.on('end', () => {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Content-Type': 'application/json' };
    const send = (code, obj) => { res.writeHead(code, cors); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
    if (req.method === 'OPTIONS') return send(204);
    const u = req.url.split('?')[0]; reqLog.push(req.method + ' ' + u);
    const j = body ? JSON.parse(body) : {};
    if (u === '/__state') return send(200, { head, files: head ? Object.fromEntries(Object.entries(trees[commits[head].tree]).map(([p, s]) => [p, blobs[s].toString()])) : {}, log: reqLog });
    if (u === '/__edit' && req.method === 'POST') { // simulace změny od jiného člena
      const map = Object.assign({}, trees[commits[head].tree]);
      for (const [p, c] of Object.entries(j)) { if (c === null) delete map[p]; else map[p] = putBlob(Buffer.from(c)); }
      head = putCommit(putTree(map), [head]); return send(200, { ok: 1 });
    }
    if (req.headers.authorization !== 'Bearer TESTTOKEN') return send(401, { message: 'Bad credentials' });
    if (u === '/user') return send(200, { login: 'tester', name: 'Tester' });
    let m;
    if ((m = /^\/repos\/o\/r$/.exec(u))) return send(200, { private: true, default_branch: 'main', permissions: { push: true } });
    if ((m = /^\/repos\/o\/r\/git\/ref\/heads\/main$/.exec(u))) return head ? send(200, { object: { sha: head } }) : send(409, { message: 'Git Repository is empty.' });
    if ((m = /^\/repos\/o\/r\/contents\/(.+)$/.exec(u)) && req.method === 'PUT') {
      const map = head ? Object.assign({}, trees[commits[head].tree]) : {};
      map[m[1]] = putBlob(Buffer.from(j.content, 'base64')); head = putCommit(putTree(map), head ? [head] : []); return send(201, {});
    }
    if ((m = /^\/repos\/o\/r\/git\/commits\/(\w+)$/.exec(u))) return send(200, { tree: { sha: commits[m[1]].tree } });
    if ((m = /^\/repos\/o\/r\/git\/trees\/(\w+)$/.exec(u))) return send(200, { tree: Object.entries(trees[m[1]]).map(([path, s]) => ({ path, sha: s, type: 'blob' })) });
    if ((m = /^\/repos\/o\/r\/git\/blobs\/(\w+)$/.exec(u))) return send(200, { content: blobs[m[1]].toString('base64'), encoding: 'base64' });
    if (u === '/repos/o/r/git/trees' && req.method === 'POST') {
      const map = Object.assign({}, trees[j.base_tree]);
      for (const e of j.tree) { if (e.sha === null) delete map[e.path]; else map[e.path] = putBlob(Buffer.from(e.content, 'utf8')); }
      return send(201, { sha: putTree(map) });
    }
    if (u === '/repos/o/r/git/commits' && req.method === 'POST') return send(201, { sha: putCommit(j.tree, j.parents) });
    if (u === '/repos/o/r/git/refs/heads/main' && req.method === 'PATCH') {
      if (!commits[j.sha].parents.includes(head)) return send(422, { message: 'Update is not a fast forward' });
      head = j.sha; return send(200, {});
    }
    send(404, { message: 'Not Found ' + u });
  });
});
srv.listen(8124, () => console.log('mock on 8124'));
