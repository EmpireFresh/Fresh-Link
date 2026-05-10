import { NextRequest, NextResponse } from "next/server"
import { sendEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  try {
    const { to, subject, body } = await req.json()
    if (!to || !subject || !body) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }
    // EmailPayload uses to_email + body (not to/text)
    await sendEmail({ to_email: to, subject, body })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("rapport-journalier:", e)
    return NextResponse.json({ error: "Email send failed" }, { status: 500 })
  }
}
