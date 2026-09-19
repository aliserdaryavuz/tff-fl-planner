"use client";

import { useI18n } from "@/components/I18nProvider";
import { PageHead } from "@/components/PageHead";
import { DEFAULT_PICK_WEIGHTS, DEFAULT_HORIZON, DEFAULT_WEEK_DECAY, PRIOR_MINS } from "@/lib/picks";
import { SCORING } from "@/lib/scoring.mjs";
import { BUDGET, DEFAULT_BENCH_WEIGHT, FORMATION, MAX_PER_CLUB, SQUAD_SIZE } from "@/lib/squad";
import { PRIOR_MATCHES, XG_MIN_MINUTES, XG_WEIGHT } from "@/lib/xp";

/**
 * Yöntem ve sınırlar.
 *
 * Kural: buradaki sayılar **koddan** okunur. Elle yazılmış ikinci bir kopya,
 * sabit değişince sessizce bayatlar ve yöntem sayfası en çok güvenilmesi
 * gereken yerde yanlış bilgi verir.
 *
 * Gezinmeye yedinci sekme eklenmedi; bağlantısı dipnotta, kaynak tablosunun
 * yanında — ikisi de "bu sayılar nereden geliyor" sorusunun cevabı.
 */
export function Methodology() {
  const { t, f } = useI18n();
  const m = t.methodology;

  const scoringRows: [string, string][] = [
    ["appearanceShort", `+${SCORING.appearance.upTo60}`],
    ["appearanceLong", `+${SCORING.appearance.over60}`],
    ["goalGK", `+${SCORING.goal.GK}`],
    ["goalDEF", `+${SCORING.goal.DEF}`],
    ["goalMID", `+${SCORING.goal.MID}`],
    ["goalFWD", `+${SCORING.goal.FWD}`],
    ["assist", `+${SCORING.assist}`],
    ["csGK", `+${SCORING.cleanSheet.GK}`],
    ["csDEF", `+${SCORING.cleanSheet.DEF}`],
    ["csMID", `+${SCORING.cleanSheet.MID}`],
    ["saves", `+1`],
    ["penSave", `+${SCORING.penaltySave}`],
    ["penMiss", `${SCORING.penaltyMiss}`],
    ["conceded", `${SCORING.concededPenalty}`],
    ["yellow", `${SCORING.yellow}`],
    ["red", `${SCORING.red}`],
    ["ownGoal", `${SCORING.ownGoal}`],
    ["bonus", SCORING.bonus.map((b) => `+${b}`).join(" / ")],
    ["captain", `×${SCORING.captain}`],
  ];

  const consts: [string, string][] = [
    ["xgWeight", f.pct(100 * XG_WEIGHT)],
    ["xgMinMinutes", f.num(XG_MIN_MINUTES, 0)],
    ["priorMatches", f.num(PRIOR_MATCHES, 0)],
    ["priorMins", f.num(PRIOR_MINS, 0)],
    ["budget", f.money(BUDGET, 0)],
    ["squadSize", `${SQUAD_SIZE} (${FORMATION.GK}-${FORMATION.DEF}-${FORMATION.MID}-${FORMATION.FWD})`],
    ["maxPerClub", f.num(MAX_PER_CLUB, 0)],
    ["benchWeight", f.n2(DEFAULT_BENCH_WEIGHT)],
    ["horizon", f.num(DEFAULT_HORIZON, 0)],
    ["decay", f.n2(DEFAULT_WEEK_DECAY)],
  ];

  return (
    <div className="grid gap-8">
      <PageHead title={m.heading} lead={m.lead} />

      <section aria-labelledby="method-scoring">
        <h2 id="method-scoring" className="heading-section mb-1">
          {m.scoring.heading}
        </h2>
        <p className="mb-2.5 text-body-sm text-muted">{m.scoring.note}</p>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={m.scoring.heading}>
          <table className="w-full min-w-[320px] border-collapse text-label">
            <thead>
              <tr className="border-b border-line text-left text-caption text-muted">
                <th scope="col" className="py-1.5 pr-2 font-medium">
                  {m.scoring.colWhat}
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  {m.scoring.colPoints}
                </th>
              </tr>
            </thead>
            <tbody>
              {scoringRows.map(([key, value]) => (
                <tr key={key} className="border-b border-line align-baseline">
                  <th scope="row" className="py-1.5 pr-2 font-normal text-ink">
                    {m.scoringRows[key]}
                  </th>
                  <td className="py-1.5 text-right font-semibold tabular-nums text-ink">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Prose id="method-xp" heading={m.xp.heading} body={m.xp.body} />
      <Prose id="method-ranking" heading={m.ranking.heading} body={m.ranking.body} />

      <section aria-labelledby="method-squad">
        <h2 id="method-squad" className="heading-section mb-2">
          {m.squad.heading}
        </h2>
        {m.squad.body.map((p) => (
          <p key={p.slice(0, 24)} className="mt-0 mb-2 text-body-sm">
            {p}
          </p>
        ))}
        {/* Sabitler koddan; sıralama ağırlıkları da varsayılan değerleriyle. */}
        <dl className="m-0 grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {consts.map(([key, value]) => (
            <div key={key} className="flex items-baseline justify-between gap-2 border-b border-line py-1">
              <dt className="min-w-0 text-caption text-muted">{m.consts[key]}</dt>
              <dd className="m-0 shrink-0 text-label font-semibold tabular-nums text-ink">{value}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-2 border-b border-line py-1">
            <dt className="min-w-0 text-caption text-muted">{m.consts.pickWeights}</dt>
            <dd className="m-0 shrink-0 text-label font-semibold tabular-nums text-ink">
              {DEFAULT_PICK_WEIGHTS.model} / {DEFAULT_PICK_WEIGHTS.sel} / {DEFAULT_PICK_WEIGHTS.points}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="method-limits">
        <h2 id="method-limits" className="heading-section mb-2">
          {m.limits.heading}
        </h2>
        <ul className="m-0 grid list-none gap-2 p-0">
          {m.limits.items.map((item) => (
            <li
              key={item.slice(0, 24)}
              className="rounded-md border border-line bg-surface px-3 py-2 text-body-sm"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Prose({ id, heading, body }: { id: string; heading: string; body: readonly string[] }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="heading-section mb-2">
        {heading}
      </h2>
      {body.map((p) => (
        <p key={p.slice(0, 24)} className="mt-0 mb-2 text-body-sm">
          {p}
        </p>
      ))}
    </section>
  );
}
