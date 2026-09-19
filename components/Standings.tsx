"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/I18nProvider";
import { TeamLogo } from "@/components/TeamLogo";
import { byId, computeTable } from "@/lib/data";

/** Oynanan maçlardan puan durumu; açılır bölüm. */
export function Standings({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  const table = useMemo(() => computeTable(), []);
  const c = t.standings.columns;
  const head = "text-right text-caption text-muted";

  return (
    <details className="group border-t border-line pt-2">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold [&::-webkit-details-marker]:hidden">
        <span className="text-accent transition-transform group-open:rotate-90">▸</span>
        {t.standings.heading}
      </summary>
      <p className="mt-1.5 text-label text-muted">{t.standings.note}</p>
      <div className="mt-2 grid grid-cols-[22px_minmax(0,1fr)_28px_28px_28px_28px_36px_36px] items-center gap-x-1.5 px-1 pb-1">
        <span className={head}>{c.rank}</span>
        <span className="text-caption text-muted">{c.team}</span>
        <span className={head}>{c.p}</span>
        <span className={head}>{c.w}</span>
        <span className={head}>{c.d}</span>
        <span className={head}>{c.l}</span>
        <span className={head}>{c.gd}</span>
        <span className={head}>{c.pts}</span>
      </div>
      <div className="border-t border-line">
        {table.map((r) => {
          const on = r.id === selected;
          const gd = r.gf - r.ga;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r.id)}
              className={[
                "grid min-h-10 w-full grid-cols-[22px_minmax(0,1fr)_28px_28px_28px_28px_36px_36px] items-center gap-x-1.5 border-b border-line border-l-[3px] px-1 text-left text-label tabular-nums",
                on ? "border-l-accent bg-accent/10" : "border-l-transparent hover:bg-white/3",
              ].join(" ")}
            >
              <span className="text-right font-cond text-body font-semibold text-muted">{r.rank}</span>
              <span className="flex min-w-0 items-center gap-1.5 font-semibold">
                <TeamLogo id={r.id} size={16} />
                <span className="truncate">{byId[r.id].name}</span>
              </span>
              <span className="text-right text-muted">{r.p}</span>
              <span className="text-right text-muted">{r.w}</span>
              <span className="text-right text-muted">{r.d}</span>
              <span className="text-right text-muted">{r.l}</span>
              <span className="text-right text-muted">{gd > 0 ? `+${gd}` : gd}</span>
              <span className="text-right font-cond text-body font-bold">{r.pts}</span>
            </button>
          );
        })}
      </div>
    </details>
  );
}
