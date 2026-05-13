"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { store, type Article, type User, type Client, type Commande, DELAI_RECOUVREMENT_LABELS, type DelaiRecouvrement, MODALITE_LABELS, type ModalitePaiement } from "@/lib/store"
import { sendEmail, buildCommandeEmail } from "@/lib/email"

interface Props { user: User }

interface LigneForm {
  articleId: string
  quantite: string    // always the count IN the chosen unit (UM count or base units)
  prixVente: string   // DH per base unit (kg / piece / ...)
  uniteMode: string   // "base" = article.unite, or art.um label = UM mode
}

type CommTab = "nouvelle" | "mes_commandes" | "habitudes"
type ArticleSort = "rotation" | "stock" | "tous"

// How many ms before a commande becomes locked (1 hour)
const EDIT_WINDOW_MS = 60 * 60 * 1000

type FilterKey = "nom" | "taille" | "rotation" | "type" | "proche"

const TAILLE_LABELS: Record<string, string> = {
  "50-100kg": "50–100 kg", "150-300kg": "150–300 kg",
  "350-500kg": "350–500 kg", "500kg+": "+500 kg",
}
const ROTATION_LABELS: Record<string, string> = {
  journalier: "Journalier / يومي", "4j/6": "4j/6", "3/6": "3/6", "2/6": "2/6", moins: "< 2/6",
}
const TYPE_LABELS: Record<string, string> = {
  marchand: "Marchand / بائع",
  snack: "Snack / سناك",
  epicerie: "Epicerie / بقالة",
  boucherie: "Boucherie / جزارة",
  restaurant: "Restaurant / مطعم",
  superette: "Superette / سوبيريت",
  grossiste: "Grossiste / جملة",
  hypermarche: "Hypermarche / هايبر",
  traiteur: "Traiteur / خدمات طعام",
  hotel: "Hotel / فندق",
  marche: "Marche / سوق",
  cafeteria: "Cafeteria / كافيتيريا",
  cantina: "Cantine / مطعم مدرسة",
  collectivite: "Collectivite / جماعة",
  autre: "Autre / أخرى",
}

function distKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function MobileCommercial({ user }: Props) {
  const [articles, setArticles] = useState<Article[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState("")
  const [heurelivraison, setHeureLivraison] = useState("")
  const [lignes, setLignes] = useState<LigneForm[]>([{ articleId: "", quantite: "", prixVente: "", uniteMode: "base" }])

  // Vendeur selector — only admins / resp_commercial can pick a different vendeur
  const isAdmin = user.role === "super_admin" || user.role === "admin" || user.role === "resp_commercial"
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [vendeurId, setVendeurId] = useState(user.id)
  const [vendeurNom, setVendeurNom] = useState(user.name)
  const [gpsLat, setGpsLat] = useState<number | null>(null)
  const [gpsLng, setGpsLng] = useState<number | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsStatus, setGpsStatus] = useState<"loading" | "granted" | "denied">("loading")
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [successWorkflow, setSuccessWorkflow] = useState<string | null>(null)

  // Client filters
  const [filterKey, setFilterKey] = useState<FilterKey>("nom")
  const [searchNom, setSearchNom] = useState("")
  const [filterTaille, setFilterTaille] = useState("")
  const [filterRotation, setFilterRotation] = useState("")
  const [filterType, setFilterType] = useState("")
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Add new client
  const [showAddClient, setShowAddClient] = useState(false)
  const [newClient, setNewClient] = useState({
    nom: "", secteur: user.secteur || "", zone: "",
    type: "epicerie" as Client["type"], typeAutre: "",
    taille: "150-300kg" as Client["taille"],
    typeProduits: "moyenne" as Client["typeProduits"],
    rotation: "journalier" as Client["rotation"],
    telephone: "", email: "", adresse: "",
  })

  // Proximity radius (km) — configurable by prevendeur
  const [proximiteKm, setProximiteKm] = useState(5)
  const [showProximiteSlider, setShowProximiteSlider] = useState(false)

  // Visite sans commande
  const [showVisiteForm, setShowVisiteForm] = useState(false)
  const [visiteClientId, setVisiteClientId] = useState("")
  const [visiteRaison, setVisiteRaison] = useState("")
  const RAISONS_SANS_COMMANDE = [
    "Client absent", "Client a deja du stock", "Client ne veut pas commander",
    "Prix trop eleve", "Probleme de paiement", "Rupture de gamme souhaitee", "Autre",
  ]

  // Tab state
  const [commTab, setCommTab] = useState<CommTab>("nouvelle")
  const [habitudeSearch, setHabitudeSearch] = useState("")

  // Client habits: articleId -> { count, lastDate, qteTotal, dernierQte, dernierQteUM, dernierUM } — computed when client changes
  const [clientHabits, setClientHabits] = useState<Record<string, { count: number; lastDate: string; qteTotal: number; dernierQte: number; dernierQteUM?: number; dernierUM?: string }>>({})
  const [showMissedAlert, setShowMissedAlert] = useState(false)

  // Inline article selector state
  const [articleSearch, setArticleSearch] = useState("")
  const [articleSort, setArticleSort] = useState<ArticleSort>("tous")

  // Global article rotation: how many times each article was ordered across ALL commandes
  const globalRotation = useMemo(() => {
    const map: Record<string, number> = {}
    store.getCommandes().forEach(cmd => {
      cmd.lignes.forEach(l => {
        if (l.articleId) map[l.articleId] = (map[l.articleId] ?? 0) + 1
      })
    })
    return map
  }, [])

  // Inline article list — filtered + sorted
  const pickerArticles = useMemo(() => {
    let list = [...articles]
    if (articleSearch.trim()) {
      const q = articleSearch.trim().toLowerCase()
      list = list.filter(a => a.nom.toLowerCase().includes(q) || a.nomAr.includes(q) || a.famille.toLowerCase().includes(q))
    }
    if (articleSort === "rotation") list.sort((a, b) => (globalRotation[b.id] ?? 0) - (globalRotation[a.id] ?? 0))
    else if (articleSort === "stock") list.sort((a, b) => b.stockDisponible - a.stockDisponible)
    else list.sort((a, b) => a.nom.localeCompare(b.nom))
    return list
  }, [articles, articleSearch, articleSort, globalRotation])

  // Articles sorted by habit frequency for current client
  const sortedArticles = useMemo(() => {
    if (!selectedClientId || Object.keys(clientHabits).length === 0) return articles
    return [...articles].sort((a, b) => {
      const fa = clientHabits[a.id]?.count ?? 0
      const fb = clientHabits[b.id]?.count ?? 0
      return fb - fa
    })
  }, [articles, clientHabits, selectedClientId])

  // Articles in habits but NOT in current cart — ordered more than 30 days ago
  const missedArticles = useMemo(() => {
    if (!selectedClientId || Object.keys(clientHabits).length === 0) return []
    const inCart = new Set(lignes.map(l => l.articleId))
    const threshold = new Date(); threshold.setDate(threshold.getDate() - 30)
    const thresholdStr = threshold.toISOString().slice(0, 10)
    return Object.entries(clientHabits)
      .filter(([artId, h]) => !inCart.has(artId) && h.count >= 2 && h.lastDate < thresholdStr)
      .sort(([,a],[,b]) => b.count - a.count)
      .slice(0, 5)
      .map(([artId]) => articles.find(a => a.id === artId))
      .filter(Boolean) as Article[]
  }, [clientHabits, lignes, articles, selectedClientId])

  // My commandes — show last 7 days (not only today) so prevendeur can always see their history
  const [myCommandes, setMyCommandes] = useState(
    store.getCommandes().filter(c => c.commercialId === user.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 50)
  )
  const refreshMyCommandes = () =>
    setMyCommandes(
      store.getCommandes().filter(c => c.commercialId === user.id)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 50)
    )

  // Edit commande state — opens inline editor
  const [editCmd, setEditCmd] = useState<Commande | null>(null)
  const [editLignes, setEditLignes] = useState<LigneForm[]>([])
  const [editHeure, setEditHeure] = useState("")
  const [editSaving, setEditSaving] = useState(false)

  // Check if a commande is still within 1-hour edit window
  const canEdit = (cmd: Commande) => {
    // Use date + current time. Since we only store date (YYYY-MM-DD), we allow edits
    // all day if statut is still en_attente or en_attente_approbation
    if (cmd.statut === "livre" || cmd.statut === "en_transit" || cmd.statut === "retour" || cmd.statut === "refuse") return false
    // Check creation time via localStorage timestamp if stored, otherwise allow if today
    const ts = typeof window !== "undefined"
      ? parseInt(localStorage.getItem(`fl_cmd_ts_${cmd.id}`) ?? "0", 10)
      : 0
    if (ts > 0) return Date.now() - ts < EDIT_WINDOW_MS
    return cmd.date === store.today()  // fallback: allow if today's commande
  }

  const openEdit = (cmd: Commande) => {
    setEditCmd(cmd)
    setEditHeure(cmd.heurelivraison)
    setEditLignes(cmd.lignes.map(l => {
      const art = articles.find(a => a.id === l.articleId)
      const inUMMode = !!(l.quantiteUM && l.um && art?.um === l.um)
      return {
        articleId: l.articleId,
        quantite: inUMMode ? String(l.quantiteUM) : String(l.quantite),
        prixVente: String(l.prixVente),
        uniteMode: inUMMode ? (art?.um ?? "base") : "base",
      }
    }))
    setCommTab("mes_commandes")
  }

  const handleSaveEdit = async () => {
    if (!editCmd) return
    setEditSaving(true)
    const all = store.getCommandes()
    const idx = all.findIndex(c => c.id === editCmd.id)
    if (idx >= 0) {
      const lignesData = editLignes.map(l => {
        const art = articles.find(a => a.id === l.articleId)!
        const pv = Number(l.prixVente) || store.computePV(art)
        const inUMMode = !!(art.um && art.colisageParUM && l.uniteMode === art.um)
        const qtyUM = inUMMode ? Number(l.quantite) : undefined
        const qtyBase = inUMMode ? Number(l.quantite) * (art.colisageParUM ?? 1) : Number(l.quantite)
        return {
          articleId: l.articleId, articleNom: art.nom, unite: art.unite,
          um: art.um, colisageParUM: art.colisageParUM, quantiteUM: qtyUM,
          quantite: qtyBase, prixUnitaire: pv, prixVente: pv,
          prixUM: inUMMode && art.colisageParUM ? pv * art.colisageParUM : undefined,
          total: qtyBase * pv,
        }
      })
      all[idx] = { ...all[idx], lignes: lignesData, heurelivraison: editHeure }
      store.saveCommandes(all)
      refreshMyCommandes()
    }
    setEditSaving(false)
    setEditCmd(null)
  }

  useEffect(() => {
    setArticles(store.getArticles())
    setClients(store.getClients())
    if (isAdmin) setAllUsers(store.getUsers().filter(u => ["prevendeur","resp_commercial","team_leader","admin","super_admin"].includes(u.role) && u.actif))
    // Pull fresh data from Supabase in background to hydrate habits
    import("@/lib/supabase/db").then(async (db) => {
      try {
        const [cmdsFromSB, { clients: cFromSB }, arts] = await Promise.all([
          db.fetchCommandes(),
          db.fetchClients(),
          db.fetchArticles(),
        ])
        if (cmdsFromSB?.length) refreshMyCommandes()
        if (cFromSB?.length) setClients(cFromSB)
        if (arts?.length) setArticles(arts)
      } catch { /* offline — localStorage already shown */ }
    })
  }, [])

  // Auto-capture GPS on mount — GPS is MANDATORY
  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus("denied"); return }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGpsLat(pos.coords.latitude)
        setGpsLng(pos.coords.longitude)
        setGpsStatus("granted")
      },
      () => { setGpsStatus("denied") },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }, [])

  // Auto-fill heure de livraison from client's saved default when client changes
  useEffect(() => {
    if (!selectedClientId) return
    const client = clients.find(c => c.id === selectedClientId)
    if (client?.defaultHeureLivraison) {
      setHeureLivraison(client.defaultHeureLivraison)
    }
    setHabitudeSearch(clients.find(c => c.id === selectedClientId)?.nom || "")
  }, [selectedClientId, clients])

  // Compute article habits from past commandes for selected client
  // Depends on both selectedClientId AND articles so it re-runs once articles are loaded
  useEffect(() => {
    if (!selectedClientId) { setClientHabits({}); return }
    // Guard: if articles not yet loaded, skip (will re-run when articles arrive)
    if (articles.length === 0) return
    const allCmds = store.getCommandes()
    const pastCmds = allCmds
      .filter(c => c.clientId === selectedClientId)
      .sort((a, b) => a.date.localeCompare(b.date))   // oldest first so dernierQte = latest

    if (pastCmds.length === 0) {
      setClientHabits({})
      setShowMissedAlert(false)
      return
    }

    const habitsMap: Record<string, { count: number; lastDate: string; qteTotal: number; dernierQte: number; dernierQteUM?: number; dernierUM?: string }> = {}
    pastCmds.forEach(cmd => {
      cmd.lignes.forEach(l => {
        if (!l.articleId) return
        if (!habitsMap[l.articleId]) habitsMap[l.articleId] = { count: 0, lastDate: "", qteTotal: 0, dernierQte: 0 }
        const qte = l.quantite ?? 0
        habitsMap[l.articleId].count    += 1
        habitsMap[l.articleId].qteTotal += qte
        // Since sorted oldest→newest, the last cmd we encounter is the most recent
        if (!habitsMap[l.articleId].lastDate || cmd.date >= habitsMap[l.articleId].lastDate) {
          habitsMap[l.articleId].lastDate  = cmd.date
          habitsMap[l.articleId].dernierQte = qte
          // Also store UM info if the order used UM
          if (l.quantiteUM && l.um) {
            habitsMap[l.articleId].dernierQteUM = l.quantiteUM
            habitsMap[l.articleId].dernierUM = l.um
          } else {
            habitsMap[l.articleId].dernierQteUM = undefined
            habitsMap[l.articleId].dernierUM = undefined
          }
        }
      })
    })
    // Only keep habits for articles that still exist in the catalog
    const validMap: typeof habitsMap = {}
    Object.entries(habitsMap).forEach(([artId, h]) => {
      if (articles.some(a => a.id === artId)) validMap[artId] = h
    })
    setClientHabits(validMap)
    setShowMissedAlert(false)
  }, [selectedClientId, articles])

  const getGPS = () => {
    setGpsLoading(true)
    setGpsStatus("loading")
    if (!navigator.geolocation) { setGpsStatus("denied"); setGpsLoading(false); return }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGpsLat(pos.coords.latitude)
        setGpsLng(pos.coords.longitude)
        setGpsStatus("granted")
        setGpsLoading(false)
      },
      () => { setGpsStatus("denied"); setGpsLoading(false) },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  // Filter clients — prevendeur only sees their own (by secteur or prevendeurId) unless admin
  const myClients = clients.filter(c => {
    if (user.role === "prevendeur") {
      // match by prevendeurId if set, else fall back to secteur
      if (c.prevendeurId) return c.prevendeurId === user.id
      return !c.secteur || c.secteur === user.secteur
    }
    return true
  })

  const filteredClients = myClients.filter(c => {
    if (filterKey === "nom") return c.nom.toLowerCase().includes(searchNom.toLowerCase())
    if (filterKey === "taille") return filterTaille === "" || c.taille === filterTaille
    if (filterKey === "rotation") return filterRotation === "" || c.rotation === filterRotation
    if (filterKey === "type") return filterType === "" || c.type === filterType
    if (filterKey === "proche") {
      if (!gpsLat || !gpsLng || !c.gpsLat || !c.gpsLng) return true
      return distKm(gpsLat, gpsLng, c.gpsLat, c.gpsLng) <= proximiteKm
    }
    return true
  }).sort((a, b) => {
    if (filterKey === "proche" && gpsLat && gpsLng && a.gpsLat && b.gpsLat) {
      return distKm(gpsLat!, gpsLng!, a.gpsLat, a.gpsLng ?? 0) - distKm(gpsLat!, gpsLng!, b.gpsLat, b.gpsLng ?? 0)
    }
    return a.nom.localeCompare(b.nom)
  })

  const selectedClient = clients.find(c => c.id === selectedClientId)

  const openGPSGuide = (c: Client) => {
    if (!c.gpsLat || !c.gpsLng) return
    const lat = c.gpsLat
    const lng = c.gpsLng
    // Use geo: URI for native apps (Android/iOS), fallback to google maps web
    const isIOS = /iphone|ipad|ipod/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "")
    const url = isIOS
      ? `maps:0,0?q=${lat},${lng}`
      : `https://maps.google.com/maps?q=${lat},${lng}`
    const link = document.createElement("a")
    link.href = url
    link.target = "_blank"
    link.rel = "noopener noreferrer"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleAddClient = () => {
    if (!newClient.nom.trim()) return
    const client: Client = {
      id: store.genId(),
      nom: newClient.nom,
      secteur: newClient.secteur,
      zone: newClient.zone,
      type: newClient.type,
      typeAutre: newClient.typeAutre,
      taille: newClient.taille,
      typeProduits: newClient.typeProduits,
      rotation: newClient.rotation,
      telephone: newClient.telephone,
      email: newClient.email,
      adresse: newClient.adresse,
      gpsLat: gpsLat ?? undefined,
      gpsLng: gpsLng ?? undefined,
      createdBy: user.id,
      createdAt: store.today(),
      prevendeurId: user.id,
    }
    store.addClient(client)
    setClients(store.getClients())
    setSelectedClientId(client.id)
    setShowAddClient(false)
    setNewClient({ nom: "", secteur: user.secteur || "", zone: "", type: "epicerie", typeAutre: "",
      taille: "150-300kg", typeProduits: "moyenne", rotation: "journalier",
      telephone: "", email: "", adresse: "" })
  }

  // Returns the quantity in BASE units (kg/piece/...) regardless of input mode
  const baseQty = (l: LigneForm): number => {
    const art = articles.find(a => a.id === l.articleId)
    if (!art || !l.quantite) return 0
    const raw = Number(l.quantite)
    if (art.um && art.colisageParUM && l.uniteMode === art.um) {
      return raw * art.colisageParUM   // e.g. 3 caisses × 10 kg = 30 kg
    }
    return raw   // already in base units
  }

  const updateLigne = (i: number, field: keyof LigneForm, value: string) => {
    const updated = [...lignes]
    updated[i] = { ...updated[i], [field]: value }
    if (field === "articleId") {
      const art = articles.find(a => a.id === value)
      if (art) {
        updated[i].prixVente = store.computePV(art).toString()
        updated[i].uniteMode = "base"   // reset to base unit on article change
        updated[i].quantite = ""
      }
    }
    setLignes(updated)
  }

  const totalGeneral = lignes.reduce((sum, l) => {
    if (!l.articleId || !l.quantite || !l.prixVente) return sum
    return sum + baseQty(l) * Number(l.prixVente)
  }, 0)

  const totalTonnage = lignes.reduce((sum, l) => {
    if (!l.articleId || !l.quantite) return sum
    return sum + baseQty(l)
  }, 0)

  const handleSubmit = async () => {
    const valid = lignes.every(l => l.articleId && Number(l.quantite) > 0)
    if (!valid || !selectedClientId || !heurelivraison) return
    setSending(true)
    const client = clients.find(c => c.id === selectedClientId)!
    const lignesData = lignes.map(l => {
      const art = articles.find(a => a.id === l.articleId)!
      const pv = Number(l.prixVente) || store.computePV(art)
      const inUMMode = !!(art.um && art.colisageParUM && l.uniteMode === art.um)
      const qtyUM = inUMMode ? Number(l.quantite) : undefined
      const qtyBase = baseQty(l)   // always kg / base unit
      return {
        articleId: l.articleId,
        articleNom: art.nom,
        unite: art.unite,
        // UM fields
        um: art.um,
        colisageParUM: art.colisageParUM,
        quantiteUM: qtyUM,
        // quantite = base units (kg/piece/...)
        quantite: qtyBase,
        prixUnitaire: pv,
        prixVente: pv,
        prixUM: inUMMode && art.colisageParUM ? pv * art.colisageParUM : undefined,
        total: qtyBase * pv,
      }
    })

    // Read workflow config — determine initial statut
    // Also check if client has a team_lead (then route to en_attente_approbation regardless)
    const workflow = store.getWorkflowConfig()
    const teamLeadId = client.teamLeadId
    const teamLead = teamLeadId ? store.getUsers().find(u => u.id === teamLeadId) : null
    const statutInitial: "en_attente" | "valide" | "en_attente_approbation" =
      workflow.validationCommande === "direct" && !teamLeadId ? "valide" : "en_attente_approbation"

    const commande = {
      id: store.genCommande(), date: store.today(),
      commercialId: vendeurId, commercialNom: vendeurNom,
      clientId: client.id, clientNom: client.nom,
      secteur: client.secteur, zone: client.zone,
      gpsLat: client.gpsLat ?? gpsLat ?? 0,
      gpsLng: client.gpsLng ?? gpsLng ?? 0,
      lignes: lignesData, heurelivraison,
      statut: statutInitial,
      emailDestinataire: store.getEmailConfig().commercial,
      teamLeadId: teamLeadId,
      teamLeadNom: teamLead?.name,
    }
    store.addCommande(commande)
    // Persist heurelivraison as the default for this client (auto-filled next time)
    if (heurelivraison) {
      const allClients = store.getClients()
      const cIdx = allClients.findIndex(c => c.id === client.id)
      if (cIdx >= 0 && allClients[cIdx].defaultHeureLivraison !== heurelivraison) {
        allClients[cIdx] = { ...allClients[cIdx], defaultHeureLivraison: heurelivraison }
        store.saveClients(allClients)
      }
    }
    // Save creation timestamp for 1-hour edit window
    try { localStorage.setItem(`fl_cmd_ts_${commande.id}`, String(Date.now())) } catch { /* noop */ }
    // Record visite
    store.addVisite({
      id: store.genId(),
      date: store.today(),
      prevendeurId: vendeurId,
      prevendeurNom: vendeurNom,
      clientId: client.id,
      clientNom: client.nom,
      commandeId: commande.id,
      resultat: "commande",
      gpsLat: gpsLat ?? undefined,
      gpsLng: gpsLng ?? undefined,
    })
    await sendEmail({ to_email: commande.emailDestinataire, subject: `Commande - ${client.nom} - ${store.today()}`, body: buildCommandeEmail(commande) })
    setSuccess(true); setSending(false)
    setSuccessWorkflow(workflow.validationCommande)
    // Reset form for next order — do NOT clear everything, just articles
    setLignes([{ articleId: "", quantite: "", prixVente: "", uniteMode: "base" }])
    setHeureLivraison("")
    // Keep client selected so prevendeur can quickly add another order for same client
    // but clear the client after 4s so they can pick another
    refreshMyCommandes()
    setTimeout(() => {
      setSuccess(false)
      setSuccessWorkflow(null)
      setSelectedClientId("")  // now clear so they can pick next client
    }, 4000)
  }

  const handleVisiteSansCommande = () => {
    if (!visiteClientId || !visiteRaison) return
    const client = clients.find(c => c.id === visiteClientId)
    if (!client) return
    store.addVisite({
      id: store.genId(),
      date: store.today(),
      prevendeurId: user.id,
      prevendeurNom: user.name,
      clientId: client.id,
      clientNom: client.nom,
      resultat: "sans_commande",
      raisonSansCommande: visiteRaison,
      gpsLat: gpsLat ?? undefined,
      gpsLng: gpsLng ?? undefined,
    })
    setVisiteClientId("")
    setVisiteRaison("")
    setShowVisiteForm(false)
  }

  // Auto-fill panier from client's last order
  const autoFillPanier = () => {
    if (!selectedClientId) return
    const lastCmd = store.getCommandes()
      .filter(c => c.clientId === selectedClientId)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    if (!lastCmd) return
    const newLignes: LigneForm[] = lastCmd.lignes
      .filter(l => l.articleId)
      .map(l => {
        const art = articles.find(a => a.id === l.articleId)
        const pv = art ? store.computePV(art) : (l.prixVente ?? 0)
        // Restore UM mode if the last order used UM
        const wasUM = !!(l.quantiteUM && l.um && art?.um && art.um === l.um && art.colisageParUM)
        const displayQty = wasUM
          ? String(l.quantiteUM)   // show UM count (e.g. 3 Caisses)
          : String(l.quantite)     // show base units (e.g. 90 kg)
        return {
          articleId: l.articleId,
          quantite: displayQty,
          prixVente: String(pv),
          uniteMode: wasUM ? (art!.um as string) : "base",
        }
      })
    if (newLignes.length > 0) {
      setLignes(newLignes)
      setCommTab("nouvelle")
    }
  }

  const handleDeleteCommande = (id: string) => {
    store.deleteCommande(id)
    refreshMyCommandes()
  }

  // ── GPS blocking screens ──────────────────────────────────────────────────
  if (gpsStatus === "loading") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
          <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">Activation GPS en cours...</p>
          <p className="text-sm text-muted-foreground mt-1">جارٍ تفعيل تحديد الموقع...</p>
          <p className="text-xs text-muted-foreground mt-3">Veuillez autoriser l&apos;accès à votre position lorsque le navigateur vous le demande.</p>
        </div>
        <button onClick={getGPS} disabled={gpsLoading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "oklch(0.38 0.2 260)" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Réessayer
        </button>
      </div>
    )
  }

  if (gpsStatus === "denied") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-bold text-red-600">GPS requis / تحديد الموقع مطلوب</p>
          <p className="text-sm text-foreground mt-2 font-medium">L&apos;activation du GPS est indispensable pour utiliser l&apos;application prévendeur.</p>
          <p className="text-sm text-muted-foreground mt-1">يجب تفعيل تحديد الموقع لاستخدام تطبيق البائع.</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left text-xs text-amber-800 flex flex-col gap-1.5 w-full max-w-sm">
          <p className="font-bold text-sm">Comment activer le GPS :</p>
          <p>• Sur iPhone : Réglages → Confidentialité → Service de localisation → Activer</p>
          <p>• Sur Android : Paramètres → Localisation → Activer</p>
          <p>• Dans votre navigateur : cliquez sur le cadenas 🔒 dans la barre d&apos;adresse → Localisation → Autoriser</p>
        </div>
        <button onClick={getGPS} disabled={gpsLoading}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 w-full max-w-sm justify-center"
          style={{ background: "oklch(0.38 0.2 260)" }}>
          {gpsLoading
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Localisation en cours...</>
            : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Réessayer l&apos;activation GPS</>}
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 flex flex-col gap-4 pb-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">
          Prise de Commande <span className="text-muted-foreground font-normal text-base">/ تسجيل الطلبية</span>
        </h2>
        <p className="text-xs text-muted-foreground">{user.name} — {store.today()}</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted">
        <button onClick={() => { setCommTab("nouvelle"); setEditCmd(null) }}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${commTab === "nouvelle" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          Nouvelle commande
        </button>
        <button onClick={() => setCommTab("mes_commandes")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${commTab === "mes_commandes" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          Mes cmds
          {myCommandes.length > 0 && (
            <span className="w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ background: "oklch(0.38 0.2 260)" }}>
              {myCommandes.length}
            </span>
          )}
        </button>
        <button onClick={() => setCommTab("habitudes")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${commTab === "habitudes" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          Habitudes
          {Object.keys(clientHabits).length > 0 && (
            <span className="w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center bg-amber-500">
              {Object.keys(clientHabits).length}
            </span>
          )}
        </button>
      </div>

      {commTab === "nouvelle" && (<>

      {success && (
        <div className={`rounded-xl p-4 flex items-start gap-3 border ${successWorkflow === "direct" ? "bg-green-50 border-green-300" : "bg-amber-50 border-amber-300"}`}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${successWorkflow === "direct" ? "bg-green-100" : "bg-amber-100"}`}>
            <svg className={`w-5 h-5 ${successWorkflow === "direct" ? "text-green-600" : "text-amber-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {successWorkflow === "direct"
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              }
            </svg>
          </div>
          <div className="flex-1">
            <p className={`text-sm font-bold ${successWorkflow === "direct" ? "text-green-700" : "text-amber-700"}`}>
              {successWorkflow === "direct" ? "Commande validee directement" : "Commande en attente d'approbation"}
            </p>
            <p className={`text-xs mt-0.5 ${successWorkflow === "direct" ? "text-green-600" : "text-amber-600"}`}>
              {successWorkflow === "direct"
                ? "La commande est automatiquement validee et sera preparee pour livraison."
                : "Votre commande a ete soumise et attend l'approbation d'un responsable. Elle ne sera traitee qu'apres validation."}
            </p>
            {successWorkflow !== "direct" && (
              <p className="text-[11px] mt-1 font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg inline-block">
                Statut: EN ATTENTE APPROBATION
              </p>
            )}
          </div>
        </div>
      )}

      {/* VENDEUR SELECTOR — admin / resp_commercial only */}
      {isAdmin && (
        <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2">
          <label className="text-sm font-bold text-foreground flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Vendeur / البائع
          </label>
          <select
            value={vendeurId}
            onChange={e => {
              const u = allUsers.find(u => u.id === e.target.value)
              setVendeurId(e.target.value)
              setVendeurNom(u?.name || user.name)
            }}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            {allUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name} — {u.role}</option>
            ))}
          </select>
        </div>
      )}

      {/* CLIENT SELECTION */}
      <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Client / الزبون</h3>
          <button onClick={() => setShowAddClient(!showAddClient)}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-dashed border-primary/40 text-primary hover:bg-primary/5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nouveau client
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {([
            { key: "nom", label: "Nom" },
            { key: "proche", label: "Le plus proche" },
            { key: "taille", label: "Taille" },
            { key: "rotation", label: "Rotation" },
            { key: "type", label: "Type" },
          ] as { key: FilterKey; label: string }[]).map(f => (
            <button key={f.key} onClick={() => { setFilterKey(f.key); setShowClientDropdown(true) }}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filterKey === f.key ? "text-white" : "bg-muted text-muted-foreground"}`}
              style={filterKey === f.key ? { background: "oklch(0.38 0.2 260)" } : {}}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Filter inputs */}
        {filterKey === "nom" && (
          <div className="relative" ref={dropdownRef}>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={searchNom} onChange={e => { setSearchNom(e.target.value); setShowClientDropdown(true) }}
              onFocus={() => setShowClientDropdown(true)}
              placeholder="Rechercher un client..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        )}
        {filterKey === "taille" && (
          <select value={filterTaille} onChange={e => { setFilterTaille(e.target.value); setShowClientDropdown(true) }}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Toutes les tailles</option>
            {Object.entries(TAILLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
        {filterKey === "rotation" && (
          <select value={filterRotation} onChange={e => { setFilterRotation(e.target.value); setShowClientDropdown(true) }}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Toutes les rotations</option>
            {Object.entries(ROTATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
        {filterKey === "type" && (
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setShowClientDropdown(true) }}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Tous les types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
        {filterKey === "proche" && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {gpsLat ? `Position: ${gpsLat.toFixed(4)}, ${gpsLng?.toFixed(4)}` : "Localisation en cours..."}
              </p>
              <button onClick={() => setShowProximiteSlider(p => !p)}
                className="text-xs text-primary font-semibold hover:underline">
                Rayon: {proximiteKm} km
              </button>
            </div>
            {showProximiteSlider && (
              <div className="flex items-center gap-3 px-1">
                <span className="text-xs text-muted-foreground">1 km</span>
                <input type="range" min={1} max={50} step={1} value={proximiteKm}
                  onChange={e => setProximiteKm(Number(e.target.value))}
                  className="flex-1 accent-primary" />
                <span className="text-xs text-muted-foreground">50 km</span>
              </div>
            )}
          </div>
        )}

        {/* Dropdown list */}
        <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
          {filteredClients.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-3 text-center">Aucun client trouvé</p>
          ) : filteredClients.map(c => {
            const dist = gpsLat && c.gpsLat ? distKm(gpsLat, gpsLng!, c.gpsLat, c.gpsLng!) : null
            return (
              <button key={c.id} onClick={() => { setSelectedClientId(c.id); setShowClientDropdown(false) }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border ${selectedClientId === c.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/60"}`}>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {c.nom[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{c.nom}</p>
                  <p className="text-xs text-muted-foreground">{c.secteur} · {TYPE_LABELS[c.type]} · {TAILLE_LABELS[c.taille]}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {dist !== null && <span className="text-xs text-muted-foreground">{dist.toFixed(1)}km</span>}
                  {c.gpsLat && (
                    <div role="button" tabIndex={0}
                      onClick={e => { e.stopPropagation(); openGPSGuide(c) }}
                      onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); openGPSGuide(c) }}}
                      className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer select-none">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {selectedClient && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: "oklch(0.38 0.2 260 / 0.08)", border: "1px solid oklch(0.38 0.2 260 / 0.2)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "oklch(0.38 0.2 260)" }}>
              {selectedClient.nom[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">{selectedClient.nom}</p>
              <p className="text-xs text-muted-foreground">{selectedClient.telephone} · {selectedClient.secteur}</p>
            </div>
            {selectedClient.gpsLat && (
              <button onClick={() => openGPSGuide(selectedClient)} title="Itinéraire"
                className="p-2 rounded-xl text-white flex items-center gap-1 text-xs font-semibold"
                style={{ background: "oklch(0.60 0.16 195)" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                Guide
              </button>
            )}
            {selectedClient.telephone && (
              <a href={`https://wa.me/${selectedClient.telephone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                className="p-2 rounded-xl flex items-center gap-1 text-xs font-semibold text-white"
                style={{ background: "#25D366" }}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" /></svg>
                WA
              </a>
            )}
          </div>
        )}
      </div>

      {/* ADD NEW CLIENT FORM */}
      {showAddClient && (
        <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-foreground">Nouveau client / زبون جديد</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground">Nom *</label>
              <input type="text" value={newClient.nom} onChange={e => setNewClient({ ...newClient, nom: e.target.value })}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Nom du client" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground">Téléphone</label>
              <input type="tel" value={newClient.telephone} onChange={e => setNewClient({ ...newClient, telephone: e.target.value })}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="0661234567" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground">Secteur</label>
              <input type="text" value={newClient.secteur} onChange={e => setNewClient({ ...newClient, secteur: e.target.value })}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground">Type</label>
              <select value={newClient.type} onChange={e => setNewClient({ ...newClient, type: e.target.value as Client["type"] })}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {newClient.type === "autre" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Type (préciser)</label>
                <input type="text" value={newClient.typeAutre} onChange={e => setNewClient({ ...newClient, typeAutre: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground">Taille / capacité</label>
              <select value={newClient.taille} onChange={e => setNewClient({ ...newClient, taille: e.target.value as Client["taille"] })}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                {Object.entries(TAILLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground">Rotation</label>
              <select value={newClient.rotation} onChange={e => setNewClient({ ...newClient, rotation: e.target.value as Client["rotation"] })}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                {Object.entries(ROTATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground">Gamme produits</label>
              <select value={newClient.typeProduits} onChange={e => setNewClient({ ...newClient, typeProduits: e.target.value as Client["typeProduits"] })}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="haute_gamme">Haute gamme</option>
                <option value="moyenne">Moyenne gamme</option>
                <option value="entree_gamme">Entrée de gamme</option>
              </select>
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground">Adresse</label>
              <input type="text" value={newClient.adresse} onChange={e => setNewClient({ ...newClient, adresse: e.target.value })}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Rue, ville..." />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground">Email (optionnel)</label>
              <input type="email" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            {/* Credit section */}
            <div className="col-span-2 border-t border-border pt-3 flex flex-col gap-2">
              <p className="text-xs font-bold text-foreground uppercase tracking-wide">Credit / الائتمان</p>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                  <input type="checkbox"
                    checked={!!(newClient as { creditAutorise?: boolean }).creditAutorise}
                    onChange={e => setNewClient({ ...newClient, creditAutorise: e.target.checked } as typeof newClient)}
                    className="w-4 h-4 rounded accent-primary" />
                  Credit autorise
                </label>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Delai de recouvrement</label>
                <select
                  value={(newClient as { delaiRecouvrement?: string }).delaiRecouvrement ?? ""}
                  onChange={e => setNewClient({ ...newClient, delaiRecouvrement: e.target.value as DelaiRecouvrement } as typeof newClient)}
                  className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">-- Non defini --</option>
                  {Object.entries(DELAI_RECOUVREMENT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {gpsLat && <p className="text-xs text-green-600">Position GPS actuelle sera associée au client</p>}
          <div className="flex gap-2">
            <button onClick={() => setShowAddClient(false)}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted">Annuler</button>
            <button onClick={handleAddClient} disabled={!newClient.nom.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "oklch(0.38 0.2 260)" }}>Créer le client</button>
          </div>
        </div>
      )}

      {/* Heure livraison */}
      <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-foreground">
            Heure de livraison <span className="text-muted-foreground font-normal">/ وقت التسليم</span>
          </label>
          {(() => {
            const cl = clients.find(c => c.id === selectedClientId)
            if (cl?.defaultHeureLivraison && cl.defaultHeureLivraison === heurelivraison) {
              return (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
                  Horaire habituel
                </span>
              )
            }
            return null
          })()}
        </div>
        <input type="time" value={heurelivraison} onChange={e => setHeureLivraison(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        <p className="text-[11px] text-muted-foreground">
          L&apos;horaire sera enregistre comme defaut pour ce client apres confirmation de la commande.
        </p>
      </div>

      {/* GPS capture — coordinates hidden, only status indicator shown */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card">
        <button onClick={getGPS} disabled={gpsLoading}
          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${gpsLat ? "text-green-700" : "text-muted-foreground"}`}>
          {gpsLoading
            ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            : <svg className={`w-3.5 h-3.5 ${gpsLat ? "text-green-600" : "text-muted-foreground"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>}
          {gpsLat ? "GPS capturé" : "GPS non capturé"}
        </button>
        {/* Coordinates intentionally hidden from prevendeur screen */}
      </div>

      {/* ── HABITUDES TAB ─────────────────────────────────────────────────── */}
      {(commTab as string) === "habitudes" && (
        <div className="flex flex-col gap-3">

          {/* ── Alertes rapides ─────────────────────────── */}
          {(() => {
            const today = store.today()
            const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().slice(0,10)
            const visites = store.getVisites ? store.getVisites() : []
            const visitedIds = new Set(visites.filter(v => v.date >= sevenDaysAgo).map(v => v.clientId))
            const notVisited = myClients.filter(c => !visitedIds.has(c.id)).slice(0, 3)
            const pendingToday = store.getCommandes().filter(c => c.date === today && c.commercialId === user.id && (c.statut === "en_attente" || c.statut === "en_attente_approbation")).length
            if (notVisited.length === 0 && pendingToday === 0) return null
            return (
              <div className="flex flex-col gap-2">
                {pendingToday > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200">
                    <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    <p className="text-xs font-semibold text-blue-800">{pendingToday} commande(s) en attente aujourd&apos;hui</p>
                  </div>
                )}
                {notVisited.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col gap-1.5">
                    <p className="text-xs font-bold text-amber-800">Clients non visites depuis 7 jours</p>
                    {notVisited.map(c => (
                      <div key={c.id} className="flex items-center justify-between">
                        <span className="text-xs text-amber-700 font-semibold">{c.nom}</span>
                        <button onClick={() => { setSelectedClientId(c.id); setHabitudeSearch(c.nom) }}
                          className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-500 text-white">
                          Voir habitudes
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Client selector — shown directly in habitudes tab so user doesn't need to go to "nouvelle" first */}
          <div className="bg-card rounded-xl border border-border p-3 flex flex-col gap-2">
            <p className="text-xs font-bold text-foreground">Client / الزبون</p>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                placeholder="Rechercher un client..."
                value={habitudeSearch}
                onChange={e => {
                  setHabitudeSearch(e.target.value)
                  const q = e.target.value.toLowerCase()
                  const found = myClients.find(c => c.nom.toLowerCase() === q)
                  if (found) setSelectedClientId(found.id)
                }}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {/* Quick client list */}
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {myClients.filter(c => {
                const q = habitudeSearch.toLowerCase()
                return !q || c.nom.toLowerCase().includes(q) || c.id === selectedClientId
              }).slice(0, 8).map(c => (
                <button key={c.id} onClick={() => setSelectedClientId(c.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm transition-all ${selectedClientId === c.id ? "bg-primary/10 border border-primary/30 font-semibold text-primary" : "hover:bg-muted text-foreground"}`}>
                  <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">{c.nom[0]}</span>
                  <span className="truncate">{c.nom}</span>
                  {selectedClientId === c.id && <svg className="w-4 h-4 ml-auto shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Habitudes du client</p>
                <p className="text-xs text-muted-foreground">
                  {selectedClientId
                    ? Object.keys(clientHabits).length > 0
                      ? `${Object.keys(clientHabits).length} articles commandes regulierement`
                      : "Aucun historique pour ce client"
                    : "Selectionnez un client ci-dessus"}
                </p>
              </div>
            </div>
            {selectedClientId && Object.keys(clientHabits).length > 0 && (
              <button onClick={autoFillPanier}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                style={{ background: "oklch(0.38 0.2 260)" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Preparer panier automatique
              </button>
            )}
          </div>
          {selectedClientId && Object.keys(clientHabits).length > 0 && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Article</th>
                      <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Dernière Qté</th>
                      <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Moy.</th>
                      <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Cmds</th>
                      <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Dernière date</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(clientHabits)
                      .sort(([, a], [, b]) => b.count - a.count)
                      .map(([artId, habit]) => {
                        const art = articles.find(a => a.id === artId)
                        if (!art) return null
                        const pv = store.computePV(art)
                        const inCart = lignes.some(l => l.articleId === artId)
                        const avgBase = habit.count > 0 ? habit.qteTotal / habit.count : 0
                        const dernQte = habit.dernierQteUM && habit.dernierUM
                          ? `${habit.dernierQteUM} ${habit.dernierUM}`
                          : `${habit.dernierQte} ${art.unite}`
                        const moyQte = art.um && art.colisageParUM && avgBase >= art.colisageParUM
                          ? `${(avgBase / art.colisageParUM).toFixed(1)} ${art.um}`
                          : `${avgBase.toFixed(1)} ${art.unite}`
                        const inactivityDays = store.getAlertConfig?.()?.inactivityDays ?? 30
                        const halfDays = Math.round(inactivityDays / 2)
                        const isStale = habit.lastDate < new Date(Date.now() - halfDays*24*60*60*1000).toISOString().slice(0,10)
                        return (
                          <tr key={artId} className={`border-b border-border last:border-0 transition-colors ${inCart ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground truncate max-w-[120px]">{art.nom}</span>
                                {isStale && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-100 text-red-600 shrink-0">+{halfDays}j</span>}
                                {art.stockDisponible <= 0 && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-orange-100 text-orange-600 shrink-0">Rupture</span>}
                              </div>
                              <div className="text-[10px] text-muted-foreground">{pv} DH/{art.unite}</div>
                            </td>
                            <td className="px-3 py-2.5 text-center font-semibold text-foreground">{dernQte}</td>
                            <td className="px-3 py-2.5 text-center text-blue-700 font-semibold">{moyQte}</td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{habit.count}x</span>
                            </td>
                            <td className="px-3 py-2.5 text-center text-muted-foreground">{habit.lastDate}</td>
                            <td className="px-3 py-2.5 text-right">
                              {inCart ? (
                                <span className="text-[10px] font-bold text-primary">✓ Panier</span>
                              ) : (
                                <button
                                  disabled={art.stockDisponible <= 0}
                                  onClick={() => {
                                    const hasUM = !!(habit.dernierQteUM && habit.dernierUM && art.um && habit.dernierUM === art.um)
                                    const prefillQty = hasUM ? String(habit.dernierQteUM) : String(habit.dernierQte > 0 ? habit.dernierQte : "")
                                    const prefillMode = hasUM ? art.um! : "base"
                                    const emptyIdx = lignes.findIndex(l => !l.articleId)
                                    const newLigne: LigneForm = { articleId: artId, quantite: prefillQty, prixVente: String(pv), uniteMode: prefillMode }
                                    if (emptyIdx >= 0) { const updated = [...lignes]; updated[emptyIdx] = newLigne; setLignes(updated) }
                                    else setLignes(prev => [...prev, newLigne])
                                    setCommTab("nouvelle")
                                  }}
                                  className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40">
                                  Renouveler
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {selectedClientId && Object.keys(clientHabits).length === 0 && (
            <div className="bg-card rounded-xl border border-border p-8 flex flex-col items-center gap-3 text-center">
              <svg className="w-10 h-10 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm font-semibold text-muted-foreground">Aucune habitude enregistree</p>
              <p className="text-xs text-muted-foreground">Les habitudes se creent automatiquement apres plusieurs commandes passees par ce client.</p>
            </div>
          )}
        </div>
      )}

      {/* placeholder to close previous structure */}
      {/* INLINE ARTICLE SELECTOR ─────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-sm font-bold text-foreground">Articles / المنتجات</p>
            <p className="text-xs text-muted-foreground">{pickerArticles.length} articles</p>
          </div>
          {selectedClientId && Object.keys(clientHabits).length > 0 && (
            <button onClick={autoFillPanier}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-amber-300 text-amber-700 bg-amber-50">
              Auto-panier
            </button>
          )}
        </div>

        {/* Search field */}
        <div className="px-3 py-2.5 border-b border-border">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-background">
            <svg className="w-4 h-4 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={articleSearch} onChange={e => setArticleSearch(e.target.value)}
              placeholder="Rechercher par nom..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
            {articleSearch && (
              <button onClick={() => setArticleSearch("")} className="text-muted-foreground hover:text-foreground">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>

        {/* Sort toggles */}
        <div className="flex gap-2 px-3 py-2 border-b border-border">
          {([
            { key: "stock",    label: "Trier par stock" },
            { key: "rotation", label: "Best sellers" },
            { key: "tous",     label: "Alphabetique" },
          ] as { key: ArticleSort; label: string }[]).map(s => (
            <button key={s.key} onClick={() => setArticleSort(s.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${articleSort === s.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Checkbox list */}
        <div className="max-h-72 overflow-y-auto divide-y divide-border">
          {pickerArticles.length === 0 ? (
            <div className="py-8 flex flex-col items-center gap-2 text-center">
              <p className="text-sm text-muted-foreground">Aucun article trouve</p>
              <button onClick={() => setArticleSearch("")} className="text-xs text-primary underline">Effacer</button>
            </div>
          ) : pickerArticles.map(a => {
            const inCart = lignes.some(l => l.articleId === a.id)
            const stockOk = a.stockDisponible > 0
            const pv = store.computePV(a)
            const globalCount = globalRotation[a.id] ?? 0
            const habitCount = clientHabits[a.id]?.count ?? 0
            return (
              <label key={a.id}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${inCart ? "bg-primary/5" : stockOk ? "hover:bg-muted/50" : "opacity-40 pointer-events-none"}`}>
                <input type="checkbox" checked={inCart} readOnly={false}
                  onChange={e => {
                    if (e.target.checked) {
                      const emptyIdx = lignes.findIndex(l => !l.articleId)
                      if (emptyIdx >= 0) updateLigne(emptyIdx, "articleId", a.id)
                      else setLignes(prev => [...prev, { articleId: a.id, quantite: "", prixVente: String(pv), uniteMode: "base" }])
                    } else {
                      const idx = lignes.findIndex(l => l.articleId === a.id)
                      if (idx >= 0) {
                        if (lignes.length === 1) setLignes([{ articleId: "", quantite: "", prixVente: "", uniteMode: "base" }])
                        else setLignes(prev => prev.filter((_, j) => j !== idx))
                      }
                    }
                  }}
                  className="w-4 h-4 rounded accent-primary shrink-0" />
                <img src={a.photo || "https://placehold.co/40x40/e2e8f0/64748b?text=Art"}
                  alt={`${a.nom} produit frais article`}
                  className="w-10 h-10 rounded-xl object-cover border border-border shrink-0"
                  onError={e => { e.currentTarget.src = "https://placehold.co/40x40/e2e8f0/64748b?text=Art" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{a.nom}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    {(() => {
                      const vs = store.getVirtualStock(a.id)
                      const ok = vs.available > 0
                      return (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-lg ${ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {ok ? `${vs.available} ${a.unite} dispo` : "Rupture"}
                          {vs.pending > 0 && ok && <span className="ml-1 font-normal text-slate-600">(-{vs.pending} en cmd)</span>}
                        </span>
                      )
                    })()}
                    {globalCount > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-lg bg-blue-100 text-blue-700">{globalCount} cmd</span>}
                    {habitCount >= 2 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-lg bg-amber-100 text-amber-700">{habitCount}x client</span>}
                  </div>
                </div>
                <span className="text-sm font-bold text-primary shrink-0">{pv} DH</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* ARTICLES lines ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">

        {lignes.map((ligne, i) => {
          const art = articles.find(a => a.id === ligne.articleId)
          const pvCalc = art ? store.computePV(art) : 0
          return (
            <div key={i} className="bg-card rounded-xl border border-border p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Article #{i + 1}</span>
                {lignes.length > 1 && (
                  <button onClick={() => setLignes(lignes.filter((_, j) => j !== i))} className="text-destructive p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>

              {/* Article display — tap to open picker */}
              {art ? (
                <div className="flex items-center gap-3 p-2 rounded-xl border border-primary/30 bg-primary/5">
                  <img src={art.photo || "https://placehold.co/48x48/e2e8f0/64748b?text=Art"}
                    alt={`${art.nom} produit selectionne`}
                    className="w-12 h-12 rounded-xl object-cover border border-border shrink-0"
                    onError={e => { e.currentTarget.src = "https://placehold.co/48x48/e2e8f0/64748b?text=Art" }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-sm">{art.nom}</p>
                    <p className="text-xs text-muted-foreground" dir="rtl">{art.nomAr}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-lg ${art.stockDisponible > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                        Stock: {art.stockDisponible} {art.unite}
                      </span>
                      {(clientHabits[art.id]?.count ?? 0) >= 2 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-lg bg-amber-100 text-amber-700 font-semibold">
                          {clientHabits[art.id].count}x commande(s)
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => updateLigne(i, "articleId", "")}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : (
                <div className="px-3 py-3 rounded-xl border-2 border-dashed border-border/50 text-center">
                  <p className="text-xs text-muted-foreground">Cochez un article ci-dessus pour remplir cette ligne</p>
                </div>
              )}

              {art && (() => {
                const vStock = store.getVirtualStock(art.id)
                const isPrev = user.role === "prevendeur"
                const canEditPrice = !isPrev && (user.role === "admin" || user.role === "super_admin" || user.role === "resp_commercial")
                return (
                  <div className="flex flex-col gap-1.5 px-1">
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      {/* PA hidden for prevendeur role */}
                      {!isPrev && (
                        <>
                          <span className="text-slate-500">PA: <strong className="text-slate-900">{art.prixAchat} DH/{art.unite}</strong></span>
                          <span className="text-slate-300">·</span>
                        </>
                      )}
                      <span className="text-slate-500">PV: <strong className="text-green-700">{pvCalc} DH/{art.unite}</strong></span>
                      {art.um && art.colisageParUM && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-blue-700 font-semibold">{art.um} = {art.colisageParUM} {art.unite}</span>
                        </>
                      )}
                    </div>
                    {/* ATP — Available-to-Promise stock indicator (high contrast) */}
                    <div className={`rounded-xl border-2 px-3 py-2 flex flex-col gap-1 ${
                      vStock.available > 0
                        ? "bg-emerald-50 border-emerald-400"
                        : vStock.physical > 0
                          ? "bg-amber-50 border-amber-400"
                          : "bg-red-50 border-red-500"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <svg className={`w-3.5 h-3.5 shrink-0 ${vStock.available > 0 ? "text-emerald-700" : "text-red-700"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={vStock.available > 0 ? "M5 13l4 4L19 7" : "M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} />
                          </svg>
                          <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                            ATP — Disponible a la vente
                          </span>
                        </div>
                        <span className={`text-sm font-black ${vStock.available > 0 ? "text-emerald-800" : "text-red-800"}`}>
                          {vStock.available} {art.unite}
                        </span>
                      </div>
                      {vStock.pending > 0 && (
                        <div className="flex items-center justify-between text-[11px] font-medium text-slate-900 border-t border-slate-200/60 pt-1 mt-0.5">
                          <span>Stock physique: <strong className="text-slate-900">{vStock.physical} {art.unite}</strong></span>
                          <span className="text-amber-800 font-bold">- {vStock.pending} en cmds en attente</span>
                        </div>
                      )}
                      {vStock.available === 0 && vStock.physical === 0 && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-900 bg-red-100 rounded-lg px-2 py-1 mt-0.5">
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                          Demande d&apos;Achat (DA) sera declenchee automatiquement
                        </div>
                      )}
                      {vStock.available === 0 && vStock.physical > 0 && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 bg-amber-100 rounded-lg px-2 py-1 mt-0.5">
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Stock virtuel epuise — tout le physique est en commandes en attente
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* UM / Unite mode selector — simple 2-button toggle */}
              {art && art.um && art.colisageParUM && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">
                      Saisir par / وحدة الطلب
                    </label>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                      1 {art.um} = {art.colisageParUM} {art.unite}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {/* Base unit button — single atomic update to avoid stale-closure */}
                    <button type="button"
                      onClick={() => {
                        setLignes(prev => {
                          const updated = [...prev]
                          const cur = Number(updated[i].quantite) || 0
                          const isUM = updated[i].uniteMode === art.um
                          const newQty = isUM && cur > 0 ? String(cur * art.colisageParUM!) : updated[i].quantite
                          updated[i] = { ...updated[i], uniteMode: "base", quantite: newQty }
                          return updated
                        })
                      }}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${ligne.uniteMode !== art.um ? "border-green-500 text-white" : "border-border bg-background text-foreground"}`}
                      style={ligne.uniteMode !== art.um ? { background: "oklch(0.45 0.18 145)" } : {}}>
                      <span className="text-sm font-black">{art.unite}</span>
                      <span className="block text-[10px] font-normal opacity-80 mt-0.5">unite de base</span>
                    </button>
                    {/* UM button — single atomic update */}
                    <button type="button"
                      onClick={() => {
                        setLignes(prev => {
                          const updated = [...prev]
                          const cur = Number(updated[i].quantite) || 0
                          const isBase = updated[i].uniteMode !== art.um
                          const newQty = isBase && cur > 0 && art.colisageParUM
                            ? String(Math.round((cur / art.colisageParUM!) * 100) / 100)
                            : updated[i].quantite
                          updated[i] = { ...updated[i], uniteMode: art.um!, quantite: newQty }
                          return updated
                        })
                      }}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${ligne.uniteMode === art.um ? "border-blue-500 text-white" : "border-border bg-background text-blue-700"}`}
                      style={ligne.uniteMode === art.um ? { background: "oklch(0.45 0.18 240)" } : {}}>
                      <span className="text-sm font-black">{art.um}</span>
                      <span className="block text-[10px] font-normal opacity-80 mt-0.5">= {art.colisageParUM} {art.unite}</span>
                    </button>
                  </div>
                  {/* Live bidirectional conversion display */}
                  {ligne.quantite && Number(ligne.quantite) > 0 && (() => {
                    const qty = Number(ligne.quantite)
                    const isUM = ligne.uniteMode === art.um
                    if (isUM) {
                      // UM mode → show base total
                      const baseTotal = qty * art.colisageParUM!
                      return (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-300">
                          <svg className="w-4 h-4 text-blue-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          <span className="text-sm font-black text-blue-900">
                            {qty} {art.um} &rarr; <strong>{baseTotal % 1 === 0 ? baseTotal : baseTotal.toFixed(1)} {art.unite}</strong>
                          </span>
                        </div>
                      )
                    } else {
                      // Base mode → show UM equivalent
                      const umEquiv = qty / art.colisageParUM!
                      const umWhole = Math.floor(umEquiv)
                      const remainder = qty - umWhole * art.colisageParUM!
                      return (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${remainder === 0 ? "bg-green-50 border-green-300" : "bg-amber-50 border-amber-300"}`}>
                          <svg className="w-4 h-4 shrink-0" style={{ color: remainder === 0 ? "#166534" : "#92400e" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          <span className={`text-sm font-black ${remainder === 0 ? "text-green-900" : "text-amber-900"}`}>
                            {qty} {art.unite} &rarr;&nbsp;
                            {remainder === 0
                              ? <strong>{umWhole} {art.um}</strong>
                              : <><strong>{umWhole} {art.um}</strong> + {remainder} {art.unite} hors UM</>
                            }
                          </span>
                        </div>
                      )
                    }
                  })()}
                </div>
              )}

              {(() => {
                const isPrev = user.role === "prevendeur"
                const canEditPx = !isPrev && (user.role === "admin" || user.role === "super_admin" || user.role === "resp_commercial" || user.role === "team_leader")
                return (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-800">
                        Qte ({ligne.uniteMode === art?.um ? art?.um : art?.unite || "unite"}) / الكمية
                      </label>
                      <input type="number" min="0" step={ligne.uniteMode === art?.um ? "1" : "0.5"}
                        value={ligne.quantite} onChange={e => updateLigne(i, "quantite", e.target.value)}
                        className="px-3 py-2 rounded-xl border border-border bg-background text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary" placeholder="0" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-bold text-slate-800">
                          PV DH/{art?.unite || "unite"} / السعر
                        </label>
                        {isPrev && (
                          <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-800 text-white border border-slate-700">
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            PRIX FIXE
                          </span>
                        )}
                      </div>
                      {canEditPx ? (
                        <input type="number" min="0" step="0.01" value={ligne.prixVente}
                          onChange={e => updateLigne(i, "prixVente", e.target.value)}
                          className="px-3 py-2 rounded-xl border border-border bg-background text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary" placeholder="0.00" />
                      ) : (
                        <div className="px-3 py-2 rounded-xl border-2 border-slate-300 bg-slate-100 text-sm font-black text-slate-900 select-none cursor-not-allowed flex items-center justify-between gap-2">
                          <span>{ligne.prixVente || art ? (Number(ligne.prixVente) || (art ? store.computePV(art) : 0)).toFixed(2) : "—"} DH</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">Verrou</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {art && ligne.quantite && Number(ligne.quantite) > 0 && (() => {
                const bq = baseQty(ligne)
                const vStock = store.getVirtualStock(art.id)
                const ok = bq <= vStock.available
                const needPR = !ok && bq > vStock.physical
                return (
                  <div className={`flex items-start justify-between text-xs rounded-xl px-3 py-2 gap-2 ${
                    ok ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"
                  }`}>
                    <div className="flex flex-col gap-0.5">
                      <span className={`font-bold ${ok ? "text-emerald-800" : "text-red-700"}`}>
                        {ok ? "Stock disponible" : needPR ? "DA auto-declenchee" : "Stock virtuel insuffisant"}
                        {" "}&mdash; {bq.toFixed(1)} {art.unite} demandes
                      </span>
                      {!ok && (
                        <span className="text-red-600 font-normal">
                          {needPR
                            ? `Stock physique insuffisant (${vStock.physical} ${art.unite}) — une DA sera creee automatiquement`
                            : `${vStock.pending} ${art.unite} deja en commande en attente (stock virtuel = ${vStock.available} ${art.unite})`
                          }
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-slate-900 shrink-0">
                      {(bq * Number(ligne.prixVente || pvCalc)).toLocaleString("fr-MA", { minimumFractionDigits: 2 })} DH
                    </span>
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>

      {/* Totals */}
      <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Tonnage total / إجمالي الوزن</span>
          <span className="font-bold text-foreground">{totalTonnage.toLocaleString("fr-MA")} kg</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-bold text-foreground">
            Total Commande / مجموع الطلبية
          </span>
          <span className="text-xl font-extrabold text-green-600">
            {totalGeneral.toLocaleString("fr-MA", { minimumFractionDigits: 2 })} DH
          </span>
        </div>
      </div>

      {/* Articles not ordered recently — shown before confirm */}
      {selectedClientId && missedArticles.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl overflow-hidden">
          <button onClick={() => setShowMissedAlert(s => !s)}
            className="w-full flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-bold text-amber-800">
                {missedArticles.length} article(s) non commandes depuis longtemps
              </p>
            </div>
            <svg className={`w-4 h-4 text-amber-600 transition-transform ${showMissedAlert ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showMissedAlert && (
            <div className="px-4 pb-4 flex flex-col gap-2">
              <p className="text-xs text-amber-700">Ces articles ont ete commandes par ce client mais pas recemment. Voulez-vous les ajouter ?</p>
              {missedArticles.map(art => (
                <div key={art.id} className="flex items-center justify-between bg-white rounded-xl border border-amber-200 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{art.nom}</p>
                    <p className="text-xs text-muted-foreground">
                      Derniere commande : {clientHabits[art.id]?.lastDate ?? "—"}
                      {" "}· {clientHabits[art.id]?.count}x commande(s)
                    </p>
                  </div>
                  <button onClick={() => {
                    const pv = store.computePV(art)
                    const hab = clientHabits[art.id]
                    const hasUM = !!(hab?.dernierQteUM && hab?.dernierUM && art.um && hab.dernierUM === art.um)
                    const dq = hab?.dernierQte ?? 0
                    const prefillQty = hasUM ? String(hab!.dernierQteUM) : dq > 0 ? String(dq) : ""
                    const prefillMode = hasUM ? art.um! : "base"
                    setLignes(prev => [...prev, { articleId: art.id, quantite: prefillQty, prixVente: String(pv), uniteMode: prefillMode }])
                  }}
                    className="ml-3 px-3 py-1.5 rounded-xl text-xs font-bold text-white shrink-0"
                    style={{ background: "oklch(0.65 0.17 145)" }}>
                    + Ajouter
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      <button onClick={handleSubmit}
        disabled={sending || !selectedClientId || !heurelivraison || lignes.some(l => !l.articleId || !l.quantite)}
        className="w-full py-4 rounded-xl font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
        style={{ background: "oklch(0.65 0.17 145)" }}>
        {sending
          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Envoi...</>
          : <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>Enregistrer la commande / تسجيل الطلبية</>}
      </button>

      {/* ── VISITE SANS COMMANDE ───────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Visite sans commande / زيارة بدون طلب</h3>
            <p className="text-xs text-muted-foreground">Enregistrer une visite client non convertie</p>
          </div>
          <button onClick={() => setShowVisiteForm(v => !v)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-dashed border-amber-400 text-amber-700 hover:bg-amber-50">
            {showVisiteForm ? "Annuler" : "+ Visite"}
          </button>
        </div>
        {showVisiteForm && (
          <div className="flex flex-col gap-3">
            <select value={visiteClientId} onChange={e => setVisiteClientId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Choisir un client</option>
              {filteredClients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground">Raison / السبب *</label>
              <div className="flex flex-wrap gap-2">
                {RAISONS_SANS_COMMANDE.map(r => (
                  <button key={r} type="button" onClick={() => setVisiteRaison(r)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${visiteRaison === r ? "bg-amber-500 text-white border-amber-500" : "border-border text-muted-foreground hover:bg-muted"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleVisiteSansCommande}
              disabled={!visiteClientId || !visiteRaison}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-colors">
              Enregistrer la visite
            </button>
          </div>
        )}
      </div>

      {/* END nouvelle commande tab */}
      </>)}

      {/* ── MES COMMANDES TAB ─────────────────────────────────────── */}
      {commTab === "mes_commandes" && (
        <div className="flex flex-col gap-3">
          {myCommandes.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-10 text-center">
              <svg className="w-10 h-10 mx-auto text-muted-foreground mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm font-semibold text-muted-foreground">Aucune commande aujourd&apos;hui</p>
              <button onClick={() => setCommTab("nouvelle")} className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "oklch(0.38 0.2 260)" }}>
                Passer une commande
              </button>
            </div>
          ) : (
            <>
              {/* Edit form */}
              {editCmd && (
                <div className="bg-card rounded-2xl border border-primary/30 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">Modifier — {editCmd.clientNom}</p>
                      <p className="text-xs text-muted-foreground">Modification possible dans le delai d&apos;1 heure apres creation</p>
                    </div>
                    <button onClick={() => setEditCmd(null)} className="p-1.5 rounded-lg bg-muted text-muted-foreground">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>

                  {/* Edit heure livraison */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-foreground">Heure de livraison</label>
                    <input type="time" value={editHeure} onChange={e => setEditHeure(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>

                  {/* Edit article lignes */}
                  {editLignes.map((ligne, i) => {
                    const art = articles.find(a => a.id === ligne.articleId)
                    return (
                      <div key={i} className="bg-muted/30 rounded-xl p-3 flex flex-col gap-2">
                        <p className="text-xs font-semibold text-foreground">{art?.nom ?? "Article"}</p>
                        {art?.um && art.colisageParUM && (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => { const u = [...editLignes]; u[i] = { ...u[i], uniteMode: "base", quantite: "" }; setEditLignes(u) }}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${ligne.uniteMode !== art.um ? "border-primary text-white" : "border-border text-muted-foreground"}`}
                              style={ligne.uniteMode !== art.um ? { background: "oklch(0.45 0.18 145)" } : {}}>
                              {art.unite}
                            </button>
                            <button type="button" onClick={() => { const u = [...editLignes]; u[i] = { ...u[i], uniteMode: art.um!, quantite: "" }; setEditLignes(u) }}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${ligne.uniteMode === art.um ? "border-blue-500 text-white" : "border-border text-blue-600"}`}
                              style={ligne.uniteMode === art.um ? { background: "oklch(0.45 0.18 240)" } : {}}>
                              {art.um} = {art.colisageParUM}{art.unite}
                            </button>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Qte ({ligne.uniteMode === art?.um ? art?.um : art?.unite})</label>
                            <input type="number" min="0" value={ligne.quantite}
                              onChange={e => { const u = [...editLignes]; u[i] = { ...u[i], quantite: e.target.value }; setEditLignes(u) }}
                              className="px-3 py-2 rounded-lg border border-border bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">PV DH/{art?.unite}</label>
                            <input type="number" min="0" step="0.01" value={ligne.prixVente}
                              onChange={e => { const u = [...editLignes]; u[i] = { ...u[i], prixVente: e.target.value }; setEditLignes(u) }}
                              className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                          </div>
                        </div>
                        {art?.um && art.colisageParUM && ligne.uniteMode === art.um && ligne.quantite && Number(ligne.quantite) > 0 && (
                          <p className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg">
                            {ligne.quantite} {art.um} = {(Number(ligne.quantite) * art.colisageParUM).toFixed(1)} {art.unite}
                          </p>
                        )}
                      </div>
                    )
                  })}

                  <div className="flex gap-2">
                    <button onClick={() => setEditCmd(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted">Annuler</button>
                    <button onClick={handleSaveEdit} disabled={editSaving}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                      style={{ background: "oklch(0.38 0.2 260)" }}>
                      {editSaving ? "Sauvegarde..." : "Enregistrer modifications"}
                    </button>
                  </div>
                </div>
              )}

              {/* Commandes list — grouped by date */}
              {(() => {
                // Group commandes by date for visual clarity
                const grouped: Record<string, typeof myCommandes> = {}
                myCommandes.forEach(cmd => {
                  if (!grouped[cmd.date]) grouped[cmd.date] = []
                  grouped[cmd.date].push(cmd)
                })
                return Object.entries(grouped)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([date, cmds]) => (
                    <div key={date} className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${date === store.today() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {date === store.today() ? "Aujourd\'hui" : date}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[11px] text-muted-foreground">{cmds.length} cmd(s)</span>
                      </div>
                      {cmds.map(cmd => {
                const total = cmd.lignes.reduce((s, l) => s + l.total, 0)
                const tonn  = cmd.lignes.reduce((s, l) => s + l.quantite, 0)
                const editable = canEdit(cmd)
                const isActive = editCmd?.id === cmd.id
                return (
                  <div key={cmd.id} className={`rounded-xl border p-4 flex flex-col gap-2.5 ${isActive ? "border-primary/50 bg-primary/3" : "border-border bg-card"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-foreground">{cmd.clientNom}</p>
                        <p className="text-xs text-muted-foreground">{cmd.secteur} · {cmd.heurelivraison}</p>
                        <p className="text-xs text-muted-foreground font-mono">{cmd.id}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        cmd.statut === "valide" ? "bg-blue-100 text-blue-700" :
                        cmd.statut === "livre" ? "bg-green-100 text-green-700" :
                        cmd.statut === "en_attente_approbation" ? "bg-orange-100 text-orange-700" :
                        "bg-yellow-100 text-yellow-700"}`}>
                        {cmd.statut}
                      </span>
                    </div>

                    {/* Article lines summary */}
                    <div className="flex flex-col gap-1">
                      {cmd.lignes.map((l, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-foreground">{l.articleNom}</span>
                          <span className="font-semibold text-muted-foreground">
                            {l.quantiteUM ? `${l.quantiteUM} ${l.um} = ` : ""}{l.quantite} {l.unite} · {l.total.toLocaleString("fr-MA")} DH
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <span className="text-xs text-amber-600 font-semibold">{tonn.toLocaleString("fr-MA")} kg</span>
                      <span className="text-sm font-extrabold text-primary">{total.toLocaleString("fr-MA")} DH</span>
                    </div>

                    <div className="flex gap-2">
                      {editable && !isActive && (
                        <button onClick={() => openEdit(cmd)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border border-primary/30 text-primary hover:bg-primary/5 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          Modifier (1h)
                        </button>
                      )}
                      {editable && (
                        <button onClick={() => handleDeleteCommande(cmd.id)}
                          className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors border border-red-200">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Supprimer
                        </button>
                      )}
                      {!editable && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground px-2">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                          Verrouillee
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
                    </div>
                  ))
              })()}
            </>
          )}
        </div>
      )}
    </div>
  )
}
