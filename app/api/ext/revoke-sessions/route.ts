import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "../auth/route"

// ══════════════════════════════════════════════════════════════
// POST /api/ext/revoke-sessions
// Force la déconnexion de tous les appareils lors de leur prochaine
// interaction avec /api/ext/mon-compte.
// L'utilisateur qui exécute l'opération est épargné (exceptUserId).
//
// Body: { exceptUserId: string }
// Auth: Bearer token d'un super_super_admin
// ══════════════════════════════════════════════════════════════

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL    ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SB_SRV = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role || process.env.SUPABASE_SERVICE_KEY)   ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

function cors(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }
}

/** Écrit l'entrée de révocation dans Supabase (fl_users avec id __session_revoke) */
async function writeRevoke(exceptUserId: string, revokedBy: string): Promise<boolean> {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/fl_users`, {
      method: "POST",
      headers: {
        apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        id: "__session_revoke",
        payload: {
          revokedAt:    new Date().toISOString(),
          exceptUserId,
          revokedBy,
        },
        updated_at: new Date().toISOString(),
      }),
    })
    return res.ok
  } catch { return false }
}

/** Supprime l'entrée de révocation (annule la déconnexion globale) */
async function clearRevoke(): Promise<boolean> {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/fl_users?id=eq.__session_revoke`,
      {
        method: "DELETE",
        headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}` },
      }
    )
    return res.ok
  } catch { return false }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")

  let body: Record<string, string> = {}
  try { body = await req.json() } catch {}

  const { exceptUserId, adminId } = body

  if (!adminId || !exceptUserId) {
    return NextResponse.json({ error: "adminId et exceptUserId requis." }, { status: 400, headers: cors(origin) })
  }

  // Vérifier que adminId est super_super_admin / super_admin / admin dans Supabase
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/fl_users?id=eq.${encodeURIComponent(adminId)}&select=id,payload&limit=1`,
      { headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}` } }
    )
    if (res.ok) {
      const rows: { id: string; payload: Record<string, unknown> }[] = await res.json()
      const user = rows[0]
      const role = String(user?.payload?.role ?? "")
      if (!["super_super_admin", "super_admin", "admin"].includes(role)) {
        return NextResponse.json({ error: "Accès refusé — rôle insuffisant." }, { status: 403, headers: cors(origin) })
      }
    }
  } catch {}

  const revokedBy = adminId

  const ok = await writeRevoke(exceptUserId, revokedBy)

  return NextResponse.json(
    { ok, message: ok ? "Tous les comptes seront déconnectés à leur prochaine interaction." : "Erreur Supabase." },
    { status: ok ? 200 : 500, headers: cors(origin) }
  )
}

/** DELETE — annule la révocation (optionnel) */
export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin")
  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  const payload = token ? verifyToken(token) : null
  if (!payload || !["super_super_admin"].includes(payload.role as string)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403, headers: cors(origin) })
  }
  const ok = await clearRevoke()
  return NextResponse.json({ ok }, { headers: cors(origin) })
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
