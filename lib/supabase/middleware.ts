// Supabase middleware helper — no-op, auth is handled client-side via localStorage
import { NextResponse, type NextRequest } from "next/server"

export function updateSession(request: NextRequest) {
  return NextResponse.next({ request })
}
