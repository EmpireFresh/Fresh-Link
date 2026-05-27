/**
 * deviceGuard.edge.ts — constantes Edge Runtime compatibles
 * Pas d'import Node.js crypto ici.
 * Le middleware importe uniquement depuis ce fichier.
 */

export const DEVICE_COOKIE = "fl_device_token"
export const DEVICE_BYPASS = process.env.DEVICE_BYPASS_KEY ?? "vita-bypass-2026"
export const SADMIN_COOKIE = "fl_sadmin_bypass"
