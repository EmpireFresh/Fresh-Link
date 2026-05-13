"use client"

// ============================================================
// FreshLink Pro — DB layer (Supabase + localStorage fallback)
// Toutes les écritures vont dans Supabase EN PREMIER,
// puis dans localStorage comme cache local.
// Les lectures essaient Supabase, puis localStorage si offline.
// ============================================================

import { createClient } from "@/lib/supabase/client"
import { store } from "@/lib/store"
import type {
  User, Client, Article, Fournisseur, Livreur, MotifRetour,
  Commande, Visite, BonAchat, PurchaseOrder, Reception,
  Trip, BonLivraison, Retour, BonPreparation,
  TransfertStock, Message, Notice,
} from "@/lib/store"

// ── Helper: vérifie si Supabase est joignable ─────────────────────────────────
function sb() {
  return createClient()
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return sb() as any }

// ── serialise un objet User (camelCase → snake_case) pour Supabase ────────────
function userToRow(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    password_hash: u.password ?? "",
    role: u.role,
    access_type: u.accessType ?? null,
    secteur: u.secteur ?? null,
    phone: u.phone ?? null,
    telephone: u.telephone ?? null,
    actif: u.actif,
    photo_url: u.photoUrl ?? null,
    can_view_achat: u.canViewAchat ?? false,
    can_view_commercial: u.canViewCommercial ?? false,
    can_view_logistique: u.canViewLogistique ?? false,
    can_view_stock: u.canViewStock ?? false,
    can_view_cash: u.canViewCash ?? false,
    can_view_finance: u.canViewFinance ?? false,
    can_view_recap: u.canViewRecap ?? false,
    can_view_database: u.canViewDatabase ?? false,
    objectif_clients: u.objectifClients ?? null,
    objectif_tonnage: u.objectifTonnage ?? null,
    objectif_journalier_ca: u.objectifJournalierCA ?? null,
    objectif_hebdomadaire_ca: u.objectifHebdomadaireCA ?? null,
    objectif_mensuel_ca: u.objectifMensuelCA ?? null,
    objectif_journalier_clients: u.objectifJournalierClients ?? null,
    objectif_hebdomadaire_clients: u.objectifHebdomadaireClients ?? null,
    objectif_mensuel_clients: u.objectifMensuelClients ?? null,
    notif_achat: u.notifAchat ?? false,
    notif_commercial: u.notifCommercial ?? false,
    notif_livraison: u.notifLivraison ?? false,
    notif_recap: u.notifRecap ?? false,
    notif_besoin_achat: u.notifBesoinAchat ?? false,
    fournisseur_id: u.fournisseurId ?? null,
    client_id: u.clientId ?? null,
  }
}

// ── USERS ─────────────────────────────────────────────────────────────────────

export async function upsertUser(u: User) {
  // Save local first (instant UI)
  const all = store.getUsers()
  const idx = all.findIndex(x => x.id === u.id)
  if (idx >= 0) all[idx] = u; else all.push(u)
  store.saveUsers(all)

  // Then push to Supabase
  try {
    const { error } = await db().from("fl_users").upsert(userToRow(u), { onConflict: "id" })
    if (error) console.error("[db] upsertUser:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

export async function deleteUser(id: string) {
  store.saveUsers(store.getUsers().filter(u => u.id !== id))
  try {
    const { error } = await db().from("fl_users").delete().eq("id", id)
    if (error) console.error("[db] deleteUser:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

export async function fetchUsers(): Promise<User[]> {
  try {
    const { data, error } = await db().from("fl_users").select("*").order("name")
    if (error) throw error
    if (data && data.length > 0) {
      // Map snake_case → camelCase
      const users = data.map(rowToUser)
      store.saveUsers(users)
      return users
    }
  } catch (e) {
    console.error("[db] fetchUsers offline — using localStorage:", e)
  }
  return store.getUsers()
}

function rowToUser(r: Record<string, unknown>): User {
  return {
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    password: r.password_hash as string,
    role: r.role as User["role"],
    accessType: r.access_type as User["accessType"],
    secteur: r.secteur as string,
    phone: r.phone as string,
    telephone: r.telephone as string,
    actif: r.actif as boolean,
    photoUrl: r.photo_url as string,
    canViewAchat: r.can_view_achat as boolean,
    canViewCommercial: r.can_view_commercial as boolean,
    canViewLogistique: r.can_view_logistique as boolean,
    canViewStock: r.can_view_stock as boolean,
    canViewCash: r.can_view_cash as boolean,
    canViewFinance: r.can_view_finance as boolean,
    canViewRecap: r.can_view_recap as boolean,
    canViewDatabase: r.can_view_database as boolean,
    objectifClients: r.objectif_clients as number,
    objectifTonnage: r.objectif_tonnage as number,
    objectifJournalierCA: r.objectif_journalier_ca as number,
    objectifHebdomadaireCA: r.objectif_hebdomadaire_ca as number,
    objectifMensuelCA: r.objectif_mensuel_ca as number,
    objectifJournalierClients: r.objectif_journalier_clients as number,
    objectifHebdomadaireClients: r.objectif_hebdomadaire_clients as number,
    objectifMensuelClients: r.objectif_mensuel_clients as number,
    notifAchat: r.notif_achat as boolean,
    notifCommercial: r.notif_commercial as boolean,
    notifLivraison: r.notif_livraison as boolean,
    notifRecap: r.notif_recap as boolean,
    notifBesoinAchat: r.notif_besoin_achat as boolean,
    fournisseurId: r.fournisseur_id as string,
    clientId: r.client_id as string,
  } as unknown as User
}

// ── CLIENTS ───────────────────────────────────────────────────────────────────

export async function upsertClient(c: Client) {
  const all = store.getClients()
  const idx = all.findIndex(x => x.id === c.id)
  if (idx >= 0) all[idx] = c; else all.push(c)
  store.saveClients(all)

  try {
    const { error } = await db().from("fl_clients").upsert({ ...c }, { onConflict: "id" })
    if (error) console.error("[db] upsertClient:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

export async function deleteClient(id: string) {
  store.saveClients(store.getClients().filter(c => c.id !== id))
  try {
    const { error } = await db().from("fl_clients").delete().eq("id", id)
    if (error) console.error("[db] deleteClient:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

export async function fetchClients(): Promise<{ clients: Client[]; source: "supabase" | "local" }> {
  try {
    const { data, error } = await db().from("fl_clients").select("*").order("nom")
    if (error) throw error
    if (data && data.length > 0) {
      store.saveClients(data as Client[])
      return { clients: data as Client[], source: "supabase" }
    }
  } catch {
    // Supabase unavailable — use local storage silently
  }
  return { clients: store.getClients(), source: "local" }
}

export async function importClients(rows: Client[]): Promise<{ inserted: number; updated: number; errors: number }> {
  let inserted = 0, updated = 0, errors = 0
  const existing = store.getClients()
  const existingIds = new Set(existing.map(c => c.id))

  for (const c of rows) {
    try {
      await upsertClient(c)
      existingIds.has(c.id) ? updated++ : inserted++
    } catch {
      errors++
    }
  }
  return { inserted, updated, errors }
}

// ── ARTICLES ──────────────────────────────────────────────────────────────────

export async function upsertArticle(a: Article) {
  const all = store.getArticles()
  const idx = all.findIndex(x => x.id === a.id)
  if (idx >= 0) all[idx] = a; else all.push(a)
  store.saveArticles(all)

  try {
    const { error } = await db().from("fl_articles").upsert({ ...a }, { onConflict: "id" })
    if (error) console.error("[db] upsertArticle:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

export async function deleteArticle(id: string) {
  store.saveArticles(store.getArticles().filter(a => a.id !== id))
  try {
    const { error } = await db().from("fl_articles").delete().eq("id", id)
    if (error) console.error("[db] deleteArticle:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

export async function fetchArticles(): Promise<Article[]> {
  try {
    const { data, error } = await db().from("fl_articles").select("*").order("nom")
    if (error) throw error
    if (data && data.length > 0) {
      store.saveArticles(data as Article[])
      return data as Article[]
    }
  } catch (e) {
    // Supabase unavailable — offline mode
  }
  return store.getArticles()
}

// ── FOURNISSEURS ──────────────────────────────────────────────────────────────

export async function upsertFournisseur(f: Fournisseur) {
  const all = store.getFournisseurs()
  const idx = all.findIndex(x => x.id === f.id)
  if (idx >= 0) all[idx] = f; else all.push(f)
  store.saveFournisseurs(all)

  try {
    const { error } = await db().from("fl_fournisseurs").upsert({ ...f }, { onConflict: "id" })
    if (error) console.error("[db] upsertFournisseur:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

export async function fetchFournisseurs(): Promise<Fournisseur[]> {
  try {
    const { data, error } = await db().from("fl_fournisseurs").select("*").order("nom")
    if (error) throw error
    if (data && data.length > 0) {
      store.saveFournisseurs(data as Fournisseur[])
      return data as Fournisseur[]
    }
  } catch (e) {
    // Supabase unavailable — offline mode
  }
  return store.getFournisseurs()
}

// ── COMMANDES ─────────────────────────────────────────────────────────────────

export async function upsertCommande(c: Commande) {
  const all = store.getCommandes()
  const idx = all.findIndex(x => x.id === c.id)
  if (idx >= 0) all[idx] = c; else all.push(c)
  store.saveCommandes(all)

  try {
    const { error } = await db().from("fl_commandes").upsert({ ...c }, { onConflict: "id" })
    if (error) console.error("[db] upsertCommande:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

export async function deleteCommande(id: string) {
  store.saveCommandes(store.getCommandes().filter(c => c.id !== id))
  try {
    const { error } = await db().from("fl_commandes").delete().eq("id", id)
    if (error) console.error("[db] deleteCommande:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

export async function fetchCommandes(dateFilter?: string): Promise<Commande[]> {
  try {
    let query = db().from("fl_commandes").select("*").order("created_at", { ascending: false })
    if (dateFilter) query = query.eq("date", dateFilter)
    const { data, error } = await query
    if (error) throw error
    if (data) {
      store.saveCommandes(data as Commande[])
      return data as Commande[]
    }
  } catch (e) {
    // Supabase unavailable — offline mode
  }
  const all = store.getCommandes()
  return dateFilter ? all.filter(c => c.date === dateFilter) : all
}

// ── VISITES ───────────────────────────────────────────────────────────────────

export async function upsertVisite(v: Visite) {
  const all = store.getVisites()
  const idx = all.findIndex(x => x.id === v.id)
  if (idx >= 0) all[idx] = v; else all.push(v)
  store.saveVisites(all)

  try {
    const { error } = await db().from("fl_visites").upsert({ ...v }, { onConflict: "id" })
    if (error) console.error("[db] upsertVisite:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

// ── TRIPS ─────────────────────────────────────────────────────────────────────

export async function upsertTrip(t: Trip) {
  const all = store.getTrips()
  const idx = all.findIndex(x => x.id === t.id)
  if (idx >= 0) all[idx] = t; else all.push(t)
  store.saveTrips(all)

  try {
    const { error } = await db().from("fl_trips").upsert({ ...t }, { onConflict: "id" })
    if (error) console.error("[db] upsertTrip:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

export async function fetchTrips(): Promise<Trip[]> {
  try {
    const { data, error } = await db().from("fl_trips").select("*").order("created_at", { ascending: false })
    if (error) throw error
    if (data) {
      store.saveTrips(data as Trip[])
      return data as Trip[]
    }
  } catch (e) {
    // Supabase unavailable — offline mode
  }
  return store.getTrips()
}

// ── BONS LIVRAISON ────────────────────────────────────────────────────────────

export async function upsertBonLivraison(b: BonLivraison) {
  const all = store.getBonsLivraison()
  const idx = all.findIndex(x => x.id === b.id)
  if (idx >= 0) all[idx] = b; else all.push(b)
  store.saveBonsLivraison(all)

  try {
    const { error } = await db().from("fl_bons_livraison").upsert({ ...b }, { onConflict: "id" })
    if (error) console.error("[db] upsertBonLivraison:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

export async function fetchBonsLivraison(): Promise<BonLivraison[]> {
  try {
    const { data, error } = await db().from("fl_bons_livraison").select("*").order("created_at", { ascending: false })
    if (error) throw error
    if (data) {
      store.saveBonsLivraison(data as BonLivraison[])
      return data as BonLivraison[]
    }
  } catch (e) {
    // Supabase unavailable — offline mode
  }
  return store.getBonsLivraison()
}

// ── RETOURS ───────────────────────────────────────────────────────────────────

export async function upsertRetour(r: Retour) {
  const all = store.getRetours()
  const idx = all.findIndex(x => x.id === r.id)
  if (idx >= 0) all[idx] = r; else all.push(r)
  store.saveRetours(all)

  try {
    const { error } = await db().from("fl_retours").upsert({ ...r }, { onConflict: "id" })
    if (error) console.error("[db] upsertRetour:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

export async function fetchRetours(): Promise<Retour[]> {
  try {
    const { data, error } = await db().from("fl_retours").select("*").order("created_at", { ascending: false })
    if (error) throw error
    if (data) {
      store.saveRetours(data as Retour[])
      return data as Retour[]
    }
  } catch (e) {
    // Supabase unavailable — offline mode
  }
  return store.getRetours()
}

// ── BONS ACHAT ────────────────────────────────────────────────────────────────

export async function upsertBonAchat(b: BonAchat) {
  const all = store.getBonsAchat()
  const idx = all.findIndex(x => x.id === b.id)
  if (idx >= 0) all[idx] = b; else all.push(b)
  store.saveBonsAchat(all)

  try {
    const { error } = await db().from("fl_bons_achat").upsert({ ...b }, { onConflict: "id" })
    if (error) console.error("[db] upsertBonAchat:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

// ── PURCHASE ORDERS ───────────────────────────────────────────────────────────

export async function upsertPurchaseOrder(p: PurchaseOrder) {
  const all = store.getPurchaseOrders()
  const idx = all.findIndex(x => x.id === p.id)
  if (idx >= 0) all[idx] = p; else all.push(p)
  store.savePurchaseOrders(all)

  try {
    const { error } = await db().from("fl_purchase_orders").upsert({ ...p }, { onConflict: "id" })
    if (error) console.error("[db] upsertPurchaseOrder:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

// ── RECEPTIONS ────────────────────────────────────────────────────────────────

export async function upsertReception(r: Reception) {
  const all = store.getReceptions()
  const idx = all.findIndex(x => x.id === r.id)
  if (idx >= 0) all[idx] = r; else all.push(r)
  store.saveReceptions(all)

  try {
    const { error } = await db().from("fl_receptions").upsert({ ...r }, { onConflict: "id" })
    if (error) console.error("[db] upsertReception:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

// ── BONS PREPARATION ─────────────────────────────────────────────────────────

export async function upsertBonPreparation(b: BonPreparation) {
  const all = store.getBonsPreparation()
  const idx = all.findIndex(x => x.id === b.id)
  if (idx >= 0) all[idx] = b; else all.push(b)
  store.saveBonsPreparation(all)

  try {
    const { error } = await db().from("fl_bons_preparation").upsert({ ...b }, { onConflict: "id" })
    if (error) console.error("[db] upsertBonPreparation:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

// ── TRANSFERTS STOCK ──────────────────────────────────────────────────────────

export async function upsertTransfert(t: TransfertStock) {
  const all = store.getTransferts()
  const idx = all.findIndex(x => x.id === t.id)
  if (idx >= 0) all[idx] = t; else all.push(t)
  store.saveTransferts(all)

  try {
    const { error } = await db().from("fl_transferts_stock").upsert({ ...t }, { onConflict: "id" })
    if (error) console.error("[db] upsertTransfert:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

// ── LIVREURS ──────────────────────────────────────────────────────────────────

export async function upsertLivreur(l: Livreur) {
  const all = store.getLivreurs?.() ?? []
  const idx = all.findIndex(x => x.id === l.id)
  if (idx >= 0) all[idx] = l; else all.push(l)
  store.saveLivreurs?.(all)

  try {
    const { error } = await db().from("fl_livreurs").upsert({ ...l }, { onConflict: "id" })
    if (error) console.error("[db] upsertLivreur:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

// ── MOTIFS ────────────────────────────────────────────────────────────────────

export async function upsertMotif(m: MotifRetour) {
  const all = store.getMotifs()
  const idx = all.findIndex(x => x.id === m.id)
  if (idx >= 0) all[idx] = m; else all.push(m)
  store.saveMotifs(all)

  try {
    const { error } = await db().from("fl_motifs_retour").upsert({ ...m }, { onConflict: "id" })
    if (error) console.error("[db] upsertMotif:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

// ── MESSAGES ──────────────────────────────────────────────────────────────────

export async function upsertMessage(m: Message) {
  const all = store.getMessages()
  const idx = all.findIndex(x => x.id === m.id)
  if (idx >= 0) all[idx] = m; else all.push(m)
  store.saveMessages(all)

  try {
    const { error } = await db().from("fl_messages").upsert({ ...m }, { onConflict: "id" })
    if (error) console.error("[db] upsertMessage:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

// ── NOTICES ───────────────────────────────────────────────────────────────────

export async function upsertNotice(n: Notice) {
  const all = store.getNotices()
  const idx = all.findIndex(x => x.id === n.id)
  if (idx >= 0) all[idx] = n; else all.push(n)
  store.saveNotices(all)

  try {
    const { error } = await db().from("fl_notices").upsert({ ...n }, { onConflict: "id" })
    if (error) console.error("[db] upsertNotice:", error.message)
  } catch (e) {
    // Supabase unavailable — offline mode
  }
}

// ── SYNC INITIAL: charge toutes les données de Supabase vers localStorage ─────
export async function syncFromSupabase(): Promise<{
  ok: boolean
  tables: string[]
  errors: string[]
}> {
  const tables: string[] = []
  const errors: string[] = []

  const tries: [string, () => Promise<void>][] = [
    ["users",        async () => { await fetchUsers();         tables.push("users")        }],
    ["clients",      async () => { await fetchClients();       tables.push("clients")      }],
    ["articles",     async () => { await fetchArticles();      tables.push("articles")     }],
    ["fournisseurs", async () => { await fetchFournisseurs();  tables.push("fournisseurs") }],
    ["commandes",    async () => { await fetchCommandes();     tables.push("commandes")    }],
    ["trips",        async () => { await fetchTrips();         tables.push("trips")        }],
    ["bons_livraison",async () => { await fetchBonsLivraison();tables.push("bons_livraison")}],
    ["retours",      async () => { await fetchRetours();       tables.push("retours")      }],
  ]

  await Promise.allSettled(
    tries.map(async ([name, fn]) => {
      try { await fn() }
      catch (e) { errors.push(`${name}: ${(e as Error).message}`) }
    })
  )

  return { ok: errors.length === 0, tables, errors }
}
