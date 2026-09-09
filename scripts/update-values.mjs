// Transfermarkt kadro değerleri: data/superlig-2026-27.json'daki `value`
// (milyon €) alanlarını ve meta.value_source tarihini yeniler.
//
//   node scripts/update-values.mjs [sayfa.html] ["gg.aa.yyyy"]
//
// Kaynak: https://www.transfermarkt.com.tr/super-lig/startseite/wettbewerb/TR1
// (18 kulübün toplam kadro değeri tek sayfada). Dosya verilmezse sayfa
// indirilir; Transfermarkt bot isteklerini bazen engeller, o zaman sayfayı
// tarayıcıdan kaydedip yolunu ver.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { teamIdOf } from "./lib/teams.mjs";

const [pagePath, dateArg] = process.argv.slice(2);
const today = new Date();
const DATE =
  dateArg ??
  `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;

let html;
if (pagePath) {
  html = readFileSync(pagePath, "utf8");
} else {
  const url = "https://www.transfermarkt.com.tr/super-lig/startseite/wettbewerb/TR1";
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
      "accept-language": "tr-TR,tr;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  html = await res.text();
}

/** "411.60 mil. €" -> 411.6; "903 bin €" -> 0.903 */
function money(s) {
  const m = s.replace(/\s+/g, " ").match(/([\d.,]+)\s*(mil|bin|mrd)/i);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  const unit = m[2].toLowerCase();
  return unit === "mrd" ? n * 1000 : unit === "bin" ? n / 1000 : n;
}

const rows = [...html.matchAll(/<td class="hauptlink no-border-links"><a title="([^"]+)"[\s\S]*?<\/tr>/g)];
const values = new Map();
for (const r of rows) {
  const cells = [...r[0].matchAll(/<td[^>]*class="[^"]*rechts[^"]*"[^>]*>([\s\S]*?)<\/td>/g)].map((c) =>
    c[1].replace(/<[^>]+>/g, "").trim(),
  );
  // Son "rechts" hücresi toplam kadro değeri.
  const total = cells.length ? money(cells[cells.length - 1]) : null;
  const id = teamIdOf(r[1]);
  if (id && total != null) values.set(id, total);
  else console.error(`atlandı: "${r[1]}" -> ${id} / ${cells.join(" | ")}`);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const path = resolve(root, "data/superlig-2026-27.json");
const data = JSON.parse(readFileSync(path, "utf8"));
const missing = [];
let changed = 0;
for (const team of data.teams) {
  const v = values.get(team.id);
  if (v == null) {
    missing.push(team.id);
    continue;
  }
  if (team.value !== v) changed++;
  team.value = v;
}
if (missing.length) {
  console.error(`Transfermarkt'ta bulunamayan takımlar: ${missing.join(", ")}`);
  process.exit(1);
}
data.meta.value_source = `Transfermarkt kadro değeri (transfermarkt.com.tr), ${DATE}`;
writeFileSync(path, JSON.stringify(data, null, 1) + "\n");
console.log(`${data.teams.length} takım işlendi, ${changed} değer değişti; kaynak tarihi ${DATE}`);
for (const t of data.teams) console.log(`  ${t.id.padEnd(15)} ${t.value} mil. €`);
