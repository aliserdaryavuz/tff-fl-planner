import { describe, expect, it } from "vitest";
import { hasPrices } from "@/lib/fantasy";
import { isValidFormation } from "@/lib/formations";
import { computeAll, DEFAULT_PARAMS } from "@/lib/models";
import { rankPicks, weekDecayWeights } from "@/lib/picks";
import { BUDGET, buildSquad, FORMATION, MAX_PER_CLUB } from "@/lib/squad";

/** Oyunun gerçek fiyatlarıyla, gerçek oyuncu havuzunda uçtan uca kontrol. */
describe("buildSquad — gerçek veri ve gerçek fiyatlar", () => {
  const { results, strength } = computeAll({ model: "abs", params: DEFAULT_PARAMS });
  const rows = rankPicks({
    results,
    ctx: { strength, homeAdvantage: 6 },
    weekWeights: weekDecayWeights(5, 1, 0.5),
  });

  it("oyun fiyatları yüklü", () => {
    expect(hasPrices).toBe(true);
    expect(rows.length).toBeGreaterThan(300);
    for (const r of rows.slice(0, 50)) {
      expect(r.player.price).toBeGreaterThanOrEqual(4);
      expect(r.player.price).toBeLessThanOrEqual(12);
    }
  });

  it("15 kişilik kadro makul sürede, kısıtlar sağlam, para ilk 11'de", () => {
    const started = Date.now();
    const result = buildSquad(rows);
    const elapsed = Date.now() - started;

    expect(result.best).not.toBeNull();
    const best = result.best!;
    const counts = best.players.reduce(
      (acc, p) => ({ ...acc, [p.pos]: (acc[p.pos] ?? 0) + 1 }),
      {} as Record<string, number>,
    );
    expect(counts).toEqual(FORMATION);
    const clubs = best.players.reduce(
      (acc, p) => ({ ...acc, [p.team]: (acc[p.team] ?? 0) + 1 }),
      {} as Record<string, number>,
    );
    expect(Math.max(...Object.values(clubs))).toBeLessThanOrEqual(MAX_PER_CLUB);
    expect(best.price).toBeLessThanOrEqual(BUDGET + 1e-9);
    expect(isValidFormation(...best.formation)).toBe(true);
    expect(best.xi).toHaveLength(11);
    expect(best.bench).toHaveLength(4);
    expect(best.captain).not.toBeNull();

    // Sakat ve cezalı kadroya girmez (rankPicks eliyor).
    for (const p of best.players) expect(["I", "S"]).not.toContain(p.status);
    // Yedekler ilk 11'in ortalamasından ucuz: para sahaya gidiyor.
    expect((best.price - best.xiPrice) / 4).toBeLessThan(best.xiPrice / 11);
    // Kaptan ilk 11'in en yüksek beklenen puanlısı.
    const scoreOf = new Map(rows.map((r) => [`${r.player.team}|${r.player.name}`, r.score]));
    const top = Math.max(...best.xi.map((p) => scoreOf.get(`${p.team}|${p.name}`) ?? 0));
    expect(scoreOf.get(`${best.captain!.team}|${best.captain!.name}`)).toBeCloseTo(top, 9);

    // Telefonda da beklenebilir olsun.
    expect(elapsed).toBeLessThan(4000);
  });

  it("bütçeyi düşürmek kadroyu bozmaz, yalnız puanı düşürür", () => {
    const full = buildSquad(rows);
    const tight = buildSquad(rows, { budget: 85 });
    expect(tight.best).not.toBeNull();
    expect(tight.best!.price).toBeLessThanOrEqual(85 + 1e-9);
    expect(tight.best!.xiScore).toBeLessThanOrEqual(full.best!.xiScore + 1e-9);
  });
});
