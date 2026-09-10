"use client";

import { useI18n } from "@/components/I18nProvider";
import {
  DEFAULT_PICK_WEIGHTS,
  PICK_SIGNALS,
  type PickSignal,
  type PickWeights,
  pickShares,
} from "@/lib/picks";

/**
 * Oyuncu sıralamasındaki ölçüt ağırlıkları. Hem öneri listesini hem haftanın
 * kadrosunu birlikte belirler; bu yüzden ikisinin de üstünde duruyor.
 */
export function PickWeightsPanel({
  weights,
  selInvert,
  onChange,
  onInvertChange,
}: {
  weights: PickWeights;
  selInvert: boolean;
  onChange: (weights: PickWeights) => void;
  onInvertChange: (value: boolean) => void;
}) {
  const { t, f } = useI18n();
  const shares = pickShares(weights);
  const total = PICK_SIGNALS.reduce((s, k) => s + Math.max(0, weights[k] ?? 0), 0);

  const set = (key: PickSignal, value: number) => onChange({ ...weights, [key]: value });

  return (
    <section aria-labelledby="pick-weights-heading">
      <h2
        id="pick-weights-heading"
        className="mb-2 font-cond text-xl font-semibold tracking-wide"
      >
        {t.pickWeights.heading}
      </h2>
      <p className="mb-2 text-[13px] text-muted">{t.pickWeights.note}</p>

      <div className="grid gap-1.5 rounded-lg border border-line p-2">
        {PICK_SIGNALS.map((key) => {
          const id = `pick-weight-${key}`;
          const copy = t.pickWeights.signals[key];
          return (
            <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-x-2.5">
              <label htmlFor={id} className="text-sm">
                {copy.label}
              </label>
              <output
                htmlFor={id}
                className="text-right font-cond text-lg font-semibold text-accent tabular-nums"
              >
                {f.pct(shares[key], 0)}
              </output>
              <input
                id={id}
                type="range"
                min={0}
                max={100}
                step={5}
                value={weights[key] ?? 0}
                onChange={(e) => set(key, Number(e.target.value))}
                className="col-span-2 w-full accent-accent"
              />
              <p className="col-span-2 -mt-0.5 text-xs text-muted">{copy.note}</p>
            </div>
          );
        })}

        <label className="mt-1 flex min-h-11 items-center gap-2 border-t border-line pt-2 text-sm">
          <input
            type="checkbox"
            checked={selInvert}
            onChange={(e) => onInvertChange(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          {t.pickWeights.invert}
        </label>
        <p className="-mt-1 text-xs text-muted">{t.pickWeights.invertNote}</p>

        {total === 0 ? (
          <p className="text-xs text-accent">{t.pickWeights.empty}</p>
        ) : null}

        <button
          type="button"
          onClick={() => {
            onChange(DEFAULT_PICK_WEIGHTS);
            onInvertChange(false);
          }}
          className="mt-1 min-h-11 justify-self-start rounded-lg border border-line bg-surface px-3 text-[13px] font-medium hover:bg-surface-2"
        >
          {t.pickWeights.reset}
        </button>
      </div>
    </section>
  );
}
