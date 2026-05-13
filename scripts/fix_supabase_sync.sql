-- ============================================================
-- FreshLink Pro — Script COMPLET sync Supabase (v3 JSONB)
-- À exécuter dans : https://supabase.com/dashboard/project/jwdrwapuetqoqnankgma/sql/new
--
-- POURQUOI JSONB ?
--   localStorage stocke les objets en camelCase (accessType, depotId…)
--   mais les anciennes tables Supabase attendaient du snake_case
--   (access_type, depot_id…). PostgREST rejetait tous les upserts.
--   Avec payload JSONB, on stocke l'objet entier tel quel → pas de mapping.
-- ============================================================

-- Helper updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- ══════════════════════════════════════════════════════════════
-- CRÉER TOUTES LES TABLES (schéma JSONB universel)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fl_depots (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fl_users (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fl_clients (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fl_fournisseurs (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fl_articles (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fl_livreurs (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fl_commandes (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fl_bons_achat (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fl_purchase_orders (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fl_bons_livraison (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fl_bons_preparation (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fl_receptions (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fl_trips (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fl_retours (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fl_visites (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fl_messages (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fl_transferts_stock (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fl_demandes_achat (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fl_notices (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fl_non_achats (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- DÉSACTIVER RLS SUR TOUTES LES TABLES
-- (auth maison localStorage — pas Supabase Auth)
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'fl_depots','fl_users','fl_clients','fl_fournisseurs','fl_articles',
    'fl_livreurs','fl_commandes','fl_bons_achat','fl_purchase_orders',
    'fl_bons_livraison','fl_bons_preparation','fl_receptions','fl_trips',
    'fl_retours','fl_visites','fl_messages','fl_transferts_stock',
    'fl_demandes_achat','fl_notices','fl_non_achats'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', tbl);
      RAISE NOTICE 'RLS désactivé: %', tbl;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Table inexistante (ignorée): %', tbl;
    END;
  END LOOP;
END; $$;

-- ══════════════════════════════════════════════════════════════
-- ACTIVER REALTIME SUR TOUTES LES TABLES
-- ══════════════════════════════════════════════════════════════

-- Ajouter à la publication Realtime (ignore si déjà présent)
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'fl_depots','fl_users','fl_clients','fl_fournisseurs','fl_articles',
    'fl_livreurs','fl_commandes','fl_bons_achat','fl_purchase_orders',
    'fl_bons_livraison','fl_bons_preparation','fl_receptions','fl_trips',
    'fl_retours','fl_visites','fl_messages','fl_transferts_stock',
    'fl_demandes_achat','fl_notices','fl_non_achats'
  ] LOOP
    BEGIN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl
      );
      RAISE NOTICE 'Realtime activé: %', tbl;
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'Realtime déjà actif: %', tbl;
    WHEN undefined_table THEN
      RAISE NOTICE 'Table inexistante (ignorée): %', tbl;
    END;
  END LOOP;
END; $$;

-- ══════════════════════════════════════════════════════════════
-- VÉRIFICATION FINALE
-- ══════════════════════════════════════════════════════════════
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'fl_%'
ORDER BY tablename;
