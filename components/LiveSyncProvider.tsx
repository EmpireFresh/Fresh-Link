"use client"

import { useEffect } from "react"
import { activateLiveSync, setRealtimePulling } from "@/lib/supabase/liveSync"
import { store, isDemoUser } from "@/lib/store"

// Tables ERP principales surveillées pour la sync temps-réel cross-devices
const REALTIME_TABLES = [
  { table: "fl_users",          key: "fl_users",          fetch: "fetchUsers" },
  { table: "fl_clients",        key: "fl_clients",        fetch: "fetchClients" },
  { table: "fl_articles",       key: "fl_articles",       fetch: "fetchArticles" },
  { table: "fl_fournisseurs",   key: "fl_fournisseurs",   fetch: "fetchFournisseurs" },
  { table: "fl_commandes",      key: "fl_commandes",      fetch: "fetchCommandes" },
  { table: "fl_bons_livraison", key: "fl_bons_livraison", fetch: "fetchBonsLivraison" },
  { table: "fl_trips",          key: "fl_trips",          fetch: "fetchTrips" },
  { table: "fl_retours",        key: "fl_retours",        fetch: "fetchRetours" },
] as const

export default function LiveSyncProvider() {
  useEffect(() => {
    // 1. Patch store methods so every write syncs to Supabase
    activateLiveSync()

    // 2. Pull from Supabase au démarrage — seed si Supabase est vide
    import("@/lib/supabase/db").then(async (db) => {
      try {
        const sbUsers = await db.fetchUsers()
        if (sbUsers.length === 0) {
          const localUsers = store.getUsers().filter(u => !isDemoUser(u))
          for (const u of localUsers) await db.upsertUser(u)
        }
        const { clients: sbClients } = await db.fetchClients()
        if (sbClients.length === 0) {
          for (const c of store.getClients()) await db.upsertClient(c)
        }
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

    // 3. Sync même appareil, onglets différents
    const onStorage = (e: StorageEvent) => {
      if (!e.key?.startsWith("fl_")) return
      window.dispatchEvent(new CustomEvent("fl_store_updated", { detail: e.key }))
    }
    window.addEventListener("storage", onStorage)

    // 4. Sync CROSS-DEVICES via Supabase Realtime
    //    Quand un autre appareil écrit en Supabase, on reçoit l'événement ici,
    //    on re-pull cette table dans localStorage et on notifie les composants.
    const timers: Record<string, ReturnType<typeof setTimeout>> = {}
    let channel: ReturnType<(typeof import("@supabase/supabase-js"))["createClient"]>["channel"] extends ((...args: unknown[]) => infer R) ? R : never | null = null as never

    function scheduleRefetch(tableKey: string, fetchFn: string) {
      clearTimeout(timers[tableKey])
      timers[tableKey] = setTimeout(async () => {
        try {
          const db = await import("@/lib/supabase/db")
          setRealtimePulling(true)
          if      (fetchFn === "fetchUsers")        await db.fetchUsers()
          else if (fetchFn === "fetchClients")      await db.fetchClients()
          else if (fetchFn === "fetchArticles")     await db.fetchArticles()
          else if (fetchFn === "fetchFournisseurs") await db.fetchFournisseurs()
          else if (fetchFn === "fetchCommandes")    await db.fetchCommandes()
          else if (fetchFn === "fetchBonsLivraison") await db.fetchBonsLivraison()
          else if (fetchFn === "fetchTrips")        await db.fetchTrips()
          else if (fetchFn === "fetchRetours")      await db.fetchRetours()
          window.dispatchEvent(new CustomEvent("fl_store_updated", { detail: tableKey }))
        } catch { /* offline */ }
        finally { setRealtimePulling(false) }
      }, 500)
    }

    import("@/lib/supabase/client").then(({ createClient }) => {
      const sb = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ch = (sb as any).channel("fl-erp-realtime", { config: { broadcast: { self: false } } })
      for (const { table, key, fetch } of REALTIME_TABLES) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ch.on("postgres_changes" as any, { event: "*", schema: "public", table },
          () => scheduleRefetch(key, fetch)
        )
      }
      ch.subscribe((status: string) => {
        if (status === "SUBSCRIBED")
          console.log("[FreshLink] Realtime ✓ — sync cross-devices actif")
      })
      channel = ch
    }).catch(() => { /* offline */ })

    return () => {
      window.removeEventListener("storage", onStorage)
      Object.values(timers).forEach(clearTimeout)
      if (channel) {
        import("@/lib/supabase/client").then(({ createClient }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createClient().removeChannel(channel as any)
        }).catch(() => {})
      }
    }
  }, [])
  return null
}
