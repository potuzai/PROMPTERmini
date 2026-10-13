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

const Sync = {
  state: 'off',   // off | idle | syncing | error | pending | offline
  lastSync: null,
  lastError: '',
  running: null,
  timer: null,
  listeners: new Set(),

  on(fn) { this.listeners.add(fn); },
  setState(s, err = '') { this.state = s; this.lastError = err; for (const fn of this.listeners) fn(s); },

  schedule() {
    if (!GH.configured() || !Settings.get('autoSync')) { this.refreshState(); return; }
    clearTimeout(this.timer);
    this.refreshState();
    this.timer = setTimeout(() => this.run().catch(() => {}), 8000);
  },

  refreshState() {
    if (this.state === 'syncing') return;
    if (!GH.configured()) return this.setState('off');
    if (!navigator.onLine) return this.setState('offline');
    if (this.state === 'error') return this.setState('error', this.lastError);
    this.setState(Store.pendingCount() ? 'pending' : 'idle');
  },

  run(opts = {}) {
    if (this.running) return this.running;
    this.running = this._run(opts).finally(() => { this.running = null; });
    return this.running;
  },

  async _run(opts) {
    if (!GH.configured()) return { skipped: true };
    if (!navigator.onLine) { this.setState('offline'); return { skipped: true }; }
    this.setState('syncing');
    try {
      let result;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { result = await this._once(opts); break; }
        catch (e) { if (e.retry && attempt < 2) continue; throw e; }
      }
      this.lastSync = new Date();
      this.lastError = '';
      this.setState(Store.pendingCount() && Settings.get('gh').canPush !== false ? 'pending' : 'idle');
      return result;
    } catch (e) {
      console.error(e);
      let msg = e.message;
      if (e.status === 401) msg = 'Neplatný token (401). Zkontroluj nastavení sdílení.';
      else if (e.status === 404) msg = 'Repozitář nenalezen nebo k němu nemáš přístup (404).';
      else if (e.status === 403) msg = 'Přístup odepřen (403) – token nemá oprávnění zápisu?';
      else if (e instanceof TypeError) msg = 'Nelze se připojit ke GitHubu (offline?)';
      this.setState('error', msg);
      throw new Error(msg);
    }
  },

  async _once() {
    const cfg = GH.cfg();
    const branch = cfg.branch || 'main';
    const meta = Store.meta;

    // 1) Aktuální stav větve
    let headSha, treeSha;
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
    treeSha = commit.tree.sha;
    const tree = await GH.req('GET', GH.repoPath(`/git/trees/${treeSha}?recursive=1`));
    const remote = {};
    for (const t of tree.tree) if (t.type === 'blob' && /^data\/(songs|playlists|templates|config)\/[^/]+\.json$/.test(t.path)) remote[t.path] = t.sha;

    // 2) Lokální stav
    const local = {}; // path -> {type, obj, sha, text}
    for (const type of Object.keys(TYPES)) {
      for (const obj of Store[type].values()) {
        const text = Store.serialize(obj);
        local[Store.path(type, obj.id)] = { type, obj, text, sha: gitBlobSha(text) };
      }
    }

    const canPush = cfg.canPush !== false;
    const uploads = [];   // {path, text}
    const deletes = [];   // path
    const downloads = []; // path
    const conflicts = []; // path
    const localDeletes = [];

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
        else if (canPush) uploads.push(p);
      } else if (L && !R) {
        if (K && !localChanged) localDeletes.push(p);
        else if (canPush) uploads.push(p);
      } else if (!L && R) {
        downloads.push(p);
      }
    }

    // 3) Stažení (souběžně)
    const fetched = {};
    const need = [...downloads, ...conflicts];
    let i = 0;
    const worker = async () => {
      while (i < need.length) {
        const p = need[i++];
        const blob = await GH.req('GET', GH.repoPath(`/git/blobs/${remote[p]}`));
        fetched[p] = b64ToText(blob.content);
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, need.length) }, worker));

    const typeOf = p => p.split('/')[1];
    let changedLocal = 0;
    for (const p of downloads) {
      let obj;
      try { obj = JSON.parse(fetched[p]); } catch (e) { console.warn('Vadný soubor', p); continue; }
      await Store.put(typeOf(p), obj, { silent: true, noStamp: true, fromSync: true });
      meta.remote[p] = remote[p];
      meta.local[p] = gitBlobSha(Store.serialize(obj));
      delete meta.tombstones[p];
      changedLocal++;
    }
    for (const p of conflicts) {
      let robj;
      try { robj = JSON.parse(fetched[p]); } catch (e) { continue; }
      const type = typeOf(p);
      const lobj = local[p].obj;
      const localNewer = (lobj.updatedAt || '') > (robj.updatedAt || '');
      const winner = localNewer ? lobj : robj;
      const loser = localNewer ? robj : lobj;
      await Store.put(type, winner, { silent: true, noStamp: true, fromSync: true });
      if (type !== 'config') {
        const copy = clone(loser);
        copy.id = uid();
        if ('title' in copy) copy.title = (copy.title || '') + ` (konflikt – ${loser.updatedBy || '?'})`;
        if ('name' in copy) copy.name = (copy.name || '') + ` (konflikt – ${loser.updatedBy || '?'})`;
        await Store.put(type, copy, { silent: true, noStamp: true, fromSync: true });
        if (canPush) uploads.push(Store.path(type, copy.id));
      }
      meta.remote[p] = remote[p];
      meta.local[p] = gitBlobSha(Store.serialize(robj));
      if (localNewer && canPush) uploads.push(p);
      changedLocal++;
    }
    for (const p of localDeletes) {
      const L = local[p];
      await Store.remove(L.type, L.obj.id, { silent: true, fromSync: true });
      changedLocal++;
    }

    // 4) Odeslání jedním commitem
    let pushed = 0;
    if (canPush && (uploads.length || deletes.length)) {
      const entries = [];
      const newSha = {};
      for (const p of uploads) {
        const type = typeOf(p);
        const id = p.split('/').pop().replace(/\.json$/, '');
        const obj = Store[type].get(id);
        if (!obj) continue;
        const text = Store.serialize(obj);
        entries.push({ path: p, mode: '100644', type: 'blob', content: text });
        newSha[p] = gitBlobSha(text);
      }
      for (const p of deletes) entries.push({ path: p, mode: '100644', type: 'blob', sha: null });
      if (entries.length) {
        const newTree = await GH.req('POST', GH.repoPath('/git/trees'), { base_tree: treeSha, tree: entries });
        const who = currentUserName();
        const newCommit = await GH.req('POST', GH.repoPath('/git/commits'), {
          message: `Změny z aplikace Prompter (${who}): ${uploads.length} upraveno, ${deletes.length} smazáno`,
          tree: newTree.sha, parents: [headSha],
        });
        try {
          await GH.req('PATCH', GH.repoPath(`/git/refs/heads/${encodeURIComponent(branch)}`), { sha: newCommit.sha, force: false });
        } catch (e) {
          if (e.status === 422 || e.status === 409) { const er = new Error('race'); er.retry = true; throw er; }
          throw e;
        }
        for (const p of Object.keys(newSha)) { meta.remote[p] = newSha[p]; meta.local[p] = newSha[p]; }
        for (const p of deletes) { delete meta.remote[p]; delete meta.local[p]; delete meta.tombstones[p]; }
        pushed = entries.length;
      }
    }
    await Store.saveMeta();
    if (changedLocal) Store.emit('sync', null);
    return { downloaded: downloads.length, conflicts: conflicts.length, pushed, removed: localDeletes.length };
  },
};

window.addEventListener('online', () => Sync.schedule());
window.addEventListener('offline', () => Sync.refreshState());
