import { NextRequest, NextResponse } from "next/server"

// ══════════════════════════════════════════════════════════════════
// /api/ext/init-supabase — Initialize Gift Catalog
// RLS Policies must be created manually via Supabase SQL Editor
// ══════════════════════════════════════════════════════════════════

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

async function sbFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      apikey: SB_SERVICE_KEY,
      Authorization: `Bearer ${SB_SERVICE_KEY}`,
    },
  })
}

export async function POST(req: NextRequest) {
  if (!SB_SERVICE_KEY) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 500 }
    )
  }

  const action = req.nextUrl.searchParams.get("action") ?? "gifts"

  try {
    if (action === "gifts") {
      // Initialize Gift Catalog with stock quantities
      const gifts = [
        {
          id: "GM_BALANCE",
          nom: "Balance Numérique Pro 30kg",
          segment: "marchand",
          description: "Balance pro pour épiceries / marchands F&L",
          seuil_type: "volume_kg",
          seuil_valeur: 1000,
          cout_unitaire: 850,
          stock_qte: 3,
          actif: true,
        },
        {
          id: "GM_PACKPRO",
          nom: "Pack Pro Couteaux de Chef",
          segment: "chr",
          description: "Set couteaux pro pour CHR",
          seuil_type: "volume_kg",
          seuil_valeur: 800,
          cout_unitaire: 1200,
          stock_qte: 5,
          actif: true,
        },
        {
          id: "GM_CAISSE",
          nom: "Lot 10 Caisses Plastiques",
          segment: "marchand",
          description: "Caisses de transport réutilisables",
          seuil_type: "volume_kg",
          seuil_valeur: 500,
          cout_unitaire: 350,
          stock_qte: 10,
          actif: true,
        },
        {
          id: "GM_TABLIER",
          nom: "Tabliers + Toques (x5)",
          segment: "chr",
          description: "Tenue cuisine brandée Vita Fresh",
          seuil_type: "montant_mad",
          seuil_valeur: 20000,
          cout_unitaire: 400,
          stock_qte: 8,
          actif: true,
        },
        {
          id: "GM_FRIGO",
          nom: "Vitrine Réfrigérée",
          segment: "marchand",
          description: "Vitrine fraîcheur (gros volume / contrat annuel)",
          seuil_type: "contrat",
          seuil_valeur: 1,
          cout_unitaire: 6500,
          stock_qte: 1,
          actif: true,
        },
        {
          id: "GM_PARASOL",
          nom: "Parasol + Étal Pro",
          segment: "marchand",
          description: "Étal marché brandé",
          seuil_type: "volume_kg",
          seuil_valeur: 1500,
          cout_unitaire: 900,
          stock_qte: 2,
          actif: true,
        },
        {
          id: "GM_BONCADO",
          nom: "Bon cadeau fidélité 500 MAD",
          segment: "tous",
          description: "Bon d'achat fidélité tous segments",
          seuil_type: "montant_mad",
          seuil_valeur: 50000,
          cout_unitaire: 500,
          stock_qte: 50,
          actif: true,
        },
      ]

      let created = 0
      const errors = []

      for (const gift of gifts) {
        try {
          const res = await sbFetch("fl_gift_materials", {
            method: "POST",
            headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify(gift),
          })
          if (res.ok) created++
          else errors.push(`${gift.id}: ${res.status}`)
        } catch (e) {
          errors.push(`${gift.id}: ${String(e)}`)
        }
      }

      return NextResponse.json({
        ok: created > 0,
        message: `✅ ${created}/${gifts.length} gifts initialized`,
        created,
        total: gifts.length,
        errors: errors.length > 0 ? errors : undefined,
      })
    }

    return NextResponse.json(
      { ok: false, error: "Unknown action. Use ?action=gifts" },
      { status: 400 }
    )
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return NextResponse.json(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
