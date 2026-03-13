#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

const packageJson = require('../package.json');

const appName = packageJson.productName || packageJson.name || 'app';
const args = process.argv.slice(2);
const profileArg = args.find((arg) => arg.startsWith('--profile='));
const dryRun = args.includes('--dry-run');
const profile = profileArg ? profileArg.split('=')[1] : 'dev';

if (!['dev', 'prod'].includes(profile)) {
  console.error('Unbekanntes Profil. Erlaubt sind --profile=dev oder --profile=prod.');
  process.exit(1);
}

const profileName = profile === 'dev' ? `dev-${appName}` : appName;

const getAppDataPath = () => {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support');
    case 'win32':
      return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    default:
      return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  }
};

const profilePath = path.join(getAppDataPath(), profileName);

if (dryRun) {
  console.log(`Dry-Run ${profile}: ${profilePath}`);
  process.exit(0);
}

if (fs.existsSync(profilePath)) {
  fs.rmSync(profilePath, { recursive: true, force: true });
  console.log(`${profile === 'dev' ? 'Dev' : 'Prod'}-Profil entfernt: ${profilePath}`);
} else {
  console.log(`${profile === 'dev' ? 'Dev' : 'Prod'}-Profil nicht vorhanden: ${profilePath}`);
}

if (profile === 'dev') {
  console.log('Beim naechsten "npm start" wird die Dev-Datenbank neu angelegt und frisch geseedet.');
} else {
  console.log('Beim naechsten Start der installierten App wird die Produktiv-Datenbank neu angelegt und frisch geseedet.');
}
