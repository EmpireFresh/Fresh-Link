-- ====================================================================
--  FreshLink Pro — Setup Supabase COMPLET (version définitive)
--  Projet : jwdrwapuetqoqnankgma
-- ====================================================================
--
--  COMMENT UTILISER CE SCRIPT :
--  1. Ouvrir le SQL Editor de votre projet Supabase :
--     https://supabase.com/dashboard/project/jwdrwapuetqoqnankgma/sql/new
--
--  2. Copier-coller TOUT le contenu de ce fichier
--
--  3. Cliquer "Run" (▶)
--
--  4. Vérifier que la dernière requête affiche 20 lignes (les tables)
--
--  ⚠️  Ce script est IDEMPOTENT : vous pouvez le relancer sans risque.
--     Il supprime les tables fl_* existantes et les recrée proprement.
-- ====================================================================


-- ────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 — Supprimer les anciennes tables fl_* (reset propre)
-- ────────────────────────────────────────────────────────────────────
DO $drop$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'fl_%'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', t);
    RAISE NOTICE 'Dropped table: %', t;
  END LOOP;
END;
$drop$;


-- ────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 — Créer les 20 tables ERP avec schéma JSONB universel
--
--  Schéma :
--    id          TEXT PRIMARY KEY  — identifiant unique de l'enregistrement
--    payload     JSONB             — objet complet de l'enregistrement
--    updated_at  TIMESTAMPTZ       — horodatage dernière modification
--
--  Ce schéma évite tout conflit camelCase/snake_case entre
--  JavaScript et PostgreSQL. Chaque objet est stocké intact.
-- ────────────────────────────────────────────────────────────────────

-- Dépôts / entrepôts
CREATE TABLE public.fl_depots (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Utilisateurs internes (prevendeurs, livreurs, admins...)
CREATE TABLE public.fl_users (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clients (CHR, marchands, particuliers)
CREATE TABLE public.fl_clients (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fournisseurs
CREATE TABLE public.fl_fournisseurs (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Catalogue articles / produits
CREATE TABLE public.fl_articles (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Livreurs / conducteurs
CREATE TABLE public.fl_livreurs (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Commandes clients (prises par prevendeurs)
CREATE TABLE public.fl_commandes (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bons d'achat (achats au marché de gros)
CREATE TABLE public.fl_bons_achat (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchase Orders / Demandes d'achat formelles
CREATE TABLE public.fl_purchase_orders (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bons de livraison
CREATE TABLE public.fl_bons_livraison (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bons de préparation (picking)
CREATE TABLE public.fl_bons_preparation (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Réceptions de marchandise (magasinier)
CREATE TABLE public.fl_receptions (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tournées de livraison (trips)
CREATE TABLE public.fl_trips (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Retours clients
CREATE TABLE public.fl_retours (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Visites prevendeurs (avec ou sans commande)
CREATE TABLE public.fl_visites (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages internes / notifications
CREATE TABLE public.fl_messages (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transferts de stock entre dépôts
CREATE TABLE public.fl_transferts_stock (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Demandes d'achat (déclenchées automatiquement si stock insuffisant)
CREATE TABLE public.fl_demandes_achat (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notices / annonces internes
CREATE TABLE public.fl_notices (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Non-achats (articles non trouvés au marché)
CREATE TABLE public.fl_non_achats (
  id          TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 — Index sur updated_at (performance requêtes triées)
-- ────────────────────────────────────────────────────────────────────
CREATE INDEX idx_fl_commandes_updated        ON public.fl_commandes (updated_at DESC);
CREATE INDEX idx_fl_clients_updated          ON public.fl_clients (updated_at DESC);
CREATE INDEX idx_fl_articles_updated         ON public.fl_articles (updated_at DESC);
CREATE INDEX idx_fl_bons_livraison_updated   ON public.fl_bons_livraison (updated_at DESC);
CREATE INDEX idx_fl_bons_achat_updated       ON public.fl_bons_achat (updated_at DESC);
CREATE INDEX idx_fl_receptions_updated       ON public.fl_receptions (updated_at DESC);
CREATE INDEX idx_fl_visites_updated          ON public.fl_visites (updated_at DESC);
CREATE INDEX idx_fl_trips_updated            ON public.fl_trips (updated_at DESC);

-- Index JSONB pour recherche rapide par champ payload (optionnel)
CREATE INDEX idx_fl_commandes_payload        ON public.fl_commandes USING gin(payload);
CREATE INDEX idx_fl_clients_payload          ON public.fl_clients USING gin(payload);
CREATE INDEX idx_fl_articles_payload         ON public.fl_articles USING gin(payload);


-- ────────────────────────────────────────────────────────────────────
-- ÉTAPE 4 — Désactiver RLS + donner accès aux rôles anon/authenticated
--
--  FreshLink utilise son propre système d'authentification localStorage.
--  RLS Supabase Auth n'est pas utilisé. On ouvre l'accès via anon key.
-- ────────────────────────────────────────────────────────────────────
DO $perms$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'fl_%'
  LOOP
    -- Désactiver RLS
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
    -- Accès complet aux rôles Supabase
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    RAISE NOTICE 'Configured: %', t;
  END LOOP;
END;
$perms$;


-- ────────────────────────────────────────────────────────────────────
-- ÉTAPE 5 — Trigger auto-update de updated_at
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fl_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $triggers$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'fl_%'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_at ON public.%I;
       CREATE TRIGGER trg_updated_at
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.fl_set_updated_at();',
      t, t
    );
  END LOOP;
END;
$triggers$;


-- ────────────────────────────────────────────────────────────────────
-- ÉTAPE 6 — Activer Realtime sur toutes les tables fl_*
--
--  Cela permet la synchronisation en temps réel entre appareils.
--  Si la publication est déjà en mode FOR ALL TABLES, cette étape
--  est ignorée automatiquement.
-- ────────────────────────────────────────────────────────────────────
DO $realtime$
DECLARE
  pub_alltables BOOLEAN;
BEGIN
  -- Vérifier si supabase_realtime est déjà en mode FOR ALL TABLES
  SELECT puballtables INTO pub_alltables
  FROM pg_publication
  WHERE pubname = 'supabase_realtime';

  IF pub_alltables IS NULL THEN
    -- La publication n'existe pas encore → la créer
    RAISE NOTICE 'Creating supabase_realtime publication...';
    EXECUTE 'CREATE PUBLICATION supabase_realtime FOR TABLE
      public.fl_depots, public.fl_users, public.fl_clients,
      public.fl_fournisseurs, public.fl_articles, public.fl_livreurs,
      public.fl_commandes, public.fl_bons_achat, public.fl_purchase_orders,
      public.fl_bons_livraison, public.fl_bons_preparation, public.fl_receptions,
      public.fl_trips, public.fl_retours, public.fl_visites, public.fl_messages,
      public.fl_transferts_stock, public.fl_demandes_achat,
      public.fl_notices, public.fl_non_achats';
    RAISE NOTICE 'supabase_realtime publication created.';

  ELSIF pub_alltables = TRUE THEN
    -- FOR ALL TABLES → rien à faire, toutes les tables sont déjà incluses
    RAISE NOTICE 'supabase_realtime is FOR ALL TABLES — no action needed.';

  ELSE
    -- Publication existe mais pas FOR ALL TABLES → ajouter nos tables
    RAISE NOTICE 'Adding fl_* tables to supabase_realtime...';
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE
        public.fl_depots, public.fl_users, public.fl_clients,
        public.fl_fournisseurs, public.fl_articles, public.fl_livreurs,
        public.fl_commandes, public.fl_bons_achat, public.fl_purchase_orders,
        public.fl_bons_livraison, public.fl_bons_preparation, public.fl_receptions,
        public.fl_trips, public.fl_retours, public.fl_visites, public.fl_messages,
        public.fl_transferts_stock, public.fl_demandes_achat,
        public.fl_notices, public.fl_non_achats;
      RAISE NOTICE 'Tables added to supabase_realtime.';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Realtime note: % (peut être ignoré si déjà configuré)', SQLERRM;
    END;
  END IF;
END;
$realtime$;


-- ────────────────────────────────────────────────────────────────────
-- ÉTAPE 7 — Vérification finale
--  → Doit afficher 20 lignes avec rls = false
-- ────────────────────────────────────────────────────────────────────
SELECT
  tablename                     AS "Table",
  rowsecurity                   AS "RLS activé (doit être false)",
  pg_size_pretty(
    pg_total_relation_size('public.' || tablename)
  )                             AS "Taille",
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_publication_tables pt
    WHERE pt.pubname = 'supabase_realtime'
      AND pt.tablename = t.tablename
      AND pt.schemaname = 'public'
  ) THEN '✅ Realtime ON' ELSE '⚠️ Realtime OFF' END AS "Realtime"
FROM pg_tables t
WHERE schemaname = 'public' AND tablename LIKE 'fl_%'
ORDER BY tablename;

-- ====================================================================
--  ✅ Si vous voyez 20 lignes avec RLS = false → SUCCÈS
--
--  ÉTAPE SUIVANTE — Créer le Storage Bucket (à faire manuellement) :
--  1. Aller sur : https://supabase.com/dashboard/project/jwdrwapuetqoqnankgma/storage/buckets
--  2. Cliquer "New bucket"
--  3. Nom : freshlink-media
--  4. Cocher "Public bucket" ✓
--  5. Cliquer "Create bucket"
--
--  Après ces étapes, votre application est 100% liée à Supabase.
--  La synchronisation multi-appareils sera active automatiquement.
-- ====================================================================
