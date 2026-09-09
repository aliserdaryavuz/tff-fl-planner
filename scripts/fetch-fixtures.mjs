// Trendyol Süper Lig 2026/27 fikstürünü TFF'nin resmî sayfasından çeker ve
// data/superlig-2026-27.json'daki `fixtures` alanını yeniler.
//
//   node scripts/fetch-fixtures.mjs [--weeks 1-34] [--date "gg.aa.yyyy"]
//
// Kaynak: https://www.tff.org/default.aspx?pageID=198&hafta=N (windows-1254).
// Her hafta için 9 maç: tarih, TSİ saat, ev, deplasman, skor (oynandıysa) ve
// TFF maç/kulüp id'leri. Takımlar TFF'nin yazımından (sponsor adlı, büyük
// harf) kendi id'lerimize anahtar kelimeyle eşlenir; eşlenmeyen ad hata verir.
// Takım meta verisi (Elo, Opta, kadro değeri...) bu betikte değişmez: mevcut
// dosyadaki takım kayıtları korunur, yalnız fikstür ve tffId yenilenir.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TEAMS, teamIdOf } from "./lib/teams.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const [FROM, TO] = opt("weeks", "1-34").split("-").map(Number);
const today = new Date();
const DATE =
  opt("date") ??
  `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "data/superlig-2026-27.json");

function teamId(tffName) {
  const id = teamIdOf(tffName);
  if (!id) throw new Error(`takım eşlenemedi: "${tffName}"`);
  return id;
}

async function fetchWeek(week) {
  const url = `https://www.tff.org/default.aspx?pageID=198&hafta=${week}`;
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return new TextDecoder("windows-1254").decode(await res.arrayBuffer());
}

const text = (s) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();

/** Bir haftanın sayfasındaki maç satırları. */
function parseWeek(html, week) {
  const blocks = html.split(/dtlHaftaninMaclari_ctl\d+_ayrt1/).slice(1);
  const rows = [];
  for (const b of blocks) {
    const get = (label) => {
      const m = b.match(new RegExp(`_${label}">([^<]*)<`));
      return m ? text(m[1]) : "";
    };
    const date = get("lblTarih");
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(date)) continue;
    const time = get("lblSaat");
    const home = get("Label4");
    const away = get("Label1");
    const hg = get("Label5");
    const ag = get("Label6");
    const matchId = b.match(/macId=(\d+)/)?.[1] ?? null;
    const clubIds = [...b.matchAll(/kulupID=(\d+)/g)].map((m) => Number(m[1]));
    const [d, mo, y] = date.split(".");
    rows.push({
      md: week,
      date: `${y}-${mo}-${d}`,
      tsi: /^\d{2}:\d{2}$/.test(time) ? time : null,
      home: teamId(home),
      away: teamId(away),
      hg: hg === "" ? null : Number(hg),
      ag: ag === "" ? null : Number(ag),
      tffMatchId: matchId ? Number(matchId) : null,
      _homeTff: clubIds[0] ?? null,
      _awayTff: clubIds[1] ?? null,
      _homeName: home,
      _awayName: away,
    });
  }
  return rows;
}

const existing = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : null;
const byId = new Map((existing?.teams ?? []).map((t) => [t.id, t]));

const fixtures = [];
const tffIds = new Map();
const tffNames = new Map();
for (let week = FROM; week <= TO; week++) {
  const rows = parseWeek(await fetchWeek(week), week);
  process.stderr.write(`${week}. hafta: ${rows.length} maç\n`);
  for (const r of rows) {
    if (r._homeTff) tffIds.set(r.home, r._homeTff);
    if (r._awayTff) tffIds.set(r.away, r._awayTff);
    tffNames.set(r.home, r._homeName);
    tffNames.set(r.away, r._awayName);
    fixtures.push(Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith("_"))));
  }
}

// Bu aralık dışındaki haftalar mevcut dosyadan korunur.
const kept = (existing?.fixtures ?? []).filter((f) => f.md < FROM || f.md > TO);
const all = [...kept, ...fixtures].sort(
  (a, b) => a.md - b.md || a.date.localeCompare(b.date) || (a.tsi ?? "").localeCompare(b.tsi ?? ""),
);

const teams = TEAMS.map((t) => {
  const prev = byId.get(t.id) ?? {};
  return {
    ...prev,
    id: t.id,
    name: t.name,
    last: t.last,
    tffId: tffIds.get(t.id) ?? prev.tffId ?? null,
    tffName: tffNames.get(t.id) ?? prev.tffName ?? null,
  };
});

const out = {
  meta: {
    ...(existing?.meta ?? {}),
    season: "2026/27",
    league: "Trendyol Süper Lig",
    weeks: 34,
    source_fixtures: `TFF resmî fikstür sayfası (tff.org), ${DATE}`,
    last_source: "Wikipedia, 2025–26 Süper Lig ve TFF 1. Lig nihai tabloları",
    generated: new Date().toISOString().slice(0, 10),
  },
  teams,
  fixtures: all,
};

writeFileSync(target, JSON.stringify(out, null, 1) + "\n");
const played = all.filter((f) => f.hg != null).length;
const noTime = all.filter((f) => !f.tsi).length;
console.log(
  `yazıldı: ${target} — ${teams.length} takım, ${all.length} maç (${played} oynandı, ${noTime} saati belirsiz)`,
);
const missingTff = teams.filter((t) => !t.tffId).map((t) => t.id);
if (missingTff.length) console.log(`TFF id'si bulunamayan: ${missingTff.join(", ")}`);
