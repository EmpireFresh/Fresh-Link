-- ============================================================
-- FreshLink Empire Fresh — Schema Realtime Sync v1.0
-- Projet : jwdrwapuetqoqnankgma
-- Exécuter dans Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================
-- Ce script complète le schema v3 avec :
--   • Extensions articles pour la synchronisation web
--   • Table prospects (demandes comptes depuis le site)
--   • Table documents (Devis, Contrats CHR, BL archivés)
--   • Table company_contacts (coordonnées publiques)
--   • Table web_integration (config API site web)
--   • Vue catalogue pour l'API publique
--   • Realtime activé sur les tables clés
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════
-- 1. MISE À JOUR TABLE fl_articles — Champs web & qualité
-- ═══════════════════════════════════════════════════════════════

-- Statut affiché sur le site client
ALTER TABLE fl_articles
  ADD COLUMN IF NOT EXISTS statut_web        TEXT    DEFAULT 'disponible'
    CHECK (statut_web IN ('disponible','rupture','liquidation','bientot')),
  ADD COLUMN IF NOT EXISTS visible_web       BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS promo_active      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS promo_taux        DECIMAL(5,2) DEFAULT 0,   -- % de remise
  ADD COLUMN IF NOT EXISTS promo_label       TEXT,                     -- "Soldes", "Offre spéciale"…
  ADD COLUMN IF NOT EXISTS promo_fin         DATE,                     -- Date fin promo
  ADD COLUMN IF NOT EXISTS criteres_qualite  JSONB   DEFAULT '{}',
  -- Ex: {"fraicheur":"J+2","calibre":"18-22mm","origine":"Maroc","label":"AB","conditionnement":"Caisse 5kg"}
  ADD COLUMN IF NOT EXISTS prix_public       DECIMAL(10,3) DEFAULT 0,  -- Prix affiché site web
  ADD COLUMN IF NOT EXISTS tags              TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS position_catalogue INTEGER DEFAULT 0;       -- Ordre d'affichage

-- ═══════════════════════════════════════════════════════════════
-- 2. TABLE fl_prospects — Demandes de compte depuis le site
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fl_prospects (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  -- Identité
  nom_societe     TEXT NOT NULL,
  nom_contact     TEXT NOT NULL,
  telephone       TEXT NOT NULL,
  whatsapp        TEXT,
  email           TEXT,
  adresse         TEXT,
  ville           TEXT DEFAULT 'Casablanca',
  -- Type de client
  type_activite   TEXT DEFAULT 'restaurant'
    CHECK (type_activite IN ('restaurant','hotel','traiteur','epicerie','supermarche','autre')),
  nb_couverts     INTEGER,          -- Pour restaurants
  nb_chambres     INTEGER,          -- Pour hôtels
  -- Besoin
  familles_souhaitees TEXT[],       -- ['Légumes','Fruits','Herbes']
  volume_estime   TEXT,             -- "50-100 kg/semaine"
  message         TEXT,
  -- Traitement
  statut          TEXT DEFAULT 'nouveau'
    CHECK (statut IN ('nouveau','contacte','valide','refuse','attente')),
  traite_par      TEXT,
  note_interne    TEXT,
  client_id       TEXT REFERENCES fl_clients(id),  -- Rempli à la validation
  -- Meta
  source          TEXT DEFAULT 'site_web',         -- 'site_web','whatsapp','appel','direct'
  ip_address      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 3. TABLE fl_documents — Devis, Contrats CHR, BL archivés
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fl_documents (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  numero          TEXT UNIQUE NOT NULL,
  type_doc        TEXT NOT NULL
    CHECK (type_doc IN ('devis','contrat','bl_archive','facture','avoir','bon_commande')),
  -- Références
  client_id       TEXT REFERENCES fl_clients(id),
  client_nom      TEXT NOT NULL,
  commande_id     TEXT REFERENCES fl_commandes(id),
  bl_id           TEXT REFERENCES fl_bons_livraison(id),
  -- Contenu
  lignes          JSONB DEFAULT '[]',
  -- Ex: [{"article":"Tomates","qte":50,"unite":"kg","prix_u":3.5,"montant":175}]
  montant_ht      DECIMAL(12,2) DEFAULT 0,
  tva_pct         DECIMAL(5,2)  DEFAULT 0,
  montant_tva     DECIMAL(12,2) DEFAULT 0,
  montant_ttc     DECIMAL(12,2) DEFAULT 0,
  remise_pct      DECIMAL(5,2)  DEFAULT 0,
  montant_net     DECIMAL(12,2) DEFAULT 0,
  -- Dates & validité
  date_doc        DATE DEFAULT CURRENT_DATE,
  date_validite   DATE,           -- Validité devis (30j par défaut)
  date_debut      DATE,           -- Début contrat
  date_fin        DATE,           -- Fin contrat
  -- Clauses contractuelles (CHR/HORECA)
  conditions_paiement TEXT DEFAULT '30 jours fin de mois',
  delai_livraison TEXT DEFAULT '24h',
  frequence_livraison TEXT,       -- "Lundi, Mercredi, Vendredi"
  clauses_specifiques TEXT,       -- Clauses particulières pour contrats
  -- Statut workflow
  statut          TEXT DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon','envoye','accepte','refuse','transforme','expire','annule')),
  transforme_en   TEXT,           -- ID du document résultant (devis → contrat)
  -- Signatures & validation
  signe_client    BOOLEAN DEFAULT FALSE,
  date_signature  TIMESTAMPTZ,
  signature_url   TEXT,
  -- Fichier PDF
  pdf_url         TEXT,
  -- Méta
  created_by      TEXT,
  validated_by    TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-numérotation documents
CREATE OR REPLACE FUNCTION generate_document_number(p_type TEXT)
RETURNS TEXT AS $$
DECLARE
  prefix  TEXT;
  year_s  TEXT := TO_CHAR(NOW(), 'YYYY');
  seq     INTEGER;
BEGIN
  prefix := CASE p_type
    WHEN 'devis'        THEN 'DEV'
    WHEN 'contrat'      THEN 'CTR'
    WHEN 'bl_archive'   THEN 'BLA'
    WHEN 'facture'      THEN 'FAC'
    WHEN 'avoir'        THEN 'AVO'
    WHEN 'bon_commande' THEN 'BC'
    ELSE 'DOC'
  END;
  SELECT COUNT(*) + 1 INTO seq
  FROM fl_documents
  WHERE type_doc = p_type AND DATE_PART('year', created_at) = DATE_PART('year', NOW());
  RETURN prefix || '-' || year_s || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- 4. TABLE fl_company_contacts — Coordonnées publiques
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fl_company_contacts (
  id              TEXT PRIMARY KEY DEFAULT 'main',
  -- Identité entreprise
  nom_societe     TEXT DEFAULT 'Empire Fresh',
  slogan          TEXT DEFAULT 'Fruits & Légumes Premium',
  -- Adresse postale
  adresse_ligne1  TEXT,
  adresse_ligne2  TEXT,
  code_postal     TEXT,
  ville           TEXT DEFAULT 'Casablanca',
  pays            TEXT DEFAULT 'Maroc',
  -- Téléphones
  tel_principal   TEXT,       -- Numéro principal bureau
  tel_secondaire  TEXT,       -- Numéro secondaire
  tel_urgence     TEXT,       -- Numéro urgences / garde
  -- WhatsApp
  whatsapp_principal  TEXT,   -- WhatsApp commandes clients
  whatsapp_commercial TEXT,   -- WhatsApp équipe commerciale
  whatsapp_livraison  TEXT,   -- WhatsApp suivi livraisons
  -- Emails
  email_principal TEXT,       -- contact@empire-fresh.co.site
  email_commercial TEXT,      -- commercial@empire-fresh.co.site
  email_comptabilite TEXT,    -- compta@empire-fresh.co.site
  email_rh        TEXT,
  -- Réseaux sociaux
  instagram       TEXT,
  facebook        TEXT,
  linkedin        TEXT,
  tiktok          TEXT,
  -- Horaires
  horaires_ouverture TEXT DEFAULT 'Lun-Sam : 06h00 - 20h00',
  horaires_livraison TEXT DEFAULT 'Lun-Sam : 07h00 - 18h00',
  zone_livraison  TEXT DEFAULT 'Casablanca et région',
  -- Identifiants légaux
  ice             TEXT,
  rc              TEXT,
  if_fiscal       TEXT,
  tp              TEXT,
  cnss            TEXT,
  -- Coordonnées GPS siège
  gps_lat         DECIMAL(10,6),
  gps_lng         DECIMAL(10,6),
  -- Logo & branding
  logo_url        TEXT,
  couleur_primaire TEXT DEFAULT '#1a4f2a',
  -- Meta
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_by      TEXT
);

-- Données initiales
INSERT INTO fl_company_contacts (id, nom_societe)
VALUES ('main', 'Empire Fresh')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 5. TABLE fl_web_integration — Config API site client
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fl_web_integration (
  id              TEXT PRIMARY KEY DEFAULT 'main',
  enabled         BOOLEAN DEFAULT TRUE,
  -- Clés d'accès
  api_key         TEXT DEFAULT gen_random_uuid()::TEXT,
  allowed_origins TEXT[] DEFAULT ARRAY['https://empire-fresh.netlify.app'],
  -- Accès catalogue
  catalogue_public BOOLEAN DEFAULT TRUE,
  commandes_public BOOLEAN DEFAULT FALSE,
  -- Fonctionnalités activées
  show_prices     BOOLEAN DEFAULT TRUE,
  show_promos     BOOLEAN DEFAULT TRUE,
  show_qualite    BOOLEAN DEFAULT TRUE,
  show_stock_level BOOLEAN DEFAULT FALSE,  -- Masquer les quantités exactes
  -- Messages affichés sur le site
  message_rupture TEXT DEFAULT 'Article temporairement indisponible',
  message_ferme   TEXT DEFAULT 'Commandes ouvertes du Lun au Sam, 06h-18h',
  -- Panier & commandes
  panier_enabled  BOOLEAN DEFAULT TRUE,
  commande_min    DECIMAL(10,2) DEFAULT 200,  -- Montant minimum commande
  -- Realtime
  realtime_enabled BOOLEAN DEFAULT TRUE,
  -- Meta
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_by      TEXT
);

-- Config initiale
INSERT INTO fl_web_integration (id)
VALUES ('main')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 6. TABLE fl_commandes_web — Commandes depuis le site client
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fl_commandes_web (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  numero          TEXT UNIQUE NOT NULL,
  -- Identité client (peut ne pas avoir de compte)
  client_id       TEXT REFERENCES fl_clients(id),  -- NULL si prospect
  prospect_id     TEXT REFERENCES fl_prospects(id),
  nom_client      TEXT NOT NULL,
  telephone       TEXT NOT NULL,
  email           TEXT,
  adresse_livraison TEXT,
  -- Panier
  lignes          JSONB DEFAULT '[]',
  -- Ex: [{"article_id":"...","nom":"Tomates","qte":5,"unite":"kg","prix_u":3.5,"montant":17.5}]
  montant_total   DECIMAL(12,2) DEFAULT 0,
  -- Livraison
  date_souhaitee  DATE,
  creneau         TEXT,          -- 'matin' | 'apres-midi' | 'soir'
  instructions    TEXT,
  -- Statut
  statut          TEXT DEFAULT 'nouveau'
    CHECK (statut IN ('nouveau','confirme','en_preparation','livre','annule','rembourse')),
  -- Traitement
  commande_id     TEXT REFERENCES fl_commandes(id),  -- Rempli à la confirmation
  traite_par      TEXT,
  note_interne    TEXT,
  -- Meta
  source          TEXT DEFAULT 'site_web',
  ip_address      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-numérotation commandes web
CREATE OR REPLACE FUNCTION generate_web_order_number()
RETURNS TEXT AS $$
DECLARE
  today TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  seq   INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO seq
  FROM fl_commandes_web
  WHERE numero LIKE 'WEB-' || today || '-%';
  RETURN 'WEB-' || today || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- 7. VUE CATALOGUE PUBLIC — Utilisée par l'API /ext/catalogue
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_marketplace_catalogue AS
SELECT
  a.id,
  a.nom,
  a.nom_ar,
  a.famille,
  a.unite,
  a.photo,
  a.description,
  a.statut_web,
  a.visible_web,
  a.promo_active,
  a.promo_taux,
  a.promo_label,
  a.promo_fin,
  a.criteres_qualite,
  a.tags,
  a.position_catalogue,
  -- Prix public (ou calculé si non défini)
  CASE
    WHEN a.prix_public > 0 THEN a.prix_public
    WHEN a.pv_methode = 'pourcentage' THEN ROUND(a.prix_achat * (1 + a.pv_valeur / 100), 2)
    WHEN a.pv_methode = 'montant'     THEN ROUND(a.prix_achat + a.pv_valeur, 2)
    ELSE a.pv_valeur
  END AS prix,
  -- Prix après promo
  CASE
    WHEN a.promo_active AND a.promo_taux > 0 THEN
      ROUND(
        CASE
          WHEN a.prix_public > 0 THEN a.prix_public
          WHEN a.pv_methode = 'pourcentage' THEN a.prix_achat * (1 + a.pv_valeur / 100)
          WHEN a.pv_methode = 'montant'     THEN a.prix_achat + a.pv_valeur
          ELSE a.pv_valeur
        END * (1 - a.promo_taux / 100), 2)
    ELSE NULL
  END AS prix_promo,
  a.stock_actuel,
  a.dlc_jours,
  a.updated_at
FROM fl_articles a
WHERE a.actif = TRUE
  AND a.visible_web = TRUE
ORDER BY a.position_catalogue ASC, a.famille, a.nom;

-- ═══════════════════════════════════════════════════════════════
-- 8. ROW LEVEL SECURITY — Nouvelles tables
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE fl_prospects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_company_contacts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_web_integration     ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_commandes_web       ENABLE ROW LEVEL SECURITY;

-- Lecture publique (anon) — catalogue et contacts
CREATE POLICY "public_read_company_contacts"
  ON fl_company_contacts FOR SELECT TO anon USING (TRUE);

CREATE POLICY "public_read_web_integration"
  ON fl_web_integration FOR SELECT TO anon USING (TRUE);

-- Accès complet pour anon (l'app gère ses propres auth)
CREATE POLICY "allow_all_prospects"
  ON fl_prospects FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "allow_all_documents"
  ON fl_documents FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "allow_all_company_contacts"
  ON fl_company_contacts FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "allow_all_web_integration"
  ON fl_web_integration FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "allow_all_commandes_web"
  ON fl_commandes_web FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

-- ═══════════════════════════════════════════════════════════════
-- 9. INDEXES — Performance
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_articles_statut_web    ON fl_articles(statut_web);
CREATE INDEX IF NOT EXISTS idx_articles_visible_web   ON fl_articles(visible_web);
CREATE INDEX IF NOT EXISTS idx_articles_promo         ON fl_articles(promo_active);
CREATE INDEX IF NOT EXISTS idx_articles_famille_web   ON fl_articles(famille, visible_web);
CREATE INDEX IF NOT EXISTS idx_prospects_statut       ON fl_prospects(statut);
CREATE INDEX IF NOT EXISTS idx_prospects_created      ON fl_prospects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_type         ON fl_documents(type_doc);
CREATE INDEX IF NOT EXISTS idx_documents_client       ON fl_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_statut       ON fl_documents(statut);
CREATE INDEX IF NOT EXISTS idx_commandes_web_statut   ON fl_commandes_web(statut);
CREATE INDEX IF NOT EXISTS idx_commandes_web_created  ON fl_commandes_web(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 10. TRIGGERS updated_at — Nouvelles tables
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_prospects_updated_at
  BEFORE UPDATE ON fl_prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_documents_updated_at
  BEFORE UPDATE ON fl_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_commandes_web_updated_at
  BEFORE UPDATE ON fl_commandes_web
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 11. REALTIME — Activer la diffusion en temps réel
-- ═══════════════════════════════════════════════════════════════
-- Activer Realtime sur les tables critiques :
-- Dashboard → Database → Replication → supabase_realtime → Tables

ALTER PUBLICATION supabase_realtime ADD TABLE fl_articles;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_prospects;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_commandes_web;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_company_contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE fl_web_integration;

-- ═══════════════════════════════════════════════════════════════
-- 12. STORAGE BUCKETS (à créer dans Storage Dashboard)
-- ═══════════════════════════════════════════════════════════════
-- Créer ces buckets dans Supabase Storage :
-- 1. "freshlink-media"  — Public: OUI  (photos articles)
-- 2. "fl-documents"     — Public: NON  (PDF devis, contrats)
-- 3. "fl-signatures"    — Public: NON  (signatures BL)

-- ═══════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════
SELECT 'FreshLink Realtime Sync Schema v1.0 — installé avec succès !' AS status;
