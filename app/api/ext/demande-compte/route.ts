import { NextRequest, NextResponse } from "next/server"

function corsHeaders(origin: string | null, allowed: string[]): HeadersInit {
  const allow =
    !allowed.length || (origin && (allowed.includes(origin) || allowed.includes("*")))
      ? origin ?? "*"
      : "null"
  return {
    "Access-Control-Allow-Origin":  allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
  }
}

// ── POST /api/ext/demande-compte ──────────────────────────────────────────────
// Crée une demande de compte depuis le site web externe
// Auth: public si demandesComptes=true dans la config

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "ERP backend not configured" }, { status: 503 })
    }

    // Read config
    const cfgRes = await fetch(
      `${supabaseUrl}/rest/v1/fl_web_integration?id=eq.main&select=*`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const cfgArr = await cfgRes.json()
    const cfg = cfgArr?.[0]

    if (!cfg?.enabled) {
      return NextResponse.json({ error: "API externe désactivée." }, { status: 403, headers: corsHeaders(origin, []) })
    }

    const allowedOrigins: string[] = cfg.allowed_origins ?? []

    // Default true if column missing (backwards compat with old fl_web_integration rows)
    if (cfg.demandes_comptes === false) {
      return NextResponse.json(
        { error: "Les demandes de compte sont désactivées pour le moment." },
        { status: 403, headers: corsHeaders(origin, allowedOrigins) }
      )
    }

    // Parse body
    const body = await req.json()
    const { type, nom, email, telephone, societe, ice, ville, message } = body

    // Accepted types: client, chr, marchand, particulier, fournisseur
    const VALID_TYPES = ["client", "chr", "marchand", "particulier", "fournisseur"]
    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "Type invalide." }, { status: 400 })
    }
    if (!nom?.trim() || !telephone?.trim()) {
      return NextResponse.json({ error: "Champs requis manquants: nom, téléphone." }, { status: 400 })
    }
    // Email optional — validate only if provided
    if (email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: "Email invalide." }, { status: 400 })
    }

    // Map frontend types to canonical ERP types
    const typeMap: Record<string, string> = {
      chr: "client", marchand: "client", particulier: "client",
      client: "client", fournisseur: "fournisseur"
    }
    const canonicalType = typeMap[type] ?? "client"

    // Check for duplicate by phone (more reliable than email)
    const dupRes = await fetch(
      `${supabaseUrl}/rest/v1/fl_account_requests?telephone=eq.${encodeURIComponent(telephone.trim())}&statut=eq.en_attente&select=id`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const dups = await dupRes.json()
    if (Array.isArray(dups) && dups.length > 0) {
      return NextResponse.json(
        { error: "Une demande avec ce numéro est déjà en cours d'examen." },
        { status: 409, headers: corsHeaders(origin, allowedOrigins) }
      )
    }

    // Insert request
    const insertRes = await fetch(
      `${supabaseUrl}/rest/v1/fl_account_requests`,
      {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          type:      canonicalType,
          sous_type: type.trim(),        // preserve original (chr, marchand…)
          nom:       nom.trim(),
          email:     email?.trim()?.toLowerCase() ?? null,
          telephone: telephone.trim(),
          societe:   societe?.trim() ?? null,
          ice:       ice?.trim() ?? null,
          ville:     ville?.trim() ?? null,
          message:   message?.trim() ?? null,
          statut:    "en_attente",
        }),
      }
    )

    const result = await insertRes.json()

    if (!insertRes.ok) {
      console.error("[API /ext/demande-compte] Insert error:", result)
      return NextResponse.json({ error: "Erreur enregistrement." }, { status: 500 })
    }

    // Trigger webhook if configured
    if (cfg.webhook_url) {
      fetch(cfg.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(cfg.webhook_secret ? { "X-Webhook-Secret": cfg.webhook_secret } : {}) },
        body: JSON.stringify({ event: "nouvelle_demande_compte", data: result[0] }),
      }).catch(() => {}) // fire-and-forget
    }

    return NextResponse.json(
      { id: result[0]?.id, statut: "en_attente", message: "Votre demande a été enregistrée. Vous serez contacté sous 24-48h." },
      { status: 201, headers: corsHeaders(origin, allowedOrigins) }
    )
  } catch (err) {
    console.error("[API /ext/demande-compte]", err)
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin"), ["*"]) })
}
