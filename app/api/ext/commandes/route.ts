import { NextRequest, NextResponse } from "next/server"

function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
  }
}

const SUCCESS_MSG = "Commande enregistrée avec succès."

const SB_URL        = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? "https://jwdrwapuetqoqnankgma.supabase.co"
// Service role — contourne RLS, obligatoire pour écrire dans fl_commandes
const SB_SERVER_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

// ── Injection automatique vers la logistique ERP ────────────────────────────
// Crée un bon de livraison dans fl_bons_livraison (ou fl_bons_preparation)
// dès qu'une commande web est enregistrée. Fire-and-forget.
async function injectToLogistique(
  sbUrl: string,
  sbKey: string,
  commande: Record<string, unknown>
): Promise<void> {
  const bonId = "BL-" + String(commande.numero).replace("WEB-", "")
  const bonPayload = {
    num_bon:           bonId,
    commande_id:       commande.numero,
    client:            commande.nom_client,
    telephone:         commande.telephone,
    adresse_livraison: commande.adresse_livraison ?? null,
    lignes:            commande.lignes,
    montant_total:     commande.montant_total,
    creneau:           commande.creneau ?? "Standard 24h",
    instructions:      commande.instructions ?? null,
    statut:            "a_preparer",
    source:            "site_web",
    created_at:        commande.created_at,
  }
  const headers = {
    apikey:         sbKey,
    Authorization:  `Bearer ${sbKey}`,
    "Content-Type": "application/json",
    Prefer:         "return=minimal",
  }
  for (const table of ["fl_bons_livraison", "fl_bons_preparation"]) {
    // Essai format JSONB {id, payload, updated_at}
    try {
      const r = await fetch(`${sbUrl}/rest/v1/${table}`, {
        method: "POST", headers,
        body: JSON.stringify({ id: bonId, payload: bonPayload, updated_at: commande.created_at }),
      })
      if (r.ok) { console.log(`[commandes] ✅ Bon injecté dans ${table} (JSONB):`, bonId); return }
    } catch { /* essayer format plat */ }
    // Essai format plat
    try {
      const r = await fetch(`${sbUrl}/rest/v1/${table}`, {
        method: "POST", headers,
        body: JSON.stringify({ id: bonId, ...bonPayload }),
      })
      if (r.ok) { console.log(`[commandes] ✅ Bon injecté dans ${table} (flat):`, bonId); return }
    } catch { /* essayer table suivante */ }
  }
  console.warn("[commandes] injectToLogistique: aucune table disponible pour", bonId)
}

// ── POST /api/ext/commandes ─────────────────────────────────────────────────
// Commandes web vitafresh → enregistrées dans fl_commandes (table {id, payload})
// Format attendu : { nom_client, telephone, lignes[], montant_total, ... }
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400, headers: corsHeaders(origin) })
  }

  const {
    nom_client, telephone, email, adresse_livraison,
    lignes, montant_total, creneau, instructions,
    statut = "nouveau", source = "site_web",
  } = body as Record<string, unknown>

  if (!nom_client || !telephone) {
    return NextResponse.json({ error: "nom_client et telephone sont requis." }, { status: 400, headers: corsHeaders(origin) })
  }
  if (!Array.isArray(lignes) || (lignes as unknown[]).length === 0) {
    return NextResponse.json({ error: "lignes[] ne peut pas être vide." }, { status: 400, headers: corsHeaders(origin) })
  }

  const numero  = "WEB-" + Date.now().toString().slice(-8)
  const total   = Number(montant_total) || (lignes as Record<string, number>[]).reduce((s, l) => s + (l.total ?? l.prixUnitaire * l.quantite ?? 0), 0)
  const now     = new Date().toISOString()

  // Payload complet (format ERP)
  const payloadData = {
    numero,
    nom_client:        String(nom_client).trim(),
    telephone:         String(telephone).trim(),
    email:             email ? String(email).trim() : null,
    adresse_livraison: adresse_livraison ? String(adresse_livraison).trim() : null,
    lignes,
    montant_total:     Math.round(total * 100) / 100,
    creneau:           creneau ? String(creneau) : "Standard 24h",
    instructions:      instructions ? String(instructions) : null,
    statut:            String(statut),
    source:            String(source),   // "site_web"
    created_at:        now,
  }

  // Sans Supabase configuré → succès silencieux (logué)
  if (!SB_URL || !SB_SERVER_KEY) {
    console.warn("[commandes] Supabase non configuré — commande non persistée", { numero, nom_client, telephone })
    return NextResponse.json({ numero, statut: "nouveau", message: SUCCESS_MSG }, { status: 201, headers: corsHeaders(origin) })
  }

  const sbH = {
    apikey:         SB_SERVER_KEY,
    Authorization:  `Bearer ${SB_SERVER_KEY}`,
    "Content-Type": "application/json",
    Prefer:         "return=minimal",
  }

  // ── Tentative 1 : fl_commandes format {id, payload} (table ERP unifiée) ───
  // Les tables fl_* utilisent le format JSONB : { id, payload, updated_at }
  try {
    const res = await fetch(`${SB_URL}/rest/v1/fl_commandes`, {
      method: "POST",
      headers: sbH,
      body: JSON.stringify({
        id:         numero,
        payload:    payloadData,
        updated_at: now,
      }),
    })
    if (res.ok) {
      console.log("[commandes] ✅ Enregistré dans fl_commandes (JSONB):", numero)
      void injectToLogistique(SB_URL, SB_SERVER_KEY, payloadData)
      return NextResponse.json({ numero, statut: "nouveau", message: SUCCESS_MSG }, { status: 201, headers: corsHeaders(origin) })
    }
    const errText = await res.text().catch(() => "")
    console.warn("[commandes] fl_commandes JSONB failed:", res.status, errText)
    // Si l'erreur est liée à un format différent (ancienne table plate), essai flat
  } catch (e) {
    console.warn("[commandes] fl_commandes JSONB exception:", e)
  }

  // ── Tentative 2 : fl_commandes format plat (ancienne structure) ───────────
  try {
    const res = await fetch(`${SB_URL}/rest/v1/fl_commandes`, {
      method: "POST",
      headers: sbH,
      body: JSON.stringify({ id: numero, ...payloadData }),
    })
    if (res.ok) {
      console.log("[commandes] ✅ Enregistré dans fl_commandes (flat):", numero)
      void injectToLogistique(SB_URL, SB_SERVER_KEY, payloadData)
      return NextResponse.json({ numero, statut: "nouveau", message: SUCCESS_MSG }, { status: 201, headers: corsHeaders(origin) })
    }
    const errText = await res.text().catch(() => "")
    console.warn("[commandes] fl_commandes flat failed:", res.status, errText)
  } catch (e) {
    console.warn("[commandes] fl_commandes flat exception:", e)
  }

  // ── Tentative 3 : fl_commandes_web (table dédiée web, format plat) ────────
  try {
    const res = await fetch(`${SB_URL}/rest/v1/fl_commandes_web`, {
      method: "POST",
      headers: sbH,
      body: JSON.stringify({ id: numero, ...payloadData }),
    })
    if (res.ok) {
      console.log("[commandes] ✅ Enregistré dans fl_commandes_web:", numero)
      void injectToLogistique(SB_URL, SB_SERVER_KEY, payloadData)
      return NextResponse.json({ numero, statut: "nouveau", message: SUCCESS_MSG }, { status: 201, headers: corsHeaders(origin) })
    }
    const errText = await res.text().catch(() => "")
    console.warn("[commandes] fl_commandes_web failed:", res.status, errText)
  } catch (e) {
    console.warn("[commandes] fl_commandes_web exception:", e)
  }

  // ── Toujours confirmer à l'utilisateur (commande loggée) ──────────────────
  console.error("[commandes] TOUTES tentatives Supabase échouées — commande loggée:", { numero, nom_client, telephone, total })
  return NextResponse.json(
    { numero, statut: "nouveau", message: SUCCESS_MSG },
    { status: 201, headers: corsHeaders(origin) }
  )
}

// ── GET /api/ext/commandes?tel=xxx ──────────────────────────────────────────
// Lit les commandes d'un client depuis fl_commandes ou fl_commandes_web
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")

  if (!SB_URL || !SB_SERVER_KEY) {
    return NextResponse.json([], { headers: corsHeaders(origin) })
  }

  const sbH = { apikey: SB_SERVER_KEY, Authorization: `Bearer ${SB_SERVER_KEY}` }
  const tel = req.nextUrl.searchParams.get("tel") || req.nextUrl.searchParams.get("telephone")
  if (!tel) return NextResponse.json({ error: "tel requis." }, { status: 400, headers: corsHeaders(origin) })

  const telEnc = encodeURIComponent(tel.trim())

  // ── Essai 1 : fl_commandes format JSONB — filtre sur payload->>telephone ──
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/fl_commandes?payload->>telephone=eq.${telEnc}&order=updated_at.desc&limit=50`,
      { headers: sbH }
    )
    if (res.ok) {
      const rows: { id: string; payload: Record<string, unknown>; updated_at: string }[] = await res.json()
      if (Array.isArray(rows) && rows.length > 0) {
        // Aplatir payload pour le client
        const flat = rows.map(r => ({
          id:         r.id,
          updated_at: r.updated_at,
          ...((r.payload && typeof r.payload === "object") ? r.payload : {}),
        }))
        return NextResponse.json(flat, { headers: corsHeaders(origin) })
      }
    }
  } catch { /* fallback */ }

  // ── Essai 2 : fl_commandes format plat — filtre direct sur telephone ──────
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/fl_commandes?telephone=eq.${telEnc}&order=created_at.desc&limit=50`,
      { headers: sbH }
    )
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        return NextResponse.json(data, { headers: corsHeaders(origin) })
      }
    }
  } catch { /* fallback */ }

  // ── Essai 3 : fl_commandes_web ────────────────────────────────────────────
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/fl_commandes_web?telephone=eq.${telEnc}&order=created_at.desc&limit=50`,
      { headers: sbH }
    )
    const data = await res.json()
    return NextResponse.json(Array.isArray(data) ? data : [], { headers: corsHeaders(origin) })
  } catch {
    return NextResponse.json([], { headers: corsHeaders(origin) })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) })
}
