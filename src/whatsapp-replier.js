import { normalizePhone } from './chatbot.js';
import { sendWhatsAppMessage } from './whatsapp-sender.js';

export async function sendWhatsAppReply({ client, message, phone, body }) {
  const text = String(body || '').trim();
  if (!text) return { skipped: true, reason: 'empty' };

  try {
    await message.reply(text);
    return { method: 'reply' };
  } catch (error) {
    const normalizedPhone = normalizePhone(phone || message?.from || message?.to);
    const delivery = await sendWhatsAppMessage({ client, phone: normalizedPhone, body: text });
    return {
      method: delivery.method === 'direct' ? 'sendMessage' : delivery.method,
      to: delivery.to,
      fallbackReason: error?.message || String(error)
    };
  }
}
