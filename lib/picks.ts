import { byId, MATCHDAYS } from "@/lib/data";
import {
  type Player,
  players as allPlayers,
  type Position,
} from "@/lib/fantasy";
import { fantasyPer90, minutesMultiplier } from "@/lib/lineups";
import type { TeamResult } from "@/lib/models";
import { playerExpectedPoints, type PlayerXp, type XpContext } from "@/lib/xp";

/**
 * Oyuncu önerisi: üç sinyal 0-100'e çevrilip ağırlıklı ortalaması alınır,
 * sonuç süre çarpanıyla ölçeklenir.
 *
 *   skor = (w_model·model + w_sel·seçilme + w_points·puan) × süre çarpanı
 *
 * - model: oyuncu oynarsa bu haftalardan beklenen puanı (lib/xp.ts). Fikstür
 *   zorluğu, ev/deplasman, mevki ve oyuncunun kendi oranları bunun içinde;
 *   ayrıca bir "fikstür" kaydırağı yok, çünkü aynı şey iki kez sayılırdı.
 *   Fikstürün ağırlığı zorluk modeli panelinden ve hafta seçicisinden gelir.
 * - sel: seçilme oranı (yüksek = iyi; kalabalığın bilgisi ve "oynar" sinyali).
 * - points: birikmiş fantasy puanı, 90 dakika başına ve az dakikada güvensiz
 *   sayılarak.
 *
 * Oynama olasılığı ağırlıklı bir sinyal değil, en sondaki çarpan: model zaten
 * "oynarsa" varsayımıyla hesaplandığı için dakika tam olarak bir kez sayılır.
 * Fiyat skora girmez; bütçe kadro kurucuda sert kısıt.
 */
export type PickWeights = {
  model: number;
  sel: number;
  points: number;
};

export const PICK_SIGNALS: (keyof PickWeights)[] = ["model", "sel", "points"];

/** Model 2/3, seçilme 1/3; geçmiş puan kapalı (modelin içinde zaten var). */
export const DEFAULT_PICK_WEIGHTS: PickWeights = {
  model: 100,
  sel: 50,
  points: 0,
};

export const DEFAULT_MINUTES_IMPACT = 1;

export type PickRow = {
  player: Player;
  /** Takımın seçili haftalardaki ağırlıklı zorluğu (1-5). */
  avgDifficulty: number;
  /** Gerçekçi beklenen puan: oynama olasılığı dahil. Listede gösterilir. */
  xp: number;
  /** Oynarsa beklenen puan; model sinyalinin ham değeri. */
  xpPerStart: number;
  modelScore: number;
  selScore: number;
  pointsScore: number;
  /** Sıradaki haftada ilk 11'de başlama olasılığı, 0-1. */
  startProb: number;
  /** Ağırlıklı toplam × süre çarpanı, 0-100. */
  score: number;
  detail: PlayerXp;
  /** Son maçlardan gerçek fantasy puanı / 90 (düzeltmeli); veri yoksa null. */
  per90: number | null;
};

/** Oyunun kendi maç başına puanı; yoksa toplam/dakikadan kaba karşılık. */
export function officialPerMatch(player: Player): number | null {
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
  weights?: PickWeights;
  /** Başlama olasılığının skora etkisi, 0-1. */
  minutesImpact?: number;
  /** Seçilme oranını ters çevir: az seçilen oyuncular öne. */
  selInvert?: boolean;
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
 * azalma açılır. Fikstür zorluğu da bu ağırlıklarla hesaplanır.
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

/** Oynarsa beklenen puan -> 0-100. Havuzdaki en iyisi 100. */
export function modelScore(xpPerStart: number, maxXpPerStart: number): number {
  if (maxXpPerStart <= 0) return 0;
  return (100 * Math.max(0, xpPerStart)) / maxXpPerStart;
}

/**
 * Seçilme oranı -> 0-100. Logaritmik: %0 ile %5 arası fark, %40 ile %59
 * arasındaki farktan daha önemli. Havuzdaki en yüksek oran 100 olur.
 */
export function selScore(sel: number, maxSel: number): number {
  if (maxSel <= 0) return 0;
  return (100 * Math.log1p(Math.max(0, sel))) / Math.log1p(maxSel);
}

/**
 * Güvenilirlik düzeltmesi: 90 dakika başına puan, dakika azken sıfıra doğru
 * çekilir. 270 dakika (üç tam maç) oynayan gerçek ortalamasının yarısını alır;
 * böylece 20 dakikada 4 puan toplayan yedek, asilin önüne geçemez.
 */
export const PRIOR_MINS = 270;

export function adjustedPointsPer90(pts: number, mins: number): number {
  if (mins <= 0 || pts <= 0) return 0;
  return ((90 * pts) / mins) * (mins / (mins + PRIOR_MINS));
}

/** Düzeltilmiş puan -> 0-100. Havuzdaki en yüksek 100; verisi olmayan 0. */
export function pointsScore(adjusted: number, maxAdjusted: number): number {
  if (maxAdjusted <= 0) return 0;
  return (100 * Math.max(0, adjusted)) / maxAdjusted;
}

/** Ağırlıkların yüzde payı; arayüzde "bu sinyal %kaç" diye gösterilir. */
export function pickShares(weights: PickWeights): Record<keyof PickWeights, number> {
  const total = PICK_SIGNALS.reduce((s, k) => s + Math.max(0, weights[k] ?? 0), 0);
  const out = {} as Record<keyof PickWeights, number>;
  for (const k of PICK_SIGNALS) {
    out[k] =
      total > 0
        ? (100 * Math.max(0, weights[k] ?? 0)) / total
        : 100 / PICK_SIGNALS.length;
  }
  return out;
}

export function rankPicks({
  results,
  ctx,
  weekWeights,
  pool = allPlayers,
  weights = DEFAULT_PICK_WEIGHTS,
  minutesImpact = DEFAULT_MINUTES_IMPACT,
  selInvert = false,
  position,
  minPrice,
  maxPrice,
  includeUnavailable = false,
}: PickInput): PickRow[] {
  // Önce seçilebilir tüm oyuncular hesaplanır; mevki ve fiyat filtresi en sona
  // bırakılır ki ölçekler (havuzun en iyisi) filtreye göre kaymasın.
  type Base = {
    player: Player;
    detail: PlayerXp;
    avgDifficulty: number;
    startProb: number;
    per90: number | null;
    adjusted: number;
  };
  const base: Base[] = [];
  for (const player of pool) {
    if (!includeUnavailable && (player.status === "I" || player.status === "S")) continue;
    const result = results[player.team];
    if (!result) continue;
    const detail = playerExpectedPoints(player, weekWeights, ctx);
    base.push({
      player,
      detail,
      avgDifficulty: weightedDifficulty(result.diffs, weekWeights),
      startProb: detail.minutes.pStart,
      per90: fantasyPer90(detail.summary),
      adjusted: adjustedPointsPer90(player.pts, player.mins),
    });
  }
  if (!base.length) return [];

  const maxModel = Math.max(0, ...base.map((r) => r.detail.xpPerStart));
  const maxAdjusted = Math.max(0, ...base.map((r) => r.adjusted));
  const selOf = (p: Player) => (selInvert ? 100 - (p.sel ?? 0) : (p.sel ?? 0));
  const maxSel = Math.max(0, ...base.map((r) => selOf(r.player)));

  const total = PICK_SIGNALS.reduce((s, k) => s + Math.max(0, weights[k] ?? 0), 0);
  // Hepsi sıfırsa düz ortalama.
  const w = Object.fromEntries(
    PICK_SIGNALS.map((k) => [
      k,
      total > 0 ? Math.max(0, weights[k] ?? 0) / total : 1 / PICK_SIGNALS.length,
    ]),
  ) as Record<keyof PickWeights, number>;

  const rows: PickRow[] = base.map((r) => {
    const model = modelScore(r.detail.xpPerStart, maxModel);
    const sel = selScore(selOf(r.player), maxSel);
    const points = pointsScore(r.adjusted, maxAdjusted);
    return {
      player: r.player,
      avgDifficulty: r.avgDifficulty,
      xp: r.detail.xp,
      xpPerStart: r.detail.xpPerStart,
      modelScore: model,
      selScore: sel,
      pointsScore: points,
      startProb: r.startProb,
      score:
        (w.model * model + w.sel * sel + w.points * points) *
        minutesMultiplier(r.startProb, minutesImpact),
      detail: r.detail,
      per90: r.per90,
    };
  });

  const filtered = rows.filter((r) => {
    if (position && r.player.pos !== position) return false;
    if (minPrice != null && r.player.price != null && r.player.price < minPrice) return false;
    if (maxPrice != null && r.player.price != null && r.player.price > maxPrice) return false;
    return true;
  });

  // Eşit puanda ucuz olan önce: fiyat skora girmiyor ama sırayı bozar.
  return filtered.sort(
    (a, b) =>
      b.score - a.score ||
      (a.player.price ?? 0) - (b.player.price ?? 0) ||
      a.player.name.localeCompare(b.player.name, "tr"),
  );
}

export function teamName(id: string): string {
  return byId[id]?.name ?? id;
}
