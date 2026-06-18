import assert from 'node:assert/strict';
import { test } from 'node:test';
import mysql from 'mysql2/promise';
import { defaultProducts } from './products.js';
import { runMigrations } from './db-migrate.js';
import { MysqlStore } from './mysql-store.js';
import { escapeMysqlIdentifier, mysqlConfigFromEnv, mysqlServerConfigFromEnv } from './mysql-config.js';

test('mysql store persists catalog media, leads, conversations, and messages', async (t) => {
  const database = `umkm_ai_test_${process.pid}_${Date.now()}`;
  const config = mysqlConfigFromEnv({ database });
  let serverConnection;

  try {
    serverConnection = await mysql.createConnection(mysqlServerConfigFromEnv(config));
  } catch (error) {
    t.skip(`MySQL is not available for integration test: ${error.message}`);
    return;
  }

  try {
    await runMigrations({ config, log: null });

    const store = new MysqlStore(config);
    await store.load();
    assert.ok(store.getProducts().every((product) => product.media.length > 1));

    const media = await store.addProductMedia('facial-acne', {
      label: 'QA carousel extra',
      url: defaultProducts[0].media[0].url
    });
    await store.upsertLead({
      phone: '628123450001',
      name: 'QA Customer',
      interest: 'Facial Acne',
      source: 'WhatsApp',
      status: 'Hot'
    });
    await store.addMessage({
      phone: '628123450001',
      from: 'customer',
      body: 'boleh tolong share foto foto nya?'
    });
    await store.close();

    const reloaded = new MysqlStore(config);
    await reloaded.load();
    const product = reloaded.getProduct('facial-acne');
    const lead = reloaded.findLeadByPhone('628123450001');
    const messages = reloaded.data.messages.filter((message) => message.phone === '628123450001');

    assert.ok(product.media.some((item) => item.id === media.id));
    assert.equal(lead.status, 'Hot');
    assert.equal(reloaded.data.conversations['628123450001'].interest, null);
    assert.match(messages[0].body, /share foto foto/i);
    await reloaded.close();
  } finally {
    await serverConnection.query(`DROP DATABASE IF EXISTS ${escapeMysqlIdentifier(database)}`);
    await serverConnection.end();
  }
});
