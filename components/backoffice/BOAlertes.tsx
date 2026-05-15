"use client"

import { useState, useEffect, useCallback } from "react"
import { store, type Article, type Client, type Commande } from "@/lib/store"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type AlertSeverity = "critique" | "warning" | "info"
type AlertCategory = "stock" | "paiement" | "shelf_life" | "commande" | "credit"

interface Alert {
  id: string
  category: AlertCategory
  severity: AlertSeverity
  titre: string
  detail: string
  valeur?: string
  lien?: string  // tab cible dans le BO
  date?: string
}

function buildAlerts(
  articles: Article[],
  clients: Client[],
  commandes: Commande[],
  seuilStockBas: number,
  seuilShelfLife: number,
  seuilRetardJours: number,
): Alert[] {
  const alerts: Alert[] = []
  const today = new Date()

  // ── STOCK ─────────────────────────────────────────────────
  for (const a of articles) {
    if (!a.actif) continue
    const stock = Number(a.stock_disponible ?? 0)
    if (stock <= 0) {
      alerts.push({
        id: `stock-rupture-${a.id}`,
        category: "stock",
        severity: "critique",
        titre: `Rupture — ${a.nom}`,
        detail: "Stock épuisé",
        valeur: "0 kg",
        lien: "articles",
      })
    } else if (stock < seuilStockBas) {
      alerts.push({
        id: `stock-bas-${a.id}`,
        category: "stock",
        severity: "warning",
        titre: `Stock bas — ${a.nom}`,
        detail: `Seuil minimum atteint`,
        valeur: `${stock} ${a.unite ?? "kg"}`,
        lien: "articles",
      })
    }
  }

  // ── SHELF LIFE ────────────────────────────────────────────
  for (const a of articles) {
    if (!a.actif || !a.shelf_life_jours) continue
    const shelfLeft = Number(a.shelf_life_jours)
    if (shelfLeft <= 0) {
      alerts.push({
        id: `dlc-expire-${a.id}`,
        category: "shelf_life",
        severity: "critique",
        titre: `DLC expirée — ${a.nom}`,
        detail: "Produit périmé — retrait immédiat",
        valeur: `J+${shelfLeft}`,
        lien: "shelf_life",
      })
    } else if (shelfLeft <= seuilShelfLife) {
      alerts.push({
        id: `dlc-proche-${a.id}`,
        category: "shelf_life",
        severity: "warning",
        titre: `DLC proche — ${a.nom}`,
        detail: `Expire dans ${shelfLeft} jour(s)`,
        valeur: `J+${shelfLeft}`,
        lien: "shelf_life",
      })
    }
  }

  // ── CRÉDIT / RETARD PAIEMENT ──────────────────────────────
  for (const c of clients) {
    const solde = Number(c.creditSolde ?? 0)
    const plafond = Number(c.plafondCredit ?? 0)
    if (!c.creditAutorise) continue
    if (solde > 0 && plafond > 0 && solde >= plafond * 0.9) {
      alerts.push({
        id: `credit-plafond-${c.id}`,
        category: "credit",
        severity: solde >= plafond ? "critique" : "warning",
        titre: `Crédit saturé — ${c.nom}`,
        detail: solde >= plafond ? "Plafond dépassé" : `90% du plafond atteint`,
        valeur: `${solde.toLocaleString("fr-MA")} / ${plafond.toLocaleString("fr-MA")} DH`,
        lien: "cash",
      })
    }
  }

  // ── COMMANDES EN RETARD ────────────────────────────────────
  for (const cmd of commandes) {
    if (!["confirmee", "en_preparation", "en_attente"].includes(cmd.statut ?? "")) continue
    const cmdDate = new Date(cmd.date ?? cmd.createdAt ?? "")
    if (isNaN(cmdDate.getTime())) continue
    const joursRetard = Math.floor((today.getTime() - cmdDate.getTime()) / 86_400_000)
    if (joursRetard >= seuilRetardJours) {
      const clientNom = (cmd as Record<string, unknown>).clientNom as string ?? cmd.clientId ?? "?"
      alerts.push({
        id: `cmd-retard-${cmd.id}`,
        category: "commande",
        severity: joursRetard >= seuilRetardJours * 2 ? "critique" : "warning",
        titre: `Commande en retard — ${clientNom}`,
        detail: `Statut : ${cmd.statut} — ${joursRetard}j sans livraison`,
        valeur: `${joursRetard}j`,
        lien: "commercial",
        date: cmd.date ?? cmd.createdAt,
      })
    }
  }

  // Tri : critique d'abord, puis warning, puis info
  const ORDER: Record<AlertSeverity, number> = { critique: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => ORDER[a.severity] - ORDER[b.severity])
}

// ─────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────
const SEV_COLORS: Record<AlertSeverity, { bg: string; border: string; dot: string; badge: string; text: string }> = {
  critique: { bg: "bg-red-50",     border: "border-red-200",   dot: "bg-red-500",   badge: "bg-red-100 text-red-700",   text: "text-red-800" },
  warning:  { bg: "bg-amber-50",   border: "border-amber-200", dot: "bg-amber-400", badge: "bg-amber-100 text-amber-700", text: "text-amber-800" },
  info:     { bg: "bg-blue-50",    border: "border-blue-200",  dot: "bg-blue-400",  badge: "bg-blue-100 text-blue-700",  text: "text-blue-800" },
}

const CAT_LABELS: Record<AlertCategory, string> = {
  stock: "Stock", paiement: "Paiement", shelf_life: "DLC", commande: "Commande", credit: "Crédit",
}

const CAT_ICONS: Record<AlertCategory, string> = {
  stock:    "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  paiement: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
  shelf_life:"M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  commande: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  credit:   "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
}

function AlertCard({ alert, onNavigate }: { alert: Alert; onNavigate: (tab: string) => void }) {
  const c = SEV_COLORS[alert.severity]
  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${c.bg} ${c.border}`}>
      <div className="shrink-0 mt-0.5">
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${c.badge}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={CAT_ICONS[alert.category]} />
          </svg>
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-semibold ${c.text} leading-tight`}>{alert.titre}</p>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${c.badge}`}>
            {CAT_LABELS[alert.category]}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{alert.detail}</p>
        {alert.valeur && (
          <p className={`text-xs font-bold mt-1 ${c.text}`}>{alert.valeur}</p>
        )}
      </div>
      {alert.lien && (
        <button
          onClick={() => onNavigate(alert.lien!)}
          className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-2 transition-colors">
          Voir →
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
interface Props {
  onNavigate?: (tab: string) => void
}

export default function BOAlertes({ onNavigate }: Props) {
  const [alerts, setAlerts]           = useState<Alert[]>([])
  const [lastUpdate, setLastUpdate]   = useState<Date>(new Date())
  const [filterCat, setFilterCat]     = useState<AlertCategory | "all">("all")
  const [filterSev, setFilterSev]     = useState<AlertSeverity | "all">("all")

  // ── Config seuils ─────────────────────────────────────────
  const [seuilStock,    setSeuilStock]    = useState(50)
  const [seuilShelf,    setSeuilShelf]    = useState(3)
  const [seuilRetard,   setSeuilRetard]   = useState(2)
  const [showConfig,    setShowConfig]    = useState(false)

  const refresh = useCallback(() => {
    const articles  = store.getArticles()
    const clients   = store.getClients()
    const commandes = store.getCommandes()
    setAlerts(buildAlerts(articles, clients, commandes, seuilStock, seuilShelf, seuilRetard))
    setLastUpdate(new Date())
  }, [seuilStock, seuilShelf, seuilRetard])

  useEffect(() => { refresh() }, [refresh])

  // Rafraîchir sur fl_store_updated
  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener("fl_store_updated", handler)
    return () => window.removeEventListener("fl_store_updated", handler)
  }, [refresh])

  // Auto-refresh toutes les 5 minutes
  useEffect(() => {
    const timer = setInterval(refresh, 5 * 60_000)
    return () => clearInterval(timer)
  }, [refresh])

  const filtered = alerts.filter(a => {
    if (filterCat !== "all" && a.category !== filterCat) return false
    if (filterSev !== "all" && a.severity !== filterSev) return false
    return true
  })

  const countBySev = (s: AlertSeverity) => alerts.filter(a => a.severity === s).length
  const critiques  = countBySev("critique")
  const warnings   = countBySev("warning")

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Centre d'Alertes
            {critiques > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                {critiques} critique{critiques > 1 ? "s" : ""}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Mis à jour : {lastUpdate.toLocaleTimeString("fr-MA")} — {alerts.length} alerte{alerts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualiser
          </button>
          <button
            onClick={() => setShowConfig(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${showConfig ? "bg-slate-800 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-600"}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Seuils
          </button>
        </div>
      </div>

      {/* ── Config seuils ─────────────────────────────────── */}
      {showConfig && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Stock bas (kg)</label>
            <input type="number" min={1} value={seuilStock} onChange={e => setSeuilStock(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            <p className="text-[10px] text-slate-400 mt-1">Alerte si stock {"<"} ce seuil</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">DLC imminente (jours)</label>
            <input type="number" min={1} value={seuilShelf} onChange={e => setSeuilShelf(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            <p className="text-[10px] text-slate-400 mt-1">Alerte si DLC {"<"} N jours</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Retard commande (jours)</label>
            <input type="number" min={1} value={seuilRetard} onChange={e => setSeuilRetard(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            <p className="text-[10px] text-slate-400 mt-1">Alerte si commande {">"} N jours sans livraison</p>
          </div>
          <div className="sm:col-span-3">
            <button onClick={refresh}
              className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition-colors">
              Appliquer les seuils
            </button>
          </div>
        </div>
      )}

      {/* ── Résumé ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { label: "Critiques",  count: critiques,       bg: "bg-red-50 border-red-200",    text: "text-red-700",    dot: "bg-red-500"   },
          { label: "Warnings",   count: warnings,         bg: "bg-amber-50 border-amber-200", text: "text-amber-700",  dot: "bg-amber-400" },
          { label: "Total",      count: alerts.length,   bg: "bg-slate-50 border-slate-200", text: "text-slate-700",  dot: "bg-slate-400" },
        ] as const).map(s => (
          <div key={s.label} className={`flex items-center gap-2 p-3 rounded-xl border ${s.bg}`}>
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
            <div>
              <p className={`text-xl font-bold ${s.text}`}>{s.count}</p>
              <p className="text-[10px] text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filtres ────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {(["all", "stock", "shelf_life", "commande", "credit"] as const).map(cat => (
          <button key={cat}
            onClick={() => setFilterCat(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filterCat === cat ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {cat === "all" ? "Toutes" : CAT_LABELS[cat as AlertCategory]}
          </button>
        ))}
        <span className="w-px bg-slate-200 mx-1" />
        {(["all", "critique", "warning"] as const).map(sev => (
          <button key={sev}
            onClick={() => setFilterSev(sev)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filterSev === sev ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {sev === "all" ? "Tous niveaux" : sev.charAt(0).toUpperCase() + sev.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Liste alertes ─────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-bold text-slate-700">Aucune alerte active</p>
          <p className="text-sm text-slate-400 mt-1">Tout est en ordre ✓</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => (
            <AlertCard key={a.id} alert={a} onNavigate={onNavigate ?? (() => {})} />
          ))}
        </div>
      )}
    </div>
  )
}
