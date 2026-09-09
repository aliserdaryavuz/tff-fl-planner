"use client";

import { useI18n } from "@/components/I18nProvider";
import { TeamLogo } from "@/components/TeamLogo";
import { bandOf } from "@/lib/bands";
import { byId, fixturesOf, isPlayed } from "@/lib/data";
import type { TeamResult } from "@/lib/models";

/** Seçili haftanın 9 maçı: tarih, saat (seçili dilimde), skor ya da iki tarafın zorluğu. */
export function WeekSchedule({
  gw,
  results,
  selected,
  onSelect,
}: {
  gw: number;
  results: Record<string, TeamResult>;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const { t, f } = useI18n();
  const matches = fixturesOf(gw);

  return (
    <section aria-labelledby="schedule-heading">
      <h2
        id="schedule-heading"
        className="mb-2 font-cond text-xl font-semibold tracking-wide"
      >
        {t.schedule.heading(gw)}
      </h2>
      <p className="mb-2 text-[13px] text-muted">{t.schedule.note}</p>
      <div className="border-t border-line">
        {matches.map((m) => {
          const when = f.kickoff(m.date, m.tsi);
          const played = isPlayed(m);
          const hd = results[m.home]?.diffs[gw - 1];
          const ad = results[m.away]?.diffs[gw - 1];
          const cell = (id: string, diff: number | undefined, align: "right" | "left") => {
            const band = diff != null ? bandOf(diff) : null;
            const on = id === selected;
            return (
              <button
                type="button"
                onClick={() => onSelect(id)}
                className={[
                  "flex min-h-11 min-w-0 items-center gap-1.5 rounded-md px-1 text-left text-sm font-semibold hover:bg-white/5",
                  align === "right" ? "flex-row-reverse text-right" : "",
                  on ? "text-accent" : "",
                ].join(" ")}
              >
                <TeamLogo id={id} size={22} />
                <span className="truncate">{byId[id].name}</span>
                {band && !played ? (
                  <span
                    className="shrink-0 rounded px-1 font-cond text-[12px] tabular-nums"
                    style={{ background: band.fill, color: band.ink }}
                    title={t.picks.difficultyTitle}
                  >
                    {f.n1(diff as number)}
                  </span>
                ) : null}
              </button>
            );
          };
          return (
            <div
              key={`${m.home}-${m.away}`}
              className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 border-b border-line py-1"
            >
              {cell(m.home, hd, "right")}
              <div className="w-[84px] text-center">
                {played ? (
                  <b className="font-cond text-lg font-bold tabular-nums">
                    {m.hg} - {m.ag}
                  </b>
                ) : (
                  <span className="block text-[11px] leading-tight text-muted tabular-nums">
                    {when.date}
                    <br />
                    {when.time ?? <em className="not-italic">{t.fixture.tbd}</em>}
                  </span>
                )}
              </div>
              {cell(m.away, ad, "left")}
            </div>
          );
        })}
      </div>
    </section>
  );
}
