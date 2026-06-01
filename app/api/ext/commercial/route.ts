import { NextRequest, NextResponse } from "next/server"

// ══════════════════════════════════════════════════════════════════
// /api/ext/commercial — Moteur commercial (expose les fonctions SQL V3)
//   POST { action, ...params }
//     action = "gratuite"  → fl_calc_gratuite(article, segment, qte)
//     action = "bonus"     → fl_calc_bonus(prevendeur, ca, segment, famille)
//     action = "cash"      → fl_calc_cash_terrain(date)
//     action = "pa_predit" → fl_pa_predit(article)
//     action = "pricing"   → fl_pricing_dynamique(article, cost_log, marge, client)
// Calculs 100% côté serveur → anti-fraude (les prévendeurs ne peuvent pas
// manipuler remises/gratuités depuis le mobile).
// ══════════════════════════════════════════════════════════════════

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SB_SRV = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role || process.env.SUPABASE_SERVICE_KEY) ?? ""

function cors(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }
}

/** Appelle une fonction PL/pgSQL via PostgREST RPC. */
async function rpc(fn: string, params: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SB_SRV,
      Authorization: `Bearer ${SB_SRV}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`RPC ${fn} échec : ${txt}`)
  }
  return res.json()
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!SB_SRV) {
    return NextResponse.json({ ok: false, error: "service_role manquante" }, { status: 500, headers: cors(origin) })
  }

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400, headers: cors(origin) })
  }

  const action = String(body.action ?? "")

  try {
    let result: unknown
    switch (action) {
      case "gratuite":
        result = await rpc("fl_calc_gratuite", {
          p_article: String(body.article ?? ""),
          p_segment: String(body.segment ?? "tous"),
          p_qte: Number(body.qte) || 0,
        })
        return NextResponse.json({ ok: true, action, qteOfferte: result }, { headers: cors(origin) })

      case "bonus":
        result = await rpc("fl_calc_bonus", {
          p_prevendeur: String(body.prevendeur ?? ""),
          p_ca: Number(body.ca) || 0,
          p_segment: String(body.segment ?? "particulier"),
          p_famille: String(body.famille ?? "TOUTES"),
        })
        return NextResponse.json({ ok: true, action, bonus: result }, { headers: cors(origin) })

      case "cash":
        result = await rpc("fl_calc_cash_terrain", {
          p_date: String(body.date ?? new Date().toISOString().slice(0, 10)),
        })
        return NextResponse.json({ ok: true, action, cashTerrain: result }, { headers: cors(origin) })

      case "pa_predit":
        result = await rpc("fl_pa_predit", { p_article: String(body.article ?? "") })
        return NextResponse.json({ ok: true, action, paPredit: result }, { headers: cors(origin) })

      case "pricing":
        result = await rpc("fl_pricing_dynamique", {
          p_article: String(body.article ?? ""),
          p_cost_log: Number(body.costLog) || 0,
          p_marge_cible: Number(body.margeCible) || 0,
          p_client: String(body.client ?? ""),
        })
        return NextResponse.json({ ok: true, action, prixConseille: result }, { headers: cors(origin) })

      default:
        return NextResponse.json({ ok: false, error: `action inconnue : ${action}` }, { status: 400, headers: cors(origin) })
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500, headers: cors(origin) })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
