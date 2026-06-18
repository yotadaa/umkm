import express from 'express';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function startDashboardServer({ store, client }) {
  const app = express();
  const port = Number(process.env.DASHBOARD_PORT || 3000);
  const distPath = resolve('dashboard/dist');

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, whatsappReady: Boolean(client?.info), time: new Date().toISOString() });
  });

  app.get('/api/state', (req, res) => {
    res.json(publicState(store));
  });

  app.get('/api/products', (req, res) => {
    res.json(store.getProducts());
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

  app.put('/api/profile', async (req, res) => {
    const profile = await store.updateBusinessProfile(req.body || {});
    res.json(profile);
  });

  app.get('/api/leads', (req, res) => {
    res.json(store.data.leads);
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
    if (!body) return res.status(400).json({ error: 'Message is required' });

    await client.sendMessage(`${req.params.phone}@c.us`, body);
    await store.addMessage({ phone: req.params.phone, from: 'owner', body });
    res.json({ ok: true });
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

  app.listen(port, () => {
    console.log(`Dashboard aktif di http://localhost:${port}`);
  });
}

function publicState(store) {
  return {
    businessProfile: store.getBusinessProfile(),
    products: store.getProducts(),
    leads: store.data.leads,
    conversations: store.data.conversations,
    messages: store.data.messages.slice(-300),
    compacted: store.data.compacted
  };
}

function validateProductInput(input, { partial = false } = {}) {
  if (!input || typeof input !== 'object') return 'Invalid product payload';
  if (!partial && !String(input.name || '').trim()) return 'Product name is required';
  if (input.price !== undefined && Number(input.price) < 0) return 'Price must be positive';
  return null;
}
