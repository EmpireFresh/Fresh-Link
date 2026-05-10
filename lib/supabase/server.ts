// Server-side Supabase client — uses supabase-js directly (no @supabase/ssr needed)
import { createClient as _create } from "@supabase/supabase-js"

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://gcpcrnagyqiedouucmeq.supabase.co"
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5waHJuY211eGJ3YWhxbnpkeXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDUyNDUsImV4cCI6MjA5MDUyMTI0NX0._4bA9RtIVMUjNgxd2ojd9_3b6vzGRddpPPbioalRsMw"

export async function createClient() {
  return _create(URL, KEY)
}
