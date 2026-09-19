import { type Player, players as allPlayers } from "@/lib/fantasy";
import { bestLineup, type Lineup } from "@/lib/formations";
import type { PickRow } from "@/lib/picks";
import { playerKey } from "@/lib/player-key";
import { seasonTeam, seasonWeeks } from "@/lib/season-log";
import { DEFAULT_BENCH_WEIGHT, MAX_PER_CLUB } from "@/lib/squad";

/**
 * "Kadromu iyileştir": elimdeki gerçek kadrodan bu haftanın beklenen puanını
 * artıran takaslar.
 *
 * TFF'de transfer sınırsız ve cezasız, bu yüzden soru UCL'deki gibi "kaç
 * transfer yapayım, ceza değer mi" değil. Soru sadece **hangi değişiklik
 * bu haftayı yükseltir**.
 */
export type Swap = {
  out: Player;
  in: Player;
  outXp: number;
  inXp: number;
  /** Kadro hedefindeki artış: ilk 11 + kaptan farkı + yedek ağırlığı. */
  gain: number;
  /** Fiyat farkı, M TL; pozitif = daha pahalı. */
  priceDelta: number;
  /** Takastan sonra kalan para. */
  bankAfter: number;
};

export type ImprovePlan = {
  /** Bugünkü kadronun en iyi dizilişi. */
  current: Lineup;
  /** Takaslar uygulandıktan sonraki hâli. */
  final: Lineup;
  swaps: Swap[];
  bank: number;
  squad: Player[];
};

/**
 * Oyunun kadro kaydındaki oyuncu kimliklerini (gameId) oyuncu dosyasına
 * bağlar. Eşleşmeyen kimlik **atlanmaz, sayılır**: ligden ayrılmış bir oyuncu
 * güncel listede olmayabilir ve eksik kadroyu tam kadro gibi göstermek,
 * beklenen puanı sessizce düşürürdü.
 */
export function currentSquad(): { players: Player[]; missing: number[] } {
  const byGameId = new Map<number, Player>();
  for (const p of allPlayers) {
    if (p.gameId != null) byGameId.set(Number(p.gameId), p);
  }
  // Son hafta = oyunun bildiği güncel kadro (gelecek haftalar da bunu yankılıyor).
  const latest = seasonWeeks.at(-1);
  const players: Player[] = [];
  const missing: number[] = [];
  for (const entry of latest?.squad ?? []) {
    const p = byGameId.get(entry.id);
    if (p) players.push(p);
    else missing.push(entry.id);
  }
  return { players, missing };
}

/** Oyunun bildirdiği kalan bütçe (M TL). */
export const bankOf = (): number => seasonTeam.remainingBudget ?? 0;

type Options = {
  /** Kalan para, M TL. */
  bank?: number;
  benchWeight?: number;
  /** En fazla kaç takas önerilsin. */
  maxSwaps?: number;
  /** Bu kadarın altındaki kazanç gürültü sayılır ve önerilmez. */
  minGain?: number;
};

/**
 * Açgözlü takas listesi: her adımda kadroyu en çok yükselten tek takas.
 *
 * **Adım içinde kesin, adımlar arasında açgözlü.** Aynı mevkide daha düşük
 * beklenen puanlı bir oyuncuya geçmek kadro hedefini asla yükseltemez (ilk 11
 * zaten en iyi seçimle kuruluyor ve hedef her oyuncunun puanında azalmayan bir
 * fonksiyon). Dolayısıyla çıkan her oyuncu için, bütçeye ve kulüp sınırına uyan
 * adaylar arasında **en yüksek xP'li olan baskındır** — tek tek denemeye gerek
 * yok. Bu, adayları elemek değil; sonucu değiştirmeden 500 adayı 1'e indiriyor.
 *
 * Adımlar arası açgözlülük ise kesin değil: bütçe etkileşimi yüzünden üç ayrı
 * takasın toplamı, farklı bir üçlüden düşük kalabilir. Arayüz bu yüzden
 * "en iyi kadro" demiyor, "bu takaslar şu kadar kazandırıyor" diyor.
 */
export function improveSquad(
  squad: Player[],
  rows: PickRow[],
  { bank = 0, benchWeight = DEFAULT_BENCH_WEIGHT, maxSwaps = 5, minGain = 0.05 }: Options = {},
): ImprovePlan {
  const xpOf = new Map<string, number>();
  const rowOf = new Map<string, PickRow>();
  for (const r of rows) {
    const k = playerKey(r.player);
    xpOf.set(k, r.xp);
    rowOf.set(k, r);
  }
  const score = (p: Player) => xpOf.get(playerKey(p)) ?? 0;
  const value = (list: Player[]) => bestLineup(list, score, benchWeight).value;

  const current = bestLineup(squad, score, benchWeight);

  let working = [...squad];
  let money = bank;
  const swaps: Swap[] = [];

  // Mevki başına adaylar, xP'ye göre: baskın adayı bulmak tek tarama.
  const byPos = new Map<string, PickRow[]>();
  for (const r of rows) {
    const list = byPos.get(r.player.pos) ?? [];
    list.push(r);
    byPos.set(r.player.pos, list);
  }
  for (const list of byPos.values()) list.sort((a, b) => b.xp - a.xp);

  for (let step = 0; step < maxSwaps; step++) {
    const owned = new Set(working.map(playerKey));
    const baseValue = value(working);
    let best: Swap | null = null;

    for (const out of working) {
      const outKey = playerKey(out);
      const outPrice = out.price ?? 0;
      const outXp = score(out);
      const budget = outPrice + money;

      // Kulüp sayımı: çıkan oyuncu düşülmüş hâliyle.
      const clubCount = new Map<string, number>();
      for (const p of working) {
        if (playerKey(p) === outKey) continue;
        clubCount.set(p.team, (clubCount.get(p.team) ?? 0) + 1);
      }

      const candidate = (byPos.get(out.pos) ?? []).find((r) => {
        const p = r.player;
        if (owned.has(playerKey(p))) return false;
        if (p.price == null || p.price > budget + 1e-9) return false;
        if ((clubCount.get(p.team) ?? 0) >= MAX_PER_CLUB) return false;
        // Daha düşük xP kadroyu yükseltemez; taramayı burada kesmek doğru.
        return r.xp > outXp;
      });
      if (!candidate) continue;

      const next = working.map((p) => (playerKey(p) === outKey ? candidate.player : p));
      const gain = value(next) - baseValue;
      if (gain > (best?.gain ?? minGain)) {
        const priceDelta = (candidate.player.price ?? 0) - outPrice;
        best = {
          out,
          in: candidate.player,
          outXp,
          inXp: candidate.xp,
          gain,
          priceDelta,
          bankAfter: money - priceDelta,
        };
      }
    }

    if (!best) break;
    const outKey = playerKey(best.out);
    working = working.map((p) => (playerKey(p) === outKey ? best.in : p));
    money = best.bankAfter;
    swaps.push(best);
  }

  return {
    current,
    final: bestLineup(working, score, benchWeight),
    swaps,
    bank: money,
    squad: working,
  };
}
