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
        shirt: m.shirtNumber ?? null,
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
  // Oyun listesi esas; FotMob id ve sakatlık bilgisi eşlemeyle bulunur.
  //
  // Eşleme **tek yönlü**: bir FotMob oyuncusu yalnız bir oyun kaydına bağlanır.
  // Sıra güçlüden zayıfa — önce tam ad, sonra görünen kısa ad, en sonda forma
  // numarası; forma yalnız ad da örtüşüyorsa sayılır.
  //
  // Neden böyle: forma numarası 12.09'da tek başına birincil anahtar sanılmıştı.
  // İki kaynağın numaraları her zaman aynı değil ve kontrol yalnız "FotMob
  // tarafında tek mi" diye bakıyordu. Sonuç: oyunun 4 numarası "Çağlar Söyüncü",
  // FotMob'un 4 numarası "Serdar Saatçi" — 457 eşlemenin 109'unda ortak ad
  // parçası yoktu ve 64 FotMob oyuncusu birden çok kayda bağlanmıştı (Çorum'da
  // biri üç kayda). Yanlış bağlanan oyuncu başkasının dakikalarını devralıyor,
  // yani başlama olasılığı ve kadro yanlış çıkıyordu.
  const norm = (s) =>
    String(s ?? "")
      .toLocaleLowerCase("tr")
      .replace(/ı/g, "i")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z ]/g, " ")
      .trim();
  /** İki adın en az bir anlamlı kelimesi ortak mı (kısa ekler sayılmaz). */
  const shareToken = (a, b) => {
    const left = new Set(norm(a).split(/\s+/).filter((t) => t.length > 2));
    return norm(b)
      .split(/\s+/)
      .some((t) => t.length > 2 && left.has(t));
  };

  const keyOf = (p) => `${p.team}|${p.name}`;
  const claimed = new Set();
  const assigned = new Map();
  const claim = (p, hit) => {
    assigned.set(keyOf(p), hit);
    claimed.add(`${p.team}|${hit.fotmobId}`);
  };
  /** O kulüpten henüz kimseye bağlanmamış FotMob oyuncuları. */
  const free = (p) =>
    (fotmobByTeam[p.team] ?? []).filter((m) => !claimed.has(`${p.team}|${m.fotmobId}`));

  const byName = { full: 0, short: 0, shirt: 0 };
  for (const p of existing.players) {
    if (!p.fullName) continue;
    const hit = matchPlayer(p.fullName, free(p));
    if (hit) {
      claim(p, hit);
      byName.full++;
    }
  }
  for (const p of existing.players) {
    if (assigned.has(keyOf(p))) continue;
    const hit = matchPlayer(p.name, free(p));
    if (hit) {
      claim(p, hit);
      byName.short++;
    }
  }
  for (const p of existing.players) {
    if (assigned.has(keyOf(p)) || p.shirt == null) continue;
    const byShirt = free(p).filter((m) => m.shirt === p.shirt);
    // Ad örtüşmesi şart: numara tek başına yanlış oyuncuyu bağlıyordu.
    if (byShirt.length !== 1 || !shareToken(p.fullName || p.name, byShirt[0].name)) continue;
    claim(p, byShirt[0]);
    byName.shirt++;
  }

  let matched = 0;
  const merged = existing.players.map((p) => {
    const hit = assigned.get(keyOf(p));
    // Eski dosyadaki id taşınmıyor: yanlış bağlanmış bir id sonsuza kadar kalırdı.
    if (!hit) return { ...p, fotmobId: null };
    matched++;
    return {
      ...p,
      fotmobId: hit.fotmobId,
      // Oyunun kendi durumu varsa o kalır; yoksa FotMob sakatlığı.
      status: p.status ?? (hit.injured ? "I" : null),
    };
  });
  log(`oyun listesi korundu: ${matched}/${existing.players.length} oyuncu FotMob ile eşleşti`);
  log(`  tam ad ${byName.full} · kısa ad ${byName.short} · forma no ${byName.shirt}`);
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
