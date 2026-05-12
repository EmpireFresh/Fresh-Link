// Server-side Supabase client — uses supabase-js directly (no @supabase/ssr needed)
import { createClient as _create } from "@supabase/supabase-js"

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jwdrwapuetqoqnankgma.supabase.co"
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3ZHJ3YXB1ZXRxb3FuYW5rZ21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NDE1NzUsImV4cCI6MjA5NDAxNzU3NX0.9l0e2eE9milvCWg29TIoGXgWY-ULOmTVrPmWRCsIvtw"

export async function createClient() {
  return _create(URL, KEY)
}
