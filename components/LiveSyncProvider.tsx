"use client"

import { useEffect } from "react"
import { activateLiveSync } from "@/lib/supabase/liveSync"

export default function LiveSyncProvider() {
  useEffect(() => {
    // 1. Patch store methods so every write syncs to Supabase
    activateLiveSync()

    // 2. Pull fresh data from Supabase on every app load
    //    This ensures all devices stay in sync (deletions, updates, new records)
    import("@/lib/supabase/db").then(async (db) => {
      try {
        await Promise.allSettled([
          db.fetchUsers(),
          db.fetchClients(),
          db.fetchArticles(),
          db.fetchFournisseurs(),
          db.fetchCommandes(),
          db.fetchTrips(),
          db.fetchBonsLivraison(),
          db.fetchRetours(),
        ])
      } catch { /* offline — localStorage already loaded */ }
    })
  }, [])
  return null
}
