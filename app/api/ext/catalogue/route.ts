import { NextRequest, NextResponse } from "next/server"

// ── Helpers ──────────────────────────────────────────────────────────────────

function corsHeaders(origin: string | null, allowedOrigins: string[]): HeadersInit {
  const allow =
    !allowedOrigins.length ||
    (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes("*")))
      ? origin ?? "*"
      : "null"
  return {
    "Access-Control-Allow-Origin":  allow,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
    "Cache-Control":                "s-maxage=60, stale-while-revalidate=300",
  }
}

// ── GET /api/ext/catalogue ────────────────────────────────────────────────────
// Retourne tous les articles publiés sur la marketplace
// Auth: public si cataloguePublic=true, sinon X-Api-Key requis

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")

  try {
    // Read integration config from Supabase or fallback to env
    // In localStorage-first mode, the config is managed client-side.
    // This route acts as a proxy that reads from Supabase when available.

    const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const internalKey  = process.env.ERP_INTERNAL_API_KEY ?? ""

    // Validate API key if provided
    const reqKey = req.headers.get("x-api-key") ?? req.nextUrl.searchParams.get("api_key")

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "ERP backend not configured" },
        { status: 503 }
      )
    }

    // Fetch web integration config
    const cfgRes = await fetch(
      `${supabaseUrl}/rest/v1/fl_web_integration?id=eq.main&select=*`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }, next: { revalidate: 60 } }
    )
    const cfgArr = await cfgRes.json()
    const cfg = cfgArr?.[0]

    if (!cfg?.enabled) {
      return NextResponse.json(
        { error: "API externe désactivée. Contactez l'administrateur." },
        { status: 403, headers: corsHeaders(origin, []) }
      )
    }

    const allowedOrigins: string[] = cfg.allowed_origins ?? []

    // Auth check
    if (!cfg.catalogue_public) {
      if (!reqKey || reqKey !== cfg.api_key) {
        return NextResponse.json(
          { error: "Clé API invalide ou manquante." },
          { status: 401, headers: corsHeaders(origin, allowedOrigins) }
        )
      }
    }

    // Fetch marketplace catalogue via SQL view
    const { statut, famille, tag, q } = Object.fromEntries(req.nextUrl.searchParams)

    let url = `${supabaseUrl}/rest/v1/v_marketplace_catalogue?select=*`
    if (statut) url += `&statut=eq.${statut}`
    if (famille) url += `&famille=eq.${encodeURIComponent(famille)}`

    const dataRes = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 60 },
    })

    let articles = await dataRes.json()

    // Client-side filters
    if (q) {
      const lq = q.toLowerCase()
      articles = articles.filter((a: any) =>
        a.nom?.toLowerCase().includes(lq) ||
        a.nom_ar?.includes(lq) ||
        a.famille?.toLowerCase().includes(lq)
      )
    }
    if (tag) {
      articles = articles.filter((a: any) =>
        Array.isArray(a.tags) && a.tags.some((t: string) => t.toLowerCase() === tag.toLowerCase())
      )
    }

    return NextResponse.json(articles, {
      status: 200,
      headers: {
        ...corsHeaders(origin, allowedOrigins),
        "Content-Type": "application/json",
      },
    })
  } catch (err) {
    console.error("[API /ext/catalogue]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// ── OPTIONS (CORS preflight) ──────────────────────────────────────────────────
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin")
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin, ["*"]),
  })
}
