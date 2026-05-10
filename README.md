# 🥑 FreshLink Empire Fresh v3.0

> Plateforme de gestion commerciale, logistique et suivi de distribution — **fruits et légumes au Maroc**

---

## 🚀 Démarrage rapide

```bash
# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env.local
# Remplir .env.local avec vos vraies clés

# Lancer en développement
npm run dev
```

## 🏗️ Stack technique

- **Next.js 15** + React 19 + TypeScript
- **Supabase** (base de données + auth)
- **Tailwind CSS v3** + Lucide icons
- **PWA** (Progressive Web App) installable sur mobile
- **Recharts** pour les graphiques et analytics

## 📁 Structure du projet

```
FreshLink-empire-fresh/
├── app/                    # Pages & API routes (Next.js App Router)
│   ├── api/ext/            # API publiques (catalogue, commandes, comptes)
│   ├── globals.css         # Styles globaux
│   ├── layout.tsx          # Layout racine (PWA, polices, metadata)
│   └── page.tsx            # Page principale (routage par rôle)
├── components/
│   ├── auth/               # Login, authentification
│   ├── backoffice/         # 50+ modules backoffice (BO*)
│   ├── mobile/             # Interface mobile (agents terrain)
│   ├── portail/            # Portails externes (clients, fournisseurs)
│   └── ui/                 # Composants réutilisables
├── lib/
│   ├── ai.ts               # Agents IA (Anthropic / OpenAI / OpenRouter)
│   ├── store.ts            # État global (zustand-like)
│   ├── supabase/           # Client, serveur, sync
│   ├── email.ts            # Envoi d'emails
│   ├── print.tsx           # Génération PDF / impression
│   └── lang.ts             # Internationalisation (FR/AR/EN)
├── scripts/                # SQL + scripts de setup Supabase
├── public/                 # Assets, icônes PWA, manifest
└── .env.example            # Template variables d'environnement
```

## 🎯 Modules principaux

### BackOffice
| Module | Description |
|--------|-------------|
| BODashboard | Tableau de bord principal |
| BOCommercial | Gestion commandes & clients |
| BOStock | Inventaire & stocks |
| BOFinance | Caisse, comptabilité, RH |
| BOAchat | Achats & fournisseurs |
| BODispatch | Dispatch livraisons |
| BOAgentsIA | Agents IA experts |
| BOPricing | Intelligence prix |
| BOGPSTracker | Suivi GPS livreurs |
| BOWhatsApp | Intégration WhatsApp |
| + 40 autres modules | ... |

### Mobile (terrain)
- MobileDashboard, MobileCommercial, MobilePreparation
- MobileLogistique, MobileAchat, MobilePricing
- CameraIARetour (retours avec IA caméra)

### Portails externes
- PortailClient — commandes en ligne
- PortailFournisseur — catalogue & offres
- PortailExterne — API REST publique

## 🔐 Variables d'environnement

Voir `.env.example` pour la liste complète. Indispensables :
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY` (ou `OPENAI_API_KEY`)
- `SMTP_*` pour les emails

## 📦 Scripts utiles

```bash
# Setup base de données Supabase
node scripts/setup-supabase.mjs

# Upload images articles
node scripts/upload-images.mjs

# Réinitialiser bons de livraison
node scripts/fix-bl-final.js
```

## 🌐 Déploiement

```bash
# Vercel (recommandé)
vercel deploy

# Ou build manuel
npm run build && npm start
```

---

**Empire Fresh** · Casablanca, Maroc 🇲🇦
