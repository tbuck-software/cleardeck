#!/usr/bin/env node
/**
 * Generate latest-*.yml files for electron-updater
 *
 * electron-forge doesn't generate these files, but electron-updater needs them
 * to detect and download updates from GitHub releases.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('yaml');

const packageJson = require('../package.json');
const version = packageJson.version;

/**
 * Calculate SHA512 hash of a file (base64 encoded)
 */
function calculateSha512(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha512');
  hash.update(fileBuffer);
  return hash.digest('base64');
}

/**
 * Get file size in bytes
 */
function getFileSize(filePath) {
  return fs.statSync(filePath).size;
}

/**
 * Check if filename contains the current version
 */
function isCurrentVersion(filePath, version) {
  const fileName = path.basename(filePath);
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[-_])${escaped}(?=[-_. ]|$)`).test(fileName);
}

/**
 * Find artifacts in the out/make directory
 * Only includes files matching the current version
 * Prefers ZIP over DMG for macOS (required for auto-update)
 */
function findArtifacts(makeDir, version) {
  const artifacts = {
    mac: [],
    win: [],
    linux: [],
  };

  if (!fs.existsSync(makeDir)) {
    console.error(`Make directory not found: ${makeDir}`);
    return artifacts;
  }

  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        walkDir(filePath);
      } else {
        // Skip files that don't match current version
        if (!isCurrentVersion(filePath, version)) {
          continue;
        }

        const ext = path.extname(file).toLowerCase();

        // macOS: Prefer ZIP for auto-update (DMG cannot be auto-installed)
        if (ext === '.zip' && filePath.includes('darwin')) {
          artifacts.mac.push(filePath);
        }
        // electron-updater downloads an installer on Windows. ZIP and NuGet
        // remain release assets but must not participate in its file resolution.
        else if (ext === '.exe') {
          artifacts.win.push(filePath);
        }
        // Linux artifacts
        else if (ext === '.deb' || ext === '.rpm' || ext === '.appimage') {
          artifacts.linux.push(filePath);
        }
      }
    }
  }

  walkDir(makeDir);
  return artifacts;
}

/**
 * Generate yml content for electron-updater
 */
function generateYml(files, version) {
  if (files.length === 0) return null;

  for (const file of files) {
    if (!/^[A-Za-z0-9._-]+$/.test(path.basename(file))) {
      throw new Error(`Unsafe release filename: ${path.basename(file)}. Use only letters, digits, dots, underscores and hyphens before generating update metadata.`);
    }
  }

  // Use first file as primary
  const primaryFile = files[0];
  const fileName = path.basename(primaryFile);
  const sha512 = calculateSha512(primaryFile);
  const size = getFileSize(primaryFile);

  const ymlContent = {
    version,
    files: files.map((f) => ({
      url: path.basename(f),
      sha512: calculateSha512(f),
      size: getFileSize(f),
    })),
    path: fileName,
    sha512,
    releaseDate: new Date().toISOString(),
  };

  return yaml.stringify(ymlContent);
}

// Main
const makeDir = path.join(__dirname, '..', 'out', 'make');
const outputDir = process.argv[2] || makeDir;

console.log(`Generating update yml files for version ${version}`);
console.log(`Scanning: ${makeDir}`);
console.log(`Output: ${outputDir}`);

const artifacts = findArtifacts(makeDir, version);

// Generate latest-mac.yml
if (artifacts.mac.length > 0) {
  const yml = generateYml(artifacts.mac, version);
  const outPath = path.join(outputDir, 'latest-mac.yml');
  fs.writeFileSync(outPath, yml);
  console.log(`✓ Generated ${outPath}`);
  console.log(`  Files: ${artifacts.mac.map((f) => path.basename(f)).join(', ')}`);
} else {
  console.log('⚠ No macOS artifacts found');
}

// Generate latest.yml (Windows)
if (artifacts.win.length > 0) {
  const yml = generateYml(artifacts.win, version);
  const outPath = path.join(outputDir, 'latest.yml');
  fs.writeFileSync(outPath, yml);
  console.log(`✓ Generated ${outPath}`);
  console.log(`  Files: ${artifacts.win.map((f) => path.basename(f)).join(', ')}`);
} else {
  console.log('⚠ No Windows artifacts found');
}

// Generate latest-linux.yml
if (artifacts.linux.length > 0) {
  const yml = generateYml(artifacts.linux, version);
  const outPath = path.join(outputDir, 'latest-linux.yml');
  fs.writeFileSync(outPath, yml);
  console.log(`✓ Generated ${outPath}`);
  console.log(`  Files: ${artifacts.linux.map((f) => path.basename(f)).join(', ')}`);
} else {
  console.log('⚠ No Linux artifacts found');
}

console.log('\nDone!');
