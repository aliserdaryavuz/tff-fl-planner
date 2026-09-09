// TFF Fantezi Lig oyuncu listesini (fiyat, mevki, takım, seçilme oranı, durum,
// puan) oyunun kendi arka ucundan alır ve data/fantasy-players.json'a yazar.
//
//   node scripts/fetch-players.mjs [--gameweek 5] [--dump] [--only-dump]
//
// Oyunun API'si (api.tfffantezilig.com) giriş ister; site kendi arka ucuna
// /api/backend/<yol> ile çerezle geçer. Bu betik önce /api/auth/login ile
// giriş yapar (e-posta + şifre, .env.local'daki TFF_EMAIL / TFF_PASSWORD),
// sonra oyuncu listesi için bilinen yolları dener. Yollar oyunun JS
// paketlerinden ve 401/403 sondalarından çıkarıldı (players, teams, matches,
// stats, fantasy-team, user/me: 401 = var ama giriş ister; gerisi 403).
// Yanıt biçimi henüz görülmediği için:
//   --dump: her yanıtı olduğu gibi önbellek klasörüne yazar (incelemek için),
//   normalize: yanıt içinde ad/fiyat/mevki/takım benzeri alanlar taşıyan ilk
//   dizi bulunur ve oyun dosyasına çevrilir; bulunamazsa hata verilir ve
//   dökümlere bakılır.
//
// Hesap bilgisi hiçbir zaman repoya girmez (.env.local gitignore'da).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { teamIdOf } from "./lib/teams.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const DUMP = args.includes("--dump") || args.includes("--only-dump");
const ONLY_DUMP = args.includes("--only-dump");
const GAMEWEEK = Number(opt("gameweek", 0)) || null;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "data/fantasy-players.json");
const DUMP_DIR = resolve(
  process.env.LOCALAPPDATA ?? process.env.TMPDIR ?? ".",
  "tff-fl-planner-cache/game",
);
mkdirSync(DUMP_DIR, { recursive: true });
const log = (m) => process.stderr.write(`${m}\n`);

// .env.local
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const EMAIL = process.env.TFF_EMAIL;
const PASSWORD = process.env.TFF_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error("TFF_EMAIL ve TFF_PASSWORD gerekli (.env.local ya da ortam değişkeni).");
  process.exit(1);
}

const SITE = "https://tfffantezilig.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36";
const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(res) {
  const set = res.headers.getSetCookie?.() ?? [];
  for (const c of set) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}

async function call(path, init = {}) {
  const res = await fetch(`${SITE}${path}`, {
    ...init,
    headers: {
      "user-agent": UA,
      accept: "application/json",
      ...(init.headers ?? {}),
      ...(jar.size ? { cookie: cookieHeader() } : {}),
    },
    redirect: "manual",
  });
  storeCookies(res);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // JSON değil
  }
  return { status: res.status, json, text };
}

/* ---------- giriş ---------- */

log("giriş yapılıyor…");
const login = await call("/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL.trim(), password: PASSWORD }),
});
if (login.status !== 200 || login.json?.ok !== true) {
  console.error(`giriş başarısız (${login.status}): ${login.text.slice(0, 300)}`);
  process.exit(1);
}
log(`giriş tamam: ${login.json.user?.email ?? EMAIL}`);

/* ---------- yollar ---------- */

const LEAGUE = process.env.TFF_LEAGUE_ID ?? "1";
const CANDIDATES = [
  "players",
  `players?league-id=${LEAGUE}`,
  "players/all",
  "players/list",
  "teams",
  "teams/players",
  "matches",
  `matches?league-id=${LEAGUE}`,
  "stats",
  "fantasy-team",
  "user/me",
  "user",
];

const dumps = {};
for (const path of CANDIDATES) {
  const r = await call(`/api/backend/${path}`);
  const size = r.text.length;
  log(`  ${path}: ${r.status}, ${size} bayt`);
  if (r.status === 200 && r.json) dumps[path] = r.json;
  if (DUMP && r.status === 200) {
    const file = resolve(DUMP_DIR, `${path.replace(/[^a-z0-9]+/gi, "_")}.json`);
    writeFileSync(file, r.text);
    log(`    döküm: ${file}`);
  }
}
if (ONLY_DUMP) process.exit(0);

/* ---------- normalize ---------- */

/** Yanıt ağacında oyuncu listesine benzeyen (ad + fiyat + mevki alanlı nesneler) ilk diziyi bul. */
function findPlayerArray(node, depth = 0) {
  if (!node || depth > 6) return null;
  if (Array.isArray(node)) {
    if (node.length > 100 && typeof node[0] === "object") {
      const keys = Object.keys(node[0]).map((k) => k.toLowerCase());
      const hasName = keys.some((k) => /name|ad|isim/.test(k));
      const hasPrice = keys.some((k) => /price|fiyat|value|cost|deger/.test(k));
      const hasPos = keys.some((k) => /pos|mevki|position|role/.test(k));
      if (hasName && hasPrice && hasPos) return node;
    }
    for (const item of node) {
      const hit = findPlayerArray(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof node === "object") {
    for (const v of Object.values(node)) {
      const hit = findPlayerArray(v, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

const pick = (obj, patterns) => {
  for (const [k, v] of Object.entries(obj)) {
    if (patterns.some((p) => p.test(k))) return v;
  }
  return undefined;
};

const POS = {
  1: "GK", 2: "DEF", 3: "MID", 4: "FWD",
  gk: "GK", goalkeeper: "GK", kaleci: "GK", k: "GK",
  def: "DEF", defender: "DEF", defans: "DEF", d: "DEF",
  mid: "MID", midfielder: "MID", "orta saha": "MID", ortasaha: "MID", o: "MID",
  fwd: "FWD", forward: "FWD", forvet: "FWD", f: "FWD",
};

let list = null;
let from = null;
for (const [path, json] of Object.entries(dumps)) {
  list = findPlayerArray(json);
  if (list) {
    from = path;
    break;
  }
}
if (!list) {
  console.error("oyuncu listesi tanınamadı; --dump ile dökümleri inceleyip normalize kurallarını güncelle.");
  process.exit(1);
}
log(`oyuncu listesi: ${from} (${list.length} kayıt)`);

const teamsDump = dumps["teams"];
const teamNameById = new Map();
if (Array.isArray(teamsDump ?? teamsDump?.data)) {
  for (const t of teamsDump.data ?? teamsDump) {
    const id = pick(t, [/^id$/i, /teamid/i]);
    const name = pick(t, [/name/i]);
    if (id != null && name) teamNameById.set(String(id), String(name));
  }
}

const unknownTeams = new Set();
const players = [];
for (const p of list) {
  const name = pick(p, [/^(name|fullname|displayname|playername|ad|isim)$/i, /name/i]);
  const rawTeam =
    pick(p, [/^(team|club|takim|kulup)(name)?$/i]) ??
    teamNameById.get(String(pick(p, [/teamid|clubid|takimid/i]))) ??
    pick(p, [/team|club|takim|kulup/i]);
  const teamName = typeof rawTeam === "object" && rawTeam ? pick(rawTeam, [/name/i]) : rawTeam;
  const team = teamName ? teamIdOf(String(teamName)) : null;
  if (!team) {
    unknownTeams.add(String(teamName));
    continue;
  }
  const rawPos = pick(p, [/^(pos|position|mevki|role)(id|name|code)?$/i, /pos|mevki/i]);
  const pos = POS[String(typeof rawPos === "object" && rawPos ? pick(rawPos, [/id|name|code/i]) : rawPos).toLowerCase()];
  if (!pos) continue;
  const price = Number(pick(p, [/^(price|fiyat|value|cost|deger|nowcost)$/i, /price|fiyat/i]));
  const sel = pick(p, [/sel|owner|ownership|secilme|percent/i]);
  const status = pick(p, [/status|durum|injur|availab/i]);
  const pts = pick(p, [/total.*point|totpts|puan|points/i]);
  const mins = pick(p, [/minute|dakika|mins/i]);
  players.push({
    name: String(name),
    team,
    pos,
    // Fiyatlar TL cinsinden geliyorsa (ör. 12500000) milyona indir.
    price: Number.isFinite(price) ? (price > 1000 ? price / 1_000_000 : price) : null,
    sel: sel == null ? null : Number(sel),
    status:
      typeof status === "string"
        ? /injur|sakat/i.test(status)
          ? "I"
          : /susp|ceza/i.test(status)
            ? "S"
            : /doubt|supheli|şüpheli/i.test(status)
              ? "D"
              : null
        : null,
    pts: Number(pts) || 0,
    mins: Number(mins) || 0,
    gameId: pick(p, [/^id$/i, /playerid/i]) ?? null,
  });
}
if (unknownTeams.size) log(`bilinmeyen takımlar: ${[...unknownTeams].join(", ")}`);

// FotMob id'leri önceki dosyadan taşı (ad eşleme fetch-squads ile yenilenir).
const prev = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : null;
const prevById = new Map((prev?.players ?? []).map((p) => [`${p.team}|${p.name}`, p]));
for (const p of players) {
  const old = prevById.get(`${p.team}|${p.name}`);
  if (old?.fotmobId) p.fotmobId = old.fotmobId;
}

players.sort(
  (a, b) =>
    a.team.localeCompare(b.team, "tr") ||
    (b.price ?? 0) - (a.price ?? 0) ||
    a.name.localeCompare(b.name, "tr"),
);

const withPts = players.filter((p) => p.pts > 0).length;
const out = {
  meta: {
    source: `TFF Fantezi Lig oyuncu listesi (tfffantezilig.com), ${new Date().toISOString().slice(0, 10)}`,
    gameweek: GAMEWEEK,
    players: players.length,
    pricesFrom: "game",
    pointsCover: withPts ? "this-season" : "none",
  },
  players,
};
writeFileSync(target, JSON.stringify(out, null, 1) + "\n");
log(`yazıldı: ${target} (${players.length} oyuncu, ${withPts} puanlı)`);
log("sonra: node scripts/fetch-squads.mjs (FotMob id eşlemesi) ve node scripts/fetch-lineups.mjs");
