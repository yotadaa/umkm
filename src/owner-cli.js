import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { dueFollowUps, sendFollowUps } from './followup.js';

export function startOwnerCli({ client, store }) {
  const rl = readline.createInterface({ input, output });

  printHelp();
  promptLoop({ rl, client, store }).catch((error) => {
    console.error('CLI owner error:', error.message);
  });
}

async function promptLoop({ rl, client, store }) {
  while (true) {
    const command = (await rl.question('\nowner> ')).trim();

    if (!command) continue;
    if (command === 'help') printHelp();
    else if (command === 'dashboard') printDashboard(store.data.leads);
    else if (command === 'leads') printLeadTable(store.data.leads);
    else if (command === 'followup due') printDueFollowUps(store.data.leads);
    else if (command.startsWith('followup')) await handleFollowUp({ command, client, store });
    else if (command.startsWith('broadcast')) await handleBroadcast({ command, client, store });
    else if (command === 'exit') process.exit(0);
    else console.log('Command tidak dikenal. Ketik help untuk daftar command.');
  }
}

function printHelp() {
  console.log('\nWhatsApp CRM CLI siap. Command owner:');
  console.log('help                       Tampilkan bantuan');
  console.log('dashboard                  Statistik lead');
  console.log('leads                      Tabel lead');
  console.log('followup <id|all> <h1|h3|h7> Kirim pesan follow-up');
  console.log('followup due               Tampilkan lead yang sudah waktunya follow-up');
  console.log('broadcast <pesan>          Kirim promo ke semua lead');
  console.log('exit                       Keluar');
}

function printDashboard(leads) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7);

  const stats = {
    today: leads.filter((lead) => lead.created_at.startsWith(today)).length,
    month: leads.filter((lead) => lead.created_at.startsWith(month)).length,
    hot: leads.filter((lead) => lead.status === 'Hot').length,
    warm: leads.filter((lead) => lead.status === 'Warm').length,
    cold: leads.filter((lead) => lead.status === 'Cold').length,
    new: leads.filter((lead) => lead.status === 'New').length
  };

  console.log('\nDashboard Lead');
  console.table(stats);
}

function printLeadTable(leads) {
  if (!leads.length) {
    console.log('Belum ada lead. Coba chat ke nomor WA bot dulu.');
    return;
  }

  console.table(leads.map((lead) => ({
    id: lead.id,
    nama: lead.name,
    nomor: lead.phone,
    minat: lead.interest,
    source: lead.source,
    status: lead.status,
    tanggal: lead.created_at.slice(0, 10)
  })));
}

async function handleFollowUp({ command, client, store }) {
  const [, target, day = 'h1'] = command.split(/\s+/);
  if (!target) {
    console.log('Format: followup <id|all> <h1|h3|h7>');
    return;
  }

  const leads = target === 'all'
    ? store.data.leads.filter((lead) => lead.status !== 'Closed')
    : store.data.leads.filter((lead) => String(lead.id) === target);

  if (!leads.length) {
    console.log('Lead tidak ditemukan.');
    return;
  }

  for (const lead of leads) {
    const sent = await sendFollowUps({ client, store, leads: [lead], day });
    if (sent.length) console.log(`Follow-up ${day} terkirim ke ${lead.name} (${lead.phone}).`);
    else console.log(`Skip ${lead.name} (${lead.phone}): follow-up ${day} sudah pernah dikirim atau lead closed.`);
  }
}

function printDueFollowUps(leads) {
  const dueItems = dueFollowUps(leads);

  if (!dueItems.length) {
    console.log('Belum ada lead yang due untuk follow-up.');
    return;
  }

  console.table(dueItems.map(({ lead, day, ageDays }) => ({
    id: lead.id,
    nama: lead.name,
    nomor: lead.phone,
    minat: lead.interest,
    status: lead.status,
    followup: day,
    umur_hari: ageDays
  })));
}

async function handleBroadcast({ command, client, store }) {
  const message = command.replace(/^broadcast\s*/i, '').trim() || store.getBusinessProfile().currentPromo;

  if (!store.data.leads.length) {
    console.log('Belum ada lead untuk broadcast.');
    return;
  }

  for (const lead of store.data.leads) {
    await client.sendMessage(`${lead.phone}@c.us`, `Halo Kak ${lead.name}, ${message}`);
    console.log(`Broadcast terkirim ke ${lead.name} (${lead.phone}).`);
  }
}
