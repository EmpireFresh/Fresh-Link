"use client"

import { useState, useEffect, useMemo } from "react"
import { store, type User, type Client, type Commande } from "@/lib/store"

interface Props {
  user: User
}

interface AlertItem {
  id: string
  type: "inactivity" | "credit" | "retard_paiement" | "objectif" | "visite_sans_commande"
  severity: "high" | "medium" | "low"
  title: string
  subtitle: string
  clientId?: string
  clientNom?: string
  value?: string | number
  icon: string
}

export default function MobileAlertes({ user }: Props) {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const alertConfig = store.getAlertConfig()
    const inactivityDays = alertConfig.inactivityDays ?? 30

    const allClients: Client[] = store.getClients().filter(c =>
      c.prevendeurId === user.id || !c.prevendeurId
    )
    const allCommandes: Commande[] = store.getCommandes()
    const allVisites = store.getVisites()

    const today = new Date()
    const generated: AlertItem[] = []

    // ── 1. Clients inactifs ──────────────────────────────────────────────────
    allClients.forEach(client => {
      const clientCmds = allCommandes
        .filter(c => c.clientId === client.id)
        .sort((a, b) => b.date.localeCompare(a.date))

      const lastCmd = clientCmds[0]
      if (!lastCmd) {
        generated.push({
          id: `inact_${client.id}`,
          type: "inactivity",
          severity: "high",
          title: client.nom,
          subtitle: "Aucune commande enregistrée — client jamais commandé",
          clientId: client.id,
          clientNom: client.nom,
          value: "Jamais",
          icon: "⚠️",
        })
        return
      }

      const lastDate = new Date(lastCmd.date)
      const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

      if (diffDays >= inactivityDays) {
        generated.push({
          id: `inact_${client.id}`,
          type: "inactivity",
          severity: diffDays >= inactivityDays * 2 ? "high" : "medium",
          title: client.nom,
          subtitle: `Dernière commande il y a ${diffDays} jour${diffDays > 1 ? "s" : ""}`,
          clientId: client.id,
          clientNom: client.nom,
          value: `J-${diffDays}`,
          icon: "🕐",
        })
      }
    })

    // ── 2. Crédit / encours dépassé ──────────────────────────────────────────
    allClients.forEach(client => {
      const solde = client.creditSolde ?? 0
      const plafond = client.plafondCredit ?? 0
      if (solde > 0 && plafond > 0 && solde >= plafond * 0.9) {
        generated.push({
          id: `credit_${client.id}`,
          type: "credit",
          severity: solde >= plafond ? "high" : "medium",
          title: client.nom,
          subtitle: solde >= plafond
            ? `Plafond dépassé — ${solde.toLocaleString("fr-MA")} DH / ${plafond.toLocaleString("fr-MA")} DH`
            : `90% du plafond atteint — ${solde.toLocaleString("fr-MA")} / ${plafond.toLocaleString("fr-MA")} DH`,
          clientId: client.id,
          clientNom: client.nom,
          value: `${solde.toLocaleString("fr-MA")} DH`,
          icon: "💳",
        })
      } else if (solde > 500 && plafond === 0) {
        generated.push({
          id: `credit_nolimit_${client.id}`,
          type: "retard_paiement",
          severity: "low",
          title: client.nom,
          subtitle: `Solde impayé ${solde.toLocaleString("fr-MA")} DH — aucun plafond défini`,
          clientId: client.id,
          clientNom: client.nom,
          value: `${solde.toLocaleString("fr-MA")} DH`,
          icon: "💰",
        })
      }
    })

    // ── 3. Visites sans commande répétées cette semaine ──────────────────────
    const recentVisites = allVisites.filter(v => {
      if (v.prevendeurId !== user.id) return false
      if (v.resultat !== "sans_commande") return false
      const diffDays = Math.floor((today.getTime() - new Date(v.date).getTime()) / (1000 * 60 * 60 * 24))
      return diffDays <= 7
    })

    const visiteSansCmd: Record<string, number> = {}
    recentVisites.forEach(v => {
      visiteSansCmd[v.clientId] = (visiteSansCmd[v.clientId] ?? 0) + 1
    })

    Object.entries(visiteSansCmd).forEach(([clientId, count]) => {
      if (count >= 2) {
        const client = allClients.find(c => c.id === clientId)
        if (!client) return
        generated.push({
          id: `visite_${clientId}`,
          type: "visite_sans_commande",
          severity: count >= 3 ? "high" : "medium",
          title: client.nom,
          subtitle: `${count} visites sans commande en 7 jours`,
          clientId: client.id,
          clientNom: client.nom,
          value: `${count}×`,
          icon: "🚫",
        })
      }
    })

    // ── 4. Objectifs journaliers non atteints ────────────────────────────────
    const todayStr = today.toISOString().split("T")[0]
    const todayCmds = allCommandes.filter(c => c.date === todayStr && c.prevendeurId === user.id)
    const todayCA = todayCmds.reduce((s, c) => s + (c.montantTotal ?? 0), 0)
    const todayClients = new Set(todayCmds.map(c => c.clientId)).size
    const objCA = user.objectifJournalierCA ?? 0
    const objClients = user.objectifJournalierClients ?? 0

    if (objCA > 0) {
      const pct = Math.round((todayCA / objCA) * 100)
      if (pct < 70) {
        generated.push({
          id: "objectif_ca",
          type: "objectif",
          severity: pct < 40 ? "high" : "medium",
          title: "Objectif CA journalier",
          subtitle: `${todayCA.toLocaleString("fr-MA")} DH réalisés / ${objCA.toLocaleString("fr-MA")} DH visés`,
          value: `${pct}%`,
          icon: "📈",
        })
      }
    }

    if (objClients > 0 && todayClients < objClients) {
      const pct = Math.round((todayClients / objClients) * 100)
      generated.push({
        id: "objectif_clients",
        type: "objectif",
        severity: pct < 40 ? "high" : "low",
        title: "Objectif clients journalier",
        subtitle: `${todayClients} client${todayClients > 1 ? "s" : ""} commandé${todayClients > 1 ? "s" : ""} / objectif ${objClients}`,
        value: `${todayClients}/${objClients}`,
        icon: "👤",
      })
    }

    // Sort: high → medium → low
    const ORDER = { high: 0, medium: 1, low: 2 }
    generated.sort((a, b) => ORDER[a.severity] - ORDER[b.severity])

    setAlerts(generated)
    setLoading(false)
  }, [user])

  const filtered = useMemo(() =>
    filter === "all" ? alerts : alerts.filter(a => a.severity === filter),
    [alerts, filter]
  )

  const counts = useMemo(() => ({
    all: alerts.length,
    high: alerts.filter(a => a.severity === "high").length,
    medium: alerts.filter(a => a.severity === "medium").length,
    low: alerts.filter(a => a.severity === "low").length,
  }), [alerts])

  const SEVERITY_STYLE: Record<string, { bg: string; border: string; badge: string; label: string }> = {
    high:   { bg: "bg-red-50",   border: "border-red-200",   badge: "bg-red-100 text-red-700",    label: "Urgent" },
    medium: { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700", label: "Attention" },
    low:    { bg: "bg-blue-50",  border: "border-blue-200",  badge: "bg-blue-100 text-blue-700",   label: "Info" },
  }

  const TYPE_LABEL: Record<string, string> = {
    inactivity:           "Inactivité client",
    credit:               "Crédit & Encours",
    retard_paiement:      "Impayé",
    objectif:             "Objectif journalier",
    visite_sans_commande: "Visite sans commande",
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Analyse des alertes…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-base text-foreground">Alertes & Rappels</h2>
          <p className="text-xs text-muted-foreground">
            {counts.all === 0
              ? "Aucune alerte active"
              : `${counts.all} alerte${counts.all > 1 ? "s" : ""} · ${counts.high > 0 ? `${counts.high} urgent${counts.high > 1 ? "es" : "e"}` : "aucune urgente"}`
            }
          </p>
        </div>
        {counts.high > 0 && (
          <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center animate-pulse">
            {counts.high}
          </span>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
        {(["all", "high", "medium", "low"] as const).map(f => {
          const LABELS = { all: "Toutes", high: "Urgent", medium: "Attention", low: "Info" }
          const ACTIVE = {
            all:    "bg-slate-800 text-white",
            high:   "bg-red-600 text-white",
            medium: "bg-amber-500 text-white",
            low:    "bg-blue-600 text-white",
          }
          const IDLE = {
            all:    "bg-white border border-slate-200 text-slate-600",
            high:   "bg-white border border-red-200 text-red-600",
            medium: "bg-white border border-amber-200 text-amber-600",
            low:    "bg-white border border-blue-200 text-blue-600",
          }
          const isActive = filter === f
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${isActive ? ACTIVE[f] : IDLE[f]}`}
            >
              {LABELS[f]}
              {counts[f] > 0 && f !== "all" && (
                <span className="ml-1 opacity-75">({counts[f]})</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center text-3xl">
            ✅
          </div>
          <p className="font-semibold text-sm text-foreground">Tout est en ordre !</p>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            {filter === "all"
              ? "Aucune alerte active — vos clients sont bien suivis."
              : `Aucune alerte "${filter === "high" ? "urgente" : filter === "medium" ? "moyenne" : "info"}".`
            }
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(alert => {
            const s = SEVERITY_STYLE[alert.severity]
            return (
              <div key={alert.id}
                className={`${s.bg} ${s.border} border rounded-2xl p-4 flex items-start gap-3`}
              >
                <span className="text-xl shrink-0 mt-0.5">{alert.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-bold text-sm text-foreground leading-tight truncate pr-1">
                      {alert.title}
                    </p>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.badge}`}>
                        {s.label}
                      </span>
                      {alert.value != null && (
                        <span className="text-xs font-mono font-bold text-slate-700">{alert.value}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">{alert.subtitle}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-2 uppercase tracking-wider font-semibold">
                    {TYPE_LABEL[alert.type]}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer info */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mt-1">
        <p className="text-[10px] text-slate-500 leading-relaxed">
          <span className="font-semibold text-red-600">Urgent</span> = action immédiate ·{" "}
          <span className="font-semibold text-amber-600">Attention</span> = traiter sous 48h ·{" "}
          <span className="font-semibold text-blue-600">Info</span> = à surveiller
        </p>
        <p className="text-[10px] text-slate-400 mt-1">
          Seuil d&apos;inactivité : {store.getAlertConfig().inactivityDays}j · configurable dans Paramètres → Alertes
        </p>
      </div>

    </div>
  )
}
