import { byId, MATCHDAYS } from "@/lib/data";
import {
  type Player,
  players as allPlayers,
  type Position,
} from "@/lib/fantasy";
import { fantasyPer90 } from "@/lib/lineups";
import type { TeamResult } from "@/lib/models";
import { playerExpectedPoints, type PlayerXp, type XpContext } from "@/lib/xp";

/**
 * Oyuncu önerisi: seçili haftalar için beklenen puan (lib/xp.ts) tek ölçüt.
 * Fiyat puana girmez: bütçe kadro kurucuda sert kısıt, burada yalnızca
 * alt/üst sınır filtresi ve eşit puanda ucuz olanı öne alan eşitlik bozucu.
 */
export type PickRow = {
  player: Player;
  /** Hafta başına beklenen puan (seçili haftaların ağırlıklı ortalaması). */
  score: number;
  detail: PlayerXp;
  /** Takımın seçili haftalardaki ağırlıklı zorluğu (1-5). */
  avgDifficulty: number;
  /** Başlama olasılığı, 0-1. */
  startProb: number;
  /** Son maçlardan gerçek fantasy puanı / 90 (düzeltmeli); veri yoksa null. */
  per90: number | null;
};

/** Oyunun kendi maç başına puanı; yoksa toplam/dakikadan kaba karşılık. */
export function officialPerMatch(player: PickRow["player"]): number | null {
  if (player.ppm != null && player.ppm > 0) return player.ppm;
  if (player.mins > 0) return (90 * player.pts) / player.mins;
  return null;
}

export type PickInput = {
  results: Record<string, TeamResult>;
  ctx: XpContext;
  /** 34 elemanlı hafta ağırlıkları (bkz. weekDecayWeights). */
  weekWeights: number[];
  pool?: Player[];
  /** Tek mevki; verilmezse hepsi. */
  position?: Position;
  minPrice?: number;
  maxPrice?: number;
  /** Sakat ve cezalı oyuncular listeye girsin mi? */
  includeUnavailable?: boolean;
};

/** Sonraki haftaların ağırlık azalması: 0 = yalnız seçili hafta. */
export const DEFAULT_WEEK_DECAY = 0.5;
export const DEFAULT_HORIZON = 1;
export const MAX_HORIZON = 8;

/**
 * Seçili haftadan başlayan `horizon` haftalık pencere: ilk hafta 1, sonraki
 * her hafta bir öncekinin `decay` katı. Transfer sınırsız olduğu için
 * varsayılan ufuk 1 hafta; birkaç hafta elde tutulacak kadro için ufuk ve
 * azalma açılır.
 */
export function weekDecayWeights(gw: number, horizon: number, decay: number): number[] {
  const d = Math.min(1, Math.max(0, decay));
  const h = Math.max(1, Math.min(MAX_HORIZON, Math.round(horizon)));
  return Array.from({ length: MATCHDAYS }, (_, i) => {
    const md = i + 1;
    if (md < gw || md >= gw + h) return 0;
    return Math.pow(d, md - gw);
  });
}

/** Ağırlıklı ortalama zorluk; ağırlıklar sıfırsa düz ortalama. */
export function weightedDifficulty(diffs: number[], weights: number[]): number {
  let sum = 0;
  let w = 0;
  diffs.forEach((d, i) => {
    const wi = weights[i] ?? 0;
    sum += wi * d;
    w += wi;
  });
  if (w > 0) return sum / w;
  return diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
}

export function rankPicks({
  results,
  ctx,
  weekWeights,
  pool = allPlayers,
  position,
  minPrice,
  maxPrice,
  includeUnavailable = false,
}: PickInput): PickRow[] {
  const rows: PickRow[] = [];
  for (const player of pool) {
    if (position && player.pos !== position) continue;
    if (minPrice != null && player.price != null && player.price < minPrice) continue;
    if (maxPrice != null && player.price != null && player.price > maxPrice) continue;
    if (!includeUnavailable && (player.status === "I" || player.status === "S"))
      continue;
    const result = results[player.team];
    if (!result) continue;

    const detail = playerExpectedPoints(player, weekWeights, ctx);
    rows.push({
      player,
      score: detail.xp,
      detail,
      avgDifficulty: weightedDifficulty(result.diffs, weekWeights),
      startProb: detail.minutes.pStart,
      per90: fantasyPer90(detail.summary),
    });
  }

  // Eşit puanda ucuz olan önce: fiyat puana girmiyor ama sırayı bozar.
  return rows.sort(
    (a, b) =>
      b.score - a.score ||
      (a.player.price ?? 0) - (b.player.price ?? 0) ||
      a.player.name.localeCompare(b.player.name, "tr"),
  );
}

export function teamName(id: string): string {
  return byId[id]?.name ?? id;
}
