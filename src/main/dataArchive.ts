import fs from 'fs';
import path from 'path';
import { getConfigPath, getDataDir, getEncryptedDbPath, getWorkingDbPath } from './appPaths';

const ARCHIVE_DIR_NAME = 'archived-resets';

const createArchiveDir = (): string => {
  const baseDir = path.join(getDataDir(), ARCHIVE_DIR_NAME);
  fs.mkdirSync(baseDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  let attempt = 0;

  for (;;) {
    const suffix = attempt === 0 ? '' : `-${attempt}`;
    const target = path.join(baseDir, `reset-${stamp}${suffix}`);
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
      return target;
    }
    attempt += 1;
  }
};

export const archiveAppData = (): string | null => {
  const candidates = [getConfigPath(), getEncryptedDbPath(), getWorkingDbPath()].filter((filePath) =>
    fs.existsSync(filePath),
  );

  if (candidates.length === 0) {
    return null;
  }

  const archiveDir = createArchiveDir();
  candidates.forEach((filePath) => {
    fs.renameSync(filePath, path.join(archiveDir, path.basename(filePath)));
  });

  return archiveDir;
};
