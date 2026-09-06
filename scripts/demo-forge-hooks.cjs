/* eslint-disable @typescript-eslint/no-var-requires -- Forge configuration helper. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const control = require('./demo-control.cjs');
let currentChild;
let disconnected = false;
process.once('disconnect', () => {
  disconnected = true;
  if (currentChild) currentChild.kill('SIGTERM');
});
// npm/terminal shutdown can close the wrapper before its signal handler runs.
// Keep the detached Forge process responsible for stopping its own Electron.
process.once('exit', () => {
  const lock = path.join(process.env.CLEARDECK_DEMO_ROOT, '.cache', 'cleardeck-demo-runner.lock');
  if (!fs.existsSync(lock)) return;
  const pid = Number(fs.readFileSync(lock, 'utf8'));
  if (!Number.isInteger(pid) || pid < 1) return;
  try {
    process.kill(pid, 0);
  } catch (error) {
    if (error.code === 'ESRCH') fs.rmSync(lock, { force: true });
  }
});
process.on('message', (message) => {
  if (message.type === 'demo-stop' && currentChild) currentChild.kill('SIGTERM');
});
// Forge owns compilation/live reload. Main/preload changes request its normal
// rs lifecycle. Ignore shared compilation hashes that also change for CSS.
class DemoRestartPlugin {
  apply(compiler) {
    // Sandboxed preload bundles have target "web" in Forge, too.
    const preload = compiler.options.output.filename === '[name]/preload.js';
    const target = preload ? 'electron-preload' : compiler.options.target;
    if (target !== 'electron-main' && !preload) return;
    let previous;
    compiler.hooks.done.tap('DemoRestartPlugin', (stats) => {
      if (stats.hasErrors()) return;
      const hash = crypto.createHash('sha256');
      const resources = new Set(
        [...stats.compilation.modules].map((module) => module.resource).filter(Boolean),
      );
      for (const file of [...resources].sort()) {
        if (
          !file.startsWith(process.env.CLEARDECK_DEMO_ROOT + path.sep) ||
          file.includes(`${path.sep}node_modules${path.sep}`) ||
          file.includes(`${path.sep}.webpack${path.sep}`)
        )
          continue;
        if (fs.existsSync(file) && fs.statSync(file).isFile())
          hash.update(file).update(fs.readFileSync(file));
      }
      const signature = hash.digest('hex');
      const changed = previous && previous !== signature;
      previous = signature;
      if (changed && process.connected) process.send({ type: 'demo-build', target });
    });
  }
}
const postStart = (_config, child) => {
  currentChild = child;
  const kill = child.kill.bind(child);
  let stopping = false;
  child.kill = (signal) => {
    if (signal !== 'SIGTERM') return kill(signal);
    if (stopping) return true;
    stopping = true;
    void control.stop(child.pid).catch((error) => {
      stopping = false;
      console.error(error.message);
    });
    return true;
  };
  if (disconnected) child.kill('SIGTERM');
  else if (process.connected) process.send({ type: 'demo-started', pid: child.pid });
};
module.exports = { DemoRestartPlugin, postStart };
