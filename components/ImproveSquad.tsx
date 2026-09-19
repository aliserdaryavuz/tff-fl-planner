"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/I18nProvider";
import { PlayerLink } from "@/components/EntityLink";
import type { Player } from "@/lib/fantasy";
import { bankOf, currentSquad, improveSquad } from "@/lib/improve";
import type { PickRow } from "@/lib/picks";

/**
 * Elimdeki gerçek kadrodan bu haftayı yükselten takaslar.
 *
 * Kadro elle girilmiyor: oyunun kendi kaydından okunuyor
 * (`lib/improve.ts` → `data/team-history.json`). Kadro kurucunun kardeşi
 * olduğu için ayrı bölüm değil, kadro sayfasında görünüm anahtarı.
 */
export function ImproveSquad({
  rows,
  benchWeight,
  pending,
}: {
  rows: PickRow[];
  benchWeight: number;
  pending: boolean;
}) {
  const { t, f } = useI18n();
  const s = t.improve;

  const { players, missing } = useMemo(() => currentSquad(), []);
  const plan = useMemo(
    () => improveSquad(players, rows, { bank: bankOf(), benchWeight }),
    [players, rows, benchWeight],
  );

  if (!players.length) {
    return <p className="text-body-sm text-muted">{s.empty}</p>;
  }

  const gain = plan.final.value - plan.current.value;

  return (
    <div className={`grid gap-4 ${pending ? "opacity-60" : ""}`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={s.currentXp} value={f.n1(plan.current.value)} />
        <Stat label={s.afterXp} value={f.n1(plan.final.value)} />
        <Stat label={s.gain} value={`${gain > 0 ? "+" : ""}${f.n1(gain)}`} accent={gain > 0} />
        <Stat label={s.bank} value={f.money(plan.bank)} />
      </div>

      {/* Eksik oyuncu sessizce atlanmıyor: beklenen puanı düşürdüğü yazılı. */}
      {missing.length > 0 && (
        <p className="m-0 rounded-md border border-line bg-surface p-2.5 text-caption text-harder">
          {s.missingNote(missing.length)}
        </p>
      )}

      <section aria-labelledby="improve-swaps">
        <h3 id="improve-swaps" className="heading-sub mb-2">
          {s.swapsHeading}
        </h3>

        {plan.swaps.length === 0 ? (
          <p className="m-0 text-body-sm text-muted">{s.none}</p>
        ) : (
          <ol className="m-0 grid list-none gap-2 p-0">
            {plan.swaps.map((swap, i) => (
              <li
                key={`${swap.out.team}-${swap.out.name}-${i}`}
                className="rounded-md border border-line bg-surface p-2.5"
              >
                <div className="grid gap-1.5 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3">
                  <Side label={s.out} player={swap.out} xp={swap.outXp} />
                  <span aria-hidden className="hidden text-center text-accent sm:block">
                    →
                  </span>
                  <Side label={s.in} player={swap.in} xp={swap.inXp} />
                </div>
                <p className="m-0 mt-1.5 border-t border-line pt-1.5 text-caption text-muted">
                  {s.gain}:{" "}
                  <b className="tabular-nums text-ink">+{f.n1(swap.gain)}</b>
                  {" · "}
                  {s.priceDelta}:{" "}
                  <b className="tabular-nums text-ink">
                    {swap.priceDelta > 0 ? "+" : ""}
                    {f.money(swap.priceDelta)}
                  </b>
                  {" · "}
                  {s.bank}: <b className="tabular-nums text-ink">{f.money(swap.bankAfter)}</b>
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Yöntemin sınırı sayfada kalsın: açgözlü sıra ve satış fiyatı varsayımı. */}
      <p className="m-0 text-caption text-muted">{s.assumptions}</p>
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2">
      <div className="text-caption text-muted">{label}</div>
      <div
        className={`font-cond text-title tabular-nums ${accent ? "text-easier" : "text-ink"}`}
      >
        {value}
      </div>
    </div>
  );
}

function Side({ label, player, xp }: { label: string; player: Player; xp: number }) {
  const { t, f } = useI18n();
  return (
    <div className="min-w-0">
      <div className="text-micro text-muted">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 truncate text-body-sm font-semibold text-ink">
          <PlayerLink player={player} />
        </span>
        <span className="shrink-0 text-caption tabular-nums text-muted">
          {f.n1(xp)} {t.picks.columns.xp}
        </span>
      </div>
    </div>
  );
}
