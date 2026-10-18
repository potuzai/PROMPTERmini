'use strict';
/* ===== Synchronizace se soukromým GitHub repozitářem =====
   Každá píseň/playlist/šablona = jeden JSON soubor v data/…
   Všechny změny se odešlou jedním commitem. Konflikty: novější verze vyhrává,
   starší se uloží jako kopie „(konflikt)“, nic se neztratí. */
const GH_API = window.GH_API_OVERRIDE || 'https://api.github.com';

class GhError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

const GH = {
  cfg() { return Settings.get('gh'); },
  configured() { const c = this.cfg(); return !!(c.owner && c.repo && c.token); },

  async req(method, path, body) {
    const c = this.cfg();
    const res = await fetch(GH_API + path, {
      method,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + c.token,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (!res.ok) {
      let msg = res.statusText;
      try { const j = await res.json(); msg = j.message || msg; } catch (e) { /* nic */ }
      throw new GhError(res.status, msg);
    }
    if (res.status === 204) return null;
    return res.json();
  },

  repoPath(p) { const c = this.cfg(); return `/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}${p}`; },

  async test() {
    const user = await this.req('GET', '/user');
    const repo = await this.req('GET', this.repoPath(''));
    return { login: user.login, name: user.name, canPush: !!(repo.permissions && repo.permissions.push), private: repo.private, defaultBranch: repo.default_branch };
  },
};

/* ===== Poskytovatelé úložiště =====
   snapshot() → { remote: {cesta: sha}, extras: [cesty konfliktních kopií], ctx }
   read(cesta, sha, ctx) → text
   commit(uploads [{path,text}], deletes [cesta], ctx) */
const GitHubProvider = {
  name: 'GitHub',
  canPush() { return Settings.get('gh').canPush !== false && !Settings.get('readOnly'); },
  needsNet: true,
  async snapshot() {
    const branch = GH.cfg().branch || 'main';
    let headSha;
    try {
      const ref = await GH.req('GET', GH.repoPath(`/git/ref/heads/${encodeURIComponent(branch)}`));
      headSha = ref.object.sha;
    } catch (e) {
      if (e.status === 409 || e.status === 404) {
        // Prázdný repozitář – založíme první soubor
        await GH.req('PUT', GH.repoPath('/contents/data/README.md'), {
          message: 'Založení úložiště písní', branch,
          content: textToB64('# Data aplikace Prompter\n\nTuto složku spravuje aplikace. Soubory needituj ručně, pokud nemusíš.\n'),
        });
        const err = new Error('init'); err.retry = true; throw err;
      }
      throw e;
    }
    const commit = await GH.req('GET', GH.repoPath(`/git/commits/${headSha}`));
    const tree = await GH.req('GET', GH.repoPath(`/git/trees/${commit.tree.sha}?recursive=1`));
    const remote = {};
    for (const t of tree.tree) if (t.type === 'blob' && DATA_PATH_RE.test(t.path)) remote[t.path] = t.sha;
    return { remote, extras: [], ctx: { headSha, treeSha: commit.tree.sha, branch } };
  },
  async read(path, sha) {
    const blob = await GH.req('GET', GH.repoPath(`/git/blobs/${sha}`));
    return b64ToText(blob.content);
  },
  async commit(uploads, deletes, ctx) {
    const entries = uploads.map(u => ({ path: u.path, mode: '100644', type: 'blob', content: u.text }));
    for (const p of deletes) entries.push({ path: p, mode: '100644', type: 'blob', sha: null });
    const newTree = await GH.req('POST', GH.repoPath('/git/trees'), { base_tree: ctx.treeSha, tree: entries });
    const newCommit = await GH.req('POST', GH.repoPath('/git/commits'), {
      message: `Změny z aplikace Prompter (${currentUserName()}): ${uploads.length} upraveno, ${deletes.length} smazáno`,
      tree: newTree.sha, parents: [ctx.headSha],
    });
    try {
      await GH.req('PATCH', GH.repoPath(`/git/refs/heads/${encodeURIComponent(ctx.branch)}`), { sha: newCommit.sha, force: false });
    } catch (e) {
      if (e.status === 422 || e.status === 409) { const er = new Error('race'); er.retry = true; throw er; }
      throw e;
    }
  },
  errorText(e) {
    if (e.status === 401) return 'Neplatný token (401). Zkontroluj nastavení sdílení.';
    if (e.status === 404) return 'Repozitář nenalezen nebo k němu nemáš přístup (404).';
    if (e.status === 403) return 'Přístup odepřen (403) – token nemá oprávnění zápisu?';
    if (e instanceof TypeError) return 'Nelze se připojit ke GitHubu (offline?)';
    return e.message;
  },
};

/* Sdílená složka (Mega, Proton Drive, OneDrive, Dropbox, síťový disk…) – jen v programu pro Windows */
const FolderProvider = {
  name: 'Sdílená složka',
  canPush() { return !Settings.get('readOnly'); },
  needsNet: false,
  async snapshot() {
    const r = await window.native.folderList(Settings.get('sharedFolder'));
    return { remote: r.files, extras: r.extras, ctx: {} };
  },
  read(path) { return window.native.folderRead(Settings.get('sharedFolder'), path); },
  async commit(uploads, deletes) {
    const dir = Settings.get('sharedFolder');
    for (const u of uploads) await window.native.folderWrite(dir, u.path, u.text);
    for (const p of deletes) await window.native.folderDelete(dir, p);
  },
  errorText(e) { return 'Sdílená složka: ' + ipcError(e); },
};

/* Hesla v nastavení: v programu šifruje Windows (DPAPI), v prohlížeči jen zakódované */
const Secret = {
  protect(text) { return window.native ? window.native.protect(text) : (text ? 'b64:' + textToB64(text) : ''); },
  unprotect(val) {
    if (window.native) return window.native.unprotect(val);
    if (!val) return '';
    return val.startsWith('b64:') ? b64ToText(val.slice(4)) : val;
  },
};

/* Mega v prohlížeči – stejné jádro jako v programu, knihovna se načte až když je potřeba */
const WebMega = {
  core: null,
  async load() {
    if (this.core) return this.core;
    if (!window.mega) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'vendor/megajs-1.3.10.js';
        s.onload = res; s.onerror = () => rej(new Error('Nepodařilo se načíst knihovnu pro Mega'));
        document.head.appendChild(s);
      });
    }
    this.core = createMegaCore(window.mega.Storage);
    return this.core;
  },
  async test(cfg) { return (await this.load()).test(cfg); },
  async snapshot(cfg) { return (await this.load()).snapshot(cfg); },
  async read(cfg, p, v) { return (await this.load()).read(cfg, p, v); },
  async commit(cfg, up, del) { return (await this.load()).commit(cfg, up, del); },
  async logout() { if (this.core) this.core.logout(); },
};

/* Mega přímo – program i prohlížeč se přihlásí samy (bez aplikace MEGA) */
const MegaProvider = {
  name: 'Mega',
  needsNet: true,
  api() {
    const n = window.native;
    return n ? { test: n.megaTest, snapshot: n.megaSnapshot, read: n.megaRead, commit: n.megaCommit, logout: n.megaLogout } : WebMega;
  },
  cfg() {
    const m = Settings.get('mega') || {};
    return { email: m.email || '', password: Secret.unprotect(m.pass || ''), folder: m.folder || 'Prompter kapela' };
  },
  canPush() { return !Settings.get('readOnly'); },
  async snapshot() { const r = await this.api().snapshot(this.cfg()); return { remote: r.files, extras: r.extras, ctx: {} }; },
  read(p, v) { return this.api().read(this.cfg(), p, v); },
  commit(up, del) { return this.api().commit(this.cfg(), up, del); },
  errorText(e) { return ipcError(e); },
};
function ipcError(e) { return String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); }

const DATA_PATH_RE = /^data\/(songs|playlists|templates|config|events|rsvps)\/[A-Za-z0-9_-]+\.json$/;

const Sync = {
  state: 'off',   // off | idle | syncing | error | pending | offline
  lastSync: null,
  lastError: '',
  running: null,
  timer: null,
  listeners: new Set(),

  mode() {
    const m = Settings.get('syncMode');
    if (m === 'folder') return window.native && Settings.get('sharedFolder') ? 'folder' : 'off';
    if (m === 'mega') return (Settings.get('mega') || {}).email ? 'mega' : 'off';
    // GitHub bez uloženého tokenu („nepamatovat“) zůstává připojený – jen zamčený, dokud se nezadá heslo kapely
    const ghOk = GH.configured() || (Settings.data.rememberBand === false && !!(Settings.get('gh') || {}).repo);
    if (m === 'github' || (m === undefined && GH.configured())) return ghOk ? 'github' : 'off';
    return 'off';
  },
  provider() { return { folder: FolderProvider, github: GitHubProvider, mega: MegaProvider }[this.mode()] || null; },
  enabled() { return !!this.provider(); },

  /* Při změně způsobu sdílení začneme porovnávat od nuly (nic se nesmaže, jen se sloučí) */
  async resetMeta() {
    Store.meta.remote = {}; Store.meta.local = {}; Store.meta.tombstones = {};
    await Store.saveMeta();
  },

  on(fn) { this.listeners.add(fn); },
  setState(s, err = '') { this.state = s; this.lastError = err; for (const fn of this.listeners) fn(s); },

  schedule() {
    if (!this.enabled() || !Settings.get('autoSync')) { this.refreshState(); return; }
    clearTimeout(this.timer);
    this.refreshState();
    this.timer = setTimeout(() => this.run().catch(() => {}), this.mode() === 'folder' ? 2000 : 6000);
  },

  /* zařízení si heslo kapely nepamatuje a v tomto otevření prohlížeče ještě nebylo zadané */
  locked() {
    if (Settings.data.rememberBand !== false || window.native) return false;
    const m = this.mode();
    return (m === 'mega' && !(Settings.get('mega') || {}).pass) || (m === 'github' && !(Settings.get('gh') || {}).token);
  },
  refreshState() {
    if (this.state === 'syncing') return;
    const p = this.provider();
    if (!p) return this.setState('off');
    if (this.locked()) return this.setState('locked');
    if (p.needsNet && !navigator.onLine) return this.setState('offline');
    if (this.state === 'error') return this.setState('error', this.lastError);
    this.setState(Store.pendingCount() ? 'pending' : 'idle');
  },

  run(opts = {}) {
    if (this.locked()) { this.refreshState(); return Promise.reject(new Error('Zadej heslo kapely (kliknutím na stav sdílení).')); }
    // už běží: změny z mezitímu by se nepřenesly – navázat jedno další kolo hned po něm
    if (this.running) {
      if (!this.again) this.again = this.running.catch(() => {}).then(() => { this.again = null; return this.run(opts); });
      return this.again;
    }
    this.running = this._run(opts).finally(() => { this.running = null; });
    return this.running;
  },

  async _run(opts) {
    const p = this.provider();
    if (!p) return { skipped: true };
    if (p.needsNet && !navigator.onLine) { this.setState('offline'); return { skipped: true }; }
    this.setState('syncing');
    try {
      let result;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { result = await this._once(p); break; }
        catch (e) { if (e.retry && attempt < 2) continue; throw e; }
      }
      this.lastSync = new Date();
      this.lastError = '';
      this.setState(Store.pendingCount() && p.canPush() ? 'pending' : 'idle');
      Settings.set('lastSyncAt', this.lastSync.toISOString());
      return result;
    } catch (e) {
      console.error(e);
      const msg = p.errorText(e);
      this.setState('error', msg);
      throw new Error(msg);
    }
  },

  async _once(prov) {
    const meta = Store.meta;
    const snap = await prov.snapshot();
    const remote = snap.remote;

    // Lokální stav
    const local = {}; // path -> {type, obj, sha, text}
    for (const type of Object.keys(TYPES)) {
      for (const obj of Store[type].values()) {
        const text = Store.serialize(obj);
        local[Store.path(type, obj.id)] = { type, obj, text, sha: gitBlobSha(text) };
      }
    }

    const canPush = prov.canPush();
    const uploads = [], deletes = [], downloads = [], conflicts = [], localDeletes = [];

    const allPaths = new Set([...Object.keys(remote), ...Object.keys(local), ...Object.keys(meta.tombstones)]);
    for (const p of allPaths) {
      const R = remote[p], L = local[p], K = meta.remote[p], KL = meta.local[p];
      const remoteChanged = R !== K;
      const localChanged = L ? L.sha !== KL : false;
      if (meta.tombstones[p] && !L) {
        if (R && !remoteChanged && canPush) deletes.push(p);
        else if (R && remoteChanged) downloads.push(p);
        if (!R || !canPush || remoteChanged) delete meta.tombstones[p];
        continue;
      }
      if (L && R) {
        if (L.sha === R) { meta.remote[p] = R; meta.local[p] = L.sha; continue; }
        if (!remoteChanged && localChanged) { if (canPush) uploads.push(p); }
        else if (remoteChanged && !localChanged) downloads.push(p);
        else if (remoteChanged && localChanged) conflicts.push(p);
        // jinak: obě strany beze změny od poslední synchronizace – nic
      } else if (L && !R) {
        if (K && !localChanged) localDeletes.push(p);
        else if (canPush) uploads.push(p);
      } else if (!L && R) {
        downloads.push(p);
      }
    }

    // Stažení (souběžně)
    const fetched = {};
    const need = [...downloads, ...conflicts, ...snap.extras];
    let i = 0;
    const worker = async () => {
      while (i < need.length) {
        const p = need[i++];
        try { fetched[p] = await prov.read(p, remote[p], snap.ctx); } catch (e) { if (prov === GitHubProvider) throw e; }
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, need.length) }, worker));
    const parse = p => { try { const o = JSON.parse(fetched[p]); return o && o.id ? o : null; } catch (e) { return null; } };

    const typeOf = p => p.split('/')[1];
    let changedLocal = 0;
    for (const p of downloads) {
      const obj = parse(p);
      if (!obj) { console.warn('Vadný nebo nedokončený soubor', p); continue; } // zkusí se příště
      await Store.put(typeOf(p), obj, { silent: true, noStamp: true, fromSync: true });
      meta.remote[p] = remote[p];
      meta.local[p] = gitBlobSha(Store.serialize(obj));
      delete meta.tombstones[p];
      changedLocal++;
    }
    const saveCopy = async (type, obj) => {
      if (type === 'config' || !obj.updatedAt) return;
      const copy = clone(obj);
      copy.id = uid();
      const who = ` (konflikt – ${obj.updatedBy || '?'})`;
      if ('title' in copy) copy.title = (copy.title || '') + who;
      else if ('name' in copy) copy.name = (copy.name || '') + who;
      await Store.put(type, copy, { silent: true, noStamp: true, fromSync: true });
      if (canPush) uploads.push(Store.path(type, copy.id));
    };
    for (const p of conflicts) {
      const robj = parse(p);
      if (!robj) continue;
      const type = typeOf(p);
      const lobj = local[p].obj;
      // Stejný obsah (např. výchozí šablony u nového člena) – žádný konflikt
      if (gitBlobSha(Store.serialize(robj)) === local[p].sha) { meta.remote[p] = remote[p]; meta.local[p] = local[p].sha; continue; }
      // Nikdy needitovaná místní výchozí data (bez updatedAt) vždy ustoupí sdíleným
      const localNewer = !!lobj.updatedAt && (lobj.updatedAt || '') > (robj.updatedAt || '');
      const winner = localNewer ? lobj : robj;
      const loser = localNewer ? robj : lobj;
      await Store.put(type, winner, { silent: true, noStamp: true, fromSync: true });
      await saveCopy(type, loser);
      meta.remote[p] = remote[p];
      meta.local[p] = gitBlobSha(Store.serialize(robj));
      if (localNewer && canPush) uploads.push(p);
      changedLocal++;
    }
    // Konfliktní kopie, které vytvořila synchronizační aplikace úložiště (např. „píseň (1).json“)
    const extraDeletes = [];
    for (const p of snap.extras) {
      const obj = parse(p);
      const type = typeOf(p);
      if (obj && TYPES[type]) {
        const same = Store[type].get(obj.id);
        if (!same || Store.serialize(same) !== Store.serialize(obj)) { await saveCopy(type, obj); changedLocal++; }
      }
      if (obj && canPush) extraDeletes.push(p);
    }
    for (const p of localDeletes) {
      const L = local[p];
      await Store.remove(L.type, L.obj.id, { silent: true, fromSync: true });
      changedLocal++;
    }

    // Odeslání
    let pushed = 0;
    const upl = [];
    const newSha = {};
    for (const p of new Set(uploads)) {
      const type = typeOf(p);
      const id = p.split('/').pop().replace(/\.json$/, '');
      const obj = Store[type].get(id);
      if (!obj) continue;
      const text = Store.serialize(obj);
      upl.push({ path: p, text });
      newSha[p] = gitBlobSha(text);
    }
    if (canPush && (upl.length || deletes.length || extraDeletes.length)) {
      const versions = (await prov.commit(upl, [...deletes, ...extraDeletes], snap.ctx)) || {};
      for (const p of Object.keys(newSha)) { meta.remote[p] = versions[p] || newSha[p]; meta.local[p] = newSha[p]; }
      for (const p of deletes) { delete meta.remote[p]; delete meta.local[p]; delete meta.tombstones[p]; }
      pushed = upl.length + deletes.length;
    }
    await Store.saveMeta();
    if (changedLocal) Store.emit('sync', null);
    return { downloaded: downloads.length, conflicts: conflicts.length + snap.extras.length, pushed, removed: localDeletes.length };
  },
};

window.addEventListener('online', () => Sync.schedule());
window.addEventListener('offline', () => Sync.refreshState());
