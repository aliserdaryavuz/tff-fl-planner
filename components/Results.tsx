"use client";

import { useMemo, useState } from "react";
import { TeamLink } from "@/components/EntityLink";
import { useI18n } from "@/components/I18nProvider";
import { PageHead } from "@/components/PageHead";
import { usePlanner } from "@/components/PlannerContext";
import { Segmented } from "@/components/Segmented";
import { Standings } from "@/components/Standings";
import { TeamLogo } from "@/components/TeamLogo";
import { byId, MATCHDAYS, teamIds } from "@/lib/data";
import {
  disciplineOf,
  goalsOf,
  type MatchResult,
  type MatchSide,
  resultsMeta,
  seasonFixtures,
} from "@/lib/results";

/**
 * Sonuçlar ve puan durumu.
 *
 * 34 haftanın tamamı tek akışta okutulmuyor: varsayılan görünüm planlanan
 * hafta, yanında "tüm haftalar" ve takım filtresi var. Puan durumu ayrı
 * sekmede ve mevcut `Standings` bileşeninden geliyor — tablo `computeTable()`
 * ile oyunun skorlarından hesaplanıyor, burada ikinci bir hesap yok.
 */
export function Results() {
  // `f` burada gerekmiyor: biçimlendirme iç bileşenlerde, kendi useI18n'leriyle.
  const { t } = useI18n();
  const { state, setState } = usePlanner();
  const [tab, setTab] = useState<"fixtures" | "table">("fixtures");
  // Varsayılan, planlanan hafta DEĞİL: **tamamlanmış** son hafta.
  //
  // Planlanan hafta henüz oynanmadığı için sayfa boşa yakın açılıyordu. İlk
  // düzeltmem "sonucu olan son hafta" demişti ama o da aynı haftayı veriyor:
  // 6. haftanın tek maçı oynanmış durumda (1/9), yani "sonucu var" sayılıyor.
  // Ölçülen dağılım: 1-5. haftalar 9/9, 6. hafta 1/9.
  const lastPlayed = useMemo(() => {
    const full = seasonFixtures.filter((w) => w.matches.length > 0 && w.played === w.matches.length);
    if (full.length) return full[full.length - 1].md;
    const any = seasonFixtures.filter((w) => w.played > 0);
    return any.length ? any[any.length - 1].md : 1;
  }, []);
  const [md, setMd] = useState<number>(lastPlayed);
  const [team, setTeam] = useState<string>("");

  const weeks = useMemo(
    () =>
      seasonFixtures
        .filter((w) => !md || w.md === md)
        .map((w) => ({
          ...w,
          matches: team ? w.matches.filter((m) => m.home === team || m.away === team) : w.matches,
        }))
        .filter((w) => w.matches.length),
    [md, team],
  );

  const clubs = useMemo(
    () => [...teamIds].sort((a, b) => byId[a].name.localeCompare(byId[b].name, "tr")),
    [],
  );

  const shown = weeks.reduce((n, w) => n + w.matches.length, 0);

  return (
    <div className="grid gap-6">
      <PageHead title={t.results.heading} lead={t.results.note} />

      <Segmented
        label={t.results.viewLabel}
        value={tab}
        options={[
          { value: "fixtures" as const, label: t.results.fixtures },
          { value: "table" as const, label: t.results.table },
        ]}
        onChange={setTab}
      />

      {tab === "table" ? (
        <Standings
          selected={state.team}
          onSelect={(id) => setState((s) => ({ ...s, team: id }))}
        />
      ) : (
        <>
          <div className="grid gap-2 rounded-lg border border-line p-2 desk:grid-cols-2">
            <div className="grid gap-1">
              <label htmlFor="results-md" className="text-body-sm font-semibold">
                {t.results.matchdayLabel}
              </label>
              <select
                id="results-md"
                value={md}
                onChange={(e) => setMd(Number(e.target.value))}
                className="min-h-11 w-full rounded-lg border border-line bg-ground px-2.5 text-body-sm"
              >
                <option value={0}>{t.results.allMatchdays}</option>
                {Array.from({ length: MATCHDAYS }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {t.results.matchday(n)}
                    {n === state.gw ? ` — ${t.results.currentMark}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label htmlFor="results-team" className="text-body-sm font-semibold">
                {t.results.teamLabel}
              </label>
              <select
                id="results-team"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-line bg-ground px-2.5 text-body-sm"
              >
                <option value="">{t.results.allTeams}</option>
                {clubs.map((id) => (
                  <option key={id} value={id}>
                    {byId[id].name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="m-0 text-label text-muted">
            {t.results.showing(
              md ? t.results.matchday(md) : t.results.allMatchdays,
              team ? byId[team].name : t.results.allTeams,
              shown,
            )}
          </p>

          {weeks.length ? (
            <div className="grid gap-6">
              {weeks.map((week) => (
                <section key={week.md} aria-labelledby={`md-${week.md}`}>
                  <h2
                    id={`md-${week.md}`}
                    className="mb-2 flex flex-wrap items-baseline gap-x-2 font-cond text-title font-semibold tracking-wide"
                  >
                    {t.results.matchday(week.md)}
                    <span className="text-label font-normal text-muted">
                      {week.played === 0
                        ? t.results.notPlayed
                        : week.played === week.matches.length
                          ? t.results.allPlayed
                          : t.results.somePlayed(week.played, week.matches.length)}
                    </span>
                  </h2>
                  <div className="border-t border-line">
                    {week.matches.map((m) =>
                      m.result ? (
                        <Played key={`${m.home}-${m.away}`} match={m.result} />
                      ) : (
                        <div
                          key={`${m.home}-${m.away}`}
                          className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-line py-2 text-label"
                        >
                          <Side team={m.home} align="right" />
                          <Kickoff date={m.date} tsi={m.tsi} />
                          <Side team={m.away} align="left" />
                        </div>
                      ),
                    )}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="m-0 text-label text-muted">{t.results.empty}</p>
          )}
        </>
      )}

      <p className="m-0 text-caption text-muted">
        {t.results.source(resultsMeta.source, resultsMeta.fetched)}
      </p>
    </div>
  );
}

function Kickoff({ date, tsi }: { date: string; tsi: string | null }) {
  const { f } = useI18n();
  const when = f.kickoff(date, tsi);
  return (
    <span className="text-center text-muted tabular-nums">
      {when.date} {when.time ?? ""}
    </span>
  );
}

function Side({ team, align }: { team: string; align: "left" | "right" }) {
  return (
    <span
      className={`flex min-w-0 items-center gap-1.5 ${align === "right" ? "justify-end" : ""}`}
    >
      {align === "right" ? null : <TeamLogo id={team} size={20} />}
      <span className="min-w-0 truncate font-semibold">{byId[team].name}</span>
      {align === "right" ? <TeamLogo id={team} size={20} /> : null}
    </span>
  );
}

/** Oynanmış maç: skor görünür, ayrıntı dokununca açılır. */
function Played({ match }: { match: MatchResult }) {
  const { t, f } = useI18n();
  const goals = goalsOf(match);
  const discipline = disciplineOf(match);
  // Skor oyunun verisinden gelmemiş olabilir (donmuş besleme); o zaman saat.
  const scored = match.hg != null && match.ag != null;

  return (
    <details className="group border-b border-line">
      <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 py-2 text-label [&::-webkit-details-marker]:hidden">
        <Side team={match.home} align="right" />
        {scored ? (
          <span className="rounded-md bg-surface-2 px-2 py-0.5 text-center font-cond text-lead font-bold tabular-nums">
            {match.hg}–{match.ag}
          </span>
        ) : (
          <Kickoff date={match.date} tsi={match.tsi} />
        )}
        <Side team={match.away} align="left" />
      </summary>

      <div className="grid gap-3 pb-3">
        <p className="m-0 text-caption text-muted">
          {f.date(match.date)}
          <span className="ml-2 text-accent group-open:hidden">{t.results.open}</span>
        </p>

        {goals.length ? (
          <ul className="m-0 grid list-none gap-1 p-0 text-label">
            {goals.map((g, i) => (
              <li key={i} className="grid grid-cols-[34px_minmax(0,1fr)] items-baseline gap-2">
                <span className="text-right text-muted tabular-nums">{g.min}&#39;</span>
                <span className="min-w-0">
                  <TeamLogo
                    id={g.home ? match.home : match.away}
                    size={14}
                    className="mr-1.5 align-[-2px]"
                  />
                  <b className="font-semibold">{g.player}</b>
                  {g.own ? (
                    <em className="ml-1.5 text-caption not-italic text-harder">{t.results.ownGoal}</em>
                  ) : null}
                  {g.how === "penalty" ? (
                    <em className="ml-1.5 text-caption not-italic text-muted">{t.results.penalty}</em>
                  ) : null}
                  {g.how === "direct_free_kick" ? (
                    <em className="ml-1.5 text-caption not-italic text-muted">{t.results.freeKick}</em>
                  ) : null}
                  {g.assist ? (
                    <span className="ml-1.5 text-muted">
                      {t.results.assist} <b className="font-semibold">{g.assist}</b>
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-label text-muted">{t.results.noGoals}</p>
        )}

        {discipline.length ? (
          <ul className="m-0 grid list-none gap-1 p-0 text-caption text-muted">
            {discipline.map((e, i) => (
              <li key={i} className="grid grid-cols-[34px_minmax(0,1fr)] items-baseline gap-2">
                <span className="text-right tabular-nums">{e.min}&#39;</span>
                <span className="min-w-0">
                  <TeamLogo
                    id={e.home ? match.home : match.away}
                    size={12}
                    className="mr-1.5 align-[-1px]"
                  />
                  {e.player}
                  <em className="ml-1.5 not-italic">
                    {e.kind === "card"
                      ? (t.results.cards[e.card ?? "Yellow"] ?? "")
                      : t.results.missedPenalty}
                  </em>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {match.potm ? (
          <p className="m-0 text-label">
            <span className="text-muted">{t.results.potm}: </span>
            <b className="font-semibold">{match.potm.name}</b>
            {match.potm.rating != null ? (
              <span className="ml-1.5 font-cond font-bold text-accent tabular-nums">
                {f.n1(match.potm.rating)}
              </span>
            ) : null}
          </p>
        ) : null}

        {match.lineups ? (
          <div className="grid gap-3 desk:grid-cols-2">
            <Lineup side={match.lineups.home} team={match.home} />
            <Lineup side={match.lineups.away} team={match.away} />
          </div>
        ) : (
          <p className="m-0 text-caption text-muted">{t.results.lineupsMissing}</p>
        )}
      </div>
    </details>
  );
}

function Lineup({ side, team }: { side: MatchSide | null; team: string }) {
  const { t } = useI18n();
  if (!side) return null;
  const used = side.subs.filter((p) => p.minutes > 0);
  return (
    <div>
      {/* Kulüp adı burada bağlantı: maç satırındaki `Side` `<summary>` içinde ve
          oraya bağlantı koymak tıklamayı hem gezinme hem panel açma yapardı. */}
      <h3 className="mt-0 mb-1 flex items-center gap-1.5 font-cond text-body font-semibold tracking-wide">
        <TeamLogo id={team} size={16} />
        <TeamLink team={team} />
        {side.formation ? (
          <span className="text-label font-normal text-muted">{side.formation}</span>
        ) : null}
      </h3>
      <ul className="m-0 grid list-none gap-0.5 p-0 text-label">
        {side.starters.map((p) => (
          <li key={p.id} className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate">{p.name}</span>
            <span className="shrink-0 text-muted tabular-nums">{p.minutes}&#39;</span>
          </li>
        ))}
      </ul>
      {used.length ? (
        <>
          <p className="mt-2 mb-0.5 text-caption text-muted">{t.results.subs}</p>
          <ul className="m-0 grid list-none gap-0.5 p-0 text-label text-muted">
            {used.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate">{p.name}</span>
                <span className="shrink-0 tabular-nums">{p.minutes}&#39;</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
