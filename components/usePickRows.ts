"use client";

import { useMemo } from "react";
import { useModelResults, usePlanner, useWeekWeights } from "@/components/PlannerContext";
import { useDebouncedValue } from "@/components/useDebouncedValue";
import { type PickRow, rankPicks } from "@/lib/picks";

/**
 * Oyuncu sıralaması ve "hesap sürüyor" işareti.
 *
 * `PlannerContext`ten ayrı bir dosyada duruyor ve bu bilinçli: bağlamı durumu
 * okuyan her bileşen import ediyor, sıralama da orada olsaydı hepsi oyuncu ve
 * maç JSON'larını zincirle çekerdi. Yalnız gerçekten sıralamaya ihtiyacı olan
 * sayfalar (oyuncular, kadro) bu kancayı çağırıyor.
 *
 * Kaydırak sürüklenirken ağır hesaplar el durduktan sonra koşsun diye girdiler
 * geciktiriliyor; `pending` beklemede olduğunu söylüyor.
 */
export function usePickRows(): { rows: PickRow[]; pending: boolean } {
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

  const rows = useMemo(
    () =>
      rankPicks({
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

  return { rows, pending };
}
