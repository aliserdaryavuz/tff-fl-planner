import { describe, expect, it } from "vitest";
import { teamIds } from "@/lib/data";
import {
  computeAll,
  DEFAULT_PARAMS,
  MODEL_KEYS,
  strengthDifficulty,
  strengthRelDifficulty,
  strengthTable,
  windowMask,
} from "@/lib/models";
import { availableSources, blendedStrength, sourceStrength, weightShares } from "@/lib/strength";

const LAST_ONLY = { ha: 6, gamma: 1, weights: { last: 100 } };

describe("rakip bazlı zorluk", () => {
  it("güç 100 evde 4,76; deplasmanda kırpılıp 5,0", () => {
    expect(strengthDifficulty(100, "E", LAST_ONLY)).toBeCloseTo(4.76, 10);
    expect(strengthDifficulty(100, "D", LAST_ONLY)).toBe(5);
  });
  it("güç 0 evde kırpılıp 1,0; deplasmanda 1,24", () => {
    expect(strengthDifficulty(0, "E", LAST_ONLY)).toBe(1);
    expect(strengthDifficulty(0, "D", LAST_ONLY)).toBeCloseTo(1.24, 10);
  });
});

describe("göreli zorluk", () => {
  it("eşit güçte ev 2,88; deplasman 3,12; uçlar kırpılır", () => {
    expect(strengthRelDifficulty(50, 50, "E", LAST_ONLY)).toBeCloseTo(2.88, 10);
    expect(strengthRelDifficulty(50, 50, "D", LAST_ONLY)).toBeCloseTo(3.12, 10);
    expect(strengthRelDifficulty(100, 0, "E", LAST_ONLY)).toBe(1);
    expect(strengthRelDifficulty(0, 100, "D", LAST_ONLY)).toBe(5);
  });
});

describe("güç kaynakları", () => {
  it("geçen sezon sırası: Galatasaray 100, Çorum 0, Fenerbahçe 16/17", () => {
    const s = sourceStrength("last")!;
    expect(s["Galatasaray"]).toBeCloseTo(100, 10);
    expect(s["Corum"]).toBeCloseTo(0, 10);
    expect(s["Fenerbahce"]).toBeCloseTo((100 * 16) / 17, 10);
  });

  it("her kaynakta en zayıf 0, en güçlü 100", () => {
    for (const source of availableSources()) {
      const table = sourceStrength(source.key)!;
      const values = Object.values(table);
      expect(Math.min(...values), source.key).toBeCloseTo(0, 10);
      expect(Math.max(...values), source.key).toBeCloseTo(100, 10);
    }
  });

  it("Opta ve kadro değeri yüklü; varsayılan karışım dört kaynak", () => {
    expect(availableSources().map((s) => s.key)).toEqual(["opta", "value", "last", "table"]);
    expect(DEFAULT_PARAMS.abs.weights).toEqual({ opta: 100, value: 100, last: 50, table: 50 });
    const shares = weightShares(DEFAULT_PARAMS.abs.weights);
    expect(shares.opta).toBeCloseTo(100 / 3, 10);
    expect(shares.last).toBeCloseTo(100 / 6, 10);
  });

  it("ağırlığın büyüklüğü değil oranı önemli; gamma karışımdan sonra", () => {
    const a = blendedStrength({ opta: 50, value: 50 });
    const b = blendedStrength({ opta: 7, value: 7 });
    expect(a["Fenerbahce"]).toBeCloseTo(b["Fenerbahce"], 10);
    const curved = blendedStrength({ opta: 50, value: 50 }, 0.5);
    expect(curved["Fenerbahce"]).toBeCloseTo(100 * Math.sqrt(a["Fenerbahce"] / 100), 10);
  });

  it("Galatasaray varsayılan karışımda en güçlü üçte", () => {
    const s = strengthTable(DEFAULT_PARAMS.abs);
    const rank = teamIds.filter((id) => s[id] > s["Galatasaray"]).length + 1;
    expect(rank).toBeLessThanOrEqual(3);
  });
});

describe("computeAll", () => {
  it("34 zorluk, 1-5 aralığında, 1 ondalıklı; sıra 1 = en kolay", () => {
    for (const model of MODEL_KEYS) {
      const { results, order } = computeAll({ model, params: DEFAULT_PARAMS });
      expect(order).toHaveLength(18);
      expect(results[order[0]].rank).toBe(1);
      for (const id of teamIds) {
        expect(results[id].diffs).toHaveLength(34);
        for (const d of results[id].diffs) {
          expect(d).toBeGreaterThanOrEqual(1);
          expect(d).toBeLessThanOrEqual(5);
          expect(Math.round(d * 10)).toBeCloseTo(d * 10, 10);
        }
      }
      for (let i = 1; i < order.length; i++) {
        expect(results[order[i]].total).toBeGreaterThanOrEqual(results[order[i - 1]].total);
      }
    }
  });

  it("pencere maskesi: 5. haftadan 3 hafta -> n = 3", () => {
    const weeks = windowMask(5, 3);
    expect(weeks.filter(Boolean).length).toBe(3);
    expect(weeks[4] && weeks[5] && weeks[6]).toBe(true);
    const { results } = computeAll({ model: "abs", params: DEFAULT_PARAMS, weeks });
    expect(results["Galatasaray"].n).toBe(3);
    const d = results["Galatasaray"].diffs;
    expect(results["Galatasaray"].total).toBeCloseTo(d[4] + d[5] + d[6], 10);
  });

  it("göreli modelde güçlü takımın toplamı zayıf takımdan düşük", () => {
    const { results } = computeAll({ model: "rel", params: { abs: LAST_ONLY, rel: LAST_ONLY } });
    expect(results["Galatasaray"].total).toBeLessThan(results["Corum"].total);
  });
});
