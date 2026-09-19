// FotMob sayfalarından veri: API tarayıcı dışına kapalı, sayfalar Next.js ve
// tüm veri __NEXT_DATA__ içinde; headless Chrome ile DOM alınır.
// Bitmiş maç sayfaları diske önbelleklenir (değişmezler); fikstür ve
// oynanmamış maç sayfaları için `cache: false` ver.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CHROME =
  process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

export const CACHE_DIR = resolve(
  process.env.LOCALAPPDATA ?? process.env.TMPDIR ?? ".",
  "tff-fl-planner-cache/fotmob",
);
mkdirSync(CACHE_DIR, { recursive: true });

/** FotMob'daki Süper Lig id'si (lig sayfası: /leagues/71). */
export const LEAGUE_ID = 71;

/** data id -> FotMob takım sayfası (id + slug). Lig tablosu sayfasından, 09.09.2026. */
export const FOTMOB = {
  Galatasaray: [8637, "galatasaray"],
  Fenerbahce: [8695, "fenerbahce"],
  Besiktas: [10188, "besiktas"],
  Trabzonspor: [9752, "trabzonspor"],
  Basaksehir: [1933, "basaksehir"],
  Samsunspor: [9750, "samsunspor"],
  Kocaelispor: [1569, "kocaelispor"],
  Alanyaspor: [4678, "alanyaspor"],
  Amedspor: [96498, "amed-sportif"],
  Corum: [357274, "corum-fk"],
  Erzurumspor: [281467, "erzurumspor-fk"],
  Eyupspor: [4681, "eyupspor"],
  Gaziantep: [4081, "gaziantep-fk"],
  Genclerbirligi: [7800, "genclerbirligi"],
  Goztepe: [1925, "goztepe"],
  Kasimpasa: [4685, "kasmpasa"],
  Konyaspor: [8622, "konyaspor"],
  Rizespor: [2166, "rizespor"],
};

/**
 * Ek Chrome bayrakları, boşlukla ayrılmış. CI'da `--no-sandbox` gerekiyor:
 * runner kullanıcısının sandbox için gereken namespace'leri yok ve bayrak
 * olmadan Chrome boş DOM döndürüyor — 19.09'da ilk zamanlanmış koşu tam
 * bundan düştü. Yerelde boş, yani masaüstünde sandbox açık kalıyor.
 */
const EXTRA_FLAGS = (process.env.CHROME_FLAGS ?? "").split(/\s+/).filter(Boolean);

function fetchNextData(url) {
  const res = spawnSync(
    CHROME,
    [
      // `--headless=new`: eski headless yeni Chrome sürümlerinde kaldırıldı.
      "--headless=new",
      "--disable-gpu",
      "--dump-dom",
      "--virtual-time-budget=12000",
      ...EXTRA_FLAGS,
      url,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const m = res.stdout?.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) {
    // Sessiz kalmasın: veri yoksa bunun sebebi sayfanın boş olması da olabilir,
    // Chrome'un hiç çalışmaması da. İkisi çok farklı ve ayırt edilebilmeli.
    if (res.status !== 0 || !res.stdout) {
      process.stderr.write(
        `  chrome başarısız (çıkış ${res.status}): ${String(res.stderr ?? "").slice(0, 200)}\n`,
      );
    }
    return null;
  }
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/** Sayfanın __NEXT_DATA__ JSON'u; yoksa null. */
export function nextData(url, { cache = true } = {}) {
  const file = resolve(CACHE_DIR, `${url.replace(/[^a-z0-9]+/gi, "_").slice(-150)}.json`);
  if (cache && existsSync(file)) {
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch {
      // bozuk önbellek: yeniden indir
    }
  }
  const data = fetchNextData(url);
  if (data && cache) writeFileSync(file, JSON.stringify(data));
  return data;
}

/** Takımın tüm fikstürü (bitmiş ve oynanmamış), zamana göre sırasız. */
export function teamFixtures(fotmobId, slug, opts) {
  const j = nextData(`https://www.fotmob.com/teams/${fotmobId}/fixtures/${slug}`, opts);
  const fb = j?.props?.pageProps?.fallback?.[`team-${fotmobId}`];
  const list = fb?.fixtures?.allFixtures?.fixtures ?? [];
  return list.map((f) => ({
    id: String(f.id),
    pageUrl: f.pageUrl,
    utc: f.status?.utcTime ?? "",
    finished: Boolean(f.status?.finished),
    competition: f.tournament?.name ?? f.leagueName ?? "",
    home: f.home?.name ?? "",
    away: f.away?.name ?? "",
  }));
}

/**
 * Maçın olay dökümü: gol, kart, kaçan penaltı. Diğer türler atılıyor —
 * `Substitution` zaten oyuncu bazında kayıtlı, `Half`/`AddedTime`/`VAR` sonuç
 * sayfasında bir şey anlatmıyor, `Comment` ise çöp oyuncu taşıyor
 * (`id: 0`, adı boşluk).
 *
 * Alan adları ve değer kümeleri önbellekteki 59 maç sayfasında sayılarak
 * belirlendi, örnekten genellenmedi: kart üç değer alıyor (Yellow 225,
 * Red 8, YellowRed 5), gol tarifi dört (boş 142, penalty 14, owngoal 6,
 * direct_free_kick 1), ve `assistStr` dolu olup `assistInput` boş olan tek
 * kayıt yok — yani asist için tek alan yeterli.
 *
 * `shotmapEvent` bilerek saklanmıyor: olay başına yüzlerce bayt ve sonuç
 * sayfasında kullanılmıyor.
 */
function matchEvents(raw = []) {
  const out = [];
  for (const e of raw) {
    const type = String(e.type ?? "");
    const kind =
      type === "Goal" ? "goal" : type === "Card" ? "card" : type === "MissedPenalty" ? "penaltyMiss" : null;
    if (!kind) continue;
    const id = e.player?.id ?? e.playerId ?? null;
    // Comment gibi olaylarda oyuncu sahte (id 0); adı da boşluk.
    const name = (e.nameStr ?? e.fullName ?? e.player?.name ?? "").trim();
    if (!name) continue;
    const ev = {
      kind,
      min: typeof e.time === "number" ? e.time : null,
      home: e.isHome === true,
      player: name,
      playerId: id || null,
    };
    if (kind === "goal") {
      ev.own = e.ownGoal === true || e.goalDescriptionKey === "owngoal";
      ev.how = e.goalDescriptionKey ?? null;
      ev.assist = e.assistInput ?? null;
      ev.assistId = e.assistPlayerId ?? null;
      ev.score = Array.isArray(e.newScore) ? e.newScore : null;
    }
    if (kind === "card") ev.card = e.card ?? null;
    out.push(ev);
  }
  return out;
}

/** Maçın adamı: ad bir nesne, puan metin olarak geliyor. */
function playerOfTheMatch(potm) {
  if (!potm?.name?.fullName) return null;
  const rating = Number(potm.rating?.num);
  return {
    id: potm.id ?? null,
    name: potm.name.fullName,
    home: potm.isHomeTeam === true,
    rating: Number.isFinite(rating) ? rating : null,
  };
}

/**
 * Maç sayfası: tarih, lig, lineup (starters/subs/unavailable, lineupType),
 * skor üzerinden her iki tarafın yediği gol (temiz kalma hesabı için), olay
 * dökümü ve maçın adamı.
 */
export function matchPage(pageUrl, opts) {
  const j = nextData(`https://www.fotmob.com${pageUrl}`, opts);
  const pp = j?.props?.pageProps;
  if (!pp) return null;
  const teams = pp.header?.teams ?? [];
  const home = teams[0]?.score;
  const away = teams[1]?.score;
  // Gol dakikaları: "oyuncu sahadayken yenilen gol" bunlardan hesaplanıyor
  // (lib/scoring.mjs, concededOn). `isHome` golü atan tarafı söylüyor.
  const goals = (pp.content?.matchFacts?.events?.events ?? [])
    .filter((e) => /^goal$/i.test(e.type ?? "") && typeof e.time === "number")
    .map((e) => ({ min: e.time, home: e.isHome === true }));

  // Oyuncu başına maç istatistiği. Gerçekleşen gol/asist gürültülü (bir maçta
  // gol atmak 4-6 puan, atmamak 2); beklenen gol ve asist aynı şeyin daha az
  // gürültülü ölçümü. Kurtarış da burada maç maç: oyunun sezon toplamı, maç
  // başına üçer üçer işleyen kuralı yeniden kurmaya yetmiyordu (PLAN.md 1.1).
  const stats = {};
  for (const [id, p] of Object.entries(pp.content?.playerStats ?? {})) {
    const flat = {};
    for (const group of p.stats ?? []) {
      for (const [label, entry] of Object.entries(group.stats ?? {})) {
        const v = entry?.stat?.value;
        if (typeof v === "number") flat[label] = v;
      }
    }
    if (!Object.keys(flat).length) continue;
    stats[id] = {
      xg: flat["Expected goals (xG)"] ?? 0,
      xgnp: flat["xG Non-penalty"] ?? null,
      xa: flat["Expected assists (xA)"] ?? 0,
      shots: flat["Total shots"] ?? 0,
      chances: flat["Chances created"] ?? 0,
      saves: flat["Saves"] ?? 0,
    };
  }

  return {
    date: (pp.general?.matchTimeUTCDate ?? "").slice(0, 10),
    competition: pp.general?.leagueName ?? "",
    lineup: pp.content?.lineup ?? null,
    stats,
    goals,
    // Sonuç sayfası için; `goals` ve `lineup` olduğu gibi duruyor çünkü
    // `fetch-lineups.mjs` onlara bağlı.
    events: matchEvents(pp.content?.matchFacts?.events?.events),
    potm: playerOfTheMatch(pp.content?.matchFacts?.playerOfTheMatch),
    conceded:
      typeof home === "number" && typeof away === "number"
        ? { home: away, away: home }
        : null,
  };
}

/** Takım kadrosu sayfası: oyuncular (id, ad, mevki). */
export function teamSquad(fotmobId, slug, opts) {
  const j = nextData(`https://www.fotmob.com/teams/${fotmobId}/squad/${slug}`, opts);
  const fb = j?.props?.pageProps?.fallback?.[`team-${fotmobId}`];
  // Sayfa yapısı: fallback["team-<id>"].squad.squad = [{ title, members }]
  const squad = fb?.squad;
  return Array.isArray(squad) ? squad : Array.isArray(squad?.squad) ? squad.squad : null;
}
