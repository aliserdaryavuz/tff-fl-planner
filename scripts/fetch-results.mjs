// Oynanmış Süper Lig maçlarının içi: goller (kim, kaçıncı dakika, asist),
// kartlar, kaçan penaltılar, maçın adamı ve iki takımın kadrosu.
// → data/results.json
//
//   node scripts/fetch-results.mjs [--teams Galatasaray,Fenerbahce] [--fresh]
//
// Skorlar zaten `data/superlig-2026-27.json`'da (oyunun kendi verisi) ve puan
// tablosu ondan hesaplanıyor (`lib/data.ts` `computeTable`). Burada eksik olan
// **maçın içi**; tablo yeniden hesaplanmıyor, ikinci bir doğruluk kaynağı
// yaratmamak için.
//
// Kaynak, oynama ve üretim verisiyle aynı FotMob sayfaları: `fetch-lineups.mjs`
// onları zaten indirip önbelleğe aldı, yani bu betik çoğunlukla diskten okur.
//
// Eşleme: FotMob maçının tarafları `teamIdOf` ile kendi kimliklerimize çevrilir
// ve fikstüre `ev|deplasman` ile bağlanır. O anahtar ölçülerek seçildi: 306
// fikstürde 306 benzersiz sıralı çift var, yani tarih aritmetiğine (FotMob UTC
// anı, bizim dosya İstanbul tarihi) hiç girmeye gerek yok.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FOTMOB, matchPage, teamFixtures } from "./lib/fotmob.mjs";
import { teamIdOf } from "./lib/teams.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const ONLY = opt("teams", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const FRESH = args.includes("--fresh");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const season = JSON.parse(readFileSync(resolve(root, "data/superlig-2026-27.json"), "utf8"));

/** `ev|deplasman` -> fikstür. Ölçüldü: 306 fikstür, 306 benzersiz çift. */
const byPair = new Map(season.fixtures.map((f) => [`${f.home}|${f.away}`, f]));

const isLeague = (name) => /süper lig|super lig/i.test(String(name ?? ""));

function log(msg) {
  process.stderr.write(`${new Date().toISOString().slice(11, 19)} ${msg}\n`);
}

/** Kadronun bir tarafı: diziliş, ilk 11 ve oyuna giren yedekler. */
function side(raw) {
  if (!raw) return null;
  const minutesOf = (p, started) => {
    const events = p.performance?.substitutionEvents ?? [];
    if (started) {
      const out = events.find((e) => e.type === "subOut");
      return out ? out.time : 90;
    }
    const on = events.find((e) => e.type === "subIn");
    return on ? Math.max(0, 90 - on.time) : 0;
  };
  const map = (list, started) =>
    (list ?? []).map((p) => ({
      id: p.id ?? null,
      name: p.name ?? "",
      started,
      minutes: minutesOf(p, started),
    }));
  return {
    teamId: raw.id ?? null,
    formation: raw.formation ?? null,
    starters: map(raw.starters, true),
    subs: map(raw.subs, false),
  };
}

const matches = [];
const seen = new Set();
const unlinked = [];

const teams = Object.entries(FOTMOB).filter(([id]) => !ONLY.length || ONLY.includes(id));
let done = 0;
for (const [team, [fotmobId, slug]] of teams) {
  log(`${team}: fikstür`);
  const fixtures = teamFixtures(fotmobId, slug, { cache: false }).filter(
    (f) => f.finished && isLeague(f.competition),
  );

  for (const f of fixtures) {
    const home = teamIdOf(f.home);
    const away = teamIdOf(f.away);
    if (!home || !away) {
      unlinked.push({ reason: "takım eşleşmedi", home: f.home, away: f.away });
      continue;
    }
    const key = `${home}|${away}`;
    if (seen.has(key)) continue; // Her maç iki takımın listesinde de var.
    const fixture = byPair.get(key);
    if (!fixture) {
      unlinked.push({ reason: "fikstürde yok", home, away });
      continue;
    }
    seen.add(key);

    const page = matchPage(f.pageUrl, { cache: !FRESH });
    if (!page) {
      unlinked.push({ reason: "sayfa okunamadı", home, away });
      continue;
    }
    // FotMob'un `homeTeam`/`awayTeam`'i maçın ev sahibine göre; `fetch-lineups.mjs`
    // de tarafı `L.homeTeam.id === fotmobId` ile seçiyor.
    const L = page.lineup;
    matches.push({
      md: fixture.md,
      date: fixture.date,
      tsi: fixture.tsi,
      home,
      away,
      // Skor oyunun kendi verisinden: tek doğruluk kaynağı orası.
      hg: fixture.hg,
      ag: fixture.ag,
      events: page.events ?? [],
      potm: page.potm ?? null,
      lineups: L ? { home: side(L.homeTeam), away: side(L.awayTeam) } : null,
    });
  }
  done++;
  log(`${team}: ${matches.length} maç toplandı (${done}/${teams.length})`);
}

matches.sort((a, b) => a.md - b.md || a.date.localeCompare(b.date) || a.home.localeCompare(b.home));

const played = season.fixtures.filter((f) => f.hg != null && f.ag != null).length;
const out = {
  meta: {
    source: "FotMob (fotmob.com)",
    fetched: new Date().toISOString().slice(0, 10),
    matches: matches.length,
    /** Oyunun bitmiş saydığı maç sayısı; farkı görünür kalsın. */
    playedFixtures: played,
    unlinked: unlinked.length,
  },
  matches,
  unlinked,
};
const target = resolve(root, "data/results.json");
writeFileSync(target, JSON.stringify(out, null, 1) + "\n");
log(`yazıldı: ${target} (${matches.length}/${played} maç, ${unlinked.length} eşlenemedi)`);
