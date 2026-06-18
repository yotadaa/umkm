import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultBusinessProfile, defaultProducts, ensureArray, slugifyProductName } from './products.js';

const defaultData = {
  businessProfile: defaultBusinessProfile,
  products: defaultProducts,
  leads: [],
  conversations: {},
  messages: [],
  compacted: []
};

const COMPACT_TOKEN_THRESHOLD = 50000;
const MAX_RECENT_MESSAGES_PER_PHONE = 80;

export class Store {
  constructor(filePath) {
    this.filePath = filePath instanceof URL ? fileURLToPath(filePath) : filePath;
    this.data = structuredClone(defaultData);
  }

  async load() {
    await mkdir(dirname(this.filePath), { recursive: true });

    try {
      const raw = await readFile(this.filePath, 'utf8');
      this.data = { ...structuredClone(defaultData), ...JSON.parse(raw) };
      this.normalizeData();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.normalizeData();
      await this.save();
    }
  }

  normalizeData() {
    this.data.businessProfile = { ...defaultBusinessProfile, ...(this.data.businessProfile || {}) };
    this.data.products = (this.data.products?.length ? this.data.products : defaultProducts).map(normalizeProduct);
    this.data.leads ||= [];
    this.data.conversations ||= {};
    this.data.messages ||= [];
    this.data.compacted ||= [];
  }

  async save() {
    await writeFile(this.filePath, JSON.stringify(this.data, null, 2));
  }

  getConversation(phone) {
    if (!this.data.conversations[phone]) {
      this.data.conversations[phone] = {
        phone,
        customerId: `lead-${phone}`,
        name: null,
        interest: null,
        source: null,
        status: 'New',
        stage: 'new',
        compactedTokenCount: 0,
        compactedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    return this.data.conversations[phone];
  }

  async updateConversation(phone, patch) {
    const conversation = this.getConversation(phone);
    Object.assign(conversation, patch, { updatedAt: new Date().toISOString() });
    await this.save();
    return conversation;
  }

  findLeadByPhone(phone) {
    return this.data.leads.find((lead) => lead.phone === phone);
  }

  getProducts() {
    return this.data.products;
  }

  getProduct(id) {
    return this.data.products.find((product) => product.id === id) || null;
  }

  getBusinessProfile() {
    return this.data.businessProfile;
  }

  async updateBusinessProfile(patch) {
    this.data.businessProfile = { ...this.data.businessProfile, ...patch };
    await this.save();
    return this.data.businessProfile;
  }

  async createProduct(input) {
    const product = normalizeProduct({
      ...input,
      id: input.id || uniqueProductId(this.data.products, input.name)
    });
    this.data.products.push(product);
    await this.save();
    return product;
  }

  async updateProduct(id, patch) {
    const index = this.data.products.findIndex((product) => product.id === id);
    if (index === -1) return null;

    this.data.products[index] = normalizeProduct({ ...this.data.products[index], ...patch, id });
    await this.save();
    return this.data.products[index];
  }

  async deleteProduct(id) {
    const before = this.data.products.length;
    this.data.products = this.data.products.filter((product) => product.id !== id);
    await this.save();
    return this.data.products.length < before;
  }

  async addProductMedia(productId, input) {
    const product = this.getProduct(productId);
    if (!product) return null;

    const media = normalizeMedia([{
      ...input,
      id: input.id || uniqueMediaId(product.media || [], input.label)
    }])[0];

    if (!media) return null;

    product.media = [...(product.media || []), media];
    await this.save();
    return media;
  }

  async deleteProductMedia(productId, mediaId) {
    const product = this.getProduct(productId);
    if (!product) return false;

    const before = product.media?.length || 0;
    product.media = (product.media || []).filter((media) => media.id !== mediaId);
    await this.save();
    return product.media.length < before;
  }

  async upsertLead({ phone, name, interest, source, status }) {
    let lead = this.findLeadByPhone(phone);

    if (!lead) {
      lead = {
        id: this.data.leads.length + 1,
        name: name || '-',
        phone,
        interest: interest || '-',
        source: source || 'WhatsApp',
        status: status || 'New',
        followUpsSent: [],
        notes: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.data.leads.push(lead);
    } else {
      Object.assign(lead, {
        name: name || lead.name,
        interest: interest || lead.interest,
        source: source || lead.source,
        status: status || lead.status,
        updated_at: new Date().toISOString()
      });
    }

    await this.save();
    return lead;
  }

  async updateLead(id, patch) {
    const lead = this.data.leads.find((item) => String(item.id) === String(id));
    if (!lead) return null;

    const nextStatus = patch.status ? String(patch.status) : lead.status;
    const nextNotes = Array.isArray(patch.notes) ? patch.notes : lead.notes;

    Object.assign(lead, {
      status: nextStatus,
      notes: nextNotes,
      updated_at: new Date().toISOString()
    });

    await this.save();
    return lead;
  }

  hasRecentMessage({ phone, from, body, withinMs = 15000 }) {
    const now = Date.now();
    return this.data.messages.some((message) => {
      const createdAt = new Date(message.created_at).getTime();
      return message.phone === phone
        && message.from === from
        && message.body === body
        && Number.isFinite(createdAt)
        && now - createdAt <= withinMs;
    });
  }

  async addMessage({ phone, from, body, created_at, dedupeWindowMs = 0 }) {
    const normalizedPhone = String(phone || '').trim();
    const normalizedBody = String(body || '');

    if (dedupeWindowMs > 0 && this.hasRecentMessage({ phone: normalizedPhone, from, body: normalizedBody, withinMs: dedupeWindowMs })) {
      return null;
    }

    const message = {
      phone: normalizedPhone,
      from,
      body: normalizedBody,
      created_at: created_at || new Date().toISOString()
    };

    this.getConversation(normalizedPhone);

    this.data.messages.push(message);

    this.compactIfNeeded(normalizedPhone);

    await this.save();
    return message;
  }

  compactIfNeeded(phone) {
    const messages = this.data.messages.filter((message) => message.phone === phone);
    const estimatedTokens = estimateTokens(messages.map((message) => message.body).join('\n'));

    if (estimatedTokens < COMPACT_TOKEN_THRESHOLD) return;

    const recentMessages = messages.slice(-MAX_RECENT_MESSAGES_PER_PHONE);
    const messagesToCompact = messages.slice(0, -MAX_RECENT_MESSAGES_PER_PHONE);

    if (!messagesToCompact.length) return;

    const conversation = this.getConversation(phone);
    const compactedAt = new Date().toISOString();
    const compactedTokenCount = estimateTokens(messagesToCompact.map((message) => message.body).join('\n'));

    this.data.compacted.push({
      phone,
      customerId: conversation.customerId,
      name: conversation.name,
      interest: conversation.interest,
      status: conversation.status,
      messageCount: messagesToCompact.length,
      estimatedTokens: compactedTokenCount,
      summary: buildCompactSummary({ conversation, messages: messagesToCompact }),
      created_at: compactedAt
    });

    conversation.compactedAt = compactedAt;
    conversation.compactedTokenCount += compactedTokenCount;
    conversation.updatedAt = compactedAt;

    const otherMessages = this.data.messages.filter((message) => message.phone !== phone);
    this.data.messages = [...otherMessages, ...recentMessages];
  }

  async markFollowUp(phone, day) {
    const lead = this.findLeadByPhone(phone);
    if (!lead) return null;

    if (!lead.followUpsSent.includes(day)) lead.followUpsSent.push(day);
    lead.updated_at = new Date().toISOString();
    await this.save();
    return lead;
  }
}

function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

function buildCompactSummary({ conversation, messages }) {
  const firstMessage = messages[0];
  const lastMessage = messages[messages.length - 1];
  const customerMessages = messages.filter((message) => message.from === 'customer').length;
  const botMessages = messages.filter((message) => message.from === 'bot').length;

  return [
    `Conversation compacted for ${conversation.customerId}.`,
    `Known identity: ${conversation.name || 'unknown name'}, phone ${conversation.phone}.`,
    `Interest: ${conversation.interest || 'unknown'}, status: ${conversation.status || 'New'}.`,
    `Messages compacted: ${messages.length} (${customerMessages} customer, ${botMessages} bot).`,
    `Range: ${firstMessage?.created_at || '-'} to ${lastMessage?.created_at || '-'}.`,
    `Last customer message: ${lastCustomerMessage(messages) || '-'}`
  ].join(' ');
}

function lastCustomerMessage(messages) {
  return [...messages].reverse().find((message) => message.from === 'customer')?.body;
}

function normalizeProduct(product) {
  const seeded = defaultProducts.find((item) => item.id === product.id || item.name === product.name);
  return {
    id: product.id || slugifyProductName(product.name),
    name: String(product.name || 'Produk Tanpa Nama').trim(),
    price: Number(product.price || 0),
    keywords: ensureArray(product.keywords),
    description: String(product.description || '').trim(),
    promo: String(product.promo || '').trim(),
    media: normalizeMedia(product.media === undefined ? seeded?.media : product.media)
  };
}

function normalizeMedia(media) {
  if (!Array.isArray(media)) return [];
  return media
    .map((item, index) => ({
      id: String(item?.id || `media-${index + 1}`),
      label: String(item?.label || `Foto ${index + 1}`),
      type: String(item?.type || inferMediaType(item?.url)),
      url: String(item?.url || '').trim()
    }))
    .filter((item) => item.url);
}

function inferMediaType(url) {
  const value = String(url || '').toLowerCase();
  const dataMatch = value.match(/^data:([^;]+);/);
  if (dataMatch) return dataMatch[1];
  if (value.includes('.webp')) return 'image/webp';
  if (value.includes('.png')) return 'image/png';
  if (value.includes('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function uniqueMediaId(mediaItems, label) {
  const base = slugifyProductName(label || 'foto-produk');
  let candidate = base;
  let counter = 2;

  while (mediaItems.some((media) => media.id === candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function uniqueProductId(products, name) {
  const base = slugifyProductName(name);
  let candidate = base;
  let counter = 2;

  while (products.some((product) => product.id === candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}
