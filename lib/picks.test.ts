import { describe, expect, it } from "vitest";
import { players, POSITIONS } from "@/lib/fantasy";
import { computeAll, DEFAULT_PARAMS } from "@/lib/models";
import { rankPicks, weekDecayWeights, weightedDifficulty } from "@/lib/picks";

describe("hafta ağırlıkları", () => {
  it("weekDecayWeights: seçili hafta 1, sonrakiler azalarak; pencere dışı 0", () => {
    const w = weekDecayWeights(5, 3, 0.5);
    expect(w).toHaveLength(34);
    expect(w[3]).toBe(0);
    expect(w.slice(4, 7)).toEqual([1, 0.5, 0.25]);
    expect(w[7]).toBe(0);
    expect(weekDecayWeights(34, 8, 0.5).filter(Boolean)).toHaveLength(1);
    expect(weekDecayWeights(1, 1, 1)).toEqual([1, ...Array(33).fill(0)]);
  });

  it("weightedDifficulty: ağırlıklı ortalama; ağırlıklar sıfırsa düz ortalama", () => {
    expect(weightedDifficulty([1, 2, 3, 4], [1, 0.5, 0.25, 0.125])).toBeCloseTo(3.25 / 1.875, 10);
    expect(weightedDifficulty([1, 2, 3, 4], [0, 0, 0, 0])).toBeCloseTo(2.5, 10);
  });
});

describe("rankPicks — gerçek veri", () => {
  const { results, strength } = computeAll({ model: "abs", params: DEFAULT_PARAMS });
  const ctx = { strength, homeAdvantage: 6 };
  const rows = rankPicks({ results, ctx, weekWeights: weekDecayWeights(5, 1, 0.5) });

  it("sakat ve cezalılar elenir, sıralama azalan, her mevkiden oyuncu var", () => {
    expect(rows.length).toBeGreaterThan(400);
    for (const r of rows) expect(["I", "S"]).not.toContain(r.player.status);
    for (let i = 1; i < rows.length; i++) expect(rows[i].score).toBeLessThanOrEqual(rows[i - 1].score + 1e-9);
    for (const pos of POSITIONS) expect(rows.some((r) => r.player.pos === pos)).toBe(true);
  });

  it("ilk 20'nin çoğu düzenli başlayan oyuncular; xP makul aralıkta", () => {
    const top = rows.slice(0, 20);
    expect(top.filter((r) => r.startProb >= 0.6).length).toBeGreaterThanOrEqual(15);
    for (const r of top) {
      expect(r.score).toBeGreaterThan(2);
      expect(r.score).toBeLessThan(15);
    }
  });

  it("mevki ve durum filtreleri", () => {
    const gks = rankPicks({ results, ctx, weekWeights: weekDecayWeights(5, 1, 0.5), position: "GK" });
    expect(gks.every((r) => r.player.pos === "GK")).toBe(true);
    const withAll = rankPicks({ results, ctx, weekWeights: weekDecayWeights(5, 1, 0.5), includeUnavailable: true });
    expect(withAll.length).toBe(players.length);
  });
});
