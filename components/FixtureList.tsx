"use client";

import { Badge } from "@/components/Badges";
import { useI18n } from "@/components/I18nProvider";
import { TeamLogo } from "@/components/TeamLogo";
import { useTheme } from "@/components/PlannerContext";
import { bandOf, bandStyle } from "@/lib/bands";
import { byId, schedule } from "@/lib/data";

/** Seçili takımın maçları: rakip, tarih, saat, rakip gücü, ev/dep, zorluk ya da skor. */
export function FixtureList({
  teamId,
  diffs,
  weeks,
  strength,
  compact = false,
  from = 1,
  to = 34,
}: {
  teamId: string;
  diffs: number[];
  weeks: boolean[];
  strength: Record<string, number>;
  /** Görsel için tek satırlık sürüm: rozetler yok, tarih adın yanında. */
  compact?: boolean;
  /** Gösterilecek hafta aralığı (dahil). */
  from?: number;
  to?: number;
}) {
  const { t, f } = useI18n();
  const theme = useTheme();

  return (
    <div className="mt-3 border-t border-line">
      {schedule[teamId]
        .filter((fx) => fx.md >= from && fx.md <= to)
        .map((fixture) => {
          const i = fixture.md - 1;
          const value = diffs[i];
          const band = bandOf(value);
          const opp = byId[fixture.opp];
          const home = fixture.ha === "E";
          const when = f.kickoff(fixture.date, fixture.tsi);
          const played = fixture.gf != null && fixture.ga != null;
          const score = played ? `${fixture.gf}-${fixture.ga}` : null;
          const outcome = played
            ? (fixture.gf as number) > (fixture.ga as number)
              ? "text-easier"
              : (fixture.gf as number) < (fixture.ga as number)
                ? "text-harder"
                : "text-muted"
            : "";
          if (compact) {
            return (
              <div
                key={fixture.md}
                className={[
                  "grid grid-cols-[22px_22px_minmax(0,1fr)_auto_30px_40px] items-center gap-1.5 border-b border-line py-1.5",
                  weeks[i] ? "" : "opacity-40",
                ].join(" ")}
              >
                <div className="font-cond text-[15px] font-semibold text-muted">{fixture.md}</div>
                <TeamLogo id={fixture.opp} size={22} />
                <b className="truncate text-[13px] font-semibold">{opp.name}</b>
                <span className="text-[11px] text-muted tabular-nums">
                  {score ? <b className={outcome}>{score}</b> : `${when.date} ${when.time ?? ""}`}
                </span>
                <div className="rounded border border-line text-center font-cond text-[12px] font-semibold">
                  {home ? t.fixture.homeLabel : t.fixture.awayLabel}
                </div>
                <div
                  className="rounded-md py-0.5 text-center font-cond text-base font-bold tabular-nums"
                  style={bandStyle(theme, band)}
                >
                  {f.n1(value)}
                </div>
              </div>
            );
          }
          return (
            <div
              key={fixture.md}
              className={[
                "grid grid-cols-[26px_32px_minmax(0,1fr)_auto_52px] items-center gap-2 border-b border-line py-2",
                weeks[i] ? "" : "opacity-45",
              ].join(" ")}
            >
              <div className="font-cond text-lg font-semibold text-muted">{fixture.md}</div>
              <TeamLogo id={fixture.opp} size={32} />
              <div className="min-w-0">
                <b className="block truncate text-base font-semibold">{opp.name}</b>
                <span className="mt-px block text-[12.5px] text-muted tabular-nums">
                  {when.date}{" "}
                  {score ? (
                    <b className={outcome}>{score}</b>
                  ) : (
                    (when.time ?? <em className="not-italic">{t.fixture.tbd}</em>)
                  )}{" "}
                  <Badge title={t.fixture.strengthTitle}>
                    {t.fixture.strengthBadge(f.n1(strength[fixture.opp]))}
                  </Badge>
                </span>
              </div>
              <div
                title={home ? t.fixture.homeTitle : t.fixture.awayTitle}
                className={[
                  "rounded-md border border-line px-2 py-0.5 font-cond text-sm font-semibold",
                  home ? "bg-surface-2" : "",
                ].join(" ")}
              >
                {home ? t.fixture.homeLabel : t.fixture.awayLabel}
              </div>
              <div
                title={t.bands[band.key]}
                className="rounded-lg py-1 text-center font-cond text-xl font-bold tabular-nums"
                style={bandStyle(theme, band)}
              >
                {f.n1(value)}
              </div>
            </div>
          );
        })}
    </div>
  );
}
