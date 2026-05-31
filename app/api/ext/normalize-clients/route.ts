import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/ext/normalize-clients
 *
 * Renomme tous les IDs de fl_clients et fl_fournisseurs au format propre :
 *   - VFC00001, VFC00002... pour les clients (tri par created_at ASC)
 *   - VFS00001, VFS00002... pour les fournisseurs
 *   - Met à jour fl_users.clientId pour les utilisateurs liés
 *
 * Body (optionnel) : { dryRun?: boolean }
 *   - dryRun: true → ne modifie rien, retourne juste le plan
 *   - dryRun: false (défaut) → applique les changements
 */

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SB_SRV = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role || process.env.SUPABASE_SERVICE_KEY) ?? ""

function cors(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }
}

function pad(n: number): string {
  return String(n).padStart(5, "0")
}

interface Row {
  id: string
  payload: Record<string, unknown> | null
  updated_at?: string | null
}

async function sbList(table: string): Promise<Row[]> {
  const res = await fetch(
    `${SB_URL}/rest/v1/${table}?select=id,payload,updated_at&limit=5000`,
    { headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}` }, cache: "no-store" },
  )
  if (!res.ok) return []
  return await res.json()
}

async function sbInsert(table: string, id: string, payload: Record<string, unknown> | null): Promise<boolean> {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method:  "POST",
    headers: {
      apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ id, payload: payload ?? {}, updated_at: new Date().toISOString() }),
  })
  return res.ok
}

async function sbDelete(table: string, id: string): Promise<boolean> {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}` },
  })
  return res.ok
}

interface NormalizeResult {
  table: string
  prefix: string
  total: number
  renamed: number
  alreadyClean: number
  errors: string[]
  mapping: { oldId: string; newId: string }[]
}

async function normalizeTable(table: string, prefix: string, dryRun: boolean): Promise<NormalizeResult> {
  const rows = await sbList(table)
  // Filtrer les entrées de config (__*)
  const real = rows.filter(r => !String(r.id).startsWith("__"))

  // Trier par created_at dans payload (sinon updated_at) pour préserver l'ordre historique
  real.sort((a, b) => {
    const pa = (a.payload?.createdAt as string) ?? a.updated_at ?? ""
    const pb = (b.payload?.createdAt as string) ?? b.updated_at ?? ""
    return pa.localeCompare(pb)
  })

  const cleanRegex = new RegExp(`^${prefix}\\d{5,}$`)
  const result: NormalizeResult = {
    table, prefix,
    total: real.length, renamed: 0, alreadyClean: 0,
    errors: [], mapping: [],
  }

  let counter = 1
  for (const row of real) {
    const newId = prefix + pad(counter)
    counter++
    if (row.id === newId) {
      result.alreadyClean++
      continue
    }
    // Si l'ID est déjà au format propre mais avec un numéro différent, on garde l'ID actuel
    // (évite de renommer VFC00040 en VFC00037 par exemple).
    // Mais s'il est en désordre (gap), on accepte de re-numéroter.
    if (cleanRegex.test(row.id)) {
      result.alreadyClean++
      counter--  // ne pas incrémenter, on garde l'ID actuel pour ce slot
      // On marque ce numéro comme "utilisé" pour ne pas le réattribuer
      // → en pratique, on saute ce row et on continue avec le prochain compteur valide
      // (simplification : on garde l'ID, on n'attribue pas newId)
      counter++  // restaurer pour le prochain row
      continue
    }
    result.mapping.push({ oldId: row.id, newId })
    if (dryRun) continue

    // ⚠️ Supabase n'autorise pas UPDATE de la PK → on INSERT le nouveau puis DELETE l'ancien
    const inserted = await sbInsert(table, newId, row.payload)
    if (!inserted) {
      result.errors.push(`Insert failed for ${row.id} → ${newId}`)
      continue
    }
    const deleted = await sbDelete(table, row.id)
    if (!deleted) {
      result.errors.push(`Delete failed for old ${row.id}`)
      continue
    }
    result.renamed++
  }

  return result
}

/**
 * Met à jour fl_users.clientId pour pointer vers les nouveaux IDs clients.
 */
async function patchUsersClientId(mapping: Map<string, string>, dryRun: boolean): Promise<{ patched: number; errors: string[] }> {
  if (mapping.size === 0) return { patched: 0, errors: [] }
  const users = await sbList("fl_users")
  let patched = 0
  const errors: string[] = []
  for (const u of users) {
    const p = (u.payload ?? {}) as Record<string, unknown>
    const oldCid = String(p.clientId ?? "")
    const newCid = mapping.get(oldCid)
    if (!newCid) continue
    if (dryRun) { patched++; continue }
    const newPayload = { ...p, clientId: newCid }
    const ok = await fetch(`${SB_URL}/rest/v1/fl_users?id=eq.${encodeURIComponent(u.id)}`, {
      method: "PATCH",
      headers: {
        apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}`,
        "Content-Type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify({ payload: newPayload, updated_at: new Date().toISOString() }),
    }).then(r => r.ok).catch(() => false)
    if (ok) patched++
    else errors.push(`User ${u.id} clientId patch failed`)
  }
  return { patched, errors }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!SB_SRV) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY manquante" },
      { status: 500, headers: cors(origin) },
    )
  }
  let body: { dryRun?: boolean } = {}
  try { body = await req.json() } catch {}
  const dryRun = body.dryRun === true

  // 1) Normaliser fl_clients (préfixe VFC)
  const clients = await normalizeTable("fl_clients", "VFC", dryRun)
  // 2) Normaliser fl_fournisseurs (préfixe VFS)
  const fournisseurs = await normalizeTable("fl_fournisseurs", "VFS", dryRun)

  // 3) Patcher fl_users.clientId selon le mapping clients
  const cMap = new Map<string, string>()
  for (const m of clients.mapping) cMap.set(m.oldId, m.newId)
  const usersPatch = await patchUsersClientId(cMap, dryRun)

  return NextResponse.json({
    ok: clients.errors.length === 0 && fournisseurs.errors.length === 0 && usersPatch.errors.length === 0,
    dryRun,
    clients,
    fournisseurs,
    usersPatched: usersPatch.patched,
    userErrors: usersPatch.errors,
    message: dryRun
      ? `🧪 DRY RUN — ${clients.mapping.length} clients + ${fournisseurs.mapping.length} fournisseurs seraient renommés`
      : `✅ ${clients.renamed} clients renommés, ${fournisseurs.renamed} fournisseurs renommés, ${usersPatch.patched} users patchés`,
  }, { headers: cors(origin) })
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
