import express from 'express';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { dueFollowUps, sendFollowUps } from './followup.js';
import { normalizePhone } from './chatbot.js';
import { sendProductMedia, sendWhatsAppMessage } from './whatsapp-sender.js';

export function createDashboardApp({ store, client, whatsappSession }) {
  const app = express();
  const distPath = resolve('dashboard/dist');

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      whatsappReady: Boolean(client?.info),
      whatsapp: whatsappSession?.snapshot?.() || null,
      time: new Date().toISOString()
    });
  });

  app.get('/api/state', (req, res) => {
    res.json(publicState(store, whatsappSession));
  });

  app.get('/api/products', (req, res) => {
    res.json(store.getProducts());
  });

  app.get('/api/products/:id', (req, res) => {
    const product = store.getProduct(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  });

  app.post('/api/products', async (req, res) => {
    const validation = validateProductInput(req.body);
    if (validation) return res.status(400).json({ error: validation });

    const product = await store.createProduct(req.body);
    res.status(201).json(product);
  });

  app.put('/api/products/:id', async (req, res) => {
    const validation = validateProductInput(req.body, { partial: true });
    if (validation) return res.status(400).json({ error: validation });

    const product = await store.updateProduct(req.params.id, req.body);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  });

  app.delete('/api/products/:id', async (req, res) => {
    const deleted = await store.deleteProduct(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Product not found' });
    res.status(204).end();
  });

  app.post('/api/products/:id/media', async (req, res) => {
    const validation = validateMediaInput(req.body);
    if (validation) return res.status(400).json({ error: validation });

    const media = await store.addProductMedia(req.params.id, req.body);
    if (!media) return res.status(404).json({ error: 'Product not found' });
    res.status(201).json(media);
  });

  app.delete('/api/products/:id/media/:mediaId', async (req, res) => {
    const deleted = await store.deleteProductMedia(req.params.id, req.params.mediaId);
    if (!deleted) return res.status(404).json({ error: 'Media not found' });
    res.status(204).end();
  });

  app.post('/api/products/:id/media/send', async (req, res) => {
    if (!isWhatsAppReady(client)) return res.status(409).json({ error: 'WhatsApp belum terhubung' });

    const phone = normalizePhone(req.body?.phone);
    if (!phone) return res.status(400).json({ error: 'Phone is required' });

    const product = store.getProducts().find((item) => item.id === req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!product.media?.length) return res.status(404).json({ error: 'Produk belum memiliki media' });

    const sent = await sendProductMedia({ client, store, phone, product, from: 'owner' });

    res.json({ ok: true, sent });
  });

  app.put('/api/profile', async (req, res) => {
    const profile = await store.updateBusinessProfile(req.body || {});
    res.json(profile);
  });

  app.get('/api/leads', (req, res) => {
    res.json(store.data.leads);
  });

  app.patch('/api/leads/:id', async (req, res) => {
    const lead = await store.updateLead(req.params.id, req.body || {});
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  });

  app.get('/api/chats', (req, res) => {
    const phone = req.query.phone;
    const messages = phone
      ? store.data.messages.filter((message) => message.phone === phone)
      : store.data.messages;

    res.json({ conversations: store.data.conversations, messages });
  });

  app.post('/api/chats/:phone/send', async (req, res) => {
    const body = String(req.body?.message || '').trim();
    const phone = normalizePhone(req.params.phone);
    if (!body) return res.status(400).json({ error: 'Message is required' });
    if (!phone) return res.status(400).json({ error: 'Phone is required' });
    if (!isWhatsAppReady(client)) return res.status(409).json({ error: 'WhatsApp belum terhubung' });

    const delivery = await sendWhatsAppMessage({ client, phone, body });
    await store.addMessage({ phone, from: 'owner', body, dedupeWindowMs: 15000 });
    res.json({ ok: true, ...delivery });
  });

  app.get('/api/followups/due', (req, res) => {
    res.json({ due: dueFollowUps(store.data.leads), autoFollowUp: process.env.AUTO_FOLLOWUP === 'true' });
  });

  app.post('/api/followups/send', async (req, res) => {
    if (!isWhatsAppReady(client)) return res.status(409).json({ error: 'WhatsApp belum terhubung' });

    const day = String(req.body?.day || 'h1');
    const targetId = req.body?.leadId;
    const leads = targetId
      ? store.data.leads.filter((lead) => String(lead.id) === String(targetId))
      : dueFollowUps(store.data.leads).map((item) => item.lead);

    if (!leads.length) return res.status(404).json({ error: 'Tidak ada lead untuk follow-up' });

    const sent = await sendFollowUps({ client, store, leads, day, reason: 'dashboard' });
    res.json({ ok: true, sent: sent.map(({ lead, day: sentDay }) => ({ leadId: lead.id, phone: lead.phone, day: sentDay })) });
  });

  app.post('/api/broadcast', async (req, res) => {
    if (!isWhatsAppReady(client)) return res.status(409).json({ error: 'WhatsApp belum terhubung' });

    const message = String(req.body?.message || store.getBusinessProfile().currentPromo || '').trim();
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const selectedIds = Array.isArray(req.body?.leadIds) ? req.body.leadIds.map(String) : null;
    const leads = store.data.leads.filter((lead) => lead.status !== 'Closed' && (!selectedIds || selectedIds.includes(String(lead.id))));
    if (!leads.length) return res.status(404).json({ error: 'Tidak ada lead aktif untuk broadcast' });

    const sent = [];
    for (const lead of leads) {
      await sendWhatsAppMessage({ client, phone: lead.phone, body: `Halo Kak ${lead.name || ''}, ${message}`.trim() });
      await store.addMessage({ phone: lead.phone, from: 'owner', body: message });
      sent.push({ leadId: lead.id, phone: lead.phone });
    }

    res.json({ ok: true, sent });
  });

  if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(join(distPath, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      res.type('html').send('<h1>Dashboard belum dibuild</h1><p>Jalankan <code>npm run dashboard:build</code>, lalu <code>npm start</code> lagi.</p>');
    });
  }

  return app;
}

export function startDashboardServer({ store, client, whatsappSession }) {
  const app = createDashboardApp({ store, client, whatsappSession });
  const port = Number(process.env.DASHBOARD_PORT || 3000);

  app.listen(port, () => {
    console.log(`Dashboard aktif di http://localhost:${port}`);
  });
}

function publicState(store, whatsappSession) {
  return {
    businessProfile: store.getBusinessProfile(),
    products: store.getProducts(),
    leads: store.data.leads,
    conversations: store.data.conversations,
    messages: store.data.messages.slice(-300),
    compacted: store.data.compacted,
    whatsapp: whatsappSession?.snapshot?.() || null,
    autoFollowUp: process.env.AUTO_FOLLOWUP === 'true'
  };
}

function isWhatsAppReady(client) {
  return Boolean(client?.info);
}

function validateProductInput(input, { partial = false } = {}) {
  if (!input || typeof input !== 'object') return 'Invalid product payload';
  if (!partial && !String(input.name || '').trim()) return 'Product name is required';
  if (input.price !== undefined && Number(input.price) < 0) return 'Price must be positive';
  return null;
}

function validateMediaInput(input) {
  if (!input || typeof input !== 'object') return 'Invalid media payload';
  const url = String(input.url || '').trim();
  if (!url) return 'Media URL is required';
  if (!/^https?:\/\/\S+/i.test(url) && !/^data:image\//i.test(url)) {
    return 'Media URL must be an image URL or data image';
  }
  return null;
}
