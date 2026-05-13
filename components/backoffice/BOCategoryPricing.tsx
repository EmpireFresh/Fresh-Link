"use client"
import { useState, useEffect } from "react"
import { store } from "@/lib/store"
import type { Article } from "@/lib/store"

type Cat = "chr" | "marchand" | "particulier"
const CAT_LABELS: Record<Cat, string> = { chr: "CHR / HORECA", marchand: "Marchand", particulier: "Particulier" }
const CAT_COLORS: Record<Cat, string> = { chr: "bg-purple-100 text-purple-700", marchand: "bg-blue-100 text-blue-700", particulier: "bg-green-100 text-green-700" }

export default function BOCategoryPricing() {
  const [articles, setArticles] = useState<Article[]>([])
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<Cat>("chr")
  const [edits, setEdits] = useState<Record<string, { prix?: number; promo?: number }>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => { setArticles(store.getArticles()) }, [])

  const filtered = articles.filter(a => a.nom.toLowerCase().includes(search.toLowerCase()) && a.actif)

  const getField = (cat: Cat): { prix: keyof Article; promo: keyof Article } => {
    const map: Record<Cat, { prix: keyof Article; promo: keyof Article }> = {
      chr:         { prix: "prixCHR",        promo: "promoCHR" },
      marchand:    { prix: "prixMarchand",   promo: "promoMarchand" },
      particulier: { prix: "prixParticulier",promo: "promoParticulier" },
    }
    return map[cat]
  }

  const getVal = (art: Article, cat: Cat, field: "prix" | "promo"): string => {
    const key = getField(cat)[field]
    const edited = edits[art.id]?.[field]
    if (edited !== undefined) return String(edited)
    return String((art as unknown as Record<string,unknown>)[key as string] ?? "")
  }

  const setVal = (artId: string, field: "prix" | "promo", val: string) => {
    setEdits(prev => ({ ...prev, [artId]: { ...prev[artId], [field]: val === "" ? undefined : Number(val) } }))
  }

  const handleSave = () => {
    const all = store.getArticles()
    const { prix: prixKey, promo: promoKey } = getField(activeTab)
    for (const [artId, edit] of Object.entries(edits)) {
      const idx = all.findIndex(a => a.id === artId)
      if (idx < 0) continue
      if (edit.prix !== undefined) (all[idx] as unknown as Record<string,unknown>)[prixKey as string] = edit.prix
      if (edit.promo !== undefined) (all[idx] as unknown as Record<string,unknown>)[promoKey as string] = edit.promo
    }
    store.saveArticles(all)
    setArticles(all)
    setEdits({})
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Tarification par catégorie client</h2>
          <p className="text-xs text-muted-foreground">Définissez des prix et remises spécifiques par segment de clientèle</p>
        </div>
        <button onClick={handleSave} disabled={Object.keys(edits).length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
          style={{ background: "oklch(0.38 0.2 260)" }}>
          {saved ? "✓ Sauvegardé" : "Enregistrer les tarifs"}
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit">
        {(["chr","marchand","particulier"] as Cat[]).map(cat => (
          <button key={cat} onClick={() => setActiveTab(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === cat ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {CAT_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un article..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Article</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Prix standard (DH)</th>
                <th className="text-center px-4 py-3 font-semibold">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${CAT_COLORS[activeTab]}`}>{CAT_LABELS[activeTab]}</span>
                  {" "}Prix (DH)
                </th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Remise % {CAT_LABELS[activeTab]}</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Prix final</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(art => {
                const stdPrix = store.computePV(art)
                const catPrix = Number(getVal(art, activeTab, "prix")) || 0
                const catPromo = Number(getVal(art, activeTab, "promo")) || 0
                const finalPrix = catPrix > 0 ? catPrix * (1 - catPromo/100) : stdPrix * (1 - catPromo/100)
                const hasCustom = catPrix > 0 || catPromo > 0
                return (
                  <tr key={art.id} className={`border-b border-border last:border-0 hover:bg-muted/20 ${hasCustom ? "bg-primary/3" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{art.nom}</p>
                      <p className="text-xs text-muted-foreground">{art.unite} {art.um ? `· ${art.um}` : ""}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground font-mono">{stdPrix} DH</td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number" min={0} step={0.5}
                        value={getVal(art, activeTab, "prix")}
                        onChange={e => setVal(art.id, "prix", e.target.value)}
                        placeholder={String(stdPrix)}
                        className="w-24 px-2 py-1.5 rounded-lg border border-border bg-background text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number" min={0} max={100} step={1}
                          value={getVal(art, activeTab, "promo")}
                          onChange={e => setVal(art.id, "promo", e.target.value)}
                          placeholder="0"
                          className="w-16 px-2 py-1.5 rounded-lg border border-border bg-background text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold font-mono ${hasCustom ? "text-primary" : "text-muted-foreground"}`}>
                        {finalPrix.toFixed(2)} DH
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
