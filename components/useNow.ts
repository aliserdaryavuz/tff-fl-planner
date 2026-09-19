import { useSyncExternalStore } from "react";

let openedAt: number | null = null;
const subscribe = () => () => {};

/**
 * Sayfanın açıldığı an; sunucuda ve hydration sırasında null.
 *
 * Tazelik bakanın saatine göre değişiyor ("2 gün önce"), sayfa ise statik
 * üretiliyor. Sunucuda hesaplanırsa üretilen HTML ile tarayıcının çizdiği metin
 * ayrışır. Değer sayfa boyunca sabit: `getSnapshot` her çağrıda aynı sayıyı
 * dönmek zorunda, yoksa React sonsuz yeniden çizime girer.
 *
 * Köken: `../ucl-fantasy-planner/components/useNow.ts`.
 */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => (openedAt ??= Date.now()),
    () => null,
  );
}
