import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  EXPECTED_DAYS,
  freshnessOf,
  GRACE_DAYS,
  parseDay,
  playersFreshness,
  predictedFreshness,
  splitSource,
} from "@/lib/freshness";

/**
 * Tazelik durumları.
 *
 * Bugünkü veriyle hiçbir grup bayat değil (hepsi bir gün önce çekildi), yani
 * uyarı yolu tarayıcıda hiç çizilmiyor. Saf fonksiyonlar oldukları için doğru
 * yer burası: "hiç görülmedi" ile "çalışıyor" aynı şey değil.
 */

const DAY = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

describe("parseDay", () => {
  it("iki biçimi de okur, geçersizi reddeder", () => {
    expect(parseDay("18.09.2026")).toBe(DAY("2026-09-18"));
    expect(parseDay("2026-09-18")).toBe(DAY("2026-09-18"));
    expect(parseDay("")).toBeNull();
    expect(parseDay(null)).toBeNull();
    expect(parseDay("18 Eylül 2026")).toBeNull();
  });
});

describe("splitSource", () => {
  it("sondaki tarihi ayırır", () => {
    expect(splitSource("Opta Power Rankings (theanalyst.com), 18.09.2026")).toEqual({
      name: "Opta Power Rankings (theanalyst.com)",
      date: "18.09.2026",
    });
  });

  it("virgülü olan ama tarihi olmayan etiketi bölmez", () => {
    // Gerçek örnek: geçen sezon sırası. Bölseydik kaynak adı yarım görünürdü.
    const label = "Wikipedia, 2025–26 Süper Lig ve TFF 1. Lig nihai tabloları";
    expect(splitSource(label)).toEqual({ name: label, date: null });
  });

  it("boş etiket", () => {
    expect(splitSource(undefined)).toEqual({ name: "—", date: null });
  });
});

describe("freshnessOf", () => {
  const now = DAY("2026-09-19");

  it("beklenen aralık + pay içindeyse taze", () => {
    const r = freshnessOf("2026-09-18", 1, now);
    expect(r).toEqual({ state: "fresh", ageDays: 1 });
  });

  it("aralık + payı aşınca bayat", () => {
    // Günlük grup: 1 + 1 pay = 2 güne kadar taze, 3 günde bayat.
    expect(freshnessOf("2026-09-17", 1, now)).toEqual({ state: "fresh", ageDays: 2 });
    expect(freshnessOf("2026-09-16", 1, now)).toEqual({ state: "stale", ageDays: 3 });
  });

  it("zamanla bayatlamayan grup: yaşı yazılır ama uyarı yok", () => {
    expect(freshnessOf("2026-08-01", null, now)).toEqual({ state: "static", ageDays: 49 });
    // Tarihi olmayan sabit grup (elle girilen): "hiç çekilmedi" demek yanlış olurdu.
    expect(freshnessOf(null, null, now)).toEqual({ state: "static", ageDays: null });
  });

  it("tarihi olmayan ama beklenen grup: hiç çekilmedi", () => {
    expect(freshnessOf(null, 1, now)).toEqual({ state: "never" });
  });

  it("gelecek tarih negatif yaş vermez", () => {
    expect(freshnessOf("2026-09-25", 1, now)).toEqual({ state: "fresh", ageDays: 0 });
  });
});

describe("playersFreshness", () => {
  const now = DAY("2026-09-19");

  it("besleme planlanan haftanın gerisindeyse uyarır", () => {
    // 18.09'da yaşanan durum: dosya taze ama oyunun beslemesi eski haftada.
    expect(playersFreshness("2026-09-19", 5, 6, now)).toEqual({
      state: "behind",
      ageDays: 0,
      feedGw: 5,
      nextGw: 6,
    });
  });

  it("besleme güncelse normal tazelik", () => {
    expect(playersFreshness("2026-09-18", 6, 6, now)).toEqual({ state: "fresh", ageDays: 1 });
  });

  it("hafta bilinmiyorsa tazeliğe karışmaz", () => {
    expect(playersFreshness("2026-09-18", null, 6, now)).toEqual({ state: "fresh", ageDays: 1 });
  });
});

describe("predictedFreshness", () => {
  const now = DAY("2026-09-19");

  it("hafta uzaksa zamanla bayatlamaz", () => {
    expect(predictedFreshness("2026-09-01", 6, 7, 9, now)).toEqual({ state: "static", ageDays: 18 });
  });

  it("hafta yakınsa ve bu haftanınki yoksa eksik", () => {
    expect(predictedFreshness("2026-09-18", 6, 7, 2, now)).toEqual({ state: "missing", gw: 7 });
    expect(predictedFreshness(null, null, 7, 2, now)).toEqual({ state: "missing", gw: 7 });
  });

  it("hafta yakın ve bu haftanınki varsa normal tazelik", () => {
    expect(predictedFreshness("2026-09-18", 7, 7, 2, now)).toEqual({ state: "fresh", ageDays: 1 });
  });

  it("son kadro saati bilinmiyorsa pencere dışı sayılır", () => {
    expect(predictedFreshness("2026-09-01", 6, 7, null, now)).toEqual({ state: "static", ageDays: 18 });
  });
});

describe("eşikler", () => {
  it("günlük gruplar 1 gün, pay 1 gün", () => {
    expect(EXPECTED_DAYS.players).toBe(1);
    expect(EXPECTED_DAYS.results).toBe(1);
    // Fikstür ve geçen sezon tablosu zamanla bayatlamaz.
    expect(EXPECTED_DAYS.fixtures).toBeNull();
    expect(EXPECTED_DAYS.last).toBeNull();
    expect(GRACE_DAYS).toBe(1);
    expect(DAY_MS).toBe(86_400_000);
  });
});
