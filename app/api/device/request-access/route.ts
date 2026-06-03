import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/device/request-access
 *
 * Enregistre une demande d'accès dans fl_site_access (Supabase) au format JSONB {id, payload}.
 * Utilise la clé service_role (bypass RLS) — appelé par des appareils non encore approuvés.
 * Appelé par la page /device-blocked après collecte GPS.
 *
 * Body : { fingerprint, nom, phone, gps_lat?, gps_lng?, gps_precision?, userAgent? }
 * Returns : { ok: true, deviceId } | { error }
 */
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SB_SRV =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.service_role ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ""

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fingerprint, nom, phone, gps_lat, gps_lng, gps_precision, userAgent } = body

    if (!fingerprint) {
      return NextResponse.json({ error: "fingerprint requis" }, { status: 400 })
    }

    if (!SB_URL || !SB_SRV) {
      // Supabase non configuré → on laisse passer (mode ouvert dégradé)
      return NextResponse.json({ ok: true, deviceId: fingerprint, degraded: true })
    }

    const now = new Date().toISOString()
    const payload: Record<string, unknown> = {
      device_id:      fingerprint,
      nom:            nom || null,
      telephone:      phone || null,
      statut:         "en_attente",
      user_agent:     (userAgent || "").slice(0, 250),
      first_visit_at: now,
      updated_at:     now,
    }
    if (gps_lat !== undefined && gps_lat !== null) {
      payload.gps_lat       = gps_lat
      payload.gps_lng       = gps_lng
      payload.gps_precision = gps_precision
    }

    // Format JSONB {id, payload} comme toutes les tables fl_*.
    // resolution=ignore-duplicates : une revisite ne réinitialise PAS un statut déjà accordé.
    const sbRes = await fetch(`${SB_URL}/rest/v1/fl_site_access`, {
      method: "POST",
      headers: {
        apikey:         SB_SRV,
        Authorization:  `Bearer ${SB_SRV}`,
        "Content-Type": "application/json",
        Prefer:         "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify({ id: fingerprint, payload, updated_at: now }),
    })

    if (!sbRes.ok && sbRes.status !== 409) {
      const err = await sbRes.text()
      console.error("[request-access] Supabase error:", sbRes.status, err)
      // Ne pas bloquer l'utilisateur si Supabase est KO
    }

    return NextResponse.json({ ok: true, deviceId: fingerprint })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[request-access]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
