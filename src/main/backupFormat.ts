import { decryptBuffer, encryptBuffer, fingerprintKey } from './crypto';

const MAGIC = 'CLEARDECK-BACKUP-1:';
const SQLITE = Buffer.from('SQLite format 3\0');

export const encodeBackup = (data: Buffer, key: Buffer | null): Buffer => {
  if (!key) return Buffer.concat([Buffer.from(`${MAGIC}plain\n`), data]);
  const { iv, tag, content } = encryptBuffer(data, key);
  return Buffer.concat([Buffer.from(`${MAGIC}${fingerprintKey(key)}\n`), iv, tag, content]);
};

/** Reads new archives and existing raw SQLite/AES-GCM exports. */
export const decodeBackup = (input: Buffer, key: Buffer | null): Buffer => {
  let data = input;
  if (input.subarray(0, MAGIC.length).toString() === MAGIC) {
    const newline = input.indexOf(10);
    if (newline < 0 || newline > 128) throw new Error('Ungültiger Backup-Kopf.');
    const mode = input.subarray(MAGIC.length, newline).toString();
    data = input.subarray(newline + 1);
    if (mode === 'plain') {
      if (!data.subarray(0, 16).equals(SQLITE))
        throw new Error('Keine SQLite-Datenbank im Backup.');
      return data;
    }
    if (!key || fingerprintKey(key) !== mode) {
      throw new Error(
        'Diese Sicherung benötigt den Recovery-Key ihrer ursprünglichen Installation.',
      );
    }
  } else if (data.subarray(0, 16).equals(SQLITE)) {
    return data;
  }
  if (!key)
    throw new Error(
      'Verschlüsselte oder unbekannte Datei. Bitte den ursprünglichen Recovery-Key eingeben.',
    );
  if (data.length < 28) throw new Error('Die Sicherung ist unvollständig.');
  try {
    const decoded = decryptBuffer(
      { iv: data.subarray(0, 12), tag: data.subarray(12, 28), content: data.subarray(28) },
      key,
    );
    if (!decoded.subarray(0, 16).equals(SQLITE)) throw new Error('Not SQLite');
    return decoded;
  } catch {
    throw new Error(
      'Sicherung beschädigt oder Recovery-Key unzutreffend. Der aktuelle Bestand bleibt erhalten.',
    );
  }
};
