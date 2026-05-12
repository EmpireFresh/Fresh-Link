"use client"

// ============================================================
// FreshLink — liveSync
// Patches store write methods so every localStorage write also
// fires a non-blocking Supabase upsert in the background.
// Call activateLiveSync() once in the root layout/provider.
// ============================================================

import { store } from "@/lib/store"
import type { Commande, BonLivraison, Trip, Visite, Client, Article, BonAchat, Retour } from "@/lib/store"

// Lazy-import db to avoid server-side execution
let dbModule: typeof import("./db") | null = null
async function db() {
  if (!dbModule) dbModule = await import("./db")
  return dbModule
}

function fire(fn: () => Promise<void>) {
  fn().catch(() => { /* never block UI — Supabase sync is best-effort */ })
}

let activated = false

export function activateLiveSync() {
  if (activated || typeof window === "undefined") return
  activated = true

  // ── Commandes ────────────────────────────────────────────────
  const origAddCommande = store.addCommande.bind(store)
  store.addCommande = (c: Commande) => {
    const result = origAddCommande(c)
    fire(async () => { const d = await db(); await d.upsertCommande(c) })
    return result
  }

  const origUpdateCommande = store.updateCommande.bind(store)
  store.updateCommande = (id: string, updates: Partial<Commande>) => {
    origUpdateCommande(id, updates)
    fire(async () => {
      const all = store.getCommandes()
      const cmd = all.find(c => c.id === id)
      if (cmd) { const d = await db(); await d.upsertCommande(cmd) }
    })
  }

  const origSaveCommandes = store.saveCommandes.bind(store)
  store.saveCommandes = (cmds: Commande[]) => {
    origSaveCommandes(cmds)
    fire(async () => {
      const d = await db()
      for (const c of cmds) await d.upsertCommande(c)
    })
  }

  // ── Bons de livraison ────────────────────────────────────────
  const origSaveBonsLivraison = store.saveBonsLivraison?.bind(store)
  if (origSaveBonsLivraison) {
    store.saveBonsLivraison = (bls: BonLivraison[]) => {
      origSaveBonsLivraison(bls)
      fire(async () => {
        const d = await db()
        for (const bl of bls) await d.upsertBonLivraison(bl)
      })
    }
  }

  // ── Trips ────────────────────────────────────────────────────
  const origSaveTrips = store.saveTrips?.bind(store)
  if (origSaveTrips) {
    store.saveTrips = (trips: Trip[]) => {
      origSaveTrips(trips)
      fire(async () => {
        const d = await db()
        for (const t of trips) await d.upsertTrip(t)
      })
    }
  }

  // ── Visites ──────────────────────────────────────────────────
  const origSaveVisites = store.saveVisites?.bind(store)
  if (origSaveVisites) {
    store.saveVisites = (visites: Visite[]) => {
      origSaveVisites(visites)
      fire(async () => {
        const d = await db()
        for (const v of visites) await d.upsertVisite(v)
      })
    }
  }

  // ── Clients ──────────────────────────────────────────────────
  const origSaveClients = store.saveClients.bind(store)
  store.saveClients = (clients: Client[]) => {
    origSaveClients(clients)
    fire(async () => {
      const d = await db()
      for (const c of clients) await d.upsertClient(c)
    })
  }

  // ── Articles ─────────────────────────────────────────────────
  const origSaveArticles = store.saveArticles.bind(store)
  store.saveArticles = (articles: Article[]) => {
    origSaveArticles(articles)
    fire(async () => {
      const d = await db()
      for (const a of articles) await d.upsertArticle(a)
    })
  }

  // ── Bons achat ───────────────────────────────────────────────
  const origSaveBonsAchat = store.saveBonsAchat?.bind(store)
  if (origSaveBonsAchat) {
    store.saveBonsAchat = (bas: BonAchat[]) => {
      origSaveBonsAchat(bas)
      fire(async () => {
        const d = await db()
        for (const b of bas) await d.upsertBonAchat(b)
      })
    }
  }

  // ── Retours ──────────────────────────────────────────────────
  const origSaveRetours = store.saveRetours?.bind(store)
  if (origSaveRetours) {
    store.saveRetours = (retours: Retour[]) => {
      origSaveRetours(retours)
      fire(async () => {
        const d = await db()
        for (const r of retours) await d.upsertRetour(r)
      })
    }
  }
}
