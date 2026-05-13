-- ============================================================
-- FreshLink Pro — Script de correction sync Supabase
-- À exécuter UNE SEULE FOIS dans le SQL Editor Supabase :
-- https://supabase.com/dashboard/project/jwdrwapuetqoqnankgma/sql
--
-- Ce script :
--   1. Crée les tables manquantes (fl_depots, fl_livreurs, etc.)
--   2. Désactive RLS ou ajoute policies anon full-access
--   3. Active Supabase Realtime sur toutes les tables ERP
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. CRÉER LES TABLES MANQUANTES (si elles n'existent pas)
-- ══════════════════════════════════════════════════════════════

-- fl_depots
CREATE TABLE IF NOT EXISTS public.fl_depots (
  id          TEXT PRIMARY KEY,
  nom         TEXT NOT NULL,
  ville       TEXT,
  adresse     TEXT,
  actif       BOOLEAN DEFAULT TRUE,
  type_depot  TEXT,
  responsable_nom TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
INSERT INTO public.fl_depots (id, nom, actif)
  VALUES ('DEPOT_PRINCIPAL', 'Depot Principal', TRUE)
  ON CONFLICT (id) DO NOTHING;

-- fl_livreurs
CREATE TABLE IF NOT EXISTS public.fl_livreurs (
  id          TEXT PRIMARY KEY,
  nom         TEXT,
  prenom      TEXT,
  telephone   TEXT,
  vehicule    TEXT,
  actif       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- fl_demandes_achat
CREATE TABLE IF NOT EXISTS public.fl_demandes_achat (
  id          TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- fl_notices
CREATE TABLE IF NOT EXISTS public.fl_notices (
  id          TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- fl_non_achats
CREATE TABLE IF NOT EXISTS public.fl_non_achats (
  id          TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- fl_transferts_stock (si absent)
CREATE TABLE IF NOT EXISTS public.fl_transferts_stock (
  id          TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- fl_visites (si absent)
CREATE TABLE IF NOT EXISTS public.fl_visites (
  id          TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- fl_messages (si absent)
CREATE TABLE IF NOT EXISTS public.fl_messages (
  id          TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- 2. RLS — DÉSACTIVER OU AJOUTER POLICIES ANON FULL ACCESS
--    (L'app utilise son propre système d'auth localStorage)
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'fl_depots','fl_users','fl_clients','fl_fournisseurs','fl_articles',
    'fl_livreurs','fl_commandes','fl_bons_achat','fl_purchase_orders',
    'fl_bons_livraison','fl_bons_preparation','fl_receptions',
    'fl_trips','fl_retours','fl_visites','fl_messages',
    'fl_transferts_stock','fl_demandes_achat','fl_notices','fl_non_achats'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Désactiver RLS complètement (auth maison)
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', tbl);
    RAISE NOTICE 'RLS désactivé: %', tbl;
  END LOOP;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 3. ACTIVER REALTIME SUR TOUTES LES TABLES ERP
-- ══════════════════════════════════════════════════════════════

-- Supprimer les entrées existantes pour éviter les doublons
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS
  public.fl_depots,
  public.fl_users,
  public.fl_clients,
  public.fl_fournisseurs,
  public.fl_articles,
  public.fl_livreurs,
  public.fl_commandes,
  public.fl_bons_achat,
  public.fl_purchase_orders,
  public.fl_bons_livraison,
  public.fl_bons_preparation,
  public.fl_receptions,
  public.fl_trips,
  public.fl_retours,
  public.fl_visites,
  public.fl_messages,
  public.fl_transferts_stock,
  public.fl_demandes_achat,
  public.fl_notices,
  public.fl_non_achats;

-- Ajouter toutes les tables au Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.fl_depots,
  public.fl_users,
  public.fl_clients,
  public.fl_fournisseurs,
  public.fl_articles,
  public.fl_livreurs,
  public.fl_commandes,
  public.fl_bons_achat,
  public.fl_purchase_orders,
  public.fl_bons_livraison,
  public.fl_bons_preparation,
  public.fl_receptions,
  public.fl_trips,
  public.fl_retours,
  public.fl_visites,
  public.fl_messages,
  public.fl_transferts_stock,
  public.fl_demandes_achat,
  public.fl_notices,
  public.fl_non_achats;

-- ══════════════════════════════════════════════════════════════
-- 4. VÉRIFICATION
-- ══════════════════════════════════════════════════════════════
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'fl_%'
ORDER BY tablename;
