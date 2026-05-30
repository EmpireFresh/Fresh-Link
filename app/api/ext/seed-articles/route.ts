import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { ERP_DEFAULT_ARTICLES } from "@/lib/defaultArticles"
import { getArticlePhoto } from "@/lib/articlePhotos"

// ═══════════════════════════════════════════════════════════════════
// POST /api/ext/seed-articles
// Pousse tous les articles ERP_DEFAULT_ARTICLES vers Supabase fl_articles.
// Utilisable pour amorcer un catalogue vide sans ouvrir le back-office.
//
// Body (optionnel) : { force?: boolean, wipe?: boolean }
//   - force: true → upsert systématique (écrase les payloads existants)
//   - force: false (défaut) → upsert seulement si table vide
//   - wipe: true → supprime TOUS les articles existants avant de seed
//     (utile pour nettoyer les doublons d'IDs hérités)
// ═══════════════════════════════════════════════════════════════════

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL    ?? "https://jwdrwapuetqoqnankgma.supabase.co"
// Accept multiple env var names (legacy projects use lowercase "service_role")
const SB_SRV = process.env.SUPABASE_SERVICE_ROLE_KEY
            ?? process.env.service_role
            ?? process.env.SUPABASE_SERVICE_KEY
            ?? ""

function cors(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }
}

function getAdmin() {
  return createClient(SB_URL, SB_SRV, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")

  if (!SB_SRV) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY manquante" },
      { status: 500, headers: cors(origin) }
    )
  }

  let body: { force?: boolean; wipe?: boolean } = {}
  try { body = await req.json() } catch {}

  const sb = getAdmin()

  // Mode wipe : supprime TOUS les articles existants (sauf __config)
  // Permet de nettoyer les anciens IDs (a1, a2...) qui créent des doublons
  let wiped = 0
  if (body.wipe) {
    // ⚠️ NE PAS utiliser .not("id","like","__%") car _ est wildcard SQL et matche tout
    // → on fetch tout puis on filtre côté JS
    const { data: existing, error: fetchErr } = await sb
      .from("fl_articles")
      .select("id")
      .limit(5000)
    if (fetchErr) {
      return NextResponse.json(
        { ok: false, error: "Fetch existing failed: " + fetchErr.message },
        { status: 500, headers: cors(origin) }
      )
    }
    const ids = (existing ?? [])
      .filter(r => !String(r.id).startsWith("__"))
      .map(r => r.id as string)
    // Supprimer par chunks de 200 pour éviter URL trop longue
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200)
      const { error } = await sb.from("fl_articles").delete().in("id", chunk)
      if (!error) wiped += chunk.length
      else console.error("[seed-articles] delete chunk error:", error)
    }
  }

  // Vérifier si la table est déjà peuplée (skip si wipe ou force)
  if (!body.force && !body.wipe) {
    const { data: existing } = await sb
      .from("fl_articles")
      .select("id")
      .limit(50)
    const nonConfig = (existing ?? []).filter(r => !String(r.id).startsWith("__"))
    if (nonConfig.length > 0) {
      return NextResponse.json({
        ok: true,
        seeded: 0,
        message: "Catalogue déjà peuplé. Utilisez { force: true } ou { wipe: true } pour ré-écraser.",
      }, { headers: cors(origin) })
    }
  }

  // Préparer les upserts — dédupliquer par nom (case-insensitive)
  const seen = new Set<string>()
  let counter = 1
  const upserts = (ERP_DEFAULT_ARTICLES as readonly Record<string, unknown>[])
    .filter(a => {
      const nom = String(a.nom ?? "").toLowerCase().trim()
      if (!nom || seen.has(nom)) return false
      seen.add(nom)
      return true
    })
    .map(a => {
      // Toujours générer un VFP-ID séquentiel propre (1...N)
      const cleanId = "VFP" + String(counter).padStart(5, "0")
      counter++

      const payload: Record<string, unknown> = { ...a }
      delete payload.id

      // ✅ Vraie photo Unsplash basée sur le nom de l'article
      const nom = String(payload.nom ?? "Article")
      const famille = String(payload.famille ?? "")
      payload.photo = getArticlePhoto(nom, famille)

      // Activer marketplace par défaut
      payload.marketplaceActif = payload.marketplaceActif !== false
      payload.catalogueVisible = payload.catalogueVisible !== false
      payload.actif = payload.actif !== false

      return {
        id: cleanId,
        payload,
        updated_at: new Date().toISOString(),
      }
    })

  // Push en batches de 50
  let pushed = 0
  const errors: string[] = []
  for (let i = 0; i < upserts.length; i += 50) {
    const batch = upserts.slice(i, i + 50)
    const { error } = await sb
      .from("fl_articles")
      .upsert(batch, { onConflict: "id" })
    if (error) {
      errors.push(`batch ${i}: ${error.message}`)
    } else {
      pushed += batch.length
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    seeded: pushed,
    wiped,
    total: upserts.length,
    errors,
    message: errors.length === 0
      ? `✅ ${pushed} articles publiés sur Supabase${wiped > 0 ? ` (${wiped} anciens supprimés)` : ""}`
      : `⚠️ ${pushed} publiés, ${errors.length} erreurs`,
  }, { headers: cors(origin) })
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
