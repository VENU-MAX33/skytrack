import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, startTestDb, stopTestDb } from './helpers.js';

before(startTestDb);
after(stopTestDb);

// H-2: baseline hardening — security headers + brute-force protection.

test('sends the helmet X-Content-Type-Options header', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
});

test('rate-limits repeated admin login attempts (429 after the limit)', async () => {
  const attempt = () =>
    request(app).post('/api/auth/login').send({ email: 'nobody@x.com', password: 'wrong' });

  let sawLimited = false;
  // Comfortably exceed the login limit; early attempts are 401, then 429.
  for (let i = 0; i < 15; i++) {
    const res = await attempt();
    if (res.status === 429) { sawLimited = true; break; }
    assert.equal(res.status, 401);
  }
  assert.ok(sawLimited, 'expected a 429 once the login rate limit is exceeded');
});
