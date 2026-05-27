import { NextRequest, NextResponse } from "next/server"
import { CATALOGUE_SEED } from "@/lib/catalogueSeed"

// ── CORS ──────────────────────────────────────────────────────────────────────
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
  const { q, famille, tag } = Object.fromEntries(req.nextUrl.searchParams)

  const sbHeaders = supabaseUrl && supabaseKey ? {
    apikey:        supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
  } : null

  // ── Tentative 1 : vue v_marketplace_catalogue (Supabase) ──────────────────
  if (sbHeaders) {
    try {
      let url = `${supabaseUrl}/rest/v1/v_marketplace_catalogue?select=*&marketplace_actif=eq.true`
      if (famille) url += `&famille=eq.${encodeURIComponent(famille)}`

      const res = await fetch(url, { headers: sbHeaders, next: { revalidate: 60 } })
      if (res.ok) {
        const data: Record<string, unknown>[] = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          const articles = applyFilters(data, q, tag).sort(byOrdre).map(normalize)
          return NextResponse.json(articles, { status: 200, headers: cors(origin) })
        }
      }
    } catch { /* essayer fallback */ }

    // ── Tentative 2 : table fl_articles (payload JSON) ────────────────────────
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/fl_articles?select=id,payload,nom,updated_at`,
        { headers: sbHeaders, next: { revalidate: 60 } }
      )
      if (res.ok) {
        const rows: Record<string, unknown>[] = await res.json()
        if (Array.isArray(rows) && rows.length > 0) {
          const articles = rows
            .flatMap(r => r.payload && typeof r.payload === "object" ? [r.payload as Record<string, unknown>] : [r])
            .filter(a => a.marketplace_actif !== false)
          if (articles.length > 0) {
            const result = applyFilters(articles, q, tag).sort(byOrdre).map(normalize)
            return NextResponse.json(result, { status: 200, headers: cors(origin) })
          }
        }
      }
    } catch { /* continuer vers seed */ }
  }

  // ── Fallback : catalogue seed intégré (fruits, légumes, herbes) ──────────
  let seed = CATALOGUE_SEED.filter(a => a.marketplace_actif)
  if (famille) seed = seed.filter(a => a.famille === famille)
  if (q) {
    const lq = q.toLowerCase()
    seed = seed.filter(a =>
      a.nom.toLowerCase().includes(lq) ||
      a.nom_ar.includes(lq) ||
      a.famille.toLowerCase().includes(lq)
    )
  }
  if (tag) {
    seed = seed.filter(a => a.tags.some(t => t.toLowerCase() === tag.toLowerCase()))
  }

  const result = seed.sort((a, b) => a.ordre - b.ordre).map(a => ({
    ...a,
    nomAr:           a.nom_ar,
    prix:            a.prix_public,
    prixVente:       a.prix_public,
    stockDisponible: 99,
  }))

  return NextResponse.json(result, {
    status: 200,
    headers: { ...cors(origin), "X-Source": "seed" },
  })
}

// ── OPTIONS ───────────────────────────────────────────────────────────────────
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}

// ── Utilitaires ───────────────────────────────────────────────────────────────
function applyFilters(articles: Record<string, unknown>[], q?: string, tag?: string) {
  let result = articles
  if (q) {
    const lq = q.toLowerCase()
    result = result.filter(a =>
      String(a.nom ?? "").toLowerCase().includes(lq) ||
      String(a.nom_ar ?? "").includes(lq) ||
      String(a.famille ?? "").toLowerCase().includes(lq)
    )
  }
  if (tag) {
    result = result.filter(a =>
      Array.isArray(a.tags) && (a.tags as string[]).some(t => t.toLowerCase() === tag.toLowerCase())
    )
  }
  return result
}

function byOrdre(a: Record<string, unknown>, b: Record<string, unknown>) {
  return ((a.ordre as number) ?? 999) - ((b.ordre as number) ?? 999)
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
