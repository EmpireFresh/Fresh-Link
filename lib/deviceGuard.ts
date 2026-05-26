/**
 * deviceGuard.ts — Device fingerprint-based access control
 *
 * Simule un filtrage MAC via browser fingerprinting.
 * Le vrai filtrage MAC est géré au niveau réseau (router/VPN).
 * Ce module ajoute une couche "device registration" côté app.
 *
 * Flux :
 *   1. Premier accès → génère fingerprint → stocke en cookie fl_device_token
 *   2. Middleware vérifie le cookie à chaque requête de page
 *   3. Si device non enregistré → redirect /device-blocked
 *   4. Admin peut autoriser/révoquer des devices via BOSettings
 */

import { createHmac } from "crypto"

// ── Constants ──────────────────────────────────────────────────────────────────
const DEVICE_SECRET = process.env.DEVICE_SECRET ?? "vt_device_secret_2026"
export const DEVICE_COOKIE = "fl_device_token"
export const DEVICE_BYPASS = process.env.DEVICE_BYPASS_KEY ?? "vita-bypass-2026"

// ── Server-side helpers ────────────────────────────────────────────────────────

/** Signe un fingerprint et retourne un token opaque */
export function signDeviceToken(fingerprint: string, expiresIn = 7 * 86_400_000): string {
  const payload = JSON.stringify({ fp: fingerprint, exp: Date.now() + expiresIn })
  const data    = Buffer.from(payload).toString("base64url")
  const sig     = createHmac("sha256", DEVICE_SECRET).update(data).digest("base64url")
  return `${data}.${sig}`
}

/** Vérifie et décode un token device. Retourne le fingerprint ou null */
export function verifyDeviceToken(token: string): string | null {
  try {
    const [data, sig] = token.split(".")
    if (!data || !sig) return null
    const expected = createHmac("sha256", DEVICE_SECRET).update(data).digest("base64url")
    if (expected !== sig) return null
    const payload = JSON.parse(Buffer.from(data, "base64url").toString())
    if (payload.exp && payload.exp < Date.now()) return null
    return payload.fp ?? null
  } catch {
    return null
  }
}

/** Vérifie si un fingerprint est dans la whitelist */
export function isDeviceAllowed(
  fingerprint: string,
  whitelist: DeviceEntry[]
): boolean {
  if (whitelist.length === 0) return true // Mode ouvert si aucun device enregistré
  return whitelist.some(d => d.fingerprint === fingerprint && d.active)
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface DeviceEntry {
  id:          string
  fingerprint: string
  label:       string        // Ex: "PC Bureau Jawad", "Mobile Karim"
  userAgent?:  string
  ip?:         string
  active:      boolean
  addedAt:     string
  addedBy:     string
  lastSeen?:   string
}

// ── Client-side fingerprint generation ────────────────────────────────────────
// (à utiliser côté browser uniquement, via /api/device/register)

export const CLIENT_FINGERPRINT_SCRIPT = `
async function generateFingerprint() {
  const parts = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency ?? 0,
    navigator.platform ?? '',
  ]
  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillText('VitaFresh🌿', 2, 2)
    parts.push(canvas.toDataURL().slice(-32))
  } catch {}
  const raw = parts.join('|')
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}
`
