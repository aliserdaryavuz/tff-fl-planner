/**
 * CSS dışında zemin rengi isteyen iki yer için tek kaynak: tarayıcı çubuğu
 * (`app/layout.tsx` `themeColor`) ve görsel dışa aktarmanın arka planı
 * (`components/Exportable.tsx`). İkisi de `#000000` yazıyordu; tema
 * seçilebilir olunca sabit siyah açık temada yanlış zemin veriyor.
 *
 * Değerler `app/globals.css` ile aynı olmalı: `--color-ground` ve
 * `:root[data-theme="light"]` içindeki karşılığı.
 */
export const GROUND = "#000000";

/** Açık temanın zemini. */
export const GROUND_LIGHT = "#f7f8fa";

/** Arayüz teması; adreste `?th` ile taşınır (`lib/url-state.ts`). */
export type ThemeKey = "dark" | "light";

export const THEMES: ThemeKey[] = ["light", "dark"];

export function isTheme(value: unknown): value is ThemeKey {
  return value === "dark" || value === "light";
}

/** Tema adına göre zemin: PNG dışa aktarma ve tarayıcı çubuğu bunu kullanıyor. */
export function groundOf(theme: ThemeKey): string {
  return theme === "light" ? GROUND_LIGHT : GROUND;
}
