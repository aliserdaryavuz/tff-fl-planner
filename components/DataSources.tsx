"use client";

import { useI18n } from "@/components/I18nProvider";
import { useNow } from "@/components/useNow";
import { meta } from "@/lib/data";
import {
  type Freshness,
  type SourceKey,
  sourceFreshness,
  splitSource,
  staleSources,
} from "@/lib/freshness";
// Tablo yalnız meta alanlarını yazıyor; ayıklanmış dosyadan okunuyor. Ağır
// modüllerden okumak ~1,6 MB JSON'u dipnot yüzünden her rotaya taşırdı.
import { predictedCount, sourceMeta } from "@/lib/source-meta";

/**
 * Veri grubu başına kaynak ve son başarılı güncelleme.
 *
 * Eskiden dipnotta tek bir satır vardı ve içindeki tek tarih bütün veriler
 * güncelmiş gibi okunuyordu. Oysa her dosya ayrı çekiliyor ve biri bayat
 * kalabiliyor. Her satır kendi tarihini taşıyor; tarihi olmayan satır
 * "hiç çekilmedi" diyor.
 */
type Row = {
  key: SourceKey;
  what: string;
  source: string;
  href?: string;
  /** "18.09.2026" ya da ISO; biçimlendirme aşağıda. */
  updated: string | null;
  scope: string;
  /** Otomatik çekilmiyor: tarih yokluğu "başarısız" demek değil. */
  manual?: boolean;
};

export function DataSources() {
  const { t, f } = useI18n();
  const s = t.sourcesTable;

  const fixtures = splitSource(meta.source_fixtures);
  const opta = splitSource(meta.opta_source);
  const value = splitSource(meta.value_source);
  const last = splitSource(meta.last_source);

  const rows: Row[] = [
    {
      key: "fixtures",
      what: s.fixtures,
      source: fixtures.name,
      href: "https://www.tfffantezilig.com/",
      updated: fixtures.date,
      scope: s.fixturesScope,
    },
    {
      key: "opta",
      what: s.opta,
      source: opta.name,
      href: "https://dataviz.theanalyst.com/opta-power-rankings/",
      updated: opta.date,
      scope: s.optaScope,
    },
    {
      key: "value",
      what: s.value,
      source: value.name,
      href: "https://www.transfermarkt.com.tr/super-lig/startseite/wettbewerb/TR1",
      updated: value.date,
      scope: s.valueScope,
    },
    {
      key: "last",
      what: s.last,
      source: last.name,
      updated: last.date,
      manual: true,
      scope: s.lastScope,
    },
    {
      key: "players",
      what: s.players,
      source: splitSource(sourceMeta.players.source).name,
      href: "https://www.tfffantezilig.com/",
      updated: sourceMeta.players.fetched,
      scope: s.playersScope(sourceMeta.players.gameweek ?? 0, sourceMeta.players.players ?? 0),
    },
    {
      key: "history",
      what: s.history,
      source: splitSource(sourceMeta.history.source).name,
      updated: sourceMeta.history.lastDay,
      scope: s.historyScope(sourceMeta.history.days, sourceMeta.history.players ?? 0),
    },
    {
      key: "lineups",
      what: s.lineups,
      source: sourceMeta.lineups.source,
      href: "https://www.fotmob.com/",
      updated: sourceMeta.lineups.fetched,
      scope: s.lineupsScope(sourceMeta.lineups.teams, sourceMeta.lineups.matchesPerTeam ?? 0),
    },
    {
      key: "results",
      what: s.results,
      source: sourceMeta.results.source,
      href: "https://www.fotmob.com/",
      updated: sourceMeta.results.fetched,
      scope: s.resultsScope(sourceMeta.results.matches),
    },
    {
      key: "predicted",
      what: s.predicted,
      source: sourceMeta.predicted.source,
      href: "https://www.fotmob.com/",
      updated: sourceMeta.predicted.fetched,
      scope: s.predictedScope(predictedCount, sourceMeta.predicted.matchday ?? 0),
    },
    {
      key: "teamHistory",
      what: s.teamHistory,
      source: splitSource(sourceMeta.teamHistory.source).name,
      href: "https://www.tfffantezilig.com/",
      updated: sourceMeta.teamHistory.fetched,
      scope: s.teamHistoryScope(sourceMeta.teamHistory.weeks),
    },
  ];

  // Tazelik bakanın saatine bağlı; sunucuda ve hydration'da gösterilmiyor.
  const now = useNow();
  const fresh = now === null ? null : sourceFreshness(now);

  /**
   * Veri dosyalarında iki biçim var: cümle içinden ayıklananlar "18.09.2026",
   * özet dosyadan gelenler "2026-09-18". İkisi de ISO'ya çevrilip **aynı**
   * biçimde yazılıyor: tek sütunda iki ayrı sunum ("18.09.2026" ile
   * "Cum 18 Eyl" yan yana) okunmuyordu. Çözümlenemeyen metin olduğu gibi kalır.
   */
  const show = (value: string | null) => {
    if (!value) return s.never;
    const tr = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
    const iso = tr ? `${tr[3]}-${tr[2]}-${tr[1]}` : value;
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? f.date(iso) : value;
  };

  return (
    <div>
      <p className="mt-0 mb-2 text-caption text-muted">{s.caption}</p>
      {/* Klavyeyle kaydırılabilsin: odak alan, adlı bölge. */}
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={s.heading}>
        <table className="w-full min-w-[520px] border-collapse text-label">
          <caption className="sr-only">{s.caption}</caption>
          <thead>
            <tr className="border-b border-line text-left text-caption text-muted">
              <th scope="col" className="py-1.5 pr-2 font-medium">
                {s.colWhat}
              </th>
              <th scope="col" className="py-1.5 pr-2 font-medium">
                {s.colSource}
              </th>
              <th scope="col" className="py-1.5 pr-2 font-medium">
                {s.colUpdated}
              </th>
              <th scope="col" className="py-1.5 font-medium">
                {s.colScope}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-line align-baseline">
                <th scope="row" className="py-1.5 pr-2 font-medium text-ink">
                  {row.what}
                </th>
                <td className="py-1.5 pr-2 text-muted">
                  {row.href ? (
                    <a
                      href={row.href}
                      rel="noreferrer"
                      className="py-1 underline underline-offset-2 hover:no-underline"
                    >
                      {row.source}
                    </a>
                  ) : (
                    row.source
                  )}
                </td>
                <td className={`py-1.5 pr-2 tabular-nums ${row.updated ? "text-ink" : "text-muted"}`}>
                  {row.updated ? show(row.updated) : row.manual ? s.manual : s.never}
                  {fresh ? <FreshnessNote freshness={fresh[row.key]} /> : null}
                </td>
                <td className="py-1.5 text-muted">{row.scope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Uyarı gerektiren durumun metni; taze ya da zamanla bayatlamayan grupta hiçbir şey. */
function FreshnessNote({ freshness }: { freshness: Freshness }) {
  const { t } = useI18n();
  const s = t.sourcesTable;
  let text: string | null = null;
  if (freshness.state === "stale") text = s.stale(freshness.ageDays);
  else if (freshness.state === "behind") text = s.behind(freshness.feedGw, freshness.nextGw);
  else if (freshness.state === "missing") text = s.missing(freshness.gw);
  return text ? <span className="block text-harder">{text}</span> : null;
}

/** Kapalı "Kaynaklar" başlığının yanında: kaç grup uyarı veriyor. */
export function StaleSourcesNote() {
  const { t } = useI18n();
  const now = useNow();
  if (now === null) return null;
  const count = staleSources(sourceFreshness(now)).length;
  return count ? (
    <span className="font-normal text-harder">· {t.sourcesTable.staleCount(count)}</span>
  ) : null;
}
