import { NextRequest, NextResponse } from "next/server"

// ══════════════════════════════════════════════════════════════════
// /api/ext/init-supabase — Initialize RLS Policies + Gifts Catalog
// ══════════════════════════════════════════════════════════════════

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

async function executeSQL(sql: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        apikey: SB_SERVICE_KEY,
        Authorization: `Bearer ${SB_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
    })
    if (!res.ok) throw new Error(await res.text())
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function POST(req: NextRequest) {
  if (!SB_SERVICE_KEY) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 500 }
    )
  }

  const action = req.nextUrl.searchParams.get("action") ?? "rls"

  try {
    if (action === "rls") {
      // Create RLS Policies
      const policies = [
        `CREATE POLICY IF NOT EXISTS "public_read_articles" ON public.fl_articles
          FOR SELECT
          USING (published = true OR auth.uid() IS NOT NULL);`,

        `CREATE POLICY IF NOT EXISTS "auth_read_commandes" ON public.fl_commandes_web
          FOR SELECT
          USING (auth.uid() IS NOT NULL);`,

        `CREATE POLICY IF NOT EXISTS "auth_insert_commandes" ON public.fl_commandes_web
          FOR INSERT
          WITH CHECK (auth.uid() IS NOT NULL);`,

        `CREATE POLICY IF NOT EXISTS "auth_insert_feedbacks" ON public.fl_feedbacks
          FOR INSERT
          WITH CHECK (auth.uid() IS NOT NULL);`,
      ]

      const results = []
      for (const policy of policies) {
        const res = await fetch(`${SB_URL}/rest/v1/`, {
          method: "POST",
          headers: {
            apikey: SB_SERVICE_KEY,
            Authorization: `Bearer ${SB_SERVICE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ query: policy }),
        })
        results.push({ policy: policy.slice(0, 50), status: res.status })
      }

      return NextResponse.json({
        ok: true,
        message: "✅ RLS Policies initialization started",
        results,
      })
    }

    if (action === "gifts") {
      // Initialize Gift Catalog
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
        },
      ]

      let created = 0
      for (const gift of gifts) {
        const res = await fetch(`${SB_URL}/rest/v1/fl_gift_materials`, {
          method: "POST",
          headers: {
            apikey: SB_SERVICE_KEY,
            Authorization: `Bearer ${SB_SERVICE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify({ ...gift, actif: true }),
        })
        if (res.ok) created++
      }

      return NextResponse.json({
        ok: true,
        message: `✅ ${created}/${gifts.length} gifts initialized`,
        created,
        total: gifts.length,
      })
    }

    return NextResponse.json(
      { ok: false, error: "Unknown action" },
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
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
