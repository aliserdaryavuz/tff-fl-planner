"use client";

import { GameweekBar } from "@/components/GameweekBar";
import { ModelPanel, type ParamValue } from "@/components/ModelPanel";
import { PageHead } from "@/components/PageHead";
import { useI18n } from "@/components/I18nProvider";
import { usePlanner, useWeekWeights } from "@/components/PlannerContext";
import { MATCHDAYS } from "@/lib/data";
import { DEFAULT_PARAMS, type ModelKey } from "@/lib/models";

/**
 * Kararların ilk iki adımı: hangi hafta(lar), sonra fikstür zorluğu hangi güç
 * kaynaklarıyla ölçülüyor. Bu iki ayar diğer sayfalardaki bütün sayıları
 * belirliyor, o yüzden girişte duruyorlar.
 */
export default function ModelPage() {
  const { t } = useI18n();
  const { state, setState } = usePlanner();
  const { gw, horizon, weekDecay, model, params } = state;
  const weekWeights = useWeekWeights();

  const setGw = (next: number) =>
    setState((s) => ({ ...s, gw: Math.max(1, Math.min(MATCHDAYS, next)) }));
  const setHorizon = (h: number) => setState((s) => ({ ...s, horizon: h }));
  const setDecay = (d: number) => setState((s) => ({ ...s, weekDecay: d }));
  const setModel = (next: ModelKey) => setState((s) => ({ ...s, model: next }));
  const setParam = (key: string, value: ParamValue) =>
    setState((s) => ({
      ...s,
      params: { ...s.params, [s.model]: { ...s.params[s.model], [key]: value } },
    }));
  const resetParams = () =>
    setState((s) => ({ ...s, params: { ...s.params, [s.model]: DEFAULT_PARAMS[s.model] } }));

  return (
    <div className="grid gap-8">
      <PageHead title={t.pages.model.title} lead={t.pages.model.lead} />

      <GameweekBar
        gw={gw}
        horizon={horizon}
        weekDecay={weekDecay}
        weekWeights={weekWeights}
        onGwChange={setGw}
        onHorizonChange={setHorizon}
        onDecayChange={setDecay}
      />

      <ModelPanel
        model={model}
        params={params}
        onModelChange={setModel}
        onParamChange={setParam}
        onReset={resetParams}
      />
    </div>
  );
}
