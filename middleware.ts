import { type NextRequest, NextResponse } from "next/server"
import { DEVICE_COOKIE, DEVICE_BYPASS, SADMIN_COOKIE } from "@/lib/deviceGuard"

// ── Paths toujours accessibles (pas de device check) ──────────────────────────
const PUBLIC_PATHS = [
  "/device-blocked",
  "/api/device/",
  "/api/admin-session",
  "/api/ext/",
  "/_next/",
  "/favicon",
  "/icon",
  "/apple-touch",
  "/manifest",
  "/vita-fresh-logo",
  "/empire-fresh-logo",
  "/site-netlify",
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p))
}

// ── Valeur du cookie sadmin (sans HMAC — Edge Runtime compatible) ─────────────
// La sécurité repose sur le secret DEVICE_BYPASS_KEY (env var serveur)
function sadminCookieValue(): string {
  return DEVICE_BYPASS + ".sadmin"
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 1. Chemins publics ────────────────────────────────────────────────────
  if (isPublicPath(pathname)) return NextResponse.next()

  // ── 2a. Cookie sadmin Jawad (simple comparaison, pas de crypto Node.js) ───
  const sadminCookie = request.cookies.get(SADMIN_COOKIE)?.value
  if (sadminCookie === sadminCookieValue()) {
    return NextResponse.next()
  }

  // ── 2b. Bypass key dans URL → poser cookie sadmin + rediriger proprement ──
  const bypassQuery  = request.nextUrl.searchParams.get("bypass")
  const bypassHeader = request.headers.get("x-vita-bypass")

  if (bypassQuery === DEVICE_BYPASS || bypassHeader === DEVICE_BYPASS) {
    const cleanUrl = request.nextUrl.clone()
    cleanUrl.searchParams.delete("bypass")

    const response = NextResponse.redirect(cleanUrl)
    // Poser le cookie directement ici — valeur simple, pas de crypto ─────────
    response.cookies.set(SADMIN_COOKIE, sadminCookieValue(), {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge:   30 * 24 * 60 * 60,   // 30 jours
    })
    return response
  }

  // ── 3. Cookie device — vérification légère sans crypto ────────────────────
  // Le token HMAC est vérifié côté Node.js par les API routes,
  // ici on vérifie juste sa présence et son format de base.
  const deviceCookie = request.cookies.get(DEVICE_COOKIE)?.value

  if (!deviceCookie || !deviceCookie.includes(".")) {
    return redirectToBlocked(request, "no-token")
  }

  // Vérifier signature HMAC via l'API (Edge → Node.js bridge)
  // Pour l'instant : accepter tout token bien formé (2 parties séparées par ".")
  // La vraie vérification HMAC se fait dans les API routes Node.js
  // ATTENTION : pour sécurité maximale, activer la vérification complète ci-dessous
  // en ajoutant l'env var MIDDLEWARE_RUNTIME=nodejs dans Vercel
  const parts = deviceCookie.split(".")
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return redirectToBlocked(request, "invalid-token")
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64").toString())
    // Vérifier expiration uniquement (pas la signature HMAC — Edge incompatible)
    if (payload.exp && payload.exp < Date.now()) {
      return redirectToBlocked(request, "expired-token")
    }
    if (!payload.fp) {
      return redirectToBlocked(request, "invalid-token")
    }
  } catch {
    return redirectToBlocked(request, "invalid-token")
  }

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
