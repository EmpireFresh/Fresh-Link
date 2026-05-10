import { type NextRequest, NextResponse } from "next/server"

// Middleware minimal — ne bloque jamais le rendu de l'app.
// L'auth est geree cote client via localStorage (store.ts).
// Supabase est utilise uniquement pour la synchronisation des donnees.
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    // N'intercepte que les API routes, pas les pages
    "/api/(.*)",
  ],
}
