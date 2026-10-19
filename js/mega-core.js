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

  async function login(cfg, fresh) {
    if (!cfg || !cfg.email || !cfg.password) throw new Error('Chybí e-mail nebo heslo k Mega');
    if (!fresh && session && session.email === cfg.email.toLowerCase()) {
      try {
        const s = Storage.fromJSON(JSON.parse(JSON.stringify(session.json)));
        await s.reload(true);
        if (s.root) return s;
      } catch (e) { /* relace vypršela – přihlásit znovu */ }
    }
    const s = new Storage(Object.assign({ email: cfg.email.trim(), password: cfg.password, keepalive: false, autologin: true, autoload: true }, typeof window === 'undefined' ? { userAgent: 'PrompterMini/1.0' } : {}));
    await s.ready;
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
  async function ensureDir(parent, name, st) {
    const found = dirs(parent).filter(c => c.name === name).sort((a, b) => fileCount(b) - fileCount(a));
    const key = parent.nodeId + '/' + name;
    if (!found.length) {
      // Mega vrací čerstvě založenou složku až po chvíli – tuhle jsme už založili, nezakládat znovu
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
    const folderName = (cfg.folder || 'PROMPTER mini').trim();
    const cfgKey = cfg.email.toLowerCase() + '|' + folderName;
    const storage = await login(cfg, fresh);
    for (let i = 0; ; i++) {
      try {
        const st = {};
        let base = await ensureDir(storage.root, folderName, st);
        if (st.merged) { await storage.reload(true); base = await ensureDir(storage.root, folderName); }
        const folders = {};
        for (const s of STORES) folders[s] = await ensureDir(base, s);
        current = { storage, base, folders, cfgKey };
        return current;
      } catch (e) {
        if (!e.stale || i >= 4) throw e;
        await wait(1500 * (i + 1));
        await storage.reload(true);
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
      return { email: c.storage.email || cfg.email, name: c.storage.name || '', folder: c.base.name, space };
    } catch (e) { throw new Error(friendly(e)); }
  }

  function logout() { session = null; current = null; }

  return { test, snapshot, read, commit, logout };
});
