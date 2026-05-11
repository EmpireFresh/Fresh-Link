# 🌿 Empire Fresh — Guide de déploiement complet

## Architecture

```
index.html          → Landing page + formulaire modal
netlify/functions/  → Fonction serverless (Netlify)
api/submit.js       → Route API serverless (Vercel)
supabase/schema.sql → Schéma base de données
```

**Flux de données :**
```
Utilisateur remplit le formulaire
        ↓
POST /api/submit  (function serverless)
        ↓
    ┌───┴───┐
    ↓       ↓
Supabase  WhatsApp Groupe
(stocke)  (notifie via Green API)
```

---

## ① Supabase — Base de données

1. Créez un compte sur [supabase.com](https://supabase.com) (gratuit)
2. Créez un **nouveau projet** (ex: `empire-fresh`)
3. Allez dans **SQL Editor** → **New Query**
4. Collez le contenu de `supabase/schema.sql` et exécutez
5. Récupérez vos clés dans **Project Settings → API** :
   - `Project URL` → `SUPABASE_URL`
   - `service_role` (secret) → `SUPABASE_SERVICE_KEY`

---

## ② Green API — WhatsApp groupe

> Green API permet d'envoyer des messages dans des groupes WhatsApp depuis votre numéro.

1. Créez un compte sur [green-api.com](https://green-api.com)
2. Créez une **instance** et scannez le QR code avec le numéro WhatsApp de l'entreprise
3. Récupérez :
   - `idInstance` → `GREEN_API_INSTANCE`
   - `apiTokenInstance` → `GREEN_API_TOKEN`
4. Trouvez l'ID du groupe cible :
   - Ouvrez [web.whatsapp.com](https://web.whatsapp.com)
   - Cliquez sur le groupe
   - Regardez l'URL : `...#120363XXXXXXXXXX@g.us`
   - → `WA_GROUP_ID=120363XXXXXXXXXX@g.us`

**Tarifs Green API :** 3 mois gratuits, puis ~$5/mois pour usage modéré.

---

## ③ Déploiement Netlify (recommandé)

### Option A — Glisser-déposer (le plus simple)
1. Allez sur [app.netlify.com](https://app.netlify.com)
2. Glissez le dossier `empire-fresh/` dans la zone de dépôt
3. Netlify détecte automatiquement `netlify.toml`
4. Allez dans **Site settings → Environment variables** et ajoutez :
   ```
   SUPABASE_URL         = https://xxxx.supabase.co
   SUPABASE_SERVICE_KEY = eyJ...
   GREEN_API_INSTANCE   = 1101234567
   GREEN_API_TOKEN      = d75b...
   WA_GROUP_ID          = 120363XXXXXXXXXX@g.us
   ```
5. **Redéployez** (Deploys → Trigger deploy)

### Option B — Via GitHub (recommandé pour la prod)
```bash
git init
git add .
git commit -m "Empire Fresh initial"
git remote add origin https://github.com/VOTRE_ORG/empire-fresh.git
git push -u origin main
```
Puis connectez le repo dans Netlify → **New site from Git**.

### Test local Netlify
```bash
npm install
cp .env.example .env   # remplissez les valeurs
npx netlify dev         # lance sur http://localhost:8888
```

---

## ④ Déploiement Vercel (alternative)

```bash
npm install -g vercel
vercel login
vercel --prod
```

Ajoutez les variables d'environnement dans **Vercel Dashboard → Project → Settings → Environment Variables** ou via CLI :
```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_KEY
vercel env add GREEN_API_INSTANCE
vercel env add GREEN_API_TOKEN
vercel env add WA_GROUP_ID
```

---

## ⑤ Variables d'environnement — récapitulatif

| Variable               | Obligatoire | Source                                  |
|------------------------|-------------|------------------------------------------|
| `SUPABASE_URL`         | ✅          | Supabase → Project Settings → API       |
| `SUPABASE_SERVICE_KEY` | ✅          | Supabase → Project Settings → API       |
| `GREEN_API_INSTANCE`   | ⚡ WA groupe | green-api.com → Dashboard               |
| `GREEN_API_TOKEN`      | ⚡ WA groupe | green-api.com → Dashboard               |
| `WA_GROUP_ID`          | ⚡ WA groupe | web.whatsapp.com → URL du groupe        |

---

## Consulter les inscriptions (Supabase)

Dans Supabase Dashboard → **Table Editor → inscriptions** :
- Filtrer par `status`, `quartier`, `type`
- Modifier le `status` : `nouveau` → `contacté` → `client`
- Exporter en CSV

Ou dans **SQL Editor** :
```sql
-- Dernières 20 inscriptions
SELECT * FROM v_inscriptions LIMIT 20;

-- Par type de profil
SELECT type, COUNT(*) FROM inscriptions GROUP BY type;

-- Par quartier
SELECT quartier, COUNT(*) FROM inscriptions GROUP BY quartier ORDER BY count DESC;
```

---

## Sécurité

- La clé `SUPABASE_SERVICE_KEY` n'est **jamais** exposée côté client
- RLS activé : l'accès direct à la table est impossible depuis le navigateur
- Les variables d'env sont injectées côté serveur uniquement (Netlify/Vercel)
- Ajoutez un rate-limit sur `/api/submit` si nécessaire (Netlify ou Vercel middleware)

---

## Support

**WhatsApp** : wa.me/212660671709  
**Email** : Jawad@empire-fresh.co.site
