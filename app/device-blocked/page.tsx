"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"

// ── Types ──────────────────────────────────────────────────────────────────────
type Step = "form" | "waiting" | "blocked" | "approved"

interface GpsCoords {
  lat: number
  lng: number
  accuracy: number
}

// ── Fingerprint (browser-side) ─────────────────────────────────────────────────
async function generateFingerprint(): Promise<string> {
  const parts = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}`,
    String(screen.colorDepth),
    String(new Date().getTimezoneOffset()),
    String(navigator.hardwareConcurrency ?? 0),
    navigator.platform ?? "",
  ]
  try {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.textBaseline = "top"
      ctx.font = "14px Arial"
      ctx.fillText("VitaFresh🌿", 2, 2)
      parts.push(canvas.toDataURL().slice(-32))
    }
  } catch {}
  const raw = parts.join("|")
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
}

// ── Numéro WhatsApp de Jawad (super admin) ─────────────────────────────────────
const JAWAD_WA = "212647333456"
const STORAGE_KEY = "vf_erp_gate_v1"

// ── Composant principal ────────────────────────────────────────────────────────
function AccessGateContent() {
  const params  = useSearchParams()
  const router  = useRouter()
  const reason  = params.get("reason") ?? "no-token"
  const fromPath = params.get("from") ?? "/"

  const [step,         setStep]         = useState<Step>("form")
  const [nom,          setNom]          = useState("")
  const [phone,        setPhone]        = useState("")
  const [gps,          setGps]          = useState<GpsCoords | null>(null)
  const [gpsStatus,    setGpsStatus]    = useState<"idle" | "requesting" | "ok" | "denied">("idle")
  const [error,        setError]        = useState("")
  const [loading,      setLoading]      = useState(false)
  const [fingerprint,  setFingerprint]  = useState("")
  const [pollSeconds,  setPollSeconds]  = useState(0)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Charger état sauvegardé ───────────────────────────────────────────────
  useEffect(() => {
    generateFingerprint().then(fp => {
      setFingerprint(fp)
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")
        if (saved?.fingerprint === fp && saved?.step === "waiting") {
          setNom(saved.nom ?? "")
          setPhone(saved.phone ?? "")
          setStep("waiting")
          startPolling(fp)
        }
      } catch {}
    })
  }, [])

  // ── Demande GPS ────────────────────────────────────────────────────────────
  function requestGps(): Promise<GpsCoords | null> {
    return new Promise(resolve => {
      setGpsStatus("requesting")
      if (!navigator.geolocation) { setGpsStatus("denied"); resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        pos => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }
          setGps(coords)
          setGpsStatus("ok")
          resolve(coords)
        },
        () => { setGpsStatus("denied"); resolve(null) },
        { timeout: 10_000, maximumAge: 0, enableHighAccuracy: true }
      )
    })
  }

  // ── Soumission formulaire ──────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim() || !phone.trim()) { setError("Nom et téléphone sont obligatoires."); return }
    setError(""); setLoading(true)

    // 1. GPS
    const coords = await requestGps()

    // 2. Enregistrer dans Supabase
    try {
      await fetch("/api/device/request-access", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fingerprint,
          nom:           nom.trim(),
          phone:         phone.trim(),
          gps_lat:       coords?.lat,
          gps_lng:       coords?.lng,
          gps_precision: coords?.accuracy,
          userAgent:     navigator.userAgent,
        }),
      })
    } catch { /* continuer même si Supabase KO */ }

    // 3. WhatsApp vers Jawad
    const mapsUrl = coords
      ? `https://maps.google.com/?q=${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`
      : "GPS non disponible"

    const msg = [
      "🔐 *DEMANDE D'ACCÈS — FreshLink ERP*",
      "━━━━━━━━━━━━━━━━━━━━",
      `👤 *Nom :* ${nom.trim()}`,
      `📱 *Tél :* ${phone.trim()}`,
      `🔑 *Device ID :* ${fingerprint.slice(0, 16)}...`,
      coords
        ? `📍 *GPS :* ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}\n🗺️ *Maps :* ${mapsUrl}\n📐 *Précision :* ${Math.round(coords.accuracy)}m`
        : "📍 *GPS :* non partagé",
      `🕒 *Date :* ${new Date().toLocaleString("fr-FR")}`,
      "━━━━━━━━━━━━━━━━━━━━",
      "✅ *Pour autoriser :*",
      "FreshLink ERP → Admin → Accès Site → Approuver",
    ].join("\n")

    window.open(`https://wa.me/${JAWAD_WA}?text=${encodeURIComponent(msg)}`, "_blank")

    // 4. Sauvegarder l'état
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ fingerprint, nom: nom.trim(), phone: phone.trim(), step: "waiting", sentAt: new Date().toISOString() }))

    setLoading(false)
    setStep("waiting")
    startPolling(fingerprint)
  }

  // ── Polling approbation ────────────────────────────────────────────────────
  function startPolling(fp: string) {
    if (pollingRef.current) clearInterval(pollingRef.current)
    let elapsed = 0
    pollingRef.current = setInterval(async () => {
      elapsed += 30
      setPollSeconds(elapsed)
      try {
        const res  = await fetch("/api/device/check-and-token", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fingerprint: fp }),
        })
        const data = await res.json()
        if (data.approved) {
          if (pollingRef.current) clearInterval(pollingRef.current)
          localStorage.removeItem(STORAGE_KEY)
          setStep("approved")
          setTimeout(() => router.replace(fromPath), 1500)
        } else if (data.statut === "bloque") {
          if (pollingRef.current) clearInterval(pollingRef.current)
          setStep("blocked")
        }
      } catch {}
    }, 30_000)
  }

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current) }, [])

  // ── Renvoyer notification ──────────────────────────────────────────────────
  function resend() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
      const msg = [
        "🔔 *RAPPEL — Demande accès FreshLink ERP*",
        `👤 ${saved.nom ?? "?"}  📱 ${saved.phone ?? "?"}`,
        `🔑 Device : ${fingerprint.slice(0,16)}...`,
        "✅ Pour autoriser : FreshLink ERP → Admin → Accès Appareils → Approuver",
      ].join("\n")
      window.open(`https://wa.me/${JAWAD_WA}?text=${encodeURIComponent(msg)}`, "_blank")
    } catch {}
  }

  // ── Réinitialiser (nouvelle demande) ──────────────────────────────────────
  function reset() {
    localStorage.removeItem(STORAGE_KEY)
    if (pollingRef.current) clearInterval(pollingRef.current)
    setStep("form")
    setNom("")
    setPhone("")
    setGps(null)
    setGpsStatus("idle")
    setError("")
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-5"
      style={{ background: "linear-gradient(135deg,#060d0a 0%,#0d2218 50%,#060d0a 100%)" }}
    >
      {/* Logo */}
      <div className="mb-7 flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/vita-fresh-logo.svg"
          alt="Vita Fresh"
          className="h-14 w-auto object-contain"
          onError={e => {
            const el = e.currentTarget as HTMLImageElement
            el.style.display = "none"
            const fb = el.nextElementSibling as HTMLElement | null
            if (fb) fb.style.display = "flex"
          }}
        />
        <div
          style={{ display: "none" }}
          className="w-14 h-14 rounded-2xl items-center justify-center text-2xl font-black"
          data-fallback="logo"
        >
          <span style={{ background: "linear-gradient(135deg,#1a4f2a,#2d7a46)", borderRadius: 12, width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 28px rgba(26,79,42,.5)", fontSize: 28, color: "#b8962e" }}>VF</span>
        </div>
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "#4ade80" }}>
          FreshLink Pro — Accès sécurisé
        </p>
      </div>

      {/* ── Carte ── */}
      <div
        className="w-full max-w-md rounded-3xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", backdropFilter: "blur(24px)" }}
      >

        {/* ══ ÉTAPE 1 : Formulaire ══ */}
        {step === "form" && (
          <form onSubmit={handleSubmit} className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)" }}>
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-black" style={{ color: "#f1f5f9" }}>Accès restreint</h1>
                <p className="text-xs" style={{ color: "#64748b" }}>Cet appareil n&apos;est pas encore autorisé</p>
              </div>
            </div>

            <p className="text-sm mb-6 leading-relaxed" style={{ color: "#94a3b8" }}>
              FreshLink Pro est réservé aux membres de l&apos;équipe autorisés par
              {" "}<strong style={{ color: "#4ade80" }}>Jawad — Super Administrateur</strong>.
              <br />Entrez vos informations et partagez votre position GPS pour soumettre une demande d&apos;accès.
            </p>

            {/* Champs */}
            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#64748b" }}>
                  👤 Nom complet
                </label>
                <input
                  type="text"
                  value={nom}
                  onChange={e => setNom(e.target.value)}
                  placeholder="Prénom et Nom"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.1)", color: "#f1f5f9" }}
                  onFocus={e => { e.currentTarget.style.borderColor = "#4ade80" }}
                  onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "#64748b" }}>
                  📱 Téléphone WhatsApp
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="06 XX XX XX XX"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.1)", color: "#f1f5f9" }}
                  onFocus={e => { e.currentTarget.style.borderColor = "#4ade80" }}
                  onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)" }}
                />
              </div>
            </div>

            {/* GPS status */}
            {gpsStatus === "ok" && gps && (
              <div className="mb-4 px-4 py-3 rounded-xl text-xs" style={{ background: "rgba(26,79,42,0.3)", border: "1px solid rgba(74,222,128,0.2)", color: "#4ade80" }}>
                📍 Position GPS capturée ✅ — Précision : {Math.round(gps.accuracy)}m
              </div>
            )}
            {gpsStatus === "denied" && (
              <div className="mb-4 px-4 py-3 rounded-xl text-xs" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b" }}>
                ⚠️ GPS refusé — La demande sera quand même envoyée à Jawad sans position.
              </div>
            )}
            {gpsStatus === "requesting" && (
              <div className="mb-4 px-4 py-3 rounded-xl text-xs" style={{ background: "rgba(255,255,255,0.04)", color: "#94a3b8" }}>
                📍 Acquisition GPS en cours...
              </div>
            )}

            {/* Erreur */}
            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl text-xs" style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", color: "#fca5a5" }}>
                {error}
              </div>
            )}

            {/* Bouton */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
              style={{ background: loading ? "rgba(26,79,42,0.4)" : "linear-gradient(135deg,#1a4f2a,#2d7a46)", color: loading ? "#4ade8080" : "#fff", cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Envoi en cours...
                </>
              ) : (
                <>📍 Demander l&apos;accès + Envoyer ma position</>
              )}
            </button>

            <p className="mt-4 text-center text-[11px]" style={{ color: "#374151" }}>
              🔒 La demande est transmise à Jawad via WhatsApp avec votre position GPS.
            </p>
          </form>
        )}

        {/* ══ ÉTAPE 2 : En attente ══ */}
        {step === "waiting" && (
          <div className="p-8 text-center">
            {/* Icône pulsante */}
            <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center text-2xl"
              style={{ background: "linear-gradient(135deg,#1a4f2a,#2d7a46)", boxShadow: "0 0 0 0 rgba(26,79,42,.4)", animation: "pulseRing 2s infinite" }}>
              ⏳
            </div>
            <h2 className="text-lg font-black mb-2" style={{ color: "#f1f5f9" }}>Demande envoyée !</h2>
            <p className="text-sm leading-relaxed mb-5" style={{ color: "#94a3b8" }}>
              Votre demande a été transmise à <strong style={{ color: "#4ade80" }}>Jawad</strong> via WhatsApp.
              <br />📍 Votre position GPS a été partagée.
              <br /><br />
              Le site vérifie l&apos;autorisation automatiquement.<br />
              Temps d&apos;attente habituel : <strong style={{ color: "#f1f5f9" }}>quelques minutes</strong>.
            </p>

            {/* Timer */}
            {pollSeconds > 0 && (
              <div className="mb-5 text-xs" style={{ color: "#475569" }}>
                🔄 Dernière vérification il y a {pollSeconds < 60 ? `${pollSeconds}s` : `${Math.floor(pollSeconds/60)}min`}
              </div>
            )}

            {/* Fingerprint tronqué */}
            <div className="px-4 py-2 rounded-xl mb-5 text-[11px] font-mono"
              style={{ background: "rgba(0,0,0,0.3)", color: "#374151", border: "1px solid rgba(255,255,255,0.05)" }}>
              Device : {fingerprint ? fingerprint.slice(0,20) + "..." : "—"}
            </div>

            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={resend}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "rgba(26,79,42,0.2)", border: "1px solid rgba(74,222,128,0.2)", color: "#4ade80" }}>
                🔔 Renvoyer à Jawad
              </button>
              <button
                onClick={reset}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b" }}>
                ↩️ Nouvelle demande
              </button>
            </div>

            <p className="mt-5 text-[11px]" style={{ color: "#1e293b" }}>
              Rechargez la page si vous avez déjà été autorisé (F5).
            </p>
          </div>
        )}

        {/* ══ ÉTAPE 3 : Bloqué ══ */}
        {step === "blocked" && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 text-3xl"
              style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)" }}>
              🚫
            </div>
            <h2 className="text-lg font-black mb-2" style={{ color: "#f1f5f9" }}>Accès refusé</h2>
            <p className="text-sm mb-5" style={{ color: "#94a3b8" }}>
              Votre demande a été refusée par l&apos;administrateur.<br />
              Contactez Jawad pour plus d&apos;informations.
            </p>
            <a
              href={`https://wa.me/${JAWAD_WA}?text=${encodeURIComponent("Bonjour, mon accès à FreshLink Pro a été refusé. Pouvez-vous m'aider ?")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-3 rounded-xl text-sm font-bold"
              style={{ background: "#25d366", color: "#fff" }}>
              💬 Contacter Jawad
            </a>
          </div>
        )}

        {/* ══ ÉTAPE 4 : Approuvé ══ */}
        {step === "approved" && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl"
              style={{ background: "linear-gradient(135deg,#1a4f2a,#2d7a46)", boxShadow: "0 0 32px rgba(26,79,42,.6)" }}>
              ✅
            </div>
            <h2 className="text-lg font-black mb-2" style={{ color: "#4ade80" }}>Accès autorisé !</h2>
            <p className="text-sm" style={{ color: "#94a3b8" }}>
              Bienvenue sur FreshLink Pro.<br />
              Redirection en cours...
            </p>
            <div className="mt-5">
              <svg className="w-6 h-6 animate-spin mx-auto" fill="none" viewBox="0 0 24 24" style={{ color: "#4ade80" }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="mt-6 text-[10px] font-semibold tracking-wider" style={{ color: "#1e293b" }}>
        ⚡ FreshLink Pro · Vita Fresh · Powered by <span style={{ color: "#1a4f2a" }}>Vita tech</span>
      </p>

      {/* Animation CSS inline */}
      <style>{`
        @keyframes pulseRing {
          0%   { box-shadow: 0 0 0 0   rgba(26,79,42,.4); }
          70%  { box-shadow: 0 0 0 20px rgba(26,79,42,0); }
          100% { box-shadow: 0 0 0 0   rgba(26,79,42,0); }
        }
      `}</style>
    </div>
  )
}

export default function DeviceBlockedPage() {
  return (
    <Suspense>
      <AccessGateContent />
    </Suspense>
  )
}
