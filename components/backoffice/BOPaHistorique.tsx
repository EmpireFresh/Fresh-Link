"use client"

import { useEffect, useState, useCallback } from "react"

// ══════════════════════════════════════════════════════════════════
//  BOPaHistorique — Section 5
//   Saisie quotidienne des PA marché de gros + visualisation tendance
//   Alimente fl_pa_historique → fonction SQL fl_pa_predit (pricing dynamique)
// ══════════════════════════════════════════════════════════════════

interface PaEntry {
  id: string
  article_id: string
  fournisseur_id: string | null
  pa: number
  volume_kg: number
  date_marche: string
  created_at: string
}

export default function BOPaHistorique() {
  const [entries, setEntries] = useState<PaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [filterArticle, setFilterArticle] = useState("")
  const [predit, setPredit] = useState<{ article: string; value: number } | null>(null)
  const [preditLoading, setPreditLoading] = useState(false)

  const [form, setForm] = useState({
    articleId: "",
    fournisseurId: "",
    pa: 0,
    volumeKg: 0,
    dateMarche: new Date().toISOString().slice(0, 10),
  })

  const load = useCallback(async () => {
    try {
      const url = filterArticle.trim()
        ? `/api/ext/pa-historique?article=${encodeURIComponent(filterArticle.trim())}`
        : "/api/ext/pa-historique"
      const res = await fetch(url, { cache: "no-store" })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? "Erreur de chargement")
      setEntries(data.data ?? [])
      setError("")
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [filterArticle])

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const submit = async () => {
    if (!form.articleId.trim()) { setError("Article ID requis"); return }
    if (form.pa <= 0)            { setError("PA doit être > 0"); return }
    setBusy(true)
    try {
      const res = await fetch("/api/ext/pa-historique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (!d.ok) throw new Error(d.error)
      setForm({ articleId: form.articleId, fournisseurId: "", pa: 0, volumeKg: 0, dateMarche: new Date().toISOString().slice(0, 10) })
      await load()
      setError("")
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm("Supprimer cette saisie PA ?")) return
    setEntries(prev => prev.filter(x => x.id !== id))
    try { await fetch(`/api/ext/pa-historique?id=${encodeURIComponent(id)}`, { method: "DELETE" }) }
    catch (e) { setError(String(e)); load() }
  }

  const calcPredit = async () => {
    if (!filterArticle.trim()) { setError("Filtre par article pour calculer le PA prédit"); return }
    setPreditLoading(true)
    try {
      const res = await fetch("/api/ext/commercial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pa_predit", article: filterArticle.trim() }),
      })
      const d = await res.json()
      if (!d.ok) throw new Error(d.error)
      setPredit({ article: filterArticle.trim(), value: Number(d.paPredit ?? 0) })
    } catch (e) {
      setError(String(e))
    } finally {
      setPreditLoading(false)
    }
  }

  const fmtMad   = (n: number) => `${n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`
  const fmtDate  = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })

  // KPIs
  const nbEntries  = entries.length
  const nbArticles = new Set(entries.map(e => e.article_id)).size
  const dernier    = entries[0]
  const moyenne    = entries.length > 0 ? entries.reduce((s, e) => s + e.pa, 0) / entries.length : 0

  // Mini-graphique sparkline si filtre actif
  const seriesForChart = filterArticle.trim()
    ? [...entries].sort((a, b) => a.date_marche.localeCompare(b.date_marche)).slice(-20)
    : []
  const chartW = 360, chartH = 80, chartPadY = 8
  const renderSparkline = () => {
    if (seriesForChart.length < 2) return null
    const values = seriesForChart.map(e => e.pa)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = Math.max(0.0001, max - min)
    const stepX = chartW / Math.max(1, seriesForChart.length - 1)
    const points = seriesForChart.map((e, i) => {
      const x = i * stepX
      const y = chartPadY + (chartH - 2 * chartPadY) * (1 - (e.pa - min) / range)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(" ")
    const last = values[values.length - 1]
    const first = values[0]
    const variation = first === 0 ? 0 : ((last - first) / first) * 100
    const trendUp = variation >= 0
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tendance · {seriesForChart.length} pts</p>
            <p className="text-sm font-bold text-slate-700">{filterArticle.trim()}</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-black ${trendUp ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
            {trendUp ? "▲" : "▼"} {Math.abs(variation).toFixed(1)}%
          </div>
        </div>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-20">
          <defs>
            <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={trendUp ? "#fb7185" : "#10b981"} stopOpacity="0.35" />
              <stop offset="100%" stopColor={trendUp ? "#fb7185" : "#10b981"} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline
            points={`0,${chartH} ${points} ${chartW},${chartH}`}
            fill="url(#sparkline-grad)"
            stroke="none"
          />
          <polyline
            points={points}
            fill="none"
            stroke={trendUp ? "#e11d48" : "#059669"}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
          <span>Min {fmtMad(min)}</span>
          <span className="font-bold text-slate-700">Actuel {fmtMad(last)}</span>
          <span>Max {fmtMad(max)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header premium */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b3d1a] via-[#1a4f2a] to-[#2d7a46] p-6 sm:p-7 shadow-xl">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-fuchsia-400/15 blur-2xl" />
        <div className="absolute -left-8 -bottom-12 w-40 h-40 rounded-full bg-emerald-400/10 blur-2xl" />
        <div className="relative flex items-start justify-between flex-wrap gap-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/12 backdrop-blur-sm flex items-center justify-center text-3xl shadow-lg shrink-0">📈</div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-black text-white tracking-tight">PA Historique — Marché de Gros</h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-400/15 border border-emerald-300/30 text-emerald-100 text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  Alimente fl_pa_predit
                </span>
              </div>
              <p className="text-sm text-emerald-50/85 mt-1.5 max-w-2xl leading-relaxed">
                Saisie quotidienne des prix d'achat constatés. Plus tu remplis → meilleur le PA prédit → pricing dynamique plus précis.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Saisies",            value: nbEntries,                            icon: "📋", grad: "from-blue-500 to-blue-600",     ring: "ring-blue-200" },
          { label: "Articles couverts",  value: nbArticles,                           icon: "📦", grad: "from-emerald-500 to-green-600", ring: "ring-emerald-200" },
          { label: "PA moyen",           value: nbEntries > 0 ? fmtMad(moyenne) : "—",icon: "💰", grad: "from-amber-500 to-orange-600",  ring: "ring-amber-200" },
          { label: "Dernière saisie",    value: dernier ? fmtDate(dernier.date_marche) : "—", icon: "🕒", grad: "from-fuchsia-500 to-purple-600", ring: "ring-fuchsia-200" },
        ].map(s => (
          <div key={s.label} className={`group relative overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 ring-1 ${s.ring}`}>
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${s.grad}`} />
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.grad} flex items-center justify-center text-xl shadow-sm shrink-0`}>
                <span className="drop-shadow-sm">{s.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-lg font-black text-slate-900 leading-none tabular-nums truncate">{s.value}</p>
                <p className="text-[11px] font-bold text-slate-600 mt-1">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">⚠️ {error}</div>
      )}

      {/* Formulaire de saisie rapide */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-black text-slate-900 mb-4">➕ Saisir un PA marché</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-700">Article ID</label>
            <input
              value={form.articleId}
              onChange={e => setForm(f => ({ ...f, articleId: e.target.value.trim() }))}
              placeholder="VFP00046"
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-700">Fournisseur ID (optionnel)</label>
            <input
              value={form.fournisseurId}
              onChange={e => setForm(f => ({ ...f, fournisseurId: e.target.value.trim() }))}
              placeholder="VFS00001"
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-700">PA constaté (MAD/kg)</label>
            <input
              type="number" min={0} step="0.01"
              value={form.pa}
              onChange={e => setForm(f => ({ ...f, pa: Number(e.target.value) || 0 }))}
              placeholder="3.50"
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-700">Volume (kg)</label>
            <input
              type="number" min={0}
              value={form.volumeKg}
              onChange={e => setForm(f => ({ ...f, volumeKg: Number(e.target.value) || 0 }))}
              placeholder="500"
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-700">Date marché</label>
            <input
              type="date"
              value={form.dateMarche}
              onChange={e => setForm(f => ({ ...f, dateMarche: e.target.value }))}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="mt-4 w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-bold hover:shadow-lg hover:shadow-emerald-200 transition-all disabled:opacity-60">
          {busy ? "⏳ Enregistrement…" : "💾 Enregistrer le PA"}
        </button>
      </div>

      {/* Filtre + PA prédit */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <span className="text-xs font-bold text-slate-700 whitespace-nowrap">🔍 Filtrer par article :</span>
          <input
            value={filterArticle}
            onChange={e => setFilterArticle(e.target.value)}
            placeholder="VFP00046 (vide = tout)"
            className="flex-1 min-w-[120px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <button
          type="button"
          onClick={calcPredit}
          disabled={preditLoading || !filterArticle.trim()}
          className="px-4 py-2 rounded-xl bg-fuchsia-600 text-white text-xs font-bold hover:bg-fuchsia-700 disabled:opacity-60 transition-colors">
          {preditLoading ? "⏳ Calcul…" : "🔮 Calculer PA prédit"}
        </button>
      </div>

      {predit && (
        <div className="px-4 py-3 rounded-2xl bg-fuchsia-50 border border-fuchsia-200 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[11px] font-bold text-fuchsia-700 uppercase tracking-wider">PA prédit (SQL fl_pa_predit)</p>
            <p className="text-xs text-fuchsia-700/80">Article <code className="font-mono bg-fuchsia-100 px-1 rounded">{predit.article}</code></p>
          </div>
          <p className="text-3xl font-black text-fuchsia-800 tabular-nums">{fmtMad(predit.value)}</p>
        </div>
      )}

      {/* Sparkline */}
      {seriesForChart.length >= 2 && renderSparkline()}

      {loading && (
        <div className="text-center py-10 text-slate-500 text-sm">
          <span className="inline-block w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin align-middle mr-2" />
          Chargement…
        </div>
      )}

      {/* Liste */}
      {!loading && entries.length === 0 && (
        <div className="text-center py-12 px-6 bg-white rounded-2xl border border-slate-200">
          <div className="text-5xl mb-3">📈</div>
          <p className="text-sm font-bold text-slate-700">Aucune saisie</p>
          <p className="text-xs text-slate-500 mt-1">{filterArticle.trim() ? "pour cet article" : "Saisis ton premier PA marché ci-dessus."}</p>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="text-left px-4 py-2.5 font-bold text-[11px] uppercase tracking-wider">Date marché</th>
                <th className="text-left px-4 py-2.5 font-bold text-[11px] uppercase tracking-wider">Article</th>
                <th className="text-left px-4 py-2.5 font-bold text-[11px] uppercase tracking-wider">Fournisseur</th>
                <th className="text-right px-3 py-2.5 font-bold text-[11px] uppercase tracking-wider">PA (MAD/kg)</th>
                <th className="text-right px-3 py-2.5 font-bold text-[11px] uppercase tracking-wider">Volume (kg)</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.slice(0, 200).map(e => (
                <tr key={e.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 text-slate-700">{fmtDate(e.date_marche)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{e.article_id}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{e.fournisseur_id ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-900 tabular-nums">{fmtMad(e.pa)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-700 tabular-nums">{e.volume_kg.toLocaleString("fr-MA")}</td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => remove(e.id)}
                      aria-label="Supprimer"
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 flex items-center justify-center text-xs">
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length > 200 && (
            <p className="px-4 py-2 text-[10px] text-slate-400 border-t border-slate-100">
              Affichage limité aux 200 dernières saisies sur {entries.length}.
            </p>
          )}
        </div>
      )}

      <p className="text-[10px] text-slate-400 text-center">
        🔄 Sync auto 30s · Les données alimentent automatiquement <code className="font-mono">fl_pa_predit()</code> pour le pricing dynamique.
      </p>
    </div>
  )
}
