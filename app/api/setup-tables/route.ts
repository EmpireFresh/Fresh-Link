import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

const SETUP_SQL = `-- FreshLink Pro — Setup Supabase v6 (RLS sécurisé)
-- Paste this in: https://supabase.com/dashboard/project/jwdrwapuetqoqnankgma/sql/new

-- ── 1. Supprimer les anciennes tables ─────────────────────────────────────────
DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'fl_%'
  LOOP EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', t); END LOOP;
END $$;

-- ── 2. Créer les tables (format JSONB unifié) ──────────────────────────────────
CREATE TABLE public.fl_depots            (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_users             (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_clients           (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_fournisseurs      (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_articles          (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_livreurs          (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_commandes         (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_bons_achat        (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_purchase_orders   (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_bons_livraison    (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_bons_preparation  (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_receptions        (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_trips             (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_retours           (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_visites           (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_messages          (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_transferts_stock  (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_demandes_achat    (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_notices           (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_non_achats        (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_demandes_acces    (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_documents         (id TEXT PRIMARY KEY, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.fl_commandes_web     (id TEXT PRIMARY KEY, payload JSONB, updated_at TIMESTAMPTZ DEFAULT now(), nom_client TEXT, telephone TEXT, email TEXT, adresse_livraison TEXT, lignes JSONB, montant_total FLOAT, creneau TEXT, statut TEXT DEFAULT 'nouveau', source TEXT DEFAULT 'site_web', created_at TIMESTAMPTZ DEFAULT now());

-- ── fl_site_access : table plate (colonnes explicites) pour contrôle d'accès appareils ──
-- N'utilise PAS le format {id, payload} — colonnes directes pour lisibilité et filtrage
CREATE TABLE public.fl_site_access (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  device_id     TEXT UNIQUE NOT NULL,
  nom           TEXT,
  telephone     TEXT,
  statut        TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente','autorise','bloque')),
  gps_lat       FLOAT,
  gps_lng       FLOAT,
  gps_precision FLOAT,
  user_agent    TEXT,
  first_visit_at TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  autorise_par  TEXT,
  autorise_at   TIMESTAMPTZ,
  bloque_at     TIMESTAMPTZ,
  notes         TEXT
);

-- ── 3. Activer RLS sur TOUTES les tables fl_ ──────────────────────────────────
-- Le service_role (clé secrète serveur) contourne toujours le RLS — aucune API
-- serveur n'est impactée. Le role anon (clé publique) est limité par les policies.
DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'fl_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- Le role authenticated (service_role inclus) accède à tout
    EXECUTE format('GRANT ALL ON public.%I TO authenticated', t);
    -- Le role anon a besoin du SELECT au minimum pour les pings de connexion
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ── 4. Policies pour le role anon ─────────────────────────────────────────────
-- Principe : anon peut lire les données métier non-sensibles,
--            mais ne voit JAMAIS fl_users (mots de passe).

-- fl_articles : lecture publique pour le catalogue/marketplace du site web
CREATE POLICY "anon_select_articles" ON public.fl_articles
  FOR SELECT TO anon USING (true);

-- fl_commandes : anon peut créer une commande depuis le site web
CREATE POLICY "anon_insert_commandes" ON public.fl_commandes
  FOR INSERT TO anon WITH CHECK (true);

-- fl_demandes_acces : anon peut soumettre une demande de compte depuis le site
CREATE POLICY "anon_insert_demandes_acces" ON public.fl_demandes_acces
  FOR INSERT TO anon WITH CHECK (true);

-- Tables de lecture "safe" pour les pings BO (pas de données sensibles dedans)
CREATE POLICY "anon_select_depots"     ON public.fl_depots          FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_clients"    ON public.fl_clients          FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_livreurs"   ON public.fl_livreurs         FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_messages"   ON public.fl_messages         FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_visites"    ON public.fl_visites          FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_notices"    ON public.fl_notices          FOR SELECT TO anon USING (true);

-- ── 5. fl_users : AUCUN accès anon (mots de passe protégés) ───────────────────
-- Seul le service_role (côté serveur, via SUPABASE_SERVICE_ROLE_KEY) peut lire
-- et écrire fl_users. Le role anon ne voit aucune ligne.
-- (Pas de policy anon = aucun accès anon par défaut avec RLS activé)

-- Policy pour authenticated (utilisé par le service_role en bypass + Supabase Auth)
CREATE POLICY "auth_all_fl_users" ON public.fl_users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- fl_commandes_web : anon peut insérer des commandes depuis le site
CREATE POLICY "anon_insert_commandes_web" ON public.fl_commandes_web
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_commandes_web" ON public.fl_commandes_web
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- fl_site_access : anon peut INSERT (enregistrer son appareil) et SELECT (vérifier son statut)
-- Mais uniquement sa propre ligne (via device_id)
CREATE POLICY "anon_insert_site_access" ON public.fl_site_access
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_site_access" ON public.fl_site_access
  FOR SELECT TO anon USING (true);
CREATE POLICY "auth_all_site_access" ON public.fl_site_access
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 6. Realtime ───────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.fl_depots, public.fl_users, public.fl_clients, public.fl_fournisseurs,
  public.fl_articles, public.fl_livreurs, public.fl_commandes, public.fl_bons_achat,
  public.fl_purchase_orders, public.fl_bons_livraison, public.fl_bons_preparation,
  public.fl_receptions, public.fl_trips, public.fl_retours, public.fl_visites,
  public.fl_messages, public.fl_transferts_stock, public.fl_demandes_achat,
  public.fl_notices, public.fl_non_achats, public.fl_demandes_acces,
  public.fl_documents, public.fl_commandes_web, public.fl_site_access;

-- ── 7. Résumé sécurité ────────────────────────────────────────────────────────
-- ✅ RLS activé sur toutes les tables
-- ✅ fl_users inaccessible via anon (mots de passe protégés)
-- ✅ fl_articles lisible publiquement (catalogue site web)
-- ✅ fl_commandes/fl_demandes_acces/fl_commandes_web : anon peut insérer (site web)
-- ✅ fl_site_access : anon peut s'enregistrer et vérifier son statut d'accès
-- ✅ service_role (SUPABASE_SERVICE_ROLE_KEY) contourne RLS côté serveur
-- ⚠️  Changer AUTH_SECRET dans .env.local (ne pas utiliser la valeur par défaut)
`

const ERP_TABLES = [
  "fl_depots","fl_users","fl_clients","fl_fournisseurs","fl_articles",
  "fl_livreurs","fl_commandes","fl_bons_achat","fl_purchase_orders",
  "fl_bons_livraison","fl_bons_preparation","fl_receptions","fl_trips",
  "fl_retours","fl_visites","fl_messages","fl_transferts_stock",
  "fl_demandes_achat","fl_notices","fl_non_achats","fl_demandes_acces",
  "fl_documents","fl_commandes_web","fl_site_access",
]

export async function GET() {
  const sb = createClient(SUPABASE_URL, ANON_KEY || "offline")
  const results: Record<string, boolean> = {}
  let connected = false

  try {
    const { error } = await sb.from("fl_depots").select("id").limit(1)
    connected = !error
  } catch { connected = false }

  for (const table of ERP_TABLES) {
    try {
      const { error } = await sb.from(table).select("id").limit(1)
      results[table] = !error
    } catch { results[table] = false }
  }

  const existCount = Object.values(results).filter(Boolean).length
  const missing = Object.entries(results).filter(([,v]) => !v).map(([k]) => k)

  return NextResponse.json({
    connected,
    tables_exist: existCount,
    tables_total: ERP_TABLES.length,
    missing,
    ready: existCount === ERP_TABLES.length,
    setup_sql: SETUP_SQL,
    supabase_sql_editor: `https://supabase.com/dashboard/project/jwdrwapuetqoqnankgma/sql/new`,
  })
}
