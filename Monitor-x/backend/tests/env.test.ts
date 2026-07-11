import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSmsProviderSafe } from '../src/config/env.js';

// Follow-up to C-2: production must not silently run in 'dev' SMS mode, which
// sends no SMS at all (and previously leaked the code). Fail closed instead.

test('rejects dev SMS mode in production', () => {
  assert.throws(() => assertSmsProviderSafe('production', 'dev'), /SMS_PROVIDER/);
});

test('allows a real provider in production', () => {
  assert.doesNotThrow(() => assertSmsProviderSafe('production', 'fast2sms'));
  assert.doesNotThrow(() => assertSmsProviderSafe('production', 'msg91'));
});

test('allows dev SMS mode outside production', () => {
  assert.doesNotThrow(() => assertSmsProviderSafe(undefined, 'dev'));
  assert.doesNotThrow(() => assertSmsProviderSafe('development', 'dev'));
});
