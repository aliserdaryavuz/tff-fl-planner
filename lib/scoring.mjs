// TFF Fantezi Lig puan tablosu (tfffantezilig.com/yardim?tab=kurallar, 09.09.2026).
// Hem uygulama (lib/xp.ts, lib/lineups.ts) hem veri betikleri
// (scripts/fetch-lineups.mjs) buradan okur; tek kaynak olsun diye düz JS.
//
//   60 dakikaya kadar oynayan 1, 60'tan fazla oynayan 2 puan.
//   Gol: kaleci 10, defans 6, orta saha 5, forvet 4. Asist 3 (mevki farkı yok).
//   Gol yememe: kural sayfası "en az 60 dakika" diyor ama oyunun kendi verisi
//   **tam maç** istediğini gösteriyor (bkz. cleanSheetMinutes).
//   Kaleci her 3 kurtarış 1; penaltı kurtaran 5; penaltı kaçıran -2.
//   Yenilen her 2 gol: kaleci ve defanstan -1. Sarı -1, kırmızı -3, kendi kalesine -2.
//   Maçın en yüksek puanlı üç oyuncusu 3, 2, 1 bonus; eşitlikte ikisi de alır.
//   Kaptan ×2 (menajer kartıyla ×3 / ×4).

/** @typedef {"GK" | "DEF" | "MID" | "FWD"} Position */

export const SCORING = {
  appearance: { upTo60: 1, over60: 2 },
  goal: { GK: 10, DEF: 6, MID: 5, FWD: 4 },
  assist: 3,
  cleanSheet: { GK: 4, DEF: 4, MID: 1, FWD: 0 },
  /**
   * Gol yememe için gereken süre. Kural sayfası 60 yazıyor; **oyunun kendi
   * sayımı 90 diyor** ve ölçüm bunu tartışmasız gösteriyor (18.09.2026,
   * `scripts/solve-scoring.mjs` ve `lib/scoring-rules.test.ts`).
   *
   * Oyuncunun sezon `cleanSheets` alanı ile bizim hesabımız karşılaştırıldı:
   *
   *            oyunun toplamı   60 dk tanımı   90 dk tanımı   90 dk birebir
   *   Kaleci   21               21             21             21/21
   *   Defans   66               78             67             102/103
   *   Orta s.  37               82             39             141/143
   *   Forvet    2               22              3             48/49
   *
   * 60 dakika tanımı orta sahada iki katından fazla, forvette on katı sayıyor.
   * Örnek: Ruan'ın takımı iki maçta gol yememiş ama o 81 ve 86 dakika oynamış;
   * oyun ona sıfır gol yememe yazmış. Forvetteki 2 sayısı da böyle açıklanıyor:
   * yalnız üç forvet gol yenmeyen bir maçta tam 90 oynamış.
   */
  cleanSheetMinutes: 90,
  savesPerPoint: 3,
  penaltySave: 5,
  penaltyMiss: -2,
  /** Kaleci ve defans: yenilen her `concededPer` gol için `concededPenalty`. */
  concededPer: 2,
  concededPenalty: -1,
  yellow: -1,
  red: -3,
  ownGoal: -2,
  bonus: [3, 2, 1],
  captain: 2,
};

/**
 * @typedef {object} MatchStats
 * @property {number} minutes
 * @property {number} [goals]
 * @property {number} [assists]
 * @property {number} [conceded]   takımın maçta yediği gol
 * @property {number} [concededOn] oyuncu sahadayken yenilen gol; varsa ceza buna göre
 * @property {number} [saves]
 * @property {number} [penSaved]
 * @property {number} [penMissed]
 * @property {number} [yellow]
 * @property {number} [red]
 * @property {number} [ownGoals]
 */

/**
 * Bir maçın puanı, bonus hariç. Oynamayan 0 alır.
 * @param {Position} pos
 * @param {MatchStats} s
 */
export function matchPoints(pos, s) {
  const min = s.minutes ?? 0;
  if (min <= 0) return 0;
  let pts = min > 60 ? SCORING.appearance.over60 : SCORING.appearance.upTo60;
  pts += (s.goals ?? 0) * SCORING.goal[pos];
  pts += (s.assists ?? 0) * SCORING.assist;
  if (min >= SCORING.cleanSheetMinutes && (s.conceded ?? 0) === 0) {
    pts += SCORING.cleanSheet[pos];
  }
  if (pos === "GK") pts += Math.floor((s.saves ?? 0) / SCORING.savesPerPoint);
  pts += (s.penSaved ?? 0) * SCORING.penaltySave;
  pts += (s.penMissed ?? 0) * SCORING.penaltyMiss;
  if (pos === "GK" || pos === "DEF") {
    // Ceza yalnız oyuncu sahadayken yenilen gole uygulanır. `concededOn` varsa
    // o kullanılır; yoksa takımın maç toplamına düşülür.
    //
    // Neden: eskiden her zaman maç toplamı kullanılıyordu, yani oyundan çıkan
    // defansa sonradan yenilen goller de kesiliyordu. Ölçüm (18.09.2026,
    // 103 defans): düzeltmeyle oyunun puanını birebir veren oyuncu 31'den 51'e
    // çıktı, RMSE 1,44'ten 1,16'ya indi.
    const against = s.concededOn ?? s.conceded ?? 0;
    pts += Math.floor(against / SCORING.concededPer) * SCORING.concededPenalty;
  }
  pts += (s.yellow ?? 0) * SCORING.yellow;
  pts += (s.red ?? 0) * SCORING.red;
  pts += (s.ownGoals ?? 0) * SCORING.ownGoal;
  return pts;
}

/**
 * Maçtaki tüm oyuncuların puanından bonus dağılımı: en yüksek üç puan 3, 2, 1;
 * eşit puanlılar aynı bonusu alır (kural metni). Sıralama farklı puan
 * değerlerine göre: 12, 12, 9, 7 -> ilk ikisi 3, üçüncü 2, dördüncü 1.
 * @param {number[]} points  oyuncuların puanları (aynı sırayla döner)
 * @returns {number[]} her oyuncunun bonusu
 */
export function bonusPoints(points) {
  const distinct = [...new Set(points.filter((p) => p > 0))].sort((a, b) => b - a);
  return points.map((p) => {
    const i = distinct.indexOf(p);
    return i >= 0 && i < SCORING.bonus.length ? SCORING.bonus[i] : 0;
  });
}
