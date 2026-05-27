import { NextRequest, NextResponse } from "next/server"

function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
  }
}

// ── POST /api/ext/commandes ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const origin      = req.headers.get("origin")
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "ERP non configuré" }, { status: 503, headers: corsHeaders(origin) })
  }

  const sbH = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" }

  try {
    const body = await req.json()
    const { clientId, lignes, dateLivraison, notes } = body

    if (!clientId || !Array.isArray(lignes) || lignes.length === 0) {
      return NextResponse.json({ error: "clientId et lignes[] requis." }, { status: 400, headers: corsHeaders(origin) })
    }

    // Validate client exists
    const clientRes = await fetch(
      `${supabaseUrl}/rest/v1/fl_clients?id=eq.${clientId}&select=id,nom,actif`,
      { headers: sbH }
    )
    const clients = await clientRes.json()
    if (!clients?.[0]?.actif) {
      return NextResponse.json({ error: "Client introuvable ou inactif." }, { status: 404, headers: corsHeaders(origin) })
    }

    // Enrich lignes with article data
    const articleIds = lignes.map((l: Record<string, unknown>) => l.articleId).filter(Boolean)
    const artRes = await fetch(
      `${supabaseUrl}/rest/v1/fl_articles?id=in.(${articleIds.join(",")})&select=id,nom,unite,marketplace_prix_public,prix_public,actif,marketplace_actif`,
      { headers: sbH }
    )
    const articles: Record<string, unknown>[] = await artRes.json()
    const articlesMap = Object.fromEntries(articles.map(a => [a.id as string, a]))

    let total = 0
    const lignesEnriched = lignes.map((l: Record<string, unknown>) => {
      const art = articlesMap[l.articleId as string]
      if (!art) throw new Error(`Article ${l.articleId} introuvable.`)
      const pu  = Number(art.marketplace_prix_public ?? art.prix_public ?? 0)
      const qty = Number(l.quantite) || 0
      const lineTotal = Math.round(pu * qty * 100) / 100
      total += lineTotal
      return {
        articleId:    art.id,
        articleNom:   art.nom,
        quantite:     qty,
        prixUnitaire: pu,
        unite:        art.unite,
        total:        lineTotal,
      }
    })

    total = Math.round(total * 100) / 100

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/fl_commandes`, {
      method: "POST",
      headers: { ...sbH, Prefer: "return=representation" },
      body: JSON.stringify({
        client_id:      clientId,
        date:           new Date().toISOString().split("T")[0],
        date_livraison: dateLivraison ?? null,
        statut:         "en_attente",
        source:         "marketplace",
        lignes:         lignesEnriched,
        total,
        notes:          notes ?? null,
        created_by:     clientId,
      }),
    })

    const result = await insertRes.json()
    if (!insertRes.ok) {
      return NextResponse.json({ error: "Erreur enregistrement commande." }, { status: 500, headers: corsHeaders(origin) })
    }

    return NextResponse.json(
      { id: result[0]?.id, statut: "en_attente", total, lignes: lignesEnriched.length },
      { status: 201, headers: corsHeaders(origin) }
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur serveur."
    return NextResponse.json({ error: msg }, { status: 500, headers: corsHeaders(origin) })
  }
}

// ── GET /api/ext/commandes?clientId=xxx ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const origin      = req.headers.get("origin")
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "ERP non configuré" }, { status: 503, headers: corsHeaders(origin) })
  }

  const sbH = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }

  try {
    const clientId = req.nextUrl.searchParams.get("clientId")
    if (!clientId) return NextResponse.json({ error: "clientId requis." }, { status: 400, headers: corsHeaders(origin) })

    const res = await fetch(
      `${supabaseUrl}/rest/v1/fl_commandes?client_id=eq.${clientId}&order=date.desc&select=id,date,date_livraison,statut,total,source,notes`,
      { headers: sbH }
    )
    const data = await res.json()
    return NextResponse.json(data, { headers: corsHeaders(origin) })
  } catch {
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500, headers: corsHeaders(origin) })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) })
}
