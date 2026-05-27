"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@/lib/store"

// ── Types ──────────────────────────────────────────────────────────────────────
interface DeviceRequest {
  id: string
  device_id: string
  nom: string | null
  telephone: string | null
  statut: "en_attente" | "autorise" | "bloque"
  gps_lat: number | null
  gps_lng: number | null
  gps_precision: number | null
  user_agent: string | null
  first_visit_at: string | null
  updated_at: string | null
  autorise_par: string | null
  autorise_at: string | null
  notes: string | null
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props { user: User }

// ── Statut config ──────────────────────────────────────────────────────────────
const STATUT: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  en_attente: { label: "En attente",  bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-400" },
  autorise:   { label: "Autorisé",    bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500" },
  bloque:     { label: "Bloqué",      bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500"   },
}

function fmt(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function canAccess(user: User) {
  return ["super_super_admin", "super_admin", "admin"].includes(user.role)
}

// ── Composant ─────────────────────────────────────────────────────────────────
export default function BODeviceAccess({ user }: Props) {
  const [rows,    setRows]    = useState<DeviceRequest[]>([])
  const [filter,  setFilter]  = useState<"tous" | "en_attente" | "autorise" | "bloque">("en_attente")
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState<{ ok: boolean; text: string } | null>(null)
  const [search,  setSearch]  = useState("")

  const sb = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await sb
      .from("fl_site_access")
      .select("*")
      .order("first_visit_at", { ascending: false })
    if (!error && data) setRows(data as DeviceRequest[])
    setLoading(false)
  }, [sb])

  useEffect(() => { load() }, [load])

  // ── Auto-refresh toutes les 30s ────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  // ── Actions ────────────────────────────────────────────────────────────────
  async function setStatut(deviceId: string, statut: "autorise" | "bloque", nom: string | null) {
    const now = new Date().toISOString()
    const update: Record<string, unknown> = {
      statut,
      updated_at: now,
      autorise_par: user.name ?? user.email ?? "Jawad",
    }
    if (statut === "autorise") update.autorise_at = now
    if (statut === "bloque")   update.bloque_at   = now

    const { error } = await sb
      .from("fl_site_access")
      .update(update)
      .eq("device_id", deviceId)

    if (error) {
      setMsg({ ok: false, text: `Erreur : ${error.message}` })
    } else {
      const action = statut === "autorise" ? "✅ Autorisé" : "🚫 Bloqué"
      setMsg({ ok: true, text: `${action} — ${nom ?? deviceId.slice(0, 12)}` })
      setTimeout(() => setMsg(null), 4000)
      load()
    }
  }

  async function deleteRow(deviceId: string) {
    if (!confirm("Supprimer cette demande ?")) return
    await sb.from("fl_site_access").delete().eq("device_id", deviceId)
    load()
  }

  if (!canAccess(user)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-sm text-gray-500">Accès réservé aux administrateurs.</p>
        </div>
      </div>
    )
  }

  // ── Filtrage ───────────────────────────────────────────────────────────────
  const filtered = rows.filter(r => {
    if (filter !== "tous" && r.statut !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        (r.nom ?? "").toLowerCase().includes(q) ||
        (r.telephone ?? "").includes(q) ||
        r.device_id.includes(q)
      )
    }
    return true
  })

  const counts = {
    tous:       rows.length,
    en_attente: rows.filter(r => r.statut === "en_attente").length,
    autorise:   rows.filter(r => r.statut === "autorise").length,
    bloque:     rows.filter(r => r.statut === "bloque").length,
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* En-tête */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            🛡️ Accès Appareils
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Gérez les demandes d'accès à FreshLink Pro
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700 transition-all"
        >
          {loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : "🔄"} Actualiser
        </button>
      </div>

      {/* Message */}
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold ${msg.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg.text}
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(["tous", "en_attente", "autorise", "bloque"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
              filter === f
                ? f === "en_attente" ? "bg-amber-500 text-white border-amber-500"
                : f === "autorise"   ? "bg-green-500 text-white border-green-500"
                : f === "bloque"     ? "bg-red-500 text-white border-red-500"
                : "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            {f === "tous" ? "Tous" : STATUT[f]?.label}
            {" "}
            <span className="opacity-70">({counts[f]})</span>
          </button>
        ))}

        {/* Recherche */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Nom, téléphone, device ID..."
          className="ml-auto px-3 py-1.5 rounded-full text-xs border border-gray-200 outline-none focus:border-blue-400 w-48"
        />
      </div>

      {/* Alerte en attente */}
      {counts.en_attente > 0 && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2">
          <span className="text-lg">⏳</span>
          <span>
            <strong>{counts.en_attente} demande{counts.en_attente > 1 ? "s" : ""}</strong> en attente d'approbation.
          </span>
        </div>
      )}

      {/* Liste */}
      {loading && rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          Aucune demande {filter !== "tous" ? `avec statut "${STATUT[filter]?.label}"` : ""}.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(row => {
            const s = STATUT[row.statut] ?? STATUT.en_attente
            const hasGps = row.gps_lat != null && row.gps_lng != null
            const mapsUrl = hasGps
              ? `https://maps.google.com/?q=${row.gps_lat!.toFixed(6)},${row.gps_lng!.toFixed(6)}`
              : null

            return (
              <div
                key={row.id}
                className={`rounded-2xl border p-4 md:p-5 transition-all ${
                  row.statut === "en_attente"
                    ? "border-amber-200 bg-white shadow-sm"
                    : row.statut === "autorise"
                    ? "border-green-200 bg-green-50/30"
                    : "border-red-200 bg-red-50/30 opacity-80"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Statut badge */}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${s.bg} ${s.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>
                        {s.label}
                      </span>
                      <span className="text-base font-black text-gray-900">
                        {row.nom ?? <span className="text-gray-400 italic">Inconnu</span>}
                      </span>
                      {row.telephone && (
                        <a
                          href={`https://wa.me/${row.telephone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-green-600 font-semibold hover:underline"
                        >
                          📱 {row.telephone}
                        </a>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-gray-500">
                      <span>🕒 Demande : {fmt(row.first_visit_at)}</span>
                      {row.autorise_at && <span>✅ Autorisé : {fmt(row.autorise_at)}</span>}
                      {row.autorise_par && <span>👤 Par : {row.autorise_par}</span>}
                      <span className="font-mono truncate">🔑 {row.device_id.slice(0, 20)}...</span>
                    </div>

                    {/* GPS */}
                    {hasGps && (
                      <div className="mt-2 flex items-center gap-2">
                        <a
                          href={mapsUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-all"
                        >
                          📍 Voir sur Maps
                          {row.gps_precision && <span className="opacity-60">± {Math.round(row.gps_precision)}m</span>}
                        </a>
                      </div>
                    )}

                    {/* User agent (tronqué) */}
                    {row.user_agent && (
                      <p className="mt-1.5 text-[11px] text-gray-400 truncate max-w-xs">
                        {row.user_agent}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {row.statut !== "autorise" && (
                      <button
                        onClick={() => setStatut(row.device_id, "autorise", row.nom)}
                        className="px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-bold transition-all shadow-sm"
                      >
                        ✅ Autoriser
                      </button>
                    )}
                    {row.statut !== "bloque" && (
                      <button
                        onClick={() => setStatut(row.device_id, "bloque", row.nom)}
                        className="px-4 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold transition-all"
                      >
                        🚫 Bloquer
                      </button>
                    )}
                    <button
                      onClick={() => deleteRow(row.device_id)}
                      className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold transition-all"
                    >
                      🗑️ Supprimer
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
