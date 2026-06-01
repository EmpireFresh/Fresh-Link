-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SCHEMA V3 — VITA CORE / FRESH LINK PRO                                     ║
-- ║  Nouvelle liaison Supabase : solide, fluide, rapide.                        ║
-- ║  Pattern entités : { id TEXT PK, payload JSONB, updated_at }                ║
-- ║    → 100% compatible avec les API existantes (sync-read/sync-write/auth/    ║
-- ║      catalogue) : AUCUNE route à réécrire, ça marche instantanément.        ║
-- ║  + Index GIN (recherche rapide), Realtime (sync live), RLS (sécurité).      ║
-- ║  + Moteur commercial : remises, gratuités, cadeaux segmentés, matrice       ║
-- ║    bonus, cutoffs, notifications, secteurs, feedbacks, alertes prédictives. ║
-- ║                                                                            ║
-- ║  ⚠️ SÉCURITÉ : ce script ARCHIVE tout l'existant dans _archive_* AVANT      ║
-- ║     de recréer. Rien n'est perdu. Voir la fin pour purger les archives.     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════════════
-- ÉTAPE 0 — EXTENSIONS
-- ════════════════════════════════════════════════════════════════════════════
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";   -- recherche floue rapide (noms articles/clients)

-- ════════════════════════════════════════════════════════════════════════════
-- ÉTAPE 1 — ARCHIVAGE DE SÉCURITÉ (filet anti-perte de données)
--   Copie chaque table existante vers _archive_<table>_<date>.
--   Idempotent : si l'archive existe déjà, on ne réécrase pas.
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  r record;
  archive_suffix text := to_char(now(), 'YYYYMMDD');
  archive_name text;
begin
  for r in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename like 'fl_%'
      and tablename not like '\_archive\_%'
  loop
    archive_name := '_archive_' || r.tablename || '_' || archive_suffix;
    if not exists (select 1 from pg_tables where schemaname='public' and tablename=archive_name) then
      execute format('create table public.%I as table public.%I', archive_name, r.tablename);
      raise notice 'Archivé : % → %', r.tablename, archive_name;
    end if;
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- ÉTAPE 2 — HELPER : table-entité standard { id, payload, updated_at }
--   Macro via fonction pour créer chaque table de façon homogène.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function _fl_make_entity(tbl text) returns void as $$
begin
  execute format('drop table if exists public.%I cascade', tbl);
  execute format($f$
    create table public.%I (
      id          text primary key,
      payload     jsonb not null default '{}'::jsonb,
      updated_at  timestamptz not null default now(),
      created_at  timestamptz not null default now()
    )
  $f$, tbl);
  -- Index GIN pour requêtes rapides dans le JSONB (recherche, filtres)
  execute format('create index if not exists idx_%s_payload on public.%I using gin (payload)', tbl, tbl);
  -- Index sur updated_at pour les syncs incrémentales
  execute format('create index if not exists idx_%s_updated on public.%I (updated_at desc)', tbl, tbl);
end $$ language plpgsql;

-- ════════════════════════════════════════════════════════════════════════════
-- ÉTAPE 3 — TABLES ENTITÉS CORE (pattern {id, payload})
--   Recréées proprement. Compatibles avec l'API existante.
-- ════════════════════════════════════════════════════════════════════════════
select _fl_make_entity('fl_users');            -- comptes (interne + clients + fournisseurs login)
select _fl_make_entity('fl_clients');          -- profils clients (CHR/Marchand/Particulier)
select _fl_make_entity('fl_fournisseurs');     -- fournisseurs marché de gros
select _fl_make_entity('fl_articles');         -- catalogue produits
select _fl_make_entity('fl_commandes');        -- commandes internes (prévendeurs)
select _fl_make_entity('fl_commandes_web');    -- commandes site web
select _fl_make_entity('fl_bons_achat');       -- bons d'achat (PO) marché de gros
select _fl_make_entity('fl_bons_preparation'); -- bons de préparation (cross-dock)
select _fl_make_entity('fl_bons_livraison');   -- BL
select _fl_make_entity('fl_receptions');       -- réceptions marchandise
select _fl_make_entity('fl_depots');           -- dépôts / entrepôts
select _fl_make_entity('fl_livreurs');         -- livreurs
select _fl_make_entity('fl_visites');          -- visites prévendeurs
select _fl_make_entity('fl_non_achats');       -- signalements non-achat
select _fl_make_entity('fl_caisse');           -- caisse / mouvements financiers
select _fl_make_entity('fl_caisses_vides');    -- caisses vides (consignes)
select _fl_make_entity('fl_actionnaires');     -- actionnaires & parts sociales
select _fl_make_entity('fl_salaries');         -- RH / salariés
select _fl_make_entity('fl_charges');          -- charges fixes & variables
select _fl_make_entity('fl_documents');        -- devis, contrats, factures
select _fl_make_entity('fl_site_access');      -- device guard (accès appareils)
select _fl_make_entity('fl_account_requests'); -- demandes d'inscription
select _fl_make_entity('fl_prospects');        -- prospects (avant validation)
select _fl_make_entity('fl_company_config');   -- config société (BL, ICE, RC, logo...)

-- ════════════════════════════════════════════════════════════════════════════
-- ÉTAPE 4 — TABLES RELATIONNELLES DU MOTEUR COMMERCIAL (typées, pour les algos)
-- ════════════════════════════════════════════════════════════════════════════

-- ── 4.1 Configuration globale (plafonds, contacts urgence, paramètres) ──
drop table if exists public.fl_config_globale cascade;
create table public.fl_config_globale (
  cle          text primary key,
  valeur       jsonb not null,
  description  text,
  updated_at   timestamptz not null default now()
);

-- ── 4.2 Secteurs / Zones géographiques + Team Lead ──
drop table if exists public.fl_secteurs cascade;
create table public.fl_secteurs (
  id            text primary key,
  nom           text not null,
  zone          text,
  team_lead_id  text,                    -- réf fl_users (Team Lead)
  team_lead_nom text default 'Jariri l''IA',
  -- Bounding box GPS de la zone (géofencing)
  gps_lat_min   double precision,
  gps_lat_max   double precision,
  gps_lng_min   double precision,
  gps_lng_max   double precision,
  prevendeur_id text,                    -- prévendeur assigné à cette zone
  actif         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_secteurs_prevendeur on public.fl_secteurs(prevendeur_id);

-- ── 4.3 Règles de remises & gratuités (calcul serveur anti-fraude) ──
drop table if exists public.fl_pricing_rules cascade;
create table public.fl_pricing_rules (
  id            text primary key default ('PR' || substr(uuid_generate_v4()::text,1,8)),
  nom           text not null,
  type          text not null check (type in ('remise_pct','remise_montant','gratuite_palier','remise_cascade')),
  -- Cible : famille produit, article précis, segment client, ou global
  cible_segment text check (cible_segment in ('chr','marchand','particulier','tous')),
  cible_famille text,                    -- null = toutes familles
  cible_article text,                    -- null = tous articles
  -- Paramètres palier gratuité : ex 10 achetés = 1 offert
  palier_qte    numeric default 0,       -- ex 10
  palier_offert numeric default 0,       -- ex 1
  -- Paramètres remise
  remise_valeur numeric default 0,       -- % ou montant
  -- Validité
  date_debut    date,
  date_fin      date,
  priorite      int not null default 100,
  actif         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_pricing_segment on public.fl_pricing_rules(cible_segment, actif);

-- ── 4.4 Catalogue matériel cadeau (Balance, Pack couteaux...) ──
drop table if exists public.fl_gift_materials cascade;
create table public.fl_gift_materials (
  id            text primary key,
  nom           text not null,
  segment       text not null check (segment in ('chr','marchand','particulier','tous')),
  description   text,
  photo         text,
  stock_qte     int not null default 0,        -- inventaire matériel
  cout_unitaire numeric default 0,
  -- Condition de déclenchement : volume cumulé (kg) ou montant (MAD) ou contrat
  seuil_type    text check (seuil_type in ('volume_kg','montant_mad','contrat')),
  seuil_valeur  numeric default 0,
  actif         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── 4.5 Attributions de cadeaux (historique + inventaire) ──
drop table if exists public.fl_gift_attributions cascade;
create table public.fl_gift_attributions (
  id            text primary key default ('GA' || substr(uuid_generate_v4()::text,1,8)),
  client_id     text not null,
  material_id   text not null references public.fl_gift_materials(id),
  segment       text,
  declenche_par text,                    -- ex 'volume_atteint', 'contrat_signe'
  statut        text not null default 'a_livrer' check (statut in ('a_livrer','livre','annule')),
  attribue_le   timestamptz not null default now(),
  livre_le      timestamptz
);
create index idx_gift_attr_client on public.fl_gift_attributions(client_id);

-- ── 4.6 Matrice de bonus commercial (Gamme client × Famille produit) ──
drop table if exists public.fl_bonus_matrix cascade;
create table public.fl_bonus_matrix (
  id            text primary key default ('BM' || substr(uuid_generate_v4()::text,1,8)),
  segment       text not null check (segment in ('chr','marchand','particulier')),
  famille       text not null default 'TOUTES',
  taux_ca       numeric not null default 0,    -- % du CA
  taux_tonnage  numeric not null default 0,    -- MAD / tonne
  coef_marge    numeric not null default 1.0,  -- coefficient multiplicateur
  actif         boolean not null default true,
  updated_at    timestamptz not null default now(),
  unique (segment, famille)
);

-- ── 4.7 Cutoffs (blocages de flux : manuel + automatique prédictif) ──
drop table if exists public.fl_cutoffs cascade;
create table public.fl_cutoffs (
  id            text primary key default ('CO' || substr(uuid_generate_v4()::text,1,8)),
  type          text not null check (type in ('manuel','auto_tonnage','auto_geo','auto_capacite')),
  cible         text not null check (cible in ('commande','achat','tous')),
  -- Pour auto_tonnage : article/fournisseur + seuil
  article_id    text,
  fournisseur_id text,
  seuil_tonnage numeric default 0,
  tonnage_actuel numeric default 0,
  -- Pour auto_capacite : capacité utile camion
  capacite_max_kg numeric default 0,
  charge_actuelle_kg numeric default 0,
  actif         boolean not null default false,  -- false = pas de blocage
  motif         text,
  active_par    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_cutoffs_actif on public.fl_cutoffs(actif, cible);

-- ── 4.8 Routeur de notifications multi-services ──
drop table if exists public.fl_notifications cascade;
create table public.fl_notifications (
  id            text primary key default ('NT' || substr(uuid_generate_v4()::text,1,8)),
  service       text not null check (service in ('achats','sales','transport','direction','prevendeur','client','all')),
  destinataire_id text,                  -- réf user précis (optionnel)
  type          text not null,           -- 'alerte_vente','cutoff','cadeau','geo_routing'...
  titre         text not null,
  corps         text,
  priorite      text not null default 'normale' check (priorite in ('basse','normale','haute','critique')),
  lu            boolean not null default false,
  payload       jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index idx_notif_service on public.fl_notifications(service, lu, created_at desc);

-- ── 4.9 Feedbacks (avis mobile centralisés → BO temps réel) ──
drop table if exists public.fl_feedbacks cascade;
create table public.fl_feedbacks (
  id            text primary key default ('FB' || substr(uuid_generate_v4()::text,1,8)),
  auteur_id     text,
  auteur_nom    text,
  auteur_role   text,
  note          int check (note between 1 and 5),
  categorie     text,                    -- 'bug','suggestion','app','livraison'...
  message       text not null,
  statut        text not null default 'nouveau' check (statut in ('nouveau','en_cours','traite','ferme')),
  source        text default 'mobile',
  created_at    timestamptz not null default now()
);
create index idx_feedbacks_statut on public.fl_feedbacks(statut, created_at desc);

-- ── 4.10 Config alertes prédictives (cycle client + client/article) ──
drop table if exists public.fl_alert_config cascade;
create table public.fl_alert_config (
  id            text primary key default ('AC' || substr(uuid_generate_v4()::text,1,8)),
  type          text not null check (type in ('client_inactif','client_article_inactif')),
  client_id     text,                    -- null = règle globale
  article_id    text,                    -- pour client_article_inactif
  cycle_jours   int not null default 3,  -- N jours
  actif         boolean not null default true,
  derniere_alerte timestamptz,
  updated_at    timestamptz not null default now()
);
create index idx_alert_client on public.fl_alert_config(client_id, actif);

-- ── 4.11 Historique PA (prix d'achat) pour le PA prédit ──
drop table if exists public.fl_pa_historique cascade;
create table public.fl_pa_historique (
  id            text primary key default ('PA' || substr(uuid_generate_v4()::text,1,8)),
  article_id    text not null,
  fournisseur_id text,
  pa            numeric not null,        -- prix d'achat constaté
  volume_kg     numeric default 0,
  date_marche   date not null default current_date,
  created_at    timestamptz not null default now()
);
create index idx_pa_article_date on public.fl_pa_historique(article_id, date_marche desc);

-- ── 4.12 Tracking GPS tournées (trips temps réel) ──
drop table if exists public.fl_trips cascade;
create table public.fl_trips (
  id            text primary key default ('TR' || substr(uuid_generate_v4()::text,1,8)),
  livreur_id    text,
  type          text not null default 'livraison' check (type in ('livraison','achat')),
  statut        text not null default 'en_cours' check (statut in ('en_cours','termine','annule')),
  -- Position temps réel
  gps_lat       double precision,
  gps_lng       double precision,
  -- Itinéraire (liste de points clients/fournisseurs)
  points        jsonb default '[]'::jsonb,
  -- Charges logistiques calculées
  frais_carburant numeric default 0,
  frais_peage   numeric default 0,
  frais_amortissement numeric default 0,
  distance_km   numeric default 0,
  demarre_le    timestamptz,
  termine_le    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_trips_statut on public.fl_trips(statut, livreur_id);

-- ════════════════════════════════════════════════════════════════════════════
-- ÉTAPE 5 — FONCTIONS PL/pgSQL (algorithmes serveur)
-- ════════════════════════════════════════════════════════════════════════════

-- ── 5.1 Calcul des gratuités (anti-fraude, côté serveur) ──
--   Pour une ligne (article, qté, segment client) → retourne la qté offerte.
create or replace function fl_calc_gratuite(
  p_article text, p_segment text, p_qte numeric
) returns numeric as $$
declare
  v_rule record;
  v_offert numeric := 0;
begin
  select * into v_rule from fl_pricing_rules
  where type = 'gratuite_palier' and actif = true
    and (cible_segment = p_segment or cible_segment = 'tous')
    and (cible_article is null or cible_article = p_article)
    and (date_debut is null or date_debut <= current_date)
    and (date_fin   is null or date_fin   >= current_date)
    and palier_qte > 0
  order by priorite asc, palier_qte desc
  limit 1;

  if found then
    -- ex : palier 10 → 1 offert. Pour 25 achetés → floor(25/10)*1 = 2 offerts.
    v_offert := floor(p_qte / v_rule.palier_qte) * v_rule.palier_offert;
  end if;
  return coalesce(v_offert, 0);
end $$ language plpgsql stable;

-- ── 5.2 Calcul du bonus commercial avec GARDE-FOU plafond global ──
--   Somme (CA × taux_segment_famille). Plafonnée au taux max global.
create or replace function fl_calc_bonus(
  p_prevendeur text, p_ca numeric, p_segment text, p_famille text
) returns numeric as $$
declare
  v_taux numeric := 0;
  v_bonus numeric := 0;
  v_plafond numeric := 0;
  v_ca_total numeric;
begin
  -- Taux de la matrice (segment × famille), fallback famille=TOUTES
  select taux_ca into v_taux from fl_bonus_matrix
  where segment = p_segment and famille = p_famille and actif = true;
  if v_taux is null then
    select taux_ca into v_taux from fl_bonus_matrix
    where segment = p_segment and famille = 'TOUTES' and actif = true;
  end if;
  v_taux := coalesce(v_taux, 0);
  v_bonus := round(p_ca * v_taux / 100.0, 2);

  -- GARDE-FOU : le bonus ne peut jamais dépasser plafond_pct du CA total
  select (valeur->>'bonus_plafond_pct')::numeric into v_plafond
  from fl_config_globale where cle = 'plafonds';
  v_plafond := coalesce(v_plafond, 15);  -- défaut 15% si non configuré

  if p_ca > 0 and v_bonus > (p_ca * v_plafond / 100.0) then
    v_bonus := round(p_ca * v_plafond / 100.0, 2);
  end if;
  return v_bonus;
end $$ language plpgsql stable;

-- ── 5.3 Cash-flow terrain : cash à emporter au marché de gros ──
--   Somme des PO du jour pour les fournisseurs en "règlement sur place".
create or replace function fl_calc_cash_terrain(p_date date default current_date)
returns numeric as $$
declare
  v_cash numeric := 0;
begin
  -- Lit les bons d'achat du jour, fournisseurs payés cash sur place
  select coalesce(sum((ba.payload->>'montant_total')::numeric), 0)
  into v_cash
  from fl_bons_achat ba
  join fl_fournisseurs f on f.id = ba.payload->>'fournisseurId'
  where (ba.payload->>'date')::date = p_date
    and coalesce(f.payload->>'modeReglement','cash') = 'cash';
  return coalesce(v_cash, 0);
end $$ language plpgsql stable;

-- ── 5.4 PA prédit : moyenne pondérée PA hier + tendance volume ──
create or replace function fl_pa_predit(p_article text)
returns numeric as $$
declare
  v_pa_hier numeric;
  v_pa_avant numeric;
  v_tendance numeric := 0;
begin
  -- PA le plus récent
  select pa into v_pa_hier from fl_pa_historique
  where article_id = p_article order by date_marche desc limit 1;
  -- PA d'avant
  select pa into v_pa_avant from fl_pa_historique
  where article_id = p_article order by date_marche desc offset 1 limit 1;

  if v_pa_hier is null then return 0; end if;
  if v_pa_avant is not null and v_pa_avant > 0 then
    v_tendance := (v_pa_hier - v_pa_avant) / v_pa_avant;  -- variation relative
  end if;
  -- Prédiction : PA hier ajusté de 50% de la tendance récente
  return round(v_pa_hier * (1 + v_tendance * 0.5), 2);
end $$ language plpgsql stable;

-- ── 5.5 Pricing dynamique : PV = PA_prédit + Logistique + Marge + Risk_crédit ──
create or replace function fl_pricing_dynamique(
  p_article text, p_cost_log numeric, p_marge_cible numeric, p_client text
) returns numeric as $$
declare
  v_pa numeric;
  v_risk numeric := 0;
  v_balance_age int := 0;
  v_sinistralite numeric := 0;
begin
  v_pa := fl_pa_predit(p_article);
  -- Risk crédit client : balance âgée + sinistralité (depuis payload client)
  select coalesce((payload->>'balanceAgeJours')::int, 0),
         coalesce((payload->>'tauxSinistralite')::numeric, 0)
  into v_balance_age, v_sinistralite
  from fl_clients where id = p_client;
  -- Plus la balance est vieille et la sinistralité haute → plus de marge risque
  v_risk := round((v_balance_age / 30.0) * 0.5 + v_sinistralite * 2, 2);
  return round(v_pa + p_cost_log + p_marge_cible + v_risk, 2);
end $$ language plpgsql stable;

-- ════════════════════════════════════════════════════════════════════════════
-- ÉTAPE 6 — TRIGGERS
-- ════════════════════════════════════════════════════════════════════════════

-- ── 6.1 updated_at auto sur toutes les tables entités ──
create or replace function _fl_touch_updated() returns trigger as $$
begin new.updated_at := now(); return new; end $$ language plpgsql;

do $$
declare r record;
begin
  for r in select tablename from pg_tables
           where schemaname='public' and tablename like 'fl_%'
             and tablename not like '\_archive\_%'
  loop
    -- seulement si la table a une colonne updated_at
    if exists (select 1 from information_schema.columns
               where table_schema='public' and table_name=r.tablename and column_name='updated_at') then
      execute format('drop trigger if exists trg_touch_%s on public.%I', r.tablename, r.tablename);
      execute format('create trigger trg_touch_%s before update on public.%I
                      for each row execute function _fl_touch_updated()', r.tablename, r.tablename);
    end if;
  end loop;
end $$;

-- ── 6.2 Géofencing auto : à l'insert d'un client, assigner le prévendeur de zone ──
create or replace function fl_auto_geo_routing() returns trigger as $$
declare
  v_lat numeric;
  v_lng numeric;
  v_secteur record;
begin
  v_lat := (new.payload->>'gpsLat')::numeric;
  v_lng := (new.payload->>'gpsLng')::numeric;
  if v_lat is null or v_lng is null then return new; end if;

  -- Trouver le secteur dont la bbox contient le point
  select * into v_secteur from fl_secteurs
  where actif = true and prevendeur_id is not null
    and v_lat between coalesce(gps_lat_min,-90) and coalesce(gps_lat_max,90)
    and v_lng between coalesce(gps_lng_min,-180) and coalesce(gps_lng_max,180)
  limit 1;

  if found then
    new.payload := jsonb_set(new.payload, '{prevendeurId}', to_jsonb(v_secteur.prevendeur_id));
    new.payload := jsonb_set(new.payload, '{secteurId}',    to_jsonb(v_secteur.id));
    new.payload := jsonb_set(new.payload, '{teamLead}',     to_jsonb(v_secteur.team_lead_nom));
    -- Notifier le prévendeur
    insert into fl_notifications(service, destinataire_id, type, titre, corps, priorite, payload)
    values ('prevendeur', v_secteur.prevendeur_id, 'geo_routing',
            'Nouveau client dans votre zone',
            'Client ' || coalesce(new.payload->>'nom','') || ' assigné automatiquement.',
            'haute', jsonb_build_object('clientId', new.id));
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists trg_geo_routing on public.fl_clients;
create trigger trg_geo_routing before insert on public.fl_clients
for each row execute function fl_auto_geo_routing();

-- ── 6.3 Cadeau auto : à l'attribution selon volume → notif direction ──
create or replace function fl_notify_gift() returns trigger as $$
begin
  insert into fl_notifications(service, type, titre, corps, priorite, payload)
  values ('direction', 'cadeau',
          'Matériel cadeau attribué',
          'Client ' || new.client_id || ' → matériel ' || new.material_id,
          'normale', jsonb_build_object('attributionId', new.id));
  -- Décrémenter le stock matériel
  update fl_gift_materials set stock_qte = greatest(0, stock_qte - 1)
  where id = new.material_id;
  return new;
end $$ language plpgsql;

drop trigger if exists trg_gift_notify on public.fl_gift_attributions;
create trigger trg_gift_notify after insert on public.fl_gift_attributions
for each row execute function fl_notify_gift();

-- ════════════════════════════════════════════════════════════════════════════
-- ÉTAPE 7 — RLS (Row Level Security)
--   service_role : accès total (utilisé par les API routes server-side).
--   anon : lecture catalogue + insert commandes web / demandes accès / feedbacks.
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare r record;
begin
  for r in select tablename from pg_tables
           where schemaname='public' and tablename like 'fl_%'
             and tablename not like '\_archive\_%'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
    -- service_role : tout
    execute format('drop policy if exists srv_all on public.%I', r.tablename);
    execute format($p$create policy srv_all on public.%I for all to service_role using (true) with check (true)$p$, r.tablename);
  end loop;
end $$;

-- anon : lecture du catalogue articles
drop policy if exists anon_read_articles on public.fl_articles;
create policy anon_read_articles on public.fl_articles for select to anon using (true);

-- anon : insert commande web + demandes + feedbacks (pas de lecture des autres)
drop policy if exists anon_insert_cmdweb on public.fl_commandes_web;
create policy anon_insert_cmdweb on public.fl_commandes_web for insert to anon with check (true);

drop policy if exists anon_insert_req on public.fl_account_requests;
create policy anon_insert_req on public.fl_account_requests for insert to anon with check (true);

drop policy if exists anon_insert_fb on public.fl_feedbacks;
create policy anon_insert_fb on public.fl_feedbacks for insert to anon with check (true);

-- ════════════════════════════════════════════════════════════════════════════
-- ÉTAPE 8 — REALTIME (sync live fluide)
--   Active la publication temps réel sur les tables clés.
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare r record;
begin
  for r in select unnest(array[
      'fl_articles','fl_commandes','fl_commandes_web','fl_clients',
      'fl_notifications','fl_feedbacks','fl_trips','fl_cutoffs'
    ]) as t
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', r.t);
    exception when others then null;  -- déjà publiée
    end;
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- ÉTAPE 9 — SEEDS (données de configuration initiales)
-- ════════════════════════════════════════════════════════════════════════════

-- Config globale : plafonds + contacts urgence
insert into fl_config_globale(cle, valeur, description) values
  ('plafonds', '{"bonus_plafond_pct": 15, "remise_max_pct": 25}'::jsonb,
   'Plafonds bonus et remises (garde-fou financier)'),
  ('contacts', '{"urgence": "0636561707", "direction": ["Zakaria","Jawad"], "commercial": "0681736910"}'::jsonb,
   'Contacts urgence et direction'),
  ('societe', '{"nom":"FreshLink Pro","raisonSociale":"Vita Fresh","tel":"0522000000","ice":"","rc":"","if":"","patente":"","adresse":"Marché de Gros, Casablanca","logoUrl":"","piedPage":"Vita Fresh — by Vita Core"}'::jsonb,
   'Identité société pour BL/factures')
on conflict (cle) do update set valeur = excluded.valeur, updated_at = now();

-- Matériel cadeau par segment
insert into fl_gift_materials(id, nom, segment, description, seuil_type, seuil_valeur, stock_qte, actif) values
  ('GM_BALANCE', 'Balance Numérique Professionnelle', 'marchand',
   'Balance pro offerte aux marchands (épiceries, F&L) selon volume/contrat', 'volume_kg', 1000, 0, true),
  ('GM_PACKPRO', 'Pack Pro Couteaux de Chef', 'chr',
   'Pack d''outils de découpe haut de gamme pour CHR (cafés, hôtels, restaurants)', 'volume_kg', 800, 0, true)
on conflict (id) do nothing;

-- Matrice bonus par défaut (segment × famille=TOUTES)
insert into fl_bonus_matrix(segment, famille, taux_ca, taux_tonnage, coef_marge) values
  ('chr',         'TOUTES', 3.0, 50, 1.2),
  ('marchand',    'TOUTES', 2.0, 40, 1.0),
  ('particulier', 'TOUTES', 1.5, 30, 0.9)
on conflict (segment, famille) do nothing;

-- Secteur par défaut + Team Lead "Jariri l'IA"
insert into fl_secteurs(id, nom, zone, team_lead_nom, actif) values
  ('SEC_DEFAUT', 'Casablanca Centre', 'Zone A', 'Jariri l''IA', true)
on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- ÉTAPE 10 — VÉRIFICATION
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare v_count int;
begin
  select count(*) into v_count from pg_tables
  where schemaname='public' and tablename like 'fl_%' and tablename not like '\_archive\_%';
  raise notice '✅ Schéma V3 installé : % tables fl_* actives.', v_count;
  raise notice 'ℹ️  Données archivées dans les tables _archive_*. Pour les purger après validation :';
  raise notice '    select ''drop table '' || tablename || '' cascade;'' from pg_tables where tablename like ''\_archive\_%'';';
end $$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  FIN DU SCHEMA V3.                                                          ║
-- ║  Après validation que tout fonctionne, purge les archives :                ║
-- ║    DROP TABLE _archive_fl_clients_YYYYMMDD CASCADE;  (etc.)                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
