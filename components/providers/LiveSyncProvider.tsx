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
    console.log("[LiveSync] ✅ Intercepteur localStorage actif — sync vers Supabase en route")

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
        // Gérer à la fois les tableaux et les objets uniques
        const parsed = JSON.parse(value)
        const newItems: Array<Record<string, unknown>> = Array.isArray(parsed) ? parsed : [parsed]
        const prevItems: Array<Record<string, unknown>> = prevValue
          ? (Array.isArray(JSON.parse(prevValue)) ? JSON.parse(prevValue) : [JSON.parse(prevValue)])
          : []

        // Diff : trouver items ajoutés ou modifiés
        const prevMap = new Map(prevItems.map(i => [i.id, JSON.stringify(i)]))
        const newSet  = new Set(newItems.map(i => i.id))

        const upserted = newItems.filter(item =>
          item.id && (!prevMap.has(item.id) || prevMap.get(item.id) !== JSON.stringify(item))
        )
        const deleted = prevItems.filter(i => i.id && !newSet.has(i.id))

        if (upserted.length > 0) {
          const rows = upserted.map(toRow)
          console.log(`[LiveSync↑] Envoi ${sbTable} — ${upserted.length} item(s)`)
          void sb.from(sbTable).upsert(rows, { onConflict: "id" }).then(({ error }) => {
            if (error) console.error(`[LiveSync↑] ERREUR ${sbTable}:`, error.message, error)
            else console.log(`[LiveSync↑] ✅ ${sbTable} — ${upserted.length} sauvegardé(s) dans Supabase`)
          })
        }

        for (const item of deleted) {
          void sb.from(sbTable).delete().eq("id", item.id as string).then(({ error }) => {
            if (error) console.error(`[LiveSync↑] ERREUR delete ${sbTable}:`, error.message)
            else console.log(`[LiveSync↑] 🗑️ ${sbTable} — supprimé ${item.id}`)
          })
        }
      } catch {
        // JSON invalide (ex: valeur non-array) — ignorer silencieusement
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
        window.dispatchEvent(new CustomEvent("fl_supabase_status", { detail: "connected" }))
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[LiveSync] ⚠️ Realtime:", status)
        window.dispatchEvent(new CustomEvent("fl_supabase_status", { detail: "error" }))
      }
    })

    // ── 3. Bootstrap : sync bidirectionnel au démarrage ────────────────────
    void (async () => {
      let tablesFromSupabase = 0
      let itemsPushedToSupabase = 0

      try {
        for (const [lsKey, sbTable] of Object.entries(ERP_KEYS)) {
          try {
            const { data, error } = await sb.from(sbTable).select("id, payload").limit(1000)

            // Table n'existe pas encore → créer depuis localStorage
            if (error) {
              console.warn(`[LiveSync] Bootstrap — table ${sbTable} inaccessible:`, error.message)
              // Pousser les données locales vers Supabase
              const raw = localStorage.getItem(lsKey)
              if (raw) {
                const localItems: Array<Record<string, unknown>> = JSON.parse(raw)
                if (localItems.length > 0) {
                  const rows = localItems.filter(i => i.id).map(toRow)
                  const { error: pushErr } = await sb.from(sbTable).upsert(rows, { onConflict: "id" })
                  if (!pushErr) itemsPushedToSupabase += rows.length
                }
              }
              continue
            }

            const sbItems = (data ?? []).map(fromRow).filter(r => r && r.id)
            const raw = localStorage.getItem(lsKey)
            const localItems: Array<Record<string, unknown>> = raw ? JSON.parse(raw) : []

            // Merge : Supabase gagne en cas de conflit (source de vérité multi-appareils)
            const localMap = new Map(localItems.map(i => [i.id as string, i]))
            for (const item of sbItems) localMap.set(item.id as string, item)

            // Pousser vers Supabase les items locaux absents
            const sbIds = new Set(sbItems.map(i => i.id as string))
            const localOnly = localItems.filter(i => i.id && !sbIds.has(i.id as string))
            if (localOnly.length > 0) {
              const rows = localOnly.filter(i => i.id).map(toRow)
              const { error: pushErr } = await sb.from(sbTable).upsert(rows, { onConflict: "id" })
              if (!pushErr) itemsPushedToSupabase += rows.length
            }

            if (sbItems.length > 0) {
              const merged = Array.from(localMap.values())
              const json = JSON.stringify(merged)
              originalSetItem(lsKey, json)
              prevRef.current[lsKey] = json
              tablesFromSupabase++
            } else if (localItems.length > 0) {
              // Supabase vide, pousser tout le local
              const rows = localItems.filter(i => i.id).map(toRow)
              const { error: pushErr } = await sb.from(sbTable).upsert(rows, { onConflict: "id" })
              if (!pushErr) itemsPushedToSupabase += rows.length
            }
          } catch (tableErr) {
            console.warn(`[LiveSync] Bootstrap erreur ${sbTable}:`, tableErr)
          }
        }

        window.dispatchEvent(new CustomEvent("fl_store_updated", { detail: { table: "all" } }))
        console.log(`[LiveSync] ✅ Bootstrap terminé — ${tablesFromSupabase} tables depuis Supabase, ${itemsPushedToSupabase} items poussés vers Supabase`)
      } catch (e) {
        console.error("[LiveSync] Bootstrap erreur globale:", e)
      }
    })()

    return () => {
      localStorage.setItem = originalSetItem
      sb.removeChannel(channel)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>
}
