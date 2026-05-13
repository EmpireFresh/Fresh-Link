"use client"

// ============================================================
// FreshLink Pro — LiveSyncProvider v2
//
// PROBLÈME ROOT CAUSE :
//   store.saveXxx() écrit UNIQUEMENT dans localStorage.
//   Supabase ne reçoit jamais les données → les autres appareils
//   ne voient rien.
//
// SOLUTION :
//   1. WRITE PATH — Intercepte localStorage.setItem pour toutes
//      les clés ERP. Quand une donnée change, diff l'ancien/nouveau
//      tableau et pousse les items modifiés vers Supabase.
//
//   2. READ PATH — Supabase Realtime écoute toutes les tables ERP.
//      Quand un autre appareil écrit dans Supabase, on reçoit le
//      changement ici, on met à jour localStorage, et on dispatche
//      fl_store_updated pour que les composants se rafraîchissent.
//
//   3. FLAG anti-loop — isRealtimeRef empêche que les écritures
//      Realtime → localStorage déclenchent un re-push vers Supabase.
// ============================================================

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

// Mapping : clé localStorage → table Supabase
const ERP_KEYS: Record<string, string> = {
  fl_commandes:        "fl_commandes",
  fl_clients:          "fl_clients",
  fl_users:            "fl_users",
  fl_articles:         "fl_articles",
  fl_fournisseurs:     "fl_fournisseurs",
  fl_bons_achat:       "fl_bons_achat",
  fl_bons_livraison:   "fl_bons_livraison",
  fl_bons_preparation: "fl_bons_preparation",
  fl_receptions:       "fl_receptions",
  fl_trips:            "fl_trips",
  fl_retours:          "fl_retours",
  fl_visites:          "fl_visites",
  fl_purchase_orders:  "fl_purchase_orders",
  fl_transferts:       "fl_transferts_stock",  // clé LS ≠ table SB
  fl_messages:         "fl_messages",
}

// Clés à IGNORER (sessions, config UI, démo — ne pas pousser vers Supabase)
const IGNORED_KEYS = new Set([
  "fl_session", "fl_caisse", "fl_caisse_pricing", "fl_email_config",
  "fl_company", "fl_company_contacts", "fl_workflow_config",
  "fl_process_config", "fl_contenants_tare", "fl_inventory_logs",
  "fl_rh_notifications", "fl_salaries", "fl_paiements_salaires",
  "fl_reserve_snaps", "fl_caisses_mouvements", "fl_caisses_vides",
  "fl_actionnaires", "fl_charges", "fl_account_requests",
  "fl_web_integration", "fl_supabase_synced_v1",
])

export default function LiveSyncProvider({ children }: { children?: React.ReactNode }) {
  const isRealtimeRef = useRef(false)       // true pendant les mises à jour Realtime
  const prevRef       = useRef<Record<string, string>>({}) // shadow des valeurs localStorage
  const sbRef         = useRef(createClient())

  useEffect(() => {
    const sb = sbRef.current

    // ── 0. Initialiser le shadow des valeurs actuelles ──────────────────────
    for (const key of Object.keys(ERP_KEYS)) {
      const val = localStorage.getItem(key)
      if (val) prevRef.current[key] = val
    }

    // ── 1. WRITE PATH : intercepter localStorage.setItem ───────────────────
    const originalSetItem = localStorage.setItem.bind(localStorage)

    localStorage.setItem = function (key: string, value: string) {
      originalSetItem(key, value)

      // Ne pas repousser vers Supabase si c'est Realtime qui a déclenché l'écriture
      if (isRealtimeRef.current) return
      if (IGNORED_KEYS.has(key)) return

      const sbTable = ERP_KEYS[key]
      if (!sbTable) return

      const prevValue = prevRef.current[key]
      prevRef.current[key] = value

      try {
        const newItems  = JSON.parse(value) as Array<Record<string, unknown>>
        const prevItems: Array<Record<string, unknown>> = prevValue ? JSON.parse(prevValue) : []

        // Diff pour trouver les items ajoutés ou modifiés
        const prevMap = new Map(prevItems.map(i => [i.id, JSON.stringify(i)]))
        const newSet  = new Set(newItems.map(i => i.id))

        const upserted = newItems.filter(item =>
          !prevMap.has(item.id) || prevMap.get(item.id) !== JSON.stringify(item)
        )
        const deleted = prevItems.filter(i => !newSet.has(i.id))

        if (upserted.length > 0) {
          void sb.from(sbTable).upsert(upserted, { onConflict: "id" }).then(({ error }) => {
            if (error) console.warn(`[LiveSync↑] upsert ${sbTable}:`, error.message)
            else if (upserted.length > 0) console.log(`[LiveSync↑] ${sbTable} — ${upserted.length} record(s) envoyé(s)`)
          })
        }

        for (const item of deleted) {
          void sb.from(sbTable).delete().eq("id", item.id).then(({ error }) => {
            if (error) console.warn(`[LiveSync↑] delete ${sbTable}:`, error.message)
          })
        }
      } catch {
        // JSON invalide ou tableau vide — ignorer
      }
    }

    // ── 2. READ PATH : Supabase Realtime ───────────────────────────────────
    const channel = sb.channel("freshlink-erp-realtime-v2", {
      config: { broadcast: { self: false } },
    })

    for (const [lsKey, sbTable] of Object.entries(ERP_KEYS)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      channel.on("postgres_changes" as any,
        { event: "*", schema: "public", table: sbTable },
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          isRealtimeRef.current = true
          try {
            const raw = localStorage.getItem(lsKey)
            const current: Array<Record<string, unknown>> = raw ? JSON.parse(raw) : []
            const { eventType, new: newRec, old: oldRec } = payload
            let updated = current

            if (eventType === "INSERT" && newRec?.id && !current.some(r => r.id === newRec.id)) {
              updated = [...current, newRec]
            } else if (eventType === "UPDATE" && newRec?.id) {
              updated = current.map(r => r.id === newRec.id ? { ...r, ...newRec } : r)
            } else if (eventType === "DELETE" && oldRec?.id) {
              updated = current.filter(r => r.id !== oldRec.id)
            }

            if (updated !== current) {
              const json = JSON.stringify(updated)
              localStorage.setItem(lsKey, json)   // setItem est intercepté — flag isRealtime le bloque
              prevRef.current[lsKey] = json
              window.dispatchEvent(new CustomEvent("fl_store_updated", { detail: { table: sbTable } }))
              console.log(`[LiveSync↓] ${sbTable} — ${eventType}`)
            }
          } finally {
            isRealtimeRef.current = false
          }
        }
      )
    }

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[LiveSync] ✅ Supabase Realtime connecté — sync bidirectionnel actif")
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[LiveSync] ⚠️ Realtime:", status)
      }
    })

    // ── 3. Pousser les données localStorage existantes vers Supabase ────────
    // (tables vides au départ — premier push uniquement si Supabase est vide)
    void (async () => {
      try {
        for (const [lsKey, sbTable] of Object.entries(ERP_KEYS)) {
          const raw = localStorage.getItem(lsKey)
          if (!raw) continue
          const items: Array<Record<string, unknown>> = JSON.parse(raw)
          if (items.length === 0) continue

          // Vérifier si la table est vide dans Supabase
          const { data } = await sb.from(sbTable).select("id").limit(1)
          if (data && data.length > 0) continue  // table déjà peuplée — skip

          // Table vide → pousser les données localStorage
          console.log(`[LiveSync] Premier push ${sbTable} (${items.length} items)…`)
          await sb.from(sbTable).upsert(items, { onConflict: "id" })
        }
        console.log("[LiveSync] ✅ Données initiales synchronisées vers Supabase")
      } catch (e) {
        console.warn("[LiveSync] Sync initial:", e)
      }
    })()

    return () => {
      localStorage.setItem = originalSetItem
      sb.removeChannel(channel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>
}
