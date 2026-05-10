"use client"

import { useState, useEffect } from "react"
import { store, type User } from "@/lib/store"

interface Props { user: User }

const DH = (n: number) => n.toLocaleString("fr-MA", { maximumFractionDigits: 0 }) + " DH"

function getWeekRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr)
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1
  const monday = new Date(d); monday.setDate(d.getDate() - day)
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  return { start: monday.toISOString().split("T")[0], end: sunday.toISOString().split("T")[0] }
}

function getMonthRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr)
  const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0]
  return { start, end }
}

function ProgressRing({ pct, color }: { pct: number; color: string }) {
  const r = 34; const c = 2 * Math.PI * r
  const dash = Math.min(pct / 100, 1) * c
  return (
    <svg width="80" height="80" className="-rotate-90">
      <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-muted/30" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
    </svg>
  )
}

function PctRing({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <ProgressRing pct={pct} color={color} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-extrabold text-foreground">{pct}%</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground text-center font-medium">{label}</p>
    </div>
  )
}

function BarRow({ label, value, max, color, unit }: { label: string; value: number; max: number; color: string; unit?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const isOver = value >= max && max > 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-bold ${isOver ? "text-emerald-600" : "text-foreground"}`}>
          {unit === "dh" ? `${DH(value)} / ${DH(max)}` : `${value} / ${max}`}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export default function MobileObjectifs({ user }: Props) {
  const [commandes, setCommandes] = useState(store.getCommandes())
  const today = store.today()
  const week = getWeekRange(today)
  const month = getMonthRange(today)

  useEffect(() => { setCommandes(store.getCommandes()) }, [])

  const myCommandes = commandes.filter(c => c.commercialId === user.id)
  const cdJ = myCommandes.filter(c => c.date === today)
  const cdW = myCommandes.filter(c => c.date >= week.start && c.date <= week.end)
  const cdM = myCommandes.filter(c => c.date >= month.start && c.date <= month.end)

  const caJ = cdJ.reduce((s, c) => s + c.lignes.reduce((ls, l) => ls + l.quantite * l.prixVente, 0), 0)
  const caW = cdW.reduce((s, c) => s + c.lignes.reduce((ls, l) => ls + l.quantite * l.prixVente, 0), 0)
  const caM = cdM.reduce((s, c) => s + c.lignes.reduce((ls, l) => ls + l.quantite * l.prixVente, 0), 0)
  const clientsJ = new Set(cdJ.map(c => c.clientId)).size
  const clientsW = new Set(cdW.map(c => c.clientId)).size
  const clientsM = new Set(cdM.map(c => c.clientId)).size

  const hasCA = (user.objectifJournalierCA ?? 0) > 0 || (user.objectifHebdomadaireCA ?? 0) > 0 || (user.objectifMensuelCA ?? 0) > 0
  const hasClients = (user.objectifJournalierClients ?? 0) > 0 || (user.objectifHebdomadaireClients ?? 0) > 0 || (user.objectifMensuelClients ?? 0) > 0

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Title */}
      <div>
        <h2 className="text-base font-bold text-foreground">Mon Bilan / ملخصي</h2>
        <p className="text-xs text-muted-foreground">{today}</p>
      </div>

      {/* Quick today cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: "Aujourd'hui", v: DH(caJ), c: "text-sky-600", bg: "bg-sky-50 border-sky-200" },
          { l: "Semaine",     v: DH(caW), c: "text-violet-600", bg: "bg-violet-50 border-violet-200" },
          { l: "Mois",        v: DH(caM), c: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
        ].map(k => (
          <div key={k.l} className={`${k.bg} border rounded-xl p-3 text-center`}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">{k.l}</p>
            <p className={`text-sm font-extrabold ${k.c} mt-0.5`}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* Rings row */}
      {hasCA && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">Objectifs CA</h3>
          <div className="flex justify-around">
            <PctRing value={caJ} max={user.objectifJournalierCA ?? 0} label="Journalier" color="#0ea5e9" />
            <PctRing value={caW} max={user.objectifHebdomadaireCA ?? 0} label="Hebdo" color="#8b5cf6" />
            <PctRing value={caM} max={user.objectifMensuelCA ?? 0} label="Mensuel" color="#10b981" />
          </div>
        </div>
      )}

      {/* CA bars */}
      {hasCA && (
        <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Détail CA (DH)</h3>
          <BarRow label="Journalier" value={caJ} max={user.objectifJournalierCA ?? 0} color="#0ea5e9" unit="dh" />
          <BarRow label="Hebdomadaire" value={caW} max={user.objectifHebdomadaireCA ?? 0} color="#8b5cf6" unit="dh" />
          <BarRow label="Mensuel" value={caM} max={user.objectifMensuelCA ?? 0} color="#10b981" unit="dh" />
        </div>
      )}

      {/* Clients bars */}
      {hasClients && (
        <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Clients visités</h3>
          <BarRow label="Journalier" value={clientsJ} max={user.objectifJournalierClients ?? 0} color="#0ea5e9" />
          <BarRow label="Hebdomadaire" value={clientsW} max={user.objectifHebdomadaireClients ?? 0} color="#8b5cf6" />
          <BarRow label="Mensuel" value={clientsM} max={user.objectifMensuelClients ?? 0} color="#10b981" />
        </div>
      )}

      {!hasCA && !hasClients && (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <svg className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm text-muted-foreground font-semibold">Aucun objectif défini</p>
          <p className="text-xs text-muted-foreground mt-1">Demandez à votre responsable de définir vos objectifs.</p>
        </div>
      )}

      {/* Recent commandes */}
      {cdM.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Mes commandes ce mois ({cdM.length})</p>
          </div>
          <div className="divide-y divide-border max-h-60 overflow-y-auto">
            {[...cdM].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map(c => {
              const total = c.lignes.reduce((s, l) => s + l.quantite * l.prixVente, 0)
              return (
                <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{c.clientNom}</p>
                    <p className="text-[10px] text-muted-foreground">{c.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-primary">{DH(total)}</p>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                      c.statut === "livre" ? "bg-green-100 text-green-700" :
                      c.statut === "valide" ? "bg-amber-100 text-amber-700" :
                      "bg-muted text-muted-foreground"}`}>
                      {c.statut}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
