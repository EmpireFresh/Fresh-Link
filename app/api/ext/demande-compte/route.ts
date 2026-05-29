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
const SB_SRV    = process.env.SUPABASE_SERVICE_ROLE_KEY    ?? SB_ANON

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

  const { type, nom, email, telephone, societe, ice, ville, message } = body

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
  const hasServiceKey = !!(process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (hasServiceKey) {
    // 1. Vérifier doublon
    const exists = await phoneExists(telNorm)
    if (exists) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec ce numéro de téléphone. Connectez-vous directement." },
        { status: 409, headers: cors(origin) }
      )
    }

    // 2. Générer identifiants
    const userId   = `VFU${Date.now().toString(36).toUpperCase().slice(-5)}`
    const clientId = `VFC${Date.now().toString(36).toUpperCase().slice(-5)}`
    const password = genPassword(telNorm)

    // 3. Créer fl_users
    const userPayload = {
      name:      nomTrimmed,
      telephone: telNorm,
      email:     email?.trim()?.toLowerCase() || null,
      password,
      role:      roleUser,
      clientId,
      actif:     true,
      sousType,
      createdAt: new Date().toISOString(),
    }
    const userOk = await sbUpsert("fl_users", userId, userPayload)

    // 4. Créer fl_clients (profil)
    const clientPayload = {
      nom:        nomTrimmed,
      telephone:  telNorm,
      email:      email?.trim()?.toLowerCase() || null,
      societe:    societe?.trim() || null,
      ice:        ice?.trim() || null,
      ville:      ville?.trim() || null,
      categorie:  sousType,
      segment:    sousType === "chr" ? "CHR" : sousType === "marchand" ? "Marchand" : "standard",
      actif:      true,
      remisePct:  0,
      remiseActive: false,
      loyaltyPoints: 0,
      promotions: [],
      userId,
      createdAt:  new Date().toISOString(),
    }
    await sbUpsert(isFournisseur ? "fl_fournisseurs" : "fl_clients", clientId, clientPayload)

    // 5. Enregistrer dans fl_account_requests (historique)
    try {
      await fetch(`${SB_URL}/rest/v1/fl_account_requests`, {
        method:  "POST",
        headers: {
          apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}`,
          "Content-Type": "application/json", Prefer: "return=minimal",
        },
        body: JSON.stringify({
          type: roleUser, sous_type: sousType,
          nom: nomTrimmed, email: email?.trim()?.toLowerCase() || null,
          telephone: telNorm, societe: societe?.trim() || null,
          ice: ice?.trim() || null, ville: ville?.trim() || null,
          message: message?.trim() || null,
          statut: "approuve", userId,
          created_at: new Date().toISOString(),
        }),
      })
    } catch {}

    if (userOk) {
      return NextResponse.json({
        statut:   "actif",
        password,
        message:  `Compte créé avec succès ! Connectez-vous avec le ${telNorm} et le mot de passe ci-dessous.`,
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
