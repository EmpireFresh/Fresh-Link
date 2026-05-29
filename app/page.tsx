"use client"

import { useState, useEffect } from "react"
import { store, type User, getUserInterface } from "@/lib/store"
import dynamic from "next/dynamic"

// All heavy components loaded dynamically — never crash the initial bundle
const LoginPage           = dynamic(() => import("@/components/auth/LoginPage"),                  { ssr: false, loading: () => <Spinner /> })
const MobileLayout        = dynamic(() => import("@/components/mobile/MobileLayout"),             { ssr: false, loading: () => <Spinner /> })
const BackOfficeLayout    = dynamic(() => import("@/components/backoffice/BackOfficeLayout"),     { ssr: false, loading: () => <Spinner /> })
const PortailClient       = dynamic(() => import("@/components/portail/PortailClient"),           { ssr: false, loading: () => <Spinner /> })
const PortailFournisseur  = dynamic(() => import("@/components/portail/PortailFournisseur"),      { ssr: false, loading: () => <Spinner /> })
const SecurityGuard       = dynamic(() => import("@/components/SecurityGuard"),                    { ssr: false })

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm font-sans">Chargement FreshLink Pro...</p>
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView]       = useState<"mobile" | "backoffice">("backoffice")
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    try {
      const session = store.getSession()
      setUser(session)
      if (session) {
        const iface = getUserInterface(session)
        setView(iface === "mobile" ? "mobile" : "backoffice")
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleLogin = (loggedUser: User, forceView?: "mobile" | "backoffice") => {
    try {
      store.setSession(loggedUser)
      setUser(loggedUser)
      if (forceView) {
        setView(forceView)
      } else {
        const iface = getUserInterface(loggedUser)
        setView(iface === "mobile" ? "mobile" : "backoffice")
      }
      // Charger les données fraîches depuis Supabase en arrière-plan
      import("@/lib/supabase/db").then(({ syncFromSupabase }) => {
        syncFromSupabase().then(({ ok, tables }) => {
          console.log(`[FreshLink] Sync login — ${tables.length} tables chargées depuis Supabase`)
          if (ok) window.dispatchEvent(new CustomEvent("fl_store_updated", { detail: { table: "all" } }))
        }).catch(() => {/* offline OK */})
      })

      // ── Auto-push utilisateurs + articles → Supabase si admin ─────────────────
      // Garantit que fl_users et fl_articles sont toujours à jour sans action manuelle
      if (["super_super_admin", "super_admin", "admin"].includes(loggedUser.role)) {
        try {
          const allUsers = store.getUsers()
          if (allUsers.length > 3) {
            const upserts = allUsers.map(u => { const { id, ...payload } = u; return { id, payload, updated_at: new Date().toISOString() } })
            fetch("/api/sync-write", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ table: "fl_users", upserts }),
            }).then(() => console.log("[FreshLink] ✅ Auto-sync fl_users → Supabase"))
              .catch(() => {})
          }
          const allArticles = store.getArticles()
          if (allArticles.length > 0) {
            const upserts = allArticles.map(a => { const { id, ...payload } = a; return { id, payload, updated_at: new Date().toISOString() } })
            fetch("/api/sync-write", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ table: "fl_articles", upserts }),
            }).then(() => console.log("[FreshLink] ✅ Auto-sync fl_articles → Supabase"))
              .catch(() => {})
          }
        } catch { /* offline OK */ }
      }
    } catch (e: unknown) {
      console.error("Login error:", e)
    }
  }

  const handleLogout = () => {
    try { store.logout() } catch (_) {}
    setUser(null)
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl p-8 space-y-4 shadow-lg">
          <p className="text-lg font-bold text-slate-800">Erreur de demarrage</p>
          <p className="text-sm font-mono text-red-600 bg-red-50 rounded-xl p-3 break-all">{error}</p>
          <button
            onClick={() => { try { localStorage.clear() } catch(_){} window.location.reload() }}
            className="w-full py-3 rounded-xl font-bold text-white text-sm bg-green-600 hover:bg-green-700 transition-colors">
            Reinitialiser et recharger
          </button>
        </div>
      </div>
    )
  }

  if (loading) return <Spinner />

  // ── Not logged in: show the unified LoginPage
  // It has a tab switcher: "Personnel / Equipe" (internal) | "Externe / خارجي" (clients/suppliers)
  if (!user) {
    return <LoginPage onLogin={handleLogin} />
  }

  // ── Portail Fournisseur ───────────────────────────────────────────────────
  if (user.role === "fournisseur") {
    return <PortailFournisseur user={user} onLogout={handleLogout} />
  }

  // ── Portail Client CHR / Marchand ─────────────────────────────────────────
  // Les particuliers restent sur vitafresh.vercel.app
  if (user.role === "client") {
    const sousType = (user as any).sousType ?? (user as any).categorie ?? ""
    if (["chr", "marchand", "professionnel"].includes(String(sousType).toLowerCase())) {
      return <PortailClient user={user} onLogout={handleLogout} />
    }
    // Particulier connecté sur l'ERP → message de redirection vers le site web
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-8 flex flex-col items-center gap-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center text-3xl">🌐</div>
          <div>
            <p className="text-base font-bold text-slate-800">Bonjour {user.name} !</p>
            <p className="text-sm text-slate-500 mt-2">
              Votre espace commande est sur notre site web.
            </p>
          </div>
          <a href="https://vitafresh.vercel.app"
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white text-center"
            style={{ background: "linear-gradient(135deg,#1a4f2a,#2d7a46)" }}>
            Ouvrir vitafresh.vercel.app →
          </a>
          <button onClick={handleLogout}
            className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            Se déconnecter
          </button>
        </div>
      </div>
    )
  }

  const iface = getUserInterface(user)

  const bothSwitcher = iface === "both" ? (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setView(v => v === "backoffice" ? "mobile" : "backoffice")}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-white text-xs font-bold bg-indigo-600 hover:bg-indigo-700 transition-colors">
        {view === "backoffice" ? "Vue Mobile" : "Vue Back-office"}
      </button>
    </div>
  ) : null

  if (iface === "mobile" || (iface === "both" && view === "mobile")) {
    const isSuperAdmin  = user.role === "super_admin"
    const isDemoAccount = user.name.toLowerCase().startsWith("demo")
    const needsGuard    = !isSuperAdmin && !isDemoAccount && user.requireCameraAuth === true
    const content = <MobileLayout user={user} onLogout={handleLogout} />
    return (
      <>
        {needsGuard ? <SecurityGuard skipGps={false}>{content}</SecurityGuard> : content}
        {bothSwitcher}
      </>
    )
  }

  return (
    <>
      <BackOfficeLayout user={user} onLogout={handleLogout} />
      {bothSwitcher}
    </>
  )
}
