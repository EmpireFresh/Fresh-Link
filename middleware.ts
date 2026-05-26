import { type NextRequest, NextResponse } from "next/server"
import { verifyDeviceToken, verifySadminToken, DEVICE_COOKIE, DEVICE_BYPASS, SADMIN_COOKIE } from "@/lib/deviceGuard"

// ── Paths toujours accessibles (pas de device check) ──────────────────────────
const PUBLIC_PATHS = [
  "/device-blocked",
  "/api/device/",          // toutes les routes device (register, request-access, check-and-token…)
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

  // ── 2a. Super-admin bypass (Jawad — exempt de device guard) ─────────────────
  const sadminCookie = request.cookies.get(SADMIN_COOKIE)?.value
  if (sadminCookie && verifySadminToken(sadminCookie)) {
    return NextResponse.next()
  }

  // ── 2b. Bypass key (admin/debug via header ou query param) ───────────────────
  const bypassHeader = request.headers.get("x-vita-bypass")
  const bypassQuery  = request.nextUrl.searchParams.get("bypass")
  if (bypassHeader === DEVICE_BYPASS || bypassQuery === DEVICE_BYPASS) {
    return NextResponse.next()
  }

  // ── 3. Vérifier le cookie device (HMAC signé) ─────────────────────────────
  // Le token est posé par /api/device/check-and-token après approbation dans Supabase
  const deviceCookie = request.cookies.get(DEVICE_COOKIE)?.value

  if (!deviceCookie) {
    // Aucun cookie → premier accès → portail de demande d'accès
    return redirectToBlocked(request, "no-token")
  }

  const fingerprint = verifyDeviceToken(deviceCookie)
  if (!fingerprint) {
    // Token invalide ou expiré → redemander l'accès
    return redirectToBlocked(request, "invalid-token")
  }

  // Token HMAC valide → accès autorisé
  // (L'approbation a été vérifiée dans Supabase lors de l'émission du token)
  return NextResponse.next()
}

function redirectToBlocked(req: NextRequest, reason: string): NextResponse {
  const url = req.nextUrl.clone()
  url.pathname = "/device-blocked"
  url.searchParams.set("reason", reason)
  // Conserver la page cible pour redirection après approbation
  if (req.nextUrl.pathname !== "/device-blocked") {
    url.searchParams.set("from", req.nextUrl.pathname)
  }
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    // Toutes les pages ET API (sauf _next/static, _next/image, fichiers statiques)
    "/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|mp4|pdf)).*)",
  ],
}
