-- ============================================================
-- EMPIRE FRESH — SCHEMA COMPLET v11 (UNIQUE — SEUL SCRIPT)
-- Supabase: https://nphrncmuxbwahqnzdyxp.supabase.co
-- Date: 2026 | Auteur: Jawad
-- 30 tables metier + fl_config | RLS desactivee (auth maison)
-- Couvre: Users, Clients, Fournisseurs, Articles, Commandes,
--         Achats, PO, Receptions, Trips, BL, Retours, Salaries,
--         RH, Finance, Caisse, Feedbacks, Trip Charges, Loyalty,
--         Incentives, Config (key-value)
-- ============================================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ══════════════════════════════════════════════════════════════
-- 1. DEPOTS (multi-entrepot)
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

-- Depot par defaut
INSERT INTO public.fl_depots (id, nom, actif) VALUES
  ('DEPOT_PRINCIPAL', 'Depot Principal', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 2. UTILISATEURS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_users CASCADE;
CREATE TABLE public.fl_users (
  id                             TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  name                           TEXT NOT NULL,
  email                          TEXT UNIQUE NOT NULL,
  password                       TEXT NOT NULL DEFAULT '1234',
  password_mobile                TEXT,
  password_bo                    TEXT,
  role                           TEXT NOT NULL DEFAULT 'prevendeur',
  access_type                    TEXT,           -- 'mobile' | 'backoffice' | 'both'
  secteur                        TEXT,
  phone                          TEXT,
  telephone                      TEXT,
  actif                          BOOLEAN DEFAULT TRUE,
  photo_url                      TEXT,
  require_camera_auth            BOOLEAN DEFAULT FALSE,
  -- Permissions granulaires
  can_view_achat                 BOOLEAN DEFAULT FALSE,
  can_view_commercial            BOOLEAN DEFAULT FALSE,
  can_view_logistique            BOOLEAN DEFAULT FALSE,
  can_view_stock                 BOOLEAN DEFAULT FALSE,
  can_view_cash                  BOOLEAN DEFAULT FALSE,
  can_view_finance               BOOLEAN DEFAULT FALSE,
  can_view_recap                 BOOLEAN DEFAULT FALSE,
  can_view_database              BOOLEAN DEFAULT FALSE,
  can_view_external              BOOLEAN DEFAULT FALSE,
  can_create_commande_bo         BOOLEAN DEFAULT FALSE,
  -- Objectifs prevendeur
  objectif_clients               INTEGER DEFAULT 0,
  objectif_tonnage               INTEGER DEFAULT 0,
  objectif_journalier_ca         NUMERIC DEFAULT 0,
  objectif_hebdomadaire_ca       NUMERIC DEFAULT 0,
  objectif_mensuel_ca            NUMERIC DEFAULT 0,
  objectif_journalier_clients    INTEGER DEFAULT 0,
  objectif_hebdomadaire_clients  INTEGER DEFAULT 0,
  objectif_mensuel_clients       INTEGER DEFAULT 0,
  -- Notifications workflow
  notif_achat                    BOOLEAN DEFAULT FALSE,
  notif_commercial               BOOLEAN DEFAULT FALSE,
  notif_livraison                BOOLEAN DEFAULT FALSE,
  notif_recap                    BOOLEAN DEFAULT FALSE,
  notif_besoin_achat             BOOLEAN DEFAULT FALSE,
  -- Liens portail
  fournisseur_id                 TEXT,
  client_id                      TEXT,
  -- Multi-depot
  depot_id                       TEXT REFERENCES public.fl_depots(id) ON DELETE SET NULL,
  created_at                     TIMESTAMPTZ DEFAULT NOW(),
  updated_at                     TIMESTAMPTZ DEFAULT NOW()
);

-- Super admin par defaut
INSERT INTO public.fl_users (id, name, email, password, role, actif,
  can_view_achat, can_view_commercial, can_view_logistique, can_view_stock,
  can_view_cash, can_view_finance, can_view_recap, can_view_database, can_view_external, can_create_commande_bo)
VALUES (
  'SUPER_ADMIN_001', 'Admin Principal', 'admin@optimflux.ma', '1234', 'super_admin', TRUE,
  TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE
) ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 3. CLIENTS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_clients CASCADE;
CREATE TABLE public.fl_clients (
  id                          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  nom                         TEXT NOT NULL,
  secteur                     TEXT NOT NULL DEFAULT '',
  zone                        TEXT NOT NULL DEFAULT '',
  type                        TEXT NOT NULL DEFAULT 'marchand',
  type_autre                  TEXT,
  taille                      TEXT DEFAULT '50-100kg',
  type_produits               TEXT DEFAULT 'moyenne',
  rotation                    TEXT DEFAULT 'journalier',
  modalite_paiement           TEXT,
  plafond_credit              NUMERIC DEFAULT 0,
  credit_autorise             BOOLEAN DEFAULT FALSE,
  delai_recouvrement          TEXT,
  credit_workflow_validateur  TEXT,
  credit_workflow_validateur_nom TEXT,
  credit_statut               TEXT DEFAULT 'ok',
  credit_solde                NUMERIC DEFAULT 0,
  gps_lat                     NUMERIC,
  gps_lng                     NUMERIC,
  telephone                   TEXT,
  email                       TEXT,
  adresse                     TEXT,
  ice                         TEXT,
  notes                       TEXT,
  created_by                  TEXT NOT NULL DEFAULT '',
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  prevendeur_id               TEXT,
  team_lead_id                TEXT,
  default_heure_livraison     TEXT
);

-- ══════════════════════════════════════════════════════════════
-- 4. FOURNISSEURS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_fournisseurs CASCADE;
CREATE TABLE public.fl_fournisseurs (
  id                 TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  nom                TEXT NOT NULL,
  contact            TEXT NOT NULL DEFAULT '',
  telephone          TEXT,
  email              TEXT NOT NULL DEFAULT '',
  adresse            TEXT,
  ville              TEXT,
  region             TEXT,
  specialites        JSONB DEFAULT '[]',
  modalite_paiement  TEXT,
  delai_paiement     INTEGER,
  ice                TEXT,
  rc                 TEXT,
  notes              TEXT,
  itineraires        JSONB DEFAULT '[]',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 5. ARTICLES (catalogue produits)
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_articles CASCADE;
CREATE TABLE public.fl_articles (
  id                     TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  nom                    TEXT NOT NULL,
  nom_ar                 TEXT NOT NULL DEFAULT '',
  famille                TEXT NOT NULL DEFAULT '',
  unite                  TEXT NOT NULL DEFAULT 'kg',
  um                     TEXT,
  colisage_par_um        NUMERIC,
  colisage_caisses       NUMERIC,
  colisage_demi_caisses  NUMERIC,
  stock_disponible       NUMERIC DEFAULT 0,
  stock_defect           NUMERIC DEFAULT 0,
  stock_reel             NUMERIC,
  stock_reel_date        DATE,
  stock_reel_saisi_par   TEXT,
  stock_theorique        NUMERIC,
  shelf_life_jours       INTEGER,
  alerte_shelf_life_jours INTEGER,
  prix_liquidation       NUMERIC,
  prix_achat             NUMERIC NOT NULL DEFAULT 0,
  pv_methode             TEXT DEFAULT 'pourcentage',  -- 'pourcentage' | 'montant' | 'manuel'
  pv_valeur              NUMERIC DEFAULT 0,
  marge_methode          TEXT,
  lots                   JSONB DEFAULT '[]',
  historique_prix_achat  JSONB DEFAULT '[]',
  photo                  TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 6. LIVREURS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_livreurs CASCADE;
CREATE TABLE public.fl_livreurs (
  id                TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  type              TEXT NOT NULL DEFAULT 'interne',  -- 'interne' | 'externe'
  nom               TEXT NOT NULL,
  prenom            TEXT NOT NULL DEFAULT '',
  telephone         TEXT NOT NULL DEFAULT '',
  cin               TEXT,
  photo_cin         TEXT,
  photo_perso       TEXT,
  type_vehicule     TEXT,
  marque_vehicule   TEXT,
  matricule         TEXT,
  capacite_caisses  INTEGER,
  capacite_tonnage  NUMERIC,
  photo_cart_grise  TEXT,
  photo_permis      TEXT,
  societe           TEXT,
  notes             TEXT,
  actif             BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 7. COMMANDES
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_commandes CASCADE;
CREATE TABLE public.fl_commandes (
  id                   TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date                 DATE NOT NULL DEFAULT CURRENT_DATE,
  commercial_id        TEXT NOT NULL DEFAULT '',
  commercial_nom       TEXT NOT NULL DEFAULT '',
  client_id            TEXT NOT NULL DEFAULT '',
  client_nom           TEXT NOT NULL DEFAULT '',
  secteur              TEXT NOT NULL DEFAULT '',
  zone                 TEXT NOT NULL DEFAULT '',
  gps_lat              NUMERIC DEFAULT 0,
  gps_lng              NUMERIC DEFAULT 0,
  lignes               JSONB NOT NULL DEFAULT '[]',   -- LigneCommande[]
  heure_livraison      TEXT DEFAULT '',
  statut               TEXT NOT NULL DEFAULT 'en_attente',
  email_destinataire   TEXT DEFAULT '',
  team_lead_id         TEXT,
  team_lead_nom        TEXT,
  approbateur          TEXT,
  approbateur_id       TEXT,
  date_approbation     TIMESTAMPTZ,
  motif_refus          TEXT,
  commentaire          TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 8. BONS D'ACHAT
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_bons_achat CASCADE;
CREATE TABLE public.fl_bons_achat (
  id                   TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date                 DATE NOT NULL DEFAULT CURRENT_DATE,
  acheteur_id          TEXT NOT NULL DEFAULT '',
  acheteur_nom         TEXT NOT NULL DEFAULT '',
  fournisseur_id       TEXT NOT NULL DEFAULT '',
  fournisseur_nom      TEXT NOT NULL DEFAULT '',
  lignes               JSONB NOT NULL DEFAULT '[]',   -- LigneAchat[]
  statut               TEXT NOT NULL DEFAULT 'brouillon',  -- 'brouillon' | 'valide' | 'receptionne'
  email_destinataire   TEXT DEFAULT '',
  depot_id             TEXT REFERENCES public.fl_depots(id) ON DELETE SET NULL,
  depot_nom            TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 9. PURCHASE ORDERS (PO Push — acheteur terrain)
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_purchase_orders CASCADE;
CREATE TABLE public.fl_purchase_orders (
  id                TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  article_id        TEXT NOT NULL DEFAULT '',
  article_nom       TEXT NOT NULL DEFAULT '',
  article_unite     TEXT NOT NULL DEFAULT 'kg',
  fournisseur_id    TEXT NOT NULL DEFAULT '',
  fournisseur_nom   TEXT NOT NULL DEFAULT '',
  fournisseur_email TEXT DEFAULT '',
  quantite          NUMERIC NOT NULL DEFAULT 0,
  prix_unitaire     NUMERIC NOT NULL DEFAULT 0,
  total             NUMERIC NOT NULL DEFAULT 0,
  statut            TEXT NOT NULL DEFAULT 'ouvert',  -- 'ouvert' | 'envoye' | 'receptionne' | 'annule'
  notes             TEXT DEFAULT '',
  created_by        TEXT NOT NULL DEFAULT '',
  commande_qty      NUMERIC,
  stock_qty         NUMERIC,
  retour_qty        NUMERIC,
  montant_paye      NUMERIC DEFAULT 0,
  statut_paiement   TEXT DEFAULT 'impaye',           -- 'impaye' | 'partiel' | 'solde'
  date_paiement     DATE,
  note_paiement     TEXT,
  depot_id          TEXT REFERENCES public.fl_depots(id) ON DELETE SET NULL,
  depot_nom         TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 10. RECEPTIONS (magasinier)
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_receptions CASCADE;
CREATE TABLE public.fl_receptions (
  id                TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  bon_achat_id      TEXT DEFAULT '',
  purchase_order_id TEXT,
  fournisseur_nom   TEXT,
  source            TEXT NOT NULL DEFAULT 'bon_achat',  -- 'bon_achat' | 'purchase_order' | 'manuel'
  lignes            JSONB NOT NULL DEFAULT '[]',
  statut            TEXT NOT NULL DEFAULT 'en_attente',  -- 'en_attente' | 'stand_by' | 'partielle' | 'validee'
  operateur_id      TEXT NOT NULL DEFAULT '',
  notes             TEXT,
  depot_id          TEXT REFERENCES public.fl_depots(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 11. TRIPS (tournees de livraison)
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_trips CASCADE;
CREATE TABLE public.fl_trips (
  id                    TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  numero                TEXT,
  date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  livreur_id            TEXT NOT NULL DEFAULT '',
  livreur_nom           TEXT NOT NULL DEFAULT '',
  vehicule              TEXT NOT NULL DEFAULT '',
  commande_ids          JSONB DEFAULT '[]',
  statut                TEXT NOT NULL DEFAULT 'planifie',  -- 'planifie' | 'en_cours' | 'termine'
  itineraire            JSONB DEFAULT '[]',
  sequence_mode         TEXT DEFAULT 'itineraire',
  km_depart             NUMERIC,
  km_arrivee            NUMERIC,
  km_total              NUMERIC,
  nb_caisses_by_article JSONB DEFAULT '{}',
  caisses_validees      BOOLEAN DEFAULT FALSE,
  km_depart_confirme    BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 12. BONS DE LIVRAISON (BL)
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_bons_livraison CASCADE;
CREATE TABLE public.fl_bons_livraison (
  id                          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date                        DATE NOT NULL DEFAULT CURRENT_DATE,
  trip_id                     TEXT NOT NULL DEFAULT '',
  commande_id                 TEXT NOT NULL DEFAULT '',
  client_nom                  TEXT NOT NULL DEFAULT '',
  secteur                     TEXT NOT NULL DEFAULT '',
  zone                        TEXT NOT NULL DEFAULT '',
  livreur_nom                 TEXT NOT NULL DEFAULT '',
  prevendeur_nom              TEXT NOT NULL DEFAULT '',
  lignes                      JSONB NOT NULL DEFAULT '[]',  -- LigneBL[]
  montant_total               NUMERIC NOT NULL DEFAULT 0,
  tva                         NUMERIC NOT NULL DEFAULT 0,
  montant_ttc                 NUMERIC NOT NULL DEFAULT 0,
  statut                      TEXT NOT NULL DEFAULT 'emis',  -- 'emis' | 'encaisse' | 'retour_partiel'
  statut_livraison            TEXT NOT NULL DEFAULT 'livre',  -- 'livre' | 'premier_passage' | 'deuxieme_passage' | 'retour'
  motif_retour                TEXT,
  valide_magasinier           BOOLEAN DEFAULT FALSE,
  heure_livraison_reelle      TEXT,
  heure_effective             TEXT,
  nb_colis                    INTEGER,
  nb_caisse_gros              INTEGER DEFAULT 0,
  nb_caisse_demi              INTEGER DEFAULT 0,
  montant_caisses             NUMERIC DEFAULT 0,
  caisse_pricing              JSONB,
  frais_impression_par_feuille NUMERIC DEFAULT 0,
  nb_feuilles                 INTEGER DEFAULT 1,
  frais_service_par_caisse    NUMERIC DEFAULT 0,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 13. RETOURS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_retours CASCADE;
CREATE TABLE public.fl_retours (
  id               TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date             DATE NOT NULL DEFAULT CURRENT_DATE,
  trip_id          TEXT NOT NULL DEFAULT '',
  livreur_nom      TEXT NOT NULL DEFAULT '',
  lignes           JSONB NOT NULL DEFAULT '[]',  -- LigneRetour[]
  statut           TEXT NOT NULL DEFAULT 'en_attente',  -- 'en_attente' | 'valide'
  valide_par       TEXT,
  date_validation  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 14. VISITES PREVENDEUR
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_visites CASCADE;
CREATE TABLE public.fl_visites (
  id                   TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date                 DATE NOT NULL DEFAULT CURRENT_DATE,
  prevendeur_id        TEXT NOT NULL DEFAULT '',
  prevendeur_nom       TEXT NOT NULL DEFAULT '',
  client_id            TEXT NOT NULL DEFAULT '',
  client_nom           TEXT NOT NULL DEFAULT '',
  commande_id          TEXT,
  resultat             TEXT NOT NULL DEFAULT 'commande',  -- 'commande' | 'sans_commande'
  raison_sans_commande TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 15. MOUVEMENTS CAISSE VIDE
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_caisses_mouvements CASCADE;
CREATE TABLE public.fl_caisses_mouvements (
  id              TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  heure           TEXT,
  type_operation  TEXT NOT NULL DEFAULT 'manuel',  -- 'ctrl_achat' | 'reception' | 'expedition' | 'achat' | 'retour' | 'manuel'
  sens            TEXT NOT NULL DEFAULT 'sortie',  -- 'sortie' | 'entree'
  nb_caisse_gros  INTEGER DEFAULT 0,
  nb_caisse_demi  INTEGER DEFAULT 0,
  reference_doc   TEXT,
  article_nom     TEXT,
  operateur_id    TEXT NOT NULL DEFAULT '',
  operateur_nom   TEXT NOT NULL DEFAULT '',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 16. CONTENANTS TARES (configurables)
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_contenants_tare CASCADE;
CREATE TABLE public.fl_contenants_tare (
  id        TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  nom       TEXT NOT NULL,
  poids_kg  NUMERIC NOT NULL DEFAULT 0,
  actif     BOOLEAN DEFAULT TRUE,
  notes     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.fl_contenants_tare (id, nom, poids_kg, actif, notes) VALUES
  ('ct1', 'Caisse plastique (gros)', 2.8,  TRUE,  'Caisse standard 30kg'),
  ('ct2', 'Petit caisse (demi)',      2.0,  TRUE,  'Demi-caisse 15kg'),
  ('ct3', 'Chario',                   15.0, FALSE, 'Poids a configurer selon le chario utilise'),
  ('ct4', 'Palette bois',             20.0, FALSE, 'Palette europeenne standard')
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 17. TRANSFERTS STOCK
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_transferts_stock CASCADE;
CREATE TABLE public.fl_transferts_stock (
  id           TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  article_id   TEXT NOT NULL DEFAULT '',
  article_nom  TEXT NOT NULL DEFAULT '',
  quantite     NUMERIC NOT NULL DEFAULT 0,
  sens         TEXT NOT NULL DEFAULT 'conforme_vers_defect',
  motif        TEXT NOT NULL DEFAULT '',
  operateur_id TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 18. MESSAGES / CHAT INTERNE
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_messages CASCADE;
CREATE TABLE public.fl_messages (
  id           TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  sender_id    TEXT NOT NULL DEFAULT '',
  sender_name  TEXT NOT NULL DEFAULT '',
  role         TEXT NOT NULL DEFAULT '',
  text         TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 19. NOTICES / RECLAMATIONS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_notices CASCADE;
CREATE TABLE public.fl_notices (
  id           TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  titre        TEXT NOT NULL DEFAULT '',
  contenu      TEXT NOT NULL DEFAULT '',
  auteur_id    TEXT NOT NULL DEFAULT '',
  auteur_nom   TEXT NOT NULL DEFAULT '',
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  type         TEXT NOT NULL DEFAULT 'notice',  -- 'notice' | 'reclamation'
  statut       TEXT NOT NULL DEFAULT 'ouvert',  -- 'ouvert' | 'traite'
  destinataire TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 20. SIGNALEMENTS NON-ACHAT
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_non_achat_signalements CASCADE;
CREATE TABLE public.fl_non_achat_signalements (
  id           TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  acheteur_id  TEXT NOT NULL DEFAULT '',
  acheteur_nom TEXT NOT NULL DEFAULT '',
  article_id   TEXT NOT NULL DEFAULT '',
  article_nom  TEXT NOT NULL DEFAULT '',
  besoin_qte   NUMERIC DEFAULT 0,
  motif        TEXT NOT NULL DEFAULT '',
  commentaire  TEXT,
  statut       TEXT NOT NULL DEFAULT 'signale',  -- 'signale' | 'pris_en_compte' | 'resolu'
  notifie_a    JSONB DEFAULT '[]',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 21. MOTIFS RETOUR (configurables)
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_motifs_retour CASCADE;
CREATE TABLE public.fl_motifs_retour (
  id         TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  label      TEXT NOT NULL,
  label_ar   TEXT NOT NULL DEFAULT '',
  actif      BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.fl_motifs_retour (id, label, label_ar, actif) VALUES
  ('mr1', 'Qualite insuffisante',        'جودة غير كافية',       TRUE),
  ('mr2', 'Commande erronee',            'طلبية خاطئة',           TRUE),
  ('mr3', 'Client absent',               'العميل غائب',           TRUE),
  ('mr4', 'Prix conteste',               'خلاف على السعر',        TRUE),
  ('mr5', 'Quantite commandee excessive','الكمية المطلوبة مفرطة',  TRUE),
  ('mr6', 'Autre',                       'سبب آخر',               TRUE)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 22. SALARIES (Ressources Humaines)
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_salaries CASCADE;
CREATE TABLE public.fl_salaries (
  id                    TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  civilite              TEXT NOT NULL DEFAULT 'M.',
  nom                   TEXT NOT NULL,
  prenom                TEXT NOT NULL DEFAULT '',
  poste                 TEXT NOT NULL DEFAULT '',
  departement           TEXT,
  telephone             TEXT,
  email                 TEXT,
  adresse               TEXT,
  ville                 TEXT,
  cin                   TEXT,
  cnss                  TEXT,
  num_compte_bancaire   TEXT,
  banque                TEXT,
  date_embauche         TEXT NOT NULL DEFAULT '',
  date_fin_cdd          TEXT,
  type_contrat          TEXT NOT NULL DEFAULT 'cdi',     -- 'cdi' | 'cdd' | 'interim' | 'saisonnier'
  salaire_brut          NUMERIC NOT NULL DEFAULT 0,
  salaire_net           NUMERIC,
  avances               NUMERIC DEFAULT 0,
  mode_paiement         TEXT DEFAULT 'virement',
  nationalite           TEXT,
  date_naissance        TEXT,
  lieu_naissance        TEXT,
  diplome               TEXT,
  experience_ans        INTEGER,
  statut_familial       TEXT,
  nb_enfants            INTEGER DEFAULT 0,
  statut                TEXT NOT NULL DEFAULT 'actif',   -- 'actif' | 'conge' | 'periode_essai' | 'inactif'
  notes                 TEXT,
  dossier_complet       BOOLEAN DEFAULT FALSE,
  created_by            TEXT NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_by            TEXT,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 23. RH NOTIFICATIONS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_rh_notifications CASCADE;
CREATE TABLE public.fl_rh_notifications (
  id           TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  type         TEXT NOT NULL DEFAULT 'nouveau_salarie',
  titre        TEXT NOT NULL DEFAULT '',
  message      TEXT NOT NULL DEFAULT '',
  salarie_id   TEXT,
  salarie_nom  TEXT,
  user_id      TEXT,
  created_by   TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  lu           BOOLEAN DEFAULT FALSE,
  traite       BOOLEAN DEFAULT FALSE
);

-- ══════════════════════════════════════════════════════════════
-- 24. PAIEMENTS SALAIRES
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_paiements_salaires CASCADE;
CREATE TABLE public.fl_paiements_salaires (
  id           TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  salarie_id   TEXT NOT NULL DEFAULT '',
  salarie_nom  TEXT NOT NULL DEFAULT '',
  mois         TEXT NOT NULL DEFAULT '',             -- 'YYYY-MM'
  salaire_brut NUMERIC NOT NULL DEFAULT 0,
  avance       NUMERIC DEFAULT 0,
  salaire_net  NUMERIC NOT NULL DEFAULT 0,
  date_paiement TEXT NOT NULL DEFAULT '',
  created_by   TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 25. FINANCE — CHARGES & CAISSE
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_charges CASCADE;
CREATE TABLE public.fl_charges (
  id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  libelle     TEXT NOT NULL DEFAULT '',
  categorie   TEXT NOT NULL DEFAULT 'autre',
  montant     NUMERIC NOT NULL DEFAULT 0,
  recurrente  BOOLEAN DEFAULT FALSE,
  created_by  TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

DROP TABLE IF EXISTS public.fl_caisse_entries CASCADE;
CREATE TABLE public.fl_caisse_entries (
  id         TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  libelle    TEXT NOT NULL DEFAULT '',
  type       TEXT NOT NULL DEFAULT 'entree',        -- 'entree' | 'sortie'
  categorie  TEXT NOT NULL DEFAULT 'autre',
  montant    NUMERIC NOT NULL DEFAULT 0,
  reference  TEXT,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TABLE IF EXISTS public.fl_actionnaires CASCADE;
CREATE TABLE public.fl_actionnaires (
  id                   TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  nom                  TEXT NOT NULL,
  prenom               TEXT NOT NULL DEFAULT '',
  telephone            TEXT,
  cotisation           NUMERIC NOT NULL DEFAULT 0,
  date_entree          TEXT NOT NULL DEFAULT '',
  periode_distribution TEXT NOT NULL DEFAULT 'mensuel',
  actif                BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 26. FEEDBACK / AVIS
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_feedbacks CASCADE;
CREATE TABLE public.fl_feedbacks (
  id      TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  source  TEXT NOT NULL DEFAULT 'client',           -- 'client' | 'fournisseur' | 'equipe'
  auteur  TEXT NOT NULL DEFAULT '',
  sujet   TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  note    INTEGER DEFAULT 5,                         -- 1-5 stars
  date    DATE NOT NULL DEFAULT CURRENT_DATE,
  statut  TEXT NOT NULL DEFAULT 'nouveau',           -- 'nouveau' | 'lu' | 'traite'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 27. TRIP CHARGES (charges logistique par tournee)
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_trip_charges CASCADE;
CREATE TABLE public.fl_trip_charges (
  id               TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  numero           TEXT,
  date             DATE NOT NULL DEFAULT CURRENT_DATE,
  livreur          TEXT NOT NULL DEFAULT '',
  immatricule      TEXT NOT NULL DEFAULT '',
  secteur          TEXT NOT NULL DEFAULT '',
  nb_caisses_fact  INTEGER DEFAULT 0,
  nb_clients       INTEGER DEFAULT 0,
  km_depart        NUMERIC,
  km_retour        NUMERIC,
  charges          JSONB DEFAULT '[]',
  controle_retour  JSONB,
  validated        BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 28. LOYALTY — PROGRAMME DE FIDELITE
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_loyalty_transactions CASCADE;
CREATE TABLE public.fl_loyalty_transactions (
  id                    TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  client_id             TEXT NOT NULL DEFAULT '',
  client_nom            TEXT NOT NULL DEFAULT '',
  commande_id           TEXT,
  type                  TEXT NOT NULL DEFAULT 'gain',      -- 'gain' | 'rachat' | 'expiration' | 'annule'
  points                NUMERIC NOT NULL DEFAULT 0,
  motif                 TEXT NOT NULL DEFAULT '',
  redemption_type       TEXT,
  redemption_valeur     NUMERIC,
  redemption_article_id TEXT,
  statut                TEXT NOT NULL DEFAULT 'valide',    -- 'valide' | 'en_attente' | 'annule'
  created_by            TEXT NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

DROP TABLE IF EXISTS public.fl_discount_rules CASCADE;
CREATE TABLE public.fl_discount_rules (
  id                   TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  nom                  TEXT NOT NULL DEFAULT '',
  actif                BOOLEAN DEFAULT TRUE,
  scope                TEXT NOT NULL DEFAULT 'global',
  client_id            TEXT,
  client_nom           TEXT,
  article_id           TEXT,
  article_nom          TEXT,
  famille              TEXT,
  segment              TEXT,
  type                 TEXT NOT NULL DEFAULT 'pourcentage',
  valeur               NUMERIC NOT NULL DEFAULT 0,
  article_offert_id    TEXT,
  article_offert_nom   TEXT,
  article_offert_qte   NUMERIC,
  date_debut           DATE,
  date_fin             DATE,
  commande_min_dh      NUMERIC,
  app_only             BOOLEAN DEFAULT FALSE,
  code_promo           TEXT,
  message_whatsapp     TEXT,
  created_by           TEXT NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 29. PERFORMANCE INCENTIVES (Primes livreurs)
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_driver_bonuses CASCADE;
CREATE TABLE public.fl_driver_bonuses (
  id             TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  livreur_id     TEXT NOT NULL DEFAULT '',
  livreur_nom    TEXT NOT NULL DEFAULT '',
  driver_type    TEXT NOT NULL DEFAULT 'interne',
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  trip_id        TEXT,
  periode        TEXT,
  zero_retard    BOOLEAN DEFAULT FALSE,
  zero_retour    BOOLEAN DEFAULT FALSE,
  zero_qualite   BOOLEAN DEFAULT FALSE,
  montant_bonus  NUMERIC NOT NULL DEFAULT 0,
  statut         TEXT NOT NULL DEFAULT 'calcule',  -- 'calcule' | 'valide' | 'paye'
  notes          TEXT,
  created_by     TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 30. CONFIG (key-value pour settings globaux)
-- ══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.fl_config CASCADE;
CREATE TABLE public.fl_config (
  id         TEXT PRIMARY KEY,                          -- ex: 'company', 'workflow', 'loyalty', 'process'
  value      JSONB NOT NULL DEFAULT '{}',
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.fl_config (id, value) VALUES
  ('company', '{"nom":"Empire Fresh","adresse":"Zone Industrielle, Casablanca","ville":"Casablanca, Maroc","telephone":"+212 5XX-XXXXXX","email":"contact@empirefresh.ma","ice":"000000000000000","rc":"XXXXXX","couleurEntete":"#1a4f2a"}'::jsonb),
  ('loyalty_config', '{"actif":true,"pointsParDH":0.1,"bonusZeroRetour":50,"bonusAppOrder":20,"pointsParRemiseDH":10,"minimumPointsRachat":100,"pointsArticleCadeau":500}'::jsonb),
  ('driver_bonus_config', '{"actif":true,"bonusZeroRetard":20,"bonusZeroRetour":30,"bonusZeroQualite":25,"bonusParfait":100}'::jsonb),
  ('cutoff_notifications', '[{"id":"co1","time":"08:00","message":"Rappel: Finalisez vos achats avant 10h.","active":true},{"id":"co2","time":"12:00","message":"Coupure midi: Aucune nouvelle commande après 13h.","active":true}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Client loyalty columns (added to fl_clients)
ALTER TABLE public.fl_clients ADD COLUMN IF NOT EXISTS segment TEXT DEFAULT 'standard';
ALTER TABLE public.fl_clients ADD COLUMN IF NOT EXISTS loyalty_points NUMERIC DEFAULT 0;
ALTER TABLE public.fl_clients ADD COLUMN IF NOT EXISTS loyalty_opt_in BOOLEAN DEFAULT FALSE;

-- ══════════════════════════════════════════════════════════════
-- 31. UPDATED_AT TRIGGERS (auto-update timestamps)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fl_depots','fl_users','fl_fournisseurs','fl_articles','fl_livreurs',
    'fl_commandes','fl_bons_achat','fl_purchase_orders','fl_receptions',
    'fl_trips','fl_bons_livraison','fl_retours','fl_salaries'
  ] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%s;
      CREATE TRIGGER trg_%s_updated_at
        BEFORE UPDATE ON public.%s
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    ', t, t, t, t);
  END LOOP;
END; $$;

-- ══════════════════════════════════════════════════════════════
-- 23. INDEX PERFORMANCES
-- ══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_commandes_date          ON public.fl_commandes(date);
CREATE INDEX IF NOT EXISTS idx_commandes_client        ON public.fl_commandes(client_id);
CREATE INDEX IF NOT EXISTS idx_commandes_commercial    ON public.fl_commandes(commercial_id);
CREATE INDEX IF NOT EXISTS idx_commandes_statut        ON public.fl_commandes(statut);
CREATE INDEX IF NOT EXISTS idx_bons_achat_date         ON public.fl_bons_achat(date);
CREATE INDEX IF NOT EXISTS idx_bons_achat_statut       ON public.fl_bons_achat(statut);
CREATE INDEX IF NOT EXISTS idx_bons_achat_depot        ON public.fl_bons_achat(depot_id);
CREATE INDEX IF NOT EXISTS idx_po_statut               ON public.fl_purchase_orders(statut);
CREATE INDEX IF NOT EXISTS idx_po_depot                ON public.fl_purchase_orders(depot_id);
CREATE INDEX IF NOT EXISTS idx_receptions_date         ON public.fl_receptions(date);
CREATE INDEX IF NOT EXISTS idx_receptions_bon          ON public.fl_receptions(bon_achat_id);
CREATE INDEX IF NOT EXISTS idx_receptions_po           ON public.fl_receptions(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_bl_trip                 ON public.fl_bons_livraison(trip_id);
CREATE INDEX IF NOT EXISTS idx_bl_valide_magasinier    ON public.fl_bons_livraison(valide_magasinier);
CREATE INDEX IF NOT EXISTS idx_trips_date              ON public.fl_trips(date);
CREATE INDEX IF NOT EXISTS idx_trips_livreur           ON public.fl_trips(livreur_id);
CREATE INDEX IF NOT EXISTS idx_users_role              ON public.fl_users(role);
CREATE INDEX IF NOT EXISTS idx_users_depot             ON public.fl_users(depot_id);
CREATE INDEX IF NOT EXISTS idx_visites_prevendeur      ON public.fl_visites(prevendeur_id);
CREATE INDEX IF NOT EXISTS idx_visites_date            ON public.fl_visites(date);
CREATE INDEX IF NOT EXISTS idx_salaries_statut         ON public.fl_salaries(statut);
CREATE INDEX IF NOT EXISTS idx_paiements_mois          ON public.fl_paiements_salaires(mois);
CREATE INDEX IF NOT EXISTS idx_caisse_date             ON public.fl_caisse_entries(date);
CREATE INDEX IF NOT EXISTS idx_feedbacks_statut        ON public.fl_feedbacks(statut);
CREATE INDEX IF NOT EXISTS idx_loyalty_client          ON public.fl_loyalty_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_type            ON public.fl_loyalty_transactions(type);
CREATE INDEX IF NOT EXISTS idx_driver_bonuses_livreur  ON public.fl_driver_bonuses(livreur_id);
CREATE INDEX IF NOT EXISTS idx_driver_bonuses_date     ON public.fl_driver_bonuses(date);
CREATE INDEX IF NOT EXISTS idx_trip_charges_date       ON public.fl_trip_charges(date);

-- ══════════════════════════════════════════════════════════════
-- FIN DU SCRIPT — v11 (SCHEMA COMPLET)
-- Supabase: nphrncmuxbwahqnzdyxp
-- Tables: 30 + fl_config
-- Date: 2026 | Auteur: Jawad
-- ══════════════════════════════════════════════════════════════
