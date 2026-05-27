import { NextRequest, NextResponse } from "next/server"

// ══════════════════════════════════════════════════════════════
// POST /api/ext/commandes-web — Commande depuis le site client
// Enregistre dans fl_commandes_web (pas fl_commandes directement)
// Public si panier_enabled = true, sinon requiert X-Api-Key
// ══════════════════════════════════════════════════════════════

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

function cors(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
  }
}

async function sbGet(path: string) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
    next: { revalidate: 0 },
  })
  return res.json()
}

async function sbPost(table: string, body: Record<string, unknown>) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SB_ANON,
      Authorization: `Bearer ${SB_ANON}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  })
  return { ok: res.ok, data: await res.json() }
}

function today() { return new Date().toISOString().split("T")[0] }
function genNum() {
  const d = new Date()
  const s = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`
  return `WEB-${s}-${Math.random().toString(36).slice(2,6).toUpperCase()}`
}

// ── POST — nouvelle commande web ───────────────────────────────
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  try {
    const body = await req.json()
    const { nom_client, telephone, email, adresse_livraison, lignes, date_souhaitee, creneau, instructions, client_id, prospect_id } = body

    if (!nom_client?.trim() || !telephone?.trim() || !Array.isArray(lignes) || lignes.length === 0) {
      return NextResponse.json({ error: "nom_client, telephone et lignes[] sont requis." }, { status: 400, headers: cors(origin) })
    }

    const total = lignes.reduce((s: number, l: any) => s + (Number(l.montant) || 0), 0)

    const commande = {
      numero:            genNum(),
      client_id:         client_id ?? null,
      prospect_id:       prospect_id ?? null,
      nom_client,
      telephone,
      email:             email ?? null,
      adresse_livraison: adresse_livraison ?? null,
      lignes,
      montant_total:     total,
      date_souhaitee:    date_souhaitee ?? null,
      creneau:           creneau ?? null,
      instructions:      instructions ?? null,
      statut:            "nouveau",
      source:            "site_web",
      ip_address:        req.headers.get("x-forwarded-for") ?? null,
    }

    const { ok, data } = await sbPost("fl_commandes_web", commande)
    if (!ok) {
      return NextResponse.json({ error: "Erreur lors de l'enregistrement." }, { status: 500, headers: cors(origin) })
    }

    return NextResponse.json(
      { id: data?.[0]?.id, numero: commande.numero, statut: "nouveau", total },
      { status: 201, headers: cors(origin) }
    )
  } catch (e: any) {
    console.error("[POST /api/ext/commandes-web]", e)
    return NextResponse.json({ error: e.message ?? "Erreur serveur." }, { status: 500, headers: cors(origin) })
  }
}

// ── GET — suivi commande ou liste par téléphone ──────────────
// ?tel=... → liste toutes les commandes de ce numéro
// ?numero=...&tel=... → suivi d'une commande précise
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")
  const numero = req.nextUrl.searchParams.get("numero")
  const tel    = req.nextUrl.searchParams.get("tel")

  if (!tel) {
    return NextResponse.json({ error: "tel requis." }, { status: 400, headers: cors(origin) })
  }

  try {
    if (numero) {
      // Single order tracking
      const data = await sbGet(
        `fl_commandes_web?numero=eq.${encodeURIComponent(numero)}&telephone=eq.${encodeURIComponent(tel)}&select=id,numero,statut,montant_total,date_souhaitee,lignes,created_at`
      )
      return NextResponse.json(data?.[0] ?? null, { headers: cors(origin) })
    } else {
      // List all orders for this phone number
      const data = await sbGet(
        `fl_commandes_web?telephone=eq.${encodeURIComponent(tel)}&order=created_at.desc&select=id,numero,statut,montant_total,date_souhaitee,lignes,created_at`
      )
      return NextResponse.json(Array.isArray(data) ? data : [], { headers: cors(origin) })
    }
  } catch {
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500, headers: cors(origin) })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
