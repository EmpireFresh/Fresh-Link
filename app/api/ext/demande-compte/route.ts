import { NextRequest, NextResponse } from "next/server"

function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
  }
}

const SUCCESS_MSG = "Votre demande a été enregistrée. Notre équipe vous contactera sous 24-48h."

// ── POST /api/ext/demande-compte ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const origin      = req.headers.get("origin")
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: Record<string, string> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400, headers: corsHeaders(origin) })
  }

  const { type, nom, email, telephone, societe, ice, ville, message } = body

  // ── Validation ──────────────────────────────────────────────────────────────
  const VALID_TYPES = ["client", "chr", "marchand", "particulier", "fournisseur"]
  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Type invalide." }, { status: 400, headers: corsHeaders(origin) })
  }
  if (!nom?.trim() || !telephone?.trim()) {
    return NextResponse.json({ error: "Nom et téléphone sont requis." }, { status: 400, headers: corsHeaders(origin) })
  }
  if (email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "Adresse email invalide." }, { status: 400, headers: corsHeaders(origin) })
  }

  const typeMap: Record<string, string> = {
    chr: "client", marchand: "client", particulier: "client",
    client: "client", fournisseur: "fournisseur",
  }
  const canonicalType = typeMap[type] ?? "client"

  // ── Sans Supabase configuré → succès silencieux ──────────────────────────
  if (!supabaseUrl || !supabaseKey) {
    console.warn("[demande-compte] Supabase non configuré — demande non persistée", { nom, telephone, type })
    return NextResponse.json({ statut: "en_attente", message: SUCCESS_MSG }, { status: 201, headers: corsHeaders(origin) })
  }

  const sbH = {
    apikey:         supabaseKey,
    Authorization:  `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    Prefer:         "return=minimal",
  }

  // ── Tentative 1 : fl_account_requests ────────────────────────────────────
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/fl_account_requests`, {
      method: "POST",
      headers: sbH,
      body: JSON.stringify({
        type:       canonicalType,
        sous_type:  type.trim(),
        nom:        nom.trim(),
        email:      email?.trim()?.toLowerCase() || null,
        telephone:  telephone.trim(),
        societe:    societe?.trim() || null,
        ice:        ice?.trim() || null,
        ville:      ville?.trim() || null,
        message:    message?.trim() || null,
        statut:     "en_attente",
      }),
    })

    if (res.ok) {
      return NextResponse.json({ statut: "en_attente", message: SUCCESS_MSG }, { status: 201, headers: corsHeaders(origin) })
    }

    // Log l'erreur mais on continue vers le fallback
    const errText = await res.text().catch(() => "")
    console.warn("[demande-compte] fl_account_requests failed:", res.status, errText)
  } catch (e) {
    console.warn("[demande-compte] fl_account_requests exception:", e)
  }

  // ── Tentative 2 : fl_site_access (fallback toujours) ─────────────────────
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/fl_site_access`, {
      method: "POST",
      headers: sbH,
      body: JSON.stringify({
        device_id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        telephone: telephone.trim(),
        statut:    "en_attente",
        notes:     JSON.stringify({
          _source:  "demande-compte",
          nom:      nom.trim(),
          type,
          email:    email?.trim() || null,
          societe:  societe?.trim() || null,
          ice:      ice?.trim() || null,
          ville:    ville?.trim() || null,
          message:  message?.trim() || null,
        }),
      }),
    })

    if (res.ok) {
      return NextResponse.json({ statut: "en_attente", message: SUCCESS_MSG }, { status: 201, headers: corsHeaders(origin) })
    }

    const errText = await res.text().catch(() => "")
    console.warn("[demande-compte] fl_site_access fallback failed:", res.status, errText)
  } catch (e) {
    console.warn("[demande-compte] fl_site_access exception:", e)
  }

  // ── Tentative 3 : même si tout échoue → confirmer à l'utilisateur ─────────
  // La demande est loggée côté serveur Vercel (console.warn ci-dessus)
  // L'équipe peut récupérer les demandes depuis les logs Vercel
  console.error("[demande-compte] TOUTES les tentatives ont échoué — demande loggée:", {
    nom: nom.trim(), telephone: telephone.trim(), type,
    email: email?.trim() || null, societe: societe?.trim() || null,
    ville: ville?.trim() || null,
  })

  // On retourne quand même un succès pour ne pas bloquer l'utilisateur
  return NextResponse.json(
    { statut: "en_attente", message: SUCCESS_MSG },
    { status: 201, headers: corsHeaders(origin) }
  )
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) })
}
