# ✉️ Configuration EmailJS — Vita Fresh (SMTP Privateemail)

EmailJS envoie les emails depuis le navigateur via ton serveur SMTP Privateemail (`contact@vita-core.org`). Pas de backend nécessaire.

---

## ✅ Ce qui est DÉJÀ fait

| Élément | Valeur | Statut |
|---|---|---|
| SDK EmailJS chargé dans `<head>` | `@emailjs/browser@4` | ✅ |
| Service ID dans le code | **`service_nzwxsop`** | ✅ câblé |
| Fonctions `emailCommande()`, `emailBienvenue()` | dans `index.html` | ✅ |
| Câblage commande + signup | `onSuccess` + `signupForm` | ✅ |
| Admin email (notifs équipe) | `sales@vita-core.org` | ✅ |

## ⚠️ Ce qu'il te reste à faire (5 minutes)

3 valeurs à récupérer dans le dashboard EmailJS :
1. Ta **Public Key**
2. Créer **3 templates** (textes prêts à copier ci-dessous)

---

## 📋 Ta config SMTP enregistrée

Tu as déjà configuré ce service dans EmailJS :

```
Type            : SMTP server (personal service)
Name            : Fresh Link vita
Service ID      : service_nzwxsop
Host            : mail.privateemail.com
Port            : 465 (SSL)
User            : contact@vita-core.org
App Password    : [stocké côté EmailJS, jamais exposé dans le code]
```

✅ **Validation** : EmailJS dit que la vérif test n'est pas dispo car User="email" → c'est OK. **Décoche** « Send test email... » et clique **Create Service** comme indiqué.

> 🛡️ **Sécurité** : ton App Password reste côté EmailJS (chiffré). Le code public ne contient QUE le Service ID (qui n'est pas un secret).

---

## 🔑 Étape 1 — Récupérer ta Public Key

1. Dashboard EmailJS → **Account** (menu gauche) → **General**
2. Section « API Keys » → copie la **Public Key** (15-20 caractères, ex : `aBcDeFgH123456_X`)

---

## 🎨 Étape 2 — Créer 3 templates

Dashboard → **Email Templates** → **Create New Template** (3 fois).

> **Pour chaque template** : après création, copie le **Template ID** (format `template_xxxxxxx`).

---

### 📦 Template 1 — Confirmation commande au CLIENT

**Template Name** : `Vita Fresh - Confirmation Commande`
**To Email** : `{{to_email}}`
**From Name** : `Vita Fresh`
**Reply To** : `contact@vita-core.org`
**Subject** : `✅ Votre commande Vita Fresh — {{order_ref}}`

**Content (HTML)** :
```html
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f6faf7;padding:30px">
  <div style="background:linear-gradient(135deg,#1a4f2a,#2d7a46);padding:24px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:24px">🌿 Vita Fresh</h1>
    <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:13px">by Vita Core · Casablanca</p>
  </div>
  <div style="background:#fff;padding:30px;border-radius:0 0 12px 12px">
    <h2 style="color:#0b3d1a;margin-top:0">Bonjour {{to_name}},</h2>
    <p style="color:#374151;line-height:1.6">Merci pour votre commande chez {{company}} ! 🍃<br>
    Notre équipe vous contactera très bientôt pour confirmer la livraison.</p>

    <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:14px 18px;margin:20px 0;border-radius:6px">
      <p style="margin:0;color:#166534"><strong>📦 Référence :</strong> {{order_ref}}</p>
      <p style="margin:6px 0 0;color:#166534"><strong>📅 Date :</strong> {{order_date}}</p>
    </div>

    <h3 style="color:#0b3d1a">🛒 Votre commande</h3>
    <pre style="background:#f9fafb;padding:14px;border-radius:8px;white-space:pre-wrap;font-family:inherit;color:#374151;font-size:13px">{{order_items}}</pre>

    <table style="width:100%;border-top:2px solid #e5e7eb;margin-top:14px;padding-top:14px">
      <tr><td style="padding:6px 0;color:#6b7280">💰 Total</td><td style="text-align:right;font-weight:bold;color:#0b3d1a;font-size:18px">{{order_total}}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">🚚 Livraison</td><td style="text-align:right;color:#374151">{{delivery}}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">💳 Paiement</td><td style="text-align:right;color:#374151">{{payment}}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">📍 Adresse</td><td style="text-align:right;color:#374151">{{address}}</td></tr>
    </table>

    <div style="background:#1a4f2a;color:#fff;padding:18px;border-radius:10px;margin-top:24px;text-align:center">
      <p style="margin:0 0 8px;font-size:13px">📞 Besoin d'aide ?</p>
      <p style="margin:0;font-size:18px;font-weight:bold">{{phone}}</p>
    </div>

    <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:24px">© {{company}} — Distribution Fruits & Légumes Frais</p>
  </div>
</div>
```

---

### 🔔 Template 2 — Notification commande à l'ÉQUIPE

**Template Name** : `Vita Fresh - Notif Équipe Commande`
**To Email** : `{{to_email}}`
**From Name** : `Vita Fresh - Site Web`
**Reply To** : `{{client_email}}`
**Subject** : `🔔 Nouvelle commande {{order_ref}} — {{client_name}}`

**Content (HTML)** :
```html
<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#fff">
  <div style="background:#dc2626;color:#fff;padding:14px 20px;border-radius:8px;margin-bottom:20px">
    <h2 style="margin:0">🔔 NOUVELLE COMMANDE SITE WEB</h2>
    <p style="margin:4px 0 0;opacity:.9">Réf : <strong>{{order_ref}}</strong></p>
  </div>

  <h3>👤 Client</h3>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:6px;background:#f9fafb"><strong>Nom</strong></td><td style="padding:6px">{{client_name}}</td></tr>
    <tr><td style="padding:6px;background:#f9fafb"><strong>📱 Téléphone</strong></td><td style="padding:6px"><a href="tel:{{client_phone}}">{{client_phone}}</a></td></tr>
    <tr><td style="padding:6px;background:#f9fafb"><strong>✉️ Email</strong></td><td style="padding:6px">{{client_email}}</td></tr>
    <tr><td style="padding:6px;background:#f9fafb"><strong>📍 Adresse</strong></td><td style="padding:6px">{{address}}</td></tr>
  </table>

  <h3>🛒 Produits commandés</h3>
  <pre style="background:#f3f4f6;padding:14px;border-radius:6px;white-space:pre-wrap;font-family:inherit;font-size:13px">{{order_items}}</pre>

  <table style="width:100%;border-collapse:collapse;margin-top:16px">
    <tr><td style="padding:8px;background:#fef3c7"><strong>💰 Total</strong></td><td style="padding:8px;text-align:right;font-size:18px;font-weight:bold">{{order_total}}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb"><strong>🚚 Livraison</strong></td><td style="padding:8px;text-align:right">{{delivery}}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb"><strong>💳 Paiement</strong></td><td style="padding:8px;text-align:right">{{payment}}</td></tr>
    <tr><td style="padding:8px;background:#fee2e2"><strong>⏳ Sur commande</strong></td><td style="padding:8px;text-align:right">{{sur_commande}}</td></tr>
  </table>

  {{#notes}}
  <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;margin-top:16px;border-radius:6px">
    <strong>📝 Notes client :</strong> {{notes}}
  </div>
  {{/notes}}

  <p style="text-align:center;margin-top:24px;color:#6b7280;font-size:12px">
    Email automatique — Site Vita Fresh
  </p>
</div>
```

---

### 🎉 Template 3 — Bienvenue nouveau compte

**Template Name** : `Vita Fresh - Bienvenue Nouveau Compte`
**To Email** : `{{to_email}}`
**From Name** : `Vita Fresh`
**Reply To** : `contact@vita-core.org`
**Subject** : `🌿 Bienvenue chez Vita Fresh — vos identifiants`

**Content (HTML)** :
```html
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f6faf7;padding:30px">
  <div style="background:linear-gradient(135deg,#1a4f2a,#2d7a46);padding:30px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:28px">🌿 مرحبا بيك</h1>
    <p style="color:#fff;margin:8px 0 0;font-size:20px">Bienvenue chez Vita Fresh !</p>
    <p style="color:rgba(255,255,255,.7);margin:4px 0 0;font-size:11px;letter-spacing:1px">BY VITA CORE</p>
  </div>
  <div style="background:#fff;padding:30px;border-radius:0 0 12px 12px">
    <h2 style="color:#0b3d1a;margin-top:0">Bonjour {{to_name}} 👋</h2>
    <p style="color:#374151;line-height:1.6">Votre compte <strong>{{account_type}}</strong> a été créé avec succès ! 🎉</p>

    <div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;padding:24px;margin:24px 0;text-align:center">
      <p style="margin:0 0 14px;color:#166534;font-size:13px;text-transform:uppercase;letter-spacing:1px"><strong>🔐 Vos identifiants de connexion</strong></p>
      <p style="margin:0 0 6px;color:#374151">📱 Numéro</p>
      <p style="margin:0 0 14px;font-size:20px;font-weight:bold;color:#0b3d1a;font-family:monospace">{{login_phone}}</p>
      <p style="margin:0 0 6px;color:#374151">🔑 Mot de passe</p>
      <p style="margin:0;font-size:22px;font-weight:bold;color:#0b3d1a;font-family:monospace;letter-spacing:3px">{{login_password}}</p>
    </div>

    <div style="text-align:center;margin:24px 0">
      <a href="{{site_url}}" style="background:linear-gradient(135deg,#1a4f2a,#2d7a46);color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block">🔐 Se connecter maintenant</a>
    </div>

    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;border-radius:6px;font-size:13px;color:#92400e">
      ⚠️ <strong>Notez ces identifiants en lieu sûr</strong>. Vous pouvez changer votre mot de passe dans votre espace.
    </div>

    <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:24px">© {{company}} — Distribution Fruits & Légumes Frais</p>
  </div>
</div>
```

---

## ⚙️ Étape 3 — Remplir les 4 valeurs dans le code

Ouvre `public/site-netlify/index.html`, trouve le bloc `EMAILJS:` (vers la ligne 805) et **remplace uniquement les 4 valeurs `VOTRE_...`** :

```js
EMAILJS: {
  PUBLIC_KEY:    "VOTRE_PUBLIC_KEY",       // ← copier depuis Account > General
  SERVICE_ID:    "service_nzwxsop",        // ✅ déjà câblé
  TPL_COMMANDE:  "VOTRE_TEMPLATE_COMMANDE",// ← Template 1 ID
  TPL_ADMIN:     "VOTRE_TEMPLATE_ADMIN",   // ← Template 2 ID
  TPL_COMPTE:    "VOTRE_TEMPLATE_COMPTE",  // ← Template 3 ID
  ADMIN_EMAIL:   "sales@vita-core.org",    // ✅ destinataire équipe
},
```

> Tu peux me donner les 4 valeurs (PUBLIC_KEY + 3 TPL_*) et je les mets en place + redéploie.

---

## 🛡️ Étape 4 — Sécurité (recommandée)

Dans EmailJS → **Account** → **Security** :

1. **Allowed origins** → ajouter :
   - `https://vitafresh.vercel.app`
   - `https://vita-core.org` (futur domaine custom)

   Cela empêche d'autres sites d'utiliser ton quota.

2. **Rate limit** : laisser par défaut (1 email / 10s par IP).

---

## ✅ Étape 5 — Test

1. Ouvre `vitafresh.vercel.app`
2. Passe une commande test avec **ton email perso**
3. Tu dois recevoir :
   - ✉️ Confirmation sur ton email perso
   - 🔔 Notif sur `sales@vita-core.org`
4. Crée un compte test → tu reçois l'email de bienvenue
5. Si rien : ouvre la console (F12), tu verras `console.warn EmailJS send error: ...`

---

## 📊 Variables disponibles par template

| Template | Variables |
|----------|-----------|
| **TPL_COMMANDE** (client) | `to_email`, `to_name`, `order_ref`, `order_total`, `order_items`, `order_date`, `delivery`, `payment`, `address`, `company`, `phone` |
| **TPL_ADMIN** (équipe) | `to_email`, `order_ref`, `client_name`, `client_phone`, `client_email`, `order_total`, `order_items`, `address`, `delivery`, `payment`, `notes`, `sur_commande` |
| **TPL_COMPTE** (bienvenue) | `to_email`, `to_name`, `login_phone`, `login_password`, `account_type`, `company`, `site_url` |

---

## 💡 Bon à savoir

- **EmailJS est gratuit** jusqu'à 200 emails/mois. Au-delà : ~7$/mois pour 1000.
- Le mot de passe SMTP `Medghaly@22` est stocké côté EmailJS (chiffré), **jamais dans le code public** — c'est sécurisé.
- EmailJS fonctionne **en plus** de WhatsApp. Les deux sont envoyés à chaque commande.
- Si EmailJS échoue (quota dépassé, mauvaise config) → silencieux, WhatsApp continue de marcher. Le client n'est jamais bloqué.
