import { NextRequest, NextResponse } from "next/server"
import { signDeviceToken, DEVICE_COOKIE } from "@/lib/deviceGuard"

// POST /api/device/register — enregistre un device et pose le cookie
export async function POST(req: NextRequest) {
  try {
    const { fingerprint, label } = await req.json()
    if (!fingerprint) {
      return NextResponse.json({ error: "fingerprint requis" }, { status: 400 })
    }

    const token = signDeviceToken(fingerprint)
    const res   = NextResponse.json({ ok: true, label: label ?? "Appareil enregistré" })

    res.cookies.set(DEVICE_COOKIE, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   7 * 24 * 60 * 60,  // 7 jours
      path:     "/",
    })

    return res
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur serveur"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET /api/device/register — vérifier si le device est déjà enregistré
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(DEVICE_COOKIE)?.value
  return NextResponse.json({ registered: !!cookie })
}
