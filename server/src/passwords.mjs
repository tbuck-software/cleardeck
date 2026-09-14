import { randomBytes, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(derive);
const SCRYPT_N = 1 << 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const SCRYPT_VERSION = 'scrypt-v1';
const LEGACY_SCRYPT_N = 1 << 14;
const LEGACY_SCRYPT_R = 8;
const LEGACY_SCRYPT_P = 1;
const LEGACY_SCRYPT_MAXMEM = 32 * 1024 * 1024;

const derivePassword = (password, salt) => scrypt(password, salt, 64, {
  N: SCRYPT_N,
  r: SCRYPT_R,
  p: SCRYPT_P,
  maxmem: SCRYPT_MAXMEM,
});

const deriveLegacyPassword = (password, salt) => scrypt(password, salt, 64, {
  N: LEGACY_SCRYPT_N,
  r: LEGACY_SCRYPT_R,
  p: LEGACY_SCRYPT_P,
  maxmem: LEGACY_SCRYPT_MAXMEM,
});

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 14 || password.length > 256) {
    throw new Error('Das Passwort muss zwischen 14 und 256 Zeichen lang sein.');
  }
  const salt = randomBytes(32).toString('hex');
  const hash = await derivePassword(password, salt);
  return `${SCRYPT_VERSION}$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 256) return false;
  if (typeof stored !== 'string') return false;
  let salt;
  let expected;
  let deriveForHash;
  const parts = stored.split('$');
  if (parts.length === 6) {
    const [version, cost, blockSize, parallelism, parsedSalt, parsedExpected] = parts;
    if (version !== SCRYPT_VERSION || cost !== String(SCRYPT_N) || blockSize !== String(SCRYPT_R) ||
      parallelism !== String(SCRYPT_P) || !/^[a-f0-9]{64}$/.test(parsedSalt) || !/^[a-f0-9]{128}$/.test(parsedExpected)) return false;
    salt = parsedSalt;
    expected = parsedExpected;
    deriveForHash = derivePassword;
  } else {
    // Accounts made by the unversioned first draft remain readable. New
    // account updates always use the explicit format above.
    const legacy = stored.split(':');
    if (legacy.length !== 2 || !/^[a-f0-9]{64}$/.test(legacy[0]) || !/^[a-f0-9]{128}$/.test(legacy[1])) return false;
    [salt, expected] = legacy;
    deriveForHash = deriveLegacyPassword;
  }
  try {
    const actual = await deriveForHash(password, salt);
    return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
