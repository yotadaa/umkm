import whatsappWeb from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { Store } from './store.js';
import { handleIncomingMessage } from './chatbot.js';
import { startOwnerCli } from './owner-cli.js';
import { startAutoFollowUpScheduler } from './followup.js';
import { startDashboardServer } from './dashboard-server.js';

const { Client, LocalAuth } = whatsappWeb;

const store = new Store(new URL('../data/db.json', import.meta.url));
await store.load();

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wa-session' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', (qr) => {
  console.log('\nScan QR berikut dari WhatsApp > Linked Devices:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('\nWhatsApp bot aktif. Lead capture dan owner CLI berjalan.');
  startOwnerCli({ client, store });
  startAutoFollowUpScheduler({ client, store });
  startDashboardServer({ client, store });
});

client.on('message', async (message) => {
  if (message.fromMe || message.from.includes('@g.us')) return;

  try {
    const response = await handleIncomingMessage({ store, message });
    if (response) await message.reply(response);
  } catch (error) {
    console.error('Gagal memproses pesan:', error.message);
    await message.reply('Maaf Kak, sistem sedang cek sebentar. Admin akan bantu lanjutkan ya.');
  }
});

client.on('disconnected', (reason) => {
  console.log('WhatsApp terputus:', reason);
});

client.initialize();
