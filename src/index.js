import whatsappWeb from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import { startOwnerCli } from './owner-cli.js';
import { startAutoFollowUpScheduler } from './followup.js';
import { startDashboardServer } from './dashboard-server.js';
import { createAppStore } from './store-factory.js';
import { createWhatsAppSessionTracker } from './whatsapp-session.js';
import { recordOutgoingWhatsAppMessage } from './whatsapp-recorder.js';
import { sendWhatsAppReply } from './whatsapp-replier.js';
import { handleIncomingWhatsAppMessage } from './whatsapp-handler.js';
import { initializeWhatsAppClient } from './whatsapp-startup.js';

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
    const result = await handleIncomingWhatsAppMessage({ store, client, message });
    console.log(`Pesan masuk WhatsApp dari ${result.phone}: ${String(message.body || '').slice(0, 120)}`);
    if (result.reply) console.log(`Balasan bot terkirim ke ${result.phone} via ${result.reply.method}.`);
    if (result.mediaSent?.length) console.log(`${result.mediaSent.length} foto produk terkirim ke ${result.phone}.`);
  } catch (error) {
    console.error('Gagal memproses pesan:', error.message);
    try {
      await sendWhatsAppReply({
        client,
        message,
        phone: message.from,
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

initializeWhatsAppClient({ client, whatsappSession }).then((result) => {
  if (!result.ok) console.error('WhatsApp tidak siap. Dashboard tetap aktif untuk cek QR/status.');
});
