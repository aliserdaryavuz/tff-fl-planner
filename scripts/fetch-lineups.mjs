// 18 kulübün son resmi maç kadrolarını (ilk 11, dakika, gol, asist, kart,
// takımın yediği gol, sakat/cezalı listesi) FotMob sayfalarından toplar ve
// data/lineups.json'a yazar.
//
//   node scripts/fetch-lineups.mjs [--matches 6] [--teams Galatasaray,Fenerbahce] [--fresh]
//
// FotMob'un API'si tarayıcı dışından kapalı; sayfalar Next.js uygulaması ve
// tüm veri sayfanın içindeki __NEXT_DATA__ JSON'unda. Her sayfa headless Chrome
// ile açılır (CHROME ortam değişkeniyle yol değiştirilebilir). ~18 fikstür
// sayfası + ~60-100 maç sayfası, 8-15 dakika. Bitmiş maç sayfaları önbelleğe
// alınır; --fresh yeniden indirir.
//
// Oyuncular oyun dosyasındaki (data/fantasy-players.json) adlarla eşlenir;
// FotMob id'si varsa doğrudan onunla. Maç başına olay kaydı TFF puan
// tablosuyla (lib/scoring.ts) gerçek fantasy puanına çevrilebilsin diye
// ayrıntılı tutulur.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bonusPoints, matchPoints } from "../lib/scoring.mjs";
import { FOTMOB, matchPage, teamFixtures } from "./lib/fotmob.mjs";
import { matchFantasyName as matchName } from "./lib/names.mjs";

/** FotMob usualPlayingPositionId -> mevki. */
const POS_BY_ID = { 0: "GK", 1: "DEF", 2: "MID", 3: "FWD" };

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const MATCHES = Number(opt("matches", 6));
const ONLY = opt("teams", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const FRESH = args.includes("--fresh");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fantasy = JSON.parse(readFileSync(resolve(root, "data/fantasy-players.json"), "utf8"));

function log(msg) {
  process.stderr.write(`${new Date().toISOString().slice(11, 19)} ${msg}\n`);
}

/** Olay listesinden sayılar: gol, asist, sarı, kırmızı, kendi kalesine, kaçan penaltı. */
function countEvents(events = []) {
  const n = { goals: 0, assists: 0, yellow: 0, red: 0, ownGoals: 0, penMissed: 0, penSaved: 0 };
  for (const e of events) {
    const t = String(e.type ?? "").toLowerCase();
    if (t === "goal") n.goals++;
    else if (t === "assist") n.assists++;
    else if (t === "yellowcard") n.yellow++;
    else if (t === "redcard" || t === "yellowred" || t === "secondyellow") n.red++;
    else if (t === "owngoal") n.ownGoals++;
    else if (t === "penaltymissed" || t === "missedpenalty") n.penMissed++;
    else if (t === "penaltysaved" || t === "savedpenalty") n.penSaved++;
  }
  return n;
}

/** Bir takımın bir maçtaki oyuncuları: başladı mı, kaç dakika, olaylar. */
function sideAppearances(side, conceded) {
  const rows = [];
  const add = (p, started, minutes) => {
    rows.push({
      id: p.id,
      name: p.name,
      pos: POS_BY_ID[p.usualPlayingPositionId] ?? (p.positionId === 11 ? "GK" : "MID"),
      started,
      minutes,
      rating: p.performance?.rating ?? null,
      ...countEvents(p.performance?.events),
      conceded,
      cleanSheet: conceded === 0 && minutes >= 60,
    });
  };
  for (const p of side.starters ?? []) {
    const out = (p.performance?.substitutionEvents ?? []).find((e) => e.type === "subOut");
    add(p, true, out ? out.time : 90);
  }
  for (const p of side.subs ?? []) {
    const on = (p.performance?.substitutionEvents ?? []).find((e) => e.type === "subIn");
    add(p, false, on ? Math.max(0, 90 - on.time) : 0);
  }
  return rows;
}

const players = {};
const unmatched = {};
const teamsOut = {};

const teams = Object.entries(FOTMOB).filter(([id]) => !ONLY.length || ONLY.includes(id));
let done = 0;
for (const [team, [fotmobId, slug]] of teams) {
  log(`${team}: fikstür`);
  const fixtures = teamFixtures(fotmobId, slug, { cache: false })
    .filter((f) => f.finished && f.utc && !/friendl/i.test(f.competition))
    .sort((a, b) => b.utc.localeCompare(a.utc))
    .slice(0, MATCHES);

  const perPlayer = new Map(); // fotmob id -> { name, recent: [] }
  let unavailable = [];
  let withLineup = 0;
  for (const f of fixtures) {
    log(`${team}: maç ${f.id} (${f.utc.slice(0, 10)}, ${f.competition})`);
    const page = matchPage(f.pageUrl, { cache: !FRESH });
    const L = page?.lineup;
    const isHome = L?.homeTeam?.id === fotmobId;
    const side = isHome ? L?.homeTeam : L?.awayTeam?.id === fotmobId ? L.awayTeam : null;
    if (!side) continue;
    withLineup++;
    const conceded = page.conceded?.[isHome ? "home" : "away"] ?? null;
    // Bonus (3/2/1) maçtaki tüm oyuncuların TFF puanına göre: iki taraf birden.
    const other = isHome ? L.awayTeam : L.homeTeam;
    const otherConceded = page.conceded?.[isHome ? "away" : "home"] ?? null;
    const ours = sideAppearances(side, conceded);
    const theirs = other ? sideAppearances(other, otherConceded) : [];
    const everyone = [...ours, ...theirs];
    const points = everyone.map((a) =>
      matchPoints(a.pos, {
        minutes: a.minutes,
        goals: a.goals,
        assists: a.assists,
        conceded: a.conceded ?? undefined,
        penSaved: a.penSaved,
        penMissed: a.penMissed,
        yellow: a.yellow,
        red: a.red,
        ownGoals: a.ownGoals,
      }),
    );
    const bonus = bonusPoints(points);
    ours.forEach((a, i) => {
      a.bonus = bonus[i];
      a.fpts = points[i];
    });
    for (const a of ours) {
      const entry = perPlayer.get(a.id) ?? { name: a.name, recent: [] };
      const rest = Object.fromEntries(Object.entries(a).filter(([k]) => !["id", "name", "pos"].includes(k)));
      entry.recent.push({
        date: page.date || f.utc.slice(0, 10),
        competition: page.competition || f.competition,
        ...rest,
      });
      perPlayer.set(a.id, entry);
    }
    // Sakat/cezalı listesi en yeni maçtan.
    if (withLineup === 1) {
      unavailable = (side.unavailable ?? []).map((u) => ({
        id: u.id,
        name: u.name,
        type: u.unavailability?.type ?? "unknown",
        until: u.unavailability?.expectedReturnDate ?? null,
      }));
    }
  }

  const pool = [...perPlayer.entries()].map(([id, e]) => ({ id, name: e.name }));
  const unavailPool = unavailable.map((u) => ({ id: u.id, name: u.name }));
  const matchedIds = new Set();
  for (const fp of fantasy.players.filter((p) => p.team === team)) {
    const key = `${team}|${fp.name}`;
    // Önce FotMob id (kadro betiğinden), sonra ad eşleme.
    const byId = fp.fotmobId
      ? (pool.find((p) => p.id === fp.fotmobId) ?? unavailPool.find((p) => p.id === fp.fotmobId))
      : null;
    // Oyunun kısa adı ("Arda") takım içinde tekrar edebiliyor; tam ad daha güvenli.
    const hit =
      byId ??
      (fp.fullName ? (matchName(fp.fullName, pool) ?? matchName(fp.fullName, unavailPool)) : null) ??
      matchName(fp.name, pool) ??
      matchName(fp.name, unavailPool);
    if (!hit) continue;
    matchedIds.add(hit.id);
    const entry = perPlayer.get(hit.id);
    const un = unavailable.find((u) => u.id === hit.id);
    players[key] = {
      fotmobId: hit.id,
      fotmobName: hit.name,
      recent: entry?.recent ?? [],
      unavailable: un ? { type: un.type, until: un.until } : null,
    };
  }
  unmatched[team] = pool.filter((p) => !matchedIds.has(p.id)).map((p) => p.name);
  teamsOut[team] = { matches: withLineup, players: pool.length };
  done++;
  log(
    `${team}: ${withLineup} maç, ${pool.length} oyuncu, ${Object.keys(players).filter((k) => k.startsWith(team + "|")).length} eşleşti (${done}/${teams.length})`,
  );
}

const out = {
  meta: {
    source: "FotMob (fotmob.com)",
    fetched: new Date().toISOString().slice(0, 10),
    matchesPerTeam: MATCHES,
    teams: teamsOut,
  },
  players,
  unmatched,
};
const target = resolve(root, "data/lineups.json");
writeFileSync(target, JSON.stringify(out, null, 1) + "\n");
log(`yazıldı: ${target} (${Object.keys(players).length} oyuncu)`);
