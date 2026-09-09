// Opta Power Rankings güncellemesi: data/superlig-2026-27.json'daki `opta`
// alanlarını ve meta.opta_source tarihini yeniler.
//
//   node scripts/update-opta.mjs [index.js] ["gg.aa.yyyy"]
//
// Kaynak: https://dataviz.theanalyst.com/opta-power-rankings/ sayfasının
// uygulama paketi (index.js, ~17 MB). Tüm takımların güncel puanı paketin
// içine gömülü; sayfa yalnızca ilk 100'ü gösterdiği için paket okunuyor.
// Dosya yolu verilmezse paket indirilir. Aynı adla birden çok kayıt varsa
// (kadın takımı, altyapı) sıralaması iyi olan alınır.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TEAMS, norm } from "./lib/teams.mjs";

const [bundlePath, dateArg] = process.argv.slice(2);
const today = new Date();
const DATE =
  dateArg ??
  `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;

let js;
if (bundlePath) {
  js = readFileSync(bundlePath, "utf8");
} else {
  const url = "https://dataviz.theanalyst.com/opta-power-rankings/index.js";
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  js = await res.text();
}

/** Opta'daki takım adı (normalize) -> data id. Anahtar kelime tablosu yetmeyenler. */
const OPTA_NAME = {
  amed: "Amedspor",
  corum: "Corum",
  gaziantep: "Gaziantep",
  rizespor: "Rizespor",
  rize: "Rizespor",
  "istanbul basaksehir": "Basaksehir",
  basaksehir: "Basaksehir",
};

// Paket JS dizgeleri \uXXXX kaçışlı olabilir.
const unescape = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

const re =
  /\{"rank":(\d+),"contestantId":"[^"]+","contestantName":"([^"]+)","contestantShortName":"([^"]*)","contestantClubName":"([^"]*)","contestantCode":"([^"]*)","currentRating":([\d.]+)/g;

const byName = new Map();
let m;
while ((m = re.exec(js))) {
  const name = norm(unescape(m[2]));
  const rec = { rank: Number(m[1]), name, club: unescape(m[4]), rating: Number(m[6]) };
  // `rank` paketin kendi lig sıralaması, global değil; aynı adlı kayıtlar
  // (kadın/altyapı takımı) arasında puanı yüksek olan A takımıdır.
  const prev = byName.get(name);
  if (!prev || rec.rating > prev.rating) byName.set(name, rec);
}
if (byName.size < 1000) {
  console.error(`paket beklenen veriyi içermiyor (${byName.size} kayıt)`);
  process.exit(1);
}

function find(team) {
  const direct = byName.get(norm(team.name)) ?? byName.get(norm(team.id));
  if (direct) return direct;
  const alias = Object.entries(OPTA_NAME).find(([, id]) => id === team.id);
  for (const [key, id] of Object.entries(OPTA_NAME)) {
    if (id === team.id && byName.get(key)) return byName.get(key);
  }
  // Anahtar kelime: adı içeren en yüksek puanlı kayıt.
  const cands = [...byName.values()].filter((r) => ` ${r.name} `.includes(` ${team.key}`));
  cands.sort((a, b) => b.rating - a.rating);
  void alias;
  return cands[0] ?? null;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const path = resolve(root, "data/superlig-2026-27.json");
const data = JSON.parse(readFileSync(path, "utf8"));

const missing = [];
let changed = 0;
for (const team of data.teams) {
  const spec = TEAMS.find((t) => t.id === team.id);
  const rec = find(spec ?? { id: team.id, name: team.name, key: norm(team.name) });
  if (!rec) {
    missing.push(team.id);
    continue;
  }
  const next = Math.round(rec.rating * 10) / 10;
  if (team.opta !== next) changed++;
  team.opta = next;
  team.optaRank = rec.rank;
}
if (missing.length) {
  console.error(`Opta'da bulunamayan takımlar: ${missing.join(", ")}`);
  process.exit(1);
}
data.meta.opta_source = `Opta Power Rankings (theanalyst.com), ${DATE}`;
writeFileSync(path, JSON.stringify(data, null, 1) + "\n");
console.log(`${data.teams.length} takım işlendi, ${changed} değer değişti; kaynak tarihi ${DATE}`);
for (const t of data.teams) console.log(`  ${t.id.padEnd(15)} ${t.opta}  (#${t.optaRank})`);
