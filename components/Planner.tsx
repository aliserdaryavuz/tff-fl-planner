"use client";

import { useMemo } from "react";
import { GameweekBar } from "@/components/GameweekBar";
import { ModelPanel, type ParamValue } from "@/components/ModelPanel";
import { PickList } from "@/components/PickList";
import { SquadBuilder } from "@/components/SquadBuilder";
import { Standings } from "@/components/Standings";
import { TeamPanel } from "@/components/TeamPanel";
import { TeamsTable } from "@/components/TeamsTable";
import { useDebouncedValue } from "@/components/useDebouncedValue";
import { WeekSchedule } from "@/components/WeekSchedule";
import { MATCHDAYS } from "@/lib/data";
import { computeAll, DEFAULT_PARAMS, type ModelKey, windowMask } from "@/lib/models";
import { rankPicks, weekDecayWeights } from "@/lib/picks";
import type { PlannerState } from "@/lib/url-state";

/** Durumun sahibi Shell; burada sadece okunur ve güncellenir. */
export function Planner({
  state,
  onChange: setState,
}: {
  state: PlannerState;
  onChange: React.Dispatch<React.SetStateAction<PlannerState>>;
}) {
  const { team, model, params, gw, horizon, weekDecay, benchWeight } = state;

  const weeks = useMemo(() => windowMask(gw, horizon), [gw, horizon]);
  const weekWeights = useMemo(() => weekDecayWeights(gw, horizon, weekDecay), [gw, horizon, weekDecay]);

  const { results, strength, order } = useMemo(
    () => computeAll({ model, params, weeks }),
    [model, params, weeks],
  );

  // Kaydırak sürüklenirken ağır işler (beklenen puan, kadro) el durduktan sonra koşsun.
  const deferredStrength = useDebouncedValue(strength);
  const deferredResults = useDebouncedValue(results);
  const deferredWeekWeights = useDebouncedValue(weekWeights);
  const deferredHa = useDebouncedValue(params[model].ha);
  const pending =
    deferredStrength !== strength ||
    deferredResults !== results ||
    deferredWeekWeights !== weekWeights ||
    deferredHa !== params[model].ha;

  const pickRows = useMemo(
    () =>
      rankPicks({
        results: deferredResults,
        ctx: { strength: deferredStrength, homeAdvantage: deferredHa },
        weekWeights: deferredWeekWeights,
      }),
    [deferredResults, deferredStrength, deferredHa, deferredWeekWeights],
  );

  const setTeam = (id: string) => setState((s) => ({ ...s, team: id }));
  const setModel = (next: ModelKey) => setState((s) => ({ ...s, model: next }));
  const setParam = (key: string, value: ParamValue) =>
    setState((s) => ({
      ...s,
      params: { ...s.params, [s.model]: { ...s.params[s.model], [key]: value } },
    }));
  const resetParams = () =>
    setState((s) => ({ ...s, params: { ...s.params, [s.model]: DEFAULT_PARAMS[s.model] } }));
  const setGw = (next: number) =>
    setState((s) => ({ ...s, gw: Math.max(1, Math.min(MATCHDAYS, next)) }));
  const setHorizon = (h: number) => setState((s) => ({ ...s, horizon: h }));
  const setDecay = (d: number) => setState((s) => ({ ...s, weekDecay: d }));
  const setBenchWeight = (b: number) => setState((s) => ({ ...s, benchWeight: b }));

  return (
    <div className="grid gap-8">
      <GameweekBar
        gw={gw}
        horizon={horizon}
        weekDecay={weekDecay}
        weekWeights={weekWeights}
        onGwChange={setGw}
        onHorizonChange={setHorizon}
        onDecayChange={setDecay}
      />

      <SquadBuilder
        rows={pickRows}
        gw={gw}
        pending={pending}
        benchWeight={benchWeight}
        onBenchWeightChange={setBenchWeight}
      />

      <PickList rows={pickRows} gw={gw} />

      <WeekSchedule gw={gw} results={results} selected={team} onSelect={setTeam} />

      <ModelPanel
        model={model}
        params={params}
        onModelChange={setModel}
        onParamChange={setParam}
        onReset={resetParams}
      />

      <div className="grid gap-6 desk:grid-cols-2 desk:items-start desk:gap-[22px]">
        <TeamPanel
          teamId={team}
          onSelect={setTeam}
          weeks={weeks}
          gw={gw}
          horizon={horizon}
          result={results[team]}
          strength={strength}
          model={model}
        />
        <div className="grid gap-4">
          <TeamsTable
            results={results}
            strength={strength}
            order={order}
            gw={gw}
            horizon={horizon}
            selected={team}
            onSelect={setTeam}
          />
          <Standings selected={team} onSelect={setTeam} />
        </div>
      </div>
    </div>
  );
}
