import { type NextRequest, NextResponse } from "next/server"
import {
  verifyDeviceToken,
  verifySadminToken,
  signSadminToken,
  DEVICE_COOKIE,
  DEVICE_BYPASS,
  SADMIN_COOKIE,
} from "@/lib/deviceGuard"

// ── Paths toujours accessibles (pas de device check) ──────────────────────────
const PUBLIC_PATHS = [
  "/device-blocked",
  "/api/device/",          // toutes les routes device (register, request-access, check-and-token…)
  "/api/admin-session",    // login admin — accessible avant d'avoir le sadmin cookie
  "/api/ext/",             // API publique site web
  "/_next/",
  "/favicon",
  "/icon",
  "/apple-touch",
  "/manifest",
  "/vita-fresh-logo",
  "/empire-fresh-logo",
  "/site-netlify",         // HTML site servi depuis public/
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 1. Laisser passer les chemins publics ──────────────────────────────────
  if (isPublicPath(pathname)) return NextResponse.next()

  // ── 2a. Super-admin bypass via cookie (Jawad — exempt de device guard) ──────
  const sadminCookie = request.cookies.get(SADMIN_COOKIE)?.value
  if (sadminCookie && verifySadminToken(sadminCookie)) {
    return NextResponse.next()
  }

  // ── 2b. Bypass key (URL param ou header) → pose cookie sadmin 30j ───────────
  const bypassHeader = request.headers.get("x-vita-bypass")
  const bypassQuery  = request.nextUrl.searchParams.get("bypass")

  if (bypassHeader === DEVICE_BYPASS || bypassQuery === DEVICE_BYPASS) {
    // Pose un cookie sadmin permanent (30 jours) ET redirige sans le param
    const sadminToken = signSadminToken("jawad-bypass")

    // Nettoyer l'URL (retirer le param bypass)
    const cleanUrl = request.nextUrl.clone()
    cleanUrl.searchParams.delete("bypass")

    const response = NextResponse.redirect(cleanUrl)
    response.cookies.set(SADMIN_COOKIE, sadminToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge:   30 * 24 * 60 * 60,   // 30 jours
    })
    return response
  }

  // ── 3. Vérifier le cookie device (HMAC signé) ─────────────────────────────
  const deviceCookie = request.cookies.get(DEVICE_COOKIE)?.value

  if (!deviceCookie) {
    return redirectToBlocked(request, "no-token")
  }

  const fingerprint = verifyDeviceToken(deviceCookie)
  if (!fingerprint) {
    return redirectToBlocked(request, "invalid-token")
  }

  // Token HMAC valide → accès autorisé
  return NextResponse.next()
}

function redirectToBlocked(req: NextRequest, reason: string): NextResponse {
  const url = req.nextUrl.clone()
  url.pathname = "/device-blocked"
  url.searchParams.set("reason", reason)
  if (req.nextUrl.pathname !== "/device-blocked") {
    url.searchParams.set("from", req.nextUrl.pathname)
  }
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|mp4|pdf)).*)",
  ],
}
