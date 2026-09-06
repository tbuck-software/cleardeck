import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/** Write beside the target; failed writes leave the previous file intact. */
export const writeAtomic = (target: string, data: Buffer): void => {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    const fd = fs.openSync(temporary, 'wx', 0o600);
    try {
      fs.writeFileSync(fd, data);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temporary, target);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
};
