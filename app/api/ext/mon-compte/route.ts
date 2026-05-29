import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "../auth/route"

// ══════════════════════════════════════════════════════════════
// GET /api/ext/mon-compte — Profil du client connecté
// Header requis: Authorization: Bearer <token>
// Retourne: profil, points fidélité, remises, commandes récentes
// ══════════════════════════════════════════════════════════════

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
const SB_SRV  = process.env.SUPABASE_SERVICE_ROLE_KEY    ?? SB_ANON

function cors(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")

  // 1. Vérification du token
  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null

  if (!token) {
    return NextResponse.json(
      { error: "Token requis." },
      { status: 401, headers: cors(origin) }
    )
  }

  const payload = verifyToken(token)
  if (!payload) {
    return NextResponse.json(
      { error: "Token invalide ou expiré. Veuillez vous reconnecter." },
      { status: 401, headers: cors(origin) }
    )
  }

  const userId   = payload.userId   as string
  const clientId = payload.clientId as string | null

  try {
    // 2. Vérifier révocation globale de session
    const revokeRows = await (async () => {
      try {
        const r = await fetch(
          `${SB_URL}/rest/v1/fl_users?id=eq.__session_revoke&select=id,payload&limit=1`,
          { headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}` } }
        )
        if (!r.ok) return []
        return await r.json() as { id: string; payload: Record<string, unknown> }[]
      } catch { return [] }
    })()
    if (revokeRows.length > 0) {
      const rv = revokeRows[0].payload ?? {}
      const exceptUserId = String(rv.exceptUserId ?? "")
      if (userId !== exceptUserId) {
        return NextResponse.json(
          { error: "Session révoquée par l'administrateur. Veuillez vous reconnecter.", revoked: true },
          { status: 401, headers: cors(origin) }
        )
      }
    }

    // 3. Récupérer l'utilisateur
    const users = await sbGet("fl_users", `id=eq.${encodeURIComponent(userId)}&select=id,name,email,role,phone,telephone,clientId,actif&limit=1`) as any[]
    if (!users || users.length === 0) {
      return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404, headers: cors(origin) })
    }
    const user = users[0]

    if (!user.actif) {
      return NextResponse.json({ error: "Compte désactivé." }, { status: 403, headers: cors(origin) })
    }

    // 3. Récupérer le profil client
    let client: any = null
    if (clientId) {
      const clients = await sbGet("fl_clients", `id=eq.${encodeURIComponent(clientId)}&select=*&limit=1`) as any[]
      if (clients && clients.length > 0) client = clients[0]
    }

    // 4. Récupérer les commandes récentes (max 10)
    let commandes: any[] = []
    if (clientId) {
      const raw = await sbGet("fl_commandes", `client_id=eq.${encodeURIComponent(clientId)}&order=created_at.desc&limit=10&select=id,numero,statut,montant_ttc,created_at`) as any[]
      commandes = (raw || []).map(c => ({
        id:       c.id,
        numero:   c.numero ?? c.id?.slice(0, 8),
        statut:   c.statut ?? "en_cours",
        montant:  c.montant_ttc ?? c.montant ?? 0,
        date:     c.created_at,
      }))
    }

    // 5. Réponse
    return NextResponse.json(
      {
        user: {
          id:    user.id,
          name:  user.name,
          email: user.email,
          role:  user.role,
          phone: user.phone ?? user.telephone ?? null,
        },
        client: {
          id:           clientId,
          nom:          client?.nom ?? user.name,
          categorie:    client?.categorie ?? null,
          segment:      client?.segment ?? "standard",
          ville:        client?.ville ?? client?.zone ?? null,
          loyaltyPoints: client?.loyaltyPoints ?? 0,
          loyaltyOptIn:  client?.loyaltyOptIn ?? true,
          remisePct:    client?.remisePct ?? 0,
          remiseActive: client?.remiseActive ?? false,
          promotions:   client?.promotions ?? [],
          creditSolde:  client?.creditSolde ?? 0,
          plafondCredit: client?.plafondCredit ?? 0,
        },
        commandes,
        tokenExp: payload.exp,
      },
      { status: 200, headers: cors(origin) }
    )
  } catch (e: any) {
    console.error("[GET /api/ext/mon-compte]", e)
    return NextResponse.json({ error: e.message ?? "Erreur serveur." }, { status: 500, headers: cors(origin) })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
