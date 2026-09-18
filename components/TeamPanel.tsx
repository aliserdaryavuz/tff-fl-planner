"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/Badges";
import { Exportable } from "@/components/Exportable";
import { FantasyList } from "@/components/FantasyList";
import { FixtureList } from "@/components/FixtureList";
import { useI18n } from "@/components/I18nProvider";
import { TeamLogo } from "@/components/TeamLogo";
import { TeamSelect } from "@/components/TeamSelect";
import { useTheme } from "@/components/PlannerContext";
import { bandOf, bandStyle } from "@/lib/bands";
import { byId, computeTable, MATCHDAYS, schedule, teamIds } from "@/lib/data";
import type { ModelKey, TeamResult } from "@/lib/models";

/** Karma güce göre sıra (1 = en güçlü). */
function strengthRank(id: string, strength: Record<string, number>): number {
  return teamIds.filter((other) => strength[other] > strength[id]).length + 1;
}

export function TeamPanel({
  teamId,
  onSelect,
  weeks,
  gw,
  horizon,
  result,
  strength,
  model,
}: {
  teamId: string;
  onSelect: (id: string) => void;
  weeks: boolean[];
  gw: number;
  horizon: number;
  result: TeamResult;
  strength: Record<string, number>;
  model: ModelKey;
}) {
  const { t, f } = useI18n();
  const team = byId[teamId];
  const [all, setAll] = useState(false);
  const table = useMemo(() => computeTable(), []);
  const row = table.find((r) => r.id === teamId);
  const to = Math.min(MATCHDAYS, gw + horizon - 1);

  return (
    <section id="team-panel" aria-labelledby="team-heading">
      <h2 id="team-heading" className="mb-2 font-cond text-xl font-semibold tracking-wide">
        {t.team.heading}
      </h2>

      <div className="flex items-center gap-2.5">
        <TeamLogo id={teamId} size={44} />
        <div className="min-w-0 flex-1">
          <TeamSelect value={teamId} onChange={onSelect} label={t.team.select} />
        </div>
      </div>

      <div className="mt-2.5">
        <Exportable
          title={team.name}
          subtitle={`${t.model[model].name} · ${t.team.strength} ${f.n1(strength[teamId])} · ${t.table.window(gw, to)}`}
          icon={<TeamLogo id={teamId} size={40} />}
          filename={`tff-fl-${teamId.toLowerCase()}`}
          exportChildren={
            <>
              <Badges team={team} strength={strength} tableRow={row} />
              <div className="mt-2.5">
                <Kpis result={result} />
              </div>
              <div className="mt-2.5">
                <WeekCells teamId={teamId} result={result} gw={gw} horizon={horizon} compact />
              </div>
              <FixtureList
                teamId={teamId}
                diffs={result.diffs}
                weeks={weeks}
                strength={strength}
                compact
                from={gw}
                to={to}
              />
            </>
          }
        >
          <Badges team={team} strength={strength} tableRow={row} />

          <div className="mt-3">
            <Kpis result={result} />
          </div>

          <div className="mt-3">
            <WeekCells teamId={teamId} result={result} gw={gw} horizon={horizon} />
          </div>

          <FixtureList
            teamId={teamId}
            diffs={result.diffs}
            weeks={weeks}
            strength={strength}
            from={all ? 1 : gw}
            to={all ? MATCHDAYS : to}
          />
        </Exportable>
      </div>

      <button
        type="button"
        onClick={() => setAll((v) => !v)}
        aria-pressed={all}
        className="mt-2 min-h-11 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium hover:bg-surface-2"
      >
        {all ? t.table.window(gw, to) : t.team.allFixtures}
      </button>
      <p className="mt-2 text-[13px] text-muted">{t.team.windowHint}</p>

      <FantasyList teamId={teamId} />
    </section>
  );
}

function Badges({
  team,
  strength,
  tableRow,
}: {
  team: (typeof byId)[string];
  strength: Record<string, number>;
  tableRow?: { rank: number; pts: number; p: number };
}) {
  const { t, f } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] text-muted">
      <Badge>{t.team.last(team.last)}</Badge>
      {tableRow && tableRow.p > 0 ? (
        <Badge>{t.team.tableRow(tableRow.rank, tableRow.pts, tableRow.p)}</Badge>
      ) : null}
      {team.opta != null ? (
        <span>
          {t.team.opta} <b className="text-ink">{f.n1(team.opta)}</b>
        </span>
      ) : null}
      {team.value != null ? (
        <span title={t.team.squadValueTitle}>
          {t.team.squadValue} <b className="text-ink">{f.euro(team.value)}</b>
        </span>
      ) : null}
      <span>
        {t.team.strength} <b className="text-ink">{f.n1(strength[team.id])}</b>/100
      </span>
      <span>
        {t.team.strengthRank} <b className="text-ink">{strengthRank(team.id, strength)}</b>/18
      </span>
    </div>
  );
}

function Kpis({ result }: { result: TeamResult }) {
  const { t, f } = useI18n();
  return (
    <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-2">
      <Kpi value={f.n1(result.total)} label={t.team.totalWith(result.n)} />
      <Kpi value={f.n2(result.avg)} label={t.team.perMatch} />
      <Kpi value={`${result.rank}.`} label={t.team.rank} accent />
    </div>
  );
}

/** Ufuk penceresindeki haftaların zorluk şeridi. */
function WeekCells({
  teamId,
  result,
  gw,
  horizon,
  compact = false,
}: {
  teamId: string;
  result: TeamResult;
  gw: number;
  horizon: number;
  compact?: boolean;
}) {
  const { t, f } = useI18n();
  const theme = useTheme();
  const cells = schedule[teamId].filter((fx) => fx.md >= gw && fx.md < gw + horizon);
  return (
    <div
      className="grid gap-[3px]"
      style={{ gridTemplateColumns: `repeat(${Math.max(1, cells.length)}, minmax(0, 1fr))` }}
    >
      {cells.map((fixture) => {
        const value = result.diffs[fixture.md - 1];
        const band = bandOf(value);
        return (
          <div
            key={fixture.md}
            title={t.team.weekTitle(
              fixture.md,
              byId[fixture.opp].name,
              fixture.ha === "E" ? t.team.home : t.team.away,
              t.bands[band.key],
            )}
            className={[
              "rounded-md px-0.5 text-center leading-none",
              compact ? "pt-1.5 pb-1" : "pt-[7px] pb-1.5",
            ].join(" ")}
            style={bandStyle(theme, band)}
          >
            <small className="mb-1 block text-[11px] font-semibold opacity-85">
              {t.team.week(fixture.md)}
            </small>
            <b className="font-cond text-[22px] font-bold tabular-nums">{f.n1(value)}</b>
            <em className="mt-[3px] block truncate text-[11px] font-semibold not-italic opacity-85">
              {byId[fixture.opp].name} ({fixture.ha === "E" ? t.fixture.homeLabel : t.fixture.awayLabel})
            </em>
          </div>
        );
      })}
    </div>
  );
}

function Kpi({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl bg-surface px-3 pt-2.5 pb-2">
      <b
        className={[
          "block font-cond text-[40px] leading-none font-bold tabular-nums",
          accent ? "text-accent" : "",
        ].join(" ")}
      >
        {value}
      </b>
      <span className="mt-1 block text-xs text-muted">{label}</span>
    </div>
  );
}
