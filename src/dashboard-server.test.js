import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { handleIncomingMessage, normalizePhone } from './chatbot.js';
import { createDashboardApp } from './dashboard-server.js';
import { Store } from './store.js';

test('dashboard state includes WhatsApp customer and bot messages recorded by chatbot', async () => {
  const { app, store, cleanup } = await createTestApp();
  try {
    const responseText = await handleIncomingMessage({
      store,
      message: {
        from: '628111222333@c.us',
        body: 'Halo, mau tanya facial acne'
      }
    });

    assert.match(responseText, /Facial Acne/i);

    const server = app.listen(0);
    try {
      const state = await getJson(server, '/api/state');
      const conversation = state.conversations['628111222333'];
      const messages = state.messages.filter((message) => message.phone === '628111222333');

      assert.equal(conversation.interest, 'Facial Acne');
      assert.equal(messages.length, 2);
      assert.equal(messages[0].from, 'customer');
      assert.equal(messages[1].from, 'bot');
      assert.match(messages[0].body, /facial acne/i);
    } finally {
      await closeServer(server);
    }
  } finally {
    await cleanup();
  }
});

test('chatbot normalizes WhatsApp device ids and records fallback when AI fails', async () => {
  assert.equal(normalizePhone('628111222333:12@c.us'), '628111222333');
  assert.equal(normalizePhone('whatsapp:+62 811-1222-333@c.us'), '628111222333');

  const oldApiKey = process.env.AI_API_KEY;
  const oldEndpoint = process.env.AI_ENDPOINT;
  process.env.AI_API_KEY = 'test-key';
  process.env.AI_ENDPOINT = 'http://127.0.0.1:9/v1';

  const { app, store, cleanup } = await createTestApp();

  try {
    const responseText = await handleIncomingMessage({
      store,
      message: {
        from: '628111222333:12@c.us',
        body: 'Kulit saya gampang merah kalau pakai skincare baru'
      }
    });

    assert.match(responseText, /Baik Kak/i);
    assert.ok(store.data.conversations['628111222333'], 'conversation should use normalized phone');
    assert.equal(store.data.conversations['628111222333:12'], undefined);

    const server = app.listen(0);
    try {
      const state = await getJson(server, '/api/state');
      const messages = state.messages.filter((message) => message.phone === '628111222333');

      assert.equal(messages.length, 2);
      assert.equal(messages[0].from, 'customer');
      assert.equal(messages[1].from, 'bot');
    } finally {
      await closeServer(server);
    }
  } finally {
    if (oldApiKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = oldApiKey;
    if (oldEndpoint === undefined) delete process.env.AI_ENDPOINT;
    else process.env.AI_ENDPOINT = oldEndpoint;
    await cleanup();
  }
});

test('dashboard API supports product CRUD, lead status, follow-up, broadcast, and manual chat reply', async () => {
  const sentMessages = [];
  const { app, store, cleanup } = await createTestApp({
    client: {
      info: { pushname: 'QA Bot', wid: { user: '628000000001' } },
      sendMessage: async (to, body) => {
        sentMessages.push({ to, body });
      }
    }
  });

  try {
    await store.upsertLead({ phone: '628111222333', name: 'Anita', interest: 'Facial Acne', source: 'WhatsApp', status: 'Hot' });
    const oldDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    store.data.leads.push({
      id: 999,
      name: 'Budi',
      phone: '628555777999',
      interest: 'Brightening Facial',
      source: 'WhatsApp',
      status: 'Warm',
      followUpsSent: [],
      notes: [],
      created_at: oldDate,
      updated_at: oldDate
    });
    await store.save();

    const server = app.listen(0);
    try {
      const product = await postJson(server, '/api/products', {
        name: 'Laser Glow',
        price: 250000,
        keywords: ['laser glow', 'laser'],
        description: 'Treatment brightening intensif',
        promo: 'Free konsultasi'
      });
      assert.equal(product.name, 'Laser Glow');

      const updatedProduct = await requestJson(server, `/api/products/${product.id}`, {
        method: 'PUT',
        body: { ...product, price: 275000 }
      });
      assert.equal(updatedProduct.price, 275000);

      const updatedLead = await requestJson(server, '/api/leads/1', {
        method: 'PATCH',
        body: { status: 'Closed' }
      });
      assert.equal(updatedLead.status, 'Closed');

      const reply = await postJson(server, '/api/chats/628111222333/send', { message: 'Siap Kak, admin bantu cek jadwal.' });
      assert.equal(reply.ok, true);
      assert.deepEqual(sentMessages.at(-1), {
        to: '628111222333@c.us',
        body: 'Siap Kak, admin bantu cek jadwal.'
      });

      const followup = await postJson(server, '/api/followups/send', { leadId: 999, day: 'h3' });
      assert.equal(followup.ok, true);
      assert.equal(followup.sent[0].phone, '628555777999');

      const broadcast = await postJson(server, '/api/broadcast', { message: 'Promo QA minggu ini.' });
      assert.equal(broadcast.ok, true);
      assert.ok(sentMessages.some((message) => message.body.includes('Promo QA minggu ini.')));

      const deleted = await requestRaw(server, `/api/products/${product.id}`, { method: 'DELETE' });
      assert.equal(deleted.status, 204);
    } finally {
      await closeServer(server);
    }
  } finally {
    await cleanup();
  }
});

test('dashboard chat send retries via WhatsApp number id when direct send has no LID', async () => {
  const sentMessages = [];
  const { app, cleanup } = await createTestApp({
    client: {
      info: { pushname: 'QA Bot', wid: { user: '628000000001' } },
      sendMessage: async (to, body) => {
        if (to === '628111222333@c.us') throw new Error('No LID for user');
        sentMessages.push({ to, body });
      },
      getNumberId: async (phone) => ({ _serialized: `${phone}@lid` })
    }
  });

  try {
    const server = app.listen(0);
    try {
      const reply = await postJson(server, '/api/chats/628111222333/send', { message: 'Siap Kak, admin bantu.' });

      assert.equal(reply.ok, true);
      assert.equal(reply.method, 'number-id');
      assert.deepEqual(sentMessages, [{ to: '628111222333@lid', body: 'Siap Kak, admin bantu.' }]);
    } finally {
      await closeServer(server);
    }
  } finally {
    await cleanup();
  }
});

test('incoming WhatsApp media request sends product photos automatically', async () => {
  const sent = [];
  const { store, cleanup } = await createTestApp();
  const product = store.getProduct('facial-acne');

  try {
    const { handleIncomingWhatsAppMessage } = await import('./whatsapp-handler.js');
    const result = await handleIncomingWhatsAppMessage({
      store,
      client: {
        info: { wid: { user: '628000000001' } },
        sendMessage: async (to, content, options = {}) => {
          sent.push({ to, content, options });
        }
      },
      message: {
        from: '628111222333@c.us',
        body: 'boleh kirim foto facial acne?'
      }
    });

    assert.equal(result.phone, '628111222333');
    assert.equal(result.mediaSent.length, product.media.length);
    assert.equal(sent.length, product.media.length + 1);
    assert.equal(sent[0].to, '628111222333@c.us');
    assert.match(sent[0].content, /kirim 3 foto Facial Acne/i);
    assert.ok(sent[1].content || sent[1].options.media);

    const messages = store.data.messages.filter((message) => message.phone === '628111222333');
    assert.equal(messages.some((message) => message.from === 'bot' && message.body.includes('Admin bisa share')), false);
    assert.equal(messages.filter((message) => message.from === 'bot' && message.body.startsWith('[Foto]')).length, product.media.length);
  } finally {
    await cleanup();
  }
});

test('catalog media can be seeded, requested from WhatsApp chat, and shared from dashboard', async () => {
  const sentMessages = [];
  const { app, store, cleanup } = await createTestApp({
    client: {
      info: { pushname: 'QA Bot', wid: { user: '628000000001' } },
      sendMessage: async (to, content, options = {}) => {
        sentMessages.push({ to, content, options });
      }
    }
  });

  try {
    const product = store.getProducts().find((item) => item.id === 'facial-acne');
    assert.ok(product.media.length > 1, 'Facial Acne should have more than one seeded media item');
    assert.ok(
      store.getProducts().every((item) => item.media.length > 1 && item.media.every((media) => media.url.startsWith('https://'))),
      'every seeded catalog item should have multiple internet-hosted images'
    );

    const reply = await handleIncomingMessage({
      store,
      message: {
        from: '628111222333@c.us',
        body: 'boleh tolong share foto foto nya untuk facial acne?'
      }
    });

    assert.match(reply, /foto Facial Acne/i);
    assert.match(reply, /kirim 3 foto Facial Acne/i);

    const server = app.listen(0);
    try {
      const shared = await postJson(server, '/api/products/facial-acne/media/send', {
        phone: '628111222333'
      });

      assert.equal(shared.ok, true);
      assert.equal(shared.sent.length, product.media.length);
      assert.equal(sentMessages.length, product.media.length);
      assert.equal(sentMessages[0].to, '628111222333@c.us');
      assert.ok(sentMessages[0].content || sentMessages[0].options.media);
    } finally {
      await closeServer(server);
    }
  } finally {
    await cleanup();
  }
});

test('dashboard API exposes product detail and persists carousel media changes', async () => {
  const { app, cleanup } = await createTestApp();

  try {
    const server = app.listen(0);
    try {
      const product = await getJson(server, '/api/products/facial-acne');
      assert.equal(product.id, 'facial-acne');
      assert.ok(product.media.length > 1, 'seeded product should expose multiple carousel images');

      const added = await postJson(server, '/api/products/facial-acne/media', {
        label: 'Ruang treatment',
        url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80'
      });

      assert.equal(added.label, 'Ruang treatment');
      assert.match(added.url, /^https:\/\/images\.unsplash\.com\//);

      const afterAdd = await getJson(server, '/api/products/facial-acne');
      assert.ok(afterAdd.media.some((item) => item.id === added.id));

      const deleted = await requestRaw(server, `/api/products/facial-acne/media/${added.id}`, { method: 'DELETE' });
      assert.equal(deleted.status, 204);

      const afterDelete = await getJson(server, '/api/products/facial-acne');
      assert.equal(afterDelete.media.some((item) => item.id === added.id), false);
    } finally {
      await closeServer(server);
    }
  } finally {
    await cleanup();
  }
});

async function createTestApp({ client } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'umkm-dashboard-'));
  const store = new Store(join(dir, 'db.json'));
  await store.load();
  const whatsappSession = {
    snapshot: () => ({
      status: client?.info ? 'ready' : 'qr',
      connected: Boolean(client?.info),
      hasLocalSession: Boolean(client?.info),
      sessionPath: './.wa-session',
      qrAvailable: !client?.info,
      qrImage: client?.info ? null : 'data:image/png;base64,qr'
    })
  };
  const app = createDashboardApp({
    store,
    client: client || { info: null, sendMessage: async () => {} },
    whatsappSession
  });

  return {
    app,
    store,
    cleanup: () => rm(dir, { recursive: true, force: true })
  };
}

async function getJson(server, path) {
  return requestJson(server, path, { method: 'GET' });
}

async function postJson(server, path, body) {
  return requestJson(server, path, { method: 'POST', body });
}

async function requestJson(server, path, { method, body } = {}) {
  const response = await requestRaw(server, { path, method, body });
  assert.ok(response.status >= 200 && response.status < 300, `Expected success, got ${response.status}: ${response.text}`);
  return response.text ? JSON.parse(response.text) : null;
}

async function requestRaw(server, pathOrOptions, options = {}) {
  const input = typeof pathOrOptions === 'string' ? { path: pathOrOptions, ...options } : pathOrOptions;
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}${input.path}`, {
    method: input.method || 'GET',
    headers: input.body ? { 'Content-Type': 'application/json' } : undefined,
    body: input.body ? JSON.stringify(input.body) : undefined
  });

  return { status: response.status, text: await response.text() };
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
