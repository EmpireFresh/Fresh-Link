"use client"

// ============================================================
// FreshLink Pro — LiveSyncProvider v3 (JSONB payload)
//
// ARCHITECTURE SYNC :
//   Chaque table Supabase a le schéma :
//     id TEXT PRIMARY KEY, payload JSONB, updated_at TIMESTAMPTZ
//
//   WRITE PATH  : localStorage.setItem intercepté →
//     diff old/new → upsert { id, payload: item } vers Supabase
//
//   READ PATH   : Supabase Realtime →
//     event reçu → extraire payload.payload (l'objet réel) →
//     mettre à jour localStorage → dispatche fl_store_updated
//
//   BOOTSTRAP   : au mount, si table Supabase vide → push local data
//
//   ANTI-LOOP   : isRealtimeRef empêche le re-push des écritures
//                 Realtime → localStorage vers Supabase
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
  fl_depots:           "fl_depots",
  fl_livreurs:         "fl_livreurs",
  fl_demandes_achat:   "fl_demandes_achat",
  fl_notices:          "fl_notices",
  fl_non_achats:       "fl_non_achats",
}

// Clés à IGNORER (sessions, config UI — ne pas pousser vers Supabase)
const IGNORED_KEYS = new Set([
  "fl_session", "fl_caisse", "fl_caisse_pricing", "fl_email_config",
  "fl_company", "fl_company_contacts", "fl_workflow_config",
  "fl_process_config", "fl_contenants_tare", "fl_inventory_logs",
  "fl_rh_notifications", "fl_salaries", "fl_paiements_salaires",
  "fl_reserve_snaps", "fl_caisses_mouvements", "fl_caisses_vides",
  "fl_actionnaires", "fl_charges", "fl_account_requests",
  "fl_web_integration", "fl_supabase_synced_v1",
])

// ── Helpers JSONB ──────────────────────────────────────────────────────────────
// Chaque ligne Supabase = { id, payload: <objet complet>, updated_at }
// Cela évite tout mismatch de colonnes (camelCase vs snake_case).

function toRow(item: Record<string, unknown>) {
  return {
    id:      item.id as string,
    payload: item,
    updated_at: new Date().toISOString(),
  }
}

function fromRow(row: Record<string, unknown>): Record<string, unknown> {
  // Si le row a un champ payload (schéma JSONB) → utiliser payload
  // Sinon fallback sur le row lui-même (compatibilité ancien schéma)
  if (row.payload && typeof row.payload === "object") {
    return row.payload as Record<string, unknown>
  }
  return row
}

export default function LiveSyncProvider({ children }: { children?: React.ReactNode }) {
  const isRealtimeRef = useRef(false)
  const prevRef       = useRef<Record<string, string>>({})
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

      if (isRealtimeRef.current) return   // écriture venant de Realtime — ne pas re-pousser
      if (IGNORED_KEYS.has(key)) return

      const sbTable = ERP_KEYS[key]
      if (!sbTable) return

      const prevValue = prevRef.current[key]
      prevRef.current[key] = value

      try {
        const newItems  = JSON.parse(value) as Array<Record<string, unknown>>
        const prevItems: Array<Record<string, unknown>> = prevValue ? JSON.parse(prevValue) : []

        // Diff : trouver items ajoutés ou modifiés
        const prevMap = new Map(prevItems.map(i => [i.id, JSON.stringify(i)]))
        const newSet  = new Set(newItems.map(i => i.id))

        const upserted = newItems.filter(item =>
          !prevMap.has(item.id) || prevMap.get(item.id) !== JSON.stringify(item)
        )
        const deleted = prevItems.filter(i => !newSet.has(i.id))

        if (upserted.length > 0) {
          // Envoyer { id, payload: item } — schéma JSONB universel
          const rows = upserted.map(toRow)
          void sb.from(sbTable).upsert(rows, { onConflict: "id" }).then(({ error }) => {
            if (error) console.warn(`[LiveSync↑] upsert ${sbTable}:`, error.message)
            else console.log(`[LiveSync↑] ${sbTable} — ${upserted.length} envoyé(s)`)
          })
        }

        for (const item of deleted) {
          void sb.from(sbTable).delete().eq("id", item.id as string).then(({ error }) => {
            if (error) console.warn(`[LiveSync↑] delete ${sbTable}:`, error.message)
          })
        }
      } catch {
        // JSON invalide — ignorer
      }
    }

    // ── 2. READ PATH : Supabase Realtime ───────────────────────────────────
    const channel = sb.channel("freshlink-erp-realtime-v3", {
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
            const { eventType, new: newRow, old: oldRow } = payload

            // Extraire l'objet réel depuis le payload JSONB
            const newRec = newRow ? fromRow(newRow) : null
            const oldId  = oldRow?.id as string | undefined

            let updated = current

            if (eventType === "INSERT" && newRec?.id && !current.some(r => r.id === newRec.id)) {
              updated = [...current, newRec]
            } else if (eventType === "UPDATE" && newRec?.id) {
              updated = current.map(r => r.id === newRec.id ? { ...r, ...newRec } : r)
            } else if (eventType === "DELETE" && oldId) {
              updated = current.filter(r => r.id !== oldId)
            }

            if (updated !== current) {
              const json = JSON.stringify(updated)
              originalSetItem(lsKey, json)         // bypass intercepteur (flag déjà actif)
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
        console.log("[LiveSync] ✅ Realtime connecté — sync bidirectionnel actif (JSONB v3)")
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[LiveSync] ⚠️ Realtime:", status)
      }
    })

    // ── 3. Bootstrap : charger Supabase → localStorage au démarrage ─────────
    // Si Supabase a des données (d'un autre appareil), les charger localement
    void (async () => {
      try {
        for (const [lsKey, sbTable] of Object.entries(ERP_KEYS)) {
          const { data, error } = await sb.from(sbTable).select("id, payload").limit(500)
          if (error || !data || data.length === 0) continue

          // Convertir les rows Supabase en objets localStorage
          const sbItems = data.map(fromRow).filter(r => r && r.id)

          // Fusionner avec localStorage : priorité aux données Supabase
          const raw = localStorage.getItem(lsKey)
          const localItems: Array<Record<string, unknown>> = raw ? JSON.parse(raw) : []
          const localMap = new Map(localItems.map(i => [i.id, i]))

          // Items de Supabase écrasent le local (source de vérité = Supabase)
          for (const item of sbItems) {
            localMap.set(item.id as string, item)
          }

          // Aussi pousser les items locaux absents de Supabase
          const sbIds = new Set(sbItems.map(i => i.id as string))
          const localOnly = localItems.filter(i => !sbIds.has(i.id as string))
          if (localOnly.length > 0) {
            const rows = localOnly.map(toRow)
            void sb.from(sbTable).upsert(rows, { onConflict: "id" })
          }

          const merged = Array.from(localMap.values())
          const json = JSON.stringify(merged)
          originalSetItem(lsKey, json)
          prevRef.current[lsKey] = json
        }

        window.dispatchEvent(new CustomEvent("fl_store_updated", { detail: { table: "all" } }))
        console.log("[LiveSync] ✅ Bootstrap sync terminé")
      } catch (e) {
        console.warn("[LiveSync] Bootstrap sync:", e)
      }
    })()

    return () => {
      localStorage.setItem = originalSetItem
      sb.removeChannel(channel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>
}
