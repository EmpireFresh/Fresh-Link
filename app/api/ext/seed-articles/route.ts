import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { ERP_DEFAULT_ARTICLES } from "@/lib/defaultArticles"

// ═══════════════════════════════════════════════════════════════════
// POST /api/admin/seed-articles
// Pousse tous les articles ERP_DEFAULT_ARTICLES vers Supabase fl_articles.
// Utilisable pour amorcer un catalogue vide sans ouvrir le back-office.
//
// Body (optionnel) : { force?: boolean }
//   - force: true → upsert systématique (écrase les payloads existants)
//   - force: false (défaut) → upsert seulement si table vide
// ═══════════════════════════════════════════════════════════════════

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL    ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SB_SRV = process.env.SUPABASE_SERVICE_ROLE_KEY   ?? ""

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

  let body: { force?: boolean } = {}
  try { body = await req.json() } catch {}

  const sb = getAdmin()

  // Vérifier si la table est déjà peuplée
  if (!body.force) {
    const { data: existing } = await sb
      .from("fl_articles")
      .select("id")
      .not("id", "like", "__%")
      .limit(1)
    if (existing && existing.length > 0) {
      return NextResponse.json({
        ok: true,
        seeded: 0,
        message: "Catalogue déjà peuplé. Utilisez { force: true } pour ré-écraser.",
      }, { headers: cors(origin) })
    }
  }

  // Préparer les upserts
  let counter = 1
  const upserts = (ERP_DEFAULT_ARTICLES as readonly Record<string, unknown>[]).map(a => {
    const rawId = String(a.id ?? "")
    // Normaliser ID format VFP00001
    const cleanId = /^VFP\d{5,}$/.test(rawId)
      ? rawId
      : "VFP" + String(counter).padStart(5, "0")
    counter++

    const payload: Record<string, unknown> = { ...a }
    delete payload.id

    // Photo placeholder si manquante
    const nom = String(payload.nom ?? "Article")
    const famille = String(payload.famille ?? "").toLowerCase()
    if (!payload.photo) {
      const color = famille.includes("fruit") ? "e74c3c"
                  : famille.includes("légume") ? "27ae60"
                  : famille.includes("herbe") ? "16a34a"
                  : "94a3b8"
      payload.photo = `https://placehold.co/400x300/${color}/fff?text=${encodeURIComponent(nom)}`
    }

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
    total: upserts.length,
    errors,
    message: errors.length === 0
      ? `✅ ${pushed} articles publiés sur Supabase`
      : `⚠️ ${pushed} publiés, ${errors.length} erreurs`,
  }, { headers: cors(origin) })
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
