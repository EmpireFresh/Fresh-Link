import { NextRequest, NextResponse } from "next/server"

// ── Helpers ───────────────────────────────────────────────────────────────────

function cors(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
    "Cache-Control":                "s-maxage=60, stale-while-revalidate=300",
  }
}

// ── GET /api/ext/catalogue ────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const origin      = req.headers.get("origin")
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "ERP non configuré" }, { status: 503 })
  }

  const sbHeaders = {
    apikey:        supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
  }

  const { q, famille, tag } = Object.fromEntries(req.nextUrl.searchParams)

  // ── Tentative 1 : vue v_marketplace_catalogue ─────────────────────────────
  try {
    let url = `${supabaseUrl}/rest/v1/v_marketplace_catalogue?select=*&marketplace_actif=eq.true`
    if (famille) url += `&famille=eq.${encodeURIComponent(famille)}`

    const res  = await fetch(url, { headers: sbHeaders, next: { revalidate: 60 } })

    if (res.ok) {
      let articles: Record<string, unknown>[] = await res.json()
      articles = applyFilters(articles, q, tag)
      articles.sort((a, b) => ((a.ordre as number) ?? 999) - ((b.ordre as number) ?? 999))
      articles = articles.map(normalize)
      return NextResponse.json(articles, { status: 200, headers: cors(origin) })
    }
  } catch { /* essayer fallback */ }

  // ── Tentative 2 : table fl_articles (fallback) ────────────────────────────
  try {
    let url = `${supabaseUrl}/rest/v1/fl_articles?select=id,payload,nom,updated_at`
    if (famille) url += `&famille=eq.${encodeURIComponent(famille)}`

    const res  = await fetch(url, { headers: sbHeaders, next: { revalidate: 60 } })

    if (res.ok) {
      const rows: Record<string, unknown>[] = await res.json()

      // Les articles sont stockés dans un champ JSON "payload"
      let articles = rows.flatMap(row => {
        if (row.payload && typeof row.payload === "object") return [row.payload as Record<string, unknown>]
        return [row]
      })

      articles = applyFilters(articles, q, tag)
      articles = articles.map(normalize)
      return NextResponse.json(articles, { status: 200, headers: cors(origin) })
    }
  } catch { /* continuer */ }

  // ── Aucune source disponible ──────────────────────────────────────────────
  return NextResponse.json(
    { error: "Catalogue temporairement indisponible", articles: [] },
    { status: 200, headers: cors(origin) }   // 200 pour que le site affiche un état vide sans crash
  )
}

// ── OPTIONS (CORS preflight) ──────────────────────────────────────────────────
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function applyFilters(articles: Record<string, unknown>[], q?: string, tag?: string) {
  if (q) {
    const lq = q.toLowerCase()
    articles = articles.filter(a =>
      String(a.nom ?? "").toLowerCase().includes(lq) ||
      String(a.nom_ar ?? "").includes(lq) ||
      String(a.famille ?? "").toLowerCase().includes(lq)
    )
  }
  if (tag) {
    articles = articles.filter(a =>
      Array.isArray(a.tags) && (a.tags as string[]).some(t => t.toLowerCase() === tag.toLowerCase())
    )
  }
  return articles
}

function normalize(a: Record<string, unknown>): Record<string, unknown> {
  return {
    ...a,
    nomAr:           a.nom_ar ?? "",
    prix:            a.prix_public ?? a.marketplace_prix_public ?? a.prix ?? 0,
    prixVente:       a.prix_public ?? a.prix ?? 0,
    stockDisponible: 99,
    marketplaceActif: a.marketplace_actif ?? true,
  }
}
