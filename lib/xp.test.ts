import { describe, expect, it } from "vitest";
import type { Player } from "@/lib/fantasy";
import type { RecentSummary } from "@/lib/lineups";
import { computeAll, DEFAULT_PARAMS } from "@/lib/models";
import {
  expectedConcededSteps,
  expectedGoals,
  expectedPointsForFixture,
  GOAL_K,
  minutesModel,
  playerExpectedPoints,
  poisson,
  PRIORS,
  shrunkRates,
} from "@/lib/xp";
import { weekDecayWeights } from "@/lib/picks";

const player = (over: Partial<Player> = {}): Player => ({
  name: "X",
  team: "Galatasaray",
  pos: "MID",
  price: null,
  sel: null,
  status: null,
  pts: 0,
  mins: 0,
  ...over,
});

const emptySummary: RecentSummary = {
  matches: 0,
  minutes: 0,
  starts: 0,
  subIns: 0,
  minutesWhenStarted: null,
  minutesWhenSub: null,
  over60WhenStarted: null,
  goals: 0,
  assists: 0,
  yellow: 0,
  red: 0,
  ownGoals: 0,
  penMissed: 0,
  penSaved: 0,
  bonus: 0,
  fantasyPoints: 0,
};

describe("expectedGoals", () => {
  it("eşit güç, nötr saha: lig ortalaması", () => {
    const { forUs, against } = expectedGoals(50, 50, "E", 0, 1.4);
    expect(forUs).toBeCloseTo(1.4, 10);
    expect(against).toBeCloseTo(1.4, 10);
  });

  it("ev avantajı: evde daha çok gol, deplasmanda daha az", () => {
    const home = expectedGoals(50, 50, "E", 6, 1.4);
    const away = expectedGoals(50, 50, "D", 6, 1.4);
    expect(home.forUs).toBeGreaterThan(1.4);
    expect(away.forUs).toBeLessThan(1.4);
    // Simetrik: benim evimde attığım = rakibin deplasmanda yediği
    expect(home.forUs).toBeCloseTo(away.against, 10);
  });

  it("uç fark: 100'e 0 evde, k = 0,8 -> e^(0,8 × 1,06) kat", () => {
    const { forUs, against } = expectedGoals(100, 0, "E", 6, 1);
    expect(forUs).toBeCloseTo(Math.exp((GOAL_K * 106) / 100), 10);
    expect(against).toBeCloseTo(Math.exp((-GOAL_K * 106) / 100), 10);
  });
});

describe("poisson", () => {
  it("P(0) = e^-λ, olasılıklar 1'e yakın toplanır", () => {
    const p = poisson(1.2);
    expect(p[0]).toBeCloseTo(Math.exp(-1.2), 10);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });

  it("E[floor(G/2)]: λ = 0'da 0; λ arttıkça artar", () => {
    expect(expectedConcededSteps(0, 2)).toBeCloseTo(0, 10);
    // λ=2: P(2)+P(3) ×1 + P(4)+P(5) ×2 ...
    const p = poisson(2);
    const manual = p.reduce((s, q, g) => s + q * Math.floor(g / 2), 0);
    expect(expectedConcededSteps(2, 2)).toBeCloseTo(manual, 10);
    expect(expectedConcededSteps(3, 2)).toBeGreaterThan(expectedConcededSteps(1, 2));
  });
});

describe("shrunkRates", () => {
  it("verisi olmayan oyuncu mevki önceliğini alır", () => {
    const r = shrunkRates("FWD", emptySummary);
    expect(r.g90).toBeCloseTo(PRIORS.FWD.g90, 10);
    expect(r.a90).toBeCloseTo(PRIORS.FWD.a90, 10);
  });

  it("360 dakikada 4 gol: gözlenen 1,0 ile öncelik 0,35'in ortası", () => {
    const r = shrunkRates("FWD", { ...emptySummary, minutes: 360, goals: 4 });
    expect(r.g90).toBeCloseTo((1.0 + 0.35) / 2, 10);
  });
});

describe("minutesModel", () => {
  it("verisi olmayan: başlama 0,15, yedekten girme 0,3", () => {
    const m = minutesModel(player(), undefined, emptySummary);
    expect(m.pStart).toBeCloseTo(0.15, 10);
    expect(m.pPlay).toBeCloseTo(0.15 + 0.85 * 0.3, 10);
    expect(m.expectedMinutes).toBeCloseTo(0.15 * 84 + 0.85 * 0.3 * 15, 10);
  });

  it("sakat: hiç oynamaz", () => {
    const m = minutesModel(player({ status: "I" }), undefined, emptySummary);
    expect(m.pStart).toBe(0);
    expect(m.p60).toBe(0);
  });
});

describe("expectedPointsForFixture", () => {
  const ctx = { strength: { A: 80, B: 20 }, homeAdvantage: 6, mu: 1.4 };
  const sure = { pStart: 1, pPlay: 1, p60: 1, expectedMinutes: 90 };
  const rates = { g90: 0, a90: 0, y90: 0, r90: 0, bonus90: 0, saves90: 0, minutes: 0 };

  it("kesin 90 dk oynayan, hiç olay yok: 2 puan + gol yememe × olasılık − yenilen", () => {
    const def = expectedPointsForFixture(player({ team: "A", pos: "DEF" }), { opp: "B", ha: "E" }, ctx, sure, rates);
    expect(def.appearance).toBeCloseTo(2, 10);
    const { against } = expectedGoals(80, 20, "E", 6, 1.4);
    expect(def.pCleanSheet).toBeCloseTo(Math.exp(-against), 10);
    expect(def.cleanSheet).toBeCloseTo(4 * Math.exp(-against), 10);
    expect(def.conceded).toBeCloseTo(-expectedConcededSteps(against, 2), 10);
    expect(def.goals).toBe(0);
    expect(def.total).toBeCloseTo(def.appearance + def.cleanSheet + def.conceded, 10);
  });

  it("forvet gol oranı takımın beklenen golüyle ölçeklenir", () => {
    const fwdRates = { ...rates, g90: 0.5 };
    const strong = expectedPointsForFixture(player({ team: "A", pos: "FWD" }), { opp: "B", ha: "E" }, ctx, sure, fwdRates);
    const weak = expectedPointsForFixture(player({ team: "B", pos: "FWD" }), { opp: "A", ha: "D" }, ctx, sure, fwdRates);
    expect(strong.goals).toBeGreaterThan(weak.goals);
    const { forUs } = expectedGoals(80, 20, "E", 6, 1.4);
    expect(strong.goals).toBeCloseTo(0.5 * (forUs / 1.4) * 4, 10);
    // Forvet gol yememe puanı almaz
    expect(strong.cleanSheet).toBe(0);
    expect(strong.conceded).toBe(0);
  });

  it("kaleci: kurtarış rakibin beklenen golüyle artar", () => {
    const gkRates = { ...rates, saves90: 3 };
    const easy = expectedPointsForFixture(player({ team: "A", pos: "GK" }), { opp: "B", ha: "E" }, ctx, sure, gkRates);
    const hard = expectedPointsForFixture(player({ team: "B", pos: "GK" }), { opp: "A", ha: "D" }, ctx, sure, gkRates);
    expect(hard.saves).toBeGreaterThan(easy.saves);
    expect(easy.cleanSheet).toBeGreaterThan(hard.cleanSheet);
  });
});

describe("playerExpectedPoints — gerçek veri", () => {
  const { strength } = computeAll({ model: "abs", params: DEFAULT_PARAMS });
  const ctx = { strength, homeAdvantage: 6 };

  it("tek hafta: yalnız o haftanın maçı sayılır; ufuk açılınca ağırlıklı ortalama", () => {
    const p = player({ name: "Victor Osimhen", team: "Galatasaray", pos: "FWD" });
    const one = playerExpectedPoints(p, weekDecayWeights(5, 1, 0.5), ctx);
    expect(one.weeks).toHaveLength(1);
    expect(one.weeks[0].md).toBe(5);
    expect(one.xp).toBeGreaterThan(0);
    const three = playerExpectedPoints(p, weekDecayWeights(5, 3, 0.5), ctx);
    expect(three.weeks.map((w) => w.md)).toEqual([5, 6, 7]);
    const manual =
      three.weeks.reduce((s, w) => s + w.weight * (w.xp?.total ?? 0), 0) /
      three.weeks.reduce((s, w) => s + w.weight, 0);
    expect(three.xp).toBeCloseTo(manual, 10);
  });

  it("sakat oyuncu 0'a yakın, düzenli başlayan forvet daha yüksek", () => {
    const injured = playerExpectedPoints(
      player({ name: "Zzz", team: "Galatasaray", pos: "FWD", status: "I" }),
      weekDecayWeights(5, 1, 0.5),
      ctx,
    );
    const osimhen = playerExpectedPoints(
      player({ name: "Victor Osimhen", team: "Galatasaray", pos: "FWD" }),
      weekDecayWeights(5, 1, 0.5),
      ctx,
    );
    expect(injured.xp).toBeLessThan(1);
    expect(osimhen.xp).toBeGreaterThan(injured.xp);
    expect(osimhen.minutes.pStart).toBeGreaterThan(0.5);
  });
});
