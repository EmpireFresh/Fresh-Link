import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Absolute path from project root
const filePath = resolve('components/backoffice/BOBonLivraison.tsx')
const content = readFileSync(filePath, 'utf8')
const lines = content.split('\n')

console.log(`Total lines before: ${lines.length}`)

// Keep lines 0..1346 (= line numbers 1..1347), which is the last "}" closing export default
const keepLines = 1347
const clean = lines.slice(0, keepLines).join('\n')

writeFileSync(filePath, clean + '\n', 'utf8')
console.log(`Written ${keepLines} lines. Removed ${lines.length - keepLines} orphan lines.`)

// Verify
const verify = readFileSync(filePath, 'utf8').split('\n')
console.log(`Total lines after: ${verify.length}`)
console.log(`Last 3 lines:`)
verify.slice(-4).forEach((l, i) => console.log(`  ${keepLines - 3 + i}: ${l}`))
