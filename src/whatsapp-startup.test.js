import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initializeWhatsAppClient } from './whatsapp-startup.js';

test('retries WhatsApp initialization after a transient startup failure', async () => {
  const attempts = [];
  const errors = [];
  const waits = [];
  const client = {
    initialize: async () => {
      attempts.push(Date.now());
      if (attempts.length === 1) throw new Error('startup stalled');
      return 'ready';
    }
  };

  const result = await initializeWhatsAppClient({
    client,
    whatsappSession: {
      markError: (error) => errors.push(error.message)
    },
    maxRetries: 2,
    retryDelayMs: 25,
    wait: async (ms) => waits.push(ms),
    logger: { warn() {}, error() {} }
  });

  assert.equal(result.ok, true);
  assert.equal(result.attempts, 2);
  assert.deepEqual(errors, ['startup stalled']);
  assert.deepEqual(waits, [25]);
});
