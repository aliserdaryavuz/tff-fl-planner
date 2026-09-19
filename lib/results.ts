import raw from "@/data/results.json";
import { fixturesOf, MATCHDAYS } from "@/lib/data";

/**
 * Oynanmış Süper Lig maçlarının içi: goller (kim, kaçıncı dakika, asist),
 * kartlar, kaçan penaltılar, maçın adamı ve iki takımın kadrosu.
 *
 * Kaynak FotMob maç sayfaları — oynama ve üretim verisiyle aynı sayfalar, ek
 * indirme yok (`scripts/fetch-results.mjs`).
 *
 * **Puan tablosu burada yok.** Skorlar oyunun kendi verisinde ve tablo
 * `lib/data.ts` `computeTable()` ile oradan hesaplanıyor; ikinci bir hesap
 * eklemek tabloyu iki ayrı doğruluk kaynağından üretmek olurdu.
 *
 * Tipler dar tutuldu: üretilen dosyada `tsi`, `potm`, kadrolar, dizilişler,
 * olay dakikaları ve oyuncu kimlikleri 46 maçın **hepsinde** dolu (ölçüldü).
 * Tek istisna skor — aşağıda.
 */
export type GoalEvent = {
  kind: "goal";
  min: number;
  /** Olay ev sahibi takıma mı ait? */
  home: boolean;
  player: string;
  playerId: number;
  own: boolean;
  /** FotMob'un tarifi: "penalty", "owngoal", "direct_free_kick"; düz golde null. */
  how: string | null;
  assist: string | null;
  assistId: number | null;
  /** Golden sonraki skor [ev, deplasman]. */
  score: [number, number] | null;
};

export type CardEvent = {
  kind: "card";
  min: number;
  home: boolean;
  player: string;
  playerId: number;
  /** Veride gözlenen üç değer: Yellow, Red, YellowRed (ikinci sarı). */
  card: "Yellow" | "Red" | "YellowRed" | null;
};

export type PenaltyMissEvent = {
  kind: "penaltyMiss";
  min: number;
  home: boolean;
  player: string;
  playerId: number;
};

export type MatchEvent = GoalEvent | CardEvent | PenaltyMissEvent;

export type MatchPlayer = {
  id: number;
  name: string;
  started: boolean;
  minutes: number;
};

export type MatchSide = {
  teamId: number | null;
  formation: string | null;
  starters: MatchPlayer[];
  subs: MatchPlayer[];
};

export type PlayerOfTheMatch = {
  id: number;
  name: string;
  home: boolean;
  rating: number | null;
};

export type MatchResult = {
  md: number;
  date: string;
  tsi: string;
  home: string;
  away: string;
  /**
   * Skor oyunun kendi verisinden. **Null olabilir:** FotMob'un bitmiş saydığı
   * maçı oyunun beslemesi henüz skorlamamış olabiliyor (18.09'da bir maç:
   * Kasımpaşa-Konyaspor, 6. hafta). Olaylar yine de dolu, o yüzden maç
   * gösteriliyor ama skor yerine saati yazılıyor.
   */
  hg: number | null;
  ag: number | null;
  events: MatchEvent[];
  potm: PlayerOfTheMatch | null;
  lineups: { home: MatchSide | null; away: MatchSide | null } | null;
};

export type ResultsMeta = {
  source: string;
  fetched: string;
  matches: number;
  /** Oyunun bitmiş saydığı maç sayısı; farkı görünür kalsın. */
  playedFixtures: number;
  unlinked: number;
};

export const resultsMeta: ResultsMeta = raw.meta as ResultsMeta;
export const results: MatchResult[] = raw.matches as MatchResult[];

/** `ev|deplasman` benzersiz: 306 fikstürde 306 sıralı çift (ölçüldü). */
const byPair = new Map(results.map((r) => [`${r.home}|${r.away}`, r]));

export function resultOf(home: string, away: string): MatchResult | undefined {
  return byPair.get(`${home}|${away}`);
}

export type MatchdayFixtures = {
  md: number;
  matches: {
    date: string;
    tsi: string | null;
    home: string;
    away: string;
    result?: MatchResult;
  }[];
  /** Haftanın kaç maçının içi elimizde. */
  played: number;
};

/** 34 haftanın tamamı; oynanmışlara maç içi iliştirilmiş. */
export const seasonFixtures: MatchdayFixtures[] = Array.from({ length: MATCHDAYS }, (_, i) => {
  const md = i + 1;
  const matches = fixturesOf(md).map((f) => ({
    date: f.date,
    tsi: f.tsi,
    home: f.home,
    away: f.away,
    result: resultOf(f.home, f.away),
  }));
  return { md, matches, played: matches.filter((m) => m.result).length };
});

/** Bir maçın gol olayları, dakikaya göre. */
export function goalsOf(match: MatchResult): GoalEvent[] {
  return match.events.filter((e): e is GoalEvent => e.kind === "goal").sort((a, b) => a.min - b.min);
}

/** Kart ve kaçan penaltılar, dakikaya göre. */
export function disciplineOf(match: MatchResult): (CardEvent | PenaltyMissEvent)[] {
  return match.events
    .filter((e): e is CardEvent | PenaltyMissEvent => e.kind !== "goal")
    .sort((a, b) => a.min - b.min);
}
