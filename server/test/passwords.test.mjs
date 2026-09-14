import assert from 'node:assert/strict';
import { randomBytes, scrypt as derive } from 'node:crypto';
import test from 'node:test';
import { promisify } from 'node:util';
import { hashPassword, verifyPassword } from '../src/passwords.mjs';

const scrypt = promisify(derive);

test('password verification rejects malformed database hashes without throwing', async () => {
  for (const stored of [null, '', 'broken', 'aa:bb', `scrypt-v1$32768$8$1$${'a'.repeat(64)}$${'b'.repeat(128)}$extra`, `scrypt-v1$32768$8$1$${'a'.repeat(64)}$zz`, `scrypt-v2$32768$8$1$${'a'.repeat(64)}$${'b'.repeat(128)}`]) {
    await assert.doesNotReject(async () => {
      assert.equal(await verifyPassword('any-password', stored), false);
    });
  }
});

test('password hashes verify and reject the wrong password', async () => {
  const stored = await hashPassword('a sufficiently long password');
  assert.equal(await verifyPassword('a sufficiently long password', stored), true);
  assert.equal(await verifyPassword('a different password', stored), false);
});

test('password verification keeps reading hashes from the first draft format', async () => {
  const salt = randomBytes(32).toString('hex');
  const hash = await scrypt('legacy password', salt, 64, { N: 1 << 14, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
  const stored = `${salt}:${hash.toString('hex')}`;
  assert.equal(await verifyPassword('legacy password', stored), true);
  assert.equal(await verifyPassword('wrong legacy password', stored), false);
});
