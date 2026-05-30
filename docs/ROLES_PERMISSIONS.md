# 🔐 Système de rôles et permissions — Vita Fresh / Vita Core

Cette documentation détaille **tous** les rôles utilisateurs, leurs accès, droits et flux dans l'application.

---

## 📊 Vue d'ensemble — 27 rôles répartis en 3 interfaces

```
┌──────────────────────────────────────────────────────────────────┐
│  INTERFACE BACK-OFFICE (f-l.vercel.app)                          │
│  ────────────────────────────────────────                        │
│  super_super_admin · super_admin · admin · resp_commercial       │
│  team_leader · cash_man · financier · rh_manager · comptable     │
│  investisseur · qualite · it_admin · auditeur                    │
│  resp_achat · charge_recouvrement                                │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  INTERFACE MOBILE / TERRAIN (f-l.vercel.app/mobile)              │
│  ────────────────────────────────────────                        │
│  prevendeur · resp_logistique · magasinier · dispatcheur         │
│  livreur · acheteur · ctrl_achat · ctrl_prep                     │
│  chef_depot · suivi_commande                                     │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  PORTAILS EXTERNES                                                │
│  ────────────────────────────────────────                        │
│  client          → vitafresh.vercel.app (particulier)            │
│                  → portail CHR/Marchand (f-l.vercel.app)         │
│  fournisseur     → portail Fournisseur (f-l.vercel.app)          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🏆 Hiérarchie des privilèges

```
   super_super_admin   (Jawad uniquement — VFU00001)
            ↓
       super_admin
            ↓
          admin
            ↓
   resp_commercial / resp_logistique / resp_achat / rh_manager
            ↓
    team_leader / cash_man / financier
            ↓
    Personnels terrain (prevendeur, livreur, etc.)
            ↓
   Comptes externes (client, fournisseur)
```

---

## 📋 Détail rôle par rôle

### 1. 🔝 super_super_admin

**Cible** : Jawad (fondateur Vita Core, accès absolu)

| Aspect | Détail |
|--------|--------|
| **Identifiant** | VFU00001 (constante `JAWAD_ID`) |
| **Interface** | Back-office complet |
| **Accès** | TOUT — aucune restriction |
| **Permissions spéciales** | Purge système, paramètres critiques, restauration |
| **Création** | Hardcodé dans `lib/store.ts` JAWAD_USER, non supprimable |
| **Auth fallback** | Toujours dispo même si Supabase vide |

**Droits exclusifs** :
- Effacer toutes les données (Paramètres → Wipe)
- Modifier paramètres système (Device Guard, AUTH_SECRET, RLS)
- Voir tous les modules y compris RH, investisseurs, finance
- Forcer déconnexion de tous les comptes (revoke-sessions)
- Modifier les autres super_admin/admin

---

### 2. 👑 super_admin

**Cible** : Co-fondateurs, direction générale

| Aspect | Détail |
|--------|--------|
| **Interface** | Back-office complet |
| **Accès** | Tous modules sauf paramètres système critiques |
| **Permissions** | `canViewDatabase`, `canViewExternal`, `canCreateCommandeBO` activés par défaut |

**Droits** :
- ✅ Tous modules opérationnels
- ✅ Création/modification utilisateurs (sauf super_super_admin)
- ✅ Voir finance, RH, investisseurs
- ❌ Pas de wipe complet
- ❌ Pas de modification paramètres système

---

### 3. 🛡️ admin

**Cible** : Administrateurs opérationnels

| Aspect | Détail |
|--------|--------|
| **Interface** | Back-office complet |
| **Accès** | Modules opérationnels |
| **Permissions** | `canViewDatabase`, `canViewExternal`, `canCreateCommandeBO` activés |

**Droits** :
- ✅ Création utilisateurs (sauf admin/super_admin)
- ✅ Supervision processus opérationnels
- ✅ Modification articles, clients, fournisseurs
- ❌ Pas accès données financières sensibles
- ❌ Pas modification paramètres système

---

### 4. 💼 resp_commercial

**Cible** : Responsable commercial / Sales Manager

**Droits** :
- ✅ Validation commandes prévendeurs (porte 0)
- ✅ Modification prix/remises (avec accord direction)
- ✅ Gestion clients (CHR, Marchand, Particulier)
- ✅ Voir caisse, récap, marges
- ✅ Affectation commerciale, objectifs équipe
- ✅ KPI commercial
- ❌ Pas accès achats ni RH

---

### 5. 👥 team_leader

**Cible** : Chef d'équipe terrain (prévendeurs/livreurs)

**Droits** :
- ✅ Voir performance équipe
- ✅ Affecter clients à un prévendeur
- ✅ Voir routes/tournées équipe
- ❌ Pas de modification prix
- ❌ Pas de finance

---

### 6. 📱 prevendeur

**Cible** : Commerciaux terrain (Jariri, etc.)

**Interface** : Mobile uniquement

**Droits** :
- ✅ Prise de commande chez client
- ✅ Saisie articles, quantités, conditions
- ✅ Visites clients (avec GPS)
- ✅ Objectifs journaliers/hebdomadaires
- ✅ Signalement non-achats
- ❌ Pas de validation finale (besoin resp_commercial)

---

### 7. 🚚 resp_logistique

**Interface** : Back-office + Mobile

**Droits** :
- ✅ Dispatch livreurs
- ✅ Création tournées (trips)
- ✅ Voir stock disponible
- ✅ Gestion retours
- ✅ Suivi GPS livreurs
- ❌ Pas de modification articles

---

### 8. 🚛 livreur

**Interface** : Mobile uniquement

**Droits** :
- ✅ Recevoir bons de livraison (BL)
- ✅ Confirmer livraisons
- ✅ Encaisser cash
- ✅ Saisir retours marchandise
- ✅ GPS actif (tracking)
- ✅ Rapport tournée
- ❌ Pas accès tarifs achat

---

### 9. 🏭 magasinier

**Interface** : Mobile

**Droits** :
- ✅ Voir stock entrepôt
- ✅ Réceptionner marchandise
- ✅ Saisir écarts à la réception
- ✅ Inventaire physique
- ❌ Pas de modification prix

---

### 10. 🎯 dispatcheur

**Interface** : Mobile + Back-office

**Droits** :
- ✅ Voir toutes commandes en attente
- ✅ Affecter livreurs aux tournées
- ✅ Optimiser routes
- ✅ Suivi temps réel

---

### 11. 🛒 acheteur

**Interface** : Mobile

**Droits** :
- ✅ Bons d'achat fournisseurs
- ✅ Saisir prix d'achat marché
- ✅ Voir besoins d'achat (par article)
- ✅ Sourcing fournisseurs
- ❌ Pas validation finale (besoin ctrl_achat)

---

### 12. 🔍 ctrl_achat

**Cible** : Contrôleur achat — validation des achats

**Droits** :
- ✅ Valider bons d'achat saisis par acheteurs
- ✅ Comparer prix avec marché
- ✅ Voir historique fournisseurs

---

### 13. 📦 ctrl_prep

**Cible** : Contrôleur préparation — qualité avant départ

**Droits** :
- ✅ Vérifier BP (bons de préparation)
- ✅ Valider la qualité avant chargement
- ✅ Saisir refusés/écarts

---

### 14. 💰 cash_man

**Cible** : Caissier / Cash Manager

**Permissions activées** : `canViewCash`, `canViewCommercial`

**Droits** :
- ✅ Saisie caisse (encaissements/décaissements)
- ✅ Voir commandes pour rapprochement
- ✅ Mouvements de caisse
- ❌ Pas de finance globale

---

### 15. 📊 financier

**Cible** : Directeur Financier (CFO)

**Permissions activées** : `canViewFinance`, `canViewCash`, `canViewRecap`

**Droits** :
- ✅ Tableaux de bord financiers
- ✅ Voir caisse, marges, P&L
- ✅ Récap journalier/mensuel
- ✅ Voir tous flux monétaires
- ❌ Pas de modification opérationnelle

---

### 16. 📚 comptable

**Cible** : Comptabilité externe / Contrôleur de gestion

**Permissions activées** : `canViewFinance`, `canViewCash`, `canViewRecap`, `canViewAchat`

**Droits** :
- ✅ Export comptable
- ✅ Voir factures
- ✅ Rapprochement bancaire
- ❌ Pas d'opérationnel

---

### 17. 👔 rh_manager

**Cible** : Responsable RH

**Permissions activées** : `canViewRH`, `canViewInvestisseur`

**Droits** :
- ✅ Gestion salariés
- ✅ Salaires, primes
- ✅ Productivité par employé
- ✅ Documents RH

---

### 18. 💎 investisseur

**Cible** : Actionnaires / investisseurs

**Droits** :
- ✅ Dashboard investisseur uniquement
- ✅ KPI haut niveau (CA, marges, croissance)
- ❌ Pas d'accès opérationnel
- ❌ Pas de modification

---

### 19. ✅ qualite

**Cible** : Responsable qualité (S. Abdelilah), Contrôleur qualité (Abdelali)

**Permissions activées** : `canViewStock`, `canViewAchat`

**Droits** :
- ✅ Contrôle qualité réceptions
- ✅ Voir achat + stock
- ✅ Signalements non-conformités
- ❌ Pas de modification prix

---

### 20. 🔧 it_admin

**Cible** : IT Admin (futur)

**Droits** :
- ✅ Paramètres techniques (sauf super_super_admin)
- ✅ Voir logs
- ✅ Gestion devices

---

### 21. 🔎 auditeur

**Cible** : Auditeurs externes

**Droits** :
- ✅ Lecture seule de tout
- ❌ Aucune modification

---

### 22. 🏬 chef_depot

**Interface** : Mobile + Back-office partiel

**Droits** :
- ✅ Gestion stock par dépôt
- ✅ Transferts entre dépôts
- ✅ Validation réception locale

---

### 23. 🛍️ resp_achat

**Cible** : Responsable achats / Acheteur senior

**Droits** :
- ✅ Validation bons d'achat
- ✅ Négociation fournisseurs
- ✅ Planning achats
- ✅ Voir budgets achats

---

### 24. 📞 suivi_commande

**Cible** : Suivi commande (relation client post-vente)

**Droits** :
- ✅ Voir statut commandes
- ✅ Communiquer avec clients
- ✅ Traiter réclamations
- ❌ Pas de modification commande

---

### 25. 💵 charge_recouvrement

**Cible** : Recouvrement créances

**Droits** :
- ✅ Voir impayés clients
- ✅ Plan de recouvrement
- ✅ Saisir paiements
- ✅ Communications de relance

---

### 26. 🛒 client (3 sous-types)

**Sous-types** :
- `particulier` → site web `vitafresh.vercel.app` uniquement
- `chr` → portail PortailClient sur `f-l.vercel.app`
- `marchand` → portail PortailClient sur `f-l.vercel.app`

**Création** :
1. **Auto-création** via le formulaire d'inscription du site web
2. **Manuelle** via BO Administration → Utilisateurs & Rôles
3. **Manuelle** via BO Comptes Externes (à venir)

**Droits client** :
- ✅ Voir catalogue (selon catégorie : prix CHR vs Marchand vs Particulier)
- ✅ Passer commandes
- ✅ Voir historique commandes
- ✅ Voir factures
- ✅ Suivi livraison
- ✅ Points de fidélité (si activés)
- ❌ Pas d'accès interne

---

### 27. 🚛 fournisseur

**Interface** : Portail Fournisseur (`f-l.vercel.app`)

**Création** :
1. Auto-création via formulaire site web (option "Fournisseur / Producteur")
2. Manuelle via BO

**Droits** :
- ✅ Voir bons d'achat reçus
- ✅ Voir cross-docking (propositions de préparation)
- ✅ Saisir prix journalier
- ✅ Voir historique réceptions
- ❌ Pas d'accès interne

---

## 🌐 Matrice : qui voit quoi sur le SITE WEB ?

| Type d'utilisateur | URL d'accès | Catalogue | Login |
|--------------------|-------------|-----------|-------|
| Visiteur anonyme | vitafresh.vercel.app | ✅ Lecture | ❌ |
| Client Particulier | vitafresh.vercel.app | ✅ + Prix particulier | ✅ |
| Client CHR | → Redirect f-l.vercel.app | Portail dédié | ✅ |
| Client Marchand | → Redirect f-l.vercel.app | Portail dédié | ✅ |
| Fournisseur | → Redirect f-l.vercel.app | Portail dédié | ✅ |
| Personnel interne | f-l.vercel.app | Back-office | ✅ |

---

## 🔗 Liaison ERP ↔ Supabase ↔ Boutique

### Source unique de vérité : **Supabase**

```
┌─────────────────────────────────────────────────────────────┐
│                     SUPABASE (truth)                         │
│  ┌──────────────┬───────────────┬──────────────────────┐   │
│  │  fl_articles │  fl_users     │  fl_clients          │   │
│  │  fl_commandes│  fl_commandes_│  fl_fournisseurs     │   │
│  │  fl_bons_*   │       web     │  fl_account_requests │   │
│  └──────────────┴───────────────┴──────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
        ↑↓                       ↑↓                   ↑↓
        │                         │                     │
┌───────────────┐    ┌──────────────────┐    ┌────────────────┐
│   ERP B.O.    │    │  Site Web        │    │  Portails      │
│ f-l.vercel.app│    │vitafresh.vercel  │    │ client/fourn.  │
│               │    │     .app         │    │                │
│ • localStorage│    │ • API only       │    │ • API only     │
│ • Sync auto   │    │ • Anon RLS       │    │ • JWT auth     │
│   sur action  │    │ • Cache 30s      │    │                │
└───────────────┘    └──────────────────┘    └────────────────┘
```

### Règles de liaison

1. **Création/modification** dans le BO → Push immédiat vers Supabase via `/api/sync-write`
2. **Site web** → Lecture seule via `/api/ext/catalogue` (RLS filtre `marketplaceActif=true`)
3. **Portails clients** → Lecture authentifiée via `/api/ext/mon-compte`
4. **Pas de sync auto à l'ouverture** d'un module BO (évite régressions)
5. **Boutons explicites** : 🔄 Recharger Supabase | 🌐 Publier sur le site

---

## 🛡️ Sécurité

### Authentification

- **Personnel interne** : Login local (localStorage) + Device Guard (cookie HMAC)
- **Externes (clients/fournisseurs)** : Login phone+password → API `/api/ext/auth` → JWT signé HMAC
- **Sessions** : Durée 24h, révocables globalement par admin

### RLS Supabase

- **service_role** : utilisé par les API routes (bypass total)
- **anon** : lecture catalogue (filter `marketplaceActif=true`) + insert commandes web + insert demandes accès
- **authenticated** : non utilisé (auth gérée par notre API)

### Device Guard

Bloque l'accès au BO sur un appareil non autorisé sauf si :
- Cookie HMAC valide (super_super_admin a posé son cookie)
- Device autorisé dans `fl_site_access`

---

## 📌 Cas d'usage type

### Création d'un nouveau prévendeur

```
1. Login super_admin → BO → Administration → Utilisateurs & Rôles
2. + Ajouter → role: prevendeur, accessType: mobile
3. Saisir nom, téléphone, mot de passe mobile
4. Affecter secteur (Nord/Sud/Est/Ouest)
5. Objectifs CA & clients à visiter
6. Save → push immédiat vers Supabase
7. Le prévendeur peut se connecter via mobile avec son téléphone
```

### Activation d'un article sur le site

```
1. Login admin → BO → Marketplace & Catalogue Web
2. Clic 🔄 Recharger Supabase (sync local depuis Supabase)
3. Ouvrir article (ex: Bananes)
4. Toggle "Publier sur le site web" → ON
5. Cocher préparations dispo (Épluché, Lavé)
6. Save
7. ✅ Auto-push vers Supabase
8. Site web vitafresh.vercel.app → article visible 30s plus tard
```

### Création compte CHR par admin

```
1. Login admin → BO → Comptes Externes (à venir)
2. + Créer compte CHR
3. Saisir : nom resto, téléphone, ICE, ville
4. Auto-génération mot de passe
5. ✅ Push fl_users + fl_clients vers Supabase
6. SMS/Email envoyé au CHR avec ses identifiants
7. CHR se connecte sur f-l.vercel.app → PortailClient
```
