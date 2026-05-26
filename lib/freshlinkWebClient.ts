// ============================================================
// FreshLink Web Client — Liaison FreshLink ↔ vita-fresh.netlify.app
// À utiliser côté site client (vita-fresh.netlify.app)
// Permet : catalogue, contacts, demandes compte, commandes web
// Compatible Vanilla JS et tous frameworks (React, Vue, Svelte…)
// ============================================================

// ── Configuration ─────────────────────────────────────────────
const FRESHLINK_BASE_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_FRESHLINK_URL) ??
  (typeof window !== "undefined" && (window as any).__FRESHLINK_URL) ??
  "https://freshlink.vita-fresh.ma"  // URL de prod — à configurer

const SUPABASE_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPABASE_URL) ??
  "https://jwdrwapuetqoqnankgma.supabase.co"

const SUPABASE_ANON_KEY =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3ZHJ3YXB1ZXRxb3FuYW5rZ21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NDE1NzUsImV4cCI6MjA5NDAxNzU3NX0.9l0e2eE9milvCWg29TIoGXgWY-ULOmTVrPmWRCsIvtw"

// ── Types ─────────────────────────────────────────────────────

export interface ArticleCatalogue {
  id: string
  nom: string
  nom_ar?: string
  famille?: string
  unite: string
  photo?: string
  description?: string
  statut_web: "disponible" | "rupture" | "liquidation" | "bientot"
  visible_web: boolean
  promo_active: boolean
  promo_taux: number
  promo_label?: string
  promo_fin?: string
  criteres_qualite: Record<string, string>
  tags: string[]
  position_catalogue: number
  prix_public: number
  prix_promo?: number
}

export interface ContactsEntreprise {
  nom_societe?: string
  slogan?: string
  adresse_ligne1?: string
  adresse_ligne2?: string
  code_postal?: string
  ville?: string
  pays?: string
  tel_principal?: string
  tel_secondaire?: string
  tel_urgence?: string
  whatsapp_principal?: string
  whatsapp_commercial?: string
  whatsapp_livraison?: string
  email_principal?: string
  email_commercial?: string
  instagram?: string
  facebook?: string
  linkedin?: string
  tiktok?: string
  horaires_ouverture?: string
  horaires_livraison?: string
  zone_livraison?: string
}

export interface DemandeCompte {
  nom_societe: string
  nom_contact: string
  telephone: string
  whatsapp?: string
  email?: string
  adresse?: string
  ville?: string
  type_activite?: "restaurant" | "hotel" | "traiteur" | "epicerie" | "supermarche" | "autre"
  nb_couverts?: number
  nb_chambres?: number
  familles_souhaitees?: string[]
  volume_estime?: string
  message?: string
}

export interface LigneCommande {
  article_id: string
  nom: string
  qte: number
  unite: string
  prix_u: number
  montant: number
}

export interface CommandeWeb {
  nom_client: string
  telephone: string
  email?: string
  adresse_livraison?: string
  lignes: LigneCommande[]
  date_souhaitee?: string
  creneau?: "matin" | "apres-midi" | "soir"
  instructions?: string
  client_id?: string
  prospect_id?: string
}

// ── API Client ────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(`${FRESHLINK_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    })
    const json = await res.json()
    if (!res.ok) return { data: null, error: json?.error ?? `HTTP ${res.status}` }
    return { data: json as T, error: null }
  } catch (e: any) {
    return { data: null, error: e.message ?? "Erreur réseau" }
  }
}

// ── Catalogue ─────────────────────────────────────────────────

/**
 * Récupère tous les articles visibles sur le site.
 * Utilise directement Supabase pour bénéficier du Realtime.
 */
export async function getCatalogue(): Promise<ArticleCatalogue[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/v_marketplace_catalogue?visible_web=eq.true&order=position_catalogue`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY || "",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  )
  if (!res.ok) return []
  return res.json()
}

/**
 * Récupère les articles par famille.
 */
export async function getCatalogueParFamille(famille: string): Promise<ArticleCatalogue[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/v_marketplace_catalogue?famille=eq.${encodeURIComponent(famille)}&visible_web=eq.true`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY || "",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  )
  if (!res.ok) return []
  return res.json()
}

/**
 * Récupère les familles distinctes disponibles.
 */
export async function getFamillesCatalogue(): Promise<string[]> {
  const items = await getCatalogue()
  const familles = [...new Set(items.map(a => a.famille).filter(Boolean))] as string[]
  return familles.sort()
}

// ── Contacts ──────────────────────────────────────────────────

/**
 * Récupère les coordonnées publiques de l'entreprise.
 * Cache 5 minutes côté CDN.
 */
export async function getContacts(): Promise<ContactsEntreprise | null> {
  const { data } = await apiFetch<ContactsEntreprise>("/api/ext/contacts")
  return data
}

// ── Demande de compte (Prospect) ──────────────────────────────

/**
 * Soumet une demande de création de compte depuis le site.
 * Enregistre dans fl_prospects et notifie l'équipe commerciale.
 */
export async function soumettreDemandeCompte(
  demande: DemandeCompte
): Promise<{ ok: boolean; id?: string; message?: string; error?: string }> {
  const { data, error } = await apiFetch<{ id: string; message: string }>(
    "/api/ext/prospects",
    { method: "POST", body: JSON.stringify(demande) }
  )
  if (error) return { ok: false, error }
  return { ok: true, id: data?.id, message: data?.message }
}

// ── Commandes web ─────────────────────────────────────────────

/**
 * Soumet un panier depuis le site client.
 * Retourne le numéro de commande pour le suivi.
 */
export async function passerCommande(
  commande: CommandeWeb
): Promise<{ ok: boolean; numero?: string; id?: string; total?: number; error?: string }> {
  const { data, error } = await apiFetch<{ id: string; numero: string; total: number }>(
    "/api/ext/commandes-web",
    { method: "POST", body: JSON.stringify(commande) }
  )
  if (error) return { ok: false, error }
  return { ok: true, numero: data?.numero, id: data?.id, total: data?.total }
}

/**
 * Suivi d'une commande par numéro + téléphone.
 */
export async function suivreCommande(
  numero: string,
  telephone: string
): Promise<{ statut: string; montant_total: number; date_souhaitee?: string; created_at: string } | null> {
  const params = new URLSearchParams({ numero, tel: telephone })
  const { data } = await apiFetch<any>(`/api/ext/commandes-web?${params}`)
  return data
}

// ── Realtime Supabase (pour abonnement live) ──────────────────

/**
 * Connexion Realtime Supabase — écoute les changements du catalogue
 * et les nouvelles notifications en temps réel.
 *
 * Nécessite @supabase/supabase-js installé côté site client.
 *
 * Usage:
 *   const unsub = subscribeToUpdates({
 *     onCatalogueUpdate: (articles) => setCatalogue(articles),
 *     onContactsUpdate: (contacts) => setContacts(contacts),
 *   })
 *   // Plus tard: unsub()
 */
export function subscribeToUpdates(handlers: {
  onCatalogueUpdate?: (article: Partial<ArticleCatalogue> & { id: string }) => void
  onContactsUpdate?: (contacts: Partial<ContactsEntreprise>) => void
  onNouvelleCommande?: (commande: { id: string; numero: string; statut: string }) => void
}) {
  // Importation dynamique de Supabase pour ne pas forcer la dépendance
  const { createClient } = require("@supabase/supabase-js")
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const channel = sb.channel("freshlink-site-sync")

  if (handlers.onCatalogueUpdate) {
    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "fl_articles" },
      (payload: any) => handlers.onCatalogueUpdate!(payload.new)
    )
  }

  if (handlers.onContactsUpdate) {
    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "fl_company_contacts" },
      (payload: any) => handlers.onContactsUpdate!(payload.new)
    )
  }

  if (handlers.onNouvelleCommande) {
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "fl_commandes_web" },
      (payload: any) => handlers.onNouvelleCommande!({
        id: payload.new.id,
        numero: payload.new.numero,
        statut: payload.new.statut,
      })
    )
  }

  channel.subscribe()
  return () => sb.removeChannel(channel)
}

// ── Helpers ───────────────────────────────────────────────────

/** Formate un prix en DH : 1234.5 → "1 234,50 DH" */
export function formatPrix(prix: number): string {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    currencyDisplay: "symbol",
  })
    .format(prix)
    .replace("MAD", "DH")
}

/** Calcule le prix après promo */
export function prixApresPromo(article: ArticleCatalogue): number {
  if (!article.promo_active || !article.promo_taux) return article.prix_public
  return article.prix_public * (1 - article.promo_taux / 100)
}

/** Vérifie si une promo est encore valide */
export function promoValide(article: ArticleCatalogue): boolean {
  if (!article.promo_active) return false
  if (!article.promo_fin) return true
  return new Date(article.promo_fin) >= new Date()
}

/** Calcule le total d'un panier */
export function calculerTotal(lignes: LigneCommande[]): number {
  return lignes.reduce((s, l) => s + l.montant, 0)
}

/** Génère un message WhatsApp pré-rempli pour commander */
export function genWhatsAppCommande(
  lignes: LigneCommande[],
  whatsapp: string,
  nomClient?: string
): string {
  const total = calculerTotal(lignes)
  const details = lignes.map(l => `• ${l.nom} — ${l.qte} ${l.unite} × ${formatPrix(l.prix_u)} = ${formatPrix(l.montant)}`).join("\n")
  const msg = [
    `🛒 *Nouvelle commande Vita Fresh*`,
    nomClient ? `👤 Client : ${nomClient}` : "",
    ``,
    details,
    ``,
    `💰 *Total : ${formatPrix(total)}*`,
    ``,
    `📅 Date souhaitée : `,
  ]
    .filter(Boolean)
    .join("\n")
  const phone = whatsapp.replace(/[^0-9+]/g, "")
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
}
