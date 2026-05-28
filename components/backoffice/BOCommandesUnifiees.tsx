"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { store, type Commande, type LigneCommande } from "@/lib/store"
import type { User } from "@/lib/store"

interface Props { user: User }

// ── Types normalisés ─────────────────────────────────────────────────────────

interface CmdUnifiee {
  id:          string
  numero:      string
  date:        string
  nom_client:  string
  telephone:   string
  adresse?:    string
  lignes:      LigneCmd[]
  montant:     number
  statut:      string
  source:      "web" | "erp"
  prevendeur:  string   // nom du prévendeur (ERP) ou "" pour web
  zone?:       string
  notes?:      string
  table:       "fl_commandes_web" | "fl_commandes"
  rawPayload?: Record<string, unknown>  // payload complet ERP pour mise à jour
}

interface LigneCmd {
  nom:      string
  quantite: number
  unite:    string
  prix:     number
  total:    number
}

// ── Config statuts ───────────────────────────────────────────────────────────

const STATUTS_WEB: Record<string, { label: string; color: string; icon: string }> = {
  nouveau:    { label: "Nouveau",   color: "bg-blue-100 text-blue-700 border-blue-200",    icon: "🆕" },
  en_cours:   { label: "En cours",  color: "bg-amber-100 text-amber-700 border-amber-200",  icon: "⏳" },
  prepare:    { label: "Préparé",   color: "bg-purple-100 text-purple-700 border-purple-200",icon: "📦" },
  livre:      { label: "Livré",     color: "bg-green-100 text-green-700 border-green-200",  icon: "✅" },
  annule:     { label: "Annulé",    color: "bg-red-100 text-red-700 border-red-200",        icon: "❌" },
}

const STATUTS_ERP: Record<string, { label: string; color: string; icon: string }> = {
  en_attente:             { label: "En attente",     color: "bg-slate-100 text-slate-600 border-slate-200",   icon: "🕐" },
  en_attente_approbation: { label: "En approbation", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: "👁️" },
  valide:                 { label: "Validé",         color: "bg-green-100 text-green-700 border-green-200",   icon: "✅" },
  refuse:                 { label: "Refusé",         color: "bg-red-100 text-red-700 border-red-200",         icon: "🚫" },
  en_transit:             { label: "En transit",     color: "bg-cyan-100 text-cyan-700 border-cyan-200",      icon: "🚚" },
  livre:                  { label: "Livré",          color: "bg-green-100 text-green-700 border-green-200",   icon: "✅" },
  retour:                 { label: "Retour",         color: "bg-orange-100 text-orange-700 border-orange-200",icon: "↩️" },
}

const NEXT_WEB = ["nouveau", "en_cours", "prepare", "livre", "annule"]
const NEXT_ERP = ["en_attente", "en_attente_approbation", "valide", "refuse", "en_transit", "livre", "retour"]

function getStatutCfg(statut: string, source: "web" | "erp") {
  const dict = source === "web" ? STATUTS_WEB : STATUTS_ERP
  return dict[statut] ?? { label: statut, color: "bg-slate-100 text-slate-600 border-slate-200", icon: "•" }
}

// ── Normalisation des données ─────────────────────────────────────────────────

function normalizeWeb(row: Record<string, unknown>): CmdUnifiee {
  const lignes = (Array.isArray(row.lignes) ? row.lignes : []) as Record<string, unknown>[]
  return {
    id:         String(row.id ?? ""),
    numero:     String(row.numero ?? row.id ?? ""),
    date:       String(row.created_at ?? ""),
    nom_client: String(row.nom_client ?? "—"),
    telephone:  String(row.telephone ?? ""),
    adresse:    row.adresse_livraison ? String(row.adresse_livraison) : undefined,
    lignes: lignes.map(l => ({
      nom:      String(l.articleNom ?? l.nom ?? "Article"),
      quantite: Number(l.quantite ?? l.qty ?? 1),
      unite:    String(l.unite ?? "kg"),
      prix:     Number(l.prixUnitaire ?? 0),
      total:    Number(l.total ?? l.montant ?? 0),
    })),
    montant:    Number(row.montant_total ?? 0),
    statut:     String(row.statut ?? "nouveau"),
    source:     "web",
    prevendeur: "",
    notes:      row.instructions ? String(row.instructions) : undefined,
    table:      "fl_commandes_web",
  }
}

function normalizeERP(row: { id: string; payload: Record<string, unknown>; updated_at: string }): CmdUnifiee {
  const p = row.payload ?? {}
  const lignes = (Array.isArray(p.lignes) ? p.lignes : []) as Record<string, unknown>[]
  const montant = lignes.reduce((sum, l) => {
    const q  = Number(l.quantite ?? 1)
    const pu = Number(l.prixVente ?? l.prixUnitaire ?? 0)
    return sum + q * pu
  }, 0)
  return {
    id:         row.id,
    numero:     row.id,
    date:       String(p.date ?? row.updated_at ?? ""),
    nom_client: String(p.clientNom ?? "—"),
    telephone:  String(p.clientTel ?? p.telephone ?? ""),
    lignes: lignes.map(l => ({
      nom:      String(l.articleNom ?? l.nom ?? "Article"),
      quantite: Number(l.quantite ?? 1),
      unite:    String(l.unite ?? "kg"),
      prix:     Number(l.prixVente ?? l.prixUnitaire ?? 0),
      total:    Number(l.quantite ?? 1) * Number(l.prixVente ?? l.prixUnitaire ?? 0),
    })),
    montant:    Math.round(montant * 100) / 100,
    statut:     String(p.statut ?? "en_attente"),
    source:     "erp",
    prevendeur: String(p.commercialNom ?? ""),
    zone:       p.zone ? String(p.zone) : undefined,
    notes:      p.notes ? String(p.notes) : (p.commentaire ? String(p.commentaire) : undefined),
    table:      "fl_commandes",
    rawPayload: p as Record<string, unknown>,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function canAccess(u: User): boolean {
  return ["super_super_admin","super_admin","admin","resp_commercial","resp_logistique","livreur","prevendeur"].includes(u.role)
}

function fmt(iso: string) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("fr-MA", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
    })
  } catch { return iso }
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function BOCommandesUnifiees({ user }: Props) {
  const [cmds, setCmds]                 = useState<CmdUnifiee[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState("")
  const [filterStatut, setFilterStatut] = useState("tous")
  const [filterSource, setFilterSource] = useState("tous")
  const [selected, setSelected]         = useState<CmdUnifiee | null>(null)
  const [updating, setUpdating]         = useState(false)
  const [msg, setMsg]                   = useState<{ ok: boolean; text: string } | null>(null)

  // ── Chargement ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sb = createClient()
      const [webRes, erpRes] = await Promise.all([
        sb.from("fl_commandes_web")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        sb.from("fl_commandes")
          .select("id, payload, updated_at")
          .order("updated_at", { ascending: false })
          .limit(500),
      ])

      const webOrders: CmdUnifiee[] = (webRes.data ?? []).map(
        r => normalizeWeb(r as Record<string, unknown>)
      )
      const erpOrders: CmdUnifiee[] = (erpRes.data ?? [])
        .filter(r => r.payload)
        .map(r => normalizeERP(r as { id: string; payload: Record<string, unknown>; updated_at: string }))

      // Fusion + tri par date décroissante
      const all = [...webOrders, ...erpOrders]
      all.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      setCmds(all)
    } catch (e) {
      console.error("[BOCommandesUnifiees]", e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  // ── Mise à jour statut ───────────────────────────────────────────────────────
  const updateStatut = async (cmd: CmdUnifiee, newStatut: string) => {
    setUpdating(true)
    try {
      const sb = createClient()
      if (cmd.table === "fl_commandes_web") {
        const { error } = await sb
          .from("fl_commandes_web")
          .update({
            statut:     newStatut,
            traite_par: user.name,
            traite_at:  new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", cmd.id)
        if (error) throw error
      } else {
        // ERP : mise à jour du statut dans le payload JSONB
        const { error } = await sb
          .from("fl_commandes")
          .update({
            payload:    { ...(cmd.rawPayload ?? {}), statut: newStatut },
            updated_at: new Date().toISOString(),
          })
          .eq("id", cmd.id)
        if (error) throw error
      }
      setMsg({ ok: true, text: `✅ Statut mis à jour → ${getStatutCfg(newStatut, cmd.source).label}` })
      setSelected(prev => prev ? { ...prev, statut: newStatut } : null)
      // Refresh local state immédiatement
      setCmds(prev => prev.map(c =>
        c.id === cmd.id && c.table === cmd.table ? { ...c, statut: newStatut } : c
      ))
    } catch {
      setMsg({ ok: false, text: "❌ Erreur lors de la mise à jour." })
    }
    setUpdating(false)
    setTimeout(() => setMsg(null), 3500)
  }

  // ── Injecter commande web dans pipeline logistique ERP ──────────────────────
  const injecterDansERP = async (cmd: CmdUnifiee) => {
    if (cmd.source !== "web") return
    if (!confirm(`Injecter la commande ${cmd.numero} de ${cmd.nom_client} dans la logistique ERP ?\n\nElle apparaîtra dans Préparation, Dispatch et Stock.`)) return

    // Trouver ou créer un client par nom/téléphone
    const clients = store.getClients()
    let client = clients.find(c =>
      c.telephone === cmd.telephone || c.nom.toLowerCase() === cmd.nom_client.toLowerCase()
    )
    if (!client) {
      client = {
        id:           store.genId(),
        nom:          cmd.nom_client,
        secteur:      "Site Web",
        zone:         cmd.zone ?? "Casablanca",
        type:         "particulier" as const,
        taille:       "0-50kg" as const,
        typeProduits: "mixte" as const,
        rotation:     "ponctuel" as const,
        telephone:    cmd.telephone ?? "",
        email:        "",
        adresse:      cmd.adresse ?? "",
        createdBy:    user.id,
        createdAt:    new Date().toISOString(),
      }
      store.saveClients([...clients, client])
    }

    // Convertir les lignes
    const lignes: LigneCommande[] = cmd.lignes.map(l => ({
      articleId:    (l as Record<string, unknown>).articleId as string ?? store.genId(),
      articleNom:   l.nom ?? l.articleNom ?? "Article",
      unite:        l.unite ?? "kg",
      quantite:     l.quantite,
      prixUnitaire: l.prixUnitaire ?? 0,
      prixVente:    l.prixUnitaire ?? 0,
      total:        l.total ?? (l.prixUnitaire ?? 0) * l.quantite,
    }))

    // Créer la commande ERP
    const newCmd: Commande = {
      id:               store.genId(),
      date:             cmd.date ? cmd.date.split("T")[0] : new Date().toISOString().split("T")[0],
      commercialId:     "site_web",
      commercialNom:    "Site Web",
      clientId:         client.id,
      clientNom:        client.nom,
      secteur:          client.secteur ?? "Site Web",
      zone:             cmd.zone ?? client.zone ?? "Casablanca",
      gpsLat:           0,
      gpsLng:           0,
      lignes,
      heurelivraison:   cmd.zone ?? "Standard 24h",
      statut:           "en_attente",
      emailDestinataire:"",
      notes:            `[Web] Réf: ${cmd.numero}${cmd.notes ? " — " + cmd.notes : ""}`,
    }

    store.saveCommandes([...store.getCommandes(), newCmd])

    // Marquer la commande web comme "confirmee" dans Supabase
    const sb = createClient()
    await sb.from("fl_commandes_web").update({ statut: "confirmee" }).eq("id", cmd.rawId)

    setMsg({ ok: true, text: `✅ ${cmd.numero} injectée dans la logistique ERP (Préparation / Dispatch / Stock).` })
    setTimeout(() => setMsg(null), 5000)
    load()
  }

  // ── Accès ────────────────────────────────────────────────────────────────────
  if (!canAccess(user)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-2xl">🔒</div>
        <p className="text-base font-semibold text-slate-700">Accès restreint</p>
      </div>
    )
  }

  // ── Filtrage ─────────────────────────────────────────────────────────────────
  const filtered = cmds.filter(c => {
    if (filterSource === "web"  && c.source !== "web")  return false
    if (filterSource === "erp"  && c.source !== "erp")  return false
    if (filterStatut !== "tous" && c.statut !== filterStatut) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        c.nom_client.toLowerCase().includes(q) ||
        c.telephone.includes(q) ||
        c.numero.toLowerCase().includes(q) ||
        c.prevendeur.toLowerCase().includes(q)
      )
    }
    return true
  })

  // ── Compteurs ─────────────────────────────────────────────────────────────────
  const webCount  = cmds.filter(c => c.source === "web").length
  const erpCount  = cmds.filter(c => c.source === "erp").length
  const newCount  = cmds.filter(c => ["nouveau","en_attente"].includes(c.statut)).length
  const totalCA   = filtered.reduce((s, c) => s + c.montant, 0)

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">

      {/* ── En-tête ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">📦 Toutes les Commandes</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Vue unifiée — Prévendeurs terrain <span className="text-amber-600 font-semibold">({erpCount} ERP)</span> +
            Site web <span className="text-blue-600 font-semibold">({webCount} Web)</span>
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualiser
        </button>
      </div>

      {/* ── Alerte nouvelles commandes ── */}
      {newCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
          <span className="text-xl">🔔</span>
          <p className="text-sm font-semibold text-blue-700">
            {newCount} commande{newCount > 1 ? "s" : ""} en attente de traitement
          </p>
        </div>
      )}

      {/* ── Message feedback ── */}
      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium border ${
          msg.ok
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {msg.text}
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-black text-slate-800">{cmds.length}</div>
          <div className="text-xs font-semibold text-slate-400 mt-1 uppercase">Total</div>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-center">
          <div className="text-2xl font-black text-blue-700">{webCount}</div>
          <div className="text-xs font-semibold text-blue-400 mt-1 uppercase">🌐 Web</div>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 text-center">
          <div className="text-2xl font-black text-amber-700">{erpCount}</div>
          <div className="text-xs font-semibold text-amber-400 mt-1 uppercase">📱 Terrain</div>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 p-4 text-center">
          <div className="text-lg font-black text-green-700 leading-tight">
            {totalCA.toLocaleString("fr-MA", { maximumFractionDigits: 0 })} MAD
          </div>
          <div className="text-xs font-semibold text-green-400 mt-1 uppercase">CA filtré</div>
        </div>
      </div>

      {/* ── Filtres ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={filterSource}
          onChange={e => setFilterSource(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border text-sm font-medium bg-white text-slate-700 cursor-pointer"
        >
          <option value="tous">📋 Toutes sources</option>
          <option value="web">🌐 Web uniquement</option>
          <option value="erp">📱 Terrain uniquement</option>
        </select>

        <select
          value={filterStatut}
          onChange={e => setFilterStatut(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border text-sm font-medium bg-white text-slate-700 cursor-pointer"
        >
          <option value="tous">Tous statuts</option>
          <optgroup label="— Web">
            {NEXT_WEB.map(s => (
              <option key={s} value={s}>{STATUTS_WEB[s]?.icon} {STATUTS_WEB[s]?.label}</option>
            ))}
          </optgroup>
          <optgroup label="— Terrain">
            {NEXT_ERP.map(s => (
              <option key={s} value={s}>{STATUTS_ERP[s]?.icon} {STATUTS_ERP[s]?.label}</option>
            ))}
          </optgroup>
        </select>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher client, téléphone, réf..."
          className="flex-1 min-w-52 px-3 py-2 rounded-xl border border-border text-sm bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-green-500"
        />

        {(search || filterStatut !== "tous" || filterSource !== "tous") && (
          <button
            onClick={() => { setSearch(""); setFilterStatut("tous"); setFilterSource("tous") }}
            className="px-3 py-2 rounded-xl border border-border text-sm text-slate-500 hover:bg-slate-50"
          >
            ✕ Réinitialiser
          </button>
        )}

        <span className="text-xs text-slate-400 ml-auto">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</span>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">⏳ Chargement des commandes...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-sm">Aucune commande trouvée.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold">Réf.</th>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
                <th className="text-left px-4 py-3 font-semibold">Client</th>
                <th className="text-left px-4 py-3 font-semibold">Articles</th>
                <th className="text-right px-4 py-3 font-semibold">Total</th>
                <th className="text-left px-4 py-3 font-semibold">Source</th>
                <th className="text-left px-4 py-3 font-semibold">Statut</th>
                <th className="text-left px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cmd, i) => {
                const sc        = getStatutCfg(cmd.statut, cmd.source)
                const nextStats = cmd.source === "web" ? NEXT_WEB : NEXT_ERP
                const tel       = cmd.telephone.replace(/\D/g, "")
                const articlesLabel = cmd.lignes.length > 0
                  ? cmd.lignes.slice(0, 2).map(l => `${l.nom} ×${l.quantite}`).join(", ")
                    + (cmd.lignes.length > 2 ? ` +${cmd.lignes.length - 2}` : "")
                  : "—"

                return (
                  <tr
                    key={`${cmd.table}-${cmd.id}`}
                    className={`border-b border-border hover:bg-slate-50 cursor-pointer transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}
                    onClick={() => setSelected(cmd)}
                  >
                    {/* Réf */}
                    <td className="px-4 py-3 font-mono text-xs font-bold text-green-700 whitespace-nowrap">
                      {cmd.numero.slice(0, 16)}
                    </td>
                    {/* Date */}
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {fmt(cmd.date)}
                    </td>
                    {/* Client */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800 text-sm">{cmd.nom_client}</div>
                      {tel && (
                        <a
                          href={`https://wa.me/${tel}`} target="_blank"
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-green-600 hover:underline"
                        >
                          📲 {cmd.telephone}
                        </a>
                      )}
                    </td>
                    {/* Articles */}
                    <td className="px-4 py-3 text-slate-600 text-xs max-w-44 truncate" title={articlesLabel}>
                      {articlesLabel}
                    </td>
                    {/* Total */}
                    <td className="px-4 py-3 text-right font-bold text-green-700 whitespace-nowrap">
                      {cmd.montant.toLocaleString("fr-MA", { maximumFractionDigits: 2 })} MAD
                    </td>
                    {/* Source */}
                    <td className="px-4 py-3">
                      {cmd.source === "web" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                          🌐 Web
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          👤 {cmd.prevendeur || "Terrain"}
                        </span>
                      )}
                    </td>
                    {/* Statut */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <select
                          value={cmd.statut}
                          onChange={e => updateStatut(cmd, e.target.value)}
                          disabled={updating}
                          className="text-xs px-2 py-1.5 rounded-lg border border-border bg-white text-slate-600 cursor-pointer hover:border-green-300 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-40"
                        >
                          {nextStats.map(s => {
                            const cfg = getStatutCfg(s, cmd.source)
                            return <option key={s} value={s}>{cfg.icon} {cfg.label}</option>
                          })}
                        </select>
                        {cmd.source === "web" && cmd.statut !== "confirmee" && cmd.statut !== "livre" && (
                          <button
                            onClick={() => injecterDansERP(cmd)}
                            title="Injecter dans la logistique ERP (Préparation / Dispatch / Stock)"
                            className="px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition-colors whitespace-nowrap"
                          >
                            🚀 ERP
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Drawer détail ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setSelected(null)}>
          <div className="flex-1 bg-black/20" />
          <div
            className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl border-l border-border"
            onClick={e => e.stopPropagation()}
          >
            {/* Header drawer */}
            <div className="sticky top-0 bg-white border-b border-border px-5 py-4 flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-800 font-mono">{selected.numero}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{fmt(selected.date)}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-5">

              {/* Badges source + statut */}
              <div className="flex flex-wrap items-center gap-2">
                {selected.source === "web" ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200">
                    🌐 Commande Web
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    📱 Terrain — {selected.prevendeur || "Prévendeur"}
                  </span>
                )}
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatutCfg(selected.statut, selected.source).color}`}>
                  {getStatutCfg(selected.statut, selected.source).icon}{" "}
                  {getStatutCfg(selected.statut, selected.source).label}
                </span>
              </div>

              {/* Infos client */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">👤 Client</p>
                <p className="font-bold text-slate-800 text-base">{selected.nom_client}</p>
                {selected.telephone && (
                  <a
                    href={`https://wa.me/${selected.telephone.replace(/\D/g,"")}`}
                    target="_blank"
                    className="text-sm text-green-600 hover:underline block"
                  >
                    📲 {selected.telephone}
                  </a>
                )}
                {selected.adresse && (
                  <p className="text-sm text-slate-500">📍 {selected.adresse}</p>
                )}
                {selected.zone && (
                  <p className="text-sm text-slate-500">🗺️ Zone : {selected.zone}</p>
                )}
              </div>

              {/* Lignes articles */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">
                  🛒 Articles ({selected.lignes.length})
                </p>
                {selected.lignes.length === 0 ? (
                  <p className="text-sm text-slate-400">Aucun article détaillé.</p>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden">
                    {selected.lignes.map((l, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between px-4 py-3 ${i < selected.lignes.length - 1 ? "border-b border-border" : ""}`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{l.nom}</p>
                          <p className="text-xs text-slate-400">{l.quantite} {l.unite}</p>
                        </div>
                        <p className="text-sm font-bold text-green-700">
                          {(l.total > 0 ? l.total : l.prix * l.quantite).toLocaleString("fr-MA", { maximumFractionDigits: 2 })} MAD
                        </p>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 font-bold">
                      <span className="text-slate-700">Total</span>
                      <span className="text-green-700 text-base">
                        {selected.montant.toLocaleString("fr-MA", { maximumFractionDigits: 2 })} MAD
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selected.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-amber-600 uppercase mb-1">📝 Notes / Instructions</p>
                  <p className="text-sm text-slate-700">{selected.notes}</p>
                </div>
              )}

              {/* Changer statut */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">🔄 Changer le statut</p>
                <div className="grid grid-cols-2 gap-2">
                  {(selected.source === "web" ? NEXT_WEB : NEXT_ERP).map(s => {
                    const cfg       = getStatutCfg(s, selected.source)
                    const isActive  = s === selected.statut
                    return (
                      <button
                        key={s}
                        onClick={() => updateStatut(selected, s)}
                        disabled={updating || isActive}
                        className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                          isActive
                            ? cfg.color + " cursor-default"
                            : "bg-white border-border text-slate-600 hover:border-green-400 hover:bg-green-50 active:scale-95 disabled:opacity-40"
                        }`}
                      >
                        {cfg.icon} {cfg.label}
                        {isActive && " ✓"}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Injecter dans ERP logistique */}
              {selected.source === "web" && selected.statut !== "confirmee" && selected.statut !== "livre" && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col gap-2">
                  <p className="text-xs font-bold text-emerald-700 uppercase">🚀 Logistique ERP</p>
                  <p className="text-xs text-emerald-600">
                    Injecte cette commande web dans la chaîne logistique ERP — elle apparaîtra dans Préparation, Dispatch et Stock.
                  </p>
                  <button
                    onClick={() => { injecterDansERP(selected); setSelected(null) }}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors"
                  >
                    🚀 Injecter dans la logistique ERP
                  </button>
                </div>
              )}

              {/* Message dans le drawer */}
              {msg && (
                <div className={`px-4 py-3 rounded-xl text-sm font-medium border ${
                  msg.ok
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}>
                  {msg.text}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
