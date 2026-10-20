#!/usr/bin/env node
/* Sestaví náhled aplikace pro artefakt na claude.ai (s režimem úkolů) do zadané složky:
     node tools/nahled/sestavit.js <složka>
   Skripty a styly bere z index.html, takže náhled vždy odpovídá aktuálnímu stavu větve.
   Data kapely se do repozitáře nedávají: <složka>/data/kapela.json se nepřepisuje a zůstane, pokud tam už je.
   Na konci vypíše seznam souborů k publikování (relativně ke složce). */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const out = process.argv[2] && path.resolve(process.argv[2]);
if (!out) { console.error('Použití: node tools/nahled/sestavit.js <cílová složka>'); process.exit(1); }
if (out === ROOT || out.startsWith(ROOT + path.sep)) { console.error('Cílová složka musí být mimo repozitář (náhled obsahuje data kapely).'); process.exit(1); }

const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = [...index.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const styles = [...index.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m => m[1]);
const version = (fs.readFileSync(path.join(ROOT, 'js', 'db.js'), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '';
const git = cmd => { try { return execSync('git ' + cmd, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch (e) { return ''; } };
const info = {
  vetev: git('rev-parse --abbrev-ref HEAD'),
  commit: git('rev-parse --short HEAD') + (git('status --porcelain') ? '+úpravy' : ''),
  verze: version,
  cas: new Date().toISOString()
};

const files = [];
function copy(rel, from = rel) {
  const dst = path.join(out, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(ROOT, from), dst);
  files.push(rel);
}
function write(rel, text) {
  const dst = path.join(out, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, text);
  files.push(rel);
}

for (const dir of ['js', 'css', 'fonts', 'img', 'vendor', 'nahled']) fs.rmSync(path.join(out, dir), { recursive: true, force: true });
for (const rel of [...scripts, ...styles]) copy(rel);
for (const f of fs.readdirSync(path.join(ROOT, 'fonts'))) copy('fonts/' + f);
for (const f of ['icon.svg', 'icon-192.png']) copy('img/' + f);
for (const f of fs.readdirSync(path.join(ROOT, 'vendor'))) if (f.endsWith('.js')) copy('vendor/' + f);
copy('nahled/ukoly.js', 'tools/nahled/ukoly.js');
write('nahled/info.js', '// Ze kterého stavu repozitáře je náhled sestavený\nwindow.NAHLED = ' + JSON.stringify(info) + ';\n');

const tag = src => `<script src="${src}"></script>`;
write('prompter.html', `<title>PROMPTER mini</title>
<meta name="claude:viewport-fit-sides" content="cover">
${styles.map(s => `<link rel="stylesheet" href="${s}">`).join('\n')}
<style>
  /* Náhled aplikace PROMPTER mini pro připomínky k rozhraní – vzhled je vlastní styl aplikace (css/app.css) */
  :root { color-scheme: dark; }
  html, body { height: 100%; background: var(--bg, #202022); color: var(--text, #f3f3f5); }
</style>
<script>
  // Náhled: bez uvítání, rovnou s daty kapely (jen v tomto prohlížeči, bez připojení k Mega)
  try { if (!localStorage.getItem('prompter-settings')) localStorage.setItem('prompter-settings', JSON.stringify({ welcomed: true })); } catch (e) { /* bez úložiště */ }
</script>
${tag('nahled/info.js')}
${tag('nahled/ukoly.js')}
<div id="main"></div>
${scripts.map(tag).join('\n')}
<script>
  // Při prvním otevření nahrát písně a playlisty kapely (data/kapela.json), pak už se drží v prohlížeči
  (async () => {
    for (let i = 0; i < 100 && !(typeof Store !== 'undefined' && Store.ready); i++) await new Promise(r => setTimeout(r, 50));
    try {
      if (localStorage.getItem('prompter-preview-seeded')) return;
      const data = await (await fetch('data/kapela.json')).json();
      for (const s of [...Store.songs.values()]) if (s.sample) await Store.remove('songs', s.id, { silent: true });
      for (const type of Object.keys(TYPES)) for (const o of data[type] || []) if (o && o.id) await Store.put(type, o, { silent: true, noStamp: true });
      localStorage.setItem('prompter-preview-seeded', '1');
      App.go(true);
    } catch (e) { console.warn('Data kapely se nenačetla', e); }
  })();
</script>
`);

if (!fs.existsSync(path.join(out, 'data', 'kapela.json'))) console.error('Pozor: ve složce chybí data/kapela.json – náhled poběží bez písní kapely.');
console.log(JSON.stringify({ info, files: files.filter(f => f !== 'prompter.html') }, null, 1));
