"use client"

import { useState, useEffect } from "react"
import {
  store, TripCharge, TripChargeType, TRIP_CHARGE_TYPE_LABELS,
  ControleRetour, RetourMarchandiseItem, MOTIF_RETOUR_LABELS
} from "@/lib/store"
import {
  Truck, Plus, AlertTriangle, CheckCircle2, X,
  Package, MapPin, Hash, Calendar, ChevronDown, ChevronUp,
  RefreshCw, FileText, RotateCcw
} from "lucide-react"

const AI_ANALYSE = (items: RetourMarchandiseItem[]): string => {
  const alerts = items.filter(i => i.alerte)
  if (alerts.length === 0) return "Aucune anomalie détectée dans les retours."
  const parts = alerts.map(a => `${a.article}: ${a.iaObservation ?? MOTIF_RETOUR_LABELS[a.motif]}`)
  return `ALERTES IA (${alerts.length}) — ${parts.join(" | ")}`
}

function RetourControleForm({ tripId, onSave }: { tripId: string; onSave: (c: ControleRetour) => void }) {
  const [caissesPrevues, setCaissesPrevues] = useState(0)
  const [caissesRetournees, setCaissesRetournees] = useState(0)
  const [caissesMarcheRetour, setCaissesMarcheRetour] = useState(0)
  const [marchandises, setMarchandises] = useState<RetourMarchandiseItem[]>([])
  const [observations, setObservations] = useState("")
  const [newItem, setNewItem] = useState<Partial<RetourMarchandiseItem>>({})

  const motifs: RetourMarchandiseItem["motif"][] = ["pas_notre_variete", "produit_pourri", "trop_vieux", "endommage", "autre"]

  const iaCheck = (item: Partial<RetourMarchandiseItem>): string => {
    if (!item.motif) return ""
    const m = MOTIF_RETOUR_LABELS[item.motif]
    const alertMotifs: RetourMarchandiseItem["motif"][] = ["pas_notre_variete", "produit_pourri", "trop_vieux"]
    if (alertMotifs.includes(item.motif)) {
      if (item.motif === "pas_notre_variete") return "Vérifier la traçabilité fournisseur — non-conformité variété."
      if (item.motif === "produit_pourri") return "Produit avarié détecté — vérifier chaîne du froid et délais transport."
      if (item.motif === "trop_vieux") return "Date dépassée — revoir planification achat et rotation stock."
    }
    return `Retour signalé: ${m}`
  }

  const addItem = () => {
    if (!newItem.article || !newItem.quantite || !newItem.motif) return
    const alertMotifs: RetourMarchandiseItem["motif"][] = ["pas_notre_variete", "produit_pourri", "trop_vieux"]
    const alerte = alertMotifs.includes(newItem.motif)
    setMarchandises(prev => [...prev, {
      article:        newItem.article!,
      quantite:       newItem.quantite!,
      motif:          newItem.motif!,
      alerte,
      iaObservation:  iaCheck(newItem),
    }])
    setNewItem({})
  }

  const save = () => {
    onSave({
      date: store.today(),
      caissesPrevues,
      caissesRetournees,
      caissesMarcheRetour,
      marchandises,
      validated: true,
      observations,
    })
  }

  return (
    <div className="space-y-4 p-4 rounded-2xl" style={{ background: "#0a0f18", border: "1px solid #1a2535" }}>
      <p className="text-sm font-bold" style={{ color: "#f1f5f9" }}>Contrôle Retour Livreur</p>

      {/* Caisses */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Caisses Prévues", val: caissesPrevues, set: setCaissesPrevues },
          { label: "Caisses Retournées", val: caissesRetournees, set: setCaissesRetournees },
          { label: "Caisses Marché Retour", val: caissesMarcheRetour, set: setCaissesMarcheRetour },
        ].map(({ label, val, set }) => (
          <div key={label}>
            <p className="text-xs mb-1" style={{ color: "#4b5563" }}>{label}</p>
            <input type="number" value={val} onChange={e => set(+e.target.value)} min={0} className="w-full px-3 py-2 rounded-xl text-xs outline-none" style={{ background: "#060a10", border: "1px solid #1a2535", color: "#e2e8f0" }} />
          </div>
        ))}
      </div>

      {/* Ecart caisses */}
      {caissesPrevues > 0 && (
        <div className="px-3 py-2 rounded-xl flex items-center gap-2 text-xs" style={{ background: caissesRetournees < caissesPrevues ? "#1c0a0a" : "#0d2e18", border: `1px solid ${caissesRetournees < caissesPrevues ? "#3b1515" : "#15352a"}` }}>
          {caissesRetournees < caissesPrevues
            ? <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
          <span style={{ color: caissesRetournees < caissesPrevues ? "#fca5a5" : "#6ee7b7" }}>
            {caissesRetournees < caissesPrevues
              ? `Ecart: ${caissesPrevues - caissesRetournees} caisses manquantes`
              : "Toutes les caisses sont retournées"}
          </span>
        </div>
      )}

      {/* Marchandises retour */}
      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: "#94a3b8" }}>Marchandises Retournées</p>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <input value={newItem.article ?? ""} onChange={e => setNewItem(n => ({ ...n, article: e.target.value }))} placeholder="Article..." className="px-3 py-2 rounded-xl text-xs outline-none" style={{ background: "#060a10", border: "1px solid #1a2535", color: "#e2e8f0" }} />
          <input type="number" value={newItem.quantite ?? ""} onChange={e => setNewItem(n => ({ ...n, quantite: +e.target.value }))} placeholder="Qté (kg/u)..." min={0} className="px-3 py-2 rounded-xl text-xs outline-none" style={{ background: "#060a10", border: "1px solid #1a2535", color: "#e2e8f0" }} />
          <select value={newItem.motif ?? ""} onChange={e => setNewItem(n => ({ ...n, motif: e.target.value as RetourMarchandiseItem["motif"] }))} className="px-3 py-2 rounded-xl text-xs outline-none" style={{ background: "#060a10", border: "1px solid #1a2535", color: "#e2e8f0" }}>
            <option value="">Motif...</option>
            {motifs.map(m => <option key={m} value={m}>{MOTIF_RETOUR_LABELS[m]}</option>)}
          </select>
        </div>
        {newItem.motif && (
          <div className="mb-2 px-3 py-2 rounded-xl text-xs flex items-start gap-2" style={{ background: "#0d1a2e", border: "1px solid #1d3a5e" }}>
            <span className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5">IA</span>
            <span style={{ color: "#7dd3fc" }}>{iaCheck(newItem)}</span>
          </div>
        )}
        <button onClick={addItem} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white mb-3" style={{ background: "#1d4ed8" }}>
          <Plus className="w-3.5 h-3.5" /> Ajouter Article
        </button>
        {marchandises.length > 0 && (
          <div className="space-y-2">
            {marchandises.map((m, i) => (
              <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl text-xs" style={{ background: m.alerte ? "#1c0a0a" : "#060a10", border: `1px solid ${m.alerte ? "#3b1515" : "#1a2535"}` }}>
                {m.alerte && <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <p className="font-medium" style={{ color: "#e2e8f0" }}>{m.article} — {m.quantite} kg/u</p>
                  <p style={{ color: "#4b5563" }}>{MOTIF_RETOUR_LABELS[m.motif]}</p>
                  {m.iaObservation && <p className="mt-0.5" style={{ color: "#7dd3fc" }}>IA: {m.iaObservation}</p>}
                </div>
                <button onClick={() => setMarchandises(prev => prev.filter((_, j) => j !== i))}><X className="w-3 h-3" style={{ color: "#6b7280" }} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Observations */}
      <div>
        <p className="text-xs mb-1" style={{ color: "#4b5563" }}>Observations générales</p>
        <textarea value={observations} onChange={e => setObservations(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl text-xs outline-none resize-none" style={{ background: "#060a10", border: "1px solid #1a2535", color: "#e2e8f0" }} placeholder="Remarques sur le retour..." />
      </div>

      <button onClick={save} className="w-full py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: "#15803d" }}>
        Valider Contrôle Retour
      </button>
    </div>
  )
}

function TripRow({ trip, onUpdate }: { trip: TripCharge; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [showControle, setShowControle] = useState(false)

  const kmTotal = trip.kmDepart !== null && trip.kmRetour !== null
    ? trip.kmRetour - trip.kmDepart
    : null
  const totalCharges = trip.charges.reduce((s, c) => s + c.montant, 0)
  const alertes = trip.controleRetour?.marchandises.filter(m => m.alerte) ?? []

  const validate = () => {
    store.updateTripCharge(trip.id, { validated: true })
    onUpdate()
  }

  const saveControle = (c: ControleRetour) => {
    store.updateTripCharge(trip.id, { controleRetour: c })
    setShowControle(false)
    onUpdate()
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#0f1623", border: "1px solid #1a2535" }}>
      {/* Header */}
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#0a0f18" }}>
          <Truck className="w-4 h-4" style={{ color: "#06b6d4" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {trip.numero && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-black"
                style={{ background: "#1a0d2e", color: "#a78bfa", border: "1px solid #3b1d6e" }}>
                {trip.numero}
              </span>
            )}
            <p className="text-sm font-bold" style={{ color: "#f1f5f9" }}>{trip.livreur}</p>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#0d1a2e", color: "#60a5fa", border: "1px solid #1d3a5e" }}>{trip.immatricule}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#0a1a10", color: "#6ee7b7", border: "1px solid #15352a" }}>{trip.secteur}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "#4b5563" }}>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{trip.date}</span>
            <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{trip.nbCaissesFact} caisses</span>
            <span className="flex items-center gap-1"><Package className="w-3 h-3" />{trip.nbClients} clients</span>
            {kmTotal !== null && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{kmTotal} km</span>}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold" style={{ color: "#f59e0b" }}>{totalCharges.toLocaleString()} DH</p>
          <div className="flex items-center gap-1.5 justify-end mt-1">
            {alertes.length > 0 && <span className="flex items-center gap-1 text-[10px]" style={{ color: "#ef4444" }}><AlertTriangle className="w-3 h-3" />{alertes.length} alerte{alertes.length > 1 ? "s" : ""}</span>}
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: trip.validated ? "#10b98122" : "#f59e0b22", color: trip.validated ? "#10b981" : "#f59e0b", border: `1px solid ${trip.validated ? "#10b98144" : "#f59e0b44"}` }}>
              {trip.validated ? "Validé" : "En attente"}
            </span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "#374151" }} /> : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "#374151" }} />}
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* KM detail */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { l: "KM Départ", v: trip.kmDepart !== null ? String(trip.kmDepart) : "—" },
              { l: "KM Retour", v: trip.kmRetour !== null ? String(trip.kmRetour) : "Pas encore rentré" },
              { l: "Total KM", v: kmTotal !== null ? `${kmTotal} km` : "En cours" },
            ].map(({ l, v }) => (
              <div key={l} className="px-3 py-2.5 rounded-xl" style={{ background: "#0a0f18", border: "1px solid #1a2535" }}>
                <p style={{ color: "#4b5563" }}>{l}</p>
                <p className="font-bold mt-0.5" style={{ color: "#e2e8f0" }}>{v}</p>
              </div>
            ))}
          </div>

          {/* Charges detail */}
          {trip.charges.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1a2535" }}>
              <p className="text-xs font-semibold px-3 py-2" style={{ background: "#0a0f18", color: "#94a3b8", borderBottom: "1px solid #1a2535" }}>Détail charges</p>
              {trip.charges.map((c, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 text-xs" style={{ borderBottom: i < trip.charges.length - 1 ? "1px solid #1a253520" : "none" }}>
                  <span style={{ color: "#94a3b8" }}>{TRIP_CHARGE_TYPE_LABELS[c.type]}</span>
                  <span className="font-bold" style={{ color: "#f59e0b" }}>{c.montant} DH</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2 text-xs font-bold" style={{ background: "#0a0f18", borderTop: "1px solid #1a2535" }}>
                <span style={{ color: "#e2e8f0" }}>Total Charges</span>
                <span style={{ color: "#f59e0b" }}>{totalCharges} DH</span>
              </div>
            </div>
          )}

          {/* Controle retour */}
          {trip.controleRetour ? (
            <div className="rounded-xl p-3" style={{ background: "#0a1a10", border: "1px solid #15352a" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold" style={{ color: "#6ee7b7" }}>Contrôle Retour Validé</p>
                <span className="text-xs" style={{ color: "#4b5563" }}>{trip.controleRetour.date}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                <div><span style={{ color: "#4b5563" }}>Caisses prévues: </span><span className="font-bold" style={{ color: "#e2e8f0" }}>{trip.controleRetour.caissesPrevues}</span></div>
                <div><span style={{ color: "#4b5563" }}>Retournées: </span><span className="font-bold" style={{ color: "#e2e8f0" }}>{trip.controleRetour.caissesRetournees}</span></div>
                <div><span style={{ color: "#4b5563" }}>Marché: </span><span className="font-bold" style={{ color: "#e2e8f0" }}>{trip.controleRetour.caissesMarcheRetour}</span></div>
              </div>
              {alertes.length > 0 && (
                <div className="p-2.5 rounded-xl text-xs" style={{ background: "#1c0a0a", border: "1px solid #3b1515" }}>
                  <p className="font-bold mb-1.5" style={{ color: "#fca5a5" }}>Alertes IA ({alertes.length})</p>
                  {alertes.map((a, i) => (
                    <p key={i} className="flex items-start gap-1.5" style={{ color: "#fca5a5" }}>
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      {a.article}: {a.iaObservation}
                    </p>
                  ))}
                </div>
              )}
              {trip.controleRetour.observations && (
                <p className="text-xs mt-2" style={{ color: "#4b5563" }}>Obs: {trip.controleRetour.observations}</p>
              )}
            </div>
          ) : (
            <div>
              {showControle ? (
                <RetourControleForm tripId={trip.id} onSave={saveControle} />
              ) : (
                <button onClick={() => setShowControle(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium w-full justify-center" style={{ background: "#1a1500", color: "#fde68a", border: "1px solid #3b2e00" }}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Effectuer le Contrôle Retour
                </button>
              )}
            </div>
          )}

          {/* Validate trip */}
          {!trip.validated && (
            <button onClick={validate} className="w-full py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#15803d" }}>
              Valider le Trip
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Auto-sync Trip from BL + Controle Preparation + Retour ────────────────────
function buildTripFromFlows(livreurNom: string, date: string): Partial<TripCharge> & {
  sourceBLs: string[]; sourcePrepIds: string[]; sourceCaisses: { gros: number; demi: number }; observations?: string
} {
  const today = date || store.today()

  // 1. BL for this livreur on this date
  const bls = store.getBonsLivraison().filter(
    bl => bl.date === today && bl.livreurNom === livreurNom
  )
  const nbClients = bls.length
  const secteurs = [...new Set(bls.map(bl => (bl as { secteur?: string; clientSecteur?: string }).secteur || (bl as { secteur?: string; clientSecteur?: string }).clientSecteur || "").filter(Boolean))]
  const nbCaisseGros = bls.reduce((s, bl) => s + ((bl as { nbCaisseGros?: number }).nbCaisseGros ?? 0), 0)
  const nbCaisseDemi = bls.reduce((s, bl) => s + ((bl as { nbCaisseDemi?: number }).nbCaisseDemi ?? 0), 0)
  const montantBLs = bls.reduce((s, bl) => s + (bl.montantTTC ?? 0), 0)

  // 2. Bons Préparation for this livreur/date (ctrl_prep)
  const preps = store.getBonsPreparation().filter(
    p => p.date === today && p.statut === "valide" &&
      (bls.some(bl => (bl as { bonPrepId?: string }).bonPrepId === p.id) || p.clientIds.length > 0)
  )
  const prepNbCaisses = preps.reduce((s, p) => {
    // Count total caisses from qteCommandee ÷ 30kg per caisse (standard)
    return s + p.lignes.reduce((ls, l) => ls + Math.ceil((l.qteCommandee ?? 0) / 30), 0)
  }, 0)

  // 3. Retours for this livreur today
  const retours = store.getRetours().filter(
    r => r.date === today && r.livreurNom === livreurNom
  )
  const nbRetoursArticles = retours.reduce((s, r) => s + (r.lignes?.length ?? 0), 0)

  // Caisses prévues = from prep if available, else from BL
  const caissesPrevues = prepNbCaisses > 0 ? prepNbCaisses : nbCaisseGros + nbCaisseDemi

  return {
    secteur: secteurs.join(", ") || "—",
    nbCaissesFact: caissesPrevues,
    nbClients,
    charges: [],
    sourceBLs: bls.map(bl => bl.id),
    sourcePrepIds: preps.map(p => p.id),
    sourceCaisses: { gros: nbCaisseGros, demi: nbCaisseDemi },
    // Auto note for context
    observations: [
      bls.length > 0 ? `${bls.length} BL — ${montantBLs.toLocaleString("fr-MA")} DH` : "",
      preps.length > 0 ? `${preps.length} bon(s) prép. validé(s)` : "",
      nbRetoursArticles > 0 ? `${nbRetoursArticles} article(s) retourné(s)` : "",
    ].filter(Boolean).join(" | "),
  }
}

export default function TripChargesPanel() {
  const [trips, setTrips] = useState<TripCharge[]>(() => store.getTripCharges())
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<Partial<TripCharge> & { observations?: string }>({ charges: [] })
  const [newCharge, setNewCharge] = useState<{ type: TripChargeType; montant: number; description?: string }>({ type: "carburant", montant: 0 })
  const [autoSyncInfo, setAutoSyncInfo] = useState<{ sourceBLs: string[]; sourcePrepIds: string[]; sourceCaisses: { gros: number; demi: number } } | null>(null)
  const [livreurs, setLivreurs] = useState<string[]>([])

  useEffect(() => {
    const livList = store.getLivreurs?.() ?? []
    setLivreurs(livList.map((l: { nom: string }) => l.nom))
  }, [])

  const reload = () => setTrips(store.getTripCharges())

  // Auto-populate form from flows when livreur is selected
  const handleLivreurChange = (nom: string) => {
    const synced = buildTripFromFlows(nom, store.today())
    const { sourceBLs, sourcePrepIds, sourceCaisses, ...formFields } = synced
    setForm(f => ({ ...f, livreur: nom, ...formFields, charges: f.charges ?? [] }))
    setAutoSyncInfo({ sourceBLs, sourcePrepIds, sourceCaisses })
  }

  const addCharge = () => {
    if (newCharge.montant <= 0) return
    setForm(f => ({ ...f, charges: [...(f.charges ?? []), { ...newCharge }] }))
    setNewCharge({ type: "carburant", montant: 0 })
  }

  const saveTrip = () => {
    if (!form.livreur || !form.immatricule || !form.secteur) return
    // Auto-generate sequential trip number: TRP-001, TRP-002…
    const existing = store.getTripCharges()
    const nextNum  = existing.length + 1
    const numero   = `TRP-${String(nextNum).padStart(3, "0")}`
    store.addTripCharge({
      id: store.genId(),
      numero,
      date: store.today(),
      livreur: form.livreur!,
      immatricule: form.immatricule!,
      secteur: form.secteur!,
      nbCaissesFact: form.nbCaissesFact ?? 0,
      nbClients: form.nbClients ?? 0,
      kmDepart: form.kmDepart ?? null,
      kmRetour: null,
      charges: form.charges ?? [],
      validated: false,
    })

    // Auto-update caisses vides stock when trip is created (sortie caisses vers livreur)
    if (autoSyncInfo && (autoSyncInfo.sourceCaisses.gros > 0 || autoSyncInfo.sourceCaisses.demi > 0)) {
      store.addCaisseMouvement({
        id: store.genId(),
        date: store.today(),
        typeOperation: "expedition",
        sens: "sortie",
        nbCaisseGros: autoSyncInfo.sourceCaisses.gros,
        nbCaisseDemi: autoSyncInfo.sourceCaisses.demi,
        referenceDoc: form.livreur!,
        operateurId: "system",
        operateurNom: "Auto-Trip",
        notes: `Trip auto-créé — ${autoSyncInfo.sourceBLs.length} BL(s)`,
      })
    }

    setForm({ charges: [] })
    setAutoSyncInfo(null)
    setShowAdd(false)
    reload()
  }

  const totalChargesAll = trips.reduce((s, t) => s + t.charges.reduce((ss, c) => ss + c.montant, 0), 0)
  const alertesAll = trips.reduce((s, t) => s + (t.controleRetour?.marchandises.filter(m => m.alerte).length ?? 0), 0)

  return (
    <div className="h-full flex flex-col gap-4 p-4" style={{ background: "#080c14" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold" style={{ color: "#f1f5f9" }}>
            Charges Trip <span style={{ color: "#374151" }}>/ مصاريف الرحلة</span>
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "#374151" }}>
            Auto-rempli depuis Contrôle Préparation · BL · Retours
          </p>
        </div>
        <button onClick={() => { setShowAdd(true); setAutoSyncInfo(null); setForm({ charges: [] }) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
          style={{ background: "#1d4ed8" }}>
          <Plus className="w-3.5 h-3.5" /> Nouveau Trip
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { l: "Trips Aujourd'hui", v: String(trips.filter(t => t.date === store.today()).length), c: "#06b6d4" },
          { l: "Total Charges", v: `${totalChargesAll.toLocaleString()} DH`, c: "#f59e0b" },
          { l: "Alertes Retours", v: String(alertesAll), c: "#ef4444" },
          { l: "Trips Validés", v: String(trips.filter(t => t.validated).length), c: "#10b981" },
        ].map(s => (
          <div key={s.l} className="rounded-xl p-3 flex items-center justify-between" style={{ background: "#0f1623", border: "1px solid #1a2535" }}>
            <p className="text-xs" style={{ color: "#4b5563" }}>{s.l}</p>
            <p className="text-sm font-bold" style={{ color: s.c }}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Trips list */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {trips.map(trip => (
          <TripRow key={trip.id} trip={trip} onUpdate={reload} />
        ))}
        {trips.length === 0 && (
          <div className="text-center py-12 text-xs" style={{ color: "#374151" }}>Aucun trip enregistré</div>
        )}
      </div>

      {/* Add trip modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }} onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden overflow-y-auto" style={{ background: "#0f1623", border: "1px solid #1a2535", maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #1a2535" }}>
              <div>
                <p className="font-bold text-sm" style={{ color: "#f1f5f9" }}>Nouveau Trip</p>
                <p className="text-[11px] mt-0.5 flex items-center gap-1.5" style={{ color: "#4b5563" }}>
                  Numéro assigné automatiquement :
                  <span className="font-black px-1.5 py-0.5 rounded" style={{ background: "#1a0d2e", color: "#a78bfa", fontSize: 10 }}>
                    TRP-{String(trips.length + 1).padStart(3, "0")}
                  </span>
                </p>
              </div>
              <button onClick={() => setShowAdd(false)}><X className="w-4 h-4" style={{ color: "#6b7280" }} /></button>
            </div>
            <div className="p-5 space-y-3">

              {/* Livreur — triggers auto-sync */}
              <div>
                <p className="text-xs mb-1 flex items-center gap-1.5" style={{ color: "#94a3b8" }}>
                  Livreur <span style={{ color: "#1d4ed8", fontSize: 9 }}>● auto-rempli depuis flux</span>
                </p>
                {livreurs.length > 0 ? (
                  <select
                    value={form.livreur ?? ""}
                    onChange={e => handleLivreurChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                    style={{ background: "#0a0f18", border: "1px solid #1a2535", color: "#e2e8f0" }}>
                    <option value="">— Sélectionner un livreur —</option>
                    {livreurs.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                ) : (
                  <input
                    value={form.livreur ?? ""}
                    onChange={e => handleLivreurChange(e.target.value)}
                    placeholder="Nom du livreur"
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                    style={{ background: "#0a0f18", border: "1px solid #1a2535", color: "#e2e8f0" }} />
                )}
              </div>

              {/* Auto-sync info banner */}
              {autoSyncInfo && (
                <div className="rounded-xl p-3 space-y-2" style={{ background: "#0a1a10", border: "1px solid #15352a" }}>
                  <div className="flex items-center gap-2 text-xs font-bold" style={{ color: "#6ee7b7" }}>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Données auto-remplies depuis les flux du jour
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center gap-1.5" style={{ color: "#4b5563" }}>
                      <FileText className="w-3 h-3" style={{ color: "#60a5fa" }} />
                      <span>{autoSyncInfo.sourceBLs.length} BL(s)</span>
                    </div>
                    <div className="flex items-center gap-1.5" style={{ color: "#4b5563" }}>
                      <Package className="w-3 h-3" style={{ color: "#f59e0b" }} />
                      <span>{autoSyncInfo.sourceCaisses.gros} gros / {autoSyncInfo.sourceCaisses.demi} demi</span>
                    </div>
                    <div className="flex items-center gap-1.5" style={{ color: "#4b5563" }}>
                      <RotateCcw className="w-3 h-3" style={{ color: "#ef4444" }} />
                      <span>{autoSyncInfo.sourcePrepIds.length} prép.</span>
                    </div>
                  </div>
                  {(form as { observations?: string }).observations && (
                    <p className="text-xs" style={{ color: "#374151" }}>{(form as { observations?: string }).observations}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs mb-1" style={{ color: "#4b5563" }}>Immatricule</p>
                  <input value={form.immatricule ?? ""} onChange={e => setForm(f => ({ ...f, immatricule: e.target.value }))} placeholder="W-XXXXX-X" className="w-full px-3 py-2 rounded-xl text-xs outline-none" style={{ background: "#0a0f18", border: "1px solid #1a2535", color: "#e2e8f0" }} />
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: "#4b5563" }}>Secteur</p>
                  <input value={form.secteur ?? ""} onChange={e => setForm(f => ({ ...f, secteur: e.target.value }))} placeholder="Zone / Secteur" className="w-full px-3 py-2 rounded-xl text-xs outline-none" style={{ background: "#0a0f18", border: "1px solid #1a2535", color: "#e2e8f0" }} />
                </div>
                <div>
                  <p className="text-xs mb-1 flex items-center gap-1" style={{ color: "#4b5563" }}>
                    Nb Caisses Facturées
                    {autoSyncInfo && <span style={{ color: "#6ee7b7", fontSize: 9 }}>↑ auto</span>}
                  </p>
                  <input type="number" value={form.nbCaissesFact ?? ""} onChange={e => setForm(f => ({ ...f, nbCaissesFact: +e.target.value }))} min={0} className="w-full px-3 py-2 rounded-xl text-xs outline-none" style={{ background: "#0a0f18", border: "1px solid #1a2535", color: "#e2e8f0" }} />
                </div>
                <div>
                  <p className="text-xs mb-1 flex items-center gap-1" style={{ color: "#4b5563" }}>
                    Nb Clients
                    {autoSyncInfo && autoSyncInfo.sourceBLs.length > 0 && <span style={{ color: "#6ee7b7", fontSize: 9 }}>↑ auto</span>}
                  </p>
                  <input type="number" value={form.nbClients ?? ""} onChange={e => setForm(f => ({ ...f, nbClients: +e.target.value }))} min={0} className="w-full px-3 py-2 rounded-xl text-xs outline-none" style={{ background: "#0a0f18", border: "1px solid #1a2535", color: "#e2e8f0" }} />
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: "#4b5563" }}>KM Départ</p>
                  <input type="number" value={form.kmDepart ?? ""} onChange={e => setForm(f => ({ ...f, kmDepart: +e.target.value }))} min={0} className="w-full px-3 py-2 rounded-xl text-xs outline-none" style={{ background: "#0a0f18", border: "1px solid #1a2535", color: "#e2e8f0" }} />
                </div>
              </div>

              {/* Charges */}
              <p className="text-xs font-semibold" style={{ color: "#94a3b8" }}>Charges مصاريف</p>
              <div className="grid grid-cols-3 gap-2">
                <select value={newCharge.type} onChange={e => setNewCharge(c => ({ ...c, type: e.target.value as TripChargeType }))} className="px-3 py-2 rounded-xl text-xs outline-none" style={{ background: "#0a0f18", border: "1px solid #1a2535", color: "#e2e8f0" }}>
                  {Object.entries(TRIP_CHARGE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input type="number" value={newCharge.montant || ""} onChange={e => setNewCharge(c => ({ ...c, montant: +e.target.value }))} placeholder="Montant DH" min={0} className="px-3 py-2 rounded-xl text-xs outline-none" style={{ background: "#0a0f18", border: "1px solid #1a2535", color: "#e2e8f0" }} />
                <button onClick={addCharge} className="px-3 py-2 rounded-xl text-xs font-medium text-white" style={{ background: "#1d4ed8" }}>+ Ajouter</button>
              </div>
              {(form.charges ?? []).length > 0 && (
                <div className="space-y-1">
                  {(form.charges ?? []).map((c, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs" style={{ background: "#0a0f18", border: "1px solid #1a2535" }}>
                      <span style={{ color: "#94a3b8" }}>{TRIP_CHARGE_TYPE_LABELS[c.type]}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold" style={{ color: "#f59e0b" }}>{c.montant} DH</span>
                        <button onClick={() => setForm(f => ({ ...f, charges: (f.charges ?? []).filter((_, j) => j !== i) }))}><X className="w-3 h-3" style={{ color: "#6b7280" }} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={saveTrip} className="w-full py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: "#1d4ed8" }}>
                Enregistrer Trip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
