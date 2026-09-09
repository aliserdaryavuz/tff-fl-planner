"use client";

import { useMemo, useState } from "react";
import { Exportable } from "@/components/Exportable";
import { useI18n } from "@/components/I18nProvider";
import { Segmented } from "@/components/Segmented";
import { TeamLogo } from "@/components/TeamLogo";
import { BANDS, bandOf } from "@/lib/bands";
import { byId, MATCHDAYS, schedule, teamIds } from "@/lib/data";
import type { TeamResult } from "@/lib/models";

type Sort = "total" | "strength" | "last" | "name";

const SORTS: Sort[] = ["total", "strength", "last", "name"];

const ROW_COLUMNS =
  "grid-cols-[22px_minmax(0,1fr)_68px_36px_44px] desk:grid-cols-[26px_minmax(0,1fr)_100px_46px_50px]";

export function TeamsTable({
  results,
  strength,
  order,
  gw,
  horizon,
  selected,
  onSelect,
}: {
  results: Record<string, TeamResult>;
  strength: Record<string, number>;
  order: string[];
  gw: number;
  horizon: number;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const { t, f } = useI18n();
  const [sort, setSort] = useState<Sort>("total");
  const to = Math.min(MATCHDAYS, gw + horizon - 1);

  const rows = useMemo(() => {
    if (sort === "strength") return [...teamIds].sort((a, b) => strength[b] - strength[a]);
    if (sort === "last") return [...teamIds].sort((a, b) => byId[a].last - byId[b].last);
    if (sort === "name")
      return [...teamIds].sort((a, b) => byId[a].name.localeCompare(byId[b].name, "tr"));
    return order;
  }, [sort, order, strength]);

  const totals = teamIds.map((id) => results[id].total);
  const min = Math.min(...totals);
  const max = Math.max(...totals);

  const pick = (id: string) => {
    onSelect(id);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 899px)").matches) {
      document.getElementById("team-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const windowCells = (id: string, size: string) =>
    schedule[id]
      .filter((fx) => fx.md >= gw && fx.md <= to)
      .map((fx) => {
        const value = results[id].diffs[fx.md - 1];
        return (
          <span
            key={fx.md}
            title={`${t.team.week(fx.md)}: ${byId[fx.opp].name} (${
              fx.ha === "E" ? t.fixture.homeLabel : t.fixture.awayLabel
            }) ${f.n1(value)}`}
            className={`block ${size} min-w-0 rounded-[3px]`}
            style={{ background: bandOf(value).fill }}
          />
        );
      });

  return (
    <section aria-labelledby="table-heading">
      <h2 id="table-heading" className="mb-2 font-cond text-xl font-semibold tracking-wide">
        {t.table.heading}
      </h2>

      <div className="mb-2">
        <Segmented
          label={t.table.sortLabel}
          size="sm"
          wrap
          value={sort}
          options={SORTS.map((s) => ({ value: s, label: t.table.sort[s] }))}
          onChange={setSort}
        />
      </div>

      <Exportable
        title={t.table.heading}
        subtitle={`${t.table.window(gw, to)} · ${t.table.sortLabel}: ${t.table.sort[sort]}`}
        filename={`tff-fl-teams-gw${gw}`}
        exportChildren={
          <div className="border-t border-line">
            {rows.map((id) => {
              const r = results[id];
              return (
                <div
                  key={id}
                  className="grid grid-cols-[18px_18px_minmax(0,1fr)_80px_34px] items-center gap-1.5 border-b border-line py-[5px] text-[12px]"
                >
                  <span className="text-right font-cond text-[13px] font-semibold text-muted tabular-nums">
                    {r.rank}
                  </span>
                  <TeamLogo id={id} size={16} />
                  <span className="truncate font-semibold">{byId[id].name}</span>
                  <span
                    className="grid gap-0.5"
                    style={{ gridTemplateColumns: `repeat(${horizon}, minmax(0, 1fr))` }}
                  >
                    {windowCells(id, "h-[12px]")}
                  </span>
                  <span className="text-right font-cond text-[15px] font-bold tabular-nums">
                    {f.n1(r.total)}
                  </span>
                </div>
              );
            })}
          </div>
        }
      >
        <div className={`grid ${ROW_COLUMNS} gap-1.5 px-1 pt-0.5 pb-1.5 text-xs text-muted`}>
          <span title={t.table.columns.rankTitle}>{t.table.columns.rank}</span>
          <span>{t.table.columns.team}</span>
          <span>{t.table.columns.weeks}</span>
          <span className="text-right" title={t.table.columns.strengthTitle}>
            {t.table.columns.strength}
          </span>
          <span className="text-right">{t.table.columns.total}</span>
        </div>

        <div className="border-t border-line">
          {rows.map((id) => {
            const r = results[id];
            const isSelected = id === selected;
            const width = max > min ? (r.total - min) / (max - min) : 0.5;

            return (
              <div
                key={id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => pick(id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pick(id);
                  }
                }}
                className={[
                  "grid",
                  ROW_COLUMNS,
                  "cursor-pointer items-center gap-1.5 border-b border-line border-l-[3px] py-2 pr-1",
                  isSelected ? "border-l-accent bg-accent/10" : "border-l-transparent hover:bg-white/3",
                ].join(" ")}
              >
                <div className="text-right font-cond text-[17px] font-semibold text-muted tabular-nums">
                  {r.rank}
                </div>

                <div className="min-w-0">
                  <b className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                    <TeamLogo id={id} size={18} />
                    <span className="truncate">{byId[id].name}</span>
                  </b>
                  <i className="mt-[5px] block h-1 overflow-hidden rounded-sm bg-surface-2" aria-hidden>
                    <span
                      className="block h-full"
                      style={{
                        width: `${Math.max(4, Math.round(width * 100))}%`,
                        background: `linear-gradient(90deg, ${BANDS[0].fill}, ${BANDS[2].fill}, ${BANDS[4].fill})`,
                      }}
                    />
                  </i>
                </div>

                <div
                  className="grid gap-0.5"
                  style={{ gridTemplateColumns: `repeat(${horizon}, minmax(0, 1fr))` }}
                >
                  {windowCells(id, "h-[18px]")}
                </div>

                <div
                  title={t.table.columns.strengthTitle}
                  className="text-right font-cond text-[15px] font-semibold text-muted tabular-nums"
                >
                  {f.n1(strength[id])}
                </div>

                <div className="text-right font-cond text-[19px] font-bold tabular-nums">
                  {f.n1(r.total)}
                </div>
              </div>
            );
          })}
        </div>
      </Exportable>

      <p className="mt-2 text-[13px] text-muted">{t.table.note}</p>
    </section>
  );
}
