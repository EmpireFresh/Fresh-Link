"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@/lib/store"

interface Props { user: User }

interface CommandeWeb {
  id:                string
  numero:            string
  nom_client:        string
  telephone:         string
  email?:            string
  adresse_livraison?: string
  lignes:            LigneCommande[]
  montant_total:     number
  date_souhaitee?:   string
  creneau?:          string
  instructions?:     string
  statut:            string
  source:            string
  created_at:        string
  notes_admin?:      string
  traite_par?:       string
  traite_at?:        string
}

interface LigneCommande {
  articleId?:    string
  articleNom?:   string
  nom?:          string
  quantite:      number
  prixUnitaire?: number
  unite?:        string
  total?:        number
  montant?:      number
}

const STATUT_CFG: Record<string, { label: string; cls: string; icon: string }> = {
  nouveau:     { label: "Nouveau",     cls: "bg-blue-100 text-blue-700 border-blue-300",     icon: "🆕" },
  en_cours:    { label: "En cours",    cls: "bg-amber-100 text-amber-700 border-amber-300",   icon: "⏳" },
  prepare:     { label: "Préparé",     cls: "bg-purple-100 text-purple-700 border-purple-300",icon: "📦" },
  livre:       { label: "Livré",       cls: "bg-green-100 text-green-700 border-green-300",   icon: "✅" },
  annule:      { label: "Annulé",      cls: "bg-red-100 text-red-700 border-red-300",         icon: "❌" },
  en_attente:  { label: "En attente",  cls: "bg-slate-100 text-slate-600 border-slate-300",   icon: "🕐" },
}

function canAccess(u: User) {
  return ["super_super_admin","super_admin","admin","resp_commercial","resp_logistique","livreur"].includes(u.role)
}

function fmt(iso?: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function Badge({ statut }: { statut: string }) {
  const c = STATUT_CFG[statut] ?? { label: statut, cls: "bg-slate-100 text-slate-600 border-slate-300", icon: "•" }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${c.cls}`}>
      {c.icon} {c.label}
    </span>
  )
}

export default function BOCommandesWeb({ user }: Props) {
  const [commandes, setCommandes] = useState<CommandeWeb[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<string>("tous")
  const [search, setSearch]       = useState("")
  const [selected, setSelected]   = useState<CommandeWeb | null>(null)
  const [updating, setUpdating]   = useState(false)
  const [msg, setMsg]             = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sb = createClient()
      let q = sb.from("fl_commandes_web").select("*").order("created_at", { ascending: false })
      if (filter !== "tous") q = q.eq("statut", filter)
      const { data, error } = await q
      if (!error && data) setCommandes(data as CommandeWeb[])
    } catch { /* offline */ }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  // Auto-refresh toutes les 60 secondes
  useEffect(() => {
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [load])

  if (!canAccess(user)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-2xl">🔒</div>
        <p className="text-base font-semibold text-slate-700">Accès restreint</p>
      </div>
    )
  }

  const filtered = commandes.filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return c.nom_client.toLowerCase().includes(q) ||
           c.telephone.includes(q) ||
           c.numero.toLowerCase().includes(q)
  })

  const counts = commandes.reduce<Record<string, number>>((acc, c) => {
    acc[c.statut] = (acc[c.statut] ?? 0) + 1
    return acc
  }, {})

  const updateStatut = async (cmd: CommandeWeb, newStatut: string) => {
    setUpdating(true)
    try {
      const sb = createClient()
      const { error } = await sb
        .from("fl_commandes_web")
        .update({ statut: newStatut, traite_par: user.prenom + " " + user.nom, traite_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", cmd.id)
      if (error) throw error
      setMsg({ ok: true, text: `Statut mis à jour → ${STATUT_CFG[newStatut]?.label ?? newStatut}` })
      setSelected(prev => prev ? { ...prev, statut: newStatut } : null)
      load()
    } catch {
      setMsg({ ok: false, text: "Erreur lors de la mise à jour." })
    }
    setUpdating(false)
    setTimeout(() => setMsg(null), 3000)
  }

  const FILTER_TABS = [
    { key: "tous",     label: "Toutes",    count: commandes.length },
    { key: "nouveau",  label: "Nouvelles", count: counts.nouveau ?? 0 },
    { key: "en_cours", label: "En cours",  count: counts.en_cours ?? 0 },
    { key: "prepare",  label: "Préparées", count: counts.prepare ?? 0 },
    { key: "livre",    label: "Livrées",   count: counts.livre ?? 0 },
    { key: "annule",   label: "Annulées",  count: counts.annule ?? 0 },
  ]

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🛒 Commandes Web</h2>
          <p className="text-sm text-slate-500 mt-0.5">Commandes reçues depuis vitafresh.vercel.app</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Actualiser
        </button>
      </div>

      {/* Alerte */}
      {(counts.nouveau ?? 0) > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
          <span className="text-xl">🆕</span>
          <p className="text-sm font-semibold text-blue-700">
            {counts.nouveau} nouvelle{(counts.nouveau ?? 0) > 1 ? "s" : ""} commande{(counts.nouveau ?? 0) > 1 ? "s" : ""} en attente de traitement
          </p>
        </div>
      )}

      {/* Message */}
      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${msg.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg.text}
        </div>
      )}

      {/* Filtres + Search */}
      <div className="flex flex-wrap gap-2 items-center">
        {FILTER_TABS.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${filter === t.key ? "bg-green-600 text-white border-green-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            {t.label} {t.count > 0 && <span className={`ml-1 ${filter === t.key ? "opacity-80" : "text-slate-400"}`}>({t.count})</span>}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher client, tél, numéro…"
          className="ml-auto px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-green-400 bg-white w-56" />
      </div>

      {/* Liste commandes */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 text-slate-400">
          <span className="text-4xl">📭</span>
          <p className="text-sm font-medium">Aucune commande trouvée</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(cmd => (
            <div key={cmd.id}
              onClick={() => setSelected(cmd)}
              className={`bg-white border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all ${selected?.id === cmd.id ? "border-green-400 shadow-md ring-1 ring-green-200" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-sm">{cmd.nom_client}</span>
                    <span className="text-xs text-slate-400 font-mono">{cmd.numero}</span>
                    <Badge statut={cmd.statut} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    <span>📞 {cmd.telephone}</span>
                    {cmd.email && <span>✉️ {cmd.email}</span>}
                    {cmd.adresse_livraison && <span>📍 {cmd.adresse_livraison}</span>}
                    {cmd.date_souhaitee && <span>📅 {cmd.date_souhaitee}{cmd.creneau ? ` · ${cmd.creneau}` : ""}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>🕐 {fmt(cmd.created_at)}</span>
                    <span>·</span>
                    <span>{(cmd.lignes ?? []).length} article{(cmd.lignes ?? []).length > 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-700">{Number(cmd.montant_total).toFixed(2)} DH</p>
                  <p className="text-xs text-slate-400">{cmd.source}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer détail */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <p className="font-bold text-slate-800">{selected.nom_client}</p>
                <p className="text-xs text-slate-400 font-mono">{selected.numero}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">✕</button>
            </div>

            <div className="p-5 space-y-5">
              {/* Statut */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Statut</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUT_CFG).map(([k, v]) => (
                    <button key={k} disabled={updating || selected.statut === k}
                      onClick={() => updateStatut(selected, k)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${selected.statut === k ? `${v.cls} cursor-default` : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                      {v.icon} {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Infos client */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Client</p>
                <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-sm text-slate-700">
                  <p>📞 {selected.telephone}</p>
                  {selected.email && <p>✉️ {selected.email}</p>}
                  {selected.adresse_livraison && <p>📍 {selected.adresse_livraison}</p>}
                  {selected.date_souhaitee && <p>📅 Livraison souhaitée : {selected.date_souhaitee}{selected.creneau ? ` — ${selected.creneau}` : ""}</p>}
                  {selected.instructions && <p>💬 {selected.instructions}</p>}
                </div>
              </div>

              {/* Lignes */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Articles commandés</p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Article</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Qté</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">P.U.</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.lignes ?? []).map((l, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-700">{l.articleNom ?? l.nom ?? l.articleId ?? "—"}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{l.quantite} {l.unite ?? ""}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{l.prixUnitaire != null ? `${Number(l.prixUnitaire).toFixed(2)} DH` : "—"}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-800">{(l.total ?? l.montant) != null ? `${Number(l.total ?? l.montant).toFixed(2)} DH` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-green-50 border-t-2 border-green-200">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-sm font-bold text-slate-700">TOTAL</td>
                        <td className="px-3 py-2 text-right font-bold text-green-700 text-base">{Number(selected.montant_total).toFixed(2)} DH</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Meta */}
              <div className="text-xs text-slate-400 space-y-1 pt-1 border-t border-slate-100">
                <p>Reçue le {fmt(selected.created_at)}</p>
                {selected.traite_par && <p>Traitée par {selected.traite_par} le {fmt(selected.traite_at)}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
