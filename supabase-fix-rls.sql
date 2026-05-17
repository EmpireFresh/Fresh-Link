-- ═══════════════════════════════════════════════════════════════════════════
-- FRESHLINK — FIX RLS (Row Level Security) — À exécuter dans Supabase SQL Editor
-- https://supabase.com → votre projet → SQL Editor → New query → Coller + Run
-- ═══════════════════════════════════════════════════════════════════════════
--
-- POURQUOI : Les tables fl_* ont RLS activé SANS politiques permissives,
-- ce qui bloque même la clé service_role lors des synchronisations.
-- Cette app utilise son propre système d'auth (localStorage), donc RLS
-- n'apporte pas de sécurité supplémentaire — on le désactive proprement.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── ÉTAPE 1 : Désactiver RLS sur toutes les tables fl_* ──────────────────

ALTER TABLE IF EXISTS public.fl_users               DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_clients             DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_articles            DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_fournisseurs        DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_commandes           DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_bons_livraison      DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_trips               DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_retours             DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_bons_achat          DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_bons_preparation    DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_receptions          DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_transferts_stock    DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_messages            DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_depots              DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_livreurs            DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_visites             DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_demandes_achat      DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_notices             DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_non_achats          DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_documents           DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_prospects           DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fl_contacts            DISABLE ROW LEVEL SECURITY;

-- ── ÉTAPE 2 : Supprimer les politiques RLS existantes (si elles existent) ─

DO $$
DECLARE
  r RECORD;
  p RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'fl_%'
  LOOP
    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = r.tablename
    LOOP
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        p.policyname,
        r.tablename
      );
    END LOOP;
  END LOOP;
END $$;

-- ── ÉTAPE 3 : Accès lecture anonyme (pour les API publiques /ext/*) ────────
-- Ces politiques permettent aux visiteurs du site Netlify de lire le catalogue

-- Activer RLS sur fl_articles avec politique de lecture publique
ALTER TABLE IF EXISTS public.fl_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecture_publique_articles" ON public.fl_articles
  FOR SELECT USING (true);
-- Écriture réservée au service_role (sync-write)
CREATE POLICY "ecriture_service_articles" ON public.fl_articles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── ÉTAPE 4 : Vérification ────────────────────────────────────────────────
-- Après exécution, lancez ce SELECT pour vérifier :
SELECT
  tablename,
  rowsecurity AS rls_active,
  (SELECT count(*) FROM pg_policies WHERE tablename = t.tablename AND schemaname = 'public') AS nb_policies
FROM pg_tables t
WHERE schemaname = 'public' AND tablename LIKE 'fl_%'
ORDER BY tablename;

-- Résultat attendu :
-- fl_articles  → rls_active: TRUE, nb_policies: 2
-- fl_clients   → rls_active: FALSE, nb_policies: 0
-- fl_users     → rls_active: FALSE, nb_policies: 0
-- ... (toutes les autres à FALSE)
