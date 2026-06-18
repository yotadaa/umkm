import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { defaultBusinessProfile, defaultProducts } from './products.js';
import { runMigrations } from './db-migrate.js';
import { MysqlStore } from './mysql-store.js';
import { mysqlConfigFromEnv } from './mysql-config.js';

export async function seedDatabase({ config = mysqlConfigFromEnv(), log = console.log } = {}) {
  await runMigrations({ config, log });

  const store = new MysqlStore(config);
  await store.load();

  const now = new Date();
  const anHourAgo = minutesAgo(now, 62);
  const fourDaysAgo = daysAgo(now, 4);
  const eightDaysAgo = daysAgo(now, 8);

  store.data = {
    businessProfile: structuredClone(defaultBusinessProfile),
    products: structuredClone(defaultProducts),
    leads: [
      {
        id: 1,
        name: 'Anita Sari',
        phone: '628111222333',
        interest: 'Facial Acne',
        source: 'WhatsApp',
        status: 'Hot',
        followUpsSent: [],
        notes: ['Customer meminta foto treatment sebelum booking.'],
        created_at: anHourAgo,
        updated_at: now.toISOString()
      },
      {
        id: 2,
        name: 'Budi Pratama',
        phone: '628555777999',
        interest: 'Facial Brightening',
        source: 'WhatsApp',
        status: 'Warm',
        followUpsSent: ['h1'],
        notes: ['Tertarik promo konsultasi gratis.'],
        created_at: fourDaysAgo,
        updated_at: minutesAgo(now, 45)
      },
      {
        id: 3,
        name: 'Citra Lestari',
        phone: '628777444222',
        interest: 'Anti Aging Treatment',
        source: 'WhatsApp',
        status: 'New',
        followUpsSent: [],
        notes: ['Minta info paket 3x treatment.'],
        created_at: eightDaysAgo,
        updated_at: daysAgo(now, 1)
      }
    ],
    conversations: {
      '628111222333': {
        phone: '628111222333',
        customerId: 'lead-628111222333',
        name: 'Anita Sari',
        interest: 'Facial Acne',
        source: 'WhatsApp',
        status: 'Hot',
        stage: 'consultation',
        compactedTokenCount: 0,
        compactedAt: null,
        createdAt: anHourAgo,
        updatedAt: now.toISOString()
      },
      '628555777999': {
        phone: '628555777999',
        customerId: 'lead-628555777999',
        name: 'Budi Pratama',
        interest: 'Facial Brightening',
        source: 'WhatsApp',
        status: 'Warm',
        stage: 'nurturing',
        compactedTokenCount: 0,
        compactedAt: null,
        createdAt: fourDaysAgo,
        updatedAt: minutesAgo(now, 45)
      },
      '628777444222': {
        phone: '628777444222',
        customerId: 'lead-628777444222',
        name: 'Citra Lestari',
        interest: 'Anti Aging Treatment',
        source: 'WhatsApp',
        status: 'New',
        stage: 'new',
        compactedTokenCount: 0,
        compactedAt: null,
        createdAt: eightDaysAgo,
        updatedAt: daysAgo(now, 1)
      }
    },
    messages: [
      {
        phone: '628111222333',
        from: 'customer',
        body: 'Halo, facial acne harganya berapa ya?',
        created_at: minutesAgo(now, 58)
      },
      {
        phone: '628111222333',
        from: 'bot',
        body: 'Halo Kak Anita, Facial Acne Rp150.000 dan minggu ini promo jadi Rp120.000.',
        created_at: minutesAgo(now, 57)
      },
      {
        phone: '628111222333',
        from: 'customer',
        body: 'boleh tolong share foto foto nya?',
        created_at: minutesAgo(now, 55)
      },
      {
        phone: '628111222333',
        from: 'bot',
        body: 'Bisa Kak. Saya siapkan 3 foto Facial Acne. Admin bisa share foto produk dari dashboard.',
        created_at: minutesAgo(now, 54)
      },
      {
        phone: '628555777999',
        from: 'customer',
        body: 'Mau facial brightening, apakah bisa konsultasi dulu?',
        created_at: daysAgo(now, 3)
      },
      {
        phone: '628555777999',
        from: 'bot',
        body: 'Bisa Kak Budi. Facial Brightening Rp175.000 dan konsultasi kulit gratis sebelum treatment.',
        created_at: daysAgo(now, 3)
      },
      {
        phone: '628777444222',
        from: 'customer',
        body: 'Ada treatment untuk flek dan tanda penuaan?',
        created_at: daysAgo(now, 1)
      },
      {
        phone: '628777444222',
        from: 'bot',
        body: 'Ada Kak, Anti Aging Treatment Rp250.000. Paket 3x treatment hemat Rp100.000.',
        created_at: daysAgo(now, 1)
      }
    ],
    compacted: []
  };

  await store.save();
  await store.close();

  log?.(`seeded ${store.data.products.length} products, ${store.data.leads.length} leads, and ${store.data.messages.length} messages into ${config.database}`);
}

function daysAgo(now, days) {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function minutesAgo(now, minutes) {
  const date = new Date(now);
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  seedDatabase().catch((error) => {
    console.error('Database seed failed:', error.message);
    process.exitCode = 1;
  });
}
