# 🗄️ Déploiement Schéma V3 — Vita Core / Fresh Link Pro

Le fichier `supabase/schema_v3_vita_core.sql` est la **nouvelle liaison** : propre, rapide, sécurisée.

---

## ✅ Ce que fait le script (en une passe)

1. **Archive automatiquement** tout l'existant dans des tables `_archive_fl_*_YYYYMMDD` → **filet anti-perte** (tes 972 clients restent récupérables).
2. **Recrée proprement** les 24 tables entités core avec le pattern `{ id, payload JSONB, updated_at }` → **compatible 100% avec tes API actuelles** (sync-read, sync-write, auth, catalogue) : aucune route à réécrire.
3. **Index GIN + pg_trgm** sur tous les payloads → recherche et filtres **rapides**.
4. **Crée les 12 tables du moteur commercial** : remises/gratuités, cadeaux segmentés, matrice bonus, cutoffs, notifications multi-services, secteurs/team-leads, feedbacks, alertes prédictives, historique PA, trips GPS.
5. **5 fonctions PL/pgSQL** : calcul gratuités (anti-fraude), bonus avec garde-fou plafond, cash-flow terrain, PA prédit, pricing dynamique.
6. **Triggers** : géofencing auto à la création client, notif cadeau + décrément stock, `updated_at` auto.
7. **RLS** : service_role tout, anon = lecture catalogue + insert commandes/demandes/feedbacks.
8. **Realtime** activé sur les tables clés (sync live fluide).
9. **Seeds** : plafonds bonus (15%), contacts urgence (0636561707), Balance (Marchands) + Pack couteaux (CHR), matrice bonus, Team Lead "Jariri l'IA".

---

## 🚀 Étapes de déploiement

### 1. Sauvegarde manuelle (recommandé en plus de l'archive auto)
Supabase Dashboard → **Database** → **Backups** → vérifie qu'un backup récent existe.

### 2. Exécuter le script
1. Supabase Dashboard → **SQL Editor** → **New query**
2. Copie **tout** le contenu de `supabase/schema_v3_vita_core.sql`
3. Clique **Run**
4. Vérifie le message final : `✅ Schéma V3 installé : XX tables fl_* actives.`

### 3. Re-seed le catalogue articles
Les articles sont dans les archives. Pour repeupler proprement :
```bash
curl -X POST https://f-l.vercel.app/api/ext/seed-articles \
  -H "Content-Type: application/json" -d '{"wipe":true,"force":true}'
```

### 4. Restaurer les vrais clients (optionnel, depuis l'archive)
Si tu veux récupérer tes clients réels depuis l'archive :
```sql
insert into fl_clients (id, payload, updated_at, created_at)
select id, payload, updated_at, coalesce(created_at, now())
from _archive_fl_clients_YYYYMMDD
on conflict (id) do nothing;
```
(remplace `YYYYMMDD` par la date affichée dans les tables d'archive)

### 5. Vérifier
```bash
curl https://f-l.vercel.app/api/ext/stats
```

---

## 🧹 Purge des archives (APRÈS validation que tout marche)

Quand tu es sûr que tout fonctionne :
```sql
-- Liste les archives
select tablename from pg_tables where tablename like '\_archive\_%';
-- Puis pour chacune :
drop table _archive_fl_clients_YYYYMMDD cascade;
-- (etc.)
```

---

## 📐 Fonctions disponibles (appelables depuis les API routes)

| Fonction | Usage |
|----------|-------|
| `fl_calc_gratuite(article, segment, qte)` | Qté offerte selon paliers (ex 10→1) |
| `fl_calc_bonus(prevendeur, ca, segment, famille)` | Bonus plafonné automatiquement |
| `fl_calc_cash_terrain(date)` | Cash à emporter au marché de gros |
| `fl_pa_predit(article)` | Prix d'achat prédit (tendance) |
| `fl_pricing_dynamique(article, cost_log, marge, client)` | PV = PA + Log + Marge + Risk |

Exemple d'appel via PostgREST RPC :
```bash
curl -X POST "$SB_URL/rest/v1/rpc/fl_calc_bonus" \
  -H "apikey: $SERVICE_KEY" -H "Content-Type: application/json" \
  -d '{"p_prevendeur":"VFU00010","p_ca":50000,"p_segment":"chr","p_famille":"TOUTES"}'
```

---

## ⏭️ Prochaines phases (après cette fondation)

Cette fondation SQL débloque tout le reste. Phases suivantes (à faire ensuite) :
- **Phase 2** : UI moteur commercial (BO remises/gratuités/cadeaux) + matrice bonus
- **Phase 3** : Inscription site (champ origine) + géo-routage + workflow WhatsApp bienvenue
- **Phase 4** : Dashboards financiers (cash-flow, pricing dynamique, actionnaires)
- **Phase 5** : GPS temps réel + ETA cartographique, export Excel/Word
- **Phase 6** : Design premium boutique + app, CORS stricts vita-core.org
