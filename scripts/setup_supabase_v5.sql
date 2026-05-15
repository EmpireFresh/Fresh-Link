-- ============================================================
-- FreshLink Pro — Setup Supabase v5 (idempotent, JSONB)
-- Run in: https://supabase.com/dashboard/project/jwdrwapuetqoqnankgma/sql/new
-- ============================================================

-- Helper updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- Drop all existing ERP tables (safe — recreate with JSONB schema)
DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'fl_%'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', t);
  END LOOP;
END $$;

-- Create all 20 ERP tables with universal JSONB schema
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

-- Disable RLS (app uses custom localStorage auth, not Supabase Auth)
DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'fl_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Grant full access to anon and authenticated roles
DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'fl_%'
  LOOP
    EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated', t);
  END LOOP;
END $$;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.fl_depots, public.fl_users, public.fl_clients,
  public.fl_fournisseurs, public.fl_articles, public.fl_livreurs,
  public.fl_commandes, public.fl_bons_achat, public.fl_purchase_orders,
  public.fl_bons_livraison, public.fl_bons_preparation, public.fl_receptions,
  public.fl_trips, public.fl_retours, public.fl_visites, public.fl_messages,
  public.fl_transferts_stock, public.fl_demandes_achat,
  public.fl_notices, public.fl_non_achats;

-- Verification
SELECT tablename, rowsecurity AS rls_disabled
FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'fl_%'
ORDER BY tablename;
