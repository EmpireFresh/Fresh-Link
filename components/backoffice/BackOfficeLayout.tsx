"use client"

import React, { useState, useEffect, useCallback, Component } from "react"
import dynamic from "next/dynamic"
import LangSwitcher from "@/components/ui/LangSwitcher"
import type { User } from "@/lib/store"
import { store, ROLE_LABELS, ROLE_COLORS, isDemoUser, isSuperSuperAdmin, JAWAD_ID } from "@/lib/store"
import { useLang, T } from "@/lib/i18n"
import type { AppLang } from "@/lib/lang"

// ─────────────────────────────────────────────────────────────
// ERROR BOUNDARY — catches any render crash inside a panel
// instead of letting the whole page go white
// ─────────────────────────────────────────────────────────────
interface EBState { hasError: boolean; msg: string }
class PanelErrorBoundary extends Component<{ children: React.ReactNode; label: string }, EBState> {
  constructor(props: { children: React.ReactNode; label: string }) {
    super(props)
    this.state = { hasError: false, msg: "" }
  }
  static getDerivedStateFromError(err: unknown): EBState {
    return { hasError: true, msg: err instanceof Error ? err.message : String(err) }
  }
  componentDidCatch(err: unknown, info: React.ErrorInfo) {
    console.error("[PanelErrorBoundary] ERROR:", err)
    console.error("[PanelErrorBoundary] STACK:", info?.componentStack)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-slate-800 text-base">{this.props.label} — Erreur de chargement</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs font-mono break-all">{this.state.msg}</p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, msg: "" })}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
            Reessayer
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ALL panels loaded dynamically — one broken import never crashes the whole BO
const L = (label: string) => () => <div className="p-8 text-center text-muted-foreground text-sm">{label}</div>
const BODashboard            = dynamic(() => import("./BODashboard"),            { ssr: false, loading: L("Chargement tableau de bord...") })
const BOAchat                = dynamic(() => import("./BOAchat"),                { ssr: false, loading: L("Chargement achats...") })
const BOReception            = dynamic(() => import("./BOReception"),            { ssr: false, loading: L("Chargement reception...") })
const BOCommercial           = dynamic(() => import("./BOCommercial"),           { ssr: false, loading: L("Chargement commercial...") })
const BOStock                = dynamic(() => import("./BOStock"),                { ssr: false, loading: L("Chargement stock...") })
const BODispatch             = dynamic(() => import("./BODispatch"),             { ssr: false, loading: L("Chargement dispatch...") })
const BOFournisseurs         = dynamic(() => import("./BOFournisseurs"),         { ssr: false, loading: L("Chargement fournisseurs...") })
const BORapportLivraison     = dynamic(() => import("./BORapportLivraison"),     { ssr: false, loading: L("Chargement rapport...") })
const BOBonPreparation       = dynamic(() => import("./BOBonPreparation"),       { ssr: false, loading: L("Chargement preparation...") })
const BOCash                 = dynamic(() => import("./BOCash"),                 { ssr: false, loading: L("Chargement cash...") })
const BORetour               = dynamic(() => import("./BORetour"),               { ssr: false, loading: L("Chargement retours...") })
const BORecap                = dynamic(() => import("./BORecap"),                { ssr: false, loading: L("Chargement recap...") })
const BOPurchaseOrders       = dynamic(() => import("./BOPurchaseOrders"),       { ssr: false, loading: L("Chargement PO...") })
const BOUsers                = dynamic(() => import("./BOUsers"),                { ssr: false, loading: L("Chargement utilisateurs...") })
const BOSettings             = dynamic(() => import("./BOSettings"),             { ssr: false, loading: L("Chargement parametres...") })
const BOFinance              = dynamic(() => import("./BOFinance"),              { ssr: false, loading: L("Chargement finance...") })
const BOArticles             = dynamic(() => import("./BOArticles"),             { ssr: false, loading: L("Chargement articles...") })
const BOWhatsApp             = dynamic(() => import("./BOWhatsApp"),             { ssr: false, loading: L("Chargement WhatsApp...") })
const BOAffectationCommerciale = dynamic(() => import("./BOAffectationCommerciale"), { ssr: false, loading: L("Chargement affectation...") })
const BOGoogleSheets         = dynamic(() => import("./BOGoogleSheets"),         { ssr: false, loading: L("Chargement Google Sheets...") })
const BOComptesExternes      = dynamic(() => import("./BOComptesExternes"),      { ssr: false, loading: L("Chargement comptes...") })
const BOProspection          = dynamic(() => import("./BOProspection"),          { ssr: false, loading: L("Chargement prospection...") })
const BOCreditFournisseur    = dynamic(() => import("./BOCreditFournisseur"),    { ssr: false, loading: L("Chargement credit...") })
const AgentsIAPanel          = dynamic(() => import("./AgentsIAPanel"),          { ssr: false, loading: L("Chargement agent IA...") })
const BOGPSTracker           = dynamic(() => import("./BOGPSTracker"),           { ssr: false, loading: L("Chargement GPS...") })
const FeedbackPanel          = dynamic(() => import("./FeedbackPanel"),          { ssr: false, loading: L("Chargement feedbacks...") })
const TripChargesPanel       = dynamic(() => import("./TripChargesPanel"),       { ssr: false, loading: L("Chargement charges...") })
const AnalyseAchatPanel      = dynamic(() => import("./AnalyseAchatPanel"),      { ssr: false, loading: L("Chargement analyse achat...") })
const AnalyseReceptionPanel  = dynamic(() => import("./AnalyseReceptionPanel"),  { ssr: false, loading: L("Chargement analyse reception...") })
const ShelfLifePanel         = dynamic(() => import("./ShelfLifePanel"),         { ssr: false, loading: L("Chargement shelf life...") })
const ForecastPanel          = dynamic(() => import("./ForecastPanel"),          { ssr: false, loading: L("Chargement forecast...") })
const ASHELMarketPanel       = dynamic(() => import("./ASHELMarketPanel"),       { ssr: false, loading: L("Chargement ASHEL...") })
const CameraPermissionsPanel = dynamic(() => import("./CameraPermissionsPanel"), { ssr: false, loading: L("Chargement permissions...") })
const CutoffNotificationsPanel = dynamic(() => import("./CutoffNotificationsPanel"), { ssr: false, loading: L("Chargement cutoffs...") })
const CaissesVidesPanel      = dynamic(() => import("./CaissesVidesPanel"),      { ssr: false, loading: L("Chargement caisses vides...") })
const DeployGuidePanel       = dynamic(() => import("./DeployGuidePanel"),       { ssr: false, loading: L("Chargement guide...") })
const BODepots               = dynamic(() => import("./BODepots"),               { ssr: false, loading: L("Chargement depots...") })
const BOResources            = dynamic(() => import("./BOResources"),            { ssr: false, loading: L("Chargement RH...") })
const BOComptabiliteRH       = dynamic(() => import("./BOComptabiliteRH"),       { ssr: false, loading: L("Chargement compta RH...") })
const BODatabase             = dynamic(() => import("./BODatabase"),             { ssr: false, loading: L("Chargement base de donnees...") })
const BOIntelligencePrix     = dynamic(() => import("./BOIntelligencePrix"),     { ssr: false, loading: L("Chargement intelligence prix...") })
const BOBonLivraison         = dynamic(() => import("./BOBonLivraison"),         { ssr: false, loading: L("Chargement bons de livraison...") })
const BOHRDocuments          = dynamic(() => import("./BOHRDocuments"),          { ssr: false, loading: L("Chargement documents RH...") })
const BOLoyalty              = dynamic(() => import("./BOLoyalty"),              { ssr: false, loading: L("Chargement fidelite...") })
const BOPerformanceIncentives = dynamic(() => import("./BOPerformanceIncentives"), { ssr: false, loading: L("Chargement primes...") })
const BOTemplateEditor       = dynamic(() => import("./BOTemplateEditor"),       { ssr: false, loading: L("Chargement editeur...") })
const BOInvestissement       = dynamic(() => import("./BOInvestissement"),       { ssr: false, loading: L("Chargement dossier investisseur...") })
const BOInvestisseurDashboard = dynamic(() => import("./BOInvestisseurDashboard"), { ssr: false, loading: L("Chargement dashboard investisseur...") })
const BOFinanceControlGestion  = dynamic(() => import("./BOFinanceControlGestion"),  { ssr: false, loading: L("Chargement finance...") })
const BOSourcing             = dynamic(() => import("./BOSourcing"),             { ssr: false, loading: L("Chargement sourcing...") })
const BOPricing              = dynamic(() => import("./BOPricing"),              { ssr: false, loading: L("Chargement releve prix...") })
const BODemandesComptes      = dynamic(() => import("./BODemandesComptes"),      { ssr: false, loading: L("Chargement demandes comptes...") })
const BOWebIntegration       = dynamic(() => import("./BOWebIntegration"),       { ssr: false, loading: L("Chargement integration web...") })
const BOPermissionsMatrix    = dynamic(() => import("./BOPermissionsMatrix"),    { ssr: false, loading: L("Chargement permissions...") })
const BOMarketplace          = dynamic(() => import("./BOMarketplace"),          { ssr: false, loading: L("Chargement marketplace...") })
const BODocuments            = dynamic(() => import("./BODocuments"),            { ssr: false, loading: L("Chargement documents...") })
const BOCategoryPricing      = dynamic(() => import("./BOCategoryPricing"),      { ssr: false, loading: L("Chargement tarifs catégories...") })
const BOFirebaseArchive      = dynamic(() => import("./BOFirebaseArchive"),      { ssr: false, loading: L("Chargement archivage Firebase...") })
const BOExternalLinks        = dynamic(() => import("./BOExternalLinks"),         { ssr: false, loading: L("Chargement liens...") })

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type Tab =
  | "dashboard" | "achat" | "reception" | "po"
  | "commercial" | "affectation" | "dispatch"
  | "stock" | "retour" | "cash"
  | "recap" | "rapport_livraison" | "preparation"
  | "fournisseurs" | "articles"
  | "finance" | "whatsapp"
  | "users" | "database" | "settings" | "gsheets"
  | "comptes_externes"
  | "prospection" | "credit_fournisseur" | "agents_ia"
  | "gps_tracker"
  | "feedback" | "trip_charges" | "analyse_achat" | "analyse_reception"
  | "caisses_vides" | "shelf_life" | "forecast" | "ashel_market"
  | "camera_perms" | "cutoffs" | "deploy_guide"
  | "azmi_agent" | "hicham_agent" | "ourai_agent"
  | "depots"
  | "rh_productivite" | "rh_comptabilite"
  | "intelligence_prix" | "bon_livraison" | "hr_documents"
  | "loyalty" | "performance_incentives" | "template_editor"
  | "investissement" | "sourcing" | "pricing" | "finance_cdg"
  | "demandes_comptes" | "web_integration" | "permissions_matrix"
  | "marketplace"
  | "documents"
  | "category_pricing"
  | "firebase_archive"
  | "liens_externes"

interface NavItem {
  id: Tab
  label: string
  labelAr: string
  icon: React.ReactNode
  permKey?: keyof User
  badge?: number
}

interface NavGroup {
  label: string
  labelAr: string
  items: NavItem[]
}

// ─────────────────────────────────────────────────────────────
// TRANSLATION HELPER — nav items use T dictionary
// ─────────────────────────────────────────────────────────────

// Maps tab id → T key prefix for nav translations
const NAV_I18N_KEYS: Partial<Record<string, keyof typeof T>> = {
  recap: "nav.recap", finance: "nav.finance", rapport_livraison: "nav.rapport_livr",
  achat: "nav.achat", po: "nav.po", fournisseurs: "nav.fournisseurs",
  reception: "nav.reception", commercial: "nav.commandes", affectation: "nav.affectation",
  cash: "nav.cash", stock: "nav.stock", dispatch: "nav.dispatch",
  preparation: "nav.preparation", retour: "nav.retours", bon_livraison: "nav.bon_livr",
  articles: "nav.articles", comptes_externes: "nav.clients", whatsapp: "nav.whatsapp",
  agents_ia: "nav.agents_ia", gps_tracker: "nav.gps", feedback: "nav.feedback",
  users: "nav.users", settings: "nav.settings_tab", database: "nav.settings_tab",
  demandes_comptes: "nav.demandes", web_integration: "nav.web_int",
  permissions_matrix: "nav.permissions",
}

const NAV_GROUP_I18N: Record<string, { fr: string; ar: string; en: string }> = {
  "Vue d'ensemble":       { fr: "Vue d'ensemble",        ar: "نظرة عامة",           en: "Overview" },
  "Achats":               { fr: "Achats",                 ar: "المشتريات",           en: "Purchases" },
  "Commercial & Clients": { fr: "Commercial & Clients",   ar: "التجاري والعملاء",    en: "Sales & Clients" },
  "Stock & Catalogue":    { fr: "Stock & Catalogue",      ar: "المخزون والفهرس",     en: "Stock & Catalog" },
  "Logistique":           { fr: "Logistique",             ar: "اللوجستيك",           en: "Logistics" },
  "Finance & Pilotage":   { fr: "Finance & Pilotage",     ar: "المالية والتحكم",     en: "Finance & Control" },
  "RH & Equipe":          { fr: "RH & Equipe",            ar: "الموارد البشرية",     en: "HR & Team" },
  "Administration":       { fr: "Administration",         ar: "الإدارة والإعدادات",  en: "Administration" },
}

function getNavLabel(id: string, fallbackFr: string, fallbackAr: string | undefined, lang: AppLang): string {
  const key = NAV_I18N_KEYS[id]
  if (key && (lang as string) === "en") return (T[key] as { fr: string; ar: string; en?: string }).en ?? fallbackFr
  if (lang === "ar" && fallbackAr) return fallbackAr
  return fallbackFr
}

function getGroupLabel(groupLabel: string, lang: AppLang): string {
  const entry = NAV_GROUP_I18N[groupLabel]
  if (!entry) return groupLabel
  if ((lang as string) === "en") return entry.en
  if (lang === "ar") return entry.ar
  return entry.fr
}

// ─────────────────────────────────────────────────────────────
// ICON HELPER
// ─────────────────────────────────────────────────────────────

function Icon({ d, className = "w-[18px] h-[18px]" }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// NAV CONFIGURATION
// ─────────────────────────────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  // ── 1. VUE D'ENSEMBLE ─────────────────────────────────────────────────────
  {
    label: "Vue d'ensemble", labelAr: "نظرة عامة",
    items: [
      { id: "recap",            label: "Synthese & Recap",       labelAr: "الملخص",           permKey: "canViewRecap",      icon: <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
      { id: "finance",          label: "Finance & Caisse",       labelAr: "المالية",           permKey: "canViewFinance",    icon: <Icon d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 11v-1m0-8h.01M20 12a8 8 0 11-16 0 8 8 0 0116 0z" /> },
      { id: "rapport_livraison", label: "Rapport Livraison",     labelAr: "تقرير التوصيل",    permKey: "canViewLogistique", icon: <Icon d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
    ],
  },
  // ── 2. ACHATS & APPROVISIONNEMENT ────────────────────────────────────────
  {
    label: "Achats", labelAr: "المشتريات",
    items: [
      { id: "achat",             label: "Bons d'achat",           labelAr: "وصولات الشراء",      permKey: "canViewAchat", icon: <Icon d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /> },
      { id: "po",                label: "Commandes Fournisseurs", labelAr: "أوامر الشراء",       permKey: "canViewAchat", icon: <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
      { id: "reception",         label: "Reception Achat",        labelAr: "الاستلام",           permKey: "canViewAchat", icon: <Icon d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /> },
      { id: "fournisseurs",      label: "Fournisseurs",           labelAr: "الموردون",           permKey: "canViewAchat", icon: <Icon d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /> },
      { id: "credit_fournisseur",label: "Credit Fournisseur",     labelAr: "ائتمان الموردين",    permKey: "canViewAchat", icon: <Icon d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /> },
      { id: "sourcing",          label: "Sourcing Marche",        labelAr: "تحديد المصادر",      permKey: "canViewAchat", icon: <Icon d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /> },
      { id: "pricing",           label: "Releve de Prix",         labelAr: "رصد الأسعار",        permKey: "canViewAchat", icon: <Icon d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /> },
      { id: "analyse_achat",     label: "Analyse Achat",          labelAr: "تحليل المشتريات",    permKey: "canViewAchat", icon: <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
      { id: "analyse_reception", label: "Analyse Reception",      labelAr: "تحليل الاستلام",     permKey: "canViewAchat", icon: <Icon d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
    ],
  },
  // ── 3. COMMERCIAL & CLIENTS ───────────────────────────────────────────────
  {
    label: "Commercial & Clients", labelAr: "التجاري والعملاء",
    items: [
      { id: "commercial",        label: "Commandes",              labelAr: "الطلبيات",          permKey: "canViewCommercial", icon: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /> },
      { id: "affectation",       label: "Affectation Commerciale",labelAr: "التوزيع التجاري",   permKey: "canViewCommercial", icon: <Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /> },
      { id: "cash",              label: "Cash & BL",              labelAr: "النقديات",          permKey: "canViewCash",       icon: <Icon d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /> },
      { id: "category_pricing",  label: "Tarifs par Categorie",   labelAr: "أسعار الفئات",      permKey: "canViewCommercial", icon: <Icon d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /> },
      { id: "documents",         label: "Devis & Contrats CHR",   labelAr: "العروض والعقود",    permKey: "canViewCommercial", icon: <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
      { id: "prospection",       label: "Prospection IA",         labelAr: "الاستهداف الذكي",  permKey: "canViewCommercial", icon: <Icon d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /> },
      { id: "intelligence_prix", label: "Intelligence Prix",      labelAr: "استخبارات الأسعار",permKey: "canViewCommercial", icon: <Icon d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /> },
      { id: "comptes_externes",  label: "Clients & Fournisseurs", labelAr: "الزبائن والموردون", permKey: "canViewExternal",   icon: <Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /> },
      { id: "loyalty",           label: "Promotions & Fidelite",  labelAr: "العروض والولاء",    permKey: "canViewCommercial" as keyof User, icon: <Icon d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /> },
      { id: "demandes_comptes",  label: "Demandes Comptes",       labelAr: "طلبات الحسابات",    permKey: "canViewExternal",   icon: <Icon d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /> },
      { id: "whatsapp",          label: "WhatsApp Pro",           labelAr: "واتساب",            permKey: "canViewCommercial", icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      )},
    ],
  },
  // ── 4. STOCK & CATALOGUE ─────────────────────────────────────────────────
  {
    label: "Stock & Catalogue", labelAr: "المخزون والفهرس",
    items: [
      { id: "articles",    label: "Catalogue Produits",    labelAr: "الفواكه والخضر",    permKey: "canViewStock", icon: <Icon d="M4 6h16M4 10h16M4 14h16M4 18h16" /> },
      { id: "stock",       label: "Stock & Inventaire",    labelAr: "المخزون",           permKey: "canViewStock", icon: <Icon d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /> },
      { id: "shelf_life",  label: "Shelf Life & DLC",      labelAr: "تاريخ الصلاحية",   permKey: "canViewStock", icon: <Icon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /> },
      { id: "forecast",    label: "Forecast & Achat Auto", labelAr: "التوقعات",          permKey: "canViewStock", icon: <Icon d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> },
      { id: "caisses_vides",label: "Caisses Vides",        labelAr: "الصناديق الفارغة",  permKey: "canViewLogistique", icon: <Icon d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /> },
      { id: "marketplace", label: "Marketplace & Web",     labelAr: "المتجر الإلكتروني", permKey: "canViewCommercial", icon: <Icon d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /> },
    ],
  },
  // ── 5. LOGISTIQUE & TRANSPORT ─────────────────────────────────────────────
  {
    label: "Logistique", labelAr: "اللوجستيك",
    items: [
      { id: "dispatch",    label: "Dispatch & Livreurs",   labelAr: "التوزيع",           permKey: "canViewLogistique", icon: <Icon d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /> },
      { id: "preparation", label: "Preparation",           labelAr: "وصولات التحضير",    permKey: "canViewLogistique", icon: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /> },
      { id: "bon_livraison",label: "Bons de Livraison",    labelAr: "وصولات التوصيل",    permKey: "canViewLogistique", icon: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /> },
      { id: "retour",      label: "Retours",               labelAr: "المرتجعات",         permKey: "canViewLogistique", icon: <Icon d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /> },
      { id: "trip_charges",label: "Charges Trip",          labelAr: "مصاريف الرحلة",     permKey: "canViewLogistique", icon: <Icon d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M12 7h.01M15 7h.01M9 7H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M7 7V5a2 2 0 012-2h8a2 2 0 012 2v2" /> },
      { id: "gps_tracker", label: "GPS Livreurs",          labelAr: "تتبع GPS",          icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )},
    ],
  },
  // ── 6. FINANCE & PILOTAGE ────────────────────────────────────────────────
  {
    label: "Finance & Pilotage", labelAr: "المالية والتحكم",
    items: [
      { id: "finance_cdg",           label: "Controle de Gestion",    labelAr: "المالية والرقابة",  permKey: "canViewFinance" as keyof User,      icon: <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
      { id: "performance_incentives", label: "Primes & Actionnaires", labelAr: "العلاوات والمساهمون",permKey: "canViewFinance" as keyof User,      icon: <Icon d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> },
      { id: "investissement",         label: "Dashboard Investisseur", labelAr: "ملف المستثمر",      permKey: "canViewInvestisseur" as keyof User, icon: <Icon d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /> },
    ],
  },
  // ── 7. RH & EQUIPE ───────────────────────────────────────────────────────
  {
    label: "RH & Equipe", labelAr: "الموارد البشرية",
    items: [
      { id: "rh_productivite",   label: "RH — Productivite & Salaires", labelAr: "الموارد البشرية",        permKey: "canViewRH" as keyof User, icon: <Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /> },
      { id: "rh_comptabilite",   label: "Comptabilite RH",              labelAr: "محاسبة الموارد",         permKey: "canViewRH" as keyof User, icon: <Icon d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M12 7h.01M15 7h.01M9 7H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M7 7V5a2 2 0 012-2h8a2 2 0 012 2v2" /> },
      { id: "hr_documents",      label: "Docs & Paie Multi-Cycles",     labelAr: "وثائق الموارد البشرية",  permKey: "canViewRH" as keyof User, icon: <Icon d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /> },
      { id: "template_editor",   label: "Editeur de Templates",         labelAr: "محرر النماذج",           permKey: "canViewRH" as keyof User, icon: <Icon d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /> },
      { id: "agents_ia",         label: "Agents IA — Equipe Complete",  labelAr: "فريق الذكاء الاصطناعي", icon: <Icon d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.694-1.338 2.694H4.136c-1.368 0-2.337-1.694-1.338-2.694L4 15.3" /> },
      { id: "feedback",          label: "Feedbacks & Avis",             labelAr: "الآراء والتقييمات",      icon: <Icon d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /> },
    ],
  },
  // ── 8. ADMINISTRATION ────────────────────────────────────────────────────
  {
    label: "Administration", labelAr: "الإدارة والإعدادات",
    items: [
      { id: "users",            label: "Utilisateurs & Roles",   labelAr: "المستخدمون",        permKey: "canViewDatabase", icon: <Icon d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /> },
      { id: "depots",           label: "Multi-Depots",           labelAr: "المستودعات",        permKey: "canViewDatabase", icon: <Icon d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /> },
      { id: "web_integration",  label: "Integration Site Web",   labelAr: "ربط الموقع",        permKey: "canViewDatabase", icon: <Icon d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /> },
      { id: "permissions_matrix",label: "Permissions & Roles",  labelAr: "الصلاحيات والأدوار",permKey: "canViewDatabase", icon: <Icon d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /> },
      { id: "camera_perms",     label: "Droits Camera",          labelAr: "صلاحيات الكاميرا",  permKey: "canViewDatabase", icon: <Icon d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z" /> },
      { id: "cutoffs",          label: "Notifications Cut-off",  labelAr: "إشعارات الإيقاف",   permKey: "canViewDatabase", icon: <Icon d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /> },
      { id: "database",         label: "Base de donnees",        labelAr: "قاعدة البيانات",    permKey: "canViewDatabase", icon: <Icon d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /> },
      { id: "firebase_archive", label: "Archivage Firebase",     labelAr: "أرشفة Firebase",    permKey: "canViewDatabase", icon: <Icon d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /> },
      { id: "liens_externes",   label: "Liens Partenaires",      labelAr: "روابط الشركاء",     permKey: "canViewDatabase", icon: <Icon d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /> },
      { id: "settings",         label: "Parametres",             labelAr: "الإعدادات",         permKey: "canViewDatabase", icon: <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /> },
      {
        id: "gsheets", label: "Google Sheets", labelAr: "جوجل شيتس", permKey: "canViewDatabase" as keyof User,
        icon: (
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 7h8M8 11h8M8 15h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M4 6h16" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        ),
      },
    ],
  },
]

// ─────────────────────────────────────────────────────────────
// PANELS — lazy, safe, no crashes
// ─────────────────────────────────────────────────────────────

const PANELS: Record<Tab, (u: User) => React.ReactNode> = {
  dashboard:         (u) => <BODashboard user={u} />,
  achat:             (_u) => <BOAchat />,
  reception:         (u) => <BOReception user={u} />,
  po:                (_u) => <BOPurchaseOrders />,
  commercial:        (u) => <BOCommercial user={u} />,
  affectation:       (u) => <BOAffectationCommerciale user={u} />,
  dispatch:          (u) => <BODispatch user={u} />,
  fournisseurs:      (u) => <BOFournisseurs user={u} />,
  preparation:       (u) => <BOBonPreparation user={u} />,
  rapport_livraison: (u) => <BORapportLivraison user={u} />,
  stock:             (u) => <BOStock user={u} />,
  retour:            (_u) => <BORetour />,
  articles:          (u) => <BOArticles user={u} />,
  finance:           (u) => <BOFinance user={u} />,
  whatsapp:          (u) => <BOWhatsApp user={u} />,
  cash:              (_u) => <BOCash />,
  recap:             (_u) => <BORecap />,
  users:             (u) => <BOUsers currentUser={u} />,
  depots:            (u) => <BODepots user={u} />,
  database:          (u) => <BODatabase user={u} />,
  marketplace:       (u) => <BOMarketplace user={u} />,
  category_pricing:  (_u) => <BOCategoryPricing />,
  documents:         (u) => <BODocuments user={u} />,
  firebase_archive:  (_u) => <BOFirebaseArchive />,
  liens_externes:    (u)  => <BOExternalLinks user={u} />,
  demandes_comptes:  (u) => <BODemandesComptes user={u} />,
  web_integration:   (u) => <BOWebIntegration user={u} />,
  permissions_matrix:(_u) => <BOPermissionsMatrix />,
  settings:          (u) => <BOSettings user={u} />,
  gsheets:           (u) => <BOGoogleSheets user={u} />,
  comptes_externes:  (u) => <BOComptesExternes user={u} />,
  prospection:       (u) => <BOProspection user={u} />,
  credit_fournisseur:(u) => <BOCreditFournisseur user={u} />,
  agents_ia:         (u) => <AgentsIAPanel user={u} initialAgent="ashel" />,
  azmi_agent:        (u) => <AgentsIAPanel user={u} initialAgent="azmi" />,
  hicham_agent:      (u) => <AgentsIAPanel user={u} initialAgent="hicham" />,
  ourai_agent:       (u) => <AgentsIAPanel user={u} initialAgent="ourai" />,
  gps_tracker:       (u) => <BOGPSTracker user={u} />,
  feedback:          (u) => <FeedbackPanel user={u} />,
  trip_charges:      (_u) => <TripChargesPanel />,
  caisses_vides:     (_u) => <CaissesVidesPanel />,
  analyse_achat:       (_u) => <AnalyseAchatPanel />,
  analyse_reception:   (_u) => <AnalyseReceptionPanel />,
  shelf_life:          (_u) => <ShelfLifePanel />,
  forecast:            (_u) => <ForecastPanel />,
  ashel_market:        (_u) => <ASHELMarketPanel />,
  camera_perms:      (u) => <CameraPermissionsPanel currentUser={u} />,
  cutoffs:           (_u) => <CutoffNotificationsPanel />,
  deploy_guide:      (_u) => <DeployGuidePanel />,
  rh_productivite:   (u) => <BOResources user={u} />,
  rh_comptabilite:   (u) => <BOComptabiliteRH user={u} />,
  intelligence_prix: (u) => <BOIntelligencePrix user={u} />,
  bon_livraison:     (u) => <BOBonLivraison user={u} />,
  hr_documents:          (u) => <BOHRDocuments user={u} />,
  loyalty:               (u) => <BOLoyalty user={u} />,
  performance_incentives:(u) => <BOPerformanceIncentives user={u} />,
  template_editor:       (u) => <BOTemplateEditor user={u} />,
  investissement:        (u) => <BOInvestisseurDashboard user={u} />,
  finance_cdg:          (u) => <BOFinanceControlGestion user={u} />,
  sourcing:              (u)  => <BOSourcing user={u} />,
  pricing:               (u)  => <BOPricing  user={u} />,
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

interface Props { user: User; onLogout: () => void }

export default function BackOfficeLayout({ user, onLogout }: Props) {
  const lang = useLang()
  const [activeTab, setActiveTab]       = useState<Tab>("dashboard")
  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isOnline, setIsOnline]         = useState(true)
  const [sbStatus, setSbStatus]         = useState<"checking" | "connected" | "error">("checking")
  const [syncRunning, setSyncRunning]   = useState(false)
  const [syncDone, setSyncDone]         = useState(false)
  const [showProfil, setShowProfil]     = useState(false)
  const [profilPhoto, setProfilPhoto]   = useState(user.photoUrl ?? "")
  const [navSearch, setNavSearch]       = useState("")
  const [companyBrand, setCompanyBrand] = useState(() => store.getCompanyConfig())
  const isDemo           = isDemoUser(user)

  // Re-read company brand whenever settings are saved
  useEffect(() => {
    const reload = () => setCompanyBrand(store.getCompanyConfig())
    window.addEventListener("fl_company_updated", reload)
    return () => window.removeEventListener("fl_company_updated", reload)
  }, [])
  const isJawad          = user.id === JAWAD_ID || isSuperSuperAdmin(user)
  const isSuperAdmin     = user.role === "super_super_admin" || user.role === "super_admin" || user.role === "admin"
  const isStrictSuperAdmin = user.role === "super_super_admin" || user.role === "super_admin"
  const isAdminOrAbove   = user.role === "super_super_admin" || user.role === "super_admin" || user.role === "admin"

  // Supabase connectivity check
  useEffect(() => {
    let cancelled = false

    // Écouter les events du LiveSyncProvider (JSONB v3)
    const onStatus = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      if (!cancelled) setSbStatus(detail === "connected" ? "connected" : "error")
    }
    window.addEventListener("fl_supabase_status", onStatus)

    // Ping actif au démarrage et toutes les 60s
    async function ping() {
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const sb = createClient()
        const { error } = await sb.from("fl_clients").select("id").limit(1)
        if (!cancelled) setSbStatus(error ? "error" : "connected")
      } catch {
        if (!cancelled) setSbStatus("error")
      }
    }
    ping()
    const timer = setInterval(ping, 60_000)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener("fl_supabase_status", onStatus)
    }
  }, [])

  // Online / offline detection
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const on  = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off) }
  }, [])

  // Close sidebar on ESC
  useEffect(() => {
    if (!sidebarOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setSidebarOpen(false) }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [sidebarOpen])

  const isVisible = useCallback((item: NavItem): boolean => {
    // Super Administrateur voit TOUT
    if (user.role === "super_super_admin") return true
    if (!item.permKey) return true
    // Investisseur dashboard — permission spéciale super confidentielle
    if (item.permKey === "canViewInvestisseur") return (user as unknown as Record<string,unknown>)["canViewInvestisseur"] === true
    // database / settings / gsheets / users (canViewDatabase): only admin + super_admin
    if (item.permKey === "canViewDatabase") return isAdminOrAbove
    // All other permKeys: super_admin + admin bypass, others check their flag
    if (isSuperAdmin) return true
    return (user as unknown as Record<string, unknown>)[item.permKey as string] === true
  }, [isSuperAdmin, isAdminOrAbove, user])

  const navigate = useCallback((tab: Tab) => {
    setActiveTab(tab)
    setSidebarOpen(false)
  }, [])

  const allItems   = NAV_GROUPS.flatMap(g => g.items)
  const activeItem = allItems.find(i => i.id === activeTab)

  // Filter nav by search
  const searchQ = navSearch.toLowerCase().trim()
  const filteredGroups = NAV_GROUPS.map(g => ({
    ...g,
    items: g.items.filter(item =>
      isVisible(item) && (
        !searchQ ||
        (item.label ?? "").toLowerCase().includes(searchQ) ||
        item.labelAr?.includes(navSearch)
      )
    )
  })).filter(g => g.items.length > 0)

  // ── Group icon colors by group label (light-theme friendly) ──
  const GROUP_ICON_COLOR: Record<string, string> = {
    "Vue d'ensemble":        "text-emerald-600",
    "Achats":                "text-amber-600",
    "Commercial & Clients":  "text-lime-600",
    "Stock & Catalogue":     "text-orange-600",
    "Logistique":            "text-sky-600",
    "Finance & Pilotage":    "text-violet-600",
    "RH & Equipe":           "text-indigo-600",
    "Administration":        "text-slate-600",
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden font-sans bg-slate-50 text-slate-800">

      {/* Desktop sidebar — collapsible */}
      <div className={`hidden lg:flex flex-col shrink-0 transition-all duration-300 ${sidebarCollapsed ? "w-16" : "w-60"}`}>
        <SidebarContent
          user={user}
          activeTab={activeTab}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          profilPhoto={profilPhoto}
          navSearch={navSearch}
          setNavSearch={setNavSearch}
          filteredGroups={filteredGroups}
          searchQ={searchQ}
          GROUP_ICON_COLOR={GROUP_ICON_COLOR}
          navigate={navigate}
          onLogout={onLogout}
          onOpenProfil={() => setShowProfil(true)}
          appName={companyBrand.appName || "FreshLink Pro"}
          appSlogan={companyBrand.appSlogan || companyBrand.nom || "Empire Fresh"}
          appLogo={companyBrand.logo || ""}
          lang={lang}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Drawer */}
          <div className="w-60 shrink-0 shadow-2xl">
            <SidebarContent
              user={user}
              activeTab={activeTab}
              sidebarCollapsed={sidebarCollapsed}
              setSidebarCollapsed={setSidebarCollapsed}
              profilPhoto={profilPhoto}
              navSearch={navSearch}
              setNavSearch={setNavSearch}
              filteredGroups={filteredGroups}
              searchQ={searchQ}
              GROUP_ICON_COLOR={GROUP_ICON_COLOR}
              navigate={navigate}
              onLogout={onLogout}
              onOpenProfil={() => setShowProfil(true)}
              appName={companyBrand.appName || "FreshLink Pro"}
              appSlogan={companyBrand.appSlogan || companyBrand.nom || "Empire Fresh"}
              appLogo={companyBrand.logo || ""}
              lang={lang}
            />
          </div>
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/60 backdrop-blur-[2px]"
            onClick={() => setSidebarOpen(false)}
          />
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Topbar ─────────────────────────────────────── */}
        <header className="flex items-center justify-between px-4 lg:px-5 py-3 shrink-0 gap-3 bg-white border-b border-slate-200 shadow-sm">

          {/* Left: hamburger + breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors shrink-0"
              aria-label="Ouvrir le menu">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 hidden sm:inline font-medium">
                  {(() => { const g = NAV_GROUPS.find(g => g.items.some(i => i.id === activeTab)); return g ? getGroupLabel(g.label, lang) : "Dashboard" })()}
                </span>
                <svg className="w-3 h-3 text-slate-300 hidden sm:block shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <h1 className="text-sm font-bold text-slate-800 truncate">
                  {activeItem ? getNavLabel(activeItem.id, activeItem.label, activeItem.labelAr, lang) : "Tableau de bord"}
                </h1>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                {new Date().toLocaleDateString("fr-MA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* Right: status chips + user */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Language switcher */}
            <LangSwitcher />

            {/* Online / Offline */}
            <div className={[
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border",
              isOnline
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-700"
            ].join(" ")}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
              <span className="hidden sm:inline">{isOnline ? "En ligne" : "Hors ligne"}</span>
            </div>

            {/* Supabase status — cliquable pour déclencher la sync */}
            <button
              onClick={async () => {
                if (syncRunning) return
                setSyncRunning(true)
                setSyncDone(false)
                try {
                  const { resetSync, runFullSync } = await import("@/lib/supabase/syncManager")
                  resetSync()
                  await runFullSync(() => {})
                  setSyncDone(true)
                  setTimeout(() => setSyncDone(false), 3000)
                } catch { /* offline */ }
                setSyncRunning(false)
              }}
              disabled={syncRunning}
              title="Cliquer pour synchroniser les données → Supabase"
              className={[
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all",
                syncDone      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : syncRunning ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                : sbStatus === "connected" ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                : sbStatus === "error"     ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                                           : "bg-slate-50 border-slate-200 text-slate-500"
              ].join(" ")}>
              {syncRunning ? (
                <svg className="w-3 h-3 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : syncDone ? (
                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                </svg>
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  sbStatus === "connected" ? "bg-emerald-500 animate-pulse"
                  : sbStatus === "error"   ? "bg-rose-500"
                                           : "bg-slate-400 animate-pulse"
                }`} />
              )}
              <span className="hidden sm:inline">
                {syncRunning ? "Sync..." : syncDone ? "Sync OK" : sbStatus === "connected" ? "Supabase" : sbStatus === "error" ? "DB offline" : "DB..."}
              </span>
            </button>

            {/* Jawad crown badge */}
            {isJawad && (
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-yellow-50 border border-yellow-400 text-yellow-700 shadow-sm shadow-yellow-200">
                <svg className="w-3.5 h-3.5 fill-yellow-500" viewBox="0 0 24 24">
                  <path d="M2 19h20l-2-10-5 5-3-8-3 8-5-5z" />
                </svg>
                Super Jawad
              </div>
            )}

            {/* Demo badge */}
            {isDemo && (
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Demo
              </div>
            )}

            {/* Avatar + name */}
            <button
              onClick={() => setShowProfil(true)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
              {profilPhoto ? (
                <img src={profilPhoto} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white ${ROLE_COLORS[user.role]}`}>
                  {user.name[0]?.toUpperCase()}
                </div>
              )}
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-700 leading-none">{user.name}</p>
                <p className="text-[10px] text-slate-400">{ROLE_LABELS[user.role]}</p>
              </div>
            </button>

            {/* Logout */}
            <button
              onClick={onLogout}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Deconnexion
            </button>
          </div>
        </header>

        {/* Jawad banner — accès Super Admin */}
        {isJawad && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs shrink-0">
            <svg className="w-3.5 h-3.5 fill-amber-500 shrink-0" viewBox="0 0 24 24"><path d="M2 19h20l-2-10-5 5-3-8-3 8-5-5z" /></svg>
            <span className="font-semibold">Super Admin</span>
          </div>
        )}

        {/* Demo banner */}
        {isDemo && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs shrink-0">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              <strong>Compte Demo</strong> — Modifications sauvegardees localement uniquement.{" "}
              <span className="opacity-60">حساب تجريبي — التعديلات محلية فقط</span>
            </span>
          </div>
        )}



        {/* ── Content ────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <div className="p-4 lg:p-6 min-h-full">
            <PanelErrorBoundary key={activeTab} label={allItems.find(i => i.id === activeTab)?.label ?? activeTab}>
              {PANELS[activeTab]?.(user) ?? (
                <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                  Section non disponible
                </div>
              )}
            </PanelErrorBoundary>
          </div>
        </main>

        {/* ── Footer ─────────────────────────────────────── */}
        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-2 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-[11px] text-slate-500">
            &copy; 2026{" "}
            <a href="https://empire-fresh.netlify.app/" target="_blank" rel="noopener noreferrer"
              className="font-black hover:underline" style={{ color: "#1a4f2a" }}>
              Empire<span style={{ color: "#b8962e" }}>Fresh</span>
            </a>
            {" "}&mdash;{" "}
            <span className="font-bold" style={{ color: "#1a4f2a" }}>Fresh Link Pro</span>
          </p>
          <div className="flex items-center gap-3">
            <a href="https://empire-fresh.netlify.app/" target="_blank" rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1 text-[10px] text-emerald-700 hover:text-emerald-900 font-semibold hover:underline transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Empire Fresh
            </a>
            <span className="text-slate-200 hidden sm:block">|</span>
            <a href="https://www.neo.space/fr" target="_blank" rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1 text-[10px] text-violet-700 hover:text-violet-900 font-semibold hover:underline transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Neo Space
            </a>
          </div>
        </footer>
      </div>

      {/* ── Profil modal ──────────────────────────────────── */}
      {showProfil && (
        <ProfilModal
          user={user}
          profilPhoto={profilPhoto}
          setProfilPhoto={setProfilPhoto}
          onClose={() => setShowProfil(false)}
          canUseCamera={isStrictSuperAdmin}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR CONTENT COMPONENT — extracted to avoid remount on every render
// ─────────────────────────────────────────────────────────────

interface SidebarContentProps {
  user: User
  activeTab: Tab
  sidebarCollapsed: boolean
  setSidebarCollapsed: (v: boolean) => void
  profilPhoto: string
  navSearch: string
  setNavSearch: (v: string) => void
  filteredGroups: Array<{ label: string; labelAr: string; items: NavItem[] }>
  searchQ: string
  GROUP_ICON_COLOR: Record<string, string>
  navigate: (t: Tab) => void
  onLogout: () => void
  onOpenProfil: () => void
  appName: string
  appSlogan: string
  appLogo: string
  lang: AppLang
}

function SidebarContent({
  user, activeTab, sidebarCollapsed, setSidebarCollapsed,
  profilPhoto, navSearch, setNavSearch, filteredGroups, searchQ,
  GROUP_ICON_COLOR, navigate, onLogout, onOpenProfil,
  appName, appSlogan, appLogo, lang,
}: SidebarContentProps) {
  const BG = "#0d2218"
  const BG2 = "#1a4f2a"
  const ACTIVE = "#22c55e"

  return (
    <aside className="flex flex-col h-full" style={{ background: BG, color: "#d1fae5" }}>

      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: "#1a4f2a" }}>
        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border-2 shadow-lg" style={{ borderColor: "#22c55e" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={appLogo || "/empire-fresh-logo.png"} alt={appName} className="w-full h-full object-contain p-0.5 bg-white" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="font-black text-sm leading-tight text-white truncate">
              <span style={{ color: "#d1fae5" }}>FRESHLINK </span>
              <span style={{ color: "#4ade80" }}>PRO</span>
            </p>
            <p className="text-[10px] font-bold truncate" style={{ color: "#6ee7b7" }}>{appSlogan || "Empire Fresh"}</p>
          </div>
        )}
      </div>

      {/* Search bar */}
      {!sidebarCollapsed && (
        <div className="px-3 pt-3 pb-1">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "#6ee7b7" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text" value={navSearch} onChange={e => setNavSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs focus:outline-none transition-all"
              style={{ background: BG2, color: "#d1fae5", border: "1px solid #22c55e33" }}
            />
            {navSearch && (
              <button onClick={() => setNavSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#6ee7b7" }}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dashboard button */}
      <div className="px-2 pt-2 pb-1">
        <button
          onClick={() => navigate("dashboard")}
          title="Tableau de bord"
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all"
          style={activeTab === "dashboard"
            ? { background: "#22c55e", color: "#052e16" }
            : { color: "#bbf7d0" }}
          onMouseEnter={e => { if (activeTab !== "dashboard") (e.currentTarget as HTMLButtonElement).style.background = "#1a4f2a" }}
          onMouseLeave={e => { if (activeTab !== "dashboard") (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: activeTab === "dashboard" ? "#052e16" : "#4ade80" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          {!sidebarCollapsed && <span className="flex-1 text-left">Dashboard</span>}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 thin-scroll" style={{ scrollbarColor: "#1a4f2a transparent" }}>
        {filteredGroups.map(group => (
          <div key={group.label} className="mb-2">
            {!sidebarCollapsed && !searchQ && (
              <div className="px-3 pt-3 pb-1">
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "#4ade80", opacity: 0.7 }}>
                  {getGroupLabel(group.label, lang)}
                </span>
              </div>
            )}
            {group.items.map(item => {
              const isActive = activeTab === item.id
              const itemLabel = getNavLabel(item.id, item.label, item.labelAr, lang)
              return (
                <button
                  key={item.id}
                  onClick={() => { navigate(item.id); setNavSearch("") }}
                  title={sidebarCollapsed ? itemLabel : undefined}
                  className={[
                    "w-full flex items-center gap-3 rounded-xl text-sm transition-all duration-150 group mb-0.5",
                    sidebarCollapsed ? "justify-center p-2.5" : "px-3 py-2.5",
                  ].join(" ")}
                  style={isActive
                    ? { background: ACTIVE, color: "#052e16" }
                    : { color: "#bbf7d0" }
                  }
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = BG2 }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}
                >
                  <span className={`shrink-0 ${isActive ? "opacity-100" : "opacity-80"}`} style={{ color: isActive ? "#052e16" : "#4ade80" }}>
                    {item.icon}
                  </span>
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 truncate text-left text-[13px] font-semibold">{itemLabel}</span>
                      {item.badge ? (
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#052e16", color: ACTIVE }}>
                          {item.badge}
                        </span>
                      ) : isActive ? (
                        <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#052e16" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      ) : null}
                    </>
                  )}
                </button>
              )
            })}
          </div>
        ))}
        {searchQ && filteredGroups.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8" style={{ color: "#4ade80", opacity: 0.5 }}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs">Aucun résultat</p>
          </div>
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-2 border-t hidden lg:block" style={{ borderColor: BG2 }}>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl transition-all text-xs"
          style={{ color: "#4ade80" }}
          onMouseEnter={e => (e.currentTarget.style.background = BG2)}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <svg className={`w-4 h-4 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          {!sidebarCollapsed && <span>Réduire</span>}
        </button>
      </div>

      {/* User footer */}
      <div className="px-2 py-3 border-t" style={{ borderColor: BG2 }}>
        {/* Settings + Logout quick buttons */}
        {!sidebarCollapsed && (
          <div className="flex gap-1 mb-2">
            <button onClick={() => navigate("settings")} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{ color: "#6ee7b7" }}
              onMouseEnter={e => (e.currentTarget.style.background = BG2)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Paramètres
            </button>
            <button onClick={onLogout} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{ color: "#fca5a5" }}
              onMouseEnter={e => { (e.currentTarget.style.background = "#450a0a"); (e.currentTarget.style.color = "#f87171") }}
              onMouseLeave={e => { (e.currentTarget.style.background = "transparent"); (e.currentTarget.style.color = "#fca5a5") }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Déconnexion
            </button>
          </div>
        )}
        <div
          className="w-full flex items-center gap-2.5 rounded-xl transition-colors cursor-pointer"
          style={{ padding: sidebarCollapsed ? "8px" : "8px 12px" }}
          onClick={onOpenProfil}
          onMouseEnter={e => (e.currentTarget.style.background = BG2)}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          role="button" tabIndex={0}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onOpenProfil() }}
        >
          {profilPhoto ? (
            <img src={profilPhoto} alt={user.name} className="w-8 h-8 rounded-full object-cover border-2 shrink-0" style={{ borderColor: ACTIVE }} />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0" style={{ background: ACTIVE, color: "#052e16" }}>
              {user.name[0]?.toUpperCase()}
            </div>
          )}
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate text-white">{user.name}</p>
              <p className="text-[10px] truncate" style={{ color: "#6ee7b7" }}>{ROLE_LABELS[user.role]}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
function TabPill({ id, activeTab, navigate, label }: {
  id: Tab; activeTab: Tab; navigate: (t: Tab) => void; label: string
}) {
  const isActive = activeTab === id
  return (
    <button
      onClick={() => navigate(id)}
      className={[
        "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap",
        isActive
          ? "bg-blue-600 text-white shadow-sm"
          : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-800 border border-slate-200",
      ].join(" ")}
    >
      {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// PROFIL MODAL
// ─────────────────────────────────────────────────────────────

function ProfilModal({ user, profilPhoto, setProfilPhoto, onClose, canUseCamera }: {
  user: User
  profilPhoto: string
  setProfilPhoto: (url: string) => void
  onClose: () => void
  canUseCamera: boolean   // true only for super_admin
}) {
  const PERM_KEYS: (keyof User)[] = [
    "canViewAchat","canViewCommercial","canViewLogistique",
    "canViewStock","canViewCash","canViewFinance","canViewRecap","canViewDatabase",
  ]
  const PERM_MAP: Partial<Record<keyof User, string>> = {
    canViewAchat: "Achats", canViewCommercial: "Commercial",
    canViewLogistique: "Logistique", canViewStock: "Stock",
    canViewCash: "Cash", canViewFinance: "Finance",
    canViewRecap: "Récap", canViewDatabase: "Base données",
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-scale-in">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
          <h2 className="font-bold text-sm text-slate-800">Mon Profil / ملفي الشخصي</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[80vh]">

          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {profilPhoto ? (
                <img src={profilPhoto} alt={user.name}
                  className="w-20 h-20 rounded-full object-cover border-4 border-primary shadow-lg" />
              ) : (
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-white border-4 border-slate-200 shadow-md ${ROLE_COLORS[user.role]}`}>
                  {user.name[0]?.toUpperCase()}
                </div>
              )}
              {canUseCamera ? (
                <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center cursor-pointer shadow border-2 border-card hover:opacity-90 transition-opacity" title="Modifier la photo (super admin)">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = ev => {
                        const url = ev.target?.result as string
                        setProfilPhoto(url)
                        const users = store.getUsers()
                        const idx = users.findIndex(u => u.id === user.id)
                        if (idx >= 0) { users[idx] = { ...users[idx], photoUrl: url }; store.saveUsers(users) }
                      }
                      reader.readAsDataURL(file)
                    }} />
                </label>
              ) : (
                <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-muted border-2 border-card flex items-center justify-center" title="Camera/micro: super admin uniquement">
                  <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-muted/40 border border-border p-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Role</p>
              <span className={`text-xs font-bold px-2 py-1 rounded-full text-white inline-block ${ROLE_COLORS[user.role]}`}>
                {ROLE_LABELS[user.role]}
              </span>
            </div>
            <div className="rounded-xl bg-muted/40 border border-border p-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Accès</p>
              <p className="text-sm font-semibold text-foreground capitalize">{user.accessType ?? "standard"}</p>
            </div>
            {user.secteur && (
              <div className="col-span-2 rounded-xl bg-muted/40 border border-border p-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Secteur</p>
                <p className="text-sm font-semibold text-foreground">{user.secteur}</p>
              </div>
            )}
            <div className="col-span-2 rounded-xl bg-muted/40 border border-border p-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">ID</p>
              <p className="text-xs font-mono text-muted-foreground">{user.id}</p>
            </div>
          </div>

          {/* Permissions */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Permissions</p>
            <div className="flex flex-wrap gap-1.5">
              {PERM_KEYS.filter(k => user[k]).map(k => (
                <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20">
                  {PERM_MAP[k]}
                </span>
              ))}
              {PERM_KEYS.filter(k => user[k]).length === 0 && (
                <span className="text-xs text-muted-foreground">Aucune permission spécifique</span>
              )}
            </div>
          </div>

          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
            style={{ background: "#1a4f2a", color: "white" }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
