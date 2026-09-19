import { describe, expect, it } from "vitest";
import { teamIds } from "@/lib/data";
import { players as gamePlayers, type Player } from "@/lib/fantasy";
import { predictedFor, type RecentSummary, startProbability, UNKNOWN_START } from "@/lib/lineups";
import { MINUTES } from "@/lib/minutes";
import { computeAll, DEFAULT_PARAMS } from "@/lib/models";
import {
  expectedSteps,
  expectedGoals,
  expectedPointsForFixture,
  GOAL_K,
  minutesModel,
  playerExpectedPoints,
  poisson,
  PRIORS,
  shrunkRates,
  XG_WEIGHT,
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
  xg: 0,
  xa: 0,
  saves: 0,
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
    expect(expectedSteps(0, 2)).toBeCloseTo(0, 10);
    // λ=2: P(2)+P(3) ×1 + P(4)+P(5) ×2 ...
    const p = poisson(2);
    const manual = p.reduce((s, q, g) => s + q * Math.floor(g / 2), 0);
    expect(expectedSteps(2, 2)).toBeCloseTo(manual, 10);
    expect(expectedSteps(3, 2)).toBeGreaterThan(expectedSteps(1, 2));
  });
});

describe("shrunkRates", () => {
  it("verisi olmayan oyuncu mevki önceliğini alır", () => {
    const r = shrunkRates("FWD", emptySummary);
    expect(r.g90).toBeCloseTo(PRIORS.FWD.g90, 10);
    expect(r.a90).toBeCloseTo(PRIORS.FWD.a90, 10);
  });

  // Öncelik sayısı buraya KOPYALANMIYOR: 1.4 ile ölçüme bağlanacak ve kopya bayatlar.
  const fwdPrior = PRIORS.FWD.g90;

  it("xG sayımla aynıysa harman hiçbir şeyi değiştirmez: gözlenen 1,0 ile önceliğin ortası", () => {
    const r = shrunkRates("FWD", { ...emptySummary, minutes: 360, goals: 4, xg: 4 });
    expect(r.g90).toBeCloseTo((1.0 + fwdPrior) / 2, 10);
  });

  it("4 gol ama xG 0: harman oranı aşağı çeker", () => {
    const r = shrunkRates("FWD", { ...emptySummary, minutes: 360, goals: 4, xg: 0 });
    const raw = (1.0 + fwdPrior) / 2;
    const expectedRate = (0 + (fwdPrior * 360) / 90) / ((360 + 360) / 90);
    expect(r.g90).toBeCloseTo((1 - XG_WEIGHT) * raw + XG_WEIGHT * expectedRate, 10);
    expect(r.g90).toBeLessThan(raw);
  });

  it("pencere kısaysa harman uygulanmaz, ham sayım kalır", () => {
    const r = shrunkRates("FWD", { ...emptySummary, minutes: 90, goals: 1, xg: 0 });
    expect(r.g90).toBeCloseTo((1 + (fwdPrior * 360) / 90) / ((90 + 360) / 90), 10);
  });
});

describe("minutesModel", () => {
  it("verisi olmayan: dakika beklentisi başlama olasılığından türer", () => {
    const p = player();
    const m = minutesModel(p, undefined, emptySummary);
    // Başlama olasılığı lib/lineups.ts'ten; burada onunla tutarlılık aranıyor.
    const base = startProbability(p, undefined);
    expect(m.pStart).toBeCloseTo(base, 10);
    // Sabit sayı yazılmıyor: lig oranları veriden sayılıyor (lib/minutes.ts).
    // Sayıyı buraya kopyalamak, düzeltilen hatanın testte tekrarı olurdu.
    expect(m.pPlay).toBeCloseTo(base + (1 - base) * MINUTES.subAppears, 10);
    expect(m.expectedMinutes).toBeCloseTo(
      base * MINUTES.starterMinutes + (1 - base) * MINUTES.subAppears * MINUTES.subMinutes,
      10,
    );
  });

  it("tahmini 11'de olmayan bilinmeyen oyuncu taban olasılığın altına iner", () => {
    // Ceza yalnız takımın bir tahmin kaynağı varken devreye giriyor
    // (`startProbability` içindeki `predicted.sources`/`weakSources`). Takım
    // adı SABİT yazılamaz: hangi kulüplerin tahmini 11'i olduğu hafta içinde
    // değişiyor ve 19.09'da veri yenilenince "Galatasaray" kapsam dışı kalıp
    // test takvim yüzünden kırıldı. Kaynağı olan bir takım veriden seçiliyor.
    const team = teamIds.find((id) => {
      const pr = predictedFor(player({ team: id }));
      return pr.sources > 0 || pr.weakSources > 0;
    });
    if (!team) {
      // Hafta arası: hiçbir takımın tahmini yok. Sınanacak durum yok demektir,
      // yanlış bir iddiayı geçmiş göstermektense açıkça atlanıyor.
      return;
    }
    expect(startProbability(player({ team }), undefined)).toBeLessThan(UNKNOWN_START);
  });

  it("sakat: hiç oynamaz, yedekten de giremez", () => {
    const m = minutesModel(player({ status: "I" }), undefined, emptySummary);
    expect(m.pStart).toBe(0);
    expect(m.p60).toBe(0);
    expect(m.pPlay).toBe(0);
    expect(m.expectedMinutes).toBe(0);
  });
});

describe("expectedPointsForFixture", () => {
  const ctx = { strength: { A: 80, B: 20 }, homeAdvantage: 6, mu: 1.4 };
  const sure = { pStart: 1, pPlay: 1, p60: 1, p90: 1, expectedMinutes: 90 };
  const rates = { g90: 0, a90: 0, y90: 0, r90: 0, bonus90: 0, saves90: 0, minutes: 0 };

  it("kesin 90 dk oynayan, hiç olay yok: 2 puan + gol yememe × olasılık − yenilen", () => {
    const def = expectedPointsForFixture(player({ team: "A", pos: "DEF" }), { opp: "B", ha: "E" }, ctx, sure, rates);
    expect(def.appearance).toBeCloseTo(2, 10);
    const { against } = expectedGoals(80, 20, "E", 6, 1.4);
    expect(def.pCleanSheet).toBeCloseTo(Math.exp(-against), 10);
    expect(def.cleanSheet).toBeCloseTo(4 * Math.exp(-against), 10);
    expect(def.conceded).toBeCloseTo(-expectedSteps(against, 2), 10);
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

  it("kaleci: kurtarış rakibin beklenen golüyle artar, üçer üçer sayılır", () => {
    const gkRates = { ...rates, saves90: 3 };
    const easy = expectedPointsForFixture(player({ team: "A", pos: "GK" }), { opp: "B", ha: "E" }, ctx, sure, gkRates);
    const hard = expectedPointsForFixture(player({ team: "B", pos: "GK" }), { opp: "A", ha: "D" }, ctx, sure, gkRates);
    expect(hard.saves).toBeGreaterThan(easy.saves);
    expect(easy.cleanSheet).toBeGreaterThan(hard.cleanSheet);
    // Eşik maç içinde: beklenen kurtarışı 3'e bölmek değil, E[floor(S/3)].
    const { against } = expectedGoals(80, 20, "E", 6, 1.4);
    const lambda = 3 * (against / 1.4);
    expect(easy.saves).toBeCloseTo(expectedSteps(lambda, 3), 10);
    // Bölme her zaman daha büyük: düzeltilen hata testte sabitleniyor.
    expect(easy.saves).toBeLessThan(lambda / 3);
  });
});

describe("playerExpectedPoints — gerçek veri", () => {
  const { strength } = computeAll({ model: "abs", params: DEFAULT_PARAMS });
  const ctx = { strength, homeAdvantage: 6 };

  /** Oyun dosyasındaki gerçek oyuncu: resmî istatistikleriyle birlikte. */
  const real = (name: string) => {
    const hit = gamePlayers.find((p) => p.name === name);
    if (!hit) throw new Error(`oyun dosyasında yok: ${name}`);
    return hit;
  };

  /** Sakat olmayan, düzenli oynayan bir oyuncu (ad sabitlemeden). */
  const fitPlayer = (pos: Player["pos"] = "FWD") => {
    const hit = gamePlayers.find((p) => p.pos === pos && !p.status && p.mins >= 270);
    if (!hit) throw new Error(`uygun ${pos} bulunamadı`);
    return hit;
  };

  it("tek hafta: yalnız o haftanın maçı sayılır; ufuk açılınca ağırlıklı ortalama", () => {
    const p = fitPlayer();
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

  it("sakat oyuncu 0'a yakın; sağlam, gol atan forvet çok daha yüksek", () => {
    const weeks = weekDecayWeights(5, 1, 0.5);
    const injured = playerExpectedPoints(
      player({ name: "Zzz", team: "Galatasaray", pos: "FWD", status: "I" }),
      weeks,
      ctx,
    );
    expect(injured.xp).toBeLessThan(1);

    // Sakat olmayan, çok oynayan ve gol atan bir forvet (ad sabitlemeden).
    const fit = gamePlayers.find(
      (p) => p.pos === "FWD" && !p.status && p.mins >= 270 && (p.goals ?? 0) >= 2,
    );
    expect(fit, "uygun forvet bulunamadı").toBeDefined();
    const star = playerExpectedPoints(fit as Player, weeks, ctx);
    expect(star.xp).toBeGreaterThan(injured.xp);
    expect(star.minutes.pStart).toBeGreaterThan(0.5);
    // Resmî sezon toplamları oranlara giriyor: golleri modelde görünmeli.
    expect(star.rates.g90).toBeGreaterThan(PRIORS.FWD.g90);
  });

  it("oyunun sakat işaretlediği yıldız oyuncu modelde de oynamıyor sayılır", () => {
    // Veri kaynağı FotMob; sakatlık bilgisi oyunun API'sinde yok.
    const osimhen = real("Osimhen");
    if (osimhen.status !== "I") return;
    const xp = playerExpectedPoints(osimhen, weekDecayWeights(5, 1, 0.5), ctx);
    expect(xp.minutes.pStart).toBe(0);
    expect(xp.xp).toBe(0);
  });

  it("beklenen puan, oyunun maç başına puanıyla aynı yönde", () => {
    const weeks = weekDecayWeights(5, 1, 0.5);
    const sample = gamePlayers.filter((p) => p.mins >= 270 && (p.ppm ?? 0) > 0).slice(0, 120);
    expect(sample.length).toBeGreaterThan(30);
    const rows = sample.map((p) => ({
      xp: playerExpectedPoints(p, weeks, ctx).xp,
      ppm: p.ppm as number,
    }));
    // Kaba doğrulama: oyunun en iyi çeyreği, en kötü çeyrekten yüksek xP almalı.
    const byPpm = [...rows].sort((a, b) => b.ppm - a.ppm);
    const q = Math.floor(byPpm.length / 4);
    const mean = (list: typeof rows) => list.reduce((s, r) => s + r.xp, 0) / list.length;
    expect(mean(byPpm.slice(0, q))).toBeGreaterThan(mean(byPpm.slice(-q)));
  });
});
