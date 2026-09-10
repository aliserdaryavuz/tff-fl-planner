// Fikstürü bağımsız bir kaynakla doğrular: TFF'nin resmî sayfasını okur ve
// data/superlig-2026-27.json ile karşılaştırır. Hiçbir şey yazmaz; yalnız
// farkları listeler (saat değişikliği, erteleme, skor uyuşmazlığı).
//
//   node scripts/verify-fixtures.mjs [--weeks 1-34]
//
// Ana veri oyunun kendi API'sinden geliyor (scripts/fetch-game.mjs); bu betik
// onu doğrulamak için var. Kaynak: tff.org, windows-1254 kodlu ASP.NET sayfası.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { teamIdOf } from "./lib/teams.mjs";

const args = process.argv.slice(2);
const i = args.indexOf("--weeks");
const [FROM, TO] = (i >= 0 ? args[i + 1] : "1-34").split("-").map(Number);

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(resolve(root, "data/superlig-2026-27.json"), "utf8"));
const log = (m) => process.stdout.write(`${m}\n`);

async function fetchWeek(week) {
  const url = `https://www.tff.org/default.aspx?pageID=198&hafta=${week}`;
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return new TextDecoder("windows-1254").decode(await res.arrayBuffer());
}

const clean = (s) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();

/** Bir haftanın sayfasındaki maç satırları. */
function parseWeek(html, week) {
  const blocks = html.split(/dtlHaftaninMaclari_ctl\d+_ayrt1/).slice(1);
  const rows = [];
  for (const b of blocks) {
    const get = (label) => {
      const m = b.match(new RegExp(`_${label}">([^<]*)<`));
      return m ? clean(m[1]) : "";
    };
    const date = get("lblTarih");
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(date)) continue;
    const time = get("lblSaat");
    const [d, mo, y] = date.split(".");
    const hg = get("Label5");
    const ag = get("Label6");
    rows.push({
      md: week,
      date: `${y}-${mo}-${d}`,
      tsi: /^\d{2}:\d{2}$/.test(time) ? time : null,
      home: teamIdOf(get("Label4")),
      away: teamIdOf(get("Label1")),
      hg: hg === "" ? null : Number(hg),
      ag: ag === "" ? null : Number(ag),
    });
  }
  return rows;
}

let checked = 0;
let missing = 0;
const diffs = [];
for (let week = FROM; week <= TO; week++) {
  const rows = parseWeek(await fetchWeek(week), week);
  for (const r of rows) {
    if (!r.home || !r.away) {
      log(`${week}. hafta: takım eşlenemedi, atlandı`);
      continue;
    }
    const mine = data.fixtures.find((f) => f.md === week && f.home === r.home && f.away === r.away);
    if (!mine) {
      missing++;
      diffs.push(`${week}. hafta ${r.home}-${r.away}: bizde bu haftada yok (erteleme olabilir)`);
      continue;
    }
    checked++;
    if (mine.date !== r.date) diffs.push(`${week}. hafta ${r.home}-${r.away}: tarih ${mine.date} ≠ TFF ${r.date}`);
    if (r.tsi && mine.tsi !== r.tsi) diffs.push(`${week}. hafta ${r.home}-${r.away}: saat ${mine.tsi} ≠ TFF ${r.tsi}`);
    if (r.hg != null && (mine.hg !== r.hg || mine.ag !== r.ag)) {
      diffs.push(`${week}. hafta ${r.home}-${r.away}: skor ${mine.hg}-${mine.ag} ≠ TFF ${r.hg}-${r.ag}`);
    }
  }
  process.stderr.write(`${week}. hafta okundu\n`);
}

log(`\n${checked} maç karşılaştırıldı, ${missing} maç eşleşmedi, ${diffs.length} fark:`);
for (const d of diffs) log(`  ${d}`);
if (!diffs.length) log("  (fark yok)");
