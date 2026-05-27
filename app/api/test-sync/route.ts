import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ANON_KEY

// Tables attendues dans Supabase
const EXPECTED_TABLES = [
  "fl_articles",
  "fl_site_access",
  "fl_clients",
  "fl_commandes",
  "fl_users",
]

export async function GET() {
  // ── 1. Vérifier que l'URL Supabase est configurée ─────────────────────────
  if (!SUPABASE_URL || SUPABASE_URL === "https://jwdrwapuetqoqnankgma.supabase.co" && !SERVICE_KEY && !ANON_KEY) {
    return NextResponse.json({
      status: "error",
      error: "Variables NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes",
    }, { status: 500 })
  }

  const key = SERVICE_KEY || ANON_KEY
  if (!key) {
    return NextResponse.json({
      status: "error",
      error: "Clé Supabase manquante (SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    }, { status: 500 })
  }

  const sb = createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── 2. Tester chaque table ────────────────────────────────────────────────
  let existCount  = 0
  let haveData    = 0
  const missing: string[] = []

  for (const table of EXPECTED_TABLES) {
    try {
      const { data, error } = await sb.from(table).select("id").limit(1)
      if (error) {
        missing.push(table)
      } else {
        existCount++
        if (Array.isArray(data) && data.length > 0) haveData++
      }
    } catch {
      missing.push(table)
    }
  }

  // ── 3. Tester la vue marketplace ──────────────────────────────────────────
  let viewOk = false
  try {
    const { error } = await sb.from("v_marketplace_catalogue").select("id").limit(1)
    viewOk = !error
  } catch { /* ignore */ }

  return NextResponse.json({
    status: "ok",
    supabase_url: SUPABASE_URL,
    tables: {
      total_expected: EXPECTED_TABLES.length,
      exist:          existCount,
      have_data:      haveData,
      missing,
    },
    views: {
      v_marketplace_catalogue: viewOk,
    },
    timestamp: new Date().toISOString(),
  })
}
