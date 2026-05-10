"use client"

// ============================================================
// FreshLink Pro — SyncManager
// Pushes all existing localStorage data → Supabase on first login.
// Safe to run multiple times (uses upsert). Shows a progress UI.
// ============================================================

import { store, JAWAD_ID } from "@/lib/store"
import {
  upsertUser, upsertClient, upsertArticle, upsertFournisseur,
  upsertCommande, upsertVisite, upsertBonAchat, upsertPurchaseOrder,
  upsertReception, upsertTrip, upsertBonLivraison, upsertRetour,
  upsertBonPreparation, upsertTransfert, upsertMotif, upsertLivreur,
  upsertMessage, upsertNotice,
} from "./db"

// Demo account IDs that must NEVER be pushed to Supabase production
const DEMO_USER_IDS = new Set([
  "u1", "u_admin", "u_rc", "u2", "u3", "u5", "u6",
  "u_cash", "u_fin", "u_ourai", "u_acheteur",
  "u_ctrl_achat", "u_ctrl_prep", "u_liv_demo",
  "u_client", "u_four",
])

function getRealUsers() {
  // Keep Jawad (super_super_admin) but exclude all demo accounts
  return store.getUsers().filter(u => u.id === JAWAD_ID || !DEMO_USER_IDS.has(u.id))
}

export interface SyncProgress {
  step: string
  done: number
  total: number
  errors: number
  finished: boolean
}

export type ProgressCallback = (p: SyncProgress) => void

const SYNC_DONE_KEY = "fl_supabase_synced_v1"

export function isSyncDone(): boolean {
  try { return localStorage.getItem(SYNC_DONE_KEY) === "true" } catch { return false }
}

export function markSyncDone() {
  try { localStorage.setItem(SYNC_DONE_KEY, "true") } catch { /* noop */ }
}

export function resetSync() {
  try { localStorage.removeItem(SYNC_DONE_KEY) } catch { /* noop */ }
}

// Batch helper — push array with progress tracking
async function batch<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  label: string,
  cb: ProgressCallback,
  errorCount: { n: number }
) {
  const total = items.length
  cb({ step: label, done: 0, total, errors: errorCount.n, finished: false })
  for (let i = 0; i < items.length; i++) {
    try {
      await fn(items[i])
    } catch {
      errorCount.n++
    }
    cb({ step: label, done: i + 1, total, errors: errorCount.n, finished: false })
  }
}

export async function runFullSync(cb: ProgressCallback): Promise<void> {
  const err = { n: 0 }

  // Only push real (non-demo) users to Supabase
  await batch(getRealUsers(),              upsertUser,            "Utilisateurs",        cb, err)
  await batch(store.getClients(),          upsertClient,          "Clients",             cb, err)
  await batch(store.getArticles(),         upsertArticle,         "Articles",            cb, err)
  await batch(store.getFournisseurs(),     upsertFournisseur,     "Fournisseurs",        cb, err)
  await batch(store.getMotifs(),           upsertMotif,           "Motifs retour",       cb, err)
  await batch(store.getLivreurs?.() ?? [], upsertLivreur,         "Livreurs",            cb, err)
  await batch(store.getCommandes(),        upsertCommande,        "Commandes",           cb, err)
  await batch(store.getVisites(),          upsertVisite,          "Visites",             cb, err)
  await batch(store.getBonsAchat(),        upsertBonAchat,        "Bons achat",          cb, err)
  await batch(store.getPurchaseOrders(),   upsertPurchaseOrder,   "Purchase orders",     cb, err)
  await batch(store.getReceptions(),       upsertReception,       "Receptions",          cb, err)
  await batch(store.getTrips(),            upsertTrip,            "Trips",               cb, err)
  await batch(store.getBonsLivraison(),    upsertBonLivraison,    "Bons de livraison",   cb, err)
  await batch(store.getRetours(),          upsertRetour,          "Retours",             cb, err)
  await batch(store.getBonsPreparation(),  upsertBonPreparation,  "Bons preparation",    cb, err)
  await batch(store.getTransferts(),       upsertTransfert,       "Transferts stock",    cb, err)
  await batch(store.getMessages(),         upsertMessage,         "Messages",            cb, err)
  await batch(store.getNotices(),          upsertNotice,          "Notices",             cb, err)

  if (err.n === 0) markSyncDone()
  cb({ step: "Terminé", done: 1, total: 1, errors: err.n, finished: true })
}
