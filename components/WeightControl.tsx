"use client";

import { useI18n } from "@/components/I18nProvider";
import {
  activeSourceCount,
  availableSources,
  SOURCES,
  type SourceKey,
  type SourceWeights,
  weightShares,
} from "@/lib/strength";

/** Güç kaynaklarının ağırlıkları: kaydırak + fiili yüzde payı (§4). */
export function WeightControl({
  label,
  note,
  weights,
  onChange,
}: {
  label: string;
  note?: string;
  weights: SourceWeights;
  onChange: (weights: SourceWeights) => void;
}) {
  const { t, f } = useI18n();
  const available = availableSources();
  const shares = weightShares(weights);
  const active = activeSourceCount(weights);
  const missing = SOURCES.filter(
    (s) => !available.some((a) => a.key === s.key),
  );

  const set = (key: SourceKey, value: number) =>
    onChange({ ...weights, [key]: value });

  return (
    <div className="grid gap-1.5 rounded-lg border border-line p-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-body-sm font-semibold">{label}</span>
        {active === 0 ? (
          <span className="text-caption text-accent">{t.sources.zeroWeights}</span>
        ) : null}
      </div>

      {available.map((source) => {
        const id = `weight-${source.key}`;
        const value = weights[source.key] ?? 0;
        return (
          <div
            key={source.key}
            className="grid grid-cols-[1fr_auto] items-center gap-x-2.5"
          >
            <label htmlFor={id} className="text-body-sm">
              {t.sources[source.key].label}
            </label>
            <output
              htmlFor={id}
              className="text-right font-cond text-lead font-semibold text-accent tabular-nums"
            >
              {f.pct(shares[source.key] ?? 0, 0)}
            </output>
            <input
              id={id}
              type="range"
              min={0}
              max={100}
              step={5}
              value={value}
              onChange={(e) => set(source.key, Number(e.target.value))}
              className="col-span-2 w-full accent-accent"
            />
            <p className="col-span-2 -mt-0.5 text-caption text-muted">
              {t.sources[source.key].note}
            </p>
          </div>
        );
      })}

      {missing.length ? (
        <p className="text-caption text-muted">
          {t.sources.missing(
            missing.map((s) => t.sources[s.key].label).join(", "),
          )}
        </p>
      ) : null}

      {note ? <p className="text-caption text-muted">{note}</p> : null}
    </div>
  );
}
