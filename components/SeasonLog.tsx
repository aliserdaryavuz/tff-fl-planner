"use client";

import { useI18n } from "@/components/I18nProvider";
import { PageHead } from "@/components/PageHead";
import { byId } from "@/lib/data";
import {
  isComplete,
  playedWeeks,
  seasonTeam,
  type SeasonWeek,
  splitSquad,
  type SquadEntry,
  topContributors,
} from "@/lib/season-log";

/**
 * Sezon günlüğü: kullanıcının kendi takımının hafta hafta gerçek geçmişi.
 *
 * Elle giriş yok — veri oyunun kendi API'sinden geliyor
 * (`scripts/fetch-team-history.mjs`). Resmî puan yeniden hesaplanmıyor;
 * bizim topladığımız sayı yanında duruyor ve fark açıkça yazılıyor.
 *
 * Hafta başına tablo satırı değil kart: satır sayısı değil sütun sayısı fazla
 * (puan, ortalama, en yüksek, iki sıra, transfer, yedek) ve telefonda yatay
 * kaydırmaya zorluyordu.
 */
export function SeasonLog() {
  const { t, f } = useI18n();

  if (!playedWeeks.length) {
    return (
      <div className="grid gap-6">
        <PageHead title={t.season.heading} lead={t.season.note} />
        <p className="text-body-sm text-muted">{t.season.empty}</p>
      </div>
    );
  }

  const top = topContributors();

  return (
    <div className="grid gap-6">
      <PageHead title={t.season.heading} lead={t.season.note} />

      {/* Takım özeti: oyunun verdiği toplamlar, hesaplanan değil. */}
      <section aria-labelledby="season-team">
        <h2 id="season-team" className="heading-section mb-2.5">
          {seasonTeam.name}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label={t.season.totalPoints} value={f.num(seasonTeam.totalPoints, 0)} big />
          <Stat label={t.season.overallRank} value={f.num(seasonTeam.totalRank, 0)} />
          <Stat label={t.season.teamValue} value={f.money(seasonTeam.teamValue)} />
        </div>
      </section>

      {/* Farkın açıklaması bir kez, kapalı: her hafta tekrar etmesin ama
          kullanıcı sayıyı sorgularsa hemen elinin altında olsun. */}
      <details className="group rounded-md border border-line bg-surface p-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-label font-semibold text-ink [&::-webkit-details-marker]:hidden">
          <span className="text-accent transition-transform group-open:rotate-90">▸</span>
          {t.season.gapHeading}
        </summary>
        <p className="mt-2 text-body-sm text-muted">{t.season.gapNote}</p>
      </details>

      <section aria-labelledby="season-weeks" className="grid gap-3">
        <h2 id="season-weeks" className="heading-section">
          {t.season.weeks}
        </h2>
        {playedWeeks.map((w) => (
          <WeekCard key={w.gw} week={w} />
        ))}
      </section>

      {top.length > 0 && (
        <section aria-labelledby="season-top">
          <h2 id="season-top" className="heading-section mb-1">
            {t.season.topHeading}
          </h2>
          <p className="mb-2.5 text-caption text-muted">{t.season.topNote}</p>
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {top.map((p) => (
              <li
                key={p.id}
                className="flex items-baseline justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2"
              >
                <span className="min-w-0 truncate text-body-sm font-semibold text-ink">{p.name}</span>
                <span className="shrink-0 text-caption text-muted">
                  {t.season.contributorWeeks(p.weeks)}
                </span>
                <span className="shrink-0 text-body font-semibold tabular-nums text-ink">
                  {f.num(p.points, 0)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2">
      <div className="text-caption text-muted">{label}</div>
      <div className={`font-cond tabular-nums text-ink ${big ? "text-stat" : "text-title"}`}>{value}</div>
    </div>
  );
}

function WeekCard({ week }: { week: SeasonWeek }) {
  const { t, f } = useI18n();
  const { starting, bench } = splitSquad(week);
  const done = isComplete(week.gw);

  return (
    <article className="rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="heading-sub m-0">
          {t.season.week(week.gw)}
          {!done && (
            // Oynanmakta olan haftada sayılar oturmamış: aynı gün iki ölçüm
            // farklı fark verdi. Kesin sayı gibi sunulmasın.
            <span className="ml-2 align-middle text-caption font-normal text-accent">
              {t.season.inProgress}
            </span>
          )}
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="font-cond text-stat tabular-nums text-ink">{f.num(week.official.points, 0)}</span>
          <span className="text-caption text-muted">{t.season.points}</span>
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-caption sm:grid-cols-3">
        <Pair label={t.season.average} value={f.n1(week.official.avgPoints)} />
        <Pair label={t.season.highest} value={f.num(week.official.highestPoints, 0)} />
        <Pair label={t.season.weeklyRank} value={f.num(week.official.weeklyRank, 0)} />
        <Pair label={t.season.overallAfter} value={f.num(week.official.overallRank, 0)} />
        <Pair label={t.season.transfers} value={f.num(week.official.transfers, 0)} />
        <Pair label={t.season.benchPoints} value={f.num(week.official.bench, 0)} />
      </dl>

      {/* Kendi toplamımız ve fark: resmî sayının yerine geçmiyor, yanında. */}
      <p className="mt-2 border-t border-line pt-2 text-caption text-muted">
        {t.season.ourSum}: <b className="tabular-nums text-ink">{f.num(week.sumWithCaptain, 0)}</b>
        {" · "}
        {t.season.gap}:{" "}
        <b className="tabular-nums text-ink">
          {week.gapVsOfficial > 0 ? "+" : ""}
          {f.num(week.gapVsOfficial, 0)}
        </b>
      </p>

      <details className="group mt-2">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-label font-semibold text-ink [&::-webkit-details-marker]:hidden">
          <span className="text-accent transition-transform group-open:rotate-90">▸</span>
          {t.season.squadHeading(week.gw)}
          {week.formation && <span className="font-normal text-muted">{week.formation}</span>}
        </summary>
        <div className="mt-2 grid gap-3">
          <SquadList heading={t.season.starting} players={starting} />
          <SquadList heading={t.season.benchHeading} players={bench} />
        </div>
      </details>
    </article>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line/60 py-0.5">
      <dt className="min-w-0 truncate text-muted">{label}</dt>
      <dd className="m-0 shrink-0 tabular-nums font-semibold text-ink">{value}</dd>
    </div>
  );
}

function SquadList({ heading, players }: { heading: string; players: SquadEntry[] }) {
  const { t } = useI18n();
  if (!players.length) return null;

  return (
    <div>
      <h4 className="m-0 mb-1 text-label font-semibold text-muted">{heading}</h4>
      <ul className="m-0 grid list-none gap-1 p-0">
        {players.map((p) => (
          <li key={`${p.id}-${p.slot}`} className="rounded-md bg-surface-2 px-2.5 py-1.5">
            <div className="flex items-baseline gap-2">
              <span className="w-9 shrink-0 font-cond text-caption font-semibold tracking-wide text-muted">
                {p.pos}
              </span>
              <span className="min-w-0 flex-1 truncate text-body-sm text-ink">
                {/* Ad eşleşmediyse kimlik gösteriliyor; uydurma ad yazılmıyor. */}
                {p.name ?? `#${p.id}`}
                {p.captain && <Badge>{t.season.captainMark}</Badge>}
                {p.vice && <Badge>{t.season.viceMark}</Badge>}
                {/* Oyuncu dosyasındaki `team` alanı takım KİMLİĞİ ("Besiktas");
                    görünen ad `byId`den gelir, yoksa kimlik olduğu gibi kalır. */}
                {p.team && (
                  <span className="ml-1.5 text-caption text-muted">
                    {byId[p.team]?.name ?? p.team}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-body-sm font-semibold tabular-nums text-ink">{p.points}</span>
            </div>
            {p.status !== "PLAYED" ? (
              <p className="m-0 mt-0.5 pl-11 text-micro text-muted">{t.season.didNotPlay}</p>
            ) : (
              p.breakdown.length > 0 && (
                <p className="m-0 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 pl-11 text-micro text-muted">
                  {p.breakdown.map((e, i) => (
                    <span key={`${e.type}-${i}`}>
                      {t.season.eventNames[e.type] ?? e.type}
                      {e.count > 1 ? ` ×${e.count}` : ""}{" "}
                      <b className={e.pts < 0 ? "text-harder" : "text-ink"}>
                        {e.pts > 0 ? "+" : ""}
                        {e.pts}
                      </b>
                    </span>
                  ))}
                </p>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 rounded-sm bg-accent px-1 text-micro font-bold text-accent-ink">
      {children}
    </span>
  );
}
