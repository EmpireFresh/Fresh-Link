"use client"

import { useState, useEffect, useCallback } from "react"
import { store, type User, type Client, type Fournisseur } from "@/lib/store"

interface Props { user: User }

const ALLOWED_ROLES = ["super_super_admin", "super_admin", "admin", "resp_commercial", "ctrl_achat"]

function genPassword(len = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#"
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map(b => chars[b % chars.length]).join("")
}

export default function BOComptesExternes({ user }: Props) {
  const [tab, setTab] = useState<"clients" | "fournisseurs">("clients")
  const [clients, setClients] = useState<Client[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState("")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [resetPwd, setResetPwd] = useState<{ userId: string; pwd: string } | null>(null)

  const reload = useCallback(() => {
    setClients(store.getClients())
    setFournisseurs(store.getFournisseurs())
    setUsers(store.getUsers())
  }, [])

  useEffect(() => { reload() }, [reload])

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text })
    setTimeout(() => setMsg(null), 3500)
  }

  const toggleActif = (userId: string) => {
    const all = store.getUsers()
    const idx = all.findIndex(u => u.id === userId)
    if (idx < 0) return
    all[idx].actif = !all[idx].actif
    store.saveUsers(all)
    setUsers([...all])
    flash(true, all[idx].actif ? "Compte activé." : "Compte désactivé.")
  }

  const handleResetPwd = (userId: string) => {
    const pwd = genPassword()
    const all = store.getUsers()
    const idx = all.findIndex(u => u.id === userId)
    if (idx < 0) return
    all[idx].password = pwd
    store.saveUsers(all)
    setUsers([...all])
    setResetPwd({ userId, pwd })
    flash(true, "Mot de passe réinitialisé.")
  }

  if (!ALLOWED_ROLES.includes(user.role) && !user.canViewExternal) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-5">
        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-foreground">Accès non autorisé</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Les comptes externes sont visibles uniquement par le <strong>Responsable Commercial</strong>, le <strong>Contrôleur Achat</strong> et les <strong>Administrateurs</strong>.
          </p>
        </div>
      </div>
    )
  }

  const getClientPortalUser  = (clientId: string)  => users.find(u => u.role === "client"      && u.clientId      === clientId)
  const getFournisseurPortalUser = (fId: string)    => users.find(u => u.role === "fournisseur" && u.fournisseurId  === fId)

  const filteredClients      = clients.filter(c =>
    c.nom.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.telephone ?? "").includes(search)
  )
  const filteredFournisseurs = fournisseurs.filter(f =>
    f.nom.toLowerCase().includes(search.toLowerCase()) ||
    (f.email ?? "").toLowerCase().includes(search.toLowerCase())
  )

  // Stats
  const clientsWithPortal      = clients.filter(c => getClientPortalUser(c.id)).length
  const fournisseursWithPortal = fournisseurs.filter(f => getFournisseurPortalUser(f.id)).length
  const totalPortal            = clientsWithPortal + fournisseursWithPortal
  const activePortal           = users.filter(u => (u.role === "client" || u.role === "fournisseur") && u.actif).length
  const inactivePortal         = users.filter(u => (u.role === "client" || u.role === "fournisseur") && !u.actif).length

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Comptes Externes <span className="text-muted-foreground font-normal text-base mr-1">/ الحسابات الخارجية</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Portails client et fournisseur — accès restreint aux administrateurs et commerciaux
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          Accès restreint
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Comptes portail",  value: totalPortal,            color: "bg-indigo-50 border-indigo-200 text-indigo-700" },
          { label: "Comptes actifs",   value: activePortal,           color: "bg-green-50 border-green-200 text-green-700" },
          { label: "Comptes inactifs", value: inactivePortal,         color: "bg-red-50 border-red-200 text-red-700" },
          { label: "Sans compte",      value: (clients.length + fournisseurs.length) - totalPortal, color: "bg-slate-50 border-slate-200 text-slate-600" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 flex flex-col gap-1 ${s.color}`}>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-xs font-semibold">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Flash message */}
      {msg && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border ${msg.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={msg.ok ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
          </svg>
          {msg.text}
        </div>
      )}

      {/* Reset password reveal */}
      {resetPwd && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-300 text-sm flex-wrap">
          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
          <span className="text-amber-800 font-medium">Nouveau mot de passe :</span>
          <code className="font-mono font-bold bg-amber-100 px-3 py-1 rounded-lg text-amber-900 tracking-wider">{resetPwd.pwd}</code>
          <span className="text-amber-600 text-xs">— Notez-le et communiquez-le à l&apos;utilisateur.</span>
          <button onClick={() => setResetPwd(null)} className="ml-auto text-amber-400 hover:text-amber-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </span>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, email, téléphone..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit">
        {[
          { id: "clients"      as const, label: `Clients (${filteredClients.length})`,           icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
          { id: "fournisseurs" as const, label: `Fournisseurs (${filteredFournisseurs.length})`, icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon} /></svg>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CLIENTS TAB ── */}
      {tab === "clients" && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800 text-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Type / Zone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Crédit</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Portail</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((c, i) => {
                  const pu = getClientPortalUser(c.id)
                  return (
                    <tr key={c.id} className={`border-t border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">{c.nom}</p>
                        {c.ice && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">ICE: {c.ice}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold capitalize">{c.type}</span>
                        <p className="text-xs text-muted-foreground mt-1">{c.secteur} / {c.zone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs">{c.telephone}</p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        {c.creditAutorise ? (
                          <div>
                            <span className="text-xs font-bold">{(c.creditSolde ?? 0).toLocaleString("fr-MA")} DH</span>
                            <p className="text-[10px] text-muted-foreground">Plafond: {(c.plafondCredit ?? 0).toLocaleString("fr-MA")} DH</p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Comptant</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {pu ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${pu.actif ? "bg-green-500" : "bg-red-400"}`} />
                              <span className={`text-xs font-bold ${pu.actif ? "text-green-700" : "text-red-600"}`}>
                                {pu.actif ? "Actif" : "Inactif"}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{pu.email}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                            Sans compte
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {pu ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => toggleActif(pu.id)}
                              title={pu.actif ? "Désactiver le compte" : "Activer le compte"}
                              className={`p-1.5 rounded-lg text-xs transition-colors ${pu.actif ? "hover:bg-red-50 hover:text-red-600 text-slate-400" : "hover:bg-green-50 hover:text-green-600 text-slate-400"}`}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={pu.actif ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleResetPwd(pu.id)}
                              title="Réinitialiser le mot de passe"
                              className="p-1.5 rounded-lg hover:bg-amber-50 hover:text-amber-600 text-slate-400 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                              </svg>
                            </button>
                          </div>
                        ) : <span className="text-xs text-slate-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
                {filteredClients.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">Aucun client trouvé</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── FOURNISSEURS TAB ── */}
      {tab === "fournisseurs" && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800 text-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Fournisseur</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Spécialités</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Paiement</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Portail</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFournisseurs.map((f, i) => {
                  const pu = getFournisseurPortalUser(f.id)
                  return (
                    <tr key={f.id} className={`border-t border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">{f.nom}</p>
                        {f.ice && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">ICE: {f.ice}</p>}
                        <p className="text-[10px] text-muted-foreground">{f.ville}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs">{f.telephone}</p>
                        <p className="text-xs text-muted-foreground">{f.email}</p>
                        {f.contact && <p className="text-[10px] text-muted-foreground italic">{f.contact}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {f.specialites.slice(0, 3).map(s => (
                            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{s}</span>
                          ))}
                          {f.specialites.length > 3 && <span className="text-[10px] text-muted-foreground">+{f.specialites.length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold capitalize">{f.modalitePaiement?.replace("_", " ") ?? "—"}</p>
                        {f.delaiPaiement && <p className="text-[10px] text-muted-foreground">{f.delaiPaiement}j</p>}
                      </td>
                      <td className="px-4 py-3">
                        {pu ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${pu.actif ? "bg-green-500" : "bg-red-400"}`} />
                              <span className={`text-xs font-bold ${pu.actif ? "text-green-700" : "text-red-600"}`}>
                                {pu.actif ? "Actif" : "Inactif"}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{pu.email}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                            Sans compte
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {pu ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => toggleActif(pu.id)}
                              title={pu.actif ? "Désactiver" : "Activer"}
                              className={`p-1.5 rounded-lg transition-colors ${pu.actif ? "hover:bg-red-50 hover:text-red-600 text-slate-400" : "hover:bg-green-50 hover:text-green-600 text-slate-400"}`}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={pu.actif ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleResetPwd(pu.id)}
                              title="Réinitialiser le mot de passe"
                              className="p-1.5 rounded-lg hover:bg-amber-50 hover:text-amber-600 text-slate-400 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                              </svg>
                            </button>
                          </div>
                        ) : <span className="text-xs text-slate-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
                {filteredFournisseurs.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">Aucun fournisseur trouvé</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
