"use client";

import { useI18n } from "@/components/I18nProvider";
import { deadlineOf, fixturesOf, gameweekOf, isPlayed, MATCHDAYS } from "@/lib/data";
import { MAX_HORIZON } from "@/lib/picks";
import { localKickoff } from "@/lib/time";

/** Planlanan hafta, ufuk ve hafta ağırlığı: her şeyin ilk girdisi. */
export function GameweekBar({
  gw,
  horizon,
  weekDecay,
  weekWeights,
  onGwChange,
  onHorizonChange,
  onDecayChange,
}: {
  gw: number;
  horizon: number;
  weekDecay: number;
  weekWeights: number[];
  onGwChange: (gw: number) => void;
  onHorizonChange: (h: number) => void;
  onDecayChange: (d: number) => void;
}) {
  const { t, f, tz } = useI18n();
  const matches = fixturesOf(gw);
  const first = matches[0];
  const last = matches[matches.length - 1];
  const played = gameweekOf[gw]?.finished ?? (matches.length > 0 && matches.every(isPlayed));
  const deadlineAt = deadlineOf(gw);
  const deadline = deadlineAt != null ? localKickoff(deadlineAt, tz) : null;
  const arrow =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-title leading-none hover:bg-surface-2 disabled:opacity-40";
  const weightTotal = weekWeights.reduce((a, b) => a + b, 0);
  const window = weekWeights
    .map((w, i) => ({ md: i + 1, w }))
    .filter((x) => x.w > 0);

  return (
    <section aria-labelledby="gw-heading" className="rounded-xl border border-accent/60 bg-surface p-3">
      <h2 id="gw-heading" className="mb-2 font-cond text-title font-semibold tracking-wide">
        {t.gameweek.heading}
      </h2>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className={arrow}
          onClick={() => onGwChange(gw - 1)}
          disabled={gw <= 1}
          aria-label={t.gameweek.prev}
        >
          ‹
        </button>
        <select
          aria-label={t.gameweek.label}
          value={gw}
          onChange={(e) => onGwChange(Number(e.target.value))}
          className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-line bg-ground px-3 font-cond text-title font-semibold"
        >
          {Array.from({ length: MATCHDAYS }, (_, i) => i + 1).map((md) => {
            const list = fixturesOf(md);
            const done = gameweekOf[md]?.finished ?? (list.length > 0 && list.every(isPlayed));
            return (
              <option key={md} value={md}>
                {t.gameweek.week(md)} · {list[0] ? f.shortDate(list[0].date) : ""}
                {done ? ` · ${t.gameweek.played}` : ""}
              </option>
            );
          })}
        </select>
        <button
          type="button"
          className={arrow}
          onClick={() => onGwChange(gw + 1)}
          disabled={gw >= MATCHDAYS}
          aria-label={t.gameweek.next}
        >
          ›
        </button>
      </div>

      <p className="mt-2 text-label text-muted">
        {first && last ? t.gameweek.range(f.date(first.date), f.date(last.date)) : null}
        {played ? ` · ${t.gameweek.played}` : ""}
        {" — "}
        {deadline
          ? t.gameweek.deadline(`${f.date(deadline.date)} ${deadline.time}`)
          : t.gameweek.deadlineUnknown}
      </p>

      <div className="mt-3 grid gap-2 desk:grid-cols-2 desk:gap-x-4">
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-2.5">
          <label htmlFor="horizon" className="text-body-sm">
            {t.gameweek.horizon.label}
          </label>
          <output
            htmlFor="horizon"
            className="text-right font-cond text-lead font-semibold text-accent tabular-nums"
          >
            {horizon}
          </output>
          <input
            id="horizon"
            type="range"
            min={1}
            max={MAX_HORIZON}
            step={1}
            value={horizon}
            onChange={(e) => onHorizonChange(Number(e.target.value))}
            className="col-span-2 w-full accent-accent"
          />
          <p className="col-span-2 -mt-0.5 text-caption text-muted">{t.gameweek.horizon.note}</p>
        </div>

        <div
          className={`grid grid-cols-[1fr_auto] items-center gap-x-2.5 ${horizon <= 1 ? "opacity-50" : ""}`}
        >
          <label htmlFor="decay" className="text-body-sm">
            {t.gameweek.decay.label}
          </label>
          <output
            htmlFor="decay"
            className="text-right font-cond text-lead font-semibold text-accent tabular-nums"
          >
            {f.num(weekDecay, 2)}
          </output>
          <input
            id="decay"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={weekDecay}
            onChange={(e) => onDecayChange(Number(e.target.value))}
            disabled={horizon <= 1}
            className="col-span-2 w-full accent-accent"
          />
          <p className="col-span-2 -mt-0.5 text-caption text-muted">{t.gameweek.decay.note}</p>
          {window.length > 1 ? (
            <div
              className="col-span-2 mt-1 flex flex-wrap gap-[3px]"
              aria-label={t.gameweek.decay.weights}
              title={t.gameweek.decay.weights}
            >
              {window.map(({ md, w }) => (
                <div
                  key={md}
                  className="min-w-11 rounded-md border border-line bg-ground px-1 py-1 text-center leading-none"
                  style={{ opacity: 0.45 + 0.55 * w }}
                >
                  {/* 10 px'ti: 11 px altı metin bırakılmıyor (erişilebilirlik). */}
                  <small className="block text-micro font-semibold text-muted">
                    {t.gameweek.weekShort(md)}
                  </small>
                  <b className="mt-0.5 block font-cond text-label font-bold tabular-nums">
                    {weightTotal > 0 ? f.pct((100 * w) / weightTotal, 0) : "–"}
                  </b>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
