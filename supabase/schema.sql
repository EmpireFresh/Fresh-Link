-- ════════════════════════════════════════════════════════
--  Empire Fresh — Supabase Schema
--  Collez ce SQL dans : Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════

-- Table principale des inscriptions
CREATE TABLE IF NOT EXISTS public.inscriptions (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT now(),

  -- Étape 1 — Profil
  type          TEXT NOT NULL,
  autres_detail TEXT,

  -- Étape 2 — Activité
  taille        TEXT,
  frequence     TEXT,
  gamme         TEXT,
  volume        TEXT,

  -- Étape 3 — Contact
  nom           TEXT NOT NULL,
  telephone     TEXT NOT NULL,
  adresse       TEXT,
  quartier      TEXT,
  livraison     TEXT,
  notes         TEXT,

  -- Meta
  source        TEXT DEFAULT 'website-form',
  status        TEXT DEFAULT 'nouveau'  -- nouveau | contacté | client | archivé
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_inscriptions_type      ON public.inscriptions(type);
CREATE INDEX IF NOT EXISTS idx_inscriptions_quartier  ON public.inscriptions(quartier);
CREATE INDEX IF NOT EXISTS idx_inscriptions_status    ON public.inscriptions(status);
CREATE INDEX IF NOT EXISTS idx_inscriptions_created   ON public.inscriptions(created_at DESC);

-- ── Row Level Security ────────────────────────────────────────────────────
-- Active RLS (la clé Service contourne RLS côté serveur)
ALTER TABLE public.inscriptions ENABLE ROW LEVEL SECURITY;

-- Interdit tout accès public par défaut (la clé anon ne peut rien lire/écrire)
-- L'insertion se fait via la clé SERVICE dans la fonction serverless
CREATE POLICY "service_only" ON public.inscriptions
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ── Vue dashboard (optionnel) ─────────────────────────────────────────────
-- Vue lisible dans Supabase Table Editor avec les statuts
CREATE OR REPLACE VIEW public.v_inscriptions AS
SELECT
  id,
  created_at::DATE                       AS date,
  to_char(created_at, 'HH24:MI')        AS heure,
  type,
  nom,
  telephone,
  quartier,
  livraison,
  volume,
  status,
  notes
FROM public.inscriptions
ORDER BY created_at DESC;
