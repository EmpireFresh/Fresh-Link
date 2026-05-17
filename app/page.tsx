"use client"

import { useState, useEffect } from "react"
import { store, type User, getUserInterface } from "@/lib/store"
import dynamic from "next/dynamic"

// All heavy components loaded dynamically — never crash the initial bundle
const LoginPage        = dynamic(() => import("@/components/auth/LoginPage"),             { ssr: false, loading: () => <Spinner /> })
const MobileLayout     = dynamic(() => import("@/components/mobile/MobileLayout"),        { ssr: false, loading: () => <Spinner /> })
const BackOfficeLayout = dynamic(() => import("@/components/backoffice/BackOfficeLayout"),{ ssr: false, loading: () => <Spinner /> })
// Portail externe désactivé — accès uniquement via site Netlify
const SecurityGuard    = dynamic(() => import("@/components/SecurityGuard"),               { ssr: false })

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

  // Clients et fournisseurs : accès portail uniquement via le site web externe
  if (user.role === "fournisseur" || user.role === "client") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-8 flex flex-col items-center gap-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
            </svg>
          </div>
          <div>
            <p className="text-base font-bold text-slate-800">Espace client / fournisseur</p>
            <p className="text-sm text-slate-500 mt-2">
              Votre espace de commande est accessible depuis notre site web.
              Veuillez contacter votre commercial pour obtenir le lien d&apos;accès.
            </p>
          </div>
          <button
            onClick={handleLogout}
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
