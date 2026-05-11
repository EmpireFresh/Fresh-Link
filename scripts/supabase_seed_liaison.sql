-- FreshLink -- Seed Liaison v1.1
-- Projet : jwdrwapuetqoqnankgma
-- Coller en entier dans Supabase SQL Editor > Run

-- 1. WEB INTEGRATION CONFIG
INSERT INTO fl_web_integration (
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

-- 2. COORDONNEES ENTREPRISE
INSERT INTO fl_company_contacts (
  id, nom_societe, slogan,
  adresse_ligne1, adresse_ligne2, code_postal, ville, pays,
  tel_principal, tel_secondaire, tel_urgence,
  whatsapp_principal, whatsapp_commercial, whatsapp_livraison,
  email_principal, email_commercial, email_comptabilite,
  instagram, facebook,
  horaires_ouverture, horaires_livraison, zone_livraison,
  gps_lat, gps_lng
) VALUES (
  'main', 'Empire Fresh', 'La fraicheur livree chaque matin',
  'Marche de gros', '', '', 'Casablanca', 'Maroc',
  '+212 5XX-XXXXXX', '', '',
  '+212 6XX-XXXXXX', '', '',
  'contact@empire-fresh.ma', 'commercial@empire-fresh.ma', 'comptabilite@empire-fresh.ma',
  '', '',
  'Lundi - Samedi : 06h00 - 18h00', 'Livraison : 06h00 - 12h00', 'Grand Casablanca',
  33.5731, -7.5898
)
ON CONFLICT (id) DO NOTHING;

-- 3. ACTIVER RLS
ALTER TABLE fl_articles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_prospects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_commandes_web    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_company_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fl_web_integration  ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES RLS
DROP POLICY IF EXISTS "public_read_catalogue"   ON fl_articles;
CREATE POLICY "public_read_catalogue" ON fl_articles
  FOR SELECT USING (visible_web = TRUE);

DROP POLICY IF EXISTS "public_read_contacts"    ON fl_company_contacts;
CREATE POLICY "public_read_contacts" ON fl_company_contacts
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "public_read_web_config"  ON fl_web_integration;
CREATE POLICY "public_read_web_config" ON fl_web_integration
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "public_insert_prospects" ON fl_prospects;
CREATE POLICY "public_insert_prospects" ON fl_prospects
  FOR INSERT WITH CHECK (source = 'site_web');

DROP POLICY IF EXISTS "public_insert_commandes" ON fl_commandes_web;
CREATE POLICY "public_insert_commandes" ON fl_commandes_web
  FOR INSERT WITH CHECK (source = 'site_web');

DROP POLICY IF EXISTS "public_read_commandes"   ON fl_commandes_web;
CREATE POLICY "public_read_commandes" ON fl_commandes_web
  FOR SELECT USING (TRUE);

-- 5. REALTIME (ignore si table deja publiee)
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE fl_articles;          EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE fl_prospects;         EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE fl_commandes_web;     EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE fl_company_contacts;  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE fl_web_integration;   EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- VERIFICATION
SELECT 'web_integration' AS tbl, id, enabled::text, panier_enabled::text, commande_min::text FROM fl_web_integration WHERE id = 'main';
SELECT 'contacts' AS tbl, id, nom_societe, ville FROM fl_company_contacts WHERE id = 'main';
