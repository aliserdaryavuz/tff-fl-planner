// 18 kulübün kadrosunu FotMob'dan alır ve data/fantasy-players.json'a yazar.
//
//   node scripts/fetch-squads.mjs [--fresh]
//
// Oyun (tfffantezilig.com) oyuncu listesi giriş gerektirdiği için ilk oyuncu
// havuzu buradan gelir: ad, mevki (FotMob rolü), sakatlık, FotMob id. Fiyat ve
// seçilme oranı yok (null) — bunlar scripts/fetch-game.mjs ile oyundan
// gelir. Dosyada oyundan gelen fiyatlar varsa (meta.pricesFrom = "game") liste
// korunur, yalnızca FotMob id eşlemesi ve sakatlık bilgisi tazelenir.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FOTMOB, teamSquad } from "./lib/fotmob.mjs";
import { matchFantasyName, matchShortName } from "./lib/names.mjs";

/**
 * Oyun dosyasındaki adlar kısa ("Osimhen", "Salah"); önce soyad odaklı
 * eşleyici, tutmazsa tam ad eşleyicisi denenir.
 */
const matchPlayer = (name, pool) => matchShortName(name, pool) ?? matchFantasyName(name, pool);

const FRESH = process.argv.includes("--fresh");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "data/fantasy-players.json");
const log = (m) => process.stderr.write(`${m}\n`);

/** FotMob rol anahtarı -> oyun mevkisi. */
const POS = {
  keeper: "GK",
  keeper_long: "GK",
  defender: "DEF",
  defender_long: "DEF",
  midfielder: "MID",
  midfielder_long: "MID",
  attacker: "FWD",
  attacker_long: "FWD",
};

const existing = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : null;
const keepGame = existing?.meta?.pricesFrom === "game";

const players = [];
const fotmobByTeam = {};
for (const [team, [id, slug]] of Object.entries(FOTMOB)) {
  const squad = teamSquad(id, slug, { cache: !FRESH });
  if (!squad) {
    log(`${team}: kadro alınamadı`);
    continue;
  }
  const members = [];
  for (const group of squad) {
    if (group.title === "coach") continue;
    for (const m of group.members ?? []) {
      const pos = POS[m.role?.key ?? ""];
      if (!pos) continue;
      members.push({
        fotmobId: m.id,
        name: m.name,
        pos,
        injured: Boolean(m.injured || m.injury),
        injury: m.injury?.expectedReturn ?? null,
      });
    }
  }
  fotmobByTeam[team] = members;
  log(`${team}: ${members.length} oyuncu`);
  if (!keepGame) {
    for (const m of members) {
      players.push({
        name: m.name,
        team,
        pos: m.pos,
        price: null,
        sel: null,
        status: m.injured ? "I" : null,
        pts: 0,
        mins: 0,
        fotmobId: m.fotmobId,
      });
    }
  }
}

let out;
if (keepGame) {
  // Oyun listesi esas; FotMob id ve sakatlık bilgisi ada göre eşlenir.
  let matched = 0;
  const merged = existing.players.map((p) => {
    const pool = fotmobByTeam[p.team] ?? [];
    const hit = matchPlayer(p.name, pool);
    if (!hit) return { ...p, fotmobId: p.fotmobId ?? null };
    matched++;
    return {
      ...p,
      fotmobId: hit.fotmobId,
      // Oyunun kendi durumu varsa o kalır; yoksa FotMob sakatlığı.
      status: p.status ?? (hit.injured ? "I" : null),
    };
  });
  log(`oyun listesi korundu: ${matched}/${existing.players.length} oyuncu FotMob ile eşleşti`);
  out = { ...existing, meta: { ...existing.meta, fotmobMatched: matched }, players: merged };
} else {
  players.sort(
    (a, b) =>
      a.team.localeCompare(b.team, "tr") ||
      ["GK", "DEF", "MID", "FWD"].indexOf(a.pos) - ["GK", "DEF", "MID", "FWD"].indexOf(b.pos) ||
      a.name.localeCompare(b.name, "tr"),
  );
  out = {
    meta: {
      source: `FotMob kadro sayfaları (fotmob.com), ${new Date().toISOString().slice(0, 10)}`,
      gameweek: null,
      players: players.length,
      // Fiyatlar oyundan gelmedi: kadro kurucu fiyat bekliyor.
      pricesFrom: "none",
      pointsCover: "none",
    },
    players,
  };
}

writeFileSync(target, JSON.stringify(out, null, 1) + "\n");
log(`yazıldı: ${target} (${out.players.length} oyuncu)`);
