import { findProduct, formatCurrency, productCatalogText } from './products.js';
import { generateAiReply, isAiEnabled } from './ai.js';

const bookingKeywords = ['booking', 'pesan', 'jadwal', 'hari ini', 'besok', 'mau treatment'];
const browsingKeywords = ['lihat-lihat', 'pikir dulu', 'nanti dulu', 'tanya dulu', 'konsultasi'];
const sourceKeywords = ['instagram', 'facebook', 'tiktok', 'google', 'maps', 'website'];
const mediaKeywords = ['foto', 'photo', 'gambar', 'image', 'pic', 'share foto', 'kirim foto'];

export function normalizePhone(waId) {
  const raw = String(waId || '').trim();
  const withoutProtocol = raw.replace(/^whatsapp:/i, '');
  const localPart = withoutProtocol.split('@')[0].split(':')[0];
  const digits = localPart.replace(/\D/g, '');

  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits || localPart;
}

export async function handleIncomingMessage({ store, message, phone: resolvedPhone }) {
  const phone = normalizePhone(resolvedPhone || message.from);
  const text = String(message.body || '').trim();

  if (!text) return null;

  await store.addMessage({ phone, from: 'customer', body: text });
  const conversation = store.getConversation(phone);
  const response = await buildResponse({ store, phone, text, conversation });

  if (response) {
    await store.addMessage({ phone, from: 'bot', body: response });
  }

  return response;
}

async function buildResponse({ store, phone, text, conversation }) {
  const lowerText = text.toLowerCase();
  const businessProfile = store.getBusinessProfile();
  const products = store.getProducts();
  const source = detectSource(lowerText) || conversation.source || 'WhatsApp';
  const product = findProduct(lowerText, products);
  const status = scoreLead(lowerText, conversation.status);

  if (product) {
    await store.updateConversation(phone, {
      interest: product.name,
      source,
      status,
      stage: conversation.name ? 'ask_intent' : 'ask_name'
    });

    await store.upsertLead({
      phone,
      name: conversation.name,
      interest: product.name,
      source,
      status
    });

    if (isMediaRequest(lowerText)) {
      return product.media?.length
        ? `Bisa Kak. Saya kirim ${product.media.length} foto ${product.name} sekarang ya.`
        : `Bisa Kak, untuk ${product.name} saya bantu minta admin kirim foto terbaru ya.`;
    }

    return [
      `Halo Kak, ${product.name} harganya ${formatCurrency(product.price)}.`,
      product.description,
      product.promo ? `Promo: ${product.promo}` : null,
      conversation.name
        ? `Kak ${conversation.name} ingin booking atau konsultasi terlebih dahulu?`
        : 'Boleh saya tahu nama Kakak?'
    ].filter(Boolean).join('\n\n');
  }

  const capturedName = captureNameFromMessage({ text, conversation });
  if (capturedName) {
    await store.updateConversation(phone, { name: capturedName, source, status, stage: 'ask_need' });
    await store.upsertLead({ phone, name: capturedName, interest: conversation.interest, source, status });
  }

  if (isGreeting(lowerText)) {
    await store.updateConversation(phone, { source, status });

    if (conversation.name) {
      return [
        `Halo Kak ${conversation.name}, saya CS ${businessProfile.name}.`,
        conversation.interest ? `Terakhir Kakak tertarik dengan ${conversation.interest}.` : null,
        'Mau lanjut booking, konsultasi, cek promo, atau lihat katalog lagi?'
      ].filter(Boolean).join('\n');
    }

    return [
      `Halo Kak, saya CS ${businessProfile.name}.`,
      'Saya bisa bantu info harga, katalog treatment, lokasi, promo, dan booking.',
      'Kakak sedang cari treatment apa?'
    ].join('\n');
  }

  if (containsAny(lowerText, ['katalog', 'produk', 'treatment', 'layanan', 'paket'])) {
    await store.updateConversation(phone, { source, status });
    return `Ini katalog treatment kami ya Kak:\n\n${productCatalogText(products)}\n\nKakak tertarik yang mana?`;
  }

  if (isMediaRequest(lowerText)) {
    const interestedProduct = resolveMediaRequestProduct({ store, phone, text, conversation });
    if (interestedProduct?.media?.length) {
      await store.updateConversation(phone, { source, status });
      return `Bisa Kak. Saya kirim ${interestedProduct.media.length} foto ${interestedProduct.name} sekarang ya.`;
    }

    await store.updateConversation(phone, { source, status });
    return 'Bisa Kak. Boleh sebutkan produk atau treatment yang ingin dilihat fotonya?';
  }

  if (containsAny(lowerText, ['harga', 'price', 'biaya', 'berapa'])) {
    await store.updateConversation(phone, { source, status });
    return `Untuk harga treatment:\n\n${productCatalogText(products)}\n\nKalau Kakak sebutkan kebutuhan kulitnya, saya bantu pilihkan paket yang cocok.`;
  }

  if (containsAny(lowerText, ['lokasi', 'alamat', 'dimana', 'di mana', 'jam buka'])) {
    await store.updateConversation(phone, { source, status });
    return `Lokasi ${businessProfile.name}: ${businessProfile.address}.\nJam buka: ${businessProfile.hours}.`;
  }

  if (containsAny(lowerText, ['promo', 'diskon', 'discount'])) {
    await store.updateConversation(phone, { source, status });
    return `${businessProfile.currentPromo}\n\nMau saya bantu booking jadwalnya, Kak?`;
  }

  if (conversation.stage === 'ask_name' && looksLikeName(text)) {
    const name = cleanName(text);
    await store.updateConversation(phone, { name, source, status: 'New', stage: 'ask_intent' });
    await store.upsertLead({
      phone,
      name,
      interest: conversation.interest,
      source,
      status: 'New'
    });

    return `Terima kasih Kak ${name}. Apakah ingin booking atau konsultasi terlebih dahulu?`;
  }

  if (containsAny(lowerText, bookingKeywords)) {
    const nextStatus = 'Hot';
    await store.updateConversation(phone, { source, status: nextStatus, stage: 'handoff_admin' });
    await store.upsertLead({
      phone,
      name: conversation.name,
      interest: conversation.interest,
      source,
      status: nextStatus
    });

    return [
      'Siap Kak, saya arahkan ke admin untuk cek slot jadwal ya.',
      `Admin kami akan bantu lanjutkan. Nomor admin: ${businessProfile.adminPhone}`
    ].join('\n');
  }

  if (containsAny(lowerText, browsingKeywords)) {
    const nextStatus = 'Warm';
    await store.updateConversation(phone, { source, status: nextStatus });
    await store.upsertLead({
      phone,
      name: conversation.name,
      interest: conversation.interest,
      source,
      status: nextStatus
    });

    return 'Boleh Kak. Kalau masih ingin konsultasi, ceritakan kondisi kulitnya ya. Nanti saya bantu rekomendasikan treatment yang cocok.';
  }

  if (!conversation.name && looksLikeName(text)) {
    const name = cleanName(text);
    await store.updateConversation(phone, { name, source, status, stage: 'ask_need' });
    await store.upsertLead({ phone, name, interest: conversation.interest, source, status });

    return `Baik Kak ${name}. Kebutuhan kulitnya apa ya? Misalnya jerawat, kusam, flek, atau ingin konsultasi dulu.`;
  }

  if (isAiEnabled()) {
    const latestConversation = store.getConversation(phone);
    const aiReply = await generateAiReply({ text, conversation: latestConversation, store }).catch(() => null);

    if (aiReply) return aiReply;
  }

  await store.updateConversation(phone, { source, status });

  if (conversation.name) {
    return [
      `Baik Kak ${conversation.name}, saya bantu ya.`,
      conversation.interest ? `Catatan saya, Kakak sebelumnya tertarik dengan ${conversation.interest}.` : null,
      'Mau lanjut booking, konsultasi, cek promo, atau lihat katalog?'
    ].filter(Boolean).join('\n');
  }

  return [
    'Baik Kak, saya bantu ya.',
    'Untuk rekomendasi yang lebih pas, boleh sebutkan nama Kakak dan kebutuhan treatmentnya?',
    'Contoh: Siti, mau Facial Acne.'
  ].join('\n');
}

function captureNameFromMessage({ text, conversation }) {
  if (conversation.name) return null;

  const match = text.match(/(?:nama saya|saya|aku|nama)\s+([a-zA-Z.'\s]{2,40})/i);
  if (!match) return null;

  const name = match[1]
    .replace(/\b(mau|ingin|tertarik|booking|konsultasi|facial|acne|brightening|anti aging)\b.*$/i, '')
    .trim();

  return looksLikeName(name) ? cleanName(name) : null;
}

function detectSource(text) {
  const match = sourceKeywords.find((keyword) => text.includes(keyword));
  if (!match) return null;
  return match === 'maps' ? 'Google Maps' : capitalize(match);
}

function scoreLead(text, fallback = 'New') {
  if (containsAny(text, bookingKeywords)) return 'Hot';
  if (containsAny(text, browsingKeywords)) return 'Warm';
  return fallback || 'New';
}

function isGreeting(text) {
  return containsAny(text, ['halo', 'hai', 'hi', 'pagi', 'siang', 'sore', 'malam', 'assalamualaikum']);
}

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

export function resolveMediaRequestProduct({ store, phone, text, conversation }) {
  const lowerText = String(text || '').toLowerCase();
  if (!isMediaRequest(lowerText)) return null;

  const products = store.getProducts();
  const currentConversation = conversation || store.getConversation(phone);

  return findProduct(lowerText, products)
    || products.find((item) => item.name === currentConversation.interest)
    || null;
}

export function isMediaRequest(text) {
  return containsAny(text, mediaKeywords);
}

function looksLikeName(text) {
  const words = text.trim().split(/\s+/);
  return words.length <= 3 && /^[a-zA-Z.'\s]+$/.test(text.trim()) && text.trim().length >= 2;
}

function cleanName(text) {
  return text
    .trim()
    .split(/\s+/)
    .map(capitalize)
    .join(' ');
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}
