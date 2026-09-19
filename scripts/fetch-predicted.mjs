// Sıradaki haftanın tahmini / resmî ilk 11'lerini FotMob maç sayfalarından
// toplar ve data/predicted-xi.json'a yazar.
//
//   node scripts/fetch-predicted.mjs <hafta>
//
// FotMob: oynanmamış lig maçının sayfasında lineupType "predicted" (Enetpulse
// tahmini) ya da maça ~1 saat kala "confirmed" (resmî kadro); yanında maç
// öncesi sakat/cezalı listesi. Oyuncular önce data/lineups.json'daki FotMob
// id eşlemesiyle, sonra adla eşlenir; iki aday varsa eşlenmez.
// Hafta içinde maç günü yeniden koşmak gerekir (kadrolar açıklanınca).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nextMatchdayFrom } from "../lib/matchday.mjs";
import { FOTMOB, matchPage, teamFixtures } from "./lib/fotmob.mjs";
import { matchShortName } from "./lib/names.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Hafta verilmezse planlanacak hafta: zamanlanmış iş her gün elle numara
// veremez (.github/workflows/data.yml). Kural uygulamayla ortak
// (`lib/matchday.mjs`), ikinci bir kopya sessizce sapardı.
const matchday = Number(process.argv[2]) || defaultMatchday();
if (!matchday) {
  console.error("kullanım: node scripts/fetch-predicted.mjs [hafta]");
  process.exit(1);
}

function defaultMatchday() {
  const file = JSON.parse(readFileSync(resolve(root, "data/superlig-2026-27.json"), "utf8"));
  return nextMatchdayFrom(file.meta, file.fixtures, 34);
}
const fantasy = JSON.parse(readFileSync(resolve(root, "data/fantasy-players.json"), "utf8"));
const lineups = JSON.parse(readFileSync(resolve(root, "data/lineups.json"), "utf8"));

const log = (m) => process.stderr.write(`${m}\n`);
const poolOf = (team) => fantasy.players.filter((p) => p.team === team);

/** FotMob id -> oyun dosyası adı. */
const byFotmobId = new Map();
for (const p of fantasy.players) if (p.fotmobId) byFotmobId.set(`${p.team}|${p.fotmobId}`, p.name);
for (const [key, v] of Object.entries(lineups.players ?? {})) {
  const [team, name] = key.split("|");
  byFotmobId.set(`${team}|${v.fotmobId}`, name);
}

const teams = {};
const teamRec = (id) => (teams[id] ??= { sources: [], unavailable: [] });

const seen = new Set();
for (const [id, [fotmobId, slug]] of Object.entries(FOTMOB)) {
  const next = teamFixtures(fotmobId, slug, { cache: false })
    .filter((f) => !f.finished && /s[uü]per lig/i.test(f.competition))
    .sort((a, b) => a.utc.localeCompare(b.utc))[0];
  if (!next) {
    log(`  ${id}: sıradaki lig maçı bulunamadı`);
    continue;
  }
  if (seen.has(next.id)) continue;
  seen.add(next.id);
  const page = matchPage(next.pageUrl, { cache: false });
  const L = page?.lineup;
  // FotMob üç tip veriyor: maç saatine yakın "confirmed" (resmî kadro),
  // öncesinde "predicted" (Enetpulse tahmini) ya da "lastStarting11"
  // (takımın son çıktığı 11). Sonuncusu zayıf bir sinyal ama yine de bilgi.
  if (!L || !["predicted", "confirmed", "lastStarting11"].includes(L.lineupType)) {
    log(`  ${id}: ${next.home} - ${next.away}: kadro yok (${L?.lineupType ?? "-"})`);
    continue;
  }
  for (const side of [L.homeTeam, L.awayTeam]) {
    const entry = Object.entries(FOTMOB).find(([, [fid]]) => fid === side?.id);
    if (!entry) continue;
    const tid = entry[0];
    const pool = poolOf(tid);
    const match = (p) => {
      const known = byFotmobId.get(`${tid}|${p.id}`);
      if (known) return { name: known };
      return matchShortName(p.name, pool);
    };
    const starters = [];
    const unmatched = [];
    for (const p of side.starters ?? []) {
      const hit = match(p);
      if (hit) starters.push(hit.name);
      else unmatched.push(p.name);
    }
    teamRec(tid).sources.push({
      source: "FotMob",
      kind: L.lineupType,
      match: `${next.home} - ${next.away}`,
      starters,
      unmatched,
    });
    const un = [];
    for (const u of side.unavailable ?? []) {
      const hit = match(u);
      if (hit) un.push(hit.name);
    }
    const rec = teamRec(tid);
    rec.unavailable = [...new Set([...rec.unavailable, ...un])];
    log(`  ${tid} [${L.lineupType}]: ${starters.length}/11${unmatched.length ? ` (eşleşmeyen: ${unmatched.join(", ")})` : ""}`);
  }
}

const out = {
  meta: {
    source: "FotMob (fotmob.com)",
    fetched: new Date().toISOString().slice(0, 10),
    matchday,
    previews: seen.size,
  },
  teams,
};
const target = resolve(root, "data/predicted-xi.json");
writeFileSync(target, JSON.stringify(out, null, 1) + "\n");
log(`yazıldı: ${target} (${Object.keys(teams).length} takım)`);
