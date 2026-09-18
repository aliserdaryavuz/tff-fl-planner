import { type HomeAway, leagueAvgGoals, schedule } from "@/lib/data";
import type { Player, Position } from "@/lib/fantasy";
import {
  availability,
  type LineupInfo,
  lineupOf,
  predictedFor,
  type RecentSummary,
  startProbability,
  summarizeRecent,
} from "@/lib/lineups";
import { MINUTES } from "@/lib/minutes";
import { withHomeAway } from "@/lib/models";
import { SCORING } from "@/lib/scoring.mjs";

/**
 * Beklenen fantasy puanı (xP): TFF puan tablosunun her kalemi için beklenen
 * değer. Girdiler:
 *  - takım güçleri (0-100, seçili karışım) -> iki takımın beklenen golü
 *    (Poisson ortalaması), oradan gol yememe olasılığı ve yenilen gol sayısı,
 *  - oyuncunun son maçlardaki oranları (gol/90, asist/90, kart/90, bonus/90),
 *    az veride mevki önceliğine (prior) doğru çekilerek,
 *  - başlama olasılığı ve beklenen dakika (lib/lineups.ts).
 * Kesin bir tahmin değil, aynı ölçekte karşılaştırılabilir bir beklenti.
 */

/** Mevki başına 90 dakikalık öncelik oranları (Süper Lig düzeyi, kaba). */
export const PRIORS: Record<
  Position,
  { g90: number; a90: number; y90: number; r90: number; bonus90: number; saves90: number }
> = {
  GK: { g90: 0, a90: 0.005, y90: 0.08, r90: 0.005, bonus90: 0.35, saves90: 3.0 },
  DEF: { g90: 0.05, a90: 0.06, y90: 0.22, r90: 0.012, bonus90: 0.3, saves90: 0 },
  MID: { g90: 0.13, a90: 0.14, y90: 0.2, r90: 0.01, bonus90: 0.35, saves90: 0 },
  FWD: { g90: 0.35, a90: 0.14, y90: 0.16, r90: 0.008, bonus90: 0.45, saves90: 0 },
};

/** Öncelik bu kadar maç değerinde sayılır: 4 maç = 360 dk. */
export const PRIOR_MATCHES = 4;

// Oyuncunun kendi geçmişi yoksa lig ortalaması kullanılıyor. Bu dört sayı
// eskiden burada sabitti (84 / 15 / 0,85 / 0,30) ve ölçümden sapmıştı; artık
// `lib/minutes.ts` veri dosyasından sayıyor.

/** Güç farkının gol beklentisine etkisi: e^(k·100/100) ≈ 2,2 kat (0 ile 100 arası). */
export const GOAL_K = 0.8;

export type Rates = {
  g90: number;
  a90: number;
  y90: number;
  r90: number;
  bonus90: number;
  saves90: number;
  /** Oyuncunun gözlenen dakikası (güven göstergesi). */
  minutes: number;
};

/**
 * Gözlenen oranları mevki önceliğine doğru çeker (Bayes tarzı basit ağırlık).
 * Sayımlar öncelikle oyunun resmî sezon toplamlarından (`player`), yoksa son
 * maç verisinden (`s`) gelir: resmî veri tüm sezonu kapsar ve olay ayrıştırma
 * hatası taşımaz.
 */
export function shrunkRates(pos: Position, s: RecentSummary, player?: Player): Rates {
  const prior = PRIORS[pos];
  const priorMin = PRIOR_MATCHES * 90;
  // Resmî dakika varsa o esas; yoksa son maçlardaki dakika.
  const official = player && player.mins > 0;
  const n = official ? (player as Player).mins : s.minutes;
  const count = (key: "goals" | "assists" | "yellow" | "red" | "bonus" | "saves") =>
    official ? ((player as Player)[key] ?? 0) : (s[key as keyof RecentSummary] as number) ?? 0;
  const rate = (c: number, p90: number) => (c + (p90 * priorMin) / 90) / ((n + priorMin) / 90);
  return {
    g90: rate(count("goals"), prior.g90),
    a90: rate(count("assists"), prior.a90),
    y90: rate(count("yellow"), prior.y90),
    r90: rate(count("red"), prior.r90),
    bonus90: rate(count("bonus"), prior.bonus90),
    // Kurtarış yalnız resmî veride var; yoksa mevki önceliği.
    saves90: pos === "GK" && official && (player as Player).saves != null
      ? rate((player as Player).saves as number, prior.saves90)
      : prior.saves90,
    minutes: n,
  };
}

/** İki takımın beklenen golü: lig ortalaması × e^(k·güç farkı/100), ev avantajı güç ölçeğinde. */
export function expectedGoals(
  myStrength: number,
  oppStrength: number,
  ha: HomeAway,
  homeAdvantage: number,
  mu: number = leagueAvgGoals(),
): { forUs: number; against: number } {
  // Deplasmandaysak rakip +HA (withHomeAway), evdeysek -HA.
  const d = myStrength - withHomeAway(oppStrength, ha, homeAdvantage);
  return {
    forUs: mu * Math.exp((GOAL_K * d) / 100),
    against: mu * Math.exp((-GOAL_K * d) / 100),
  };
}

const poissonCache = new Map<number, number[]>();

/** Poisson(λ) için P(0..12). */
export function poisson(lambda: number): number[] {
  const key = Math.round(lambda * 1000);
  const hit = poissonCache.get(key);
  if (hit) return hit;
  const out: number[] = [];
  let p = Math.exp(-lambda);
  for (let k = 0; k <= 12; k++) {
    out.push(p);
    p = (p * lambda) / (k + 1);
  }
  poissonCache.set(key, out);
  return out;
}

/** E[floor(G / per)] for G ~ Poisson(λ). */
export function expectedConcededSteps(lambda: number, per: number): number {
  const probs = poisson(lambda);
  return probs.reduce((sum, p, g) => sum + p * Math.floor(g / per), 0);
}

export type MinutesModel = {
  pStart: number;
  /** Oynama olasılığı (başlama + yedekten girme). */
  pPlay: number;
  /** 60 dakikadan fazla oynama olasılığı. */
  p60: number;
  expectedMinutes: number;
};

export function minutesModel(
  player: Player,
  info: LineupInfo | undefined = lineupOf(player),
  summary: RecentSummary = summarizeRecent(player, info),
  /** Planlanan hafta; tahmini 11 yalnız kendi haftasına uygulanır. */
  md?: number | null,
): MinutesModel {
  const predicted = predictedFor(player, md);
  const pStart = startProbability(player, info, predicted);
  const benchMatches = summary.matches - summary.starts;
  const subRate = benchMatches > 0 ? summary.subIns / benchMatches : MINUTES.subAppears;
  // Yedekten girme yolu ancak oyuncu kadrodaysa açık: sakat/cezalı 0 alır.
  const pAvailable = availability(player, info, predicted);
  const pPlay = pStart + Math.max(0, pAvailable - pStart) * subRate;
  const minStarted = summary.minutesWhenStarted ?? MINUTES.starterMinutes;
  const minSub = summary.minutesWhenSub ?? MINUTES.subMinutes;
  const over60 = summary.over60WhenStarted ?? MINUTES.p60IfStart;
  return {
    pStart,
    pPlay,
    p60: pStart * over60,
    expectedMinutes: pStart * minStarted + Math.max(0, pAvailable - pStart) * subRate * minSub,
  };
}

export type XpBreakdown = {
  appearance: number;
  goals: number;
  assists: number;
  cleanSheet: number;
  conceded: number;
  saves: number;
  cards: number;
  bonus: number;
  total: number;
  /** Takımın beklenen golü ve yiyeceği gol. */
  lambdaFor: number;
  lambdaAgainst: number;
  pCleanSheet: number;
};

export type XpContext = {
  strength: Record<string, number>;
  homeAdvantage: number;
  /** Lig ortalaması gol (takım başına); verilmezse veriden. */
  mu?: number;
};

/** Tek maç için beklenen puan (kaptan hariç). */
export function expectedPointsForFixture(
  player: Player,
  fixture: { opp: string; ha: HomeAway },
  ctx: XpContext,
  minutes: MinutesModel,
  rates: Rates,
): XpBreakdown {
  const mu = ctx.mu ?? leagueAvgGoals();
  const { forUs, against } = expectedGoals(
    ctx.strength[player.team] ?? 50,
    ctx.strength[fixture.opp] ?? 50,
    fixture.ha,
    ctx.homeAdvantage,
    mu,
  );
  const share = minutes.expectedMinutes / 90;
  const attack = forUs / mu;
  const pos = player.pos;

  const appearance =
    minutes.pPlay * SCORING.appearance.upTo60 +
    minutes.p60 * (SCORING.appearance.over60 - SCORING.appearance.upTo60);
  const goals = rates.g90 * share * attack * SCORING.goal[pos];
  const assists = rates.a90 * share * attack * SCORING.assist;
  const pCleanSheet = Math.exp(-against);
  const cleanSheet = minutes.p60 * pCleanSheet * SCORING.cleanSheet[pos];
  const conceded =
    pos === "GK" || pos === "DEF"
      ? share * expectedConcededSteps(against, SCORING.concededPer) * SCORING.concededPenalty
      : 0;
  const saves =
    pos === "GK"
      ? (rates.saves90 * share * (against / mu)) / SCORING.savesPerPoint
      : 0;
  const cards = share * (rates.y90 * SCORING.yellow + rates.r90 * SCORING.red);
  const bonus = rates.bonus90 * share * Math.sqrt(attack);

  const total = appearance + goals + assists + cleanSheet + conceded + saves + cards + bonus;
  return {
    appearance,
    goals,
    assists,
    cleanSheet,
    conceded,
    saves,
    cards,
    bonus,
    total,
    lambdaFor: forUs,
    lambdaAgainst: against,
    pCleanSheet,
  };
}

export type WeekXp = {
  md: number;
  weight: number;
  fixture: { opp: string; ha: HomeAway } | null;
  xp: XpBreakdown | null;
  /** Aynı maç, oyuncunun 90 dakika oynadığı varsayımıyla. */
  xpPerStart: XpBreakdown | null;
};

export type PlayerXp = {
  /** Haftaların ağırlıklı ortalaması: "hafta başına beklenen puan". */
  xp: number;
  /**
   * Aynı hesap ama oyuncu kesin oynuyor sayılarak. Sıralamada model sinyali
   * budur: "oynarsa ne kadar iyi". Oynama olasılığı skora tek bir yerde,
   * süre çarpanı olarak girer (bkz. lib/picks.ts); yoksa dakika iki kez
   * sayılırdı.
   */
  xpPerStart: number;
  weeks: WeekXp[];
  minutes: MinutesModel;
  rates: Rates;
  summary: RecentSummary;
};

/** Kesin oynayan oyuncu: 90 dakika, 60+ dakika garanti. */
export const FULL_MINUTES: MinutesModel = {
  pStart: 1,
  pPlay: 1,
  p60: 1,
  expectedMinutes: 90,
};

/**
 * Seçili haftalar için beklenen puan. `weekWeights` 34 elemanlı; 0 olan hafta
 * hesaba girmez. Maçı olmayan haftada 0 puan (ağırlık yine sayılır: bye haftası
 * gerçek bir kayıptır).
 */
export function playerExpectedPoints(
  player: Player,
  weekWeights: number[],
  ctx: XpContext,
): PlayerXp {
  const info = lineupOf(player);
  const summary = summarizeRecent(player, info);
  // Tahmini 11 yalnız planlanan (ilk seçili) haftaya ait; ufuk açıkken sonraki
  // haftalar için aynı olasılık kullanılır, başka haftanın tahmini uygulanmaz.
  const planned = weekWeights.findIndex((w) => w > 0) + 1 || null;
  const minutes = minutesModel(player, info, summary, planned);
  const rates = shrunkRates(player.pos, summary, player);
  const weeks: WeekXp[] = [];
  let sum = 0;
  let sumPerStart = 0;
  let wsum = 0;
  weekWeights.forEach((weight, i) => {
    if (weight <= 0) return;
    const md = i + 1;
    const f = schedule[player.team]?.[i];
    const fixture = f && f.md === md ? { opp: f.opp, ha: f.ha } : null;
    const xp = fixture
      ? expectedPointsForFixture(player, fixture, ctx, minutes, rates)
      : null;
    const xpPerStart = fixture
      ? expectedPointsForFixture(player, fixture, ctx, FULL_MINUTES, rates)
      : null;
    weeks.push({ md, weight, fixture, xp, xpPerStart });
    sum += weight * (xp?.total ?? 0);
    sumPerStart += weight * (xpPerStart?.total ?? 0);
    wsum += weight;
  });
  return {
    xp: wsum > 0 ? sum / wsum : 0,
    xpPerStart: wsum > 0 ? sumPerStart / wsum : 0,
    weeks,
    minutes,
    rates,
    summary,
  };
}
