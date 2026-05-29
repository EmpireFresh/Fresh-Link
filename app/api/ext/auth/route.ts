import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"

// ══════════════════════════════════════════════════════════════
// POST /api/ext/auth — Authentification par numéro de téléphone
// Utilisé par vitafresh.vercel.app
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

// ── Utilisateurs de secours hardcodés ─────────────────────────────────────────
// Utilisés si fl_users Supabase est vide ou inaccessible.
// Permettent à l'admin de toujours pouvoir se connecter.
const FALLBACK_USERS = [
  {
    id: "VFU00001", name: "Jawad",
    email: "jawad@vita-fresh.ma", telephone: "0647333456",
    password: "Medghaly@22", role: "super_super_admin", actif: true,
  },
  {
    id: "VFU00002", name: "Super Admin",
    email: "admin@freshlink.ma",
    password: "admin2024", role: "super_admin", actif: true,
  },
  {
    id: "VFU00003", name: "Directeur",
    email: "directeur@freshlink.ma",
    password: "admin1234", role: "admin", actif: true,
  },
]

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
    // Aplatir : { id, ...payload } — filtrer les entrées de config (id commence par __)
    return rows
      .filter(r => !String(r.id).startsWith("__"))
      .map(r => ({
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

/**
 * Enregistre ou vérifie un appareil dans fl_site_access.
 * Retourne: "autorise" | "en_attente" | "bloque" | "skip" (pas de device_id)
 */
async function checkDevice(deviceId: string | null, nom: string | null, userAgent: string | null): Promise<"autorise" | "en_attente" | "bloque" | "skip"> {
  if (!deviceId?.trim()) return "skip"
  try {
    // Vérifier si le device existe déjà
    const res = await fetch(
      `${SB_URL}/rest/v1/fl_site_access?device_id=eq.${encodeURIComponent(deviceId)}&select=statut&limit=1`,
      { headers: { apikey: SB_SERVER_KEY, Authorization: `Bearer ${SB_SERVER_KEY}` } }
    )
    if (res.ok) {
      const rows: { statut: string }[] = await res.json()
      if (rows?.[0]) {
        const s = rows[0].statut
        if (s === "autorise") return "autorise"
        if (s === "bloque")   return "bloque"
        return "en_attente"
      }
    }
    // Device inconnu — l'enregistrer comme en_attente
    await fetch(`${SB_URL}/rest/v1/fl_site_access`, {
      method: "POST",
      headers: {
        apikey: SB_SERVER_KEY, Authorization: `Bearer ${SB_SERVER_KEY}`,
        "Content-Type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify({
        device_id:      deviceId,
        nom:            nom ?? null,
        user_agent:     userAgent ?? null,
        statut:         "en_attente",
        first_visit_at: new Date().toISOString(),
        updated_at:     new Date().toISOString(),
      }),
    })
    return "en_attente"
  } catch {
    return "skip" // En cas d'erreur, ne pas bloquer la connexion
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  try {
    const body = await req.json()
    const { phone, email, password, device_id, user_agent } = body

    if ((!phone?.trim() && !email?.trim()) || !password?.trim()) {
      return NextResponse.json(
        { error: "Numéro de téléphone et mot de passe requis." },
        { status: 400, headers: cors(origin) }
      )
    }

    // ── Récupérer tous les utilisateurs (aplatit {id, payload}) ──────────────
    // Supabase en priorité — FALLBACK_USERS toujours ajoutés en supplément
    // Garantit que Jawad peut se connecter même si Supabase a une entrée incomplète
    const sbUsers      = await getAllUsers()
    const sbIds        = new Set(sbUsers.map((u: any) => String(u.id)))
    const fbSupplement = FALLBACK_USERS.filter(u => !sbIds.has(u.id))
    const allUsers     = sbUsers.length > 0 ? [...sbUsers, ...fbSupplement] : FALLBACK_USERS

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
      // Fallback email OU nom (pour connexion par prénom ex: "jawad")
      const emailLower = email.trim().toLowerCase()
      user = allUsers.find(u =>
        (u.email ?? "").toString().toLowerCase() === emailLower ||
        (u.name  ?? "").toString().toLowerCase() === emailLower
      ) ?? null
    }

    if (!user) {
      // Si on utilise le fallback (Supabase vide), signaler que le compte n'existe pas encore
      const usingFallback = sbUsers.length === 0
      const errMsg = usingFallback
        ? "Compte introuvable. Contactez votre commercial pour activer votre accès."
        : "Numéro ou mot de passe incorrect."
      return NextResponse.json(
        { error: errMsg },
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

    // ── Vérification accès appareil (optionnel — ne bloque pas si pas de device_id) ──
    // Le device_id est envoyé par le site web depuis localStorage.
    // Si envoyé: vérifie fl_site_access. Non envoyé: login normal (rétrocompatible).
    if (device_id?.trim()) {
      const deviceStatus = await checkDevice(
        device_id.trim(),
        user.name ?? null,
        user_agent ?? req.headers.get("user-agent") ?? null
      )
      if (deviceStatus === "bloque") {
        return NextResponse.json(
          { error: "Cet appareil a été bloqué. Contactez l'administrateur.", device_status: "bloque" },
          { status: 403, headers: cors(origin) }
        )
      }
      if (deviceStatus === "en_attente") {
        return NextResponse.json(
          { error: "Votre appareil est en attente d'approbation par l'administrateur. Vous serez notifié dès que l'accès sera accordé.", device_status: "en_attente" },
          { status: 403, headers: cors(origin) }
        )
      }
      // deviceStatus === "autorise" ou "skip" → on continue
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
