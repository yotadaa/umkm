import whatsappWeb from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import { handleIncomingMessage } from './chatbot.js';
import { startOwnerCli } from './owner-cli.js';
import { startAutoFollowUpScheduler } from './followup.js';
import { startDashboardServer } from './dashboard-server.js';
import { createAppStore } from './store-factory.js';
import { createWhatsAppSessionTracker } from './whatsapp-session.js';
import { recordOutgoingWhatsAppMessage, resolveIncomingWhatsAppPhone } from './whatsapp-recorder.js';

const { Client, LocalAuth } = whatsappWeb;

const store = createAppStore();
await store.load();

const whatsappSession = createWhatsAppSessionTracker({ sessionPath: process.env.WA_SESSION_PATH || './.wa-session' });
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: whatsappSession.snapshot().sessionPath }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

startDashboardServer({ client, store, whatsappSession });

client.on('qr', async (qr) => {
  try {
    const qrImage = await QRCode.toDataURL(qr, { margin: 1, width: 280, color: { dark: '#0b1c30', light: '#ffffff' } });
    whatsappSession.markQr(qr, { qrImage });
  } catch (error) {
    whatsappSession.markQr(qr);
    console.error('Gagal membuat QR untuk dashboard:', error.message);
  }

  console.log('\nScan QR berikut dari WhatsApp > Linked Devices:');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  whatsappSession.markAuthenticated();
  console.log('Session WhatsApp terautentikasi dan disimpan di .wa-session/.');
});

client.on('auth_failure', (message) => {
  whatsappSession.markAuthFailure(message);
  console.error('Autentikasi WhatsApp gagal:', message);
});

let ownerRuntimeStarted = false;

client.on('ready', () => {
  whatsappSession.markReady(client.info);
  console.log('\nWhatsApp bot aktif. Lead capture dan owner CLI berjalan.');

  if (!ownerRuntimeStarted) {
    ownerRuntimeStarted = true;
    startOwnerCli({ client, store });
    startAutoFollowUpScheduler({ client, store });
  }
});

client.on('message', async (message) => {
  if (message.fromMe || message.from.includes('@g.us')) return;

  try {
    const phone = await resolveIncomingWhatsAppPhone(message);
    const response = await handleIncomingMessage({ store, message, phone });
    if (response) await message.reply(response);
  } catch (error) {
    console.error('Gagal memproses pesan:', error.message);
    await message.reply('Maaf Kak, sistem sedang cek sebentar. Admin akan bantu lanjutkan ya.');
  }
});

client.on('message_create', async (message) => {
  try {
    await recordOutgoingWhatsAppMessage({ store, message });
  } catch (error) {
    console.error('Gagal mencatat pesan owner dari WhatsApp:', error.message);
  }
});

client.on('disconnected', (reason) => {
  whatsappSession.markDisconnected(reason);
  console.log('WhatsApp terputus:', reason);
});

client.initialize();
