"use client"

import { useEffect } from "react"
import { activateLiveSync } from "@/lib/supabase/liveSync"

export default function LiveSyncProvider() {
  useEffect(() => {
    activateLiveSync()
  }, [])
  return null
}
