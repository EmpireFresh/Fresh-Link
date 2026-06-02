import { NextRequest, NextResponse } from "next/server"

// ══════════════════════════════════════════════════════════════════
// /api/ext/cutoffs — Régulation des flux (blocages manuels + auto)
//
//   GET                       → liste tous les cutoffs (actifs + inactifs)
//   GET ?actif=true           → seulement les cutoffs actifs (= blocages en cours)
//   GET ?cible=commande       → cutoffs pour les commandes (vs achat)
//   GET ?check=commande       → renvoie { bloque: bool, motif } → utilisable
//                                avant chaque PASSAGE de commande (mobile/site)
//
//   POST { type, cible, actif, ... }   → crée/active un cutoff
//   PATCH { id, actif, motif? }        → toggle on/off rapide
//   DELETE ?id=...                     → supprime
//
// Types supportés :
//   - manuel        : toggle simple par l'admin
//   - auto_tonnage  : seuil_tonnage atteint sur un article/fournisseur
//   - auto_geo      : camion de tournée d'achat a dépassé le point de
//                     non-retour (intégration GPS Section 4)
//   - auto_capacite : charge utile camion saturée
//
// Toute activation déclenche une notification au service ciblé.
// ══════════════════════════════════════════════════════════════════

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SB_SRV = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role || process.env.SUPABASE_SERVICE_KEY) ?? ""

function cors(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }
}

interface CutoffRow {
  id: string
  type: "manuel" | "auto_tonnage" | "auto_geo" | "auto_capacite"
  cible: "commande" | "achat" | "tous"
  article_id: string | null
  fournisseur_id: string | null
  seuil_tonnage: number
  tonnage_actuel: number
  capacite_max_kg: number
  charge_actuelle_kg: number
  actif: boolean
  motif: string | null
  active_par: string | null
  created_at: string
  updated_at: string
}

/** Notifie le service quand un cutoff est activé/désactivé. */
async function notify(cutoff: CutoffRow, action: "active" | "desactive") {
  const map: Record<CutoffRow["cible"], string> = {
    commande: "sales",
    achat:    "achats",
    tous:     "all",
  }
  const service = map[cutoff.cible] ?? "all"
  const titre = action === "active"
    ? `🚫 Cutoff activé — ${cutoff.cible}`
    : `✅ Cutoff levé — ${cutoff.cible}`
  const corps = cutoff.motif
    ? cutoff.motif
    : `Type ${cutoff.type}. ${cutoff.actif ? "Blocage en cours." : "Flux rétabli."}`
  try {
    await fetch(`${SB_URL}/rest/v1/fl_notifications`, {
      method: "POST",
      headers: {
        apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}`,
        "Content-Type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify({
        id: "NT" + Date.now().toString(36).toUpperCase(),
        service, type: "cutoff",
        titre, corps,
        priorite: action === "active" ? "critique" : "normale",
        lu: false,
        payload: { cutoffId: cutoff.id, cible: cutoff.cible, type: cutoff.type },
        created_at: new Date().toISOString(),
      }),
    })
  } catch { /* notif non-bloquante */ }
}

// ═══ GET ═══════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!SB_SRV) return NextResponse.json({ ok: false, error: "service_role manquante" }, { status: 500, headers: cors(origin) })

  const check = req.nextUrl.searchParams.get("check")
  // 🔒 Mode "check" : renvoie un verdict simple pour le mobile/site avant action
  //    Ex: /api/ext/cutoffs?check=commande → { bloque: true, motif: "..." }
  if (check) {
    try {
      const res = await fetch(
        `${SB_URL}/rest/v1/fl_cutoffs?select=id,motif,cible,type&actif=eq.true&or=(cible.eq.${encodeURIComponent(check)},cible.eq.tous)`,
        { headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}` }, cache: "no-store" },
      )
      if (!res.ok) throw new Error(await res.text())
      const rows = (await res.json()) as { id: string; motif: string | null; cible: string; type: string }[]
      if (rows.length === 0) {
        return NextResponse.json({ ok: true, bloque: false }, { headers: cors(origin) })
      }
      const motifs = rows.map(r => r.motif || `cutoff ${r.type}`).join(" · ")
      return NextResponse.json({
        ok: true, bloque: true,
        motif: motifs,
        cutoffs: rows,
      }, { headers: cors(origin) })
    } catch (e) {
      return NextResponse.json({ ok: false, error: String(e) }, { status: 500, headers: cors(origin) })
    }
  }

  // Liste classique
  const actif = req.nextUrl.searchParams.get("actif")
  const cible = req.nextUrl.searchParams.get("cible")
  let url = `${SB_URL}/rest/v1/fl_cutoffs?select=*&order=updated_at.desc&limit=200`
  if (actif != null) url += `&actif=eq.${actif === "true"}`
  if (cible)        url += `&cible=eq.${encodeURIComponent(cible)}`
  try {
    const res = await fetch(url, { headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}` }, cache: "no-store" })
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ ok: true, data: await res.json() }, { headers: cors(origin) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500, headers: cors(origin) })
  }
}

// ═══ POST (création) ═══════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!SB_SRV) return NextResponse.json({ ok: false, error: "service_role manquante" }, { status: 500, headers: cors(origin) })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400, headers: cors(origin) })
  }

  const validTypes  = ["manuel", "auto_tonnage", "auto_geo", "auto_capacite"]
  const validCibles = ["commande", "achat", "tous"]
  const type  = String(body.type ?? "")
  const cible = String(body.cible ?? "")
  if (!validTypes.includes(type))   return NextResponse.json({ ok: false, error: `type invalide (${validTypes.join(", ")})` }, { status: 400, headers: cors(origin) })
  if (!validCibles.includes(cible)) return NextResponse.json({ ok: false, error: `cible invalide (${validCibles.join(", ")})` }, { status: 400, headers: cors(origin) })

  const id = "CO" + Date.now().toString(36).toUpperCase()
  const row: Partial<CutoffRow> = {
    id,
    type:  type as CutoffRow["type"],
    cible: cible as CutoffRow["cible"],
    article_id:        body.articleId       ? String(body.articleId)       : null,
    fournisseur_id:    body.fournisseurId   ? String(body.fournisseurId)   : null,
    seuil_tonnage:     Number(body.seuilTonnage) || 0,
    tonnage_actuel:    Number(body.tonnageActuel) || 0,
    capacite_max_kg:   Number(body.capaciteMaxKg) || 0,
    charge_actuelle_kg: Number(body.chargeActuelleKg) || 0,
    actif: body.actif === true,
    motif: body.motif ? String(body.motif) : null,
    active_par: body.activePar ? String(body.activePar) : null,
  }

  try {
    const res = await fetch(`${SB_URL}/rest/v1/fl_cutoffs`, {
      method: "POST",
      headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(row),
    })
    if (!res.ok) throw new Error(await res.text())
    const [created] = (await res.json()) as CutoffRow[]
    if (created?.actif) await notify(created, "active")
    return NextResponse.json({ ok: true, id, cutoff: created }, { headers: cors(origin) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500, headers: cors(origin) })
  }
}

// ═══ PATCH (toggle actif/motif) ════════════════════════════════════
export async function PATCH(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!SB_SRV) return NextResponse.json({ ok: false, error: "service_role manquante" }, { status: 500, headers: cors(origin) })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400, headers: cors(origin) })
  }
  if (!body.id) return NextResponse.json({ ok: false, error: "id requis" }, { status: 400, headers: cors(origin) })

  const id = String(body.id)
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.actif === "boolean") patch.actif = body.actif
  if (body.motif !== undefined)        patch.motif = body.motif === null ? null : String(body.motif)
  if (body.activePar)                  patch.active_par = String(body.activePar)
  if (body.tonnageActuel !== undefined)    patch.tonnage_actuel    = Number(body.tonnageActuel) || 0
  if (body.chargeActuelleKg !== undefined) patch.charge_actuelle_kg = Number(body.chargeActuelleKg) || 0

  try {
    const res = await fetch(`${SB_URL}/rest/v1/fl_cutoffs?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error(await res.text())
    const updated = (await res.json()) as CutoffRow[]
    const row = updated[0]
    if (row && typeof body.actif === "boolean") {
      await notify(row, body.actif ? "active" : "desactive")
    }
    return NextResponse.json({ ok: true, cutoff: row ?? null }, { headers: cors(origin) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500, headers: cors(origin) })
  }
}

// ═══ DELETE ════════════════════════════════════════════════════════
export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!SB_SRV) return NextResponse.json({ ok: false, error: "service_role manquante" }, { status: 500, headers: cors(origin) })

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ ok: false, error: "id requis" }, { status: 400, headers: cors(origin) })

  try {
    const res = await fetch(`${SB_URL}/rest/v1/fl_cutoffs?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}` },
    })
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ ok: true }, { headers: cors(origin) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500, headers: cors(origin) })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
