"use client"

import { useState, useEffect, useCallback } from "react"
import { store, type User, type Client } from "@/lib/store"

interface Props { user: User }

const ALLOWED_ROLES = ["super_super_admin", "super_admin", "admin", "resp_commercial", "resp_achat", "ctrl_achat", "team_leader"]

const TYPE_OPTIONS = [
  "marchand","snack","epicerie","boucherie","restaurant","superette",
  "grossiste","hypermarche","traiteur","hotel","marche","cafeteria",
  "cantina","collectivite","chr","grande_surface","export","autre",
]
const CATEGORIE_OPTIONS: { value: "chr" | "marchand" | "particulier"; label: string }[] = [
  { value: "chr",         label: "CHR / HORECA" },
  { value: "marchand",    label: "Marchand" },
  { value: "particulier", label: "Particulier" },
]
const TAILLE_OPTIONS: { value: Client["taille"]; label: string }[] = [
  { value: "50-100kg",   label: "50–100 kg" },
  { value: "150-300kg",  label: "150–300 kg" },
  { value: "350-500kg",  label: "350–500 kg" },
  { value: "500kg+",     label: "+500 kg" },
]
const ROTATION_OPTIONS: { value: Client["rotation"]; label: string }[] = [
  { value: "journalier", label: "Journalier" },
  { value: "4j/6",       label: "4j/6" },
  { value: "3/6",        label: "3/6" },
  { value: "2/6",        label: "2/6" },
  { value: "moins",      label: "< 2/6" },
]
const MODALITE_OPTIONS = ["cash","cheque","virement","traite_30","traite_60","traite_90","credit_7","credit_15","credit_30"]

const EMPTY_CLIENT = (): Omit<Client, "id" | "createdBy" | "createdAt"> => ({
  nom: "", secteur: "", zone: "", type: "marchand",
  taille: "50-100kg", typeProduits: "moyenne", rotation: "journalier",
  telephone: "", email: "", adresse: "", ice: "", notes: "",
  categorie: "marchand", creditAutorise: false, plafondCredit: 0, creditSolde: 0,
  modalitePaiement: "cash",
})

function genPassword(len = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#"
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map(b => chars[b % chars.length]).join("")
}

// ─── Sub-component: Client form ───────────────────────────────────────────────
function ClientForm({
  initial,
  onSave,
  onCancel,
  title,
  color = "blue",
}: {
  initial: Omit<Client, "id" | "createdBy" | "createdAt">
  onSave: (data: Omit<Client, "id" | "createdBy" | "createdAt">) => void
  onCancel: () => void
  title: string
  color?: "blue" | "indigo"
}) {
  const [form, setForm] = useState(initial)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(p => ({ ...p, [k]: v }))

  const c = color === "indigo" ? {
    bg: "bg-indigo-50", border: "border-indigo-200", title: "text-indigo-900",
    label: "text-indigo-800", input: "border-indigo-200 focus:ring-indigo-400",
    btn: "bg-indigo-600 hover:bg-indigo-700", cancel: "border-indigo-200 text-indigo-700 hover:bg-indigo-100",
  } : {
    bg: "bg-blue-50", border: "border-blue-200", title: "text-blue-900",
    label: "text-blue-800", input: "border-blue-200 focus:ring-blue-400",
    btn: "bg-blue-600 hover:bg-blue-700", cancel: "border-blue-200 text-blue-700 hover:bg-blue-100",
  }

  return (
    <div className={`${c.bg} ${c.border} border rounded-2xl p-5 flex flex-col gap-4`}>
      <div className="flex items-center justify-between">
        <h3 className={`font-bold ${c.title}`}>{title}</h3>
        <button onClick={onCancel} className={`${c.label} hover:opacity-70`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Nom */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-semibold ${c.label}`}>Nom *</label>
          <input value={form.nom} onChange={e => set("nom", e.target.value)} placeholder="Nom du client"
            className={`px-3 py-2 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 ${c.input}`} />
        </div>

        {/* Téléphone */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-semibold ${c.label}`}>Téléphone</label>
          <input value={form.telephone ?? ""} onChange={e => set("telephone", e.target.value)} placeholder="06 XX XX XX XX" type="tel"
            className={`px-3 py-2 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 ${c.input}`} />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-semibold ${c.label}`}>Email</label>
          <input value={form.email ?? ""} onChange={e => set("email", e.target.value)} placeholder="email@example.com" type="email"
            className={`px-3 py-2 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 ${c.input}`} />
        </div>

        {/* Secteur */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-semibold ${c.label}`}>Secteur</label>
          <input value={form.secteur ?? ""} onChange={e => set("secteur", e.target.value)} placeholder="Épiceries, Restaurants…"
            className={`px-3 py-2 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 ${c.input}`} />
        </div>

        {/* Zone */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-semibold ${c.label}`}>Zone / Ville</label>
          <input value={form.zone ?? ""} onChange={e => set("zone", e.target.value)} placeholder="Casablanca, Hay Hassani…"
            className={`px-3 py-2 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 ${c.input}`} />
        </div>

        {/* Adresse */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-semibold ${c.label}`}>Adresse</label>
          <input value={form.adresse ?? ""} onChange={e => set("adresse", e.target.value)} placeholder="Adresse complète"
            className={`px-3 py-2 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 ${c.input}`} />
        </div>

        {/* ICE */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-semibold ${c.label}`}>ICE</label>
          <input value={form.ice ?? ""} onChange={e => set("ice", e.target.value)} placeholder="ICE (entreprise)"
            className={`px-3 py-2 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 ${c.input}`} />
        </div>

        {/* Type */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-semibold ${c.label}`}>Type de client</label>
          <select value={form.type} onChange={e => set("type", e.target.value as Client["type"])}
            className={`px-3 py-2 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 ${c.input}`}>
            {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>

        {/* Catégorie */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-semibold ${c.label}`}>Catégorie tarif</label>
          <select value={form.categorie ?? "marchand"} onChange={e => set("categorie", e.target.value as "chr" | "marchand" | "particulier")}
            className={`px-3 py-2 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 ${c.input}`}>
            {CATEGORIE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Taille */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-semibold ${c.label}`}>Volume / Taille</label>
          <select value={form.taille} onChange={e => set("taille", e.target.value as Client["taille"])}
            className={`px-3 py-2 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 ${c.input}`}>
            {TAILLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Rotation */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-semibold ${c.label}`}>Fréquence livraison</label>
          <select value={form.rotation} onChange={e => set("rotation", e.target.value as Client["rotation"])}
            className={`px-3 py-2 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 ${c.input}`}>
            {ROTATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Modalité paiement */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-semibold ${c.label}`}>Modalité paiement</label>
          <select value={form.modalitePaiement ?? "cash"} onChange={e => set("modalitePaiement", e.target.value as Client["modalitePaiement"])}
            className={`px-3 py-2 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 ${c.input}`}>
            {MODALITE_OPTIONS.map(m => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
          </select>
        </div>

        {/* Crédit autorisé */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-semibold ${c.label}`}>Crédit autorisé</label>
          <div className="flex items-center gap-3 h-10">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.creditAutorise} onChange={e => set("creditAutorise", e.target.checked)}
                className="w-4 h-4 rounded text-blue-600" />
              <span className="text-sm text-slate-700">Oui, crédit autorisé</span>
            </label>
          </div>
        </div>

        {/* Plafond crédit */}
        {form.creditAutorise && (
          <div className="flex flex-col gap-1">
            <label className={`text-xs font-semibold ${c.label}`}>Plafond crédit (DH)</label>
            <input type="number" min={0} value={form.plafondCredit ?? 0}
              onChange={e => set("plafondCredit", Number(e.target.value))}
              className={`px-3 py-2 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 ${c.input}`} />
          </div>
        )}

        {/* Notes */}
        <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
          <label className={`text-xs font-semibold ${c.label}`}>Notes</label>
          <textarea rows={2} placeholder="Notes optionnelles…" value={form.notes ?? ""}
            onChange={e => set("notes", e.target.value)}
            className={`px-3 py-2 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 ${c.input} resize-none`} />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel}
          className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-colors ${c.cancel}`}>
          Annuler
        </button>
        <button onClick={() => onSave(form)}
          className={`px-5 py-2 rounded-xl text-white text-sm font-semibold shadow transition-colors ${c.btn}`}>
          Enregistrer le client
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BOComptesExternes({ user }: Props) {
  const [clients, setClients]       = useState<Client[]>([])
  const [users, setUsers]           = useState<User[]>([])
  const [search, setSearch]         = useState("")
  const [filterCat, setFilterCat]   = useState<"" | "chr" | "marchand" | "particulier">("")
  const [filterType, setFilterType] = useState("")
  const [msg, setMsg]               = useState<{ ok: boolean; text: string } | null>(null)
  const [resetPwd, setResetPwd]     = useState<{ userId: string; pwd: string } | null>(null)

  // Forms
  const [showAdd, setShowAdd]       = useState(false)
  const [editId, setEditId]         = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<{ id: string; nom: string } | null>(null)

  const canAdd    = ALLOWED_ROLES.includes(user.role) || !!user.canViewExternal
  const canDelete = ALLOWED_ROLES.includes(user.role) || !!user.canViewExternal

  const reload = useCallback(() => {
    setClients(store.getClients())
    setUsers(store.getUsers())
  }, [])

  useEffect(() => {
    reload()
    // Live sync
    const handler = (e: Event) => {
      const key = (e as CustomEvent).detail as string
      if (key === "fl_clients" || key === "fl_users") reload()
    }
    window.addEventListener("fl_store_updated", handler)
    return () => window.removeEventListener("fl_store_updated", handler)
  }, [reload])

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text })
    setTimeout(() => setMsg(null), 3500)
  }

  // ── Portal helpers ───────────────────────────────────────────────────────────
  const getPortalUser = (clientId: string) =>
    users.find(u => u.role === "client" && u.clientId === clientId)

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

  // ── Save new client ──────────────────────────────────────────────────────────
  const handleAdd = (data: Omit<Client, "id" | "createdBy" | "createdAt">) => {
    if (!data.nom.trim()) { flash(false, "Le nom est obligatoire."); return }
    store.addClient({ ...data, id: store.genId(), createdBy: user.id, createdAt: new Date().toISOString() })
    setShowAdd(false)
    reload()
    flash(true, `Client "${data.nom}" ajouté.`)
  }

  // ── Save edited client ───────────────────────────────────────────────────────
  const handleEdit = (data: Omit<Client, "id" | "createdBy" | "createdAt">) => {
    if (!editId || !data.nom.trim()) { flash(false, "Le nom est obligatoire."); return }
    store.updateClient(editId, data)
    setEditId(null)
    reload()
    flash(true, `Client "${data.nom}" mis à jour.`)
  }

  // ── Delete client ────────────────────────────────────────────────────────────
  const handleConfirmDelete = () => {
    if (!confirmDel) return
    store.deleteClient(confirmDel.id)
    flash(true, `Client "${confirmDel.nom}" supprimé.`)
    setConfirmDel(null)
    reload()
  }

  // ── Access guard ─────────────────────────────────────────────────────────────
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
            Réservé aux <strong>Responsables Commerciaux</strong>, <strong>Contrôleurs</strong> et <strong>Administrateurs</strong>.
          </p>
        </div>
      </div>
    )
  }

  // ── Filtered list ────────────────────────────────────────────────────────────
  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    const matchQ = !q || c.nom.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q) ||
      (c.telephone ?? "").includes(q) || (c.ice ?? "").includes(q)
    const matchCat  = !filterCat  || c.categorie === filterCat
    const matchType = !filterType || c.type === filterType
    return matchQ && matchCat && matchType
  })

  // Stats
  const withPortal   = clients.filter(c => getPortalUser(c.id)).length
  const activePortal = users.filter(u => u.role === "client" && u.actif).length
  const chrCount     = clients.filter(c => c.categorie === "chr").length

  const editClient = editId ? clients.find(c => c.id === editId) : null

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Gestion Clients
            <span className="text-muted-foreground font-normal text-base ml-2">/ إدارة الزبائن</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Ajouter, modifier, supprimer des clients + accès portail
          </p>
        </div>
        {canAdd && !showAdd && !editId && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouveau client
          </button>
        )}
      </div>

      {/* ── Add form ──────────────────────────────────────────────────────────── */}
      {showAdd && (
        <ClientForm
          title="Nouveau Client / زبون جديد"
          initial={EMPTY_CLIENT()}
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
          color="blue"
        />
      )}

      {/* ── Edit form ─────────────────────────────────────────────────────────── */}
      {editId && editClient && (
        <ClientForm
          title={`Modifier : ${editClient.nom}`}
          initial={{
            nom: editClient.nom, secteur: editClient.secteur, zone: editClient.zone,
            type: editClient.type, typeAutre: editClient.typeAutre,
            taille: editClient.taille, typeProduits: editClient.typeProduits,
            rotation: editClient.rotation, telephone: editClient.telephone,
            email: editClient.email, adresse: editClient.adresse, ice: editClient.ice,
            notes: editClient.notes, categorie: editClient.categorie,
            creditAutorise: editClient.creditAutorise, plafondCredit: editClient.plafondCredit,
            creditSolde: editClient.creditSolde, modalitePaiement: editClient.modalitePaiement,
            prevendeurId: editClient.prevendeurId, teamLeadId: editClient.teamLeadId,
          } as Omit<Client, "id" | "createdBy" | "createdAt">}
          onSave={handleEdit}
          onCancel={() => setEditId(null)}
          color="indigo"
        />
      )}

      {/* ── Stats ─────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total clients",     value: clients.length,  color: "bg-blue-50 border-blue-200 text-blue-700" },
          { label: "CHR / HORECA",      value: chrCount,        color: "bg-purple-50 border-purple-200 text-purple-700" },
          { label: "Avec portail",      value: withPortal,      color: "bg-green-50 border-green-200 text-green-700" },
          { label: "Portails actifs",   value: activePortal,    color: "bg-indigo-50 border-indigo-200 text-indigo-700" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 flex flex-col gap-1 ${s.color}`}>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-xs font-semibold">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Flash message ─────────────────────────────────────────────────────── */}
      {msg && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border ${msg.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={msg.ok ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
          </svg>
          {msg.text}
        </div>
      )}

      {/* ── Delete confirm modal ────────────────────────────────────────────── */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-slate-900">Confirmer la suppression</p>
                <p className="text-sm text-slate-500">Cette action est irréversible</p>
              </div>
            </div>
            <p className="text-sm text-slate-700">
              Supprimer le client <strong>&quot;{confirmDel.nom}&quot;</strong> ?
              <span className="block mt-1 text-xs text-red-600">⚠️ Les commandes existantes ne seront pas supprimées.</span>
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">Annuler</button>
              <button onClick={handleConfirmDelete} className="px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors shadow">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset password reveal ───────────────────────────────────────────── */}
      {resetPwd && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-300 text-sm flex-wrap">
          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <span className="text-amber-800 font-medium">Nouveau mot de passe :</span>
          <code className="font-mono font-bold bg-amber-100 px-3 py-1 rounded-lg text-amber-900 tracking-wider">{resetPwd.pwd}</code>
          <span className="text-amber-600 text-xs">— Notez-le et communiquez-le à l&apos;utilisateur.</span>
          <button onClick={() => setResetPwd(null)} className="ml-auto text-amber-400 hover:text-amber-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-52">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email, tél, ICE…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value as typeof filterCat)}
          className="px-3 py-2 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="">Toutes catégories</option>
          {CATEGORIE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="">Tous types</option>
          {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        {(search || filterCat || filterType) && (
          <button onClick={() => { setSearch(""); setFilterCat(""); setFilterType("") }}
            className="px-3 py-2 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:text-foreground transition-colors">
            ✕ Effacer
          </button>
        )}
      </div>

      {/* ── Clients table ─────────────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border text-xs text-muted-foreground font-medium">
          {filtered.length} client(s) sur {clients.length}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800 text-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Type / Zone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Catégorie / Crédit</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Portail</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const pu = getPortalUser(c.id)
                const catColors: Record<string, string> = {
                  chr: "bg-purple-100 text-purple-700",
                  marchand: "bg-blue-100 text-blue-700",
                  particulier: "bg-green-100 text-green-700",
                }
                return (
                  <tr key={c.id} className={`border-t border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>

                    {/* Nom */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{c.nom}</p>
                      {c.ice && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">ICE: {c.ice}</p>}
                    </td>

                    {/* Type / Zone */}
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold capitalize">{c.type}</span>
                      <p className="text-xs text-muted-foreground mt-1">{c.secteur}{c.zone ? ` / ${c.zone}` : ""}</p>
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium">{c.telephone || "—"}</p>
                      <p className="text-xs text-muted-foreground">{c.email || ""}</p>
                    </td>

                    {/* Catégorie / Crédit */}
                    <td className="px-4 py-3">
                      {c.categorie && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${catColors[c.categorie] ?? "bg-slate-100 text-slate-700"}`}>
                          {c.categorie.toUpperCase()}
                        </span>
                      )}
                      {c.creditAutorise ? (
                        <div className="mt-1">
                          <span className="text-xs font-bold">{(c.creditSolde ?? 0).toLocaleString("fr-MA")} DH</span>
                          <span className="text-[10px] text-muted-foreground ml-1">/ {(c.plafondCredit ?? 0).toLocaleString("fr-MA")} DH</span>
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Comptant</p>
                      )}
                    </td>

                    {/* Portail */}
                    <td className="px-4 py-3">
                      {pu ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${pu.actif ? "bg-green-500" : "bg-red-400"}`} />
                            <span className={`text-xs font-bold ${pu.actif ? "text-green-700" : "text-red-600"}`}>
                              {pu.actif ? "Actif" : "Inactif"}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{pu.email}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Sans compte</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* Edit button */}
                        {canAdd && (
                          <button
                            onClick={() => { setShowAdd(false); setEditId(c.id) }}
                            title="Modifier ce client"
                            className="p-1.5 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 text-slate-400 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {/* Portal toggle */}
                        {pu && (
                          <>
                            <button onClick={() => toggleActif(pu.id)}
                              title={pu.actif ? "Désactiver le portail" : "Activer le portail"}
                              className={`p-1.5 rounded-lg transition-colors ${pu.actif ? "hover:bg-red-50 hover:text-red-600 text-slate-400" : "hover:bg-green-50 hover:text-green-600 text-slate-400"}`}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={pu.actif ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
                              </svg>
                            </button>
                            <button onClick={() => handleResetPwd(pu.id)} title="Réinitialiser mot de passe"
                              className="p-1.5 rounded-lg hover:bg-amber-50 hover:text-amber-600 text-slate-400 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                              </svg>
                            </button>
                          </>
                        )}
                        {/* Delete */}
                        {canDelete && (
                          <button onClick={() => setConfirmDel({ id: c.id, nom: c.nom })} title="Supprimer"
                            className="p-1.5 rounded-lg hover:bg-red-100 hover:text-red-700 text-red-400 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    {clients.length === 0 ? "Aucun client enregistré — cliquez sur « Nouveau client » pour commencer." : "Aucun résultat pour ces critères."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
