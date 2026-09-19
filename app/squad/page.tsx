"use client";

import { ContextBar, SQUAD_CHIPS } from "@/components/ContextBar";
import { useI18n } from "@/components/I18nProvider";
import { PageHead } from "@/components/PageHead";
import { usePlanner } from "@/components/PlannerContext";
import { SquadBuilder } from "@/components/SquadBuilder";
import { usePickRows } from "@/components/usePickRows";

/** Sıralamadan kurulan 15 kişilik kadro: ilk 11, yedekler, kaptan. */
export default function SquadPage() {
  const { t } = useI18n();
  const { state, setState } = usePlanner();
  const { gw, benchWeight } = state;
  const { rows, pending } = usePickRows();

  const setBenchWeight = (b: number) => setState((s) => ({ ...s, benchWeight: b }));

  return (
    <div className="grid gap-8">
      <PageHead
        title={t.pages.squad.title}
        lead={t.pages.squad.lead}
        context={<ContextBar chips={SQUAD_CHIPS} />}
      />

      <SquadBuilder
        rows={rows}
        gw={gw}
        pending={pending}
        benchWeight={benchWeight}
        onBenchWeightChange={setBenchWeight}
      />
    </div>
  );
}
