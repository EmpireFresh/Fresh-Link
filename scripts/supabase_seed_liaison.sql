-- ============================================================
-- FreshLink Empire Fresh — Seed Liaison v1.0
-- Projet : jwdrwapuetqoqnankgma
-- Exécuter APRÈS supabase_schema_realtime_sync.sql
-- Ce script initialise les données de configuration qui
-- permettent la liaison FreshLink App ↔ Supabase ↔ empire-fresh.netlify.app
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- 1. CONFIGURATION WEB INTEGRATION
-- Active le catalogue public et le panier sur le site client
-- ═══════════════════════════════════════════════════════════════

INSERT INTO fl_web_integration (
  id,
  enabled,
  catalogue_public,
  commandes_public,
  panier_enabled,
  show_prices,
  show_promos,
  show_qualite,
  show_stock_level,
  commande_min,
  realtime_enabled,
  allowed_origins,
  message_rupture,
  message_ferme
) VALUES (
  'main',
  TRUE,                                            -- Intégration active
  TRUE,                                            -- Catalogue public visible
  FALSE,                                           -- Commandes directes désactivées (via panier seulement)
  TRUE,                                            -- Panier activé
  TRUE,                                            -- Prix visibles
  TRUE,                                            -- Promos visibles
  TRUE,                                            -- Critères qualité visibles
  FALSE,                                           -- Stock exact masqué
  200.00,                                          -- Montant minimum commande : 200 DH
  TRUE,                                            -- Realtime activé
  ARRAY[
    'https://empire-fresh.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  'Article temporairement indisponible — revenez bientôt',
  'Commandes ouvertes du Lundi au Samedi, 06h00-18h00'
)
ON CONFLICT (id) DO UPDATE SET
  enabled          = EXCLUDED.enabled,
  catalogue_public = EXCLUDED.catalogue_public,
  panier_enabled   = EXCLUDED.panier_enabled,
  show_prices      = EXCLUDED.show_prices,
  show_promos      = EXCLUDED.show_promos,
  show_qualite     = EXCLUDED.show_qualite,
  commande_min     = EXCLUDED.commande_min,
  realtime_enabled = EXCLUDED.realtime_enabled,
  allowed_origins  = EXCLUDED.allowed_origins,
  updated_at       = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 2. COORDONNÉES ENTREPRISE (fl_company_contacts)
-- Ces données sont exposées publiquement via /api/ext/contacts
-- et synchronisées en temps réel vers empire-fresh.netlify.app
-- ═══════════════════════════════════════════════════════════════

INSERT INTO fl_company_contacts (
  id,
  nom_societe,
  slogan,
  -- Adresse
  adresse_ligne1,
  adresse_ligne2,
  code_postal,
  ville,
  pays,
  -- Téléphones
  tel_principal,
  tel_secondaire,
  tel_urgence,
  -- WhatsApp
  whatsapp_principal,
  whatsapp_commercial,
  whatsapp_livraison,
  -- Emails
  email_principal,
  email_commercial,
  email_comptabilite,
  -- Réseaux sociaux
  instagram,
  facebook,
  -- Horaires
  horaires_ouverture,
  horaires_livraison,
  zone_livraison,
  -- GPS (Casablanca par défaut — à mettre à jour)
  gps_lat,
  gps_lng
) VALUES (
  'main',
  'Empire Fresh',
  'La fraîcheur livrée chaque matin',
  -- Adresse — à mettre à jour
  'Marché de gros',
  '',
  '',
  'Casablanca',
  'Maroc',
  -- Téléphones — à mettre à jour
  '+212 5XX-XXXXXX',
  '',
  '',
  -- WhatsApp — à mettre à jour
  '+212 6XX-XXXXXX',
  '',
  '',
  -- Emails — à mettre à jour
  'contact@empire-fresh.ma',
  'commercial@empire-fresh.ma',
  'comptabilite@empire-fresh.ma',
  -- Réseaux sociaux — à mettre à jour
  '',
  '',
  -- Horaires
  'Lundi – Samedi : 06h00 – 18h00',
  'Livraison : 06h00 – 12h00',
  'Grand Casablanca & environs',
  -- GPS Casablanca centre (à ajuster)
  33.5731,
  -7.5898
)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 3. PERMISSIONS RLS — Accès public en lecture aux tables nécessaires
-- ═══════════════════════════════════════════════════════════════

-- Catalogue : lecture publique des articles visibles
DROP POLICY IF EXISTS "public_read_catalogue" ON fl_articles;
CREATE POLICY "public_read_catalogue" ON fl_articles
  FOR SELECT USING (visible_web = TRUE AND statut_web != 'rupture');

-- Contacts entreprise : lecture publique
DROP POLICY IF EXISTS "public_read_contacts" ON fl_company_contacts;
CREATE POLICY "public_read_contacts" ON fl_company_contacts
  FOR SELECT USING (TRUE);

-- Web integration config : lecture publique
DROP POLICY IF EXISTS "public_read_web_config" ON fl_web_integration;
CREATE POLICY "public_read_web_config" ON fl_web_integration
  FOR SELECT USING (TRUE);

-- Prospects : insertion publique (depuis le site)
DROP POLICY IF EXISTS "public_insert_prospects" ON fl_prospects;
CREATE POLICY "public_insert_prospects" ON fl_prospects
  FOR INSERT WITH CHECK (source = 'site_web');

-- Commandes web : insertion publique + lecture par numero+telephone
DROP POLICY IF EXISTS "public_insert_commandes_web" ON fl_commandes_web;
CREATE POLICY "public_insert_commandes_web" ON fl_commandes_web
  FOR INSERT WITH CHECK (source = 'site_web');

DROP POLICY IF EXISTS "public_read_own_commande" ON fl_commandes_web;
CREATE POLICY "public_read_own_commande" ON fl_commandes_web
  FOR SELECT USING (TRUE);

-- ═══════════════════════════════════════════════════════════════
-- 4. ACTIVER REALTIME SUR TOUTES LES TABLES DE LIAISON
-- ═══════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime
  ADD TABLE fl_articles,
             fl_prospects,
             fl_commandes_web,
             fl_company_contacts,
             fl_web_integration;

-- ═══════════════════════════════════════════════════════════════
-- 5. ENABLE ROW LEVEL SECURITY (si pas déjà activé)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE fl_articles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_prospects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_commandes_web     ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_company_contacts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_web_integration   ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- VÉRIFICATION FINALE
-- ═══════════════════════════════════════════════════════════════

SELECT 'fl_web_integration' AS table_name, id, enabled, catalogue_public, panier_enabled, commande_min
FROM fl_web_integration WHERE id = 'main';

SELECT 'fl_company_contacts' AS table_name, id, nom_societe, ville, tel_principal
FROM fl_company_contacts WHERE id = 'main';
