import { NextRequest, NextResponse } from "next/server"

// ══════════════════════════════════════════════════════════════
// POST /api/ext/prospects — Demande de création de compte
// Depuis le site client vita-fresh.netlify.app
// Enregistre dans fl_prospects — public, pas de clé requise
// ══════════════════════════════════════════════════════════════

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "https://jwdrwapuetqoqnankgma.supabase.co"
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
    const {
      // Format API standard
      nom_societe, nom_contact,
      // Format site Netlify (formulaire HTML)
      nom, etablissement, type, sujet,
      // Champs communs
      telephone, whatsapp,
      email, adresse, ville, type_activite,
      nb_couverts, nb_chambres,
      familles_souhaitees, volume_estime, message, source,
    } = body

    // Accepter les deux formats de champs
    const resolvedNomSociete = (nom_societe ?? etablissement ?? "").trim()
    const resolvedNomContact  = (nom_contact ?? nom ?? "").trim()

    if (!resolvedNomContact || !telephone?.trim()) {
      return NextResponse.json(
        { error: "nom (contact) et telephone sont requis." },
        { status: 400, headers: cors(origin) }
      )
    }

    const prospect = {
      nom_societe: resolvedNomSociete || resolvedNomContact,
      nom_contact:  resolvedNomContact,
      telephone:    telephone.trim(),
      whatsapp:     whatsapp?.trim() ?? null,
      email:        email?.trim()    ?? null,
      adresse:      adresse?.trim()  ?? null,
      ville:        ville?.trim()    ?? "Casablanca",
      type_activite: type_activite ?? type ?? "autre",
      nb_couverts:  nb_couverts  ?? null,
      nb_chambres:  nb_chambres  ?? null,
      familles_souhaitees: familles_souhaitees ?? [],
      volume_estime: volume_estime ?? null,
      message:      (message ?? sujet ?? "")?.trim() || null,
      statut:       "nouveau",
      source:       source ?? "site_web",
      ip_address:   req.headers.get("x-forwarded-for") ?? null,
    }

    const res = await fetch(`${SB_URL}/rest/v1/fl_prospects`, {
      method: "POST",
      headers: {
        apikey: SB_ANON,
        Authorization: `Bearer ${SB_ANON}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(prospect),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("[POST /api/ext/prospects]", err)
      return NextResponse.json({ error: "Erreur lors de l'enregistrement." }, { status: 500, headers: cors(origin) })
    }

    const data = await res.json()
    return NextResponse.json(
      { id: data?.[0]?.id, message: "Demande enregistrée. Notre équipe vous contactera sous 24h." },
      { status: 201, headers: cors(origin) }
    )
  } catch (e: any) {
    console.error("[POST /api/ext/prospects]", e)
    return NextResponse.json({ error: e.message ?? "Erreur serveur." }, { status: 500, headers: cors(origin) })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
