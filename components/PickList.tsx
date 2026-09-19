"use client";

import { useMemo, useState } from "react";
import { Exportable } from "@/components/Exportable";
import { useI18n } from "@/components/I18nProvider";
import { Segmented } from "@/components/Segmented";
import { TeamLogo } from "@/components/TeamLogo";
import { PlayerLink } from "@/components/EntityLink";
import { useTheme } from "@/components/PlannerContext";
import { bandOf, bandStyle } from "@/lib/bands";
import { byId } from "@/lib/data";
import { hasPrices, POSITIONS, type Position } from "@/lib/fantasy";
import {
  hasLineupData,
  lineupOf,
  lineupsMeta,
  predictedFor,
  predictedMeta,
  predictedXi,
} from "@/lib/lineups";
import {
  DEFAULT_MINUTES_IMPACT,
  DEFAULT_PICK_WEIGHTS,
  officialPerMatch,
  PICK_SIGNALS,
  type PickRow,
  type PickWeights,
  pickShares,
} from "@/lib/picks";

type PosFilter = Position | "ALL";

const PRICE_MIN = 3;
const PRICE_MAX = 20;

/**
 * Oyuncu önerisi: ağırlık kaydırakları + sıralı liste. Ağırlıklar hem bu
 * listeyi hem aşağıdaki haftanın kadrosunu belirler.
 */
export function PickList({
  rows: allRows,
  gw,
  weights,
  onWeightsChange,
  minutesImpact,
  onMinutesImpactChange,
  selInvert,
  onSelInvertChange,
}: {
  rows: PickRow[];
  gw: number;
  weights: PickWeights;
  onWeightsChange: (weights: PickWeights) => void;
  minutesImpact: number;
  onMinutesImpactChange: (value: number) => void;
  selInvert: boolean;
  onSelInvertChange: (value: boolean) => void;
}) {
  const { t, f } = useI18n();
  const [position, setPosition] = useState<PosFilter>("ALL");
  const [minPrice, setMinPrice] = useState(PRICE_MIN);
  const [maxPrice, setMaxPrice] = useState(PRICE_MAX);
  const shares = pickShares(weights);

  const setFloor = (v: number) => {
    setMinPrice(v);
    if (v > maxPrice) setMaxPrice(v);
  };
  const setCeiling = (v: number) => {
    setMaxPrice(v);
    if (v < minPrice) setMinPrice(v);
  };

  const rows = useMemo(
    () =>
      allRows
        .filter((r) => position === "ALL" || r.player.pos === position)
        .filter(
          (r) =>
            !hasPrices ||
            r.player.price == null ||
            (r.player.price >= minPrice && r.player.price <= maxPrice),
        )
        .slice(0, 25),
    [allRows, position, minPrice, maxPrice],
  );

  const posOptions: { value: PosFilter; label: string }[] = [
    { value: "ALL", label: t.picks.all },
    ...POSITIONS.map((p) => ({ value: p as PosFilter, label: t.positions[p] })),
  ];

  return (
    <section aria-labelledby="picks-heading">
      <h2 id="picks-heading" className="mb-2 font-cond text-title font-semibold tracking-wide">
        {t.picks.heading}
      </h2>

      <p className="mb-2 text-label text-muted">
        {t.picks.note}{" "}
        {hasLineupData && lineupsMeta.fetched
          ? t.picks.source(lineupsMeta.source, f.date(lineupsMeta.fetched), lineupsMeta.matchesPerTeam)
          : t.picks.missing}
        {predictedMeta.fetched && Object.keys(predictedXi).length
          ? ` ${t.picks.predictedSource(predictedMeta.source, f.date(predictedMeta.fetched), Object.keys(predictedXi).length)}`
          : ""}
      </p>

      <div className="grid gap-1.5 rounded-lg border border-line p-2">
        <p className="text-caption text-muted">{t.pickWeights.note}</p>
        {PICK_SIGNALS.map((key) => {
          const id = `pick-weight-${key}`;
          const copy = t.pickWeights.signals[key];
          return (
            <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-x-2.5">
              <label htmlFor={id} className="text-body-sm">
                {copy.label}
              </label>
              <output
                htmlFor={id}
                className="text-right font-cond text-lead font-semibold text-accent tabular-nums"
              >
                {f.pct(shares[key], 0)}
              </output>
              <input
                id={id}
                type="range"
                min={0}
                max={100}
                step={5}
                value={weights[key] ?? 0}
                onChange={(e) => onWeightsChange({ ...weights, [key]: Number(e.target.value) })}
                className="col-span-2 w-full accent-accent"
              />
              <p className="col-span-2 -mt-0.5 text-caption text-muted">{copy.note}</p>
              {key === "sel" ? (
                <>
                  <label className="col-span-2 flex min-h-9 items-center gap-2 text-label">
                    <input
                      type="checkbox"
                      checked={selInvert}
                      onChange={(e) => onSelInvertChange(e.target.checked)}
                      className="h-4 w-4 accent-accent"
                    />
                    {t.pickWeights.invert}
                  </label>
                  <p className="col-span-2 -mt-1 text-caption text-muted">{t.pickWeights.invertNote}</p>
                </>
              ) : null}
            </div>
          );
        })}

        <div className="grid grid-cols-[1fr_auto] items-center gap-x-2.5 border-t border-line pt-1.5">
          <label htmlFor="pick-minutes" className="text-body-sm">
            {t.pickWeights.minutes.label}
          </label>
          <output
            htmlFor="pick-minutes"
            className="text-right font-cond text-lead font-semibold text-accent tabular-nums"
          >
            {f.num(minutesImpact, 2)}
          </output>
          <input
            id="pick-minutes"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={minutesImpact}
            onChange={(e) => onMinutesImpactChange(Number(e.target.value))}
            className="col-span-2 w-full accent-accent"
          />
          <p className="col-span-2 -mt-0.5 text-caption text-muted">{t.pickWeights.minutes.note}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            onWeightsChange(DEFAULT_PICK_WEIGHTS);
            onMinutesImpactChange(DEFAULT_MINUTES_IMPACT);
            onSelInvertChange(false);
          }}
          className="min-h-11 justify-self-start rounded-lg border border-line bg-surface px-3 text-label font-medium hover:bg-surface-2"
        >
          {t.pickWeights.reset}
        </button>
      </div>

      <div className="mt-2">
        <Segmented
          label={t.picks.positionLabel}
          size="sm"
          wrap
          value={position}
          options={posOptions}
          onChange={setPosition}
        />
      </div>

      {hasPrices ? (
        <div className="mt-2 grid gap-1.5 desk:grid-cols-2 desk:gap-x-4">
          <PriceSlider id="pick-floor" label={t.picks.floor} value={minPrice} onChange={setFloor} money={f.money} />
          <PriceSlider id="pick-ceiling" label={t.picks.budget} value={maxPrice} onChange={setCeiling} money={f.money} />
        </div>
      ) : null}

      <div className="mt-2">
        <Exportable
          title={t.picks.heading}
          subtitle={`${t.gameweek.week(gw)} · ${position === "ALL" ? t.picks.all : t.positions[position]} · ${t.picks.topN(EXPORT_ROWS)}`}
          filename={`tff-fl-picks-gw${gw}`}
          exportChildren={
            <>
              <PickHeader />
              <div className="border-t border-line">
                {rows.slice(0, EXPORT_ROWS).map((row, i) => (
                  <PickRowView key={`${row.player.team}-${row.player.name}`} row={row} rank={i + 1} compact />
                ))}
              </div>
            </>
          }
        >
          <PickHeader />
          <div className="border-t border-line">
            {rows.map((row, i) => (
              <PickRowView key={`${row.player.team}-${row.player.name}`} row={row} rank={i + 1} />
            ))}
            {rows.length === 0 ? <p className="py-3 text-label text-muted">{t.picks.empty}</p> : null}
          </div>
        </Exportable>
      </div>
    </section>
  );
}

/** Görselde ekrana sığsın diye ilk 12 satır. */
const EXPORT_ROWS = 12;

const ROW_GRID =
  "grid-cols-[22px_minmax(0,1fr)_44px_46px_40px] desk:grid-cols-[26px_minmax(0,1fr)_52px_56px_48px]";

function PickHeader() {
  const { t } = useI18n();
  return (
    <div className={`grid ${ROW_GRID} gap-1.5 px-1 pb-1.5 text-caption text-muted`}>
      <span>{t.picks.columns.rank}</span>
      <span>{t.picks.columns.player}</span>
      <span className="text-right">{t.picks.columns.price}</span>
      <span className="text-right" title={t.picks.columns.xpTitle}>
        {t.picks.columns.xp}
      </span>
      <span className="text-right" title={t.picks.columns.scoreTitle}>
        {t.picks.columns.score}
      </span>
    </div>
  );
}

/** Beklenen puanın kalem kalem dökümü; title metni. */
export function breakdownTitle(row: PickRow, t: ReturnType<typeof useI18n>["t"], f: ReturnType<typeof useI18n>["f"]): string {
  const b = t.picks.breakdown;
  const lines: string[] = [];
  for (const w of row.detail.weeks) {
    if (!w.fixture || !w.xp) {
      lines.push(t.picks.noFixture(w.md));
      continue;
    }
    lines.push(
      t.picks.weekXp(
        w.md,
        byId[w.fixture.opp].name,
        w.fixture.ha === "E" ? t.fixture.homeLabel : t.fixture.awayLabel,
        f.n2(w.xp.total),
      ),
    );
  }
  const first = row.detail.weeks.find((w) => w.xp)?.xp;
  if (first) {
    lines.push(
      [
        `${b.appearance} ${f.n2(first.appearance)}`,
        `${b.goals} ${f.n2(first.goals)}`,
        `${b.assists} ${f.n2(first.assists)}`,
        `${b.cleanSheet} ${f.n2(first.cleanSheet)}`,
        `${b.conceded} ${f.n2(first.conceded)}`,
        first.saves ? `${b.saves} ${f.n2(first.saves)}` : null,
        `${b.cards} ${f.n2(first.cards)}`,
        `${b.bonus} ${f.n2(first.bonus)}`,
      ]
        .filter(Boolean)
        .join(" · "),
    );
    lines.push(b.lambda(f.n2(first.lambdaFor), f.n2(first.lambdaAgainst), f.num(100 * first.pCleanSheet, 0)));
  }
  return lines.join("\n");
}

/** Her ölçütün oyuncu havuzundaki 0-100 karşılığı; skor sütununun ipucu. */
function signalTitle(
  row: PickRow,
  t: ReturnType<typeof useI18n>["t"],
  f: ReturnType<typeof useI18n>["f"],
): string {
  const value = { model: row.modelScore, sel: row.selScore, points: row.pointsScore };
  return PICK_SIGNALS.map(
    (key) => `${t.pickWeights.signals[key].label}: ${f.num(value[key], 0)}/100`,
  ).join("\n");
}

/** Tek oyuncu satırı; `compact` görselde ikinci satırı tek satıra indirir. */
function PickRowView({ row, rank, compact = false }: { row: PickRow; rank: number; compact?: boolean }) {
  const { t, f } = useI18n();
  const theme = useTheme();
  const band = bandOf(row.avgDifficulty);
  const s = row.detail.summary;
  const ppm = officialPerMatch(row.player);
  return (
    <div
      className={`grid ${ROW_GRID} items-center gap-1.5 border-b border-line ${compact ? "py-1.5" : "py-2"}`}
      title={compact ? undefined : breakdownTitle(row, t, f)}
    >
      <div className="text-right font-cond text-body font-semibold text-muted tabular-nums">{rank}</div>

      <div className="min-w-0">
        <b className="block truncate text-body-sm font-semibold">
          {/* Görsel dışa aktarmada düz metne düşüyor (EntityLink): kaydedilen
              resimde altı çizili bağlantı olmaz. */}
          <PlayerLink player={row.player} />
          {row.player.status === "D" ? (
            <em className="ml-1.5 text-caption font-normal text-harder not-italic">{t.status.D}</em>
          ) : null}
        </b>
        <span className="mt-px flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-caption text-muted">
          <span className="inline-flex shrink-0 items-center gap-1">
            <TeamLogo id={row.player.team} size={16} />
            {byId[row.player.team].name}
          </span>
          <span
            title={t.picks.difficultyTitle}
            className="shrink-0 rounded px-1 font-semibold tabular-nums"
            style={bandStyle(theme, band)}
          >
            {f.n1(row.avgDifficulty)}
          </span>
          <span className="shrink-0">{t.positionsShort[row.player.pos]}</span>
          <StartChip row={row} />
        </span>
      </div>

      <div className="text-right font-cond text-lead font-bold tabular-nums">
        {row.player.price != null ? f.num(row.player.price, 1) : <span className="text-muted">–</span>}
      </div>

      <div
        className="text-right text-label text-muted tabular-nums"
        title={[
          t.picks.official(
            row.player.pts,
            row.player.mins,
            f.n1(row.player.form ?? 0),
            f.pct(row.player.sel ?? 0, 1),
          ),
          ppm != null ? `${t.picks.columns.ppm}: ${f.n1(ppm)}` : null,
          s.matches ? t.picks.per90Title(s.fantasyPoints, s.minutes, s.matches) : null,
          row.player.news ? t.picks.news(row.player.news) : null,
        ]
          .filter(Boolean)
          .join("\n")}
      >
        {f.n1(row.xp)}
      </div>

      <div
        className="text-right font-cond text-lead font-bold text-accent tabular-nums"
        title={signalTitle(row, t, f)}
      >
        {f.n1(row.score)}
      </div>
    </div>
  );
}

/** "%78 başlar" — son maçlardaki ilk 11 ve dakika bilgisi title'da. */
export function StartChip({ row }: { row: PickRow }) {
  const { t, f } = useI18n();
  const player = row.player;
  const info = lineupOf(player);
  const n = info?.recent.length ?? 0;
  const predicted = predictedFor(player);
  const title = [
    n
      ? t.picks.startTitle(
          info!.recent.filter((m) => m.started).length,
          n,
          Math.round(info!.recent.reduce((s, m) => s + m.minutes, 0) / n),
        )
      : t.picks.startUnknown,
    predicted.confirmed === "start"
      ? t.picks.confirmedStart
      : predicted.confirmed === "out"
        ? t.picks.confirmedOut
        : predicted.sources > 0
          ? t.picks.predictedIn(predicted.listed, predicted.sources)
          : null,
    predicted.unavailable ? t.picks.predictedUnavailable : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const tone = row.startProb >= 0.7 ? "text-easier" : row.startProb >= 0.4 ? "text-muted" : "text-harder";
  return (
    <span className={`shrink-0 tabular-nums ${tone}`} title={title}>
      {t.picks.start(f.pct(row.startProb * 100, 0))}
    </span>
  );
}

function PriceSlider({
  id,
  label,
  value,
  onChange,
  money,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  money: (x: number) => string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-2.5">
      <label htmlFor={id} className="text-body-sm">
        {label}
      </label>
      <output htmlFor={id} className="text-right font-cond text-lead font-semibold text-accent tabular-nums">
        {money(value)}
      </output>
      <input
        id={id}
        type="range"
        min={PRICE_MIN}
        max={PRICE_MAX}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="col-span-2 w-full accent-accent"
      />
    </div>
  );
}
