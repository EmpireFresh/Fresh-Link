-- ═══════════════════════════════════════════════════════════════════════════
-- FRESHLINK ERP — SCHÉMA SUPABASE V2
-- Vita Fresh / Vita Tech — 2026
--
-- Structure unifiée : { id TEXT PK, payload JSONB, updated_at TIMESTAMPTZ }
-- Toutes les tables utilisent le service_role pour bypass RLS.
--
-- UTILISATION : exécuter en une seule fois dans l'éditeur SQL Supabase.
-- Efface et recrée toutes les tables proprement.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0. Extensions ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- recherche textuelle rapide

-- ═══════════════════════════════════════════════════════════════════════════
-- HELPER : crée une table standard {id, payload, updated_at} + RLS
-- ═══════════════════════════════════════════════════════════════════════════
-- On recrée chaque table manuellement pour garder les commentaires

-- ── 1. UTILISATEURS & AUTH ────────────────────────────────────────────────

DROP TABLE IF EXISTS fl_users            CASCADE;
DROP TABLE IF EXISTS fl_account_requests CASCADE;
DROP TABLE IF EXISTS fl_site_access      CASCADE;

-- Utilisateurs (admins, commerciaux, clients, livreurs…)
CREATE TABLE fl_users (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_users IS 'Tous les comptes utilisateurs. Payload : name, email, telephone, password, role, actif, clientId, sousType…';
CREATE INDEX idx_fl_users_updated  ON fl_users (updated_at DESC);
CREATE INDEX idx_fl_users_payload  ON fl_users USING gin(payload);

-- Demandes de création de compte (depuis le website)
CREATE TABLE fl_account_requests (
  id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_account_requests IS 'Demandes de comptes soumises via le site web. Payload : nom, telephone, type, statut, userId…';
CREATE INDEX idx_fl_account_requests_updated ON fl_account_requests (updated_at DESC);

-- Accès appareils (device guard — mobile + back-office)
CREATE TABLE fl_site_access (
  device_id      TEXT        PRIMARY KEY,
  nom            TEXT,
  telephone      TEXT,
  statut         TEXT        NOT NULL DEFAULT 'en_attente'
                             CHECK (statut IN ('autorise','en_attente','bloque')),
  user_agent     TEXT,
  notes          TEXT,
  gps_lat        DOUBLE PRECISION,
  gps_lng        DOUBLE PRECISION,
  gps_precision  DOUBLE PRECISION,
  user_id        TEXT,
  first_visit_at TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE fl_site_access IS 'Appareils enregistrés pour le Device Guard. statut: autorise/en_attente/bloque';
CREATE INDEX idx_fl_site_access_statut  ON fl_site_access (statut);
CREATE INDEX idx_fl_site_access_updated ON fl_site_access (updated_at DESC);

-- ── 2. CATALOGUE & STOCK ─────────────────────────────────────────────────

DROP TABLE IF EXISTS fl_articles      CASCADE;
DROP TABLE IF EXISTS fl_fournisseurs  CASCADE;
DROP TABLE IF EXISTS fl_depots        CASCADE;

-- Articles / produits
CREATE TABLE fl_articles (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_articles IS
  'Articles ERP. Payload : nom, nomAr, famille, unite, stockDisponible, prixAchat, pvMethode, pvValeur, '
  'prixCHR, prixMarchand, prixParticulier, marketplaceActif, catalogueVisible, marketplacePrixPublic, photo…';
CREATE INDEX idx_fl_articles_updated ON fl_articles (updated_at DESC);
CREATE INDEX idx_fl_articles_payload ON fl_articles USING gin(payload);

-- Fournisseurs
CREATE TABLE fl_fournisseurs (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_fournisseurs IS 'Fournisseurs. Payload : nom, contact, telephone, email, adresse, ville, specialites, modalitePaiement…';
CREATE INDEX idx_fl_fournisseurs_updated ON fl_fournisseurs (updated_at DESC);

-- Dépôts / entrepôts
CREATE TABLE fl_depots (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_depots IS 'Dépôts de stockage. Payload : nom, adresse, responsable, capacite…';

-- ── 3. CLIENTS ───────────────────────────────────────────────────────────

DROP TABLE IF EXISTS fl_clients   CASCADE;
DROP TABLE IF EXISTS fl_prospects CASCADE;

-- Clients (profil commercial — lié à fl_users via clientId)
CREATE TABLE fl_clients (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_clients IS
  'Profils clients. Payload : nom, telephone, email, adresse, secteur, zone, type, categorie, segment, '
  'remisePct, remiseActive, loyaltyPoints, promotions, actif, userId…';
CREATE INDEX idx_fl_clients_updated ON fl_clients (updated_at DESC);
CREATE INDEX idx_fl_clients_payload ON fl_clients USING gin(payload);

-- Prospects commerciaux
CREATE TABLE fl_prospects (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_prospects IS 'Prospects non encore clients. Payload : nom, telephone, secteur, statut, prevendeurId…';

-- ── 4. COMMANDES ─────────────────────────────────────────────────────────

DROP TABLE IF EXISTS fl_commandes     CASCADE;
DROP TABLE IF EXISTS fl_commandes_web CASCADE;
DROP TABLE IF EXISTS fl_documents     CASCADE;

-- Commandes ERP (terrain / mobile)
CREATE TABLE fl_commandes (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_commandes IS
  'Commandes saisies par les prévendeurs. Payload : numero, date, clientId, clientNom, '
  'lignes[], montantTotal, statut, prevendeurId, secteur, zone…';
CREATE INDEX idx_fl_commandes_updated ON fl_commandes (updated_at DESC);
CREATE INDEX idx_fl_commandes_payload ON fl_commandes USING gin(payload);

-- Commandes web (depuis vitafresh.vercel.app)
CREATE TABLE fl_commandes_web (
  id               TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  numero           TEXT,
  client_nom       TEXT,
  telephone        TEXT,
  email            TEXT,
  adresse          TEXT,
  ville            TEXT,
  lignes           JSONB       DEFAULT '[]',
  montant_total    NUMERIC(10,2) DEFAULT 0,
  frais_livraison  NUMERIC(10,2) DEFAULT 0,
  notes            TEXT,
  statut           TEXT        NOT NULL DEFAULT 'nouveau'
                               CHECK (statut IN ('nouveau','en_cours','prepare','livre','annule','confirmee')),
  source           TEXT        DEFAULT 'web',
  user_id          TEXT,
  payload          JSONB       DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_commandes_web IS 'Commandes passées sur le site web. Structure plate + payload pour champs additionnels.';
CREATE INDEX idx_fl_commandes_web_statut   ON fl_commandes_web (statut);
CREATE INDEX idx_fl_commandes_web_created  ON fl_commandes_web (created_at DESC);
CREATE INDEX idx_fl_commandes_web_tel      ON fl_commandes_web (telephone);

-- Documents commerciaux (devis, contrats CHR)
CREATE TABLE fl_documents (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_documents IS 'Devis et contrats CHR. Payload : type, clientId, lignes, montant, statut, dateExpiration…';

-- ── 5. LOGISTIQUE ────────────────────────────────────────────────────────

DROP TABLE IF EXISTS fl_bons_livraison   CASCADE;
DROP TABLE IF EXISTS fl_bons_preparation CASCADE;
DROP TABLE IF EXISTS fl_trips            CASCADE;
DROP TABLE IF EXISTS fl_retours          CASCADE;
DROP TABLE IF EXISTS fl_livreurs         CASCADE;
DROP TABLE IF EXISTS fl_caisses_vides    CASCADE;
DROP TABLE IF EXISTS fl_visites          CASCADE;

-- Bons de livraison
CREATE TABLE fl_bons_livraison (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_bons_livraison IS 'Bons de livraison. Payload : numero, date, tripId, commandeId, clientNom, lignes[], montantTotal, statut…';
CREATE INDEX idx_fl_bons_livraison_updated ON fl_bons_livraison (updated_at DESC);

-- Bons de préparation
CREATE TABLE fl_bons_preparation (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_bons_preparation IS 'Bons de préparation magasin. Payload : commandeIds[], lignes[], statut, preparateur…';

-- Tournées / trips
CREATE TABLE fl_trips (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_trips IS 'Tournées de livraison. Payload : numero, date, livreurId, secteur, statut, BLs[], distance…';

-- Retours marchandise
CREATE TABLE fl_retours (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_retours IS 'Retours marchandise clients. Payload : commandeId, clientId, lignes[], motif, statut, montant…';

-- Livreurs
CREATE TABLE fl_livreurs (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_livreurs IS 'Profils livreurs. Payload : nom, telephone, vehicule, secteur, actif…';

-- Caisses vides (emballages retournés)
CREATE TABLE fl_caisses_vides (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_caisses_vides IS 'Suivi des caisses/emballages retournés. Payload : clientId, nbGros, nbDemi, date, statut…';

-- Visites commerciales terrain
CREATE TABLE fl_visites (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_visites IS 'Visites clients par les prévendeurs. Payload : clientId, prevendeurId, date, resultat, notes…';

-- ── 6. ACHATS ────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS fl_bons_achat      CASCADE;
DROP TABLE IF EXISTS fl_purchase_orders CASCADE;
DROP TABLE IF EXISTS fl_receptions      CASCADE;
DROP TABLE IF EXISTS fl_demandes_achat  CASCADE;
DROP TABLE IF EXISTS fl_transferts_stock CASCADE;

-- Bons d'achat fournisseurs
CREATE TABLE fl_bons_achat (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_bons_achat IS 'Bons d achat. Payload : fournisseurId, date, lignes[], montantTotal, statut, acheteurId…';
CREATE INDEX idx_fl_bons_achat_updated ON fl_bons_achat (updated_at DESC);

-- Bons de commande fournisseurs (Purchase Orders)
CREATE TABLE fl_purchase_orders (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_purchase_orders IS 'Commandes fournisseurs formalisées. Payload : fournisseurId, lignes[], statut, datelivraison…';

-- Réceptions marchandise
CREATE TABLE fl_receptions (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_receptions IS 'Réceptions en entrepôt. Payload : bonAchatId, lignes[], magasinierNom, date, ecarts…';

-- Demandes d'achat internes (besoins stock)
CREATE TABLE fl_demandes_achat (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_demandes_achat IS 'Demandes achat internes. Payload : articleId, qte, urgence, demandeurId, statut…';

-- Transferts de stock (brut → transformé : épluché, lavé, coupé…)
CREATE TABLE fl_transferts_stock (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_transferts_stock IS
  'Transferts stock. Payload : articleSourceId, articleDestId, qte, transformation (epluce/lave/coupe/pret_cuisson/emballe), '
  'date, operateurId, perte…';
CREATE INDEX idx_fl_transferts_updated ON fl_transferts_stock (updated_at DESC);

-- ── 7. FINANCE ───────────────────────────────────────────────────────────

DROP TABLE IF EXISTS fl_charges       CASCADE;
DROP TABLE IF EXISTS fl_actionnaires  CASCADE;
DROP TABLE IF EXISTS fl_salaries      CASCADE;
DROP TABLE IF EXISTS fl_caisse_entries CASCADE;

-- Charges / dépenses
CREATE TABLE fl_charges (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_charges IS 'Charges et dépenses. Payload : categorie, montant, date, description, justificatif…';

-- Actionnaires
CREATE TABLE fl_actionnaires (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_actionnaires IS 'Actionnaires. Payload : nom, partPct, apport, dateEntree…';

-- Salaires
CREATE TABLE fl_salaries (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_salaries IS 'Fiches salariés. Payload : nom, poste, salaireBase, dateEmbauche, actif…';

-- Mouvements caisse
CREATE TABLE fl_caisse_entries (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_caisse_entries IS 'Mouvements de caisse. Payload : type (encaissement/decaissement), montant, motif, date, saisiPar…';

-- ── 8. COMMUNICATION & NOTIFICATIONS ─────────────────────────────────────

DROP TABLE IF EXISTS fl_messages  CASCADE;
DROP TABLE IF EXISTS fl_notices   CASCADE;
DROP TABLE IF EXISTS fl_non_achats CASCADE;

-- Messages internes équipe
CREATE TABLE fl_messages (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_messages IS 'Messages internes. Payload : from, to, contenu, lu, date…';

-- Notices / alertes système
CREATE TABLE fl_notices (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_notices IS 'Alertes et notices système. Payload : type, titre, message, priorite, lue, date…';

-- Non-achats signalés par les prévendeurs
CREATE TABLE fl_non_achats (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_non_achats IS 'Signalements non-achat terrain. Payload : clientId, prevendeurId, motif, date…';

-- ── 9. PERFORMANCE & RH ─────────────────────────────────────────────────

DROP TABLE IF EXISTS fl_incentives      CASCADE;
DROP TABLE IF EXISTS fl_perf_commercial CASCADE;

-- Primes et incentives
CREATE TABLE fl_incentives (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_incentives IS 'Primes et incentives commerciaux. Payload : userId, montant, periode, critere, statut…';

-- Performance commerciale
CREATE TABLE fl_perf_commercial (
  id         TEXT        PRIMARY KEY,
  payload    JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fl_perf_commercial IS 'KPIs commerciaux. Payload : userId, periode, caRealise, nbClients, nbCommandes, objectifCA…';

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — Row Level Security
-- Règle unique : service_role a accès total, anon/authenticated limité
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'fl_users','fl_account_requests',
    'fl_articles','fl_fournisseurs','fl_depots',
    'fl_clients','fl_prospects',
    'fl_commandes','fl_commandes_web','fl_documents',
    'fl_bons_livraison','fl_bons_preparation','fl_trips','fl_retours',
    'fl_livreurs','fl_caisses_vides','fl_visites',
    'fl_bons_achat','fl_purchase_orders','fl_receptions','fl_demandes_achat','fl_transferts_stock',
    'fl_charges','fl_actionnaires','fl_salaries','fl_caisse_entries',
    'fl_messages','fl_notices','fl_non_achats',
    'fl_incentives','fl_perf_commercial'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    -- Activer RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    -- Supprimer les anciennes politiques
    EXECUTE format('DROP POLICY IF EXISTS "service_role_all_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "anon_read_%s"         ON %I', tbl, tbl);
    -- Politique service_role : accès complet (bypass RLS pour les API routes)
    EXECUTE format(
      'CREATE POLICY "service_role_all_%s" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl, tbl
    );
    -- Politique anon : lecture seule des tables non-sensibles (catalogue, etc.)
    -- Les tables sensibles (users, finance, RH) restent fermées à anon
  END LOOP;
END $$;

-- Tables publiques : lecture anon autorisée (catalogue website)
ALTER TABLE fl_articles         ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_fl_articles"  ON fl_articles;
CREATE POLICY "anon_read_fl_articles" ON fl_articles
  FOR SELECT TO anon USING (
    (payload->>'marketplaceActif')::boolean IS NOT FALSE
    AND (payload->>'actif')::boolean IS NOT FALSE
  );

-- fl_commandes_web : clients peuvent insérer (passer commande)
DROP POLICY IF EXISTS "anon_insert_fl_commandes_web" ON fl_commandes_web;
CREATE POLICY "anon_insert_fl_commandes_web" ON fl_commandes_web
  FOR INSERT TO anon WITH CHECK (true);

-- fl_site_access RLS
ALTER TABLE fl_site_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_fl_site_access" ON fl_site_access;
DROP POLICY IF EXISTS "anon_insert_fl_site_access"      ON fl_site_access;
CREATE POLICY "service_role_all_fl_site_access" ON fl_site_access
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_insert_fl_site_access" ON fl_site_access
  FOR INSERT TO anon WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- VUE : v_marketplace_catalogue
-- Utilisée par /api/ext/catalogue (tier 1 — données enrichies)
-- ═══════════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS v_marketplace_catalogue;
CREATE VIEW v_marketplace_catalogue AS
SELECT
  a.id,
  a.payload->>'nom'                                         AS nom,
  a.payload->>'nomAr'                                       AS nom_ar,
  a.payload->>'famille'                                     AS famille,
  a.payload->>'unite'                                       AS unite,
  a.payload->>'photo'                                       AS photo,
  a.payload->>'description'                                 AS description,
  -- Prix public (marketplace ou calculé)
  COALESCE(
    (a.payload->>'marketplacePrixPublic')::numeric,
    (a.payload->>'prix_public')::numeric,
    (a.payload->>'pvValeur')::numeric,
    0
  )                                                         AS prix_public,
  -- Prix circuits
  (a.payload->>'prixCHR')::numeric                          AS prix_chr,
  (a.payload->>'prixMarchand')::numeric                     AS prix_marchand,
  (a.payload->>'prixParticulier')::numeric                  AS prix_particulier,
  -- Stock
  COALESCE((a.payload->>'stockDisponible')::int, 0)         AS stock_disponible,
  -- Statut
  COALESCE(a.payload->>'marketplaceStatut', 'disponible')   AS statut,
  -- Promo
  a.payload->'marketplacePromo'                             AS promo,
  -- Flags
  COALESCE((a.payload->>'marketplaceActif')::boolean, true) AS marketplace_actif,
  COALESCE((a.payload->>'catalogueVisible')::boolean, true) AS catalogue_visible,
  -- Ordre d'affichage
  COALESCE((a.payload->>'marketplaceOrdre')::int, 999)      AS ordre,
  -- Tags
  COALESCE(a.payload->'marketplaceTags', a.payload->'tags', '[]'::jsonb) AS tags,
  a.updated_at
FROM fl_articles a
WHERE
  a.id NOT LIKE '__%'                                       -- exclure les entrées de config
  AND COALESCE((a.payload->>'marketplaceActif')::boolean, true)  = true
  AND COALESCE((a.payload->>'catalogueVisible')::boolean, true)  = true
  AND COALESCE((a.payload->>'actif')::boolean, true)             = true;

COMMENT ON VIEW v_marketplace_catalogue IS
  'Vue enrichie des articles publiés sur le site web. Utilisée par /api/ext/catalogue.';

-- ═══════════════════════════════════════════════════════════════════════════
-- DONNÉES INITIALES — Jawad (super_super_admin)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO fl_users (id, payload, updated_at)
VALUES (
  'VFU00001',
  '{
    "name":      "Jawad",
    "email":     "jawad@vita-fresh.ma",
    "telephone": "0647333456",
    "password":  "Medghaly@22",
    "role":      "super_super_admin",
    "actif":     true,
    "canViewAchat":        true,
    "canViewCommercial":   true,
    "canViewLogistique":   true,
    "canViewStock":        true,
    "canViewCash":         true,
    "canViewFinance":      true,
    "canViewRecap":        true,
    "canViewDatabase":     true,
    "canViewExternal":     true,
    "canCreateCommandeBO": true,
    "canViewRH":           true,
    "canViewInvestisseur": true
  }'::jsonb,
  now()
)
ON CONFLICT (id) DO UPDATE
  SET payload    = EXCLUDED.payload,
      updated_at = now();

-- Supprimer l'ancien doublon Jawad s'il existe
DELETE FROM fl_users WHERE id = 'u_jawad_root';

-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGER : updated_at automatique
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'fl_users','fl_account_requests',
    'fl_articles','fl_fournisseurs','fl_depots',
    'fl_clients','fl_prospects',
    'fl_commandes','fl_commandes_web','fl_documents',
    'fl_bons_livraison','fl_bons_preparation','fl_trips','fl_retours',
    'fl_livreurs','fl_caisses_vides','fl_visites',
    'fl_bons_achat','fl_purchase_orders','fl_receptions','fl_demandes_achat','fl_transferts_stock',
    'fl_charges','fl_actionnaires','fl_salaries','fl_caisse_entries',
    'fl_messages','fl_notices','fl_non_achats',
    'fl_incentives','fl_perf_commercial'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I; '
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I '
      'FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- RÉSUMÉ
-- ═══════════════════════════════════════════════════════════════════════════
SELECT
  schemaname,
  tablename,
  obj_description((schemaname||'.'||tablename)::regclass) AS description
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'fl_%'
ORDER BY tablename;
