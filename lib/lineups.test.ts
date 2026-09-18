import { describe, expect, it } from "vitest";
import { players as gamePlayers, type Player } from "@/lib/fantasy";
import {
  fantasyPer90,
  hasLineupData,
  type LineupInfo,
  lineupOf,
  lineups,
  NO_PREDICTION,
  type Predicted,
  startProbability,
  summarizeRecent,
  UNKNOWN_START,
} from "@/lib/lineups";

const player = (over: Partial<Player> = {}): Player => ({
  name: "X",
  team: "Galatasaray",
  pos: "MID",
  price: null,
  sel: null,
  status: null,
  pts: 0,
  mins: 0,
  ...over,
});

const info = (
  recent: [boolean, number][],
  unavailable: LineupInfo["unavailable"] = null,
): LineupInfo => ({
  fotmobId: 1,
  fotmobName: "X",
  recent: recent.map(([started, minutes], i) => ({
    date: `2026-09-0${7 - i}`,
    competition: "Lig",
    started,
    minutes,
    goals: 0,
    assists: 0,
    conceded: 1,
  })),
  unavailable,
});

const NONE = NO_PREDICTION;
const pred = (over: Partial<Predicted>): Predicted => ({ ...NO_PREDICTION, ...over });

describe("startProbability", () => {
  it("sakat ve cezalı 0; verisi olmayan 0,15", () => {
    expect(startProbability(player({ status: "I" }), info([[true, 90]]), NONE)).toBe(0);
    expect(startProbability(player({ status: "S" }), info([[true, 90]]), NONE)).toBe(0);
    expect(startProbability(player(), undefined, NONE)).toBe(UNKNOWN_START);
  });

  it("üç maçtır 90 dakika başlayan tavan 0,97; tek maç güven 1/3", () => {
    expect(startProbability(player(), info([[true, 90], [true, 90], [true, 90]]), NONE)).toBe(0.97);
    expect(startProbability(player(), info([[true, 90]]), NONE)).toBeCloseTo(0.4333, 3);
  });

  it("şüpheli ×0,6; kulüp listesinde sakat 0,05; resmî kadro her şeyi bastırır", () => {
    const full = info([[true, 90], [true, 90], [true, 90]]);
    expect(startProbability(player({ status: "D" }), full, NONE)).toBeCloseTo(0.6, 6);
    expect(startProbability(player(), info([[true, 90]], { type: "injury", until: null }), NONE)).toBe(0.05);
    expect(startProbability(player(), info([[false, 0]]), pred({ confirmed: "start" }))).toBe(0.97);
    expect(startProbability(player(), full, pred({ confirmed: "out" }))).toBe(0.05);
    expect(startProbability(player(), full, pred({ sources: 2, listed: 1 }))).toBeCloseTo(0.675, 6);
  });
});

describe("summarizeRecent ve fantasyPer90", () => {
  it("dakika, başlama ve puan toplamları TFF tablosuyla", () => {
    const i: LineupInfo = {
      fotmobId: 1,
      fotmobName: "X",
      recent: [
        { date: "2026-09-04", competition: "Lig", started: true, minutes: 90, goals: 1, assists: 0, conceded: 0, bonus: 3 },
        { date: "2026-08-29", competition: "Lig", started: false, minutes: 20, goals: 0, assists: 1, conceded: 2, yellow: 1 },
      ],
      unavailable: null,
    };
    const s = summarizeRecent(player({ pos: "MID" }), i);
    expect(s.matches).toBe(2);
    expect(s.minutes).toBe(110);
    expect(s.starts).toBe(1);
    expect(s.subIns).toBe(1);
    expect(s.minutesWhenStarted).toBe(90);
    expect(s.minutesWhenSub).toBe(20);
    expect(s.over60WhenStarted).toBe(1);
    // Maç 1: 2 + 5 (gol) + 1 (gol yememe OS) + 3 bonus = 11; maç 2: 1 + 3 - 1 = 3
    expect(s.fantasyPoints).toBe(14);
    // 14 puan / 110 dk × 90 = 11,45; güven 110/380
    expect(fantasyPer90(s)).toBeCloseTo((90 * 14) / 110 * (110 / 380), 6);
    expect(fantasyPer90(summarizeRecent(player(), undefined))).toBeNull();
  });
});

describe("gerçek veri", () => {
  it("her lig maçı kaydında sahadayken yenilen gol var", () => {
    // `concededOn` olmadan yenilen gol cezası maç toplamına düşer ve oyundan
    // çıkan defans haksız yere cezalanır (PLAN.md 1.1). Alan sessizce düşerse
    // model eski hatalı davranışına geri döner, bu yüzden veri burada korunuyor.
    const league = Object.values(lineups).flatMap((info) =>
      info.recent.filter((m) => m.minutes > 0 && !/champions|europa|conference|friendl|cup|kupa/i.test(m.competition)),
    );
    expect(league.length).toBeGreaterThan(500);
    expect(league.every((m) => typeof m.concededOn === "number")).toBe(true);
    // Sahadayken yenilen gol, takımın maçta yediğinden çok olamaz.
    expect(league.every((m) => (m.concededOn ?? 0) <= (m.conceded ?? 0))).toBe(true);
    // Oyundan çıkan oyuncular yüzünden bir kısmı maç toplamından düşük olmalı.
    expect(league.filter((m) => (m.concededOn ?? 0) < (m.conceded ?? 0)).length).toBeGreaterThan(50);
  });

  it("son maç verisi yüklü ve oyun dosyasındaki adlarla eşleşiyor", () => {
    expect(hasLineupData).toBe(true);
    expect(Object.keys(lineups).length).toBeGreaterThan(300);
    // Oyun dosyasındaki oyuncuların çoğu FotMob verisiyle eşleşmeli.
    const matched = gamePlayers.filter((p) => lineupOf(p)).length;
    expect(matched / gamePlayers.length).toBeGreaterThan(0.6);
    for (const info of Object.values(lineups)) {
      for (const m of info.recent) {
        expect(m.minutes).toBeGreaterThanOrEqual(0);
        expect(m.minutes).toBeLessThanOrEqual(90);
      }
    }
  });

  it("çok oynayan oyuncunun başlama olasılığı yüksek, hiç oynamayanınki düşük", () => {
    const heavy = gamePlayers.filter((p) => p.mins >= 300);
    const none = gamePlayers.filter((p) => p.mins === 0 && !lineupOf(p));
    expect(heavy.length).toBeGreaterThan(10);
    const avg = (list: typeof heavy) =>
      list.reduce((s, p) => s + startProbability(p), 0) / list.length;
    expect(avg(heavy)).toBeGreaterThan(0.7);
    if (none.length) expect(avg(none)).toBeLessThan(0.3);
  });
});
