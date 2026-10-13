// Spustí všechny testy: statický server, napodobeninu GitHubu, prohlížeč i program (Electron)
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..');
const bg = [
  spawn(process.execPath, [require.resolve('http-server/bin/http-server'), root, '-p', '8123', '-s', '-c-1']),
  spawn(process.execPath, [path.join(__dirname, 'mock-github.js')]),
];
setTimeout(() => {
  let failed = false;
  const xvfb = process.platform === 'linux' && !process.env.DISPLAY;
  for (const t of ['test-ui.js', 'test-full.js', 'test-sync.js', 'test-folder.js', 'test-electron.js']) {
    console.log('\n=== ' + t);
    const args = [path.join(__dirname, t)];
    const r = xvfb && /folder|electron/.test(t) ? spawnSync('xvfb-run', ['-a', process.execPath, ...args], { stdio: 'inherit' }) : spawnSync(process.execPath, args, { stdio: 'inherit' });
    if (r.status !== 0) failed = true;
  }
  bg.forEach(p => p.kill());
  console.log(failed ? '\nNĚKTERÉ TESTY SELHALY' : '\nVŠECHNY TESTY PROŠLY');
  process.exit(failed ? 1 : 0);
}, 1500);
