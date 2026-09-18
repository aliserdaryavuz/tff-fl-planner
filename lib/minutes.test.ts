import { describe, expect, it } from "vitest";
import { isScoredMatch } from "@/lib/lineups";
import { FALLBACK, MINUTES, MINUTES_MEASURED, type MinuteRates } from "@/lib/minutes";

/**
 * Sayılar veriden geldiği için test **aralık** sınıyor, birebir değer değil:
 * veri her hafta tazeleniyor ve ölçülen değeri teste kopyalamak, düzeltilen
 * hatanın (sabiti kopyalayıp bayatlatmak) testte tekrarı olurdu.
 */
const sane = (r: MinuteRates, label: string) => {
  it(`${label}: oranlar olasılık, süreler dakika aralığında`, () => {
    for (const key of ["p60IfStart", "subAppears", "p60IfSub"] as const) {
      expect(r[key], `${label}.${key}`).toBeGreaterThanOrEqual(0);
      expect(r[key], `${label}.${key}`).toBeLessThanOrEqual(1);
    }
    expect(r.starterMinutes).toBeGreaterThan(60);
    expect(r.starterMinutes).toBeLessThanOrEqual(90);
    expect(r.subMinutes).toBeGreaterThan(0);
    expect(r.subMinutes).toBeLessThan(45);
  });
};

describe("dakika oranları", () => {
  sane(MINUTES, "ölçülen");
  sane(FALLBACK, "yedek");

  it("veri dosyasından ölçülüyor, yedeğe düşülmüyor", () => {
    expect(MINUTES_MEASURED).toBe(true);
    expect(MINUTES.starts).toBeGreaterThan(500);
    expect(MINUTES.benched).toBeGreaterThan(300);
    expect(MINUTES.subs).toBeGreaterThan(100);
    expect(MINUTES.subs).toBeLessThanOrEqual(MINUTES.benched);
  });

  it("tam maç oynama, 60 dakikayı geçmekten belirgin daha seyrek", () => {
    // Gol yememe tam maç istiyor, süre puanı 60'ı geçmeye bakıyor. İkisini aynı
    // sayıyla çarpmak gol yememe kalemini şişiriyordu: ölçüm 0,597'ye karşı 0,912.
    expect(MINUTES.p90IfStart).toBeGreaterThan(0.4);
    expect(MINUTES.p90IfStart).toBeLessThan(0.8);
    expect(MINUTES.p90IfStart).toBeLessThan(MINUTES.p60IfStart - 0.15);
  });

  it("ilk 11 çoğunlukla 60 dakikayı geçer, yedek neredeyse hiç", () => {
    expect(MINUTES.p60IfStart).toBeGreaterThan(0.8);
    // Yedekten girip 60 dakikayı geçmek gerçekte görülmüyor (ölçülen ~0,003);
    // beklenen puan bunu 2 puanlık süre kalemine yansıtıyor.
    expect(MINUTES.p60IfSub).toBeLessThan(0.05);
    expect(MINUTES.subMinutes).toBeLessThan(MINUTES.starterMinutes);
  });

  it("yedeğin oyuna girme oranı eski sabitten belirgin yüksek", () => {
    // Kodda 0,30 yazıyordu; ölçüm bunun yaklaşık iki katı çıktı ve yedekleri
    // sistematik olarak değersiz gösteriyordu (PLAN.md Faz 1.2).
    expect(MINUTES.subAppears).toBeGreaterThan(0.35);
  });
});

describe("isScoredMatch", () => {
  it("oyunun puanlamadığı yarışmaları eler", () => {
    for (const c of [
      "Champions League",
      "Champions League Qualification",
      "Europa League",
      "Europa League Qualification",
      "Conference League Qualification",
      "Turkish Cup",
      "Türkiye Kupası",
      "Club Friendlies",
    ]) {
      expect(isScoredMatch({ competition: c }), c).toBe(false);
    }
  });

  it("ligi ve tanınmayan adı sayar", () => {
    // Beyaz liste değil kara liste: FotMob lig adını değiştirirse veri
    // sessizce boşalmasın.
    for (const c of ["Super Lig", "Trendyol Süper Lig", "Lig", ""]) {
      expect(isScoredMatch({ competition: c }), c).toBe(true);
    }
  });
});
