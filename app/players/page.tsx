"use client";

import { ContextBar, PICK_CHIPS } from "@/components/ContextBar";
import { useI18n } from "@/components/I18nProvider";
import { PageHead } from "@/components/PageHead";
import { PickList } from "@/components/PickList";
import { usePlanner } from "@/components/PlannerContext";
import { usePickRows } from "@/components/usePickRows";
import type { PickWeights } from "@/lib/picks";

/** Beklenen puan, seçilme ve geçmiş puan; ağırlıklar kullanıcının. */
export default function PlayersPage() {
  const { t } = useI18n();
  const { state, setState } = usePlanner();
  const { gw, picks, minutesImpact, selInvert } = state;
  const { rows } = usePickRows();

  const setPicks = (next: PickWeights) => setState((s) => ({ ...s, picks: next }));
  const setMinutesImpact = (v: number) => setState((s) => ({ ...s, minutesImpact: v }));
  const setSelInvert = (v: boolean) => setState((s) => ({ ...s, selInvert: v }));

  return (
    <div className="grid gap-8">
      <PageHead
        title={t.pages.players.title}
        lead={t.pages.players.lead}
        context={<ContextBar chips={PICK_CHIPS} />}
      />

      <PickList
        rows={rows}
        gw={gw}
        weights={picks}
        onWeightsChange={setPicks}
        minutesImpact={minutesImpact}
        onMinutesImpactChange={setMinutesImpact}
        selInvert={selInvert}
        onSelInvertChange={setSelInvert}
      />
    </div>
  );
}
