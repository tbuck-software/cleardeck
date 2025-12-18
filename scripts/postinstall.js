const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const appdmgPath = path.join(__dirname, '..', 'node_modules', 'appdmg');

if (fs.existsSync(appdmgPath)) {
  console.log('appdmg found, applying patches...');
  execSync('npx patch-package', { stdio: 'inherit' });
} else {
  console.log('appdmg not found (not on macOS), skipping patches');
}
