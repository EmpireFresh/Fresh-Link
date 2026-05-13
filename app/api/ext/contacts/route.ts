import { NextRequest, NextResponse } from "next/server"

// ══════════════════════════════════════════════════════════════
// GET /api/ext/contacts — Coordonnées publiques de l'entreprise
// Utilisé par empire-fresh.netlify.app pour afficher :
//   - Téléphones, WhatsApp, Emails, Adresse, Horaires, Réseaux sociaux
// Public — aucune clé requise
// ══════════════════════════════════════════════════════════════

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

function cors(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control":                "s-maxage=300, stale-while-revalidate=600",
  }
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/fl_company_contacts?id=eq.main&select=nom_societe,slogan,adresse_ligne1,adresse_ligne2,code_postal,ville,pays,tel_principal,tel_secondaire,tel_urgence,whatsapp_principal,whatsapp_commercial,whatsapp_livraison,email_principal,email_commercial,instagram,facebook,linkedin,tiktok,horaires_ouverture,horaires_livraison,zone_livraison`,
      {
        headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
        next: { revalidate: 300 },
      }
    )
    const data = await res.json()
    const contacts = data?.[0] ?? null
    return NextResponse.json(contacts, { status: 200, headers: cors(origin) })
  } catch (e) {
    console.error("[GET /api/ext/contacts]", e)
    return NextResponse.json(null, { status: 200, headers: cors(origin) })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
