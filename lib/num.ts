export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Zorluk değerleri her zaman 1 ondalığa yuvarlanır (PROJECT.md §4). */
export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
