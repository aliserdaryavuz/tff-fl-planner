import raw from "@/data/lineups.json";
import { players as gamePlayers, type Position } from "@/lib/fantasy";
import { isScoredMatch, type LineupInfo } from "@/lib/lineups";

/**
 * Az veri düzeltmesinin (`shrunkRates`) çektiği mevki ortalamaları: elle
 * yazılmış sabit değil, **veri dosyasından sayılıyor**. `lib/minutes.ts` ile
 * aynı gerekçe: bir ölçümü koda kopyalamak, kopyayı bayatlatıyor.
 *
 * Ölçüm 18.09.2026'da elle yazılı değerleri şöyle buldu:
 *
 * | | kodda | ölçülen |
 * |---|---|---|
 * | Kaleci bonus/90 | 0,35 | 0,761 |
 * | Defans bonus/90 | 0,30 | 0,460 |
 * | Forvet bonus/90 | 0,45 | 0,783 |
 * | Forvet gol/90 | 0,35 | 0,451 |
 *
 * Gol ve asist önceliği **beklenen üretimden** (xG/xA) geliyor, ham sayımdan
 * değil: 1.3'te ölçüldü, beklenen üretim gelecek haftayı daha iyi öngörüyor.
 * Lig toplamında ikisi zaten örtüşüyor (orta saha 53 gol / 58,0 xG), yani bu
 * seçim önceliği şişirmiyor, yalnız modelin geri kalanıyla tutarlı kılıyor.
 */
export type PositionRates = {
  g90: number;
  a90: number;
  y90: number;
  r90: number;
  bonus90: number;
  saves90: number;
};

/** Ölçüm başarısızsa kullanılan değerler: 18.09.2026 öncesi elle yazılı hâl. */
export const FALLBACK: Record<Position, PositionRates> = {
  GK: { g90: 0, a90: 0.005, y90: 0.08, r90: 0.005, bonus90: 0.35, saves90: 3.13 },
  DEF: { g90: 0.05, a90: 0.06, y90: 0.22, r90: 0.012, bonus90: 0.3, saves90: 0 },
  MID: { g90: 0.13, a90: 0.14, y90: 0.2, r90: 0.01, bonus90: 0.35, saves90: 0 },
  FWD: { g90: 0.35, a90: 0.14, y90: 0.16, r90: 0.008, bonus90: 0.45, saves90: 0 },
};

/** Bir mevki bu kadar dakika görülmeden ölçümüne güvenilmiyor. */
const MIN_MINUTES = 3000;

/**
 * Kırmızı kart için taban — **ölçülmedi, bilinçli bir yargı.**
 *
 * 5 haftalık veride kaleci ve defansta hiç kırmızı kart yok, yani ölçüm sıfır
 * veriyor. Sıfırı olduğu gibi almak "kırmızı kart imkânsız" demek olurdu; oysa
 * gözlenmemesi nadir olmasından, imkânsız olmasından değil. Nadir olayda
 * ölçülmüş sıfır, elle konmuş küçük bir sayıdan daha kötü bir tahmindir.
 * Ölçüm bu tabanın üstündeyse ölçüm kazanır.
 */
const RED_FLOOR = 0.005;

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];

function measure(): Record<Position, PositionRates> | null {
  const byKey = new Map<string, Position>();
  for (const p of gamePlayers) byKey.set(`${p.team}|${p.name}`, p.pos);

  const acc: Record<string, { minutes: number; xg: number; xa: number; yellow: number; red: number; bonus: number; saves: number }> = {};
  for (const pos of POSITIONS) acc[pos] = { minutes: 0, xg: 0, xa: 0, yellow: 0, red: 0, bonus: 0, saves: 0 };

  const players = raw.players as Record<string, LineupInfo>;
  for (const [key, info] of Object.entries(players)) {
    const pos = byKey.get(key);
    if (!pos) continue;
    for (const m of info.recent) {
      if (!isScoredMatch(m) || m.minutes <= 0) continue;
      const a = acc[pos];
      a.minutes += m.minutes;
      a.xg += m.xg ?? 0;
      a.xa += m.xa ?? 0;
      a.yellow += m.yellow ?? 0;
      a.red += m.red ?? 0;
      a.bonus += m.bonus ?? 0;
      a.saves += m.saves ?? 0;
    }
  }

  // Tek bir mevki bile ölçülemiyorsa tamamı yedeğe düşüyor: mevkileri farklı
  // kaynaklardan karıştırmak, sıralamayı mevkiler arasında bozardı.
  if (POSITIONS.some((pos) => acc[pos].minutes < MIN_MINUTES)) return null;

  const out = {} as Record<Position, PositionRates>;
  for (const pos of POSITIONS) {
    const a = acc[pos];
    const per90 = (total: number) => (90 * total) / a.minutes;
    out[pos] = {
      g90: per90(a.xg),
      a90: per90(a.xa),
      y90: per90(a.yellow),
      r90: Math.max(per90(a.red), RED_FLOOR),
      bonus90: per90(a.bonus),
      saves90: per90(a.saves),
    };
  }
  return out;
}

const measured = measure();

export const POSITION_RATES: Record<Position, PositionRates> = measured ?? FALLBACK;

/** Ölçüm mü kullanılıyor yoksa yedeğe mi düşüldü (yöntem sayfası için). */
export const PRIORS_MEASURED = measured !== null;
