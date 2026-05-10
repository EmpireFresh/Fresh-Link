import { NextRequest, NextResponse } from "next/server"

function corsHeaders(origin: string | null, allowed: string[]): HeadersInit {
  const allow =
    !allowed.length || (origin && (allowed.includes(origin) || allowed.includes("*")))
      ? origin ?? "*"
      : "null"
  return {
    "Access-Control-Allow-Origin":  allow,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
  }
}

async function getConfig(supabaseUrl: string, supabaseKey: string) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/fl_web_integration?id=eq.main&select=*`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  )
  const arr = await res.json()
  return arr?.[0] ?? null
}

// ── POST /api/ext/commandes ───────────────────────────────────────────────────
// Crée une commande depuis le site web
// Requires: X-Api-Key + commandesPubliques=true

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "ERP non configuré" }, { status: 503 })
    }

    const cfg = await getConfig(supabaseUrl, supabaseKey)
    const allowedOrigins: string[] = cfg?.allowed_origins ?? []

    if (!cfg?.enabled) {
      return NextResponse.json({ error: "API externe désactivée." }, { status: 403, headers: corsHeaders(origin, []) })
    }
    if (!cfg.commandes_publiques) {
      return NextResponse.json({ error: "Commandes via API désactivées." }, { status: 403, headers: corsHeaders(origin, allowedOrigins) })
    }

    // Auth
    const reqKey = req.headers.get("x-api-key")
    if (!reqKey || reqKey !== cfg.api_key) {
      return NextResponse.json({ error: "Clé API invalide." }, { status: 401, headers: corsHeaders(origin, allowedOrigins) })
    }

    const body = await req.json()
    const { clientId, lignes, dateLivraison, notes } = body

    if (!clientId || !Array.isArray(lignes) || lignes.length === 0) {
      return NextResponse.json(
        { error: "clientId et lignes[] requis." },
        { status: 400, headers: corsHeaders(origin, allowedOrigins) }
      )
    }

    // Validate client exists
    const clientRes = await fetch(
      `${supabaseUrl}/rest/v1/fl_clients?id=eq.${clientId}&select=id,nom,actif`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const clients = await clientRes.json()
    if (!clients?.[0]?.actif) {
      return NextResponse.json({ error: "Client introuvable ou inactif." }, { status: 404, headers: corsHeaders(origin, allowedOrigins) })
    }
    const client = clients[0]

    // Enrich lignes with article data
    const articleIds = lignes.map((l: any) => l.articleId).filter(Boolean)
    const artRes = await fetch(
      `${supabaseUrl}/rest/v1/fl_articles?id=in.(${articleIds.join(",")})&select=id,nom,unite,marketplace_prix_public,pv_valeur,pv_methode,prix_achat,actif,marketplace_actif`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const articles: any[] = await artRes.json()

    const articlesMap = Object.fromEntries(articles.map((a: any) => [a.id, a]))

    let total = 0
    const lignesEnriched = lignes.map((l: any) => {
      const art = articlesMap[l.articleId]
      if (!art || !art.actif || !art.marketplace_actif) {
        throw new Error(`Article ${l.articleId} indisponible.`)
      }
      const pu = art.marketplace_prix_public ??
        (art.pv_methode === "pourcentage" ? art.prix_achat * (1 + art.pv_valeur / 100) :
         art.pv_methode === "montant"     ? art.prix_achat + art.pv_valeur :
         art.pv_valeur)
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
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
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
      return NextResponse.json({ error: "Erreur enregistrement commande." }, { status: 500 })
    }

    // Webhook
    if (cfg.webhook_url) {
      fetch(cfg.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "nouvelle_commande_marketplace", data: result[0] }),
      }).catch(() => {})
    }

    return NextResponse.json(
      { id: result[0]?.id, statut: "en_attente", total, lignes: lignesEnriched.length },
      { status: 201, headers: corsHeaders(origin, allowedOrigins) }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur serveur." }, { status: 500 })
  }
}

// ── GET /api/ext/commandes?clientId=xxx ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const cfg = await getConfig(supabaseUrl, supabaseKey)
    const allowedOrigins: string[] = cfg?.allowed_origins ?? []

    const reqKey = req.headers.get("x-api-key")
    if (!reqKey || reqKey !== cfg?.api_key) {
      return NextResponse.json({ error: "Clé API invalide." }, { status: 401, headers: corsHeaders(origin, allowedOrigins) })
    }

    const clientId = req.nextUrl.searchParams.get("clientId")
    if (!clientId) return NextResponse.json({ error: "clientId requis." }, { status: 400 })

    const res = await fetch(
      `${supabaseUrl}/rest/v1/fl_commandes?client_id=eq.${clientId}&order=date.desc&select=id,date,date_livraison,statut,total,source,notes`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const data = await res.json()
    return NextResponse.json(data, { headers: corsHeaders(origin, allowedOrigins) })
  } catch {
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin"), ["*"]) })
}
