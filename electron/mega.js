'use strict';
/* Synchronizace přímo s Mega (bez aplikace MEGA). Běží v hlavním procesu programu.
   Struktura v Mega: <složka kapely>/songs|playlists|templates|config/<id>.json
   Verze souboru = nodeId (každé nahrání vytvoří nový uzel, starý se smaže). */
const mega = process.env.PROMPTER_MEGA_MOCK ? require(process.env.PROMPTER_MEGA_MOCK) : require('megajs');
const { Storage } = mega;

const STORES = ['songs', 'playlists', 'templates', 'config'];
const NAME_RE = /^[A-Za-z0-9_-]+\.json$/;
const USER_AGENT = 'PrompterPisni/1.0';

let session = null;    // { email, json } – přihlášení se znovu nepoužívá heslo
let current = null;    // { storage, base, folders, byId } – stav poslední načtené struktury

function friendly(e) {
  const m = String((e && e.message) || e);
  if (/ENOENT \(-9\)|EACCESS|-9\b|EKEY|-15\b|ESID|-16\b|EBLOCKED/.test(m)) return 'Mega: špatný e-mail nebo heslo (nebo je účet zablokovaný).';
  if (/-26\b|EMFAREQUIRED|second factor/i.test(m)) return 'Mega: účet má zapnuté dvoufázové ověření – pro kapelu použij účet bez něj.';
  if (/-3\b|EAGAIN|-4\b|ERATELIMIT|-6\b|ETOOMANY/.test(m)) return 'Mega je dočasně přetížená, zkusím to znovu později.';
  if (/-17\b|EOVERQUOTA/.test(m)) return 'Mega: došlo místo nebo přenosový limit účtu.';
  if (/fetch failed|ENOTFOUND|ECONNRE|ETIMEDOUT|EAI_AGAIN|network/i.test(m)) return 'Nelze se připojit k Mega (offline?).';
  return 'Mega: ' + m;
}

async function login(cfg, fresh) {
  if (!cfg || !cfg.email || !cfg.password) throw new Error('Chybí e-mail nebo heslo k Mega');
  if (!fresh && session && session.email === cfg.email.toLowerCase()) {
    try {
      const s = Storage.fromJSON(JSON.parse(JSON.stringify(session.json)));
      await s.reload(true);
      if (s.root) return s;
    } catch (e) { /* relace vypršela – přihlásit znovu */ }
  }
  const s = new Storage({ email: cfg.email.trim(), password: cfg.password, keepalive: false, autologin: true, autoload: true, userAgent: USER_AGENT });
  await s.ready;
  session = { email: cfg.email.toLowerCase(), json: s.toJSON() };
  return s;
}

const dirs = f => (f.children || []).filter(c => c.directory);
async function ensureDir(parent, name) {
  const found = dirs(parent).find(c => c.name === name);
  if (found) return found;
  return parent.mkdir(name);
}

async function open(cfg, fresh) {
  const storage = await login(cfg, fresh);
  const folderName = (cfg.folder || 'Prompter kapela').trim();
  const base = await ensureDir(storage.root, folderName);
  const folders = {};
  for (const s of STORES) folders[s] = await ensureDir(base, s);
  current = { storage, base, folders, cfgKey: cfg.email + '|' + folderName };
  return current;
}

/* Seznam souborů: { files: {cesta: verze}, extras: [cesty duplicit „cesta#nodeId“] } */
async function snapshot(cfg) {
  let c;
  try { c = await open(cfg); } catch (e) {
    if (session) { session = null; try { c = await open(cfg, true); } catch (e2) { throw new Error(friendly(e2)); } }
    else throw new Error(friendly(e));
  }
  const files = {}, extras = [];
  c.byId = {};
  for (const s of STORES) {
    const byName = {};
    for (const f of (c.folders[s].children || [])) {
      if (f.directory) continue;
      c.byId[f.nodeId] = f;
      (byName[f.name] = byName[f.name] || []).push(f);
    }
    for (const [name, list] of Object.entries(byName)) {
      // Dva členové mohli nahrát stejnou píseň zároveň → nejnovější platí, ostatní jako konfliktní kopie
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || String(b.nodeId).localeCompare(String(a.nodeId)));
      if (NAME_RE.test(name)) {
        files[`data/${s}/${name}`] = list[0].nodeId;
        for (const dup of list.slice(1)) extras.push(`data/${s}/${name}#${dup.nodeId}`);
      } else if (/\.json$/i.test(name)) for (const f of list) extras.push(`data/${s}/${name}#${f.nodeId}`);
    }
  }
  return { files, extras };
}

function splitPath(p) {
  const m = /^data\/(songs|playlists|templates|config)\/([^#/]+)(?:#(.+))?$/.exec(p);
  if (!m) throw new Error('Neplatná cesta ' + p);
  return { store: m[1], name: m[2], nodeId: m[3] };
}

async function read(cfg, p, version) {
  if (!current) await snapshot(cfg);
  const { nodeId } = splitPath(p);
  const f = current.byId[nodeId || version];
  if (!f) throw new Error('Soubor už v Mega není: ' + p);
  try { return (await f.downloadBuffer({})).toString('utf8'); } catch (e) { throw new Error(friendly(e)); }
}

async function commit(cfg, uploads, deletes) {
  if (!current) await snapshot(cfg);
  const versions = {};
  try {
    for (const u of uploads) {
      const { store, name } = splitPath(u.path);
      const folder = current.folders[store];
      const old = (folder.children || []).filter(f => !f.directory && f.name === name);
      const buf = Buffer.from(u.text, 'utf8');
      const file = await folder.upload({ name, size: buf.length }, buf).complete;
      versions[u.path] = file.nodeId;
      current.byId[file.nodeId] = file;
      // Starou verzi smazat až po úspěšném nahrání nové (při výpadku se nic neztratí)
      for (const o of old) { try { await o.delete(true); } catch (e) { /* smaže se příště jako duplicita */ } }
    }
    for (const p of deletes) {
      const { store, name, nodeId } = splitPath(p);
      const folder = current.folders[store];
      const targets = nodeId ? [current.byId[nodeId]].filter(Boolean) : (folder.children || []).filter(f => !f.directory && f.name === name);
      for (const t of targets) await t.delete(true);
    }
  } catch (e) { throw new Error(friendly(e)); }
  return versions;
}

async function test(cfg) {
  try {
    const c = await open(cfg, true);
    let space = null;
    try { const a = await c.storage.getAccountInfo(); space = { used: a.spaceUsed, total: a.spaceTotal }; } catch (e) { /* nevadí */ }
    return { email: c.storage.email || cfg.email, name: c.storage.name || '', folder: c.base.name, space };
  } catch (e) { throw new Error(friendly(e)); }
}

function logout() { session = null; current = null; }

module.exports = { test, snapshot, read, commit, logout };
