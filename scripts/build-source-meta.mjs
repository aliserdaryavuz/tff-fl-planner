// Veri dosyalarının meta bloklarından küçük bir özet → data/source-meta.json.
//
//   node scripts/build-source-meta.mjs [--check]
//
// Neden ayrı bir dosya: kaynak tablosu ve tazelik hesabı her veri dosyasının
// yalnız `meta` alanlarına bakıyor — kaynak adı, çekim tarihi, hafta ve birkaç
// sayım. Ama o alanlara `lib/fantasy.ts`, `lib/lineups.ts`, `lib/history.ts`,
// `lib/results.ts` üzerinden erişmek dosyaların tamamını pakete sokar. Ölçülen
// boyutlar: lineups 1008 KB, results 301 KB, fantasy-players 226 KB,
// player-history 67 KB. Dipnot kabukta, yani **her rotada** çiziliyor; bu da
// ~1,6 MB'ı beş sayfaya birden bindirirdi. Bu dosya yalnız okunan alanları
// taşıyor.
//
// Türetilmiş dosya, yeni veri değil. `data/source-meta.test.ts` üretilenin
// kaynaklardan sapmadığını sınıyor, yani bayat kalırsa kapı düşer; `--check`
// aynı karşılaştırmayı yazmadan yapar.
//
// Çıkış: 0 yazıldı ya da güncel · 1 sapma var (--check).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => JSON.parse(readFileSync(resolve(root, rel), "utf8"));

export const OUT = "data/source-meta.json";

/**
 * Yalnız iki tüketicinin gerçekten okuduğu alanlar. Liste bilinçli olarak dar:
 * her yeni alan bu dosyayı büyütür ve sapma yüzeyini artırır.
 *
 * `player-history.json` meta'sındaki `ids` haritası buraya **girmiyor** —
 * 67 KB'lık dosyanın büyük kısmı o ve tazelik için gereksiz.
 *
 * Fikstür, Opta, Transfermarkt ve geçen sezon sırası burada yok: onlar
 * `data/superlig-2026-27.json` meta'sında ve o dosya zaten her sayfada
 * yükleniyor (`lib/data.ts`), yani kopyalamak kazanç sağlamaz.
 */
export function buildSourceMeta() {
  const fantasy = read("data/fantasy-players.json").meta;
  const history = read("data/player-history.json").meta;
  const lineups = read("data/lineups.json").meta;
  const results = read("data/results.json").meta;
  const predicted = read("data/predicted-xi.json").meta;

  return {
    note:
      "Türetilmiş dosya — elle düzenlenmez. Kaynağı data/ altındaki veri " +
      "dosyalarının meta blokları; üreten betik scripts/build-source-meta.mjs.",
    sources: {
      players: {
        source: fantasy.source,
        fetched: fantasy.fetched ?? null,
        gameweek: fantasy.gameweek ?? null,
        players: fantasy.players ?? null,
      },
      history: {
        source: history.source,
        // Tazelik son güne bakıyor, tablo gün sayısına; dizinin tamamı gerekmiyor.
        lastDay: history.days?.at(-1) ?? null,
        days: history.days?.length ?? 0,
        players: history.players ?? null,
      },
      lineups: {
        source: lineups.source,
        fetched: lineups.fetched ?? null,
        teams: Object.keys(lineups.teams ?? {}).length,
        matchesPerTeam: lineups.matchesPerTeam ?? null,
      },
      results: {
        source: results.source,
        fetched: results.fetched ?? null,
        matches: results.matches ?? 0,
        // Oyunun bitmiş saydığı maçla farkı: donmuş besleme buradan görünüyor.
        playedFixtures: results.playedFixtures ?? null,
      },
      predicted: {
        source: predicted.source,
        fetched: predicted.fetched ?? null,
        matchday: predicted.matchday ?? null,
        // Meta'da hazır sayım var; dosyanın gövdesine inmeye gerek yok.
        previews: predicted.previews ?? 0,
      },
    },
  };
}

const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const text = serialize(buildSourceMeta());
  const check = process.argv.includes("--check");
  let current = null;
  try {
    current = readFileSync(resolve(root, OUT), "utf8");
  } catch {
    current = null;
  }
  if (current === text) {
    console.log(`${OUT} güncel`);
  } else if (check) {
    console.error(`${OUT} kaynak dosyalardan sapmış; "node scripts/build-source-meta.mjs" ile yenile`);
    process.exit(1);
  } else {
    writeFileSync(resolve(root, OUT), text, "utf8");
    console.log(`${OUT} yazıldı (${text.length} B)`);
  }
}
