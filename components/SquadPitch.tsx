"use client";

import { useI18n } from "@/components/I18nProvider";
import { breakdownTitle } from "@/components/PickList";
import { TeamLogo } from "@/components/TeamLogo";
import { ROLE_STYLE } from "@/lib/bands";
import { byId } from "@/lib/data";
import { type Player, playerKey, POSITIONS } from "@/lib/fantasy";
import { formationLabel } from "@/lib/formations";
import type { PickRow } from "@/lib/picks";
import type { Squad } from "@/lib/squad";

/**
 * İlk 11 sahada (kaleci üstte, forvetler altta), yedekler altta bir sırada.
 * Kartta arma, ad, fiyat ve beklenen puan; kaptan sarı K, yardımcı yeşil Y.
 */
export function SquadPitch({
  squad,
  rows,
  locked,
}: {
  squad: Squad;
  rows: PickRow[];
  locked: string[];
}) {
  const { t, f } = useI18n();
  const rowOf = (p: Player) => rows.find((r) => playerKey(r.player) === playerKey(p));

  const card = (p: Player, small = false) => {
    const row = rowOf(p);
    const pinned = locked.includes(playerKey(p));
    const isCaptain = squad.captain && playerKey(squad.captain) === playerKey(p);
    const isVice = squad.vice && playerKey(squad.vice) === playerKey(p);
    const details = [
      byId[p.team].name,
      t.positions[p.pos],
      p.price != null ? f.money(p.price) : null,
      row ? t.picks.start(f.pct(row.startProb * 100, 0)) : null,
      row ? breakdownTitle(row, t, f) : null,
    ]
      .filter(Boolean)
      .join("\n");
    return (
      <div
        key={playerKey(p)}
        title={`${p.name}\n${details}`}
        className={[
          "relative min-w-0 rounded-lg border bg-ground/85 px-1 pt-1.5 pb-1 text-center shadow-md backdrop-blur-[2px]",
          small ? "w-[60px] desk:w-[84px]" : "w-[64px] desk:w-[92px] desk:px-1.5",
          pinned ? "border-accent" : "border-black/40",
        ].join(" ")}
      >
        {isCaptain || isVice ? (
          <span
            className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full font-cond text-[11px] font-bold"
            style={{
              background: isCaptain ? ROLE_STYLE.captain.fill : ROLE_STYLE.vice.fill,
              color: isCaptain ? ROLE_STYLE.captain.ink : ROLE_STYLE.vice.ink,
            }}
            title={isCaptain ? t.squad.captain : t.squad.vice}
          >
            {isCaptain ? t.squad.captainShort : t.squad.viceShort}
          </span>
        ) : null}
        <TeamLogo id={p.team} size={small ? 22 : 28} className="mx-auto block" />
        <b className="mt-1 block truncate text-[11px] leading-tight font-semibold desk:text-[12px]">
          {p.name}
          {p.status === "D" ? (
            <span className="ml-0.5 text-harder" title={t.status.D}>
              ?
            </span>
          ) : null}
        </b>
        <span className="mt-0.5 flex items-baseline justify-center gap-1 text-[11px] leading-tight tabular-nums desk:text-[12px]">
          <span className="font-cond font-bold">{p.price != null ? f.num(p.price, 1) : "–"}</span>
          <span className="font-cond font-bold text-accent">{row ? f.n1(row.score) : ""}</span>
        </span>
      </div>
    );
  };

  return (
    <div>
      <div
        role="group"
        aria-label={t.squad.pitch}
        className="relative overflow-hidden rounded-2xl px-2 py-3 desk:px-4"
        style={{
          background:
            "repeating-linear-gradient(180deg, var(--color-pitch) 0 12.5%, var(--color-pitch-2) 12.5% 25%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-2 rounded-lg border-2 desk:inset-3"
          style={{ borderColor: "var(--color-pitch-line)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-2 left-1/2 h-[14%] w-[44%] -translate-x-1/2 rounded-b-md border-2 border-t-0 desk:top-3"
          style={{ borderColor: "var(--color-pitch-line)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-2 left-1/2 h-[14%] w-[44%] -translate-x-1/2 rounded-t-md border-2 border-b-0 desk:bottom-3"
          style={{ borderColor: "var(--color-pitch-line)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2 left-2 border-t-2 desk:right-3 desk:left-3"
          style={{ borderColor: "var(--color-pitch-line)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 desk:h-24 desk:w-24"
          style={{ borderColor: "var(--color-pitch-line)" }}
        />
        <span className="absolute top-2 left-3 rounded bg-black/40 px-1.5 py-0.5 font-cond text-[12px] font-semibold text-white">
          {t.squad.formation(formationLabel(squad.formation))}
        </span>

        <div className="relative mt-4 grid gap-3 desk:gap-5">
          {POSITIONS.map((pos) => {
            const list = squad.xi.filter((p) => p.pos === pos);
            if (!list.length) return null;
            return (
              <div key={pos} className="flex justify-evenly gap-1 desk:justify-center desk:gap-3">
                {list.map((p) => card(p))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 rounded-xl border border-line bg-surface p-2">
        <div className="mb-1.5 text-xs font-semibold text-muted">{t.squad.bench}</div>
        <div className="flex flex-wrap justify-evenly gap-1 desk:justify-start desk:gap-3">
          {squad.bench.map((p) => card(p, true))}
        </div>
      </div>
    </div>
  );
}
