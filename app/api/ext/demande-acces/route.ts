import { NextRequest, NextResponse } from "next/server"

// ══════════════════════════════════════════════════════════════
// POST /api/ext/demande-acces
// Reçoit les demandes d'accès pro depuis vita-fresh.netlify.app
// Enregistre dans fl_demandes_acces (Supabase)
// ══════════════════════════════════════════════════════════════

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? ""
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

function cors(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  try {
    const body = await req.json()
    const { nom, telephone, type, societe, email, ville, volume, message, source, lang } = body

    if (!nom?.trim() || !telephone?.trim() || !type?.trim()) {
      return NextResponse.json(
        { error: "Champs requis : nom, telephone, type." },
        { status: 400, headers: cors(origin) }
      )
    }

    // Enregistrement Supabase
    const res = await fetch(`${SB_URL}/rest/v1/fl_demandes_acces`, {
      method: "POST",
      headers: {
        apikey:          SB_ANON,
        Authorization:   `Bearer ${SB_ANON}`,
        "Content-Type":  "application/json",
        Prefer:          "return=minimal",
      },
      body: JSON.stringify({
        nom:       nom.trim(),
        telephone: telephone.trim(),
        type,
        societe:   societe?.trim() || null,
        email:     email?.trim()   || null,
        ville:     ville?.trim()   || null,
        volume:    volume          || null,
        message:   message?.trim() || null,
        source:    source          || "site-web",
        lang:      lang            || "fr",
        statut:    "nouveau",
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("[demande-acces] Supabase error:", err)
      // On retourne quand même OK (le fallback WhatsApp côté site prend le relais)
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: cors(origin) })

  } catch (e: any) {
    console.error("[POST /api/ext/demande-acces]", e)
    return NextResponse.json({ error: e.message ?? "Erreur serveur." }, { status: 500, headers: cors(origin) })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
