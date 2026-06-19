import { handleIncomingMessage, resolveMediaRequestProduct } from './chatbot.js';
import { resolveIncomingWhatsAppPhone } from './whatsapp-recorder.js';
import { sendWhatsAppReply } from './whatsapp-replier.js';
import { sendProductMedia } from './whatsapp-sender.js';

export async function handleIncomingWhatsAppMessage({ store, client, message }) {
  if (message.fromMe || String(message.from || '').includes('@g.us')) {
    return { skipped: true, reason: 'ignored-message' };
  }

  const phone = await resolveIncomingWhatsAppPhone(message);
  const response = await handleIncomingMessage({ store, message, phone });
  const reply = response
    ? await sendWhatsAppReply({ client, message, phone, body: response })
    : null;

  const mediaProduct = resolveMediaRequestProduct({
    store,
    phone,
    text: message.body
  });
  const mediaSent = mediaProduct?.media?.length
    ? await sendProductMedia({ client, store, phone, product: mediaProduct, from: 'bot' })
    : [];

  return { phone, response, reply, mediaProduct, mediaSent };
}
