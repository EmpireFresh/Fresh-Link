# 🔗 Guide d'Intégration — FreshLink Vita Fresh

## Vue d'ensemble de l'architecture

```
┌─────────────────────────────────────────────────────────┐
│                  FreshLink Vita Fresh                  │
│              (Next.js 15 + React 19)                    │
└──────────────┬──────────────────────────┬───────────────┘
               │                          │
       ┌───────▼──────┐          ┌────────▼───────┐
       │   NETLIFY    │          │     VERCEL     │
       │ vita-fresh │          │  (alternative) │
       │ .netlify.app │          │                │
       └───────┬──────┘          └────────┬───────┘
               │                          │
       ┌───────▼──────────────────────────▼───────┐
       │              SUPABASE                     │
       │   Project: gcpcrnagyqiedouucmeq           │
       │   • Base de données (PostgreSQL)          │
       │   • Storage: freshlink-media              │
       │   • Auth (optionnel)                      │
       └───────────────────────────────────────────┘
               │
       ┌───────▼──────┐
       │  NEO.SPACE   │
       │    SMTP      │
       │  (emails)    │
       └──────────────┘
```

---

## 📌 ÉTAPE 1 — Supabase (5 minutes)

### 1.1 Récupérer vos clés API

1. Aller sur : https://supabase.com/dashboard/project/gcpcrnagyqiedouucmeq/settings/api
2. Copier :
   - **Anon Key** (public) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service Role Key** (secret) → `SUPABASE_SERVICE_ROLE_KEY`

### 1.2 Vérifier le bucket Storage

Votre bucket **freshlink-media** est déjà configuré avec les photos articles.

Vérifier qu'il est **public** :
1. Supabase → Storage → Buckets → `freshlink-media`
2. Cliquer "..." → Edit Bucket → cocher **Public bucket** → Save

Pour accéder aux photos existantes :
```
https://gcpcrnagyqiedouucmeq.supabase.co/storage/v1/object/public/freshlink-media/[nom-fichier]
```

### 1.3 Exécuter le schéma SQL

1. Supabase → SQL Editor → New Query
2. Copier/coller le contenu de `scripts/supabase_schema_v3.sql`
3. Cliquer **Run**

### 1.4 Configurer les RLS Policies

Le schéma SQL les crée automatiquement (anon: full access).

---

## 📌 ÉTAPE 2 — Neo.space Email (3 minutes)

Neo.space est votre service email pour :
- Rapport journalier → `fresh.empire.contact@gmail.com`
- Réinitialisation mot de passe
- Notifications WhatsApp fallback

### 2.1 Récupérer les infos SMTP Neo.space

1. Aller sur https://app.neo.space
2. Mon Compte → Mail → SMTP Settings
3. Copier :
   - **SMTP Host** : `smtp.neo.space`
   - **SMTP Port** : `587`
   - **Username** : votre email Neo
   - **Password** : votre mot de passe Neo

### 2.2 Mettre à jour .env.local

```env
SMTP_HOST=smtp.neo.space
SMTP_PORT=587
SMTP_USER=votre-email@vita-fresh.co.site
SMTP_PASS=VOTRE_MOT_DE_PASSE_NEO
SMTP_FROM="FreshLink Vita Fresh <no-reply@vita-fresh.co.site>"
DAILY_REPORT_EMAIL=fresh.empire.contact@gmail.com
```

---

## 📌 ÉTAPE 3 — Déploiement Netlify (recommandé)

Votre site actuel : **https://vita-fresh.netlify.app**

### 3.1 Via l'interface Netlify (recommandé)

1. Aller sur https://app.netlify.com
2. Votre site → **Site Settings** → **Build & Deploy**
3. Vérifier :
   - **Build command** : `npm run build`
   - **Publish directory** : `.next`
   - **Node version** : `20`

### 3.2 Variables d'environnement Netlify

Site Settings → **Environment Variables** → Add variable :

| Clé | Valeur |
|-----|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://gcpcrnagyqiedouucmeq.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (votre anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | (votre service role key) |
| `ANTHROPIC_API_KEY` | (votre clé Claude) |
| `SMTP_HOST` | `smtp.neo.space` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | (votre email Neo) |
| `SMTP_PASS` | (votre mot de passe Neo) |
| `SMTP_FROM` | `FreshLink Vita Fresh <no-reply@vita-fresh.co.site>` |
| `DAILY_REPORT_EMAIL` | `fresh.empire.contact@gmail.com` |
| `NEXT_PUBLIC_APP_URL` | `https://vita-fresh.netlify.app` |

### 3.3 Installer le plugin Next.js

Netlify → Site → **Plugins** → Chercher `@netlify/plugin-nextjs` → Install

Ou automatiquement via `netlify.toml` (déjà inclus dans le ZIP).

### 3.4 Déclencher un redéploiement

```bash
# Option A : Via Git (recommandé)
git add -A
git commit -m "feat: intégration Supabase gcpcrnagyqiedouucmeq + Neo.space"
git push origin main
# Netlify déploie automatiquement

# Option B : Via Netlify CLI
npx netlify deploy --prod
```

---

## 📌 ÉTAPE 4 — Déploiement Vercel (alternatif)

Si vous préférez Vercel en parallèle :

```bash
# Installation Vercel CLI
npm i -g vercel

# Déploiement
cd FreshLink-vita-fresh
vercel login
vercel --prod
```

Ou via l'interface :
1. https://vercel.com → New Project → Import Git Repository
2. Framework : **Next.js** (auto-détecté)
3. Ajouter les mêmes variables d'environnement que Netlify
4. Deploy

Le fichier `vercel.json` est déjà configuré (région `cdg1` = Paris).

---

## 📌 ÉTAPE 5 — Test de connexion

Après déploiement, tester dans cet ordre :

### 5.1 Supabase connecté ?
- Se connecter à l'app → Accueil → la barre de sync doit afficher "✅ Supabase"
- BOSettings → Sync → "Tester la connexion"

### 5.2 Photos articles chargées ?
- BackOffice → Catalogue Produits
- Les photos doivent s'afficher depuis `freshlink-media`

### 5.3 Email fonctionnel ?
- Finance & CdG → Rapport Journalier → "Envoyer le rapport maintenant"
- Vérifier `fresh.empire.contact@gmail.com`

---

## 📁 Structure des fichiers importants

```
FreshLink-vita-fresh/
├── .env.local.template    ← Copier en .env.local + remplir
├── .env.example           ← Même contenu (référence)
├── netlify.toml           ← Config Netlify (auto)
├── vercel.json            ← Config Vercel (auto)
├── next.config.js         ← Images Supabase autorisées
├── lib/
│   └── supabase/
│       ├── client.ts      ← Projet gcpcrnagyqiedouucmeq ✓
│       ├── server.ts      ← Idem
│       └── db.ts          ← Toutes les fonctions DB
└── scripts/
    └── supabase_schema_v3.sql  ← Schéma complet à exécuter
```

---

## 🔧 Dépannage rapide

| Problème | Solution |
|---------|----------|
| `ANON_KEY` manquant | Dashboard Supabase → Settings → API → copier anon key |
| Photos ne s'affichent pas | Vérifier bucket `freshlink-media` est **Public** |
| Emails non reçus | Vérifier SMTP Neo.space dans .env, tester avec Mailhog en local |
| Build Netlify échoue | Vérifier `NODE_VERSION=20` dans les env vars Netlify |
| `Module not found` | Exécuter `npm install` puis redéployer |
| Supabase offline | Mode local automatique — données sauvegardées en localStorage |

---

## 📞 Ressources utiles

- Supabase Dashboard : https://supabase.com/dashboard/project/gcpcrnagyqiedouucmeq
- Storage bucket : https://supabase.com/dashboard/project/gcpcrnagyqiedouucmeq/storage
- Netlify app : https://app.netlify.com
- Neo.space : https://app.neo.space
- Anthropic API : https://console.anthropic.com/settings/keys

