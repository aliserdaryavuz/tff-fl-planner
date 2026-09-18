import raw from "@/data/lineups.json";
import rawPredicted from "@/data/predicted-xi.json";
import { meta, schedule } from "@/lib/data";
import type { Player } from "@/lib/fantasy";
import { matchPoints } from "@/lib/scoring.mjs";

/**
 * Oyuncunun son resmi maçlardaki verisi (FotMob, scripts/fetch-lineups.mjs):
 * başladı mı, kaç dakika, gol, asist, kart, takımın yediği gol, bonus. Buradan
 * hem sıradaki haftada ilk 11'de başlama olasılığı hem de beklenen puan
 * modelinin oyuncu oranları (gol/90 vb.) türetilir.
 */
export type RecentMatch = {
  date: string;
  competition: string;
  started: boolean;
  minutes: number;
  rating?: number | null;
  goals?: number;
  assists?: number;
  yellow?: number;
  red?: number;
  ownGoals?: number;
  penMissed?: number;
  penSaved?: number;
  /** Takımın o maçta yediği gol (skor bilinmiyorsa null). */
  conceded?: number | null;
  /**
   * Oyuncu sahadayken yenilen gol. Yenilen gol cezası buna işliyor: oyundan
   * çıkan defansa sonradan yenilen goller kesilmemeli (PLAN.md 1.1).
   */
  concededOn?: number | null;
  cleanSheet?: boolean;
  /** Maçtaki bonus (3/2/1), her iki takımın puanına göre. */
  bonus?: number;
};

export type LineupInfo = {
  fotmobId: number;
  fotmobName: string;
  /** En yeniden eskiye. */
  recent: RecentMatch[];
  unavailable: { type: string; until: string | null } | null;
};

export type LineupsMeta = {
  source: string;
  fetched: string | null;
  matchesPerTeam: number;
  teams: Record<string, { matches: number; players: number }>;
};

export const lineups: Record<string, LineupInfo> = raw.players as Record<
  string,
  LineupInfo
>;
export const lineupsMeta: LineupsMeta = raw.meta as LineupsMeta;

export const hasLineupData = Object.keys(lineups).length > 0;

/** Sıradaki hafta için tahmini ilk 11, kaynak başına bir kayıt. */
export type PredictedSource = {
  source: string;
  /**
   * "confirmed": maç saatine yakın resmî kadro; "predicted": tahmin;
   * "lastStarting11": takımın son çıktığı 11 (zayıf sinyal).
   */
  kind: "predicted" | "confirmed" | "lastStarting11";
  match: string;
  /** Oyun dosyasındaki adlarla. */
  starters: string[];
  unmatched: string[];
};

export type PredictedTeam = {
  sources: PredictedSource[];
  /** Maç öncesi sakat/cezalı listesi (FotMob), oyun dosyasındaki adlarla. */
  unavailable: string[];
};

export type PredictedMeta = {
  source: string;
  fetched: string | null;
  matchday: number;
  previews: number;
};

export const predictedXi: Record<string, PredictedTeam> = rawPredicted.teams as Record<
  string,
  PredictedTeam
>;
export const predictedMeta: PredictedMeta = rawPredicted.meta as PredictedMeta;

/**
 * Oyuncunun tahmin durumu. `sources`: takım için sayılan kaynak sayısı,
 * `listed`: oyuncuyu 11'de gösteren kaynak sayısı. Kaynak yalnız 11'in en az
 * 9'u eşleştiyse sayılır; oyuncunun soyadı o kaynakta eşlenemeyen bir adla
 * çakışıyorsa (iki Yılmaz) o kaynak bu oyuncu için sayılmaz. `confirmed`:
 * resmî kadro açıklandıysa oradaki durumu. `unavailable`: maç öncesi
 * sakat/cezalı listesinde.
 */
export type Predicted = {
  sources: number;
  listed: number;
  /** "Son çıkan 11" tipi zayıf kaynaklar, ayrı sayılır. */
  weakSources: number;
  weakListed: number;
  confirmed: "start" | "out" | null;
  unavailable: boolean;
};

export const NO_PREDICTION: Predicted = {
  sources: 0,
  listed: 0,
  weakSources: 0,
  weakListed: 0,
  confirmed: null,
  unavailable: false,
};

const lastToken = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/ø/g, "o")
    .replace(/[^a-z\s-]/g, " ")
    .trim()
    .split(/[\s-]+/)
    .pop() ?? "";

/**
 * Tahmin dosyası tek bir haftayı anlatır (`predictedMeta.matchday`). Başka bir
 * hafta planlanıyorsa o haftanın 11'i hakkında hiçbir şey söylemez: eski
 * haftanın listesi, adı eşleşmeyen oyuncuyu haksız yere "11'de değil" sayar.
 */
export function predictionApplies(md: number | null | undefined): boolean {
  return md == null || predictedMeta.matchday === md;
}

export function predictedFor(player: Player, md?: number | null): Predicted {
  if (!predictionApplies(md)) return NO_PREDICTION;
  const team = predictedXi[player.team];
  if (!team) return NO_PREDICTION;
  const mine = lastToken(player.name);
  let sources = 0;
  let listed = 0;
  let weakSources = 0;
  let weakListed = 0;
  let confirmed: Predicted["confirmed"] = null;
  for (const s of team.sources) {
    if (s.starters.length < 9) continue;
    const inXi = s.starters.includes(player.name);
    if (s.kind === "confirmed") {
      confirmed = inXi ? "start" : "out";
      continue;
    }
    // Aynı soyadlı eşleşmeyen bir ad varsa bu kaynak bu oyuncu için sayılmaz.
    if (!inXi && s.unmatched.some((n) => lastToken(n) === mine)) continue;
    if (s.kind === "lastStarting11") {
      weakSources++;
      if (inXi) weakListed++;
    } else {
      sources++;
      if (inXi) listed++;
    }
  }
  return {
    sources,
    listed,
    weakSources,
    weakListed,
    confirmed,
    unavailable: team.unavailable.includes(player.name),
  };
}

/** Verisi olmayan oyuncunun olasılığı (düşük, bilinçli). */
export const UNKNOWN_START = 0.15;
/** Bu kadar maç görülünce veriye tam güvenilir. */
const FULL_CONFIDENCE_MATCHES = 3;
/** En yeni maç en ağır: 5, 4, 3, 2, 1, 1. */
const RECENCY = [5, 4, 3, 2, 1, 1];

export function lineupOf(player: Player): LineupInfo | undefined {
  return lineups[`${player.team}|${player.name}`];
}

/** Tahmini 11'de olan: en az 0,75, geçmişi iyiyse daha yüksek. */
const PREDICTED_START_FLOOR = 0.75;
/** Tahmin var ama oyuncu yok: geçmişin bu kadarı kalır. */
const PREDICTED_OUT_FACTOR = 0.35;
/** "Son çıkan 11" zayıf kaynak: daha alçak taban, daha yumuşak ceza. */
const WEAK_START_FLOOR = 0.6;
const WEAK_OUT_FACTOR = 0.6;

/**
 * Son maç verisi olmayan oyuncu için oyunun resmî dakikasından kaba bir
 * başlama payı: oynanan hafta sayısı × 90'a oranı. FotMob verisi kadar iyi
 * değil (hangi maçta başladığı bilinmiyor) ama "hiç veri yok" varsayımından
 * çok daha doğru: 4 haftada 360 dakika oynayan biri kesinlikle ilk 11'dedir.
 */
function officialStartShare(player: Player): number | null {
  // Bölen, takımın fiilen oynadığı maç sayısı: hafta içi (oyunun "şu anki"
  // haftası sürerken) henüz oynamamış takımın oyuncusu, olmayan bir maçta
  // oynamamış sayılıp haksız yere düşük paya inmesin.
  const played = schedule[player.team]?.filter((f) => f.gf != null).length ?? 0;
  const done = played || (meta.currentGameweek ?? 0);
  if (done <= 0 || !player.mins) return null;
  return Math.min(1, player.mins / (90 * done));
}

/**
 * Oyuncunun maç kadrosunda olma olasılığı. Başlama olasılığından ayrı: sakat
 * ya da cezalı biri yedek olarak da giremez, dolayısıyla süre puanı da alamaz.
 * Sakat/cezalı 0; maç öncesi listede "yok" görünen 0,15; gerisi 1.
 */
export function availability(
  player: Player,
  info: LineupInfo | undefined = lineupOf(player),
  predicted: Predicted = predictedFor(player),
): number {
  if (player.status === "I" || player.status === "S") return 0;
  if (predicted.confirmed === "start") return 1;
  if (predicted.unavailable) return 0.15;
  if (info?.unavailable) {
    const until = info.unavailable.until;
    if (!until || Date.parse(until) > Date.now()) return 0.15;
  }
  return 1;
}

export function startProbability(
  player: Player,
  info: LineupInfo | undefined = lineupOf(player),
  predicted: Predicted = predictedFor(player),
): number {
  // Oyunun kendi durumu kesin: sakat ve cezalı oynamaz.
  if (player.status === "I" || player.status === "S") return 0;
  // Resmî kadro açıklandıysa tartışma bitti.
  if (predicted.confirmed === "start") return 0.97;
  if (predicted.confirmed === "out") return 0.05;
  // Maç öncesi sakat/cezalı listesi (en güncel bilgi).
  if (predicted.unavailable) return 0.05;

  // Taban: resmî dakika payı varsa ondan, yoksa "bilinmiyor".
  const share = officialStartShare(player);
  let p = share == null ? UNKNOWN_START : 0.85 * share + 0.15 * UNKNOWN_START;
  if (info) {
    // Kulübün listesinde sakat/cezalı: dönüş tarihi geçmemişse oynamaz.
    if (info.unavailable) {
      const until = info.unavailable.until;
      if (!until || Date.parse(until) > Date.now()) return 0.05;
    }
    const recent = [...info.recent].sort((a, b) => b.date.localeCompare(a.date));
    const n = recent.length;
    if (n > 0) {
      let w = 0;
      let starts = 0;
      let mins = 0;
      recent.slice(0, RECENCY.length).forEach((m, i) => {
        const weight = RECENCY[i];
        w += weight;
        starts += weight * (m.started ? 1 : 0);
        mins += (weight * Math.min(90, Math.max(0, m.minutes))) / 90;
      });
      const observed = 0.65 * (starts / w) + 0.35 * (mins / w);
      const confidence = Math.min(1, n / FULL_CONFIDENCE_MATCHES);
      p = confidence * observed + (1 - confidence) * UNKNOWN_START;
    }
  }

  // Sıradaki maçın tahmini 11'leri geçmişin üstüne biner. Her kaynak için:
  // 11'deyse taban + geçmişin payı, değilse geçmişin bir kısmı; kaynaklar eşit
  // ağırlıkla ortalanır. "Son çıkan 11" tipi kaynak daha yumuşak uygulanır:
  // zaten geçmiş maçlardan türetilmiş, iki kez sayılmasın.
  const blend = (floor: number, outFactor: number, share: number) =>
    share * (floor + (1 - floor) * p) + (1 - share) * p * outFactor;
  if (predicted.sources > 0) {
    p = blend(PREDICTED_START_FLOOR, PREDICTED_OUT_FACTOR, predicted.listed / predicted.sources);
  } else if (predicted.weakSources > 0) {
    p = blend(WEAK_START_FLOOR, WEAK_OUT_FACTOR, predicted.weakListed / predicted.weakSources);
  }

  if (player.status === "D") p *= 0.6;
  return Math.min(0.97, Math.max(0, p));
}

/**
 * Başlama olasılığının skora etkisi, tek yerde. `impact` 0-1: 1 = tam çarpan
 * (hiç oynamayacak oyuncu ×0,15'e iner), 0 = süre tamamen yok sayılır.
 * Model çıktısı "oynarsa kaç puan" olduğu için oynama olasılığı yalnız burada
 * sayılır; iki kez uygulanmaz.
 */
export function minutesMultiplier(startProb: number, impact: number): number {
  const k = Math.min(1, Math.max(0, impact));
  return 1 - k + k * (0.15 + 0.85 * startProb);
}

/** Son maçlardan dakika ve oran özeti; beklenen puan modeli buradan besleniyor. */
export type RecentSummary = {
  matches: number;
  minutes: number;
  starts: number;
  /** Yedekten girdiği maç sayısı. */
  subIns: number;
  /** Başladığı maçlarda ortalama dakika; başlamadıysa null. */
  minutesWhenStarted: number | null;
  /** Yedek girdiği maçlarda ortalama dakika. */
  minutesWhenSub: number | null;
  /** Başladığı maçların kaçında 60'tan fazla oynadı. */
  over60WhenStarted: number | null;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  ownGoals: number;
  penMissed: number;
  penSaved: number;
  bonus: number;
  /** TFF puan tablosuyla hesaplanan gerçek fantasy puanı (bonus dahil). */
  fantasyPoints: number;
};

/**
 * Oyunun puanlamadığı maçlar. TFF Fantezi Lig yalnız Süper Lig'i sayıyor; Avrupa
 * kupaları, Türkiye Kupası ve hazırlık maçları puan üretmiyor.
 *
 * Kural "neyi dışla" diye yazıldı, "neyi dahil et" diye değil: FotMob lig adını
 * bir gün "Trendyol Süper Lig" yaparsa beyaz liste veriyi sessizce boşaltırdı.
 * Tanınmayan bir yarışma adı lig sayılır — eksik veriye değil, fazla veriye düşer.
 *
 * Ölçüm (18.09.2026): 1873 kaydın 167'si Avrupa maçı, 436 oyuncunun 109'unu
 * etkiliyor. Fenerbahçe'de Ederson'un 360 lig dakikasının yanında 180 Avrupa
 * dakikası var; bunlar üretim oranına ve puan/90'a girdiğinde oyuncu olduğundan
 * verimli görünüyordu.
 */
const UNSCORED = /champions|europa|conference|friendl|cup|kupa/i;

export function isScoredMatch(m: { competition: string }): boolean {
  return !UNSCORED.test(m.competition);
}

/**
 * Son maçların özeti. **Yalnız oyunun puanladığı maçlar** sayılır (bkz.
 * `isScoredMatch`). Başlama olasılığı bundan etkilenmiyor: `startProbability`
 * özeti değil `info.recent`'i doğrudan okuyor ve Avrupa'da oynamak "kadroda ve
 * formda" bilgisini taşıdığı için orada bilinçli olarak hepsi sayılıyor.
 */
export function summarizeRecent(
  player: Player,
  info: LineupInfo | undefined = lineupOf(player),
): RecentSummary {
  const s: RecentSummary = {
    matches: 0,
    minutes: 0,
    starts: 0,
    subIns: 0,
    minutesWhenStarted: null,
    minutesWhenSub: null,
    over60WhenStarted: null,
    goals: 0,
    assists: 0,
    yellow: 0,
    red: 0,
    ownGoals: 0,
    penMissed: 0,
    penSaved: 0,
    bonus: 0,
    fantasyPoints: 0,
  };
  if (!info) return s;
  let startMin = 0;
  let subMin = 0;
  let over60 = 0;
  for (const m of info.recent) {
    if (!isScoredMatch(m)) continue;
    s.matches++;
    s.minutes += m.minutes;
    if (m.started) {
      s.starts++;
      startMin += m.minutes;
      if (m.minutes > 60) over60++;
    } else if (m.minutes > 0) {
      s.subIns++;
      subMin += m.minutes;
    }
    s.goals += m.goals ?? 0;
    s.assists += m.assists ?? 0;
    s.yellow += m.yellow ?? 0;
    s.red += m.red ?? 0;
    s.ownGoals += m.ownGoals ?? 0;
    s.penMissed += m.penMissed ?? 0;
    s.penSaved += m.penSaved ?? 0;
    s.bonus += m.bonus ?? 0;
    s.fantasyPoints +=
      matchPoints(player.pos, {
        minutes: m.minutes,
        goals: m.goals,
        assists: m.assists,
        conceded: m.conceded ?? undefined,
        // Ceza yalnız oyuncu sahadayken yenilen gole işlemeli; alan yoksa
        // matchPoints maç toplamına düşüyor (lib/scoring.mjs).
        concededOn: m.concededOn ?? undefined,
        penSaved: m.penSaved,
        penMissed: m.penMissed,
        yellow: m.yellow,
        red: m.red,
        ownGoals: m.ownGoals,
      }) + (m.bonus ?? 0);
  }
  if (s.starts) {
    s.minutesWhenStarted = startMin / s.starts;
    s.over60WhenStarted = over60 / s.starts;
  }
  if (s.subIns) s.minutesWhenSub = subMin / s.subIns;
  return s;
}

/** Gerçek fantasy puanı / 90, az dakikada güvensiz sayılarak (270 dk = yarı güven). */
export function fantasyPer90(summary: RecentSummary): number | null {
  if (summary.minutes <= 0) return null;
  const raw = (90 * summary.fantasyPoints) / summary.minutes;
  return raw * (summary.minutes / (summary.minutes + 270));
}
