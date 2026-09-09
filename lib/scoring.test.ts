import { describe, expect, it } from "vitest";
import { bonusPoints, matchPoints, SCORING } from "@/lib/scoring.mjs";

// TFF puan tablosu (kurallar sayfası, 09.09.2026) elle hesaplanmış örnekler.
describe("matchPoints", () => {
  it("oynamayan 0; 60 dk'ya kadar 1, üstü 2", () => {
    expect(matchPoints("MID", { minutes: 0 })).toBe(0);
    expect(matchPoints("MID", { minutes: 1 })).toBe(1);
    expect(matchPoints("MID", { minutes: 60, conceded: 1 })).toBe(1);
    expect(matchPoints("MID", { minutes: 61, conceded: 1 })).toBe(2);
    expect(matchPoints("MID", { minutes: 90, conceded: 1 })).toBe(2);
  });

  it("gol mevkiye göre: kaleci 10, defans 6, orta saha 5, forvet 4; asist 3", () => {
    expect(matchPoints("GK", { minutes: 90, goals: 1, conceded: 1 })).toBe(2 + 10);
    expect(matchPoints("DEF", { minutes: 90, goals: 1, conceded: 1 })).toBe(2 + 6);
    expect(matchPoints("MID", { minutes: 90, goals: 1, conceded: 1 })).toBe(2 + 5);
    expect(matchPoints("FWD", { minutes: 90, goals: 2, assists: 1, conceded: 1 })).toBe(2 + 8 + 3);
  });

  it("gol yememe: kaleci/defans 4, orta saha 1, forvet 0; 60 dk şart", () => {
    expect(matchPoints("GK", { minutes: 90, conceded: 0 })).toBe(2 + 4);
    expect(matchPoints("DEF", { minutes: 60, conceded: 0 })).toBe(1 + 4);
    expect(matchPoints("DEF", { minutes: 59, conceded: 0 })).toBe(1);
    expect(matchPoints("MID", { minutes: 90, conceded: 0 })).toBe(2 + 1);
    expect(matchPoints("FWD", { minutes: 90, conceded: 0 })).toBe(2);
  });

  it("yenilen her 2 gol kaleci/defanstan -1; orta sahaya etkisi yok", () => {
    expect(matchPoints("DEF", { minutes: 90, conceded: 2 })).toBe(2 - 1);
    expect(matchPoints("GK", { minutes: 90, conceded: 5 })).toBe(2 - 2);
    expect(matchPoints("DEF", { minutes: 90, conceded: 3 })).toBe(2 - 1);
    expect(matchPoints("MID", { minutes: 90, conceded: 4 })).toBe(2);
  });

  it("kurtarış (her 3'e 1), penaltı kurtarma 5, kaçırma -2, kartlar, kendi kalesine", () => {
    expect(matchPoints("GK", { minutes: 90, conceded: 1, saves: 7 })).toBe(2 + 2);
    expect(matchPoints("GK", { minutes: 90, conceded: 0, penSaved: 1 })).toBe(2 + 4 + 5);
    expect(matchPoints("FWD", { minutes: 90, conceded: 1, penMissed: 1 })).toBe(2 - 2);
    expect(matchPoints("MID", { minutes: 90, conceded: 1, yellow: 1 })).toBe(2 - 1);
    expect(matchPoints("MID", { minutes: 30, conceded: 1, red: 1 })).toBe(1 - 3);
    expect(matchPoints("DEF", { minutes: 90, conceded: 1, ownGoals: 1 })).toBe(2 - 2);
  });

  it("kaptan çarpanı 2", () => {
    expect(SCORING.captain).toBe(2);
  });
});

describe("bonusPoints", () => {
  it("en yüksek üç puan 3/2/1, eşitler aynı bonusu alır", () => {
    expect(bonusPoints([12, 9, 7, 5, 2])).toEqual([3, 2, 1, 0, 0]);
    expect(bonusPoints([12, 12, 9, 7])).toEqual([3, 3, 2, 1]);
    expect(bonusPoints([0, 0, 0])).toEqual([0, 0, 0]);
    expect(bonusPoints([5])).toEqual([3]);
  });
});
