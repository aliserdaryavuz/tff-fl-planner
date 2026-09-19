// Kullanıcının kendi takımının sezon geçmişini oyunun API'sinden çeker:
// hafta hafta resmî puan/sıra/transfer ve o haftanın 15 kişilik kadrosu.
//
//   data/team-history.json
//
//   node scripts/fetch-team-history.mjs [--league 1] [--team <id>]
//
// Takım kimliği verilmezse `users/me` içindeki `fantasyTeamId` kullanılır.
// Dosyaya yalnız FANTEZİ verisi yazılır: takım adı, puan, sıra, kadro. Kişisel
// alanlar (e-posta, ad, doğum tarihi) `users/me` yanıtında geliyor ama dosyaya
// GEÇMİYOR — repo herkese açık.
//
// API Keycloak ile korunuyor ve giriş Google hesabıyla; istekler projeye
// ayrılmış Chrome profilindeki oturumdan geçer (scripts/lib/chrome.mjs).
// İlk kurulum: node scripts/chrome-login.mjs
//
// ---------------------------------------------------------------------------
// DİKKAT — puanlar oyunun resmî haftalık toplamını VERMİYOR
//
// Oyuncu başına `points` kendi içinde tutarlı (döküm toplamına eşit) ve yedek
// toplamı oyunun `benchPoints` değerine birebir uyuyor. Ama ilk 11 toplamı +
// kaptan, oyunun `pointsHistory.points` değerinden düşük çıkıyor ve üç haftada
// fark, 15 oyuncunun TAMAMININ puanını toplasak bile kapanmıyor — yani eksik
// olan şey yanlış yerleştirilmiş bir puan değil, hiç görmediğimiz bir bileşen.
// (19.09.2026 ölçümü, PLAN.md §4.3.)
//
// Bu yüzden betik resmî sayıyı YENİDEN HESAPLAMAZ; `pointsHistory`'den olduğu
// gibi alır ve kendi topladığımız sayıyı `sum` alanlarında ayrıca yazar.
// `gapVsOfficial` farkı açıkça taşır ki arayüz gizlemek zorunda kalmasın.
// ---------------------------------------------------------------------------

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "./lib/chrome.mjs";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const LEAGUE = argOf("league", "1");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const log = (m) => process.stderr.write(`${m}\n`);
const today = new Date();
const DATE = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;

const chrome = await connect();
log(`bağlandı: ${chrome.version.Browser}`);

async function get(path) {
  const r = await chrome.json(path);
  if (r.status !== 200 || !r.json?.data) {
    throw new Error(`${path}: ${r.status} ${(r.body ?? "").slice(0, 200)}`);
  }
  return r.json.data;
}

/* ---------- takım kimliği ---------- */

let teamId = argOf("team");
if (!teamId) {
  const me = await get(`users/me?league-id=${LEAGUE}`).catch(() => null);
  if (!me?.fantasyTeamId) {
    await chrome.close();
    throw new Error("takım kimliği bulunamadı; giriş için: node scripts/chrome-login.mjs");
  }
  teamId = me.fantasyTeamId;
}
// Kimliği logla, kişisel alanları değil.
log(`takım #${teamId}`);

/* ---------- haftalar ---------- */

// İlk çağrı hem takım özetini hem hafta listesini veriyor; `pointsHistory`
// yalnız OYNANMIŞ (ya da başlamış) haftaları içeriyor, bu yüzden hafta
// listesini oradan alıyoruz — sabit 34 döngüsü boş hafta çekerdi.
const ilk = await get(`fantasy-team/teams/${teamId}?gameweek-id=1`);
const history = ilk.pointsHistory ?? [];
if (!history.length) {
  await chrome.close();
  throw new Error("pointsHistory boş: sezon başlamamış ya da takım kurulmamış");
}
log(`hafta: ${history.length}`);

const weeks = [];
for (const h of history) {
  const d = h.gameweekId === 1 ? ilk : await get(`fantasy-team/teams/${teamId}?gameweek-id=${h.gameweekId}`);
  const players = d.squad?.players ?? [];
  if (!players.length) {
    log(`  hafta ${h.gameweekId}: kadro yok, atlandı`);
    continue;
  }

  const squad = [...players]
    .sort((a, b) => Number(b.isStarting) - Number(a.isStarting) || a.slotOrder - b.slotOrder)
    .map((p) => ({
      id: p.playerId,
      pos: p.position,
      slot: p.slotOrder,
      start: !!p.isStarting,
      captain: !!p.captain,
      vice: !!p.viceCaptain,
      status: p.matchStatus,
      points: p.points ?? 0,
      // Döküm oyunun kendi kalem adlarıyla: GOAL, CLEAN_SHEET, GOALS_CONCEDED_2,
      // SAVES_3, BONUS, YELLOW_CARD, APPEARANCE_*. lib/scoring.mjs'i gerçek
      // veriyle sınamak için burada duruyor.
      breakdown: (p.breakdown ?? []).map((e) => ({
        type: e.eventType,
        count: e.count,
        per: e.pointsPer,
        pts: e.subtotal,
      })),
    }));

  const sum = (arr) => arr.reduce((s, p) => s + p.points, 0);
  const starting = squad.filter((p) => p.start);
  const bench = squad.filter((p) => !p.start);
  const captain = squad.find((p) => p.captain);
  const ourTotal = sum(starting) + (captain?.points ?? 0);

  weeks.push({
    gw: h.gameweekId,
    order: h.gameweekOrder,
    formation: d.squad?.formation ?? null,
    official: {
      points: h.points,
      cumulative: h.cumulativePoints,
      bench: h.benchPoints,
      transfers: h.transfers,
      weeklyRank: h.weeklyRank,
      overallRank: h.overallRank,
      rankChange: h.rankChange,
      avgPoints: h.avgPoints,
      highestPoints: h.highestPoints,
      teamValue: h.teamValue,
    },
    // Bizim topladığımız: resmî sayının yerine geçmez, yanında durur.
    sumStarting: sum(starting),
    sumBench: sum(bench),
    sumWithCaptain: ourTotal,
    /** Resmî puan eksi bizimki. Sıfır değil; nedeni bilinmiyor (başlıktaki not). */
    gapVsOfficial: h.points - ourTotal,
    squad,
  });
  log(`  hafta ${h.gameweekId}: resmî ${h.points}, bizim ${ourTotal}, fark ${h.points - ourTotal}`);
}

/* ---------- oyuncu adları ---------- */

// Kadro yalnız `playerId` veriyor; ad/kulüp için mevcut oyuncu dosyasıyla
// `gameId` üzerinden eşleşiyor. Sezon ilerledikçe ligden ayrılmış bir oyuncu
// listede olmayabilir: adı null kalır, uydurulmaz.
const playersPath = resolve(root, "data/fantasy-players.json");
const byGameId = new Map();
if (existsSync(playersPath)) {
  const file = JSON.parse(readFileSync(playersPath, "utf8"));
  for (const p of file.players ?? []) {
    if (p.gameId != null) byGameId.set(p.gameId, { name: p.name, team: p.team, pos: p.pos });
  }
}

let unmatched = 0;
const seen = new Set();
for (const w of weeks) {
  for (const p of w.squad) {
    const m = byGameId.get(p.id);
    if (m) {
      p.name = m.name;
      p.team = m.team;
    } else if (!seen.has(p.id)) {
      seen.add(p.id);
      unmatched++;
    }
  }
}
if (unmatched) log(`ad eşleşmeyen oyuncu: ${unmatched}`);

/* ---------- yazma ---------- */

await chrome.close();

const out = {
  meta: {
    source: `TFF Fantezi Lig resmî API (tfffantezilig.com), ${DATE}`,
    fetched: today.toISOString().slice(0, 10),
    weeks: weeks.length,
    unmatchedPlayers: unmatched,
    // Dosyayı okuyan herkes farkın bilindiğini ve gizlenmediğini görsün.
    pointsNote:
      "Resmî haftalık puan `official.points`; `sumWithCaptain` bizim topladığımız. " +
      "İkisi tutmuyor ve nedeni bilinmiyor (PLAN.md §4.3). Resmî sayı yeniden hesaplanmaz.",
  },
  team: {
    id: ilk.teamId,
    name: ilk.name,
    totalPoints: ilk.totalPoints,
    totalRank: ilk.totalRank,
    teamValue: ilk.teamValue,
    budget: ilk.budget,
    remainingBudget: ilk.remainingBudget,
  },
  weeks,
};

const target = resolve(root, "data/team-history.json");
writeFileSync(target, JSON.stringify(out, null, 1) + "\n");
log(`yazıldı: ${target}`);
