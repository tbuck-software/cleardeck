#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires -- Standalone release verifier. */

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { URL } = require('url');
const { parse } = require('yaml');
const semver = require('semver');

const { createClient } = require('electron-updater/out/providerFactory');
const { GitHubProvider } = require('electron-updater/out/providers/GitHubProvider');
const { PrivateGitHubProvider } = require('electron-updater/out/providers/PrivateGitHubProvider');
const { configureRequestOptionsFromUrl } = require('builder-util-runtime');

const DEFAULT_OWNER = 'Rasalas';
const DEFAULT_REPO = 'employee-db';
const TOKEN_PATTERN = /(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{20,}/;

function listFiles(root) {
  if (!fs.existsSync(root)) throw new Error(`Path does not exist: ${root}`);
  const stat = fs.statSync(root);
  if (stat.isFile()) return [root];
  if (!stat.isDirectory()) throw new Error(`Expected a file or directory: ${root}`);

  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

function findFiles(root, predicate) {
  return listFiles(root).filter(predicate);
}

function indexAssets(root) {
  const assets = new Map();
  for (const file of listFiles(root)) {
    const name = path.basename(file);
    if (assets.has(name)) throw new Error(`Duplicate release asset basename: ${name}`);
    assets.set(name, file);
  }
  return assets;
}

function requiredAsset(assets, name) {
  const file = assets.get(name);
  if (!file) throw new Error(`Missing Windows release asset: ${name}`);
  return file;
}

function sha512(bytes) {
  return crypto.createHash('sha512').update(bytes).digest('base64');
}

function sha1(bytes) {
  return crypto.createHash('sha1').update(bytes).digest('hex');
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function verifyManifestFile(assets, manifestFile, item, expectedName) {
  if (!item || typeof item !== 'object') throw new Error(`Invalid file entry in ${manifestFile}`);
  if (typeof item.url !== 'string' || path.basename(item.url) !== item.url)
    throw new Error(`Unsafe file name in ${manifestFile}: ${item.url}`);
  if (item.url !== expectedName) throw new Error(`latest.yml must reference ${expectedName}`);
  if (typeof item.sha512 !== 'string') throw new Error(`Missing SHA-512 in ${manifestFile}`);
  if (!Number.isSafeInteger(item.size) || item.size < 0)
    throw new Error(`Missing or invalid size in ${manifestFile}`);

  const file = requiredAsset(assets, item.url);
  const bytes = fs.readFileSync(file);
  if (item.size != null && Number(item.size) !== bytes.length)
    throw new Error(`Size mismatch for ${item.url}`);
  if (sha512(bytes) !== item.sha512)
    throw new Error(`SHA-512 mismatch for ${item.url}`);
  return { name: item.url, size: bytes.length, sha512: item.sha512 };
}

function parseSquirrelReleases(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error('RELEASES is empty');
  return lines.map((line) => {
    const fields = line.split(/\s+/);
    if (fields.length !== 3 || !/^[a-f0-9]{40}$/i.test(fields[0]) || !/^\d+$/.test(fields[2]))
      throw new Error(`Invalid Squirrel RELEASES line: ${line}`);
    return { sha1: fields[0].toLowerCase(), name: fields[1], size: Number(fields[2]) };
  });
}

function verifySquirrelReleases(assets, releaseFile, expectedPackage) {
  const entries = parseSquirrelReleases(releaseFile);
  const packageEntry = entries.find((entry) => entry.name === expectedPackage);
  if (!packageEntry) throw new Error(`RELEASES does not reference ${expectedPackage}`);

  for (const entry of entries) {
    const packageFile = assets.get(entry.name);
    if (!packageFile) throw new Error(`RELEASES references missing package: ${entry.name}`);
    const bytes = fs.readFileSync(packageFile);
    if (bytes.length !== entry.size) throw new Error(`Squirrel size mismatch for ${entry.name}`);
    if (sha1(bytes) !== entry.sha1) throw new Error(`Squirrel SHA-1 mismatch for ${entry.name}`);
  }
  return entries;
}

function verifyWindowsArtifacts(root, expectedVersion) {
  if (typeof expectedVersion !== 'string' || !semver.valid(expectedVersion))
    throw new Error(`Expected a released semantic version, got: ${expectedVersion}`);

  const assets = indexAssets(root);
  const setupName = `ClearDeck-${expectedVersion}-Setup.exe`;
  const packageName = `cleardeck-${expectedVersion}-full.nupkg`;
  const manifestName = 'latest.yml';
  const setupFile = requiredAsset(assets, setupName);
  const packageFile = requiredAsset(assets, packageName);
  const releasesFile = requiredAsset(assets, 'RELEASES');
  const manifestFile = requiredAsset(assets, manifestName);

  let manifest;
  try {
    manifest = parse(fs.readFileSync(manifestFile, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot parse latest.yml: ${error.message}`);
  }
  if (!manifest || typeof manifest !== 'object') throw new Error('latest.yml is empty');
  if (manifest.version !== expectedVersion)
    throw new Error(`Wrong version in latest.yml: ${manifest.version}`);
  if (!Array.isArray(manifest.files) || manifest.files.length !== 1)
    throw new Error('latest.yml must contain exactly one Windows installer');
  if (manifest.path !== setupName || manifest.files[0].url !== setupName)
    throw new Error(`latest.yml must point to ${setupName}`);
  if (manifest.sha512 !== manifest.files[0].sha512)
    throw new Error('latest.yml has inconsistent primary SHA-512 values');

  const manifestArtifact = verifyManifestFile(assets, manifestName, manifest.files[0], setupName);
  if (manifestArtifact.sha512 !== manifest.sha512)
    throw new Error(`SHA-512 mismatch for ${setupName}`);

  const squirrel = verifySquirrelReleases(assets, releasesFile, packageName);
  const packageBytes = fs.readFileSync(packageFile);
  return {
    version: expectedVersion,
    manifest: {
      name: manifestName,
      path: manifest.path,
      files: manifest.files.map((file) => ({ ...file })),
      releaseNotes: manifest.releaseNotes || [],
    },
    artifacts: {
      setup: { name: setupName, size: fs.statSync(setupFile).size, sha512: manifest.sha512 },
      package: { name: packageName, size: packageBytes.length, sha1: sha1(packageBytes) },
      releases: { name: 'RELEASES', size: fs.statSync(releasesFile).size, entries: squirrel },
    },
  };
}

function scanTextForToken(bytes, location) {
  const text = bytes.toString('utf8');
  if (TOKEN_PATTERN.test(text)) throw new Error(`GitHub token pattern found in ${location}`);
}

function extractZip(zipFile, destination) {
  const unzipResult = spawnSync('unzip', ['-qq', '-o', zipFile, '-d', destination], {
    encoding: 'utf8',
  });
  const stderr = String(unzipResult.stderr || '').replace(/\r\n/g, '\n');
  const stdout = String(unzipResult.stdout || '');
  const expectedBackslashWarning =
    `warning:  ${zipFile} appears to use backslashes as path separators\n`;
  if (!unzipResult.error && unzipResult.status === 0) {
    if (stderr || stdout) throw new Error(`Cannot extract ${zipFile}: ${stderr || stdout}`);
    return;
  }
  if (!unzipResult.error && unzipResult.status === 1 && !stdout && stderr === expectedBackslashWarning) return;

  const commandUnavailable = unzipResult.error?.code === 'ENOENT';
  if (process.platform !== 'win32' || !commandUnavailable) {
    const reason = stderr || stdout || unzipResult.error?.message || `unzip exited with ${unzipResult.status}`;
    throw new Error(`Cannot extract ${zipFile}: ${reason}`);
  }

  const powershellArchive = path.extname(zipFile).toLowerCase() === '.nupkg'
    ? path.join(destination, 'package.zip')
    : zipFile;
  if (powershellArchive !== zipFile) fs.copyFileSync(zipFile, powershellArchive);
  const escapedZip = powershellArchive.replace(/'/g, "''");
  const escapedDestination = destination.replace(/'/g, "''");
  try {
    execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedDestination}' -Force`],
      { stdio: 'ignore' },
    );
  } catch (powershellError) {
    throw new Error(`Cannot extract ${zipFile}: ${powershellError.message}`);
  }
}

function findAsar(root) {
  const candidates = findFiles(root, (file) => path.basename(file).toLowerCase() === 'app.asar');
  if (!candidates.length) throw new Error(`No app.asar found under ${root}`);
  const resourceArchive = candidates.find((file) => path.basename(path.dirname(file)).toLowerCase() === 'resources');
  return resourceArchive || candidates[0];
}

function findPackagedConfig(asarFile) {
  const resources = path.dirname(asarFile);
  const candidates = [
    path.join(resources, 'app-update.yml'),
    path.join(resources, '..', 'app-update.yml'),
  ];
  return candidates.find((file) => fs.existsSync(file)) || null;
}

function verifyPublicPackagedConfig(configFile, expected = {}) {
  if (!configFile) throw new Error('Packaged app-update.yml is missing beside app.asar');
  let config;
  try {
    config = parse(fs.readFileSync(configFile, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot parse packaged app-update.yml: ${error.message}`);
  }
  const owner = expected.owner || DEFAULT_OWNER;
  const repo = expected.repo || DEFAULT_REPO;
  if (!config || config.provider !== 'github' || config.owner !== owner || config.repo !== repo)
    throw new Error(`Packaged update source must be GitHub ${owner}/${repo}`);
  if (config.private !== false)
    throw new Error('Packaged GitHub update source must set private: false');
  scanTextForToken(fs.readFileSync(configFile), configFile);
  return { provider: config.provider, owner: config.owner, repo: config.repo, private: config.private };
}

function verifyAsar(asarFile) {
  let asar;
  try {
    asar = require('@electron/asar');
  } catch (error) {
    throw new Error(`Cannot inspect app.asar: @electron/asar is unavailable (${error.message})`);
  }

  scanTextForToken(fs.readFileSync(asarFile), asarFile);
  const entries = asar.listPackage(asarFile);
  if (!entries.length) throw new Error(`app.asar is empty: ${asarFile}`);
  let scannedFiles = 0;
  for (const entry of entries) {
    const normalizedEntry = entry.replace(/^[\\/]+/, '').replace(/[\\/]/g, path.sep);
    try {
      const stat = asar.statFile(asarFile, normalizedEntry);
      if (stat && stat.files) continue;
      const bytes = asar.extractFile(asarFile, normalizedEntry);
      scanTextForToken(bytes, `app.asar:${entry}`);
      scannedFiles += 1;
    } catch (error) {
      if (String(error.message).startsWith('GitHub token pattern found')) throw error;
      throw new Error(`Cannot read app.asar entry ${entry}: ${error.message}`);
    }
  }
  if (!scannedFiles) throw new Error(`app.asar contains no files: ${asarFile}`);
  return { archive: path.basename(asarFile), scannedFiles, sha256: sha256(fs.readFileSync(asarFile)) };
}

function findCandidatePath(root, name) {
  if (!root || !fs.existsSync(root)) return null;
  const direct = path.join(root, name);
  if (fs.existsSync(direct)) return direct;
  return findFiles(root, (file) => path.basename(file) === name)[0] || null;
}

function findCandidateDirectory(root, name) {
  if (!root || !fs.existsSync(root)) return null;
  const direct = path.join(root, name);
  if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) return direct;
  const queue = [root];
  while (queue.length) {
    const current = queue.shift();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const candidate = path.join(current, entry.name);
      if (!entry.isDirectory()) continue;
      if (entry.name === name) return candidate;
      queue.push(candidate);
    }
  }
  return null;
}

function verifyPackagedBundle(candidate, expectedVersion, options = {}) {
  if (!candidate) throw new Error(`No Windows package ZIP or unpacked app.asar found for ${expectedVersion}`);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cleardeck-windows-recovery-'));
  let root = candidate;
  try {
    let directAsar = null;
    if (fs.statSync(candidate).isFile()) {
      if (path.extname(candidate).toLowerCase() === '.asar') {
        directAsar = candidate;
      } else if (!['.zip', '.nupkg'].includes(path.extname(candidate).toLowerCase()))
        throw new Error(`Expected a Windows package ZIP or directory, got ${candidate}`);
      else {
        extractZip(candidate, temporary);
        root = temporary;
      }
    }
    const asarFile = directAsar || findAsar(root);
    const configFile = findPackagedConfig(asarFile);
    const config = configFile
      ? verifyPublicPackagedConfig(configFile, options)
      : options.requireConfig === false
        ? null
        : verifyPublicPackagedConfig(configFile, options);
    const scan = verifyAsar(asarFile);
    return {
      source: path.basename(candidate),
      appAsar: scan,
      updateConfig: config,
    };
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function locateBundle(root, expectedVersion, packageRoot) {
  if (packageRoot) {
    const explicit = path.resolve(packageRoot);
    if (!fs.existsSync(explicit)) throw new Error(`Package root does not exist: ${explicit}`);
    if (fs.statSync(explicit).isFile()) return explicit;
    const exactZip = findCandidatePath(explicit, `ClearDeck-win32-x64-${expectedVersion}.zip`);
    if (exactZip) return exactZip;
    const exactDirectory = findCandidateDirectory(explicit, `ClearDeck-win32-x64-${expectedVersion}`);
    if (exactDirectory) return exactDirectory;
    try {
      findAsar(explicit);
      return explicit;
    } catch {
      // Keep the specific error below for a missing app.asar.
    }
    throw new Error(`Package root has no app.asar or Windows ZIP: ${explicit}`);
  }

  const zipName = `ClearDeck-win32-x64-${expectedVersion}.zip`;
  const inRoot = findCandidatePath(root, zipName);
  if (inRoot) return inRoot;

  const parent = path.dirname(path.resolve(root));
  const siblingDirectory = findCandidateDirectory(parent, `ClearDeck-win32-x64-${expectedVersion}`);
  if (siblingDirectory) return siblingDirectory;

  return null;
}

function nodeHttpExecutor() {
  return {
    request(options) {
      const transport = options.protocol === 'https:' ? https : http;
      return new Promise((resolve, reject) => {
        const request = transport.request(options, (response) => {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            if (response.statusCode < 200 || response.statusCode >= 300) {
              const error = new Error(`Fixture HTTP ${response.statusCode}`);
              error.statusCode = response.statusCode;
              reject(error);
              return;
            }
            resolve(body);
          });
        });
        request.on('error', reject);
        request.end();
      });
    },
  };
}

function atomFeed(owner, repo, version) {
  const tag = `v${version}`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    '<entry>',
    `<title>ClearDeck ${version}</title>`,
    `<link href="http://fixture/${owner}/${repo}/releases/tag/${tag}"/>`,
    '<content>Windows recovery fixture</content>',
    '</entry>',
    '</feed>',
  ].join('');
}

function startFixtureServer(owner, repo, version, manifestText, requests) {
  const latestPath = `/api/v3/repos/${owner}/${repo}/releases/latest`;
  const feedPath = `/${owner}/${repo}/releases.atom`;
  const manifestPath = `/${owner}/${repo}/releases/download/v${version}/latest.yml`;
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, 'http://127.0.0.1');
    const headers = Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key.toLowerCase(), value]));
    requests.push({ path: requestUrl.pathname, headers });
    let body;
    let contentType = 'text/plain';
    if (requestUrl.pathname === latestPath) {
      body = JSON.stringify({ tag_name: `v${version}` });
      contentType = 'application/json';
    } else if (requestUrl.pathname === feedPath) {
      body = atomFeed(owner, repo, version);
      contentType = 'application/atom+xml';
    } else if (requestUrl.pathname === manifestPath) {
      body = manifestText;
      contentType = 'text/yaml';
    }
    if (body == null) {
      response.writeHead(404);
      response.end('not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(body) });
    response.end(body);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, host: `127.0.0.1:${address.port}` });
    });
  });
}

function startPrivateGitHubFixtureServer(owner, repo, version, manifestText, artifactName, requests, token) {
  let host = null;
  const latestPath = `/api/v3/repos/${owner}/${repo}/releases/latest`;
  const manifestPath = `/api/v3/repos/${owner}/${repo}/releases/assets/latest.yml`;
  const artifactPath = `/api/v3/repos/${owner}/${repo}/releases/assets/${artifactName}`;
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, 'http://127.0.0.1');
    const headers = Object.fromEntries(
      Object.entries(request.headers).map(([key, value]) => [key.toLowerCase(), value]),
    );
    requests.push({ path: requestUrl.pathname, headers });

    const authorization = headers.authorization;
    if (authorization !== `token ${token}`) {
      response.writeHead(401);
      response.end('missing or unexpected fixture token');
      return;
    }

    let body;
    let contentType = 'application/octet-stream';
    if (requestUrl.pathname === latestPath) {
      body = JSON.stringify({
        tag_name: `v${version}`,
        name: `ClearDeck ${version}`,
        html_url: `http://${host}${latestPath}`,
        assets: [
          {
            name: 'latest.yml',
            url: `http://${host}${manifestPath}`,
          },
          {
            name: artifactName,
            url: `http://${host}${artifactPath}`,
          },
        ],
      });
      contentType = 'application/vnd.github.v3+json';
    } else if (requestUrl.pathname === manifestPath) {
      body = manifestText;
      contentType = 'text/yaml';
    } else if (requestUrl.pathname === artifactPath) {
      body = `private fixture asset: ${artifactName}`;
    }

    if (body == null) {
      response.writeHead(404);
      response.end('not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': Buffer.byteLength(body),
    });
    response.end(body);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      host = `127.0.0.1:${address.port}`;
      resolve({ server, host });
    });
  });
}

async function verifyPublicGitHubFeed({ version, manifestText, owner = DEFAULT_OWNER, repo = DEFAULT_REPO }) {
  if (typeof manifestText !== 'string') throw new Error('A latest.yml fixture is required for the public feed check');
  const parsedManifest = parse(manifestText);
  const requests = [];
  const fixture = await startFixtureServer(owner, repo, version, manifestText, requests);
  const previous = { GH_TOKEN: process.env.GH_TOKEN, GITHUB_TOKEN: process.env.GITHUB_TOKEN };
  process.env.GH_TOKEN = 'fixture-public-runtime-value';
  process.env.GITHUB_TOKEN = 'fixture-public-runtime-value';

  const updater = {
    allowPrerelease: false,
    channel: null,
    currentVersion: semver.parse('2.1.0'),
    fullChangelog: false,
  };
  const runtimeOptions = {
    isUseMultipleRangeRequest: false,
    platform: 'win32',
    executor: nodeHttpExecutor(),
  };
  try {
    const provider = createClient(
      {
        provider: 'github',
        owner,
        repo,
        private: false,
        protocol: 'http',
        host: fixture.host,
      },
      updater,
      runtimeOptions,
    );
    if (!(provider instanceof GitHubProvider))
      throw new Error('Public GitHub configuration selected an authenticated provider');
    const info = await provider.getLatestVersion();
    const files = provider.resolveFiles(info);
    const expectedUrl = `http://${fixture.host}/${owner}/${repo}/releases/download/v${version}/${parsedManifest.path}`;
    if (info.version !== version) throw new Error(`Public provider selected ${info.version}, expected ${version}`);
    if (files.length !== 1 || files[0].url.href !== expectedUrl)
      throw new Error(`Public provider resolved the wrong artifact URL: ${files.map((file) => file.url.href).join(', ')}`);
    if (JSON.stringify(info.releaseNotes || []) !== JSON.stringify(parsedManifest.releaseNotes || []))
      throw new Error('Public provider returned different release notes');
    if (requests.some((request) => request.headers.authorization))
      throw new Error('Public provider sent an authorization header');
    return {
      provider: 'github',
      owner,
      repo,
      private: false,
      version: info.version,
      artifactUrl: files[0].url.href,
      releaseNotes: info.releaseNotes || [],
      requests: requests.map((request) => ({ path: request.path, authorization: false })),
    };
  } finally {
    fixture.server.close();
    if (previous.GH_TOKEN == null) delete process.env.GH_TOKEN;
    else process.env.GH_TOKEN = previous.GH_TOKEN;
    if (previous.GITHUB_TOKEN == null) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previous.GITHUB_TOKEN;
  }
}

async function verifyPrivateGitHubFeed({ version, manifestText, owner = DEFAULT_OWNER, repo = DEFAULT_REPO }) {
  if (typeof manifestText !== 'string') throw new Error('A latest.yml fixture is required for the private feed check');
  const parsedManifest = parse(manifestText);
  const artifactName = parsedManifest.path;
  if (typeof artifactName !== 'string' || !artifactName) throw new Error('The private feed fixture has no artifact path');

  const requests = [];
  const token = 'fixture-private-runtime-token';
  const fixture = await startPrivateGitHubFixtureServer(
    owner,
    repo,
    version,
    manifestText,
    artifactName,
    requests,
    token,
  );
  const previous = { GH_TOKEN: process.env.GH_TOKEN, GITHUB_TOKEN: process.env.GITHUB_TOKEN };
  process.env.GH_TOKEN = 'unrelated-environment-token';
  process.env.GITHUB_TOKEN = 'another-unrelated-environment-token';

  const updater = {
    allowPrerelease: false,
    channel: null,
    currentVersion: semver.parse('2.1.0'),
    fullChangelog: false,
  };
  const runtimeOptions = {
    isUseMultipleRangeRequest: false,
    platform: 'win32',
    executor: nodeHttpExecutor(),
  };
  try {
    const provider = createClient(
      {
        provider: 'github',
        owner,
        repo,
        // private: false makes the explicit per-installation token win over
        // inherited GH_TOKEN/GITHUB_TOKEN values in electron-updater.
        private: false,
        token,
        protocol: 'http',
        host: fixture.host,
      },
      updater,
      runtimeOptions,
    );
    if (!(provider instanceof PrivateGitHubProvider))
      throw new Error('Private GitHub fixture did not select an authenticated provider');
    if (provider.token !== token)
      throw new Error('Private GitHub provider did not retain the explicit fixture token');

    const info = await provider.getLatestVersion();
    const files = provider.resolveFiles(info);
    const expectedUrl = `http://${fixture.host}${artifactPathFor(owner, repo, artifactName)}`;
    if (info.version !== version) throw new Error(`Private provider selected ${info.version}, expected ${version}`);
    if (files.length !== 1 || files[0].url.href !== expectedUrl)
      throw new Error(`Private provider resolved the wrong artifact URL: ${files.map((file) => file.url.href).join(', ')}`);
    if (JSON.stringify(info.releaseNotes || []) !== JSON.stringify(parsedManifest.releaseNotes || []))
      throw new Error('Private provider returned different release notes');

    const downloadOptions = configureRequestOptionsFromUrl(files[0].url.href, {
      headers: provider.fileExtraDownloadHeaders,
    });
    const downloaded = await runtimeOptions.executor.request(downloadOptions);
    if (downloaded !== `private fixture asset: ${artifactName}`)
      throw new Error('Private provider fixture returned the wrong asset body');

    const expectedAuthorization = `token ${token}`;
    if (requests.length !== 3 || requests.some((request) => request.headers.authorization !== expectedAuthorization))
      throw new Error('Private provider did not authenticate every metadata and asset request with the explicit token');
    if (requests.some((request) =>
      request.headers.authorization === `token ${process.env.GH_TOKEN}` ||
      request.headers.authorization === `token ${process.env.GITHUB_TOKEN}`))
      throw new Error('Private provider used an unrelated environment token');
    if (requests.some((request) => request.path.includes('api.github.com')))
      throw new Error('Private provider fixture made a request outside the local server');

    return {
      provider: 'github',
      owner,
      repo,
      private: true,
      version: info.version,
      artifactUrl: files[0].url.href,
      releaseNotes: info.releaseNotes || [],
      requests: requests.map((request) => ({
        path: request.path,
        authorization: request.headers.authorization === expectedAuthorization,
      })),
    };
  } finally {
    fixture.server.close();
    if (previous.GH_TOKEN == null) delete process.env.GH_TOKEN;
    else process.env.GH_TOKEN = previous.GH_TOKEN;
    if (previous.GITHUB_TOKEN == null) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previous.GITHUB_TOKEN;
  }
}

function artifactPathFor(owner, repo, artifactName) {
  return `/api/v3/repos/${owner}/${repo}/releases/assets/${artifactName}`;
}

async function verifyWindowsRecovery(root, expectedVersion, packageRoot) {
  const artifacts = verifyWindowsArtifacts(root, expectedVersion);
  const portable = verifyPackagedBundle(locateBundle(root, expectedVersion, packageRoot), expectedVersion);
  const assets = indexAssets(root);
  const squirrel = verifyPackagedBundle(
    assets.get(`cleardeck-${expectedVersion}-full.nupkg`),
    expectedVersion,
    { requireConfig: false },
  );
  if (portable.appAsar.sha256 !== squirrel.appAsar.sha256)
    throw new Error('Portable ZIP and Squirrel package contain different app.asar bytes');
  const feed = await verifyPublicGitHubFeed({
    version: expectedVersion,
    manifestText: fs.readFileSync(requiredAsset(indexAssets(root), 'latest.yml'), 'utf8'),
  });
  const privateFeed = await verifyPrivateGitHubFeed({
    version: expectedVersion,
    manifestText: fs.readFileSync(requiredAsset(indexAssets(root), 'latest.yml'), 'utf8'),
  });
  return { version: expectedVersion, artifacts, bundle: { portable, squirrel }, feed, privateFeed };
}

async function main() {
  const [root, expectedVersion, packageRoot] = process.argv.slice(2);
  if (!root || !expectedVersion)
    throw new Error('Usage: node scripts/verify-windows-recovery.cjs <artifact-root> <version> [package-root]');
  const report = await verifyWindowsRecovery(path.resolve(root), expectedVersion, packageRoot);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

module.exports = {
  DEFAULT_OWNER,
  DEFAULT_REPO,
  TOKEN_PATTERN,
  listFiles,
  verifyWindowsArtifacts,
  verifySquirrelReleases,
  verifyAsar,
  verifyPublicPackagedConfig,
  verifyPackagedBundle,
  locateBundle,
  verifyPublicGitHubFeed,
  verifyPrivateGitHubFeed,
  verifyWindowsRecovery,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
