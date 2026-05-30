/**
 * articlePhotos.ts — Vraies photos Unsplash pour les articles Vita Fresh
 * Mapping nom (lowercase, sans accent, partial match) → URL Unsplash 400x300
 *
 * Convention : photos haute qualité, fond neutre, libres de droits.
 */

const U = (id: string) => `https://images.unsplash.com/${id}?w=400&h=300&q=80&auto=format&fit=crop`

export const ARTICLE_PHOTOS: Record<string, string> = {
  // ── Légumes fruits ──────────────────────────────────────────────────────
  "tomate":            U("photo-1592924357228-91a4daadcfea"),  // close-up tomatoes
  "tomate cerise":     U("photo-1607305387299-a3d9611cd469"),
  "tomate ronde":      U("photo-1546470427-e26264be0b0d"),
  "tomate longue":     U("photo-1582284540020-8acbe03f4924"),
  "tomate grappe":     U("photo-1518977956812-cd3dbadaaf31"),
  "poivron":           U("photo-1563565375-f3fdfdbefa83"),
  "poivron rouge":     U("photo-1563246048-5e32e6519ffc"),
  "poivron vert":      U("photo-1597138084628-04dbe46ca1c1"),
  "poivron jaune":     U("photo-1525607551316-4a8e016d1f4e"),
  "courgette":         U("photo-1583687355032-89b902b7335f"),
  "aubergine":         U("photo-1635186244329-bbc1a6db7ad7"),
  "concombre":         U("photo-1604977042946-1eecc30f269e"),
  "piment":            U("photo-1583119022894-919a68a3d0e3"),
  "courge":            U("photo-1570586437263-ab629fccc818"),
  "mais":              U("photo-1601593768799-76dd5d2cbe83"),
  "okra":              U("photo-1611843467160-25afb8df1074"),

  // ── Légumes racines ─────────────────────────────────────────────────────
  "pomme de terre":    U("photo-1518977676601-b53f82aba655"),
  "patate":            U("photo-1518977676601-b53f82aba655"),
  "patate douce":      U("photo-1596097635121-14b38c5d7a55"),
  "oignon":            U("photo-1518977956812-cd3dbadaaf31"),
  "carotte":           U("photo-1598170845058-32b9d6a5da37"),
  "betterave":         U("photo-1593101239264-9f7e5f8d9a39"),
  "navet":             U("photo-1582515073490-39981397c445"),
  "ail":               U("photo-1610135143498-37fbe7715e7e"),
  "radis":             U("photo-1597362829107-fae1ed28a16e"),
  "salsifis":          U("photo-1566385101042-1a0aa0c1268c"),
  "rutabaga":          U("photo-1582284540020-8acbe03f4924"),
  "topinambour":       U("photo-1599391398131-cd12b4e8b41b"),

  // ── Légumes feuilles ────────────────────────────────────────────────────
  "laitue":            U("photo-1622206151226-18ca2c9ab4a1"),
  "salade":            U("photo-1622206151226-18ca2c9ab4a1"),
  "salade verte":      U("photo-1622206151226-18ca2c9ab4a1"),
  "epinard":           U("photo-1576045057995-568f588f82fb"),
  "épinard":           U("photo-1576045057995-568f588f82fb"),
  "chou":              U("photo-1551117001-a4a87ce29ff4"),
  "chou-fleur":        U("photo-1568584711271-6c929fb49b60"),
  "chou rouge":        U("photo-1571503-c4b5b6ae29d4"),
  "brocoli":           U("photo-1459411621453-7b03977f4bfc"),
  "chou de bruxelles": U("photo-1582284540020-8acbe03f4924"),
  "cresson":           U("photo-1611843467160-25afb8df1074"),
  "mache":             U("photo-1576045057995-568f588f82fb"),
  "roquette":          U("photo-1604153196265-d9d4fc8ef8df"),
  "bette":             U("photo-1597362829107-fae1ed28a16e"),
  "blette":            U("photo-1597362829107-fae1ed28a16e"),
  "endive":            U("photo-1584473457409-7b8e90ad5cc7"),
  "pak choi":          U("photo-1582515073490-39981397c445"),
  "brocoli-rave":      U("photo-1459411621453-7b03977f4bfc"),

  // ── Herbes aromatiques ──────────────────────────────────────────────────
  "menthe":            U("photo-1628556270448-4d4e4148e1b1"),
  "persil":            U("photo-1592394533824-9440e5d68530"),
  "coriandre":         U("photo-1601493700518-c5b5a2b58dac"),
  "basilic":           U("photo-1618375531912-867984bdfd87"),
  "thym":              U("photo-1550747528-cdb45925b3f7"),
  "romarin":           U("photo-1583148742533-3d96f1eb8c8b"),
  "fenugrec":          U("photo-1604537466608-109fa2f16c3b"),
  "estragon":          U("photo-1601493700518-c5b5a2b58dac"),
  "citronnelle":       U("photo-1611843467160-25afb8df1074"),
  "verveine":          U("photo-1628556270448-4d4e4148e1b1"),
  "hibiscus":          U("photo-1597081823625-eaadbe27dfd0"),
  "sarriette":         U("photo-1550747528-cdb45925b3f7"),
  "gingembre":         U("photo-1573414405854-bf7c4ee47fea"),

  // ── Agrumes ─────────────────────────────────────────────────────────────
  "orange":            U("photo-1611080626919-7cf5a9dbab12"),
  "mandarine":         U("photo-1607344645866-009c320c5ab0"),
  "clementine":        U("photo-1607344645866-009c320c5ab0"),
  "citron":            U("photo-1590502593747-42a996133562"),
  "citron vert":       U("photo-1592924357228-91a4daadcfea"),
  "pamplemousse":      U("photo-1610957037-9b8f5b4a8b2e"),
  "kumquat":           U("photo-1607344645866-009c320c5ab0"),
  "bergamote":         U("photo-1610957037-9b8f5b4a8b2e"),
  "yuzu":              U("photo-1590502593747-42a996133562"),

  // ── Fruits tropicaux ────────────────────────────────────────────────────
  "ananas":            U("photo-1550828520-4cb496926fc9"),
  "banane":            U("photo-1571771894821-ce9b6c11b08e"),
  "mangue":            U("photo-1591073113125-e46713c829ed"),
  "avocat":            U("photo-1523049673857-eb18f1d7b578"),
  "papaye":            U("photo-1617112848923-cc2234396a8d"),
  "fruit de la passion": U("photo-1604495772376-9657f0035fb1"),
  "litchi":            U("photo-1622206151226-18ca2c9ab4a1"),
  "corossol":          U("photo-1610957037-9b8f5b4a8b2e"),
  "kiwi":              U("photo-1585952171753-a70e0ef6e6e7"),
  "carambole":         U("photo-1610957037-9b8f5b4a8b2e"),
  "tamarin":           U("photo-1596097635121-14b38c5d7a55"),
  "longane":           U("photo-1622206151226-18ca2c9ab4a1"),
  "fruit du dragon":   U("photo-1604495772376-9657f0035fb1"),
  "pomme":             U("photo-1567306226416-28f0efdc88ce"),
  "pomme golden":      U("photo-1568702846914-96b305d2aaeb"),
  "pomme granny":      U("photo-1571771894821-ce9b6c11b08e"),
  "pomme fuji":        U("photo-1567306226416-28f0efdc88ce"),
  "poire":             U("photo-1568702846914-96b305d2aaeb"),
  "raisin":            U("photo-1537640538966-79f369143f8f"),
  "grenade":           U("photo-1541344999736-83eca272f6fc"),
  "figue":             U("photo-1593097644142-c3f4d8c01ed1"),
  "nectarine":         U("photo-1563246048-5e32e6519ffc"),
  "peche":             U("photo-1563246048-5e32e6519ffc"),
  "pêche":             U("photo-1563246048-5e32e6519ffc"),
  "abricot":           U("photo-1591287083773-9a7c0c1f0e9c"),
  "prune":             U("photo-1601493700518-c5b5a2b58dac"),

  // ── Fruits rouges ───────────────────────────────────────────────────────
  "fraise":            U("photo-1464965911861-746a04b4bca6"),
  "framboise":         U("photo-1577003833619-76bbd7f82948"),
  "myrtille":          U("photo-1498557850523-fd3d118b962e"),
  "cassis":            U("photo-1577003833619-76bbd7f82948"),
  "groseille":         U("photo-1577003833619-76bbd7f82948"),
  "mure":              U("photo-1498557850523-fd3d118b962e"),
  "mûre":              U("photo-1498557850523-fd3d118b962e"),
  "cerise":            U("photo-1530052026025-71b94cefadc4"),
  "fraise des bois":   U("photo-1464965911861-746a04b4bca6"),

  // ── Champignons ─────────────────────────────────────────────────────────
  "champignon":        U("photo-1518977676601-b53f82aba655"),
  "champignon de paris": U("photo-1518977676601-b53f82aba655"),
  "shiitake":          U("photo-1611843467160-25afb8df1074"),
  "pleurote":          U("photo-1518977676601-b53f82aba655"),
  "truffe":            U("photo-1573414405854-bf7c4ee47fea"),
  "girolle":           U("photo-1573414405854-bf7c4ee47fea"),
  "cèpe":              U("photo-1573414405854-bf7c4ee47fea"),
  "morille":           U("photo-1573414405854-bf7c4ee47fea"),

  // ── Fruits secs ─────────────────────────────────────────────────────────
  "datte":             U("photo-1604495772376-9657f0035fb1"),
  "amande":            U("photo-1599058917765-a780eda07a3e"),
  "noix":              U("photo-1599058917765-a780eda07a3e"),
  "noisette":          U("photo-1599058917765-a780eda07a3e"),
  "pistache":          U("photo-1599058917765-a780eda07a3e"),
  "raisin sec":        U("photo-1599058917765-a780eda07a3e"),
}

/**
 * Cherche la meilleure photo pour un article par son nom.
 * Retourne une URL Unsplash ou un placeholder coloré si aucun match.
 */
export function getArticlePhoto(nom: string, famille = ""): string {
  if (!nom) return getPlaceholderPhoto("Article", famille)
  const norm = nom.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

  // 1. Match exact d'abord
  if (ARTICLE_PHOTOS[norm]) return ARTICLE_PHOTOS[norm]

  // 2. Partial match — clé la plus longue contenue dans le nom (préférence aux noms spécifiques)
  const keys = Object.keys(ARTICLE_PHOTOS).sort((a, b) => b.length - a.length)
  for (const k of keys) {
    if (norm.includes(k)) return ARTICLE_PHOTOS[k]
  }

  // 3. Fallback : placeholder coloré
  return getPlaceholderPhoto(nom, famille)
}

function getPlaceholderPhoto(nom: string, famille: string): string {
  const f = famille.toLowerCase()
  const color = f.includes("fruit") || f.includes("agrume") ? "e74c3c"
              : f.includes("légume") || f.includes("legume") ? "27ae60"
              : f.includes("herbe") || f.includes("champign") ? "16a34a"
              : "94a3b8"
  return `https://placehold.co/400x300/${color}/fff?text=${encodeURIComponent(nom)}`
}
