import { describe, expect, it } from "vitest";
import type { Position } from "@/lib/fantasy";
import { FALLBACK, POSITION_RATES, PRIORS_MEASURED } from "@/lib/priors";

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];

describe("POSITION_RATES", () => {
  // En önemli test bu: ölçüm sessizce yedeğe düşerse her şey yine "çalışır"
  // görünür, oysa model elle yazılmış eski sayılara dönmüş olur.
  it("gerçekten ölçülüyor, yedeğe düşmüyor", () => {
    expect(PRIORS_MEASURED).toBe(true);
    const sameAsFallback = POSITIONS.every((pos) =>
      Object.keys(FALLBACK[pos]).every(
        (k) =>
          POSITION_RATES[pos][k as keyof (typeof FALLBACK)[Position]] ===
          FALLBACK[pos][k as keyof (typeof FALLBACK)[Position]],
      ),
    );
    expect(sameAsFallback).toBe(false);
  });

  it("her oran sonlu ve negatif değil", () => {
    for (const pos of POSITIONS) {
      for (const [k, v] of Object.entries(POSITION_RATES[pos])) {
        expect(Number.isFinite(v), `${pos}.${k}`).toBe(true);
        expect(v, `${pos}.${k}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("kurtarış yalnız kalecide", () => {
    expect(POSITION_RATES.GK.saves90).toBeGreaterThan(2);
    for (const pos of ["DEF", "MID", "FWD"] as Position[]) {
      expect(POSITION_RATES[pos].saves90, pos).toBe(0);
    }
  });

  it("kaleci gol beklentisi sıfıra yakın", () => {
    expect(POSITION_RATES.GK.g90).toBeLessThan(0.01);
  });

  // Nadir olayda ölçülmüş sıfır, elle konmuş küçük bir sayıdan daha kötü bir
  // tahmin: sıfır "imkânsız" demek olurdu. Taban bu yüzden var.
  it("kırmızı kart hiçbir mevkide sıfır değil", () => {
    for (const pos of POSITIONS) {
      expect(POSITION_RATES[pos].r90, pos).toBeGreaterThan(0);
    }
  });

  it("gol beklentisi mevki sırasına uyuyor: forvet > orta saha > defans", () => {
    expect(POSITION_RATES.FWD.g90).toBeGreaterThan(POSITION_RATES.MID.g90);
    expect(POSITION_RATES.MID.g90).toBeGreaterThan(POSITION_RATES.DEF.g90);
  });
});
