"use client";

import { useI18n } from "@/components/I18nProvider";
import { type Lang, LANG_LABEL, LANGS } from "@/lib/i18n";

/** Sayfanın en üstündeki TR / EN seçimi. */
export function LangSwitch({ onChange }: { onChange: (lang: Lang) => void }) {
  const { lang, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t.lang.label}
      className="inline-flex overflow-hidden rounded-lg border border-line bg-surface"
    >
      {LANGS.map((code) => {
        const on = code === lang;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={on}
            title={LANG_LABEL[code]}
            onClick={() => onChange(code)}
            className={[
              "min-h-11 px-3 text-label font-semibold uppercase",
              on ? "bg-accent text-accent-ink" : "text-muted hover:bg-surface-2",
            ].join(" ")}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
