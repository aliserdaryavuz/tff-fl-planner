import { describe, expect, it } from "vitest";
import { fixtures, MATCHDAYS, teamIds } from "@/lib/data";
import { results, resultsMeta } from "@/lib/results";

/**
 * Sonuç verisinin bütünlüğü.
 *
 * Sayılar (maç adedi) bilerek sabitlenmiyor: her hafta artıyor, sabitlense
 * test veriyi değil takvimi sınardı. Sınanan şey yapı — her maçın gerçek bir
 * fikstüre bağlanması, değer kümelerinin gözlenenin dışına çıkmaması ve
 * skorun oyunun verisiyle çelişmemesi.
 */

const pairOf = (m: { home: string; away: string }) => `${m.home}|${m.away}`;
const fixtureByPair = new Map(fixtures.map((f) => [`${f.home}|${f.away}`, f]));

describe("sonuç verisi", () => {
  it("her maç gerçek bir fikstüre bağlanıyor", () => {
    expect(results.length).toBeGreaterThan(0);
    for (const m of results) {
      expect(fixtureByPair.has(pairOf(m)), pairOf(m)).toBe(true);
      expect(teamIds).toContain(m.home);
      expect(teamIds).toContain(m.away);
      expect(m.md).toBeGreaterThanOrEqual(1);
      expect(m.md).toBeLessThanOrEqual(MATCHDAYS);
    }
  });

  it("aynı maç iki kez yok", () => {
    // Her maç iki takımın fikstür listesinde de geçiyor; çekim tekilleştiriyor.
    const seen = new Set(results.map(pairOf));
    expect(seen.size).toBe(results.length);
  });

  it("hafta ve taraflar fikstürle aynı", () => {
    for (const m of results) {
      const f = fixtureByPair.get(pairOf(m))!;
      expect(m.md, pairOf(m)).toBe(f.md);
      expect(m.date, pairOf(m)).toBe(f.date);
    }
  });

  it("skor varsa oyunun verisiyle birebir; yoksa null", () => {
    for (const m of results) {
      const f = fixtureByPair.get(pairOf(m))!;
      // Skorun tek doğruluk kaynağı oyunun dosyası; sonuç dosyası onu taşıyor.
      expect(m.hg, pairOf(m)).toBe(f.hg);
      expect(m.ag, pairOf(m)).toBe(f.ag);
      // Biri null'sa ikisi de null olmalı: yarım skor gösterilemez.
      expect(m.hg == null).toBe(m.ag == null);
    }
  });

  it("olay türleri ve kart değerleri gözlenen kümede", () => {
    const kinds = new Set(results.flatMap((m) => m.events.map((e) => e.kind)));
    for (const k of kinds) expect(["goal", "card", "penaltyMiss"]).toContain(k);
    const cards = new Set(
      results.flatMap((m) => m.events.filter((e) => e.kind === "card").map((e) => e.card)),
    );
    for (const c of cards) expect(["Yellow", "Red", "YellowRed"]).toContain(c);
  });

  it("olaylarda dakika ve oyuncu var", () => {
    for (const m of results) {
      for (const e of m.events) {
        expect(Number.isFinite(e.min), `${pairOf(m)} ${e.player}`).toBe(true);
        expect(e.player.trim().length, pairOf(m)).toBeGreaterThan(0);
      }
    }
  });

  it("gollerin toplamı skorla tutuyor", () => {
    for (const m of results) {
      if (m.hg == null || m.ag == null) continue;
      const goals = m.events.filter((e) => e.kind === "goal");
      // `home`, golün YAZILDIĞI taraf — atan oyuncunun tarafı değil. Kendi
      // kalesine gollerde de doğrudan kullanılıyor, ters çevrilmiyor.
      //
      // Ölçüldü (18.09), çünkü önce tersini varsaymıştım: ters çevirmek 5 maçta
      // tutmuyor (veride tam 5 kendi kalesine gol var), çevirmemek 0 maçta.
      // Örnek: Gaziantep-Rizespor 90', Ariss (Rizespor) kendi kalesine,
      // olay `home: true` ve skor 0-2'den 1-2'ye çıkıyor.
      const home = goals.filter((g) => g.home).length;
      const away = goals.length - home;
      expect(home, `${pairOf(m)} ev`).toBe(m.hg);
      expect(away, `${pairOf(m)} deplasman`).toBe(m.ag);
    }
  });

  it("meta veriyle tutarlı", () => {
    expect(resultsMeta.matches).toBe(results.length);
    expect(resultsMeta.unlinked).toBe(0);
    expect(resultsMeta.fetched).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
