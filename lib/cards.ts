import type { Player } from "@/lib/fantasy";
import { bestLineup, XI_SIZE } from "@/lib/formations";
import { improveSquad } from "@/lib/improve";
import type { PickRow } from "@/lib/picks";
import { playerKey } from "@/lib/player-key";
import { DEFAULT_BENCH_WEIGHT } from "@/lib/squad";

/**
 * Menajer kartları: bu hafta hangisini oynasam ne kazanırım.
 *
 * Kullanıcı kararı (18.09.2026): beşi de modellenecek. Her kart, kadro
 * hedefinin bir parametresini değiştiriyor — ayrı bir hesap değil:
 *
 *   Tripleks          kaptan çarpanı 2 yerine 3
 *   Dört Dörtlük      kaptan çarpanı 4
 *   Tüm Takım Sahaya  yedekler tam sayılır (yedek ağırlığı 1)
 *   Hücum             diziliş kısıtı kalkar, +5 M bütçe
 *   Limitsiz Bütçe    bütçe kısıtı kalkar
 *
 * **Kartlar ücretli.** İlk kullanımdan sonra para istiyor; bu yüzden kart
 * öneren her yer bunu yazılı tutuyor (proje kuralı, CLAUDE.md). Buradaki
 * sayı "şu kadar puan kazandırır" der, "oyna" demez.
 */
export const CARDS = ["triple", "quad", "allPlay", "attack", "unlimited"] as const;
export type CardKey = (typeof CARDS)[number];

/** Hücum kartının verdiği ek bütçe, M TL. */
export const ATTACK_BONUS_BUDGET = 5;

export type CardGain = {
  key: CardKey;
  /** Bu haftaki beklenen puan artışı; kartsız en iyi plana göre. */
  gain: number;
  /** Kart transfer üzerinden çalışıyorsa kaç takas gerektiriyor. */
  swaps: number;
};

type Options = {
  bank?: number;
  benchWeight?: number;
  maxSwaps?: number;
};

/**
 * Diziliş kısıtı olmadan en iyi 11: tek kaleci, kalan 10 yer en yüksek puanlı
 * saha oyuncularına. Hücum kartının anlamı bu — 5 forvetle çıkmak serbest.
 */
function attackLineupValue(
  squad: Player[],
  score: (p: Player) => number,
  benchWeight: number,
): number {
  const keepers = squad.filter((p) => p.pos === "GK").sort((a, b) => score(b) - score(a));
  const outfield = squad.filter((p) => p.pos !== "GK").sort((a, b) => score(b) - score(a));
  if (!keepers.length) return 0;

  const xi = [keepers[0], ...outfield.slice(0, XI_SIZE - 1)];
  const bench = [...keepers.slice(1), ...outfield.slice(XI_SIZE - 1)];

  const xiScore = xi.reduce((s, p) => s + score(p), 0);
  // Kaptan ×2: ilk 11'in en yüksek puanlısı, kartsız kuralla aynı.
  const captain = xi.reduce((best, p) => (score(p) > score(best) ? p : best), xi[0]);
  const benchScore = bench.reduce((s, p) => s + score(p), 0);
  return xiScore + score(captain) + benchWeight * benchScore;
}

/**
 * Her kartın bu haftaki kazancı, kartsız en iyi plana göre.
 *
 * Her kart için "o kartla ulaşılabilecek en iyi hafta" hesaplanıp taban plandan
 * çıkarılıyor; yani kazanç, kartın **takas kararını da değiştirdiği** durumu
 * içeriyor (Limitsiz Bütçe'nin tek anlamı zaten bu).
 *
 * Bilinen sınırlar, arayüzde de yazılı:
 * - Kaptan çarpanı kartlarında takas planı kartsız planla aynı sayılıyor.
 *   Çarpan büyüyünce daha iyi bir kaptan almak için farklı bir takas mantıklı
 *   olabilir; o arama yapılmıyor, yani bu iki kartın kazancı **alt sınır**.
 * - Hücum'da takaslar diziliş kısıtlı aranıp sonuç kısıtsız değerlendiriliyor.
 */
export function cardGains(
  squad: Player[],
  rows: PickRow[],
  { bank = 0, benchWeight = DEFAULT_BENCH_WEIGHT, maxSwaps = 5 }: Options = {},
): CardGain[] {
  const xpOf = new Map<string, number>();
  for (const r of rows) xpOf.set(playerKey(r.player), r.xp);
  const score = (p: Player) => xpOf.get(playerKey(p)) ?? 0;

  const base = improveSquad(squad, rows, { bank, benchWeight, maxSwaps });
  const baseValue = base.final.value;
  const baseCaptain = base.final.captain ? score(base.final.captain) : 0;

  const allPlay = improveSquad(squad, rows, { bank, benchWeight: 1, maxSwaps });
  const unlimited = improveSquad(squad, rows, { bank: Number.POSITIVE_INFINITY, benchWeight, maxSwaps });
  const attack = improveSquad(squad, rows, {
    bank: bank + ATTACK_BONUS_BUDGET,
    benchWeight,
    maxSwaps,
  });

  const gains: Record<CardKey, { gain: number; swaps: number }> = {
    // Kaptan bir kere daha sayılır (×2 → ×3).
    triple: { gain: baseCaptain, swaps: base.swaps.length },
    // ×2 → ×4: iki kat daha.
    quad: { gain: 2 * baseCaptain, swaps: base.swaps.length },
    // Yedekler tam sayılınca: aynı kadro, ağırlık 1.
    allPlay: {
      gain: allPlay.final.xiScore + allPlay.final.benchScore - baseValue,
      swaps: allPlay.swaps.length,
    },
    attack: {
      gain: attackLineupValue(attack.squad, score, benchWeight) - baseValue,
      swaps: attack.swaps.length,
    },
    unlimited: { gain: unlimited.final.value - baseValue, swaps: unlimited.swaps.length },
  };

  return CARDS.map((key) => ({
    key,
    // Negatif kazanç anlamsız: kart hiçbir şeyi kötüleştirmez, en kötü ihtimalle
    // hiçbir şey kazandırmaz. Aramanın açgözlülüğünden gelen küçük eksileri
    // kullanıcıya "kart zarar ediyor" diye göstermek yanlış olurdu.
    gain: Math.max(0, gains[key].gain),
    swaps: gains[key].swaps,
  })).sort((a, b) => b.gain - a.gain);
}

/** Kartsız tabanla karşılaştırma için: bugünkü kadronun beklenen puanı. */
export function baseValueOf(
  squad: Player[],
  rows: PickRow[],
  benchWeight = DEFAULT_BENCH_WEIGHT,
): number {
  const xpOf = new Map<string, number>();
  for (const r of rows) xpOf.set(playerKey(r.player), r.xp);
  return bestLineup(squad, (p) => xpOf.get(playerKey(p)) ?? 0, benchWeight).value;
}
