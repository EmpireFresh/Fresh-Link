import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

const SETUP_SQL = `-- FreshLink Pro — Setup Supabase v5
-- Paste this in: https://supabase.com/dashboard/project/jwdrwapuetqoqnankgma/sql/new

DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'fl_%'
  LOOP EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', t); END LOOP;
END $$;

CREATE TABLE public.fl_depots            (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_users             (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_clients           (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_fournisseurs      (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_articles          (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_livreurs          (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_commandes         (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_bons_achat        (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_purchase_orders   (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_bons_livraison    (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_bons_preparation  (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_receptions        (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_trips             (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_retours           (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_visites           (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_messages          (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_transferts_stock  (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_demandes_achat    (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_notices           (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_non_achats        (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());

DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'fl_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated', t);
  END LOOP;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE
  public.fl_depots, public.fl_users, public.fl_clients, public.fl_fournisseurs,
  public.fl_articles, public.fl_livreurs, public.fl_commandes, public.fl_bons_achat,
  public.fl_purchase_orders, public.fl_bons_livraison, public.fl_bons_preparation,
  public.fl_receptions, public.fl_trips, public.fl_retours, public.fl_visites,
  public.fl_messages, public.fl_transferts_stock, public.fl_demandes_achat,
  public.fl_notices, public.fl_non_achats;`

const ERP_TABLES = [
  "fl_depots","fl_users","fl_clients","fl_fournisseurs","fl_articles",
  "fl_livreurs","fl_commandes","fl_bons_achat","fl_purchase_orders",
  "fl_bons_livraison","fl_bons_preparation","fl_receptions","fl_trips",
  "fl_retours","fl_visites","fl_messages","fl_transferts_stock",
  "fl_demandes_achat","fl_notices","fl_non_achats",
]

export async function GET() {
  const sb = createClient(SUPABASE_URL, ANON_KEY || "offline")
  const results: Record<string, boolean> = {}
  let connected = false

  try {
    const { error } = await sb.from("fl_depots").select("id").limit(1)
    connected = !error
  } catch { connected = false }

  for (const table of ERP_TABLES) {
    try {
      const { error } = await sb.from(table).select("id").limit(1)
      results[table] = !error
    } catch { results[table] = false }
  }

  const existCount = Object.values(results).filter(Boolean).length
  const missing = Object.entries(results).filter(([,v]) => !v).map(([k]) => k)

  return NextResponse.json({
    connected,
    tables_exist: existCount,
    tables_total: ERP_TABLES.length,
    missing,
    ready: existCount === ERP_TABLES.length,
    setup_sql: SETUP_SQL,
    supabase_sql_editor: `https://supabase.com/dashboard/project/jwdrwapuetqoqnankgma/sql/new`,
  })
}
