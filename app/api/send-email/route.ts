import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/send-email
 * Remplace EmailJS — utilise Resend (https://resend.com)
 *
 * Body JSON : { to, subject, html?, text?, from? }
 *
 * Variables d'environnement :
 *   RESEND_API_KEY   — clé API Resend (obtenir sur resend.com, gratuit 3000 emails/mois)
 *   EMAIL_FROM       — expéditeur (ex: "FreshLink Pro <noreply@vitafresh.ma>")
 *
 * Fallback SMTP : si RESEND_API_KEY absent, utilise Nodemailer avec
 *   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { to, subject, html, text, from } = body as {
      to: string | string[]
      subject: string
      html?: string
      text?: string
      from?: string
    }

    if (!to || !subject || (!html && !text)) {
      return NextResponse.json({ ok: false, error: "Champs requis : to, subject, html ou text" }, { status: 400 })
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY
    const EMAIL_FROM     = process.env.EMAIL_FROM ?? from ?? "FreshLink Pro <noreply@vitafresh.ma>"

    // ── Resend (prioritaire) ─────────────────────────────────────────────────
    if (RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from:    EMAIL_FROM,
          to:      Array.isArray(to) ? to : [to],
          subject,
          html:    html ?? `<pre style="font-family:monospace">${text}</pre>`,
          text:    text,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        return NextResponse.json({ ok: true, provider: "resend", id: (data as { id?: string }).id })
      }

      const err = (data as { message?: string }).message ?? res.statusText
      return NextResponse.json({ ok: false, error: `Resend: ${err}` }, { status: 502 })
    }

    // ── Fallback SMTP via Nodemailer (si Resend non configuré) ───────────────
    const SMTP_HOST = process.env.SMTP_HOST
    const SMTP_PORT = Number(process.env.SMTP_PORT ?? "587")
    const SMTP_USER = process.env.SMTP_USER
    const SMTP_PASS = process.env.SMTP_PASS

    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      try {
        const nodemailer = await import("nodemailer")
        const transporter = nodemailer.default.createTransport({
          host: SMTP_HOST,
          port: SMTP_PORT,
          secure: SMTP_PORT === 465,
          auth: { user: SMTP_USER, pass: SMTP_PASS },
        })

        await transporter.sendMail({
          from:    EMAIL_FROM,
          to:      Array.isArray(to) ? to.join(", ") : to,
          subject,
          html,
          text,
        })

        return NextResponse.json({ ok: true, provider: "smtp" })
      } catch (smtpErr) {
        const msg = smtpErr instanceof Error ? smtpErr.message : String(smtpErr)
        return NextResponse.json({ ok: false, error: `SMTP: ${msg}` }, { status: 502 })
      }
    }

    // ── Aucun provider configuré ─────────────────────────────────────────────
    return NextResponse.json({
      ok: false,
      error: "Aucun provider email configuré. Ajoutez RESEND_API_KEY dans .env.local (gratuit sur resend.com)",
    }, { status: 503 })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
