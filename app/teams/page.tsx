"use client";

import { useI18n } from "@/components/I18nProvider";
import { PageHead } from "@/components/PageHead";
import { useModelResults, usePlanner, useWeeks } from "@/components/PlannerContext";
import { Standings } from "@/components/Standings";
import { TeamPanel } from "@/components/TeamPanel";
import { TeamsTable } from "@/components/TeamsTable";
import { WeekSchedule } from "@/components/WeekSchedule";

/** Seçili haftalarda kimin işi kolay, kimin zor; altında haftanın maçları ve puan durumu. */
export default function TeamsPage() {
  const { t } = useI18n();
  const { state, setState } = usePlanner();
  const { team, gw, horizon, model } = state;
  const weeks = useWeeks();
  const { results, strength, order } = useModelResults();

  const setTeam = (id: string) => setState((s) => ({ ...s, team: id }));

  return (
    <div className="grid gap-8">
      <PageHead title={t.pages.teams.title} lead={t.pages.teams.lead} />

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

        <TeamsTable
          results={results}
          strength={strength}
          order={order}
          gw={gw}
          horizon={horizon}
          selected={team}
          onSelect={setTeam}
        />
      </div>

      <WeekSchedule gw={gw} results={results} selected={team} onSelect={setTeam} />

      <Standings selected={team} onSelect={setTeam} />
    </div>
  );
}
