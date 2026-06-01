import { NextRequest, NextResponse } from "next/server"

// ══════════════════════════════════════════════════════════════════
// /api/ext/notifications — Routeur de notifications multi-services
//   POST { service, type, titre, corps, priorite, destinataireId?, payload? }
//        service = achats | sales | transport | direction | prevendeur | client | all
//   GET  ?service=achats&lu=false → file d'un service
//   PATCH { id, lu:true } → marquer lu
// ══════════════════════════════════════════════════════════════════

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SB_SRV = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role || process.env.SUPABASE_SERVICE_KEY) ?? ""

const SERVICES = ["achats", "sales", "transport", "direction", "prevendeur", "client", "all"]

function cors(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "POST, GET, PATCH, OPTIONS",
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
  const service = String(body.service ?? "")
  if (!SERVICES.includes(service)) {
    return NextResponse.json({ ok: false, error: `service invalide (${SERVICES.join(", ")})` }, { status: 400, headers: cors(origin) })
  }
  if (!body.titre) return NextResponse.json({ ok: false, error: "titre requis" }, { status: 400, headers: cors(origin) })

  const id = "NT" + Date.now().toString(36).toUpperCase()
  const row = {
    id,
    service,
    destinataire_id: body.destinataireId ?? null,
    type:            body.type ?? "info",
    titre:           String(body.titre),
    corps:           body.corps ?? null,
    priorite:        body.priorite ?? "normale",
    lu:              false,
    payload:         body.payload ?? {},
    created_at:      new Date().toISOString(),
  }

  try {
    const res = await fetch(`${SB_URL}/rest/v1/fl_notifications`, {
      method: "POST",
      headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}`, "Content-Type": "application/json", Prefer: "return=minimal" },
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

  const service = req.nextUrl.searchParams.get("service")
  const lu = req.nextUrl.searchParams.get("lu")
  let url = `${SB_URL}/rest/v1/fl_notifications?select=*&order=created_at.desc&limit=200`
  if (service) url += `&or=(service.eq.${encodeURIComponent(service)},service.eq.all)`
  if (lu != null) url += `&lu=eq.${lu === "true"}`

  try {
    const res = await fetch(url, { headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}` }, cache: "no-store" })
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ ok: true, data: await res.json() }, { headers: cors(origin) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500, headers: cors(origin) })
  }
}

export async function PATCH(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!SB_SRV) return NextResponse.json({ ok: false, error: "service_role manquante" }, { status: 500, headers: cors(origin) })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400, headers: cors(origin) })
  }
  if (!body.id) return NextResponse.json({ ok: false, error: "id requis" }, { status: 400, headers: cors(origin) })

  try {
    const res = await fetch(`${SB_URL}/rest/v1/fl_notifications?id=eq.${encodeURIComponent(String(body.id))}`, {
      method: "PATCH",
      headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ lu: body.lu !== false }),
    })
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ ok: true }, { headers: cors(origin) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500, headers: cors(origin) })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
