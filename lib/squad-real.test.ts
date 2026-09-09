import { describe, expect, it } from "vitest";
import { isValidFormation } from "@/lib/formations";
import { computeAll, DEFAULT_PARAMS } from "@/lib/models";
import { rankPicks, weekDecayWeights } from "@/lib/picks";
import { buildSquad, FORMATION, MAX_PER_CLUB } from "@/lib/squad";

/**
 * Gerçek oyuncu havuzu (540 oyuncu, 18 kulüp) ama yapay fiyat: oyunun fiyatları
 * giriş gerektirdiği için burada beklenen puandan türetilmiş 0,1 adımlı bir
 * fiyat kullanılır. Amaç yalnızca çalışma süresi ve kısıtların gerçek ölçekte
 * sağlandığını görmek; fiyatlar veri dosyasına yazılmaz.
 */
describe("buildSquad — gerçek havuz, yapay fiyat", () => {
  const { results, strength } = computeAll({ model: "abs", params: DEFAULT_PARAMS });
  const base = rankPicks({ results, ctx: { strength, homeAdvantage: 6 }, weekWeights: weekDecayWeights(5, 1, 0.5) });
  const rows = base.map((r) => ({
    ...r,
    player: { ...r.player, price: Math.round((3.5 + 1.6 * Math.max(0, r.score)) * 10) / 10 },
  }));

  it("15 kişilik kadro makul sürede, kısıtlar sağlam, para ilk 11'de", () => {
    const started = Date.now();
    const result = buildSquad(rows);
    const elapsed = Date.now() - started;
    expect(result.best).not.toBeNull();
    const best = result.best!;
    const counts = best.players.reduce((acc, p) => ({ ...acc, [p.pos]: (acc[p.pos] ?? 0) + 1 }), {} as Record<string, number>);
    expect(counts).toEqual(FORMATION);
    const clubs = best.players.reduce((acc, p) => ({ ...acc, [p.team]: (acc[p.team] ?? 0) + 1 }), {} as Record<string, number>);
    expect(Math.max(...Object.values(clubs))).toBeLessThanOrEqual(MAX_PER_CLUB);
    expect(best.price).toBeLessThanOrEqual(100 + 1e-9);
    expect(isValidFormation(...best.formation)).toBe(true);
    expect(best.xi).toHaveLength(11);
    expect(best.captain).not.toBeNull();
    // Yedekler ilk 11'in ortalamasından ucuz.
    const xiAvg = best.xiPrice / 11;
    const benchAvg = (best.price - best.xiPrice) / 4;
    expect(benchAvg).toBeLessThan(xiAvg);
    // Telefonda da beklenebilir olsun.
    expect(elapsed).toBeLessThan(4000);
  });
});
