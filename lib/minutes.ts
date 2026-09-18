import raw from "@/data/lineups.json";
import { isScoredMatch, type LineupInfo } from "@/lib/lineups";

/**
 * Dakika modelinin oranları: elle yazılmış sabit değil, **veri dosyasından
 * sayılıyor**.
 *
 * Neden: bu dört sayı `lib/xp.ts` içinde sabit duruyordu ve ölçümden belirgin
 * biçimde sapmışlardı (18.09.2026):
 *
 * | | kodda | ölçülen |
 * |---|---|---|
 * | Başlayanın 60+ oranı | 0,85 | 0,912 |
 * | Başlayanın dakikası | 84 | 81,7 |
 * | Yedeğin oyuna girme oranı | 0,30 | 0,491 |
 * | Giren yedeğin dakikası | 15 | 21,0 |
 *
 * En büyük hata yedekten girme oranındaydı: gerçeğin yaklaşık yarısı yazılıydı,
 * yani yedek ve rotasyon oyuncularının beklenen puanı sistematik olarak düşük
 * çıkıyordu. Bir ölçümü sabit olarak kopyalamak, kopyayı bayatlatıyor.
 *
 * Dört olay ayrı ayrı tanımlı — "ilk 11'de başlamak" ile "60 dakika oynamak"
 * aynı şey değil:
 *
 * - `p60IfStart` = P(dakika > 60 | ilk 11'de başladı)
 * - `subAppears` = P(oyuna girdi | ilk 11'de değildi)
 * - `p60IfSub`   = P(dakika > 60 | yedekken oyuna girdi)
 * - `starterMinutes`, `subMinutes` = koşullu ortalama süreler
 *
 * Eşik `> 60`: TFF tablosunda 60 dakikaya kadar 1, **60'tan fazla** 2 puan
 * (`lib/scoring.mjs`). Tam 60 dakika oynayan 1 puan alıyor.
 */
export type MinuteRates = {
  p60IfStart: number;
  /**
   * P(tam 90 dakika | ilk 11'de başladı). Gol yememe puanı bunu istiyor:
   * kural 90 dakika (bkz. `lib/scoring.mjs` `cleanSheetMinutes`), oysa süre
   * puanı 60'ı geçmeye bakıyor. İkisi çok farklı: ölçüm 0,597'ye karşı 0,912.
   * Aynı sayıyı kullanmak gol yememe kalemini ~1,5 kat şişiriyordu.
   */
  p90IfStart: number;
  subAppears: number;
  p60IfSub: number;
  starterMinutes: number;
  subMinutes: number;
  /** Ölçümün dayandığı gözlem sayıları; yöntem sayfası kapsamı yazabilsin diye. */
  starts: number;
  benched: number;
  subs: number;
};

/**
 * Veri yetersizse kullanılan değerler: ölçümün 18.09.2026'daki hâli (1010 ilk 11
 * ve 802 yedek kaydı). Sezon başında dosya boşken uydurma sayı üretmemek için.
 *
 * Pencere `--matches 6`'dan 9'a çıkınca gözlem %6 arttı ama **oranlar oynamadı**
 * (p60IfStart 0,9119 · p90IfStart 0,5970 · subAppears 0,4913). Oranların örneklem
 * büyürken yerinde kalması, ölçümün oturduğunu gösteriyor.
 */
export const FALLBACK: MinuteRates = {
  p60IfStart: 0.912,
  p90IfStart: 0.597,
  subAppears: 0.491,
  p60IfSub: 0.003,
  starterMinutes: 81.7,
  subMinutes: 21.0,
  starts: 1010,
  benched: 802,
  subs: 394,
};

/** Bu kadar ilk 11 kaydı görülmeden ölçüme güvenilmiyor. */
const MIN_STARTS = 100;

function measure(): MinuteRates | null {
  const players = raw.players as Record<string, LineupInfo>;
  let starts = 0;
  let start60 = 0;
  let start90 = 0;
  let startMin = 0;
  let benched = 0;
  let subs = 0;
  let subMin = 0;
  let sub60 = 0;

  for (const info of Object.values(players)) {
    for (const m of info.recent) {
      if (!isScoredMatch(m)) continue;
      if (m.started) {
        starts++;
        startMin += m.minutes;
        if (m.minutes > 60) start60++;
        if (m.minutes >= 90) start90++;
      } else {
        benched++;
        if (m.minutes > 0) {
          subs++;
          subMin += m.minutes;
          if (m.minutes > 60) sub60++;
        }
      }
    }
  }

  if (starts < MIN_STARTS || benched === 0) return null;
  return {
    p60IfStart: start60 / starts,
    p90IfStart: start90 / starts,
    subAppears: subs / benched,
    // Yedekten girip 60 dakikayı geçmek neredeyse görülmüyor (ölçülen 0,003);
    // yine de sayılıyor, sabitlenmiyor.
    p60IfSub: subs ? sub60 / subs : 0,
    starterMinutes: startMin / starts,
    subMinutes: subs ? subMin / subs : 0,
    starts,
    benched,
    subs,
  };
}

export const MINUTES: MinuteRates = measure() ?? FALLBACK;

/** Ölçüm mü kullanılıyor yoksa yedek değerlere mi düşüldü (yöntem sayfası için). */
export const MINUTES_MEASURED = measure() !== null;
