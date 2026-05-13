"use client"
import { useState, useEffect } from "react"
import { store } from "@/lib/store"
import type { Article, Client } from "@/lib/store"

type Cat = "chr" | "marchand" | "particulier"
type Mode = "segment" | "client"

const CAT_LABELS: Record<Cat, string> = { chr: "CHR / HORECA", marchand: "Marchand", particulier: "Particulier" }
const CAT_COLORS: Record<Cat, string> = {
  chr:         "bg-purple-100 text-purple-700 border-purple-200",
  marchand:    "bg-blue-100   text-blue-700   border-blue-200",
  particulier: "bg-green-100  text-green-700  border-green-200",
}

const getField = (cat: Cat): { prix: keyof Article; promo: keyof Article } => ({
  chr:         { prix: "prixCHR",         promo: "promoCHR" },
  marchand:    { prix: "prixMarchand",    promo: "promoMarchand" },
  particulier: { prix: "prixParticulier", promo: "promoParticulier" },
}[cat])

export default function BOCategoryPricing() {
  const [articles, setArticles]     = useState<Article[]>([])
  const [clients, setClients]       = useState<Client[]>([])
  const [search, setSearch]         = useState("")
  const [mode, setMode]             = useState<Mode>("segment")
  const [activeCat, setActiveCat]   = useState<Cat>("chr")
  const [selectedClient, setSelectedClient] = useState<string>("")
  const [edits, setEdits]           = useState<Record<string, { prix?: number; promo?: number }>>({})
  const [saved, setSaved]           = useState(false)

  useEffect(() => {
    setArticles(store.getArticles())
    setClients(store.getClients().filter(c => c.actif !== false))
  }, [])

  const filtered = articles.filter(a =>
    a.actif && a.nom.toLowerCase().includes(search.toLowerCase())
  )

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getSegVal = (art: Article, cat: Cat, field: "prix" | "promo"): string => {
    const key = getField(cat)[field]
    const edited = edits[art.id]?.[field]
    if (edited !== undefined) return String(edited)
    return String((art as unknown as Record<string, unknown>)[key as string] ?? "")
  }

  const getClientVal = (art: Article, field: "prix" | "promo"): string => {
    if (!selectedClient) return ""
    const edited = edits[art.id]?.[field]
    if (edited !== undefined) return String(edited)
    const override = art.clientPrices?.[selectedClient]?.[field]
    if (override !== undefined) return String(override)
    return ""
  }

  const setVal = (artId: string, field: "prix" | "promo", val: string) => {
    setEdits(prev => ({
      ...prev,
      [artId]: { ...prev[artId], [field]: val === "" ? undefined : Number(val) },
    }))
  }

  const clientCat = (clientId: string): Cat => {
    const c = clients.find(cl => cl.id === clientId)
    return (c?.categorie as Cat) ?? "particulier"
  }

  const effectivePrix = (art: Article): number => {
    if (mode === "client" && selectedClient) {
      const override = edits[art.id]?.prix ?? art.clientPrices?.[selectedClient]?.prix
      if (override && override > 0) return override
      const cat = clientCat(selectedClient)
      const catPrix = (art as unknown as Record<string, unknown>)[getField(cat).prix as string] as number
      return catPrix > 0 ? catPrix : store.computePV(art)
    }
    const catPrix = Number(getSegVal(art, activeCat, "prix")) || 0
    const promo   = Number(getSegVal(art, activeCat, "promo")) || 0
    const base    = catPrix > 0 ? catPrix : store.computePV(art)
    return base * (1 - promo / 100)
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = () => {
    const all = store.getArticles()
    for (const [artId, edit] of Object.entries(edits)) {
      const idx = all.findIndex(a => a.id === artId)
      if (idx < 0) continue
      if (mode === "segment") {
        const { prix: prixKey, promo: promoKey } = getField(activeCat)
        if (edit.prix  !== undefined) (all[idx] as unknown as Record<string, unknown>)[prixKey  as string] = edit.prix
        if (edit.promo !== undefined) (all[idx] as unknown as Record<string, unknown>)[promoKey as string] = edit.promo
      } else if (selectedClient) {
        if (!all[idx].clientPrices) all[idx].clientPrices = {}
        const prev = all[idx].clientPrices![selectedClient] ?? {}
        all[idx].clientPrices![selectedClient] = {
          ...prev,
          ...(edit.prix  !== undefined ? { prix:  edit.prix  } : {}),
          ...(edit.promo !== undefined ? { promo: edit.promo } : {}),
        }
        if (edit.prix === undefined && edit.promo === undefined)
          delete all[idx].clientPrices![selectedClient]
      }
    }
    store.saveArticles(all)
    setArticles(all)
    setEdits({})
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const clearClientOverride = (artId: string) => {
    const all = store.getArticles()
    const idx = all.findIndex(a => a.id === artId)
    if (idx >= 0 && all[idx].clientPrices?.[selectedClient]) {
      delete all[idx].clientPrices![selectedClient]
      store.saveArticles(all)
      setArticles(all)
      setEdits(prev => { const n = { ...prev }; delete n[artId]; return n })
    }
  }

  const currentClient = clients.find(c => c.id === selectedClient)
  const currentClientCat = selectedClient ? clientCat(selectedClient) : "particulier"

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Tarification clients</h2>
          <p className="text-xs text-muted-foreground">Prix par segment ou par client individuel</p>
        </div>
        <button
          onClick={handleSave}
          disabled={Object.keys(edits).length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-opacity"
          style={{ background: "oklch(0.38 0.2 260)" }}>
          {saved ? "✓ Sauvegarde" : "Enregistrer les tarifs"}
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-xl w-fit border border-border">
        <button
          onClick={() => { setMode("segment"); setEdits({}) }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${mode === "segment" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          Par segment
        </button>
        <button
          onClick={() => { setMode("client"); setEdits({}) }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${mode === "client" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          Par client individuel
        </button>
      </div>

      {/* Segment tabs OR client selector */}
      {mode === "segment" ? (
        <div className="flex gap-2 flex-wrap">
          {(["chr", "marchand", "particulier"] as Cat[]).map(cat => (
            <button
              key={cat}
              onClick={() => { setActiveCat(cat); setEdits({}) }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                activeCat === cat
                  ? CAT_COLORS[cat] + " shadow-sm"
                  : "border-border text-muted-foreground hover:text-foreground bg-card"
              }`}>
              {CAT_LABELS[cat]}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-60">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <select
                value={selectedClient}
                onChange={e => { setSelectedClient(e.target.value); setEdits({}) }}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none">
                <option value="">-- Sélectionner un client --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nom} {c.categorie ? `(${CAT_LABELS[c.categorie as Cat] ?? c.categorie})` : ""}
                  </option>
                ))}
              </select>
            </div>
            {currentClient && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${CAT_COLORS[currentClientCat]}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Segment : {CAT_LABELS[currentClientCat]}
              </div>
            )}
          </div>
          {selectedClient && (
            <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Les prix sauvegardés ici s'appliquent uniquement à <strong>{currentClient?.nom}</strong> et
              remplacent les tarifs du segment {CAT_LABELS[currentClientCat]}.
            </p>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un article..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>

      {/* Empty state for client mode without selection */}
      {mode === "client" && !selectedClient && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center bg-card rounded-xl border border-border">
          <svg className="w-10 h-10 text-muted-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <p className="text-sm font-medium text-muted-foreground">Sélectionnez un client pour voir et modifier ses tarifs individuels</p>
        </div>
      )}

      {/* Table */}
      {(mode === "segment" || selectedClient) && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Article</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Prix standard (DH)</th>
                  {mode === "segment" ? (
                    <>
                      <th className="text-center px-4 py-3 font-semibold">
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${CAT_COLORS[activeCat]}`}>{CAT_LABELS[activeCat]}</span>
                        {" "}Prix (DH)
                      </th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Remise %</th>
                    </>
                  ) : (
                    <>
                      <th className="text-center px-4 py-3 font-semibold">
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${CAT_COLORS[currentClientCat]}`}>{CAT_LABELS[currentClientCat]}</span>
                        {" "}Prix segment
                      </th>
                      <th className="text-center px-4 py-3 font-semibold text-amber-700">Override prix (DH)</th>
                      <th className="text-center px-4 py-3 font-semibold text-amber-700">Override remise %</th>
                    </>
                  )}
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Prix final</th>
                  {mode === "client" && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map(art => {
                  const stdPrix = store.computePV(art)
                  const final   = effectivePrix(art)
                  const hasOverride = mode === "client" && selectedClient && !!art.clientPrices?.[selectedClient]

                  if (mode === "segment") {
                    const catPrix  = Number(getSegVal(art, activeCat, "prix"))  || 0
                    const catPromo = Number(getSegVal(art, activeCat, "promo")) || 0
                    const hasCustom = catPrix > 0 || catPromo > 0
                    return (
                      <tr key={art.id} className={`border-b border-border last:border-0 hover:bg-muted/20 ${hasCustom ? "bg-primary/[0.03]" : ""}`}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">{art.nom}</p>
                          <p className="text-xs text-muted-foreground">{art.unite}{art.um ? ` · ${art.um}` : ""}</p>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground font-mono">{stdPrix} DH</td>
                        <td className="px-4 py-3 text-center">
                          <input type="number" min={0} step={0.5}
                            value={getSegVal(art, activeCat, "prix")}
                            onChange={e => setVal(art.id, "prix", e.target.value)}
                            placeholder={String(stdPrix)}
                            className="w-24 px-2 py-1.5 rounded-lg border border-border bg-background text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <input type="number" min={0} max={100} step={1}
                              value={getSegVal(art, activeCat, "promo")}
                              onChange={e => setVal(art.id, "promo", e.target.value)}
                              placeholder="0"
                              className="w-16 px-2 py-1.5 rounded-lg border border-border bg-background text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary" />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold font-mono ${hasCustom ? "text-primary" : "text-muted-foreground"}`}>
                            {final.toFixed(2)} DH
                          </span>
                        </td>
                      </tr>
                    )
                  }

                  // ── Par client ─────────────────────────────────────────
                  const segPrixKey = getField(currentClientCat).prix
                  const segPrix = (art as unknown as Record<string, unknown>)[segPrixKey as string] as number || stdPrix
                  return (
                    <tr key={art.id} className={`border-b border-border last:border-0 hover:bg-muted/20 ${hasOverride ? "bg-amber-50/50" : ""}`}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">{art.nom}</p>
                        <p className="text-xs text-muted-foreground">{art.unite}{art.um ? ` · ${art.um}` : ""}</p>
                        {hasOverride && (
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5">override actif</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground font-mono">{stdPrix} DH</td>
                      <td className="px-4 py-3 text-center text-muted-foreground font-mono">{segPrix} DH</td>
                      <td className="px-4 py-3 text-center">
                        <input type="number" min={0} step={0.5}
                          value={getClientVal(art, "prix")}
                          onChange={e => setVal(art.id, "prix", e.target.value)}
                          placeholder="—"
                          className="w-24 px-2 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-amber-400" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input type="number" min={0} max={100} step={1}
                            value={getClientVal(art, "promo")}
                            onChange={e => setVal(art.id, "promo", e.target.value)}
                            placeholder="—"
                            className="w-16 px-2 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-amber-400" />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold font-mono ${hasOverride ? "text-amber-700" : "text-muted-foreground"}`}>
                          {final.toFixed(2)} DH
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hasOverride && (
                          <button
                            onClick={() => clearClientOverride(art.id)}
                            title="Supprimer override"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">Aucun article trouvé</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
