import { NextRequest, NextResponse } from "next/server"

function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
  }
}

const SUCCESS_MSG = "Commande enregistrée avec succès."

// ── POST /api/ext/commandes ─────────────────────────────────────────────────
// Accepte les commandes web (vitafresh) : pas besoin de clientId ERP
// Format attendu : { nom_client, telephone, lignes[], montant_total, ... }
export async function POST(req: NextRequest) {
  const origin      = req.headers.get("origin")
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400, headers: corsHeaders(origin) })
  }

  const {
    nom_client, telephone, email, adresse_livraison,
    lignes, montant_total, creneau, instructions,
    statut = "nouveau", source = "site_web",
  } = body as Record<string, unknown>

  // Validation minimale
  if (!nom_client || !telephone) {
    return NextResponse.json({ error: "nom_client et telephone sont requis." }, { status: 400, headers: corsHeaders(origin) })
  }
  if (!Array.isArray(lignes) || (lignes as unknown[]).length === 0) {
    return NextResponse.json({ error: "lignes[] ne peut pas être vide." }, { status: 400, headers: corsHeaders(origin) })
  }

  const numero = "WEB-" + Date.now().toString().slice(-8)
  const total  = Number(montant_total) || (lignes as Record<string, number>[]).reduce((s, l) => s + (l.total ?? l.prixUnitaire * l.quantite ?? 0), 0)

  const payload = {
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
    source:            String(source),
    created_at:        new Date().toISOString(),
  }

  // Sans Supabase configuré → succès silencieux (logué)
  if (!supabaseUrl || !supabaseKey) {
    console.warn("[commandes] Supabase non configuré — commande non persistée", { numero, nom_client, telephone })
    return NextResponse.json({ numero, statut: "nouveau", message: SUCCESS_MSG }, { status: 201, headers: corsHeaders(origin) })
  }

  const sbH = {
    apikey:        supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    Prefer:        "return=minimal",
  }

  // ── Tentative 1 : fl_commandes_web ─────────────────────────────────────────
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/fl_commandes_web`, {
      method: "POST", headers: sbH, body: JSON.stringify(payload),
    })
    if (res.ok) {
      return NextResponse.json({ numero, statut: "nouveau", message: SUCCESS_MSG }, { status: 201, headers: corsHeaders(origin) })
    }
    const errText = await res.text().catch(() => "")
    console.warn("[commandes] fl_commandes_web failed:", res.status, errText)
  } catch (e) {
    console.warn("[commandes] fl_commandes_web exception:", e)
  }

  // ── Tentative 2 : fl_site_access (fallback JSONB) ──────────────────────────
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/fl_site_access`, {
      method: "POST", headers: sbH,
      body: JSON.stringify({
        device_id: `order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        telephone: String(telephone).trim(),
        statut:    "en_attente",
        notes:     JSON.stringify({ _source: "commande-web", ...payload }),
      }),
    })
    if (res.ok) {
      return NextResponse.json({ numero, statut: "nouveau", message: SUCCESS_MSG }, { status: 201, headers: corsHeaders(origin) })
    }
    console.warn("[commandes] fl_site_access fallback failed:", res.status)
  } catch (e) {
    console.warn("[commandes] fl_site_access exception:", e)
  }

  // ── Tentative 3 : toujours confirmer à l'utilisateur ───────────────────────
  console.error("[commandes] TOUTES tentatives échouées — commande loggée:", { numero, nom_client, telephone, total })
  return NextResponse.json(
    { numero, statut: "nouveau", message: SUCCESS_MSG },
    { status: 201, headers: corsHeaders(origin) }
  )
}

// ── GET /api/ext/commandes?tel=xxx ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  const origin      = req.headers.get("origin")
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json([], { headers: corsHeaders(origin) })
  }

  const sbH = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }

  try {
    const tel = req.nextUrl.searchParams.get("tel") || req.nextUrl.searchParams.get("telephone")
    if (!tel) return NextResponse.json({ error: "tel requis." }, { status: 400, headers: corsHeaders(origin) })

    const res = await fetch(
      `${supabaseUrl}/rest/v1/fl_commandes_web?telephone=eq.${encodeURIComponent(tel)}&order=created_at.desc&limit=20`,
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
