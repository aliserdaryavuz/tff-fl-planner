import { describe, expect, it } from "vitest";
import type { Player, Position } from "@/lib/fantasy";
import { playerKey } from "@/lib/fantasy";
import { bestLineup, FORMATIONS, isValidFormation } from "@/lib/formations";

const p = (name: string, pos: Position, team = "T"): Player => ({
  name,
  team,
  pos,
  price: 5,
  sel: null,
  status: null,
  pts: 0,
  mins: 0,
});

/** 2-5-5-3 kadro; puan haritasıyla. */
function squad(): { players: Player[]; score: Map<string, number> } {
  const players: Player[] = [];
  const score = new Map<string, number>();
  const add = (name: string, pos: Position, s: number, team = name) => {
    const pl = p(name, pos, team);
    players.push(pl);
    score.set(playerKey(pl), s);
  };
  add("GK1", "GK", 4);
  add("GK2", "GK", 2);
  ["D1", "D2", "D3", "D4", "D5"].forEach((n, i) => add(n, "DEF", 5 - i));
  ["M1", "M2", "M3", "M4", "M5"].forEach((n, i) => add(n, "MID", 6 - i));
  ["F1", "F2", "F3"].forEach((n, i) => add(n, "FWD", 7 - i));
  return { players, score };
}

describe("formations", () => {
  it("sekiz geçerli diziliş; hepsi 11 kişi, 3-5 defans, 2-5 orta saha, 1-3 forvet", () => {
    expect(FORMATIONS).toHaveLength(8);
    for (const [d, m, f] of FORMATIONS) {
      expect(d + m + f).toBe(10);
      expect(d).toBeGreaterThanOrEqual(3);
      expect(f).toBeGreaterThanOrEqual(1);
      expect(isValidFormation(d, m, f)).toBe(true);
    }
    expect(isValidFormation(2, 5, 3)).toBe(false);
    expect(isValidFormation(5, 5, 0)).toBe(false);
  });

  it("bestLineup: en yüksek puanlı 11, kaptan en yüksek, yedek sırası kaleci + puana göre", () => {
    const { players, score } = squad();
    const scoreOf = (pl: Player) => score.get(playerKey(pl)) ?? 0;
    const L = bestLineup(players, scoreOf, 0);
    expect(L.xi).toHaveLength(11);
    expect(L.bench).toHaveLength(4);
    expect(L.captain?.name).toBe("F1");
    expect(L.vice?.name).toBe("M1");
    // F1 7, F2 6, F3 5 | M 6,5,4,3,2 | D 5,4,3,2,1 -> en iyi: 3-4-3 = D5,4,3 + M6,5,4,3 + F7,6,5 + GK4
    expect(L.formation).toEqual([3, 4, 3]);
    expect(L.xiScore).toBeCloseTo(4 + 12 + 18 + 18 + 7, 10);
    expect(L.bench[0].pos).toBe("GK");
    expect(L.bench.map((x) => x.name)).toEqual(["GK2", "D4", "M5", "D5"]);
  });

  it("kilitli oyuncu daha düşük puanlı olsa da ilk 11'de kalır", () => {
    const { players, score } = squad();
    const scoreOf = (pl: Player) => score.get(playerKey(pl)) ?? 0;
    const L = bestLineup(players, scoreOf, 0, new Set(["D5|D5"]));
    expect(L.xi.map((x) => x.name)).toContain("D5");
  });

  it("yedek ağırlığı dizilişi değiştirmez, değere eklenir", () => {
    const { players, score } = squad();
    const scoreOf = (pl: Player) => score.get(playerKey(pl)) ?? 0;
    const a = bestLineup(players, scoreOf, 0);
    const b = bestLineup(players, scoreOf, 0.5);
    expect(b.value).toBeCloseTo(a.xiScore + 0.5 * a.benchScore, 10);
  });
});
