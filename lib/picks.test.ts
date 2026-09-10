import { describe, expect, it } from "vitest";
import { MATCHDAYS } from "@/lib/data";
import { computeAll, DEFAULT_PARAMS } from "@/lib/models";
import {
  DEFAULT_PICK_WEIGHTS,
  MAX_HORIZON,
  type PickWeights,
  pickShares,
  rankPicks,
  weekDecayWeights,
  weightedDifficulty,
} from "@/lib/picks";

const { results, strength } = computeAll({ model: "abs", params: DEFAULT_PARAMS });
const ctx = { strength, homeAdvantage: 6 };
const weekWeights = weekDecayWeights(5, 1, 0.5);
const only = (over: Partial<PickWeights>): PickWeights => ({
  xp: 0,
  fixture: 0,
  form: 0,
  points: 0,
  start: 0,
  sel: 0,
  ...over,
});

const rank = (weights?: PickWeights, selInvert = false) =>
  rankPicks({ results, ctx, weekWeights, weights, selInvert });

describe("weekDecayWeights", () => {
  it("seçili haftadan başlar, decay kadar azalır, dışı sıfır", () => {
    const w = weekDecayWeights(5, 3, 0.5);
    expect(w).toHaveLength(MATCHDAYS);
    expect(w[3]).toBe(0);
    expect(w[4]).toBe(1);
    expect(w[5]).toBe(0.5);
    expect(w[6]).toBe(0.25);
    expect(w[7]).toBe(0);
    // decay 0: yalnız seçili hafta
    expect(weekDecayWeights(5, 3, 0).filter(Boolean)).toEqual([1]);
    // ufuk kırpılır
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

describe("pickShares", () => {
  it("paylar yüzdeye çevrilir, toplam 100", () => {
    const s = pickShares(only({ xp: 60, form: 20, sel: 20 }));
    expect(s.xp).toBeCloseTo(60, 10);
    expect(s.form).toBeCloseTo(20, 10);
    expect(s.points).toBe(0);
    expect(Object.values(s).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
    // Hepsi sıfırsa beklenen puan tek başına kullanılır.
    expect(pickShares(only({})).xp).toBe(100);
  });
});

describe("rankPicks — ağırlıklar", () => {
  it("varsayılan ağırlıkta skor birebir beklenen puana eşit", () => {
    const rows = rank(DEFAULT_PICK_WEIGHTS);
    expect(rows.length).toBeGreaterThan(300);
    for (const r of rows) expect(r.score).toBeCloseTo(r.xp, 9);
    // Sıra da beklenen puana göre.
    for (let i = 1; i < rows.length; i++) expect(rows[i].xp).toBeLessThanOrEqual(rows[i - 1].xp + 1e-9);
  });

  it("tüm ağırlıklar sıfırsa beklenen puana düşer", () => {
    const rows = rank(only({}));
    for (const r of rows) expect(r.score).toBeCloseTo(r.xp, 9);
  });

  it("yalnız seçilme oranı: sıra seçilme oranını izler, ters çevrilince tersine döner", () => {
    const top = rank(only({ sel: 100 }))[0];
    const maxSel = Math.max(...rank(DEFAULT_PICK_WEIGHTS).map((r) => r.player.sel ?? 0));
    expect(top.player.sel).toBeCloseTo(maxSel, 10);

    const inverted = rank(only({ sel: 100 }), true)[0];
    expect(inverted.player.sel ?? 0).toBeLessThan(top.player.sel ?? 0);
  });

  it("yalnız fikstür: en kolay fikstürlü oyuncu başa geçer", () => {
    const rows = rank(only({ fixture: 100 }));
    const easiest = Math.min(...rows.map((r) => r.avgDifficulty));
    expect(rows[0].avgDifficulty).toBeCloseTo(easiest, 10);
  });

  it("yalnız ilk 11 olasılığı: en yüksek olasılıklı oyuncu başa geçer", () => {
    const rows = rank(only({ start: 100 }));
    const best = Math.max(...rows.map((r) => r.startProb));
    expect(rows[0].startProb).toBeCloseTo(best, 10);
  });

  it("skor beklenen puan ölçeğinde kalır", () => {
    const plain = rank(DEFAULT_PICK_WEIGHTS);
    const xpMin = Math.min(...plain.map((r) => r.xp));
    const xpMax = Math.max(...plain.map((r) => r.xp));
    for (const r of rank(only({ xp: 50, fixture: 30, sel: 20 }))) {
      expect(r.score).toBeGreaterThanOrEqual(xpMin - 1e-9);
      expect(r.score).toBeLessThanOrEqual(xpMax + 1e-9);
      // Saf beklenen puan ağırlıklardan etkilenmez.
      expect(r.xp).toBeGreaterThanOrEqual(0);
    }
  });

  it("ağırlık karışımı sırayı gerçekten değiştirir", () => {
    const a = rank(DEFAULT_PICK_WEIGHTS).slice(0, 20).map((r) => r.player.name);
    const b = rank(only({ xp: 40, sel: 60 })).slice(0, 20).map((r) => r.player.name);
    expect(b).not.toEqual(a);
  });

  it("sinyaller 0-100 aralığında ve mevki filtresi sırayı bozmaz", () => {
    const rows = rank(only({ xp: 50, form: 50 }));
    for (const r of rows.slice(0, 50)) {
      for (const v of Object.values(r.signals)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
    // Filtresiz listedeki kalecilerin sırası, mevki filtresiyle aynı olmalı.
    const keepers = rows.filter((r) => r.player.pos === "GK").map((r) => r.player.name);
    const filtered = rankPicks({
      results,
      ctx,
      weekWeights,
      weights: only({ xp: 50, form: 50 }),
      position: "GK",
    }).map((r) => r.player.name);
    expect(filtered).toEqual(keepers);
  });

  it("sakat ve cezalılar listeye girmez", () => {
    for (const r of rank(DEFAULT_PICK_WEIGHTS)) {
      expect(["I", "S"]).not.toContain(r.player.status);
    }
  });
});
