// FreshLink Pro — Supabase clients table setup
// Runs via: node scripts/setup-supabase.mjs
// Uses Supabase REST API to create the clients table if it does not exist.

const SUPABASE_URL = "https://qlbubpjunhvveppbhxug.supabase.co"
const SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsYnVicGp1bmh2dmVwcGJoeHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNzAxOTQsImV4cCI6MjA4OTc0NjE5NH0.8acsZqE3uqfjUaAIsYrGQwva2I8tobtinQO4L-v89CA"

const SQL = `
create table if not exists public.clients (
  id            text primary key,
  nom           text not null,
  secteur       text not null default '',
  zone          text not null default '',
  type          text not null default 'autre',
  type_autre    text,
  taille        text not null default '50-100kg',
  type_produits text not null default 'moyenne',
  rotation      text not null default 'journalier',
  modalite_paiement text,
  plafond_credit    numeric,
  gps_lat       double precision,
  gps_lng       double precision,
  telephone     text,
  email         text,
  adresse       text,
  ice           text,
  notes         text,
  created_by    text not null default '',
  created_at    timestamptz not null default now()
);

alter table public.clients enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'clients' and policyname = 'allow_all_clients'
  ) then
    execute 'create policy "allow_all_clients" on public.clients for all using (true) with check (true)';
  end if;
end $$;
`

async function run() {
  console.log("Connecting to Supabase:", SUPABASE_URL)

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: SQL }),
  })

  if (!res.ok) {
    // Try the pg REST endpoint alternative
    const res2 = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: SQL }),
    })

    const text2 = await res2.text()
    if (res2.ok) {
      console.log("Table clients created successfully via pg endpoint.")
      console.log(text2)
    } else {
      console.warn("Could not run SQL via REST API (requires service_role key).")
      console.warn("Status:", res2.status, text2.slice(0, 300))
      console.log("")
      console.log("ACTION REQUIRED: Run the following SQL manually in Supabase SQL Editor:")
      console.log("https://supabase.com/dashboard/project/qlbubpjunhvveppbhxug/editor")
      console.log("")
      console.log(SQL)
    }
    return
  }

  const json = await res.json()
  console.log("Table clients created/verified successfully.")
  console.log(json)
}

run().catch(err => {
  console.error("Script error:", err.message)
  console.log("")
  console.log("Fallback: run this SQL manually in Supabase SQL Editor:")
  console.log("https://supabase.com/dashboard/project/qlbubpjunhvveppbhxug/editor")
})
