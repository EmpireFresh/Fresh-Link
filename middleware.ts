import { type NextRequest, NextResponse } from "next/server"
import { verifyDeviceToken, isDeviceAllowed, DEVICE_COOKIE, DEVICE_BYPASS } from "@/lib/deviceGuard"
import type { DeviceEntry } from "@/lib/deviceGuard"

// ── Paths toujours accessibles (pas de device check) ──────────────────────────
const PUBLIC_PATHS = [
  "/device-blocked",
  "/api/device/register",
  "/api/device/check",
  "/api/ext/",          // API publique site web
  "/_next/",
  "/favicon",
  "/icon",
  "/apple-touch",
  "/manifest",
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p))
}

// ── Charger la whitelist depuis les headers / env ──────────────────────────────
// En production, cette liste vient de Supabase via un edge config ou env var.
// En mode localStorage, on passe la vérification (garde ouverte = toujours vrai).
function getWhitelist(): DeviceEntry[] {
  try {
    const raw = process.env.DEVICE_WHITELIST_JSON
    if (!raw) return []             // Liste vide = mode ouvert (tous autorisés)
    return JSON.parse(raw) as DeviceEntry[]
  } catch {
    return []
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 1. Laisser passer les chemins publics ──────────────────────────────────
  if (isPublicPath(pathname)) return NextResponse.next()

  // ── 2. Bypass key (admin/debug) ───────────────────────────────────────────
  const bypassHeader = request.headers.get("x-vita-bypass")
  const bypassQuery  = request.nextUrl.searchParams.get("bypass")
  if (bypassHeader === DEVICE_BYPASS || bypassQuery === DEVICE_BYPASS) {
    return NextResponse.next()
  }

  // ── 3. Vérifier le cookie device ──────────────────────────────────────────
  const deviceCookie = request.cookies.get(DEVICE_COOKIE)?.value
  const whitelist    = getWhitelist()

  // Mode ouvert : liste vide = aucun device enregistré = accès libre
  // Cela permet l'accès jusqu'à ce que l'admin crée des entrées dans la whitelist
  if (whitelist.length === 0) {
    return NextResponse.next()
  }

  // Liste non vide → le cookie doit être présent et valide
  if (!deviceCookie) {
    const url = request.nextUrl.clone()
    url.pathname = "/device-blocked"
    url.searchParams.set("reason", "no-token")
    return NextResponse.redirect(url)
  }

  // Vérifier signature du token
  const fingerprint = verifyDeviceToken(deviceCookie)
  if (!fingerprint) {
    const url = request.nextUrl.clone()
    url.pathname = "/device-blocked"
    url.searchParams.set("reason", "invalid-token")
    return NextResponse.redirect(url)
  }

  // Vérifier si le device est autorisé
  if (!isDeviceAllowed(fingerprint, whitelist)) {
    const url = request.nextUrl.clone()
    url.pathname = "/device-blocked"
    url.searchParams.set("reason", "not-allowed")
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Toutes les pages ET API (sauf _next/static, _next/image, fichiers statiques)
    "/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf)).*)",
  ],
}
