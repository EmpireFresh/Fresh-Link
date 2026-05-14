-- ============================================================
-- FreshLink — Schéma Supabase COMPLET
-- Crée toutes les tables + active Realtime sur chacune
-- Exécuter dans : Supabase Dashboard → SQL Editor → Run
-- ============================================================
-- IDEMPOTENT : CREATE TABLE IF NOT EXISTS → safe à re-exécuter

-- ── Extensions ─────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. fl_users
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_users (
  id                           TEXT PRIMARY KEY,
  name                         TEXT NOT NULL,
  email                        TEXT,
  password_hash                TEXT DEFAULT '',
  role                         TEXT NOT NULL DEFAULT 'prevendeur',
  access_type                  TEXT,
  secteur                      TEXT,
  phone                        TEXT,
  telephone                    TEXT,
  actif                        BOOLEAN DEFAULT true,
  photo_url                    TEXT,
  can_view_achat               BOOLEAN DEFAULT false,
  can_view_commercial          BOOLEAN DEFAULT false,
  can_view_logistique          BOOLEAN DEFAULT false,
  can_view_stock               BOOLEAN DEFAULT false,
  can_view_cash                BOOLEAN DEFAULT false,
  can_view_finance             BOOLEAN DEFAULT false,
  can_view_recap               BOOLEAN DEFAULT false,
  can_view_database            BOOLEAN DEFAULT false,
  objectif_clients             NUMERIC,
  objectif_tonnage             NUMERIC,
  objectif_journalier_ca       NUMERIC,
  objectif_hebdomadaire_ca     NUMERIC,
  objectif_mensuel_ca          NUMERIC,
  objectif_journalier_clients  NUMERIC,
  objectif_hebdomadaire_clients NUMERIC,
  objectif_mensuel_clients     NUMERIC,
  notif_achat                  BOOLEAN DEFAULT false,
  notif_commercial             BOOLEAN DEFAULT false,
  notif_livraison              BOOLEAN DEFAULT false,
  notif_recap                  BOOLEAN DEFAULT false,
  notif_besoin_achat           BOOLEAN DEFAULT false,
  fournisseur_id               TEXT,
  client_id                    TEXT,
  created_at                   TIMESTAMPTZ DEFAULT now(),
  updated_at                   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. fl_clients
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_clients (
  id                           TEXT PRIMARY KEY,
  nom                          TEXT NOT NULL,
  secteur                      TEXT DEFAULT '',
  zone                         TEXT DEFAULT '',
  type                         TEXT DEFAULT 'autre',
  "typeAutre"                  TEXT,
  taille                       TEXT DEFAULT '50-100kg',
  "typeProduits"               TEXT DEFAULT 'moyenne',
  rotation                     TEXT DEFAULT 'journalier',
  "modalitePaiement"           TEXT,
  "plafondCredit"              NUMERIC,
  "creditAutorise"             BOOLEAN DEFAULT false,
  "delaiRecouvrement"          TEXT,
  "creditWorkflowValidateur"   TEXT,
  "creditWorkflowValidateurNom" TEXT,
  "creditStatut"               TEXT,
  "creditSolde"                NUMERIC DEFAULT 0,
  "gpsLat"                     NUMERIC,
  "gpsLng"                     NUMERIC,
  telephone                    TEXT,
  email                        TEXT,
  adresse                      TEXT,
  ice                          TEXT,
  notes                        TEXT,
  "createdBy"                  TEXT DEFAULT '',
  "createdAt"                  TEXT DEFAULT '',
  "prevendeurId"               TEXT,
  "teamLeadId"                 TEXT,
  "defaultHeureLivraison"      TEXT,
  segment                      TEXT DEFAULT 'standard',
  "loyaltyPoints"              NUMERIC DEFAULT 0,
  "loyaltyOptIn"               BOOLEAN DEFAULT false,
  categorie                    TEXT,
  created_at                   TIMESTAMPTZ DEFAULT now(),
  updated_at                   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. fl_articles
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_articles (
  id                       TEXT PRIMARY KEY,
  nom                      TEXT NOT NULL,
  "nomAr"                  TEXT DEFAULT '',
  famille                  TEXT DEFAULT '',
  unite                    TEXT DEFAULT 'kg',
  um                       TEXT,
  "colisageParUM"          NUMERIC,
  "colisageCaisses"        NUMERIC,
  "colisageDemiCaisses"    NUMERIC,
  "stockDisponible"        NUMERIC DEFAULT 0,
  "stockDefect"            NUMERIC DEFAULT 0,
  "stockReel"              NUMERIC,
  "stockReelDate"          TEXT,
  "stockReelSaisiPar"      TEXT,
  "stockTheorique"         NUMERIC,
  "shelfLifeJours"         NUMERIC,
  "alerteShelfLifeJours"   NUMERIC DEFAULT 2,
  "prixLiquidation"        NUMERIC,
  lots                     JSONB DEFAULT '[]',
  "prixAchat"              NUMERIC DEFAULT 0,
  "pvMethode"              TEXT DEFAULT 'pourcentage',
  "pvValeur"               NUMERIC DEFAULT 0,
  "margeMethode"           TEXT,
  "historiquePrixAchat"    JSONB DEFAULT '[]',
  photo                    TEXT,
  photos                   JSONB DEFAULT '[]',
  actif                    BOOLEAN DEFAULT true,
  "catalogueVisible"       BOOLEAN DEFAULT true,
  "marketplaceActif"       BOOLEAN DEFAULT false,
  "marketplaceStatut"      TEXT DEFAULT 'disponible',
  "marketplaceCommentaire" TEXT,
  "marketplacePrixPublic"  NUMERIC DEFAULT 0,
  "marketplacePromo"       JSONB,
  "marketplaceSeuilShortStock" NUMERIC,
  "marketplaceTags"        JSONB DEFAULT '[]',
  "marketplaceOrdre"       NUMERIC DEFAULT 0,
  "marketplaceDescription" TEXT,
  "marketplaceDescriptionAr" TEXT,
  "prixCHR"                NUMERIC,
  "prixMarchand"           NUMERIC,
  "prixParticulier"        NUMERIC,
  "promoCHR"               NUMERIC,
  "promoMarchand"          NUMERIC,
  "promoParticulier"       NUMERIC,
  -- Legacy Realtime/marketplace fields (snake_case aliases)
  statut_web               TEXT DEFAULT 'disponible',
  visible_web              BOOLEAN DEFAULT false,
  promo_active             BOOLEAN DEFAULT false,
  promo_taux               NUMERIC DEFAULT 0,
  promo_label              TEXT,
  promo_fin                TEXT,
  criteres_qualite         JSONB DEFAULT '{}',
  tags                     JSONB DEFAULT '[]',
  position_catalogue       NUMERIC DEFAULT 0,
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. fl_fournisseurs
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_fournisseurs (
  id                 TEXT PRIMARY KEY,
  nom                TEXT NOT NULL,
  contact            TEXT DEFAULT '',
  telephone          TEXT,
  email              TEXT DEFAULT '',
  adresse            TEXT,
  ville              TEXT,
  region             TEXT,
  specialites        JSONB DEFAULT '[]',
  "modalitePaiement" TEXT,
  "delaiPaiement"    NUMERIC,
  ice                TEXT,
  rc                 TEXT,
  notes              TEXT,
  itineraires        JSONB DEFAULT '[]',
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. fl_commandes
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_commandes (
  id                    TEXT PRIMARY KEY,
  date                  TEXT NOT NULL,
  "commercialId"        TEXT DEFAULT '',
  "commercialNom"       TEXT DEFAULT '',
  "clientId"            TEXT DEFAULT '',
  "clientNom"           TEXT DEFAULT '',
  secteur               TEXT DEFAULT '',
  zone                  TEXT DEFAULT '',
  "gpsLat"              NUMERIC DEFAULT 0,
  "gpsLng"              NUMERIC DEFAULT 0,
  lignes                JSONB DEFAULT '[]',
  heurelivraison        TEXT DEFAULT '',
  statut                TEXT DEFAULT 'en_attente',
  "emailDestinataire"   TEXT DEFAULT '',
  "teamLeadId"          TEXT,
  "teamLeadNom"         TEXT,
  approbateur           TEXT,
  "approbateurId"       TEXT,
  "dateApprobation"     TEXT,
  "motifRefus"          TEXT,
  commentaire           TEXT,
  -- workflow
  "workflowValidation"  TEXT DEFAULT 'direct',
  -- extra fields
  "heureCommande"       TEXT,
  "notifEnvoyee"        BOOLEAN DEFAULT false,
  "cutoffDepassee"      BOOLEAN DEFAULT false,
  -- BL & paiement
  "blIds"               JSONB DEFAULT '[]',
  "montantEncaisse"     NUMERIC DEFAULT 0,
  "resteAEncaisser"     NUMERIC DEFAULT 0,
  -- GPS livraison
  "gpsLatLivraison"     NUMERIC,
  "gpsLngLivraison"     NUMERIC,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. fl_visites
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_visites (
  id              TEXT PRIMARY KEY,
  date            TEXT NOT NULL,
  "prevendeurId"  TEXT DEFAULT '',
  "prevendeurNom" TEXT DEFAULT '',
  "clientId"      TEXT DEFAULT '',
  "clientNom"     TEXT DEFAULT '',
  secteur         TEXT DEFAULT '',
  zone            TEXT DEFAULT '',
  "gpsLat"        NUMERIC,
  "gpsLng"        NUMERIC,
  resultat        TEXT DEFAULT 'sans_commande',
  "commandeId"    TEXT,
  notes           TEXT,
  "createdAt"     TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 7. fl_trips
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_trips (
  id                    TEXT PRIMARY KEY,
  numero                TEXT,
  date                  TEXT NOT NULL,
  "livreurId"           TEXT DEFAULT '',
  "livreurNom"          TEXT DEFAULT '',
  vehicule              TEXT DEFAULT '',
  "commandeIds"         JSONB DEFAULT '[]',
  statut                TEXT DEFAULT 'planifié',
  itineraire            JSONB DEFAULT '[]',
  "sequenceMode"        TEXT,
  "kmDepart"            NUMERIC,
  "kmArrivee"           NUMERIC,
  "kmTotal"             NUMERIC,
  "nbCaissesByArticle"  JSONB DEFAULT '{}',
  "caissesValidees"     BOOLEAN DEFAULT false,
  "kmDepartConfirme"    BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 8. fl_bons_livraison
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_bons_livraison (
  id                        TEXT PRIMARY KEY,
  date                      TEXT NOT NULL,
  "tripId"                  TEXT DEFAULT '',
  "commandeId"              TEXT DEFAULT '',
  "clientId"                TEXT,
  "clientNom"               TEXT DEFAULT '',
  secteur                   TEXT DEFAULT '',
  zone                      TEXT DEFAULT '',
  "livreurNom"              TEXT DEFAULT '',
  "prevendeurNom"           TEXT DEFAULT '',
  lignes                    JSONB DEFAULT '[]',
  "montantTotal"            NUMERIC DEFAULT 0,
  tva                       NUMERIC DEFAULT 0,
  "montantTTC"              NUMERIC DEFAULT 0,
  statut                    TEXT DEFAULT 'émis',
  "statutLivraison"         TEXT DEFAULT 'premier_passage',
  "motifRetour"             TEXT,
  "valideMagasinier"        BOOLEAN DEFAULT false,
  "heureLivraisonReelle"    TEXT,
  "heureEffective"          TEXT,
  "nbColis"                 NUMERIC,
  "nbCaisseGros"            NUMERIC DEFAULT 0,
  "nbCaisseDemi"            NUMERIC DEFAULT 0,
  "montantCaisses"          NUMERIC DEFAULT 0,
  "caissePricing"           JSONB,
  "fraisImpressionParFeuille" NUMERIC DEFAULT 0,
  "nbFeuilles"              NUMERIC DEFAULT 1,
  "fraisServiceParCaisse"   NUMERIC DEFAULT 0,
  -- Extra fields for full BL
  "clientIce"               TEXT,
  "clientModalitePaiement"  TEXT,
  "clientCreditSolde"       NUMERIC,
  "clientCreditAutorise"    BOOLEAN,
  notes                     TEXT,
  "montantEncaisse"         NUMERIC DEFAULT 0,
  -- GPS capture
  "gpsLatLivraison"         NUMERIC,
  "gpsLngLivraison"         NUMERIC,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 9. fl_retours
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_retours (
  id               TEXT PRIMARY KEY,
  date             TEXT NOT NULL,
  "tripId"         TEXT DEFAULT '',
  "livreurNom"     TEXT DEFAULT '',
  lignes           JSONB DEFAULT '[]',
  statut           TEXT DEFAULT 'en_attente',
  "validePar"      TEXT,
  "dateValidation" TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 10. fl_bons_achat
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_bons_achat (
  id                  TEXT PRIMARY KEY,
  date                TEXT NOT NULL,
  "acheteurId"        TEXT DEFAULT '',
  "acheteurNom"       TEXT DEFAULT '',
  "fournisseurId"     TEXT DEFAULT '',
  "fournisseurNom"    TEXT DEFAULT '',
  lignes              JSONB DEFAULT '[]',
  statut              TEXT DEFAULT 'brouillon',
  "emailDestinataire" TEXT DEFAULT '',
  "depotId"           TEXT,
  "depotNom"          TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 11. fl_purchase_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_purchase_orders (
  id                  TEXT PRIMARY KEY,
  date                TEXT NOT NULL,
  "articleId"         TEXT DEFAULT '',
  "articleNom"        TEXT DEFAULT '',
  "articleUnite"      TEXT DEFAULT 'kg',
  "fournisseurId"     TEXT DEFAULT '',
  "fournisseurNom"    TEXT DEFAULT '',
  "fournisseurEmail"  TEXT DEFAULT '',
  quantite            NUMERIC DEFAULT 0,
  "prixUnitaire"      NUMERIC DEFAULT 0,
  total               NUMERIC DEFAULT 0,
  statut              TEXT DEFAULT 'ouvert',
  notes               TEXT DEFAULT '',
  "createdBy"         TEXT DEFAULT '',
  "commandeQty"       NUMERIC,
  "stockQty"          NUMERIC,
  "retourQty"         NUMERIC,
  "montantPaye"       NUMERIC DEFAULT 0,
  "statutPaiement"    TEXT DEFAULT 'impaye',
  "datePaiement"      TEXT,
  "notePaiement"      TEXT,
  "depotId"           TEXT,
  "depotNom"          TEXT,
  "acheteurRefusals"  JSONB DEFAULT '[]',
  "totalAcheteurs"    NUMERIC,
  "daGenere"          BOOLEAN DEFAULT false,
  "daId"              TEXT,
  "genereAuto"        BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 12. fl_receptions
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_receptions (
  id               TEXT PRIMARY KEY,
  "dateReception"  TEXT NOT NULL,
  "bonAchatId"     TEXT,
  "fournisseurId"  TEXT DEFAULT '',
  "fournisseurNom" TEXT DEFAULT '',
  lignes           JSONB DEFAULT '[]',
  statut           TEXT DEFAULT 'en_cours',
  notes            TEXT,
  "receptionneParId"  TEXT,
  "receptionneParNom" TEXT,
  "depotId"        TEXT,
  "depotNom"       TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 13. fl_bons_preparation
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_bons_preparation (
  id              TEXT PRIMARY KEY,
  nom             TEXT DEFAULT '',
  date            TEXT NOT NULL,
  mode            TEXT DEFAULT 'par_trip',
  type            TEXT DEFAULT 'cross_dock',
  format          TEXT DEFAULT 'papier',
  "tripId"        TEXT,
  "clientIds"     JSONB DEFAULT '[]',
  "clientsInfo"   JSONB DEFAULT '[]',
  "sequenceMode"  TEXT,
  lignes          JSONB DEFAULT '[]',
  statut          TEXT DEFAULT 'brouillon',
  "createdBy"     TEXT DEFAULT '',
  "validatedAt"   TEXT,
  "validatedBy"   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 14. fl_transferts_stock
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_transferts_stock (
  id            TEXT PRIMARY KEY,
  date          TEXT NOT NULL,
  "articleId"   TEXT DEFAULT '',
  "articleNom"  TEXT DEFAULT '',
  quantite      NUMERIC DEFAULT 0,
  sens          TEXT DEFAULT 'conforme_vers_defect',
  motif         TEXT DEFAULT '',
  "operateurId" TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 15. fl_livreurs
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_livreurs (
  id          TEXT PRIMARY KEY,
  type        TEXT DEFAULT 'interne',
  nom         TEXT NOT NULL,
  telephone   TEXT,
  email       TEXT,
  vehicule    TEXT,
  permis      TEXT,
  actif       BOOLEAN DEFAULT true,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 16. fl_motifs_retour
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_motifs_retour (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  "labelAr"  TEXT,
  actif      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 17. fl_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_messages (
  id            TEXT PRIMARY KEY,
  "senderId"    TEXT DEFAULT '',
  "senderName"  TEXT DEFAULT '',
  role          TEXT DEFAULT '',
  text          TEXT DEFAULT '',
  "createdAt"   TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 18. fl_notices
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_notices (
  id           TEXT PRIMARY KEY,
  titre        TEXT DEFAULT '',
  contenu      TEXT DEFAULT '',
  "auteurId"   TEXT DEFAULT '',
  "auteurNom"  TEXT DEFAULT '',
  date         TEXT DEFAULT '',
  type         TEXT DEFAULT 'notice',
  statut       TEXT DEFAULT 'ouvert',
  destinataire TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 19. fl_prospects  (portail web)
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_prospects (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nom_societe          TEXT NOT NULL,
  nom_contact          TEXT NOT NULL,
  telephone            TEXT NOT NULL,
  whatsapp             TEXT,
  email                TEXT,
  adresse              TEXT,
  ville                TEXT,
  type_activite        TEXT,
  familles_souhaitees  JSONB DEFAULT '[]',
  volume_estime        TEXT,
  message              TEXT,
  statut               TEXT DEFAULT 'nouveau',
  source               TEXT,
  note_interne         TEXT,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 20. fl_commandes_web  (commandes portail)
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_commandes_web (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  numero            TEXT UNIQUE,
  nom_client        TEXT NOT NULL,
  telephone         TEXT NOT NULL,
  email             TEXT,
  adresse_livraison TEXT,
  lignes            JSONB DEFAULT '[]',
  montant_total     NUMERIC DEFAULT 0,
  date_souhaitee    TEXT,
  creneau           TEXT,
  instructions      TEXT,
  statut            TEXT DEFAULT 'recu',
  note_interne      TEXT,
  client_id         TEXT,
  prospect_id       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 21. fl_company_contacts  (coordonnées société)
-- ============================================================
CREATE TABLE IF NOT EXISTS fl_company_contacts (
  id                   TEXT PRIMARY KEY DEFAULT 'main',
  nom_societe          TEXT,
  slogan               TEXT,
  adresse_ligne1       TEXT,
  adresse_ligne2       TEXT,
  code_postal          TEXT,
  ville                TEXT,
  pays                 TEXT DEFAULT 'Maroc',
  tel_principal        TEXT,
  tel_secondaire       TEXT,
  tel_urgence          TEXT,
  whatsapp_principal   TEXT,
  whatsapp_commercial  TEXT,
  whatsapp_livraison   TEXT,
  email_principal      TEXT,
  email_commercial     TEXT,
  email_comptabilite   TEXT,
  email_rh             TEXT,
  instagram            TEXT,
  facebook             TEXT,
  linkedin             TEXT,
  tiktok               TEXT,
  horaires_ouverture   TEXT,
  horaires_livraison   TEXT,
  zone_livraison       TEXT,
  ice                  TEXT,
  rc                   TEXT,
  if_fiscal            TEXT,
  tp                   TEXT,
  cnss                 TEXT,
  gps_lat              NUMERIC,
  gps_lng              NUMERIC,
  logo_url             TEXT,
  couleur_primaire     TEXT DEFAULT '#1a4f2a',
  updated_at           TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Vue Marketplace catalogue (pour le portail web)
-- ============================================================
CREATE OR REPLACE VIEW v_marketplace_catalogue AS
SELECT
  id,
  nom,
  "nomAr"                AS nom_ar,
  famille,
  unite,
  photo,
  "marketplaceDescription"  AS description,
  statut_web,
  visible_web,
  promo_active,
  promo_taux,
  promo_label,
  promo_fin,
  criteres_qualite,
  tags,
  position_catalogue,
  "marketplacePrixPublic"   AS prix,
  "marketplacePrixPublic"   AS prix_public,
  CASE WHEN promo_active THEN ROUND("marketplacePrixPublic"::NUMERIC * (1 - promo_taux / 100.0), 2) END AS prix_promo,
  "stockDisponible"         AS stock_actuel,
  "shelfLifeJours"          AS dlc_jours,
  updated_at
FROM fl_articles
WHERE visible_web = true
ORDER BY position_catalogue ASC, nom ASC;

-- ============================================================
-- Row Level Security — permettre lectures anon + écritures auth
-- ============================================================

-- Active RLS sur toutes les tables
ALTER TABLE fl_users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_articles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_fournisseurs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_commandes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_visites           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_trips             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_bons_livraison    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_retours           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_bons_achat        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_purchase_orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_receptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_bons_preparation  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_transferts_stock  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_livreurs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_motifs_retour     ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_notices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_prospects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_commandes_web     ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_company_contacts  ENABLE ROW LEVEL SECURITY;

-- Policies : accès total via anon key (FreshLink gère ses propres auth)
-- Chaque table : allow all pour anon et authenticated

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'fl_users','fl_clients','fl_articles','fl_fournisseurs',
    'fl_commandes','fl_visites','fl_trips','fl_bons_livraison',
    'fl_retours','fl_bons_achat','fl_purchase_orders','fl_receptions',
    'fl_bons_preparation','fl_transferts_stock','fl_livreurs',
    'fl_motifs_retour','fl_messages','fl_notices',
    'fl_prospects','fl_commandes_web','fl_company_contacts'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    -- DROP old policies if they exist
    EXECUTE format('DROP POLICY IF EXISTS "anon_all" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "auth_all" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "allow_all" ON %I', tbl);
    -- CREATE permissive policies
    EXECUTE format(
      'CREATE POLICY "allow_all" ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
      tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- Realtime — activer sur toutes les tables ERP
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE fl_users;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_clients;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_articles;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_fournisseurs;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_commandes;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_visites;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_trips;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_bons_livraison;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_retours;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_bons_achat;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_purchase_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_receptions;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_bons_preparation;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_transferts_stock;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_livreurs;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_motifs_retour;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_notices;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_prospects;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_commandes_web;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_company_contacts;

-- ============================================================
-- Trigger updated_at automatique
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
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
    'fl_users','fl_clients','fl_articles','fl_fournisseurs',
    'fl_commandes','fl_visites','fl_trips','fl_bons_livraison',
    'fl_retours','fl_bons_achat','fl_purchase_orders','fl_receptions',
    'fl_bons_preparation','fl_livreurs','fl_notices',
    'fl_prospects','fl_commandes_web','fl_company_contacts'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- Numéro auto pour fl_commandes_web
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS commandes_web_seq START 1001;

CREATE OR REPLACE FUNCTION set_commande_web_numero()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := 'CW-' || LPAD(nextval('commandes_web_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_commande_web_numero ON fl_commandes_web;
CREATE TRIGGER trg_commande_web_numero
  BEFORE INSERT ON fl_commandes_web
  FOR EACH ROW EXECUTE FUNCTION set_commande_web_numero();

-- ============================================================
-- Données initiales fl_company_contacts
-- ============================================================
INSERT INTO fl_company_contacts (id, nom_societe, pays, couleur_primaire)
VALUES ('main', 'Empire Fresh', 'Maroc', '#1a4f2a')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Vérification finale
-- ============================================================
SELECT
  schemaname,
  tablename,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = tablename) AS nb_colonnes
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'fl_%'
ORDER BY tablename;
