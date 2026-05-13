"use client"

import { useState, useEffect } from "react"
import {
  store,
  type User,
  type Commande,
  type Article,
  type Client,
  type Fournisseur,
  type PurchaseOrder,
  type LigneCommande,
  type AccountRequest,
} from "@/lib/store"
import FreshLinkLogo from "@/components/ui/FreshLinkLogo"
import ArticleCombobox from "@/components/ui/ArticleCombobox"

// ─── Helpers ───────────────────────────────────────────────────────────────

function getJ1(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split("T")[0]
}

const STATUT_CONFIG: Record<string, { label: string; labelAr: string; cls: string }> = {
  en_attente:              { label: "En attente",     labelAr: "في الانتظار",      cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  en_attente_approbation:  { label: "En approbation", labelAr: "بانتظار الموافقة", cls: "bg-orange-100 text-orange-800 border-orange-200" },
  valide:                  { label: "Validée",        labelAr: "مقبولة",           cls: "bg-blue-100 text-blue-800 border-blue-200" },
  refuse:                  { label: "Refusée",        labelAr: "مرفوضة",           cls: "bg-red-100 text-red-800 border-red-200" },
  en_transit:              { label: "En livraison",   labelAr: "قيد التوصيل",      cls: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  livre:                   { label: "Livrée",         labelAr: "تم التسليم",       cls: "bg-green-100 text-green-800 border-green-200" },
  retour:                  { label: "Retour",         labelAr: "مرتجع",            cls: "bg-rose-100 text-rose-800 border-rose-200" },
}

// ─── Login Screen ───────────────────────────────────────────────────────────

interface LoginScreenProps {
  onLogin: (u: User) => void
  onRequestAccount: () => void
}

function LoginScreen({ onLogin, onRequestAccount }: LoginScreenProps) {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const company = store.getCompanyConfig()

  const handleSubmit = () => {
    setError("")
    if (!identifier.trim() || !password.trim()) {
      setError("Veuillez saisir votre identifiant et mot de passe.")
      return
    }
    setLoading(true)
    setTimeout(() => {
      const users = store.getUsers()
      const found = users.find(u =>
        (u.email.toLowerCase() === identifier.toLowerCase().trim() ||
          u.name.toLowerCase() === identifier.toLowerCase().trim()) &&
        u.password === password &&
        (u.role === "client" || u.role === "fournisseur") &&
        u.actif
      )
      setLoading(false)
      if (!found) {
        setError("Identifiant ou mot de passe incorrect, ou compte inactif.")
        return
      }
      onLogin(found)
    }, 300)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo + titre */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white shadow-md flex items-center justify-center border border-slate-200">
            {company.logo
              ? <img src={company.logo} alt="Logo" className="w-full h-full object-contain" />
              : <FreshLinkLogo size={52} />
            }
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-slate-900">{company.appName ?? "FreshLink Pro"}</h1>
            <p className="text-sm text-slate-500 mt-1">Portail Clients & Fournisseurs</p>
            <p className="text-xs text-slate-400" dir="rtl">بوابة العملاء والموردين</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Connexion</h2>
            <p className="text-sm text-slate-500 mt-0.5">Accès réservé aux clients et fournisseurs enregistrés</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">Email ou nom d'utilisateur</label>
            <input
              type="text"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              placeholder="votre@email.ma"
              autoComplete="username"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">Mot de passe</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1">
                {showPwd
                  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                }
              </button>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            {loading
              ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
            }
            {loading ? "Connexion…" : "Se connecter"}
          </button>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs text-center text-slate-500 mb-3">Vous n'avez pas encore de compte ?</p>
            <button
              onClick={onRequestAccount}
              className="w-full py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              Demander la création d'un compte
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          {company.nom || "FreshLink"} — Accès sécurisé partenaires
        </p>
      </div>
    </div>
  )
}

// ─── Account Request Form ───────────────────────────────────────────────────

interface AccountRequestFormProps {
  onBack: () => void
}

function AccountRequestForm({ onBack }: AccountRequestFormProps) {
  const company = store.getCompanyConfig()
  const [type, setType] = useState<"client" | "fournisseur">("client")
  const [nom, setNom] = useState("")
  const [email, setEmail] = useState("")
  const [telephone, setTelephone] = useState("")
  const [societe, setSociete] = useState("")
  const [ice, setIce] = useState("")
  const [ville, setVille] = useState("")
  const [message, setMessage] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = () => {
    setError("")
    if (!nom.trim() || !email.trim() || !telephone.trim() || !societe.trim()) {
      setError("Veuillez remplir tous les champs obligatoires (*).")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Adresse email invalide.")
      return
    }

    const req: AccountRequest = {
      id: store.genId(),
      type,
      nom: nom.trim(),
      email: email.trim(),
      telephone: telephone.trim(),
      societe: societe.trim(),
      ice: ice.trim(),
      ville: ville.trim(),
      message: message.trim(),
      statut: "en_attente",
      createdAt: new Date().toISOString(),
    }
    store.saveAccountRequest(req)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 flex flex-col items-center gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Demande envoyée !</h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Votre demande de création de compte a bien été enregistrée. Un responsable de <strong>{company.nom || "notre équipe"}</strong> va l'examiner et vous contactera par email ou téléphone.
            </p>
            <p className="text-xs text-slate-400 mt-2" dir="rtl">
              تم إرسال طلبك بنجاح. سيتم التواصل معك قريباً.
            </p>
          </div>
          <button onClick={onBack} className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
            Retour à la connexion
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex flex-col items-center justify-start py-8 px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Demande de création de compte</h1>
            <p className="text-xs text-slate-500">طلب إنشاء حساب</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 flex flex-col gap-5">
          {/* Type selector */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Type de compte *</p>
            <div className="flex gap-3">
              {([
                { v: "client", label: "Client", labelAr: "عميل", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
                { v: "fournisseur", label: "Fournisseur", labelAr: "مورد", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
              ] as const).map(opt => (
                <label key={opt.v}
                  className={`flex-1 flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${type === opt.v ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}
                  onClick={() => setType(opt.v)}>
                  <svg className={`w-5 h-5 ${type === opt.v ? "text-blue-600" : "text-slate-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={opt.icon} />
                  </svg>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{opt.label}</p>
                    <p className="text-[10px] text-slate-400" dir="rtl">{opt.labelAr}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              {error}
            </div>
          )}

          {/* Form fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { f: "nom", label: "Nom complet *", placeholder: "Mohammed Alami", value: nom, set: setNom, type: "text" },
              { f: "email", label: "Email *", placeholder: "contact@societe.ma", value: email, set: setEmail, type: "email" },
              { f: "telephone", label: "Téléphone *", placeholder: "+212 6 00 00 00 00", value: telephone, set: setTelephone, type: "tel" },
              { f: "societe", label: "Raison sociale *", placeholder: "Ma Société SARL", value: societe, set: setSociete, type: "text" },
              { f: "ice", label: "ICE (optionnel)", placeholder: "00000000000000000000", value: ice, set: setIce, type: "text" },
              { f: "ville", label: "Ville", placeholder: "Casablanca", value: ville, set: setVille, type: "text" },
            ].map(({ f, label, placeholder, value, set, type: t }) => (
              <div key={f} className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">{label}</label>
                <input
                  type={t}
                  value={value}
                  onChange={e => set(e.target.value)}
                  placeholder={placeholder}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">Message / Informations complémentaires</label>
            <textarea
              rows={3}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={type === "client"
                ? "Décrivez votre activité, vos besoins, votre fréquence de commande…"
                : "Décrivez vos produits, capacités de livraison, zones couvertes…"}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
            />
          </div>

          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>Votre demande sera examinée par un responsable de notre équipe. Vous serez contacté(e) sous 24 à 48h ouvrées.</span>
          </div>

          <button
            onClick={handleSubmit}
            className="w-full py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            Envoyer ma demande
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Client Dashboard ───────────────────────────────────────────────────────

interface LigneForm { articleId: string; quantite: string }
type ClientTab = "commandes" | "commande" | "catalogue"

function ClientDashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [tab, setTab] = useState<ClientTab>("commandes")
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lignes, setLignes] = useState<LigneForm[]>([{ articleId: "", quantite: "" }])
  const [dateLivraison, setDateLivraison] = useState(getJ1())
  const [notes, setNotes] = useState("")
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [articleSearch, setArticleSearch] = useState("")
  const company = store.getCompanyConfig()

  const refresh = () => {
    const allClients = store.getClients()
    const myClient = allClients.find(c => c.id === user.clientId) ?? null
    setClient(myClient)
    const myCommandes = user.clientId
      ? store.getCommandes().filter(c => c.clientId === user.clientId)
      : []
    setCommandes(myCommandes.sort((a, b) => b.date.localeCompare(a.date)))
    setArticles(store.getArticles().filter(a => a.actif))
  }

  useEffect(() => { refresh() }, [])

  const filteredArticles = articles.filter(a =>
    !articleSearch || a.nom.toLowerCase().includes(articleSearch.toLowerCase())
  )

  const handleSubmitOrder = () => {
    setSubmitError("")
    const validLignes = lignes.filter(l => l.articleId && l.quantite && Number(l.quantite) > 0)
    if (!validLignes.length) { setSubmitError("Ajoutez au moins un article."); return }
    if (!client) { setSubmitError("Compte client non lié. Contactez votre responsable."); return }

    const lignesToSave: LigneCommande[] = validLignes.map(l => {
      const art = articles.find(a => a.id === l.articleId)!
      return {
        articleId: l.articleId,
        articleNom: art.nom,
        quantite: Number(l.quantite),
        prixUnitaire: art.prixVente ?? 0,
        unite: art.unite ?? "kg",
        total: Number(l.quantite) * (art.prixVente ?? 0),
      }
    })

    const cmd: Commande = {
      id: store.genId(),
      date: store.today(),
      dateLivraison,
      clientId: client.id,
      clientNom: client.nom,
      lignes: lignesToSave,
      total: lignesToSave.reduce((s, l) => s + l.total, 0),
      statut: "en_attente",
      notes,
      createdBy: user.id,
    }
    store.saveCommandes([...store.getCommandes(), cmd])
    setLignes([{ articleId: "", quantite: "" }])
    setNotes("")
    setDateLivraison(getJ1())
    setSubmitSuccess(true)
    setTimeout(() => { setSubmitSuccess(false); setTab("commandes"); refresh() }, 2500)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {company.logo
              ? <img src={company.logo} alt="Logo" className="h-8 object-contain" />
              : <FreshLinkLogo size={28} />
            }
            <div>
              <p className="text-sm font-bold text-slate-800">{company.appName ?? "FreshLink"}</p>
              <p className="text-[10px] text-slate-400">Client — {client?.nom ?? user.name}</p>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Déconnexion
          </button>
        </div>
        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4 pb-0 flex gap-1">
          {([
            { id: "commandes" as const, label: "Mes commandes" },
            { id: "commande" as const, label: "Nouvelle commande" },
            { id: "catalogue" as const, label: "Catalogue" },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${tab === t.id ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5">

        {/* Commandes list */}
        {tab === "commandes" && (
          <div className="flex flex-col gap-3">
            {commandes.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                <p className="text-sm font-medium">Aucune commande pour le moment</p>
                <button onClick={() => setTab("commande")} className="mt-3 text-xs text-blue-600 font-semibold hover:underline">Passer ma première commande →</button>
              </div>
            ) : commandes.map(cmd => {
              const cfg = STATUT_CONFIG[cmd.statut] ?? { label: cmd.statut, labelAr: "", cls: "bg-slate-100 text-slate-600 border-slate-200" }
              return (
                <div key={cmd.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <button className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedId(expandedId === cmd.id ? null : cmd.id)}>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800">Commande du {cmd.date}</span>
                        <span className="text-xs text-slate-500">Livraison : {cmd.dateLivraison ?? "—"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                      <span className="text-sm font-bold text-slate-700">{(cmd.total ?? 0).toFixed(2)} DH</span>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedId === cmd.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </button>
                  {expandedId === cmd.id && (
                    <div className="border-t border-slate-100 px-4 py-3">
                      <table className="w-full text-xs">
                        <thead><tr className="text-slate-400 uppercase text-[10px]"><th className="text-left pb-1">Article</th><th className="text-right pb-1">Qté</th><th className="text-right pb-1">PU</th><th className="text-right pb-1">Total</th></tr></thead>
                        <tbody>
                          {cmd.lignes.map((l, i) => (
                            <tr key={i} className="border-t border-slate-100">
                              <td className="py-1.5 text-slate-700 font-medium">{l.articleNom}</td>
                              <td className="py-1.5 text-right text-slate-600">{l.quantite} {l.unite}</td>
                              <td className="py-1.5 text-right text-slate-600">{l.prixUnitaire.toFixed(2)}</td>
                              <td className="py-1.5 text-right font-semibold text-slate-800">{l.total.toFixed(2)} DH</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {cmd.notes && <p className="text-xs text-slate-500 italic mt-2 pt-2 border-t border-slate-100">Note : {cmd.notes}</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* New order */}
        {tab === "commande" && (
          <div className="flex flex-col gap-4">
            {submitSuccess && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-green-50 border border-green-200 text-green-800 text-sm font-semibold">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Commande envoyée avec succès !
              </div>
            )}
            {submitError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                {submitError}
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3">
              <h3 className="font-bold text-slate-800">Articles commandés</h3>
              {lignes.map((ligne, i) => (
                <div key={i} className="flex gap-2">
                  <ArticleCombobox
                    articles={articles}
                    value={ligne.articleId}
                    onChange={(artId, _art) => setLignes(prev => prev.map((l, j) => j === i ? { ...l, articleId: artId } : l))}
                    placeholder="— Choisir un article —"
                    className="flex-1"
                  />
                  <input type="number" min="0" step="0.5" value={ligne.quantite}
                    onChange={e => setLignes(prev => prev.map((l, j) => j === i ? { ...l, quantite: e.target.value } : l))}
                    className="w-24 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Qté" />
                  <button onClick={() => setLignes(prev => prev.filter((_, j) => j !== i))}
                    className="p-2 rounded-xl text-red-400 hover:bg-red-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <button onClick={() => setLignes(prev => [...prev, { articleId: "", quantite: "" }])}
                className="flex items-center gap-2 text-xs text-blue-600 font-semibold py-2 hover:underline">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Ajouter un article
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Date de livraison souhaitée</label>
                <input type="date" value={dateLivraison} onChange={e => setDateLivraison(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Notes / Instructions</label>
                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none resize-none"
                  placeholder="Instructions spéciales, adresse de livraison…" />
              </div>
            </div>

            <button onClick={handleSubmitOrder}
              className="w-full py-3 rounded-2xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              Envoyer la commande
            </button>
          </div>
        )}

        {/* Catalogue */}
        {tab === "catalogue" && (
          <div className="flex flex-col gap-3">
            <input value={articleSearch} onChange={e => setArticleSearch(e.target.value)}
              placeholder="Rechercher un article…"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            <div className="grid grid-cols-2 gap-3">
              {filteredArticles.map(a => (
                <div key={a.id} className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col gap-2">
                  <p className="font-bold text-sm text-slate-800">{a.nom}</p>
                  {a.nomAr && <p className="text-xs text-slate-400" dir="rtl">{a.nomAr}</p>}
                  <p className="text-xs text-slate-500">{a.unite} — {a.famille}</p>
                  {a.prixVente != null && (
                    <p className="text-sm font-black text-blue-700">{a.prixVente.toFixed(2)} DH / {a.unite}</p>
                  )}
                  <button onClick={() => { setLignes(prev => { const empty = prev.findIndex(l => !l.articleId); if (empty >= 0) { const n = [...prev]; n[empty] = { articleId: a.id, quantite: "1" }; return n } return [...prev, { articleId: a.id, quantite: "1" }] }); setTab("commande") }}
                    className="mt-auto text-xs font-semibold py-1.5 px-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                    + Ajouter
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Fournisseur Dashboard ──────────────────────────────────────────────────

type FournisseurTab = "commandes" | "profil"

function FournisseurDashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [tab, setTab] = useState<FournisseurTab>("commandes")
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [fournisseur, setFournisseur] = useState<Fournisseur | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const company = store.getCompanyConfig()

  const refresh = () => {
    const allFourn = store.getFournisseurs()
    const myFourn = allFourn.find(f => f.id === user.fournisseurId) ?? null
    setFournisseur(myFourn)
    const allOrders = store.getPurchaseOrders()
    const myOrders = user.fournisseurId
      ? allOrders.filter(o => o.fournisseurId === user.fournisseurId)
      : []
    setOrders(myOrders.sort((a, b) => b.date.localeCompare(a.date)))
  }

  useEffect(() => { refresh() }, [])

  const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
    draft:      { label: "Brouillon",    cls: "bg-slate-100 text-slate-600" },
    sent:       { label: "Envoyé",       cls: "bg-blue-100 text-blue-700" },
    received:   { label: "Reçu",         cls: "bg-green-100 text-green-700" },
    partial:    { label: "Partiel",      cls: "bg-amber-100 text-amber-700" },
    cancelled:  { label: "Annulé",       cls: "bg-red-100 text-red-700" },
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {company.logo
              ? <img src={company.logo} alt="Logo" className="h-8 object-contain" />
              : <FreshLinkLogo size={28} />
            }
            <div>
              <p className="text-sm font-bold text-slate-800">{company.appName ?? "FreshLink"}</p>
              <p className="text-[10px] text-slate-400">Fournisseur — {fournisseur?.nom ?? user.name}</p>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Déconnexion
          </button>
        </div>
        <div className="max-w-2xl mx-auto px-4 flex gap-1">
          {([
            { id: "commandes" as const, label: "Bons de commande" },
            { id: "profil" as const, label: "Mon profil" },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${tab === t.id ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {tab === "commandes" && (
          <div className="flex flex-col gap-3">
            {orders.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                <p className="text-sm font-medium">Aucun bon de commande reçu</p>
              </div>
            ) : orders.map(o => {
              const cfg = ORDER_STATUS[o.statut] ?? { label: o.statut, cls: "bg-slate-100 text-slate-600" }
              return (
                <div key={o.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <button className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}>
                    <div>
                      <p className="text-sm font-bold text-slate-800">BC du {o.date}</p>
                      <p className="text-xs text-slate-500">Livraison prévue : {o.dateLivraisonSouhaitee ?? "—"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                      <span className="text-sm font-bold text-slate-700">{(o.montantTotal ?? 0).toFixed(2)} DH</span>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedId === o.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </button>
                  {expandedId === o.id && (
                    <div className="border-t border-slate-100 px-4 py-3">
                      <table className="w-full text-xs">
                        <thead><tr className="text-slate-400 uppercase text-[10px]"><th className="text-left pb-1">Article</th><th className="text-right pb-1">Qté</th><th className="text-right pb-1">PU</th><th className="text-right pb-1">Total</th></tr></thead>
                        <tbody>
                          {o.lignes?.map((l, i) => (
                            <tr key={i} className="border-t border-slate-100">
                              <td className="py-1.5 text-slate-700 font-medium">{l.articleNom}</td>
                              <td className="py-1.5 text-right text-slate-600">{l.quantiteCommandee} {l.unite}</td>
                              <td className="py-1.5 text-right text-slate-600">{(l.prixUnitaire ?? 0).toFixed(2)}</td>
                              <td className="py-1.5 text-right font-semibold">{((l.quantiteCommandee ?? 0) * (l.prixUnitaire ?? 0)).toFixed(2)} DH</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {o.notes && <p className="text-xs text-slate-500 italic mt-2 pt-2 border-t border-slate-100">Note : {o.notes}</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {tab === "profil" && fournisseur && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-3">
            <h3 className="font-bold text-slate-800 text-base">{fournisseur.nom}</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { label: "Téléphone", value: fournisseur.telephone },
                { label: "Email", value: fournisseur.email },
                { label: "Ville", value: fournisseur.ville },
                { label: "ICE", value: fournisseur.ice },
              ].filter(r => r.value).map(r => (
                <div key={r.label}>
                  <p className="text-slate-400 font-semibold uppercase text-[10px]">{r.label}</p>
                  <p className="text-slate-700 font-medium mt-0.5">{r.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Export ────────────────────────────────────────────────────────────

type PortailView = "login" | "request" | "client" | "fournisseur"

interface Props {
  onInternalLogin?: (u: User) => void
}

export default function PortailExterne({ onInternalLogin }: Props) {
  const [view, setView] = useState<PortailView>("login")
  const [user, setUser] = useState<User | null>(null)

  const handleLogin = (u: User) => {
    setUser(u)
    if (u.role === "client") setView("client")
    else if (u.role === "fournisseur") setView("fournisseur")
  }

  const handleLogout = () => {
    setUser(null)
    setView("login")
  }

  if (view === "login") return (
    <LoginScreen onLogin={handleLogin} onRequestAccount={() => setView("request")} />
  )
  if (view === "request") return <AccountRequestForm onBack={() => setView("login")} />
  if (view === "client" && user) return <ClientDashboard user={user} onLogout={handleLogout} />
  if (view === "fournisseur" && user) return <FournisseurDashboard user={user} onLogout={handleLogout} />
  return null
}
