-- ============================================================
-- FreshLink Empire Fresh v3.0 — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable RLS but allow authenticated users full access
-- IMPORTANT: Configure auth in Supabase dashboard separately

-- ── EXTENSIONS ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── CLEANUP (for re-runs) ─────────────────────────────────────
DROP TABLE IF EXISTS fl_salaries CASCADE;
DROP TABLE IF EXISTS fl_users CASCADE;
DROP TABLE IF EXISTS fl_clients CASCADE;
DROP TABLE IF EXISTS fl_articles CASCADE;
DROP TABLE IF EXISTS fl_commandes CASCADE;
DROP TABLE IF EXISTS fl_bons_achat CASCADE;
DROP TABLE IF EXISTS fl_bons_livraison CASCADE;
DROP TABLE IF EXISTS fl_bons_preparation CASCADE;
DROP TABLE IF EXISTS fl_retours CASCADE;
DROP TABLE IF EXISTS fl_depots CASCADE;
DROP TABLE IF EXISTS fl_fournisseurs CASCADE;
DROP TABLE IF EXISTS fl_transporteurs CASCADE;
DROP TABLE IF EXISTS fl_trips CASCADE;
DROP TABLE IF EXISTS fl_stock CASCADE;
DROP TABLE IF EXISTS fl_payments CASCADE;
DROP TABLE IF EXISTS fl_paiement_cycles CASCADE;
DROP TABLE IF EXISTS fl_rh_notifications CASCADE;
DROP TABLE IF EXISTS fl_hr_docs CASCADE;
DROP TABLE IF EXISTS fl_feedbacks CASCADE;
DROP TABLE IF EXISTS fl_notifications CASCADE;
DROP TABLE IF EXISTS fl_pricing CASCADE;
DROP TABLE IF EXISTS fl_purchase_orders CASCADE;

-- ── DEPOTS ───────────────────────────────────────────────────
CREATE TABLE fl_depots (
  id              TEXT PRIMARY KEY,
  nom             TEXT NOT NULL,
  adresse         TEXT,
  ville           TEXT DEFAULT 'Casablanca',
  actif           BOOLEAN DEFAULT TRUE,
  responsable_nom TEXT,
  notes           TEXT,
  gps_lat         DECIMAL(10,6),
  gps_lng         DECIMAL(10,6),
  gps_adresse_complete TEXT,
  circuit_nom     TEXT,
  circuit_ordre   INTEGER DEFAULT 1,
  zone_couverte   TEXT,
  heure_ouverture TEXT DEFAULT '06:00',
  heure_fermeture TEXT DEFAULT '22:00',
  capacite_kg     INTEGER,
  telephone       TEXT,
  email           TEXT,
  type_depot      TEXT DEFAULT 'secondaire' CHECK (type_depot IN ('principal','secondaire','transit','froid')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO fl_depots (id, nom, ville, actif, type_depot, responsable_nom)
VALUES ('DEPOT_MAIN', 'Dépôt Principal Empire Fresh', 'Casablanca', TRUE, 'principal', 'Jawad');

-- ── UTILISATEURS ─────────────────────────────────────────────
CREATE TABLE fl_users (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  email             TEXT UNIQUE,
  password          TEXT,
  password_mobile   TEXT,
  password_bo       TEXT,
  role              TEXT NOT NULL DEFAULT 'prevendeur',
  access_type       TEXT DEFAULT 'mobile' CHECK (access_type IN ('mobile','backoffice','both')),
  secteur           TEXT,
  phone             TEXT,
  actif             BOOLEAN DEFAULT TRUE,
  depot_id          TEXT REFERENCES fl_depots(id),
  civilite          TEXT DEFAULT 'M.',
  photo_url         TEXT,
  -- Permissions
  can_view_achat        BOOLEAN DEFAULT FALSE,
  can_view_commercial   BOOLEAN DEFAULT FALSE,
  can_view_logistique   BOOLEAN DEFAULT FALSE,
  can_view_stock        BOOLEAN DEFAULT FALSE,
  can_view_cash         BOOLEAN DEFAULT FALSE,
  can_view_finance      BOOLEAN DEFAULT FALSE,
  can_view_recap        BOOLEAN DEFAULT FALSE,
  can_view_database     BOOLEAN DEFAULT FALSE,
  can_view_rh           BOOLEAN DEFAULT FALSE,
  can_view_external     BOOLEAN DEFAULT FALSE,
  can_create_commande_bo BOOLEAN DEFAULT FALSE,
  -- Granular permissions (JSON)
  granular_perms    JSONB DEFAULT '{}',
  -- Notifications
  notif_achat       BOOLEAN DEFAULT FALSE,
  notif_commercial  BOOLEAN DEFAULT FALSE,
  notif_livraison   BOOLEAN DEFAULT FALSE,
  notif_recap       BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── CLIENTS ──────────────────────────────────────────────────
CREATE TABLE fl_clients (
  id              TEXT PRIMARY KEY,
  nom             TEXT NOT NULL,
  type            TEXT DEFAULT 'epicerie',
  secteur         TEXT,
  zone            TEXT,
  taille          TEXT,
  type_produits   TEXT,
  rotation        TEXT,
  telephone       TEXT,
  email           TEXT,
  adresse         TEXT,
  gps_lat         DECIMAL(10,6),
  gps_lng         DECIMAL(10,6),
  code_client     TEXT,
  plafond_credit  DECIMAL(12,2) DEFAULT 0,
  solde_credit    DECIMAL(12,2) DEFAULT 0,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  actif           BOOLEAN DEFAULT TRUE,
  notes           TEXT,
  langue          TEXT DEFAULT 'fr'
);

-- ── ARTICLES ─────────────────────────────────────────────────
CREATE TABLE fl_articles (
  id              TEXT PRIMARY KEY,
  nom             TEXT NOT NULL,
  nom_ar          TEXT,
  famille         TEXT,
  unite           TEXT DEFAULT 'kg',
  prix_achat      DECIMAL(10,3) DEFAULT 0,
  pv_methode      TEXT DEFAULT 'pourcentage',
  pv_valeur       DECIMAL(10,3) DEFAULT 60,
  photo           TEXT,
  actif           BOOLEAN DEFAULT TRUE,
  code_article    TEXT,
  description     TEXT,
  dlc_jours       INTEGER DEFAULT 3,
  stock_min       DECIMAL(10,3) DEFAULT 0,
  stock_actuel    DECIMAL(10,3) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── FOURNISSEURS ─────────────────────────────────────────────
CREATE TABLE fl_fournisseurs (
  id              TEXT PRIMARY KEY,
  nom             TEXT NOT NULL,
  telephone       TEXT,
  email           TEXT,
  adresse         TEXT,
  ville           TEXT,
  region          TEXT,
  gps_lat         DECIMAL(10,6),
  gps_lng         DECIMAL(10,6),
  type_fournisseur TEXT DEFAULT 'grossiste',
  produits_cles   TEXT[],
  note_qualite    INTEGER DEFAULT 8,
  credit_actuel   DECIMAL(12,2) DEFAULT 0,
  plafond_credit  DECIMAL(12,2) DEFAULT 0,
  actif           BOOLEAN DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── TRANSPORTEURS ────────────────────────────────────────────
CREATE TABLE fl_transporteurs (
  id              TEXT PRIMARY KEY,
  nom             TEXT NOT NULL,
  telephone       TEXT,
  email           TEXT,
  type_vehicule   TEXT,
  immatriculation TEXT,
  capacite_kg     DECIMAL(10,2),
  tarif_km        DECIMAL(8,3) DEFAULT 0.45,
  tarif_caisse    DECIMAL(8,3) DEFAULT 0.80,
  -- Auto-entrepreneur fields
  is_auto_entrepreneur BOOLEAN DEFAULT FALSE,
  rc_number       TEXT,
  ice_number      TEXT,
  rib_bancaire    TEXT,
  banque          TEXT,
  -- Driver documents (URLs to storage)
  photo_conducteur TEXT,
  scan_permis     TEXT,
  scan_carte_grise TEXT,
  scan_cin        TEXT,
  date_expiry_permis DATE,
  date_expiry_assurance DATE,
  -- Link to internal user
  user_id         TEXT REFERENCES fl_users(id),
  actif           BOOLEAN DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── COMMANDES ────────────────────────────────────────────────
CREATE TABLE fl_commandes (
  id              TEXT PRIMARY KEY,
  numero          TEXT UNIQUE NOT NULL,
  client_id       TEXT REFERENCES fl_clients(id),
  client_nom      TEXT,
  date_commande   DATE NOT NULL DEFAULT CURRENT_DATE,
  date_livraison  DATE,
  statut          TEXT DEFAULT 'brouillon',
  lignes          JSONB DEFAULT '[]',
  montant_ht      DECIMAL(12,2) DEFAULT 0,
  remise_pct      DECIMAL(5,2) DEFAULT 0,
  montant_net     DECIMAL(12,2) DEFAULT 0,
  created_by      TEXT,
  validated_by    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  depot_id        TEXT REFERENCES fl_depots(id),
  notes           TEXT,
  secteur         TEXT,
  zone            TEXT
);

-- ── BONS D'ACHAT ─────────────────────────────────────────────
CREATE TABLE fl_bons_achat (
  id              TEXT PRIMARY KEY,
  numero          TEXT UNIQUE NOT NULL,
  fournisseur_id  TEXT REFERENCES fl_fournisseurs(id),
  fournisseur_nom TEXT,
  date_achat      DATE NOT NULL DEFAULT CURRENT_DATE,
  lignes          JSONB DEFAULT '[]',
  montant_total   DECIMAL(12,2) DEFAULT 0,
  statut          TEXT DEFAULT 'brouillon',
  created_by      TEXT,
  validated_by    TEXT,
  depot_id        TEXT REFERENCES fl_depots(id),
  marche          TEXT,
  gps_lat         DECIMAL(10,6),
  gps_lng         DECIMAL(10,6),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  notes           TEXT
);

-- ── BONS DE LIVRAISON ────────────────────────────────────────
CREATE TABLE fl_bons_livraison (
  id              TEXT PRIMARY KEY,
  numero          TEXT UNIQUE NOT NULL,  -- Auto-generated: BL-YYYYMMDD-XXXX
  commande_id     TEXT REFERENCES fl_commandes(id),
  client_id       TEXT REFERENCES fl_clients(id),
  client_nom      TEXT,
  livreur_id      TEXT REFERENCES fl_users(id),
  livreur_nom     TEXT,
  transporteur_id TEXT REFERENCES fl_transporteurs(id),
  trip_id         TEXT,
  date_livraison  DATE NOT NULL DEFAULT CURRENT_DATE,
  heure_livraison TEXT,
  heure_livraison_reelle TEXT,
  lignes          JSONB DEFAULT '[]',
  montant_total   DECIMAL(12,2) DEFAULT 0,
  montant_encaisse DECIMAL(12,2) DEFAULT 0,
  statut          TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente','en_cours','livre','partiel','retour','annule')),
  signature_url   TEXT,
  photo_preuve    TEXT,
  gps_lat_livraison DECIMAL(10,6),
  gps_lng_livraison DECIMAL(10,6),
  created_by      TEXT,
  validated_by    TEXT,
  rectifie_par    TEXT,
  rectifie_at     TIMESTAMPTZ,
  motif_rectification TEXT,
  depot_id        TEXT REFERENCES fl_depots(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  notes           TEXT
);

-- Auto-increment BL number function
CREATE OR REPLACE FUNCTION generate_bl_number()
RETURNS TEXT AS $$
DECLARE
  today TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  seq   INTEGER;
  num   TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO seq
  FROM fl_bons_livraison
  WHERE numero LIKE 'BL-' || today || '-%';
  num := 'BL-' || today || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN num;
END;
$$ LANGUAGE plpgsql;

-- ── BONS DE PREPARATION ──────────────────────────────────────
CREATE TABLE fl_bons_preparation (
  id              TEXT PRIMARY KEY,
  numero          TEXT UNIQUE NOT NULL,
  commande_id     TEXT REFERENCES fl_commandes(id),
  client_id       TEXT REFERENCES fl_clients(id),
  client_nom      TEXT,
  lignes          JSONB DEFAULT '[]',
  statut          TEXT DEFAULT 'a_preparer',
  prepare_par     TEXT,
  verifie_par     TEXT,
  date_preparation DATE DEFAULT CURRENT_DATE,
  depot_id        TEXT REFERENCES fl_depots(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── RETOURS ──────────────────────────────────────────────────
CREATE TABLE fl_retours (
  id              TEXT PRIMARY KEY,
  numero          TEXT UNIQUE NOT NULL,
  bl_id           TEXT REFERENCES fl_bons_livraison(id),
  client_id       TEXT REFERENCES fl_clients(id),
  client_nom      TEXT,
  date_retour     DATE NOT NULL DEFAULT CURRENT_DATE,
  lignes          JSONB DEFAULT '[]',
  montant_retour  DECIMAL(12,2) DEFAULT 0,
  motif           TEXT,
  statut          TEXT DEFAULT 'en_attente',
  photo_retour    TEXT,
  created_by      TEXT,
  depot_id        TEXT REFERENCES fl_depots(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── STOCK ────────────────────────────────────────────────────
CREATE TABLE fl_stock (
  id              TEXT PRIMARY KEY,
  article_id      TEXT REFERENCES fl_articles(id),
  article_nom     TEXT,
  depot_id        TEXT REFERENCES fl_depots(id) DEFAULT 'DEPOT_MAIN',
  quantite        DECIMAL(12,3) DEFAULT 0,
  lot_numero      TEXT,
  date_entree     DATE DEFAULT CURRENT_DATE,
  date_dlc        DATE,
  prix_revient    DECIMAL(10,3) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── TRIPS (TOURNÉES) ─────────────────────────────────────────
CREATE TABLE fl_trips (
  id              TEXT PRIMARY KEY,
  numero          TEXT UNIQUE NOT NULL,
  livreur_id      TEXT REFERENCES fl_users(id),
  livreur_nom     TEXT,
  transporteur_id TEXT REFERENCES fl_transporteurs(id),
  vehicule        TEXT,
  date_trip       DATE NOT NULL DEFAULT CURRENT_DATE,
  heure_depart    TEXT,
  heure_retour    TEXT,
  statut          TEXT DEFAULT 'planifie',
  bls_ids         TEXT[],
  km_total        DECIMAL(10,2) DEFAULT 0,
  km_vide         DECIMAL(10,2) DEFAULT 0,
  nb_clients      INTEGER DEFAULT 0,
  nb_caisses      INTEGER DEFAULT 0,
  montant_total   DECIMAL(12,2) DEFAULT 0,
  paie_livreur    DECIMAL(10,2) DEFAULT 0,
  depot_id        TEXT REFERENCES fl_depots(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  notes           TEXT
);

-- ── PAIEMENTS ────────────────────────────────────────────────
CREATE TABLE fl_payments (
  id              TEXT PRIMARY KEY,
  bl_id           TEXT REFERENCES fl_bons_livraison(id),
  client_id       TEXT REFERENCES fl_clients(id),
  client_nom      TEXT,
  montant         DECIMAL(12,2) NOT NULL,
  mode_paiement   TEXT DEFAULT 'especes',
  date_paiement   TIMESTAMPTZ DEFAULT NOW(),
  encaisse_par    TEXT,
  valide_par      TEXT,
  reference       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── SALARIÉS ─────────────────────────────────────────────────
CREATE TABLE fl_salaries (
  id              TEXT PRIMARY KEY,
  matricule       TEXT UNIQUE NOT NULL,  -- Auto-generated: FLP-YYYY-ROLE-NNN
  nom             TEXT NOT NULL,
  prenom          TEXT NOT NULL,
  civilite        TEXT DEFAULT 'M.',
  poste           TEXT NOT NULL,
  departement     TEXT,
  telephone       TEXT,
  email           TEXT,
  adresse         TEXT,
  ville           TEXT,
  cin             TEXT,
  cnss            TEXT,
  num_compte_bancaire TEXT,
  banque          TEXT,
  date_embauche   DATE,
  date_fin_cdd    DATE,
  type_contrat    TEXT DEFAULT 'cdi',
  salaire_brut    DECIMAL(10,2) DEFAULT 0,
  salaire_net     DECIMAL(10,2) DEFAULT 0,
  avances         DECIMAL(10,2) DEFAULT 0,
  mode_paiement   TEXT DEFAULT 'virement',
  nationalite     TEXT DEFAULT 'Marocaine',
  date_naissance  DATE,
  lieu_naissance  TEXT,
  diplome         TEXT,
  experience_ans  INTEGER DEFAULT 0,
  statut_familial TEXT,
  nb_enfants      INTEGER DEFAULT 0,
  statut          TEXT DEFAULT 'actif',
  dossier_complet BOOLEAN DEFAULT FALSE,
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-matricule function
CREATE OR REPLACE FUNCTION generate_matricule(p_role TEXT)
RETURNS TEXT AS $$
DECLARE
  year_str  TEXT := TO_CHAR(NOW(), 'YYYY');
  role_code TEXT;
  seq       INTEGER;
  matricule TEXT;
BEGIN
  role_code := CASE p_role
    WHEN 'prevendeur'      THEN 'PRV'
    WHEN 'livreur'         THEN 'LIV'
    WHEN 'magasinier'      THEN 'MAG'
    WHEN 'acheteur'        THEN 'ACH'
    WHEN 'resp_logistique' THEN 'LOG'
    WHEN 'resp_commercial' THEN 'COM'
    WHEN 'admin'           THEN 'ADM'
    WHEN 'financier'       THEN 'FIN'
    WHEN 'cash_man'        THEN 'CAS'
    WHEN 'dispatcheur'     THEN 'DIS'
    WHEN 'rh_manager'      THEN 'RH'
    WHEN 'comptable'       THEN 'CPT'
    WHEN 'qualite'         THEN 'QUA'
    WHEN 'chef_depot'      THEN 'CDP'
    ELSE 'EMP'
  END;
  SELECT COUNT(*) + 1 INTO seq
  FROM fl_salaries
  WHERE matricule LIKE 'FLP-' || year_str || '-' || role_code || '-%';
  matricule := 'FLP-' || year_str || '-' || role_code || '-' || LPAD(seq::TEXT, 3, '0');
  RETURN matricule;
END;
$$ LANGUAGE plpgsql;

-- ── PURCHASE ORDERS ──────────────────────────────────────────
CREATE TABLE fl_purchase_orders (
  id              TEXT PRIMARY KEY,
  numero          TEXT UNIQUE NOT NULL,
  fournisseur_id  TEXT REFERENCES fl_fournisseurs(id),
  fournisseur_nom TEXT,
  date_commande   DATE DEFAULT CURRENT_DATE,
  date_livraison_prevue DATE,
  lignes          JSONB DEFAULT '[]',
  montant_total   DECIMAL(12,2) DEFAULT 0,
  statut          TEXT DEFAULT 'brouillon',
  created_by      TEXT,
  approved_by     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── FEEDBACKS ────────────────────────────────────────────────
CREATE TABLE fl_feedbacks (
  id              TEXT PRIMARY KEY,
  client_id       TEXT REFERENCES fl_clients(id),
  client_nom      TEXT,
  bl_id           TEXT REFERENCES fl_bons_livraison(id),
  note            INTEGER CHECK (note BETWEEN 1 AND 5),
  commentaire     TEXT,
  type_feedback   TEXT DEFAULT 'livraison',
  traite          BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── NOTIFICATIONS ────────────────────────────────────────────
CREATE TABLE fl_notifications (
  id              TEXT PRIMARY KEY,
  user_id         TEXT REFERENCES fl_users(id),
  titre           TEXT NOT NULL,
  message         TEXT,
  type            TEXT DEFAULT 'info',
  lu              BOOLEAN DEFAULT FALSE,
  action_url      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── PRICING INTELLIGENCE ─────────────────────────────────────
CREATE TABLE fl_pricing (
  id              TEXT PRIMARY KEY,
  article_id      TEXT REFERENCES fl_articles(id),
  article_nom     TEXT,
  prix_releve     DECIMAL(10,3) NOT NULL,
  source          TEXT,
  marche          TEXT,
  date_releve     DATE DEFAULT CURRENT_DATE,
  releve_par      TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════
-- For now, allow all authenticated users (refine per-role later)
ALTER TABLE fl_clients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_articles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_commandes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_bons_achat      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_bons_livraison  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_bons_preparation ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_retours         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_stock           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_trips           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_salaries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_fournisseurs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_transporteurs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_depots          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_users           ENABLE ROW LEVEL SECURITY;

-- Allow anon key full access (app handles auth itself)
CREATE POLICY "allow_all_clients"         ON fl_clients          FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "allow_all_articles"        ON fl_articles         FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "allow_all_commandes"       ON fl_commandes        FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "allow_all_bons_achat"      ON fl_bons_achat       FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "allow_all_bons_livraison"  ON fl_bons_livraison   FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "allow_all_bons_prep"       ON fl_bons_preparation FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "allow_all_retours"         ON fl_retours          FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "allow_all_stock"           ON fl_stock            FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "allow_all_trips"           ON fl_trips            FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "allow_all_payments"        ON fl_payments         FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "allow_all_salaries"        ON fl_salaries         FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "allow_all_fournisseurs"    ON fl_fournisseurs     FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "allow_all_transporteurs"   ON fl_transporteurs    FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "allow_all_depots"          ON fl_depots           FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "allow_all_users"           ON fl_users            FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES (performance)
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_clients_nom          ON fl_clients(nom);
CREATE INDEX IF NOT EXISTS idx_clients_secteur      ON fl_clients(secteur);
CREATE INDEX IF NOT EXISTS idx_articles_nom         ON fl_articles(nom);
CREATE INDEX IF NOT EXISTS idx_articles_famille     ON fl_articles(famille);
CREATE INDEX IF NOT EXISTS idx_commandes_date       ON fl_commandes(date_commande);
CREATE INDEX IF NOT EXISTS idx_commandes_client     ON fl_commandes(client_id);
CREATE INDEX IF NOT EXISTS idx_bons_achat_date      ON fl_bons_achat(date_achat);
CREATE INDEX IF NOT EXISTS idx_bl_date              ON fl_bons_livraison(date_livraison);
CREATE INDEX IF NOT EXISTS idx_bl_client            ON fl_bons_livraison(client_id);
CREATE INDEX IF NOT EXISTS idx_bl_livreur           ON fl_bons_livraison(livreur_id);
CREATE INDEX IF NOT EXISTS idx_bl_statut            ON fl_bons_livraison(statut);
CREATE INDEX IF NOT EXISTS idx_stock_article        ON fl_stock(article_id);
CREATE INDEX IF NOT EXISTS idx_stock_depot          ON fl_stock(depot_id);
CREATE INDEX IF NOT EXISTS idx_trips_date           ON fl_trips(date_trip);
CREATE INDEX IF NOT EXISTS idx_salaries_matricule   ON fl_salaries(matricule);
CREATE INDEX IF NOT EXISTS idx_users_role           ON fl_users(role);

-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_clients_updated_at         BEFORE UPDATE ON fl_clients         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_articles_updated_at        BEFORE UPDATE ON fl_articles        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_commandes_updated_at       BEFORE UPDATE ON fl_commandes       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_bons_achat_updated_at      BEFORE UPDATE ON fl_bons_achat      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_bons_livraison_updated_at  BEFORE UPDATE ON fl_bons_livraison  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_stock_updated_at           BEFORE UPDATE ON fl_stock           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_users_updated_at           BEFORE UPDATE ON fl_users           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_salaries_updated_at        BEFORE UPDATE ON fl_salaries        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_fournisseurs_updated_at    BEFORE UPDATE ON fl_fournisseurs    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_transporteurs_updated_at   BEFORE UPDATE ON fl_transporteurs   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_depots_updated_at          BEFORE UPDATE ON fl_depots          FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- STORAGE BUCKETS (run separately in Supabase Storage tab)
-- ═══════════════════════════════════════════════════════════════
-- Create these buckets in Supabase Storage > New Bucket:
-- 1. "fl-articles"      — Public: YES  (product photos)
-- 2. "fl-documents"     — Public: NO   (HR docs, signed BLs)
-- 3. "fl-conducteurs"   — Public: NO   (driver photos, CIN, permis)
-- 4. "fl-signatures"    — Public: NO   (delivery signatures)
-- 5. "fl-retours"       — Public: NO   (return photos)

-- Or run this SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES
--   ('fl-articles',   'fl-articles',   TRUE),
--   ('fl-documents',  'fl-documents',  FALSE),
--   ('fl-conducteurs','fl-conducteurs',FALSE),
--   ('fl-signatures', 'fl-signatures', FALSE),
--   ('fl-retours',    'fl-retours',    FALSE);

SELECT 'FreshLink Empire Fresh v3.0 — Schema installed successfully!' AS status;
