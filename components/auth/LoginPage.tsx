"use client"

import { useState, useEffect, useCallback } from "react"
import { store, type User, type UserRole, ROLE_LABELS, getUserInterface } from "@/lib/store"
import FreshLinkLogo from "@/components/ui/FreshLinkLogo"
import { sendEmail } from "@/lib/email"

// ── WebAuthn helpers ───────────────────────────────────────────────────────────

const LS_WEBAUTHN = "fl_webauthn_credentials"

interface StoredCredential {
  userId:       string
  userName:     string
  credentialId: string
  publicKey:    string // base64 stored client-side (demo — real prod uses server)
}

function b64url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

function getStoredCreds(): StoredCredential[] {
  try { return JSON.parse(localStorage.getItem(LS_WEBAUTHN) ?? "[]") } catch { return [] }
}
function saveStoredCreds(c: StoredCredential[]) {
  localStorage.setItem(LS_WEBAUTHN, JSON.stringify(c))
}

async function registerBiometric(user: User): Promise<boolean> {
  if (!window.PublicKeyCredential) return false
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "FreshLink Pro", id: window.location.hostname },
        user: {
          id: new TextEncoder().encode(user.id),
          name: user.email,
          displayName: user.name,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
      },
    }) as PublicKeyCredential | null
    if (!cred) return false
    const existing = getStoredCreds().filter(c => c.userId !== user.id)
    saveStoredCreds([...existing, {
      userId:       user.id,
      userName:     user.name,
      credentialId: b64url((cred.rawId as ArrayBuffer)),
      publicKey:    "registered",
    }])
    return true
  } catch { return false }
}

async function authenticateBiometric(): Promise<StoredCredential | null> {
  if (!window.PublicKeyCredential) return null
  const stored = getStoredCreds()
  if (!stored.length) return null
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    await navigator.credentials.get({
      publicKey: {
        challenge,
        userVerification: "required",
        timeout: 60000,
        allowCredentials: stored.map(c => ({
          type: "public-key" as const,
          id: Uint8Array.from(atob(c.credentialId.replace(/-/g, "+").replace(/_/g, "/")), x => x.charCodeAt(0)),
        })),
      },
    })
    // If we reach here the authenticator accepted — return first matching user
    return stored[0]
  } catch { return null }
}

interface Props { onLogin: (user: User, forceView?: "mobile" | "backoffice") => void }

const DEMO_ACCOUNTS: {
  label: string; identifier: string; password: string; role: UserRole; note?: string; group: string
}[] = [
  { group: "Direction",   label: "Resp. Commercial",     identifier: "responsable@freshlink.ma",  password: "1234",     role: "resp_commercial", note: "Commercial + comptes externes" },
  { group: "Finance",     label: "Cash Man",              identifier: "cashman@freshlink.ma",      password: "cash2024", role: "cash_man",        note: "Caisse + encaissements" },
  { group: "Finance",     label: "Financier",             identifier: "financier@freshlink.ma",    password: "fin2024",  role: "financier",       note: "Finance + recap complet" },
  { group: "Commercial",  label: "Pre-vendeur",           identifier: "prevendeur@freshlink.ma",   password: "1234",     role: "prevendeur",      note: "Prise commandes terrain" },
  { group: "Logistique",  label: "Resp. Logistique",     identifier: "logistique@freshlink.ma",   password: "1234",     role: "resp_logistique", note: "Stock + reception + dispatch" },
  { group: "Logistique",  label: "Dispatcheur",           identifier: "dispatch@freshlink.ma",     password: "1234",     role: "dispatcheur",     note: "Affectation livreurs" },
  { group: "Logistique",  label: "Magasinier",            identifier: "magasin@freshlink.ma",      password: "1234",     role: "magasinier",      note: "Gestion stock entrepot" },
  { group: "Logistique",  label: "Acheteur",              identifier: "acheteur@freshlink.ma",     password: "1234",     role: "acheteur",        note: "Bons achat + SKU" },
  { group: "Logistique",  label: "Ctrl Achat",            identifier: "ctrl.achat@freshlink.ma",   password: "ctrl1234", role: "ctrl_achat",      note: "Controle chargement" },
  { group: "Logistique",  label: "Ctrl Prep",             identifier: "ctrl.prep@freshlink.ma",    password: "ctrl1234", role: "ctrl_prep",       note: "Controle preparation" },
  { group: "Logistique",  label: "Livreur",               identifier: "livreur@freshlink.ma",      password: "1234",     role: "livreur",         note: "Livraison + BL + retours" },
]

const DEMO_GROUPS = ["Direction", "Finance", "Commercial", "Logistique"] as const
type DemoGroup = typeof DEMO_GROUPS[number]

function generatePassword(len = 10): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#"
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

const FEATURES = [
  { icon: "M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.694-1.338 2.694H4.136c-1.368 0-2.337-1.694-1.338-2.694L4 15.3", label: "11 Agents IA experts metier 24/7" },
  { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2", label: "Commandes & BL temps reel" },
  { icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", label: "Trips & tournees automatiques" },
  { icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2", label: "Finance, credit & caisse" },
  { icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", label: "Dashboard & KPIs avances" },
]

const N_LEVELS = [
  {
    level: "Achat & Sourcing",
    names: "JARIRI — Vendeur Terrain · ASHEL — Acheteur Expert",
    sub: "Prospection terrain, négociation prix, sourcing qualité",
    color: "#10b981", bg: "#f0fdf4", border: "#bbf7d0"
  },
  {
    level: "Supply Chain & Commercial",
    names: "JAWAD — Supply Chain · ZIZI — Commercial · AYOUB — Logistique",
    sub: "Optimisation tournées, prospection clients, dispatch terrain",
    color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe"
  },
  {
    level: "Finance & Qualité",
    names: "AZMI — Finance · THOMAS — Contrôle Gestion · ABDELALI — Qualité",
    sub: "P&L temps réel, marges, contrôle qualité produits",
    color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe"
  },
  {
    level: "RH & Qualité Système",
    names: "OURAI — DRH · S.ABDELILAH — Qualicien",
    sub: "Paie automatique, HACCP, processus qualité",
    color: "#f59e0b", bg: "#fffbeb", border: "#fde68a"
  },
]

export default function LoginPage({ onLogin }: Props) {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [clientMode, setClientMode] = useState(false)
  const [pendingUser, setPendingUser] = useState<User | null>(null)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState("")
  const [forgotStatus, setForgotStatus] = useState<"idle" | "sending" | "sent" | "notfound">("idle")
  const [showDemo, setShowDemo] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<DemoGroup>("Direction")

  // ── Entrance animations ──────────────────────────────────────────────────────
  const [companyBrand, setCompanyBrand] = useState(() => store.getCompanyConfig())
  const [panelIn, setPanelIn] = useState(false)
  const [typedText, setTypedText] = useState("")
  const TYPED_TARGET = "de bout en bout"

  useEffect(() => {
    const t = setTimeout(() => setPanelIn(true), 80)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!panelIn) return
    let i = 0
    setTypedText("")
    const tick = setInterval(() => {
      i++
      setTypedText(TYPED_TARGET.slice(0, i))
      if (i >= TYPED_TARGET.length) clearInterval(tick)
    }, 55)
    return () => clearInterval(tick)
  }, [panelIn])

  // ── Biometric / WebAuthn ────────────────────────────────────────────────────
  const [biometricSupported, setBiometricSupported]   = useState(false)
  const [biometricRegistered, setBiometricRegistered] = useState(false)
  const [biometricLoading, setBiometricLoading]       = useState(false)
  const [biometricError, setBiometricError]           = useState("")
  const [showBiometricTip, setShowBiometricTip]       = useState(false)
  const [loggedInUser, setLoggedInUser]               = useState<User | null>(null)

  useEffect(() => {
    const check = async () => {
      if (!window.PublicKeyCredential) return
      const avail = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false)
      setBiometricSupported(avail)
      setBiometricRegistered(getStoredCreds().length > 0)
    }
    check()
  }, [])

  // ── Auto-trigger biometric when credentials already registered ───────────────
  const autoTriggeredRef = { current: false }
  useEffect(() => {
    if (!biometricSupported || !biometricRegistered || autoTriggeredRef.current) return
    autoTriggeredRef.current = true
    const timer = setTimeout(async () => {
      setBiometricLoading(true)
      setBiometricError("")
      setError("")
      const cred = await authenticateBiometric()
      setBiometricLoading(false)
      if (!cred) return // user dismissed — let them use password
      const u = store.getUsers().find(usr => usr.id === cred.userId)
      if (!u) { setBiometricError("Utilisateur introuvable. Connectez-vous manuellement."); return }
      const iface = getUserInterface(u)
      if (iface === "both") {
        const fv = store.loginGetForcedView(u.email, u.password ?? "")
        if (fv) { onLogin(u, fv) } else { setPendingUser(u) }
      } else { onLogin(u) }
    }, 800)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricSupported, biometricRegistered])

  // Called right after a successful password login to offer biometric enrollment
  const offerBiometricAfterLogin = useCallback(async (user: User) => {
    setLoggedInUser(user)
    if (!biometricSupported) return
    if (getStoredCreds().some(c => c.userId === user.id)) return
    setShowBiometricTip(true)
  }, [biometricSupported])

  const handleRegisterBiometric = async () => {
    if (!loggedInUser) return
    setBiometricLoading(true); setBiometricError("")
    const ok = await registerBiometric(loggedInUser)
    setBiometricLoading(false)
    if (ok) {
      setBiometricRegistered(true)
      setShowBiometricTip(false)
      // Determine correct view for this user
      const iface = getUserInterface(loggedInUser)
      if (iface === "both") {
        const fv = store.loginGetForcedView(loggedInUser.email, loggedInUser.password ?? "")
        if (fv) { onLogin(loggedInUser, fv) } else { setPendingUser(loggedInUser) }
      } else { onLogin(loggedInUser) }
    } else {
      setBiometricError("Enregistrement annule ou echoue. Connexion classique utilisee.")
      const iface = getUserInterface(loggedInUser)
      setTimeout(() => {
        setShowBiometricTip(false)
        if (iface === "both") {
          const fv = store.loginGetForcedView(loggedInUser!.email, loggedInUser!.password ?? "")
          if (fv) { onLogin(loggedInUser!, fv) } else { setPendingUser(loggedInUser) }
        } else { onLogin(loggedInUser!) }
      }, 1500)
    }
  }

  const handleBiometricLogin = async () => {
    setBiometricLoading(true); setBiometricError(""); setError("")
    const cred = await authenticateBiometric()
    setBiometricLoading(false)
    if (!cred) {
      setBiometricError("Authentification biometrique echouee ou annulee.")
      return
    }
    const user = store.getUsers().find(u => u.id === cred.userId)
    if (!user) { setBiometricError("Utilisateur introuvable. Reconnectez-vous manuellement."); return }
    const iface = getUserInterface(user)
    if (iface === "both") {
      const forcedView = store.loginGetForcedView(user.email, user.password ?? "")
      if (forcedView) { onLogin(user, forcedView) } else { setPendingUser(user) }
    } else { onLogin(user) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError("")
    await new Promise(r => setTimeout(r, 300))
    if (clientMode) {
      if (!identifier.trim()) { setError("Veuillez entrer votre nom"); setLoading(false); return }
      const clientUser = store.loginClient(identifier.trim())
      if (clientUser) { onLogin(clientUser) }
      else { setError("Nom non trouve. Contactez votre commercial."); setLoading(false) }
      return
    }
    if (!identifier.trim() || !password.trim()) { setError("Remplissez tous les champs"); setLoading(false); return }
    const user = store.login(identifier.trim(), password)
    if (user) {
      const iface = getUserInterface(user)
      if (iface === "both") {
        const forcedView = store.loginGetForcedView(identifier.trim(), password)
        if (forcedView) {
          // offer biometric after forced-view login
          setLoggedInUser(user)
          if (biometricSupported && !getStoredCreds().some(c => c.userId === user.id)) {
            setShowBiometricTip(true); setLoading(false)
          } else { onLogin(user, forcedView) }
        } else { setPendingUser(user); setLoading(false) }
      } else {
        // offer biometric enrollment for non-dual-interface users
        setLoggedInUser(user)
        if (biometricSupported && !getStoredCreds().some(c => c.userId === user.id)) {
          setShowBiometricTip(true); setLoading(false)
        } else { onLogin(user) }
      }
    } else { setError("Identifiant ou mot de passe incorrect"); setLoading(false) }
  }

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim() || !forgotEmail.includes("@")) { setForgotStatus("notfound"); return }
    setForgotStatus("sending")
    const users = store.getUsers()
    const found = users.find(u => u.email.toLowerCase() === forgotEmail.toLowerCase().trim())
    if (!found) { setForgotStatus("notfound"); return }
    const newPwd = generatePassword()
    const idx = users.findIndex(u => u.id === found.id)
    if (idx >= 0) { users[idx] = { ...users[idx], password: newPwd }; store.saveUsers(users) }
    await sendEmail({ to_email: found.email, subject: "FreshLink Pro — Nouveau mot de passe", body: `Bonjour ${found.name},\n\nVotre nouveau mot de passe FreshLink Pro :\n  Email : ${found.email}\n  Mot de passe : ${newPwd}\n\nMerci de le changer lors de votre prochaine connexion.` })
    setForgotStatus("sent")
  }

  // ── Interface picker ─────────────────────────────────────────────────────────
  if (pendingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-lg p-8 flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3">
            <FreshLinkLogo size={44} />
            <div className="text-center">
              <p className="text-base font-bold text-slate-800">Bonjour, {pendingUser.name}</p>
              <p className="text-sm text-slate-500 mt-0.5">Choisissez votre interface</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <button onClick={() => onLogin(pendingUser, "backoffice")}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Back Office — Bureau
            </button>
            <button onClick={() => onLogin(pendingUser, "mobile")}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Application Mobile — Terrain
            </button>
            <button onClick={() => setPendingUser(null)}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors text-center py-1">
              Retour
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: "#f1f5f3" }}>

      {/* ── Mobile top bar — visible on sm only ────────────────────────────────── */}
      <div className="md:hidden flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white shadow-sm shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 shadow-sm shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={companyBrand.logo || "/empire-fresh-logo.png"} alt={companyBrand.appName || "FreshLink Pro"} className="w-full h-full object-contain p-0.5" />
          </div>
          <div>
            <p className="text-sm font-black leading-tight" style={{ color: "#1a4f2a" }}>
              {companyBrand.appName || "FreshLink Pro"}
            </p>
            <p className="text-[10px] font-bold" style={{ color: "#b8962e" }}>{companyBrand.appSlogan || companyBrand.nom || "Empire Fresh"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border"
          style={{ background: "rgba(26,79,42,0.06)", borderColor: "rgba(26,79,42,0.2)", color: "#1a4f2a" }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4ADE80" }} />
          Maroc
        </div>
      </div>

      {/* ── Main content row ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

      {/* ── Left brand panel — md+ ─────────────────────────────────────────────── */}
      <div className="flex flex-col justify-between w-[200px] sm:w-[240px] md:w-[260px] lg:w-[310px] shrink-0 px-5 py-7 lg:px-8 lg:py-9 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0a1f14 0%, #0d2a1a 60%, #112d1c 100%)", borderRight: "1px solid rgba(74,222,128,0.08)" }}>

        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #4ADE80 1px, transparent 0)", backgroundSize: "20px 20px" }} />
        {/* Glow accents */}
        <div className="absolute -top-20 -right-10 w-48 h-48 rounded-full opacity-[0.15]"
          style={{ background: "radial-gradient(circle, #4ADE80 0%, transparent 70%)" }} />
        <div className="absolute -bottom-16 -left-8 w-40 h-40 rounded-full opacity-[0.08]"
          style={{ background: "radial-gradient(circle, #22c55e 0%, transparent 70%)" }} />

        <div className="relative flex flex-col gap-6">
          {/* Logo — scale + fade in */}
          <div style={{
            opacity: panelIn ? 1 : 0,
            transform: panelIn ? "scale(1) translateY(0)" : "scale(0.8) translateY(-8px)",
            transition: "opacity 0.5s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            <FreshLinkLogo size={38} variant="full-white" />
          </div>

          {/* Headline — slide up */}
          <div style={{
            opacity: panelIn ? 1 : 0,
            transform: panelIn ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.5s ease 0.15s, transform 0.5s ease 0.15s",
          }}>
            <h2 className="text-xl font-black text-white leading-snug mb-2">
              Pilotez vos flux<br/>
              <span style={{ color: "#4ADE80" }}>
                {typedText}
                {typedText.length < TYPED_TARGET.length && (
                  <span className="inline-block w-[2px] h-[1em] ml-0.5 align-middle rounded-sm animate-pulse" style={{ background: "#4ADE80" }} />
                )}
              </span>
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: "#6b9e7e" }}>
              Distribution fruits & légumes — gestion complète en temps réel.
            </p>
          </div>

          {/* Feature list — staggered */}
          <div className="flex flex-col gap-1.5">
            {FEATURES.map((feat, i) => (
              <div key={feat.label} className="flex items-center gap-2.5" style={{
                opacity: panelIn ? 1 : 0,
                transform: panelIn ? "translateX(0)" : "translateX(-12px)",
                transition: `opacity 0.4s ease ${0.3 + i * 0.07}s, transform 0.4s ease ${0.3 + i * 0.07}s`,
              }}>
                <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.2)" }}>
                  <svg className="w-3 h-3" fill="none" stroke="#4ADE80" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feat.icon} />
                  </svg>
                </div>
                <span className="text-xs" style={{ color: "#8ab89e" }}>{feat.label}</span>
              </div>
            ))}
          </div>

          {/* Agents IA — fade up last */}
          <div style={{
            opacity: panelIn ? 1 : 0,
            transform: panelIn ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.5s ease 0.7s, transform 0.5s ease 0.7s",
          }}>
            <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(74,222,128,0.1)" }}>
              <p className="text-[9px] font-black tracking-widest uppercase mb-2.5" style={{ color: "#4ADE80" }}>11 Agents IA Experts — 24h/7j</p>
              <div className="flex flex-col gap-2">
                {N_LEVELS.map(l => (
                  <div key={l.level} className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="flex items-start gap-1.5 mb-0.5">
                      <span className="text-[7px] font-black px-1.5 py-0.5 rounded-md text-white shrink-0 mt-0.5 leading-tight"
                        style={{ background: l.color, maxWidth: "52px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.level}</span>
                      <span className="text-[9px] font-bold leading-tight" style={{ color: "#d1fae5" }}>{l.names}</span>
                    </div>
                    {l.sub && <p className="text-[7.5px] leading-snug ml-0.5" style={{ color: "#5a8a6a" }}>{l.sub}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="relative text-[10px]" style={{ color: "#374f40", opacity: panelIn ? 1 : 0, transition: "opacity 0.5s ease 0.9s" }}>
          &copy; {new Date().getFullYear()} {companyBrand.appName || "FreshLink Pro"}
        </p>
      </div>

      {/* ── Right — login form ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
        <div className="w-full max-w-[390px] flex flex-col gap-3.5">

          {/* Mobile logo */}
          <div className="md:hidden flex items-center mb-1">
            <FreshLinkLogo size={34} />
          </div>

          {/* Heading */}
          <div>
            <h1 className="text-xl font-black text-slate-800">Connexion</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {clientMode ? "Portail client — entrez votre nom" : "Email ou nom d'utilisateur"}
            </p>
          </div>

          {/* Mode switcher */}
          <div className="flex rounded-xl overflow-hidden p-1 bg-white border border-slate-200 shadow-sm">
            <button type="button" onClick={() => { setClientMode(false); setError("") }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${!clientMode ? "bg-green-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              Personnel / Equipe
            </button>
            <button type="button" onClick={() => { setClientMode(true); setError("") }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${clientMode ? "bg-green-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              Externe / خارجي
            </button>
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-2.5" autoComplete="off">
            {/* Identifier */}
            <div className="relative">
              <svg width="14" height="14" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <input
                type="text"
                value={identifier}
                onChange={e => { setIdentifier(e.target.value); setError("") }}
                placeholder={clientMode ? "Nom du client" : "Email ou identifiant"}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all shadow-sm"
                autoComplete="off"
                data-lpignore="true"
              />
            </div>

            {/* Password */}
            {!clientMode && (
              <div>
                <div className="relative">
                  <svg width="14" height="14" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError("") }}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-20 py-2.5 rounded-xl text-sm border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all shadow-sm"
                    autoComplete="off"
                    data-lpignore="true"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button type="button" onClick={() => { setShowForgot(true); setForgotStatus("idle") }}
                      className="text-[10px] text-green-600 hover:text-green-700 font-bold px-1.5 transition-colors">
                      Oublié?
                    </button>
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      className="text-slate-400 hover:text-slate-600 transition-colors p-0.5">
                      {showPwd
                        ? <svg width="14" height="14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        : <svg width="14" height="14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      }
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                <svg width="14" height="14" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)", boxShadow: "0 4px 14px rgba(22,163,74,0.35)" }}>
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Connexion...
                </>
              ) : (
                <>
                  <svg width="16" height="16" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Se connecter
                </>
              )}
            </button>
          </form>

          {/* ── Biometric login button ─── */}
          {biometricSupported && !clientMode && biometricRegistered && (
            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={biometricLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-60 shadow-sm"
            >
              {biometricLoading ? (
                <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                </svg>
              )}
              {biometricLoading ? "Vérification..." : "Empreinte / Visage"}
            </button>
          )}

          {/* Biometric enrollment tip */}
          {showBiometricTip && loggedInUser && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-6 flex flex-col gap-5">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Connexion biométrique</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Activez la connexion par empreinte ou reconnaissance faciale pour la prochaine fois.
                    </p>
                  </div>
                </div>
                {biometricError && (
                  <p className="text-xs text-red-600 font-medium text-center">{biometricError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowBiometricTip(false); onLogin(loggedInUser) }}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                    Ignorer
                  </button>
                  <button
                    onClick={handleRegisterBiometric}
                    disabled={biometricLoading}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                    {biometricLoading && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                    {biometricLoading ? "Enregistrement..." : "Activer"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Biometric error banner */}
          {biometricError && !showBiometricTip && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {biometricError}
            </div>
          )}

          {/* Demo accounts */}
          <div className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
            <button type="button" onClick={() => setShowDemo(v => !v)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
              <span className="flex items-center gap-2">
                <svg width="14" height="14" className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Comptes de démonstration
              </span>
              <svg width="14" height="14" className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showDemo ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDemo && (
              <div className="border-t border-slate-100">
                <div className="flex bg-slate-50">
                  {DEMO_GROUPS.map(g => (
                    <button key={g} type="button" onClick={() => setSelectedGroup(g)}
                      className={`flex-1 py-1.5 text-[10px] font-bold transition-colors border-b-2 ${selectedGroup === g ? "border-green-600 text-green-700 bg-white" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                      {g}
                    </button>
                  ))}
                </div>
                <div className="p-1.5 flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                  {DEMO_ACCOUNTS.filter(a => a.group === selectedGroup).map(acc => (
                    <button key={acc.identifier} type="button"
                      onClick={() => {
                        setIdentifier(acc.identifier); setPassword(acc.password)
                        setClientMode(false); setError(""); setShowDemo(false)
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-green-50 transition-colors text-left">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0"
                        style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
                        {acc.label.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{acc.label}</p>
                        <p className="text-[9px] text-slate-400 truncate">{acc.note}</p>
                      </div>
                      <span className="text-[9px] text-slate-300 font-mono shrink-0 bg-slate-100 px-1.5 py-0.5 rounded">{acc.password}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Forgot password modal */}
          {showForgot && (
            <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-6 flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Réinitialiser le mot de passe</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Un nouveau mot de passe sera envoyé par email.</p>
                </div>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={e => { setForgotEmail(e.target.value); setForgotStatus("idle") }}
                  placeholder="votre@email.com"
                  className="w-full px-4 py-2.5 rounded-xl text-sm border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                />
                {forgotStatus === "notfound" && <p className="text-xs text-red-600 font-medium">Email non trouvé dans le système.</p>}
                {forgotStatus === "sent" && <p className="text-xs text-green-700 font-medium">Nouveau mot de passe envoyé par email.</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setShowForgot(false); setForgotEmail(""); setForgotStatus("idle") }}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                    Annuler
                  </button>
                  <button onClick={handleForgotPassword} disabled={forgotStatus === "sending" || forgotStatus === "sent"}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-60">
                    {forgotStatus === "sending" ? "Envoi..." : "Envoyer"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-center pt-0.5">
            <p className="text-[10px] text-slate-400">
              &copy; {new Date().getFullYear()} <span className="font-black text-slate-500">FRESHLINK PRO</span>
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
