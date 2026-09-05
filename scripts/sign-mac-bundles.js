const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

function signMacBundles({ platform, outputPaths }, { identity, requireDeveloperId = false } = {}) {
  if (platform !== 'darwin') return;
  if (!Array.isArray(outputPaths) || !outputPaths.length) throw new Error('Forge returned no macOS outputPaths; signing cannot be skipped.');
  if (requireDeveloperId && (!identity || identity === '-')) throw new Error('Mac releases require MAC_SIGN_IDENTITY with a Developer ID Application certificate. Ad-hoc signatures do not support a stable update chain.');
  for (const output of outputPaths) {
    const bundles = output.endsWith('.app') ? [output] : fs.readdirSync(output, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.endsWith('.app')).map((entry) => path.join(output, entry.name));
    if (bundles.length !== 1) throw new Error(`Expected one macOS app in ${output}, found ${bundles.length}.`);
    const bundle = bundles[0];
    // Local ad-hoc packages still need complete resource sealing. Developer ID
    // signing is performed by Packager; never overwrite it with an ad-hoc seal.
    if (!identity || identity === '-') childProcess.execFileSync('codesign', ['--force', '--deep', '--sign', '-', bundle], { stdio: 'pipe' });
    childProcess.execFileSync('codesign', ['--verify', '--deep', '--strict', bundle], { stdio: 'pipe' });
    if (requireDeveloperId) {
      childProcess.execFileSync('codesign', ['--verify', '--strict', '-R', '=anchor apple generic and certificate leaf[field.1.2.840.113635.100.6.1.13] exists', bundle], { stdio: 'pipe' });
    }
  }
}
module.exports = { signMacBundles };
