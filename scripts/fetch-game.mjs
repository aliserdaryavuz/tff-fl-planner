// TFF Fantezi Lig'in resmî verisini oyunun kendi API'sinden çeker:
// fikstür + hafta takvimi + skorlar ve oyuncu listesi (fiyat, seçilme oranı,
// sezon istatistikleri). İki dosyayı yeniler:
//
//   data/superlig-2026-27.json   takımlar, 306 maç, 34 hafta (son kayıt saatleri)
//   data/fantasy-players.json    oyuncular: fiyat, seçilme, puan, sezon toplamları
//
//   node scripts/fetch-game.mjs [--league 1]
//
// API Keycloak ile korunuyor ve giriş Google hesabıyla yapılıyor; bu yüzden
// istekler, projeye ayrılmış Chrome profilindeki oturum üzerinden geçer
// (scripts/lib/chrome.mjs). İlk kurulum: node scripts/chrome-login.mjs
//
// Takım meta verisi (opta, value, last, tffId) korunur: bu betik yalnız
// oyundan gelen alanları yazar.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "./lib/chrome.mjs";
import { TEAMS, teamIdOf } from "./lib/teams.mjs";

const args = process.argv.slice(2);
const idx = args.indexOf("--league");
const LEAGUE = idx >= 0 ? args[idx + 1] : "1";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const log = (m) => process.stderr.write(`${m}\n`);
const today = new Date();
const DATE = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;

const chrome = await connect();
log(`bağlandı: ${chrome.version.Browser}`);

async function get(path) {
  const r = await chrome.json(path);
  if (r.status !== 200 || !r.json?.data) {
    throw new Error(`${path}: ${r.status} ${r.body.slice(0, 200)}`);
  }
  return r.json.data;
}

const me = await get(`users/me?league-id=${LEAGUE}`).catch(() => null);
if (me) log(`oturum: ${me.email} (takım #${me.fantasyTeamId})`);
else log("oturum doğrulanamadı; giriş için: node scripts/chrome-login.mjs");

const [fixtures, clubs, players] = await Promise.all([
  get(`projection/stats/fixtures?league-id=${LEAGUE}`),
  get(`projection/stats/club-stats?league-id=${LEAGUE}`),
  get(`projection/stats/player-stats?league-id=${LEAGUE}`),
]);
await chrome.close();
log(`alındı: ${fixtures.gameweeks.length} hafta, ${clubs.length} kulüp, ${players.length} oyuncu`);

/* ---------- kulüp eşlemesi ---------- */

const idOfClub = new Map();
for (const c of clubs) {
  const id = teamIdOf(c.name);
  if (!id) throw new Error(`kulüp eşlenemedi: ${c.id} "${c.name}"`);
  idOfClub.set(c.id, id);
}
if (idOfClub.size !== 18) throw new Error(`18 kulüp bekleniyordu, ${idOfClub.size} geldi`);

/** UTC an -> Türkiye saati (sabit UTC+3): { date, tsi }. */
function toTsi(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: null, tsi: null };
  const t = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return {
    date: `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`,
    tsi: `${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`,
  };
}

/* ---------- fikstür dosyası ---------- */

const target = resolve(root, "data/superlig-2026-27.json");
const existing = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : null;
const prevTeam = new Map((existing?.teams ?? []).map((t) => [t.id, t]));

const clubById = new Map(clubs.map((c) => [c.id, c]));
const teams = TEAMS.map((t) => {
  const prev = prevTeam.get(t.id) ?? {};
  const club = clubs.find((c) => idOfClub.get(c.id) === t.id);
  return {
    ...prev,
    id: t.id,
    name: t.name,
    last: t.last,
    clubId: club?.id ?? null,
    shortName: club?.shortName ?? null,
    logoUrl: club?.logoUrl ?? null,
  };
});

const outFixtures = [];
const gameweeks = [];
for (const gw of fixtures.gameweeks) {
  gameweeks.push({
    md: gw.order,
    deadline: gw.deadline,
    start: gw.startDate,
    end: gw.endDate,
    finished: Boolean(gw.finished),
    avgPoints: gw.avgPoints ?? null,
    highestPoints: gw.highestPoints ?? null,
  });
  for (const m of gw.matches) {
    const when = toTsi(m.kickoffAt);
    outFixtures.push({
      md: gw.order,
      date: when.date,
      tsi: when.tsi,
      home: idOfClub.get(m.homeClubId),
      away: idOfClub.get(m.awayClubId),
      hg: m.homeScore ?? null,
      ag: m.awayScore ?? null,
      status: m.status ?? null,
      gameId: m.id,
    });
  }
}
outFixtures.sort(
  (a, b) => a.md - b.md || (a.date ?? "").localeCompare(b.date ?? "") || (a.tsi ?? "").localeCompare(b.tsi ?? ""),
);

const fixtureOut = {
  meta: {
    ...(existing?.meta ?? {}),
    season: "2026/27",
    league: "Trendyol Süper Lig",
    weeks: fixtures.gameweeks.length,
    source_fixtures: `TFF Fantezi Lig resmî API (tfffantezilig.com), ${DATE}`,
    currentGameweek: fixtures.currentGameweekOrder ?? null,
    editableGameweek: fixtures.editableGameweekOrder ?? null,
    editableDeadline: fixtures.editableGameweekDeadline ?? null,
    generated: new Date().toISOString().slice(0, 10),
  },
  teams,
  gameweeks,
  fixtures: outFixtures,
};
writeFileSync(target, JSON.stringify(fixtureOut, null, 1) + "\n");
const played = outFixtures.filter((f) => f.hg != null).length;
log(`yazıldı: ${target} — ${teams.length} takım, ${outFixtures.length} maç (${played} oynandı), ${gameweeks.length} hafta`);

/* ---------- oyuncu dosyası ---------- */

const playersTarget = resolve(root, "data/fantasy-players.json");
const prevPlayers = existsSync(playersTarget)
  ? JSON.parse(readFileSync(playersTarget, "utf8")).players
  : [];
/** Önceki dosyadaki FotMob eşlemesi oyun id'siyle taşınır. */
const fotmobByGameId = new Map(
  prevPlayers.filter((p) => p.gameId != null && p.fotmobId).map((p) => [String(p.gameId), p.fotmobId]),
);

/** Oyunun adı: maç adı (kısa) yoksa soyad, o da yoksa ad. */
const displayName = (p) =>
  (p.matchName || p.shortSurname || p.surname || p.shortName || p.name || "").trim();

const POS = new Set(["GK", "DEF", "MID", "FWD"]);
const skipped = { departed: 0, unknownClub: 0, unknownPos: 0 };
const outPlayers = [];
for (const p of players) {
  // Kulüpten ayrılan oyuncu seçilemez: listeye girmesin.
  if (p.availabilityStatus === "DEPARTED") {
    skipped.departed++;
    continue;
  }
  const team = idOfClub.get(p.clubId);
  if (!team) {
    skipped.unknownClub++;
    continue;
  }
  if (!POS.has(p.position)) {
    skipped.unknownPos++;
    continue;
  }
  outPlayers.push({
    name: displayName(p),
    team,
    pos: p.position,
    price: p.cost,
    sel: p.selectedByPct ?? null,
    // Sakatlık bu uçta yok (yalnız transfer durumu); FotMob'dan gelir.
    status: null,
    pts: p.totalPoints ?? 0,
    mins: p.minutes ?? 0,
    gameId: p.playerId,
    fotmobId: fotmobByGameId.get(String(p.playerId)) ?? null,
    // Resmî sezon toplamları: beklenen puan modelinin oranları buradan.
    goals: p.goals ?? 0,
    assists: p.assists ?? 0,
    cleanSheets: p.cleanSheets ?? 0,
    conceded: p.goalsConceded ?? 0,
    saves: p.saves ?? 0,
    yellow: p.yellowCards ?? 0,
    red: p.redCards ?? 0,
    bonus: p.bonus ?? 0,
    form: p.form ?? 0,
    ppm: p.pointsPerMatch ?? 0,
    news: p.availabilityNews || null,
    leaving: p.availabilityStatus === "PENDING_DEPARTURE" || null,
  });
}

// Oyunun doldurmadığı alanlar (ör. bps, xG, starts) sıfır geliyor; sıfır dolu
// bir sütun veri sanılmasın diye tamamen boş alanlar dosyaya yazılmaz.
const OPTIONAL = ["goals", "assists", "cleanSheets", "conceded", "saves", "yellow", "red", "bonus", "form", "ppm"];
const empty = OPTIONAL.filter((f) => outPlayers.every((p) => !p[f]));
for (const p of outPlayers) for (const f of empty) delete p[f];
if (empty.length) log(`oyunda boş gelen alanlar atlandı: ${empty.join(", ")}`);

outPlayers.sort(
  (a, b) =>
    a.team.localeCompare(b.team, "tr") ||
    ["GK", "DEF", "MID", "FWD"].indexOf(a.pos) - ["GK", "DEF", "MID", "FWD"].indexOf(b.pos) ||
    b.price - a.price ||
    a.name.localeCompare(b.name, "tr"),
);

// Aynı takımda aynı ad: modelde ve arayüzde ayırt edilebilsin diye numara eklenir.
const seen = new Map();
for (const p of outPlayers) {
  const key = `${p.team}|${p.name}`;
  const n = (seen.get(key) ?? 0) + 1;
  seen.set(key, n);
  if (n > 1) p.name = `${p.name} (${n})`;
}

const playersOut = {
  meta: {
    source: `TFF Fantezi Lig resmî API (tfffantezilig.com), ${DATE}`,
    fetched: new Date().toISOString().slice(0, 10),
    gameweek: fixtures.editableGameweekOrder ?? null,
    players: outPlayers.length,
    pricesFrom: "game",
    pointsCover: outPlayers.some((p) => p.pts > 0) ? "this-season" : "none",
  },
  players: outPlayers,
};
writeFileSync(playersTarget, JSON.stringify(playersOut, null, 1) + "\n");
log(
  `yazıldı: ${playersTarget} — ${outPlayers.length} oyuncu (atlanan: ${skipped.departed} ayrılan, ${skipped.unknownClub} kulüpsüz, ${skipped.unknownPos} mevkisiz)`,
);
log(`fiyat aralığı: ${Math.min(...outPlayers.map((p) => p.price))} - ${Math.max(...outPlayers.map((p) => p.price))} M TL`);
log("sıradaki: node scripts/fetch-squads.mjs (FotMob sakatlık ve id eşlemesi)");
void clubById;
