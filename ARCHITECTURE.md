# Architecture FreshLink - Distribution & Supply Chain

## 🏗️ Vue d'ensemble du système

```
┌─────────────────────────────────────────────────────────────┐
│                  vita-fresh.NETLIFY.APP                   │
│              (Site e-commerce & Client Portal)              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │ E-Commerce Shop  │  │ Client Dashboard │  │ B2B Portal │ │
│  │ (Devis/Commandes)│  │ (Statuts/Suivis) │  │ (Contrats) │ │
│  └────────┬─────────┘  └────────┬─────────┘  └─────┬──────┘ │
│           │                     │                   │        │
└───────────┼─────────────────────┼───────────────────┼────────┘
            │                     │                   │
            └─────────────────────┼───────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   API REST / Real-time    │
                    │   WebSocket (Supabase)    │
                    └─────────────┬─────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
   ┌────▼────────────┐    ┌──────▼──────────┐   ┌─────────▼───┐
   │ SUPABASE        │    │ MOBILE APP      │   │ BACKEND API │
   │                 │    │                 │   │             │
   │ ├─ Auth         │    │ ├─ Validation   │   │ ├─ Rôles    │
   │ ├─ Users        │    │ ├─ Impression  │   │ ├─ Qualité  │
   │ ├─ Products     │    │ ├─ BL Offline  │   │ ├─ Docs     │
   │ ├─ Orders       │    │ └─ Sync        │   │ └─ Workflow │
   │ ├─ Quality      │    └─────────────────┘   └─────────────┘
   │ ├─ Documents    │
   │ └─ Roles        │
   └────────────────┘
```

## 📊 Structure modulaire

### 1. **Module Authentification & Rôles** (`lib/roles/`)
### 2. **Module Qualité** (`lib/quality/`)
### 3. **Module Documentaire** (`lib/documents/`)
### 4. **Module E-commerce** (`lib/ecommerce/`)
### 5. **Module Synchronisation** (`lib/sync/`)
### 6. **Mobile API** (`app/api/mobile/`)

---

## 🔐 Système de rôles détaillé

### Hiérarchie des rôles avec activation automatique

```
┌─────────────────────────────────────────────┐
│ SUPER_ADMIN (Niveau 0)                      │
│ └─ Gère tout, peut activer/désactiver tous  │
│    les rôles                                │
├─────────────────────────────────────────────┤
│ ADMIN_SALES (Niveau 1)                      │
│ ├─ Gère commerciaux & devis                 │
│ └─ Désactive automatiquement: COMMERCIAL   │
├─────────────────────────────────────────────┤
│ ADMIN_OPS (Niveau 1)                        │
│ ├─ Gère opérations & BL                     │
│ └─ Désactive automatiquement: LOGISTIQUE   │
├─────────────────────────────────────────────┤
│ ADMIN_QUALITY (Niveau 1)                    │
│ ├─ Gère qualité & contrôle                  │
│ └─ Désactive automatiquement: QA           │
├─────────────────────────────────────────────┤
│ COMMERCIAL (Niveau 2)                       │
│ ├─ Crée devis/commandes                     │
│ └─ Peut être activé par ADMIN_SALES        │
├─────────────────────────────────────────────┤
│ LOGISTIQUE (Niveau 2)                       │
│ ├─ Valide BL & mouvements                   │
│ └─ Peut être activé par ADMIN_OPS          │
├─────────────────────────────────────────────┤
│ QA (Niveau 2)                               │
│ ├─ Contrôle qualité & articles              │
│ └─ Peut être activé par ADMIN_QUALITY      │
├─────────────────────────────────────────────┤
│ CLIENT_B2B (Niveau 3)                       │
│ ├─ Accès portail clients (CHR/HORECA)      │
│ └─ Lecture commandes & devis                │
└─────────────────────────────────────────────┘
```

### Règles d'activation automatique

1. **Une seule branche active par niveau**
   - Si vous activez ADMIN_SALES → COMMERCIAL est désactivé
   - Si vous activez COMMERCIAL → ADMIN_SALES reste actif

2. **Propagation au niveau inférieur**
   - Activation ADMIN_SALES → Peut activer COMMERCIAL
   - Désactivation ADMIN_SALES → COMMERCIAL devient inactif automatiquement

3. **Permissions inclusives**
   - Chaque niveau hérite des permissions des niveaux inférieurs
   - ADMIN > USER, ADMIN peut faire tout ce que USER fait + plus

---

## 📱 Processus Commande (CHR/HORECA)

```
┌─────────────────┐
│  CLIENT BROWSE  │ (Site e-commerce)
└────────┬────────┘
         │ Sélectionne articles + ajoute au panier
         ▼
┌─────────────────────────────┐
│ DEMANDE DE DEVIS (Optional) │ (Demande détaillée)
└────────┬────────────────────┘
         │ Soumission du devis
         ▼
┌──────────────────────────────────────┐
│ COMMERCIAL (notification + validation)│
└────────┬───────────────────────────────┘
         │ Crée devis + contrat CHR/HORECA
         ▼
┌──────────────────────────────┐
│ CLIENT VALIDE DEVIS/CONTRAT  │ (Signature électronique)
└────────┬─────────────────────┘
         │ Acceptation → Devient COMMANDE
         ▼
┌─────────────────────────────────────┐
│ COMMANDE CRÉÉE                      │
│ - Notification LOGISTIQUE           │
│ - Création BL automatique           │
└────────┬────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ LOGISTIQUE VALIDE BL       │ (Mobile)
│ - QR code scan             │
│ - Signature                │
│ - Photo articles           │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│ QA VALIDE QUALITÉ          │ (Mobile)
│ - Critères qualité         │
│ - Photos avant/après       │
│ - Conformité               │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│ EXPÉDITION                 │ (Statut temps réel)
└────────┬───────────────────┘
         │ Notification client
         ▼
┌────────────────────────────┐
│ LIVRAISON CONFIRMÉE        │
│ Feedback client optionnel  │
└────────────────────────────┘
```

---

## 📋 Module Qualité

### Critères par catégorie d'articles

```json
{
  "FRUITS": {
    "criterias": [
      { "name": "Couleur", "type": "selection", "options": ["Non mûr", "Mûr", "Trop mûr"] },
      { "name": "Fermeté", "type": "numeric", "min": 1, "max": 10 },
      { "name": "Traces de moisissure", "type": "boolean", "critical": true },
      { "name": "Odeur", "type": "selection", "options": ["Fraîche", "Légèrement altérée", "Mauvaise"] }
    ]
  },
  "LEGUMES": {
    "criterias": [
      { "name": "Fraîcheur", "type": "numeric", "min": 1, "max": 10 },
      { "name": "Absence de parasites", "type": "boolean", "critical": true },
      { "name": "État de conservation", "type": "selection", "options": ["Parfait", "Bon", "Acceptable"] }
    ]
  },
  "PRODUITS_LAITIERS": {
    "criterias": [
      { "name": "Température", "type": "numeric", "min": 2, "max": 8, "unit": "°C", "critical": true },
      { "name": "Emballage intact", "type": "boolean", "critical": true },
      { "name": "Date limite dépassée", "type": "boolean", "critical": true }
    ]
  }
}
```

---

## 📄 Module Documents

### Types de documents générés

1. **DEVIS** (PDF)
   - Devis client avec prix unitaires
   - Conditions de paiement
   - Délais de livraison
   - QR code pour suivi

2. **CONTRAT CHR/HORECA** (PDF + eSignature)
   - Conditions générales de vente
   - Clauses de paiement
   - Engagement qualité
   - Signature électronique client + vendeur

3. **BON DE LIVRAISON** (PDF + Mobile)
   - Détail articles
   - QR code de validation
   - Signature client
   - Photos avant/après

4. **RAPPORT DE QUALITÉ** (PDF)
   - Résultats contrôle qualité
   - Photos + critères
   - Non-conformités détectées

---

## 🔄 Synchronisation Temps Réel

### WebSocket Events (Supabase Realtime)

```typescript
// Événements bidirectionnels
- "orders:new" → Notification à COMMERCIAL
- "orders:validated" → Notification à LOGISTIQUE
- "bl:created" → Notification à QA
- "quality:approved" → Notification LOGISTIQUE (prêt expédition)
- "product:unavailable" → Mise à jour client
- "price:updated" → Mise à jour tous clients
```

---

## 📱 Capacités Mobile

### Application Mobile (React Native / Flutter)

✅ **Validation de BL**
- Scan QR code
- Signature digital
- Photos articles
- Horodatage

✅ **Contrôle Qualité**
- Formulaires critères
- Caméra intégrée
- Horodatage automatique
- Enregistrement offline

✅ **Impression**
- Impression thermique
- Impression réseau
- Export PDF
- Format mobile optimisé

---

## 🔗 Intégration Supabase

### Tables requises

```
auth_users
├─ id (UUID)
├─ email
├─ role_id (FK)
└─ metadata (JSON)

roles
├─ id (UUID)
├─ name
├─ level
├─ parent_role_id (FK)
├─ active
└─ permissions (JSONB)

products
├─ id (UUID)
├─ name
├─ category
├─ quality_criteria_id (FK)
├─ price
├─ stock
├─ status (ACTIVE/INACTIVE)
└─ metadata (JSON)

orders
├─ id (UUID)
├─ client_id (FK)
├─ commercial_id (FK)
├─ status (DRAFT/QUOTED/CONFIRMED/...)
├─ items (JSONB)
├─ total_price
└─ created_at

quality_checks
├─ id (UUID)
├─ order_id (FK)
├─ product_id (FK)
├─ criteria_results (JSONB)
├─ approved
├─ photos (TEXT[])
└─ checked_at

documents
├─ id (UUID)
├─ order_id (FK)
├─ type (QUOTE/CONTRACT/BL/REPORT)
├─ file_url
├─ signature (JSON)
└─ created_at

activity_logs
├─ id (UUID)
├─ user_id (FK)
├─ action
├─ resource
├─ changes (JSONB)
└─ timestamp
```

---

## 🚀 Prochaines étapes

1. ✅ Créer système de rôles avec activation hiérarchique
2. ✅ Implémenter module qualité
3. ✅ Générer documents (Devis/Contrats)
4. ✅ Configurer synchronisation Supabase
5. ✅ API Mobile pour BL/Qualité
6. ✅ Front-end Netlify e-commerce
7. ✅ Tests et déploiement
