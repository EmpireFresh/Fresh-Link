import { NextRequest, NextResponse } from "next/server"

// ══════════════════════════════════════════════════════════════════
// /api/ext/feedbacks — Avis centralisés (mobile → BO temps réel)
//   POST { auteurId, auteurNom, auteurRole, note, categorie, message }
//   GET  ?statut=nouveau → liste pour le Back-Office
// ══════════════════════════════════════════════════════════════════

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SB_SRV = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role || process.env.SUPABASE_SERVICE_KEY) ?? ""

function cors(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!SB_SRV) return NextResponse.json({ ok: false, error: "service_role manquante" }, { status: 500, headers: cors(origin) })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400, headers: cors(origin) })
  }
  if (!body.message || !String(body.message).trim()) {
    return NextResponse.json({ ok: false, error: "message requis" }, { status: 400, headers: cors(origin) })
  }

  const id = "FB" + Date.now().toString(36).toUpperCase()
  const row = {
    id,
    auteur_id:   body.auteurId ?? null,
    auteur_nom:  body.auteurNom ?? null,
    auteur_role: body.auteurRole ?? null,
    note:        Number(body.note) || null,
    categorie:   body.categorie ?? "general",
    message:     String(body.message).trim(),
    statut:      "nouveau",
    source:      body.source ?? "mobile",
    created_at:  new Date().toISOString(),
  }

  try {
    const res = await fetch(`${SB_URL}/rest/v1/fl_feedbacks`, {
      method: "POST",
      headers: {
        apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}`,
        "Content-Type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    })
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ ok: true, id }, { headers: cors(origin) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500, headers: cors(origin) })
  }
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!SB_SRV) return NextResponse.json({ ok: false, error: "service_role manquante" }, { status: 500, headers: cors(origin) })

  const statut = req.nextUrl.searchParams.get("statut")
  let url = `${SB_URL}/rest/v1/fl_feedbacks?select=*&order=created_at.desc&limit=500`
  if (statut) url += `&statut=eq.${encodeURIComponent(statut)}`

  try {
    const res = await fetch(url, { headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}` }, cache: "no-store" })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    return NextResponse.json({ ok: true, data }, { headers: cors(origin) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500, headers: cors(origin) })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
