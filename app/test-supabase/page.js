// app/test-supabase/page.js
import { createClient } from '@supabase/supabase-js'

export default async function TestPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  // On essaie juste de contacter Supabase
  const { data, error } = await supabase
    .from('_test_connection')
    .select('*')
    .limit(1)

  return (
    <div style={{ padding: 40, fontFamily: 'monospace' }}>
      <h1>Test Connexion Supabase</h1>

      {error?.message?.includes('does not exist') ? (
        <p style={{ color: 'green' }}>
          ✅ Connexion réussie ! (la table de test n'existe pas, mais Supabase répond)
        </p>
      ) : error ? (
        <p style={{ color: 'red' }}>
          ❌ Erreur : {error.message}
        </p>
      ) : (
        <p style={{ color: 'green' }}>✅ Connexion réussie !</p>
      )}

      <hr />
      <p><strong>URL Supabase détectée :</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL ?? '❌ Non trouvée'}</p>
    </div>
  )
}