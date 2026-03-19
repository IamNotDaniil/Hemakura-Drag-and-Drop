import test from 'node:test';
import assert from 'node:assert/strict';
import { createToken, hashPassword, verifyPassword, verifyToken } from './auth.js';

test('password hashes can be verified', async () => {
  const password = 'super-secret';
  const hash = await hashPassword(password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('tokens round-trip payloads', () => {
  const token = createToken({ sub: 'user_1', email: 'user@example.com' });
  assert.deepEqual(verifyToken(token), { sub: 'user_1', email: 'user@example.com' });
});
