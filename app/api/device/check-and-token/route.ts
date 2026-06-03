import { NextRequest, NextResponse } from "next/server"
import { signDeviceToken, DEVICE_COOKIE } from "@/lib/deviceGuard"

/**
 * POST /api/device/check-and-token
 *
 * Vérifie si un device est approuvé dans Supabase fl_site_access.
 * Si oui → signe un HMAC token + pose le cookie fl_device_token.
 * Appelé en polling depuis la page /device-blocked.
 *
 * Body    : { fingerprint: string }
 * Returns : { approved: true }  avec Set-Cookie
 *         | { approved: false, statut: string }
 *         | { error: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { fingerprint } = (await req.json()) as { fingerprint?: string }

    if (!fingerprint) {
      return NextResponse.json({ error: "fingerprint requis" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.service_role ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // ── Mode dégradé : Supabase non configuré → approuver automatiquement ──
    if (!supabaseUrl || !supabaseKey) {
      const token = signDeviceToken(fingerprint)
      const res   = NextResponse.json({ approved: true, degraded: true })
      res.cookies.set(DEVICE_COOKIE, token, cookieOpts())
      return res
    }

    // ── Vérifier dans Supabase (format JSONB {id, payload}, clé service_role) ──
    const sbRes = await fetch(
      `${supabaseUrl}/rest/v1/fl_site_access?id=eq.${encodeURIComponent(fingerprint)}&select=payload`,
      {
        headers: {
          apikey:        supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        cache: "no-store",
      }
    )

    if (!sbRes.ok) {
      return NextResponse.json({ error: "Erreur Supabase" }, { status: 502 })
    }

    const rows = (await sbRes.json()) as Array<{ payload?: { statut?: string } }>

    if (!rows.length) {
      return NextResponse.json({ approved: false, statut: "not_found" })
    }

    const statut = rows[0]?.payload?.statut ?? "en_attente"

    if (statut === "autorise") {
      // ✅ Approuvé → signer le token et poser le cookie
      const token = signDeviceToken(fingerprint)
      const res   = NextResponse.json({ approved: true })
      res.cookies.set(DEVICE_COOKIE, token, cookieOpts())
      return res
    }

    if (statut === "bloque") {
      return NextResponse.json({ approved: false, statut: "bloque" })
    }

    // en_attente ou autre
    return NextResponse.json({ approved: false, statut })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[check-and-token]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function cookieOpts() {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge:   14 * 24 * 60 * 60,  // 14 jours
    path:     "/",
  }
}
