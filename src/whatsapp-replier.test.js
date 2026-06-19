import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sendWhatsAppReply } from './whatsapp-replier.js';

test('falls back to direct WhatsApp send when message.reply fails', async () => {
  const sent = [];
  const client = {
    sendMessage: async (to, body) => {
      sent.push({ to, body });
    }
  };
  const message = {
    reply: async () => {
      throw new Error('reply failed');
    }
  };

  const result = await sendWhatsAppReply({
    client,
    message,
    phone: '628111222333:12@c.us',
    body: 'Halo Kak, saya bantu ya.'
  });

  assert.equal(result.method, 'sendMessage');
  assert.deepEqual(sent, [
    {
      to: '628111222333@c.us',
      body: 'Halo Kak, saya bantu ya.'
    }
  ]);
});
