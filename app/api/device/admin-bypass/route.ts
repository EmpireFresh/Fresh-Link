import { NextRequest, NextResponse } from "next/server"
import { signSadminToken, SADMIN_COOKIE, DEVICE_BYPASS } from "@/lib/deviceGuard"

/**
 * GET /api/device/admin-bypass?key=<bypass>&to=<destination>
 *
 * Route Node.js (pas Edge) qui pose le cookie sadmin permanent.
 * Appelée par le middleware quand le bypass key est détecté dans l'URL.
 * Permet à Jawad d'accéder sans passer par le device guard.
 *
 * Exemple: https://f-l.vercel.app/api/device/admin-bypass?key=vita-bypass-2026&to=/
 */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? ""
  const to  = req.nextUrl.searchParams.get("to")  ?? "/"

  // Vérifier la clé bypass
  if (key !== DEVICE_BYPASS) {
    return NextResponse.json({ error: "Clé invalide" }, { status: 403 })
  }

  // Signer le token sadmin (Node.js crypto OK ici)
  const sadminToken = signSadminToken("jawad-bypass")

  // Rediriger vers la destination avec le cookie posé
  const destination = req.nextUrl.origin + (to.startsWith("/") ? to : "/" + to)
  const response = NextResponse.redirect(destination)

  response.cookies.set(SADMIN_COOKIE, sadminToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   30 * 24 * 60 * 60,   // 30 jours
  })

  return response
}
