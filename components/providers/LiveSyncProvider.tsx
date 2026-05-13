"use client"

// ============================================================
// FreshLink Pro — LiveSyncProvider
// Maintient une connexion Supabase Realtime pour toutes les
// tables ERP principales. Quand une ligne change dans Supabase
// (depuis n'importe quel appareil), elle est immédiatement :
//   1. Écrite dans localStorage (pour les lectures locales)
//   2. Un event "fl_store_updated" est dispatché sur window
//      → les composants qui écoutent ce event se rafraîchissent
// ============================================================

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { store } from "@/lib/store"

// Mapping table Supabase → méthodes store
const TABLE_CONFIG = [
  { table: "fl_commandes",       getAll: () => store.getCommandes(),        saveAll: (d: unknown[]) => store.saveCommandes(d as Parameters<typeof store.saveCommandes>[0]) },
  { table: "fl_clients",         getAll: () => store.getClients(),          saveAll: (d: unknown[]) => store.saveClients(d as Parameters<typeof store.saveClients>[0]) },
  { table: "fl_users",           getAll: () => store.getUsers(),            saveAll: (d: unknown[]) => store.saveUsers(d as Parameters<typeof store.saveUsers>[0]) },
  { table: "fl_articles",        getAll: () => store.getArticles(),         saveAll: (d: unknown[]) => store.saveArticles(d as Parameters<typeof store.saveArticles>[0]) },
  { table: "fl_fournisseurs",    getAll: () => store.getFournisseurs(),     saveAll: (d: unknown[]) => store.saveFournisseurs(d as Parameters<typeof store.saveFournisseurs>[0]) },
  { table: "fl_bons_achat",      getAll: () => store.getBonsAchat(),        saveAll: (d: unknown[]) => store.saveBonsAchat(d as Parameters<typeof store.saveBonsAchat>[0]) },
  { table: "fl_bons_livraison",  getAll: () => store.getBonsLivraison(),    saveAll: (d: unknown[]) => store.saveBonsLivraison(d as Parameters<typeof store.saveBonsLivraison>[0]) },
  { table: "fl_bons_preparation",getAll: () => store.getBonsPreparation(),  saveAll: (d: unknown[]) => store.saveBonsPreparation(d as Parameters<typeof store.saveBonsPreparation>[0]) },
  { table: "fl_receptions",      getAll: () => store.getReceptions(),       saveAll: (d: unknown[]) => store.saveReceptions(d as Parameters<typeof store.saveReceptions>[0]) },
  { table: "fl_trips",           getAll: () => store.getTrips(),            saveAll: (d: unknown[]) => store.saveTrips(d as Parameters<typeof store.saveTrips>[0]) },
  { table: "fl_retours",         getAll: () => store.getRetours(),          saveAll: (d: unknown[]) => store.saveRetours(d as Parameters<typeof store.saveRetours>[0]) },
  { table: "fl_visites",         getAll: () => store.getVisites(),          saveAll: (d: unknown[]) => store.saveVisites(d as Parameters<typeof store.saveVisites>[0]) },
  { table: "fl_purchase_orders", getAll: () => store.getPurchaseOrders(),   saveAll: (d: unknown[]) => store.savePurchaseOrders(d as Parameters<typeof store.savePurchaseOrders>[0]) },
  { table: "fl_transferts_stock",getAll: () => store.getTransferts(),       saveAll: (d: unknown[]) => store.saveTransferts(d as Parameters<typeof store.saveTransferts>[0]) },
  { table: "fl_messages",        getAll: () => store.getMessages(),         saveAll: (d: unknown[]) => store.saveMessages(d as Parameters<typeof store.saveMessages>[0]) },
]

export function dispatchStoreUpdate(table: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("fl_store_updated", { detail: { table } }))
  }
}

export default function LiveSyncProvider({ children }: { children?: React.ReactNode }) {
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null)

  useEffect(() => {
    const sb = createClient()
    const channel = sb.channel("freshlink-erp-realtime", {
      config: { broadcast: { self: false } },
    })

    for (const cfg of TABLE_CONFIG) {
      channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table: cfg.table },
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          try {
            const current = cfg.getAll() as Array<Record<string, unknown>>
            const { eventType, new: newRec, old: oldRec } = payload
            if (eventType === "INSERT" && newRec?.id) {
              if (!current.some(r => r.id === newRec.id)) {
                cfg.saveAll([...current, newRec])
              }
            } else if (eventType === "UPDATE" && newRec?.id) {
              cfg.saveAll(current.map(r => r.id === newRec.id ? { ...r, ...newRec } : r))
            } else if (eventType === "DELETE" && oldRec?.id) {
              cfg.saveAll(current.filter(r => r.id !== oldRec.id))
            }
            dispatchStoreUpdate(cfg.table)
          } catch (e) {
            console.warn(`[LiveSync] ${cfg.table}:`, e)
          }
        }
      )
    }

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[LiveSync] ✅ Realtime ERP connecté")
      }
    })

    channelRef.current = channel
    return () => { sb.removeChannel(channel); channelRef.current = null }
  }, [])

  return <>{children}</>
}
