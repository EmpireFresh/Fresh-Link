"use client"

import { useEffect } from "react"
import { activateLiveSync } from "@/lib/supabase/liveSync"
import { store, isDemoUser } from "@/lib/store"

export default function LiveSyncProvider() {
  useEffect(() => {
    // 1. Patch store methods so every write syncs to Supabase
    activateLiveSync()

    // 2. Pull from Supabase — if Supabase is empty but localStorage has data, seed it first
    import("@/lib/supabase/db").then(async (db) => {
      try {
        // Pull users — if Supabase empty, push local users as seed
        const sbUsers = await db.fetchUsers()
        if (sbUsers.length === 0) {
          const localUsers = store.getUsers().filter(u => !isDemoUser(u))
          for (const u of localUsers) await db.upsertUser(u)
        }

        // Pull clients — seed if empty
        const { clients: sbClients } = await db.fetchClients()
        if (sbClients.length === 0) {
          const localClients = store.getClients()
          for (const c of localClients) await db.upsertClient(c)
        }

        // Pull the rest in parallel
        await Promise.allSettled([
          db.fetchArticles(),
          db.fetchFournisseurs(),
          db.fetchCommandes(),
          db.fetchTrips(),
          db.fetchBonsLivraison(),
          db.fetchRetours(),
        ])
      } catch { /* offline — localStorage already loaded */ }
    })

    // 3. Cross-tab / cross-browser sync on SAME device
    //    The browser fires 'storage' event when localStorage changes in another tab
    const onStorage = (e: StorageEvent) => {
      if (!e.key?.startsWith("fl_")) return
      // Dispatch fl_store_updated so components re-render with fresh data
      window.dispatchEvent(new CustomEvent("fl_store_updated", { detail: e.key }))
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])
  return null
}
