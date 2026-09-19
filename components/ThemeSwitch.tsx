"use client";

import { useI18n } from "@/components/I18nProvider";
import { type ThemeKey, THEMES } from "@/lib/theme";

/**
 * Üst çubuktaki tema seçimi. Dil seçicisiyle aynı kalıp: iki düğme, 44 px
 * hedef, `aria-pressed` ile hangisinin açık olduğu söyleniyor. Seçim adreste
 * taşınıyor, böylece paylaşılan bağlantı aynı temada açılıyor.
 */
export function ThemeSwitch({
  theme,
  onChange,
}: {
  theme: ThemeKey;
  onChange: (theme: ThemeKey) => void;
}) {
  const { t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t.theme.label}
      className="inline-flex shrink-0 overflow-hidden rounded-lg border border-line bg-surface"
    >
      {THEMES.map((key) => {
        const on = key === theme;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            title={t.theme[key]}
            onClick={() => onChange(key)}
            className={[
              "min-h-11 px-3 text-label font-semibold",
              on ? "bg-accent text-accent-ink" : "text-muted hover:bg-surface-2",
            ].join(" ")}
          >
            {t.theme[key]}
          </button>
        );
      })}
    </div>
  );
}
