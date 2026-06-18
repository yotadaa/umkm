import mysql from 'mysql2/promise';
import { Store } from './store.js';
import { mysqlConfigFromEnv } from './mysql-config.js';

export class MysqlStore extends Store {
  constructor(config = mysqlConfigFromEnv()) {
    super(new URL('../data/db.json', import.meta.url));
    this.config = config;
    this.pool = null;
  }

  async load() {
    this.pool = mysql.createPool({
      ...this.config,
      waitForConnections: true,
      connectionLimit: 5,
      timezone: 'Z'
    });

    this.data = await this.readDatabase();
    this.normalizeData();
  }

  async close() {
    if (this.pool) await this.pool.end();
    this.pool = null;
  }

  async save() {
    if (!this.pool) throw new Error('MysqlStore must be loaded before save()');

    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      await saveBusinessProfile(connection, this.data.businessProfile);
      await saveProducts(connection, this.data.products);
      await saveLeads(connection, this.data.leads);
      await saveConversations(connection, this.data.conversations);
      await saveMessages(connection, this.data.messages);
      await saveCompacted(connection, this.data.compacted);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async readDatabase() {
    const [profileRows] = await this.pool.query('SELECT * FROM business_profiles WHERE id = 1 LIMIT 1');
    const [productRows] = await this.pool.query('SELECT * FROM products ORDER BY sort_order ASC, name ASC');
    const [keywordRows] = await this.pool.query('SELECT * FROM product_keywords ORDER BY product_id ASC, sort_order ASC');
    const [mediaRows] = await this.pool.query('SELECT * FROM product_media ORDER BY product_id ASC, sort_order ASC');
    const [leadRows] = await this.pool.query('SELECT * FROM leads ORDER BY id ASC');
    const [conversationRows] = await this.pool.query('SELECT * FROM conversations ORDER BY updated_at DESC');
    const [messageRows] = await this.pool.query('SELECT * FROM messages ORDER BY id ASC');
    const [compactedRows] = await this.pool.query('SELECT * FROM compacted ORDER BY id ASC');

    const products = productRows.map((row) => ({
      id: row.id,
      name: row.name,
      price: Number(row.price || 0),
      keywords: keywordRows.filter((keyword) => keyword.product_id === row.id).map((keyword) => keyword.keyword),
      description: row.description || '',
      promo: row.promo || '',
      media: mediaRows.filter((media) => media.product_id === row.id).map((media) => ({
        id: media.id,
        label: media.label,
        type: media.type,
        url: media.url
      }))
    }));

    return {
      businessProfile: profileRows[0] ? mapProfile(profileRows[0]) : {},
      products,
      leads: leadRows.map(mapLead),
      conversations: conversationRows.reduce((acc, row) => {
        acc[row.phone] = mapConversation(row);
        return acc;
      }, {}),
      messages: messageRows.map(mapMessage),
      compacted: compactedRows.map(mapCompacted)
    };
  }
}

async function saveBusinessProfile(connection, profile) {
  await connection.execute(
    `INSERT INTO business_profiles
      (id, name, role, address, hours, admin_phone, current_promo)
      VALUES (1, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        role = VALUES(role),
        address = VALUES(address),
        hours = VALUES(hours),
        admin_phone = VALUES(admin_phone),
        current_promo = VALUES(current_promo)`,
    [
      profile.name || '',
      profile.role || '',
      profile.address || '',
      profile.hours || '',
      profile.adminPhone || '',
      profile.currentPromo || ''
    ]
  );
}

async function saveProducts(connection, products) {
  await connection.query('DELETE FROM product_keywords');
  await connection.query('DELETE FROM product_media');
  await connection.query('DELETE FROM products');

  for (const [index, product] of products.entries()) {
    await connection.execute(
      `INSERT INTO products (id, name, price, description, promo, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)`,
      [product.id, product.name, Number(product.price || 0), product.description || '', product.promo || '', index]
    );

    for (const [keywordIndex, keyword] of (product.keywords || []).entries()) {
      await connection.execute(
        `INSERT INTO product_keywords (product_id, keyword, sort_order)
          VALUES (?, ?, ?)`,
        [product.id, keyword, keywordIndex]
      );
    }

    for (const [mediaIndex, media] of (product.media || []).entries()) {
      await connection.execute(
        `INSERT INTO product_media (product_id, id, label, type, url, sort_order)
          VALUES (?, ?, ?, ?, ?, ?)`,
        [product.id, media.id, media.label, media.type, media.url, mediaIndex]
      );
    }
  }
}

async function saveLeads(connection, leads) {
  await connection.query('DELETE FROM leads');

  for (const lead of leads) {
    await connection.execute(
      `INSERT INTO leads
        (id, name, phone, interest, source, status, follow_ups_sent, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?, ?)`,
      [
        Number(lead.id || 0),
        lead.name || '-',
        lead.phone,
        lead.interest || '-',
        lead.source || 'WhatsApp',
        lead.status || 'New',
        JSON.stringify(lead.followUpsSent || []),
        JSON.stringify(lead.notes || []),
        toMysqlDateTime(lead.created_at),
        toMysqlDateTime(lead.updated_at)
      ]
    );
  }
}

async function saveConversations(connection, conversations) {
  await connection.query('DELETE FROM conversations');

  for (const conversation of Object.values(conversations || {})) {
    await connection.execute(
      `INSERT INTO conversations
        (phone, customer_id, name, interest, source, status, stage, compacted_token_count, compacted_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        conversation.phone,
        conversation.customerId || `lead-${conversation.phone}`,
        conversation.name || null,
        conversation.interest || null,
        conversation.source || null,
        conversation.status || 'New',
        conversation.stage || 'new',
        Number(conversation.compactedTokenCount || 0),
        conversation.compactedAt ? toMysqlDateTime(conversation.compactedAt) : null,
        toMysqlDateTime(conversation.createdAt),
        toMysqlDateTime(conversation.updatedAt)
      ]
    );
  }
}

async function saveMessages(connection, messages) {
  await connection.query('DELETE FROM messages');

  for (const message of messages) {
    await connection.execute(
      `INSERT INTO messages (phone, sender, body, created_at)
        VALUES (?, ?, ?, ?)`,
      [message.phone, message.from, message.body || '', toMysqlDateTime(message.created_at)]
    );
  }
}

async function saveCompacted(connection, compacted) {
  await connection.query('DELETE FROM compacted');

  for (const item of compacted) {
    await connection.execute(
      `INSERT INTO compacted
        (phone, customer_id, name, interest, status, message_count, estimated_tokens, summary, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.phone,
        item.customerId || `lead-${item.phone}`,
        item.name || null,
        item.interest || null,
        item.status || 'New',
        Number(item.messageCount || 0),
        Number(item.estimatedTokens || 0),
        item.summary || '',
        toMysqlDateTime(item.created_at)
      ]
    );
  }
}

function mapProfile(row) {
  return {
    name: row.name,
    role: row.role,
    address: row.address,
    hours: row.hours,
    adminPhone: row.admin_phone,
    currentPromo: row.current_promo
  };
}

function mapLead(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    interest: row.interest,
    source: row.source,
    status: row.status,
    followUpsSent: parseJsonArray(row.follow_ups_sent),
    notes: parseJsonArray(row.notes),
    created_at: fromMysqlDateTime(row.created_at),
    updated_at: fromMysqlDateTime(row.updated_at)
  };
}

function mapConversation(row) {
  return {
    phone: row.phone,
    customerId: row.customer_id,
    name: row.name,
    interest: row.interest,
    source: row.source,
    status: row.status,
    stage: row.stage,
    compactedTokenCount: Number(row.compacted_token_count || 0),
    compactedAt: row.compacted_at ? fromMysqlDateTime(row.compacted_at) : null,
    createdAt: fromMysqlDateTime(row.created_at),
    updatedAt: fromMysqlDateTime(row.updated_at)
  };
}

function mapMessage(row) {
  return {
    phone: row.phone,
    from: row.sender,
    body: row.body,
    created_at: fromMysqlDateTime(row.created_at)
  };
}

function mapCompacted(row) {
  return {
    phone: row.phone,
    customerId: row.customer_id,
    name: row.name,
    interest: row.interest,
    status: row.status,
    messageCount: Number(row.message_count || 0),
    estimatedTokens: Number(row.estimated_tokens || 0),
    summary: row.summary,
    created_at: fromMysqlDateTime(row.created_at)
  };
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toMysqlDateTime(value) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return safeDate.toISOString().slice(0, 19).replace('T', ' ');
}

function fromMysqlDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const normalized = String(value).replace(' ', 'T');
  const date = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}
