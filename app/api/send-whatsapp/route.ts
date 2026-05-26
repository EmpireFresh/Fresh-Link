import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/send-whatsapp
 * Envoie un message WhatsApp sans ouvrir WhatsApp Business.
 *
 * Provider : CallMeBot (GRATUIT — https://www.callmebot.com/blog/free-api-whatsapp-messages/)
 *
 * Activation (une seule fois par numéro) :
 *   1. Envoyer "I allow callmebot to send me messages" au +34 644 59 91 41 sur WhatsApp
 *   2. Vous recevez votre apikey personnelle
 *   3. Configurez : CALLMEBOT_APIKEY=votre_clé dans .env.local
 *
 * Body JSON : { phone: "212661234567", message: "Bonjour..." }
 *   phone = numéro international sans + (ex: 212661234567 pour Maroc)
 *
 * Fallback Twilio : si TWILIO_ACCOUNT_SID configuré, utilise Twilio WhatsApp API
 */

export async function POST(req: NextRequest) {
  try {
    const { phone, message } = await req.json() as { phone: string; message: string }

    if (!phone || !message) {
      return NextResponse.json({ ok: false, error: "phone et message requis" }, { status: 400 })
    }

    // Nettoyer le numéro (enlever + et espaces)
    const cleanPhone = phone.replace(/[\s\+\-\.]/g, "")

    const CALLMEBOT_APIKEY  = process.env.CALLMEBOT_APIKEY
    const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
    const TWILIO_AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN
    const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886"

    // ── CallMeBot (gratuit, no WhatsApp Business) ────────────────────────────
    if (CALLMEBOT_APIKEY) {
      const encodedMsg = encodeURIComponent(message)
      const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodedMsg}&apikey=${CALLMEBOT_APIKEY}`

      const res = await fetch(url, { method: "GET" })
      const text = await res.text().catch(() => "")

      // CallMeBot returns "Message sent" on success
      if (res.ok && (text.toLowerCase().includes("message sent") || text.toLowerCase().includes("queued"))) {
        return NextResponse.json({ ok: true, provider: "callmebot" })
      }

      // If CallMeBot fails (rate limit etc.), log and try Twilio fallback
      console.warn("CallMeBot error:", text)
    }

    // ── Twilio WhatsApp API (fallback) ───────────────────────────────────────
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
      const body = new URLSearchParams({
        From: TWILIO_WHATSAPP_FROM,
        To:   `whatsapp:+${cleanPhone}`,
        Body: message,
      })

      const res = await fetch(twilioUrl, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/x-www-form-urlencoded",
          "Authorization": "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
        },
        body,
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        return NextResponse.json({ ok: true, provider: "twilio", sid: (data as { sid?: string }).sid })
      }

      const errMsg = (data as { message?: string }).message ?? res.statusText
      return NextResponse.json({ ok: false, error: `Twilio: ${errMsg}` }, { status: 502 })
    }

    // ── Aucun provider configuré — fallback wa.me link ───────────────────────
    // Retourne un lien wa.me que l'UI peut ouvrir (ouvre WhatsApp Web)
    const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
    return NextResponse.json({
      ok: false,
      fallback: "wa_link",
      waLink,
      error: "WhatsApp API non configurée. Ajoutez CALLMEBOT_APIKEY dans .env.local (gratuit). En attendant, utilisez le lien wa.me.",
    }, { status: 503 })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
