// Oyuncu fiyatı, seçilme oranı, puanı ve dakikasının günlük kaydı
// → data/player-history.json
//
//   node scripts/log-snapshot.mjs [yyyy-aa-gg] [--data klasör] [--dry]
//
// Neden ayrı bir dosya: oyun yalnız **anlık** değeri veriyor. "Bu hafta kim
// zamlandı, kim düşüyor" sorusu ancak kendi tuttuğumuz seriyle yanıtlanır ve
// bu seri **geriye dönük toplanamaz** — kaydetmediğimiz gün kalıcı kayıp.
//
// Kaynak ağ değil, oyuncu dosyası: gün, o dosyanın gözlem günü
// (`meta.fetched`), saatin günü değil. Oyun çekimi başarısız olup dosya eski
// kalırsa yeni gün yazılmaz. Verilen gün dosyanınkinden farklıysa ya da son
// kayıtlı günden eskiyse yazılmaz.
//
// Biçim: gün listesi bir kez yazılır, seriler o listeye indeksle bakar ve
// yalnız değer değiştiğinde satır eklenir. Çoğu oyuncunun fiyatı haftalarca
// sabit kaldığı için dosya küçük kalıyor.
//
// Çıkış: 0 yazıldı ya da değişiklik yok · 1 kullanım/okuma hatası · 2 reddedildi.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { appendSnapshot, HistoryRefusal, observedDay, seasonStartOf } from "./lib/history-log.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const DRY = args.includes("--dry");
const day = args.find((a) => !a.startsWith("--") && a !== opt("data", null));

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(root, opt("data", "data"));

const die = (code, msg) => {
  process.stderr.write(`${msg}\n`);
  process.exit(code);
};

if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
  die(1, "kullanım: node scripts/log-snapshot.mjs [yyyy-aa-gg] [--data klasör] [--dry]");
}

const readJson = (name, fallback) => {
  const path = resolve(dataDir, name);
  if (!existsSync(path)) {
    if (fallback !== undefined) return fallback;
    die(1, `dosya yok: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
};

const fantasy = readJson("fantasy-players.json");
const observed = observedDay(fantasy.meta);
if (!observed) {
  die(1, `oyuncu dosyasında okunabilir gözlem günü yok (meta.fetched=${fantasy.meta?.fetched}); yazılmadı`);
}
// Elle verilen gün dosyanın gözlem gününden farklıysa yazılmıyor: eski dosya
// başka bir günün gözlemi sayılmasın.
if (day && day !== observed) {
  die(2, `istenen gün ${day}, oyuncu dosyasının gözlem günü ${observed}: yazılmadı`);
}

const prev = readJson("player-history.json", null);
const season = readJson("superlig-2026-27.json", null)?.meta?.season ?? null;

let res;
try {
  res = appendSnapshot(prev, fantasy, { day: observed, seasonStart: seasonStartOf(season) });
} catch (error) {
  if (error instanceof HistoryRefusal) die(2, `yazılmadı (${error.code}): ${error.message}`);
  throw error;
}

if (res.blocked.length) {
  process.stderr.write(`!! anahtarı dolu olduğu için taşınamadı: ${res.blocked.join(", ")}\n`);
}

const target = resolve(dataDir, "player-history.json");
if (!DRY) writeFileSync(target, JSON.stringify(res.out) + "\n");

process.stdout.write(
  `gün ${observed} ${res.sameDay ? "yeniden yazıldı" : "eklendi"} (${res.idx + 1}/${res.out.meta.days.length}), ` +
    `${res.out.meta.players} oyuncu, ${res.changed} değişiklik, ${res.fresh} yeni` +
    (res.dropped ? `, sezon öncesi ${res.dropped} gün düştü` : "") +
    (res.moved.length ? `, ${res.moved.length} anahtar taşındı: ${res.moved.join(", ")}` : "") +
    (DRY ? " [--dry: yazılmadı]" : "") +
    `\n`,
);
