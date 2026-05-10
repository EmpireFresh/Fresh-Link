-- ============================================================
-- FRESHLINK PRO — Supabase Schema: Articles & Images
-- Empire Fresh — Distribution Fruits & Légumes, Casablanca
-- 
-- COMMENT UTILISER :
--   1. Va sur supabase.com → ton projet → SQL Editor
--   2. Colle tout ce fichier → clique RUN
--   3. Va dans Table Editor pour vérifier tes 136 articles
--   4. Va dans Storage → freshlink-media pour uploader tes images
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- SECTION 1 : EXTENSIONS
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- pour la recherche full-text


-- ─────────────────────────────────────────────────────────────
-- SECTION 2 : BUCKET STORAGE (images articles)
-- ─────────────────────────────────────────────────────────────
-- Crée le bucket public pour les images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'freshlink-media',
  'freshlink-media',
  TRUE,
  5242880,   -- 5 MB max par image
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 5242880;

-- Politique : tout le monde peut LIRE (images publiques)
DROP POLICY IF EXISTS "Images lisibles publiquement" ON storage.objects;
CREATE POLICY "Images lisibles publiquement"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'freshlink-media');

-- Politique : seuls les admins peuvent UPLOADER
DROP POLICY IF EXISTS "Upload images — admins seulement" ON storage.objects;
CREATE POLICY "Upload images — admins seulement"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'freshlink-media'
    AND auth.role() = 'authenticated'
  );

-- Politique : seuls les admins peuvent SUPPRIMER
DROP POLICY IF EXISTS "Suppression images — admins seulement" ON storage.objects;
CREATE POLICY "Suppression images — admins seulement"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'freshlink-media'
    AND auth.role() = 'authenticated'
  );


-- ─────────────────────────────────────────────────────────────
-- SECTION 3 : TABLE FAMILLES
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS familles_articles CASCADE;
CREATE TABLE familles_articles (
  id          SERIAL PRIMARY KEY,
  nom         TEXT NOT NULL UNIQUE,
  nom_ar      TEXT,
  emoji       TEXT DEFAULT '🥬',
  ordre       INT  DEFAULT 0,
  actif       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO familles_articles (nom, nom_ar, emoji, ordre) VALUES
  ('Légumes fruits',    'خضروات ثمرية',   '🍅', 1),
  ('Légumes racines',   'خضروات جذرية',   '🥕', 2),
  ('Légumes feuilles',  'خضروات ورقية',   '🥬', 3),
  ('Agrumes',           'حمضيات',         '🍊', 4),
  ('Fruits tropicaux',  'فواكه استوائية', '🍍', 5),
  ('Fruits rouges',     'فواكه حمراء',    '🍓', 6),
  ('Herbes aromatiques','أعشاب عطرية',    '🌿', 7),
  ('Champignons',       'فطريات',         '🍄', 8),
  ('Fruits secs',       'فواكه مجففة',    '🥜', 9),
  ('Autre',             'أخرى',           '📦', 10)
ON CONFLICT (nom) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- SECTION 4 : TABLE ARTICLES (complète)
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS articles CASCADE;
CREATE TABLE articles (
  -- ── Identité ──────────────────────────────────────────────
  id                       TEXT PRIMARY KEY,
  nom                      TEXT NOT NULL,
  nom_ar                   TEXT,
  famille                  TEXT REFERENCES familles_articles(nom) ON DELETE SET NULL,
  description              TEXT,
  description_ar           TEXT,

  -- ── Unités & Colisage ─────────────────────────────────────
  unite                    TEXT NOT NULL DEFAULT 'kg',
  um                       TEXT,           -- unité commerciale (Caisse, Carton...)
  colisage_par_um          NUMERIC(10,3),  -- kg par unité commerciale
  colisage_caisses         NUMERIC(10,3),  -- kg par caisse standard
  colisage_demi_caisses    NUMERIC(10,3),

  -- ── Stock ─────────────────────────────────────────────────
  stock_disponible         NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock_defect             NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock_reel               NUMERIC(12,3),
  stock_reel_date          TIMESTAMPTZ,
  stock_reel_saisi_par     TEXT,
  stock_theorique          NUMERIC(12,3) GENERATED ALWAYS AS (stock_disponible - stock_defect) STORED,

  -- ── Shelf life ────────────────────────────────────────────
  shelf_life_jours         INT,
  alerte_shelf_life_jours  INT DEFAULT 2,
  prix_liquidation         NUMERIC(10,2),

  -- ── Prix & Marge ──────────────────────────────────────────
  prix_achat               NUMERIC(10,2) NOT NULL DEFAULT 0,
  pv_methode               TEXT NOT NULL DEFAULT 'pourcentage'
                             CHECK (pv_methode IN ('pourcentage','montant','manuel')),
  pv_valeur                NUMERIC(10,2) NOT NULL DEFAULT 0,
  prix_vente_calcule       NUMERIC(10,2) GENERATED ALWAYS AS (
    CASE
      WHEN pv_methode = 'pourcentage' THEN ROUND(prix_achat * (1 + pv_valeur / 100), 2)
      WHEN pv_methode = 'montant'     THEN ROUND(prix_achat + pv_valeur, 2)
      ELSE pv_valeur
    END
  ) STORED,

  -- ── Images ────────────────────────────────────────────────
  photo                    TEXT,           -- URL principale (Supabase Storage ou externe)
  photos                   TEXT[],         -- galerie supplémentaire
  photo_storage_path       TEXT,           -- chemin dans freshlink-media (ex: articles/a1/main.webp)

  -- ── Activation ────────────────────────────────────────────
  actif                    BOOLEAN NOT NULL DEFAULT TRUE,
  catalogue_visible        BOOLEAN NOT NULL DEFAULT TRUE,

  -- ── Marketplace / Site public ─────────────────────────────
  marketplace_actif        BOOLEAN NOT NULL DEFAULT FALSE,
  marketplace_statut       TEXT DEFAULT 'disponible'
                             CHECK (marketplace_statut IN ('disponible','hors_saison','out_of_stock','short_stock','nouveau','promo')),
  marketplace_commentaire  TEXT,
  marketplace_prix_public  NUMERIC(10,2),
  marketplace_promo_actif  BOOLEAN DEFAULT FALSE,
  marketplace_prix_promo   NUMERIC(10,2),
  marketplace_promo_debut  DATE,
  marketplace_promo_fin    DATE,
  marketplace_promo_etiquette TEXT,
  marketplace_seuil_short  NUMERIC(10,3),
  marketplace_tags         TEXT[],
  marketplace_ordre        INT DEFAULT 0,
  marketplace_description  TEXT,
  marketplace_description_ar TEXT,

  -- ── Méta ──────────────────────────────────────────────────
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW(),
  created_by               TEXT,

  -- ── Recherche full-text ───────────────────────────────────
  search_vector            TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('french', COALESCE(nom,'') || ' ' || COALESCE(famille,'') || ' ' || COALESCE(description,''))
  ) STORED
);

-- Index pour les performances
CREATE INDEX idx_articles_famille  ON articles(famille);
CREATE INDEX idx_articles_actif    ON articles(actif);
CREATE INDEX idx_articles_search   ON articles USING GIN(search_vector);
CREATE INDEX idx_articles_marketplace ON articles(marketplace_actif, marketplace_statut);
CREATE INDEX idx_articles_stock    ON articles(stock_disponible);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS articles_updated_at ON articles;
CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────────────────────────
-- SECTION 5 : TABLE IMAGES ARTICLES (galerie multi-photos)
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS article_images CASCADE;
CREATE TABLE article_images (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id      TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  storage_path    TEXT,           -- chemin Supabase Storage
  ordre           INT  DEFAULT 0, -- 0 = photo principale
  alt_text        TEXT,
  uploaded_at     TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by     TEXT
);
CREATE INDEX idx_article_images_article ON article_images(article_id, ordre);


-- ─────────────────────────────────────────────────────────────
-- SECTION 6 : RLS (Row Level Security)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE articles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE familles_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_images  ENABLE ROW LEVEL SECURITY;

-- Articles : lecture publique pour catalogue_visible = TRUE
DROP POLICY IF EXISTS "Catalogue public" ON articles;
CREATE POLICY "Catalogue public" ON articles
  FOR SELECT USING (catalogue_visible = TRUE AND actif = TRUE);

-- Articles : lecture complète pour authentifiés
DROP POLICY IF EXISTS "Lecture complète authentifiés" ON articles;
CREATE POLICY "Lecture complète authentifiés" ON articles
  FOR SELECT TO authenticated USING (TRUE);

-- Articles : écriture pour authentifiés (admin)
DROP POLICY IF EXISTS "Écriture articles — admins" ON articles;
CREATE POLICY "Écriture articles — admins" ON articles
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Familles : lecture publique
DROP POLICY IF EXISTS "Familles publiques" ON familles_articles;
CREATE POLICY "Familles publiques" ON familles_articles
  FOR SELECT USING (TRUE);

-- Images : lecture publique
DROP POLICY IF EXISTS "Images publiques" ON article_images;
CREATE POLICY "Images publiques" ON article_images
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Images écriture — authentifiés" ON article_images;
CREATE POLICY "Images écriture — authentifiés" ON article_images
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);


-- ─────────────────────────────────────────────────────────────
-- SECTION 7 : VUES UTILES
-- ─────────────────────────────────────────────────────────────

-- Vue catalogue public (pour le portail clients/fournisseurs)
CREATE OR REPLACE VIEW v_catalogue_public AS
SELECT
  a.id, a.nom, a.nom_ar, a.famille, a.unite,
  a.prix_vente_calcule  AS prix,
  a.marketplace_prix_public,
  a.marketplace_statut,
  a.marketplace_commentaire,
  a.marketplace_tags,
  a.marketplace_ordre,
  a.marketplace_description,
  a.marketplace_description_ar,
  a.marketplace_promo_actif,
  a.marketplace_prix_promo,
  a.photo,
  a.photos,
  f.emoji                AS famille_emoji,
  CASE
    WHEN a.stock_disponible = 0                                THEN 'out_of_stock'
    WHEN a.marketplace_seuil_short IS NOT NULL
      AND a.stock_disponible < a.marketplace_seuil_short       THEN 'short_stock'
    ELSE a.marketplace_statut
  END                    AS statut_reel
FROM articles a
LEFT JOIN familles_articles f ON f.nom = a.famille
WHERE a.actif = TRUE
  AND a.marketplace_actif = TRUE
ORDER BY f.ordre, a.marketplace_ordre, a.nom;

-- Vue stock complet (pour le back-office)
CREATE OR REPLACE VIEW v_stock_complet AS
SELECT
  a.id, a.nom, a.nom_ar, a.famille,
  f.emoji AS famille_emoji,
  a.unite,
  a.stock_disponible,
  a.stock_defect,
  a.stock_theorique,
  a.prix_achat,
  a.prix_vente_calcule,
  ROUND((a.prix_vente_calcule - a.prix_achat) / NULLIF(a.prix_achat,0) * 100, 1) AS marge_pct,
  a.shelf_life_jours,
  a.actif,
  a.photo,
  a.updated_at
FROM articles a
LEFT JOIN familles_articles f ON f.nom = a.famille
ORDER BY f.ordre, a.nom;

-- Vue alertes stock (articles en dessous du seuil ou expirés)
CREATE OR REPLACE VIEW v_alertes_stock AS
SELECT
  id, nom, famille, stock_disponible, stock_defect,
  shelf_life_jours, alerte_shelf_life_jours,
  prix_liquidation,
  CASE
    WHEN stock_disponible = 0                         THEN '🔴 RUPTURE'
    WHEN stock_disponible < 50                        THEN '🟠 STOCK BAS'
    WHEN shelf_life_jours IS NOT NULL
     AND shelf_life_jours <= alerte_shelf_life_jours  THEN '⚠️ EXPIRE BIENTOT'
    ELSE '✅ OK'
  END AS statut_alerte
FROM articles
WHERE actif = TRUE
  AND (stock_disponible = 0 OR stock_disponible < 50
    OR (shelf_life_jours IS NOT NULL AND shelf_life_jours <= alerte_shelf_life_jours));


-- ─────────────────────────────────────────────────────────────
-- SECTION 8 : FONCTION RECHERCHE ARTICLES
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_articles(query TEXT, famille_filter TEXT DEFAULT NULL)
RETURNS TABLE(
  id TEXT, nom TEXT, nom_ar TEXT, famille TEXT,
  prix NUMERIC, stock_disponible NUMERIC, photo TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.nom, a.nom_ar, a.famille,
    a.prix_vente_calcule, a.stock_disponible, a.photo,
    ts_rank(a.search_vector, plainto_tsquery('french', query)) AS rank
  FROM articles a
  WHERE a.actif = TRUE
    AND (famille_filter IS NULL OR a.famille = famille_filter)
    AND (
      a.search_vector @@ plainto_tsquery('french', query)
      OR a.nom ILIKE '%' || query || '%'
      OR a.nom_ar LIKE '%' || query || '%'
    )
  ORDER BY rank DESC, a.nom;
END;
$$ LANGUAGE plpgsql STABLE;



-- ─────────────────────────────────────────────────────────────
-- SECTION 9 : DONNÉES — 136 ARTICLES (Empire Fresh)
-- ─────────────────────────────────────────────────────────────
INSERT INTO articles (
  id, nom, nom_ar, famille, unite,
  stock_disponible, stock_defect, prix_achat, pv_methode, pv_valeur,
  shelf_life_jours, colisage_caisses, photo,
  actif, catalogue_visible, marketplace_actif, marketplace_statut
) VALUES
  ('a1', 'Tomates', 'طماطم', 'Légumes fruits', 'kg', 500.0, 20.0, 2.5, 'pourcentage', 60.0, NULL, NULL, 'https://placehold.co/120x120/e74c3c/fff?text=Tomates', TRUE, TRUE, FALSE, 'disponible'),
  ('a5', 'Poivrons', 'فلفل', 'Légumes fruits', 'kg', 150.0, 5.0, 4.5, 'manuel', 7.0, NULL, NULL, 'https://placehold.co/120x120/e67e22/fff?text=Poivrons', TRUE, TRUE, FALSE, 'disponible'),
  ('a6', 'Courgettes', 'قرع', 'Légumes fruits', 'kg', 200.0, 12.0, 3.0, 'pourcentage', 67.0, NULL, NULL, 'https://placehold.co/120x120/27ae60/fff?text=Courgettes', TRUE, TRUE, FALSE, 'disponible'),
  ('a9', 'Aubergines', 'باذنجان', 'Légumes fruits', 'kg', 180.0, 7.0, 3.2, 'pourcentage', 65.0, NULL, NULL, 'https://placehold.co/120x120/8e44ad/fff?text=Aubergines', TRUE, TRUE, FALSE, 'disponible'),
  ('a10', 'Concombres', 'خيار', 'Légumes fruits', 'kg', 220.0, 8.0, 2.0, 'montant', 1.5, NULL, NULL, 'https://placehold.co/120x120/1abc9c/fff?text=Concombres', TRUE, TRUE, FALSE, 'disponible'),
  ('a11', 'Tomates cerises', 'طماطم كرزي', 'Légumes fruits', 'kg', 80.0, 3.0, 8.0, 'pourcentage', 50.0, NULL, NULL, 'https://placehold.co/120x120/c0392b/fff?text=T.Cerises', TRUE, TRUE, FALSE, 'disponible'),
  ('a2', 'Pommes de terre (blanche)', 'بطاطا بيضاء', 'Légumes racines', 'kg', 800.0, 15.0, 1.8, 'montant', 1.2, NULL, NULL, 'https://placehold.co/120x120/d4a017/fff?text=P.Terre+Blanche', TRUE, TRUE, FALSE, 'disponible'),
  ('a2r', 'Pommes de terre (rouge)', 'بطاطا حمراء', 'Légumes racines', 'kg', 400.0, 8.0, 2.2, 'montant', 1.5, NULL, NULL, 'https://placehold.co/120x120/c0392b/fff?text=P.Terre+Rouge', TRUE, TRUE, FALSE, 'disponible'),
  ('a2f', 'Pommes de terre (frite)', 'بطاطا للقلي', 'Légumes racines', 'kg', 600.0, 10.0, 2.0, 'montant', 1.3, NULL, NULL, 'https://placehold.co/120x120/f39c12/fff?text=P.Terre+Frite', TRUE, TRUE, FALSE, 'disponible'),
  ('a2d', 'Pommes de terre (douce)', 'بطاطا حلوة', 'Légumes racines', 'kg', 250.0, 5.0, 3.5, 'pourcentage', 57.0, NULL, NULL, 'https://placehold.co/120x120/e07b39/fff?text=P.Terre+Douce', TRUE, TRUE, FALSE, 'disponible'),
  ('a3', 'Oignons', 'بصل', 'Légumes racines', 'kg', 300.0, 10.0, 2.0, 'pourcentage', 75.0, NULL, NULL, 'https://placehold.co/120x120/e8a87c/fff?text=Oignons', TRUE, TRUE, FALSE, 'disponible'),
  ('a4', 'Carottes', 'جزر', 'Légumes racines', 'kg', 250.0, 8.0, 2.2, 'montant', 1.6, NULL, NULL, 'https://placehold.co/120x120/e67e22/fff?text=Carottes', TRUE, TRUE, FALSE, 'disponible'),
  ('a12', 'Betteraves', 'شمندر', 'Légumes racines', 'kg', 120.0, 4.0, 2.5, 'pourcentage', 60.0, NULL, NULL, 'https://placehold.co/120x120/922b21/fff?text=Betteraves', TRUE, TRUE, FALSE, 'disponible'),
  ('a13', 'Navets', 'لفت', 'Légumes racines', 'kg', 90.0, 3.0, 1.5, 'pourcentage', 67.0, NULL, NULL, 'https://placehold.co/120x120/f0e68c/333?text=Navets', TRUE, TRUE, FALSE, 'disponible'),
  ('a14', 'Ail', 'ثوم', 'Légumes racines', 'kg', 60.0, 2.0, 18.0, 'pourcentage', 56.0, NULL, NULL, 'https://placehold.co/120x120/f5f5dc/333?text=Ail', TRUE, TRUE, FALSE, 'disponible'),
  ('a15', 'Laitue', 'خس', 'Légumes feuilles', 'pièce', 150.0, 5.0, 1.5, 'montant', 1.0, NULL, NULL, 'https://placehold.co/120x120/2ecc71/fff?text=Laitue', TRUE, TRUE, FALSE, 'disponible'),
  ('a16', 'Épinards', 'سبانخ', 'Légumes feuilles', 'kg', 100.0, 8.0, 4.0, 'pourcentage', 50.0, NULL, NULL, 'https://placehold.co/120x120/196f3d/fff?text=Épinards', TRUE, TRUE, FALSE, 'disponible'),
  ('a17', 'Poireaux', 'كراث', 'Légumes feuilles', 'kg', 80.0, 4.0, 3.5, 'pourcentage', 57.0, NULL, NULL, 'https://placehold.co/120x120/27ae60/fff?text=Poireaux', TRUE, TRUE, FALSE, 'disponible'),
  ('a18', 'Choux', 'كرنب', 'Légumes feuilles', 'kg', 200.0, 10.0, 1.8, 'montant', 1.2, NULL, NULL, 'https://placehold.co/120x120/a9dfbf/333?text=Choux', TRUE, TRUE, FALSE, 'disponible'),
  ('a19', 'Choufleur', 'قرنبيط', 'Légumes feuilles', 'pièce', 100.0, 5.0, 5.0, 'montant', 3.5, NULL, NULL, 'https://placehold.co/120x120/f9f9f9/333?text=Choufleur', TRUE, TRUE, FALSE, 'disponible'),
  ('a20', 'Brocolis', 'بروكلي', 'Légumes feuilles', 'kg', 70.0, 3.0, 7.0, 'pourcentage', 43.0, NULL, NULL, 'https://placehold.co/120x120/1e8449/fff?text=Brocolis', TRUE, TRUE, FALSE, 'disponible'),
  ('a21', 'Artichauds', 'أرضي شوكي', 'Légumes feuilles', 'pièce', 80.0, 4.0, 3.0, 'montant', 2.0, NULL, NULL, 'https://placehold.co/120x120/148f77/fff?text=Artichaut', TRUE, TRUE, FALSE, 'disponible'),
  ('a22', 'Persil', 'معدنوس', 'Herbes aromatiques', 'botte', 200.0, 10.0, 1.0, 'montant', 0.5, NULL, NULL, 'https://placehold.co/120x120/27ae60/fff?text=Persil', TRUE, TRUE, FALSE, 'disponible'),
  ('a23', 'Coriandre', 'قزبر', 'Herbes aromatiques', 'botte', 180.0, 8.0, 1.0, 'montant', 0.5, NULL, NULL, 'https://placehold.co/120x120/1abc9c/fff?text=Coriandre', TRUE, TRUE, FALSE, 'disponible'),
  ('a24', 'Menthe', 'نعناع', 'Herbes aromatiques', 'botte', 150.0, 5.0, 1.2, 'montant', 0.8, NULL, NULL, 'https://placehold.co/120x120/2ecc71/fff?text=Menthe', TRUE, TRUE, FALSE, 'disponible'),
  ('a25', 'Céleri', 'كرفس', 'Herbes aromatiques', 'botte', 80.0, 4.0, 2.5, 'montant', 1.5, NULL, NULL, 'https://placehold.co/120x120/a9cce3/333?text=Céleri', TRUE, TRUE, FALSE, 'disponible'),
  ('a7', 'Oranges', 'برتقال', 'Agrumes', 'kg', 350.0, 6.0, 2.8, 'montant', 1.7, NULL, NULL, 'https://placehold.co/120x120/f39c12/fff?text=Oranges', TRUE, TRUE, FALSE, 'disponible'),
  ('a26', 'Citrons', 'ليمون', 'Agrumes', 'kg', 200.0, 5.0, 3.5, 'pourcentage', 57.0, NULL, NULL, 'https://placehold.co/120x120/f9e000/333?text=Citrons', TRUE, TRUE, FALSE, 'disponible'),
  ('a27', 'Clémentines', 'كليمانتين', 'Agrumes', 'kg', 300.0, 8.0, 5.0, 'pourcentage', 50.0, NULL, NULL, 'https://placehold.co/120x120/e67e22/fff?text=Clémentines', TRUE, TRUE, FALSE, 'disponible'),
  ('a28', 'Pamplemousses', 'برتقال هندي', 'Agrumes', 'kg', 120.0, 4.0, 4.5, 'pourcentage', 44.0, NULL, NULL, 'https://placehold.co/120x120/f0c07a/333?text=Pamplm.', TRUE, TRUE, FALSE, 'disponible'),
  ('a8', 'Bananes', 'موز', 'Fruits tropicaux', 'kg', 120.0, 4.0, 3.5, 'pourcentage', 57.0, NULL, NULL, 'https://placehold.co/120x120/f1c40f/333?text=Bananes', TRUE, TRUE, FALSE, 'disponible'),
  ('a29', 'Mangues', 'مانجو', 'Fruits tropicaux', 'kg', 80.0, 3.0, 12.0, 'pourcentage', 50.0, NULL, NULL, 'https://placehold.co/120x120/f39c12/fff?text=Mangues', TRUE, TRUE, FALSE, 'disponible'),
  ('a30', 'Avocats', 'أفوكادو', 'Fruits tropicaux', 'kg', 60.0, 3.0, 15.0, 'pourcentage', 33.0, NULL, NULL, 'https://placehold.co/120x120/196f3d/fff?text=Avocats', TRUE, TRUE, FALSE, 'disponible'),
  ('a31', 'Ananas', 'أناناس', 'Fruits tropicaux', 'pièce', 40.0, 2.0, 12.0, 'montant', 8.0, NULL, NULL, 'https://placehold.co/120x120/f4d03f/333?text=Ananas', TRUE, TRUE, FALSE, 'disponible'),
  ('a32', 'Kiwis', 'كيوي', 'Fruits tropicaux', 'kg', 50.0, 2.0, 20.0, 'pourcentage', 50.0, NULL, NULL, 'https://placehold.co/120x120/28b463/fff?text=Kiwis', TRUE, TRUE, FALSE, 'disponible'),
  ('a33', 'Fraises', 'فراولة', 'Fruits rouges', 'kg', 100.0, 8.0, 18.0, 'pourcentage', 44.0, NULL, NULL, 'https://placehold.co/120x120/c0392b/fff?text=Fraises', TRUE, TRUE, FALSE, 'disponible'),
  ('a34', 'Raisins', 'عنب', 'Fruits rouges', 'kg', 150.0, 6.0, 12.0, 'pourcentage', 50.0, NULL, NULL, 'https://placehold.co/120x120/7d3c98/fff?text=Raisins', TRUE, TRUE, FALSE, 'disponible'),
  ('a35', 'Grenades', 'رمان', 'Fruits rouges', 'kg', 120.0, 4.0, 8.0, 'pourcentage', 50.0, NULL, NULL, 'https://placehold.co/120x120/e74c3c/fff?text=Grenades', TRUE, TRUE, FALSE, 'disponible'),
  ('a36', 'Pommes (rouge/Golden)', 'تفاح أحمر/ذهبي', 'Fruits tropicaux', 'kg', 400.0, 10.0, 4.0, 'pourcentage', 50.0, NULL, NULL, 'https://placehold.co/120x120/e74c3c/fff?text=Pommes+Rouges', TRUE, TRUE, FALSE, 'disponible'),
  ('a36g', 'Pommes (Granny Smith)', 'تفاح أخضر', 'Fruits tropicaux', 'kg', 180.0, 4.0, 4.5, 'pourcentage', 44.0, NULL, NULL, 'https://placehold.co/120x120/2ecc71/fff?text=Pommes+Vertes', TRUE, TRUE, FALSE, 'disponible'),
  ('a36f', 'Pommes (Fuji)', 'تفاح فوجي', 'Fruits tropicaux', 'kg', 120.0, 3.0, 5.5, 'pourcentage', 45.0, NULL, NULL, 'https://placehold.co/120x120/f8c8d4/333?text=Pommes+Fuji', TRUE, TRUE, FALSE, 'disponible'),
  ('a37', 'Poires', 'إجاص', 'Fruits tropicaux', 'kg', 180.0, 6.0, 5.0, 'pourcentage', 40.0, NULL, NULL, 'https://placehold.co/120x120/a9cce3/333?text=Poires', TRUE, TRUE, FALSE, 'disponible'),
  ('a38', 'Pastèques', 'دلاح', 'Fruits tropicaux', 'pièce', 50.0, 2.0, 15.0, 'montant', 10.0, NULL, NULL, 'https://placehold.co/120x120/1abc9c/fff?text=Pastèque', TRUE, TRUE, FALSE, 'disponible'),
  ('a39', 'Melons', 'بطيخ', 'Fruits tropicaux', 'pièce', 40.0, 2.0, 10.0, 'montant', 7.0, NULL, NULL, 'https://placehold.co/120x120/f9e000/333?text=Melons', TRUE, TRUE, FALSE, 'disponible'),
  ('a40', 'Figues', 'تين', 'Fruits tropicaux', 'kg', 60.0, 3.0, 15.0, 'pourcentage', 33.0, NULL, NULL, 'https://placehold.co/120x120/7d3c98/fff?text=Figues', TRUE, TRUE, FALSE, 'disponible'),
  ('a41', 'Dattes', 'تمر', 'Fruits secs', 'kg', 80.0, 2.0, 30.0, 'pourcentage', 33.0, NULL, NULL, 'https://placehold.co/120x120/a04000/fff?text=Dattes', TRUE, TRUE, FALSE, 'disponible'),
  ('a42', 'Romarin', 'روزماري', 'Herbes aromatiques', 'botte', 60.0, 2.0, 3.0, 'montant', 2.0, NULL, NULL, 'https://placehold.co/120x120/1a5276/fff?text=Romarin', TRUE, TRUE, FALSE, 'disponible'),
  ('a43', 'Thym', 'زعتر', 'Herbes aromatiques', 'botte', 70.0, 2.0, 2.5, 'montant', 1.5, NULL, NULL, 'https://placehold.co/120x120/117a65/fff?text=Thym', TRUE, TRUE, FALSE, 'disponible'),
  ('a44', 'Basilic', 'ريحان', 'Herbes aromatiques', 'botte', 50.0, 2.0, 3.5, 'montant', 2.5, NULL, NULL, 'https://placehold.co/120x120/1e8449/fff?text=Basilic', TRUE, TRUE, FALSE, 'disponible'),
  ('a45', 'Laurier', 'غار', 'Herbes aromatiques', 'botte', 40.0, 1.0, 2.0, 'montant', 1.2, NULL, NULL, 'https://placehold.co/120x120/28b463/fff?text=Laurier', TRUE, TRUE, FALSE, 'disponible'),
  ('a46', 'Sauge', 'مريمية', 'Herbes aromatiques', 'botte', 35.0, 1.0, 3.0, 'montant', 2.0, NULL, NULL, 'https://placehold.co/120x120/2e86c1/fff?text=Sauge', TRUE, TRUE, FALSE, 'disponible'),
  ('a47', 'Cumin (graines)', 'كمون', 'Herbes aromatiques', 'kg', 30.0, 0.0, 25.0, 'pourcentage', 40.0, NULL, NULL, 'https://placehold.co/120x120/784212/fff?text=Cumin', TRUE, TRUE, FALSE, 'disponible'),
  ('a48', 'Gingembre frais', 'زنجبيل', 'Herbes aromatiques', 'kg', 40.0, 2.0, 20.0, 'pourcentage', 50.0, NULL, NULL, 'https://placehold.co/120x120/d4ac0d/fff?text=Gingembre', TRUE, TRUE, FALSE, 'disponible'),
  ('a49', 'Fenouil', 'بسباس', 'Légumes feuilles', 'kg', 50.0, 2.0, 4.0, 'pourcentage', 50.0, NULL, NULL, 'https://placehold.co/120x120/abebc6/333?text=Fenouil', TRUE, TRUE, FALSE, 'disponible'),
  ('a50', 'Radis', 'فجل', 'Légumes racines', 'botte', 80.0, 3.0, 1.5, 'montant', 1.0, NULL, NULL, 'https://placehold.co/120x120/e74c3c/fff?text=Radis', TRUE, TRUE, FALSE, 'disponible'),
  ('a51', 'Piment fort', 'فلفل حار', 'Légumes fruits', 'kg', 60.0, 2.0, 6.0, 'pourcentage', 50.0, NULL, NULL, 'https://placehold.co/120x120/c0392b/fff?text=Piment', TRUE, TRUE, FALSE, 'disponible'),
  ('a52', 'Haricots verts', 'لوبيا خضراء', 'Légumes feuilles', 'kg', 120.0, 5.0, 5.0, 'pourcentage', 40.0, NULL, NULL, 'https://placehold.co/120x120/27ae60/fff?text=Haricots', TRUE, TRUE, FALSE, 'disponible'),
  ('a53', 'Petits pois', 'جلبانة', 'Légumes feuilles', 'kg', 90.0, 3.0, 6.0, 'pourcentage', 50.0, NULL, NULL, 'https://placehold.co/120x120/2ecc71/fff?text=PetitsPois', TRUE, TRUE, FALSE, 'disponible'),
  ('a54', 'Champignons', 'فطر', 'Légumes feuilles', 'kg', 50.0, 4.0, 18.0, 'pourcentage', 33.0, NULL, NULL, 'https://placehold.co/120x120/a9a9a9/fff?text=Champigons', TRUE, TRUE, FALSE, 'disponible'),
  ('a55', 'Peches', 'خوخ', 'Fruits rouges', 'kg', 80.0, 5.0, 8.0, 'pourcentage', 38.0, NULL, NULL, 'https://placehold.co/120x120/f1948a/fff?text=Peches', TRUE, TRUE, FALSE, 'disponible'),
  ('a56', 'Prunes', 'برقوق', 'Fruits rouges', 'kg', 60.0, 4.0, 10.0, 'pourcentage', 40.0, NULL, NULL, 'https://placehold.co/120x120/7d3c98/fff?text=Prunes', TRUE, TRUE, FALSE, 'disponible'),
  ('a57', 'Nectarines', 'نكتارين', 'Fruits rouges', 'kg', 50.0, 3.0, 9.0, 'pourcentage', 44.0, NULL, NULL, 'https://placehold.co/120x120/e74c3c/fff?text=Nectarines', TRUE, TRUE, FALSE, 'disponible'),
  ('a58', 'Cerises', 'حب الملوك', 'Fruits rouges', 'kg', 40.0, 3.0, 25.0, 'pourcentage', 32.0, NULL, NULL, 'https://placehold.co/120x120/c0392b/fff?text=Cerises', TRUE, TRUE, FALSE, 'disponible'),
  ('a59', 'Papayes', 'بابايا', 'Fruits tropicaux', 'kg', 30.0, 2.0, 15.0, 'pourcentage', 33.0, NULL, NULL, 'https://placehold.co/120x120/f39c12/fff?text=Papayes', TRUE, TRUE, FALSE, 'disponible'),
  ('a60', 'Litchis', 'ليتشي', 'Fruits tropicaux', 'kg', 25.0, 2.0, 30.0, 'pourcentage', 33.0, NULL, NULL, 'https://placehold.co/120x120/e8b4b8/333?text=Litchis', TRUE, TRUE, FALSE, 'disponible'),
  ('a61', 'Blettes', 'سلق', 'Légumes feuilles', 'botte', 70.0, 3.0, 2.0, 'montant', 1.5, NULL, NULL, 'https://placehold.co/120x120/1a5c38/fff?text=Blettes', TRUE, TRUE, FALSE, 'disponible'),
  ('a62', 'Cresson', 'جرجير ماء', 'Légumes feuilles', 'botte', 45.0, 2.0, 2.5, 'montant', 1.8, NULL, NULL, 'https://placehold.co/120x120/2d6a4f/fff?text=Cresson', TRUE, TRUE, FALSE, 'disponible'),
  ('a63', 'Mache', 'خس حمل', 'Légumes feuilles', 'botte', 35.0, 2.0, 3.0, 'montant', 2.0, NULL, NULL, 'https://placehold.co/120x120/52b788/fff?text=Mache', TRUE, TRUE, FALSE, 'disponible'),
  ('a64', 'Roquette', 'جرجير', 'Légumes feuilles', 'botte', 50.0, 3.0, 3.5, 'montant', 2.5, NULL, NULL, 'https://placehold.co/120x120/3a7d44/fff?text=Roquette', TRUE, TRUE, FALSE, 'disponible'),
  ('a65', 'Chou rouge', 'كرنب أحمر', 'Légumes feuilles', 'kg', 80.0, 3.0, 2.0, 'pourcentage', 50.0, NULL, NULL, 'https://placehold.co/120x120/7b2d8b/fff?text=Chou+rouge', TRUE, TRUE, FALSE, 'disponible'),
  ('a66', 'Chou de Bruxelles', 'كرنب بروكسل', 'Légumes feuilles', 'kg', 40.0, 2.0, 6.0, 'pourcentage', 50.0, NULL, NULL, 'https://placehold.co/120x120/27ae60/fff?text=C.Bruxelles', TRUE, TRUE, FALSE, 'disponible'),
  ('a67', 'Aubergines', 'باذنجان', 'Légumes fruits', 'kg', 130.0, 5.0, 3.0, 'pourcentage', 67.0, NULL, NULL, 'https://placehold.co/120x120/6c3483/fff?text=Aubergines', TRUE, TRUE, FALSE, 'disponible'),
  ('a68', 'Courge', 'قرع', 'Légumes fruits', 'kg', 90.0, 3.0, 2.5, 'pourcentage', 60.0, NULL, NULL, 'https://placehold.co/120x120/e67e22/fff?text=Courge', TRUE, TRUE, FALSE, 'disponible'),
  ('a69', 'Patate douce', 'بطاطا حلوة', 'Légumes racines', 'kg', 110.0, 4.0, 3.5, 'pourcentage', 57.0, NULL, NULL, 'https://placehold.co/120x120/e07b39/fff?text=Pat.douce', TRUE, TRUE, FALSE, 'disponible'),
  ('a70', 'Maïs', 'ذرة', 'Légumes fruits', 'pièce', 100.0, 3.0, 1.5, 'montant', 1.0, NULL, NULL, 'https://placehold.co/120x120/f4d03f/333?text=Maïs', TRUE, TRUE, FALSE, 'disponible'),
  ('a71', 'Bette a carde', 'سلق أحمر', 'Légumes feuilles', 'botte', 30.0, 1.0, 3.0, 'montant', 2.0, NULL, NULL, 'https://placehold.co/120x120/e74c3c/fff?text=Bette', TRUE, TRUE, FALSE, 'disponible'),
  ('a72', 'Celeri-rave', 'كرفس جذري', 'Légumes racines', 'kg', 35.0, 2.0, 5.0, 'pourcentage', 40.0, NULL, NULL, 'https://placehold.co/120x120/a9a9a9/fff?text=Celeri-rave', TRUE, TRUE, FALSE, 'disponible'),
  ('a73', 'Panais', 'جزر أبيض', 'Légumes racines', 'kg', 25.0, 1.0, 4.5, 'pourcentage', 44.0, NULL, NULL, 'https://placehold.co/120x120/f5deb3/333?text=Panais', TRUE, TRUE, FALSE, 'disponible'),
  ('a74', 'Gingembre sec', 'زنجبيل يابس', 'Herbes aromatiques', 'kg', 20.0, 0.0, 35.0, 'pourcentage', 43.0, NULL, NULL, 'https://placehold.co/120x120/c8a951/333?text=Gingmb.sec', TRUE, TRUE, FALSE, 'disponible'),
  ('a75', 'Origan', 'زعتر روماني', 'Herbes aromatiques', 'botte', 45.0, 1.0, 2.5, 'montant', 1.8, NULL, NULL, 'https://placehold.co/120x120/5d6d20/fff?text=Origan', TRUE, TRUE, FALSE, 'disponible'),
  ('a76', 'Aneth', 'شبت', 'Herbes aromatiques', 'botte', 35.0, 1.0, 2.0, 'montant', 1.5, NULL, NULL, 'https://placehold.co/120x120/3d9970/fff?text=Aneth', TRUE, TRUE, FALSE, 'disponible'),
  ('a77', 'Estragon', 'طرخون', 'Herbes aromatiques', 'botte', 20.0, 1.0, 3.5, 'montant', 2.5, NULL, NULL, 'https://placehold.co/120x120/1c6e4a/fff?text=Estragon', TRUE, TRUE, FALSE, 'disponible'),
  ('a78', 'Citronnelle', 'ليمون عشبي', 'Herbes aromatiques', 'botte', 25.0, 1.0, 4.0, 'montant', 3.0, NULL, NULL, 'https://placehold.co/120x120/badc58/333?text=Citronnelle', TRUE, TRUE, FALSE, 'disponible'),
  ('a79', 'Fenugrec frais', 'حلبة طازجة', 'Herbes aromatiques', 'botte', 40.0, 2.0, 1.5, 'montant', 1.0, NULL, NULL, 'https://placehold.co/120x120/6ab04c/fff?text=Fenugrec', TRUE, TRUE, FALSE, 'disponible'),
  ('a80', 'Zaatar frais', 'زعتر طازج', 'Herbes aromatiques', 'botte', 60.0, 2.0, 1.5, 'montant', 1.0, NULL, NULL, 'https://placehold.co/120x120/4a7c59/fff?text=Zaatar', TRUE, TRUE, FALSE, 'disponible'),
  ('a81', 'Citrons verts', 'ليمون أخضر', 'Agrumes', 'kg', 80.0, 3.0, 5.0, 'pourcentage', 60.0, NULL, NULL, 'https://placehold.co/120x120/7fba00/fff?text=Citron+vert', TRUE, TRUE, FALSE, 'disponible'),
  ('a82', 'Kumquats', 'كمكوات', 'Agrumes', 'kg', 20.0, 1.0, 22.0, 'pourcentage', 36.0, NULL, NULL, 'https://placehold.co/120x120/f97316/fff?text=Kumquats', TRUE, TRUE, FALSE, 'disponible'),
  ('a83', 'Fruits de la passion', 'فاكهة الشغف', 'Fruits tropicaux', 'kg', 15.0, 1.0, 40.0, 'pourcentage', 25.0, NULL, NULL, 'https://placehold.co/120x120/7c3aed/fff?text=Passion', TRUE, TRUE, FALSE, 'disponible'),
  ('a84', 'Corossol', 'قشطة', 'Fruits tropicaux', 'kg', 10.0, 1.0, 35.0, 'pourcentage', 29.0, NULL, NULL, 'https://placehold.co/120x120/16a34a/fff?text=Corossol', TRUE, TRUE, FALSE, 'disponible'),
  ('a85', 'Noix de coco', 'جوز الهند', 'Fruits tropicaux', 'pièce', 30.0, 1.0, 8.0, 'montant', 5.0, NULL, NULL, 'https://placehold.co/120x120/92400e/fff?text=Noix.coco', TRUE, TRUE, FALSE, 'disponible'),
  ('a86', 'Asperges', 'هليون', 'Légumes feuilles', 'botte', 30.0, 2.0, 15.0, 'pourcentage', 40.0, NULL, NULL, 'https://placehold.co/120x120/4caf50/fff?text=Asperges', TRUE, TRUE, FALSE, 'disponible'),
  ('a87', 'Brocoli-rave', 'بروكلي إيطالي', 'Légumes feuilles', 'botte', 25.0, 1.0, 8.0, 'pourcentage', 50.0, NULL, NULL, 'https://placehold.co/120x120/2e7d32/fff?text=BrocRave', TRUE, TRUE, FALSE, 'disponible'),
  ('a88', 'Okra', 'قلقاس', 'Légumes fruits', 'kg', 55.0, 2.0, 5.0, 'pourcentage', 60.0, NULL, NULL, 'https://placehold.co/120x120/33691e/fff?text=Okra', TRUE, TRUE, FALSE, 'disponible'),
  ('a89', 'Taro', 'قلقاس', 'Légumes racines', 'kg', 40.0, 2.0, 4.0, 'pourcentage', 50.0, NULL, NULL, 'https://placehold.co/120x120/795548/fff?text=Taro', TRUE, TRUE, FALSE, 'disponible'),
  ('a90', 'Salsifis', 'لسان الثور', 'Légumes racines', 'kg', 20.0, 1.0, 8.0, 'pourcentage', 38.0, NULL, NULL, 'https://placehold.co/120x120/bcaaa4/333?text=Salsifis', TRUE, TRUE, FALSE, 'disponible'),
  ('a91', 'Rutabaga', 'لفت اسكتلندي', 'Légumes racines', 'kg', 20.0, 1.0, 3.5, 'pourcentage', 43.0, NULL, NULL, 'https://placehold.co/120x120/f9a825/fff?text=Rutabaga', TRUE, TRUE, FALSE, 'disponible'),
  ('a92', 'Topinambour', 'كمأة الأرض', 'Légumes racines', 'kg', 15.0, 1.0, 9.0, 'pourcentage', 33.0, NULL, NULL, 'https://placehold.co/120x120/a1887f/fff?text=Topinambour', TRUE, TRUE, FALSE, 'disponible'),
  ('a93', 'Endives', 'هندباء', 'Légumes feuilles', 'pièce', 40.0, 2.0, 4.0, 'montant', 2.5, NULL, NULL, 'https://placehold.co/120x120/fff9c4/333?text=Endives', TRUE, TRUE, FALSE, 'disponible'),
  ('a94', 'Pak Choi', 'ملفوف صيني', 'Légumes feuilles', 'pièce', 30.0, 1.0, 5.0, 'montant', 3.0, NULL, NULL, 'https://placehold.co/120x120/66bb6a/fff?text=PakChoi', TRUE, TRUE, FALSE, 'disponible'),
  ('a95', 'Abricots', 'مشمش', 'Fruits rouges', 'kg', 70.0, 4.0, 10.0, 'pourcentage', 40.0, NULL, NULL, 'https://placehold.co/120x120/ff8f00/fff?text=Abricots', TRUE, TRUE, FALSE, 'disponible'),
  ('a96', 'Myrtilles', 'توت أزرق', 'Fruits rouges', 'kg', 20.0, 2.0, 45.0, 'pourcentage', 33.0, NULL, NULL, 'https://placehold.co/120x120/283593/fff?text=Myrtilles', TRUE, TRUE, FALSE, 'disponible'),
  ('a97', 'Framboises', 'توت العُلَّيق', 'Fruits rouges', 'kg', 15.0, 2.0, 50.0, 'pourcentage', 30.0, NULL, NULL, 'https://placehold.co/120x120/e91e63/fff?text=Framboises', TRUE, TRUE, FALSE, 'disponible'),
  ('a98', 'Mures', 'توت أسود', 'Fruits rouges', 'kg', 15.0, 1.0, 40.0, 'pourcentage', 38.0, NULL, NULL, 'https://placehold.co/120x120/4a148c/fff?text=Mures', TRUE, TRUE, FALSE, 'disponible'),
  ('a99', 'Caramboles', 'نجمة الفاكهة', 'Fruits tropicaux', 'kg', 10.0, 1.0, 35.0, 'pourcentage', 43.0, NULL, NULL, 'https://placehold.co/120x120/f9a825/fff?text=Carambole', TRUE, TRUE, FALSE, 'disponible'),
  ('a100', 'Tamarins', 'تمر هندي', 'Fruits tropicaux', 'kg', 12.0, 1.0, 20.0, 'pourcentage', 50.0, NULL, NULL, 'https://placehold.co/120x120/4e342e/fff?text=Tamarins', TRUE, TRUE, FALSE, 'disponible'),
  ('a101', 'Longanes', 'عين التنين', 'Fruits tropicaux', 'kg', 10.0, 1.0, 30.0, 'pourcentage', 33.0, NULL, NULL, 'https://placehold.co/120x120/ffe082/333?text=Longanes', TRUE, TRUE, FALSE, 'disponible'),
  ('a102', 'Ciboulette', 'بصل أخضر', 'Herbes aromatiques', 'botte', 40.0, 2.0, 1.5, 'montant', 1.0, NULL, NULL, 'https://placehold.co/120x120/558b2f/fff?text=Ciboulette', TRUE, TRUE, FALSE, 'disponible'),
  ('a103', 'Verveine', 'ليمون عشب', 'Herbes aromatiques', 'botte', 20.0, 1.0, 4.0, 'montant', 3.0, NULL, NULL, 'https://placehold.co/120x120/8bc34a/fff?text=Verveine', TRUE, TRUE, FALSE, 'disponible'),
  ('a104', 'Hibiscus frais', 'كركدية', 'Herbes aromatiques', 'botte', 15.0, 1.0, 5.0, 'montant', 3.5, NULL, NULL, 'https://placehold.co/120x120/e53935/fff?text=Hibiscus', TRUE, TRUE, FALSE, 'disponible'),
  ('a105', 'Sarriette', 'صعتر', 'Herbes aromatiques', 'botte', 15.0, 1.0, 3.0, 'montant', 2.0, NULL, NULL, 'https://placehold.co/120x120/689f38/fff?text=Sarriette', TRUE, TRUE, FALSE, 'disponible'),
  ('a106', 'Champignons Shiitake', 'فطر شيتاكي', 'Légumes feuilles', 'kg', 20.0, 2.0, 40.0, 'pourcentage', 25.0, NULL, NULL, 'https://placehold.co/120x120/795548/fff?text=Shiitake', TRUE, TRUE, FALSE, 'disponible'),
  ('a107', 'Champignons Pleurotes', 'فطر عيش الغراب', 'Légumes feuilles', 'kg', 25.0, 2.0, 30.0, 'pourcentage', 33.0, NULL, NULL, 'https://placehold.co/120x120/bdbdbd/333?text=Pleurotes', TRUE, TRUE, FALSE, 'disponible'),
  ('a108', 'Truffes noires', 'كمأ أسود', 'Légumes feuilles', 'kg', 5.0, 0.0, 800.0, 'pourcentage', 25.0, NULL, NULL, 'https://placehold.co/120x120/212121/fff?text=Truffes', TRUE, TRUE, FALSE, 'disponible'),
  ('a109', 'Bergamotes', 'برغموت', 'Agrumes', 'kg', 15.0, 1.0, 15.0, 'pourcentage', 33.0, NULL, NULL, 'https://placehold.co/120x120/ffeb3b/333?text=Bergamote', TRUE, TRUE, FALSE, 'disponible'),
  ('a110', 'Yuzus', 'يوزو', 'Agrumes', 'kg', 10.0, 1.0, 60.0, 'pourcentage', 25.0, NULL, NULL, 'https://placehold.co/120x120/fdd835/333?text=Yuzu', TRUE, TRUE, FALSE, 'disponible'),
  ('a111', 'Pommes de terre rouge', 'بطاطا حمراء', 'Légumes racines', 'kg', 600.0, 12.0, 2.0, 'montant', 1.5, 30, NULL, 'https://placehold.co/120x120/c0392b/fff?text=P.Terre+Rouge', TRUE, TRUE, FALSE, 'disponible'),
  ('a112', 'Pommes de terre blanche', 'بطاطا بيضاء', 'Légumes racines', 'kg', 900.0, 15.0, 1.8, 'montant', 1.2, 30, NULL, 'https://placehold.co/120x120/f5f5dc/333?text=P.Terre+Blanche', TRUE, TRUE, FALSE, 'disponible'),
  ('a113', 'Pommes de terre frite', 'بطاطا للقلي', 'Légumes racines', 'kg', 750.0, 10.0, 2.2, 'montant', 1.5, 21, NULL, 'https://placehold.co/120x120/f39c12/fff?text=P.Terre+Frite', TRUE, TRUE, FALSE, 'disponible'),
  ('a114', 'Pommes de terre douce', 'بطاطا حلوة', 'Légumes racines', 'kg', 200.0, 6.0, 3.5, 'pourcentage', 57.0, 21, NULL, 'https://placehold.co/120x120/e07b39/fff?text=P.Terre+Douce', TRUE, TRUE, FALSE, 'disponible'),
  ('a115', 'Tomates rondes', 'طماطم مستديرة', 'Légumes fruits', 'kg', 400.0, 15.0, 2.3, 'pourcentage', 65.0, 7, NULL, 'https://placehold.co/120x120/e74c3c/fff?text=Tomate+Ronde', TRUE, TRUE, FALSE, 'disponible'),
  ('a116', 'Tomates longues', 'طماطم طويلة', 'Légumes fruits', 'kg', 250.0, 10.0, 2.6, 'pourcentage', 62.0, 7, NULL, 'https://placehold.co/120x120/c0392b/fff?text=Tomate+Longue', TRUE, TRUE, FALSE, 'disponible'),
  ('a117', 'Tomates grappe', 'طماطم عنقودية', 'Légumes fruits', 'kg', 150.0, 5.0, 5.0, 'pourcentage', 60.0, 10, NULL, 'https://placehold.co/120x120/a93226/fff?text=Tomate+Grappe', TRUE, TRUE, FALSE, 'disponible'),
  ('a118', 'Pommes Golden', 'تفاح ذهبي', 'Fruits tropicaux', 'kg', 300.0, 8.0, 4.5, 'pourcentage', 44.0, 30, NULL, 'https://placehold.co/120x120/f4d03f/333?text=Pomme+Golden', TRUE, TRUE, FALSE, 'disponible'),
  ('a119', 'Pommes Royal Gala', 'تفاح غالا', 'Fruits tropicaux', 'kg', 250.0, 6.0, 5.0, 'pourcentage', 50.0, 30, NULL, 'https://placehold.co/120x120/e74c3c/fff?text=Pomme+Gala', TRUE, TRUE, FALSE, 'disponible'),
  ('a120', 'Pommes Granny Smith', 'تفاح أخضر', 'Fruits tropicaux', 'kg', 180.0, 5.0, 5.5, 'pourcentage', 45.0, 35, NULL, 'https://placehold.co/120x120/27ae60/fff?text=Granny+Smith', TRUE, TRUE, FALSE, 'disponible'),
  ('a121', 'Oignons rouges', 'بصل أحمر', 'Légumes racines', 'kg', 200.0, 5.0, 2.5, 'pourcentage', 60.0, 45, NULL, 'https://placehold.co/120x120/8e44ad/fff?text=Oignon+Rouge', TRUE, TRUE, FALSE, 'disponible'),
  ('a122', 'Oignons blancs', 'بصل أبيض', 'Légumes racines', 'kg', 180.0, 5.0, 2.2, 'pourcentage', 64.0, 45, NULL, 'https://placehold.co/120x120/f0f0f0/333?text=Oignon+Blanc', TRUE, TRUE, FALSE, 'disponible'),
  ('a123', 'Oignons verts', 'بصل أخضر', 'Légumes racines', 'botte', 120.0, 4.0, 1.5, 'montant', 1.0, 7, NULL, 'https://placehold.co/120x120/27ae60/fff?text=Oignon+Vert', TRUE, TRUE, FALSE, 'disponible'),
  ('a124', 'Poivrons rouges', 'فلفل أحمر', 'Légumes fruits', 'kg', 120.0, 4.0, 5.0, 'pourcentage', 60.0, 14, NULL, 'https://placehold.co/120x120/e74c3c/fff?text=Poivron+Rouge', TRUE, TRUE, FALSE, 'disponible'),
  ('a125', 'Poivrons verts', 'فلفل أخضر', 'Légumes fruits', 'kg', 130.0, 4.0, 3.5, 'pourcentage', 57.0, 14, NULL, 'https://placehold.co/120x120/27ae60/fff?text=Poivron+Vert', TRUE, TRUE, FALSE, 'disponible'),
  ('a126', 'Poivrons jaunes', 'فلفل أصفر', 'Légumes fruits', 'kg', 80.0, 3.0, 6.0, 'pourcentage', 50.0, 14, NULL, 'https://placehold.co/120x120/f4d03f/333?text=Poivron+Jaune', TRUE, TRUE, FALSE, 'disponible'),
  ('a127', 'Concombres libanais', 'خيار لبناني', 'Légumes fruits', 'kg', 100.0, 3.0, 3.0, 'pourcentage', 67.0, 10, NULL, 'https://placehold.co/120x120/1abc9c/fff?text=Conc+Liban', TRUE, TRUE, FALSE, 'disponible'),
  ('a128', 'Courgettes rondes', 'كوسة مستديرة', 'Légumes fruits', 'kg', 80.0, 3.0, 3.5, 'pourcentage', 57.0, 10, NULL, 'https://placehold.co/120x120/27ae60/fff?text=Courgette+Ronde', TRUE, TRUE, FALSE, 'disponible'),
  ('a129', 'Courgettes jaunes', 'كوسة صفراء', 'Légumes fruits', 'kg', 50.0, 2.0, 4.0, 'pourcentage', 50.0, 10, NULL, 'https://placehold.co/120x120/f4d03f/333?text=Courgette+Jaune', TRUE, TRUE, FALSE, 'disponible'),
  ('a130', 'Laitue iceberg', 'خس ايسبرغ', 'Légumes feuilles', 'pièce', 80.0, 3.0, 2.5, 'montant', 1.5, 7, NULL, 'https://placehold.co/120x120/a9dfbf/333?text=Iceberg', TRUE, TRUE, FALSE, 'disponible'),
  ('a131', 'Laitue frisée', 'خس مجعد', 'Légumes feuilles', 'pièce', 60.0, 3.0, 2.0, 'montant', 1.5, 5, NULL, 'https://placehold.co/120x120/2ecc71/fff?text=Laitue+Frisee', TRUE, TRUE, FALSE, 'disponible')
ON CONFLICT (id) DO UPDATE SET
  nom              = EXCLUDED.nom,
  nom_ar           = EXCLUDED.nom_ar,
  famille          = EXCLUDED.famille,
  unite            = EXCLUDED.unite,
  stock_disponible = EXCLUDED.stock_disponible,
  stock_defect     = EXCLUDED.stock_defect,
  prix_achat       = EXCLUDED.prix_achat,
  pv_methode       = EXCLUDED.pv_methode,
  pv_valeur        = EXCLUDED.pv_valeur,
  shelf_life_jours = EXCLUDED.shelf_life_jours,
  photo            = EXCLUDED.photo,
  updated_at       = NOW();


-- ─────────────────────────────────────────────────────────────
-- SECTION 10 : VÉRIFICATION FINALE
-- ─────────────────────────────────────────────────────────────
SELECT
  'ARTICLES'      AS table_name,
  COUNT(*)        AS total,
  COUNT(CASE WHEN actif THEN 1 END)             AS actifs,
  COUNT(CASE WHEN photo IS NOT NULL THEN 1 END) AS avec_photo,
  COUNT(DISTINCT famille)                        AS familles
FROM articles;

SELECT famille, COUNT(*) AS nb_articles
FROM articles
GROUP BY famille
ORDER BY nb_articles DESC;

-- Test recherche full-text
SELECT id, nom, famille, prix_vente_calcule AS prix FROM articles
WHERE nom ILIKE '%tomate%' OR nom_ar LIKE '%طماطم%'
LIMIT 10;

-- ─────────────────────────────────────────────────────────────
-- SECTION 11 : COMMENT UPLOADER TES VRAIES IMAGES
-- ─────────────────────────────────────────────────────────────
-- Méthode 1 (recommandée — Supabase Dashboard):
--   1. Supabase → Storage → freshlink-media
--   2. Créer dossier: articles/
--   3. Uploader tes images nommées: a1.jpg, a2.jpg, etc.
--   4. Copier l'URL publique et l'insérer ici:

-- UPDATE articles SET
--   photo            = 'https://TON_PROJECT.supabase.co/storage/v1/object/public/freshlink-media/articles/a1.webp',
--   photo_storage_path = 'articles/a1.webp'
-- WHERE id = 'a1';

-- Méthode 2 (bulk via script JS):
--   Utilise le script scripts/upload-images.mjs fourni dans le projet.

-- Méthode 3 (depuis l'interface FreshLink):
--   Back-office → Catalogue → cliquer sur un article → Upload photo
--   L'image sera automatiquement sauvegardée dans Supabase Storage.

-- ─────────────────────────────────────────────────────────────
-- FIN DU SCRIPT — Empire Fresh / FreshLink Pro
-- ─────────────────────────────────────────────────────────────
