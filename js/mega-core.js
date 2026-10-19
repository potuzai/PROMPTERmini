'use strict';
/* Synchronizace přímo s Mega – společné jádro pro program (Node) i prohlížeč.
   Struktura v Mega: <složka kapely>/songs|playlists|templates|config/<id>.json
   Verze souboru = nodeId (každé nahrání vytvoří nový uzel, starý se smaže). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createMegaCore = factory;
})(typeof self !== 'undefined' ? self : this, function createMegaCore(Storage) {
  const STORES = ['songs', 'playlists', 'templates', 'config'];
  const NAME_RE = /^[A-Za-z0-9_-]+\.json$/;

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

  /* Načte strom souborů. Knihovna zařadí uzel pod rodiče jen tehdy, když rodiče už zná –
     pošle-li Mega podřízený uzel dřív než rodiče, „zmizel“ by (a složka kapely by se zakládala znovu).
     Proto si zapamatujeme rodiče všech uzlů a osiřelé dodatečně zařadíme. */
  async function loadTree(s) {
    if (typeof s._importFile !== 'function') { await s.reload(true); return; }
    const parents = {};
    const orig = s._importFile;
    s._importFile = function (f) { if (f && f.h) parents[f.h] = f.p; return orig.call(this, f); };
    // Knihovna žádá o strom bez „r: 1“ (rekurzivně) – Mega pak vrátí jen kořen, koš a doručené
    // a složka kapely v seznamu chybí (proto vznikaly stále nové). Doplníme ho.
    const api = s.api, req = api && api.request;
    if (req) api.request = function (json, ...rest) { if (json && json.a === 'f' && !json.r) json = Object.assign({}, json, { r: 1 }); return req.call(this, json, ...rest); };
    try { await s.reload(true); } finally { s._importFile = orig; if (req) api.request = req; }
    s._parents = parents;
    for (const [h, p] of Object.entries(parents)) {
      const f = s.files[h], par = p && s.files[p];
      if (f && par && !f.parent && par.children && f !== par) { f.parent = par; par.children.push(f); }
    }
  }

  async function login(cfg, fresh) {
    if (!cfg || !cfg.email || !cfg.password) throw new Error('Chybí e-mail nebo heslo k Mega');
    if (!fresh && session && session.email === cfg.email.toLowerCase()) {
      try {
        const s = Storage.fromJSON(JSON.parse(JSON.stringify(session.json)));
        await loadTree(s);
        if (s.root) return s;
      } catch (e) { /* relace vypršela – přihlásit znovu */ }
    }
    const s = new Storage(Object.assign({ email: cfg.email.trim(), password: cfg.password, keepalive: false, autologin: true, autoload: false }, typeof window === 'undefined' ? { userAgent: 'PrompterMini/1.0' } : {}));
    await s.ready;
    await loadTree(s);
    if (!s.root) throw new Error('Mega nevrátila obsah účtu, zkus to znovu.');
    session = { email: cfg.email.toLowerCase(), json: s.toJSON() };
    return s;
  }

  const dirs = f => (f.children || []).filter(c => c.directory);
  const fileCount = f => (f.children || []).reduce((n, c) => n + (c.directory ? fileCount(c) : 1), 0);
  /* Přesune obsah složky src do dst (stejně pojmenované podsložky se slučují rekurzivně). */
  async function mergeInto(src, dst) {
    for (const c of [...(src.children || [])]) {
      const same = c.directory && dirs(dst).find(d => d.name === c.name);
      if (same) await mergeInto(c, same);
      else await c.moveTo(dst);
    }
  }
  /* Složka podle jména. Když jich je víc stejného jména (vznikly souběžným připojením z více oken
     nebo zařízení), použije se ta s nejvíc daty, obsah ostatních se do ní přesune a prázdné
     kopie jdou do koše Mega. Duplicitní soubory pak vyřeší synchronizace (nejnovější platí). */
  /* Složka podle ID (zapamatovaná z dřívějška), pokud v účtu je a neleží v koši */
  function known(storage, id) {
    const f = id && storage.files && storage.files[id];
    if (!f || !f.directory) return null;
    for (let p = f; p; p = p.parent) if (p === storage.trash) return null;
    return f;
  }
  function stats(storage, name) {
    const all = Object.values(storage.files || {});
    return `uzlů ${all.length}, složek v kořeni ${dirs(storage.root || {}).length}, „${name}“ kdekoli ${all.filter(f => f.directory && f.name === name).length}, ` +
      `bez rodiče ${all.filter(f => !f.parent && f.type < 2).length}, bez jména ${all.filter(f => f.name == null && f.type < 2).length}`;
  }

  async function ensureDir(parent, name, st, preferId) {
    const found = dirs(parent).filter(c => c.name === name).sort((a, b) => fileCount(b) - fileCount(a));
    const key = parent.nodeId + '/' + name;
    if (!found.length) {
      // tuhle složku už známe (z dřívějška nebo jsme ji právě založili) – nezakládat znovu, i když ji Mega v seznamu neukázala
      // (jen když jméno sedí nebo ho nejde přečíst – jiná složka se zapamatovaným ID se nepoužije)
      const k = [known(parent.storage || {}, preferId), known(parent.storage || {}, made[key])].find(f => f && (f.name === name || f.name == null));
      if (k) return k;
      if (made[key]) { const e = new Error('Mega ještě neukazuje novou složku kapely, zkusím to za chvíli.'); e.stale = true; throw e; }
      const d = await parent.mkdir(name);
      made[key] = d.nodeId;
      return d;
    }
    for (const dup of found.slice(1)) {
      try { if (fileCount(dup)) { await mergeInto(dup, found[0]); if (st) st.merged = true; } await dup.delete(false); if (st) st.merged = true; }
      catch (e) { /* zkusí se příště */ }
    }
    return found[0];
  }

  const made = {};   // „rodič/jméno“ → nodeId složek, které tato aplikace založila
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // Připojení se nikdy nesmí překrývat – jinak by si každé založilo vlastní složku kapely
  let lock = Promise.resolve();
  const serial = fn => { const r = lock.then(fn, fn); lock = r.catch(() => {}); return r; };

  function open(cfg, fresh) { return serial(() => openNow(cfg, fresh)); }
  async function openNow(cfg, fresh) {
    const folderName = (cfg.folder || 'PROMPTERmini').trim();
    const cfgKey = cfg.email.toLowerCase() + '|' + folderName;
    const storage = await login(cfg, fresh);
    for (let i = 0; ; i++) {
      try {
        const st = {};
        let base = await ensureDir(storage.root, folderName, st, cfg.folderId);
        if (st.merged) { await loadTree(storage); base = await ensureDir(storage.root, folderName, null, cfg.folderId); }
        const folders = {};
        for (const s of STORES) folders[s] = await ensureDir(base, s);
        current = { storage, base, folders, cfgKey };
        return current;
      } catch (e) {
        if (e.stale && i >= 4) throw new Error(`V účtu Mega nevidím složku „${folderName}“ (${stats(storage, folderName)}). Pošli prosím tuto zprávu.`);
        if (!e.stale) throw e;
        await wait(1500 * (i + 1));
        await loadTree(storage);
      }
    }
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
    return { files, extras, folderId: c.base.nodeId };
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
    try { return new TextDecoder('utf-8').decode(await f.downloadBuffer({})); } catch (e) { throw new Error(friendly(e)); }
  }

  async function commit(cfg, uploads, deletes) {
    if (!current) await snapshot(cfg);
    const versions = {};
    try {
      for (const u of uploads) {
        const { store, name } = splitPath(u.path);
        const folder = current.folders[store];
        const old = (folder.children || []).filter(f => !f.directory && f.name === name);
        const buf = typeof Buffer !== 'undefined' ? Buffer.from(u.text, 'utf8') : new TextEncoder().encode(u.text);
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
      return { email: c.storage.email || cfg.email, name: c.storage.name || '', folder: c.base.name, folderId: c.base.nodeId, space };
    } catch (e) { throw new Error(friendly(e)); }
  }

  function logout() { session = null; current = null; }

  /* Co aplikace v účtu Mega vidí – pro hledání chyb (bez obsahu souborů) */
  async function diag(cfg) {
    try {
      const s = await login(cfg, true);
      const all = Object.values(s.files || {});
      const name = (cfg.folder || 'PROMPTERmini').trim();
      const line = f => `${f.name}  (souborů ${fileCount(f)}, ${f.timestamp ? new Date(f.timestamp * 1000).toLocaleString('cs-CZ') : '?'})`;
      return [
        `uzlů celkem: ${all.length}`,
        `bez rodiče: ${all.filter(f => !f.parent && f !== s.root && f.type < 2).length}`,
        `bez jména: ${all.filter(f => f.name == null && f.type < 2).length}`,
        `složek „${name}“ kdekoli: ${all.filter(f => f.directory && f.name === name).length}`,
        `zapamatovaná složka: ${cfg.folderId ? (known(s, cfg.folderId) ? 'nalezena' : 'NENALEZENA') : '–'}`,
        'v kořeni:', ...dirs(s.root).map(f => '  ' + line(f)),
      ].join('\n');
    } catch (e) { throw new Error(friendly(e)); }
  }

  return { test, snapshot, read, commit, logout, diag };
});
