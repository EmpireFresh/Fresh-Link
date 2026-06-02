import { NextRequest, NextResponse } from "next/server"

// ══════════════════════════════════════════════════════════════════
// /api/ext/gifts — Centre Cadeaux Incentives (Section 1.1)
//
//  GET  ?scope=materials    → catalogue des matériels (Balance, Pack couteaux)
//  GET  ?scope=attributions → historique des attributions (joint material)
//  GET  ?clientId=VFC00012  → attributions d'un client précis
//
//  POST { scope:"material",    nom, segment, seuil_type, seuil_valeur, stock_qte, ... }
//  POST { scope:"attribution", clientId, materialId, segment?, declencheParAuto? }
//        → trigger SQL fl_notify_gift décrémente le stock + push notif Direction
//
//  PATCH { id, statut: "a_livrer"|"livre"|"annule" }
//  PATCH { id, scope:"material", stock_qte, actif? }
//  DELETE ?id=...&scope=material|attribution
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

async function sbFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      apikey: SB_SRV,
      Authorization: `Bearer ${SB_SRV}`,
    },
    cache: "no-store",
  })
}

// ═══ GET ═══════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!SB_SRV) return NextResponse.json({ ok: false, error: "service_role manquante" }, { status: 500, headers: cors(origin) })

  const scope    = req.nextUrl.searchParams.get("scope") ?? "materials"
  const clientId = req.nextUrl.searchParams.get("clientId")
  const statut   = req.nextUrl.searchParams.get("statut")

  try {
    if (scope === "materials") {
      const segment = req.nextUrl.searchParams.get("segment")
      let path = "fl_gift_materials?select=*&order=segment.asc,nom.asc&limit=200"
      if (segment) path += `&segment=eq.${encodeURIComponent(segment)}`
      const res = await sbFetch(path)
      if (!res.ok) throw new Error(await res.text())
      return NextResponse.json({ ok: true, data: await res.json() }, { headers: cors(origin) })
    }

    if (scope === "attributions") {
      let path = "fl_gift_attributions?select=*&order=attribue_le.desc&limit=500"
      if (clientId) path += `&client_id=eq.${encodeURIComponent(clientId)}`
      if (statut)   path += `&statut=eq.${encodeURIComponent(statut)}`
      const res = await sbFetch(path)
      if (!res.ok) throw new Error(await res.text())
      const attributions = await res.json() as { material_id: string; [k: string]: unknown }[]

      // Joindre le nom du matériel (PostgREST embeddings cross-table peuvent
      // ne pas être activés → on fait un petit join JS).
      const matIds = Array.from(new Set(attributions.map(a => a.material_id))).filter(Boolean)
      let materials: { id: string; nom: string; segment: string }[] = []
      if (matIds.length > 0) {
        const inList = matIds.map(id => `"${id}"`).join(",")
        const mres = await sbFetch(`fl_gift_materials?select=id,nom,segment&id=in.(${encodeURIComponent(inList)})`)
        if (mres.ok) materials = await mres.json()
      }
      const matMap = new Map(materials.map(m => [m.id, m]))
      const joined = attributions.map(a => {
        const m = matMap.get(String(a.material_id))
        return {
          ...a,
          material_nom: m?.nom ?? null,
          material_segment: m?.segment ?? null,
        }
      })
      return NextResponse.json({ ok: true, data: joined }, { headers: cors(origin) })
    }

    return NextResponse.json({ ok: false, error: `scope inconnu : ${scope}` }, { status: 400, headers: cors(origin) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500, headers: cors(origin) })
  }
}

// ═══ POST ══════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!SB_SRV) return NextResponse.json({ ok: false, error: "service_role manquante" }, { status: 500, headers: cors(origin) })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400, headers: cors(origin) })
  }

  const scope = String(body.scope ?? "")
  try {
    if (scope === "material") {
      const segment = String(body.segment ?? "tous")
      if (!["chr", "marchand", "particulier", "tous"].includes(segment)) {
        return NextResponse.json({ ok: false, error: "segment invalide" }, { status: 400, headers: cors(origin) })
      }
      if (!body.nom || !String(body.nom).trim()) {
        return NextResponse.json({ ok: false, error: "nom requis" }, { status: 400, headers: cors(origin) })
      }
      const id = body.id ? String(body.id) : "GM_" + Date.now().toString(36).toUpperCase()
      const row = {
        id,
        nom:           String(body.nom).trim(),
        segment,
        description:   body.description   ? String(body.description)   : null,
        photo:         body.photo         ? String(body.photo)         : null,
        stock_qte:     Number(body.stockQte ?? 0) || 0,
        cout_unitaire: Number(body.coutUnitaire ?? 0) || 0,
        seuil_type:    body.seuilType    ? String(body.seuilType)    : null,
        seuil_valeur:  Number(body.seuilValeur ?? 0) || 0,
        actif:         body.actif === false ? false : true,
      }
      const res = await sbFetch("fl_gift_materials", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
        body: JSON.stringify(row),
      })
      if (!res.ok) throw new Error(await res.text())
      const created = await res.json()
      return NextResponse.json({ ok: true, material: Array.isArray(created) ? created[0] : created }, { headers: cors(origin) })
    }

    if (scope === "attribution") {
      if (!body.clientId || !body.materialId) {
        return NextResponse.json({ ok: false, error: "clientId et materialId requis" }, { status: 400, headers: cors(origin) })
      }
      // Vérifier le stock matériel
      const matRes = await sbFetch(`fl_gift_materials?id=eq.${encodeURIComponent(String(body.materialId))}&select=id,nom,segment,stock_qte,actif`)
      if (!matRes.ok) throw new Error(await matRes.text())
      const mats = await matRes.json() as { id: string; nom: string; segment: string; stock_qte: number; actif: boolean }[]
      const mat = mats[0]
      if (!mat)              return NextResponse.json({ ok: false, error: "Matériel introuvable" },  { status: 404, headers: cors(origin) })
      if (!mat.actif)        return NextResponse.json({ ok: false, error: "Matériel désactivé" },    { status: 400, headers: cors(origin) })
      if (mat.stock_qte <= 0) return NextResponse.json({ ok: false, error: "Stock matériel épuisé" }, { status: 400, headers: cors(origin) })

      const id = "GA" + Date.now().toString(36).toUpperCase()
      const row = {
        id,
        client_id:     String(body.clientId),
        material_id:   String(body.materialId),
        segment:       body.segment      ? String(body.segment)      : mat.segment,
        declenche_par: body.declenchePar ? String(body.declenchePar) : "manuel_bo",
        statut:        "a_livrer",
        attribue_le:   new Date().toISOString(),
      }
      const res = await sbFetch("fl_gift_attributions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(row),
      })
      if (!res.ok) throw new Error(await res.text())
      const created = await res.json()
      // 🛎 Le trigger SQL fl_notify_gift décrémente le stock + push notif Direction
      return NextResponse.json({
        ok: true,
        attribution: Array.isArray(created) ? created[0] : created,
        message: `✅ ${mat.nom} attribué (stock restant : ${Math.max(0, mat.stock_qte - 1)})`,
      }, { headers: cors(origin) })
    }

    return NextResponse.json({ ok: false, error: `scope POST inconnu (${scope}). Attendu : material | attribution` }, { status: 400, headers: cors(origin) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500, headers: cors(origin) })
  }
}

// ═══ PATCH ═════════════════════════════════════════════════════════
export async function PATCH(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!SB_SRV) return NextResponse.json({ ok: false, error: "service_role manquante" }, { status: 500, headers: cors(origin) })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400, headers: cors(origin) })
  }
  if (!body.id) return NextResponse.json({ ok: false, error: "id requis" }, { status: 400, headers: cors(origin) })

  const id = String(body.id)
  const scope = String(body.scope ?? "attribution")

  try {
    if (scope === "material") {
      const patch: Record<string, unknown> = {}
      if (body.stockQte     !== undefined) patch.stock_qte     = Number(body.stockQte) || 0
      if (body.coutUnitaire !== undefined) patch.cout_unitaire = Number(body.coutUnitaire) || 0
      if (body.seuilValeur  !== undefined) patch.seuil_valeur  = Number(body.seuilValeur) || 0
      if (body.nom         !== undefined)  patch.nom         = String(body.nom)
      if (body.description !== undefined)  patch.description = body.description === null ? null : String(body.description)
      if (body.actif       !== undefined)  patch.actif       = body.actif === true
      if (Object.keys(patch).length === 0) return NextResponse.json({ ok: false, error: "rien à modifier" }, { status: 400, headers: cors(origin) })
      const res = await sbFetch(`fl_gift_materials?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(await res.text())
      const updated = await res.json()
      return NextResponse.json({ ok: true, material: Array.isArray(updated) ? updated[0] : updated }, { headers: cors(origin) })
    }

    // Attribution
    const newStatut = String(body.statut ?? "")
    if (!["a_livrer", "livre", "annule"].includes(newStatut)) {
      return NextResponse.json({ ok: false, error: "statut invalide (a_livrer | livre | annule)" }, { status: 400, headers: cors(origin) })
    }
    const patch: Record<string, unknown> = { statut: newStatut }
    if (newStatut === "livre") patch.livre_le = new Date().toISOString()
    const res = await sbFetch(`fl_gift_attributions?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error(await res.text())
    const updated = await res.json()
    return NextResponse.json({ ok: true, attribution: Array.isArray(updated) ? updated[0] : updated }, { headers: cors(origin) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500, headers: cors(origin) })
  }
}

// ═══ DELETE ════════════════════════════════════════════════════════
export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!SB_SRV) return NextResponse.json({ ok: false, error: "service_role manquante" }, { status: 500, headers: cors(origin) })

  const id = req.nextUrl.searchParams.get("id")
  const scope = req.nextUrl.searchParams.get("scope") ?? "attribution"
  if (!id) return NextResponse.json({ ok: false, error: "id requis" }, { status: 400, headers: cors(origin) })

  const table = scope === "material" ? "fl_gift_materials" : "fl_gift_attributions"

  try {
    const res = await sbFetch(`${table}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" })
    if (!res.ok) throw new Error(await res.text())
    return NextResponse.json({ ok: true }, { headers: cors(origin) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500, headers: cors(origin) })
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
