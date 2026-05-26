import { NextRequest, NextResponse } from "next/server"
import { SADMIN_COOKIE, DEVICE_BYPASS } from "@/lib/deviceGuard"

/**
 * GET /api/device/admin-bypass?key=<bypass>&to=<destination>
 *
 * Pose le cookie sadmin et redirige vers la destination.
 * La valeur du cookie est DEVICE_BYPASS + ".sadmin" (pas de HMAC)
 * afin d'être vérifiable dans le Edge Runtime sans crypto Node.js.
 */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? ""
  const to  = req.nextUrl.searchParams.get("to")  ?? "/"

  if (key !== DEVICE_BYPASS) {
    return NextResponse.json({ error: "Clé invalide" }, { status: 403 })
  }

  const cookieValue = DEVICE_BYPASS + ".sadmin"
  const destination = req.nextUrl.origin + (to.startsWith("/") ? to : "/" + to)
  const response    = NextResponse.redirect(destination)

  response.cookies.set(SADMIN_COOKIE, cookieValue, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   30 * 24 * 60 * 60,
  })

  return response
}
