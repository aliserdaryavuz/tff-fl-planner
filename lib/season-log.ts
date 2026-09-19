import raw from "@/data/team-history.json";
import { fixturesOf, isPlayed } from "@/lib/data";

/**
 * Kullanıcının kendi takımının sezon geçmişi: hafta hafta resmî puan, sıra,
 * transfer sayısı ve o haftanın 15 kişilik kadrosu (döküm dahil).
 *
 * Kaynak oyunun kendi API'si (`scripts/fetch-team-history.mjs`); elle giriş yok.
 *
 * **Resmî puan burada yeniden hesaplanmıyor.** `official.points` oyunun
 * yazdığı sayı; `sumWithCaptain` bizim 11 + kaptan toplamımız. İkisi tutmuyor
 * ve nedeni ölçülemedi: beş oynanmış haftanın üçünde fark, 15 oyuncunun
 * TAMAMININ puanı toplansa bile kapanmıyor (PLAN.md §4.3). Bu yüzden arayüz
 * resmî sayıyı gösterir ve farkı gizlemez.
 */
export type ScoreEvent = {
  /** Oyunun kendi kalem adı: GOAL, CLEAN_SHEET, GOALS_CONCEDED_2, SAVES_3, BONUS, ... */
  type: string;
  count: number;
  per: number;
  pts: number;
};

export type SquadEntry = {
  id: number;
  pos: "GK" | "DEF" | "MID" | "FWD";
  slot: number;
  start: boolean;
  captain: boolean;
  vice: boolean;
  /** Veride gözlenen iki değer: PLAYED, DID_NOT_PLAY. */
  status: string;
  points: number;
  breakdown: ScoreEvent[];
  /**
   * Oyuncu dosyasıyla `gameId` üzerinden eşleşince dolar. **Null olabilir:**
   * ligden ayrılmış bir oyuncu güncel listede olmayabilir; ad uydurulmuyor.
   */
  name?: string;
  team?: string;
};

export type WeekOfficial = {
  points: number;
  cumulative: number;
  bench: number;
  transfers: number;
  weeklyRank: number;
  overallRank: number;
  rankChange: number;
  avgPoints: number;
  highestPoints: number;
  teamValue: number;
};

export type SeasonWeek = {
  gw: number;
  order: number;
  formation: string | null;
  official: WeekOfficial;
  sumStarting: number;
  sumBench: number;
  sumWithCaptain: number;
  gapVsOfficial: number;
  squad: SquadEntry[];
};

export type SeasonTeam = {
  id: number;
  name: string;
  totalPoints: number;
  totalRank: number;
  teamValue: number;
  budget: number;
  remainingBudget: number;
};

export type SeasonMeta = {
  source: string;
  fetched: string;
  weeks: number;
  unmatchedPlayers: number;
  pointsNote: string;
};

export const seasonMeta: SeasonMeta = raw.meta as SeasonMeta;
export const seasonTeam: SeasonTeam = raw.team as SeasonTeam;
export const seasonWeeks: SeasonWeek[] = raw.weeks as SeasonWeek[];

/**
 * Hafta bitti mi? Oynanmakta olan haftada sayılar daha oturmamış olur: 6. hafta
 * aynı gün iki ölçümde farklı fark verdi (−8, sonra −12). Bitmemiş haftanın
 * toplamı kesin sayı gibi sunulmamalı.
 */
export function isComplete(gw: number): boolean {
  const fx = fixturesOf(gw);
  return fx.length > 0 && fx.every(isPlayed);
}

/** Oynanmış haftalar, en yeniden eskiye. */
export const playedWeeks: SeasonWeek[] = [...seasonWeeks].sort((a, b) => b.gw - a.gw);

/** Kadroyu sahadakiler ve yedekler diye ayırır; ikisi de dizilişteki sırada. */
export function splitSquad(week: SeasonWeek): { starting: SquadEntry[]; bench: SquadEntry[] } {
  const order = { GK: 0, DEF: 1, MID: 2, FWD: 3 } as const;
  const bySlot = (a: SquadEntry, b: SquadEntry) => order[a.pos] - order[b.pos] || a.slot - b.slot;
  return {
    starting: week.squad.filter((p) => p.start).sort(bySlot),
    bench: week.squad.filter((p) => !p.start).sort(bySlot),
  };
}

/** Sezon boyunca en çok puanı getiren oyuncular (bu takımda, 11'de oynadığı haftalarda). */
export function topContributors(limit = 5): { id: number; name: string; points: number; weeks: number }[] {
  const acc = new Map<number, { id: number; name: string; points: number; weeks: number }>();
  for (const w of seasonWeeks) {
    for (const p of w.squad) {
      if (!p.start) continue;
      const cur = acc.get(p.id) ?? { id: p.id, name: p.name ?? `#${p.id}`, points: 0, weeks: 0 };
      cur.points += p.points * (p.captain ? 2 : 1);
      cur.weeks += 1;
      acc.set(p.id, cur);
    }
  }
  return [...acc.values()].sort((a, b) => b.points - a.points).slice(0, limit);
}
