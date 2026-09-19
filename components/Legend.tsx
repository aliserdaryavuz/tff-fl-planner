"use client";

import { useI18n } from "@/components/I18nProvider";
import { useTheme } from "@/components/PlannerContext";
import { bandFloor, BANDS, bandStyle, DIFFICULTY_MAX } from "@/lib/bands";

/** Renk ölçeği (§5). Renk tek başına anlam taşımasın diye aralık da yazılı. */
export function Legend() {
  const { t, f } = useI18n();
  const theme = useTheme();
  return (
    <div className="grid grid-cols-5 gap-1">
      {BANDS.map((band, i) => (
        <div
          key={band.key}
          className="rounded-md px-1 py-1.5 text-center text-caption leading-tight font-semibold"
          style={bandStyle(theme, band)}
        >
          {t.bands[band.key]}
          {/* Açık rol şart: `<small>` tarayıcıda 0.8em, yani 12 px'lik kapsayıcıda
              9,6 px'e düşüyordu — 11 px sınırının altında (ölçüldü). */}
          <small className="block text-micro font-medium opacity-80">
            {f.n1(bandFloor(i))}-
            {f.n1(i === BANDS.length - 1 ? DIFFICULTY_MAX : band.upTo)}
          </small>
        </div>
      ))}
    </div>
  );
}
