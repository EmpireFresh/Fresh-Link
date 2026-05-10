"use client"

/**
 * Data Integrity Guard — Empire Fresh
 *
 * Runs once on application startup to detect and recover from corrupted
 * localStorage entries before any component tries to read them.
 *
 * Strategy: non-destructive first — report everything; only purge entries
 * that are completely unparseable (invalid JSON or wrong type), so the
 * store falls back cleanly to its built-in defaults.
 */

// ── Known localStorage keys and their human-readable labels ───────────────────

interface StorageKeySpec {
  readonly key: string
  readonly label: string
  /** When true, the value is a plain object (not an array). */
  readonly isObject?: boolean
}

const STORAGE_KEY_SPECS: readonly StorageKeySpec[] = [
  { key: "fl_users",              label: "Utilisateurs" },
  { key: "fl_clients",            label: "Clients" },
  { key: "fl_articles",           label: "Articles" },
  { key: "fl_depots",             label: "Dépôts" },
  { key: "fl_fournisseurs",       label: "Fournisseurs" },
  { key: "fl_commandes",          label: "Commandes" },
  { key: "fl_bons_livraison",     label: "Bons de livraison" },
  { key: "fl_bons_achat",         label: "Bons d'achat" },
  { key: "fl_retours",            label: "Retours" },
  { key: "fl_trips",              label: "Trips / Tournées" },
  { key: "fl_caisse",             label: "Mouvements caisse" },
  { key: "fl_receptions",         label: "Réceptions" },
  { key: "fl_visites",            label: "Visites prévendeur" },
  { key: "fl_grilles_salaire",    label: "Grilles salaire" },
  { key: "fl_fiches_payroll",     label: "Fiches payroll" },
  { key: "fl_regles_bonus",       label: "Règles bonus/malus" },
  { key: "fl_caisses_vides",      label: "Caisses vides" },
  { key: "fl_caisses_mouvements", label: "Mouvements caisses vides" },
  { key: "fl_motifs_retour",      label: "Motifs retour" },
  { key: "fl_company",            label: "Config société", isObject: true },
  { key: "fl_caisse_pricing",     label: "Tarifs caisse", isObject: true },
]

// ── Public types ──────────────────────────────────────────────────────────────

export type IntegrityIssueKind =
  | "corrupted_json"   // JSON.parse threw
  | "empty_string"     // raw value was "" or whitespace-only
  | "wrong_type"       // expected array, got object — or vice-versa

export interface IntegrityIssue {
  key: string
  label: string
  kind: IntegrityIssueKind
  action: "removed"
}

export interface IntegrityReport {
  /** ISO timestamp of when the check ran */
  checkedAt: string
  /** How many known keys were inspected */
  totalChecked: number
  /** How many keys were already missing (first-run normal) */
  missingKeys: number
  /** How many corrupted entries were removed and reset to defaults */
  corruptedFixed: number
  /** Detail of every issue found */
  issues: IntegrityIssue[]
}

// ── Core check ────────────────────────────────────────────────────────────────

/**
 * Inspects every known localStorage key for JSON validity and type correctness.
 * Corrupted or type-mismatched entries are removed so the store falls back to
 * its built-in defaults on the next read.
 *
 * Safe to call server-side — returns an empty report when `window` is absent.
 */
export function runDataIntegrityCheck(): IntegrityReport {
  const report: IntegrityReport = {
    checkedAt: new Date().toISOString(),
    totalChecked: STORAGE_KEY_SPECS.length,
    missingKeys: 0,
    corruptedFixed: 0,
    issues: [],
  }

  if (typeof window === "undefined") return report

  for (const spec of STORAGE_KEY_SPECS) {
    const raw = localStorage.getItem(spec.key)

    // Key not yet written — normal on first run, not an error
    if (raw === null) {
      report.missingKeys++
      continue
    }

    // Empty or whitespace-only value — remove it
    if (raw.trim() === "") {
      localStorage.removeItem(spec.key)
      report.corruptedFixed++
      report.issues.push({ key: spec.key, label: spec.label, kind: "empty_string", action: "removed" })
      continue
    }

    // Try parsing the JSON
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      // Completely unparseable — remove and fall back to store defaults
      localStorage.removeItem(spec.key)
      report.corruptedFixed++
      report.issues.push({ key: spec.key, label: spec.label, kind: "corrupted_json", action: "removed" })
      continue
    }

    // Type check: arrays vs plain objects
    if (!spec.isObject && !Array.isArray(parsed)) {
      localStorage.removeItem(spec.key)
      report.corruptedFixed++
      report.issues.push({ key: spec.key, label: spec.label, kind: "wrong_type", action: "removed" })
    } else if (spec.isObject && (Array.isArray(parsed) || typeof parsed !== "object" || parsed === null)) {
      localStorage.removeItem(spec.key)
      report.corruptedFixed++
      report.issues.push({ key: spec.key, label: spec.label, kind: "wrong_type", action: "removed" })
    }
  }

  return report
}

/**
 * Returns a user-friendly summary of an integrity report.
 * Returns null when no issues were found.
 */
export function summarizeIntegrityReport(report: IntegrityReport): string | null {
  if (report.corruptedFixed === 0) return null
  const labels = report.issues.map(i => i.label).join(", ")
  return `⚠️ Intégrité données : ${report.corruptedFixed} entrée(s) corrompue(s) réinitialisée(s) — ${labels}.`
}
