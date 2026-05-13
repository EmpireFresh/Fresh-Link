import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY

// Tables ERP à tester
const ERP_TABLES = [
  "fl_depots", "fl_users", "fl_clients", "fl_fournisseurs", "fl_articles",
  "fl_livreurs", "fl_commandes", "fl_bons_achat", "fl_purchase_orders",
  "fl_bons_livraison", "fl_bons_preparation", "fl_receptions", "fl_trips",
  "fl_retours", "fl_visites", "fl_messages", "fl_transferts_stock",
]

export async function GET() {
  const results: Record<string, { exists: boolean; count: number; hasPayload: boolean; error?: string }> = {}
  const sb = createClient(SUPABASE_URL, SERVICE_KEY)

  // Test connexion de base
  let connected = false
  try {
    const { error } = await sb.from("fl_depots").select("id").limit(1)
    connected = !error
  } catch {
    connected = false
  }

  // Tester chaque table
  for (const table of ERP_TABLES) {
    try {
      const { data, error, count } = await sb
        .from(table)
        .select("id, payload", { count: "exact" })
        .limit(3)

      if (error) {
        results[table] = { exists: false, count: 0, hasPayload: false, error: error.message }
      } else {
        const hasPayload = data?.some(r => r.payload !== undefined) ?? false
        results[table] = { exists: true, count: count ?? data?.length ?? 0, hasPayload }
      }
    } catch (e) {
      results[table] = { exists: false, count: 0, hasPayload: false, error: String(e) }
    }
  }

  // Test Realtime publication
  let realtimeEnabled = false
  try {
    const { data } = await sb.rpc("pg_publication_tables", {})
      .select("*").limit(1)
    realtimeEnabled = !!data
  } catch {
    // pg_publication_tables might not be exposed — check via another method
    realtimeEnabled = connected // assume enabled if connected
  }

  // Test Storage bucket
  let storageBucket = false
  try {
    const { data } = await sb.storage.getBucket("freshlink-media")
    storageBucket = !!data
  } catch {
    storageBucket = false
  }

  const tableCount = Object.values(results).filter(r => r.exists).length
  const tablesWithData = Object.values(results).filter(r => r.count > 0).length
  const tablesJsonb = Object.values(results).filter(r => r.hasPayload).length

  return NextResponse.json({
    status: connected ? "ok" : "error",
    timestamp: new Date().toISOString(),
    supabase: {
      url: SUPABASE_URL,
      connected,
      storage_bucket: storageBucket,
      realtime_assumed: realtimeEnabled,
    },
    tables: {
      total_expected: ERP_TABLES.length,
      exist: tableCount,
      have_data: tablesWithData,
      jsonb_schema: tablesJsonb,
      missing: Object.entries(results).filter(([, v]) => !v.exists).map(([k]) => k),
      detail: results,
    },
    checklist: {
      "1_connexion_supabase": connected ? "✅" : "❌",
      "2_tables_créées": tableCount === ERP_TABLES.length ? "✅" : `⚠️ ${ERP_TABLES.length - tableCount} manquantes`,
      "3_schema_jsonb": tablesJsonb > 0 ? "✅" : "❌ (exécuter fix_supabase_sync.sql)",
      "4_données_présentes": tablesWithData > 0 ? `✅ ${tablesWithData} tables ont des données` : "⚠️ Aucune donnée (normal si première connexion)",
      "5_storage_bucket": storageBucket ? "✅" : "⚠️ Créer le bucket freshlink-media dans Supabase Storage",
    }
  }, { status: connected ? 200 : 503 })
}
