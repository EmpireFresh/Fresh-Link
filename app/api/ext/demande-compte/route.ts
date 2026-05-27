import { NextRequest, NextResponse } from "next/server"

function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
  }
}

// ── POST /api/ext/demande-compte ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const origin      = req.headers.get("origin")
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "ERP backend non configuré. Contactez l'administrateur." },
      { status: 503, headers: corsHeaders(origin) }
    )
  }

  const sbHeaders = {
    apikey:         supabaseKey,
    Authorization:  `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400, headers: corsHeaders(origin) })
  }

  const { type, nom, email, telephone, societe, ice, ville, message } = body

  // ── Validation ──────────────────────────────────────────────────────────────
  const VALID_TYPES = ["client", "chr", "marchand", "particulier", "fournisseur"]
  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Type invalide." }, { status: 400, headers: corsHeaders(origin) })
  }
  if (!nom?.trim() || !telephone?.trim()) {
    return NextResponse.json({ error: "Nom et téléphone requis." }, { status: 400, headers: corsHeaders(origin) })
  }
  if (email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "Email invalide." }, { status: 400, headers: corsHeaders(origin) })
  }

  const typeMap: Record<string, string> = {
    chr: "client", marchand: "client", particulier: "client",
    client: "client", fournisseur: "fournisseur",
  }
  const canonicalType = typeMap[type] ?? "client"

  try {
    // ── Vérifier doublon par téléphone ─────────────────────────────────────────
    try {
      const dupRes = await fetch(
        `${supabaseUrl}/rest/v1/fl_account_requests?telephone=eq.${encodeURIComponent(telephone.trim())}&statut=eq.en_attente&select=id`,
        { headers: sbHeaders }
      )
      if (dupRes.ok) {
        const dups = await dupRes.json()
        if (Array.isArray(dups) && dups.length > 0) {
          return NextResponse.json(
            { error: "Une demande avec ce numéro est déjà en cours d'examen." },
            { status: 409, headers: corsHeaders(origin) }
          )
        }
      }
    } catch { /* table peut ne pas exister encore — on continue */ }

    // ── Insérer la demande ─────────────────────────────────────────────────────
    const insertRes = await fetch(
      `${supabaseUrl}/rest/v1/fl_account_requests`,
      {
        method: "POST",
        headers: { ...sbHeaders, Prefer: "return=representation" },
        body: JSON.stringify({
          type:       canonicalType,
          sous_type:  type.trim(),
          nom:        nom.trim(),
          email:      email?.trim()?.toLowerCase() ?? null,
          telephone:  telephone.trim(),
          societe:    societe?.trim() ?? null,
          ice:        ice?.trim() ?? null,
          ville:      ville?.trim() ?? null,
          message:    message?.trim() ?? null,
          statut:     "en_attente",
          created_at: new Date().toISOString(),
        }),
      }
    )

    // ── Si la table n'existe pas → fallback sur fl_site_access ────────────────
    if (!insertRes.ok) {
      const errBody = await insertRes.json().catch(() => ({})) as Record<string, unknown>
      const errMsg  = String(errBody?.message ?? errBody?.error ?? "")

      if (insertRes.status === 404 || errMsg.includes("does not exist") || errMsg.includes("relation")) {
        const fallbackRes = await fetch(
          `${supabaseUrl}/rest/v1/fl_site_access`,
          {
            method: "POST",
            headers: { ...sbHeaders, Prefer: "return=representation" },
            body: JSON.stringify({
              device_id: `demande-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              telephone: telephone.trim(),
              statut:    "en_attente",
              notes:     JSON.stringify({ nom: nom.trim(), type, email, societe, ice, ville, message }),
            }),
          }
        )
        if (fallbackRes.ok) {
          return NextResponse.json(
            { statut: "en_attente", message: "Votre demande a été enregistrée. Vous serez contacté sous 24-48h." },
            { status: 201, headers: corsHeaders(origin) }
          )
        }
      }

      console.error("[API /ext/demande-compte] Insert error:", errBody)
      return NextResponse.json(
        { error: "Erreur enregistrement. Réessayez ou contactez-nous directement." },
        { status: 500, headers: corsHeaders(origin) }
      )
    }

    const result = await insertRes.json()

    return NextResponse.json(
      {
        id:      result[0]?.id,
        statut:  "en_attente",
        message: "Votre demande a été enregistrée. Vous serez contacté sous 24-48h.",
      },
      { status: 201, headers: corsHeaders(origin) }
    )

  } catch (err) {
    console.error("[API /ext/demande-compte]", err)
    return NextResponse.json(
      { error: "Erreur serveur. Réessayez dans quelques instants." },
      { status: 500, headers: corsHeaders(origin) }
    )
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  })
}
