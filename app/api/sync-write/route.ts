import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

// Use the supabase-js admin client (service_role) which correctly sets
// the PostgreSQL role and bypasses RLS at the connection level.
// Raw fetch was not reliably bypassing RLS in some Supabase project configs.

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function POST(req: NextRequest) {
  if (!SERVICE_KEY) {
    return NextResponse.json(
      { ok: false, errors: ["SUPABASE_SERVICE_ROLE_KEY manquante"] },
      { status: 500 }
    )
  }

  try {
    const body = (await req.json()) as {
      table: string
      upserts?: Array<{ id: string; payload: unknown; updated_at: string }>
      deletes?: string[]
      clearAll?: boolean          // ← supprime TOUTES les lignes (reset)
      preserveId?: string         // ← ID à préserver lors du clearAll (ex: super_admin)
    }

    if (!body.table) {
      return NextResponse.json({ ok: false, errors: ["table manquante"] }, { status: 400 })
    }

    const { table, upserts, deletes, clearAll, preserveId } = body
    const errors: string[] = []
    const sb = getAdminClient()

    // ── Suppression complète de la table (service role bypass RLS) ────────────
    if (clearAll) {
      let q = sb.from(table).delete()
      if (preserveId) {
        // @ts-ignore — PostgREST filter chaining
        q = q.neq("id", preserveId)
      } else {
        // @ts-ignore
        q = q.not("id", "is", null)
      }
      const { error } = await q
      if (error) errors.push(`clearAll ${table}: ${error.message}`)
      return NextResponse.json({ ok: errors.length === 0, errors })
    }

    if (upserts && upserts.length > 0) {
      const { error } = await sb
        .from(table)
        .upsert(upserts, { onConflict: "id" })
      if (error) errors.push(`upsert: ${error.message} (code: ${error.code})`)
    }

    if (deletes && deletes.length > 0) {
      for (const id of deletes) {
        const { error } = await sb.from(table).delete().eq("id", id)
        if (error) errors.push(`delete ${id}: ${error.message}`)
      }
    }

    return NextResponse.json({ ok: errors.length === 0, errors })
  } catch (e) {
    return NextResponse.json({ ok: false, errors: [String(e)] }, { status: 500 })
  }
}
