"use client";

import { useI18n } from "@/components/I18nProvider";
import { PageHead } from "@/components/PageHead";
import { usePlanner, useTheme, useWeekWeights } from "@/components/PlannerContext";
import { useModelResults } from "@/components/PlannerContext";
import { TeamLink } from "@/components/EntityLink";
import { TeamLogo } from "@/components/TeamLogo";
import { useEdgeFade } from "@/components/useEdgeFade";
import { bandOf, bandStyle } from "@/lib/bands";
import { byId } from "@/lib/data";
import { fantasyMeta, type Player } from "@/lib/fantasy";
import { priceChange, selChange } from "@/lib/history";
import {
  isScoredMatch,
  lineupOf,
  lineupsMeta,
  predictedFor,
  startProbability,
  summarizeRecent,
} from "@/lib/lineups";
import { playerExpectedPoints, shrunkRates } from "@/lib/xp";

/**
 * Tek oyuncunun sayfası: modelde kullanılan her veri tek yerde.
 *
 * Bu sayfa yeni bir hesap yapmıyor — sıralama ve kadro kurucudaki aynı
 * fonksiyonları çağırıp **girdilerini de** gösteriyor. Amaç "şu sayı nereden
 * geldi" sorusunu oyuncu bazında yanıtlamak.
 *
 * Hafta dökümü seçili ufkun haftaları: `playerExpectedPoints` zaten yalnız
 * ağırlığı olan haftaları hesaplıyor ve modelin gerçekten kullandığı haftalar
 * bunlar. Uydurma bir tam sezon tablosu, sayfanın vaadini bozardı.
 */
export function PlayerPage({ player }: { player: Player }) {
  const { t, f } = useI18n();
  const { state } = usePlanner();
  const theme = useTheme();
  const { results, strength } = useModelResults();
  const weekWeights = useWeekWeights();
  // Çağrı yerinde parçalanıyor: sonucu nesnede tutup `x.ref` diye okumak
  // "render sırasında ref'e erişme" kuralına takılıyor (react-hooks/refs).
  const { ref: weeksRef, style: weeksStyle } = useEdgeFade<HTMLDivElement>();
  const { ref: recentRef, style: recentStyle } = useEdgeFade<HTMLDivElement>();
  const { ref: ratesRef, style: ratesStyle } = useEdgeFade<HTMLDivElement>();

  const ctx = { strength, homeAdvantage: state.params[state.model].ha };
  const xp = playerExpectedPoints(player, weekWeights, ctx);
  const info = lineupOf(player);
  const predicted = predictedFor(player, state.gw);
  const startProb = startProbability(player, info, predicted);
  const summary = summarizeRecent(player, info);
  const rates = shrunkRates(player.pos, summary, player);
  const price = priceChange(player, 7);
  const sel = selChange(player, 7);
  const recent = (info?.recent ?? []).filter(isScoredMatch);

  return (
    <article className="grid grid-cols-[minmax(0,1fr)] gap-7">
      <PageHead
        title={
          <span className="inline-flex flex-wrap items-baseline gap-x-3">
            {player.name}
            <span className="text-[13px] font-normal text-muted">
              {t.positions[player.pos]}
            </span>
            {player.status ? (
              <span className="rounded-[var(--radius-sm)] border border-harder px-1.5 py-0.5 text-xs font-semibold text-harder">
                {t.status[player.status]}
              </span>
            ) : null}
          </span>
        }
        lead={
          <TeamLink team={player.team} className="inline-flex items-center gap-1.5">
            <TeamLogo id={player.team} size={18} />
            {byId[player.team].name}
            <span aria-hidden>→</span>
          </TeamLink>
        }
      />

      <div className="grid grid-cols-2 gap-2 desk:grid-cols-4">
        <Stat value={player.price != null ? f.money(player.price) : "—"} label={t.player.price} />
        <Stat value={player.sel != null ? f.pct(player.sel, 0) : "—"} label={t.player.ownership} />
        <Stat
          value={f.pct(startProb * 100, 0)}
          label={t.player.startChance}
          note={t.player.expectedMinutes(Math.round(xp.minutes.expectedMinutes))}
        />
        <Stat value={f.n1(xp.xp)} label={t.player.xp} note={t.player.xpNote} />
      </div>

      {/* Hafta hafta beklenen puan; girdisi olan fikstür aynı satırda. */}
      <section>
        <h2 className="mb-2 heading-sub">{t.player.byMatchday}</h2>
        <p className="mb-2 text-[13px] text-muted">{t.player.byMatchdayNote}</p>
        <div
          ref={weeksRef}
          style={weeksStyle}
          className="scroll-fade overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label={t.player.byMatchday}
        >
          <table className="w-full min-w-[520px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-1.5 pr-2 font-medium">{t.player.matchday}</th>
                <th className="py-1.5 pr-2 font-medium">{t.player.opponent}</th>
                <th className="py-1.5 pr-2 text-right font-medium">{t.player.difficulty}</th>
                <th className="py-1.5 pr-2 text-right font-medium">{t.player.colAppearance}</th>
                <th className="py-1.5 pr-2 text-right font-medium">{t.player.colAttack}</th>
                <th className="py-1.5 pr-2 text-right font-medium">{t.player.colDefence}</th>
                <th className="py-1.5 text-right font-medium">{t.player.total}</th>
              </tr>
            </thead>
            <tbody>
              {xp.weeks.map((w) => {
                const b = w.xp;
                // Zorluk modelin kendi ölçüsünden: takım tablosu, fikstür şeridi
                // ve hafta programı hep `results[takım].diffs`'i çiziyor. Buradan
                // ayrı bir sayı türetmek aynı hücreyi sayfadan sayfaya farklı
                // gösterirdi.
                const difficulty = results[player.team]?.diffs[w.md - 1] ?? null;
                return (
                  <tr key={w.md} className="border-b border-line">
                    <td className="py-1.5 pr-2 font-semibold tabular-nums">
                      {t.gameweek.week(w.md)}
                    </td>
                    <td className="py-1.5 pr-2">
                      {w.fixture ? (
                        <TeamLink
                          team={w.fixture.opp}
                          className="inline-flex items-center gap-1.5"
                        >
                          <TeamLogo id={w.fixture.opp} size={16} />
                          <span className="min-w-0">{byId[w.fixture.opp].name}</span>
                          <span className="text-muted">
                            {w.fixture.ha === "E" ? t.player.home : t.player.away}
                          </span>
                        </TeamLink>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      {difficulty != null ? (
                        <span
                          className="rounded px-1 font-semibold tabular-nums"
                          style={bandStyle(theme, bandOf(difficulty))}
                        >
                          {f.n1(difficulty)}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-2 text-right text-muted tabular-nums">
                      {b ? f.n1(b.appearance) : "—"}
                    </td>
                    <td className="py-1.5 pr-2 text-right text-muted tabular-nums">
                      {b ? f.n1(b.goals + b.assists + b.bonus) : "—"}
                    </td>
                    <td className="py-1.5 pr-2 text-right text-muted tabular-nums">
                      {b ? f.n1(b.cleanSheet + b.conceded + b.saves) : "—"}
                    </td>
                    <td className="py-1.5 text-right font-cond text-[15px] font-bold tabular-nums">
                      {b ? f.n1(b.total) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Oynama beklentisinin girdileri */}
      <section>
        <h2 className="mb-2 heading-sub">{t.player.availability}</h2>
        <ul className="m-0 grid list-none gap-1 p-0 text-[13px]">
          <Fact
            label={t.player.gameStatus}
            value={player.status ? t.status[player.status] : t.player.noFlag}
          />
          {info?.unavailable ? (
            <Fact
              label={t.player.clubList}
              value={t.player.unavailableUntil(
                info.unavailable.type,
                info.unavailable.until ? f.date(info.unavailable.until) : "—",
              )}
            />
          ) : null}
          {predicted.sources > 0 ? (
            <Fact
              label={t.player.predictedXi}
              value={predicted.listed > 0 ? t.player.inPredicted : t.player.notInPredicted}
            />
          ) : null}
          {price ? (
            <Fact
              label={t.player.priceChange(price.days)}
              value={`${price.delta > 0 ? "+" : ""}${f.money(price.delta)}`}
            />
          ) : null}
          {sel ? (
            <Fact
              label={t.player.selChange(sel.days)}
              value={`${sel.delta > 0 ? "+" : ""}${f.pct(sel.delta, 0)}`}
            />
          ) : (
            <Fact label={t.player.history} value={t.player.historyPending(1)} />
          )}
        </ul>
      </section>

      {/* Son maçlar */}
      <section>
        <h2 className="mb-2 heading-sub">{t.player.recent}</h2>
        {recent.length ? (
          <>
            <p className="mb-2 text-[13px] text-muted">
              {t.player.recentNote(
                lineupsMeta.source,
                lineupsMeta.fetched ? f.date(lineupsMeta.fetched) : "—",
              )}
            </p>
            <div
              ref={recentRef}
              style={recentStyle}
              className="scroll-fade overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-label={t.player.recent}
            >
              <table className="w-full min-w-[560px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="py-1.5 pr-2 font-medium">{t.player.date}</th>
                    <th className="py-1.5 pr-2 font-medium">{t.player.competition}</th>
                    <th className="py-1.5 pr-2 text-right font-medium">{t.player.minutes}</th>
                    <th className="py-1.5 pr-2 text-right font-medium">{t.player.goals}</th>
                    <th className="py-1.5 pr-2 text-right font-medium">xG</th>
                    <th className="py-1.5 pr-2 text-right font-medium">xA</th>
                    <th className="py-1.5 pr-2 text-right font-medium">{t.player.shots}</th>
                    <th className="py-1.5 text-right font-medium">
                      {player.pos === "GK" ? t.player.saves : t.player.chances}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((m) => (
                    <tr key={`${m.date}-${m.competition}`} className="border-b border-line">
                      <td className="py-1.5 pr-2 tabular-nums">{f.date(m.date)}</td>
                      <td className="py-1.5 pr-2 text-muted">{m.competition}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{m.minutes}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {m.goals}
                        {m.assists ? ` / ${m.assists}` : ""}
                      </td>
                      <td className="py-1.5 pr-2 text-right text-muted tabular-nums">
                        {m.xg == null ? "—" : f.n2(m.xg)}
                      </td>
                      <td className="py-1.5 pr-2 text-right text-muted tabular-nums">
                        {m.xa == null ? "—" : f.n2(m.xa)}
                      </td>
                      <td className="py-1.5 pr-2 text-right text-muted tabular-nums">
                        {m.shots ?? "—"}
                      </td>
                      <td className="py-1.5 text-right text-muted tabular-nums">
                        {(player.pos === "GK" ? m.saves : m.chances) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="m-0 text-[13px] text-muted">{t.player.noMatches}</p>
        )}
      </section>

      {/* 90 dakikalık oranlar: modelin kullandığı düzeltilmiş değerler */}
      <section>
        <h2 className="mb-2 heading-sub">{t.player.rates}</h2>
        <p className="mb-2 text-[13px] text-muted">
          {t.player.ratesNote(summary.matches, summary.minutes)}
        </p>
        <div
          ref={ratesRef}
          style={ratesStyle}
          className="scroll-fade overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label={t.player.rates}
        >
          <table className="w-full min-w-[320px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-1.5 pr-2 font-medium">{t.player.metric}</th>
                <th className="py-1.5 text-right font-medium">{t.player.adjusted}</th>
              </tr>
            </thead>
            <tbody>
              <RateRow label={t.player.rateGoals} value={f.n2(rates.g90)} />
              <RateRow label={t.player.rateAssists} value={f.n2(rates.a90)} />
              <RateRow label={t.player.rateBonus} value={f.n2(rates.bonus90)} />
              {player.pos === "GK" ? (
                <RateRow label={t.player.rateSaves} value={f.n1(rates.saves90)} />
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-2 mb-0 text-xs text-muted">{t.player.adjustedNote}</p>
      </section>

      <p className="m-0 text-xs text-muted">
        {t.player.source(
          fantasyMeta.fetched ? f.date(fantasyMeta.fetched) : "—",
          fantasyMeta.gameweek ?? 0,
        )}
      </p>
    </article>
  );
}

function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-surface px-3 pt-2.5 pb-2">
      <b className="block font-cond text-[28px] leading-none font-bold text-ink tabular-nums">
        {value}
      </b>
      <span className="mt-1 block text-xs text-muted">{label}</span>
      {note ? <span className="mt-0.5 block text-xs text-muted">{note}</span> : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2 border-b border-line py-1.5">
      <span className="text-muted">{label}</span>
      <b className="text-right font-semibold tabular-nums">{value}</b>
    </li>
  );
}

function RateRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-line">
      <td className="py-1.5 pr-2">{label}</td>
      <td className="py-1.5 text-right font-semibold tabular-nums">{value}</td>
    </tr>
  );
}
