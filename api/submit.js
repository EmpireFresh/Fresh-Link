// api/submit.js  — Vercel Serverless Function
// Identique à netlify/functions/submit.js mais adapté au format Vercel

const { createClient } = require('@supabase/supabase-js');

function formatWAMessage(d) {
  const now = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca' });
  return [
    '🌿 *Nouvelle Inscription — Empire Fresh*',
    `🕐 ${now}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `👤 *Profil* : ${d.type}${d.autres_detail ? ` (${d.autres_detail})` : ''}`,
    '',
    '📋 *ACTIVITÉ*',
    `🏢 Structure  : ${d.taille}`,
    `📅 Fréquence  : ${d.frequence || '—'}`,
    `🛒 Gamme      : ${d.gamme || '—'}`,
    `⚖️ Volume     : ${d.volume}`,
    '',
    '📞 *CONTACT*',
    `👤 Nom        : ${d.nom}`,
    `📱 WhatsApp   : ${d.telephone}`,
    `📍 Adresse    : ${d.adresse}`,
    `🏘 Quartier   : ${d.quartier}`,
    `🚚 Livraison  : ${d.livraison || '—'}`,
    d.notes ? `📝 Notes      : ${d.notes}` : '',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    '✅ _Enregistré dans Supabase_',
  ].filter(Boolean).join('\n');
}

async function sendWhatsAppGroup(message) {
  const instance = process.env.GREEN_API_INSTANCE;
  const token    = process.env.GREEN_API_TOKEN;
  const groupId  = process.env.WA_GROUP_ID;
  if (!instance || !token || !groupId) return { skipped: true };

  const res = await fetch(
    `https://api.green-api.com/waInstance${instance}/sendMessage/${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: groupId, message }),
    }
  );
  return res.json();
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const data = req.body;

  // 1. Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { error: dbError } = await supabase
    .from('inscriptions')
    .insert([{
      type:          data.type,
      autres_detail: data.autres_detail || null,
      taille:        data.taille,
      frequence:     data.frequence || null,
      gamme:         data.gamme || null,
      volume:        data.volume,
      nom:           data.nom,
      telephone:     data.telephone,
      adresse:       data.adresse,
      quartier:      data.quartier,
      livraison:     data.livraison || null,
      notes:         data.notes || null,
      source:        'website-form',
    }]);

  if (dbError) {
    console.error('[Supabase]', dbError);
    return res.status(500).json({ error: dbError.message });
  }

  // 2. WhatsApp groupe
  try {
    await sendWhatsAppGroup(formatWAMessage(data));
  } catch (e) {
    console.error('[WhatsApp]', e.message);
  }

  return res.status(200).json({ success: true });
}
