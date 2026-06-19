import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Store } from './store.js';
import { recordOutgoingWhatsAppMessage } from './whatsapp-recorder.js';

test('records owner messages created directly in WhatsApp with normalized customer phone', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'umkm-recorder-'));
  const store = new Store(join(dir, 'db.json'));

  try {
    await store.load();

    const recorded = await recordOutgoingWhatsAppMessage({
      store,
      message: {
        fromMe: true,
        from: '628000000001@c.us',
        to: '628111222333:7@c.us',
        body: 'Siap Kak, admin bantu follow up dari WA.'
      }
    });

    assert.equal(recorded.phone, '628111222333');
    assert.equal(store.data.conversations['628111222333'].phone, '628111222333');
    assert.equal(store.data.conversations['628111222333:7'], undefined);
    assert.deepEqual(store.data.messages.map((message) => ({
      phone: message.phone,
      from: message.from,
      body: message.body
    })), [{
      phone: '628111222333',
      from: 'owner',
      body: 'Siap Kak, admin bantu follow up dari WA.'
    }]);

    const duplicate = await recordOutgoingWhatsAppMessage({ store, message: { fromMe: true, to: '628111222333@c.us', body: 'Siap Kak, admin bantu follow up dari WA.' } });
    assert.equal(duplicate.duplicate, true);
    assert.equal(store.data.messages.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('skips outgoing bot echoes so dashboard chat does not duplicate AI bubbles as admin', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'umkm-recorder-'));
  const store = new Store(join(dir, 'db.json'));

  try {
    await store.load();
    await store.addMessage({
      phone: '628111222333',
      from: 'bot',
      body: 'Ini katalog treatment kami ya Kak.'
    });

    const recorded = await recordOutgoingWhatsAppMessage({
      store,
      message: {
        fromMe: true,
        from: '628000000001@c.us',
        to: '628111222333@c.us',
        body: 'Ini katalog treatment kami ya Kak.'
      }
    });

    assert.equal(recorded.duplicate, true);
    assert.equal(recorded.duplicateOf, 'bot');
    assert.deepEqual(store.data.messages.map((message) => message.from), ['bot']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
