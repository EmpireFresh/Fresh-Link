import { NextRequest, NextResponse } from "next/server"

// ══════════════════════════════════════════════════════════════════
// /api/ext/pricing-rules — CRUD règles de prix (gratuités + remises)
//   Table : fl_pricing_rules
//
//   GET                  → liste toutes les règles (tri priorité)
//   GET ?actif=true      → seulement actives
//   GET ?segment=chr     → filtre segment
//   POST { type, cible_segment, palier_qte, palier_offert, ... }
//   PATCH { id, ...patch }
//   DELETE ?id=...
//
//   Types supportés :
//     - gratuite_palier : 10 caisses achetées → 1 offerte
//     - remise_pct      : remise % sur le total
//     - remise_montant  : remise montant fixe MAD
//     - remise_cascade  : remise dégressive
// ══════════════════════════════════════════════════════════════════

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SB_SRV = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role || process.env.SUPABASE_SERVICE_KEY) ?? ""

function cors(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }
}

async function sbFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      apikey: SB_SRV,
      Authorization: `Bearer ${SB_SRV}`,
    },
    cache: "no-store",
  })
}

const VALID_TYPES    = ["gratuite_palier", "remise_pct", "remise_montant", "remise_cascade"] as const
const VALID_SEGMENTS = ["chr", "marchand", "particulier", "tous"] as const

// ═══ GET ═══════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!SB_SRV) return NextResponse.json({ ok: false, error: "service_role manquante" }, { status: 500, headers: cors(origin) })

  const actif    = req.nextUrl.searchParams.get("actif")
  const segment  = req.nextUrl.searchParams.get("segment")
  let path = "fl_pricing_rules?select=*&order=priorite.asc,nom.asc&limit=300"
  if (actif != null) path += `&actif=eq.${actif === "true"}`
  if (segment)       path += `&cible_segment=eq.${encodeURIComponent(segment)}`

  try {
    const res = await sbFetch(path)
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ ok: true, data: await res.json() }, { headers: cors(origin) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500, headers: cors(origin) })
  }
}

// ═══ POST ══════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!SB_SRV) return NextResponse.json({ ok: false, error: "service_role manquante" }, { status: 500, headers: cors(origin) })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400, headers: cors(origin) })
  }

  const type    = String(body.type ?? "")
  const segment = String(body.cibleSegment ?? body.segment ?? "tous")
  if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    return NextResponse.json({ ok: false, error: `type invalide (${VALID_TYPES.join(", ")})` }, { status: 400, headers: cors(origin) })
  }
  if (!VALID_SEGMENTS.includes(segment as (typeof VALID_SEGMENTS)[number])) {
    return NextResponse.json({ ok: false, error: `segment invalide (${VALID_SEGMENTS.join(", ")})` }, { status: 400, headers: cors(origin) })
  }
  if (!body.nom || !String(body.nom).trim()) {
    return NextResponse.json({ ok: false, error: "nom requis" }, { status: 400, headers: cors(origin) })
  }

  // Validation cohérence par type
  if (type === "gratuite_palier") {
    const palierQte    = Number(body.palierQte ?? 0) || 0
    const palierOffert = Number(body.palierOffert ?? 0) || 0
    if (palierQte <= 0 || palierOffert <= 0) {
      return NextResponse.json({ ok: false, error: "Pour une gratuité, palier_qte et palier_offert doivent être > 0" }, { status: 400, headers: cors(origin) })
    }
  }
  if (type === "remise_pct" || type === "remise_montant" || type === "remise_cascade") {
    const remiseValeur = Number(body.remiseValeur ?? 0) || 0
    if (remiseValeur <= 0) {
      return NextResponse.json({ ok: false, error: "Pour une remise, remise_valeur doit être > 0" }, { status: 400, headers: cors(origin) })
    }
  }

  const id = body.id ? String(body.id) : "PR" + Date.now().toString(36).toUpperCase()
  const row = {
    id,
    nom:           String(body.nom).trim(),
    type,
    cible_segment: segment,
    cible_famille: body.cibleFamille ? String(body.cibleFamille) : null,
    cible_article: body.cibleArticle ? String(body.cibleArticle) : null,
    palier_qte:    Number(body.palierQte ?? 0)    || 0,
    palier_offert: Number(body.palierOffert ?? 0) || 0,
    remise_valeur: Number(body.remiseValeur ?? 0) || 0,
    date_debut:    body.dateDebut ? String(body.dateDebut) : null,
    date_fin:      body.dateFin   ? String(body.dateFin)   : null,
    priorite:      Number(body.priorite ?? 100) || 100,
    actif:         body.actif === false ? false : true,
  }

  try {
    const res = await sbFetch("fl_pricing_rules", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(row),
    })
    if (!res.ok) throw new Error(await res.text())
    const created = await res.json()
    return NextResponse.json({ ok: true, rule: Array.isArray(created) ? created[0] : created }, { headers: cors(origin) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500, headers: cors(origin) })
  }
}

// ═══ PATCH ═════════════════════════════════════════════════════════
export async function PATCH(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!SB_SRV) return NextResponse.json({ ok: false, error: "service_role manquante" }, { status: 500, headers: cors(origin) })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400, headers: cors(origin) })
  }
  if (!body.id) return NextResponse.json({ ok: false, error: "id requis" }, { status: 400, headers: cors(origin) })

  const id = String(body.id)
  const patch: Record<string, unknown> = {}
  if (body.nom          !== undefined) patch.nom          = String(body.nom)
  if (body.actif        !== undefined) patch.actif        = body.actif === true
  if (body.cibleFamille !== undefined) patch.cible_famille = body.cibleFamille === null ? null : String(body.cibleFamille)
  if (body.cibleArticle !== undefined) patch.cible_article = body.cibleArticle === null ? null : String(body.cibleArticle)
  if (body.palierQte    !== undefined) patch.palier_qte    = Number(body.palierQte) || 0
  if (body.palierOffert !== undefined) patch.palier_offert = Number(body.palierOffert) || 0
  if (body.remiseValeur !== undefined) patch.remise_valeur = Number(body.remiseValeur) || 0
  if (body.priorite     !== undefined) patch.priorite      = Number(body.priorite) || 100
  if (body.dateDebut    !== undefined) patch.date_debut    = body.dateDebut === null ? null : String(body.dateDebut)
  if (body.dateFin      !== undefined) patch.date_fin      = body.dateFin   === null ? null : String(body.dateFin)
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: false, error: "rien à modifier" }, { status: 400, headers: cors(origin) })

  try {
    const res = await sbFetch(`fl_pricing_rules?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error(await res.text())
    const updated = await res.json()
    return NextResponse.json({ ok: true, rule: Array.isArray(updated) ? updated[0] : updated }, { headers: cors(origin) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500, headers: cors(origin) })
  }
}

// ═══ DELETE ════════════════════════════════════════════════════════
export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!SB_SRV) return NextResponse.json({ ok: false, error: "service_role manquante" }, { status: 500, headers: cors(origin) })

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ ok: false, error: "id requis" }, { status: 400, headers: cors(origin) })

  try {
    const res = await sbFetch(`fl_pricing_rules?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" })
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ ok: true }, { headers: cors(origin) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500, headers: cors(origin) })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
