// Planlanacak hafta kuralı, tek yerde.
//
// Hem uygulama (`lib/data.ts`) hem veri betikleri (`scripts/fetch-predicted.mjs`)
// buradan okur; `lib/scoring.mjs` ile aynı gerekçe: betikler TypeScript import
// edemiyor ve kural iki yere yazılırsa biri sessizce sapar.

/**
 * Planlanacak hafta: oyunun bildirdiği "kadro kurulabilir" hafta; bilinmiyorsa
 * oynanmamış maçı olan ilk hafta (sezon bittiyse son hafta).
 *
 * @param {{ editableGameweek?: number | null }} meta
 * @param {{ md: number, hg: number | null, ag: number | null }[]} fixtures
 * @param {number} matchdays
 */
export function nextMatchdayFrom(meta, fixtures, matchdays) {
  const editable = meta?.editableGameweek;
  if (editable && editable >= 1 && editable <= matchdays) return editable;
  for (let md = 1; md <= matchdays; md++) {
    if (fixtures.some((f) => f.md === md && (f.hg == null || f.ag == null))) return md;
  }
  return matchdays;
}
