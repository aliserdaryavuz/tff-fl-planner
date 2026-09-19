"use client";

import { useI18n } from "@/components/I18nProvider";
import { fixtures } from "@/lib/data";
import { kickoffInstant, TIME_ZONES, type TimeZone, utcOffsetLabel } from "@/lib/time";

/** Etiketlerdeki UTC farkı için sabit referans: saati bilinen ilk maç. */
const first = fixtures.find((f) => f.tsi) ?? fixtures[0];
const REFERENCE = kickoffInstant(first.date, first.tsi ?? "20:00");

/** Başlıktaki saat dilimi seçici. */
export function TimeZoneSelect({ onChange }: { onChange: (tz: TimeZone) => void }) {
  const { tz, t } = useI18n();

  return (
    <select
      aria-label={t.time.label}
      title={t.time.label}
      value={tz}
      onChange={(e) => onChange(e.target.value as TimeZone)}
      className="min-h-9 max-w-[190px] rounded-lg border border-line bg-surface px-2 text-caption font-medium text-ink"
    >
      {TIME_ZONES.map((zone) => (
        <option key={zone} value={zone}>
          {t.time.zones[zone]} ({utcOffsetLabel(zone, REFERENCE)})
        </option>
      ))}
    </select>
  );
}

/** Başlık satırındaki "Saatler: Türkiye (UTC+3)" metni için. */
export function timeZoneLabel(zones: Record<TimeZone, string>, tz: TimeZone): string {
  return `${zones[tz]} (${utcOffsetLabel(tz, REFERENCE)})`;
}
