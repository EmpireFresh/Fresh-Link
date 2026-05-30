# ✉️ Configuration EmailJS — Vita Fresh

EmailJS permet d'envoyer des emails **directement depuis le site** (navigateur), sans backend. Gratuit jusqu'à 200 emails/mois.

---

## 🎯 Ce qui est déjà préparé dans le code

Le site (`public/site-netlify/index.html`) contient déjà :
- ✅ Le SDK EmailJS chargé (`<script src="...@emailjs/browser@4...">`)
- ✅ Un bloc de config `CONFIG.EMAILJS` (à remplir)
- ✅ Les fonctions : `initEmailJS()`, `sendEmailJS()`, `emailCommande()`, `emailBienvenue()`
- ✅ Câblage automatique :
  - Confirmation de **commande** envoyée au client + notification à l'équipe
  - Email de **bienvenue** avec identifiants à la création de compte

**Il ne reste qu'à créer le compte EmailJS, les templates, et remplir 6 valeurs.**

---

## 📝 Étape 1 — Créer un compte EmailJS

1. Va sur **https://www.emailjs.com** → **Sign Up** (gratuit)
2. Confirme ton email

---

## 📧 Étape 2 — Connecter ton service email

1. Dashboard → **Email Services** → **Add New Service**
2. Choisis ton fournisseur :
   - **Gmail** (le plus simple) → connecte `contact@vita-core.org` ou un Gmail
   - Ou **SMTP** custom si tu as un email pro
3. Note le **Service ID** (ex: `service_a1b2c3d`)

---

## 🎨 Étape 3 — Créer les 3 templates

Dashboard → **Email Templates** → **Create New Template** (×3).

### Template 1 — Confirmation commande (client)

**Template ID à noter** → `TPL_COMMANDE`

**To Email** : `{{to_email}}`
**Subject** : `✅ Votre commande Vita Fresh — {{order_ref}}`

**Content** :
```
Bonjour {{to_name}},

Merci pour votre commande chez {{company}} ! 🍃

📦 Référence : {{order_ref}}
📅 Date : {{order_date}}

🛒 Votre commande :
{{order_items}}

💰 Total : {{order_total}}
🚚 Livraison : {{delivery}}
💳 Paiement : {{payment}}
📍 Adresse : {{address}}

Notre équipe vous contactera pour confirmer la livraison.

📞 {{phone}}
{{company}}
```

### Template 2 — Notification équipe (admin)

**Template ID à noter** → `TPL_ADMIN`

**To Email** : `{{to_email}}`
**Subject** : `🔔 Nouvelle commande {{order_ref}} — {{client_name}}`

**Content** :
```
🔔 NOUVELLE COMMANDE SITE WEB

Réf : {{order_ref}}
Client : {{client_name}}
Téléphone : {{client_phone}}
Email : {{client_email}}

🛒 Produits :
{{order_items}}

💰 Total : {{order_total}}
📍 Adresse : {{address}}
🚚 Livraison : {{delivery}}
💳 Paiement : {{payment}}
📝 Notes : {{notes}}
⏳ Articles sur commande : {{sur_commande}}
```

### Template 3 — Bienvenue nouveau compte

**Template ID à noter** → `TPL_COMPTE`

**To Email** : `{{to_email}}`
**Subject** : `🌿 Bienvenue chez Vita Fresh — vos identifiants`

**Content** :
```
Bonjour {{to_name}},

Votre compte {{account_type}} a été créé avec succès ! 🎉

Vos identifiants de connexion :
📱 Numéro : {{login_phone}}
🔑 Mot de passe : {{login_password}}

Connectez-vous ici : {{site_url}}

À bientôt,
{{company}}
```

---

## 🔑 Étape 4 — Récupérer la Public Key

Dashboard → **Account** → **General** → copie la **Public Key** (ex: `aBcDeFgH123456`)

---

## ⚙️ Étape 5 — Remplir la config dans le code

Ouvre `public/site-netlify/index.html`, trouve le bloc `EMAILJS:` (vers la ligne 805) et remplace :

```js
EMAILJS: {
  PUBLIC_KEY:    "aBcDeFgH123456",        // ← ta Public Key
  SERVICE_ID:    "service_a1b2c3d",       // ← ton Service ID
  TPL_COMMANDE:  "template_xxxxxxx",      // ← Template 1
  TPL_ADMIN:     "template_yyyyyyy",      // ← Template 2
  TPL_COMPTE:    "template_zzzzzzz",      // ← Template 3
  ADMIN_EMAIL:   "sales@vita-core.org",   // destinataire des notifs équipe
},
```

---

## 🚀 Étape 6 — Redéployer le site

Le site `vitafresh.vercel.app` est un déploiement statique manuel. Après modification :

```bash
# (procédure habituelle — voir mémoire vitafresh-deploy)
# Copier index.html → temp folder → vercel deploy → re-alias
```

Ou demande à Claude : « redéploie le site avec la config EmailJS ».

---

## ✅ Étape 7 — Tester

1. Va sur `vitafresh.vercel.app`
2. Passe une commande test avec **ton email** dans le champ email
3. Tu dois recevoir :
   - L'email de confirmation (sur l'email de la commande)
   - L'email de notification (sur `sales@vita-core.org`)
4. Crée un compte test → tu reçois l'email de bienvenue

**Debug** : ouvre la console (F12). Si EmailJS échoue, un `console.warn` apparaît. Si la config n'est pas remplie, les envois sont silencieusement ignorés (le site continue de marcher avec WhatsApp).

---

## 🛡️ Sécurité

- La **Public Key** EmailJS est conçue pour être exposée côté client (c'est public, pas un secret).
- Pour éviter le spam, active dans EmailJS → **Account → Security** :
  - ✅ **Allowed origins** : ajoute `https://vitafresh.vercel.app` et `https://vita-core.org`
  - Cela empêche d'autres sites d'utiliser tes quotas.

---

## 📊 Variables disponibles par template

| Template | Variables |
|----------|-----------|
| **TPL_COMMANDE** | `to_email, to_name, order_ref, order_total, order_items, order_date, delivery, payment, address, company, phone` |
| **TPL_ADMIN** | `to_email, order_ref, client_name, client_phone, client_email, order_total, order_items, address, delivery, payment, notes, sur_commande` |
| **TPL_COMPTE** | `to_email, to_name, login_phone, login_password, account_type, company, site_url` |

---

## 💡 Notes

- EmailJS fonctionne **en plus** de WhatsApp (les deux sont envoyés). Tu peux désactiver l'un ou l'autre.
- Si tu préfères un backend (Resend), l'API `/api/send-email` existe déjà — mais EmailJS est plus simple pour le site statique.
- Quota gratuit : 200 emails/mois. Au-delà, plans payants dès ~7$/mois (1000 emails).
