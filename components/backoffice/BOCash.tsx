"use client"

import { useState, useEffect } from "react"
import { store, type BonLivraison, DEFAULT_CAISSE_PRICING, type CaissePricing, DEFAULT_FRAIS_BL, type FraisBlConfig } from "@/lib/store"
import { printBL, printFacture as printFactureLib } from "@/lib/print"

// ── FMT ──────────────────────────────────────────────────────────────────
const fmtDH = (n: number) => n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH"
const fmtDate = () => new Date().toLocaleDateString("fr-FR")

// ── Legacy inline wrappers replaced by lib/print ─────────────────────────
// keeping _printBLLegacy to avoid breaking anything that still references it
function _printBLLegacy(bl: BonLivraison) {
  const company = typeof window !== "undefined" ? (() => {
    try { return JSON.parse(localStorage.getItem("fl_company") || "{}") } catch { return {} }
  })() : {}
  const companyNom = company.nom || "FreshLink Maroc"
  const companyEmail = company.email || "contact@freshlink.ma"
  const companyTel = company.telephone || ""
  const companyAdresse = company.adresse || ""
  const companyLogo = company.logo || null

  const ht = bl.montantTotal
  const tva = bl.tva ?? 0
  const ttc = bl.montantTTC ?? ht + tva
  const win = window.open("", "_blank", "width=860,height=720")
  if (!win) return
  win.document.write(`<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8">
<title>BL-${bl.id.slice(0,8).toUpperCase()}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:10.5pt;color:#1a1a1a;background:#fff;padding:32px 36px}
  /* HEADER */
  .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;border-bottom:4px solid #166534;margin-bottom:22px}
  .brand h1{font-size:22pt;font-weight:900;color:#166534;letter-spacing:-0.5px;line-height:1}
  .brand .tagline{font-size:8.5pt;color:#6b7280;margin-top:3px}
  .brand .contact{font-size:8pt;color:#9ca3af;margin-top:5px;line-height:1.6}
  .doc-meta{text-align:right}
  .doc-meta .doc-type{font-size:9pt;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:2px}
  .doc-meta .doc-num{font-size:18pt;font-weight:900;color:#166534;letter-spacing:-0.5px;line-height:1.1}
  .doc-meta .doc-date{font-size:9pt;color:#6b7280;margin-top:4px}
  .badge{display:inline-block;padding:3px 12px;border-radius:20px;font-size:8pt;font-weight:700;text-transform:uppercase;margin-top:6px}
  .badge-emis{background:#fef9c3;color:#854d0e;border:1px solid #fde68a}
  .badge-encaisse{background:#dcfce7;color:#14532d;border:1px solid #86efac}
  .badge-retour{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5}
  /* PARTIES */
  .parties{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px}
  .party{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px}
  .party .label{font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#9ca3af;margin-bottom:6px}
  .party .name{font-size:11pt;font-weight:700;color:#111827}
  .party .sub{font-size:8.5pt;color:#6b7280;margin-top:3px;line-height:1.5}
  /* TABLE */
  table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:10pt}
  thead tr{background:#166534;color:#fff}
  thead th{padding:9px 12px;text-align:left;font-size:8pt;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
  th.r,td.r{text-align:right}
  tbody tr{border-bottom:1px solid #f3f4f6}
  tbody tr:nth-child(even){background:#f9fafb}
  tbody td{padding:9px 12px;vertical-align:top}
  .art-name{font-weight:700;color:#111827}
  .art-um{font-size:8.5pt;color:#6b7280;margin-top:2px}
  /* TOTALS */
  .totals-wrap{display:flex;justify-content:flex-end;margin-bottom:24px}
  .totals{border:2px solid #166534;border-radius:10px;padding:14px 18px;min-width:240px}
  .trow{display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:10pt}
  .trow-total{border-top:2px solid #166534;margin-top:6px;padding-top:10px}
  .trow-total .tl{font-size:11pt;font-weight:800;color:#166534}
  .trow-total .tv{font-size:13pt;font-weight:900;color:#166534}
  /* FOOTER */
  .footer{margin-top:28px;padding-top:18px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-end}
  .sig-box{text-align:center;min-width:160px}
  .sig-box .sig-label{font-size:8.5pt;font-weight:600;color:#374151;margin-bottom:4px}
  .sig-box .sig-line{width:160px;border-bottom:1px solid #9ca3af;height:48px}
  .watermark{font-size:7.5pt;color:#d1d5db;text-align:right;line-height:1.6}
  @media print{body{padding:16px 20px}.no-print{display:none}}
</style>
</head><body>
<div class="header">
  <div class="brand">
    ${companyLogo
      ? `<img src="${companyLogo}" style="height:52px;object-fit:contain;margin-bottom:4px" alt="logo"/>`
      : `<h1>${companyNom}</h1>`}
    <div class="tagline">Distribution Fruits &amp; Légumes</div>
    <div class="contact">
      ${companyEmail ? `<span>${companyEmail}</span>` : ""}
      ${companyTel ? ` &nbsp;·&nbsp; ${companyTel}` : ""}
      ${companyAdresse ? `<br/>${companyAdresse}` : ""}
    </div>
  </div>
  <div class="doc-meta">
    <div class="doc-type">Bon de Livraison</div>
    <div class="doc-num">BL-${bl.id.slice(0,8).toUpperCase()}</div>
    <div class="doc-date">Date : ${bl.date}</div>
    <div class="doc-date">Trip : ${bl.tripId.slice(0,8).toUpperCase()}</div>
    <span class="badge badge-${bl.statut === "encaissé" ? "encaisse" : bl.statut === "retour_partiel" ? "retour" : "emis"}">${bl.statut.toUpperCase()}</span>
  </div>
</div>

<div class="parties">
  <div class="party">
    <div class="label">Client</div>
    <div class="name">${bl.clientNom}</div>
    <div class="sub">${bl.secteur || ""}${bl.zone ? " — " + bl.zone : ""}</div>
  </div>
  <div class="party">
    <div class="label">Livreur</div>
    <div class="name">${bl.livreurNom}</div>
    <div class="sub">Prévendeur : ${bl.prevendeurNom || "—"}</div>
  </div>
  <div class="party">
    <div class="label">Livraison</div>
    <div class="name">${bl.date}</div>
    <div class="sub">Statut : <strong>${bl.statutLivraison?.replace("_", " ") || "—"}</strong></div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:32px">#</th>
      <th>Article / Désignation</th>
      <th class="r" style="width:90px">Qté</th>
      <th class="r" style="width:100px">Prix unit.</th>
      <th class="r" style="width:110px">Total HT</th>
    </tr>
  </thead>
  <tbody>
    ${bl.lignes.map((l, i) => `
    <tr>
      <td style="color:#9ca3af;font-size:9pt">${i + 1}</td>
      <td>
        <div class="art-name">${l.articleNom}</div>
        ${(l as any).quantiteUM && (l as any).um
          ? `<div class="art-um">${(l as any).quantiteUM} ${(l as any).um} × ${(l as any).colisageParUM || ""} ${l.articleNom.split(" ")[0]}</div>`
          : ""}
      </td>
      <td class="r">${l.quantite.toLocaleString("fr-MA")} ${(l as any).unite || ""}</td>
      <td class="r">${l.prixUnitaire.toLocaleString("fr-MA", {minimumFractionDigits:2})} DH</td>
      <td class="r" style="font-weight:700">${l.total.toLocaleString("fr-MA", {minimumFractionDigits:2})} DH</td>
    </tr>`).join("")}
  </tbody>
</table>

<div class="totals-wrap">
  <div class="totals">
    <div class="trow"><span style="color:#6b7280">Sous-total HT</span><span>${ht.toLocaleString("fr-MA",{minimumFractionDigits:2})} DH</span></div>
    <div class="trow"><span style="color:#6b7280">TVA (${tva > 0 && ht > 0 ? Math.round(tva/ht*100) : 0}%)</span><span>${tva.toLocaleString("fr-MA",{minimumFractionDigits:2})} DH</span></div>
    <div class="trow trow-total">
      <span class="tl">TOTAL TTC</span>
      <span class="tv">${ttc.toLocaleString("fr-MA",{minimumFractionDigits:2})} DH</span>
    </div>
  </div>
</div>

<div class="footer">
  <div class="sig-box"><div class="sig-label">Signature Client</div><div class="sig-line"></div></div>
  <div class="sig-box"><div class="sig-label">Signature Livreur</div><div class="sig-line"></div></div>
  <div class="watermark">
    <p>FreshLink Pro — Gestion Distribution</p>
    <p>Imprimé le ${fmtDate()}</p>
  </div>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`)
  win.document.close()
}

// ── Print Facture (legacy — replaced by lib/print) ───────────────────────
function _printFactureLegacy(bl: BonLivraison) {
  const company = typeof window !== "undefined" ? (() => {
    try { return JSON.parse(localStorage.getItem("fl_company") || "{}") } catch { return {} }
  })() : {}
  const companyNom = company.nom || "FreshLink Maroc"
  const companyEmail = company.email || "contact@freshlink.ma"
  const companyTel = company.telephone || ""
  const companyAdresse = company.adresse || ""
  const companyRC = company.rc || ""
  const companyICE = company.ice || ""
  const companyLogo = company.logo || null

  const ht = bl.montantTotal
  const tva = bl.tva ?? Math.round(ht * 0.20)
  const ttc = bl.montantTTC ?? ht + tva
  const facNum = "FAC-" + bl.id.slice(0, 8).toUpperCase()

  const win = window.open("", "_blank", "width=860,height=720")
  if (!win) return
  win.document.write(`<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8">
<title>${facNum}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:10.5pt;color:#1a1a1a;background:#fff;padding:32px 36px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:4px solid #0f172a;margin-bottom:24px}
  .brand h1{font-size:22pt;font-weight:900;color:#0f172a;letter-spacing:-0.5px}
  .brand .tagline{font-size:8.5pt;color:#6b7280;margin-top:3px}
  .brand .contact{font-size:8pt;color:#9ca3af;margin-top:6px;line-height:1.7}
  .brand .legal{font-size:7.5pt;color:#cbd5e1;margin-top:4px}
  .doc-meta{text-align:right}
  .fac-label{font-size:9pt;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:2px}
  .fac-num{font-size:20pt;font-weight:900;color:#0f172a;line-height:1}
  .doc-date{font-size:9pt;color:#6b7280;margin-top:5px;line-height:1.7}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px}
  .party{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px}
  .party .label{font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:7px}
  .party .name{font-size:12pt;font-weight:700;color:#0f172a}
  .party .sub{font-size:8.5pt;color:#64748b;margin-top:3px;line-height:1.5}
  table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:10pt}
  thead tr{background:#0f172a;color:#f8fafc}
  thead th{padding:10px 13px;text-align:left;font-size:8pt;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
  th.r,td.r{text-align:right}
  tbody tr{border-bottom:1px solid #f1f5f9}
  tbody tr:nth-child(even){background:#f8fafc}
  tbody td{padding:10px 13px;vertical-align:top}
  .art-name{font-weight:700;color:#0f172a}
  .totals{display:flex;justify-content:flex-end;margin-bottom:22px}
  .tbox{min-width:270px;border:2px solid #0f172a;border-radius:10px;overflow:hidden}
  .trow{display:flex;justify-content:space-between;padding:8px 16px;border-bottom:1px solid #e2e8f0;font-size:10pt;color:#374151}
  .trow.ttc{background:#0f172a;color:#f8fafc;border:none;padding:12px 16px}
  .trow.ttc span{font-size:13pt;font-weight:900}
  .mentions{margin-bottom:22px;padding:12px 14px;background:#f0f9ff;border:1px solid #bae6fd;border-left:4px solid #0284c7;border-radius:6px}
  .mentions h4{font-size:7.5pt;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:.8px;margin-bottom:5px}
  .mentions p{font-size:9pt;color:#334155}
  .footer{margin-top:28px;padding-top:18px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-end}
  .sig{text-align:center}
  .sig .sig-label{font-size:8.5pt;font-weight:600;color:#374151;margin-bottom:4px}
  .sig .line{width:160px;border-bottom:1px solid #94a3b8;height:48px}
  .watermark{font-size:7.5pt;color:#d1d5db;text-align:right;line-height:1.7}
  @media print{body{padding:16px 20px}}
</style>
</head><body>
<div class="header">
  <div class="brand">
    ${companyLogo
      ? `<img src="${companyLogo}" style="height:52px;object-fit:contain;margin-bottom:4px" alt="logo"/>`
      : `<h1>${companyNom}</h1>`}
    <div class="tagline">Distribution Fruits &amp; Légumes</div>
    <div class="contact">
      ${companyEmail ? `<span>${companyEmail}</span>` : ""}
      ${companyTel ? ` &nbsp;·&nbsp; ${companyTel}` : ""}
      ${companyAdresse ? `<br/>${companyAdresse}` : ""}
    </div>
    ${companyRC || companyICE ? `<div class="legal">${companyRC ? "RC : " + companyRC : ""}${companyRC && companyICE ? " — " : ""}${companyICE ? "ICE : " + companyICE : ""}</div>` : ""}
  </div>
  <div class="doc-meta">
    <div class="fac-label">Facture</div>
    <div class="fac-num">${facNum}</div>
    <div class="doc-date">
      BL Réf : ${bl.id.slice(0,8).toUpperCase()}<br/>
      Date : ${bl.date}<br/>
      Livreur : ${bl.livreurNom}
    </div>
  </div>
</div>

<div class="parties">
  <div class="party">
    <div class="label">Vendeur</div>
    <div class="name">${companyNom}</div>
    <div class="sub">${companyEmail}${companyTel ? "<br/>" + companyTel : ""}</div>
  </div>
  <div class="party">
    <div class="label">Client</div>
    <div class="name">${bl.clientNom}</div>
    <div class="sub">
      Secteur : ${bl.secteur || "—"}<br/>
      Zone : ${bl.zone || "—"}<br/>
      Prévendeur : ${bl.prevendeurNom || "—"}
    </div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:32px">#</th>
      <th>Désignation</th>
      <th class="r" style="width:80px">Qté</th>
      <th class="r" style="width:100px">P.U. HT</th>
      <th class="r" style="width:110px">Montant HT</th>
    </tr>
  </thead>
  <tbody>
    ${bl.lignes.map((l, i) => `
    <tr>
      <td style="color:#94a3b8;font-size:9pt">${i + 1}</td>
      <td><div class="art-name">${l.articleNom}</div></td>
      <td class="r">${l.quantite.toLocaleString("fr-MA")}</td>
      <td class="r">${l.prixUnitaire.toLocaleString("fr-MA",{minimumFractionDigits:2})} DH</td>
      <td class="r" style="font-weight:700">${l.total.toLocaleString("fr-MA",{minimumFractionDigits:2})} DH</td>
    </tr>`).join("")}
  </tbody>
</table>

<div class="totals">
  <div class="tbox">
    <div class="trow"><span>Sous-total HT</span><span>${ht.toLocaleString("fr-MA",{minimumFractionDigits:2})} DH</span></div>
    <div class="trow"><span>TVA (${ht > 0 ? Math.round(tva/ht*100) : 20}%)</span><span>${tva.toLocaleString("fr-MA",{minimumFractionDigits:2})} DH</span></div>
    <div class="trow ttc"><span>TOTAL TTC</span><span>${ttc.toLocaleString("fr-MA",{minimumFractionDigits:2})} DH</span></div>
  </div>
</div>

<div class="mentions">
  <h4>Conditions de paiement</h4>
  <p>Paiement à réception de facture — Tout retard de paiement entraîne des pénalités de 1,5% par mois.</p>
</div>

<div class="footer">
  <div class="sig"><div class="sig-label">Signature Client</div><div class="line"></div></div>
  <div class="sig"><div class="sig-label">Cachet &amp; Signature Vendeur</div><div class="line"></div></div>
  <div class="watermark">
    <p>FreshLink Pro — Gestion Distribution</p>
    <p>Imprimé le ${fmtDate()}</p>
  </div>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`)
  win.document.close()
}

// ── Component ─────────────────────────────────────────────────────────────
const STATUT_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  émis:      { bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-400" },
  encaissé:  { bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500" },
}

export default function BOCash() {
  const [bls, setBls] = useState<BonLivraison[]>([])
  const [filter, setFilter] = useState({ date: store.today(), livreur: "", secteur: "", prevendeur: "", client: "" })
  const [selected, setSelected] = useState<BonLivraison | null>(null)
  const [caissePricing, setCaissePricing] = useState<CaissePricing>(DEFAULT_CAISSE_PRICING)
  const [editingCaisseId, setEditingCaisseId] = useState<string | null>(null)
  const [editCaisseGros, setEditCaisseGros] = useState("")
  const [editCaisseDemi, setEditCaisseDemi] = useState("")
  // Frais BL config — persisted across prints in session
  const [fraisConfig, setFraisConfig] = useState<FraisBlConfig>(() => {
    try { return JSON.parse(localStorage.getItem("fl_frais_bl") ?? "null") ?? DEFAULT_FRAIS_BL } catch { return DEFAULT_FRAIS_BL }
  })
  const [printFraisId, setPrintFraisId] = useState<string | null>(null) // BL id being configured for print

  const saveFraisConfig = (cfg: FraisBlConfig) => {
    setFraisConfig(cfg)
    try { localStorage.setItem("fl_frais_bl", JSON.stringify(cfg)) } catch { /* noop */ }
  }

  useEffect(() => {
    setBls(store.getBonsLivraison())
    setCaissePricing(store.getCaissePricing())
  }, [])

  const saveCaisseOnBL = (id: string, gros: number, demi: number) => {
    const all = store.getBonsLivraison()
    const idx = all.findIndex(b => b.id === id)
    if (idx < 0) return
    const pricing = store.getCaissePricing()
    all[idx] = {
      ...all[idx],
      nbCaisseGros: gros,
      nbCaisseDemi: demi,
      montantCaisses: gros * pricing.prixGrosseCaisse + demi * pricing.prixDemiCaisse,
      caissePricing: pricing,
    }
    store.saveBonsLivraison(all)
    setBls(store.getBonsLivraison())
    setEditingCaisseId(null)
  }

  const handleEncaisser = (id: string) => {
    const all = store.getBonsLivraison()
    const idx = all.findIndex(b => b.id === id)
    if (idx < 0) return
    const bl = all[idx]
    // Guard: don't double-encaiss
    if (bl.statut === "encaissé") return
    all[idx] = { ...bl, statut: "encaissé" }
    store.saveBonsLivraison(all)
    // Auto-create a CaisseEntry so the amount appears in the cash register
    const alreadyEntered = store.getCaisseEntries().some(e => e.reference === bl.id && e.categorie === "vente")
    if (!alreadyEntered) {
      store.addCaisseEntry({
        id: store.genId(),
        date: bl.date,
        libelle: `BL encaissé — ${bl.clientNom} (${bl.livreurNom})`,
        type: "entree",
        categorie: "vente",
        montant: bl.montantTotal,
        reference: bl.id,
        createdBy: "cashman",
      })
    }
    setBls(store.getBonsLivraison())
  }

  const filtered = bls.filter(bl => {
    if (filter.date && bl.date !== filter.date) return false
    if (filter.livreur && !bl.livreurNom.toLowerCase().includes(filter.livreur.toLowerCase())) return false
    if (filter.secteur && !bl.secteur.toLowerCase().includes(filter.secteur.toLowerCase())) return false
    if (filter.prevendeur && !bl.prevendeurNom.toLowerCase().includes(filter.prevendeur.toLowerCase())) return false
    if (filter.client && !bl.clientNom.toLowerCase().includes(filter.client.toLowerCase())) return false
    return true
  })

  const totalEmis = filtered.filter(b => b.statut === "émis").reduce((s, b) => s + b.montantTotal, 0)
  const totalEncaissé = filtered.filter(b => b.statut === "encaissé").reduce((s, b) => s + b.montantTotal, 0)
  const totalGeneral = filtered.reduce((s, b) => s + b.montantTotal, 0)

  const livreurs = [...new Set(bls.map(b => b.livreurNom))]
  const prevendeurs = [...new Set(bls.map(b => b.prevendeurNom).filter(Boolean))]
  const secteurs = [...new Set(bls.map(b => b.secteur).filter(Boolean))]

  const byLivreur = filtered.reduce((acc, bl) => {
    if (!acc[bl.livreurNom]) acc[bl.livreurNom] = { total: 0, count: 0 }
    acc[bl.livreurNom].total += bl.montantTotal
    acc[bl.livreurNom].count++
    return acc
  }, {} as Record<string, { total: number; count: number }>)

  return (
    <div className="flex flex-col gap-5">

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Total BL", value: `${totalGeneral.toLocaleString("fr-MA")} DH`, sub: `${filtered.length} bons`, color: "text-primary", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
          { label: "Encaissé", value: `${totalEncaissé.toLocaleString("fr-MA")} DH`, sub: `${filtered.filter(b => b.statut === "encaissé").length} BL`, color: "text-green-600", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> },
          { label: "En attente", value: `${totalEmis.toLocaleString("fr-MA")} DH`, sub: `${filtered.filter(b => b.statut === "émis").length} BL`, color: "text-amber-600", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
        ].map(k => (
          <div key={k.label} className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${k.color}`} style={{ background: "oklch(0.93 0.012 245)" }}>
              {k.icon}
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-sans font-medium uppercase tracking-wide">{k.label}</p>
              <p className={`text-xl font-bold font-sans ${k.color}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground font-sans">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Par livreur summary */}
      {Object.keys(byLivreur).length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-3 font-sans text-sm uppercase tracking-wide text-muted-foreground">
            Synthèse par Livreur
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(byLivreur).map(([livreur, data]) => (
              <div key={livreur} className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: "oklch(0.93 0.012 245)" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "oklch(0.38 0.2 260)" }}>
                  {livreur[0]}
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground font-sans">{livreur}</p>
                  <p className="text-xs text-muted-foreground font-sans">{data.count} BL · {data.total.toLocaleString("fr-MA")} DH</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card rounded-2xl border border-border p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <input type="date" value={filter.date} onChange={e => setFilter({ ...filter, date: e.target.value })}
          className="col-span-2 md:col-span-1 px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary" />
        <select value={filter.livreur} onChange={e => setFilter({ ...filter, livreur: e.target.value })}
          className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-sans focus:outline-none">
          <option value="">Tous livreurs</option>
          {livreurs.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filter.secteur} onChange={e => setFilter({ ...filter, secteur: e.target.value })}
          className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-sans focus:outline-none">
          <option value="">Tous secteurs</option>
          {secteurs.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filter.prevendeur} onChange={e => setFilter({ ...filter, prevendeur: e.target.value })}
          className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-sans focus:outline-none">
          <option value="">Tous prévendeurs</option>
          {prevendeurs.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input placeholder="Rechercher client..."
          value={filter.client} onChange={e => setFilter({ ...filter, client: e.target.value })}
          className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>

      {/* BL Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr style={{ background: "oklch(0.14 0.03 260)", color: "oklch(0.88 0.015 245)" }}>
                {["Date", "Client", "Secteur", "Livreur", "Prévendeur", "Articles", "Caisses", "Montant", "Statut", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground font-sans">
                  Aucun bon de livraison pour cette sélection
                </td></tr>
              ) : filtered.map(bl => {
                const st = STATUT_STYLE[bl.statut] || STATUT_STYLE["émis"]
                return (
                  <tr key={bl.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{bl.date}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{bl.clientNom}</td>
                    <td className="px-4 py-3 text-muted-foreground">{bl.secteur}</td>
                    <td className="px-4 py-3 text-muted-foreground">{bl.livreurNom}</td>
                    <td className="px-4 py-3 text-muted-foreground">{bl.prevendeurNom || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {bl.lignes.map(l => `${l.articleNom} x${l.quantite}`).join(", ")}
                    </td>
                    {/* Caisses inline edit */}
                    <td className="px-4 py-3">
                      {editingCaisseId === bl.id ? (
                        <div className="flex items-center gap-1.5">
                          <input type="number" min="0" value={editCaisseGros}
                            onChange={e => setEditCaisseGros(e.target.value)}
                            placeholder="Gros" title="Nb grosses caisses"
                            className="w-14 px-2 py-1 rounded-lg border border-amber-300 bg-amber-50 text-xs font-bold text-amber-900 focus:outline-none" />
                          <input type="number" min="0" value={editCaisseDemi}
                            onChange={e => setEditCaisseDemi(e.target.value)}
                            placeholder="Demi" title="Nb demi-caisses"
                            className="w-14 px-2 py-1 rounded-lg border border-cyan-300 bg-cyan-50 text-xs font-bold text-cyan-900 focus:outline-none" />
                          <button onClick={() => saveCaisseOnBL(bl.id, Number(editCaisseGros)||0, Number(editCaisseDemi)||0)}
                            className="px-2 py-1 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-700">OK</button>
                          <button onClick={() => setEditingCaisseId(null)}
                            className="px-2 py-1 rounded-lg text-xs font-bold text-muted-foreground bg-muted hover:bg-border">X</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingCaisseId(bl.id); setEditCaisseGros(String(bl.nbCaisseGros ?? 0)); setEditCaisseDemi(String(bl.nbCaisseDemi ?? 0)) }}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          {(bl.nbCaisseGros ?? 0) > 0 || (bl.nbCaisseDemi ?? 0) > 0 ? (
                            <span className="font-semibold text-amber-700">
                              {bl.nbCaisseGros ?? 0}G + {bl.nbCaisseDemi ?? 0}D
                              {bl.montantCaisses ? <span className="ml-1 text-xs text-amber-600">({bl.montantCaisses} DH)</span> : null}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 italic">— saisir</span>
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-primary whitespace-nowrap">
                      {(bl.montantTotal + (bl.montantCaisses ?? 0)).toLocaleString("fr-MA")} DH
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {bl.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {/* Print BL — opens frais config modal */}
                        <button
                          onClick={() => setPrintFraisId(bl.id)}
                          title="Imprimer BL"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={{ background: "oklch(0.38 0.2 260 / 0.1)", color: "oklch(0.38 0.2 260)" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "oklch(0.38 0.2 260 / 0.2)" }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "oklch(0.38 0.2 260 / 0.1)" }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                          BL
                        </button>
                        {/* Print Facture */}
                        <button
                          onClick={() => printFactureLib(bl, bl.id)}
                          title="Imprimer Facture"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={{ background: "oklch(0.60 0.16 195 / 0.1)", color: "oklch(0.60 0.16 195)" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "oklch(0.60 0.16 195 / 0.2)" }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "oklch(0.60 0.16 195 / 0.1)" }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          FAC
                        </button>
                        {/* Encaisser */}
                        {bl.statut === "émis" && (
                          <button
                            onClick={() => handleEncaisser(bl.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-80"
                            style={{ background: "oklch(0.65 0.17 145)" }}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Enc.
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr style={{ background: "oklch(0.93 0.012 245)" }}>
                  <td colSpan={6} className="px-4 py-3 font-semibold text-foreground font-sans text-sm">Total</td>
                  <td className="px-4 py-3 font-bold text-primary font-sans">{totalGeneral.toLocaleString("fr-MA")} DH</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Frais BL Print Modal ─────────────────────────────────────────── */}
      {printFraisId && (() => {
        const bl = bls.find(b => b.id === printFraisId)
        if (!bl) return null
        const totalNbCaisses = (bl.nbCaisseGros ?? 0) + (bl.nbCaisseDemi ?? 0)
        const fraisImpr = fraisConfig.fraisImpressionParFeuille * fraisConfig.nbFeuilles
        const fraisServ = fraisConfig.fraisServiceParCaisse * totalNbCaisses
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
            <div className="bg-card rounded-2xl border border-border w-full max-w-sm flex flex-col gap-5 p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Frais supplementaires BL</h3>
                  <p className="text-xs text-muted-foreground">{bl.clientNom} — {bl.date}</p>
                </div>
                <button onClick={() => setPrintFraisId(null)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground text-sm font-bold">
                  ×
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {/* Frais impression */}
                <div className="p-3 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                  <p className="text-xs font-bold text-foreground">Frais d&apos;impression</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-slate-700">DH / feuille</label>
                      <input type="number" min="0" step="0.5"
                        value={fraisConfig.fraisImpressionParFeuille}
                        onChange={e => saveFraisConfig({ ...fraisConfig, fraisImpressionParFeuille: Number(e.target.value) })}
                        className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-slate-700">Nb feuilles</label>
                      <input type="number" min="1" step="1"
                        value={fraisConfig.nbFeuilles}
                        onChange={e => saveFraisConfig({ ...fraisConfig, nbFeuilles: Number(e.target.value) })}
                        className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  </div>
                  {fraisImpr > 0 && (
                    <p className="text-xs text-blue-700 font-semibold">= {fraisImpr} DH frais impression</p>
                  )}
                </div>

                {/* Frais service */}
                <div className="p-3 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                  <p className="text-xs font-bold text-foreground">Frais de service</p>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-slate-700">DH / caisse (gros + demi)</label>
                    <input type="number" min="0" step="0.5"
                      value={fraisConfig.fraisServiceParCaisse}
                      onChange={e => saveFraisConfig({ ...fraisConfig, fraisServiceParCaisse: Number(e.target.value) })}
                      className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  {fraisServ > 0 && (
                    <p className="text-xs text-blue-700 font-semibold">= {totalNbCaisses} caisses × {fraisConfig.fraisServiceParCaisse} DH = {fraisServ} DH</p>
                  )}
                  {totalNbCaisses === 0 && (
                    <p className="text-[11px] text-muted-foreground">Aucune caisse saisie sur ce BL</p>
                  )}
                </div>

                {/* Total preview */}
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-primary/5 border border-primary/20">
                  <span className="text-xs font-bold text-foreground">Marchandise + Frais</span>
                  <span className="text-sm font-extrabold text-primary">
                    {(bl.montantTotal + (bl.montantCaisses ?? 0) + fraisImpr + fraisServ).toLocaleString("fr-MA", { minimumFractionDigits: 2 })} DH
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setPrintFraisId(null)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted">
                  Annuler
                </button>
                <button onClick={() => {
                  printBL({
                    ...(bl as Parameters<typeof printBL>[0]),
                    fraisImpressionParFeuille: fraisConfig.fraisImpressionParFeuille,
                    nbFeuilles: fraisConfig.nbFeuilles,
                    fraisServiceParCaisse: fraisConfig.fraisServiceParCaisse,
                  } as Parameters<typeof printBL>[0])
                  setPrintFraisId(null)
                }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-1.5"
                  style={{ background: "oklch(0.38 0.2 260)" }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  Imprimer BL
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
