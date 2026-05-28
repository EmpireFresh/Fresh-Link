import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"

// ══════════════════════════════════════════════════════════════
// POST /api/ext/auth — Authentification par numéro de téléphone
// Utilisé par vita-fresh.netlify.app
// Accepte: { phone, password }  OU  { email, password } (fallback)
//
// IMPORTANT: fl_users et fl_clients sont stockés en {id, payload} dans Supabase.
// On fetch tous les utilisateurs puis on filtre en JS pour éviter les
// problèmes de colonnes JSONB imbriquées dans PostgREST.
// ══════════════════════════════════════════════════════════════

const SB_URL        = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SB_ANON       = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
// Service role bypass RLS — obligatoire pour lire fl_users
const SB_SERVER_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY    ?? SB_ANON
const AUTH_SECRET   = process.env.AUTH_SECRET                  ?? "fl_auth_secret_2026"

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
 */
function normalizePhone(raw: string): { local: string; intl: string; intlPlus: string } {
  const d = raw.replace(/[\s\-\.\(\)\+]/g, "")
  let base = d
  if (base.startsWith("00212")) base = base.slice(5)
  else if (base.startsWith("212")) base = base.slice(3)
  else if (base.startsWith("0"))  base = base.slice(1)
  return {
    local:    "0"    + base,   // 0661234567
    intl:     "212"  + base,   // 212661234567
    intlPlus: "+212" + base,   // +212661234567
  }
}

/**
 * Récupère tous les utilisateurs depuis Supabase.
 * Les rows sont stockées en {id, payload} — on aplatit le payload.
 * Utilise le service role key pour bypass RLS.
 */
async function getAllUsers(): Promise<any[]> {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/fl_users?select=id,payload&limit=1000`,
      { headers: { apikey: SB_SERVER_KEY, Authorization: `Bearer ${SB_SERVER_KEY}` } }
    )
    if (!res.ok) {
      console.error("[auth] getAllUsers HTTP error:", res.status, await res.text())
      return []
    }
    const rows: { id: string; payload: Record<string, unknown> }[] = await res.json()
    // Aplatir : { id, ...payload }
    return rows.map(r => ({
      id: r.id,
      ...(r.payload && typeof r.payload === "object" ? r.payload : {}),
    }))
  } catch (e) {
    console.error("[auth] getAllUsers error:", e)
    return []
  }
}

/**
 * Récupère un client depuis fl_clients (aussi stocké en {id, payload}).
 */
async function getClientById(clientId: string): Promise<any | null> {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/fl_clients?id=eq.${encodeURIComponent(clientId)}&select=id,payload&limit=1`,
      { headers: { apikey: SB_SERVER_KEY, Authorization: `Bearer ${SB_SERVER_KEY}` } }
    )
    if (!res.ok) return null
    const rows: { id: string; payload: Record<string, unknown> }[] = await res.json()
    if (!rows?.[0]) return null
    const r = rows[0]
    return { id: r.id, ...(r.payload && typeof r.payload === "object" ? r.payload : {}) }
  } catch {
    return null
  }
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

    // ── Récupérer tous les utilisateurs (aplatit {id, payload}) ──────────────
    const allUsers = await getAllUsers()

    let user: any = null

    if (phone?.trim()) {
      // Auth par téléphone — cherche les formats local, international, +212
      const { local, intl, intlPlus } = normalizePhone(phone.trim())
      const phones = new Set([local, intl, intlPlus])
      user = allUsers.find(u => {
        const tel = String(u.telephone ?? u.phone ?? "").replace(/[\s\-\.\(\)\+]/g, "")
        // Normaliser aussi la valeur stockée pour comparaison
        let base = tel
        if (base.startsWith("00212")) base = base.slice(5)
        else if (base.startsWith("212")) base = base.slice(3)
        else if (base.startsWith("0")) base = base.slice(1)
        const storedLocal = "0" + base
        const storedIntl  = "212" + base
        return phones.has(storedLocal) || phones.has(storedIntl) || phones.has(tel)
      }) ?? null
    } else if (email?.trim()) {
      // Fallback email
      const emailLower = email.trim().toLowerCase()
      user = allUsers.find(u =>
        (u.email ?? "").toString().toLowerCase() === emailLower
      ) ?? null
    }

    if (!user) {
      return NextResponse.json(
        { error: "Numéro ou mot de passe incorrect." },
        { status: 401, headers: cors(origin) }
      )
    }

    // ── Vérification mot de passe ─────────────────────────────────────────────
    const storedPwd       = String(user.password ?? "")
    const storedPwdMobile = String(user.passwordMobile ?? "")
    const inputPwd        = String(password)

    if (inputPwd !== storedPwd && inputPwd !== storedPwdMobile) {
      return NextResponse.json(
        { error: "Numéro ou mot de passe incorrect." },
        { status: 401, headers: cors(origin) }
      )
    }

    if (user.actif === false) {
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

    // ── Récupérer le profil client si lié ─────────────────────────────────────
    let client: any = null
    if (user.clientId) client = await getClientById(user.clientId)

    const exp   = Date.now() + 86_400_000
    const token = signToken({
      userId:   user.id,
      email:    user.email,
      role:     user.role,
      clientId: user.clientId ?? null,
      exp,
    })

    return NextResponse.json({
      token,
      user: {
        id:            user.id,
        name:          user.name,
        email:         user.email ?? null,
        role:          user.role,
        phone:         user.telephone ?? user.phone ?? null,
        clientId:      user.clientId ?? null,
        categorie:     client?.categorie ?? null,
        loyaltyPoints: client?.loyaltyPoints ?? 0,
        remisePct:     client?.remisePct ?? 0,
        remiseActive:  client?.remiseActive ?? false,
        promotions:    client?.promotions ?? [],
        segment:       client?.segment ?? "standard",
        nomSociete:    client?.nom ?? user.name,
      },
    }, { status: 200, headers: cors(origin) })

  } catch (e: any) {
    console.error("[POST /api/ext/auth]", e)
    return NextResponse.json(
      { error: e.message ?? "Erreur serveur." },
      { status: 500, headers: cors(origin) }
    )
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
