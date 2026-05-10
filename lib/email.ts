// ============================================================
// EmailJS Integration — FreshLink Pro
// Uses EmailJS browser SDK loaded dynamically (no npm install needed)
// Configure via Paramètres → EmailJS dans le back-office.
//
// Template EmailJS requis avec les variables :
//   {{to_email}}  {{subject}}  {{message}}
// ============================================================

// --------------- Config storage ---------------

interface EmailJSConfig {
  serviceId:  string
  templateId: string
  publicKey:  string
}

const LS_KEY = "fl_emailjs_config"

function getEmailJSConfig(): EmailJSConfig {
  if (typeof window === "undefined") {
    return { serviceId: "", templateId: "", publicKey: "" }
  }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<EmailJSConfig>
      return {
        serviceId:  p.serviceId  ?? "",
        templateId: p.templateId ?? "",
        publicKey:  p.publicKey  ?? "",
      }
    }
  } catch { /* ignore */ }
  return { serviceId: "", templateId: "", publicKey: "" }
}

export function saveEmailJSConfig(cfg: EmailJSConfig): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg))
  }
}

export function getEmailJSConfigPublic(): EmailJSConfig {
  return getEmailJSConfig()
}

export function isEmailJSConfigured(): boolean {
  const cfg = getEmailJSConfig()
  return !!(cfg.serviceId && cfg.templateId && cfg.publicKey)
}

// --------------- Core sender ---------------
// Uses EmailJS REST API v1 with the publicKey as Bearer token.
// Template must have variables: {{to_email}}, {{subject}}, {{message}}

export interface EmailPayload {
  to_email: string
  subject:  string
  body:     string
}

export interface SendResult {
  ok:     boolean
  error?: string
  status?: number
}

export async function sendEmail(payload: EmailPayload): Promise<SendResult> {
  const cfg = getEmailJSConfig()

  if (!cfg.publicKey || !cfg.serviceId || !cfg.templateId) {
    return {
      ok: false,
      error: "EmailJS non configuré. Allez dans Paramètres → EmailJS (SMTP) pour saisir Service ID, Template ID et Public Key.",
    }
  }

  if (!payload.to_email || !payload.to_email.includes("@")) {
    return { ok: false, error: "Adresse email destinataire invalide." }
  }

  try {
    // EmailJS REST API — publicKey goes in the Authorization header
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Some templates also need this — include both approaches
        "origin": typeof window !== "undefined" ? window.location.origin : "https://localhost",
      },
      body: JSON.stringify({
        service_id:  cfg.serviceId,
        template_id: cfg.templateId,
        user_id:     cfg.publicKey,       // publicKey = user_id in v3 API
        accessToken: cfg.publicKey,       // required in v4+
        template_params: {
          to_email: payload.to_email,
          subject:  payload.subject,
          message:  payload.body,
          // aliases for different template variable naming conventions
          to:       payload.to_email,
          email:    payload.to_email,
          titre:    payload.subject,
          contenu:  payload.body,
          corps:    payload.body,
        },
      }),
    })

    if (res.ok) {
      return { ok: true }
    }

    // EmailJS returns plain text on error
    const text = await res.text().catch(() => "")
    return {
      ok: false,
      status: res.status,
      error: `EmailJS erreur ${res.status}: ${text || res.statusText}`,
    }
  } catch (err) {
    return {
      ok: false,
      error: `Erreur réseau: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// Send to multiple recipients one by one, collecting results
export async function sendEmailMulti(
  to_emails: string[],
  subject: string,
  body: string
): Promise<{ sent: string[]; failed: Array<{ email: string; error: string }> }> {
  const sent: string[] = []
  const failed: Array<{ email: string; error: string }> = []

  for (const email of to_emails) {
    const result = await sendEmail({ to_email: email, subject, body })
    if (result.ok) {
      sent.push(email)
    } else {
      failed.push({ email, error: result.error ?? "Erreur inconnue" })
    }
    // Small delay between sends to respect EmailJS rate limits
    await new Promise(r => setTimeout(r, 400))
  }

  return { sent, failed }
}

// --------------- Test de connexion ---------------

export async function testEmailJSConnection(): Promise<SendResult> {
  const cfg = getEmailJSConfig()
  if (!cfg.publicKey || !cfg.serviceId || !cfg.templateId) {
    return { ok: false, error: "Identifiants manquants." }
  }
  return sendEmail({
    to_email: "test@freshlink.test",
    subject:  "Test connexion EmailJS — FreshLink Pro",
    body:     "Ce message est un test automatique pour vérifier la configuration EmailJS.",
  })
}

// --------------- Email body builders ---------------

function fmt(n: number): string {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function dateStr(): string {
  return new Date().toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" })
}

// ---- Récap journalier ----

export function buildRecapJournalier(data: {
  date: string
  totalAchats: number
  totalCommandes: number
  totalLivraisons: number
  totalRetours: number
  totalCash: number
  marge: number
  nbBonsAchat?: number
  nbCommandes?: number
  nbLivraisons?: number
  nbRetours?: number
}): string {
  const line = "─".repeat(48)
  return [
    line,
    "     RÉCAP JOURNALIER — FreshLink Pro",
    `     Date : ${data.date}`,
    line,
    "",
    `  Achats du jour        : ${fmt(data.totalAchats)} DH  (${data.nbBonsAchat ?? 0} bons)`,
    `  Commandes validées    : ${fmt(data.totalCommandes)} DH  (${data.nbCommandes ?? 0} commandes)`,
    `  Livraisons effectuées : ${fmt(data.totalLivraisons)} DH  (${data.nbLivraisons ?? 0} BLs)`,
    `  Retours               : ${fmt(data.totalRetours)} DH  (${data.nbRetours ?? 0} retours)`,
    `  Encaissements (Cash)  : ${fmt(data.totalCash)} DH`,
    "  " + "·".repeat(44),
    `  Marge brute estimée   : ${fmt(data.marge)} DH`,
    "",
    line,
    "  Rapport généré par FreshLink Pro",
    line,
  ].join("\n")
}

// ---- Bon d'achat ----

export function buildAchatEmail(bon: {
  id: string; fournisseurNom: string; date: string; acheteurNom: string
  lignes: { articleNom: string; quantite: number; prixAchat: number }[]
}): string {
  const total = bon.lignes.reduce((s, l) => s + l.quantite * l.prixAchat, 0)
  const line = "─".repeat(48)
  return [
    line,
    `  BON D'ACHAT #${bon.id}`,
    `  Date : ${bon.date}`,
    `  Acheteur : ${bon.acheteurNom}`,
    `  Fournisseur : ${bon.fournisseurNom}`,
    line,
    ...bon.lignes.map(l =>
      `  • ${l.articleNom.padEnd(20)} ${String(l.quantite).padStart(6)}  x  ${fmt(l.prixAchat)} DH = ${fmt(l.quantite * l.prixAchat)} DH`
    ),
    line,
    `  TOTAL : ${fmt(total)} DH`,
    line,
  ].join("\n")
}

// ---- Commande ----

export function buildCommandeEmail(cmd: {
  id: string; clientNom: string; commercialNom: string; date: string; heurelivraison: string
  lignes: { articleNom: string; quantite: number; prixVente: number }[]
}): string {
  const total = cmd.lignes.reduce((s, l) => s + l.quantite * l.prixVente, 0)
  const line = "─".repeat(48)
  return [
    line,
    `  COMMANDE #${cmd.id}`,
    `  Date : ${cmd.date}     Livraison : ${cmd.heurelivraison}`,
    `  Commercial : ${cmd.commercialNom}`,
    `  Client : ${cmd.clientNom}`,
    line,
    ...cmd.lignes.map(l =>
      `  • ${l.articleNom.padEnd(20)} ${String(l.quantite).padStart(6)}  x  ${fmt(l.prixVente)} DH = ${fmt(l.quantite * l.prixVente)} DH`
    ),
    line,
    `  TOTAL TTC : ${fmt(total)} DH`,
    line,
  ].join("\n")
}

// ---- Besoin d'achat net ----
// Calcul : commandes prévendeurs – stock disponible – retours validés
// Peut être regroupé par fournisseur

export interface BesoinLigneEmail {
  articleNom:    string
  fournisseurNom?: string
  commandeTotal: number
  stockActuel:   number
  retours:       number
  besoinNet:     number
  unite?:        string
}

export function buildBesoinAchatEmail(
  lignes: BesoinLigneEmail[],
  options?: { date?: string; titre?: string }
): string {
  const d    = options?.date  ?? dateStr()
  const line = "─".repeat(56)
  const total = lignes.reduce((s, l) => s + l.besoinNet, 0)

  const header = [
    line,
    `  BESOIN D'ACHAT NET — FreshLink Pro`,
    `  Date : ${d}`,
    `  Calcul : Commandes prévendeurs − Stock − Retours validés`,
    line,
    `  ${"Article".padEnd(22)} ${"Cdes".padStart(6)} ${"Stock".padStart(6)} ${"Retours".padStart(8)} ${"Besoin".padStart(8)}`,
    `  ${"─".repeat(52)}`,
  ]

  const rows = lignes.map(l => {
    const unite = l.unite ? ` ${l.unite}` : ""
    const status = l.besoinNet > 0 ? `  *** COMMANDER ${l.besoinNet}${unite} ***` : "  OK"
    return [
      `  ${l.articleNom.slice(0, 22).padEnd(22)} ${String(l.commandeTotal).padStart(6)} ${String(l.stockActuel).padStart(6)} ${String(l.retours).padStart(8)} ${String(l.besoinNet).padStart(8)}${l.besoinNet > 0 ? status : ""}`,
      l.fournisseurNom ? `    → Fournisseur : ${l.fournisseurNom}` : "",
    ].filter(Boolean).join("\n")
  })

  const footer = [
    `  ${"─".repeat(52)}`,
    `  Total besoin net : ${total} unité(s)`,
    line,
    "  À envoyer au(x) fournisseur(s) pour approvisionnement",
    line,
  ]

  return [...header, ...rows, ...footer].join("\n")
}

// ---- Besoin d'achat consolide par fournisseur ----

export interface BesoinParFournisseur {
  fournisseurNom: string
  fournisseurEmail?: string
  lignes: BesoinLigneEmail[]
}

export function buildBesoinAchatParFournisseur(
  groupes: BesoinParFournisseur[],
  date?: string
): Array<{ fournisseurNom: string; fournisseurEmail?: string; subject: string; body: string }> {
  const d = date ?? dateStr()
  return groupes
    .filter(g => g.lignes.some(l => l.besoinNet > 0))
    .map(g => {
      const lignesAvecBesoin = g.lignes.filter(l => l.besoinNet > 0)
      return {
        fournisseurNom:   g.fournisseurNom,
        fournisseurEmail: g.fournisseurEmail,
        subject: `Commande d'approvisionnement FreshLink — ${g.fournisseurNom} — ${d}`,
        body: buildBesoinAchatEmail(
          lignesAvecBesoin.map(l => ({ ...l, fournisseurNom: undefined })),
          { date: d, titre: `Commande pour ${g.fournisseurNom}` }
        ),
      }
    })
}
