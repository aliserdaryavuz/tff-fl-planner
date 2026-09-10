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
 * Oyuncu sıralaması. Temel ölçüt beklenen puan (lib/xp.ts); istenirse başka
 * sinyaller de karışıma katılır. Her sinyal havuzun tamamında 0-100'e yayılır,
 * ağırlıklı ortalaması alınır ve sonuç yeniden beklenen puan ölçeğine
 * döndürülür. Böylece tüm ağırlık `xp`'deyken skor birebir beklenen puana eşit
 * olur; ağırlık kaydırıldıkça sayı aynı ölçekte kalır ama sıra değişir.
 *
 * Not: fikstür, form ve ilk 11 olasılığı zaten beklenen puanın içinde. Bu
 * kaydıraklar o sinyale *fazladan* ağırlık vermek içindir.
 */
export const PICK_SIGNALS = ["xp", "fixture", "form", "points", "start", "sel"] as const;

export type PickSignal = (typeof PICK_SIGNALS)[number];

export type PickWeights = Record<PickSignal, number>;

/** Varsayılan: yalnız beklenen puan. */
export const DEFAULT_PICK_WEIGHTS: PickWeights = {
  xp: 100,
  fixture: 0,
  form: 0,
  points: 0,
  start: 0,
  sel: 0,
};

export type PickRow = {
  player: Player;
  /** Sıralamada kullanılan skor (beklenen puan ölçeğinde). */
  score: number;
  /** Saf beklenen puan, hafta başına. */
  xp: number;
  detail: PlayerXp;
  /** Takımın seçili haftalardaki ağırlıklı zorluğu (1-5). */
  avgDifficulty: number;
  /** Başlama olasılığı, 0-1. */
  startProb: number;
  /** Son maçlardan gerçek fantasy puanı / 90 (düzeltmeli); veri yoksa null. */
  per90: number | null;
  /** Her sinyalin havuz içindeki 0-100 karşılığı (ipucu metni için). */
  signals: Record<PickSignal, number>;
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
  /** Sinyal ağırlıkları; verilmezse yalnız beklenen puan. */
  weights?: PickWeights;
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

/** Havuzdaki değerleri 0-100'e yayar; hepsi eşitse 50. */
function spread(values: number[]): number[] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!(max > min)) return values.map(() => 50);
  return values.map((v) => (100 * (v - min)) / (max - min));
}

/** Ağırlıkların yüzde payı; arayüzde "bu sinyal %kaç" diye gösterilir. */
export function pickShares(weights: PickWeights): Record<PickSignal, number> {
  const total = PICK_SIGNALS.reduce((s, k) => s + Math.max(0, weights[k] ?? 0), 0);
  const out = {} as Record<PickSignal, number>;
  for (const k of PICK_SIGNALS) {
    out[k] = total > 0 ? (100 * Math.max(0, weights[k] ?? 0)) / total : k === "xp" ? 100 : 0;
  }
  return out;
}

type Base = {
  player: Player;
  xp: number;
  detail: PlayerXp;
  avgDifficulty: number;
  startProb: number;
  per90: number | null;
};

/** Sinyalin ham değeri; büyük olan her zaman "daha iyi". */
function rawSignal(key: PickSignal, row: Base, selInvert: boolean): number {
  switch (key) {
    case "xp":
      return row.xp;
    case "fixture":
      // Zorluk 1-5; kolaylık = 6 - zorluk.
      return 6 - row.avgDifficulty;
    case "form":
      return row.player.form ?? 0;
    case "points":
      return row.player.pts;
    case "start":
      return row.startProb;
    case "sel":
      return selInvert ? -(row.player.sel ?? 0) : (row.player.sel ?? 0);
  }
}

export function rankPicks({
  results,
  ctx,
  weekWeights,
  pool = allPlayers,
  weights = DEFAULT_PICK_WEIGHTS,
  selInvert = false,
  position,
  minPrice,
  maxPrice,
  includeUnavailable = false,
}: PickInput): PickRow[] {
  // Önce seçilebilir tüm oyuncular puanlanır; mevki ve fiyat filtresi en sona
  // bırakılır ki normalleştirme havuzu daralmasın ve filtre sırayı kaydırmasın.
  const base: Base[] = [];
  for (const player of pool) {
    if (!includeUnavailable && (player.status === "I" || player.status === "S")) continue;
    const result = results[player.team];
    if (!result) continue;

    const detail = playerExpectedPoints(player, weekWeights, ctx);
    base.push({
      player,
      xp: detail.xp,
      detail,
      avgDifficulty: weightedDifficulty(result.diffs, weekWeights),
      startProb: detail.minutes.pStart,
      per90: fantasyPer90(detail.summary),
    });
  }
  if (!base.length) return [];

  // Her sinyal havuzun tamamında 0-100'e yayılır: mevki filtresi sırayı kaydırmaz.
  const normalized = {} as Record<PickSignal, number[]>;
  for (const key of PICK_SIGNALS) {
    normalized[key] = spread(base.map((row) => rawSignal(key, row, selInvert)));
  }

  const total = PICK_SIGNALS.reduce((s, k) => s + Math.max(0, weights[k] ?? 0), 0);
  // Beklenen puan ölçeğine geri dönüş: tüm ağırlık xp'deyken skor = xp.
  const xps = base.map((r) => r.xp);
  const xpMin = Math.min(...xps);
  const xpMax = Math.max(...xps);
  const span = xpMax - xpMin;

  const rows: PickRow[] = base.map((row, i) => {
    const signals = {} as Record<PickSignal, number>;
    for (const key of PICK_SIGNALS) signals[key] = normalized[key][i];
    let score = row.xp;
    if (total > 0) {
      let blend = 0;
      for (const key of PICK_SIGNALS) {
        blend += (Math.max(0, weights[key] ?? 0) / total) * signals[key];
      }
      score = span > 0 ? xpMin + (blend / 100) * span : row.xp;
    }
    return { ...row, score, signals };
  });

  const filtered = rows.filter((r) => {
    if (position && r.player.pos !== position) return false;
    if (minPrice != null && r.player.price != null && r.player.price < minPrice) return false;
    if (maxPrice != null && r.player.price != null && r.player.price > maxPrice) return false;
    return true;
  });

  // Eşit skorda ucuz olan önce: fiyat skora girmiyor ama sırayı bozar.
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
