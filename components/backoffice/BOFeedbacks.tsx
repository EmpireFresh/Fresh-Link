"use client"

import { useEffect, useState, useCallback } from "react"

// ══════════════════════════════════════════════════════════════════
//  BOFeedbacks — Liste centralisée des avis (mobile → fl_feedbacks → BO)
//  Polling 15s + bouton Refresh manuel + filtres statut/note
// ══════════════════════════════════════════════════════════════════

interface Feedback {
  id: string
  auteur_id: string | null
  auteur_nom: string | null
  auteur_role: string | null
  note: number | null
  categorie: string | null
  message: string
  statut: "nouveau" | "en_cours" | "traite" | "ferme"
  source: string | null
  created_at: string
}

const STATUT_CONFIG: Record<string, { label: string; cls: string; icon: string }> = {
  nouveau:  { label: "Nouveau",  cls: "bg-blue-100 text-blue-800 border-blue-300",         icon: "🆕" },
  en_cours: { label: "En cours", cls: "bg-amber-100 text-amber-800 border-amber-300",      icon: "⏳" },
  traite:   { label: "Traité",   cls: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: "✅" },
  ferme:    { label: "Fermé",    cls: "bg-slate-100 text-slate-700 border-slate-300",      icon: "🔒" },
}

export default function BOFeedbacks() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatut, setFilterStatut] = useState<string>("tous")
  const [filterNote, setFilterNote] = useState<number>(0) // 0 = toutes
  const [error, setError] = useState<string>("")

  const load = useCallback(async () => {
    try {
      const url = filterStatut !== "tous"
        ? `/api/ext/feedbacks?statut=${encodeURIComponent(filterStatut)}`
        : "/api/ext/feedbacks"
      const res = await fetch(url, { cache: "no-store" })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? "Erreur de chargement")
      setFeedbacks(data.data ?? [])
      setError("")
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [filterStatut])

  // Chargement initial + polling toutes les 15s
  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [load])

  // Filtre note côté client (l'API renvoie tout, on filtre localement)
  const list = feedbacks
    .filter(f => filterNote === 0 || f.note === filterNote)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  const stats = {
    total:    feedbacks.length,
    nouveau:  feedbacks.filter(f => f.statut === "nouveau").length,
    enCours:  feedbacks.filter(f => f.statut === "en_cours").length,
    traite:   feedbacks.filter(f => f.statut === "traite").length,
    noteAvg:  feedbacks.length > 0
      ? (feedbacks.reduce((s, f) => s + (f.note ?? 0), 0) / feedbacks.length).toFixed(1)
      : "—",
  }

  const renderStars = (n: number | null) => {
    if (n == null) return "—"
    return "★".repeat(Math.max(0, n)) + "☆".repeat(Math.max(0, 5 - n))
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span className="text-2xl">💬</span>
            Feedbacks & Avis terrain
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Centralisation des avis mobile (prévendeurs, livreurs, clients) — sync live toutes les 15s.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Rafraîchir
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total",     value: stats.total,    icon: "📊", cls: "bg-slate-50 border-slate-200" },
          { label: "Nouveaux",  value: stats.nouveau,  icon: "🆕", cls: "bg-blue-50 border-blue-200" },
          { label: "En cours",  value: stats.enCours,  icon: "⏳", cls: "bg-amber-50 border-amber-200" },
          { label: "Traités",   value: stats.traite,   icon: "✅", cls: "bg-emerald-50 border-emerald-200" },
          { label: "Note /5",   value: stats.noteAvg,  icon: "⭐", cls: "bg-yellow-50 border-yellow-200" },
        ].map(k => (
          <div key={k.label} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${k.cls}`}>
            <span className="text-2xl">{k.icon}</span>
            <div>
              <p className="text-2xl font-black text-foreground leading-none">{k.value}</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-0.5">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <select
          value={filterStatut}
          onChange={e => setFilterStatut(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer">
          <option value="tous">📋 Tous statuts</option>
          <option value="nouveau">🆕 Nouveaux</option>
          <option value="en_cours">⏳ En cours</option>
          <option value="traite">✅ Traités</option>
          <option value="ferme">🔒 Fermés</option>
        </select>
        <select
          value={filterNote}
          onChange={e => setFilterNote(Number(e.target.value))}
          className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer">
          <option value={0}>⭐ Toutes notes</option>
          <option value={5}>★★★★★</option>
          <option value={4}>★★★★☆</option>
          <option value={3}>★★★☆☆</option>
          <option value={2}>★★☆☆☆</option>
          <option value={1}>★☆☆☆☆</option>
        </select>
        <span className="ml-auto text-xs text-slate-500">
          {list.length} avis affichés
        </span>
      </div>

      {/* Erreur */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <span className="inline-block w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mr-2 align-middle" />
          Chargement des feedbacks…
        </div>
      )}

      {/* Liste */}
      {!loading && list.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <span className="text-5xl">💬</span>
          <p className="text-sm font-medium mt-3">Aucun feedback dans ce filtre</p>
          <p className="text-xs mt-1 text-slate-400">Les avis remonteront automatiquement depuis le mobile.</p>
        </div>
      )}

      {!loading && list.length > 0 && (
        <div className="flex flex-col gap-3">
          {list.map(f => {
            const cfg = STATUT_CONFIG[f.statut] ?? STATUT_CONFIG.nouveau
            const date = new Date(f.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
            return (
              <div key={f.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div>
                    <p className="font-bold text-foreground text-sm">{f.auteur_nom ?? "Anonyme"}</p>
                    <p className="text-[11px] text-slate-500">
                      {f.auteur_role ?? "—"} · {date} · {f.source ?? "mobile"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-500 text-sm font-bold tracking-tight">{renderStars(f.note)}</span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${cfg.cls}`}>
                      <span>{cfg.icon}</span>{cfg.label}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{f.message}</p>
                {f.categorie && (
                  <div className="mt-2">
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600">
                      {f.categorie}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
