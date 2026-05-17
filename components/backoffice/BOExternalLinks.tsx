"use client"

import { useState } from "react"

const SITES = [
  {
    id: "empire_fresh",
    name: "Empire Fresh",
    nameAr: "إمبير فريش",
    url: "https://empire-fresh.netlify.app/",
    description: "Site vitrine et catalogue en ligne Empire Fresh — présentez vos produits à vos clients",
    descriptionAr: "موقع العرض والكتالوج الإلكتروني لإمبير فريش",
    color: "bg-emerald-600",
    bgCard: "from-emerald-50 to-green-50",
    border: "border-emerald-200",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
    icon: (
      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: "neo_space",
    name: "Neo Space",
    nameAr: "نيو سبيس",
    url: "https://www.neo.space/fr",
    description: "Plateforme Neo Space — gestion intelligente et outils de collaboration",
    descriptionAr: "منصة نيو سبيس — الإدارة الذكية وأدوات التعاون",
    color: "bg-violet-600",
    bgCard: "from-violet-50 to-purple-50",
    border: "border-violet-200",
    badgeColor: "bg-violet-100 text-violet-800 border-violet-300",
    icon: (
      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
]

export default function BOExternalLinks({ user }: { user: { role: string } }) {
  const [activeEmbed, setActiveEmbed] = useState<string | null>(null)
  const [embedLoading, setEmbedLoading] = useState<Record<string, boolean>>({})

  void user

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">
          Liens Partenaires{" "}
          <span className="text-muted-foreground font-normal text-base">/ روابط الشركاء</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Accédez rapidement aux plateformes liées à Empire Fresh
        </p>
      </div>

      {/* Site cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SITES.map(site => (
          <div key={site.id} className={`rounded-2xl border ${site.border} bg-gradient-to-br ${site.bgCard} overflow-hidden`}>
            {/* Card header */}
            <div className="p-5 flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl ${site.color} flex items-center justify-center shrink-0 shadow-md`}>
                {site.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-slate-900 text-base">{site.name}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${site.badgeColor}`}>
                    {site.nameAr}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{site.description}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-mono truncate">{site.url}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 flex gap-2 flex-wrap">
              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 px-4 py-2 rounded-xl ${site.color} text-white text-xs font-bold hover:opacity-90 transition-opacity shadow-sm`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Ouvrir dans un nouvel onglet
              </a>
              <button
                onClick={() => {
                  if (activeEmbed === site.id) { setActiveEmbed(null); return }
                  setEmbedLoading(p => ({ ...p, [site.id]: true }))
                  setActiveEmbed(site.id)
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {activeEmbed === site.id ? "Fermer l'aperçu" : "Aperçu intégré"}
              </button>
            </div>

            {/* Inline iframe embed */}
            {activeEmbed === site.id && (
              <div className="mx-4 mb-4 rounded-xl overflow-hidden border border-slate-200 bg-white shadow-inner" style={{ height: 480 }}>
                {embedLoading[site.id] && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      <p className="text-xs text-slate-500">Chargement de {site.name}...</p>
                    </div>
                  </div>
                )}
                <iframe
                  src={site.url}
                  title={site.name}
                  className="w-full h-full border-0"
                  onLoad={() => setEmbedLoading(p => ({ ...p, [site.id]: false }))}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
        <svg className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          <strong>Note :</strong> Certains sites peuvent bloquer l&apos;affichage intégré (politique X-Frame-Options). Dans ce cas, utilisez le bouton &quot;Ouvrir dans un nouvel onglet&quot; pour accéder au site.
        </span>
      </div>
    </div>
  )
}
