import assert from 'node:assert/strict';
import test from 'node:test';
import {BROWSER_COOKIE, browserIdentity} from '../server/quota.js';

const secret = 'a test-only signing secret';

test('browserIdentity signs a new identity and accepts its valid cookie', () => {
  const issued = browserIdentity(undefined, secret);
  const established = browserIdentity(`${BROWSER_COOKIE}=${issued.token}`, secret);

  assert.equal(issued.established, false);
  assert.match(issued.id, /^[a-f0-9]{64}$/);
  assert.equal(established.id, issued.id);
  assert.equal(established.token, issued.token);
  assert.equal(established.established, true);
});

test('browserIdentity replaces malformed, tampered, and duplicate identity cookies', () => {
  const issued = browserIdentity(undefined, secret);
  const [id, signature] = issued.token.split('.');
  const tampered = `${id}.${signature[0] === '0' ? '1' : '0'}${signature.slice(1)}`;

  for (const cookie of [
    `${BROWSER_COOKIE}=invalid`,
    `${BROWSER_COOKIE}=${tampered}`,
    `${BROWSER_COOKIE}=${issued.token}; ${BROWSER_COOKIE}=${issued.token}`,
  ]) {
    const replacement = browserIdentity(cookie, secret);
    assert.equal(replacement.established, false);
    assert.notEqual(replacement.id, issued.id);
    assert.match(replacement.token, /^[a-f0-9]{64}\.[a-f0-9]{64}$/);
  }
});
