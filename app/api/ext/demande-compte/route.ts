import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"

// ══════════════════════════════════════════════════════════════
// POST /api/ext/demande-compte — Création automatique de compte client
//
// Nouveau comportement :
//   1. Vérifie que le numéro n'existe pas déjà dans fl_users
//   2. Génère un mot de passe mémorisable
//   3. Crée l'entrée fl_users (role: client) dans Supabase
//   4. Crée l'entrée fl_clients (profil) dans Supabase
//   5. Retourne { statut:"actif", password } → le client se connecte immédiatement
//
// Sans SUPABASE_SERVICE_ROLE_KEY → fallback "en_attente" (admin manuel)
// ══════════════════════════════════════════════════════════════

const SB_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SB_ANON   = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
const SB_SRV    = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role || process.env.SUPABASE_SERVICE_KEY)    ?? SB_ANON

function cors(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
  }
}

/** Génère un mot de passe mémorisable: Majuscule + 5 lettres + 3 chiffres */
function genPassword(phone: string): string {
  const consonants = "BCDFGHJKLMNPQRSTVWXYZ"
  const vowels     = "AEIOU"
  const digits     = phone.replace(/\D/g, "").slice(-4)  // 4 derniers chiffres du tél
  const letter1    = consonants[Math.floor(Math.random() * consonants.length)]
  const letter2    = vowels[Math.floor(Math.random() * vowels.length)]
  const letter3    = consonants[Math.floor(Math.random() * consonants.length)]
  return `${letter1}${letter2}${letter3}${digits}`  // ex: "FAR4567"
}

/** Normalise un numéro marocain → format court 06XXXXXXXX */
function normPhone(raw: string): string {
  const d = raw.replace(/[\s\-\.\(\)\+]/g, "")
  let base = d
  if (base.startsWith("00212")) base = base.slice(5)
  else if (base.startsWith("212")) base = base.slice(3)
  else if (base.startsWith("0"))   base = base.slice(1)
  return "0" + base
}

/** Calcule le prochain ID séquentiel pour une table (compte les rows existantes). */
async function nextSequentialId(table: string, prefix: string): Promise<string> {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/${table}?select=id&limit=10000`,
      { headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}` }, cache: "no-store" },
    )
    if (!res.ok) return `${prefix}${Date.now().toString(36).toUpperCase().slice(-5)}`
    const rows: { id: string }[] = await res.json()
    // Cherche le plus grand suffixe numérique existant avec ce préfixe
    let max = 0
    const regex = new RegExp(`^${prefix}(\\d+)$`)
    for (const r of rows) {
      const m = String(r.id).match(regex)
      if (m) {
        const n = parseInt(m[1], 10)
        if (n > max) max = n
      }
    }
    return `${prefix}${String(max + 1).padStart(5, "0")}`
  } catch {
    return `${prefix}${Date.now().toString(36).toUpperCase().slice(-5)}`
  }
}

/** Upsert dans Supabase avec service role */
async function sbUpsert(table: string, id: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method:  "POST",
      headers: {
        apikey:         SB_SRV,
        Authorization:  `Bearer ${SB_SRV}`,
        "Content-Type": "application/json",
        Prefer:         "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ id, payload, updated_at: new Date().toISOString() }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Vérifie si un téléphone existe déjà dans fl_users */
async function phoneExists(tel: string): Promise<boolean> {
  try {
    const tels = [tel, tel.replace(/^0/, "212")]
    for (const t of tels) {
      const res = await fetch(
        `${SB_URL}/rest/v1/fl_users?select=id,payload&limit=100`,
        { headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}` } }
      )
      if (!res.ok) break
      const rows: { id: string; payload: Record<string, unknown> }[] = await res.json()
      const found = rows.some(r => {
        const p = r.payload ?? {}
        const stored = String(p.telephone ?? p.phone ?? "").replace(/[\s\-\.]/g, "")
        const norm   = stored.startsWith("0") ? stored : "0" + stored.replace(/^212/, "")
        return norm === tel
      })
      if (found) return true
    }
    return false
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")

  let body: Record<string, string> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400, headers: cors(origin) })
  }

  const {
    type, nom, email, telephone, societe, ice, ville, message, origine,
    // Champs étendus alignés sur le BO (BOComptesExternes)
    adresse, secteur, sousType: bodySousType,
    taille, rotation, modalitePaiement,
    produits, volumeKgSemaine, origineProduction,
    origineDetail,
    // Géolocalisation (consentement client) — pour la gestion du circuit de livraison
    gps_lat, gps_lng, gps_precision, gps_consent,
  } = body

  // ── Validation ────────────────────────────────────────────────────────────
  const VALID_TYPES = ["client", "chr", "marchand", "particulier", "fournisseur"]
  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Type invalide." }, { status: 400, headers: cors(origin) })
  }
  if (!nom?.trim() || !telephone?.trim()) {
    return NextResponse.json({ error: "Nom et téléphone sont requis." }, { status: 400, headers: cors(origin) })
  }

  const telNorm   = normPhone(telephone.trim())
  const nomTrimmed = nom.trim()
  const isFournisseur = type === "fournisseur"
  const roleUser  = isFournisseur ? "fournisseur" : "client"
  const sousType  = type  // chr / marchand / particulier / client / fournisseur

  // ── Mode auto (SERVICE_ROLE_KEY disponible) ───────────────────────────────
  const hasServiceKey = !!((process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role || process.env.SUPABASE_SERVICE_KEY))

  // ── Règles d'auto-approbation (configurables dans le BO « Demandes Comptes ») ──
  //    Config = ligne __autoapprove de fl_account_requests, payload :
  //    { enabled, autoTypes:[], phonePrefixes:[], gpsZones:[{lat,lng,radiusKm}] }
  //    Désactivée/absente → tous auto-approuvés (comportement par défaut, non bloquant).
  let autoApproved = true
  try {
    const cfgRes = await fetch(`${SB_URL}/rest/v1/fl_account_requests?id=eq.__autoapprove&select=payload`,
      { headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}` }, cache: "no-store" })
    if (cfgRes.ok) {
      const cfgRows = await cfgRes.json() as { payload?: Record<string, unknown> }[]
      const cfg = cfgRows?.[0]?.payload as Record<string, unknown> | undefined
      if (cfg && cfg.enabled === true) {
        autoApproved = false
        const types    = Array.isArray(cfg.autoTypes)     ? cfg.autoTypes as string[]     : []
        const prefixes = Array.isArray(cfg.phonePrefixes) ? cfg.phonePrefixes as string[] : []
        const zones    = Array.isArray(cfg.gpsZones)      ? cfg.gpsZones as { lat:number; lng:number; radiusKm:number }[] : []
        if (types.map(t => String(t).toLowerCase()).includes(String(sousType).toLowerCase())) autoApproved = true
        if (!autoApproved && prefixes.some(p => telNorm.startsWith(String(p).replace(/\D/g, "")))) autoApproved = true
        if (!autoApproved && gps_lat != null && gps_lng != null) {
          const toR = (x: number) => (x * Math.PI) / 180
          for (const z of zones) {
            const dLat = toR(Number(gps_lat) - Number(z.lat)), dLng = toR(Number(gps_lng) - Number(z.lng))
            const a = Math.sin(dLat/2)**2 + Math.cos(toR(Number(z.lat))) * Math.cos(toR(Number(gps_lat))) * Math.sin(dLng/2)**2
            const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
            if (km <= (Number(z.radiusKm) || 5)) { autoApproved = true; break }
          }
        }
      }
    }
  } catch { /* config absente → auto-approuvé par défaut */ }

  if (hasServiceKey) {
    // 1. Vérifier doublon
    const exists = await phoneExists(telNorm)
    if (exists) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec ce numéro de téléphone. Connectez-vous directement." },
        { status: 409, headers: cors(origin) }
      )
    }

    // 2. Générer identifiants séquentiels (compteur sur Supabase)
    const userId   = await nextSequentialId("fl_users",                            "VFU")
    const clientId = await nextSequentialId(isFournisseur ? "fl_fournisseurs" : "fl_clients", isFournisseur ? "VFS" : "VFC")
    const password = genPassword(telNorm)

    // 3. Créer fl_users
    const userPayload = {
      name:      nomTrimmed,
      telephone: telNorm,
      email:     email?.trim()?.toLowerCase() || null,
      password,
      role:      roleUser,
      clientId,
      actif:     autoApproved,   // auto-approuvé → actif ; sinon en attente de validation
      sousType,
      createdAt: new Date().toISOString(),
    }
    const userOk = await sbUpsert("fl_users", userId, userPayload)

    // 4. Créer fl_clients / fl_fournisseurs (profil étendu, aligné sur BO)
    const clientPayload: Record<string, unknown> = {
      nom:        nomTrimmed,
      telephone:  telNorm,
      email:      email?.trim()?.toLowerCase() || null,
      societe:    societe?.trim() || null,
      ice:        ice?.trim() || null,
      adresse:    adresse?.trim() || null,
      ville:      ville?.trim() || null,
      secteur:    secteur?.trim() || null,
      categorie:  sousType,
      segment:    sousType === "chr" ? "CHR" : sousType === "marchand" ? "Marchand" : "standard",
      // Sous-type métier détaillé (CHR : restaurant/hotel/cafe... · Marchand : epicerie/grossiste...)
      type:       bodySousType?.trim() || null,
      // Conditions commerciales (CHR / Marchand)
      taille:     taille?.trim() || null,
      rotation:   rotation?.trim() || null,
      modalitePaiement: modalitePaiement?.trim() || "cash",
      // Tracking marketing (avec détail)
      origine:    origine || null,
      origineDetail: origineDetail?.trim() || null,
      // Spécifique fournisseur
      ...(isFournisseur ? {
        produits:           produits?.trim() || null,
        volumeKgSemaine:    Number(volumeKgSemaine) || null,
        origineProduction:  origineProduction?.trim() || null,
      } : {}),
      // Géolocalisation (si consentement client) — gestion du circuit de livraison
      ...(gps_lat != null && gps_lng != null ? {
        gps_lat: Number(gps_lat), gps_lng: Number(gps_lng),
        gps_precision: gps_precision != null ? Number(gps_precision) : null,
        gps_consent: gps_consent === true,
      } : {}),
      // Defaults
      actif:      autoApproved,
      remisePct:  0,
      remiseActive: false,
      loyaltyPoints: 0,
      promotions: [],
      userId,
      createdAt:  new Date().toISOString(),
    }
    await sbUpsert(isFournisseur ? "fl_fournisseurs" : "fl_clients", clientId, clientPayload)

    // 5. Enregistrer la DEMANDE dans fl_account_requests (format JSONB {id, payload})
    //    → visible dans le BO « Demandes Comptes » pour validation par l'admin.
    try {
      const reqId = "REQ-" + userId
      await fetch(`${SB_URL}/rest/v1/fl_account_requests`, {
        method:  "POST",
        headers: {
          apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}`,
          "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          id: reqId,
          payload: {
            type: roleUser, sous_type: sousType,
            nom: nomTrimmed, email: email?.trim()?.toLowerCase() || null,
            telephone: telNorm, societe: societe?.trim() || null,
            ice: ice?.trim() || null, ville: ville?.trim() || null,
            message: message?.trim() || null,
            statut: autoApproved ? "approuve" : "en_attente",
            auto_approved: autoApproved,
            origine: origine || "web",
            ...(gps_lat != null && gps_lng != null ? { gps_lat: Number(gps_lat), gps_lng: Number(gps_lng), gps_precision: gps_precision != null ? Number(gps_precision) : null } : {}),
            userId, _linkedUserId: userId, _linkedClientId: clientId,
            created_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        }),
      })
    } catch {}

    if (userOk) {
      return NextResponse.json({
        statut:       autoApproved ? "actif" : "en_attente",
        autoApproved,
        password,
        message:      autoApproved
          ? `Compte créé avec succès ! Connectez-vous avec le ${telNorm} et le mot de passe ci-dessous.`
          : `Compte créé ! Il sera activé après validation par notre équipe. Notez bien votre mot de passe ci-dessous.`,
        user: { id: userId, name: nomTrimmed, telephone: telNorm, role: roleUser },
      }, { status: 201, headers: cors(origin) })
    }
  }

  // ── Fallback : mode en attente (sans SERVICE_KEY ou si upsert échoue) ─────
  if (SB_ANON) {
    try {
      await fetch(`${SB_URL}/rest/v1/fl_account_requests`, {
        method:  "POST",
        headers: {
          apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`,
          "Content-Type": "application/json", Prefer: "return=minimal",
        },
        body: JSON.stringify({
          type: roleUser, sous_type: sousType,
          nom: nomTrimmed, email: email?.trim()?.toLowerCase() || null,
          telephone: telNorm, societe: societe?.trim() || null,
          message: message?.trim() || null,
          statut: "en_attente",
          created_at: new Date().toISOString(),
        }),
      })
    } catch {}
  }

  return NextResponse.json({
    statut:  "en_attente",
    message: "Votre demande a été enregistrée. Notre équipe vous contactera sous 24h.",
  }, { status: 201, headers: cors(origin) })
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) })
}
