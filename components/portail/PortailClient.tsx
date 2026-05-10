"use client"

import { useState, useEffect } from "react"
import { store, type User, type Commande, type Article, type Client, type LigneCommande, DELAI_RECOUVREMENT_LABELS } from "@/lib/store"
import FreshLinkLogo from "@/components/ui/FreshLinkLogo"

// Returns tomorrow's date as YYYY-MM-DD (J+1 default)
function getJ1(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split("T")[0]
}

interface Props { user: User; onLogout: () => void }

const STATUT_CONFIG: Record<string, { label: string; labelAr: string; cls: string }> = {
  en_attente:            { label: "En attente",      labelAr: "في الانتظار",    cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  en_attente_approbation:{ label: "En approbation",  labelAr: "بانتظار الموافقة", cls: "bg-orange-100 text-orange-800 border-orange-200" },
  valide:                { label: "Validee",         labelAr: "مقبولة",         cls: "bg-blue-100 text-blue-800 border-blue-200" },
  refuse:                { label: "Refusee",         labelAr: "مرفوضة",         cls: "bg-red-100 text-red-800 border-red-200" },
  en_transit:            { label: "En livraison",    labelAr: "قيد التوصيل",    cls: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  livre:                 { label: "Livree",          labelAr: "تم التسليم",      cls: "bg-green-100 text-green-800 border-green-200" },
  retour:                { label: "Retour",          labelAr: "مرتجع",          cls: "bg-rose-100 text-rose-800 border-rose-200" },
}

// Famille icons map
const FAMILLE_ICON: Record<string, string> = {
  "Légumes fruits": "🍅", "Légumes racines": "🥕", "Légumes feuilles": "🥦",
  "Herbes aromatiques": "🌿", "Agrumes": "🍊", "Fruits tropicaux": "🍌",
  "Fruits rouges": "🍓", "Fruits secs": "🌰",
}

type Tab = "commandes" | "commande" | "catalogue"

interface LigneForm {
  articleId: string
  quantite: string
}

export default function PortailClient({ user, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>("commandes")
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterStatut, setFilterStatut] = useState("tous")
  const [search, setSearch] = useState("")

  // --- New order form state ---
  const [lignes, setLignes] = useState<LigneForm[]>([{ articleId: "", quantite: "" }])
  // Default delivery = J+1 at 08:00
  const [dateLivraison, setDateLivraison] = useState(getJ1())
  const [heureLivraison, setHeureLivraison] = useState("08:00")
  const [notes, setNotes] = useState("")
  const [articleSearch, setArticleSearch] = useState("")
  const [familleFilter, setFamilleFilter] = useState("Toutes")
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState("")

  useEffect(() => { refresh() }, [])

  const refresh = () => {
    const allCommandes = store.getCommandes()
    const allArticles = store.getArticles()
    const allClients = store.getClients()
    const myClientId = user.clientId
    const myClient = allClients.find(c => c.id === myClientId) ?? null
    setClient(myClient)
    const myCommandes = myClientId
      ? allCommandes.filter(c => c.clientId === myClientId)
      : []
    setCommandes(myCommandes.sort((a, b) => b.date.localeCompare(a.date)))
    setArticles(allArticles)
  }

  const familles = ["Toutes", ...Array.from(new Set(articles.map(a => a.famille ?? "").filter(Boolean)))]

  const filteredCatalogue = articles.filter(a => {
    const matchSearch = !articleSearch || a.nom.toLowerCase().includes(articleSearch.toLowerCase()) || (a.nomAr ?? "").includes(articleSearch)
    const matchFamille = familleFilter === "Toutes" || a.famille === familleFilter
    return matchSearch && matchFamille
  })

  const addLigne = () => setLignes(prev => [...prev, { articleId: "", quantite: "" }])
  const removeLigne = (i: number) => setLignes(prev => prev.filter((_, j) => j !== i))
  const setLigne = (i: number, patch: Partial<LigneForm>) =>
    setLignes(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l))

  // Quick add from catalogue card
  const quickAdd = (artId: string) => {
    const existing = lignes.findIndex(l => l.articleId === artId)
    if (existing >= 0) {
      setTab("commande")
      return
    }
    setLignes(prev => {
      // Replace first empty ligne or append
      const emptyIdx = prev.findIndex(l => !l.articleId)
      if (emptyIdx >= 0) {
        const n = [...prev]; n[emptyIdx] = { articleId: artId, quantite: "1" }; return n
      }
      return [...prev, { articleId: artId, quantite: "1" }]
    })
    setTab("commande")
  }

  const handleSubmit = () => {
    setSubmitError("")
    if (!client) { setSubmitError("Compte client non configure. Contactez votre commercial."); return }
    const validLignes = lignes.filter(l => l.articleId && Number(l.quantite) > 0)
    if (validLignes.length === 0) { setSubmitError("Ajoutez au moins un article avec une quantite."); return }

    const cmdLignes: LigneCommande[] = validLignes.map(l => {
      const art = articles.find(a => a.id === l.articleId)!
      const pv = art.pvMethode === "montant" ? art.pvValeur :
        art.pvMethode === "pourcentage" ? art.prixAchat * (1 + art.pvValeur / 100) : art.pvValeur
      const qty = Number(l.quantite)
      return {
        articleId: art.id,
        articleNom: art.nom,
        unite: art.unite,
        quantite: qty,
        prixUnitaire: pv,
        prixVente: pv,
        total: pv * qty,
      } as LigneCommande
    })

    const cmd: Commande = {
      id: store.genId(),
      date: store.today(),
      commercialId: "portail",
      commercialNom: "Portail Client",
      clientId: client.id,
      clientNom: client.nom,
      secteur: client.secteur,
      zone: client.zone,
      gpsLat: 0, gpsLng: 0,
      lignes: cmdLignes,
      // Combine date + time for delivery scheduling
      heurelivraison: `${dateLivraison} ${heureLivraison}`,
      statut: "en_attente",
      emailDestinataire: user.email,
      notes: notes || undefined,
    }
    store.addCommande(cmd)
    setLignes([{ articleId: "", quantite: "" }])
    setNotes("")
    setDateLivraison(getJ1())
    setHeureLivraison("08:00")
    setSubmitSuccess(true)
    setTimeout(() => { setSubmitSuccess(false); setTab("commandes"); refresh() }, 2500)
  }

  const filtered = commandes.filter(c => {
    if (filterStatut !== "tous" && c.statut !== filterStatut) return false
    if (search) {
      const s = search.toLowerCase()
      return c.id.toLowerCase().includes(s) ||
        c.lignes.some(l => l.articleNom.toLowerCase().includes(s))
    }
    return true
  })

  const livrees = commandes.filter(c => c.statut === "livre").length
  const enCours = commandes.filter(c => ["en_attente", "valide", "en_transit"].includes(c.statut)).length
  const totalCA = commandes
    .filter(c => c.statut === "livre")
    .reduce((s, c) => s + c.lignes.reduce((ls, l) => ls + (l.prixVente ?? 0) * l.quantite, 0), 0)

  const filteredArticles = articles.filter(a =>
    a.nom.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      {/* Header */}
      <header className="bg-sidebar text-sidebar-foreground px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-md">
        <FreshLinkLogo size={34} variant="full-white" />
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-white">{client?.nom ?? user.name}</p>
            <p className="text-[10px] text-sidebar-foreground/60">Portail Client / بوابة الزبون</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {(client?.nom ?? user.name)[0]}
          </div>
          <button onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sidebar-border text-xs text-sidebar-foreground/60 hover:text-white hover:bg-sidebar-accent transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Deconnexion</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 flex flex-col gap-5">

        {/* Client info card */}
        {client && (
          <div className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row gap-4 items-start">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-foreground text-base">{client.nom}</h2>
              <p className="text-sm text-muted-foreground">{client.secteur} — {client.zone}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {client.telephone && (
                  <span className="text-xs px-2 py-1 rounded-lg bg-muted text-muted-foreground">{client.telephone}</span>
                )}
                {client.type && (
                  <span className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium capitalize">{client.type}</span>
                )}
                {client.adresse && (
                  <span className="text-xs px-2 py-1 rounded-lg bg-muted text-muted-foreground">{client.adresse}</span>
                )}
              </div>
              {/* Credit info — shown only when credit is configured */}
              {client.creditAutorise !== undefined && (
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  {client.creditAutorise ? (
                    <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-800 font-semibold border border-green-200">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Credit autorise
                    </span>
                  ) : client.creditStatut === "attente_validation" ? (
                    <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 font-semibold border border-orange-200">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Credit en attente de validation
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-semibold border border-red-200">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Credit non autorise
                    </span>
                  )}
                  {client.delaiRecouvrement && (
                    <span className="text-xs px-2 py-1 rounded-lg bg-muted text-muted-foreground">
                      Recouvrement : {DELAI_RECOUVREMENT_LABELS[client.delaiRecouvrement]}
                    </span>
                  )}
                  {client.creditSolde !== undefined && client.creditSolde > 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold border border-amber-200">
                      Solde credit : {client.creditSolde.toLocaleString("fr-MA")} DH
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total commandes", labelAr: "مجموع الطلبيات", value: commandes.length, color: "text-foreground" },
            { label: "En cours", labelAr: "قيد المعالجة", value: enCours, color: "text-blue-600" },
            { label: "Livrees", labelAr: "تم التسليم", value: livrees, color: "text-primary" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-border bg-card px-4 py-3">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-[10px] text-muted-foreground/60">{s.labelAr}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl border border-border bg-card overflow-hidden">
          {(["commandes", "commande", "catalogue"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs sm:text-sm font-semibold transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              {t === "commandes" ? "Mes commandes" : t === "commande" ? "Passer commande" : "Catalogue"}
            </button>
          ))}
        </div>

        {/* Search + filter — only on commandes and catalogue tabs */}
        {(tab === "commandes" || tab === "catalogue") && (
          <div className="flex gap-2 flex-wrap">
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            {tab === "commandes" && (
              <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none">
                <option value="tous">Tous statuts</option>
                {Object.entries(STATUT_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* COMMANDES TAB */}
        {tab === "commandes" && (
          <div className="flex flex-col gap-3">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="font-semibold">Aucune commande</p>
                <p className="text-sm">لا توجد طلبيات</p>
              </div>
            ) : filtered.map(cmd => {
              const cfg = STATUT_CONFIG[cmd.statut] ?? STATUT_CONFIG.en_attente
              const isExpanded = expandedId === cmd.id
              const total = cmd.lignes.reduce((s, l) => s + (l.prixVente ?? 0) * l.quantite, 0)
              return (
                <div key={cmd.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : cmd.id)}
                    className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-muted/40 transition-colors">
                    <div className={`w-2 h-10 rounded-full shrink-0 ${
                      cmd.statut === "livre" ? "bg-green-500" :
                      cmd.statut === "en_transit" ? "bg-cyan-500" :
                      cmd.statut === "valide" ? "bg-blue-500" :
                      cmd.statut === "refuse" ? "bg-red-400" :
                      "bg-yellow-400"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground text-sm font-mono">{cmd.id.slice(0, 12)}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                          {cfg.label} / {cfg.labelAr}
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span>{cmd.date}</span>
                        <span>{cmd.lignes.length} article{cmd.lignes.length > 1 ? "s" : ""}</span>
                        <span className="font-semibold text-foreground">{total.toFixed(2)} DH</span>
                      </div>
                    </div>
                    <svg className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border px-4 py-4 flex flex-col gap-3 bg-muted/20">
                      {/* Lines table */}
                      <div className="rounded-xl border border-border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted">
                              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Article</th>
                              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Qte</th>
                              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">PV</th>
                              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cmd.lignes.map((l, i) => (
                              <tr key={i} className="border-t border-border">
                                <td className="px-3 py-2 font-medium">{l.articleNom}</td>
                                <td className="px-3 py-2 text-right">{l.quantite} {l.unite || ""}</td>
                                <td className="px-3 py-2 text-right">{(l.prixVente ?? 0).toFixed(2)} DH</td>
                                <td className="px-3 py-2 text-right font-bold text-primary">{((l.prixVente ?? 0) * l.quantite).toFixed(2)} DH</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-primary/30 bg-primary/5">
                              <td colSpan={3} className="px-3 py-2 text-right font-bold text-sm">Total commande</td>
                              <td className="px-3 py-2 text-right font-black text-primary">{total.toFixed(2)} DH</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {cmd.notes && (
                        <div className="px-3 py-2 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-800">
                          <span className="font-semibold">Notes: </span>{cmd.notes}
                        </div>
                      )}
                      {cmd.statut === "refuse" && cmd.motifRefus && (
                        <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-sm text-red-800">
                          <span className="font-semibold">Motif refus: </span>{cmd.motifRefus}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* PASSER COMMANDE TAB */}
        {tab === "commande" && (
          <div className="flex flex-col gap-4">
            {submitSuccess && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-green-50 border border-green-200 text-green-800 font-semibold text-sm">
                <svg className="w-5 h-5 shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Commande envoyee ! Vous serez contacte pour confirmation. / تم ارسال الطلب!
              </div>
            )}
            {submitError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {submitError}
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-foreground text-base">Nouvelle commande / طلبية جديدة</h3>
                  <p className="text-xs text-muted-foreground">{store.today()}</p>
                </div>
                <button onClick={() => setTab("catalogue")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Voir catalogue
                </button>
              </div>

              {/* Article lines */}
              <div className="flex flex-col gap-3">
                {lignes.map((l, i) => {
                  const art = articles.find(a => a.id === l.articleId)
                  const pv = art ? (
                    art.pvMethode === "montant" ? art.pvValeur :
                    art.pvMethode === "pourcentage" ? art.prixAchat * (1 + art.pvValeur / 100) :
                    art.pvValeur
                  ) : 0
                  const lineTotal = pv * Number(l.quantite || 0)
                  return (
                    <div key={i} className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-muted/20">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Article {i + 1}</span>
                        {lignes.length > 1 && (
                          <button onClick={() => removeLigne(i)}
                            className="p-1 text-destructive hover:bg-red-50 rounded-lg transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Article select */}
                      <select
                        value={l.articleId}
                        onChange={e => setLigne(i, { articleId: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="">-- Choisir un produit / اختر منتجا --</option>
                        {articles.filter(a => a.stockDisponible > 0).map(a => (
                          <option key={a.id} value={a.id}>
                            {FAMILLE_ICON[a.famille ?? ""] ?? ""} {a.nom} ({a.nomAr}) — {a.unite}
                          </option>
                        ))}
                      </select>

                      {/* Qty + info */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-foreground">
                            Quantite / الكمية {art ? `(${art.unite})` : ""}
                          </label>
                          <input
                            type="number" min="0.1" step="0.5"
                            placeholder="0"
                            value={l.quantite}
                            onChange={e => setLigne(i, { quantite: e.target.value })}
                            className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-foreground">Sous-total</label>
                          <div className={`px-3 py-2.5 rounded-xl border ${lineTotal > 0 ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"} text-sm font-bold text-primary`}>
                            {lineTotal > 0 ? `${lineTotal.toFixed(2)} DH` : "—"}
                          </div>
                        </div>
                      </div>

                      {art && (
                        <div className="flex gap-2 flex-wrap">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{art.famille}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${art.stockDisponible > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                            {art.stockDisponible > 0 ? `Stock: ${art.stockDisponible} ${art.unite}` : "Rupture"}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}

                <button onClick={addLigne}
                  className="flex items-center gap-2 py-2.5 px-4 rounded-xl border border-dashed border-primary/40 text-primary text-sm font-semibold hover:bg-primary/5 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Ajouter un produit / إضافة منتج
                </button>
              </div>

              {/* Date + Heure livraison + notes */}
              {/* Date livraison — default J+1 */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Date de livraison souhaitee
                  <span className="text-[10px] font-normal text-muted-foreground">(par defaut J+1)</span>
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={dateLivraison}
                    min={getJ1()}
                    onChange={e => setDateLivraison(e.target.value)}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <button type="button" onClick={() => setDateLivraison(getJ1())}
                    className="px-3 py-2 rounded-xl border border-primary text-primary text-xs font-semibold hover:bg-primary/5 transition-colors">
                    J+1
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-foreground">
                    Heure de livraison souhaitee / وقت التسليم المطلوب
                  </label>
                  <input
                    type="time"
                    value={heureLivraison}
                    onChange={e => setHeureLivraison(e.target.value)}
                    className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <div className="flex gap-2 flex-wrap mt-1">
                    {["06:00", "08:00", "10:00", "14:00"].map(h => (
                      <button key={h} type="button" onClick={() => setHeureLivraison(h)}
                        className={`text-[10px] px-2 py-1 rounded-lg border font-semibold transition-colors ${heureLivraison === h ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-foreground">Notes / ملاحظات</label>
                  <textarea
                    rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Instructions speciales de livraison..."
                    className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>

              {/* Total + submit */}
              <div className="flex items-center justify-between gap-4 pt-2 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Total estime</p>
                  <p className="text-xl font-black text-primary">
                    {lignes.reduce((s, l) => {
                      const art = articles.find(a => a.id === l.articleId)
                      if (!art) return s
                      const pv = art.pvMethode === "montant" ? art.pvValeur :
                        art.pvMethode === "pourcentage" ? art.prixAchat * (1 + art.pvValeur / 100) : art.pvValeur
                      return s + pv * Number(l.quantite || 0)
                    }, 0).toFixed(2)} DH
                  </p>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={submitSuccess}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity shadow-md">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Envoyer la commande / ارسال الطلب
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CATALOGUE TAB — avec bouton "Ajouter a la commande" */}
        {tab === "catalogue" && (
          <div className="flex flex-col gap-4">
            {/* Famille filter pills */}
            <div className="flex gap-2 flex-wrap">
              {familles.map(f => (
                <button key={f} onClick={() => setFamilleFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${familleFilter === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                  {FAMILLE_ICON[f] ? `${FAMILLE_ICON[f]} ` : ""}{f}
                </button>
              ))}
            </div>

            {/* Article search */}
            <input
              value={articleSearch} onChange={e => setArticleSearch(e.target.value)}
              placeholder="Rechercher un produit / ابحث عن منتج..."
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredCatalogue.length === 0 ? (
                <div className="col-span-full text-center py-16 text-muted-foreground">
                  <p className="font-semibold">Aucun article</p>
                  <p className="text-sm">لا توجد منتجات</p>
                </div>
              ) : filteredCatalogue.map(art => {
                const inOrder = lignes.some(l => l.articleId === art.id)
                return (
                  <div key={art.id} className={`rounded-2xl border bg-card p-3 flex flex-col gap-2 transition-all ${inOrder ? "border-primary ring-1 ring-primary/30" : "border-border"}`}>
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <p className="font-bold text-foreground text-sm leading-tight">{art.nom}</p>
                        {art.nomAr && <p className="text-[11px] text-muted-foreground">{art.nomAr}</p>}
                      </div>
                      <span className="text-lg shrink-0">{FAMILLE_ICON[art.famille ?? ""] ?? ""}</span>
                    </div>
                    <div className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">{art.unite}</span>
                      <span className={`font-semibold ${art.stockDisponible > 0 ? "text-green-700" : "text-destructive"}`}>
                        {art.stockDisponible > 0 ? "Disponible" : "Rupture"}
                      </span>
                    </div>
                    <button
                      onClick={() => quickAdd(art.id)}
                      disabled={art.stockDisponible === 0}
                      className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${inOrder ? "bg-primary/10 text-primary border border-primary" : art.stockDisponible > 0 ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>
                      {inOrder ? "Dans la commande" : art.stockDisponible > 0 ? "+ Ajouter" : "Indisponible"}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-card px-4 py-3 flex items-center justify-center">
        <p className="text-[11px] text-muted-foreground text-center">
          &copy; 2026 <span className="font-semibold text-foreground">FreshLink Pro</span> By{" "}
          <span className="font-bold text-primary">Jawad</span>
          {" "}&mdash; Tous droits reserves / جميع الحقوق محفوظة
        </p>
      </footer>
    </div>
  )
}
