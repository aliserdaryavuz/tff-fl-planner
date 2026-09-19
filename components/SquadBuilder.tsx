"use client";

import { useMemo, useState } from "react";
import { Exportable } from "@/components/Exportable";
import { useI18n } from "@/components/I18nProvider";
import { SquadPitch } from "@/components/SquadPitch";
import { TeamLogo } from "@/components/TeamLogo";
import { useComputed } from "@/components/useComputed";
import { useDebouncedValue } from "@/components/useDebouncedValue";
import { usePickArgs } from "@/components/usePickRows";
import type { Job } from "@/lib/compute-jobs";
import { byId, teamIds } from "@/lib/data";
import { hasPrices, playerKey } from "@/lib/fantasy";
import { formationLabel } from "@/lib/formations";
import type { PickRow } from "@/lib/picks";
import { BUDGET, FORMATION, MAX_PER_CLUB, type SquadResult } from "@/lib/squad";

/** Aramada "Söyüncü" ile "soyuncu" eşleşsin. */
function norm(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .replaceAll("ø", "o")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Haftanın kadrosu: ilk 11 + yedek + kaptan, kısıtlara uyan en yüksek beklenen puan. */
export function SquadBuilder({
  rows,
  gw,
  pending = false,
  benchWeight,
  onBenchWeightChange,
}: {
  rows: PickRow[];
  gw: number;
  pending?: boolean;
  benchWeight: number;
  onBenchWeightChange: (v: number) => void;
}) {
  const { t, f } = useI18n();
  const [shown, setShown] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [locked, setLocked] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [excludedClubs, setExcludedClubs] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const excludedAll = useMemo(() => {
    if (!excludedClubs.length) return excluded;
    const keys = new Set(excluded);
    for (const r of rows) {
      if (excludedClubs.includes(r.player.team)) keys.add(playerKey(r.player));
    }
    return [...keys];
  }, [excluded, excludedClubs, rows]);

  // Kadro kurma gerçek havuzda ~0,3 s; ana iş parçacığında koşunca kaydırak
  // oynatılırken ekran donuyordu. İş Web Worker'a gidiyor (lib/compute-jobs.ts);
  // satırlar değil sıralamanın girdisi gönderiliyor, worker satırları kendi
  // havuzundan kuruyor.
  const { args: pickArgs } = usePickArgs();
  const deferredBench = useDebouncedValue(benchWeight);

  const job = useMemo<Job | null>(
    () =>
      hasPrices
        ? { kind: "squad", picks: pickArgs, benchWeight: deferredBench, locked, excluded: excludedAll }
        : null,
    [pickArgs, deferredBench, locked, excludedAll],
  );

  const view = useComputed<SquadResult>(job);
  const result: SquadResult = view.value ?? {
    best: null,
    count: 0,
    capped: false,
    options: [],
    error: hasPrices ? undefined : "no-prices",
  };
  // Gösterilen kadro başka bir girdiye aitse ya da hesap sürüyorsa soluk çizilir.
  const stale = pending || view.pending || view.stale || deferredBench !== benchWeight;

  const byKey = useMemo(() => {
    const map = new Map<string, PickRow>();
    for (const r of rows) map.set(playerKey(r.player), r);
    return map;
  }, [rows]);

  const matches = useMemo(() => {
    const q = norm(query.trim());
    if (q.length < 2) return [];
    return rows
      .filter((r) => {
        const key = playerKey(r.player);
        if (locked.includes(key) || excludedAll.includes(key)) return false;
        return norm(r.player.name).includes(q) || norm(byId[r.player.team].name).includes(q);
      })
      .slice(0, 8);
  }, [query, rows, locked, excludedAll]);

  const clubMatches = useMemo(() => {
    const q = norm(query.trim());
    if (q.length < 2) return [];
    return teamIds
      .filter((id) => !excludedClubs.includes(id) && (norm(byId[id].name).includes(q) || norm(id).includes(q)))
      .slice(0, 3);
  }, [query, excludedClubs]);

  const pin = (key: string) => {
    setLocked((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setExcluded((prev) => prev.filter((k) => k !== key));
    const team = byKey.get(key)?.player.team;
    if (team) setExcludedClubs((prev) => prev.filter((c) => c !== team));
    setQuery("");
    setShown(0);
  };
  const banClub = (team: string) => {
    setExcludedClubs((prev) => (prev.includes(team) ? prev : [...prev, team]));
    setLocked((prev) => prev.filter((k) => byKey.get(k)?.player.team !== team));
    setQuery("");
    setShown(0);
  };
  const unbanClub = (team: string) => {
    setExcludedClubs((prev) => prev.filter((c) => c !== team));
    setShown(0);
  };
  const ban = (key: string) => {
    setExcluded((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setLocked((prev) => prev.filter((k) => k !== key));
    setQuery("");
    setShown(0);
  };
  const clearKey = (key: string) => {
    setLocked((prev) => prev.filter((k) => k !== key));
    setExcluded((prev) => prev.filter((k) => k !== key));
    setShown(0);
  };

  const chip = (key: string, kind: "locked" | "excluded") => {
    const row = byKey.get(key);
    if (!row) return null;
    return (
      <button
        key={key}
        type="button"
        onClick={() => clearKey(key)}
        title={t.squad.removeChip}
        className={[
          "min-h-11 rounded-full border px-3 text-label font-semibold",
          kind === "locked" ? "border-accent bg-accent/10 text-ink" : "border-line bg-surface text-muted line-through",
        ].join(" ")}
      >
        {row.player.name} ×
      </button>
    );
  };

  const options = result.options;
  const squad = options[Math.min(shown, Math.max(0, options.length - 1))];

  const showAnother = () => {
    if (options.length < 2) return;
    let next = shown;
    while (next === shown) next = Math.floor(Math.random() * options.length);
    setShown(next);
  };

  const picker = (
    <div className="mb-2 grid gap-1.5 rounded-lg border border-line p-2">
      <label htmlFor="squad-search" className="text-body-sm font-semibold">
        {t.squad.search}
      </label>
      <input
        id="squad-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.squad.searchPlaceholder}
        className="min-h-11 w-full rounded-lg border border-line bg-ground px-2.5 text-body-sm"
      />

      {clubMatches.length ? (
        <div className="grid gap-1">
          {clubMatches.map((id) => (
            <div key={id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 border-b border-line py-1 text-label">
              <span className="flex min-w-0 items-center gap-1.5">
                <TeamLogo id={id} size={18} />
                <b className="truncate font-semibold">{byId[id].name}</b>
                <span className="shrink-0 text-muted">
                  {t.squad.clubPlayers(rows.filter((r) => r.player.team === id).length)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => banClub(id)}
                className="min-h-11 rounded-lg border border-line bg-surface px-2.5 text-label font-medium text-muted"
              >
                {t.squad.banClub}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {matches.length ? (
        <div className="grid gap-1">
          {matches.map((r) => {
            const key = playerKey(r.player);
            return (
              <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5 border-b border-line py-1 text-label">
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  <TeamLogo id={r.player.team} size={18} />
                  <span className="min-w-0 truncate">
                    <b className="font-semibold">{r.player.name}</b>{" "}
                    <span className="text-muted">
                      {byId[r.player.team].name} · {t.positionsShort[r.player.pos]}
                      {r.player.price != null ? ` · ${f.money(r.player.price)}` : ""} · xP {f.n1(r.score)}
                    </span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => pin(key)}
                  className="min-h-11 rounded-lg border border-accent bg-accent/10 px-2.5 text-label font-semibold"
                >
                  {t.squad.pin}
                </button>
                <button
                  type="button"
                  onClick={() => ban(key)}
                  className="min-h-11 rounded-lg border border-line bg-surface px-2.5 text-label font-medium text-muted"
                >
                  {t.squad.ban}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {locked.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-caption text-muted">{t.squad.lockedTitle}</span>
          {locked.map((key) => chip(key, "locked"))}
        </div>
      ) : null}
      {excluded.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-caption text-muted">{t.squad.excludedTitle}</span>
          {excluded.map((key) => chip(key, "excluded"))}
        </div>
      ) : null}
      {excludedClubs.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-caption text-muted">{t.squad.excludedClubsTitle}</span>
          {excludedClubs.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => unbanClub(id)}
              title={t.squad.removeChip}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-3 pl-1.5 text-label font-semibold text-muted line-through"
            >
              <TeamLogo id={id} size={20} className="opacity-60" />
              {byId[id].name} ×
            </button>
          ))}
        </div>
      ) : null}
      {locked.length || excluded.length || excludedClubs.length ? (
        <button
          type="button"
          onClick={() => {
            setLocked([]);
            setExcluded([]);
            setExcludedClubs([]);
            setShown(0);
          }}
          className="min-h-11 justify-self-start rounded-lg border border-line bg-surface px-3 text-label font-medium hover:bg-surface-2"
        >
          {t.squad.clear}
        </button>
      ) : null}
    </div>
  );

  const heading = (
    <h2 id="squad-heading" className="mb-2 font-cond text-title font-semibold tracking-wide">
      {t.squad.heading}
    </h2>
  );

  if (!hasPrices) {
    return (
      <section aria-labelledby="squad-heading">
        {heading}
        <p className="mb-2 rounded-lg border border-accent/60 bg-surface p-3 text-label">{t.squad.noPrices}</p>
      </section>
    );
  }

  // Hesap hatası kısıt hatasından ayrı: worker da ana iş parçacığı da
  // beceremediyse kullanıcı yeniden deneyebilmeli, sessizce "kadro kurulamadı"
  // demek yanlış olurdu.
  if (view.error && !squad) {
    return (
      <section aria-labelledby="squad-heading">
        {heading}
        <p className="mb-2 text-label text-harder">{t.compute.failed}</p>
        <button
          type="button"
          onClick={view.retry}
          className="mb-2 min-h-11 rounded-lg border border-line bg-surface px-3 text-label font-medium hover:bg-surface-2"
        >
          {t.compute.retry}
        </button>
        {picker}
      </section>
    );
  }

  if (!squad) {
    const code = result.error as keyof typeof t.squad.errors | undefined;
    return (
      <section aria-labelledby="squad-heading">
        {heading}
        <p className="mb-2 text-label">
          {view.pending ? (
            <span className="text-muted">{t.compute.working}</span>
          ) : (
            <span className="text-harder">{code ? t.squad.errors[code] : t.squad.failed}</span>
          )}
        </p>
        {picker}
      </section>
    );
  }

  const clubs = squad.players.reduce<Record<string, number>>((acc, p) => {
    acc[p.team] = (acc[p.team] ?? 0) + 1;
    return acc;
  }, {});

  // Skor ağırlıklara göre değişiyor; saf beklenen puan ayrıca gösterilsin.
  const xpOf = (p: (typeof squad.xi)[number]) => byKey.get(playerKey(p))?.xp ?? 0;
  const xiXp =
    squad.xi.reduce((s, p) => s + xpOf(p), 0) + (squad.captain ? xpOf(squad.captain) : 0);

  return (
    <section aria-labelledby="squad-heading">
      {heading}

      <p className="mb-2 text-label text-muted">
        {t.squad.note(f.money(BUDGET, 0), MAX_PER_CLUB, `${FORMATION.GK}-${FORMATION.DEF}-${FORMATION.MID}-${FORMATION.FWD}`)}
      </p>

      {picker}

      <div className="mb-2 grid grid-cols-[1fr_auto] items-center gap-x-2.5 rounded-lg border border-line p-2">
        <label htmlFor="bench-weight" className="text-body-sm">
          {t.squad.benchWeight.label}
        </label>
        <output htmlFor="bench-weight" className="text-right font-cond text-lead font-semibold text-accent tabular-nums">
          {f.num(benchWeight, 2)}
        </output>
        <input
          id="bench-weight"
          type="range"
          min={0}
          max={0.5}
          step={0.05}
          value={benchWeight}
          onChange={(e) => onBenchWeightChange(Number(e.target.value))}
          className="col-span-2 w-full accent-accent"
        />
        <p className="col-span-2 -mt-0.5 text-caption text-muted">{t.squad.benchWeight.note}</p>
      </div>

      <p className="mb-1.5 text-label text-muted">
        {t.squad.spent(f.money(squad.price), f.money(BUDGET - squad.price))} {t.squad.xiSpend} {f.money(squad.xiPrice)},{" "}
        {t.squad.benchSpend} {f.money(squad.price - squad.xiPrice)}. {t.squad.xiXp(f.n1(xiXp))}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-label text-muted">
          {result.count === 1 ? t.squad.onlyOne : t.squad.manyOptions(result.count, result.capped ? "+" : "", shown + 1)}
        </span>
        {options.length > 1 ? (
          <>
            <button
              type="button"
              onClick={showAnother}
              className="min-h-11 rounded-lg border border-line bg-surface px-3 text-label font-medium hover:bg-surface-2"
            >
              {t.squad.another}
            </button>
            <button
              type="button"
              onClick={() => setListOpen((v) => !v)}
              className="min-h-11 rounded-lg border border-line bg-surface px-3 text-label font-medium hover:bg-surface-2"
            >
              {listOpen ? t.squad.listClose : t.squad.listOpen}
            </button>
          </>
        ) : null}
      </div>

      {listOpen ? (
        <div className="mt-2 grid max-h-[420px] gap-1 overflow-y-auto">
          {options.map((option, i) => (
            <button
              key={option.players.map((p) => p.name).join("|")}
              type="button"
              aria-pressed={i === shown}
              onClick={() => setShown(i)}
              className={[
                "grid min-h-11 grid-cols-[28px_1fr_auto_auto] items-center gap-2 rounded-lg border px-2 text-left text-label",
                i === shown ? "border-accent bg-accent/10" : "border-line bg-surface hover:bg-surface-2",
              ].join(" ")}
            >
              <span className="font-cond text-body font-semibold text-muted tabular-nums">{i + 1}</span>
              <span className="truncate text-muted">
                {formationLabel(option.formation)} · {option.xi.filter((p) => p.pos !== "GK").slice(0, 6).map((p) => p.name).join(", ")}
              </span>
              <span className="font-cond text-body font-bold text-accent tabular-nums">{f.n1(option.xiScore)}</span>
              <span className="w-16 text-right text-muted tabular-nums">{f.money(option.price, 1)}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className={`mt-3 transition-opacity ${stale ? "opacity-60" : ""}`} aria-busy={stale}>
        <Exportable
          title={`${t.squad.headingShort} · ${t.gameweek.week(gw)}`}
          subtitle={`${t.squad.xiScore} ${f.n1(squad.xiScore)} · ${formationLabel(squad.formation)} · ${f.money(squad.price)}`}
          filename={`tff-fl-squad-gw${gw}`}
        >
          <div className="mb-1.5 grid grid-cols-3 gap-1.5">
            <Kpi value={f.n1(squad.xiScore)} label={t.squad.xiScore} accent />
            <Kpi value={formationLabel(squad.formation)} label={t.squad.captain + ": " + (squad.captain?.name ?? "–")} />
            <Kpi value={f.n1(squad.benchScore)} label={t.squad.benchScore} />
          </div>
          <SquadPitch squad={squad} rows={rows} locked={locked} />
        </Exportable>
      </div>
      <p className="mt-1.5 text-caption text-muted">{t.squad.pitchNote}</p>
      <p className="mt-1 text-caption text-muted">{t.squad.benchNote}</p>

      <p className="mt-2 text-label text-muted">
        {t.squad.clubs(
          Object.entries(clubs)
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
            .map(([team, n]) => `${byId[team].name}${n > 1 ? ` ×${n}` : ""}`)
            .join(", "),
        )}
      </p>
    </section>
  );
}

function Kpi({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-surface px-3 pt-2 pb-1.5">
      <b className={["block truncate font-cond text-stat font-bold tabular-nums", accent ? "text-accent" : ""].join(" ")}>
        {value}
      </b>
      <span className="mt-1 block truncate text-caption text-muted">{label}</span>
    </div>
  );
}
