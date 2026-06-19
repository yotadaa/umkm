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
import { sendWhatsAppReply } from './whatsapp-replier.js';

const { Client, LocalAuth } = whatsappWeb;

const store = createAppStore();
await store.load();

const whatsappSession = createWhatsAppSessionTracker({ sessionPath: process.env.WA_SESSION_PATH || './.wa-session' });
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: whatsappSession.snapshot().sessionPath }),
  authTimeoutMs: Number(process.env.WA_AUTH_TIMEOUT_MS || 60000),
  takeoverOnConflict: true,
  takeoverTimeoutMs: 0,
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
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

client.on('loading_screen', (percent, message) => {
  whatsappSession.markLoading(percent, message);
  console.log(`WhatsApp loading ${percent}%: ${message}`);
});

client.on('change_state', (state) => {
  whatsappSession.markState(state);
  console.log('WhatsApp state:', state);
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
    console.log(`Pesan masuk WhatsApp dari ${phone}: ${String(message.body || '').slice(0, 120)}`);
    const response = await handleIncomingMessage({ store, message, phone });
    if (response) {
      const sent = await sendWhatsAppReply({ client, message, phone, body: response });
      console.log(`Balasan bot terkirim ke ${phone} via ${sent.method}.`);
    }
  } catch (error) {
    console.error('Gagal memproses pesan:', error.message);
    try {
      await sendWhatsAppReply({
        client,
        message,
        phone: await resolveIncomingWhatsAppPhone(message),
        body: 'Maaf Kak, sistem sedang cek sebentar. Admin akan bantu lanjutkan ya.'
      });
    } catch (replyError) {
      console.error('Gagal mengirim pesan fallback:', replyError.message);
    }
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

client.initialize().catch((error) => {
  whatsappSession.markError(error);
  console.error('Gagal menginisialisasi WhatsApp:', error?.stack || error);
});
