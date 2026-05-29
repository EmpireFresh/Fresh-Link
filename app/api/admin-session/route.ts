import { NextRequest, NextResponse } from "next/server"
import { signSadminToken, verifySadminToken, SADMIN_COOKIE, DEVICE_BYPASS } from "@/lib/deviceGuard"

/**
 * POST /api/admin-session
 * Appelé par le LoginPage après authentification réussie d'un super_super_admin.
 * Pose un cookie httpOnly signé HMAC qui exempe ce device du Device Guard.
 *
 * Body JSON : { userId: string }
 * Returns   : { ok: true } ou { ok: false, error }
 *
 * Sécurité : le cookie ne peut pas être forgé sans DEVICE_SECRET (variable serveur).
 * Le Device Guard n'est qu'une couche additionnelle — l'auth principale reste localStorage.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = (await req.json()) as { userId?: string }
    if (!userId) {
      return NextResponse.json({ ok: false, error: "userId requis" }, { status: 400 })
    }

    // Le middleware Edge compare: cookie === DEVICE_BYPASS + ".sadmin"
    // On doit poser exactement ce format — pas le token HMAC Node.js
    const token = DEVICE_BYPASS + ".sadmin"
    const res   = NextResponse.json({ ok: true })

    res.cookies.set(SADMIN_COOKIE, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge:   30 * 24 * 60 * 60,   // 30 jours
    })

    return res
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

/**
 * GET /api/admin-session
 * Vérifie si le cookie sadmin est valide.
 * Returns : { valid: boolean; userId?: string }
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SADMIN_COOKIE)?.value
  if (!token) return NextResponse.json({ valid: false })
  const userId = verifySadminToken(token)
  return NextResponse.json({ valid: !!userId, userId: userId ?? undefined })
}

/**
 * DELETE /api/admin-session
 * Révoque le cookie sadmin (logout).
 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SADMIN_COOKIE, "", { maxAge: 0, path: "/" })
  return res
}
