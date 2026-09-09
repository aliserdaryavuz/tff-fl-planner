import { type Player, playerKey, type Position, POSITIONS } from "@/lib/fantasy";
import {
  bestLineup,
  FORMATIONS,
  type Lineup,
  XI_MAX,
} from "@/lib/formations";
import type { PickRow } from "@/lib/picks";

/** TFF Fantezi Lig kadrosu: 15 oyuncu, 2-5-5-3. */
export const FORMATION: Record<Position, number> = {
  GK: 2,
  DEF: 5,
  MID: 5,
  FWD: 3,
};

export const SQUAD_SIZE = 15;
/** Milyon TL. */
export const BUDGET = 100;
export const MAX_PER_CLUB = 3;
/** Yedeklerin hedefteki ağırlığı (otomatik değişiklik şansı). */
export const DEFAULT_BENCH_WEIGHT = 0.1;

export { playerKey };

export type Squad = Lineup & {
  players: Player[];
  /** Toplam fiyat, M TL. */
  price: number;
  /** İlk 11'e giden para. */
  xiPrice: number;
};

export type SquadResult = {
  best: Squad | null;
  count: number;
  capped: boolean;
  options: Squad[];
  error?: string;
};

export type BuildOptions = {
  maxOptions?: number;
  budget?: number;
  /** Bu kadar puan yakın kadrolar da listelensin. */
  tolerance?: number;
  benchWeight?: number;
  /** Kadroda (ilk 11'de) kesin yer alacak oyuncular (playerKey). */
  locked?: string[];
  /** Asla girmeyecek oyuncular (playerKey). */
  excluded?: string[];
};

// Puanlar 2 ondalıkta tam sayıya çevrilir ki beraberlikler kesin olsun.
const SCORE_UNITS = 100;

type Candidate = {
  row: PickRow;
  pos: Position;
  /** Fiyat, tam sayı birimde. */
  price: number;
  score: number;
};

/** İlk 11 mevki sayaçları: (gk 0-1, def 0-5, mid 0-5, fwd 0-3) -> tek sayı. */
const LIMITS = [XI_MAX.GK, XI_MAX.DEF, XI_MAX.MID, XI_MAX.FWD];
const POS_STRIDE = [
  (LIMITS[1] + 1) * (LIMITS[2] + 1) * (LIMITS[3] + 1),
  (LIMITS[2] + 1) * (LIMITS[3] + 1),
  LIMITS[3] + 1,
  1,
];
const POS_STATES = (LIMITS[0] + 1) * (LIMITS[1] + 1) * (LIMITS[2] + 1) * (LIMITS[3] + 1);

function posIndex(counts: Record<Position, number>): number {
  return (
    counts.GK * POS_STRIDE[0] +
    counts.DEF * POS_STRIDE[1] +
    counts.MID * POS_STRIDE[2] +
    counts.FWD * POS_STRIDE[3]
  );
}

const POS_COUNTS: number[][] = Array.from({ length: POS_STATES }, (_, idx) => {
  const gk = Math.floor(idx / POS_STRIDE[0]);
  const rest1 = idx % POS_STRIDE[0];
  const def = Math.floor(rest1 / POS_STRIDE[1]);
  const rest2 = rest1 % POS_STRIDE[1];
  const mid = Math.floor(rest2 / POS_STRIDE[2]);
  const fwd = rest2 % POS_STRIDE[2];
  return [gk, def, mid, fwd];
});

/** İki mevki bileşimini toplar; herhangi bir mevki sınırı aşıyorsa -1. */
const ADD_POS = (() => {
  const table = new Int16Array(POS_STATES * POS_STATES).fill(-1);
  for (let a = 0; a < POS_STATES; a++) {
    for (let b = 0; b < POS_STATES; b++) {
      let idx = 0;
      let ok = true;
      for (let i = 0; i < 4; i++) {
        const sum = POS_COUNTS[a][i] + POS_COUNTS[b][i];
        if (sum > LIMITS[i]) {
          ok = false;
          break;
        }
        idx += sum * POS_STRIDE[i];
      }
      if (ok) table[a * POS_STATES + b] = idx;
    }
  }
  return table;
})();

function subPos(a: number, b: number): number {
  let idx = 0;
  for (let i = 0; i < 4; i++) {
    const diff = POS_COUNTS[a][i] - POS_COUNTS[b][i];
    if (diff < 0) return -1;
    idx += diff * POS_STRIDE[i];
  }
  return idx;
}

type Offer = {
  posIdx: number;
  price: number;
  score: number;
  sets: Candidate[][];
};

const MAX_SETS_PER_OFFER = 4;

/** Kulüp başına mevki başına DP'ye giren en fazla aday (puana göre). */
const MAX_PER_CLUB_POSITION = 6;

/**
 * Kulüpten en fazla `limit` oyuncu alınabildiği için, aynı mevkide kendisinden
 * hem ucuz (ya da eşit) hem iyi (ya da eşit) en az `limit` oyuncu olan aday
 * hiçbir çözümde gerekmez: onu kullanan çözümde yerine henüz alınmamış bir
 * baskın oyuncu konabilir. Kalanlardan puana göre en iyi birkaçı DP'ye girer;
 * yerel arama gerisini dener.
 */
function prunePosition(list: Candidate[], limit: number): Candidate[] {
  const kept = list.filter((c) => {
    let dominators = 0;
    for (const o of list) {
      if (o === c) continue;
      if (o.price <= c.price && o.score >= c.score && (o.price < c.price || o.score > c.score || list.indexOf(o) < list.indexOf(c))) {
        dominators++;
        if (dominators >= limit) return false;
      }
    }
    return true;
  });
  return kept.sort((a, b) => b.score - a.score || a.price - b.price).slice(0, MAX_PER_CLUB_POSITION);
}

function buildOffers(clubPlayers: Candidate[], limit: number): Offer[] {
  const byPos = new Map<Position, Candidate[]>();
  for (const pos of POSITIONS) {
    const list = clubPlayers.filter((c) => c.pos === pos);
    if (list.length) byPos.set(pos, prunePosition(list, limit));
  }
  const pool = limit > 0 ? [...byPos.values()].flat() : [];

  const map = new Map<string, Offer>();
  const add = (chosen: Candidate[]) => {
    const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    let price = 0;
    let score = 0;
    for (const c of chosen) {
      counts[c.pos]++;
      price += c.price;
      score += c.score;
    }
    for (const pos of POSITIONS) if (counts[pos] > XI_MAX[pos]) return;
    const idx = posIndex(counts);
    const key = `${idx}|${price}`;
    const existing = map.get(key);
    if (!existing || score > existing.score) {
      map.set(key, { posIdx: idx, price, score, sets: [chosen] });
    } else if (score === existing.score && existing.sets.length < MAX_SETS_PER_OFFER) {
      existing.sets.push(chosen);
    }
  };

  add([]);
  for (let i = 0; i < pool.length && limit >= 1; i++) {
    add([pool[i]]);
    for (let j = i + 1; j < pool.length && limit >= 2; j++) {
      add([pool[i], pool[j]]);
      for (let k = j + 1; k < pool.length && limit >= 3; k++) {
        add([pool[i], pool[j], pool[k]]);
      }
    }
  }

  // Aynı mevki bileşimi için daha pahalı ve daha kötü teklifleri at.
  const bySig = new Map<number, Offer[]>();
  for (const offer of map.values()) {
    const list = bySig.get(offer.posIdx) ?? [];
    list.push(offer);
    bySig.set(offer.posIdx, list);
  }
  const offers: Offer[] = [];
  for (const list of bySig.values()) {
    list.sort((a, b) => a.price - b.price || b.score - a.score);
    let best = -Infinity;
    for (const offer of list) {
      if (offer.score > best) {
        offers.push(offer);
        best = offer.score;
      }
    }
  }
  return offers;
}

const EMPTY_RESULT = (error?: string): SquadResult => ({
  best: null,
  count: 0,
  capped: false,
  options: [],
  error,
});

/** Fiyatlar 0,5 adımlıysa yarım, değilse 0,1 birim (kesin bütçe kontrolü için). */
export function priceUnit(prices: number[]): number {
  const half = prices.every((p) => Math.abs(p * 2 - Math.round(p * 2)) < 1e-9);
  return half ? 2 : 10;
}

/**
 * DP her zaman yarım birimde koşar (100 M = 200 durum); 0,1 adımlı fiyatlar
 * yukarı yuvarlanır. Yuvarlama bütçeyi asla aştırmaz, yalnızca DP'nin biraz
 * temkinli olmasına yol açar; yedek doldurma ve yerel arama kesin fiyatla
 * çalışıp artan parayı kullanır.
 */
const DP_HALF = 2;

/**
 * Kadro kurucu, ilk 11 öncelikli:
 *  1. Kulüp kulüp dinamik programlama ile bütçe ve kulüp sınırı altında puanı
 *     en yüksek ilk 11 (herhangi bir geçerli diziliş); yedek için gereken en
 *     ucuz para dizilişe göre ayrılır.
 *  2. Her ilk 11 için yedekler en ucuzdan doldurulur (kulüp sınırı ve bütçe
 *     korunarak).
 *  3. Bulunan kadrolar gerçek hedefe (ilk 11 + kaptan ×2 + yedek ağırlığı)
 *     göre değerlendirilir ve tek oyuncu takaslarıyla iyileştirilir.
 */
export function buildSquad(
  rows: PickRow[],
  {
    maxOptions = 40,
    budget = BUDGET,
    tolerance = 1.5,
    benchWeight = DEFAULT_BENCH_WEIGHT,
    locked = [],
    excluded = [],
  }: BuildOptions = {},
): SquadResult {
  const priced = rows.filter((r) => r.player.price != null);
  if (!priced.length) return EMPTY_RESULT("no-prices");
  const unit = priceUnit(priced.map((r) => r.player.price as number));
  /** Kesin birim (0,5 ya da 0,1): bütçe kontrolleri. */
  const toUnits = (price: number) => Math.round(price * unit);
  /** DP birimi (0,5, yukarı yuvarlanmış). */
  const toDp = (price: number) => Math.ceil(price * DP_HALF - 1e-9);
  const budgetUnits = toUnits(budget);
  const budgetDp = Math.floor(budget * DP_HALF + 1e-9);

  const lockedKeys = new Set(locked);
  const excludedKeys = new Set(excluded);
  const lockedRows = priced.filter((r) => lockedKeys.has(playerKey(r.player)));

  // Kilitli oyuncular ilk 11'e girer: mevki sınırı, kulüp ve bütçe kontrolü.
  const lockedPos: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  const lockedClubs = new Map<string, number>();
  let lockedUnits = 0;
  let lockedDp = 0;
  for (const r of lockedRows) {
    lockedPos[r.player.pos]++;
    lockedClubs.set(r.player.team, (lockedClubs.get(r.player.team) ?? 0) + 1);
    lockedUnits += toUnits(r.player.price as number);
    lockedDp += toDp(r.player.price as number);
  }
  for (const pos of POSITIONS) {
    if (lockedPos[pos] > XI_MAX[pos]) return EMPTY_RESULT("locked-position");
  }
  if (lockedRows.length > 11) return EMPTY_RESULT("locked-position");
  for (const n of lockedClubs.values()) {
    if (n > MAX_PER_CLUB) return EMPTY_RESULT("locked-club");
  }
  if (lockedUnits > budgetUnits) return EMPTY_RESULT("locked-budget");

  const open = priced.filter((r) => {
    const key = playerKey(r.player);
    return !lockedKeys.has(key) && !excludedKeys.has(key);
  });

  const scoreOf = new Map<string, number>();
  for (const r of priced) scoreOf.set(playerKey(r.player), r.score);
  const score = (p: Player) => scoreOf.get(playerKey(p)) ?? 0;

  // Yedek adayları: mevki başına en ucuz (eşitlikte puanı yüksek).
  const cheap: Record<Position, PickRow[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const pos of POSITIONS) {
    cheap[pos] = open
      .filter((r) => r.player.pos === pos)
      .sort((a, b) => (a.player.price as number) - (b.player.price as number) || b.score - a.score);
  }
  /** Dizilişe göre yedek bileşimi. */
  const benchNeed = (d: number, m: number, f: number): Record<Position, number> => ({
    GK: FORMATION.GK - 1,
    DEF: FORMATION.DEF - d,
    MID: FORMATION.MID - m,
    FWD: FORMATION.FWD - f,
  });
  /** Yedek için ayrılması gereken en az para, DP biriminde (kulüp çakışması yok sayılır). */
  const benchReserve = (need: Record<Position, number>): number | null => {
    let total = 0;
    for (const pos of POSITIONS) {
      const list = cheap[pos];
      if (list.length < need[pos]) return null;
      for (let i = 0; i < need[pos]; i++) total += toDp(list[i].player.price as number);
    }
    return total;
  };

  const candidates: Candidate[] = open.map((row) => ({
    row,
    pos: row.player.pos,
    price: toDp(row.player.price as number),
    score: Math.round(Math.max(0, row.score) * SCORE_UNITS),
  }));

  const byClub = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const list = byClub.get(c.row.player.team) ?? [];
    list.push(c);
    byClub.set(c.row.player.team, list);
  }
  const clubs = [...byClub.entries()].map(([team, list]) => ({
    team,
    offers: buildOffers(list, MAX_PER_CLUB - (lockedClubs.get(team) ?? 0)),
  }));

  const remainingBudget = budgetDp - lockedDp;
  const width = remainingBudget + 1;
  const STATES = POS_STATES * width;

  // Katman katman ileri DP; geri izleme için her katman saklanır.
  const layers: Int32Array[] = [];
  let cur = new Int32Array(STATES).fill(-1);
  cur[0] = 0;
  layers.push(cur);
  for (const club of clubs) {
    const next = Int32Array.from(cur);
    for (let posIdx = 0; posIdx < POS_STATES; posIdx++) {
      const base = posIdx * width;
      const addRow = posIdx * POS_STATES;
      for (let spent = 0; spent <= remainingBudget; spent++) {
        const s = cur[base + spent];
        if (s < 0) continue;
        for (const offer of club.offers) {
          if (offer.price === 0) continue;
          const nextSpent = spent + offer.price;
          if (nextSpent > remainingBudget) continue;
          const nextPos = ADD_POS[addRow + offer.posIdx];
          if (nextPos < 0) continue;
          const nextState = nextPos * width + nextSpent;
          const value = s + offer.score;
          if (value > next[nextState]) next[nextState] = value;
        }
      }
    }
    cur = next;
    layers.push(cur);
  }

  // Geçerli diziliş bitiş durumları: kilitliler + DP'nin seçtikleri = 1-d-m-f.
  type Final = { posIdx: number; reserve: number; formation: readonly [number, number, number] };
  const finals: Final[] = [];
  for (const formation of FORMATIONS) {
    const [d, m, f] = formation;
    const need = {
      GK: 1 - lockedPos.GK,
      DEF: d - lockedPos.DEF,
      MID: m - lockedPos.MID,
      FWD: f - lockedPos.FWD,
    };
    if (need.GK < 0 || need.DEF < 0 || need.MID < 0 || need.FWD < 0) continue;
    const reserve = benchReserve(benchNeed(d, m, f));
    if (reserve == null) continue;
    finals.push({ posIdx: posIndex(need), reserve, formation });
  }
  if (!finals.length) return EMPTY_RESULT("infeasible");

  let bestScore = -1;
  for (const fin of finals) {
    const base = fin.posIdx * width;
    for (let spent = 0; spent + fin.reserve <= remainingBudget; spent++) {
      const v = cur[base + spent];
      if (v > bestScore) bestScore = v;
    }
  }
  if (bestScore < 0) return EMPTY_RESULT("infeasible");

  // Geri izleme: en iyiye yakın ilk 11'leri topla.
  const slack = Math.max(0, Math.round(tolerance * SCORE_UNITS));
  const target = bestScore - slack;
  const found = new Map<string, { xi: Player[]; formation: readonly [number, number, number] }>();
  let capped = false;
  let visits = 0;
  const walkLimit = maxOptions * 3;

  const walk = (
    clubIndex: number,
    state: number,
    remaining: number,
    picked: Candidate[],
    formation: readonly [number, number, number],
  ) => {
    if (found.size >= walkLimit || ++visits > 1_500_000) {
      capped = capped || found.size >= walkLimit;
      return;
    }
    if (clubIndex === 0) {
      if (state !== 0) return;
      const total = picked.reduce((sum, c) => sum + c.score, 0);
      if (total < target) return;
      const xi = [...lockedRows.map((r) => r.player), ...picked.map((c) => c.row.player)];
      const key = xi.map(playerKey).sort().join("~");
      if (!found.has(key)) found.set(key, { xi, formation });
      return;
    }
    const club = clubs[clubIndex - 1];
    const prev = layers[clubIndex - 1];
    const spent = state % width;
    const posIdx = (state - spent) / width;
    if (prev[state] >= remaining - slack) walk(clubIndex - 1, state, remaining, picked, formation);
    for (const offer of club.offers) {
      if (offer.price === 0 || offer.price > spent) continue;
      const prevPos = subPos(posIdx, offer.posIdx);
      if (prevPos < 0) continue;
      const prevState = prevPos * width + (spent - offer.price);
      const prevValue = prev[prevState];
      if (prevValue < 0 || prevValue + offer.score < remaining - slack) continue;
      for (const set of offer.sets) {
        walk(clubIndex - 1, prevState, prevValue, [...picked, ...set], formation);
        if (found.size >= walkLimit) return;
      }
    }
  };

  for (const fin of finals) {
    const base = fin.posIdx * width;
    for (let spent = remainingBudget - fin.reserve; spent >= 0 && found.size < walkLimit; spent--) {
      const v = cur[base + spent];
      if (v >= target) walk(clubs.length, base + spent, v, [], fin.formation);
    }
  }

  // Yedekleri doldur: en ucuz, kulüp sınırı ve bütçe korunarak.
  const feasible = (players: Player[]) => {
    let total = 0;
    const clubCount = new Map<string, number>();
    for (const p of players) {
      total += toUnits(p.price as number);
      const n = (clubCount.get(p.team) ?? 0) + 1;
      if (n > MAX_PER_CLUB) return false;
      clubCount.set(p.team, n);
    }
    return total <= budgetUnits;
  };

  const fillBench = (xi: Player[], formation: readonly [number, number, number]): Player[] | null => {
    const need = benchNeed(formation[0], formation[1], formation[2]);
    const squad = [...xi];
    const keys = new Set(xi.map(playerKey));
    for (const pos of POSITIONS) {
      let left = need[pos];
      for (const r of cheap[pos]) {
        if (left <= 0) break;
        const key = playerKey(r.player);
        if (keys.has(key)) continue;
        const trial = [...squad, r.player];
        if (!feasible(trial)) continue;
        squad.push(r.player);
        keys.add(key);
        left--;
      }
      if (left > 0) return null;
    }
    return squad;
  };

  const toSquad = (players: Player[]): Squad => {
    const lineup = bestLineup(players, score, benchWeight, lockedKeys);
    const price = players.reduce((s, p) => s + (p.price as number), 0);
    const xiPrice = lineup.xi.reduce((s, p) => s + (p.price as number), 0);
    return { ...lineup, players: sortPlayers(players), price, xiPrice };
  };

  const seen = new Map<string, Squad>();
  const addSquad = (players: Player[]) => {
    if (players.length !== SQUAD_SIZE) return;
    const key = players.map(playerKey).sort().join("~");
    if (!seen.has(key)) seen.set(key, toSquad(players));
  };
  for (const { xi, formation } of found.values()) {
    const full = fillBench(xi, formation);
    if (full) addSquad(full);
  }
  if (!seen.size) return EMPTY_RESULT("infeasible");

  // Yerel arama: gerçek hedefe göre tek oyuncu takasları.
  const pools: Record<Position, Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const pos of POSITIONS) {
    pools[pos] = open
      .filter((r) => r.player.pos === pos)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((r) => r.player);
    // Ucuz yedek adayları da havuzda olsun.
    for (const r of cheap[pos].slice(0, 6)) {
      if (!pools[pos].some((p) => playerKey(p) === playerKey(r.player))) pools[pos].push(r.player);
    }
  }
  const climb = (start: Player[]): Player[] => {
    let current = [...start];
    let currentValue = bestLineup(current, score, benchWeight, lockedKeys).value;
    for (let iter = 0; iter < 30; iter++) {
      let bestMove: { index: number; player: Player; value: number } | null = null;
      const keys = new Set(current.map(playerKey));
      for (let i = 0; i < current.length; i++) {
        const out = current[i];
        if (lockedKeys.has(playerKey(out))) continue;
        for (const cand of pools[out.pos]) {
          const key = playerKey(cand);
          if (keys.has(key)) continue;
          // Değer her oyuncunun puanında artan: daha düşük puanlı takas işe yaramaz.
          if (score(cand) <= score(out) + 1e-9) continue;
          const next = [...current];
          next[i] = cand;
          if (!feasible(next)) continue;
          const value = bestLineup(next, score, benchWeight, lockedKeys).value;
          if (value > currentValue + 1e-9 && (!bestMove || value > bestMove.value)) {
            bestMove = { index: i, player: cand, value };
          }
        }
      }
      if (!bestMove) break;
      current = [...current];
      current[bestMove.index] = bestMove.player;
      currentValue = bestMove.value;
    }
    return current;
  };

  const starts = [...seen.values()].sort((a, b) => b.value - a.value).slice(0, 6);
  for (const s of starts) addSquad(climb(s.players));

  const sorted = [...seen.values()].sort(
    (a, b) => b.value - a.value || a.price - b.price,
  );
  const top = sorted[0].value;
  const options = sorted
    .filter((s) => s.value >= top - tolerance - 1e-9)
    .slice(0, maxOptions);

  return {
    best: options[0] ?? null,
    count: options.length,
    capped: capped || sorted.length > maxOptions,
    options,
  };
}

function sortPlayers(players: Player[]): Player[] {
  return [...players].sort(
    (a, b) =>
      POSITIONS.indexOf(a.pos) - POSITIONS.indexOf(b.pos) ||
      (b.price ?? 0) - (a.price ?? 0) ||
      a.name.localeCompare(b.name, "tr"),
  );
}
