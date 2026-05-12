"use client"

import { useState, useEffect, useRef } from "react"
import { store, type EmailConfig, type MotifRetour, type CompanyConfig, type CompanyContacts, type WorkflowConfig, type WorkflowStep, type ContenantTare, DEFAULT_WORKFLOW_STEPS, type ProcessConfig, DEFAULT_PROCESS_CONFIG, type TransportCompany } from "@/lib/store"
import { useRealtimeSync } from "@/lib/supabase/useRealtimeSync"
import { seedDemoData } from "@/lib/seedData"
import { saveEmailJSConfig, getEmailJSConfigPublic, testEmailJSConnection } from "@/lib/email"

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-lg font-bold text-foreground">Acces restreint</p>
        <p className="text-sm text-muted-foreground mt-1">Cette section est reservee aux administrateurs.</p>
        <p className="text-xs text-muted-foreground/70 mt-0.5">هذا القسم للمسؤولين فقط</p>
      </div>
    </div>
  )
}

export default function BOSettings({ user }: { user: { id: string; name: string; role: string } }) {
  // --- ALL hooks MUST come before any conditional return (Rules of Hooks) ---
  const [config, setConfig] = useState<EmailConfig>(() => store.getEmailConfig())
  const [contacts, setContacts] = useState<CompanyContacts>(() => store.getCompanyContacts())
  const [contactsSaved, setContactsSaved] = useState("")
  const { saveCompanyContacts: saveContactsToSupabase } = useRealtimeSync({ tables: ["contacts"] })
  const [motifs, setMotifs] = useState<MotifRetour[]>([])
  const [newMotif, setNewMotif] = useState({ label: "", labelAr: "" })
  const [saved, setSaved] = useState("")
  const [tab, setTab] = useState<"entreprise" | "contacts" | "process" | "workflow" | "emails" | "emailjs" | "motifs" | "contenants" | "dataguard" | "vercel" | "ai_config" | "alertes" | "transporteurs">("entreprise")
  const [transporteurs, setTransporteurs] = useState<TransportCompany[]>([])
  const [editingTransport, setEditingTransport] = useState<TransportCompany | null>(null)
  const [showTransportForm, setShowTransportForm] = useState(false)
  const [transportSaved, setTransportSaved] = useState("")
  const emptyTransport = (): TransportCompany => ({
    id: store.genId(), nom: "", actif: true,
    ice: "", patente: "", rc: "", if_fiscal: "", tp: "", cnss: "",
    telephone: "", email: "", adresse: "", ville: "", contact: "", notes: ""
  })
  const [ejsCfg, setEjsCfg] = useState({ serviceId: "", templateId: "", publicKey: "" })
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [dgMsg, setDgMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const [company, setCompany] = useState<CompanyConfig>(() => store.getCompanyConfig())
  const [workflow, setWorkflow] = useState<WorkflowConfig>(() => {
    const wf = store.getWorkflowConfig()
    if (!wf.steps || wf.steps.length === 0) wf.steps = DEFAULT_WORKFLOW_STEPS
    return wf
  })
  const [contenants, setContenants] = useState<ContenantTare[]>([])
  const [contenantSaved, setContenantSaved] = useState("")
  const [processCfg, setProcessCfg] = useState<ProcessConfig>(() => store.getProcessConfig())
  const [processSaved, setProcessSaved] = useState("")
  const [processSubSteps, setProcessSubSteps] = useState<Record<string, Record<string, boolean>>>(() => store.getProcessSubSteps())
  const [expandedStep, setExpandedStep] = useState<string | null>(null)

  // ── AI Configuration state ──────────────────────────────────────────────────
  const [aiCfg, setAiCfg] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fl_ai_config") ?? "{}") as {
      openaiKey?: string; anthropicKey?: string; geminiKey?: string
      model?: string; systemPrompt?: string
      qcObligatoireBL?: boolean; alerteAchatEnabled?: boolean; alerteVenteEnabled?: boolean
    } } catch { return {} }
  })
  const [aiSaved, setAiSaved] = useState("")
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})

  // ── Alert config state ──────────────────────────────────────────────────────
  const [alertCfg, setAlertCfg] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fl_alert_config") ?? "{}") as {
      paSeuilPct?: number; pvMargeMinPct?: number
      emailDestinataire?: string; alerteAchatEnabled?: boolean; alerteVenteEnabled?: boolean
    } } catch { return {} }
  })
  const [alertSaved, setAlertSaved] = useState("")
  const [seedMsg, setSeedMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [seeding, setSeeding] = useState(false)

  // Access check — computed AFTER hooks
  const canAccess = user.role === "super_super_admin" || user.role === "admin" || user.role === "super_admin"
  const canEditEmails = canAccess

  useEffect(() => {
    if (!canAccess) return
    setConfig(store.getEmailConfig())
    setMotifs(store.getMotifs())
    setCompany(store.getCompanyConfig())
    setWorkflow(store.getWorkflowConfig())
    setContenants(store.getContenantsConfig())
    setProcessCfg(store.getProcessConfig())
    setTransporteurs(store.getTransportCompanies())
    const ejs = getEmailJSConfigPublic()
    setEjsCfg({ serviceId: ejs.serviceId, templateId: ejs.templateId, publicKey: ejs.publicKey })
  }, [canAccess])

  // Guard AFTER hooks — safe conditional render
  if (!canAccess) return <AccessDenied />

  const handleSaveConfig = () => {
    store.saveEmailConfig(config)
    setSaved("Configuration sauvegardée"); setTimeout(() => setSaved(""), 2000)
  }

  const handleAddMotif = () => {
    if (!newMotif.label.trim()) return
    const m: MotifRetour = { id: store.genId(), label: newMotif.label, labelAr: newMotif.labelAr, actif: true }
    const all = [...motifs, m]
    store.saveMotifs(all)
    setMotifs(all)
    setNewMotif({ label: "", labelAr: "" })
  }

  const toggleMotif = (id: string) => {
    const all = motifs.map(m => m.id === id ? { ...m, actif: !m.actif } : m)
    store.saveMotifs(all); setMotifs(all)
  }

  const deleteMotif = (id: string) => {
    const all = motifs.filter(m => m.id !== id)
    store.saveMotifs(all); setMotifs(all)
  }

  // DataGuard helpers
  const handleExport = () => {
    try {
      const snapshot: Record<string, unknown> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k) snapshot[k] = localStorage.getItem(k)
      }
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `freshlink-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setDgMsg({ ok: true, text: "Sauvegarde exportée avec succès." })
      setTimeout(() => setDgMsg(null), 3000)
    } catch (e) {
      setDgMsg({ ok: false, text: "Erreur lors de l'export." })
    }
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (typeof data !== "object" || data === null) throw new Error("Format invalide")
        Object.entries(data).forEach(([k, v]) => {
          if (typeof v === "string") localStorage.setItem(k, v)
        })
        setDgMsg({ ok: true, text: "Données restaurées. Rechargez la page pour voir les changements." })
        setTimeout(() => setDgMsg(null), 5000)
      } catch {
        setDgMsg({ ok: false, text: "Fichier invalide. Vérifiez le format JSON." })
        setTimeout(() => setDgMsg(null), 4000)
      }
    }
    reader.readAsText(file)
    // reset input
    if (importRef.current) importRef.current.value = ""
  }

  const handleSeedDemo = () => {
    setSeeding(true)
    try {
      seedDemoData(store)
      setSeedMsg({ ok: true, text: "Données démo chargées avec succès — 6 clients, 8 articles, 3 fournisseurs, 5 commandes, 3 voyages et plus." })
    } catch {
      setSeedMsg({ ok: false, text: "Erreur lors du chargement des données démo." })
    } finally {
      setSeeding(false)
      setTimeout(() => setSeedMsg(null), 6000)
    }
  }

  const handleClearAll = () => {
    localStorage.clear()
    setShowClearConfirm(false)
    setDgMsg({ ok: true, text: "Toutes les données ont été effacées. Rechargez la page." })
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setCompany(c => ({ ...c, logo: ev.target?.result as string }))
    reader.readAsDataURL(file)
  }

  const handleSaveContacts = async () => {
    store.saveCompanyContacts(contacts)
    await saveContactsToSupabase(contacts)
    setContactsSaved("Coordonnées sauvegardées et synchronisées")
    setTimeout(() => setContactsSaved(""), 3000)
  }

  const TABS = [
    { id: "entreprise" as const,  label: "Entreprise",               labelAr: "معلومات الشركة" },
    { id: "contacts" as const,    label: "Contacts & Coordonnées",    labelAr: "أرقام التواصل والعناوين" },
    { id: "process" as const,     label: "Process",                   labelAr: "اختيار العملية" },
    { id: "workflow" as const,    label: "Validation commandes",      labelAr: "الموافقة على الطلبيات" },
    { id: "emails" as const,      label: "Emails & Notifications",    labelAr: "البريد الإلكتروني" },
    { id: "emailjs" as const,     label: "EmailJS (SMTP)",            labelAr: "إعداد البريد" },
    { id: "motifs" as const,      label: "Motifs retour",             labelAr: "أسباب الإرجاع" },
    { id: "contenants" as const,  label: "Poids contenants",          labelAr: "أوزان الحاويات" },
    { id: "dataguard" as const,   label: "DataGuard",                 labelAr: "حماية البيانات" },
    { id: "vercel" as const,      label: "Deploiement Vercel",        labelAr: "النشر على Vercel" },
    { id: "ai_config" as const,   label: "IA & Modeles",              labelAr: "الذكاء الاصطناعي" },
    { id: "alertes" as const,     label: "Alertes Email",             labelAr: "تنبيهات البريد" },
    { id: "transporteurs" as const, label: "Transporteurs",           labelAr: "شركات النقل" },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Paramètres <span className="text-muted-foreground font-normal text-base mr-1">/ الإعدادات</span></h2>
        <p className="text-sm text-muted-foreground">Configuration des emails, motifs retour et workflows</p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          {saved}
        </div>
      )}

      <div className="flex gap-1 p-1 rounded-xl bg-muted overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* === ENTREPRISE === */}
      {tab === "entreprise" && (
        <div className="flex flex-col gap-5">

          {/* App Identity */}
          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <div>
              <h3 className="font-semibold text-sm">Identité de l&apos;application / هوية التطبيق</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Ces informations s&apos;affichent dans la barre latérale et sur l&apos;écran de connexion.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Nom de l&apos;application</label>
                <input type="text"
                  value={company.appName ?? "FreshLink Pro"}
                  onChange={e => setCompany(c => ({ ...c, appName: e.target.value }))}
                  className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="FreshLink Pro" />
                <p className="text-[10px] text-muted-foreground">Nom principal affiché en haut de la sidebar</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Sous-titre / Slogan</label>
                <input type="text"
                  value={company.appSlogan ?? company.nom ?? "Empire Fresh"}
                  onChange={e => setCompany(c => ({ ...c, appSlogan: e.target.value }))}
                  className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Empire Fresh" />
                <p className="text-[10px] text-muted-foreground">Texte affiché sous le nom de l&apos;application</p>
              </div>
            </div>
          </div>

          {/* Logo + preview */}
          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <div>
              <h3 className="font-semibold text-sm">Logo / الشعار</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Utilisé dans la sidebar, l&apos;écran de connexion et les documents (BL, factures).</p>
            </div>
            <div className="flex items-start gap-6 flex-wrap">
              <div className="flex flex-col items-center gap-3">
                <div className="w-32 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted overflow-hidden">
                  {company.logo
                    ? <img src={company.logo} alt="Logo" className="w-full h-full object-contain" />
                    : <svg className="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  }
                </div>
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <button onClick={() => logoRef.current?.click()}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors font-medium">
                  {company.logo ? "Changer le logo" : "Importer le logo"}
                </button>
                {company.logo && (
                  <button onClick={() => setCompany(c => ({ ...c, logo: undefined }))}
                    className="text-xs text-red-600 hover:underline">Supprimer</button>
                )}
              </div>
              {/* Apercu entete BL */}
              <div className="flex-1 min-w-48">
                <p className="text-xs text-muted-foreground mb-2">Apercu en-tête (BL / Facture)</p>
                <div className="rounded-xl border border-border p-3 text-xs" style={{ borderTopColor: company.couleurEntete, borderTopWidth: 4 }}>
                  <div className="flex items-center gap-3">
                    {company.logo && <img src={company.logo} alt="Logo" className="h-10 object-contain" />}
                    <div>
                      <p className="font-bold text-sm text-foreground">{company.nom || "Nom entreprise"}</p>
                      <p className="text-muted-foreground">{company.adresse}{company.ville ? `, ${company.ville}` : ""}</p>
                      <p className="text-muted-foreground">{company.telephone} — {company.email}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold">Couleur de l&apos;en-tête</label>
              <div className="flex items-center gap-3">
                <input type="color" value={company.couleurEntete || "#1e3a5f"}
                  onChange={e => setCompany(c => ({ ...c, couleurEntete: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                <span className="text-xs font-mono text-muted-foreground">{company.couleurEntete || "#1e3a5f"}</span>
              </div>
            </div>
          </div>

          {/* Informations générales */}
          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <h3 className="font-semibold text-sm">Informations générales / المعلومات العامة</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { f: "nom", label: "Raison sociale / الاسم التجاري", placeholder: "FreshLink Maroc" },
                { f: "telephone", label: "Téléphone", placeholder: "0522 000 000" },
                { f: "email", label: "Email", placeholder: "contact@freshlink.ma" },
                { f: "siteWeb", label: "Site web (optionnel)", placeholder: "www.freshlink.ma" },
              ].map(({ f, label, placeholder }) => (
                <div key={f} className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-foreground">{label}</label>
                  <input type="text" value={(company as unknown as Record<string,string>)[f] || ""}
                    onChange={e => setCompany(c => ({ ...c, [f]: e.target.value }))}
                    className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={placeholder} />
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Adresse</label>
                <input type="text" value={company.adresse || ""}
                  onChange={e => setCompany(c => ({ ...c, adresse: e.target.value }))}
                  className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Bd Anfa, Quartier Gauthier" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Ville / المدينة</label>
                <input type="text" value={company.ville || "Casablanca"}
                  onChange={e => setCompany(c => ({ ...c, ville: e.target.value }))}
                  className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Casablanca" />
              </div>
            </div>
          </div>

          {/* Données fiscales Maroc */}
          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <h3 className="font-semibold text-sm">Données fiscales Maroc / البيانات الجبائية</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { f: "ice", label: "ICE (20 chiffres)", placeholder: "00000000000000000000" },
                { f: "rc", label: "RC (Registre de commerce)", placeholder: "123456" },
                { f: "if_fiscal", label: "IF (Identifiant fiscal)", placeholder: "12345678" },
                { f: "tp", label: "TP (Taxe professionnelle)", placeholder: "12345678" },
                { f: "cnss", label: "CNSS", placeholder: "1234567" },
              ].map(({ f, label, placeholder }) => (
                <div key={f} className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-foreground">{label}</label>
                  <input type="text" value={(company as unknown as Record<string,string>)[f] || ""}
                    onChange={e => setCompany(c => ({ ...c, [f]: e.target.value }))}
                    className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={placeholder} />
                </div>
              ))}
            </div>
          </div>

          {/* Mentions BL / Facture */}
          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <h3 className="font-semibold text-sm">Mentions sur les documents / ملاحظات على الوثائق</h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold">Mentions BL</label>
                <textarea rows={2} value={company.mentionsBL || ""}
                  onChange={e => setCompany(c => ({ ...c, mentionsBL: e.target.value }))}
                  className="px-3 py-2.5 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="Marchandises voyagent aux risques et périls du destinataire..." />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold">Mentions Facture</label>
                <textarea rows={2} value={company.mentionsFacture || ""}
                  onChange={e => setCompany(c => ({ ...c, mentionsFacture: e.target.value }))}
                  className="px-3 py-2.5 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="Pénalité de retard: 1,5% par mois. Escompte si paiement avant échéance: 2%..." />
              </div>
            </div>
          </div>

          <button onClick={() => { store.saveCompanyConfig(company); setSaved("Entreprise sauvegardée"); setTimeout(() => setSaved(""), 2500) }}
            className="self-start flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "oklch(0.38 0.2 260)" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Sauvegarder les informations entreprise
          </button>
        </div>
      )}

      {/* === CONTACTS & COORDONNÉES === */}
      {tab === "contacts" && (
        <div className="flex flex-col gap-6">
          {contactsSaved && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              {contactsSaved}
            </div>
          )}

          {/* Téléphones */}
          <div className="bg-white border border-border rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              </div>
              <div>
                <p className="font-bold text-foreground">Téléphones</p>
                <p className="text-xs text-muted-foreground">Numéros affichés sur le site et documents</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {([
                { key: "tel_principal", label: "Tél. principal", placeholder: "+212 6XX XXX XXX" },
                { key: "tel_secondaire", label: "Tél. secondaire", placeholder: "+212 5XX XXX XXX" },
                { key: "tel_urgence", label: "Tél. urgences", placeholder: "+212 6XX XXX XXX" },
              ] as { key: keyof CompanyContacts; label: string; placeholder: string }[]).map(f => (
                <div key={f.key} className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{f.label}</label>
                  <input
                    type="tel"
                    value={(contacts[f.key] as string) ?? ""}
                    onChange={e => setContacts(c => ({ ...c, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* WhatsApp */}
          <div className="bg-white border border-border rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <div>
                <p className="font-bold text-foreground">WhatsApp</p>
                <p className="text-xs text-muted-foreground">Numéros WhatsApp Business par canal</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {([
                { key: "whatsapp_principal",  label: "Commandes clients",   placeholder: "+212 6XX XXX XXX" },
                { key: "whatsapp_commercial", label: "Équipe commerciale",   placeholder: "+212 6XX XXX XXX" },
                { key: "whatsapp_livraison",  label: "Suivi livraisons",     placeholder: "+212 6XX XXX XXX" },
              ] as { key: keyof CompanyContacts; label: string; placeholder: string }[]).map(f => (
                <div key={f.key} className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{f.label}</label>
                  <input
                    type="tel"
                    value={(contacts[f.key] as string) ?? ""}
                    onChange={e => setContacts(c => ({ ...c, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Emails */}
          <div className="bg-white border border-border rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <div>
                <p className="font-bold text-foreground">Adresses Email</p>
                <p className="text-xs text-muted-foreground">Emails affichés sur le site et documents</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { key: "email_principal",     label: "Email principal",         placeholder: "contact@empire-fresh.co.site" },
                { key: "email_commercial",    label: "Email commercial",        placeholder: "commercial@empire-fresh.co.site" },
                { key: "email_comptabilite",  label: "Email comptabilité",      placeholder: "compta@empire-fresh.co.site" },
                { key: "email_rh",            label: "Email RH",                placeholder: "rh@empire-fresh.co.site" },
              ] as { key: keyof CompanyContacts; label: string; placeholder: string }[]).map(f => (
                <div key={f.key} className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{f.label}</label>
                  <input
                    type="email"
                    value={(contacts[f.key] as string) ?? ""}
                    onChange={e => setContacts(c => ({ ...c, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Adresse postale */}
          <div className="bg-white border border-border rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <div>
                <p className="font-bold text-foreground">Adresse Postale</p>
                <p className="text-xs text-muted-foreground">Adresse du siège social / entrepôt principal</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Adresse ligne 1</label>
                <input value={contacts.adresse_ligne1 ?? ""} onChange={e => setContacts(c => ({ ...c, adresse_ligne1: e.target.value }))} placeholder="N° de rue, nom de rue" className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Adresse ligne 2</label>
                <input value={contacts.adresse_ligne2 ?? ""} onChange={e => setContacts(c => ({ ...c, adresse_ligne2: e.target.value }))} placeholder="Quartier, résidence, étage…" className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Code postal</label>
                  <input value={contacts.code_postal ?? ""} onChange={e => setContacts(c => ({ ...c, code_postal: e.target.value }))} placeholder="20000" className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ville</label>
                  <input value={contacts.ville ?? ""} onChange={e => setContacts(c => ({ ...c, ville: e.target.value }))} placeholder="Casablanca" className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pays</label>
                  <input value={contacts.pays ?? ""} onChange={e => setContacts(c => ({ ...c, pays: e.target.value }))} placeholder="Maroc" className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm" />
                </div>
              </div>
            </div>
          </div>

          {/* Réseaux sociaux */}
          <div className="bg-white border border-border rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
              </div>
              <div>
                <p className="font-bold text-foreground">Réseaux Sociaux</p>
                <p className="text-xs text-muted-foreground">Liens affichés sur le site web client</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {([
                { key: "instagram", label: "Instagram", placeholder: "@empire.fresh" },
                { key: "facebook",  label: "Facebook",  placeholder: "facebook.com/empirefresh" },
                { key: "linkedin",  label: "LinkedIn",   placeholder: "linkedin.com/in/empirefresh" },
                { key: "tiktok",    label: "TikTok",    placeholder: "@empirefresh" },
              ] as { key: keyof CompanyContacts; label: string; placeholder: string }[]).map(f => (
                <div key={f.key} className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{f.label}</label>
                  <input
                    type="text"
                    value={(contacts[f.key] as string) ?? ""}
                    onChange={e => setContacts(c => ({ ...c, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Horaires & Zone */}
          <div className="bg-white border border-border rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <p className="font-bold text-foreground">Horaires & Zone de livraison</p>
                <p className="text-xs text-muted-foreground">Affichés sur le site et le chatbot WhatsApp</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Horaires ouverture</label>
                <input value={contacts.horaires_ouverture ?? ""} onChange={e => setContacts(c => ({ ...c, horaires_ouverture: e.target.value }))} placeholder="Lun-Sam : 06h00 - 20h00" className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Horaires livraison</label>
                <input value={contacts.horaires_livraison ?? ""} onChange={e => setContacts(c => ({ ...c, horaires_livraison: e.target.value }))} placeholder="Lun-Sam : 07h00 - 18h00" className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zone couverte</label>
                <input value={contacts.zone_livraison ?? ""} onChange={e => setContacts(c => ({ ...c, zone_livraison: e.target.value }))} placeholder="Casablanca et région" className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm" />
              </div>
            </div>
          </div>

          {/* Bouton Sauvegarder */}
          <div className="flex justify-end">
            <button onClick={handleSaveContacts} className="px-6 py-3 rounded-2xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              Sauvegarder & Synchroniser
            </button>
          </div>
        </div>
      )}

      {/* === PROCESS CONFIG === */}
      {tab === "process" && (
        <div className="flex flex-col gap-5">
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-2xl p-5 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-slate-900 text-base">Choix du Process Operationnel</p>
                <p className="text-xs text-teal-700">Selectionnez le mode de fonctionnement adapte a votre organisation</p>
              </div>
            </div>
          </div>

          {/* Mode selector */}
          <div className="bg-card rounded-2xl border border-border p-5 flex flex-col gap-4">
            <h3 className="font-bold text-sm text-slate-900">Mode operationnel / نمط التشغيل</h3>
            <div className="flex flex-col gap-3">
              {([
                {
                  mode: "prevendeur_direct" as const,
                  label: "Prevendeur Direct",
                  labelAr: "البائع المتجول — مباشر",
                  desc: "Le prevendeur saisit la commande qui est directement validee. Pas de validation logistique requise. Ideal pour les petites equipes.",
                  icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
                  color: "border-green-300 bg-green-50",
                  dot: "bg-green-500",
                },
                {
                  mode: "prevendeur_logistique" as const,
                  label: "Prevendeur + Logistique",
                  labelAr: "البائع + اللوجستيك",
                  desc: "Le prevendeur saisit la commande. La logistique valide, prepare et imprime le BL avant livraison. Mode recommande.",
                  icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
                  color: "border-blue-300 bg-blue-50",
                  dot: "bg-blue-500",
                },
                {
                  mode: "commercial_classique" as const,
                  label: "Commercial Classique",
                  labelAr: "التجاري الكلاسيكي",
                  desc: "Commercial saisit, Responsable Commercial approuve, puis Logistique prepare. Controle a deux niveaux.",
                  icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
                  color: "border-violet-300 bg-violet-50",
                  dot: "bg-violet-600",
                },
                {
                  mode: "full_process" as const,
                  label: "Processus Complet (BPM)",
                  labelAr: "العملية الكاملة",
                  desc: "Processus BPM complet: Commande → Achat → Reception → Preparation → Controle Qualite → Livraison → Encaissement. Pour les grandes structures.",
                  icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
                  color: "border-amber-300 bg-amber-50",
                  dot: "bg-amber-500",
                },
              ] as { mode: ProcessConfig["mode"]; label: string; labelAr: string; desc: string; icon: string; color: string; dot: string }[]).map(opt => (
                <label key={opt.mode}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${processCfg.mode === opt.mode ? opt.color : "border-border bg-background hover:bg-muted/30"}`}
                  onClick={() => setProcessCfg(p => ({
                    ...p,
                    mode: opt.mode,
                    // Auto-configure modules based on mode
                    enableAchat: opt.mode !== "prevendeur_direct",
                    enableReception: opt.mode === "commercial_classique" || opt.mode === "full_process",
                    enablePreparation: opt.mode !== "prevendeur_direct",
                    enableLogistiqueValidation: opt.mode !== "prevendeur_direct",
                    enableBLPrint: opt.mode !== "prevendeur_direct",
                    enableTripDispatch: opt.mode !== "prevendeur_direct",
                    enableQualiteControle: opt.mode === "full_process",
                  }))}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${processCfg.mode === opt.mode ? "border-transparent" : "border-slate-300"}`}>
                    {processCfg.mode === opt.mode && <div className={`w-2 h-2 rounded-full ${opt.dot}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm text-slate-900">{opt.label}</p>
                      {processCfg.mode === opt.mode && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-300">Actif</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed" dir="rtl">{opt.labelAr}</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Module toggles */}
          <div className="bg-card rounded-2xl border border-border p-5 flex flex-col gap-4">
            <h3 className="font-bold text-sm text-slate-900">Modules actifs / الوحدات النشطة</h3>
            <div className="flex flex-col gap-3">
              {([
                { key: "enableAchat" as const,               label: "Module Achat",                desc: "Permet aux acheteurs de saisir des bons d'achat" },
                { key: "enableReception" as const,           label: "Reception marchandise",       desc: "Magasinier enregistre la reception physique" },
                { key: "enablePreparation" as const,         label: "Preparation commandes",       desc: "Equipe de preparation traite les commandes validees" },
                { key: "enableLogistiqueValidation" as const, label: "Validation Logistique",      desc: "Logistique doit valider avant livraison" },
                { key: "enableBLPrint" as const,             label: "Impression BL",               desc: "Bon de livraison imprime a chaque livraison" },
                { key: "enableTripDispatch" as const,        label: "Dispatch tournees",           desc: "Dispatching des tournees de livraison" },
                { key: "enableCaisse" as const,              label: "Module Caisse",               desc: "Suivi encaissements et mouvements de caisse" },
                { key: "enableQualiteControle" as const,     label: "Controle Qualite (QC)",       desc: "Porte qualite avec controle a chaque etape" },
                { key: "enableControlAchat" as const,        label: "Controle Achat",              desc: "Ctrl achat scanne et verifie la marchandise achetee avant entree en stock" },
                { key: "enableControlPreparation" as const,  label: "Controle Preparation",        desc: "Ctrl prep verifie les colis prepares avant chargement dans le camion" },
                { key: "enableControlExpedition" as const,   label: "Controle Expedition",         desc: "Ctrl expedition valide le chargement final avant le depart du camion" },
                { key: "enableDispatchCommandes" as const,   label: "Dispatch Commandes",          desc: "Le dispatcheur affecte les commandes aux trips de livraison" },
              ] as { key: keyof ProcessConfig; label: string; desc: string }[]).map(item => (
                <div key={item.key} className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => setProcessCfg(p => ({ ...p, [item.key]: !p[item.key as keyof ProcessConfig] }))}
                    className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer shrink-0 mt-0.5 ${processCfg[item.key] ? "bg-teal-500" : "bg-slate-200"}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${processCfg[item.key] ? "left-5" : "left-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Détails par étape — sub-options per step ── */}
          {(() => {
            const STEP_DETAILS: {
              key: keyof ProcessConfig
              stepId: string
              label: string
              labelAr: string
              color: string
              icon: string
              subOptions: { id: string; label: string; labelAr: string; desc: string; risk?: "high" | "medium" }[]
            }[] = [
              {
                key: "enableAchat", stepId: "achat", label: "Achat Marché", labelAr: "الشراء",
                color: "border-amber-300 bg-amber-50",
                icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
                subOptions: [
                  { id: "requireGPS",          label: "GPS obligatoire",              labelAr: "GPS إلزامي",           desc: "L'acheteur doit partager sa position GPS lors de l'achat" },
                  { id: "requirePhoto",         label: "Photo marchandise obligatoire",labelAr: "صورة إلزامية",          desc: "Une photo des produits achetés doit être jointe au bon d'achat" },
                  { id: "requireValidation",    label: "Validation manager avant entrée stock", labelAr: "تأكيد المدير",  desc: "Un manager doit approuver le bon d'achat avant mise à jour du stock" },
                  { id: "requireFournisseur",   label: "Fournisseur obligatoire",      labelAr: "المورد إلزامي",         desc: "Le fournisseur doit être sélectionné depuis la liste officielle" },
                  { id: "limitMontant",         label: "Plafonner le montant par achat",labelAr: "سقف مبلغ الشراء",     desc: "Bloquer si le montant total dépasse un seuil défini", risk: "medium" },
                ],
              },
              {
                key: "enableReception", stepId: "reception", label: "Réception Marchandise", labelAr: "الاستلام",
                color: "border-sky-300 bg-sky-50",
                icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
                subOptions: [
                  { id: "requirePhotoReception", label: "Photo réception obligatoire", labelAr: "صورة الاستلام",        desc: "Photo de la marchandise reçue obligatoire avant validation" },
                  { id: "requirePesee",           label: "Pesée obligatoire",          labelAr: "الوزن إلزامي",          desc: "Saisir le poids exact reçu pour vérification avec bon d'achat" },
                  { id: "autoStock",              label: "Mise à jour stock automatique",labelAr: "تحديث تلقائي للمخزون", desc: "Le stock est mis à jour dès la validation de la réception" },
                  { id: "requireQC",              label: "Contrôle qualité à la réception",labelAr: "مراقبة الجودة",     desc: "Un contrôleur QC doit valider la qualité avant entrée en stock" },
                  { id: "requireSignatureMag",    label: "Signature magasinier",        labelAr: "توقيع أمين المخزن",    desc: "Le magasinier doit confirmer la réception avec sa signature" },
                ],
              },
              {
                key: "enablePreparation", stepId: "preparation", label: "Préparation Commandes", labelAr: "التحضير",
                color: "border-violet-300 bg-violet-50",
                icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
                subOptions: [
                  { id: "requirePrintBP",         label: "Impression bon de préparation",labelAr: "طباعة وصل التحضير",   desc: "Le bon de préparation doit être imprimé avant de commencer" },
                  { id: "requireScan",            label: "Scan articles obligatoire",   labelAr: "مسح المواد",           desc: "Chaque article doit être scanné (barcode/QR) lors de la prépa" },
                  { id: "requirePhotoColisP",     label: "Photo colis préparé",         labelAr: "صورة الطرد",           desc: "Photo du colis final obligatoire avant chargement" },
                  { id: "requireSignaturePrep",   label: "Signature préparateur",       labelAr: "توقيع المعبّأ",         desc: "Le préparateur doit signer le bon de préparation" },
                  { id: "requireWeightCheck",     label: "Vérification poids colis",    labelAr: "التحقق من وزن الطرد",  desc: "Peser chaque colis et comparer au poids théorique de la commande" },
                ],
              },
              {
                key: "enableTripDispatch", stepId: "dispatch", label: "Dispatch & Tournées", labelAr: "التوزيع",
                color: "border-cyan-300 bg-cyan-50",
                icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
                subOptions: [
                  { id: "requireGPSDepart",       label: "GPS départ obligatoire",      labelAr: "GPS الانطلاق",          desc: "Le livreur doit partager sa position GPS avant le départ" },
                  { id: "requireVerifCharge",     label: "Vérification charge camion",  labelAr: "تحقق من حمولة الشاحنة", desc: "Valider que le camion n'est pas surchargé avant départ" },
                  { id: "requireListeClients",    label: "Liste clients validée",       labelAr: "قائمة العملاء مؤكدة",  desc: "Le dispatch doit confirmer la liste des clients de la tournée" },
                  { id: "autoNotifyClients",      label: "Notification clients auto",   labelAr: "إشعار تلقائي للعملاء", desc: "Envoyer un WhatsApp automatique aux clients lors du départ du livreur" },
                ],
              },
              {
                key: "enableLogistiqueValidation", stepId: "livraison", label: "Livraison Client", labelAr: "التسليم",
                color: "border-emerald-300 bg-emerald-50",
                icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
                subOptions: [
                  { id: "requireSignatureClient", label: "Signature client obligatoire", labelAr: "توقيع العميل إلزامي",  desc: "Le client doit signer électroniquement ou sur papier à la livraison" },
                  { id: "requirePhotoLivraison",  label: "Photo preuve de livraison",   labelAr: "صورة إثبات التسليم",    desc: "Une photo de la livraison effectuée doit être capturée" },
                  { id: "requireGPSLivraison",    label: "GPS confirmation livraison",  labelAr: "GPS تأكيد التسليم",     desc: "La position GPS est enregistrée au moment de la livraison" },
                  { id: "allowPartial",           label: "Livraison partielle autorisée",labelAr: "تسليم جزئي مسموح",     desc: "Le livreur peut livrer une quantité partielle et noter le reste" },
                  { id: "requireCodeConfirm",     label: "Code de confirmation client", labelAr: "رمز تأكيد العميل",      desc: "Le client reçoit un code SMS/WhatsApp à donner au livreur", risk: "medium" },
                ],
              },
              {
                key: "enableCaisse", stepId: "caisse", label: "Caisse & Encaissement", labelAr: "الصندوق",
                color: "border-rose-300 bg-rose-50",
                icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
                subOptions: [
                  { id: "requirePhotoRecu",       label: "Photo reçu de paiement",      labelAr: "صورة إيصال الدفع",     desc: "Photo de l'argent remis ou du virement doit être jointe" },
                  { id: "requireValidationMgr",   label: "Validation manager caisse",   labelAr: "تأكيد المدير للصندوق", desc: "Un manager doit valider chaque encaissement au-delà du seuil" },
                  { id: "autoRapprochement",      label: "Rapprochement automatique",   labelAr: "تسوية تلقائية",        desc: "Comparer automatiquement cash reçu vs montant BL attendu" },
                  { id: "limitCashSansValid",     label: "Plafond cash sans validation",labelAr: "سقف النقد بدون تأكيد", desc: "Au-dessus de ce montant, validation manager obligatoire", risk: "high" },
                ],
              },
            ]

            const activeSteps = STEP_DETAILS.filter(s => processCfg[s.key])

            const toggleSubStep = (stepId: string, optId: string) => {
              setProcessSubSteps(prev => ({
                ...prev,
                [stepId]: { ...(prev[stepId] ?? {}), [optId]: !((prev[stepId] ?? {})[optId]) },
              }))
            }

            if (activeSteps.length === 0) return null

            return (
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center gap-3 bg-gradient-to-r from-teal-50 to-cyan-50">
                  <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Configuration détaillée par étape</h3>
                    <p className="text-xs text-teal-700">Activez ou désactivez les sous-options de chaque étape du process</p>
                  </div>
                </div>

                {/* Visual flow + per-step config */}
                <div className="divide-y divide-border">
                  {activeSteps.map((step, idx) => {
                    const isExpanded = expandedStep === step.stepId
                    const stepSub = processSubSteps[step.stepId] ?? {}
                    const activeCount = step.subOptions.filter(o => stepSub[o.id]).length
                    return (
                      <div key={step.stepId}>
                        {/* Step header */}
                        <button
                          type="button"
                          onClick={() => setExpandedStep(isExpanded ? null : step.stepId)}
                          className={`w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors text-left`}>
                          {/* Step number */}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 border-2 ${step.color}`}>
                            {idx + 1}
                          </div>
                          <svg className="w-4 h-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={step.icon} />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-800">{step.label}</span>
                              <span className="text-[10px] text-slate-400" dir="rtl">{step.labelAr}</span>
                            </div>
                            <p className="text-xs text-slate-500">
                              {activeCount > 0
                                ? `${activeCount}/${step.subOptions.length} options activées`
                                : `${step.subOptions.length} options disponibles`}
                            </p>
                          </div>
                          {activeCount > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200 shrink-0">
                              {activeCount} actif{activeCount > 1 ? "s" : ""}
                            </span>
                          )}
                          <svg className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Sub-options */}
                        {isExpanded && (
                          <div className={`px-5 pb-4 pt-1 ${step.color.includes("amber") ? "bg-amber-50/40" : step.color.includes("sky") ? "bg-sky-50/40" : step.color.includes("violet") ? "bg-violet-50/40" : step.color.includes("cyan") ? "bg-cyan-50/40" : step.color.includes("emerald") ? "bg-emerald-50/40" : "bg-rose-50/40"}`}>
                            <div className="flex flex-col gap-2 pl-10">
                              {step.subOptions.map(opt => {
                                const isOn = !!stepSub[opt.id]
                                return (
                                  <div key={opt.id} className="flex items-start gap-3 py-2 border-b border-white/60 last:border-0">
                                    <button
                                      type="button"
                                      onClick={() => toggleSubStep(step.stepId, opt.id)}
                                      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 mt-0.5 ${isOn ? "bg-teal-500" : "bg-slate-200"}`}>
                                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isOn ? "left-4" : "left-0.5"}`} />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className={`text-sm font-semibold ${isOn ? "text-slate-900" : "text-slate-500"}`}>{opt.label}</p>
                                        {opt.risk === "high" && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">⚠ CRITIQUE</span>
                                        )}
                                        {opt.risk === "medium" && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">⚠ ATTENTION</span>
                                        )}
                                      </div>
                                      <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                                      <p className="text-[10px] text-slate-400" dir="rtl">{opt.labelAr}</p>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${isOn ? "bg-teal-100 text-teal-700 border border-teal-200" : "bg-slate-100 text-slate-400 border border-slate-200"}`}>
                                      {isOn ? "ON" : "OFF"}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Notes */}
          <div className="bg-card rounded-2xl border border-border p-5 flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-800">Notes / ملاحظات</label>
            <textarea
              rows={2}
              value={processCfg.notes ?? ""}
              onChange={e => setProcessCfg(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Notes sur la configuration du process..."
            />
          </div>

          {processSaved && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              {processSaved}
            </div>
          )}

          <button
            onClick={() => {
              store.saveProcessConfig(processCfg)
              store.saveProcessSubSteps(processSubSteps)
              setProcessSaved("Process + sous-étapes sauvegardés")
              setTimeout(() => setProcessSaved(""), 2500)
            }}
            className="self-start flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: "oklch(0.45 0.18 185)" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Sauvegarder le process
          </button>
        </div>
      )}

      {/* === BPM WORKFLOW MANAGER === */}
      {tab === "workflow" && (
        <div className="flex flex-col gap-5">
          {/* Header */}
          <div className="flex flex-col gap-1 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-slate-900 text-base">Gestionnaire de Workflow BPM</p>
                <p className="text-xs text-blue-700">Activez, desactivez ou contournez chaque etape du processus logistique</p>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-1 leading-relaxed">
              Les etapes <strong>obligatoires</strong> ne peuvent pas etre desactivees. Les <strong>Portes qualite</strong> peuvent etre contournees (bypass) sans etre desactivees.
            </p>
          </div>

          {/* Validation commande (existing) */}
          <div className="bg-card rounded-2xl border border-border p-5 flex flex-col gap-3">
            <h3 className="font-bold text-sm text-slate-900">Mode de validation des commandes / نمط المصادقة</h3>
            <div className="flex flex-col gap-2">
              {[
                { v: "direct" as const, label: "Validation directe", desc: "Commande auto-validee des la saisie du prevendeur. Aucune approbation requise.", color: "border-green-300 bg-green-50", dot: "bg-green-500" },
                { v: "responsable" as const, label: "Approbation Responsable Commercial", desc: "Commande en attente jusqu'a validation du Responsable Commercial ou Admin.", color: "border-blue-300 bg-blue-50", dot: "bg-blue-500" },
                { v: "admin" as const, label: "Approbation Admin uniquement", desc: "Seuls Admin et Super Admin peuvent valider. Niveau de controle maximal.", color: "border-violet-300 bg-violet-50", dot: "bg-violet-600" },
              ].map(opt => (
                <label key={opt.v} className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${workflow.validationCommande === opt.v ? opt.color : "border-border bg-background hover:bg-muted/30"}`}>
                  <input type="radio" name="workflowval" className="hidden" checked={workflow.validationCommande === opt.v}
                    onChange={() => setWorkflow(prev => ({ ...prev, validationCommande: opt.v }))} />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${workflow.validationCommande === opt.v ? "border-transparent" : "border-slate-300"}`}>
                    {workflow.validationCommande === opt.v && <div className={`w-2 h-2 rounded-full ${opt.dot}`} />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{opt.label}</p>
                    <p className="text-xs text-slate-500">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* BPM Steps */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Etapes du processus (BPM)</h3>
                <p className="text-xs text-slate-500 mt-0.5">9 etapes de la commande a l&apos;encaissement</p>
              </div>
              <button
                onClick={() => setWorkflow(prev => ({
                  ...prev,
                  steps: (prev.steps ?? DEFAULT_WORKFLOW_STEPS).map(s => s.mandatory ? s : { ...s, enabled: true, bypassed: false })
                }))}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors">
                Tout activer
              </button>
            </div>
            <div className="divide-y divide-border">
              {(workflow.steps ?? DEFAULT_WORKFLOW_STEPS).map((step, idx) => (
                <div key={step.id} className={`flex items-start gap-4 px-5 py-4 transition-colors ${!step.enabled && !step.mandatory ? "bg-slate-50/50 opacity-60" : "bg-background"}`}>
                  {/* Step number */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 mt-0.5 ${
                    step.mandatory ? "bg-slate-900 text-white" :
                    step.gate ? "bg-amber-100 text-amber-800 border border-amber-300" :
                    step.enabled ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-400"
                  }`}>
                    {idx + 1}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm text-slate-900">{step.label}</p>
                      {step.mandatory && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white">Obligatoire</span>
                      )}
                      {step.gate && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">Porte qualite</span>
                      )}
                      {step.bypassed && step.enabled && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-300">Contourne</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{step.description}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5" dir="rtl">{step.labelAr}</p>
                  </div>
                  {/* Controls */}
                  <div className="flex flex-col gap-2 items-end shrink-0">
                    {/* Enable/Disable toggle */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">
                        {step.enabled ? "Actif" : "Desactive"}
                      </span>
                      <button
                        disabled={step.mandatory}
                        onClick={() => setWorkflow(prev => ({
                          ...prev,
                          steps: (prev.steps ?? DEFAULT_WORKFLOW_STEPS).map(s =>
                            s.id === step.id ? { ...s, enabled: !s.enabled } : s
                          )
                        }))}
                        className={`relative w-10 h-6 rounded-full transition-colors ${step.mandatory ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${step.enabled ? "bg-emerald-500" : "bg-slate-200"}`}
                        title={step.mandatory ? "Etape obligatoire — ne peut pas etre desactivee" : undefined}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${step.enabled ? "left-5" : "left-1"}`} />
                      </button>
                    </div>
                    {/* Bypass toggle — only for gate steps when enabled */}
                    {step.canBypass && step.enabled && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-orange-600 font-medium">Bypass</span>
                        <button
                          onClick={() => setWorkflow(prev => ({
                            ...prev,
                            steps: (prev.steps ?? DEFAULT_WORKFLOW_STEPS).map(s =>
                              s.id === step.id ? { ...s, bypassed: !s.bypassed } : s
                            )
                          }))}
                          className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${step.bypassed ? "bg-orange-400" : "bg-slate-200"}`}>
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${step.bypassed ? "left-5" : "left-1"}`} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-700 mb-2">Resume du workflow actuel</p>
            <div className="flex flex-wrap gap-1.5">
              {(workflow.steps ?? DEFAULT_WORKFLOW_STEPS).map((step, idx) => (
                <div key={step.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                  !step.enabled && !step.mandatory ? "bg-slate-100 text-slate-400 border-slate-200 line-through" :
                  step.bypassed ? "bg-orange-100 text-orange-700 border-orange-300" :
                  step.mandatory ? "bg-slate-900 text-white border-slate-900" :
                  "bg-blue-100 text-blue-800 border-blue-200"
                }`}>
                  <span>{idx + 1}</span>
                  <span>{step.label.split(" ")[0]}</span>
                  {step.bypassed && <span>(bypass)</span>}
                  {!step.enabled && !step.mandatory && <span>(skip)</span>}
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => { store.saveWorkflowConfig(workflow); setSaved("Workflow BPM sauvegarde"); setTimeout(() => setSaved(""), 2500) }}
            className="self-start flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: "oklch(0.38 0.2 260)" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Sauvegarder le workflow BPM
          </button>
        </div>
      )}

      {/* Email config */}
      {tab === "emails" && (
        <div className="flex flex-col gap-4">
          {/* Lock notice for non-admin */}
          {!canEditEmails && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>
                <strong>Acces restreint</strong> — La modification des adresses email de notification est reservee aux <strong>Admin</strong> et <strong>Super Admin</strong> uniquement.
              </span>
            </div>
          )}

          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-sm">Adresses email de notification / عناوين الإشعار</h3>
              {canEditEmails && (
                <span className="text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5 font-semibold">Modifiable</span>
              )}
              {!canEditEmails && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted border border-border rounded-full px-2.5 py-0.5">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Lecture seule
                </span>
              )}
            </div>
            {[
              { key: "achat" as keyof EmailConfig, label: "Email achat / الشراء", placeholder: "acheteur@freshlink.ma" },
              { key: "commercial" as keyof EmailConfig, label: "Email commercial / التجاري", placeholder: "commercial@freshlink.ma" },
              { key: "recap" as keyof EmailConfig, label: "Email recap journalier / الملخص اليومي", placeholder: "admin@freshlink.ma" },
              { key: "besoinAchat" as keyof EmailConfig, label: "Email besoin d'achat / احتياج الشراء", placeholder: "acheteur@freshlink.ma" },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">{label}</label>
                {canEditEmails ? (
                  <input type="email" value={config[key] as string}
                    onChange={e => setConfig({ ...config, [key]: e.target.value })}
                    className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={placeholder} />
                ) : (
                  <div className="px-3 py-2.5 rounded-xl border border-border bg-muted text-sm text-muted-foreground font-mono select-none">
                    {(config[key] as string) || <span className="italic text-muted-foreground/60">{placeholder}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <h3 className="font-semibold text-foreground text-sm">Envoi automatique du récap / الإرسال التلقائي</h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`relative w-11 h-6 rounded-full transition-colors ${config.recapAuto ? "bg-indigo-600" : "bg-muted"}`}
                onClick={() => setConfig({ ...config, recapAuto: !config.recapAuto })}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.recapAuto ? "translate-x-6" : "translate-x-1"}`} />
              </div>
              <span className="text-sm font-medium text-foreground">Récap journalier automatique</span>
            </label>
            {config.recapAuto && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Heure d&apos;envoi</label>
                <input type="time" value={config.recapHeure} onChange={e => setConfig({ ...config, recapHeure: e.target.value })}
                  className="w-32 px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            )}

            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`relative w-11 h-6 rounded-full transition-colors ${config.besoinAuto ? "bg-indigo-600" : "bg-muted"}`}
                onClick={() => setConfig({ ...config, besoinAuto: !config.besoinAuto })}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.besoinAuto ? "translate-x-6" : "translate-x-1"}`} />
              </div>
              <span className="text-sm font-medium text-foreground">Besoin d&apos;achat automatique (email)</span>
            </label>
            {config.besoinAuto && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Heure d&apos;envoi besoin achat</label>
                <input type="time" value={config.besoinHeure} onChange={e => setConfig({ ...config, besoinHeure: e.target.value })}
                  className="w-32 px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            )}
          </div>

          {/* Besoin push mobile acheteur */}
          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <div>
              <h3 className="font-semibold text-foreground text-sm">Notification besoin d&apos;achat — Acheteur mobile</h3>
              <p className="text-xs text-muted-foreground mt-1">Quand une commande est validee, le besoin par SKU est recalcule et envoye automatiquement a l&apos;acheteur sur son mobile apres le delai configure.</p>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`relative w-11 h-6 rounded-full transition-colors ${config.besoinPushAuto ? "bg-blue-600" : "bg-muted"}`}
                onClick={() => canEditEmails && setConfig({ ...config, besoinPushAuto: !config.besoinPushAuto })}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.besoinPushAuto ? "translate-x-6" : "translate-x-1"}`} />
              </div>
              <div>
                <span className="text-sm font-medium text-foreground">Push automatique vers l&apos;acheteur</span>
                <p className="text-xs text-muted-foreground">Le besoin SKU apparait automatiquement sur le mobile de l&apos;acheteur</p>
              </div>
            </label>

            {config.besoinPushAuto && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-foreground">Delai avant notification sur mobile acheteur (minutes)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={0} max={480} step={5}
                    value={config.besoinDelaiMinutes ?? 0}
                    onChange={e => canEditEmails && setConfig({ ...config, besoinDelaiMinutes: Number(e.target.value) })}
                    className="flex-1 accent-blue-600"
                    disabled={!canEditEmails}
                  />
                  <input
                    type="number" min={0} max={480} step={5}
                    value={config.besoinDelaiMinutes ?? 0}
                    onChange={e => canEditEmails && setConfig({ ...config, besoinDelaiMinutes: Math.min(480, Math.max(0, Number(e.target.value))) })}
                    disabled={!canEditEmails}
                    className="w-20 px-2 py-2 rounded-xl border border-border bg-background text-center font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-muted disabled:text-muted-foreground"
                  />
                  <div className="w-20 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-2 rounded-xl text-center">
                    {config.besoinDelaiMinutes === 0
                      ? "Immediat"
                      : config.besoinDelaiMinutes < 60
                        ? `${config.besoinDelaiMinutes} min`
                        : `${Math.floor((config.besoinDelaiMinutes ?? 0) / 60)}h${(config.besoinDelaiMinutes ?? 0) % 60 > 0 ? `${(config.besoinDelaiMinutes ?? 0) % 60}min` : ""}`
                    }
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0 — Immediat</span>
                  <span>1h</span>
                  <span>2h</span>
                  <span>4h</span>
                  <span>8h max</span>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 mt-1">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    Apres validation d'une commande, le systeme attend <strong>{config.besoinDelaiMinutes === 0 ? "0 minute (immediat)" : `${config.besoinDelaiMinutes} minute(s)`}</strong> avant de mettre a jour l'onglet "Besoin par SKU" de l'acheteur. Ce delai permet de regrouper plusieurs commandes successives en un seul calcul.
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 p-4 rounded-2xl border border-border bg-card">
            <h3 className="font-semibold text-foreground text-sm">Intégration WhatsApp / واتساب</h3>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
              <svg className="w-5 h-5 text-green-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
              <div>
                <p className="text-sm font-semibold text-green-700">WhatsApp Business API</p>
                <p className="text-xs text-green-600 mt-0.5">Pour les workflows WhatsApp (BL, commandes, alertes), configurez votre clé API WhatsApp Business. Entrez votre numéro de groupe ou de communauté dans la section workflows.</p>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground">Numéro WhatsApp Business (avec indicatif)</label>
              <input type="tel" className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="+212 600 000 000" />
            </div>
          </div>

          {canEditEmails && (
            <button onClick={handleSaveConfig}
              className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "oklch(0.38 0.2 260)" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Sauvegarder la configuration
            </button>
          )}
        </div>
      )}

      {/* EmailJS config */}
      {tab === "emailjs" && (
        <div className="flex flex-col gap-4">

          {/* Guide pas-à-pas */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <p className="text-sm font-bold text-blue-800 mb-3">Guide de configuration EmailJS (5 minutes)</p>
            <ol className="text-xs text-blue-800 leading-relaxed list-decimal list-inside space-y-2">
              <li>
                Créez un compte gratuit sur{" "}
                <a href="https://www.emailjs.com" target="_blank" rel="noreferrer" className="underline font-semibold">emailjs.com</a>
              </li>
              <li>
                <strong>Email Services</strong> → Add New Service → choisissez Gmail, Outlook ou autre. Notez le <strong>Service ID</strong>.
              </li>
              <li>
                <strong>Email Templates</strong> → Create New Template. Dans le corps du template, utilisez impérativement ces variables :<br />
                <code className="bg-blue-100 rounded px-1.5 py-0.5 text-xs font-mono mt-1 inline-block">
                  {'To: {{to_email}} | Subject: {{subject}} | Body: {{message}}'}
                </code>
                <br />Notez le <strong>Template ID</strong>.
              </li>
              <li>
                <strong>Account</strong> → <strong>API Keys</strong> → copiez votre <strong>Public Key</strong>.
              </li>
              <li>Collez les 3 identifiants ci-dessous et cliquez Sauvegarder, puis testez la connexion.</li>
            </ol>
          </div>

          {/* Identifiants */}
          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <h3 className="font-semibold text-foreground text-sm">Identifiants EmailJS / بيانات EmailJS</h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Service ID</label>
                <input type="text" value={ejsCfg.serviceId}
                  onChange={e => setEjsCfg({ ...ejsCfg, serviceId: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="service_xxxxxxx" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Template ID</label>
                <input type="text" value={ejsCfg.templateId}
                  onChange={e => setEjsCfg({ ...ejsCfg, templateId: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="template_xxxxxxx" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">Public Key (Account → API Keys)</label>
                <input type="text" value={ejsCfg.publicKey}
                  onChange={e => setEjsCfg({ ...ejsCfg, publicKey: e.target.value })}
                  className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="XXXXXXXXXXXXXXXXXXXXXXX" />
              </div>
            </div>

            {/* Résultat test */}
            {testResult && (
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border ${
                testResult.ok
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}>
                {testResult.ok
                  ? <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  : <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                }
                <span className="leading-relaxed">{testResult.msg}</span>
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => {
                  saveEmailJSConfig(ejsCfg)
                  setSaved("Configuration EmailJS sauvegardée.")
                  setTimeout(() => setSaved(""), 3000)
                  setTestResult(null)
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: "oklch(0.38 0.2 260)" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Sauvegarder
              </button>
              <button
                disabled={testing || !ejsCfg.publicKey || !ejsCfg.serviceId || !ejsCfg.templateId}
                onClick={async () => {
                  // Sauvegarder d'abord pour que le test utilise les nouveaux identifiants
                  saveEmailJSConfig(ejsCfg)
                  setTesting(true)
                  setTestResult(null)
                  const result = await testEmailJSConnection()
                  setTesting(false)
                  setTestResult({
                    ok: result.ok,
                    msg: result.ok
                      ? "Connexion EmailJS réussie ! Les emails peuvent être envoyés."
                      : `Echec: ${result.error ?? "Vérifiez vos identifiants."}`,
                  })
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-border hover:bg-muted transition-colors disabled:opacity-50">
                {testing
                  ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                }
                Tester la connexion
              </button>
            </div>
          </div>

          {/* Template requis */}
          <div className="bg-card rounded-2xl border border-border p-5">
            <p className="text-sm font-semibold text-foreground mb-3">Template EmailJS requis</p>
            <p className="text-xs text-muted-foreground mb-3">
              Votre template doit contenir exactement ces 3 variables (copiez-collez dans votre template EmailJS) :
            </p>
            <pre className="text-xs font-mono bg-muted rounded-xl p-4 text-foreground leading-relaxed overflow-x-auto whitespace-pre-wrap">{`Subject: {{subject}}

To: {{to_email}}

{{message}}`}</pre>
            <p className="text-xs text-muted-foreground mt-3">
              Dans &quot;To Email&quot; du template, mettez <code className="bg-muted px-1 rounded font-mono">{"{{to_email}}"}</code> pour que chaque email soit envoyé au bon destinataire.
            </p>
          </div>

          {/* Sécurité */}
          <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/50">
            <svg className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div className="text-xs text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground mb-1">Sécurité & limites</p>
              Identifiants stockés uniquement dans le navigateur (localStorage). Plan gratuit EmailJS : 200 emails/mois. Pour restreindre l&apos;origine dans EmailJS : <strong>Account → API Keys → Allowed Origins</strong>.
            </div>
          </div>
        </div>
      )}

      {/* Poids Contenants */}
      {tab === "contenants" && (
        <div className="flex flex-col gap-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-bold text-foreground mb-1">Poids des contenants / Tares</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Ces poids sont utilises pour calculer le poids net a la reception.
              Caisse, Demi-caisse, Dolly (bois), Chariot — modifiables a tout moment.
            </p>
            <div className="flex flex-col gap-3">
              {contenants.map((c, idx) => (
                <div key={c.id} className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={c.nom}
                      onChange={e => setContenants(prev => prev.map((x, i) => i === idx ? { ...x, nom: e.target.value } : x))}
                      className="w-full text-sm font-semibold bg-transparent border-none outline-none text-foreground"
                      placeholder="Nom du contenant"
                    />
                    <input
                      type="text"
                      value={c.notes ?? ""}
                      onChange={e => setContenants(prev => prev.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x))}
                      className="w-full text-[11px] bg-transparent border-none outline-none text-muted-foreground mt-0.5"
                      placeholder="Notes (optionnel)"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={c.poidsKg}
                      onChange={e => setContenants(prev => prev.map((x, i) => i === idx ? { ...x, poidsKg: Number(e.target.value) } : x))}
                      className="w-20 text-sm font-bold text-right px-2 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <span className="text-xs text-muted-foreground">kg</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground mr-1">Actif</span>
                    <button
                      onClick={() => setContenants(prev => prev.map((x, i) => i === idx ? { ...x, actif: !x.actif } : x))}
                      className={`w-9 h-5 rounded-full transition-colors relative ${c.actif ? "bg-primary" : "bg-muted-foreground/30"}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${c.actif ? "left-4" : "left-0.5"}`} />
                    </button>
                  </div>
                  <button
                    onClick={() => setContenants(prev => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Add new */}
            <button
              onClick={() => setContenants(prev => [...prev, {
                id: `ct_${Date.now()}`,
                nom: "Nouveau contenant",
                poidsKg: 1.0,
                actif: true,
                notes: "",
              }])}
              className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-primary text-primary text-sm font-semibold hover:bg-primary/5 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Ajouter un contenant
            </button>
          </div>

          {contenantSaved && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              {contenantSaved}
            </div>
          )}

          <button
            onClick={() => {
              store.saveContenantsConfig(contenants)
              setContenantSaved("Poids des contenants sauvegardés.")
              setTimeout(() => setContenantSaved(""), 2500)
            }}
            className="self-start px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
            Sauvegarder les poids
          </button>
        </div>
      )}

      {/* DataGuard */}
      {tab === "dataguard" && (
        <div className="flex flex-col gap-4">

          {dgMsg && (
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm ${dgMsg.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
              {dgMsg.ok
                ? <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                : <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              }
              {dgMsg.text}
            </div>
          )}

          {/* Données Démo */}
          <div className="bg-card rounded-2xl border border-emerald-200 p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-50">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-emerald-700 text-sm">Charger les données démo / تحميل بيانات تجريبية</h3>
                <p className="text-xs text-muted-foreground">Pré-remplir l&apos;app avec des clients, articles, commandes et livraisons réalistes</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Clients", value: "6", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
                { label: "Articles", value: "8", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
                { label: "Commandes", value: "5", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
                { label: "Voyages", value: "3", icon: "M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" },
              ].map(item => (
                <div key={item.label} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  <span className="text-lg font-bold text-emerald-700">{item.value}</span>
                  <span className="text-xs text-emerald-600">{item.label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ajoute des données marocaines réalistes (fruits & légumes, Casablanca) sans écraser les données existantes. Idéal pour explorer toutes les fonctionnalités. Les données portent le préfixe <code className="bg-muted px-1 rounded font-mono">seed-</code> et peuvent être supprimées via &quot;Effacer toutes les données&quot;.
            </p>
            {seedMsg && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${seedMsg.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                {seedMsg.ok
                  ? <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  : <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                }
                {seedMsg.text}
              </div>
            )}
            <button
              onClick={handleSeedDemo}
              disabled={seeding}
              className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
              {seeding
                ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
              }
              {seeding ? "Chargement…" : "Charger les données démo"}
            </button>
          </div>

          {/* Sauvegarde */}
          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "oklch(0.92 0.05 260)" }}>
                <svg className="w-5 h-5" style={{ color: "oklch(0.38 0.2 260)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">Exporter la sauvegarde / تصدير النسخ الاحتياطي</h3>
                <p className="text-xs text-muted-foreground">Téléchargez toutes les données en un fichier JSON</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Cette action exporte l&apos;intégralité des données stockées dans le navigateur (commandes, bons, stocks, utilisateurs, paramètres) dans un fichier <code className="bg-muted px-1 rounded font-mono">freshlink-backup-[date].json</code>. Conservez ce fichier en lieu sûr.
            </p>
            <button onClick={handleExport}
              className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "oklch(0.38 0.2 260)" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Exporter (.json)
            </button>
          </div>

          {/* Restauration */}
          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "oklch(0.92 0.06 165)" }}>
                <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">Importer une sauvegarde / استيراد النسخ الاحتياطي</h3>
                <p className="text-xs text-muted-foreground">Restaurez les données depuis un fichier JSON exporté</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-amber-800">L&apos;import <strong>écrase</strong> les données actuelles. Faites d&apos;abord une sauvegarde si nécessaire.</p>
            </div>
            <input ref={importRef} type="file" accept=".json,application/json" onChange={handleImport} className="hidden" id="import-json-file" />
            <label htmlFor="import-json-file"
              className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-border hover:bg-muted transition-colors cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Choisir un fichier .json
            </label>
          </div>

          {/* Réinitialisation */}
          <div className="bg-card rounded-2xl border border-red-200 p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-red-50">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-red-700 text-sm">Réinitialiser toutes les données / مسح جميع البيانات</h3>
                <p className="text-xs text-muted-foreground">Efface définitivement toutes les données du navigateur</p>
              </div>
            </div>
            {!showClearConfirm ? (
              <button onClick={() => setShowClearConfirm(true)}
                className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-red-300 text-red-600 hover:bg-red-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Effacer toutes les données
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-red-700">Confirmez-vous la suppression de toutes les données ?</p>
                <div className="flex gap-2">
                  <button onClick={handleClearAll}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors">
                    Oui, effacer tout
                  </button>
                  <button onClick={() => setShowClearConfirm(false)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-muted transition-colors">
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Guide de mise en production */}
          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "oklch(0.93 0.04 200)" }}>
                <svg className="w-5 h-5" style={{ color: "oklch(0.38 0.15 200)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">Guide de passage en production / دليل النشر</h3>
                <p className="text-xs text-muted-foreground">Recommandations pour déployer FreshLink en production</p>
              </div>
            </div>
            <ol className="flex flex-col gap-3">
              {[
                {
                  n: "1",
                  title: "Exporter une sauvegarde initiale",
                  body: "Avant tout déploiement, exportez les données de démonstration via le bouton ci-dessus. Conservez le fichier JSON comme référence.",
                },
                {
                  n: "2",
                  title: "Configurer EmailJS",
                  body: "Dans l'onglet EmailJS, saisissez vos identifiants (Service ID, Template ID, Public Key) et testez la connexion.",
                },
                {
                  n: "3",
                  title: "Paramétrer les emails de notification",
                  body: "Dans l'onglet Emails, renseignez les adresses réelles (achat, commercial, récap). Activez les envois automatiques si souhaité.",
                },
                {
                  n: "4",
                  title: "Créer les utilisateurs réels",
                  body: "Dans Utilisateurs & Rôles, ajoutez les comptes de vos collaborateurs et définissez leurs rôles et permissions.",
                },
                {
                  n: "5",
                  title: "Tester en conditions réelles",
                  body: "Passez une commande test, réceptionnez-la, dispatchez-la et vérifiez les emails reçus. Validez le workflow complet.",
                },
                {
                  n: "6",
                  title: "Sauvegarde quotidienne recommandée",
                  body: "En production, exportez une sauvegarde chaque soir et stockez-la sur Google Drive, OneDrive ou un serveur sécurisé.",
                },
              ].map(step => (
                <li key={step.n} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
                    style={{ background: "oklch(0.38 0.2 260)" }}>{step.n}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Info localStorage */}
          <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/50">
            <svg className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground mb-1">Architecture de stockage actuelle</p>
              FreshLink utilise le <strong>localStorage</strong> du navigateur (~5–10 Mo). Les données sont propres à chaque appareil/navigateur. Pour une architecture multi-poste partagée, une migration vers une base de données cloud (Supabase, Firebase) est recommandée à long terme.
            </div>
          </div>
        </div>
      )}

      {/* Deploiement Vercel */}
      {tab === "vercel" && (
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="bg-card rounded-2xl border border-border p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#000" }}>
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white"><path d="M12 2L2 19.5h20L12 2z"/></svg>
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">Deployer sur Vercel</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Suivez ces etapes pour mettre votre application FreshLink en production sur Vercel gratuitement.
              </p>
            </div>
          </div>

          {/* Steps */}
          {[
            {
              n: 1, title: "Creer un compte Vercel",
              body: "Allez sur vercel.com et cliquez \"Sign Up\". Connectez-vous avec votre compte GitHub (recommande) ou creez un compte avec votre email.",
              link: "https://vercel.com/signup", linkLabel: "vercel.com/signup",
              tip: null,
            },
            {
              n: 2, title: "Installer Vercel CLI (optionnel mais recommande)",
              body: "Ouvrez un terminal et executez la commande ci-dessous. Ensuite connectez-vous avec: vercel login",
              code: "npm install -g vercel",
              tip: null,
            },
            {
              n: 3, title: "Pousser le code sur GitHub",
              body: "Creez un nouveau depot GitHub (prive ou public) et poussez le code source de l application. Vercel se connecte automatiquement a GitHub pour les deployements automatiques.",
              code: "git init\ngit add .\ngit commit -m \"Initial commit FreshLink\"\ngit remote add origin https://github.com/VOTRE_NOM/freshlink.git\ngit push -u origin main",
              tip: null,
            },
            {
              n: 4, title: "Importer le projet dans Vercel",
              body: "Dans le dashboard Vercel, cliquez \"Add New Project\" puis importez votre depot GitHub. Vercel detecte automatiquement Next.js et configure le build.",
              link: "https://vercel.com/new", linkLabel: "vercel.com/new",
              tip: "Framework Preset: Next.js sera detecte automatiquement.",
            },
            {
              n: 5, title: "Configurer les variables d environnement",
              body: "Avant de deployer, ajoutez ces variables dans Settings > Environment Variables de votre projet Vercel :",
              envVars: [
                { key: "NEXT_PUBLIC_SUPABASE_URL", value: "https://jwdrwapuetqoqnankgma.supabase.co" },
                { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5waHJuY211eGJ3YWhxbnpkeXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDUyNDUsImV4cCI6MjA5MDUyMTI0NX0._4bA9RtIVMUjNgxd2ojd9_3b6vzGRddpPPbioalRsMw" },
              ],
              tip: "Ces variables sont aussi requises pour que la synchronisation Supabase fonctionne en production.",
            },
            {
              n: 6, title: "Lancer le deploiement",
              body: "Cliquez \"Deploy\" dans Vercel. Le build dure en general 1-3 minutes. Une fois termine, vous recevrez une URL du type https://freshlink-XXXXX.vercel.app",
              tip: "Chaque push sur la branche main declenchera automatiquement un nouveau deploiement.",
            },
            {
              n: 7, title: "Configurer un domaine personnalise (optionnel)",
              body: "Dans Settings > Domains de votre projet Vercel, ajoutez votre domaine. Vercel fournit les enregistrements DNS a configurer chez votre registrar.",
              tip: null,
            },
          ].map(step => (
            <div key={step.n} className="bg-card rounded-2xl border border-border p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                  style={{ background: "oklch(0.38 0.2 260)" }}>
                  {step.n}
                </div>
                <h4 className="font-bold text-sm text-foreground">{step.title}</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{step.body}</p>
              {"code" in step && step.code && (
                <pre className="px-4 py-3 rounded-xl text-xs font-mono overflow-x-auto"
                  style={{ background: "oklch(0.12 0.02 260)", color: "oklch(0.88 0.015 245)", border: "1px solid oklch(0.22 0.04 260)" }}>
                  {step.code}
                </pre>
              )}
              {"envVars" in step && step.envVars && (
                <div className="flex flex-col gap-2">
                  {step.envVars.map(ev => (
                    <div key={ev.key} className="flex flex-col gap-0.5 px-4 py-2.5 rounded-xl"
                      style={{ background: "oklch(0.12 0.02 260)", border: "1px solid oklch(0.22 0.04 260)" }}>
                      <span className="text-[10px] font-bold" style={{ color: "oklch(0.65 0.15 200)" }}>{ev.key}</span>
                      <span className="text-xs font-mono break-all" style={{ color: "oklch(0.85 0.015 245)" }}>{ev.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {step.tip && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200">
                  <svg className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-blue-700">{step.tip}</p>
                </div>
              )}
              {step.link && (
                <a href={step.link} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline underline-offset-2">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {step.linkLabel}
                </a>
              )}
            </div>
          ))}

          {/* Quick deploy button */}
          <div className="bg-card rounded-2xl border border-border p-5 flex flex-col gap-3">
            <h4 className="font-bold text-sm text-foreground">Deploiement rapide (1-clic)</h4>
            <p className="text-xs text-muted-foreground">
              Si votre code est deja sur GitHub, cliquez ce bouton pour importer directement dans Vercel.
            </p>
            <a
              href="https://vercel.com/new"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: "#000" }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M12 2L2 19.5h20L12 2z"/></svg>
              Deployer sur Vercel
            </a>
          </div>
        </div>
      )}

      {/* Motifs retour */}
      {tab === "motifs" && (
        <div className="flex flex-col gap-4">
          <div className="bg-card rounded-2xl border border-border p-5 flex flex-col gap-3">
            <h3 className="font-semibold text-foreground text-sm">Ajouter un motif de retour / إضافة سبب إرجاع</h3>
            <div className="flex gap-2 flex-wrap">
              <input value={newMotif.label} onChange={e => setNewMotif({ ...newMotif, label: e.target.value })}
                className="flex-1 min-w-32 px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Motif (Français)" />
              <input value={newMotif.labelAr} onChange={e => setNewMotif({ ...newMotif, labelAr: e.target.value })}
                dir="rtl"
                className="flex-1 min-w-32 px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="السبب (عربي)" />
              <button onClick={handleAddMotif}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white shrink-0"
                style={{ background: "oklch(0.38 0.2 260)" }}>
                Ajouter
              </button>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "oklch(0.14 0.03 260)", color: "oklch(0.88 0.015 245)" }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Motif</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" dir="rtl">السبب</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Statut</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {motifs.map((m, i) => (
                  <tr key={m.id} style={{ borderTop: "1px solid oklch(0.87 0.012 240)", background: i % 2 === 0 ? "white" : "oklch(0.975 0.003 240)" }}>
                    <td className="px-4 py-3 font-medium text-foreground">{m.label}</td>
                    <td className="px-4 py-3 text-muted-foreground" dir="rtl">{m.labelAr}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${m.actif ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                        {m.actif ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => toggleMotif(m.id)} className={`p-1.5 rounded-lg hover:bg-muted transition-colors ${m.actif ? "text-amber-500" : "text-green-600"}`} title={m.actif ? "Désactiver" : "Activer"}>
                          {m.actif
                            ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                        </button>
                        <button onClick={() => deleteMotif(m.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
          ))}
          </tbody>
          </table>
          </div>
          </div>
          )}

      {/* ══ AI CONFIG TAB ══════════════════════════════════════════════════════ */}
      {tab === "ai_config" && (
        <div className="flex flex-col gap-5 max-w-3xl">

          {/* API Keys */}
          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="font-bold text-sm text-foreground">Cles API (chiffrees en local)</h3>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">Les cles sont stockees uniquement dans le navigateur — elles ne quittent jamais votre appareil.</p>

            {[
              { key: "openaiKey",    label: "OpenAI API Key",    placeholder: "sk-proj-..." },
              { key: "anthropicKey", label: "Anthropic API Key", placeholder: "sk-ant-..." },
              { key: "geminiKey",    label: "Google Gemini Key", placeholder: "AIza..." },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">{label}</label>
                <div className="flex gap-2">
                  <input
                    type={showKey[key] ? "text" : "password"}
                    value={aiCfg[key as keyof typeof aiCfg] as string ?? ""}
                    onChange={e => setAiCfg(c => ({ ...c, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="flex-1 px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-violet-500/30 font-mono"
                  />
                  <button type="button"
                    onClick={() => setShowKey(s => ({ ...s, [key]: !s[key] }))}
                    className="px-3 py-2 border border-border rounded-xl text-slate-400 hover:text-slate-700 hover:bg-muted transition-colors">
                    {showKey[key]
                      ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Model selector */}
          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <h3 className="font-bold text-sm text-foreground">Modele IA par defaut</h3>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Modele actif</label>
              <select value={aiCfg.model ?? "gpt-4o"}
                onChange={e => setAiCfg(c => ({ ...c, model: e.target.value }))}
                className="px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-violet-500/30">
                <optgroup label="OpenAI">
                  <option value="gpt-4o">GPT-4o (recommande)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (economique)</option>
                </optgroup>
                <optgroup label="Anthropic">
                  <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="claude-3-haiku">Claude 3 Haiku (rapide)</option>
                </optgroup>
                <optgroup label="Google">
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                </optgroup>
              </select>
            </div>
          </div>

          {/* System Prompt */}
          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <h3 className="font-bold text-sm text-foreground">Prompt systeme (contexte logistique)</h3>
            <p className="text-xs text-muted-foreground -mt-2">Ce prompt est injecte en premier dans toutes les conversations IA pour garantir un comportement expert logistique.</p>
            <textarea
              value={aiCfg.systemPrompt ?? "Tu es un expert en logistique, distribution de fruits et legumes frais, et gestion d'operations commerciales. Tu reponds en francais, de facon concise et actionnable."}
              onChange={e => setAiCfg(c => ({ ...c, systemPrompt: e.target.value }))}
              rows={5}
              className="px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none font-mono leading-relaxed"
            />
          </div>

          {/* Business toggles */}
          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <h3 className="font-bold text-sm text-foreground">Regles metier — Interrupteurs</h3>
            {[
              { key: "qcObligatoireBL", label: "Verification QC obligatoire avant validation BL", desc: "Bloque l'expedition si le QC n'est pas signe" },
              { key: "alerteAchatEnabled", label: "Alertes email sur anomalies PA (Prix Achat)", desc: "Envoie un email si PA > Historique + seuil %" },
              { key: "alerteVenteEnabled", label: "Alertes email sur risque de perte (PV < PA)", desc: "Envoie un email si marge < seuil %" },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
                <button type="button"
                  onClick={() => setAiCfg(c => ({ ...c, [key]: !c[key as keyof typeof c] }))}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${aiCfg[key as keyof typeof aiCfg] ? "bg-emerald-500" : "bg-slate-200"}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${aiCfg[key as keyof typeof aiCfg] ? "left-6" : "left-1"}`} />
                </button>
              </div>
            ))}
          </div>

          {aiSaved && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              {aiSaved}
            </div>
          )}
          <button
            onClick={() => {
              localStorage.setItem("fl_ai_config", JSON.stringify(aiCfg))
              // Sync qcObligatoireBL into workflow config too
              const wf = JSON.parse(localStorage.getItem("fl_workflow_config") ?? "{}")
              localStorage.setItem("fl_workflow_config", JSON.stringify({ ...wf, qcObligatoireBL: aiCfg.qcObligatoireBL ?? false }))
              setAiSaved("Configuration IA sauvegardee.")
              setTimeout(() => setAiSaved(""), 2500)
            }}
            className="self-start px-6 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors shadow-sm">
            Sauvegarder configuration IA
          </button>
        </div>
      )}

      {/* ══ ALERTES TAB ═══════════════════════════════════════════════════════ */}
      {tab === "alertes" && (
        <div className="flex flex-col gap-5 max-w-3xl">

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-bold text-amber-800">Moteur d&apos;alertes Email — Logique de declenchement</p>
              <p className="text-xs text-amber-700 mt-1">
                Alerte PA : si nouveau PA &gt; Moyenne historique x (1 + seuil%), un email est envoye.<br />
                Alerte PV : si marge nette &lt; seuil%, un email &quot;Risque de perte&quot; est envoye.
              </p>
            </div>
          </div>

          {/* Email destinataire */}
          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <h3 className="font-bold text-sm text-foreground">Email de reception des alertes</h3>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Adresse email destinataire</label>
              <input type="email"
                value={alertCfg.emailDestinataire ?? ""}
                onChange={e => setAlertCfg(c => ({ ...c, emailDestinataire: e.target.value }))}
                placeholder="responsable@entreprise.ma"
                className="px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
              <p className="text-xs text-muted-foreground">Cet email recevra toutes les alertes PA et PV.</p>
            </div>
          </div>

          {/* Seuils */}
          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <h3 className="font-bold text-sm text-foreground">Seuils de declenchement</h3>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">
                Seuil alerte PA — Ecart prix achat vs historique (%)
              </label>
              <div className="flex items-center gap-3">
                <input type="range" min={1} max={50} step={1}
                  value={alertCfg.paSeuilPct ?? 10}
                  onChange={e => setAlertCfg(c => ({ ...c, paSeuilPct: Number(e.target.value) }))}
                  className="flex-1 accent-amber-500"
                />
                <span className="font-bold text-amber-700 text-base w-12 text-center">
                  {alertCfg.paSeuilPct ?? 10}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Exemple : seuil 10% → alerte si PA &gt; Moy. historique x 1.10
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">
                Seuil alerte PV — Marge minimum acceptable (%)
              </label>
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={40} step={1}
                  value={alertCfg.pvMargeMinPct ?? 5}
                  onChange={e => setAlertCfg(c => ({ ...c, pvMargeMinPct: Number(e.target.value) }))}
                  className="flex-1 accent-red-500"
                />
                <span className="font-bold text-red-700 text-base w-12 text-center">
                  {alertCfg.pvMargeMinPct ?? 5}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Exemple : seuil 5% → alerte si (PV - PA) / PV &lt; 5% (risque de perte)
              </p>
            </div>
          </div>

          {/* Simulation */}
          <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-4">
            <h3 className="font-bold text-sm text-foreground">Simulation d&apos;alerte</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              {(() => {
                const pa = 100
                const hist = 92
                const seuil = alertCfg.paSeuilPct ?? 10
                const pvMarge = alertCfg.pvMargeMinPct ?? 5
                const paOk = pa <= hist * (1 + seuil / 100)
                const pv = 105
                const marge = ((pv - pa) / pv) * 100
                const pvOk = marge >= pvMarge
                return (
                  <>
                    <div className={`rounded-xl p-3 border ${paOk ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                      <p className="font-bold text-slate-700 mb-1">Alerte PA</p>
                      <p className="text-slate-500">PA simulé : {pa} DH</p>
                      <p className="text-slate-500">Hist. moy. : {hist} DH</p>
                      <p className="text-slate-500">Seuil +{seuil}% = {(hist * (1 + seuil / 100)).toFixed(2)} DH</p>
                      <p className={`font-bold mt-2 ${paOk ? "text-emerald-600" : "text-red-600"}`}>
                        {paOk ? "Pas d'alerte" : "ALERTE DECLENCHEE"}
                      </p>
                    </div>
                    <div className={`rounded-xl p-3 border ${pvOk ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                      <p className="font-bold text-slate-700 mb-1">Alerte PV</p>
                      <p className="text-slate-500">PV simulé : {pv} DH</p>
                      <p className="text-slate-500">PA : {pa} DH</p>
                      <p className="text-slate-500">Marge : {marge.toFixed(1)}% (min {pvMarge}%)</p>
                      <p className={`font-bold mt-2 ${pvOk ? "text-emerald-600" : "text-red-600"}`}>
                        {pvOk ? "Pas d'alerte" : "RISQUE DE PERTE"}
                      </p>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>

          {alertSaved && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              {alertSaved}
            </div>
          )}
          <button
            onClick={() => {
              localStorage.setItem("fl_alert_config", JSON.stringify(alertCfg))
              const ai = JSON.parse(localStorage.getItem("fl_ai_config") ?? "{}")
              localStorage.setItem("fl_ai_config", JSON.stringify({
                ...ai,
                alerteAchatEnabled: alertCfg.alerteAchatEnabled ?? true,
                alerteVenteEnabled: alertCfg.alerteVenteEnabled ?? true,
              }))
              setAlertSaved("Configuration alertes sauvegardee.")
              setTimeout(() => setAlertSaved(""), 2500)
            }}
            className="self-start px-6 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-colors shadow-sm">
            Sauvegarder les seuils d&apos;alerte
          </button>
        </div>
      )}

      {/* === TRANSPORTEURS === */}
      {tab === "transporteurs" && (
        <div className="flex flex-col gap-5">

          {/* Header banner */}
          <div className="bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 rounded-2xl p-5 flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 9l2 2 4-4m6-2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-slate-900">Sociétés de Transport / شركات النقل</p>
                <p className="text-xs text-sky-700 mt-0.5">
                  {transporteurs.length} société(s) — {transporteurs.filter(t => t.actif).length} active(s)
                </p>
              </div>
            </div>
            <button
              onClick={() => { setEditingTransport(emptyTransport()); setShowTransportForm(true) }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 transition-colors shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Ajouter un transporteur
            </button>
          </div>

          {transportSaved && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              {transportSaved}
            </div>
          )}

          {/* Form — add / edit */}
          {showTransportForm && editingTransport && (
            <div className="bg-card rounded-2xl border border-sky-300 shadow-md p-6 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-slate-900">
                  {transporteurs.find(t => t.id === editingTransport.id) ? "Modifier le transporteur" : "Nouveau transporteur"}
                </h3>
                <button onClick={() => setShowTransportForm(false)} className="text-muted-foreground hover:text-foreground">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Identification */}
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-sky-600 mb-3">Identification</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-xs font-semibold">Raison sociale *</label>
                    <input type="text" value={editingTransport.nom}
                      onChange={e => setEditingTransport(t => t ? { ...t, nom: e.target.value } : t)}
                      className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                      placeholder="TRANSMAROC SARL" />
                  </div>
                  {[
                    { f: "ice",      label: "ICE (20 chiffres)",        placeholder: "00000000000000000000", mono: true },
                    { f: "patente",  label: "Patente",                  placeholder: "12345678", mono: true },
                    { f: "rc",       label: "RC (Registre de commerce)", placeholder: "CS 12345", mono: true },
                    { f: "if_fiscal",label: "IF (Identifiant fiscal)",  placeholder: "12345678", mono: true },
                    { f: "tp",       label: "TP (Taxe professionnelle)", placeholder: "12345678", mono: true },
                    { f: "cnss",     label: "CNSS",                     placeholder: "1234567", mono: true },
                  ].map(({ f, label, placeholder, mono }) => (
                    <div key={f} className="flex flex-col gap-1">
                      <label className="text-xs font-semibold">{label}</label>
                      <input type="text"
                        value={(editingTransport as unknown as Record<string,string>)[f] ?? ""}
                        onChange={e => setEditingTransport(t => t ? { ...t, [f]: e.target.value } : t)}
                        className={`px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 ${mono ? "font-mono" : ""}`}
                        placeholder={placeholder} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact */}
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-sky-600 mb-3">Contact</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { f: "contact",   label: "Responsable / Contact",   placeholder: "Mohammed Alami" },
                    { f: "telephone", label: "Téléphone",               placeholder: "0522 000 000" },
                    { f: "email",     label: "Email",                   placeholder: "transport@maroc.ma" },
                    { f: "adresse",   label: "Adresse",                 placeholder: "Bd Hassan II" },
                    { f: "ville",     label: "Ville",                   placeholder: "Casablanca" },
                  ].map(({ f, label, placeholder }) => (
                    <div key={f} className="flex flex-col gap-1">
                      <label className="text-xs font-semibold">{label}</label>
                      <input type="text"
                        value={(editingTransport as unknown as Record<string,string>)[f] ?? ""}
                        onChange={e => setEditingTransport(t => t ? { ...t, [f]: e.target.value } : t)}
                        className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                        placeholder={placeholder} />
                    </div>
                  ))}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold">Notes</label>
                    <textarea rows={2} value={editingTransport.notes ?? ""}
                      onChange={e => setEditingTransport(t => t ? { ...t, notes: e.target.value } : t)}
                      className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 resize-none" />
                  </div>
                </div>
              </div>

              {/* Actif toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditingTransport(t => t ? { ...t, actif: !t.actif } : t)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${editingTransport.actif ? "bg-sky-600" : "bg-slate-300"}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${editingTransport.actif ? "left-5.5" : "left-0.5"}`} style={{ left: editingTransport.actif ? "1.375rem" : "0.125rem" }} />
                </button>
                <span className="text-sm font-medium">{editingTransport.actif ? "Actif" : "Inactif"}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2 border-t border-border">
                <button
                  onClick={() => {
                    if (!editingTransport.nom.trim()) return
                    const exists = transporteurs.find(t => t.id === editingTransport.id)
                    let updated: TransportCompany[]
                    if (exists) {
                      updated = transporteurs.map(t => t.id === editingTransport.id ? editingTransport : t)
                    } else {
                      updated = [...transporteurs, editingTransport]
                    }
                    store.saveTransportCompanies(updated)
                    setTransporteurs(updated)
                    setShowTransportForm(false)
                    setEditingTransport(null)
                    setTransportSaved(exists ? "Transporteur mis a jour." : "Nouveau transporteur ajouté.")
                    setTimeout(() => setTransportSaved(""), 2500)
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Sauvegarder
                </button>
                <button onClick={() => { setShowTransportForm(false); setEditingTransport(null) }}
                  className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {transporteurs.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-sky-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 9l2 2 4-4m6-2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-slate-700">Aucun transporteur enregistré</p>
                <p className="text-sm text-muted-foreground mt-1">Cliquez sur &quot;Ajouter un transporteur&quot; pour commencer.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {transporteurs.map(tc => (
                <div key={tc.id} className={`bg-card rounded-2xl border ${tc.actif ? "border-border" : "border-slate-200 opacity-60"} p-5 flex flex-col gap-3`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 9l2 2 4-4m6-2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{tc.nom}</p>
                        {tc.ville && <p className="text-xs text-muted-foreground">{tc.ville}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tc.actif ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {tc.actif ? "Actif" : "Inactif"}
                      </span>
                      <button onClick={() => { setEditingTransport({ ...tc }); setShowTransportForm(true) }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => {
                        if (!confirm(`Supprimer ${tc.nom} ?`)) return
                        const updated = transporteurs.filter(t => t.id !== tc.id)
                        store.saveTransportCompanies(updated)
                        setTransporteurs(updated)
                      }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>

                  {/* Fiscal fields */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {[
                      { label: "ICE",     value: tc.ice },
                      { label: "Patente", value: tc.patente },
                      { label: "RC",      value: tc.rc },
                      { label: "IF",      value: tc.if_fiscal },
                      { label: "CNSS",    value: tc.cnss },
                    ].map(({ label, value }) => value ? (
                      <div key={label} className="bg-slate-50 rounded-xl px-3 py-2">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p>
                        <p className="text-xs font-mono font-semibold text-slate-700 break-all mt-0.5">{value}</p>
                      </div>
                    ) : null)}
                  </div>

                  {/* Contact row */}
                  {(tc.contact || tc.telephone || tc.email) && (
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1 border-t border-border">
                      {tc.contact   && <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>{tc.contact}</span>}
                      {tc.telephone && <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>{tc.telephone}</span>}
                      {tc.email     && <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>{tc.email}</span>}
                    </div>
                  )}
                  {tc.notes && <p className="text-xs text-muted-foreground italic">{tc.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

          </div>
          )
          }
