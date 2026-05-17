import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"

// ══════════════════════════════════════════════════════════════
// POST /api/ext/auth — Authentification par numéro de téléphone
// Utilisé par empire-fresh.netlify.app
// Accepte: { phone, password }  OU  { email, password } (fallback)
// ══════════════════════════════════════════════════════════════

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
const AUTH_SECRET = process.env.AUTH_SECRET ?? "fl_auth_secret_2026"

function cors(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }
}

export function signToken(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig  = createHmac("sha256", AUTH_SECRET).update(data).digest("base64url")
  return `${data}.${sig}`
}

export function verifyToken(token: string): Record<string, unknown> | null {
  try {
    const [data, sig] = token.split(".")
    if (!data || !sig) return null
    const expected = createHmac("sha256", AUTH_SECRET).update(data).digest("base64url")
    if (expected !== sig) return null
    const payload = JSON.parse(Buffer.from(data, "base64url").toString())
    if (payload.exp && payload.exp < Date.now()) return null
    return payload
  } catch { return null }
}

/**
 * Normalise un numéro marocain en format court 06XXXXXXXX ou long 212XXXXXXXX
 * Accepte : 06..., 07..., +212..., 00212..., 212...
 */
function normalizePhone(raw: string): { local: string; intl: string } {
  const d = raw.replace(/[\s\-\.\(\)\+]/g, "")
  let base = d
  if (base.startsWith("00212")) base = base.slice(5)
  else if (base.startsWith("212")) base = base.slice(3)
  else if (base.startsWith("0"))  base = base.slice(1)
  const local = "0" + base       // 0661234567
  const intl  = "212" + base     // 212661234567
  return { local, intl }
}

async function sbQuery(filter: string): Promise<any[]> {
  const res = await fetch(`${SB_URL}/rest/v1/fl_users?${filter}`, {
    headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
  })
  if (!res.ok) return []
  return res.json()
}

async function sbGetClient(clientId: string): Promise<any | null> {
  const res = await fetch(`${SB_URL}/rest/v1/fl_clients?id=eq.${encodeURIComponent(clientId)}&limit=1`, {
    headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
  })
  if (!res.ok) return null
  const rows = await res.json()
  return rows?.[0] ?? null
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  try {
    const body = await req.json()
    const { phone, email, password } = body

    if ((!phone?.trim() && !email?.trim()) || !password?.trim()) {
      return NextResponse.json(
        { error: "Numéro de téléphone et mot de passe requis." },
        { status: 400, headers: cors(origin) }
      )
    }

    let users: any[] = []

    if (phone?.trim()) {
      // ── Auth par téléphone (mode principal) ──
      const { local, intl } = normalizePhone(phone.trim())
      // On cherche dans les colonnes telephone ET phone, en format local ET international
      users = await sbQuery(
        `or=(telephone.eq.${encodeURIComponent(local)},telephone.eq.${encodeURIComponent(intl)},phone.eq.${encodeURIComponent(local)},phone.eq.${encodeURIComponent(intl)})&select=*&limit=1`
      )
    } else if (email?.trim()) {
      // ── Fallback email (admin/test) ──
      users = await sbQuery(
        `email=eq.${encodeURIComponent(email.trim().toLowerCase())}&select=*&limit=1`
      )
    }

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: "Numéro ou mot de passe incorrect." },
        { status: 401, headers: cors(origin) }
      )
    }

    const user = users[0]

    // Vérification mot de passe
    if (user.password !== password && user.passwordMobile !== password) {
      return NextResponse.json(
        { error: "Numéro ou mot de passe incorrect." },
        { status: 401, headers: cors(origin) }
      )
    }

    if (!user.actif) {
      return NextResponse.json(
        { error: "Compte désactivé. Contactez votre commercial." },
        { status: 403, headers: cors(origin) }
      )
    }

    const ALLOWED = ["client", "fournisseur", "resp_commercial", "admin", "super_admin", "super_super_admin"]
    if (!ALLOWED.includes(user.role)) {
      return NextResponse.json(
        { error: "Accès non autorisé pour ce type de compte." },
        { status: 403, headers: cors(origin) }
      )
    }

    // Récupérer le profil client si lié
    let client: any = null
    if (user.clientId) client = await sbGetClient(user.clientId)

    const exp = Date.now() + 86_400_000
    const token = signToken({ userId: user.id, email: user.email, role: user.role, clientId: user.clientId ?? null, exp })

    return NextResponse.json({
      token,
      user: {
        id:           user.id,
        name:         user.name,
        email:        user.email ?? null,
        role:         user.role,
        phone:        user.telephone ?? user.phone ?? null,
        clientId:     user.clientId ?? null,
        categorie:    client?.categorie ?? null,
        loyaltyPoints: client?.loyaltyPoints ?? 0,
        remisePct:    client?.remisePct ?? 0,
        remiseActive: client?.remiseActive ?? false,
        promotions:   client?.promotions ?? [],
        segment:      client?.segment ?? "standard",
        nomSociete:   client?.nom ?? user.name,
      },
    }, { status: 200, headers: cors(origin) })

  } catch (e: any) {
    console.error("[POST /api/ext/auth]", e)
    return NextResponse.json({ error: e.message ?? "Erreur serveur." }, { status: 500, headers: cors(origin) })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
