import { describe, expect, it } from "vitest";
import {
  byId,
  computeTable,
  fixtures,
  fixturesOf,
  isPlayed,
  leagueAvgGoals,
  MATCHDAYS,
  meta,
  nextMatchday,
  schedule,
  teamIds,
  teams,
} from "@/lib/data";

// Veri elle düzenlenirse bu invariant'lar bozulmamalı.
describe("superlig-2026-27.json", () => {
  it("18 takım, tekrarsız id, geçen sezon sırası 1-18 tekrarsız", () => {
    expect(teams).toHaveLength(18);
    expect(new Set(teamIds).size).toBe(18);
    expect(new Set(teams.map((t) => t.last)).size).toBe(18);
    for (const t of teams) {
      expect(t.last).toBeGreaterThanOrEqual(1);
      expect(t.last).toBeLessThanOrEqual(18);
    }
  });

  it("306 maç: 34 hafta × 9", () => {
    expect(fixtures).toHaveLength(306);
    for (let md = 1; md <= MATCHDAYS; md++) {
      const week = fixtures.filter((f) => f.md === md);
      expect(week, `${md}. hafta`).toHaveLength(9);
      expect(new Set(week.flatMap((f) => [f.home, f.away])).size, `${md}. hafta`).toBe(18);
    }
  });

  it("maçların takımları tanımlı, kendisiyle oynamıyor", () => {
    for (const f of fixtures) {
      expect(byId[f.home], f.home).toBeDefined();
      expect(byId[f.away], f.away).toBeDefined();
      expect(f.home).not.toBe(f.away);
    }
  });

  it("her takım 34 maç, haftada bir, 17 ev + 17 deplasman, her rakiple bir ev bir deplasman", () => {
    for (const id of teamIds) {
      const rows = schedule[id];
      expect(rows, id).toHaveLength(MATCHDAYS);
      expect(rows.map((r) => r.md), id).toEqual(Array.from({ length: 34 }, (_, i) => i + 1));
      expect(rows.filter((r) => r.ha === "E"), id).toHaveLength(17);
      for (const opp of teamIds) {
        if (opp === id) continue;
        const vs = rows.filter((r) => r.opp === opp);
        expect(vs, `${id} - ${opp}`).toHaveLength(2);
        expect(new Set(vs.map((r) => r.ha)).size, `${id} - ${opp}`).toBe(2);
      }
    }
  });

  it("tarih ve saat biçimleri; skor ya ikisi de var ya hiç", () => {
    for (const f of fixtures) {
      expect(f.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (f.tsi != null) expect(f.tsi).toMatch(/^\d{2}:\d{2}$/);
      expect(f.hg == null).toBe(f.ag == null);
    }
  });

  it("oynanan haftalar baştan bitişik; planlanan hafta oynanan haftanın gerisinde değil", () => {
    // Oyunun "şu anki" haftası oynanıyor olabilir (hafta içi): ondan öncekiler
    // bitmiş olmalı, kendisi kısmen oynanmış olabilir.
    const current = meta.currentGameweek ?? nextMatchday();
    for (let md = 1; md < current; md++) {
      expect(fixturesOf(md).every(isPlayed), `${md}. hafta`).toBe(true);
    }
    // Kadro kurulabilen hafta: süre sonu geçince oyun bir sonrakine geçer.
    const next = nextMatchday();
    expect(next).toBeGreaterThanOrEqual(current);
    expect(next).toBeLessThanOrEqual(MATCHDAYS);
    // Planlanan haftadan sonrasında hiç sonuç olmamalı.
    for (let md = next + 1; md <= MATCHDAYS; md++) {
      expect(fixturesOf(md).some(isPlayed), `${md}. hafta`).toBe(false);
    }
  });

  it("puan durumu tutarlı", () => {
    const table = computeTable();
    expect(table).toHaveLength(18);
    const played = fixtures.filter(isPlayed).length;
    expect(table.reduce((s, r) => s + r.p, 0)).toBe(played * 2);
    expect(table.reduce((s, r) => s + r.gf, 0)).toBe(table.reduce((s, r) => s + r.ga, 0));
    for (let i = 1; i < table.length; i++) expect(table[i].pts).toBeLessThanOrEqual(table[i - 1].pts);
    expect(table[0].rank).toBe(1);
  });

  it("lig ortalaması makul", () => {
    const mu = leagueAvgGoals();
    expect(mu).toBeGreaterThan(0.8);
    expect(mu).toBeLessThan(2.2);
  });

  it("isteğe bağlı güç kaynakları ya hepsinde var ya hiçbirinde", () => {
    for (const field of ["opta", "value", "elo"] as const) {
      const filled = teams.filter((t) => t[field] != null).length;
      expect([0, teams.length], field).toContain(filled);
    }
    for (const t of teams) {
      if (t.opta != null) {
        expect(t.opta, t.id).toBeGreaterThan(0);
        expect(t.opta, t.id).toBeLessThanOrEqual(100);
      }
      if (t.value != null) {
        expect(t.value, t.id).toBeGreaterThan(0);
        expect(t.value, t.id).toBeLessThan(5000);
      }
    }
  });
});
