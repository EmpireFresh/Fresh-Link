-- ============================================================
-- FRESHLINK EMPIRE FRESH — SCRIPT MASTER COMPLET v13
-- Projet Supabase : jwdrwapuetqoqnankgma
-- Coller EN ENTIER dans Supabase SQL Editor → Run
-- Ce script est IDEMPOTENT : peut être rejoue sans perdre de données
-- ============================================================
-- Tables créées (39 total) :
--   v12 : fl_depots, fl_users, fl_clients, fl_fournisseurs,
--          fl_articles, fl_livreurs, fl_commandes, fl_bons_achat,
--          fl_purchase_orders, fl_receptions, fl_trips, fl_bons_livraison,
--          fl_retours, fl_salaries, fl_paiements_salaires, fl_caisse_entries,
--          fl_feedbacks, fl_trip_charges, fl_loyalty_transactions,
--          fl_performance_incentives, fl_driver_bonuses, fl_visites,
--          fl_transport_companies, fl_caisses_vides, fl_hr_templates,
--          fl_investissements, fl_pricing_releves, fl_gps_positions,
--          fl_shareholders, fl_config, fl_account_requests, fl_marketplace_log,
--          fl_web_integration, fl_permissions_matrix, fl_stock_movements
--   v13+ : fl_company_contacts, fl_prospects, fl_commandes_web, fl_documents
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── HELPER TRIGGER ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- ════════════════════════════════════════════════════════════════
-- PARTIE 1 : SCHEMA DE BASE v12 (35 tables)
-- ════════════════════════════════════════════════════════════════

-- 1. DEPOTS
CREATE TABLE IF NOT EXISTS public.fl_depots (
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

-- 2. UTILISATEURS
CREATE TABLE IF NOT EXISTS public.fl_users (
  id                TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  name              TEXT NOT NULL,
  email             TEXT UNIQUE NOT NULL,
  password          TEXT NOT NULL DEFAULT '1234',
  password_mobile   TEXT,
  password_bo       TEXT,
  role              TEXT NOT NULL DEFAULT 'prevendeur',
  access_type       TEXT,
  secteur           TEXT,
  phone             TEXT,
  actif             BOOLEAN DEFAULT TRUE,
  depot_id          TEXT REFERENCES public.fl_depots(id),
  client_id         TEXT,
  fournisseur_id    TEXT,
  perms_override    JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.fl_users (id, name, email, password, role, actif)
  VALUES ('ADMIN_DEFAULT','Administrateur','admin@freshlink.ma','admin123','super_admin',TRUE)
  ON CONFLICT (id) DO NOTHING;

-- 3. CLIENTS
CREATE TABLE IF NOT EXISTS public.fl_clients (
  id                 TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  nom                TEXT NOT NULL,
  telephone          TEXT,
  email              TEXT,
  adresse            TEXT,
  ville              TEXT,
  ice                TEXT,
  rc                 TEXT,
  segment            TEXT DEFAULT 'standard',
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

-- 4. FOURNISSEURS
CREATE TABLE IF NOT EXISTS public.fl_fournisseurs (
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

-- 5. ARTICLES (avec colonnes marketplace v12 + colonnes web v13)
CREATE TABLE IF NOT EXISTS public.fl_articles (
  id                            TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  nom                           TEXT NOT NULL,
  nom_ar                        TEXT,
  famille                       TEXT NOT NULL DEFAULT 'Autres',
  unite                         TEXT NOT NULL DEFAULT 'kg',
  colisage_caisses              NUMERIC,
  colisage_demi_caisses         NUMERIC,
  stock_disponible              NUMERIC NOT NULL DEFAULT 0,
  stock_defect                  NUMERIC NOT NULL DEFAULT 0,
  stock_reel                    NUMERIC,
  stock_reel_date               DATE,
  stock_reel_saisi_par          TEXT,
  stock_theorique               NUMERIC,
  shelf_life_jours              INTEGER,
  alerte_shelf_life_jours       INTEGER DEFAULT 2,
  prix_liquidation              NUMERIC,
  prix_achat                    NUMERIC NOT NULL DEFAULT 0,
  pv_methode                    TEXT DEFAULT 'pourcentage',
  pv_valeur                     NUMERIC NOT NULL DEFAULT 0,
  photo                         TEXT,
  photos                        JSONB DEFAULT '[]',
  description                   TEXT,
  actif                         BOOLEAN DEFAULT TRUE,
  catalogue_visible             BOOLEAN DEFAULT TRUE,
  -- Champs marketplace v12
  marketplace_actif             BOOLEAN DEFAULT FALSE,
  marketplace_statut            TEXT DEFAULT 'disponible',
  marketplace_commentaire       TEXT,
  marketplace_prix_public       NUMERIC,
  marketplace_promo             JSONB,
  marketplace_seuil_short_stock NUMERIC DEFAULT 20,
  marketplace_tags              JSONB DEFAULT '[]',
  marketplace_ordre             INTEGER DEFAULT 0,
  marketplace_description       TEXT,
  marketplace_description_ar    TEXT,
  -- Champs web sync v13 (utilisés par useRealtimeSync + API ext)
  statut_web                    TEXT DEFAULT 'disponible',
  visible_web                   BOOLEAN DEFAULT TRUE,
  promo_active                  BOOLEAN DEFAULT FALSE,
  promo_taux                    DECIMAL(5,2) DEFAULT 0,
  promo_label                   TEXT,
  promo_fin                     DATE,
  criteres_qualite              JSONB DEFAULT '{}',
  prix_public                   DECIMAL(10,3) DEFAULT 0,
  tags                          TEXT[] DEFAULT '{}',
  position_catalogue            INTEGER DEFAULT 0,
  -- Commun
  depot_id                      TEXT REFERENCES public.fl_depots(id),
  notes                         TEXT,
  created_at                    TIMESTAMPTZ DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ DEFAULT NOW()
);

-- 6. LIVREURS
CREATE TABLE IF NOT EXISTS public.fl_livreurs (
  id                        TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  nom                       TEXT NOT NULL,
  telephone                 TEXT,
  type                      TEXT DEFAULT 'interne',
  actif                     BOOLEAN DEFAULT TRUE,
  tarif_km                  NUMERIC,
  tarif_forfait             NUMERIC,
  zone                      TEXT,
  vehicule                  TEXT,
  remuneration_totale       NUMERIC DEFAULT 0,
  remuneration_confirmee    BOOLEAN DEFAULT FALSE,
  remuneration_confirmed_at TIMESTAMPTZ,
  depot_id                  TEXT REFERENCES public.fl_depots(id),
  notes                     TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- 7. COMMANDES CLIENTS
CREATE TABLE IF NOT EXISTS public.fl_commandes (
  id             TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  date_livraison DATE,
  client_id      TEXT NOT NULL REFERENCES public.fl_clients(id),
  commercial_id  TEXT,
  depot_id       TEXT REFERENCES public.fl_depots(id),
  statut         TEXT NOT NULL DEFAULT 'en_attente',
  source         TEXT DEFAULT 'interne',
  lignes         JSONB NOT NULL DEFAULT '[]',
  total          NUMERIC NOT NULL DEFAULT 0,
  notes          TEXT,
  created_by     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 8. BONS D'ACHAT
CREATE TABLE IF NOT EXISTS public.fl_bons_achat (
  id             TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  fournisseur_id TEXT REFERENCES public.fl_fournisseurs(id),
  acheteur_id    TEXT,
  depot_id       TEXT REFERENCES public.fl_depots(id),
  statut         TEXT NOT NULL DEFAULT 'en_cours',
  lignes         JSONB NOT NULL DEFAULT '[]',
  total          NUMERIC NOT NULL DEFAULT 0,
  notes          TEXT,
  created_by     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 9. PURCHASE ORDERS
CREATE TABLE IF NOT EXISTS public.fl_purchase_orders (
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

-- 10. RECEPTIONS
CREATE TABLE IF NOT EXISTS public.fl_receptions (
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

-- 11. TRIPS
CREATE TABLE IF NOT EXISTS public.fl_trips (
  id              TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  livreur_id      TEXT REFERENCES public.fl_livreurs(id),
  statut          TEXT NOT NULL DEFAULT 'en_attente',
  bl_ids          JSONB DEFAULT '[]',
  vehicule        TEXT,
  km_depart       NUMERIC,
  km_retour       NUMERIC,
  montant_total   NUMERIC DEFAULT 0,
  cout_transport  NUMERIC DEFAULT 0,
  notes           TEXT,
  depot_id        TEXT REFERENCES public.fl_depots(id),
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 12. BONS DE LIVRAISON
CREATE TABLE IF NOT EXISTS public.fl_bons_livraison (
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
  -- Mobile BL validation (v13)
  signature_url         TEXT,
  gps_lat               NUMERIC,
  gps_lng               NUMERIC,
  valide_client_at      TIMESTAMPTZ,
  valide_client_nom     TEXT,
  notes                 TEXT,
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 13. RETOURS
CREATE TABLE IF NOT EXISTS public.fl_retours (
  id         TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  bl_id      TEXT REFERENCES public.fl_bons_livraison(id),
  client_id  TEXT REFERENCES public.fl_clients(id),
  trip_id    TEXT REFERENCES public.fl_trips(id),
  depot_id   TEXT REFERENCES public.fl_depots(id),
  motif      TEXT,
  lignes     JSONB NOT NULL DEFAULT '[]',
  total      NUMERIC NOT NULL DEFAULT 0,
  statut     TEXT NOT NULL DEFAULT 'recu',
  notes      TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. SALARIES
CREATE TABLE IF NOT EXISTS public.fl_salaries (
  id                 TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  user_id            TEXT,
  nom                TEXT NOT NULL,
  poste              TEXT,
  type_contrat       TEXT DEFAULT 'CDI',
  salaire_base       NUMERIC NOT NULL DEFAULT 0,
  indemnites         NUMERIC DEFAULT 0,
  charges_patronales NUMERIC DEFAULT 0,
  date_embauche      DATE,
  statut             TEXT DEFAULT 'actif',
  depot_id           TEXT REFERENCES public.fl_depots(id),
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- 15. PAIEMENTS SALAIRES
CREATE TABLE IF NOT EXISTS public.fl_paiements_salaires (
  id         TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  salarie_id TEXT REFERENCES public.fl_salaries(id),
  mois       TEXT NOT NULL,
  montant    NUMERIC NOT NULL DEFAULT 0,
  statut     TEXT DEFAULT 'en_attente',
  paye_le    DATE,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. CAISSE
CREATE TABLE IF NOT EXISTS public.fl_caisse_entries (
  id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  type        TEXT NOT NULL,
  categorie   TEXT,
  montant     NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  reference   TEXT,
  depot_id    TEXT REFERENCES public.fl_depots(id),
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 17. FEEDBACKS
CREATE TABLE IF NOT EXISTS public.fl_feedbacks (
  id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id     TEXT,
  user_nom    TEXT,
  type        TEXT,
  note        INTEGER DEFAULT 5,
  commentaire TEXT,
  statut      TEXT DEFAULT 'nouveau',
  traite_par  TEXT,
  traite_le   DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 18. TRIP CHARGES
CREATE TABLE IF NOT EXISTS public.fl_trip_charges (
  id         TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  trip_id    TEXT REFERENCES public.fl_trips(id),
  livreur_id TEXT REFERENCES public.fl_livreurs(id),
  type       TEXT NOT NULL,
  montant    NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  recu       TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. LOYALTY TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.fl_loyalty_transactions (
  id        TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  client_id TEXT REFERENCES public.fl_clients(id),
  date      DATE NOT NULL DEFAULT CURRENT_DATE,
  type      TEXT NOT NULL,
  points    NUMERIC NOT NULL DEFAULT 0,
  reference TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. PERFORMANCE INCENTIVES
CREATE TABLE IF NOT EXISTS public.fl_performance_incentives (
  id         TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  user_id    TEXT,
  user_nom   TEXT,
  periode    TEXT NOT NULL,
  type       TEXT NOT NULL,
  montant    NUMERIC NOT NULL DEFAULT 0,
  statut     TEXT DEFAULT 'calcule',
  valide_par TEXT,
  valide_le  DATE,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. DRIVER BONUSES
CREATE TABLE IF NOT EXISTS public.fl_driver_bonuses (
  id              TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  livreur_id      TEXT REFERENCES public.fl_livreurs(id),
  livreur_nom     TEXT,
  driver_type     TEXT NOT NULL DEFAULT 'interne',
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  trip_id         TEXT REFERENCES public.fl_trips(id),
  periode         TEXT,
  zero_retard     BOOLEAN DEFAULT FALSE,
  zero_retour     BOOLEAN DEFAULT FALSE,
  zero_qualite    BOOLEAN DEFAULT FALSE,
  montant_bonus   NUMERIC NOT NULL DEFAULT 0,
  statut          TEXT NOT NULL DEFAULT 'calcule',
  notes           TEXT,
  created_by      TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 22. VISITES COMMERCIALES
CREATE TABLE IF NOT EXISTS public.fl_visites (
  id              TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  prevendeur_id   TEXT,
  prevendeur_nom  TEXT,
  client_id       TEXT REFERENCES public.fl_clients(id),
  client_nom      TEXT,
  statut          TEXT DEFAULT 'effectuee',
  commande_passee BOOLEAN DEFAULT FALSE,
  commande_id     TEXT,
  notes           TEXT,
  gps_lat         NUMERIC,
  gps_lng         NUMERIC,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 23. TRANSPORT COMPANIES
CREATE TABLE IF NOT EXISTS public.fl_transport_companies (
  id         TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  nom        TEXT NOT NULL,
  telephone  TEXT,
  email      TEXT,
  type_tarif TEXT DEFAULT 'km',
  tarif      NUMERIC DEFAULT 0,
  zones      JSONB DEFAULT '[]',
  actif      BOOLEAN DEFAULT TRUE,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 24. CAISSES VIDES
CREATE TABLE IF NOT EXISTS public.fl_caisses_vides (
  id         TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  type       TEXT NOT NULL,
  client_id  TEXT REFERENCES public.fl_clients(id),
  livreur_id TEXT REFERENCES public.fl_livreurs(id),
  trip_id    TEXT REFERENCES public.fl_trips(id),
  sorties    INTEGER DEFAULT 0,
  retours    INTEGER DEFAULT 0,
  solde      INTEGER DEFAULT 0,
  notes      TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 25. HR TEMPLATES
CREATE TABLE IF NOT EXISTS public.fl_hr_templates (
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

-- 26. INVESTISSEMENTS
CREATE TABLE IF NOT EXISTS public.fl_investissements (
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

-- 27. PRICING INTELLIGENCE
CREATE TABLE IF NOT EXISTS public.fl_pricing_releves (
  id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date        DATE DEFAULT CURRENT_DATE,
  article_nom TEXT NOT NULL,
  marche      TEXT,
  prix        NUMERIC NOT NULL DEFAULT 0,
  unite       TEXT DEFAULT 'kg',
  source      TEXT,
  notes       TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 28. GPS TRACKING
CREATE TABLE IF NOT EXISTS public.fl_gps_positions (
  id         TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  user_id    TEXT NOT NULL,
  user_nom   TEXT,
  lat        NUMERIC NOT NULL,
  lng        NUMERIC NOT NULL,
  accuracy   NUMERIC,
  speed      NUMERIC,
  heading    NUMERIC,
  trip_id    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 29. SHAREHOLDERS
CREATE TABLE IF NOT EXISTS public.fl_shareholders (
  id         TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  nom        TEXT NOT NULL,
  parts      NUMERIC DEFAULT 0,
  email      TEXT,
  telephone  TEXT,
  actif      BOOLEAN DEFAULT TRUE,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 30. CONFIG key-value
CREATE TABLE IF NOT EXISTS public.fl_config (
  id         TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.fl_config (id, value) VALUES
  ('company', '{"nom":"Empire Fresh","appName":"FreshLink Pro","adresse":"Marche de gros, Casablanca","ville":"Casablanca, Maroc","telephone":"+212 5XX-XXXXXX","email":"contact@empire-fresh.ma","ice":"000000000000000","rc":"XXXXXX","couleurEntete":"#1a4f2a"}'::jsonb),
  ('loyalty_config', '{"actif":true,"pointsParDH":0.1,"bonusZeroRetour":50,"bonusAppOrder":20,"pointsParRemiseDH":10,"minimumPointsRachat":100,"pointsArticleCadeau":500}'::jsonb),
  ('driver_bonus_config', '{"actif":true,"bonusZeroRetard":20,"bonusZeroRetour":30,"bonusZeroQualite":25,"bonusParfait":100}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 31. ACCOUNT REQUESTS (portail externe)
CREATE TABLE IF NOT EXISTS public.fl_account_requests (
  id            TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  type          TEXT NOT NULL,
  nom           TEXT NOT NULL,
  email         TEXT NOT NULL,
  telephone     TEXT NOT NULL,
  societe       TEXT NOT NULL,
  ice           TEXT,
  ville         TEXT,
  message       TEXT,
  statut        TEXT NOT NULL DEFAULT 'en_attente',
  approved_at   TIMESTAMPTZ,
  approved_by   TEXT,
  rejected_at   TIMESTAMPTZ,
  rejected_by   TEXT,
  reject_reason TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 32. MARKETPLACE LOG
CREATE TABLE IF NOT EXISTS public.fl_marketplace_log (
  id            TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  article_id    TEXT REFERENCES public.fl_articles(id),
  article_nom   TEXT,
  action        TEXT NOT NULL,
  ancien_statut TEXT,
  nouveau_statut TEXT,
  ancien_prix   NUMERIC,
  nouveau_prix  NUMERIC,
  commentaire   TEXT,
  fait_par      TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 33. WEB INTEGRATION CONFIG (version complète v13)
CREATE TABLE IF NOT EXISTS public.fl_web_integration (
  id               TEXT PRIMARY KEY DEFAULT 'main',
  api_key          TEXT DEFAULT gen_random_uuid()::TEXT,
  enabled          BOOLEAN DEFAULT TRUE,
  allowed_origins  TEXT[] DEFAULT ARRAY['https://empire-fresh.netlify.app'],
  catalogue_public BOOLEAN DEFAULT TRUE,
  commandes_public BOOLEAN DEFAULT FALSE,
  demandes_comptes BOOLEAN DEFAULT TRUE,
  show_prices      BOOLEAN DEFAULT TRUE,
  show_promos      BOOLEAN DEFAULT TRUE,
  show_qualite     BOOLEAN DEFAULT TRUE,
  show_stock_level BOOLEAN DEFAULT FALSE,
  panier_enabled   BOOLEAN DEFAULT TRUE,
  commande_min     DECIMAL(10,2) DEFAULT 200,
  message_rupture  TEXT DEFAULT 'Article temporairement indisponible',
  message_ferme    TEXT DEFAULT 'Commandes ouvertes du Lun au Sam, 06h-18h',
  realtime_enabled BOOLEAN DEFAULT TRUE,
  webhook_url      TEXT,
  webhook_secret   TEXT,
  updated_by       TEXT,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter les colonnes manquantes si la table existe deja
ALTER TABLE public.fl_web_integration ADD COLUMN IF NOT EXISTS show_prices      BOOLEAN DEFAULT TRUE;
ALTER TABLE public.fl_web_integration ADD COLUMN IF NOT EXISTS show_promos      BOOLEAN DEFAULT TRUE;
ALTER TABLE public.fl_web_integration ADD COLUMN IF NOT EXISTS show_qualite     BOOLEAN DEFAULT TRUE;
ALTER TABLE public.fl_web_integration ADD COLUMN IF NOT EXISTS show_stock_level BOOLEAN DEFAULT FALSE;
ALTER TABLE public.fl_web_integration ADD COLUMN IF NOT EXISTS panier_enabled   BOOLEAN DEFAULT TRUE;
ALTER TABLE public.fl_web_integration ADD COLUMN IF NOT EXISTS commande_min     DECIMAL(10,2) DEFAULT 200;
ALTER TABLE public.fl_web_integration ADD COLUMN IF NOT EXISTS message_rupture  TEXT DEFAULT 'Article temporairement indisponible';
ALTER TABLE public.fl_web_integration ADD COLUMN IF NOT EXISTS message_ferme    TEXT DEFAULT 'Commandes ouvertes du Lun au Sam, 06h-18h';
ALTER TABLE public.fl_web_integration ADD COLUMN IF NOT EXISTS realtime_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.fl_web_integration ADD COLUMN IF NOT EXISTS allowed_origins  TEXT[] DEFAULT ARRAY['https://empire-fresh.netlify.app'];

INSERT INTO public.fl_web_integration (id, enabled) VALUES ('main', TRUE) ON CONFLICT (id) DO NOTHING;

-- 34. PERMISSIONS MATRIX
CREATE TABLE IF NOT EXISTS public.fl_permissions_matrix (
  id         TEXT PRIMARY KEY DEFAULT 'default',
  matrix     JSONB NOT NULL DEFAULT '{}',
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.fl_permissions_matrix (id, matrix) VALUES ('default', '{
  "admin": ["approuver_compte_client","approuver_compte_fournisseur","rejeter_demande_compte","creer_compte_manuellement","activer_article","desactiver_article","modifier_article","catalogue_toggle","voir_api_config","modifier_api_config","creer_utilisateur","modifier_utilisateur","desactiver_utilisateur","publier_marketplace","depublier_marketplace","modifier_prix_marketplace"],
  "resp_commercial": ["approuver_compte_client","rejeter_demande_compte","creer_compte_manuellement","catalogue_toggle","modifier_article","publier_marketplace","modifier_prix_marketplace"],
  "resp_logistique": ["activer_article","desactiver_article","modifier_article","catalogue_toggle","approuver_compte_fournisseur","rejeter_demande_compte"],
  "acheteur": ["approuver_compte_fournisseur","rejeter_demande_compte","modifier_article"],
  "financier": [],
  "resp_achat": ["approuver_compte_fournisseur","rejeter_demande_compte","modifier_article","catalogue_toggle"]
}'::jsonb) ON CONFLICT (id) DO NOTHING;

-- 35. STOCK MOVEMENTS
CREATE TABLE IF NOT EXISTS public.fl_stock_movements (
  id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  article_id  TEXT REFERENCES public.fl_articles(id),
  article_nom TEXT,
  type        TEXT NOT NULL,
  quantite    NUMERIC NOT NULL,
  stock_avant NUMERIC,
  stock_apres NUMERIC,
  reference_id TEXT,
  depot_id    TEXT REFERENCES public.fl_depots(id),
  fait_par    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════
-- PARTIE 2 : NOUVELLES TABLES LIAISON v13
-- ════════════════════════════════════════════════════════════════

-- 36. COMPANY CONTACTS (coordonnées publiques entreprise)
CREATE TABLE IF NOT EXISTS public.fl_company_contacts (
  id                  TEXT PRIMARY KEY DEFAULT 'main',
  nom_societe         TEXT,
  slogan              TEXT,
  adresse_ligne1      TEXT,
  adresse_ligne2      TEXT,
  code_postal         TEXT,
  ville               TEXT DEFAULT 'Casablanca',
  pays                TEXT DEFAULT 'Maroc',
  tel_principal       TEXT,
  tel_secondaire      TEXT,
  tel_urgence         TEXT,
  whatsapp_principal  TEXT,
  whatsapp_commercial TEXT,
  whatsapp_livraison  TEXT,
  email_principal     TEXT,
  email_commercial    TEXT,
  email_comptabilite  TEXT,
  email_rh            TEXT,
  instagram           TEXT,
  facebook            TEXT,
  linkedin            TEXT,
  tiktok              TEXT,
  youtube             TEXT,
  horaires_ouverture  TEXT,
  horaires_livraison  TEXT,
  zone_livraison      TEXT,
  ice                 TEXT,
  rc                  TEXT,
  gps_lat             DECIMAL(10,6),
  gps_lng             DECIMAL(10,6),
  logo_url            TEXT,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 37. PROSPECTS (demandes de compte depuis le site web)
CREATE TABLE IF NOT EXISTS public.fl_prospects (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  nom_societe         TEXT NOT NULL,
  nom_contact         TEXT NOT NULL,
  telephone           TEXT NOT NULL,
  whatsapp            TEXT,
  email               TEXT,
  adresse             TEXT,
  ville               TEXT DEFAULT 'Casablanca',
  type_activite       TEXT DEFAULT 'autre',
  nb_couverts         INTEGER,
  nb_chambres         INTEGER,
  familles_souhaitees TEXT[],
  volume_estime       TEXT,
  message             TEXT,
  statut              TEXT DEFAULT 'nouveau',
  traite_par          TEXT,
  note_interne        TEXT,
  client_id           TEXT,
  source              TEXT DEFAULT 'site_web',
  ip_address          TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 38. COMMANDES WEB (panier depuis empire-fresh.netlify.app)
CREATE TABLE IF NOT EXISTS public.fl_commandes_web (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  numero            TEXT UNIQUE NOT NULL DEFAULT ('WEB-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD((EXTRACT(EPOCH FROM NOW())::BIGINT % 9999 + 1)::TEXT,4,'0')),
  client_id         TEXT,
  prospect_id       TEXT,
  nom_client        TEXT NOT NULL,
  telephone         TEXT NOT NULL,
  email             TEXT,
  adresse_livraison TEXT,
  lignes            JSONB DEFAULT '[]',
  montant_total     DECIMAL(12,2) DEFAULT 0,
  date_souhaitee    DATE,
  creneau           TEXT,
  instructions      TEXT,
  statut            TEXT DEFAULT 'nouveau',
  commande_id       TEXT,
  traite_par        TEXT,
  note_interne      TEXT,
  source            TEXT DEFAULT 'site_web',
  ip_address        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 39. DOCUMENTS CHR/HORECA (Devis, Contrats, BL archivés)
CREATE TABLE IF NOT EXISTS public.fl_documents (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  numero       TEXT UNIQUE NOT NULL,
  type_doc     TEXT NOT NULL,
  client_id    TEXT,
  client_nom   TEXT NOT NULL,
  commande_id  TEXT,
  bl_id        TEXT,
  lignes       JSONB DEFAULT '[]',
  montant_ht   DECIMAL(12,2) DEFAULT 0,
  tva_pct      DECIMAL(5,2) DEFAULT 0,
  montant_tva  DECIMAL(12,2) DEFAULT 0,
  montant_ttc  DECIMAL(12,2) DEFAULT 0,
  remise_pct   DECIMAL(5,2) DEFAULT 0,
  montant_net  DECIMAL(12,2) DEFAULT 0,
  date_doc     DATE DEFAULT CURRENT_DATE,
  date_validite DATE,
  date_debut   DATE,
  date_fin     DATE,
  statut       TEXT DEFAULT 'brouillon',
  signe_par    TEXT,
  signe_le     TIMESTAMPTZ,
  signature_url TEXT,
  notes        TEXT,
  html_cache   TEXT,
  created_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════
-- PARTIE 3 : SEED DATA INITIAL
-- ════════════════════════════════════════════════════════════════

INSERT INTO public.fl_web_integration (
  id, enabled, catalogue_public, commandes_public, panier_enabled,
  show_prices, show_promos, show_qualite, show_stock_level,
  commande_min, realtime_enabled, allowed_origins,
  message_rupture, message_ferme
) VALUES (
  'main', TRUE, TRUE, FALSE, TRUE,
  TRUE, TRUE, TRUE, FALSE,
  200.00, TRUE,
  ARRAY['https://empire-fresh.netlify.app','http://localhost:3000','http://localhost:3001'],
  'Article temporairement indisponible',
  'Commandes ouvertes du Lundi au Samedi, 06h00-18h00'
)
ON CONFLICT (id) DO UPDATE SET
  enabled=TRUE, catalogue_public=TRUE, panier_enabled=TRUE,
  show_prices=TRUE, show_promos=TRUE, show_qualite=TRUE,
  commande_min=200.00, realtime_enabled=TRUE,
  allowed_origins=ARRAY['https://empire-fresh.netlify.app','http://localhost:3000','http://localhost:3001'],
  updated_at=NOW();

INSERT INTO public.fl_company_contacts (
  id, nom_societe, slogan,
  adresse_ligne1, ville, pays,
  tel_principal, whatsapp_principal,
  email_principal, email_commercial,
  horaires_ouverture, horaires_livraison, zone_livraison,
  gps_lat, gps_lng
) VALUES (
  'main', 'Empire Fresh', 'La fraicheur livree chaque matin',
  'Marche de gros', 'Casablanca', 'Maroc',
  '+212 5XX-XXXXXX', '+212 6XX-XXXXXX',
  'contact@empire-fresh.ma', 'commercial@empire-fresh.ma',
  'Lundi - Samedi : 06h00 - 18h00', 'Livraison : 06h00 - 12h00', 'Grand Casablanca',
  33.5731, -7.5898
)
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- PARTIE 4 : INDEXES PERFORMANCE
-- ════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_articles_famille       ON public.fl_articles(famille);
CREATE INDEX IF NOT EXISTS idx_articles_actif         ON public.fl_articles(actif);
CREATE INDEX IF NOT EXISTS idx_articles_visible_web   ON public.fl_articles(visible_web, statut_web);
CREATE INDEX IF NOT EXISTS idx_articles_marketplace   ON public.fl_articles(marketplace_actif, marketplace_statut);
CREATE INDEX IF NOT EXISTS idx_commandes_date         ON public.fl_commandes(date);
CREATE INDEX IF NOT EXISTS idx_commandes_client       ON public.fl_commandes(client_id);
CREATE INDEX IF NOT EXISTS idx_commandes_statut       ON public.fl_commandes(statut);
CREATE INDEX IF NOT EXISTS idx_bl_trip                ON public.fl_bons_livraison(trip_id);
CREATE INDEX IF NOT EXISTS idx_bl_valide_mag          ON public.fl_bons_livraison(valide_magasinier);
CREATE INDEX IF NOT EXISTS idx_trips_date             ON public.fl_trips(date);
CREATE INDEX IF NOT EXISTS idx_trips_livreur          ON public.fl_trips(livreur_id);
CREATE INDEX IF NOT EXISTS idx_users_role             ON public.fl_users(role);
CREATE INDEX IF NOT EXISTS idx_gps_user_recent        ON public.fl_gps_positions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_art    ON public.fl_stock_movements(article_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date   ON public.fl_stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospects_statut       ON public.fl_prospects(statut);
CREATE INDEX IF NOT EXISTS idx_commandes_web_statut   ON public.fl_commandes_web(statut);
CREATE INDEX IF NOT EXISTS idx_commandes_web_tel      ON public.fl_commandes_web(telephone);
CREATE INDEX IF NOT EXISTS idx_documents_type         ON public.fl_documents(type_doc);
CREATE INDEX IF NOT EXISTS idx_documents_client       ON public.fl_documents(client_id);

-- ════════════════════════════════════════════════════════════════
-- PARTIE 5 : TRIGGERS updated_at
-- ════════════════════════════════════════════════════════════════

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fl_depots','fl_users','fl_clients','fl_fournisseurs','fl_articles',
    'fl_livreurs','fl_commandes','fl_bons_achat','fl_purchase_orders',
    'fl_receptions','fl_trips','fl_bons_livraison','fl_retours','fl_salaries',
    'fl_hr_templates','fl_prospects','fl_commandes_web','fl_documents'
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

-- ════════════════════════════════════════════════════════════════
-- PARTIE 6 : VUES PUBLIQUES
-- ════════════════════════════════════════════════════════════════

-- Vue catalogue pour l'API publique (utilise les champs v13 statut_web/visible_web)
CREATE OR REPLACE VIEW public.v_marketplace_catalogue AS
SELECT
  a.id,
  a.nom,
  a.nom_ar,
  a.famille,
  a.unite,
  a.photo,
  a.photos,
  a.description,
  a.statut_web,
  a.visible_web,
  a.promo_active,
  a.promo_taux,
  a.promo_label,
  a.promo_fin,
  a.criteres_qualite,
  a.prix_public,
  a.tags,
  a.position_catalogue,
  CASE WHEN a.promo_active AND a.promo_taux > 0
    THEN ROUND(a.prix_public * (1 - a.promo_taux / 100), 2)
    ELSE a.prix_public
  END AS prix_final,
  a.stock_disponible,
  a.updated_at
FROM public.fl_articles a
WHERE a.visible_web = TRUE AND a.actif = TRUE
ORDER BY a.position_catalogue ASC, a.nom ASC;

-- Vue demandes en attente
CREATE OR REPLACE VIEW public.v_prospects_pending AS
SELECT * FROM public.fl_prospects WHERE statut = 'nouveau' ORDER BY created_at ASC;

-- Vue commandes web en attente
CREATE OR REPLACE VIEW public.v_commandes_web_pending AS
SELECT * FROM public.fl_commandes_web WHERE statut = 'nouveau' ORDER BY created_at ASC;

-- Vue stock alertes
CREATE OR REPLACE VIEW public.v_stock_alertes AS
SELECT
  a.id, a.nom, a.famille, a.unite, a.stock_disponible,
  a.marketplace_seuil_short_stock AS seuil,
  a.visible_web,
  CASE
    WHEN a.stock_disponible <= 0 THEN 'rupture'
    WHEN a.stock_disponible < COALESCE(a.marketplace_seuil_short_stock, 20) THEN 'alerte'
    ELSE 'ok'
  END AS niveau_alerte
FROM public.fl_articles a
WHERE a.actif = TRUE
  AND (a.stock_disponible <= 0 OR a.stock_disponible < COALESCE(a.marketplace_seuil_short_stock, 20))
ORDER BY a.stock_disponible ASC;

-- ════════════════════════════════════════════════════════════════
-- PARTIE 7 : ROW LEVEL SECURITY + REALTIME
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.fl_web_integration  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_company_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_prospects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fl_commandes_web    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_web_config"  ON public.fl_web_integration;
CREATE POLICY "public_read_web_config" ON public.fl_web_integration FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "public_read_contacts"    ON public.fl_company_contacts;
CREATE POLICY "public_read_contacts" ON public.fl_company_contacts FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "public_insert_prospects" ON public.fl_prospects;
CREATE POLICY "public_insert_prospects" ON public.fl_prospects FOR INSERT WITH CHECK (source = 'site_web');

DROP POLICY IF EXISTS "public_read_prospects"   ON public.fl_prospects;
CREATE POLICY "public_read_prospects" ON public.fl_prospects FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "public_insert_commandes" ON public.fl_commandes_web;
CREATE POLICY "public_insert_commandes" ON public.fl_commandes_web FOR INSERT WITH CHECK (source = 'site_web');

DROP POLICY IF EXISTS "public_read_commandes"   ON public.fl_commandes_web;
CREATE POLICY "public_read_commandes" ON public.fl_commandes_web FOR SELECT USING (TRUE);

-- REALTIME — Activer sur les tables de liaison
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.fl_articles;         EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.fl_web_integration;  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.fl_company_contacts; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.fl_prospects;        EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.fl_commandes_web;    EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- ════════════════════════════════════════════════════════════════
-- VERIFICATION FINALE
-- ════════════════════════════════════════════════════════════════

SELECT table_name, 'OK' AS statut
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'fl_depots','fl_users','fl_clients','fl_fournisseurs','fl_articles',
    'fl_livreurs','fl_commandes','fl_bons_achat','fl_purchase_orders',
    'fl_receptions','fl_trips','fl_bons_livraison','fl_retours',
    'fl_salaries','fl_paiements_salaires','fl_caisse_entries',
    'fl_feedbacks','fl_trip_charges','fl_loyalty_transactions',
    'fl_performance_incentives','fl_driver_bonuses','fl_visites',
    'fl_transport_companies','fl_caisses_vides','fl_hr_templates',
    'fl_investissements','fl_pricing_releves','fl_gps_positions',
    'fl_shareholders','fl_config','fl_account_requests','fl_marketplace_log',
    'fl_web_integration','fl_permissions_matrix','fl_stock_movements',
    'fl_company_contacts','fl_prospects','fl_commandes_web','fl_documents'
  )
ORDER BY table_name;
