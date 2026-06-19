import whatsappWeb from 'whatsapp-web.js';
import { normalizePhone } from './chatbot.js';

const { MessageMedia } = whatsappWeb;

export async function sendWhatsAppMessage({ client, phone, content, body, options }) {
  const normalizedPhone = normalizePhone(phone);
  const payload = content ?? body;

  if (!normalizedPhone) throw new Error('Phone is required');
  if (!client?.sendMessage) throw new Error('WhatsApp client is not ready');

  const directId = `${normalizedPhone}@c.us`;

  try {
    await client.sendMessage(directId, payload, options);
    return { method: 'direct', to: directId };
  } catch (error) {
    if (!isNumberIdRecoverable(error) || !client.getNumberId) throw error;

    const numberId = await client.getNumberId(normalizedPhone);
    const serialized = numberId?._serialized || numberId?.serialized || numberId?.user;
    if (!serialized) throw error;

    await client.sendMessage(serialized, payload, options);
    return { method: 'number-id', to: serialized, fallbackReason: error.message };
  }
}

export async function sendProductMedia({ client, store, phone, product, from = 'owner', downloadRemote = Boolean(client?.pupPage) }) {
  const normalizedPhone = normalizePhone(phone);
  if (!product?.media?.length) return [];

  const sent = [];
  for (const media of product.media) {
    const messageMedia = await createMessageMedia(media, product, { downloadRemote });
    const caption = `[Foto] ${product.name} - ${media.label}`;
    const delivery = await sendWhatsAppMessage({
      client,
      phone: normalizedPhone,
      content: messageMedia || media.url,
      options: messageMedia ? { caption } : undefined
    });

    await store.addMessage({ phone: normalizedPhone, from, body: caption });
    sent.push({ id: media.id, label: media.label, ...delivery });
  }

  return sent;
}

export function createMessageMedia(media, product, { downloadRemote = true } = {}) {
  const match = String(media.url || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    if (!downloadRemote) return null;
    return MessageMedia.fromUrl(media.url, { unsafeMime: true }).catch(() => null);
  }

  const [, mimeType, data] = match;
  const extension = mimeType.includes('svg') ? 'svg' : mimeType.split('/')[1] || 'png';
  const filename = `${product.id}-${media.id}.${extension}`;
  return new MessageMedia(mimeType, data, filename);
}

function isNumberIdRecoverable(error) {
  const message = String(error?.message || error || '');
  return /No LID for user|wid error|invalid wid|not a valid wid|Cannot read properties.*lid/i.test(message);
}
