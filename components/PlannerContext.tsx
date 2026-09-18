"use client";

import { createContext, useContext, useMemo } from "react";
import { computeAll, windowMask } from "@/lib/models";
import { weekDecayWeights } from "@/lib/picks";
import type { PlannerState } from "@/lib/url-state";

/**
 * Paylaşılabilir durumun sayfalar arası taşıyıcısı.
 *
 * Durumun sahibi hâlâ `Shell` ama sayfalar artık ayrı adreslerde; Shell
 * yerleşimde (layout) durduğu için gezinmede yeniden kurulmuyor ve durum
 * korunuyor. Sayfalar durumu prop zinciriyle değil buradan alıyor.
 *
 * Ağır oyuncu sıralaması bilerek burada **değil** (`components/usePickRows.ts`):
 * bu dosyayı durumu okuyan her bileşen import ediyor, sıralama da burada olsaydı
 * hepsi oyuncu ve maç JSON'larını çekerdi. Aynı hata UCL'de yaşandı.
 */
type PlannerContextValue = {
  state: PlannerState;
  setState: React.Dispatch<React.SetStateAction<PlannerState>>;
};

const Ctx = createContext<PlannerContextValue | null>(null);

export function PlannerProvider({
  state,
  onChange,
  children,
}: {
  state: PlannerState;
  onChange: React.Dispatch<React.SetStateAction<PlannerState>>;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ state, setState: onChange }), [state, onChange]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlanner(): PlannerContextValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("usePlanner yalnız PlannerProvider içinde");
  return value;
}

/** Seçili hafta ve ufkun kapsadığı haftalar (maske). */
export function useWeeks(): boolean[] {
  const { state } = usePlanner();
  return useMemo(() => windowMask(state.gw, state.horizon), [state.gw, state.horizon]);
}

/** Hafta ağırlıkları: seçili ilk hafta 1, sonrakiler azalma üssüyle. */
export function useWeekWeights(): number[] {
  const { state } = usePlanner();
  return useMemo(
    () => weekDecayWeights(state.gw, state.horizon, state.weekDecay),
    [state.gw, state.horizon, state.weekDecay],
  );
}

/** Güç modeli sonuçları; model, parametreler ya da hafta maskesi değişince. */
export function useModelResults() {
  const { state } = usePlanner();
  const { model, params } = state;
  const weeks = useWeeks();
  return useMemo(() => computeAll({ model, params, weeks }), [model, params, weeks]);
}
