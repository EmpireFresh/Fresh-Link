-- ════════════════════════════════════════════════════════════════════════════
-- VITA FRESH / FreshLink — RESET & REBUILD de la liaison Supabase
-- ----------------------------------------------------------------------------
-- ✅ GARDE        : fl_articles (catalogue) + fl_clients (base clients) + comptes ADMIN
-- ♻️ REMET À ZÉRO : commandes, demandes, appareils, prospects, bons, caisses, docs...
-- 🔗 Format unifié partout : { id TEXT PRIMARY KEY, payload JSONB, updated_at }
--
-- À exécuter dans :  Supabase → SQL Editor → coller → RUN
-- Sans danger pour articles & clients (aucun DROP, aucune perte de ces données).
-- ════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1) CRÉATION DES TABLES (idempotent — ne touche pas aux tables existantes)
--    Toutes au même format {id, payload, updated_at} → liaison cohérente web ↔ app.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fl_articles          (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_clients           (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_users             (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_fournisseurs      (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_commandes         (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_commandes_web     (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_site_access       (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_account_requests  (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_feedbacks         (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_company_contacts  (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_prospects         (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_bons_livraison    (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_bons_preparation  (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_bons_achat        (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_purchase_orders   (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_receptions        (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_retours           (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_trips             (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_caisses_vides     (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_charges           (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_caisse_entries    (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_documents         (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_depots            (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_salaries          (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_actionnaires      (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_livreurs          (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_gift_materials    (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.fl_pa_historique     (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) SÉCURITÉ (RLS)
--    • L'application (API /api/sync-* et /api/ext/*) utilise la clé SERVICE_ROLE
--      qui CONTOURNE toujours la RLS → l'app fonctionne sans politique anon.
--    • On ouvre en lecture publique (anon) UNIQUEMENT ce que le SITE WEB doit lire
--      directement : le catalogue, les contacts, les avis (+ insertion d'un avis).
--    • Toutes les autres tables : RLS activée, AUCUNE politique anon
--      → personne ne peut lire fl_users (mots de passe), commandes, etc. sans service_role.
-- ─────────────────────────────────────────────────────────────────────────────

-- Active la RLS sur toutes les tables
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'fl_articles','fl_clients','fl_users','fl_fournisseurs','fl_commandes','fl_commandes_web',
    'fl_site_access','fl_account_requests','fl_feedbacks','fl_company_contacts','fl_prospects',
    'fl_bons_livraison','fl_bons_preparation','fl_bons_achat','fl_purchase_orders','fl_receptions',
    'fl_retours','fl_trips','fl_caisses_vides','fl_charges','fl_caisse_entries','fl_documents',
    'fl_depots','fl_salaries','fl_actionnaires','fl_livreurs','fl_gift_materials','fl_pa_historique'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- Lecture publique du CATALOGUE (le site web peut lire fl_articles en direct)
DROP POLICY IF EXISTS anon_read_articles ON public.fl_articles;
CREATE POLICY anon_read_articles ON public.fl_articles FOR SELECT TO anon USING (true);

-- Lecture publique des CONTACTS société (footer / page contact du site)
DROP POLICY IF EXISTS anon_read_contacts ON public.fl_company_contacts;
CREATE POLICY anon_read_contacts ON public.fl_company_contacts FOR SELECT TO anon USING (true);

-- AVIS : lecture publique + insertion publique (formulaire d'avis du site)
DROP POLICY IF EXISTS anon_read_feedbacks   ON public.fl_feedbacks;
CREATE POLICY anon_read_feedbacks   ON public.fl_feedbacks FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS anon_insert_feedbacks ON public.fl_feedbacks;
CREATE POLICY anon_insert_feedbacks ON public.fl_feedbacks FOR INSERT TO anon WITH CHECK (true);

-- (Toutes les autres tables n'ont AUCUNE politique anon → accès réservé au service_role de l'app.)


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) REMISE À ZÉRO DES DONNÉES
--    ✅ On GARDE : fl_articles + fl_clients (intactes)
--    ✅ On GARDE les comptes ADMIN (pour ne pas perdre l'accès à l'app)
--    ♻️ On vide le reste (transactions, demandes, appareils, etc.)
-- ─────────────────────────────────────────────────────────────────────────────

-- 3a. Comptes de connexion : on supprime les comptes NON-admin (clients web, démos)
--     et on garde tous les comptes dont le rôle contient "admin" (super_super_admin, super_admin, admin...).
DELETE FROM public.fl_users
WHERE COALESCE(payload->>'role','') NOT LIKE '%admin%';

-- 3b. Tables transactionnelles & demandes → VIDÉES
TRUNCATE
  public.fl_commandes,
  public.fl_commandes_web,
  public.fl_account_requests,
  public.fl_site_access,
  public.fl_prospects,
  public.fl_bons_livraison,
  public.fl_bons_preparation,
  public.fl_bons_achat,
  public.fl_purchase_orders,
  public.fl_receptions,
  public.fl_retours,
  public.fl_trips,
  public.fl_caisses_vides,
  public.fl_charges,
  public.fl_caisse_entries,
  public.fl_documents,
  public.fl_gift_materials,
  public.fl_pa_historique
CASCADE;   -- CASCADE : vide aussi les tables liées par clé étrangère (ex. fl_gift_attributions)

-- 3c. Données de RÉFÉRENCE (fournisseurs, dépôts, RH, livreurs, contacts).
--     Par défaut on les GARDE. Décommente la ligne pour AUSSI les remettre à zéro :
-- TRUNCATE public.fl_fournisseurs, public.fl_depots, public.fl_salaries,
--          public.fl_actionnaires, public.fl_livreurs, public.fl_company_contacts CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4) VÉRIFICATION (lis le résultat après exécution)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'fl_articles' AS table, count(*) FROM public.fl_articles
UNION ALL SELECT 'fl_clients',       count(*) FROM public.fl_clients
UNION ALL SELECT 'fl_users (admins)',count(*) FROM public.fl_users
UNION ALL SELECT 'fl_commandes',     count(*) FROM public.fl_commandes
UNION ALL SELECT 'fl_site_access',   count(*) FROM public.fl_site_access
ORDER BY 1;

-- ✅ Attendu après exécution :
--    fl_articles  = ton nombre d'articles (inchangé)
--    fl_clients   = ton nombre de clients (inchangé)
--    fl_users     = seulement tes comptes admin
--    fl_commandes = 0   |   fl_site_access = 0
-- ════════════════════════════════════════════════════════════════════════════
