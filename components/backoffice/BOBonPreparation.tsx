"use client"

import { useState, useEffect, useRef } from "react"
import {
  store, type User, type BonPreparation, type LignePreparation,
  type ModePreparation, type TypePreparation, type FormatPreparation,
  type Trip, type Commande, type Article, type ClientSequenceInfo,
  type SequenceModePrep,
} from "@/lib/store"

interface Props { user: User }

const MODE_LABELS: Record<ModePreparation, { label: string; desc: string }> = {
  par_trip:    { label: "Par Trip",    desc: "Un bon global pour tout le chargement du trip" },
  par_client:  { label: "Par Client",  desc: "Un bon détaillé par client" },
  par_article: { label: "Par Article", desc: "Regroupement par article pour le picking au stock" },
}

function StatusBadge({ s }: { s: BonPreparation["statut"] }) {
  const styles: Record<BonPreparation["statut"], string> = {
    brouillon: "bg-gray-100 text-gray-700 border-gray-200",
    en_cours:  "bg-amber-100 text-amber-800 border-amber-200",
    valide:    "bg-green-100 text-green-700 border-green-200",
  }
  const labels: Record<BonPreparation["statut"], string> = {
    brouillon: "Brouillon", en_cours: "En cours", valide: "Validé",
  }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[s]}`}>
      {labels[s]}
    </span>
  )
}

// ── Sort clients by chosen mode ──────────────────────────────────────────────
function sortClients(clients: ClientSequenceInfo[], mode: SequenceModePrep): ClientSequenceInfo[] {
  if (mode === "horaire") {
    return [...clients].sort((a, b) => {
      const ta = a.heurelivraison ?? "99:99"
      const tb = b.heurelivraison ?? "99:99"
      return ta.localeCompare(tb)
    })
  }
  // itinéraire = GPS ordre
  return [...clients].sort((a, b) => a.ordre - b.ordre)
}

// ── Print window ─────────────────────────────────────────────────────────────
function openPrintPrep(bon: BonPreparation, commandes: Commande[]) {
  const company = (() => {
    try { return JSON.parse(localStorage.getItem("fl_company") || "{}") } catch { return {} }
  })()
  const companyNom = company.nom || "FreshLink Maroc"
  const companyLogo = company.logo || null
  const companyEmail = company.email || ""
  const companyTel = company.telephone || ""

  const seqMode = bon.sequenceMode ?? "horaire"
  const clientsInfo = bon.clientsInfo ?? []
  const orderedClients = sortClients(clientsInfo, seqMode)

  // Map clientId → nom
  const clientNomMap: Record<string, string> = {}
  orderedClients.forEach(c => { clientNomMap[c.clientId] = c.clientNom })

  // All articles
  const allArticleIds = bon.lignes.map(l => l.articleId)

  const win = window.open("", "_blank", "width=1000,height=750")
  if (!win) return

  win.document.write(`<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8">
<title>Bon Préparation — ${bon.nom}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:9.5pt;color:#111;background:#fff;padding:24px 28px}
  /* HEADER */
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #166534;padding-bottom:14px;margin-bottom:18px}
  .brand h1{font-size:18pt;font-weight:900;color:#166534}
  .brand .sub{font-size:8pt;color:#6b7280;margin-top:3px}
  .brand .contact{font-size:7.5pt;color:#9ca3af;margin-top:4px}
  .doc-meta{text-align:right}
  .doc-meta .type{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280}
  .doc-meta .num{font-size:15pt;font-weight:900;color:#166534}
  .doc-meta .info{font-size:8pt;color:#6b7280;margin-top:3px;line-height:1.6}
  /* META CHIPS */
  .meta-row{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap}
  .chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:7.5pt;font-weight:700;border:1px solid}
  .chip-green{background:#dcfce7;color:#14532d;border-color:#86efac}
  .chip-blue{background:#dbeafe;color:#1d4ed8;border-color:#93c5fd}
  .chip-orange{background:#fff7ed;color:#9a3412;border-color:#fed7aa}
  .chip-gray{background:#f3f4f6;color:#374151;border-color:#d1d5db}
  /* SECTION TITLE */
  .section-title{font-size:8.5pt;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#166534;
    border-bottom:2px solid #166534;padding-bottom:5px;margin-bottom:12px;margin-top:20px}
  /* TOTAUX PAR ARTICLE */
  table.totaux{width:100%;border-collapse:collapse;margin-bottom:4px;font-size:9pt}
  table.totaux thead tr{background:#166534;color:#f0fdf4}
  table.totaux thead th{padding:8px 10px;text-align:left;font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
  table.totaux thead th.r{text-align:right}
  table.totaux tbody tr{border-bottom:1px solid #e5e7eb}
  table.totaux tbody tr:nth-child(even){background:#f9fafb}
  table.totaux tbody td{padding:7px 10px;vertical-align:top}
  td.r{text-align:right}
  td.bold{font-weight:700}
  .sign-box{display:inline-block;border-bottom:1.5px dotted #aaa;width:50px;height:18px;vertical-align:bottom}
  /* TABLEAU CLIENT×ARTICLE */
  table.matrix{width:100%;border-collapse:collapse;font-size:8.5pt;margin-top:4px}
  table.matrix thead tr{background:#1e3a5f;color:#e0f2fe}
  table.matrix thead th{padding:7px 8px;text-align:left;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap}
  table.matrix thead th.r{text-align:right}
  table.matrix tbody tr{border-bottom:1px solid #e5e7eb}
  table.matrix tbody tr:nth-child(even){background:#f8fafc}
  table.matrix tbody td{padding:7px 8px;vertical-align:middle}
  .client-seq{font-size:7pt;font-weight:700;background:#1e3a5f;color:#fff;border-radius:3px;padding:1px 5px;display:inline-block;margin-right:4px}
  .client-heure{font-size:7.5pt;color:#0369a1;font-weight:700}
  .client-zone{font-size:7pt;color:#6b7280}
  .qty-cell{text-align:right;font-weight:700;color:#166534}
  .qty-empty{text-align:right;color:#d1d5db;font-size:8pt}
  .qty-total{text-align:right;font-weight:900;color:#166534;background:#f0fdf4}
  /* SIGNATURES */
  .sigs{display:flex;justify-content:space-between;margin-top:28px;padding-top:18px;border-top:1px solid #e5e7eb}
  .sig{text-align:center;min-width:140px}
  .sig .sig-label{font-size:8pt;font-weight:600;color:#374151;margin-bottom:3px}
  .sig .sig-line{border-bottom:1px solid #9ca3af;height:44px;width:140px}
  .watermark{font-size:7pt;color:#d1d5db;text-align:right;margin-top:10px}
  @media print{body{padding:12px 16px}.no-print{display:none}}
</style>
</head><body>

<!-- HEADER -->
<div class="header">
  <div class="brand">
    ${companyLogo
      ? `<img src="${companyLogo}" style="height:44px;object-fit:contain;margin-bottom:4px" alt="logo"/>`
      : `<h1>${companyNom}</h1>`}
    <div class="sub">Distribution Fruits &amp; Légumes</div>
    <div class="contact">${companyEmail}${companyTel ? " · " + companyTel : ""}</div>
  </div>
  <div class="doc-meta">
    <div class="type">Bon de Préparation</div>
    <div class="num">BP-${bon.id.slice(0,8).toUpperCase()}</div>
    <div class="info">
      Date : ${bon.date}<br/>
      Nom : ${bon.nom}<br/>
      Séquencement : ${seqMode === "horaire" ? "Horaire de livraison" : "Itinéraire GPS"}
    </div>
  </div>
</div>

<!-- META CHIPS -->
<div class="meta-row">
  <span class="chip chip-green">${MODE_LABELS[bon.mode].label}</span>
  <span class="chip chip-blue">${bon.type === "cross_dock" ? "Cross-dock" : "Depuis stock"}</span>
  <span class="chip chip-orange">${bon.format === "numerique" ? "Numérique" : "Papier"}</span>
  <span class="chip chip-gray">${bon.lignes.length} articles</span>
  <span class="chip chip-gray">${orderedClients.length} clients</span>
  <span class="chip chip-gray">${bon.lignes.reduce((s, l) => s + l.qteCommandee, 0).toFixed(1)} kg total</span>
</div>

<!-- SECTION 1 : TOTAUX PAR ARTICLE -->
<div class="section-title">1. Totaux par article — Quantités à préparer</div>
<table class="totaux">
  <thead>
    <tr>
      <th style="width:28px">#</th>
      <th>Article</th>
      <th class="r" style="width:90px">Total Cmd</th>
      <th class="r" style="width:80px">Unité</th>
      <th class="r" style="width:110px">Qté préparée</th>
    </tr>
  </thead>
  <tbody>
    ${bon.lignes.map((l, i) => `
    <tr>
      <td style="color:#9ca3af;font-size:8pt">${i + 1}</td>
      <td class="bold">${l.articleNom}</td>
      <td class="r bold" style="color:#166534">${l.qteCommandee.toFixed(1)}</td>
      <td class="r" style="color:#6b7280">${l.unite}</td>
      <td class="r"><span class="sign-box"></span>&nbsp;${l.unite}</td>
    </tr>`).join("")}
  </tbody>
  <tfoot>
    <tr style="background:#f0fdf4;font-weight:900;font-size:10pt;border-top:2px solid #166534">
      <td colspan="2" style="padding:8px 10px">TOTAL GÉNÉRAL</td>
      <td class="r" style="padding:8px 10px;color:#166534">${bon.lignes.reduce((s, l) => s + l.qteCommandee, 0).toFixed(1)}</td>
      <td class="r" style="padding:8px 10px;color:#6b7280">kg</td>
      <td></td>
    </tr>
  </tfoot>
</table>

<!-- SECTION 2 : RÉPARTITION PAR CLIENT (séquencé) -->
<div class="section-title">2. Répartition par client — Séquence de livraison (${seqMode === "horaire" ? "ordre horaire" : "itinéraire GPS"})</div>
<table class="matrix">
  <thead>
    <tr>
      <th style="width:180px">Client / Secteur</th>
      <th style="width:60px">Heure</th>
      ${allArticleIds.map(id => {
        const l = bon.lignes.find(lg => lg.articleId === id)
        return `<th class="r" style="max-width:80px;white-space:normal">${l?.articleNom || id}<br/><span style="font-weight:400;font-size:7pt">${l?.unite || ""}</span></th>`
      }).join("")}
      <th class="r" style="width:65px">Total kg</th>
    </tr>
  </thead>
  <tbody>
    ${orderedClients.map((ci, idx) => {
      const rowTotal = allArticleIds.reduce((s, artId) => {
        const ligne = bon.lignes.find(l => l.articleId === artId)
        return s + (ligne?.qtesParClient[ci.clientId] ?? 0)
      }, 0)
      return `
      <tr>
        <td>
          <span class="client-seq">${idx + 1}</span>
          <strong>${ci.clientNom}</strong>
          <br/><span class="client-zone">${ci.secteur}${ci.zone ? " — " + ci.zone : ""}</span>
        </td>
        <td><span class="client-heure">${ci.heurelivraison || "—"}</span></td>
        ${allArticleIds.map(artId => {
          const ligne = bon.lignes.find(l => l.articleId === artId)
          const qty = ligne?.qtesParClient[ci.clientId] ?? 0
          if (qty === 0) return `<td class="qty-empty">—</td>`
          return `<td class="qty-cell">${qty.toFixed(1)}</td>`
        }).join("")}
        <td class="qty-total">${rowTotal.toFixed(1)}</td>
      </tr>`
    }).join("")}
  </tbody>
  <tfoot>
    <tr style="background:#166534;color:#fff;font-weight:900">
      <td colspan="2" style="padding:7px 10px">TOTAL PAR ARTICLE</td>
      ${allArticleIds.map(artId => {
        const ligne = bon.lignes.find(l => l.articleId === artId)
        return `<td style="text-align:right;padding:7px 8px">${(ligne?.qteCommandee ?? 0).toFixed(1)}</td>`
      }).join("")}
      <td style="text-align:right;padding:7px 10px">${bon.lignes.reduce((s, l) => s + l.qteCommandee, 0).toFixed(1)}</td>
    </tr>
  </tfoot>
</table>

<!-- SIGNATURES -->
<div class="sigs">
  <div class="sig"><div class="sig-label">Préparé par</div><div class="sig-line"></div></div>
  <div class="sig"><div class="sig-label">Contrôlé par</div><div class="sig-line"></div></div>
  <div class="sig"><div class="sig-label">Responsable</div><div class="sig-line"></div></div>
  <div class="sig"><div class="sig-label">Date &amp; Heure</div><div class="sig-line"></div></div>
</div>
<div class="watermark">FreshLink Pro — Gestion Distribution — Imprimé le ${new Date().toLocaleString("fr-MA")}</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`)
  win.document.close()
}

// ── Main component ───────────────────────────────────────────────────────────
export default function BOBonPreparation({ user }: Props) {
  const [bons, setBons] = useState<BonPreparation[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [showNew, setShowNew] = useState(false)
  const [viewing, setViewing] = useState<BonPreparation | null>(null)

  // form
  const [nom, setNom] = useState("")
  const [nomManual, setNomManual] = useState(false)  // true = user overrode auto-name
  const [mode, setMode] = useState<ModePreparation>("par_article")
  const [type, setType] = useState<TypePreparation>("stockage")
  const [format, setFormat] = useState<FormatPreparation>("papier")
  const [tripId, setTripId] = useState("")
  const [selectedClients, setSelectedClients] = useState<string[]>([])
  const [sequenceMode, setSequenceMode] = useState<SequenceModePrep>("horaire")

  // Auto-generate nom when trip / selection changes (unless user manually edited it)
  const autoNom = (() => {
    const d = store.today()
    if (tripId) {
      const t = trips.find(t => t.id === tripId)
      return `Prep ${d} — ${t?.numero ?? t?.id ?? tripId}`
    }
    const bons = store.getBonsPreparation()
    const seq = String(bons.filter(b => b.date === d).length + 1).padStart(2, "0")
    return `Prep ${d} — #${seq}`
  })()

  useEffect(() => {
    setBons(store.getBonsPreparation())
    setTrips(store.getTrips())
    setCommandes(store.getCommandes())
    setArticles(store.getArticles())
  }, [])

  const refresh = () => setBons(store.getBonsPreparation())

  const cmdsPrepable = commandes.filter(c => c.statut === "valide" || c.statut === "en_transit")
  const tripsEnCours = trips.filter(t => t.statut === "planifié" || t.statut === "en_cours")

  // Build clientsInfo for the chosen selection
  const buildClientsInfo = (cmds: Commande[]): ClientSequenceInfo[] => {
    const seen = new Map<string, ClientSequenceInfo>()
    cmds.forEach((cmd, idx) => {
      if (!seen.has(cmd.clientId)) {
        seen.set(cmd.clientId, {
          clientId: cmd.clientId,
          clientNom: cmd.clientNom,
          secteur: cmd.secteur,
          zone: cmd.zone,
          heurelivraison: cmd.heurelivraison,
          ordre: idx,
          gpsLat: cmd.gpsLat,
          gpsLng: cmd.gpsLng,
        })
      }
    })
    // if trip has GPS itinéraire order, use it
    if (tripId) {
      const trip = trips.find(t => t.id === tripId)
      if (trip?.itineraire) {
        trip.itineraire.forEach(pt => {
          const entry = [...seen.values()].find(c => c.clientNom === pt.clientNom)
          if (entry) entry.ordre = pt.ordre
        })
      }
    }
    return Array.from(seen.values())
  }

  const buildLignes = (): LignePreparation[] => {
    let cmds: Commande[] = []
    if (tripId) {
      const trip = trips.find(t => t.id === tripId)
      if (trip) cmds = commandes.filter(c => trip.commandeIds.includes(c.id))
    } else if (selectedClients.length > 0) {
      cmds = cmdsPrepable.filter(c => selectedClients.includes(c.clientId))
    } else {
      cmds = cmdsPrepable
    }

    const map = new Map<string, LignePreparation>()
    for (const cmd of cmds) {
      for (const ligne of cmd.lignes) {
        const existing = map.get(ligne.articleId)
        const art = articles.find(a => a.id === ligne.articleId)
        if (existing) {
          existing.qteCommandee += ligne.quantite
          existing.qtesParClient[cmd.clientId] = (existing.qtesParClient[cmd.clientId] || 0) + ligne.quantite
        } else {
          map.set(ligne.articleId, {
            articleId: ligne.articleId,
            articleNom: ligne.articleNom,
            unite: ligne.unite ?? art?.unite ?? "kg",
            qtesParClient: { [cmd.clientId]: ligne.quantite },
            qteCommandee: ligne.quantite,
            qtePrepared: 0,
            valide: false,
          })
        }
      }
    }
    return Array.from(map.values())
  }

  const getCmdsForSelection = (): Commande[] => {
    if (tripId) {
      const trip = trips.find(t => t.id === tripId)
      if (trip) return commandes.filter(c => trip.commandeIds.includes(c.id))
    }
    if (selectedClients.length > 0) return cmdsPrepable.filter(c => selectedClients.includes(c.clientId))
    return cmdsPrepable
  }

  const clientsAvailable = [...new Map(cmdsPrepable.map(c => [c.clientId, { id: c.clientId, nom: c.clientNom, heure: c.heurelivraison, secteur: c.secteur }])).values()]

  const effectiveNom = nomManual && nom.trim() ? nom.trim() : autoNom

  const handleCreate = () => {
    if (!effectiveNom.trim()) return
    const lignes = buildLignes()
    if (lignes.length === 0) { alert("Aucune commande à préparer."); return }
    const cmdsForSel = getCmdsForSelection()
    const clientsInfo = buildClientsInfo(cmdsForSel)

    const bon: BonPreparation = {
      id: store.genId(),
      nom: effectiveNom,
      date: store.today(),
      mode,
      type,
      format,
      tripId: tripId || undefined,
      clientIds: selectedClients,
      clientsInfo,
      sequenceMode,
      lignes,
      statut: format === "numerique" ? "en_cours" : "brouillon",
      createdBy: user.id,
    }
    store.addBonPreparation(bon)
    refresh()
    setShowNew(false)
    setNom(""); setNomManual(false); setMode("par_article"); setType("stockage"); setFormat("papier")
    setTripId(""); setSelectedClients([])
    if (format === "papier") {
      setTimeout(() => openPrintPrep(bon, commandes), 300)
    } else {
      const b = store.getBonsPreparation().find(bp => bp.id === bon.id)
      if (b) setViewing(b)
    }
  }

  const validateLigne = (bonId: string, articleId: string, qty: number) => {
    const arr = store.getBonsPreparation()
    const idx = arr.findIndex(b => b.id === bonId)
    if (idx < 0) return
    const li = arr[idx].lignes.findIndex(l => l.articleId === articleId)
    if (li < 0) return
    arr[idx].lignes[li].qtePrepared = qty
    arr[idx].lignes[li].valide = true
    store.saveBonsPreparation(arr)
    refresh()
    if (viewing?.id === bonId) setViewing({ ...arr[idx] })
  }

  const validateAll = (bonId: string) => {
    const arr = store.getBonsPreparation()
    const idx = arr.findIndex(b => b.id === bonId)
    if (idx < 0) return
    arr[idx].lignes = arr[idx].lignes.map(l => ({ ...l, qtePrepared: l.qteCommandee, valide: true }))
    arr[idx].statut = "valide"
    arr[idx].validatedAt = new Date().toISOString()
    arr[idx].validatedBy = user.id
    store.saveBonsPreparation(arr)

    // ── Mise à jour automatique statut commandes liées → "en_preparation" ──
    const bp = arr[idx]
    let linkedCmdIds: string[] = []
    if (bp.tripId) {
      const trip = trips.find(t => t.id === bp.tripId)
      if (trip?.commandeIds) linkedCmdIds = trip.commandeIds
    } else if (bp.clientIds?.length) {
      // Find commandes for these clients (today)
      const today = store.today()
      linkedCmdIds = store.getCommandes()
        .filter(c => bp.clientIds!.includes(c.clientId) && (c.date === today || !c.date))
        .map(c => c.id)
    }
    if (linkedCmdIds.length > 0) {
      const cmds = store.getCommandes()
      const updatedCmds = cmds.map(c =>
        linkedCmdIds.includes(c.id) && ["valide", "en_attente"].includes(c.statut)
          ? { ...c, statut: "en_preparation" as typeof c.statut }
          : c
      )
      store.saveCommandes(updatedCmds)
    }

    refresh()
    if (viewing?.id === bonId) setViewing({ ...arr[idx] })
  }

  const deleteBon = (id: string) => {
    if (!confirm("Supprimer ce bon de préparation ?")) return
    const arr = store.getBonsPreparation().filter(b => b.id !== id)
    store.saveBonsPreparation(arr)
    refresh()
    if (viewing?.id === id) setViewing(null)
  }

  // ── Digital preparation view ──────────────────────────────────────────────
  const DigitalPrepaView = ({ bon }: { bon: BonPreparation }) => {
    const [localQtys, setLocalQtys] = useState<Record<string, number>>(
      Object.fromEntries(bon.lignes.map(l => [l.articleId, l.qtePrepared || l.qteCommandee]))
    )
    const [activeTab, setActiveTab] = useState<"articles" | "clients">("articles")
    const seqMode = bon.sequenceMode ?? "horaire"
    const orderedClients = sortClients(bon.clientsInfo ?? [], seqMode)

    const doneCount = bon.lignes.filter(l => l.valide).length
    const pct = bon.lignes.length > 0 ? Math.round((doneCount / bon.lignes.length) * 100) : 0

    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0"
          style={{ background: "oklch(0.14 0.03 260)" }}>
          <div>
            <h2 className="font-bold text-white text-sm">{bon.nom}</h2>
            <p className="text-xs" style={{ color: "oklch(0.60 0.03 245)" }}>
              {bon.date} · {MODE_LABELS[bon.mode].label}
              {" · "}{bon.sequenceMode === "itineraire" ? "Itinéraire GPS" : "Ordre horaire"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge s={bon.statut} />
            <button onClick={() => setViewing(null)} className="p-2 rounded-lg hover:bg-white/10 text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {bon.statut !== "valide" && (
          <div className="px-4 pt-3 pb-2 shrink-0">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Progression</span>
              <span className="font-bold text-foreground">{pct}% — {doneCount}/{bon.lignes.length} articles</span>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: pct === 100 ? "oklch(0.52 0.18 145)" : "oklch(0.65 0.20 260)" }} />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="px-4 py-2 flex gap-2 shrink-0 border-b border-border">
          <button onClick={() => setActiveTab("articles")}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === "articles" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>
            Par Article ({bon.lignes.length})
          </button>
          <button onClick={() => setActiveTab("clients")}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === "clients" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>
            Par Client ({orderedClients.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">

          {/* === TAB: Articles === */}
          {activeTab === "articles" && bon.lignes.map((ligne) => (
            <div key={ligne.articleId}
              className={`rounded-2xl border p-4 transition-colors ${ligne.valide ? "border-green-200 bg-green-50" : "border-border bg-card"}`}>
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${ligne.valide ? "bg-green-500" : "bg-muted"}`}>
                  {ligne.valide
                    ? <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    : <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" /></svg>
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm">{ligne.articleNom}</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Total commandé : <strong>{ligne.qteCommandee.toFixed(1)} {ligne.unite}</strong>
                  </p>

                  {/* Répartition par client (ordered) */}
                  <div className="flex flex-col gap-1 mb-3">
                    {orderedClients
                      .filter(c => (ligne.qtesParClient[c.clientId] ?? 0) > 0)
                      .map((ci, idx) => (
                        <div key={ci.clientId} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white bg-primary rounded-md px-1.5 py-0.5">{idx + 1}</span>
                            <div>
                              <span className="text-xs font-semibold text-foreground">{ci.clientNom}</span>
                              <span className="text-xs text-muted-foreground ml-1.5">{ci.secteur}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-green-700">{(ligne.qtesParClient[ci.clientId] ?? 0).toFixed(1)} {ligne.unite}</span>
                            {ci.heurelivraison && (
                              <span className="block text-xs text-blue-600">{ci.heurelivraison}</span>
                            )}
                          </div>
                        </div>
                      ))
                    }
                  </div>

                  {/* Input + Valider */}
                  {bon.statut !== "valide" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={localQtys[ligne.articleId] ?? ligne.qteCommandee}
                        onChange={e => setLocalQtys(prev => ({ ...prev, [ligne.articleId]: parseFloat(e.target.value) || 0 }))}
                        className="w-24 px-2 py-1.5 rounded-xl border border-border bg-background text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                        min={0} step={0.5}
                      />
                      <span className="text-xs text-muted-foreground">{ligne.unite}</span>
                      <button
                        onClick={() => validateLigne(bon.id, ligne.articleId, localQtys[ligne.articleId] ?? ligne.qteCommandee)}
                        disabled={ligne.valide}
                        className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${ligne.valide ? "bg-green-100 text-green-700" : "bg-primary text-white hover:opacity-90"}`}>
                        {ligne.valide ? "Validé" : "Valider"}
                      </button>
                    </div>
                  )}
                  {bon.statut === "valide" && (
                    <p className="text-sm font-bold text-green-600">
                      {ligne.qtePrepared.toFixed(1)} {ligne.unite} préparés
                      {ligne.qtePrepared !== ligne.qteCommandee && (
                        <span className="text-xs text-amber-500 ml-2">Ecart: {(ligne.qtePrepared - ligne.qteCommandee).toFixed(1)}</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* === TAB: Clients (sequence order) === */}
          {activeTab === "clients" && orderedClients.map((ci, idx) => {
            const clientTotal = bon.lignes.reduce((s, l) => s + (l.qtesParClient[ci.clientId] ?? 0), 0)
            const clientArticles = bon.lignes.filter(l => (l.qtesParClient[ci.clientId] ?? 0) > 0)
            return (
              <div key={ci.clientId} className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
                    style={{ background: "oklch(0.38 0.2 260)" }}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground">{ci.clientNom}</p>
                    <p className="text-xs text-muted-foreground">{ci.secteur}{ci.zone ? ` — ${ci.zone}` : ""}</p>
                  </div>
                  <div className="text-right">
                    {ci.heurelivraison && (
                      <p className="text-sm font-bold text-blue-700">{ci.heurelivraison}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {sequenceMode === "itineraire" ? `Ordre GPS: #${ci.ordre + 1}` : "Horaire"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {clientArticles.map(l => (
                    <div key={l.articleId} className="flex justify-between items-center px-3 py-2 bg-muted/40 rounded-xl">
                      <span className="text-sm text-foreground font-medium">{l.articleNom}</span>
                      <span className="text-sm font-bold text-green-700">
                        {(l.qtesParClient[ci.clientId] ?? 0).toFixed(1)} {l.unite}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-end">
                  <span className="text-sm font-black text-foreground px-3 py-1 bg-green-50 rounded-xl border border-green-200">
                    Total : {clientTotal.toFixed(1)} kg
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        {bon.statut !== "valide" && (
          <div className="px-4 py-4 border-t border-border bg-card shrink-0 flex gap-3">
            <button onClick={() => setViewing(null)}
              className="flex-1 py-3 rounded-2xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted">
              Fermer
            </button>
            <button onClick={() => validateAll(bon.id)}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white"
              style={{ background: "oklch(0.40 0.16 155)" }}>
              Valider toute la prépa
            </button>
          </div>
        )}
        {bon.statut === "valide" && (
          <div className="px-4 py-4 border-t border-border bg-green-50 shrink-0 flex items-center gap-3">
            <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-bold text-green-700">Préparation validée</p>
              {bon.validatedAt && <p className="text-xs text-green-600">{new Date(bon.validatedAt).toLocaleString("fr-MA")}</p>}
            </div>
            <button onClick={() => setViewing(null)}
              className="px-4 py-2 rounded-xl border border-green-300 text-sm font-semibold text-green-700 hover:bg-green-100">
              Fermer
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── New bon form ──────────────────────────────────────────────────────────
  const NewBonForm = () => {
    const preview = buildLignes()
    const previewClients = buildClientsInfo(getCmdsForSelection())
    const orderedPreview = sortClients(previewClients, sequenceMode)
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={e => e.target === e.currentTarget && setShowNew(false)}>
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h3 className="font-bold text-foreground">Nouveau Bon de Préparation</h3>
              <p className="text-xs text-muted-foreground">وصل التحضير</p>
            </div>
            <button onClick={() => setShowNew(false)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="p-6 flex flex-col gap-5">
            {/* Nom */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">Nom du bon *</label>
                {!nomManual ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                    Auto-genere
                  </span>
                ) : (
                  <button onClick={() => { setNom(""); setNomManual(false) }}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold hover:bg-amber-200 transition-colors">
                    Retablir auto
                  </button>
                )}
              </div>
              <input type="text"
                value={nomManual ? nom : effectiveNom}
                onChange={e => { setNom(e.target.value); setNomManual(true) }}
                className="px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={autoNom} />
              {!nomManual && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Nom genere automatiquement. Modifiez le champ pour personnaliser.
                </p>
              )}
            </div>

            {/* Séquencement */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-2">
                Séquencement de livraison / ترتيب التوصيل
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["horaire", "Par horaire", "Ordre chronologique des créneaux demandés (7h, 7h15, 8h...)"],
                  ["itineraire", "Itinéraire GPS", "Circuit géographique optimal minimisant les km"],
                ] as [SequenceModePrep, string, string][]).map(([val, lbl, desc]) => (
                  <button key={val} onClick={() => setSequenceMode(val)}
                    className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all ${sequenceMode === val ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}>
                    <div className="flex items-center gap-2">
                      {val === "horaire"
                        ? <svg className="w-4 h-4 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        : <svg className="w-4 h-4 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      }
                      <span className="text-sm font-semibold text-foreground">{lbl}</span>
                    </div>
                    <span className="text-xs text-muted-foreground leading-snug">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mode */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-2">Mode de préparation</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(Object.entries(MODE_LABELS) as [ModePreparation, typeof MODE_LABELS[ModePreparation]][]).map(([key, { label, desc }]) => (
                  <button key={key} onClick={() => setMode(key)}
                    className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all ${mode === key ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}>
                    <span className="text-sm font-semibold text-foreground">{label}</span>
                    <span className="text-xs text-muted-foreground leading-snug">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Type */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-2">Type de préparation</label>
              <div className="flex gap-2">
                {([["cross_dock", "Cross-dock", "Tri direct"], ["stockage", "Depuis stock", "Picking entrepôt"]] as const).map(([val, lbl, desc]) => (
                  <button key={val} onClick={() => setType(val)}
                    className={`flex-1 p-3 rounded-xl border text-left transition-all ${type === val ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}>
                    <span className="text-sm font-semibold text-foreground block">{lbl}</span>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-2">Format de remise</label>
              <div className="flex gap-2">
                {([["papier", "Papier (imprimer)"], ["numerique", "Numérique (tablette)"]] as const).map(([val, lbl]) => (
                  <button key={val} onClick={() => setFormat(val)}
                    className={`flex-1 p-3 rounded-xl border text-center transition-all ${format === val ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}>
                    <span className="text-sm font-semibold text-foreground">{lbl}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Trip ou clients */}
            {tripsEnCours.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Lier à un trip (optionnel)</label>
                <select value={tripId} onChange={e => { setTripId(e.target.value); setSelectedClients([]) }}
                  className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">-- Tous les clients en attente --</option>
                  {tripsEnCours.map(t => (
                    <option key={t.id} value={t.id}>{t.date} — {t.livreurNom} ({t.commandeIds.length} cmds)</option>
                  ))}
                </select>
              </div>
            )}
            {!tripId && (
              <div>
                <label className="text-xs font-semibold text-foreground block mb-2">
                  Clients ({selectedClients.length}/{clientsAvailable.length})
                </label>
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto border border-border rounded-xl p-2">
                  {clientsAvailable.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucune commande validée</p>
                  ) : clientsAvailable.map(c => (
                    <label key={c.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/40 cursor-pointer">
                      <input type="checkbox" checked={selectedClients.includes(c.id)}
                        onChange={() => setSelectedClients(prev =>
                          prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]
                        )} className="w-4 h-4 rounded accent-primary" />
                      <span className="text-sm text-foreground flex-1">{c.nom}</span>
                      {c.heure && <span className="text-xs text-blue-600 font-semibold">{c.heure}</span>}
                      <span className="text-xs text-muted-foreground">{c.secteur}</span>
                    </label>
                  ))}
                </div>
                {clientsAvailable.length > 0 && (
                  <button onClick={() => setSelectedClients(clientsAvailable.map(c => c.id))}
                    className="text-xs text-primary hover:underline mt-1">Sélectionner tous</button>
                )}
              </div>
            )}

            {/* Preview sequence */}
            {orderedPreview.length > 0 && (
              <div className="bg-muted/30 rounded-xl border border-border p-3">
                <p className="text-xs font-bold text-foreground mb-2 uppercase tracking-wide">
                  Apercu séquence ({sequenceMode === "horaire" ? "ordre horaire" : "itinéraire GPS"})
                </p>
                <div className="flex flex-col gap-1">
                  {orderedPreview.map((c, i) => (
                    <div key={c.clientId} className="flex items-center gap-2 text-xs">
                      <span className="w-5 h-5 rounded-md text-white text-center font-bold flex items-center justify-center shrink-0"
                        style={{ background: "oklch(0.38 0.2 260)", fontSize: "10px" }}>{i + 1}</span>
                      <span className="font-semibold text-foreground">{c.clientNom}</span>
                      <span className="text-muted-foreground">{c.secteur}</span>
                      {c.heurelivraison && <span className="text-blue-600 font-semibold ml-auto">{c.heurelivraison}</span>}
                    </div>
                  ))}
                </div>
                {preview.length > 0 && (
                  <p className="text-xs text-green-700 font-semibold mt-2 pt-2 border-t border-border">
                    {preview.length} article(s) — {preview.reduce((s, l) => s + l.qteCommandee, 0).toFixed(1)} kg total
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2 border-t border-border">
              <button onClick={() => setShowNew(false)}
                className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted">
                Annuler
              </button>
              <button onClick={handleCreate} disabled={!effectiveNom.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: "oklch(0.38 0.2 260)" }}>
                {format === "papier" ? "Créer et imprimer" : "Créer et démarrer"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      {viewing && viewing.format === "numerique" && <DigitalPrepaView bon={viewing} />}

      <div>
        <h2 className="text-xl font-bold text-foreground">
          Bons de Préparation <span className="text-muted-foreground font-normal text-base">/ وصولات التحضير</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Total par article · Répartition par client · Séquencement horaire ou GPS
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{bons.length} bon(s)</p>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "oklch(0.38 0.2 260)" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nouveau bon
        </button>
      </div>

      {showNew && <NewBonForm />}

      {bons.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-14 text-center text-muted-foreground">
          <svg className="w-14 h-14 mx-auto mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <p className="font-medium">Aucun bon de préparation</p>
          <p className="text-sm mt-1">Créez un bon pour organiser le picking du chargement</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {[...bons].reverse().map(bon => {
            const ordClients = sortClients(bon.clientsInfo ?? [], bon.sequenceMode ?? "horaire")
            return (
              <div key={bon.id} className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-foreground">{bon.nom}</p>
                      <StatusBadge s={bon.statut} />
                      <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground border border-border">
                        {MODE_LABELS[bon.mode].label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${bon.type === "cross_dock" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                        {bon.type === "cross_dock" ? "Cross-dock" : "Stockage"}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${bon.format === "numerique" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-gray-50 text-gray-700 border-gray-200"}`}>
                        {bon.format === "numerique" ? "Numerique" : "Papier"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        {bon.sequenceMode === "itineraire" ? "GPS" : "Horaire"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {bon.date} · {bon.lignes.length} articles · {bon.lignes.reduce((s, l) => s + l.qteCommandee, 0).toFixed(1)} kg · {ordClients.length} clients
                    </p>

                    {/* Client sequence preview */}
                    {ordClients.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {ordClients.slice(0, 5).map((c, i) => (
                          <span key={c.clientId} className="flex items-center gap-1 text-xs text-foreground bg-muted rounded-lg px-2 py-0.5">
                            <span className="font-bold text-primary">{i + 1}.</span>
                            <span className="font-medium">{c.clientNom}</span>
                            {c.heurelivraison && <span className="text-blue-600">{c.heurelivraison}</span>}
                          </span>
                        ))}
                        {ordClients.length > 5 && (
                          <span className="text-xs text-muted-foreground">+{ordClients.length - 5} autres</span>
                        )}
                      </div>
                    )}

                    {bon.statut === "en_cours" && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full transition-all"
                            style={{ width: `${bon.lignes.length > 0 ? (bon.lignes.filter(l => l.valide).length / bon.lignes.length) * 100 : 0}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{bon.lignes.filter(l => l.valide).length}/{bon.lignes.length}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Print button always available */}
                    <button
                      onClick={() => openPrintPrep(bon, commandes)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-border text-muted-foreground hover:text-foreground hover:bg-muted">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      Imprimer
                    </button>
                    {/* Digital button */}
                    {bon.format === "numerique" && (
                      <button onClick={() => setViewing(bon)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                        style={{ background: bon.statut === "valide" ? "oklch(0.52 0.16 145)" : "oklch(0.38 0.2 260)" }}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        {bon.statut === "valide" ? "Voir" : "Préparer"}
                      </button>
                    )}
                    <button onClick={() => deleteBon(bon.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
