"use client"

// Ce composant est intentionnellement vide.
// La synchronisation Supabase est gérée par :
//   components/providers/LiveSyncProvider.tsx (JSONB v3)
// qui est monté dans app/layout.tsx autour du contenu principal.

export default function LiveSyncProvider({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}
