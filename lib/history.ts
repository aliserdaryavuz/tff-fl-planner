import raw from "@/data/player-history.json";
import type { Player } from "@/lib/fantasy";

/**
 * Fiyat, seçilme oranı, puan ve dakikanın gün gün kaydı.
 *
 * Oyun yalnız **anlık** değeri veriyor; "bu hafta kim zamlandı", "kim düşüyor"
 * sorularını ancak kendi tuttuğumuz seriyle yanıtlayabiliyoruz. Kayıt
 * `scripts/log-snapshot.mjs` ile günde bir kez yazılıyor ve **geriye dönük
 * toplanamıyor** — kaydedilmeyen gün kalıcı kayıp.
 *
 * Biçim: `meta.days` tarih listesi, seriler o listeye indeksle bakar ve yalnız
 * değer değiştiğinde satır içerir. Yani bir günün değeri = indeksi o günü
 * geçmeyen son satır.
 */
export type Series<T = number> = [day: number, value: T][];

export type PlayerHistory = {
  /** Oyun fiyat vermezse null; bilinmeyen değer sıfır sayılmıyor. */
  price: Series<number | null>;
  sel: Series;
  /** Birikmiş puan ve dakika. Hafta bazlı puan türetimi Faz 4.3'e ait. */
  pts: Series;
  mins: Series;
  status: Series<string | null>;
};

export type HistoryMeta = {
  source: string;
  days: string[];
  /** Gün başına hafta numarası (o gün oynanabilir olan hafta). */
  mds: (number | null)[];
  players: number;
};

export const historyMeta: HistoryMeta = raw.meta as HistoryMeta;

const history = raw.players as unknown as Record<string, PlayerHistory>;

/** Kayıtta kaç gün var. */
const historyDays = historyMeta.days.length;

/**
 * Kaç günlük karşılaştırma yapılabilir. **0 ise arayüz değişim göstermemeli:**
 * tek günlük kayıtla "zamlandı/düştü" demek veri uydurmak olur. Kayıt bugün
 * başladığı için sezonun bu noktasında 0 olması normal.
 */
export const historySpan = Math.max(0, historyDays - 1);

export function historyOf(player: Player): PlayerHistory | undefined {
  return history[`${player.team}|${player.name}`];
}

/** Serinin `day` günündeki değeri: indeksi o günü geçmeyen son satır. */
export function valueAt<T>(series: Series<T>, day: number): T | null {
  let out: T | null = null;
  for (const [i, v] of series) {
    if (i > day) break;
    out = v;
  }
  return out;
}

export function latest<T>(series: Series<T>): T | null {
  return series.length ? series[series.length - 1][1] : null;
}

export type Change = {
  from: number;
  to: number;
  delta: number;
  /** Karşılaştırma kaç günü kapsıyor; istenen pencereden kısa olabilir. */
  days: number;
};

/**
 * Son `days` gündeki değişim. Kayıt o kadar geriye gitmiyorsa elde olan en
 * eski günle karşılaştırılır ve gerçek aralık `days` alanında döner — arayüz
 * "7 günde" yerine "2 günde" yazabilsin diye. Tek gün kaydı varsa
 * karşılaştıracak bir şey yok: null.
 */
export function changeIn(
  series: Series<number | null>,
  days: number,
  dayCount: number,
): Change | null {
  if (dayCount < 2) return null;
  const last = dayCount - 1;
  const first = Math.max(0, last - Math.max(1, days));
  const to = valueAt(series, last);
  const from = valueAt(series, first);
  if (to == null || from == null) return null;
  return { from, to, delta: to - from, days: last - first };
}

/** `changeIn`'in kayıt dosyasına bağlı hâli. */
export function changeOver(series: Series<number | null>, days: number): Change | null {
  return changeIn(series, days, historyDays);
}

export function priceChange(player: Player, days = 7): Change | null {
  const h = historyOf(player);
  return h ? changeOver(h.price, days) : null;
}

export function selChange(player: Player, days = 7): Change | null {
  const h = historyOf(player);
  return h ? changeOver(h.sel, days) : null;
}
