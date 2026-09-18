"use client";

import { useMemo } from "react";
import { useModelResults, usePlanner, useWeekWeights } from "@/components/PlannerContext";
import { useDebouncedValue } from "@/components/useDebouncedValue";
import type { PickArgs } from "@/lib/compute-jobs";
import { type PickRow, rankPicks } from "@/lib/picks";

/**
 * Sıralamanın girdisi ve "hesap sürüyor" işareti.
 *
 * Tek kaynak: hem ana iş parçacığındaki satırlar hem worker'a giden kadro işi
 * buradan besleniyor. Değerler geciktiriliyor — kaydırak sürüklenirken her kare
 * ayrı bir iş anahtarı üretip worker'ı boşuna meşgul etmesin.
 */
export function usePickArgs(): { args: PickArgs; pending: boolean } {
  const { state } = usePlanner();
  const { picks, minutesImpact, selInvert, model, params } = state;
  const { results, strength } = useModelResults();
  const weekWeights = useWeekWeights();
  const ha = params[model].ha;

  const deferredStrength = useDebouncedValue(strength);
  const deferredResults = useDebouncedValue(results);
  const deferredWeekWeights = useDebouncedValue(weekWeights);
  const deferredHa = useDebouncedValue(ha);
  const deferredPicks = useDebouncedValue(picks);
  const deferredImpact = useDebouncedValue(minutesImpact);

  const pending =
    deferredStrength !== strength ||
    deferredResults !== results ||
    deferredWeekWeights !== weekWeights ||
    deferredHa !== ha ||
    deferredPicks !== picks ||
    deferredImpact !== minutesImpact;

  const args = useMemo<PickArgs>(
    () => ({
      results: deferredResults,
      ctx: { strength: deferredStrength, homeAdvantage: deferredHa },
      weekWeights: deferredWeekWeights,
      weights: deferredPicks,
      minutesImpact: deferredImpact,
      selInvert,
    }),
    [
      deferredResults,
      deferredStrength,
      deferredHa,
      deferredWeekWeights,
      deferredPicks,
      deferredImpact,
      selInvert,
    ],
  );

  return { args, pending };
}

/**
 * Oyuncu sıralaması. `PlannerContext`ten ayrı bir dosyada duruyor ve bu
 * bilinçli: bağlamı durumu okuyan her bileşen import ediyor, sıralama da orada
 * olsaydı hepsi oyuncu ve maç JSON'larını zincirle çekerdi.
 */
export function usePickRows(): { rows: PickRow[]; pending: boolean } {
  const { args, pending } = usePickArgs();
  const rows = useMemo(() => rankPicks(args), [args]);
  return { rows, pending };
}
