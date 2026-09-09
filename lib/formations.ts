import { type Player, playerKey, type Position } from "@/lib/fantasy";
import { SCORING } from "@/lib/scoring.mjs";

/**
 * TFF Fantezi Lig ilk 11 kuralları: 1 kaleci, en az 3 defans, en az 1 forvet;
 * geçerli dizilişler 3-5-2, 3-4-3, 4-4-2, 4-3-3, 4-5-1, 5-4-1, 5-3-2, 5-2-3.
 * Kadro 15 (2-5-5-3); ilk 11 dışındakiler yedek, puanları sayılmaz (otomatik
 * değişiklik hariç). Kaptanın puanı ×2; kaptan hiç oynamazsa yardımcı kaptan.
 */
export type Formation = readonly [def: number, mid: number, fwd: number];

export const FORMATIONS: Formation[] = [
  [3, 5, 2],
  [3, 4, 3],
  [4, 4, 2],
  [4, 3, 3],
  [4, 5, 1],
  [5, 4, 1],
  [5, 3, 2],
  [5, 2, 3],
];

export const XI_SIZE = 11;
export const BENCH_SIZE = 4;

export const XI_MIN: Record<Position, number> = { GK: 1, DEF: 3, MID: 2, FWD: 1 };
export const XI_MAX: Record<Position, number> = { GK: 1, DEF: 5, MID: 5, FWD: 3 };

export function isValidFormation(def: number, mid: number, fwd: number): boolean {
  return FORMATIONS.some(([d, m, f]) => d === def && m === mid && f === fwd);
}

export function formationLabel(f: Formation): string {
  return `${f[0]}-${f[1]}-${f[2]}`;
}

export type Lineup = {
  formation: Formation;
  xi: Player[];
  /** Yedekler: önce kaleci, sonra puana göre saha oyuncuları (otomatik değişiklik sırası). */
  bench: Player[];
  captain: Player | null;
  vice: Player | null;
  /** İlk 11 puanı + kaptan farkı. */
  xiScore: number;
  benchScore: number;
  /** Hedef: xiScore + benchWeight × benchScore. */
  value: number;
};

/**
 * 15 kişilik kadrodan en iyi ilk 11: her geçerli diziliş için mevki mevki en
 * yüksek puanlılar (kilitliler önce), kaptan en yüksek puanlı; değeri en
 * yüksek diziliş seçilir. Puan haritası yoksa oyuncu 0 sayılır.
 */
export function bestLineup(
  squad: Player[],
  scoreOf: (p: Player) => number,
  benchWeight = 0,
  locked: Set<string> = new Set(),
): Lineup {
  const byPos: Record<Position, Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const p of squad) byPos[p.pos].push(p);
  for (const pos of Object.keys(byPos) as Position[]) {
    byPos[pos].sort((a, b) => {
      const la = locked.has(playerKey(a)) ? 1 : 0;
      const lb = locked.has(playerKey(b)) ? 1 : 0;
      return lb - la || scoreOf(b) - scoreOf(a);
    });
  }

  let best: Lineup | null = null;
  for (const formation of FORMATIONS) {
    const [d, m, f] = formation;
    if (byPos.GK.length < 1 || byPos.DEF.length < d || byPos.MID.length < m || byPos.FWD.length < f)
      continue;
    const xi = [
      ...byPos.GK.slice(0, 1),
      ...byPos.DEF.slice(0, d),
      ...byPos.MID.slice(0, m),
      ...byPos.FWD.slice(0, f),
    ];
    const xiKeys = new Set(xi.map(playerKey));
    const benchAll = squad.filter((p) => !xiKeys.has(playerKey(p)));
    const bench = [
      ...benchAll.filter((p) => p.pos === "GK"),
      ...benchAll.filter((p) => p.pos !== "GK").sort((a, b) => scoreOf(b) - scoreOf(a)),
    ];
    const sorted = [...xi].sort((a, b) => scoreOf(b) - scoreOf(a));
    const captain = sorted[0] ?? null;
    const vice = sorted[1] ?? null;
    const xiScore =
      xi.reduce((s, p) => s + scoreOf(p), 0) +
      (captain ? (SCORING.captain - 1) * scoreOf(captain) : 0);
    const benchScore = bench.reduce((s, p) => s + scoreOf(p), 0);
    const value = xiScore + benchWeight * benchScore;
    if (!best || value > best.value + 1e-9) {
      best = { formation, xi, bench, captain, vice, xiScore, benchScore, value };
    }
  }
  if (!best) {
    return {
      formation: [4, 4, 2],
      xi: [],
      bench: squad,
      captain: null,
      vice: null,
      xiScore: 0,
      benchScore: 0,
      value: 0,
    };
  }
  return best;
}
