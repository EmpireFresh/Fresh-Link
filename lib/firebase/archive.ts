"use client"

// ============================================================
// FreshLink — Firebase Archive Layer
// Archive les anciennes données Supabase vers Firestore pour
// libérer le quota free tier Supabase (500 MB DB).
//
// Collections Firestore miroir des tables Supabase :
//   archive_commandes, archive_bons_livraison, archive_trips,
//   archive_retours, archive_clients, archive_articles,
//   archive_visites
// ============================================================

import {
  collection, doc, setDoc, getDocs, deleteDoc,
  query, where, orderBy, limit, writeBatch,
  getCountFromServer, Timestamp,
} from "firebase/firestore"
import { getFirestoreDb, isFirebaseConfigured } from "./client"

export type ArchivableTable =
  | "commandes"
  | "bons_livraison"
  | "trips"
  | "retours"
  | "clients"
  | "articles"
  | "visites"

export interface ArchiveStats {
  table: ArchivableTable
  count: number
  oldestDate: string | null
  newestDate: string | null
}

export interface ArchiveResult {
  table: ArchivableTable
  archived: number
  errors: number
  deletedFromSupabase: boolean
}

// ── Utilitaires ───────────────────────────────────────────────

function firestoreCollection(table: ArchivableTable) {
  return collection(getFirestoreDb(), `archive_${table}`)
}

/** Convertit les Timestamps Firestore en strings ISO au retour */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeDoc(data: Record<string, any>): Record<string, any> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Timestamp) out[k] = v.toDate().toISOString()
    else out[k] = v
  }
  return out
}

// ── Comptage ──────────────────────────────────────────────────

export async function countArchived(table: ArchivableTable): Promise<number> {
  if (!isFirebaseConfigured()) return 0
  try {
    const snap = await getCountFromServer(firestoreCollection(table))
    return snap.data().count
  } catch {
    return 0
  }
}

export async function getAllArchiveStats(): Promise<ArchiveStats[]> {
  if (!isFirebaseConfigured()) return []
  const tables: ArchivableTable[] = [
    "commandes", "bons_livraison", "trips", "retours",
    "clients", "articles", "visites",
  ]
  const stats = await Promise.allSettled(tables.map(async (t) => {
    const count = await countArchived(t)
    return { table: t, count, oldestDate: null, newestDate: null } as ArchiveStats
  }))
  return stats
    .filter((r): r is PromiseFulfilledResult<ArchiveStats> => r.status === "fulfilled")
    .map(r => r.value)
}

// ── Archivage par batch ───────────────────────────────────────

/**
 * Archive une liste d'enregistrements dans Firestore.
 * Chaque item doit avoir un champ `id`.
 */
export async function archiveBatch(
  table: ArchivableTable,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  records: Record<string, any>[],
  meta?: Record<string, unknown>
): Promise<{ archived: number; errors: number }> {
  if (!isFirebaseConfigured()) throw new Error("Firebase non configuré")
  if (records.length === 0) return { archived: 0, errors: 0 }

  const db = getFirestoreDb()
  const col = firestoreCollection(table)
  const BATCH_SIZE = 450 // Firestore limite à 500 ops par batch
  let archived = 0
  let errors = 0
  const now = new Date().toISOString()

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)
    for (const record of chunk) {
      try {
        const ref = doc(col, record.id)
        batch.set(ref, {
          ...record,
          _archived_at: now,
          _archive_meta: meta ?? {},
        })
        archived++
      } catch {
        errors++
      }
    }
    await batch.commit()
  }
  return { archived, errors }
}

// ── Suppression depuis Supabase après archivage ───────────────

async function deleteFromSupabase(
  table: ArchivableTable,
  ids: string[]
): Promise<boolean> {
  if (ids.length === 0) return true
  try {
    const { createClient } = await import("@/lib/supabase/client")
    const sb = createClient()
    const tableMap: Record<ArchivableTable, string> = {
      commandes:       "fl_commandes",
      bons_livraison:  "fl_bons_livraison",
      trips:           "fl_trips",
      retours:         "fl_retours",
      clients:         "fl_clients",
      articles:        "fl_articles",
      visites:         "fl_visites",
    }
    const sbTable = tableMap[table]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb as any).from(sbTable).delete().in("id", ids)
    return !error
  } catch {
    return false
  }
}

// ── Archivage principal ───────────────────────────────────────

/**
 * Archive les enregistrements Supabase plus anciens que `olderThanMonths`
 * vers Firestore, puis (optionnellement) les supprime de Supabase.
 */
export async function archiveOldRecords(options: {
  table: ArchivableTable
  olderThanMonths: number
  deleteFromSource?: boolean
  onProgress?: (msg: string) => void
}): Promise<ArchiveResult> {
  const { table, olderThanMonths, deleteFromSource = false, onProgress } = options

  if (!isFirebaseConfigured()) {
    throw new Error("Firebase non configuré — ajoutez les variables NEXT_PUBLIC_FIREBASE_* dans .env.local")
  }

  onProgress?.(`Chargement des données ${table}…`)

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - olderThanMonths)
  const cutoffISO = cutoff.toISOString()

  // Récupère les anciennes données depuis Supabase
  let records: Record<string, unknown>[] = []
  try {
    const { createClient } = await import("@/lib/supabase/client")
    const sb = createClient()
    const tableMap: Record<ArchivableTable, string> = {
      commandes:       "fl_commandes",
      bons_livraison:  "fl_bons_livraison",
      trips:           "fl_trips",
      retours:         "fl_retours",
      clients:         "fl_clients",
      articles:        "fl_articles",
      visites:         "fl_visites",
    }
    const dateField: Record<ArchivableTable, string> = {
      commandes:       "date",
      bons_livraison:  "date",
      trips:           "date",
      retours:         "date",
      clients:         "created_at",
      articles:        "updated_at",
      visites:         "date",
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb as any)
      .from(tableMap[table])
      .select("*")
      .lt(dateField[table], cutoffISO)

    if (error) throw new Error(error.message)
    records = data ?? []
  } catch (e) {
    // Fallback sur localStorage
    onProgress?.("Supabase inaccessible — lecture depuis localStorage…")
    const { store } = await import("@/lib/store")
    const storeMap: Record<ArchivableTable, () => unknown[]> = {
      commandes:       () => store.getCommandes(),
      bons_livraison:  () => store.getBonsLivraison?.() ?? [],
      trips:           () => store.getTrips?.() ?? [],
      retours:         () => store.getRetours?.() ?? [],
      clients:         () => store.getClients(),
      articles:        () => store.getArticles(),
      visites:         () => store.getVisites?.() ?? [],
    }
    const allLocal = storeMap[table]() as Array<Record<string, unknown>>
    const dateField: Record<ArchivableTable, string> = {
      commandes: "date", bons_livraison: "date", trips: "date",
      retours: "date", clients: "createdAt", articles: "updatedAt", visites: "date",
    }
    records = allLocal.filter(r => {
      const d = r[dateField[table]] as string | undefined
      return d ? d < cutoffISO : false
    })
  }

  if (records.length === 0) {
    onProgress?.(`Aucune donnée à archiver (antérieure à ${olderThanMonths} mois)`)
    return { table, archived: 0, errors: 0, deletedFromSupabase: false }
  }

  onProgress?.(`${records.length} enregistrements à archiver dans Firestore…`)

  const { archived, errors } = await archiveBatch(table, records as Record<string, unknown>[], {
    source: "supabase",
    archivedBy: "freshlink-backoffice",
    olderThanMonths,
    cutoffDate: cutoffISO,
  })

  let deletedFromSupabase = false
  if (deleteFromSource && errors === 0 && archived > 0) {
    onProgress?.("Suppression des données archivées de Supabase…")
    const ids = records.map(r => r.id as string).filter(Boolean)
    deletedFromSupabase = await deleteFromSupabase(table, ids)
  }

  onProgress?.(`✓ ${archived} enregistrements archivés${deletedFromSupabase ? " et supprimés de Supabase" : ""}`)
  return { table, archived, errors, deletedFromSupabase }
}

// ── Restauration depuis Firebase vers Supabase ────────────────

export async function restoreFromArchive(options: {
  table: ArchivableTable
  maxRecords?: number
  onProgress?: (msg: string) => void
}): Promise<{ restored: number; errors: number }> {
  const { table, maxRecords = 500, onProgress } = options

  if (!isFirebaseConfigured()) {
    throw new Error("Firebase non configuré")
  }

  onProgress?.(`Chargement des archives ${table} depuis Firebase…`)

  const col = firestoreCollection(table)
  const q = maxRecords
    ? query(col, orderBy("_archived_at"), limit(maxRecords))
    : query(col, orderBy("_archived_at"))

  const snap = await getDocs(q)
  if (snap.empty) {
    onProgress?.("Aucune archive trouvée.")
    return { restored: 0, errors: 0 }
  }

  const records = snap.docs.map(d => {
    const data = normalizeDoc(d.data())
    delete data._archived_at
    delete data._archive_meta
    return data
  })

  onProgress?.(`${records.length} enregistrements à restaurer dans Supabase…`)

  const tableMap: Record<ArchivableTable, string> = {
    commandes:       "fl_commandes",
    bons_livraison:  "fl_bons_livraison",
    trips:           "fl_trips",
    retours:         "fl_retours",
    clients:         "fl_clients",
    articles:        "fl_articles",
    visites:         "fl_visites",
  }

  let restored = 0
  let errors = 0

  try {
    const { createClient } = await import("@/lib/supabase/client")
    const sb = createClient()
    const CHUNK = 50
    for (let i = 0; i < records.length; i += CHUNK) {
      const chunk = records.slice(i, i + CHUNK)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb as any)
        .from(tableMap[table])
        .upsert(chunk, { onConflict: "id" })
      if (error) { errors += chunk.length; continue }
      restored += chunk.length
    }
  } catch {
    errors = records.length
  }

  onProgress?.(`✓ ${restored} enregistrements restaurés${errors ? `, ${errors} erreurs` : ""}`)
  return { restored, errors }
}

// ── Suppression d'archives dans Firebase ──────────────────────

export async function deleteArchive(
  table: ArchivableTable,
  onProgress?: (msg: string) => void
): Promise<number> {
  if (!isFirebaseConfigured()) return 0

  const col = firestoreCollection(table)
  const snap = await getDocs(col)
  if (snap.empty) return 0

  const db = getFirestoreDb()
  const BATCH_SIZE = 450
  let deleted = 0

  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const chunk = snap.docs.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)
    for (const d of chunk) {
      batch.delete(d.ref)
      deleted++
    }
    await batch.commit()
  }

  onProgress?.(`✓ ${deleted} archives ${table} supprimées de Firebase`)
  return deleted
}

// ── Lecture des archives (consultation) ───────────────────────

export async function readArchive<T = Record<string, unknown>>(
  table: ArchivableTable,
  opts?: { maxRecords?: number }
): Promise<T[]> {
  if (!isFirebaseConfigured()) return []
  const col = firestoreCollection(table)
  const q = opts?.maxRecords
    ? query(col, orderBy("_archived_at", "desc"), limit(opts.maxRecords))
    : query(col, orderBy("_archived_at", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map(d => normalizeDoc(d.data()) as T)
}
