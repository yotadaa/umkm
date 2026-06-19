import { normalizePhone } from './chatbot.js';

const DEDUPE_WINDOW_MS = 15000;

export async function resolveIncomingWhatsAppPhone(message) {
  const contact = await safeCall(() => message.getContact?.());
  const chat = await safeCall(() => message.getChat?.());

  return firstUsablePhone([
    contact?.number,
    contact?.id?._serialized,
    contact?.id?.user,
    message.author,
    message.from,
    chat?.id?._serialized,
    chat?.id?.user
  ]);
}

export async function resolveOutgoingWhatsAppPhone(message) {
  const chat = await safeCall(() => message.getChat?.());
  const contact = await safeCall(() => message.getContact?.());

  return firstUsablePhone([
    message.to,
    chat?.id?._serialized,
    chat?.id?.user,
    contact?.number,
    contact?.id?._serialized,
    contact?.id?.user
  ]);
}

export async function recordOutgoingWhatsAppMessage({ store, message }) {
  if (!message?.fromMe) return { skipped: true, reason: 'not-from-me' };
  if (isGroupId(message.to) || isGroupId(message.from)) return { skipped: true, reason: 'group' };

  const body = String(message.body || message.caption || '').trim();
  if (!body) return { skipped: true, reason: 'empty' };

  const phone = await resolveOutgoingWhatsAppPhone(message);
  if (!phone) return { skipped: true, reason: 'missing-phone' };

  const duplicateOwner = store.hasRecentMessage?.({ phone, from: 'owner', body, withinMs: DEDUPE_WINDOW_MS });
  if (duplicateOwner) return { phone, duplicate: true, duplicateOf: 'owner' };

  const duplicateBot = store.hasRecentMessage?.({ phone, from: 'bot', body, withinMs: DEDUPE_WINDOW_MS });
  if (duplicateBot) return { phone, duplicate: true, duplicateOf: 'bot' };

  await store.addMessage({ phone, from: 'owner', body, dedupeWindowMs: DEDUPE_WINDOW_MS });
  return { phone, duplicate: false };
}

function firstUsablePhone(candidates) {
  for (const candidate of candidates) {
    const phone = normalizePhone(candidate);
    if (isUsablePhone(phone)) return phone;
  }

  return null;
}

function isUsablePhone(value) {
  return /^\d{8,16}$/.test(String(value || ''));
}

function isGroupId(value) {
  return String(value || '').includes('@g.us');
}

async function safeCall(fn) {
  try {
    return await fn();
  } catch {
    return null;
  }
}
