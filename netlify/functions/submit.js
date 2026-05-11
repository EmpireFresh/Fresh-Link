// netlify/functions/submit.js
// ─────────────────────────────────────────────────────────────────────────
// Serverless function : reçoit l'inscription → Supabase + WhatsApp groupe
// Fonctionne aussi sur Vercel : copiez ce fichier dans /api/submit.js
// ─────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

// ─── HELPERS ─────────────────────────────────────────────────────────────

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

// ─── WHATSAPP via Green API (greenapi.com) ────────────────────────────────
// Green API supporte l'envoi dans les groupes WhatsApp.
// Obtenez un compte gratuit sur https://green-api.com
// Variables requises :
//   GREEN_API_INSTANCE  → ex: 1101234567
//   GREEN_API_TOKEN     → votre apiTokenInstance
//   WA_GROUP_ID         → ID du groupe, format : 120363XXXXXXXXXX@g.us
//                         (récupérable via GET /getContacts ou depuis l'URL web.whatsapp.com)

async function sendWhatsAppGroup(message) {
  const instance = process.env.GREEN_API_INSTANCE;
  const token    = process.env.GREEN_API_TOKEN;
  const groupId  = process.env.WA_GROUP_ID;

  if (!instance || !token || !groupId) {
    console.warn('[WA] Variables GREEN_API manquantes — message non envoyé');
    return { skipped: true };
  }

  const url = `https://api.green-api.com/waInstance${instance}/sendMessage/${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: groupId, message }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(`Green API error: ${JSON.stringify(json)}`);
  return json;
}

// ─── WHATSAPP via UltraMsg (alternative) ──────────────────────────────────
// Si vous préférez UltraMsg (ultramsg.com), décommentez ce bloc et commentez
// la fonction sendWhatsAppGroup ci-dessus.
// Variables requises : ULTRAMSG_INSTANCE, ULTRAMSG_TOKEN, WA_GROUP_ID
//
// async function sendWhatsAppGroup(message) {
//   const res = await fetch(`https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE}/messages/chat`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//     body: new URLSearchParams({
//       token: process.env.ULTRAMSG_TOKEN,
//       to:    process.env.WA_GROUP_ID,   // format : 120363XXXXXXXXXX@g.us
//       body:  message,
//     }),
//   });
//   return res.json();
// }

// ─── HANDLER ─────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  // CORS
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalide' }) };
  }

  // ── 1. Supabase ──────────────────────────────────────────────────────────
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY   // ← clé Service (pas anon) pour bypasser RLS
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
    return { statusCode: 500, headers, body: JSON.stringify({ error: dbError.message }) };
  }

  // ── 2. WhatsApp groupe ───────────────────────────────────────────────────
  try {
    const msg = formatWAMessage(data);
    await sendWhatsAppGroup(msg);
  } catch (waErr) {
    // On log l'erreur WA mais on ne bloque pas — l'inscription est déjà sauvée
    console.error('[WhatsApp]', waErr.message);
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, message: 'Inscription enregistrée' }),
  };
};
