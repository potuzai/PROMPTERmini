'use strict';
/* ===== Obrazovky kapely (sdílené profily) a osobní zobrazení zařízení =====
   Píseň je jedna pro všechny. Profil obrazovky určuje rozměr stránky a velikost písma.
   Každé zařízení si vybere svůj profil a k němu si může nastavit vlastní věci
   (písmo, zvýraznění svých řádků, soukromé poznámky). */

const Screens = {
  /* Hlavní čtečka: rozměr zůstává ve sdíleném „display“ (kvůli starším verzím) */
  main() {
    const d = (typeof Store !== 'undefined' && Store.config && Store.config.get('display')) || {};
    return {
      id: 'main', name: d.name || 'Hlavní čtečka',
      w: Settings.get('screenW'), h: Settings.get('screenH'),
      diag: Settings.get('diagonal') || 24, dist: Settings.get('distance') || 2.5,
      fontPct: d.fontPct || 100,
    };
  },
  others() { return ((typeof Store !== 'undefined' && Store.config && Store.config.get('screens')) || { list: [] }).list || []; },
  list() { return [this.main(), ...this.others()]; },
  get(id) {
    if (id === 'auto') return this.auto();
    return (id && id !== 'main' && this.others().find(s => s.id === id)) || this.main();
  },
  /* „Podle okna“ (web, mobil): stránka má tvar okna prohlížeče. Kratší strana = 1080 px,
     takže písmo ze šablony (navržené pro monitor 1080 px) zůstane v poměru čitelné. */
  auto() {
    const iw = Math.max(1, window.innerWidth), ih = Math.max(1, window.innerHeight);
    const k = 1080 / Math.min(iw, ih);
    return { id: 'auto', name: 'Podle okna', w: Math.round(iw * k), h: Math.round(ih * k), diag: 0, dist: 0, fontPct: 100 };
  },
  /* obrazovka tohoto zařízení: program = hlavní čtečka, web = podle okna (dokud si ji člověk nezvolí) */
  myId() { return Settings.get('screenId') || (window.native ? 'main' : 'auto'); },
  mine() { return this.get(this.myId()); },
  /* obrazovka, kterou upravuji / ukazuji v náhledu („podle okna“ nemá pevný rozměr → hlavní čtečka) */
  editId() { const id = this.myId(); return id === 'auto' ? 'main' : id; },
  /* obrazovka zvolená v editoru písně („Náhled pro“) – podle ní se ukazují i náhledy stránek */
  edit() { return this.get(Settings.get('editScreen') || this.editId()); },

  async save(scr) {
    if (scr.id === 'main') {
      Settings.set('screenW', Math.max(320, scr.w | 0)); Settings.set('screenH', Math.max(240, scr.h | 0));
      Settings.set('diagonal', +scr.diag || 24); Settings.set('distance', +scr.dist || 2.5);
      const old = Store.config.get('display') || {};
      const d = Object.assign({ id: 'display', portraitMigrated: true }, old, { name: scr.name, fontPct: scr.fontPct });
      if (JSON.stringify([old.name, old.fontPct]) !== JSON.stringify([d.name, d.fontPct])) await Store.put('config', d, { silent: true });
      return;
    }
    const list = this.others().map(s => s.id === scr.id ? Object.assign({}, scr) : s);
    if (!list.some(s => s.id === scr.id)) list.push(Object.assign({}, scr));
    if (JSON.stringify(list) !== JSON.stringify(this.others())) await Store.put('config', { id: 'screens', list });
  },
  async add(base) {
    const scr = Object.assign({ id: 's' + uid(), name: 'Nová obrazovka', w: 1080, h: 1920, diag: 11, dist: 0.8, fontPct: 100 }, base || {});
    await this.save(scr);
    return scr;
  },
  async remove(id) {
    if (id === 'main') return;
    await Store.put('config', { id: 'screens', list: this.others().filter(s => s.id !== id) });
    if (Settings.get('screenId') === id) Settings.set('screenId', '');
  },

  /* Velikost písma: profil × osobní zvětšení */
  fontScale(scr, personal) { return (scr.fontPct || 100) / 100 * (personal ? (Settings.get('readerZoom') || 1) : 1); },
  label(scr) { return scr.id === 'auto' ? 'Podle okna (přizpůsobí se displeji)' : `${scr.name} · ${scr.w}×${scr.h}`; },
};

/* Soukromé poznámky k písni – jen v tomto zařízení, nesdílí se */
const PrivateNotes = {
  get(id) { return (Settings.get('privateNotes') || {})[id] || ''; },
  set(id, text) {
    const all = Object.assign({}, Settings.get('privateNotes') || {});
    if (text.trim()) all[id] = text; else delete all[id];
    Settings.set('privateNotes', all);
  },
};

/* Volby vykreslení pro danou obrazovku (konce stránek, soukromá poznámka, zvýraznění mých řádků) */
function screenOpts(scr, songId, personal) {
  return {
    screen: scr.id,
    note: personal ? PrivateNotes.get(songId) : '',
    mine: personal && Settings.get('highlightMine') ? Settings.get('mySinger') || '' : '',
  };
}
