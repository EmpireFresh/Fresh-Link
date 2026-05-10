import { readFileSync, writeFileSync } from 'fs'

const filePath = 'components/backoffice/BOBonLivraison.tsx'
const lines = readFileSync(filePath, 'utf8').split('\n')

// Keep only lines 1-1347 (index 0-1346). Line 1347 is the closing "}" of export default.
const clean = lines.slice(0, 1347).join('\n')
writeFileSync(filePath, clean + '\n', 'utf8')

console.log(`Truncated to ${1347} lines. Removed ${lines.length - 1347} orphan lines.`)
