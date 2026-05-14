"use client"

// ============================================================
// FreshLink — useFirebaseArchive
// Hook React pour gérer les archives Firebase depuis le back-office.
// ============================================================

import { useState, useCallback, useEffect } from "react"
import { isFirebaseConfigured } from "./client"
import {
  archiveOldRecords, restoreFromArchive, deleteArchive,
  getAllArchiveStats, countArchived,
  type ArchivableTable, type ArchiveStats, type ArchiveResult,
} from "./archive"

export type { ArchivableTable, ArchiveStats, ArchiveResult }

export interface ArchiveOperation {
  id: string
  type: "archive" | "restore" | "delete"
  table: ArchivableTable
  status: "running" | "done" | "error"
  progress: string[]
  result?: ArchiveResult | { restored: number; errors: number } | number
  startedAt: Date
  endedAt?: Date
}

export function useFirebaseArchive() {
  const [configured, setConfigured] = useState(false)
  const [stats, setStats] = useState<ArchiveStats[]>([])
  const [loadingStats, setLoadingStats] = useState(false)
  const [operations, setOperations] = useState<ArchiveOperation[]>([])

  useEffect(() => {
    setConfigured(isFirebaseConfigured())
  }, [])

  const refreshStats = useCallback(async () => {
    if (!isFirebaseConfigured()) return
    setLoadingStats(true)
    try {
      const s = await getAllArchiveStats()
      setStats(s)
    } finally {
      setLoadingStats(false)
    }
  }, [])

  // Charge les stats au montage
  useEffect(() => {
    if (isFirebaseConfigured()) refreshStats()
  }, [refreshStats])

  // ── Helpers ──────────────────────────────────────────────────

  function newOp(type: ArchiveOperation["type"], table: ArchivableTable): string {
    const id = `${type}_${table}_${Date.now()}`
    const op: ArchiveOperation = {
      id, type, table, status: "running",
      progress: [], startedAt: new Date(),
    }
    setOperations(prev => [op, ...prev.slice(0, 19)])
    return id
  }

  function updateOp(id: string, patch: Partial<ArchiveOperation>) {
    setOperations(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o))
  }

  function pushProgress(id: string, msg: string) {
    setOperations(prev =>
      prev.map(o => o.id === id
        ? { ...o, progress: [...o.progress, msg] }
        : o
      )
    )
  }

  // ── Archive ───────────────────────────────────────────────────

  const archive = useCallback(async (
    table: ArchivableTable,
    olderThanMonths: number,
    deleteFromSource: boolean
  ) => {
    const id = newOp("archive", table)
    try {
      const result = await archiveOldRecords({
        table,
        olderThanMonths,
        deleteFromSource,
        onProgress: (msg) => pushProgress(id, msg),
      })
      updateOp(id, { status: "done", result, endedAt: new Date() })
      await refreshStats()
      return result
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      updateOp(id, { status: "error", endedAt: new Date() })
      pushProgress(id, `Erreur : ${msg}`)
      return null
    }
  }, [refreshStats])

  // ── Restore ───────────────────────────────────────────────────

  const restore = useCallback(async (
    table: ArchivableTable,
    maxRecords: number
  ) => {
    const id = newOp("restore", table)
    try {
      const result = await restoreFromArchive({
        table,
        maxRecords,
        onProgress: (msg) => pushProgress(id, msg),
      })
      updateOp(id, { status: "done", result, endedAt: new Date() })
      await refreshStats()
      return result
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      updateOp(id, { status: "error", endedAt: new Date() })
      pushProgress(id, `Erreur : ${msg}`)
      return null
    }
  }, [refreshStats])

  // ── Delete archive ────────────────────────────────────────────

  const deleteArch = useCallback(async (table: ArchivableTable) => {
    const id = newOp("delete", table)
    try {
      const deleted = await deleteArchive(table, (msg) => pushProgress(id, msg))
      updateOp(id, { status: "done", result: deleted, endedAt: new Date() })
      await refreshStats()
      return deleted
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      updateOp(id, { status: "error", endedAt: new Date() })
      pushProgress(id, `Erreur : ${msg}`)
      return null
    }
  }, [refreshStats])

  // ── Comptage rapide d'une seule table ─────────────────────────

  const countTable = useCallback(async (table: ArchivableTable) => {
    return countArchived(table)
  }, [])

  return {
    configured,
    stats,
    loadingStats,
    operations,
    refreshStats,
    archive,
    restore,
    deleteArch,
    countTable,
  }
}
