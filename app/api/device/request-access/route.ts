import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/device/request-access
 *
 * Enregistre une demande d'accès dans fl_site_access (Supabase).
 * Appelé par la page /device-blocked après collecte GPS.
 *
 * Body : { fingerprint, nom, phone, gps_lat?, gps_lng?, gps_precision?, userAgent? }
 * Returns : { ok: true, deviceId } | { error }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fingerprint, nom, phone, gps_lat, gps_lng, gps_precision, userAgent } = body

    if (!fingerprint) {
      return NextResponse.json({ error: "fingerprint requis" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      // Supabase non configuré → on laisse passer (mode ouvert dégradé)
      return NextResponse.json({ ok: true, deviceId: fingerprint, degraded: true })
    }

    const row: Record<string, unknown> = {
      id:             fingerprint,
      device_id:      fingerprint,
      nom:            nom || null,
      telephone:      phone || null,
      statut:         "en_attente",
      user_agent:     (userAgent || "").slice(0, 250),
      first_visit_at: new Date().toISOString(),
      updated_at:     new Date().toISOString(),
    }
    if (gps_lat !== undefined && gps_lat !== null) {
      row.gps_lat       = gps_lat
      row.gps_lng       = gps_lng
      row.gps_precision = gps_precision
    }

    const sbRes = await fetch(
      `${supabaseUrl}/rest/v1/fl_site_access`,
      {
        method: "POST",
        headers: {
          apikey:          supabaseKey,
          Authorization:   `Bearer ${supabaseKey}`,
          "Content-Type":  "application/json",
          "Prefer":        "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(row),
      }
    )

    if (!sbRes.ok && sbRes.status !== 409) {
      const err = await sbRes.text()
      console.error("[request-access] Supabase error:", err)
      // Ne pas bloquer l'utilisateur si Supabase est KO
    }

    return NextResponse.json({ ok: true, deviceId: fingerprint })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[request-access]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
