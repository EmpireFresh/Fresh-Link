import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SERVICE_KEY  = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role || process.env.SUPABASE_SERVICE_KEY) ?? ""

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function GET(req: NextRequest) {
  if (!SERVICE_KEY) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY manquante" }, { status: 500 })
  }

  const table = req.nextUrl.searchParams.get("table")
  if (!table) {
    return NextResponse.json({ ok: false, error: "table param manquante" }, { status: 400 })
  }

  try {
    const sb = getAdminClient()
    const { data, error } = await sb
      .from(table)
      .select("id, payload")
      .limit(2000)

    if (error) {
      return NextResponse.json({ ok: false, error: `${error.message} (code: ${error.code})` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data: data ?? [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
