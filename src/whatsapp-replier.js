import { normalizePhone } from './chatbot.js';

export async function sendWhatsAppReply({ client, message, phone, body }) {
  const text = String(body || '').trim();
  if (!text) return { skipped: true, reason: 'empty' };

  try {
    await message.reply(text);
    return { method: 'reply' };
  } catch (error) {
    const normalizedPhone = normalizePhone(phone || message?.from || message?.to);
    if (!normalizedPhone || !client?.sendMessage) throw error;

    await client.sendMessage(`${normalizedPhone}@c.us`, text);
    return {
      method: 'sendMessage',
      fallbackReason: error?.message || String(error)
    };
  }
}
