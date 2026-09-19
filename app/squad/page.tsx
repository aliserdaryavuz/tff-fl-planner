"use client";

import { useState } from "react";
import { ContextBar, SQUAD_CHIPS } from "@/components/ContextBar";
import { useI18n } from "@/components/I18nProvider";
import { ImproveSquad } from "@/components/ImproveSquad";
import { PageHead } from "@/components/PageHead";
import { usePlanner } from "@/components/PlannerContext";
import { Segmented } from "@/components/Segmented";
import { SquadBuilder } from "@/components/SquadBuilder";
import { usePickRows } from "@/components/usePickRows";

/**
 * Sıralamadan kurulan 15 kişilik kadro: ilk 11, yedekler, kaptan.
 *
 * "Kadromu iyileştir" ayrı bir bölüm değil, burada bir görünüm: ikisi de aynı
 * sıralamayı ve aynı yedek ağırlığını kullanıyor, tek farkı birinin sıfırdan
 * kurması, diğerinin elindeki gerçek kadrodan başlaması. Gezinmeye yedinci
 * sekme eklemek telefonda sekme başına 53 px bırakırdı.
 */
export default function SquadPage() {
  const { t } = useI18n();
  const { state, setState } = usePlanner();
  const { gw, benchWeight } = state;
  const { rows, pending } = usePickRows();
  const [view, setView] = useState<"build" | "improve">("build");

  const setBenchWeight = (b: number) => setState((s) => ({ ...s, benchWeight: b }));

  return (
    <div className="grid gap-8">
      <PageHead
        title={t.pages.squad.title}
        lead={view === "build" ? t.pages.squad.lead : t.improve.note}
        context={<ContextBar chips={SQUAD_CHIPS} />}
      />

      <div className="grid gap-4">
        <Segmented
          label={t.improve.viewLabel}
          value={view}
          onChange={setView}
          options={[
            { value: "build", label: t.improve.fromScratch },
            { value: "improve", label: t.improve.mine },
          ]}
        />

        {view === "build" ? (
          <SquadBuilder
            rows={rows}
            gw={gw}
            pending={pending}
            benchWeight={benchWeight}
            onBenchWeightChange={setBenchWeight}
          />
        ) : (
          <ImproveSquad rows={rows} benchWeight={benchWeight} pending={pending} />
        )}
      </div>
    </div>
  );
}
