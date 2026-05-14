"use client"

// ============================================================
// FreshLink Pro — DB layer JSONB (Supabase + localStorage fallback)
//
// SCHÉMA SUPABASE : toutes les tables ERP ont le schéma :
//   id TEXT PRIMARY KEY
//   payload JSONB NOT NULL DEFAULT '{}'
//   updated_at TIMESTAMPTZ DEFAULT now()
//
// Chaque objet est stocké entier dans `payload`.
// Pas de mapping colonnes — aucun problème camelCase/snake_case.
// ============================================================

import { createClient } from "@/lib/supabase/client"
import { store } from "@/lib/store"
import type {
  User, Client, Article, Fournisseur, Livreur, MotifRetour,
  Commande, Visite, BonAchat, PurchaseOrder, Reception,
  Trip, BonLivraison, Retour, BonPreparation,
  TransfertStock, Message, Notice,
} from "@/lib/store"

// ── Helpers JSONB ─────────────────────────────────────────────────────────────

function toRow(item: Record<string, unknown>) {
  return { id: item.id as string, payload: item, updated_at: new Date().toISOString() }
}

function fromRow<T>(row: { id: string; payload: unknown }): T {
  if (row.payload && typeof row.payload === "object") return row.payload as T
  return row as unknown as T
}

function sb() { return createClient() }

// ── USERS ─────────────────────────────────────────────────────────────────────

export async function upsertUser(u: User) {
  const all = store.getUsers()
  const idx = all.findIndex(x => x.id === u.id)
  if (idx >= 0) all[idx] = u; else all.push(u)
  store.saveUsers(all)
  try {
    const { error } = await sb().from("fl_users").upsert(toRow(u as unknown as Record<string, unknown>), { onConflict: "id" })
    if (error) console.error("[db] upsertUser:", error.message)
  } catch { /* offline */ }
}

export async function deleteUser(id: string) {
  store.saveUsers(store.getUsers().filter(u => u.id !== id))
  try {
    const { error } = await sb().from("fl_users").delete().eq("id", id)
    if (error) console.error("[db] deleteUser:", error.message)
  } catch { /* offline */ }
}

export async function fetchUsers(): Promise<User[]> {
  try {
    const { data, error } = await sb().from("fl_users").select("id, payload")
    if (error) throw error
    if (data && data.length > 0) {
      const users = data.map(r => fromRow<User>(r))
      store.saveUsers(users)
      return users
    }
  } catch { /* offline */ }
  return store.getUsers()
}

// ── CLIENTS ───────────────────────────────────────────────────────────────────

export async function upsertClient(c: Client) {
  const all = store.getClients()
  const idx = all.findIndex(x => x.id === c.id)
  if (idx >= 0) all[idx] = c; else all.push(c)
  store.saveClients(all)
  try {
    const { error } = await sb().from("fl_clients").upsert(toRow(c as unknown as Record<string, unknown>), { onConflict: "id" })
    if (error) console.error("[db] upsertClient:", error.message)
  } catch { /* offline */ }
}

export async function deleteClient(id: string) {
  store.saveClients(store.getClients().filter(c => c.id !== id))
  try {
    const { error } = await sb().from("fl_clients").delete().eq("id", id)
    if (error) console.error("[db] deleteClient:", error.message)
  } catch { /* offline */ }
}

export async function fetchClients(): Promise<{ clients: Client[]; source: "supabase" | "local" }> {
  try {
    const { data, error } = await sb().from("fl_clients").select("id, payload")
    if (error) throw error
    if (data && data.length > 0) {
      const clients = data.map(r => fromRow<Client>(r))
      store.saveClients(clients)
      return { clients, source: "supabase" }
    }
  } catch { /* offline */ }
  return { clients: store.getClients(), source: "local" }
}

export async function importClients(rows: Client[]): Promise<{ inserted: number; updated: number; errors: number }> {
  let inserted = 0, updated = 0, errors = 0
  const existingIds = new Set(store.getClients().map(c => c.id))
  for (const c of rows) {
    try {
      await upsertClient(c)
      existingIds.has(c.id) ? updated++ : inserted++
    } catch { errors++ }
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
    const { error } = await sb().from("fl_articles").upsert(toRow(a as unknown as Record<string, unknown>), { onConflict: "id" })
    if (error) console.error("[db] upsertArticle:", error.message)
  } catch { /* offline */ }
}

export async function deleteArticle(id: string) {
  store.saveArticles(store.getArticles().filter(a => a.id !== id))
  try {
    const { error } = await sb().from("fl_articles").delete().eq("id", id)
    if (error) console.error("[db] deleteArticle:", error.message)
  } catch { /* offline */ }
}

export async function fetchArticles(): Promise<Article[]> {
  try {
    const { data, error } = await sb().from("fl_articles").select("id, payload")
    if (error) throw error
    if (data && data.length > 0) {
      const articles = data.map(r => fromRow<Article>(r))
      store.saveArticles(articles)
      return articles
    }
  } catch { /* offline */ }
  return store.getArticles()
}

// ── FOURNISSEURS ──────────────────────────────────────────────────────────────

export async function upsertFournisseur(f: Fournisseur) {
  const all = store.getFournisseurs()
  const idx = all.findIndex(x => x.id === f.id)
  if (idx >= 0) all[idx] = f; else all.push(f)
  store.saveFournisseurs(all)
  try {
    const { error } = await sb().from("fl_fournisseurs").upsert(toRow(f as unknown as Record<string, unknown>), { onConflict: "id" })
    if (error) console.error("[db] upsertFournisseur:", error.message)
  } catch { /* offline */ }
}

export async function fetchFournisseurs(): Promise<Fournisseur[]> {
  try {
    const { data, error } = await sb().from("fl_fournisseurs").select("id, payload")
    if (error) throw error
    if (data && data.length > 0) {
      const items = data.map(r => fromRow<Fournisseur>(r))
      store.saveFournisseurs(items)
      return items
    }
  } catch { /* offline */ }
  return store.getFournisseurs()
}

// ── COMMANDES ─────────────────────────────────────────────────────────────────

export async function upsertCommande(c: Commande) {
  const all = store.getCommandes()
  const idx = all.findIndex(x => x.id === c.id)
  if (idx >= 0) all[idx] = c; else all.push(c)
  store.saveCommandes(all)
  try {
    const { error } = await sb().from("fl_commandes").upsert(toRow(c as unknown as Record<string, unknown>), { onConflict: "id" })
    if (error) console.error("[db] upsertCommande:", error.message)
  } catch { /* offline */ }
}

export async function deleteCommande(id: string) {
  store.saveCommandes(store.getCommandes().filter(c => c.id !== id))
  try {
    const { error } = await sb().from("fl_commandes").delete().eq("id", id)
    if (error) console.error("[db] deleteCommande:", error.message)
  } catch { /* offline */ }
}

export async function fetchCommandes(dateFilter?: string): Promise<Commande[]> {
  try {
    const { data, error } = await sb().from("fl_commandes").select("id, payload")
    if (error) throw error
    if (data) {
      let items = data.map(r => fromRow<Commande>(r))
      if (dateFilter) items = items.filter(c => c.date === dateFilter)
      store.saveCommandes(items)
      return items
    }
  } catch { /* offline */ }
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
    const { error } = await sb().from("fl_visites").upsert(toRow(v as unknown as Record<string, unknown>), { onConflict: "id" })
    if (error) console.error("[db] upsertVisite:", error.message)
  } catch { /* offline */ }
}

// ── TRIPS ─────────────────────────────────────────────────────────────────────

export async function upsertTrip(t: Trip) {
  const all = store.getTrips()
  const idx = all.findIndex(x => x.id === t.id)
  if (idx >= 0) all[idx] = t; else all.push(t)
  store.saveTrips(all)
  try {
    const { error } = await sb().from("fl_trips").upsert(toRow(t as unknown as Record<string, unknown>), { onConflict: "id" })
    if (error) console.error("[db] upsertTrip:", error.message)
  } catch { /* offline */ }
}

export async function fetchTrips(): Promise<Trip[]> {
  try {
    const { data, error } = await sb().from("fl_trips").select("id, payload")
    if (error) throw error
    if (data) {
      const items = data.map(r => fromRow<Trip>(r))
      store.saveTrips(items)
      return items
    }
  } catch { /* offline */ }
  return store.getTrips()
}

// ── BONS LIVRAISON ────────────────────────────────────────────────────────────

export async function upsertBonLivraison(b: BonLivraison) {
  const all = store.getBonsLivraison()
  const idx = all.findIndex(x => x.id === b.id)
  if (idx >= 0) all[idx] = b; else all.push(b)
  store.saveBonsLivraison(all)
  try {
    const { error } = await sb().from("fl_bons_livraison").upsert(toRow(b as unknown as Record<string, unknown>), { onConflict: "id" })
    if (error) console.error("[db] upsertBonLivraison:", error.message)
  } catch { /* offline */ }
}

export async function fetchBonsLivraison(): Promise<BonLivraison[]> {
  try {
    const { data, error } = await sb().from("fl_bons_livraison").select("id, payload")
    if (error) throw error
    if (data) {
      const items = data.map(r => fromRow<BonLivraison>(r))
      store.saveBonsLivraison(items)
      return items
    }
  } catch { /* offline */ }
  return store.getBonsLivraison()
}

// ── RETOURS ───────────────────────────────────────────────────────────────────

export async function upsertRetour(r: Retour) {
  const all = store.getRetours()
  const idx = all.findIndex(x => x.id === r.id)
  if (idx >= 0) all[idx] = r; else all.push(r)
  store.saveRetours(all)
  try {
    const { error } = await sb().from("fl_retours").upsert(toRow(r as unknown as Record<string, unknown>), { onConflict: "id" })
    if (error) console.error("[db] upsertRetour:", error.message)
  } catch { /* offline */ }
}

export async function fetchRetours(): Promise<Retour[]> {
  try {
    const { data, error } = await sb().from("fl_retours").select("id, payload")
    if (error) throw error
    if (data) {
      const items = data.map(r => fromRow<Retour>(r))
      store.saveRetours(items)
      return items
    }
  } catch { /* offline */ }
  return store.getRetours()
}

// ── BONS ACHAT ────────────────────────────────────────────────────────────────

export async function upsertBonAchat(b: BonAchat) {
  const all = store.getBonsAchat()
  const idx = all.findIndex(x => x.id === b.id)
  if (idx >= 0) all[idx] = b; else all.push(b)
  store.saveBonsAchat(all)
  try {
    const { error } = await sb().from("fl_bons_achat").upsert(toRow(b as unknown as Record<string, unknown>), { onConflict: "id" })
    if (error) console.error("[db] upsertBonAchat:", error.message)
  } catch { /* offline */ }
}

// ── PURCHASE ORDERS ───────────────────────────────────────────────────────────

export async function upsertPurchaseOrder(p: PurchaseOrder) {
  const all = store.getPurchaseOrders()
  const idx = all.findIndex(x => x.id === p.id)
  if (idx >= 0) all[idx] = p; else all.push(p)
  store.savePurchaseOrders(all)
  try {
    const { error } = await sb().from("fl_purchase_orders").upsert(toRow(p as unknown as Record<string, unknown>), { onConflict: "id" })
    if (error) console.error("[db] upsertPurchaseOrder:", error.message)
  } catch { /* offline */ }
}

// ── RECEPTIONS ────────────────────────────────────────────────────────────────

export async function upsertReception(r: Reception) {
  const all = store.getReceptions()
  const idx = all.findIndex(x => x.id === r.id)
  if (idx >= 0) all[idx] = r; else all.push(r)
  store.saveReceptions(all)
  try {
    const { error } = await sb().from("fl_receptions").upsert(toRow(r as unknown as Record<string, unknown>), { onConflict: "id" })
    if (error) console.error("[db] upsertReception:", error.message)
  } catch { /* offline */ }
}

// ── BONS PREPARATION ─────────────────────────────────────────────────────────

export async function upsertBonPreparation(b: BonPreparation) {
  const all = store.getBonsPreparation()
  const idx = all.findIndex(x => x.id === b.id)
  if (idx >= 0) all[idx] = b; else all.push(b)
  store.saveBonsPreparation(all)
  try {
    const { error } = await sb().from("fl_bons_preparation").upsert(toRow(b as unknown as Record<string, unknown>), { onConflict: "id" })
    if (error) console.error("[db] upsertBonPreparation:", error.message)
  } catch { /* offline */ }
}

// ── TRANSFERTS STOCK ──────────────────────────────────────────────────────────

export async function upsertTransfert(t: TransfertStock) {
  const all = store.getTransferts()
  const idx = all.findIndex(x => x.id === t.id)
  if (idx >= 0) all[idx] = t; else all.push(t)
  store.saveTransferts(all)
  try {
    const { error } = await sb().from("fl_transferts_stock").upsert(toRow(t as unknown as Record<string, unknown>), { onConflict: "id" })
    if (error) console.error("[db] upsertTransfert:", error.message)
  } catch { /* offline */ }
}

// ── LIVREURS ──────────────────────────────────────────────────────────────────

export async function upsertLivreur(l: Livreur) {
  const all = store.getLivreurs?.() ?? []
  const idx = all.findIndex(x => x.id === l.id)
  if (idx >= 0) all[idx] = l; else all.push(l)
  store.saveLivreurs?.(all)
  try {
    const { error } = await sb().from("fl_livreurs").upsert(toRow(l as unknown as Record<string, unknown>), { onConflict: "id" })
    if (error) console.error("[db] upsertLivreur:", error.message)
  } catch { /* offline */ }
}

// ── MOTIFS RETOUR ─────────────────────────────────────────────────────────────

export async function upsertMotif(m: MotifRetour) {
  const all = store.getMotifs()
  const idx = all.findIndex(x => x.id === m.id)
  if (idx >= 0) all[idx] = m; else all.push(m)
  store.saveMotifs(all)
  try {
    const { error } = await sb().from("fl_non_achats").upsert(toRow(m as unknown as Record<string, unknown>), { onConflict: "id" })
    if (error) console.error("[db] upsertMotif:", error.message)
  } catch { /* offline */ }
}

// ── MESSAGES ──────────────────────────────────────────────────────────────────

export async function upsertMessage(m: Message) {
  const all = store.getMessages()
  const idx = all.findIndex(x => x.id === m.id)
  if (idx >= 0) all[idx] = m; else all.push(m)
  store.saveMessages(all)
  try {
    const { error } = await sb().from("fl_messages").upsert(toRow(m as unknown as Record<string, unknown>), { onConflict: "id" })
    if (error) console.error("[db] upsertMessage:", error.message)
  } catch { /* offline */ }
}

// ── NOTICES ───────────────────────────────────────────────────────────────────

export async function upsertNotice(n: Notice) {
  const all = store.getNotices()
  const idx = all.findIndex(x => x.id === n.id)
  if (idx >= 0) all[idx] = n; else all.push(n)
  store.saveNotices(all)
  try {
    const { error } = await sb().from("fl_notices").upsert(toRow(n as unknown as Record<string, unknown>), { onConflict: "id" })
    if (error) console.error("[db] upsertNotice:", error.message)
  } catch { /* offline */ }
}

// ── SYNC COMPLET : Supabase → localStorage ────────────────────────────────────

export async function syncFromSupabase(): Promise<{ ok: boolean; tables: string[]; errors: string[] }> {
  const tables: string[] = []
  const errors: string[] = []

  const ERP_TABLE_MAP: [string, (items: unknown[]) => void][] = [
    ["fl_users",            (d) => store.saveUsers(d as User[])],
    ["fl_clients",          (d) => store.saveClients(d as Client[])],
    ["fl_articles",         (d) => store.saveArticles(d as Article[])],
    ["fl_fournisseurs",     (d) => store.saveFournisseurs(d as Fournisseur[])],
    ["fl_commandes",        (d) => store.saveCommandes(d as Commande[])],
    ["fl_trips",            (d) => store.saveTrips(d as Trip[])],
    ["fl_bons_livraison",   (d) => store.saveBonsLivraison(d as BonLivraison[])],
    ["fl_retours",          (d) => store.saveRetours(d as Retour[])],
    ["fl_bons_achat",       (d) => store.saveBonsAchat(d as BonAchat[])],
    ["fl_purchase_orders",  (d) => store.savePurchaseOrders(d as PurchaseOrder[])],
    ["fl_receptions",       (d) => store.saveReceptions(d as Reception[])],
    ["fl_bons_preparation", (d) => store.saveBonsPreparation(d as BonPreparation[])],
    ["fl_visites",          (d) => store.saveVisites(d as Visite[])],
    ["fl_messages",         (d) => store.saveMessages(d as Message[])],
    ["fl_notices",          (d) => store.saveNotices(d as Notice[])],
    ["fl_livreurs",         (d) => store.saveLivreurs?.(d as Livreur[])],
    ["fl_transferts_stock", (d) => store.saveTransferts(d as TransfertStock[])],
  ]

  await Promise.allSettled(
    ERP_TABLE_MAP.map(async ([table, save]) => {
      try {
        const { data, error } = await sb().from(table).select("id, payload").limit(1000)
        if (error) throw error
        if (data && data.length > 0) {
          const items = data.map(r => fromRow<Record<string, unknown>>(r))
          save(items)
          tables.push(table)
        }
      } catch (e) {
        errors.push(`${table}: ${(e as Error).message}`)
      }
    })
  )

  return { ok: errors.length === 0, tables, errors }
}
