import { describe, expect, it } from "vitest";
import {
  DEFAULT_TZ,
  isTimeZone,
  kickoffInstant,
  localKickoff,
  utcOffsetLabel,
  utcOffsetMinutes,
} from "@/lib/time";

describe("kickoffInstant", () => {
  it("TSİ sabit UTC+3: 19:45 TSİ = 16:45 UTC", () => {
    expect(kickoffInstant("2026-09-08", "19:45")).toBe(
      Date.UTC(2026, 8, 8, 16, 45),
    );
    // Kasım'da da +3: Türkiye'de yaz saati yok.
    expect(kickoffInstant("2026-11-04", "23:00")).toBe(
      Date.UTC(2026, 10, 4, 20, 0),
    );
  });
});

describe("localKickoff", () => {
  const sep = kickoffInstant("2026-09-16", "22:00"); // 19:00 UTC
  const nov = kickoffInstant("2026-11-04", "23:00"); // 20:00 UTC

  it("Türkiye: veri dosyasındaki tsi ile birebir", () => {
    expect(localKickoff(sep, DEFAULT_TZ)).toEqual({
      date: "2026-09-16",
      time: "22:00",
    });
    expect(localKickoff(nov, DEFAULT_TZ)).toEqual({
      date: "2026-11-04",
      time: "23:00",
    });
  });

  it("Londra: Eylül'de yaz saati (UTC+1), Kasım'da kış saati (UTC)", () => {
    expect(localKickoff(sep, "Europe/London").time).toBe("20:00");
    expect(localKickoff(nov, "Europe/London").time).toBe("20:00");
    expect(utcOffsetMinutes("Europe/London", sep)).toBe(60);
    expect(utcOffsetMinutes("Europe/London", nov)).toBe(0);
  });

  it("Paris: UEFA'nın CET saatiyle aynı (21:00 / 21:00)", () => {
    // Veri dosyasında cet 21:00 -> tsi 22:00 (Eylül), cet 21:00 -> tsi 23:00 (Kasım)
    expect(localKickoff(sep, "Europe/Paris").time).toBe("21:00");
    expect(localKickoff(nov, "Europe/Paris").time).toBe("21:00");
  });

  it("gün kayması: Tokyo'da 22:00 TSİ ertesi sabah 04:00", () => {
    expect(localKickoff(sep, "Asia/Tokyo")).toEqual({
      date: "2026-09-17",
      time: "04:00",
    });
  });

  it("New York: yaz saatinde 15:00, kış saatinde 15:00", () => {
    expect(localKickoff(sep, "America/New_York").time).toBe("15:00");
    expect(localKickoff(nov, "America/New_York").time).toBe("15:00");
  });
});

describe("utcOffsetLabel", () => {
  const sep = kickoffInstant("2026-09-16", "22:00");
  it("tam saat, sıfır ve yarım saatlik dilimler", () => {
    expect(utcOffsetLabel("Europe/Istanbul", sep)).toBe("UTC+3");
    expect(utcOffsetLabel("UTC", sep)).toBe("UTC");
    expect(utcOffsetLabel("America/New_York", sep)).toBe("UTC-4");
    expect(utcOffsetLabel("Asia/Kolkata", sep)).toBe("UTC+5:30");
  });
});

describe("isTimeZone", () => {
  it("listedekiler geçerli, gerisi değil", () => {
    expect(isTimeZone("Europe/Istanbul")).toBe(true);
    expect(isTimeZone("Asia/Tokyo")).toBe(true);
    expect(isTimeZone("Europe/Berlin")).toBe(false);
    expect(isTimeZone(null)).toBe(false);
  });
});
