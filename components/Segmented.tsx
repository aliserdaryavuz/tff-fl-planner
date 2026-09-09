"use client";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "md",
  wrap = false,
}: {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  /** Dörtten fazla seçenek dar ekranda tek satıra sığmaz; ikişerli kır. */
  wrap?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={[
        "gap-1 rounded-[10px] bg-surface p-1",
        wrap ? "grid grid-cols-2 desk:grid-cols-4" : "flex",
      ].join(" ")}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={[
              "min-h-11 flex-1 rounded-[7px] px-1.5 font-semibold leading-tight transition-colors",
              size === "sm" ? "text-[13px]" : "text-sm",
              on
                ? "bg-accent text-accent-ink"
                : "text-muted hover:bg-surface-2 hover:text-ink",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
