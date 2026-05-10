"use client"

import { useState, useEffect, useRef } from "react"
import { store, type Article, type User } from "@/lib/store"

// ─── helpers ──────────────────────────────────────────────────────────────────

function computePV(a: Article): number {
  switch (a.pvMethode) {
    case "pourcentage": return Math.round(a.prixAchat * (1 + a.pvValeur / 100) * 100) / 100
    case "montant":     return Math.round((a.prixAchat + a.pvValeur) * 100) / 100
    default:            return a.pvValeur
  }
}

function stockLabel(a: Article): { label: string; labelAr: string; cls: string; icon: string } {
  const seuil = a.marketplaceSeuilShortStock ?? 20
  if (!a.actif) return { label: "Désactivé",     labelAr: "معطل",          cls: "bg-slate-100 text-slate-500 border-slate-200",   icon: "🚫" }
  if (a.marketplaceStatut === "hors_saison") return { label: "Hors saison", labelAr: "خارج الموسم", cls: "bg-amber-100 text-amber-700 border-amber-300",   icon: "🍂" }
  if (a.stockDisponible <= 0) return { label: "Rupture stock", labelAr: "نفاد المخزون", cls: "bg-red-100 text-red-700 border-red-300", icon: "❌" }
  if (a.stockDisponible < seuil) return { label: "Stock limité", labelAr: "مخزون محدود", cls: "bg-orange-100 text-orange-700 border-orange-300", icon: "⚠️" }
  return { label: "Disponible", labelAr: "متوفر", cls: "bg-green-100 text-green-700 border-green-300", icon: "✅" }
}

const STATUT_OPTIONS = [
  { v: "disponible",   label: "Disponible",    icon: "✅", cls: "text-green-700 bg-green-50 border-green-300" },
  { v: "hors_saison",  label: "Hors saison",   icon: "🍂", cls: "text-amber-700 bg-amber-50 border-amber-300" },
  { v: "out_of_stock", label: "Rupture stock", icon: "❌", cls: "text-red-700 bg-red-50 border-red-300" },
  { v: "short_stock",  label: "Stock limité",  icon: "⚠️", cls: "text-orange-700 bg-orange-50 border-orange-300" },
  { v: "nouveau",      label: "Nouveau",       icon: "🆕", cls: "text-blue-700 bg-blue-50 border-blue-300" },
  { v: "promo",        label: "Promo",         icon: "🏷️", cls: "text-purple-700 bg-purple-50 border-purple-300" },
] as const

type MarketplaceStatut = typeof STATUT_OPTIONS[number]["v"]

const TAGS_SUGGESTIONS = [
  "Bio", "Local", "Maroc", "Importé", "Premium", "Saison", "Nouveau",
  "Promo", "BIO Certifié", "Sans pesticides", "Frais du matin",
]

type Tab = "catalogue" | "publie" | "stats" | "api_preview"

// ─── EditDrawer ───────────────────────────────────────────────────────────────

interface EditDrawerProps {
  article: Article
  onClose: () => void
  onSave: (updated: Article) => void
}

function EditDrawer({ article, onClose, onSave }: EditDrawerProps) {
  const pvCalcule = computePV(article)
  const [form, setForm] = useState({
    marketplaceActif:           article.marketplaceActif ?? false,
    marketplaceStatut:          (article.marketplaceStatut ?? "disponible") as MarketplaceStatut,
    marketplaceCommentaire:     article.marketplaceCommentaire ?? "",
    marketplacePrixPublic:      String(article.marketplacePrixPublic ?? pvCalcule),
    marketplaceDescription:     article.marketplaceDescription ?? "",
    marketplaceDescriptionAr:   article.marketplaceDescriptionAr ?? "",
    marketplaceSeuilShortStock: String(article.marketplaceSeuilShortStock ?? 20),
    marketplaceTags:            article.marketplaceTags ?? [] as string[],
    marketplaceOrdre:           String(article.marketplaceOrdre ?? 0),
    promoActif:                 article.marketplacePromo?.actif ?? false,
    promoPrix:                  String(article.marketplacePromo?.prixPromo ?? ""),
    promoEtiquette:             article.marketplacePromo?.etiquette ?? "",
    promoDateDebut:             article.marketplacePromo?.dateDebut ?? "",
    promoDateFin:               article.marketplacePromo?.dateFin ?? "",
    // stock / catalogue activation
    actif:           article.actif ?? true,
    catalogueVisible: article.catalogueVisible ?? true,
  })
  const [tagInput, setTagInput] = useState("")

  const toggleTag = (tag: string) => {
    setForm(f => ({
      ...f,
      marketplaceTags: f.marketplaceTags.includes(tag)
        ? f.marketplaceTags.filter(t => t !== tag)
        : [...f.marketplaceTags, tag],
    }))
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !form.marketplaceTags.includes(t)) {
      setForm(f => ({ ...f, marketplaceTags: [...f.marketplaceTags, t] }))
    }
    setTagInput("")
  }

  // auto-update statut based on stock & activation
  const autoStatut = (): MarketplaceStatut => {
    if (!form.actif) return form.marketplaceStatut
    const seuil = Number(form.marketplaceSeuilShortStock) || 20
    if (article.stockDisponible <= 0) return "out_of_stock"
    if (article.stockDisponible < seuil) return "short_stock"
    return form.marketplaceStatut === "out_of_stock" || form.marketplaceStatut === "short_stock"
      ? "disponible"
      : form.marketplaceStatut
  }

  const handleSave = () => {
    const updated: Article = {
      ...article,
      actif:                   form.actif,
      catalogueVisible:        form.catalogueVisible,
      marketplaceActif:        form.marketplaceActif,
      marketplaceStatut:       form.marketplaceStatut,
      marketplaceCommentaire:  form.marketplaceCommentaire,
      marketplacePrixPublic:   Number(form.marketplacePrixPublic) || pvCalcule,
      marketplaceDescription:  form.marketplaceDescription,
      marketplaceDescriptionAr:form.marketplaceDescriptionAr,
      marketplaceSeuilShortStock: Number(form.marketplaceSeuilShortStock) || 20,
      marketplaceTags:         form.marketplaceTags,
      marketplaceOrdre:        Number(form.marketplaceOrdre) || 0,
      marketplacePromo: form.promoActif ? {
        actif:       true,
        prixPromo:   Number(form.promoPrix) || pvCalcule,
        etiquette:   form.promoEtiquette,
        dateDebut:   form.promoDateDebut || undefined,
        dateFin:     form.promoDateFin || undefined,
      } : undefined,
    }
    onSave(updated)
  }

  const prixPublicNum = Number(form.marketplacePrixPublic) || pvCalcule
  const promoNum      = Number(form.promoPrix) || 0
  const promoReducPct = prixPublicNum > 0 && promoNum > 0
    ? Math.round((1 - promoNum / prixPublicNum) * 100)
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl bg-card border-l border-border flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            {article.photo && (
              <img src={article.photo} alt={article.nom} className="w-10 h-10 rounded-xl object-cover border border-border" />
            )}
            <div>
              <p className="font-bold text-foreground">{article.nom}</p>
              <p className="text-xs text-muted-foreground">{article.famille} · {article.unite}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

          {/* ── SECTION 1: Activation ── */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Activation</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "actif",            label: "Actif ERP",     desc: "Stock & opérations internes",   icon: "⚙️" },
                { key: "catalogueVisible", label: "Portail client", desc: "Visible sur portail ext.",     icon: "👥" },
                { key: "marketplaceActif", label: "Marketplace",   desc: "Publié sur votre site web",     icon: "🌐" },
              ].map(({ key, label, desc, icon }) => {
                const val = form[key as keyof typeof form] as boolean
                return (
                  <button key={key} onClick={() => setForm(f => ({ ...f, [key]: !val }))}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 text-center transition-all ${val ? "border-green-400 bg-green-50" : "border-slate-200 bg-card hover:bg-muted"}`}>
                    <span className="text-xl">{icon}</span>
                    <span className={`text-xs font-bold ${val ? "text-green-700" : "text-slate-500"}`}>{label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{desc}</span>
                    <div className={`w-8 h-4 rounded-full transition-colors ${val ? "bg-green-500" : "bg-slate-200"} relative mt-0.5`}>
                      <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${val ? "translate-x-4" : "translate-x-0.5"}`} />
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── SECTION 2: Statut marketplace ── */}
          {form.marketplaceActif && (
            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Statut affiché sur le site</h3>
              <div className="grid grid-cols-3 gap-2">
                {STATUT_OPTIONS.map(opt => (
                  <button key={opt.v} onClick={() => setForm(f => ({ ...f, marketplaceStatut: opt.v }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${form.marketplaceStatut === opt.v ? opt.cls + " border-current font-black" : "border-slate-200 text-slate-500 hover:bg-muted"}`}>
                    <span>{opt.icon}</span>{opt.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Commentaire public (affiché sous l'article)</label>
                <input value={form.marketplaceCommentaire} onChange={e => setForm(f => ({ ...f, marketplaceCommentaire: e.target.value }))}
                  placeholder={form.marketplaceStatut === "hors_saison" ? "Ex: Disponible à partir de mars 2026" : form.marketplaceStatut === "short_stock" ? "Ex: Dernières unités disponibles !" : ""}
                  className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
                <span className="text-base">{STATUT_OPTIONS.find(o => o.v === form.marketplaceStatut)?.icon}</span>
                <span>Seuil stock limité : </span>
                <input type="number" min="0" value={form.marketplaceSeuilShortStock}
                  onChange={e => setForm(f => ({ ...f, marketplaceSeuilShortStock: e.target.value }))}
                  className="w-16 px-2 py-1 rounded-lg border border-border bg-background text-xs text-center font-bold focus:outline-none" />
                <span>{article.unite} → badge "Stock limité"</span>
              </div>
            </section>
          )}

          {/* ── SECTION 3: Pricing ── */}
          {form.marketplaceActif && (
            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Prix public</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-foreground">Prix affiché (DH / {article.unite})</label>
                  <input type="number" min="0" step="0.5" value={form.marketplacePrixPublic}
                    onChange={e => setForm(f => ({ ...f, marketplacePrixPublic: e.target.value }))}
                    className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary" />
                  <p className="text-[10px] text-muted-foreground">PV interne calculé : <span className="font-bold text-foreground">{pvCalcule.toFixed(2)} DH</span></p>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-foreground">Ordre d'affichage</label>
                  <input type="number" min="0" value={form.marketplaceOrdre}
                    onChange={e => setForm(f => ({ ...f, marketplaceOrdre: e.target.value }))}
                    className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <p className="text-[10px] text-muted-foreground">0 = premier affiché</p>
                </div>
              </div>

              {/* Promo */}
              <div className={`rounded-2xl border-2 overflow-hidden transition-all ${form.promoActif ? "border-purple-400" : "border-dashed border-slate-200"}`}>
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏷️</span>
                    <span className="text-sm font-bold text-foreground">Prix promotionnel</span>
                  </div>
                  <button onClick={() => setForm(f => ({ ...f, promoActif: !f.promoActif }))}
                    className={`relative w-10 h-5 rounded-full transition-colors ${form.promoActif ? "bg-purple-500" : "bg-slate-200"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.promoActif ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
                {form.promoActif && (
                  <div className="px-4 pb-4 grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold">Prix promo (DH)</label>
                      <input type="number" min="0" step="0.5" value={form.promoPrix}
                        onChange={e => setForm(f => ({ ...f, promoPrix: e.target.value }))}
                        className="px-3 py-2.5 rounded-xl border border-purple-200 bg-purple-50 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-400" />
                      {promoReducPct > 0 && <p className="text-[10px] text-purple-700 font-bold">-{promoReducPct}% de réduction</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold">Étiquette</label>
                      <input value={form.promoEtiquette} onChange={e => setForm(f => ({ ...f, promoEtiquette: e.target.value }))}
                        placeholder="Ex: -20%, Offre spéciale"
                        className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold">Date début</label>
                      <input type="date" value={form.promoDateDebut} onChange={e => setForm(f => ({ ...f, promoDateDebut: e.target.value }))}
                        className="px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold">Date fin</label>
                      <input type="date" value={form.promoDateFin} onChange={e => setForm(f => ({ ...f, promoDateFin: e.target.value }))}
                        className="px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none" />
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── SECTION 4: Description & Tags ── */}
          {form.marketplaceActif && (
            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Description & SEO</h3>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Description publique (FR)</label>
                <textarea rows={2} value={form.marketplaceDescription}
                  onChange={e => setForm(f => ({ ...f, marketplaceDescription: e.target.value }))}
                  placeholder="Description visible par vos clients et fournisseurs sur le site…"
                  className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">الوصف بالعربية</label>
                <textarea rows={2} dir="rtl" value={form.marketplaceDescriptionAr}
                  onChange={e => setForm(f => ({ ...f, marketplaceDescriptionAr: e.target.value }))}
                  placeholder="وصف المنتج بالعربية…"
                  className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-foreground">Tags / Filtres</label>
                <div className="flex flex-wrap gap-1.5">
                  {TAGS_SUGGESTIONS.map(tag => (
                    <button key={tag} onClick={() => toggleTag(tag)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${form.marketplaceTags.includes(tag) ? "bg-primary text-white border-primary" : "border-slate-200 text-slate-500 hover:bg-muted"}`}>
                      {tag}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addTag()}
                    placeholder="Tag personnalisé…"
                    className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
                  <button onClick={addTag} className="px-3 py-2 rounded-xl bg-muted text-xs font-semibold hover:bg-muted/80">+ Ajouter</button>
                </div>
                {form.marketplaceTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.marketplaceTags.map(t => (
                      <span key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-primary/10 text-primary font-semibold">
                        {t}
                        <button onClick={() => setForm(f => ({ ...f, marketplaceTags: f.marketplaceTags.filter(x => x !== t) }))} className="hover:text-red-600">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Live Preview ── */}
          {form.marketplaceActif && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Aperçu carte site web</h3>
              <div className="rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden">
                <ArticleCard
                  article={{
                    ...article,
                    marketplaceActif: form.marketplaceActif,
                    marketplaceStatut: form.marketplaceStatut,
                    marketplaceCommentaire: form.marketplaceCommentaire,
                    marketplacePrixPublic: Number(form.marketplacePrixPublic) || pvCalcule,
                    marketplaceTags: form.marketplaceTags,
                    marketplacePromo: form.promoActif ? { actif: true, prixPromo: Number(form.promoPrix), etiquette: form.promoEtiquette } : undefined,
                  }}
                  preview
                />
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-3 bg-card">
          <button onClick={handleSave}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Sauvegarder
          </button>
          <button onClick={onClose} className="px-5 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ArticleCard (preview + catalogue grid) ───────────────────────────────────

function ArticleCard({ article, preview = false, onClick }: { article: Article; preview?: boolean; onClick?: () => void }) {
  const pv = computePV(article)
  const prix = article.marketplacePrixPublic ?? pv
  const statut = article.marketplaceStatut ?? "disponible"
  const hasPromo = article.marketplacePromo?.actif && (article.marketplacePromo?.prixPromo ?? 0) > 0
  const statutCfg = STATUT_OPTIONS.find(o => o.v === statut) ?? STATUT_OPTIONS[0]

  const DEFAULT_IMG = "https://placehold.co/400x300/f1f5f9/94a3b8?text=" + encodeURIComponent(article.nom)

  return (
    <div onClick={onClick}
      className={`group bg-white rounded-2xl overflow-hidden border border-slate-200 ${!preview && onClick ? "cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all" : ""} ${!article.marketplaceActif ? "opacity-60 grayscale" : ""}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        <img src={article.photo || DEFAULT_IMG} alt={article.nom}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={e => { e.currentTarget.src = DEFAULT_IMG }} />

        {/* Statut badge */}
        <div className={`absolute top-2 left-2 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border backdrop-blur-sm ${statutCfg.cls}`}>
          {statutCfg.icon} {statutCfg.label}
        </div>

        {/* Promo badge */}
        {hasPromo && (
          <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-purple-600 text-white text-[10px] font-black">
            {article.marketplacePromo?.etiquette || "Promo"}
          </div>
        )}

        {/* Tags */}
        {(article.marketplaceTags?.length ?? 0) > 0 && (
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
            {article.marketplaceTags!.slice(0, 3).map(t => (
              <span key={t} className="px-1.5 py-0.5 rounded-md bg-white/80 text-[9px] font-bold text-slate-700 backdrop-blur-sm">{t}</span>
            ))}
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="font-bold text-slate-800 text-sm truncate">{article.nom}</p>
        {article.nomAr && <p className="text-[11px] text-slate-400 mt-0.5" dir="rtl">{article.nomAr}</p>}
        {article.marketplaceDescription && (
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{article.marketplaceDescription}</p>
        )}
        {article.marketplaceCommentaire && (
          <p className={`text-[11px] mt-1 font-medium italic ${statutCfg.cls.replace("bg-", "text-").split(" ")[0]}`}>
            {statutCfg.icon} {article.marketplaceCommentaire}
          </p>
        )}

        <div className="flex items-end justify-between mt-2 pt-2 border-t border-slate-100">
          <div>
            {hasPromo ? (
              <>
                <span className="text-xs line-through text-slate-400">{prix.toFixed(2)} DH</span>
                <p className="text-sm font-black text-purple-700">{article.marketplacePromo!.prixPromo.toFixed(2)} DH</p>
              </>
            ) : (
              <p className="text-sm font-black text-slate-900">{prix.toFixed(2)} DH</p>
            )}
            <p className="text-[10px] text-slate-400">/ {article.unite}</p>
          </div>
          <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${statut === "disponible" ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
            {article.stockDisponible > 0 ? `${article.stockDisponible} ${article.unite}` : "Indisponible"}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ articles }: { articles: Article[] }) {
  const pub = articles.filter(a => a.marketplaceActif)
  const dispo = pub.filter(a => a.marketplaceStatut === "disponible" || !a.marketplaceStatut)
  const rupture = pub.filter(a => a.marketplaceStatut === "out_of_stock" || a.stockDisponible <= 0)
  const promo = pub.filter(a => a.marketplacePromo?.actif)
  const saison = pub.filter(a => a.marketplaceStatut === "hors_saison")

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: "Publiés",       value: pub.length,     sub: `/ ${articles.length} total`,     icon: "🌐", cls: "bg-blue-50 border-blue-200" },
        { label: "Disponibles",   value: dispo.length,   sub: "en stock & actif",               icon: "✅", cls: "bg-green-50 border-green-200" },
        { label: "Rupture",       value: rupture.length, sub: "hors stock publiés",             icon: "❌", cls: "bg-red-50 border-red-200" },
        { label: "En promo",      value: promo.length,   sub: "avec prix promotionnel",         icon: "🏷️", cls: "bg-purple-50 border-purple-200" },
      ].map(s => (
        <div key={s.label} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${s.cls}`}>
          <span className="text-2xl">{s.icon}</span>
          <div>
            <p className="text-2xl font-black text-foreground leading-none">{s.value}</p>
            <p className="text-[10px] font-bold text-muted-foreground mt-0.5">{s.label}</p>
            <p className="text-[9px] text-muted-foreground">{s.sub}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── API Preview Tab ──────────────────────────────────────────────────────────

function ApiPreview({ articles }: { articles: Article[] }) {
  const pub = articles.filter(a => a.marketplaceActif)
  const payload = pub.map(a => ({
    id: a.id,
    nom: a.nom,
    nomAr: a.nomAr,
    famille: a.famille,
    unite: a.unite,
    photo: a.photo ?? null,
    tags: a.marketplaceTags ?? [],
    description: a.marketplaceDescription ?? null,
    descriptionAr: a.marketplaceDescriptionAr ?? null,
    prix: a.marketplacePrixPublic ?? computePV(a),
    promo: a.marketplacePromo?.actif ? { prix: a.marketplacePromo.prixPromo, etiquette: a.marketplacePromo.etiquette ?? null } : null,
    statut: a.marketplaceStatut ?? "disponible",
    commentaire: a.marketplaceCommentaire ?? null,
    stockDisponible: a.stockDisponible,
    ordre: a.marketplaceOrdre ?? 0,
  }))
  const json = JSON.stringify(payload.slice(0, 3), null, 2) + (pub.length > 3 ? "\n// ... " + (pub.length - 3) + " autres articles" : "")
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        <span><strong>GET</strong> /api/ext/catalogue — Retourne {pub.length} articles publiés</span>
      </div>
      <pre className="px-4 py-4 rounded-2xl bg-[#0d1117] text-green-300 font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed">
        {json}
      </pre>
      <p className="text-xs text-muted-foreground">Les champs <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">statut</code>, <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">commentaire</code> et <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">promo</code> sont mis à jour en temps réel dès modification dans l'ERP.</p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props { user: User }

export default function BOMarketplace({ user }: Props) {
  const [articles, setArticles] = useState<Article[]>([])
  const [tab, setTab] = useState<Tab>("catalogue")
  const [editing, setEditing] = useState<Article | null>(null)
  const [search, setSearch] = useState("")
  const [famille, setFamille] = useState("")
  const [statutFilter, setStatutFilter] = useState<"tous" | MarketplaceStatut | "publie" | "non_publie">("tous")
  const [bulkSaved, setBulkSaved] = useState(false)
  const [publishAll, setPublishAll] = useState(false)

  const refresh = () => setArticles(store.getArticles())
  useEffect(() => { refresh() }, [])

  const familles = Array.from(new Set(articles.map(a => a.famille).filter(Boolean)))

  const filtered = articles.filter(a => {
    const matchSearch = !search || a.nom.toLowerCase().includes(search.toLowerCase())
    const matchFamille = !famille || a.famille === famille
    const matchStatut =
      statutFilter === "tous"         ? true :
      statutFilter === "publie"       ? !!a.marketplaceActif :
      statutFilter === "non_publie"   ? !a.marketplaceActif :
      a.marketplaceStatut === statutFilter
    return matchSearch && matchFamille && matchStatut
  })

  const published = articles.filter(a => a.marketplaceActif)

  const handleSave = (updated: Article) => {
    const all = articles.map(a => a.id === updated.id ? updated : a)
    store.saveArticles(all)
    setArticles(all)
    setEditing(null)
  }

  const handleBulkPublish = () => {
    if (!window.confirm(`Publier ${filtered.length} articles filtrés sur la marketplace ?`)) return
    const all = articles.map(a => {
      if (filtered.find(f => f.id === a.id)) return { ...a, marketplaceActif: true, marketplaceStatut: (a.stockDisponible > 0 ? "disponible" : "out_of_stock") as MarketplaceStatut }
      return a
    })
    store.saveArticles(all)
    setArticles(all)
    setBulkSaved(true)
    setTimeout(() => setBulkSaved(false), 3000)
  }

  const handleBulkUnpublish = () => {
    if (!window.confirm(`Dépublier ${filtered.length} articles filtrés ?`)) return
    const all = articles.map(a => {
      if (filtered.find(f => f.id === a.id)) return { ...a, marketplaceActif: false }
      return a
    })
    store.saveArticles(all)
    setArticles(all)
    setBulkSaved(true)
    setTimeout(() => setBulkSaved(false), 3000)
  }

  // Auto-sync stock statuts
  const handleAutoSync = () => {
    const all = articles.map(a => {
      if (!a.marketplaceActif) return a
      const seuil = a.marketplaceSeuilShortStock ?? 20
      let statut: MarketplaceStatut = a.marketplaceStatut ?? "disponible"
      if (a.stockDisponible <= 0) statut = "out_of_stock"
      else if (a.stockDisponible < seuil) statut = "short_stock"
      else if (statut === "out_of_stock" || statut === "short_stock") statut = "disponible"
      return { ...a, marketplaceStatut: statut }
    })
    store.saveArticles(all)
    setArticles(all)
    setBulkSaved(true)
    setTimeout(() => setBulkSaved(false), 3000)
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span className="text-2xl">🛒</span>
            Marketplace & Catalogue Web
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Gérez la publication de vos articles sur votre site web et portail client.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleAutoSync}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-300 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Sync statuts stocks
          </button>
        </div>
      </div>

      {bulkSaved && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm font-semibold">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          Modifications sauvegardées.
        </div>
      )}

      {/* ── Stats ── */}
      <StatsBar articles={articles} />

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit overflow-x-auto">
        {([
          { id: "catalogue" as Tab,    label: "Tous les articles",   count: articles.length },
          { id: "publie" as Tab,       label: "Publiés sur le site", count: published.length },
          { id: "api_preview" as Tab,  label: "Aperçu API JSON",     count: null },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t.label}
            {t.count !== null && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${tab === t.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── API Preview ── */}
      {tab === "api_preview" && <ApiPreview articles={articles} />}

      {/* ── Catalogue / Published ── */}
      {(tab === "catalogue" || tab === "publie") && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
                className="pl-8 pr-4 py-2 rounded-xl border border-border bg-card text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <select value={famille} onChange={e => setFamille(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-card text-xs focus:outline-none">
              <option value="">Toutes familles</option>
              {familles.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={statutFilter} onChange={e => setStatutFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-border bg-card text-xs focus:outline-none">
              <option value="tous">Tous statuts</option>
              <option value="publie">Publiés</option>
              <option value="non_publie">Non publiés</option>
              {STATUT_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.icon} {o.label}</option>)}
            </select>

            {/* Bulk actions */}
            {filtered.length > 0 && (
              <div className="flex gap-1.5 ml-auto">
                <button onClick={handleBulkPublish}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  Publier sélection ({filtered.length})
                </button>
                <button onClick={handleBulkUnpublish}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-muted transition-colors">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59" /></svg>
                  Dépublier sélection
                </button>
              </div>
            )}
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <span className="text-5xl">🛒</span>
              <p className="text-sm font-medium mt-3">Aucun article dans cette catégorie</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {(tab === "publie" ? filtered.filter(a => a.marketplaceActif) : filtered).map(a => (
                <div key={a.id} className="relative group">
                  <ArticleCard article={a} onClick={() => setEditing(a)} />
                  {/* Quick toggle overlay */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); handleSave({ ...a, marketplaceActif: !a.marketplaceActif }) }}
                      title={a.marketplaceActif ? "Dépublier" : "Publier"}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shadow-md ${a.marketplaceActif ? "bg-red-500 text-white" : "bg-green-500 text-white"}`}>
                      {a.marketplaceActif ? "🔒" : "🌐"}
                    </button>
                  </div>
                  {/* Status indicator bottom */}
                  <div className="mt-1 flex items-center justify-between px-1">
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${a.marketplaceActif ? "bg-green-500" : "bg-slate-300"}`} />
                      <span className="text-[10px] text-muted-foreground">{a.marketplaceActif ? "Publié" : "Non publié"}</span>
                    </div>
                    <button onClick={() => setEditing(a)}
                      className="text-[10px] text-primary font-semibold hover:underline">
                      Configurer →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Edit Drawer ── */}
      {editing && (
        <EditDrawer article={editing} onClose={() => setEditing(null)} onSave={handleSave} />
      )}
    </div>
  )
}
