#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline/promises');

const APP_NAME = 'ClearDeck';
const DEV_PREFIX = 'dev-';

function getAppDataRoot() {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support');
  }
  if (process.platform === 'win32') {
    return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  }
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
}

function getProfileDataDir(target) {
  const profileName = target === 'dev' ? `${DEV_PREFIX}${APP_NAME}` : APP_NAME;
  return path.join(getAppDataRoot(), profileName, 'data');
}

function parseArgs(argv) {
  const flags = new Set(argv.slice(2));
  const rawTarget = argv[2] && !argv[2].startsWith('--') ? argv[2] : 'all';
  const target = ['dev', 'prod', 'all'].includes(rawTarget) ? rawTarget : null;
  return {
    target,
    yes: flags.has('--yes') || flags.has('-y'),
    help: flags.has('--help') || flags.has('-h'),
  };
}

function printHelp() {
  console.log(`Usage: node scripts/nuke-db.js [dev|prod|all] [--yes]

Deletes the ClearDeck data directory for the selected profile(s).

Targets:
  dev   ${getProfileDataDir('dev')}
  prod  ${getProfileDataDir('prod')}
  all   both profiles

Examples:
  npm run nuke:dev
  npm run nuke:prod -- --yes
  npm run nuke:all
`);
}

async function confirm(paths) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log('The following directories will be deleted permanently:');
    paths.forEach((targetPath) => console.log(`- ${targetPath}`));
    const answer = await rl.question("Type 'NUKE' to continue: ");
    return answer.trim() === 'NUKE';
  } finally {
    rl.close();
  }
}

async function main() {
  const { target, yes, help } = parseArgs(process.argv);

  if (help) {
    printHelp();
    return;
  }

  if (!target) {
    console.error("Invalid target. Use 'dev', 'prod' or 'all'.");
    process.exitCode = 1;
    return;
  }

  const targets = target === 'all' ? ['dev', 'prod'] : [target];
  const paths = targets.map((entry) => getProfileDataDir(entry));

  if (!yes) {
    const confirmed = await confirm(paths);
    if (!confirmed) {
      console.log('Aborted.');
      process.exitCode = 1;
      return;
    }
  }

  let removedAny = false;
  paths.forEach((targetPath) => {
    if (!fs.existsSync(targetPath)) {
      console.log(`Skip: ${targetPath} does not exist.`);
      return;
    }
    fs.rmSync(targetPath, { recursive: true, force: true });
    removedAny = true;
    console.log(`Deleted: ${targetPath}`);
  });

  if (!removedAny) {
    console.log('No data directories found.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
