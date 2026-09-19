import { describe, expect, it } from "vitest";
import type { Player, Position } from "@/lib/fantasy";
import { improveSquad } from "@/lib/improve";
import type { PickRow } from "@/lib/picks";
import { MAX_PER_CLUB, SQUAD_SIZE } from "@/lib/squad";

/**
 * Takas önerisinin kısıtları. Bunlar arayüzde gözle görülmüyor: öneri listesi
 * makul dururken kulüp sınırını çiğnemiş ya da bütçeyi aşmış olabilir ve
 * kullanıcı ancak oyuna girip transferi yapmaya çalışınca fark ederdi.
 */

const row = (
  name: string,
  team: string,
  pos: Position,
  price: number,
  xp: number,
): PickRow => {
  const player: Player = {
    name,
    team,
    pos,
    price,
    sel: 0,
    status: null,
    pts: 0,
    mins: 0,
  };
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

/** 2-5-5-3, hepsi ucuz ve düşük puanlı: her mevkide yükseltme yeri var. */
function baseSquad(): PickRow[] {
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
      out.push(row(`own-${pos}-${k}`, `club-${i % 5}`, pos, 4, 1));
      i++;
    }
  }
  return out;
}

describe("improveSquad", () => {
  it("kadroyu 15 oyuncuda ve mevki dağılımında tutar", () => {
    const own = baseSquad();
    const pool = [...own, row("star", "club-9", "MID", 5, 20)];
    const plan = improveSquad(
      own.map((r) => r.player),
      pool,
      { bank: 10 },
    );

    expect(plan.squad).toHaveLength(SQUAD_SIZE);
    const keys = new Set(plan.squad.map((p) => `${p.team}|${p.name}`));
    expect(keys.size).toBe(SQUAD_SIZE);
    const counts = plan.squad.reduce<Record<string, number>>((acc, p) => {
      acc[p.pos] = (acc[p.pos] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ GK: 2, DEF: 5, MID: 5, FWD: 3 });
  });

  it("açıkça daha iyi oyuncuyu alır ve kazancı pozitif yazar", () => {
    const own = baseSquad();
    const pool = [...own, row("star", "club-9", "MID", 5, 20)];
    const plan = improveSquad(
      own.map((r) => r.player),
      pool,
      { bank: 10 },
    );

    expect(plan.swaps.length).toBeGreaterThan(0);
    expect(plan.swaps[0].in.name).toBe("star");
    expect(plan.swaps[0].gain).toBeGreaterThan(0);
    expect(plan.final.value).toBeGreaterThan(plan.current.value);
  });

  it("kulüp başına üç oyuncu sınırını çiğnemez", () => {
    // Kadroda "club-0"dan zaten üç oyuncu var; aynı kulüpten çok daha iyi bir
    // aday gelse bile alınmamalı.
    const own: PickRow[] = [
      row("gk1", "club-0", "GK", 4, 1),
      row("gk2", "club-1", "GK", 4, 1),
      row("d1", "club-0", "DEF", 4, 1),
      row("d2", "club-0", "DEF", 4, 1),
      row("d3", "club-1", "DEF", 4, 1),
      row("d4", "club-2", "DEF", 4, 1),
      row("d5", "club-3", "DEF", 4, 1),
      row("m1", "club-1", "MID", 4, 1),
      row("m2", "club-2", "MID", 4, 1),
      row("m3", "club-3", "MID", 4, 1),
      row("m4", "club-4", "MID", 4, 1),
      row("m5", "club-5", "MID", 4, 1),
      row("f1", "club-2", "FWD", 4, 1),
      row("f2", "club-3", "FWD", 4, 1),
      row("f3", "club-4", "FWD", 4, 1),
    ];
    // club-0'da gk1, d1, d2 var (üç). Aday da club-0'dan ve çok daha iyi.
    const pool = [...own, row("blocked", "club-0", "MID", 4, 30)];
    const plan = improveSquad(
      own.map((r) => r.player),
      pool,
      { bank: 50 },
    );

    expect(plan.squad.map((p) => p.name)).not.toContain("blocked");
    for (const club of new Set(plan.squad.map((p) => p.team))) {
      expect(plan.squad.filter((p) => p.team === club).length).toBeLessThanOrEqual(MAX_PER_CLUB);
    }
  });

  it("parası yetmeyen oyuncuyu önermez", () => {
    const own = baseSquad();
    // Çıkan oyuncu 4 M, kasada 1 M: en fazla 5 M'lik oyuncu alınabilir.
    const pool = [...own, row("pricey", "club-9", "MID", 12, 30)];
    const plan = improveSquad(
      own.map((r) => r.player),
      pool,
      { bank: 1 },
    );

    expect(plan.squad.map((p) => p.name)).not.toContain("pricey");
    expect(plan.bank).toBeGreaterThanOrEqual(0);
  });

  it("daha iyisi yoksa takas önermez", () => {
    const own = baseSquad();
    // Havuzda kadronun kendisinden başka kimse yok.
    const plan = improveSquad(
      own.map((r) => r.player),
      own,
      { bank: 100 },
    );

    expect(plan.swaps).toHaveLength(0);
    expect(plan.final.value).toBeCloseTo(plan.current.value, 10);
  });

  it("her takas bütçeyi eksiye düşürmez", () => {
    const own = baseSquad();
    const pool = [
      ...own,
      row("a", "club-6", "MID", 9, 20),
      row("b", "club-7", "DEF", 9, 18),
      row("c", "club-8", "FWD", 9, 16),
    ];
    const plan = improveSquad(
      own.map((r) => r.player),
      pool,
      { bank: 6 },
    );

    for (const s of plan.swaps) expect(s.bankAfter).toBeGreaterThanOrEqual(0);
    expect(plan.bank).toBeGreaterThanOrEqual(0);
  });
});
