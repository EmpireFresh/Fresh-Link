"use client"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// ── Supabase Project: gcpcrnagyqiedouucmeq ─────────────────────────────────
// Get your keys at: https://supabase.com/dashboard/project/gcpcrnagyqiedouucmeq/settings/api
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://gcpcrnagyqiedouucmeq.supabase.co"

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

if (!SUPABASE_ANON_KEY && typeof window !== "undefined") {
  console.warn("[FreshLink] NEXT_PUBLIC_SUPABASE_ANON_KEY not set — running offline mode")
}

// Singleton — avoid multiple client instances
let _client: ReturnType<typeof createSupabaseClient> | null = null

export function createClient() {
  if (!_client) {
    _client = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY || "offline")
  }
  return _client
}

// Public URL helper for freshlink-media storage bucket
export function getStorageUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/freshlink-media/${path}`
}

// Upload file to freshlink-media bucket
export async function uploadToStorage(
  file: File,
  folder: "articles" | "conducteurs" | "signatures" | "documents"
): Promise<string | null> {
  try {
    const client = createClient()
    const ext = file.name.split(".").pop() ?? "jpg"
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await client.storage
      .from("freshlink-media")
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw error
    const { data } = client.storage.from("freshlink-media").getPublicUrl(path)
    return data.publicUrl
  } catch (e) {
    console.error("[storage] upload failed:", e)
    return null
  }
}
