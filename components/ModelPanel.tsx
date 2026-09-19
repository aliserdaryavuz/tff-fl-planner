"use client";

import { useI18n } from "@/components/I18nProvider";
import { Segmented } from "@/components/Segmented";
import { ShareButton } from "@/components/ShareButton";
import { WeightControl } from "@/components/WeightControl";
import {
  MODEL_KEYS,
  MODEL_PARAMS,
  type ModelKey,
  type ModelParams,
  type ParamSpec,
} from "@/lib/models";
import type { SourceWeights } from "@/lib/strength";

export type ParamValue = number | string | SourceWeights;

export function ModelPanel({
  model,
  params,
  onModelChange,
  onParamChange,
  onReset,
}: {
  model: ModelKey;
  params: ModelParams;
  onModelChange: (model: ModelKey) => void;
  onParamChange: (key: string, value: ParamValue) => void;
  onReset: () => void;
}) {
  const { t } = useI18n();
  const values = params[model] as unknown as Record<string, ParamValue>;

  return (
    <section aria-labelledby="model-heading">
      <h2
        id="model-heading"
        className="mb-2 font-cond text-title font-semibold tracking-wide"
      >
        {t.model.heading}
      </h2>

      <Segmented
        label={t.model.pickLabel}
        value={model}
        options={MODEL_KEYS.map((k) => ({ value: k, label: t.model[k].name }))}
        onChange={onModelChange}
      />

      <p className="mt-1 text-label text-muted">{t.model[model].desc}</p>

      <div className="mt-2.5 grid gap-2.5">
        {MODEL_PARAMS.map((spec) => (
          <ParamControl
            key={spec.key}
            spec={spec}
            value={values[spec.key]}
            onChange={(v) => onParamChange(spec.key, v)}
          />
        ))}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onReset}
          className="min-h-11 rounded-lg border border-line bg-surface px-3 text-label font-medium hover:bg-surface-2"
        >
          {t.model.reset}
        </button>
        <ShareButton />
      </div>
    </section>
  );
}

function ParamControl({
  spec,
  value,
  onChange,
}: {
  spec: ParamSpec;
  value: ParamValue;
  onChange: (value: ParamValue) => void;
}) {
  const { t, f } = useI18n();
  const copy = t.model.params[spec.key];

  if (spec.kind === "weights") {
    return (
      <WeightControl
        label={copy.label}
        note={copy.note}
        weights={value as SourceWeights}
        onChange={onChange}
      />
    );
  }

  const id = `param-${spec.key}`;
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-0.5">
      <label htmlFor={id} className="text-body-sm">
        {copy.label}
      </label>
      <output
        htmlFor={id}
        className="min-w-13 text-right font-cond text-lead font-semibold text-accent tabular-nums"
      >
        {f.num(Number(value))}
      </output>
      <input
        id={id}
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={Number(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="col-span-2 w-full accent-accent"
      />
      <p className="col-span-2 -mt-0.5 text-caption text-muted">{copy.note}</p>
    </div>
  );
}
