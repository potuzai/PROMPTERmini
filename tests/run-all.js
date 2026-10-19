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
  for (const t of ['test-ui.js', 'test-full.js', 'test-stage.js', 'test-design.js', 'test-mobile.js', 'test-sync.js', 'test-folder.js', 'test-mega-order.js', 'test-mega.js', 'test-electron.js']) {
    console.log('\n=== ' + t);
    const args = [path.join(__dirname, t)];
    const r = xvfb && /folder|mega|electron/.test(t) ? spawnSync('xvfb-run', ['-a', process.execPath, ...args], { stdio: 'inherit' }) : spawnSync(process.execPath, args, { stdio: 'inherit' });
    if (r.status !== 0) failed = true;
  }
  bg.forEach(p => p.kill());
  console.log(failed ? '\nNĚKTERÉ TESTY SELHALY' : '\nVŠECHNY TESTY PROŠLY');
  process.exit(failed ? 1 : 0);
}, 1500);
