"use client";

import { useI18n } from "@/components/I18nProvider";
import { bandFloor, BANDS, DIFFICULTY_MAX } from "@/lib/bands";

/** Renk ölçeği (§5). Renk tek başına anlam taşımasın diye aralık da yazılı. */
export function Legend() {
  const { t, f } = useI18n();
  return (
    <div className="grid grid-cols-5 gap-1">
      {BANDS.map((band, i) => (
        <div
          key={band.key}
          className="rounded-md px-1 py-1.5 text-center text-xs leading-tight font-semibold"
          style={{ background: band.fill, color: band.ink }}
        >
          {t.bands[band.key]}
          <small className="block font-medium opacity-80">
            {f.n1(bandFloor(i))}-
            {f.n1(i === BANDS.length - 1 ? DIFFICULTY_MAX : band.upTo)}
          </small>
        </div>
      ))}
    </div>
  );
}
