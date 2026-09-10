import { describe, expect, it } from "vitest";
import { MATCHDAYS } from "@/lib/data";
import { minutesMultiplier } from "@/lib/lineups";
import { computeAll, DEFAULT_PARAMS } from "@/lib/models";
import {
  adjustedPointsPer90,
  DEFAULT_PICK_WEIGHTS,
  MAX_HORIZON,
  modelScore,
  type PickWeights,
  pickShares,
  pointsScore,
  PRIOR_MINS,
  rankPicks,
  selScore,
  weekDecayWeights,
  weightedDifficulty,
} from "@/lib/picks";

const { results, strength } = computeAll({ model: "abs", params: DEFAULT_PARAMS });
const ctx = { strength, homeAdvantage: 6 };
const weekWeights = weekDecayWeights(5, 1, 0.5);
const only = (over: Partial<PickWeights>): PickWeights => ({
  model: 0,
  sel: 0,
  points: 0,
  ...over,
});

const rank = (weights?: PickWeights, extra: Partial<Parameters<typeof rankPicks>[0]> = {}) =>
  rankPicks({ results, ctx, weekWeights, weights, ...extra });

describe("weekDecayWeights", () => {
  it("seçili haftadan başlar, decay kadar azalır, dışı sıfır", () => {
    const w = weekDecayWeights(5, 3, 0.5);
    expect(w).toHaveLength(MATCHDAYS);
    expect(w[3]).toBe(0);
    expect(w[4]).toBe(1);
    expect(w[5]).toBe(0.5);
    expect(w[6]).toBe(0.25);
    expect(w[7]).toBe(0);
    expect(weekDecayWeights(5, 3, 0).filter(Boolean)).toEqual([1]);
    expect(weekDecayWeights(1, 99, 1).filter(Boolean)).toHaveLength(MAX_HORIZON);
  });
});

describe("weightedDifficulty", () => {
  it("ağırlıklı ortalama; hepsi sıfırsa düz ortalama", () => {
    expect(weightedDifficulty([2, 4], [1, 1])).toBe(3);
    expect(weightedDifficulty([2, 4], [3, 1])).toBeCloseTo(2.5, 10);
    expect(weightedDifficulty([2, 4], [0, 0])).toBe(3);
  });
});

describe("sinyal dönüşümleri", () => {
  it("model: havuzun en iyisi 100, oranlı", () => {
    expect(modelScore(8, 8)).toBe(100);
    expect(modelScore(4, 8)).toBe(50);
    expect(modelScore(0, 8)).toBe(0);
    expect(modelScore(5, 0)).toBe(0);
  });

  it("seçilme: logaritmik, en yüksek oran 100", () => {
    expect(selScore(80, 80)).toBe(100);
    expect(selScore(0, 80)).toBe(0);
    // %0-%5 aralığı, %40-%59 aralığından daha çok fark yaratır.
    const low = selScore(5, 80) - selScore(0, 80);
    const high = selScore(59, 80) - selScore(40, 80);
    expect(low).toBeGreaterThan(high);
  });

  it("geçmiş puan: 90 dakika başına, az dakikada güvensiz", () => {
    // 270 dakikada gerçek ortalamanın yarısı.
    expect(adjustedPointsPer90(30, PRIOR_MINS)).toBeCloseTo((90 * 30) / PRIOR_MINS / 2, 10);
    expect(adjustedPointsPer90(0, 500)).toBe(0);
    expect(adjustedPointsPer90(10, 0)).toBe(0);
    // 20 dakikada 4 puan, 900 dakikada 90 puanın önüne geçemez.
    expect(adjustedPointsPer90(4, 20)).toBeLessThan(adjustedPointsPer90(90, 900));
    expect(pointsScore(5, 10)).toBe(50);
    expect(pointsScore(5, 0)).toBe(0);
  });

  it("süre çarpanı: etki 1'de hiç oynamayan ×0,15, etki 0'da çarpan yok", () => {
    expect(minutesMultiplier(1, 1)).toBeCloseTo(1, 10);
    expect(minutesMultiplier(0, 1)).toBeCloseTo(0.15, 10);
    expect(minutesMultiplier(0, 0)).toBe(1);
    expect(minutesMultiplier(0.5, 0.5)).toBeCloseTo(0.5 + 0.5 * (0.15 + 0.425), 10);
  });
});

describe("pickShares", () => {
  it("paylar yüzdeye çevrilir, toplam 100", () => {
    const s = pickShares({ model: 100, sel: 50, points: 50 });
    expect(s.model).toBeCloseTo(50, 10);
    expect(s.sel).toBeCloseTo(25, 10);
    expect(Object.values(s).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
    // Hepsi sıfırsa düz ortalama.
    expect(pickShares({ model: 0, sel: 0, points: 0 }).model).toBeCloseTo(100 / 3, 10);
  });
});

describe("rankPicks", () => {
  it("skor = ağırlıklı sinyal toplamı × süre çarpanı", () => {
    const weights = { model: 100, sel: 50, points: 50 };
    const rows = rank(weights);
    expect(rows.length).toBeGreaterThan(300);
    const total = 200;
    for (const r of rows.slice(0, 40)) {
      const expected =
        ((100 * r.modelScore + 50 * r.selScore + 50 * r.pointsScore) / total) *
        minutesMultiplier(r.startProb, 1);
      expect(r.score).toBeCloseTo(expected, 9);
    }
  });

  it("model tek başına: oynarsa beklenen puanı en yüksek oyuncu başa geçer", () => {
    const rows = rank(only({ model: 100 }), { minutesImpact: 0 });
    const best = Math.max(...rows.map((r) => r.xpPerStart));
    expect(rows[0].xpPerStart).toBeCloseTo(best, 9);
  });

  it("süre çarpanı: etkisi kapatılınca oynamayan oyuncular yükselir", () => {
    const full = rank(only({ model: 100 }), { minutesImpact: 1 });
    const none = rank(only({ model: 100 }), { minutesImpact: 0 });
    const lowStart = (rows: typeof full) =>
      rows.slice(0, 25).filter((r) => r.startProb < 0.5).length;
    expect(lowStart(none)).toBeGreaterThanOrEqual(lowStart(full));
    // Etki tam açıkken listenin başı oynayan oyunculardan oluşur.
    expect(full.slice(0, 10).every((r) => r.startProb > 0.5)).toBe(true);
  });

  it("seçilme tek başına: en çok seçilen başa geçer, ters çevrilince tersine döner", () => {
    const top = rank(only({ sel: 100 }), { minutesImpact: 0 })[0];
    const maxSel = Math.max(...rank(DEFAULT_PICK_WEIGHTS).map((r) => r.player.sel ?? 0));
    expect(top.player.sel).toBeCloseTo(maxSel, 10);
    const inverted = rank(only({ sel: 100 }), { minutesImpact: 0, selInvert: true })[0];
    expect(inverted.player.sel ?? 0).toBeLessThan(top.player.sel ?? 0);
  });

  it("geçmiş puan tek başına: düzeltilmiş puanı en yüksek oyuncu başa geçer", () => {
    const rows = rank(only({ points: 100 }), { minutesImpact: 0 });
    const best = Math.max(...rows.map((r) => adjustedPointsPer90(r.player.pts, r.player.mins)));
    expect(adjustedPointsPer90(rows[0].player.pts, rows[0].player.mins)).toBeCloseTo(best, 9);
  });

  it("ağırlıkların büyüklüğü değil oranı önemli; hepsi sıfırsa düz ortalama", () => {
    const a = rank({ model: 100, sel: 50, points: 0 }).map((r) => r.score);
    const b = rank({ model: 20, sel: 10, points: 0 }).map((r) => r.score);
    a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 9));
    const flat = rank({ model: 0, sel: 0, points: 0 })[0];
    const even = rank({ model: 1, sel: 1, points: 1 })[0];
    expect(flat.score).toBeCloseTo(even.score, 9);
  });

  it("mevki filtresi ölçekleri ve sırayı bozmaz", () => {
    const all = rank(DEFAULT_PICK_WEIGHTS);
    const keepers = all.filter((r) => r.player.pos === "GK").map((r) => r.player.name);
    const filtered = rank(DEFAULT_PICK_WEIGHTS, { position: "GK" }).map((r) => r.player.name);
    expect(filtered).toEqual(keepers);
  });

  it("sakat ve cezalılar listeye girmez", () => {
    for (const r of rank(DEFAULT_PICK_WEIGHTS)) {
      expect(["I", "S"]).not.toContain(r.player.status);
    }
  });

  it("oynama olasılığı düşük oyuncuda \"oynarsa\" puanı belirgin biçimde yüksek", () => {
    const rows = rank(DEFAULT_PICK_WEIGHTS);
    const doubtful = rows.filter((r) => r.startProb < 0.4);
    expect(doubtful.length).toBeGreaterThan(20);
    for (const r of doubtful) expect(r.xpPerStart).toBeGreaterThan(r.xp);
    // Kalesinde çok gol beklenen bir defans için fazla dakika ceza getirebilir;
    // bu yüzden ilişki evrensel değil, yalnız az oynayanlar için kesin.
    const inverted = rows.filter((r) => r.xpPerStart < r.xp - 1e-9);
    expect(inverted.length).toBeLessThan(rows.length * 0.02);
    for (const r of inverted) expect(r.startProb).toBeGreaterThan(0.8);
  });
});
