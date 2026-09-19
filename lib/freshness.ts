import { deadlineOf, MATCHDAYS, meta, nextMatchday } from "@/lib/data";
import { sourceMeta } from "@/lib/source-meta";

/**
 * Veri grubu başına tazelik.
 *
 * Kaynak erişilemezse veri hattı eski dosyayı yerinde bırakıyor (son iyi veri).
 * Bu doğru ama sessiz: kullanıcı günlerce eski Opta sırasıyla çalıştığını
 * göremiyordu. Burada her grubun son başarılı güncellemesi, o grup için
 * beklenen yenileme aralığıyla karşılaştırılıyor.
 *
 * Elo ve bahis oranı grupları yok: 2.4 engelli (clubelo 502), 2.5 yapılmadı.
 * Olmayan kaynak için satır açmak sürekli "hiç çekilmedi" uyarısı üretirdi.
 */
export type SourceKey =
  | "fixtures"
  | "opta"
  | "value"
  | "last"
  | "players"
  | "history"
  | "lineups"
  | "results"
  | "predicted";

export const DAY_MS = 86_400_000;

/** Beklenen yenileme aralığı (gün). null = zamanla bayatlamaz. */
export const EXPECTED_DAYS: Record<SourceKey, number | null> = {
  // Fikstür sezon boyunca sabit; erteleme olursa skorla birlikte güncelleniyor.
  fixtures: null,
  opta: 6,
  value: 7,
  // Geçen sezonun nihai tablosu: elle girilmiş, hiç değişmeyecek.
  last: null,
  players: 1,
  history: 1,
  lineups: 1,
  results: 1,
  predicted: 1,
};

/** Zamanlanmış çalışmanın gecikmesi için pay: aralık + 1 günü aşan grup bayat. */
export const GRACE_DAYS = 1;

/** Tahmini 11'ler haftanın son kadro saatine bu kadar gün kala bekleniyor. */
export const PREDICTED_WINDOW_DAYS = 3;

export type Freshness =
  | { state: "fresh" | "stale"; ageDays: number }
  | { state: "static"; ageDays: number | null }
  | { state: "never" }
  | { state: "behind"; ageDays: number | null; feedGw: number; nextGw: number }
  | { state: "missing"; gw: number };

/** Veri dosyalarındaki iki tarih biçimi: "18.09.2026" ve "2026-09-18". Günün UTC başlangıcı. */
export function parseDay(value: string | null | undefined): number | null {
  const s = value?.trim() ?? "";
  let m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (m) return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return null;
}

/**
 * "Opta Power Rankings (theanalyst.com), 18.09.2026"
 *   -> { name: "Opta Power Rankings (theanalyst.com)", date: "18.09.2026" }
 * Tarihi olmayan etiket olduğu gibi ad sayılıyor.
 */
export function splitSource(label: string | undefined | null): {
  name: string;
  date: string | null;
} {
  if (!label) return { name: "—", date: null };
  const at = label.lastIndexOf(",");
  if (at < 0) return { name: label, date: null };
  const tail = label.slice(at + 1).trim();
  return parseDay(tail) === null
    ? { name: label, date: null }
    : { name: label.slice(0, at).trim(), date: tail };
}

export function freshnessOf(
  updated: string | null | undefined,
  expectedDays: number | null,
  now: number,
): Freshness {
  const day = parseDay(updated);
  if (day === null) {
    return expectedDays === null ? { state: "static", ageDays: null } : { state: "never" };
  }
  const ageDays = Math.max(0, Math.floor((now - day) / DAY_MS));
  if (expectedDays === null) return { state: "static", ageDays };
  return { state: ageDays > expectedDays + GRACE_DAYS ? "stale" : "fresh", ageDays };
}

/**
 * Oyuncu dosyası: tarih taze olsa da oyunun beslemesi geçmiş haftada kalmışsa
 * fiyat ve durumlar o haftanın. 18.09'da tam bu yaşandı — besleme 12.09'da
 * donmuştu ve dakika ayrışmasında da, sonuç verisinde de izi çıktı.
 */
export function playersFreshness(
  updated: string | null | undefined,
  feedGw: number | null,
  nextGw: number,
  now: number,
): Freshness {
  const base = freshnessOf(updated, EXPECTED_DAYS.players, now);
  if (feedGw != null && feedGw < nextGw) {
    return {
      state: "behind",
      ageDays: "ageDays" in base ? base.ageDays : null,
      feedGw,
      nextGw,
    };
  }
  return base;
}

/**
 * Tahmini 11: yalnız haftaya yakınken beklenen veri. Pencere dışında zamanla
 * bayatlamaz; pencere içinde bu haftanınki yoksa eksik.
 */
export function predictedFreshness(
  fetched: string | null | undefined,
  predictedGw: number | null,
  nextGw: number,
  daysToNext: number | null,
  now: number,
): Freshness {
  if (daysToNext == null || daysToNext > PREDICTED_WINDOW_DAYS) {
    return freshnessOf(fetched, null, now);
  }
  if (!fetched || predictedGw !== nextGw) return { state: "missing", gw: nextGw };
  return freshnessOf(fetched, EXPECTED_DAYS.predicted, now);
}

/** Sıradaki haftanın son kadro saatine kaç gün var; bilinmiyorsa null. */
export function daysToNextMatchday(nextGw: number, now: number): number | null {
  const deadline = deadlineOf(nextGw);
  if (deadline == null) return null;
  return Math.ceil((deadline - now) / DAY_MS);
}

/** Bugünkü veri dosyalarından bütün grupların tazeliği. */
export function sourceFreshness(now: number): Record<SourceKey, Freshness> {
  const nextGw = Math.min(MATCHDAYS, nextMatchday());
  return {
    fixtures: freshnessOf(splitSource(meta.source_fixtures).date, EXPECTED_DAYS.fixtures, now),
    opta: freshnessOf(splitSource(meta.opta_source).date, EXPECTED_DAYS.opta, now),
    value: freshnessOf(splitSource(meta.value_source).date, EXPECTED_DAYS.value, now),
    last: freshnessOf(splitSource(meta.last_source).date, EXPECTED_DAYS.last, now),
    players: playersFreshness(
      sourceMeta.players.fetched,
      sourceMeta.players.gameweek,
      nextGw,
      now,
    ),
    history: freshnessOf(sourceMeta.history.lastDay, EXPECTED_DAYS.history, now),
    lineups: freshnessOf(sourceMeta.lineups.fetched, EXPECTED_DAYS.lineups, now),
    results: freshnessOf(sourceMeta.results.fetched, EXPECTED_DAYS.results, now),
    predicted: predictedFreshness(
      sourceMeta.predicted.fetched,
      sourceMeta.predicted.matchday,
      nextGw,
      daysToNextMatchday(nextGw, now),
      now,
    ),
  };
}

/** Kullanıcıya uyarı olarak gösterilecek gruplar. */
export function staleSources(all: Record<SourceKey, Freshness>): SourceKey[] {
  return (Object.keys(all) as SourceKey[]).filter((k) =>
    ["stale", "behind", "missing", "never"].includes(all[k].state),
  );
}
