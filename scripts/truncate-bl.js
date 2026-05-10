import { readFileSync, writeFileSync } from "fs"

const filePath = "components/backoffice/BOBonLivraison.tsx"
const content = readFileSync(filePath, "utf8")
const lines = content.split("\n")

// Keep only lines up to (and including) the closing brace of the export default at line 1347
// Find the first occurrence of exactly "}" at the start of a line after line 662 (export default start)
// The correct end is at line index 1346 (0-based), i.e. the 1347th line

// Strategy: find all lines that are exactly "}" (single closing brace = end of top-level function)
// The first one after line 662 that matches the bracket depth = 0 is our target

let depth = 0
let exportDefaultStart = -1
let exportDefaultEnd = -1

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  
  if (line.includes("export default function BOBonLivraison")) {
    exportDefaultStart = i
  }
  
  if (exportDefaultStart >= 0) {
    for (const ch of line) {
      if (ch === "{") depth++
      if (ch === "}") depth--
    }
    
    if (depth === 0 && exportDefaultStart >= 0 && i > exportDefaultStart) {
      exportDefaultEnd = i
      break
    }
  }
}

console.log(`Export default starts at line ${exportDefaultStart + 1}, ends at line ${exportDefaultEnd + 1}`)

if (exportDefaultEnd > 0) {
  const cleanLines = lines.slice(0, exportDefaultEnd + 1)
  writeFileSync(filePath, cleanLines.join("\n") + "\n")
  console.log(`File truncated to ${cleanLines.length} lines. Removed ${lines.length - cleanLines.length} orphan lines.`)
} else {
  console.log("Could not find end of export default — no changes made")
}
