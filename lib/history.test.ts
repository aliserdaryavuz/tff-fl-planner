import { describe, expect, it } from "vitest";
import {
  changeIn,
  historyMeta,
  historySpan,
  latest,
  type Series,
  valueAt,
} from "@/lib/history";

/**
 * Okuma tarafı: buradaki bir hata sessizce **uydurma değişim** gösterir.
 * Bugün kayıtta tek gün var; "zamlandı/düştü" diyebilmek için en az iki gün
 * gerekiyor ve bunu kod değil test korumalı.
 */

describe("valueAt", () => {
  const s: Series = [
    [0, 6],
    [2, 7],
    [5, 8],
  ];

  it("indeksi o günü geçmeyen son satırı verir", () => {
    expect(valueAt(s, 0)).toBe(6);
    // 1. günün satırı yok: değer değişmediği için yazılmamış, 0'ınki geçerli.
    expect(valueAt(s, 1)).toBe(6);
    expect(valueAt(s, 2)).toBe(7);
    expect(valueAt(s, 4)).toBe(7);
    expect(valueAt(s, 9)).toBe(8);
  });

  it("ilk satırdan önce ve boş seride null", () => {
    expect(valueAt([[3, 6]], 2)).toBeNull();
    expect(valueAt([], 0)).toBeNull();
    expect(latest([])).toBeNull();
    expect(latest(s)).toBe(8);
  });
});

describe("changeIn", () => {
  const s: Series<number | null> = [
    [0, 6],
    [1, 6.5],
    [3, 7],
  ];

  it("tek gün kaydında karşılaştırma yok", () => {
    expect(changeIn(s, 7, 1)).toBeNull();
    expect(changeIn(s, 7, 0)).toBeNull();
  });

  it("kayıt istenen pencereden kısaysa gerçek aralığı bildirir", () => {
    // 4 gün var, 7 gün istendi: 3 günlük karşılaştırma döner, uydurulmaz.
    const r = changeIn(s, 7, 4);
    expect(r).toEqual({ from: 6, to: 7, delta: 1, days: 3 });
  });

  it("pencere kayıttan kısaysa o pencere kullanılır", () => {
    // 3. güne karşı 2. gün. 2. günün satırı yok: değeri 1. indeksten taşınan 6,5.
    const r = changeIn(s, 1, 4);
    expect(r).toEqual({ from: 6.5, to: 7, delta: 0.5, days: 1 });
  });

  it("değeri bilinmeyen seride null", () => {
    expect(changeIn([[0, null], [1, null]], 7, 2)).toBeNull();
    // Başlangıcı bilinmiyorsa fark hesaplanamaz.
    expect(changeIn([[1, 7]], 7, 2)).toBeNull();
  });
});

describe("kayıt dosyası", () => {
  it("günler artan sırada ve hafta listesiyle aynı uzunlukta", () => {
    expect(historyMeta.days.length).toBeGreaterThan(0);
    for (let i = 1; i < historyMeta.days.length; i++) {
      expect(historyMeta.days[i] > historyMeta.days[i - 1], historyMeta.days.join(",")).toBe(true);
    }
    expect(historyMeta.mds).toHaveLength(historyMeta.days.length);
  });

  it("karşılaştırılabilir aralık gün sayısının bir eksiği", () => {
    expect(historySpan).toBe(historyMeta.days.length - 1);
  });

  it("oyuncu sayısı kayıtla tutuyor", () => {
    expect(historyMeta.players).toBeGreaterThan(0);
  });
});
