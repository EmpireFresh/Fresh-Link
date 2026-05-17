import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"

// ══════════════════════════════════════════════════════════════
// POST /api/ext/auth — Authentification externe (clients du site)
// Utilisé par empire-fresh.netlify.app pour connecter les clients
// Retourne un token de session (24h) + profil client complet
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

/** Génère un token simple signé HMAC-SHA256 */
function signToken(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig  = createHmac("sha256", AUTH_SECRET).update(data).digest("base64url")
  return `${data}.${sig}`
}

/** Vérifie et décode un token — null si invalide */
export function verifyToken(token: string): Record<string, unknown> | null {
  try {
    const [data, sig] = token.split(".")
    if (!data || !sig) return null
    const expected = createHmac("sha256", AUTH_SECRET).update(data).digest("base64url")
    if (expected !== sig) return null
    const payload = JSON.parse(Buffer.from(data, "base64url").toString())
    if (payload.exp && payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

async function sbGet(table: string, filter: string): Promise<unknown[]> {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
    headers: {
      apikey: SB_ANON,
      Authorization: `Bearer ${SB_ANON}`,
      "Content-Type": "application/json",
    },
  })
  if (!res.ok) return []
  return res.json()
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  try {
    const { email, password } = await req.json()

    if (!email?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: "Email et mot de passe requis." },
        { status: 400, headers: cors(origin) }
      )
    }

    // 1. Chercher l'utilisateur dans fl_users
    const emailLower = email.trim().toLowerCase()
    const users = await sbGet("fl_users", `email=eq.${encodeURIComponent(emailLower)}&select=*&limit=1`) as any[]

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: "Identifiants incorrects." },
        { status: 401, headers: cors(origin) }
      )
    }

    const user = users[0]

    // 2. Vérification du mot de passe (stocké en clair dans l'app)
    const isValid = user.password === password || user.passwordMobile === password

    if (!isValid) {
      return NextResponse.json(
        { error: "Identifiants incorrects." },
        { status: 401, headers: cors(origin) }
      )
    }

    // 3. Vérifier que le compte est actif + rôle autorisé pour l'accès externe
    if (!user.actif) {
      return NextResponse.json(
        { error: "Compte désactivé. Contactez votre commercial." },
        { status: 403, headers: cors(origin) }
      )
    }

    const ALLOWED_ROLES = ["client", "fournisseur", "resp_commercial", "admin", "super_admin", "super_super_admin"]
    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json(
        { error: "Accès non autorisé pour ce type de compte." },
        { status: 403, headers: cors(origin) }
      )
    }

    // 4. Récupérer le profil client si lié
    let client: any = null
    if (user.clientId) {
      const clients = await sbGet("fl_clients", `id=eq.${encodeURIComponent(user.clientId)}&select=*&limit=1`) as any[]
      if (clients && clients.length > 0) client = clients[0]
    }

    // 5. Générer le token (24h)
    const token = signToken({
      userId:   user.id,
      email:    emailLower,
      role:     user.role,
      clientId: user.clientId ?? null,
      categorie: client?.categorie ?? null,
      iat: Date.now(),
      exp: Date.now() + 86_400_000, // 24h
    })

    // 6. Réponse
    const profile = {
      id:       user.id,
      name:     user.name,
      email:    emailLower,
      role:     user.role,
      phone:    user.phone ?? user.telephone ?? null,
      clientId: user.clientId ?? null,
      // Infos client
      categorie:      client?.categorie ?? null,
      loyaltyPoints:  client?.loyaltyPoints ?? 0,
      remisePct:      client?.remisePct ?? 0,
      remiseActive:   client?.remiseActive ?? false,
      promotions:     client?.promotions ?? [],
      segment:        client?.segment ?? "standard",
      // Société
      nomSociete:     client?.nom ?? user.name,
      ville:          client?.ville ?? client?.zone ?? null,
    }

    return NextResponse.json(
      { token, user: profile },
      { status: 200, headers: cors(origin) }
    )
  } catch (e: any) {
    console.error("[POST /api/ext/auth]", e)
    return NextResponse.json({ error: e.message ?? "Erreur serveur." }, { status: 500, headers: cors(origin) })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
