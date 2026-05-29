import { NextRequest, NextResponse } from "next/server"
import { CATALOGUE_SEED } from "@/lib/catalogueSeed"
import { ERP_DEFAULT_ARTICLES } from "@/lib/defaultArticles"

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
  // Prefer service role key (server-side only) to bypass RLS on fl_articles
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
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
        `${supabaseUrl}/rest/v1/fl_articles?select=id,payload,updated_at&limit=500`,
        { headers: sbHeaders, next: { revalidate: 60 } }
      )
      if (res.ok) {
        const rows: { id: string; payload: Record<string, unknown>; updated_at: string }[] = await res.json()
        // Si Supabase a des lignes (même si toutes filtrées) → on utilise Supabase
        // Seule exception : 0 lignes = jamais configuré → fallback ERP defaults
        if (Array.isArray(rows) && rows.length > 0) {
          const articles = rows
            .filter(r => !String(r.id).startsWith("__")) // ignorer les entrées de config
            .map(r => {
              const p = (r.payload && typeof r.payload === "object" ? r.payload : {}) as Record<string, unknown>
              return { ...p, id: r.id }
            })
            .filter(a => a.marketplaceActif !== false && a.marketplace_actif !== false)
          const result = applyFilters(articles, q, tag).sort(byOrdre).map(normalizePayload)
          return NextResponse.json(result, { status: 200, headers: cors(origin) })
        }
      }
    } catch { /* continuer vers defaults */ }
  }

  // ── Fallback : articles ERP par défaut (131 produits avec prix calculés) ──
  // Priorité au ERP_DEFAULT_ARTICLES (données complètes) sur le CATALOGUE_SEED (34 articles)
  const erpFallback = ERP_DEFAULT_ARTICLES as unknown as Record<string, unknown>[]
  const filtered = applyFilters(erpFallback, q, tag)
  if (filtered.length > 0) {
    const result = filtered.map(a => normalizePayload(a))
    return NextResponse.json(result, {
      status: 200,
      headers: { ...cors(origin), "X-Source": "erp-defaults" },
    })
  }

  // ── Dernier recours : seed visuel (photos Unsplash) ───────────────────────
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
  const seedResult = seed.sort((a, b) => a.ordre - b.ordre).map(a => ({
    ...a,
    nomAr: a.nom_ar,
    prix: a.prix_public,
    prixVente: a.prix_public,
    stockDisponible: 99,
  }))
  return NextResponse.json(seedResult, {
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
    nomAr:           a.nomAr ?? a.nom_ar ?? "",
    prix:            a.prix_public ?? a.marketplace_prix_public ?? a.prix ?? 0,
    prixVente:       a.prix_public ?? a.prix ?? 0,
    stockDisponible: Number(a.stockDisponible ?? a.stock_disponible ?? a.qte ?? 0),
    marketplaceActif: a.marketplace_actif ?? true,
    unite:           a.unite ?? "kg",
    conditionnement: a.conditionnement ?? a.pack_info ?? null,
  }
}

/**
 * Normalise un article issu du payload JSONB fl_articles (champs camelCase ERP).
 * Calcule le prix depuis pvMethode/pvValeur/prixAchat si marketplacePrixPublic absent.
 */
function normalizePayload(a: Record<string, unknown>): Record<string, unknown> {
  // ── Prix système (plancher absolu) ───────────────────────────────────────
  let prixSysteme = parseFloat(String(a.marketplacePrixPublic ?? a.prix_public ?? 0)) || 0
  if (!prixSysteme && a.prixAchat) {
    const pa = parseFloat(String(a.prixAchat)) || 0
    const pv = parseFloat(String(a.pvValeur)) || 0
    if (a.pvMethode === "pourcentage") prixSysteme = Math.round(pa * (1 + pv / 100) * 100) / 100
    else if (a.pvMethode === "montant") prixSysteme = Math.round((pa + pv) * 100) / 100
    else prixSysteme = pv || pa
  }
  if (!prixSysteme) prixSysteme = parseFloat(String(a.pvValeur ?? 0)) || 0

  // ── Prix moyen des circuits (CHR / Marchand / Particulier) ────────────────
  // Règle : prix affiché = moyenne des circuits disponibles
  //         avec plancher = prix système (jamais en dessous sauf promo)
  const circuitPrices = [
    parseFloat(String(a.prixCHR ?? 0)) || 0,
    parseFloat(String(a.prixMarchand ?? 0)) || 0,
    parseFloat(String(a.prixParticulier ?? 0)) || 0,
  ].filter(p => p > 0)

  let prixBase = prixSysteme
  if (circuitPrices.length > 0) {
    const avg = Math.round((circuitPrices.reduce((s, p) => s + p, 0) / circuitPrices.length) * 100) / 100
    prixBase = Math.max(avg, prixSysteme)  // plancher = prix système
  }

  // ── Promo ─────────────────────────────────────────────────────────────────
  const promoObj = (a.marketplacePromo && typeof a.marketplacePromo === "object" && (a.marketplacePromo as Record<string, unknown>).actif)
    ? a.marketplacePromo as Record<string, unknown>
    : null
  const prix = promoObj?.prixPromo ? parseFloat(String(promoObj.prixPromo)) : prixBase

  // ── Statut / dispo — calculé depuis stock réel si non forcé manuellement ──
  const stockQte = Number(a.stockDisponible ?? a.qte ?? 0)
  const seuilShort = Number(a.marketplaceSeuilShortStock ?? 0)
  const statutForce = String(a.marketplaceStatut ?? a.statut ?? "")
  const statut = statutForce || (stockQte === 0 ? "out_of_stock" : seuilShort > 0 && stockQte <= seuilShort ? "short_stock" : "disponible")

  return {
    ...a,
    // Champs snake_case attendus par mapERPArticle côté website
    nom:              a.nom ?? "",
    nom_ar:           a.nomAr ?? a.nom_ar ?? "",
    unite:            a.unite ?? "kg",
    photo:            a.photo ?? (Array.isArray(a.photos) ? (a.photos as string[])[0] : "") ?? "",
    famille:          a.famille ?? "",
    description:      a.marketplaceDescription ?? a.marketplaceCommentaire ?? a.famille ?? "Maroc",
    prix_public:      prixBase,
    prixVente:        prixBase,
    prix:             prix,
    promo_prix:       promoObj?.prixPromo ?? null,
    etiquette:        promoObj?.etiquette ?? (promoObj?.taux ? `-${promoObj.taux}%` : null) ?? null,
    statut:           statut || "disponible",
    stock_disponible: Number(a.stockDisponible ?? a.qte ?? 0),
    stockDisponible:  Number(a.stockDisponible ?? a.qte ?? 0),
    conditionnement:  a.conditionnement ?? a.packInfo ?? a.pack_info ?? null,
    marketplace_actif: a.marketplaceActif !== false,
    ordre:            Number(a.marketplaceOrdre ?? a.ordre ?? 999),
    tags:             Array.isArray(a.marketplaceTags) ? a.marketplaceTags : (Array.isArray(a.tags) ? a.tags : []),
  }
}
