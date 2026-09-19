import raw from "@/data/source-meta.json";

/**
 * Veri gruplarının kaynak ve tazelik özeti.
 *
 * Dipnottaki kaynak tablosu (`components/DataSources.tsx`) ve tazelik hesabı
 * (`lib/freshness.ts`) her dosyanın yalnız `meta` alanlarını okuyor. O alanlara
 * `lib/fantasy.ts`, `lib/lineups.ts`, `lib/history.ts` ve `lib/results.ts`
 * üzerinden erişmek, o modüllerin import ettiği JSON'u da pakete sokardı —
 * ölçülen boyutlar lineups 1008 KB, results 301 KB, fantasy-players 226 KB,
 * player-history 67 KB. Dipnot kabukta olduğu için bu **her rotaya** yayılırdı.
 * Buradaki dosya yalnız okunan alanları taşıyor (923 B).
 *
 * Dosya türetilmiş: `scripts/build-source-meta.mjs` üretiyor,
 * `data/source-meta.test.ts` sapmadığını sınıyor.
 */
export const sourceMeta = raw.sources;

/**
 * Bu hafta için tahmini 11 sayısı. Tahminler yalnız oyuncu dosyasının haftasına
 * aitse geçerli; hafta geçince kendiliğinden düşüyor (`predictedFor` ile aynı
 * kural, `lib/lineups.ts`).
 */
export const predictedCount =
  sourceMeta.predicted.matchday === sourceMeta.players.gameweek
    ? sourceMeta.predicted.previews
    : 0;
