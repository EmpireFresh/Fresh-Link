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

const INPUT_CLS = "w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
const LABEL_CLS = "text-xs font-semibold text-slate-600 mb-1 block"

type ClientType = "particulier" | "marchand" | "restaurant" | "hotel" | "traiteur" | "supermarche" | "autre"
type FournisseurType = "producteur" | "grossiste" | "importateur" | "transformateur"

const CLIENT_TYPES: { v: ClientType; label: string; emoji: string; desc: string }[] = [
  { v: "particulier",  label: "Particulier",           emoji: "🧑",  desc: "Usage personnel" },
  { v: "marchand",     label: "Marchand / Épicier",    emoji: "🏪",  desc: "Épicerie, alimentation générale" },
  { v: "restaurant",   label: "Restaurant / Café",     emoji: "🍽️", desc: "Restauration, snack, café" },
  { v: "hotel",        label: "Hôtel / Résidence",     emoji: "🏨",  desc: "Hôtellerie, résidence touristique" },
  { v: "traiteur",     label: "Traiteur / Cantine",    emoji: "👨‍🍳", desc: "Traiteur, self, cantine" },
  { v: "supermarche",  label: "Super / Grande surface", emoji: "🛒", desc: "Supermarché, grande surface" },
]

const FOURNISSEUR_TYPES: { v: FournisseurType; label: string; emoji: string; desc: string }[] = [
  { v: "producteur",    label: "Producteur / Agriculteur", emoji: "🌱", desc: "Production directe, ferme" },
  { v: "grossiste",     label: "Grossiste / Distributeur", emoji: "🏭", desc: "Distribution en gros" },
  { v: "importateur",   label: "Importateur",              emoji: "🚢", desc: "Import de produits étrangers" },
  { v: "transformateur",label: "Transformateur",           emoji: "⚙️", desc: "Transformation, conditionnement" },
]

const FAMILLES_PRODUITS = [
  "Légumes", "Fruits", "Agrumes", "Herbes aromatiques",
  "Viandes", "Poissons & Fruits de mer", "Produits laitiers",
  "Œufs & Volailles", "Épices & Condiments", "Céréales & Légumineuses",
  "Surgelés", "Produits secs",
]

const VOLUMES = [
  "Moins de 500 kg / semaine",
  "500 kg – 2 tonnes / semaine",
  "2 – 10 tonnes / semaine",
  "Plus de 10 tonnes / semaine",
]

interface AccountRequestFormProps {
  onBack: () => void
}

function AccountRequestForm({ onBack }: AccountRequestFormProps) {
  const company = store.getCompanyConfig()

  // Step: "type" → "detail"
  const [step, setStep] = useState<"type" | "detail">("type")
  const [type, setType] = useState<"client" | "fournisseur" | "">("")

  // Common fields
  const [nom, setNom]               = useState("")
  const [email, setEmail]           = useState("")
  const [telephone, setTelephone]   = useState("")
  const [ville, setVille]           = useState("")
  const [adresse, setAdresse]       = useState("")
  const [message, setMessage]       = useState("")

  // Client fields
  const [typeClient, setTypeClient] = useState<ClientType | "">("")
  const [societe, setSociete]       = useState("")
  const [ice, setIce]               = useState("")
  const [nbCouverts, setNbCouverts] = useState("")
  const [nbChambres, setNbChambres] = useState("")

  // Fournisseur fields
  const [typeFourn, setTypeFourn]   = useState<FournisseurType | "">("")
  const [familles, setFamilles]     = useState<string[]>([])
  const [volume, setVolume]         = useState("")
  const [zoneLivraison, setZoneLiv] = useState("")

  const [submitted, setSubmitted]   = useState(false)
  const [error, setError]           = useState("")

  const isParticulier = typeClient === "particulier"
  const isCommerce = typeClient !== "" && typeClient !== "particulier"
  const needsCouverts = typeClient === "restaurant" || typeClient === "traiteur"
  const needsChambres = typeClient === "hotel"

  const toggleFamille = (f: string) =>
    setFamilles(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])

  const handleSubmit = () => {
    setError("")
    if (!nom.trim() || !telephone.trim()) {
      setError("Nom et téléphone sont obligatoires.")
      return
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Adresse email invalide.")
      return
    }
    if (type === "client" && !typeClient) {
      setError("Veuillez choisir votre type de compte client.")
      return
    }
    if (type === "fournisseur" && (!typeFourn || familles.length === 0)) {
      setError("Veuillez choisir votre type et au moins une famille de produits.")
      return
    }
    if (isCommerce && !societe.trim()) {
      setError("La raison sociale est obligatoire.")
      return
    }

    const req: AccountRequest = {
      id: store.genId(),
      type: type as "client" | "fournisseur",
      nom: nom.trim(),
      email: email.trim(),
      telephone: telephone.trim(),
      societe: societe.trim() || nom.trim(),
      ice: ice.trim() || undefined,
      ville: ville.trim() || undefined,
      adresse: adresse.trim() || undefined,
      message: message.trim() || undefined,
      // client
      typeClient: typeClient || undefined,
      nbCouverts: nbCouverts ? parseInt(nbCouverts) : undefined,
      nbChambres: nbChambres ? parseInt(nbChambres) : undefined,
      // fournisseur
      typeFournisseur: typeFourn || undefined,
      familles: familles.length > 0 ? familles : undefined,
      volumeEstime: volume || undefined,
      zoneLivraison: zoneLivraison.trim() || undefined,
      statut: "en_attente",
      createdAt: new Date().toISOString(),
    }
    const reqs = JSON.parse(localStorage.getItem("fl_account_requests") ?? "[]")
    reqs.push(req)
    localStorage.setItem("fl_account_requests", JSON.stringify(reqs))
    setSubmitted(true)
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 flex flex-col items-center gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Demande envoyée !</h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Votre demande a bien été enregistrée. L&apos;équipe de <strong>{company.nom || "FreshLink"}</strong> vous contactera sous 24 à 48h.
            </p>
            <p className="text-xs text-slate-400 mt-2" dir="rtl">تم إرسال طلبك بنجاح. سيتم التواصل معك قريباً.</p>
          </div>
          <button onClick={onBack}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
            Retour à la connexion
          </button>
        </div>
      </div>
    )
  }

  // ── Step 1 : choose Client or Fournisseur ──────────────────────────────────
  if (step === "type") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* back */}
          <button onClick={onBack}
            className="flex items-center gap-2 mb-6 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Retour à la connexion
          </button>

          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-7">
            <div className="text-center mb-7">
              <h1 className="text-xl font-black text-slate-900">Créer un compte</h1>
              <p className="text-sm text-slate-500 mt-1">Vous êtes…</p>
              <p className="text-xs text-slate-400 mt-0.5" dir="rtl">اختر نوع حسابك</p>
            </div>

            <div className="flex flex-col gap-3">
              {([
                { v: "client",      label: "Un Client",      labelAr: "عميل",  emoji: "🛍️", desc: "Épicier, restaurant, hôtel, particulier…" },
                { v: "fournisseur", label: "Un Fournisseur", labelAr: "مورد",  emoji: "🚚", desc: "Producteur, grossiste, importateur…" },
              ] as const).map(opt => (
                <button key={opt.v}
                  onClick={() => { setType(opt.v); setStep("detail") }}
                  className="flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left group">
                  <span className="text-3xl">{opt.emoji}</span>
                  <div className="flex-1">
                    <p className="font-bold text-slate-800 group-hover:text-blue-700">{opt.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                  </div>
                  <svg className="w-5 h-5 text-slate-300 group-hover:text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 2 : detail form ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex flex-col items-center justify-start py-6 px-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => { setStep("type"); setError("") }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Retour
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-900">
              {type === "client" ? "Demande client" : "Demande fournisseur"}
            </h1>
            <p className="text-[11px] text-slate-400">{type === "client" ? "طلب حساب عميل" : "طلب حساب مورد"}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-5 flex flex-col gap-5">

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              {error}
            </div>
          )}

          {/* ── CLIENT sub-type ──────────────────────────────────────────── */}
          {type === "client" && (
            <div>
              <p className={LABEL_CLS}>Votre type de compte *</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CLIENT_TYPES.map(ct => (
                  <button key={ct.v}
                    onClick={() => setTypeClient(ct.v)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all text-xs font-semibold ${
                      typeClient === ct.v
                        ? "border-blue-400 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}>
                    <span className="text-xl">{ct.emoji}</span>
                    <span className="leading-tight">{ct.label}</span>
                  </button>
                ))}
              </div>
              {typeClient && (
                <p className="text-[11px] text-slate-400 mt-1.5 ml-1">
                  {CLIENT_TYPES.find(c => c.v === typeClient)?.desc}
                </p>
              )}
            </div>
          )}

          {/* ── FOURNISSEUR sub-type ─────────────────────────────────────── */}
          {type === "fournisseur" && (
            <div>
              <p className={LABEL_CLS}>Votre type d'activité *</p>
              <div className="grid grid-cols-2 gap-2">
                {FOURNISSEUR_TYPES.map(ft => (
                  <button key={ft.v}
                    onClick={() => setTypeFourn(ft.v)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                      typeFourn === ft.v
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}>
                    <span className="text-xl shrink-0">{ft.emoji}</span>
                    <div>
                      <p className="text-xs font-bold leading-tight">{ft.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{ft.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── COMMON : Nom + Téléphone ─────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>
                {isParticulier ? "Nom complet *" : "Nom du contact *"}
              </label>
              <input type="text" value={nom} onChange={e => setNom(e.target.value)}
                placeholder={isParticulier ? "Mohammed Alami" : "Responsable achats"}
                className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Téléphone *</label>
              <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)}
                placeholder="+212 6 00 00 00 00" className={INPUT_CLS} />
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>Email <span className="font-normal text-slate-400">(optionnel)</span></label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="contact@societe.ma" className={INPUT_CLS} />
          </div>

          {/* ── COMMERCE/FOURNISSEUR : Raison sociale + Ville ────────────── */}
          {(isCommerce || type === "fournisseur") && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Raison sociale *</label>
                <input type="text" value={societe} onChange={e => setSociete(e.target.value)}
                  placeholder="Nom de votre société" className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Ville</label>
                <input type="text" value={ville} onChange={e => setVille(e.target.value)}
                  placeholder="Casablanca" className={INPUT_CLS} />
              </div>
            </div>
          )}

          {/* Particulier: ville + adresse */}
          {isParticulier && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Ville</label>
                <input type="text" value={ville} onChange={e => setVille(e.target.value)}
                  placeholder="Casablanca" className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Adresse <span className="font-normal text-slate-400">(optionnel)</span></label>
                <input type="text" value={adresse} onChange={e => setAdresse(e.target.value)}
                  placeholder="Rue, quartier…" className={INPUT_CLS} />
              </div>
            </div>
          )}

          {/* ── ICE pour commerce/fournisseur ───────────────────────────── */}
          {(isCommerce || type === "fournisseur") && (
            <div>
              <label className={LABEL_CLS}>ICE <span className="font-normal text-slate-400">(optionnel — 15 chiffres)</span></label>
              <input type="text" value={ice} onChange={e => setIce(e.target.value)}
                placeholder="000000000000000" maxLength={20} className={INPUT_CLS} />
            </div>
          )}

          {/* ── Restaurant : nb couverts ─────────────────────────────────── */}
          {needsCouverts && (
            <div>
              <label className={LABEL_CLS}>
                {typeClient === "restaurant" ? "Nombre de couverts (capacité)" : "Nombre de couverts / repas / jour"}
              </label>
              <input type="number" min={1} value={nbCouverts} onChange={e => setNbCouverts(e.target.value)}
                placeholder="ex : 80" className={INPUT_CLS} />
            </div>
          )}

          {/* ── Hôtel : nb chambres ──────────────────────────────────────── */}
          {needsChambres && (
            <div>
              <label className={LABEL_CLS}>Nombre de chambres</label>
              <input type="number" min={1} value={nbChambres} onChange={e => setNbChambres(e.target.value)}
                placeholder="ex : 40" className={INPUT_CLS} />
            </div>
          )}

          {/* ── FOURNISSEUR : familles produits ──────────────────────────── */}
          {type === "fournisseur" && (
            <div>
              <p className={LABEL_CLS}>Familles de produits proposées * <span className="font-normal text-slate-400">(plusieurs choix possibles)</span></p>
              <div className="flex flex-wrap gap-2">
                {FAMILLES_PRODUITS.map(f => (
                  <button key={f} type="button" onClick={() => toggleFamille(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      familles.includes(f)
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700"
                    }`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── FOURNISSEUR : volume + zone ───────────────────────────────── */}
          {type === "fournisseur" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Volume de livraison estimé</label>
                <select value={volume} onChange={e => setVolume(e.target.value)} className={INPUT_CLS}>
                  <option value="">-- Sélectionner --</option>
                  {VOLUMES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>Zone / Ville de livraison</label>
                <input type="text" value={zoneLivraison} onChange={e => setZoneLiv(e.target.value)}
                  placeholder="ex : Casablanca, Rabat…" className={INPUT_CLS} />
              </div>
            </div>
          )}

          {/* ── Message libre ─────────────────────────────────────────────── */}
          <div>
            <label className={LABEL_CLS}>
              {type === "client" ? "Informations complémentaires" : "Message / Détails supplémentaires"}
              <span className="font-normal text-slate-400 ml-1">(optionnel)</span>
            </label>
            <textarea rows={2} value={message} onChange={e => setMessage(e.target.value)}
              placeholder={type === "client"
                ? "Décrivez vos besoins, votre fréquence de commande…"
                : "Certifications, délais de livraison, conditions de paiement…"}
              className={`${INPUT_CLS} resize-none`} />
          </div>

          {/* Notice */}
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>Votre demande sera examinée sous 24 à 48h ouvrées. Vous serez contacté(e) par téléphone ou email.</span>
          </div>

          <button onClick={handleSubmit}
            className="w-full py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            Envoyer ma demande
          </button>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4 pb-6">
          {company.nom || "FreshLink"} — Accès sécurisé partenaires
        </p>
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
      const prix = (art as any).prixVente ?? art.prixAchat ?? 0
      return {
        articleId: l.articleId,
        articleNom: art.nom,
        quantite: Number(l.quantite),
        prixUnitaire: prix,
        prixVente: prix,
        unite: art.unite ?? "kg",
        total: Number(l.quantite) * prix,
      }
    })

    const cmd: Commande = {
      id: store.genId(),
      date: store.today(),
      clientId: client.id,
      clientNom: client.nom,
      commercialId: user.id,
      commercialNom: user.name ?? "",
      secteur: (client as any).secteur ?? "",
      zone: (client as any).zone ?? "",
      gpsLat: (client as any).gpsLat ?? 0,
      gpsLng: (client as any).gpsLng ?? 0,
      heurelivraison: "",
      emailDestinataire: user.email ?? "",
      lignes: lignesToSave,
      statut: "en_attente",
      notes: [notes, dateLivraison ? `Livraison souhaitée : ${dateLivraison}` : ""].filter(Boolean).join(" | ") || undefined,
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
                        <span className="text-xs text-slate-500">Livraison : {cmd.date ?? "—"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                      <span className="text-sm font-bold text-slate-700">{cmd.lignes.reduce((s, l) => s + l.total, 0).toFixed(2)} DH</span>
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
                  {a.nomAr && <p className="font-arabic text-sm text-slate-500" dir="rtl" lang="ar">{a.nomAr}</p>}
                  <p className="text-xs text-slate-500">{a.unite} — {a.famille}</p>
                  {((a as any).prixVente ?? a.prixAchat) != null && (
                    <p className="text-sm font-black text-blue-700">{((a as any).prixVente ?? a.prixAchat ?? 0).toFixed(2)} DH / {a.unite}</p>
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
                      <p className="text-xs text-slate-500">Livraison prévue : {o.date ?? "—"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                      <span className="text-sm font-bold text-slate-700">{(o.total ?? 0).toFixed(2)} DH</span>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedId === o.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </button>
                  {expandedId === o.id && (
                    <div className="border-t border-slate-100 px-4 py-3">
                      <table className="w-full text-xs">
                        <thead><tr className="text-slate-400 uppercase text-[10px]"><th className="text-left pb-1">Article</th><th className="text-right pb-1">Qté</th><th className="text-right pb-1">PU</th><th className="text-right pb-1">Total</th></tr></thead>
                        <tbody>
                          {[{ articleNom: o.articleNom, quantite: o.quantite, prixUnitaire: o.prixUnitaire }].map((l, i) => (
                            <tr key={i} className="border-t border-slate-100">
                              <td className="py-1.5 text-slate-700 font-medium">{l.articleNom}</td>
                              <td className="py-1.5 text-right text-slate-600">{l.quantite}</td>
                              <td className="py-1.5 text-right text-slate-600">{(l.prixUnitaire ?? 0).toFixed(2)}</td>
                              <td className="py-1.5 text-right font-semibold">{((l.quantite ?? 0) * (l.prixUnitaire ?? 0)).toFixed(2)} DH</td>
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
