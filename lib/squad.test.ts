import { describe, expect, it } from "vitest";
import type { Player, Position } from "@/lib/fantasy";
import { playerKey } from "@/lib/fantasy";
import { isValidFormation } from "@/lib/formations";
import type { PickRow } from "@/lib/picks";
import { buildSquad, FORMATION, MAX_PER_CLUB, priceUnit, type Squad } from "@/lib/squad";

const row = (name: string, team: string, pos: Position, price: number, score: number): PickRow => ({
  player: { name, team, pos, price, sel: null, status: null, pts: 0, mins: 0 },
  score,
  xp: score,
  xpPerStart: score,
  modelScore: score,
  selScore: 0,
  pointsScore: 0,
  detail: {
    xp: score,
    xpPerStart: score,
    weeks: [],
    minutes: { pStart: 1, pPlay: 1, p60: 1, p90: 1, expectedMinutes: 90 },
    rates: { g90: 0, a90: 0, y90: 0, r90: 0, bonus90: 0, saves90: 0, minutes: 0 },
    summary: {
      matches: 0, minutes: 0, starts: 0, subIns: 0, minutesWhenStarted: null, minutesWhenSub: null,
      over60WhenStarted: null, goals: 0, assists: 0, yellow: 0, red: 0, ownGoals: 0, penMissed: 0,
      penSaved: 0, bonus: 0, xg: 0, xa: 0, saves: 0, fantasyPoints: 0,
    },
  },
  avgDifficulty: 3,
  startProb: 1,
  per90: null,
});

/** 6 kulüp × (1 GK, 2 DEF, 2 MID, 1 FWD), hepsi 5 M; puanlar mevkiye göre. */
function pool(): PickRow[] {
  const rows: PickRow[] = [];
  for (let c = 1; c <= 6; c++) {
    const K = `K${c}`;
    rows.push(row(`${K}-GK`, K, "GK", 5, 3 + c * 0.1));
    rows.push(row(`${K}-D1`, K, "DEF", 5, 3.5 + c * 0.1));
    rows.push(row(`${K}-D2`, K, "DEF", 5, 3 + c * 0.05));
    rows.push(row(`${K}-M1`, K, "MID", 5, 4 + c * 0.1));
    rows.push(row(`${K}-M2`, K, "MID", 5, 3.5 + c * 0.05));
    rows.push(row(`${K}-F`, K, "FWD", 5, 4.5 + c * 0.1));
  }
  return rows;
}

const counts = (players: Player[]) =>
  players.reduce((acc, p) => ({ ...acc, [p.pos]: (acc[p.pos] ?? 0) + 1 }), {} as Record<string, number>);
const clubs = (players: Player[]) =>
  players.reduce((acc, p) => ({ ...acc, [p.team]: (acc[p.team] ?? 0) + 1 }), {} as Record<string, number>);

function check(s: Squad) {
  expect(s.players).toHaveLength(15);
  expect(counts(s.players)).toEqual(FORMATION);
  expect(Math.max(...Object.values(clubs(s.players)))).toBeLessThanOrEqual(MAX_PER_CLUB);
  expect(s.price).toBeLessThanOrEqual(100 + 1e-9);
  expect(s.xi).toHaveLength(11);
  expect(s.bench).toHaveLength(4);
  expect(isValidFormation(...s.formation)).toBe(true);
  expect(s.captain).not.toBeNull();
}

describe("priceUnit", () => {
  it("0,5 adımlı fiyatlar yarım birim, gerisi 0,1", () => {
    expect(priceUnit([4, 4.5, 12])).toBe(2);
    expect(priceUnit([4.3, 5])).toBe(10);
  });
});

describe("buildSquad — kısıtlar", () => {
  it("kadro kurar, kısıtlar sağlam, kaptan en yüksek puanlı", () => {
    const r = buildSquad(pool(), { tolerance: 0 });
    expect(r.best).not.toBeNull();
    check(r.best!);
    const best = r.best!;
    const top = Math.max(...best.xi.map((p) => pool().find((x) => x.player.name === p.name)!.score));
    expect(pool().find((x) => x.player.name === best.captain!.name)!.score).toBeCloseTo(top, 10);
  });

  it("fiyat verisi yoksa hata kodu", () => {
    const rows = pool().map((r) => ({ ...r, player: { ...r.player, price: null } }));
    const r = buildSquad(rows);
    expect(r.best).toBeNull();
    expect(r.error).toBe("no-prices");
  });

  it("bütçe: pahalı yıldız sığmazsa alınmaz, sığarsa alınır", () => {
    const star = row("Yıldız", "K7", "FWD", 30, 40);
    const rows = [...pool(), star];
    // 14 × 5 = 70 + 30 = 100: sığar.
    const fits = buildSquad(rows, { tolerance: 0 });
    expect(fits.best!.players.map((p) => p.name)).toContain("Yıldız");
    expect(fits.best!.captain!.name).toBe("Yıldız");
    // Bütçe 95: sığmaz.
    const tight = buildSquad(rows, { tolerance: 0, budget: 95 });
    expect(tight.best!.players.map((p) => p.name)).not.toContain("Yıldız");
    check(tight.best!);
  });

  it("para ilk 11'e gider: pahalı ama iyi oyuncu yedekte değil ilk 11'de", () => {
    const rows = [...pool(), row("Pahalı", "K7", "MID", 20, 9)];
    const r = buildSquad(rows, { tolerance: 0 });
    const best = r.best!;
    expect(best.xi.map((p) => p.name)).toContain("Pahalı");
    // Yedekler en ucuz (5 M) olmalı
    for (const b of best.bench) expect(b.price).toBe(5);
  });

  it("kulüp başına en fazla 3: dördüncü iyi oyuncu alınmaz", () => {
    const rows = [
      ...pool(),
      row("K1-X1", "K1", "MID", 5, 50),
      row("K1-X2", "K1", "MID", 5, 50),
      row("K1-X3", "K1", "FWD", 5, 50),
      row("K1-X4", "K1", "DEF", 5, 50),
    ];
    const r = buildSquad(rows, { tolerance: 0 });
    check(r.best!);
    expect(clubs(r.best!.players)["K1"]).toBe(3);
  });

  it("kilitli oyuncu ilk 11'de kalır; dışlanan hiç girmez", () => {
    const rows = [...pool(), row("Zayıf", "K7", "MID", 5, 0.1), row("Güçlü", "K8", "MID", 5, 50)];
    const pinned = buildSquad(rows, { tolerance: 0, locked: [playerKey({ team: "K7", name: "Zayıf" })] });
    expect(pinned.best!.xi.map((p) => p.name)).toContain("Zayıf");
    const banned = buildSquad(rows, { tolerance: 0, excluded: [playerKey({ team: "K8", name: "Güçlü" })] });
    expect(banned.best!.players.map((p) => p.name)).not.toContain("Güçlü");
  });

  it("çelişen kilitler anlaşılır kod verir", () => {
    const rows = pool();
    const twoKeepers = buildSquad(rows, {
      locked: [playerKey({ team: "K1", name: "K1-GK" }), playerKey({ team: "K2", name: "K2-GK" })],
    });
    expect(twoKeepers.best).toBeNull();
    expect(twoKeepers.error).toBe("locked-position");
    const fourFromClub = buildSquad([...rows, row("K1-Z", "K1", "FWD", 5, 1)], {
      locked: ["K1-GK", "K1-D1", "K1-M1", "K1-Z"].map((n) => playerKey({ team: "K1", name: n })),
    });
    expect(fourFromClub.error).toBe("locked-club");
    const broke = buildSquad([...rows, row("Çok pahalı", "K9", "FWD", 120, 1)], {
      locked: [playerKey({ team: "K9", name: "Çok pahalı" })],
    });
    expect(broke.error).toBe("locked-budget");
  });

  it("yedek ağırlığı arttıkça yedek puanı düşmez", () => {
    const rows = [...pool(), row("İyi yedek", "K7", "MID", 6, 6), row("Ucuz yedek", "K8", "MID", 4, 0.5)];
    const cheap = buildSquad(rows, { tolerance: 0, benchWeight: 0 });
    const valued = buildSquad(rows, { tolerance: 0, benchWeight: 0.5 });
    expect(valued.best!.benchScore).toBeGreaterThanOrEqual(cheap.best!.benchScore - 1e-9);
  });

  it("tolerans seçenekleri sıralı getirir", () => {
    const r = buildSquad(pool(), { tolerance: 2 });
    expect(r.options.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < r.options.length; i++) {
      expect(r.options[i].value).toBeLessThanOrEqual(r.options[i - 1].value + 1e-9);
      check(r.options[i]);
    }
  });
});
