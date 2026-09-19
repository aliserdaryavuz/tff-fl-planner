import { describe, expect, it } from "vitest";
import { CARDS, cardGains } from "@/lib/cards";
import type { Player, Position } from "@/lib/fantasy";
import { bestLineup } from "@/lib/formations";
import type { PickRow } from "@/lib/picks";
import { playerKey } from "@/lib/player-key";

/**
 * Kart kazançlarının ilişkileri. Arayüzde yalnız birer sayı görünüyor; o
 * sayıların birbiriyle tutarlı olup olmadığı ancak burada görülür.
 */

const row = (name: string, team: string, pos: Position, price: number, xp: number): PickRow => {
  const player: Player = { name, team, pos, price, sel: 0, status: null, pts: 0, mins: 0 };
  return {
    player,
    avgDifficulty: 3,
    xp,
    xpPerStart: xp,
    modelScore: 0,
    selScore: 0,
    pointsScore: 0,
  } as PickRow;
};

/** 2-5-5-3; puanlar ayrık, böylece kaptan tek ve belirli. */
function squadRows(): PickRow[] {
  const shape: [Position, number][] = [
    ["GK", 2],
    ["DEF", 5],
    ["MID", 5],
    ["FWD", 3],
  ];
  const out: PickRow[] = [];
  let i = 0;
  for (const [pos, n] of shape) {
    for (let k = 0; k < n; k++) {
      out.push(row(`own-${pos}-${k}`, `club-${i % 5}`, pos, 4, 1 + i * 0.5));
      i++;
    }
  }
  return out;
}

const BENCH_WEIGHT = 0.1;

describe("cardGains", () => {
  it("Tripleks kaptanı bir kez daha sayar, Dört Dörtlük iki kez", () => {
    const own = squadRows();
    const squad = own.map((r) => r.player);
    // Takas yok: havuz kadronun kendisi, böylece kartın etkisi yalıtılıyor.
    const gains = cardGains(squad, own, { bank: 0, benchWeight: BENCH_WEIGHT });

    const xpOf = new Map(own.map((r) => [playerKey(r.player), r.xp]));
    const line = bestLineup(squad, (p) => xpOf.get(playerKey(p)) ?? 0, BENCH_WEIGHT);
    const captainXp = line.captain ? (xpOf.get(playerKey(line.captain)) ?? 0) : 0;

    const triple = gains.find((g) => g.key === "triple")!;
    const quad = gains.find((g) => g.key === "quad")!;

    expect(captainXp).toBeGreaterThan(0);
    expect(triple.gain).toBeCloseTo(captainXp, 6);
    expect(quad.gain).toBeCloseTo(2 * captainXp, 6);
  });

  it("Tüm Takım Sahaya, yedeklerin sayılmayan kısmını kazandırır", () => {
    const own = squadRows();
    const squad = own.map((r) => r.player);
    const gains = cardGains(squad, own, { bank: 0, benchWeight: BENCH_WEIGHT });

    const xpOf = new Map(own.map((r) => [playerKey(r.player), r.xp]));
    const line = bestLineup(squad, (p) => xpOf.get(playerKey(p)) ?? 0, BENCH_WEIGHT);

    const allPlay = gains.find((g) => g.key === "allPlay")!;
    expect(allPlay.gain).toBeCloseTo((1 - BENCH_WEIGHT) * line.benchScore, 6);
  });

  it("Limitsiz Bütçe, parayla alınamayan oyuncu varken kazandırır", () => {
    const own = squadRows();
    const squad = own.map((r) => r.player);
    // Kasada para yok ve aday çok pahalı: yalnız bütçe kalkarsa alınabilir.
    const pool = [...own, row("pahali", "club-9", "MID", 40, 25)];
    const gains = cardGains(squad, pool, { bank: 0, benchWeight: BENCH_WEIGHT });

    const unlimited = gains.find((g) => g.key === "unlimited")!;
    expect(unlimited.gain).toBeGreaterThan(0);
    expect(unlimited.swaps).toBeGreaterThan(0);
  });

  it("hiçbir kazanç negatif değil ve liste büyükten küçüğe sıralı", () => {
    const own = squadRows();
    const gains = cardGains(
      own.map((r) => r.player),
      own,
      { bank: 0, benchWeight: BENCH_WEIGHT },
    );

    expect(gains).toHaveLength(CARDS.length);
    for (const g of gains) expect(g.gain).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < gains.length; i++) {
      expect(gains[i - 1].gain).toBeGreaterThanOrEqual(gains[i].gain);
    }
  });
});
