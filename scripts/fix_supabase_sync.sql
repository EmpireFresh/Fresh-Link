-- ============================================================
-- FreshLink Pro — Script COMPLET sync Supabase (v4 — DROP + JSONB)
-- À exécuter dans : https://supabase.com/dashboard/project/jwdrwapuetqoqnankgma/sql/new
--
-- POURQUOI DROP ? Les 3 tables existantes ont l'ancien schéma
-- (colonnes fixes snake_case) qui rejette les objets camelCase de
-- localStorage. On recrée tout en JSONB universel.
-- Aucune donnée perdue car les tables étaient vides.
-- ============================================================

-- Helper updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- ══════════════════════════════════════════════════════════════
-- 1. SUPPRIMER LES ANCIENNES TABLES (vides — sans risque)
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_stock_movements    CASCADE;
DROP TABLE IF EXISTS public.fl_marketplace_log    CASCADE;
DROP TABLE IF EXISTS public.fl_permissions_matrix CASCADE;
DROP TABLE IF EXISTS public.fl_web_integration    CASCADE;
DROP TABLE IF EXISTS public.fl_account_requests   CASCADE;
DROP TABLE IF EXISTS public.fl_hr_templates       CASCADE;
DROP TABLE IF EXISTS public.fl_driver_bonuses     CASCADE;
DROP TABLE IF EXISTS public.fl_loyalty_transactions CASCADE;
DROP TABLE IF EXISTS public.fl_trip_charges       CASCADE;
DROP TABLE IF EXISTS public.fl_feedbacks          CASCADE;
DROP TABLE IF EXISTS public.fl_caisse_entries     CASCADE;
DROP TABLE IF EXISTS public.fl_paiements_salaires CASCADE;
DROP TABLE IF EXISTS public.fl_salaries           CASCADE;
DROP TABLE IF EXISTS public.fl_bons_livraison     CASCADE;
DROP TABLE IF EXISTS public.fl_trips              CASCADE;
DROP TABLE IF EXISTS public.fl_bons_preparation   CASCADE;
DROP TABLE IF EXISTS public.fl_retours            CASCADE;
DROP TABLE IF EXISTS public.fl_receptions         CASCADE;
DROP TABLE IF EXISTS public.fl_purchase_orders    CASCADE;
DROP TABLE IF EXISTS public.fl_bons_achat         CASCADE;
DROP TABLE IF EXISTS public.fl_commandes          CASCADE;
DROP TABLE IF EXISTS public.fl_livreurs           CASCADE;
DROP TABLE IF EXISTS public.fl_articles           CASCADE;
DROP TABLE IF EXISTS public.fl_fournisseurs       CASCADE;
DROP TABLE IF EXISTS public.fl_clients            CASCADE;
DROP TABLE IF EXISTS public.fl_users              CASCADE;
DROP TABLE IF EXISTS public.fl_depots             CASCADE;
DROP TABLE IF EXISTS public.fl_visites            CASCADE;
DROP TABLE IF EXISTS public.fl_messages           CASCADE;
DROP TABLE IF EXISTS public.fl_transferts_stock   CASCADE;
DROP TABLE IF EXISTS public.fl_demandes_achat     CASCADE;
DROP TABLE IF EXISTS public.fl_notices            CASCADE;
DROP TABLE IF EXISTS public.fl_non_achats         CASCADE;
DROP TABLE IF EXISTS public.fl_config             CASCADE;
DROP TABLE IF EXISTS public.fl_shareholders       CASCADE;
DROP TABLE IF EXISTS public.fl_gps_positions      CASCADE;
DROP TABLE IF EXISTS public.fl_pricing_releves    CASCADE;
DROP TABLE IF EXISTS public.fl_investissements    CASCADE;
DROP TABLE IF EXISTS public.fl_transport_companies CASCADE;
DROP TABLE IF EXISTS public.fl_caisses_vides      CASCADE;
DROP TABLE IF EXISTS public.fl_performance_incentives CASCADE;

-- ══════════════════════════════════════════════════════════════
-- 2. CRÉER TOUTES LES TABLES JSONB (schéma universel)
--    id TEXT PRIMARY KEY + payload JSONB
--    Aucun mismatch possible avec les objets localStorage
-- ══════════════════════════════════════════════════════════════

CREATE TABLE public.fl_depots (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.fl_users (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.fl_clients (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.fl_fournisseurs (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.fl_articles (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.fl_livreurs (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.fl_commandes (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.fl_bons_achat (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.fl_purchase_orders (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.fl_bons_livraison (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.fl_bons_preparation (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.fl_receptions (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.fl_trips (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.fl_retours (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.fl_visites (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.fl_messages (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.fl_transferts_stock (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.fl_demandes_achat (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.fl_notices (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.fl_non_achats (
  id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- 3. DÉSACTIVER RLS (auth maison localStorage — pas Supabase Auth)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.fl_depots           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_users            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_clients          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_fournisseurs     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_articles         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_livreurs         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_commandes        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_bons_achat       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_purchase_orders  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_bons_livraison   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_bons_preparation DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_receptions       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_trips            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_retours          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_visites          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_messages         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_transferts_stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_demandes_achat   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_notices          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_non_achats       DISABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
-- 4. ACTIVER REALTIME
-- ══════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE
  public.fl_depots, public.fl_users, public.fl_clients,
  public.fl_fournisseurs, public.fl_articles, public.fl_livreurs,
  public.fl_commandes, public.fl_bons_achat, public.fl_purchase_orders,
  public.fl_bons_livraison, public.fl_bons_preparation, public.fl_receptions,
  public.fl_trips, public.fl_retours, public.fl_visites, public.fl_messages,
  public.fl_transferts_stock, public.fl_demandes_achat,
  public.fl_notices, public.fl_non_achats;

-- ══════════════════════════════════════════════════════════════
-- 5. VÉRIFICATION FINALE
-- ══════════════════════════════════════════════════════════════
SELECT
  tablename,
  rowsecurity AS rls,
  (SELECT COUNT(*) FROM pg_publication_tables
   WHERE tablename = t.tablename AND pubname = 'supabase_realtime') > 0 AS realtime
FROM pg_tables t
WHERE schemaname = 'public' AND tablename LIKE 'fl_%'
ORDER BY tablename;
