/**
 * FreshLink Pro — Script d'upload d'images vers Supabase Storage
 * 
 * USAGE (PowerShell):
 *   node scripts/upload-images.mjs ./mes-images
 * 
 * Le dossier doit contenir des images nommées par ID article:
 *   a1.jpg, a2.png, a5.webp, etc.
 * 
 * Après upload, le script met automatiquement à jour la colonne
 * `photo` et `photo_storage_path` dans la table `articles`.
 */

import { createClient } from "@supabase/supabase-js"
import { readdir, readFile } from "fs/promises"
import { join, extname, basename } from "path"

// ── Config — lis depuis .env.local ────────────────────────────────────────────
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET        = "freshlink-media"
const FOLDER        = "articles"

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const imgDir   = process.argv[2] ?? "./images-articles"

const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".webp", ".avif"]

async function main() {
  console.log(`\n📂 Lecture du dossier: ${imgDir}`)
  
  let files
  try {
    files = await readdir(imgDir)
  } catch {
    console.error(`❌ Dossier introuvable: ${imgDir}`)
    console.log("   Crée un dossier et place tes images dedans (nommées a1.jpg, a2.png, etc.)")
    process.exit(1)
  }

  const images = files.filter(f => ALLOWED_EXT.includes(extname(f).toLowerCase()))
  console.log(`🖼️  ${images.length} images trouvées\n`)

  let ok = 0, errors = 0

  for (const filename of images) {
    const articleId = basename(filename, extname(filename))  // ex: a1
    const storagePath = `${FOLDER}/${filename}`              // ex: articles/a1.jpg
    const mimeMap = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif" }
    const contentType = mimeMap[extname(filename).toLowerCase()] ?? "image/jpeg"

    try {
      const buffer = await readFile(join(imgDir, filename))

      // Upload vers Supabase Storage
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType,
          upsert: true,
        })

      if (upErr) throw upErr

      // Récupère l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath)

      // Met à jour la table articles
      const { error: dbErr } = await supabase
        .from("articles")
        .update({
          photo:              publicUrl,
          photo_storage_path: storagePath,
        })
        .eq("id", articleId)

      if (dbErr) {
        console.warn(`⚠️  ${filename} uploadé mais article '${articleId}' non trouvé en DB`)
      } else {
        console.log(`✅  ${filename.padEnd(30)} → ${publicUrl}`)
        ok++
      }
    } catch (err) {
      console.error(`❌  ${filename}: ${err.message}`)
      errors++
    }
  }

  console.log(`\n─────────────────────────────────────`)
  console.log(`✅ ${ok} images uploadées avec succès`)
  if (errors > 0) console.log(`❌ ${errors} erreurs`)
  console.log(`\nTes images sont maintenant visibles dans:`)
  console.log(`  ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/articles/`)
}

main()
