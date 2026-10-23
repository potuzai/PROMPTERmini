// Spustí všechny testy: statický server, napodobeninu GitHubu, prohlížeč i program (Electron)
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..');
const bg = [
  spawn(process.execPath, [require.resolve('http-server/bin/http-server'), root, '-p', '8123', '-s', '-c-1']),
  spawn(process.execPath, [path.join(__dirname, 'mock-github.js')]),
];
// Kontrola stylů: nevyvážená závorka tiše vyřadí následující pravidla
const fs = require('fs');
for (const f of fs.readdirSync(path.join(root, 'css'))) {
  const css = fs.readFileSync(path.join(root, 'css', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  let d = 0, bad = false;
  for (const c of css) { if (c === '{') d++; else if (c === '}') { d--; if (d < 0) bad = true; } }
  if (bad || d !== 0) { console.log(`FAIL: css/${f} má nevyvážené složené závorky`); process.exitCode = 1; }
  else console.log(`ok: css/${f} – závorky v pořádku`);
}

// Verze musí sedět na všech třech místech (jinak se nová verze webu nenačte nebo program ukáže jinou)
{
  const v = require(path.join(root, 'package.json')).version;
  const app = (/APP_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(root, 'js/db.js'), 'utf8')) || [])[1];
  const sw = (/CACHE = 'prompter-v([^']+)'/.exec(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')) || [])[1];
  if (v !== app || v !== sw) { console.log(`FAIL: verze nesedí – package.json ${v}, db.js ${app}, sw.js ${sw}`); process.exitCode = 1; }
  else console.log(`ok: verze ${v} sedí v package.json, db.js i sw.js`);
}

setTimeout(() => {
  let failed = process.exitCode === 1;
  const xvfb = process.platform === 'linux' && !process.env.DISPLAY;
  const only = process.argv.slice(2);   // např. „node tests/run-all.js full stage“ spustí jen vybrané
  for (const t of ['test-ui.js', 'test-full.js', 'test-stage.js', 'test-design.js', 'test-mobile.js', 'test-sync.js', 'test-folder.js', 'test-mega-order.js', 'test-mega-sc.js', 'test-mega.js', 'test-electron.js']) {
    if (only.length && !only.some(o => t.includes(o))) continue;
    console.log('\n=== ' + t);
    const args = [path.join(__dirname, t)];
    // na GitHubu výstup projde i do anotací (FAIL a chyby jsou vidět u běhu bez stahování logu)
    const gh = !!process.env.GITHUB_ACTIONS;
    const opts = gh ? { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 } : { stdio: 'inherit' };
    const r = xvfb && /folder|mega|electron/.test(t) ? spawnSync('xvfb-run', ['-a', process.execPath, ...args], opts) : spawnSync(process.execPath, args, opts);
    if (gh) {
      process.stdout.write((r.stdout || '') + (r.stderr || ''));
      const bad = (r.stdout || '').split('\n').filter(l => l.startsWith('FAIL'));
      if (r.status !== 0 && !bad.length) bad.push('skončil s chybou: ' + String(r.stderr || r.error || '').trim().split('\n').slice(0, 6).join(' | '));
      for (const l of bad) console.log(`::error title=${t}::${l.replace(/[\r\n]+/g, ' ').slice(0, 900)}`);
    }
    if (r.status !== 0) failed = true;
  }
  bg.forEach(p => p.kill());
  console.log(failed ? '\nNĚKTERÉ TESTY SELHALY' : '\nVŠECHNY TESTY PROŠLY');
  process.exit(failed ? 1 : 0);
}, 1500);
