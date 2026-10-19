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
  const DEFAULT_FOLDER = 'PROMPTERmini';

  let session = null;    // { email, json } – přihlášení se znovu nepoužívá heslo
  let current = null;    // stav poslední synchronizace: { storage, base, folders, cfgKey, files, byId }
  const made = {};       // „rodič/jméno“ → { id } složek, které tato aplikace založila
  const obsolete = new Set();   // staré verze souborů, které se nepodařilo smazat – smažou se příště

  const folderOf = cfg => (cfg.folder || DEFAULT_FOLDER).trim();
  const keyOf = cfg => cfg.email.toLowerCase() + '|' + folderOf(cfg);
  const code = e => String((e && e.message) || e);

  function friendly(e) {
    const m = code(e);
    if (/-26\b|EMFAREQUIRED|second factor/i.test(m)) return 'Mega: účet má zapnuté dvoufázové ověření – pro kapelu použij účet bez něj.';
    if (/-3\b|EAGAIN|-4\b|ERATELIMIT|-6\b|ETOOMANY/.test(m)) return 'Mega je dočasně přetížená, zkusím to znovu později.';
    if (/-17\b|EOVERQUOTA/.test(m)) return 'Mega: došlo místo nebo přenosový limit účtu.';
    if (/-9\b|ENOENT/.test(m)) return 'Mega: soubor nebo složka už v účtu není (možná je mezitím smazal jiný člen) – zkusím to znovu.';
    if (/fetch failed|ENOTFOUND|ECONNRE|ETIMEDOUT|EAI_AGAIN|network/i.test(m)) return 'Nelze se připojit k Mega (offline?).';
    return m.startsWith('Mega') ? m : 'Mega: ' + m;
  }
  const gone = e => /-9\b|ENOENT/.test(code(e));   // uzel už neexistuje – mazání je tím hotové
  const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('Mega neodpovídá (vypršel čas) – zkusím to znovu.')), ms))]);

  /* Načte celý strom souborů účtu.
     - Knihovna žádá o seznam bez „r: 1“ (rekurzivně) a Mega pak vrátí jen kořen, koš a doručené –
       složka kapely v seznamu chyběla a aplikace ji zakládala stále znovu. Doplníme ho.
     - Knihovna zařadí uzel pod rodiče jen tehdy, když rodiče už zná; osiřelé uzly zařadíme dodatečně. */
  async function loadTree(s) {
    const parents = {};
    const api = s.api, req = api && api.request, imp = s._importFile;
    if (req) api.request = function (json, ...rest) { if (json && json.a === 'f' && !json.r) json = Object.assign({}, json, { r: 1 }); return req.call(this, json, ...rest); };
    if (imp) s._importFile = function (f) { if (f && f.h) parents[f.h] = f.p; return imp.call(this, f); };
    try { await timeout(s.reload(true), 90000); }
    finally { if (req) api.request = req; if (imp) s._importFile = imp; }
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
    try { await timeout(s.ready, 90000); }
    catch (e) {
      if (/-9\b|ENOENT|EACCESS|EKEY|-15\b|ESID|-16\b|EBLOCKED/.test(code(e))) { const err = new Error('Mega: špatný e-mail nebo heslo (nebo je účet zablokovaný).'); err.auth = true; throw err; }
      throw e;
    }
    await loadTree(s);
    if (!s.root) throw new Error('Mega nevrátila obsah účtu, zkus to znovu.');
    session = { email: cfg.email.toLowerCase(), json: s.toJSON() };
    return s;
  }

  const dirs = f => (f.children || []).filter(c => c.directory);
  const fileCount = f => (f.children || []).reduce((n, c) => n + (c.directory ? fileCount(c) : 1), 0);
  const loose = n => String(n || '').toLowerCase().replace(/[\s_-]+/g, '');
  /* Přesune obsah složky src do dst (stejně pojmenované podsložky se slučují rekurzivně). */
  async function mergeInto(src, dst) {
    for (const c of [...(src.children || [])]) {
      const same = c.directory && dirs(dst).find(d => d.name === c.name);
      if (same) await mergeInto(c, same);
      else await c.moveTo(dst);
    }
  }
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

  /* Složka podle jména. Když jich je víc stejného jména (vznikly souběžným připojením z více oken
     nebo zařízení), použije se ta s nejvíc daty, obsah ostatních se do ní přesune a prázdné
     kopie jdou do koše Mega. Duplicitní soubory pak vyřeší synchronizace (nejnovější platí).
     o.preferId = zapamatovaná složka, o.loose = najít i „PROMPTER mini“ / „prompterMINI“,
     o.create = false → nezakládat, jen ohlásit, že chybí. */
  async function ensureDir(parent, name, st, o = {}) {
    let found = dirs(parent).filter(c => c.name === name);
    if (!found.length && o.loose) found = dirs(parent).filter(c => loose(c.name) === loose(name));
    found.sort((a, b) => fileCount(b) - fileCount(a));
    const key = parent.nodeId + '/' + name;
    if (!found.length) {
      // tuhle složku už známe (z dřívějška nebo jsme ji právě založili) – nezakládat znovu, i když ji Mega v seznamu neukázala
      const mk = made[key];
      const k = [known(parent.storage || {}, o.preferId), known(parent.storage || {}, mk && mk.id)].find(f => f && (f.name === name || f.name == null));
      if (k) return k;
      // právě založenou složku Mega neukazuje – nezakládat hned další (rozhodne openNow: počkat, nebo byla smazaná)
      if (mk) { const e = new Error(`V účtu Mega nevidím složku „${name}“, kterou aplikace právě založila (${stats(parent.storage || {}, name)}).`); e.invisible = key; throw e; }
      // dřív používaná složka kapely chybí a Mega nevrací v kořeni nic → seznam je neúplný, nezakládat další
      if (o.preferId && !dirs(parent).length && parent === (parent.storage || {}).root) {
        throw new Error(`V účtu Mega nevidím žádné složky, ani dříve používanou „${name}“ (${stats(parent.storage || {}, name)}). Seznam od Mega je zřejmě neúplný – nic nezakládám. Pošli prosím výpis z Diagnostiky.`);
      }
      if (o.create === false) {
        const other = dirs(parent).map(d => d.name).filter(Boolean);
        const e = new Error(`V účtu Mega zatím není složka „${name}“.` + (other.length ? ` Jsou tam: ${other.map(n => '„' + n + '“').join(', ')}.` : ''));
        e.noFolder = true;
        throw e;
      }
      const d = await parent.mkdir(name);
      made[key] = { id: d.nodeId };
      if (st) st.created = true;
      return d;
    }
    for (const dup of found.slice(1)) {
      try { if (fileCount(dup)) await mergeInto(dup, found[0]); await dup.delete(false); if (st) st.merged = true; }
      catch (e) { /* zkusí se příště */ }
    }
    return found[0];
  }

  // Připojení se nikdy nesmí překrývat – jinak by si každé založilo vlastní složku kapely
  let lock = Promise.resolve();
  const serial = fn => { const r = lock.then(fn, fn); lock = r.catch(() => {}); return r; };

  function open(cfg, fresh, create) { return serial(() => openNow(cfg, fresh, create)); }
  async function openNow(cfg, fresh, create) {
    const name = folderOf(cfg);
    let storage = await login(cfg, fresh), created = false, waited = false;
    for (let i = 0; ; i++) {
      const st = {};
      let base, folders = {};
      try {
        base = await ensureDir(storage.root, name, st, { preferId: cfg.folderId, loose: true, create });
        for (const s of STORES) folders[s] = await ensureDir(base, s, st);
      } catch (e) {
        if (!e.invisible || i >= 4) throw e;
        // složku, kterou jsme založili, Mega nevrací: chvíli počkat; když pořád chybí, někdo ji smazal → založit znovu
        if (!waited) { waited = true; await new Promise(r => setTimeout(r, 2000)); }
        else if (!dirs(storage.root || {}).length) throw new Error(e.message + ' Seznam od Mega je zřejmě neúplný – nic dalšího nezakládám. Pošli prosím výpis z Diagnostiky.');
        else delete made[e.invisible];
        storage = await login(cfg);
        continue;
      }
      created = created || !!st.created;
      // po sloučení duplicit je strom v paměti zastaralý (knihovna přesuny nepromítá) – načíst znovu
      if (!st.merged || i >= 4) return { storage, base, folders, cfgKey: keyOf(cfg), created };
      storage = await login(cfg);
    }
  }

  /* Seznam souborů: { files: {cesta: verze}, extras: [cesty duplicit „cesta#nodeId“], folderId } */
  async function snapshot(cfg) {
    let c;
    try { c = await open(cfg); } catch (e) {
      if (e.auth || !session) throw new Error(friendly(e));
      session = null;
      try { c = await open(cfg, true); } catch (e2) { throw new Error(friendly(e2)); }
    }
    const files = {}, extras = [];
    c.byId = {};
    for (const s of STORES) {
      const byName = {};
      for (const f of (c.folders[s].children || [])) {
        if (f.directory) continue;
        c.byId[f.nodeId] = f;
        if (obsolete.has(f.nodeId)) continue;   // stará verze, kterou jsme už nahradili – není to konflikt
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
    c.files = files;
    current = c;
    return { files, extras, folderId: c.base.nodeId };
  }

  function splitPath(p) {
    const m = /^data\/(songs|playlists|templates|config)\/([^#/]+)(?:#(.+))?$/.exec(p);
    if (!m) throw new Error('Neplatná cesta ' + p);
    return { store: m[1], name: m[2], nodeId: m[3] };
  }
  /* čtení a zápis patří k poslední synchronizaci téhož účtu a složky (jinak by mohly zapsat jinam) */
  function cur(cfg) {
    if (!current || current.cfgKey !== keyOf(cfg)) throw new Error('Mega: synchronizace se přerušila, zkusím to znovu.');
    return current;
  }

  async function read(cfg, p, version) {
    const c = cur(cfg);
    const { nodeId } = splitPath(p);
    const f = c.byId[nodeId || version];
    if (!f) throw new Error('Soubor už v Mega není: ' + p);
    try { return new TextDecoder('utf-8').decode(await f.downloadBuffer({})); } catch (e) { throw new Error(friendly(e)); }
  }

  async function remove(node, permanent) {
    try { await node.delete(permanent); return true; } catch (e) { if (gone(e)) return true; throw e; }
  }

  async function commit(cfg, uploads, deletes) {
    const c = cur(cfg);
    const versions = {};
    try {
      for (const id of [...obsolete]) {
        const o = c.byId[id];
        if (!o) { obsolete.delete(id); continue; }
        try { if (await remove(o, true)) obsolete.delete(id); } catch (e) { /* příště */ }
      }
      for (const u of uploads) {
        const { store, name } = splitPath(u.path);
        const folder = c.folders[store];
        const old = c.byId[c.files[u.path]];   // jen verze, se kterou synchronizace počítala – souběžné úpravy jiných zůstanou
        const buf = typeof Buffer !== 'undefined' ? Buffer.from(u.text, 'utf8') : new TextEncoder().encode(u.text);
        const file = await folder.upload({ name, size: buf.length }, buf).complete;
        versions[u.path] = file.nodeId;
        c.byId[file.nodeId] = file; c.files[u.path] = file.nodeId;
        // Starou verzi smazat až po úspěšném nahrání nové (při výpadku se nic neztratí)
        if (old) { try { await remove(old, true); } catch (e) { obsolete.add(old.nodeId); } }
      }
      for (const p of deletes) {
        const { nodeId } = splitPath(p);
        // konfliktní kopie (už uložené jako kopie v aplikaci) se mažou natrvalo, smazané písně do koše Mega (dají se obnovit)
        const t = nodeId ? c.byId[nodeId] : c.byId[c.files[p]];
        if (t) await remove(t, !!nodeId);
        if (!nodeId) delete c.files[p];
      }
    } catch (e) { throw new Error(friendly(e)); }
    return versions;
  }

  /* Ověří přihlášení a složku kapely. cfg.create === false → složku nezakládat (ohlásí noFolder). */
  async function test(cfg) {
    let c;
    try { c = await open(cfg, true, cfg.create); }
    catch (e) {
      if (e.noFolder) throw e;
      throw new Error(friendly(e));
    }
    let space = null;
    try { const a = await c.storage.getAccountInfo(); space = { used: a.spaceUsed, total: a.spaceTotal }; } catch (e) { /* nevadí */ }
    return { email: c.storage.email || cfg.email, name: c.storage.name || '', folder: c.base.name, folderId: c.base.nodeId, created: c.created, space };
  }

  function logout() { session = null; current = null; for (const k of Object.keys(made)) delete made[k]; obsolete.clear(); }

  /* Přímé dotazy na seznam souborů s různými parametry – co přesně Mega vrací (jen počty, žádné názvy ani klíče) */
  async function rawListing(s) {
    if (!s.api || typeof s.api.request !== 'function') return [];
    const raw = q => new Promise((res, rej) => s.api.request(Object.assign({}, q), (err, r) => err ? rej(err) : res(r)));
    const out = ['přímé dotazy (počet uzlů podle typu: 0 soubor, 1 složka, 2 kořen, 3 doručené, 4 koš):'];
    for (const [label, q] of [['f c', { a: 'f', c: 1 }], ['f c r', { a: 'f', c: 1, r: 1 }], ['f c r ca', { a: 'f', c: 1, r: 1, ca: 1 }]]) {
      try {
        const r = await timeout(raw(q), 60000);
        if (!r || typeof r !== 'object') { out.push(`  ${label}: ${JSON.stringify(r)}`); continue; }
        const f = Array.isArray(r.f) ? r.f : [], types = {};
        for (const n of f) types[n.t] = (types[n.t] || 0) + 1;
        const rootH = (f.find(n => n.t === 2) || {}).h;
        out.push(`  ${label}: klíče ${Object.keys(r).join(',')}; uzlů ${f.length} (${Object.entries(types).map(([t, n]) => t + ':' + n).join(' ')}); v kořeni ${f.filter(n => rootH && n.p === rootH).length}` +
          `; s klíčem uživatele ${f.filter(n => typeof n.k === 'string' && s.user && n.k.split('/').some(p => p.split(':')[0] === s.user)).length}` +
          Object.keys(r).filter(k => k !== 'f' && Array.isArray(r[k])).map(k => `; ${k}=${r[k].length}`).join(''));
      } catch (e) { out.push(`  ${label}: chyba ${code(e)}`); }
    }
    return out;
  }

  /* Co aplikace v účtu Mega vidí – pro hledání chyb (bez obsahu souborů) */
  async function diag(cfg) {
    try {
      const s = await login(cfg, true);
      const all = Object.values(s.files || {});
      const name = folderOf(cfg);
      const line = f => `${f.name}  (souborů ${fileCount(f)}, ${f.timestamp ? new Date(f.timestamp * 1000).toLocaleString('cs-CZ') : '?'})`;
      return [
        `uzlů celkem: ${all.length}`,
        `bez rodiče: ${all.filter(f => !f.parent && f !== s.root && f.type < 2).length}`,
        `bez jména: ${all.filter(f => f.name == null && f.type < 2).length}`,
        `složek „${name}“ kdekoli: ${all.filter(f => f.directory && f.name === name).length}`,
        `zapamatovaná složka: ${cfg.folderId ? (known(s, cfg.folderId) ? 'nalezena' : 'NENALEZENA') : '–'}`,
        'v kořeni:', ...dirs(s.root).map(f => '  ' + line(f)),
        ...(await rawListing(s)),
      ].join('\n');
    } catch (e) { throw new Error(friendly(e)); }
  }

  return { test, snapshot, read, commit, logout, diag };
});
