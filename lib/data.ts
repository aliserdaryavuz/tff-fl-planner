import raw from "@/data/superlig-2026-27.json";

export type Team = {
  /** Fixture'lardaki anahtar, ör. "Fenerbahce" */
  id: string;
  /** Görünen ad, ör. "Fenerbahçe" */
  name: string;
  /** 2025/26 bitiş sırası (1-18); yükselenler 1. Lig sırasıyla 16-18. */
  last: number;
  /** tff.org kulüp id'si (Default.aspx?pageId=28&kulupID=) */
  tffId: number | null;
  tffName: string | null;
  /** Opta Power Rankings (0-100). */
  opta?: number;
  optaRank?: number;
  /** Transfermarkt toplam kadro değeri, milyon €. */
  value?: number;
  /** Kulüp Elo'su; kaynak erişilebilir olunca dolar. */
  elo?: number;
};

export type Fixture = {
  /** 1..34 */
  md: number;
  /** "2026-08-14" */
  date: string;
  /** Türkiye saati "21:30"; TFF henüz açıklamadıysa null. */
  tsi: string | null;
  home: string;
  away: string;
  /** Skor; oynanmadıysa null. */
  hg: number | null;
  ag: number | null;
  tffMatchId: number | null;
};

export type Meta = {
  season: string;
  league: string;
  weeks: number;
  source_fixtures: string;
  last_source?: string;
  generated: string;
  opta_source?: string;
  value_source?: string;
  elo_source?: string;
};

/** Ev sahibi / deplasman */
export type HomeAway = "E" | "D";

/** Bir takımın tek maçı, takımın gözünden. */
export type TeamFixture = {
  md: number;
  opp: string;
  ha: HomeAway;
  date: string;
  tsi: string | null;
  /** Oynandıysa atılan/yenilen gol. */
  gf: number | null;
  ga: number | null;
};

export const teams: Team[] = raw.teams as Team[];
export const fixtures: Fixture[] = raw.fixtures as Fixture[];
export const meta: Meta = raw.meta as Meta;

export const MATCHDAYS = 34;

export const teamIds: string[] = teams.map((t) => t.id);

export const byId: Record<string, Team> = Object.fromEntries(
  teams.map((t) => [t.id, t]),
);

/** Geçen sezon sırasına göre: seçici listelerinin sırası. */
export const displayOrder: string[] = [...teamIds].sort(
  (a, b) => byId[a].last - byId[b].last,
);

/** Takım id -> hafta sırasına dizilmiş 34 maç (schedule[id][md-1]). */
export const schedule: Record<string, TeamFixture[]> = (() => {
  const s: Record<string, TeamFixture[]> = Object.fromEntries(
    teamIds.map((id) => [id, [] as TeamFixture[]]),
  );
  for (const f of fixtures) {
    const common = { md: f.md, date: f.date, tsi: f.tsi };
    s[f.home]?.push({ ...common, opp: f.away, ha: "E", gf: f.hg, ga: f.ag });
    s[f.away]?.push({ ...common, opp: f.home, ha: "D", gf: f.ag, ga: f.hg });
  }
  for (const id of teamIds) s[id].sort((a, b) => a.md - b.md);
  return s;
})();

export const isPlayed = (f: Fixture) => f.hg != null && f.ag != null;

/** Sıradaki hafta: oynanmamış maçı olan ilk hafta (sezon bittiyse 34). */
export function nextMatchday(): number {
  for (let md = 1; md <= MATCHDAYS; md++) {
    if (fixtures.some((f) => f.md === md && !isPlayed(f))) return md;
  }
  return MATCHDAYS;
}

/** Haftanın maçları, başlama anına göre; saati olmayanlar sona. */
export function fixturesOf(md: number): Fixture[] {
  return fixtures
    .filter((f) => f.md === md)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.tsi ?? "99:99").localeCompare(b.tsi ?? "99:99") ||
        a.home.localeCompare(b.home),
    );
}

export type TableRow = {
  id: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
  /** Maç başına puan; hiç oynamadıysa 0. */
  ppg: number;
  rank: number;
};

/** Oynanan maçlardan puan durumu (TFF sıralama ölçütleri: puan, averaj, atılan). */
export function computeTable(): TableRow[] {
  const rows: Record<string, TableRow> = Object.fromEntries(
    teamIds.map((id) => [
      id,
      { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, ppg: 0, rank: 0 },
    ]),
  );
  for (const f of fixtures) {
    if (!isPlayed(f)) continue;
    const h = rows[f.home];
    const a = rows[f.away];
    if (!h || !a) continue;
    const hg = f.hg as number;
    const ag = f.ag as number;
    h.p++;
    a.p++;
    h.gf += hg;
    h.ga += ag;
    a.gf += ag;
    a.ga += hg;
    if (hg > ag) {
      h.w++;
      a.l++;
      h.pts += 3;
    } else if (hg < ag) {
      a.w++;
      h.l++;
      a.pts += 3;
    } else {
      h.d++;
      a.d++;
      h.pts++;
      a.pts++;
    }
  }
  const list = Object.values(rows);
  for (const r of list) r.ppg = r.p ? r.pts / r.p : 0;
  list.sort(
    (x, y) =>
      y.pts - x.pts ||
      y.gf - y.ga - (x.gf - x.ga) ||
      y.gf - x.gf ||
      byId[x.id].name.localeCompare(byId[y.id].name, "tr"),
  );
  list.forEach((r, i) => {
    r.rank = i + 1;
  });
  return list;
}

/** Bu sezon takım başına maç başına gol; hiç maç yoksa 1,35 (Süper Lig uzun dönem). */
export function leagueAvgGoals(): number {
  let goals = 0;
  let matches = 0;
  for (const f of fixtures) {
    if (!isPlayed(f)) continue;
    goals += (f.hg as number) + (f.ag as number);
    matches++;
  }
  // Az maçla ortalama oynak; 50 maça kadar uzun dönem değere doğru çekilir.
  const prior = 1.35;
  const k = 50;
  return matches ? (goals / 2 + prior * k) / (matches + k) : prior;
}
