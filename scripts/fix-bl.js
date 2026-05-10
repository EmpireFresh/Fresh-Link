import { readFileSync, writeFileSync } from "fs"

const file = "components/backoffice/BOBonLivraison.tsx"
const lines = readFileSync(file, "utf8").split("\n")

// Keep only up to line 1347 (index 1346)
const cleaned = lines.slice(0, 1347).join("\n")
writeFileSync(file, cleaned, "utf8")

console.log(`[v0] Truncated to 1347 lines. Removed ${lines.length - 1347} orphan lines.`)
console.log(`[v0] Last line: ${lines[1346]}`)
