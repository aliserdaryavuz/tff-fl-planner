"use client";

import { PlayerLink } from "@/components/EntityLink";
import { useI18n } from "@/components/I18nProvider";
import { byId } from "@/lib/data";
import { fantasyMeta, playersByTeam, playersOf, POSITIONS } from "@/lib/fantasy";
import { BUDGET } from "@/lib/squad";

/**
 * Seçili takımın oyuncuları, mevki mevki (fiyat varsa fiyata göre).
 *
 * Kulüp sayfasının kadro listesi de bu: ikinci bir liste yazmak, iki kopyanın
 * zamanla ayrışması demekti. Orada açık başlasın diye `open` var.
 */
export function FantasyList({ teamId, open = false }: { teamId: string; open?: boolean }) {
  const { t, f } = useI18n();
  const squad = playersByTeam[teamId] ?? [];
  if (!squad.length) return null;

  return (
    <details open={open} className="group mt-3 border-t border-line pt-2">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 font-semibold [&::-webkit-details-marker]:hidden">
        <span className="text-accent transition-transform group-open:rotate-90">▸</span>
        {t.fantasy.heading}
        <span className="text-[13px] font-normal text-muted">
          {t.fantasy.summary(byId[teamId].name, squad.length)}
        </span>
      </summary>

      <p className="mt-1.5 text-[13px] text-muted">
        {t.fantasy.note(fantasyMeta.source, f.money(BUDGET, 0))}
      </p>

      <div className="mt-2 grid gap-3">
        {POSITIONS.map((pos) => {
          const list = playersOf(teamId, pos);
          if (!list.length) return null;
          return (
            <div key={pos}>
              <h3 className="font-cond text-[17px] font-semibold">
                {t.positions[pos]}{" "}
                <span className="text-[13px] font-normal text-muted">({list.length})</span>
              </h3>
              {list.map((p) => (
                <div
                  key={p.name}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-2.5 border-b border-line py-1.5 text-sm"
                >
                  <span className="truncate">
                    <PlayerLink player={p} />
                    {p.status ? (
                      <em className="ml-1.5 text-xs not-italic text-harder">{t.status[p.status]}</em>
                    ) : null}
                  </span>
                  <span className="font-cond text-lg font-bold text-accent tabular-nums">
                    {p.price != null ? f.num(p.price, 1) : <span className="text-xs font-normal text-muted">{t.fantasy.noPrice}</span>}
                  </span>
                  <span className="w-11 text-right text-xs text-muted tabular-nums">
                    {p.sel == null ? "" : f.pct(p.sel, 1)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </details>
  );
}
