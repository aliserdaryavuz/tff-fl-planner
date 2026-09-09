// lib/scoring.mjs için tipler (dosya düz JS: betikler de okuyor).
export type Position = "GK" | "DEF" | "MID" | "FWD";

export type MatchStats = {
  minutes: number;
  goals?: number;
  assists?: number;
  /** Takımın maçta yediği gol. */
  conceded?: number;
  saves?: number;
  penSaved?: number;
  penMissed?: number;
  yellow?: number;
  red?: number;
  ownGoals?: number;
};

export const SCORING: {
  appearance: { upTo60: number; over60: number };
  goal: Record<Position, number>;
  assist: number;
  cleanSheet: Record<Position, number>;
  cleanSheetMinutes: number;
  savesPerPoint: number;
  penaltySave: number;
  penaltyMiss: number;
  concededPer: number;
  concededPenalty: number;
  yellow: number;
  red: number;
  ownGoal: number;
  bonus: number[];
  captain: number;
};

export function matchPoints(pos: Position, s: MatchStats): number;
export function bonusPoints(points: number[]): number[];
