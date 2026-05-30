import { NextRequest, NextResponse } from "next/server"

// ══════════════════════════════════════════════════════════════
// GET /api/ext/stats — Statistiques publiques pour le site web
// Retourne le nombre de clients actifs + répartition par catégorie
// ══════════════════════════════════════════════════════════════

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL    ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SB_SRV = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role || process.env.SUPABASE_SERVICE_KEY)   ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

function cors(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")

  const result = {
    // clientsActifs = TOTAL clients ERP (toutes catégories), pour la stat hero
    clientsActifs: 0,
    categories: { chr: 0, marchand: 0, particulier: 0, autre: 0 },
    // articlesActifs = TOTAL articles ERP (pour la stat "Produits frais")
    articlesActifs: 0,
    // articlesPublies = uniquement ceux publiés sur la boutique
    articlesPublies: 0,
  }

  try {
    // ── TOUS les clients depuis fl_clients (total ERP) ──────────────────────
    const res = await fetch(
      `${SB_URL}/rest/v1/fl_clients?select=id,payload&limit=5000`,
      { headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}` }, next: { revalidate: 120 } }
    )
    if (res.ok) {
      const rows: { id: string; payload: Record<string, unknown> }[] = await res.json()
      for (const r of rows) {
        if (String(r.id).startsWith("__")) continue
        const p = r.payload ?? {}
        result.clientsActifs++   // total (on ne filtre plus sur actif)
        const cat = String(p.categorie ?? p.segment ?? p.type ?? "").toLowerCase()
        if (cat.includes("chr")) result.categories.chr++
        else if (cat.includes("marchand") || cat.includes("grossiste")) result.categories.marchand++
        else if (cat.includes("particulier") || cat === "standard" || cat === "client") result.categories.particulier++
        else result.categories.autre++
      }
    }
  } catch { /* défaut 0 */ }

  try {
    // ── TOUS les articles depuis fl_articles (total ERP) ────────────────────
    const res = await fetch(
      `${SB_URL}/rest/v1/fl_articles?select=id,payload&limit=5000`,
      { headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}` }, next: { revalidate: 120 } }
    )
    if (res.ok) {
      const rows: { id: string; payload: Record<string, unknown> }[] = await res.json()
      const real = rows.filter(r => !String(r.id).startsWith("__"))
      result.articlesActifs  = real.length  // TOTAL articles ERP
      result.articlesPublies = real.filter(r => r.payload?.marketplaceActif !== false && r.payload?.marketplaceActif === true).length
    }
  } catch { /* défaut 0 */ }

  return NextResponse.json(result, { status: 200, headers: cors(origin) })
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
