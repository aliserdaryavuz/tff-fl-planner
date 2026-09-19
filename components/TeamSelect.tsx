"use client";

import { useI18n } from "@/components/I18nProvider";
import { byId, displayOrder } from "@/lib/data";

/** Geçen sezon sırasına göre takım seçici + ‹ › ile sıradaki takıma geçiş. */
export function TeamSelect({
  value,
  onChange,
  label,
  size = "md",
}: {
  value: string;
  onChange: (id: string) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const { t } = useI18n();

  const step = (k: number) => {
    const i = displayOrder.indexOf(value);
    const n = displayOrder.length;
    onChange(displayOrder[(i + k + n) % n]);
  };

  const arrow =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-title leading-none hover:bg-surface-2";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={arrow}
        onClick={() => step(-1)}
        aria-label={t.team.prev(label)}
      >
        ‹
      </button>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "min-h-11 min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-3 font-cond font-semibold",
          size === "sm" ? "text-lead" : "text-title",
        ].join(" ")}
      >
        {displayOrder.map((id) => (
          <option key={id} value={id}>
            {byId[id].name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={arrow}
        onClick={() => step(1)}
        aria-label={t.team.next(label)}
      >
        ›
      </button>
    </div>
  );
}
