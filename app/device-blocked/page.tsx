"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

const REASONS: Record<string, { title: string; desc: string }> = {
  "no-token":      { title: "Appareil non enregistré",   desc: "Cet appareil n'a pas de jeton d'accès. Contactez votre administrateur." },
  "invalid-token": { title: "Jeton invalide ou expiré",  desc: "Votre jeton d'accès est invalide ou a expiré. Contactez votre administrateur." },
  "not-allowed":   { title: "Accès refusé",              desc: "Cet appareil n'est pas dans la liste des appareils autorisés." },
  "default":       { title: "Accès restreint",           desc: "L'accès à FreshLink Pro est limité aux appareils autorisés." },
}

function BlockedContent() {
  const params = useSearchParams()
  const reason = params.get("reason") ?? "default"
  const info   = REASONS[reason] ?? REASONS["default"]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg,#060d0a 0%,#0d2218 50%,#060d0a 100%)" }}>

      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black"
          style={{ background: "linear-gradient(135deg,#1a4f2a,#2d7a46)", boxShadow: "0 0 32px rgba(26,79,42,0.5)" }}>
          <span style={{ color: "#b8962e" }}>VF</span>
        </div>
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "#4ade80" }}>
          FreshLink Pro
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md rounded-3xl p-8 text-center"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}>

        {/* Icône */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)" }}>
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h1 className="text-xl font-black mb-2" style={{ color: "#f1f5f9" }}>
          {info.title}
        </h1>
        <p className="text-sm mb-6" style={{ color: "#94a3b8" }}>
          {info.desc}
        </p>

        {/* Code raison */}
        <div className="px-4 py-2 rounded-xl mb-6 text-xs font-mono"
          style={{ background: "rgba(0,0,0,0.3)", color: "#475569", border: "1px solid rgba(255,255,255,0.06)" }}>
          Code : {reason} — FreshLink Device Guard v1.0
        </div>

        {/* Contact admin */}
        <div className="rounded-2xl p-4 text-left"
          style={{ background: "rgba(26,79,42,0.2)", border: "1px solid rgba(74,222,128,0.15)" }}>
          <p className="text-xs font-bold mb-2" style={{ color: "#4ade80" }}>
            Que faire ?
          </p>
          <ul className="space-y-1.5 text-xs" style={{ color: "#94a3b8" }}>
            <li>• Contactez votre administrateur système</li>
            <li>• Demandez l&apos;enregistrement de cet appareil</li>
            <li>• Vérifiez que vous utilisez le bon réseau</li>
          </ul>
        </div>
      </div>

      {/* Powered by */}
      <p className="mt-6 text-[10px] font-semibold tracking-wider" style={{ color: "#374151" }}>
        ⚡ Powered by <span style={{ color: "#1a4f2a" }}>Vita tech</span>
      </p>
    </div>
  )
}

export default function DeviceBlockedPage() {
  return (
    <Suspense>
      <BlockedContent />
    </Suspense>
  )
}
