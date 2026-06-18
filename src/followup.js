const followUpRules = [
  { key: 'h1', afterDays: 1 },
  { key: 'h3', afterDays: 3 },
  { key: 'h7', afterDays: 7 }
];

export async function sendFollowUps({ client, store, leads, day, reason = 'manual' }) {
  const sent = [];

  for (const lead of leads) {
    if (!canFollowUp(lead, day)) continue;

    const message = followUpMessage(lead, day);
    await client.sendMessage(`${lead.phone}@c.us`, message);
    await store.markFollowUp(lead.phone, day);
    sent.push({ lead, day, reason });
  }

  return sent;
}

export function dueFollowUps(leads, now = new Date()) {
  const due = [];

  for (const lead of leads) {
    if (lead.status === 'Closed') continue;

    const ageDays = leadAgeDays(lead, now);
    const rule = followUpRules
      .filter((item) => ageDays >= item.afterDays)
      .reverse()
      .find((item) => !lead.followUpsSent?.includes(item.key));

    if (rule) due.push({ lead, day: rule.key, ageDays });
  }

  return due;
}

export function startAutoFollowUpScheduler({ client, store }) {
  if (process.env.AUTO_FOLLOWUP !== 'true') return null;

  const intervalMinutes = Number(process.env.AUTO_FOLLOWUP_INTERVAL_MINUTES || 60);
  const intervalMs = Math.max(intervalMinutes, 1) * 60 * 1000;

  const run = async () => {
    const dueItems = dueFollowUps(store.data.leads);

    for (const item of dueItems) {
      const sent = await sendFollowUps({
        client,
        store,
        leads: [item.lead],
        day: item.day,
        reason: 'auto'
      });

      for (const entry of sent) {
        console.log(`Auto follow-up ${entry.day} terkirim ke ${entry.lead.name} (${entry.lead.phone}).`);
      }
    }
  };

  run().catch((error) => console.error('Auto follow-up error:', error.message));
  const timer = setInterval(() => {
    run().catch((error) => console.error('Auto follow-up error:', error.message));
  }, intervalMs);

  console.log(`Auto follow-up aktif setiap ${intervalMinutes} menit.`);
  return timer;
}

export function followUpMessage(lead, day) {
  const name = lead.name && lead.name !== '-' ? lead.name : 'Kak';
  const interest = lead.interest && lead.interest !== '-' ? lead.interest : 'treatment kami';
  const prefix = `Halo ${name === 'Kak' ? 'Kak' : `Kak ${name}`},`;

  if (day === 'h3') return `${prefix} saya follow up lagi ya. Apakah masih tertarik dengan ${interest}? Minggu ini masih ada slot promo.`;
  if (day === 'h7') return `${prefix} promo ${interest} masih bisa dibantu cek jadwalnya. Kalau mau konsultasi dulu juga boleh.`;

  return `${prefix} apakah masih tertarik dengan paket ${interest}? Saya bisa bantu cek jadwal atau konsultasi dulu.`;
}

function canFollowUp(lead, day) {
  return lead.status !== 'Closed' && !lead.followUpsSent?.includes(day);
}

function leadAgeDays(lead, now) {
  const createdAt = new Date(lead.created_at);
  if (Number.isNaN(createdAt.getTime())) return 0;
  return Math.floor((now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000));
}
