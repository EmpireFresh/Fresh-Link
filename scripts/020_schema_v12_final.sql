-- ============================================================
-- FRESHLINK PRO — SCHEMA COMPLET v12  (SCRIPT UNIQUE — CLEAN SLATE)
-- Supabase Free Tier Optimisé
-- Tables: 35 + fl_config
-- Nouveautés v12:
--   31. fl_account_requests  (demandes portail externe)
--   32. fl_marketplace_config (config publication articles)
--   33. fl_web_integration   (clé API + origines CORS)
--   34. fl_permissions_matrix (matrice rôles/droits)
--   35. fl_article_marketplace_log (journal modifications)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ══════════════════════════════════════════════════════════════
-- HELPER: updated_at trigger function (créé en premier)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- ══════════════════════════════════════════════════════════════
-- 1. DEPOTS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_depots CASCADE;
CREATE TABLE public.fl_depots (
  id               TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  nom              TEXT NOT NULL,
  adresse          TEXT,
  ville            TEXT,
  actif            BOOLEAN DEFAULT TRUE,
  responsable_nom  TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.fl_depots (id, nom, actif) VALUES ('DEPOT_PRINCIPAL','Depot Principal',TRUE) ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 2. UTILISATEURS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_users CASCADE;
CREATE TABLE public.fl_users (
  id                TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  name              TEXT NOT NULL,
  email             TEXT UNIQUE NOT NULL,
  password          TEXT NOT NULL DEFAULT '1234',
  password_mobile   TEXT,
  password_bo       TEXT,
  role              TEXT NOT NULL DEFAULT 'prevendeur',
  -- Rôles possibles: super_super_admin | super_admin | admin | resp_commercial |
  --   resp_logistique | acheteur | financier | commercial | livreur | magasinier |
  --   prevendeur | client | fournisseur | conducteur_ext | resp_achat
  access_type       TEXT,    -- 'mobile' | 'backoffice' | 'both'
  secteur           TEXT,
  phone             TEXT,
  actif             BOOLEAN DEFAULT TRUE,
  depot_id          TEXT REFERENCES public.fl_depots(id),
  -- Liens portail externe
  client_id         TEXT,
  fournisseur_id    TEXT,
  -- Permissions granulaires (surchargent la matrice par défaut)
  perms_override    JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Admin par défaut
INSERT INTO public.fl_users (id, name, email, password, role, actif) VALUES
  ('ADMIN_DEFAULT', 'Administrateur', 'admin@freshlink.ma', 'admin123', 'super_admin', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 3. CLIENTS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_clients CASCADE;
CREATE TABLE public.fl_clients (
  id                 TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  nom                TEXT NOT NULL,
  telephone          TEXT,
  email              TEXT,
  adresse            TEXT,
  ville              TEXT,
  ice                TEXT,
  rc                 TEXT,
  segment            TEXT DEFAULT 'standard',  -- standard | premium | vip
  actif              BOOLEAN DEFAULT TRUE,
  credit             NUMERIC DEFAULT 0,
  credit_autorise    BOOLEAN DEFAULT FALSE,
  plafond_credit     NUMERIC DEFAULT 0,
  loyalty_points     NUMERIC DEFAULT 0,
  loyalty_opt_in     BOOLEAN DEFAULT FALSE,
  commercial_id      TEXT,
  depot_id           TEXT REFERENCES public.fl_depots(id),
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 4. FOURNISSEURS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_fournisseurs CASCADE;
CREATE TABLE public.fl_fournisseurs (
  id           TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  nom          TEXT NOT NULL,
  telephone    TEXT,
  email        TEXT,
  adresse      TEXT,
  ville        TEXT,
  ice          TEXT,
  rc           TEXT,
  pays         TEXT DEFAULT 'Maroc',
  actif        BOOLEAN DEFAULT TRUE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 5. ARTICLES — avec champs Marketplace v12
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_articles CASCADE;
CREATE TABLE public.fl_articles (
  id                           TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  nom                          TEXT NOT NULL,
  nom_ar                       TEXT,
  famille                      TEXT NOT NULL DEFAULT 'Autres',
  unite                        TEXT NOT NULL DEFAULT 'kg',
  colisage_caisses             NUMERIC,
  colisage_demi_caisses        NUMERIC,
  stock_disponible             NUMERIC NOT NULL DEFAULT 0,
  stock_defect                 NUMERIC NOT NULL DEFAULT 0,
  stock_reel                   NUMERIC,
  stock_reel_date              DATE,
  stock_reel_saisi_par         TEXT,
  stock_theorique              NUMERIC,
  shelf_life_jours             INTEGER,
  alerte_shelf_life_jours      INTEGER DEFAULT 2,
  prix_liquidation             NUMERIC,
  prix_achat                   NUMERIC NOT NULL DEFAULT 0,
  pv_methode                   TEXT DEFAULT 'pourcentage',  -- pourcentage | montant | manuel
  pv_valeur                    NUMERIC NOT NULL DEFAULT 0,
  photo                        TEXT,
  photos                       JSONB DEFAULT '[]',
  -- Activation
  actif                        BOOLEAN DEFAULT TRUE,
  catalogue_visible            BOOLEAN DEFAULT TRUE,
  -- Marketplace / Site web
  marketplace_actif            BOOLEAN DEFAULT FALSE,
  marketplace_statut           TEXT DEFAULT 'disponible',
  -- disponible | hors_saison | out_of_stock | short_stock | nouveau | promo
  marketplace_commentaire      TEXT,
  marketplace_prix_public      NUMERIC,
  marketplace_promo            JSONB,
  -- { actif, prixPromo, etiquette, dateDebut, dateFin }
  marketplace_seuil_short_stock NUMERIC DEFAULT 20,
  marketplace_tags             JSONB DEFAULT '[]',
  marketplace_ordre            INTEGER DEFAULT 0,
  marketplace_description      TEXT,
  marketplace_description_ar   TEXT,
  depot_id                     TEXT REFERENCES public.fl_depots(id),
  notes                        TEXT,
  created_at                   TIMESTAMPTZ DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 6. LIVREURS / CONDUCTEURS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_livreurs CASCADE;
CREATE TABLE public.fl_livreurs (
  id              TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  nom             TEXT NOT NULL,
  telephone       TEXT,
  type            TEXT DEFAULT 'interne',  -- interne | externe
  actif           BOOLEAN DEFAULT TRUE,
  -- Transport externe
  tarif_km        NUMERIC,
  tarif_forfait   NUMERIC,
  zone            TEXT,
  vehicule        TEXT,
  -- Rémunération conducteur externe
  remuneration_totale   NUMERIC DEFAULT 0,
  remuneration_confirmee BOOLEAN DEFAULT FALSE,
  remuneration_confirmed_at TIMESTAMPTZ,
  depot_id        TEXT REFERENCES public.fl_depots(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 7. COMMANDES CLIENTS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_commandes CASCADE;
CREATE TABLE public.fl_commandes (
  id                TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  date_livraison    DATE,
  client_id         TEXT NOT NULL REFERENCES public.fl_clients(id),
  commercial_id     TEXT,
  depot_id          TEXT REFERENCES public.fl_depots(id),
  statut            TEXT NOT NULL DEFAULT 'en_attente',
  source            TEXT DEFAULT 'interne',  -- interne | portail | marketplace | api
  lignes            JSONB NOT NULL DEFAULT '[]',
  total             NUMERIC NOT NULL DEFAULT 0,
  notes             TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 8. BONS D'ACHAT
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_bons_achat CASCADE;
CREATE TABLE public.fl_bons_achat (
  id              TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  fournisseur_id  TEXT REFERENCES public.fl_fournisseurs(id),
  acheteur_id     TEXT,
  depot_id        TEXT REFERENCES public.fl_depots(id),
  statut          TEXT NOT NULL DEFAULT 'en_cours',
  lignes          JSONB NOT NULL DEFAULT '[]',
  total           NUMERIC NOT NULL DEFAULT 0,
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 9. PURCHASE ORDERS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_purchase_orders CASCADE;
CREATE TABLE public.fl_purchase_orders (
  id                       TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date                     DATE NOT NULL DEFAULT CURRENT_DATE,
  fournisseur_id           TEXT REFERENCES public.fl_fournisseurs(id),
  depot_id                 TEXT REFERENCES public.fl_depots(id),
  statut                   TEXT NOT NULL DEFAULT 'draft',
  lignes                   JSONB NOT NULL DEFAULT '[]',
  montant_total            NUMERIC NOT NULL DEFAULT 0,
  date_livraison_souhaitee DATE,
  notes                    TEXT,
  created_by               TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 10. RECEPTIONS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_receptions CASCADE;
CREATE TABLE public.fl_receptions (
  id                TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  bon_achat_id      TEXT REFERENCES public.fl_bons_achat(id),
  purchase_order_id TEXT REFERENCES public.fl_purchase_orders(id),
  fournisseur_id    TEXT REFERENCES public.fl_fournisseurs(id),
  depot_id          TEXT REFERENCES public.fl_depots(id),
  statut            TEXT NOT NULL DEFAULT 'en_cours',
  lignes            JSONB NOT NULL DEFAULT '[]',
  notes             TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 11. TRIPS (tournées)
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_trips CASCADE;
CREATE TABLE public.fl_trips (
  id           TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  livreur_id   TEXT REFERENCES public.fl_livreurs(id),
  statut       TEXT NOT NULL DEFAULT 'en_attente',
  bl_ids       JSONB DEFAULT '[]',
  vehicule     TEXT,
  km_depart    NUMERIC,
  km_retour    NUMERIC,
  montant_total NUMERIC DEFAULT 0,
  coût_transport NUMERIC DEFAULT 0,
  notes        TEXT,
  depot_id     TEXT REFERENCES public.fl_depots(id),
  created_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 12. BONS DE LIVRAISON
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_bons_livraison CASCADE;
CREATE TABLE public.fl_bons_livraison (
  id                    TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  commande_id           TEXT REFERENCES public.fl_commandes(id),
  client_id             TEXT REFERENCES public.fl_clients(id),
  trip_id               TEXT REFERENCES public.fl_trips(id),
  depot_id              TEXT REFERENCES public.fl_depots(id),
  statut                TEXT NOT NULL DEFAULT 'en_attente',
  lignes                JSONB NOT NULL DEFAULT '[]',
  total                 NUMERIC NOT NULL DEFAULT 0,
  valide_magasinier     BOOLEAN DEFAULT FALSE,
  valide_magasinier_at  TIMESTAMPTZ,
  valide_magasinier_par TEXT,
  notes                 TEXT,
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 13. RETOURS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_retours CASCADE;
CREATE TABLE public.fl_retours (
  id           TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  bl_id        TEXT REFERENCES public.fl_bons_livraison(id),
  client_id    TEXT REFERENCES public.fl_clients(id),
  trip_id      TEXT REFERENCES public.fl_trips(id),
  depot_id     TEXT REFERENCES public.fl_depots(id),
  motif        TEXT,
  lignes       JSONB NOT NULL DEFAULT '[]',
  total        NUMERIC NOT NULL DEFAULT 0,
  statut       TEXT NOT NULL DEFAULT 'recu',
  notes        TEXT,
  created_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 14. SALARIES
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_salaries CASCADE;
CREATE TABLE public.fl_salaries (
  id                TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  user_id           TEXT,
  nom               TEXT NOT NULL,
  poste             TEXT,
  type_contrat      TEXT DEFAULT 'CDI',
  salaire_base      NUMERIC NOT NULL DEFAULT 0,
  indemnites        NUMERIC DEFAULT 0,
  charges_patronales NUMERIC DEFAULT 0,
  date_embauche     DATE,
  statut            TEXT DEFAULT 'actif',
  depot_id          TEXT REFERENCES public.fl_depots(id),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 15. PAIEMENTS SALAIRES
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_paiements_salaires CASCADE;
CREATE TABLE public.fl_paiements_salaires (
  id           TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  salarie_id   TEXT REFERENCES public.fl_salaries(id),
  mois         TEXT NOT NULL,
  montant      NUMERIC NOT NULL DEFAULT 0,
  statut       TEXT DEFAULT 'en_attente',
  paye_le      DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 16. CAISSE
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_caisse_entries CASCADE;
CREATE TABLE public.fl_caisse_entries (
  id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  type        TEXT NOT NULL,  -- 'entree' | 'sortie'
  categorie   TEXT,
  montant     NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  reference   TEXT,
  depot_id    TEXT REFERENCES public.fl_depots(id),
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 17. FEEDBACKS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_feedbacks CASCADE;
CREATE TABLE public.fl_feedbacks (
  id           TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id      TEXT,
  user_nom     TEXT,
  type         TEXT,
  note         INTEGER DEFAULT 5,
  commentaire  TEXT,
  statut       TEXT DEFAULT 'nouveau',
  traite_par   TEXT,
  traite_le    DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 18. CHARGES TRIP
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_trip_charges CASCADE;
CREATE TABLE public.fl_trip_charges (
  id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  trip_id     TEXT REFERENCES public.fl_trips(id),
  livreur_id  TEXT REFERENCES public.fl_livreurs(id),
  type        TEXT NOT NULL,
  montant     NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  recu        TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 19. LOYALTY TRANSACTIONS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_loyalty_transactions CASCADE;
CREATE TABLE public.fl_loyalty_transactions (
  id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  client_id   TEXT REFERENCES public.fl_clients(id),
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  type        TEXT NOT NULL,
  points      NUMERIC NOT NULL DEFAULT 0,
  reference   TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 20. PERFORMANCE INCENTIVES
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_performance_incentives CASCADE;
CREATE TABLE public.fl_performance_incentives (
  id            TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  user_id       TEXT,
  user_nom      TEXT,
  periode       TEXT NOT NULL,
  type          TEXT NOT NULL,
  montant       NUMERIC NOT NULL DEFAULT 0,
  statut        TEXT DEFAULT 'calcule',
  valide_par    TEXT,
  valide_le     DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 21. DRIVER BONUSES
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_driver_bonuses CASCADE;
CREATE TABLE public.fl_driver_bonuses (
  id             TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  livreur_id     TEXT REFERENCES public.fl_livreurs(id),
  livreur_nom    TEXT,
  driver_type    TEXT NOT NULL DEFAULT 'interne',
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  trip_id        TEXT REFERENCES public.fl_trips(id),
  periode        TEXT,
  zero_retard    BOOLEAN DEFAULT FALSE,
  zero_retour    BOOLEAN DEFAULT FALSE,
  zero_qualite   BOOLEAN DEFAULT FALSE,
  montant_bonus  NUMERIC NOT NULL DEFAULT 0,
  statut         TEXT NOT NULL DEFAULT 'calcule',
  notes          TEXT,
  created_by     TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 22. VISITES COMMERCIALES
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_visites CASCADE;
CREATE TABLE public.fl_visites (
  id               TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date             DATE NOT NULL DEFAULT CURRENT_DATE,
  prevendeur_id    TEXT,
  prevendeur_nom   TEXT,
  client_id        TEXT REFERENCES public.fl_clients(id),
  client_nom       TEXT,
  statut           TEXT DEFAULT 'effectuee',
  commande_passee  BOOLEAN DEFAULT FALSE,
  commande_id      TEXT,
  notes            TEXT,
  gps_lat          NUMERIC,
  gps_lng          NUMERIC,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 23. TRANSPORT COMPANIES
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_transport_companies CASCADE;
CREATE TABLE public.fl_transport_companies (
  id             TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  nom            TEXT NOT NULL,
  telephone      TEXT,
  email          TEXT,
  type_tarif     TEXT DEFAULT 'km',  -- km | forfait | palette
  tarif          NUMERIC DEFAULT 0,
  zones          JSONB DEFAULT '[]',
  actif          BOOLEAN DEFAULT TRUE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 24. CAISSES VIDES
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_caisses_vides CASCADE;
CREATE TABLE public.fl_caisses_vides (
  id            TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  type          TEXT NOT NULL,
  client_id     TEXT REFERENCES public.fl_clients(id),
  livreur_id    TEXT REFERENCES public.fl_livreurs(id),
  trip_id       TEXT REFERENCES public.fl_trips(id),
  sorties       INTEGER DEFAULT 0,
  retours       INTEGER DEFAULT 0,
  solde         INTEGER DEFAULT 0,
  notes         TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 25. HR TEMPLATES
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_hr_templates CASCADE;
CREATE TABLE public.fl_hr_templates (
  id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  nom         TEXT NOT NULL,
  type        TEXT NOT NULL,
  description TEXT,
  contenu     TEXT NOT NULL DEFAULT '',
  variables   JSONB DEFAULT '[]',
  actif       BOOLEAN DEFAULT TRUE,
  is_default  BOOLEAN DEFAULT FALSE,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 26. INVESTISSEMENTS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_investissements CASCADE;
CREATE TABLE public.fl_investissements (
  id              TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date            DATE DEFAULT CURRENT_DATE,
  type            TEXT,
  montant         NUMERIC DEFAULT 0,
  description     TEXT,
  actionnaire_id  TEXT,
  statut          TEXT DEFAULT 'brouillon',
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 27. PRICING INTELLIGENCE
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_pricing_releves CASCADE;
CREATE TABLE public.fl_pricing_releves (
  id               TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date             DATE DEFAULT CURRENT_DATE,
  article_nom      TEXT NOT NULL,
  marche           TEXT,
  prix             NUMERIC NOT NULL DEFAULT 0,
  unite            TEXT DEFAULT 'kg',
  source           TEXT,
  notes            TEXT,
  created_by       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 28. GPS TRACKING
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_gps_positions CASCADE;
CREATE TABLE public.fl_gps_positions (
  id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  user_id     TEXT NOT NULL,
  user_nom    TEXT,
  lat         NUMERIC NOT NULL,
  lng         NUMERIC NOT NULL,
  accuracy    NUMERIC,
  speed       NUMERIC,
  heading     NUMERIC,
  trip_id     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index partiel pour les positions récentes (< 24h)
CREATE INDEX IF NOT EXISTS idx_gps_user_recent ON public.fl_gps_positions(user_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- 29. SHAREHOLDERS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_shareholders CASCADE;
CREATE TABLE public.fl_shareholders (
  id            TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  nom           TEXT NOT NULL,
  parts         NUMERIC DEFAULT 0,
  email         TEXT,
  telephone     TEXT,
  actif         BOOLEAN DEFAULT TRUE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 30. CONFIG (key-value global)
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_config CASCADE;
CREATE TABLE public.fl_config (
  id         TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.fl_config (id, value) VALUES
  ('company', '{
    "nom": "FreshLink Pro",
    "appName": "FreshLink Pro",
    "adresse": "Zone Industrielle, Casablanca",
    "ville": "Casablanca, Maroc",
    "telephone": "+212 5XX-XXXXXX",
    "email": "contact@freshlink.ma",
    "ice": "000000000000000",
    "rc": "XXXXXX",
    "couleurEntete": "#1a4f2a"
  }'::jsonb),
  ('loyalty_config', '{
    "actif": true,
    "pointsParDH": 0.1,
    "bonusZeroRetour": 50,
    "bonusAppOrder": 20,
    "pointsParRemiseDH": 10,
    "minimumPointsRachat": 100,
    "pointsArticleCadeau": 500
  }'::jsonb),
  ('driver_bonus_config', '{
    "actif": true,
    "bonusZeroRetard": 20,
    "bonusZeroRetour": 30,
    "bonusZeroQualite": 25,
    "bonusParfait": 100
  }'::jsonb),
  ('cutoff_notifications', '[
    {"id":"co1","time":"08:00","message":"Rappel: Finalisez vos achats avant 10h.","active":true},
    {"id":"co2","time":"12:00","message":"Coupure midi: Aucune nouvelle commande après 13h.","active":true}
  ]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 31. ACCOUNT REQUESTS — Demandes portail externe  ★ NOUVEAU v12
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_account_requests CASCADE;
CREATE TABLE public.fl_account_requests (
  id              TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  type            TEXT NOT NULL CHECK (type IN ('client','fournisseur')),
  nom             TEXT NOT NULL,
  email           TEXT NOT NULL,
  telephone       TEXT NOT NULL,
  societe         TEXT NOT NULL,
  ice             TEXT,
  ville           TEXT,
  message         TEXT,
  statut          TEXT NOT NULL DEFAULT 'en_attente'
                  CHECK (statut IN ('en_attente','approuve','rejete')),
  approved_at     TIMESTAMPTZ,
  approved_by     TEXT REFERENCES public.fl_users(id),
  rejected_at     TIMESTAMPTZ,
  rejected_by     TEXT REFERENCES public.fl_users(id),
  reject_reason   TEXT,
  -- Liens vers les enregistrements créés après approbation
  linked_client_id      TEXT REFERENCES public.fl_clients(id),
  linked_fournisseur_id TEXT REFERENCES public.fl_fournisseurs(id),
  linked_user_id        TEXT REFERENCES public.fl_users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_requests_statut ON public.fl_account_requests(statut);
CREATE INDEX IF NOT EXISTS idx_account_requests_type   ON public.fl_account_requests(type);

-- ══════════════════════════════════════════════════════════════
-- 32. MARKETPLACE CONFIG — Publication articles  ★ NOUVEAU v12
-- ══════════════════════════════════════════════════════════════
-- Note: Les champs marketplace sont directement dans fl_articles (v12)
-- Cette table garde l'historique des modifications de publication

DROP TABLE IF EXISTS public.fl_marketplace_log CASCADE;
CREATE TABLE public.fl_marketplace_log (
  id              TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  article_id      TEXT REFERENCES public.fl_articles(id),
  article_nom     TEXT,
  action          TEXT NOT NULL,
  -- 'publié' | 'dépublié' | 'statut_modifié' | 'prix_modifié' | 'promo_ajoutée' | 'promo_retirée'
  ancien_statut   TEXT,
  nouveau_statut  TEXT,
  ancien_prix     NUMERIC,
  nouveau_prix    NUMERIC,
  commentaire     TEXT,
  fait_par        TEXT REFERENCES public.fl_users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger pour logger les modifications marketplace
CREATE OR REPLACE FUNCTION public.log_marketplace_changes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Changement de publication
  IF OLD.marketplace_actif IS DISTINCT FROM NEW.marketplace_actif THEN
    INSERT INTO public.fl_marketplace_log
      (article_id, article_nom, action, ancien_statut, nouveau_statut)
    VALUES
      (NEW.id, NEW.nom,
       CASE WHEN NEW.marketplace_actif THEN 'publié' ELSE 'dépublié' END,
       CASE WHEN OLD.marketplace_actif THEN 'publié' ELSE 'dépublié' END,
       CASE WHEN NEW.marketplace_actif THEN 'publié' ELSE 'dépublié' END);
  END IF;
  -- Changement de statut
  IF OLD.marketplace_statut IS DISTINCT FROM NEW.marketplace_statut THEN
    INSERT INTO public.fl_marketplace_log
      (article_id, article_nom, action, ancien_statut, nouveau_statut)
    VALUES (NEW.id, NEW.nom, 'statut_modifié', OLD.marketplace_statut, NEW.marketplace_statut);
  END IF;
  -- Changement de prix public
  IF OLD.marketplace_prix_public IS DISTINCT FROM NEW.marketplace_prix_public THEN
    INSERT INTO public.fl_marketplace_log
      (article_id, article_nom, action, ancien_prix, nouveau_prix)
    VALUES (NEW.id, NEW.nom, 'prix_modifié', OLD.marketplace_prix_public, NEW.marketplace_prix_public);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_marketplace_log ON public.fl_articles;
CREATE TRIGGER trg_marketplace_log
  AFTER UPDATE ON public.fl_articles
  FOR EACH ROW EXECUTE FUNCTION public.log_marketplace_changes();

-- ══════════════════════════════════════════════════════════════
-- 33. WEB INTEGRATION CONFIG  ★ NOUVEAU v12
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_web_integration CASCADE;
CREATE TABLE public.fl_web_integration (
  id                    TEXT PRIMARY KEY DEFAULT 'main',
  api_key               TEXT,
  enabled               BOOLEAN DEFAULT FALSE,
  allowed_origins       JSONB DEFAULT '[]',
  catalogue_public      BOOLEAN DEFAULT TRUE,
  commandes_publiques   BOOLEAN DEFAULT FALSE,
  demandes_comptes      BOOLEAN DEFAULT TRUE,
  webhook_url           TEXT,
  webhook_secret        TEXT,
  updated_by            TEXT REFERENCES public.fl_users(id),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.fl_web_integration (id, enabled) VALUES ('main', FALSE) ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 34. PERMISSIONS MATRIX  ★ NOUVEAU v12
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_permissions_matrix CASCADE;
CREATE TABLE public.fl_permissions_matrix (
  id         TEXT PRIMARY KEY DEFAULT 'default',
  matrix     JSONB NOT NULL DEFAULT '{}',
  -- Format: { "admin": ["approuver_compte_client", ...], "resp_commercial": [...] }
  updated_by TEXT REFERENCES public.fl_users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.fl_permissions_matrix (id, matrix) VALUES ('default', '{
  "admin": [
    "approuver_compte_client","approuver_compte_fournisseur","rejeter_demande_compte",
    "creer_compte_manuellement","activer_article","desactiver_article","supprimer_article",
    "modifier_article","catalogue_toggle","voir_api_config","modifier_api_config",
    "creer_utilisateur","modifier_utilisateur","desactiver_utilisateur",
    "publier_marketplace","depublier_marketplace","modifier_prix_marketplace"
  ],
  "resp_commercial": [
    "approuver_compte_client","rejeter_demande_compte","creer_compte_manuellement",
    "catalogue_toggle","modifier_article","publier_marketplace","modifier_prix_marketplace"
  ],
  "resp_logistique": [
    "activer_article","desactiver_article","modifier_article","catalogue_toggle",
    "approuver_compte_fournisseur","rejeter_demande_compte"
  ],
  "acheteur": [
    "approuver_compte_fournisseur","rejeter_demande_compte","modifier_article"
  ],
  "financier": [],
  "resp_achat": [
    "approuver_compte_fournisseur","rejeter_demande_compte","modifier_article","catalogue_toggle"
  ]
}'::jsonb) ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 35. STOCK MOVEMENTS LOG (traçabilité)  ★ NOUVEAU v12
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_stock_movements CASCADE;
CREATE TABLE public.fl_stock_movements (
  id           TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  article_id   TEXT REFERENCES public.fl_articles(id),
  article_nom  TEXT,
  type         TEXT NOT NULL,
  -- 'reception' | 'vente' | 'retour_client' | 'retour_fournisseur' |
  -- 'ajustement' | 'defect' | 'liquidation'
  quantite     NUMERIC NOT NULL,
  stock_avant  NUMERIC,
  stock_apres  NUMERIC,
  reference_id TEXT,   -- ID du BL / BA / réception source
  depot_id     TEXT REFERENCES public.fl_depots(id),
  fait_par     TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_article ON public.fl_stock_movements(article_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date    ON public.fl_stock_movements(created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGERS
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fl_depots','fl_users','fl_clients','fl_fournisseurs','fl_articles',
    'fl_livreurs','fl_commandes','fl_bons_achat','fl_purchase_orders',
    'fl_receptions','fl_trips','fl_bons_livraison','fl_retours','fl_salaries',
    'fl_hr_templates'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%s;
       CREATE TRIGGER trg_%s_updated_at
         BEFORE UPDATE ON public.%s
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END; $$;

-- ══════════════════════════════════════════════════════════════
-- PERFORMANCE INDEXES
-- ══════════════════════════════════════════════════════════════
-- Articles
CREATE INDEX IF NOT EXISTS idx_articles_famille          ON public.fl_articles(famille);
CREATE INDEX IF NOT EXISTS idx_articles_actif            ON public.fl_articles(actif);
CREATE INDEX IF NOT EXISTS idx_articles_marketplace      ON public.fl_articles(marketplace_actif, marketplace_statut);
-- Commandes
CREATE INDEX IF NOT EXISTS idx_commandes_date            ON public.fl_commandes(date);
CREATE INDEX IF NOT EXISTS idx_commandes_client          ON public.fl_commandes(client_id);
CREATE INDEX IF NOT EXISTS idx_commandes_commercial      ON public.fl_commandes(commercial_id);
CREATE INDEX IF NOT EXISTS idx_commandes_statut          ON public.fl_commandes(statut);
CREATE INDEX IF NOT EXISTS idx_commandes_source          ON public.fl_commandes(source);
-- Achats
CREATE INDEX IF NOT EXISTS idx_bons_achat_date           ON public.fl_bons_achat(date);
CREATE INDEX IF NOT EXISTS idx_bons_achat_statut         ON public.fl_bons_achat(statut);
CREATE INDEX IF NOT EXISTS idx_bons_achat_depot          ON public.fl_bons_achat(depot_id);
-- PO
CREATE INDEX IF NOT EXISTS idx_po_statut                 ON public.fl_purchase_orders(statut);
CREATE INDEX IF NOT EXISTS idx_po_depot                  ON public.fl_purchase_orders(depot_id);
-- Réceptions
CREATE INDEX IF NOT EXISTS idx_receptions_date           ON public.fl_receptions(date);
CREATE INDEX IF NOT EXISTS idx_receptions_bon            ON public.fl_receptions(bon_achat_id);
CREATE INDEX IF NOT EXISTS idx_receptions_po             ON public.fl_receptions(purchase_order_id);
-- BL / Trips
CREATE INDEX IF NOT EXISTS idx_bl_trip                   ON public.fl_bons_livraison(trip_id);
CREATE INDEX IF NOT EXISTS idx_bl_valide_magasinier      ON public.fl_bons_livraison(valide_magasinier);
CREATE INDEX IF NOT EXISTS idx_trips_date                ON public.fl_trips(date);
CREATE INDEX IF NOT EXISTS idx_trips_livreur             ON public.fl_trips(livreur_id);
-- Users
CREATE INDEX IF NOT EXISTS idx_users_role                ON public.fl_users(role);
CREATE INDEX IF NOT EXISTS idx_users_depot               ON public.fl_users(depot_id);
CREATE INDEX IF NOT EXISTS idx_users_client              ON public.fl_users(client_id);
CREATE INDEX IF NOT EXISTS idx_users_fournisseur         ON public.fl_users(fournisseur_id);
-- Visites
CREATE INDEX IF NOT EXISTS idx_visites_prevendeur        ON public.fl_visites(prevendeur_id);
CREATE INDEX IF NOT EXISTS idx_visites_date              ON public.fl_visites(date);
-- Finance
CREATE INDEX IF NOT EXISTS idx_salaries_statut           ON public.fl_salaries(statut);
CREATE INDEX IF NOT EXISTS idx_paiements_mois            ON public.fl_paiements_salaires(mois);
CREATE INDEX IF NOT EXISTS idx_caisse_date               ON public.fl_caisse_entries(date);
-- Feedback / Loyalty
CREATE INDEX IF NOT EXISTS idx_feedbacks_statut          ON public.fl_feedbacks(statut);
CREATE INDEX IF NOT EXISTS idx_loyalty_client            ON public.fl_loyalty_transactions(client_id);
-- Driver bonuses
CREATE INDEX IF NOT EXISTS idx_driver_bonuses_livreur    ON public.fl_driver_bonuses(livreur_id);
CREATE INDEX IF NOT EXISTS idx_driver_bonuses_date       ON public.fl_driver_bonuses(date);
CREATE INDEX IF NOT EXISTS idx_trip_charges_date         ON public.fl_trip_charges(date);

-- ══════════════════════════════════════════════════════════════
-- USEFUL VIEWS
-- ══════════════════════════════════════════════════════════════

-- Vue catalogue marketplace (utilisée par l'API /api/ext/catalogue)
CREATE OR REPLACE VIEW public.v_marketplace_catalogue AS
SELECT
  a.id,
  a.nom,
  a.nom_ar,
  a.famille,
  a.unite,
  a.photo,
  a.photos,
  a.marketplace_tags       AS tags,
  a.marketplace_description AS description,
  a.marketplace_description_ar AS description_ar,
  a.marketplace_prix_public AS prix,
  a.marketplace_promo      AS promo,
  a.marketplace_statut     AS statut,
  a.marketplace_commentaire AS commentaire,
  a.stock_disponible,
  a.marketplace_ordre      AS ordre,
  a.updated_at
FROM public.fl_articles a
WHERE a.marketplace_actif = TRUE
  AND a.actif = TRUE
ORDER BY a.marketplace_ordre ASC, a.nom ASC;

-- Vue demandes comptes en attente
CREATE OR REPLACE VIEW public.v_demandes_comptes_pending AS
SELECT
  ar.*,
  u.name AS approved_by_name
FROM public.fl_account_requests ar
LEFT JOIN public.fl_users u ON u.id = ar.approved_by
WHERE ar.statut = 'en_attente'
ORDER BY ar.created_at ASC;

-- Vue stock alertes
CREATE OR REPLACE VIEW public.v_stock_alertes AS
SELECT
  a.id,
  a.nom,
  a.famille,
  a.unite,
  a.stock_disponible,
  a.marketplace_seuil_short_stock AS seuil,
  a.marketplace_actif,
  CASE
    WHEN a.stock_disponible <= 0 THEN 'rupture'
    WHEN a.stock_disponible < a.marketplace_seuil_short_stock THEN 'alerte'
    ELSE 'ok'
  END AS niveau_alerte
FROM public.fl_articles a
WHERE a.actif = TRUE
  AND (a.stock_disponible <= 0 OR a.stock_disponible < COALESCE(a.marketplace_seuil_short_stock, 20))
ORDER BY a.stock_disponible ASC;

-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — Désactivée (auth maison localStorage)
-- Activer uniquement si migration vers Supabase Auth
-- ══════════════════════════════════════════════════════════════
-- ALTER TABLE public.fl_users ENABLE ROW LEVEL SECURITY;
-- ... (à configurer selon besoins auth Supabase)

-- ══════════════════════════════════════════════════════════════
-- FIN DU SCRIPT — FreshLink Pro v12 (SCHEMA COMPLET)
-- Tables: 35 + fl_config
-- Vues:   v_marketplace_catalogue, v_demandes_comptes_pending, v_stock_alertes
-- Triggers: set_updated_at (15 tables), log_marketplace_changes
-- Index: 35+ index performances
-- Nouveautés: marketplace, account_requests, web_integration,
--             permissions_matrix, stock_movements, marketplace_log
-- ══════════════════════════════════════════════════════════════
