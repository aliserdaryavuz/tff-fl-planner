/**
 * Saat dilimi desteği. Veri dosyasındaki `tsi` alanı Türkiye saatidir ve
 * Türkiye'de yaz saati yoktur (sabit UTC+3); bu yüzden anlık zaman `tsi`'den
 * türetilir, `cet`'e hiç bakılmaz (CLAUDE.md: cet'ten yeniden hesaplama).
 * Gösterim için Intl kullanılır: seçilen dilimde tarih ve saat.
 */
export const TIME_ZONES = [
  "Europe/Istanbul",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Athens",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "America/Sao_Paulo",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
] as const;

export type TimeZone = (typeof TIME_ZONES)[number];

export const DEFAULT_TZ: TimeZone = "Europe/Istanbul";

export function isTimeZone(value: string | null): value is TimeZone {
  return (TIME_ZONES as readonly string[]).includes(value ?? "");
}

const TSI_OFFSET_MINUTES = 3 * 60;

/** "2026-09-08" + "19:45" (TSİ) -> epoch milisaniye. */
export function kickoffInstant(date: string, tsi: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = tsi.split(":").map(Number);
  return Date.UTC(y, m - 1, d, h, mi) - TSI_OFFSET_MINUTES * 60_000;
}

const formatters = new Map<TimeZone, Intl.DateTimeFormat>();

function formatter(tz: TimeZone): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    // en-GB + sayısal parçalar: çıktı dilden bağımsız, yalnızca parçaları okuyoruz.
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(tz, f);
  }
  return f;
}

export type LocalKickoff = {
  /** "YYYY-MM-DD", seçili dilimde. */
  date: string;
  /** "HH:MM", seçili dilimde. */
  time: string;
};

/** Anlık zamanı seçili dilimde takvim günü ve saate çevirir. */
export function localKickoff(instant: number, tz: TimeZone): LocalKickoff {
  const parts: Record<string, string> = {};
  for (const p of formatter(tz).formatToParts(new Date(instant))) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** Dilimin o andaki UTC farkı, dakika. */
export function utcOffsetMinutes(tz: TimeZone, instant: number): number {
  const { date, time } = localKickoff(instant, tz);
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  // Saniyeleri at: instant tam dakika olmayabilir.
  const wall = Date.UTC(y, m - 1, d, h, mi);
  return Math.round((wall - Math.floor(instant / 60_000) * 60_000) / 60_000);
}

/** "UTC+3", "UTC-4", "UTC+5:30" */
export function utcOffsetLabel(tz: TimeZone, instant: number): string {
  const total = utcOffsetMinutes(tz, instant);
  if (total === 0) return "UTC";
  const sign = total < 0 ? "-" : "+";
  const abs = Math.abs(total);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}
