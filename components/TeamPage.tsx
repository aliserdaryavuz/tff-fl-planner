"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHead } from "@/components/PageHead";
import { useModelResults, usePlanner, useWeeks } from "@/components/PlannerContext";
import { TeamLogo } from "@/components/TeamLogo";
import { TeamPanel } from "@/components/TeamPanel";
import { byId, teamSlug } from "@/lib/data";
import { encodeState } from "@/lib/url-state";

/**
 * Tek kulübün sayfası: fikstür paneli (seçili takımla aynı bileşen) ve
 * kadronun tamamı.
 *
 * Kadro listesi ayrıca yazılmıyor — `TeamPanel` zaten `FantasyList`'i çiziyor.
 * Burada ikinci bir liste tutmak sayfada kadroyu iki kez gösteriyordu
 * (ölçüldü: aynı dört mevki başlığı iki kez) ve iki kopyanın zamanla ayrışması
 * demekti. Tek fark, kulüp sayfasında listenin açık başlaması.
 */
export function TeamPage({ teamId }: { teamId: string }) {
  const { state, setState } = usePlanner();
  const { results, strength } = useModelResults();
  const weeks = useWeeks();
  const router = useRouter();

  // Adres hangi kulüpteyse seçili takım da o olsun: diğer bölümlere geçince
  // aynı kulüp açık kalır. Aynıysa dokunulmuyor, döngü olmasın.
  useEffect(() => {
    setState((s) => (s.team === teamId ? s : { ...s, team: teamId }));
  }, [teamId, setState]);

  return (
    <div className="grid gap-8">
      <PageHead
        title={
          <span className="inline-flex items-center gap-2">
            <TeamLogo id={teamId} size={28} />
            {byId[teamId].name}
          </span>
        }
      />

      <TeamPanel
        teamId={teamId}
        onSelect={(id) => router.push(`/teams/${teamSlug(id)}?${encodeState(state)}`)}
        weeks={weeks}
        gw={state.gw}
        horizon={state.horizon}
        result={results[teamId]}
        strength={strength}
        model={state.model}
        squadOpen
      />
    </div>
  );
}
